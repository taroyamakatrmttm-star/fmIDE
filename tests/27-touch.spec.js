// 27. Touch — fmIDE's canvas by finger (step 9a: one input path; step 9b: press and hold,
// double-tap, larger touch areas; step 9c: the screen — the viewport line, the ribbon, dialogs,
// the on-screen keyboard; ExcelExporter's Tree view is group 30). Chromium with a touchscreen
// at tablet size; the touches are real touch input sent through the Chrome DevTools Protocol
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
    // Two taps in the same place, quickly (a double-tap).
    async doubleTap(p){ await send('touchStart', [p]); await send('touchEnd', []); await send('touchStart', [p]); await send('touchEnd', []); },
    // Press and hold, still, past the hold time (0.5 s); then lift, or drag to `to` first.
    async hold(p, { to = null, steps = 8 } = {}){
      await send('touchStart', [p]);
      await page.waitForTimeout(700);
      if(to) for(let i = 1; i <= steps; i++){
        const t = i / steps;
        await send('touchMove', [{ x: p.x + (to.x - p.x) * t, y: p.y + (to.y - p.y) * t }]);
      }
      await send('touchEnd', []);
    },
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

// Since step 13b two fingers on the canvas pinch it (group 45): neither node moves; the canvas zooms.
test('two fingers on two nodes move neither: they pinch the canvas instead', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const p = centre(await box(nodeEl(page, a).locator('.label')));
  const q = centre(await box(nodeEl(page, b).locator('.label')));
  await send('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  await send('touchStart', [{ x: p.x, y: p.y, id: 1 }, { x: q.x, y: q.y, id: 2 }]);
  for(let i = 1; i <= 6; i++) await send('touchMove', [{ x: p.x + i * 15, y: p.y, id: 1 }, { x: q.x, y: q.y + i * 15, id: 2 }]);
  await send('touchEnd', []);
  expect(await nodeOf(page, a)).toMatchObject({ x: 60, y: 60 });
  expect(await nodeOf(page, b)).toMatchObject({ x: 420, y: 240 });
  expect(await page.evaluate(() => fm.zoom())).not.toBe(1);
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

// Changed in 9b: a tab moves after a press and hold (a quick swipe scrolls the strip, below).
test('a finger holds a canvas tab, then drags it to reorder the canvases', async ({ page, pageErrors }) => {
  await setup(page);
  await page.evaluate(() => { fm.renameCanvas({ canvas: '@current', name: 'One' }); fm.addCanvas({ name: 'Two' }); fm.addCanvas({ name: 'Three' }); });
  const names = () => page.evaluate(() => fm.canvases().map(c => c.name));
  expect(await names()).toEqual(['One', 'Two', 'Three']);
  const f = await finger(page);
  // By the name: the middle of a short tab can be its close ×.
  const tab = (name) => page.locator('.canvas-tab .name', { hasText: name }).first();
  const from = centre(await box(tab('One')));
  const three = await box(tab('Three'));
  await f.hold(from, { to: { x: three.x + three.width - 4, y: from.y }, steps: 12 });
  await expect.poll(names).toEqual(['Two', 'Three', 'One']);
  expect(pageErrors).toEqual([]);
});

test('a quick swipe over the canvas tabs scrolls the strip and moves no tab', async ({ page, pageErrors }) => {
  await setup(page);
  await page.evaluate(() => { for(let i = 2; i <= 14; i++) fm.addCanvas({ name: 'Canvas number ' + i }); });
  const before = await page.evaluate(() => fm.canvases().map(c => c.name));
  const strip = page.locator('#canvasTabs');
  expect(await strip.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await strip.evaluate(el => { el.scrollLeft = 0; });
  const f = await finger(page);
  const first = centre(await box(page.locator('.canvas-tab .name').nth(2)));
  await f.drag(first, { x: first.x - 300, y: first.y }, { steps: 10 });
  await expect.poll(() => strip.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(before);
  expect(await page.locator('.canvas-tab.tab-dragging, .canvas-tab.tab-lifted').count()).toBe(0);
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

// ---------- step 9b: press and hold, double-tap, larger touch areas ----------
const menu = (page) => page.locator('.touch-menu');
const menuItem = (page, name) => menu(page).locator('button', { hasText: name });
async function holdNode(page, f, id){ await f.hold(centre(await box(nodeEl(page, id).locator('.label, .opsym').first()))); await expect(menu(page)).toBeVisible(); }

test('holding a node opens its menu and leaves the selection alone; Escape or a tap elsewhere closes it', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const types = await watchPointerTypes(page);
  await page.evaluate((a) => fm.select(['#' + a]), a);
  const f = await finger(page);
  await holdNode(page, f, b);
  expect(await page.evaluate(() => fm.selection())).toEqual([a]);
  expect(await menu(page).locator('button').allTextContents()).toEqual(['Draw arrow from here', 'Make alias', 'Duplicate', 'Add to selection', 'Edit…', 'Properties…', 'Copy reference', 'Help', 'Delete']);
  // Holding moved nothing.
  expect(await nodeOf(page, b)).toMatchObject({ x: 420, y: 240 });
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await holdNode(page, f, b);
  const vp = await box(page.locator('#viewport'));
  await f.tap({ x: vp.x + 700, y: vp.y + 120 });
  await expect(menu(page)).toHaveCount(0);
  expect(await types()).toEqual(['touch']);
  expect(pageErrors).toEqual([]);
});

test('the menu adds a node to the selection and removes it again, and then acts on the whole selection', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  await page.evaluate((a) => fm.select(['#' + a]), a);
  const f = await finger(page);
  await holdNode(page, f, b);
  await menuItem(page, 'Add to selection').tap();
  await expect.poll(() => page.evaluate(() => fm.selection().slice().sort())).toEqual([a, b].sort());
  await holdNode(page, f, b);
  expect(await menu(page).locator('button').allTextContents()).toContain('Duplicate selection');
  await menuItem(page, 'Remove from selection').tap();
  await expect.poll(() => page.evaluate(() => fm.selection())).toEqual([a]);
  expect(pageErrors).toEqual([]);
});

test('the menu draws an arrow: "Draw arrow from here", then a tap on the target', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const f = await finger(page);
  await holdNode(page, f, a);
  await menuItem(page, 'Draw arrow from here').tap();
  await expect(page.locator('#tapArrowBanner')).toBeVisible();
  await expect(nodeEl(page, a)).toHaveClass(/arrow-source/);
  await f.tap(centre(await box(nodeEl(page, b).locator('.label'))));
  await expect.poll(() => page.evaluate(() => fm.edges().map(e => e.from + '→' + e.to))).toEqual([a + '→' + b]);
  await expect(page.locator('#tapArrowBanner')).toHaveCount(0);
  await expect(nodeEl(page, a)).not.toHaveClass(/arrow-source/);
  expect(await page.evaluate(() => fm.selection())).toEqual([]); // the tap didn't select the target
  // A tap on empty canvas cancels; so does the banner's Cancel.
  await holdNode(page, f, b);
  await menuItem(page, 'Draw arrow from here').tap();
  const vp = await box(page.locator('#viewport'));
  await f.tap({ x: vp.x + 700, y: vp.y + 500 });
  await expect(page.locator('#tapArrowBanner')).toHaveCount(0);
  await holdNode(page, f, b);
  await menuItem(page, 'Draw arrow from here').tap();
  await page.locator('#tapArrowBanner button', { hasText: 'Cancel' }).tap();
  await expect(page.locator('#tapArrowBanner')).toHaveCount(0);
  expect(await page.evaluate(() => fm.edges().length)).toBe(1);
  expect(pageErrors).toEqual([]);
});

test('a menu item chosen straight after a tap that cancelled the arrow still counts', async ({ page, pageErrors }) => {
  // The cancelling tap's own click is dropped, and only that one: a quick hold (0.55 s) and a
  // menu choice within 0.8 s of it used to be lost, and the banner never came.
  const { b } = await setup(page);
  const f = await finger(page);
  await holdNode(page, f, b);
  await menuItem(page, 'Draw arrow from here').tap();
  const vp = await box(page.locator('#viewport'));
  await f.tap({ x: vp.x + 700, y: vp.y + 500 });
  await expect(page.locator('#tapArrowBanner')).toHaveCount(0);
  const p = centre(await box(nodeEl(page, b).locator('.label, .opsym').first()));
  const cdp = await page.context().newCDPSession(page);
  const started = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await page.waitForTimeout(550);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(menu(page)).toBeVisible();
  await menuItem(page, 'Draw arrow from here').tap();
  expect(Date.now() - started).toBeLessThan(800);
  await expect(page.locator('#tapArrowBanner')).toBeVisible();
  await page.locator('#tapArrowBanner button', { hasText: 'Cancel' }).tap();
  await expect(page.locator('#tapArrowBanner')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("an arrow by taps onto one of an if's named input dots", async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const op = await page.evaluate(() => fm.createOperator({ x: 420, y: 60, op: 'if' }));
  const f = await finger(page);
  await holdNode(page, f, a);
  await menuItem(page, 'Draw arrow from here').tap();
  await f.tap(centre(await box(nodeEl(page, op).locator('.io-port').nth(1))));
  await expect.poll(() => page.evaluate(() => fm.edges().map(e => e.to + ':' + e.toPort))).toEqual([op + ':1']);
  expect(pageErrors).toEqual([]);
});

test('Make alias, Duplicate and Delete from the menu: one undo step each, recorded in a macro', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const f = await finger(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();

  await holdNode(page, f, a);
  await menuItem(page, 'Make alias').tap();
  await expect.poll(() => page.evaluate(() => fm.nodes().filter(n => n.type === 'alias').length)).toBe(1);
  const alias = await page.evaluate(() => fm.nodes().find(n => n.type === 'alias'));
  expect(alias.name).toBe('Price'); // an alias of Price
  expect(await page.evaluate(() => fm.selection())).toEqual([alias.id]);

  await holdNode(page, f, b);
  await menuItem(page, 'Duplicate').tap();
  await expect.poll(() => page.evaluate(() => fm.nodes().filter(n => n.type === 'value').length)).toBe(3);

  // The copy goes to free space next to b (not on top of it), so b is held by its middle,
  // with nothing selected.
  await page.evaluate(() => fm.select([]));
  await holdNode(page, f, b);
  await menuItem(page, 'Delete').tap();
  await expect.poll(() => page.evaluate((b) => fm.nodes().some(n => n.id === b), b)).toBe(false);

  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  // (the select is the test's own, clearing the selection above)
  expect(macro.steps.map(s => s.action)).toEqual(['aliasOf', 'duplicate', 'select', 'deleteNodes']);

  // Each was one undo step.
  await page.evaluate(() => fm.command('undo'));
  expect(await page.evaluate((b) => fm.nodes().some(n => n.id === b), b)).toBe(true);
  await page.evaluate(() => fm.command('undo'));
  expect(await page.evaluate(() => fm.nodes().filter(n => n.type === 'value').length)).toBe(2);
  await page.evaluate(() => fm.command('undo'));
  expect(await page.evaluate(() => fm.nodes().filter(n => n.type === 'alias').length)).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('Make alias is offered only for plain rectangles; Edit and Properties do what the double-click and 🎨 do', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const op = await page.evaluate(() => fm.createOperator({ x: 300, y: 400, op: '+' }));
  const f = await finger(page);
  await holdNode(page, f, op);
  await expect(menuItem(page, 'Make alias')).toBeDisabled();
  expect(await menu(page).locator('button').allTextContents()).not.toContain('Properties…');
  await menuItem(page, 'Edit…').tap();
  await expect(page.locator('.op-picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const p = document.querySelector('.op-picker'); if(p) p.remove(); });

  await holdNode(page, f, a);
  await menuItem(page, 'Edit…').tap();
  await expect(nodeEl(page, a).locator('textarea')).toBeFocused();
  await page.keyboard.press('Escape');
  await holdNode(page, f, a);
  await menuItem(page, 'Properties…').tap();
  await expect(page.locator('.modal-box')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('the menu shows what hover would: an error message, and the plugs feeding a socket, as plain text', async ({ page, pageErrors }) => {
  await F.openFmIDE(page);
  const ids = await page.evaluate(() => {
    fm.clearAll();
    // 1 ÷ 0: a calculation error.
    const n1 = fm.createRect({ x: 60, y: 400, name: 'N', value: '1' });
    const z = fm.createRect({ x: 60, y: 500, name: 'Z', value: '0' });
    const divide = fm.createOperator({ x: 400, y: 450, op: '÷' });
    fm.connect('#' + n1, '#' + divide);
    fm.connect('#' + z, '#' + divide);
    const one = fm.createRect({ x: 60, y: 60, name: '<b>One</b>', value: '1' });
    const two = fm.createRect({ x: 60, y: 160, name: '<i>Two</i>', value: '2' });
    fm.setPlug('#' + one, '<b>x</b>');
    fm.setPlug('#' + two, '<b>x</b>');
    const sum = fm.createOperator({ x: 400, y: 100, op: '+' });
    fm.setSocket('#' + sum, '<b>x</b>');
    fm.evaluate();
    return { divide, sum };
  });
  const f = await finger(page);
  await holdNode(page, f, ids.sum);
  const info = menu(page).locator('.touch-menu-info');
  await expect(info.first()).toContainText('Fed by 2 plugs, added together');
  await expect(info.first()).toContainText('<b>One</b>');
  await expect(info.first()).toContainText('<i>Two</i>');
  expect(await menu(page).locator('b, i').count()).toBe(0);
  await page.keyboard.press('Escape');
  await holdNode(page, f, ids.divide);
  await expect(menu(page).locator('.touch-menu-info')).toContainText('divide by zero');
  expect(pageErrors).toEqual([]);
});

test('holding on empty canvas, then dragging, selects with a box and does not scroll', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const c = await page.evaluate(() => fm.createRect({ x: 900, y: 600, name: 'Outside', value: '1' }));
  await page.evaluate((c) => fm.select(['#' + c]), c);
  const f = await finger(page);
  const canvasBox = await box(page.locator('#canvas'));
  const at = (x, y) => ({ x: canvasBox.x + x, y: canvasBox.y + y });
  const scroll = () => page.evaluate(() => { const v = document.getElementById('viewport'); return v.scrollTop + v.scrollLeft; });
  const scrolledBefore = await scroll();
  await f.hold(at(30, 30), { to: at(700, 420), steps: 12 });
  await expect.poll(() => page.evaluate(() => fm.selection().slice().sort())).toEqual([a, b].sort());
  expect(await scroll()).toBe(scrolledBefore);
  expect(await page.locator('.marquee').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('double-tap does what a double-click does, once: edit a rectangle, the operator picker, rename a tab', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const op = await page.evaluate(() => fm.createOperator({ x: 300, y: 400, op: '+' }));
  const f = await finger(page);
  await page.evaluate(() => { window.__dbl = 0; document.addEventListener('dblclick', () => window.__dbl++); });
  await f.doubleTap(centre(await box(nodeEl(page, a).locator('.label'))));
  await expect(nodeEl(page, a).locator('textarea')).toBeFocused();
  await page.keyboard.press('Escape');
  await f.doubleTap(centre(await box(nodeEl(page, op).locator('.opsym'))));
  await expect(page.locator('.op-picker')).toHaveCount(1);
  expect(await page.evaluate(() => window.__dbl)).toBe(2);
  await page.evaluate(() => { const p = document.querySelector('.op-picker'); if(p) p.remove(); });
  await f.doubleTap(centre(await box(page.locator('.canvas-tab .name').first())));
  await expect(page.locator('.canvas-tab input.rename-input')).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test('two taps far apart, or slowly, are not a double-tap', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  await f.tap(centre(await box(nodeEl(page, b).locator('.label'))));
  const p = centre(await box(nodeEl(page, a).locator('.label')));
  await f.tap(p);
  await page.waitForTimeout(600);
  await f.tap(p);
  await page.waitForTimeout(100);
  expect(await page.locator('.node textarea').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('larger touch areas: a finger just off a dot or the resize corner still hits it; the mouse gets none', async ({ page, pageErrors }) => {
  const { a, b } = await setup(page);
  const f = await finger(page);
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  await expect(page.locator('body')).toHaveClass(/touch-input/);
  // 9 pixels outside the east dot's edge: an arrow.
  const dot = await box(nodeEl(page, a).locator('.port.e'));
  await f.drag({ x: dot.x + dot.width + 9, y: dot.y + dot.height / 2 }, centre(await box(nodeEl(page, b).locator('.label'))));
  await expect.poll(() => page.evaluate(() => fm.edges().map(e => e.from + '→' + e.to))).toEqual([a + '→' + b]);
  // 12 pixels up and left of the resize corner, inside the node: a resize, not a move.
  await f.tap(centre(await box(nodeEl(page, a).locator('.label'))));
  const before = await nodeOf(page, a);
  const corner = await box(nodeEl(page, a).locator('.resize-handle'));
  const p = { x: corner.x - 12, y: corner.y - 12 };
  await f.drag(p, { x: p.x + 50, y: p.y + 20 });
  const after = await nodeOf(page, a);
  expect(after).toMatchObject({ x: before.x, y: before.y });
  expect(after.w).toBeGreaterThan(before.w + 30);
  // A mouse (on a screen whose main pointer is fine) takes the larger areas away again.
  if(!(await page.evaluate(() => matchMedia('(pointer: coarse)').matches))){
    await page.mouse.move(5, 5);
    await page.mouse.move(8, 8);
    await expect(page.locator('body')).not.toHaveClass(/touch-input/);
  }
  expect(pageErrors).toEqual([]);
});

test('a finger scrolls the text of a node being edited', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  await page.evaluate((a) => fm.setText('#' + a, Array.from({ length: 30 }, (_, i) => 'Line ' + i).join('\n')), a);
  const f = await finger(page);
  await f.doubleTap(centre(await box(nodeEl(page, a))));
  const ta = nodeEl(page, a).locator('textarea');
  await expect(ta).toBeFocused();
  await ta.evaluate(el => { el.scrollTop = 0; });
  expect(await ta.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const c = centre(await box(ta));
  await f.drag({ x: c.x, y: c.y + 15 }, { x: c.x, y: c.y - 25 }, { steps: 8 });
  await expect.poll(() => ta.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

// ---------- Step 9c: the screen ----------

// The commands that open a dialog (or the Command Launcher); each must fit on a tablet's screen.
const DIALOG_COMMANDS = ['managePeriods', 'openTemplates', 'openFunctions', 'openFormats', 'openShortcuts',
  'customizeRibbon', 'openMacros', 'openLauncher', 'browseLibrary', 'openRecent', 'insertFunction', 'addBlock', 'addAlias'];
const DIALOGS = '.modal-box, .launcher';

test.describe('9c: the viewport line, on a tablet', () => {
  test.use({ isMobile: true, viewport: { width: 768, height: 1024 } });
  for(const app of ['fmIDE', 'ExcelExporter']){
    test(`${app} is laid out at the tablet's own width, not shrunk from a desktop one`, async ({ page, pageErrors }) => {
      const { openApp } = require('./helpers/apps');
      await openApp(page, app);
      const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(meta).toContain('width=device-width');
      expect(meta).toContain('initial-scale=1');
      expect(meta).toContain('interactive-widget=resizes-content');
      expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth])).toEqual([768, 768]);
      expect(pageErrors).toEqual([]);
    });
  }
});

test('9c: a double-tap is fmIDE\'s own, never the browser\'s zoom; two fingers on the canvas don\'t zoom the page', async ({ page, pageErrors }) => {
  const { a } = await setup(page);
  const touchAction = (sel) => page.locator(sel).first().evaluate(el => getComputedStyle(el).touchAction);
  expect(await touchAction('body')).toBe('manipulation');
  expect(await touchAction('#ribbon .rb-btn')).toBe('manipulation');
  expect(await touchAction('#viewport')).toBe('pan-x pan-y');
  // What 9a and 9b set stays.
  expect(await touchAction(`.node[data-id="${a}"]`)).toBe('none');
  expect(await touchAction('.canvas-tab')).toBe('pan-x');
  expect(pageErrors).toEqual([]);
});

test('9c: a text box a finger types in has 16px text, so the browser doesn\'t zoom in on it', async ({ page, pageErrors }) => {
  await setup(page);
  await page.evaluate(() => fm.command('managePeriods'));
  const input = page.locator('.modal-box input[type=text]').first();
  await expect(input).toBeVisible();
  expect(await input.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  expect(pageErrors).toEqual([]);
});

test('9c: arrows at the ends of the ribbon show there is more, and a tap scrolls it; every button can be reached', async ({ page, pageErrors }) => {
  await setup(page);
  const types = await watchPointerTypes(page);
  const f = await finger(page);
  const left = page.locator('.rb-more.left'), right = page.locator('.rb-more.right');
  const body = page.locator('.rb-body');
  expect(await body.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  // Wait until the ribbon has stopped gliding (the scroll is smooth); returns where it is.
  const settle = async () => {
    let prev = null;
    await expect.poll(async () => { const v = await body.evaluate(el => el.scrollLeft); const still = v === prev; prev = v; return still; }, { intervals: [100] }).toBe(true);
    return prev;
  };
  await expect(right).toBeVisible();
  await expect(left).toBeHidden();
  for(let i = 0; i < 10 && await right.isVisible(); i++){
    const before = await settle();
    await f.tap(centre(await box(right)));
    expect(await settle()).toBeGreaterThan(before);
    await expect(left).toBeVisible();
  }
  await expect(right).toBeHidden();
  // At the end, the last button is on the screen, clear of the arrow on the left.
  const last = await box(page.locator('.rb-body .rb-btn').last());
  const arrow = await box(left);
  expect(last.x + last.width).toBeLessThanOrEqual(1024);
  expect(last.x).toBeGreaterThanOrEqual(arrow.x + arrow.width - 1);
  expect(await types()).toEqual(['touch']);
  // Back to the start.
  for(let i = 0; i < 10 && await left.isVisible(); i++){
    const before = await settle();
    await f.tap(centre(await box(left)));
    expect(await settle()).toBeLessThan(before);
  }
  expect(await body.evaluate(el => el.scrollLeft)).toBe(0);
  await expect(right).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('9c: on a touchscreen the ribbon\'s buttons are taller, and the canvas starts below them', async ({ page, pageErrors }) => {
  await setup(page);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  const small = await box(page.locator('.rb-body .rb-btn.small').first());
  expect(small.height).toBeGreaterThanOrEqual(28);
  const ribbon = await box(page.locator('#ribbon'));
  const tabs = await box(page.locator('#canvasTabs'));
  const canvas = await box(page.locator('#viewport'));
  expect(Math.abs(tabs.y - (ribbon.y + ribbon.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(canvas.y - (tabs.y + tabs.height))).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

for(const [width, height] of [[1024, 768], [768, 1024]]){
  test(`9c: the ribbon's top row fits a ${width} × ${height} screen: the search and the collapse button are on it`, async ({ page, pageErrors }) => {
    await page.setViewportSize({ width, height });
    await F.openFmIDE(page);
    for(const sel of ['.rb-search', '.rb-right .rb-iconbtn', '.rb-tab >> nth=-1']){
      const b = await box(page.locator('#ribbon ' + sel).first());
      expect(b.x, sel).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, sel).toBeLessThanOrEqual(width);
    }
    // The search, even as just its 🔎, still opens the Command Launcher.
    const f = await finger(page);
    await f.tap(centre(await box(page.locator('#ribbon .rb-search'))));
    await expect(page.locator('.launcher')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

for(const [width, height] of [[1024, 768], [768, 1024]]){
  test(`9c: every dialog fits on a ${width} × ${height} screen`, async ({ page, pageErrors }) => {
    await page.setViewportSize({ width, height });
    for(const cmd of DIALOG_COMMANDS){
      await F.openFmIDE(page);
      await page.evaluate((cmd) => fm.command(cmd), cmd);
      const dialog = page.locator(DIALOGS).last();
      await expect(dialog, cmd).toBeVisible();
      const b = await box(dialog);
      expect(b.x, cmd).toBeGreaterThanOrEqual(0);
      expect(b.y, cmd).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, cmd).toBeLessThanOrEqual(width);
      expect(b.y + b.height, cmd).toBeLessThanOrEqual(height);
    }
    expect(pageErrors).toEqual([]);
  });
}

test('9c: when the visible screen shrinks (the on-screen keyboard), the node being edited stays in sight', async ({ page, pageErrors }) => {
  await F.openFmIDE(page);
  const low = await page.evaluate(() => { fm.clearAll(); return fm.createRect({ x: 300, y: 500, name: 'Low', value: '1' }); });
  const f = await finger(page);
  const node = nodeEl(page, low);
  const nb = await box(node);
  expect(nb.y + nb.height).toBeLessThan(768);
  expect(nb.y).toBeGreaterThan(420);
  await f.doubleTap(centre(nb));
  const ta = node.locator('textarea');
  await expect(ta).toBeFocused();
  // The keyboard takes the lower part of the screen.
  await page.setViewportSize({ width: 1024, height: 420 });
  await expect.poll(async () => { const b = await ta.boundingBox(); return b && b.y + b.height; }).toBeLessThanOrEqual(420);
  const t = await box(ta);
  const canvas = await box(page.locator('#viewport'));
  expect(t.y).toBeGreaterThanOrEqual(canvas.y);
  await expect(ta).toBeFocused();
  // Typing still ends up on the node.
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Lower');
  await page.keyboard.press('Enter');
  await expect.poll(() => nodeOf(page, low).then(n => n.name)).toBe('Lower');
  expect(pageErrors).toEqual([]);
});

test('9c: when the visible screen shrinks, a dialog stays inside it and scrolls, and the box being typed in stays in sight', async ({ page, pageErrors }) => {
  await F.openFmIDE(page);
  await page.evaluate(() => fm.command('openShortcuts'));
  const dialog = page.locator('.modal-box').last();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 420 });
  await expect.poll(async () => { const b = await dialog.boundingBox(); return b && b.y + b.height; }).toBeLessThanOrEqual(420);
  expect((await box(dialog)).y).toBeGreaterThanOrEqual(0);
  expect(await dialog.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  // A box at the bottom of the dialog, focused: scrolled into sight.
  const field = dialog.locator('input:not([type=checkbox]), select, button').last();
  await field.focus();
  await expect.poll(async () => { const b = await field.boundingBox(); return b && b.y + b.height; }).toBeLessThanOrEqual(420);
  expect(pageErrors).toEqual([]);
});

test.describe('9c: with a mouse, nothing of it shows', () => {
  test.use({ hasTouch: false });
  test('no ribbon arrows, the usual text sizes, button heights and dialogs', async ({ page, pageErrors }) => {
    await F.openFmIDE(page);
    await page.mouse.move(400, 400);
    await expect(page.locator('body')).not.toHaveClass(/touch-input/);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    await expect(page.locator('.rb-more.right')).toBeHidden();
    await expect(page.locator('.rb-more.left')).toBeHidden();
    expect((await box(page.locator('.rb-body .rb-btn.small').first())).height).toBeLessThan(24);
    await page.evaluate(() => fm.command('managePeriods'));
    const input = page.locator('.modal-box input[type=text]').first();
    await expect(input).toBeVisible();
    expect(await input.evaluate(el => getComputedStyle(el).fontSize)).not.toBe('16px');
    expect(await page.locator('.modal-overlay').last().evaluate(el => { const s = getComputedStyle(el); return [s.top, s.bottom]; })).toEqual(['0px', '0px']);
    expect(pageErrors).toEqual([]);
  });
});
