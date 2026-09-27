// 4. Format roles: the legend, and role formatting as it lands in the real .xlsx file.
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');

const ROLES = ['Inputs', 'Calculations', 'Links', 'Headers', 'Section Headers', 'Labels', 'Notes'];

async function load(page, model, { inputs = false } = {}){
  await X.openExporter(page);
  await X.loadFixtureModel(page, model);
  await X.setInputsTab(page, inputs);
}

async function legend(page){
  const chips = page.locator('#rolesLegend .role-chip');
  return chips.evaluateAll(els => els.map(e => ({
    name: e.firstChild ? e.firstChild.textContent : '',
    isDefault: !!e.querySelector('.role-default'),
  })));
}

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
const fillOf = (c) => (c.fill && c.fill.type === 'pattern' && c.fill.pattern === 'solid' && c.fill.fgColor) ? c.fill.fgColor.argb : null;
const fontColorOf = (c) => (c.font && c.font.color && c.font.color.argb) || null;
const sidesOf = (c) => ['top', 'bottom', 'left', 'right'].filter(k => c.border && c.border[k] && c.border[k].style);

test('defaults: the legend shows 7 roles, none marked default', async ({ page }) => {
  await load(page, 'roles-workspace-defaults.json');
  const chips = await legend(page);
  expect(chips.map(c => c.name)).toEqual(ROLES);
  expect(chips.filter(c => c.isDefault).map(c => c.name)).toEqual([]);
});

test('an older file with no role presets shows all 7 roles as default', async ({ page }) => {
  await load(page, 'revenue-bs-corkscrew.json');
  const chips = await legend(page);
  expect(chips.map(c => c.name)).toEqual(ROLES);
  expect(chips.filter(c => c.isDefault).map(c => c.name)).toEqual(ROLES);
});

test('edited roles: red links, Inputs fill, Revenue keeps its own weight and number format', async ({ page }) => {
  await load(page, 'roles-workspace-edited.json', { inputs: true });
  const { wb, book, cells } = await periodCells(page, 'Revenue');

  // Link rows (sheet-qualified links to the Inputs tab) have a red font.
  const links = [];
  for(const name of wb.SheetNames.filter(n => n !== 'Inputs')){
    const ws = wb.Sheets[name];
    X.cellAddrs(ws).filter(a => /Inputs'?!/.test(X.formulaOf(ws[a]) || '')).forEach(a => links.push(book.getWorksheet(name).getCell(a)));
  }
  expect(links.length).toBeGreaterThan(0);
  for(const c of links) expect(fontColorOf(c), `link ${c.address} font`).toBe('FFDC2626');

  // Inputs-tab value cells have the Inputs fill.
  const inputs = wb.Sheets['Inputs'], p1 = X.periodOneCol(inputs);
  const valueCells = X.cellAddrs(inputs).filter(a => X.splitAddr(a).col >= p1 && X.splitAddr(a).row > 3 && typeof inputs[a].v === 'number');
  expect(valueCells.length).toBeGreaterThan(0);
  for(const a of valueCells) expect(fillOf(book.getWorksheet('Inputs').getCell(a)), `Inputs!${a} fill`).toBe('FFFFF7ED');

  // Revenue: own bold + number format, but Calculations colours (no fill).
  for(const { addr, cell } of cells){
    expect(cell.font && cell.font.bold, `Revenue ${addr} bold`).toBe(true);
    expect(cell.numFmt, `Revenue ${addr} number format`).toBe('#,##0.0');
    expect(fillOf(cell), `Revenue ${addr} fill`).toBe(null);
  }
});

test('keepcolours: Revenue keeps its own fill', async ({ page }) => {
  await load(page, 'roles-workspace-keepcolours.json');
  const { cells } = await periodCells(page, 'Revenue');
  for(const { addr, cell } of cells) expect(fillOf(cell), `Revenue ${addr} fill`).toBe('FFFDE68A');
});

test('sides: Revenue has only a bottom border; inputs without saved sides get all four', async ({ page }) => {
  await load(page, 'roles-workspace-sides.json');
  const { wb, book, cells } = await periodCells(page, 'Revenue');
  for(const { addr, cell } of cells) expect(sidesOf(cell), `Revenue ${addr} border sides`).toEqual(['bottom']);
  // Input rows: numbers typed on the sheet (not formulas).
  let inputCells = 0;
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name], p1 = X.periodOneCol(ws);
    X.cellAddrs(ws).filter(a => X.splitAddr(a).row > 3 && X.splitAddr(a).col >= p1 && typeof ws[a].v === 'number' && !X.formulaOf(ws[a])).forEach(a => {
      inputCells++;
      expect(sidesOf(book.getWorksheet(name).getCell(a)), `${name}!${a} border sides`).toEqual(['top', 'bottom', 'left', 'right']);
    });
  }
  expect(inputCells).toBeGreaterThan(0);
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
