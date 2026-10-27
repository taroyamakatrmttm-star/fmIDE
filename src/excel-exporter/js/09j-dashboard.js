// ============================================================
// fmGraph's sliders → the Dashboard tab (step 19, phase B4; docs/step19-fmgraph-in-excel.md).
// Layout → Use fmGraph boards… copies the boards' sliders into the layout (cfg.graph.sliders,
// 04c-graph-boards.js). At Generate the copy — never the board file — becomes the Dashboard,
// the workbook's first tab, one row per slider:
//   Name (linked to the input) · Periods · Kind · a scroll bar · Position (its linked cell,
//   0 to at most 30,000) · Typed · Value = IF(ISNUMBER(Typed), Typed, MIN(Max, Min + Position × Step))
//   · a "Use" check box and its TRUE / FALSE cell (set sliders only) · Min · Max · Step.
// A set slider starts at fmIDE's number with Use off; a change by % starts at 0. So the
// workbook opens on fmIDE's numbers. On the Inputs tab, an input's own row lays the sliders over
// what its Global Case picks (or its base row), in the board's order and only in each slider's
// periods — set: IF(Use=TRUE, Value, …); change by %: (…)*(1+Value/100) — as fmGraph does,
// a later slider applying to what the earlier ones left; the sensitivity parts come after.
// Under the sliders, the boards' bars and charts as Excel charts (B5, cfg.graph.charts), in the
// board's order — wide ones the full width, narrow ones two to a row: a bar a column chart of its
// row; a lines chart an Excel line chart, a series per rectangle across its periods, straight from
// the rows; columns stacked columns (several groups: a small table beside the charts, one column per
// period and group, so each group stacks on its own); a flow a stacked-column waterfall over
// helper rows beside it (from column N, each table its title on a row of its own) — Value, From, To (the running total, as fmGraph works it out), the
// parts above and below 0, an invisible Base, then Total / Rise / Fall each above and below 0
// (Excel stacks the two signs apart) — all formulas, so the charts follow the sliders; a Free
// chart (phase F3, layout file 11) stacked columns over hidden fillers, one category per grid
// column, with its pieces, rectangles and series as helper rows beside it (dashFreeChart).
// ============================================================
const DASH_POSITIONS = 30000;  // the most a form-control scroll bar takes
const DASH_FIRST_ROW = 5;      // row 1 title, 2 the note, 4 the headers
const DASH_COL = { name: 'A', periods: 'B', kind: 'C', bar: 'D', pos: 'E', typed: 'F', value: 'G', box: 'H', use: 'I', min: 'J', max: 'K', step: 'L' };

// The Dashboard from the layout's copy (or `g`, a copy not yet used, for the window), or null:
// { rows: [{ slider, mirrorId, label, positions, step, grown, pos0, value0 }],
//   byMirror: Map(Inputs-tab row id → [row numbers into rows, in order]), notes: [text] }.
// `assumeInputs`: the Inputs tab will be turned on, so a row needs no Inputs-tab row yet.
function graphSliderPlan(g, assumeInputs){
  if(g === undefined){
    if(!mapping || !inputsEnabled() || !graphSlidersInLayout()) return null;
    g = mapping.cfg.graph;
  }
  if(!g || !g.sliders || !g.sliders.length) return null;
  const mirrors = new Map(inputMirrorRows().map(m => [m.sourceRowId, m]));
  const rows = [], byMirror = new Map(), notes = [], cantMove = [];
  g.sliders.forEach(s => {
    const source = mapping.rows.find(r => r.id === s.row);
    const mirror = mirrors.get(s.row);
    const ok = source && source.include && !source.inlineConstant && isSensitivityInputRow(source)
      && (assumeInputs ? true : (mirror && mirror.tabId === INPUTS_TAB_ID));
    const label = (source && source.label) || s.name || s.row;
    if(!ok){ if(!cantMove.includes(label)) cantMove.push(label); return; }
    const r = graphSliderRow(s, label);
    if(r.grown) notes.push('“' + label + '” has more than ' + DASH_POSITIONS.toLocaleString('en-US') + ' steps: its step grows to ' + r.step + '.');
    if(r.off) notes.push('“' + label + '” (change by %) can\'t be 0 on its steps: it starts at ' + r.value0 + '%.');
    const mirrorId = mirror ? mirror.id : null;
    if(mirrorId){
      if(!byMirror.has(mirrorId)) byMirror.set(mirrorId, []);
      byMirror.get(mirrorId).push(rows.length);
    }
    rows.push(Object.assign(r, { slider: s, mirrorId, label }));
  });
  const cantMoveNote = cantMove.length ? 'Sliders not on the Dashboard (not on the Inputs tab, left out or a constant): ' + cantMove.join(', ') + '.' : null;
  if(cantMoveNote) notes.push(cantMoveNote);
  return { rows, byMirror, notes, cantMoveNote };
}
// One slider's scroll bar: how many positions, the step (grown past 30,000 positions) and where
// it starts — fmIDE's number in its first period (set), else 0 (change by %), on the nearest
// step; `off` when a change by % can't start at 0.
function graphSliderRow(s, label){
  const span = s.max - s.min;
  let positions = Math.floor(span / s.step + 1e-9), step = s.step, grown = false;
  if(positions > DASH_POSITIONS){ positions = DASH_POSITIONS; step = Number((span / DASH_POSITIONS).toPrecision(12)); grown = true; }
  if(positions < 1){ positions = 1; step = span; }
  const want = s.mode === 'shift' ? 0 : graphInputNumber(s.row, graphFirstPeriod(s.periods));
  const pos0 = Math.max(0, Math.min(positions, Math.round((want - s.min) / step)));
  const value0 = Number(Math.min(s.max, s.min + pos0 * step).toPrecision(12));
  return { positions, step, grown, pos0, value0, off: s.mode === 'shift' && value0 !== 0 };
}
function graphSliderNotes(){ const p = graphSliderPlan(); return p ? p.notes : []; }

// The Inputs tab gathers each slider on an input into a row of its own under the input's base
// (idea 10): a set slider's row holds its Value while Use is ticked, else nothing; a change by
// % slider's row its Value as a fraction; both only in the slider's periods (blank elsewhere).
function dashSliderRowLabel(dash, i, labels){
  const s = dash.rows[i].slider;
  return (s.mode === 'set' ? 'Set to' : '% change') + ' (Dashboard, ' + graphPeriodsText(s.periods, labels) + ')';
}
// Slider i's cell in period p: a formula, or null outside its periods. `name` the Dashboard tab,
// `from` the tab written.
function dashSliderCell(dash, i, p, name, from){
  const s = dash.rows[i].slider;
  if(!graphPeriodsCover(s.periods, p)) return null;
  const value = sheetRef(name, '$' + DASH_COL.value, DASH_FIRST_ROW + i, from, true);
  if(s.mode === 'set') return 'IF(' + sheetRef(name, '$' + DASH_COL.use, DASH_FIRST_ROW + i, from, true) + '=TRUE,' + value + ',"")';
  return value + '/100';
}
// An input's own row in column `col` with its sliders' rows (from `firstRow`, in the board's
// order) laid over `base`: a set row's number replaces it, a change by % row multiplies it.
function dashboardSliders(dash, list, base, col, firstRow){
  return list.reduce((acc, i, k) => {
    const ref = col + (firstRow + k);
    return dash.rows[i].slider.mode === 'set' ? 'IF(ISNUMBER(' + ref + '),' + ref + ',' + acc + ')' : '(' + acc + ')*(1+' + ref + ')';
  }, base);
}

// ---------- The charts (step 19 B5) ----------
const DASH_CHART_ROWS = 18;  // a chart's height, in rows
const DASH_HALF_COL = 4;     // a narrow chart takes columns A–D or E–L
const DASH_LAST_COL = 12;    // a wide one A–L
const DASH_TABLE_COL = 14;   // the charts' data tables beside them: labels in N, figures from O (1-based)
const DASH_TABLE_WIDTHS = { label: 24, figure: 13 };
const DASH_FLOW_COLOURS = { total: '64748B', rise: '16A34A', fall: 'DC2626' };

// The layout's charts as the workbook writes them, or null: { charts: [chart, with only the
// parts the workbook writes, and its `name`], notes: [text] }.
function graphChartPlan(){
  if(!mapping || !graphChartsInLayout()) return null;
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  const charts = [], missing = [], gone = [], tooMany = [];
  mapping.cfg.graph.charts.forEach(c => {
    const parts = c.parts.filter(x => {
      const r = byId.get(x.row);
      if(isSensitivityOutputRow(r)) return true;
      const n = (r && r.label) || x.name || x.row;
      if(!missing.includes(n)) missing.push(n);
      return false;
    });
    if(!parts.length){ gone.push(graphChartName(c)); return; }
    if(c.kind === 'free' && graphFreeSeries(Object.assign({}, c, { parts })) > GRAPH_FREE_LIMITS.series){ tooMany.push(graphChartName(c)); return; }
    charts.push(Object.assign({}, c, { parts, name: graphChartName(c) }));
  });
  const notes = [];
  if(missing.length) notes.push('Not in the Dashboard\'s charts (left out of the workbook, or a constant): ' + missing.join(', ') + '.');
  if(gone.length) notes.push('Charts not written (none of their rows is in the workbook): ' + gone.join(', ') + '.');
  if(tooMany.length) notes.push('Free charts not written (an Excel chart holds at most ' + GRAPH_FREE_LIMITS.series + ' series): ' + tooMany.join(', ') + '.');
  return { charts, notes };
}
function graphChartNotes(){ const p = graphChartPlan(); return p ? p.notes : []; }

// fmIDE's number for a row in period p (what Excel shows before it recalculates), or null.
function dashNumbers(){
  const results = evaluateModel(modelIR);
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  return (rowId, p) => { const r = byId.get(rowId); return r ? outputValueFrom(modelIR, results, r, p) : null; };
}
// The periods a chart shows, in order.
function dashPeriods(periods){ return model.periods.map((_, p) => p).filter(p => graphPeriodsCover(periods, p)); }
// A range on a sheet for a chart: 'Tab'!$C$5:$H$5 (always with the sheet's name).
function dashRange(tab, c1, r1, c2, r2){
  return "'" + String(tab).replace(/'/g, "''") + "'!$" + c1 + '$' + r1 + (c2 ? ':$' + c2 + '$' + (r2 || r1) : '');
}
// The steps of a flow as fmGraph works them out: { value, from, to } each, from fmIDE's numbers.
function dashFlowFigures(c, num){
  let running = 0;
  return c.parts.map(x => {
    const v = num(x.row, c.period);
    if(v === null) return { value: null, from: null, to: null };
    let from, to;
    if(x.role === 'start' || x.role === 'total'){ from = 0; to = v; }
    else { from = running; to = x.role === 'subtract' ? running - v : running + v; }
    running = to;
    return { value: v, from, to };
  });
}
// A bar from `from` to `to` as Excel stacks it: the invisible base, then what shows above and
// below 0.
function dashFlowParts(from, to){
  if(from === null || to === null) return { base: null, above: null, below: null };
  const lo = Math.min(from, to), hi = Math.max(from, to);
  if(lo >= 0) return { base: lo, above: hi - lo, below: 0 };
  if(hi <= 0) return { base: hi, above: 0, below: lo - hi };
  return { base: 0, above: hi, below: lo };
}
// The rows of a flow's helper block, in order, by name.
const DASH_FLOW_ROWS = ['Value', 'From', 'To', 'Above 0', 'Below 0', 'Base (hidden)',
  'Total above 0', 'Total below 0', 'Rise above 0', 'Rise below 0', 'Fall above 0', 'Fall below 0'];

// ---------- fmGraph's Free chart (phase F3 of docs/fmgraph-free-chart.md) ----------
// Drawn as stacked columns, one category per grid column. Excel stacks positive numbers up from
// 0 and negative ones down from 0, each in the order of the series, so: per piece a hidden
// filler above 0 (from 0, or what the piece under it in its column was drawn to, up to its
// lowest point above 0) and one below 0; per rectangle four series — its part above 0 while it
// is negative, then while it is positive, its part below 0 while positive, then while negative —
// so a rectangle changing sign keeps its place in the stack (negatives hang down from where the
// piece sits, the last lowest; positives go up, the last highest). The pieces of a column stack
// in the order they rest on each other. A piece hanging back into the one under it can't be
// drawn so: it is drawn pushed aside, and its Overlaps cell says "overlaps" (the owner's choice
// 1a). Totals are in the helper table only (2a); the key lists each rectangle once (3a).
const DASH_FREE_ROWS = ['Column', 'Sits', 'Value', 'Up', 'Down', 'Sits at', 'Top', 'Bottom', 'End', 'Check',
  'Filler above 0', 'Drawn up to', 'Filler below 0', 'Drawn down to', 'Overlaps'];
const DASH_FREE_RECT_COLS = ['Value', 'From', 'To', 'Above 0', 'Below 0'];
// Excel's own series colours (the Office theme), for a rectangle the board gives none: the same
// colour on its four series.
const DASH_FREE_COLOURS = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '264478', '9E480E', '636363', '997300'];
// A piece's name as fmGraph shows it: its own, else its one rectangle's, else "Piece n"; "−" with Minus.
function dashFreeLabel(c, i){
  const p = c.pieces[i], parts = c.parts.filter(x => x.piece === i);
  return (p.minus ? '−' : '') + (p.name || (parts.length === 1 ? parts[0].name : '') || 'Piece ' + (i + 1));
}
// The pieces in the order Excel stacks them: in each column a piece after every one it rests on
// (through any chain), else in the list's order. → { order, under: [the piece drawn just before
// in its column, or -1] }
function dashFreeOrder(c){
  const ps = c.pieces;
  const depth = ps.map((p, i) => ps.filter((q, j) => j !== i && q.column === p.column && graphFreeOnChain(ps, i, j)).length);
  const order = ps.map((_, i) => i).sort((a, b) => depth[a] - depth[b] || a - b);
  const under = ps.map(() => -1);
  order.forEach((i, k) => { const before = order.slice(0, k).filter(j => ps[j].column === ps[i].column); under[i] = before.length ? before[before.length - 1] : -1; });
  return { order, under };
}
// What the helper rows hold, from fmIDE's numbers (Excel shows it until it recalculates), as
// fmGraph works it out: per piece { value, up, down, base, top, bottom, end, parts: [{ value,
// from, to, above, below }], check, fillerUp, drawnUp, fillerDown, drawnDown, overlaps } or null
// (a number that can't be worked out, or resting on one).
function dashFreeFigures(c, num){
  const ps = c.pieces, figs = ps.map(() => undefined);
  const figure = (i, depth) => {
    if(figs[i] !== undefined) return figs[i];
    if(depth > ps.length) return null;
    const p = ps[i];
    const vals = c.parts.filter(x => x.piece === i).map(x => { const v = num(x.row, c.period); return v === null ? null : p.minus ? -v : v; });
    let f = null;
    if(!vals.includes(null)){
      const up = vals.reduce((s, v) => s + Math.max(0, v), 0), down = vals.reduce((s, v) => s + Math.min(0, v), 0);
      const value = vals.reduce((s, v) => s + v, 0);
      const of = graphFreeRestsOn(ps, i);
      let base = 0;
      if(p.sits.on === 'level') base = p.sits.value;
      else if(of >= 0){ const o = figure(of, depth + 1); base = !o ? null : p.sits.on === 'end' ? o.end : (o.up > 0 || o.down === 0 ? o.top : o.bottom); }
      if(base !== null){
        let u = base, d = base;
        const parts = vals.map(v => {
          const from = v >= 0 ? u : d, to = from + v;
          if(v >= 0) u = to; else d = to;
          const lo = Math.min(from, to), hi = Math.max(from, to);
          return { value: v, from, to, above: Math.max(0, hi) - Math.max(0, lo), below: Math.min(0, lo) - Math.min(0, hi) };
        });
        f = { value, up, down, base, top: base + up, bottom: base + down, end: base + value, parts };
      }
    }
    figs[i] = f;
    return f;
  };
  ps.forEach((_, i) => figure(i, 0));
  const { order, under } = dashFreeOrder(c);
  order.forEach(i => {
    const f = figs[i];
    if(!f) return;
    const q = under[i] >= 0 ? figs[under[i]] : { drawnUp: 0, drawnDown: 0 };
    if(!q || q.drawnUp === null){ Object.assign(f, { fillerUp: null, drawnUp: null, fillerDown: null, drawnDown: null, overlaps: null }); return; }
    f.fillerUp = Math.max(0, Math.max(0, f.bottom) - q.drawnUp);
    f.drawnUp = q.drawnUp + f.fillerUp + f.parts.reduce((s, x) => s + x.above, 0);
    f.fillerDown = Math.min(0, Math.min(0, f.top) - q.drawnDown);
    f.drawnDown = q.drawnDown + f.fillerDown + f.parts.reduce((s, x) => s + x.below, 0);
    f.overlaps = (f.top > 0 && Math.max(0, f.bottom) < q.drawnUp - 1e-9) || (f.bottom < 0 && Math.min(0, f.top) > q.drawnDown + 1e-9);
  });
  ps.forEach((p, i) => {
    const f = figs[i];
    if(!f) return;
    const o = Number.isInteger(p.check) ? figs[p.check] : undefined;
    f.check = o === undefined ? null : !o ? null : Math.abs(f.value - o.end) <= 1e-6 * Math.max(1, Math.abs(f.value), Math.abs(o.end)) ? '✓' : '✗';
  });
  return { figs, order, under };
}
// The chart and its helper block (from row `top`, labels in column N): the pieces (a column
// each), the rectangles (a row each), then the chart's series (a row each, a column per grid
// column) — all formulas, so the chart follows the sliders.
function dashFreeChart(c, top, ctx, valAxis){
  const { sheet, cellPos, num, labels, styles } = ctx;
  const fmt = mapping.cfg.fallbackFormat || 'General';
  const L = (k) => colLetter(k), N = L(DASH_TABLE_COL);
  const ps = c.pieces, n = ps.length;
  const { figs, order, under } = dashFreeFigures(c, num);
  const rects = [];
  ps.forEach((_, i) => c.parts.forEach((x, j) => { if(x.piece === i) rects.push({ piece: i, part: x, k: rects.filter(r => r.piece === i).length }); }));
  const fig = (i) => figs[i];
  const rectFig = (r) => figs[r.piece] ? figs[r.piece].parts[r.k] : null;
  const columns = Math.max(...ps.map(p => p.column)) + 1;
  const head = top + 1;
  const PC = (i) => L(DASH_TABLE_COL + 1 + i);
  const PR = (name) => head + 1 + DASH_FREE_ROWS.indexOf(name);
  const rectHead = PR('Overlaps') + 2;
  const RC = (name) => L(DASH_TABLE_COL + 1 + DASH_FREE_RECT_COLS.indexOf(name));
  rects.forEach((r, k) => { r.row = rectHead + 1 + k; });
  const serHead = rectHead + rects.length + 2;
  const GC = (col) => L(DASH_TABLE_COL + 1 + col);
  // The series, in Excel's order (see above).
  const series = [];
  order.forEach(i => {
    const mine = rects.filter(r => r.piece === i), rev = mine.slice().reverse();
    series.push({ piece: i, filler: 'up' });
    rev.forEach(r => series.push({ piece: i, rect: r, side: 'Above 0', neg: true }));
    mine.forEach(r => series.push({ piece: i, rect: r, side: 'Above 0', neg: false }));
    series.push({ piece: i, filler: 'down' });
    rev.forEach(r => series.push({ piece: i, rect: r, side: 'Below 0', neg: false }));
    mine.forEach(r => series.push({ piece: i, rect: r, side: 'Below 0', neg: true }));
  });
  series.forEach((s, k) => { s.row = serHead + 1 + k; });
  const label = (i) => dashFreeLabel(c, i);
  const catNames = Array.from({ length: columns }, (_, col) => order.filter(i => ps[i].column === col).map(label).join(' / '));
  // A colour per rectangle: the board's, else Excel's own in turn.
  const colourOf = new Map();
  let spare = 0;
  c.parts.forEach(x => { if(!colourOf.has(x.row)) colourOf.set(x.row, x.colour ? x.colour.slice(1).toUpperCase() : DASH_FREE_COLOURS[spare++ % DASH_FREE_COLOURS.length]); });
  const seriesValue = (s) => {
    const f = fig(s.piece);
    if(!f) return null;
    if(s.filler) return s.filler === 'up' ? f.fillerUp : f.fillerDown;
    const q = rectFig(s.rect);
    return (s.neg ? q.value < 0 : q.value >= 0) ? (s.side === 'Above 0' ? q.above : q.below) : 0;
  };
  const cat = { ref: dashRange(sheet, GC(0), serHead, GC(columns - 1)), values: catNames };
  const seen = new Set();
  const chartSeries = series.map(s => {
    const val = { ref: dashRange(sheet, GC(0), s.row, GC(columns - 1)), values: catNames.map((_, col) => col === ps[s.piece].column ? seriesValue(s) : null), numFmt: fmt };
    if(s.filler) return { name: { text: label(s.piece) + (s.filler === 'up' ? ' filler above 0' : ' filler below 0') }, cat, val, noFill: true };
    const x = s.rect.part;
    const key = !s.neg && s.side === 'Above 0' && !seen.has(x.row);
    if(key) seen.add(x.row);
    return Object.assign({ name: { text: x.name }, cat, val, color: colourOf.get(x.row) }, key ? {} : { noLegend: true });
  });
  const chart = { type: 'bar', title: c.name, bar: { dir: 'col', grouping: 'stacked', gapWidth: 50 }, legend: 'b', valAxis, series: chartSeries };
  const write = (ws) => {
    const calc = (addr, f, v) => { ws[addr] = Object.assign({ t: 'n', f, s: styles.calc }, v === null || v === undefined ? {} : { v }); };
    const calcText = (addr, f, v) => { ws[addr] = Object.assign({ t: 's', f, s: styles.calc }, v ? { v } : {}); };
    ws[N + top] = textCell('Chart data: ' + c.name + ' (' + (labels[c.period] || '') + ')', styles.title);
    // The pieces.
    ws[N + head] = textCell('Piece', styles.head);
    DASH_FREE_ROWS.forEach(r => { ws[N + PR(r)] = textCell(r, styles.label); });
    ps.forEach((p, i) => {
      const C = PC(i), at = (r) => C + PR(r), f = fig(i);
      const mine = rects.filter(r => r.piece === i);
      const v = (k) => f ? f[k] : null;
      const sum = (wrap) => mine.length ? mine.map(r => wrap(RC('Value') + r.row)).join('+') : '0';
      ws[C + head] = textCell(label(i), styles.head);
      ws[at('Column')] = { t: 'n', v: p.column + 1, s: styles.calc };
      ws[at('Sits')] = textCell(p.sits.on === 'zero' ? 'on zero' : p.sits.on === 'level' ? 'at ' + p.sits.value
        : (p.sits.on === 'top' ? 'on top of ' : 'where ') + label(p.sits.of) + (p.sits.on === 'end' ? ' ends' : ''), styles.label);
      calc(at('Value'), sum(x => x), v('value'));
      calc(at('Up'), sum(x => 'MAX(0,' + x + ')'), v('up'));
      calc(at('Down'), sum(x => 'MIN(0,' + x + ')'), v('down'));
      const of = graphFreeRestsOn(ps, i), O = of >= 0 ? PC(of) : null;
      if(p.sits.on === 'level') ws[at('Sits at')] = { t: 'n', v: p.sits.value, s: styles.calc };
      else if(of < 0) ws[at('Sits at')] = { t: 'n', v: 0, s: styles.calc };
      else if(p.sits.on === 'end') calc(at('Sits at'), O + PR('End'), v('base'));
      else calc(at('Sits at'), 'IF(OR(' + O + PR('Up') + '>0,' + O + PR('Down') + '=0),' + O + PR('Top') + ',' + O + PR('Bottom') + ')', v('base'));
      calc(at('Top'), at('Sits at') + '+' + at('Up'), v('top'));
      calc(at('Bottom'), at('Sits at') + '+' + at('Down'), v('bottom'));
      calc(at('End'), at('Sits at') + '+' + at('Value'), v('end'));
      if(Number.isInteger(p.check) && ps[p.check]){
        const a = at('Value'), b = PC(p.check) + PR('End');
        calcText(at('Check'), 'IF(ABS(' + a + '-' + b + ')<=0.000001*MAX(1,ABS(' + a + '),ABS(' + b + ')),"✓","✗")', v('check'));
      }
      const q = under[i];
      const upTo = q < 0 ? '0' : PC(q) + PR('Drawn up to'), downTo = q < 0 ? '0' : PC(q) + PR('Drawn down to');
      const sumOf = (col) => mine.length ? '+' + mine.map(r => RC(col) + r.row).join('+') : '';
      calc(at('Filler above 0'), 'MAX(0,MAX(0,' + at('Bottom') + ')-' + upTo + ')', v('fillerUp'));
      calc(at('Drawn up to'), upTo + '+' + at('Filler above 0') + sumOf('Above 0'), v('drawnUp'));
      calc(at('Filler below 0'), 'MIN(0,MIN(0,' + at('Top') + ')-' + downTo + ')', v('fillerDown'));
      calc(at('Drawn down to'), downTo + '+' + at('Filler below 0') + sumOf('Below 0'), v('drawnDown'));
      calcText(at('Overlaps'), 'IF(OR(AND(' + at('Top') + '>0,MAX(0,' + at('Bottom') + ')<' + upTo + '-0.000000001),AND(' +
        at('Bottom') + '<0,MIN(0,' + at('Top') + ')>' + downTo + '+0.000000001)),"overlaps","")', f && f.overlaps ? 'overlaps' : '');
    });
    // The rectangles: positives up from where the piece sits, negatives down, in order.
    ws[N + rectHead] = textCell('Rectangle', styles.head);
    DASH_FREE_RECT_COLS.forEach(h => { ws[RC(h) + rectHead] = textCell(h, styles.head); });
    rects.forEach(r => {
      const p = ps[r.piece], row = r.row, base = PC(r.piece) + PR('Sits at'), q = rectFig(r);
      const pos = cellPos[r.part.row];
      const before = rects.filter(y => y.piece === r.piece && y.k < r.k).map(y => RC('Value') + y.row);
      const V = RC('Value') + row, F = RC('From') + row, T = RC('To') + row;
      ws[N + row] = textCell(label(r.piece) + ' · ' + r.part.name, styles.label);
      ws[V] = Object.assign({ t: 'n', f: (p.minus ? '-' : '') + sheetRef(pos.tabName, '$' + colLetter(periodCol(c.period)), pos.row, sheet, true), s: styles.link }, q ? { v: q.value } : {});
      calc(F, before.length ? base + '+IF(' + V + '>=0,' + before.map(x => 'MAX(0,' + x + ')').join('+') + ',' + before.map(x => 'MIN(0,' + x + ')').join('+') + ')' : base, q && q.from);
      calc(T, F + '+' + V, q && q.to);
      calc(RC('Above 0') + row, 'MAX(0,MAX(' + F + ',' + T + '))-MAX(0,MIN(' + F + ',' + T + '))', q && q.above);
      calc(RC('Below 0') + row, 'MIN(0,MIN(' + F + ',' + T + '))-MIN(0,MAX(' + F + ',' + T + '))', q && q.below);
    });
    // The chart's series: each only in its piece's column.
    ws[N + serHead] = textCell('Series', styles.head);
    catNames.forEach((name, col) => { ws[GC(col) + serHead] = textCell(name, styles.head); });
    series.forEach(s => {
      const cell = GC(ps[s.piece].column) + s.row, P = PC(s.piece);
      if(s.filler){
        ws[N + s.row] = textCell(label(s.piece) + (s.filler === 'up' ? ' · filler above 0 (hidden)' : ' · filler below 0 (hidden)'), styles.label);
        calc(cell, P + PR(s.filler === 'up' ? 'Filler above 0' : 'Filler below 0'), seriesValue(s));
        return;
      }
      const r = s.rect;
      ws[N + s.row] = textCell(label(s.piece) + ' · ' + r.part.name + ' · ' + (s.side === 'Above 0' ? 'above 0' : 'below 0') + (s.neg ? ', while negative' : ', while positive'), styles.label);
      calc(cell, 'IF(' + RC('Value') + r.row + (s.neg ? '<0,' : '>=0,') + RC(s.side) + r.row + ',0)', seriesValue(s));
    });
  };
  const rows = serHead + series.length - top + 1;
  return { chart, block: { rows, cols: DASH_TABLE_COL + Math.max(n, DASH_FREE_RECT_COLS.length, columns), write } };
}

// One chart: { chart, block: { rows: n, cols: n, write(ws) } | null }. Its data table sits beside
// the charts from row `top`: the title on its own row, then the names, then the figures — labels in
// column N (DASH_TABLE_COL), figures from O, columns of their own width.
function dashChart(c, top, ctx){
  const { sheet, cellPos, num, labels, styles } = ctx;
  const fmt = mapping.cfg.fallbackFormat || 'General';
  const hex = (col) => col ? col.slice(1).toUpperCase() : undefined;
  const valAxis = Object.assign({ numFmt: fmt }, c.scale ? { min: c.scale.min, max: c.scale.max } : {});
  const L = (k) => colLetter(k);
  if(c.kind === 'free') return dashFreeChart(c, top, ctx, valAxis);
  if(c.kind === 'flow'){
    const n = c.parts.length, figs = dashFlowFigures(c, num);
    const col = (k) => L(DASH_TABLE_COL + 1 + k), first = col(0), last = col(n - 1), head = top + 1;
    const R = (name) => head + 1 + DASH_FLOW_ROWS.indexOf(name);
    const cat = { ref: dashRange(sheet, first, head, last), values: c.parts.map(x => x.name) };
    const parts = figs.map(f => dashFlowParts(f.from, f.to));
    const isTotal = (x) => x.role === 'start' || x.role === 'total';
    const kindOf = (x, f) => isTotal(x) ? 'total' : (f.to !== null && f.to >= f.from ? 'rise' : 'fall');
    const valuesOf = (kind, side) => c.parts.map((x, k) => parts[k][side] === null ? null : kindOf(x, figs[k]) === kind ? parts[k][side] : 0);
    const points = c.parts.map((x, k) => x.colour ? { idx: k, color: hex(x.colour) } : null).filter(Boolean);
    const series = [{ name: { text: 'Base' }, cat, val: { ref: dashRange(sheet, first, R('Base (hidden)'), last), values: parts.map(q => q.base), numFmt: fmt }, noFill: true }];
    [['total', 'Total'], ['rise', 'Rise'], ['fall', 'Fall']].forEach(([kind, label]) => [['above', ' above 0'], ['below', ' below 0']].forEach(([side, text], j) => {
      series.push({ name: { text: label }, cat, val: { ref: dashRange(sheet, first, R(label + text), last), values: valuesOf(kind, side), numFmt: fmt },
        color: DASH_FLOW_COLOURS[kind], points, noLegend: j === 1 });
    }));
    const chart = { type: 'bar', title: c.name, bar: { dir: 'col', grouping: 'stacked', gapWidth: 50 }, legend: 'b', valAxis, series };
    const write = (ws) => {
      ws[L(DASH_TABLE_COL) + top] = textCell('Chart data: ' + c.name + ' (' + (labels[c.period] || '') + ')', styles.title);
      ws[L(DASH_TABLE_COL) + head] = textCell('Step', styles.head);
      DASH_FLOW_ROWS.forEach(r => { ws[L(DASH_TABLE_COL) + R(r)] = textCell(r, styles.label); });
      c.parts.forEach((x, k) => {
        const C = col(k), f = figs[k], q = parts[k];
        const at = (r) => C + R(r);
        const F = at('From'), T = at('To'), V = at('Value'), A = at('Above 0'), B = at('Below 0');
        const pos = cellPos[x.row];
        ws[C + head] = textCell(x.name, styles.head);
        ws[V] = { t: 'n', f: sheetRef(pos.tabName, '$' + colLetter(periodCol(c.period)), pos.row, sheet, true), v: f.value, s: styles.link };
        const calc = (r, formula, v) => { ws[at(r)] = Object.assign({ t: 'n', f: formula, s: styles.calc }, v === null ? {} : { v }); };
        const zero = (r) => { ws[at(r)] = { t: 'n', v: 0, s: styles.calc }; };
        if(isTotal(x)){ zero('From'); calc('To', V, f.to); }
        else {
          if(k === 0) zero('From'); else calc('From', col(k - 1) + R('To'), f.from);
          calc('To', F + (x.role === 'subtract' ? '-' : '+') + V, f.to);
        }
        const lo = 'MIN(' + F + ',' + T + ')', hi = 'MAX(' + F + ',' + T + ')';
        calc('Above 0', 'IF(' + lo + '>=0,' + hi + '-' + lo + ',IF(' + hi + '<=0,0,' + hi + '))', q.above);
        calc('Below 0', 'IF(' + lo + '>=0,0,IF(' + hi + '<=0,' + lo + '-' + hi + ',' + lo + '))', q.below);
        calc('Base (hidden)', 'IF(' + lo + '>=0,' + lo + ',IF(' + hi + '<=0,' + hi + ',0))', q.base);
        const kind = kindOf(x, f);
        [['Total', 'total'], ['Rise', 'rise'], ['Fall', 'fall']].forEach(([label, k2]) => {
          if(isTotal(x) !== (k2 === 'total')){ zero(label + ' above 0'); zero(label + ' below 0'); return; }
          const when = k2 === 'total' ? null : k2 === 'rise' ? T + '>=' + F : T + '<' + F;
          const pick = (cell, v) => when ? 'IF(' + when + ',' + cell + ',0)' : cell;
          const v = (side) => q[side] === null ? null : kind === k2 ? q[side] : 0;
          calc(label + ' above 0', pick(A), v('above'));
          calc(label + ' below 0', pick(B), v('below'));
        });
      });
    };
    return { chart, block: { rows: 2 + DASH_FLOW_ROWS.length, cols: DASH_TABLE_COL + n, write } };
  }
  const ps = dashPeriods(c.periods);
  const groups = c.kind === 'columns' ? c.groups : [];
  const series = [];
  let block = null;
  if(groups.length > 1){
    // Several groups: one column per period and group, each part only in its group's columns.
    const cols = [];
    ps.forEach(p => groups.forEach((g, gi) => cols.push({ p, gi, label: (labels[p] || '') + ' · ' + (g || 'Group ' + (gi + 1)) })));
    const first = L(DASH_TABLE_COL + 1), last = L(DASH_TABLE_COL + cols.length), head = top + 1;
    const cat = { ref: dashRange(sheet, first, head, last), values: cols.map(x => x.label) };
    c.parts.forEach((x, i) => {
      series.push({ name: { text: x.name }, cat, color: hex(x.colour),
        val: { ref: dashRange(sheet, first, head + 1 + i, last), values: cols.map(q => q.gi === x.group ? num(x.row, q.p) : null), numFmt: fmt } });
    });
    block = { rows: 2 + c.parts.length, cols: DASH_TABLE_COL + cols.length, write: (ws) => {
      ws[L(DASH_TABLE_COL) + top] = textCell('Chart data: ' + c.name, styles.title);
      ws[L(DASH_TABLE_COL) + head] = textCell('Part', styles.head);
      cols.forEach((q, k) => { ws[L(DASH_TABLE_COL + 1 + k) + head] = textCell(q.label, styles.head); });
      c.parts.forEach((x, i) => {
        const r = head + 1 + i, pos = cellPos[x.row];
        ws[L(DASH_TABLE_COL) + r] = textCell(x.name, styles.label);
        cols.forEach((q, k) => {
          if(q.gi !== x.group) return;
          const v = num(x.row, q.p);
          ws[L(DASH_TABLE_COL + 1 + k) + r] = Object.assign({ t: 'n', f: sheetRef(pos.tabName, '$' + colLetter(periodCol(q.p)), pos.row, sheet, true), s: styles.link }, v === null ? {} : { v });
        });
      });
    } };
  } else {
    // A bar, or one group: each series straight from its row, the periods from its tab's row 2.
    const c1 = colLetter(periodCol(ps[0])), c2 = colLetter(periodCol(ps[ps.length - 1]));
    c.parts.forEach(x => {
      const pos = cellPos[x.row];
      series.push({ name: { text: x.name }, color: hex(x.colour),
        cat: { ref: dashRange(pos.tabName, c1, 2, c2), values: ps.map(p => labels[p] || '') },
        val: { ref: dashRange(pos.tabName, c1, pos.row, c2), values: ps.map(p => num(x.row, p)), numFmt: fmt } });
    });
  }
  // A lines chart (board file 10): a line per rectangle, its points marked.
  if(c.kind === 'lines') return { chart: { type: 'line', title: c.name, legend: 'b', valAxis, series }, block };
  const chart = { type: 'bar', title: c.name, bar: { dir: 'col', grouping: c.kind === 'columns' ? 'stacked' : 'clustered', gapWidth: 60 },
    legend: c.kind === 'columns' ? 'b' : null, valAxis, series };
  return { chart, block };
}
// Places the charts from row `first` (1-based) down, each row of charts one wide or two narrow;
// their data tables beside them from column N, each from its chart's first row (or under the
// table before, when that one is longer). Returns the last row used and column count.
function placeDashboardCharts(ws, charts, first, ctx){
  const anchors = [];
  let r = first, maxCol = DASH_LAST_COL, tables = first;
  for(let i = 0; i < charts.length;){
    const row = charts[i].wide || i + 1 >= charts.length || charts[i + 1].wide ? [charts[i]] : [charts[i], charts[i + 1]];
    i += row.length;
    const made = row.map(c => {
      const top = Math.max(r, tables);
      const ch = dashChart(c, top, ctx);
      if(ch.block) tables = top + ch.block.rows + 1;
      return ch;
    });
    made.forEach((ch, k) => {
      const narrow = row.length === 2 || !row[k].wide;
      const c1 = narrow && k === 1 ? DASH_HALF_COL : 0, c2 = narrow ? (k === 1 ? DASH_LAST_COL : DASH_HALF_COL) : DASH_LAST_COL;
      anchors.push({ chart: ch.chart, from: { c: c1, r: r - 1 }, to: { c: c2, r: r - 1 + DASH_CHART_ROWS } });
      if(ch.block){ ch.block.write(ws); maxCol = Math.max(maxCol, ch.block.cols); }
    });
    r += DASH_CHART_ROWS + 1;
  }
  ws['!charts'] = anchors;
  return { lastRow: Math.max(r, tables), maxCol };
}

// Writes the Dashboard tab (and puts it first). `ownRow`: Inputs-tab row id → { tabName, row };
// `charts`: graphChartPlan's charts with only the parts written (cellPos: row id → { tabName, row }).
function appendDashboardSheet(wb, dash, name, ownRow, charts, cellPos){
  dash = dash || { rows: [] };
  const ws = {};
  const C = DASH_COL;
  const hdr = (extra) => roleCellStyle('Headers', extra);
  const CENTER = { alignment: { horizontal: 'center' } };
  const inputStyle = roleCellStyle('Inputs'), inputCenter = roleCellStyle('Inputs', CENTER);
  const calcStyle = roleCellStyle('Calculations'), linkStyle = roleCellStyle('Links'), noteStyle = roleCellStyle('Notes');
  const labels = periodLabels();
  ws.A1 = { t: 's', v: name, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) };
  if(dash.rows.length){
  ws.A2 = textCell('Scroll bars and check boxes don\'t show in Excel on the web, on an iPad or iPhone, or always in LibreOffice: type in Typed and Use instead.', noteStyle);
  [['name', 'Slider'], ['periods', 'Periods'], ['kind', 'Kind'], ['bar', 'Scroll bar'], ['pos', 'Position'], ['typed', 'Typed'],
    ['value', 'Value'], ['box', ''], ['use', 'Use'], ['min', 'Min'], ['max', 'Max'], ['step', 'Step']]
    .forEach(([k, v]) => { ws[C[k] + '4'] = { t: 's', v, s: hdr(k === 'name' || k === 'periods' || k === 'kind' ? null : CENTER) }; });
  }
  const controls = [];
  const col = (k) => C[k].charCodeAt(0) - 65; // 0-based (columns A–L)
  dash.rows.forEach((d, i) => {
    const r = DASH_FIRST_ROW + i;
    const s = d.slider;
    const own = d.mirrorId && ownRow[d.mirrorId];
    // The name: the input's own label on the Inputs tab (text from the file: a link, or plain text).
    ws[C.name + r] = own ? { t: 's', f: sheetRef(own.tabName, '$A', own.row, name, true), v: d.label, s: linkStyle } : textCell(d.label, linkStyle);
    ws[C.periods + r] = textCell(graphPeriodsText(s.periods, labels), noteStyle);
    ws[C.kind + r] = textCell(s.mode === 'shift' ? 'Change by %' : 'Set to', noteStyle);
    ws[C.bar + r] = blankCell(noteStyle);
    ws[C.pos + r] = { t: 'n', v: d.pos0, s: inputCenter };
    ws[C.typed + r] = blankCell(inputStyle);
    const typed = C.typed + r;
    ws[C.value + r] = { t: 'n', f: 'IF(ISNUMBER(' + typed + '),' + typed + ',MIN(' + C.max + r + ',' + C.min + r + '+' + C.pos + r + '*' + C.step + r + '))', v: d.value0, s: calcStyle };
    ws[C.min + r] = { t: 'n', v: s.min, s: inputStyle };
    ws[C.max + r] = { t: 'n', v: s.max, s: inputStyle };
    ws[C.step + r] = { t: 'n', v: d.step, s: inputStyle };
    controls.push({ type: 'scroll', from: { c: col('bar'), r: r - 1 }, to: { c: col('bar') + 1, r }, cell: C.pos + r,
      min: 0, max: d.positions, inc: 1, page: Math.max(1, Math.round(d.positions / 10)), val: d.pos0, horiz: true });
    if(s.mode === 'set'){
      ws[C.box + r] = blankCell(noteStyle);
      ws[C.use + r] = { t: 'b', v: false, s: inputCenter };
      controls.push({ type: 'check', from: { c: col('box'), r: r - 1 }, to: { c: col('box') + 1, r }, cell: C.use + r, checked: false, text: 'Use' });
    }
  });
  if(controls.length) ws['!controls'] = controls;
  let lastRow = dash.rows.length ? DASH_FIRST_ROW + dash.rows.length - 1 : 1, lastCol = DASH_LAST_COL;
  if(charts && charts.length){
    const placed = placeDashboardCharts(ws, charts, dash.rows.length ? lastRow + 2 : 3, {
      sheet: name, cellPos, num: dashNumbers(), labels,
      styles: { title: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { bold: true } }), head: hdr(), label: roleCellStyle('Labels'), link: linkStyle, calc: calcStyle } });
    lastRow = placed.lastRow; lastCol = placed.maxCol;
  }
  ws['!ref'] = 'A1:' + colLetter(lastCol) + Math.max(4, lastRow);
  ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  // The charts' data tables: a narrow gap (M), the labels (N), then the figures, each its own width.
  if(lastCol > DASH_LAST_COL){
    ws['!cols'].push({ wch: 3 }, { wch: DASH_TABLE_WIDTHS.label });
    for(let k = DASH_TABLE_COL + 1; k <= lastCol; k++) ws['!cols'].push({ wch: DASH_TABLE_WIDTHS.figure });
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
  wb.SheetNames.unshift(wb.SheetNames.pop()); // the Dashboard first
}
