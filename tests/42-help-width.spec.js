// 42. The Help panel's width (step 10, phase H5a): ⤢ in its header widens it to a reading view
// (two thirds of the window) and ⤡ brings it back; its left edge drags to any width, by mouse or
// finger; a double-click on the edge goes back to the usual width. The width is kept — fmIDE in
// the person's own UI settings (ui.helpSize, never from someone else's file), ExcelExporter in
// its browser storage — and never leaves the app less than 200 pixels beside it.
const fs = require('fs');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');
const X = require('./helpers/excel');
const { watchPointerTypes } = require('./helpers/touch');

const panel = (page) => page.locator('#helpPanel');
const expand = (page) => panel(page).locator('.help-expand');
const edge = (page) => panel(page).locator('.help-resize');
const widthOf = (page) => panel(page).evaluate(el => Math.round(el.getBoundingClientRect().width));

async function savedUi(page){
  const entries = await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1');
  const text = entries['fmIDE-workspace-v1'];
  return text ? (JSON.parse(text).ui || {}) : {};
}
async function openHelp(page){
  await page.evaluate(() => fm.command('openHelp'));
  await expect(panel(page)).toBeVisible();
}
// A real mouse drag of the panel's left edge to x.
async function dragEdgeTo(page, x){
  const b = await edge(page).boundingBox();
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + b.width / 2, y);
  await page.mouse.down();
  await page.mouse.move((b.x + x) / 2, y, { steps: 4 });
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
}

test.describe('fmIDE', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await F.openFmIDE(page);
  });

  test('⤢ widens Help to a reading view, the canvas beside it narrows, and ⤡ brings it back; both are kept', async ({ page }) => {
    await openHelp(page);
    expect(await widthOf(page)).toBe(380);
    await expect(expand(page)).toHaveText('⤢');
    await expect(panel(page)).not.toHaveClass(/\bwide\b/);
    const fontNarrow = await panel(page).locator('.help-body').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    await expand(page).click();
    expect(await widthOf(page)).toBe(933); // two thirds of 1400
    await expect(panel(page)).toHaveClass(/\bwide\b/);
    await expect(expand(page)).toHaveText('⤡');
    await expect(expand(page)).toHaveAttribute('aria-pressed', 'true');
    // A reading view: larger text, and the canvas still beside the panel, not under it.
    expect(await panel(page).locator('.help-body').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(fontNarrow);
    expect(await page.locator('#viewport').evaluate(el => Math.round(el.getBoundingClientRect().right))).toBe(1400 - 933);
    await expect.poll(() => savedUi(page).then(ui => ui.helpSize), { timeout: 5000 }).toEqual({ width: 933 });
    // Kept after a reload.
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await openHelp(page);
    expect(await widthOf(page)).toBe(933);
    await expand(page).click();
    expect(await widthOf(page)).toBe(380);
    await expect(panel(page)).not.toHaveClass(/\bwide\b/);
    await expect.poll(() => savedUi(page).then(ui => ui.helpSize), { timeout: 5000 }).toEqual({});
  });

  test('the left edge drags to any width (kept after a reload, ⤢ coming back to it); a double-click on it goes back to the usual width', async ({ page }) => {
    await openHelp(page);
    await dragEdgeTo(page, 1400 - 500);
    expect(await widthOf(page)).toBe(500);
    await expect(panel(page)).not.toHaveClass(/\bwide\b/);
    await expect.poll(() => savedUi(page).then(ui => ui.helpSize), { timeout: 5000 }).toEqual({ width: 500 });
    // ⤢ and ⤡ come back to the width it was dragged to.
    await expand(page).click();
    expect(await widthOf(page)).toBe(933);
    await expand(page).click();
    expect(await widthOf(page)).toBe(500);
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await openHelp(page);
    expect(await widthOf(page)).toBe(500);
    // Dragged to 700, it reads as a page; ⤡ then goes to the usual width.
    await dragEdgeTo(page, 1400 - 700);
    expect(await widthOf(page)).toBe(700);
    await expect(panel(page)).toHaveClass(/\bwide\b/);
    await expect(expand(page)).toHaveText('⤡');
    // A double-click on the edge: the usual width, nothing kept.
    const b = await edge(page).boundingBox();
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    expect(await widthOf(page)).toBe(380);
    await expect.poll(() => savedUi(page).then(ui => ui.helpSize), { timeout: 5000 }).toEqual({});
  });

  test('never narrower than 300 pixels, and always leaves 200 pixels of the app beside it, also in a smaller window', async ({ page }) => {
    await openHelp(page);
    await dragEdgeTo(page, 1390);
    expect(await widthOf(page)).toBe(300);
    await dragEdgeTo(page, 20);
    expect(await widthOf(page)).toBe(1200);
    // The saved 1200 in a window 1000 wide: 800.
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(() => widthOf(page)).toBe(800);
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect.poll(() => widthOf(page)).toBe(1200);
  });

  test('the help still works as before when wide: a topic opens, Back returns, Esc closes', async ({ page }) => {
    await openHelp(page);
    await expand(page).click();
    await panel(page).locator('.help-topic-link[data-topic]').first().click();
    await expect(panel(page).locator('.help-topic-title')).toBeVisible();
    await panel(page).locator('.help-back').click();
    await expect(panel(page).locator('.help-topic-link[data-topic]').first()).toBeVisible();
    await panel(page).locator('.help-search').press('Escape');
    await expect(panel(page)).toBeHidden();
  });

  test('a Help width in someone else\'s workspace file is never taken; a bad saved one is ignored', async ({ page }, testInfo) => {
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    data.ui = Object.assign({}, data.ui, { helpSize: { width: 777 } });
    const file = testInfo.outputPath('ws-with-help-size.json');
    fs.writeFileSync(file, JSON.stringify(data));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    await openHelp(page);
    expect(await widthOf(page)).toBe(380);
    // Not in a Preferences file either.
    await expand(page).click();
    const prefs = await F.downloadJson(page, () => page.evaluate(() => fm.command('exportPreferences')));
    expect(JSON.stringify(prefs.data)).not.toContain('helpSize');
  });

  test('in a window under 700 pixels the panel covers the canvas, without ⤢ or the edge', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await openHelp(page);
    expect(await widthOf(page)).toBe(600);
    await expect(expand(page)).toBeHidden();
    await expect(edge(page)).toBeHidden();
  });
});

test.describe('fmIDE by finger', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  test('a finger drags the edge', async ({ page }) => {
    await F.openFmIDE(page);
    await openHelp(page);
    const types = await watchPointerTypes(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const b = await edge(page).boundingBox();
    const y = b.y + b.height / 2;
    await touch('touchStart', b.x + b.width / 2, y);
    for(const x of [600, 560, 524]) await touch('touchMove', x, y);
    await touch('touchEnd');
    expect(await widthOf(page)).toBe(500);
    expect(await types()).toEqual(['touch']);
  });
});

test.describe('ExcelExporter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await X.openExporter(page);
  });

  test('⤢ and the edge work the same; the width is kept in its browser storage after a reload', async ({ page }) => {
    await page.click('#btnHelp');
    await expect(panel(page)).toBeVisible();
    expect(await widthOf(page)).toBe(380);
    await expand(page).click();
    expect(await widthOf(page)).toBe(933);
    await expect(panel(page)).toHaveClass(/\bwide\b/);
    // The page makes room beside it.
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).marginRight))).toBe(933);
    await dragEdgeTo(page, 1400 - 450);
    expect(await widthOf(page)).toBe(450);
    await expect.poll(async () => (await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-help-size'))['fmide-excel-help-size'], { timeout: 5000 })
      .toBe(JSON.stringify({ width: 450 }));
    await page.reload();
    await page.waitForTimeout(300);
    await page.click('#btnHelp');
    expect(await widthOf(page)).toBe(450);
  });
});
