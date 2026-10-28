// ============================================================
// A new chart, on fmGraph's page (+ Chart). The charts' reading and figures are 04b-charts.js.
// ============================================================

// A new chart: columns with one group holding one calculated rectangle, a flow with one step,
// or an empty Free chart.
function addChart(layout){
  if(board.charts.length >= BOARD_LIMIT) return null;
  const first = model.rects.find(r => !r.input) || model.rects[0];
  const c = layout === 'free'
    ? { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'free', title: '', period: 0, pieces: [], notes: null, colours: {} }
    : layout === 'flow'
    ? { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'flow', title: '', period: 0, steps: first ? [{ key: first.key, role: 'start' }] : [], colours: {} }
    : { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'columns', title: '', periods: { mode: 'all' }, groups: [{ name: '', parts: first ? [first.key] : [] }], check: false, colours: {} };
  board.items.push(c);
  saveBoardSoon();
  return c;
}
