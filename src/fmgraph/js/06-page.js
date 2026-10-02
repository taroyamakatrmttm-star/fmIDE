// ============================================================
// The page: opening a model (the file picker, a file dropped anywhere, the sample, or fmIDE),
// the top bar's buttons, and ← Back to fmIDE.
// ============================================================

// A small model to try things with: a profit calculation and the cash it builds up.
const SAMPLE_MODEL = {
  kind: 'system', version: 9, periods: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  canvases: [
    { id: 'cProfit', name: 'Profit', nodes: [
      { id: 'price', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Price\n10' },
      { id: 'vol', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Volume\n1000', periodValues: [1000, 1100, 1200, 1300] },
      { id: 'ucost', type: 'value', x: 0, y: 200, w: 150, h: 64, text: 'Unit cost\n6' },
      { id: 'm1', type: 'operator', x: 180, y: 50, text: '×' },
      { id: 'rev', type: 'value', x: 250, y: 50, w: 150, h: 64, text: 'Revenue' },
      { id: 'm2', type: 'operator', x: 180, y: 180, text: '×' },
      { id: 'cogs', type: 'value', x: 250, y: 180, w: 150, h: 64, text: 'Cost of sales' },
      { id: 's1', type: 'operator', x: 420, y: 110, text: '−' },
      { id: 'gp', type: 'value', x: 450, y: 110, w: 150, h: 64, text: 'Gross profit' },
      { id: 'over', type: 'value', x: 500, y: 260, w: 150, h: 64, text: 'Overheads\n2500' },
      { id: 's2', type: 'operator', x: 640, y: 180, text: '−' },
      { id: 'profit', type: 'value', x: 700, y: 180, w: 150, h: 64, text: 'Profit' },
    ], edges: [
      { id: 'e1', from: 'price', to: 'm1' }, { id: 'e2', from: 'vol', to: 'm1' }, { id: 'e3', from: 'm1', to: 'rev' },
      { id: 'e4', from: 'vol', to: 'm2' }, { id: 'e5', from: 'ucost', to: 'm2' }, { id: 'e6', from: 'm2', to: 'cogs' },
      { id: 'e7', from: 'rev', to: 's1' }, { id: 'e8', from: 'cogs', to: 's1' }, { id: 'e9', from: 's1', to: 'gp' },
      { id: 'e10', from: 'gp', to: 's2' }, { id: 'e11', from: 'over', to: 's2' }, { id: 'e12', from: 's2', to: 'profit' },
    ] },
    { id: 'cCash', name: 'Cash', nodes: [
      { id: 'open', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Opening cash\n1000', literalPeriods: [0] },
      { id: 'pr', type: 'alias', x: 0, y: 100, w: 150, h: 64, sourceCanvasId: 'cProfit', sourceNodeId: 'profit' },
      { id: 'add', type: 'operator', x: 180, y: 50, text: '+' },
      { id: 'close', type: 'value', x: 250, y: 50, w: 150, h: 64, text: 'Closing cash' },
      { id: 'ps', type: 'periodShift', x: 250, y: 160, shift: -1 },
    ], edges: [
      { id: 'c1', from: 'open', to: 'add' }, { id: 'c2', from: 'pr', to: 'add' }, { id: 'c3', from: 'add', to: 'close' },
      { id: 'c4', from: 'close', to: 'ps' }, { id: 'c5', from: 'ps', to: 'open' },
    ] },
    // A balance sheet that balances every year: the cash comes from Cash, equity grows by the profit.
    { id: 'cBS', name: 'Balance sheet', nodes: [
      { id: 'bcash', type: 'alias', x: 0, y: 0, w: 150, h: 64, sourceCanvasId: 'cCash', sourceNodeId: 'close' },
      { id: 'equip', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Equipment\n500' },
      { id: 'debt', type: 'value', x: 0, y: 200, w: 150, h: 64, text: 'Debt\n800' },
      { id: 'eqopen', type: 'value', x: 0, y: 300, w: 150, h: 64, text: 'Opening equity\n700', literalPeriods: [0] },
      { id: 'bprofit', type: 'alias', x: 0, y: 400, w: 150, h: 64, sourceCanvasId: 'cProfit', sourceNodeId: 'profit' },
      { id: 'eqadd', type: 'operator', x: 180, y: 350, text: '+' },
      { id: 'equity', type: 'value', x: 250, y: 350, w: 150, h: 64, text: 'Equity' },
      { id: 'eqps', type: 'periodShift', x: 250, y: 450, shift: -1 },
    ], edges: [
      { id: 'b1', from: 'eqopen', to: 'eqadd' }, { id: 'b2', from: 'bprofit', to: 'eqadd' }, { id: 'b3', from: 'eqadd', to: 'equity' },
      { id: 'b4', from: 'equity', to: 'eqps' }, { id: 'b5', from: 'eqps', to: 'eqopen' },
    ] },
  ],
};
const SAMPLE_BOARD = {
  kind: 'fmIDE-graph-board', version: 1,
  sliders: [
    { canvasId: 'cProfit', nodeId: 'price', name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 5, max: 15, step: 0.25 },
    { canvasId: 'cProfit', nodeId: 'vol', name: 'Volume', periods: { mode: 'all' }, mode: 'shift', min: -50, max: 50, step: 1 },
  ],
  bars: [
    { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', periods: { mode: 'all' } },
    { canvasId: 'cCash', nodeId: 'close', name: 'Closing cash', periods: { mode: 'all' } },
  ],
  charts: [
    { layout: 'columns', title: 'Balance sheet', periods: { mode: 'all' }, check: true, groups: [
      { name: 'Assets', parts: [{ canvasId: 'cCash', nodeId: 'close', name: 'Closing cash' }, { canvasId: 'cBS', nodeId: 'equip', name: 'Equipment' }] },
      { name: 'Liabilities and equity', parts: [{ canvasId: 'cBS', nodeId: 'debt', name: 'Debt' }, { canvasId: 'cBS', nodeId: 'equity', name: 'Equity' }] },
    ] },
    { layout: 'flow', title: 'Profit', period: 0, steps: [
      { canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', role: 'start' },
      { canvasId: 'cProfit', nodeId: 'cogs', name: 'Cost of sales', role: 'subtract' },
      { canvasId: 'cProfit', nodeId: 'gp', name: 'Gross profit', role: 'total' },
      { canvasId: 'cProfit', nodeId: 'over', name: 'Overheads', role: 'subtract' },
      { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', role: 'total' },
    ] },
  ],
};
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
  file.text().then(text => openModelText(text, name).then(ok => { if(ok) notify('Opened ' + name + '.', 'ok', 'load'); }),
    () => notify('That file could not be read.', 'err', 'load'));
}

$('btnOpen').addEventListener('click', () => $('fileInput').click());
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
$('btnResetAll').addEventListener('click', () => { if(!model) return; board.sliders.forEach(s => { s.value = null; }); renderBoard(); });
window.addEventListener('pagehide', () => { if(saveTimer) saveBoardNow(); });

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
  if(!d || typeof d !== 'object' || d.type !== 'fmIDE:model' || typeof d.text !== 'string') return;
  const name = typeof d.name === 'string' && d.name ? d.name.slice(0, 120) : 'fmIDE model';
  openModelText(d.text, name).then(ok => { if(ok) notify('Showing ' + name + ' from fmIDE.', 'ok', 'load'); });
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
