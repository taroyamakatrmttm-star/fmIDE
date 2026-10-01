// 41. Snap to equal spacing (step 12a): a dragged node snaps where its gaps to the nodes in its
// row (or column) are equal — after the last, before the first, or halfway between two — with
// gap markers while it snaps; the nearer of alignment and equal spacing wins (alignment on a
// tie); Alt during the drag turns snapping off. Driven with a real mouse (and one finger).
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

const node = (page, id) => page.locator(`.node[data-id="${id}"]`);
const pos = (page, id) => page.evaluate((id) => { const n = fm.nodes().find(n => n.id === id); return { x: n.x, y: n.y }; }, id);
const marks = (page) => page.locator('#gapMarks .gap-mark');

// Rectangles at the given places (170 × 64 unless w / h say otherwise); returns their ids.
async function place(page, list){
  return page.evaluate((list) => {
    fm.clearAll();
    return list.map(r => fm.createRect(Object.assign({ name: r.name, value: '1' }, r)));
  }, list);
}

// Drag node `id` so that its top left would land at canvas x, y (before any snap), with the
// mouse, pausing before letting go. `during` runs while the button is still down.
async function dragTo(page, id, x, y, { during, alt } = {}){
  const box = await node(page, id).boundingBox();
  const p = await pos(page, id);
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + (x - p.x) / 2, sy + (y - p.y) / 2, { steps: 5 });
  if(alt) await page.keyboard.down('Alt');
  await page.mouse.move(sx + (x - p.x), sy + (y - p.y), { steps: 5 });
  if(during) await during();
  await page.mouse.up();
  if(alt) await page.keyboard.up('Alt');
}

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
});

test('after the last of a row: the same gap, with two gap markers while it snaps and none after', async ({ page, pageErrors }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 400 }]);
  // A–B gap 30: C belongs at x 500. Dropped 3 pixels off (and its top 2 pixels off A's).
  await dragTo(page, c, 503, 102, { during: async () => {
    await expect(marks(page)).toHaveCount(2);
    await expect(marks(page).first()).toBeVisible();
    // The markers: A to B, and B to C, each 30 wide.
    const widths = await marks(page).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
    expect(widths).toEqual([30, 30]);
  } });
  expect(await pos(page, c)).toEqual({ x: 500, y: 100 });
  await expect(marks(page)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('before the first of a row, and halfway between two', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 400, y: 100 }, { name: 'B', x: 600, y: 100 }, { name: 'C', x: 400, y: 500 }]);
  // Before A: 400 − 30 − 170 = 200.
  await dragTo(page, c, 196, 100);
  expect((await pos(page, c)).x).toBe(200);
  // Halfway: A at 100, B at 500, gap 230: C at 270 + 30 = 300, 30 either side.
  const [, , c2] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 500, y: 100 }, { name: 'C', x: 300, y: 500 }]);
  await dragTo(page, c2, 304, 100, { during: async () => {
    const widths = await marks(page).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
    expect(widths).toEqual([30, 30]);
  } });
  expect((await pos(page, c2)).x).toBe(300);
});

test('vertically, in a column: below the last with the same gap', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 100, y: 200 }, { name: 'C', x: 500, y: 500 }]);
  // A–B gap 36 (64 high): C belongs at y 300.
  await dragTo(page, c, 101, 297, { during: async () => {
    const heights = await marks(page).evaluateAll(els => els.map(e => e.classList.contains('gap-mark-v') ? Math.round(e.getBoundingClientRect().height) : -1));
    expect(heights).toEqual([36, 36]);
  } });
  expect(await pos(page, c)).toEqual({ x: 100, y: 300 });
});

test('different sizes: equal gaps between edges, not equal centres; a run of three extended', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100, w: 100 }, { name: 'B', x: 230, y: 100, w: 250 }, { name: 'C', x: 600, y: 500 }]);
  // A ends at 200, B starts at 230 (gap 30) and ends at 480: C at 510.
  await dragTo(page, c, 513, 100);
  expect((await pos(page, c)).x).toBe(510);
  const ids = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'D', x: 500, y: 100 }, { name: 'C', x: 300, y: 500 }]);
  await dragTo(page, ids[3], 696, 100);
  expect((await pos(page, ids[3])).x).toBe(700);
});

test('nodes outside the row are not counted', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 500 }]);
  // At y 400 C shares no height with A and B: no snap to x 500.
  await dragTo(page, c, 503, 400);
  expect(await pos(page, c)).toEqual({ x: 503, y: 400 });
  await expect(marks(page)).toHaveCount(0);
});

test('alignment and equal spacing in one direction: the nearer wins, alignment on a tie; both directions at once', async ({ page }) => {
  // Equal spacing puts C at x 500; E (in another row) has its left edge at 504.
  const setup = () => place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'E', x: 504, y: 400 }, { name: 'C', x: 800, y: 600 }]);
  let ids = await setup();
  await dragTo(page, ids[3], 501, 100); // 1 from equal spacing, 3 from E
  expect((await pos(page, ids[3])).x).toBe(500);
  ids = await setup();
  await dragTo(page, ids[3], 503, 100); // 3 from equal spacing, 1 from E
  expect((await pos(page, ids[3])).x).toBe(504);
  await expect(page.locator('#guideV')).toHaveCount(1);
  ids = await setup();
  await dragTo(page, ids[3], 502, 100); // 2 from each: alignment
  expect((await pos(page, ids[3])).x).toBe(504);
  // Equal spacing across and lining up down at once: C snaps to x 500 and to A's top.
  ids = await setup();
  await dragTo(page, ids[3], 499, 104);
  expect(await pos(page, ids[3])).toEqual({ x: 500, y: 100 });
});

test('a selection moves together, the grabbed node deciding', async ({ page }) => {
  const [a, b, c, d] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 500 }, { name: 'D', x: 600, y: 650 }]);
  await page.evaluate((ids) => fm.select(ids.map(i => '#' + i)), [c, d]);
  await dragTo(page, c, 503, 101);
  expect(await pos(page, c)).toEqual({ x: 500, y: 100 });
  expect(await pos(page, d)).toEqual({ x: 500, y: 250 });
});

test('Alt+drag makes an alias that snaps; Alt held during a plain drag turns snapping off', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 500 }]);
  // Alt before pressing: an alias of C, snapping like any drag.
  const box = await node(page, c).boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2 - 200, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 - 97, box.y + box.height / 2 - 399, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const alias = await page.evaluate(() => fm.nodes().find(n => n.type === 'alias'));
  expect({ x: alias.x, y: alias.y }).toEqual({ x: 500, y: 100 });
  expect(await pos(page, c)).toEqual({ x: 600, y: 500 });
  // Alt pressed after the drag started: no snap at all, so C lands where it was dropped.
  await page.evaluate((id) => { fm.select(['#' + id]); fm.deleteSelected(); }, alias.id);
  await dragTo(page, c, 503, 102, { alt: true });
  expect(await pos(page, c)).toEqual({ x: 503, y: 102 });
});

test('the move is one undo step, and the macro recorder records it at its snapped place', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 500 }]);
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await dragTo(page, c, 503, 102);
  await page.evaluate(() => fm.command('toggleRecord'));
  expect(await pos(page, c)).toEqual({ x: 500, y: 100 });
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  expect(macro.steps.map(s => [s.action, s.args.dx, s.args.dy])).toEqual([['move', -100, -400]]);
  // Saved where it snapped.
  const saved = data.system.canvases.find(cv => cv.id === data.system.activeCanvasId).nodes.find(n => n.id === c);
  expect({ x: saved.x, y: saved.y }).toEqual({ x: 500, y: 100 });
  await page.evaluate(() => fm.command('undo'));
  expect(await pos(page, c)).toEqual({ x: 600, y: 500 });
});

test('a large canvas still drags quickly', async ({ page }) => {
  // 400 rectangles in 20 rows, then one dragged across them in 30 moves. (Most of the time is
  // redrawing the canvas on each move; the snap itself works from boxes made once per drag.)
  const id = await page.evaluate(() => {
    fm.clearAll();
    for(let k = 0; k < 2; k++){
      const items = [];
      for(let i = 0; i < 200; i++) items.push({ name: 'R' + (k * 200 + i) });
      fm.createRects({ items, layout: 'grid', across: 20, gap: 30, x: 0, y: 200 + k * 940 });
    }
    return fm.createRect({ name: 'Mover', x: 50, y: 20 });
  });
  const box = await node(page, id).boundingBox();
  const t0 = Date.now();
  await page.mouse.move(box.x + 80, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 680, box.y + 330, { steps: 30 });
  await page.mouse.up();
  const ms = Date.now() - t0;
  expect(ms).toBeLessThan(15000);
  expect((await pos(page, id)).x).toBeGreaterThan(400);
});

test.describe('by touch', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  test('a finger drag snaps to equal spacing', async ({ page }) => {
    const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 400 }]);
    await page.evaluate(() => { window.__types = []; window.addEventListener('pointerdown', (ev) => window.__types.push(ev.pointerType), true); });
    const box = await node(page, c).boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
    await send('touchStart', [{ x: sx, y: sy }]);
    for(let i = 1; i <= 10; i++) await send('touchMove', [{ x: sx - 97 * i / 10, y: sy - 299 * i / 10 }]);
    await send('touchEnd', []);
    expect(await pos(page, c)).toEqual({ x: 500, y: 100 });
    expect(await page.evaluate(() => Array.from(new Set(window.__types || [])))).toEqual(['touch']);
  });
});
