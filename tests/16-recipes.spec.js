// 16. Recipes — a recipe template lists canvas templates, each @latest or pinned to a version.
// Building it adds one canvas per part (each linked to its template); plugs and sockets then
// connect them by name. Sockets nothing feeds are listed as a warning.
const fs = require('fs');
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

// templates-v2.json (a version 2 templates file): Income Statement v1 (Net Income 40, plug
// "to Net Income"); Balance Sheet v1 (Opening RE) and v2 (Retained Earnings ← socket
// "to Net Income", Cash balance ← socket "to Cash"); Cash Flow v1 (Cash 25, plug "to Cash").
const LIBRARY = fixture('formats', 'templates-v2.json');
const picker = (page) => page.locator('.modal-box.template-box');
const editor = (page) => page.locator('.modal-box.recipe-editor');
const closeTemplates = (page) => picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
const canvasNames = (page) => page.evaluate(() => fm.canvases().map(c => c.name));
const valueOn = (page, canvas, name) => page.evaluate(([c, n]) => { fm.switchCanvas(c); return fm.getValue({ node: n }); }, [canvas, name]);
async function messageText(page){
  const box = page.locator('.modal-box', { has: page.locator('.modal-actions button', { hasText: /^OK$/ }) }).last();
  await expect(box).toBeVisible();
  return (await box.locator('p').first().textContent()) || '';
}
async function importFile(page, path){
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  const text = await messageText(page);
  await F.dismissMessage(page);
  await closeTemplates(page);
  return text;
}
async function library(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  return data;
}
const saveRecipe = (page, args) => page.evaluate((a) => { try{ return fm.saveRecipe(a); }catch(e){ return 'Error: ' + e.message; } }, args);
const build = (page, ref) => page.evaluate((r) => { try{ return fm.insertTemplate(r); }catch(e){ return 'Error: ' + e.message; } }, ref);
// A templates file holding one hand-made recipe (and nothing else).
function recipeFile(testInfo, name, parts){
  const path = testInfo.outputPath(name.replace(/\W+/g, '-') + '.json');
  fs.writeFileSync(path, JSON.stringify({ version: 3, kind: 'fmIDE-templates', templates: [
    { name, kind: 'recipe', family: 'fam-recipe-' + name.replace(/\W+/g, '').toLowerCase().padEnd(4, 'x'), version: 1, note: '', versionId: 'vid-recipe-1',
      data: { kind: 'recipe', parts } }] }));
  return path;
}

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await page.evaluate(() => fm.clearAll());
  expect(await importFile(page, LIBRARY)).toBe('Imported 4 templates.');
});

test('saveRecipe saves a recipe; the Templates window shows its parts and the socket check', async ({ page }) => {
  expect(await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement@latest', 'Balance Sheet@2'], group: 'Statements', note: 'first' })).toBe('Three Statements@1');
  const recipe = (await library(page)).templates.find(t => t.kind === 'recipe');
  expect(recipe).toMatchObject({ name: 'Three Statements', version: 1, note: 'first', group: 'Statements' });
  expect(recipe.data.parts).toEqual([
    { family: 'fam-income-statement', version: 'latest', name: 'Income Statement' },
    { family: 'fam-balance-sheet', version: 2, versionId: 'vid-balance-v2', name: 'Balance Sheet' }]);
  await page.evaluate(() => fm.command('openTemplates'));
  const entry = picker(page).locator('.template-list button.template-family', { hasText: 'Three Statements' });
  await expect(entry.locator('.kind-tag')).toHaveText('recipe');
  await entry.click();
  await expect(picker(page).locator('.recipe-detail-parts li')).toHaveText(['✓ Income Statement @latest (v1)', '✓ Balance Sheet v2']);
  await expect(picker(page).locator('.recipe-check')).toHaveText('Sockets nothing feeds: “to Cash” (Balance Sheet).');
  // Names are unique: saving another under the same name fails and makes no version.
  expect(await saveRecipe(page, { name: 'three statements', parts: ['Cash Flow'] }))
    .toBe('Error: There is already a template called "Three Statements". Choose another name, or use newVersionOf to save its next version.');
});

test('building adds a linked canvas per part, wires plugs to sockets, warns about unfed sockets; Undo removes it all', async ({ page }) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement@latest', 'Balance Sheet@2'] });
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Three Statements' }).click();
  await picker(page).locator('button.recipe-build').click();
  expect(await messageText(page)).toBe('Built Three Statements: 2 canvases.\nSockets nothing feeds: “to Cash” (Balance Sheet).');
  await F.dismissMessage(page);
  expect(await canvasNames(page)).toEqual(['Canvas 1', 'Income Statement', 'Balance Sheet']);
  const cs = await page.evaluate(() => fm.canvases());
  expect(cs[1].template).toMatchObject({ family: 'fam-income-statement', version: 1 });
  expect(cs[2].template).toMatchObject({ family: 'fam-balance-sheet', version: 2 });
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(40);
  await page.evaluate(() => fm.command('undo'));
  expect(await canvasNames(page)).toEqual(['Canvas 1']);
});

test('a new version with Cash Flow feeds every socket', async ({ page }) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] });
  expect(await saveRecipe(page, { newVersionOf: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2', 'Cash Flow@latest'], note: 'cash added' })).toBe('Three Statements@2');
  const r = await build(page, 'Three Statements');
  expect(r.warnings).toEqual([]);
  expect(r.unfedSockets).toEqual([]);
  expect(r.canvases).toHaveLength(3);
  expect(await valueOn(page, 'Balance Sheet', 'Cash balance')).toBe(25);
  // The older version is still there to build.
  const r1 = await build(page, 'Three Statements@1');
  expect(r1.unfedSockets).toEqual([]);   // the Cash Flow canvas from the first build feeds it now
});

test('@latest follows the library; a pinned version stays put', async ({ page }, testInfo) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement@latest', 'Balance Sheet@1'] });
  // Income Statement v2 arrives (Net Income 50).
  const lib = readFixture('formats', 'templates-v2.json');
  const v2 = Object.assign({}, lib.templates[0], { version: 2, versionId: 'vid-income-v2', note: 'higher' });
  v2.data = JSON.parse(JSON.stringify(v2.data)); v2.data.nodes[0].text = 'Net Income\n50';
  const path = testInfo.outputPath('income-v2.json');
  fs.writeFileSync(path, JSON.stringify({ version: 2, kind: 'fmIDE-templates', templates: [v2] }));
  expect(await importFile(page, path)).toBe('Imported 1 template.');
  const r = await build(page, 'Three Statements');
  const cs = await page.evaluate(() => fm.canvases());
  expect(cs.find(c => c.id === r.canvases[0]).template.version).toBe(2);
  expect(cs.find(c => c.id === r.canvases[1]).template.version).toBe(1);
  expect(await valueOn(page, 'Income Statement', 'Net Income')).toBe(50);
});

test('a pinned version that differs from the one recorded: warns and builds with yours', async ({ page }, testInfo) => {
  const path = recipeFile(testInfo, 'Shared recipe', [
    { family: 'fam-balance-sheet', version: 2, versionId: 'someone-elses-balance-v2', name: 'Balance Sheet' },
    { family: 'fam-income-statement', version: 'latest', name: 'Income Statement' }]);
  expect(await importFile(page, path)).toBe('Imported 1 template.');
  const r = await build(page, 'Shared recipe');
  expect(r.warnings).toEqual(["Balance Sheet v2 in your library isn't the one this recipe was made with — built with yours."]);
  expect(r.canvases).toHaveLength(2);
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(40);
});

test('a missing version or family is skipped with a warning; the rest is built', async ({ page }, testInfo) => {
  const path = recipeFile(testInfo, 'Partial recipe', [
    { family: 'fam-balance-sheet', version: 7, versionId: 'vid-balance-v7', name: 'Balance Sheet' },
    { family: 'fam-not-here-at-all', version: 'latest', name: 'Debt Schedule' },
    { family: 'fam-cash-flow', version: 'latest', name: 'Cash Flow' }]);
  await importFile(page, path);
  const r = await build(page, 'Partial recipe');
  expect(r.warnings).toEqual(['Skipped Balance Sheet v7 — not in your library.', 'Skipped Debt Schedule @latest — not in your library.']);
  expect(r.canvases).toHaveLength(1);
  expect(await canvasNames(page)).toEqual(['Canvas 1', 'Cash Flow']);
  // Nothing at all to build: an error, and nothing changes.
  const none = recipeFile(testInfo, 'Empty recipe', [{ family: 'fam-not-here-at-all', version: 'latest', name: 'Debt Schedule' }]);
  await importFile(page, none);
  expect(await build(page, 'Empty recipe')).toBe('Error: Nothing to build: none of the parts of "Empty recipe" is in your library.');
  expect(await canvasNames(page)).toEqual(['Canvas 1', 'Cash Flow']);
});

test('the recipe editor: parts, versions, order, the live check; a taken name asks; Edit as new version', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('button.template-new-recipe').click();
  await editor(page).locator('input.recipe-name').fill('Statements');
  await editor(page).locator('input.recipe-note').fill('made by hand');
  const add = editor(page).locator('button.recipe-add-part');
  await add.click(); await add.click();
  const rows = editor(page).locator('.recipe-part');
  await expect(rows).toHaveCount(2);
  await rows.nth(0).locator('select.recipe-part-family').selectOption({ label: 'Balance Sheet' });
  await rows.nth(0).locator('select.recipe-part-version').selectOption('2');
  await rows.nth(1).locator('select.recipe-part-family').selectOption({ label: 'Income Statement' });
  await expect(editor(page).locator('.recipe-check')).toHaveText('Sockets nothing feeds: “to Cash” (Balance Sheet).');
  await add.click();
  await rows.nth(2).locator('select.recipe-part-family').selectOption({ label: 'Cash Flow' });
  await expect(editor(page).locator('.recipe-check')).toHaveText('Every socket is fed by a plug in these parts.');
  await rows.nth(1).locator('button.recipe-up').click();   // Income Statement first
  await rows.nth(2).locator('button.recipe-remove').click();
  await expect(rows).toHaveCount(2);
  await editor(page).locator('.modal-actions button.primary', { hasText: 'Save Recipe' }).click();
  await expect(editor(page)).toHaveCount(0);
  let recipes = (await library(page)).templates.filter(t => t.kind === 'recipe');
  expect(recipes.map(t => [t.name, t.version, t.note])).toEqual([['Statements', 1, 'made by hand']]);
  expect(recipes[0].data.parts.map(p => [p.name, p.version])).toEqual([['Income Statement', 'latest'], ['Balance Sheet', 2]]);
  // Edit as new version: v2 with Cash Flow added.
  await picker(page).locator('button.recipe-edit').click();
  await add.click();
  await editor(page).locator('.recipe-part').nth(2).locator('select.recipe-part-family').selectOption({ label: 'Cash Flow' });
  await editor(page).locator('input.recipe-note').fill('cash');
  await editor(page).locator('.modal-actions button.primary', { hasText: 'Save version 2' }).click();
  await expect(picker(page).locator('.template-version-info')).toHaveText('Version 2 of 2 — cash');
  // A new recipe under a name in use asks first.
  await picker(page).locator('button.template-new-recipe').click();
  await editor(page).locator('input.recipe-name').fill('statements');
  await add.click();
  await editor(page).locator('.modal-actions button.primary', { hasText: 'Save Recipe' }).click();
  await expect(page.locator('.modal-box.template-name-taken p')).toContainText('There is already a template called "Statements" (version 2).');
  await page.locator('.modal-box.template-name-taken button', { hasText: 'Choose another name' }).click();
  await expect(editor(page)).toBeVisible();
  recipes = (await library(page)).templates.filter(t => t.kind === 'recipe');
  expect(recipes.map(t => t.version)).toEqual([1, 2]);
});

test('recipes travel in templates files and the autosave; bad ones are skipped; names are text', async ({ page }, testInfo) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] });
  await page.evaluate(() => fm.command('openTemplates'));
  const [dl] = await Promise.all([page.waitForEvent('download'), picker(page).locator('button', { hasText: '⇩ Export Templates' }).click()]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  await closeTemplates(page);
  expect(exported.version).toBe(6);
  expect(exported.templates.find(t => t.kind === 'recipe').name).toBe('Three Statements');
  // After a reload the recipe is still there and builds.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  expect((await build(page, 'Three Statements')).canvases).toHaveLength(2);
  // From a file: a recipe with no valid parts is skipped; a hostile part name shows as text.
  const path = testInfo.outputPath('odd-recipes.json');
  fs.writeFileSync(path, JSON.stringify({ version: 3, kind: 'fmIDE-templates', templates: [
    { name: 'Broken', kind: 'recipe', family: 'fam-broken-recipe', version: 1, versionId: 'vid-broken-1', data: { kind: 'recipe', parts: [{ family: '<b>', version: 'x' }] } },
    { name: 'Hostile', kind: 'recipe', family: 'fam-hostile-recipe', version: 1, versionId: 'vid-hostile-1', data: { kind: 'recipe', parts: [
      { family: 'fam-missing-part', version: 'latest', name: '<img src=x onerror="window.__pwned=1">' }] } }] }));
  expect(await importFile(page, path)).toBe('Imported 1 template.');
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Hostile' }).click();
  await expect(picker(page).locator('.recipe-detail-parts li')).toHaveText(['⚠ <img src=x onerror="window.__pwned=1"> @latest — not in your library']);
  await expect(picker(page).locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('saved workspaces are version 6; a version 7 workspace asks first', async ({ page }, testInfo) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement'] });
  const ws = await library(page);
  expect(ws.version).toBe(6);
  ws.version = 7;
  const path = testInfo.outputPath('newer.json');
  fs.writeFileSync(path, JSON.stringify(ws));
  await F.importViaCommand(page, 'importWorkspace', path);
  expect(await F.dialogText(page)).toMatch(/^This workspace was saved by a newer version of fmIDE \(format version 7; this fmIDE reads up to version 6\)/);
});

test('a macro records building a recipe', async ({ page }) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] });
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Three Statements' }).click();
  await picker(page).locator('button.recipe-build').click();
  await F.dismissMessage(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const steps = data.macros[data.macros.length - 1].steps.filter(s => s.action === 'insertTemplate');
  expect(steps.map(s => s.args)).toEqual([{ template: 'Three Statements', mode: 'add' }]);
});

// ---------- the same plug twice ----------
test('building next to a canvas that already has the plug: warns, and the socket shows ×2', async ({ page }) => {
  await saveRecipe(page, { name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] });
  await page.evaluate(() => fm.insertTemplate('Income Statement', 'newCanvas'));   // already in the model
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Three Statements' }).click();
  // Income Statement is already here, so it is offered as Skip (ticked): add it anyway.
  await picker(page).locator('.recipe-part-skip input').uncheck();
  await picker(page).locator('button.recipe-build').click();
  expect(await messageText(page)).toBe('Built Three Statements: 2 canvases.\n'
    + 'Sockets nothing feeds: “to Cash” (Balance Sheet).\n'
    + 'Sockets fed by more than one plug (their values are added): “to Net Income” (Balance Sheet) ← Income Statement::Net Income, Income Statement::Net Income.');
  await F.dismissMessage(page);
  // Both Net Incomes (40 each) feed Retained Earnings.
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(80);
  const chip = page.locator('.node .socket-chip', { hasText: 'to Net Income' });
  await expect(chip).toHaveText('⚡ to Net Income ×2');
  await expect(chip).toHaveClass(/multi/);
  await expect(chip).toHaveAttribute('title', 'Fed by 2 plugs, added together: Income Statement::Net Income, Income Statement::Net Income. If one was added by mistake, remove its plug.');
  // Remove one of them: one plug left, no warning.
  await page.evaluate(() => { const c = fm.canvases().find(x => x.name === 'Income Statement'); fm.deleteCanvas(c.id); fm.switchCanvas('Balance Sheet'); });
  await expect(chip).toHaveText('⚡ to Net Income');
  await expect(chip).not.toHaveClass(/multi/);
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(40);
});

test('the recipe check lists a socket that two parts plug into', async ({ page }) => {
  await saveRecipe(page, { name: 'Doubled', parts: ['Income Statement', 'Income Statement@1', 'Balance Sheet@2', 'Cash Flow'] });
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Doubled' }).click();
  await expect(picker(page).locator('.recipe-check')).toHaveText(
    'Sockets fed by more than one plug (their values are added): “to Net Income” (Balance Sheet) ← Income Statement::Net Income, Income Statement::Net Income.');
  await expect(picker(page).locator('.recipe-check')).toHaveClass(/warn/);
  await closeTemplates(page);
  const r = await build(page, 'Doubled');
  expect(r.multiFedSockets).toEqual([{ canvas: 'Balance Sheet', socket: 'to Net Income', sources: ['Income Statement::Net Income', 'Income Statement::Net Income'] }]);
});

// Two recipes sharing a part: the second offers to skip the part already here (ticked by
// default), so its canvas isn't added twice; the shared canvas still feeds the new sockets.
test('a part already here is offered as "Skip" (ticked) and not added again; unticked, it is', async ({ page }) => {
  expect(await saveRecipe(page, { name: 'Income only', parts: ['Income Statement@latest'] })).toBe('Income only@1');
  expect(await saveRecipe(page, { name: 'Income and BS', parts: ['Income Statement@latest', 'Balance Sheet@2'] })).toBe('Income and BS@1');
  const first = await build(page, { template: 'Income only', mode: 'add' });
  expect(first.canvases.length).toBe(1);
  const before = await canvasNames(page);
  // The window: the shared part shows a ticked Skip; Build adds only the Balance Sheet.
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Income and BS' }).click();
  const skip = picker(page).locator('.recipe-part-skip');
  await expect(skip).toHaveCount(1);
  await expect(skip).toContainText('Skip — already here as canvas “Income Statement”');
  await expect(skip.locator('input')).toBeChecked();
  await picker(page).locator('button.recipe-build').click();
  expect(await messageText(page)).toContain('Skipped Income Statement — already here as canvas “Income Statement”.');
  await F.dismissMessage(page);
  const after = await canvasNames(page);
  expect(after.length).toBe(before.length + 1);
  expect(after.filter(n => /^Income Statement/.test(n)).length).toBe(1);
  // The existing Income Statement feeds the new Balance Sheet's "to Net Income" socket.
  expect(await valueOn(page, 'Balance Sheet', 'Retained Earnings')).toBe(40);
  // Unticked: the part is added again.
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Income and BS' }).click();
  await picker(page).locator('.recipe-part-skip input').first().uncheck();
  await picker(page).locator('button.recipe-build').click();
  await F.dismissMessage(page);
  expect((await canvasNames(page)).filter(n => /^Income Statement/.test(n)).length).toBe(2);
});

test('fm.insertTemplate skips only when asked: skip (part numbers) and skipExisting', async ({ page }) => {
  expect(await saveRecipe(page, { name: 'Income only', parts: ['Income Statement@latest'] })).toBe('Income only@1');
  await build(page, { template: 'Income only', mode: 'add' });
  // As before: without either option, the part is added again.
  expect((await build(page, { template: 'Income only', mode: 'add' })).canvases.length).toBe(1);
  // skipExisting: nothing new, and it says what was skipped.
  const r = await build(page, { template: 'Income only', mode: 'add', skipExisting: true });
  expect(r.canvases).toEqual([]);
  expect(r.skipped).toEqual(['Skipped Income Statement — already here as canvas “Income Statement”.']);
  // skip by part number.
  expect((await build(page, { template: 'Income only', mode: 'add', skip: [1] })).canvases).toEqual([]);
  expect(await build(page, { template: 'Income only', mode: 'add', skip: { part: 1 } })).toBe('Error: skip must be a list of part numbers, e.g. [2].');
});
