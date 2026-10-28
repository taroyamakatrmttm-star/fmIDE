// ============================================================
// A small model to try things with: a profit calculation and the cash it builds up, with its
// board (the showcase viewer's Try the sample uses it too).
// ============================================================

// A small model to try things with: a profit calculation and the cash it builds up.
const SAMPLE_MODEL = {
  kind: 'system', version: 9, periods: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  canvases: [
    { id: 'cProfit', name: 'Profit', nodes: [
      { id: 'price', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Price\n10' },
      { id: 'vol', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Volume\n1000', periodValues: [1000, 1100, 1200, 1300] },
      { id: 'ucost', type: 'value', x: 0, y: 200, w: 150, h: 64, text: 'Unit cost\n6' },
      { id: 'm1', type: 'operator', x: 180, y: 50, text: '×' },
      { id: 'rev', type: 'value', x: 250, y: 50, w: 150, h: 64, text: 'Revenue' },
      { id: 'm2', type: 'operator', x: 180, y: 180, text: '×' },
      { id: 'cogs', type: 'value', x: 250, y: 180, w: 150, h: 64, text: 'Cost of sales' },
      { id: 's1', type: 'operator', x: 420, y: 110, text: '−' },
      { id: 'gp', type: 'value', x: 450, y: 110, w: 150, h: 64, text: 'Gross profit' },
      { id: 'over', type: 'value', x: 500, y: 260, w: 150, h: 64, text: 'Overheads\n2500' },
      { id: 's2', type: 'operator', x: 640, y: 180, text: '−' },
      { id: 'profit', type: 'value', x: 700, y: 180, w: 150, h: 64, text: 'Profit' },
    ], edges: [
      { id: 'e1', from: 'price', to: 'm1' }, { id: 'e2', from: 'vol', to: 'm1' }, { id: 'e3', from: 'm1', to: 'rev' },
      { id: 'e4', from: 'vol', to: 'm2' }, { id: 'e5', from: 'ucost', to: 'm2' }, { id: 'e6', from: 'm2', to: 'cogs' },
      { id: 'e7', from: 'rev', to: 's1' }, { id: 'e8', from: 'cogs', to: 's1' }, { id: 'e9', from: 's1', to: 'gp' },
      { id: 'e10', from: 'gp', to: 's2' }, { id: 'e11', from: 'over', to: 's2' }, { id: 'e12', from: 's2', to: 'profit' },
    ] },
    { id: 'cCash', name: 'Cash', nodes: [
      { id: 'open', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Opening cash\n1000', literalPeriods: [0] },
      { id: 'pr', type: 'alias', x: 0, y: 100, w: 150, h: 64, sourceCanvasId: 'cProfit', sourceNodeId: 'profit' },
      { id: 'add', type: 'operator', x: 180, y: 50, text: '+' },
      { id: 'close', type: 'value', x: 250, y: 50, w: 150, h: 64, text: 'Closing cash' },
      { id: 'ps', type: 'periodShift', x: 250, y: 160, shift: -1 },
    ], edges: [
      { id: 'c1', from: 'open', to: 'add' }, { id: 'c2', from: 'pr', to: 'add' }, { id: 'c3', from: 'add', to: 'close' },
      { id: 'c4', from: 'close', to: 'ps' }, { id: 'c5', from: 'ps', to: 'open' },
    ] },
    // A balance sheet that balances every year: the cash comes from Cash, equity grows by the profit.
    { id: 'cBS', name: 'Balance sheet', nodes: [
      { id: 'bcash', type: 'alias', x: 0, y: 0, w: 150, h: 64, sourceCanvasId: 'cCash', sourceNodeId: 'close' },
      { id: 'equip', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Equipment\n500' },
      { id: 'debt', type: 'value', x: 0, y: 200, w: 150, h: 64, text: 'Debt\n800' },
      { id: 'eqopen', type: 'value', x: 0, y: 300, w: 150, h: 64, text: 'Opening equity\n700', literalPeriods: [0] },
      { id: 'bprofit', type: 'alias', x: 0, y: 400, w: 150, h: 64, sourceCanvasId: 'cProfit', sourceNodeId: 'profit' },
      { id: 'eqadd', type: 'operator', x: 180, y: 350, text: '+' },
      { id: 'equity', type: 'value', x: 250, y: 350, w: 150, h: 64, text: 'Equity' },
      { id: 'eqps', type: 'periodShift', x: 250, y: 450, shift: -1 },
    ], edges: [
      { id: 'b1', from: 'eqopen', to: 'eqadd' }, { id: 'b2', from: 'bprofit', to: 'eqadd' }, { id: 'b3', from: 'eqadd', to: 'equity' },
      { id: 'b4', from: 'equity', to: 'eqps' }, { id: 'b5', from: 'eqps', to: 'eqopen' },
    ] },
  ],
};

// Version 9: its bars and charts follow the shared period (05k-shared-period.js).
const SAMPLE_BOARD = {
  kind: 'fmIDE-graph-board', version: 9,
  sliders: [
    { canvasId: 'cProfit', nodeId: 'price', name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 5, max: 15, step: 0.25 },
    { canvasId: 'cProfit', nodeId: 'vol', name: 'Volume', periods: { mode: 'all' }, mode: 'shift', min: -50, max: 50, step: 1 },
  ],
  bars: [
    { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', periods: { mode: 'all' } },
    { canvasId: 'cCash', nodeId: 'close', name: 'Closing cash', periods: { mode: 'all' } },
  ],
  charts: [
    { layout: 'columns', title: 'Balance sheet', periods: { mode: 'all' }, check: true, groups: [
      { name: 'Assets', parts: [{ canvasId: 'cCash', nodeId: 'close', name: 'Closing cash' }, { canvasId: 'cBS', nodeId: 'equip', name: 'Equipment' }] },
      { name: 'Liabilities and equity', parts: [{ canvasId: 'cBS', nodeId: 'debt', name: 'Debt' }, { canvasId: 'cBS', nodeId: 'equity', name: 'Equity' }] },
    ] },
    { layout: 'flow', title: 'Profit', period: 0, steps: [
      { canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', role: 'start' },
      { canvasId: 'cProfit', nodeId: 'cogs', name: 'Cost of sales', role: 'subtract' },
      { canvasId: 'cProfit', nodeId: 'gp', name: 'Gross profit', role: 'total' },
      { canvasId: 'cProfit', nodeId: 'over', name: 'Overheads', role: 'subtract' },
      { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', role: 'total' },
    ] },
  ],
};
