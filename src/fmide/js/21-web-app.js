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
  // not loaded again, and sent the model as it is now (sendModelToExcel, below).
  let excelWindow = null;
  window.addEventListener('pageshow', (ev) => { if(ev.persisted) excelWindow = null; });
  function openExcelExporter(){
    if(inPractice()) practice.openedExcel = true; // a tutorial's "openedExcel" check (01c)
    try {
      if(excelWindow && excelWindow !== window && !excelWindow.closed && excelWindow.opener === window){
        excelWindow.focus();
        sendModelToExcel(excelWindow);
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
  // ExcelExporter opened from here shows the model open here, as fmGraph does: it asks
  // ('excel:want-model') once loaded and on its File → From fmIDE, and the answer
  // ('fmIDE:model') is a workspace file's text holding the model (as Save System writes it,
  // format presets included) and the canvas templates whose Excel layout ExcelExporter may use
  // (attachments.excel, step 11c-2) — no macros, shortcuts or settings. Only the window this
  // page opened is answered, under the same origin rules as fmGraph's. In a tutorial's
  // practice the practice model goes.
  function buildExcelPayload(){
    return {
      version: FILE_FORMATS['fmIDE-workspace'].current, kind: 'fmIDE-workspace',
      system: buildSystemPayload(),
      templates: TEMPLATES.filter(t => !t.builtin && t.kind === 'module' && t.attachments && t.attachments.excel).map(t => templateRecord(t, true)),
      formatPresets: FORMAT_PRESETS.map(p => ({ id: p.id, name: p.name, style: p.style }))
    };
  }
  function sendModelToExcel(target){
    const origin = ownOrigin();
    try{ target.postMessage({ type: 'fmIDE:model', name: docDisplayName(), text: JSON.stringify(buildExcelPayload()) }, origin || '*'); }
    catch(e){ /* the window went away */ }
  }
  window.addEventListener('message', (ev) => {
    const origin = ownOrigin();
    if(origin && ev.origin !== origin) return;
    if(!ev.data || typeof ev.data !== 'object' || ev.data.type !== 'excel:want-model') return;
    // A window this page opened before it was reloaded is still its own: taken back on asking.
    if(!excelWindow){ try{ if(ev.source && ev.source !== window && ev.source.opener === window && ev.source.name === 'fmIDE-ExcelExporter') excelWindow = ev.source; }catch(e){ /* not ours */ } }
    if(!excelWindow || ev.source !== excelWindow) return;
    sendModelToExcel(excelWindow);
  });
  function sendModelToGraph(target){
    const origin = ownOrigin();
    const boards = (graphBoards && !inPractice()) ? JSON.stringify(graphBoards) : null;
    // The library's templates that carry an fmGraph board (G5b): every such version, as fmGraph
    // picks one per template for itself (the version a canvas was made from, else the newest).
    const templateBoards = JSON.stringify(TEMPLATES.filter(t => t.attachments && t.attachments.graph && (t.kind === 'module' || t.kind === 'system'))
      .map(t => ({ family: t.family, kind: t.kind, name: t.name, version: t.version, versionId: t.versionId, board: t.attachments.graph })));
    try{ target.postMessage({ type: 'fmIDE:model', name: docDisplayName(), text: JSON.stringify(buildSystemPayload()), boards, templateBoards }, origin || '*'); }
    catch(e){ /* the window went away */ }
  }
  window.addEventListener('message', (ev) => {
    if(!graphWindow || ev.source !== graphWindow) return;
    const origin = ownOrigin();
    if(origin && ev.origin !== origin) return;
    if(!ev.data || typeof ev.data !== 'object') return;
    if(ev.data.type === 'fmGraph:want-model'){
      // A window opened for Try in fmGraph gets the template, once it has arrived.
      if(graphTrial){ graphTrial.asked = true; if(graphTrial.data) sendTrialToGraph(); }
      else sendModelToGraph(graphWindow);
    }
    else if(ev.data.type === 'fmGraph:boards') takeGraphBoards(ev.data.text);
    else if(ev.data.type === 'fmGraph:attach-board') askToAttachGraphBoard(ev.data.text);
  });
  // fmGraph's Attach to template… (step 15 G5b): a board in its template form, for a canvas
  // template (the one it names) or a system template (the person picks one). Read like a file
  // (graphBoardForTemplate: kind, version, form, template kind and family only), attached to the
  // latest version only after asking; fmGraph is told the outcome in words.
  function answerGraph(type, text){
    const origin = ownOrigin();
    try{ if(graphWindow && !graphWindow.closed) graphWindow.postMessage({ type, text }, origin || '*'); }catch(e){ /* gone */ }
  }
  function askToAttachGraphBoard(text){
    const no = (why) => { answerGraph('fmIDE:board-not-attached', why); };
    if(inPractice()){ showMessage('Finish or exit the tutorial first, then attach the board again.'); return no('Not attached: fmIDE is in a tutorial.'); }
    if(typeof text !== 'string' || fileTextProblem(text)) return no('Not attached: the board is too large.');
    let raw;
    try{ raw = JSON.parse(text); }catch(e){ return no('Not attached: fmIDE couldn\'t read it.'); }
    if(fileDataProblem(raw) || !raw || typeof raw !== 'object' || !raw.template || typeof raw.template !== 'object') return no('Not attached: fmIDE couldn\'t read it.');
    const attach = (t) => {
      const r = graphBoardForTemplate(raw, t.family, t.kind);
      if(r.error){ showMessage(r.error); return no('Not attached: ' + r.error); }
      t.attachments = Object.assign({}, t.attachments || {}, { graph: r.attachment });
      saveWorkspaceSoon();
      showMessage(`fmGraph board attached to version ${t.version} of "${t.name}".`);
      answerGraph('fmIDE:board-attached', `Attached to version ${t.version} of “${t.name}” in fmIDE.`);
    };
    const replaces = (t) => t.attachments && t.attachments.graph ? ' It replaces the board that version has.' : '';
    if(raw.template.kind === 'module'){
      const t = latestOfFamily(raw.template.family);
      if(!t || t.kind !== 'module') { showMessage('That board is for a canvas template that isn\'t in your library.'); return no('Not attached: that canvas template isn\'t in fmIDE\'s library.'); }
      return showConfirmCancelable(`Attach this fmGraph board to version ${t.version} of the canvas template "${t.name}"?${replaces(t)}`, 'Attach', () => attach(t), () => no('Not attached: cancelled in fmIDE.'));
    }
    if(raw.template.kind !== 'system') return no('Not attached: fmIDE couldn\'t read it.');
    const systems = [...new Set(TEMPLATES.filter(t => t.kind === 'system' && !t.builtin).map(t => t.family))].map(latestOfFamily).filter(Boolean);
    if(!systems.length){ showMessage('There is no system template in your library to attach this board to. Save the model as a system template first, then attach it again.'); return no('Not attached: there is no system template in fmIDE\'s library.'); }
    showSystemTemplateChoice(systems, replaces, attach, () => no('Not attached: cancelled in fmIDE.'));
  }
  // A question with Cancel (and Escape, or a click outside) reported back.
  function showConfirmCancelable(message, okLabel, onOk, onCancel){
    const { overlay, box, close } = smallDialog(onCancel);
    const p = document.createElement('p'); p.textContent = message;
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
    const ok = document.createElement('button'); ok.className = 'primary'; ok.textContent = okLabel;
    cancel.addEventListener('click', () => close(true));
    ok.addEventListener('click', () => { close(false); onOk(); });
    actions.append(cancel, ok);
    box.append(p, actions);
    document.body.appendChild(overlay);
    ok.focus();
  }
  function showSystemTemplateChoice(systems, replaces, onPick, onCancel){
    const { overlay, box, close } = smallDialog(onCancel);
    box.classList.add('graph-attach-box');
    const p = document.createElement('p'); p.textContent = 'Attach this fmGraph board to which system template?';
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'System template');
    systems.forEach((t, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `${t.name} (version ${t.version})`; sel.appendChild(o); });
    const note = document.createElement('p'); note.className = 'graph-attach-note';
    const showNote = () => { note.textContent = replaces(systems[Number(sel.value)]).trim(); };
    sel.addEventListener('change', showNote); showNote();
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
    const ok = document.createElement('button'); ok.className = 'primary'; ok.textContent = 'Attach';
    cancel.addEventListener('click', () => close(true));
    ok.addEventListener('click', () => { close(false); onPick(systems[Number(sel.value)]); });
    actions.append(cancel, ok);
    box.append(p, sel, note, actions);
    document.body.appendChild(overlay);
    sel.focus();
  }
  function smallDialog(onCancel){
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    const box = document.createElement('div'); box.className = 'modal-box';
    overlay.appendChild(box);
    const onKey = (ev) => { if(ev.key === 'Escape') close(true); };
    function close(cancelled){ overlay.remove(); document.removeEventListener('keydown', onKey); if(cancelled && onCancel) onCancel(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(true); });
    document.addEventListener('keydown', onKey);
    return { overlay, box, close };
  }
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
    graphTrial = null;
    if(liveGraphWindow()){
      graphWindow.focus();
      sendModelToGraph(graphWindow);
      return;
    }
    openGraphWindow();
  }
  // The window this page opened, when it is still there.
  function liveGraphWindow(){
    try { return !!(graphWindow && graphWindow !== window && !graphWindow.closed && graphWindow.opener === window); }
    catch(e){ return false; } // a window we can't ask about: open it again
  }
  function openGraphWindow(){
    try { sessionStorage.setItem('fmIDE-opened-fmGraph', '1'); } catch(e){ /* storage off: Back opens fmIDE instead */ }
    const w = window.open('fmGraph.html', 'fmIDE-fmGraph');
    graphWindow = w || null;
    if(!w) showMessage('The browser blocked the fmGraph window. Allow pop-ups for fmIDE, or open fmGraph.html from the same folder as fmIDE.');
    return !!w;
  }
  // Browse Library's Try in fmGraph (step 15 G5c, 11f-library-browse.js): a template from a pack
  // shown in fmGraph with its board, without adding anything to the library or the document.
  // The window opens on the click itself (a browser blocks a window opened later), the pack
  // arrives afterwards: graphTrial = { data (once read), asked (fmGraph is waiting for it) }.
  // The answer is 'fmIDE:try' — { name, text (the template's model as a system file's text),
  // templateBoards (its board, as for G5b), pack (the pack's title) } — which fmGraph shows
  // in its try mode: nothing kept, nothing sent back. ↻ From fmIDE there shows this model again.
  let graphTrial = null;
  function startGraphTrial(){
    const trial = { data: null, asked: false };
    if(liveGraphWindow()){ graphWindow.focus(); trial.asked = true; }
    else if(!openGraphWindow()) return null;
    graphTrial = trial;
    return trial;
  }
  function finishGraphTrial(trial, data){
    if(graphTrial !== trial) return;
    if(!data){ // the pack couldn't be read: show the model instead of an empty window
      graphTrial = null;
      if(trial.asked && liveGraphWindow()) sendModelToGraph(graphWindow);
      return;
    }
    trial.data = data;
    if(trial.asked) sendTrialToGraph();
  }
  function sendTrialToGraph(){
    const trial = graphTrial;
    graphTrial = null;
    if(!trial || !trial.data || !liveGraphWindow()) return;
    const origin = ownOrigin();
    try{ graphWindow.postMessage(Object.assign({ type: 'fmIDE:try' }, trial.data), origin || '*'); }
    catch(e){ /* the window went away */ }
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
