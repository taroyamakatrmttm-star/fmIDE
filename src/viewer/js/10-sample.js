// ============================================================
// Try the sample (the owner's V1 choice 5, phase V2): fmGraph's sample model and its board
// (06a-sample.js of the board engine), shown with a showcase of the viewer's own: two
// scenarios, and Play between Base and the first.
// ============================================================
function sampleShowcase(){
  const at = (nodeId, name) => ({ canvasId: 'cProfit', nodeId, name });
  const boardsFile = Object.assign(JSON.parse(JSON.stringify(SAMPLE_BOARD)), {
    scenarios: [
      { name: 'High price', sliders: [Object.assign(at('price', 'Price'), { mode: 'set', periods: { mode: 'all' }, value: 13 })] },
      { name: 'Busy year', sliders: [Object.assign(at('price', 'Price'), { mode: 'set', periods: { mode: 'all' }, value: 9 }),
        Object.assign(at('vol', 'Volume'), { mode: 'shift', periods: { mode: 'all' }, value: 25 })] },
    ],
  });
  return { kind: 'fmIDE-showcase', version: 1, id: 'sample', title: 'A small profit model',
    description: 'Move Price and Volume, or show a scenario, and watch the profit, the cash and the balance sheet follow. Logic shows how each number is worked out.',
    author: 'fmIDE', licence: 'CC BY 4.0', boards: boardsFile, play: { from: 'Base', to: 'High price' } };
}
async function openSample(){
  const c = cleanShowcase(sampleShowcase());
  const m = { system: JSON.parse(JSON.stringify(SAMPLE_MODEL)), presets: null, boards: null, name: 'Sample model' };
  return showModel(m, c.value);
}
