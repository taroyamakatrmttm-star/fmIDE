// 4. The Excel style (step 11a): ExcelExporter's own look for every cell, by role, and how
// it lands in the real .xlsx file. fmIDE gives only the number formats; the Excel-only roles
// and settings older fmIDE files carry are ignored.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const ROLES = ['Inputs', 'Calculations', 'Links', 'Headers', 'Section Headers', 'Labels', 'Notes'];

async function load(page, model, { inputs = false } = {}){
  await X.openExporter(page);
  await X.loadFixtureModel(page, model);
  await X.setInputsTab(page, inputs);
}
const roleRow = (page, role) => page.locator(`#excelStyleBody tr[data-role="${role}"]`);
const roleField = (page, role, field) => roleRow(page, role).locator(`[data-field="${field}"]`);

// Period cells of every row labelled `label`, as exceljs cells from the real file.
async function periodCells(page, label){
  const { wb, bytes } = await X.generate(page);
  const book = await X.readBack(bytes);
  const out = [];
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name], p1 = X.periodOneCol(ws);
    if(!p1) continue;
    for(const r of X.findRow(ws, label)){
      for(let c = p1; ws[X.numToCol(c) + 3]; c++) out.push({ sheet: name, addr: X.numToCol(c) + r, cell: book.getWorksheet(name).getCell(X.numToCol(c) + r), linkToInputs: /Inputs'?!/.test(X.formulaOf(ws[X.numToCol(c) + r]) || '') });
    }
  }
  expect(out.length, `cells for "${label}"`).toBeGreaterThan(0);
  return { wb, book, cells: out };
}
// Every cell that links to the Inputs tab, outside it.
function linkCells(wb, book){
  const links = [];
  for(const name of wb.SheetNames.filter(n => n !== 'Inputs')){
    const ws = wb.Sheets[name];
    X.cellAddrs(ws).filter(a => /Inputs'?!/.test(X.formulaOf(ws[a]) || '')).forEach(a => links.push(book.getWorksheet(name).getCell(a)));
  }
  expect(links.length).toBeGreaterThan(0);
  return links;
}
// Input cells: numbers typed on the sheet (not formulas).
function typedCells(wb, book){
  const out = [];
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name], p1 = X.periodOneCol(ws);
    if(!p1) continue;
    X.cellAddrs(ws).filter(a => X.splitAddr(a).row > 3 && X.splitAddr(a).col >= p1 && typeof ws[a].v === 'number' && !X.formulaOf(ws[a]))
      .forEach(a => out.push(book.getWorksheet(name).getCell(a)));
  }
  expect(out.length).toBeGreaterThan(0);
  return out;
}
const fillOf = (c) => (c.fill && c.fill.type === 'pattern' && c.fill.pattern === 'solid' && c.fill.fgColor) ? c.fill.fgColor.argb : null;
const fontColorOf = (c) => (c.font && c.font.color && c.font.color.argb) || null;
const sidesOf = (c) => ['top', 'bottom', 'left', 'right'].filter(k => c.border && c.border[k] && c.border[k].style);

test('the Excel style lists the seven roles with ExcelExporter\'s own defaults', async ({ page }) => {
  await load(page, 'roles-workspace-defaults.json');
  const roles = await page.locator('#excelStyleBody tr').evaluateAll(trs => trs.map(tr => tr.dataset.role));
  expect(roles).toEqual(ROLES);
  await expect(roleField(page, 'Links', 'fontColor')).toHaveValue('#008000');
  await expect(roleField(page, 'Links', 'fontAuto')).not.toBeChecked();
  await expect(roleField(page, 'Inputs', 'fill')).toHaveValue('#eff6ff');
  await expect(roleField(page, 'Inputs', 'size')).toHaveValue('');
  await expect(roleField(page, 'Calculations', 'fillNone')).toBeChecked();
  await expect(roleField(page, 'Headers', 'bold')).toBeChecked();
  await expect(roleField(page, 'Notes', 'size')).toHaveValue('9');
});

test('a file\'s own Excel roles are ignored: links, inputs and a rectangle\'s own bold follow the Excel style; its number format stays', async ({ page }) => {
  // The file's Links role is red and its Inputs fill orange; Revenue has its own bold and #,##0.0.
  await load(page, 'roles-workspace-edited.json', { inputs: true });
  const { wb, book, cells } = await periodCells(page, 'Revenue');
  for(const c of linkCells(wb, book)) expect(fontColorOf(c), `link ${c.address} font`).toBe('FF008000');
  const inputs = wb.Sheets['Inputs'], p1 = X.periodOneCol(inputs);
  const valueCells = X.cellAddrs(inputs).filter(a => X.splitAddr(a).col >= p1 && X.splitAddr(a).row > 3 && typeof inputs[a].v === 'number');
  expect(valueCells.length).toBeGreaterThan(0);
  for(const a of valueCells) expect(fillOf(book.getWorksheet('Inputs').getCell(a)), `Inputs!${a} fill`).toBe('FFEFF6FF');
  for(const { addr, cell } of cells){
    expect(!!(cell.font && cell.font.bold), `Revenue ${addr} bold (canvas only)`).toBe(false);
    expect(cell.numFmt, `Revenue ${addr} number format`).toBe('#,##0.0');
    expect(fillOf(cell), `Revenue ${addr} fill`).toBe(null);
  }
});

test('"keep colours" and border sides from an older file no longer reach Excel', async ({ page }) => {
  await load(page, 'roles-workspace-keepcolours.json');
  const kept = await periodCells(page, 'Revenue');
  for(const { addr, cell } of kept.cells) expect(fillOf(cell), `Revenue ${addr} fill`).toBe(null);

  await load(page, 'roles-workspace-sides.json');
  const { wb, book, cells } = await periodCells(page, 'Revenue');
  for(const { addr, cell } of cells) expect(sidesOf(cell), `Revenue ${addr} border sides`).toEqual([]);
  for(const c of typedCells(wb, book)) expect(sidesOf(c), `${c.address} border sides`).toEqual(['top', 'bottom', 'left', 'right']);
});

test('fmIDE\'s number formats reach Excel: a rectangle\'s own, else its role\'s; its canvas look does not', async ({ page }) => {
  // Inputs role: number, 1 decimal. Revenue: its own currency, 2 decimals, bold and a fill.
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('formats', 'sys-v6-excel-settings.json'));
  await X.setInputsTab(page, false);
  const { wb, book, cells } = await periodCells(page, 'Revenue');
  for(const { addr, cell } of cells){
    expect(cell.numFmt, `Revenue ${addr}`).toBe('"$"#,##0.00');
    expect(!!(cell.font && cell.font.bold), `Revenue ${addr} bold`).toBe(false);
    expect(fillOf(cell), `Revenue ${addr} fill`).toBe(null);
  }
  for(const c of typedCells(wb, book)){
    expect(c.numFmt, `${c.address} number format`).toBe('#,##0.0');
    expect(fillOf(c), `${c.address} fill`).toBe('FFEFF6FF');
    expect(sidesOf(c), `${c.address} border sides`).toEqual(['top', 'bottom', 'left', 'right']);
  }
});

test('editing the Excel style: the workbook follows, and the style is kept after a reload for every model', async ({ page }) => {
  await load(page, 'roles-workspace-edited.json', { inputs: true });
  await roleField(page, 'Links', 'fontColor').fill('#dc2626');
  await expect(roleField(page, 'Links', 'fontAuto')).not.toBeChecked();
  for(const side of ['top', 'left', 'right']) await roleField(page, 'Inputs', 'side-' + side).uncheck();
  await roleField(page, 'Inputs', 'size').fill('12');
  await roleField(page, 'Inputs', 'size').dispatchEvent('change');
  await roleField(page, 'Calculations', 'bold').check();

  const check = async () => {
    const { wb, book, cells } = await periodCells(page, 'Revenue');
    for(const c of linkCells(wb, book)) expect(fontColorOf(c), `link ${c.address} font`).toBe('FFDC2626');
    for(const c of typedCells(wb, book)){
      expect(sidesOf(c), `${c.address} border sides`).toEqual(['bottom']);
      expect(c.font && c.font.size, `${c.address} size`).toBe(12);
    }
    for(const { addr, cell } of cells) expect(cell.font && cell.font.bold, `Revenue ${addr} bold`).toBe(true);
  };
  await check();
  await expect.poll(async () => (await S.storedKeys(page, 'ExcelExporter', 'fmide-excel-style')).length).toBe(1);

  // Another model, after a reload: the same style.
  await page.reload();
  await X.loadFixtureModel(page, 'roles-workspace-keepcolours.json');
  await expect(roleField(page, 'Links', 'fontColor')).toHaveValue('#dc2626');
  await X.loadFixtureModel(page, 'roles-workspace-edited.json');
  await X.setInputsTab(page, true);
  await check();
});

test('Export Excel Style, Reset to Defaults, then Import brings it back', async ({ page }, testInfo) => {
  await load(page, 'roles-workspace-defaults.json');
  await roleField(page, 'Headers', 'fill').fill('#fde68a');
  await roleField(page, 'Notes', 'fontAuto').check();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportStyle')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.kind).toBe('fmIDE-excel-style');
  expect(exported.version).toBe(1);
  expect(Object.keys(exported.roles)).toEqual(ROLES);
  expect(exported.roles.Headers.fill).toBe('#fde68a');
  expect(exported.roles.Notes.font.color).toBe(null);

  await page.click('#btnResetStyle');
  await expect(page.locator('#confirmModal')).toBeVisible();
  await page.click('#confirmOk');
  await expect(page.locator('#excelStyleStatus .status')).toHaveText('Excel style reset to the defaults.');
  await expect(roleField(page, 'Headers', 'fill')).toHaveValue('#f1f5f9');
  await expect(roleField(page, 'Notes', 'fontColor')).toHaveValue('#94a3b8');

  const saved = testInfo.outputPath('style.json');
  fs.writeFileSync(saved, JSON.stringify(exported));
  await page.setInputFiles('#excelStyleFileInput', saved);
  await expect(page.locator('#excelStyleStatus .status')).toHaveText('Excel style imported.');
  await expect(roleField(page, 'Headers', 'fill')).toHaveValue('#fde68a');
  await expect(roleField(page, 'Notes', 'fontAuto')).toBeChecked();
});

test('an Excel style file with hostile or broken values is cleaned before it is used or kept', async ({ page }, testInfo) => {
  await load(page, 'roles-workspace-defaults.json');
  const evil = testInfo.outputPath('evil-style.json');
  fs.writeFileSync(evil, JSON.stringify({ kind: 'fmIDE-excel-style', version: 1, roles: {
    Inputs: { fill: 'red;background:url(https://example.com/x)', font: { color: '<img src=x onerror="window.__pwned=1">', weight: 'bold', size: 1e9 },
              border: { style: '<b>evil</b>', color: 'javascript:alert(1)', sides: ['top', '<b>', 'left'] } },
    Links: { font: { size: 'x' } },
    Evil: { fill: '#000000' }
  } }));
  await page.setInputFiles('#excelStyleFileInput', evil);
  await expect(page.locator('#excelStyleStatus .status')).toHaveText('Excel style imported.');
  expect(await page.locator('#excelStyleBody tr').evaluateAll(trs => trs.map(tr => tr.dataset.role))).toEqual(ROLES);
  await expect(roleField(page, 'Inputs', 'fillNone')).toBeChecked();
  await expect(roleField(page, 'Inputs', 'fontAuto')).toBeChecked();
  await expect(roleField(page, 'Inputs', 'bold')).toBeChecked();
  await expect(roleField(page, 'Inputs', 'size')).toHaveValue('72');
  await expect(roleField(page, 'Inputs', 'borderStyle')).toHaveValue('solid');
  await expect(roleField(page, 'Inputs', 'borderColor')).toHaveValue('#93c5fd');
  await expect(roleField(page, 'Inputs', 'side-top')).toBeChecked();
  await expect(roleField(page, 'Inputs', 'side-bottom')).not.toBeChecked();
  await expect(roleField(page, 'Links', 'size')).toHaveValue('');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();

  const stored = Object.values(await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-style')).map(t => JSON.parse(t));
  expect(stored).toHaveLength(1);
  expect(Object.keys(stored[0].roles)).toEqual(ROLES);
  expect(JSON.stringify(stored[0])).not.toMatch(/<|javascript|url\(|red;/);
  expect(stored[0].roles.Inputs.font.size).toBe(72);

  // The workbook writes the cleaned style.
  const { wb, book } = await X.generate(page).then(async r => ({ wb: r.wb, book: await X.readBack(r.bytes) }));
  for(const c of typedCells(wb, book)){
    expect(fillOf(c)).toBe(null);
    expect(c.font && c.font.size).toBe(72);
    expect(sidesOf(c)).toEqual(['top', 'left']);
  }
});

test('a row that only pulls a value from another sheet through a plug is a Link, not a Calculation', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('agreement', 'stale-plug-links.json'));
  await X.setInputsTab(page, false);
  const { cells } = await periodCells(page, 'Total income');
  for(const { addr, cell } of cells){
    // Written without brackets (it was =(Sales!E7)), so it reads as a plain link.
    expect(cell.formula || '', `Total income ${addr}`).toMatch(/^'?Sales'?!\$?[A-Z]+\$?\d+$/);
    expect(fontColorOf(cell), `Total income ${addr} font`).toBe('FF008000');
  }
});
