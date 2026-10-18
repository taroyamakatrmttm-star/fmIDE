// 80. Importing an Excel model in ExcelExporter (step 20; docs/step20-excel-import.md): the
// page side of the importer. Phase 20d: File → Import Excel model… (and an .xlsx dropped) opens
// the confirm screen — per sheet what was found (tick, header row, period, label and unit
// columns, the rows and their kinds), changing a choice works the sheet out again, a sheet
// without periods is off until given a header row, someone else's text is shown as text, and
// a file that can't be read says why. Phase 20e: Import builds the model from the sheets ticked
// and loads it (the message says what was kept as Excel's saved values); Generate writes it.
// Phase 20f: the report after Import — how the model compares with Excel's saved values, what
// was kept and why, the cells unlike their row — and File → Import Report… while that model is
// shown. Phase 20g: Save for fmIDE, and the end-to-end test: the workbook imported, generated
// again by ExcelExporter and recalculated by LibreOffice gives the original's saved values, and
// the saved file opened in fmIDE gives them too.
const path = require('path');
const JSZip = require('jszip');
const { test, expect, fixture, ORIGIN } = require('./helpers/apps');
const X = require('./helpers/excel');
const FM = require('./helpers/fmide');
const ExcelJS = require('exceljs');
const { requireSoffice, recalc, valueOf } = require('./helpers/soffice');

const sample = (name) => fixture('excel-import', name);
const sheetBox = (page, i) => page.locator('#importSheets .import-sheet').nth(i);

async function importFile(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), X.menuCommand(page, 'btnImportExcel')]);
  await chooser.setFiles(file);
}

test('File → Import Excel model… shows what each sheet holds', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('03-two-sheets.xlsx'));
  const modal = page.locator('#importModal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#importSource')).toHaveText('03-two-sheets.xlsx · 2 sheets');
  await expect(page.locator('#importSheets .import-sheet-name')).toHaveText(['Inputs', 'Calc']);
  await expect(sheetBox(page, 0).locator('.import-summary')).toHaveText('5 periods, 2026–2030 · 3 inputs, 1 assumption, 1 title');
  await expect(sheetBox(page, 1).locator('.import-summary')).toHaveText('5 periods, 2026–2030 · 9 calculations, 1 title');
  await expect(sheetBox(page, 1).locator('.import-include')).toBeChecked();
  const calc = sheetBox(page, 1);
  await expect(calc.locator('.import-header')).toHaveValue('3');
  await expect(calc.locator('.import-first')).toHaveValue('D');
  await expect(calc.locator('.import-last')).toHaveValue('H');
  await expect(calc.locator('.import-label')).toHaveValue('A');
  await expect(calc.locator('.import-unit')).toHaveValue('B');
  await calc.locator('summary').click();
  const row10 = calc.locator('tr[data-row="10"] td');
  await expect(row10).toHaveText(['10', 'Tax', 'calculation', 'MAX(0,D9*TaxRate)']);
  await expect(sheetBox(page, 0).locator('tr[data-row="8"] td')).toHaveText(['8', 'Tax rate', 'assumption', '0.25']);
  // Escape closes it.
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
});

test('changing a choice works the sheet out again; a sheet without periods is off until given a header row', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('04-not-supported.xlsx'));
  await expect(page.locator('#importSheets .import-sheet-name')).toHaveText(['Valuation', 'Lookup']);
  const val = sheetBox(page, 0), lookup = sheetBox(page, 1);
  await expect(val.locator('.import-summary')).toHaveText('5 periods, 2026–2030 · 2 assumptions, 4 calculations, 1 opening balance, 2 one formulas, 1 title');
  await expect(lookup.locator('.import-summary')).toHaveText('No row of periods found: give a header row to import it.');
  await expect(lookup.locator('.import-include')).toBeDisabled();
  await expect(lookup.locator('.import-include')).not.toBeChecked();
  // Fewer periods.
  await val.locator('.import-last').fill('F');
  await val.locator('.import-last').dispatchEvent('change');
  await expect(val.locator('.import-summary')).toContainText('3 periods, 2026–2028');
  await val.locator('summary').click();
  await expect(val.locator('tr[data-row="12"] .import-odd')).toHaveText('differs in F12');
  await expect(val.locator('tr[data-row="7"] td').nth(2)).toHaveText('opening balance');
  // No unit column; labels from B.
  await val.locator('.import-label').fill('B');
  await val.locator('.import-label').dispatchEvent('change');
  await val.locator('summary').click();
  await expect(val.locator('tr[data-row="8"] td').nth(1)).toHaveText('£');
  // The Lookup sheet given a header row it can't use stays off.
  await lookup.locator('.import-header').fill('1');
  await lookup.locator('.import-header').dispatchEvent('change');
  await expect(lookup.locator('.import-include')).toBeDisabled();
  // Cancel closes it.
  await page.locator('#importCancel').click();
  await expect(page.locator('#importModal')).toBeHidden();
});

test('a workbook dropped on the page opens the window too; one that can\'t be read says why', async ({ page }) => {
  await X.openExporter(page);
  const drop = async (name, bytes) => {
    await page.evaluate(async ({ name, data }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], name));
      document.getElementById('dropZone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, { name, data: [...bytes] });
  };
  await drop('01-simple-rows.xlsx', require('fs').readFileSync(sample('01-simple-rows.xlsx')));
  await expect(page.locator('#importModal')).toBeVisible();
  await expect(page.locator('#importSheets .import-sheet-name')).toHaveText(['Model']);
  await page.locator('#importCancel').click();
  await drop('old.xls', Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0]));
  await expect(page.locator('#loadStatus .status.err')).toHaveText('Could not import old.xls: This is an old Excel file (.xls) or a password-protected workbook. Open it in Excel and save it as an .xlsx workbook without a password, then import that.');
  await expect(page.locator('#importModal')).toBeHidden();
  await drop('notes.xlsx', Buffer.from('just text'));
  await expect(page.locator('#loadStatus .status.err')).toContainText('Could not import notes.xlsx: This is not an Excel workbook (.xlsx)');
});

test('someone else\'s workbook: markup in sheet names, labels and formulas is shown as text', async ({ page }) => {
  const evil = '&lt;img src=x onerror=window.__pwned=1&gt;';
  const zip = new JSZip();
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="' + evil + '" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>' + evil + '</t></is></c><c r="B2"><f>"' + evil + '"&amp;1</f><v>0</v></c><c r="C2"><f>"' + evil + '"&amp;1</f><v>0</v></c></row></sheetData></worksheet>');
  const file = path.join(test.info().outputDir, 'evil.xlsx');
  require('fs').mkdirSync(path.dirname(file), { recursive: true });
  require('fs').writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
  await X.openExporter(page);
  await importFile(page, file);
  const box = sheetBox(page, 0);
  await expect(box.locator('.import-sheet-name')).toHaveText('<img src=x onerror=window.__pwned=1>');
  await box.locator('summary').click();
  await expect(box.locator('tr[data-row="2"] td').nth(1)).toHaveText('<img src=x onerror=window.__pwned=1>');
  await expect(box.locator('tr[data-row="2"] td').nth(3)).toHaveText('"<img src=x onerror=window.__pwned=1>"&1');
  await expect(page.locator('#importModal img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('Import builds the model from the sheets ticked and loads it; Generate writes it', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('03-two-sheets.xlsx'));
  // Nothing ticked: Import is off.
  for(const i of [0, 1]) await sheetBox(page, i).locator('.import-include').uncheck();
  await expect(page.locator('#importOk')).toBeDisabled();
  for(const i of [0, 1]) await sheetBox(page, i).locator('.import-include').check();
  await expect(page.locator('#importOk')).toBeEnabled();
  await page.locator('#importOk').click();
  await expect(page.locator('#importModal')).toBeHidden();
  await expect(page.locator('#loadStatus .status.ok')).toHaveText('Imported 03-two-sheets.xlsx — 2 canvases, 13 rectangles, 5 periods.');
  await expect(page.locator('#modelName')).toHaveText('03-two-sheets');
  await expect(page.locator('#importReportModal')).toBeVisible();
  await page.locator('#importReportClose').click();
  await expect(page.locator('#afterLoad')).toBeVisible();
  const { wb } = await X.generate(page);
  expect(wb.SheetNames).toEqual(expect.arrayContaining(['Inputs', 'Calc']));
  await expect(page.locator('#differencesPanel')).toBeHidden();
  const calc = wb.Sheets['Calc'];
  expect(X.findRow(calc, 'Tax').length).toBe(1);
});

test('rows kept as Excel\'s saved values are named in the message', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('04-not-supported.xlsx'));
  await page.locator('#importOk').click();
  await expect(page.locator('#loadStatus .status.warn')).toHaveText('Imported 04-not-supported.xlsx — 1 canvas, 9 rectangles, 5 periods. 4 rows kept as Excel\'s saved values: Growth (VLOOKUP), NPV (NPV), Cumulative cash (a range growing along the periods), Years above 220 (COUNTIF). 1 row with cells that differ, kept as Excel\'s saved values there.');
});

test('the report after Import: the check, what was kept and why, cells unlike their row; File → Import Report…', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('04-not-supported.xlsx'));
  await page.locator('#importOk').click();
  const modal = page.locator('#importReportModal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#importReportSource')).toHaveText('04-not-supported.xlsx · 1 canvas, 9 rectangles');
  await expect(page.locator('#importCheckSummary')).toHaveText('All 15 calculated cells agree with Excel\'s saved values.');
  await expect(page.locator('#importCheckSummary')).toHaveClass(/ok/);
  await expect(page.locator('#importDifferHead')).toBeHidden();
  await expect(page.locator('#importKept li')).toHaveText([
    'Valuation!D6:H6 · Growth: VLOOKUP', 'Valuation!C10 · NPV: NPV',
    'Valuation!D11:H11 · Cumulative cash: a range growing along the periods', 'Valuation!C13 · Years above 220: COUNTIF']);
  await expect(page.locator('#importOdd li')).toHaveText(['Valuation!F12 · Cash doubled: Excel\'s saved value in that period']);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  // Reopened from the File menu while the imported model is shown; gone once another is loaded.
  await X.menuCommand(page, 'btnImportReport');
  await expect(modal).toBeVisible();
  await page.locator('#importReportClose').click();
  await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
  await expect(page.locator('#btnImportReport')).toBeHidden();
});

test('the report lists cells whose saved value the model doesn\'t give, and says when nothing was saved', async ({ page }) => {
  const make = async (name, cells) => {
    const zip = new JSZip();
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="Plan" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>Units</t></is></c><c r="B2"><v>10</v></c><c r="C2"><v>12</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Doubled</t></is></c><c r="B3"><f>B2*2</f>' + cells[0] + '</c><c r="C3"><f>C2*2</f>' + cells[1] + '</c></row></sheetData></worksheet>');
    const file = path.join(test.info().outputDir, name);
    require('fs').mkdirSync(path.dirname(file), { recursive: true });
    require('fs').writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
    return file;
  };
  await X.openExporter(page);
  await importFile(page, await make('stale.xlsx', ['<v>20</v>', '<v>25</v>']));
  await page.locator('#importOk').click();
  await expect(page.locator('#importCheckSummary')).toHaveText('1 of 2 calculated cells agree with Excel\'s saved values; 1 differ.');
  await expect(page.locator('#importCheckSummary')).toHaveClass(/warn/);
  await expect(page.locator('#importDiffer li')).toHaveText(['Plan!C3 · Doubled · 2027: fmIDE 24, Excel 25']);
  await expect(page.locator('#loadStatus .status.warn')).toBeVisible();
  await page.locator('#importReportClose').click();
  await importFile(page, await make('unsaved.xlsx', ['', '']));
  await page.locator('#importOk').click();
  await expect(page.locator('#importCheckSummary')).toHaveText('Nothing to compare: the workbook was saved without its formulas\' values. Save it in Excel, then import it again.');
});

// Excel's saved values of a sample's rows: { sheet: { label: [value per period] } }.
async function savedValues(file){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const out = {};
  wb.eachSheet(ws => {
    out[ws.name] = {};
    ws.eachRow((row, r) => {
      const label = row.getCell(1).value;
      if(typeof label !== 'string' || r <= 3) return;
      const periods = ['D', 'E', 'F', 'G', 'H'].map(c => valueOf(ws.getCell(c + r)));
      // An assumption: its one number, in column C, for every period.
      const one = valueOf(ws.getCell('C' + r));
      out[ws.name][label] = periods.every(v => v === null) && typeof one === 'number' ? periods.map(() => one) : periods.map(v => v === undefined || v === null ? 0 : v);
    });
  });
  return out;
}
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

test('Save for fmIDE writes the imported model as an fmIDE document carrying its Excel layout, from the report and from the File menu', async ({ page }) => {
  await X.openExporter(page);
  await expect(page.locator('#btnSaveForFmide')).toBeHidden();
  await importFile(page, sample('02-corkscrew.xlsx'));
  await page.locator('#importOk').click();
  const fromReport = await FM.downloadJson(page, () => page.locator('#importSave').click());
  expect(fromReport.name).toBe('02-corkscrew.fmide');
  expect([fromReport.data.kind, fromReport.data.version]).toEqual(['fmIDE-workspace', 13]);
  expect([fromReport.data.system.kind, fromReport.data.system.version, fromReport.data.system.periods.length]).toEqual(['system', 9, 5]);
  expect(fromReport.data.system.canvases.map(c => c.name)).toEqual(['Assets']);
  // Its Excel layout as it is now: a mapping file, sections off, the sheet's title as a label row.
  const layout = fromReport.data.excelLayout;
  expect([layout.kind, layout.version, layout.cfg.sectionsEnabled]).toEqual(['fmIDE-excel-mapping', 8, false]);
  expect(layout.customRows.filter(r => r.label).map(r => r.label)).toEqual(['Fixed assets']);
  await page.locator('#importReportClose').click();
  await expect(page.locator('#loadStatus .status.ok')).toHaveText('Saved 02-corkscrew.fmide — open it in fmIDE with File → Open…; its Excel layout goes with it.');
  const fromMenu = await FM.downloadJson(page, () => X.menuCommand(page, 'btnSaveForFmide'));
  expect(fromMenu.data).toEqual(fromReport.data);
});

test('end to end: Excel → fmIDE model → ExcelExporter\'s workbook, recalculated by LibreOffice, and fmIDE give the original\'s saved values', async ({ page }) => {
  requireSoffice(test);
  const file = sample('03-two-sheets.xlsx');
  const want = await savedValues(file);
  await X.openExporter(page);
  await importFile(page, file);
  await page.locator('#importOk').click();
  await expect(page.locator('#importCheckSummary')).toHaveText('All 45 calculated cells agree with Excel\'s saved values.');
  const saved = await FM.downloadJson(page, () => page.locator('#importSave').click());
  await page.locator('#importReportClose').click();
  // ExcelExporter's own workbook of the imported model, recalculated.
  const { bytes } = await X.generate(page);
  const out = await X.readBack(recalc({ book: bytes }).book);
  let compared = 0;
  for(const sheet of ['Inputs', 'Calc']){
    const ws = out.getWorksheet(sheet);
    let first = null;
    ws.getRow(3).eachCell((c, col) => { if(c.value === 1 && first === null) first = col; });
    expect(first, sheet).not.toBeNull();
    for(const [label, values] of Object.entries(want[sheet])){
      let row = null;
      ws.eachRow((r, n) => { if(r.getCell(1).value === label && row === null) row = n; });
      if(row === null) continue; // a title
      values.forEach((v, p) => {
        const got = valueOf(ws.getCell(row, first + p));
        expect(near(got === undefined ? 0 : got, v), sheet + ' ' + label + ' period ' + (p + 1) + ': ' + got + ' against ' + v).toBe(true);
        compared++;
      });
    }
  }
  expect(compared).toBeGreaterThanOrEqual(60);

  // The saved file opened in fmIDE.
  const fm = await page.context().newPage();
  await FM.openFmIDE(fm);
  const path2 = require('path').join(test.info().outputDir, saved.name);
  require('fs').mkdirSync(test.info().outputDir, { recursive: true });
  require('fs').writeFileSync(path2, JSON.stringify(saved.data));
  await fm.setInputFiles('#fileInputDocument', path2);
  await expect.poll(() => fm.evaluate(() => fm.canvases().map(c => c.name)).catch(() => null)).toEqual(['Inputs', 'Calc']);
  const calc = saved.data.system.canvases.find(c => c.name === 'Calc');
  await fm.evaluate(() => fm.switchCanvas('Calc'));
  for(const label of ['Revenue', 'EBIT', 'Tax', 'Net income', 'Net margin']){
    const node = calc.nodes.find(n => n.type === 'value' && n.text.split('\n')[0] === label);
    const got = await fm.evaluate((id) => [1, 2, 3, 4, 5].map(p => fm.getValue('#' + id, p)), node.id);
    got.forEach((v, p) => expect(near(v, want.Calc[label][p]), 'fmIDE ' + label + ' period ' + (p + 1) + ': ' + v).toBe(true));
  }
  await fm.close();
});

test('rows in parts in the window and the report (actuals typed, then a forecast formula)', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('05-actuals-forecast.xlsx'));
  const box = sheetBox(page, 0);
  await expect(box.locator('.import-summary')).toHaveText('5 periods, 2026–2030 · 1 input, 3 calculations, 7 rows in parts, 1 opening balance, 1 title');
  await box.locator('summary').click();
  await expect(box.locator('tr[data-row="7"] td')).toHaveText(['7', 'Revenue', 'in parts', '2026–2028: typed; 2029–2030: F7*(1+G5)']);
  await page.locator('#importOk').click();
  await expect(page.locator('#importCheckSummary')).toHaveText('All 55 calculated cells agree with Excel\'s saved values.');
  await expect(page.locator('#importOddHead')).toBeHidden();
  await expect(page.locator('#importKeptHead')).toBeHidden();
});

// A workbook of three sections, `per` rows each, two blank rows between them (ExcelJS).
async function sectionsWorkbook(per){
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Model');
  ['B', 'C', 'D', 'E'].forEach((c, i) => { ws.getCell(c + '1').value = 2026 + i; });
  const block = (title, top, make) => {
    ws.getCell('A' + top).value = title;
    for(let k = 1; k <= per; k++){
      ws.getCell('A' + (top + k)).value = title + ' ' + k;
      ['B', 'C', 'D', 'E'].forEach((c, i) => { ws.getCell(c + (top + k)).value = make(c, top + k, k, i); });
    }
    return top + per + 3;
  };
  let top = block('Alpha', 2, (c, r, k, i) => k * 10 + i);
  const alpha = (k, i) => k * 10 + i;
  top = block('Beta', top, (c, r, k, i) => ({ formula: c + (r - per - 3) + '*2', result: alpha(k, i) * 2 }));
  block('Gamma', top, (c, r, k, i) => ({ formula: c + (r - per - 3) + '+1', result: alpha(k, i) * 2 + 1 }));
  return { name: 'sections.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}

test('a tall sheet is a canvas per section unless unticked; a short one is ticked off; one without sections has no box', async ({ page }) => {
  await X.openExporter(page);
  const tall = await sectionsWorkbook(15);
  await importFile(page, tall);
  const split = sheetBox(page, 0).locator('.import-split');
  await expect(split).toBeChecked();
  await expect(sheetBox(page, 0).locator('.import-split-label')).toHaveText('One canvas per section (3)');
  await expect(sheetBox(page, 0).locator('.import-split-label')).toHaveAttribute('title', 'A canvas for each section of the sheet: Alpha, Beta, Gamma');
  await page.locator('#importOk').click();
  await expect(page.locator('#loadStatus .status.ok')).toHaveText('Imported sections.xlsx — 3 canvases, 45 rectangles, 4 periods.');
  await expect(page.locator('#importCheckSummary')).toHaveText('All 120 calculated cells agree with Excel\'s saved values.');
  await expect(page.locator('#importReportNotes')).toContainText('“Model” is 3 canvases, one per section');
  await page.locator('#importReportClose').click();
  const { wb } = await X.generate(page);
  expect(wb.SheetNames).toEqual(expect.arrayContaining(['Alpha', 'Beta', 'Gamma']));

  // Unticked: one canvas.
  await importFile(page, tall);
  await sheetBox(page, 0).locator('.import-split').uncheck();
  await page.locator('#importOk').click();
  await expect(page.locator('#loadStatus .status.ok')).toHaveText('Imported sections.xlsx — 1 canvas, 45 rectangles, 4 periods.');
  await page.locator('#importReportClose').click();

  // 6 rows: the box is there, unticked (40 rows or fewer stay on one canvas).
  await importFile(page, await sectionsWorkbook(2));
  await expect(sheetBox(page, 0).locator('.import-split')).not.toBeChecked();
  await page.locator('#importCancel').click();
  // A sample without sections: no box.
  await importFile(page, sample('03-two-sheets.xlsx'));
  await expect(page.locator('#importSheets .import-split')).toHaveCount(0);
});

test('the workbook generated after Import keeps the sheet\'s rows, titles and blank rows in order, and its formulas\' numbers in the formulas', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('03-two-sheets.xlsx'));
  await page.locator('#importOk').click();
  await page.locator('#importReportClose').click();
  const { bytes } = await X.generate(page);
  const book = await X.readBack(bytes);
  const column = (ws) => { const out = []; for(let r = 4; r <= ws.rowCount; r++) out.push(String(ws.getCell('A' + r).value || '')); return out; };
  // Calc: the title, the empty row under the years, then the rows in the sheet's order.
  expect(column(book.getWorksheet('Calc'))).toEqual(['Profit and loss', '', 'Revenue', 'Fixed costs', 'Variable costs', 'Total costs', 'EBIT', 'Tax', 'Net income', 'Net margin', 'Loss flag']);
  // The 0.4 and the 0s are written in the formulas, as in the original; they have no rows.
  const calc = book.getWorksheet('Calc');
  const rowOf = (ws, label) => column(ws).indexOf(label) + 4;
  expect(calc.getCell('E' + rowOf(calc, 'Variable costs')).formula).toBe('ROUND(E' + rowOf(calc, 'Revenue') + '*0.4,0)');
  expect(calc.getCell('E' + rowOf(calc, 'Tax')).formula).toBe('MAX(0,E' + rowOf(calc, 'EBIT') + '*\'Inputs\'!E' + rowOf(book.getWorksheet('Inputs'), 'Tax rate') + ')');
  for(const ws of book.worksheets) expect(column(ws).filter(t => /: [0-9.]+$/.test(t))).toEqual([]);
  // No Inputs / Calculations / Outputs sections in the layout.
  expect(column(book.getWorksheet('Inputs'))).toEqual(['Inputs', '', 'Units sold', 'Unit price', 'Fixed costs', 'Tax rate']);
});

test('the workbook generated after Import keeps each row\'s look: bold, text colour, fill, lines and number format', async ({ page }) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Model');
  ['B', 'C', 'D'].forEach((c, i) => { ws.getCell(c + '1').value = 2026 + i; });
  ws.getCell('A2').value = 'Income';
  ws.getCell('A2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000C3F' } };
  ws.getCell('A3').value = 'Growth';
  ['B', 'C', 'D'].forEach(c => { const x = ws.getCell(c + '3'); x.value = 0.05; x.numFmt = '0.0%'; x.font = { color: { argb: 'FF0000FF' } }; });
  ws.getCell('A4').value = 'Revenue';
  ['B', 'C', 'D'].forEach((c, i) => { const x = ws.getCell(c + '4'); x.value = i ? { formula: String.fromCharCode(65 + i) + '4*(1+' + c + '3)', result: 100 * Math.pow(1.05, i) } : 100; x.numFmt = '#,##0.0'; });
  ws.getCell('A5').value = 'Total';
  ws.getCell('A5').font = { bold: true };
  ['B', 'C', 'D'].forEach((c, i) => { const x = ws.getCell(c + '5'); x.value = { formula: c + '4*2', result: 200 * Math.pow(1.05, i) }; x.border = { top: { style: 'thin', color: { argb: 'FF000000' } } }; });
  const file = { name: 'look.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
  await X.openExporter(page);
  await importFile(page, file);
  await page.locator('#importOk').click();
  await page.locator('#importReportClose').click();
  const { bytes } = await X.generate(page);
  const out = (await X.readBack(bytes)).getWorksheet('Model');
  const rowOf = (label) => { for(let r = 1; r <= out.rowCount; r++) if(out.getCell('A' + r).value === label) return r; return 0; };
  const title = out.getCell('A' + rowOf('Income'));
  expect(title.font.bold).toBe(true);
  expect(title.font.color.argb).toBe('FFFFFFFF');
  expect(title.fill.fgColor.argb).toBe('FF000C3F');
  const growth = out.getCell('E' + rowOf('Growth'));
  expect(growth.numFmt).toBe('0.0%');
  expect(growth.font.color.argb).toBe('FF0000FF');
  expect(out.getCell('E' + rowOf('Revenue')).numFmt).toBe('#,##0.0');
  const total = out.getCell('F' + rowOf('Total'));
  expect(total.font.bold).toBe(true);
  expect(total.border.top.style).toBe('thin');
  expect(total.border.bottom).toBeUndefined();
});

test('after Generate, the workbook written is recalculated and checked against the original; the report says so too', async ({ page }) => {
  await X.openExporter(page);
  await importFile(page, sample('03-two-sheets.xlsx'));
  await page.locator('#importOk').click();
  await expect(page.locator('#importCheckSummary')).toHaveText('All 45 calculated cells agree with Excel\'s saved values.');
  // Before Generate the report has no round trip.
  await expect(page.locator('#importRoundTrip')).toBeHidden();
  await page.locator('#importReportClose').click();
  await X.generate(page);
  await expect(page.locator('#genStatus .status.ok').last()).toContainText('Recalculated here, the workbook gives the original\'s value in all 45 cells.');
  await X.menuCommand(page, 'btnImportReport');
  await expect(page.locator('#importRoundTrip')).toHaveText('Recalculated here, the workbook gives the original\'s value in all 45 cells.');
  await expect(page.locator('#importRoundTrip')).toHaveClass(/ok/);
  await page.locator('#importReportClose').click();
  // A model that wasn't imported: no round trip.
  await X.menuCommand(page, 'btnMenuSample');
  await X.generate(page);
  await expect(page.locator('#genStatus .status.ok').last()).not.toContainText('Recalculated');
});

test('the .fmide Save for fmIDE writes, opened in ExcelExporter on another computer, brings its Excel layout', async ({ page, browser }, testInfo) => {
  await X.openExporter(page);
  await importFile(page, sample('03-two-sheets.xlsx'));
  await page.locator('#importOk').click();
  const saved = await FM.downloadJson(page, () => page.locator('#importSave').click());
  // A browser with nothing kept (ExcelExporter alone, no fmIDE).
  const context = await browser.newContext();
  const path = require('path'), fs = require('fs');
  await context.route('**/*', (route) => {
    const url = route.request().url();
    const name = url.startsWith(ORIGIN) ? decodeURIComponent(url.slice(ORIGIN.length).split(/[?#]/)[0]) : '';
    if(name === 'ExcelExporter.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(__dirname, '..', 'apps', name)) });
    return route.abort('blockedbyclient');
  });
  const p2 = await context.newPage();
  await X.openExporter(p2);
  const file = testInfo.outputPath(saved.name);
  fs.writeFileSync(file, JSON.stringify(saved.data));
  await p2.setInputFiles('#fileInput', file);
  await expect(p2.locator('#loadStatus .status.ok')).toContainText('Its Excel layout came with it.');
  const { bytes } = await X.generate(p2);
  const calc = (await X.readBack(bytes)).getWorksheet('Calc');
  const column = []; for(let r = 4; r <= calc.rowCount; r++) column.push(String(calc.getCell('A' + r).value || ''));
  expect(column).toEqual(['Profit and loss', '', 'Revenue', 'Fixed costs', 'Variable costs', 'Total costs', 'EBIT', 'Tax', 'Net income', 'Net margin', 'Loss flag']);
  await context.close();
});
