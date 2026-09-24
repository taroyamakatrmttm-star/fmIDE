// 11. Preferences file (fmIDE) — Export / Import Preferences: shortcuts, ribbon and Quick
// Access Toolbar, ribbon collapsed state and KeyTips trigger travel on their own.
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');

const cmd = (page, id) => page.evaluate((c) => fm.command(c), id);
const shortcut = (page, id) => page.evaluate((c) => (fm.commands().find(x => x.id === c) || {}).shortcut, id);
const ribbon = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__fmIDE.getRibbonConfig())));
const exportPrefs = async (page) => (await F.downloadJson(page, () => cmd(page, 'exportPreferences'))).data;
const exportWorkspace = async (page) => (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
// The parts of a workspace a preferences import must never touch.
const content = (ws) => ({ system: ws.system, templates: ws.templates, macros: ws.macros, formatPresets: ws.formatPresets });

async function importPrefs(page, file){
  await F.importViaCommand(page, 'importPreferences', file);
}
async function confirmReplace(page){
  await expect(F.topDialog(page)).toContainText('Replace your shortcuts, ribbon and KeyTips settings with the ones in this file?');
  await F.confirmDanger(page);
}

// The Customize Ribbon dialog, driven like a person would.
const rbc = (page) => page.locator('.rbc-box');
async function openCustomize(page){
  await cmd(page, 'customizeRibbon');
  await expect(rbc(page)).toBeVisible();
}
const treeRow = (page, text) => rbc(page).locator('.rbc-list').nth(1).locator('.rbc-row', { hasText: text });
const cmdRow = (page, text) => rbc(page).locator('.rbc-list').first().locator('.rbc-row', { hasText: text });
async function closeCustomize(page){
  await rbc(page).locator('button', { hasText: /^Done$/ }).click();
  await expect(rbc(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

test('customise, export, reset, import: everything comes back and nothing else changes', async ({ page }, testInfo) => {
  // A model, templates, macros and format presets of the person's own.
  await F.importViaCommand(page, 'importWorkspace', fixture('models', 'roles-workspace-edited.json'));
  await F.acceptAll(page);

  // 1. Customise: a shortcut, the ribbon (move a command, add one to the QAT), the KeyTips key.
  await F.importViaDialog(page, 'openShortcuts', 'Import Shortcuts',
    D.tempFile(testInfo, 'shortcuts.json', JSON.stringify({ kind: 'fmIDE-shortcuts', version: 2, bindings: { evaluate: 'F7' } })));
  await F.dismissMessage(page);
  await page.locator('.modal-box button', { hasText: /^Close$/ }).click();
  await openCustomize(page);
  await cmdRow(page, 'Add Rectangle').first().click();
  await treeRow(page, 'Quick Access Toolbar').click();
  await rbc(page).locator('button', { hasText: 'Add »' }).click();
  await treeRow(page, 'Cut').first().click();
  await rbc(page).locator('button', { hasText: '↓' }).click();
  await rbc(page).locator('.rbc-trigger select').selectOption('combo:F10');
  await closeCustomize(page);
  expect(await shortcut(page, 'evaluate')).toBe('F7');
  const customised = await ribbon(page);
  expect(customised.qat).toContain('addRect');
  const before = await exportWorkspace(page);
  const prefs = await exportPrefs(page);
  expect(prefs.kind).toBe('fmIDE-preferences');
  expect(prefs.version).toBe(1);
  expect(prefs.keytipTrigger).toEqual({ type: 'combo', combo: 'F10' });
  expect(prefs).not.toHaveProperty('activeTab');
  expect(prefs).not.toHaveProperty('launcherRecent');
  expect(prefs).not.toHaveProperty('lastRunMacroId');
  const saved = D.tempFile(testInfo, 'fmIDE-preferences.json', JSON.stringify(prefs));

  // 2. Reset everything.
  await page.evaluate(() => fm.command('openShortcuts'));
  await page.locator('.modal-box button', { hasText: 'Reset All to Defaults' }).click();
  await F.confirmDanger(page);
  await page.locator('.modal-box button', { hasText: /^Close$/ }).click();
  await openCustomize(page);
  await rbc(page).locator('button', { hasText: /^Reset$/ }).click();
  await F.confirmDanger(page);
  await rbc(page).locator('.rbc-trigger select').selectOption('tap:Alt');
  await closeCustomize(page);
  expect(await shortcut(page, 'evaluate')).toBe('F9');
  expect((await ribbon(page)).qat).not.toContain('addRect');
  expect((await exportPrefs(page)).keytipTrigger).toEqual({ type: 'tap', key: 'Alt' });

  // 3. Import: all four back; the model, templates, macros and presets untouched.
  const title = await D.title(page);
  await importPrefs(page, saved);
  await confirmReplace(page);
  await expect.poll(() => shortcut(page, 'evaluate')).toBe('F7');
  expect(await ribbon(page)).toEqual(customised);
  expect(await exportPrefs(page)).toEqual(prefs);
  expect(content(await exportWorkspace(page))).toEqual(content(before));
  expect(await D.title(page)).toBe(title); // settings are not part of the document
});

test('Cancel at the confirmation leaves every setting unchanged', async ({ page }) => {
  const before = await exportPrefs(page);
  await importPrefs(page, fixture('formats', 'preferences.json'));
  await F.cancelDialog(page);
  await expect(page.locator('.modal-box')).toHaveCount(0);
  expect(await exportPrefs(page)).toEqual(before);
});

test('the preferences fixture applies as a whole', async ({ page }) => {
  await importPrefs(page, fixture('formats', 'preferences.json'));
  await confirmReplace(page);
  await expect.poll(() => shortcut(page, 'evaluate')).toBe('F5');
  expect(await shortcut(page, 'openLauncher')).toBe('Mod+Shift+L');
  expect(await shortcut(page, 'undo')).toBe('Mod+Z'); // not in the file: its default
  const r = await ribbon(page);
  expect(r.tabs.map(t => t.label)).toEqual(['File', 'My Tab']);
  expect(r.qat).toContain('addRect');
  expect((await exportPrefs(page)).keytipTrigger).toEqual({ type: 'combo', combo: 'F10' });
  await expect(page.locator('#ribbon .rb-tab', { hasText: 'My Tab' })).toBeVisible();
});

test('a newer-version preferences file asks first', async ({ page }) => {
  await importPrefs(page, fixture('formats', 'preferences-newer.json'));
  await expect(F.topDialog(page)).toContainText('saved by a newer version of fmIDE (format version 3');
  await F.confirmDanger(page);
  await confirmReplace(page);
  await expect.poll(() => shortcut(page, 'evaluate')).toBe('F5');
});

test('another person\'s preferences: your macro shortcuts stay, their macro buttons are dropped', async ({ page }, testInfo) => {
  const ws = readFixture('models', 'roles-workspace-edited.json');
  Object.assign(ws, {
    macros: [{ id: 'mine1', name: 'Mine', steps: [] }, { id: 'mine2', name: 'Clashing', steps: [] }],
    shortcutBindings: { 'macro:mine1': 'Alt+M', 'macro:mine2': 'Alt+N' }, shortcutBindingsVersion: 2
  });
  await F.importViaCommand(page, 'importWorkspace', D.tempFile(testInfo, 'mine.json', JSON.stringify(ws)));
  await F.acceptAll(page);
  expect(await shortcut(page, 'macro:mine1')).toBe('Alt+M');
  const theirs = readFixture('formats', 'preferences.json'); // binds newCanvas to Alt+N
  theirs.shortcutBindings['macro:theirs'] = 'Alt+T';
  theirs.ribbon.qat.push('macro:theirs');
  theirs.ribbon.tabs[1].groups[0].items.push({ cmd: 'macro:theirs' });
  await importPrefs(page, D.tempFile(testInfo, 'theirs.json', JSON.stringify(theirs)));
  await confirmReplace(page);
  await expect.poll(() => shortcut(page, 'evaluate')).toBe('F5');
  expect(await shortcut(page, 'macro:mine1')).toBe('Alt+M');   // kept
  expect(await shortcut(page, 'newCanvas')).toBe('Alt+N');     // the file's built-in command wins…
  expect(await shortcut(page, 'macro:mine2')).toBeNull();      // …over the macro that had that key
  const r = await ribbon(page);
  expect(r.qat).not.toContain('macro:theirs');
  expect(JSON.stringify(r)).not.toContain('macro:theirs');
});

test('names and settings from the file are safe: markup is text, junk is ignored', async ({ page }, testInfo) => {
  const evil = readFixture('formats', 'preferences.json');
  evil.ribbon.tabs[1].label = '<img src=x onerror=window.__pwned=1>';
  evil.ribbon.tabs[1].groups.push('not a group', { label: 5, items: 'nope' }, { items: [{ cmd: 7 }, null, { cmd: 'evaluate', size: 'huge' }] });
  evil.keytipTrigger = { type: 'tap', key: 'a' }; // would arm KeyTips while typing
  await importPrefs(page, D.tempFile(testInfo, 'evil.json', JSON.stringify(evil)));
  await confirmReplace(page);
  await expect(page.locator('#ribbon .rb-tab', { hasText: '<img src=x onerror=window.__pwned=1>' })).toBeVisible();
  expect(await page.locator('#ribbon img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  const tab = (await ribbon(page)).tabs[1];
  expect(tab.groups.map(g => g.label)).toEqual(['Favourites', 'Group', 'Group']);
  expect(tab.groups[2].items).toEqual([{ cmd: 'evaluate' }]);
  expect((await exportPrefs(page)).keytipTrigger).toEqual({ type: 'tap', key: 'Alt' }); // back to the default
});

test('the File tab has a Preferences group; Customize Ribbon has the buttons too', async ({ page }) => {
  const file = (await ribbon(page)).tabs.find(t => t.id === 'file');
  expect(file.groups.find(g => g.label === 'Preferences').items.map(i => i.cmd)).toEqual(['exportPreferences', 'importPreferences']);
  await openCustomize(page);
  await expect(rbc(page).locator('button', { hasText: 'Export Preferences…' })).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    rbc(page).locator('button', { hasText: 'Import Preferences…' }).click(),
  ]);
  await chooser.setFiles(fixture('formats', 'preferences.json'));
  await confirmReplace(page);
  // The dialog reopens showing the imported layout.
  await expect(treeRow(page, 'My Tab')).toBeVisible();
});
