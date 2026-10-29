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

// ---------- making a viewer with Excel in fmIDE, and ⬇ Excel in the made file ----------
const F = require('./helpers/fmide');
const maker = (page) => page.locator('.modal-box.showcase-maker');
async function fmideWithWidget(page){
  await F.openFmIDE(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(MODEL);
  await expect.poll(() => page.evaluate(() => fm.canvases()[0].id)).toBe('cProfit');
}
// A made page opened from disk in a context of its own; every request that isn't the file is counted.
async function openMade(browser, testInfo, name, text, options){
  const file = testInfo.outputPath(name);
  fs.writeFileSync(file, text);
  const context = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }, options || {}));
  const outside = [];
  await context.route('**/*', route => { const u = route.request().url(); if(u.startsWith('file:')) return route.continue(); outside.push(u); return route.abort(); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.fmViewer && fmViewer.state().loaded);
  return { context, page, outside, errors };
}
const blockOf = (text, id) => {
  const open = '<script type="application/json" id="' + id + '">';
  const at = text.indexOf(open);
  return text.slice(at + open.length, text.indexOf('</script>', at));
};
// ⬇ Excel pressed: the file's name and bytes.
async function downloadExcel(page){
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExcel')]);
  return { name: download.suggestedFilename(), bytes: new Uint8Array(fs.readFileSync(await download.path())) };
}
// The cells a workbook's Dashboard and Scenarios hold (to compare with what the plan wrote).
async function inputCells(bytes){
  const { book } = await recalcBytes(bytes);
  const at = (sheet, a) => { const s = book.sheets.find(x => x.name === sheet); const c = s && s.cells.get(a); return c ? c.value : null; };
  return { C2: at('Scenarios', 'C2'), F5: at('Dashboard', 'F5'), I5: at('Dashboard', 'I5'), F6: at('Dashboard', 'F6'), F7: at('Dashboard', 'F7'), I7: at('Dashboard', 'I7') };
}

test.describe('fmIDE: Make Showcase Viewer… with Excel', () => {
  test('the window\'s Excel row; Make viewer opens ExcelExporter, takes its workbook, closes it; the file carries it', async ({ page, context }) => {
    await fmideWithWidget(page);
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    const box = maker(page);
    await expect(box.locator('.sm-excel')).toBeChecked(); // the model has boards
    await expect(box.locator('.sm-excel-file')).toHaveValue('every-widget.xlsx');
    await box.locator('.sm-excel-file').fill('Every widget.xlsx');
    const popups = [];
    context.on('page', p => popups.push(p));
    const [download] = await Promise.all([page.waitForEvent('download'), box.locator('.sm-make').click()]);
    const text = fs.readFileSync(await download.path(), 'utf8');
    expect(popups.length).toBe(1);
    await expect.poll(() => popups[0].isClosed()).toBe(true); // opened for this, so closed again
    const block = S.readViewerWorkbook(JSON.parse(blockOf(text, 'excel')));
    expect(block.error).toBeUndefined();
    expect(block.problems).toEqual([]);
    expect(block.value.cells.sliders.map(s => s.typed.cell)).toEqual(['F5', 'F6', 'F7', 'F8', 'F9']);
    expect(blockOf(text, 'excel')).not.toContain('<');
    // The choice is kept in the document, so making it again remembers it.
    expect(await page.evaluate(() => fm.showcase().excel)).toEqual({ file: 'Every widget.xlsx' });
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    await expect(maker(page).locator('.sm-excel-file')).toHaveValue('Every widget.xlsx');
    // The made page's own script is the bare viewer's, byte for byte (one policy hash fits every viewer).
    const scripts = (t) => [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts(text)).toEqual(scripts(fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8')));
  });

  test('ExcelExporter can\'t be opened: asked, and "without it" makes the viewer with no workbook', async ({ page }) => {
    await fmideWithWidget(page);
    await page.evaluate(() => { window.open = () => null; }); // as a browser blocking the window
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    await maker(page).locator('.sm-make').click();
    const question = page.locator('.message-box').last();
    await expect(question).toContainText('The Excel workbook couldn\'t be made: The browser blocked the ExcelExporter window.');
    await expect(question).toContainText('Make the viewer without it?');
    const [download] = await Promise.all([page.waitForEvent('download'), question.locator('button.danger').click()]);
    const text = fs.readFileSync(await download.path(), 'utf8');
    expect(blockOf(text, 'excel')).toBe('');
    // The action says the same, as an error.
    await expect(page.evaluate(() => fm.makeShowcaseViewer({ excel: true }))).rejects.toThrow('The Excel workbook couldn\'t be made');
    // excel: false makes none, without asking ExcelExporter.
    const r = await page.evaluate(() => fm.makeShowcaseViewer({ excel: false }).then(x => ({ excel: x.excel, sc: x.showcase.excel })));
    expect(r).toEqual({ excel: null, sc: undefined });
  });
});

test.describe('⬇ Excel in a made viewer', () => {
  test('its line, the file for each state, the cells the plan wrote, the viewer\'s numbers; off while Play runs', async ({ page, browser }, testInfo) => {
    test.setTimeout(180_000);
    await fmideWithWidget(page);
    const made = await page.evaluate(() => fm.makeShowcaseViewer({ excel: { file: 'Loan & cash.xlsx' } }).then(r => ({ name: r.fileName, text: r.text, excel: r.excel })));
    expect(made.excel).toMatchObject({ file: 'Loan & cash.xlsx', notes: [] });
    const v = await openMade(browser, testInfo, made.name, made.text);
    await expect(v.page.locator('#btnExcel')).toBeVisible();
    await expect(v.page.locator('#excelNote')).toHaveText('The model\'s own numbers');
    const cases = [
      { set: () => {}, name: 'Loan & cash.xlsx', cells: { C2: 1, F5: null, I5: false, F6: null } },
      { set: () => fmViewer.showScenario('High price'), name: 'Loan & cash – High price.xlsx', line: 'Scenario: High price', cells: { C2: 2, F5: null, I5: false } },
      { set: () => { fmViewer.showScenario('Big year'); fmViewer.setSlider('Volume', 5); }, name: 'Loan & cash – my sliders.xlsx', line: 'Price set to 13, Volume +5%', cells: { C2: 1, F5: 13, I5: true, F6: 5 } },
      { set: () => { fmViewer.reset(); fmViewer.setSlider('Unit cost', 7); fmViewer.setSlider('Volume', -10); }, name: 'Loan & cash – my sliders.xlsx', line: 'Volume -10%, Unit cost set to 7', cells: { C2: 1, F5: null, F6: -10, F7: 7, I7: true } },
    ];
    for(const c of cases){
      await v.page.evaluate(c.set);
      if(c.line) await expect(v.page.locator('#excelNote')).toHaveText(c.line);
      const file = await downloadExcel(v.page);
      expect(file.name).toBe(c.name);
      expect(await inputCells(file.bytes)).toMatchObject(c.cells);
      const { book, valueOf } = await recalcBytes(file.bytes);
      const want = await v.page.evaluate(([outs, n]) => outs.map(([cv, id]) => Array.from({ length: n }, (_, p) => fmViewer.value(cv, id, p))), [OUTPUTS, PERIODS]);
      OUTPUTS.forEach(([, , tab, label], k) => PERIOD_COLS.forEach((col, p) => {
        const got = valueOf(tab, col + rowOf(book, tab, label));
        expect(Math.abs(got - want[k][p]), c.name + ' ' + label + ' ' + col).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(want[k][p])));
      }));
    }
    // The plan the hand-built states of the owner's check use is the viewer's own.
    await v.page.evaluate(() => { fmViewer.reset(); fmViewer.setSlider('Price', 13); fmViewer.setSlider('Volume', 10); fmViewer.setSlider('Unit cost', 7); });
    const viewerPlan = await v.page.evaluate(() => fmViewer.excelPlan());
    const map = S.readViewerWorkbook(JSON.parse(blockOf(made.text, 'excel'))).value.cells;
    expect(viewerPlan).toEqual(S.excelPatchPlan(map, STATES[2].state({ price: 13, vol: 10, cost: 7 }), PERIODS));
    // The numbers lesson 8.2 of the manual gives (docs/manual/08-showcase.md).
    const lesson = await v.page.evaluate(() => {
      fmViewer.showScenario('High price');
      const high = [fmViewer.value('cProfit', 'profit', 1), fmViewer.value('cProfit', 'rev', 1)];
      fmViewer.showScenario('Base'); fmViewer.setSlider('Price', 13); fmViewer.setSlider('Volume', 10);
      return { high, sliders: fmViewer.value('cProfit', 'profit', 1), line: fmViewer.excelPlan().line };
    });
    expect(lesson).toEqual({ high: [5200, 14300], sliders: 5970, line: 'Price set to 13, Volume +10%' });
    // While Play runs the button is off, and says why.
    await v.page.evaluate(() => fmViewer.play('Base', 'High price'));
    await expect(v.page.locator('#btnExcel')).toBeDisabled();
    await expect(v.page.locator('#excelNote')).toHaveText('Stop Play to download');
    await v.page.evaluate(() => fmViewer.stopPlay());
    await v.page.locator('#tabBoard').click();
    await expect(v.page.locator('#btnExcel')).toBeEnabled();
    // Another model opened in the viewer has no workbook: no ⬇ Excel.
    const loads = await v.page.evaluate(() => fmViewer.state().loads);
    await v.page.setInputFiles('#fileInput', fixture('viewer', 'every-kind.fmide'));
    await v.page.waitForFunction((n) => fmViewer.state().loads > n, loads);
    await expect(v.page.locator('#excelWrap')).toBeHidden();
    expect(await v.page.evaluate(() => fmViewer.excelPlan())).toBeNull();
    expect(v.outside).toEqual([]);
    expect(v.errors).toEqual([]);
    await v.context.close();
  });

  test('no workbook, or a hostile or newer one: no ⬇ Excel (or a refusal in words), nothing run', async ({ page, browser }, testInfo) => {
    await fmideWithWidget(page);
    const plain = await page.evaluate(() => fm.makeShowcaseViewer({ excel: false }).then(r => r.text));
    let v = await openMade(browser, testInfo, 'plain.html', plain);
    await expect(v.page.locator('#excelWrap')).toBeHidden();
    expect(await v.page.evaluate(() => fmViewer.excelPlan())).toBeNull();
    await v.context.close();
    // A hostile excel block: markup, a cell map naming what can't be, a workbook that isn't one.
    const hostile = JSON.stringify({ kind: 'fmIDE-viewer-workbook', version: 1, packed: 'deflate-raw', size: 100,
      workbook: Buffer.from('</script><script>window.__pwned=1</script>').toString('base64').replace(/=+$/, '') + '==',
      cells: { case: { sheet: 'Scen<b>arios', cell: 'C2' }, sliders: [{ canvasId: 'cProfit', nodeId: 'price', mode: 'set', typed: { sheet: 'D', cell: 'ZZZZ1' } }] } }).replace(/</g, '\\u003c');
    const page2 = plain.replace('<script type="application/json" id="excel"></script>', () => '<script type="application/json" id="excel">' + hostile + '</script>');
    v = await openMade(browser, testInfo, 'hostile.html', page2);
    expect(await v.page.evaluate(() => window.__pwned)).toBeUndefined();
    const shown = await v.page.locator('#excelWrap').isVisible();
    if(shown){
      // It may show (the block reads), but the download refuses with words and writes nothing.
      await v.page.click('#btnExcel');
      await expect(v.page.locator('.note.err')).toContainText(/workbook/);
    }
    // A newer workbook block: no ⬇ Excel, and the visitor is told once.
    const newer = plain.replace('<script type="application/json" id="excel"></script>', () => '<script type="application/json" id="excel">' + JSON.stringify({ kind: 'fmIDE-viewer-workbook', version: 99 }) + '</script>');
    const v2 = await openMade(browser, testInfo, 'newer.html', newer);
    await expect(v2.page.locator('#excelWrap')).toBeHidden();
    await expect(v2.page.locator('#notices')).toContainText('newer fmIDE');
    await v2.context.close();
    await v.context.close();
  });

  test('on a phone-sized touch screen the share sheet\'s fallback downloads the file', async ({ page, browser }, testInfo) => {
    await fmideWithWidget(page);
    const made = await page.evaluate(() => fm.makeShowcaseViewer({ excel: true }).then(r => ({ name: r.fileName, text: r.text })));
    const v = await openMade(browser, testInfo, made.name, made.text, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await expect(v.page.locator('#btnExcel')).toBeVisible();
    await expect(v.page.locator('#excelNote')).toBeHidden(); // the line is the button's tooltip on a phone
    expect(await v.page.locator('#btnExcel').getAttribute('title')).toContain('The model\'s own numbers');
    const file = await downloadExcel(v.page);
    expect(file.name).toBe('every-widget.xlsx');
    expect(v.errors).toEqual([]);
    await v.context.close();
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
