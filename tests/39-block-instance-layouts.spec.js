// 39. Block instance layouts (step 11d): a module used as a block (a canvas added from a
// canvas template in fmIDE, with instances on other canvases) remembers the layout of its
// instances' tabs too, rows matched by name and, in a vertical instance, by which copy they
// are (a vintage, the Total, the shared row); "Lay out the other instances like this" copies
// an instance tab's layout to the block's other instances in the model. Samples in
// tests/fixtures/block-layouts/: block-a (the Loan block, from a template, used twice),
// block-b (other ids, the block with one rectangle more, Arrangement, used once), block-v and
// block-v4 (the block used vertically, three periods and, with other ids, four).
const fs = require('fs');
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const FAMILY = 'fam-loan-block-0001';
async function loadPath(page, path, name){
  await page.setInputFiles('#fileInput', path);
  await expect(page.locator('#loadStatus .status.ok')).toContainText(name);
  await expect(page.locator('#afterLoad')).toBeVisible();
}
const load = (page, name) => loadPath(page, fixture('block-layouts', name + '.json'), name + '.json');
const tabInputs = (page) => page.locator('#tabsBody input[type=text]');
const tabNames = (page) => tabInputs(page).evaluateAll(els => els.map(e => e.value));
async function renameTab(page, from, to){
  for(const input of await tabInputs(page).all()){
    if(await input.inputValue() === from){ await input.fill(to); await input.dispatchEvent('change'); return; }
  }
  throw new Error('No tab named ' + from);
}
// The Tabs panel's row for a tab, found by its name.
async function tabRowByName(page, name){
  for(const tr of await page.locator('#tabsBody tr').all()){
    const input = tr.locator('input[type=text]');
    if(await input.count() && await input.inputValue() === name) return tr;
  }
  throw new Error('No tab named ' + name);
}
// A row in one tab of the Tree view (labels repeat from one instance tab to the next).
function treeRow(page, tabId, label){
  return page.locator(`#rowGroupsTree .canvas-group[data-scroll-key="tree_${tabId}"] .tree-row`)
    .filter({ has: page.locator('.tree-row-label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
}
async function rowMenu(page, tabId, label, item){
  await treeRow(page, tabId, label).first().click({ button: 'right' });
  await page.locator('#treeCtxMenu').getByRole('menuitem', { name: item, exact: true }).click();
}
async function labels(page, sheet){
  const { wb } = await X.generate(page);
  const ws = wb.Sheets[sheet];
  expect(ws, `sheet ${sheet} in ${wb.SheetNames.join(', ')}`).toBeTruthy();
  return Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).sort((a, b) => a - b).map(r => X.text(ws, 'A' + r)).filter(Boolean);
}
const stored = async (page) => Object.values(await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-module-layouts')).map(t => JSON.parse(t))[0] || null;

// Arrange instance 1 of block-a: Total cost to the top, a label row above Interest, Fee renamed.
const INST1 = 'tab_blk_acm_ai1';
const ARRANGED = ['Total cost', 'Loan costs', 'Interest', 'Fee paid'];
async function arrangeInstance(page, tabId){
  await page.click('#viewByTree');
  await rowMenu(page, tabId, 'Total cost', '⤒ Move to Top');
  await rowMenu(page, tabId, 'Interest', 'Insert custom row above');
  await page.locator('.tree-row-label-input').fill('Loan costs');
  await page.locator('.tree-row-label-input').press('Enter');
  await treeRow(page, tabId, 'Fee').first().locator('.tree-row-label').dblclick();
  await page.locator('.tree-row-label-input').fill('Fee paid');
  await page.locator('.tree-row-label-input').press('Enter');
}

test.beforeEach(async ({ page }) => { await X.openExporter(page); });

test('an instance tab is marked; its layout is remembered for the block once it changes — not before', async ({ page }) => {
  await load(page, 'block-a');
  expect(await tabNames(page)).toEqual(['Main', 'Loan', 'Loan (instance 1)', 'Loan (instance 2)']);
  const inst1 = await tabRowByName(page, 'Loan (instance 1)');
  await expect(inst1.locator('.instance-tag > span').first()).toHaveText('🧩 Loan');
  await expect(inst1.locator('.instance-copy')).toHaveText('Lay out the other instances like this');
  await expect(inst1.locator('.module-forget')).toHaveCount(0);
  expect(await stored(page)).toBe(null);

  await arrangeInstance(page, INST1);
  expect(await labels(page, 'Loan (instance 1)')).toEqual(ARRANGED);
  expect(await labels(page, 'Loan (instance 2)')).toEqual(['Interest', 'Fee', 'Total cost']);
  await expect((await tabRowByName(page, 'Loan (instance 1)')).locator('.instance-tag > span').first()).toHaveText('🧩 Loan · instance layout remembered');
  // The block's own tab isn't remembered: only the instances' layout.
  await expect((await tabRowByName(page, 'Loan')).locator('.module-tag')).toHaveText('🧩 Loan');
  const s = await stored(page);
  expect(s.version).toBe(2);
  expect(s.modules).toHaveLength(1);
  const m = s.modules[0];
  expect([m.family, m.rows, m.customs, m.tabName]).toEqual([FAMILY, [], [], undefined]);
  expect(m.instance.rows.map(r => [r.name, r.label]).sort()).toEqual([['fee', 'Fee paid'], ['interest', undefined], ['total cost', undefined]]);
  expect(m.instance.customs.map(c => c.label)).toEqual(['Loan costs']);
});

test('another model with the block: its instance tab is laid out as remembered, the new rectangle where the sort puts it', async ({ page }) => {
  await load(page, 'block-a');
  await arrangeInstance(page, INST1);
  await expect.poll(async () => { const s = await stored(page); return !!(s && s.modules[0].instance); }).toBe(true);
  await load(page, 'block-b');
  const l = await labels(page, 'Loan (instance 1)');
  expect(l.filter(x => x !== 'Arrangement')).toEqual(ARRANGED);
  expect(l).toContain('Arrangement');
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText("1 tab laid out from its module' remembered layout: 3 rows matched, 1 new.");
  // The block's own tab keeps the plain default.
  expect(await labels(page, 'Loan')).toEqual(['Arrangement', 'Balance in', 'Rate in', 'Interest', 'Fee', 'Total cost']);
});

test('"Lay out the other instances like this" gives the block\'s other instance tabs this layout, keeping their names', async ({ page }) => {
  await load(page, 'block-a');
  await arrangeInstance(page, INST1);
  await renameTab(page, 'Loan (instance 2)', 'Second loan');
  await (await tabRowByName(page, 'Loan (instance 1)')).locator('.instance-copy').click();
  await expect(page.locator('#confirmMessage')).toContainText('The other tab of the block "Loan"');
  await page.click('#confirmOk');
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Laid out 1 other tab like "Loan (instance 1)".');
  expect(await tabNames(page)).toEqual(['Main', 'Loan', 'Loan (instance 1)', 'Second loan']);
  expect(await labels(page, 'Second loan')).toEqual(ARRANGED);
  // Kept after a reload (the model's own layout is saved).
  await page.reload();
  await load(page, 'block-a');
  expect(await labels(page, 'Second loan')).toEqual(ARRANGED);
});

test('Cancel leaves the other instances as they were', async ({ page }) => {
  await load(page, 'block-a');
  await arrangeInstance(page, INST1);
  await (await tabRowByName(page, 'Loan (instance 1)')).locator('.instance-copy').click();
  await page.click('#confirmCancel');
  expect(await labels(page, 'Loan (instance 2)')).toEqual(['Interest', 'Fee', 'Total cost']);
});

test('a block not added from a template: the button works, nothing is remembered', async ({ page }, testInfo) => {
  const doc = readFixture('block-layouts', 'block-a.json');
  delete doc.canvases[1].template;
  const path = testInfo.outputPath('block-plain.json');
  fs.writeFileSync(path, JSON.stringify(doc));
  await loadPath(page, path, 'block-plain.json');
  const inst1 = await tabRowByName(page, 'Loan (instance 1)');
  await expect(inst1.locator('.instance-tag')).toHaveText('Lay out the other instances like this');
  await expect((await tabRowByName(page, 'Loan')).locator('.module-tag')).toHaveCount(0);
  await arrangeInstance(page, INST1);
  await inst1.locator('.instance-copy').click();
  await page.click('#confirmOk');
  expect(await labels(page, 'Loan (instance 2)')).toEqual(ARRANGED);
  const s = await stored(page);
  expect(s === null || s.modules.length === 0).toBe(true);
});

test('vertical instances: copies matched by vintage, Total and shared; a longer timeline\'s new vintage follows the last', async ({ page }) => {
  const TAB = 'tab_blk_vcm_vi1';
  await load(page, 'block-v');
  await page.click('#viewByTree');
  await rowMenu(page, TAB, 'Total cost (Total)', '⤒ Move to Top');
  await rowMenu(page, TAB, 'Interest — Vintage 2', '☐ Exclude');
  expect(await labels(page, 'Loan (instance 1)')).toEqual(['Total cost (Total)', 'Interest — Vintage 1', 'Interest — Vintage 3', 'Fee (shared)',
    'Total cost — Vintage 1', 'Total cost — Vintage 2', 'Total cost — Vintage 3']);
  const s = await stored(page);
  expect(s.modules[0].instance.rows.map(r => r.copy)).toEqual(expect.arrayContaining([1, 2, 3, 'total', 'shared']));
  await load(page, 'block-v4');
  expect(await labels(page, 'Loan (instance 1)')).toEqual(['Total cost (Total)', 'Interest — Vintage 1', 'Interest — Vintage 3', 'Interest — Vintage 4',
    'Fee (shared)', 'Total cost — Vintage 1', 'Total cost — Vintage 2', 'Total cost — Vintage 3', 'Total cost — Vintage 4']);
});

test('Forget on an instance tab forgets only the instances\' layout; the block\'s own tab keeps its own', async ({ page }) => {
  await load(page, 'block-a');
  await renameTab(page, 'Loan', 'Loan sheet');
  await arrangeInstance(page, INST1);
  await expect.poll(async () => { const s = await stored(page); return !!(s && s.modules[0].instance && s.modules[0].tabName); }).toBe(true);
  await (await tabRowByName(page, 'Loan (instance 1)')).locator('.module-forget').click();
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Forgot the layout remembered for the instances of "Loan".');
  await expect((await tabRowByName(page, 'Loan (instance 1)')).locator('.instance-tag > span').first()).toHaveText('🧩 Loan');
  let m = (await stored(page)).modules[0];
  expect([m.tabName, m.instance]).toEqual(['Loan sheet', undefined]);
  // Forgetting the block's own tab too leaves nothing.
  await (await tabRowByName(page, 'Loan sheet')).locator('.module-forget').click();
  expect((await stored(page)).modules).toEqual([]);
  // Forget the own tab first: the instances' layout stays.
  await renameTab(page, 'Loan sheet', 'Loan again');
  await rowMenu(page, INST1, 'Interest', '⤒ Move to Top');
  await expect.poll(async () => { const s = await stored(page); return !!(s && s.modules[0] && s.modules[0].instance && s.modules[0].tabName); }).toBe(true);
  await (await tabRowByName(page, 'Loan again')).locator('.module-forget').click();
  m = (await stored(page)).modules[0];
  expect([m.tabName, m.rows, !!m.instance]).toEqual([undefined, [], true]);
  await expect((await tabRowByName(page, 'Loan (instance 1)')).locator('.instance-tag > span').first()).toHaveText('🧩 Loan · instance layout remembered');
});

// A workspace carrying the Loan template, its Excel layout attached with an instance layout.
function workspaceWith(instance){
  const system = readFixture('block-layouts', 'block-a.json');
  const block = system.canvases[1];
  return { kind: 'fmIDE-workspace', version: 8, system, templates: [{ name: 'Loan', kind: 'module', group: 'Mine', description: '', family: FAMILY, version: 1, note: '',
    versionId: 'vid-loan-block-0001', data: { version: 5, kind: 'module', nodes: block.nodes, edges: block.edges },
    attachments: { excel: { family: FAMILY, name: 'Loan', rows: [], customs: [], sectioned: [], flat: [], instance } } }] };
}

test('a template\'s attached layout lays out the instance tabs of a block with no remembered layout of your own', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('doc-block.json');
  const row = (name) => ({ name, section: 'calc', include: true, constant: false });
  fs.writeFileSync(path, JSON.stringify(workspaceWith({ rows: [row('total cost'), row('interest'), row('fee')], customs: [],
    sectioned: ['r0', 'r1', 'r2'], flat: ['r0', 'r1', 'r2'] })));
  await loadPath(page, path, 'doc-block.json');
  for(const t of ['Loan (instance 1)', 'Loan (instance 2)']){
    expect(await labels(page, t)).toEqual(['Total cost', 'Interest', 'Fee']);
    await expect((await tabRowByName(page, t)).locator('.instance-tag > span').first()).toHaveText('🧩 Loan · instance layout from the template');
  }
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText("2 tabs laid out from their templates' layout: 6 rows matched, 0 new.");
  // The attachment holds no layout for the block's own tab: it keeps the default.
  await expect((await tabRowByName(page, 'Loan')).locator('.module-tag')).toHaveText('🧩 Loan');
  expect(await stored(page)).toBe(null);
});

test('an instance layout is someone else\'s data: checked, and nothing in it runs', async ({ page }, testInfo) => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  const path = testInfo.outputPath('doc-evil.json');
  fs.writeFileSync(path, JSON.stringify(workspaceWith({
    rows: [{ name: 'interest', copy: '<b>', section: 'calc' }, { name: 'fee', copy: 1e9 }, { name: 'total cost', label: evil, section: 'evil', include: 'yes' },
      { name: 'total cost', label: 'twice' }, 'x', null],
    customs: [{ label: evil, section: '<b>', style: { fill: 'url(javascript:1)' }, indent: 1e9 }],
    sectioned: ['c0', 'r2', 'r0', 'r9', '<b>'], flat: ['c0', 'r2', 'r2', 'r0'] })));
  await loadPath(page, path, 'doc-evil.json');
  const l = await labels(page, 'Loan (instance 1)');
  expect(l.filter(x => x === evil)).toHaveLength(2); // the custom row and Total cost's label, as text
  expect(l.filter(x => x !== evil)).toEqual(['Interest', 'Fee']);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#afterLoad img').count()).toBe(0);
});

test('an older (version 1) module layouts file still imports', async ({ page }) => {
  await load(page, 'block-a');
  await page.setInputFiles('#moduleLayoutsFileInput', fixture('formats', 'module-layouts-v1.json'));
  await expect(page.locator('#moduleLayoutsStatus .status')).toHaveText('Imported 1 module layout. It is used for models laid out here from now on.');
  await page.click('#btnResetMapping');
  await page.click('#confirmOk');
  await expect.poll(() => tabNames(page)).toEqual(['Main', 'Loan v1', 'Loan (instance 1)', 'Loan (instance 2)']);
});
