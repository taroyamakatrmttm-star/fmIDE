// ============================================================
// Sensitivity: the Tornado and Spider (step 16, docs/step16-sensitivity.md)
// ============================================================
// The person picks inputs to move (each by a % or by an amount, Low and High), the outputs
// (rectangles) to watch and a period. The workbook then gets a Sensitivity tab:
//   · each chosen input's own row on the Inputs tab becomes its base (a row above it, or its
//     scenarios) × (1 + a % change) + an amount change, both read from the Sensitivity tab —
//     0 unless that tab's "Input moved" cell names it, so the model shows its own numbers;
//   · one Excel Data Table (What-If Analysis) works the chosen output out with each input
//     moved to each point from Low (−n) through the base (0) to High (+n), live in Excel;
//   · the Tornado table (each input's Low and High against the base, the largest swing
//     first) and the Spider table (each input's line through every point) read that table.
// The numbers fmIDE's calculation gives (the shared IR, with the input's numbers laid over
// it) are written into the Data Table's cells too, so the file shows them before Excel has
// recalculated. Settings: mapping.cfg.sensitivity (cleanSensitivity), mapping file v3.
// ============================================================
const SENS_MAX_VARIABLES = 50, SENS_MAX_OUTPUTS = 20, SENS_MAX_STEPS = 10, SENS_DEFAULT_STEPS = 5;
const SENS_MAX_CHANGE = 1e9; // a Low or High beyond this is cut to it
const SENS_BY = ['percent', 'amount'];
const SENS_CHART_PLACES = ['tabs', 'sheet'];
const SENS_DEFAULT_CHANGE = { percent: [-10, 10], amount: [-1, 1] };

function defaultSensitivity(){
  return { enabled: false, outputs: [], period: 0, steps: SENS_DEFAULT_STEPS, charts: 'tabs', variables: [] };
}
// The settings from a saved layout or a mapping file (untrusted): kinds checked, numbers
// forced and bounded, ids kept as short text, nothing twice.
function cleanSensitivity(raw, periodCount){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = defaultSensitivity();
  out.enabled = src.enabled === true;
  const ids = (list, max) => {
    const seen = new Set(), res = [];
    (Array.isArray(list) ? list : []).forEach(id => {
      if(typeof id === 'string' && id && id.length <= 400 && !seen.has(id) && res.length < max){ seen.add(id); res.push(id); }
    });
    return res;
  };
  out.outputs = ids(src.outputs, SENS_MAX_OUTPUTS);
  const p = Math.round(Number(src.period));
  out.period = Number.isFinite(p) ? Math.max(0, Math.min(Math.max(0, (periodCount || 1) - 1), p)) : 0;
  const s = Math.round(Number(src.steps));
  out.steps = Number.isFinite(s) ? Math.max(1, Math.min(SENS_MAX_STEPS, s)) : SENS_DEFAULT_STEPS;
  out.charts = SENS_CHART_PLACES.includes(src.charts) ? src.charts : 'tabs';
  const seen = new Set();
  (Array.isArray(src.variables) ? src.variables : []).forEach(v => {
    if(!v || typeof v !== 'object' || typeof v.row !== 'string' || !v.row || v.row.length > 400 || seen.has(v.row)) return;
    if(out.variables.length >= SENS_MAX_VARIABLES) return;
    seen.add(v.row);
    const by = SENS_BY.includes(v.by) ? v.by : 'percent';
    const num = (x, d) => { const n = Number(x); return Number.isFinite(n) ? Math.max(-SENS_MAX_CHANGE, Math.min(SENS_MAX_CHANGE, n)) : d; };
    out.variables.push({ row: v.row, by, low: num(v.low, SENS_DEFAULT_CHANGE[by][0]), high: num(v.high, SENS_DEFAULT_CHANGE[by][1]) });
  });
  return out;
}
function sensCfg(){ return mapping.cfg.sensitivity; }

// An input that can be moved: a rectangle row whose numbers are typed, on a canvas that isn't
// a block (inside a block, or on the canvas a block is made from, every copy of the block
// shares it).
function isSensitivityInputRow(row){
  return !!row && !row.isInputMirror && !(row.path && row.path.length) && !isUsedAsBlock(row.canvasId) && isTrueInputRow(row);
}
// An output that can be watched: any rectangle row the workbook writes, other than an input
// on the Inputs tab.
function isSensitivityOutputRow(row){
  return !!row && !row.isCustom && !row.isInputMirror && row.include && !row.inlineConstant;
}
// Called when a model or a layout is read: settings cleaned, rows that are gone dropped.
function reconcileSensitivity(){
  const cfg = cleanSensitivity(mapping.cfg.sensitivity, model.periods.length);
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  cfg.outputs = cfg.outputs.filter(id => byId.has(id) && !byId.get(id).isCustom);
  cfg.variables = cfg.variables.filter(v => isSensitivityInputRow(byId.get(v.row)));
  mapping.cfg.sensitivity = cfg;
}

// What the workbook will hold, or { problem } saying why there is no Sensitivity tab:
// { variables: [{ spec, source, mirror }], outputs: [row], steps, period }.
function sensitivityPlan(){
  const cfg = mapping && mapping.cfg.sensitivity;
  if(!cfg || !cfg.enabled) return null;
  if(!inputsEnabled()) return { problem: 'Turn on “Gather inputs on a separate tab” (Inputs & scenarios): the inputs to move live there.' };
  const mirrors = new Map(inputMirrorRows().map(m => [m.sourceRowId, m]));
  const variables = [];
  cfg.variables.forEach(spec => {
    const source = mapping.rows.find(r => r.id === spec.row);
    const mirror = mirrors.get(spec.row);
    if(!source || !mirror || !source.include || source.inlineConstant || !isSensitivityInputRow(source)) return;
    if(mirror.tabId !== INPUTS_TAB_ID) return;
    variables.push({ spec, source, mirror });
  });
  const outputs = cfg.outputs.map(id => mapping.rows.find(r => r.id === id)).filter(isSensitivityOutputRow);
  if(!variables.length && !outputs.length) return { problem: 'Add the inputs to move and at least one output.' };
  if(!variables.length) return { problem: 'Add at least one input to move.' };
  if(!outputs.length) return { problem: 'Add at least one output.' };
  return { variables, outputs, steps: cfg.steps, period: Math.min(cfg.period, model.periods.length - 1), charts: cfg.charts };
}

// The points along each input's line: −n … −1 (towards Low), 0 (the base), 1 … n (towards High).
function sensPoints(steps){ const out = []; for(let p = -steps; p <= steps; p++) out.push(p); return out; }
// An input's change at point p (Low or High scaled by how far along it is).
function sensChangeAt(spec, p, steps){ return p < 0 ? spec.low * (-p) / steps : p > 0 ? spec.high * p / steps : 0; }

// ---------- fmIDE's own numbers for the Data Table ----------
// The chosen output's value in the chosen period, with each input moved to each point: the
// shared IR with the input's numbers laid over its typed ones for one run, then put back —
// the same numbers the Inputs tab's formula gives (blank = 0). { table: [[value|null]] },
// one row per variable, one column per point.
function sensitivityValues(plan, output, period){
  const ir = modelIR;
  const points = sensPoints(plan.steps);
  const nPeriods = model.periods.length;
  const inside = !!(output.path && output.path.length);
  const readOutput = (results) => outputValueFrom(ir, results, output, period);
  const run = () => readOutput(evaluateModel(ir, inside ? { instances: true } : undefined));
  const base = run();
  const table = plan.variables.map(v => {
    const n = irNode(v.source.canvasId, v.source.nodeId);
    return points.map(p => {
      if(p === 0 || !n || n.type !== 'value') return base;
      const change = sensChangeAt(v.spec, p, plan.steps);
      const saved = n.literal;
      try{
        const values = [];
        for(let q = 0; q < nPeriods; q++){
          const b = saved ? effectiveLiteral(saved, q) : null;
          const was = b === null ? 0 : b;
          values.push(v.spec.by === 'percent' ? was * (1 + change / 100) : was + change);
        }
        n.literal = { text: saved ? saved.text : '', periodValues: values };
        return run();
      } finally { n.literal = saved; }
    });
  });
  return { table, base };
}
// One row's value in one period from evaluateModel's results (null when it can't be worked out).
function outputValueFrom(ir, results, row, period){
  const num = (v) => typeof v === 'number' && isFinite(v) ? v : null;
  if(!row.path || !row.path.length){
    const i = ir.order.findIndex(c => c.id === row.canvasId);
    const vals = i >= 0 && results[i] && results[i].values[period];
    return vals ? num(vals[row.nodeId]) : null;
  }
  // Inside a block instance: the entry whose path is this row's (a vintage's own copy, or the
  // vertical instance's Total).
  let path = row.path;
  if(row.verticalShared) path = path.slice(0, -1).concat([Object.assign({}, path[path.length - 1], { vIndex: 1 })]);
  const want = pathKey(path, row.canvasId, row.nodeId);
  const list = (results.instances && results.instances[period]) || [];
  const hop = (h) => (typeof h.vintage === 'number') ? { canvasId: h.canvasId, nodeId: h.nodeId, vIndex: h.vintage } : { canvasId: h.canvasId, nodeId: h.nodeId };
  for(const e of list){
    if(!!e.combined !== !!row.verticalCombined) continue;
    if(pathKey(e.path.map(hop), e.canvasId, e.nodeId) === want) return num(e.value);
  }
  return null;
}

// ---------- The Sensitivity tab ----------
// Where everything sits, worked out before any tab is written (the Inputs tab's formulas
// point at the variables' rows): rows 4-8 the controls, then the outputs, the variables with
// the Data Table beside them, the Tornado table and the Spider table.
const SENS_COL = { no: 1, name: 2, uom: 3, by: 4, low: 5, high: 6, show: 7, now: 8, pct: 9, amt: 10, label: 11, corner: 13, firstPoint: 14 };
function sensitivityLayout(plan, sheetName){
  const K = plan.outputs.length, V = plan.variables.length, P = 2 * plan.steps + 1;
  const outHead = 12;
  const varHead = outHead + K + 2;
  const tornadoHead = varHead + V + 2;
  const spiderHead = tornadoHead + V + 2;
  const lastPoint = SENS_COL.firstPoint + P - 1;
  const cols = { lowD: lastPoint + 2, highD: lastPoint + 3, swing: lastPoint + 4, rank: lastPoint + 5 };
  return { sheetName, K, V, P, outHead, varHead, tornadoHead, spiderHead, lastPoint, cols,
    varRow: (i) => varHead + 1 + i,
    pctRef: (i, from) => sheetRef(sheetName, '$' + colLetter(SENS_COL.pct), varHead + 1 + i, from, true),
    amtRef: (i, from) => sheetRef(sheetName, '$' + colLetter(SENS_COL.amt), varHead + 1 + i, from, true) };
}

// A tab name for something ExcelExporter adds (unique among the tabs and `alsoTaken`).
function addedTabName(desired, alsoTaken){
  const taken = new Set(mapping.tabs.map(t => t.name.toLowerCase()).concat((alsoTaken || []).map(n => String(n).toLowerCase())));
  const base = sanitizeSheetName(desired);
  if(!taken.has(base.toLowerCase())) return base;
  for(let n = 2; ; n++){
    const cand = base.slice(0, 31 - (' ' + n).length).trim() + ' ' + n;
    if(!taken.has(cand.toLowerCase())) return cand;
  }
}

// Writes the Sensitivity tab. `ctx` (buildCtx) gives each output's and input's row.
function appendSensitivitySheet(wb, plan, lay, ctx, labels){
  const ws = {};
  const S = lay.sheetName;
  const L = (n) => colLetter(n);
  const HDR = (extra) => roleCellStyle('Headers', extra);
  const inputStyle = roleCellStyle('Inputs'), inputCenter = roleCellStyle('Inputs', CENTER);
  const linkStyle = roleCellStyle('Links'), calcStyle = roleCellStyle('Calculations');
  const noteStyle = roleCellStyle('Notes'), noteCenter = roleCellStyle('Notes', CENTER);
  const fmt = mapping.cfg.fallbackFormat || 'General';
  const nPeriods = model.periods.length;
  const firstP = L(periodCol(0)), lastP = L(periodCol(nPeriods - 1));
  const steps = plan.steps;
  const titleFont = { font: (roleCellStyle('Headers') || {}).font || {} };
  const K = lay.K, V = lay.V;
  const varA = lay.varHead + 1, varB = lay.varHead + V;
  const abs = (col, r) => '$' + L(col) + '$' + r;
  const range = (col) => abs(col, varA) + ':' + abs(col, varB);
  const inputsName = inputsTab().name;

  ws.A1 = { t: 's', v: S, s: mergeXlStyle(titleFont, { font: { sz: 13 } }) };
  ws.A2 = textCell('Pick the output and period in C4 and C5. Keep C6 at 0: the model then shows its own numbers. Change Low, High and Show (1 or 0) below; the Data Table works the rest out.', noteStyle);

  // Controls.
  const outPos = plan.outputs.map(r => ctx.cellPos[r.id]);
  const clampK = 'MIN(MAX($C$4,1),' + K + ')', clampN = 'MIN(MAX($C$5,1),' + nPeriods + ')';
  ws.A4 = textCell('Output (number)', calcStyle);
  ws.C4 = { t: 'n', v: 1, s: inputCenter };
  ws.D4 = { t: 's', f: 'INDEX($B$' + (lay.outHead + 1) + ':$B$' + (lay.outHead + K) + ',' + clampK + ')', v: plan.outputs[0].label || '', s: calcStyle };
  ws.A5 = textCell('Period (number)', calcStyle);
  ws.C5 = { t: 'n', v: plan.period + 1, s: inputCenter };
  ws.D5 = { t: 's', f: 'INDEX(' + sheetRef(outPos[0].tabName, '$' + firstP, '$2', S) + ':$' + lastP + '$2,' + clampN + ')', v: labels[plan.period] || '', s: calcStyle };
  ws.A6 = textCell('Input moved (0 = none)', calcStyle);
  ws.C6 = { t: 'n', v: 0, s: inputCenter };
  ws.D6 = { t: 's', f: 'IF($C$6=0,"OK - the model shows its own numbers","Set C6 back to 0 - the whole model now shows input "&$C$6&" moved")', v: 'OK - the model shows its own numbers', s: calcStyle };
  ws.A7 = textCell('Point (' + (-steps) + ' Low … 0 … ' + steps + ' High)', calcStyle);
  ws.C7 = { t: 'n', v: 0, s: inputCenter };
  ws.D7 = textCell('The Data Table moves C6 and C7 itself; leave them at 0.', noteStyle);
  ws.A8 = textCell('Output now', calcStyle);
  const pick = outPos.map(pos => 'INDEX(' + sheetRef(pos.tabName, '$' + firstP, '$' + pos.row, S) + ':$' + lastP + '$' + pos.row + ',1,' + clampN + ')');
  ws.C8 = { t: 'n', f: 'CHOOSE(' + clampK + ',' + pick.join(',') + ')', z: fmt, s: calcStyle };
  ws.A9 = textCell('Tornado title', noteStyle);
  ws.C9 = { t: 's', f: '"Tornado - "&$D$4&", "&$D$5', v: '', s: calcStyle };
  ws.A10 = textCell('Spider title', noteStyle);
  ws.C10 = { t: 's', f: '"Spider - "&$D$4&", "&$D$5', v: '', s: calcStyle };

  // Outputs.
  [['A', 'No'], ['B', 'Output'], ['C', 'UOM'], ['D', 'Tab']].forEach(([c, v]) => { ws[c + lay.outHead] = { t: 's', v, s: HDR() }; });
  plan.outputs.forEach((row, k) => {
    const r = lay.outHead + 1 + k, pos = outPos[k];
    ws['A' + r] = { t: 'n', v: k + 1, s: noteCenter };
    ws['B' + r] = { t: 's', f: sheetRef(pos.tabName, '$A', '$' + pos.row, S), v: row.label || '', s: linkStyle };
    ws['C' + r] = { t: 's', f: sheetRef(pos.tabName, '$B', '$' + pos.row, S) + '&""', v: '', s: linkStyle };
    ws['D' + r] = textCell(pos.tabName, noteStyle);
  });

  // Variables, and the Data Table beside them: the output at each point (columns) with each
  // input moved (rows). Its top row is the points, its left column the inputs' numbers.
  const vh = lay.varHead;
  [[SENS_COL.no, 'No'], [SENS_COL.name, 'Input variable'], [SENS_COL.uom, 'UOM'], [SENS_COL.by, 'Change by (% or amount)'],
   [SENS_COL.low, 'Low'], [SENS_COL.high, 'High'], [SENS_COL.show, 'Show (1/0)'], [SENS_COL.now, 'Change now'],
   [SENS_COL.pct, '% part'], [SENS_COL.amt, 'Amount part'], [SENS_COL.label, 'Label'],
   [lay.cols.lowD, 'Low vs base'], [lay.cols.highD, 'High vs base'], [lay.cols.swing, 'Swing'], [lay.cols.rank, 'Rank']]
    .forEach(([c, v]) => { ws[L(c) + vh] = { t: 's', v, s: HDR(CENTER) }; });
  ws[L(SENS_COL.corner) + (vh - 1)] = textCell('Data Table: the output with each input (down) moved to each point (across)', noteStyle);
  ws[L(SENS_COL.corner) + vh] = { t: 'n', f: '$C$8', z: fmt, s: HDR() };
  const points = sensPoints(steps);
  points.forEach((p, j) => { ws[L(SENS_COL.firstPoint + j) + vh] = { t: 'n', v: p, s: HDR(CENTER) }; });
  const cached = sensitivityValues(plan, plan.outputs[0], plan.period);
  const mid = SENS_COL.firstPoint + steps;
  plan.variables.forEach((v, i) => {
    const r = lay.varRow(i);
    const mPos = ctx.cellPos[v.mirror.id];
    const c = (col) => '$' + L(col) + r;
    ws[L(SENS_COL.no) + r] = { t: 'n', v: i + 1, s: noteCenter };
    ws[L(SENS_COL.name) + r] = { t: 's', f: sheetRef(inputsName, '$A', '$' + mPos.row, S), v: v.source.label || '', s: linkStyle };
    ws[L(SENS_COL.uom) + r] = { t: 's', f: sheetRef(inputsName, '$B', '$' + mPos.row, S) + '&""', v: '', s: linkStyle };
    ws[L(SENS_COL.by) + r] = { t: 's', v: v.spec.by === 'percent' ? '%' : 'amount', s: inputCenter };
    ws[L(SENS_COL.low) + r] = { t: 'n', v: v.spec.low, s: inputStyle };
    ws[L(SENS_COL.high) + r] = { t: 'n', v: v.spec.high, s: inputStyle };
    ws[L(SENS_COL.show) + r] = { t: 'n', v: 1, s: inputCenter };
    ws[L(SENS_COL.now) + r] = { t: 'n', f: 'IF($C$6=' + c(SENS_COL.no) + ',IF($C$7<0,' + c(SENS_COL.low) + '*(-$C$7)/' + steps + ',' + c(SENS_COL.high) + '*$C$7/' + steps + '),0)', s: calcStyle };
    ws[L(SENS_COL.pct) + r] = { t: 'n', f: 'IF(' + c(SENS_COL.by) + '="%",' + c(SENS_COL.now) + '/100,0)', s: calcStyle };
    ws[L(SENS_COL.amt) + r] = { t: 'n', f: 'IF(' + c(SENS_COL.by) + '="%",0,' + c(SENS_COL.now) + ')', s: calcStyle };
    const signed = (col) => 'IF(' + c(col) + '>0,"+","")&' + c(col) + '&IF(' + c(SENS_COL.by) + '="%","%","")';
    ws[L(SENS_COL.label) + r] = { t: 's', f: c(SENS_COL.name) + '&" ("&' + signed(SENS_COL.low) + '&" / "&' + signed(SENS_COL.high) + '&")"', v: '', s: calcStyle };
    ws[L(SENS_COL.corner) + r] = { t: 'n', v: i + 1, s: HDR(CENTER) };
    points.forEach((p, j) => {
      const val = cached.table[i][j];
      const cell = { t: 'n', z: fmt, s: calcStyle };
      if(val !== null) cell.v = val;
      if(i === 0 && j === 0){
        cell.dataTable = { ref: L(SENS_COL.firstPoint) + varA + ':' + L(lay.lastPoint) + varB, r1: 'C7', r2: 'C6' };
      } else if(val === null){
        cell.t = 'z';
      }
      ws[L(SENS_COL.firstPoint + j) + r] = cell;
    });
    ws[L(lay.cols.lowD) + r] = { t: 'n', f: L(SENS_COL.firstPoint) + r + '-' + L(mid) + r, z: fmt, s: calcStyle };
    ws[L(lay.cols.highD) + r] = { t: 'n', f: L(lay.lastPoint) + r + '-' + L(mid) + r, z: fmt, s: calcStyle };
    ws[L(lay.cols.swing) + r] = { t: 'n', f: 'ABS(' + L(lay.cols.lowD) + r + ')+ABS(' + L(lay.cols.highD) + r + ')', z: fmt, s: calcStyle };
    // Largest swing first; equal swings in the inputs' order. Only the inputs shown.
    const sw = range(lay.cols.swing), show = range(SENS_COL.show), no = range(SENS_COL.no);
    ws[L(lay.cols.rank) + r] = { t: 'n', f: 'IF(' + c(SENS_COL.show) + '=1,1+SUMPRODUCT((' + show + '=1)*((' + sw + '>' + c(lay.cols.swing) + ')+(' + sw + '=' + c(lay.cols.swing) + ')*(' + no + '<' + c(SENS_COL.no) + '))),"")', s: calcCenter() };
  });

  // Tornado: the inputs by rank, each one's Low and High against the base.
  const th = lay.tornadoHead;
  ws['A' + (th - 1)] = textCell('Tornado', mergeXlStyle(titleFont, { font: { sz: 12 } }));
  [['A', 'Rank'], ['B', 'Input variable'], ['C', 'Low vs base'], ['D', 'High vs base']].forEach(([c, v]) => { ws[c + th] = { t: 's', v, s: HDR() }; });
  const rankRange = range(lay.cols.rank);
  for(let k = 1; k <= V; k++){
    const r = th + k;
    const match = 'MATCH($A' + r + ',' + rankRange + ',0)';
    ws['A' + r] = { t: 'n', v: k, s: noteCenter };
    ws['B' + r] = { t: 's', f: 'IFERROR(INDEX(' + range(SENS_COL.label) + ',' + match + '),"")', v: '', s: calcStyle };
    ws['C' + r] = { t: 'n', f: 'IFERROR(INDEX(' + range(lay.cols.lowD) + ',' + match + '),NA())', z: fmt, s: calcStyle };
    ws['D' + r] = { t: 'n', f: 'IFERROR(INDEX(' + range(lay.cols.highD) + ',' + match + '),NA())', z: fmt, s: calcStyle };
  }

  // Spider: each input shown, its line through every point (#N/A when hidden: no line).
  const sh = lay.spiderHead;
  ws['A' + (sh - 1)] = textCell('Spider', mergeXlStyle(titleFont, { font: { sz: 12 } }));
  ws['A' + sh] = { t: 's', v: 'No', s: HDR() };
  ws['B' + sh] = { t: 's', v: 'Input variable', s: HDR() };
  ws[L(SENS_COL.corner) + sh] = textCell('Share of Low (−) / High (+)', HDR());
  points.forEach((p, j) => { ws[L(SENS_COL.firstPoint + j) + sh] = { t: 'n', v: p / steps, z: '+0%;-0%;0%', s: HDR(CENTER) }; });
  plan.variables.forEach((v, i) => {
    const r = sh + 1 + i, vr = lay.varRow(i);
    ws['A' + r] = { t: 'n', v: i + 1, s: noteCenter };
    ws['B' + r] = { t: 's', f: '$' + L(SENS_COL.name) + '$' + vr, v: v.source.label || '', s: calcStyle };
    points.forEach((p, j) => {
      const col = L(SENS_COL.firstPoint + j);
      ws[col + r] = { t: 'n', f: 'IF($' + L(SENS_COL.show) + '$' + vr + '=1,' + col + vr + ',NA())', z: fmt, s: calcStyle };
    });
  });

  const lastRow = sh + V;
  ws['!ref'] = 'A1:' + L(lay.cols.rank) + lastRow;
  const widths = [];
  widths[SENS_COL.no - 1] = 22; widths[SENS_COL.name - 1] = 24; widths[SENS_COL.uom - 1] = 10; widths[SENS_COL.by - 1] = 12;
  [SENS_COL.low, SENS_COL.high, SENS_COL.show, SENS_COL.now, SENS_COL.pct, SENS_COL.amt].forEach(c => { widths[c - 1] = 10; });
  widths[SENS_COL.label - 1] = 30; widths[SENS_COL.label] = 2; widths[SENS_COL.corner - 1] = 12;
  for(let c = SENS_COL.firstPoint; c <= lay.lastPoint; c++) widths[c - 1] = 11;
  widths[lay.lastPoint] = 2;
  [lay.cols.lowD, lay.cols.highD, lay.cols.swing, lay.cols.rank].forEach(c => { widths[c - 1] = 12; });
  ws['!cols'] = Array.from({ length: lay.cols.rank }, (_, i) => ({ wch: widths[i] || 10 }));
  XLSX.utils.book_append_sheet(wb, ws, S);
  return { ws, cached };

  function calcCenter(){ return roleCellStyle('Calculations', CENTER); }
}

// ---------- The charts (phase B) ----------
// The Tornado: a horizontal bar per input shown, its Low and High against the base, largest
// swing at the top. The Spider: a line per input shown, through every point. Both read the
// Sensitivity tab's tables (live), with fmIDE's numbers as what they show before Excel
// recalculates. On their own tabs (chart tabs) or on the Sensitivity tab, as chosen.
const SENS_SPIDER_COLOURS = ['2563EB', 'DC2626', '16A34A', 'D97706', '7C3AED', '0891B2', 'DB2777', '65A30D', '475569', 'EA580C'];
function sensitivityCharts(plan, lay, cached){
  const S = lay.sheetName, L = (n) => colLetter(n);
  const fmt = mapping.cfg.fallbackFormat || 'General';
  const ref = (col, r1, r2) => "'" + S.replace(/'/g, "''") + "'!$" + L(col) + '$' + r1 + (r2 ? ':$' + L(col) + '$' + r2 : '');
  const rowRef = (r, c1, c2) => "'" + S.replace(/'/g, "''") + "'!$" + L(c1) + '$' + r + ':$' + L(c2) + '$' + r;
  const V = lay.V, th = lay.tornadoHead, sh = lay.spiderHead;
  const steps = plan.steps, points = sensPoints(steps);
  // What the tables show now: fmIDE's numbers, sorted as the Rank column sorts them.
  const label = (v) => {
    const s = (x) => (x > 0 ? '+' : '') + x + (v.spec.by === 'percent' ? '%' : '');
    return (v.source.label || '') + ' (' + s(v.spec.low) + ' / ' + s(v.spec.high) + ')';
  };
  const rows = plan.variables.map((v, i) => {
    const t = cached.table[i], b = t[steps];
    const low = t[0] !== null && b !== null ? t[0] - b : null;
    const high = t[t.length - 1] !== null && b !== null ? t[t.length - 1] - b : null;
    return { i, label: label(v), low, high, swing: Math.abs(low || 0) + Math.abs(high || 0) };
  }).sort((a, b) => (b.swing - a.swing) || (a.i - b.i));
  const tornado = {
    type: 'bar', title: { ref: ref(3, 9), text: 'Tornado - ' + (plan.outputs[0].label || '') },
    bar: { dir: 'bar', overlap: 100, gapWidth: 40 },
    catAxis: { reverse: true }, valAxis: { title: 'Change from the base', numFmt: fmt },
    legend: 'b',
    series: [['Low vs base', 3, 'low', 'C0504D'], ['High vs base', 4, 'high', '4F81BD']].map(([name, col, key, color]) => ({
      name: { ref: ref(col, th), text: name },
      cat: { ref: ref(2, th + 1, th + V), values: rows.map(r => r.label) },
      val: { ref: ref(col, th + 1, th + V), values: rows.map(r => r[key]), numFmt: fmt },
      color })),
  };
  const spider = {
    type: 'line', title: { ref: ref(3, 10), text: 'Spider - ' + (plan.outputs[0].label || '') },
    catAxis: { title: 'Share of each input\'s Low (−) / High (+)', numFmt: '+0%;-0%;0%' },
    valAxis: { title: 'Output', numFmt: fmt },
    legend: 'r',
    series: plan.variables.map((v, i) => ({
      name: { ref: ref(2, sh + 1 + i), text: v.source.label || '' },
      cat: { ref: rowRef(sh, SENS_COL.firstPoint, lay.lastPoint), values: points.map(p => p / steps), numFmt: '+0%;-0%;0%' },
      val: { ref: rowRef(sh + 1 + i, SENS_COL.firstPoint, lay.lastPoint), values: cached.table[i], numFmt: fmt },
      color: SENS_SPIDER_COLOURS[i % SENS_SPIDER_COLOURS.length] })),
  };
  return { tornado, spider };
}

// Puts the two charts where the person chose: each on its own chart tab after the
// Sensitivity tab, or on that tab below the Spider table, side by side.
function placeSensitivityCharts(wb, plan, lay, sheet){
  const { tornado, spider } = sensitivityCharts(plan, lay, sheet.cached);
  if(plan.charts === 'sheet'){
    const top = lay.spiderHead + lay.V + 2; // 0-based: two rows below the Spider table
    sheet.ws['!charts'] = [
      { chart: tornado, from: { c: 0, r: top }, to: { c: 6, r: top + 24 } },
      { chart: spider, from: { c: 7, r: top }, to: { c: SENS_COL.firstPoint + 2 * plan.steps, r: top + 24 } },
    ];
    sheet.ws['!ref'] = 'A1:' + colLetter(lay.cols.rank) + (top + 25);
    return [];
  }
  const taken = wb.SheetNames.slice();
  const tName = addedTabName('Tornado', taken);
  XLSX.utils.book_append_chartsheet(wb, tornado, tName);
  const sName = addedTabName('Spider', taken.concat([tName]));
  XLSX.utils.book_append_chartsheet(wb, spider, sName);
  return [tName, sName];
}

// ---------- The panel (sidebar: Sensitivity) ----------
// Text only (names come from the loaded file): textContent everywhere.
function renderSensitivity(){
  const panel = $('sensitivityPanel');
  if(!panel || !mapping || !mapping.cfg.sensitivity) return;
  const cfg = sensCfg();
  $('cfgSensEnabled').checked = cfg.enabled;
  $('sensOptions').classList.toggle('hidden', !cfg.enabled);
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  const tabName = (r) => { const t = mapping.tabs.find(x => x.id === r.tabId); return t ? t.name : ''; };
  const rowText = (r) => (r.label || '(unnamed)') + (tabName(r) ? ' — ' + tabName(r) : '');

  // Outputs.
  const outList = $('sensOutputs');
  outList.textContent = '';
  cfg.outputs.forEach((id, k) => {
    const r = byId.get(id);
    if(!r) return;
    const line = document.createElement('div');
    line.className = 'sens-line';
    line.dataset.row = id;
    const name = document.createElement('span');
    name.className = 'sens-name';
    name.textContent = (k + 1) + '. ' + rowText(r);
    if(!isSensitivityOutputRow(r)){ name.classList.add('sens-off'); name.title = 'Not written to the workbook (excluded, or a Constant)'; }
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'icon sens-remove'; x.textContent = '×';
    x.title = 'Remove this output'; x.setAttribute('aria-label', 'Remove ' + (r.label || 'output'));
    x.addEventListener('click', () => { cfg.outputs = cfg.outputs.filter(o => o !== id); saveMapping(); renderSensitivity(); });
    line.append(name, x);
    outList.appendChild(line);
  });
  const outPick = $('sensOutputPick');
  outPick.textContent = '';
  outPick.appendChild(new Option('Add an output…', ''));
  const outIds = new Set(cfg.outputs);
  sensRowsInSheetOrder().filter(r => isSensitivityOutputRow(r) && !outIds.has(r.id)).forEach(r => outPick.appendChild(new Option(rowText(r), r.id)));
  outPick.disabled = cfg.outputs.length >= SENS_MAX_OUTPUTS;

  // Period.
  const per = $('cfgSensPeriod');
  per.textContent = '';
  periodLabels().forEach((lab, i) => per.appendChild(new Option(lab, String(i))));
  per.value = String(cfg.period);
  $('cfgSensSteps').value = cfg.steps;
  if($('cfgSensCharts')) $('cfgSensCharts').value = cfg.charts;

  // Inputs to move.
  const varList = $('sensVars');
  varList.textContent = '';
  cfg.variables.forEach((v, i) => {
    const r = byId.get(v.row);
    if(!r) return;
    const line = document.createElement('div');
    line.className = 'sens-line sens-var';
    line.dataset.row = v.row;
    const name = document.createElement('span');
    name.className = 'sens-name';
    name.textContent = (i + 1) + '. ' + (r.label || '(unnamed)');
    name.title = rowText(r);
    if(!r.include || r.inlineConstant){ name.classList.add('sens-off'); name.title += ' — not written to the workbook (excluded, or a Constant)'; }
    const by = document.createElement('select');
    by.className = 'sens-by';
    by.title = 'Move it by a percentage of its numbers, or by an amount added to them';
    by.append(new Option('%', 'percent'), new Option('amount', 'amount'));
    by.value = v.by;
    by.addEventListener('change', () => {
      v.by = SENS_BY.includes(by.value) ? by.value : 'percent';
      [v.low, v.high] = SENS_DEFAULT_CHANGE[v.by];
      saveMapping(); renderSensitivity();
    });
    const num = (key, label) => {
      const el = document.createElement('input');
      el.type = 'number'; el.step = 'any'; el.className = 'sens-' + key;
      el.value = v[key]; el.title = label + (v.by === 'percent' ? ' (% change)' : ' (amount added)');
      el.setAttribute('aria-label', label + ' for ' + (r.label || 'input'));
      el.addEventListener('change', () => {
        const n = Number(el.value);
        if(Number.isFinite(n)) v[key] = Math.max(-SENS_MAX_CHANGE, Math.min(SENS_MAX_CHANGE, n));
        el.value = v[key];
        saveMapping();
      });
      return el;
    };
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'icon sens-remove'; x.textContent = '×';
    x.title = 'Stop moving this input'; x.setAttribute('aria-label', 'Remove ' + (r.label || 'input'));
    x.addEventListener('click', () => { cfg.variables = cfg.variables.filter(o => o.row !== v.row); saveMapping(); renderSensitivity(); });
    const cap = (text) => { const c = document.createElement('span'); c.className = 'sens-cap'; c.textContent = text; return c; };
    line.append(name, x, by, cap('Low'), num('low', 'Low'), cap('High'), num('high', 'High'));
    varList.appendChild(line);
  });
  const varPick = $('sensVarPick');
  varPick.textContent = '';
  varPick.appendChild(new Option('Add an input…', ''));
  const have = new Set(cfg.variables.map(v => v.row));
  const candidates = sensRowsInSheetOrder().filter(r => isSensitivityInputRow(r) && r.include && !r.inlineConstant && !have.has(r.id));
  candidates.forEach(r => varPick.appendChild(new Option(rowText(r), r.id)));
  varPick.disabled = cfg.variables.length >= SENS_MAX_VARIABLES;
  $('btnSensAddAllVars').disabled = !candidates.length || cfg.variables.length >= SENS_MAX_VARIABLES;

  // Why there will be no Sensitivity tab, if there won't.
  const plan = cfg.enabled ? sensitivityPlan() : null;
  setStatus($('sensStatus'), plan && plan.problem ? plan.problem : '', 'warn');
}
// Real rectangle rows in the order the workbook shows them (tab order, then each tab's rows).
function sensRowsInSheetOrder(){
  const out = [];
  mapping.tabs.slice().sort((a, b) => a.order - b.order).forEach(t => {
    allRowsForTab(t.id).forEach(r => { if(!r.isCustom && !r.isInputMirror) out.push(r); });
  });
  // Rows on no tab's list (none expected) still count.
  mapping.rows.forEach(r => { if(!out.includes(r)) out.push(r); });
  return out;
}
function addSensitivityVariables(ids){
  const cfg = sensCfg();
  const have = new Set(cfg.variables.map(v => v.row));
  ids.forEach(id => {
    const r = mapping.rows.find(x => x.id === id);
    if(!isSensitivityInputRow(r) || have.has(id) || cfg.variables.length >= SENS_MAX_VARIABLES) return;
    have.add(id);
    cfg.variables.push({ row: id, by: 'percent', low: SENS_DEFAULT_CHANGE.percent[0], high: SENS_DEFAULT_CHANGE.percent[1] });
  });
  saveMapping(); renderSensitivity();
}

$('cfgSensEnabled').addEventListener('change', () => {
  sensCfg().enabled = $('cfgSensEnabled').checked;
  saveMapping(); renderSensitivity();
});
$('sensOutputPick').addEventListener('change', () => {
  const id = $('sensOutputPick').value;
  const cfg = sensCfg();
  if(id && !cfg.outputs.includes(id) && cfg.outputs.length < SENS_MAX_OUTPUTS && isSensitivityOutputRow(mapping.rows.find(r => r.id === id))){
    cfg.outputs.push(id);
    saveMapping();
  }
  renderSensitivity();
});
$('sensVarPick').addEventListener('change', () => {
  const id = $('sensVarPick').value;
  if(id) addSensitivityVariables([id]); else renderSensitivity();
});
$('btnSensAddAllVars').addEventListener('click', () => {
  addSensitivityVariables(sensRowsInSheetOrder().filter(r => isSensitivityInputRow(r) && r.include && !r.inlineConstant).map(r => r.id));
});
$('cfgSensPeriod').addEventListener('change', () => {
  const p = Math.round(Number($('cfgSensPeriod').value));
  sensCfg().period = Number.isFinite(p) ? Math.max(0, Math.min(model.periods.length - 1, p)) : 0;
  saveMapping();
});
$('cfgSensSteps').addEventListener('change', () => {
  const s = Math.round(Number($('cfgSensSteps').value));
  sensCfg().steps = Number.isFinite(s) ? Math.max(1, Math.min(SENS_MAX_STEPS, s)) : SENS_DEFAULT_STEPS;
  $('cfgSensSteps').value = sensCfg().steps;
  saveMapping();
});
if($('cfgSensCharts')) $('cfgSensCharts').addEventListener('change', () => {
  sensCfg().charts = SENS_CHART_PLACES.includes($('cfgSensCharts').value) ? $('cfgSensCharts').value : 'tabs';
  saveMapping();
});
