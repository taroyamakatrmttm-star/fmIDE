// ============================================================
// window.fmGraph: fmGraph from a script (and the tests). Rectangles and canvases are named
// as in fmIDE: a rectangle by its name or '#id', a canvas by its name or id; periods count
// from 1. Periods for a widget: 'all', a number, or [from, to].
//   load(textOrObject, name?)  → Promise<boolean>   open a model (as a file would)
//   rectangles()               → [{ canvas, canvasId, id, name, input, unit }]
//   value(rect, period, canvas?)      → the number shown now, or { error }
//   modelValue(rect, period, canvas?) → the model's own number, or { error }
//   addBar(rect, periods?, canvas?)   → the bar's id
//   addSlider(rect, { periods, mode: 'set' | 'shift', min, max, step, canvas }?) → the slider's id
//   setSlider(id, value), resetSlider(id), resetAll(), remove(id)
//   board()        → the board ({ kind: 'fmIDE-graph-board', … }) with each slider's value
//   reached(id)    → the ids of the bars a slider reaches
//   calcTime()     → how long one run of the model takes, in milliseconds
// ============================================================
function findRect(rect, canvas){
  if(!model) throw new Error('No model is open.');
  const inCanvas = (r) => canvas === undefined || canvas === null || r.canvasId === String(canvas) || r.canvasName === String(canvas);
  const s = String(rect);
  const list = model.rects.filter(r => inCanvas(r) && (s.startsWith('#') ? r.nodeId === s.slice(1) : r.name.toLowerCase() === s.trim().toLowerCase()));
  if(!list.length) throw new Error('There is no rectangle "' + s.slice(0, 80) + '".');
  if(list.length > 1) throw new Error('More than one rectangle is called "' + s.slice(0, 80) + '": name its canvas too.');
  return list[0];
}
function periodSpec(spec){
  if(spec === undefined || spec === null || spec === 'all') return { mode: 'all' };
  if(Array.isArray(spec)) return { mode: 'range', from: Number(spec[0]) - 1, to: Number(spec[1]) - 1 };
  return { mode: 'one', p: Number(spec) - 1 };
}
function periodIndex(period){
  const p = Number(period) - 1;
  if(!Number.isInteger(p) || p < 0 || p >= model.periods.length) throw new Error('There is no period ' + period + '.');
  return p;
}
function sliderById(id){
  const s = board.sliders.find(x => x.id === id);
  if(!s) throw new Error('There is no slider "' + String(id).slice(0, 40) + '".');
  return s;
}
const answer = (r) => r.error ? { error: r.error } : r.value;

window.fmGraph = Object.freeze({
  load: (data, name) => openModelText(typeof data === 'string' ? data : JSON.stringify(data), name),
  rectangles: () => model ? model.rects.map(r => ({ canvas: r.canvasName, canvasId: r.canvasId, id: r.nodeId, name: r.name, input: r.input, unit: r.unit })) : [],
  value: (rect, period, canvas) => answer(resultOf(currentResults(), findRect(rect, canvas), periodIndex(period))),
  modelValue: (rect, period, canvas) => answer(resultOf(model.base, findRect(rect, canvas), periodIndex(period))),
  addBar: (rect, periods, canvas) => {
    const b = addBar(findRect(rect, canvas).key, periodSpec(periods));
    if(!b) throw new Error('No more bars can be added.');
    renderBoard();
    return b.id;
  },
  addSlider: (rect, opts) => {
    opts = opts || {};
    const r = findRect(rect, opts.canvas);
    if(!r.input) throw new Error('"' + r.name + '" is not an input rectangle: a slider changes inputs only.');
    const range = (opts.min !== undefined || opts.max !== undefined || opts.step !== undefined) ? { min: opts.min, max: opts.max, step: opts.step } : null;
    const s = addSlider(r.key, periodSpec(opts.periods), opts.mode, range);
    if(!s) throw new Error('No more sliders can be added.');
    renderBoard();
    return s.id;
  },
  setSlider: (id, value) => {
    const s = sliderById(id);
    const v = Number(value);
    if(!isFinite(v)) throw new Error('A slider\'s value must be a number.');
    s.value = v;
    renderBoard();
  },
  resetSlider: (id) => { sliderById(id).value = null; renderBoard(); },
  resetAll: () => { board.sliders.forEach(s => { s.value = null; }); renderBoard(); },
  remove: (id) => { removeWidget(id); renderBoard(); },
  board: () => {
    if(!model) return null;
    const d = boardData();
    d.bars.forEach((b, i) => { b.id = board.bars[i].id; });
    d.sliders.forEach((s, i) => { s.id = board.sliders[i].id; s.value = board.sliders[i].value; });
    return d;
  },
  reached: (id) => { const s = sliderById(id); const reach = model.reach(s.key); return board.bars.filter(b => reach.has(b.key) || b.key === s.key).map(b => b.id); },
  calcTime: () => model ? model.baseMs : null,
});
