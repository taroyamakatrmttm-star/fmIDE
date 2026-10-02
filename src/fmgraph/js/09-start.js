// ============================================================
// Start: the page's state, the "new version is ready" notice on the site, and the model from
// fmIDE when fmIDE opened this window.
// ============================================================
// build:include shared/update-notice.js
watchForUpdates({ appName: 'fmGraph', note: 'Your bars and sliders are kept.', beforeReload: () => saveBoardNow() });

syncPageState();
if(fmideOpener()){
  $('btnFromFmide').classList.remove('hidden');
  askFmideForModel();
}

})();
