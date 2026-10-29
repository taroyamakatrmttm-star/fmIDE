// ============================================================
// Phase V6 of docs/viewer-brief.md: the Board and the Logic side by side, and a viewer served
// from the site's gallery.
// - **Both** (a third tab beside Board | Logic, from BOTH_MIN_WIDTH pixels wide — an iPad held
//   sideways, a computer — never on a phone): the Board on the left, the Logic on the right,
//   which follows every slider as it does (logicFollows, 06-board.js). Not the default; the
//   choice is kept on this device (`viewer-layout` in the fmShowcase store,
//   docs/architecture/storage.md) and comes back when the window is wide enough. A window made
//   narrower goes back to the Board.
// - **A viewer in the gallery** (the page at /gallery/v/<id> on the site, written by
//   tools/build-gallery.js): "← Gallery", back to the gallery's page, and, where the
//   device has a share sheet, "⇪ Share link", which hands the sheet this page's address — the
//   device's own sheet; the page sends nothing. Neither exists anywhere else (from disk, in the
//   bare app).
// ============================================================
const BOTH_MIN_WIDTH = 1180;
const LAYOUT_KEY = 'viewer-layout';

function bothFits(){ return !onPhone && window.innerWidth >= BOTH_MIN_WIDTH; }
const logicShown = () => state.viewName === 'logic' || state.viewName === 'both';

// The Both tab shown when it can be used; a window too narrow for it goes back to the Board.
function syncBothTab(){
  const can = boardsShown && bothFits();
  $('tabBoth').classList.toggle('hidden', !can);
  if(!can && state.viewName === 'both') showView('board');
}
function rememberLayout(){
  try{ viewerStore.put(LAYOUT_KEY, state.viewName === 'both' ? 'both' : '').catch(() => {}); }catch(e){ /* not kept: fine */ }
}
async function restoreLayout(){
  if(!boardsShown || !bothFits() || state.viewName !== 'board') return;
  let v = '';
  try{ await viewerStore.ready; v = await viewerStore.get(LAYOUT_KEY); }catch(e){ return; }
  if(v === 'both' && state.viewName === 'board' && bothFits()) showView('both');
}

// Served from the site's gallery: /gallery/v/<id> (or .html), over http(s).
const GALLERY_PAGE = /\/gallery\/v\/[A-Za-z0-9-]+(?:\.html)?$/;
function inGallery(){ return (location.protocol === 'https:' || location.protocol === 'http:') && GALLERY_PAGE.test(location.pathname); }
function wireHosted(){
  if(!inGallery()) return;
  const back = $('galleryLink');
  back.classList.remove('hidden');
  // A button, not a link: the page holds no <a> of its own (a link in it could only be a file's).
  back.addEventListener('click', () => { location.assign('../'); });
  if(typeof navigator.share !== 'function') return;
  const b = $('btnShareLink');
  b.classList.remove('hidden');
  b.addEventListener('click', () => {
    try{ navigator.share({ title: document.title, url: location.href }).catch(() => { /* closed: nothing to do */ }); }
    catch(e){ notify('This browser can\'t share the link: copy it from the address bar.', 'info', 'share'); }
  });
}
function wireLayout(){
  $('tabBoth').addEventListener('click', () => { showView('both'); rememberLayout(); });
  window.addEventListener('resize', () => { if(state.vm) syncBothTab(); });
  wireHosted();
}
