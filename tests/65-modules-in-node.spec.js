// 65. Pieces of the apps tested on their own in Node, now that they are modules (step 3c,
// phases 3c-3 and 3c-4): ExcelExporter's built-in Excel writer (src/excel-exporter/js-head/
// 01-xlsx-writer.js, the XLSX global), fmIDE's expression parser for numbers in macros and fm.*
// actions (src/fmide/modules/expression.js) and ExcelExporter's formula building
// (src/excel-exporter/formulas/). No browser, no app: what each takes and gives. The writer's
// form controls and stacked charts (step 19, phase B0) are also opened in LibreOffice.
const { test, expect } = require('./helpers/apps');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');
const { evalExpression, readNumber, readBool } = require('../src/fmide/modules/expression.js');
const { compileModel } = require('../src/shared/ir.js');
const FX = require('../src/excel-exporter/formulas/core-translation.js');
const { SaxesParser } = require('saxes');
const fs = require('fs');
const path = require('path');
const { requireSoffice, recalc, valueOf } = require('./helpers/soffice');

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

  test('an Excel Data Table (step 16): its definition on the top-left cell, values in the rest; a bad one is no table', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, {
      C6: { t: 'n', v: 0 }, C7: { t: 'n', v: 0 }, M15: { t: 'n', f: 'C6*10+C7' },
      N15: { t: 'n', v: 1 }, O15: { t: 'n', v: 2 }, M16: { t: 'n', v: 1 },
      N16: { t: 'n', v: 11, dataTable: { ref: 'N16:O16', r1: 'C7', r2: 'C6' } }, O16: { t: 'n', v: 12 },
      P1: { t: 'n', v: 5, dataTable: { ref: 'P1:P2', r1: 'C6' } },
      Q1: { t: 'n', v: 6, dataTable: { ref: 'Q1:R1', r1: 'C6', row: true } },
      S1: { t: 'n', v: 7, dataTable: { ref: 'S1:S2"/><x y="', r1: 'C6' } },
      T1: { t: 'n', v: 8, dataTable: { ref: 'T1:T2', r1: 'C6', r2: 'c7' } },
    }, 'S');
    const bytes = XLSX.write(wb);
    const sheet = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
    expect(sheet).toContain('<c r="N16"><f t="dataTable" ref="N16:O16" dt2D="1" dtr="1" r1="C7" r2="C6"/><v>11</v></c>');
    expect(sheet).toContain('<c r="O16"><v>12</v></c>');
    expect(sheet).toContain('<c r="P1"><f t="dataTable" ref="P1:P2" r1="C6"/><v>5</v></c>');
    expect(sheet).toContain('<c r="Q1"><f t="dataTable" ref="Q1:R1" dtr="1" r1="C6"/><v>6</v></c>');
    // Not shaped like a table: a plain number.
    expect(sheet).toContain('<c r="S1"><v>7</v></c>');
    expect(sheet).toContain('<c r="T1"><v>8</v></c>');
    expect(sheet.match(/dataTable/g)).toHaveLength(3);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    expect(book.getWorksheet('S').getCell('O16').value).toBe(12);
  });

  test('charts (step 16): on a worksheet between two cells, and on a chart tab; text escaped, odd references dropped', async () => {
    const wb = XLSX.utils.book_new();
    const bar = { type: 'bar', title: { ref: "'S 1'!$A$1", text: 'T <&>' }, bar: { dir: 'bar', overlap: 100, gapWidth: 40 },
      catAxis: { reverse: true }, valAxis: { title: 'Change', numFmt: '#,##0' }, legend: 'b',
      series: [{ name: { ref: "'S 1'!$B$1", text: 'Low' }, cat: { ref: "'S 1'!$A$2:$A$3", values: ['a', 'b'] },
        val: { ref: "'S 1'!$B$2:$B$3", values: [-5, null] }, color: 'C0504D' }] };
    const line = { type: 'line', title: 'Spider', legend: 'r',
      series: [{ name: { ref: 'not a ref', text: 'x' }, cat: { ref: "S!A1:B1')", values: [-1, 1] }, val: { values: [1, 2] }, color: 'nothex' }] };
    XLSX.utils.book_append_sheet(wb, { A1: { t: 's', v: 'T' }, '!charts': [{ chart: bar, from: { c: 3, r: 0 }, to: { c: 9, r: 15 } }] }, 'S 1');
    XLSX.utils.book_append_chartsheet(wb, line, 'Spider');
    const bytes = XLSX.write(wb);
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    const part = (p) => zip.file(p).async('string');
    expect(Object.keys(zip.files).filter(k => !zip.files[k].dir).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'docProps/core.xml',
      'xl/_rels/workbook.xml.rels', 'xl/charts/chart1.xml', 'xl/charts/chart2.xml', 'xl/chartsheets/_rels/sheet1.xml.rels', 'xl/chartsheets/sheet1.xml',
      'xl/drawings/_rels/drawing1.xml.rels', 'xl/drawings/_rels/drawing2.xml.rels', 'xl/drawings/drawing1.xml', 'xl/drawings/drawing2.xml',
      'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/_rels/sheet1.xml.rels', 'xl/worksheets/sheet1.xml'].sort());
    expect(await part('xl/worksheets/sheet1.xml')).toContain('<drawing r:id="rId1"/></worksheet>');
    const d1 = await part('xl/drawings/drawing1.xml');
    expect(d1).toContain('<xdr:from><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row>');
    expect(await part('xl/drawings/drawing2.xml')).toContain('<xdr:absoluteAnchor>');
    const c1 = await part('xl/charts/chart1.xml');
    expect(c1).toContain("<c:f>'S 1'!$A$1</c:f>");
    expect(c1).toContain('<c:v>T &lt;&amp;&gt;</c:v>');
    expect(c1).toContain('<c:barDir val="bar"/><c:grouping val="clustered"/>');
    expect(c1).toContain('<c:ptCount val="2"/><c:pt idx="0"><c:v>-5</c:v></c:pt></c:numCache>'); // the empty point left out
    expect(c1).toContain('<a:srgbClr val="C0504D"/>');
    expect(c1).toContain('<c:crosses val="max"/>');
    const c2 = await part('xl/charts/chart2.xml');
    expect(c2).toContain('<c:lineChart>');
    expect(c2).not.toContain('<c:f>'); // no reference shaped like one: the values stand alone
    expect(c2).toContain('<c:numLit>');
    expect(c2).not.toContain('srgbClr');
    expect(await part('xl/_rels/workbook.xml.rels')).toContain('relationships/chartsheet" Target="chartsheets/sheet1.xml"');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    expect(book.getWorksheet('S 1').getCell('A1').value).toBe('T');
  });
});

// ---------- the writer's form controls and stacked charts (step 19, phase B0) ----------
// A Dashboard as step 19 will write one: a scroll bar and a check box with their linked cells,
// a formula using them, a stacked column chart and a waterfall with an invisible base — charts
// and controls on one sheet — plus a second sheet with a control of its own.
function dashboardWorkbook(){
  const wb = XLSX.utils.book_new();
  const ref = (r) => "'Dash board'!" + r;
  const steps = { ref: ref('$B$8:$D$8'), values: ['Start', 'Rise', 'End'] };
  const stacked = { type: 'bar', title: 'Parts', bar: { dir: 'col', grouping: 'stacked', overlap: 0, gapWidth: 60 }, legend: 'b',
    series: [{ name: { text: 'A' }, cat: steps, val: { ref: ref('$B$9:$D$9'), values: [1, 2, 3] }, color: '2563EB' },
      { name: { text: 'B' }, cat: steps, val: { ref: ref('$B$10:$D$10'), values: [3, 2, 1] }, color: 'F59E0B' }] };
  const waterfall = { type: 'bar', title: 'Flow', bar: { dir: 'col', grouping: 'stacked' }, legend: 'b',
    series: [{ name: { text: 'Base' }, cat: steps, val: { ref: ref('$B$11:$D$11'), values: [0, 10, 0] }, noFill: true, color: '000000' },
      { name: { text: 'Step' }, cat: steps, val: { ref: ref('$B$12:$D$12'), values: [10, 5, 15] }, color: '16A34A' }] };
  XLSX.utils.book_append_sheet(wb, {
    A1: { t: 's', v: 'Price' }, B1: { t: 'z' }, C1: { t: 'n', v: 40 }, D1: { t: 'n', f: '10+C1*0.5' },
    A2: { t: 's', v: 'Use' }, C2: { t: 'b', v: false }, D2: { t: 'n', f: 'IF(C2,D1*2,D1)' },
    B8: { t: 's', v: 'Start' }, C8: { t: 's', v: 'Rise' }, D8: { t: 's', v: 'End' },
    B9: { t: 'n', v: 1 }, C9: { t: 'n', v: 2 }, D9: { t: 'n', v: 3 }, B10: { t: 'n', v: 3 }, C10: { t: 'n', v: 2 }, D10: { t: 'n', v: 1 },
    B11: { t: 'n', v: 0 }, C11: { t: 'n', f: 'B12' }, D11: { t: 'n', v: 0 }, B12: { t: 'n', v: 10 }, C12: { t: 'n', v: 5 }, D12: { t: 'n', f: 'B12+C12' },
    '!charts': [{ chart: stacked, from: { c: 5, r: 0 }, to: { c: 11, r: 14 } }, { chart: waterfall, from: { c: 12, r: 0 }, to: { c: 18, r: 14 } }],
    '!controls': [
      { type: 'scroll', from: { c: 1, r: 0 }, to: { c: 3, r: 1 }, cell: '$C$1', min: 0, max: 100, inc: 1, page: 10, val: 40, horiz: true },
      { type: 'check', from: { c: 1, r: 1 }, to: { c: 2, r: 2 }, cell: 'C2', text: 'Use <this> & that' },
    ],
  }, 'Dash board');
  XLSX.utils.book_append_sheet(wb, { A1: { t: 'n', v: 3 }, '!controls': [{ type: 'scroll', from: { c: 1, r: 0 }, to: { c: 2, r: 5 }, cell: 'A1', max: 9 }] }, 'Other');
  return wb;
}
// Every XML part parsed by a strict, namespace-aware parser: well formed, every prefix bound.
function wellFormed(name, xml){
  const parser = new SaxesParser({ xmlns: true });
  let error = null;
  parser.on('error', (e) => { if(!error) error = e; });
  parser.write(xml).close();
  if(error) throw new Error(name + ' is not well formed: ' + error.message);
}
// A part's relationships: [{ id, type, target }], targets resolved against the part's folder.
function relsOf(xml, relsPath){
  const base = path.posix.dirname(path.posix.dirname(relsPath)); // xl/worksheets/_rels/x.rels -> xl/worksheets
  return [...xml.matchAll(/<Relationship Id="([^"]+)" Type="([^"]+)" Target="([^"]+)"\/>/g)]
    .map(([, id, type, target]) => ({ id, type: type.replace(/^.*\//, ''), target: path.posix.normalize(path.posix.join(base, target)) }));
}

test.describe('the Excel writer\'s form controls and stacked charts (step 19), in Node', () => {
  test('a sheet with charts and controls: every part there, every part well formed, rels and content types matching', async () => {
    const zip = await JSZip.loadAsync(XLSX.write(dashboardWorkbook()), { checkCRC32: true });
    const files = Object.keys(zip.files).filter(k => !zip.files[k].dir);
    const part = (p) => zip.file(p).async('string');
    expect(files).toEqual(expect.arrayContaining(['xl/drawings/drawing1.xml', 'xl/drawings/drawing2.xml', 'xl/charts/chart1.xml', 'xl/charts/chart2.xml',
      'xl/drawings/vmlDrawing1.vml', 'xl/drawings/vmlDrawing2.vml', 'xl/ctrlProps/ctrlProp1.xml', 'xl/ctrlProps/ctrlProp2.xml', 'xl/ctrlProps/ctrlProp3.xml',
      'xl/worksheets/_rels/sheet1.xml.rels', 'xl/worksheets/_rels/sheet2.xml.rels']));
    for(const f of files) if(/\.(xml|rels|vml)$/.test(f)) wellFormed(f, await part(f));
    // Every relationship's target exists, and every part has a content type (an Override, or
    // a Default for its extension); every Override names a part that exists.
    const types = await part('[Content_Types].xml');
    const overrides = new Map([...types.matchAll(/<Override PartName="\/([^"]+)" ContentType="([^"]+)"\/>/g)].map(m => [m[1], m[2]]));
    const defaults = new Map([...types.matchAll(/<Default Extension="([^"]+)" ContentType="([^"]+)"\/>/g)].map(m => [m[1], m[2]]));
    for(const f of files) expect(overrides.get(f) || defaults.get(f.replace(/^.*\./, '')), f).toBeTruthy();
    for(const o of overrides.keys()) expect(files, o).toContain(o);
    expect(defaults.get('vml')).toBe('application/vnd.openxmlformats-officedocument.vmlDrawing');
    expect(overrides.get('xl/ctrlProps/ctrlProp1.xml')).toBe('application/vnd.ms-excel.controlproperties+xml');
    for(const r of files.filter(f => f.endsWith('.rels'))){
      const rels = relsOf(await part(r), r);
      expect(rels.length, r).toBeGreaterThan(0);
      for(const rel of rels) expect(files, r + ' → ' + rel.target).toContain(rel.target);
    }
    // The sheet: the charts' drawing, the VML drawing and each control by the ids its rels give.
    const sheet = await part('xl/worksheets/sheet1.xml');
    const rels = relsOf(await part('xl/worksheets/_rels/sheet1.xml.rels'), 'xl/worksheets/_rels/sheet1.xml.rels');
    expect(rels).toEqual([
      { id: 'rId1', type: 'drawing', target: 'xl/drawings/drawing1.xml' },
      { id: 'rId2', type: 'vmlDrawing', target: 'xl/drawings/vmlDrawing1.vml' },
      { id: 'rId3', type: 'ctrlProp', target: 'xl/ctrlProps/ctrlProp1.xml' },
      { id: 'rId4', type: 'ctrlProp', target: 'xl/ctrlProps/ctrlProp2.xml' }]);
    // The controls list in an x14 choice, as Excel writes it (the iPad's Excel reports a damaged file otherwise).
    expect(sheet).toMatch(/<drawing r:id="rId1"\/><legacyDrawing r:id="rId2"\/><mc:AlternateContent><mc:Choice Requires="x14"><controls>.*<\/controls><\/mc:Choice><\/mc:AlternateContent><\/worksheet>$/);
    expect(sheet).toContain('<mc:AlternateContent><mc:Choice Requires="x14"><control shapeId="1025" r:id="rId3" name="Scroll Bar 1"><controlPr defaultSize="0" autoPict="0">' +
      '<anchor moveWithCells="1"><from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></from>');
    expect(sheet).toContain('<control shapeId="1026" r:id="rId4" name="Check Box 2">');
    // Each control is also a hidden shape in the sheet's drawing, beside its charts, tied to its VML
    // shape (a14:compatExt), as Excel writes it: the iPad's Excel reports a damaged file without it
    // (the owner, 16 October 2026).
    const d1 = await part('xl/drawings/drawing1.xml');
    expect((d1.match(/<xdr:graphicFrame /g) || []).length).toBe(2);
    expect(d1).toContain('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">' +
      '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>');
    expect(d1).toContain('<xdr:cNvPr id="1025" name="Scroll Bar 1" hidden="1"><a:extLst><a:ext uri="{63B3BB69-23CF-44E3-9099-C40C66FF867C}"><a14:compatExt spid="_x0000_s1025"/>');
    expect(d1).toContain('<xdr:cNvPr id="1026" name="Check Box 2" hidden="1">');
    // The second sheet: no charts, but a drawing for its control (rId1), then its VML (rId2); its
    // shapes numbered in their own block. Its drawing has no rels (no charts).
    expect(await part('xl/worksheets/sheet2.xml')).toContain('<drawing r:id="rId1"/><legacyDrawing r:id="rId2"/><mc:AlternateContent><mc:Choice Requires="x14"><controls><mc:AlternateContent><mc:Choice Requires="x14"><control shapeId="2049" r:id="rId3"');
    expect(await part('xl/drawings/drawing2.xml')).toContain('<xdr:cNvPr id="2049" name="Scroll Bar 1" hidden="1"><a:extLst><a:ext uri="{63B3BB69-23CF-44E3-9099-C40C66FF867C}"><a14:compatExt spid="_x0000_s2049"/>');
    expect(files).not.toContain('xl/drawings/_rels/drawing2.xml.rels');
    expect(await part('xl/drawings/vmlDrawing2.vml')).toContain('<o:idmap v:ext="edit" data="2"/>');
  });

  test('what each control holds: the scroll bar\'s range and link, the check box\'s link and label, in both its parts', async () => {
    const zip = await JSZip.loadAsync(XLSX.write(dashboardWorkbook()));
    const part = (p) => zip.file(p).async('string');
    expect(await part('xl/ctrlProps/ctrlProp1.xml')).toContain('<formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" objectType="Scroll" dx="22" fmlaLink="$C$1" horiz="1" inc="1" max="100" min="0" page="10" val="40"/>');
    expect(await part('xl/ctrlProps/ctrlProp2.xml')).toContain('objectType="CheckBox" fmlaLink="C2" lockText="1" noThreeD="1"/>');
    expect(await part('xl/ctrlProps/ctrlProp3.xml')).toContain('fmlaLink="A1" inc="1" max="9" min="0" page="10" val="0"/>'); // defaults; upright
    const vml = await part('xl/drawings/vmlDrawing1.vml');
    expect(vml).toContain('<v:shape id="_x0000_s1025" type="#_x0000_t201"');
    expect(vml).toContain('<x:ClientData ObjectType="Scroll"><x:Anchor>1, 0, 0, 0, 3, 0, 1, 0</x:Anchor>');
    expect(vml).toContain('<x:FmlaLink>$C$1</x:FmlaLink><x:Val>40</x:Val><x:Min>0</x:Min><x:Max>100</x:Max><x:Inc>1</x:Inc><x:Page>10</x:Page><x:Horiz/>');
    expect(vml).toContain('<x:ClientData ObjectType="Checkbox">');
    expect(vml).toContain('<div style="text-align:left">Use &lt;this&gt; &amp; that</div>'); // the label escaped
  });

  test('controls checked: odd links left out, numbers kept to Excel\'s 0–30,000, names and links escaped', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, { A1: { t: 'n', v: 1 }, '!controls': [
      { type: 'scroll', cell: '"/><evil/>', from: { c: 0, r: 0 }, to: { c: 1, r: 1 } },
      { type: 'button', cell: 'A1' }, null, { type: 'check' },
      { type: 'scroll', cell: "'It''s <&>'!$A$1", from: { c: -5, r: 'x' }, to: { c: 2, r: 3 }, min: -10, max: 99999, inc: 0, page: 1e9, val: 'x', horiz: 'yes' },
      { type: 'check', cell: '$B$2', checked: true, text: '</div></v:textbox><x:evil/>' },
    ] }, 'S');
    const zip = await JSZip.loadAsync(XLSX.write(wb));
    const files = Object.keys(zip.files);
    expect(files.filter(f => f.startsWith('xl/ctrlProps/') && !zip.files[f].dir)).toEqual(['xl/ctrlProps/ctrlProp1.xml', 'xl/ctrlProps/ctrlProp2.xml']);
    const all = await Promise.all(files.filter(f => !zip.files[f].dir).map(async f => { const x = await zip.file(f).async('string'); if(/\.(xml|rels|vml)$/.test(f)) wellFormed(f, x); return x; }));
    expect(all.join('')).not.toContain('<evil');
    expect(all.join('')).not.toContain('<x:evil');
    const p1 = await zip.file('xl/ctrlProps/ctrlProp1.xml').async('string');
    expect(p1).toContain('fmlaLink="\'It\'\'s &lt;&amp;&gt;\'!$A$1" inc="1" max="30000" min="0" page="30000" val="0"/>'); // not sideways: horiz must be true
    expect(await zip.file('xl/ctrlProps/ctrlProp2.xml').async('string')).toContain('objectType="CheckBox" checked="Checked" fmlaLink="$B$2"');
    const vml = await zip.file('xl/drawings/vmlDrawing1.vml').async('string');
    expect(vml).toContain('<x:Anchor>0, 0, 0, 0, 2, 0, 3, 0</x:Anchor>'); // a bad corner taken as A1
    expect(vml).toContain('<x:Anchor>0, 0, 0, 0, 1, 0, 1, 0</x:Anchor>'); // no corners: one cell, A1
    expect(vml).toContain('<x:Checked>1</x:Checked>');
    // A sheet without controls is written as before: no VML, no extra namespaces.
    const plain = await (await JSZip.loadAsync(XLSX.write(sampleWorkbook()))).file('xl/worksheets/sheet1.xml').async('string');
    expect(plain).not.toContain('legacyDrawing');
    expect(plain).not.toContain('xmlns:mc');
  });

  test('a control is always at least one cell wide and tall (a corner not past the start drew nothing in Excel)', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, { A1: { t: 'n', v: 3 }, '!controls': [
      { type: 'scroll', from: { c: 1, r: 0 }, to: { c: 1, r: 4 }, cell: 'A1' },   // 0 wide: B1 to B1's own left edge
      { type: 'check', from: { c: 3, r: 6 }, to: { c: 5, r: 6 }, cell: 'A2' },    // 0 tall
      { type: 'scroll', from: { c: 4, r: 9 }, to: { c: 2, r: 3 }, cell: 'A3' },   // before its start
      { type: 'scroll', from: { c: 16383, r: 1048575 }, cell: 'A4' },             // the sheet's last cell
    ] }, 'S');
    const zip = await JSZip.loadAsync(XLSX.write(wb));
    const vml = await zip.file('xl/drawings/vmlDrawing1.vml').async('string');
    expect([...vml.matchAll(/<x:Anchor>([^<]+)<\/x:Anchor>/g)].map(m => m[1])).toEqual([
      '1, 0, 0, 0, 2, 0, 4, 0', '3, 0, 6, 0, 5, 0, 7, 0', '4, 0, 9, 0, 5, 0, 10, 0', '16383, 0, 1048575, 0, 16384, 0, 1048576, 0']);
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    expect(sheet).toContain('<to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row>'); // both parts alike
  });

  test('stacked bars overlap fully; percent-stacked too; a series drawing nothing has no legend entry', async () => {
    const zip = await JSZip.loadAsync(XLSX.write(dashboardWorkbook()));
    const stacked = await zip.file('xl/charts/chart1.xml').async('string');
    expect(stacked).toContain('<c:barDir val="col"/><c:grouping val="stacked"/>');
    expect(stacked).toContain('<c:gapWidth val="60"/><c:overlap val="100"/>'); // 0 asked; stacked bars need 100
    expect(stacked).not.toContain('noFill');
    const waterfall = await zip.file('xl/charts/chart2.xml').async('string');
    expect(waterfall).toContain('<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>');
    expect(waterfall).not.toContain('<a:srgbClr val="000000"/>'); // its colour ignored
    expect(waterfall).toContain('<c:legendPos val="b"/><c:legendEntry><c:idx val="0"/><c:delete val="1"/></c:legendEntry><c:overlay val="0"/>');
    const wb = XLSX.utils.book_new();
    const pct = (grouping) => ({ type: 'bar', bar: { dir: 'col', grouping, overlap: -20 }, series: [{ val: { values: [1] } }] });
    XLSX.utils.book_append_sheet(wb, { '!charts': [{ chart: pct('percentStacked') }, { chart: pct('sideways') }] }, 'S');
    const z2 = await JSZip.loadAsync(XLSX.write(wb));
    const c1 = await z2.file('xl/charts/chart1.xml').async('string'), c2 = await z2.file('xl/charts/chart2.xml').async('string');
    expect(c1).toContain('<c:grouping val="percentStacked"/>');
    expect(c1).toContain('<c:overlap val="100"/>');
    expect(c2).toContain('<c:grouping val="clustered"/>'); // anything else: clustered, its own overlap
    expect(c2).toContain('<c:overlap val="-20"/>');
  });

  test('ExcelJS reads it back, and LibreOffice opens it and recalculates (the sample for desktop Excel is kept in tests/output)', async ({}, testInfo) => {
    const bytes = XLSX.write(dashboardWorkbook());
    // The sample the owner opens in desktop Excel by hand (tests/output is not committed).
    const out = path.join(__dirname, 'output');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'step19-b0-controls.xlsx'), bytes);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    expect(book.getWorksheet('Dash board').getCell('C1').value).toBe(40);
    requireSoffice(test);
    testInfo.setTimeout(180_000);
    const recalculated = recalc({ wb: bytes }).wb;
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(recalculated);
    const dash = back.getWorksheet('Dash board');
    expect(valueOf(dash.getCell('D1'))).toBe(30);   // 10 + 40 × 0.5, from the scroll bar's cell
    expect(valueOf(dash.getCell('D2'))).toBe(30);   // the check box's cell FALSE
    expect(valueOf(dash.getCell('D12'))).toBe(15);
    expect(back.getWorksheet('Other').getCell('A1').value).toBe(3);
    const zip = await JSZip.loadAsync(recalculated);
    expect(Object.keys(zip.files).filter(k => /^xl\/charts\/chart\d+\.xml$/.test(k))).toHaveLength(2); // both charts kept
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
    // An apostrophe in a name is doubled in a formula; none may start or end a name.
    expect(FX.sheetRef("O'Brien", 'E', 5, 'Calc', true)).toBe("'O''Brien'!E$5");
    expect(FX.sheetRef("Bob's 'Q1'", '$A', '$6', 'Calc')).toBe("'Bob''s ''Q1'''!$A$6");
    expect(FX.sanitizeSheetName("'Quoted'")).toBe('Quoted');
    expect(FX.sanitizeSheetName("'' x ''")).toBe('x');
    expect(FX.sanitizeSheetName("'''")).toBe('Sheet');
    expect(FX.sanitizeSheetName("Bob's")).toBe("Bob's");
    expect(FX.blankCell(null, '0.0')).toEqual({ t: 'z', z: '0.0' });
    expect(FX.textCell('')).toEqual({ t: 'z', z: 'General' });
    expect(FX.textCell('Name', { font: { bold: true } })).toEqual({ t: 's', v: 'Name', s: { font: { bold: true } } });
    expect(FX.pathKey([], 'c1', 'n1')).toBe('c1|n1');
    expect(FX.pathKey([{ canvasId: 'c1', nodeId: 'b1', vIndex: 2 }], 'c2', 'n3')).toBe('c1:b1:v2>>c2|n3');
    expect(FX.mirrorIdFor('c1|n1')).toBe('inp|c1|n1');
  });
});
