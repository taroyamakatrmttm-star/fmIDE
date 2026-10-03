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
  { id: 'tutorials', date: '2026-10-03', title: 'Tutorials',
    summary: 'Four short guided tours, on a practice copy of the sample model.',
    what: [
      'Sliders and bars, Charts, Trace and compare, and Scenarios: at the top of Help, and 🎓 Learn with a tutorial on the first screen.',
      'A card shows one step at a time and moves on by itself once you have done it. Nothing is kept, and your own model comes back at the end.',
    ],
    why: 'So the quickest way to learn fmGraph is to try it, safely.',
    how: [
      'Press ❓ Help, then ▶ beside a tutorial.',
    ],
    see: ['tutorials'] },

  { id: 'scenario-waterfall', date: '2026-10-03', title: 'Scenario waterfall',
    summary: 'See how an output moves from the model\'s own number through each of your scenarios.',
    what: [
      'A third kind of chart: for each output, in one period, a waterfall from Start through each scenario — each step the change from the one before — to End.',
      'One small waterfall per output, side by side; it follows your scenarios as you change them.',
    ],
    why: 'So you can see what each scenario adds on top of the one before.',
    how: [
      'Save a few scenarios in the Scenarios panel.',
      'Press + Chart and choose Scenario waterfall at its top.',
      'In Edit chart, pick the period, the outputs and the scenarios.',
    ],
    see: ['charts', 'scenarios'] },

  { id: 'named-scenarios', date: '2026-10-03', title: 'Named scenarios',
    summary: 'Save where the sliders are under a name, switch between scenarios, and compare with any of them.',
    what: [
      'The Scenarios panel under the sliders: + Save as scenario keeps where the sliders are, named sc01, sc02… or your own name.',
      '▶ switches to a scenario, A compares with it, ⟳ updates it, ↑ ↓ order them.',
      'Scenarios are kept with the boards, in fmIDE\'s document too, and can be undone.',
    ],
    why: 'Pin as A held one what-if at a time; now you can keep as many as you need and move between them.',
    how: [
      'Set the sliders, then + Save as scenario, and type a name.',
      'Set them differently and save another.',
      'Press ▶ on either to switch, or A to see the differences from it.',
    ],
    see: ['scenarios', 'compare'] },

  { id: 'try-from-library', date: '2026-10-03', title: 'Try a template from the library',
    summary: 'fmIDE\'s Browse Library can show a shared template here with its board, before you add it.',
    what: [
      'A strip says which template and pack you are trying. Sliders, Trace, Pin as A and the boards all work.',
      'Nothing is kept in this browser or sent to fmIDE. Show fmIDE\'s model goes back to your own.',
    ],
    why: 'So you can see how a shared template behaves before adding it to your library.',
    how: [
      'On fmIDE\'s website: File → Browse Library…, choose a pack, then 📈 Try in fmGraph beside a template.',
    ],
    see: ['open-model', 'board-file'] },

  { id: 'boards-from-templates', date: '2026-10-03', title: 'Boards from templates',
    summary: 'A model built from templates starts with their boards; attach boards to a template straight from fmGraph.',
    what: [
      'A model with no boards of its own starts with the boards its templates carry: a canvas template\'s on each canvas made from it, a system template\'s when it all fits.',
      'Boards ▾ → Add boards from templates… adds them at any time, saying how many of their rectangles this model has.',
      'With fmGraph opened from fmIDE, Boards ▾ → Attach to template… sends the boards to fmIDE, which asks before attaching them.',
    ],
    why: 'So a template comes with its views, and sharing them takes one step.',
    how: [
      'In fmIDE, build a model from a template that carries a board, and open fmGraph.',
      'To share yours: Boards ▾ → Attach to template…, then answer fmIDE\'s question.',
    ],
    see: ['board-file'] },

  { id: 'boards-for-templates', date: '2026-10-02', title: 'Boards for templates',
    summary: 'Save your boards for a template, so they go along with it — in documents and in packs you share.',
    what: [
      'Boards ▾ → Export for a template… saves the boards for a template the model was built from: a canvas made from a canvas template (just that canvas), or the whole model for a system template.',
      'Attach the file to the template in fmIDE (Templates → 📈 Attach fmGraph board…). It then travels with the template — in documents, new versions and library packs.',
    ],
    why: 'So someone who uses your template also gets the boards that explain it.',
    how: [
      'Open a model built from your template, from fmIDE.',
      'Boards ▾ → Export for a template…, and choose the template.',
      'In fmIDE: Templates, select the template, 📈 Attach fmGraph board….',
    ],
    see: ['board-file'] },

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
