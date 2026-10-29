// Making many showcase viewers at once (phase V5 of docs/viewer-brief.md): everything the batch
// does without reading an app's page or opening a browser — reading each model through the
// shared readers, choosing what its viewer shows (a recipe, the document's own showcase, its
// fmGraph boards, `auto`, or the logic only), placing a recipe's boards by name, filling the
// viewer's page (given as text) and the report. tools/make-viewers.js is the command around it:
// it reads apps/fmViewer.html and drives ExcelExporter for the workbooks.
//
// Everything read from a model or a recipe is data: texts kept as text (the viewer shows them
// with textContent), numbers forced, every "<" in a data block written < by fillViewerPage.
// Node only, no packages (Node's own zlib packs the workbook, as the viewer unpacks it).
'use strict';

const zlib = require('zlib');
const { readFmData, FMIDE_FILE_MIGRATIONS } = require('../src/shared/fmide-files.js');
const { fileTextProblem, fileDataProblem } = require('../src/shared/file-formats.js');
const SC = require('../src/shared/showcase.js');
const SB = require('../src/shared/showcase-boards.js');

const REPORT_KIND = 'fmIDE-viewer-report';
const REPORT_VERSION = 1;

// ---------- reading ----------

// A model file's text: { name, kind, system, doc (the workspace, or null), graphBoards, showcase,
// excelText (the model as fmIDE hands it to ExcelExporter) } or { error }.
function readModelText(text, fileName){
  const big = fileTextProblem(text);
  if(big) return { error: big };
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ return { error: 'It isn\'t a JSON file (an fmIDE document, .fmide, is one).' }; }
  const deep = fileDataProblem(raw);
  if(deep) return { error: deep };
  const r = readFmData(raw, ['fmIDE-workspace', 'system'], FMIDE_FILE_MIGRATIONS);
  if(r.error) return { error: r.error };
  const newer = r.newer ? ['the file was saved by a newer fmIDE: it is read as far as this one can'] : [];
  const name = modelName(fileName);
  if(r.kind === 'system'){
    const system = r.data;
    if(!Array.isArray(system.canvases) || !system.canvases.length) return { error: 'The model has no canvases.' };
    return { name, kind: 'system', system, doc: null, graphBoards: null, showcase: null, warnings: newer.concat(r.warnings || []),
      excelText: JSON.stringify(system) };
  }
  const ws = r.data;
  const system = ws.system && typeof ws.system === 'object' ? JSON.parse(JSON.stringify(ws.system)) : null;
  if(!system || !Array.isArray(system.canvases) || !system.canvases.length) return { error: 'The document holds no model.' };
  // The model block holds what fmIDE's own Make showcase viewer… writes there: the system file,
  // with the format presets — never the document's templates, macros, shortcuts or library.
  if(!Array.isArray(system.formatPresets) && Array.isArray(ws.formatPresets)) system.formatPresets = ws.formatPresets;
  const graphBoards = ws.graphBoards && typeof ws.graphBoards === 'object' && ws.graphBoards.kind === 'fmIDE-graph-board' && ws.graphBoards.form !== 'template' ? ws.graphBoards : null;
  // ExcelExporter gets what fmIDE's Open ExcelExporter sends (21-web-app.js, buildExcelPayload).
  const excel = { kind: 'fmIDE-workspace', version: ws.version, system,
    templates: (Array.isArray(ws.templates) ? ws.templates : []).filter(t => t && t.kind === 'module' && t.attachments && t.attachments.excel),
    formatPresets: Array.isArray(ws.formatPresets) ? ws.formatPresets : undefined };
  if(graphBoards) excel.graphBoards = graphBoards;
  if(ws.excelLayout) excel.excelLayout = ws.excelLayout;
  return { name, kind: 'fmIDE-workspace', system, doc: ws, graphBoards,
    showcase: ws.showcase && typeof ws.showcase === 'object' && ws.showcase.form !== 'recipe' ? ws.showcase : null,
    warnings: newer.concat(r.warnings || []), excelText: JSON.stringify(excel) };
}
// A model's name for {model}: its file name without the folder and the extension.
function modelName(fileName){
  const base = String(fileName || 'Model').split(/[\\/]/).pop().replace(/\.(fmide|json)$/i, '');
  return SC.showcaseText(base, SC.SHOWCASE_LIMITS.title) || 'Model';
}

// A recipe file's text: { recipe (cleaned), problems } or { error }.
function readRecipeText(text){
  const big = fileTextProblem(text);
  if(big) return { error: big };
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ return { error: 'The recipe isn\'t a JSON file.' }; }
  const r = SC.readShowcaseData(raw);
  if(r.error) return { error: r.error };
  if(!r.recipe) return { error: 'That is a showcase for one model, not a recipe ("form": "recipe"): give it with the model instead.' };
  const c = SC.cleanShowcaseRecipe(r.data);
  return { recipe: c.value, problems: (r.newer ? ['The recipe is from a newer fmIDE: it is read as far as this one can.'] : []).concat(c.problems) };
}

// ---------- choosing ----------

// The canvases of a model: [{ id, name }].
const canvasesOf = (system) => system.canvases.filter(c => c && typeof c.id === 'string').map(c => ({ id: c.id, name: SC.showcaseText(c.name, 80) || c.id }));
const periodCount = (system) => Math.max(1, Array.isArray(system.periods) ? system.periods.length : 1);
// The names of what a board file shows: { sliders: [names], bars: [names], boards }.
function boardsSummary(file){
  const out = { boards: 0, sliders: [], bars: [], charts: 0, scenarios: 0 };
  if(!file || !Array.isArray(file.boards)) return out;
  out.boards = file.boards.length;
  out.scenarios = Array.isArray(file.scenarios) ? file.scenarios.length : 0;
  file.boards.forEach(b => {
    (Array.isArray(b && b.sliders) ? b.sliders : []).forEach(s => { if(s && typeof s.name === 'string' && !out.sliders.includes(s.name)) out.sliders.push(s.name); });
    (Array.isArray(b && b.items) ? b.items : []).forEach(w => {
      if(w && w.type === 'bar'){ if(typeof w.name === 'string' && !out.bars.includes(w.name)) out.bars.push(w.name); }
      else if(w) out.charts++;
    });
  });
  return out;
}
const scenarioNames = (file) => (file && Array.isArray(file.scenarios) ? file.scenarios : []).map(s => s && typeof s.name === 'string' ? SC.showcaseText(s.name, SC.SHOWCASE_LIMITS.scenario) : '').filter(Boolean);

// What one model's viewer shows (the owner's choice 1 of V5): a recipe given, for every model
// (its `auto` when none of its boards is found); without one, the document's own showcase,
// else its fmGraph boards, else `auto` when asked, else the logic only.
// opts: { recipe (cleaned) | null, auto: bool, excel: bool }. Returns { showcase (cleaned, as a
// file writes it), boards (the board file shown, or null), source, notes, notFound, canvasesNotFound }.
function chooseFor(m, opts){
  const recipe = opts.recipe || null;
  const notes = [], notFound = [], canvasesNotFound = [];
  const canvases = canvasesOf(m.system);
  const count = periodCount(m.system);
  const autoChoice = recipe && recipe.auto ? recipe.auto : opts.auto ? { sliders: 'inputs', bars: 'outputs', range: 50 } : null;
  const autoBoards = (periods) => {
    const r = SB.autoShowcaseBoards(m.system, Object.assign({}, autoChoice, { periods }));
    r.notes.forEach(n => notes.push(n));
    return r.file;
  };
  let source, boards = null, sc;
  if(recipe){
    source = 'recipe';
    const title = (recipe.title || '{model}').replace(/\{model\}/g, m.name);
    sc = { kind: SC.SHOWCASE_KIND, version: 1, title, description: recipe.description, author: recipe.author, licence: recipe.licence, mark: recipe.mark };
    if(recipe.canvases && recipe.canvases.show){
      const byName = new Map();
      canvases.forEach(c => { const k = c.name.toLowerCase(); byName.set(k, byName.has(k) ? null : c.id); });
      const ids = [];
      recipe.canvases.show.forEach(n => { const id = byName.get(n.toLowerCase()); if(id) ids.push(id); else canvasesNotFound.push(n); });
      if(ids.length) sc.canvases = { show: ids };
      if(recipe.canvases.start){
        const id = byName.get(recipe.canvases.start.toLowerCase());
        if(id && (!ids.length || ids.includes(id))) sc.canvases = Object.assign(sc.canvases || {}, { start: id });
        else if(!canvasesNotFound.includes(recipe.canvases.start)) canvasesNotFound.push(recipe.canvases.start);
      }
    }
    if(recipe.periods) sc.periods = recipe.periods;
    const periods = recipe.periods ? { from: recipe.periods.from, to: recipe.periods.to } : null;
    if(recipe.boards){
      const placed = SB.placeRecipeBoards(recipe.boards, m.system, m.graphBoards);
      placed.missing.forEach(x => notFound.push(x));
      boards = placed.file;
      if(!boards && autoChoice){ boards = autoBoards(periods); if(boards){ source = 'auto'; notes.push('None of the recipe\'s rectangles is in this model, so its sliders and bars were chosen for it (auto).'); } }
    } else if(autoChoice){
      boards = autoBoards(periods);
      if(boards) source = 'auto';
    }
    if(!boards) source = 'logic';
    if(recipe.play) sc.play = recipe.play;
    if(opts.excel){
      const file = recipe.excel ? recipe.excel.file.replace(/\{model\}/g, m.name) : (title || m.name);
      sc.excel = { file: SC.showcaseFileName(file) || SC.showcaseFileName(m.name) || 'Model.xlsx' };
    }
  } else if(m.showcase){
    source = 'showcase';
    const c = SC.cleanShowcase(m.showcase);
    c.problems.forEach(p => notes.push('The document\'s showcase: ' + p));
    sc = SC.showcaseForFile(c.value);
    boards = sc.boards || m.graphBoards || null;
    if(!opts.excel) delete sc.excel;
    else if(!sc.excel) sc.excel = { file: SC.showcaseFileName(sc.title || m.name) || 'Model.xlsx' };
  } else {
    sc = { kind: SC.SHOWCASE_KIND, version: 1, title: m.name };
    if(m.graphBoards && Array.isArray(m.graphBoards.boards) && m.graphBoards.boards.length){ source = 'boards'; boards = m.graphBoards; }
    else if(autoChoice){ boards = autoBoards(null); source = boards ? 'auto' : 'logic'; }
    else source = 'logic';
    if(opts.excel) sc.excel = { file: SC.showcaseFileName(m.name) || 'Model.xlsx' };
  }
  if(boards && source !== 'showcase') sc.boards = boards;
  // Play's ends must be Base or a scenario the boards hold.
  if(sc.play){
    const names = ['Base'].concat(scenarioNames(sc.boards || boards));
    if(!names.includes(sc.play.from) || !names.includes(sc.play.to) || sc.play.from === sc.play.to){
      notes.push('Play\'s ends (' + sc.play.from + ', ' + sc.play.to + ') are not both Base or one of this model\'s scenarios: left out.');
      delete sc.play;
    }
  }
  if(source === 'logic') notes.push('Nothing was chosen to show on a Board, so the viewer shows the logic only' + (autoChoice ? ' (auto found no input that moves a result).' : ' (give a recipe, or --auto).'));
  const cleaned = SC.cleanShowcase(sc);
  cleaned.problems.forEach(p => notes.push(p));
  return { showcase: SC.showcaseForFile(cleaned.value), boards: (cleaned.value.boards || null) || (source === 'showcase' ? boards : null), source, notes, notFound, canvasesNotFound,
    shown: SC.resolveShowcase(cleaned.value, canvases, count).canvases };
}

// ---------- the batch ----------

// Ids made unique within the batch: "loan", "loan-2", "loan-3"….
function uniqueId(want, taken){
  let id = SC.SHOWCASE_ID.test(want || '') ? want : SC.showcaseIdFrom(want);
  if(!taken.has(id)){ taken.add(id); return id; }
  for(let n = 2; ; n++){
    const suffix = '-' + n;
    const t = id.slice(0, SC.SHOWCASE_LIMITS.id - suffix.length) + suffix;
    if(!taken.has(t)){ taken.add(t); return t; }
  }
}

// The workbook block from what ExcelExporter answered: { base64 (the .xlsx), map, notes }.
function workbookBlockFrom(answer){
  const bytes = Buffer.from(String(answer && answer.base64 || ''), 'base64');
  if(bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4B) throw new Error('ExcelExporter\'s answer isn\'t a workbook.');
  if(bytes.length > SC.CELL_MAP_LIMITS.workbook) throw new Error('The workbook is too big to go in a viewer.');
  const packed = zlib.deflateRawSync(bytes, { level: 9 });
  return { block: SC.viewerWorkbookFor(packed.toString('base64'), bytes.length, answer.map, answer.notes), size: bytes.length };
}

// Makes every viewer. models: [{ fileName, text }]; opts: { recipe (cleaned) | null, auto,
// excel (bool), viewerPage (the viewer's page as text), makeWorkbook: async (excelText, boards)
// → { base64, map, notes } (ExcelExporter, driven by make-viewers.js; needed when excel) }.
// Returns { viewers: [{ id, fileName, text }], report } — a model that fails is in the report
// and the others go on.
async function makeViewers(models, opts){
  const taken = new Set();
  const viewers = [];
  const entries = [];
  for(const f of models){
    const entry = { file: f.fileName, id: null, fileName: null, title: null, source: null, canvases: [], boards: 0, sliders: [], bars: [], charts: 0, scenarios: 0,
      notFound: [], canvasesNotFound: [], excel: null, size: 0, notes: [], error: null };
    entries.push(entry);
    try{
      const m = readModelText(f.text, f.fileName);
      if(m.error){ entry.error = m.error; continue; }
      m.warnings.forEach(w => entry.notes.push(w));
      const ch = chooseFor(m, opts);
      const sc = ch.showcase;
      sc.id = uniqueId(sc.id || sc.title || m.name, taken);
      entry.id = sc.id;
      entry.title = sc.title || '';
      entry.source = ch.source;
      entry.canvases = ch.shown.map(id => (canvasesOf(m.system).find(c => c.id === id) || { name: id }).name);
      const sum = boardsSummary(sc.boards || ch.boards);
      Object.assign(entry, { boards: sum.boards, sliders: sum.sliders, bars: sum.bars, charts: sum.charts, scenarios: sum.scenarios });
      entry.notFound = ch.notFound;
      entry.canvasesNotFound = ch.canvasesNotFound;
      ch.notes.forEach(n => entry.notes.push(n));
      let excelBlock = null;
      if(opts.excel && sc.excel){
        try{
          if(typeof opts.makeWorkbook !== 'function') throw new Error('No ExcelExporter to make it with.');
          const answer = await opts.makeWorkbook(m.excelText, sc.boards || ch.boards || null);
          const wb = workbookBlockFrom(answer);
          excelBlock = wb.block;
          entry.excel = { file: sc.excel.file, size: wb.size, notes: wb.block.notes };
        }catch(err){
          entry.excel = { error: String(err && err.message ? err.message : err).slice(0, 300) };
          entry.notes.push('Made without Excel: ' + entry.excel.error);
          delete sc.excel;
        }
      }
      const filled = SC.fillViewerPage(opts.viewerPage, sc, m.system, excelBlock);
      if(filled.error){ entry.error = filled.error; continue; }
      entry.fileName = sc.id + '.html';
      entry.size = Buffer.byteLength(filled.page, 'utf8');
      viewers.push({ id: sc.id, fileName: entry.fileName, text: filled.page, showcase: sc, model: m });
    }catch(err){
      entry.error = 'Something went wrong making it: ' + String(err && err.message ? err.message : err).slice(0, 300);
    }
  }
  return { viewers, report: reportFor(entries, opts) };
}

// ---------- the report ----------

function reportFor(entries, opts){
  const made = entries.filter(e => !e.error);
  return { kind: REPORT_KIND, version: REPORT_VERSION, made: made.length, failed: entries.length - made.length,
    withNotes: made.filter(e => e.notes.length || e.notFound.length || e.canvasesNotFound.length).length,
    bytes: made.reduce((s, e) => s + e.size, 0), recipe: !!opts.recipe, excel: !!opts.excel, viewers: entries };
}
const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const SOURCE_WORDS = { recipe: 'the recipe', showcase: 'the document\'s own showcase', boards: 'the document\'s fmGraph boards', auto: 'chosen for it (auto)', logic: 'nothing (the logic only)' };
function reportText(report){
  const lines = ['Showcase viewers made: ' + report.made + (report.failed ? ', failed: ' + report.failed : '') + ' — ' + kb(report.bytes) + ' in all.', ''];
  report.viewers.forEach(e => {
    lines.push(e.file);
    if(e.error){ lines.push('  FAILED: ' + e.error, ''); return; }
    lines.push('  ' + e.fileName + ' (' + kb(e.size) + '): "' + e.title + '"');
    lines.push('  Shows: ' + SOURCE_WORDS[e.source] + '; canvases: ' + (e.canvases.join(', ') || 'none'));
    if(e.boards) lines.push('  ' + e.boards + ' board' + (e.boards === 1 ? '' : 's') + ': sliders ' + (e.sliders.join(', ') || 'none') + '; bars ' + (e.bars.join(', ') || 'none') + (e.charts ? '; ' + e.charts + ' chart' + (e.charts === 1 ? '' : 's') : '') + (e.scenarios ? '; ' + e.scenarios + ' scenario' + (e.scenarios === 1 ? '' : 's') : ''));
    e.notFound.forEach(x => lines.push('  Not found: ' + x.name + (x.canvas ? ' (on ' + x.canvas + ')' : '') + ' — left out'));
    e.canvasesNotFound.forEach(n => lines.push('  Canvas not found: ' + n + ' — left out'));
    if(e.excel && !e.excel.error) lines.push('  Excel: ' + e.excel.file + ' (' + kb(e.excel.size) + ')' + (e.excel.notes.length ? ' — ' + e.excel.notes.join(' ') : ''));
    e.notes.forEach(n => lines.push('  Note: ' + n));
    lines.push('');
  });
  return lines.join('\n');
}

// ---------- a recipe from a model's choices (--write-recipe) ----------

// The boards a viewer shows, written back as a recipe in the board file's template form (each
// rectangle by its canvas's name and its own), to adjust and run again. Widgets the template
// form doesn't carry (Tornado, Spider, lines, Free) are left out.
function recipeFrom(viewer){
  const sc = viewer.showcase;
  const names = new Map(canvasesOf(viewer.model.system).map(c => [c.id, c.name]));
  const ref = (w) => {
    const out = Object.assign({}, w);
    out.canvas = names.get(w.canvasId) || '';
    delete out.canvasId; delete out.nodeId;
    return out;
  };
  const boards = (sc.boards && Array.isArray(sc.boards.boards) ? sc.boards.boards : []).map(b => ({
    name: b.name,
    items: (Array.isArray(b.items) ? b.items : []).filter(w => w && !SB.SB_LEFT_OUT_LAYOUTS.includes(w.layout)).map(w => {
      if(w.type === 'bar') return ref(w);
      if(w.layout === 'flow') return Object.assign({}, w, { steps: (w.steps || []).map(ref) });
      return Object.assign({}, w, { groups: (w.groups || []).map(g => Object.assign({}, g, { parts: (g.parts || []).map(ref) })) });
    }),
    sliders: (Array.isArray(b.sliders) ? b.sliders : []).map(ref),
  }));
  const recipe = { kind: SC.SHOWCASE_KIND, version: 1, form: 'recipe', title: '{model}' };
  ['description', 'author', 'licence'].forEach(k => { if(sc[k]) recipe[k] = sc[k]; });
  if(sc.mark === false) recipe.mark = false;
  if(boards.length) recipe.boards = { kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'system' }, boards };
  if(sc.periods) recipe.periods = sc.periods;
  if(sc.excel) recipe.excel = { file: '{model}.xlsx' };
  return recipe;
}

module.exports = { readModelText, readRecipeText, chooseFor, makeViewers, reportText, recipeFrom, uniqueId, workbookBlockFrom, modelName, REPORT_KIND, REPORT_VERSION };
