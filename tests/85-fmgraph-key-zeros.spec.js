// 85. fmGraph's key leaves out rectangles at 0 (the owner's idea of 27 October 2026; keyChoice
// in 05b-chart-render.js): "if balance sheet has only cash and loan, don't show all the
// accounts in legends".
// - A balance sheet with only Cash and Loan not 0: the key lists those two and "+4 at 0"; the
//   bars at 0 are still drawn; "+4 at 0" lists them too (faded), "Hide the 4 at 0" goes back,
//   the focus staying on the button.
// - A slider making one not 0 brings it back — in a period the chart shows, not in one it
//   doesn't; the dashed outlines' numbers (A) count too; one that can't be worked out stays.
// - Each chart kind with a list of rectangles: Columns, Lines, the Free chart, the Spider (an
//   input at 0 whose line stays flat); the Tornado and the Waterfall have none.
// - Play: both of its ends count, so the key never changes while it plays.
const { test, expect, openApp } = require('./helpers/apps');

const g = (page, fn, arg) => page.evaluate(fn, arg);

// Assets = Cash + Receivables + Inventory + PPE; Liabilities = Loan + Payables;
// Net = Assets − Liabilities; Broken = Cash ÷ Zero (can't be worked out).
const v = (id, x, y, text) => ({ id, type: 'value', x, y, text });
const MODEL = { kind: 'system', version: 9, periods: ['P1', 'P2'], canvases: [{ id: 'c', name: 'C', nodes: [
  v('cash', 0, 0, 'Cash\n100'), v('rec', 0, 100, 'Receivables\n0'), v('inv', 0, 200, 'Inventory\n0'), v('ppe', 0, 300, 'PPE\n0'),
  v('loan', 0, 400, 'Loan\n50'), v('pay', 0, 500, 'Payables\n0'), v('zero', 0, 600, 'Zero\n0'),
  { id: 'o1', type: 'operator', x: 150, y: 100, text: '+' }, v('assets', 250, 100, 'Assets'),
  { id: 'o2', type: 'operator', x: 150, y: 450, text: '+' }, v('liab', 250, 450, 'Liabilities'),
  { id: 'o3', type: 'operator', x: 350, y: 300, text: '−' }, v('net', 450, 300, 'Net'),
  { id: 'o4', type: 'operator', x: 150, y: 650, text: '÷' }, v('broken', 250, 650, 'Broken'),
], edges: [
  { id: 'e1', from: 'cash', to: 'o1' }, { id: 'e2', from: 'rec', to: 'o1' }, { id: 'e3', from: 'inv', to: 'o1' }, { id: 'e4', from: 'ppe', to: 'o1' },
  { id: 'e5', from: 'o1', to: 'assets' },
  { id: 'e6', from: 'loan', to: 'o2' }, { id: 'e7', from: 'pay', to: 'o2' }, { id: 'e8', from: 'o2', to: 'liab' },
  { id: 'e9', from: 'assets', to: 'o3' }, { id: 'e10', from: 'liab', to: 'o3' }, { id: 'e11', from: 'o3', to: 'net' },
  { id: 'e12', from: 'cash', to: 'o4' }, { id: 'e13', from: 'zero', to: 'o4' }, { id: 'e14', from: 'o4', to: 'broken' },
] }] };
const BALANCE = { title: 'Balance sheet', groups: [
  { name: 'Assets', parts: ['Cash', 'Receivables', 'Inventory', 'PPE'] },
  { name: 'Liabilities', parts: ['Loan', 'Payables'] },
] };

async function openModel(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await g(page, (m) => fmGraph.load(m, 'Balance'), MODEL);
}
const addChart = (page, spec) => g(page, (s) => fmGraph.addChart(s), spec);
const widget = (page, id) => page.locator('.chart-widget[data-id="' + id + '"]');
// The rectangles a chart's key lists, and its "+N at 0" button's words ('' when there is none).
const keyOf = (page, id) => g(page, (i) => {
  const el = document.querySelector('.chart-widget[data-id="' + i + '"] .chart-key');
  const b = el.querySelector('.key-zeros');
  return { items: [...el.querySelectorAll('.key-item')].map(x => x.textContent.trim()), zeros: b ? b.textContent : '' };
}, id);

test('a balance sheet with only Cash and Loan: two in the key and "+4 at 0", which lists the others and hides them again', async ({ page }) => {
  await openModel(page);
  const id = await addChart(page, BALANCE);
  expect(await keyOf(page, id)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' });
  // The bars at 0 are still drawn: every part, in every period.
  await expect(widget(page, id).locator('.c-part')).toHaveCount(12);
  const more = widget(page, id).locator('.key-zeros');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toHaveAttribute('title', '4 rectangles are 0 in every period shown: list them too');
  await more.click();
  expect(await keyOf(page, id)).toEqual({ items: ['Cash', 'Receivables', 'Inventory', 'PPE', 'Loan', 'Payables'], zeros: 'Hide the 4 at 0' });
  await expect(widget(page, id).locator('.key-item.key-zero')).toHaveCount(4);
  // Their swatches choose colours there, as the others' do.
  await expect(widget(page, id).locator('.key-item.key-zero input.key-swatch')).toHaveCount(4);
  await expect(widget(page, id).locator('.key-zeros')).toBeFocused();
  await widget(page, id).locator('.key-zeros').click();
  expect(await keyOf(page, id)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' });
  await expect(widget(page, id).locator('.key-zeros')).toBeFocused();
  // Nothing about it is saved: the board file is the same shown or not.
  const before = await g(page, () => JSON.stringify(fmGraph.exportBoards(true)));
  await widget(page, id).locator('.key-zeros').click();
  expect(await g(page, () => JSON.stringify(fmGraph.exportBoards(true)))).toBe(before);
});

test('a slider making one not 0 brings it back, in a period the chart shows only; A counts too; an error stays', async ({ page }) => {
  await openModel(page);
  const both = await addChart(page, Object.assign({}, BALANCE, { periods: 'all' }));
  const first = await addChart(page, Object.assign({}, BALANCE, { title: 'P1 only', periods: 1 }));
  const s = await g(page, () => fmGraph.addSlider('Receivables', { periods: 2 }));
  await g(page, (i) => fmGraph.setSlider(i, 5), s);
  expect(await keyOf(page, both)).toEqual({ items: ['Cash', 'Receivables', 'Loan'], zeros: '+3 at 0' });
  expect(await keyOf(page, first)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' }); // P2 isn't shown there
  // Pinned as A, then the slider back to 0: the dashed outlines are A's, not 0, so it stays.
  await g(page, () => fmGraph.pinA());
  await g(page, (i) => fmGraph.resetSlider(i), s);
  expect(await keyOf(page, both)).toEqual({ items: ['Cash', 'Receivables', 'Loan'], zeros: '+3 at 0' });
  await g(page, () => fmGraph.unpinA());
  expect(await keyOf(page, both)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' });
  // A rectangle that can't be worked out is listed.
  const err = await addChart(page, { title: 'With an error', groups: [{ name: 'A', parts: ['Broken', 'Inventory', 'Cash'] }] });
  expect(await keyOf(page, err)).toEqual({ items: ['Broken', 'Cash'], zeros: '+1 at 0' });
  // Nothing at 0: no button.
  const none = await addChart(page, { title: 'None at 0', groups: [{ name: 'A', parts: ['Cash', 'Loan'] }] });
  expect(await keyOf(page, none)).toEqual({ items: ['Cash', 'Loan'], zeros: '' });
});

test('each chart kind: Lines, the Free chart, the Spider; the Tornado and the Waterfall have no list to shorten', async ({ page }) => {
  await openModel(page);
  const lines = await addChart(page, { layout: 'lines', title: 'Lines', lines: ['Cash', 'Receivables', 'Loan', 'Payables'] });
  expect(await keyOf(page, lines)).toEqual({ items: ['Cash', 'Loan'], zeros: '+2 at 0' });
  await expect(widget(page, lines).locator('.l-line')).toHaveCount(4); // still drawn
  const free = await addChart(page, { layout: 'free', title: 'Free', pieces: [
    { name: 'Assets', column: 0, parts: ['Cash', 'Receivables', 'Inventory'] },
    { name: 'Payables', column: 1, parts: ['Payables'] },   // a piece that is just its one rectangle
    { name: 'Loan', column: 2, parts: ['Loan'] },
  ] });
  expect(await keyOf(page, free)).toEqual({ items: ['Cash', 'Loan'], zeros: '+3 at 0' });
  await widget(page, free).locator('.key-zeros').click();
  expect(await keyOf(page, free)).toEqual({ items: ['Cash', 'Receivables', 'Inventory', 'Payables', 'Loan'], zeros: 'Hide the 3 at 0' });
  // The Spider: Receivables at 0 by percent moves nothing — its line is flat — so it's left
  // out; by an amount it moves Net, so it is listed.
  const spider = await addChart(page, { layout: 'spider', title: 'Spider', output: 'Net', inputs: [
    { rect: 'Cash', by: 'percent', low: -20, high: 20 }, { rect: 'Receivables', by: 'percent', low: -20, high: 20 }] });
  await expect.poll(() => keyOf(page, spider)).toEqual({ items: ['Cash'], zeros: '+1 at 0' });
  const amount = await addChart(page, { layout: 'spider', title: 'By amount', output: 'Net', inputs: [
    { rect: 'Cash', by: 'percent', low: -20, high: 20 }, { rect: 'Receivables', by: 'amount', low: -5, high: 5 }] });
  await expect.poll(() => keyOf(page, amount)).toEqual({ items: ['Cash', 'Receivables'], zeros: '' });
  const tornado = await addChart(page, { layout: 'tornado', title: 'Tornado', output: 'Net', inputs: ['Cash', 'Receivables'] });
  await expect.poll(() => keyOf(page, tornado)).toEqual({ items: ['Low', 'High'], zeros: '' });
  const flow = await addChart(page, { layout: 'flow', title: 'Waterfall', steps: [{ rect: 'Cash', role: 'start' }, { rect: 'Receivables', role: 'add' }, { rect: 'Assets', role: 'total' }] });
  expect(await keyOf(page, flow)).toEqual({ items: [], zeros: '' });
});

test('Play: both of its ends count, so the key stays the same at every position', async ({ page }) => {
  await openModel(page);
  const id = await addChart(page, BALANCE);
  const s = await g(page, () => fmGraph.addSlider('Receivables'));
  await g(page, (i) => fmGraph.setSlider(i, 5), s);
  await g(page, () => fmGraph.saveScenario('Some receivables'));
  await g(page, () => fmGraph.resetAll());
  expect(await keyOf(page, id)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' });
  // From the model's own numbers (Receivables 0) to the scenario (5), and back.
  await g(page, () => fmGraph.play({ from: 'model', to: 'Some receivables', seconds: 0.4, pause: 0.2 }));
  const seen = await g(page, (i) => new Promise(done => {
    const out = new Set(), indexes = new Set();
    const tick = () => {
      const p = fmGraph.playing();
      if(!p) return done({ keys: [...out], indexes: [...indexes] });
      if(p.index >= 0){
        indexes.add(p.index === 0 ? 'from' : p.index === p.positions - 1 ? 'to' : 'between');
        out.add([...document.querySelectorAll('.chart-widget[data-id="' + i + '"] .chart-key .key-item')].map(x => x.textContent.trim()).join(', '));
      }
      if(p.elapsed !== null && p.elapsed > 1400) return done({ keys: [...out], indexes: [...indexes] });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), id);
  await g(page, () => fmGraph.stopPlay());
  expect(seen.indexes.sort()).toEqual(['between', 'from', 'to']);
  expect(seen.keys).toEqual(['Cash, Receivables, Loan']);
  // Stopped: back to the model's own numbers, and Receivables is left out again.
  expect(await keyOf(page, id)).toEqual({ items: ['Cash', 'Loan'], zeros: '+4 at 0' });
});
