// 52. fmGraph's A/B snapshot and gliding bars (step 15, phase G4b; docs/step15-fmgraph.md).
// - 📌 Pin as A: the outlines, difference labels and Biggest movers compare with A; the strip
//   says what A is; ⇄ Swap; Unpin; A holds on another board and through undo, is not an undo
//   step, and goes when another model opens; markup in a name stays text.
// - Bars glide to their new values (Web Animations), not while a slider is dragged, never with
//   reduced motion; a finger; window.fmGraph.pinA / unpinA / swapA / comparing.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp } = require('./helpers/apps');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const sliders = (page) => g(page, () => fmGraph.board().sliders.map(s => s.id));
const profitBar = (page) => page.locator('.bar-widget').first(); // the sample's Profit bar
const diffs = (page) => profitBar(page).locator('.t-diff').allTextContents();

test('Pin as A: the outlines and differences compare with A; Unpin goes back to the model', async ({ page, pageErrors }) => {
  await openSample(page);
  const [price, volume] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  expect(await diffs(page)).toEqual(['+3,000', '+3,300', '+3,600', '+3,900']);
  await page.click('#btnPinA');
  await expect(page.locator('#btnPinA')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compareBar')).toBeVisible();
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: Price 13');
  // Right after pinning, the board is A: nothing differs.
  await expect(profitBar(page).locator('.t-diff')).toHaveCount(0);
  await expect(profitBar(page).locator('.b-base')).toHaveCount(0);
  // Volume +10%: the differences are from A.
  await g(page, (i) => fmGraph.setSlider(i, 10), volume);
  expect(await diffs(page)).toEqual(['+700', '+770', '+840', '+910']);
  await expect(profitBar(page).locator('.b-base')).toHaveCount(4);
  await expect(page.locator('#moversList li').first().locator('.mover-change')).toHaveText('4,500 → 5,200 (+700 (+15.6%))');
  // The charts compare with A too: the balance sheet's Year 1 assets went up by 700.
  await expect(page.locator('.chart-widget').first().locator('.c-period').first().locator('.t-diff').first()).toHaveText('+700');
  // Unpin: back to the model's own numbers.
  await page.locator('#compareBar button', { hasText: 'Unpin' }).click();
  await expect(page.locator('#compareBar')).toBeHidden();
  await expect(page.locator('#btnPinA')).toHaveAttribute('aria-pressed', 'false');
  expect(await diffs(page)).toEqual(['+3,700', '+4,070', '+4,440', '+4,810']);
  await expect(page.locator('#moversList li').first().locator('.mover-change')).toHaveText('1,500 → 5,200 (+3,700 (+246.7%))');
  expect(pageErrors).toEqual([]);
});

test('Swap puts the sliders where A had them; A keeps where they were', async ({ page }) => {
  await openSample(page);
  const [price, volume] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  await page.click('#btnPinA');
  await g(page, (i) => fmGraph.resetSlider(i), price);
  await g(page, (i) => fmGraph.setSlider(i, 10), volume);
  await page.locator('#compareBar button', { hasText: 'Swap' }).click();
  expect(await g(page, () => fmGraph.board().sliders.map(s => s.value))).toEqual([13, null]);
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: Volume +10%');
  await expect(page.locator('.slider-widget').first().locator('input.slider-value')).toHaveValue('13');
  await expect(page.locator('.slider-widget').nth(1).locator('input.slider-value')).toHaveValue('0');
  // And back.
  expect(await g(page, () => fmGraph.swapA())).toBe('Price 13');
  expect(await g(page, () => fmGraph.board().sliders.map(s => s.value))).toEqual([null, 10]);
  // A pinned with no slider moved is the model's own numbers.
  await g(page, () => fmGraph.resetAll());
  expect(await g(page, () => fmGraph.pinA())).toBe('the model\'s own numbers');
  expect(await g(page, () => fmGraph.comparing())).toBe('the model\'s own numbers');
});

test('A holds on another board and through undo, is not an undo step, and goes with another model', async ({ page }) => {
  await openSample(page);
  const [price] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  await page.click('#btnPinA');
  await expect(page.locator('#btnUndo')).toBeDisabled(); // pinning is not a change
  // Another board: still comparing with A (the model's numbers with Price at 13).
  await page.locator('#boardTabs .board-tool', { hasText: '+ Board' }).click();
  await expect(page.locator('#compareBar')).toBeVisible();
  await g(page, () => fmGraph.addBar('Profit'));
  await expect(profitBar(page).locator('.t-diff')).toHaveText(['−3,000', '−3,300', '−3,600', '−3,900']);
  // Undo (the bar, then the board): still comparing.
  await page.click('#btnUndo');
  await page.click('#btnUndo');
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: Price 13');
  // Another model: A goes.
  await g(page, () => fmGraph.load({ kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'o', name: 'Other', nodes: [{ id: 'x', type: 'value', x: 0, y: 0, text: 'X\n1' }], edges: [] }] }, 'Other'));
  await expect(page.locator('#compareBar')).toBeHidden();
  expect(await g(page, () => fmGraph.comparing())).toBeNull();
  await expect(() => g(page, () => fmGraph.swapA())).rejects.toThrow('Nothing is pinned as A.');
});

test('markup in a slider\'s name stays text in the strip', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: evil + '\n2' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Three\n3' },
    { id: 'm', type: 'operator', x: 100, y: 50, text: '×' }, { id: 'r', type: 'value', x: 200, y: 50, text: 'Six' },
  ], edges: [{ id: 'e1', from: 'a', to: 'm' }, { id: 'e2', from: 'b', to: 'm' }, { id: 'e3', from: 'm', to: 'r' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Hostile'), model);
  const [s] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 4), s);
  await g(page, () => fmGraph.pinA());
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: ' + evil + ' 4');
  expect(await page.locator('#compareBar img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('bars glide to their new values, not while a slider is dragged', async ({ page }) => {
  await openSample(page);
  const [price] = await sliders(page);
  await page.waitForTimeout(300);
  // A typed number: the bars glide, and end where the value puts them.
  const box = page.locator('.slider-widget').first().locator('input.slider-value');
  await box.fill('14');
  await box.press('Enter');
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.matches('rect[data-anim]')).length);
  expect(running).toBeGreaterThan(10);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  const bar = profitBar(page).locator('rect.b-now').first();
  expect(await bar.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  // Two redraws close together (a drag): the second doesn't glide.
  const second = await page.evaluate(async (id) => {
    fmGraph.setSlider(id, 12);
    await new Promise(r => setTimeout(r, 30));
    document.getAnimations().forEach(a => a.finish());
    fmGraph.setSlider(id, 11);
    return document.getAnimations().length;
  }, price);
  expect(second).toBe(0);
});

test('with reduced motion, nothing glides', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSample(page);
  await page.waitForTimeout(300);
  await page.click('#btnResetAll');
  const [price] = await sliders(page);
  await page.waitForTimeout(300);
  await g(page, (i) => fmGraph.setSlider(i, 14), price);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.waitForTimeout(300);
  await page.click('#btnResetAll');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('by finger: Pin as A and Swap', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 1400 } });
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url() === 'http://local.test/fmGraph.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(__dirname, '..', 'apps', 'fmGraph.html')) })
    : route.abort());
  try{
    await page.goto('http://local.test/fmGraph.html');
    await page.click('#btnSample');
    await expect(page.locator('.chart-widget')).toHaveCount(2);
    const types = await watchPointerTypes(page);
    const f = await finger(page);
    const [price] = await sliders(page);
    await g(page, (i) => fmGraph.setSlider(i, 13), price);
    await f.tap(centre(await page.locator('#btnPinA').boundingBox()));
    await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: Price 13');
    await g(page, (i) => fmGraph.resetSlider(i), price);
    await f.tap(centre(await page.locator('#compareBar button', { hasText: 'Swap' }).boundingBox()));
    expect(await g(page, () => fmGraph.board().sliders.map(s => s.value))).toEqual([13, null]);
    expect(await types()).toEqual(['touch']);
  } finally {
    await context.close();
  }
});
