// 77. fmGraph's scenarios in ExcelExporter (step 19, phase B2; docs/step19-fmgraph-in-excel.md).
// - fmIDE's model for ExcelExporter carries the document's graphBoards; a .fmide opened in
//   ExcelExporter itself does too. Layout → Use fmGraph boards… and File → Import fmGraph boards…
//   (or a board file dropped) open the window: the boards, the scenarios with tick boxes, what
//   can't be carried and why.
// - ExcelExporter's own reader: kind and version (1–8; a newer one and the template form refused),
//   names as text, numbers forced, rectangles matched by canvas id, node id and name (capitals and
//   outer spaces ignored), the rest left out and counted; version 1–2 files carry no scenarios.
// - Use copies them into the layout (cfg.graph, mapping file 4), turning the Inputs tab on, and
//   asks before replacing cases. At Generate: Global Case 1 "Base", a case per scenario named after
//   it; each moved input's row scenarios (1 = fmIDE's numbers, one per different setting, shared
//   when alike); set values in their periods, a shift a live formula on scenario 1; the matrix.
// - LibreOffice: picking each Global Case gives fmGraph's own numbers for that scenario.
// - Cut-offs (50 cases, 20 row scenarios) listed; the workbook doesn't follow the board file
//   once copied.
const fs = require('fs');
const { test, expect, fixture, readFixture, openApp } = require('./helpers/apps');
const X = require('./helpers/excel');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');
const { requireSoffice, recalc, recalcDataTables, valueOf } = require('./helpers/soffice');

const board = (name) => fixture('graph-boards', name);
const genStatus = (page) => page.locator('#genStatus .status');
const scenarioNames = (page) => page.locator('#graphScenarioList .graph-scn-name').allTextContents();
const leftOut = (page) => page.locator('#graphLeftOut li').allTextContents();

async function openProfit(page){
  await X.openExporter(page);
  await X.loadModelFile(page, board('profit.fmide'));
  await expect(page.locator('#loadStatus .status.ok')).toContainText('It has fmGraph boards');
}
async function useBoards(page){
  await X.menuCommand(page, 'btnUseGraphBoards');
  await expect(page.locator('#graphModal')).toBeVisible();
}
// File → Import fmGraph boards…, answered with `file`.
async function importFile(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), X.menuCommand(page, 'btnImportGraphBoards')]);
  await chooser.setFiles(file);
}
// The Inputs tab's block of row scenarios for an input: { first, n, own } (rows), found from its own row.
function scenarioBlock(ws, label, n){
  const own = X.findRow(ws, label)[0];
  return { first: own - n, n, own };
}
function cellAt(ws, col, row){ return ws[X.numToCol(col) + row]; }

test('a .fmide with boards: the window, Use, and the cases, row scenarios and matrix written', async ({ page, pageErrors }) => {
  await openProfit(page);
  await useBoards(page);
  await expect(page.locator('#graphSource')).toHaveText('The boards that came with the model');
  expect(await page.locator('#graphBoardPick option').allTextContents()).toEqual(['Profit board', 'Second board']);
  expect(await scenarioNames(page)).toEqual(['High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']);
  await expect(page.locator('#graphScenarioList .graph-scn-what').nth(2)).toHaveText('Price 12 (2028–2029), Volume -5% (2030)');
  expect(await leftOut(page)).toEqual(['The Inputs tab will be turned on: the scenarios move inputs there.']);
  await page.click('#graphUse');
  await expect(page.locator('#graphModal')).toBeHidden();
  await expect(genStatus(page)).toHaveText('fmGraph scenarios used: 6 Global Cases (Base and 5), 3 inputs with scenarios. The Inputs tab is on.');
  await expect(page.locator('#cfgInputsEnabled')).toBeChecked();
  await expect(page.locator('#cfgInputsCases')).toHaveValue('6');
  await expect(page.locator('#cfgInputsCases')).toBeDisabled();

  const { wb } = await X.generate(page);
  expect(wb.SheetNames[0]).toBe('Scenarios');
  const sc = wb.Sheets.Scenarios;
  // Row 3: the case names; D2 the case run, Base; C2 = 1.
  expect(['H3', 'I3', 'J3', 'K3', 'L3', 'M3'].map(a => sc[a].v)).toEqual(['Base', 'High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']);
  expect(sc.N3).toBeUndefined();
  expect(sc.C2.v).toBe(1);
  expect(sc.D2.v).toBe('Base');
  // The matrix: each case's row scenario per input (Also high shares High price's).
  const matrix = (label) => { const r = X.findRow(sc, label)[0]; return ['H', 'I', 'J', 'K', 'L', 'M'].map(c => sc[c + r].v); };
  expect(matrix('Price')).toEqual([1, 2, 1, 3, 2, 1]);
  expect(matrix('Volume')).toEqual([1, 1, 2, 3, 1, 1]);
  expect(matrix('Cost')).toEqual([1, 1, 1, 1, 1, 2]);
  // The Inputs tab's row scenarios.
  const inp = wb.Sheets.Inputs;
  const p1 = X.periodOneCol(inp);
  const price = scenarioBlock(inp, 'Price', 3);
  expect([0, 1, 2].map(k => inp['A' + (price.first + k)].v)).toEqual(['Scenario 1', 'High price', 'Mixed']);
  expect([0, 1, 2, 3].map(p => cellAt(inp, p1 + p, price.first).v)).toEqual([10, 10, 10, 10]);
  expect([0, 1, 2, 3].map(p => cellAt(inp, p1 + p, price.first + 1).v)).toEqual([13, 13, 13, 13]);
  const s1 = (p) => X.numToCol(p1 + p) + price.first;
  // Mixed: 12 in 2028–2029, the other periods scenario 1.
  expect([0, 1, 2, 3].map(p => X.formulaOf(cellAt(inp, p1 + p, price.first + 2)) || cellAt(inp, p1 + p, price.first + 2).v))
    .toEqual([s1(0), 12, 12, s1(3)]);
  const volume = scenarioBlock(inp, 'Volume', 3);
  const v1 = (p) => X.numToCol(p1 + p) + volume.first;
  expect([0, 1, 2, 3].map(p => X.formulaOf(cellAt(inp, p1 + p, volume.first + 1)))).toEqual([0, 1, 2, 3].map(p => v1(p) + '*(1+10%)'));
  expect([0, 1, 2, 3].map(p => X.formulaOf(cellAt(inp, p1 + p, volume.first + 2)))).toEqual([v1(0), v1(1), v1(2), v1(3) + '*(1-5%)']);
  const cost = scenarioBlock(inp, 'Cost', 2);
  expect(inp['A' + (cost.first + 1)].v).toBe('Cost cut');
  expect(cellAt(inp, p1, cost.first + 1).v).toBe(-2500);
  expect(X.formulaOf(cellAt(inp, p1 + 1, cost.first + 1))).toBe(X.numToCol(p1 + 1) + cost.first);
  // The input's own row still picks its scenario (column C links to the Scenarios tab).
  expect(X.formulaOf(cellAt(inp, p1, price.own))).toMatch(/^INDEX\(/);
  // Exported, the layout is version 4 and carries the copy.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(5); // 5 since step 19 B3 (several analyses)
  expect(exported.cfg.graph.board).toBe('Profit board');
  expect(exported.cfg.graph.from).toEqual(['Profit board', 'Second board']);
  expect(exported.cfg.graph.scenarios.map(s => s.name)).toEqual(['High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']);
  expect(exported.cfg.graph.scenarios[2].settings).toEqual([
    { row: 'cProfit|price', name: 'Price', mode: 'set', periods: { mode: 'range', from: 1, to: 2 }, value: 12 },
    { row: 'cProfit|volume', name: 'Volume', mode: 'shift', periods: { mode: 'one', p: 3 }, value: -5 }]);
  expect(pageErrors).toEqual([]);
});

test('LibreOffice: each Global Case gives fmGraph\'s numbers for its scenario', async ({ page, context }) => {
  requireSoffice(test);
  // fmGraph's own numbers, on the same file.
  const graph = await context.newPage();
  await openApp(graph, 'fmGraph');
  await graph.waitForFunction(() => !!window.fmGraph);
  await graph.evaluate((t) => fmGraph.load(t, 'Profit'), fs.readFileSync(board('profit.fmide'), 'utf8'));
  await graph.waitForFunction(() => fmGraph.scenarios().length === 5);
  const outputs = ['Revenue', 'Profit', 'Bonus paid'];
  const read = () => graph.evaluate((outs) => outs.map(o => [1, 2, 3, 4].map(p => fmGraph.value(o, p))), outputs);
  await graph.evaluate(() => fmGraph.resetAll());
  const want = { Base: await read() };
  for(const name of ['High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']){
    expect(await graph.evaluate((n) => fmGraph.showScenario(n), name)).toBe(0); // every setting has its slider
    want[name] = await read();
  }
  expect(want['High price'][1]).not.toEqual(want.Base[1]);

  await openProfit(page);
  await useBoards(page);
  await page.click('#graphUse');
  const { wb, bytes } = await X.generate(page);
  const files = { c1: bytes };
  for(let k = 2; k <= 6; k++){
    const copy = JSON.parse(JSON.stringify(wb));
    copy.Sheets.Scenarios.C2.v = k;
    files['c' + k] = await X.writeWithApp(page, copy);
  }
  const out = recalc(files);
  const names = ['Base', 'High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut'];
  for(let k = 1; k <= 6; k++){
    const book = await X.readBack(out['c' + k]);
    const ws = book.getWorksheet('Profit');
    expect(valueOf(book.getWorksheet('Scenarios').getCell('D2'))).toBe(names[k - 1]);
    const p1 = X.periodOneCol(wb.Sheets.Profit);
    const got = outputs.map(o => {
      const r = X.findRow(wb.Sheets.Profit, o)[0];
      return [0, 1, 2, 3].map(p => valueOf(ws.getCell(r, p1 + p)));
    });
    got.forEach((row, i) => row.forEach((v, p) => {
      const w = want[names[k - 1]][i][p];
      if(Math.abs(v - w) > 1e-6 * Math.max(1, Math.abs(w))) throw new Error(`${names[k - 1]}: ${outputs[i]} in period ${p + 1} is ${v}, fmGraph says ${w}`);
    }));
  }
});

test('someone else\'s board file: names as text, numbers forced, the rest left out and counted', async ({ page, pageErrors }) => {
  await page.addInitScript(() => { window.alert = () => { window.__alerted = true; }; });
  await openProfit(page);
  await importFile(page, board('strangers.board.json'));
  await expect(page.locator('#graphModal')).toBeVisible();
  await expect(page.locator('#graphSource')).toHaveText('From “strangers.board.json”');
  expect(await page.locator('#graphBoardPick option').allTextContents()).toEqual(['<img src=x onerror=alert(1)>']);
  expect(await page.locator('#graphModal img').count()).toBe(0);
  // Unique names (capitals and outer spaces ignored): the second "high price" and the empty name go.
  expect(await scenarioNames(page)).toEqual(['<b>Bold</b> & co', '=HYPERLINK("http://example.com","x")', 'Strangers', 'high price']);
  expect(await page.locator('#graphScenarioList b').count()).toBe(0);
  // "  VOLUME " is Volume; "450" is a number.
  await expect(page.locator('#graphScenarioList .graph-scn-what').nth(1)).toHaveText('VOLUME 450');
  // A period the model doesn't have reads as all.
  await expect(page.locator('#graphScenarioList .graph-scn-what').nth(2)).toHaveText('Price 9');
  expect(await leftOut(page)).toEqual([
    '2 settings on a rectangle this model doesn\'t have (Not price, Nope).',
    '1 on an input inside a block, which every copy of the block shares.',
    '1 on a rectangle that isn\'t an input.',
    '3 settings not readable.',
    '3 scenarios without a name of its own, or past 50.',
    'The Inputs tab will be turned on: the scenarios move inputs there.']);
  await page.click('#graphUse');
  const { wb } = await X.generate(page);
  const sc = wb.Sheets.Scenarios;
  expect(['H3', 'I3', 'J3', 'K3', 'L3'].map(a => sc[a].v)).toEqual(['Base', '<b>Bold</b> & co', '=HYPERLINK("http://example.com","x")', 'Strangers', 'high price']);
  expect(sc.J3.t).toBe('s');
  expect(sc.J3.f).toBeUndefined();
  const inp = wb.Sheets.Inputs;
  const vol = scenarioBlock(inp, 'Volume', 2);
  expect(cellAt(inp, X.periodOneCol(inp), vol.first + 1).v).toBe(450);
  // The written file holds the names as text, escaped.
  const { bytes } = await X.generate(page);
  const parts = await X.unzip(bytes);
  const shared = parts['xl/sharedStrings.xml'] || '';
  const sheetXml = Object.entries(parts).filter(([n]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).map(([, t]) => t).join('');
  expect(shared + sheetXml).toContain('&lt;b&gt;Bold&lt;/b&gt; &amp; co');
  expect(shared + sheetXml).not.toContain('<b>Bold');
  expect(await page.evaluate(() => !!window.__alerted)).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('board versions: 2 has no scenarios, 3 and 8 read, a newer one and the template form are refused', async ({ page }) => {
  await openProfit(page);
  await importFile(page, board('board-v2.board.json'));
  await expect(page.locator('#graphModal')).toBeVisible();
  expect(await scenarioNames(page)).toEqual([]);
  await expect(page.locator('#graphNoScenarios')).toBeVisible();
  await expect(page.locator('#graphUse')).toBeDisabled();
  await page.click('#graphCancel');
  await importFile(page, board('board-v3.board.json'));
  expect(await scenarioNames(page)).toEqual(['Price 14']);
  await page.click('#graphCancel');
  await importFile(page, board('board-newer.board.json')); // version 8 (step 18's), read
  expect(await scenarioNames(page)).toEqual(['Price 14']);
  await page.click('#graphCancel');
  await importFile(page, board('board-newer-v9.board.json'));
  await expect(genStatus(page)).toHaveClass(/err/);
  await expect(genStatus(page)).toContainText('format version 9; this ExcelExporter reads up to version 8');
  await expect(page.locator('#graphModal')).toBeHidden();
  await importFile(page, board('board-template.board.json'));
  await expect(genStatus(page)).toContainText('is for a template');
  await importFile(page, fixture('formats', 'sys-current.json'));
  await expect(genStatus(page)).toContainText('not an fmGraph boards file');
});

test('asks before replacing cases; Remove takes them out; a dropped board file opens the window; the copy is the layout\'s', async ({ page }, testInfo) => {
  await openProfit(page);
  // A board file dropped (through the model input, as a drop): the window, for the model shown.
  await X.loadModelFile(page, board('board-v3.board.json'));
  await expect(page.locator('#graphModal')).toBeVisible();
  await page.click('#graphUse');
  await expect(genStatus(page)).toContainText('2 Global Cases (Base and 1), 1 input with scenarios');
  // Used again: asked first; Cancel keeps the copy.
  await useBoards(page);
  await page.click('#graphUse');
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmMessage')).toContainText('already has fmGraph scenarios');
  await page.click('#confirmCancel');
  await expect(genStatus(page)).toHaveText('fmGraph scenarios not used.');
  let wb = (await X.generate(page)).wb;
  expect(wb.Sheets.Scenarios.I3.v).toBe('Price 14');
  // A scenario ticked off is not brought.
  await useBoards(page);
  await page.locator('#graphScenarioList input[type=checkbox]').nth(1).uncheck();
  await page.click('#graphUse');
  await page.click('#confirmOk');
  await expect(genStatus(page)).toContainText('5 Global Cases (Base and 4)');
  wb = (await X.generate(page)).wb;
  expect(['H3', 'I3', 'J3', 'K3', 'L3'].map(a => wb.Sheets.Scenarios[a].v)).toEqual(['Base', 'High price', 'Mixed', 'Also high', 'Cost cut']);
  await useBoards(page);
  await page.click('#graphRemove');
  await page.click('#confirmOk');
  await expect(genStatus(page)).toHaveText('fmGraph scenarios removed from this layout.');
  await expect(page.locator('#cfgInputsCases')).toBeEnabled();
  wb = (await X.generate(page)).wb;
  expect(wb.Sheets.Scenarios).toBeUndefined();
  // An input with scenarios of its own: asked too, and it keeps them, on scenario 1 in every case.
  const own = page.locator('#rowGroupsTree .tree-row', { has: page.locator('.scn-ctl') }).filter({ hasText: 'Cost' });
  await own.locator('.scn-ctl input[type=checkbox]').check();
  await importFile(page, board('board-v3.board.json'));
  await page.click('#graphUse');
  await expect(page.locator('#confirmMessage')).toContainText('inputs with scenarios of your own keep them, on scenario 1 in every case');
  await page.click('#confirmOk');
  wb = (await X.generate(page)).wb;
  const sc = wb.Sheets.Scenarios;
  const r = X.findRow(sc, 'Cost')[0];
  expect([sc['H' + r].v, sc['I' + r].v]).toEqual([1, 1]);
  expect(sc['E' + r].v).toBe(3);
  await expect(own.locator('.scn-ctl input[type=checkbox]')).toBeEnabled();
  const price = page.locator('#rowGroupsTree .tree-row', { has: page.locator('.scn-ctl') }).filter({ hasText: 'Price' });
  await expect(price.locator('.scn-ctl input[type=checkbox]')).toBeDisabled();
});

test('cut-offs: past 49 scenarios and past 20 row scenarios are listed, in the window and after Generate', async ({ page }, testInfo) => {
  await openProfit(page);
  const f = readFixture('graph-boards', 'profit.board.json');
  const at = { canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' } };
  f.scenarios = Array.from({ length: 50 }, (_, i) => ({ name: 'S' + (i + 1), sliders: [Object.assign({ value: 100 + i }, at)] }));
  await importFile(page, D.tempFile(testInfo, 'many.board.json', JSON.stringify(f)));
  const lines = await leftOut(page);
  expect(lines).toContain('Scenarios after the 49th are not written: S50.');
  expect(lines).toContain('“Price” needs 50 row scenarios; S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49 use its scenario 1 in Excel.');
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveClass(/warn/);
  const { wb } = await X.generate(page);
  await expect(genStatus(page)).toContainText('Scenarios after the 49th are not written: S50.');
  const sc = wb.Sheets.Scenarios;
  const r = X.findRow(sc, 'Price')[0];
  expect(sc['E' + r].v).toBe(20);
  const caseCols = Array.from({ length: 50 }, (_, i) => X.numToCol(8 + i));
  expect(sc[caseCols[49] + '3'].v).toBe('S49');
  expect(sc[X.numToCol(58) + '3']).toBeUndefined();
  expect(caseCols.map(c => sc[c + r].v)).toEqual([1].concat(Array.from({ length: 19 }, (_, i) => i + 2), Array.from({ length: 30 }, () => 1)));
});

test('fmIDE sends the document\'s boards to ExcelExporter with the model', async ({ page }, testInfo) => {
  page.on('dialog', d => d.accept());
  await F.openFmIDE(page);
  const text = fs.readFileSync(board('profit.fmide'), 'utf8');
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Profit.fmide', text));
  await expect.poll(() => D.title(page)).toBe('Profit — fmIDE');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
  await popup.waitForLoadState();
  await expect(popup.locator('#afterLoad')).toBeVisible();
  await expect(popup.locator('#loadStatus .status.ok')).toContainText('It has fmGraph boards');
  await X.menuCommand(popup, 'btnUseGraphBoards');
  await expect(popup.locator('#graphModal')).toBeVisible();
  expect(await scenarioNames(popup)).toEqual(['High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']);
});

test('a model without boards says where to find them; the menu items need a model', async ({ page }) => {
  await X.openExporter(page);
  await expect(page.locator('#btnUseGraphBoards')).toHaveAttribute('role', 'menuitem');
  await expect(page.locator('#btnImportGraphBoards')).toHaveAttribute('role', 'menuitem');
  await expect(page.locator('#btnUseGraphBoards')).toBeDisabled();
  await expect(page.locator('#btnImportGraphBoards')).toBeDisabled();
  // A board file before a model: open the model first.
  await X.loadModelFile(page, board('board-v3.board.json'));
  await expect(page.locator('#loadStatus .status.err')).toContainText('open its model first');
  await X.loadFixtureModel(page, 'scenario-unit-price-volume.json');
  await X.menuCommand(page, 'btnUseGraphBoards');
  await expect(genStatus(page)).toContainText('This model came without fmGraph boards');
});

// ---------- Step 19 B3: fmGraph's Tornado and Spider → sensitivity analyses ----------
// fmGraph makes the charts on the same model (its own window.fmGraph), exports the board, and
// ExcelExporter turns them into analyses; LibreOffice works each Data Table out to fmGraph's
// own Low and High figures.
const SENS_INPUTS = [
  { rect: 'Price', by: 'percent', low: -10, high: 20 },
  { rect: 'Volume', by: 'amount', low: -50, high: 50 },
  { rect: 'Cost', by: 'percent', low: -20, high: 20, show: false },
];
async function graphWithCharts(context){
  const graph = await context.newPage();
  await openApp(graph, 'fmGraph');
  await graph.waitForFunction(() => !!window.fmGraph);
  await graph.evaluate((t) => fmGraph.load(t, 'Profit'), fs.readFileSync(board('profit.fmide'), 'utf8'));
  await graph.waitForFunction(() => fmGraph.rectangles().length > 0);
  const ids = await graph.evaluate((inputs) => ({
    tornado: fmGraph.addChart({ layout: 'tornado', title: 'What moves Profit', output: 'Profit', period: 3, inputs }),
    spider: fmGraph.addChart({ layout: 'spider', title: 'Profit lines', output: 'Profit', period: 3, steps: 3, inputs }),
    revenue: fmGraph.addChart({ layout: 'tornado', title: 'Revenue', output: 'Revenue', period: 3, inputs: inputs.slice(0, 2) }),
  }), SENS_INPUTS);
  const file = await graph.evaluate(() => fmGraph.exportBoards(false)); // Export this board: its file, as written
  const figures = await graph.evaluate((id) => fmGraph.chart(id), ids.tornado);
  const revenue = await graph.evaluate((id) => fmGraph.chart(id), ids.revenue);
  return { graph, file, figures, revenue };
}

test('fmGraph\'s Tornado and Spider become analyses: grouped, named, Show 0, the Spider\'s points', async ({ page, context, pageErrors }, testInfo) => {
  const { file } = await graphWithCharts(context);
  expect(file.version).toBe(8);
  await openProfit(page);
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await expect(page.locator('#graphSensHead')).toBeVisible();
  expect(await page.locator('#graphSensList .graph-scn-name').allTextContents()).toEqual(['What moves Profit', 'Revenue']);
  expect(await page.locator('#graphSensList .graph-scn-what').allTextContents()).toEqual(['Tornado + Spider: Profit · 3 inputs · 2029', 'Tornado: Revenue · 2 inputs · 2029']);
  expect(await scenarioNames(page)).toEqual([]); // one board's file carries no scenarios
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 2 sensitivity analyses from its Tornado and Spider charts. The Inputs tab is on.');
  // The panel: the untouched default replaced by the two, marked as from fmGraph.
  expect(await page.locator('#sensPick option').allTextContents()).toEqual(['1. What moves Profit (fmGraph)', '2. Revenue (fmGraph)']);
  await expect(page.locator('#sensPick')).toHaveValue('0');
  await expect(page.locator('#cfgSensSteps')).toHaveValue('3');
  await expect(page.locator('#cfgSensPeriod')).toHaveValue('2'); // fmGraph's API counts periods from 1: its 3 is 2029
  const { wb } = await X.generate(page);
  expect(wb.SheetNames.filter(n => !['Inputs', 'Profit', 'Bonus', 'Bonus (instance 1)'].includes(n))).toEqual(['What moves Profit', 'What moves Profit Tornado', 'What moves Profit Spider', 'Revenue', 'Revenue Tornado', 'Revenue Spider']);
  const ws = wb.Sheets['What moves Profit'];
  expect(ws.C5.v).toBe(3); // the period, from 1
  const head = X.findRow(ws, 'Input variable', 'B')[0];
  expect([1, 2, 3].map(i => [ws['D' + (head + i)].v, ws['E' + (head + i)].v, ws['F' + (head + i)].v, ws['G' + (head + i)].v]))
    .toEqual([['%', -10, 20, 1], ['amount', -50, 50, 1], ['%', -20, 20, 0]]);
  expect(ws['T' + head].v).toBe(3); // 7 points: −3 … 3
  // Used again: asked first, fmGraph's analyses replaced, the person's own kept.
  await page.click('#btnSensAdd');
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await page.locator('#graphSensList input[type=checkbox]').nth(1).uncheck();
  await page.click('#graphUse');
  await expect(page.locator('#confirmMessage')).toHaveText('The sensitivity analyses made from fmGraph before are replaced; your own stay.');
  await page.click('#confirmOk');
  expect(await page.locator('#sensPick option').allTextContents()).toEqual(['1. Sensitivity 3', '2. What moves Profit (fmGraph)']);
  // Remove from Layout takes fmGraph's out, the person's stays.
  await X.menuCommand(page, 'btnUseGraphBoards');
  await page.click('#graphRemove');
  await page.click('#confirmOk');
  await expect(genStatus(page)).toHaveText('fmGraph scenarios and analyses removed from this layout.');
  expect(await page.locator('#sensPick option').allTextContents()).toEqual(['1. Sensitivity 3']);
  expect(pageErrors).toEqual([]);
});

test('LibreOffice: each analysis\'s Data Table gives fmGraph\'s own Tornado figures', async ({ page, context }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(180_000);
  const { file, figures, revenue } = await graphWithCharts(context);
  await openProfit(page);
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await page.click('#graphUse');
  const { bytes, wb } = await X.generate(page);
  const out = recalcDataTables({ wb: bytes }).wb;
  const book = await X.readBack(out);
  const check = (sheet, fig, points) => {
    const ws = book.getWorksheet(sheet);
    const head = X.findRow(wb.Sheets[sheet], 'Input variable', 'B')[0];
    fig.inputs.filter(i => i.show !== false).forEach(i => {
      const r = X.findRow(wb.Sheets[sheet], i.name, 'B').find(x => x > head && x <= head + 3);
      const low = valueOf(ws.getCell(r, 14)), high = valueOf(ws.getCell(r, 14 + points - 1));
      const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
      if(!near(low, i.lowValue) || !near(high, i.highValue)) throw new Error(`${sheet}: ${i.name} gives ${low} / ${high}, fmGraph ${i.lowValue} / ${i.highValue}`);
    });
    expect(valueOf(ws.getCell('C8'))).toBe(fig.base);
  };
  check('What moves Profit', figures, 7);
  check('Revenue', revenue, 11);
});

test('a board\'s Tornado and Spider from someone else: outputs and inputs the model hasn\'t got are left out and counted', async ({ page }, testInfo) => {
  await openProfit(page);
  const at = (nodeId, name, canvasId = 'cProfit') => ({ canvasId, nodeId, name });
  const f = { kind: 'fmIDE-graph-board', version: 8, boards: [{ name: 'Charts', sliders: [], items: [
    { type: 'chart', layout: 'tornado', title: '<b>Bold</b>', output: at('profit', 'Profit'), period: 99, steps: 'x', inputs: [
      Object.assign(at('price', 'Price'), { by: 'evil', low: 'abc', high: '5' }),
      Object.assign(at('rate', 'Bonus rate', 'cBonus'), { by: 'percent', low: -1, high: 1 }),
      Object.assign(at('revenue', 'Revenue'), { by: 'percent', low: -1, high: 1 }),
      Object.assign(at('nope', 'Nope'), { by: 'percent', low: -1, high: 1 }),
      'junk'] },
    { type: 'chart', layout: 'spider', title: 'Lost', output: at('nope', 'Nope'), inputs: [] },
    { type: 'chart', layout: 'tornado', title: 'No output', inputs: [] }] }] };
  await importFile(page, D.tempFile(testInfo, 'strangers-charts.board.json', JSON.stringify(f)));
  expect(await page.locator('#graphSensList .graph-scn-name').allTextContents()).toEqual(['<b>Bold</b>']);
  await expect(page.locator('#graphSensList b')).toHaveCount(0);
  expect(await page.locator('#graphSensList .graph-scn-what').allTextContents()).toEqual(['Tornado: Profit · 1 input · 2027']);
  expect(await leftOut(page)).toEqual([
    '2 Tornado or Spider charts whose output this model doesn\'t have.',
    '4 inputs of the Tornado and Spider charts left out (not in this model, inside a block, not an input, or not readable).',
    'The Inputs tab will be turned on: the scenarios move inputs there.']);
  await page.click('#graphUse');
  const { wb } = await X.generate(page);
  const ws = wb.Sheets['<b>Bold<'] || wb.Sheets[wb.SheetNames.find(n => n.startsWith('<b>Bold'))];
  const head = X.findRow(ws, 'Input variable', 'B')[0];
  // "evil" reads as percent, "abc" as the default −10, "5" as 5.
  expect([ws['D' + (head + 1)].v, ws['E' + (head + 1)].v, ws['F' + (head + 1)].v]).toEqual(['%', -10, 5]);
});
