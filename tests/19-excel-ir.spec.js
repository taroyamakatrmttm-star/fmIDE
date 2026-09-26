// 19. ExcelExporter on the shared IR (step 7, phase C).
// ExcelExporter reads the model through compileModel (src/shared/ir.js) and writes its
// formulas from it; units in the workbook come from the IR too.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, FIXTURES } = require('./helpers/apps');
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

// ---- operator spellings ----
// The catalogue (src/shared/operators.js) and ExcelExporter's table of Excel spellings
// (src/excel-exporter/js/01b-operator-spellings.js, a file holding only the table), each
// loaded on its own in Node: every catalogue operator has a spelling, and nothing else does.
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
function loadSpellings(){
  const code = fs.readFileSync(path.join(ROOT, 'src', 'shared', 'operators.js'), 'utf8') + '\n'
    + fs.readFileSync(path.join(ROOT, 'src', 'excel-exporter', 'js', '01b-operator-spellings.js'), 'utf8');
  return vm.runInContext(code + '\n;({ OPERATORS, EXCEL_SPELLINGS })', vm.createContext({}));
}

test('every operator in the catalogue has an Excel spelling, and only those do', () => {
  const { OPERATORS, EXCEL_SPELLINGS } = loadSpellings();
  const ids = OPERATORS.map(op => op.id);
  expect(Object.keys(EXCEL_SPELLINGS).sort()).toEqual(ids.slice().sort());
  const shapes = ['infix', 'fold', 'compare', 'fn'];
  for(const id of ids){
    const s = EXCEL_SPELLINGS[id];
    expect(shapes.filter(k => typeof s[k] === 'string' && s[k] !== ''), `${id}: exactly one way to write it`).toHaveLength(1);
  }
  // The sample every operator is in, so the workbook tests (units above, agreement in 17)
  // write each spelling at least once.
  const system = JSON.parse(fs.readFileSync(fixture('ir', 'error-cases.json'), 'utf8'));
  const used = new Set((system.system || system).canvases.flatMap(c => c.nodes.filter(n => n.type === 'operator').map(n => n.text)));
  for(const op of OPERATORS) expect(used.has(op.symbol), `${op.id} is in ir/error-cases.json`).toBe(true);
});

// ---- where the workbook will differ from fmIDE (the panel next to Generate) ----
async function differences(page){
  const panel = page.locator('#differencesPanel');
  if(await panel.isHidden()) return [];
  return panel.locator('li').allTextContents();
}

test('a model without broken links shows no differences', async ({ page }) => {
  await X.openExporter(page);
  for(const [dir, model] of [['models', 'combined-bs-corkscrew-block.json'], ['models', 'vertical-depreciation-block.json'], ['agreement', 'stale-plug-links.json']]){
    await X.loadModelFile(page, fixture(dir, model));
    await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
    await expect(page.locator('#differencesPanel')).toBeHidden();
  }
});

test('broken links: the rows where fmIDE shows "?" are listed before download, and the download still works', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('ir', 'error-cases.json'));
  const lines = await differences(page);
  const line = (label) => lines.find(l => l.startsWith('“' + label + '”')) || '';
  expect(line('Loop 1')).toContain('part of a loop');
  expect(line('Loop 1')).toContain('periods 1–3');
  expect(line('Loop 1')).toContain('Excel writes 0');
  expect(line('Two in')).toContain('more than one arrow');
  expect(line('Two in')).toContain('Excel leaves the cell blank');
  expect(line('Via unset alias')).toContain('an alias there points to nothing');
  expect(line('Via missing canvas')).toContain('a canvas that no longer exists');
  expect(line('From missing block')).toContain('definition canvas no longer exists');
  expect(line('Bad port')).toContain('a block output that no longer exists');
  expect(line('From self block')).toContain('a block there contains itself');
  expect(lines.some(l => l.includes('“foo”') && l.includes('passes its first input through'))).toBe(true);
  // Errors Excel shows too (a divide by zero) are not listed.
  expect(line('Uses div')).toBe('');
  const { wb } = await X.generate(page);
  expect(wb.SheetNames).toContain('Errors');
});

test('a row left out of the layout that other rows read is listed', async ({ page }) => {
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'scenario-unit-price-volume.json');
  await expect(page.locator('#differencesPanel')).toBeHidden();
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('#rowGroups input[type=text]')].find(i => i.value === 'Unit Price');
    label.closest('tr').querySelectorAll('input[type=checkbox]')[1].click();
  });
  expect(await differences(page)).toEqual([
    '“Unit Price” is left out of the layout, but other rows read it: in Excel they read 0 there, where fmIDE uses its value.',
  ]);
  const { wb } = await X.generate(page);
  expect(wb.SheetNames.length).toBeGreaterThan(0);
});

test('names from the file are shown as text in the list', async ({ page }) => {
  const system = JSON.parse(fs.readFileSync(fixture('ir', 'error-cases.json'), 'utf8'));
  const s = system.system || system;
  const errors = s.canvases.find(c => c.id === 'cE');
  errors.name = '<img src=x onerror="window.__hacked=1">';
  errors.nodes.find(n => n.id === 'two').text = '<b>Two</b>\n9';
  const file = test.info().outputPath('hostile-names.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(system));
  await X.openExporter(page);
  await X.loadModelFile(page, file);
  const lines = await differences(page);
  expect(lines.some(l => l.startsWith('“<b>Two</b>”'))).toBe(true);
  expect(await page.locator('#differencesPanel img, #differencesPanel b').count()).toBe(0);
  expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
});
