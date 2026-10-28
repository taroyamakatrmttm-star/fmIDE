// ============================================================
// The page: opening a model (the file picker, a file dropped anywhere, the sample, or fmIDE),
// the top bar's buttons, and ← Back to fmIDE.
// ============================================================

async function loadSample(){
  await store.ready;
  // The sample starts on its own board the first time (after that, as it was left).
  const key = BOARD_PREFIX + modelSignature(compileModel(SAMPLE_MODEL));
  try{ if(!(await store.get(key))) await store.put(key, JSON.stringify(SAMPLE_BOARD)); }catch(e){ /* not kept: the starting board */ }
  if(await openModelText(JSON.stringify(SAMPLE_MODEL), 'Sample model')) notify('The sample model: move Price or Volume and watch the bars and charts.', 'ok', 'load');
}

function readFileAndOpen(file){
  if(!file) return;
  const name = String(file.name || 'Model').replace(/\.(fmide|json)$/i, '');
  file.text().then(text => openAnyText(text, name).then(ok => { if(ok && !/"kind"\s*:\s*"fmIDE-graph-board"/.test(text)) notify('Opened ' + name + '.', 'ok', 'load'); }),
    () => notify('That file could not be read.', 'err', 'load'));
}

$('btnOpen').addEventListener('click', () => $('fileInput').click());
// build:include shared/file-picker.js
// On an iPhone or iPad a .fmide could not be picked at all (src/shared/file-picker.js).
letAnyFileBePicked([$('fileInput')]);
$('fileInput').addEventListener('change', () => {
  const f = $('fileInput').files && $('fileInput').files[0];
  $('fileInput').value = '';
  readFileAndOpen(f);
});
$('dropBox').addEventListener('click', () => $('fileInput').click());
$('dropBox').addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); $('fileInput').click(); } });
$('btnSample').addEventListener('click', () => { loadSample(); });

// A file dropped anywhere on the page.
let dragDepth = 0;
const carriesFiles = (ev) => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
document.addEventListener('dragenter', (ev) => { if(!carriesFiles(ev)) return; ev.preventDefault(); dragDepth++; document.body.classList.add('file-over'); });
document.addEventListener('dragover', (ev) => { if(carriesFiles(ev)) ev.preventDefault(); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if(!dragDepth) document.body.classList.remove('file-over'); });
document.addEventListener('drop', (ev) => {
  if(!carriesFiles(ev)) return;
  ev.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('file-over');
  readFileAndOpen(ev.dataTransfer.files[0]);
});

$('btnAddBar').addEventListener('click', () => { if(model && addBar()) renderBoard(); });
$('btnAddChart').addEventListener('click', () => {
  if(!model) return;
  const c = addChart('columns');
  if(!c) return;
  chartsEditing.add(c.id); // a new chart opens with its editor
  renderBoard();
});
$('btnAddSlider').addEventListener('click', () => {
  if(!model) return;
  if(!model.inputs.length){ notify('This model has no input rectangles to put a slider on.', 'info', 'add'); return; }
  if(addSlider()) renderBoard();
});
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => $({ bar: 'btnAddBar', chart: 'btnAddChart', slider: 'btnAddSlider' }[b.dataset.add]).click()));
$('btnResetAll').addEventListener('click', () => { if(!model) return; liveSliders().forEach(s => { s.value = null; }); renderBoard(); });
window.addEventListener('pagehide', () => { if(saveTimer) saveBoardNow(); if(sendTimer) sendBoardsToFmide(); });

// ---- fmIDE ----
// fmIDE's Open fmGraph opens this page in a window named fmIDE-fmGraph and keeps it as the
// window it opened. Here, the model comes straight from fmIDE (no file to save first): this
// page asks its opener for it, and takes an answer only from that window (and, on the site,
// only from the site itself). The answer is the model's text, read like any file.
// ↻ From fmIDE asks again, showing fmIDE's model as it is now.
const FMIDE_WINDOW_NAME = 'fmIDE-fmGraph';
function fmideOpener(){
  try{
    const op = window.opener;
    return op && op !== window && !op.closed && window.name === FMIDE_WINDOW_NAME ? op : null;
  }catch(e){ return null; }
}
// The site's own origin; null for a page opened from disk (a file: address, whose origin
// browsers name differently or not at all): then only the window counts.
const ownOrigin = () => (location.protocol !== 'file:' && location.origin && location.origin !== 'null') ? location.origin : null;
const messageTarget = () => ownOrigin() || '*';
// A model from fmIDE keeps its boards in fmIDE's document (G3b): each change to the boards
// (not a slider moved, not another board shown) is sent back ('fmGraph:boards', the board
// file's text), and fmIDE marks the document unsaved. A model opened here from a file keeps
// its boards in this browser only.
let linkedToFmide = false, sendTimer = null;
function sendBoardsToFmideSoon(){
  if(!linkedToFmide) return;
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendBoardsToFmide, 300);
}
function sendBoardsToFmide(){
  clearTimeout(sendTimer); sendTimer = null;
  const op = fmideOpener();
  if(!linkedToFmide || !op || !model) return false;
  try{ op.postMessage({ type: 'fmGraph:boards', text: JSON.stringify(boardsData()) }, messageTarget()); }catch(e){ return false; }
  return true;
}
function askFmideForModel(){
  const op = fmideOpener();
  if(!op) return false;
  try{ op.postMessage({ type: 'fmGraph:want-model' }, messageTarget()); }catch(e){ return false; }
  return true;
}
window.addEventListener('message', (ev) => {
  const op = fmideOpener();
  if(!op || ev.source !== op) return;
  if(ownOrigin() && ev.origin !== ownOrigin()) return;
  const d = ev.data;
  if(!d || typeof d !== 'object') return;
  // fmIDE's answer to Attach to template… (G5b): its words come from fmIDE, shown as text.
  if(d.type === 'fmIDE:board-attached' || d.type === 'fmIDE:board-not-attached'){
    const text = typeof d.text === 'string' ? d.text.slice(0, 300) : '';
    notify(text || (d.type === 'fmIDE:board-attached' ? 'Attached in fmIDE.' : 'Not attached.'), d.type === 'fmIDE:board-attached' ? 'ok' : 'info', 'boards');
    return;
  }
  if(d.type === 'fmIDE:try' && typeof d.text === 'string'){ openTrial(d); return; }
  if(d.type !== 'fmIDE:model' || typeof d.text !== 'string') return;
  const name = typeof d.name === 'string' && d.name ? d.name.slice(0, 120) : 'fmIDE model';
  const docBoards = typeof d.boards === 'string' ? d.boards : null;
  // The library's templates that carry a board (G5b), as JSON text.
  let templates = [];
  if(typeof d.templateBoards === 'string' && d.templateBoards.length <= 8 * 1024 * 1024){
    try{ const t = JSON.parse(d.templateBoards); if(Array.isArray(t) && !fileDataProblem(t)) templates = t; }catch(e){ /* none */ }
  }
  openModelText(d.text, name, { boards: docBoards, fromFmide: true, templates }).then(ok => { if(ok) notify('Showing ' + name + ' from fmIDE.', 'ok', 'load'); });
});
$('btnFromFmide').addEventListener('click', () => {
  if(!askFmideForModel()) notify('fmIDE\'s window is closed: open fmGraph from fmIDE again, or open a saved file.', 'info', 'load');
});

// ← Back to fmIDE: close this window when fmIDE opened it (fmIDE is still open behind it);
// go back a page when fmGraph took fmIDE's place (an iPad's home-screen app: fmIDE marks the
// tab just before); otherwise the link itself, fmIDE's page. fmIDE's address comes from the
// build (<meta name="fmide-address">), never from a file. The board is saved first.
const OPENED_MARK = 'fmIDE-opened-fmGraph';
const cameFromFmide = (() => {
  try{ const m = sessionStorage.getItem(OPENED_MARK) === '1'; sessionStorage.removeItem(OPENED_MARK); return m; }
  catch(e){ return false; }
})();
const back = $('backToFmide');
const addressMeta = document.querySelector('meta[name="fmide-address"]');
back.setAttribute('href', (addressMeta && addressMeta.getAttribute('content')) || 'fmIDE.html');
back.addEventListener('click', (ev) => {
  if(ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  saveBoardNow();
  if(fmideOpener()){
    ev.preventDefault();
    window.close();
    setTimeout(() => { if(!window.closed) location.href = back.href; }, 500);
  } else if(cameFromFmide && history.length > 1){
    ev.preventDefault();
    const fallback = setTimeout(() => { location.href = back.href; }, 1000);
    window.addEventListener('pagehide', () => clearTimeout(fallback), { once: true });
    history.back();
  }
});
