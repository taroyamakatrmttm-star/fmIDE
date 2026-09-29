// ============================================================
// Help (build step 10, phase H2; docs/step10-help.md)
// ============================================================
// The same Help panel as fmIDE (src/shared/help-panel.js), with ExcelExporter's own topics:
// ❓ Help at the top right, F1, or the "?" beside each panel's heading, which opens that
// panel's topic. ExcelExporter has no command list, so its topics name buttons in words.
// This text belongs to ExcelExporter (its licence), unlike fmIDE's help text.
// build:include shared/help-panel.js

const EXCEL_HELP_GROUPS = [
  { id: 'start',    title: 'Getting started' },
  { id: 'layout',   title: 'Arranging the workbook' },
  { id: 'inputs',   title: 'Inputs and scenarios' },
  { id: 'format',   title: 'Formatting' },
  { id: 'generate', title: 'Making the workbook' },
];

const EXCEL_HELP_TOPICS = [
  { id: 'what-is-excelexporter', group: 'start', title: 'What ExcelExporter does',
    keywords: 'introduction overview about excel workbook xlsx formulas',
    summary: 'Turns an fmIDE model into an Excel workbook with live formulas.',
    body: [
      { p: 'ExcelExporter reads a model you built in fmIDE and writes an Excel workbook (.xlsx) whose cells hold real formulas, so it calculates exactly as fmIDE does and keeps working when you change an input in Excel.' },
      { steps: [
        'Load the model (panel 1).',
        'Check the period labels and the file name (panel 2).',
        'Arrange the tabs and rows, if you like (panels 3 and 4).',
        'Press Generate & Download .xlsx (panel 5).',
      ] },
      { p: 'Everything happens in your browser: nothing is uploaded, and it works offline.' },
      { see: ['load-model', 'generate'] },
    ] },
  { id: 'load-model', group: 'start', title: 'Loading a model',
    keywords: 'load open file fmide json drop sample paste system workspace',
    summary: 'Open a .fmide document, or a system or workspace file saved by fmIDE.',
    body: [
      { steps: [
        'In fmIDE, save your model (File → Save gives a .fmide file).',
        'Here, drop the file on the box in panel 1, or click the box to choose it.',
      ] },
      { p: 'A system file (Save System) or a workspace (Export Workspace) works too. A workspace, or a .fmide document, also carries fmIDE\'s format roles, so the workbook looks the way you set it up.' },
      { p: 'To see how it works first, press ▶ Load Sample Model.' },
      { p: 'Your layout (tabs, rows, names, order) is remembered in this browser for each model, so loading the same model again brings it back.' },
      { see: ['what-is-excelexporter', 'back-to-fmide'] },
    ] },
  { id: 'back-to-fmide', group: 'start', title: 'Going back to fmIDE',
    keywords: 'back fmide return window close',
    summary: '← Back to fmIDE, at the top left.',
    body: [
      { p: '← Back to fmIDE returns to fmIDE. When ExcelExporter has its own window, it closes that window (asking first if a model is loaded; your layout is kept, and you load the file again next time). On an iPad, where ExcelExporter took fmIDE\'s place, it goes back to fmIDE.' },
      { p: 'Start Over clears the model loaded here. Saved layouts are kept.' },
    ] },
  { id: 'periods-output', group: 'layout', title: 'Period columns and the file name',
    keywords: 'period columns header label year quarter month frequency file name number format',
    summary: 'How the period columns are labelled, the fallback number format and the file name.',
    body: [
      { p: 'Each period of fmIDE\'s timeline becomes a column. Panel 2 only decides how the columns are labelled: the first label (for example 2027) and the frequency (annual, quarterly or monthly).' },
      { p: 'The fallback number format is used for cells whose rectangle has no number format of its own.' },
      { p: 'The output file name is the name of the downloaded workbook.' },
      { see: ['formats', 'generate'] },
    ] },
  { id: 'tabs', group: 'layout', title: 'Tabs',
    keywords: 'tab sheet worksheet rename reorder add delete',
    summary: 'One Excel tab per fmIDE canvas to start with; rename, reorder, add or delete them.',
    body: [
      { p: 'Panel 3 lists the workbook\'s tabs. Each fmIDE canvas starts as its own tab. Rename a tab by typing its name, move it with ↑ and ↓, add one with + Add Tab, or delete one with 🗑 Delete (its rows move to the first remaining tab).' },
      { p: 'Which rows go on which tab is set in panel 4.' },
      { see: ['rows', 'inputs-tab'] },
    ] },
  { id: 'rows', group: 'layout', title: 'Rows: what goes where',
    keywords: 'rows order include constant section label move sort custom row group by canvas tab',
    summary: 'Every rectangle becomes a labelled row: choose its tab, place, label, and whether it is included.',
    body: [
      { p: 'Each value rectangle becomes one row. Operators, aliases and period shifts don\'t get rows: they become part of the formulas.' },
      { p: 'Panel 4 shows the rows grouped by canvas, grouped by Excel tab, or as a Tree View. For each row you can:' },
      { steps: [
        'change its label;',
        'move it to another tab or up and down;',
        'untick Include to leave it out;',
        'tick Constant to put a small fixed number (a sign flip, ×1000) straight into the formulas instead of giving it a row.',
      ] },
      { p: 'To move several rows at once, tick the box at the left of each and use the bar that appears above the table.' },
      { p: 'Sort rows by reorders rows: by calculation order (inputs first, or results first), by position on the canvas, or alphabetically; press Apply. + Add Custom Row adds a label or divider row.' },
      { p: 'With Enforce Input / Calc / Output sections ticked, each tab has INPUTS, CALCULATIONS and OUTPUTS bands. Untick it for one free list per tab.' },
      { see: ['tree-view', 'blocks', 'tabs'] },
    ] },
  { id: 'tree-view', group: 'layout', title: 'The Tree View',
    keywords: 'tree view select rename right-click menu indent format row shift ctrl',
    summary: 'Every tab\'s rows as one list: select, rename, indent, format and move them.',
    body: [
      { p: 'Tree View shows every row of each tab in order, including left-out ones (dimmed), as they will appear in Excel.' },
      { steps: [
        'Click a row to select it. Ctrl-click (Cmd-click on a Mac) adds or removes one, and Shift-click selects a range.',
        'Double-click a row\'s label to rename it.',
        'Right-click rows for every command: move, include, constant, scenarios, indent, format, move to another tab.',
        'Alt+Shift+→ and Alt+Shift+← indent the selected labels, like Excel\'s Increase Indent.',
        '🎨 on a row gives it its own fill, font colour, bold, border and number format in Excel. Reset to fmIDE\'s format takes it off.',
      ] },
      { p: 'On a tablet, press and hold a row for its menu, and double-tap to rename.' },
      { see: ['rows', 'formats'] },
    ] },
  { id: 'blocks', group: 'layout', title: 'Blocks in the workbook',
    keywords: 'block instance vertical vintage total unpacked',
    summary: 'A block is unpacked into its own rows; a vertical block into one set per period, plus a total.',
    body: [
      { p: 'A block used in fmIDE gets its own group of rows in the workbook ("Block instance —"), once per instance, since each instance calculates on its own.' },
      { p: 'A vertical block gets a set of rows for each period (V1, V2, …) and a Σ Total row for each output that combines them, as its output does in fmIDE. With many periods that can be many rows: reorder, rename or leave them out like any other.' },
      { see: ['rows'] },
    ] },
  { id: 'inputs-tab', group: 'inputs', title: 'The Inputs tab',
    keywords: 'inputs tab gather assumptions separate group order',
    summary: 'Gather every typed-in number on one tab, with the other tabs linking to it.',
    body: [
      { p: 'Tick Gather inputs on a separate tab (panel 3) to put every input (a rectangle with no arrow in) on its own tab. Its original row stays where it was and links to the Inputs tab, shown in the Links format.' },
      { p: 'Choose the tab\'s name, how its rows are grouped (by Excel tab, by canvas, or not at all) and their order. Re-apply layout rebuilds the grouping from these settings.' },
      { see: ['scenarios', 'rows'] },
    ] },
  { id: 'scenarios', group: 'inputs', title: 'Scenarios and global cases',
    keywords: 'scenario case global switch sensitivity base high low',
    summary: 'Give an input several values and choose which one the workbook runs.',
    body: [
      { steps: [
        'Turn on the Inputs tab (panel 3).',
        'On a row of the Inputs tab (panel 4), tick scenarios — or select several rows and use ≡ Add Scenarios. That input gets several values, one per scenario: the first is fmIDE\'s value, the others start empty for you to fill in Excel. Scenarios per variable sets how many.',
        'A Scenarios tab in the workbook picks which scenario each input uses.',
      ] },
      { p: 'With Global cases above 0, each case picks one scenario for every input, and a single Global Case cell chooses the case the whole workbook runs.' },
      { see: ['inputs-tab'] },
    ] },
  { id: 'formats', group: 'format', title: 'How the workbook looks',
    keywords: 'format role colour fill font border number format style row',
    summary: 'Formatting comes from fmIDE\'s format roles, with a row\'s own format on top.',
    body: [
      { p: 'Every cell takes its fill, font colour and border from one of fmIDE\'s seven format roles: Inputs, Calculations, Links, Headers, Section Headers, Labels and Notes. Change them in fmIDE (File → Format Presets); they travel inside the file you load here. Panel 2 shows them.' },
      { p: 'A rectangle\'s own 🎨 format in fmIDE sets its number format, weight and size here too.' },
      { p: 'In the Tree View, 🎨 on a row gives just that row its own look in this workbook.' },
      { see: ['tree-view', 'periods-output'] },
    ] },
  { id: 'differences', group: 'generate', title: 'Where the workbook differs from fmIDE',
    keywords: 'differences yellow list warning na n/a error loop broken too long',
    summary: 'The yellow list above Generate says where Excel can\'t calculate as fmIDE does.',
    body: [
      { p: 'The workbook calculates exactly as fmIDE does. Where it can\'t, a yellow list above the Generate button says where, before you download. For example:' },
      { steps: [
        'something broken in the model, such as an alias to a rectangle that was deleted, a loop, or two arrows into one rectangle (fmIDE shows "?");',
        'a row you left out that other rows read;',
        'a function fmIDE can\'t calculate, or a formula too long for Excel (the cell shows #N/A).',
      ] },
      { p: 'The download still works. Fix the model in fmIDE, or the layout here, and the list goes away.' },
      { see: ['generate'] },
    ] },
  { id: 'generate', group: 'generate', title: 'Generating and saving the layout',
    keywords: 'generate download xlsx mapping export import reset layout',
    summary: 'Download the workbook; save, share or reset the layout.',
    body: [
      { p: 'Generate & Download .xlsx writes the workbook. Excel works out every formula when it opens the file.' },
      { p: 'Your layout is saved in this browser as you go. Export Mapping JSON saves it to a file (to share it, or keep it safe), and Import Mapping JSON loads one. Reset Mapping to Defaults discards the layout for this model and starts again.' },
      { see: ['differences', 'rows'] },
    ] },
];

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
