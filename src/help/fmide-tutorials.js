// =====================================================================================
// fmIDE's tutorials (build step 10, phase H3; docs/step10-help.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), unlike the code around it.
// =====================================================================================
// Plain data, run by src/fmide/js/01c-tutorials.js in practice mode (your own model is set
// aside and comes back unchanged). Each step moves on by itself once what it asks for is
// done; nothing is done for you.
//
//   TUTORIALS — { id, title, minutes, summary, topic, start?, steps }
//     start — the practice model to begin from (left out: one empty canvas):
//             { periods: n, canvases: [{ name, nodes: [{ id, type, x, y, text, … }], edges: [{ from, to }] }] }
//     step: { id, text, point?, done? }
//       text  — plain English; {cmd:id} shows that command as a button (as in the help topics)
//       point — what to point at: { cmd: id } a ribbon button (or its tab first),
//               { node: 'Name' } a rectangle, { nodeButton: ['Name', 'period-btn'] } one of its buttons
//       done  — what must be true to move on (all of the listed checks):
//               { rect: { name, value?, uom? } }       a rectangle (name matched ignoring capitals)
//               { operator: '×' }                      an operator with that symbol
//               { periodShift: -1 }                    a period shift with that shift
//               { arrow: { from, to } }                an arrow; from/to: a rectangle's name,
//                                                      { op: '×' }, or { shift: -1 }
//               { value: { name, equals, period? } }   a rectangle's worked-out value (period from 1)
//               { periods: n }                         at least n periods
//               { viewing: n }                         the canvas shows period n (from 1)
//               { ownNumberIn: { name, periods: [1] } } the periods using the rectangle's own number
//               { canvas: { name, active? } }          a canvas with that name (and whether it is shown)
//               { canvases: n }                        at least n canvases
//               { role: { name, role } }               a rectangle's block role: 'input' or 'output' (any canvas)
//               { block: 'Tax' }                       a block of the canvas named Tax, on the canvas shown
//               { linkedTo: 'Name' }                   the canvas shown was made from the template Name
//               { template: 'Name' }                   a template Name saved during this tutorial
//               { fn: 'Name' }                         a function Name saved during this tutorial
//               { functionNode: 'Name' }               a box of the function Name on the canvas shown
//               { downloaded: true }                   a file was downloaded during this tutorial
//               { openedExcel: true }                  ExcelExporter was opened during this tutorial
//             In an arrow, from/to may also be { block: 'Tax' } (any of its dots) or
//             { fn: 'Margin', port?: 'Revenue' } (an input by name).
//   Templates and functions saved during a tutorial are taken out of your library at the end,
//   unless the last step's "Keep what I saved in my library" is ticked.
//       A step without done is read and moved on from with Next.
//   The test group 33 plays every step of every tutorial as a person would; a step it has no
//   action for fails the test, so a tutorial can't change without its test.
const TUTORIALS = [
  { id: 'first-model', title: 'Your first model', minutes: 5, topic: 'first-model',
    summary: 'Price × quantity = revenue: three rectangles, one operator, three arrows.',
    steps: [
      { id: 'intro',
        text: 'This tutorial builds Revenue = Price × Quantity. It runs on a practice canvas: your own model is put aside and comes back, untouched, when you finish or exit. Press Next to start.' },
      { id: 'price', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Price', value: 10 } }],
        text: 'Press {cmd:addRect}. A rectangle appears, ready to type in. Type Price, press Shift+Enter, type 10, press Shift+Enter, type $/t, then press Enter. The three lines are its name, value and unit.' },
      { id: 'quantity', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Quantity', value: 5 } }],
        text: 'Add a second rectangle the same way: Quantity, then 5, then t.' },
      { id: 'revenue', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Revenue' } }],
        text: 'Add a third rectangle and type just its name, Revenue, then press Enter. It gets no value of its own: it will be worked out.' },
      { id: 'multiply', point: { cmd: 'addOperator' }, done: [{ operator: '×' }],
        text: 'Press {cmd:addOperator} and choose × in the list that opens. An operator combines the values of the arrows coming into it.' },
      { id: 'arrow-price', point: { node: 'Price' }, done: [{ arrow: { from: 'Price', to: { op: '×' } } }],
        text: 'Draw an arrow from Price to the ×. Point at Price: small dots appear on its edges. Drag from a dot and drop on the ×. (With a mouse you can also drag with the right button from anywhere on Price.)' },
      { id: 'arrow-quantity', point: { node: 'Quantity' }, done: [{ arrow: { from: 'Quantity', to: { op: '×' } } }],
        text: 'Now draw an arrow from Quantity to the ×.' },
      { id: 'arrow-revenue', done: [{ arrow: { from: { op: '×' }, to: 'Revenue' } }],
        text: 'Draw an arrow from the × to Revenue.' },
      { id: 'evaluate', point: { cmd: 'evaluate' }, done: [{ value: { name: 'Revenue', equals: 50 } }],
        text: 'Press {cmd:evaluate} (or F9). Revenue shows = 50, and its unit, $, is worked out for you. After any change, press Evaluate again to see the new numbers.' },
      { id: 'done',
        text: 'Well done: that is a whole model. Next, try the tutorial "Time" to make values change from period to period. Finish returns you to your own model.' },
    ] },
  { id: 'time', title: 'Time: periods and last period', minutes: 7, topic: 'period-shifts',
    summary: 'A balance that carries forward: opening + additions = closing, period after period.',
    steps: [
      { id: 'intro',
        text: 'A closing balance becomes next period\'s opening balance. This tutorial builds that "corkscrew" over five periods, on a practice canvas. Press Next to start.' },
      { id: 'periods', point: { cmd: 'managePeriods' }, done: [{ periods: 5 }],
        text: 'Open {cmd:managePeriods}, type 5 as the Number of periods, press Set, then Done. Every canvas shares this timeline, and each period becomes a column in Excel.' },
      { id: 'opening', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Opening', value: 100 } }],
        text: 'Press {cmd:addRect} and type Opening, Shift+Enter, 100, then Enter.' },
      { id: 'additions', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Additions', value: 20 } }],
        text: 'Add another rectangle: Additions, then 20. It keeps 20 in every period.' },
      { id: 'closing', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Closing' } }],
        text: 'Add a rectangle named just Closing.' },
      { id: 'plus', point: { cmd: 'addOperator' }, done: [{ operator: '+' }],
        text: 'Press {cmd:addOperator} and choose +.' },
      { id: 'wire', done: [{ arrow: { from: 'Opening', to: { op: '+' } } }, { arrow: { from: 'Additions', to: { op: '+' } } }, { arrow: { from: { op: '+' }, to: 'Closing' } }],
        text: 'Draw three arrows: Opening to the +, Additions to the +, and the + to Closing.' },
      { id: 'first-value', point: { cmd: 'evaluate' }, done: [{ value: { name: 'Closing', equals: 120, period: 1 } }],
        text: 'Press {cmd:evaluate}. Closing shows 120 in period 1.' },
      { id: 'shift', point: { cmd: 'addPeriodShift' }, done: [{ periodShift: -1 }],
        text: 'Now carry Closing forward. Press {cmd:addPeriodShift}: it passes on a value from the period before (−1).' },
      { id: 'shift-wire', done: [{ arrow: { from: 'Closing', to: { shift: -1 } } }, { arrow: { from: { shift: -1 }, to: 'Opening' } }],
        text: 'Draw an arrow from Closing to the period shift, and one from the period shift to Opening.' },
      { id: 'own-number', point: { nodeButton: ['Opening', 'period-btn'] }, done: [{ ownNumberIn: { name: 'Opening', periods: [1] } }],
        text: 'Opening should use its own 100 only in the first period, and last period\'s Closing after that. Click Opening, then its 🕒 button, press First period only, then Save.' },
      { id: 'later', point: { cmd: 'nextPeriod' }, done: [{ value: { name: 'Closing', equals: 160, period: 3 } }, { viewing: 3 }],
        text: 'Press {cmd:evaluate}, then {cmd:nextPeriod} twice to see period 3. Closing is 160: 100 + 20 + 20 + 20.' },
      { id: 'done',
        text: 'That is a corkscrew: each closing balance opens the next period. The if operator can do the first-period part too: see "Timing, conditions and rounding" in Help. Finish returns you to your own model.' },
    ] },
  { id: 'blocks', title: 'Blocks: build once, use many times', minutes: 8, topic: 'blocks',
    summary: 'Turn a canvas into a building block with inputs and outputs, then use it on another canvas.',
    steps: [
      { id: 'intro',
        text: 'A block is a canvas used as one box somewhere else. You will build a small tax calculation, make it a block, and use it. Press Next to start.' },
      { id: 'rename', point: { cmd: 'renameCanvas' }, done: [{ canvas: { name: 'Tax', active: true } }],
        text: 'This canvas will be the block. Press {cmd:renameCanvas} (or double-click its tab), type Tax, and press Enter.' },
      { id: 'profit', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Profit', value: 100 } }],
        text: 'Add a rectangle: Profit, Shift+Enter, 100, then Enter. 100 is only a stand-in: the block will get its profit from outside.' },
      { id: 'rate', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Tax rate', value: 0.3 } }],
        text: 'Add a rectangle: Tax rate, then 0.3.' },
      { id: 'tax', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Tax' } }],
        text: 'Add a rectangle named just Tax.' },
      { id: 'multiply', point: { cmd: 'addOperator' }, done: [{ operator: '×' }],
        text: 'Press {cmd:addOperator} and choose ×.' },
      { id: 'wire', done: [{ arrow: { from: 'Profit', to: { op: '×' } } }, { arrow: { from: 'Tax rate', to: { op: '×' } } }, { arrow: { from: { op: '×' }, to: 'Tax' } }],
        text: 'Draw three arrows: Profit to the ×, Tax rate to the ×, and the × to Tax.' },
      { id: 'roles', point: { nodeButton: ['Profit', 'io-btn'] }, done: [{ role: { name: 'Profit', role: 'input' } }, { role: { name: 'Tax', role: 'output' } }],
        text: 'Now say what goes in and what comes out. Click Profit, then its ⇄ button, and choose Input. Then click Tax, its ⇄ button, and choose Output.' },
      { id: 'company', point: { cmd: 'newCanvas' }, done: [{ canvases: 2 }, { canvas: { name: 'Tax', active: false } }],
        text: 'Press {cmd:newCanvas}. This second canvas will use the block.' },
      { id: 'add-block', point: { cmd: 'addBlock' }, done: [{ block: 'Tax' }],
        text: 'Press {cmd:addBlock} and choose Tax in the list. The block appears as one box, with its input (Profit) on the left and its output (Tax) on the right.' },
      { id: 'feed', point: { cmd: 'addRect' }, done: [{ rect: { name: 'Company profit', value: 1000 } }, { arrow: { from: 'Company profit', to: { block: 'Tax' } } }],
        text: 'Add a rectangle: Company profit, then 1000. Draw an arrow from it onto the block\'s input dot, Profit, on its left.' },
      { id: 'result', done: [{ rect: { name: 'Company tax' } }, { arrow: { from: { block: 'Tax' }, to: 'Company tax' } }],
        text: 'Add a rectangle named Company tax. Draw an arrow from the block\'s output dot, Tax, on its right, to Company tax.' },
      { id: 'evaluate', point: { cmd: 'evaluate' }, done: [{ value: { name: 'Company tax', equals: 300 } }],
        text: 'Press {cmd:evaluate}. Company tax is 300: the block worked out 1000 × 0.3. Use the same block again with other inputs, as often as you like.' },
      { id: 'done',
        text: 'Well done. Blocks can also run once per period ("Vertical"), for example one per year of spending: see Blocks in Help. Finish returns you to your own model.' },
    ] },
  { id: 'templates', title: 'Templates: save a canvas and reuse it', minutes: 5, topic: 'templates',
    summary: 'Save a canvas as a template, then add it again in one click.',
    start: { canvases: [{ name: 'Revenue', nodes: [
      { id: 'p', type: 'value', x: 80, y: 60, text: 'Price\n10\n$/t' },
      { id: 'q', type: 'value', x: 80, y: 200, text: 'Quantity\n5\nt' },
      { id: 'm', type: 'operator', x: 360, y: 140, text: '×' },
      { id: 'r', type: 'value', x: 560, y: 130, text: 'Revenue' },
    ], edges: [{ from: 'p', to: 'm' }, { from: 'q', to: 'm' }, { from: 'm', to: 'r' }] }] },
    steps: [
      { id: 'intro',
        text: 'This practice canvas holds a small revenue calculation. You will save it as a template and add it again. Press Next to start.' },
      { id: 'save', point: { cmd: 'openTemplates' }, done: [{ template: 'Revenue' }],
        text: 'Open {cmd:openTemplates} and press + Save Canvas as Template. Keep the name Revenue, give it a group if you like, and press Save Template.' },
      { id: 'add', done: [{ canvases: 2 }, { linkedTo: 'Revenue' }, { value: { name: 'Revenue', equals: 50 } }],
        text: 'Revenue is now in the list. With it selected, press Add to new canvas. A new canvas appears with the same calculation, already showing Revenue = 50, and it remembers which template it came from.' },
      { id: 'done',
        text: 'When you improve a template, save it with ⤴ Save as new version: canvases made from it then offer "Update this canvas". What you saved goes back out of your library when you finish, unless you tick Keep below.' },
    ] },
  { id: 'functions', title: 'Your own functions', minutes: 6, topic: 'functions',
    summary: 'Write a formula once, as a function, and use it on the canvas.',
    start: { canvases: [{ name: 'Practice', nodes: [
      { id: 'r', type: 'value', x: 80, y: 60, text: 'Revenue\n100' },
      { id: 'c', type: 'value', x: 80, y: 220, text: 'Cost\n60' },
    ], edges: [] }] },
    steps: [
      { id: 'intro',
        text: 'A function is a formula with a name, kept in your library, like Margin(Revenue, Cost). You will write one and use it. Press Next to start.' },
      { id: 'write', point: { cmd: 'openFunctions' }, done: [{ fn: 'Margin' }],
        text: 'Open {cmd:openFunctions} and press + New Function…. Type: Margin(Revenue, Cost) = (Revenue - Cost) / Revenue. The editor checks it as you type. Press Save Function, then close the window.' },
      { id: 'insert', point: { cmd: 'insertFunction' }, done: [{ functionNode: 'Margin' }],
        text: 'Press {cmd:insertFunction}, choose Margin and press Insert. A box appears with one dot per input on its left and the result on its right.' },
      { id: 'wire', done: [{ arrow: { from: 'Revenue', to: { fn: 'Margin', port: 'Revenue' } } }, { arrow: { from: 'Cost', to: { fn: 'Margin', port: 'Cost' } } }],
        text: 'Draw an arrow from Revenue onto the box\'s Revenue dot, and one from Cost onto its Cost dot.' },
      { id: 'result', done: [{ rect: { name: 'Margin %' } }, { arrow: { from: { fn: 'Margin' }, to: 'Margin %' } }],
        text: 'Add a rectangle named Margin % and draw an arrow from the box\'s result dot, on its right, to it.' },
      { id: 'evaluate', point: { cmd: 'evaluate' }, done: [{ value: { name: 'Margin %', equals: 0.4 } }],
        text: 'Press {cmd:evaluate}. Margin % is 0.4: (100 − 60) ÷ 100.' },
      { id: 'done',
        text: 'Functions travel inside your model, so it works the same for anyone you send it to, and ExcelExporter writes them out in full in each formula. What you saved goes back out of your library when you finish, unless you tick Keep below.' },
    ] },
  { id: 'to-excel', title: 'From fmIDE to Excel', minutes: 5, topic: 'to-excel',
    summary: 'Save a model and turn it into an Excel workbook with live formulas.',
    start: { canvases: [{ name: 'Revenue', nodes: [
      { id: 'p', type: 'value', x: 80, y: 60, text: 'Price\n10\n$/t' },
      { id: 'q', type: 'value', x: 80, y: 200, text: 'Quantity\n5\nt' },
      { id: 'm', type: 'operator', x: 360, y: 140, text: '×' },
      { id: 'r', type: 'value', x: 560, y: 130, text: 'Revenue' },
    ], edges: [{ from: 'p', to: 'm' }, { from: 'q', to: 'm' }, { from: 'm', to: 'r' }] }] },
    steps: [
      { id: 'intro',
        text: 'This practice canvas holds a small revenue model. You will send it to ExcelExporter, which writes an Excel workbook with real formulas. Press Next to start.' },
      { id: 'save', point: { cmd: 'saveSystem' }, done: [{ downloaded: true }],
        text: 'Press {cmd:saveSystem}. It downloads the model as a file (fmIDE-system-….json). With your own work you would use Save instead: here, practice keeps your files untouched.' },
      { id: 'open', point: { cmd: 'openExcelExporter' }, done: [{ openedExcel: true }],
        text: 'Press {cmd:openExcelExporter}. It opens in its own window (or tab).' },
      { id: 'load',
        text: 'In ExcelExporter, drop the file you just downloaded on the box in panel 1, "Load an fmIDE model", or click the box to choose it. The panels below fill in: one tab per canvas, one row per rectangle. Press Next when it has loaded.' },
      { id: 'generate',
        text: 'Scroll to panel 5 and press Generate & Download .xlsx. Open the workbook: Revenue\'s cells hold a formula multiplying Price by Quantity, so changing Price in Excel changes Revenue. Press Next.' },
      { id: 'done',
        text: 'That is the whole trip. ExcelExporter remembers your layout for each model, and its own Help (❓ at its top right, or F1) explains tabs, rows, scenarios and formatting. Back to fmIDE returns here; Finish returns you to your own model.' },
    ] },
];
