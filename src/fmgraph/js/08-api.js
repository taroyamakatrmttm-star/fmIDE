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
//   addChart({ layout: 'columns', title, periods, check, groups: [{ name, parts: [rect…] }] })
//   addChart({ layout: 'flow', title, period, steps: [{ rect, role: 'start'|'add'|'subtract'|'total' }] })
//                  → the chart's id; a rect is a name, '#id', or { rect, canvas }
//   chart(id)      → what it shows now: columns — per period { period, groups: [{ name, total,
//                    parts: [value or { error }] }], check: { ok, gap } | null }; flow — per step
//                    { name, role, value, from, to, check: { ok, expected } | null }
//   setSlider(id, value), resetSlider(id), resetAll(), remove(id)
//   board()        → the board ({ kind: 'fmIDE-graph-board', … }) with each slider's value
//   reached(id)    → the ids of the bars a slider reaches
//   boards()       → [{ name, shown }] (G3a); addBoard(name?), showBoard(index or name),
//   renameBoard(name), duplicateBoard(), removeBoard() (the one shown; the last can't go)
//   move(id, index) (a bar or chart among the items, a slider among the sliders),
//   setWide(id, wide), setColour(id, '#rrggbb' or null, rect?) (a bar's, or a chart rectangle's)
//   undo(), redo() → whether there was one; exportBoards(all?) → the file's data (downloads it)
//   importBoards(textOrObject) → Promise<number of boards added>
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
const rectRef = (x) => (x && typeof x === 'object') ? findRect(x.rect, x.canvas) : findRect(x);
function chartById(id){
  const c = board.charts.find(x => x.id === id);
  if(!c) throw new Error('There is no chart "' + String(id).slice(0, 40) + '".');
  return c;
}

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
  addChart: (spec) => {
    spec = spec || {};
    if(board.charts.length >= BOARD_LIMIT) throw new Error('No more charts can be added.');
    const at = (r) => ({ canvasId: r.canvasId, nodeId: r.nodeId, name: r.name });
    const raw = spec.layout === 'flow'
      ? { layout: 'flow', title: spec.title, period: spec.period === undefined ? 0 : periodIndex(spec.period),
          steps: (spec.steps || []).map(s => Object.assign(at(rectRef(s.rect)), { role: s.role })) }
      : { layout: 'columns', title: spec.title, periods: periodSpec(spec.periods), check: spec.check === true,
          groups: (spec.groups || []).map(g => ({ name: g.name, parts: (g.parts || []).map(p => at(rectRef(p))) })) };
    const c = cleanChart(raw, (w) => model.byKey.get(keyOf(w.canvasId, w.nodeId)), model.periods.length);
    board.items.push(c);
    saveBoardSoon();
    renderBoard();
    return c.id;
  },
  chart: (id) => {
    const c = chartById(id), results = currentResults();
    if(c.layout === 'flow') return flowFigures(c, results).map((f, i) => Object.assign({ name: partLabel(c.steps[i].key) }, f));
    return columnsFigures(c, results).map(f => ({ period: model.periods[f.p], check: f.check,
      groups: f.groups.map((g, gi) => ({ name: groupLabel(c, gi), total: g.error ? { error: true } : g.total, parts: g.parts.map(answer) })) }));
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
    const d = boardData(board);
    d.items.forEach((w, i) => { w.id = board.items[i].id; });
    d.sliders.forEach((s, i) => { s.id = board.sliders[i].id; s.value = board.sliders[i].value; });
    return Object.assign({ kind: 'fmIDE-graph-board', version: 1 }, d,
      { bars: d.items.filter(w => w.type === 'bar'), charts: d.items.filter(w => w.type === 'chart') });
  },
  boards: () => boards.map(b => ({ name: b.name, shown: b === board })),
  addBoard: (name) => { const b = addBoard(typeof name === 'string' ? cleanText(name, 60) : ''); if(!b) throw new Error('No more boards can be added.'); return b.name; },
  showBoard: (which) => {
    const i = typeof which === 'number' ? which : boards.findIndex(b => b.name === String(which));
    if(!boards[i]) throw new Error('There is no board "' + String(which).slice(0, 60) + '".');
    showBoardAt(i);
  },
  renameBoard: (name) => { setBoardName(board, String(name)); renderAll(); return board.name; },
  duplicateBoard: () => { const b = duplicateBoard(); if(!b) throw new Error('No more boards can be added.'); return b.name; },
  removeBoard: () => { if(boards.length < 2) throw new Error('The last board can\'t be removed.'); removeBoard(board); },
  move: (id, index) => { const ok = moveWidget(id, Number(index)); renderBoard(); return ok; },
  setWide: (id, wide) => { const w = board.items.find(x => x.id === id); if(!w) throw new Error('There is no bar or chart "' + String(id).slice(0, 40) + '".'); w.wide = !!wide; saveBoardSoon(); renderBoard(); },
  setColour: (id, colour, rect) => {
    const c = colour === null ? null : cleanColour(colour);
    if(colour !== null && !c) throw new Error('A colour is written #rrggbb.');
    const w = board.items.find(x => x.id === id);
    if(!w) throw new Error('There is no bar or chart "' + String(id).slice(0, 40) + '".');
    if(w.kind === 'bar') w.colour = c;
    else {
      const k = findRect(rect).key;
      if(!chartKeys(w).includes(k)) throw new Error('That rectangle isn\'t in this chart.');
      const next = Object.assign({}, w.colours);
      if(c) next[k] = c; else delete next[k];
      w.colours = next;
    }
    saveBoardSoon();
    renderBoard();
  },
  // Exploring (G4a). trace(id): pin the trace of a bar or chart (null clears it); returns what
  // reaches it — the sliders' ways there (rectangle names) and the inputs with no slider.
  trace: (id) => {
    if(id === null || id === undefined){ setTrace(null); return null; }
    const w = board.items.find(x => x.id === id);
    if(!w) throw new Error('There is no bar or chart "' + String(id).slice(0, 40) + '".');
    setTrace(id);
    const t = traceOf(w);
    return { sliders: t.sliders.map(s => ({ id: s.id, path: s.path.slice() })), inputs: t.inputs.map(r => r.name) };
  },
  traced: () => traceId,
  // The A/B snapshot (G4b): pinA() keeps where the sliders are as A (returns its words),
  // unpinA(), swapA() (returns the new A's words), comparing() — A's words, or null.
  pinA: () => pinAsA(),
  unpinA: () => { unpinA(); },
  swapA: () => { if(!pinA) throw new Error('Nothing is pinned as A.'); return swapWithA(); },
  comparing: () => pinA ? pinA.label : null,
  // movers(n): the rectangles the sliders change most (default 8), against the model's own numbers.
  movers: (n) => biggestMovers(currentResults(), Math.max(1, Math.min(200, Number(n) || MOVERS_SHOWN))).map(m => ({
    name: m.rect.name, canvas: m.rect.canvasName, period: model.periods[m.p],
    was: m.was.error ? { error: m.was.error } : m.was.value, now: m.now.error ? { error: m.now.error } : m.now.value })),
  undo: () => undo(),
  redo: () => redo(),
  exportBoards: (all) => exportBoards(!!all),
  importBoards: (data) => importBoardsText(typeof data === 'string' ? data : JSON.stringify(data)),
  reached: (id) => {
    const s = sliderById(id), reach = model.reach(s.key), hit = (k) => reach.has(k) || k === s.key;
    return board.charts.filter(c => chartKeys(c).some(hit)).map(c => c.id).concat(board.bars.filter(b => hit(b.key)).map(b => b.id));
  },
  calcTime: () => model ? model.baseMs : null,
});
