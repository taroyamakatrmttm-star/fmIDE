// ---------- choosing a file on an iPhone or iPad (shared: src/shared/file-picker.js) ----------
// Safari on iOS and iPadOS turns a file box's `accept` list into the file types the system
// knows. It knows nothing of `.fmide`, so a .fmide file shows greyed out and can't be picked,
// even where the list names it. There the list is dropped and any file can be picked: what is
// read is checked anyway (its kind, its version, its limits), so a wrong file is refused with
// a message, as everywhere else. Elsewhere the list stays and filters the files shown.
function isAppleTouchDevice(){
  const nav = window.navigator || {};
  if(/iPad|iPhone|iPod/.test(String(nav.userAgent || ''))) return true;
  // iPadOS asks for the desktop site by default and then calls itself a Mac: a Mac with touch.
  return nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1;
}
function letAnyFileBePicked(inputs){
  if(!isAppleTouchDevice()) return;
  (inputs || []).forEach(input => { if(input && input.removeAttribute) input.removeAttribute('accept'); });
}
