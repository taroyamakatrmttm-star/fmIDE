// 65. Pieces of the apps tested on their own in Node, now that they are modules (step 3c,
// phases 3c-3 and 3c-4): ExcelExporter's built-in Excel writer (src/excel-exporter/js-head/
// 01-xlsx-writer.js, the XLSX global), fmIDE's expression parser for numbers in macros and fm.*
// actions (src/fmide/modules/expression.js) and ExcelExporter's formula building
// (src/excel-exporter/formulas/). No browser, no app: what each takes and gives.
const { test, expect } = require('./helpers/apps');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');
const { evalExpression, readNumber, readBool } = require('../src/fmide/modules/expression.js');
const { compileModel } = require('../src/shared/ir.js');
const FX = require('../src/excel-exporter/formulas/core-translation.js');

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

// ---------- ExcelExporter's formula building ----------
// A small model on one canvas, "Calc": Price × Volume = Revenue; Closing = Closing a period
// before + Revenue (a corkscrew); Big = IF(Volume > Revenue, Revenue, Volume) — the inputs
// of > left to right. Each rectangle has a row on the tab Calc (row 5 on); with no helper
// columns, period 1 is column E.
const rect = (id, text, x, y) => ({ id, type: 'value', text, x, y, w: 120, h: 60 });
const op = (id, text, x, y) => ({ id, type: 'operator', text, x, y, w: 40, h: 40 });
const FORMULA_MODEL = { kind: 'system', version: 9, periods: 3, canvases: [{ id: 'c1', name: 'Calc', nodes: [
  rect('price', 'Price\n10\n$/t', 0, 0), rect('vol', 'Volume\n3\nkt', 0, 100), op('mul', '×', 200, 50), rect('rev', 'Revenue', 300, 50),
  { id: 'sh', type: 'periodShift', shift: -1, x: 100, y: 300, w: 40, h: 40 }, op('add', '+', 200, 300), rect('close', 'Closing', 300, 300),
  op('gt', '>', 200, 200), op('if', 'if', 250, 200), rect('flag', 'Big', 400, 200),
], edges: [
  { id: 'e1', from: 'price', to: 'mul' }, { id: 'e2', from: 'vol', to: 'mul' }, { id: 'e3', from: 'mul', to: 'rev' },
  { id: 'e4', from: 'close', to: 'sh' }, { id: 'e5', from: 'sh', to: 'add' }, { id: 'e6', from: 'rev', to: 'add' }, { id: 'e7', from: 'add', to: 'close' },
  { id: 'e8', from: 'rev', to: 'gt' }, { id: 'e9', from: 'vol', to: 'gt' }, { id: 'e10', from: 'gt', to: 'if', toPort: 0 }, { id: 'e11', from: 'rev', to: 'if', toPort: 1 },
  { id: 'e12', from: 'vol', to: 'if', toPort: 2 }, { id: 'e13', from: 'if', to: 'flag' },
] }] };
const ROWS = ['price', 'vol', 'rev', 'close', 'flag'];
// What each row's cells hold, period by period: a number, or "=" and the formula.
function cells(ids, opts){
  opts = opts || {};
  const cellPos = Object.fromEntries(ids.map((id, i) => ['c1|' + id, { tabName: 'Calc', row: 5 + i }]));
  return Object.fromEntries(ROWS.map(id => [id, [0, 1, 2].map(p => {
    const ctx = Object.assign({ periodCount: 3, cellPos }, opts.ctx);
    const r = FX.buildCellContent('c1', { id }, p, ctx, opts.tab || 'Calc', []);
    return r.isFormula ? '=' + FX.formulaTop(r.formula) : r.value;
  })]));
}

test.describe('ExcelExporter\'s formula building, in Node', () => {
  test.beforeEach(() => { FX.useModelIR(compileModel(FORMULA_MODEL)); FX.useHelperColumns(0); });
  test.afterAll(() => { FX.useModelIR(null); FX.useHelperColumns(0); });

  test('each row\'s cells: typed numbers, formulas by row, a corkscrew\'s first period, an IF', () => {
    expect(cells(ROWS)).toEqual({
      price: [10, 10, 10],
      vol: [3, 3, 3],
      rev: ['=E5*E6', '=F5*F6', '=G5*G6'],
      close: [0, '=E8+F7', '=F8+G7'],               // period 1 would read period 0: its own number, none, so 0
      flag: ['=IF(E6>E7,E7,E6)', '=IF(F6>F7,F7,F6)', '=IF(G6>G7,G7,G6)'],
    });
    const canvas = FORMULA_MODEL.canvases[0];
    expect(ROWS.map(id => FX.classifyNode(canvas, canvas.nodes.find(n => n.id === id)))).toEqual(['input', 'input', 'calc', 'calc', 'output']);
    expect(canvas.nodes.filter(n => n.type !== 'value').map(n => FX.classifyNode(canvas, n))).toEqual([null, null, null, null, null]);
    expect(FX.isInputNode(canvas, canvas.nodes[0])).toBe(true);
  });

  test('another tab\'s rows are read with the tab\'s name; helper columns move the periods along', () => {
    expect(cells(ROWS, { tab: 'Summary' }).rev[0]).toBe("='Calc'!E5*'Calc'!E6");
    FX.useHelperColumns(2);
    expect(cells(ROWS).rev).toEqual(['=G5*G6', '=H5*H6', '=I5*I6']);
    expect(FX.periodCol(0)).toBe(7);
    expect(FX.colLetter(27)).toBe('AA');
  });

  test('a row left out of the layout reads 0 and is reported; a Constant is written into the formula', () => {
    const missing = [];
    const without = cells(['price', 'rev', 'close', 'flag'], { ctx: { onMissingRow: (key) => missing.push(key) } });
    expect(without.rev).toEqual(['=E5*0', '=F5*0', '=G5*0']);
    expect([...new Set(missing)]).toEqual(['c1|vol']);
    const inlined = cells(ROWS, { ctx: { inlineConstantIds: new Set(['c1|price']) } });
    expect(inlined.rev).toEqual(['=10*E6', '=10*F6', '=10*G6']);
  });

  test('sheet names, cells and row keys as the workbook needs them', () => {
    expect(FX.sanitizeSheetName('Q1/Q2: [draft]*?')).toBe('Q1 Q2   draft');
    expect(FX.sanitizeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(FX.sanitizeSheetName('  ')).toBe('Sheet');
    expect(FX.sheetRef('Calc', 'E', 5, 'Calc', false)).toBe('E5');
    expect(FX.sheetRef("O'Brien", 'E', 5, 'Calc', true)).toBe("'O'Brien'!E$5");
    expect(FX.blankCell(null, '0.0')).toEqual({ t: 'z', z: '0.0' });
    expect(FX.textCell('')).toEqual({ t: 'z', z: 'General' });
    expect(FX.textCell('Name', { font: { bold: true } })).toEqual({ t: 's', v: 'Name', s: { font: { bold: true } } });
    expect(FX.pathKey([], 'c1', 'n1')).toBe('c1|n1');
    expect(FX.pathKey([{ canvasId: 'c1', nodeId: 'b1', vIndex: 2 }], 'c2', 'n3')).toBe('c1:b1:v2>>c2|n3');
    expect(FX.mirrorIdFor('c1|n1')).toBe('inp|c1|n1');
  });
});
