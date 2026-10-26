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
//   addChart({ layout: 'lines', title, periods, lines: [rect…] })  (at most 12 lines)
//   addChart({ layout: 'flow', title, period, steps: [{ rect, role: 'start'|'add'|'subtract'|'total' }] })
//   addChart({ layout: 'scenarios', title, period, outputs: [rect…], scenarios?: [name…] })
//   addChart({ layout: 'tornado' | 'spider', title, output: rect, period, steps (1–10, the Spider's
//              points each side), inputs: [{ rect, by: 'percent' | 'amount', low, high, show }] })
//                  (step 18) output: the first calculated rectangle when left out; inputs: every
//                  input that reaches it when left out
//                  → the chart's id; a rect is a name, '#id', or { rect, canvas }
//   chart(id)      → what it shows now: columns — per period { period, groups: [{ name, total,
//                    parts: [value or { error }] }], check: { ok, gap } | null }; lines — per period
//                    { period, lines: [{ name, value or { error } }] }; flow — per step
//                    { name, role, value, from, to, check: { ok, expected } | null }; scenarios — per
//                    output { name, steps: [{ name, kind: 'start'|'step'|'end', value, from, to }] };
//                    tornado / spider — { output, period, base, inputs: [{ name, by, low, high, show,
//                    lowValue, highValue, swing } or { …, error }] } around where the sliders stand
//                    (the Tornado's sorted by swing), a Spider's inputs also with points: [{ at
//                    (−1 … 1, the share of Low or High), change, value or error }]
//   setSlider(id, value), resetSlider(id), resetAll(), remove(id)
//   board()        → the board ({ kind: 'fmIDE-graph-board', … }) with each slider's value
//   reached(id)    → the ids of the bars a slider reaches
//   boards()       → [{ name, shown }] (G3a); addBoard(name?), showBoard(index or name),
//   renameBoard(name), duplicateBoard(), removeBoard() (the one shown; the last can't go)
//   move(id, index) (a bar or chart among the items, a slider among the sliders),
//   setWide(id, wide), setColour(id, '#rrggbb' or null, rect?) (a bar's, a slider's, or a chart
//                  rectangle's: the rectangle's colour on every board; null back to the automatic one)
//   rectColour(rect, canvas?) → { colour ('#rrggbb', or null for the usual look), chosen }
//   colours()      → the chosen colours, [{ canvas, name, colour }] (board file 11)
//   setScale(id, { min, max } | 'current' | null) → the bar's or chart's vertical scale: fixed,
//                  fixed at what Auto shows now, or Auto (null); returns { min, max } or null
//   scale(id)      → its fixed scale { min, max }, or null (Auto)
//   undo(), redo() → whether there was one; exportBoards(all?) → the file's data (downloads it)
//   importBoards(textOrObject) → Promise<number of boards added>
//   calcTime()     → how long one run of the model takes, in milliseconds
//   goalSeek({ rect, canvas?, period, target, slider }) → the slider (its id, or its rectangle's
//                  name) put where rect equals target in period, as Seek in the Goal seek panel:
//                  { reached: true, value, range? (when widened: { min, max }), message } or
//                  { reached: false, low, high, stopped?, jump?, error?, message }
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
// A slider a goal seek can change: its id, or its rectangle's name.
function goalSliderRef(which){
  const list = goalSeekSliders();
  const byId = list.find(s => s.id === which);
  if(byId) return byId;
  const name = String(which === undefined || which === null ? '' : which).trim().toLowerCase();
  const named = list.filter(s => model.byKey.get(s.key).name.toLowerCase() === name);
  if(named.length === 1) return named[0];
  if(named.length > 1) throw new Error('More than one slider changes "' + String(which).slice(0, 80) + '": give its id.');
  throw new Error('There is no slider "' + String(which).slice(0, 80) + '" on this board.');
}
function chartById(id){
  const c = board.charts.find(x => x.id === id);
  if(!c) throw new Error('There is no chart "' + String(id).slice(0, 40) + '".');
  return c;
}

// A Tornado or Spider from addChart, in the file's form (step 18).
function sensitivitySpec(spec, at){
  const out = spec.output !== undefined ? rectRef(spec.output) : null;
  const inputs = Array.isArray(spec.inputs)
    ? spec.inputs.map(i => {
      const r = rectRef(i);
      if(!r.input) throw new Error('"' + r.name + '" is not an input rectangle: a Tornado or Spider moves inputs only.');
      return Object.assign(at(r), i && typeof i === 'object' ? { by: i.by, low: i.low, high: i.high, show: i.show } : {});
    })
    : null;
  if(inputs && inputs.length > SENSITIVITY_LIMITS.inputs) throw new Error('A Tornado or Spider moves at most ' + SENSITIVITY_LIMITS.inputs + ' inputs.');
  const start = sensitivityStart(out ? out.key : null);
  const startOut = start.output && model.byKey.get(start.output);
  return { layout: spec.layout, title: spec.title, period: spec.period === undefined ? 0 : periodIndex(spec.period), steps: spec.steps,
    output: out ? at(out) : startOut ? at(startOut) : null,
    inputs: inputs || start.inputs.map(i => Object.assign(at(model.byKey.get(i.key)), { by: i.by, low: i.low, high: i.high })) };
}

window.fmGraph = Object.freeze({
  load: (data, name) => openModelText(typeof data === 'string' ? data : JSON.stringify(data), name),
  rectangles: () => model ? model.rects.map(r => ({ canvas: r.canvasName, canvasId: r.canvasId, id: r.nodeId, name: r.name, input: r.input, unit: r.unit })) : [],
  value: (rect, period, canvas) => answer(resultOf(currentResults(), findRect(rect, canvas), periodIndex(period))),
  modelValue: (rect, period, canvas) => answer(resultOf(model.base, findRect(rect, canvas), periodIndex(period))),
  addBar: (rect, periods, canvas) => {
    // Periods given: its own; none: it follows the shared periods (05k-shared-period.js).
    const b = addBar(findRect(rect, canvas).key, periods === undefined ? undefined : periodSpec(periods));
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
    if(spec.layout === 'lines' && Array.isArray(spec.lines) && spec.lines.length > CHART_LIMITS.lines) throw new Error('A lines chart draws at most ' + CHART_LIMITS.lines + ' lines.');
    const raw = SENSITIVITY_LAYOUTS.includes(spec.layout) ? sensitivitySpec(spec, at)
      : spec.layout === 'scenarios'
      ? Object.assign({ layout: 'scenarios', title: spec.title, period: spec.period === undefined ? 0 : periodIndex(spec.period),
          outputs: (spec.outputs || []).map(r => at(rectRef(r))) }, Array.isArray(spec.scenarios) ? { scenarios: spec.scenarios.map(String) } : {})
      : spec.layout === 'lines'
      ? { layout: 'lines', title: spec.title, periods: periodSpec(spec.periods), lines: (spec.lines || []).map(r => at(rectRef(r))) }
      : spec.layout === 'flow'
      ? { layout: 'flow', title: spec.title, period: spec.period === undefined ? 0 : periodIndex(spec.period),
          steps: (spec.steps || []).map(s => Object.assign(at(rectRef(s.rect)), { role: s.role })) }
      : { layout: 'columns', title: spec.title, periods: periodSpec(spec.periods), check: spec.check === true,
          groups: (spec.groups || []).map(g => ({ name: g.name, parts: (g.parts || []).map(p => at(rectRef(p))) })) };
    const c = cleanChart(raw, (w) => model.byKey.get(keyOf(w.canvasId, w.nodeId)), model.periods.length);
    c.ownPeriod = spec.periods !== undefined || spec.period !== undefined; // else the shared period (05k)
    board.items.push(c);
    saveBoardSoon();
    renderBoard();
    return c.id;
  },
  chart: (id) => {
    const c = chartById(id), results = currentResults();
    if(isSensitivity(c)){
      const f = sensitivityNow(c, shownOverrides(), true).figures;
      if(!f) return null;
      return { output: partLabel(c.output), period: model.periods[c.period], base: f.base,
        inputs: f.inputs.map(i => Object.assign({ name: partLabel(i.key), by: i.by, low: i.low, high: i.high, show: i.show },
          i.error ? { error: i.error } : { lowValue: i.lowValue, highValue: i.highValue, swing: i.swing },
          i.points ? { points: i.points.map(p => Object.assign({}, p)) } : {})) };
    }
    if(c.layout === 'lines') return linesFigures(c, results).map(f => ({ period: model.periods[f.p], lines: f.values.map((r, i) => ({ name: partLabel(c.lines[i]), value: answer(r) })) }));
    if(c.layout === 'flow') return flowFigures(c, results).map((f, i) => Object.assign({ name: partLabel(c.steps[i].key) }, f));
    if(c.layout === 'scenarios'){
      const memo = new Map();
      const resultsFor = (sc) => { if(!memo.has(sc)) memo.set(sc, scenarioResults(sc)); return memo.get(sc); };
      return c.outputs.map(k => ({ name: partLabel(k), steps: scenarioFigures(c, k, resultsFor).map(f => f.error ? { name: f.name, kind: f.kind, error: f.error }
        : { name: f.name, kind: f.kind, value: f.value, from: f.from, to: f.to }) }));
    }
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
  resetAll: () => { liveSliders().forEach(s => { s.value = null; }); renderBoard(); },
  // Whether the board shown keeps its own slider positions (true) or shares them (false).
  setOwnSliders: (on) => { if(!model) throw new Error('Open a model first.'); setOwnSliders(board, !!on); return !!board.ownSliders; },
  remove: (id) => { removeWidget(id); renderBoard(); },
  board: () => {
    if(!model) return null;
    syncShared(); // (03-calc.js)
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
  setScale: (id, spec) => {
    const w = board.items.find(x => x.id === id);
    if(!w) throw new Error('There is no bar or chart "' + String(id).slice(0, 40) + '".');
    const s = setWidgetScale(w, spec === undefined ? null : spec);
    saveBoardSoon();
    renderBoard();
    return s;
  },
  scale: (id) => {
    const w = board.items.find(x => x.id === id);
    if(!w) throw new Error('There is no bar or chart "' + String(id).slice(0, 40) + '".');
    return w.scale ? { min: w.scale.min, max: w.scale.max } : null;
  },
  setColour: (id, colour, rect) => {
    const c = colour === null ? null : cleanColour(colour);
    if(colour !== null && !c) throw new Error('A colour is written #rrggbb.');
    const w = board.items.find(x => x.id === id) || board.sliders.find(x => x.id === id);
    if(!w) throw new Error('There is no bar, chart or slider "' + String(id).slice(0, 40) + '".');
    let k = w.key;
    if(w.kind === 'chart'){
      k = findRect(rect).key;
      if(!chartKeys(w).includes(k)) throw new Error('That rectangle isn\'t in this chart.');
    }
    setRectColour(k, c); // the rectangle's, on every board (04e-colours.js)
    saveBoardSoon();
    renderBoard();
  },
  rectColour: (rect, canvas) => {
    adoptWidgetColours();
    const k = findRect(rect, canvas).key;
    return { colour: rectColour(k), chosen: !!chosenColour(k) };
  },
  colours: () => {
    adoptWidgetColours();
    return [...rectColours].filter(([k]) => model.byKey.has(k)).map(([k, colour]) => { const r = model.byKey.get(k); return { canvas: r.canvasName, name: r.name, colour }; });
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
  // Boards for a template (G5a): templates() lists what Export for a template… offers (its
  // words); exportForTemplate(i, { onlyShown }) saves the boards for the i-th (from 0) and
  // returns the file's data and how many widgets were left out, or null when nothing fits.
  templates: () => templateTargets().map(t => t.label),
  exportForTemplate: (i, opts) => {
    const t = templateTargets()[Number(i)];
    if(!t) throw new Error('There is no template number ' + String(i).slice(0, 20) + '.');
    const r = exportForTemplate(t, !!(opts && opts.onlyShown));
    return r ? { data: r.data, left: r.left } : null;
  },
  // The A/B snapshot (G4b): pinA() keeps where the sliders are as A (returns its words),
  // unpinA(), swapA() (returns the new A's words), comparing() — A's words, or null.
  pinA: () => pinAsA(),
  unpinA: () => { unpinA(); },
  swapA: () => { if(!pinA) throw new Error('Nothing is pinned as A.'); return swapWithA(); },
  comparing: () => pinA ? pinA.label : null,
  // Named scenarios: saveScenario(name?) → its name; scenarios() → [{ name, settings (words),
  // shown, compared }]; showScenario(name) → how many of its inputs have no slider on this
  // board; compareWith(name or null) → A's words (null unpins); renameScenario(name, newName),
  // updateScenario(name), moveScenario(name, index), deleteScenario(name).
  saveScenario: (name) => saveScenario(name),
  scenarios: () => scenarios.map(sc => ({ name: sc.name, settings: sc.settings.length ? settingsLabel(sc.settings) : 'the model\'s own numbers',
    shown: scenarioShown(sc), compared: !!(pinA && pinA.scenario === sc.name) })),
  showScenario: (name) => showScenario(findScenario(name)),
  compareWith: (name) => { if(name === null || name === undefined){ unpinA(); markScenarios(); return null; } const l = compareWithScenario(findScenario(name)); markScenarios(); return l; },
  renameScenario: (name, to) => renameScenario(findScenario(name), to),
  updateScenario: (name) => updateScenario(findScenario(name)),
  moveScenario: (name, index) => moveScenario(findScenario(name), Number(index)),
  deleteScenario: (name) => deleteScenario(findScenario(name)),
  // Play (05m-play.js): play({ from, to, seconds?, pause? }) — each end a scenario's name, 'model'
  // (the model's own numbers) or 'sliders' (where they are now); seconds a swing (2), pause at
  // each end (0.6) — swings between them until stopPlay() (true when it was playing); returns
  // the strip's words. playing() → null, or { from, to, still (reduced motion), ready, index,
  // fraction, positions, worked (positions worked out), runs (calculations it needed), elapsed
  // (ms on the page's clock since the swinging began, null before), swing, pause (ms) };
  // stepPlay() shows the other end when still.
  play: (spec) => {
    spec = spec || {};
    if(!model) throw new Error('Open a model first.');
    const end = (x) => x === 'model' || x === 'sliders' ? x : 'sc:' + findScenario(x).name;
    const words = startPlay(end(spec.from === undefined ? 'model' : spec.from), end(spec.to === undefined ? 'sliders' : spec.to),
      { swingMs: spec.seconds === undefined ? undefined : Number(spec.seconds) * 1000, pauseMs: spec.pause === undefined ? undefined : Number(spec.pause) * 1000 });
    if(!words) throw new Error('From and to give the same numbers: there is nothing to play.');
    return words;
  },
  stopPlay: () => stopPlay(),
  stepPlay: () => stepPlay(),
  playing: () => playing ? { from: playing.from.name, to: playing.to.name, still: playing.still, ready: playing.ready, index: playing.index,
    fraction: playing.index < 0 ? null : playing.fractions[playing.index], positions: playing.positions.length,
    worked: playing.positions.filter(o => resultCache.has(overridesKey(o))).length, runs: playing.runs,
    elapsed: playing.startedAt === null ? null : performance.now() - playing.startedAt, swing: playing.swingMs, pause: playing.pauseMs } : null,
  // G6: tutorials. startTutorial(id) → Promise<boolean>; tutorial() → { id, step (its id), index } or null;
  // stopTutorial() puts the model from before back.
  tutorials: () => FMGRAPH_TUTORIALS.map(t => ({ id: t.id, title: t.title, steps: t.steps.length })),
  startTutorial: (id) => startTutorial(String(id)),
  tutorial: () => practice ? { id: practice.tutorial.id, step: practice.tutorial.steps[practice.step].id, index: practice.step } : null,
  stopTutorial: () => stopTutorial(true),
  // G5c: the template tried from fmIDE's Browse Library, { name, pack }, or null.
  trying: () => trying ? { name: trying.name, pack: trying.pack } : null,
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
  goalSeek: (spec) => {
    spec = spec || {};
    if(!model) throw new Error('Open a model first.');
    const rect = findRect(spec.rect, spec.canvas);
    const p = periodIndex(spec.period === undefined ? 1 : spec.period);
    const target = typeof spec.target === 'number' || typeof spec.target === 'string' ? Number(spec.target) : NaN;
    if(String(spec.target).trim() === '' || !isFinite(target)) throw new Error('The number to reach must be a number.');
    const r = goalSeekNow(goalSliderRef(spec.slider), rect, p, target);
    if(r.reached) return Object.assign({ reached: true, value: r.value }, r.range ? { range: Object.assign({}, r.range) } : {}, { message: r.message });
    return Object.assign({ reached: false, low: r.low, high: r.high }, r.stopped ? { stopped: true } : {},
      r.jump ? { jump: true, at: r.at } : {}, r.low === null ? { error: r.error } : {}, { message: r.message });
  },
});
