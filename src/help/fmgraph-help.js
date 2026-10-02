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
      { see: ['open-model', 'bars', 'sliders'] },
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
  { id: 'reach', group: 'board', title: 'What a slider reaches',
    keywords: 'highlight reach depend dependency lit dim impact affected',
    summary: 'The bars a slider can move light up while you use it.',
    body: [
      { p: 'While you point at a slider or move it, the bars it reaches are outlined and the others fade. A bar is reached when its rectangle depends on the slider\'s input, directly or through other rectangles, aliases, period shifts or blocks.' },
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
    keywords: 'saved remember board kept browser storage reload',
    summary: 'Your bars and sliders, for each model, in this browser.',
    body: [
      { p: 'The bars and sliders you add are remembered in this browser for each model, and come back when you open it again — also when the model has changed a little in fmIDE. Sliders always start on the model\'s own numbers.' },
      { p: 'Nothing is sent anywhere: fmGraph works offline and keeps everything on this device.' },
      { see: ['open-model'] },
    ] },
];
