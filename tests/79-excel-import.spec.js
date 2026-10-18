// 79. Importing an Excel model, in Node (step 20; docs/step20-excel-import.md): the
// importer's modules in src/excel-exporter/import/ on their own. Phase 20b: reading the file
// (zip.js, xml.js, workbook.js) — every sample of tests/fixtures/excel-import/ cell by cell
// against ExcelJS, stored and deflated parts, the app's own Excel writer read back, Excel's
// variations (inline and rich strings, cells without addresses, true/false, errors, 1904
// dates, hidden and chart sheets, defined names), and hostile files (a zip bomb, too many
// cells or sheets, a damaged zip, an .xls, a document type, markup in names). No browser.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { test, expect, ROOT } = require('./helpers/apps');
const Z = require('../src/excel-exporter/import/zip.js');
const X = require('../src/excel-exporter/import/xml.js');
const W = require('../src/excel-exporter/import/workbook.js');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');

const DIR = path.join(ROOT, 'tests', 'fixtures', 'excel-import');
const SAMPLES = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx')).sort();
const bytesOf = (name) => new Uint8Array(fs.readFileSync(path.join(DIR, name)));

// A workbook made by hand: { sheets: [{ name, xml, state, rel }], strings, styles, names, workbookPr }.
async function craft(o, compression){
  const zip = new JSZip();
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  const rels = [], sheets = [];
  (o.sheets || []).forEach((s, i) => {
    const type = s.chart ? 'chartsheet' : 'worksheet';
    const file = (s.chart ? 'chartsheets/sheet' : 'worksheets/sheet') + (i + 1) + '.xml';
    rels.push('<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type + '" Target="' + file + '"/>');
    sheets.push('<sheet name="' + s.name + '" sheetId="' + (i + 1) + '"' + (s.state ? ' state="' + s.state + '"' : '') + ' r:id="rId' + (i + 1) + '"/>');
    zip.file('xl/' + file, s.xml);
  });
  if(o.strings){
    rels.push('<Relationship Id="rS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>');
    zip.file('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + o.strings + '</sst>');
  }
  if(o.styles){
    rels.push('<Relationship Id="rT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
    zip.file('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + o.styles + '</styleSheet>');
  }
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    (o.workbookPr || '') + '<sheets>' + sheets.join('') + '</sheets>' + (o.names ? '<definedNames>' + o.names + '</definedNames>' : '') + '</workbook>');
  (o.extra || []).forEach(([name, data]) => zip.file(name, data));
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: compression || 'DEFLATE' }));
}
const sheetXml = (rows) => '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows + '</sheetData></worksheet>';

async function refused(bytes){
  try{ await W.xlReadWorkbook(bytes); } catch(e){
    expect(e).toBeInstanceOf(Z.XlImportError);
    return e;
  }
  throw new Error('the file was read');
}
// Runs fn with some limits lowered, putting them back after.
async function withLimits(limits, fn){
  const kept = { ...Z.XL_LIMITS };
  Object.assign(Z.XL_LIMITS, limits);
  try{ return await fn(); } finally { Object.assign(Z.XL_LIMITS, kept); }
}

// ---------- 20b: reading the file ----------

test('every sample reads as ExcelJS reads it: sheets, values, formulas, shared formulas, dates, names', async () => {
  expect(SAMPLES.length).toBe(4);
  for(const file of SAMPLES){
    const book = await W.xlReadWorkbook(bytesOf(file));
    const ej = new ExcelJS.Workbook();
    await ej.xlsx.load(fs.readFileSync(path.join(DIR, file)));
    expect(book.sheets.map(s => s.name), file).toEqual(ej.worksheets.map(w => w.name));
    for(const ws of ej.worksheets){
      const sheet = book.sheets.find(s => s.name === ws.name);
      let count = 0;
      ws.eachRow(row => row.eachCell(c => {
        count++;
        const got = sheet.cells.get(c.address);
        const at = file + ' ' + ws.name + '!' + c.address;
        expect(got, at).toBeTruthy();
        const v = c.value;
        if(v instanceof Date){
          expect(got.date, at).toBe(true);
          expect(W.xlSerialToDate(got.value, book.date1904).toISOString(), at).toBe(v.toISOString());
        } else if(v && typeof v === 'object'){
          const result = v.result === undefined ? 0 : v.result;
          expect(got.value, at).toBe(result);
          if('sharedFormula' in v){
            expect(got.formula, at).toBeNull();
            expect(got.shared.index, at).toBe(sheet.cells.get(v.sharedFormula).shared.index);
          } else {
            expect(got.formula, at).toBe(v.formula);
            if(v.shareType === 'shared') expect(got.shared.ref, at).toBe(v.ref);
          }
        } else {
          expect(got.value, at).toBe(v);
          expect(got.formula, at).toBeNull();
          expect(got.date, at).toBe(false);
        }
        expect(got.format, at).toBe(c.numFmt || 'General');
      }));
      expect(sheet.cells.size, file + ' ' + ws.name).toBe(count);
    }
    expect(book.notes, file).toEqual([]);
  }
  const two = await W.xlReadWorkbook(bytesOf('03-two-sheets.xlsx'));
  expect(two.names).toEqual([{ name: 'TaxRate', ref: 'Inputs!$C$8', sheet: null, hidden: false }]);
  const calc = two.sheets[1];
  expect(calc.cells.get('D7')).toMatchObject({ formula: 'ROUND(D5*0.4,0)', shared: { index: expect.any(Number), ref: 'D7:H7' } });
  expect(calc.cells.get('F7')).toMatchObject({ formula: null, value: 15600 });
  expect(calc.rows).toBe(13);
  expect(calc.cols).toBe(8);
});

test('stored and deflated parts read alike; so does a workbook from ExcelExporter\'s own writer', async () => {
  for(const file of SAMPLES){
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DIR, file)));
    const stored = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));
    const deflated = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
    const a = await W.xlReadWorkbook(bytesOf(file)), b = await W.xlReadWorkbook(stored), c = await W.xlReadWorkbook(deflated);
    const plain = (book) => book.sheets.map(s => [s.name, [...s.cells.values()]]);
    expect(plain(b), file).toEqual(plain(a));
    expect(plain(c), file).toEqual(plain(a));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, {
    A1: { t: 's', v: 'Revenue <b>&amp;</b>' }, B1: { t: 'n', v: 1500.5, z: '#,##0.00' },
    C1: { t: 'n', f: 'B1*2', v: 3001 }, D1: { t: 's', f: 'IF(B1>0,"yes","no")', v: 'yes' },
    '!ref': 'A1:D1',
  }, 'P&L "main"');
  const out = await W.xlReadWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
  expect(out.sheets[0].name).toBe('P&L "main"');
  const cells = out.sheets[0].cells;
  expect(cells.get('A1').value).toBe('Revenue <b>&amp;</b>');
  expect(cells.get('B1')).toMatchObject({ value: 1500.5, format: '#,##0.00', formula: null });
  // The writer saves formulas without their values (Excel works them out on opening).
  expect(cells.get('C1')).toMatchObject({ value: null, formula: 'B1*2' });
  expect(cells.get('D1')).toMatchObject({ value: null, formula: 'IF(B1>0,"yes","no")' });
});

test('Excel\'s variations: inline and rich strings, cells without addresses, true/false, errors, 1904 dates, hidden and chart sheets, names', async () => {
  const bytes = await craft({
    workbookPr: '<workbookPr date1904="1"/>',
    strings: '<si><t>Plain</t></si><si><r><t>Ri</t></r><r><rPr><b/></rPr><t>ch</t></r><rPh><t>ignored</t></rPh></si><si><t xml:space="preserve"> spaced &amp; &lt;b&gt; &#x41;&#66; &bogus; </t></si>',
    styles: '<numFmts count="2"><numFmt numFmtId="164" formatCode="[$-409]mmm yy"/><numFmt numFmtId="165" formatCode="&quot;days&quot; 0;[Red]-0"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="14"/></cellXfs>',
    sheets: [
      { name: 'Main', xml: sheetXml(
        '<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c><c t="s"><v>2</v></c><c t="inlineStr"><is><t>Inline</t></is></c></row>' +
        '<row r="3"><c r="B3" t="b"><v>1</v></c><c t="b"><v>0</v></c><c t="e"><v>#DIV/0!</v></c><c t="e"><f>1/0</f><v>#DIV/0!</v></c><c t="str"><f>"a"&amp;"b"</f><v>ab</v></c></row>' +
        '<row r="5"><c r="A5" s="1"><v>45657</v></c><c r="B5" s="2"><v>12</v></c><c r="C5" s="3"><v>0</v></c><c r="D5" t="d"><v>2026-12-31T00:00:00</v></c><c r="E5" t="s"><v>99</v></c><c r="F5"><v>abc</v></c><c r="G5"/></row>' +
        '<row r="6"><c r="A6"><f t="array" ref="A6:B6">A5:B5*2</f><v>1</v></c><c r="C6"><f t="dataTable" ref="C6:D7" dt2D="1" r1="A1" r2="B1"/><v>3</v></c></row>') },
      { name: 'Hidden', state: 'hidden', xml: sheetXml('<row r="1"><c r="A1"><v>7</v></c></row>') },
      { name: 'Chart1', chart: true, xml: '<chartsheet/>' },
    ],
    names: '<definedName name="Rate">Main!$B$3</definedName><definedName name="Local" localSheetId="1">Hidden!$A$1</definedName><definedName name="_xlnm.Print_Area" localSheetId="0" hidden="1">Main!$A$1:$D$5</definedName>',
    extra: [['xl/vbaProject.bin', 'not read']],
  });
  const book = await W.xlReadWorkbook(bytes);
  expect(book.date1904).toBe(true);
  expect(book.sheets.map(s => [s.name, s.hidden])).toEqual([['Main', false], ['Hidden', true]]);
  expect(book.notes).toEqual(['macros: not read, never run', '1 chart or other sheet: left out']);
  const c = book.sheets[0].cells;
  expect(['A1', 'B1', 'C1', 'D1'].map(a => c.get(a).value)).toEqual(['Plain', 'Rich', ' spaced & <b> AB &bogus; ', 'Inline']);
  expect(c.get('B3').value).toBe(true);
  expect(c.get('C3').value).toBe(false);
  expect(c.get('D3')).toMatchObject({ value: null, error: '#DIV/0!', formula: null });
  expect(c.get('E3')).toMatchObject({ error: '#DIV/0!', formula: '1/0' });
  expect(c.get('F3')).toMatchObject({ value: 'ab', formula: '"a"&"b"' });
  expect(c.get('A5')).toMatchObject({ value: 45657, date: true, format: '[$-409]mmm yy' });
  expect(W.xlSerialToDate(45657, true).toISOString().slice(0, 10)).toBe('2029-01-01');
  expect(c.get('B5')).toMatchObject({ date: false, format: '"days" 0;[Red]-0' });
  expect(c.get('C5')).toMatchObject({ value: 0, date: true });
  expect(W.xlSerialToDate(c.get('D5').value, true).toISOString().slice(0, 10)).toBe('2026-12-31');
  expect(c.has('E5')).toBe(false); // a shared string that isn't there
  expect(c.has('F5')).toBe(false); // a number that isn't one
  expect(c.has('G5')).toBe(false);
  expect(c.get('A6')).toMatchObject({ formula: 'A5:B5*2', array: 'A6:B6' });
  expect(c.get('C6')).toMatchObject({ formula: null, dataTable: true, value: 3 });
  expect(book.names).toEqual([
    { name: 'Rate', ref: 'Main!$B$3', sheet: null, hidden: false },
    { name: 'Local', ref: 'Hidden!$A$1', sheet: 1, hidden: false },
    { name: '_xlnm.Print_Area', ref: 'Main!$A$1:$D$5', sheet: 0, hidden: true },
  ]);
});

test('the date formats and the column letters', () => {
  for(const code of ['dd/mm/yyyy', 'mmm-yy', '[$-409]d-mmm', 'h:mm', '[h]:mm:ss', 'yyyy', 'd "of" mmmm']) expect(W.xlIsDateFormat(code), code).toBe(true);
  for(const code of ['General', '0%', '#,##0.00', '"days" 0', '[Red]0.0', '0.0 "m"', '_(* #,##0_)', '\\d0', '']) expect(W.xlIsDateFormat(code), code).toBe(false);
  expect([1, 26, 27, 52, 703, 16384].map(W.xlColLetters)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA', 'XFD']);
  expect(['A', 'z', 'AA', 'XFD', 'XFE', 'ABCD', '1'].map(W.xlColNumber)).toEqual([1, 26, 27, 16384, 0, 0, 0]);
  expect(W.xlCellRef('XFD1048576')).toEqual({ col: 16384, row: 1048576 });
  for(const bad of ['XFE1', 'A1048577', 'A0', 'A01', '1A', '', 'A1:B2']) expect(W.xlCellRef(bad), bad).toBeNull();
});

test('the XML reader: entities, quotes, comments, CDATA, prefixes; a document type and broken XML refused', () => {
  const doc = X.xlParseXml('<?xml version="1.0"?><!-- c --><x:a xmlns:x="u" b=\'1 &gt; 0\' c="it\'s / > ok"><x:t>a &amp; b<![CDATA[<raw>]]></x:t><e r:id="rId2"/></x:a>');
  expect(doc.name).toBe('a');
  expect(doc.attrs.b).toBe('1 > 0');
  expect(doc.attrs.c).toBe('it\'s / > ok');
  expect(X.xlChild(doc, 't').text).toBe('a & b<raw>');
  expect(X.xlAttr(X.xlChild(doc, 'e'), 'id')).toBe('rId2');
  for(const bad of ['<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>', '<a><b></a>', '<a>', '<a></a><b></b>', '<a b="1></a>', '', 'text']){
    expect(() => X.xlParseXml(bad), bad).toThrow(Z.XlImportError);
  }
});

test('someone else\'s file: markup and formula-looking text in names and cells stays text', async () => {
  const evil = '&lt;img src=x onerror=alert(1)&gt;';
  const book = await W.xlReadWorkbook(await craft({
    strings: '<si><t>' + evil + '</t></si><si><t>=HYPERLINK("http://x")</t></si>',
    sheets: [{ name: evil, xml: sheetXml('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>') }],
    names: '<definedName name="' + evil + '">' + evil + '</definedName>',
  }));
  expect(book.sheets[0].name).toBe('<img src=x onerror=alert(1)>');
  expect(book.sheets[0].cells.get('A1')).toMatchObject({ value: '<img src=x onerror=alert(1)>', formula: null });
  expect(book.sheets[0].cells.get('B1')).toMatchObject({ value: '=HYPERLINK("http://x")', formula: null });
  expect(book.names[0]).toMatchObject({ name: '<img src=x onerror=alert(1)>', ref: '<img src=x onerror=alert(1)>' });
});

test('hostile and broken files are refused, each saying why', async () => {
  const codeOf = async (bytes) => (await refused(bytes)).code;
  // Not a zip, an .xls (or a password-protected workbook), cut short, empty.
  expect(await codeOf(new TextEncoder().encode('just some text, not a workbook'))).toBe('not-xlsx');
  expect(await codeOf(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0]))).toBe('old-or-protected');
  const good = bytesOf('01-simple-rows.xlsx');
  expect(await codeOf(good.slice(0, good.length - 30))).toBe('not-xlsx');
  expect(await codeOf(new Uint8Array(0))).toBe('not-xlsx');
  // A zip that isn't a workbook; one whose part is damaged.
  const other = new JSZip(); other.file('hello.txt', 'hi');
  expect(await codeOf(new Uint8Array(await other.generateAsync({ type: 'uint8array' })))).toBe('not-xlsx');
  const zipped = await JSZip.loadAsync(good);
  const sheet = new Uint8Array(await (await JSZip.loadAsync(good)).generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  const damaged = sheet.slice();
  const entries = Z.xlZipEntries(damaged);
  const part = entries.find(e => e.name === 'xl/worksheets/sheet1.xml');
  const start = part.offset + 30 + damaged[part.offset + 26] + (damaged[part.offset + 27] << 8) + damaged[part.offset + 28] + (damaged[part.offset + 29] << 8);
  for(let i = 0; i < part.compressedSize; i++) damaged[start + i] = 0xFF;
  expect(await codeOf(damaged)).toBe('broken');
  // A zip bomb: a part unpacking past the limit is stopped while it unpacks, whatever size it claims.
  await withLimits({ partBytes: 1024 * 1024 }, async () => {
    const big = new JSZip();
    big.file('_rels/.rels', await zipped.file('_rels/.rels').async('string'));
    big.file('xl/workbook.xml', '<workbook>' + ' '.repeat(2 * 1024 * 1024) + '</workbook>');
    const e = await refused(new Uint8Array(await big.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })));
    expect(e.code).toBe('too-big');
    expect(e.message).toContain('1 MB a part');
  });
  await withLimits({ totalBytes: 2000 }, async () => expect(await codeOf(good)).toBe('too-big'));
  await withLimits({ fileBytes: 1000 }, async () => expect(await codeOf(good)).toBe('too-big'));
  // Too many cells, sheets or parts.
  await withLimits({ cells: 10 }, async () => {
    const e = await refused(good);
    expect(e.code).toBe('too-many-cells');
  });
  await withLimits({ sheets: 1 }, async () => expect(await codeOf(bytesOf('03-two-sheets.xlsx'))).toBe('too-many-sheets'));
  await withLimits({ parts: 3 }, async () => expect(await codeOf(good)).toBe('too-many-parts'));
  // A formula longer than Excel allows; a document type; an address outside the grid; rows out of order.
  const long = 'A1+'.repeat(3000) + 'A1';
  expect(await codeOf(await craft({ sheets: [{ name: 'S', xml: sheetXml('<row r="1"><c r="A1"><f>' + long + '</f><v>1</v></c></row>') }] }))).toBe('formula-too-long');
  expect(await codeOf(await craft({ strings: '', sheets: [{ name: 'S', xml: '<!DOCTYPE x [<!ENTITY a "aaaaaaaaaa">]>' + sheetXml('') }] }))).toBe('broken');
  expect(await codeOf(await craft({ sheets: [{ name: 'S', xml: sheetXml('<row r="1"><c r="XFE1"><v>1</v></c></row>') }] }))).toBe('broken');
  expect(await codeOf(await craft({ sheets: [{ name: 'S', xml: sheetXml('<row r="1"><c r="B2"><v>1</v></c></row>') }] }))).toBe('broken');
  expect(await codeOf(await craft({ sheets: [{ name: 'S', xml: sheetXml('<row r="2"/><row r="1"/>') }] }))).toBe('broken');
  expect(await codeOf(await craft({ sheets: [{ name: 'S', xml: sheetXml('<row r="1"><c r="B1"><v>1</v></c><c r="A1"><v>1</v></c></row>') }] }))).toBe('broken');
  // No worksheets at all (a chart sheet only).
  expect(await codeOf(await craft({ sheets: [{ name: 'C', chart: true, xml: '<chartsheet/>' }] }))).toBe('no-sheets');
  // A password-protected zip entry.
  const enc = good.slice();
  const ents = Z.xlZipEntries(enc);
  const wbEntry = ents.find(e => e.name === 'xl/workbook.xml');
  enc[wbEntry.offset + 6] |= 1;
  // The central directory's flag is what the reader checks: find that record and set it too.
  for(let i = 0; i < enc.length - 4; i++){
    if(enc[i] === 0x50 && enc[i + 1] === 0x4B && enc[i + 2] === 0x01 && enc[i + 3] === 0x02){
      const nameLen = enc[i + 28] | (enc[i + 29] << 8);
      if(new TextDecoder().decode(enc.subarray(i + 46, i + 46 + nameLen)) === 'xl/workbook.xml') enc[i + 8] |= 1;
    }
  }
  expect(await codeOf(enc)).toBe('old-or-protected');
});
