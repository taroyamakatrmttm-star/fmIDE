// 17. Agreement — the canvas and Excel give the same numbers.
// Each model is opened in fmIDE (values read through window.fm) and in ExcelExporter (the
// workbook recalculated by LibreOffice); every rectangle that has its own row on its
// canvas's tab must show the same value in every period, in both apps. So must every row on
// a block instance's tab, against fmIDE's calculation of that instance (the shared IR, run
// in Node). An error on both sides ("?" in fmIDE, an error cell in Excel) counts as agreeing.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, FIXTURES } = require('./helpers/apps');
const X = require('./helpers/excel');
const { openFmIDE, importViaCommand, acceptAll } = require('./helpers/fmide');
const { requireSoffice, recalc, valueOf } = require('./helpers/soffice');
const { MODELS } = require('./helpers/models');

const AGREEMENT = fs.readdirSync(path.join(FIXTURES, 'agreement')).filter(f => f.endsWith('.json')).sort();
const CASES = MODELS.map(m => ['models', m]).concat(AGREEMENT.map(m => ['agreement', m]));

// fmIDE's value of every value rectangle, per canvas: { canvas: [{ name, values[] }] }
// (a value is a number, or 'error' when fmIDE shows "?").
async function fmideValues(page, file){
  await openFmIDE(page);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  await importViaCommand(page, json.kind === 'fmIDE-workspace' ? 'importWorkspace' : 'loadSystem', file);
  await acceptAll(page);
  await page.waitForFunction((n) => fm.canvases().length === n, (json.system || json).canvases.length);
  return page.evaluate(() => {
    const out = {};
    fm.canvases().forEach(c => {
      fm.switchCanvas(c.name);
      out[c.name] = fm.nodes().filter(n => n.type === 'value').map(n => {
        const lines = (n.text || '').split('\n');
        const name = lines.length === 1 && lines[0].trim() !== '' && !isNaN(Number(lines[0])) ? lines[0].trim() : lines[0];
        const values = [];
        for(let p = 1; ; p++){
          try{ values.push(fm.getValue('#' + n.id, p)); }
          catch(e){ if(/There is no period/.test(e.message)) break; values.push('error'); }
        }
        return { name, values };
      });
    });
    return out;
  });
}

// Rows inside block instances: fmIDE shows only a block's outputs, so their values come from
// fmIDE's calculation run on its own in Node (the shared IR, the same code fmIDE runs — test
// group 18 checks that). One entry per block-instance tab, as ExcelExporter names them:
// { tab: [{ label, values[] }] }, labelled as ExcelExporter labels rows ("Name — Vintage 2",
// "Name (Total)", "Name (shared)").
const vm = require('vm');
function loadIR(){
  const dir = path.join(__dirname, '..', 'src', 'shared');
  const code = ['operators.js', 'uom.js', 'input-rule.js', 'ir.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  return vm.runInContext(code + '\n;({ compileModel, evaluateModel, parseRectText })', vm.createContext({}));
}
function instanceValues(system){
  const IR = loadIR();
  const ir = IR.compileModel(system);
  const results = IR.evaluateModel(ir, { instances: true });
  // Tab names: one per block instance, canvas by canvas, numbered per block (sanitizeSheetName).
  const tabOf = {}, count = {};
  ir.order.forEach(c => c.list.forEach(n => {
    if(n.type !== 'blockInstance' || !n.blockDefCanvasId || tabOf[c.id + '|' + n.id]) return;
    const def = ir.canvases.get(n.blockDefCanvasId);
    count[n.blockDefCanvasId] = (count[n.blockDefCanvasId] || 0) + 1;
    const name = (def ? (def.name || n.blockDefCanvasId) : 'Block') + ' (instance ' + count[n.blockDefCanvasId] + ')';
    tabOf[c.id + '|' + n.id] = name.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet';
  }));
  const out = {};
  results.instances.forEach((list, p) => list.forEach(e => {
    const n = ir.canvases.get(e.canvasId).byId.get(e.nodeId);
    if(!n || n.type !== 'value' || n.blockRole === 'index') return;
    const tab = tabOf[e.path[0].canvasId + '|' + e.path[0].nodeId];
    const name = IR.parseRectText(n.node.text).name || '(unnamed)';
    const last = e.path[e.path.length - 1];
    const labels = e.combined ? [name + ' (Total)']
      : typeof last.vintage === 'number' ? [name + ' — Vintage ' + last.vintage].concat(last.vintage === 1 ? [name + ' (shared)'] : [])
      : [name];
    const v = (e.value === null || e.value === undefined || Number.isNaN(e.value)) ? 'error' : e.value;
    const key = e.path.map(h => h.canvasId + ':' + h.nodeId + ':' + (h.vintage || '')).join('>') + '|' + e.canvasId + '|' + e.nodeId + (e.combined ? '#total' : '');
    labels.forEach(label => {
      out[tab] = out[tab] || {};
      const k = key + '|' + label;
      out[tab][k] = out[tab][k] || { label, values: [] };
      out[tab][k].values[p] = v;
    });
  }));
  return Object.fromEntries(Object.entries(out).map(([tab, m]) => [tab, Object.values(m)]));
}

// ExcelExporter's workbook (Inputs tab on or off), recalculated by LibreOffice.
async function excelBook(page, file, inputsOn){
  await X.openExporter(page);
  await X.loadModelFile(page, file);
  await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
  await X.setInputsTab(page, inputsOn);
  const { wb, bytes } = await X.generate(page);
  return { wb, bytes };
}

function excelValue(cell){
  const v = valueOf(cell);
  if(typeof v === 'boolean') return v ? 1 : 0;
  if(typeof v === 'string' && v.startsWith('#')) return 'error';
  if(v === null || v === undefined) return 0; // an empty cell reads as 0
  return v;
}

function same(a, b){
  if(a === 'error' || b === 'error') return a === b;
  if(typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

for(const [folder, model] of CASES){
  test(`${folder}/${model}: fmIDE and the recalculated workbook agree`, async ({ page }) => {
    requireSoffice(test);
    const file = fixture(folder, model);
    const fm = await fmideValues(page, file);
    const books = { off: await excelBook(page, file, false), on: await excelBook(page, file, true) };
    const recalculated = recalc({ off: books.off.bytes, on: books.on.bytes });

    let compared = 0;
    const mismatches = [];
    for(const mode of Object.keys(books)){
      const intended = books[mode].wb;
      const book = await X.readBack(recalculated[mode]);
      for(const [canvas, rects] of Object.entries(fm)){
        const ws = intended.Sheets[canvas];
        if(!ws) continue;
        const p1 = X.periodOneCol(ws);
        const sheet = book.getWorksheet(canvas);
        for(const r of rects){
          if(rects.filter(o => o.name === r.name).length !== 1) continue; // name not unique on the canvas
          const rows = X.findRow(ws, r.name);
          if(rows.length !== 1) continue; // no row of its own (e.g. a block's Vertical Index)
          r.values.forEach((v, p) => {
            const got = excelValue(sheet.getCell(X.numToCol(p1 + p) + rows[0]));
            compared++;
            if(!same(v, got)) mismatches.push(`${mode === 'on' ? 'Inputs tab on' : 'Inputs tab off'} · ${canvas} · ${r.name} · period ${p + 1}: fmIDE ${v}, Excel ${got}`);
          });
        }
      }
    }
    // Rows inside block-instance tabs, against fmIDE's calculation of each instance.
    const comparedOutside = compared;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const inside = instanceValues(json.system || json);
    for(const mode of Object.keys(books)){
      const intended = books[mode].wb;
      const book = await X.readBack(recalculated[mode]);
      for(const [tab, rows] of Object.entries(inside)){
        const ws = intended.Sheets[tab];
        if(!ws) continue;
        const p1 = X.periodOneCol(ws);
        const sheet = book.getWorksheet(tab);
        for(const r of rows){
          if(rows.filter(o => o.label === r.label).length !== 1) continue; // label not unique on the tab
          const found = X.findRow(ws, r.label);
          if(found.length !== 1) continue; // no row of its own (e.g. a port something feeds)
          r.values.forEach((v, p) => {
            const got = excelValue(sheet.getCell(X.numToCol(p1 + p) + found[0]));
            compared++;
            if(!same(v, got)) mismatches.push(`${mode === 'on' ? 'Inputs tab on' : 'Inputs tab off'} · ${tab} · ${r.label} · period ${p + 1}: fmIDE ${v}, Excel ${got}`);
          });
        }
      }
    }
    expect(compared, 'some rectangles were compared').toBeGreaterThan(0);
    if(Object.keys(inside).length) expect(compared - comparedOutside, 'some rows inside block instances were compared').toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
}

// Known answers for the edge cases, so both apps are also right, not just equal.
test('edge cases: fmIDE gives the agreed answers', async ({ page }) => {
  const fm = await fmideValues(page, fixture('agreement', 'operator-edge-cases.json'));
  const v = Object.fromEntries(fm['Edge cases'].map(r => [r.name, r.values]));
  expect(v['Mod negative dividend']).toEqual([2, 2, 2]);           // MOD(-7, 3)
  expect(v['Mod negative divisor']).toEqual([-2, -2, -2]);         // MOD(7, -3)
  expect(v['Chain 1<3<2']).toEqual([0, 0, 0]);                     // 1<3 and 3<2
  expect(v['Comparison with one input']).toEqual(['error', 'error', 'error']);
  expect(v['Abs of two']).toEqual(['error', 'error', 'error']);
  expect(v['Iferror one input']).toEqual([0, 0, 0]);
  expect(v['Divided by zero, typed']).toEqual(['error', 'error', 'error']); // no fallback to the typed 5
  expect(v['Iferror of prior period']).toEqual([7, 10, 10]);
  expect(v['Override first period']).toEqual([7, 10, 10]);
  expect(v['Opening balance']).toEqual([50, 60, 70]);
  expect(v['Closing balance']).toEqual([60, 70, 80]);
  expect(v['Opening balance nested']).toEqual([50, 60, 70]);
  expect(v['Fed by empty operator']).toEqual([0, 0, 0]);
  expect(v['Fed by empty iferror']).toEqual([5, 5, 5]);
});

// A file may use the same node id on two canvases (ids made inside fmIDE never repeat, but a
// file from elsewhere can): each canvas still shows its own numbers. Here "rate" is AR
// outstanding rate (0.2) on BS and Tax rate (0.3) on DepBlock; "plus" is on BS and Capex.
test('rectangles that share an id on different canvases keep their own values', async ({ page }) => {
  const fm = await fmideValues(page, fixture('models', 'combined-bs-corkscrew-block.json'));
  const v = (canvas, name) => fm[canvas].find(r => r.name === name).values;
  expect(v('DepBlock', 'Tax rate')).toEqual([0.3, 0.3, 0.3]);
  expect(v('BS', 'AR outstanding rate')).toEqual([0.2, 0.2, 0.2]);
  expect(v('Capex', 'Grand Total')).toEqual([19, 19, 19]);
  expect(v('BS', 'Total Assets')).toEqual([60, 60, 60]);
});
