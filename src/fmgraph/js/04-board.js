// ============================================================
// The board: the bars, charts and sliders on the page.
//   bar    { id, key, periods }
//   chart  { id, layout: 'columns' | 'flow', … } (G2; 04b-charts.js)
//   slider { id, key, periods, mode: 'set' | 'shift', min, max, step, value }
// periods: { mode: 'all' } · { mode: 'one', p } · { mode: 'range', from, to } (from 0).
// A slider's value is null until it moves (the model's own numbers); 'set' gives the input
// that number in the periods it covers, 'shift' changes them by that many percent.
//
// The board is remembered in this browser for each model (fmgraph-board-<signature>), and the
// last one used is kept too, so a model that has changed a little (a rectangle added in fmIDE)
// keeps its board. Slider positions are not remembered: a board always opens on the model's
// own numbers. What is stored is the board's file form (kind fmIDE-graph-board, version 1),
// and everything read back goes through cleanBoard, like a file. Each widget keeps its
// rectangle's name too: a widget whose rectangle now has another name is left out, so another
// model that happens to use the same ids never picks up this board.
// ============================================================
const store = createStore('fmGraph');
const BOARD_PREFIX = 'fmgraph-board-';
const LAST_BOARD_KEY = 'fmgraph-last-board';
const BOARD_LIMIT = 40; // bars, and sliders, at most
let board = { bars: [], charts: [], sliders: [] };
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

// Reads a board (from storage, or later a file) against the loaded model: widgets on
// rectangles that aren't there, or sliders on rectangles that aren't inputs, are left out.
function cleanBoard(raw){
  const out = { bars: [], charts: [], sliders: [] };
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-graph-board') return out;
  const count = model.periods.length;
  const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const rectFor = (w) => {
    if(!w || typeof w.canvasId !== 'string' || typeof w.nodeId !== 'string') return null;
    const r = model.byKey.get(keyOf(w.canvasId, w.nodeId));
    return r && (typeof w.name !== 'string' || sameName(w.name, r.name)) ? r : null;
  };
  (Array.isArray(raw.bars) ? raw.bars : []).slice(0, BOARD_LIMIT).forEach(b => {
    const rect = rectFor(b);
    if(rect) out.bars.push({ id: newWidgetId('b'), key: rect.key, periods: cleanPeriods(b.periods, count) });
  });
  (Array.isArray(raw.charts) ? raw.charts : []).slice(0, BOARD_LIMIT).forEach(c => {
    const chart = cleanChart(c, rectFor, count);
    if(chart) out.charts.push(chart);
  });
  (Array.isArray(raw.sliders) ? raw.sliders : []).slice(0, BOARD_LIMIT).forEach(s => {
    const rect = rectFor(s);
    if(!rect || !rect.input) return;
    const periods = cleanPeriods(s.periods, count);
    const mode = s.mode === 'shift' ? 'shift' : 'set';
    out.sliders.push(Object.assign({ id: newWidgetId('s'), key: rect.key, periods, mode, value: null },
      cleanRange(s, defaultRange(rect, periods, mode))));
  });
  return out;
}

// The board's file form.
function boardData(){
  const at = (key) => { const r = model.byKey.get(key); return { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name }; };
  return {
    kind: 'fmIDE-graph-board', version: 1,
    bars: board.bars.map(b => Object.assign(at(b.key), { periods: Object.assign({}, b.periods) })),
    charts: board.charts.map(c => chartData(c, at)),
    sliders: board.sliders.map(s => Object.assign(at(s.key), { periods: Object.assign({}, s.periods), mode: s.mode, min: s.min, max: s.max, step: s.step })),
  };
}

let saveTimer = null;
function saveBoardSoon(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoardNow, 300);
}
function saveBoardNow(){
  clearTimeout(saveTimer);
  if(!model) return;
  const text = JSON.stringify(boardData());
  Promise.all([store.put(BOARD_PREFIX + model.signature, text), store.put(LAST_BOARD_KEY, text)])
    .catch(() => notify('This browser could not keep the board; it will be gone after a reload.', 'err', 'storage'));
}

async function loadBoardFor(m){
  let restored = null;
  try{
    await store.ready;
    let raw = await store.get(BOARD_PREFIX + m.signature);
    let fromLast = false;
    if(typeof raw !== 'string' || !raw){ raw = await store.get(LAST_BOARD_KEY); fromLast = true; }
    if(typeof raw === 'string' && raw){
      const b = cleanBoard(JSON.parse(raw));
      if(b.bars.length || b.charts.length || b.sliders.length) restored = b;
      if(restored && fromLast) saveBoardSoon();
    }
  }catch(e){ /* unreadable: start a new board */ }
  board = restored || startingBoard();
}

// A new model's board: a slider on the first input that reaches a calculated rectangle, and
// a bar on the last rectangle it reaches, so something moves straight away.
function startingBoard(){
  const b = { bars: [], charts: [], sliders: [] };
  for(const input of model.inputs){
    const reached = model.reach(input.key);
    const targets = model.rects.filter(r => !r.input && reached.has(r.key));
    if(!targets.length) continue;
    const periods = { mode: 'all' };
    b.sliders.push(Object.assign({ id: newWidgetId('s'), key: input.key, periods, mode: 'set', value: null }, defaultRange(input, periods, 'set')));
    b.bars.push({ id: newWidgetId('b'), key: targets[targets.length - 1].key, periods: { mode: 'all' } });
    break;
  }
  return b;
}

function addBar(key, periods){
  const rect = model.byKey.get(key) || model.rects.find(r => !r.input) || model.rects[0];
  if(!rect || board.bars.length >= BOARD_LIMIT) return null;
  const bar = { id: newWidgetId('b'), key: rect.key, periods: cleanPeriods(periods, model.periods.length) };
  board.bars.push(bar);
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
  const count = () => board.bars.length + board.charts.length + board.sliders.length;
  const before = count();
  board.bars = board.bars.filter(b => b.id !== id);
  board.charts = board.charts.filter(c => c.id !== id);
  board.sliders = board.sliders.filter(s => s.id !== id);
  if(count() !== before) saveBoardSoon();
}
