// =====================================================================================
// What's new in fmGraph (build step 15, docs/step15-fmgraph.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), like fmIDE's help text.
// =====================================================================================
// Plain data, shown by fmGraph's Help panel (options.whatsNew of the shared panel). The same
// shape as fmIDE's (src/help/fmide-whats-new.js), newest first, one entry per feature a
// person would notice. **A change people will notice adds its entry here in the same pull
// request.**
const FMGRAPH_WHATS_NEW = [
  { id: 'compare-a-b', date: '2026-10-02', title: 'Compare two what-ifs, and bars that glide',
    summary: 'Pin where the sliders are as A, try something else, and see the difference; bars now glide to new values.',
    what: [
      '📌 Pin as A keeps where the sliders are. The dashed outlines, difference labels and Biggest movers then compare with A instead of the model\'s own numbers, on every board, until you unpin it.',
      '⇄ Swap flips between A and where the sliders are now.',
      'Bars glide to their new heights when values change — not while you drag, and never when your device is set to reduce motion.',
    ],
    why: 'To weigh one what-if against another, not only against the model as it is.',
    how: [
      'Set the sliders for your first idea and press 📌 Pin as A.',
      'Move the sliders to your second idea and read the differences.',
      'Press ⇄ Swap to flip between them.',
    ],
    notes: ['A is never saved: opening a model starts without one.'],
    see: ['compare'] },

  { id: 'trace-and-movers', date: '2026-10-02', title: 'Trace and Biggest movers',
    summary: 'See what reaches a bar, and which rectangles your sliders change most.',
    what: [
      '🔍 on a bar or chart traces it: the sliders that reach it light up, a note shows the way each gets there (Price → Revenue → Profit), and lists the inputs that reach it with no slider yet, with + Slider.',
      'Biggest movers, under the sliders, lists the rectangles the sliders change most in the whole model — not only on the board — against the model\'s own numbers, biggest change in % first. + Bar puts one on the board.',
    ],
    why: 'To find out why a number moves — or doesn\'t — and to spot effects you weren\'t looking at.',
    how: [
      'Press 🔍 on a bar.',
      'Move a slider and read Biggest movers.',
      'Press Esc to stop tracing.',
    ],
    see: ['explore'] },

  { id: 'boards-in-documents', date: '2026-10-02', title: 'Boards saved in fmIDE\'s document',
    summary: 'Opened from fmIDE, your boards are kept in the .fmide document, with the model.',
    what: [
      'When fmIDE opened fmGraph, each change to the boards goes back to fmIDE: its document shows unsaved changes, and saving it there keeps the boards.',
      'A document that has boards shows them here, ahead of the ones this browser remembered — whether fmIDE sends it or you open the .fmide file here.',
    ],
    why: 'So a model and its boards travel together in one file, to another computer or another person.',
    how: [
      'In fmIDE, use Open fmGraph.',
      'Change the boards here.',
      'Save the document in fmIDE.',
    ],
    notes: ['A model opened here from a file keeps its changes in this browser only: use Boards ▾ to export them.'],
    see: ['board-kept'] },

  { id: 'boards', date: '2026-10-02', title: 'Boards: tabs, arranging, colours, undo, files',
    summary: 'Several boards per model, arranged by dragging, in your colours, with undo — and as files to share.',
    what: [
      'A model can have several boards, as tabs: + Board adds one; each can be renamed, duplicated or deleted.',
      'Drag a bar, chart or slider by its handle (⠿) to move it — by mouse, finger or the arrow keys — and make a bar or chart wide or narrow (⇔).',
      'Choose colours: a bar\'s, each rectangle\'s in a chart (click its colour in the key), each waterfall step\'s.',
      '↶ Undo and ↷ Redo (Ctrl+Z, Ctrl+Y) for every change to the boards.',
      'Boards ▾ exports a board, or all of them, as a file, and imports boards from one — or drop the file on the page.',
    ],
    why: 'To build several views of one model, lay them out the way you read them, and send them to others.',
    how: [
      'Press + Board for a new board.',
      'Drag widgets by ⠿ and widen them with ⇔.',
      'Boards ▾ → Export this board, and send the file.',
    ],
    notes: ['Where sliders are set is never saved: a board always opens on the model\'s own numbers.'],
    see: ['boards', 'board-file'] },

  { id: 'charts', date: '2026-10-02', title: 'Charts: columns and waterfalls',
    summary: 'Stacked or side-by-side columns with an optional totals check, and waterfalls whose totals are checked.',
    what: [
      '+ Chart adds a chart made of your own rectangles. Columns: groups of rectangles, each stacked into one column per period, side by side — a balance sheet is two groups. Tick the check, and each period shows ✓ when the groups\' totals agree, or ✗ and the gap.',
      'Waterfall: steps in one period — start, add, subtract, total — for an income statement, a cash bridge or any walk from one number to another. Each total is checked against the steps before it.',
      'Charts move with the sliders like bars: they light up when a slider reaches them, and show the model\'s own values as dashed outlines.',
    ],
    why: 'To see a whole statement move at once — and to spot at a glance when something stops adding up.',
    how: [
      'Press + Chart; its editor opens.',
      'Add rectangles and groups, or choose Waterfall and give each step its role.',
      'Move a slider.',
    ],
    notes: ['The sample model now has a small balance sheet and both kinds of chart.'],
    see: ['charts'] },

  { id: 'fmgraph', date: '2026-10-02', title: 'fmGraph: see how a value moves your model',
    summary: 'Bars show your rectangles; sliders change your inputs; the bars move as you slide.',
    what: [
      'fmGraph is a new companion to fmIDE. Bars show a rectangle\'s value in the periods you choose; sliders change an input rectangle, by setting its number or changing it by a percentage.',
      'Move a slider and every bar that depends on that input moves with it. The bars it reaches light up, a dashed outline shows the model\'s own value, and a label shows the difference.',
      'Your bars and sliders are remembered for each model in this browser.',
    ],
    why: 'To see, not just read, how one number affects the rest of a model.',
    how: [
      'In fmIDE, use Open fmGraph (File tab, App group) — or open a saved .fmide file here.',
      'Add a slider on an input and a bar on a result.',
      'Move the slider.',
    ],
    notes: ['fmGraph never changes your model: Reset all puts every number back.'],
    see: ['what-is-fmgraph', 'sliders', 'bars'] },
];
