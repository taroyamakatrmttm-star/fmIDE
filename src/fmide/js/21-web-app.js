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

  // ExcelExporter sits next to fmIDE (site/ and apps/ alike) and opens in its own window.
  function openExcelExporter(){
    const w = window.open('ExcelExporter.html', 'fmIDE-ExcelExporter');
    if(!w) showMessage('The browser blocked the ExcelExporter window. Allow pop-ups for fmIDE, or open ExcelExporter.html from the same folder as fmIDE.');
  }

  // A .fmide double-clicked in the operating system (installed app, Chrome/Edge desktop):
  // opened like Open…, asking about unsaved changes first.
  function openLaunchedFile(handle){
    Promise.resolve(handle.getFile())
      .then(file => file.text().then(text => openDocumentText(text, file.name || handle.name, handle)))
      .catch(() => showMessage('Could not open that file.'));
  }

  function showUpdateNotice(reg){
    if(document.getElementById('updateBanner')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBanner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed; bottom:16px; right:16px; z-index:1998; max-width:420px; ' +
      'display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#1e3a8a; color:#fff; ' +
      'font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.35);';
    const msg = document.createElement('span');
    msg.textContent = 'A new version of fmIDE is ready.';
    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:none; background:#fff; color:#1e3a8a; font-weight:700; cursor:pointer;';
    const later = document.createElement('button');
    later.textContent = 'Later';
    later.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.5); background:transparent; color:#fff; cursor:pointer;';
    later.addEventListener('click', () => bar.remove());
    // Reload: autosave first (unsaved changes come back through recovery), then let the new
    // version take over and reload once it has.
    reload.addEventListener('click', () => {
      bar.remove();
      Promise.resolve(saveWorkspace()).catch(() => {}).then(() => {
        const waiting = reg.waiting;
        const go = () => { skipLeaveWarning = true; location.reload(); };
        if(!waiting){ go(); return; }
        navigator.serviceWorker.addEventListener('controllerchange', go, { once: true });
        waiting.postMessage('skipWaiting');
      });
    });
    bar.append(msg, reload, later);
    document.body.appendChild(bar);
  }

  // Called once start-up has finished (the autosave restored).
  function startWebApp(){
    if(window.launchQueue && typeof window.launchQueue.setConsumer === 'function'){
      window.launchQueue.setConsumer(params => {
        const handle = params && params.files && params.files[0];
        if(handle) confirmDiscardChanges(() => openLaunchedFile(handle));
      });
    }
    if(!document.querySelector('link[rel="manifest"]') || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      if(reg.waiting && navigator.serviceWorker.controller) showUpdateNotice(reg);
      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if(!incoming) return;
        incoming.addEventListener('statechange', () => {
          // installed while another version runs this page = an update is waiting
          if(incoming.state === 'installed' && navigator.serviceWorker.controller) showUpdateNotice(reg);
        });
      });
      setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
    }).catch(() => { /* no offline copy: fmIDE still works as a normal page */ });
  }
