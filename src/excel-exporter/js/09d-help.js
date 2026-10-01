// ============================================================
// Help (build step 10, phase H2; docs/step10-help.md)
// ============================================================
// The same Help panel as fmIDE (src/shared/help-panel.js), with ExcelExporter's own topics:
// ❓ Help at the top right, F1, or the "?" beside each panel's heading, which opens that
// panel's topic. The topics are data in src/excel-exporter/help/excel-help.js (ExcelExporter's
// own, under its licence, unlike fmIDE's help text), also published as the site's /help/excel/.
// build:include shared/help-panel.js

// build:include excel-exporter/help/excel-help.js

// build:include excel-exporter/help/excel-whats-new.js

const excelHelp = createHelpPanel({
  groups: EXCEL_HELP_GROUPS, topics: EXCEL_HELP_TOPICS,
  intro: 'Plain-English guides to ExcelExporter. Pick a topic, or search above. The "?" beside each panel\'s heading opens its topic.',
  placeholder: 'Search help — e.g. "scenarios" or "tree view"',
  // H5a: the panel's width, kept in this browser (HELP_SIZE_KEY) for every model.
  size: { get: () => ({}), set: (v) => { layoutStore.put(HELP_SIZE_KEY, JSON.stringify(cleanHelpSize(v))).catch(() => {}); } },
  // H5b: What's new (excel-whats-new.js). The date seen is kept in this browser (NEWS_SEEN_KEY).
  whatsNew: { entries: EXCEL_WHATS_NEW,
    intro: 'Every update to ExcelExporter so far, newest first: what changed, why, and how to use it.',
    seen: { get: () => excelNewsSeen, set: (d) => { excelNewsSeen = cleanNewsSeen(d); layoutStore.put(NEWS_SEEN_KEY, excelNewsSeen).catch(() => {}); } },
    onSeen: () => syncExcelNewsDot() },
});
let excelNewsSeen = '';
const NEWS_SEEN_KEY = 'fmide-excel-whats-new-seen';
// ❓ Help carries a dot while there are updates not yet seen.
function syncExcelNewsDot(){
  const b = $('btnHelp');
  if(!b) return;
  const n = excelHelp.unseenCount();
  b.classList.toggle('has-news', n > 0);
  b.dataset.news = String(n);
}
layoutsMigrated.then(() => layoutStore.get(NEWS_SEEN_KEY)).then(raw => {
  excelNewsSeen = cleanNewsSeen(raw);
  excelHelp.newsSeenChanged();
}, () => syncExcelNewsDot());
// The width saved before: read once (the store answers later); a bad value is ignored.
const HELP_SIZE_KEY = 'fmide-excel-help-size';
layoutsMigrated.then(() => layoutStore.get(HELP_SIZE_KEY)).then(raw => {
  if(typeof raw !== 'string' || !raw) return;
  try{ excelHelp.loadSize(JSON.parse(raw)); }catch(err){ /* unreadable: the usual width */ }
}, () => {});

(function wireHelp(){
  const btn = $('btnHelp');
  if(btn) btn.addEventListener('click', () => excelHelp.toggle());
  // F1 anywhere (the panel closes itself on F1 from inside).
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'F1' || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    ev.preventDefault();
    excelHelp.toggle();
  });
  // A "?" beside each panel's heading.
  const PANEL_TOPICS = [
    ['loadPanel', 'load-model'], ['periodsPanel', 'periods-output'], ['tabsPanel', 'tabs'],
    ['rowsPanel', 'rows'], ['customRowsPanel', 'rows'], ['generatePanel', 'generate'],
  ];
  // …and beside "Gather inputs on a separate tab".
  const inputsLabel = $('cfgInputsEnabled') && $('cfgInputsEnabled').parentNode;
  const places = PANEL_TOPICS.map(([id, topicId]) => [document.querySelector('#' + id + ' > h2'), topicId]).concat([[inputsLabel, 'inputs-tab']]);
  places.forEach(([h, topicId]) => {
    if(!h || !excelHelp.topic(topicId)) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-help';
    b.textContent = '?';
    b.title = 'Help: ' + excelHelp.topic(topicId).title;
    b.dataset.topic = topicId;
    b.addEventListener('click', () => excelHelp.open(topicId));
    h.appendChild(b);
  });
})();
