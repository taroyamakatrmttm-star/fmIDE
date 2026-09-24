// 10. Documents — fmIDE's New / Open / Save / Save As / Open Recent, unsaved changes,
// recovery, and what opening a .fmide file changes.
const fs = require('fs');
const { test, expect, readFixture, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');
const D = require('./helpers/documents');

const canvasNames = (page) => page.evaluate(() => fm.canvases().map(c => c.name));
const rename = (page, name) => page.evaluate((n) => fm.renameCanvas({ canvas: '@current', name: n }), name);
const cmd = (page, id) => page.evaluate((c) => fm.command(c), id);
const dialog = (page) => page.locator('.modal-box').last();

// A workspace (the content of a .fmide file) holding sys-current, renamed.
function workspaceText(canvasName, extra = {}){
  const system = readFixture('formats', 'sys-current.json');
  system.canvases[0].name = canvasName;
  return JSON.stringify(Object.assign({ kind: 'fmIDE-workspace', version: 1, system }, extra));
}
async function downloadText(page, action){
  const [download] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: download.suggestedFilename(), text: fs.readFileSync(await download.path(), 'utf8') };
}
// Open with unsaved changes: answer "Don't save", then pick the file.
async function openDiscarding(page, file){
  await cmd(page, 'openDocument');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#saveChangesDialog button', { hasText: "Don't save" }).click(),
  ]);
  await chooser.setFiles(file);
}
async function exportedWorkspace(page){
  return (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept()); // "Leave site?" on reloads with unsaved changes
});

// ---------- Fallback path (no File System Access API): file input and downloads ----------
test.describe('without file handles', () => {
  test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

  test('a new session is "Untitled"; opening a .fmide names the document', async ({ page }, testInfo) => {
    expect(await D.title(page)).toBe('Untitled — fmIDE');
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Revenue model.fmide', workspaceText('Opened Canvas')));
    await expect.poll(() => D.title(page)).toBe('Revenue model — fmIDE');
    expect(await canvasNames(page)).toEqual(['Opened Canvas']);
  });

  test('unsaved changes put a dot in the title; Save downloads name.fmide and clears it', async ({ page }, testInfo) => {
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Revenue model.fmide', workspaceText('Opened Canvas')));
    await expect.poll(() => D.title(page)).toBe('Revenue model — fmIDE');
    await rename(page, 'Edited');
    expect(await D.title(page)).toBe('Revenue model • — fmIDE');
    const saved = await downloadText(page, () => cmd(page, 'saveDocument'));
    expect(saved.name).toBe('Revenue model.fmide');
    const data = JSON.parse(saved.text);
    expect(data.kind).toBe('fmIDE-workspace');
    expect(data.system.canvases.map(c => c.name)).toEqual(['Edited']);
    await expect.poll(() => D.title(page)).toBe('Revenue model — fmIDE');
  });

  test('Save on an untitled document asks for a name; the download opens again', async ({ page }, testInfo) => {
    await rename(page, 'Mine');
    await cmd(page, 'saveDocument');
    await expect(page.locator('#saveAsDialog')).toBeVisible();
    expect(await page.locator('#saveAsName').inputValue()).toBe('Untitled');
    await page.locator('#saveAsName').fill('My Model');
    const saved = await downloadText(page, () => page.locator('#saveAsDialog button', { hasText: 'Save' }).click());
    expect(saved.name).toBe('My Model.fmide');
    await expect.poll(() => D.title(page)).toBe('My Model — fmIDE');
    // Save again: straight to the same name, no question.
    await rename(page, 'Mine 2');
    const again = await downloadText(page, () => cmd(page, 'saveDocument'));
    expect(again.name).toBe('My Model.fmide');
    // The saved file opens.
    await cmd(page, 'newDocument');
    expect(await canvasNames(page)).toEqual(['Canvas 1']);
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'My Model.fmide', again.text));
    await expect.poll(() => canvasNames(page)).toEqual(['Mine 2']);
  });

  test('Save As always asks for a name', async ({ page }, testInfo) => {
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Revenue model.fmide', workspaceText('A')));
    await expect.poll(() => D.title(page)).toBe('Revenue model — fmIDE');
    await cmd(page, 'saveDocumentAs');
    await expect(page.locator('#saveAsDialog')).toBeVisible();
    expect(await page.locator('#saveAsName').inputValue()).toBe('Revenue model');
    await page.locator('#saveAsName').fill('Revenue v2');
    const saved = await downloadText(page, () => page.keyboard.press('Enter'));
    expect(saved.name).toBe('Revenue v2.fmide');
    await expect.poll(() => D.title(page)).toBe('Revenue v2 — fmIDE');
  });

  test('a workspace or system .json opens too; Save then asks for a .fmide name', async ({ page }) => {
    await D.openViaInput(page, 'openDocument', fixture('formats', 'sys-current.json'));
    await expect.poll(() => D.title(page)).toBe('sys-current — fmIDE');
    expect(await canvasNames(page)).toEqual(['Revenue Model']);
    await cmd(page, 'saveDocument');
    await expect(page.locator('#saveAsDialog')).toBeVisible();
    expect(await page.locator('#saveAsName').inputValue()).toBe('sys-current');
  });

  test('a templates file is refused with the usual wrong-kind message', async ({ page }) => {
    await D.openViaInput(page, 'openDocument', fixture('formats', 'templates.json'));
    await expect(dialog(page)).toContainText('That is an fmIDE templates file');
    await F.dismissMessage(page);
    expect(await D.title(page)).toBe('Untitled — fmIDE');
  });

  test('a preferences file is refused, pointing to Import Preferences', async ({ page }) => {
    await D.openViaInput(page, 'openDocument', fixture('formats', 'preferences.json'));
    await expect(dialog(page)).toHaveText(/^That is an fmIDE preferences file, not a workspace or system\. Open it with File → Import Preferences\./);
    await F.dismissMessage(page);
    expect(await D.title(page)).toBe('Untitled — fmIDE');
  });

  test('Ctrl+S while typing in a field saves (the browser does not get it)', async ({ page }) => {
    await rename(page, 'Typed');
    await page.locator('#canvasTabs .canvas-tab .name').first().dblclick();
    await expect(page.locator('#canvasTabs input')).toBeFocused();
    await page.keyboard.press('Control+s');
    await expect(page.locator('#saveAsDialog')).toBeVisible();
  });
});

// ---------- Save / Don't save / Cancel ----------
test.describe('unsaved changes are asked about', () => {
  test.beforeEach(async ({ page }) => {
    await F.openFmIDE(page);
    await rename(page, 'Unsaved Work');
  });

  test('Cancel keeps everything', async ({ page }) => {
    await cmd(page, 'newDocument');
    await expect(page.locator('#saveChangesDialog')).toContainText('Do you want to save the changes to “Untitled”?');
    await page.locator('#saveChangesDialog button', { hasText: 'Cancel' }).click();
    await expect(page.locator('#saveChangesDialog')).toBeHidden();
    expect(await canvasNames(page)).toEqual(['Unsaved Work']);
    expect(await D.title(page)).toBe('Untitled • — fmIDE');
  });

  test("Don't save goes ahead", async ({ page }) => {
    await cmd(page, 'newDocument');
    await page.locator('#saveChangesDialog button', { hasText: "Don't save" }).click();
    expect(await canvasNames(page)).toEqual(['Canvas 1']);
    expect(await D.title(page)).toBe('Untitled — fmIDE');
    expect(await cmd(page, 'undo')).toBe(false); // nothing to undo: history starts afresh
  });

  test('Save saves first, then goes ahead', async ({ page }) => {
    await cmd(page, 'newDocument');
    await page.locator('#saveChangesDialog button', { hasText: 'Save' }).last().click();
    await page.locator('#saveAsName').fill('Kept');
    const saved = await downloadText(page, () => page.locator('#saveAsDialog button', { hasText: 'Save' }).click());
    expect(saved.name).toBe('Kept.fmide');
    expect(JSON.parse(saved.text).system.canvases.map(c => c.name)).toEqual(['Unsaved Work']);
    await expect.poll(() => canvasNames(page)).toEqual(['Canvas 1']);
    expect(await D.title(page)).toBe('Untitled — fmIDE');
  });

  test('Cancelling the name question cancels the whole thing', async ({ page }) => {
    await cmd(page, 'openDocument');
    await page.locator('#saveChangesDialog button', { hasText: 'Save' }).last().click();
    await page.locator('#saveAsDialog button', { hasText: 'Cancel' }).click();
    expect(await canvasNames(page)).toEqual(['Unsaved Work']);
    expect(await D.title(page)).toBe('Untitled • — fmIDE');
  });
});

// ---------- File-handle path (fake showOpenFilePicker / showSaveFilePicker) ----------
test.describe('with file handles', () => {
  test.beforeEach(async ({ page }) => {
    await D.installFakePickers(page);
    await F.openFmIDE(page);
  });

  test('Save writes back to the same file; Save As asks for a new one', async ({ page }) => {
    await D.putFakeFile(page, 'Model.fmide', workspaceText('On Disk'));
    await page.evaluate(() => { window.__nextOpen = 'Model.fmide'; });
    await cmd(page, 'openDocument');
    await expect.poll(() => D.title(page)).toBe('Model — fmIDE');
    expect(await canvasNames(page)).toEqual(['On Disk']);

    await rename(page, 'Changed');
    await cmd(page, 'saveDocument');
    await expect.poll(() => D.title(page)).toBe('Model — fmIDE');
    const after = await page.evaluate(() => ({ writes: window.__writes.map(w => w.name), asks: window.__saveAsCalls, file: window.__files['Model.fmide'] }));
    expect(after.writes).toEqual(['Model.fmide']);
    expect(after.asks).toEqual([]);
    expect(JSON.parse(after.file).system.canvases.map(c => c.name)).toEqual(['Changed']);

    await page.evaluate(() => { window.__nextSaveName = 'Copy.fmide'; });
    await cmd(page, 'saveDocumentAs');
    await expect.poll(() => D.title(page)).toBe('Copy — fmIDE');
    expect(await page.evaluate(() => window.__saveAsCalls)).toEqual(['Model.fmide']);

    await rename(page, 'Changed Again');
    await cmd(page, 'saveDocument');
    await expect.poll(() => page.evaluate(() => window.__writes.map(w => w.name))).toEqual(['Model.fmide', 'Copy.fmide', 'Copy.fmide']);
    expect(await page.evaluate(() => window.__saveAsCalls)).toHaveLength(1);
  });

  test('an untitled document: Save asks where, suggesting Untitled.fmide', async ({ page }) => {
    await rename(page, 'Fresh');
    await cmd(page, 'saveDocument');
    await expect.poll(() => page.evaluate(() => window.__saveAsCalls)).toEqual(['Untitled.fmide']);
    await expect.poll(() => D.title(page)).toBe('Untitled — fmIDE'); // saved as Untitled.fmide
    expect(await page.evaluate(() => window.__writes.map(w => w.name))).toEqual(['Untitled.fmide']);
  });

  test('a system .json opened from disk is never overwritten: Save asks for a .fmide', async ({ page }) => {
    await D.putFakeFile(page, 'model.json', JSON.stringify(readFixture('formats', 'sys-current.json')));
    await page.evaluate(() => { window.__nextOpen = 'model.json'; });
    await cmd(page, 'openDocument');
    await expect.poll(() => D.title(page)).toBe('model — fmIDE');
    await rename(page, 'Edited');
    await cmd(page, 'saveDocument');
    await expect.poll(() => page.evaluate(() => window.__saveAsCalls)).toEqual(['model.fmide']);
    const files = await page.evaluate(() => window.__files);
    expect(JSON.parse(files['model.json']).kind).toBe('system');
    expect(JSON.parse(files['model.fmide']).kind).toBe('fmIDE-workspace');
  });

  test('Open Recent reopens the real file', async ({ page }) => {
    await D.putFakeFile(page, 'First.fmide', workspaceText('First Canvas'));
    await D.putFakeFile(page, 'Second.fmide', workspaceText('Second Canvas'));
    await page.evaluate(() => { window.__nextOpen = 'First.fmide'; });
    await cmd(page, 'openDocument');
    await expect.poll(() => D.title(page)).toBe('First — fmIDE');
    await page.evaluate(() => { window.__nextOpen = 'Second.fmide'; });
    await cmd(page, 'openDocument');
    await expect.poll(() => D.title(page)).toBe('Second — fmIDE');
    // Someone changed First.fmide on disk meanwhile.
    await D.putFakeFile(page, 'First.fmide', workspaceText('First Changed On Disk'));
    await cmd(page, 'openRecent');
    await expect(page.locator('#recentList .recent-name')).toHaveText(['Second', 'First']);
    await page.locator('#recentList .recent-item', { hasText: 'First' }).click();
    await expect.poll(() => canvasNames(page)).toEqual(['First Changed On Disk']);
    expect(await D.title(page)).toBe('First — fmIDE');
  });
});

// ---------- Recent (copies kept in the browser) ----------
test('Open Recent: two files, reopen the first from its copy, then Clear Recent', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Alpha.fmide', workspaceText('Alpha Canvas')));
  await expect.poll(() => D.title(page)).toBe('Alpha — fmIDE');
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Beta.fmide', workspaceText('Beta Canvas')));
  await expect.poll(() => D.title(page)).toBe('Beta — fmIDE');
  await cmd(page, 'openRecent');
  await expect(page.locator('#recentList .recent-name')).toHaveText(['Beta', 'Alpha']);
  await page.locator('#recentList .recent-item', { hasText: 'Alpha' }).click();
  await expect.poll(() => canvasNames(page)).toEqual(['Alpha Canvas']);
  expect(await D.title(page)).toBe('Alpha — fmIDE');
  await expect(page.locator('#fmToast')).toContainText('Opened the copy saved in this browser on');
  // Alpha is now first; the list survives a reload.
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  await cmd(page, 'openRecent');
  await expect(page.locator('#recentList .recent-name')).toHaveText(['Alpha', 'Beta']);
  await page.locator('#openRecentDialog button', { hasText: 'Clear Recent' }).click();
  await expect(page.locator('#openRecentDialog')).toBeHidden();
  await expect.poll(async () => { await cmd(page, 'openRecent'); const t = await page.locator('#openRecentDialog').innerText(); await page.keyboard.press('Escape'); return t; })
    .toContain('No recent documents.');
  expect(await S.storedKeys(page, 'fmIDE', 'fmIDE-recent:')).toEqual([]);
});

test('Save As makes a new Recent entry; the old file keeps its own', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Original.fmide', workspaceText('O')));
  await expect.poll(() => D.title(page)).toBe('Original — fmIDE');
  await cmd(page, 'saveDocumentAs');
  await page.locator('#saveAsName').fill('Copy');
  await downloadText(page, () => page.keyboard.press('Enter'));
  await expect.poll(() => D.title(page)).toBe('Copy — fmIDE');
  await cmd(page, 'openRecent');
  await expect(page.locator('#recentList .recent-name')).toHaveText(['Copy', 'Original']);
});

test('Open Recent the moment a save finishes already lists the new file', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Original.fmide', workspaceText('O')));
  await expect.poll(() => D.title(page)).toBe('Original — fmIDE');
  await cmd(page, 'saveDocumentAs');
  await page.locator('#saveAsName').fill('Copy');
  await Promise.all([page.waitForEvent('download'), page.evaluate(async () => {
    document.querySelector('#saveAsDialog button.primary').click();
    while(!document.title.startsWith('Copy')) await new Promise(r => setTimeout(r, 0));
    fm.command('openRecent'); // while the Recent entry may still be being written
  })]);
  await expect(page.locator('#recentList .recent-name')).toHaveText(['Copy', 'Original']);
});

test('file names are shown as plain text', async ({ page }) => {
  await F.openFmIDE(page);
  const evil = '<img src=x onerror=window.__pwned=1>';
  // Given from memory: a file with this name on disk would break the CI artifact upload.
  await D.openViaInput(page, 'openDocument', { name: evil + '.fmide', mimeType: 'application/json', buffer: Buffer.from(workspaceText('X')) });
  await expect.poll(() => D.title(page)).toBe(evil + ' — fmIDE');
  await cmd(page, 'openRecent');
  await expect(page.locator('#recentList .recent-name')).toHaveText([evil]);
  expect(await page.locator('#recentList img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

// ---------- Recovery ----------
test.describe('recovery', () => {
  test('changes are autosaved about 2 seconds after the last one', async ({ page }) => {
    await page.clock.install();
    await F.openFmIDE(page);
    await rename(page, 'Two Seconds');
    await page.clock.runFor(1000);
    expect(await S.storedKeys(page, 'fmIDE', 'fmIDE-workspace-v1')).toEqual([]);
    await page.clock.runFor(1500);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1'))['fmIDE-workspace-v1'] || '').toContain('Two Seconds');
  });

  test('after a reload with unsaved changes: the notice, then Dismiss', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Budget.fmide', workspaceText('Budget Canvas')));
    await expect.poll(() => D.title(page)).toBe('Budget — fmIDE');
    await rename(page, 'Not Saved Yet');
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE-session'))['fmIDE-session'] || '').toContain('"dirty":true');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await canvasNames(page)).toEqual(['Not Saved Yet']);
    expect(await D.title(page)).toBe('Budget • — fmIDE');
    const banner = page.locator('#recoveryBanner');
    await expect(banner).toContainText('Recovered unsaved changes to “Budget”.');
    await banner.locator('button', { hasText: 'Dismiss' }).click();
    await expect(banner).toBeHidden();
    expect(await D.title(page)).toBe('Budget • — fmIDE');
  });

  test('the notice\'s Save saves the recovered document', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Budget.fmide', workspaceText('Budget Canvas')));
    await expect.poll(() => D.title(page)).toBe('Budget — fmIDE');
    await rename(page, 'Recovered Work');
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE-session'))['fmIDE-session'] || '').toContain('"dirty":true');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    const saved = await downloadText(page, () => page.locator('#recoveryBanner button', { hasText: 'Save' }).click());
    expect(saved.name).toBe('Budget.fmide');
    expect(JSON.parse(saved.text).system.canvases.map(c => c.name)).toEqual(['Recovered Work']);
    await expect(page.locator('#recoveryBanner')).toBeHidden();
    await expect.poll(() => D.title(page)).toBe('Budget — fmIDE');
  });

  test('a saved session comes back without a notice', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Clean.fmide', workspaceText('Clean Canvas')));
    await expect.poll(() => D.title(page)).toBe('Clean — fmIDE');
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE-session'))['fmIDE-session'] || '').toContain('"name":"Clean"');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await D.title(page)).toBe('Clean — fmIDE');
    await expect(page.locator('#recoveryBanner')).toHaveCount(0);
  });
});

// ---------- What opening a .fmide changes ----------
test('opening a .fmide adds templates and macros, keeps shortcuts and ribbon, takes the format roles', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  const macro = (name, canvasName) => ({ id: 'm-' + name, name, steps: [{ kind: 'action', action: 'renameCanvas', args: { canvas: '@current', name: canvasName } }] });
  const template = (name, text) => ({ name, kind: 'module', group: 'Mine', data: { version: 1, kind: 'module', nodes: [{ id: 'n1', type: 'value', x: 50, y: 50, w: 170, h: 64, text }], edges: [] } });
  // The person's own setup, imported as a whole workspace.
  const mine = D.tempFile(testInfo, 'mine.json', workspaceText('Mine', {
    templates: [template('Shared T', 'Same\n1'), template('My T', 'Mine\n2')],
    macros: [macro('Shared M', 'S'), macro('My M', 'M')],
    shortcutBindings: { openLauncher: 'Mod+Shift+L' }, shortcutBindingsVersion: 2
  }));
  await F.importViaCommand(page, 'importWorkspace', mine);
  await F.acceptAll(page);
  const before = await exportedWorkspace(page);
  // Someone else's document: one identical template/macro, one of each that is new, a
  // different macro with an existing name, their own shortcuts, ribbon and format roles.
  const theirs = readFixture('models', 'roles-workspace-edited.json');
  Object.assign(theirs, {
    templates: [template('Shared T', 'Same\n1'), template('Their T', 'Theirs\n3')],
    macros: [macro('Shared M', 'S'), macro('Their M', 'T'), macro('My M', 'Different')],
    shortcutBindings: { openLauncher: 'Mod+J' }, shortcutBindingsVersion: 2,
    ui: { ribbonCustomized: true, ribbon: { qat: [], tabs: [{ id: 'x', label: 'Theirs', groups: [] }] }, documentGroupAdded: true }
  });
  await openDiscarding(page, D.tempFile(testInfo, 'Theirs.fmide', JSON.stringify(theirs)));
  await expect.poll(() => D.title(page)).toBe('Theirs — fmIDE');
  const after = await exportedWorkspace(page);
  expect(after.templates.map(t => t.name).sort()).toEqual(['My T', 'Shared T', 'Their T']);
  expect(after.macros.map(m => m.name).sort()).toEqual(['My M', 'My M (imported)', 'Shared M', 'Their M']);
  expect(after.shortcutBindings.openLauncher).toBe('Mod+Shift+L');
  expect(after.ui).toEqual(before.ui);
  const inputs = after.formatPresets.filter(p => p.name === 'Inputs');
  expect(inputs).toHaveLength(1);
  expect(inputs[0].style.fill).toBe('#fff7ed');
  // Opening the same document again adds nothing.
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Theirs.fmide', JSON.stringify(theirs)));
  await expect.poll(async () => (await exportedWorkspace(page)).macros.length).toBe(4);
  expect((await exportedWorkspace(page)).templates).toHaveLength(3);
});

test('New keeps the format presets, templates and macros', async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'importWorkspace', fixture('models', 'roles-workspace-edited.json'));
  await F.acceptAll(page);
  await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Discard Me' }));
  await cmd(page, 'newDocument');
  await page.locator('#saveChangesDialog button', { hasText: "Don't save" }).click();
  expect(await canvasNames(page)).toEqual(['Canvas 1']);
  const ws = await exportedWorkspace(page);
  expect(ws.formatPresets.find(p => p.name === 'Inputs').style.fill).toBe('#fff7ed');
  expect(ws.system.periods).toEqual(['Period 1']);
});

// ---------- Ribbon ----------
test.describe('the Document group on the ribbon', () => {
  const fileTabGroups = (page) => page.evaluate(() => (__fmIDE.getRibbonConfig().tabs.find(t => t.id === 'file') || { groups: [] }).groups.map(g => g.label));
  const customRibbon = (flag) => ({
    ribbonCustomized: true, documentGroupAdded: flag,
    ribbon: { qat: ['undo'], tabs: [{ id: 'file', label: 'File', groups: [{ label: 'Only Mine', items: [{ cmd: 'saveSystem' }] }] }] }
  });

  test('the default ribbon starts with it', async ({ page }) => {
    await F.openFmIDE(page);
    expect((await fileTabGroups(page))[0]).toBe('Document');
  });

  test('a ribbon customised before it existed gets it once; removing it is respected', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await F.importViaCommand(page, 'importWorkspace', D.tempFile(testInfo, 'old.json', workspaceText('A', { ui: customRibbon(undefined) })));
    await F.acceptAll(page);
    expect(await fileTabGroups(page)).toEqual(['Document', 'Only Mine']);
    // Removed again later (saved with the flag): it stays removed, also after a reload.
    await F.importViaCommand(page, 'importWorkspace', D.tempFile(testInfo, 'removed.json', workspaceText('B', { ui: customRibbon(true) })));
    await F.acceptAll(page);
    expect(await fileTabGroups(page)).toEqual(['Only Mine']);
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1'))['fmIDE-workspace-v1'] || '').toContain('Only Mine');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await fileTabGroups(page)).toEqual(['Only Mine']);
  });
});
