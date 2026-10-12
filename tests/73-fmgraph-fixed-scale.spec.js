// 73. fmGraph's fixed vertical scale (the owner's request, 12 October 2026; docs/step15-fmgraph.md).
// A bar or chart is drawn on Auto (as before: stretched to the numbers shown) or on a fixed
// scale, from a min to a max the person chose, so a change shows as a change in size.
// - A bar: Auto by default; Fixed takes what Auto shows, rounded; a slider moved then grows the
//   bar in proportion; the scale's ends drawn; typing from and to by the keyboard; numbers that
//   aren't a scale refused in words; 📏 Fix at current scale; back to Auto.
// - Past the scale: drawn to the edge with ▲ or ▼, the label still the number itself.
// - Charts: columns, waterfall and scenario waterfall from Edit chart (one scale shared by the
//   scenario waterfall's outputs); fmGraph.setScale.
// - Undo and redo (one step each), kept after a reload, the board file (version 5, `scale`),
//   imported, a version 4 file, hostile scales read as Auto.
// - On a phone: the bar's quick look and Show on its fixed scale.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp, readFixture, ROOT } = require('./helpers/apps');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.bar-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const sliderId = (page, name) => g(page, (n) => fmGraph.board().sliders.find(s => s.name === n).id, name);
// The Profit bar's id, and where it is among the board's items.
const itemId = (page) => g(page, () => fmGraph.board().items.find(w => w.type === 'bar' && w.name === 'Profit').id);
const profitItem = (page) => g(page, () => fmGraph.board().items.find(w => w.type === 'bar' && w.name === 'Profit'));
const profitBar = (page) => page.locator('.bar-widget').filter({ has: page.locator('svg[aria-label="Profit"]') });
// Each period's bar in a widget: its top and height, in the chart's own units.
const bars = (widget) => widget.locator('.b-now').evaluateAll(els => els.map(e => ({ y: Number(e.getAttribute('y')), h: Number(e.getAttribute('height')) })));
// The plot's top and height, from the fixed scale's two edge lines.
const plot = (widget) => widget.locator('.b-scale-edge').evaluateAll(els => {
  const ys = els.map(e => Number(e.getAttribute('y1')));
  return { top: ys[0], h: ys[1] - ys[0] };
});
const profits = (page) => g(page, () => [1, 2, 3, 4].map(p => fmGraph.value('Profit', p)));

test('a bar: Auto as before; Fixed takes Auto\'s scale, rounded, and a slider moved then grows the bar in proportion', async ({ page, pageErrors }) => {
  await openSample(page);
  const bar = profitBar(page);
  const price = await sliderId(page, 'Price');
  // Auto: the tallest bar fills the plot, before and after a move.
  await expect(bar.locator('select[aria-label="Vertical scale"]')).toHaveValue('auto');
  await expect(bar.locator('.scale-box')).toHaveCount(2);
  await expect(bar.locator('.scale-box').first()).toBeHidden();
  await expect(bar.locator('.b-scale-edge, .t-axis, .t-over')).toHaveCount(0);
  const autoBefore = await bars(bar);
  const before = await profits(page);
  // Fixed: what Auto shows now, rounded outwards to two figures of its span.
  await bar.locator('select[aria-label="Vertical scale"]').selectOption('fixed');
  const max = Math.max(...before);
  const step = Math.pow(10, Math.floor(Math.log10(max)) - 1);
  const top = Math.ceil(max / step) * step;
  await expect(bar.locator('input[aria-label="Scale from"]')).toHaveValue('0');
  await expect(bar.locator('input[aria-label="Scale to"]')).toHaveValue(String(top));
  expect(await g(page, (i) => fmGraph.scale(i), await itemId(page))).toEqual({ min: 0, max: top });
  await expect(bar.locator('.t-axis')).toHaveText([top.toLocaleString('en-US'), '0']);
  await expect(bar.locator('svg.bar-chart')).toHaveClass(/fixed-scale/);
  // Price up: on Auto every bar would be redrawn to fill the plot; on the fixed scale each bar
  // is its number over the scale's top, so a bigger number is a taller bar.
  await g(page, (s) => fmGraph.setSlider(s, 11), price);
  const after = await profits(page);
  expect(after[0]).toBeGreaterThan(before[0]);
  const p = await plot(bar);
  const fixed = await bars(bar);
  // (a year now past the scale's top stops at its edge)
  fixed.forEach((b, i) => expect(b.h).toBeCloseTo(Math.min(1, after[i] / top) * p.h, 3));
  expect(fixed[0].h).toBeGreaterThan(before[0] / top * p.h + 1);
  // The same move on Auto: the tallest bar fills the plot again, so the bars hardly look different.
  await bar.locator('select[aria-label="Vertical scale"]').selectOption('auto');
  const autoAfter = await bars(bar);
  expect(Math.max(...autoAfter.map(b => b.h))).toBeCloseTo(Math.max(...autoBefore.map(b => b.h)), 3);
  expect(await g(page, (i) => fmGraph.scale(i), await itemId(page))).toBe(null);
  await expect(bar.locator('.b-scale-edge')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('typing the scale by the keyboard; numbers that aren\'t a scale are refused in words; 📏 fixes at what Auto shows now', async ({ page }) => {
  await openSample(page);
  const bar = profitBar(page);
  const id = await itemId(page);
  await bar.locator('select[aria-label="Vertical scale"]').selectOption('fixed');
  const from = bar.locator('input[aria-label="Scale from"]'), to = bar.locator('input[aria-label="Scale to"]');
  await to.fill('10000');
  await to.press('Tab');
  await from.fill('-2000');
  await from.press('Enter');
  expect(await g(page, (i) => fmGraph.scale(i), id)).toEqual({ min: -2000, max: 10000 });
  await expect(bar.locator('.t-axis')).toHaveText(['10,000', '−2,000']);
  // Zero is on the scale: the zero line is drawn where zero is.
  const zero = Number(await bar.locator('.b-zero').getAttribute('y1'));
  const p = await plot(bar);
  expect(zero).toBeCloseTo(p.top + 10000 / 12000 * p.h, 3);
  // From above to: refused, the boxes put back, said in words.
  await from.fill('20000');
  await from.press('Enter');
  await expect(page.locator('#notices .note.err')).toContainText('"from" below "to"');
  await expect(from).toHaveValue('-2000');
  expect(await g(page, (i) => fmGraph.scale(i), id)).toEqual({ min: -2000, max: 10000 });
  // Empty: refused too.
  await to.fill('');
  await to.press('Enter');
  await expect(to).toHaveValue('10000');
  // A scale that doesn't take zero in: the bars stand on its bottom edge, no zero line.
  await from.fill('1000');
  await from.press('Enter');
  await expect(page.locator('#notices .note.err')).toHaveCount(0);
  await expect(bar.locator('.b-zero')).toHaveCount(0);
  // 📏: what Auto would show now (the slider moved), rounded.
  await g(page, (s) => fmGraph.setSlider(s, 14), await sliderId(page, 'Price'));
  const max = Math.max(...(await profits(page)));
  await bar.locator('button[aria-label="Fix at current scale"]').click();
  const s = await g(page, (i) => fmGraph.scale(i), id);
  expect(s.min).toBe(0);
  expect(s.max).toBeGreaterThanOrEqual(max);
  expect(s.max).toBeLessThan(max * 1.1);
  // fmGraph.setScale: the same checks.
  await expect(g(page, (i) => fmGraph.setScale(i, { min: 5, max: 5 }), id)).rejects.toThrow('below');
  expect(await g(page, (i) => fmGraph.setScale(i, { min: 0, max: 50 }), id)).toEqual({ min: 0, max: 50 });
  expect(await g(page, (i) => fmGraph.setScale(i, null), id)).toBe(null);
  await expect(bar.locator('select[aria-label="Vertical scale"]')).toHaveValue('auto');
});

test('past the scale: drawn to the edge with ▲ or ▼, the label still the number itself', async ({ page }) => {
  await openSample(page);
  const bar = profitBar(page);
  const id = await itemId(page);
  const v = await profits(page);
  await g(page, (i) => fmGraph.setScale(i, { min: 0, max: 1000 }), id); // below every year's profit
  const p = await plot(bar);
  const drawn = await bars(bar);
  drawn.forEach(b => { expect(b.y).toBeCloseTo(p.top, 3); expect(b.h).toBeCloseTo(p.h, 3); });
  await expect(bar.locator('.t-over')).toHaveCount(4);
  await expect(bar.locator('.t-over').first()).toContainText('▲');
  await expect(bar.locator('.t-over title').first()).toHaveText('Above the scale (1,000)');
  await expect(bar.locator('.t-value').first()).toHaveText(v[0].toLocaleString('en-US'));
  // Above every number: ▼ on each bar, which stands on the bottom edge.
  await g(page, (i) => fmGraph.setScale(i, { min: 100000, max: 200000 }), id);
  await expect(bar.locator('.t-over')).toHaveCount(4);
  await expect(bar.locator('.t-over').first()).toContainText('▼');
  // Within it: no marks.
  await g(page, (i) => fmGraph.setScale(i, { min: 0, max: 100000 }), id);
  await expect(bar.locator('.t-over')).toHaveCount(0);
});

test('charts: columns and waterfall from Edit chart; the scenario waterfall\'s outputs share one scale', async ({ page }) => {
  await openSample(page);
  const columns = page.locator('.chart-widget[data-layout="columns"]');
  await columns.locator('summary').click();
  await columns.locator('.scale-row select[aria-label="Vertical scale"]').selectOption('fixed');
  await expect(columns.locator('.scale-row input[aria-label="Scale to"]')).toHaveValue('9900'); // the sample's largest side
  await expect(columns.locator('svg.bar-chart')).toHaveClass(/fixed-scale/);
  await expect(columns.locator('.t-axis')).toHaveText(['9,900', '0']);
  await columns.locator('.scale-row input[aria-label="Scale to"]').fill('5000');
  await columns.locator('.scale-row input[aria-label="Scale to"]').press('Enter');
  await expect(columns.locator('.t-over')).toHaveCount(4); // Years 3 and 4, both groups
  await expect(columns.locator('.t-check.ok')).toHaveCount(4); // the balance check unchanged
  const flow = page.locator('.chart-widget[data-layout="flow"]');
  await flow.locator('summary').click();
  await flow.locator('.scale-row button[aria-label="Fix at current scale"]').click();
  await expect(flow.locator('.scale-row input[aria-label="Scale to"]')).toHaveValue('10000');
  await expect(flow.locator('.t-value')).toHaveText(['10,000', '−6,000', '4,000', '−2,500', '1,500']);
  // A scenario waterfall of two outputs: one fixed scale for both.
  await g(page, (s) => fmGraph.setSlider(s, 12), await sliderId(page, 'Price'));
  await g(page, () => fmGraph.saveScenario('High price'));
  const sc = await g(page, () => fmGraph.addChart({ layout: 'scenarios', title: 'Cases', outputs: ['Profit', 'Revenue'] }));
  expect(await g(page, (i) => fmGraph.setScale(i, 'current'), sc)).toEqual({ min: 0, max: 12000 }); // Revenue at 12 × 1,000
  const flows = page.locator('.chart-widget[data-id="' + sc + '"] svg.scenario-flow');
  await expect(flows).toHaveCount(2);
  for(const i of [0, 1]) await expect(flows.nth(i).locator('.t-axis')).toHaveText(['12,000', '0']);
  // Switching kind keeps the scale.
  await page.locator('.chart-widget[data-id="' + sc + '"] .widget-head select[aria-label="Kind of chart"]').selectOption('columns');
  expect(await g(page, (i) => fmGraph.scale(i), sc)).toEqual({ min: 0, max: 12000 });
});

test('undo and redo, kept after a reload, the board file version 5, imported back', async ({ page }) => {
  await openSample(page);
  const bar = profitBar(page);
  const id = await itemId(page);
  await bar.locator('select[aria-label="Vertical scale"]').selectOption('fixed');
  await bar.locator('input[aria-label="Scale to"]').fill('8000');
  await bar.locator('input[aria-label="Scale to"]').press('Enter');
  expect(await g(page, (i) => fmGraph.scale(i), id)).toEqual({ min: 0, max: 8000 });
  // Each change one undo step.
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect((await profitItem(page)).scale.max).not.toBe(8000);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect((await profitItem(page)).scale).toBeUndefined();
  await expect(bar.locator('select[aria-label="Vertical scale"]')).toHaveValue('auto');
  expect(await g(page, () => fmGraph.redo())).toBe(true);
  expect(await g(page, () => fmGraph.redo())).toBe(true);
  await expect(profitBar(page).locator('input[aria-label="Scale to"]')).toHaveValue('8000');
  // A slider move is no step, and leaves the scale as it is.
  await g(page, (s) => fmGraph.setSlider(s, 14), await sliderId(page, 'Price'));
  await expect(profitBar(page).locator('.t-axis')).toHaveText(['8,000', '0']);
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(profitBar(page).locator('select[aria-label="Vertical scale"]')).toHaveValue('fixed');
  await expect(profitBar(page).locator('input[aria-label="Scale to"]')).toHaveValue('8000');
  // The board file: version 5, the bar's scale; another bar on Auto carries none.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(5);
  const profit = file.boards[0].items.find(w => w.type === 'bar' && w.name === 'Profit');
  const cash = file.boards[0].items.find(w => w.type === 'bar' && w.name === 'Closing cash');
  expect(profit.scale).toEqual({ min: 0, max: 8000 });
  expect('scale' in cash).toBe(false);
  // Imported back as a new board, the scale with it.
  expect(await g(page, (d) => fmGraph.importBoards(d), file)).toBe(1);
  expect(await g(page, () => fmGraph.boards().length)).toBe(2);
  await g(page, () => fmGraph.showBoard(1));
  expect((await profitItem(page)).scale).toEqual({ min: 0, max: 8000 });
});

test('a version 4 board file opens, every widget on Auto; hostile scales are read as Auto', async ({ page, pageErrors }) => {
  await openSample(page);
  expect(await g(page, (d) => fmGraph.importBoards(d), readFixture('formats', 'board-v4.json'))).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before fixed scales'));
  const b = await g(page, () => fmGraph.board());
  expect(b.items.map(w => w.scale)).toEqual([undefined, undefined]);
  await expect(page.locator('.bar-widget select[aria-label="Vertical scale"]')).toHaveValue('auto');
  expect(await g(page, () => fmGraph.scenarios().map(s => s.name))).toContain('High price');
  const at = { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', periods: { mode: 'all' } };
  const hostile = [
    { min: '0', max: '100' }, { min: 100, max: 0 }, { min: 5, max: 5 }, { min: 0, max: 1e300 },
    { min: 0 }, [0, 100], '0-100', { min: null, max: 10 }, { min: -Infinity, max: 1 },
  ];
  const n = await g(page, (d) => fmGraph.importBoards(d), { kind: 'fmIDE-graph-board', version: 5, boards: [{ name: 'Odd scales',
    items: hostile.map(scale => Object.assign({ type: 'bar', scale }, at)).concat([Object.assign({ type: 'bar', scale: { min: -1.5, max: 2.5 } }, at)]) }] });
  expect(n).toBe(1);
  await g(page, () => fmGraph.showBoard('Odd scales'));
  const items = (await g(page, () => fmGraph.board())).items;
  expect(items.slice(0, hostile.length).every(w => w.scale === undefined)).toBe(true);
  expect(items[hostile.length].scale).toEqual({ min: -1.5, max: 2.5 });
  expect(pageErrors).toEqual([]);
});

test('on a phone: the bar\'s quick look and Show keep its fixed scale', async ({ browser }) => {
  const URL = 'http://local.test/fmGraph.html';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const blocked = [];
  await context.route('**/*', route => {
    if(route.request().url() === URL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) });
    blocked.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('body')).toHaveClass(/phone/);
  const id = await itemId(page);
  await g(page, (i) => fmGraph.setScale(i, { min: 0, max: 1000 }), id); // below the profits
  const cdp = await context.newCDPSession(page);
  const bar = page.locator('.bar-widget').first();
  await bar.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const box = await bar.locator('.bar-chart-host').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#peekCard')).toBeVisible();
  // The quick look's line: every point on the scale's top edge (8), none above it.
  const ys = await page.locator('#peekChart .peek-dot').evaluateAll(els => els.map(e => Number(e.getAttribute('cy'))));
  expect(ys.length).toBe(4);
  ys.forEach(y => expect(y).toBeCloseTo(8, 3));
  await page.locator('#peekShow').click();
  await expect(page.locator('#showBody svg.bar-chart')).toHaveClass(/fixed-scale/);
  await expect(page.locator('#showBody .t-over')).toHaveCount(4);
  expect(blocked).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
