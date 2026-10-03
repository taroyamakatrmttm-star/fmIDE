// fmGraph's tutorials (step 15, G6). Licensed CC BY 4.0, like the rest of src/help/.
// Data only: each tutorial practises on a copy of the sample model ('board': what its board
// starts with — 'sliders' (Price and Volume), 'sample' (the sample's board)), one step at a time.
// A step: { id, text, point (where the ring points: a CSS selector), done (checks, all of which
// must hold for it to move on by itself; none: a Next button) }. Checks (src/fmgraph/js/07b-tutorials.js):
//   { bar: name | null }                     a bar on that rectangle (null: any bar)
//   { slider: name, moved: true }            that rectangle's slider moved off the model's number
//   { reset: true }                          every slider on the model's numbers
//   { chart: layout, steps?, outputs? }      a chart of that kind ('columns', 'flow', 'scenarios');
//                                            steps: [[name, role]…] exactly; outputs: names it shows
//   { traced: true | false }, { pinned: true | false }
//   { scenarios: n }                         at least n scenarios
//   { scenarioShown: i }                     the sliders where the i-th scenario (from 0) has them
const FMGRAPH_TUTORIALS = [
  { id: 'sliders-and-bars', title: 'Sliders and bars', minutes: 3, topic: 'bars', board: 'sliders',
    summary: 'Put a rectangle on a bar, move a slider, and watch what it reaches move with it.',
    steps: [
      { id: 'intro', text: 'This is a practice copy of the sample model: a profit calculation and its cash. Nothing you do here is kept. On the left are two sliders, Price and Volume.' },
      { id: 'add-bar', text: 'Press + Bar at the top. A bar shows a rectangle\'s value in each year.', point: '#btnAddBar', done: [{ bar: null }] },
      { id: 'choose-profit', text: 'In the new bar\'s list, choose Profit.', point: '.bar-widget select', done: [{ bar: 'Profit' }] },
      { id: 'move-price', text: 'Drag the Price slider, or type a number in its box. The Profit bar moves with it; the dashed outline keeps the model\'s own number, and the label says the difference.', point: '.slider-widget input[type=range]', done: [{ slider: 'Price', moved: true }] },
      { id: 'reset', text: 'Press Reset all to put the sliders back on the model\'s own numbers. fmGraph never changes the model itself.', point: '#btnResetAll', done: [{ reset: true }] },
      { id: 'end', text: 'That\'s the heart of fmGraph: sliders on inputs, bars on what they reach. Finish to go back to your own model.' },
    ] },
  { id: 'charts', title: 'Charts', minutes: 4, topic: 'charts', board: 'sliders',
    summary: 'Build a waterfall from Revenue to Gross profit, with its check.',
    steps: [
      { id: 'add-chart', text: 'Press + Chart at the top. A chart is made of your own rectangles; its editor opens.', point: '#btnAddChart', done: [{ chart: 'columns' }] },
      { id: 'waterfall', text: 'At the chart\'s top, choose Waterfall: steps in one year, up and down from a start.', point: '.chart-widget select[aria-label="Kind of chart"]', done: [{ chart: 'flow' }] },
      { id: 'steps', text: 'In Edit chart, make three steps: Revenue as Start, Cost of sales as Subtract, and Gross profit as Total. + Step adds one; each step has its role and its rectangle.', point: '.chart-widget .chart-edit', done: [{ chart: 'flow', steps: [['Revenue', 'start'], ['Cost of sales', 'subtract'], ['Gross profit', 'total']] }] },
      { id: 'check', text: 'The ✓ above Gross profit says the steps before it add up to it. Now move Price: the bars move and the check still holds.', point: '.slider-widget input[type=range]', done: [{ slider: 'Price', moved: true }] },
      { id: 'end', text: 'A balance sheet is a Columns chart of two groups with "Check that the groups\' totals agree". Finish to go back to your own model.' },
    ] },
  { id: 'trace-and-compare', title: 'Trace and compare', minutes: 3, topic: 'compare', board: 'sample',
    summary: 'See what reaches a bar, and compare one what-if with another.',
    steps: [
      { id: 'trace', text: 'Press 🔍 on the Profit bar. The sliders that reach it light up, and a note shows the way each one gets there.', point: '.bar-widget .widget-trace', done: [{ traced: true }] },
      { id: 'price', text: 'Move Price to try a what-if.', point: '.slider-widget input[type=range]', done: [{ slider: 'Price', moved: true }] },
      { id: 'pin', text: 'Press 📌 Pin as A to keep this what-if as A.', point: '#btnPinA', done: [{ pinned: true }] },
      { id: 'volume', text: 'Now move Volume. The outlines and labels show the change from A, not from the model.', point: '.slider-widget:nth-child(2) input[type=range]', done: [{ slider: 'Volume', moved: true }] },
      { id: 'unpin', text: 'Press Unpin in the strip above the board to compare with the model\'s own numbers again.', point: '#compareBar', done: [{ pinned: false }] },
      { id: 'end', text: 'Biggest movers, under the sliders, lists what the sliders change most. Finish to go back to your own model.' },
    ] },
  { id: 'scenarios', title: 'Scenarios', minutes: 4, topic: 'scenarios', board: 'sample',
    summary: 'Save what-ifs as named scenarios, switch between them, and see them in a scenario waterfall.',
    steps: [
      { id: 'price', text: 'Move Price to a higher price.', point: '.slider-widget input[type=range]', done: [{ slider: 'Price', moved: true }] },
      { id: 'save', text: 'Press + Save as scenario in the Scenarios panel. It is named sc01; you could type your own name.', point: '#btnSaveScenario', done: [{ scenarios: 1 }] },
      { id: 'second', text: 'Move Volume as well, then save again: sc02.', point: '#scenariosPanel', done: [{ scenarios: 2 }] },
      { id: 'show', text: 'Press ▶ on sc01: the sliders go back where it had them.', point: '.scenario .scenario-show', done: [{ scenarioShown: 0 }] },
      { id: 'chart', text: 'Press + Chart, then choose Scenario waterfall at its top.', point: '#btnAddChart', done: [{ chart: 'scenarios' }] },
      { id: 'output', text: 'In Edit chart, choose Profit as its output. It shows Profit from the model\'s own number through sc01 and sc02.', point: '.chart-widget[data-layout="scenarios"] .chart-edit', done: [{ chart: 'scenarios', outputs: ['Profit'] }] },
      { id: 'end', text: 'Scenarios are kept with your boards, and in fmIDE\'s document too. Finish to go back to your own model.' },
    ] },
];
