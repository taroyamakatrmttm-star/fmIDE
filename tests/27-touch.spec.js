// 27. Touch — fmIDE's canvas by finger (step 9a). Chromium with a touchscreen at tablet size;
// the touches are real touch input sent through the Chrome DevTools Protocol
// (Input.dispatchTouchEvent), not mouse events, and each test checks the page saw them as
// touch. The mouse is covered, unchanged, by every other group.
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

// A finger: tap, drag (optionally holding first). Points are page coordinates.
async function finger(page){
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y })) });
  return {
    async drag(from, to, { steps = 8 } = {}){
      await send('touchStart', [from]);
      for(let i = 1; i <= steps; i++){
        const t = i / steps;
        await send('touchMove', [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }]);
      }
      await send('touchEnd', []);
    },
    async tap(p){ await send('touchStart', [p]); await send('touchEnd', []); },
  };
}
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const box = async (locator) => { const b = await locator.boundingBox(); expect(b).toBeTruthy(); return b; };
const nodeEl = (page, id) => page.locator(`.node[data-id="${id}"]`);
const nodeOf = (page, id) => page.evaluate((id) => fm.nodes().find(n => n.id === id), id);

// Every pointerdown the page sees, by type: proves the input was touch, not a mouse.
async function watchPointerTypes(page){
  await page.evaluate(() => {
    window.__pointerTypes = [];
    window.addEventListener('pointerdown', (ev) => window.__pointerTypes.push(ev.pointerType), true);
  });
  return async () => page.evaluate(() => Array.from(new Set(window.__pointerTypes)));
}

async function setup(page){
  await F.openFmIDE(page);
  return page.evaluate(() => {
    fm.clearAll();
    const a = fm.createRect({ x: 60, y: 60, name: 'Price', value: '10' });
    const b = fm.createRect({ x: 420, y: 240, name: 'Revenue', value: '0' });
    return { a, b };
  });
}

test('a finger drags a node, in one undo step, and a tap selects it', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const types = await watchPointerTypes(page);
  const f = await finger(page);
  const start = centre(await box(nodeEl(page, a).locator('.label')));
  await f.drag(start, { x: start.x + 150, y: start.y + 80 });
  const moved = await nodeOf(page, a);
  expect(Math.abs(moved.x - 210)).toBeLessThanOrEqual(12);
  expect(Math.abs(moved.y - 140)).toBeLessThanOrEqual(12);
  expect(await types()).toEqual(['touch']);
  await page.evaluate(() => fm.command('undo'));
  expect(await nodeOf(page, a)).toMatchObject({ x: 60, y: 60 });

  // A tap selects just that node; the mouse events the browser copies from it start nothing more.
  await page.evaluate(() => fm.select([]));
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  await expect.poll(() => page.evaluate(() => fm.selection())).toEqual([a]);
  expect(await nodeOf(page, a)).toMatchObject({ x: 60, y: 60 });
  expect(await page.evaluate(() => document.body.classList.contains('dragging'))).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('only the first finger acts: a second finger on another node moves nothing', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const p = centre(await box(nodeEl(page, a).locator('.label')));
  const q = centre(await box(nodeEl(page, b).locator('.label')));
  await send('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  await send('touchStart', [{ x: p.x, y: p.y, id: 1 }, { x: q.x, y: q.y, id: 2 }]);
  for(let i = 1; i <= 6; i++) await send('touchMove', [{ x: p.x + i * 15, y: p.y, id: 1 }, { x: q.x, y: q.y + i * 15, id: 2 }]);
  await send('touchEnd', []);
  expect((await nodeOf(page, a)).x).toBeGreaterThan(100);
  expect(await nodeOf(page, b)).toMatchObject({ x: 420, y: 240 });
  expect(pageErrors).toEqual([]);
});

test('a finger draws an arrow from a dot onto another node', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const types = await watchPointerTypes(page);
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label')))); // selecting shows the dots
  await f.drag(centre(await box(nodeEl(page, a).locator('.port.e'))), centre(await box(nodeEl(page, b).locator('.label'))));
  await expect.poll(() => page.evaluate(() => fm.edges().map(e => e.from + '→' + e.to))).toEqual([a + '→' + b]);
  expect(await page.locator('#svg path.temp, svg path.temp').count()).toBe(0);
  // Lifted over empty canvas: no arrow.
  await f.drag(centre(await box(nodeEl(page, b).locator('.port.s'))), { x: 700, y: 650 });
  expect(await page.evaluate(() => fm.edges().length)).toBe(1);
  expect(await types()).toEqual(['touch']);
  expect(pageErrors).toEqual([]);
});

test('a finger resizes a node by its corner', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  const before = await nodeOf(page, a);
  const corner = centre(await box(nodeEl(page, a).locator('.resize-handle')));
  await f.drag(corner, { x: corner.x + 60, y: corner.y + 30 });
  const after = await nodeOf(page, a);
  expect(Math.abs(after.w - (before.w + 60))).toBeLessThanOrEqual(2);
  expect(Math.abs(after.h - (before.h + 30))).toBeLessThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});

test('a finger drags a canvas tab to reorder the canvases', async ({ page, pageErrors }) => {
  await setup(page);
  await page.evaluate(() => { fm.renameCanvas({ canvas: '@current', name: 'One' }); fm.addCanvas({ name: 'Two' }); fm.addCanvas({ name: 'Three' }); });
  const names = () => page.evaluate(() => fm.canvases().map(c => c.name));
  expect(await names()).toEqual(['One', 'Two', 'Three']);
  const f = await finger(page);
  // By the name: the middle of a short tab can be its close ×.
  const tab = (name) => page.locator('.canvas-tab .name', { hasText: name }).first();
  const from = centre(await box(tab('One')));
  const three = await box(tab('Three'));
  await f.drag(from, { x: three.x + three.width - 4, y: from.y }, { steps: 12 });
  await expect.poll(names).toEqual(['Two', 'Three', 'One']);
  expect(pageErrors).toEqual([]);
});

test("a finger draws in the curve editor", async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  await page.evaluate(() => fm.setPeriodCount(6));
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  await f.tap(centre(await box(nodeEl(page, a).locator('.curve-btn'))));
  const dialog = page.locator('.period-values-box');
  await expect(dialog).toBeVisible();
  // The period values: the number boxes after the chart's minimum and maximum.
  const values = () => dialog.locator('input[type="number"]').evaluateAll(els => els.slice(2).map(e => Number(e.value)));
  const before = await values();
  const plot = await box(dialog.locator('svg').first());
  // Along the plot, from high on the left to low on the right.
  await f.drag({ x: plot.x + plot.width * 0.1, y: plot.y + plot.height * 0.2 }, { x: plot.x + plot.width * 0.9, y: plot.y + plot.height * 0.8 }, { steps: 16 });
  const after = await values();
  expect(after).not.toEqual(before);
  expect(after[0]).toBeGreaterThan(after[after.length - 1]);
  expect(pageErrors).toEqual([]);
});

test('one finger on empty canvas scrolls it and selects nothing', async ({ page, pageErrors }) => {
  await setup(page);
  await page.evaluate(() => fm.createRect({ x: 2400, y: 2400, name: 'Far away', value: '1' }));
  const f = await finger(page);
  const vp = await box(page.locator('#viewport'));
  const empty = { x: vp.x + vp.width - 150, y: vp.y + vp.height - 60 };
  await f.drag(empty, { x: empty.x - 200, y: empty.y - 250 }, { steps: 10 });
  await expect.poll(() => page.evaluate(() => { const v = document.getElementById('viewport'); return v.scrollTop + v.scrollLeft; })).toBeGreaterThan(0);
  expect(await page.evaluate(() => fm.selection())).toEqual([]);
  expect(await page.locator('.marquee').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

// Separate from the scroll above: a tap while a scroll is still gliding only stops the glide.
test('a tap on empty canvas clears the selection', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const f = await finger(page);
  const vp = await box(page.locator('#viewport'));
  await page.evaluate((a) => fm.select(['#' + a]), a);
  expect(await page.evaluate(() => fm.selection())).toEqual([a]);
  await f.tap({ x: vp.x + 700, y: vp.y + 120 });
  await expect.poll(() => page.evaluate(() => fm.selection())).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('a tap on a node still closes an open pop-up', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const op = await page.evaluate(() => fm.createOperator({ x: 300, y: 60, op: '+' }));
  await nodeEl(page, op).dblclick(); // the operator picker, opened with the mouse
  await expect(page.locator('.op-picker')).toBeVisible();
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  await expect(page.locator('.op-picker')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
