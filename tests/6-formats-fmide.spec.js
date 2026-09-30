// 6. File formats — fmIDE: current, legacy, newer-version and wrong-kind files.
const fs = require('fs');
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

// A newer system is v8 since system v7 (step 11a, the Excel look moved to ExcelExporter)
// became current.
test('sys-newer-v8 asks first: Cancel keeps the current canvases, OK opens it', async ({ page }) => {
  await F.importViaCommand(page, 'loadSystem', file('sys-newer-v8'));
  const text = await F.dialogText(page);
  expect(text).toContain('newer version');
  expect(text).toContain('format version 8');
  await F.cancelDialog(page);
  await expect(page.locator('.modal-box')).toHaveCount(0);
  expect(await canvasNames(page)).toEqual(['Before load']);

  await F.importViaCommand(page, 'loadSystem', file('sys-newer-v8'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toContain('format version 8');
  expect(seen[1]).toMatch(/^Load this system\?/);
  expect(await canvasNames(page)).toEqual(['Revenue Model']);
});

const WRONG_KIND = [
  ['loadSystem', 'templates', /^That is an fmIDE templates file, not a system\. Open it with Templates → Import Templates\.$/],
  ['loadModule', 'sys-current', /^That is an fmIDE system, not a module\./],
  ['loadSystem', 'mapping', /ExcelExporter/],
  ['loadSystem', 'map-legacy', /^That is an ExcelExporter mapping file — open it in ExcelExporter/], // saved before kinds were written
  ['loadSystem', 'preferences', /^That is an fmIDE preferences file, not a system\. Open it with File → Import Preferences\.$/],
  ['loadSystem', 'functions', /^That is an fmIDE functions file, not a system\. Open it with Functions → Import Functions\.$/],
  ['loadSystem', 'excel-style', /^That is an ExcelExporter Excel style file — import it in ExcelExporter/],
  ['loadSystem', 'module-layouts', /^That is an ExcelExporter module layouts file — import it in ExcelExporter/],
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
  await F.importViaDialog(page, 'openMacros', '⇧ Import', file('macros-bare'), { newBox: false });
  const builder = page.locator('.modal-box.macro-box');
  await expect(builder).toContainText('Imported 1 macro.');
  await expect(builder).toContainText('Bare List Macro');
});

for(const name of ['sys-newer-v5', 'sys-newer-v6', 'sys-newer-v7']){
  test(`${name} is now a current file: no question before "Load this system?"`, async ({ page }) => {
    await F.importViaCommand(page, 'loadSystem', file(name));
    const seen = await F.acceptAll(page);
    expect(seen[0]).toMatch(/^Load this system\?/);
    expect(await canvasNames(page)).toEqual(['Revenue Model']);
  });
}

// Files from before function definitions (workspace v3, module v2, templates v3) and from
// before the operators of phase E1 (workspace v4, module v3, templates v4) still open, and
// are saved in the current versions (workspace v7, system v7, module v5 since step 11a).
for(const [name, sys] of [['ws-v3', 'v4'], ['ws-v4', 'v5']]){
test(`${name} imports, with its ${sys} system and its templates, and exports as v7`, async ({ page }) => {
  await F.importViaCommand(page, 'importWorkspace', file(name));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Import this workspace\?/);
  expect(await canvasNames(page)).toEqual(['Revenue Model']);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(data.version).toBe(7);
  expect(data.system.version).toBe(7);
  expect(data.functions).toEqual([]);
  expect(data.system).not.toHaveProperty('functions');
  expect(data.templates.map(t => t.name)).toEqual(expect.arrayContaining(['Income Statement', 'Balance Sheet']));
});
}

for(const name of ['module-v2', 'module-v3']){
test(`${name} loads and calculates; saved again it is a v5 module`, async ({ page }) => {
  await page.evaluate(() => fm.clearCanvas());
  await F.importViaCommand(page, 'loadModule', file(name));
  await F.acceptAll(page);
  expect(await page.evaluate(() => fm.getValue('Profit'))).toBe(40);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  expect(data.version).toBe(5);
  expect(data).not.toHaveProperty('functions');
});
}

for(const name of ['templates-v3', 'templates-v4']){
test(`${name} imports through the Templates window`, async ({ page }) => {
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file(name));
  await expect(page.locator('.modal-box .template-list button', { hasText: 'Income Statement' })).toHaveCount(1);
});
}

test('ws-nested-newer-v8: one question up front, then the normal import confirm', async ({ page }) => {
  await F.importViaCommand(page, 'importWorkspace', file('ws-nested-newer-v8'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Its system was saved by a newer fmIDE/);
  expect(seen[1]).toMatch(/^Import this workspace\?/);
  expect(seen.slice(2)).toEqual(['Workspace imported.']);
  expect(await canvasNames(page)).toEqual(['Revenue Model']);
});

// Step 11a: the Excel look moved to ExcelExporter. Older files open; the Excel-only roles
// (Links, Headers, Section Headers, Labels, Notes) and the Excel-only style settings
// (keepColours, border.sides, font.excelDefaultSize) are dropped; the rest of every style —
// the canvas look and the number formats — stays.
const EXCEL_ONLY = /keepColours|"sides"|excelDefaultSize/;
const CANVAS_ROLES = ['Inputs', 'Calculations'];
function expectCanvasLookKept(style){
  expect(style).toEqual({ numberFormat: { kind: 'currency', decimals: 2, currencySymbol: '$' }, fill: '#fde68a',
    border: { color: '#b45309', width: 2, style: 'solid' }, font: { family: '', size: 16, weight: '700', color: '#7c2d12' } });
}
function expectPresetsClean(presets){
  expect(presets.map(p => p.name)).toEqual([...CANVAS_ROLES, 'Highlight']);
  expect(JSON.stringify(presets)).not.toMatch(EXCEL_ONLY);
  // What isn't Excel-only stays: the Inputs role's number format, Highlight's canvas look.
  expect(presets[0].style.numberFormat).toEqual({ kind: 'number', decimals: 1, currencySymbol: '$' });
  expect(presets[0].style.font.size).toBe(14);
  expect(presets[2].style.fill).toBe('#fde68a');
}

test('sys-v6-excel-settings: opens; saved again it is v7, without the Excel-only roles and settings', async ({ page }) => {
  await F.importViaCommand(page, 'loadSystem', file('sys-v6-excel-settings'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Load this system\?/);
  expect(await page.evaluate(() => fm.getValue('Revenue'))).toBe(50);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  expect(data.version).toBe(7);
  expect(JSON.stringify(data)).not.toMatch(EXCEL_ONLY);
  // Load System leaves your presets as they are: fmIDE's own roles, only the two canvas ones now.
  expect(data.formatPresets.map(p => p.name)).toEqual(CANVAS_ROLES);
  expectCanvasLookKept(data.canvases[0].nodes.find(n => n.id === 'n22').style);
});

test('module-v4-excel-settings: opens; saved again it is v5, without the Excel-only settings', async ({ page }) => {
  await page.evaluate(() => fm.clearCanvas());
  await F.importViaCommand(page, 'loadModule', file('module-v4-excel-settings'));
  await F.acceptAll(page);
  expect(await page.evaluate(() => fm.getValue('Revenue'))).toBe(50);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  expect(data.version).toBe(5);
  expect(JSON.stringify(data)).not.toMatch(EXCEL_ONLY);
  expectCanvasLookKept(data.nodes.find(n => n.text.startsWith('Revenue')).style);
});

test('ws-v6-excel-settings: imports; its system, template and presets lose the Excel-only settings', async ({ page }) => {
  await F.importViaCommand(page, 'importWorkspace', file('ws-v6-excel-settings'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Import this workspace\?/);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(data.version).toBe(7);
  expect(data.system.version).toBe(7);
  expect(JSON.stringify(data)).not.toMatch(EXCEL_ONLY);
  expectPresetsClean(data.formatPresets);
  const t = data.templates.find(x => x.name === 'Styled Revenue');
  expect(t.data.version).toBe(5);
  expectCanvasLookKept(t.data.nodes.find(n => n.text.startsWith('Revenue')).style);
});

test('format-presets-v1-excel-roles: imports without the Excel-only roles; exported again it is v2', async ({ page }) => {
  await F.importViaDialog(page, 'openFormats', '⇧ Import Presets', file('format-presets-v1-excel-roles'));
  await expect(page.locator('.modal-box', { hasText: 'Imported 3 format presets.' })).toBeVisible();
  await F.dismissMessage(page);
  const names = await page.locator('.modal-box .picker-row strong').allTextContents();
  for(const role of ['Links', 'Headers', 'Section Headers', 'Labels', 'Notes']) expect(names).not.toContain(role);
  expect(names).toContain('Highlight');
  const { data } = await F.downloadJson(page, () => page.locator('.modal-box button', { hasText: '⇩ Export Presets' }).click());
  expect(data.version).toBe(2);
  expect(JSON.stringify(data)).not.toMatch(EXCEL_ONLY);
});

test('the Excel-only settings given to fm.setStyle are dropped; the rest is kept', async ({ page }) => {
  await page.evaluate(() => fm.clearCanvas());
  await page.evaluate(() => fm.createRect({ name: 'Price', value: 10, x: 60, y: 60 }));
  await page.evaluate(() => fm.setStyle('Price', { numberFormat: { kind: 'percent', decimals: 1, currencySymbol: '$' }, fill: '#fde68a',
    border: { color: '#b45309', width: 2, style: 'solid', sides: ['bottom'] }, font: { family: '', size: 16, weight: '700', color: '#7c2d12', excelDefaultSize: true }, keepColours: true }));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  const style = data.nodes.find(n => n.text.startsWith('Price')).style;
  expect(style).toEqual({ numberFormat: { kind: 'percent', decimals: 1, currencySymbol: '$' }, fill: '#fde68a',
    border: { color: '#b45309', width: 2, style: 'solid' }, font: { family: '', size: 16, weight: '700', color: '#7c2d12' } });
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
  expect(named('Calculations')).toHaveLength(1);
  // Since step 11a the Excel-only roles are ExcelExporter's: the file's are dropped.
  for(const role of ['Links', 'Headers', 'Section Headers', 'Labels', 'Notes']) expect(named(role)).toHaveLength(0);
});

// Plugs (system v3, module v2): older files held one `plug` name per rectangle.
const valueOn = (page, canvas, name) => page.evaluate(([c, n]) => { fm.switchCanvas(c); return fm.getValue({ node: n }); }, [canvas, name]);
// Every rectangle as saved by File → Save System ("Canvas::Name" → node).
async function savedNodes(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  const nodes = {};
  data.canvases.forEach(c => c.nodes.forEach(n => { if(n.type === 'value') nodes[c.name + '::' + n.text.split('\n')[0]] = n; }));
  return { data, nodes };
}
const plugsOfNode = async (page, ref) => (await savedNodes(page)).nodes[ref].plugs;

test.describe('plugs: files from before a rectangle could have several', () => {
  test('a v2 system opens with its plug as a one-name list and still wires up; it saves in the current version', async ({ page }) => {
    await F.importViaCommand(page, 'loadSystem', file('sys-v2-plug'));
    await F.acceptAll(page);
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['Income Tax']);
    expect((await savedNodes(page)).nodes['Tax::Income Tax']).not.toHaveProperty('plug');
    expect(await plugsOfNode(page, 'Tax::Other')).toEqual([]);
    expect(await valueOn(page, 'Income Statement', 'Income Tax expense')).toBe(30);

    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
    expect(data.version).toBe(7);
    const tax = data.canvases.find(c => c.name === 'Tax').nodes.find(n => /^Income Tax/.test(n.text));
    expect(tax.plugs).toEqual(['Income Tax']);
    expect(tax).not.toHaveProperty('plug');
  });

  test('a v1 module opens with its plugs upgraded', async ({ page }) => {
    await page.evaluate(() => fm.clearCanvas());
    await F.importViaCommand(page, 'loadModule', file('module-v1-plug'));
    await F.acceptAll(page);
    const canvas = await page.evaluate(() => fm.canvases().find(c => c.active).name);
    const { nodes } = await savedNodes(page);
    const byName = (n) => nodes[canvas + '::' + n];
    expect(byName('Gold Revenue').plugs).toEqual(['Revenue']);
    expect(byName('Silver Revenue').plugs).toEqual([]);
    for(const n of ['Gold Revenue', 'Silver Revenue', 'Copper Revenue']) expect(byName(n)).not.toHaveProperty('plug');
  });

  test('a v1 module inside a templates file is upgraded when inserted', async ({ page }, testInfo) => {
    const path = testInfo.outputPath('plug-templates.json');
    fs.writeFileSync(path, JSON.stringify({ version: 1, kind: 'fmIDE-templates',
      templates: [{ name: 'Revenue lines', kind: 'module', data: JSON.parse(fs.readFileSync(file('module-v1-plug'), 'utf8')) }] }));
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
    await expect(page.locator('.modal-box .template-list button', { hasText: 'Revenue lines' })).toHaveCount(1);
    await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Revenue lines', 'here'); });
    const canvas = await page.evaluate(() => fm.canvases().find(c => c.active).name);
    expect(await plugsOfNode(page, canvas + '::Gold Revenue')).toEqual(['Revenue']);
  });
});

// Where items came from (step 8, phase 8b): templates v6, workspace v6 and functions v2 may
// carry `origin`. Files from before (templates v5, workspace v5, functions v1) had none: they
// open without a question, change nothing, and save in the new versions without an origin.
test.describe('origin: files from before templates v6, workspace v6 and functions v2', () => {
  test('ws-v5 imports with its templates and function library, and exports as v7 without origins', async ({ page }) => {
    await F.importViaCommand(page, 'importWorkspace', file('ws-v5'));
    const seen = await F.acceptAll(page);
    expect(seen[0]).toMatch(/^Import this workspace\?/);
    expect(await canvasNames(page)).toEqual(['Revenue Model']);
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    expect(data.version).toBe(7);
    expect(data.functions.map(d => d.family + '@' + d.version)).toEqual(['family-margin@1', 'family-margin@2', 'family-profit@1']);
    expect(data.templates.map(t => t.name)).toEqual(expect.arrayContaining(['Income Statement', 'Balance Sheet', 'Cash Flow']));
    expect(JSON.stringify(data)).not.toContain('"origin"');
  });

  test('templates-v5 imports; the Templates window exports it as v6, the same templates, without origins', async ({ page }) => {
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file('templates-v5'));
    await F.dismissMessage(page);
    const { data } = await F.downloadJson(page, () => page.locator('.modal-box.template-box button', { hasText: '⇩ Export Templates' }).click());
    expect(data.kind).toBe('fmIDE-templates');
    expect(data.version).toBe(6);
    const was = readFixture('formats', 'templates-v5.json').templates;
    expect(data.templates.map(t => [t.name, t.family, t.version, t.versionId])).toEqual(was.map(t => [t.name, t.family, t.version, t.versionId]));
    expect(JSON.stringify(data)).not.toContain('"origin"');
  });

  test('a v1 functions file imports without a question and exports as v2, unchanged, without origins', async ({ page }) => {
    const v1 = readFixture('formats', 'functions.json');
    expect(v1.version).toBe(1);
    expect(await page.evaluate((f) => fm.importFunctions(f), v1)).toEqual({ added: 3, present: 0, renumbered: 0 });
    const out = await page.evaluate(() => fm.exportFunctions({ download: false }));
    expect(out.version).toBe(2);
    expect(out.functions).toEqual(v1.functions);
    expect((await page.evaluate(() => fm.getFunction('Margin@1'))).origin).toBeNull();
  });

  test('a v2 functions file (what "newer" meant before) is now a current file: no question', async ({ page }) => {
    await F.importViaDialog(page, 'openFunctions', '⇧ Import Functions', fixture('functions', 'library-newer-v2.json'));
    expect(await F.dialogText(page)).toBe('Imported 3 function versions.');
  });

  test('a templates file from a newer fmIDE (version 7) asks first', async ({ page }, testInfo) => {
    const newer = Object.assign(readFixture('formats', 'templates-v5.json'), { version: 7 });
    const p = testInfo.outputPath('templates-v7.json');
    fs.writeFileSync(p, JSON.stringify(newer));
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', p);
    expect(await F.dialogText(page)).toMatch(/^This templates file was saved by a newer version of fmIDE \(format version 7; this fmIDE reads up to version 6\)/);
  });
});
