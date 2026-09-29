// =====================================================================================
// fmIDE's tutorials (build step 10, phase H3; docs/step10-help.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), unlike the code around it.
// =====================================================================================
// Plain data, run by src/fmide/js/01c-tutorials.js in practice mode (your own model is set
// aside and comes back unchanged). Each step moves on by itself once what it asks for is
// done; nothing is done for you.
//
//   TUTORIALS — { id, title, minutes, summary, topic, steps }
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
];
