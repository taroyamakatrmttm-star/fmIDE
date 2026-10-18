// 80. Importing an Excel model in ExcelExporter (step 20; docs/step20-excel-import.md): the
// page side of the importer. Phase 20d: File → Import Excel model… (and an .xlsx dropped) opens
// the confirm screen — per sheet what was found (tick, header row, period, label and unit
// columns, the rows and their kinds), changing a choice works the sheet out again, a sheet
// without periods is off until given a header row, someone else's text is shown as text, and
// a file that can't be read says why.
const path = require('path');
const JSZip = require('jszip');
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');

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
