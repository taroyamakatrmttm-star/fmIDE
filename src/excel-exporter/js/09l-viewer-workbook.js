// ============================================================
// A workbook for a showcase viewer (phase V4 of docs/viewer-brief.md). fmIDE's Make Showcase
// Viewer… (and, later, tools/make-viewers.js) asks for the model's workbook with the showcase's
// fmGraph boards used on it: every scenario a Global Case, every slider on the Dashboard, the
// first board's bars, charts, Tornado and Spider — exactly what Layout → Use fmGraph boards…
// would copy, but without asking and on a lent layout: the person's own layout is put back
// afterwards exactly as it was, never saved, never sent to fmIDE (layoutHeld, 04-file-formats.js).
// The answer is the workbook's bytes (what ⬇ Generate writes) and its cell map — the Global Case
// cell, each scenario's case, each Dashboard slider's Typed and Use cells — in the documented
// form (docs/file-formats.md, "fmIDE-viewer-workbook"), which the viewer's own code reads.
// Only the workbook, which is the author's, leaves this page; none of this code does.
// Asked through a window message from fmIDE ('fmIDE:viewer-workbook', answered
// 'excel:viewer-workbook' or 'excel:viewer-workbook-failed') and the page global
// window.fmExcel.viewerWorkbook.
// ============================================================

// The model (a workspace or system file's text) and the showcase's boards (a board file, parsed,
// or null): a Promise of { bytes (Uint8Array), map, notes }. Throws with plain words.
// style (phase V5, tools/make-viewers.js --excel-style): an Excel style file, parsed, used for
// this workbook only — lent like the layout and put back after, never saved.
async function viewerWorkbook(modelText, boards, style){
  if(typeof modelText !== 'string' || !modelText) throw new Error('No model came to make the workbook from.');
  let lentStyle = null;
  if(style !== undefined && style !== null){
    const r = readExcelStyleData(style);
    if(r.error) throw new Error('The Excel style: ' + r.error);
    lentStyle = r.style;
  }
  await excelStyleLoaded; // the style kept in this browser is read first, so the lent one isn't overwritten
  const before = model;
  await tryLoad(modelText, 'the showcase viewer\'s model', 'Model for a showcase viewer');
  if(!model || model === before){
    const said = $('loadStatus').textContent.replace(/×\s*$/, '').trim();
    throw new Error(said || 'The model could not be read.');
  }
  const read = boards ? readGraphBoards(boards) : null;
  if(read && read.error) throw new Error(read.error);
  const saved = JSON.stringify(mapping), savedPicked = sensPicked, savedStyle = excelStyle;
  layoutHeld = true;
  if(lentStyle) excelStyle = lentStyle;
  try{
    const notes = [];
    let matched = null;
    if(read && read.boards.length){
      matched = matchGraphScenarios(read);
      const sliders = matchGraphSliders(read);
      const first = read.boards[0];
      const analyses = graphSensAnalyses(matchGraphSensCharts(first).charts);
      const charts = matchGraphCharts(first).charts;
      const copy = { from: read.boards.map(b => b.name), board: first.name, scenarios: matched.scenarios, analyses,
        sliders: sliders.sliders.map(s => ({ row: s.row, name: s.name, mode: s.mode, periods: s.periods, min: s.min, max: s.max, step: s.step })), charts };
      const applied = await applyGraphCopy(copy);
      const left = sliders.left;
      const out = left.notFound + left.inBlock + left.notInput + left.bad + left.past;
      if(out) notes.push(out + ' slider' + (out === 1 ? '' : 's') + ' can\'t move in Excel (not in this model, inside a block, not an input, or past ' + GRAPH_LIMITS.sliders + ').');
      notes.push(...(applied.plan ? applied.plan.notes : []), ...graphSliderNotes(), ...graphChartNotes());
      if(applied.past.length) notes.push('Analyses past ' + SENS_MAX_ANALYSES + ' in all are not added: ' + applied.past.map(a => a.name).join(', ') + '.');
    }
    graphPlanCache = null;
    const built = buildWorkbook();
    if(built.tooLong.length) notes.push(built.tooLong.length + ' cell' + (built.tooLong.length === 1 ? '' : 's') + ' too long for Excel are written as NA().');
    const bytes = XLSX.write(built.wb);
    const map = viewerCellMap(built, read, matched);
    return { bytes, map, notes: [...new Set(notes)].slice(0, 40) };
  }finally{
    mapping = JSON.parse(saved);
    sensPicked = savedPicked;
    excelStyle = savedStyle;
    graphPlanCache = null;
    layoutHeld = false;
    renderAll();
  }
}

// The cell map of a workbook just built (buildWorkbook's `dash` and `cases`), while the lent
// layout is still in place: { case, cases: [{ name, case, missing }], sliders: [{ canvasId,
// nodeId, name, mode, periods, typed, use, rest }] }.
function viewerCellMap(built, read, matched){
  const map = { case: null, cases: [], sliders: [] };
  if(built.cases && built.cases.sheet){
    map.case = { sheet: built.cases.sheet, cell: built.cases.cell };
    const plan = graphScenarioPlan();
    (built.cases.names || []).forEach((name, k) => {
      if(k === 0) return; // case 1 is Base
      const i = matched ? matched.scenarios.findIndex(sc => sc.name === name) : -1;
      let missing = 0;
      if(i >= 0){
        missing = read.scenarios[i].settings.length - matched.scenarios[i].settings.length;
        missing += matched.scenarios[i].settings.filter(s => !plan || !plan.bySource.has(s.row)).length;
        const entry = plan && [...plan.bySource.values()].find(e => e.over.includes(name));
        if(entry) missing++;
      }
      map.cases.push({ name, case: k + 1, missing });
    });
  }
  if(built.dash){
    built.dash.rows.forEach((d, i) => {
      const row = mapping.rows.find(r => r.id === d.slider.row);
      if(!row) return;
      const r = DASH_FIRST_ROW + i;
      map.sliders.push({ canvasId: row.canvasId, nodeId: row.nodeId, name: d.label, mode: d.slider.mode, periods: d.slider.periods,
        typed: { sheet: built.dash.sheet, cell: DASH_COL.typed + r },
        use: d.slider.mode === 'set' ? { sheet: built.dash.sheet, cell: DASH_COL.use + r } : null,
        rest: d.slider.mode === 'shift' ? d.value0 : null });
    });
  }
  return map;
}

// ---- asked by fmIDE, the window that opened this one (the same rules as 'fmIDE:model', 09f) ----
window.addEventListener('message', (ev) => {
  if(!fmideWindowBehind() || ev.source !== window.opener) return;
  if(ownOrigin() && ev.origin !== ownOrigin()) return;
  const d = ev.data;
  if(!d || typeof d !== 'object' || d.type !== 'fmIDE:viewer-workbook' || typeof d.text !== 'string') return;
  const id = typeof d.id === 'string' ? d.id.slice(0, 80) : '';
  let boards = null;
  if(typeof d.boards === 'string' && d.boards){
    const p = parseFileText(d.boards);
    if(p.error){ answerViewerWorkbook({ type: 'excel:viewer-workbook-failed', id, text: 'The boards: ' + p.error }); return; }
    boards = p.parsed;
  }
  setStatus($('genStatus'), 'Making the workbook for a showcase viewer…', 'info');
  fmideLoading = fmideLoading.then(async () => {
    try{
      const made = await viewerWorkbook(d.text, boards);
      modelFromFmide = true;
      const buffer = made.bytes.buffer.slice(made.bytes.byteOffset, made.bytes.byteOffset + made.bytes.byteLength);
      answerViewerWorkbook({ type: 'excel:viewer-workbook', id, bytes: buffer, map: JSON.stringify(made.map), notes: made.notes }, [buffer]);
      setStatus($('genStatus'), 'Made the workbook for fmIDE\'s showcase viewer. Your layout is unchanged.', 'ok');
    }catch(err){
      const text = String(err && err.message ? err.message : err).slice(0, 300);
      answerViewerWorkbook({ type: 'excel:viewer-workbook-failed', id, text });
      setStatus($('genStatus'), 'The workbook for the showcase viewer couldn\'t be made: ' + text, 'err');
    }
  }).catch(() => {});
});
function answerViewerWorkbook(message, transfer){
  try{ window.opener.postMessage(message, ownOrigin() || '*', transfer || []); }catch(e){ /* fmIDE's window went away */ }
}

// For tools/make-viewers.js (phase V5), which drives this page in a browser without a window,
// and the tests: the same workbook and cell map. A Promise of { bytes: [numbers], map, notes }.
// options (phase V5): { style: an Excel style file, parsed, for this workbook only; base64: true
// gives the bytes as base64 text (quicker for the tool to carry) instead of a list of numbers }.
window.fmExcel = Object.freeze({
  viewerWorkbook: async (modelText, boards, options) => {
    const o = options && typeof options === 'object' ? options : {};
    const made = await viewerWorkbook(modelText, boards && typeof boards === 'object' ? boards : null, o.style && typeof o.style === 'object' ? o.style : null);
    if(o.base64 === true){
      let bin = '';
      for(let i = 0; i < made.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, made.bytes.subarray(i, i + 0x8000));
      return { base64: btoa(bin), map: made.map, notes: made.notes };
    }
    return { bytes: Array.from(made.bytes), map: made.map, notes: made.notes };
  }
});
