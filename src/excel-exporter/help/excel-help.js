// =====================================================================================
// ExcelExporter's help text (build step 10, phases H2 and H4; docs/step10-help.md).
// Copyright (c) 2026 Taro Yamaka. All rights reserved. Part of ExcelExporter and under its
// licence (src/excel-exporter/LICENSE), unlike fmIDE's help text (src/help/, CC BY 4.0).
// =====================================================================================
// Plain data, shown by ExcelExporter's Help panel (js/09d-help.js, which pulls it in with
// build:include) and published as the site's help pages under /help/excel/ (tools/build-help.js).
// ExcelExporter has no command list, so its topics name buttons in words.
//
//   EXCEL_HELP_GROUPS — the groups the topics are listed under, in order.
//   EXCEL_HELP_TOPICS — { id, group, title, keywords, summary, body }, as fmIDE's topics:
//                       { p } a paragraph · { steps: [...] } numbered · { tip } · { see: [ids] }.
//                       Topic ids are letters, digits and dashes (they become page addresses).
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
      { p: 'A system file (Save System) or a workspace (Export Workspace) works too. The number formats you set in fmIDE come across; how cells look is your own Excel style (panel 2).' },
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
      { see: ['rows', 'module-layouts', 'inputs-tab'] },
    ] },
  { id: 'module-layouts', group: 'layout', title: 'Modules remember their layout',
    keywords: 'module template reuse remember layout forget export import recipe repeat',
    summary: 'Arrange a module\'s tab once: every model that uses the module starts with the same layout.',
    body: [
      { p: 'A tab marked 🧩 comes from a module: a canvas you added from a template in fmIDE (recipes build them too). When you change such a tab — its name, the order of its rows, labels, blank or label rows, Include, formats, indents — ExcelExporter remembers that layout for the module.' },
      { steps: [
        'The next model with the same module, laid out here for the first time, starts with that layout. Rows are matched by rectangle name; rectangles the layout doesn\'t know go where the automatic sort puts them.',
        'A model you have already arranged keeps its own layout.',
        'Forget, on the tab, stops the module\'s layout being used for new models.',
        'Export Module Layouts saves them all as a file; Import Module Layouts reads one, for example on another computer.',
      ] },
      { tip: 'Rows you move to another tab stay in the module\'s own tab when the layout is used again.' },
      { see: ['tabs', 'tree-view'] },
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
        '🎨 on a row gives it its own fill, font colour, bold, border and number format in Excel. Reset to the Excel style takes it off.',
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
    keywords: 'format role colour fill font border sides size bold number format style excel style export import reset row',
    summary: 'Your own Excel style sets how every cell looks; fmIDE sets the number formats.',
    body: [
      { p: 'Every cell takes its look from one of seven roles in your Excel style (panel 2): Inputs, Calculations, Links, Headers, Section Headers, Labels and Notes.' },
      { steps: [
        'For each role, pick the fill, the font colour, bold, the font size (blank uses Excel\'s default) and the border: its style, colour and which sides.',
        'Changes are saved in this browser and used for every model you load here.',
        'Export Excel Style saves it as a file; Import Excel Style reads one, for example on another computer.',
        'Reset to Defaults puts every role back to ExcelExporter\'s built-in look.',
      ] },
      { p: 'Number formats come from fmIDE: a rectangle\'s own 🎨 number format, or its Inputs or Calculations format. Its canvas colours and fonts stay in fmIDE.' },
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
