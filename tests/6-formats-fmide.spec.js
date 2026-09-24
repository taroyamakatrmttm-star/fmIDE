// 6. File formats — fmIDE: current, legacy, newer-version and wrong-kind files.
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

const file = (name) => fixture('formats', name + '.json');
const canvasNames = (page) => page.evaluate(() => fm.canvases().map(c => c.name));

// Give the starting canvas a distinctive name, so a load (or not) is visible.
async function markStart(page){
  await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Before load' }));
  expect(await canvasNames(page)).toEqual(['Before load']);
}

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await markStart(page);
});

for(const name of ['sys-current', 'sys-legacy']){
  test(`${name} loads via Load System`, async ({ page }) => {
    await F.importViaCommand(page, 'loadSystem', file(name));
    const seen = await F.acceptAll(page);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^Load this system\?/);
    expect(await canvasNames(page)).toEqual(['Revenue Model']);
    expect(await page.evaluate(() => fm.nodes().length)).toBeGreaterThan(0);
  });
}

test('sys-newer asks first: Cancel keeps the current canvases, OK opens it', async ({ page }) => {
  await F.importViaCommand(page, 'loadSystem', file('sys-newer'));
  const text = await F.dialogText(page);
  expect(text).toContain('newer version');
  expect(text).toContain('format version 3');
  await F.cancelDialog(page);
  await expect(page.locator('.modal-box')).toHaveCount(0);
  expect(await canvasNames(page)).toEqual(['Before load']);

  await F.importViaCommand(page, 'loadSystem', file('sys-newer'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toContain('format version 3');
  expect(seen[1]).toMatch(/^Load this system\?/);
  expect(await canvasNames(page)).toEqual(['Revenue Model']);
});

const WRONG_KIND = [
  ['loadSystem', 'templates', /^That is an fmIDE templates file, not a system\. Open it with Templates → Import Templates\.$/],
  ['loadModule', 'sys-current', /^That is an fmIDE system, not a module\./],
  ['loadSystem', 'mapping', /ExcelExporter/],
  ['loadSystem', 'map-legacy', /^That is an ExcelExporter mapping file — open it in ExcelExporter/], // saved before kinds were written
];
for(const [command, name, message] of WRONG_KIND){
  test(`${name} via ${command} is rejected with a message`, async ({ page }) => {
    await F.importViaCommand(page, command, file(name));
    const text = await F.dialogText(page);
    expect(text).toMatch(message);
    await F.dismissMessage(page);
    await expect(page.locator('.modal-box')).toHaveCount(0);
    expect(await canvasNames(page)).toEqual(['Before load']);
  });
}

test('templates via the Templates dialog: one question up front, then both import', async ({ page }) => {
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file('templates'));
  const questions = page.locator('.modal-box', { has: page.locator('button.danger') });
  await expect(questions).toHaveCount(1);
  const text = await questions.locator('p').first().textContent();
  expect(text).toContain('"Future T"');
  expect(text).toContain('newer fmIDE');
  await questions.locator('button.danger').click();
  // No further question.
  await page.waitForTimeout(300);
  await expect(page.locator('.modal-box', { has: page.locator('button.danger') })).toHaveCount(0);
  const list = page.locator('.modal-box .template-list button');
  await expect(list).toHaveCount(2);
  const names = await list.allInnerTexts();
  expect(names.map(n => n.split('\n')[0]).sort()).toEqual(['Future T', 'Good T']);
});

test('shortcuts-v1: old combos are upgraded', async ({ page }) => {
  await F.importViaDialog(page, 'openShortcuts', '⇧ Import Shortcuts', file('shortcuts-v1'));
  const message = page.locator('.modal-box', { hasText: 'Imported 2 shortcut bindings.' });
  await expect(message).toBeVisible();
  await message.locator('button', { hasText: /^OK$/ }).click();
  const shortcuts = await page.evaluate(() => Object.fromEntries(fm.commands().filter(c => ['openShortcuts', 'openMacros'].includes(c.id)).map(c => [c.id, c.shortcut])));
  expect(shortcuts).toEqual({ openShortcuts: 'Mod+Shift+K', openMacros: 'Mod+Alt+M' });
});

test('macros-bare (a bare array) imports', async ({ page }) => {
  await F.importViaDialog(page, 'openMacros', '⇧ Import', file('macros-bare'));
  const builder = page.locator('.modal-box.macro-box');
  await expect(builder).toContainText('Imported 1 macro.');
  await expect(builder).toContainText('Bare List Macro');
});

test('ws-nested-newer: one question up front, then the normal import confirm', async ({ page }) => {
  await F.importViaCommand(page, 'importWorkspace', file('ws-nested-newer'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Its system was saved by a newer fmIDE/);
  expect(seen[1]).toMatch(/^Import this workspace\?/);
  expect(seen.slice(2)).toEqual(['Workspace imported.']);
  expect(await canvasNames(page)).toEqual(['Revenue Model']);
});

test('autosave survives a reload', async ({ page }) => {
  await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Persisted Canvas' }));
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  expect(await canvasNames(page)).toEqual(['Persisted Canvas']);
});

test('Import Workspace replaces presets with the same name and keeps the others', async ({ page }, testInfo) => {
  // The user's own setup: default roles plus a preset of their own.
  const mine = testInfo.outputPath('user-workspace.json');
  require('fs').writeFileSync(mine, JSON.stringify({
    kind: 'fmIDE-workspace', version: 1,
    system: readFixture('formats', 'sys-current.json'),
    formatPresets: [{ id: 'fmtUser', name: 'User Only', style: { fill: '#123456' } }]
  }));
  await F.importViaCommand(page, 'importWorkspace', mine);
  await F.acceptAll(page);
  // A workspace whose roles were edited (Inputs fill #fff7ed).
  await F.importViaCommand(page, 'importWorkspace', fixture('models', 'roles-workspace-edited.json'));
  await F.acceptAll(page);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const named = (n) => data.formatPresets.filter(p => p.name === n);
  expect(named('Inputs')).toHaveLength(1);
  expect(named('Inputs')[0].style.fill).toBe('#fff7ed');
  expect(named('User Only')).toHaveLength(1);
  expect(named('User Only')[0].style.fill).toBe('#123456');
  for(const role of ['Calculations', 'Links', 'Headers', 'Section Headers', 'Labels', 'Notes']) expect(named(role)).toHaveLength(1);
});
