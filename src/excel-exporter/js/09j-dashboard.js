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

// Writes the Dashboard tab (and puts it first). `ownRow`: Inputs-tab row id → { tabName, row }.
function appendDashboardSheet(wb, dash, name, ownRow){
  const ws = {};
  const C = DASH_COL;
  const hdr = (extra) => roleCellStyle('Headers', extra);
  const CENTER = { alignment: { horizontal: 'center' } };
  const inputStyle = roleCellStyle('Inputs'), inputCenter = roleCellStyle('Inputs', CENTER);
  const calcStyle = roleCellStyle('Calculations'), linkStyle = roleCellStyle('Links'), noteStyle = roleCellStyle('Notes');
  const labels = periodLabels();
  ws.A1 = { t: 's', v: name, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) };
  ws.A2 = textCell('Scroll bars and check boxes don\'t show in Excel on the web, or always in LibreOffice: type in Typed and Use instead.', noteStyle);
  [['name', 'Slider'], ['periods', 'Periods'], ['kind', 'Kind'], ['bar', 'Scroll bar'], ['pos', 'Position'], ['typed', 'Typed'],
    ['value', 'Value'], ['box', ''], ['use', 'Use'], ['min', 'Min'], ['max', 'Max'], ['step', 'Step']]
    .forEach(([k, v]) => { ws[C[k] + '4'] = { t: 's', v, s: hdr(k === 'name' || k === 'periods' || k === 'kind' ? null : CENTER) }; });
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
  ws['!controls'] = controls;
  ws['!ref'] = 'A1:' + C.step + Math.max(4, DASH_FIRST_ROW + dash.rows.length - 1);
  ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, name);
  wb.SheetNames.unshift(wb.SheetNames.pop()); // the Dashboard first
}
