// 86. fmGraph's full screen (the owner's idea of 27 October 2026; 05h-phone-show.js): one or
// several bars and charts on the whole screen, on any screen, without the rest of the page.
// - ⛶ on a chart's and on a bar's header opens the view with that one; the browser's own full
//   screen is asked for (the whole page).
// - The chips in the strip add and take away the board's others (the last one stays); several
//   shown share the screen in a grid that fits it, every one inside the view.
// - Sliders moved through window.fmGraph redraw what is shown; Play runs in it from the strip,
//   a tap in the view leaves it playing, ■ Stop in the strip stops it.
// - The strip fades after a few seconds (× stays) and a tap, a key or the mouse brings it back.
// - ×, Esc, the back gesture and leaving the browser's full screen each close it, and the page
//   is as before (no board change, no undo step, nothing saved).
// - The Free chart drawn in it; names stay text. A phone keeps its own Show (groups 68 and 69).
const { test, expect, openApp } = require('./helpers/apps');

const g = (page, fn, arg) => page.evaluate(fn, arg);

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const view = (page) => page.locator('#showView');
const shown = (page) => page.locator('#showBody .show-widget');
const boardText = (page) => g(page, () => JSON.stringify(Object.assign(fmGraph.board(), { sliders: fmGraph.board().sliders.map(s => Object.assign({}, s, { value: null })) })));
// Every shown widget's drawing inside the view, none overlapping another.
async function fitted(page){
  return g(page, () => {
    const v = document.getElementById('showView').getBoundingClientRect();
    const boxes = [...document.querySelectorAll('#showBody .show-widget')].map(e => e.getBoundingClientRect());
    const inside = boxes.every(b => b.width > 50 && b.height > 50 && b.left >= v.left - 1 && b.right <= v.right + 1 && b.top >= v.top - 1 && b.bottom <= v.bottom + 1);
    const apart = boxes.every((a, i) => boxes.every((b, j) => i === j || a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
    const svgs = [...document.querySelectorAll('#showBody svg.bar-chart')].every(s => { const r = s.getBoundingClientRect(); return r.height > 40 && r.bottom <= v.bottom + 1; });
    return { inside, apart, svgs, n: boxes.length };
  });
}

test('⛶ on a chart opens the full screen with it; the chips add and take away the others, fitted', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSample(page);
  const before = await boardText(page);
  await expect(page.locator('.bar-widget .widget-full')).toHaveCount(await page.locator('.bar-widget').count());
  await expect(page.locator('.chart-widget .widget-full')).toHaveCount(2);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await expect(view(page)).toBeVisible();
  await expect(page.locator('#showTitle')).toHaveText('Balance sheet');
  await expect(shown(page)).toHaveCount(1);
  await expect(page.locator('#showBody svg.bar-chart')).toHaveCount(1);
  await expect(page.locator('#showBody .chart-key')).toContainText('Assets');
  // The browser's own full screen, on the whole page.
  await expect.poll(() => g(page, () => document.fullscreenElement === document.documentElement)).toBe(true);
  // Bigger than on the board.
  const small = await page.locator('.chart-widget').first().locator('svg.bar-chart').boundingBox();
  const big = await page.locator('#showBody svg.bar-chart').boundingBox();
  expect(big.height).toBeGreaterThan(small.height * 1.5);
  // The chips: every bar and chart, the one shown pressed.
  const items = await g(page, () => fmGraph.board().items.length);
  await expect(page.locator('.show-chip')).toHaveCount(items);
  await expect(page.locator('.show-chip[aria-pressed="true"]')).toHaveText(['Balance sheet']);
  // Add a bar and the other chart: three shown, in the board's order, in a grid that fits.
  await page.locator('.show-chip', { hasText: 'Profit' }).first().click();
  await page.locator('.show-chip[aria-pressed="false"]').last().click();
  await expect(shown(page)).toHaveCount(3);
  await expect(page.locator('#showTitle')).toBeHidden();
  await expect(page.locator('#showBody .show-name')).toHaveCount(3);
  const order = await g(page, () => fmGraph.board().items.map(w => w.id));
  const ids = await page.locator('#showBody .show-widget').evaluateAll(els => els.map(e => e.dataset.id));
  expect(ids).toEqual(order.filter(id => ids.includes(id)));
  expect(await fitted(page)).toEqual({ inside: true, apart: true, svgs: true, n: 3 });
  const cols = Number(await view(page).getAttribute('data-cols')), rows = Number(await view(page).getAttribute('data-rows'));
  expect(cols * rows).toBeGreaterThanOrEqual(3);
  expect(cols).toBeGreaterThan(1); // a wide screen: side by side
  // Take two away; the last one stays.
  await page.locator('.show-chip[aria-pressed="true"]').first().click();
  await expect(shown(page)).toHaveCount(2);
  await page.locator('.show-chip[aria-pressed="true"]').first().click();
  await expect(shown(page)).toHaveCount(1);
  await page.locator('.show-chip[aria-pressed="true"]').click();
  await expect(shown(page)).toHaveCount(1);
  expect(await fitted(page)).toEqual({ inside: true, apart: true, svgs: true, n: 1 });
  // × closes it: the browser's full screen left, the page as before.
  await page.click('#showClose');
  await expect(view(page)).toBeHidden();
  await expect.poll(() => g(page, () => !!document.fullscreenElement)).toBe(false);
  expect(await boardText(page)).toBe(before);
  await expect(page.locator('body')).not.toHaveClass(/showing/);
  await expect(page.locator('#board')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('⛶ on a bar; the view follows sliders moved through window.fmGraph', async ({ page, pageErrors }) => {
  await openSample(page);
  const bar = page.locator('.bar-widget').first();
  const name = await bar.locator('.widget-title').textContent(); // its rectangle's name
  expect(name.length).toBeGreaterThan(0);
  await bar.locator('.widget-full').click();
  await expect(view(page)).toBeVisible();
  await expect(page.locator('#showTitle')).toHaveText(name);
  await expect(page.locator('#showBody svg.bar-chart')).toHaveCount(1);
  const label = () => page.locator('#showBody .t-value').first().textContent();
  const was = await label();
  await g(page, () => fmGraph.setSlider(fmGraph.board().sliders[0].id, 14));
  await expect.poll(label).not.toBe(was);
  await expect(page.locator('#showBody .b-base')).not.toHaveCount(0); // the model's own numbers, dashed
  await g(page, () => fmGraph.resetAll());
  await expect.poll(label).toBe(was);
  expect(pageErrors).toEqual([]);
});

test('Play runs in the view from the strip; a tap leaves it playing, ■ Stop stops it', async ({ page, pageErrors }) => {
  await openSample(page);
  const price = await g(page, () => fmGraph.board().sliders[0].id);
  await g(page, (i) => { fmGraph.setSlider(i, 8); fmGraph.saveScenario('Low'); fmGraph.setSlider(i, 14); fmGraph.saveScenario('High'); fmGraph.resetAll(); }, price);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await expect(view(page)).toBeVisible();
  await expect(page.locator('#showPlay')).toHaveText('▶ Play');
  await page.click('#showPlay');
  await expect.poll(() => g(page, () => fmGraph.playing() && fmGraph.playing().from)).toBe('“Low”');
  await expect(page.locator('#showPlay')).toHaveText('■ Stop');
  // The chart shown moves with the play.
  const label = () => page.locator('#showBody .t-value').first().textContent();
  const seen = new Set();
  for(let i = 0; i < 30 && seen.size < 3; i++){ seen.add(await label()); await page.waitForTimeout(100); }
  expect(seen.size).toBeGreaterThan(1);
  // A tap in the view (on the chart, and on empty space) leaves it playing.
  await page.locator('#showBody svg.bar-chart').click({ position: { x: 20, y: 20 } });
  const vb = await view(page).boundingBox();
  await page.mouse.click(vb.x + vb.width - 30, vb.y + vb.height - 20);
  await page.keyboard.press('Shift');
  expect(await g(page, () => !!fmGraph.playing())).toBe(true);
  await page.click('#showPlay');
  await expect.poll(() => g(page, () => fmGraph.playing())).toBe(null);
  await expect(page.locator('#showPlay')).toHaveText('▶ Play');
  await expect(view(page)).toBeVisible();
  // Stopped another way (fmGraph), the strip follows.
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
  await expect(page.locator('#showPlay')).toHaveText('■ Stop');
  // Esc closes the view only; the play goes on until ■ Stop, Esc again or a slider moved.
  await page.keyboard.press('Escape');
  await expect(view(page)).toBeHidden();
  expect(await g(page, () => !!fmGraph.playing())).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => g(page, () => fmGraph.playing())).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('Play with nothing to play: the strip says so, and nothing plays', async ({ page, pageErrors }) => {
  await openSample(page);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await page.click('#showPlay'); // the model's own numbers to the sliders now: the same
  await expect(page.locator('#showNote')).toHaveText(/Nothing to play/);
  expect(await g(page, () => fmGraph.playing())).toBe(null);
  await expect(page.locator('#showPlay')).toHaveText('▶ Play');
  expect(pageErrors).toEqual([]);
});

test('the strip fades after a few seconds, × stays; a tap, a key or the mouse brings it back', async ({ page, pageErrors }) => {
  await openSample(page);
  await page.locator('.bar-widget').first().locator('.widget-full').click();
  await page.mouse.move(5, 400);
  await expect(view(page)).not.toHaveClass(/quiet/);
  await expect(view(page)).toHaveClass(/quiet/, { timeout: 6000 });
  // The strip fades over 0.35 s once quiet (board.css): wait for the fade to end.
  await expect.poll(() => page.locator('#showChips').evaluate(e => getComputedStyle(e).opacity)).toBe('0');
  expect(Number(await page.locator('#showClose').evaluate(e => getComputedStyle(e).opacity))).toBeGreaterThan(0.3);
  await page.mouse.click(400, 500);
  await expect(view(page)).not.toHaveClass(/quiet/);
  await expect(view(page)).toHaveClass(/quiet/, { timeout: 6000 });
  await page.keyboard.press('Tab');
  await expect(view(page)).not.toHaveClass(/quiet/);
  await page.mouse.move(5, 400);
  await expect(view(page)).toHaveClass(/quiet/, { timeout: 8000 });
  await page.mouse.move(300, 300);
  await expect(view(page)).not.toHaveClass(/quiet/);
  // × works while it is quiet.
  await expect(view(page)).toHaveClass(/quiet/, { timeout: 8000 });
  await page.click('#showClose');
  await expect(view(page)).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('Esc, the back gesture and leaving the browser\'s full screen each close it, the page as before', async ({ page, pageErrors }) => {
  await openSample(page);
  const before = await boardText(page);
  const open = async () => {
    await page.locator('.chart-widget').nth(1).locator('.widget-full').click();
    await expect(view(page)).toBeVisible();
  };
  await open();
  await page.keyboard.press('Escape');
  await expect(view(page)).toBeHidden();
  await open();
  await page.goBack();
  await expect(view(page)).toBeHidden();
  await expect(page.locator('#board')).toBeVisible(); // still fmGraph, the same model
  await open();
  await expect.poll(() => g(page, () => !!document.fullscreenElement)).toBe(true);
  await g(page, () => document.exitFullscreen());
  await expect(view(page)).toBeHidden();
  // Opened again after: still works; the history has no step left over.
  await open();
  await page.click('#showClose');
  await expect(view(page)).toBeHidden();
  expect(await g(page, () => history.state && history.state.fmGraphShow)).toBeFalsy();
  expect(await boardText(page)).toBe(before);
  await expect(page.locator('body')).not.toHaveClass(/showing/);
  expect(pageErrors).toEqual([]);
});

test('the Free chart in the view: its pieces drawn, larger; ? opens its help; names stay text', async ({ page, pageErrors }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: 'Cash\n100' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Loan\n60' },
    { id: 'o', type: 'operator', x: 100, y: 50, text: '−' }, { id: 'e', type: 'value', x: 200, y: 50, text: evil },
  ], edges: [{ id: 'e1', from: 'a', to: 'o' }, { id: 'e2', from: 'b', to: 'o' }, { id: 'e3', from: 'o', to: 'e' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Free'), model);
  await g(page, (evil) => {
    fmGraph.addSlider('Cash');
    fmGraph.addChart({ layout: 'free', title: evil, period: 1, pieces: [
      { name: 'Assets', column: 0, sits: { on: 'zero' }, parts: ['Cash'] },
      { name: 'Funding', column: 1, sits: { on: 'zero' }, check: 0, parts: ['Loan', evil] },
    ] });
  }, evil);
  const chart = page.locator('.chart-widget[data-layout="free"]');
  await chart.locator('.widget-full').click();
  await expect(page.locator('#showTitle')).toHaveText(evil);
  await expect(page.locator('#showBody .fr-piece')).toHaveCount(await chart.locator('.fr-piece').count());
  await expect(page.locator('#showBody .t-check')).toHaveCount(await chart.locator('.t-check').count());
  const small = await chart.locator('svg.bar-chart').boundingBox(), big = await page.locator('#showBody svg.bar-chart').boundingBox();
  expect(big.width * big.height).toBeGreaterThan(small.width * small.height * 2);
  expect(await fitted(page)).toEqual({ inside: true, apart: true, svgs: true, n: 1 });
  // It follows a slider like the board's.
  const label = () => page.locator('#showBody .t-value').first().textContent();
  const was = await label();
  await g(page, () => fmGraph.setSlider(fmGraph.board().sliders[0].id, 150));
  await expect.poll(label).not.toBe(was);
  // ?: the Help panel, over the view, at its topic.
  await page.click('#showHelp');
  await expect(page.locator('#helpPanel')).toBeVisible();
  await expect(page.locator('#helpPanel')).toContainText('Full screen');
  expect(await page.locator('img, #showView b').count()).toBe(0);
  expect(await g(page, () => window.__pwned)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

// 🎚 Sliders (the owner's request of 30 October 2026; 05gs-show.js): the board's sliders beside
// the full screen, one short row each, the unreached dimmed; kept on this device.
const rows = (page) => page.locator('#showSliders .slider-widget');
const box = (page, sel) => page.locator(sel).boundingBox();

test('🎚 Sliders: the board\'s sliders beside the full screen, the unreached dimmed; moving one moves the chart and the board\'s', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSample(page);
  await g(page, () => fmGraph.addSlider('Equipment'));
  const before = await boardText(page);
  // The Profit bar on its own: off at first.
  await page.locator('.bar-widget').first().locator('.widget-full').click();
  await expect(view(page)).toBeVisible();
  await expect(page.locator('#showTitle')).toHaveText('Profit');
  await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#showSliders')).toBeHidden();
  const alone = await box(page, '#showBody .show-widget');
  // On: the board's three sliders, at the right of the screen (wider than tall), the bar narrower.
  await page.click('#showSlidersBtn');
  await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).locator('.slider-name')).toHaveText(['Price', 'Volume', 'Equipment']);
  await expect(view(page)).toHaveAttribute('data-shape', 'wide');
  const side = await box(page, '#showSliders'), body = await box(page, '#showBody');
  expect(side.x).toBeGreaterThanOrEqual(body.x + body.width - 1);
  expect(side.width).toBeGreaterThan(200);
  expect((await box(page, '#showBody .show-widget')).width).toBeLessThan(alone.width);
  expect((await fitted(page)).inside).toBe(true);
  // Each one short row; Equipment reaches nothing shown: dimmed.
  for(const r of await rows(page).all()) expect((await r.boundingBox()).height).toBeLessThanOrEqual(48);
  expect(await rows(page).evaluateAll(els => els.map(e => e.classList.contains('unreached')))).toEqual([false, false, true]);
  // The Balance sheet shown too: Equipment is in it.
  await page.locator('.show-chip', { hasText: 'Balance sheet' }).click();
  await expect(shown(page)).toHaveCount(2);
  expect(await rows(page).evaluateAll(els => els.map(e => e.classList.contains('unreached')))).toEqual([false, false, false]);
  // Moving one (its keys): the chart shown follows, and so do the board's slider and its box.
  const label = () => page.locator('#showBody .t-value').first().textContent();
  const was = await label();
  const price = rows(page).first();
  await price.locator('.ps-track').focus();
  for(let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(label).not.toBe(was);
  const moved = await g(page, () => fmGraph.board().sliders[0].value);
  expect(moved).not.toBe(null);
  await expect(price.locator('.ps-value')).toHaveText(String(moved));
  await expect(page.locator('#sliderList > .slider-widget').first().locator('input.slider-value')).toHaveValue(String(moved));
  // Moved elsewhere (window.fmGraph), the row follows.
  await g(page, () => fmGraph.setSlider(fmGraph.board().sliders[0].id, 12));
  await expect(price.locator('.ps-value')).toHaveText('12');
  // A slider added on the board shows up beside it; nothing about the board changed but positions.
  await page.keyboard.press('Escape');
  await expect(view(page)).toBeHidden();
  expect(await boardText(page)).toBe(before);
  expect(pageErrors).toEqual([]);
});

test('🎚 Sliders: at the foot when the screen is taller than wide; Play moves the rows', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await openSample(page);
  const price = await g(page, () => fmGraph.board().sliders[0].id);
  await g(page, (i) => { fmGraph.setSlider(i, 8); fmGraph.saveScenario('Low'); fmGraph.setSlider(i, 14); fmGraph.saveScenario('High'); fmGraph.resetAll(); }, price);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await page.click('#showSlidersBtn');
  await expect(view(page)).toHaveAttribute('data-shape', 'tall');
  await expect(rows(page)).toHaveCount(2);
  const foot = await box(page, '#showSliders'), body = await box(page, '#showBody');
  expect(foot.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  expect(foot.y + foot.height).toBeLessThanOrEqual(1001);
  expect((await fitted(page)).inside).toBe(true);
  // Play from the strip: the Price row moves with it, marked as playing.
  await page.click('#showPlay');
  await expect.poll(() => g(page, () => !!fmGraph.playing())).toBe(true);
  await expect(rows(page).first()).toHaveClass(/playing/);
  const seen = new Set();
  for(let i = 0; i < 30 && seen.size < 3; i++){ seen.add(await rows(page).first().locator('.ps-value').textContent()); await page.waitForTimeout(100); }
  expect(seen.size).toBeGreaterThan(1);
  expect(await g(page, (i) => fmGraph.board().sliders.find(s => s.id === i).value, price)).toBe(null); // its own number untouched
  await page.click('#showPlay');
  await expect.poll(() => g(page, () => fmGraph.playing())).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('🎚 Sliders is kept on this device; off hides them again', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSample(page);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await page.click('#showSlidersBtn');
  await expect(rows(page)).toHaveCount(2);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows(page)).toHaveCount(2);
  await page.click('#showSlidersBtn');
  await expect(page.locator('#showSliders')).toBeHidden();
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#showSliders')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('🎚 Sliders shows or hides the dock over the full screen (on at first, as before)', async ({ page, pageErrors }) => {
    await openApp(page, 'fmGraph');
    await page.waitForFunction(() => !!window.fmGraph);
    await page.click('#btnSample');
    await expect(page.locator('#sliderDock')).toBeVisible();
    await page.locator('.chart-widget').first().locator('.widget-full').dispatchEvent('click');
    await expect(view(page)).toBeVisible();
    await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sliderDock')).toBeVisible();
    await expect(page.locator('#showSliders')).toBeHidden(); // the dock is the sliders here
    await page.locator('#showSlidersBtn').tap();
    await expect(page.locator('#showSlidersBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sliderDock')).toBeHidden();
    // Closed, the dock is back on the board.
    await page.locator('#showClose').tap();
    await expect(view(page)).toBeHidden();
    await expect(page.locator('#sliderDock')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
