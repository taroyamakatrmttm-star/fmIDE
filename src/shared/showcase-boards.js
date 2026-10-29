// ---------- boards for showcase viewers: placed by name, or chosen for the author (shared: src/shared/showcase-boards.js) ----------
// Phase V5 of docs/viewer-brief.md. Two things the batch tool (tools/viewer-batch.js), fmIDE's
// Make Showcase Viewer… (Choose for me) and fmGraph's boards from templates (06d) share:
//
// - Placing the board file's template form (rectangles by name, docs/file-formats.md) in one
//   model: `sbTemplatePlaces` says where a reference lands — for a system template, the canvas
//   by its name and the rectangle by its name there; for a canvas template, each canvas made from
//   that template (by its family) and the rectangle by its name on it. A name used twice can't be
//   told apart, so what it names is not found. `sbPlaceTemplateBoard` maps one board's widgets
//   through it; `placeRecipeBoards` places a recipe's whole board file and lists what wasn't found.
// - Choosing for the author (`auto`, the recipe's and fmIDE's "Choose for me"):
//   `autoShowcaseBoards` puts a slider on each input that reaches a calculated rectangle and a bar
//   on each result (a calculated rectangle nothing reads), at most 12 of each.
//
// Everything read from a file: names compared as text only (trimmed, capitals ignored), numbers
// forced, nothing run. The boards written are ordinary fmIDE-graph-board files, read again by
// the viewer's and ExcelExporter's own checks.
import { compileModel, evaluateModel, parseRectText, irBlockPorts } from './ir.js';

// Widgets the template form never carries (board files 8, 10 and 13): left out when placing.
export const SB_LEFT_OUT_LAYOUTS = ['tornado', 'spider', 'lines', 'free'];
// At most this many sliders and bars chosen for the author.
export const SB_AUTO_LIMIT = 12;
// The board file version the boards here are written in: 9, the shared period, with no bar or
// chart keeping its own (no `ownPeriod`), so a showcase's `periods` — the boards' shared periods
// in the viewer — say what every bar shows (written as 8, every bar kept its own periods and the
// recipe's periods showed nowhere). Each still names the periods it shows, for older readers.
export const SB_BOARD_VERSION = 9;

const sbLower = (s) => String(s).trim().toLowerCase();
const sbIsObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// A Map from key to the one item with it (null when two share it).
function sbUnique(list, key){
  const m = new Map();
  list.forEach(x => { const k = key(x); m.set(k, m.has(k) ? null : x); });
  return m;
}

// Where a template's references land in a model. kind: 'module' (a canvas template, by
// `family`) or 'system'; rects: [{ canvasId, nodeId, name, canvasName }] (every value
// rectangle); canvasTemplates: Map canvasId → { family } (the canvas template each canvas was
// made from). opts.anyCanvas: a system template's reference without a canvas name is found by
// its name alone when that is unique in the whole model (a recipe's; fmGraph's own template
// form always names the canvas).
// Returns [{ id (the canvas, null for a system template), label (its name), find(ref) →
// { canvasId, nodeId, name } | null }] — one per canvas made from a canvas template, one for a
// system template.
export function sbTemplatePlaces(kind, family, rects, canvasTemplates, opts){
  const rectsOn = (canvasId) => rects.filter(r => r.canvasId === canvasId);
  const hit = (r) => r ? { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name } : null;
  if(kind === 'module'){
    const ids = [...canvasTemplates.entries()].filter(([, ct]) => ct && ct.family === family).map(([id]) => id);
    return ids.map(id => {
      const names = sbUnique(rectsOn(id), r => sbLower(r.name));
      return { id, label: (rects.find(r => r.canvasId === id) || { canvasName: id }).canvasName,
        find: (ref) => hit(ref && typeof ref.name === 'string' ? names.get(sbLower(ref.name)) : null) };
    });
  }
  const canvases = sbUnique([...new Set(rects.map(r => r.canvasId))].map(id => ({ id, name: rects.find(r => r.canvasId === id).canvasName })), c => sbLower(c.name));
  const names = new Map();
  const anyName = opts && opts.anyCanvas ? sbUnique(rects, r => sbLower(r.name)) : null;
  return [{ id: null, label: null, find: (ref) => {
    if(!ref || typeof ref.name !== 'string') return null;
    if(typeof ref.canvas !== 'string') return anyName ? hit(anyName.get(sbLower(ref.name))) : null;
    const c = canvases.get(sbLower(ref.canvas));
    if(!c) return null;
    if(!names.has(c.id)) names.set(c.id, sbUnique(rectsOn(c.id), r => sbLower(r.name)));
    return hit(names.get(c.id).get(sbLower(ref.name)));
  } }];
}

// One template-form board's widgets with each reference passed through at(ref) (which returns
// the widget's reference with the model's ids written in). The layouts the template form never
// carries are left out (null).
export function sbPlaceTemplateBoard(b, at){
  return {
    items: (Array.isArray(b && b.items) ? b.items : []).map(w => {
      if(!w || typeof w !== 'object') return w;
      if(w.type === 'bar') return at(w);
      if(SB_LEFT_OUT_LAYOUTS.includes(w.layout)) return null;
      if(w.layout === 'flow') return Object.assign({}, w, { steps: (Array.isArray(w.steps) ? w.steps : []).map(at) });
      return Object.assign({}, w, { groups: (Array.isArray(w.groups) ? w.groups : []).map(g => Object.assign({}, g, { parts: (g && Array.isArray(g.parts) ? g.parts : []).map(at) })) });
    }),
    sliders: (Array.isArray(b && b.sliders) ? b.sliders : []).map(at),
  };
}

// The rectangles of a system file, as the placing above wants them (the shared IR's own copy of
// each canvas, so a canvas listed twice counts once): { rects, canvasTemplates, ir }.
export function sbModelRects(system){
  const periods = Array.isArray(system && system.periods) && system.periods.length ? system.periods : ['Period 1'];
  const ir = compileModel({ periods, canvases: Array.isArray(system && system.canvases) ? system.canvases : [], functions: system && system.functions });
  const rects = [], seenCanvas = new Set();
  ir.order.forEach((c, ci) => {
    if(seenCanvas.has(c.id)) return;
    seenCanvas.add(c.id);
    const seen = new Set();
    c.list.forEach(n => {
      if(n.type !== 'value' || seen.has(n.id)) return;
      seen.add(n.id);
      const name = String(parseRectText(n.node && n.node.text).name || '').trim();
      rects.push({ canvasId: String(c.id), nodeId: String(n.id), name: (name || '#' + n.id).slice(0, 120), canvasName: String(c.name || 'Canvas').slice(0, 80),
        canvasIndex: ci, input: !!(n.isInput || n.incoming.length === 0), x: Number(n.x) || 0, y: Number(n.y) || 0 });
    });
  });
  const canvasTemplates = new Map();
  (Array.isArray(system && system.canvases) ? system.canvases : []).forEach(c => {
    const t = c && c.template;
    if(!c || typeof c.id !== 'string' || !sbIsObject(t) || typeof t.family !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(t.family)) return;
    if(!canvasTemplates.has(c.id)) canvasTemplates.set(c.id, { family: t.family });
  });
  return { rects, canvasTemplates, ir };
}

// A recipe's boards (the board file's template form) placed in one model (a system file).
// Every widget whose rectangle isn't found is left out, a chart with nothing left too.
// docBoards: the model's own fmGraph board file, whose scenarios (by the model's own ids) come
// along, so Play and the scenario buttons work. Returns { file (an fmIDE-graph-board, or null
// when nothing was placed), total, found, missing: [{ name, canvas }], places }.
export function placeRecipeBoards(templateFile, system, docBoards){
  const { rects, canvasTemplates } = sbModelRects(system);
  const t = sbIsObject(templateFile && templateFile.template) ? templateFile.template : {};
  const kind = t.kind === 'module' ? 'module' : 'system';
  const places = sbTemplatePlaces(kind, t.family, rects, canvasTemplates, { anyCanvas: kind === 'system' });
  const missing = [];
  let total = 0, found = 0;
  const boards = [];
  const refText = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  places.forEach(place => {
    const at = (ref) => {
      total++;
      const where = place.find(ref);
      if(where){ found++; return Object.assign({}, sbIsObject(ref) ? ref : {}, where); }
      const name = refText(ref && ref.name, 120) || '(no name)';
      const canvas = refText(ref && ref.canvas, 80) || place.label || '';
      if(!missing.some(m => m.name === name && m.canvas === canvas)) missing.push({ name, canvas });
      return null;
    };
    (Array.isArray(templateFile && templateFile.boards) ? templateFile.boards : []).slice(0, 20).filter(sbIsObject).forEach(b => {
      const placed = sbPlaceTemplateBoard(b, at);
      const items = placed.items.filter(Boolean).map(w => {
        if(w.type === 'bar') return w;
        if(w.layout === 'flow'){ const steps = w.steps.filter(Boolean); return steps.length ? Object.assign({}, w, { steps }) : null; }
        const groups = w.groups.map(g => Object.assign({}, g, { parts: g.parts.filter(Boolean) })).filter(g => g.parts.length);
        return groups.length ? Object.assign({}, w, { groups }) : null;
      }).filter(Boolean);
      const sliders = placed.sliders.filter(Boolean);
      if(!items.length && !sliders.length) return;
      const name = (typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : 'Board') + (places.length > 1 && place.label ? ' — ' + place.label : '');
      boards.push({ name: name.slice(0, 60), items, sliders });
    });
  });
  if(kind === 'module' && !places.length) missing.push({ name: '(every rectangle)', canvas: 'no canvas made from the recipe\'s canvas template' });
  let file = null;
  if(boards.length){
    file = { kind: 'fmIDE-graph-board', version: SB_BOARD_VERSION, active: 0, boards };
    if(sbIsObject(docBoards) && docBoards.form !== 'template' && Array.isArray(docBoards.scenarios) && docBoards.scenarios.length){
      file.scenarios = JSON.parse(JSON.stringify(docBoards.scenarios));
    }
  }
  return { file, total, found, missing, places: places.length };
}

// A slider's step: 1, 2 or 5 times a power of ten, the nearest at or above x.
function sbNiceStep(x){
  if(!(x > 0) || !isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return sbRound((f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p);
}
const sbRound = (v) => Number(Number(v).toPrecision(12));

// Choosing for the author (`auto`): one board, "Chosen for me", for a model (a system file).
// opts: { sliders: 'inputs' | null, bars: 'outputs' | null, range (1–100, %), periods:
// { from, to } | null }. Sliders: every input rectangle (the shared input rule, as the IR marks
// it) that reaches a calculated rectangle, outside the canvases used as blocks, in canvas order,
// top to bottom, then left to right, at most 12 — a "set" slider from its number − range % to +
// range % in about 100 steps (its own number a step; −10 to 10 for 0) when it has one number
// in every period shown, else a "shift" slider from −range % to +range % (so its periods keep
// their shape). Bars: every calculated rectangle nothing reads but a period shift (the model's
// results), worked out in every period shown, in the same order, at most 12; when every rectangle is read (a closing balance read by the next
// period's opening), the last one the first slider reaches.
// Returns { file (an fmIDE-graph-board, or null when there is nothing to show), sliders: [{ name,
// canvas, mode, min, max, step }], bars: [{ name, canvas }], notes: [words] }.
export function autoShowcaseBoards(system, opts){
  const o = sbIsObject(opts) ? opts : {};
  const range = Number.isFinite(Number(o.range)) && Number(o.range) >= 1 && Number(o.range) <= 100 ? Number(o.range) : 50;
  const { rects, ir } = sbModelRects(system);
  const notes = [];
  const key = (c, n) => c + '\u0000' + n;
  // What each node reads into: forward links, as fmGraph's reach follows them.
  const next = new Map();
  const link = (from, to) => { if(!next.has(from)) next.set(from, new Set()); next.get(from).add(to); };
  const blockCanvases = new Set(), typeOf = new Map();
  ir.order.forEach(c => c.list.forEach(n => {
    const me = key(c.id, n.id);
    typeOf.set(me, n.type);
    (n.incoming || []).forEach(e => link(key(c.id, e.from), me));
    if(n.type === 'alias' && n.sourceCanvasId && n.sourceNodeId) link(key(n.sourceCanvasId, n.sourceNodeId), me);
    if(n.type === 'blockInstance'){
      blockCanvases.add(n.blockDefCanvasId);
      irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach(out => link(key(n.blockDefCanvasId, out.id), me));
    }
  }));
  const reach = (k) => {
    const seen = new Set(), todo = [k];
    while(todo.length){ const outs = next.get(todo.pop()); if(outs) outs.forEach(x => { if(!seen.has(x)){ seen.add(x); todo.push(x); } }); }
    return seen;
  };
  const byKey = new Map(rects.map(r => [key(r.canvasId, r.nodeId), r]));
  const ordered = rects.filter(r => !blockCanvases.has(r.canvasId)).sort((a, b) => (a.canvasIndex - b.canvasIndex) || (a.y - b.y) || (a.x - b.x));
  const periodCount = Math.max(1, ir.periodCount || 1);
  const from = o.periods && Number.isInteger(o.periods.from) ? Math.max(0, Math.min(periodCount - 1, o.periods.from)) : 0;
  const to = o.periods && Number.isInteger(o.periods.to) ? Math.max(from, Math.min(periodCount - 1, o.periods.to)) : periodCount - 1;
  let results = null;
  try{ results = evaluateModel(ir); }catch(e){ notes.push('The model could not be worked out, so no slider was chosen.'); }
  const valueOf = (r, p) => {
    const res = results && results[r.canvasIndex];
    const v = res && res.values[p] ? res.values[p][r.nodeId] : undefined;
    return typeof v === 'number' && isFinite(v) ? v : null;
  };
  const sliders = [], bars = [];
  if(o.sliders === 'inputs' && results){
    for(const r of ordered){
      if(sliders.length >= SB_AUTO_LIMIT) break;
      if(!r.input) continue;
      const reached = reach(key(r.canvasId, r.nodeId));
      if(![...reached].some(k => byKey.has(k) && !byKey.get(k).input)) continue;
      const values = [];
      for(let p = from; p <= to; p++) values.push(valueOf(r, p));
      if(values.some(v => v === null)) continue;
      const same = values.every(v => Math.abs(v - values[0]) <= 1e-12 * Math.max(1, Math.abs(values[0])));
      let s;
      if(!same){
        s = { mode: 'shift', min: -range, max: range, step: sbNiceStep(range / 50) };
      } else if(values[0] === 0){
        s = { mode: 'set', min: -10, max: 10, step: 0.2 };
      } else {
        const v = values[0], span = Math.abs(v) * range / 100;
        const step = sbNiceStep(2 * span / 100);
        const k = Math.max(1, Math.round(span / step));
        s = { mode: 'set', min: sbRound(v - k * step), max: sbRound(v + k * step), step };
      }
      sliders.push(Object.assign({ rect: r }, s));
    }
    if(sliders.length >= SB_AUTO_LIMIT && ordered.filter(r => r.input).length > SB_AUTO_LIMIT) notes.push('Only the first ' + SB_AUTO_LIMIT + ' inputs got a slider.');
  }
  if(o.bars === 'outputs'){
    // Read by nothing but a period shift (a closing balance read by the next period's opening
    // still counts), and worked out in every period shown (a bar on an error teaches nothing).
    const readers = (r) => [...(next.get(key(r.canvasId, r.nodeId)) || [])].filter(k => typeOf.get(k) !== 'periodShift');
    const works = (r) => { for(let p = from; p <= to; p++) if(valueOf(r, p) === null) return false; return true; };
    const outputs = ordered.filter(r => !r.input && !readers(r).length && works(r));
    outputs.slice(0, SB_AUTO_LIMIT).forEach(r => bars.push({ rect: r }));
    if(outputs.length > SB_AUTO_LIMIT) notes.push('Only the first ' + SB_AUTO_LIMIT + ' results got a bar.');
    if(!bars.length && sliders.length){
      const reached = reach(key(sliders[0].rect.canvasId, sliders[0].rect.nodeId));
      const targets = ordered.filter(r => !r.input && reached.has(key(r.canvasId, r.nodeId)));
      if(targets.length){ bars.push({ rect: targets[targets.length - 1] }); notes.push('Every rectangle is read by another, so the bar is the last one the first slider reaches.'); }
    }
  }
  const ref = (r) => ({ canvasId: r.canvasId, nodeId: r.nodeId, name: r.name });
  const all = { mode: 'all' };
  const board = { name: 'Chosen for me',
    items: bars.map(b => Object.assign({ type: 'bar' }, ref(b.rect), { periods: Object.assign({}, all), wide: false })),
    sliders: sliders.map(s => Object.assign(ref(s.rect), { periods: Object.assign({}, all), mode: s.mode, min: s.min, max: s.max, step: s.step })) };
  return {
    file: board.items.length || board.sliders.length ? { kind: 'fmIDE-graph-board', version: SB_BOARD_VERSION, active: 0, boards: [board] } : null,
    sliders: sliders.map(s => ({ name: s.rect.name, canvas: s.rect.canvasName, mode: s.mode, min: s.min, max: s.max, step: s.step })),
    bars: bars.map(b => ({ name: b.rect.name, canvas: b.rect.canvasName })),
    notes,
  };
}
