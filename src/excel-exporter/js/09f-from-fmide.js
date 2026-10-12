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
  if(d && typeof d === 'object' && (d.type === 'fmIDE:layout-attached' || d.type === 'fmIDE:layout-not-attached')){
    const ok = d.type === 'fmIDE:layout-attached';
    const text = typeof d.text === 'string' && d.text.trim() ? d.text.slice(0, 300) : (ok ? 'Attached in fmIDE.' : 'Not attached.');
    setStatus($('moduleLayoutsStatus'), text, ok ? 'ok' : 'info');
    return;
  }
  if(!d || typeof d !== 'object' || d.type !== 'fmIDE:model' || typeof d.text !== 'string') return;
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 120) : 'fmIDE model';
  fmideLoading = fmideLoading.then(async () => {
    const before = model;
    await tryLoad(d.text, `“${name}” from fmIDE`, name);
    if(model && model !== before) modelFromFmide = true;
  }).catch(() => {});
});

// ---- Layout → 📎 Attach to Template…, and 📎 Attach on a module's tab ----
// With fmIDE's window behind this one: sends one module's layout as this model shows it
// (moduleLayoutNow, 04b) to fmIDE ('excel:attach-layout'), as a module layouts file holding
// that one entry — what Export Module Layouts writes for fmIDE's Attach Excel layout…. fmIDE
// reads it the same way, asks, attaches it to the template's latest version, and answers in
// words ('fmIDE:layout-attached' / 'fmIDE:layout-not-attached', above).
function attachLayoutToTemplate(family, tabId){
  const status = $('moduleLayoutsStatus');
  if(!fmideWindowBehind()){ setStatus(status, 'Attach to Template works with ExcelExporter opened from fmIDE. Use Export Module Layouts instead.', 'info'); return false; }
  const m = model && mapping && moduleLayoutNow(family, tabId);
  if(!m){ setStatus(status, 'That module has no tab here, so there is no layout to attach.', 'info'); return false; }
  try{ window.opener.postMessage({ type: 'excel:attach-layout', text: JSON.stringify(moduleLayoutsPayload([m])) }, ownOrigin() || '*'); }
  catch(e){ return false; }
  setStatus(status, `Sent the layout of “${m.name || 'module'}” to fmIDE: answer its question there.`, 'info');
  return true;
}
function showAttachLayout(){
  const status = $('moduleLayoutsStatus');
  const mods = model && mapping ? modulesWithTabs() : [];
  if(!mods.length){ setStatus(status, 'No tab here comes from a canvas template, so there is no layout to attach.', 'info'); return; }
  const pick = $('attachPick');
  pick.innerHTML = '';
  mods.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${m.name} — tab “${m.tab.name}”`;
    pick.appendChild(o);
  });
  const modal = $('attachModal');
  const close = () => {
    modal.classList.add('hidden');
    $('attachOk').removeEventListener('click', onOk);
    $('attachCancel').removeEventListener('click', close);
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOk = () => { const m = mods[Number(pick.value)]; close(); if(m) attachLayoutToTemplate(m.family, m.tab.id); };
  const onBackdrop = (ev) => { if(ev.target === modal) close(); };
  const onKey = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); close(); } };
  $('attachOk').addEventListener('click', onOk);
  $('attachCancel').addEventListener('click', close);
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey, true);
  modal.classList.remove('hidden');
  pick.focus();
}
$('btnAttachLayout').classList.toggle('hidden', !fmideWindowBehind());
$('btnAttachLayout').addEventListener('click', showAttachLayout);

$('btnFromFmide').classList.toggle('hidden', !fmideWindowBehind());
$('btnFromFmide').addEventListener('click', () => {
  if(!askFmideForModel()) setStatus($('loadStatus'), 'fmIDE\'s window is closed: open ExcelExporter from fmIDE again, or open a saved file.', 'info');
});
askFmideForModel();
