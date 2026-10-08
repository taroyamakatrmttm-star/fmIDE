// ============================================================
// Help: the same panel as fmIDE and ExcelExporter (src/shared/help-panel.js), with fmGraph's
// own topics and What's new (src/help/fmgraph-help.js, fmgraph-whats-new.js; CC BY 4.0).
// ❓ Help or F1. The tutorials are listed at its top (07b-tutorials.js). Its width and the date of the newest update seen are kept in this browser.
// ============================================================
// build:include shared/help-panel.js

// build:include help/fmgraph-help.js

// build:include help/fmgraph-whats-new.js

const HELP_SIZE_KEY = 'fmgraph-help-size';
const NEWS_SEEN_KEY = 'fmgraph-whats-new-seen';
let newsSeen = '';
const help = createHelpPanel({
  groups: FMGRAPH_HELP_GROUPS, topics: FMGRAPH_HELP_TOPICS,
  intro: 'Plain-English guides to fmGraph. Pick a topic, or search above.',
  placeholder: 'Search help — e.g. "slider" or "reach"',
  homeTop: (body, mk) => renderTutorialList(body, mk), // the tutorials (07b-tutorials.js)
  size: { get: () => ({}), set: (v) => { store.put(HELP_SIZE_KEY, JSON.stringify(cleanHelpSize(v))).catch(() => {}); } },
  whatsNew: { entries: FMGRAPH_WHATS_NEW,
    intro: 'Every update to fmGraph so far, newest first: what changed, why, and how to use it.',
    seen: { get: () => newsSeen, set: (d) => { newsSeen = cleanNewsSeen(d); store.put(NEWS_SEEN_KEY, newsSeen).catch(() => {}); } },
    onSeen: () => syncNewsDot() },
});
function syncNewsDot(){ const news = help.unseenCount() > 0; $('btnHelp').classList.toggle('has-news', news); $('btnPhoneMenu').classList.toggle('has-news', news); }
store.ready.then(() => store.get(NEWS_SEEN_KEY)).then(raw => { newsSeen = cleanNewsSeen(raw); help.newsSeenChanged(); syncNewsDot(); }, () => syncNewsDot());
store.ready.then(() => store.get(HELP_SIZE_KEY)).then(raw => {
  if(typeof raw !== 'string' || !raw) return;
  try{ help.loadSize(JSON.parse(raw)); }catch(e){ /* unreadable: the usual width */ }
}, () => {});
$('btnHelp').addEventListener('click', () => help.toggle());
document.addEventListener('keydown', (ev) => {
  if(ev.key !== 'F1' || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
  ev.preventDefault();
  help.toggle();
});
