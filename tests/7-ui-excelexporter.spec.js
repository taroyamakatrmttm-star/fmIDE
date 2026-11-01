// 7. UI flows — ExcelExporter.
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const MODEL = fixture('models', 'revenue-bs-corkscrew.json');
const SECTION_BANDS = /^(INPUTS|CALCULATIONS|OUTPUTS)$/;

// ---------- helpers ----------
async function open(page, { sections, inputs } = {}){
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
  if(sections !== undefined) await X.setSections(page, sections);
  if(inputs !== undefined) await X.setInputsTab(page, inputs);
}
const tabInputs = (page) => page.locator('#tabsBody input[type=text]');
async function tabNames(page){ return tabInputs(page).evaluateAll(els => els.map(e => e.value)); }
async function renameTab(page, from, to){
  const all = await tabInputs(page).all();
  for(const input of all){
    if(await input.inputValue() === from){ await input.fill(to); await input.dispatchEvent('change'); return; }
  }
  throw new Error('No tab named ' + from);
}
const savedLayouts = (page) => S.storedKeys(page, 'ExcelExporter', 'fmide-excelmap-');

// Tree view: { tabName: [row labels in order] }.
async function tree(page){
  return page.locator('#rowGroupsTree .canvas-group').evaluateAll(groups => Object.fromEntries(groups.map(g => {
    const name = g.querySelector('.canvas-group-header span').textContent.replace(/^[▾▸]\s*/, '');
    const labels = [...g.querySelectorAll('.tree-row')].map(r => {
      const input = r.querySelector('.tree-row-label-input');
      return input ? input.value : r.querySelector('.tree-row-label').textContent;
    });
    return [name, labels];
  })));
}
function treeRow(page, label, { inputs } = {}){
  let rows = page.locator('#rowGroupsTree .tree-row').filter({ has: page.locator('.tree-row-label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
  if(inputs === true) rows = rows.filter({ has: page.locator('.scn-ctl') });
  if(inputs === false) rows = rows.filter({ hasNot: page.locator('.scn-ctl') });
  return rows;
}
// Labels of a generated sheet, top to bottom (band headers kept, blank rows dropped).
async function sheetLabels(page, sheet){
  const { wb } = await X.generate(page);
  const ws = wb.Sheets[sheet];
  return Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).sort((a, b) => a - b).map(r => X.text(ws, 'A' + r)).filter(Boolean);
}
const withoutBands = (labels) => labels.filter(l => !SECTION_BANDS.test(l));
function band(labels, name){
  const i = labels.indexOf(name);
  if(i < 0) return [];
  const rest = labels.slice(i + 1);
  const j = rest.findIndex(l => SECTION_BANDS.test(l));
  return j < 0 ? rest : rest.slice(0, j);
}
async function sort(page, method, within, scope){
  await page.selectOption('#sortMethod', method);
  if(within) await page.selectOption('#sortWithin', within);
  await page.selectOption('#sortScope', scope);
  await page.click('#btnApplySort');
  await expect(page.locator('#sortStatus')).toContainText(/Sorted|Nothing/);
}

// ---------- Start Over / Reset Mapping ----------
test('a new layout: sections off, formula order within groups, Periods on the Inputs tab\'s group headers', async ({ page }) => {
  await open(page);
  await expect(page.locator('#cfgSectionsEnabled')).not.toBeChecked();
  await expect(page.locator('#sortWithin')).toHaveValue('formula');
  await X.setInputsTab(page, true);
  const { wb } = await X.generate(page);
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name];
    for(const band of ['INPUTS', 'CALCULATIONS', 'OUTPUTS']) expect(X.findRow(ws, band), `${name}: no ${band} band`).toEqual([]);
  }
  // Each group header on the Inputs tab (one per source tab) shows the period labels.
  const ws = wb.Sheets['Inputs'], p1 = X.numToCol(X.periodOneCol(ws));
  for(const group of ['BS', 'Corkscrew']){
    const [header] = X.findRow(ws, group);
    expect(header, `the "${group}" group header`).toBeTruthy();
    expect(X.text(ws, p1 + header), `${group} header, period 1`).toBe('2027');
  }
});

test('a new layout starts sorted in calculation order, formula order within groups; a saved one keeps its order', async ({ page }) => {
  await open(page);
  await page.click('#viewByTree');
  const before = await tree(page);
  // Applying that same sort again changes nothing.
  await sort(page, 'calcUp', 'formula', 'all');
  await expect(page.locator('#sortStatus')).toContainText('already in that order');
  expect(await tree(page)).toEqual(before);
  // Reorder by hand: the saved layout keeps it after a reload (no sort on a saved layout).
  await treeRow(page, before['BS'][before['BS'].length - 1]).click();
  await page.locator('#bulkMoveBar button', { hasText: 'Move to Top' }).click();
  const moved = (await tree(page))['BS'];
  expect(moved[0]).toBe(before['BS'][before['BS'].length - 1]);
  await page.reload();
  await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
  await page.click('#viewByTree');
  expect((await tree(page))['BS']).toEqual(moved);
});

test.describe('Start Over and Reset Mapping', () => {
  test('Start Over keeps the saved layout; re-picking the same file loads it', async ({ page }) => {
    await open(page);
    await renameTab(page, 'BS', 'Balance Sheet');
    await expect.poll(() => savedLayouts(page)).toHaveLength(1);
    await X.menuCommand(page, 'btnClearAll');
    await expect(page.locator('#afterLoad')).toBeHidden();
    expect(await savedLayouts(page)).toHaveLength(1);
    await X.loadModelFile(page, MODEL);
    await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
    expect(await tabNames(page)).toContain('Balance Sheet');
  });

  for(const how of ['Cancel', 'Escape', 'backdrop']){
    test(`Reset Mapping: ${how} keeps the layout`, async ({ page }) => {
      await open(page);
      await renameTab(page, 'BS', 'Balance Sheet');
      await expect.poll(() => savedLayouts(page)).toHaveLength(1);
      await X.menuCommand(page, 'btnResetMapping');
      await expect(page.locator('#confirmModal')).toBeVisible();
      if(how === 'Cancel') await page.click('#confirmCancel');
      if(how === 'Escape') await page.keyboard.press('Escape');
      if(how === 'backdrop') await page.locator('#confirmModal').click({ position: { x: 5, y: 5 } });
      await expect(page.locator('#confirmModal')).toBeHidden();
      expect(await tabNames(page)).toContain('Balance Sheet');
      expect(await savedLayouts(page)).toHaveLength(1);
    });
  }

  test('Reset Mapping: OK discards the saved layout', async ({ page }) => {
    await open(page);
    await renameTab(page, 'BS', 'Balance Sheet');
    await X.menuCommand(page, 'btnResetMapping');
    await page.click('#confirmOk');
    await expect(page.locator('#genStatus')).toContainText('Mapping reset to defaults.');
    expect(await tabNames(page)).toEqual(['BS', 'Corkscrew']);
    expect(await savedLayouts(page)).toHaveLength(0);
    // It stays discarded after Start Over and a reload of the file.
    await X.menuCommand(page, 'btnClearAll');
    await X.loadModelFile(page, MODEL);
    expect(await tabNames(page)).toEqual(['BS', 'Corkscrew']);
  });
});

// ---------- A document's layout and the one this browser remembers (1 November 2026) ----------
test.describe('a document\'s layout wins over the browser\'s; hiding the page writes only an unsaved change', () => {
  const fs = require('fs');
  const ASIDE = 'fmide-excelprev-';
  async function exportMapping(page){
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  }
  // The sample model in a workspace carrying `layout` as its Excel layout, as fmIDE saves it.
  function documentWith(layout, testInfo, name){
    const system = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
    const file = testInfo.outputPath(name || 'With layout.fmide');
    fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 16, system, excelLayout: layout }));
    return file;
  }
  const storedText = async (page, prefix) => Object.values(await S.storedEntries(page, 'ExcelExporter', prefix)).join('');
  // Every IndexedDB write's key, from now on (the app is not changed: the browser's own put is wrapped).
  const recordPuts = (page) => page.evaluate(() => {
    const real = IDBObjectStore.prototype.put;
    window.__puts = [];
    IDBObjectStore.prototype.put = function(value, key){ window.__puts.push(String(key)); return real.apply(this, arguments); };
  });
  const layoutPuts = (page) => page.evaluate(() => window.__puts.filter(k => k.startsWith('fmide-excelmap-')).length);

  test('a different remembered layout is replaced by the document\'s, kept aside, and Use This Browser\'s Layout brings it back', async ({ page }, testInfo) => {
    await open(page);
    // The document's layout: BS named "Doc BS".
    await renameTab(page, 'BS', 'Doc BS');
    const docLayout = await exportMapping(page);
    // This browser remembers another: "Browser BS" (as after opening the bare system file).
    await renameTab(page, 'Doc BS', 'Browser BS');
    await expect.poll(() => storedText(page, 'fmide-excelmap-')).toContain('Browser BS');
    await expect(page.locator('#btnUseKeptLayout')).toBeHidden();

    await X.loadModelFile(page, documentWith(docLayout, testInfo));
    await expect(page.locator('#loadStatus')).toContainText('Loaded With layout.fmide');
    await expect(page.locator('#loadStatus .status.ok')).toContainText('in place of the one this browser remembered');
    expect(await tabNames(page)).toContain('Doc BS');
    // The document's is now the remembered one; the browser's is kept aside, not deleted.
    await expect.poll(() => storedText(page, 'fmide-excelmap-')).toContain('Doc BS');
    expect(await storedText(page, 'fmide-excelmap-')).not.toContain('Browser BS');
    expect(await storedText(page, ASIDE)).toContain('Browser BS');
    expect(await savedLayouts(page)).toHaveLength(1);

    // Opening the same document again: the same layout, nothing replaced.
    await X.menuCommand(page, 'btnClearAll');
    await X.loadModelFile(page, documentWith(docLayout, testInfo));
    await expect(page.locator('#loadStatus .status.ok')).toContainText('Its Excel layout came with it.');
    await expect(page.locator('#loadStatus .status.ok')).not.toContainText('in place of');
    expect(await tabNames(page)).toContain('Doc BS');

    // Use This Browser's Layout (it asks first; Cancel changes nothing).
    await X.menuCommand(page, 'btnUseKeptLayout');
    await page.click('#confirmCancel');
    expect(await tabNames(page)).toContain('Doc BS');
    await X.menuCommand(page, 'btnUseKeptLayout');
    await page.click('#confirmOk');
    await expect(page.locator('#genStatus')).toContainText('This browser\'s layout is back.');
    expect(await tabNames(page)).toContain('Browser BS');
    await expect(page.locator('#btnUseKeptLayout')).toBeHidden();
    await expect.poll(() => storedText(page, 'fmide-excelmap-')).toContain('Browser BS');
    expect(await storedText(page, ASIDE)).toContain('Browser BS'); // the copy stays

    // A bare system file brings no layout: the browser's is used, nothing offered.
    await X.menuCommand(page, 'btnClearAll');
    await X.loadModelFile(page, MODEL);
    expect(await tabNames(page)).toContain('Browser BS');
    await expect(page.locator('#loadStatus .status.ok')).not.toContainText('Excel layout');
    await page.click('#menuLayout');
    await expect(page.locator('#btnUseKeptLayout')).toBeHidden();
  });

  test('Reset Mapping to Defaults…, then hiding the page, writes nothing', async ({ page }) => {
    await open(page);
    await renameTab(page, 'BS', 'Balance Sheet');
    await expect.poll(() => savedLayouts(page)).toHaveLength(1);
    await X.menuCommand(page, 'btnResetMapping');
    await page.click('#confirmOk');
    await expect(page.locator('#genStatus')).toContainText('Mapping reset to defaults.');
    await recordPuts(page);
    await S.hidePage(page);
    await page.waitForTimeout(300);
    expect(await layoutPuts(page)).toBe(0);
    expect(await savedLayouts(page)).toHaveLength(0);
    // A fresh load, then hiding: nothing written either.
    await X.menuCommand(page, 'btnClearAll');
    await X.loadModelFile(page, MODEL);
    await S.hidePage(page);
    await page.waitForTimeout(300);
    expect(await layoutPuts(page)).toBe(0);
    expect(await savedLayouts(page)).toHaveLength(0);
  });

  test('a change made just before the page is hidden is written again on hiding; a saved one is not', async ({ page }) => {
    await open(page);
    await recordPuts(page);
    // The change and the hiding in one go: the change's own write has not finished yet.
    await page.evaluate(() => {
      const input = document.querySelector('#tabsBody input[type=text]');
      input.value = 'Just Before';
      input.dispatchEvent(new Event('change'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
    expect(await layoutPuts(page)).toBe(2);
    await expect.poll(() => storedText(page, 'fmide-excelmap-')).toContain('Just Before');
    // Once that is saved, hiding again writes nothing.
    await page.waitForTimeout(300);
    await S.hidePage(page);
    await page.waitForTimeout(300);
    expect(await layoutPuts(page)).toBe(2);
  });
});

// ---------- Sorting ----------
test.describe('sorting', () => {
  const BS_CALC_UP = ['Unit Price', 'Volume', 'AR outstanding rate', 'Revenue', 'Accounts Receivable', 'Cash', 'Inventory', 'Total Assets'];

  test('calculation order, A→Z, all tabs; Undo restores the order', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const before = await tree(page);
    await sort(page, 'calcUp', 'alpha', 'all');
    expect((await tree(page))['BS']).toEqual(BS_CALC_UP);
    expect(withoutBands(await sheetLabels(page, 'BS'))).toEqual(BS_CALC_UP);
    await page.locator('#sortStatus button', { hasText: 'Undo' }).click();
    await expect(page.locator('#sortStatus')).toContainText('Sort undone.');
    expect(await tree(page)).toEqual(before);
  });

  test('formula order puts the corkscrew in reading order', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await sort(page, 'calcUp', 'formula', 'all');
    expect((await tree(page))['Corkscrew']).toEqual(['Beginning Balance', 'Additions', 'Subtractions', 'Ending Balance']);
  });

  test('custom rows keep their slots', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await treeRow(page, 'Inventory').click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row below' }).click();
    const input = page.locator('.tree-row-label-input');
    await input.fill('Divider');
    await input.press('Enter');
    const before = (await tree(page))['BS'];
    const slot = before.indexOf('Divider');
    expect(slot).toBeGreaterThan(-1);
    await sort(page, 'alpha', null, 'all');
    const after = (await tree(page))['BS'];
    expect(after.indexOf('Divider')).toBe(slot);
    const others = after.filter(l => l !== 'Divider');
    expect(others).toEqual(others.slice().sort((a, b) => a.localeCompare(b)));
  });

  test('with sections on, each band is sorted on its own', async ({ page }) => {
    await open(page, { sections: true });
    await sort(page, 'calcUp', 'alpha', 'all');
    expect(band(await sheetLabels(page, 'BS'), 'INPUTS')).toEqual(['Unit Price', 'Volume', 'AR outstanding rate', 'Cash', 'Inventory']);
  });

  test('the Inputs tab is never sorted and never offered as a scope', async ({ page }) => {
    await open(page, { sections: false, inputs: true });
    const scopes = await page.locator('#sortScope option').allTextContents();
    expect(scopes.some(s => /Inputs/.test(s)), 'scope list: ' + scopes.join(', ')).toBe(false);
    const before = await sheetLabels(page, 'Inputs');
    await sort(page, 'alpha', null, 'all');
    expect(await sheetLabels(page, 'Inputs')).toEqual(before);
  });
});

// ---------- Tree view ----------
test.describe('Tree view', () => {
  test('Collapse all folds every tab, Expand all opens them; only with the Tree; not saved', async ({ page }) => {
    await open(page);
    await page.click('#viewByTree');
    const all = await tree(page);
    const headings = page.locator('#rowGroupsTree .tree-tab-header span:first-child');
    await page.click('#btnTreeCollapseAll');
    expect(Object.values(await tree(page)).every(rows => rows.length === 0)).toBe(true);
    for(const h of await headings.allTextContents()) expect(h).toMatch(/^▸ /);
    // A tab's name still opens just that tab.
    await page.locator('#rowGroupsTree .tree-tab-header', { hasText: /^▸ BS/ }).click();
    const one = await tree(page);
    expect(one['BS']).toEqual(all['BS']);
    expect(Object.entries(one).filter(([name]) => name !== 'BS').every(([, rows]) => rows.length === 0)).toBe(true);
    await page.click('#btnTreeExpandAll');
    expect(await tree(page)).toEqual(all);
    // Shown only with the Tree.
    await page.click('#viewByTab');
    await expect(page.locator('#btnTreeCollapseAll')).toBeHidden();
    await expect(page.locator('#btnTreeExpandAll')).toBeHidden();
    await page.click('#viewByCanvas');
    await expect(page.locator('#btnTreeCollapseAll')).toBeHidden();
    await page.click('#viewByTree');
    await expect(page.locator('#btnTreeCollapseAll')).toBeVisible();
    await expect(page.locator('#btnTreeExpandAll')).toBeVisible();
    // Not saved: after a reload every tab is open again.
    await page.click('#btnTreeCollapseAll');
    await page.reload();
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await page.click('#viewByTree');
    expect(await tree(page)).toEqual(all);
  });

  test('right-click inserts a custom row above / below and opens rename', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await treeRow(page, 'Revenue').click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row above' }).click();
    const input = page.locator('.tree-row-label-input');
    await expect(input).toBeFocused();
    await input.fill('Above Revenue');
    await input.press('Enter');
    let bs = (await tree(page))['BS'];
    expect(bs[bs.indexOf('Revenue') - 1]).toBe('Above Revenue');

    await treeRow(page, 'Revenue').click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row below' }).click();
    await page.locator('.tree-row-label-input').fill('Below Revenue');
    await page.locator('.tree-row-label-input').press('Enter');
    bs = (await tree(page))['BS'];
    expect(bs[bs.indexOf('Revenue') + 1]).toBe('Below Revenue');
  });

  test('with several rows selected: above the first, below the last', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const bs0 = (await tree(page))['BS'];
    const [a, b] = [bs0[1], bs0[3]];
    await treeRow(page, a).click();
    await treeRow(page, b).click({ modifiers: ['ControlOrMeta'] });
    await treeRow(page, b).click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row above' }).click();
    await page.locator('.tree-row-label-input').fill('Top Marker');
    await page.locator('.tree-row-label-input').press('Enter');
    let bs = (await tree(page))['BS'];
    expect(bs[bs.indexOf(a) - 1]).toBe('Top Marker');

    await treeRow(page, a).click();
    await treeRow(page, b).click({ modifiers: ['ControlOrMeta'] });
    await treeRow(page, a).click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row below' }).click();
    await page.locator('.tree-row-label-input').fill('Bottom Marker');
    await page.locator('.tree-row-label-input').press('Enter');
    bs = (await tree(page))['BS'];
    expect(bs[bs.indexOf(b) + 1]).toBe('Bottom Marker');
  });

  test('with sections on, an inserted row stays in its anchor\'s section', async ({ page }) => {
    await open(page, { sections: true });
    await page.click('#viewByTree');
    // Accounts Receivable is the last row of the Calculations band.
    await treeRow(page, 'Accounts Receivable').click({ button: 'right' });
    await page.locator('#treeCtxMenu button', { hasText: 'Insert custom row below' }).click();
    await page.locator('.tree-row-label-input').fill('Calc Note');
    await page.locator('.tree-row-label-input').press('Enter');
    const labels = await sheetLabels(page, 'BS');
    const calc = band(labels, 'CALCULATIONS');
    expect(calc[calc.length - 1], 'CALCULATIONS band: ' + calc.join(', ')).toBe('Calc Note');
    expect(band(labels, 'OUTPUTS')).not.toContain('Calc Note');
  });

  test('"+ Add Custom Row" goes below the selection, or to the bottom of the first tab', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await treeRow(page, 'Cash').click();
    await page.click('#btnAddCustomRow');
    await page.locator('.tree-row-label-input').fill('After Cash');
    await page.locator('.tree-row-label-input').press('Enter');
    let t = await tree(page);
    expect(t['BS'][t['BS'].indexOf('Cash') + 1]).toBe('After Cash');

    await page.locator('#bulkMoveBar button', { hasText: 'Clear selection' }).click();
    await expect(page.locator('#bulkMoveBar')).toBeHidden();
    await page.click('#btnAddCustomRow');
    t = await tree(page);
    const firstTab = Object.keys(t)[0];
    expect(t[firstTab][t[firstTab].length - 1]).toBe('');
  });

  test('double-click with nothing selected renames that row', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await expect(page.locator('#bulkMoveBar')).toBeHidden();
    const target = treeRow(page, 'Accounts Receivable');
    await target.locator('.tree-row-label').dblclick();
    const input = page.locator('.tree-row-label-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Accounts Receivable');
    await input.fill('AR');
    await input.press('Enter');
    const bs = (await tree(page))['BS'];
    expect(bs).toContain('AR');
    expect(bs).not.toContain('Accounts Receivable');
  });
});

// ---------- Inputs tab ----------
test.describe('Tree view: a row\'s own format, indent and the right-click commands', () => {
  const menuItem = (page, name) => page.locator('#treeCtxMenu').getByRole('menuitem', { name, exact: true });
  // Set a colour input the way a person picking a colour does (Playwright can't type into one).
  async function pickColour(locator, value){
    await locator.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
  }
  // Period cells and the label cell of `label` on `sheet`, from the real .xlsx file.
  async function cellsOf(page, sheet, label){
    const { wb, bytes } = await X.generate(page);
    const book = await X.readBack(bytes);
    const ws = wb.Sheets[sheet], p1 = X.periodOneCol(ws);
    const [r] = X.findRow(ws, label);
    expect(r, `"${label}" on ${sheet}`).toBeTruthy();
    const out = [];
    for(let c = p1; ws[X.numToCol(c) + 3]; c++) out.push(book.getWorksheet(sheet).getCell(X.numToCol(c) + r));
    return { label: book.getWorksheet(sheet).getCell('A' + r), periods: out };
  }
  const fillOf = (c) => (c.fill && c.fill.type === 'pattern' && c.fill.fgColor) ? c.fill.fgColor.argb : null;

  test('a rectangle row takes its own fill, bold and number format in Excel, and Reset gives fmIDE\'s back', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const row = treeRow(page, 'Revenue');
    await row.locator('.tree-fmt-btn').click();
    const ed = row.locator('.tree-style-editor');
    await pickColour(ed.locator('.fmt-fill'), '#fde68a');
    await ed.locator('.fmt-nofill').uncheck();
    await ed.locator('.fmt-bold').check();
    await ed.locator('.fmt-numkind').selectOption('percent');
    await ed.locator('.fmt-decimals').fill('1');
    await ed.locator('.fmt-decimals').dispatchEvent('change');
    await expect(row.locator('.tree-fmt-btn')).toHaveClass(/\bon\b/);
    let { label, periods } = await cellsOf(page, 'BS', 'Revenue');
    for(const c of periods.concat([label])){
      expect(fillOf(c), `${c.address} fill`).toBe('FFFDE68A');
      expect(c.font && c.font.bold, `${c.address} bold`).toBe(true);
    }
    for(const c of periods) expect(c.numFmt, `${c.address} number format`).toBe('0.0%');

    await ed.locator('.fmt-reset').click();
    await expect(treeRow(page, 'Revenue').locator('.tree-fmt-btn')).not.toHaveClass(/\bon\b/);
    ({ label, periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods) expect(fillOf(c), `${c.address} fill after Reset`).toBe(null); // Calculations: no fill
  });

  test('a rectangle row\'s own Excel number format code: written exactly, winning over the kind; refused when unusable; Reset clears it', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const row = treeRow(page, 'Revenue');
    await row.locator('.tree-fmt-btn').click();
    const ed = row.locator('.tree-style-editor');
    const box = ed.locator('.fmt-excelcode');
    await expect(box).toHaveAttribute('placeholder', '#,##0;(#,##0)');
    await expect(box).toHaveAttribute('title', /Format Cells/);
    await expect(box).toHaveValue('');
    await ed.locator('.fmt-numkind').selectOption('percent');
    const code = '#,##0.0;(#,##0.0);"–"';
    await box.fill(code);
    await box.dispatchEvent('change');
    await expect(box).not.toHaveAttribute('aria-invalid', 'true');
    let { periods } = await cellsOf(page, 'BS', 'Revenue');
    for(const c of periods) expect(c.numFmt, `${c.address} number format`).toBe(code);
    // Kept in the layout: Export Mapping carries it.
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    const exported = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
    expect(exported.rows.find(r => r.label === 'Revenue').style.excelFormat).toBe(code);

    // Codes that can't be used: refused (marked, not saved), the row's kind used instead.
    const setRaw = (v) => box.evaluate((el, x) => { el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    for(const bad of ['0;0;0;0;0;0', '0\u0001"x"', '0'.repeat(101), '"open', '0[Red']){
      await setRaw(bad);
      await expect(box, JSON.stringify(bad)).toHaveAttribute('aria-invalid', 'true');
      ({ periods } = await cellsOf(page, 'BS', 'Revenue'));
      for(const c of periods) expect(c.numFmt, `${c.address} with ${JSON.stringify(bad)}`).toBe('0%');
    }
    await box.fill('0.0"x"');
    await box.dispatchEvent('change');
    await expect(box).not.toHaveAttribute('aria-invalid', 'true');
    ({ periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods) expect(c.numFmt).toBe('0.0"x"');

    await ed.locator('.fmt-reset').click();
    await expect(treeRow(page, 'Revenue').locator('.tree-fmt-btn')).not.toHaveClass(/\bon\b/);
    ({ periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods) expect(c.numFmt, `${c.address} after Reset`).not.toBe('0.0"x"');
    await treeRow(page, 'Revenue').locator('.tree-fmt-btn').click();
    await expect(treeRow(page, 'Revenue').locator('.tree-style-editor .fmt-excelcode')).toHaveValue('');
  });

  test('Alt+Shift+→/← and the menu indent the selected labels; the indent reaches Excel and is kept', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    await treeRow(page, 'Cash').click();
    await treeRow(page, 'Inventory').click({ modifiers: ['ControlOrMeta'] });
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await treeRow(page, 'Cash').click({ button: 'right' });
    await menuItem(page, '⇤ Decrease Indent').click();
    for(const l of ['Cash', 'Inventory']) await expect(treeRow(page, l).locator('.tree-row-label')).toHaveAttribute('data-indent', '2');
    for(const l of ['Cash', 'Inventory']){
      const { label, periods } = await cellsOf(page, 'BS', l);
      expect(label.alignment && label.alignment.indent, `${l} label indent`).toBe(2);
      expect(label.alignment && label.alignment.horizontal).toBe('left');
      for(const c of periods) expect(c.alignment && c.alignment.indent, `${c.address}: only the label is indented`).toBeFalsy();
    }
    // A custom row takes an indent too.
    await treeRow(page, 'Cash').click({ button: 'right' });
    await menuItem(page, 'Insert custom row above').click();
    await page.locator('.tree-row-label-input').fill('Working capital');
    await page.locator('.tree-row-label-input').press('Enter');
    await treeRow(page, 'Working capital').click();
    await page.keyboard.press('Alt+Shift+ArrowRight');
    expect((await cellsOf(page, 'BS', 'Working capital')).label.alignment.indent).toBe(1);
    // Kept: the saved layout comes back after a reload.
    await page.reload();
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await page.click('#viewByTree');
    await expect(treeRow(page, 'Cash').locator('.tree-row-label')).toHaveAttribute('data-indent', '2');
    // The menu's Reset takes the indent off.
    await treeRow(page, 'Cash').click({ button: 'right' });
    await menuItem(page, 'Reset to the Excel style').click();
    await expect(treeRow(page, 'Cash').locator('.tree-row-label')).not.toHaveAttribute('data-indent', /./);
  });

  test('the right-click menu runs the selection bar\'s commands on every selected row', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const bs0 = (await tree(page))['BS'];
    await treeRow(page, 'Cash').click();
    await treeRow(page, 'Inventory').click({ modifiers: ['ControlOrMeta'] });
    await treeRow(page, 'Inventory').click({ button: 'right' });
    for(const name of ['▲ Move Up', '▼ Move Down', '⤒ Move to Top', '⤓ Move to Bottom', '☑ Include', '☐ Exclude', '◆ Mark Constant',
      '◇ Unmark Constant', '⇥ Increase Indent', '⇤ Decrease Indent', '🎨 Format 2 rows…', 'Reset to the Excel style']){
      await expect(menuItem(page, name), name).toBeVisible();
    }
    await menuItem(page, '⤒ Move to Top').click();
    let bs = (await tree(page))['BS'];
    expect(bs.slice(0, 2)).toEqual(bs0.filter(l => l === 'Cash' || l === 'Inventory'));
    await treeRow(page, 'Cash').click({ button: 'right' }); // inside the selection: both stay selected
    await menuItem(page, '☐ Exclude').click();
    for(const l of ['Cash', 'Inventory']) await expect(treeRow(page, l)).toHaveClass(/excluded/);
    await treeRow(page, 'Cash').click({ button: 'right' });
    await menuItem(page, '◆ Mark Constant').click();
    for(const l of ['Cash', 'Inventory']) await expect(treeRow(page, l).locator('.const-tag')).toBeVisible();
    // Move to another tab, at its bottom.
    await treeRow(page, 'Cash').click({ button: 'right' });
    await page.locator('#treeCtxMenu .ctx-sub select').first().selectOption({ label: 'Corkscrew' });
    await page.locator('#treeCtxMenu .ctx-sub button', { hasText: 'at bottom' }).click();
    const t = await tree(page);
    expect(t['Corkscrew'].slice(-2)).toEqual(['Cash', 'Inventory']);
    expect(t['BS']).not.toContain('Cash');
    // Formatting two rows at once: the editor's change applies to both.
    await treeRow(page, 'Cash').click();
    await treeRow(page, 'Inventory').click({ modifiers: ['ControlOrMeta'] });
    await treeRow(page, 'Cash').click({ button: 'right' });
    await menuItem(page, '🎨 Format 2 rows…').click();
    await treeRow(page, 'Cash').locator('.tree-style-editor .fmt-bold').check();
    for(const l of ['Cash', 'Inventory']) await expect(treeRow(page, l).locator('.tree-fmt-btn')).toHaveClass(/\bon\b/);
  });

  test('a row\'s own border takes each side on its own: top, bottom, left, right', async ({ page }) => {
    await open(page, { sections: false });
    await page.click('#viewByTree');
    const row = treeRow(page, 'Revenue');
    await row.locator('.tree-fmt-btn').click();
    const ed = row.locator('.tree-style-editor');
    // Calculations have no border in the Excel style: the editor starts with no side on.
    for(const k of ['top', 'bottom', 'left', 'right']) await expect(ed.locator('.fmt-border-' + k)).not.toBeChecked();
    await pickColour(ed.locator('.fmt-bordercolor'), '#b45309');
    await ed.locator('.fmt-border-top').check();
    await ed.locator('.fmt-border-bottom').check();
    let { label, periods } = await cellsOf(page, 'BS', 'Revenue');
    for(const c of periods.concat([label])){
      expect(c.border.top && c.border.top.style, `${c.address} top`).toBe('thin');
      expect(c.border.top.color.argb, `${c.address} top colour`).toBe('FFB45309');
      expect(c.border.bottom && c.border.bottom.style, `${c.address} bottom`).toBe('thin');
      expect(c.border.left, `${c.address} left`).toBeUndefined();
      expect(c.border.right, `${c.address} right`).toBeUndefined();
    }
    // Only the left side.
    await ed.locator('.fmt-border-top').uncheck();
    await ed.locator('.fmt-border-bottom').uncheck();
    await ed.locator('.fmt-border-left').check();
    ({ label, periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods){
      expect(c.border.left && c.border.left.style, `${c.address} left`).toBe('thin');
      expect(c.border.top || c.border.bottom || c.border.right, `${c.address} other sides`).toBeFalsy();
    }
    // Saved in the layout: the mapping file names the sides; kept after a reload.
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    const m = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
    expect(m.rows.find(r => r.label === 'Revenue').style.border).toEqual({ color: '#b45309', style: 'solid', sides: ['left'] });
    await page.reload();
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await page.click('#viewByTree');
    await treeRow(page, 'Revenue').locator('.tree-fmt-btn').click();
    const again = treeRow(page, 'Revenue').locator('.tree-style-editor');
    await expect(again.locator('.fmt-border-left')).toBeChecked();
    for(const k of ['top', 'bottom', 'right']) await expect(again.locator('.fmt-border-' + k)).not.toBeChecked();
    // All four: written as before sides existed (no `sides`), and boxed in Excel.
    for(const k of ['top', 'bottom', 'right']) await again.locator('.fmt-border-' + k).check();
    ({ periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods) for(const k of ['top', 'bottom', 'left', 'right']) expect(c.border[k] && c.border[k].style, `${c.address} ${k}`).toBe('thin');
    const [d2] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    const m2 = JSON.parse(require('fs').readFileSync(await d2.path(), 'utf8'));
    expect(m2.rows.find(r => r.label === 'Revenue').style.border).toEqual({ color: '#b45309', style: 'solid' });
    // None: no border.
    for(const k of ['top', 'bottom', 'left', 'right']) await again.locator('.fmt-border-' + k).uncheck();
    ({ periods } = await cellsOf(page, 'BS', 'Revenue'));
    for(const c of periods) expect(Object.keys(c.border || {}).length, `${c.address} no border`).toBe(0);
  });

  test('border sides from a mapping file: unknown ones dropped, none means no border, none named means all four', async ({ page }, testInfo) => {
    await open(page, { sections: false });
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    const m = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
    const style = (border) => ({ fill: null, font: { color: '#1e293b', weight: 'normal' }, border });
    m.rows.find(r => r.label === 'Revenue').style = style({ style: 'solid', color: '#123456', sides: ['bottom', '<img src=x onerror="window.__hacked=1">', 'bottom'] });
    m.rows.find(r => r.label === 'Cash').style = style({ style: 'solid', color: '#123456', sides: [] });
    m.rows.find(r => r.label === 'Inventory').style = style({ style: 'solid', color: '#123456' });
    const file = testInfo.outputPath('border-sides.json');
    require('fs').writeFileSync(file, JSON.stringify(m));
    await page.setInputFiles('#mappingFileInput', file);
    await expect(page.locator('#genStatus .status')).toHaveText('Mapping imported.');
    const sidesOf = async (label) => {
      const { periods } = await cellsOf(page, 'BS', label);
      return Object.keys(periods[0].border || {}).filter(k => periods[0].border[k] && periods[0].border[k].style).sort();
    };
    expect(await sidesOf('Revenue')).toEqual(['bottom']);
    expect(await sidesOf('Cash')).toEqual([]);
    expect(await sidesOf('Inventory')).toEqual(['bottom', 'left', 'right', 'top']);
    await page.click('#viewByTree');
    await treeRow(page, 'Revenue').locator('.tree-fmt-btn').click();
    await expect(treeRow(page, 'Revenue').locator('.tree-style-editor .fmt-border-bottom')).toBeChecked();
    await expect(treeRow(page, 'Revenue').locator('.tree-style-editor .fmt-border-top')).not.toBeChecked();
    expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
  });

  test('a row format or indent from a mapping file is checked before use', async ({ page }, testInfo) => {
    await open(page, { sections: false });
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    const m = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
    const rev = m.rows.find(r => r.label === 'Revenue'), cash = m.rows.find(r => r.label === 'Cash');
    rev.style = { fill: 'red;"><img src=x onerror="window.__hacked=1">', font: { color: 'javascript:1', weight: 'bold' },
      border: { style: 'solid', color: '#12345' }, numberFormat: { kind: 'currency', decimals: 1e9, currencySymbol: '"&"' } };
    rev.indent = 'lots';
    cash.indent = 999;
    const file = testInfo.outputPath('hostile-mapping.json');
    require('fs').writeFileSync(file, JSON.stringify(m));
    await page.setInputFiles('#mappingFileInput', file);
    await expect(page.locator('#genStatus .status')).toHaveText('Mapping imported.');
    await page.click('#viewByTree');
    await expect(treeRow(page, 'Cash').locator('.tree-row-label')).toHaveAttribute('data-indent', '15');
    const r = await cellsOf(page, 'BS', 'Revenue');
    expect(r.label.alignment && r.label.alignment.indent).toBeFalsy();
    for(const c of r.periods){
      expect(fillOf(c)).toBe(null);              // the bad colour is dropped: no fill
      expect(c.font && c.font.bold).toBe(true);
      expect(c.numFmt).toBe('"$"#,##0.0000000000'); // at most 10 decimals, the symbol fixed
    }
    expect((await cellsOf(page, 'BS', 'Cash')).label.alignment.indent).toBe(15);
    expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
  });
});

test.describe('Inputs tab', () => {
  test('an empty row above every group header but the first; grouping off has none; regrouping brings them back', async ({ page }) => {
    await open(page, { inputs: true });
    const inputsColumn = async () => {
      const { wb } = await X.generate(page);
      const ws = wb.Sheets['Inputs'];
      const out = [];
      for(let r = 4; ws['A' + r] || ws['A' + (r + 1)]; r++) out.push(X.text(ws, 'A' + r) || '');
      return out;
    };
    const col = await inputsColumn();
    const headers = ['BS', 'Corkscrew'].map(h => col.indexOf(h)).sort((a, b) => a - b);
    expect(headers[0]).toBe(0);                         // the first header: nothing above it
    expect(headers[1]).toBeGreaterThan(1);
    expect(col[headers[1] - 1]).toBe('');                // an empty row above the second
    expect(col[headers[1] - 2]).not.toBe('');            // right under the first group's last row
    expect(col.filter(t => t === '').length).toBe(1);
    // No grouping: no headers, no empty rows; grouped again: back.
    await page.selectOption('#cfgInputsGroup', 'none');
    expect((await inputsColumn()).filter(t => t === '' || t === 'BS' || t === 'Corkscrew')).toEqual([]);
    await page.selectOption('#cfgInputsGroup', 'tab');
    expect(await inputsColumn()).toEqual(col);
    // In the Tree: the empty row is a label row of its own, without the period labels.
    await page.click('#viewByTree');
    const rows = await tree(page);
    expect(rows['Inputs'].filter(t => t === '').length).toBe(1);
  });

  test('renaming an Inputs-tab row renames its source', async ({ page }) => {
    await open(page, { inputs: true });
    await page.click('#viewByTree');
    await treeRow(page, 'Volume', { inputs: true }).locator('.tree-row-label').dblclick();
    const input = page.locator('.tree-row-label-input');
    await input.fill('Units Sold');
    await input.press('Enter');
    const t = await tree(page);
    expect(t['Inputs']).toContain('Units Sold');
    expect(t['BS']).toContain('Units Sold');
    expect(t['BS']).not.toContain('Volume');
  });

  test('a double-click whose second click lands in the gap under the selection bar still renames the row', async ({ page }) => {
    await open(page, { inputs: true });
    await page.click('#viewByTree');
    const label = treeRow(page, 'Volume', { inputs: true }).locator('.tree-row-label');
    const at = await label.boundingBox();
    await page.mouse.click(at.x + 10, at.y + at.height / 2);
    // The bar has appeared; the second click goes to the Rows panel between it and the tree.
    const bar = await page.locator('#bulkMoveBar').boundingBox(), list = await page.locator('#rowGroupsTree').boundingBox();
    const gap = { x: at.x + 10, y: (bar.y + bar.height + list.y) / 2 };
    expect(list.y - (bar.y + bar.height)).toBeGreaterThan(4);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).id, gap)).toBe('rowsPanel');
    await page.mouse.move(gap.x, gap.y);
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up({ clickCount: 2 });
    const input = page.locator('.tree-row-label-input');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Volume');
  });

  test('excluding the source removes it from the Inputs tab', async ({ page }) => {
    await open(page, { inputs: true });
    await page.click('#viewByTree');
    await treeRow(page, 'Cash', { inputs: false }).click();
    await page.locator('#bulkMoveBar button', { hasText: 'Exclude' }).click();
    expect(withoutBands(await sheetLabels(page, 'Inputs'))).not.toContain('Cash');
    expect(withoutBands(await sheetLabels(page, 'BS'))).not.toContain('Cash');
  });

  test('an Inputs-tab row cannot be moved to another tab', async ({ page }) => {
    await open(page, { inputs: true });
    await page.click('#viewByTree');
    await treeRow(page, 'Cash', { inputs: true }).click();
    const bar = page.locator('#bulkMoveBar');
    await expect(bar).toBeVisible();
    const tabSelect = bar.locator('select').first();
    await tabSelect.selectOption({ label: 'Corkscrew' });
    await bar.locator('button', { hasText: 'at bottom' }).click();
    const t = await tree(page);
    expect(t['Inputs']).toContain('Cash');
    expect(t['Corkscrew']).not.toContain('Cash');
  });

  test('name clash: an existing "Inputs" tab makes it "Inputs 2" with a warning', async ({ page }) => {
    await open(page);
    await renameTab(page, 'Corkscrew', 'Inputs');
    await page.locator('#cfgInputsEnabled').check();
    await expect(page.locator('#inputsStatus .status.err')).toContainText('"Inputs 2"');
    expect(await tabNames(page)).toEqual(expect.arrayContaining(['Inputs', 'Inputs 2']));
    const { wb } = await X.generate(page);
    expect(wb.SheetNames[0]).toBe('Inputs 2');
  });
});

// ---------- A canvas added after the layout was saved ----------
test.describe('a canvas added after the layout was saved', () => {
  const fs = require('fs');
  // The layout as Export Mapping writes it.
  async function exportMapping(page){
    const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
    return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  }
  // The sample model with two canvases more (one named as an existing tab), in a workspace
  // carrying `layout` as its Excel layout — as fmIDE saves a document whose model grew.
  function grownWorkspace(layout, testInfo){
    const system = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
    system.canvases.push(
      { id: 'cNew', name: 'Extra', nodes: [
        { id: 'x1', type: 'value', x: 100, y: 40, text: 'Extra input\n5' },
        { id: 'x2', type: 'value', x: 100, y: 140, text: 'Extra two\n3' }], edges: [] },
      { id: 'cNew2', name: 'BS', nodes: [{ id: 'y1', type: 'value', x: 100, y: 40, text: 'Second input\n7' }], edges: [] });
    const file = testInfo.outputPath('grown.fmide');
    fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 14, system, excelLayout: layout }));
    return file;
  }
  const newRows = (layout) => layout.rows.filter(r => r.canvasId === 'cNew' || r.canvasId === 'cNew2');

  test('a new canvas gets its own tab, at the end, with its rows; none of them on the Inputs tab', async ({ page }, testInfo) => {
    await open(page, { inputs: true });
    const saved = await exportMapping(page);
    expect(saved.tabs.map(t => t.id)).not.toContain('tab_cNew');
    await X.loadModelFile(page, grownWorkspace(saved, testInfo));
    // The first model's page is already showing: wait for this file's own load message.
    await expect(page.locator('#loadStatus')).toContainText('Loaded grown.fmide');
    expect(await tabNames(page)).toEqual(['Inputs', 'BS', 'Corkscrew', 'Extra', 'BS 2']);
    await page.click('#viewByTree');
    const t = await tree(page);
    expect(t['Extra']).toEqual(['Extra input', 'Extra two']);
    expect(t['BS 2']).toEqual(['Second input']);
    const now = await exportMapping(page);
    const rows = newRows(now);
    expect(rows).toHaveLength(3);
    for(const r of rows) expect(r.tabId, r.id).toBe('tab_' + r.canvasId);
    // Their numbers are still typed on the Inputs tab, through its own rows (mirrors).
    expect(now.inputRows.map(m => m.sourceRowId)).toEqual(expect.arrayContaining(rows.map(r => r.id)));
  });

  test('rows an earlier load put on the Inputs tab move to the new tab; others stay where they were put', async ({ page }, testInfo) => {
    await open(page, { inputs: true });
    const saved = await exportMapping(page);
    // As the earlier ExcelExporter left it: the new canvas's rows on the Inputs tab, no tab of its own.
    saved.rows.push(
      { id: 'cNew|x1', canvasId: 'cNew', nodeId: 'x1', path: [], tabId: 'tab__inputs', section: 'input', order: 50, label: 'Extra input', include: true, inlineConstant: false },
      { id: 'cNew|x2', canvasId: 'cNew', nodeId: 'x2', path: [], tabId: 'tab_cCK', section: 'input', order: 50, label: 'Extra two', include: true, inlineConstant: false });
    await X.loadModelFile(page, grownWorkspace(saved, testInfo));
    // The first model's page is already showing: wait for this file's own load message.
    await expect(page.locator('#loadStatus')).toContainText('Loaded grown.fmide');
    const now = await exportMapping(page);
    const byNode = Object.fromEntries(newRows(now).map(r => [r.nodeId, r.tabId]));
    expect(byNode).toEqual({ x1: 'tab_cNew', x2: 'tab_cCK', y1: 'tab_cNew2' });
    await page.click('#viewByTree');
    const t = await tree(page);
    expect(t['Extra']).toEqual(['Extra input']);
    expect(t['Corkscrew']).toContain('Extra two');
  });
});

// ---------- Storage failure ----------
test('storage failure shows a warning, and it clears once saving works', async ({ page }) => {
  await open(page);
  await S.breakStorage(page);
  await renameTab(page, 'BS', 'Balance Sheet');
  await expect(page.locator('#storageWarn')).toBeVisible();
  await expect(page.locator('#storageWarn')).toContainText('storage is full');
  await S.fixStorage(page);
  await renameTab(page, 'Balance Sheet', 'Balance');
  await expect(page.locator('#storageWarn')).toBeHidden();
});
