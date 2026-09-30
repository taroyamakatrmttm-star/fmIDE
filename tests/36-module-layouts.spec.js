// 36. Module layouts (step 11b): ExcelExporter remembers the layout of a module's tab (a
// canvas added from a canvas template in fmIDE, known by its template family) and uses it
// again wherever the module turns up in a model laid out for the first time. Samples in
// tests/fixtures/module-layouts/: model-a (Sales, the module, + Summary), model-b (other
// canvas and node ids, the module on a canvas named "Sales (Gold)", with two rectangles more:
// Discount and Net revenue), model-twice (the module on two canvases, Gold and Silver).
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const sample = (name) => fixture('module-layouts', name + '.json');
async function load(page, name){
  await page.setInputFiles('#fileInput', sample(name));
  await expect(page.locator('#loadStatus .status.ok')).toContainText(name + '.json');
  await expect(page.locator('#afterLoad')).toBeVisible();
}
const tabInputs = (page) => page.locator('#tabsBody input[type=text]');
async function tabNames(page){ return tabInputs(page).evaluateAll(els => els.map(e => e.value)); }
async function renameTab(page, from, to){
  for(const input of await tabInputs(page).all()){
    if(await input.inputValue() === from){ await input.fill(to); await input.dispatchEvent('change'); return; }
  }
  throw new Error('No tab named ' + from);
}
function treeRow(page, label){
  return page.locator('#rowGroupsTree .tree-row').filter({ has: page.locator('.tree-row-label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
}
const menuItem = (page, name) => page.locator('#treeCtxMenu').getByRole('menuitem', { name, exact: true });
async function rowMenu(page, label, item){
  await treeRow(page, label).first().click({ button: 'right' });
  await menuItem(page, item).click();
}
// A sheet's labels top to bottom (blank rows dropped), with each label cell's indent.
async function sheet(page, name){
  const { wb, bytes } = await X.generate(page);
  const ws = wb.Sheets[name];
  expect(ws, `sheet ${name} in ${wb.SheetNames.join(', ')}`).toBeTruthy();
  const book = await X.readBack(bytes);
  const rows = Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).sort((a, b) => a - b).filter(r => X.text(ws, 'A' + r));
  return {
    labels: rows.map(r => X.text(ws, 'A' + r)),
    indent: (label) => { const r = rows.find(x => X.text(ws, 'A' + x) === label); const c = book.getWorksheet(name).getCell('A' + r); return (c.alignment && c.alignment.indent) || 0; }
  };
}
const stored = async (page) => {
  const all = Object.values(await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-module-layouts')).map(t => JSON.parse(t));
  return all[0] || null;
};

// Arrange the module's tab in model A the way a person would: rename the tab, move Profit to
// the top, a label row above Revenue, Costs left out, Price indented, Volume renamed.
async function arrangeA(page){
  await load(page, 'model-a');
  await renameTab(page, 'Sales', 'Sales plan');
  await page.click('#viewByTree');
  await rowMenu(page, 'Profit', '⤒ Move to Top');
  await rowMenu(page, 'Revenue', 'Insert custom row above');
  await page.locator('.tree-row-label-input').fill('Top line');
  await page.locator('.tree-row-label-input').press('Enter');
  await rowMenu(page, 'Costs', '☐ Exclude');
  await treeRow(page, 'Price').first().click();
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await page.keyboard.press('Escape');
  await treeRow(page, 'Volume').first().locator('.tree-row-label').dblclick();
  await page.locator('.tree-row-label-input').fill('Units sold');
  await page.locator('.tree-row-label-input').press('Enter');
  return sheet(page, 'Sales plan');
}

test.beforeEach(async ({ page }) => { await X.openExporter(page); });

test('a module\'s tab is marked, and its layout is remembered once it changes — not before', async ({ page }) => {
  await load(page, 'model-a');
  const row = page.locator('#tabsBody tr', { has: page.locator('.module-tag') });
  await expect(row).toHaveCount(1);
  await expect(row.locator('.module-tag')).toHaveText('🧩 Sales');
  await expect(row.locator('.module-forget')).toHaveCount(0);
  // Loading (and the Summary tab changing) remembers nothing for the module.
  await renameTab(page, 'Summary', 'Summary 2');
  expect(await stored(page)).toBe(null);
  await renameTab(page, 'Sales', 'Sales plan');
  await expect(row.locator('.module-tag')).toContainText('layout remembered');
  await expect.poll(async () => { const s = await stored(page); return s && s.modules.map(m => [m.family, m.tabName]); })
    .toEqual([['fam-sales-module-0001', 'Sales plan']]);
  const s = await stored(page);
  expect(s.kind).toBe('fmIDE-excel-module-layouts');
  expect(s.version).toBe(1);
});

test('another model with the module is laid out as remembered; its new rectangles go where the sort puts them', async ({ page }) => {
  const a = await arrangeA(page);
  expect(a.labels[0]).toBe('Profit');
  expect(a.labels).toContain('Top line');
  expect(a.labels.indexOf('Top line')).toBe(a.labels.indexOf('Revenue') - 1);
  expect(a.labels).not.toContain('Costs');
  expect(a.labels).toContain('Units sold');
  expect(a.indent('Price')).toBe(1);

  await load(page, 'model-b');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales plan']);
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText("1 tab laid out from its module' remembered layout: 5 rows matched, 2 new.");
  const b = await sheet(page, 'Sales plan');
  const known = b.labels.filter(l => l !== 'Discount' && l !== 'Net revenue');
  expect(known).toEqual(a.labels);
  expect(b.labels).toEqual(expect.arrayContaining(['Discount', 'Net revenue']));
  expect(b.indent('Price')).toBe(1);
  // The other canvas's tab is untouched.
  const overview = await sheet(page, 'Overview');
  expect(overview.labels).toEqual(['Tax rate', 'Headcount'].filter(l => overview.labels.includes(l)));
});

test('a layout saved for the whole model wins; after a reload the remembered layout still applies', async ({ page }) => {
  const a = await arrangeA(page);
  await load(page, 'model-b');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales plan']);
  await renameTab(page, 'Sales plan', 'Gold only'); // model B's own layout, and the module's again
  await load(page, 'model-a');
  expect(await tabNames(page)).toEqual(['Sales plan', 'Summary']); // A's own layout, unchanged
  expect((await sheet(page, 'Sales plan')).labels).toEqual(a.labels);
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveCount(0);
  await load(page, 'model-b');
  expect(await tabNames(page)).toEqual(['Overview', 'Gold only']);

  await page.reload();
  await load(page, 'model-twice');
  // Both canvases take the module's layout (the rows B added are simply not there); the
  // tab name can be used only once.
  const names = await tabNames(page);
  expect(names).toEqual(['Gold only', 'Silver']);
  for(const t of names) expect((await sheet(page, t)).labels).toEqual(a.labels);
});

test('with sections on, each band keeps its remembered order', async ({ page }) => {
  await load(page, 'model-a');
  await X.setSections(page, true);
  await page.click('#viewByTree');
  const bands = async (tab) => {
    const { wb } = await X.generate(page);
    const ws = wb.Sheets[tab];
    const labels = Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).sort((x, y) => x - y).map(r => X.text(ws, 'A' + r)).filter(Boolean);
    return labels;
  };
  const before = await bands('Sales');
  // Move the last row of the Input band to its top.
  const inputs = before.slice(before.indexOf('INPUTS') + 1, before.findIndex((l, i) => i > before.indexOf('INPUTS') && /^(CALCULATIONS|OUTPUTS)$/.test(l)));
  expect(inputs.length).toBeGreaterThan(1);
  await rowMenu(page, inputs[inputs.length - 1], '⤒ Move to Top');
  const a = await bands('Sales');
  expect(a).not.toEqual(before);
  await load(page, 'model-b');
  await X.setSections(page, true);
  const b = await bands('Sales (Gold)');
  expect(b.filter(l => l !== 'Discount' && l !== 'Net revenue')).toEqual(a);
});

test('Reset Mapping to Defaults starts from the remembered layout; Forget stops that', async ({ page }) => {
  const a = await arrangeA(page);
  await load(page, 'model-b');
  await page.click('#btnResetMapping');
  await expect(page.locator('#confirmMessage')).toContainText('remembered for that module');
  await page.click('#confirmOk');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales plan']);

  const tagRow = page.locator('#tabsBody tr', { has: page.locator('.module-tag') });
  await tagRow.locator('.module-forget').click();
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Forgot the layout remembered for "Sales".');
  await expect(tagRow.locator('.module-tag')).toHaveText('🧩 Sales');
  expect((await stored(page)).modules).toEqual([]);
  await page.click('#btnResetMapping');
  await page.click('#confirmOk');
  expect(await tabNames(page)).toEqual(['Overview', 'Sales (Gold)']);
  const fresh = await sheet(page, 'Sales (Gold)');
  expect(fresh.labels).toEqual(expect.arrayContaining(['Costs', 'Volume', 'Revenue']));
  expect(fresh.labels).not.toContain('Top line');
  expect(a.labels).not.toEqual(fresh.labels);
});

test('Export Module Layouts, Forget, then Import brings the layout back', async ({ page }, testInfo) => {
  const a = await arrangeA(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportModuleLayouts')]);
  const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(file.kind).toBe('fmIDE-excel-module-layouts');
  expect(file.version).toBe(1);
  expect(file.modules.map(m => m.family)).toEqual(['fam-sales-module-0001']);
  const path = testInfo.outputPath('layouts.json');
  fs.writeFileSync(path, JSON.stringify(file));

  await page.locator('#tabsBody .module-forget').click();
  expect((await stored(page)).modules).toEqual([]);
  await page.setInputFiles('#moduleLayoutsFileInput', path);
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Imported 1 module layout. It is used for models laid out here from now on.');
  await expect(page.locator('#tabsBody .module-tag')).toContainText('layout remembered');
  await load(page, 'model-b');
  const b = await sheet(page, 'Sales plan');
  expect(b.labels.filter(l => l !== 'Discount' && l !== 'Net revenue')).toEqual(a.labels);
});

test('a module layouts file with hostile or broken entries is cleaned; nothing runs', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('evil-layouts.json');
  const evil = '<img src=x onerror="window.__pwned=1">';
  fs.writeFileSync(path, JSON.stringify({ kind: 'fmIDE-excel-module-layouts', version: 1, modules: [
    { family: '<b>bad family</b>', rows: [] },
    'not an entry',
    { family: 'fam-sales-module-0001', name: evil, tabName: evil + '[]:*?/\\',
      rows: [{ name: 'Profit', label: evil, section: 'evil', include: 'yes', constant: true, style: { fill: 'url(javascript:1)', font: { color: evil } }, indent: 1e9 },
             { name: 'Profit', label: 'duplicate' }, null, { name: '' }],
      customs: [{ label: evil, section: 'input', style: { fill: '#fde68a' }, indent: 'x' }, 7],
      sectioned: ['r0', 'r0', 'c0', 'r9', 'x1', '<b>'], flat: ['c0', 'r0', 'c1', 'r1'] }
  ] }));
  await load(page, 'model-a');
  await page.setInputFiles('#moduleLayoutsFileInput', path);
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Imported 1 module layout. It is used for models laid out here from now on.');
  await expect(page.locator('#tabsBody .module-tag')).toContainText('🧩 Sales · layout remembered'); // the model's name for it
  await load(page, 'model-b');
  const names = await tabNames(page);
  expect(names[1]).not.toMatch(/[\[\]:*?\/\\]/);
  expect(names[1].length).toBeLessThanOrEqual(31);
  const s = await sheet(page, names[1]);
  // The custom row and Profit (renamed) carry the text, as text; Profit comes right after the
  // custom row, as the remembered order says; the rest are where the sort put them.
  expect(s.labels.filter(l => l === evil)).toHaveLength(2);
  expect(s.labels).not.toContain('Profit');
  expect(s.labels).toEqual(expect.arrayContaining(['Price', 'Volume', 'Revenue', 'Costs', 'Discount', 'Net revenue']));
  expect(s.indent(evil)).toBeLessThanOrEqual(15);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#afterLoad img').count()).toBe(0);
  const kept = await stored(page);
  expect(kept.modules).toHaveLength(1);
  expect(kept.modules[0].rows.filter(Boolean).map(r => r.name)).toEqual(['profit']);
  expect(JSON.stringify(kept)).not.toContain('javascript');
});

test('a module layouts file loaded as a model says where it belongs', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('layouts.json');
  fs.writeFileSync(path, JSON.stringify({ kind: 'fmIDE-excel-module-layouts', version: 1, modules: [] }));
  await page.setInputFiles('#fileInput', path);
  await expect(page.locator('#loadStatus .status.err')).toContainText('Import Module Layouts');
});
