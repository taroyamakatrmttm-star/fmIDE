// 21. Functions in fmIDE (step 7, phase D2): the library and the Functions manager.
// - fm actions: saveFunction (new function, new version, names, how calls are pinned),
//   listFunctions / getFunction, setFunctionInfo, deleteFunction (the template rules),
//   importFunctions / exportFunctions (the fmIDE-functions file; duplicates, taken
//   numbers; a newer file).
// - The Functions manager: the list by family, the editor (live parse errors at their
//   place, Save off until the formula reads, choosing between two functions of one name),
//   Import / Export, Delete's warning.
// - The model's definitions are part of undo history; the ribbon's My Functions group;
//   macros record the actions.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

const read = (name) => JSON.parse(fs.readFileSync(fixture('functions', name + '.json'), 'utf8'));
const lib = (page) => page.evaluate(() => fm.listFunctions());
const summary = (page) => page.evaluate(() => fm.listFunctions().map(f => f.name + ':' + f.versions.map(v => v.version).join(',')));
const err = (page, fn) => page.evaluate(fn).then(() => null, e => e.message);
const importFile = (page, name, extra) => page.evaluate(([file, extra]) => fm.importFunctions(Object.assign({ file }, extra || {})), [read(name), extra]);

const manager = (page) => page.locator('.modal-box.function-box');
const editor = (page) => page.locator('.modal-box.function-editor');
async function openManager(page){
  await page.evaluate(() => fm.command('openFunctions'));
  await expect(manager(page)).toBeVisible();
}
async function typeDefinition(page, text){
  await editor(page).locator('textarea.fn-editor-text').fill(text);
}

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

// ---------- fm actions ----------
test.describe('saving functions', () => {
  test('a new function, then a new version: families, numbers, notes', async ({ page }) => {
    expect(await page.evaluate(() => fm.saveFunction({ text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue', description: 'Share left', note: 'first' }))).toBe('Margin@1');
    expect(await page.evaluate(() => fm.saveFunction({ text: 'Margin(revenue, cost) = (REVENUE - Cost) / Revenue * 100', note: 'percent', newVersionOf: 'Margin' }))).toBe('Margin@2');
    const [m] = await lib(page);
    expect(m.name).toBe('Margin');
    expect(m.latest).toBe(2);
    expect(m.versions.map(v => [v.version, v.note, v.inputs])).toEqual([[2, 'percent', ['revenue', 'cost']], [1, 'first', ['Revenue', 'Cost']]]);
    expect(m.family).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(m.versions[0].versionId).not.toBe(m.versions[1].versionId);
    expect((await page.evaluate(() => fm.getFunction('Margin@1'))).description).toBe('Share left');
    expect((await page.evaluate(() => fm.getFunction('Margin'))).version).toBe(2);
  });

  test('what can\'t be saved says why', async ({ page }) => {
    await page.evaluate(() => fm.saveFunction({ text: 'Margin(a, b) = a - b' }));
    expect(await err(page, () => fm.saveFunction({ text: 'Margin(a, b) = a + b' }))).toMatch(/already a function called Margin.*newVersionOf/);
    expect(await err(page, () => fm.saveFunction({ text: 'Other(a) = a', newVersionOf: 'Margin' }))).toMatch(/A new version keeps the name Margin/);
    expect(await err(page, () => fm.saveFunction({ text: 'Bad(a) = a +' }))).toMatch(/at character 13/);
    expect(await err(page, () => fm.saveFunction({ text: 'Uses(a) = Nowhere(a)' }))).toMatch(/Nowhere isn't in your library — create it first/);
    expect(await err(page, () => fm.saveFunction({ text: 'Uses(a) = Margin(a)' }))).toMatch(/Margin v1 takes 2 inputs; here it is given 1/);
    expect(await err(page, () => fm.saveFunction({ text: 'Margin(a, b) = a', newVersionOf: 'Nope' }))).toMatch(/no function called "Nope"/);
    expect(await summary(page)).toEqual(['Margin:1']);
  });

  test('calls are pinned: the latest when one function has the name, the old pin in a new version, a choice when two share it', async ({ page }) => {
    await importFile(page, 'library');           // Margin v1, v2; Profit v1 → Margin v1
    // A new function calling Margin: its latest version.
    await page.evaluate(() => fm.saveFunction({ text: 'Twice(r, c) = 2 * Margin(r, c)' }));
    expect((await page.evaluate(() => fm.getFunction('Twice'))).calls).toEqual([{ name: 'Margin', family: 'family-margin', version: 2, versionId: 'version-margin-2' }]);
    // A new version of Profit keeps its pin on Margin v1 …
    await page.evaluate(() => fm.saveFunction({ text: 'Profit(Revenue, Cost) = Margin(Revenue, Cost) * Revenue + 0', newVersionOf: 'Profit' }));
    expect((await page.evaluate(() => fm.getFunction('Profit@2'))).calls[0].version).toBe(1);
    // … unless told otherwise.
    await page.evaluate(() => fm.saveFunction({ text: 'Profit(Revenue, Cost) = Margin(Revenue, Cost) * Revenue', newVersionOf: 'Profit', calls: { Margin: 'Margin@latest' } }));
    expect((await page.evaluate(() => fm.getFunction('Profit@3'))).calls[0].version).toBe(2);
    // Another family called Margin: a call to Margin must say which.
    await importFile(page, 'library-other-margin');
    expect(await err(page, () => fm.saveFunction({ text: 'Again(r, c) = Margin(r, c)' }))).toMatch(/More than one function in your library is called Margin/);
    await page.evaluate(() => fm.saveFunction({ text: 'Again(r, c) = Margin(r, c)', calls: { margin: 'family-margin-other@1' } }));
    expect((await page.evaluate(() => fm.getFunction('Again'))).calls[0].family).toBe('family-margin-other');
    // A pin held by an older version still counts when the name is shared.
    await page.evaluate(() => fm.saveFunction({ text: 'Profit(Revenue, Cost) = Margin(Revenue, Cost)', newVersionOf: 'Profit' }));
    expect((await page.evaluate(() => fm.getFunction('Profit@4'))).calls[0]).toMatchObject({ family: 'family-margin', version: 2 });
  });

  test('description and note can be edited; the text can\'t', async ({ page }) => {
    await page.evaluate(() => fm.saveFunction({ text: 'F(x) = x' }));
    await page.evaluate(() => fm.setFunctionInfo({ function: 'F', description: 'Just x', note: 'Plain' }));
    expect(await page.evaluate(() => fm.getFunction('F'))).toMatchObject({ description: 'Just x', note: 'Plain', text: 'F(x) = x' });
  });
});

test.describe('deleting functions', () => {
  test('an older version alone; the latest only with its whole family', async ({ page }) => {
    await importFile(page, 'library');
    expect(await err(page, () => fm.deleteFunction('Margin@2'))).toMatch(/latest version of Margin: it can only be deleted with the whole function/);
    expect(await page.evaluate(() => fm.deleteFunction('Margin@1'))).toBe(1);
    expect(await summary(page)).toEqual(['Margin:2', 'Profit:1']);
    // Profit calls the version that went: the manager says so.
    await openManager(page);
    await manager(page).locator('button.function-family', { hasText: 'Profit' }).click();
    await expect(manager(page).locator('.function-detail-call.missing')).toHaveText('Calls Margin v1 — not in your library');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => fm.deleteFunction('Margin'))).toBe(1);
    expect(await page.evaluate(() => fm.deleteFunction({ function: 'Profit@1', whole: true }))).toBe(1);
    expect(await lib(page)).toEqual([]);
  });

  test('a function the open model uses: a warning, and the model keeps calculating', async ({ page }) => {
    await F.importViaCommand(page, 'loadSystem', fixture('functions', 'basic.json'));
    await F.acceptAll(page);
    const value = () => page.evaluate(() => { fm.switchCanvas('Functions'); return fm.getValue('Profit', 1); });
    const before = await value();
    await openManager(page);
    await manager(page).locator('button.function-family', { hasText: 'Margin' }).click();
    await manager(page).locator('button.function-delete').click();
    const text = await F.dialogText(page);
    expect(text).toMatch(/^Delete the function Margin and all 2 of its versions\?/);
    expect(text).toMatch(/nodes? in the open model use.*keep working — the model carries its own copy/);
    expect(text).toMatch(/Profit v1 calls it: inserting that from the library will leave the call missing/);
    await F.confirmDanger(page);
    await expect(manager(page).locator('button.function-family', { hasText: 'Margin' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(await value()).toBe(before);
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
    expect(data.functions.map(d => d.family + '@' + d.version)).toContain('family-margin@1');
  });
});

test.describe('the fmIDE-functions file', () => {
  test('export and import: everything, or chosen functions with what they call', async ({ page }) => {
    await importFile(page, 'library');
    const all = await page.evaluate(() => fm.exportFunctions({ download: false }));
    expect(all.kind).toBe('fmIDE-functions');
    expect(all.version).toBe(2);
    expect(all.functions).toEqual(read('library').functions);
    const some = await page.evaluate(() => fm.exportFunctions({ download: false, functions: ['Profit'] }));
    expect(some.functions.map(d => d.family + '@' + d.version)).toEqual(['family-margin@1', 'family-profit@1']);
    // The download is the same file.
    const { name, data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportFunctions()));
    expect(name).toMatch(/^fmIDE-functions-.*\.json$/);
    expect(data).toEqual(all);
    // Read again: all there already.
    expect(await importFile(page, 'library')).toEqual({ added: 0, present: 3, renumbered: 0 });
  });

  test('a version whose number is taken is added as the next one; calls to it follow', async ({ page }) => {
    await importFile(page, 'library');
    expect(await importFile(page, 'library-fork')).toEqual({ added: 2, present: 0, renumbered: 1 });
    const margin = (await lib(page)).find(f => f.family === 'family-margin');
    expect(margin.versions.map(v => [v.version, v.versionId, v.note])).toEqual([
      [3, 'version-margin-theirs', 'Imported — was v2 in the file: Their v2'],
      [2, 'version-margin-2', 'As a percentage'],
      [1, 'version-margin-1', 'First version'],
    ]);
    expect((await page.evaluate(() => fm.getFunction('Net'))).calls[0]).toMatchObject({ version: 3, versionId: 'version-margin-theirs' });
    // Their file again: nothing new, although its numbers differ from the library's now.
    expect(await importFile(page, 'library-fork')).toEqual({ added: 0, present: 2, renumbered: 0 });
  });

  test('a model carrying a different version under a taken number: the library renumbers its copy, the model keeps its own', async ({ page }) => {
    // (Found in D1: the library took both as "v2".)
    await importFile(page, 'library-fork');            // their Margin v2 first
    await F.importViaCommand(page, 'loadSystem', fixture('functions', 'basic.json'));
    await F.acceptAll(page);
    const margin = (await lib(page)).find(f => f.family === 'family-margin');
    expect(margin.versions.map(v => [v.version, v.versionId])).toEqual([[3, 'version-margin-2'], [2, 'version-margin-theirs'], [1, 'version-margin-1']]);
    const model = await page.evaluate(() => fm.listFunctions({ of: 'model' }).filter(d => d.family === 'family-margin').map(d => [d.version, d.versionId]));
    expect(model).toEqual([[1, 'version-margin-1'], [2, 'version-margin-2']]);
    // The model still calculates with its own v2 (a percentage).
    expect(await page.evaluate(() => { fm.switchCanvas('Functions'); return fm.getValue('Margin v2', 1); })).toBe(40);
  });

  test('the wrong kind of file, and a file from a newer fmIDE', async ({ page }) => {
    expect(await err(page, () => fm.importFunctions({ kind: 'fmIDE-macros', version: 1, macros: [] }))).toMatch(/not a functions file/);
    expect(await err(page, () => fm.importFunctions({ kind: 'fmIDE-workspace', version: 4, system: null }))).toMatch(/Open it with File → Import Workspace/);
    expect(await importFile(page, 'library-newer-v3').then(() => null, e => e.message)).toMatch(/newer version of fmIDE.*allowNewer/);
    expect(await lib(page)).toEqual([]);
    expect(await importFile(page, 'library-newer-v3', { allowNewer: true })).toEqual({ added: 3, present: 0, renumbered: 0 });
  });

  test('Import Functions in the manager: a newer file asks first', async ({ page }) => {
    await F.importViaDialog(page, 'openFunctions', '⇧ Import Functions', fixture('functions', 'library-newer-v3.json'));
    expect(await F.dialogText(page)).toMatch(/This functions file was saved by a newer version of fmIDE \(format version 3; this fmIDE reads up to version 2\)/);
    await F.cancelDialog(page);
    expect(await lib(page)).toEqual([]);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), manager(page).locator('button', { hasText: '⇧ Import Functions' }).click()]);
    await chooser.setFiles(fixture('functions', 'library-newer-v3.json'));
    await F.confirmDanger(page);
    expect(await F.dialogText(page)).toBe('Imported 3 function versions.');
    await F.dismissMessage(page);
    await expect(manager(page).locator('button.function-family')).toHaveText([/Margin/, /Profit/]);
  });

  test('the Import Functions command, which the "wrong file" message points to', async ({ page }) => {
    await F.importViaCommand(page, 'loadSystem', fixture('functions', 'library.json'));
    expect(await F.dialogText(page)).toMatch(/That is an fmIDE functions file, not a system.*Open it with Functions → Import Functions/);
    await F.dismissMessage(page);
    await F.importViaCommand(page, 'importFunctions', fixture('functions', 'library.json'));
    expect(await F.dialogText(page)).toBe('Imported 3 function versions.');
  });

  test('Export in the manager: the ticked functions', async ({ page }) => {
    await importFile(page, 'library');
    await openManager(page);
    await manager(page).locator('button', { hasText: '⇩ Export Functions' }).click();
    const box = page.locator('.modal-box.function-export');
    await box.locator('label', { hasText: 'Margin' }).locator('input').uncheck();
    const { data } = await F.downloadJson(page, () => box.locator('button.primary', { hasText: 'Export' }).click());
    // Profit still takes the Margin it calls.
    expect(data.functions.map(d => d.family + '@' + d.version)).toEqual(['family-margin@1', 'family-profit@1']);
  });
});

// ---------- the manager and its editor ----------
test.describe('the Functions manager', () => {
  test('lists functions by family, with their versions, notes, formula and inputs', async ({ page }) => {
    await importFile(page, 'library');
    await openManager(page);
    await expect(manager(page).locator('button.function-family')).toHaveText([/Margin\s*v2/, /Profit\s*v1\s*⚠ calls an older version/]);
    const detail = manager(page).locator('.function-detail');
    await expect(detail.locator('h4')).toHaveText('Margin');
    await expect(detail.locator('.template-version-info')).toHaveText('Version 2 of 2 — As a percentage');
    await expect(detail.locator('.function-detail-text')).toHaveText('Margin(Revenue, Cost) = (Revenue - Cost) / Revenue * 100');
    await expect(detail.locator('.function-detail-inputs')).toHaveText('Inputs: Revenue, Cost');
    await manager(page).locator('button.template-versions-toggle').click();
    await manager(page).locator('button.template-version', { hasText: 'v1' }).click();
    await expect(detail.locator('.template-version-info')).toHaveText('Version 1 of 2 (an older version) — First version');
    await expect(detail.locator('button.function-delete')).toHaveText('🗑 Delete version 1');
    await manager(page).locator('button.function-family', { hasText: 'Profit' }).click();
    await expect(detail.locator('.function-detail-call')).toHaveText('Calls Margin v1 (the latest is v2: save a new version to use it)');
    // Search.
    await manager(page).locator('input.template-search').fill('prof');
    await expect(manager(page).locator('button.function-family')).toHaveText([/Profit/]);
  });

  test('the editor reads the formula as it is typed; Save stays off until it reads', async ({ page }) => {
    await openManager(page);
    await manager(page).locator('button.function-new').click();
    const save = editor(page).locator('button.fn-editor-save');
    await expect(save).toBeDisabled();
    await typeDefinition(page, 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenu');
    await expect(editor(page).locator('.fn-editor-error')).toHaveText('⚠ "Revenu" isn\'t one of this function\'s inputs.');
    await expect(editor(page).locator('.fn-editor-where mark')).toHaveText('Revenu');
    await expect(save).toBeDisabled();
    await typeDefinition(page, 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue');
    await expect(editor(page).locator('.fn-editor-error')).toHaveText('✓ The formula reads.');
    await expect(editor(page).locator('.fn-editor-parsed')).toHaveText('Margin — inputs: Revenue, Cost');
    await expect(editor(page).locator('.fn-editor-where')).toBeHidden();
    await editor(page).locator('.fn-editor-description').fill('Share left');
    await save.click();
    await expect(editor(page)).toHaveCount(0);
    await expect(manager(page).locator('button.function-family.active')).toHaveText(/Margin\s*v1/);
    // Edit as new version: starts from the text; the name must stay.
    await manager(page).locator('button.function-new-version').click();
    await expect(editor(page).locator('textarea.fn-editor-text')).toHaveValue('Margin(Revenue, Cost) = (Revenue - Cost) / Revenue');
    await expect(editor(page).locator('.fn-editor-description')).toHaveValue('Share left');
    await typeDefinition(page, 'Other(Revenue, Cost) = 1');
    await expect(editor(page).locator('.fn-editor-error')).toHaveText(/A new version keeps the name Margin/);
    await expect(editor(page).locator('button.fn-editor-save')).toBeDisabled();
    await typeDefinition(page, 'Margin(Revenue, Cost) = 1 - Cost / Revenue');
    await editor(page).locator('.fn-editor-note').fill('Shorter');
    await editor(page).locator('button.fn-editor-save', { hasText: 'Save version 2' }).click();
    expect(await summary(page)).toEqual(['Margin:2,1']);
    expect((await page.evaluate(() => fm.getFunction('Margin'))).note).toBe('Shorter');
  });

  test('the editor: a missing function blocks Save; two of one name ask which', async ({ page }) => {
    await importFile(page, 'library');
    await importFile(page, 'library-other-margin');
    await openManager(page);
    await manager(page).locator('button.function-new').click();
    await typeDefinition(page, 'Uses(r, c) = Nowhere(r)');
    await expect(editor(page).locator('.fn-editor-error')).toHaveText('⚠ Nowhere isn\'t in your library — create it first.');
    await expect(editor(page).locator('.fn-editor-call.missing')).toHaveText('Nowhere → not in your library');
    await typeDefinition(page, 'Uses(r, c) = Margin(r, c)');
    await expect(editor(page).locator('.fn-editor-error')).toHaveText(/More than one function in your library is called Margin/);
    await expect(editor(page).locator('button.fn-editor-save')).toBeDisabled();
    const pick = editor(page).locator('select.fn-editor-call-pick');
    await expect(pick.locator('option')).toHaveText([
      'Choose which function…',
      /^Margin v2 \(latest\) — The share of revenue left after cost, in percent\. \[family family-m\]$/,
      /^Margin v1 — The share/,
      /^Margin v1 \(latest\) — Someone else's Margin\./,
    ]);
    await pick.selectOption({ index: 3 });
    await expect(editor(page).locator('.fn-editor-error')).toHaveText('✓ The formula reads.');
    // An older version offers the latest.
    await pick.selectOption({ index: 1 });
    await editor(page).locator('button.fn-editor-use-latest', { hasText: 'Use the latest (v2)' }).click();
    await expect(pick).toHaveValue('0');
    await editor(page).locator('button.fn-editor-save').click();
    expect((await page.evaluate(() => fm.getFunction('Uses'))).calls[0]).toMatchObject({ family: 'family-margin', version: 2 });
  });

  test('a new function under a name in use: its next version, or another name', async ({ page }) => {
    await page.evaluate(() => fm.saveFunction({ text: 'Margin(a, b) = a - b' }));
    await openManager(page);
    await manager(page).locator('button.function-new').click();
    await typeDefinition(page, 'Margin(a, b) = b - a');
    await editor(page).locator('button.fn-editor-save').click();
    const ask = page.locator('.modal-box.function-name-taken');
    await expect(ask.locator('p')).toHaveText('There is already a function called Margin (version 1). Save this as its next version, or change the name?');
    await ask.locator('button', { hasText: 'Change the name' }).click();
    await expect(editor(page)).toBeVisible();
    await editor(page).locator('button.fn-editor-save').click();
    await ask.locator('button', { hasText: 'Save as new version of Margin' }).click();
    await expect(editor(page)).toHaveCount(0);
    expect(await summary(page)).toEqual(['Margin:2,1']);
  });
});

// ---------- undo, ribbon, macros ----------
test('the model\'s own definitions are part of undo history', async ({ page }, testInfo) => {
  await F.importViaCommand(page, 'loadSystem', fixture('functions', 'basic.json'));
  await F.acceptAll(page);
  await page.evaluate(() => fm.switchCanvas('Margin Block'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  const file = testInfo.outputPath('module.json');
  fs.writeFileSync(file, JSON.stringify(data));
  await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-current.json'));
  await F.acceptAll(page);
  const model = () => page.evaluate(() => fm.listFunctions({ of: 'model' }).map(d => d.family + '@' + d.version));
  expect(await model()).toEqual([]);
  await F.importViaCommand(page, 'loadModule', file);
  await F.acceptAll(page);
  expect(await model()).toEqual(['family-margin@1']);
  await page.evaluate(() => fm.command('undo'));
  expect(await model()).toEqual([]);
  await page.evaluate(() => fm.command('redo'));
  expect(await model()).toEqual(['family-margin@1']);
  // Loading a system replaces them, and undoing that brings them back.
  await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-current.json'));
  await F.acceptAll(page);
  expect(await model()).toEqual([]);
  await page.evaluate(() => fm.command('undo'));
  expect(await model()).toEqual(['family-margin@1']);
});

test.describe('the ribbon', () => {
  const insertGroups = (page) => page.evaluate(() => (__fmIDE.getRibbonConfig().tabs.find(t => t.id === 'insert') || { groups: [] }).groups.map(g => g.label));
  test('the Insert tab has My Functions; the operators are "Excel Functions"; File → Library has Functions', async ({ page }) => {
    expect(await insertGroups(page)).toEqual(['Nodes', 'Arithmetic', 'Compare', 'Excel Functions', 'My Functions', 'Library']);
    const library = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'file').groups.find(g => g.label === 'Library').items.map(i => i.cmd));
    expect(library).toEqual(['openTemplates', 'openFunctions', 'openFormats', 'openLibraryPack', 'saveLibraryPack']); // library packs since 8a (group 22)
    const commands = await page.evaluate(() => fm.commands().filter(c => /Functions/.test(c.id)));
    expect(commands).toEqual([
      { id: 'openFunctions', label: 'Functions', category: 'File', shortcut: null },
      { id: 'importFunctions', label: 'Import Functions…', category: 'File', shortcut: null },
    ]);
  });

  test('a ribbon customised before it existed gets My Functions once (on its Insert tab only); removing it is respected', async ({ page }, testInfo) => {
    const ws = (flag, groups) => {
      const system = JSON.parse(fs.readFileSync(fixture('formats', 'sys-current.json'), 'utf8'));
      return JSON.stringify({ kind: 'fmIDE-workspace', version: 4, system, ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: flag,
        ribbon: { qat: [], tabs: [{ id: 'insert', label: 'Insert', groups }] } } });
    };
    const file = (name, text) => { const p = testInfo.outputPath(name); fs.writeFileSync(p, text); return p; };
    await F.importViaCommand(page, 'importWorkspace', file('old.json', ws(undefined, [{ label: 'Mine', items: [{ cmd: 'addRect' }] }, { label: 'Library', items: [{ cmd: 'openTemplates' }] }])));
    await F.acceptAll(page);
    expect(await insertGroups(page)).toEqual(['Mine', 'My Functions', 'Library']);
    await F.importViaCommand(page, 'importWorkspace', file('removed.json', ws(true, [{ label: 'Mine', items: [{ cmd: 'addRect' }] }])));
    await F.acceptAll(page);
    expect(await insertGroups(page)).toEqual(['Mine']);
    // A ribbon without an Insert tab gets no group anywhere else.
    const noInsert = JSON.parse(ws(undefined, []));
    noInsert.ui.ribbon.tabs = [{ id: 'file', label: 'File', groups: [{ label: 'Only Mine', items: [{ cmd: 'saveSystem' }] }] }];
    await F.importViaCommand(page, 'importWorkspace', file('no-insert.json', JSON.stringify(noInsert)));
    await F.acceptAll(page);
    expect(await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.map(t => t.id + ':' + t.groups.map(g => g.label).join(',')))).toEqual(['file:Only Mine']);
  });
});

test('a macro records saving, importing and deleting functions, and plays them back', async ({ page }) => {
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await openManager(page);
  await manager(page).locator('button.function-new').click();
  await typeDefinition(page, 'Half(x) = x / 2');
  await editor(page).locator('button.fn-editor-save').click();
  await page.keyboard.press('Escape');
  await page.evaluate((file) => fm.importFunctions(file), read('library'));
  await page.evaluate(() => fm.deleteFunction('Margin@1'));
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['saveFunction', 'importFunctions', 'deleteFunction']);
  expect(macro.steps[0].args).toMatchObject({ text: 'Half(x) = x / 2' });
  expect(macro.steps[2].args).toEqual({ function: 'Margin@1' });
  // Played back on an empty library, it does the same.
  await page.evaluate(() => { fm.deleteFunction('Half'); fm.deleteFunction('Margin'); fm.deleteFunction('Profit'); });
  expect(await lib(page)).toEqual([]);
  await page.evaluate((name) => fm.runMacro(name), macro.name);
  expect(await summary(page)).toEqual(['Half:1', 'Margin:2', 'Profit:1']);
});

// ---------- function nodes on the canvas (phase D2b) ----------
// An empty model with two rectangles, Revenue 100 and Cost 60, and the library sample (Margin v1, v2; Profit v1 → Margin v1).
async function setupCanvas(page){
  await importFile(page, 'library');
  return page.evaluate(() => ({
    cleared: fm.clearAll(),
    rev: fm.createRect({ x: 20, y: 20, name: 'Revenue', value: '100' }),
    cost: fm.createRect({ x: 20, y: 140, name: 'Cost', value: '60' }),
  }));
}
const fnNode = (page, id) => page.locator(`.node.functionNode[data-id="${id}"]`);
const modelDefs = (page) => page.evaluate(() => fm.listFunctions({ of: 'model' }).map(d => d.family + '@' + d.version).sort());
const fnOf = (page, id) => page.evaluate((id) => fm.nodes().find(n => n.id === id).fn, id);
const value = (page, id) => page.evaluate((id) => fm.getValue(id), id);
const edgesInto = (page, id) => page.evaluate((id) => fm.edges().filter(e => e.to === id).map(e => e.from + '→' + e.toPort).sort(), id);
// A system file (written for the test) holding one canvas with `nodes`, `edges` and `functions`.
function systemFile(testInfo, name, nodes, edges, functions){
  const sys = { kind: 'system', version: 5, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes, edges }] };
  if(functions) sys.functions = functions;
  const p = testInfo.outputPath(name + '.json');
  fs.writeFileSync(p, JSON.stringify(sys));
  return p;
}
async function loadSystem(page, file){
  await F.importViaCommand(page, 'loadSystem', file);
  await F.acceptAll(page);
}
const REV = { id: 'rev', type: 'value', x: 0, y: 0, w: 170, h: 64, text: 'Revenue\n100' };
const COST = { id: 'cost', type: 'value', x: 0, y: 120, w: 170, h: 64, text: 'Cost\n60' };
const lib1 = () => read('library').functions;

test.describe('function nodes', () => {
  test('Insert: a node for the chosen version, its definition (and what it calls) copied into the model; one undo step', async ({ page }) => {
    await setupCanvas(page);
    const m1 = await page.evaluate(() => fm.insertFunction({ function: 'Margin@1', x: 300, y: 20 }));
    expect(await fnOf(page, m1)).toEqual({ family: 'family-margin', version: 1, versionId: 'version-margin-1', name: 'Margin' });
    expect((await page.evaluate(() => fm.nodes())).find(n => n.id === m1)).toMatchObject({ type: 'function', w: 190 });
    expect(await modelDefs(page)).toEqual(['family-margin@1']);
    // The latest by name, by family id, and a function that calls another.
    const m2 = await page.evaluate(() => fm.insertFunction('Margin'));
    expect((await fnOf(page, m2)).version).toBe(2);
    expect((await fnOf(page, await page.evaluate(() => fm.insertFunction('family-margin@1')))).version).toBe(1);
    await page.evaluate(() => fm.insertFunction('Profit'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
    // Undo takes back the node and the definitions it brought; redo returns both.
    await page.evaluate(() => fm.command('undo'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2']);
    await page.evaluate(() => fm.command('redo'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
    expect(await err(page, () => fm.insertFunction('Nope'))).toMatch(/no function called "Nope"/);
  });

  test('Insert refuses a version when the model carries a different one under the same number', async ({ page }, testInfo) => {
    await importFile(page, 'library');
    // A model carrying someone else's Margin v2.
    const theirs = read('library-fork').functions[0];
    await loadSystem(page, systemFile(testInfo, 'theirs', [REV, COST, { id: 'f', type: 'function', x: 250, y: 0, w: 190, h: 80, fn: { family: 'family-margin', version: 2, versionId: 'version-margin-theirs', name: 'Margin' } }], [], [theirs]));
    const before = await page.evaluate(() => fm.nodes().length);
    expect(await err(page, () => fm.insertFunction('Margin@2'))).toMatch(/already uses a different version 2 of Margin.*Update/);
    expect(await page.evaluate(() => fm.nodes().length)).toBe(before);
    // Margin v1 has a free number: fine.
    await page.evaluate(() => fm.insertFunction('Margin@1'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2']);
  });

  test('the Insert Function picker: search, the latest version by default, the family id when names are shared', async ({ page }) => {
    await setupCanvas(page);
    await importFile(page, 'library-other-margin');
    await page.evaluate(() => fm.command('insertFunction'));
    const picker = page.locator('.modal-box.function-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.function-picker-row')).toHaveCount(3);
    await expect(picker.locator('.function-picker-row .sub').first()).toContainText('family family-margin');
    await picker.locator('input.function-picker-search').fill('prof');
    await expect(picker.locator('.function-picker-row')).toHaveCount(1);
    await picker.locator('input.function-picker-search').fill('');
    await picker.locator('.function-picker-row').first().click();
    await expect(picker.locator('select.function-picker-version option:checked')).toHaveText(/^v2 \(latest\)/);
    await picker.locator('select.function-picker-version').selectOption({ index: 1 });
    await expect(picker.locator('.function-picker-detail')).toHaveText(/Inputs: Revenue, Cost/);
    await picker.locator('button.function-picker-ok').click();
    await expect(picker).toHaveCount(0);
    const [n] = await page.evaluate(() => fm.nodes().filter(n => n.type === 'function'));
    expect(n.fn).toMatchObject({ family: 'family-margin', version: 1 });
    expect(await page.evaluate(() => fm.selection())).toEqual([n.id]);
  });

  test('drawing: title, labelled inputs, the value or "?" with its reason, the unit', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    await page.evaluate(([rev, cost]) => { fm.setUOM(rev, '$k'); fm.setUOM(cost, '$k'); }, [rev, cost]);
    const p = await page.evaluate(() => fm.insertFunction({ function: 'Profit', x: 300, y: 20 }));
    const node = fnNode(page, p);
    await expect(node.locator('.fn-header')).toHaveText('ƒ Profit v1');
    await expect(node.locator('.fn-in .io-label')).toHaveText(['Revenue', 'Cost']);
    await expect(node.locator('.fn-value')).toHaveText('?');
    await expect(node.locator('.fn-value')).toHaveAttribute('title', /inputs isn't connected/);
    await page.evaluate(([rev, cost, p]) => { fm.connect(rev, p, '', 'Revenue'); fm.connect(cost, p, '', 'cost'); fm.evaluate(); }, [rev, cost, p]);
    await expect(node.locator('.fn-value')).toHaveText('= 40');
    await expect(node.locator('.fn-unit')).toHaveText('$k');
    await expect(node.locator('.fn-update-btn')).toHaveCount(0);
    // Its output feeds a rectangle like any node.
    const out = await page.evaluate(() => fm.createRect({ x: 600, y: 20, name: 'Out', value: '' }));
    await page.evaluate(([p, out]) => fm.connect(p, out), [p, out]);
    expect(await value(page, out)).toBe(40);
  });

  test('fm.connect takes an input by name or number; wrong ports say why; a second arrow into a port replaces the first', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction('Margin@1'));
    expect(await err(page, () => fm.connect('Revenue', fm.nodes().find(n => n.type === 'function').id))).toMatch(/has 2 inputs — say which one \(Revenue, Cost\)/);
    expect(await err(page, () => fm.connect('Revenue', fm.nodes().find(n => n.type === 'function').id, '', 'Price'))).toMatch(/no input called "Price" \(its inputs: Revenue, Cost\)/);
    expect(await err(page, () => fm.connect('Revenue', fm.nodes().find(n => n.type === 'function').id, '', '3'))).toMatch(/no input #3/);
    expect(await err(page, () => fm.connect(fm.nodes().find(n => n.type === 'function').id, 'Revenue', '1'))).toMatch(/no output ports/);
    await page.evaluate(([m]) => { fm.connect('Revenue', m, '', '1'); fm.connect('Revenue', m, '', 'COST'); }, [m]);
    expect(await edgesInto(page, m)).toEqual([rev + '→0', rev + '→1']);
    await page.evaluate(([m]) => fm.connect('Cost', m, '', 'Cost'), [m]);
    expect(await edgesInto(page, m)).toEqual([rev + '→0', cost + '→1']);
    expect(await value(page, m)).toBeCloseTo(0.4, 10);
    await page.evaluate(([m]) => fm.deleteEdge('Cost', m, 'cost'), [m]);
    expect(await edgesInto(page, m)).toEqual([rev + '→0']);
  });

  test('dragging an arrow: onto an input\'s dot, or onto the body (its first free input)', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction({ function: 'Margin@1', x: 400, y: 60 }));
    const drag = async (fromId, target) => {
      const a = await page.locator(`.node[data-id="${fromId}"] .label`).boundingBox();
      const b = await target.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
      await page.mouse.up({ button: 'right' });
    };
    // Onto the Cost input's dot.
    await drag(cost, fnNode(page, m).locator('.io-port[data-port-dir="in"][data-port-index="1"]'));
    expect(await edgesInto(page, m)).toEqual([cost + '→1']);
    // Onto the body: the first input without an arrow (Revenue).
    await drag(rev, fnNode(page, m).locator('.fn-header'));
    expect(await edgesInto(page, m)).toEqual([cost + '→1', rev + '→0'].sort());
    // Every input wired: it says to drop on the input to replace.
    await drag(rev, fnNode(page, m).locator('.fn-header'));
    expect(await F.dialogText(page)).toMatch(/Every input of ƒ Margin already has an arrow/);
    await F.dismissMessage(page);
    // Dragging from its output dot draws an arrow out.
    const out = await page.evaluate(() => fm.createRect({ x: 700, y: 60, name: 'Out', value: '' }));
    const dot = await fnNode(page, m).locator('.fn-out-port').boundingBox();
    const t = await page.locator(`.node[data-id="${out}"] .label`).boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(([m, out]) => fm.edges().filter(e => e.from === m && e.to === out).map(e => e.fromPort), [m, out])).toEqual([undefined]);
    expect(await value(page, out)).toBeCloseTo(0.4, 10);
  });

  test('the D1 samples draw: a missing definition, an unreadable one, and working ones', async ({ page }) => {
    await loadSystem(page, fixture('functions', 'broken.json'));
    await expect(fnNode(page, 'fmiss').locator('.fn-header')).toHaveText('ƒ Gone v1');
    await expect(fnNode(page, 'fmiss').locator('.fn-warning')).toHaveText('⚠ Definition missing');
    await expect(fnNode(page, 'fmiss').locator('.fn-value')).toHaveText('?');
    await expect(fnNode(page, 'fmiss').locator('.fn-value')).toHaveAttribute('title', /definition isn't in the model/);
    await expect(fnNode(page, 'fbad').locator('.fn-warning')).toHaveText("⚠ Formula can't be read");
    // Without a readable definition its arrows land on numbered ports.
    await expect(fnNode(page, 'fvid').locator('.fn-in .io-label')).toHaveText(['#1', '#2']);
    expect(await err(page, () => fm.connect('Revenue', '#fmiss'))).toMatch(/definition isn't in the model/);
    await loadSystem(page, fixture('functions', 'basic.json'));
    await expect(fnNode(page, 'fm1').locator('.fn-header')).toHaveText('ƒ Margin v1');
    await expect(fnNode(page, 'fm1').locator('.fn-value')).toHaveText('= 0.4');
    await expect(fnNode(page, 'fband').locator('.fn-in .io-label')).toHaveCount(3);
    await expect(page.locator('.node.functionNode .fn-warning')).toHaveCount(0);
  });

  test('a missing definition the library has (the same versionId) can be added back from the node\'s menu', async ({ page }, testInfo) => {
    await importFile(page, 'library');
    await loadSystem(page, systemFile(testInfo, 'no-defs', [REV, COST, { id: 'f', type: 'function', x: 250, y: 0, w: 190, h: 80, fn: { family: 'family-margin', version: 1, versionId: 'version-margin-1', name: 'Margin' } }],
      [{ id: 'e1', from: 'rev', to: 'f', toPort: 0 }, { id: 'e2', from: 'cost', to: 'f', toPort: 1 }]));
    await expect(fnNode(page, 'f').locator('.fn-warning')).toHaveAttribute('title', /Your library has this exact version/);
    await fnNode(page, 'f').locator('.fn-menu-btn').click();
    await page.locator('.function-node-menu button.fn-menu-repair').click();
    await expect(fnNode(page, 'f').locator('.fn-value')).toHaveText('= 0.4');
    expect(await modelDefs(page)).toEqual(['family-margin@1']);
    await page.evaluate(() => fm.command('undo'));
    expect(await modelDefs(page)).toEqual([]);
  });

  test('⬆ shows on a node whose version is older than the library\'s latest (by versionId), and "Not now" hides it until a newer one', async ({ page }, testInfo) => {
    await setupCanvas(page);
    const m1 = await page.evaluate(() => fm.insertFunction('Margin@1'));
    const m2 = await page.evaluate(() => fm.insertFunction('Margin@2'));
    await expect(fnNode(page, m1).locator('.fn-update-btn')).toHaveAttribute('title', /Version 2 of Margin is in your library/);
    await expect(fnNode(page, m2).locator('.fn-update-btn')).toHaveCount(0);
    // Not now, from the menu: remembered on the node as the version declined.
    await fnNode(page, m1).locator('.fn-update-btn').click();
    await page.locator('.function-node-menu button.fn-menu-skip').click();
    await expect(fnNode(page, m1).locator('.fn-update-btn')).toHaveCount(0);
    expect((await fnOf(page, m1)).skipped).toBe(2);
    await page.evaluate(() => fm.command('undo'));
    await expect(fnNode(page, m1).locator('.fn-update-btn')).toHaveCount(1);
    await page.evaluate(() => fm.command('redo'));
    await expect(fnNode(page, m1).locator('.fn-update-btn')).toHaveCount(0);
    // A newer version brings it back.
    await page.evaluate(() => fm.saveFunction({ text: 'Margin(Revenue, Cost) = 1 - Cost / Revenue', newVersionOf: 'Margin' }));
    await page.evaluate(() => fm.evaluate());
    await expect(fnNode(page, m1).locator('.fn-update-btn')).toHaveAttribute('title', /Version 3/);
    // A node of the same number but someone else's version (another versionId): no ⬆.
    await loadSystem(page, fixture('functions', 'broken.json'));
    await expect(fnNode(page, 'fvid').locator('.fn-update-btn')).toHaveCount(0);
    await expect(fnNode(page, 'funw').locator('.fn-update-btn')).toHaveCount(1);
  });

  test('Update one node: arrows follow their inputs by name; missing inputs drop their arrows after asking; one undo step', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction('Margin@1'));
    await page.evaluate(([m]) => { fm.connect('Revenue', m, '', 'Revenue'); fm.connect('Cost', m, '', 'Cost'); }, [m]);
    // v2: the same inputs — nothing lost.
    expect(await page.evaluate(([m]) => fm.updateFunctionNode(m, '2'), [m])).toEqual({ version: 2, dropped: [] });
    expect(await value(page, m)).toBeCloseTo(40, 10);
    expect(await modelDefs(page)).toEqual(['family-margin@2']);
    // v3 renames Cost to Costs and swaps the order.
    await page.evaluate(() => fm.saveFunction({ text: 'Margin(Costs, Revenue) = (Revenue - Costs) / Revenue', newVersionOf: 'Margin' }));
    await page.evaluate(() => fm.evaluate());
    await fnNode(page, m).locator('.fn-update-btn').click();
    await page.locator('.function-node-menu button.fn-menu-update').click();
    expect(await F.dialogText(page)).toMatch(/Version 3 of Margin has no input for this arrow[\s\S]*the arrow from "Cost" into “Cost”/);
    await F.confirmDanger(page);
    expect((await fnOf(page, m)).version).toBe(3);
    expect(await edgesInto(page, m)).toEqual([rev + '→1']);
    await expect(fnNode(page, m).locator('.fn-in .io-label')).toHaveText(['Costs', 'Revenue']);
    expect(await modelDefs(page)).toEqual(['family-margin@3']);
    await page.evaluate(() => fm.command('undo'));
    expect((await fnOf(page, m)).version).toBe(2);
    expect(await edgesInto(page, m)).toEqual([rev + '→0', cost + '→1']);
    expect(await modelDefs(page)).toEqual(['family-margin@2']);
    // The fm action reports what it dropped.
    expect(await page.evaluate(([m]) => fm.updateFunctionNode(m), [m])).toEqual({ version: 3, dropped: [{ node: m, canvas: 'Canvas 1', input: 'Cost', from: '"Cost"' }] });
  });

  test('Update every use: older nodes ticked, "Not now" ones shown unticked, current ones left out; lost arrows listed; one undo step', async ({ page }) => {
    await setupCanvas(page);
    const ids = await page.evaluate(() => {
      const a = fm.insertFunction('Margin@1'), b = fm.insertFunction('Margin@1'), c = fm.insertFunction('Margin@2');
      fm.connect('Revenue', a, '', 'Revenue'); fm.connect('Cost', a, '', 'Cost');
      fm.connect('Cost', b, '', 'Cost');
      return { a, b, c };
    });
    await page.evaluate(() => fm.saveFunction({ text: 'Margin(Revenue, Costs) = (Revenue - Costs) / Revenue', newVersionOf: 'Margin' }));
    await page.evaluate(([b]) => fm.skipFunctionUpdate(b), [ids.b]);
    // On another canvas, one more.
    const other = await page.evaluate(() => { fm.addCanvas('Second'); const n = fm.insertFunction('Margin@2'); fm.switchCanvas('Canvas 1'); return n; });
    await fnNode(page, ids.a).locator('.fn-menu-btn').click();
    await page.locator('.function-node-menu button.fn-menu-update-all').click();
    const win = page.locator('.modal-box.function-uses');
    await expect(win.locator('p').first()).toHaveText('Update Margin to version 3');
    await expect(win.locator('.function-use-row')).toHaveCount(4);
    const row = (id) => win.locator(`.function-use-row[data-node="${id}"]`);
    await expect(row(ids.a).locator('input')).toBeChecked();
    await expect(row(ids.b).locator('input')).not.toBeChecked();
    await expect(row(ids.b)).toContainText('(“Not now”)');
    await expect(row(ids.c).locator('input')).toBeChecked();
    await expect(row(other).locator('input')).toBeChecked();
    await expect(row(ids.a).locator('.function-use-lost')).toHaveText('Loses the arrow from "Cost" into “Cost”');
    await row(ids.c).locator('input').uncheck();
    await win.locator('button.function-uses-update').click();
    const versions = () => page.evaluate(() => { const out = {}; fm.canvases().forEach(c => { fm.switchCanvas(c.id); fm.nodes().filter(n => n.type === 'function').forEach(n => { out[n.id] = n.fn.version; }); }); fm.switchCanvas('Canvas 1'); return out; });
    expect(await versions()).toEqual({ [ids.a]: 3, [ids.b]: 1, [ids.c]: 2, [other]: 3 });
    expect(await edgesInto(page, ids.a)).toEqual([(await page.evaluate(() => fm.find('Revenue'))) + '→0']);
    await page.evaluate(() => fm.command('undo'));
    expect(await versions()).toEqual({ [ids.a]: 1, [ids.b]: 1, [ids.c]: 2, [other]: 2 });
    expect(await edgesInto(page, ids.a)).toHaveLength(2);
    // The fm action without nodes: the ticked ones (a, c and the other canvas's).
    const r = await page.evaluate(() => fm.updateFunctionUses('Margin'));
    expect(r.updated).toBe(3);
    expect(r.dropped).toEqual([{ node: ids.a, canvas: 'Canvas 1', input: 'Cost', from: '"Cost"' }]);
    expect(await versions()).toEqual({ [ids.a]: 3, [ids.b]: 1, [ids.c]: 3, [other]: 3 });
    expect(await page.evaluate(([b]) => fm.updateFunctionUses({ function: 'Margin', nodes: ['#' + b] }), [ids.b])).toMatchObject({ updated: 1 });
    // Update Function… with nothing older: says so.
    await page.evaluate(() => fm.command('clearSelection'));
    await page.evaluate(() => fm.command('updateFunction'));
    expect(await F.dialogText(page)).toMatch(/Every function node in this model is on the latest version/);
  });

  test('Change function or version: in place, keeping arrows whose inputs match by name', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction('Margin@2'));
    await page.evaluate(([m]) => { fm.connect('Revenue', m, '', 'Revenue'); fm.connect('Cost', m, '', 'Cost'); }, [m]);
    await page.evaluate(() => fm.saveFunction({ text: 'Spread(Revenue, Other) = Revenue - Other' }));
    await fnNode(page, m).locator('.fn-menu-btn').click();
    await page.locator('.function-node-menu button.fn-menu-change').click();
    const picker = page.locator('.modal-box.function-picker');
    await expect(picker.locator('.function-picker-row.active')).toContainText('Margin');
    await picker.locator('input.function-picker-search').fill('Profit');
    await picker.locator('button.function-picker-ok').click();
    expect(await fnOf(page, m)).toMatchObject({ family: 'family-profit', version: 1, name: 'Profit' });
    expect(await edgesInto(page, m)).toEqual([rev + '→0', cost + '→1']);
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-profit@1']);
    expect(await value(page, m)).toBeCloseTo(40, 10);
    expect(await page.evaluate(([m]) => fm.changeFunction(m, 'Spread'), [m])).toEqual({ dropped: [{ node: m, canvas: 'Canvas 1', input: 'Cost', from: '"Cost"' }] });
    expect(await modelDefs(page)).toEqual([expect.stringMatching(/@1$/)]);
    await page.evaluate(() => fm.command('undo'));
    expect((await fnOf(page, m)).name).toBe('Profit');
  });

  test('double-click shows the definition: in the Functions manager when the library has that version', async ({ page }) => {
    await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction('Margin@1'));
    await fnNode(page, m).locator('.fn-header').dblclick({ force: true });
    await expect(manager(page).locator('.template-version-info')).toContainText('Version 1 of 2');
    await expect(manager(page).locator('.function-detail-text')).toHaveText('Margin(Revenue, Cost) = (Revenue - Cost) / Revenue');
    // The manager's Insert button adds a node for the shown version.
    await manager(page).locator('button.function-insert').click();
    await expect(manager(page)).toHaveCount(0);
    expect(await page.evaluate(() => fm.nodes().filter(n => n.type === 'function').map(n => n.fn.version))).toEqual([1, 1]);
  });

  test('deleting the last node of a function removes its definition, in the same undo step', async ({ page }) => {
    await setupCanvas(page);
    const [a, b] = await page.evaluate(() => [fm.insertFunction('Profit'), fm.insertFunction('Margin@2')]);
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
    await page.evaluate(([a]) => fm.deleteNodes(a), [a]);
    expect(await modelDefs(page)).toEqual(['family-margin@2']);
    await page.evaluate(() => fm.command('undo'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
    await page.evaluate(([b]) => { fm.select(b); fm.deleteSelected(); }, [b]);
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-profit@1']);
    await page.evaluate(() => fm.clearCanvas());
    expect(await modelDefs(page)).toEqual([]);
    await page.evaluate(() => fm.command('undo'));
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-profit@1']);
  });

  test('copy and paste into a new document: the definitions travel, calculate, and join the library', async ({ page }) => {
    const { rev, cost } = await setupCanvas(page);
    const p = await page.evaluate(() => fm.insertFunction('Profit'));
    await page.evaluate(([p]) => { fm.connect('Revenue', p, '', 'Revenue'); fm.connect('Cost', p, '', 'Cost'); }, [p]);
    await page.evaluate(([ids]) => fm.copy(ids.join(',').split(',').map(id => '#' + id).join(',')), [[rev, cost, p]]);
    // A new document, and a library that has lost them.
    await page.evaluate(() => fm.command('newDocument'));
    await page.locator('.modal-box button', { hasText: "Don't save" }).click();
    await page.evaluate(() => { fm.deleteFunction('Profit'); fm.deleteFunction('Margin'); });
    expect(await lib(page)).toEqual([]);
    const pasted = await page.evaluate(() => fm.paste());
    expect(pasted).toHaveLength(3);
    const node = await page.evaluate(() => fm.nodes().find(n => n.type === 'function'));
    expect(await value(page, node.id)).toBeCloseTo(40, 10);
    expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-profit@1']);
    expect(await summary(page)).toEqual(['Profit:1', 'Margin:1']);
    await page.evaluate(() => fm.command('undo'));
    expect(await modelDefs(page)).toEqual([]);
    expect(await page.evaluate(() => fm.nodes().length)).toBe(0);
  });

  test('pasting a different version under a number the model already uses: it comes in under the next number, and still calculates', async ({ page }, testInfo) => {
    await setupCanvas(page);
    const m = await page.evaluate(() => fm.insertFunction('Margin@2'));
    await page.evaluate(([m]) => { fm.connect('Revenue', m, '', 'Revenue'); fm.connect('Cost', m, '', 'Cost'); fm.copy('@all'); }, [m]);
    // A model carrying someone else's Margin v2.
    const theirs = read('library-fork').functions[0];
    await loadSystem(page, systemFile(testInfo, 'theirs', [REV, COST, { id: 'f', type: 'function', x: 250, y: 0, w: 190, h: 80, fn: { family: 'family-margin', version: 2, versionId: 'version-margin-theirs', name: 'Margin' } }],
      [{ id: 'e1', from: 'rev', to: 'f', toPort: 0 }, { id: 'e2', from: 'cost', to: 'f', toPort: 1 }], [theirs]));
    await page.evaluate(() => fm.paste());
    const fns = await page.evaluate(() => fm.nodes().filter(n => n.type === 'function').map(n => ({ id: n.id, fn: n.fn })));
    expect(fns.map(n => n.fn.version + ':' + n.fn.versionId)).toEqual(['2:version-margin-theirs', '3:version-margin-2']);
    const defs = await page.evaluate(() => fm.listFunctions({ of: 'model' }));
    expect(defs.map(d => d.version + ':' + d.versionId)).toEqual(['2:version-margin-theirs', '3:version-margin-2']);
    expect(defs[1].note).toMatch(/Was v2 where it came from/);
    expect(await value(page, '#f')).toBeCloseTo(0.4, 10);         // 1 - 60/100
    expect(await value(page, fns[1].id)).toBeCloseTo(40, 10);    // (100-60)/100*100
    // Pasting again uses the same renumbered copy.
    await page.evaluate(() => fm.paste());
    expect((await page.evaluate(() => fm.listFunctions({ of: 'model' }))).length).toBe(2);
  });

  test('bringing in a module with a different version under a taken number renumbers it too (it used to show "?")', async ({ page }, testInfo) => {
    await setupCanvas(page);
    await page.evaluate(() => fm.insertFunction('Margin@2'));
    const theirs = read('library-fork').functions[0];
    const mod = { kind: 'module', version: 3, name: 'Theirs', selfCanvasId: 'x', nodes: [REV, COST, { id: 'f', type: 'function', x: 250, y: 0, w: 190, h: 80, fn: { family: 'family-margin', version: 2, versionId: 'version-margin-theirs', name: 'Margin' } }],
      edges: [{ id: 'e1', from: 'rev', to: 'f', toPort: 0 }, { id: 'e2', from: 'cost', to: 'f', toPort: 1 }], functions: [theirs] };
    const file = testInfo.outputPath('theirs-module.json');
    fs.writeFileSync(file, JSON.stringify(mod));
    await F.importViaCommand(page, 'loadModule', file);
    await F.acceptAll(page);
    const fns = await page.evaluate(() => fm.nodes().filter(n => n.type === 'function'));
    expect(fns.map(n => n.fn.version + ':' + n.fn.versionId)).toEqual(['2:version-margin-2', '3:version-margin-theirs']);
    expect(await value(page, fns[1].id)).toBeCloseTo(0.4, 10);
  });
});

test.describe('the ribbon (D2b)', () => {
  test('Insert Function… and Update Function… in My Functions, Insert Function… in Home → Insert, no shortcuts', async ({ page }) => {
    const cfg = await page.evaluate(() => __fmIDE.getRibbonConfig());
    const group = (tab, pred) => cfg.tabs.find(t => t.id === tab).groups.find(pred).items.map(i => i.cmd);
    expect(group('insert', g => g.id === 'myFunctions')).toEqual(['openFunctions', 'insertFunction', 'updateFunction', 'importFunctions']);
    expect(group('home', g => g.label === 'Insert')).toContain('insertFunction');
    expect(await page.evaluate(() => fm.commands().filter(c => /Function$/.test(c.id)))).toEqual([
      { id: 'insertFunction', label: 'Insert Function…', category: 'Insert', shortcut: null },
      { id: 'updateFunction', label: 'Update Function…', category: 'Insert', shortcut: null },
    ]);
  });

  test('a customised ribbon\'s My Functions group gets the new commands once, wherever it is; removing them is respected', async ({ page }, testInfo) => {
    const ws = (flag, groups) => {
      const system = JSON.parse(fs.readFileSync(fixture('formats', 'sys-current.json'), 'utf8'));
      return JSON.stringify({ kind: 'fmIDE-workspace', version: 4, system, ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: flag,
        ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups }] } } });
    };
    const file = (name, text) => { const p = testInfo.outputPath(name); fs.writeFileSync(p, text); return p; };
    const items = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
    await F.importViaCommand(page, 'importWorkspace', file('d2a.json', ws(undefined, [{ id: 'myFunctions', label: 'My Functions', items: [{ cmd: 'openFunctions' }, { cmd: 'importFunctions' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['My Functions:openFunctions,insertFunction,updateFunction,importFunctions']);
    await F.importViaCommand(page, 'importWorkspace', file('removed.json', ws(true, [{ id: 'myFunctions', label: 'My Functions', items: [{ cmd: 'openFunctions' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['My Functions:openFunctions']);
    // Without the group, nothing is added.
    await F.importViaCommand(page, 'importWorkspace', file('none.json', ws(undefined, [{ label: 'Other', items: [{ cmd: 'addRect' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Other:addRect']);
  });
});

test('a macro records inserting, wiring, updating and "Not now" on function nodes, and plays them back', async ({ page }) => {
  await setupCanvas(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.evaluate(() => {
    const a = fm.insertFunction({ function: 'Margin@1', x: 300, y: 20 });
    fm.connect('Revenue', a, '', '1');
    fm.connect('Cost', a, '', '2');
    const b = fm.insertFunction({ function: 'Margin@1', x: 300, y: 200 });
    fm.skipFunctionUpdate(b);
    fm.updateFunctionNode(a);
    fm.changeFunction(b, 'Profit');
  });
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['insertFunction', 'connect', 'connect', 'insertFunction', 'skipFunctionUpdate', 'updateFunctionNode', 'changeFunction']);
  expect(macro.steps[0].args).toMatchObject({ function: 'Margin@1' });
  expect(macro.steps[1].args.toPort).toBe('Revenue');
  expect(macro.steps[2].args.toPort).toBe('Cost');
  // Played back on an empty canvas with the two rectangles, it builds the same.
  await page.evaluate(() => { fm.clearCanvas(); fm.createRect({ x: 20, y: 20, name: 'Revenue', value: '100' }); fm.createRect({ x: 20, y: 140, name: 'Cost', value: '60' }); });
  await page.evaluate((name) => fm.runMacro(name), macro.name);
  const fns = await page.evaluate(() => fm.nodes().filter(n => n.type === 'function').map(n => n.fn.name + ' v' + n.fn.version + (n.fn.skipped ? ' skipped ' + n.fn.skipped : '')));
  expect(fns).toEqual(['Margin v2', 'Profit v1']);
  expect(await modelDefs(page)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
});
