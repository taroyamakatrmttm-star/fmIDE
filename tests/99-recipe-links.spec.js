// 99. A recipe's links (fmIDE, the pack checker; templates v11, workspace v15, pack v5): a
// recipe can feed an input rectangle of one part from a rectangle of another, though neither
// template knows the other. Building draws each link as an ordinary alias and arrow, marked
// `recipeLink`, between the canvases of that same build only — a recipe built twice gives two
// separate pairs — and updating a canvas draws its links again from the same source canvas.
// The calculation sees an ordinary alias; the canvas has no "changes of its own" for it, and
// a canvas template saved from the canvas leaves it out.
const fs = require('fs');
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { checkPack } = require('../tools/check-pack');

// Revenue v1: Units 10 × Price 5 → Total revenue (50); v2 takes a Discount 10 off (40); v3
// renames the total "Sales total". Accounts Receivable v1: Sales 100 (input) × Unpaid share
// 0.25 → Accounts receivable; v2: a half share. The recipe Working Capital (Revenue v1,
// Accounts Receivable v1) links Accounts Receivable · Sales ← Revenue · Total revenue; Broken
// Links holds three links that can't be drawn.
const LIBRARY = fixture('recipe-links', 'templates.json');
const picker = (page) => page.locator('.modal-box.template-box');
const editor = (page) => page.locator('.modal-box.recipe-editor');
const updateBox = (page) => page.locator('.modal-box.template-update-box');
const run = (page, fn, arg) => page.evaluate(([f, a]) => { try{ return fm[f](a); }catch(e){ return 'Error: ' + e.message; } }, [fn, arg]);
const build = (page, ref) => run(page, 'insertTemplate', typeof ref === 'string' ? { template: ref, mode: 'add' } : ref);
const valueOn = (page, canvasId, name) => page.evaluate(([c, n]) => { fm.switchCanvas('#' + c); return fm.getValue({ node: n }); }, [canvasId, name]);
const setOn = (page, canvasId, name, value) => page.evaluate(([c, n, v]) => { fm.switchCanvas('#' + c); fm.setValue({ node: n, value: v }); }, [canvasId, name, value]);
const recipeEdges = (page, canvasId) => page.evaluate((c) => { fm.switchCanvas('#' + c); return fm.edges().filter(e => e.recipeLink).length; }, canvasId);
const ownChangesShown = async (page, canvasId) => {
  await page.evaluate((c) => { fm.switchCanvas('#' + c); fm.command('updateCanvasTemplate'); }, canvasId);
  await expect(updateBox(page)).toBeVisible();
  const n = await updateBox(page).locator('.template-update-warning').count();
  await updateBox(page).locator('.modal-actions button', { hasText: /^Cancel$/ }).click();
  return n > 0;
};

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', LIBRARY);
  await F.dismissMessage(page);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
});

test('building draws the link: Sales takes Total revenue; an ordinary alias the calculation follows; one undo', async ({ page }) => {
  const r = await build(page, 'Working Capital');
  expect(r.warnings).toEqual([]);
  expect(r.links).toBe(1);
  const [rev, ar] = r.parts;
  expect(await valueOn(page, ar, 'Sales')).toBe(50);
  expect(await valueOn(page, ar, 'Accounts receivable')).toBe(12.5);
  expect(await recipeEdges(page, ar)).toBe(1);
  // The alias follows its source like any alias.
  await setOn(page, rev, 'Units', '20');
  expect(await valueOn(page, ar, 'Accounts receivable')).toBe(25);
  // Not "changes of its own" against the template it came from.
  expect(await ownChangesShown(page, ar)).toBe(false);
  await page.evaluate(() => fm.command('undo'));   // the value typed
  expect(await valueOn(page, ar, 'Accounts receivable')).toBe(12.5);
  await page.evaluate(() => fm.command('undo'));   // the build, links and all
  expect(await page.evaluate(() => fm.canvases().length)).toBe(1);
});

test('built twice, each Accounts Receivable is linked only to the Revenue built with it', async ({ page }) => {
  const one = await build(page, 'Working Capital');
  const two = await build(page, 'Working Capital');      // "already here" is not skipped unless asked
  expect(two.canvases.length).toBe(2);
  expect(two.links).toBe(1);
  await setOn(page, two.parts[0], 'Units', '30');        // 150
  expect(await valueOn(page, two.parts[1], 'Sales')).toBe(150);
  expect(await valueOn(page, one.parts[1], 'Sales')).toBe(50);
  await setOn(page, one.parts[0], 'Price', '1');          // 10
  expect(await valueOn(page, one.parts[1], 'Sales')).toBe(10);
  expect(await valueOn(page, two.parts[1], 'Sales')).toBe(150);
});

test('Skip — already here: the link joins the canvas already here', async ({ page }) => {
  const rev = await run(page, 'insertTemplate', { template: 'Revenue@1', mode: 'newCanvas' });
  const r = await build(page, { template: 'Working Capital', mode: 'add', skipExisting: true });
  expect(r.canvases.length).toBe(1);
  expect(r.parts[0]).toBe(rev);
  expect(await valueOn(page, r.parts[1], 'Sales')).toBe(50);
  // Built again with the parts here skipped: Sales is already fed, so nothing is drawn.
  const again = await build(page, { template: 'Working Capital', mode: 'add', skipExisting: true });
  expect(again.canvases).toEqual([]);
  expect(again.warnings).toEqual(['Link not drawn: Accounts Receivable · Sales ← Revenue · Total revenue — “Sales” in canvas “Accounts Receivable” isn\'t an input rectangle (something already feeds it).']);
});

test('updating a canvas keeps its link to the same source canvas; a renamed source drops it and says so', async ({ page }) => {
  const one = await build(page, 'Working Capital');
  const two = await build(page, 'Working Capital');
  await setOn(page, two.parts[0], 'Units', '30');        // the second Revenue: 150
  // The second Accounts Receivable, updated to v2 (a half share): still the second Revenue.
  const u = await page.evaluate((c) => fm.updateCanvasFromTemplate({ canvas: '#' + c, version: '2' }), two.parts[1]);
  expect(u.lostLinks).toEqual([]);
  expect(await valueOn(page, two.parts[1], 'Sales')).toBe(150);
  expect(await valueOn(page, two.parts[1], 'Accounts receivable')).toBe(37.5); // its typed share (0.25) kept
  expect(await recipeEdges(page, two.parts[1])).toBe(1);
  expect(await ownChangesShown(page, two.parts[1])).toBe(false);
  // The first Revenue, updated to v2 (Total revenue kept, by name): its link still holds.
  await page.evaluate((c) => fm.updateCanvasFromTemplate({ canvas: '#' + c, version: '2' }), one.parts[0]);
  expect(await valueOn(page, one.parts[1], 'Sales')).toBe(40);
  // ... and to v3, which has no Total revenue: the link is removed and Sales is an input again.
  const v3 = await page.evaluate((c) => fm.updateCanvasFromTemplate({ canvas: '#' + c, version: '3' }), one.parts[0]);
  expect(v3.lostLinks).toEqual(['Accounts Receivable · Sales ← Revenue']);
  expect(v3.lostAliases).toEqual([]);
  expect(await valueOn(page, one.parts[1], 'Sales')).toBe(100);
  expect(await recipeEdges(page, one.parts[1])).toBe(0);
  expect(await valueOn(page, two.parts[1], 'Sales')).toBe(150);
});

test('links that can\'t be drawn are warnings, never blocks; names from the file are shown as text', async ({ page }) => {
  const r = await build(page, 'Broken Links');
  expect(r.canvases.length).toBe(2);
  expect(r.links).toBe(0);
  expect(r.warnings).toEqual([
    'Link not drawn: Accounts Receivable · Nope <img src=x onerror=alert(1)> ← Revenue · Total revenue — canvas “Accounts Receivable” has no rectangle “Nope <img src=x onerror=alert(1)>”.',
    'Link not drawn: Accounts Receivable · Accounts receivable ← Revenue · Units — “Accounts receivable” in canvas “Accounts Receivable” isn\'t an input rectangle (something already feeds it).',
    'Link not drawn: Accounts Receivable · Unpaid share ← A part · Anything — A part isn\'t built here.'
  ]);
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Broken Links' }).click();
  await expect(picker(page).locator('.recipe-detail-links li').first()).toHaveText('Accounts Receivable · Nope <img src=x onerror=alert(1)> ← Revenue · Total revenue');
  await expect(picker(page).locator('.recipe-check')).toContainText('has no rectangle “Nope <img src=x onerror=alert(1)>”');
  await expect(picker(page).locator('img')).toHaveCount(0);
});

test('the Templates window lists a recipe\'s links; the editor adds one; Build says what it linked', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Working Capital' }).click();
  await expect(picker(page).locator('.recipe-detail-links li')).toHaveText(['Accounts Receivable · Sales ← Revenue · Total revenue']);
  await expect(picker(page).locator('.recipe-check')).toHaveText('Every socket is fed by a plug in these parts.');
  await picker(page).locator('button.recipe-edit').click();
  await expect(editor(page).locator('.recipe-link')).toHaveCount(1);
  // A second link: Unpaid share ← Revenue · Price (the editor offers only input rectangles to feed).
  await editor(page).locator('button.recipe-add-link').click();
  const row = editor(page).locator('.recipe-link').nth(1);
  await row.locator('select.recipe-link-to-template').selectOption({ label: 'Accounts Receivable' });
  await expect(row.locator('select.recipe-link-to-rectangle option')).toHaveText(['Sales', 'Unpaid share']);
  await row.locator('select.recipe-link-to-rectangle').selectOption('Sales');
  await row.locator('select.recipe-link-from-template').selectOption({ label: 'Revenue' });
  await row.locator('select.recipe-link-from-rectangle').selectOption('Price');
  await expect(editor(page).locator('.recipe-check')).toContainText('another link already feeds “Sales”');
  await row.locator('select.recipe-link-to-rectangle').selectOption('Unpaid share');
  await expect(editor(page).locator('.recipe-check')).toHaveText('Every socket is fed by a plug in these parts.');
  await editor(page).locator('.modal-actions button.primary').click();
  await expect(picker(page).locator('.recipe-detail-links li')).toHaveText(['Accounts Receivable · Sales ← Revenue · Total revenue', 'Accounts Receivable · Unpaid share ← Revenue · Price']);
  await picker(page).locator('button.recipe-build').click();
  expect(await F.dialogText(page)).toBe('Built Working Capital: 2 canvases. Linked 2 rectangles.');
  await F.dismissMessage(page);
  const ar = (await page.evaluate(() => fm.canvases()))[2].id;
  expect(await valueOn(page, ar, 'Accounts receivable')).toBe(250);   // 50 × 5
});

test('fm.saveRecipe takes links; a link that won\'t hold fails; a new version keeps them', async ({ page }) => {
  const link = { to: { template: 'Accounts Receivable', rectangle: 'Sales' }, from: { template: 'Revenue', rectangle: 'Total revenue' } };
  expect(await run(page, 'saveRecipe', { name: 'WC Latest', parts: ['Revenue@2', 'Accounts Receivable'], links: [link] })).toBe('WC Latest@1');
  const r = await build(page, 'WC Latest');
  expect(await valueOn(page, r.parts[1], 'Sales')).toBe(40);
  expect(await run(page, 'saveRecipe', { name: 'WC Bad', parts: ['Revenue@3', 'Accounts Receivable'], links: [link] }))
    .toBe('Error: Link Accounts Receivable · Sales ← Revenue · Total revenue: Revenue has no rectangle “Total revenue”.');
  expect(await run(page, 'saveRecipe', { name: 'WC Fed', parts: ['Revenue@2', 'Accounts Receivable'], links: [{ to: { template: 'Accounts Receivable', rectangle: 'Accounts receivable' }, from: link.from }] }))
    .toMatch(/^Error: .*“Accounts receivable” in Accounts Receivable isn't an input rectangle/);
  expect(await run(page, 'saveRecipe', { name: 'WC Odd', parts: ['Revenue@2'], links: [{ to: { template: 'Accounts Receivable', rectangle: 'Sales' }, from: link.from }] }))
    .toBe('Error: Link Accounts Receivable · Sales ← Revenue · Total revenue: Accounts Receivable isn\'t one of its parts.');
  expect(await run(page, 'saveRecipe', { newVersionOf: 'WC Latest', parts: ['Revenue@2', 'Accounts Receivable@2'] })).toBe('WC Latest@2');
  const r2 = await build(page, 'WC Latest@2');
  expect(r2.links).toBe(1);
  expect(await valueOn(page, r2.parts[1], 'Accounts receivable')).toBe(20);
});

test('recipes inside recipes draw their links; a canvas saved as a template leaves the link out', async ({ page }) => {
  expect(await run(page, 'saveRecipe', { name: 'Outer', parts: ['Working Capital'] })).toBe('Outer@1');
  const r = await build(page, 'Outer');
  expect(r.links).toBe(1);
  expect(await valueOn(page, r.parts[1], 'Sales')).toBe(50);
  // Save Accounts Receivable's canvas as its next version: no alias in it, Sales an input.
  await page.evaluate((c) => fm.switchCanvas('#' + c), r.parts[1]);
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Accounts Receivable' }).click();
  await picker(page).locator('button.template-save-version').click();
  await page.locator('.modal-box.template-form button.primary', { hasText: /^Save version \d+$/ }).click();
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  const id = await run(page, 'insertTemplate', { template: 'Accounts Receivable@3', mode: 'newCanvas' });
  expect(await valueOn(page, id, 'Sales')).toBe(100);
  expect(await page.evaluate(() => fm.nodes().filter(n => n.type === 'alias').length)).toBe(0);
});

test('templates file v11 and workspace v15 keep the links', async ({ page }) => {
  const { data } = await F.downloadJson(page, async () => {
    await page.evaluate(() => fm.command('openTemplates'));
    await picker(page).locator('button', { hasText: '⇩ Export Templates' }).click();
  });
  expect(data.version).toBe(11);
  expect(data.templates.find(t => t.name === 'Working Capital').data.links).toEqual(readFixture('recipe-links', 'templates.json').templates[5].data.links);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
  expect(ws.version).toBe(15);
  expect(ws.templates.find(t => t.name === 'Working Capital').data.links).toHaveLength(1);
});

test('a pack v4 (from before recipe links) opens without a question; a pack saved now is v5 with the links', async ({ page }) => {
  const old = readFixture('library', 'pack-v4.json');
  const r = await run(page, 'openLibraryPack', old);
  expect(r.templates.added).toBeGreaterThan(0);
  const saved = await page.evaluate(() => fm.saveLibraryPack({ title: 'Working capital', author: 'Ann Example', templates: ['Working Capital'], download: false }));
  const pack = typeof saved === 'string' ? JSON.parse(saved) : saved;
  expect(pack.version).toBe(5);
  expect(pack.templates.find(t => t.kind === 'recipe').data.links).toHaveLength(1);
  const report = checkPack(JSON.stringify(pack), 'working-capital.fmide-pack.json');
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual([]);
});

// ---- the pack checker (Node) ----
test.describe('the pack checker', () => {
  const GOOD = 'pack-checker-good-1.fmide-pack.json';
  const withLinks = (links) => {
    const pack = readFixture('library', 'check', GOOD);
    pack.version = 5;
    pack.templates.find(t => t.kind === 'recipe').data.links = links;
    return checkPack(JSON.stringify(pack, null, 2), GOOD);
  };
  const IS = 'fam-income-statement', BS = 'fam-balance-sheet';
  test('a recipe\'s links that hold pass', () => {
    const r = withLinks([{ to: { family: BS, rectangle: 'Opening RE' }, from: { family: IS, rectangle: 'Net Income' } }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  test('a link naming a missing rectangle or a template outside the recipe is a warning', () => {
    const r = withLinks([{ to: { family: BS, rectangle: 'Nope' }, from: { family: IS, rectangle: 'Net Income' } },
      { to: { family: BS, rectangle: 'Opening RE' }, from: { family: 'fam-somewhere-else', rectangle: 'X' } }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map(w => w.message)).toEqual(['Its link 1: "Balance Sheet" has no rectangle called "Nope".', 'Its link 2 names a template that isn\'t one of its parts.']);
  });
  test('links fmIDE would drop, or hidden characters, are errors', () => {
    expect(withLinks({}).errors.map(e => e.message)).toContain('Its links aren\'t a list.');
    expect(withLinks([{ to: { family: BS, rectangle: 'Opening RE' } }]).errors.map(e => e.message)).toContain('fmIDE would leave out some of the recipe\'s links (one malformed, one feeding a rectangle another link feeds, or a rectangle feeding itself).');
    expect(withLinks([{ to: { family: BS, rectangle: 'Opening‮RE' }, from: { family: IS, rectangle: 'Net Income' } }]).errors.map(e => e.message).join('\n')).toMatch(/Its link 1 names a rectangle with a hidden character/);
  });
});
