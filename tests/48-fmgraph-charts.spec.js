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

// The owner's request (18 October 2026): choosing a rectangle from a long list took too long, so
// every rectangle list opens a search over it, as fmIDE's template and shortcut searches do.
test('choosing a rectangle by searching: a waterfall step, a bar and a slider', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await chartId(page, 'Profit');
  const chart = page.locator('.chart-widget[data-layout="flow"]');
  await chart.locator('summary').click();
  const stepPick = () => chart.locator('.step-row').nth(3).locator('select[aria-label="Rectangle"]');
  // A click on the list opens the search, focused, every rectangle under its canvas, the current one marked.
  await stepPick().click();
  const search = page.locator('#rectSearch');
  await expect(search).toBeVisible();
  await expect(search.locator('input')).toBeFocused();
  await expect(search.locator('.rect-search-group')).toHaveText(['Profit', 'Cash', 'Balance sheet']);
  await expect(search.locator('.rect-search-item.current')).toHaveText('Overheads (input)');
  await expect(search.locator('.rect-search-item.active')).toHaveText('Overheads (input)');
  // Typing narrows it, best match first, each with its canvas; the letters matched in bold.
  await page.keyboard.type('cas');
  await expect(search.locator('.rect-search-name')).toHaveText(['Opening cash', 'Closing cash', 'Cost of sales']);
  await expect(search.locator('.rect-search-canvas')).toHaveText(['Cash', 'Cash', 'Profit']);
  await expect(search.locator('.rect-search-item').first().locator('b')).toHaveText(['c', 'a', 's']);
  await expect(search.locator('.rect-search-group')).toHaveCount(0);
  // ↓ then Enter takes it: the step is Closing cash, as choosing it from the list does.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(search).toHaveCount(0);
  expect((await g(page, (i) => fmGraph.chart(i), id)).map(st => st.name)[3]).toBe('Closing cash');
  await expect(stepPick()).toBeFocused();
  // No match says so; Esc closes and changes nothing.
  await stepPick().click();
  await page.keyboard.type('zzqq');
  await expect(search.locator('.rect-search-none')).toHaveText('No rectangle matches "zzqq".');
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  expect((await g(page, (i) => fmGraph.chart(i), id)).map(st => st.name)[3]).toBe('Closing cash');
  // A letter typed on the list starts the search with it; a click on a match takes it.
  await stepPick().focus();
  await page.keyboard.press('o');
  await expect(search.locator('input')).toHaveValue('o');
  await page.keyboard.type('verh');
  await search.locator('.rect-search-item', { hasText: 'Overheads' }).click();
  expect((await g(page, (i) => fmGraph.chart(i), id)).map(st => st.name)[3]).toBe('Overheads');
  // A click elsewhere closes it.
  await stepPick().click();
  await page.locator('#board').click({ position: { x: 5, y: 5 } });
  await expect(search).toHaveCount(0);
  // A bar's list: the same search.
  const bar = page.locator('.bar-widget').first();
  await bar.locator('.widget-head select').click();
  await page.keyboard.type('gross');
  await page.keyboard.press('Enter');
  expect((await g(page, () => fmGraph.board().bars.map(b => b.name)))[0]).toBe('Gross profit');
  // A slider's list holds the inputs only, and so does its search.
  await page.locator('.slider-widget').first().locator('.widget-head select').click();
  await expect(search.locator('.rect-search-name')).toHaveText(['Price', 'Volume', 'Unit cost', 'Overheads', 'Equipment', 'Debt']);
  await page.keyboard.type('unit');
  await page.keyboard.press('Enter');
  expect((await g(page, () => fmGraph.board().sliders.map(s => s.name)))[0]).toBe('Unit cost');
  expect(pageErrors).toEqual([]);
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

// ---- The lines chart (board file 10, 19 October 2026): several rectangles over the periods ----
const pickColour = (loc, colour) => loc.evaluate((el, c) => { el.value = c; el.dispatchEvent(new Event('change', { bubbles: true })); }, colour);
const lineFigures = async (page, id) => (await g(page, (i) => fmGraph.chart(i), id)).map(f => [f.period, f.lines.map(l => [l.name, l.value])]);

test('a lines chart built with the mouse: its rectangles, figures, points and key; colours; remembered', async ({ page, pageErrors }) => {
  await openSample(page);
  await page.click('#btnAddChart');
  const chart = page.locator('.chart-widget').nth(2);
  await chart.locator('select[aria-label="Kind of chart"]').selectOption('lines');
  await expect(chart).toHaveAttribute('data-layout', 'lines');
  await expect(chart.locator('details.chart-edit')).toHaveAttribute('open', '');
  await chart.locator('input.chart-title').fill('Sales and profit');
  await chart.locator('input.chart-title').press('Tab');
  // The column's one rectangle became the first line; + Rectangle adds the next calculated one.
  await expect(chart.locator('.line-row')).toHaveCount(1);
  await chart.locator('.line-row select').first().selectOption({ label: 'Revenue' });
  await chart.locator('.add-line').click();
  await expect(chart.locator('.line-row')).toHaveCount(2);
  await chart.locator('.line-row select').nth(1).selectOption({ label: 'Profit' });
  const id = await chartId(page, 'Sales and profit');
  expect(await lineFigures(page, id)).toEqual([
    ['Year 1', [['Revenue', 10000], ['Profit', 1500]]], ['Year 2', [['Revenue', 11000], ['Profit', 1900]]],
    ['Year 3', [['Revenue', 12000], ['Profit', 2300]]], ['Year 4', [['Revenue', 13000], ['Profit', 2700]]],
  ]);
  // A line each, a point per period, the numbers on them, the periods under them, a key.
  await expect(chart.locator('.l-path')).toHaveCount(2);
  await expect(chart.locator('.l-point')).toHaveCount(8);
  await expect(chart.locator('.l-line[data-line="Revenue"] .t-value')).toHaveText(['10,000', '11,000', '12,000', '13,000']);
  await expect(chart.locator('.t-period')).toHaveText(['Year 1', 'Year 2', 'Year 3', 'Year 4']);
  await expect(chart.locator('.chart-key .key-item')).toHaveText(['Revenue', 'Profit']);
  await expect(chart.locator('.l-base')).toHaveCount(0);
  await expect(chart.locator('.bar-errors li')).toHaveCount(0);
  // Higher numbers higher up: Revenue's points above Profit's.
  const cy = (name) => chart.locator('.l-line[data-line="' + name + '"] .l-point').first().getAttribute('cy');
  expect(Number(await cy('Revenue'))).toBeLessThan(Number(await cy('Profit')));
  // ↑ moves Profit first; × takes Revenue out.
  await chart.locator('.line-row').nth(1).getByRole('button', { name: 'Move up' }).click();
  expect((await lineFigures(page, id))[0]).toEqual(['Year 1', [['Profit', 1500], ['Revenue', 10000]]]);
  await chart.locator('.add-line').click();
  await chart.locator('.line-row select').nth(2).selectOption({ label: 'Gross profit' });
  await chart.locator('.line-row').nth(1).getByRole('button', { name: 'Remove' }).click();
  expect((await lineFigures(page, id))[0]).toEqual(['Year 1', [['Profit', 1500], ['Gross profit', 4000]]]);
  // The key's swatch picks a line's colour: the line and its points take it.
  await pickColour(chart.locator('.chart-key input.key-swatch').first(), '#ff0000');
  await expect(chart.locator('.l-line[data-line="Profit"] .l-path')).toHaveAttribute('stroke', '#ff0000');
  await expect(chart.locator('.l-line[data-line="Profit"] .l-point').first()).toHaveAttribute('fill', '#ff0000');
  await expect.poll(async () => (await g(page, (i) => fmGraph.board().charts.find(c => c.id === i), id)).lines.map(l => l.colour || null)).toEqual(['#ff0000', null]);
  // A fixed scale: the points stay inside it, ▲ where a number goes past it.
  await g(page, (i) => fmGraph.setScale(i, { min: 0, max: 3000 }), id);
  await expect(chart.locator('svg.lines-chart.fixed-scale')).toHaveCount(1);
  await expect(chart.locator('.l-line[data-line="Gross profit"] .t-over')).toHaveCount(4);
  await expect(chart.locator('.l-line[data-line="Profit"] .t-over')).toHaveCount(0);
  await g(page, (i) => fmGraph.setScale(i, null), id);
  // Remembered after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(3);
  const kept = await g(page, () => fmGraph.board().charts.find(c => c.title === 'Sales and profit'));
  expect(kept.layout).toBe('lines');
  expect(kept.lines.map(l => [l.name, l.colour || null])).toEqual([['Profit', '#ff0000'], ['Gross profit', null]]);
  expect(kept.periods).toEqual({ mode: 'all' });
  expect(pageErrors).toEqual([]);
});

test('a lines chart follows the shared period, or keeps its own; a slider moves it, the model\'s own numbers dashed', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'lines', title: 'Lines', lines: ['Revenue', 'Profit'] }));
  const chart = chartNamed(page, 'Lines');
  // Made without periods: it follows the shared ones, as a Columns chart does.
  expect(await g(page, (i) => fmGraph.board().charts.find(c => c.id === i).ownPeriod, id)).toBeUndefined();
  const shared = page.locator('#sharedPeriodBar');
  await shared.locator('select[aria-label="Shared periods"]').selectOption('range');
  await shared.locator('select[aria-label="Shared first period"]').selectOption('1');
  expect((await lineFigures(page, id)).map(f => f[0])).toEqual(['Year 2', 'Year 3', 'Year 4']);
  await expect(chart.locator('.l-point')).toHaveCount(6);
  await expect(chart.locator('.t-period')).toHaveText(['Year 2', 'Year 3', 'Year 4']);
  // Its own periods (Edit chart): the shared ones no longer move it; Shared again follows.
  await chart.locator('summary').click();
  const periods = chart.locator('.chart-edit select[aria-label="Periods"]');
  await expect(periods).toHaveValue('shared');
  await expect(periods.locator('option').first()).toHaveText('Shared (Year 2 to Year 4)');
  await periods.selectOption('one');
  await chart.locator('.chart-edit select[aria-label="Period"]').selectOption('0');
  await shared.locator('select[aria-label="Shared periods"]').selectOption('all');
  expect((await lineFigures(page, id)).map(f => f[0])).toEqual(['Year 1']);
  expect(await g(page, (i) => fmGraph.board().charts.find(c => c.id === i).ownPeriod, id)).toBe(true);
  await chart.locator('.chart-edit select[aria-label="Periods"]').selectOption('shared');
  expect((await lineFigures(page, id)).map(f => f[0])).toEqual(['Year 1', 'Year 2', 'Year 3', 'Year 4']);
  // The API's periods given: its own.
  const own = await g(page, () => fmGraph.addChart({ layout: 'lines', title: 'Own', periods: [2, 3], lines: ['Profit'] }));
  expect(await g(page, (i) => fmGraph.board().charts.find(c => c.id === i).ownPeriod, own)).toBe(true);
  expect((await lineFigures(page, own)).map(f => f[0])).toEqual(['Year 2', 'Year 3']);
  // A slider reaches it: lit while moved; Price up moves both lines, the model's own numbers dashed.
  const range = page.locator('.slider-widget').first().locator('input[type=range]'); // Price
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await expect(chart).toHaveClass(/reached/);
  await g(page, (s) => fmGraph.setSlider(s, 12), await sliderId(page, 'Price'));
  expect((await lineFigures(page, id))[0]).toEqual(['Year 1', [['Revenue', 12000], ['Profit', 3500]]]);
  await expect(chart.locator('.l-base')).toHaveCount(2);
  await expect(chart.locator('.l-line[data-line="Profit"] .l-point title').first()).toHaveText(/^Profit, Year 1: 3,500 — was 1,500/);
  await g(page, () => fmGraph.resetAll());
  await expect(chart.locator('.l-base')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('switching between columns and lines keeps the rectangles and periods; other kinds take the lines', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ title: 'Mix', periods: [2, 4], groups: [{ name: 'A', parts: ['Revenue', 'Cost of sales'] }, { name: 'B', parts: ['Profit', 'Revenue'] }] }));
  const kind = () => page.locator('.chart-widget').nth(2).locator('select[aria-label="Kind of chart"]');
  const now = () => g(page, (i) => fmGraph.board().charts.find(x => x.id === i), id);
  await kind().selectOption('lines');
  // The groups' parts flattened, each once, in order; the periods kept.
  let c = await now();
  expect([c.layout, c.lines.map(l => l.name), c.periods]).toEqual(['lines', ['Revenue', 'Cost of sales', 'Profit'], { mode: 'range', from: 1, to: 3 }]);
  expect((await lineFigures(page, id)).map(f => f[0])).toEqual(['Year 2', 'Year 3', 'Year 4']);
  // Back to columns: the lines one group, the periods kept.
  await kind().selectOption('columns');
  c = await now();
  expect([c.layout, c.groups.map(gr => gr.parts.map(p => p.name)), c.periods]).toEqual(['columns', [['Revenue', 'Cost of sales', 'Profit']], { mode: 'range', from: 1, to: 3 }]);
  // Lines → a waterfall: the lines become steps, in the first period shown; and back to lines.
  await kind().selectOption('lines');
  await kind().selectOption('flow');
  c = await now();
  expect([c.layout, c.steps.map(s => [s.name, s.role]), c.period]).toEqual(['flow', [['Revenue', 'start'], ['Cost of sales', 'add'], ['Profit', 'add']], 1]);
  await kind().selectOption('lines');
  c = await now();
  expect([c.layout, c.lines.map(l => l.name)]).toEqual(['lines', ['Revenue', 'Cost of sales', 'Profit']]);
  // Undo goes back to the waterfall (the board read back from its file form: found by title).
  await page.click('#btnUndo');
  expect((await g(page, () => fmGraph.board().charts.find(x => x.title === 'Mix'))).layout).toBe('flow');
  // Never in the template form (which stays version 2): left out and counted.
  const before = await g(page, () => fmGraph.exportForTemplate(fmGraph.templates().length - 1, { onlyShown: true }));
  await g(page, () => fmGraph.addChart({ layout: 'lines', title: 'Trend', lines: ['Revenue'] }));
  const forTemplate = await g(page, () => fmGraph.exportForTemplate(fmGraph.templates().length - 1, { onlyShown: true }));
  expect(forTemplate.data.version).toBe(2);
  expect(forTemplate.data.boards[0].items.some(w => w.layout === 'lines')).toBe(false);
  expect(forTemplate.left).toBe(before.left + 1);
  expect(pageErrors).toEqual([]);
});

test('lines: names shown as text, an error breaks the line and is listed, at most 12 lines, colours checked', async ({ page, pageErrors }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: ['P1', 'P2', 'P3'], canvases: [{ id: 'c', name: 'C', nodes: [
    { id: 'one', type: 'value', x: 0, y: 0, text: 'One\n1' }, { id: 'd', type: 'operator', x: 100, y: 0, text: '÷' },
    { id: 'a', type: 'value', x: 0, y: 100, text: 'Divisor\n5', periodValues: [5, 0, 2] }, { id: 'q', type: 'value', x: 200, y: 0, text: 'Ratio' },
    { id: 'h', type: 'value', x: 0, y: 200, text: evil + '\n3' },
  ], edges: [{ id: 'e1', from: 'one', to: 'd' }, { id: 'e2', from: 'a', to: 'd' }, { id: 'e3', from: 'd', to: 'q' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Evil'), model);
  const id = await g(page, (e) => fmGraph.addChart({ layout: 'lines', title: e, lines: ['Ratio', '#h'] }), evil);
  const chart = page.locator('.chart-widget[data-layout="lines"]');
  await expect(chart.locator('input.chart-title')).toHaveValue(evil);
  await expect(chart.locator('.chart-key .key-item').nth(1)).toHaveText(evil);
  await expect(chart.locator('svg.lines-chart')).toHaveAttribute('aria-label', evil);
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // 1 ÷ 0 in P2: Ratio's line is broken there (no line through the gap), the reason in words.
  const f = await g(page, (i) => fmGraph.chart(i), id);
  expect(f.map(x => x.lines[0].value)).toEqual([0.2, { error: expect.anything() }, 0.5]);
  await expect(chart.locator('.l-line[data-line="Ratio"] .l-point')).toHaveCount(2);
  await expect(chart.locator('.l-line[data-line="Ratio"] .l-path')).toHaveCount(0);
  await expect(chart.locator('.l-line[data-line="Ratio"] .t-err')).toHaveCount(1);
  await expect(chart.locator('.bar-errors li')).toHaveCount(1);
  await expect(chart.locator('.bar-errors li').first()).toContainText('P2, Ratio:');
  // At most 12 lines, from the API and from a file; a colour that isn't one is left out.
  expect(await g(page, () => { try{ fmGraph.addChart({ layout: 'lines', lines: Array(13).fill('Ratio') }); return 'added'; }catch(e){ return e.message; } })).toBe('A lines chart draws at most 12 lines.');
  const line = { canvasId: 'c', nodeId: 'q', name: 'Ratio', colour: 'red;background:url(x)' };
  expect(await g(page, (l) => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 10, boards: [{ name: 'Many', items: [
    { type: 'chart', layout: 'lines', title: 'Many', periods: { mode: 'all' }, lines: Array(20).fill(l).concat([{ canvasId: 'c', nodeId: 'gone', name: 'Gone' }, 'odd', null]) }] }] }), line)).toBe(1);
  await g(page, () => fmGraph.showBoard('Many'));
  const many = (await g(page, () => fmGraph.board())).charts[0];
  expect(many.lines).toHaveLength(12);
  expect(many.lines.every(l => l.colour === undefined)).toBe(true);
  expect(pageErrors).toEqual([]);
});
