// =====================================================================================
// fmShowcase's help text (the showcase viewer, phase V2 of docs/viewer-brief.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), like fmIDE's and fmGraph's help text, unlike the code around it.
// =====================================================================================
// Plain data, shown by the viewer's Help panel (src/viewer/js/09-help.js, the shared panel).
// The same shape as fmGraph's (src/help/fmgraph-help.js). Topic and group ids are letters,
// digits and dashes. When a feature changes, change its topic here in the same pull request.
const VIEWER_HELP_GROUPS = [
  { id: 'start', title: 'Getting started' },
  { id: 'board', title: 'The Board' },
  { id: 'logic', title: 'The Logic' },
];
const VIEWER_HELP_TOPICS = [
  { id: 'what-is-this', group: 'start', title: 'What this viewer is',
    keywords: 'about intro overview showcase viewer model read-only',
    summary: 'A model you can play with but not change.',
    body: [
      { p: 'This page shows a financial model built in fmIDE. On the Board you move its sliders and watch the bars and charts follow; on the Logic you see how every number is worked out.' },
      { p: 'Nothing you do changes the model. A slider is a "what if": the numbers show what the model would give, and Reset puts the model\'s own numbers back.' },
      { see: ['board', 'sliders', 'logic-view'] },
    ] },
  { id: 'board', group: 'board', title: 'The Board',
    keywords: 'bars charts board tabs waterfall columns lines tornado spider',
    summary: 'The bars and charts the model\'s author chose.',
    body: [
      { p: 'Each bar shows a rectangle of the model in each period; each chart shows several. When a slider changes them, the dashed outlines show the model\'s own numbers and the small labels the difference.' },
      { p: 'When the author made several boards, tabs at the top switch between them.' },
      { tip: 'A grey label "+2 at 0" under a chart\'s key lists the rectangles that are 0 in every period shown.' },
      { see: ['sliders', 'scenarios', 'trace'] },
    ] },
  { id: 'sliders', group: 'board', title: 'Sliders',
    keywords: 'slider move drag type number range step minus plus reset',
    summary: 'Move an input within the author\'s range.',
    body: [
      { p: 'Drag a slider, press − or +, or tap its number and type one. It stays within the range and steps the author chose; a double tap puts it back on the model\'s own number.' },
      { p: 'While you move a slider, the bars and charts it reaches are lit and the others fade.' },
      { p: 'Reset puts every slider back on the model\'s own numbers.' },
      { see: ['scenarios', 'kept'] },
    ] },
  { id: 'scenarios', group: 'board', title: 'Scenarios and Play',
    keywords: 'scenario base play stop swing animate pendulum compare',
    summary: 'Show a scenario, or swing between two.',
    body: [
      { p: 'The buttons above the sliders show each scenario the author saved, and Base the model\'s own numbers. A scenario may change inputs that have no slider here: its numbers are shown in full. Moving a slider then leaves the scenario.' },
      { p: 'Play swings the model between two ends — Base, a scenario, or My sliders — back and forth until you press ■ Stop or Esc. With reduced motion turned on in your device, it shows one end against the other, and ⇄ steps between them.' },
      { see: ['compare', 'sliders'] },
    ] },
  { id: 'compare', group: 'board', title: 'Comparing with A',
    keywords: 'pin a compare swap unpin outline difference',
    summary: 'Keep the numbers now, and compare with them.',
    body: [
      { p: '📌 Pin as A keeps the numbers as they are now. Until you press Unpin, the dashed outlines and the differences measure from A instead of the model\'s own numbers. ⇄ Swap puts the sliders where A had them and keeps where they were as A.' },
    ] },
  { id: 'trace', group: 'board', title: 'Trace and Biggest movers',
    keywords: 'trace reach magnifier what reaches movers changed most',
    summary: 'What reaches a bar, and what moved most.',
    body: [
      { p: '🔍 on a bar or chart lights the sliders that reach it, and a note says the way each one gets there ("Price → Revenue → Profit"), and which inputs reach it with no slider. 🔍 again, × or Esc clears it.' },
      { p: 'Biggest movers, folded under the sliders, lists the rectangles your sliders changed most, against the model\'s own numbers (or A).' },
    ] },
  { id: 'logic-view', group: 'logic', title: 'The Logic view',
    keywords: 'logic canvas diagram pan zoom fit pinch tabs',
    summary: 'The model\'s canvases, as fmIDE draws them.',
    body: [
      { p: 'Logic shows the model\'s canvases. Drag to move around; zoom with the wheel, a pinch or + and −; Fit shows the whole canvas. The tabs (☰ on a phone) switch canvases.' },
      { p: 'The numbers on the canvas follow the sliders and scenarios of the Board; an input they moved has a ring. They are for one period, named in the corner.' },
      { see: ['card'] },
    ] },
  { id: 'card', group: 'logic', title: 'How a number is worked out',
    keywords: 'card tap rectangle formula worked out inputs reads',
    summary: 'Tap a rectangle to see its numbers and formula.',
    body: [
      { p: 'Tapping a rectangle opens its card: its value in each period, and how it is worked out, with names and with numbers ("Revenue = Price × Volume: 12 × 1,000"). Tap a number it reads to go to it, on whatever canvas it is.' },
    ] },
  { id: 'excel', group: 'board', title: 'Download the model in Excel',
    keywords: 'excel workbook download xlsx spreadsheet scenario sliders dashboard',
    summary: '⬇ Excel gives you the model\'s workbook, on the numbers you see.',
    body: [
      { p: 'When the author included Excel, ⬇ Excel at the top downloads the model\'s workbook (on an iPhone or iPad, through the share sheet). The line beside it says what the file will hold.' },
      { p: 'A scenario you show is the case the workbook runs. When you have moved sliders, the workbook runs the model\'s own numbers with your sliders typed in on its Dashboard. Excel works every formula out when the file opens, so it shows the numbers you see here, and you can go on changing them in Excel.' },
      { p: 'A slider the workbook can\'t hold is named in the line. While Play runs, stop it first.' },
      { see: ['sliders', 'scenarios'] },
    ] },
  { id: 'kept', group: 'start', title: 'What this device keeps',
    keywords: 'kept saved remember storage reset privacy offline sent',
    summary: 'Your sliders, on this device only.',
    body: [
      { p: 'Where you left the sliders, the scenario and the board are kept in this browser, so opening the page again shows them. Reset forgets them. In a private window nothing is kept.' },
      { p: 'Nothing is ever sent anywhere: the page works offline, and the model is inside it.' },
    ] },
];
