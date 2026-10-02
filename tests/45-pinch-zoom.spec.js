// 45. Pinch to zoom (step 13, phase 13b): on a tablet, two fingers on the canvas zoom it around
// the point between them, and moving them together moves the canvas. A drag the first finger had
// begun is cancelled and undone (no undo step); a pinch ending within 5% of 100% settles at 100%;
// the limits are 25% and 200%; one finger scrolls and drags as before; each canvas keeps its own
// zoom (the person's own UI setting); a macro never records it. Real touch input through the
// Chrome DevTools Protocol at 1024 × 768, as group 27; each test checks the page saw touch.
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');
const { finger, twoFingers, watchPointerTypes } = require('./helpers/touch');

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

const node = (page, id) => page.locator(`.node[data-id="${id}"]`);
const pos = (page, id) => page.evaluate((id) => { const n = fm.nodes().find(n => n.id === id); return { x: n.x, y: n.y }; }, id);
const zoomOf = (page) => page.evaluate(() => fm.zoom());
const level = (page) => page.locator('#zoomControl .zoom-level');
const scrollOf = (page) => page.locator('#viewport').evaluate(v => ({ x: v.scrollLeft, y: v.scrollTop }));
async function place(page, list){
  return page.evaluate((list) => { fm.clearAll(); return list.map(r => fm.createRect(Object.assign({ name: r.name, value: '1' }, r))); }, list);
}
async function centre(page, id){ const b = await node(page, id).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function savedUi(page){
  const text = (await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1'))['fmIDE-workspace-v1'];
  return text ? (JSON.parse(text).ui || {}) : {};
}
// Empty canvas around a point: the viewport's middle, left and right of it.
async function viewMiddle(page){
  const b = await page.locator('#viewport').boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

let types;
test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  types = await watchPointerTypes(page);
});
test.afterEach(async () => {
  expect(await types()).toEqual(['touch']); // fingers only, no mouse
});

test('pinching out zooms in around the point between the fingers; pinching in zooms out', async ({ page, pageErrors }) => {
  const [a] = await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700));
  const c = await centre(page, a);
  // The fingers either side of the node, on empty canvas, 200 pixels apart, then 300.
  const hand = await twoFingers(page);
  await hand.down({ x: c.x - 100, y: c.y + 60 }, { x: c.x + 100, y: c.y + 60 });
  await hand.pinch({ x: c.x - 150, y: c.y + 60 }, { x: c.x + 150, y: c.y + 60 });
  await hand.up();
  await expect.poll(() => zoomOf(page)).toBeCloseTo(1.5, 2);
  await expect(level(page)).toHaveText('150%');
  // The point between the fingers stayed under them: the node is in the same place, larger.
  const after = await centre(page, a);
  expect(Math.abs(after.x - c.x)).toBeLessThan(3);
  expect(Math.abs(after.y - (c.y + 60) - (-60 * 1.5))).toBeLessThan(3);
  // Pinching in.
  const c2 = await centre(page, a);
  await hand.down({ x: c2.x - 150, y: c2.y }, { x: c2.x + 150, y: c2.y });
  await hand.pinch({ x: c2.x - 50, y: c2.y }, { x: c2.x + 50, y: c2.y });
  await hand.up();
  await expect.poll(() => zoomOf(page)).toBeCloseTo(0.5, 2);
  const c3 = await centre(page, a);
  expect(Math.abs(c3.x - c2.x)).toBeLessThan(3);
  expect(Math.abs(c3.y - c2.y)).toBeLessThan(3);
  // Nothing in the model changed, and nothing to undo.
  expect(await pos(page, a)).toEqual({ x: 1500, y: 1000 });
  expect(pageErrors).toEqual([]);
});

test('moving two fingers together moves the canvas; the limits are 25% and 200%', async ({ page }) => {
  await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700));
  const m = await viewMiddle(page);
  const hand = await twoFingers(page);
  const before = await scrollOf(page);
  await hand.down({ x: m.x - 80, y: m.y }, { x: m.x + 80, y: m.y });
  await hand.pinch({ x: m.x - 80 - 120, y: m.y - 90 }, { x: m.x + 80 - 120, y: m.y - 90 });
  await hand.up();
  const after = await scrollOf(page);
  expect(Math.abs(after.x - (before.x + 120))).toBeLessThan(3);
  expect(Math.abs(after.y - (before.y + 90))).toBeLessThan(3);
  expect(await zoomOf(page)).toBe(1);
  // Far apart: 200% at most. Close together: 25% at least.
  await hand.down({ x: m.x - 40, y: m.y }, { x: m.x + 40, y: m.y });
  await hand.pinch({ x: m.x - 400, y: m.y }, { x: m.x + 400, y: m.y });
  await hand.up();
  await expect(level(page)).toHaveText('200%');
  await hand.down({ x: m.x - 400, y: m.y }, { x: m.x + 400, y: m.y });
  await hand.pinch({ x: m.x - 10, y: m.y }, { x: m.x + 10, y: m.y });
  await hand.up();
  await expect(level(page)).toHaveText('25%');
});

test('a pinch ending within 5% of 100% settles at 100%; further away it stays', async ({ page }) => {
  await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700));
  const m = await viewMiddle(page);
  const hand = await twoFingers(page);
  await hand.down({ x: m.x - 100, y: m.y }, { x: m.x + 100, y: m.y });
  await hand.pinch({ x: m.x - 104, y: m.y }, { x: m.x + 104, y: m.y }); // 104%
  await hand.up();
  await expect(level(page)).toHaveText('100%');
  await expect(page.locator('#viewport')).not.toHaveClass(/\bzoomed\b/);
  await hand.down({ x: m.x - 100, y: m.y }, { x: m.x + 100, y: m.y });
  await hand.pinch({ x: m.x - 90, y: m.y }, { x: m.x + 90, y: m.y }); // 90%
  await hand.up();
  await expect(level(page)).toHaveText('90%');
});

test('the first finger already scrolling when the second lands: the pinch still zooms around the fingers', async ({ page, pageErrors }) => {
  const [a] = await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700));
  const m = await viewMiddle(page);
  const hand = await twoFingers(page);
  await hand.first({ x: m.x - 100, y: m.y + 100 });
  for(let i = 1; i <= 6; i++) await hand.moveFirst({ x: m.x - 100, y: m.y + 100 - 10 * i }); // scrolling
  await hand.second({ x: m.x + 100, y: m.y + 40 });
  await hand.pinch({ x: m.x - 200, y: m.y + 40 }, { x: m.x + 200, y: m.y + 40 });
  await hand.up();
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(1.5);
  expect(await pos(page, a)).toEqual({ x: 1500, y: 1000 });
  expect(pageErrors).toEqual([]);
});

test('a second finger cancels the first finger\'s drag: the node goes back, no undo step; then it pinches', async ({ page }) => {
  const [a, b] = await place(page, [{ name: 'A', x: 1500, y: 1000 }, { name: 'B', x: 1500, y: 1200 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700));
  const c = await centre(page, a);
  const hand = await twoFingers(page);
  await hand.first(c);
  for(let i = 1; i <= 6; i++) await hand.moveFirst({ x: c.x + 15 * i, y: c.y + 10 * i });
  await expect.poll(() => pos(page, a)).toEqual({ x: 1590, y: 1060 }); // the drag began
  await hand.second({ x: c.x + 90 + 200, y: c.y + 60 });
  await expect.poll(() => pos(page, a)).toEqual({ x: 1500, y: 1000 }); // and is undone
  await expect(page.locator('body')).not.toHaveClass(/\bdragging\b/);
  await hand.pinch({ x: c.x + 90 - 100, y: c.y + 60 }, { x: c.x + 90 + 400, y: c.y + 60 }); // 200 → 500 apart
  await hand.up();
  await expect(level(page)).toHaveText('200%'); // 250%, at most 200%
  expect(await pos(page, a)).toEqual({ x: 1500, y: 1000 });
  // The last undo step is still adding B (the drag left none).
  await page.evaluate(() => fm.command('undo'));
  expect(await page.evaluate((b) => fm.nodes().some(n => n.id === b), b)).toBe(false);
  expect(await pos(page, a)).toEqual({ x: 1500, y: 1000 });
});

test('one finger as before: it drags a node (by what it moved, at any zoom) and scrolls empty canvas', async ({ page }) => {
  const [a] = await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => { fm.setZoom(0.5); document.getElementById('viewport').scrollTo(500, 350); });
  const c = await centre(page, a);
  const hand = await twoFingers(page);
  await hand.first(c);
  for(let i = 1; i <= 5; i++) await hand.moveFirst({ x: c.x + 10 * i, y: c.y + 6 * i });
  await hand.up();
  await expect.poll(() => pos(page, a)).toEqual({ x: 1600, y: 1060 }); // 50, 30 on the screen at 50%
  expect(await zoomOf(page)).toBe(0.5);
  // A finger on empty canvas scrolls it; the zoom stays.
  const m = await viewMiddle(page);
  const before = await scrollOf(page);
  await hand.first({ x: m.x + 200, y: m.y + 150 });
  for(let i = 1; i <= 8; i++) await hand.moveFirst({ x: m.x + 200 - 20 * i, y: m.y + 150 - 15 * i });
  await hand.up();
  await expect.poll(() => scrollOf(page).then(s => s.x + s.y)).toBeGreaterThan(before.x + before.y + 50);
  expect(await zoomOf(page)).toBe(0.5);
});

test('each canvas keeps the zoom pinched to, in the person\'s own settings; a macro never records it', async ({ page }) => {
  await place(page, [{ name: 'A', x: 300, y: 300 }]);
  const first = await page.evaluate(() => fm.canvases()[0].id);
  // Recording a macro while pinching: nothing recorded but the rectangle added.
  await page.evaluate(() => fm.command('toggleRecord'));
  await (await finger(page)).tap(await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).boundingBox().then(b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })));
  const m = await viewMiddle(page);
  const hand = await twoFingers(page);
  await hand.down({ x: m.x - 100, y: m.y }, { x: m.x + 100, y: m.y });
  await hand.pinch({ x: m.x - 50, y: m.y }, { x: m.x + 50, y: m.y });
  await hand.up();
  await expect(level(page)).toHaveText('50%');
  await page.evaluate(() => { fm.createRect({ name: 'R', x: 50, y: 50 }); fm.command('toggleRecord'); });
  const exported = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = exported.data.macros[exported.data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['createRect']);
  expect(JSON.stringify(exported.data.system)).not.toMatch(/zoom/i);
  await expect.poll(() => savedUi(page).then(ui => ui.canvasZoom && ui.canvasZoom[first]), { timeout: 5000 }).toBe(0.5);
  // Another canvas starts at 100%; back on the first, 50%.
  await page.evaluate(() => fm.command('newCanvas'));
  await expect(level(page)).toHaveText('100%');
  await page.locator('.canvas-tab').first().evaluate(t => t.click());
  await expect(level(page)).toHaveText('50%');
});

test('two fingers elsewhere — one on the ribbon — don\'t zoom the canvas', async ({ page }) => {
  const m = await viewMiddle(page);
  const rb = await page.locator('#ribbon, .ribbon').first().boundingBox();
  const hand = await twoFingers(page);
  await hand.down({ x: rb.x + 300, y: rb.y + rb.height / 2 }, { x: m.x, y: m.y });
  await hand.pinch({ x: rb.x + 200, y: rb.y + rb.height / 2 }, { x: m.x + 200, y: m.y + 100 });
  await hand.up();
  expect(await zoomOf(page)).toBe(1);
});
