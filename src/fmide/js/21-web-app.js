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

  // fmGraph (step 15) sits next to fmIDE too and opens the same way, in a window named
  // fmIDE-fmGraph. It shows the model open here without a file to save first: once loaded it
  // asks this page for the model ('fmGraph:want-model'), and the answer is the model as Save
  // System writes it ('fmIDE:model', its JSON text). Only the window this page opened is
  // answered, and on the site only a page of the site itself; opened from disk (a file:
  // address, whose origin browsers name differently or not at all), only that same window. Open fmGraph on a window already open
  // brings it to the front and sends the model as it is now.
  // The document's boards (G3b) go with the model ('boards', the board file's JSON text, or
  // null), and win over the ones fmGraph keeps in the browser; fmGraph sends each change to
  // them back ('fmGraph:boards'), kept with the document, which then has unsaved changes — not
  // an undo step (fmGraph has its own undo). In a tutorial's practice none go either way.
  let graphWindow = null;
  window.addEventListener('pageshow', (ev) => { if(ev.persisted) graphWindow = null; });
  const ownOrigin = () => (location.protocol !== 'file:' && location.origin && location.origin !== 'null') ? location.origin : null;
  function sendModelToGraph(target){
    const origin = ownOrigin();
    const boards = (graphBoards && !inPractice()) ? JSON.stringify(graphBoards) : null;
    try{ target.postMessage({ type: 'fmIDE:model', name: docDisplayName(), text: JSON.stringify(buildSystemPayload()), boards }, origin || '*'); }
    catch(e){ /* the window went away */ }
  }
  window.addEventListener('message', (ev) => {
    if(!graphWindow || ev.source !== graphWindow) return;
    const origin = ownOrigin();
    if(origin && ev.origin !== origin) return;
    if(!ev.data || typeof ev.data !== 'object') return;
    if(ev.data.type === 'fmGraph:want-model') sendModelToGraph(graphWindow);
    else if(ev.data.type === 'fmGraph:boards') takeGraphBoards(ev.data.text);
  });
  function takeGraphBoards(text){
    if(inPractice() || typeof text !== 'string' || text.length > GRAPH_BOARDS_LIMITS.bytes) return;
    let raw;
    try{ raw = JSON.parse(text); } catch(e){ return; }
    const cleaned = cleanGraphBoards(raw);
    if(!cleaned || JSON.stringify(cleaned) === JSON.stringify(graphBoards)) return;
    graphBoards = cleaned;
    markDocDirty();
  }
  function openFmGraph(){
    try {
      if(graphWindow && graphWindow !== window && !graphWindow.closed && graphWindow.opener === window){
        graphWindow.focus();
        sendModelToGraph(graphWindow);
        return;
      }
    } catch(e){ /* a window we can't ask about: open it again */ }
    try { sessionStorage.setItem('fmIDE-opened-fmGraph', '1'); } catch(e){ /* storage off: Back opens fmIDE instead */ }
    const w = window.open('fmGraph.html', 'fmIDE-fmGraph');
    graphWindow = w || null;
    if(!w) showMessage('The browser blocked the fmGraph window. Allow pop-ups for fmIDE, or open fmGraph.html from the same folder as fmIDE.');
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
