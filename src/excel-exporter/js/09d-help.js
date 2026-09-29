// ============================================================
// Help (build step 10, phase H2; docs/step10-help.md)
// ============================================================
// The same Help panel as fmIDE (src/shared/help-panel.js), with ExcelExporter's own topics:
// ❓ Help at the top right, F1, or the "?" beside each panel's heading, which opens that
// panel's topic. The topics are data in src/excel-exporter/help/excel-help.js (ExcelExporter's
// own, under its licence, unlike fmIDE's help text), also published as the site's /help/excel/.
// build:include shared/help-panel.js

// build:include excel-exporter/help/excel-help.js

const excelHelp = createHelpPanel({
  groups: EXCEL_HELP_GROUPS, topics: EXCEL_HELP_TOPICS,
  intro: 'Plain-English guides to ExcelExporter. Pick a topic, or search above. The "?" beside each panel\'s heading opens its topic.',
  placeholder: 'Search help — e.g. "scenarios" or "tree view"',
});

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
