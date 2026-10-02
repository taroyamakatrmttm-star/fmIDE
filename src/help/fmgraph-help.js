// =====================================================================================
// fmGraph's help text (build step 15, docs/step15-fmgraph.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), like fmIDE's help text, unlike the code around it.
// =====================================================================================
// Plain data, shown by fmGraph's Help panel (src/fmgraph/js/07-help.js, the shared panel).
// The same shape as fmIDE's (src/help/fmide-help.js), without commands: texts name buttons in
// words. Topic and group ids are letters, digits and dashes. When a feature changes, change
// its topic here in the same pull request.
const FMGRAPH_HELP_GROUPS = [
  { id: 'start', title: 'Getting started' },
  { id: 'board', title: 'Bars and sliders' },
];
const FMGRAPH_HELP_TOPICS = [
  { id: 'what-is-fmgraph', group: 'start', title: 'What fmGraph is',
    keywords: 'about intro overview what if impact sensitivity',
    summary: 'See how one value moves the rest of your model.',
    body: [
      { p: 'fmGraph shows a model built in fmIDE as bars, and lets you change its inputs with sliders. Move a slider and every bar that depends on that input, directly or through other rectangles, moves with it.' },
      { p: 'It never changes your model. A slider is a "what if": the bars show what the model would give with that number, and Reset puts the model\'s own number back.' },
      { tip: 'Use it to understand a model, to check it (a bar that moves when it shouldn\'t points at a wrong arrow), or to show it to people who don\'t build models.' },
      { see: ['open-model', 'bars', 'charts', 'sliders'] },
    ] },
  { id: 'open-model', group: 'start', title: 'Opening a model',
    keywords: 'open file drop fmide document system workspace sample load from fmide',
    summary: 'From fmIDE directly, or a saved .fmide or .json file.',
    body: [
      { p: 'The quickest way is from fmIDE: Open fmGraph (File tab, App group) opens fmGraph with the model you have open, without saving a file first. ↻ From fmIDE shows fmIDE\'s model again as it is now, after you changed it.' },
      { p: 'You can also open a file saved by fmIDE: a .fmide document (File → Save), or a system or workspace file. Use Open… at the top, or drop the file anywhere on the page.' },
      { p: 'Try the sample model on the first screen to see how it works.' },
      { tip: 'A file from someone else is only shown, never run: names and numbers are read as plain text.' },
      { see: ['what-is-fmgraph', 'board-kept'] },
    ] },
  { id: 'bars', group: 'board', title: 'Bars',
    keywords: 'bar chart value period periods ghost outline difference error',
    summary: 'A rectangle\'s value in each period you choose.',
    body: [
      { p: 'A bar widget shows one rectangle\'s value as a bar for each period: all periods, one period, or a range of periods. Choose the rectangle at the top of the widget.' },
      { p: 'When a slider has changed something it reaches, a dashed outline shows the model\'s own value and a label shows the difference, for example +250 (+12%). Point at a bar to read its numbers.' },
      { p: 'A bar marked ! couldn\'t be worked out in that period (for example a division by zero); the reason is listed below the chart.' },
      { steps: ['Press + Bar at the top.', 'Choose a rectangle from the list.', 'Choose which periods to show.'] },
      { see: ['sliders', 'reach'] },
    ] },
  { id: 'sliders', group: 'board', title: 'Sliders',
    keywords: 'slider input change set percent shift range step reset what if',
    summary: 'Change an input rectangle and watch the bars move.',
    body: [
      { p: 'A slider changes an input rectangle: one with no arrow into it (or only one from an operator that nothing feeds). It can set the input to a number, or change it by a percentage, in all periods, one period or a range of periods.' },
      { p: 'Drag the slider, use the arrow keys, or type a number in the box beside it. The slider stops at its steps; Range and step changes where it starts, ends and stops.' },
      { p: 'Reset puts one slider back to the model\'s own number; Reset all at the top puts every slider back.' },
      { steps: ['Press + Slider at the top.', 'Choose an input rectangle.', 'Choose the periods and whether to set the number or change it by %.', 'Move the slider.'] },
      { tip: 'Two sliders on the same input apply one after the other: a change by % applies to what the slider above it left.' },
      { see: ['reach', 'speed'] },
    ] },
  { id: 'charts', group: 'board', title: 'Charts: columns and waterfalls',
    keywords: 'chart columns stacked side by side group waterfall bridge balance sheet income statement check total',
    summary: 'Two building blocks for any statement: columns of groups, and waterfalls.',
    body: [
      { p: '+ Chart adds a chart. There are two kinds, chosen at its top; both are made from your own rectangles, so they fit any model.' },
      { p: 'Columns: a chart is a list of groups. Each group is one column per period, its rectangles stacked (values below zero stack downwards), and the groups stand side by side. One rectangle per group gives a plain column chart; one group of several a stacked chart; two groups — Assets, and Liabilities and equity — a balance sheet.' },
      { p: 'Tick "Check that the groups\' totals agree" and each period shows ✓ when the groups\' totals agree, or ✗ and the gap when they don\'t — a quick test that a balance sheet balances, also while you move a slider.' },
      { p: 'Waterfall: a list of steps in one period. A start is a full bar; add and subtract step up or down from the running total; a total is a full bar of its own rectangle\'s value, checked against the steps before it (✓, or ✗ and what they add up to). An income statement is Revenue (start), costs (subtract) and each profit line (total); a cash bridge or a cost walk work the same way.' },
      { steps: ['Press + Chart at the top. Its editor opens.', 'Choose the rectangles: + Rectangle adds one to a group, + Group a new group; ↑ ↓ reorder, × removes.', 'Or choose Waterfall at the top of the chart, then each step\'s role.'] },
      { tip: 'Numbers agree when they differ by less than a millionth of their size, so tiny rounding never shows as ✗. A chart mixing units says so below it.' },
      { see: ['bars', 'reach'] },
    ] },
  { id: 'boards', group: 'board', title: 'Boards: tabs, arranging, colours, undo',
    keywords: 'board boards tab tabs arrange move drag order wide narrow colour color undo redo rename duplicate delete',
    summary: 'Several boards per model, arranged as you like.',
    body: [
      { p: 'A model can have several boards — for example one for the statements and one for pricing — shown as tabs above the board. + Board adds an empty one; ✎ (or a double-click on its tab) renames the board shown, ⧉ duplicates it and 🗑 deletes it (after asking; the last board stays). Each board has its own bars, charts and sliders.' },
      { p: 'Drag a bar, chart or slider by its handle (⠿) to move it among the others — by mouse, by finger, or with the arrow keys on the handle. ⇔ makes a bar or chart wide (the whole row) or narrow (half of it).' },
      { p: 'Colours: a bar\'s colour box, beside its periods; in a chart, click a rectangle\'s colour in its key; a waterfall step\'s colour is in Edit chart.' },
      { p: '↶ Undo and ↷ Redo (Ctrl+Z, Ctrl+Y) take back any change to the boards — not where a slider is set, which is a "what if", not a change.' },
      { see: ['board-file', 'charts'] },
    ] },
  { id: 'board-file', group: 'board', title: 'Saving and sharing boards',
    keywords: 'export import file board json share send save',
    summary: 'Boards travel as a file.',
    body: [
      { p: 'Boards ▾ at the top: Export this board, or Export all boards, saves a board file. Import boards… (or dropping a board file on the page) adds its boards as new tabs to the model you have open.' },
      { p: 'A board names its rectangles by canvas, id and name, so it fits the model it was made from, or another one built from the same templates. Anything it shows that isn\'t in this model is left out, and fmGraph says how much.' },
      { tip: 'Where sliders are set is not saved: a board always opens on the model\'s own numbers.' },
      { see: ['boards', 'board-kept'] },
    ] },
  { id: 'reach', group: 'board', title: 'What a slider reaches',
    keywords: 'highlight reach depend dependency lit dim impact affected',
    summary: 'The bars a slider can move light up while you use it.',
    body: [
      { p: 'While you point at a slider or move it, the bars and charts it reaches are outlined and the others fade (a chart is reached when any of its rectangles is). A bar is reached when its rectangle depends on the slider\'s input, directly or through other rectangles, aliases, period shifts or blocks.' },
      { p: 'This comes from the arrows in the model, not from which numbers happened to change, so a bar that is reached but doesn\'t move tells you something too (for example an IF that ignores that input).' },
      { see: ['sliders', 'bars'] },
    ] },
  { id: 'speed', group: 'board', title: 'Large models',
    keywords: 'slow speed large working out ahead fast smooth',
    summary: 'On a large model fmGraph works a slider\'s steps out ahead.',
    body: [
      { p: 'Each slider position means working the whole model out again. Most models take a few thousandths of a second, so the bars follow the slider as it moves.' },
      { p: 'On a model that takes longer, grabbing a slider works out each of its steps ahead ("Working out this slider\'s steps…" beside Bars), with the other sliders where they are. Dragging then shows results already worked out, and each one is exact: the slider stops at its steps, so nothing is guessed in between.' },
      { tip: 'Fewer steps (Range and step) means less to work out ahead.' },
      { see: ['sliders'] },
    ] },
  { id: 'board-kept', group: 'start', title: 'What fmGraph remembers',
    keywords: 'saved remember board kept browser storage reload document fmide save',
    summary: 'Your bars and sliders, for each model, in this browser.',
    body: [
      { p: 'Your boards — their bars, charts and sliders, how they are arranged and coloured — are remembered in this browser for each model, and come back when you open it again — also when the model has changed a little in fmIDE. Sliders always start on the model\'s own numbers. To move boards to another computer or person, export them (Boards ▾).' },
      { p: 'Opened from fmIDE, your boards are also kept in fmIDE\'s document: each change to them goes back to fmIDE, whose document then has unsaved changes, and saving it there keeps the boards with the model. A document that has boards shows them here instead of the ones this browser remembered — from fmIDE, or a .fmide file opened here.' },
      { p: 'Nothing is sent anywhere: fmGraph works offline and keeps everything on this device.' },
      { see: ['open-model'] },
    ] },
];
