// ============================================================
// Help (the owner's V1 choice 6, phase V2): the shared Help panel (src/shared/help-panel.js)
// with the viewer's own short topics (src/help/viewer-help.js, CC BY 4.0). ? or F1. No What's
// new and no link to the manual (the owner's choice 9 of phase V2: the manual is for authors).
// Its width is kept on this device, as fmGraph's is.
// ============================================================
// build:include help/viewer-help.js

const HELP_SIZE_KEY = 'viewer-help-size';
const help = createHelpPanel({
  groups: VIEWER_HELP_GROUPS, topics: VIEWER_HELP_TOPICS,
  intro: 'How to use this viewer. Pick a topic, or search above.',
  placeholder: 'Search help — e.g. "slider" or "scenario"',
  size: { get: () => ({}), set: (v) => { viewerStore.put(HELP_SIZE_KEY, JSON.stringify(cleanHelpSize(v))).catch(() => {}); } },
});

function wireHelp(){
  viewerStore.ready.then(() => viewerStore.get(HELP_SIZE_KEY)).then(raw => {
    if(typeof raw !== 'string' || !raw) return;
    try{ help.loadSize(JSON.parse(raw)); }catch(e){ /* unreadable: the usual width */ }
  }, () => {});
  $('btnHelp').addEventListener('click', () => help.toggle());
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'F1' || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    ev.preventDefault();
    help.toggle();
  });
}
