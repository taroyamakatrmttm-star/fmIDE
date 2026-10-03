// 38. ExcelExporter uses a template's attached Excel layout (step 11c-2). A `.fmide` document
// or workspace carries its templates; the layout attached to a module's template (fmIDE's
// "Attach Excel layout…", group 37) lays out that module's tab in a new layout when you have
// no remembered layout of your own for the module. Samples in tests/fixtures/module-layouts/:
// doc-with-layouts (model-b as a workspace; its Sales canvas made from template version 1;
// versions 1 and 2 carry layouts naming the tab "Sales from v1" / "Sales from v2") and
// doc-unknown-version (the same, the canvas made from a version the document doesn't hold).
const fs = require('fs');
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const sample = (name) => fixture('module-layouts', name + '.json');
async function loadPath(page, path, name){
  await page.setInputFiles('#fileInput', path);
  await expect(page.locator('#loadStatus .status.ok')).toContainText(name);
  await expect(page.locator('#afterLoad')).toBeVisible();
}
const load = (page, name) => loadPath(page, sample(name), name + '.json');
const tabInputs = (page) => page.locator('#tabsBody input[type=text]');
const tabNames = (page) => tabInputs(page).evaluateAll(els => els.map(e => e.value));
const tag = (page) => page.locator('#tabsBody .module-tag').first();
async function renameTab(page, from, to){
  for(const input of await tabInputs(page).all()){
    if(await input.inputValue() === from){ await input.fill(to); await input.dispatchEvent('change'); return; }
  }
  throw new Error('No tab named ' + from);
}
async function labels(page, sheet){
  const { wb } = await X.generate(page);
  const ws = wb.Sheets[sheet];
  expect(ws, `sheet ${sheet} in ${wb.SheetNames.join(', ')}`).toBeTruthy();
  return Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).sort((a, b) => a - b).map(r => X.text(ws, 'A' + r)).filter(Boolean);
}
const stored = async (page) => Object.values(await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-module-layouts')).map(t => JSON.parse(t))[0] || null;

test.beforeEach(async ({ page }) => { await X.openExporter(page); });

test('a document\'s template layout lays out the module\'s tab — the version the canvas was made from', async ({ page }) => {
  await load(page, 'doc-with-layouts');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales from v1']);
  await expect(tag(page)).toHaveText('🧩 Sales · layout from the template');
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText("1 tab laid out from its template's layout: 2 rows matched, 5 new.");
  const l = await labels(page, 'Sales from v1');
  expect(l).toContain('Units sold');
  expect(l).not.toContain('Volume');
  expect(l.indexOf('Top line')).toBe(l.indexOf('Profit') - 1);
  // Nothing is remembered by loading.
  expect(await stored(page)).toBe(null);
});

test('when the canvas\'s version isn\'t in the document, the newest version with a layout is used', async ({ page }) => {
  await load(page, 'doc-unknown-version');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales from v2']);
});

test('your own remembered layout wins over the template\'s', async ({ page }) => {
  await load(page, 'model-a');
  await renameTab(page, 'Sales', 'My sales');
  await expect.poll(async () => { const s = await stored(page); return s && s.modules.map(m => m.tabName); }).toEqual(['My sales']);
  await load(page, 'doc-with-layouts');
  expect(await tabNames(page)).toEqual(['Overview', 'My sales']);
  await expect(tag(page)).toHaveText('🧩 Sales · layout rememberedForget');
  await expect(page.locator('#moduleLayoutsStatus .status')).toContainText("from its module' remembered layout");
});

test('changing a tab laid out from the template makes it your own remembered layout', async ({ page }) => {
  await load(page, 'doc-with-layouts');
  await renameTab(page, 'Sales from v1', 'Sales, mine');
  await expect(tag(page)).toHaveText('🧩 Sales · layout rememberedForget');
  const s = await stored(page);
  expect(s.modules.map(m => [m.family, m.tabName])).toEqual([['fam-sales-module-0001', 'Sales, mine']]);
  // The template's other choices came along into your own layout.
  expect(s.modules[0].customs.map(c => c.label)).toEqual(['Top line']);
});

test('a system file carries no templates: its module tab keeps the plain default', async ({ page }) => {
  await load(page, 'model-b');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales (Gold)']);
  await expect(tag(page)).toHaveText('🧩 Sales');
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveCount(0);
});

test('an attached layout is someone else\'s data: checked, wrong family ignored, nothing runs', async ({ page }, testInfo) => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  const doc = readFixture('module-layouts', 'doc-with-layouts.json');
  // Version 1 (the one the canvas was made from): a layout made for another family — ignored.
  doc.templates[0].attachments.excel.family = 'fam-someone-else-01';
  // Version 2: hostile text and broken values.
  Object.assign(doc.templates[1].attachments.excel, { tabName: evil + '[]:*?/\\', sectioned: ['r0', 'x9', '<b>'], flat: ['c0', 'r0', 'r0', 'c7'] });
  doc.templates[1].attachments.excel.customs = [{ label: evil, section: 'evil', style: { fill: 'url(javascript:1)' }, indent: 1e9 }];
  doc.templates[1].attachments.excel.rows = [{ name: 'Profit', label: evil, include: 'yes', section: '<b>' }];
  const path = testInfo.outputPath('doc-evil.json');
  fs.writeFileSync(path, JSON.stringify(doc));
  await loadPath(page, path, 'doc-evil.json');
  const names = await tabNames(page);
  expect(names[1]).not.toMatch(/[\[\]:*?\/\\]/);
  expect(names[1].length).toBeLessThanOrEqual(31);
  await expect(tag(page)).toHaveText('🧩 Sales · layout from the template');
  const l = await labels(page, names[1]);
  expect(l.filter(x => x === evil)).toHaveLength(2); // the custom row and Profit's label, as text
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#afterLoad img').count()).toBe(0);
});

// Found 3 Oct 2026: Save System as Template dropped each canvas's link to its canvas
// template, so a system added back from it lost its modules' layouts. Now the link stays.
test('a system saved as a template in fmIDE and added back keeps its module\'s template layout', async ({ page, context }, testInfo) => {
  const F = require('./helpers/fmide');
  const fmide = await context.newPage();
  await F.openFmIDE(fmide);
  await F.importViaCommand(fmide, 'importWorkspace', sample('doc-with-layouts'));
  await F.acceptAll(fmide);
  // Save System as Template, then replace the model with it.
  await fmide.evaluate(() => fm.command('openTemplates'));
  const picker = fmide.locator('.modal-box.template-box');
  await picker.locator('button', { hasText: '+ Save System as Template' }).click();
  const form = fmide.locator('.modal-box.template-form');
  await form.locator('input.template-form-name').fill('Whole model');
  await form.locator('button.primary', { hasText: 'Save Template' }).click();
  await picker.locator('.modal-actions button', { hasText: /^Close$/ }).click();
  await fmide.evaluate(() => { fm.clearAll(); fm.insertTemplate('Whole model', 'replace'); });
  const { data } = await F.downloadJson(fmide, () => fmide.evaluate(() => fm.exportWorkspace()));
  expect(data.system.canvases.map(c => c.template ? c.template.versionId : null)).toEqual([null, 'vid-sales-module-0001']);
  const path = testInfo.outputPath('from-template.json');
  fs.writeFileSync(path, JSON.stringify(data));
  await loadPath(page, path, 'from-template.json');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales from v1']);
  await expect(tag(page)).toHaveText('🧩 Sales · layout from the template');
});
