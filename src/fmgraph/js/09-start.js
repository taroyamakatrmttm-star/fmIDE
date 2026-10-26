// ============================================================
// Start: the page's state, the "new version is ready" notice on the site, and the model from
// fmIDE when fmIDE opened this window.
// ============================================================
// build:include shared/update-notice.js
watchForUpdates({ appName: 'fmGraph', note: 'Your bars and sliders are kept.', beforeReload: () => saveBoardNow() });

// Every colour box opens a grid of ready colours (the owner's request of 27 October 2026).
// build:include shared/colour-grid.js
installColourGrid({
  chart: () => PART_COLOURS,
  inUse: () => coloursIn([[...rectColours.values()], [...autoColours().values()], board ? board.items : []]),
  automatic: (input) => input.colourAutomatic || null, // a rectangle's (or the Tornado's) usual colour
});

syncPageState();
if(fmideOpener()){
  $('btnFromFmide').classList.remove('hidden');
  askFmideForModel();
}

})();
