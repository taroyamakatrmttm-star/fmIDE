// ============================================================
// The model from fmIDE. Opened by fmIDE's Open ExcelExporter (its own window, named
// fmIDE-ExcelExporter, fmIDE still open behind it: fmideWindowBehind, 09c), this page asks
// fmIDE for the model it has open ('excel:want-model') once it has started, and again on
// File → ↻ From fmIDE; fmIDE answers ('fmIDE:model') with a workspace file's text — the model
// and the canvas templates whose Excel layout may be used — and sends it unasked when Open
// ExcelExporter is pressed again. It is read exactly like a file dropped here (tryLoad: size
// limits, kind, upgrades), and replaces the model shown: its layout is already saved. Only
// the window that opened this one is listened to, and on the site only a page of the site.
// ============================================================
const ownOrigin = () => (location.protocol !== 'file:' && location.origin && location.origin !== 'null') ? location.origin : null;
let fmideLoading = Promise.resolve(); // one model from fmIDE at a time, in the order sent
let modelFromFmide = false;           // the model shown is fmIDE's: Back to fmIDE needn't ask (09c)

function askFmideForModel(){
  if(!fmideWindowBehind()) return false;
  try{ window.opener.postMessage({ type: 'excel:want-model' }, ownOrigin() || '*'); }catch(e){ return false; }
  return true;
}

window.addEventListener('message', (ev) => {
  if(!fmideWindowBehind() || ev.source !== window.opener) return;
  if(ownOrigin() && ev.origin !== ownOrigin()) return;
  const d = ev.data;
  if(!d || typeof d !== 'object' || d.type !== 'fmIDE:model' || typeof d.text !== 'string') return;
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 120) : 'fmIDE model';
  fmideLoading = fmideLoading.then(async () => {
    const before = model;
    await tryLoad(d.text, `“${name}” from fmIDE`, name);
    if(model && model !== before) modelFromFmide = true;
  }).catch(() => {});
});

$('btnFromFmide').classList.toggle('hidden', !fmideWindowBehind());
$('btnFromFmide').addEventListener('click', () => {
  if(!askFmideForModel()) setStatus($('loadStatus'), 'fmIDE\'s window is closed: open ExcelExporter from fmIDE again, or open a saved file.', 'info');
});
askFmideForModel();
