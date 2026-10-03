// 60. Long messages and picking files on an iPad.
// A long message in fmIDE (a recipe's socket check can list dozens of sockets) scrolls inside
// its window and its OK always stays on the screen; ExcelExporter's list of where the workbook
// will differ from fmIDE shows its first lines, opens to all of them, and can be hidden. On an
// iPhone or iPad the file boxes that take a .fmide accept any file (Safari greys out a type it
// doesn't know); elsewhere they keep their list.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');

// A templates file: a canvas template with `count` sockets nothing feeds, and a recipe of it.
function manySocketsFile(testInfo, count){
  const nodes = [], edges = [];
  for(let i = 1; i <= count; i++){
    nodes.push({ id: 'o' + i, type: 'operator', x: 40, y: i * 80, w: 56, h: 56, text: '+', socket: 'to Socket number ' + i });
    nodes.push({ id: 'v' + i, type: 'value', x: 160, y: i * 80, w: 170, h: 64, text: 'Line ' + i + '\n0' });
    edges.push({ id: 'e' + i, from: 'o' + i, to: 'v' + i });
  }
  const file = testInfo.outputPath('many-sockets.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 3, kind: 'fmIDE-templates', templates: [
    { name: 'Wide Sheet', kind: 'module', family: 'fam-wide-sheet', version: 1, note: '', versionId: 'vid-wide-1',
      data: { version: 2, kind: 'module', name: 'Wide Sheet', selfCanvasId: 'c1', nextId: count * 3 + 1, nodes, edges } },
    { name: 'Wide Recipe', kind: 'recipe', family: 'fam-wide-recipe', version: 1, note: '', versionId: 'vid-wide-recipe-1',
      data: { kind: 'recipe', parts: [{ family: 'fam-wide-sheet', version: 'latest', name: 'Wide Sheet' }] } },
  ] }));
  return file;
}

test('fmIDE: a long message scrolls inside its window and OK stays on the screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await F.openFmIDE(page);
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', manySocketsFile(testInfo, 80));
  await F.dismissMessage(page);
  await page.locator('.modal-box.template-box .template-list button.template-family', { hasText: 'Wide Recipe' }).click();
  await page.locator('.modal-box.template-box button.recipe-build').click();
  const box = page.locator('.modal-box.message-box').last();
  await expect(box).toBeVisible();
  const text = box.locator('p.message-text');
  await expect(text).toContainText('Built Wide Recipe: 1 canvas.');
  await expect(text).toContainText('“to Socket number 80” (Wide Sheet)');
  // The window fits the screen; the text scrolls inside it.
  const fit = await box.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const p = b.querySelector('p.message-text');
    return { top: r.top, bottom: r.bottom, scrolls: p.scrollHeight > p.clientHeight + 1, overflow: getComputedStyle(p).overflowY };
  });
  expect(fit.top).toBeGreaterThanOrEqual(0);
  expect(fit.bottom).toBeLessThanOrEqual(600);
  expect(fit.scrolls).toBe(true);
  expect(fit.overflow).toBe('auto');
  const ok = box.locator('.modal-actions button', { hasText: /^OK$/ });
  await expect(ok).toBeInViewport({ ratio: 1 });
  // The text scrolls to its end; OK is still where it was.
  await text.evaluate((p) => { p.scrollTop = p.scrollHeight; });
  await expect(ok).toBeInViewport({ ratio: 1 });
  await ok.click();
  await expect(page.locator('.modal-box.message-box')).toHaveCount(0);
});

test('fmIDE: a question with a long text keeps its buttons on the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 500 });
  await F.openFmIDE(page);
  // Delete Canvas asks first, naming the canvas.
  await page.evaluate(() => { const id = fm.canvases()[0].id; fm.renameCanvas(id, 'A very long canvas name '.repeat(120)); fm.addCanvas('Second'); fm.switchCanvas(id); });
  await page.evaluate(() => fm.command('deleteCanvas'));
  const box = page.locator('.modal-box.message-box').last();
  await expect(box).toBeVisible();
  await expect(box.locator('button.danger')).toBeInViewport({ ratio: 1 });
  await expect(box.locator('button', { hasText: /^Cancel$/ })).toBeInViewport({ ratio: 1 });
  await box.locator('button', { hasText: /^Cancel$/ }).click();
});

async function differences(page){ return page.locator('#differencesPanel li').allTextContents(); }
const visibleLines = (page) => page.locator('#differencesPanel li:visible');

test('ExcelExporter: the differences show their first three lines, Show all opens the rest, × hides them until they change', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('ir', 'error-cases.json'));
  const panel = page.locator('#differencesPanel');
  await expect(panel).toBeVisible();
  const all = await differences(page);
  expect(all.length).toBeGreaterThan(3);
  await expect(visibleLines(page)).toHaveCount(3);
  await expect(panel.locator('.hint')).toContainText('…and ' + (all.length - 3) + ' more.');
  const toggle = panel.locator('button.differences-toggle');
  await expect(toggle).toHaveText('Show all ' + all.length + ' ▾');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(visibleLines(page)).toHaveCount(all.length);
  await expect(toggle).toHaveText('Show fewer ▴');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // Open, the list scrolls inside the panel rather than pushing the page down.
  expect(await panel.locator('ul').evaluate((ul) => getComputedStyle(ul).overflowY)).toBe('auto');
  await toggle.click();
  await expect(visibleLines(page)).toHaveCount(3);
  // × hides it.
  await panel.locator('button.differences-close').click();
  await expect(panel).toBeHidden();
  // Something in the list changes: it comes back.
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('#rowGroups input[type=text]')].find(i => i.value === 'A');
    label.closest('tr').querySelectorAll('input[type=checkbox]')[1].click();
  });
  await expect(panel).toBeVisible();
  expect((await differences(page)).length).not.toBe(all.length);
});

test('ExcelExporter: three differences or fewer show without Show all', async ({ page }) => {
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'scenario-unit-price-volume.json');
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('#rowGroups input[type=text]')].find(i => i.value === 'Unit Price');
    label.closest('tr').querySelectorAll('input[type=checkbox]')[1].click();
  });
  await expect(visibleLines(page)).toHaveCount(1);
  await expect(page.locator('#differencesPanel button.differences-toggle')).toHaveCount(0);
  await expect(page.locator('#differencesPanel button.differences-close')).toBeVisible();
});

// ---- picking a .fmide on an iPhone or iPad ----
const IPAD_SAFARI = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const PICKERS = {
  fmIDE: ['#fileInputDocument', '#fileInputWorkspace', '#fileInputSystem'],
  ExcelExporter: ['#fileInput'],
  fmGraph: ['#fileInput'],
};
async function accepts(page, app){
  await openApp(page, app);
  await page.waitForFunction(() => document.readyState === 'complete');
  const out = {};
  for(const sel of PICKERS[app]) out[sel] = await page.locator(sel).getAttribute('accept');
  return out;
}

test.describe('on an iPad (Safari calls itself an iPad)', () => {
  test.use({ userAgent: IPAD_SAFARI, hasTouch: true });
  test('every file box that takes a .fmide accepts any file', async ({ page }) => {
    for(const app of Object.keys(PICKERS)){
      for(const [sel, accept] of Object.entries(await accepts(page, app))) expect(accept, app + ' ' + sel).toBeNull();
    }
  });
});

test.describe('on an iPad asking for the desktop site (a Mac with touch)', () => {
  test.use({ userAgent: MAC_SAFARI, hasTouch: true });
  test('every file box that takes a .fmide accepts any file, and a .fmide still opens', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' });
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 });
    });
    for(const app of Object.keys(PICKERS)){
      for(const [sel, accept] of Object.entries(await accepts(page, app))) expect(accept, app + ' ' + sel).toBeNull();
    }
    // Open… through the file box (no showOpenFilePicker in Safari) opens a .fmide.
    await F.openFmIDE(page);
    await page.evaluate(() => { fm.renameCanvas(fm.canvases()[0].id, 'From the iPad'); });
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    const file = testInfo.outputPath('model.fmide');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
    await page.evaluate(() => { fm.renameCanvas(fm.canvases()[0].id, 'Changed'); window.showOpenFilePicker = undefined; });
    await page.evaluate(() => fm.command('openDocument'));
    // The change isn't saved: Don't save, then the file box.
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'),
      page.locator('#saveChangesDialog button', { hasText: /^Don.t save$/ }).click()]);
    await chooser.setFiles(file);
    await expect.poll(() => page.evaluate(() => fm.canvases()[0].name)).toBe('From the iPad');
  });
});

test('on a desktop browser the file boxes keep their list of file types', async ({ page }) => {
  expect(await accepts(page, 'fmIDE')).toEqual({
    '#fileInputDocument': '.fmide,application/json,.json',
    '#fileInputWorkspace': 'application/json,.json',
    '#fileInputSystem': 'application/json,.json',
  });
  expect(await accepts(page, 'ExcelExporter')).toEqual({ '#fileInput': 'application/json,.json,.fmide' });
  expect(await accepts(page, 'fmGraph')).toEqual({ '#fileInput': '.fmide,application/json,.json' });
});
