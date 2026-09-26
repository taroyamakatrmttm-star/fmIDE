// 19. ExcelExporter on the shared IR (step 7, phase C).
// ExcelExporter reads the model through compileModel (src/shared/ir.js) and writes its
// formulas from it; units in the workbook come from the IR too.
const fs = require('fs');
const path = require('path');
const { test, fixture, FIXTURES } = require('./helpers/apps');
const X = require('./helpers/excel');
const { matchSnapshot } = require('./helpers/snapshot');

const DIRS = ['models', 'agreement', 'ir'];
const CASES = [];
DIRS.forEach(dir => fs.readdirSync(path.join(FIXTURES, dir)).filter(f => f.endsWith('.json')).sort().forEach(f => CASES.push([dir, f])));

// Every sheet's unit column (B) next to its line item (A), from row 4 down — pinned before
// ExcelExporter moved onto the IR, so the switch is shown not to change a workbook's units
// (the model samples have none, so the workbook snapshots alone would not show it).
function unitColumn(wb){
  const out = {};
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name], cells = {};
    X.cellAddrs(ws).map(X.splitAddr).filter(a => a.row >= 4 && a.col === 1).sort((a, b) => a.row - b.row).forEach(({ row }) => {
      const label = X.text(ws, 'A' + row), unit = X.text(ws, 'B' + row);
      if(label) cells['A' + row] = { v: label };
      if(unit) cells['B' + row] = { v: unit };
    });
    out[name] = cells;
  }
  return out;
}

for(const [dir, model] of CASES){
  test(`${dir}/${model}: the workbook's units are unchanged`, async ({ page }, testInfo) => {
    await X.openExporter(page);
    await X.loadModelFile(page, fixture(dir, model));
    await X.setInputsTab(page, false);
    const { wb } = await X.generate(page);
    matchSnapshot(testInfo, 'excel-units--' + dir + '--' + model.replace(/\.json$/, ''), unitColumn(wb));
  });
}
