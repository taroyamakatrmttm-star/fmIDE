// 37. A template's Excel layout (step 11c, phase 11c-1): a canvas template version can carry
// the layout ExcelExporter remembers for that module, as an attachment fmIDE keeps but never
// reads. Attach it from a file saved by ExcelExporter's Export Module Layouts; it goes along
// in the workspace, templates files, new versions and library packs; the pack checker applies
// the same general checks.
const fs = require('fs');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { checkPack } = require('../tools/check-pack');

const FAMILY = 'fam-sales-module-0001';
const LAYOUT = { family: FAMILY, name: 'Sales', tabName: 'Sales plan',
  rows: [{ name: 'profit', section: 'output', include: true, constant: false }, { name: 'volume', section: 'input', include: true, constant: false, label: 'Units sold', indent: 1 }],
  customs: [{ label: 'Top line', section: 'calc', showPeriodLabels: false }],
  sectioned: ['r1', 'c0', 'r0'], flat: ['r0', 'c0', 'r1'] };
const layoutsFile = (modules, extra) => Object.assign({ kind: 'fmIDE-excel-module-layouts', version: 1, modules }, extra || {});
// A canvas template "Sales" of family FAMILY (version 1), as a templates file from before 11c.
const salesTemplate = (attachments) => Object.assign({ name: 'Sales', kind: 'module', group: 'Mine', description: '', family: FAMILY, version: 1, note: '',
  versionId: 'vid-sales-module-0001',
  data: { version: 5, kind: 'module', nodes: [{ id: 'n1', type: 'value', x: 60, y: 60, w: 170, h: 64, text: 'Price\n10', plugs: [] },
    { id: 'n2', type: 'value', x: 60, y: 180, w: 170, h: 64, text: 'Volume\n5', plugs: [] }], edges: [] } }, attachments ? { attachments } : {});

const picker = (page) => page.locator('.modal-box.template-box');
async function writeJson(testInfo, name, data){ const p = testInfo.outputPath(name); fs.writeFileSync(p, JSON.stringify(data)); return p; }
async function importTemplates(page, testInfo, templates, version){
  const p = await writeJson(testInfo, 'templates-' + Math.random().toString(36).slice(2) + '.json', { kind: 'fmIDE-templates', version: version || 6, templates });
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', p);
  await F.dismissMessage(page);
}
async function selectSales(page){
  await picker(page).locator('.template-list button.template-family', { hasText: 'Sales' }).click();
}
async function attach(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), picker(page).locator('button.template-attach-excel').click()]);
  await chooser.setFiles(file);
}
async function library(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  return data;
}

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

test('Attach Excel layout… takes this family\'s entry from an ExcelExporter file; it is kept, saved and survives a reload', async ({ page }, testInfo) => {
  await importTemplates(page, testInfo, [salesTemplate()]);
  await selectSales(page);
  await expect(picker(page).locator('.template-attachment')).not.toContainText('attached');
  const other = Object.assign({}, LAYOUT, { family: 'fam-someone-else-01', tabName: 'Other' });
  await attach(page, await writeJson(testInfo, 'layouts.json', layoutsFile([other, LAYOUT])));
  expect(await F.dialogText(page)).toBe('Excel layout attached to version 1 of "Sales".');
  await F.dismissMessage(page);
  await expect(picker(page).locator('.template-attachment')).toContainText('An Excel layout is attached');

  const ws = await library(page);
  expect(ws.version).toBe(10);
  expect(ws.templates.find(t => t.name === 'Sales').attachments).toEqual({ excel: LAYOUT });
  const { data: tf } = await F.downloadJson(page, () => picker(page).locator('button', { hasText: '⇩ Export Templates' }).click());
  expect(tf.version).toBe(9);
  expect(tf.templates.find(t => t.name === 'Sales').attachments).toEqual({ excel: LAYOUT });

  await page.waitForTimeout(2500); // the autosave
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  expect((await library(page)).templates.find(t => t.name === 'Sales').attachments).toEqual({ excel: LAYOUT });
});

test('a version 2 layouts file (step 11d) attaches too, its block instances\' layout included', async ({ page }, testInfo) => {
  await importTemplates(page, testInfo, [salesTemplate()]);
  await selectSales(page);
  const withInstance = Object.assign({}, LAYOUT, { instance: { rows: [{ name: 'profit', copy: 'total', section: 'calc', include: true, constant: false }],
    customs: [], sectioned: ['r0'], flat: ['r0'] } });
  await attach(page, await writeJson(testInfo, 'layouts-v2.json', layoutsFile([withInstance], { version: 2 })));
  expect(await F.dialogText(page)).toBe('Excel layout attached to version 1 of "Sales".');
  await F.dismissMessage(page);
  expect((await library(page)).templates.find(t => t.name === 'Sales').attachments).toEqual({ excel: withInstance });
});

test('files that can\'t be attached say why, and attach nothing', async ({ page }, testInfo) => {
  await importTemplates(page, testInfo, [salesTemplate()]);
  await selectSales(page);
  const cases = [
    [{ kind: 'system', version: 7, canvases: [] }, /isn't a file of module layouts/],
    [layoutsFile([Object.assign({}, LAYOUT, { family: 'fam-someone-else-01' })]), /has no layout for this template/],
    [layoutsFile([LAYOUT], { version: 3 }), /saved by a newer ExcelExporter/],
    [layoutsFile([Object.assign({}, LAYOUT, { big: 'x'.repeat(300 * 1024) })]), /too large or not plain data/],
  ];
  for(const [data, message] of cases){
    await attach(page, await writeJson(testInfo, 'bad.json', data));
    expect(await F.dialogText(page)).toMatch(message);
    await F.dismissMessage(page);
  }
  const bad = testInfo.outputPath('not-json.json'); fs.writeFileSync(bad, '{ nope');
  await attach(page, bad);
  expect(await F.dialogText(page)).toBe('That file is not valid JSON.');
  await F.dismissMessage(page);
  expect((await library(page)).templates.find(t => t.name === 'Sales')).not.toHaveProperty('attachments');
});

test('Save as new version carries the layout forward; Remove takes it off one version only', async ({ page }, testInfo) => {
  await importTemplates(page, testInfo, [salesTemplate({ excel: LAYOUT })]);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  await expect(picker(page)).toHaveCount(0);
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Sales', 'here'); });
  await page.evaluate(() => fm.command('openTemplates'));
  await selectSales(page);
  await picker(page).locator('button.template-save-version').click();
  const form = page.locator('.modal-box.template-form');
  await form.locator('input.template-form-note').fill('second');
  await form.locator('button.primary', { hasText: /^Save version 2$/ }).click();
  let ws = await library(page);
  expect(ws.templates.filter(t => t.name === 'Sales').map(t => [t.version, !!t.attachments])).toEqual([[1, true], [2, true]]);
  // Remove on version 2 (the one now selected).
  await picker(page).locator('.template-attachment-remove').click();
  await expect(picker(page).locator('button.template-attach-excel')).toBeVisible();
  ws = await library(page);
  expect(ws.templates.filter(t => t.name === 'Sales').map(t => [t.version, !!t.attachments])).toEqual([[1, true], [2, false]]);
});

test('attachments from a file are checked: another family, a system template, too deep, too big or not plain data are dropped', async ({ page }, testInfo) => {
  let deep = { x: 1 }; for(let i = 0; i < 15; i++) deep = { deep };
  const templates = [
    Object.assign(salesTemplate({ excel: Object.assign({}, LAYOUT, { family: 'fam-someone-else-01' }) }), { name: 'Other family', family: 'fam-other-family-1', versionId: 'vid-other-family-1' }),
    Object.assign(salesTemplate({ excel: Object.assign({}, LAYOUT, { family: 'fam-deep-deep-001' }, { deep }) }), { name: 'Too deep', family: 'fam-deep-deep-001', versionId: 'vid-deep-deep-001' }),
    Object.assign(salesTemplate({ excel: Object.assign({}, LAYOUT, { family: 'fam-too-big-00001', big: 'x'.repeat(300 * 1024) }) }), { name: 'Too big', family: 'fam-too-big-00001', versionId: 'vid-too-big-00001' }),
    Object.assign(salesTemplate({ excel: 'just text', python: { family: FAMILY } }), { name: 'Not an object', family: 'fam-not-object-01', versionId: 'vid-not-object-01' }),
    { name: 'A system', kind: 'system', group: 'Mine', family: 'fam-a-system-0001', version: 1, versionId: 'vid-a-system-0001', note: '',
      data: { version: 7, kind: 'system', periods: ['P1'], canvases: [{ id: 'c1', name: 'C', nodes: [], edges: [] }] }, attachments: { excel: Object.assign({}, LAYOUT, { family: 'fam-a-system-0001' }) } },
    Object.assign(salesTemplate({ excel: LAYOUT, python: { family: FAMILY } }), {}),
  ];
  await importTemplates(page, testInfo, templates);
  const ws = await library(page);
  const byName = Object.fromEntries(ws.templates.map(t => [t.name, t.attachments || null]));
  expect(byName).toEqual({ 'Other family': null, 'Too deep': null, 'Too big': null, 'Not an object': null, 'A system': null, 'Sales': { excel: LAYOUT } });
});

// A pack holding the Sales template with its layout, as fmIDE saves one (version 3).
const salesPack = () => ({ kind: 'fmIDE-library-pack', version: 3,
  pack: { id: 'pack-sales-module-1', title: 'Sales module', author: 'Ann Example', licence: 'CC-BY-4.0', created: '2026-09-30' },
  templates: [salesTemplate({ excel: LAYOUT })], functions: [] });

test('a library pack carries the layout: shown in the preview, added with the template — or added to one you already have', async ({ page }) => {
  const data = salesPack();
  const preview = await page.evaluate((f) => fm.previewLibraryPack(f), data);
  expect(preview.items.map(i => [i.name, i.status])).toEqual([['Sales', 'new']]);
  await page.evaluate((f) => fm.openLibraryPack(f), data);
  expect((await library(page)).templates.find(t => t.name === 'Sales').attachments).toEqual({ excel: LAYOUT });

  // The same template without the layout: offered for the layout, and it is added.
  await page.evaluate(() => fm.command('openTemplates'));
  await selectSales(page);
  await picker(page).locator('.template-attachment-remove').click();
  await expect(picker(page).locator('button.template-attach-excel')).toBeVisible();
  const again = await page.evaluate((f) => fm.previewLibraryPack(f), data);
  expect(again.items.map(i => [i.name, i.status, i.statusText])).toEqual([['Sales', 'attachment', 'Already in your library — adds its Excel layout']]);
  expect(await page.evaluate((f) => fm.openLibraryPack(f), data)).toMatchObject({ templates: { added: 0, present: 1 } });
  expect((await library(page)).templates.filter(t => t.name === 'Sales').map(t => t.attachments)).toEqual([{ excel: LAYOUT }]);
});

test('Save as Library Pack writes pack v3 with the layout, and the pack checker passes it', async ({ page }, testInfo) => {
  await importTemplates(page, testInfo, [salesTemplate({ excel: LAYOUT })]);
  const saved = await page.evaluate(() => fm.saveLibraryPack({ title: 'Sales module', author: 'Ann Example', templates: ['Sales'], download: false }));
  const data = typeof saved === 'string' ? JSON.parse(saved) : saved;
  expect(data.version).toBe(3);
  expect(data.templates[0].attachments).toEqual({ excel: LAYOUT });
  const r = checkPack(JSON.stringify(data, null, 2), data.pack.id + '.fmide-pack.json');
  expect(r.errors).toEqual([]);
  expect(r.notes.map(n => n.message).join('\n')).toContain('It carries an Excel layout for ExcelExporter');
});

test('the pack preview window marks an item with an Excel layout', async ({ page }, testInfo) => {
  await F.importViaCommand(page, 'openLibraryPack', await writeJson(testInfo, 'pack-sales-module-1.fmide-pack.json', salesPack()));
  await expect(page.locator('.library-pack-item .library-pack-item-name').first()).toContainText('Sales v1 — canvas template · 📎 Excel layout');
});

test('the pack checker refuses attachments fmIDE would drop, and hidden characters in a layout', async () => {
  const base = salesPack();
  const check = (change) => { const p = JSON.parse(JSON.stringify(base)); change(p); return checkPack(JSON.stringify(p, null, 2), p.pack.id + '.fmide-pack.json'); };
  const errorsOf = (r) => r.errors.map(e => e.message).join('\n');
  expect(errorsOf(check(p => { p.templates[0].attachments.excel.family = 'fam-someone-else-01'; }))).toMatch(/attachments \("attachments"\) aren't what fmIDE keeps/);
  expect(errorsOf(check(p => { p.templates[0].attachments.python = { family: p.templates[0].family }; }))).toMatch(/aren't what fmIDE keeps/);
  expect(errorsOf(check(p => { p.templates[0].attachments.excel.customs[0].label = 'Top' + String.fromCharCode(0x202E) + 'line'; }))).toMatch(/hidden character/);
  expect(check(() => {}).errors).toEqual([]);
});
