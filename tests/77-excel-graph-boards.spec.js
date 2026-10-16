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
  await expect(genStatus(page)).toHaveText('fmGraph scenarios used: 6 Global Cases (Base and 5), 3 inputs with scenarios. Also 5 sliders on the Dashboard. The Inputs tab is on.');
  await expect(page.locator('#cfgInputsEnabled')).toBeChecked();
  await expect(page.locator('#cfgInputsCases')).toHaveValue('6');
  await expect(page.locator('#cfgInputsCases')).toBeDisabled();

  const { wb } = await X.generate(page);
  expect(wb.SheetNames.slice(0, 2)).toEqual(['Dashboard', 'Scenarios']); // the sliders' Dashboard first (B4)
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
  // The input's own row still picks its scenario (column C links to the Scenarios tab), with the
  // Dashboard's Price slider laid over it (step 19 B4).
  expect(X.formulaOf(cellAt(inp, p1, price.own))).toMatch(/^IF\('Dashboard'!\$I\$5=TRUE,'Dashboard'!\$G\$5,INDEX\(/);
  // Exported, the layout is version 7 (since step 19 B4) and carries the copy.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(7);
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
  // Its one slider (every version has sliders, B4); without it there is nothing to use.
  expect(await page.locator('#graphSliderList .graph-scn-name').allTextContents()).toEqual(['Price']);
  await expect(page.locator('#graphUse')).toBeEnabled();
  await page.locator('#graphSliderList input').uncheck();
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

// ---------- Step 19 B3b: fmGraph's Tornado and Spider → sensitivity analyses ----------
// fmGraph makes the charts on the same model (its own window.fmGraph), exports the board, and
// ExcelExporter turns them into analyses; LibreOffice works each Data Table out to fmGraph's
// own Low and High figures.
const analysisNames = (page) => page.locator('#sensAnalyses .sens-pick').allTextContents();
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
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 2 sensitivity analyses from its Tornado and Spider charts. 5 sliders on the Dashboard. The Inputs tab is on.');
  // The panel: the untouched default replaced by the two, marked as from fmGraph; the first picked.
  expect(await analysisNames(page)).toEqual(['What moves Profit', 'Revenue']);
  expect(await page.locator('#sensAnalyses .sens-state').allTextContents()).toEqual(['fmGraph', 'fmGraph']);
  await expect(page.locator('#sensAnalyses .sens-pick').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cfgSensSteps')).toHaveValue('3');
  await expect(page.locator('#cfgSensPeriod')).toHaveValue('2'); // fmGraph's API counts periods from 1: its 3 is 2029
  const { wb } = await X.generate(page);
  expect(wb.SheetNames.filter(n => !['Inputs', 'Profit', 'Bonus', 'Bonus (instance 1)'].includes(n))).toEqual(['Dashboard', 'What moves Profit', 'Tornado', 'Spider', 'Revenue', 'Tornado 2', 'Spider 2']);
  const ws = wb.Sheets['What moves Profit'];
  expect(ws.C5.v).toBe(3); // the period, from 1
  const head = X.findRow(ws, 'Input variable', 'B')[0];
  expect([1, 2, 3].map(i => [ws['D' + (head + i)].v, ws['E' + (head + i)].v, ws['F' + (head + i)].v, ws['G' + (head + i)].v]))
    .toEqual([['%', -10, 20, 1], ['amount', -50, 50, 1], ['%', -20, 20, 0]]);
  expect(ws['T' + head].v).toBe(3); // 7 points: −3 … 3
  // Kept with the layout: the mark and the hidden input travel in Export Mapping.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const sens = JSON.parse(fs.readFileSync(await download.path(), 'utf8')).cfg.sensitivities;
  expect(sens.map(a => [a.name, a.origin, a.steps, a.period, a.outputs.length])).toEqual([['What moves Profit', 'fmGraph', 3, 2, 1], ['Revenue', 'fmGraph', 5, 2, 1]]);
  expect(sens[0].variables.map(v => v.show)).toEqual([undefined, undefined, false]);
  // Used again: asked first, fmGraph's analyses replaced, the person's own kept.
  await page.click('#btnSensAdd');
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await page.locator('#graphSensList input[type=checkbox]').nth(1).uncheck();
  await page.click('#graphUse');
  await expect(page.locator('#confirmMessage')).toHaveText('The sensitivity analyses made from fmGraph before are replaced; your own stay. The Dashboard\'s sliders are replaced.');
  await page.click('#confirmOk');
  expect(await analysisNames(page)).toEqual(['Sensitivity 3', 'What moves Profit']);
  // Remove from Layout takes fmGraph's out, the person's stays.
  await X.menuCommand(page, 'btnUseGraphBoards');
  await page.click('#graphRemove');
  await page.click('#confirmOk');
  await expect(genStatus(page)).toHaveText('fmGraph scenarios and analyses removed from this layout.');
  expect(await analysisNames(page)).toEqual(['Sensitivity 3']);
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

// ---------- Sliders → the Dashboard (step 19, phase B4) ----------
const sliderNames = (page) => page.locator('#graphSliderList .graph-scn-name').allTextContents();
const sliderWhats = (page) => page.locator('#graphSliderList .graph-scn-what').allTextContents();
// The Dashboard's rows 5…: [name, periods, kind, position, value, use] each.
function dashboardRows(ws){
  const out = [];
  for(let r = 5; ws['A' + r]; r++){
    out.push([ws['A' + r].v, ws['B' + r].v, ws['C' + r].v, ws['E' + r].v, ws['G' + r].v, ws['I' + r] ? ws['I' + r].v : null]);
  }
  return out;
}

test('sliders: the window lists them, Use copies them, the Dashboard comes first and the Inputs tab lays them over the case', async ({ page, pageErrors }) => {
  await openProfit(page);
  await useBoards(page);
  expect(await sliderNames(page)).toEqual(['Price', 'Volume', 'Price', 'Volume', 'Cost']);
  expect(await sliderWhats(page)).toEqual(['set 5 to 15 by 0.5 · all periods', 'change by % -50 to 50 by 1 · all periods',
    'set 5 to 15 by 0.5 · 2028–2029', 'change by % -50 to 50 by 1 · 2030', 'set -5000 to 0 by 100 · 2027']);
  await page.click('#graphUse');
  await expect(genStatus(page)).toContainText('Also 5 sliders on the Dashboard.');

  const { wb, bytes } = await X.generate(page);
  await expect(page.locator('#differencesPanel')).toBeHidden(); // Use off and changes at 0: fmIDE's numbers
  // A sample for the owner's own Excel (Windows and iPhone), as for the writer at first.
  const out = require('path').join(__dirname, 'output');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(require('path').join(out, 'step19-b4-dashboard.xlsx'), bytes);

  expect(wb.SheetNames.slice(0, 3)).toEqual(['Dashboard', 'Scenarios', 'Inputs']);
  const d = wb.Sheets.Dashboard;
  expect(d.A2.v).toMatch(/^Scroll bars and check boxes don't show in Excel on the web, or always in LibreOffice/);
  expect(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L'].map(c => d[c + '4'].v))
    .toEqual(['Slider', 'Periods', 'Kind', 'Scroll bar', 'Position', 'Typed', 'Value', 'Use', 'Min', 'Max', 'Step']);
  // Set sliders start at fmIDE's number with Use off; a change by % at 0.
  expect(dashboardRows(d)).toEqual([
    ['Price', 'all periods', 'Set to', 10, 10, false],
    ['Volume', 'all periods', 'Change by %', 50, 0, null],
    ['Price', '2028–2029', 'Set to', 10, 10, false],
    ['Volume', '2030', 'Change by %', 50, 0, null],
    ['Cost', '2027', 'Set to', 20, -3000, false]]);
  expect(X.formulaOf(d.G5)).toBe('IF(ISNUMBER(F5),F5,MIN(K5,J5+E5*L5))');
  expect(['J', 'K', 'L'].map(c => d[c + '9'].v)).toEqual([-5000, 0, 100]);
  // The name links to the input's own row on the Inputs tab.
  const inp = wb.Sheets.Inputs;
  const priceOwn = X.findRow(inp, 'Price')[0];
  expect(X.formulaOf(d.A5)).toBe("'Inputs'!$A$" + priceOwn);
  // The form controls: a scroll bar per slider over column D, linked to Position; a Use check box per set slider.
  const controls = d['!controls'];
  expect(controls.filter(c => c.type === 'scroll').map(c => [c.cell, c.min, c.max, c.val, c.from.c, c.from.r]))
    .toEqual([['E5', 0, 20, 10, 3, 4], ['E6', 0, 100, 50, 3, 5], ['E7', 0, 20, 10, 3, 6], ['E8', 0, 100, 50, 3, 7], ['E9', 0, 50, 20, 3, 8]]);
  expect(controls.filter(c => c.type === 'check').map(c => [c.cell, c.checked, c.text])).toEqual([['I5', false, 'Use'], ['I7', false, 'Use'], ['I9', false, 'Use']]);
  const parts = await X.unzip(bytes);
  expect(Object.keys(parts).filter(n => /^xl\/ctrlProps\//.test(n))).toHaveLength(8);

  // The Inputs tab: each slider only in its periods, in the board's order, over the case's pick.
  const p1 = X.periodOneCol(inp);
  const own = (label, p) => X.formulaOf(cellAt(inp, p1 + p, X.findRow(inp, label)[0]));
  const pick = (label, p, n) => { const r = X.findRow(inp, label)[0]; const c = X.numToCol(p1 + p); return 'INDEX(' + c + (r - n) + ':' + c + (r - 1) + ',MIN(MAX($C' + r + ',1),' + n + '))'; };
  const set = (r, x) => "IF('Dashboard'!$I$" + r + "=TRUE,'Dashboard'!$G$" + r + ',' + x + ')';
  const shift = (r, x) => '(' + x + ")*(1+'Dashboard'!$G$" + r + '/100)';
  expect([0, 1, 2, 3].map(p => own('Price', p))).toEqual([set(5, pick('Price', 0, 3)), set(7, set(5, pick('Price', 1, 3))), set(7, set(5, pick('Price', 2, 3))), set(5, pick('Price', 3, 3))]);
  expect([0, 1, 2, 3].map(p => own('Volume', p))).toEqual([shift(6, pick('Volume', 0, 3)), shift(6, pick('Volume', 1, 3)), shift(6, pick('Volume', 2, 3)), shift(8, shift(6, pick('Volume', 3, 3)))]);
  // One period only: Cost's slider is in 2027, the other periods just pick the case.
  expect([0, 1, 2, 3].map(p => own('Cost', p))).toEqual([set(9, pick('Cost', 0, 2)), pick('Cost', 1, 2), pick('Cost', 2, 2), pick('Cost', 3, 2)]);
  expect(pageErrors).toEqual([]);
});

test('sliders, LibreOffice: numbers typed (or the scroll bars\' positions) and TRUE in Use give fmGraph\'s own numbers', async ({ page, context }) => {
  requireSoffice(test);
  // fmGraph's own numbers, with the same board's sliders set on the same file.
  const graph = await context.newPage();
  await openApp(graph, 'fmGraph');
  await graph.waitForFunction(() => !!window.fmGraph);
  await graph.evaluate((t) => fmGraph.load(t, 'Profit'), fs.readFileSync(board('profit.fmide'), 'utf8'));
  await graph.waitForFunction(() => fmGraph.scenarios().length === 5);
  await graph.evaluate(() => fmGraph.showBoard('Profit board'));
  const ids = await graph.evaluate(() => fmGraph.board().sliders.map(s => s.id));
  expect(ids).toHaveLength(5);
  const outputs = ['Revenue', 'Profit', 'Bonus paid'];
  const read = () => graph.evaluate((outs) => outs.map(o => [1, 2, 3, 4].map(p => fmGraph.value(o, p))), outputs);
  // Price 12 everywhere, Volume +10%, Price 13.5 in 2028–2029, Volume −5% in 2030, Cost −2000 in 2027.
  const moved = [12, 10, 13.5, -5, -2000];
  await graph.evaluate(() => fmGraph.resetAll());
  const base = await read();
  for(let i = 0; i < 5; i++) await graph.evaluate(([id, v]) => fmGraph.setSlider(id, v), [ids[i], moved[i]]);
  const want = await read();
  expect(want[1]).not.toEqual(base[1]);
  // With the Mixed scenario shown and Volume +10% on top.
  await graph.evaluate(() => fmGraph.resetAll());
  expect(await graph.evaluate(() => fmGraph.showScenario('Mixed'))).toBe(0);
  await graph.evaluate((id) => fmGraph.setSlider(id, 10), ids[1]);
  const wantMixed = await read();

  await openProfit(page);
  await useBoards(page);
  await page.click('#graphUse');
  const { wb } = await X.generate(page);
  const edited = (fn) => { const c = JSON.parse(JSON.stringify(wb)); fn(c.Sheets.Dashboard, c.Sheets.Scenarios); return X.writeWithApp(page, c); };
  const num = (v) => ({ t: 'n', v });
  const on = { t: 'b', v: true };
  const files = {
    // Typed numbers, and TRUE in Use.
    typed: await edited(d => { ['F5', 'F6', 'F7', 'F8', 'F9'].forEach((a, i) => { d[a] = num(moved[i]); }); d.I5 = on; d.I7 = on; d.I9 = on; }),
    // The scroll bars' positions instead (as the scroll bars would leave them).
    positions: await edited(d => { [14, 60, 17, 45, 30].forEach((v, i) => { d['E' + (5 + i)] = num(v); }); d.I5 = on; d.I7 = on; d.I9 = on; }),
    // Numbers typed but Use off, and the changes by % at 0: fmIDE's numbers.
    useOff: await edited(d => { d.F5 = num(12); d.F7 = num(13.5); d.F9 = num(-2000); d.F6 = num(0); d.F8 = num(0); }),
    // A Global Case and a slider together: Mixed, and Volume +10%.
    mixed: await edited((d, sc) => { sc.C2 = num(4); d.F6 = num(10); }),
  };
  const out = recalc(files);
  const p1 = X.periodOneCol(wb.Sheets.Profit);
  const check = async (name, expected) => {
    const book = await X.readBack(out[name]);
    const ws = book.getWorksheet('Profit');
    outputs.forEach((o, i) => {
      const r = X.findRow(wb.Sheets.Profit, o)[0];
      [0, 1, 2, 3].forEach(p => {
        const v = valueOf(ws.getCell(r, p1 + p)), w = expected[i][p];
        if(Math.abs(v - w) > 1e-6 * Math.max(1, Math.abs(w))) throw new Error(`${name}: ${o} in period ${p + 1} is ${v}, fmGraph says ${w}`);
      });
    });
  };
  await check('typed', want);
  await check('positions', want);
  await check('useOff', base);
  await check('mixed', wantMixed);
});

test('sliders from someone else: like ones once, a range that isn\'t one, past 30,000 steps, 0 out of reach, the rest counted', async ({ page, pageErrors }) => {
  await page.addInitScript(() => { window.alert = () => { window.__alerted = true; }; });
  await openProfit(page);
  await importFile(page, board('sliders-edges.board.json'));
  await expect(page.locator('#graphModal')).toBeVisible();
  // Price twice on one board (the name's capitals and spaces aside) and Volume on both boards: once each.
  expect(await sliderNames(page)).toEqual(['Price', 'Volume', 'Cost']);
  expect(await sliderWhats(page)).toEqual([
    'set 0 to 100000 by 1 · all periods · more than 30,000 steps: the step grows to 3.33333333333',
    'change by % 5 to 50 by 5 · all periods · can\'t be 0 on its steps: starts at 5%',
    'set -5000 to -1000 by 100 · 2028']); // no range in the file: 20 steps either side of fmIDE's number
  expect(await leftOut(page)).toEqual(['3 sliders left out (not in this model, inside a block, not an input, or not readable).',
    'The Inputs tab will be turned on: the scenarios move inputs there.']);
  await page.click('#graphUse');
  await expect(genStatus(page)).toContainText('3 sliders on the Dashboard.');
  await expect(genStatus(page)).toContainText('“Price” has more than 30,000 steps: its step grows to 3.33333333333.');
  await expect(genStatus(page)).toContainText('“Volume” (change by %) can\'t be 0 on its steps: it starts at 5%.');
  const { wb } = await X.generate(page);
  await expect(genStatus(page)).toContainText('“Price” has more than 30,000 steps');
  const d = wb.Sheets.Dashboard;
  expect(dashboardRows(d)).toEqual([
    ['Price', 'all periods', 'Set to', 3, 9.99999999999, false], // 3 grown steps: the nearest to fmIDE's 10
    ['Volume', 'all periods', 'Change by %', 0, 5, null],
    ['Cost', '2028', 'Set to', 20, -3000, false]]);
  expect(['J', 'K', 'L'].map(c => d[c + '5'].v)).toEqual([0, 100000, 3.33333333333]);
  expect(d['!controls'].find(c => c.cell === 'E5').max).toBe(30000);
  expect(await page.evaluate(() => window.__alerted)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('sliders: the copy is the layout\'s, using again asks first, Remove takes them out', async ({ page }) => {
  await openProfit(page);
  await importFile(page, board('profit.board.json'));
  await page.locator('#graphScenarioList input').evaluateAll(list => list.forEach(c => { c.checked = false; }));
  await page.locator('#graphScenarioList').dispatchEvent('change');
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 5 sliders on the Dashboard. The Inputs tab is on.');
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(7);
  expect(exported.cfg.graph.sliders).toEqual([
    { row: 'cProfit|price', name: 'Price', mode: 'set', periods: { mode: 'all' }, min: 5, max: 15, step: 0.5 },
    { row: 'cProfit|volume', name: 'Volume', mode: 'shift', periods: { mode: 'all' }, min: -50, max: 50, step: 1 },
    { row: 'cProfit|price', name: 'Price', mode: 'set', periods: { mode: 'range', from: 1, to: 2 }, min: 5, max: 15, step: 0.5 },
    { row: 'cProfit|volume', name: 'Volume', mode: 'shift', periods: { mode: 'one', p: 3 }, min: -50, max: 50, step: 1 },
    { row: 'cProfit|cost', name: 'Cost', mode: 'set', periods: { mode: 'one', p: 0 }, min: -5000, max: 0, step: 100 }]);
  // Without scenarios the moved inputs get a base row, and no Scenarios tab is written.
  let { wb } = await X.generate(page);
  expect(wb.SheetNames.slice(0, 2)).toEqual(['Dashboard', 'Inputs']);
  const inp = wb.Sheets.Inputs;
  const own = X.findRow(inp, 'Cost')[0];
  expect(inp['A' + (own - 1)].v).toBe('Base (before sliders)');
  const c1 = X.numToCol(X.periodOneCol(inp));
  expect(X.formulaOf(inp[c1 + own])).toBe("IF('Dashboard'!$I$9=TRUE,'Dashboard'!$G$9," + c1 + (own - 1) + ')');
  // Using the boards again asks before replacing the sliders.
  await importFile(page, board('profit.board.json'));
  await page.click('#graphUse');
  await expect(page.locator('#confirmMessage')).toContainText('The Dashboard\'s sliders are replaced.');
  await page.click('#confirmCancel');
  // Remove from Layout takes them out: no Dashboard.
  await useBoards(page);
  await expect(page.locator('#graphRemove')).toBeVisible();
  await page.click('#graphRemove');
  await expect(page.locator('#confirmMessage')).toContainText('and the Dashboard\'s sliders');
  await page.click('#confirmOk');
  ({ wb } = await X.generate(page));
  expect(wb.SheetNames).not.toContain('Dashboard');
});
