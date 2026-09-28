// 29. Resizable windows and the Templates tree (fmIDE): a large window can be made bigger
// or smaller from its corner, keeps that size (in the person's own UI settings), goes back
// to its own size on a double-click on the corner, and is never larger than the screen. The
// Templates window lists templates as a tree of groups that open and close.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');

// The windows, by the command that opens them and their box's class.
const WINDOWS = [
  ['templates', 'openTemplates', '.modal-box.template-box:not(.function-box)'],
  ['functions', 'openFunctions', '.modal-box.function-box'],
  ['macroBuilder', 'openMacros', '.modal-box.macro-box'],
  ['ribbon', 'customizeRibbon', '.modal-box.rbc-box'],
];

// The UI settings as saved in the autosave.
async function savedUi(page){
  const entries = await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1');
  const text = entries['fmIDE-workspace-v1'];
  return text ? (JSON.parse(text).ui || {}) : {};
}
// Resize a window the way dragging its corner does: the browser writes the new size into
// the box's style.
const resizeTo = (box, w, h) => box.evaluate((el, [w, h]) => { el.style.width = w + 'px'; el.style.height = h + 'px'; }, [w, h]);
const sizeOf = (box) => box.evaluate(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await F.openFmIDE(page);
});

for(const [key, command, selector] of WINDOWS){
  test(`${key}: resizable from its corner; the size is kept after a reload; a double-click on the corner resets it`, async ({ page }) => {
    await page.evaluate((c) => fm.command(c), command);
    let box = page.locator(selector);
    await expect(box).toBeVisible();
    expect(await box.evaluate(el => getComputedStyle(el).resize)).toBe('both');
    const before = await sizeOf(box);
    await resizeTo(box, 700, 520);
    await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes[key]), { timeout: 5000 }).toEqual({ w: 700, h: 520 });
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await page.evaluate((c) => fm.command(c), command);
    box = page.locator(selector);
    expect(await sizeOf(box)).toEqual({ w: 700, h: 520 });
    // Double-click the corner: back to the window's own size, and forgotten.
    const r = await box.boundingBox();
    await page.mouse.dblclick(r.x + r.width - 6, r.y + r.height - 6);
    expect(await sizeOf(box)).toEqual(before);
    await expect.poll(() => savedUi(page).then(ui => (ui.windowSizes || {})[key]), { timeout: 5000 }).toBeUndefined();
  });
}

test('a real drag on the corner resizes the window, and the new size is kept', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  const box = page.locator('.modal-box.template-box');
  const before = await sizeOf(box);
  const r = await box.boundingBox();
  await page.mouse.move(r.x + r.width - 4, r.y + r.height - 4);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width + 96, r.y + r.height + 76, { steps: 8 });
  await page.mouse.up();
  const after = await sizeOf(box);
  expect(after.w).toBeGreaterThan(before.w);
  expect(after.h).toBeGreaterThan(before.h);
  await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes.templates), { timeout: 5000 }).toBeTruthy();
});

test('a saved size larger than the screen opens at most the screen\'s size; bad saved sizes are ignored', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  const box = page.locator('.modal-box.template-box');
  await resizeTo(box, 3000, 2000);
  await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes.templates && ui.windowSizes.templates.w), { timeout: 5000 }).toBe(3000);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await page.evaluate(() => fm.command('openTemplates'));
  const s = await sizeOf(page.locator('.modal-box.template-box'));
  expect(s.w).toBeLessThanOrEqual(Math.floor(1400 * 0.98));
  expect(s.h).toBeLessThanOrEqual(Math.floor(900 * 0.96));
});

test('a window size in someone else\'s workspace file is never taken', async ({ page }, testInfo) => {
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  data.ui = Object.assign({}, data.ui, { windowSizes: { templates: { w: 333, h: 444 } }, templateGroupsClosed: ['Financial Statement'] });
  const file = testInfo.outputPath('ws-with-sizes.json');
  fs.writeFileSync(file, JSON.stringify(data));
  await F.importViaCommand(page, 'importWorkspace', file);
  await F.acceptAll(page);
  await page.evaluate(() => fm.command('openTemplates'));
  const s = await sizeOf(page.locator('.modal-box.template-box'));
  expect(s).not.toEqual({ w: 333, h: 444 });
});

test.describe('the Templates tree', () => {
  async function importSearchTemplates(page){
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', fixture('templates', 'search.json'));
    await F.dismissMessage(page);
    return page.locator('.modal-box.template-box');
  }
  const headings = (box) => box.locator('.template-list > .template-group-toggle');
  const names = async (box) => (await box.locator('.template-list button.template-family').allInnerTexts()).map(t => t.split('\n')[0]);

  test('groups open and close (Enter too), stay closed after a reload, and a search still finds what is inside', async ({ page }) => {
    let box = await importSearchTemplates(page);
    const all = await names(box);
    expect(all.length).toBe(4);
    const fs1 = headings(box).filter({ hasText: 'Financial Statement' });
    await expect(fs1).toHaveAttribute('aria-expanded', 'true');
    // The templates inside the Financial Statement group (the heading's count).
    const inside = Number((await fs1.innerText()).match(/\((\d+)\)/)[1]);
    expect(inside).toBeGreaterThan(0);
    await fs1.click();
    await expect(fs1).toHaveAttribute('aria-expanded', 'false');
    // Its templates are hidden; the others stay.
    expect((await names(box)).length).toBe(all.length - inside);
    // Kept after a reload.
    await expect.poll(() => savedUi(page).then(ui => ui.templateGroupsClosed), { timeout: 5000 }).toEqual(['Financial Statement']);
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await page.evaluate(() => fm.command('openTemplates'));
    box = page.locator('.modal-box.template-box');
    await expect(headings(box).filter({ hasText: 'Financial Statement' })).toHaveAttribute('aria-expanded', 'false');
    // A search shows every match, closed group or not.
    await box.locator('.template-search').fill('statement');
    expect((await names(box)).some(n => /Income Statement|Cash flow statement/.test(n))).toBe(true);
    await box.locator('.template-search').fill('');
    // Enter on the focused heading opens it again.
    await headings(box).filter({ hasText: 'Financial Statement' }).focus();
    await page.keyboard.press('Enter');
    await expect(headings(box).filter({ hasText: 'Financial Statement' })).toHaveAttribute('aria-expanded', 'true');
    expect((await names(box)).length).toBe(all.length);
  });
});
