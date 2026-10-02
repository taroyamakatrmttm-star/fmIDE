// 48. fmGraph's charts (step 15, phase G2; docs/step15-fmgraph.md): two general building
// blocks, columns (groups of rectangles stacked, side by side; an optional check that the
// groups' totals agree) and a waterfall (start, add, subtract, total; totals checked).
// - The sample: its balance sheet (two groups) balances in every year, also with a slider
//   moved; an input moved alone breaks it, shown as ✗ and in words; its waterfall's totals agree.
// - A waterfall with a wrong sign, values below zero, an error, mixed units.
// - Building a chart with the mouse: rectangles, groups, the check, the switch to a waterfall,
//   roles; remembered after a reload. Lit up when a slider reaches it. Hostile text; limits.
const { test, expect } = require('./helpers/apps');
const { openApp } = require('./helpers/apps');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const chartId = (page, title) => g(page, (t) => fmGraph.board().charts.find(c => c.title === t).id, title);
const sliderId = (page, name) => g(page, (n) => fmGraph.board().sliders.find(s => s.name === n).id, name);
// A chart widget by its title (its chart's label starts with it).
const chartNamed = (page, title) => page.locator('.chart-widget').filter({ has: page.locator('svg[aria-label^="' + title + '"]') });
const balanceChart = (page) => chartNamed(page, 'Balance sheet');

test('the sample\'s balance sheet: two groups whose totals agree every year, also with a slider moved', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await chartId(page, 'Balance sheet');
  const totals = async () => (await g(page, (i) => fmGraph.chart(i), id)).map(f => [f.period, f.groups.map(gr => gr.total), f.check]);
  expect(await totals()).toEqual([
    ['Year 1', [3000, 3000], { ok: true, gap: 0 }], ['Year 2', [4900, 4900], { ok: true, gap: 0 }],
    ['Year 3', [7200, 7200], { ok: true, gap: 0 }], ['Year 4', [9900, 9900], { ok: true, gap: 0 }],
  ]);
  const chart = balanceChart(page);
  await expect(chart.locator('.t-check.ok')).toHaveCount(4);
  await expect(chart.locator('.c-part')).toHaveCount(16); // 4 years × 2 groups × 2 rectangles
  await expect(chart.locator('.key-group')).toHaveText(['Assets:', 'Liabilities and equity:']);
  // Price up: profit, cash and equity grow together; still balanced, the model's values outlined.
  await g(page, (s) => fmGraph.setSlider(s, 13), await sliderId(page, 'Price'));
  expect((await totals())[0]).toEqual(['Year 1', [6000, 6000], { ok: true, gap: 0 }]);
  await expect(chart.locator('.t-check.ok')).toHaveCount(4);
  await expect(chart.locator('.b-base')).toHaveCount(8);
  await expect(chart.locator('.bar-errors li')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('an input moved on one side only breaks the balance: ✗ and the gap, in words too', async ({ page }) => {
  await openSample(page);
  const s = await g(page, () => fmGraph.addSlider('Equipment'));
  await g(page, (i) => fmGraph.setSlider(i, 600), s);
  const id = await chartId(page, 'Balance sheet');
  const f = await g(page, (i) => fmGraph.chart(i), id);
  expect(f.map(x => x.check)).toEqual(Array(4).fill({ ok: false, gap: 100 }));
  const chart = balanceChart(page);
  await expect(chart.locator('.t-check.bad')).toHaveCount(4);
  await expect(chart.locator('.t-check.bad title').first()).toHaveText('The groups\' totals differ by 100');
  await expect(chart.locator('.bar-errors li').first()).toHaveText('Year 1: the groups\' totals differ by 100.');
  await g(page, (i) => fmGraph.resetSlider(i), s);
  await expect(chart.locator('.t-check.ok')).toHaveCount(4);
});

test('the sample\'s waterfall: each step from the running total, totals checked', async ({ page }) => {
  await openSample(page);
  const id = await chartId(page, 'Profit');
  const steps = await g(page, (i) => fmGraph.chart(i), id);
  expect(steps.map(s => [s.name, s.role, s.value, s.from, s.to, s.check])).toEqual([
    ['Revenue', 'start', 10000, 0, 10000, null],
    ['Cost of sales', 'subtract', 6000, 10000, 4000, null],
    ['Gross profit', 'total', 4000, 0, 4000, { ok: true, expected: 4000 }],
    ['Overheads', 'subtract', 2500, 4000, 1500, null],
    ['Profit', 'total', 1500, 0, 1500, { ok: true, expected: 1500 }],
  ]);
  const chart = page.locator('.chart-widget[data-layout="flow"]');
  await expect(chart.locator('.f-total')).toHaveCount(3);
  await expect(chart.locator('.f-down')).toHaveCount(2);
  await expect(chart.locator('.t-check.ok')).toHaveCount(2);
  await expect(chart.locator('.t-value')).toHaveText(['10,000', '−6,000', '4,000', '−2,500', '1,500']);
  // Another year, through the editor.
  await chart.locator('summary').click();
  await chart.locator('.chart-edit select[aria-label="Period"]').selectOption({ label: 'Year 4' });
  expect((await g(page, (i) => fmGraph.chart(i), id)).map(s => s.value)).toEqual([13000, 7800, 5200, 2500, 2700]);
  // A wrong sign: Cost of sales added instead of taken off. Gross profit no longer agrees.
  await chart.locator('.step-row').nth(1).locator('select[aria-label="Step"]').selectOption('add');
  const after = await g(page, (i) => fmGraph.chart(i), id);
  expect(after[2].check).toEqual({ ok: false, expected: 13000 + 7800 });
  await expect(chart.locator('.t-check.bad')).toHaveCount(1);
  await expect(chart.locator('.bar-errors li').first()).toHaveText('Gross profit: the steps before it add up to 20,800, not 5,200.');
});

// Found on CI (G4b): the browser reports an editor opened a moment after the click, so the board
// drawn again in between closed it. Now the page itself says which editors are open.
test('an editor just opened stays open when the board is drawn again at once', async ({ page }) => {
  await openSample(page);
  const id = await chartId(page, 'Profit');
  const open = await g(page, (i) => {
    document.querySelector('.chart-widget[data-id="' + i + '"] .chart-edit > summary').click();
    fmGraph.setWide(i, false); // draws the board again before the browser reports the click
    return document.querySelector('.chart-widget[data-id="' + i + '"] .chart-edit').open;
  }, id);
  expect(open).toBe(true);
});

test('columns: below zero stacks downwards; an error shows as ! with its reason; mixed units are pointed out', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const model = { kind: 'system', version: 9, periods: ['P1', 'P2'], canvases: [{ id: 'c', name: 'C', nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: 'Up\n5\n$' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Down\n-3\n$' },
    { id: 'z', type: 'value', x: 0, y: 200, text: 'Zero\n0' }, { id: 'd', type: 'operator', x: 100, y: 100, text: '÷' }, { id: 'q', type: 'value', x: 200, y: 100, text: 'Broken' },
    { id: 'u', type: 'value', x: 0, y: 300, text: 'Count\n4\nunits' },
  ], edges: [{ id: 'e1', from: 'a', to: 'd' }, { id: 'e2', from: 'z', to: 'd' }, { id: 'e3', from: 'd', to: 'q' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Signs'), model);
  const id = await g(page, () => fmGraph.addChart({ title: 'Signs', groups: [{ name: 'Mixed', parts: ['Up', 'Down'] }] }));
  expect((await g(page, (i) => fmGraph.chart(i), id))[0].groups[0]).toEqual({ name: 'Mixed', total: 2, parts: [5, -3] });
  const chart = chartNamed(page, 'Signs');
  const [up, down] = await chart.locator('.c-period').first().locator('.c-part').evaluateAll(els => els.map(e => ({ y: +e.getAttribute('y'), h: +e.getAttribute('height') })));
  const zeroY = await chart.locator('.b-zero').getAttribute('y1');
  expect(up.y + up.h).toBeCloseTo(+zeroY, 5);   // the positive part ends on the zero line…
  expect(down.y).toBeCloseTo(+zeroY, 5);        // …the negative one starts there, going down
  await expect(chart.locator('.bar-errors li')).toHaveCount(0);
  // An error, and units mixed.
  const id2 = await g(page, () => fmGraph.addChart({ title: 'Problems', groups: [{ parts: ['Broken'] }, { parts: ['Up', 'Count'] }] }));
  const f = await g(page, (i) => fmGraph.chart(i), id2);
  expect(f[0].groups[0].total).toEqual({ error: true });
  const chart2 = chartNamed(page, 'Problems');
  await expect(chart2.locator('.t-err')).toHaveCount(2);
  await expect(chart2.locator('.bar-errors')).toContainText('P1, Broken: something it reads could not be worked out'); // (the ÷ before it fails)
  await expect(chart2.locator('.bar-errors')).toContainText('This chart mixes units ($, units)');
});

test('building a chart with the mouse: rectangles, groups, the check, a waterfall; remembered', async ({ page }) => {
  await openSample(page);
  await page.click('#btnAddChart');
  const chart = page.locator('.chart-widget').nth(2);
  await expect(chart.locator('details.chart-edit')).toHaveAttribute('open', '');
  await chart.locator('input.chart-title').fill('My chart');
  await chart.locator('input.chart-title').press('Tab');
  await chart.locator('.part-row select').first().selectOption({ label: 'Revenue' });
  await chart.locator('.add-part').click();
  await chart.locator('.part-row select').nth(1).selectOption({ label: 'Cost of sales' });
  await expect(chart.locator('.check-row input')).toBeDisabled();
  await chart.locator('.add-group').click();
  await chart.locator('.group-edit').nth(1).locator('.part-row select').selectOption({ label: 'Gross profit' });
  await chart.locator('.group-name').first().fill('Sales');
  await chart.locator('.group-name').first().press('Tab');
  await expect(chart.locator('.check-row input')).toBeEnabled();
  await chart.locator('.check-row input').check();
  const id = await chartId(page, 'My chart');
  let f = await g(page, (i) => fmGraph.chart(i), id);
  expect(f[0].groups).toEqual([{ name: 'Sales', total: 16000, parts: [10000, 6000] }, { name: 'Group 2', total: 4000, parts: [4000] }]);
  expect(f[0].check).toEqual({ ok: false, gap: 12000 });
  // Move Cost of sales above Revenue.
  await chart.locator('.part-row').nth(1).getByRole('button', { name: 'Move up' }).click();
  f = await g(page, (i) => fmGraph.chart(i), id);
  expect(f[0].groups[0].parts).toEqual([6000, 10000]);
  // To a waterfall: the rectangles become steps, the first a start.
  await chart.locator('select[aria-label="Kind of chart"]').selectOption('flow');
  await expect(chart).toHaveAttribute('data-layout', 'flow');
  await chart.locator('.step-row').nth(0).locator('select[aria-label="Step"]').selectOption('total'); // (any role works first)
  await chart.locator('.step-row').nth(0).locator('select[aria-label="Step"]').selectOption('start');
  await chart.locator('.step-row').nth(0).locator('select:not([aria-label="Step"])').selectOption({ label: 'Revenue' });
  await chart.locator('.step-row').nth(1).locator('select:not([aria-label="Step"])').selectOption({ label: 'Cost of sales' });
  await chart.locator('.step-row').nth(1).locator('select[aria-label="Step"]').selectOption('subtract');
  await chart.locator('.step-row').nth(2).locator('select[aria-label="Step"]').selectOption('total');
  f = await g(page, (i) => fmGraph.chart(i), id);
  expect(f.map(s => [s.name, s.role, s.check])).toEqual([['Revenue', 'start', null], ['Cost of sales', 'subtract', null], ['Gross profit', 'total', { ok: true, expected: 4000 }]]);
  // Remembered after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(3);
  const kept = await g(page, () => fmGraph.board().charts.find(c => c.title === 'My chart'));
  expect(kept.layout).toBe('flow');
  expect(kept.steps.map(s => [s.name, s.role])).toEqual([['Revenue', 'start'], ['Cost of sales', 'subtract'], ['Gross profit', 'total']]);
  // Removing it.
  await page.locator('.chart-widget').nth(2).getByRole('button', { name: 'Remove this chart' }).click();
  await expect(page.locator('.chart-widget')).toHaveCount(2);
});

test('a chart lights up when a slider reaches any of its rectangles', async ({ page }) => {
  await openSample(page);
  await g(page, () => fmGraph.addChart({ title: 'Costs only', groups: [{ parts: ['Overheads', 'Cost of sales'] }] }));
  const range = page.locator('.slider-widget').first().locator('input[type=range]'); // Price
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#board')).toHaveClass(/moving/);
  await expect(page.locator('.chart-widget.reached')).toHaveCount(2); // the balance sheet and the waterfall
  await expect(chartNamed(page, 'Costs only')).not.toHaveClass(/reached/);
});

test('charts: text shown as text, roles and sizes checked', async ({ page, pageErrors }) => {
  await openSample(page);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const id = await g(page, (e) => fmGraph.addChart({ title: e, groups: [{ name: e, parts: ['Revenue'] }, { name: 'B', parts: ['Profit'] }] }), evil);
  const chart = page.locator('.chart-widget').filter({ has: page.locator('.key-group', { hasText: '<img' }) });
  await expect(chart.locator('input.chart-title')).toHaveValue(evil);
  await expect(chart.locator('.key-group').first()).toHaveText(evil.slice(0, 60) + ':');
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  void id;
  // A role that isn't one is an "add"; too many groups are cut to 12.
  const flow = await g(page, () => fmGraph.addChart({ layout: 'flow', steps: [{ rect: 'Revenue', role: 'evil' }] }));
  expect((await g(page, (i) => fmGraph.chart(i), flow))[0].role).toBe('add');
  const many = await g(page, () => fmGraph.addChart({ groups: Array.from({ length: 20 }, () => ({ parts: ['Profit'] })) }));
  expect((await g(page, (i) => fmGraph.chart(i), many))[0].groups).toHaveLength(12);
  expect(pageErrors).toEqual([]);
});
