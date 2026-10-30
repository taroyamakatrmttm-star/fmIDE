// ============================================================
// The boards (G3a: several, as tabs, each a view of the model). A board:
//   { id, name, items: [bar | chart, …] (in the order shown), sliders: [slider, …], ownSliders }
//   bar    { id, kind: 'bar', key, periods, wide, scale }
//   chart  { id, kind: 'chart', wide, layout: 'columns' | 'lines' | 'flow' | 'free' | 'scenarios' | 'tornado' | 'spider', scale, … } (G2; 04b-charts.js)
// scale: null for Auto, or { min, max } (04d-scale.js).
//   slider { id, key, periods, mode: 'set' | 'shift', min, max, step, value, folded: false | true | 'min' }
// periods: { mode: 'all' } · { mode: 'one', p } · { mode: 'range', from, to } (from 0).
// A slider's value is null until it moves (the model's own numbers); 'set' gives the input
// that number in the periods it covers, 'shift' changes them by that many percent.
//
// A wide widget takes a whole row of the grid, a narrow one half of it (charts start wide,
// bars narrow). Colours belong to rectangles, shared by every board (04e-colours.js). A folded slider shows only
// its name, track and number (board file 6; 05c-arrange.js). ownSliders: the board keeps its own
// slider positions instead of sharing them with the other boards (board file 7; 03-calc.js).
//
// The boards are remembered in this browser for each model (fmgraph-board-<signature>), and the
// last ones used are kept too, so a model that has changed a little (a rectangle added in
// fmIDE) keeps its boards. Slider positions are not remembered: a board always opens on the
// model's own numbers. What is stored is the board file's form (kind fmIDE-graph-board,
// version 1; docs/file-formats.md), and everything read back goes through cleanBoards, like a
// file — the same reader Import Board uses. Each widget keeps its rectangle's name too: a
// widget whose rectangle now has another name is left out, so another model that happens to
// use the same ids never picks up these boards. The form G1 and G2 kept in the browser (one
// board: bars, charts, sliders) is read as one board.
// ============================================================
const BOARD_LIMIT = 40; // bars, charts and sliders on a board, each at most
const BOARDS_LIMIT = 20; // boards for a model
let boards = [];         // every board of the model
let board = null;        // the one shown
let nextWidgetId = 1;
const newWidgetId = (kind) => kind + (nextWidgetId++);

function periodsOf(spec){
  const n = model ? model.periods.length : 0;
  if(!spec || spec.mode === 'all') return Array.from({ length: n }, (_, i) => i);
  if(spec.mode === 'one') return [Math.min(n - 1, Math.max(0, spec.p))];
  const a = Math.min(spec.from, spec.to), b = Math.max(spec.from, spec.to);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(p => p >= 0 && p < n);
}

function cleanPeriods(raw, count){
  const idx = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < count ? n : null; };
  if(raw && raw.mode === 'one' && idx(raw.p) !== null) return { mode: 'one', p: idx(raw.p) };
  if(raw && raw.mode === 'range' && idx(raw.from) !== null && idx(raw.to) !== null) return { mode: 'range', from: idx(raw.from), to: idx(raw.to) };
  return { mode: 'all' };
}

// A slider's range for an input, from the model's number in the first period it covers:
// 20 steps either side of it, so the model's own number is a step.
function defaultRange(rect, periods, mode){
  if(mode === 'shift') return { min: -50, max: 50, step: 1 };
  const v = baseValue(rect, periodsOf(periods)[0] || 0);
  const span = Math.abs(v) > 0 ? Math.abs(v) * 0.5 : 10;
  const step = niceStep(span / 20);
  const centre = Math.round(v / step) * step;
  return { min: roundToStep(centre - 20 * step, step), max: roundToStep(centre + 20 * step, step), step };
}
function niceStep(x){
  if(!(x > 0) || !isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return roundToStep((f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p, p / 10);
}
function cleanRange(raw, fallback){
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const min = n(raw.min), max = n(raw.max), step = n(raw.step);
  if(min === null || max === null || step === null || !(max > min) || !(step > 0) || (max - min) / step > 100000) return fallback;
  return { min, max, step };
}

// A new, empty board. bars and charts are read through its items, in their order.
function makeBoard(name){
  return { id: newWidgetId('board'), name: name || 'Board', items: [], sliders: [],
    get bars(){ return this.items.filter(w => w.kind === 'bar'); },
    get charts(){ return this.items.filter(w => w.kind === 'chart'); } };
}
const cleanColour = (c) => safeColor(c, null) && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null;

// The rectangle a widget names, by canvas id, node id and (when it gives one) name.
function rectForEntry(w){
  if(!w || typeof w.canvasId !== 'string' || typeof w.nodeId !== 'string') return null;
  const r = model.byKey.get(keyOf(w.canvasId, w.nodeId));
  return r && (typeof w.name !== 'string' || w.name.trim().toLowerCase() === r.name.trim().toLowerCase()) ? r : null;
}

// One board read against the loaded model: widgets on rectangles that aren't there, or
// sliders on rectangles that aren't inputs, are left out (and counted in `dropped`).
// `version`: the file's; before 9 every bar and chart keeps the periods it had (ownPeriod).
// `sharedColours`: the file has the shared colours (version 11), so the colours its widgets
// carry (what each showed) are not read; without, they stay on the widgets to be taken in
// (adoptWidgetColours, 04e-colours.js).
function cleanBoard(raw, dropped, version, sharedColours){
  const out = makeBoard(cleanText(raw && raw.name, 60) || 'Board');
  if(!raw || typeof raw !== 'object') return out;
  const count = model.periods.length;
  const drop = () => { if(dropped) dropped.n++; };
  // Version 9: a bar or chart follows the shared period unless it keeps its own
  // (`ownPeriod`, 05k-shared-period.js); before it, every one keeps the periods it had.
  const own = (w) => !(Number(version) >= 9) || w.ownPeriod === true;
  const bar = (b) => {
    const rect = rectForEntry(b);
    if(!rect){ drop(); return null; }
    return { id: newWidgetId('b'), kind: 'bar', key: rect.key, periods: cleanPeriods(b.periods, count), wide: b.wide === true, colour: cleanColour(b.colour), scale: cleanScale(b.scale), ownPeriod: own(b), ownScale: b.ownScale === true };
  };
  const chart = (c) => {
    // A Tornado or Spider whose output isn't in this model is left out (version 8).
    if(isSensitivity(c) && c.output && !rectForEntry(c.output)){ drop(); return null; }
    const ch = cleanChart(c, rectForEntry, count, drop);
    // A chart that named rectangles, none of them in this model, is left out (one emptied
    // on purpose, naming none, is kept).
    const named = c && (isSensitivity(c) ? (c.output ? 1 : 0) + (Array.isArray(c.inputs) ? c.inputs.length : 0) : c.layout === 'flow' ? (Array.isArray(c.steps) ? c.steps.length : 0)
      : c.layout === 'scenarios' ? (Array.isArray(c.outputs) ? c.outputs.length : 0)
      : c.layout === 'lines' ? (Array.isArray(c.lines) ? c.lines.length : 0)
      : c.layout === 'free' ? (Array.isArray(c.pieces) ? c.pieces.reduce((n, pc) => n + (pc && Array.isArray(pc.parts) ? pc.parts.length : 0), 0) : 0)
      : (Array.isArray(c.groups) ? c.groups.reduce((n, gr) => n + (gr && Array.isArray(gr.parts) ? gr.parts.length : 0), 0) : 0));
    if(!ch || (named > 0 && !chartKeys(ch).length)){ drop(); return null; }
    ch.wide = c.wide !== false;
    ch.scale = cleanScale(c.scale); // version 5 (04d-scale.js)
    ch.ownPeriod = own(c);
    ch.ownScale = c.ownScale === true; // version 12 (04d-scale.js)
    return ch;
  };
  let items;
  if(Array.isArray(raw.items)) items = raw.items.map(w => w && w.type === 'chart' ? chart(w) : w && w.type === 'bar' ? bar(w) : (drop(), null));
  else items = (Array.isArray(raw.charts) ? raw.charts.map(chart) : []).concat(Array.isArray(raw.bars) ? raw.bars.map(bar) : []); // G1, G2
  out.items = items.filter(Boolean).slice(0, BOARD_LIMIT * 2);
  if(sharedColours) out.items.forEach(w => { if(w.kind === 'bar') w.colour = null; else w.colours = {}; });
  out.ownSliders = raw.ownSliders === true; // version 7
  (Array.isArray(raw.sliders) ? raw.sliders : []).slice(0, BOARD_LIMIT).forEach(s => {
    const rect = rectForEntry(s);
    if(!rect || !rect.input){ drop(); return; }
    const periods = cleanPeriods(s.periods, count);
    const mode = s.mode === 'shift' ? 'shift' : 'set';
    out.sliders.push(Object.assign({ id: newWidgetId('s'), key: rect.key, periods, mode, value: null },
      cleanRange(s, defaultRange(rect, periods, mode)), { folded: s.folded === 'min' ? 'min' : s.folded === true })); // version 6; 'min' version 14
  });
  return out;
}

// Every board in a file (or in storage): { boards, active, dropped }, or null when it isn't one.
function cleanBoards(raw){
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-graph-board') return null;
  const dropped = { n: 0 };
  const shared = Array.isArray(raw.colours); // version 11 (04e-colours.js)
  const list = Array.isArray(raw.boards) ? raw.boards.slice(0, BOARDS_LIMIT).map(b => cleanBoard(b, dropped, raw.version, shared)) : [cleanBoard(raw, dropped, raw.version, shared)];
  const a = Math.round(Number(raw.active));
  return { boards: list, active: Number.isFinite(a) && a >= 0 && a < list.length ? a : 0, dropped: dropped.n,
    scenarios: cleanScenarios(raw.scenarios, rectForEntry), // version 3 (05f-scenarios.js)
    sharedPeriods: cleanSharedPeriods(raw.sharedPeriods, model.periods.length), // version 9 (05k-shared-period.js)
    colours: shared ? cleanRectColours(raw.colours) : new Map(), // version 11 (04e-colours.js)
    commonScale: cleanCommonScale(raw.commonScale) }; // version 12 (04d-scale.js)
}

// A board's file form.
// The board file's version (docs/file-formats.md): 1 (G3a); 2 (G5a) adds the template form
// (`form: "template"`, 06c-template-boards.js); 3 adds the model's named scenarios
// (`scenarios`, 05f-scenarios.js); 4 the scenario waterfall (a chart of layout `scenarios`,
// 04b-charts.js); 5 a bar's or chart's fixed vertical scale (`scale`, 04d-scale.js); 6 a
// folded slider (`folded`, 05c-arrange.js); 7 a board keeping its own slider positions
// (`ownSliders`, 03-calc.js); 8 the Tornado and the Spider (charts of layout `tornado` and
// `spider`, 04b-charts.js); 9 the shared period (`sharedPeriods`, and a bar's or chart's
// `ownPeriod`, 05k-shared-period.js; each still writes the periods it shows); 10 the lines chart
// (a chart of layout `lines`, 04b-charts.js); 11 the shared colours (`colours`, each
// rectangle's chosen colour, 04e-colours.js; each bar, part, step and line still writes the
// colour it shows); 12 the common scale (`commonScale`, and a bar's or chart's `ownScale`,
// 04d-scale.js; each still writes the scale it shows); 13 the Free chart (a chart of layout
// `free`, 04f-free.js); 14 a slider at its minimum (`folded: "min"`, 05c-arrange.js). The template form, which carries none
// of these, stays version 2 (its widgets carry the chosen colours, as before 11).
const BOARD_FILE_VERSION = 14;
const TEMPLATE_BOARD_VERSION = 2;
// shown: what the board's followers of the common scale show (shownCommonScale, 04d-scale.js),
// written as their scale; left out, each writes its own.
function boardData(b, shown){
  const at = (key) => { const r = model.byKey.get(key); return { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name }; };
  const scaleOf = (w) => {
    const s = shown !== undefined && followsCommonScale(w) ? shown : w.scale;
    return Object.assign(s ? { scale: { min: s.min, max: s.max } } : {}, w.ownScale && canFollowScale(w) ? { ownScale: true } : {});
  };
  return Object.assign({
    name: b.name,
    items: b.items.map(w => Object.assign(w.kind === 'bar'
      ? Object.assign({ type: 'bar' }, at(w.key), { periods: Object.assign({}, w.periods), wide: w.wide }, rectColour(w.key) ? { colour: rectColour(w.key) } : {}, scaleOf(w))
      : Object.assign({ type: 'chart', wide: w.wide }, chartData(w, at), scaleOf(w)), w.ownPeriod ? { ownPeriod: true } : {})),
    sliders: b.sliders.map(s => Object.assign(at(s.key), { periods: Object.assign({}, s.periods), mode: s.mode, min: s.min, max: s.max, step: s.step }, s.folded ? { folded: s.folded === 'min' ? 'min' : true } : {})),
  }, b.ownSliders ? { ownSliders: true } : {});
}
// The file form of these boards (all, or the ones given). forUndo: Auto for all's followers
// keep Auto, so a slider moved isn't a change.
function boardsData(list, forUndo){
  const which = list || boards;
  syncSharedPeriods(); // each writes the periods it shows (05k-shared-period.js)
  syncCommonScale(); // and the scale (04d-scale.js)
  adoptWidgetColours(); // an older file's colours, taken in first (04e-colours.js)
  const out = { kind: 'fmIDE-graph-board', version: BOARD_FILE_VERSION, active: list ? 0 : Math.max(0, boards.indexOf(board)), boards: which.map(b => boardData(b, forUndo || commonScale.mode !== 'auto' ? undefined : shownCommonScale(b))) };
  if(!list && scenarios.length) out.scenarios = scenariosData(); // the model's, with all its boards
  out.sharedPeriods = { periods: Object.assign({}, sharedPeriods.periods), period: sharedPeriods.period };
  out.colours = rectColoursData(); // version 11 (04e-colours.js)
  out.commonScale = commonScaleData(); // version 12 (04d-scale.js)
  return out;
}
