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
    expect(all.version).toBe(1);
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
    expect(await importFile(page, 'library-newer-v2').then(() => null, e => e.message)).toMatch(/newer version of fmIDE.*allowNewer/);
    expect(await lib(page)).toEqual([]);
    expect(await importFile(page, 'library-newer-v2', { allowNewer: true })).toEqual({ added: 3, present: 0, renumbered: 0 });
  });

  test('Import Functions in the manager: a newer file asks first', async ({ page }) => {
    await F.importViaDialog(page, 'openFunctions', '⇧ Import Functions', fixture('functions', 'library-newer-v2.json'));
    expect(await F.dialogText(page)).toMatch(/This functions file was saved by a newer version of fmIDE \(format version 2; this fmIDE reads up to version 1\)/);
    await F.cancelDialog(page);
    expect(await lib(page)).toEqual([]);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), manager(page).locator('button', { hasText: '⇧ Import Functions' }).click()]);
    await chooser.setFiles(fixture('functions', 'library-newer-v2.json'));
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
    expect(library).toEqual(['openTemplates', 'openFunctions', 'openFormats']);
    const commands = await page.evaluate(() => fm.commands().filter(c => /Functions/.test(c.id)));
    expect(commands).toEqual([
      { id: 'openFunctions', label: 'Functions', category: 'File', shortcut: null },
      { id: 'importFunctions', label: 'Import Functions…', category: 'File', shortcut: null },
    ]);
  });

  test('a ribbon customised before it existed gets My Functions once; removing it is respected', async ({ page }, testInfo) => {
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
