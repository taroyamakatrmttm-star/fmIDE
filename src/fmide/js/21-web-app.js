  // =====================================================================================
  // ---------- The installable web app (PWA) ----------
  // =====================================================================================
  // The published site (site/, built from src/site/) links a web app manifest; there fmIDE
  // registers the service worker (site/sw.js: keeps the app's files for offline use, and
  // fetches new versions), offers "Install fmIDE" when the browser does, and says when a new
  // version is ready. Opened straight from disk (apps/) there is no manifest and none of
  // that happens. Opening ExcelExporter, and .fmide files handed over by the operating
  // system (launchQueue, when installed), work wherever the browser supports them.
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault(); // offered through the Install fmIDE command instead of a pop-up bar
    installPrompt = ev;
    refreshCommandStates();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    refreshCommandStates();
    toast('fmIDE is installed.');
  });
  function installApp(){
    if(!installPrompt) return;
    const offer = installPrompt;
    installPrompt = null;
    Promise.resolve(offer.prompt()).catch(() => {}).then(() => refreshCommandStates());
  }

  // ExcelExporter sits next to fmIDE (site/ and apps/ alike) and opens in its own window —
  // or, in an iPad's home-screen app, in fmIDE's place. The mark in this tab's
  // sessionStorage tells ExcelExporter's "Back to fmIDE" that fmIDE is the page before it
  // (the site sends no referrer). A window this page already opened is brought to the front,
  // not loaded again (which would lose the model loaded there).
  let excelWindow = null;
  window.addEventListener('pageshow', (ev) => { if(ev.persisted) excelWindow = null; });
  function openExcelExporter(){
    if(inPractice()) practice.openedExcel = true; // a tutorial's "openedExcel" check (01c)
    try {
      if(excelWindow && excelWindow !== window && !excelWindow.closed && excelWindow.opener === window){
        excelWindow.focus();
        return;
      }
    } catch(e){ /* a window we can't ask about: open it again */ }
    try { sessionStorage.setItem('fmIDE-opened-ExcelExporter', '1'); } catch(e){ /* storage off: Back opens fmIDE instead */ }
    const w = window.open('ExcelExporter.html', 'fmIDE-ExcelExporter');
    excelWindow = w || null;
    if(!w) showMessage('The browser blocked the ExcelExporter window. Allow pop-ups for fmIDE, or open ExcelExporter.html from the same folder as fmIDE.');
  }

  // A .fmide double-clicked in the operating system (installed app, Chrome/Edge desktop):
  // opened like Open…, asking about unsaved changes first.
  function openLaunchedFile(handle){
    Promise.resolve(handle.getFile())
      .then(file => file.text().then(text => openDocumentText(text, file.name || handle.name, handle)))
      .catch(() => showMessage('Could not open that file.'));
  }

  // build:include shared/update-notice.js

  // Called once start-up has finished (the autosave restored).
  function startWebApp(){
    if(window.launchQueue && typeof window.launchQueue.setConsumer === 'function'){
      window.launchQueue.setConsumer(params => {
        const handle = params && params.files && params.files[0];
        if(handle) confirmDiscardChanges(() => openLaunchedFile(handle));
      });
    }
    // Only the published site links a manifest; there fmIDE registers the service worker.
    // Reload autosaves first (unsaved changes come back through recovery), with no "Leave site?".
    if(!document.querySelector('link[rel="manifest"]')) return;
    watchForUpdates({
      appName: 'fmIDE', register: true,
      beforeReload: () => saveWorkspace(),
      onReload: () => { skipLeaveWarning = true; },
    });
  }
