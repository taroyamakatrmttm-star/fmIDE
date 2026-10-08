// 65. Pieces of the apps tested on their own in Node, now that they are modules (step 3c,
// phase 3c-3): ExcelExporter's built-in Excel writer (src/excel-exporter/js-head/01-xlsx-writer.js,
// the XLSX global) and fmIDE's expression parser for numbers in macros and fm.* actions
// (src/fmide/modules/expression.js). No browser, no app: what each takes and gives.
const { test, expect } = require('./helpers/apps');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');
const { evalExpression, readNumber, readBool } = require('../src/fmide/modules/expression.js');

// ---------- the Excel writer ----------
// A small workbook using what ExcelExporter writes: text, numbers, formulas (with a text
// result too), an empty cell kept for its format, number formats, fonts, fills, borders,
// alignment, column widths and merged cells.
function sampleWorkbook(){
  const wb = XLSX.utils.book_new();
  const bold = { font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
    border: { bottom: { style: 'thin', color: { rgb: '93C5FD' } } }, alignment: { horizontal: 'center', wrapText: true } };
  XLSX.utils.book_append_sheet(wb, {
    A1: { t: 's', v: 'Revenue', s: bold },
    B1: { t: 'n', v: 1500.5, z: '#,##0.00' },
    C1: { t: 'n', v: 0.25, z: '0%' },
    A2: { t: 's', v: 'Total' },
    B2: { t: 'n', f: '=B1*2' },
    C2: { t: 's', f: 'IF(B1>0,"up","down")' },
    D2: { t: 'z', s: bold },
    A3: { t: 'b', v: true },
    '!ref': 'A1:D3',
    '!cols': [{ wch: 20 }, { wch: 12 }],
    '!merges': [{ s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }],
  }, 'Inputs');
  XLSX.utils.book_append_sheet(wb, { A1: { t: 'n', f: "Inputs!B1+1" } }, 'Calc (1)');
  return wb;
}

test.describe('the Excel writer, in Node', () => {
  test('a workbook ExcelJS reads back: sheets, values, formulas, formats, styles, widths, merges', async () => {
    const bytes = XLSX.write(sampleWorkbook());
    expect(bytes).toBeInstanceOf(Uint8Array);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    expect(book.worksheets.map(s => s.name)).toEqual(['Inputs', 'Calc (1)']);
    const ws = book.getWorksheet('Inputs');
    expect(ws.getCell('A1').value).toBe('Revenue');
    expect(ws.getCell('B1').value).toBe(1500.5);
    expect(ws.getCell('B1').numFmt).toBe('#,##0.00');
    expect(ws.getCell('C1').numFmt).toBe('0%');
    expect(ws.getCell('B2').value).toEqual({ formula: 'B1*2' });            // the leading = left out
    expect(ws.getCell('C2').value).toEqual({ formula: 'IF(B1>0,"up","down")' });
    expect(ws.getCell('A3').value).toBe(true);
    const a1 = ws.getCell('A1');
    expect(a1.font).toMatchObject({ bold: true, size: 14, color: { argb: 'FF1E3A8A' } });
    expect(a1.fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } });
    expect(a1.border.bottom).toMatchObject({ style: 'thin', color: { argb: 'FF93C5FD' } });
    expect(a1.alignment).toMatchObject({ horizontal: 'center', wrapText: true });
    expect(ws.getCell('D2').fill).toMatchObject({ pattern: 'solid' });       // an empty cell keeps its format
    expect(ws.getColumn(1).width).toBeCloseTo(20.71, 2);
    expect(ws.model.merges).toEqual(['B3:D3']);
    expect(book.getWorksheet('Calc (1)').getCell('A1').value).toEqual({ formula: 'Inputs!B1+1' });
  });

  test('a standard ZIP whose entries pass their checksums, and a workbook that asks Excel to recalculate', async () => {
    const zip = await JSZip.loadAsync(XLSX.write(sampleWorkbook()), { checkCRC32: true });
    expect(Object.keys(zip.files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']);
    const workbook = await zip.file('xl/workbook.xml').async('string');
    expect(workbook).toContain('fullCalcOnLoad="1"');
    // Formulas carry no cached value, so no app shows a stale number.
    expect(await zip.file('xl/worksheets/sheet1.xml').async('string')).toContain('<c r="B2"><f>B1*2</f></c>');
  });

  test('text from a file is escaped, and characters XML forbids are dropped', async () => {
    const wb = XLSX.utils.book_new();
    const name = '<b>"x" & \'y\'';
    XLSX.utils.book_append_sheet(wb, { A1: { t: 's', v: name + '\u0001\u0008end' }, A2: { t: 's', v: '</t></is></c><c r="Z9"><v>1</v></c>' } }, 'S&<>');
    const bytes = XLSX.write(wb);
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    expect(sheet).not.toContain('<b>');
    expect(sheet).not.toContain('Z9"><v>');
    expect(sheet).not.toMatch(/[\u0001\u0008]/);
    expect(await zip.file('xl/workbook.xml').async('string')).toContain('name="S&amp;&lt;&gt;"');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    const ws = book.getWorksheet('S&<>');
    expect(ws.getCell('A1').value).toBe(name + 'end');
    expect(ws.getCell('A2').value).toBe('</t></is></c><c r="Z9"><v>1</v></c>');
    expect(ws.getCell('Z9').value).toBe(null);
  });

  test('what it leaves out: odd addresses, numbers that are not finite, blank text; a workbook needs a sheet', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, { A1: { t: 'n', v: Infinity }, B1: { t: 'n', v: NaN }, C1: { t: 's', v: '' },
      'a1': { t: 's', v: 'lower case' }, 'AAAA1': { t: 's', v: 'four letters' }, D1: { t: 'n', v: 7 } }, 'S');
    const sheet = await (await JSZip.loadAsync(XLSX.write(wb))).file('xl/worksheets/sheet1.xml').async('string');
    expect(sheet.match(/<c r="/g)).toEqual(['<c r="']);
    expect(sheet).toContain('<c r="D1"><v>7</v></c>');
    expect(sheet).toContain('<dimension ref="A1:D1"/>');
    expect(() => XLSX.write(XLSX.utils.book_new())).toThrow('The workbook has no sheets.');
  });
});

// ---------- the expression parser ----------
// fmIDE gives it the macro's variables and its way to stop; here, a few variables and errors.
const VARS = { $x: 4, $half: '0.5', $name: 'Revenue', '$list[2]': 10 };
const env = {
  lookupVar: (token) => { if(token in VARS) return VARS[token]; throw new Error('Variable ' + token + ' has no value yet.'); },
  fail: (message) => { throw new Error(message); },
};
const calc = (s) => evalExpression(s, env);

test.describe('the expression parser, in Node', () => {
  test('numbers, the four operations and %, brackets, signs, in the usual order', () => {
    expect(calc('1 + 2 * 3')).toBe(7);
    expect(calc('(1 + 2) * 3')).toBe(9);
    expect(calc('10 - 4 - 3')).toBe(3);                 // from the left
    expect(calc('2 * 3 / 4')).toBe(1.5);
    expect(calc('17 % 5')).toBe(2);
    expect(calc('-3 + +2')).toBe(-1);
    expect(calc('- -2')).toBe(2);
    expect(calc(' 1.5e3 ')).toBe(1500);
    expect(calc('.5 + 1.')).toBe(1.5);
    expect(calc('1 / 0')).toBe(Infinity);              // readNumber refuses it, below
  });

  test('min, max, round, floor, ceil and abs, in any case, with one argument or more', () => {
    expect(calc('min(3, 1, 2)')).toBe(1);
    expect(calc('MAX(3, 1 + 9, 2)')).toBe(10);
    expect(calc('round(2.5)')).toBe(3);
    expect(calc('Floor(-1.5) + ceil(1.2)')).toBe(0);
    expect(calc('abs(-7) * 2')).toBe(14);
    expect(calc('max (1, 2)')).toBe(2);
  });

  test('variables: numbers, number text, a list item; anything else is said plainly', () => {
    expect(calc('$x * 2')).toBe(8);
    expect(calc('$half + 1')).toBe(1.5);
    expect(calc('$list[2] / $x')).toBe(2.5);
    expect(() => calc('$name + 1')).toThrow('$name is not a number (it is "Revenue").');
    expect(() => calc('$nope')).toThrow('Variable $nope has no value yet.');
    expect(() => calc('$')).toThrow('Bad variable in "$".');
  });

  test('what it can\'t read, it says where; it never runs the text as code', () => {
    expect(() => calc('2 + (3')).toThrow('Missing ")" in "2 + (3".');
    expect(() => calc('max(1, 2')).toThrow('Missing ")" in "max(1, 2".');
    expect(() => calc('1 + 2 x')).toThrow('Unexpected "x" in "1 + 2 x".');
    expect(() => calc('')).toThrow('Could not read the number or expression "".');
    for(const hostile of ['alert(1)', 'constructor', 'process.exit(1)', 'Math.random()', '1;2', '[1]', '`x`', 'sqrt(4)']){
      expect(() => calc(hostile), hostile).toThrow(/Could not read the number or expression|Unexpected/);
    }
  });

  test('readNumber: a number as it is, true and false as 1 and 0, text read as a number or an expression', () => {
    expect(readNumber(12.5, 'Value', env)).toBe(12.5);
    expect(readNumber(true, 'Value', env)).toBe(1);
    expect(readNumber(false, 'Value', env)).toBe(0);
    expect(readNumber(' -3.5e2 ', 'Value', env)).toBe(-350);
    expect(readNumber('$x + 1', 'Value', env)).toBe(5);
    expect(() => readNumber(Infinity, 'Value', env)).toThrow('Value is not a finite number.');
    expect(() => readNumber('1/0', 'Count', env)).toThrow('Count is not a finite number.');
    expect(() => readNumber('  ', 'Period', env)).toThrow('Period is empty.');
  });

  test('readBool: the words for yes and no, anything else said plainly', () => {
    for(const yes of [true, 'true', 'Yes', 'y', '1', 'ON', 1]) expect(readBool(yes, env), String(yes)).toBe(true);
    for(const no of [false, 'false', 'No', 'n', '0', 'off', '', 0]) expect(readBool(no, env), String(no)).toBe(false);
    expect(() => readBool('maybe', env)).toThrow('"maybe" is not true/false.');
  });
});
