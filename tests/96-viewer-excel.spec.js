// 96. Excel in the showcase viewer (phase V4 of docs/viewer-brief.md). The sample
// tests/fixtures/viewer/every-widget.fmide and its showcase (two scenarios, sliders that set a
// number in every period, in one period and in a range, and one that changes by %).
// - ExcelExporter's workbook for a viewer (09l-viewer-workbook.js, window.fmExcel): Use fmGraph
//   boards… applied by itself to the showcase's boards, the workbook generated, its cell map —
//   and the person's own layout put back: Generate afterwards writes exactly what it wrote before.
// - The patch for each state a visitor can be in (Base, a scenario shown exactly, sliders, a
//   scenario left by moving a slider: Base plus the sliders): the patched workbook, worked out
//   from its formulas' text (the import's xlRecalc, read through the import's own zip reader),
//   gives the viewer's own numbers — and LibreOffice too (skipped locally without it, required
//   on CI).
// - The owner's check files: tests/output/v4-check/ (not committed), five workbooks and a checklist.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, fixture, readFixture, openApp } = require('./helpers/apps');
const X = require('./helpers/excel');
const P = require('../src/shared/xlsx-patch.js');
const S = require('../src/shared/showcase.js');
const { xlReadWorkbook } = require('../src/excel-exporter/import/workbook.js');
const { xlRecalc } = require('../src/excel-exporter/import/recalc.js');
const { requireSoffice, recalc, valueOf: sofficeValue } = require('./helpers/soffice');
const ExcelJS = require('exceljs');

const MODEL = fixture('viewer', 'every-widget.fmide');
const SHOWCASE = fixture('viewer', 'every-widget.showcase.json');
const CHECK_DIR = path.join(ROOT, 'tests', 'output', 'v4-check');
const PERIODS = 4;

// ExcelExporter's workbook for the sample's showcase: { bytes, map, notes }.
async function viewerWorkbook(page){
  await openApp(page, 'ExcelExporter');
  await page.waitForFunction(() => !!window.fmExcel);
  const made = await page.evaluate(([m, b]) => fmExcel.viewerWorkbook(m, b), [fs.readFileSync(MODEL, 'utf8'), readFixture('viewer', 'every-widget.showcase.json').boards]);
  return { bytes: Uint8Array.from(made.bytes), map: made.map, notes: made.notes };
}
// A workbook's values worked out from its formulas' text: (sheet, address) → value.
async function recalcBytes(bytes){
  const book = await xlReadWorkbook(bytes);
  const wb = { SheetNames: book.sheets.map(s => s.name), Sheets: {} };
  book.sheets.forEach(s => { const ws = {}; s.cells.forEach((c, a) => { ws[a] = { v: c.value, f: c.formula || undefined }; }); wb.Sheets[s.name] = ws; });
  return { book, valueOf: xlRecalc(wb).valueOf };
}
// Where a rectangle's row is: its tab and the row whose column A holds its name.
function rowOf(book, sheet, label){
  const s = book.sheets.find(x => x.name === sheet);
  const c = [...s.cells.values()].find(x => x.col === 1 && x.row > 3 && x.value === label); // row 1 is the tab's title
  return c ? c.row : null;
}
const PERIOD_COLS = ['E', 'F', 'G', 'H']; // the model tabs' period columns (row 3: Period # 1–4)
const OUTPUTS = [ // what the checklist names, as [canvas id, node id, tab, label]
  ['cProfit', 'rev', 'Profit', 'Revenue'],
  ['cProfit', 'profit', 'Profit', 'Profit'],
  ['cCash', 'close', 'Cash', 'Closing cash'],
];

// The viewer's own numbers for a state: opened from the sample's files, the state set as a visitor sets it.
async function viewerNumbers(page, setState){
  await openApp(page, 'fmViewer');
  await page.waitForFunction(() => !!window.fmViewer);
  const before = await page.evaluate(() => fmViewer.state().loads);
  await page.setInputFiles('#fileInput', [MODEL, SHOWCASE]);
  await page.waitForFunction((n) => fmViewer.state().loads > n, before);
  const set = await setState(page);
  const values = await page.evaluate(([outs, n]) => outs.map(([c, id]) => Array.from({ length: n }, (_, p) => fmViewer.value(c, id, p))), [OUTPUTS, PERIODS]);
  return { values, set };
}

// The visitor's states the owner checks. `sliders`: the state as the download plans it, from the
// values the viewer kept (a slider stays on its steps).
const STATES = [
  { file: '1-base', what: 'Base, nothing moved', viewer: async () => ({}), state: () => ({ scenario: null, sliders: [] }) },
  { file: '2-scenario', what: 'The scenario "High price" shown exactly', viewer: async (page) => { await page.evaluate(() => fmViewer.showScenario('High price')); return {}; },
    state: () => ({ scenario: 'High price', sliders: [] }) },
  { file: '3-sliders', what: 'Base, Price set to 13, Volume +10%, Unit cost set to 7 (Year 2 only)',
    viewer: async (page) => page.evaluate(() => ({ price: fmViewer.setSlider('Price', 13), vol: fmViewer.setSlider('Volume', 10), cost: fmViewer.setSlider('Unit cost', 7) })),
    state: (s) => ({ scenario: null, sliders: [
      { canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: s.price },
      { canvasId: 'cProfit', nodeId: 'vol', name: 'Volume', mode: 'shift', periods: { mode: 'all' }, value: s.vol },
      { canvasId: 'cProfit', nodeId: 'ucost', name: 'Unit cost', mode: 'set', periods: { mode: 'one', p: 1 }, value: s.cost }] }) },
  { file: '4-mixed', what: 'The scenario "Big year" shown, then Volume moved to +5% (so: Base, Price 13 where the scenario put it, Volume +5%)',
    viewer: async (page) => page.evaluate(() => { fmViewer.showScenario('Big year'); return { vol: fmViewer.setSlider('Volume', 5) }; }),
    state: (s) => ({ scenario: null, sliders: [
      { canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: 13 },
      { canvasId: 'cProfit', nodeId: 'vol', name: 'Volume', mode: 'shift', periods: { mode: 'all' }, value: s.vol }] }) },
];

test.describe('ExcelExporter\'s workbook for a viewer', () => {
  test('the showcase\'s boards used on it: the Dashboard and Scenarios, and the cell map naming their cells', async ({ page, pageErrors }) => {
    const made = await viewerWorkbook(page);
    expect(made.notes).toEqual([]);
    const map = S.cleanCellMap(made.map);
    expect(map.problems).toEqual([]);
    expect(map.value.case).toEqual({ sheet: 'Scenarios', cell: 'C2' });
    expect(map.value.cases).toEqual([{ name: 'High price', case: 2, missing: 0 }, { name: 'Big year', case: 3, missing: 0 }]);
    expect(map.value.sliders.map(s => [s.name, s.mode, s.typed.cell, s.use && s.use.cell, s.rest])).toEqual([
      ['Price', 'set', 'F5', 'I5', null], ['Volume', 'shift', 'F6', null, 0], ['Unit cost', 'set', 'F7', 'I7', null],
      ['Overheads', 'set', 'F8', 'I8', null], ['Overheads', 'set', 'F9', 'I9', null]]);
    const { book } = await recalcBytes(made.bytes);
    expect(book.sheets.map(s => s.name).slice(0, 2)).toEqual(['Dashboard', 'Scenarios']);
    const dash = book.sheets[0].cells;
    expect(dash.get('F4').value).toBe('Typed');
    expect(dash.get('I4').value).toBe('Use');
    ['F5', 'F6', 'F7'].forEach(a => expect(dash.has(a) ? dash.get(a).value : null).toBeNull()); // Typed starts blank
    expect(book.sheets[1].cells.get('C2').value).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('the person\'s own layout is put back: Generate writes what it wrote before, and nothing is kept', async ({ page, pageErrors }) => {
    await X.openExporter(page);
    await X.loadModelFile(page, MODEL);
    const before = await X.generate(page);
    expect(before.wb.SheetNames).not.toContain('Dashboard'); // the layout has no boards used
    const made = await page.evaluate(([m, b]) => fmExcel.viewerWorkbook(m, b).then(r => r.bytes.length), [fs.readFileSync(MODEL, 'utf8'), readFixture('viewer', 'every-widget.showcase.json').boards]);
    expect(made).toBeGreaterThan(10000);
    await expect(page.locator('#cfgInputsEnabled')).not.toBeChecked();
    const after = await X.generate(page);
    expect(after.wb).toEqual(before.wb);
    // A fresh page, from the browser's storage: still the layout without the boards.
    await page.reload();
    await X.loadModelFile(page, MODEL);
    expect((await X.generate(page)).wb).toEqual(before.wb);
    expect(pageErrors).toEqual([]);
  });

  test('a model that can\'t be read, or boards of the wrong kind: refused with words, the layout untouched', async ({ page }) => {
    await openApp(page, 'ExcelExporter');
    await page.waitForFunction(() => !!window.fmExcel);
    const err = (m, b) => page.evaluate(([m, b]) => fmExcel.viewerWorkbook(m, b).then(() => null, e => e.message), [m, b]);
    expect(await err('not json', null)).toMatch(/JSON/);
    expect(await err(fs.readFileSync(MODEL, 'utf8'), { kind: 'fmIDE-showcase' })).toMatch(/not an fmGraph boards file/);
    // Without boards: the model's own workbook, no Dashboard, no cases.
    const plain = await page.evaluate(([m]) => fmExcel.viewerWorkbook(m, null).then(r => r.map), [fs.readFileSync(MODEL, 'utf8')]);
    expect(plain).toEqual({ case: null, cases: [], sliders: [] });
  });
});

test.describe('the patched workbook gives the viewer\'s numbers', () => {
  test('in every state a visitor can be in; and the owner\'s check files', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const context = await browser.newContext();
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const name = url.startsWith('http://local.test/') ? url.slice('http://local.test/'.length) : '';
      if(['ExcelExporter.html', 'fmViewer.html'].includes(name)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', name)) });
      return route.abort();
    });
    const page = await context.newPage();
    const made = await viewerWorkbook(page);
    const map = S.cleanCellMap(made.map).value;
    const author = await recalcBytes(made.bytes);
    const results = [];
    for(const st of STATES){
      const { values, set } = await viewerNumbers(page, st.viewer);
      const plan = S.excelPatchPlan(map, st.state(set), PERIODS);
      expect(plan.missing, st.file).toEqual([]);
      const patched = await P.patchXlsx(made.bytes, plan.writes);
      expect(patched.error, st.file).toBeUndefined();
      const { book, valueOf } = await recalcBytes(patched.bytes);
      const cells = [];
      OUTPUTS.forEach(([, , tab, label], k) => {
        const row = rowOf(book, tab, label);
        expect(row, label).toBeTruthy();
        PERIOD_COLS.forEach((col, p) => {
          const want = values[k][p], got = valueOf(tab, col + row);
          expect(Math.abs(got - want), st.file + ' ' + label + ' ' + col + row).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(want)));
          cells.push({ tab, cell: col + row, label, period: p, value: want });
        });
      });
      results.push({ st, plan, bytes: patched.bytes, cells });
    }
    // Base written again is the author's workbook with nothing changed but the zip.
    const base = await recalcBytes(results[0].bytes);
    OUTPUTS.forEach(([, , tab, label]) => PERIOD_COLS.forEach(col => {
      const r = rowOf(author.book, tab, label);
      expect(base.valueOf(tab, col + r)).toBe(author.valueOf(tab, col + r));
    }));
    writeCheckFiles(made.bytes, results);
    testInfo.annotations.push({ type: 'owner check', description: CHECK_DIR });
    await context.close();
  });

  test('LibreOffice recalculating the patched workbooks agrees with the viewer (required on CI)', async ({ browser }) => {
    requireSoffice(test);
    test.setTimeout(240_000);
    const context = await browser.newContext();
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const name = url.startsWith('http://local.test/') ? url.slice('http://local.test/'.length) : '';
      if(['ExcelExporter.html', 'fmViewer.html'].includes(name)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', name)) });
      return route.abort();
    });
    const page = await context.newPage();
    const made = await viewerWorkbook(page);
    const map = S.cleanCellMap(made.map).value;
    const files = {}, wanted = {};
    const author = await recalcBytes(made.bytes);
    for(const st of STATES){
      const { values, set } = await viewerNumbers(page, st.viewer);
      const patched = await P.patchXlsx(made.bytes, S.excelPatchPlan(map, st.state(set), PERIODS).writes);
      files[st.file] = Buffer.from(patched.bytes);
      wanted[st.file] = values;
    }
    const out = recalc(files);
    for(const st of STATES){
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(out[st.file]);
      OUTPUTS.forEach(([, , tab, label], k) => {
        const row = rowOf(author.book, tab, label);
        PERIOD_COLS.forEach((col, p) => {
          const got = sofficeValue(book.getWorksheet(tab).getCell(col + row)), want = wanted[st.file][k][p];
          expect(Math.abs(got - want), st.file + ' ' + label + ' ' + col + row).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(want)));
        });
      });
    }
    await context.close();
  });
});

// ---------- the licences (the sources are checked in group 95) ----------
test.describe('nothing of ExcelExporter\'s in the built viewer or fmIDE', () => {
  test('no Apache source (shared code, the viewer, fmIDE, fmGraph) takes in an ExcelExporter file', () => {
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]);
    const apache = ['src/shared', 'src/viewer', 'src/fmide', 'src/fmgraph'].flatMap(walk).filter(f => /\.(js|html|css)$/.test(f));
    const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const offenders = apache.filter(f => /build:(include|css|js)\s+\S*excel-exporter\//.test(text(f)) || /from '\.\.\/excel-exporter\//.test(text(f)));
    expect(offenders).toEqual([]);
  });
  test('their lists of sources and their pages carry none of ExcelExporter\'s own code; the viewer carries the patch', () => {
    const { appSources } = require('../tools/build.js');
    for(const app of ['fmViewer', 'fmIDE']){
      const a = appSources().find(x => x.app === app);
      expect(a.files.filter(f => f.startsWith('src/excel-exporter/'))).toEqual([]);
    }
    const marks = ['export var XLSX', 'Built-in .xlsx writer', 'function xlZipEntries', 'function viewerWorkbook(', 'function appendDashboardSheet', 'function buildWorkbook'];
    for(const page of ['apps/fmViewer.html', 'apps/fmIDE.html']){
      const text = fs.readFileSync(path.join(ROOT, page), 'utf8');
      expect(marks.filter(m => text.includes(m)), page).toEqual([]);
    }
    expect(fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8')).toContain('function patchXlsx');
  });
});

// The owner's check (phase V4): the author's workbook and the four patched ones, with a
// checklist of what each should show in Excel on Windows and on the iPad.
function writeCheckFiles(authorBytes, results){
  fs.mkdirSync(CHECK_DIR, { recursive: true });
  fs.writeFileSync(path.join(CHECK_DIR, '0-author.xlsx'), Buffer.from(authorBytes));
  const fmt = (v) => typeof v === 'number' ? (Math.round(v * 100) / 100).toLocaleString('en-US') : String(v);
  const lines = [
    'Phase V4 check: Excel in the showcase viewer',
    '',
    'Made by test group 96 from tests/fixtures/viewer/every-widget.fmide and its showcase.',
    'Open each workbook in Excel on Windows and in Excel on the iPad. About 10 minutes in all.',
    '',
    'For every file:',
    '  1. It opens with no "We found a problem with some content" or repair message.',
    '  2. The cells listed under "Written" show those values (Scenarios C2 is the case run; D2 its name).',
    '  3. The numbers listed under "Should show" are the same (Excel may show fewer decimals).',
    '  4. Type another number in Dashboard F5 (Price, Typed) with I5 (Use) TRUE: Revenue and Profit change.',
    '     On Windows, clear F5 and move Price\'s scroll bar: they change too.',
    '  5. Save in Excel, close, open again: no repair message.',
    '',
    '0-author.xlsx: the workbook ExcelExporter made for the viewer, not patched.',
    '  Should show the same numbers as 1-base.xlsx.',
    ''
  ];
  results.forEach(({ st, plan, bytes, cells }) => {
    fs.writeFileSync(path.join(CHECK_DIR, st.file + '.xlsx'), Buffer.from(bytes));
    lines.push(st.file + '.xlsx: ' + st.what + '.');
    lines.push('  The viewer\'s line under ⬇ Excel: "' + plan.line + '"');
    lines.push('  Written: ' + plan.writes.map(w => w.sheet + ' ' + w.cell + ' = ' + (w.value === true ? 'TRUE' : w.value === false ? 'FALSE' : w.value)).join(', '));
    lines.push('  Should show (the viewer\'s numbers):');
    const byLabel = new Map();
    cells.forEach(c => { if(!byLabel.has(c.label)) byLabel.set(c.label, []); byLabel.get(c.label).push(c); });
    byLabel.forEach((list, label) => lines.push('    ' + label + ' (' + list[0].tab + ' tab): ' + list.map(c => c.cell + ' ' + fmt(c.value)).join(', ')));
    lines.push('');
  });
  lines.push('Tell the session: each file, Windows and iPad, OK or what you saw.');
  fs.writeFileSync(path.join(CHECK_DIR, 'checklist.txt'), lines.join('\r\n'));
}
