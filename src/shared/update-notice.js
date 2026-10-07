// ---------- "a new version is ready" notice (shared: src/shared/update-notice.js, used by both apps) ----------
// On the published site, a service worker (site/sw.js) keeps the apps' files for offline
// use. A new version installs in the background and waits: it takes over only when a page
// asks (Reload), never by itself. This shows the notice that says so, in whichever app is
// open. Opened straight from disk (apps/) there is no service worker and nothing happens.
//
// watchForUpdates({ appName, register, note, beforeReload, onReload })
//   register      true: register sw.js (fmIDE, when the page links the site's manifest);
//                 otherwise act only when the site's service worker already runs this page.
//   note          optional extra sentence after "A new version of <appName> is ready."
//   beforeReload  optional; runs (and is awaited) before switching, e.g. an autosave.
//   onReload      optional; runs right before the page reloads.
// If another tab has already switched to the new version, this tab gets the notice too, and
// Reload simply reloads — so no open app is left behind on the old version without a word.
export function watchForUpdates(opts){
  if(!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const sw = navigator.serviceWorker;
  let hadController = !!sw.controller;
  let reloading = false;
  const found = opts.register ? sw.register('sw.js') : (sw.controller ? sw.getRegistration() : Promise.resolve(null));
  Promise.resolve(found).then(reg => {
    if(!reg) return;
    const show = () => showUpdateNotice(reg);
    if(reg.waiting && sw.controller) show();
    reg.addEventListener('updatefound', () => {
      const incoming = reg.installing;
      if(!incoming) return;
      incoming.addEventListener('statechange', () => {
        // installed while another version runs this page = an update is waiting
        if(incoming.state === 'installed' && sw.controller) show();
      });
    });
    sw.addEventListener('controllerchange', () => {
      // The very first service worker taking over a fresh page is not an update.
      if(!hadController){ hadController = true; return; }
      if(!reloading) show();
    });
    setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
  }).catch(() => { /* no offline copy: the app still works as a normal page */ });

  function showUpdateNotice(reg){
    if(document.getElementById('updateBanner')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBanner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed; bottom:16px; right:16px; z-index:1998; max-width:420px; ' +
      'display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#1e3a8a; color:#fff; ' +
      'font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.35);';
    const msg = document.createElement('span');
    msg.textContent = 'A new version of ' + opts.appName + ' is ready.' + (opts.note ? ' ' + opts.note : '');
    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:none; background:#fff; color:#1e3a8a; font-weight:700; cursor:pointer;';
    const later = document.createElement('button');
    later.textContent = 'Later';
    later.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.5); background:transparent; color:#fff; cursor:pointer;';
    later.addEventListener('click', () => bar.remove());
    // Reload: run beforeReload (e.g. autosave), then let the waiting version take over and
    // reload once it has — or just reload if another tab already switched.
    reload.addEventListener('click', () => {
      bar.remove();
      reloading = true;
      Promise.resolve().then(() => opts.beforeReload && opts.beforeReload()).catch(() => {}).then(() => {
        const waiting = reg.waiting;
        const go = () => { if(opts.onReload) opts.onReload(); location.reload(); };
        if(!waiting){ go(); return; }
        sw.addEventListener('controllerchange', go, { once: true });
        waiting.postMessage('skipWaiting');
      });
    });
    bar.append(msg, reload, later);
    document.body.appendChild(bar);
  }
}
