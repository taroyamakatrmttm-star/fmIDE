// 62. Recipes within a recipe (fmIDE, the pack checker): a recipe's part may be another
// recipe, built in its place — its own parts, in order, as deep as eight recipes. A recipe
// that contains itself is a loop: it can't be saved that way, and from a file that part is
// skipped with a warning. Skipping and "already here" count the canvases built; packs bring
// the recipes inside with their parts, and the checker checks them.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, ROOT, ORIGIN } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { checkPack } = require('../tools/check-pack');

// templates-v2.json: Income Statement v1 (Net Income 40, plug "to Net Income"); Balance Sheet
// v1 and v2 (Retained Earnings ← "to Net Income", Cash balance ← "to Cash"); Cash Flow v1
// (Cash 25, plug "to Cash").
const LIBRARY = fixture('formats', 'templates-v2.json');
const picker = (page) => page.locator('.modal-box.template-box');
const saveRecipe = (page, args) => page.evaluate((a) => { try{ return fm.saveRecipe(a); }catch(e){ return 'Error: ' + e.message; } }, args);
const build = (page, ref) => page.evaluate((r) => { try{ return fm.insertTemplate(r); }catch(e){ return 'Error: ' + e.message; } }, ref);
// The canvases after the one the page starts with.
const canvasNames = (page) => page.evaluate(() => fm.canvases().slice(1).map(c => c.name));
const valueOn = (page, canvas, name) => page.evaluate(([c, n]) => { fm.switchCanvas(c); return fm.getValue({ node: n }); }, [canvas, name]);
async function messageText(page){
  const box = page.locator('.modal-box', { has: page.locator('.modal-actions button', { hasText: /^OK$/ }) }).last();
  await expect(box).toBeVisible();
  return (await box.locator('p').first().textContent()) || '';
}

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', LIBRARY);
  await F.dismissMessage(page);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  expect(await saveRecipe(page, { name: 'Two Statements', parts: ['Income Statement', 'Balance Sheet@2'] })).toBe('Two Statements@1');
  expect(await saveRecipe(page, { name: 'Full Model', parts: ['Two Statements', 'Cash Flow'] })).toBe('Full Model@1');
});

test('a recipe inside a recipe is built in its place: one canvas per canvas template, wired by plugs and sockets; one undo', async ({ page }) => {
  const r = await build(page, { template: 'Full Model', mode: 'add' });
  expect(r.warnings).toEqual([]);
  expect(r.canvases.length).toBe(3);
  expect(r.unfedSockets).toEqual([]);
  expect(await canvasNames(page)).toEqual(['Income Statement', 'Balance Sheet', 'Cash Flow']);
  const cs = await page.evaluate(() => fm.canvases());
  expect(cs[2].template).toMatchObject({ family: 'fam-balance-sheet', version: 2 });
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(40);
  expect(await valueOn(page, 'Balance Sheet', 'Cash balance')).toBe(25);
  await page.evaluate(() => fm.command('undo'));
  expect(await canvasNames(page)).toEqual([]);
});

test('the Templates window lists the canvases a recipe inside builds; the socket check covers them; Build shows the summary', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Full Model' }).click();
  const parts = picker(page).locator('.recipe-detail-parts');
  await expect(parts.locator('> li')).toHaveCount(2);
  await expect(parts.locator('> li').first()).toContainText('✓ Two Statements (recipe) @latest (v1) — builds 2 canvases:');
  await expect(parts.locator('.recipe-detail-subparts > li')).toHaveText(['✓ Income Statement @latest (v1)', '✓ Balance Sheet v2']);
  await expect(parts.locator('> li').nth(1)).toHaveText('✓ Cash Flow @latest (v1)');
  // Cash Flow feeds "to Cash": nothing left unfed.
  await expect(picker(page).locator('.recipe-check')).toHaveText('Every socket is fed by a plug in these parts.');
  await picker(page).locator('button.recipe-build').click();
  expect(await messageText(page)).toBe('Built Full Model: 3 canvases.');
});

test('parts already here: the canvases inside are offered to skip (ticked) and skipped; skip numbers count the canvases built', async ({ page }) => {
  await build(page, { template: 'Two Statements', mode: 'add' });
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Full Model' }).click();
  const skips = picker(page).locator('.recipe-detail-subparts .recipe-part-skip');
  await expect(skips).toHaveCount(2);
  await expect(skips.first()).toContainText('Skip — already here as canvas “Income Statement”');
  for(const box of await skips.locator('input').all()) await expect(box).toBeChecked();
  await picker(page).locator('button.recipe-build').click();
  expect(await messageText(page)).toBe('Built Full Model: 1 canvas.\nSkipped Income Statement — already here as canvas “Income Statement”.\nSkipped Balance Sheet — already here as canvas “Balance Sheet”.');
  await F.dismissMessage(page);
  expect(await canvasNames(page)).toEqual(['Income Statement', 'Balance Sheet', 'Cash Flow']);
  // fm.insertTemplate: skip [3] is the third canvas built (Cash Flow); skipExisting the ones here.
  await page.evaluate(() => fm.clearAll());
  const r = await build(page, { template: 'Full Model', mode: 'add', skip: [3] });
  expect(r.canvases.length).toBe(2);
  expect(r.skipped).toEqual(['Skipped Cash Flow.']);
  const again = await build(page, { template: 'Full Model', mode: 'add', skipExisting: true });
  expect(again.canvases.length).toBe(1);
  expect(await canvasNames(page)).toEqual(['Income Statement', 'Balance Sheet', 'Cash Flow']);
});

test('a loop can\'t be saved; one from a file is skipped with a warning and the rest is built', async ({ page }, testInfo) => {
  expect(await saveRecipe(page, { newVersionOf: 'Two Statements', parts: ['Full Model'] }))
    .toMatch(/^Error: A part of the new version contains "Two Statements" itself, which would make a loop/);
  expect(await saveRecipe(page, { newVersionOf: 'Full Model', parts: ['Full Model'] })).toMatch(/would make a loop/);
  // A templates file whose two recipes contain each other (made by hand).
  const file = testInfo.outputPath('loop.json');
  fs.writeFileSync(file, JSON.stringify({ version: 3, kind: 'fmIDE-templates', templates: [
    { name: 'Loop A', kind: 'recipe', family: 'fam-loop-aaaa', version: 1, note: '', versionId: 'vid-loop-a-1',
      data: { kind: 'recipe', parts: [{ family: 'fam-cash-flow', version: 'latest', name: 'Cash Flow' }, { family: 'fam-loop-bbbb', version: 'latest', name: 'Loop B' }] } },
    { name: 'Loop B', kind: 'recipe', family: 'fam-loop-bbbb', version: 1, note: '', versionId: 'vid-loop-b-1',
      data: { kind: 'recipe', parts: [{ family: 'fam-loop-aaaa', version: 'latest', name: 'Loop A' }] } },
  ] }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file);
  await F.dismissMessage(page);
  await picker(page).locator('.template-list button.template-family', { hasText: 'Loop A' }).click();
  await expect(picker(page).locator('.recipe-detail-subparts > li')).toHaveText(['⚠ Loop A (recipe) — it contains itself, so it can\'t be built']);
  await expect(picker(page).locator('.recipe-detail-parts > li').nth(1)).toContainText('⚠ Loop B (recipe) @latest (v1) — builds 0 canvases:');
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  const r = await build(page, { template: 'Loop A', mode: 'add' });
  expect(r.canvases.length).toBe(1);
  expect(r.warnings).toEqual(['Skipped Loop A (recipe) — it contains itself, so it can\'t be built.']);
});

test('the recipe window offers recipes as parts, never one that leads back to the recipe', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  // A new recipe: both recipes are offered.
  await picker(page).locator('button.template-new-recipe').click();
  const ed = page.locator('.modal-box.recipe-editor');
  await ed.locator('.recipe-name').fill('Bigger');
  await ed.locator('button.recipe-add-part').click();
  const options = await ed.locator('.recipe-part-family').first().locator('option').allTextContents();
  expect(options).toEqual(expect.arrayContaining(['Two Statements (recipe)', 'Full Model (recipe)', 'Income Statement']));
  await ed.locator('.recipe-part-family').first().selectOption({ label: 'Full Model (recipe)' });
  await expect(ed.locator('.recipe-part-state').first()).toHaveAttribute('title', /Full Model \(recipe\) @latest \(v1\) — builds 3 canvases/);
  await ed.locator('.modal-actions button.primary').click();
  const made = await build(page, { template: 'Bigger', mode: 'add' });
  expect(made.canvases.length).toBe(3); // a recipe two deep
  await page.evaluate(() => fm.command('undo'));
  // A new version of Two Statements: neither itself nor Full Model (which contains it).
  await picker(page).locator('.template-list button.template-family', { hasText: 'Two Statements' }).click();
  await picker(page).locator('button.recipe-edit').click();
  const ed2 = page.locator('.modal-box.recipe-editor').last();
  const offered = await ed2.locator('.recipe-part-family').first().locator('option').allTextContents();
  expect(offered).not.toContain('Two Statements (recipe)');
  expect(offered).not.toContain('Full Model (recipe)');
  expect(offered).not.toContain('Bigger (recipe)');
});

test('a pack brings the recipes inside and their parts; it opens and builds elsewhere; the checker passes it and finds a loop', async ({ page, browser }) => {
  const pack = await page.evaluate(() => fm.saveLibraryPack({ title: 'Nested', author: 'Ann Example', templates: ['Full Model'], download: false }));
  expect(pack.templates.map(t => `${t.name}@${t.version}:${t.kind}`)).toEqual(['Full Model@1:recipe', 'Two Statements@1:recipe', 'Income Statement@1:module', 'Balance Sheet@2:module', 'Cash Flow@1:module']);
  const report = checkPack(JSON.stringify(pack), 'nested.fmide-pack.json');
  expect(report.errors).toEqual([]);
  expect(report.ok).toBe(true);
  expect(report.counts).toEqual({ templates: 3, recipes: 2, functions: 0 });
  // Somewhere else: ticking Full Model alone brings what it needs, and it builds.
  const context = await browser.newContext();
  await context.route('**/*', (route) => route.request().url() === ORIGIN + 'fmIDE.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html')) })
    : route.abort('blockedbyclient'));
  const other = await context.newPage();
  await F.openFmIDE(other);
  const preview = await other.evaluate((file) => fm.previewLibraryPack(file), pack);
  const full = preview.items.find(it => it.name === 'Full Model');
  expect(full.needs.length).toBe(2); // Two Statements and Cash Flow; Two Statements brings its own
  await other.evaluate(([file, key]) => fm.openLibraryPack({ file, items: [key] }), [pack, full.key]);
  const r = await other.evaluate(() => fm.insertTemplate({ template: 'Full Model', mode: 'add' }));
  expect(r.canvases.length).toBe(3);
  await context.close();
  // The checker: a loop, and a part that is a system template.
  const loop = JSON.parse(JSON.stringify(pack));
  const two = loop.templates.find(t => t.name === 'Two Statements');
  two.data.parts.push({ family: loop.templates[0].family, version: 'latest', name: 'Full Model' });
  const bad = checkPack(JSON.stringify(loop), 'loop.fmide-pack.json');
  expect(bad.ok).toBe(false);
  expect(bad.errors.map(e => e.message)).toEqual(expect.arrayContaining(['The recipe contains itself, through the recipes inside it; fmIDE can\'t build it.']));
});
