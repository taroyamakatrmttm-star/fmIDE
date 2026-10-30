// ============================================================
// ⬇ Excel (phase V4 of docs/viewer-brief.md). A viewer made with Excel carries its author's
// workbook — made once by ExcelExporter when the viewer was made: its output, never its code —
// packed in the page's `excel` data block with its cell map (an fmIDE-viewer-workbook,
// src/shared/showcase.js). On ⬇ Excel the visitor's state is written into the workbook's input
// cells (excelPatchPlan: a scenario shown exactly → its Global Case; anything else → Base plus
// the moved sliders, the owner's choice 3 of phase V2) by the shared patch
// (src/shared/xlsx-patch.js), and the file is given to the visitor: the share sheet on an
// iPhone or iPad, else a download. A line beside the button says what the file will hold.
// Nothing is sent anywhere. Off while Play runs (the owner's choice 9 of phase V4).
// ============================================================
let excelBook = null;      // the block read: { size, workbook (base64), cells, notes }, or null
let excelLoads = -1;       // the model shown (state.loads) the workbook was read for
let excelTimer = null;

// The viewer's excel block (dataBlock, 02-files.js: the page's own, or a made viewer opened as a
// file), read for the model shown: only when that model is the block's own (a model opened
// afterwards has no workbook). A bare app has none; a bad one leaves ⬇ Excel out, said once.
function readExcelBlock(){
  const text = dataBlock('excel');
  if(!text) return null;
  const modelText = dataBlock('model');
  let same = false;
  try{ const raw = JSON.parse(modelText); same = JSON.stringify(raw && raw.kind === 'fmIDE-workspace' ? raw.system : raw) === state.modelJson; }catch(e){ same = false; }
  if(!same) return null;
  const p = parseFileText(text);
  const r = p.error ? { error: p.error } : readViewerWorkbook(p.raw);
  if(r.error){ notify('Excel: ' + r.error, 'warn', 'excel'); return null; }
  return r.value;
}

// The visitor's state as the download plans it: the scenario shown exactly, else the sliders
// that count on the board shown.
function excelState(){
  if(!board) return { scenario: null, sliders: [] };
  return { scenario: shownScenario || null, sliders: liveSliders().map(s => {
    const rect = model.byKey.get(s.key);
    return { canvasId: rect.canvasId, nodeId: rect.nodeId, name: rect.name, mode: s.mode, periods: s.periods,
      value: s.value === null || !Number.isFinite(s.value) ? null : s.value };
  }) };
}
// The workbook for the model shown (read again when another model is shown).
function excelShown(){
  if(state.loads !== excelLoads && state.loads >= 1){ excelLoads = state.loads; excelBook = state.model ? readExcelBlock() : null; }
  return !!excelBook && state.loads === excelLoads;
}
function excelPlanNow(){ return excelPatchPlan(excelBook.cells, excelState(), model ? model.periods.length : 1); }

// The button and its line, as the state is now.
function refreshExcel(){
  const wrap = $('excelWrap');
  if(!wrap) return;
  const on = excelShown();
  wrap.classList.toggle('hidden', !on);
  if(!on) return;
  const btn = $('btnExcel');
  btn.disabled = !!playing;
  const line = playing ? 'Stop Play to download' : excelPlanNow().line;
  $('excelNote').textContent = line;
  btn.title = 'Download the model in Excel: ' + line;
  clearTimeout(excelTimer);
  if(playing) excelTimer = setTimeout(refreshExcel, 400); // until Play stops
}

// The workbook with the visitor's state written in: a Promise of { fileName, bytes, line }.
async function excelBytesNow(){
  if(!excelShown()) throw new Error('This viewer carries no Excel workbook.');
  if(playing) throw new Error('Stop Play first: the workbook holds what you set, not a moment of Play.');
  if(typeof DecompressionStream !== 'function') throw new Error('This browser can\'t unpack the workbook. Use a current Chrome, Edge, Firefox or Safari.');
  const packed = Uint8Array.from(atob(excelBook.workbook), c => c.charCodeAt(0));
  const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const bytes = new Uint8Array(excelBook.size);
  let filled = 0;
  try{
    for(;;){
      const step = await reader.read();
      if(step.done) break;
      if(filled + step.value.length > bytes.length){ reader.cancel().catch(() => {}); throw new Error('size'); }
      bytes.set(step.value, filled);
      filled += step.value.length;
    }
  }catch(e){ throw new Error('The workbook in this viewer is damaged.'); }
  if(filled !== bytes.length) throw new Error('The workbook in this viewer is damaged.');
  const plan = excelPlanNow();
  const r = await patchXlsx(bytes, plan.writes);
  if(r.error) throw new Error('The workbook could not be written: ' + r.error);
  const file = showcaseState() && showcaseState().excel ? showcaseState().excel.file : '';
  return { fileName: showcaseDownloadName(file || ($('showcaseTitle').textContent || 'Model') + '.xlsx', plan.suffix), bytes: r.bytes, line: plan.line };
}
// The showcase shown (its excel.file names the workbook).
function showcaseState(){ return state.showcase || null; }

async function downloadExcel(){
  const btn = $('btnExcel');
  btn.disabled = true;
  try{
    const made = await excelBytesNow();
    const file = new File([made.bytes], made.fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const how = await shareFiles([file], made.fileName);
    if(how !== 'cancelled') notify(made.fileName + ': ' + made.line + '. It opens in Excel on the numbers you see.', 'ok', 'excel');
  }catch(err){
    notify(err && err.message ? err.message : String(err), 'err', 'excel');
  }finally{
    refreshExcel();
  }
}

function wireExcel(){
  $('btnExcel').addEventListener('click', () => { downloadExcel(); });
  // Until the first model is shown (a made viewer opens on its own), then on every change.
  let tries = 0;
  const waitForFirst = () => { if(state.loads >= 1){ refreshExcel(); return; } if(++tries < 300) setTimeout(waitForFirst, 100); };
  waitForFirst();
  // Whatever the visitor does goes through these: the line follows (a model opened later too).
  ['click', 'keyup', 'pointerup', 'input', 'change', 'drop'].forEach(t => document.addEventListener(t, () => { setTimeout(refreshExcel, 0); setTimeout(refreshExcel, 800); }, true));
}
