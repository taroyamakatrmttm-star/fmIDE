// 19. ExcelExporter on the shared IR (step 7, phase C).
// ExcelExporter reads the model through compileModel (src/shared/ir.js) and writes its
// formulas from it; units in the workbook come from the IR too.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, FIXTURES } = require('./helpers/apps');
const X = require('./helpers/excel');
const { matchSnapshot } = require('./helpers/snapshot');

const DIRS = ['models', 'agreement', 'ir'];
const FUNCTION_SAMPLES = [['functions', 'basic.json'], ['functions', 'broken.json']];
const CASES = [];
DIRS.forEach(dir => fs.readdirSync(path.join(FIXTURES, dir)).filter(f => f.endsWith('.json')).sort().forEach(f => CASES.push([dir, f])));
CASES.push(...FUNCTION_SAMPLES);

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

// ---- function calls (step 7, phase D3) ----
// A call is written out in full inside each formula that reads it: the function's formula
// with each input replaced by what its port's arrow reads, in Excel's order of operations.

// Period 1's formula of each row on `sheet`, with every cell of that sheet's period 1 written
// as {Label}, so the expectations don't depend on row numbers.
function periodOneFormulas(wb, sheet){
  const ws = wb.Sheets[sheet];
  const col = X.numToCol(X.periodOneCol(ws));
  const labelOf = {};
  X.cellAddrs(ws).map(X.splitAddr).filter(a => a.col === 1 && a.row >= 4).forEach(({ row }) => { labelOf[row] = X.text(ws, 'A' + row); });
  const out = {};
  Object.entries(labelOf).forEach(([row, label]) => {
    const f = X.formulaOf(ws[col + row]);
    if(f) out[label] = f.replace(new RegExp('(?<![!$A-Z])' + col + '(\\d+)\\b', 'g'), (m, r) => '{' + (labelOf[r] || m) + '}');
  });
  return out;
}

test('function calls are written out in full, in Excel\'s order of operations', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('agreement', 'functions-calls.json'));
  await X.setInputsTab(page, false);
  const { wb } = await X.generate(page);
  const f = periodOneFormulas(wb, 'Calls');
  // Nested calls, written out inside one another.
  expect(f['Margin']).toBe('(({Revenue}-{Cost})/{Revenue})');
  expect(f['Profit']).toBe('(({Revenue}-{Cost})/{Revenue}*{Revenue})');
  expect(f['Scaled']).toBe('(({Revenue}-{Cost})/{Revenue}*{Revenue}*{k}-({Revenue}-{Cost})/{Revenue})');
  // An input used twice is repeated in full: an operator's formula, another function's call.
  expect(f['Square of sum']).toBe('(({Revenue}+{k})*({Revenue}+{k})+({Revenue}+{k}))');
  expect(f['Profit squared']).toBe('((({Revenue}-{Cost})/{Revenue}*{Revenue})*(({Revenue}-{Cost})/{Revenue}*{Revenue})+(({Revenue}-{Cost})/{Revenue}*{Revenue}))');
  // IFERROR, MIN, MAX, AVERAGE, ABS and MOD with the operators' Excel spellings.
  expect(f['Safe']).toBe('IFERROR({Revenue}/{Divisor},-1)');
  expect(f['Mods']).toBe('(MOD({a},{b})+MOD(-{a},{b})*10+AVERAGE({a},{b},1)+ABS({a}))');
  // An input with no arrow is NA(), where the formula reads it: IFERROR still catches it.
  expect(f['Catch unwired']).toBe('IFERROR(NA(),{Revenue})');
  // Inside the function's own IFERROR, a period outside the timeline is an error to catch.
  expect(f['Prior fallback']).toBe('IFERROR(({Revenue}/{Divisor}),IFERROR(NA(),{Nine}))');
  // Excel's order: a leading minus first (-x^2 is (-x)^2 in both apps), ^ from the left.
  expect(f['Precedence']).toBe('(2^3^2-({a}-({b}-{x}))+(-({a}^2))-(-(-{b}))+(-{a}^2/4)-{x}*(-{b}))');
  // Numbers as Excel reads them.
  expect(f['Numbers']).toBe('({x}*1500+0.5+1E-7*10000000+250)');
  // A comparison is 1/0 wherever something other than arithmetic reads it, and as the result;
  // so is a TRUE/FALSE read from a cell (Excel's MAX skips TRUE in a cell, and ranks TRUE above
  // every number: LibreOffice can't show either, so the formula text is pinned here).
  expect(f['Flag']).toBe('N({Revenue}>{Cost})');
  expect(f['Flag of flag']).toBe('N(N({Revenue}<{Cost})<{Half})');
  expect(f['Min flag']).toBe('(MIN(N({Revenue}<{Cost}),5)+MAX(N({Revenue}>={Cost}),-5)+IFERROR(N({Revenue}<={Cost}),9))');
  expect(f['Bigger']).toBe('MAX(N({Rev above cost}),0.5)');
});

test('the numbers in a function are written so Excel reads the same number', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src', 'excel-exporter', 'js', '01c-function-calls.js'), 'utf8');
  const { excelNumber } = vm.runInContext(code + '\n;({ excelNumber })', vm.createContext({}));
  for(const v of [0, 1, 12, 0.5, 1500, 0.05, 1e-7, 1.5e-12, 1e21, 2.5e300, 123456789012345, 0.1 + 0.2, 5e-324, Number.MAX_VALUE]){
    const s = excelNumber(v);
    expect(s, String(v)).toMatch(/^\d+(\.\d+)?(E[+-]\d+)?$/);
    expect(Number(s), s).toBe(v);
  }
});

test('function calls work inside block instances, and the Functions tab lists them', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('functions', 'basic.json'));
  await expect(page.locator('#differencesPanel')).toBeHidden();
  const { wb } = await X.generate(page);
  // A block instance's row writes the call with the host's cells.
  expect(periodOneFormulas(wb, 'Margin Block (instance 1)')['Out margin']).toBe("(('Functions'!E5-'Functions'!E6)/'Functions'!E5)");
  // The canvas is called "Functions", so the list gets the next free name, last.
  expect(wb.SheetNames[wb.SheetNames.length - 1]).toBe('Functions 2');
  const ws = wb.Sheets['Functions 2'];
  const rows = {};
  X.cellAddrs(ws).map(X.splitAddr).filter(a => a.col === 1 && a.row >= 5).forEach(({ row }) => {
    rows[X.text(ws, 'A' + row) + ' v' + X.text(ws, 'B' + row)] = { text: X.text(ws, 'C' + row), description: X.text(ws, 'D' + row), note: X.text(ws, 'E' + row), used: X.text(ws, 'F' + row) };
  });
  expect(X.text(ws, 'A4')).toBe('Function');
  expect(rows['Margin v1']).toEqual({ text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue', description: 'The share of revenue left after cost.',
    note: 'First version', used: '“Margin v1” (Functions), “Profit” (Functions), “Out margin” (Margin Block), “Out margin” (Margin Block (instance 1))' });
  expect(rows['Margin v2'].used).toBe('“Margin v2” (Functions)');
  expect(Object.keys(rows)).not.toContain('Unused v1');
  // A model without functions has no such tab.
  await X.loadFixtureModel(page, 'combined-bs-corkscrew-block.json');
  const plain = await X.generate(page);
  expect(plain.wb.SheetNames.some(n => /^Functions/.test(n))).toBe(false);
});

test('every function case fmIDE shows "?" for is #N/A in Excel and listed before download', async ({ page }) => {
  const system = JSON.parse(fs.readFileSync(fixture('functions', 'broken.json'), 'utf8'));
  system.canvases[0].nodes.find(n => n.id === 'fmiss').fn.name = '<img src=x onerror="window.__hacked=1">';
  const file = test.info().outputPath('broken-hostile.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(system));
  await X.openExporter(page);
  await X.loadModelFile(page, file);
  const lines = await differences(page);
  const line = (label) => lines.find(l => l.startsWith('“' + label + '”')) || '';
  const expected = {
    'Missing': 'its function’s definition, or one it calls, isn’t in the file (or is another version) (the function “<img src=x onerror="window.__hacked=1">” v1 on “Broken”)',
    'Other versionId': 'its function’s definition, or one it calls, isn’t in the file',
    'Unreadable': 'its function’s definition can’t be read (the function “Bad” v1',
    'Loop': 'its function calls itself through other functions',
    'Missing call': 'its function’s definition, or one it calls, isn’t in the file',
    'Wrong count': 'its function calls another with the wrong number of inputs',
    'Too deep': 'its function’s calls are nested more than 16 deep',
    'Unwired used': 'an input its function reads has no arrow',
  };
  for(const [label, why] of Object.entries(expected)){
    expect(line(label), label).toContain('fmIDE shows ? in periods 1–2 because ' + why);
    expect(line(label), label).toContain('Excel shows #N/A there.');
  }
  // A loop of arrows through a function follows the loop rule of any other loop.
  expect(line('Self loop')).toContain('it is part of a loop');
  // What fmIDE calculates is not listed: an input the formula doesn't read, one IFERROR catches,
  // the deepest call allowed, and a divide by zero (an error in Excel too).
  for(const label of ['Unwired unused', 'Unwired caught', 'Deep enough', 'Input fails']) expect(line(label), label).toBe('');
  expect(await page.locator('#differencesPanel img').count()).toBe(0);
  expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
  const { wb } = await X.generate(page);
  const f = periodOneFormulas(wb, 'Broken');
  for(const label of ['Missing', 'Other versionId', 'Unreadable', 'Loop', 'Missing call', 'Wrong count', 'Too deep']) expect(f[label], label).toBe('NA()');
  expect(f['Unwired used']).toBe('(({Revenue}-NA())/{Revenue})');
});

// A model whose call, written out, is too big for Excel: each function reads its input four
// times, so ten levels make 4^10 copies (millions of characters).
function repeatedInputsModel(levels){
  const fns = [], fam = (i) => 'family-rep-' + String(i).padStart(3, '0');
  for(let i = 0; i < levels; i++){
    const next = i + 1 < levels ? 'R' + (i + 1) + '(x)' : 'x';
    fns.push({ family: fam(i), version: 1, versionId: 'version-rep-' + i, text: 'R' + i + '(x) = ' + [next, next, next, next].join(' + '),
      calls: i + 1 < levels ? [{ name: 'R' + (i + 1), family: fam(i + 1), version: 1, versionId: 'version-rep-' + (i + 1) }] : [] });
  }
  // Nested deeper than Excel allows, but short: ABS 40 deep, called through two functions.
  const abs = (inner) => 'ABS('.repeat(40) + inner + ')'.repeat(40);
  fns.push({ family: 'family-deepa', version: 1, versionId: 'version-deepa-1', text: 'DeepA(x) = ' + abs('DeepB(x)'),
    calls: [{ name: 'DeepB', family: 'family-deepb', version: 1, versionId: 'version-deepb-1' }] });
  fns.push({ family: 'family-deepb', version: 1, versionId: 'version-deepb-1', text: 'DeepB(x) = ' + abs('x') });
  const fn = (id, family, versionId, name, y) => ({ id, type: 'function', x: 200, y, fn: { family, version: 1, versionId, name } });
  return { kind: 'system', version: 5, periods: ['P1', 'P2'], functions: fns, canvases: [{ id: 'cRep', name: 'Repeat', nodes: [
    { id: 'x', type: 'value', x: 0, y: 0, text: 'x\n1' },
    fn('fr', fam(0), 'version-rep-0', 'R0', 0), { id: 'big', type: 'value', x: 400, y: 0, text: 'Big' },
    fn('fs', fam(levels - 2), 'version-rep-' + (levels - 2), 'R' + (levels - 2), 100), { id: 'small', type: 'value', x: 400, y: 100, text: 'Small' },
    fn('fd', 'family-deepa', 'version-deepa-1', 'DeepA', 200), { id: 'deep', type: 'value', x: 400, y: 200, text: 'Deep' },
  ], edges: [
    { id: 'e1', from: 'x', to: 'fr', toPort: 0 }, { id: 'e2', from: 'fr', to: 'big' },
    { id: 'e3', from: 'x', to: 'fs', toPort: 0 }, { id: 'e4', from: 'fs', to: 'small' },
    { id: 'e5', from: 'x', to: 'fd', toPort: 0 }, { id: 'e6', from: 'fd', to: 'deep' },
  ] }] };
}

test('a formula too long or too deeply nested for Excel is #N/A and listed; writing it stays quick', async ({ page }) => {
  const file = test.info().outputPath('repeated-inputs.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(repeatedInputsModel(10)));
  await X.openExporter(page);
  const started = Date.now();
  await X.loadModelFile(page, file);
  await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
  const lines = await differences(page);
  const { wb } = await X.generate(page);
  // The writer gives up as soon as the text is too long, instead of writing 4^10 copies of x.
  expect(Date.now() - started).toBeLessThan(10000);
  const line = (label) => lines.find(l => l.startsWith('“' + label + '”')) || '';
  expect(line('Big')).toBe('“Big” (tab “Repeat”): the formula in periods 1–2 writes out a function call that would be longer than Excel allows (Excel allows 8,192), so Excel shows #N/A there, where fmIDE shows its value. Putting a rectangle between the function and what feeds it breaks the formula up.');
  expect(line('Deep')).toContain('nests brackets 80 deep (Excel allows 64)');
  expect(line('Small')).toBe(''); // 4^2 copies: fits
  const f = periodOneFormulas(wb, 'Repeat');
  expect(f['Big']).toBe('NA()');
  expect(f['Deep']).toBe('NA()');
  // Each call's own grouping is kept (a+(b+c)): with fractions, the order of adding can change
  // the last digit, and fmIDE adds in this order.
  expect(f['Small']).toBe('({x}+{x}+{x}+{x}+({x}+{x}+{x}+{x})+({x}+{x}+{x}+{x})+({x}+{x}+{x}+{x}))');
});
