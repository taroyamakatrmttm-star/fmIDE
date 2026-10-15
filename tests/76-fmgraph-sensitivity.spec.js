// 76. fmGraph's Tornado and Spider (step 18, phase A1; docs/step18-fmgraph-sensitivity.md).
// Two chart layouts, `tornado` and `spider`, for one output and a list of inputs, measured around
// where the sliders stand: each input moved on its own in every period (percent: × (1 + x/100);
// amount: + x), the output read in one period.
// - Known answers on the sample (Profit = (Price − Unit cost) × Volume − Overheads): Low, High and
//   swing by percent, sorted by swing; the Spider's points, its outer ones the Tornado's ends;
//   another period; the base following the sliders, a slider on one period with the change on top
//   in every period.
// - By amount, a percentage point, equal swings keeping their order, a run that can't be worked
//   out as a gap with its reason in words (a small model of its own).
// - Adding one: + Chart → Tornado measures the first calculated rectangle with every input that
//   reaches it; Spider keeps them; Edit chart's output, period and points; undo.
// - The board file (version 8): written and read back, everything read in cleaned (numbers
//   forced, Low and High cut to ±1e9, steps 1–10, only input rectangles, an output not in the
//   model leaves the chart out), names shown as text, never in the template form; a version 7
//   file opens; a layout this fmGraph doesn't know reads as an empty chart (as an older fmGraph
//   reads these).
// - On a phone: drawn, and its quick look names it.
// - A slow model: worked out once the sliders stop ("Working out…").
const { test, expect, openApp, readFixture } = require('./helpers/apps');
const { largeModel } = require('../tools/bench-calc.js');

const g = (page, fn, arg) => page.evaluate(fn, arg);
async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.bar-widget')).toHaveCount(2);
}
const chart = (page, id) => g(page, (i) => fmGraph.chart(i), id);
const ends = (figs) => figs.inputs.map(i => [i.name, i.lowValue, i.highValue, i.swing]);
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
function expectEnds(figs, expected){
  const got = ends(figs);
  expect(got.map(r => r[0])).toEqual(expected.map(r => r[0]));
  got.forEach((r, i) => [1, 2, 3].forEach(k => expect(near(r[k], expected[i][k]), r[0] + ' ' + k + ': ' + r[k]).toBe(true)));
}

// Net = Price × Volume × (1 − Tax rate); Per share = Net ÷ Divisor. Two periods, Price 10 then 12.
const SMALL = {
  kind: 'system', version: 9, periods: ['P1', 'P2'],
  canvases: [{ id: 'c1', name: 'Small', nodes: [
    { id: 'price', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Price\n10', periodValues: [10, 12] },
    { id: 'vol', type: 'value', x: 0, y: 100, w: 150, h: 64, text: '<b>Units</b>\n100' },
    { id: 'rate', type: 'value', x: 0, y: 200, w: 150, h: 64, text: 'Tax rate\n0.25' },
    { id: 'div', type: 'value', x: 500, y: 300, w: 150, h: 64, text: 'Divisor\n1' },
    { id: 'm1', type: 'operator', x: 180, y: 50, text: '×' },
    { id: 'rev', type: 'value', x: 250, y: 50, w: 150, h: 64, text: 'Revenue' },
    { id: 'm2', type: 'operator', x: 180, y: 180, text: '×' },
    { id: 'tax', type: 'value', x: 250, y: 180, w: 150, h: 64, text: 'Tax' },
    { id: 's1', type: 'operator', x: 420, y: 110, text: '−' },
    { id: 'net', type: 'value', x: 450, y: 110, w: 150, h: 64, text: 'Net' },
    { id: 'd1', type: 'operator', x: 620, y: 200, text: '÷' },
    { id: 'per', type: 'value', x: 680, y: 200, w: 150, h: 64, text: 'Per share' },
  ], edges: [
    { id: 'e1', from: 'price', to: 'm1' }, { id: 'e2', from: 'vol', to: 'm1' }, { id: 'e3', from: 'm1', to: 'rev' },
    { id: 'e4', from: 'rev', to: 'm2' }, { id: 'e5', from: 'rate', to: 'm2' }, { id: 'e6', from: 'm2', to: 'tax' },
    { id: 'e7', from: 'rev', to: 's1' }, { id: 'e8', from: 'tax', to: 's1' }, { id: 'e9', from: 's1', to: 'net' },
    { id: 'e10', from: 'net', to: 'd1' }, { id: 'e11', from: 'div', to: 'd1' }, { id: 'e12', from: 'd1', to: 'per' },
  ] }],
};
async function openSmall(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  expect(await g(page, (m) => fmGraph.load(m, 'Small'), SMALL)).toBe(true);
}

test('the Tornado on the sample: Low and High by percent, sorted by swing, drawn as text', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'tornado', title: 'What moves Profit', output: 'Profit' }));
  const f = await chart(page, id);
  expect(f.output).toBe('Profit');
  expect(f.period).toBe('Year 1');
  expect(f.base).toBe(1500); // (10 − 6) × 1000 − 2500
  // Every input that reaches Profit, by ±10%, largest swing first.
  expectEnds(f, [['Price', 500, 2500, 2000], ['Unit cost', 2100, 900, 1200], ['Volume', 1100, 1900, 800], ['Overheads', 1750, 1250, 500]]);
  expect(f.inputs.every(i => i.by === 'percent' && i.low === -10 && i.high === 10 && i.show === true)).toBe(true);
  // Drawn: a row per input in that order, two bars each, the base line and its number.
  const w = page.locator('.chart-widget[data-layout="tornado"]');
  await expect(w.locator('svg.tornado-chart')).toHaveAttribute('aria-label', 'What moves Profit: what moves Profit, Year 1');
  await expect(w.locator('.s-row')).toHaveCount(4);
  expect(await w.locator('.s-row').evaluateAll(els => els.map(e => e.getAttribute('data-input')))).toEqual(['Price', 'Unit cost', 'Volume', 'Overheads']);
  await expect(w.locator('.s-bar')).toHaveCount(8);
  await expect(w.locator('.s-base-label')).toHaveText('1,500');
  await expect(w.locator('.key-item')).toHaveText(['Low', 'High']);
  // Price's Low bar runs left of the base, its High bar right.
  const bars = await w.locator('.s-row').first().locator('.s-bar').evaluateAll(els => els.map(e => ({ cls: e.getAttribute('class'), x: Number(e.getAttribute('x')), w: Number(e.getAttribute('width')) })));
  const base = Number(await w.locator('line.s-base').getAttribute('x1'));
  expect(near(bars[0].x + bars[0].w, base)).toBe(true);
  expect(near(bars[1].x, base)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('the Spider: its points from Low through the base to High, the outer ones the Tornado\'s ends; another period', async ({ page, pageErrors }) => {
  await openSample(page);
  const t = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Profit' }));
  const s = await g(page, () => fmGraph.addChart({ layout: 'spider', output: 'Profit', steps: 2 }));
  const tf = await chart(page, t), sf = await chart(page, s);
  // In the inputs' order (not sorted), each with 2 + 1 + 2 points.
  expect(sf.inputs.map(i => i.name)).toEqual(['Price', 'Volume', 'Unit cost', 'Overheads']);
  const price = sf.inputs[0];
  expect(price.points.map(p => p.at)).toEqual([-1, -0.5, 0, 0.5, 1]);
  expect(price.points.map(p => p.change)).toEqual([-10, -5, 0, 5, 10]);
  expect(price.points.map(p => p.value)).toEqual([500, 1000, 1500, 2000, 2500]);
  sf.inputs.forEach(i => {
    const ti = tf.inputs.find(x => x.name === i.name);
    expect(i.points[0].value).toBe(ti.lowValue);
    expect(i.points[i.points.length - 1].value).toBe(ti.highValue);
    expect(i.points[2].value).toBe(tf.base);
  });
  const w = page.locator('.chart-widget[data-layout="spider"]');
  await expect(w.locator('.s-line')).toHaveCount(4);
  await expect(w.locator('.s-point')).toHaveCount(20);
  await expect(w.locator('.key-item')).toHaveText(['Price', 'Volume', 'Unit cost', 'Overheads']);
  // 1 to 10 points each side; 5 when it isn't one of those.
  const steps = [];
  for(const n of [1, 10, 0, 11, 2.6, 'x']){
    const id = await g(page, (k) => fmGraph.addChart({ layout: 'spider', output: 'Profit', steps: k }), n);
    steps.push((await chart(page, id)).inputs[0].points.length);
  }
  expect(steps).toEqual([3, 21, 11, 11, 7, 11]);
  // Year 2 (Volume 1100): base (10 − 6) × 1100 − 2500 = 1900.
  const y2 = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Profit', period: 2 }));
  const f2 = await chart(page, y2);
  expect(f2.period).toBe('Year 2');
  expect(f2.base).toBe(1900);
  expectEnds(f2, [['Price', 800, 3000, 2200], ['Unit cost', 2560, 1240, 1320], ['Volume', 1460, 2340, 880], ['Overheads', 2150, 1650, 500]]);
  // A period that isn't one is refused.
  await expect(g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Profit', period: 9 }))).rejects.toThrow('There is no period 9.');
  expect(pageErrors).toEqual([]);
});

test('measured around the sliders: the base follows them, a change goes on top in every period', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Profit', inputs: [{ rect: 'Price' }, { rect: 'Volume' }] }));
  const sliders = await g(page, () => fmGraph.board().sliders.map(s => [s.name, s.id]));
  const slider = (n) => sliders.find(s => s[0] === n)[1];
  // Price set to 12: base (12 − 6) × 1000 − 2500 = 3500; Price ±10% of 12.
  await g(page, (s) => fmGraph.setSlider(s, 12), slider('Price'));
  let f = await chart(page, id);
  expect(f.base).toBe(3500);
  expectEnds(f, [['Price', 2300, 4700, 2400], ['Volume', 2900, 4100, 1200]]);
  // Volume up 10% by its slider: Volume ±10% of 1100.
  await g(page, (s) => fmGraph.setSlider(s, 10), slider('Volume'));
  f = await chart(page, id);
  expect(f.base).toBe(4100);
  expectEnds(f, [['Price', 2780, 5420, 2640], ['Volume', 3440, 4760, 1320]]);
  // The drawing follows too.
  await expect(page.locator('.chart-widget[data-layout="tornado"] .s-base-label')).toHaveText('4,100');
  await g(page, () => fmGraph.resetAll());
  expect((await chart(page, id)).base).toBe(1500);
  // A slider on Year 2 only, Price 20: Year 2's base (20 − 6) × 1100 − 2500 = 12900, Price ±10% of 20;
  // Year 1 keeps the model's 10, and the change goes on top there too.
  const one = await g(page, () => fmGraph.addSlider('Price', { periods: 2 }));
  await g(page, (s) => fmGraph.setSlider(s, 20), one);
  const y2 = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Profit', period: 2, inputs: [{ rect: 'Price' }] }));
  expectEnds(await chart(page, y2), [['Price', 10700, 15100, 4400]]);
  expectEnds(await chart(page, id), [['Price', 500, 2500, 2000], ['Volume', 1100, 1900, 800]]);
  expect(pageErrors).toEqual([]);
});

test('by amount, a percentage point, equal swings keep their order, an error as a gap', async ({ page, pageErrors }) => {
  await openSmall(page);
  // Net = 10 × 100 × 0.75 = 750. The tax rate by one point: 0.24 → 760, 0.26 → 740.
  const id = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Net', inputs: [
    { rect: 'Tax rate', by: 'amount', low: -0.01, high: 0.01 },
    { rect: 'Price', by: 'amount', low: -1, high: 1 },
    { rect: '<b>Units</b>', by: 'amount', low: -10, high: 10 },
    { rect: 'Divisor', by: 'amount', low: -1, high: 1 },
  ] }));
  const f = await chart(page, id);
  expect(f.base).toBe(750);
  // Price ±1 and Units ±10 both swing 150: they keep their order; Divisor doesn't reach Net (0).
  expectEnds(f, [['Price', 675, 825, 150], ['<b>Units</b>', 675, 825, 150], ['Tax rate', 760, 740, 20], ['Divisor', 750, 750, 0]]);
  expect(f.inputs.map(i => i.by)).toEqual(['amount', 'amount', 'amount', 'amount']);
  // Units listed first, Price second: still in the inputs' order.
  const id2 = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Net', inputs: [
    { rect: '<b>Units</b>', by: 'amount', low: -10, high: 10 }, { rect: 'Price', by: 'amount', low: -1, high: 1 }] }));
  expect((await chart(page, id2)).inputs.map(i => i.name)).toEqual(['<b>Units</b>', 'Price']);
  // Per share = Net ÷ Divisor: the Divisor at 0 can't be worked out — a gap, said in words, the rest drawn.
  const id3 = await g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Per share', inputs: [
    { rect: 'Divisor', by: 'amount', low: -1, high: 1 }, { rect: 'Price' }] }));
  const f3 = await chart(page, id3);
  expect(f3.inputs.map(i => i.name)).toEqual(['Price', 'Divisor']);
  expect(f3.inputs[1].error).toBeTruthy();
  expectEnds({ inputs: [f3.inputs[0]] }, [['Price', 675, 825, 150]]);
  const w = page.locator('.chart-widget').filter({ has: page.locator('[data-input="Divisor"]') }).last();
  await expect(w.locator('.s-row')).toHaveCount(2);
  await expect(w.locator('.s-row[data-input="Divisor"] .b-err')).toHaveCount(1);
  await expect(w.locator('.bar-errors')).toContainText('Divisor:');
  // The Spider on the same: the point at 0 is a gap, the rest are there.
  const sp = await g(page, () => fmGraph.addChart({ layout: 'spider', output: 'Per share', steps: 1, inputs: [{ rect: 'Divisor', by: 'amount', low: -1, high: 1 }] }));
  const pts = (await chart(page, sp)).inputs[0].points;
  expect(pts.map(p => p.error ? 'gap' : p.value)).toEqual(['gap', 750, 375]);
  // A name with markup is drawn as text, never as markup.
  await expect(page.locator('.chart-widget').first().locator('text.s-name', { hasText: '<b>Units</b>' })).toHaveCount(1);
  expect(await page.locator('.chart-widget b').count()).toBe(0);
  // Only input rectangles can be moved.
  await expect(g(page, () => fmGraph.addChart({ layout: 'tornado', output: 'Per share', inputs: [{ rect: 'Net' }] }))).rejects.toThrow('"Net" is not an input rectangle');
  expect(pageErrors).toEqual([]);
});

test('adding one: + Chart → Tornado measures the first calculated rectangle; Spider keeps it; Edit chart; undo', async ({ page, pageErrors }) => {
  await openSample(page);
  const before = (await g(page, () => fmGraph.board())).items.length;
  await page.click('#btnAddChart');
  const w = page.locator('.chart-widget').last();
  await w.locator('select[aria-label="Kind of chart"]').selectOption('tornado');
  const made = page.locator('.chart-widget[data-layout="tornado"]');
  await expect(made).toHaveCount(1);
  let item = (await g(page, () => fmGraph.board())).items.at(-1);
  // The sample's first calculated rectangle is Revenue: Price and Volume reach it.
  expect(item.output.name).toBe('Revenue');
  expect(item.inputs.map(i => [i.name, i.by, i.low, i.high])).toEqual([['Price', 'percent', -10, 10], ['Volume', 'percent', -10, 10]]);
  // Edit chart (a new chart opens with it): another output, then the inputs that reach it.
  await expect(made.locator('details.chart-edit')).toHaveAttribute('open', '');
  await made.locator('select[aria-label="Output"]').selectOption({ label: 'Profit' });
  await page.locator('.chart-widget[data-layout="tornado"] .sens-reach').click();
  item = (await g(page, () => fmGraph.board())).items.at(-1);
  expect(item.output.name).toBe('Profit');
  expect(item.inputs.map(i => i.name)).toEqual(['Price', 'Volume', 'Unit cost', 'Overheads']);
  await expect(page.locator('.chart-widget[data-layout="tornado"] .sens-inputs li')).toHaveText(['Price: −10% … +10%', 'Volume: −10% … +10%', 'Unit cost: −10% … +10%', 'Overheads: −10% … +10%']);
  await page.locator('.chart-widget[data-layout="tornado"] select[aria-label="Period"]').selectOption({ label: 'Year 3' });
  expect((await g(page, () => fmGraph.board())).items.at(-1).period).toBe(2);
  // Spider keeps output, period and inputs; its points each side.
  await page.locator('.chart-widget[data-layout="tornado"] select[aria-label="Kind of chart"]').selectOption('spider');
  const spider = page.locator('.chart-widget[data-layout="spider"]');
  await expect(spider).toHaveCount(1);
  await spider.locator('select[aria-label="Points each side"]').selectOption('3');
  item = (await g(page, () => fmGraph.board())).items.at(-1);
  expect([item.layout, item.output.name, item.period, item.steps, item.inputs.length]).toEqual(['spider', 'Profit', 2, 3, 4]);
  await expect(spider.locator('.s-point')).toHaveCount(4 * 7);
  // Each change an undo step, back to the chart as it was.
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect((await g(page, () => fmGraph.board())).items.at(-1).steps).toBe(5);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect((await g(page, () => fmGraph.board())).items.at(-1).layout).toBe('tornado');
  // Period, inputs, output, Tornado, the new chart.
  for(let i = 0; i < 5; i++) await g(page, () => fmGraph.undo());
  expect((await g(page, () => fmGraph.board())).items.length).toBe(before);
  expect(await g(page, () => fmGraph.redo())).toBe(true);
  expect((await g(page, () => fmGraph.board())).items.length).toBe(before + 1);
  expect(pageErrors).toEqual([]);
});

test('the board file, version 8: written, read back, everything cleaned; never in the template form', async ({ page, pageErrors }) => {
  await openSample(page);
  await g(page, () => fmGraph.addChart({ layout: 'tornado', title: 'T', output: 'Profit', period: 2, inputs: [
    { rect: 'Price' }, { rect: 'Unit cost', by: 'amount', low: -0.5, high: 2, show: false }] }));
  await g(page, () => fmGraph.addChart({ layout: 'spider', title: 'S', output: 'Profit', steps: 3, inputs: [{ rect: 'Volume', low: -20, high: 5 }] }));
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(8);
  const [t, s] = file.boards[0].items.slice(-2);
  const at = (nodeId, name) => ({ canvasId: 'cProfit', nodeId, name });
  expect(t).toEqual({ type: 'chart', wide: true, layout: 'tornado', title: 'T', output: at('profit', 'Profit'), period: 1, steps: 5,
    inputs: [Object.assign(at('price', 'Price'), { by: 'percent', low: -10, high: 10 }), Object.assign(at('ucost', 'Unit cost'), { by: 'amount', low: -0.5, high: 2, show: false })] });
  expect(s).toEqual({ type: 'chart', wide: true, layout: 'spider', title: 'S', output: at('profit', 'Profit'), period: 0, steps: 3,
    inputs: [Object.assign(at('vol', 'Volume'), { by: 'percent', low: -20, high: 5 })] });
  // Imported back as a new board: the same figures.
  const was = await g(page, () => fmGraph.board().items.slice(-2).map(w => fmGraph.chart(w.id)));
  expect(await g(page, (d) => fmGraph.importBoards(d), file)).toBe(1);
  await g(page, () => fmGraph.showBoard(1));
  expect(await g(page, () => fmGraph.board().items.slice(-2).map(w => fmGraph.chart(w.id)))).toEqual(was);
  // A hidden input is worked out but not drawn.
  await expect(page.locator('.chart-widget[data-layout="tornado"] .s-row')).toHaveCount(1);
  // Everything read in is cleaned.
  const evil = '<img src=x onerror="window.__pwned=1">';
  const odd = { kind: 'fmIDE-graph-board', version: 8, boards: [{ name: 'Odd', items: [
    { type: 'chart', layout: 'tornado', title: evil, output: at('profit', 'Profit'), period: 'x', steps: 99, colour: 'red', colour2: '#ABCDEF', inputs: [
      Object.assign(at('price', 'Price'), { by: 'x', low: 'abc', high: 1e12 }),
      Object.assign(at('vol', 'Volume'), { by: 'amount', low: '-5', high: -1e300 }),
      Object.assign(at('price', 'Price'), { by: 'amount' }),          // twice: left out
      at('rev', 'Revenue'),                                           // not an input: left out
      { canvasId: 'cProfit', nodeId: 'gone', name: 'Gone' },          // not in the model: left out
      Object.assign(at('ucost', 'Price'), {}),                        // the name doesn't match: left out
      'Price', null, 7,
    ].concat(Array.from({ length: 60 }, () => at('over', 'Overheads'))) },
    { type: 'chart', layout: 'spider', output: { canvasId: 'cProfit', nodeId: 'gone', name: 'Gone' }, inputs: [at('price', 'Price')] }, // no output here: left out
    { type: 'chart', layout: 'spider', steps: 0, inputs: [] },
    { type: 'chart', layout: 'radar', title: 'From a later fmGraph', output: at('profit', 'Profit') }, // a layout this fmGraph doesn't know
  ] }] };
  expect(await g(page, (d) => fmGraph.importBoards(d), odd)).toBe(1);
  await g(page, () => fmGraph.showBoard('Odd'));
  const items = (await g(page, () => fmGraph.board())).items;
  expect(items.map(w => w.layout)).toEqual(['tornado', 'spider', 'columns']);
  expect(items[0]).toMatchObject({ title: evil.slice(0, 80), period: 0, steps: 5, colour2: '#abcdef' });
  expect(items[0].colour).toBeUndefined();
  expect(items[0].inputs.map(i => [i.name, i.by, i.low, i.high])).toEqual([['Price', 'percent', -10, 1e9], ['Volume', 'amount', -5, -1e9], ['Overheads', 'percent', -10, 10]]);
  expect(items[1]).toMatchObject({ output: null, steps: 5, inputs: [] });
  // The unknown layout: an empty chart, as an older fmGraph shows a Tornado or Spider.
  expect(items[2].groups).toEqual([{ name: '', parts: [] }]);
  await expect(page.locator('.chart-widget[data-layout="spider"] .bar-errors')).toContainText('No output yet');
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // Never in the template form: left out and counted.
  await g(page, () => fmGraph.showBoard(0));
  const forTemplate = await g(page, () => fmGraph.exportForTemplate(fmGraph.templates().length - 1, { onlyShown: true }));
  expect(forTemplate.data.version).toBe(2);
  expect(forTemplate.data.boards[0].items.some(w => w.layout === 'tornado' || w.layout === 'spider')).toBe(false);
  expect(forTemplate.left).toBeGreaterThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});

test('a version 7 board file opens as before', async ({ page, pageErrors }) => {
  await openSample(page);
  expect(await g(page, (d) => fmGraph.importBoards(d), readFixture('formats', 'board-v7.json'))).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before the Tornado'));
  const b = await g(page, () => fmGraph.board());
  expect(b.ownSliders).toBe(true);
  expect(b.items.map(w => w.layout || w.type)).toEqual(['bar', 'flow']);
  expect(b.sliders.map(s => s.name)).toEqual(['Price']);
  await expect(page.locator('#barList .widget')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('drawn to the phone\'s width, and holding it opens the quick look, which names it', async ({ page, pageErrors }) => {
    await openSample(page);
    await expect(page.locator('body')).toHaveClass(/phone/);
    await g(page, () => fmGraph.addChart({ layout: 'tornado', title: 'Movers', output: 'Profit' }));
    await g(page, () => fmGraph.addChart({ layout: 'spider', output: 'Profit' }));
    const t = page.locator('.chart-widget[data-layout="tornado"]');
    await t.scrollIntoViewIfNeeded();
    await expect(t.locator('.s-row')).toHaveCount(4);
    await expect(page.locator('.chart-widget[data-layout="spider"] .s-line')).toHaveCount(4);
    const box = await t.locator('svg').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // Held: the quick look.
    const cdp = await page.context().newCDPSession(page);
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#peekBack')).toBeVisible();
    await expect(page.locator('#peekTitle')).toHaveText('Movers');
    await expect(page.locator('#peekWhere')).toHaveText('Tornado · Year 1');
    expect(pageErrors).toEqual([]);
  });
});

test('a slow model: worked out once the sliders stop', async ({ page, pageErrors }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await g(page, (m) => fmGraph.load(m, 'Large'), largeModel());
  const ms = await g(page, () => fmGraph.calcTime());
  const rects = await g(page, () => fmGraph.rectangles());
  const out = rects.filter(r => !r.input).at(-1);
  const inputs = rects.filter(r => r.input).slice(0, 4);
  test.skip(ms * inputs.length * 2 <= 60, 'this machine works the large model out in ' + ms.toFixed(1) + ' ms: the charts are worked out at once');
  const id = await g(page, (a) => fmGraph.addChart({ layout: 'tornado', output: { rect: '#' + a.out.id, canvas: a.out.canvasId },
    inputs: a.inputs.map(r => ({ rect: '#' + r.id, canvas: r.canvasId })) }), { out, inputs });
  const w = page.locator('.chart-widget[data-layout="tornado"]');
  await expect(w.locator('.bar-errors')).toContainText('Working out', { timeout: 10000 });
  await expect(w.locator('.bar-errors')).not.toContainText('Working out', { timeout: 120000 });
  await expect(w.locator('.s-row')).toHaveCount(4);
  // What is drawn agrees with fmGraph.chart (worked out there whatever it costs).
  const f = await chart(page, id);
  expect(await w.locator('.s-row').evaluateAll(els => els.map(e => e.getAttribute('data-input')))).toEqual(f.inputs.map(i => i.name));
  expect(pageErrors).toEqual([]);
});
