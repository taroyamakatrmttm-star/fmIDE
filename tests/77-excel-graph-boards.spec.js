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
  await expect(genStatus(page)).toHaveText('fmGraph scenarios used: 6 Global Cases (Base and 5), 3 inputs with scenarios. Also 5 sliders on the Dashboard. 1 chart on the Dashboard. The Inputs tab is on.'); // the board's bar too (B5)
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
  expect(exported.version).toBe(8);
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
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 2 sensitivity analyses from its Tornado and Spider charts. 5 sliders on the Dashboard. 1 chart on the Dashboard. The Inputs tab is on.');
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
  await expect(page.locator('#confirmMessage')).toHaveText('The sensitivity analyses made from fmGraph before are replaced; your own stay. The Dashboard\'s sliders are replaced. The Dashboard\'s charts are replaced.');
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
  expect(d.A2.v).toMatch(/^Scroll bars and check boxes don't show in Excel on the web, on an iPad or iPhone, or always in LibreOffice/);
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
  await page.locator('#graphChartList input').evaluateAll(list => list.forEach(c => { c.checked = false; }));
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 5 sliders on the Dashboard. The Inputs tab is on.');
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(8);
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

// ---------- Bars and charts → the Dashboard's charts (step 19 B5) ----------
// fmGraph itself makes the charts on the Profit board (which already has a bar of Profit) and
// exports the board; a colour, a scale and a title with markup are added to the file as a person's
// fmGraph would write them. fmGraph's own figures for the waterfall come with it.
const chartNames = (page) => page.locator('#graphChartList .graph-scn-name').allTextContents();
const chartWhats = (page) => page.locator('#graphChartList .graph-scn-what').allTextContents();
const WALK = [{ rect: 'Revenue', role: 'start' }, { rect: 'Cost', role: 'add' }, { rect: 'Bonus paid', role: 'subtract' }, { rect: 'Profit', role: 'total' }];
async function graphWithBoardCharts(context){
  const graph = await context.newPage();
  await openApp(graph, 'fmGraph');
  await graph.waitForFunction(() => !!window.fmGraph);
  await graph.evaluate((t) => fmGraph.load(t, 'Profit'), fs.readFileSync(board('profit.fmide'), 'utf8'));
  await graph.waitForFunction(() => fmGraph.scenarios().length === 5);
  await graph.evaluate(() => fmGraph.showBoard('Profit board'));
  const ids = await graph.evaluate((walk) => ({
    io: fmGraph.addChart({ layout: 'columns', title: 'In and out', groups: [{ name: 'In', parts: ['Revenue'] }, { name: 'Out', parts: ['Cost', 'Bonus paid'] }] }),
    parts: fmGraph.addChart({ layout: 'columns', title: '', periods: [2, 3], groups: [{ name: '', parts: ['Revenue', 'Cost'] }] }),
    walk: fmGraph.addChart({ layout: 'flow', title: 'Profit walk', period: 4, steps: walk }),
    cases: fmGraph.addChart({ layout: 'scenarios', title: 'Cases', period: 4, outputs: ['Profit'] }),
  }), WALK);
  const file = await graph.evaluate(() => fmGraph.exportBoards(false));
  const items = file.boards[0].items;
  items[0].scale = { min: 0, max: 5000 };
  items[0].colour = '#0F766E';
  items[1].groups[0].parts[0].colour = '#2563eb';
  items[3].steps[1].colour = '#7C3AED';
  items[3].title = 'Profit <walk> & "more"';
  const flow = await graph.evaluate((id) => fmGraph.chart(id), ids.walk);
  return { graph, ids, file, flow };
}
// A chart's data table on the Dashboard sits beside the charts: its title in column N on a row of
// its own, the names on the next row, labels in N and figures from O (since the B5 tidy-up).
const FIG = (k) => X.numToCol(15 + k); // the k-th figure column: O, P, …
// The Dashboard's helper block of a flow: { top (its title's row), head (the names' row), rows: { name: [cells O…] } }.
function flowBlock(ws, heading, n){
  const top = X.findRow(ws, heading, 'N')[0];
  const head = top + 1;
  expect(ws['N' + head].v).toBe('Step');
  const rows = {};
  ['Value', 'From', 'To', 'Above 0', 'Below 0', 'Base (hidden)', 'Total above 0', 'Total below 0', 'Rise above 0', 'Rise below 0', 'Fall above 0', 'Fall below 0']
    .forEach((name, i) => { expect(ws['N' + (head + 1 + i)].v).toBe(name); rows[name] = Array.from({ length: n }, (_, k) => ws[FIG(k) + (head + 1 + i)]); });
  return { top, head, rows };
}
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

test('charts: the window lists the board\'s bars and charts, Use copies them, the Dashboard draws each from the right rows', async ({ page, context, pageErrors }, testInfo) => {
  const { graph, file, flow } = await graphWithBoardCharts(context);
  await openProfit(page);
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await expect(page.locator('#graphChartHead')).toBeVisible();
  expect(await chartNames(page)).toEqual(['Profit', 'In and out', 'Revenue, Cost', 'Profit <walk> & "more"']);
  expect(await chartWhats(page)).toEqual(['Bar · all periods', 'Stacked columns · all periods · 3 parts · wide',
    'Stacked columns · 2028–2029 · 2 parts · wide', 'Waterfall · 2030 · 4 steps · wide']);
  expect(await leftOut(page)).toContain('1 scenario waterfall not carried: Excel would need every case worked out at once.');
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 5 sliders on the Dashboard. 4 charts on the Dashboard. The Inputs tab is on.');

  const { wb, bytes } = await X.generate(page);
  await expect(page.locator('#differencesPanel')).toBeHidden();
  // The sample for the owner's own Excel (Windows and iPad): the Dashboard's controls and charts.
  const out = require('path').join(__dirname, 'output');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(require('path').join(out, 'step19-b5-dashboard.xlsx'), bytes);

  const d = wb.Sheets.Dashboard, pr = wb.Sheets.Profit;
  const charts = d['!charts'];
  expect(charts).toHaveLength(4);
  // Under the sliders (rows 5–9): the narrow bar alone (a wide chart follows it), then each wide chart, the full width.
  expect(charts.map(c => [c.from.c, c.to.c])).toEqual([[0, 4], [0, 12], [0, 12], [0, 12]]);
  expect(charts[0].from.r).toBe(10);
  charts.slice(1).forEach((c, i) => expect(c.from.r).toBeGreaterThanOrEqual(charts[i].to.r)); // in the board's order, none over another
  const p1 = X.periodOneCol(pr), col = (p) => X.numToCol(p1 + p);
  const row = (label) => X.findRow(pr, label).filter(r => r > 3)[0]; // not the tab's title
  const fmIDE = (rect, p) => graph.evaluate(([r, q]) => fmGraph.modelValue(r, q), [rect, p + 1]);
  // The bar: a column chart of Profit's own row over every period, its colour and fixed scale.
  const bar = charts[0].chart;
  expect([bar.title, bar.bar.grouping, bar.legend, bar.valAxis.min, bar.valAxis.max]).toEqual(['Profit', 'clustered', null, 0, 5000]);
  expect(bar.series).toHaveLength(1);
  expect(bar.series[0].color).toBe('0F766E');
  expect(bar.series[0].val.ref).toBe("'Profit'!$" + col(0) + '$' + row('Profit') + ':$' + col(3) + '$' + row('Profit'));
  expect(bar.series[0].cat.ref).toBe("'Profit'!$" + col(0) + '$2:$' + col(3) + '$2');
  expect(bar.series[0].cat.values).toEqual(['2027', '2028', '2029', '2030']);
  for(let p = 0; p < 4; p++) expect(near(bar.series[0].val.values[p], await fmIDE('Profit', p))).toBe(true); // what Excel shows before recalculating
  // One group: stacked columns straight from the parts' rows, in 2028–2029 only.
  const parts = charts[2].chart;
  expect([parts.title, parts.bar.grouping, parts.legend]).toEqual(['Revenue, Cost', 'stacked', 'b']);
  expect(parts.series.map(s => [s.name.text, s.val.ref])).toEqual([
    ['Revenue', "'Profit'!$" + col(1) + '$' + row('Revenue') + ':$' + col(2) + '$' + row('Revenue')],
    ['Cost', "'Profit'!$" + col(1) + '$' + row('Cost') + ':$' + col(2) + '$' + row('Cost')]]);
  expect(parts.series[1].val.values).toEqual([-3000, -3000]);
  // Several groups: a table under the chart, one column per period and group, each part only in its group's.
  const io = charts[1].chart;
  // Beside its chart (from the chart's first row), its title on a row of its own, then the names.
  const ioTop = X.findRow(d, 'Chart data: In and out', 'N')[0], ioHead = ioTop + 1;
  expect(ioTop).toBe(charts[1].from.r + 1);
  expect(['O', 'P', 'Q', 'V'].map(c => d[c + ioTop])).toEqual([undefined, undefined, undefined, undefined]); // nothing beside the title
  expect(d['N' + ioHead].v).toBe('Part');
  expect(['O', 'P', 'Q', 'V'].map(c => d[c + ioHead].v)).toEqual(['2027 · In', '2027 · Out', '2028 · In', '2030 · Out']);
  expect(io.series.map(s => [s.name.text, s.val.ref, s.color])).toEqual([
    ['Revenue', "'Dashboard'!$O$" + (ioHead + 1) + ':$V$' + (ioHead + 1), '2563EB'],
    ['Cost', "'Dashboard'!$O$" + (ioHead + 2) + ':$V$' + (ioHead + 2), undefined],
    ['Bonus paid', "'Dashboard'!$O$" + (ioHead + 3) + ':$V$' + (ioHead + 3), undefined]]);
  expect(io.series[0].cat.ref).toBe("'Dashboard'!$O$" + ioHead + ':$V$' + ioHead);
  expect(d['N' + (ioHead + 1)].v).toBe('Revenue');
  expect(X.formulaOf(d['O' + (ioHead + 1)])).toBe("'Profit'!$" + col(0) + '$' + row('Revenue'));
  expect(d['P' + (ioHead + 1)]).toBeUndefined(); // Revenue isn't in Out
  expect(X.formulaOf(d['R' + (ioHead + 2)])).toBe("'Profit'!$" + col(1) + '$' + row('Cost'));
  // The tables' columns have their own widths, not the sliders' (a gap in M, labels in N, figures from O).
  expect(d['!cols'].slice(12, 16).map(c => c.wch)).toEqual([3, 24, 13, 13]);
  expect(d['!cols'].length).toBeGreaterThanOrEqual(22); // to V, the widest table's last column
  expect(io.series[1].val.values).toEqual([null, -3000, null, -3000, null, -3000, null, -3000]);
  // The waterfall: helper rows under it, formulas on the steps' rows in 2030, starting on fmGraph's own figures.
  const walk = charts[3].chart;
  expect(walk.title).toBe('Profit <walk> & "more"');
  const fb = flowBlock(d, 'Chart data: Profit <walk> & "more" (2030)', 4);
  expect(fb.top).toBe(charts[3].from.r + 1); // beside its chart
  expect(['O', 'P', 'Q', 'R'].map(c => d[c + fb.head].v)).toEqual(['Revenue', 'Cost', 'Bonus paid', 'Profit']);
  expect(fb.rows.Value.map(X.formulaOf)).toEqual(['Revenue', 'Cost', 'Bonus paid', 'Profit'].map(r => "'Profit'!$" + col(3) + '$' + row(r)));
  const at = (name, k) => FIG(k) + (fb.head + 1 + ['Value', 'From', 'To'].indexOf(name));
  expect(fb.rows.From.map(c => X.formulaOf(c) || c.v)).toEqual([0, at('To', 0), at('To', 1), 0]);
  expect(fb.rows.To.map(X.formulaOf)).toEqual([at('Value', 0), at('From', 1) + '+' + at('Value', 1), at('From', 2) + '-' + at('Value', 2), at('Value', 3)]);
  flow.forEach((f, k) => {
    expect(near(fb.rows.Value[k].v, f.value)).toBe(true);
    expect(near(fb.rows.From[k].v, f.from)).toBe(true);
    expect(near(fb.rows.To[k].v, f.to)).toBe(true);
  });
  // The series: the invisible base, then Total, Rise and Fall above and below 0 (the second of each without a legend entry).
  expect(walk.series.map(s => [s.name.text, !!s.noFill, !!s.noLegend, s.color || null])).toEqual([
    ['Base', true, false, null], ['Total', false, false, '64748B'], ['Total', false, true, '64748B'],
    ['Rise', false, false, '16A34A'], ['Rise', false, true, '16A34A'], ['Fall', false, false, 'DC2626'], ['Fall', false, true, 'DC2626']]);
  expect(walk.series[0].val.ref).toBe("'Dashboard'!$O$" + (fb.head + 6) + ':$R$' + (fb.head + 6));
  expect(walk.series[0].cat.ref).toBe("'Dashboard'!$O$" + fb.head + ':$R$' + fb.head);
  expect(walk.series[3].points).toEqual([{ idx: 1, color: '7C3AED' }]); // Cost's own colour, on its bar
  // What Excel draws before recalculating adds up to fmGraph's bars: base + the parts reach From and To.
  flow.forEach((f, k) => {
    const sum = (side) => walk.series.slice(1).filter((s, i) => (i % 2 === 0) === (side === 'above')).reduce((t, s) => t + s.val.values[k], 0);
    const base = walk.series[0].val.values[k];
    const [lo, hi] = [Math.min(f.from, f.to), Math.max(f.from, f.to)];
    expect(near(base + sum('above') + sum('below'), lo >= 0 ? hi : hi <= 0 ? lo : hi + lo)).toBe(true);
  });
  // The parts written: Excel's bar chart parts.
  const zipped = await X.unzip(bytes);
  expect(Object.keys(zipped).filter(n => /^xl\/charts\/chart\d+\.xml$/.test(n))).toHaveLength(4);
  // The copy: the layout's, version 8.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(8);
  expect(exported.cfg.graph.charts[0]).toEqual({ kind: 'bar', title: '', wide: false, scale: { min: 0, max: 5000 }, periods: { mode: 'all' },
    parts: [{ row: 'cProfit|profit', name: 'Profit', colour: '#0f766e' }] });
  expect(exported.cfg.graph.charts[3].parts.map(x => [x.row, x.role, x.colour || null])).toEqual([
    ['cProfit|revenue', 'start', null], ['cProfit|cost', 'add', '#7c3aed'], ['cProfit|bonus', 'subtract', null], ['cProfit|profit', 'total', null]]);
  expect(exported.cfg.graph.charts[1].groups).toEqual(['In', 'Out']);
  expect(pageErrors).toEqual([]);
});

test('charts, LibreOffice: the waterfall\'s helper rows follow the sliders as fmGraph\'s own figures do, across 0', async ({ page, context }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(180_000);
  const { graph, ids, file, flow } = await graphWithBoardCharts(context);
  // Price 5 everywhere: revenue below the costs, so the running total goes below 0.
  const priceAll = await graph.evaluate(() => fmGraph.board().sliders[0].id);
  await graph.evaluate((id) => fmGraph.setSlider(id, 5), priceAll);
  const low = await graph.evaluate((id) => fmGraph.chart(id), ids.walk);
  expect(low.some(f => f.to < 0)).toBe(true);
  await openProfit(page);
  await importFile(page, D.tempFile(testInfo, 'charts.board.json', JSON.stringify(file)));
  await page.click('#graphUse');
  const { wb } = await X.generate(page);
  const edited = (fn) => { const c = JSON.parse(JSON.stringify(wb)); fn(c.Sheets.Dashboard); return X.writeWithApp(page, c); };
  const out = recalc({ base: await edited(() => {}), low: await edited(d => { d.F5 = { t: 'n', v: 5 }; d.I5 = { t: 'b', v: true }; }) });
  const heading = 'Chart data: Profit <walk> & "more" (2030)';
  const head = X.findRow(wb.Sheets.Dashboard, heading, 'N')[0] + 1; // the names' row, under the title
  const check = async (name, want) => {
    const ws = (await X.readBack(out[name])).getWorksheet('Dashboard');
    // ExcelJS reads a formula whose result is 0 as one with no result: 0 (an error still reads as its text).
    const v = (r, k) => { const x = valueOf(ws.getCell(head + 1 + r, 15 + k)); return x === undefined ? 0 : x; };
    want.forEach((f, k) => {
      [['value', 0], ['from', 1], ['to', 2]].forEach(([key, r]) => {
        if(!near(v(r, k), f[key])) throw new Error(`${name}: step ${k + 1}'s ${key} is ${v(r, k)}, fmGraph says ${f[key]}`);
      });
      // Excel's stack: base, then above and below 0, as fmGraph draws the bar from From to To.
      const lo = Math.min(f.from, f.to), hi = Math.max(f.from, f.to);
      const [base, above, below] = [5, 3, 4].map(r => v(r, k));
      const want = lo >= 0 ? [lo, hi - lo, 0] : hi <= 0 ? [hi, 0, lo - hi] : [0, hi, lo];
      if(![base, above, below].every((x, i) => near(x, want[i]))) throw new Error(`${name}: step ${k + 1} stacks ${[base, above, below]}, fmGraph's bar wants ${want}`);
      const shown = [6, 7, 8, 9, 10, 11].map(r => v(r, k));
      const kind = k === 0 || k === 3 ? 0 : f.to >= f.from ? 1 : 2;
      expect(shown.map((x, i) => Math.floor(i / 2) === kind ? null : x).filter(x => x !== null).every(x => x === 0)).toBe(true);
      expect(near(shown[kind * 2], above) && near(shown[kind * 2 + 1], below)).toBe(true);
    });
  };
  await check('base', flow);
  await check('low', low);
});

test('charts from someone else: names as text, colours and scales checked, roles read, the rest left out and counted', async ({ page, pageErrors }, testInfo) => {
  await page.addInitScript(() => { window.alert = () => { window.__alerted = true; }; });
  const rect = (nodeId, name, extra) => Object.assign({ canvasId: 'cProfit', nodeId, name }, extra || {});
  const strange = { kind: 'fmIDE-graph-board', version: 8, boards: [{ name: '<img src=x onerror=alert(1)>', sliders: [], items: [
    rect('profit', ' PROFIT ', { type: 'bar', colour: 'red', scale: { min: 10, max: 5 }, wide: 'yes' }),
    rect('nope', 'Nope', { type: 'bar' }),
    { type: 'chart', layout: 'flow', title: '<b>' + 'x'.repeat(100), period: 99, wide: false, scale: { min: '0', max: 10 },
      steps: [rect('revenue', 'Revenue', { role: 'start', colour: '#12345' }), rect('cost', 'Cost', { role: 'weird' }), 'junk', rect('ghost', 'Ghost')] },
    { type: 'chart', layout: 'columns', title: 'Groups', groups: Array.from({ length: 14 }, (_, i) => ({ name: 'G' + i, parts: [rect('revenue', 'Revenue', { colour: '#ABCDEF' })] })) },
    { type: 'chart', layout: 'mystery', title: 'Unknown', groups: [{ name: 'A', parts: [rect('cost', 'Cost')] }] },
    { type: 'chart', layout: 'scenarios', title: 'Cases' }, { type: 'chart', layout: 'flow', title: 'Empty', steps: [rect('ghost', 'Ghost')] }, null, 7] }] };
  await openProfit(page);
  await importFile(page, D.tempFile(testInfo, 'strange.board.json', JSON.stringify(strange)));
  await expect(page.locator('#graphModal')).toBeVisible();
  const title = '<b>' + 'x'.repeat(77);
  expect(await chartNames(page)).toEqual(['PROFIT', title, 'Groups', 'Unknown']); // the file's name, as text
  expect(await chartWhats(page)).toEqual(['Bar · all periods', 'Waterfall · 2027 · 2 steps', 'Stacked columns · all periods · 12 parts · wide', 'Stacked columns · all periods · 1 part · wide']);
  const left = await leftOut(page);
  expect(left).toContain('1 scenario waterfall not carried: Excel would need every case worked out at once.');
  expect(left).toContain('6 rectangles of the bars and charts left out (not in this model, inside a block, or not readable).');
  expect(left).toContain('2 bars or charts with nothing of this model to show.');
  await page.locator('#graphScenarioList input, #graphSliderList input, #graphSensList input').evaluateAll(list => list.forEach(c => { c.checked = false; }));
  await page.click('#graphUse');
  await expect(genStatus(page)).toContainText('4 charts on the Dashboard.');
  const { wb } = await X.generate(page);
  const d = wb.Sheets.Dashboard;
  expect(d.A2).toBeUndefined(); // no sliders: no note on the controls, the charts from row 3
  expect(d['!controls']).toBeUndefined();
  const charts = d['!charts'].map(c => c.chart);
  expect(charts[0].series[0].color).toBeUndefined(); // 'red' is not a colour of the format
  expect(charts[0].valAxis.min).toBeUndefined();     // min above max: Auto
  expect(charts[1].title).toBe(title);
  expect(charts[1].valAxis.min).toBeUndefined();     // text is not a number
  expect(d['!charts'][0].to.c).toBe(4); expect(d['!charts'][1].from.c).toBe(4); // two narrow charts side by side
  expect(charts[1].series[3].points).toEqual([]);    // '#12345' dropped
  expect(charts[2].series).toHaveLength(12);         // at most 12 groups
  expect(charts[2].series[0].color).toBe('ABCDEF');
  // Cost's unknown role reads as add.
  const fb = flowBlock(d, 'Chart data: ' + title + ' (2027)', 2);
  expect(X.formulaOf(fb.rows.To[1])).toMatch(/^P\d+\+P\d+$/);
  expect(await page.evaluate(() => window.__alerted)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('charts: using the boards again asks first, Remove takes them out, a row left out of the workbook is said', async ({ page }, testInfo) => {
  await openProfit(page);
  await importFile(page, board('profit.board.json'));
  await page.locator('#graphScenarioList input, #graphSliderList input').evaluateAll(list => list.forEach(c => { c.checked = false; }));
  await page.locator('#graphScenarioList').dispatchEvent('change');
  await page.click('#graphUse');
  await expect(genStatus(page)).toHaveText('fmGraph boards used: 1 chart on the Dashboard. The Inputs tab is on.');
  let { wb } = await X.generate(page);
  expect(wb.SheetNames[0]).toBe('Dashboard'); // charts alone make a Dashboard
  // Profit left out of the workbook: the chart isn't written, and Generate says why.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const layout = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  layout.rows.find(r => r.id === 'cProfit|profit').include = false;
  await page.setInputFiles('#mappingFileInput', D.tempFile(testInfo, 'without-profit.json', JSON.stringify(layout)));
  await expect(genStatus(page)).toHaveText('Mapping imported.');
  ({ wb } = await X.generate(page));
  expect(wb.SheetNames).not.toContain('Dashboard');
  await expect(genStatus(page)).toContainText('Not in the Dashboard\'s charts (left out of the workbook, or a constant): Profit.');
  layout.rows.find(r => r.id === 'cProfit|profit').include = true;
  await page.setInputFiles('#mappingFileInput', D.tempFile(testInfo, 'with-profit.json', JSON.stringify(layout)));
  await expect(genStatus(page)).toHaveText('Mapping imported.');
  await importFile(page, board('profit.board.json'));
  await page.click('#graphUse');
  await expect(page.locator('#confirmMessage')).toContainText('The Dashboard\'s charts are replaced.');
  await page.click('#confirmCancel');
  await useBoards(page);
  await page.click('#graphRemove');
  await expect(page.locator('#confirmMessage')).toContainText('and the Dashboard\'s charts');
  await page.click('#confirmOk');
  ({ wb } = await X.generate(page));
  expect(wb.SheetNames).not.toContain('Dashboard');
});

// ---------- From fmIDE to the Dashboard, end to end (step 19 B5) ----------
// fmIDE opens a model without boards; in fmGraph, opened from fmIDE, a person adds a slider,
// saves a scenario, and adds a Tornado and a waterfall — the board goes back to fmIDE's document.
// ExcelExporter, opened from fmIDE, uses the boards; LibreOffice recalculates the workbook, which
// agrees with fmGraph: a number typed on the Dashboard, the scenario's Global Case, the waterfall's
// helper rows and the Tornado's Data Table.
test('end to end: fmIDE → fmGraph (slider, scenario, Tornado, waterfall) → ExcelExporter → LibreOffice agrees with fmGraph', async ({ page }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(240_000);
  page.on('dialog', d => d.accept());
  await F.openFmIDE(page);
  const doc = JSON.parse(fs.readFileSync(board('profit.fmide'), 'utf8'));
  delete doc.graphBoards;
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, 'Plan.fmide', JSON.stringify(doc)));
  await expect.poll(() => D.title(page)).toBe('Plan — fmIDE');
  // fmGraph, from fmIDE.
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0 && fmGraph.boards().length > 0);
  const ids = await graph.evaluate((walk) => {
    const slider = fmGraph.addSlider('Price', { mode: 'set', min: 5, max: 15, step: 0.5 });
    fmGraph.setSlider(slider, 13);
    fmGraph.saveScenario('High price');
    fmGraph.resetAll();
    return { slider,
      tornado: fmGraph.addChart({ layout: 'tornado', title: 'What moves Profit', output: 'Profit', period: 4,
        inputs: [{ rect: 'Price', by: 'percent', low: -10, high: 10 }, { rect: 'Volume', by: 'amount', low: -50, high: 50 }] }),
      walk: fmGraph.addChart({ layout: 'flow', title: 'Profit walk', period: 4, steps: walk }) };
  }, WALK);
  // The board goes back to fmIDE's document.
  await expect.poll(() => D.title(page)).toBe('Plan • — fmIDE');
  await expect.poll(async () => {
    const data = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
    const b = data.graphBoards && data.graphBoards.boards.find(x => x.items.some(i => i.layout === 'flow'));
    return b && data.graphBoards.scenarios ? [b.sliders.some(s => s.name === 'Price' && s.min === 5), b.items.map(i => i.layout || i.type), data.graphBoards.scenarios.map(s => s.name)] : null;
  }).toEqual([true, expect.arrayContaining(['tornado', 'flow']), ['High price']]); // with what fmGraph's first board starts with
  // fmGraph's own numbers: Price 12 on the slider; the High price scenario; the Tornado; the waterfall.
  const outputs = ['Revenue', 'Profit'];
  const read = () => graph.evaluate((outs) => outs.map(o => [1, 2, 3, 4].map(p => fmGraph.value(o, p))), outputs);
  await graph.evaluate((id) => fmGraph.setSlider(id, 12), ids.slider);
  const want12 = await read();
  const walk12 = await graph.evaluate((id) => fmGraph.chart(id), ids.walk);
  await graph.evaluate(() => fmGraph.resetAll());
  const tornado = await graph.evaluate((id) => fmGraph.chart(id), ids.tornado);
  expect(await graph.evaluate(() => fmGraph.showScenario('High price'))).toBe(0);
  const wantHigh = await read();
  await graph.evaluate(() => fmGraph.resetAll());

  // ExcelExporter, from fmIDE: Use fmGraph boards…, then Generate.
  const [excel] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
  await excel.waitForLoadState();
  await expect(excel.locator('#loadStatus .status.ok')).toContainText('It has fmGraph boards');
  await X.menuCommand(excel, 'btnUseGraphBoards');
  await expect(excel.locator('#graphModal')).toBeVisible();
  const flowBoard = await excel.locator('#graphBoardPick option').allTextContents();
  const pickIndex = await graph.evaluate(() => fmGraph.boards().findIndex(b => b.name === fmGraph.board().name));
  await excel.selectOption('#graphBoardPick', String(pickIndex));
  expect(flowBoard.length).toBeGreaterThan(0);
  expect(await scenarioNames(excel)).toEqual(['High price']);
  expect(await sliderNames(excel)).toContain('Price');
  expect(await chartNames(excel)).toContain('Profit walk');
  expect(await excel.locator('#graphSensList .graph-scn-name').allTextContents()).toEqual(['What moves Profit']);
  await excel.click('#graphUse');
  await expect(genStatus(excel)).toContainText('fmGraph scenarios used: 2 Global Cases (Base and 1)');
  const { wb, bytes } = await X.generate(excel);
  expect(wb.SheetNames.slice(0, 3)).toEqual(['Dashboard', 'Scenarios', 'Inputs']);
  await expect(excel.locator('#differencesPanel')).toBeHidden();

  // The Price slider's row on the Dashboard (set, every period); the board's other sliders stay as they open.
  const priceRow = X.findRow(wb.Sheets.Dashboard, 'Price').find(r => r >= 5 && wb.Sheets.Dashboard['C' + r].v === 'Set to' && wb.Sheets.Dashboard['B' + r].v === 'all periods');
  expect(priceRow).toBeGreaterThanOrEqual(5);
  const edited = (fn) => { const c = JSON.parse(JSON.stringify(wb)); fn(c.Sheets.Dashboard, c.Sheets.Scenarios); return X.writeWithApp(excel, c); };
  const out = recalc({
    typed: await edited(d => { d['F' + priceRow] = { t: 'n', v: 12 }; d['I' + priceRow] = { t: 'b', v: true }; }),
    high: await edited((d, sc) => { sc.C2 = { t: 'n', v: 2 }; }),
  });
  const p1 = X.periodOneCol(wb.Sheets.Profit);
  const rowOf = (label) => X.findRow(wb.Sheets.Profit, label).filter(r => r > 3)[0];
  const agree = async (name, want) => {
    const ws = (await X.readBack(out[name])).getWorksheet('Profit');
    outputs.forEach((o, i) => [0, 1, 2, 3].forEach(p => {
      const v = valueOf(ws.getCell(rowOf(o), p1 + p));
      if(!near(v, want[i][p])) throw new Error(`${name}: ${o} in period ${p + 1} is ${v}, fmGraph says ${want[i][p]}`);
    }));
  };
  await agree('typed', want12);
  await agree('high', wantHigh);
  // The waterfall's helper rows with Price 12: fmGraph's own From and To.
  const top = X.findRow(wb.Sheets.Dashboard, 'Chart data: Profit walk (2030)', 'N')[0] + 1; // the names' row
  const dash = (await X.readBack(out.typed)).getWorksheet('Dashboard');
  walk12.forEach((f, k) => [['value', 1], ['from', 2], ['to', 3]].forEach(([key, r]) => {
    const raw = valueOf(dash.getCell(top + r, 15 + k)), v = raw === undefined ? 0 : raw; // a formula giving 0 reads as none
    if(!near(v, f[key])) throw new Error(`step ${k + 1}'s ${key} is ${v}, fmGraph says ${f[key]}`);
  }));
  // The Tornado's Data Table: fmGraph's own Low and High.
  const tables = await X.readBack(recalcDataTables({ wb: bytes }).wb);
  const sheet = 'What moves Profit', ws = tables.getWorksheet(sheet);
  const head = X.findRow(wb.Sheets[sheet], 'Input variable', 'B')[0];
  tornado.inputs.forEach(i => {
    const r = X.findRow(wb.Sheets[sheet], i.name, 'B').find(x => x > head && x <= head + 2);
    const low = valueOf(ws.getCell(r, 14)), high = valueOf(ws.getCell(r, 14 + 10));
    if(!near(low, i.lowValue) || !near(high, i.highValue)) throw new Error(`${i.name} gives ${low} / ${high}, fmGraph ${i.lowValue} / ${i.highValue}`);
  });
});
