// ============================================================
// fmGraph boards — ExcelExporter's own reader of the fmIDE-graph-board format (step 19,
// phase B2; docs/step19-fmgraph-in-excel.md). Written from the format's documentation
// (docs/file-formats.md, "fmGraph boards", CC BY 4.0): no code comes from fmGraph, which is
// under another licence (LICENSING.md).
//
// A board file comes from someone else as often as not (fmGraph's Export, a document's
// graphBoards), so everything in it is untrusted: names are kept as plain text and cut to
// the documented lengths, numbers forced to numbers, periods checked, and a rectangle is used
// only where the open model has it — same canvas id, node id and name (capitals and outer
// spaces ignored). Anything else is left out and counted, and the window says so.
//
//   readGraphBoards(raw)         → { error } or { version, boards, scenarios, badScenarios, badSettings }
//   matchGraphScenarios(read)    → the scenarios with each setting matched to a layout row
//   matchGraphSliders(read)      → every board's sliders matched to layout rows, like ones once (B4)
//   readGraphCharts(board, version) → a board's bars, columns, lines and flow charts (B5) and Free charts (F3), not yet matched
//   matchGraphCharts(board)      → those charts matched to layout rows, for the Dashboard (B5)
//   cleanGraphCopy(raw, periods) → the layout's cfg.graph (mapping file 4; sliders from file 7, charts from 8, Free charts from 11), checked
// ============================================================
const GRAPH_BOARD_KIND = 'fmIDE-graph-board';
const GRAPH_BOARD_VERSION = 14; // the newest version this reader knows (8: step 18's Tornado and Spider charts; 9: fmGraph's shared period — each chart still names the periods it shows, so nothing here reads it; 10: the lines chart; 11: fmGraph's shared colours — each bar, part and step still carries the colour it shows, so nothing here reads them; 12: fmGraph's common scale — each bar and chart still carries the scale it shows, so nothing here reads it; 13: fmGraph's Free chart, drawn on the Dashboard as stacked columns, phase F3; 14: a slider at its minimum, one short row in fmGraph — how a slider looks, so nothing here reads it)
const GRAPH_LIMITS = { boards: 20, scenarios: 50, settings: 40, sliders: 40, boardName: 60, scenarioName: 40, rectName: 60, value: 1e15,
  items: 40, title: 80, groups: 12, parts: 30, steps: 40, lines: 12 };
const GRAPH_FLOW_ROLES = ['start', 'add', 'subtract', 'total'];

let modelGraphBoards = null; // the graphBoards a loaded workspace or .fmide carried (raw; read only when used)

// Plain text, outer spaces off, at most `max` characters.
function graphText(v, max){
  if(typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}
// A number, or null: numbers and number-looking text forced, nothing beyond ±10¹⁵.
function graphNumber(v){
  if(typeof v === 'string' && v.trim() === '') return null;
  if(typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= GRAPH_LIMITS.value ? n : null;
}
// A widget's periods: all, one period or a range (counting from 0); a period the model
// doesn't have, or anything else, reads as all.
function cleanGraphPeriods(p, periodCount){
  const n = Math.max(1, periodCount || 1);
  const whole = (x) => { const v = Number(x); return Number.isInteger(v) && v >= 0 && v < n ? v : null; };
  if(p && typeof p === 'object' && !Array.isArray(p)){
    if(p.mode === 'one'){ const at = whole(p.p); if(at !== null) return { mode: 'one', p: at }; }
    if(p.mode === 'range'){
      const from = whole(p.from), to = whole(p.to);
      if(from !== null && to !== null && from <= to) return { mode: 'range', from, to };
    }
  }
  return { mode: 'all' };
}
function graphPeriodsCover(periods, p){
  if(!periods || periods.mode === 'all') return true;
  if(periods.mode === 'one') return p === periods.p;
  return p >= periods.from && p <= periods.to;
}
function graphPeriodsText(periods, labels){
  if(!periods || periods.mode === 'all') return 'all periods';
  const at = (i) => (labels && labels[i]) || ('period ' + (i + 1));
  return periods.mode === 'one' ? at(periods.p) : at(periods.from) + '–' + at(periods.to);
}

// Reads a board file's structure (not yet matched to a model). The template form, a newer
// version and anything not a board file are refused with the reason.
function readGraphBoards(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.kind !== GRAPH_BOARD_KIND){
    return { error: 'That is not an fmGraph boards file (made with Export all boards in fmGraph).' };
  }
  const version = raw.version === undefined ? 1 : Number(raw.version);
  if(!Number.isInteger(version) || version < 1) return { error: 'That fmGraph boards file has no version this ExcelExporter can read.' };
  if(version > GRAPH_BOARD_VERSION){
    return { error: 'That fmGraph boards file is from a newer version (format version ' + version + '; this ExcelExporter reads up to version ' + GRAPH_BOARD_VERSION + '). Update ExcelExporter to use it.' };
  }
  if(raw.form === 'template'){
    return { error: 'That fmGraph boards file is for a template (Export for a template…), not for one model: export the model\'s boards with Export all boards.' };
  }
  // Before boards had tabs, one board sat at the top level (no `boards`).
  const list = Array.isArray(raw.boards) ? raw.boards : [raw];
  const boards = [];
  list.slice(0, GRAPH_LIMITS.boards).forEach((b, i) => {
    if(!b || typeof b !== 'object' || Array.isArray(b)) return;
    const count = (x) => Array.isArray(x) ? x.length : 0;
    boards.push({ name: graphText(b.name, GRAPH_LIMITS.boardName) || ('Board ' + (i + 1)),
      sliders: count(b.sliders), sliderList: readGraphSliders(b.sliders), items: count(b.items) + count(b.bars) + count(b.charts),
      sensCharts: version >= 8 ? readGraphSensCharts(b.items) : [], charts: readGraphCharts(b, version) });
  });
  // Named scenarios came in version 3: an older file's are not read.
  const scenarios = [];
  let badScenarios = 0, badSettings = 0;
  const seen = new Set();
  (version >= 3 && Array.isArray(raw.scenarios) ? raw.scenarios : []).forEach(sc => {
    const name = sc && typeof sc === 'object' ? graphText(sc.name, GRAPH_LIMITS.scenarioName) : '';
    const key = name.toLowerCase();
    if(!name || seen.has(key) || scenarios.length >= GRAPH_LIMITS.scenarios){ badScenarios++; return; }
    seen.add(key);
    const settings = [];
    (Array.isArray(sc.sliders) ? sc.sliders : []).forEach(s => {
      if(!s || typeof s !== 'object' || typeof s.canvasId !== 'string' || typeof s.nodeId !== 'string'
        || !s.canvasId || !s.nodeId || s.canvasId.length > 200 || s.nodeId.length > 200
        || (s.mode !== 'set' && s.mode !== 'shift') || settings.length >= GRAPH_LIMITS.settings){ badSettings++; return; }
      const value = graphNumber(s.value);
      if(value === null){ badSettings++; return; }
      settings.push({ canvasId: s.canvasId, nodeId: s.nodeId, name: graphText(s.name, GRAPH_LIMITS.rectName), mode: s.mode, periods: s.periods, value });
    });
    scenarios.push({ name, settings });
  });
  return { version, boards, scenarios, badScenarios, badSettings };
}

// A board's sliders (every version): the rectangle, periods (checked when matched), kind and
// range — min, max and step as numbers, or null when missing or not usable (min below max, a
// step above 0); not yet matched to a model. At most GRAPH_LIMITS.sliders a board.
function readGraphSliders(list){
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, GRAPH_LIMITS.sliders).forEach(s => {
    if(!s || typeof s !== 'object' || typeof s.canvasId !== 'string' || typeof s.nodeId !== 'string'
      || !s.canvasId || !s.nodeId || s.canvasId.length > 200 || s.nodeId.length > 200){ out.push(null); return; }
    out.push(Object.assign({ canvasId: s.canvasId, nodeId: s.nodeId, name: graphText(s.name, GRAPH_LIMITS.rectName),
      mode: s.mode === 'shift' ? 'shift' : 'set', periods: s.periods }, graphSliderRange(s)));
  });
  return out;
}
// min, max and step as numbers, or all null when they don't make a range.
function graphSliderRange(s){
  const min = graphNumber(s.min), max = graphNumber(s.max), step = graphNumber(s.step);
  return min !== null && max !== null && step !== null && min < max && step > 0 ? { min, max, step } : { min: null, max: null, step: null };
}
// fmIDE's number for an input row in period p (its typed number; 0 when it has none).
function graphInputNumber(rowId, p){
  const row = mapping.rows.find(r => r.id === rowId);
  const n = row && irNode(row.canvasId, row.nodeId);
  const v = n && n.literal ? effectiveLiteral(n.literal, p) : null;
  return typeof v === 'number' && isFinite(v) ? v : 0;
}
// The first period a slider covers.
function graphFirstPeriod(periods){ return !periods || periods.mode === 'all' ? 0 : periods.mode === 'one' ? periods.p : periods.from; }
// A range for a slider whose board gave none: a change by % from −50 to +50 in steps of 1; a
// set slider 20 round steps either side of fmIDE's number in its first period.
function graphDefaultRange(mode, rowId, periods){
  if(mode === 'shift') return { min: -50, max: 50, step: 1 };
  const v = graphInputNumber(rowId, graphFirstPeriod(periods));
  const raw = (Math.abs(v) > 0 ? Math.abs(v) * 0.5 : 10) / 20;
  const tens = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / tens;
  const step = Number(((f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * tens).toPrecision(12));
  const centre = Math.round(v / step) * step;
  return { min: Number((centre - 20 * step).toPrecision(12)), max: Number((centre + 20 * step).toPrecision(12)), step };
}

// Every board's sliders matched to the open model, as a scenario's settings are (an input
// rectangle outside any block). Like sliders — the same rectangle, periods and kind — are kept
// once (the first one's range), at most GRAPH_LIMITS.sliders in all. The rest counted.
// → { sliders: [{ row, name, mode, periods, min, max, step, boards: [names] }], left: { notFound, notInput, inBlock, bad, past } }
function matchGraphSliders(read){
  const left = { notFound: 0, notInput: 0, inBlock: 0, bad: 0, past: 0 };
  const sliders = [];
  read.boards.forEach(b => (b.sliderList || []).forEach(s => {
    if(!s){ left.bad++; return; }
    const row = graphRectRow(s);
    const why = !row ? 'notFound' : isUsedAsBlock(s.canvasId) ? 'inBlock' : !isSensitivityInputRow(row) ? 'notInput' : null;
    if(why){ left[why]++; return; }
    const periods = cleanGraphPeriods(s.periods, model.periods.length);
    const like = sliders.find(x => x.row === row.id && x.mode === s.mode && JSON.stringify(x.periods) === JSON.stringify(periods));
    if(like){ if(!like.boards.includes(b.name)) like.boards.push(b.name); return; }
    if(sliders.length >= GRAPH_LIMITS.sliders){ left.past++; return; }
    const range = s.min !== null ? { min: s.min, max: s.max, step: s.step } : graphDefaultRange(s.mode, row.id, periods);
    sliders.push(Object.assign({ row: row.id, name: s.name || row.label || '', mode: s.mode, periods }, range, { boards: [b.name] }));
  }));
  return { sliders, left };
}

// A board's Tornado and Spider charts (version 8, step 18): layout, title, output, period,
// steps and inputs, each read as the format says (text cut, numbers forced and bounded, at
// most 50 inputs, anything else its default); not yet matched to a model.
function readGraphSensCharts(items){
  const out = [];
  const rect = (r) => r && typeof r === 'object' && typeof r.canvasId === 'string' && typeof r.nodeId === 'string'
    && r.canvasId && r.nodeId && r.canvasId.length <= 200 && r.nodeId.length <= 200
    ? { canvasId: r.canvasId, nodeId: r.nodeId, name: graphText(r.name, GRAPH_LIMITS.rectName) } : null;
  (Array.isArray(items) ? items : []).slice(0, 40).forEach(it => {
    if(!it || typeof it !== 'object' || it.type !== 'chart' || (it.layout !== 'tornado' && it.layout !== 'spider')) return;
    const p = Number(it.period), st = Number(it.steps);
    const chart = { layout: it.layout, title: graphText(it.title, 80), output: rect(it.output),
      period: Number.isInteger(p) && p >= 0 ? p : 0,
      steps: Number.isInteger(st) && st >= 1 && st <= 10 ? st : 5, inputs: [], badInputs: 0 };
    (Array.isArray(it.inputs) ? it.inputs : []).forEach(v => {
      const r = rect(v);
      if(!r || chart.inputs.length >= 50){ chart.badInputs++; return; }
      const by = v.by === 'amount' ? 'amount' : 'percent';
      const num = (x, d) => { const n = graphNumber(x); return n === null ? d : Math.max(-1e9, Math.min(1e9, n)); };
      const spec = Object.assign(r, { by, low: num(v.low, by === 'amount' ? -1 : -10), high: num(v.high, by === 'amount' ? 1 : 10) });
      if(v.show === false) spec.show = false;
      chart.inputs.push(spec);
    });
    out.push(chart);
  });
  return out;
}
// ---------- Bars and charts → the Dashboard's charts (step 19 B5) ----------
// A colour as the format has it, '#rrggbb' (small letters), else null.
function graphColour(v){ return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null; }
// A fixed vertical scale (board file 5): both numbers, min below max, else null (Auto).
function graphScale(v){
  if(!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const min = graphNumber(v.min), max = graphNumber(v.max);
  return typeof v.min === 'number' && typeof v.max === 'number' && min !== null && max !== null && min < max ? { min, max } : null;
}
// A rectangle a widget names: { canvasId, nodeId, name }, or null.
function graphRect(r){
  return r && typeof r === 'object' && typeof r.canvasId === 'string' && typeof r.nodeId === 'string'
    && r.canvasId && r.nodeId && r.canvasId.length <= 200 && r.nodeId.length <= 200
    ? { canvasId: r.canvasId, nodeId: r.nodeId, name: graphText(r.name, GRAPH_LIMITS.rectName) } : null;
}
// ---------- fmGraph's Free chart (board file 13; phase F3 of docs/fmgraph-free-chart.md) ----------
// A chart of pieces, each a stack of rectangles standing in a whole grid column (0–39) and
// saying where it sits: on zero, on top of another piece (its highest point; its lowest when
// that piece only goes down), where another piece ends, or at a number. Read as the format
// says, and put right as fmGraph puts it right when it reads a file: `of` and `check` naming no
// other piece read as on zero and none; pieces in a loop go on zero; two pieces in one column
// with neither resting on the other (through any chain): the later moves to the next column it
// fits; a piece with no column takes the next free one. Here a piece's `of` and `check` are its
// place in the list (0, 1…), and its rectangles are the chart's `parts`, each with its `piece`.
const GRAPH_FREE_LIMITS = { pieces: 40, parts: 30, columns: 40, level: 1e9, series: 255 };
const GRAPH_FREE_SITS = ['zero', 'top', 'end', 'level'];
// A level from a file (numbers as text too), cut to ±1e9; anything else 0.
function graphFreeLevel(v){
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(-GRAPH_FREE_LIMITS.level, Math.min(GRAPH_FREE_LIMITS.level, n)) : 0;
}
// The place of the piece pieces[i] rests on, or -1.
function graphFreeRestsOn(pieces, i){
  const s = pieces[i] && pieces[i].sits;
  return s && (s.on === 'top' || s.on === 'end') && Number.isInteger(s.of) && s.of !== i && pieces[s.of] ? s.of : -1;
}
// Whether piece a rests on piece b, through any chain of pieces.
function graphFreeOnChain(pieces, a, b){
  const seen = new Set();
  for(let q = graphFreeRestsOn(pieces, a); q >= 0 && !seen.has(q); q = graphFreeRestsOn(pieces, q)){
    if(q === b) return true;
    seen.add(q);
  }
  return false;
}
const graphFreeRelated = (pieces, a, b) => graphFreeOnChain(pieces, a, b) || graphFreeOnChain(pieces, b, a);
// Loops on zero, then the columns put right (as above). Changes `pieces`; → { loops, moved }.
function settleGraphFree(pieces){
  const L = GRAPH_FREE_LIMITS.columns;
  let loops = 0, moved = 0;
  pieces.forEach((_, i) => {
    const path = [];
    for(let q = i; q >= 0; q = graphFreeRestsOn(pieces, q)){
      const at = path.indexOf(q);
      if(at >= 0){ path.slice(at).forEach(x => { pieces[x].sits = { on: 'zero' }; loops++; }); break; }
      path.push(q);
    }
  });
  pieces.forEach((p, i) => {
    const fits = (col) => pieces.slice(0, i).every((q, j) => q.column !== col || graphFreeRelated(pieces, i, j));
    if(fits(p.column)) return;
    for(let k = 1; k < L; k++){
      const col = (p.column + k) % L;
      if(fits(col)){ p.column = col; moved++; return; }
    }
  });
  pieces.forEach(p => {
    if(p.column >= 0) return;
    const placed = pieces.filter(x => x.column >= 0), used = new Set(placed.map(x => x.column));
    const last = placed.length ? Math.max(...placed.map(x => x.column)) : -1;
    p.column = 0;
    for(let k = 1; k <= L; k++){ const col = (last + k) % L; if(!used.has(col)){ p.column = col; break; } }
  });
  return { loops, moved };
}
// A piece as the layout keeps it: { name, column, sits: { on, of | value }, minus?, check? }.
function graphFreePieceOut(p){
  const sits = p.sits.on === 'level' ? { on: 'level', value: p.sits.value } : Number.isInteger(p.sits.of) ? { on: p.sits.on, of: p.sits.of } : { on: 'zero' };
  return Object.assign({ name: p.name, column: p.column, sits }, p.minus === true ? { minus: true } : {}, Number.isInteger(p.check) ? { check: p.check } : {});
}
// A Free chart's pieces and rectangles from a board file: { pieces, parts: [{ canvasId, nodeId, name, colour, piece }], bad }.
function readGraphFree(it){
  const pieces = [], parts = [], fileIds = new Map(), fileOf = [], fileCheck = [];
  let bad = 0;
  (Array.isArray(it.pieces) ? it.pieces : []).slice(0, GRAPH_FREE_LIMITS.pieces).forEach(raw => {
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const i = pieces.length;
    const col = Math.round(Number(raw.column));
    const sits = raw.sits && typeof raw.sits === 'object' ? raw.sits : {};
    const on = GRAPH_FREE_SITS.includes(sits.on) ? sits.on : 'zero';
    (Array.isArray(raw.parts) ? raw.parts : []).slice(0, GRAPH_FREE_LIMITS.parts).forEach(x => {
      const r = graphRect(x);
      if(!r){ bad++; return; }
      parts.push(Object.assign(r, { colour: graphColour(x.colour), piece: i }));
    });
    pieces.push({ name: graphText(raw.name, GRAPH_LIMITS.rectName), column: Number.isFinite(col) && col >= 0 && col < GRAPH_FREE_LIMITS.columns ? col : -1,
      sits: on === 'level' ? { on, value: graphFreeLevel(sits.value) } : { on }, minus: raw.minus === true, check: null });
    fileOf.push(typeof sits.of === 'string' ? sits.of : null);
    fileCheck.push(typeof raw.check === 'string' ? raw.check : null);
    if(typeof raw.id === 'string' && !fileIds.has(raw.id)) fileIds.set(raw.id, i);
  });
  pieces.forEach((p, i) => {
    if(p.sits.on === 'top' || p.sits.on === 'end'){
      const of = fileIds.get(fileOf[i]);
      if(of !== undefined && of !== i) p.sits.of = of; else p.sits = { on: 'zero' };
    }
    const chk = fileIds.get(fileCheck[i]);
    if(chk !== undefined && chk !== i) p.check = chk;
  });
  settleGraphFree(pieces);
  return { pieces: pieces.map(graphFreePieceOut), parts, bad };
}
// The series a Free chart needs in Excel: per piece a hidden filler above and below 0, per
// rectangle four (above and below 0, each as a positive and as a negative part).
const graphFreeSeries = (c) => 2 * c.pieces.length + 4 * c.parts.length;
// A Free chart's pieces as a layout keeps them (mapping file 11), checked: a name cut, a column
// 0–39, `sits` one of the four (`of` another piece's place, a level cut to ±1e9), `check`
// another piece's place; then loops and columns put right as from a board file. A piece that
// isn't one is kept as an empty piece on zero, so the places after it stay as they were.
function cleanGraphFreePieces(raw){
  const pieces = (Array.isArray(raw) ? raw : []).slice(0, GRAPH_FREE_LIMITS.pieces).map(p => {
    if(!p || typeof p !== 'object' || Array.isArray(p)) return { name: '', column: -1, sits: { on: 'zero' }, minus: false, check: null };
    const col = Number(p.column), s = p.sits && typeof p.sits === 'object' && !Array.isArray(p.sits) ? p.sits : {};
    const on = GRAPH_FREE_SITS.includes(s.on) ? s.on : 'zero';
    return { name: graphText(p.name, GRAPH_LIMITS.rectName), column: Number.isInteger(col) && col >= 0 && col < GRAPH_FREE_LIMITS.columns ? col : -1,
      sits: on === 'level' ? { on, value: graphFreeLevel(s.value) } : on === 'zero' ? { on } : { on, of: Number(s.of) },
      minus: p.minus === true, check: Number.isInteger(p.check) ? p.check : null };
  });
  const n = pieces.length;
  pieces.forEach((p, i) => {
    if((p.sits.on === 'top' || p.sits.on === 'end') && !(Number.isInteger(p.sits.of) && p.sits.of >= 0 && p.sits.of < n && p.sits.of !== i)) p.sits = { on: 'zero' };
    if(p.check !== null && !(p.check >= 0 && p.check < n && p.check !== i)) p.check = null;
  });
  settleGraphFree(pieces);
  return pieces.map(graphFreePieceOut);
}

// A board's bars and its columns, lines and flow charts, in the board's order, each read as the
// format says (text cut, colours checked, at most 12 groups of 30 parts, 12 lines, 40 steps); a scenario waterfall
// is kept only to be listed as not carried, a Tornado or Spider not here (they become analyses).
// The form before boards had tabs (no `items`) is read charts first. Not yet matched to a model:
// [{ kind: 'bar' | 'columns' | 'lines' | 'flow' | 'scenarios' | 'free', title, wide, scale, periods | period, … }]
function readGraphCharts(b, version){
  const items = Array.isArray(b.items) ? b.items
    : (Array.isArray(b.charts) ? b.charts.map(c => Object.assign({}, c, { type: 'chart' })) : [])
      .concat(Array.isArray(b.bars) ? b.bars.map(x => Object.assign({}, x, { type: 'bar' })) : []);
  const out = [];
  items.slice(0, GRAPH_LIMITS.items).forEach(it => {
    if(!it || typeof it !== 'object' || Array.isArray(it)) return;
    const scale = version >= 5 ? graphScale(it.scale) : null;
    const period = (x) => { const n = Number(x); return Number.isInteger(n) && n >= 0 ? n : 0; };
    if(it.type === 'bar'){
      const r = graphRect(it);
      out.push({ kind: 'bar', title: '', wide: it.wide === true, scale, periods: it.periods, parts: r ? [Object.assign(r, { colour: graphColour(it.colour) })] : [], bad: r ? 0 : 1 });
      return;
    }
    if(it.type !== 'chart') return;
    const title = graphText(it.title, GRAPH_LIMITS.title), wide = it.wide !== false;
    if(it.layout === 'scenarios'){ out.push({ kind: 'scenarios', title, wide, scale, parts: [], bad: 0 }); return; }
    if(it.layout === 'free'){ // version 13 (phase F3)
      const f = readGraphFree(it);
      out.push({ kind: 'free', title, wide, scale, period: period(it.period), pieces: f.pieces, parts: f.parts, bad: f.bad });
      return;
    }
    if(it.layout === 'flow'){
      const parts = [];
      let bad = 0;
      (Array.isArray(it.steps) ? it.steps : []).forEach(st => {
        const r = graphRect(st);
        if(!r || parts.length >= GRAPH_LIMITS.steps){ bad++; return; }
        parts.push(Object.assign(r, { role: GRAPH_FLOW_ROLES.includes(st.role) ? st.role : 'add', colour: graphColour(st.colour) }));
      });
      out.push({ kind: 'flow', title, wide, scale, period: period(it.period), parts, bad });
      return;
    }
    if(it.layout === 'tornado' || it.layout === 'spider') return;
    if(it.layout === 'lines'){ // version 10
      const parts = [];
      let bad = 0;
      (Array.isArray(it.lines) ? it.lines : []).forEach(x => {
        const r = graphRect(x);
        if(!r || parts.length >= GRAPH_LIMITS.lines){ bad++; return; }
        parts.push(Object.assign(r, { colour: graphColour(x.colour) }));
      });
      out.push({ kind: 'lines', title, wide, scale, periods: it.periods, parts, bad });
      return;
    }
    // columns (and, as fmGraph reads it, a layout this reader doesn't know)
    const groups = [], parts = [];
    let bad = 0;
    const allGroups = Array.isArray(it.groups) ? it.groups : [];
    allGroups.slice(GRAPH_LIMITS.groups).forEach(g => { bad += g && Array.isArray(g.parts) ? g.parts.length : 1; }); // past 12 groups: counted
    allGroups.slice(0, GRAPH_LIMITS.groups).forEach(g => {
      if(!g || typeof g !== 'object'){ bad++; return; }
      const gi = groups.length;
      groups.push(graphText(g.name, GRAPH_LIMITS.rectName));
      (Array.isArray(g.parts) ? g.parts : []).forEach((x, k) => {
        const r = graphRect(x);
        if(!r || k >= GRAPH_LIMITS.parts){ bad++; return; }
        parts.push(Object.assign(r, { group: gi, colour: graphColour(x.colour) }));
      });
    });
    out.push({ kind: 'columns', title, wide, scale, periods: it.periods, groups, parts, bad });
  });
  return out;
}
// A board's bars and charts matched to the open model, in the layout's form: each part kept
// where the model has its rectangle (any value rectangle with a row, outside any block); a
// chart with no part left is left out. A scenario waterfall is counted as not carried, and so is
// a Free chart needing more series than an Excel chart holds (255).
// → { charts: [cfg.graph.charts entry], left: { notFound, bad, empty, scenarios, tooManySeries } }
function matchGraphCharts(board){
  const left = { notFound: 0, bad: 0, empty: 0, scenarios: 0, tooManySeries: 0 };
  const charts = [];
  (board && board.charts || []).forEach(c => {
    if(c.kind === 'scenarios'){ left.scenarios++; return; }
    left.bad += c.bad;
    const parts = [];
    c.parts.forEach(x => {
      const row = graphRectRow(x);
      if(!row || row.isCustom){ left.notFound++; return; }
      const part = { row: row.id, name: x.name || row.label || '' };
      if(x.colour) part.colour = x.colour;
      if(c.kind === 'flow') part.role = x.role;
      if(c.kind === 'columns') part.group = x.group;
      if(c.kind === 'free') part.piece = x.piece;
      parts.push(part);
    });
    if(!parts.length){ left.empty++; return; }
    const out = { kind: c.kind, title: c.title, wide: c.wide, scale: c.scale, parts };
    if(c.kind === 'free'){
      out.pieces = c.pieces.map(p => JSON.parse(JSON.stringify(p)));
      if(graphFreeSeries(out) > GRAPH_FREE_LIMITS.series){ left.tooManySeries++; return; }
    }
    if(c.kind === 'flow' || c.kind === 'free') out.period = c.period < model.periods.length ? c.period : 0; // as fmGraph reads a period it hasn't got
    else out.periods = cleanGraphPeriods(c.periods, model.periods.length);
    if(c.kind === 'columns') out.groups = c.groups.slice();
    charts.push(out);
  });
  return { charts, left };
}
// A chart's name in the window and on the Dashboard: its title, else (a bar) its rectangle,
// else its parts' names.
function graphChartName(c){
  if(c.title) return c.title;
  const names = c.parts.map(x => x.name).filter(Boolean);
  const text = c.kind === 'bar' ? (names[0] || 'Bar') : c.kind === 'free' ? 'Free' : names.join(', ') || (c.kind === 'flow' ? 'Waterfall' : c.kind === 'lines' ? 'Lines' : 'Columns');
  return text.length > GRAPH_LIMITS.title ? text.slice(0, GRAPH_LIMITS.title - 1) + '…' : text;
}

// A rectangle of the open model by canvas id, node id and name (capitals and outer spaces
// ignored), at the top level: its layout row, or null.
function graphRectRow(r){
  const norm = (s) => String(s || '').trim().toLowerCase();
  const canvas = r && model.canvases.find(c => c.id === r.canvasId);
  const node = canvas && canvas.nodes.find(n => n.id === r.nodeId);
  if(!node || node.type !== 'value' || norm(parseRectText(node.text).name) !== norm(r.name)) return null;
  return mapping.rows.find(x => x.id === pathKey([], r.canvasId, r.nodeId)) || null;
}
// A board's Tornado and Spider charts matched to the open model: the output a rectangle row
// of it (else the chart is left out), each input as a scenario's setting is (else left out);
// a chart left with no inputs to move is left out too (noInputs).
// → { charts: [{ layout, title, output (row id), outputName, period, steps, variables }], left: { noOutput, noInputs, notFound, inBlock, notInput, bad } }
function matchGraphSensCharts(board){
  const left = { noOutput: 0, noInputs: 0, notFound: 0, inBlock: 0, notInput: 0, bad: 0 };
  const charts = [];
  (board && board.sensCharts || []).forEach(c => {
    left.bad += c.badInputs;
    const outRow = c.output && graphRectRow(c.output);
    if(!outRow || outRow.isCustom){ left.noOutput++; return; }
    const variables = [];
    c.inputs.forEach(v => {
      const row = graphRectRow(v);
      const why = !row ? 'notFound' : isUsedAsBlock(v.canvasId) ? 'inBlock' : !isSensitivityInputRow(row) ? 'notInput' : null;
      if(why){ left[why]++; return; }
      if(variables.some(x => x.row === row.id)) return;
      const spec = { row: row.id, by: v.by, low: v.low, high: v.high };
      if(v.show === false) spec.show = false;
      variables.push(spec);
    });
    if(!variables.length){ left.noInputs++; return; }
    charts.push({ layout: c.layout, title: c.title, output: outRow.id, outputName: outRow.label || c.output.name,
      period: c.period < model.periods.length ? c.period : 0, steps: c.steps, variables }); // a period the model hasn't got: 0, as fmGraph reads it
  });
  return { charts, left };
}

// Each scenario's settings matched to the open model: kept only on an input rectangle the
// model has under that canvas id, node id and name, outside any block. The rest counted.
// → { scenarios: [{ name, settings: [{ row, name, mode, periods, value }] }], left: { notFound, notInput, inBlock, bad, names (of those not found) } }
function matchGraphScenarios(read){
  const left = { notFound: 0, notInput: 0, inBlock: 0, bad: read.badSettings || 0, names: [] };
  const norm = (s) => String(s || '').trim().toLowerCase();
  const scenarios = read.scenarios.map(sc => ({ name: sc.name, settings: sc.settings.filter(s => {
    const canvas = model.canvases.find(c => c.id === s.canvasId);
    const node = canvas && canvas.nodes.find(n => n.id === s.nodeId);
    const row = node && mapping.rows.find(r => r.id === pathKey([], s.canvasId, s.nodeId));
    const named = node && node.type === 'value' && norm(parseRectText(node.text).name) === norm(s.name);
    const why = !row || !named ? 'notFound' : isUsedAsBlock(s.canvasId) ? 'inBlock' : !isSensitivityInputRow(row) ? 'notInput' : null;
    if(why){
      left[why]++;
      if(why === 'notFound' && s.name && !left.names.includes(s.name) && left.names.length < 20) left.names.push(s.name);
      return false;
    }
    s.row = row.id;
    s.periods = cleanGraphPeriods(s.periods, model.periods.length);
    return true;
  }).map(s => ({ row: s.row, name: s.name || row0Label(s.row), mode: s.mode, periods: s.periods, value: s.value })) }));
  return { scenarios, left };
}
function row0Label(rowId){ const r = mapping.rows.find(x => x.id === rowId); return r ? String(r.label || '') : ''; }

// ---------- The layout's copy: cfg.graph (mapping file 4) ----------
// What Layout → Use fmGraph boards… copied, as settings ExcelExporter owns from then on:
//   { from: [board names], board: the board picked, scenarios: [{ name, settings: [{ row, name, mode, periods, value }] }],
//     sliders: [{ row, name, mode, periods, min, max, step }] (mapping file 7, step 19 B4),
//     charts: [{ kind: 'bar' | 'columns' | 'lines' | 'flow', title, wide, scale: { min, max } | null,
//       periods (bar, columns, lines) | period (flow), groups: [names] (columns),
//       parts: [{ row, name, colour?, role (flow), group (columns) }] }] (mapping file 8, B5;
//       `lines`, a line per part, mapping file 9;
//       `free`, fmGraph's Free chart, mapping file 11: period, pieces: [{ name, column, sits: { on, of | value },
//       minus?, check? }] (`of` and `check` a piece's place), parts: [{ row, name, colour?, piece }]) }
function defaultGraphCopy(){ return { from: [], board: '', scenarios: [], sliders: [], charts: [] }; }
function cleanGraphCopy(raw, periodCount){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = defaultGraphCopy();
  out.from = (Array.isArray(src.from) ? src.from : []).map(n => graphText(n, GRAPH_LIMITS.boardName)).filter(Boolean).slice(0, GRAPH_LIMITS.boards);
  out.board = graphText(src.board, GRAPH_LIMITS.boardName);
  const seen = new Set();
  (Array.isArray(src.scenarios) ? src.scenarios : []).forEach(sc => {
    const name = sc && typeof sc === 'object' ? graphText(sc.name, GRAPH_LIMITS.scenarioName) : '';
    if(!name || seen.has(name.toLowerCase()) || out.scenarios.length >= GRAPH_LIMITS.scenarios) return;
    seen.add(name.toLowerCase());
    const settings = [];
    (Array.isArray(sc.settings) ? sc.settings : []).forEach(s => {
      if(!s || typeof s !== 'object' || typeof s.row !== 'string' || !s.row || s.row.length > 400) return;
      if((s.mode !== 'set' && s.mode !== 'shift') || settings.length >= GRAPH_LIMITS.settings) return;
      const value = graphNumber(s.value);
      if(value === null) return;
      settings.push({ row: s.row, name: graphText(s.name, GRAPH_LIMITS.rectName), mode: s.mode, periods: cleanGraphPeriods(s.periods, periodCount), value });
    });
    out.scenarios.push({ name, settings });
  });
  // The Dashboard's sliders: a range that isn't one, or a like slider again, is left out.
  (Array.isArray(src.sliders) ? src.sliders : []).forEach(s => {
    if(!s || typeof s !== 'object' || typeof s.row !== 'string' || !s.row || s.row.length > 400) return;
    if((s.mode !== 'set' && s.mode !== 'shift') || out.sliders.length >= GRAPH_LIMITS.sliders) return;
    const range = graphSliderRange(s);
    if(range.min === null) return;
    const periods = cleanGraphPeriods(s.periods, periodCount);
    if(out.sliders.some(x => x.row === s.row && x.mode === s.mode && JSON.stringify(x.periods) === JSON.stringify(periods))) return;
    out.sliders.push(Object.assign({ row: s.row, name: graphText(s.name, GRAPH_LIMITS.rectName), mode: s.mode, periods }, range));
  });
  // The Dashboard's charts: a kind not known, or a chart with no part, is left out.
  (Array.isArray(src.charts) ? src.charts : []).forEach(c => {
    if(!c || typeof c !== 'object' || Array.isArray(c) || !['bar', 'columns', 'lines', 'flow', 'free'].includes(c.kind)) return;
    if(out.charts.length >= GRAPH_LIMITS.items) return;
    const chart = { kind: c.kind, title: graphText(c.title, GRAPH_LIMITS.title), wide: c.wide === true, scale: graphScale(c.scale) };
    if(c.kind === 'flow' || c.kind === 'free'){ const n = Number(c.period); chart.period = Number.isInteger(n) && n >= 0 && n < Math.max(1, periodCount || 1) ? n : 0; }
    else chart.periods = cleanGraphPeriods(c.periods, periodCount);
    if(c.kind === 'columns') chart.groups = (Array.isArray(c.groups) ? c.groups : []).slice(0, GRAPH_LIMITS.groups).map(g => graphText(g, GRAPH_LIMITS.rectName));
    if(c.kind === 'free') chart.pieces = cleanGraphFreePieces(c.pieces);
    const most = c.kind === 'bar' ? 1 : c.kind === 'flow' ? GRAPH_LIMITS.steps : c.kind === 'lines' ? GRAPH_LIMITS.lines
      : c.kind === 'free' ? GRAPH_FREE_LIMITS.pieces * GRAPH_FREE_LIMITS.parts : GRAPH_LIMITS.groups * GRAPH_LIMITS.parts;
    chart.parts = [];
    (Array.isArray(c.parts) ? c.parts : []).forEach(x => {
      if(!x || typeof x !== 'object' || typeof x.row !== 'string' || !x.row || x.row.length > 400 || chart.parts.length >= most) return;
      const part = { row: x.row, name: graphText(x.name, GRAPH_LIMITS.rectName) };
      const colour = graphColour(x.colour);
      if(colour) part.colour = colour;
      if(c.kind === 'flow') part.role = GRAPH_FLOW_ROLES.includes(x.role) ? x.role : 'add';
      if(c.kind === 'columns'){
        const g = Number(x.group);
        if(!Number.isInteger(g) || g < 0 || g >= chart.groups.length) return;
        part.group = g;
      }
      if(c.kind === 'free'){
        const k = Number(x.piece);
        if(!Number.isInteger(k) || k < 0 || k >= chart.pieces.length || chart.parts.filter(y => y.piece === k).length >= GRAPH_FREE_LIMITS.parts) return;
        part.piece = k;
      }
      chart.parts.push(part);
    });
    if(chart.parts.length) out.charts.push(chart);
  });
  return out;
}
// Called when a model or a layout is read: settings on rows that are gone, or no longer
// inputs that can be moved, are dropped.
function reconcileGraph(){
  const g = cleanGraphCopy(mapping.cfg.graph, model.periods.length);
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  g.scenarios.forEach(sc => { sc.settings = sc.settings.filter(s => isSensitivityInputRow(byId.get(s.row))); });
  g.sliders = g.sliders.filter(s => isSensitivityInputRow(byId.get(s.row)));
  g.charts.forEach(c => { c.parts = c.parts.filter(x => byId.has(x.row) && !byId.get(x.row).isCustom); });
  g.charts = g.charts.filter(c => c.parts.length);
  mapping.cfg.graph = g;
  graphPlanCache = null;
}
function graphSlidersInLayout(){ return !!(mapping && mapping.cfg.graph && mapping.cfg.graph.sliders && mapping.cfg.graph.sliders.length); }
function graphChartsInLayout(){ return !!(mapping && mapping.cfg.graph && mapping.cfg.graph.charts && mapping.cfg.graph.charts.length); }
function graphScenariosInLayout(){ return !!(mapping && mapping.cfg.graph && mapping.cfg.graph.scenarios && mapping.cfg.graph.scenarios.length); }
