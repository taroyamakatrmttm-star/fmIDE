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
