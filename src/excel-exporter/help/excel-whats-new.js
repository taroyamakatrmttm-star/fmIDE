// =====================================================================================
// What's new in ExcelExporter (build step 10, phase H5b; docs/step10-help.md).
// Copyright (c) 2026 Taro Yamaka. All rights reserved. Part of ExcelExporter and under its
// licence (src/excel-exporter/LICENSE), like its help text.
// =====================================================================================
// Plain data, shown by ExcelExporter's Help panel (js/09d-help.js, options.whatsNew of the
// shared panel). One entry per feature a person would notice, newest first; changes only
// developers see are left out. The same shape as fmIDE's (src/help/fmide-whats-new.js):
//   { id, date: 'YYYY-MM-DD', title, summary,
//     what: [paragraphs], why, how: [numbered steps], notes: [tips], see: [topic ids] }
// ExcelExporter has no command list, so texts name buttons in words. Test group 43 checks it.
// **A change people will notice adds its entry here in the same pull request.**
const EXCEL_WHATS_NEW = [
  { id: 'whats-new', date: '2026-10-02', title: 'What\'s new, inside Help',
    summary: 'Every update to ExcelExporter, newest first: what changed, why, and how to use it.',
    what: [
      'The Help panel now opens with What\'s new: the latest updates, and Every update for the whole list. Each update has its own page saying what changed, why, and how to use it.',
      'Updates you haven\'t seen yet are marked New, and ❓ Help carries a small dot until you have looked.',
    ],
    why: 'One place to catch up on what is new, in plain words.',
    how: [
      'Press ❓ Help (or F1) and look at What\'s new at the top.',
      'Pick an update to read its page; Back returns to the list.',
    ],
    notes: ['Opening the list of every update marks them all as seen.'],
    see: ['what-is-excelexporter'] },

  { id: 'wider-help', date: '2026-10-02', title: 'A wider Help panel',
    summary: 'Widen Help to a reading view with ⤢, or drag its edge to any width.',
    what: [
      '⤢ at the top of the Help panel widens it to two thirds of the window, with larger text; ⤡ brings it back. You can also drag its left edge to any width; a double-click on the edge goes back to the usual width.',
    ],
    why: 'The narrow panel was cramped for reading longer guides.',
    how: ['Open Help, then press ⤢ or drag the panel\'s left edge.'],
    notes: ['Help remembers the width. The page stays beside the panel.'],
    see: ['what-is-excelexporter'] },

  { id: 'what-is-remembered', date: '2026-10-02', title: 'Help explains what is remembered',
    summary: 'New guides on what ExcelExporter keeps in your browser, and which layout wins.',
    what: [
      'A guide, What is remembered, and which layout wins: the three things kept in this browser (each model\'s layout, each module\'s layout, your Excel style), that Start Over keeps them, and the order a layout comes from when a file loads.',
      'A guide, A template\'s attached layout: how to attach a module\'s layout in fmIDE, where it travels, and exactly when it is used. How the workbook looks now says which format wins.',
    ],
    why: 'What ExcelExporter remembers, and why a layout comes back, was confusing.',
    how: ['Open Help and read the two guides below.'],
    see: ['remembered', 'template-layouts', 'formats'] },

  { id: 'new-operators', date: '2026-10-01', title: 'New operators in the workbook',
    summary: 'if, period, comparisons, rounding, ln, exp, sqrt, int, trunc and choose become Excel formulas.',
    what: [
      'The operators fmIDE gained — the period number, if, =, ≠, and, or, not, round, roundup, rounddown, ln, exp, sqrt, int, trunc and choose — are written as Excel\'s own functions (IF, ROUND, LN, CHOOSE and the rest), so the workbook calculates exactly as fmIDE does.',
      'In Excel, the period number reads the sheet\'s Period # cells.',
    ],
    why: 'So models using them still become live, ordinary Excel formulas.',
    how: ['Nothing to do: load a model that uses them and generate as usual.'],
    see: ['differences'] },

  { id: 'instance-layouts', date: '2026-10-01', title: 'Block instances remember their layout',
    summary: 'Arrange a block\'s instance tab once; other instances and models follow.',
    what: [
      'For a block added from a template in fmIDE, ExcelExporter remembers how you arranged an instance tab, and every model with that block starts its instance tabs that way the first time it is laid out.',
      'Lay out the other instances like this, on an instance tab in the Tabs panel, gives the block\'s other instances in the model the same layout — for any block.',
    ],
    why: 'A block used many times meant arranging the same tab many times.',
    how: [
      'Arrange one instance tab (its rows, labels, formats).',
      'In the Tabs panel, press Lay out the other instances like this on it.',
    ],
    notes: ['Tab names are kept. Forget on an instance tab forgets only the instances\' layout.'],
    see: ['module-layouts', 'blocks'] },

  { id: 'template-layouts', date: '2026-09-30', title: 'A template\'s Excel layout is used',
    summary: 'A module whose template carries an Excel layout is laid out with it.',
    what: [
      'Load a .fmide document or workspace: a module whose template has an Excel layout attached — yours, or one from a library pack — is laid out with it the first time the model is laid out here. The tab says "layout from the template".',
    ],
    why: 'So a module arranged once looks right for everyone who uses its template.',
    how: [
      'In fmIDE, attach the layout to the template (📎 Attach Excel layout… in the Templates window).',
      'Save the document, then load it here.',
    ],
    notes: ['Your own remembered layout for a module wins. A system file (Save System) carries no templates.'],
    see: ['template-layouts', 'remembered'] },

  { id: 'module-layouts', date: '2026-09-30', title: 'Modules remember their layout',
    summary: 'Arrange a module\'s tab once; every model with that module starts with it.',
    what: [
      'When you change the tab of a module — a canvas added from a template in fmIDE — ExcelExporter remembers its layout: tab name, row order, labels, blank and label rows, Include / Constant, formats and indents.',
      'Every model with that module starts with it the first time it is laid out here. Rows are matched by rectangle name.',
    ],
    why: 'The same module appears in many models; arranging it every time was repetitive.',
    how: [
      'Arrange a tab marked 🧩.',
      'Load another model with the same module: its tab is laid out the same way.',
    ],
    notes: ['A model you have already arranged keeps its own layout. Export / Import Module Layouts move them to another computer; Forget drops one.'],
    see: ['module-layouts', 'remembered'] },

  { id: 'excel-style', date: '2026-09-30', title: 'Your own Excel style',
    summary: 'Set how every cell looks in Excel, once, for every model.',
    what: [
      'The Excel style (panel 2) sets, for each of seven roles — Inputs, Calculations, Links, Headers, Section Headers, Labels, Notes — the fill, font colour, bold, font size and border. It is kept in this browser and used for every model.',
      'Number formats still come from fmIDE; colours and fonts on fmIDE\'s canvas stay on the canvas.',
    ],
    why: 'Your workbooks should look like yours, whoever built the model.',
    how: [
      'Open the Excel style in panel 2 and change a role.',
      'Export Excel Style moves it to another computer; Reset to Defaults brings back the built-in look.',
    ],
    notes: ['To highlight a single row, use 🎨 on it in the Tree View.'],
    see: ['formats'] },

  { id: 'help-pages-site', date: '2026-09-30', title: 'Help pages on the website',
    summary: 'ExcelExporter\'s guides as plain pages at /help/excel/ on fmIDE\'s site.',
    what: ['Every ExcelExporter guide is also a page on the published site, made from the same text as the Help panel.'],
    why: 'To read the guides outside the app, share a link, or print them.',
    how: ['Open the site\'s /help/excel/ address in a browser.'],
    see: ['what-is-excelexporter'] },

  { id: 'help-panel', date: '2026-09-30', title: 'Help inside ExcelExporter',
    summary: 'Plain-English guides beside the page: ❓ Help, F1, or ? beside each panel.',
    what: [
      'A Help panel with guides to loading a model, tabs, rows, the Tree View, blocks, the Inputs tab, scenarios, formatting, the list of differences and generating. It sits beside the page, so you can follow the steps while you work.',
    ],
    why: 'So the answer to "how do I…" is always at hand, even offline.',
    how: ['Press ❓ Help, F1, or the ? beside a panel\'s heading.'],
    see: ['what-is-excelexporter'] },

  { id: 'back-to-fmide', date: '2026-09-29', title: '← Back to fmIDE',
    summary: 'A button at the top left returns to fmIDE.',
    what: [
      'On a computer, ← Back to fmIDE closes ExcelExporter\'s window, showing fmIDE again as you left it (it asks first when a model is loaded). On an iPad home-screen app, it goes back to fmIDE.',
      'fmIDE\'s Open ExcelExporter now brings this window back instead of loading it again, so a model loaded here is not lost.',
    ],
    why: 'Going back and forth between building and exporting should be easy and never lose work.',
    how: ['Press ← Back to fmIDE at the top left.'],
    notes: ['Your layout is kept; load the file again next time.'],
    see: ['back-to-fmide'] },

  { id: 'inputs-tab-links', date: '2026-09-28', title: 'Inputs read from another tab come from the Inputs tab',
    summary: 'With the Inputs tab, formulas point straight at the input\'s cell there.',
    what: [
      'With the Inputs tab on, a formula reading an input from another tab now points at the input\'s cell on the Inputs tab, where its numbers live — not at the input\'s own row, which only links there.',
    ],
    why: 'Following a formula back to its input now takes one step instead of two.',
    how: ['Turn on Gather inputs on a separate tab (panel 3) and generate.'],
    notes: ['The values don\'t change.'],
    see: ['inputs-tab'] },

  { id: 'touch-tree', date: '2026-09-28', title: 'The Tree View by finger',
    summary: 'Hold a row for its menu, double-tap to rename, on a tablet.',
    what: [
      'On a touchscreen, press and hold a row in the Tree View for its menu, which also offers Add to / Remove from selection and Select from the last row to here. Double-tap a row to rename it.',
    ],
    why: 'So a workbook can be arranged on a tablet.',
    how: ['Open the Tree View and press and hold a row.'],
    see: ['tree-view'] },

  { id: 'sorted-new-layout', date: '2026-09-28', title: 'A new layout starts in formula order',
    summary: 'Rows start in calculation order, inputs first; vintages stay together.',
    what: [
      'A model laid out for the first time starts sorted by calculation order, inputs first, in formula order within each group. A saved layout keeps its order.',
      'Sorting no longer splits a vertical block\'s vintage and Total rows apart, and renaming by double-click always hits the row you clicked.',
    ],
    why: 'A workbook should read top to bottom in the order things are calculated.',
    how: ['Load a model; use Sort rows by to re-sort at any time.'],
    see: ['rows'] },

  { id: 'row-format', date: '2026-09-27', title: 'A row\'s own format, indents and a full right-click menu',
    summary: 'Give one row its own look, indent labels, and do everything from the right-click menu.',
    what: [
      '🎨 on any row in the Tree View gives it its own fill, font colour, bold, border and number format in Excel. Reset to the Excel style takes it off.',
      'Alt+Shift+→ and ← indent the selected labels, like Excel\'s Increase Indent. Right-click on rows offers every command of the selection bar.',
    ],
    why: 'Highlighting a total or indenting sub-items makes a workbook easier to read.',
    how: [
      'Select rows in the Tree View.',
      'Right-click for the menu, or use 🎨 and Alt+Shift+→.',
    ],
    see: ['tree-view'] },

  { id: 'tidier-formulas', date: '2026-09-27', title: 'Tidier formulas and new defaults',
    summary: 'Brackets only where Excel needs them; links shown as links.',
    what: [
      'Formulas have brackets only where Excel\'s order of operations needs them: =F4*(1-F5) instead of =(F4*(1-F5)).',
      'A rectangle that only pulls a value from another sheet is written =Sales!E7 and gets the Links format.',
      'A new layout starts without enforced sections, in formula order, with period labels on the Inputs tab\'s group headers.',
    ],
    why: 'A workbook people will read and audit should look like one a person wrote.',
    how: ['Nothing to do; the values don\'t change.'],
    see: ['rows', 'formats'] },

  { id: 'function-calls', date: '2026-09-27', title: 'Your own functions in Excel',
    summary: 'fmIDE functions are written out as ordinary formulas, listed on a Functions tab.',
    what: [
      'A cell that reads one of fmIDE\'s functions holds the function\'s formula with each input replaced by the cell it reads: Margin(Revenue, Cost) becomes =(E5-E6)/E5. A Functions tab lists each function written out.',
    ],
    why: 'So a model using functions still becomes a plain workbook anyone can follow, with no macros or add-ins.',
    how: ['Nothing to do: load a model with functions and generate.'],
    notes: ['A formula a call would make longer than Excel allows is written as #N/A and listed before download.'],
    see: ['differences'] },

  { id: 'differences', date: '2026-09-27', title: 'Same numbers as fmIDE, and a list where they differ',
    summary: 'The workbook calculates as fmIDE does; before download, a list shows any difference.',
    what: [
      'ExcelExporter writes its formulas from the same description of the model that fmIDE calculates on, and the two are checked against each other on every sample model.',
      'Before you download, a yellow list shows where the workbook will differ from fmIDE — usually something broken in the model, such as a loop or an alias to nothing.',
    ],
    why: 'A workbook is only trustworthy if it gives exactly the numbers you saw while building.',
    how: ['Read the yellow list above Generate, fix the model in fmIDE if needed, and download.'],
    notes: ['The list never blocks the download. Generate is faster on large models.'],
    see: ['differences'] },

  { id: 'update-notice', date: '2026-09-27', title: 'A notice when a new version is ready',
    summary: 'On the website, ExcelExporter says when an update is ready, like fmIDE.',
    what: ['On the web app, ExcelExporter shows "A new version is ready" with Reload (your layout is kept; load your file again) and Later.'],
    why: 'It used to stay on the old version without saying so.',
    how: ['Press Reload when the notice appears.'],
    see: ['load-model'] },

  { id: 'block-inputs', date: '2026-09-27', title: 'Block inputs in the workbook',
    summary: 'Unconnected block inputs get their own row; Block Input rectangles join the Inputs tab.',
    what: [
      'When nothing feeds a block instance\'s input, that input gets its own row on the instance\'s tab, holding the number typed in the block, and the block\'s formulas refer to it.',
      'Gather inputs on a separate tab also gathers rectangles marked Block Input in fmIDE, when their canvas is not used as a block.',
    ],
    why: 'Every number the workbook uses should be visible and changeable in a cell.',
    how: ['Nothing to do: generate as usual.'],
    see: ['blocks', 'inputs-tab'] },

  { id: 'fmide-documents', date: '2026-09-27', title: 'Load .fmide documents',
    summary: 'Open the file fmIDE\'s Save writes, as well as system and workspace files.',
    what: ['The model picker accepts .fmide documents, the files fmIDE saves with File → Save.'],
    why: 'So the file you keep is the file you export.',
    how: ['Drop a .fmide file on panel 1, or click the box to choose it.'],
    see: ['load-model'] },

  { id: 'foundations', date: '2026-09-26', title: 'Where ExcelExporter started',
    summary: 'A built-in Excel writer, scenarios, the Inputs tab and vertical blocks.',
    what: [
      'ExcelExporter writes .xlsx files itself, offline, with formulas that recalculate when the workbook opens.',
      'Scenarios per input and global cases on a Scenarios tab; an Inputs tab gathering every input; the same column layout on every tab; vertical blocks with a Vintage column; row sorting and the Tree View.',
    ],
    why: 'To turn an fmIDE model into a workbook people can use and audit, entirely on your computer.',
    how: ['Load a model, arrange it if you like, and press Generate & Download .xlsx.'],
    see: ['what-is-excelexporter', 'scenarios'] },
];
