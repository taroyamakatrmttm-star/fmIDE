// ---------- showcase files (shared: src/shared/showcase.js; the showcase viewer, later fmIDE and tools/make-viewers.js) ----------
// A showcase says what a viewer shows (docs/viewer-brief.md, docs/file-formats.md): kind
// "fmIDE-showcase", version 1, in two forms — for one model (which canvases, boards, sliders,
// scenarios, the title), and the recipe form ("form": "recipe") that names rectangles by name
// for many models at once. The model itself is never in it.
//
// Everything here is read from a file that may come from anyone: texts are kept as plain
// strings cut to their limits (shown later with textContent only), numbers forced to be
// numbers, ids checked against a pattern and only ever compared. Nothing is run.
import { upgradeFileData } from './file-formats.js';

export const SHOWCASE_KIND = 'fmIDE-showcase';
export const SHOWCASE_FORMATS = { 'fmIDE-showcase': { current: 1, label: 'fmIDE showcase' } };
// One step per version, upgrading a copy (none yet: version 1 is the first).
export const SHOWCASE_MIGRATIONS = { 'fmIDE-showcase': {} };
export const SHOWCASE_LIMITS = { id: 60, title: 80, description: 400, author: 80, licence: 60, canvases: 500, canvasId: 200,
  scenario: 120, file: 120, periods: 10000, range: 100 };

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// A text from the file: a string (or number), control characters out, spaces at the ends
// trimmed, at most `max` characters; one line unless `multiline`.
export function showcaseText(v, max, multiline){
  if(typeof v !== 'string' && typeof v !== 'number') return '';
  let t = String(v).replace(/\r\n?/g, '\n');
  t = multiline ? t.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n')
    : t.replace(/[\u0000-\u001f\u007f]+/g, ' ');
  t = t.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}
// A file name for a download: no characters a file name can't hold, at most 120, ending .xlsx.
export function showcaseFileName(v){
  let t = showcaseText(v, SHOWCASE_LIMITS.file).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '');
  if(!t) return '';
  if(!/\.xlsx$/i.test(t)) t = t.slice(0, SHOWCASE_LIMITS.file - 5) + '.xlsx';
  return t;
}
export const SHOWCASE_ID = /^[A-Za-z0-9-]{1,60}$/;

// Reads a parsed file: { error } or { data (an upgraded copy), fromVersion, newer, recipe }.
export function readShowcaseData(raw){
  if(!isObject(raw)) return { error: "That file isn't a showcase." };
  if(raw.kind !== SHOWCASE_KIND){
    if(typeof raw.kind === 'string') return { error: 'That is an fmIDE file of another kind ("' + raw.kind.slice(0, 40) + '"), not a showcase.' };
    return { error: "That file isn't a showcase." };
  }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion, newer } = upgradeFileData(data, SHOWCASE_KIND, SHOWCASE_FORMATS, SHOWCASE_MIGRATIONS);
  return { data, fromVersion, newer, recipe: data.form === 'recipe' };
}

// The parts both forms share. `problems` gathers what was left out, in plain words.
function cleanCommon(d, problems, recipe){
  const out = {
    title: showcaseText(d.title, SHOWCASE_LIMITS.title),
    description: showcaseText(d.description, SHOWCASE_LIMITS.description, true),
    author: showcaseText(d.author, SHOWCASE_LIMITS.author),
    licence: showcaseText(d.licence, SHOWCASE_LIMITS.licence),
    mark: d.mark !== false,
  };
  if(d.mark !== undefined && typeof d.mark !== 'boolean') problems.push('"mark" is not true or false: the mark is shown.');
  if(recipe && out.title && !/\{model\}/.test(out.title) && /[{}]/.test(out.title)) problems.push('The title uses braces other than {model}: they are shown as they are.');
  return out;
}
// A board file kept as data (fmGraph's own reader takes it in the viewer's Board, phase V2).
function cleanBoardsField(v, problems, template){
  if(v === undefined || v === null) return null;
  if(!isObject(v) || v.kind !== 'fmIDE-graph-board' || !Number.isInteger(v.version) || v.version < 1){
    problems.push('"boards" is not an fmGraph board file: no boards.');
    return null;
  }
  const isTemplate = v.form === 'template';
  if(template && !isTemplate){ problems.push('A recipe\'s "boards" must be the board file\'s template form (rectangles by name): no boards.'); return null; }
  if(!template && isTemplate){ problems.push('"boards" is the template form, which is for recipes: no boards.'); return null; }
  return JSON.parse(JSON.stringify(v));
}

// A showcase for one model: { value, problems }.
// value: { kind, version, id, title, description, author, licence, mark,
//          canvases: { show: [ids] | null, start: id | null }, boards, play, periods, excel }
export function cleanShowcase(d){
  const problems = [];
  const v = Object.assign({ kind: SHOWCASE_KIND, version: 1 }, cleanCommon(d, problems, false));
  v.id = null;
  if(d.id !== undefined){
    if(typeof d.id === 'string' && SHOWCASE_ID.test(d.id)) v.id = d.id;
    else problems.push('The id may hold only letters, digits and dashes (at most 60): it is left out.');
  }
  v.canvases = { show: null, start: null };
  if(d.canvases !== undefined){
    if(!isObject(d.canvases)) problems.push('"canvases" is not a list of canvases: every canvas is shown.');
    else {
      if(d.canvases.show !== undefined){
        if(!Array.isArray(d.canvases.show)) problems.push('"canvases.show" is not a list: every canvas is shown.');
        else {
          const ids = [];
          d.canvases.show.forEach(x => { if(typeof x === 'string' && x && x.length <= SHOWCASE_LIMITS.canvasId && !ids.includes(x) && ids.length < SHOWCASE_LIMITS.canvases) ids.push(x); });
          if(ids.length < d.canvases.show.length) problems.push('Some entries of "canvases.show" are not canvas ids, or repeat: they are left out.');
          v.canvases.show = ids;
        }
      }
      if(d.canvases.start !== undefined){
        if(typeof d.canvases.start === 'string' && d.canvases.start && d.canvases.start.length <= SHOWCASE_LIMITS.canvasId) v.canvases.start = d.canvases.start;
        else problems.push('"canvases.start" is not a canvas id: the first canvas shown opens.');
      }
    }
  }
  v.boards = cleanBoardsField(d.boards, problems, false);
  v.play = null;
  if(d.play !== undefined){
    const from = isObject(d.play) ? showcaseText(d.play.from, SHOWCASE_LIMITS.scenario) : '';
    const to = isObject(d.play) ? showcaseText(d.play.to, SHOWCASE_LIMITS.scenario) : '';
    if(from && to) v.play = { from, to };
    else problems.push('"play" needs both ends, from and to: left out.');
  }
  v.periods = null;
  if(d.periods !== undefined){
    const p = d.periods;
    const from = isObject(p) ? Number(p.from) : NaN, to = isObject(p) ? Number(p.to) : NaN;
    if(isObject(p) && p.mode === 'range' && Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from && to < SHOWCASE_LIMITS.periods) v.periods = { mode: 'range', from, to };
    else problems.push('"periods" is not a range of periods (from and to, counted from 0): every period is shown.');
  }
  v.excel = null;
  if(d.excel !== undefined){
    const file = isObject(d.excel) ? showcaseFileName(d.excel.file) : '';
    if(file) v.excel = { file };
    else problems.push('"excel.file" is not a file name: left out.');
  }
  return { value: v, problems };
}

// A recipe: { value, problems }. value: { kind, version, form: 'recipe', title, description,
// author, licence, mark, boards (template form) | null, auto: { sliders, bars, range } | null }.
export function cleanShowcaseRecipe(d){
  const problems = [];
  const v = Object.assign({ kind: SHOWCASE_KIND, version: 1, form: 'recipe' }, cleanCommon(d, problems, true));
  v.boards = cleanBoardsField(d.boards, problems, true);
  v.auto = null;
  if(d.auto !== undefined){
    if(!isObject(d.auto)) problems.push('"auto" is not a set of choices: left out.');
    else {
      const sliders = d.auto.sliders === 'inputs' ? 'inputs' : null;
      const bars = d.auto.bars === 'outputs' ? 'outputs' : null;
      if(d.auto.sliders !== undefined && !sliders) problems.push('"auto.sliders" can only be "inputs": no sliders chosen.');
      if(d.auto.bars !== undefined && !bars) problems.push('"auto.bars" can only be "outputs": no bars chosen.');
      let range = 50;
      if(d.auto.range !== undefined){
        const r = Number(d.auto.range);
        if(Number.isFinite(r) && r >= 1 && r <= SHOWCASE_LIMITS.range) range = r;
        else problems.push('"auto.range" is not a percentage from 1 to 100: 50 is used.');
      }
      v.auto = { sliders, bars, range };
    }
  }
  return { value: v, problems };
}

// A showcase against the model it shows: the canvases listed (in the showcase's order, those the
// model has; every canvas when it names none), the one to open on, the periods shown.
// canvases: [{ id, name }] of the model; periodCount: the model's periods.
// Returns { canvases: [ids], start, periods: [indexes], problems }.
export function resolveShowcase(sc, canvases, periodCount){
  const problems = [];
  const known = new Set(canvases.map(c => c.id));
  let show = canvases.map(c => c.id);
  if(sc && sc.canvases && Array.isArray(sc.canvases.show)){
    const kept = sc.canvases.show.filter(id => known.has(id));
    const missing = sc.canvases.show.length - kept.length;
    if(missing) problems.push(missing === 1 ? 'One canvas the showcase names is not in the model: it is left out.' : missing + ' canvases the showcase names are not in the model: they are left out.');
    if(kept.length) show = kept;
    else if(sc.canvases.show.length) problems.push('None of the canvases the showcase names is in the model: every canvas is shown.');
  }
  let start = show[0] || null;
  if(sc && sc.canvases && sc.canvases.start){
    if(show.includes(sc.canvases.start)) start = sc.canvases.start;
    else problems.push('The canvas to open on is not among those shown: the first one opens.');
  }
  const count = Math.max(1, Number.isInteger(periodCount) ? periodCount : 1);
  let periods = [];
  for(let i = 0; i < count; i++) periods.push(i);
  if(sc && sc.periods){
    const from = Math.min(sc.periods.from, count - 1), to = Math.min(sc.periods.to, count - 1);
    if(sc.periods.from > count - 1) problems.push('The periods the showcase names are past the model\'s last: every period is shown.');
    else periods = periods.filter(p => p >= from && p <= to);
  }
  return { canvases: show, start, periods, problems };
}

// ---------- making a viewer (phase V3: fmIDE's Make showcase viewer…; later tools/make-viewers.js) ----------

// An id (and so the viewer's file name) from a title: letters and digits kept (accents taken
// off), everything else a dash, at most 60; "showcase" when nothing is left.
export function showcaseIdFrom(title){
  const t = showcaseText(title, 200).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SHOWCASE_LIMITS.id).replace(/-+$/g, '');
  return t || 'showcase';
}

// What an author can choose from a document's fmGraph boards (an fmIDE-graph-board file, kept
// as data): only the boards' and scenarios' names are read. `kept`: the showcase made before,
// whose boards' names say which to tick again (a board not there before comes unticked).
// Returns { boards: [{ name, chosen }], scenarios: [names] }.
export function showcaseBoardList(graphBoards, kept){
  const out = { boards: [], scenarios: [] };
  if(!isObject(graphBoards) || graphBoards.form === 'template') return out;
  const keptNames = kept && isObject(kept.boards) && Array.isArray(kept.boards.boards)
    ? kept.boards.boards.map(b => isObject(b) ? showcaseText(b.name, SHOWCASE_LIMITS.title) : '') : null;
  (Array.isArray(graphBoards.boards) ? graphBoards.boards : []).forEach((b, i) => {
    const name = (isObject(b) ? showcaseText(b.name, SHOWCASE_LIMITS.title) : '') || 'Board ' + (i + 1);
    out.boards.push({ name, chosen: kept ? !!keptNames && keptNames.includes(name) : true });
  });
  (Array.isArray(graphBoards.scenarios) ? graphBoards.scenarios : []).forEach(sc => {
    const name = isObject(sc) ? showcaseText(sc.name, SHOWCASE_LIMITS.scenario) : '';
    if(name && !out.scenarios.includes(name)) out.scenarios.push(name);
  });
  return out;
}

// The showcase for one model from an author's choices. choices: { id, title, description, author,
// licence, mark, canvases: [ids ticked], start, periods: { from, to } | null, boards: [indexes
// into graphBoards.boards], play: { from, to } | null }; graphBoards: the document's board file
// (or null); model: { canvases: [{ id }], periodCount }. Play's ends are "Base" (the model's own
// numbers) or a scenario's name. Every period chosen writes no `periods`. Returns { value (a
// cleaned showcase), problems, error }: error (nothing made) when no canvas is ticked.
export function showcaseFromChoices(choices, graphBoards, model){
  const c = isObject(choices) ? choices : {};
  const problems = [];
  const known = (model && Array.isArray(model.canvases) ? model.canvases : []).map(x => x && x.id).filter(id => typeof id === 'string');
  const ticked = (Array.isArray(c.canvases) ? c.canvases : []).filter(id => typeof id === 'string');
  const show = known.filter(id => ticked.includes(id));
  if(ticked.length > show.length) problems.push('A canvas chosen is no longer in the model: it is left out.');
  if(!show.length) return { value: null, problems, error: 'Choose at least one canvas to show.' };
  const title = showcaseText(c.title, SHOWCASE_LIMITS.title);
  const sc = {
    kind: SHOWCASE_KIND, version: 1,
    id: typeof c.id === 'string' && SHOWCASE_ID.test(c.id) ? c.id : showcaseIdFrom(c.id || title),
    title, description: c.description, author: c.author, licence: c.licence, mark: c.mark !== false,
    canvases: { show, start: show.includes(c.start) ? c.start : show[0] }
  };
  const count = Math.max(1, Number.isInteger(model && model.periodCount) ? model.periodCount : 1);
  if(isObject(c.periods)){
    const num = (v, dflt) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.trunc(Number(v)) : dflt;
    const from = Math.max(0, Math.min(count - 1, num(c.periods.from, 0)));
    const to = Math.max(from, Math.min(count - 1, num(c.periods.to, count - 1)));
    if(from > 0 || to < count - 1) sc.periods = { mode: 'range', from, to };
  }
  const all = isObject(graphBoards) && graphBoards.form !== 'template' && Array.isArray(graphBoards.boards) ? graphBoards.boards : [];
  const picked = [];
  let gone = false;
  (Array.isArray(c.boards) ? c.boards : []).forEach(i => {
    if(Number.isInteger(i) && i >= 0 && i < all.length){ if(!picked.includes(i)) picked.push(i); }
    else gone = true;
  });
  if(gone) problems.push('A board chosen is no longer in the model: it is left out.');
  picked.sort((a, b) => a - b);
  if(picked.length){
    sc.boards = JSON.parse(JSON.stringify(Object.assign({}, graphBoards, { active: 0, boards: picked.map(i => all[i]) })));
    const names = showcaseBoardList(graphBoards).scenarios;
    if(names.includes('Base')) problems.push('A scenario is named "Base", which Play keeps for the model\'s own numbers: it can\'t be one of Play\'s ends.');
    if(isObject(c.play)){
      const end = (v) => { const t = showcaseText(v, SHOWCASE_LIMITS.scenario); return t === 'Base' || names.includes(t) ? t : ''; };
      const from = end(c.play.from), to = end(c.play.to);
      if(from && to && from !== to) sc.play = { from, to };
      else problems.push('Play needs two different ends, Base or a scenario: left out.');
    }
  }
  const cleaned = cleanShowcase(sc);
  return { value: showcaseForFile(cleaned.value), problems: problems.concat(cleaned.problems), error: null };
}

// A cleaned showcase as a file writes it: what cleanShowcase marks as none (null) left out, so
// reading the file again finds nothing to complain about.
export function showcaseForFile(value){
  if(!isObject(value)) return value;
  const out = {};
  Object.keys(value).forEach(k => { if(value[k] !== null) out[k] = value[k]; });
  if(isObject(out.canvases)){
    const c = {};
    if(out.canvases.show !== null && out.canvases.show !== undefined) c.show = out.canvases.show;
    if(out.canvases.start !== null && out.canvases.start !== undefined) c.start = out.canvases.start;
    if(Object.keys(c).length) out.canvases = c; else delete out.canvases;
  }
  return JSON.parse(JSON.stringify(out));
}

// A viewer made for one model: the viewer's page (apps/fmViewer.html as built) with its two empty
// data blocks filled with the showcase and the model (both plain data, written as JSON). Each
// block must be in the page exactly once, else nothing is made. Every "<" in the JSON is written
// <, so no name in a model can end the block early or start markup of its own; JSON.parse
// turns it back. Nothing else of the page changes. Returns { page } or { error }.
// (This file is inside the apps' own scripts: its texts never spell the closing tag out, so
// the page's script doesn't end there, and the blocks are found only where the page has them.)
const VIEWER_BLOCK_END = '<\/script>';
export const VIEWER_BLOCKS = { showcase: '<script type="application/json" id="showcase">' + VIEWER_BLOCK_END, model: '<script type="application/json" id="model">' + VIEWER_BLOCK_END };
export function showcaseJsonForPage(value){ return JSON.stringify(value).replace(/</g, '\\u003c'); }
export function fillViewerPage(page, showcase, model){
  if(typeof page !== 'string') return { error: 'The viewer page isn\'t as expected.' };
  for(const key of Object.keys(VIEWER_BLOCKS)){
    const at = page.indexOf(VIEWER_BLOCKS[key]);
    if(at < 0 || page.indexOf(VIEWER_BLOCKS[key], at + 1) >= 0) return { error: 'The viewer page isn\'t as expected (its ' + key + ' block).' };
  }
  const fill = (text, key, value) => {
    const block = VIEWER_BLOCKS[key];
    const at = text.indexOf(block);
    const open = block.slice(0, block.length - VIEWER_BLOCK_END.length);
    return text.slice(0, at) + open + showcaseJsonForPage(value) + VIEWER_BLOCK_END + text.slice(at + block.length);
  };
  return { page: fill(fill(page, 'showcase', showcase), 'model', model) };
}
