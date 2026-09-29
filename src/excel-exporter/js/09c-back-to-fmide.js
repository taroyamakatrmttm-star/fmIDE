// ============================================================
// "← Back to fmIDE" (top bar). How ExcelExporter was opened decides what it does:
//   1. in its own window, by fmIDE (Open ExcelExporter names the window fmIDE-ExcelExporter;
//      fmIDE is still open behind it — Chrome, Edge, Firefox on a computer): close this
//      window, asking first when a model is loaded (it has to be loaded again next time;
//      the layout is kept). A page can't reliably bring another window to the front.
//   2. in fmIDE's place, in the same window (an iPad's home-screen app): go back a page,
//      like the swipe from the left edge. fmIDE marks this tab (sessionStorage) just before
//      opening ExcelExporter; the site sends no referrer, so the mark is how we know.
//   3. anything else (a bookmark, a file opened from disk): the link itself — fmIDE's page
//      in this window, restoring its autosave.
// fmIDE's address comes from the build (<meta name="fmide-address">), never from a file.
// ============================================================
const EXCEL_WINDOW_NAME = 'fmIDE-ExcelExporter';
const OPENED_FROM_FMIDE_KEY = 'fmIDE-opened-ExcelExporter';

// Read once, and cleared, so a reload or a later visit in this tab doesn't count.
const openedFromFmide = (() => {
  try {
    const mark = sessionStorage.getItem(OPENED_FROM_FMIDE_KEY) === '1';
    sessionStorage.removeItem(OPENED_FROM_FMIDE_KEY);
    return mark;
  } catch(e){ return false; }
})();

function fmideAddress(){
  const meta = document.querySelector('meta[name="fmide-address"]');
  return (meta && meta.getAttribute('content')) || 'fmIDE.html';
}

function fmideWindowBehind(){
  try {
    const op = window.opener;
    return !!op && op !== window && !op.closed && window.name === EXCEL_WINDOW_NAME;
  } catch(e){ return false; }
}

async function backToFmide(ev){
  if(fmideWindowBehind()){
    ev.preventDefault();
    if(model && !(await showConfirm('Close ExcelExporter?',
      'fmIDE is open in its own window. Your layout is kept; you\'ll load your file again next time you open ExcelExporter.',
      'Close'))) return;
    writeMapping();
    window.close();
    // Closing is refused only in rare cases: then go back a page if fmIDE is there, or say so.
    setTimeout(() => {
      if(window.closed) return;
      if(openedFromFmide && history.length > 1) goBackToFmide();
      else setStatus($('loadStatus'), 'This window can\'t close itself: switch to fmIDE\'s window or tab.', 'info');
    }, 500);
    return;
  }
  if(openedFromFmide && history.length > 1){
    ev.preventDefault();
    writeMapping();
    goBackToFmide();
    return;
  }
  writeMapping(); // case 3: the link navigates
}

function goBackToFmide(){
  // If going back doesn't leave this page, open fmIDE instead.
  const fallback = setTimeout(() => { location.href = backLink.href; }, 1000);
  window.addEventListener('pagehide', () => clearTimeout(fallback), { once: true });
  history.back();
}

const backLink = $('btnBackToFmide');
backLink.setAttribute('href', fmideAddress());
backLink.addEventListener('click', (ev) => {
  if(ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return; // a new tab or window: the link as it is
  backToFmide(ev);
});
