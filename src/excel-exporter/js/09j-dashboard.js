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
// row; columns stacked columns (several groups: a small table beside the charts, one column per
// period and group, so each group stacks on its own); a flow a stacked-column waterfall over
// helper rows beside it (from column N, each table its title on a row of its own) — Value, From, To (the running total, as fmGraph works it out), the
// parts above and below 0, an invisible Base, then Total / Rise / Fall each above and below 0
// (Excel stacks the two signs apart) — all formulas, so the charts follow the sliders.
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

// An input's own row in period p with the sliders laid over `base` (a formula or a reference),
// in their order; `name` the Dashboard tab, `from` the tab written.
function dashboardSliders(dash, list, base, p, name, from){
  return list.reduce((acc, i) => {
    const r = dash.rows[i];
    if(!graphPeriodsCover(r.slider.periods, p)) return acc;
    const value = sheetRef(name, '$' + DASH_COL.value, DASH_FIRST_ROW + i, from, true);
    if(r.slider.mode === 'set') return 'IF(' + sheetRef(name, '$' + DASH_COL.use, DASH_FIRST_ROW + i, from, true) + '=TRUE,' + value + ',' + acc + ')';
    return '(' + acc + ')*(1+' + value + '/100)';
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
  const charts = [], missing = [], gone = [];
  mapping.cfg.graph.charts.forEach(c => {
    const parts = c.parts.filter(x => {
      const r = byId.get(x.row);
      if(isSensitivityOutputRow(r)) return true;
      const n = (r && r.label) || x.name || x.row;
      if(!missing.includes(n)) missing.push(n);
      return false;
    });
    if(!parts.length){ gone.push(graphChartName(c)); return; }
    charts.push(Object.assign({}, c, { parts, name: graphChartName(c) }));
  });
  const notes = [];
  if(missing.length) notes.push('Not in the Dashboard\'s charts (left out of the workbook, or a constant): ' + missing.join(', ') + '.');
  if(gone.length) notes.push('Charts not written (none of their rows is in the workbook): ' + gone.join(', ') + '.');
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

// One chart: { chart, block: { rows: n, cols: n, write(ws) } | null }. Its data table sits beside
// the charts from row `top`: the title on its own row, then the names, then the figures — labels in
// column N (DASH_TABLE_COL), figures from O, columns of their own width.
function dashChart(c, top, ctx){
  const { sheet, cellPos, num, labels, styles } = ctx;
  const fmt = mapping.cfg.fallbackFormat || 'General';
  const hex = (col) => col ? col.slice(1).toUpperCase() : undefined;
  const valAxis = Object.assign({ numFmt: fmt }, c.scale ? { min: c.scale.min, max: c.scale.max } : {});
  const L = (k) => colLetter(k);
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
