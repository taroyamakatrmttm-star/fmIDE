// 78. The sample workbooks for importing an Excel model (step 20, phase 20a;
// docs/step20-excel-import.md): tools/make-import-samples.js writes the same cells again,
// the description in tests/fixtures/excel-import/expected.json fits each workbook, and
// LibreOffice, recalculating a copy written without saved values, gives the values each
// sample saved. Node only (and LibreOffice). Sample 05 (actuals then forecast) was added after
// a real three-statement model was tried; sample 06 (running totals) when they were translated; sample 07
// (number formats kept exactly, each row's `excelFormat` in expected.json) with exact number formats.
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { test, expect, ROOT } = require('./helpers/apps');
const { requireSoffice, recalc, valueOf } = require('./helpers/soffice');
const S = require('../tools/make-import-samples.js');

const DIR = path.join(ROOT, 'tests', 'fixtures', 'excel-import');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(DIR, 'expected.json'), 'utf8'));
const NAMES = Object.keys(S.SAMPLES);

async function open(file){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb;
}
async function openBytes(bytes){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  return wb;
}

// Every cell of a workbook as plain data: value, formula, shared formula, number format.
function cellsOf(wb){
  const out = {};
  wb.eachSheet(ws => ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, c => {
    const v = c.value;
    out[ws.name + '!' + c.address] = {
      value: v instanceof Date ? v.toISOString() : (v && typeof v === 'object' ? { ...v } : v),
      numFmt: c.numFmt || null,
    };
  })));
  return out;
}

const isFormula = (c) => { const v = c.value; return !!(v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)); };
// A formula's saved value (ExcelJS reads a formula whose saved value is 0 as one without one).
const savedValue = (c) => { const v = valueOf(c); return v === undefined ? 0 : v; };
const isNumber = (c) => typeof c.value === 'number' || c.value instanceof Date;
const expandCells = (ref) => {
  const m = /^([A-Z])(\d+)(?::([A-Z])(\d+))?$/.exec(ref);
  const out = [];
  for(let col = m[1].charCodeAt(0); col <= (m[3] || m[1]).charCodeAt(0); col++){
    for(let r = +m[2]; r <= +(m[4] || m[2]); r++) out.push(String.fromCharCode(col) + r);
  }
  return out;
};

test('every sample is in the folder and described, and nothing else is', () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx')).map(f => f.replace(/\.xlsx$/, '')).sort();
  expect(files).toEqual([...NAMES].sort());
  expect(Object.keys(EXPECTED.samples).sort()).toEqual([...NAMES].sort());
});

test('the tool writes the same cells as the samples in the folder', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-import-samples-'));
  try{
    await S.writeAll(dir);
    for(const name of NAMES){
      const fresh = await open(path.join(dir, name + '.xlsx'));
      const kept = await open(path.join(DIR, name + '.xlsx'));
      expect(cellsOf(kept), name).toEqual(cellsOf(fresh));
      expect(kept.worksheets.map(w => w.name), name).toEqual(fresh.worksheets.map(w => w.name));
      expect(kept.definedNames.model, name).toEqual(fresh.definedNames.model);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the description fits each workbook: the periods, the labels and each row\'s kind', async () => {
  for(const name of NAMES){
    const wb = await open(path.join(DIR, name + '.xlsx'));
    const want = EXPECTED.samples[name];
    for(const [sheetName, sheet] of Object.entries(want.sheets)){
      const ws = wb.getWorksheet(sheetName);
      expect(ws, name + ' ' + sheetName).toBeTruthy();
      const where = name + ' ' + sheetName;
      // The header row holds the periods (years, or dates in those years).
      sheet.periodColumns.forEach((col, i) => {
        const v = valueOf(ws.getCell(col + sheet.headerRow));
        const year = v instanceof Date ? String(v.getUTCFullYear()) : String(v);
        expect(year, where + ' ' + col + sheet.headerRow).toBe(sheet.periods[i]);
      });
      const before = String.fromCharCode(sheet.periodColumns[0].charCodeAt(0) - 1);
      for(const r of sheet.rows){
        const at = where + ' row ' + r.row;
        expect(valueOf(ws.getCell(sheet.labelColumn + r.row)), at).toBe(r.label);
        const cells = sheet.periodColumns.map(c => ws.getCell(c + r.row));
        const odd = new Set(r.odd || []);
        if(r.kind === 'title'){
          cells.forEach(c => expect(c.value, at).toBeNull());
          expect(ws.getCell(before + r.row).value, at).toBeNull();
        } else if(r.kind === 'input'){
          cells.forEach(c => expect(isNumber(c), at + ' ' + c.address).toBe(true));
        } else if(r.kind === 'assumption'){
          expect(isNumber(ws.getCell(before + r.row)), at).toBe(true);
          cells.forEach(c => expect(c.value, at).toBeNull());
        } else if(r.kind === 'single'){
          expect(isFormula(ws.getCell(before + r.row)), at).toBe(true);
          cells.forEach(c => expect(c.value, at).toBeNull());
        } else if(r.kind === 'parts'){
          // Each part: typed numbers (or blanks), or formulas.
          const covered = [];
          for(const part of r.parts){
            const [a, b] = part.cells.split(':');
            const cs = cells.filter(c => c.address.replace(/[0-9]+$/, '') >= a && c.address.replace(/[0-9]+$/, '') <= b);
            covered.push(...cs);
            cs.forEach(c => expect(part.is === 'typed' ? (isNumber(c) || c.value === null) : isFormula(c), at + ' ' + c.address).toBe(true));
          }
          expect(covered.length, at).toBe(cells.length);
        } else if(r.kind === 'opening'){
          expect(isNumber(cells[0]), at).toBe(true);
          cells.slice(1).forEach(c => expect(isFormula(c), at + ' ' + c.address).toBe(true));
        } else {
          expect(r.kind, at).toBe('calculation');
          cells.forEach(c => expect(odd.has(c.address) ? isNumber(c) : isFormula(c), at + ' ' + c.address).toBe(true));
        }
      }
      // A named cell is where the description says.
      for(const r of sheet.rows.filter(x => x.name)){
        expect(wb.definedNames.getRanges(r.name).ranges, name + ' ' + r.name).toEqual([sheetName + '!$' + before + '$' + r.row]);
      }
    }
    // Each formula saves a number; each cell not translated holds the function named.
    wb.eachSheet(ws => ws.eachRow(row => row.eachCell(c => {
      if(isFormula(c)) expect(typeof savedValue(c), name + ' ' + ws.name + '!' + c.address).toBe('number');
    })));
    for(const n of want.notTranslated){
      for(const a of expandCells(n.cells)){
        const c = wb.getWorksheet(n.sheet).getCell(a);
        expect(isFormula(c), name + ' ' + a).toBe(true);
        if(/^[A-Z]+$/.test(n.why)) expect(c.formula || wb.getWorksheet(n.sheet).getCell(c.value.sharedFormula).formula, name + ' ' + a).toContain(n.why + '(');
      }
    }
  }
});

test('LibreOffice, recalculating the samples written without saved values, gives the saved values', async () => {
  requireSoffice(test);
  const books = {};
  for(const name of NAMES) books[name] = Buffer.from(await S.build(name, { results: false }).xlsx.writeBuffer());
  const out = recalc(books);
  for(const name of NAMES){
    const kept = await open(path.join(DIR, name + '.xlsx'));
    const calc = await openBytes(out[name]);
    let formulas = 0;
    kept.eachSheet(ws => ws.eachRow(row => row.eachCell(c => {
      if(!isFormula(c)) return;
      formulas++;
      const saved = savedValue(c), g = savedValue(calc.getWorksheet(ws.name).getCell(c.address));
      const at = name + ' ' + ws.name + '!' + c.address;
      expect(typeof g, at).toBe('number');
      expect(Math.abs(g - saved), at + ': ' + g + ' against ' + saved).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(saved)));
    })));
    expect(formulas, name).toBeGreaterThan(5);
  }
});
