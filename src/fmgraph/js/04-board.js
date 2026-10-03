// ============================================================
// The boards (G3a: several, as tabs, each a view of the model). A board:
//   { id, name, items: [bar | chart, …] (in the order shown), sliders: [slider, …] }
//   bar    { id, kind: 'bar', key, periods, wide, colour }
//   chart  { id, kind: 'chart', wide, layout: 'columns' | 'flow', … } (G2; 04b-charts.js)
//   slider { id, key, periods, mode: 'set' | 'shift', min, max, step, value }
// periods: { mode: 'all' } · { mode: 'one', p } · { mode: 'range', from, to } (from 0).
// A slider's value is null until it moves (the model's own numbers); 'set' gives the input
// that number in the periods it covers, 'shift' changes them by that many percent.
//
// A wide widget takes a whole row of the grid, a narrow one half of it (charts start wide,
// bars narrow); colour is a bar's own colour (null: the usual one).
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
const store = createStore('fmGraph');
const BOARD_PREFIX = 'fmgraph-board-';
const LAST_BOARD_KEY = 'fmgraph-last-board';
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
function cleanBoard(raw, dropped){
  const out = makeBoard(cleanText(raw && raw.name, 60) || 'Board');
  if(!raw || typeof raw !== 'object') return out;
  const count = model.periods.length;
  const drop = () => { if(dropped) dropped.n++; };
  const bar = (b) => {
    const rect = rectForEntry(b);
    if(!rect){ drop(); return null; }
    return { id: newWidgetId('b'), kind: 'bar', key: rect.key, periods: cleanPeriods(b.periods, count), wide: b.wide === true, colour: cleanColour(b.colour) };
  };
  const chart = (c) => {
    const ch = cleanChart(c, rectForEntry, count);
    // A chart that named rectangles, none of them in this model, is left out (one emptied
    // on purpose, naming none, is kept).
    const named = c && (c.layout === 'flow' ? (Array.isArray(c.steps) ? c.steps.length : 0)
      : (Array.isArray(c.groups) ? c.groups.reduce((n, gr) => n + (gr && Array.isArray(gr.parts) ? gr.parts.length : 0), 0) : 0));
    if(!ch || (named > 0 && !chartKeys(ch).length)){ drop(); return null; }
    ch.wide = c.wide !== false;
    return ch;
  };
  let items;
  if(Array.isArray(raw.items)) items = raw.items.map(w => w && w.type === 'chart' ? chart(w) : w && w.type === 'bar' ? bar(w) : (drop(), null));
  else items = (Array.isArray(raw.charts) ? raw.charts.map(chart) : []).concat(Array.isArray(raw.bars) ? raw.bars.map(bar) : []); // G1, G2
  out.items = items.filter(Boolean).slice(0, BOARD_LIMIT * 2);
  (Array.isArray(raw.sliders) ? raw.sliders : []).slice(0, BOARD_LIMIT).forEach(s => {
    const rect = rectForEntry(s);
    if(!rect || !rect.input){ drop(); return; }
    const periods = cleanPeriods(s.periods, count);
    const mode = s.mode === 'shift' ? 'shift' : 'set';
    out.sliders.push(Object.assign({ id: newWidgetId('s'), key: rect.key, periods, mode, value: null },
      cleanRange(s, defaultRange(rect, periods, mode))));
  });
  return out;
}

// Every board in a file (or in storage): { boards, active, dropped }, or null when it isn't one.
function cleanBoards(raw){
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-graph-board') return null;
  const dropped = { n: 0 };
  const list = Array.isArray(raw.boards) ? raw.boards.slice(0, BOARDS_LIMIT).map(b => cleanBoard(b, dropped)) : [cleanBoard(raw, dropped)];
  const a = Math.round(Number(raw.active));
  return { boards: list, active: Number.isFinite(a) && a >= 0 && a < list.length ? a : 0, dropped: dropped.n };
}

// A board's file form.
// The board file's version (docs/file-formats.md): 1 (G3a); 2 (G5a) adds the template form
// (`form: "template"`, 06c-template-boards.js). Boards for one model are the same in both.
const BOARD_FILE_VERSION = 2;
function boardData(b){
  const at = (key) => { const r = model.byKey.get(key); return { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name }; };
  return {
    name: b.name,
    items: b.items.map(w => w.kind === 'bar'
      ? Object.assign({ type: 'bar' }, at(w.key), { periods: Object.assign({}, w.periods), wide: w.wide }, w.colour ? { colour: w.colour } : {})
      : Object.assign({ type: 'chart', wide: w.wide }, chartData(w, at))),
    sliders: b.sliders.map(s => Object.assign(at(s.key), { periods: Object.assign({}, s.periods), mode: s.mode, min: s.min, max: s.max, step: s.step })),
  };
}
// The file form of these boards (all, or the ones given).
function boardsData(list){
  const which = list || boards;
  return { kind: 'fmIDE-graph-board', version: BOARD_FILE_VERSION, active: list ? 0 : Math.max(0, boards.indexOf(board)), boards: which.map(boardData) };
}

let saveTimer = null;
function saveBoardSoon(){
  noteChange(); // undo (04c-undo.js)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoardNow, 300);
}
function saveBoardNow(){
  clearTimeout(saveTimer);
  if(!model) return;
  const text = JSON.stringify(boardsData());
  Promise.all([store.put(BOARD_PREFIX + model.signature, text), store.put(LAST_BOARD_KEY, text)])
    .catch(() => notify('This browser could not keep the boards; they will be gone after a reload.', 'err', 'storage'));
}

// The document's own boards (G3b), when it brings any with something on them, win over the
// ones this browser keeps for the model, and are then kept here too.
function documentBoards(raw){
  try{
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if(!data || typeof data !== 'object' || fileDataProblem(data)) return null;
    const r = cleanBoards(data);
    return r && r.boards.some(b => b.items.length || b.sliders.length) ? r : null;
  }catch(e){ return null; }
}
async function loadBoardFor(m, docRaw){
  let restored = docRaw ? documentBoards(docRaw) : null;
  if(restored){
    boards = restored.boards;
    board = boards[restored.active];
    resetUndo();
    setTimeout(saveBoardNow, 0);
    return;
  }
  try{
    await store.ready;
    let raw = await store.get(BOARD_PREFIX + m.signature);
    let fromLast = false;
    if(typeof raw !== 'string' || !raw){ raw = await store.get(LAST_BOARD_KEY); fromLast = true; }
    if(typeof raw === 'string' && raw){
      const r = cleanBoards(JSON.parse(raw));
      if(r && r.boards.some(b => b.items.length || b.sliders.length)) restored = r;
      if(restored && fromLast) setTimeout(saveBoardNow, 0);
    }
  }catch(e){ /* unreadable: start a new board */ }
  // None of its own: its templates' boards (G5b, 06d-template-sources.js), else a starting board.
  const fromTemplates = restored ? [] : templateStartBoards();
  if(fromTemplates.length) setTimeout(saveBoardNow, 0);
  boards = restored ? restored.boards : fromTemplates.length ? fromTemplates : [startingBoard()];
  board = boards[restored ? restored.active : 0];
  resetUndo();
}

// A new model's board: a slider on the first input that reaches a calculated rectangle, and
// a bar on the last rectangle it reaches, so something moves straight away.
function startingBoard(){
  const b = makeBoard('Board');
  for(const input of model.inputs){
    const reached = model.reach(input.key);
    const targets = model.rects.filter(r => !r.input && reached.has(r.key));
    if(!targets.length) continue;
    const periods = { mode: 'all' };
    b.sliders.push(Object.assign({ id: newWidgetId('s'), key: input.key, periods, mode: 'set', value: null }, defaultRange(input, periods, 'set')));
    b.items.push({ id: newWidgetId('b'), kind: 'bar', key: targets[targets.length - 1].key, periods: { mode: 'all' }, wide: false, colour: null });
    break;
  }
  return b;
}

function addBar(key, periods){
  const rect = model.byKey.get(key) || model.rects.find(r => !r.input) || model.rects[0];
  if(!rect || board.bars.length >= BOARD_LIMIT) return null;
  const bar = { id: newWidgetId('b'), kind: 'bar', key: rect.key, periods: cleanPeriods(periods, model.periods.length), wide: false, colour: null };
  board.items.push(bar);
  saveBoardSoon();
  return bar;
}
function addSlider(key, periods, mode, range){
  const rect = (model.byKey.get(key) && model.byKey.get(key).input) ? model.byKey.get(key) : model.inputs[0];
  if(!rect || board.sliders.length >= BOARD_LIMIT) return null;
  const p = cleanPeriods(periods, model.periods.length);
  const m = mode === 'shift' ? 'shift' : 'set';
  const s = Object.assign({ id: newWidgetId('s'), key: rect.key, periods: p, mode: m, value: null }, cleanRange(range || {}, defaultRange(rect, p, m)));
  board.sliders.push(s);
  saveBoardSoon();
  return s;
}
function removeWidget(id){
  const before = board.items.length + board.sliders.length;
  board.items = board.items.filter(w => w.id !== id);
  board.sliders = board.sliders.filter(s => s.id !== id);
  if(board.items.length + board.sliders.length !== before) saveBoardSoon();
}
// Moves a widget (a bar or chart among the items, or a slider among the sliders) to index `to`.
function moveWidget(id, to){
  const list = board.items.some(w => w.id === id) ? board.items : board.sliders;
  const from = list.findIndex(w => w.id === id);
  if(from < 0) return false;
  const at = Math.max(0, Math.min(list.length - 1, to));
  if(at === from) return false;
  const [w] = list.splice(from, 1);
  list.splice(at, 0, w);
  saveBoardSoon();
  return true;
}
