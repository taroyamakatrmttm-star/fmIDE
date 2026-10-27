// 89. Placing a Free chart's pieces on the grid (phase F2 of docs/fmgraph-free-chart.md), with a
// real mouse (and a finger) on the board:
// - Across, column by column: a piece's stack moves with it; a column it can't share swaps with
//   the piece there; each move one undo step.
// - The equal-gap marks and the snap to equal spacing (the shared equalSpacingSnap).
// - Up and down: the guides propose where it sits (on top of, where … ends), letting go takes
//   it; with no guide near it keeps its Sits. fmGraph.movePiece, a loop refused.
// - Shift+click and a box select several: Align bottoms, Distribute, Tidy. The keys.
// - Never in the full screen or on a phone; a finger drags after a hold, a swipe doesn't.
// - A name with markup in a guide's words is shown as text.
const { test, expect, openApp } = require('./helpers/apps');

const g = (page, fn, arg) => page.evaluate(fn, arg);
const MODEL = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [
  { id: 'cash', type: 'value', x: 0, y: 0, text: 'Cash\n100' },
  { id: 'neg', type: 'value', x: 0, y: 100, text: 'Neg\n-30' },
  { id: 'cfo', type: 'value', x: 0, y: 200, text: 'CFO\n50' },
  { id: 'loan', type: 'value', x: 0, y: 300, text: 'Loan\n300' },
  { id: 'x', type: 'value', x: 0, y: 400, text: 'X\n20' },
], edges: [] }] };
// A: 100 up, 30 down, ends at 70. B on zero. L with More on top of it, in one column. T alone.
const CHART = (aName) => ({ layout: 'free', title: 'Grid', pieces: [
  { name: aName || 'A', column: 0, sits: { on: 'zero' }, parts: ['Cash', 'Neg'] },   // 0
  { name: 'B', column: 1, sits: { on: 'zero' }, parts: ['CFO'] },                    // 1
  { name: 'L', column: 3, sits: { on: 'zero' }, parts: ['Loan'] },                   // 2
  { name: 'More', column: 3, sits: { on: 'top', of: 2 }, parts: ['X'] },             // 3
  { name: 'T', column: 5, sits: { on: 'zero' }, parts: ['X'] },                      // 4
] });

async function openChart(page, spec){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await g(page, (m) => fmGraph.load(m, 'Grid'), MODEL);
  return g(page, (s) => fmGraph.addChart(s), spec || CHART());
}
const chartEl = (page) => page.locator('#board .chart-widget[data-layout="free"]');
const part = (page, i) => chartEl(page).locator(`.fr-piece[data-piece="${i}"] .c-part`).first();
// The Free chart's figures now (an undo reads the boards again, with new ids).
const now = (page) => g(page, () => fmGraph.chart(fmGraph.board().charts.find(c => c.layout === 'free').id));
const columns = async (page) => (await now(page)).pieces.map(p => p.column);
const bases = async (page) => (await now(page)).pieces.map(p => p.base);
// Screen pixels from one column to the next, and per unit of value (from piece i's one rectangle of value v).
async function pitch(page){
  const a = await part(page, 0).boundingBox(), b = await part(page, 1).boundingBox();
  return b.x - a.x; // A in column 0, B in column 1
}
async function perUnit(page, i, v){ return (await part(page, i).boundingBox()).height / Math.abs(v); }
// Drags piece i by dx, dy screen pixels with the mouse; during() runs with the button down.
async function dragPiece(page, i, dx, dy, during){
  const b = await part(page, i).boundingBox();
  const sx = b.x + b.width / 2, sy = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx / 2, sy + dy / 2, { steps: 4 });
  await page.mouse.move(sx + dx, sy + dy, { steps: 4 });
  if(during) await during();
  await page.mouse.up();
}
const label = (page) => chartEl(page).locator('.fr-guide-label');

test('across, column by column: the stack moves with it, a piece there swaps, each move one undo step', async ({ page, pageErrors }) => {
  const id = await openChart(page);
  await expect(chartEl(page).locator('svg.free-grid')).toHaveCount(1);
  await expect(chartEl(page).locator('.free-tools button')).toHaveCount(3);
  const step = await pitch(page);
  // L (with More on top of it) one column left, into the empty column 2.
  await dragPiece(page, 2, -step, 0, async () => {
    await expect(chartEl(page).locator('.fr-target')).toHaveCount(1);
  });
  expect(await columns(page, id)).toEqual([0, 1, 2, 2, 5]);
  await expect(chartEl(page).locator('.fr-drag-mark')).toHaveCount(0);
  // B one column right, onto L's column: L and More swap to column 1.
  await dragPiece(page, 1, step, 0);
  expect(await columns(page, id)).toEqual([0, 2, 1, 1, 5]);
  expect(await bases(page, id)).toEqual([0, 0, 0, 300, 0]);
  // Edit chart's list says the same.
  await chartEl(page).locator('summary', { hasText: 'Edit chart' }).click();
  await expect(chartEl(page).locator('.piece-edit').nth(1).locator('.piece-column')).toHaveText('Column 3');
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await columns(page, id)).toEqual([0, 1, 2, 2, 5]);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await columns(page, id)).toEqual([0, 1, 3, 3, 5]);
  expect(pageErrors).toEqual([]);
});

test('equal spacing: the marks show and it snaps where the empty columns match; none elsewhere', async ({ page }) => {
  const id = await openChart(page, { layout: 'free', title: 'Gaps', pieces: [
    { name: 'A', column: 0, parts: ['Cash'] }, { name: 'B', column: 2, parts: ['CFO'] }, { name: 'Z', column: 6, parts: ['X'] }] });
  const a = await part(page, 0).boundingBox(), b = await part(page, 1).boundingBox();
  const step = (b.x - a.x) / 2;
  // Z dragged to column 4.4: snaps to 4, one empty column either side of B, with the marks.
  await dragPiece(page, 2, -1.6 * step, 0, async () => {
    await expect(chartEl(page).locator('line.fr-gap')).toHaveCount(6);
  });
  expect(await columns(page, id)).toEqual([0, 2, 4]);
  await expect(chartEl(page).locator('.fr-gap')).toHaveCount(0);
  // From 4 to 5.3: no equal spacing near, so the nearest column, 5, and no marks.
  await dragPiece(page, 2, 1.3 * step, 0, async () => {
    await expect(chartEl(page).locator('.fr-target')).toHaveCount(1);
    await expect(chartEl(page).locator('.fr-gap')).toHaveCount(0);
  });
  expect(await columns(page, id)).toEqual([0, 2, 5]);
});

test('up and down: the guides propose where it sits, letting go takes it; no guide near keeps its Sits', async ({ page, pageErrors }) => {
  const id = await openChart(page);
  // B up to 100: on top of A.
  let u = await perUnit(page, 1, 50);
  await dragPiece(page, 1, 0, -100 * u, async () => {
    await expect(label(page)).toHaveText('on top of A');
    await expect(chartEl(page).locator('.fr-guide')).toHaveCount(1);
  });
  expect((await bases(page, id))[1]).toBe(100);
  // Down to 70: where A ends.
  u = await perUnit(page, 1, 50);
  await dragPiece(page, 1, 0, 30 * u, async () => { await expect(label(page)).toHaveText('where A ends'); });
  expect((await bases(page, id))[1]).toBe(70);
  // Up to 200, far from every place it could sit: no guide, and it stays where A ends (1a).
  u = await perUnit(page, 1, 50);
  await dragPiece(page, 1, 0, -130 * u, async () => { await expect(label(page)).toHaveCount(0); });
  expect((await bases(page, id))[1]).toBe(70);
  // movePiece: a loop refused; T where B ends, in column 6.
  await expect(g(page, (i) => fmGraph.movePiece(i, 0, { sits: { on: 'top', of: 1 } }), id)).rejects.toThrow(/loop/);
  const f = await g(page, (i) => fmGraph.movePiece(i, 4, { column: 6, sits: { on: 'end', of: 1 } }), id);
  expect([f.pieces[4].column, f.pieces[4].base]).toEqual([6, 120]);
  expect(pageErrors).toEqual([]);
});

test('Shift+click selects several: Align bottoms, Distribute (a column in the way moves on), Tidy', async ({ page }) => {
  const id = await openChart(page);
  await g(page, (i) => fmGraph.movePiece(i, 1, { sits: { on: 'end', of: 0 } }), id);
  const tools = chartEl(page).locator('.free-tools');
  await expect(tools.locator('.free-align')).toBeDisabled();
  await part(page, 0).click({ modifiers: ['Shift'] });
  await part(page, 1).click({ modifiers: ['Shift'] });
  await expect(chartEl(page).locator('.fr-piece.selected')).toHaveCount(2);
  await tools.locator('.free-align').click();
  expect(await bases(page, id)).toEqual([0, 0, 0, 300, 0]);
  // A, B and T (columns 0, 1, 5): spread to 0, 3, 5; L and More, in column 3, move on together.
  await expect(tools.locator('.free-distribute')).toBeDisabled();
  await part(page, 4).click({ modifiers: ['Shift'] });
  await tools.locator('.free-distribute').click();
  expect(await columns(page, id)).toEqual([0, 3, 6, 6, 5]);
  await tools.locator('.free-tidy').click();
  expect(await columns(page, id)).toEqual([0, 1, 3, 3, 2]);
  await expect(tools.locator('.free-tidy')).toBeDisabled();
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await columns(page, id)).toEqual([0, 3, 6, 6, 5]);
});

test('a box dragged on the empty chart selects the pieces it touches; a click there clears them', async ({ page }) => {
  await openChart(page);
  const svgBox = await chartEl(page).locator('svg.free-chart').boundingBox();
  const step = await pitch(page);
  const b = await part(page, 1).boundingBox();
  await page.mouse.move(svgBox.x + 2, svgBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width + step * 0.2, svgBox.y + svgBox.height - 2, { steps: 6 });
  await expect(chartEl(page).locator('.fr-box')).toHaveCount(1);
  await page.mouse.up();
  await expect(chartEl(page).locator('.fr-box')).toHaveCount(0);
  await expect(chartEl(page).locator('.fr-piece.selected')).toHaveCount(2);
  await page.mouse.click(svgBox.x + 2, svgBox.y + 2);
  await expect(chartEl(page).locator('.fr-piece.selected')).toHaveCount(0);
});

test('the keys: ← → a column, ↑ ↓ the next place it could sit', async ({ page }) => {
  const id = await openChart(page);
  await part(page, 1).click();
  await page.keyboard.press('ArrowRight');
  expect(await columns(page, id)).toEqual([0, 2, 3, 3, 5]);
  await page.keyboard.press('ArrowUp');   // where T ends (20)
  expect((await bases(page, id))[1]).toBe(20);
  await page.keyboard.press('ArrowUp');   // where A ends
  expect((await bases(page, id))[1]).toBe(70);
  await page.keyboard.press('ArrowUp');   // on top of A
  expect((await bases(page, id))[1]).toBe(100);
  await page.keyboard.press('ArrowDown');
  expect((await bases(page, id))[1]).toBe(70);
  await page.keyboard.press('ArrowLeft');
  expect(await columns(page, id)).toEqual([0, 1, 3, 3, 5]);
});

test('never in the full screen: the pieces there are only drawn', async ({ page }) => {
  await openChart(page);
  await chartEl(page).locator('.widget-full').click();
  await expect(page.locator('#showView')).toBeVisible();
  await expect(page.locator('#showView svg.free-chart')).toHaveCount(1);
  await expect(page.locator('#showView svg.free-grid')).toHaveCount(0);
  await expect(page.locator('#showView .free-tools')).toHaveCount(0);
  await expect(page.locator('#showView .fr-piece[tabindex]')).toHaveCount(0);
});

test('a name with markup in a guide\'s words is shown as text', async ({ page, pageErrors }) => {
  const id = await openChart(page, CHART('<img src=x onerror="window.__bad=1">'));
  const u = await perUnit(page, 1, 50);
  await dragPiece(page, 1, 0, -100 * u, async () => {
    await expect(label(page)).toHaveText('on top of <img src=x onerror="window.__bad=1">');
  });
  expect((await bases(page, id))[1]).toBe(100);
  expect(await page.locator('#board img').count()).toBe(0);
  expect(await g(page, () => window.__bad)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test.describe('by touch, on a tablet', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  test('a finger held on a piece drags it; a quick swipe does not', async ({ page }) => {
    const id = await openChart(page);
    const step = await pitch(page);
    const b = await part(page, 1).boundingBox();
    const sx = b.x + b.width / 2, sy = b.y + b.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    // A swipe at once: nothing moves.
    await send('touchStart', [{ x: sx, y: sy }]);
    for(let i = 1; i <= 6; i++) await send('touchMove', [{ x: sx + step * i / 6, y: sy }]);
    await send('touchEnd', []);
    expect(await columns(page, id)).toEqual([0, 1, 3, 3, 5]);
    // Held still, then moved: one column right.
    await send('touchStart', [{ x: sx, y: sy }]);
    await page.waitForTimeout(700);
    for(let i = 1; i <= 8; i++) await send('touchMove', [{ x: sx + step * 1.1 * i / 8, y: sy }]);
    await send('touchEnd', []);
    expect(await columns(page, id)).toEqual([0, 2, 3, 3, 5]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the chart is drawn, its pieces placed with the list only', async ({ page }) => {
    await openChart(page);
    await expect(page.locator('body.phone')).toHaveCount(1);
    await expect(page.locator('svg.free-chart')).toHaveCount(1);
    await expect(page.locator('svg.free-grid')).toHaveCount(0);
    await expect(page.locator('.free-tools')).toHaveCount(0);
  });
});
