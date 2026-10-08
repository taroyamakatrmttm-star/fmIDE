// 67. Sensitivity in ExcelExporter (step 16, phase A): the panel, the Inputs tab's moved
// inputs, the Sensitivity tab with its Excel Data Table, the Tornado and Spider tables, the
// numbers written in (fmIDE's calculation with each input moved) and LibreOffice working the
// live Data Table out again — the model's own numbers unchanged, the tables following a Low
// changed in the file.
const fs = require('fs');
const { test, expect, fixture, readFixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const { requireSoffice, recalcDataTables, valueOf } = require('./helpers/soffice');

const IR = () => require('../src/shared/ir.js');
const UPV = 'scenario-unit-price-volume.json'; // Unit Price 10 × Volume 5 = Revenue 50, 10 periods

// The panel: on, the outputs and the inputs to move.
async function turnOn(page){
  if(!(await page.locator('#cfgSensEnabled').isChecked())) await page.click('#cfgSensEnabled');
  await expect(page.locator('#sensOptions')).toBeVisible();
}
async function addOutput(page, label){ await page.selectOption('#sensOutputPick', { label }); }
async function addInput(page, label){ await page.selectOption('#sensVarPick', { label }); }
const varLine = (page, name) => page.locator('#sensVars .sens-line').filter({ hasText: name });
async function setChange(page, name, by, low, high){
  const line = varLine(page, name);
  if(by) await line.locator('select.sens-by').selectOption(by);
  if(low !== undefined){ await line.locator('input.sens-low').fill(String(low)); await line.locator('input.sens-low').dispatchEvent('change'); }
  if(high !== undefined){ await line.locator('input.sens-high').fill(String(high)); await line.locator('input.sens-high').dispatchEvent('change'); }
}
// Unit Price and Volume moved, Revenue watched.
async function setUpUPV(page){
  await X.loadFixtureModel(page, UPV);
  await X.setInputsTab(page, true);
  await turnOn(page);
  await page.click('#btnSensAddAllVars');
  await addOutput(page, 'Revenue — Canvas 1');
  await expect(page.locator('#sensStatus')).toBeEmpty();
}

// The Sensitivity tab's parts, found by their headers.
function sensSheet(wb){
  const name = wb.SheetNames.find(n => /^Sensitivity/.test(n));
  return { name, ws: wb.Sheets[name] };
}
function varHeaderRow(ws){ return X.findRow(ws, 'Input variable', 'B')[0]; }
function colOfValue(ws, row, value){
  return Object.keys(ws).filter(a => /^[A-Z]+\d+$/.test(a) && Number(a.replace(/^[A-Z]+/, '')) === row && ws[a] && ws[a].v === value)
    .map(a => a.replace(/\d+$/, ''));
}
// The Data Table's numbers as written: one list per input, one number per point.
function writtenTable(ws, steps, nVars){
  const head = varHeaderRow(ws);
  const first = colOfValue(ws, head, -steps)[0];
  const out = [];
  for(let i = 0; i < nVars; i++){
    const row = [];
    for(let j = 0; j <= 2 * steps; j++){
      const c = ws[num2col(col2num(first) + j) + (head + 1 + i)];
      row.push(c && typeof c.v === 'number' ? c.v : null);
    }
    out.push(row);
  }
  return { head, first, table: out };
}
function col2num(s){ let n = 0; for(const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function num2col(n){ let s = ''; while(n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const close = (a, b) => (a === null && b === null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
function expectTable(got, want){
  expect(got.length).toBe(want.length);
  got.forEach((row, i) => row.forEach((v, j) => {
    if(!close(v, want[i][j])) throw new Error(`table[${i}][${j}] is ${v}, expected ${want[i][j]}\n got ${JSON.stringify(got)}\nwant ${JSON.stringify(want)}`);
  }));
}

// fmIDE's calculation (the shared IR) of `outputOf(results)` with each input moved to each
// point — worked out here, in Node, from the model file.
function expectedTable(system, vars, steps, outputOf){
  const { compileModel, evaluateModel, effectiveLiteral, irNodeIn } = IR();
  const ir = compileModel(system);
  const out = [];
  vars.forEach(v => {
    const node = irNodeIn(ir, v.canvasId, v.nodeId);
    const row = [];
    for(let p = -steps; p <= steps; p++){
      const change = p < 0 ? v.low * -p / steps : v.high * p / steps;
      const saved = node.literal;
      const values = [];
      for(let q = 0; q < ir.periodCount; q++){
        const b = effectiveLiteral(saved, q); const base = b === null ? 0 : b;
        values.push(v.by === 'percent' ? base * (1 + change / 100) : base + change);
      }
      node.literal = { text: saved.text, periodValues: values };
      try{ row.push(outputOf(ir, evaluateModel(ir, { instances: true }))); }
      finally{ node.literal = saved; }
    }
    out.push(row);
  });
  return out;
}
const nodeByName = (system, canvasName, name) => {
  const c = system.canvases.find(x => x.name === canvasName);
  const n = c.nodes.find(x => x.type === 'value' && (x.text || '').split('\n')[0] === name);
  return { canvasId: c.id, nodeId: n.id };
};
const topValue = (canvasId, nodeId, period) => (ir, res) => {
  const v = res[ir.order.findIndex(c => c.id === canvasId)].values[period][nodeId];
  return typeof v === 'number' ? v : null;
};

// A recalculated workbook's Sensitivity tab, read back: value at (row, col letter).
async function recalculated(bytes){
  const out = recalcDataTables({ wb: bytes }).wb;
  return X.readBack(out);
}

test.beforeEach(async ({ page }) => { await X.openExporter(page); });

test('the panel: off at first, the Inputs tab needed, outputs and inputs added, remembered', async ({ page, pageErrors }) => {
  await X.loadFixtureModel(page, UPV);
  await expect(page.locator('#sensitivityPanel h2 .panel-help')).toHaveAttribute('data-topic', 'sensitivity');
  await expect(page.locator('#cfgSensEnabled')).not.toBeChecked();
  await expect(page.locator('#sensOptions')).toBeHidden();
  await turnOn(page);
  await expect(page.locator('#sensStatus')).toContainText('Gather inputs on a separate tab');
  await X.setInputsTab(page, true);
  await expect(page.locator('#sensStatus')).toContainText('Add the inputs to move and at least one output');
  // Only the typed inputs can be moved; any rectangle row can be watched.
  expect(await page.locator('#sensVarPick option').allTextContents()).toEqual(['Add an input…', 'Unit Price — Canvas 1', 'Volume — Canvas 1']);
  expect(await page.locator('#sensOutputPick option').allTextContents()).toEqual(['Add an output…', 'Unit Price — Canvas 1', 'Volume — Canvas 1', 'Revenue — Canvas 1']);
  await addInput(page, 'Volume — Canvas 1');
  await expect(page.locator('#sensStatus')).toContainText('Add at least one output');
  await page.click('#btnSensAddAllVars');
  await expect(page.locator('#sensVars .sens-name')).toHaveText(['1. Volume', '2. Unit Price']);
  await expect(page.locator('#btnSensAddAllVars')).toBeDisabled();
  await addOutput(page, 'Revenue — Canvas 1');
  await expect(page.locator('#sensOutputs .sens-name')).toHaveText(['1. Revenue — Canvas 1']);
  await expect(page.locator('#sensStatus')).toBeEmpty();
  // % by default, −10 to +10; amount starts at −1 to +1.
  await expect(varLine(page, 'Volume').locator('input.sens-low')).toHaveValue('-10');
  await setChange(page, 'Volume', 'amount');
  await expect(varLine(page, 'Volume').locator('input.sens-low')).toHaveValue('-1');
  await expect(varLine(page, 'Volume').locator('input.sens-high')).toHaveValue('1');
  await setChange(page, 'Volume', null, -2.5, 3);
  await page.selectOption('#cfgSensPeriod', { label: '2029' });
  await page.fill('#cfgSensSteps', '99'); await page.locator('#cfgSensSteps').dispatchEvent('change');
  await expect(page.locator('#cfgSensSteps')).toHaveValue('10');
  // × removes; then everything is remembered for this model.
  await varLine(page, 'Unit Price').locator('.sens-remove').click();
  await expect(page.locator('#sensVars .sens-name')).toHaveText(['1. Volume']);
  await page.reload();
  await X.loadFixtureModel(page, UPV);
  await expect(page.locator('#cfgSensEnabled')).toBeChecked();
  await expect(page.locator('#sensVars .sens-name')).toHaveText(['1. Volume']);
  await expect(varLine(page, 'Volume').locator('select.sens-by')).toHaveValue('amount');
  await expect(varLine(page, 'Volume').locator('input.sens-low')).toHaveValue('-2.5');
  await expect(varLine(page, 'Volume').locator('input.sens-high')).toHaveValue('3');
  await expect(page.locator('#cfgSensPeriod')).toHaveValue('2');
  await expect(page.locator('#cfgSensSteps')).toHaveValue('10');
  await expect(page.locator('#sensOutputs .sens-name')).toHaveText(['1. Revenue — Canvas 1']);
  // Leaving a row out of the workbook takes it out of what can be watched.
  expect(pageErrors).toEqual([]);
});

test('the workbook: base rows, the moved inputs, the Sensitivity tab and its Data Table', async ({ page }) => {
  await setUpUPV(page);
  await setChange(page, 'Volume', 'amount', -2, 1);
  const { wb, bytes } = await X.generate(page);
  expect(wb.SheetNames).toEqual(['Inputs', 'Canvas 1', 'Sensitivity']);
  // Inputs tab: a Base row above each moved input, which reads the Sensitivity tab.
  const inp = wb.Sheets.Inputs;
  const [price] = X.findRow(inp, 'Unit Price');
  const [vol] = X.findRow(inp, 'Volume');
  expect(X.text(inp, 'A' + (price - 1))).toBe('Base (before sensitivity)');
  expect(inp['E' + (price - 1)].v).toBe(10);
  expect(X.formulaOf(inp['E' + price])).toBe("(E" + (price - 1) + ")*(1+'Sensitivity'!$I$16)+'Sensitivity'!$J$16");
  expect(X.formulaOf(inp['N' + vol])).toBe("(N" + (vol - 1) + ")*(1+'Sensitivity'!$I$17)+'Sensitivity'!$J$17");
  // The Sensitivity tab: controls, outputs, inputs.
  const { ws } = sensSheet(wb);
  expect(ws.C4.v).toBe(1); expect(ws.C5.v).toBe(1); expect(ws.C6.v).toBe(0); expect(ws.C7.v).toBe(0);
  expect(X.formulaOf(ws.C8)).toBe("CHOOSE(MIN(MAX($C$4,1),1),INDEX('Canvas 1'!$E$6:$N$6,1,MIN(MAX($C$5,1),10)))");
  expect(X.formulaOf(ws.B13)).toBe("'Canvas 1'!$A$6");
  const head = varHeaderRow(ws);
  expect(head).toBe(15);
  expect([ws.D16.v, ws.E16.v, ws.F16.v, ws.G16.v]).toEqual(['%', -10, 10, 1]);
  expect([ws.D17.v, ws.E17.v, ws.F17.v, ws.G17.v]).toEqual(['amount', -2, 1, 1]);
  expect(X.formulaOf(ws.H16)).toBe('IF($C$6=$A16,IF($C$7<0,$E16*(-$C$7)/5,$F16*$C$7/5),0)');
  // The Data Table: its definition in the file, and fmIDE's numbers written in.
  const sheetXml = Object.entries(await X.unzip(bytes)).find(([k, v]) => /worksheets\/sheet3\.xml$/.test(k))[1];
  expect(sheetXml).toContain('<f t="dataTable" ref="N16:X17" dt2D="1" dtr="1" r1="C7" r2="C6"/>');
  expect(X.formulaOf(ws.M15)).toBe('$C$8');
  const { table } = writtenTable(ws, 5, 2);
  expectTable(table, [
    [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
    [30, 34, 38, 42, 46, 50, 52, 54, 56, 58, 60],
  ]);
  // Tornado and Spider tables read it.
  expect(X.formulaOf(ws.B21)).toMatch(/^IFERROR\(INDEX\(\$K\$16:\$K\$17,MATCH\(\$A21,\$AC\$16:\$AC\$17,0\)\),""\)$/);
  expect(X.formulaOf(ws.N24)).toBe('IF($G$16=1,N16,NA())');
});

test('LibreOffice works the live Data Table out: the model unchanged, the tables following the file', async ({ page }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(180_000);
  await setUpUPV(page);
  await setChange(page, 'Volume', 'amount', -2, 1);
  const { wb, bytes } = await X.generate(page);
  let book = await recalculated(bytes);
  let ws = book.getWorksheet('Sensitivity');
  // (A formula giving "" reads back as nothing.)
  const row = (r, from, n) => Array.from({ length: n }, (_, j) => { const v = valueOf(ws.getCell(r, from + j)); return v === undefined || v === null ? '' : v; });
  expectTable([row(16, 14, 11), row(17, 14, 11)], [
    [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
    [30, 34, 38, 42, 46, 50, 52, 54, 56, 58, 60],
  ]);
  // The model's own numbers, with nothing moved.
  expect(valueOf(book.getWorksheet('Canvas 1').getCell('E6'))).toBe(50);
  expect(valueOf(ws.getCell('C8'))).toBe(50);
  expect(valueOf(ws.getCell('D6'))).toBe('OK - the model shows its own numbers');
  // Tornado: Volume moves Revenue most (−20 / +10), so it is first.
  expect([20, 21].map(r => row(r, 1, 4))).toEqual([[1, 'Volume (-2 / +1)', -20, 10], [2, 'Unit Price (-10% / +10%)', -5, 5]]);
  expect(row(23, 14, 3)).toEqual([-1, -0.8, -0.6]);

  // Change the file as a person would in Excel: Unit Price's Low −50%, Volume hidden. The
  // numbers written in are now stale; the Data Table works them out again.
  wb.Sheets.Sensitivity.E16.v = -50;
  wb.Sheets.Sensitivity.G17.v = 0;
  book = await recalculated(await X.writeWithApp(page, wb));
  ws = book.getWorksheet('Sensitivity');
  expect(row(16, 14, 6)).toEqual([25, 30, 35, 40, 45, 50]);
  expect(row(20, 1, 4)).toEqual([1, 'Unit Price (-50% / +10%)', -25, 5]);
  expect(row(21, 2, 3)).toEqual(['', '#N/A', '#N/A']);
  expect(row(25, 14, 2)).toEqual(['#N/A', '#N/A']); // Volume's Spider line: hidden
  expect(valueOf(book.getWorksheet('Canvas 1').getCell('E6'))).toBe(50);
});

test('an input with scenarios: the scenario it picks is what moves', async ({ page }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(180_000);
  await setUpUPV(page);
  // Unit Price gets 3 scenarios (the Tree's row control on the Inputs tab).
  const row = page.locator('#rowGroupsTree .tree-row', { has: page.locator('.scn-ctl') }).filter({ hasText: 'Unit Price' });
  await row.locator('.scn-ctl input[type=checkbox]').check();
  const { wb, bytes } = await X.generate(page);
  const inp = wb.Sheets.Inputs;
  const [price] = X.findRow(inp, 'Unit Price');
  expect(X.text(inp, 'A' + (price - 1))).toBe('Scenario 3'); // no Base row: the scenarios are its base
  expect(X.formulaOf(inp['E' + price])).toBe("(INDEX(E" + (price - 3) + ":E" + (price - 1) + ",MIN(MAX($C" + price + ",1),3)))*(1+'Sensitivity'!$I$16)+'Sensitivity'!$J$16");
  const book = await recalculated(bytes);
  const ws = book.getWorksheet('Sensitivity');
  expect(valueOf(ws.getCell('N16'))).toBe(45);
  expect(valueOf(ws.getCell('X16'))).toBe(55);
  expect(valueOf(book.getWorksheet('Canvas 1').getCell('E6'))).toBe(50);
});

test('a block model: outputs on a canvas and inside a block, as fmIDE works them out', async ({ page }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(180_000);
  const file = 'vertical-depreciation-block.json';
  const system = readFixture('models', file);
  await X.loadFixtureModel(page, file);
  await X.setInputsTab(page, true);
  await turnOn(page);
  // The block's own inputs (Tax rate, inside it) can't be moved.
  expect(await page.locator('#sensVarPick option').allTextContents()).toEqual(['Add an input…', 'Capex — Capex', 'Asset Life — Capex', 'Other — Capex']);
  await page.click('#btnSensAddAllVars');
  await setChange(page, 'Asset Life', 'amount', -2, 3);
  const outs = await page.locator('#sensOutputPick option').allTextContents();
  const inside = outs.find(t => /^Annual Dep — Vintage 2/.test(t));
  expect(inside).toBeTruthy();
  await addOutput(page, 'Grand Total — Capex');
  await addOutput(page, inside);
  await page.selectOption('#cfgSensPeriod', { index: 2 });
  await page.fill('#cfgSensSteps', '2'); await page.locator('#cfgSensSteps').dispatchEvent('change');
  const { wb, bytes } = await X.generate(page);
  const { ws } = sensSheet(wb);
  const vars = [
    Object.assign(nodeByName(system, 'Capex', 'Capex'), { by: 'percent', low: -10, high: 10 }),
    Object.assign(nodeByName(system, 'Capex', 'Asset Life'), { by: 'amount', low: -2, high: 3 }),
    Object.assign(nodeByName(system, 'Capex', 'Other'), { by: 'percent', low: -10, high: 10 }),
  ];
  const gt = nodeByName(system, 'Capex', 'Grand Total');
  const want = expectedTable(system, vars, 2, topValue(gt.canvasId, gt.nodeId, 2));
  const { table } = writtenTable(ws, 2, 3);
  expectTable(table, want);
  // Asset Life moves Grand Total: the lines are not flat.
  expect(new Set(want[1]).size).toBeGreaterThan(1);
  // LibreOffice, live: the same numbers for Grand Total, then (Output 2) for the vintage row.
  let book = await recalculated(bytes);
  let sw = book.getWorksheet('Sensitivity');
  const head = varHeaderRow(ws);
  const live = () => [0, 1, 2].map(i => Array.from({ length: 5 }, (_, j) => valueOf(sw.getCell(head + 1 + i, 14 + j))));
  expectTable(live(), want);
  wb.Sheets.Sensitivity.C4.v = 2; // Output 2, as a person would type it in Excel
  book = await recalculated(await X.writeWithApp(page, wb));
  sw = book.getWorksheet('Sensitivity');
  const host = system.canvases.find(c => c.name === 'Capex');
  const inst = host.nodes.find(n => n.type === 'blockInstance');
  const def = system.canvases.find(c => c.name === 'DepBlock');
  const dep = def.nodes.find(n => (n.text || '').split('\n')[0] === 'Annual Dep');
  const wantInside = expectedTable(system, vars, 2, (ir, res) => {
    const e = res.instances[2].find(x => x.nodeId === dep.id && x.path.length === 1 && x.path[0].nodeId === inst.id && x.path[0].vintage === 2 && !x.combined);
    return e && typeof e.value === 'number' ? e.value : null;
  });
  expectTable(live(), wantInside);
});

test('turned off, the workbook is exactly as it was', async ({ page }) => {
  await X.loadFixtureModel(page, UPV);
  await X.setInputsTab(page, true);
  const before = X.formulasAndValues((await X.generate(page)).wb);
  await turnOn(page);
  await page.click('#btnSensAddAllVars');
  await addOutput(page, 'Revenue — Canvas 1');
  await page.click('#cfgSensEnabled');
  await expect(page.locator('#sensOptions')).toBeHidden();
  expect(X.formulasAndValues((await X.generate(page)).wb)).toEqual(before);
  // On, but with nothing to watch: no Sensitivity tab either (and the panel says why).
  await turnOn(page);
  await page.locator('#sensOutputs .sens-remove').click();
  await expect(page.locator('#sensStatus')).toContainText('Add at least one output');
  expect(X.formulasAndValues((await X.generate(page)).wb)).toEqual(before);
});

test('leaving rows out: an output or input not written is not used', async ({ page }) => {
  await setUpUPV(page);
  // Leave Revenue out of the workbook (☐ Exclude, in the Tree's menu).
  const revenue = page.locator('#rowGroupsTree .tree-row').filter({ hasText: 'Revenue' }).first();
  await revenue.click({ button: 'right' });
  await page.locator('#treeCtxMenu').getByText('☐ Exclude').click();
  await expect(page.locator('#sensOutputs .sens-name.sens-off')).toHaveCount(1);
  await expect(page.locator('#sensStatus')).toContainText('Add at least one output');
  const { wb } = await X.generate(page);
  expect(wb.SheetNames).not.toContain('Sensitivity');
});

test('settings from a mapping file are checked; names are text', async ({ page }, testInfo) => {
  const model = readFixture('models', UPV);
  const sys = model.system;
  sys.canvases[0].nodes.forEach(n => { if(/^Volume/.test(n.text)) n.text = '<img src=x onerror=alert(1)>\n5'; });
  const modelFile = testInfo.outputPath('hostile.json');
  fs.writeFileSync(modelFile, JSON.stringify(model));
  await X.loadModelFile(page, modelFile);
  await X.setInputsTab(page, true);
  await turnOn(page);
  await page.click('#btnSensAddAllVars');
  await expect(page.locator('#sensVars .sens-name').nth(1)).toHaveText('2. <img src=x onerror=alert(1)>');
  await expect(page.locator('#sensitivityPanel img')).toHaveCount(0);
  // Export the layout, spoil its settings, import it back.
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.version).toBe(3);
  const realVar = exported.cfg.sensitivity.variables[0].row;
  exported.cfg.sensitivity = {
    enabled: true, outputs: ['nope', 42, realVar, realVar], period: -5, steps: 99, charts: '<script>',
    variables: [{ row: realVar, by: 'evil', low: 'abc', high: 1e20 }, { row: realVar, by: 'amount', low: 1, high: 2 }, { row: 'missing' }, 'junk',
      ...Array.from({ length: 60 }, (_, i) => ({ row: 'x' + i }))],
  };
  const file = testInfo.outputPath('spoiled.json');
  fs.writeFileSync(file, JSON.stringify(exported));
  await page.setInputFiles('#mappingFileInput', file);
  await expect(page.locator('#genStatus .status')).toHaveText('Mapping imported.');
  const [again] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const cleaned = JSON.parse(fs.readFileSync(await again.path(), 'utf8')).cfg.sensitivity;
  expect(cleaned).toEqual({ enabled: true, outputs: [realVar], period: 0, steps: 10, charts: 'tabs',
    variables: [{ row: realVar, by: 'percent', low: -10, high: 1e9 }] });
});
