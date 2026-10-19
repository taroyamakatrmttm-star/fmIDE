// 79. Importing an Excel model, in Node (step 20; docs/step20-excel-import.md): the
// importer's modules in src/excel-exporter/import/ on their own. Phase 20b: reading the file
// (zip.js, xml.js, workbook.js) — every sample of tests/fixtures/excel-import/ cell by cell
// against ExcelJS, stored and deflated parts, the app's own Excel writer read back, Excel's
// variations (inline and rich strings, cells without addresses, true/false, errors, 1904
// dates, hidden and chart sheets, defined names), and hostile files (a zip bomb, too many
// cells or sheets, a damaged zip, an .xls, a document type, markup in names). Phase 20c: the
// formula parser (formula.js) — every formula of the samples, Excel's precedence, references
// of every form, what isn't supported, moving a tree, shared formulas copied to their cells,
// formulas that aren't one. Phase 20d: the layout (layout.js) — the header row, periods, label
// and unit columns and each row's kind found as tests/fixtures/excel-import/expected.json says,
// and the person's choices. Phase 20e: building the model (build.js) — every translated cell of
// every sample, calculated by the shared IR, agrees with Excel's saved value; the shape of the
// trees (aliases in Excel's order, period shifts, named inputs, constants); the rows not
// translated and the odd cells as expected.json lists them; circular references cut; what a
// formula reads outside the rows. Phase 20f: the check (check.js) — the samples agree in every
// calculated cell; a stale saved value, Excel's errors and a workbook saved without values.
// Running totals (19 October 2026): SUM($D$5:D5) in the row itself or a shared rectangle,
// mixed terms, a later anchor, what stays kept (sample 06 and crafted rows). No browser.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { test, expect, ROOT } = require('./helpers/apps');
const Z = require('../src/excel-exporter/import/zip.js');
const X = require('../src/excel-exporter/import/xml.js');
const W = require('../src/excel-exporter/import/workbook.js');
const F = require('../src/excel-exporter/import/formula.js');
const L = require('../src/excel-exporter/import/layout.js');
const B = require('../src/excel-exporter/import/build.js');
const C = require('../src/excel-exporter/import/check.js');
const R = require('../src/excel-exporter/import/recalc.js');
const { compileModel, evaluateModel } = require('../src/shared/ir.js');
const { SHARED_FILE_VERSIONS } = require('../src/shared/file-formats.js');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');

const DIR = path.join(ROOT, 'tests', 'fixtures', 'excel-import');
const SAMPLES = fs.readdirSync(DIR).filter(f => f.endsWith('.xlsx')).sort();
const bytesOf = (name) => new Uint8Array(fs.readFileSync(path.join(DIR, name)));
const EXPECTED = JSON.parse(fs.readFileSync(path.join(DIR, 'expected.json'), 'utf8'));
const readSample = async (file) => F.xlFillSharedFormulas(await W.xlReadWorkbook(bytesOf(file)));

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
  expect(SAMPLES.length).toBe(6);
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

// ---------- 20c: the formula parser ----------

// A tree in a short form: (op a b), (fn NAME args…), refs as Excel writes them.
function show(n){
  switch(n.type){
    case 'num': return String(n.value);
    case 'str': return JSON.stringify(n.value);
    case 'bool': return n.value ? 'TRUE' : 'FALSE';
    case 'err': return n.value;
    case 'missing': return '_';
    case 'ref': case 'range': case 'name': return '[' + F.xlFormulaText(n) + ']';
    case 'unsupported': return '<' + n.what + ': ' + n.text + '>';
    case 'func': return '(' + n.name + (n.args.length ? ' ' + n.args.map(show).join(' ') : '') + ')';
    case 'unary': return '(neg' + (n.op === '+' ? '+' : '') + ' ' + show(n.arg) + ')';
    case 'percent': return '(% ' + show(n.arg) + ')';
    case 'binary': return '(' + n.op + ' ' + show(n.left) + ' ' + show(n.right) + ')';
  }
  return '?';
}
const parsed = (f) => show(F.xlParseFormula(f));

test('every formula of the samples is read, written back the same, and shared formulas are copied as ExcelJS copies them', async () => {
  let count = 0;
  for(const file of SAMPLES){
    const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytesOf(file)));
    const ej = new ExcelJS.Workbook();
    await ej.xlsx.load(fs.readFileSync(path.join(DIR, file)));
    for(const sheet of book.sheets){
      for(const c of sheet.cells.values()){
        const ejCell = ej.getWorksheet(sheet.name).getCell(c.address);
        if(ejCell.formula){
          count++;
          expect(c.formula, file + ' ' + c.address).toBe(ejCell.formula);
          expect(F.xlFormulaText(F.xlParseFormula(c.formula)), file + ' ' + c.address).toBe(c.formula);
        } else expect(c.formula, file + ' ' + c.address).toBeNull();
      }
    }
  }
  expect(count).toBeGreaterThan(80);
  const calc = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytesOf('03-two-sheets.xlsx'))).sheets[1].cells;
  expect(parsed(calc.get('G10').formula)).toBe('(MAX 0 (* [G9] [TaxRate]))');
  expect(parsed(calc.get('E5').formula)).toBe('(* [Inputs!E5] [Inputs!E6])');
  const val = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytesOf('04-not-supported.xlsx'))).sheets[0].cells;
  expect(parsed(val.get('F6').formula)).toBe('(VLOOKUP [$C$5] [Lookup!$A$2:$B$4] 2 FALSE)');
  expect(parsed(val.get('G11').formula)).toBe('(SUM [$D$8:G8])');
  expect(parsed(val.get('C13').formula)).toBe('(COUNTIF [D8:H8] ">220")');
});

test('Excel\'s precedence: negation before ^, ^ from the left, then * /, + -, &, comparisons', () => {
  const cases = {
    '1+2*3': '(+ 1 (* 2 3))',
    '(1+2)*3': '(* (+ 1 2) 3)',
    '-2^2': '(^ (neg 2) 2)',
    '2^-1': '(^ 2 (neg 1))',
    '2^3^2': '(^ (^ 2 3) 2)',
    '10%*2': '(* (% 10) 2)',
    '-A1%': '(neg (% [A1]))',
    '1-2-3': '(- (- 1 2) 3)',
    '1-(2-3)': '(- 1 (- 2 3))',
    'A1&B1=C1': '(= (& [A1] [B1]) [C1])',
    '1+2&3': '(& (+ 1 2) 3)',
    'A1<>B1': '(<> [A1] [B1])',
    'A1<=B1+1': '(<= [A1] (+ [B1] 1))',
    '--A1': '(neg (neg [A1]))',
    '+A1': '(neg+ [A1])',
    ' 1 + 2 ': '(+ 1 2)',
    '=A1*2': '(* [A1] 2)',
  };
  for(const [f, want] of Object.entries(cases)){
    expect(parsed(f), f).toBe(want);
    // Written back and read again, the tree is the same.
    expect(parsed(F.xlFormulaText(F.xlParseFormula(f))), f).toBe(want);
  }
  expect(F.xlFormulaText(F.xlParseFormula('1-(2-3)'))).toBe('1-(2-3)');
  expect(F.xlFormulaText(F.xlParseFormula('(1+2)*3'))).toBe('(1+2)*3');
  expect(F.xlFormulaText(F.xlParseFormula('2^(3^2)'))).toBe('2^(3^2)');
  expect(F.xlFormulaText(F.xlParseFormula('-(1+2)'))).toBe('-(1+2)');
});

test('references, names, functions, constants', () => {
  const cases = {
    'A1': '[A1]', '$A$1': '[$A$1]', 'A$1': '[A$1]', '$A1': '[$A1]', 'xfd1048576': '[XFD1048576]',
    'Sheet1!A1': '[Sheet1!A1]', "'My sheet'!$B$2": "['My sheet'!$B$2]", "'It''s'!A1": "['It''s'!A1]",
    'A1:B2': '[A1:B2]', 'Inputs!$D$5:H5': '[Inputs!$D$5:H5]', 'A:A': '[A:A]', '$B:$C': '[$B:$C]', '1:1': '[1:1]', 'Data!$1:$3': '[Data!$1:$3]',
    "'2026'!A1": "['2026'!A1]", "'A1'!B2": "['A1'!B2]",
    'TaxRate': '[TaxRate]', 'Sheet1!Rate': '[Sheet1!Rate]', 'Q1Sales*2': '(* [Q1Sales] 2)', 'LOG10(100)': '(LOG10 100)',
    '_xlfn.XLOOKUP(A1,B:B,C:C)': '(XLOOKUP [A1] [B:B] [C:C])', '_xlfn._xlws.SORT(A1:A3)': '(SORT [A1:A3])', 'STDEV.S(A1:A3)': '(STDEV.S [A1:A3])',
    'sum(a1,b1)': '(SUM [A1] [B1])', 'IF(A1,,2)': '(IF [A1] _ 2)', 'IF(A1,1,)': '(IF [A1] 1 _)', 'NOW()': '(NOW)', 'PI()*2': '(* (PI) 2)',
    'TRUE': 'TRUE', 'false': 'FALSE', 'AND(TRUE,FALSE)': '(AND TRUE FALSE)',
    '"say ""hi"""': '"say \\"hi\\""', '""': '""', '1.5E+3': '1500', '.5': '0.5', '2e-3': '0.002', '#DIV/0!': '#DIV/0!', 'IFERROR(#N/A,0)': '(IFERROR #N/A 0)',
    '{1,2;3,4}': '<an array constant: {1,2;3,4}>', '[1]Sheet1!A1': '<another workbook: [1]Sheet1!A1>', 'SUM(Sales[Amount])': '(SUM <a table\'s column: Sales[Amount]>)',
    "SUM('Jan:Mar'!B2)": "(SUM <several sheets: 'Jan:Mar'!B2>)",
  };
  for(const [f, want] of Object.entries(cases)) expect(parsed(f), f).toBe(want);
  expect(F.xlParseFormula('"say ""hi"""')).toEqual({ type: 'str', value: 'say "hi"' });
  expect(F.xlParseFormula("'It''s'!A1")).toMatchObject({ type: 'ref', sheet: "It's", col: 1, row: 1 });
  expect(F.xlFormulaText(F.xlParseFormula("'It''s'!A1&\"a\"\"b\""))).toBe("'It''s'!A1&\"a\"\"b\"");
});

test('moving a tree: relative parts move, $ parts stay, off the grid is #REF!', () => {
  const move = (f, dr, dc) => F.xlFormulaText(F.xlShiftFormula(F.xlParseFormula(f), dr, dc));
  expect(move('D6*D7', 0, 2)).toBe('F6*F7');
  expect(move('D7*$C$5', 0, 3)).toBe('G7*$C$5');
  expect(move('$D8+D$8+SUM($D$8:D8)', 2, 1)).toBe('$D10+E$8+SUM($D$8:E10)');
  expect(move('Inputs!D5*Inputs!D6', 1, 1)).toBe('Inputs!E6*Inputs!E7');
  expect(move('A:A+1:1', 1, 1)).toBe('B:B+2:2');
  expect(move('A1+1', 0, -1)).toBe('#REF!+1');
  expect(move('SUM(A1:B2)', -1, 0)).toBe('SUM(#REF!)');
  expect(move('TaxRate*"A1"', 5, 5)).toBe('TaxRate*"A1"');
});

test('a shared formula whose first cell is missing or unreadable is marked, not guessed', async () => {
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({ sheets: [{ name: 'S', xml: sheetXml(
    '<row r="1"><c r="A1"><f t="shared" ref="A1:B1" si="0">1+</f><v>1</v></c><c r="B1"><f t="shared" si="0"/><v>1</v></c><c r="C1"><f t="shared" si="7"/><v>2</v></c></row>') }] })));
  const c = book.sheets[0].cells;
  expect(c.get('B1').formula).toBeNull();
  expect(c.get('B1').unreadable).toContain('can\'t be read');
  expect(c.get('C1').unreadable).toBe('its shared formula is missing');
});

test('formulas that aren\'t one are refused, saying why; nesting and length are limited', () => {
  const bad = ['1+', '(1', 'SUM(1', '"abc', '#BAD!', 'SUM(1;2)', ')', '', '1 2', 'A1:', 'Sheet1!', 'IF(1,2 3)', 'XFE1+1+', '=', '@', 'ZZZZ1('];
  for(const f of bad){
    let err = null;
    try{ F.xlParseFormula(f); } catch(e){ err = e; }
    expect(err, f).toBeInstanceOf(Z.XlImportError);
    expect(err.code, f).toBe('formula-unreadable');
  }
  const deep = (n) => 'ABS('.repeat(n) + '1' + ')'.repeat(n);
  expect(parsed(deep(64))).toContain('(ABS');
  expect(() => F.xlParseFormula(deep(65))).toThrow(/nests more than 64/);
  expect(() => F.xlParseFormula('('.repeat(65) + '1' + ')'.repeat(65))).toThrow(/nests more than 64/);
  expect(() => F.xlParseFormula('-'.repeat(65) + '1')).toThrow(/nests more than 64/);
  expect(() => F.xlParseFormula('1+'.repeat(4097) + '1')).toThrow(/longer than 8192/);
});

// ---------- 20d: the layout ----------

test('each sample\'s layout is found as expected.json says: header row, periods, columns, each row\'s kind', async () => {
  for(const file of SAMPLES){
    const name = file.replace(/\.xlsx$/, '');
    const want = EXPECTED.samples[name];
    const book = await readSample(file);
    const found = L.xlAnalyseWorkbook(book);
    for(const plan of found.sheets){
      const sheet = want.sheets[plan.name];
      const at = name + ' ' + plan.name;
      if(!sheet){ expect(plan.byPeriods, at + ' is not by periods').toBe(false); continue; }
      expect(plan.byPeriods, at).toBe(true);
      expect(plan.headerRow, at).toBe(sheet.headerRow);
      expect([plan.firstCol, plan.lastCol].map(W.xlColLetters), at).toEqual([sheet.periodColumns[0], sheet.periodColumns[sheet.periodColumns.length - 1]]);
      expect(plan.periods, at).toEqual(sheet.periods);
      expect(W.xlColLetters(plan.labelCol), at).toBe(sheet.labelColumn);
      expect(W.xlColLetters(plan.unitCol), at).toBe(sheet.unitColumn);
      expect(plan.rows.map(r => [r.row, r.label, r.kind]), at).toEqual(sheet.rows.map(r => [r.row, r.label, r.kind]));
      for(const r of sheet.rows){
        const got = plan.rows.find(x => x.row === r.row);
        expect(got.odd, at + ' row ' + r.row).toEqual(r.odd || []);
        if(r.parts) expect(got.parts.map(x => ({ cells: W.xlColLetters(plan.firstCol + x.from) + ':' + W.xlColLetters(plan.firstCol + x.to), is: x.typed ? 'typed' : 'formula' })), at + ' row ' + r.row).toEqual(r.parts);
      }
    }
    expect(found.sheets.filter(p => p.byPeriods).map(p => p.name).sort(), name).toEqual(Object.keys(want.sheets).sort());
  }
});

test('a row\'s signature is its formula as in the first period column; the person\'s choices are followed', async () => {
  const simple = L.xlAnalyseWorkbook(await readSample('01-simple-rows.xlsx')).sheets[0];
  const row = (n) => simple.rows.find(r => r.row === n);
  expect(row(8).signature).toBe('D6*D7');
  expect(row(14).signature).toBe('D8-D12');
  const cork = L.xlAnalyseWorkbook(await readSample('02-corkscrew.xlsx')).sheets[0];
  expect(cork.rows.find(r => r.row === 7).signature).toBe('C10');
  expect(cork.rows.find(r => r.row === 9).signature).toBe('D7*$C$5');
  expect(cork.rows.find(r => r.row === 5).before.address).toBe('C5');
  const val = L.xlAnalyseWorkbook(await readSample('04-not-supported.xlsx')).sheets[0];
  expect(val.rows.find(r => r.row === 11).signature).toBe('SUM($D$8:D8)');
  expect(val.rows.find(r => r.row === 10).before.formula).toBe('NPV(C9,D8:H8)');

  // Choices: fewer period columns, another label column, no unit column, a header row picked.
  const book = await readSample('01-simple-rows.xlsx');
  const fewer = L.xlAnalyseSheet(book.sheets[0], { headerRow: 3, firstCol: 4, lastCol: 6, labelCol: 1, unitCol: null }, false);
  expect(fewer.periods).toEqual(['2026', '2027', '2028']);
  expect(fewer.unitCol).toBeNull();
  expect(fewer.rows.find(r => r.row === 8).cells.length).toBe(3);
  const byUnit = L.xlAnalyseSheet(book.sheets[0], { labelCol: 2 }, false);
  expect(byUnit.rows.find(r => r.row === 8).label).toBe('£');
  const wrongHeader = L.xlAnalyseSheet(book.sheets[0], { headerRow: 6 }, false);
  expect(wrongHeader.byPeriods).toBe(false);
  const lookup = L.xlAnalyseWorkbook(await readSample('04-not-supported.xlsx')).sheets[1];
  expect(lookup.byPeriods).toBe(false);
  expect(L.xlKindCounts(simple)).toEqual({ title: 3, input: 3, assumption: 0, calculation: 3, opening: 0, single: 0, parts: 0 });
});

test('periods: years, dates (a year each, or months), text periods; a run must rise and be of one kind', async () => {
  const one = async (rows) => L.xlAnalyseWorkbook(F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({
    styles: '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>', strings: '<si><t>Sales</t></si>',
    sheets: [{ name: 'S', xml: sheetXml(rows) }] })))).sheets[0];
  // Months: dates in one year.
  const months = await one('<row r="1"><c r="B1" s="1"><v>46053</v></c><c r="C1" s="1"><v>46081</v></c><c r="D1" s="1"><v>46112</v></c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>1</v></c><c r="C2"><v>2</v></c><c r="D2"><v>3</v></c></row>');
  expect(months.periods).toEqual(['2026-01', '2026-02', '2026-03']);
  expect(months.rows.map(r => r.kind)).toEqual(['input']);
  // Text periods.
  const text = await one('<row r="2"><c r="B2" t="inlineStr"><is><t>FY2026</t></is></c><c r="C2" t="inlineStr"><is><t>FY2027</t></is></c></row><row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3"><v>5</v></c><c r="C3"><v>6</v></c></row>');
  expect([text.headerRow, text.periods]).toEqual([2, ['FY2026', 'FY2027']]);
  // Years that don't rise are no header; the longer run wins; a single year isn't a run.
  const falling = await one('<row r="1"><c r="B1"><v>2030</v></c><c r="C1"><v>2029</v></c></row><row r="2"><c r="B2"><v>2020</v></c></row>');
  expect(falling.byPeriods).toBe(false);
  const longer = await one('<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row><row r="4"><c r="B4"><v>2026</v></c><c r="C4"><v>2027</v></c><c r="D4"><v>2028</v></c></row>');
  expect([longer.headerRow, longer.periods]).toEqual([4, ['2026', '2027', '2028']]);
});

test('rows: an input with a formula among its numbers, blanks, a row without a label, an unreadable formula', async () => {
  const plan = L.xlAnalyseWorkbook(F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({
    strings: '<si><t>Price</t></si><si><t>Odd</t></si><si><t>Broken</t></si>',
    sheets: [{ name: 'S', xml: sheetXml(
      '<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c><c r="D1"><v>2028</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>10</v></c><c r="C2"><f>B2*1.1</f><v>11</v></c><c r="D2"><v>12</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><f>B2*2</f><v>20</v></c><c r="D3"><f>D2*2</f><v>24</v></c></row>' +
      '<row r="4"><c r="B4"><f>B2+1</f><v>11</v></c><c r="C4"><f>C2+1</f><v>12</v></c><c r="D4"><f>D2+1</f><v>13</v></c></row>' +
      '<row r="5"><c r="A5" t="s"><v>2</v></c><c r="B5"><f>B2+</f><v>1</v></c><c r="C5"><f>C2*2</f><v>22</v></c><c r="D5"><f>D2*2</f><v>24</v></c></row>') }] })))).sheets[0];
  const r = (n) => plan.rows.find(x => x.row === n);
  expect([r(2).kind, r(2).odd]).toEqual(['input', ['C2']]);
  expect([r(3).kind, r(3).signature, r(3).odd]).toEqual(['calculation', 'B2*2', ['C3']]);
  expect([r(4).label, r(4).kind]).toEqual(['', 'calculation']);
  expect([r(5).kind, r(5).signature, r(5).odd]).toEqual(['calculation', 'B2*2', ['B5']]);
});

// ---------- 20e: building the model ----------

// Imports a workbook's sheets by periods: { system, report, book }.
async function importBook(bytes){
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytes));
  const plans = L.xlAnalyseWorkbook(book).sheets;
  return { book, ...B.xlBuildModel(book, plans, plans.map(p => p.byPeriods)) };
}
// Each reported cell: the model's value next to Excel's saved one.
function compare(system, report){
  const ir = compileModel(system);
  const results = evaluateModel(ir);
  const out = [];
  for(const r of report.rows){
    const ci = system.canvases.findIndex(c => c.id === r.canvasId);
    for(const c of r.cells){
      const p = c.period === null ? 0 : c.period;
      out.push({ where: r.sheet + '!' + c.address + ' (' + r.label + ')', got: results[ci].values[p][r.nodeId], error: results[ci].errors[p][r.nodeId], saved: c.saved, translated: r.translated });
    }
  }
  return out;
}
const agrees = (x) => typeof x.got === 'number' && Math.abs(x.got - x.saved) <= 1e-9 * Math.max(1, Math.abs(x.saved));

test('every sample\'s model, calculated, gives Excel\'s saved value in every translated cell', async () => {
  let translated = 0;
  for(const file of SAMPLES){
    const { system, report } = await importBook(bytesOf(file));
    expect(system.kind).toBe('system');
    expect(system.version).toBe(SHARED_FILE_VERSIONS.system);
    expect(system.periods, file).toEqual(['2026', '2027', '2028', '2029', '2030']);
    for(const x of compare(system, report)){
      expect(agrees(x), file + ' ' + x.where + ': ' + x.got + ' (' + x.error + ') against ' + x.saved).toBe(true);
      if(x.translated) translated++;
    }
    // What isn't translated, as expected.json lists it.
    const want = EXPECTED.samples[file.replace(/\.xlsx$/, '')];
    expect(report.notTranslated.map(n => ({ sheet: n.sheet, cells: n.cells, why: n.why })), file).toEqual(want.notTranslated);
    const odd = [];
    for(const [sheet, sh] of Object.entries(want.sheets)) for(const r of sh.rows) if(r.odd) odd.push({ sheet, row: r.row, cells: r.odd });
    expect(report.odd.map(o => ({ sheet: o.sheet, row: o.row, cells: o.cells })), file).toEqual(odd);
  }
  expect(translated).toBeGreaterThan(100);
});

// The nodes of one canvas, by id, and what feeds each.
function shape(system, canvasName){
  const c = system.canvases.find(x => x.name === canvasName);
  const byId = new Map(c.nodes.map(n => [n.id, n]));
  const rect = (name) => c.nodes.find(n => n.type === 'value' && n.text.split('\n')[0] === name);
  const into = (id) => c.edges.filter(e => e.to === id).map(e => ({ ...e, node: byId.get(e.from) }))
    .sort((a, b) => (a.node.x - b.node.x) || (a.node.y - b.node.y));
  const nameOf = (n) => {
    if(n.type === 'alias'){
      const src = system.canvases.find(k => k.id === n.sourceCanvasId).nodes.find(k => k.id === n.sourceNodeId);
      return '@' + (n.sourceCanvasId === c.id ? '' : system.canvases.find(k => k.id === n.sourceCanvasId).name + '!') + src.text.split('\n')[0];
    }
    if(n.type === 'periodShift') return 'shift(' + n.shift + ' ' + nameOf(into(n.id)[0].node) + ')';
    if(n.type === 'operator'){
      const ins = into(n.id);
      const named = ins.some(e => e.toPort !== undefined);
      const list = named ? ins.slice().sort((a, b) => a.toPort - b.toPort) : ins;
      return n.text + '(' + list.map(e => nameOf(e.node)).join(', ') + ')';
    }
    return '[' + n.text.replace(/\n/g, '|') + ']';
  };
  const formulaOf = (name) => { const r = rect(name); const ins = into(r.id); return ins.length ? nameOf(ins[0].node) : null; };
  return { c, rect, formulaOf };
}

test('the trees: aliases in Excel\'s order, period shifts, named inputs, constants, units, an opening balance', async () => {
  const one = await importBook(bytesOf('01-simple-rows.xlsx'));
  const m = shape(one.system, 'Model');
  expect(m.formulaOf('Revenue')).toBe('×(@Volume, @Price)');
  expect(m.formulaOf('Costs')).toBe('×(@Revenue, @Cost rate)');
  expect(m.formulaOf('Profit')).toBe('−(@Revenue, @Costs)');
  expect(m.rect('Volume').text).toBe('Volume\n400\nunits');
  expect(m.rect('Volume').periodValues).toEqual([400, 420, 441, 463, 486]);
  expect(m.rect('Revenue').text).toBe('Revenue\n\n£'); // no number: the unit on the third line
  expect(m.formulaOf('Volume')).toBeNull();
  // Every node on the canvas, from x 40.
  expect(Math.min(...m.c.nodes.map(n => n.x))).toBe(40);

  const cork = shape((await importBook(bytesOf('02-corkscrew.xlsx'))).system, 'Assets');
  expect(cork.rect('Opening balance').text).toBe('Opening balance\n1000\n£');
  expect(cork.rect('Opening balance').literalPeriods).toEqual([0]);
  expect(cork.formulaOf('Opening balance')).toBe('shift(-1 @Closing balance)');
  expect(cork.formulaOf('Depreciation')).toBe('×(@Opening balance, @Depreciation rate)');
  expect(cork.formulaOf('Closing balance')).toBe('−(+(@Opening balance, @Additions), @Depreciation)');
  expect(cork.rect('Depreciation rate').text).toBe('Depreciation rate\n0.1\n%');
  expect(cork.rect('Additions').periodValues).toEqual([200, 150, 100, 100, 50]);

  const two = (await importBook(bytesOf('03-two-sheets.xlsx'))).system;
  const calc = shape(two, 'Calc');
  expect(calc.formulaOf('Revenue')).toBe('×(@Inputs!Units sold, @Inputs!Unit price)');
  expect(calc.formulaOf('Fixed costs')).toBe('@Inputs!Fixed costs');
  expect(calc.formulaOf('Variable costs')).toBe('round(×(@Revenue, [Variable costs: 0.4|0.4]), [Variable costs: 0|0])');
  expect(calc.formulaOf('Total costs')).toBe('+(@Fixed costs, @Variable costs)');
  expect(calc.formulaOf('Tax')).toBe('max([Tax: 0|0], ×(@EBIT, @Inputs!Tax rate))');
  expect(calc.formulaOf('Net margin')).toBe('iferror(÷(@Net income, @Revenue), [Net margin: 0|0])');
  expect(calc.formulaOf('Loss flag')).toBe('if(<(@Net income, [Loss flag: 0|0]), [Loss flag: 1|1], [Loss flag: 0|0])');
  expect(two.canvases.map(c => c.name)).toEqual(['Inputs', 'Calc']);

  const four = await importBook(bytesOf('04-not-supported.xlsx'));
  const val = shape(four.system, 'Valuation');
  expect(val.formulaOf('Revenue')).toBe('×(shift(-1 @Revenue), +([Revenue: 1|1], @Growth))');
  // The cell that differs is the rectangle's own number in its period (step 20 tidy-up).
  expect(val.formulaOf('Cash doubled')).toBe('×(@Cash flow, [Cash doubled: 2|2])');
  expect(val.rect('Cash doubled').literalPeriods).toEqual([2]);
  expect(val.rect('Cash doubled').text.split('\n')[1]).toBe('999');
  // A row not translated keeps Excel's saved values as an input.
  expect(val.formulaOf('Growth')).toBeNull();
  expect(val.rect('Growth').text).toBe('Growth\n0.05\n%');
  // A running total (since running totals were translated): the row's own previous total.
  expect(val.formulaOf('Cumulative cash')).toBe('+(@Cash flow, if(@Up to 2026, [Cumulative cash: 0|0], shift(-1 @Cumulative cash)))');
  expect(val.rect('Cumulative cash').periodValues).toBeUndefined();
  expect(val.rect('NPV').text).toMatch(/^NPV\n[0-9.]+\n£$/);
});

test('what a formula reads outside its rows, circular references, and formulas that can\'t be translated', async () => {
  const { system, report } = await importBook(await craft({
    strings: '<si><t>Year</t></si><si><t>Age</t></si><si><t>A</t></si><si><t>B</t></si><si><t>Join</t></si><si><t>Fixed</t></si><si><t>Whole</t></si><si><t>Other</t></si><si><t>Lookup</t></si><si><t>x</t></si><si><t>Blank</t></si><si><t>Total</t></si>',
    sheets: [
      { name: 'S', xml: sheetXml(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><f>B1-2025</f><v>1</v></c><c r="C2"><f>C1-2025</f><v>2</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><f>B4+1</f><v>5</v></c><c r="C3"><f>C4+1</f><v>5</v></c></row>' +
        '<row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4"><f>B3-1</f><v>4</v></c><c r="C4"><f>C3-1</f><v>4</v></c></row>' +
        '<row r="5"><c r="A5" t="s"><v>4</v></c><c r="B5"><f>B2&amp;"x"</f><v>0</v></c><c r="C5"><f>C2&amp;"x"</f><v>0</v></c></row>' +
        '<row r="6"><c r="A6" t="s"><v>5</v></c><c r="B6"><f>$B$3*2</f><v>10</v></c><c r="C6"><f>$B$3*2</f><v>10</v></c></row>' +
        '<row r="7"><c r="A7" t="s"><v>6</v></c><c r="B7"><f>SUM(Z:Z)</f><v>0</v></c><c r="C7"><f>SUM(Z:Z)</f><v>0</v></c></row>' +
        '<row r="8"><c r="A8" t="s"><v>7</v></c><c r="B8"><f>Gone!A1</f><v>0</v></c><c r="C8"><f>Gone!A1</f><v>0</v></c></row>' +
        '<row r="9"><c r="A9" t="s"><v>8</v></c><c r="B9"><f>T!$B$2*B2</f><v>7</v></c><c r="C9"><f>T!$B$2*C2</f><v>14</v></c></row>' +
        '<row r="10"><c r="A10" t="s"><v>10</v></c><c r="B10"><f>B2+Q50</f><v>1</v></c><c r="C10"><f>C2+R50</f><v>2</v></c></row>' +
        '<row r="11"><c r="A11" t="s"><v>11</v></c><c r="B11"><f>SUM(B2:B4)</f><v>10</v></c><c r="C11"><f>SUM(C2:C4)</f><v>11</v></c></row>') },
      { name: 'T', xml: sheetXml('<row r="2"><c r="A2" t="s"><v>9</v></c><c r="B2"><v>7</v></c></row>') },
    ],
  }));
  const r = (label) => report.rows.find(x => x.label === label);
  const nt = (label) => (report.notTranslated.find(x => x.label === label) || {}).why;
  // The header row read as a rectangle of its own; a cell on a sheet not by periods as a constant.
  const m = shape(system, 'S');
  expect(m.formulaOf('Age')).toBe('−(@Year (header), [Age: 2025|2025])');
  expect(m.rect('Year (header)').periodValues).toEqual([2026, 2027]);
  expect(m.formulaOf('Lookup')).toBe('×(@T!B2, @Age)');
  expect(m.rect('T!B2').text).toBe('T!B2\n7');
  // An empty cell reads as 0.
  expect(m.formulaOf('Blank')).toBe('+(@Age, [Blank: 0|0])');
  // A circular reference: the later row keeps its saved values, the other calculates.
  expect(nt('B')).toBe('a circular reference');
  expect(nt('A')).toBeUndefined();
  expect([nt('Join'), nt('Fixed'), nt('Whole'), nt('Other')]).toEqual(['joining text (&)', 'a fixed period ($B)', 'a whole column or row', 'a sheet that isn\'t in the workbook']);
  expect(r('Total').translated).toBe(true);
  for(const x of compare(system, report)) expect(agrees(x), x.where + ': ' + x.got + ' against ' + x.saved).toBe(true);
  // Names are one line, made unique.
  expect(B.XL_SYSTEM_VERSION).toBe(9);
  expect(() => B.xlBuildModel({ sheets: [], names: [] }, [], [])).toThrow('Tick a sheet with periods to import.');
});

test('running totals: SUM($D$5:D5) the row\'s own previous total, else a shared rectangle; mixed terms, a later anchor, what stays kept', async () => {
  const { system, report } = await importBook(bytesOf('06-running-totals.xlsx'));
  const m = shape(system, 'Cash');
  // The whole formula: the row itself, live (the first period its own cell, then the previous total plus this one).
  expect(m.formulaOf('Cumulative cash')).toBe('+(@Cash flow, if(@Up to 2026, [Cumulative cash: 0|0], shift(-1 @Cumulative cash)))');
  expect(m.formulaOf('Cumulative spend')).toBe('+(@Spend, if(@Up to 2026, [Cumulative spend: 0|0], shift(-1 @Cumulative spend)))');
  // With other terms: a rectangle of its own per row summed (and anchor), shared by the formulas reading it.
  expect(m.formulaOf('Cash balance')).toBe('+(@Opening cash, @Running total of Cash flow)');
  expect(m.formulaOf('Net cumulative')).toBe('−(@Running total of Cash flow, @Running total of Spend)');
  expect(m.formulaOf('Running total of Cash flow')).toBe('+(@Cash flow, if(@Up to 2026, [Running total of Cash flow: 0|0], shift(-1 @Running total of Cash flow)))');
  expect(m.rect('Running total of Cash flow').text).toBe('Running total of Cash flow\n\n£');
  expect(m.c.nodes.filter(n => n.type === 'value' && /^Running total of Cash flow\n/.test(n.text)).length).toBe(1);
  // From a later period, in a row in parts: the total starts at its anchor (2028).
  expect(m.formulaOf('Cash since 2028')).toBe('@Running total of Cash flow from 2028');
  expect(m.formulaOf('Running total of Cash flow from 2028')).toBe('+(@Cash flow, if(@Up to 2028, [Running total of Cash flow from 2028: 0|0], shift(-1 @Running total of Cash flow from 2028)))');
  expect(m.rect('Cash since 2028').literalPeriods).toEqual([0, 1]);
  // What stays Excel's numbers: an average, and a sum over two rows, growing along the periods.
  expect(report.notTranslated.map(n => [n.label, n.why])).toEqual([['Average cash flow', 'a range growing along the periods'], ['Spend rows to date', 'a range over several rows growing along the periods']]);
  // Every translated cell is Excel's saved value, the running totals' rectangles too (no Excel row of their own).
  for(const x of compare(system, report)) expect(agrees(x), x.where + ': ' + x.got + ' (' + x.error + ') against ' + x.saved).toBe(true);
  const ir = compileModel(system), res = evaluateModel(ir);
  const total = m.rect('Running total of Cash flow from 2028');
  expect([2, 3, 4].map(p => res[0].values[p][total.id])).toEqual([75, 165, 225]);

  // Made by hand: a total of its own row (a circular reference in Excel), one starting after
  // the first period it is used in, one ending a period back, one of the header row, MIN growing.
  const cells = (r, label, f) => '<row r="' + r + '"><c r="A' + r + '" t="s"><v>' + label + '</v></c>' +
    ['B', 'C', 'D'].map(c => '<c r="' + c + r + '"><f>' + f(c) + '</f><v>0</v></c>').join('') + '</row>';
  const crafted = await importBook(await craft({
    strings: '<si><t>X</t></si><si><t>Self</t></si><si><t>Late</t></si><si><t>Back</t></si><si><t>Years</t></si><si><t>Least</t></si><si><t>Plus</t></si>',
    sheets: [{ name: 'S', xml: sheetXml(
      '<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c><c r="D1"><v>2028</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>1</v></c><c r="C2"><v>2</v></c><c r="D2"><v>4</v></c></row>' +
      cells(3, 1, (c) => 'SUM($B$3:' + c + '3)') + cells(4, 2, (c) => 'SUM($C$2:' + c + '2)') +
      cells(5, 3, (c) => 'SUM($B$2:' + String.fromCharCode(c.charCodeAt(0) - 1) + '2)') + cells(6, 4, (c) => 'SUM($B$1:' + c + '1)') +
      cells(7, 5, (c) => 'MIN($B$2:' + c + '2)') +
      '<row r="8"><c r="A8" t="s"><v>6</v></c><c r="B8"><f>SUM(B2:$B$2)*2+B2</f><v>3</v></c><c r="C8"><f>SUM(C2:$B$2)*2+C2</f><v>8</v></c><c r="D8"><f>SUM(D2:$B$2)*2+D2</f><v>18</v></c></row>') }],
  }));
  expect(crafted.report.notTranslated.map(n => [n.label, n.why])).toEqual([
    ['Self', 'a circular reference'], ['Late', 'a running total used before its first period'],
    ['Back', 'a running total not ending in its own period'], ['Years', 'a running total of something that isn\'t a row'],
    ['Least', 'a range growing along the periods']]);
  // The anchor at the end of the range reads alike; a total in a sum with other terms.
  const plus = shape(crafted.system, 'S');
  expect(plus.formulaOf('Plus')).toBe('+(×(@Running total of X, [Plus: 2|2]), @X)');
  for(const x of compare(crafted.system, crafted.report).filter(x => x.where.includes('(Plus)'))) expect(agrees(x), x.where + ': ' + x.got).toBe(true);
});

test('names repeated or with line breaks are made one line and unique; a sheet with fewer periods is matched in order', async () => {
  const { system, report } = await importBook(await craft({
    strings: '<si><t>Cost</t></si><si><t>Two\nlines</t></si><si><t>2027</t></si>',
    sheets: [
      { name: 'A', xml: sheetXml('<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c><c r="D1"><v>2028</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>1</v></c><c r="C2"><v>2</v></c><c r="D2"><v>3</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3"><v>4</v></c><c r="C3"><v>4</v></c><c r="D3"><v>4</v></c></row>' +
        '<row r="4"><c r="A4" t="s"><v>1</v></c><c r="B4"><v>5</v></c><c r="C4"><v>5</v></c><c r="D4"><v>5</v></c></row>' +
        '<row r="5"><c r="A5" t="s"><v>2</v></c><c r="B5"><v>6</v></c><c r="C5"><v>6</v></c><c r="D5"><v>6</v></c></row>') },
      { name: 'B', xml: sheetXml('<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><f>A!B2*2</f><v>2</v></c><c r="C2"><f>A!C2*2</f><v>4</v></c></row>') },
    ],
  }));
  expect(system.canvases[0].nodes.filter(n => n.type === 'value').map(n => n.text)).toEqual(['Cost\n1', 'Cost (row 3)\n4', 'Two lines\n5', '2027\n6']);
  expect(report.notes).toEqual(['“B” has 2 periods, “A” 3: periods are matched in order']);
  for(const x of compare(system, report)) expect(agrees(x), x.where).toBe(true);
});

// ---------- 20f: the check ----------

test('the check: every calculated cell of the samples agrees with Excel', async () => {
  const want = { '01-simple-rows.xlsx': [15, 0], '02-corkscrew.xlsx': [15, 0], '03-two-sheets.xlsx': [45, 0], '04-not-supported.xlsx': [20, 3], '05-actuals-forecast.xlsx': [55, 0], '06-running-totals.xlsx': [25, 2] };
  for(const file of SAMPLES){
    const { system, report } = await importBook(bytesOf(file));
    const check = C.xlCheckModel(system, report);
    expect([check.compared, check.kept], file).toEqual(want[file]);
    expect(check.agree, file).toBe(check.compared);
    expect(check.differ, file).toEqual([]);
    expect([check.noSaved, check.excelErrors], file).toEqual([0, 0]);
  }
  expect(C.xlAgree(1 + 1e-12, 1)).toBe(true);
  expect(C.xlAgree(1e12 + 1, 1e12)).toBe(true);
  expect(C.xlAgree(1.001, 1)).toBe(false);
  expect(C.xlAgree(null, 0)).toBe(false);
  expect(C.xlAgree(NaN, NaN)).toBe(false);
});

test('the check finds a saved value the formula doesn\'t give, matches Excel\'s errors, and says when nothing was saved', async () => {
  const rows = (v) => '<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>10</v></c><c r="C2"><v>0</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><f>B2*2</f>' + v[0] + '</c><c r="C3"><f>C2*2</f>' + v[1] + '</c></row>' +
    '<row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4"><f>1/B2</f>' + v[2] + '</c><c r="C4"><f>1/C2</f>' + v[3] + '</c></row>';
  const strings = '<si><t>Units</t></si><si><t>Doubled</t></si><si><t>Inverse</t></si>';
  // C3 saved as 99 (stale); C4 is #DIV/0! in Excel and an error in the model too.
  const stale = await importBook(await craft({ strings, sheets: [{ name: 'S', xml: sheetXml(rows(['<v>20</v>', '<v>99</v>', '<v>0.1</v>', '<v>#DIV/0!</v>']).replace('<c r="C4"><f>', '<c r="C4" t="e"><f>')) }] }));
  const c1 = C.xlCheckModel(stale.system, stale.report);
  expect([c1.compared, c1.agree, c1.excelErrors]).toEqual([4, 3, 1]);
  expect(c1.differ).toEqual([{ sheet: 'S', address: 'C3', label: 'Doubled', period: 1, got: 0, saved: 99, error: null }]);
  // Excel shows #DIV/0! where the model calculates a number: they differ.
  const wrong = await importBook(await craft({ strings, sheets: [{ name: 'S', xml: sheetXml(rows(['<v>20</v>', '<v>0</v>', '<v>#DIV/0!</v>', '<v>#DIV/0!</v>']).replace('<c r="B4"><f>', '<c r="B4" t="e"><f>').replace('<c r="C4"><f>', '<c r="C4" t="e"><f>')) }] }));
  const c2 = C.xlCheckModel(wrong.system, wrong.report);
  expect(c2.differ.map(d => [d.address, d.got, d.excel])).toEqual([['B4', 0.1, '#DIV/0!']]);
  // Saved without values (as ExcelExporter's own writer saves): nothing to compare.
  const none = await importBook(await craft({ strings, sheets: [{ name: 'S', xml: sheetXml(rows(['', '', '', ''])) }] }));
  const c3 = C.xlCheckModel(none.system, none.report);
  expect([c3.compared, c3.noSaved]).toEqual([0, 4]);
  expect(none.report.noSaved).toBe(4);
});

// ---------- 20g: the canvas ----------

test('the canvases: no two nodes on top of each other, the rectangles in one column in the sheet\'s order', async () => {
  // fmIDE's default sizes (docs/file-formats.md): rectangles and aliases 170 × 64, operators and
  // period shifts 56 × 56 (a word operator up to 100 wide).
  const box = (n) => {
    const w = n.type === 'value' || n.type === 'alias' ? 170 : (n.type === 'operator' && n.text.length > 1 ? 100 : 56);
    const h = n.type === 'value' || n.type === 'alias' ? 64 : 56;
    return { x1: n.x, y1: n.y, x2: n.x + w, y2: n.y + h };
  };
  for(const file of SAMPLES){
    const { system, report } = await importBook(bytesOf(file));
    for(const c of system.canvases){
      const boxes = c.nodes.map(n => ({ id: n.id, ...box(n) }));
      for(let i = 0; i < boxes.length; i++) for(let j = i + 1; j < boxes.length; j++){
        const a = boxes[i], b = boxes[j];
        const overlap = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
        expect(overlap, file + ' ' + c.name + ': ' + a.id + ' and ' + b.id).toBe(false);
      }
      const rects = report.rows.filter(r => r.canvasId === c.id).map(r => c.nodes.find(n => n.id === r.nodeId));
      expect(new Set(rects.map(n => n.x)).size, file + ' ' + c.name).toBe(1);
      expect(rects.map(n => n.y), file + ' ' + c.name).toEqual(rects.map(n => n.y).slice().sort((a, b) => a - b));
      expect(Math.max(...c.nodes.map(n => n.x)), file + ' ' + c.name).toBe(rects[0].x);
    }
  }
});

// ---------- after a real model: rows in parts ----------

test('rows in parts: actuals typed then the forecast formula, two formulas, the column before the periods, no false loop', async () => {
  const { system, report } = await importBook(bytesOf('05-actuals-forecast.xlsx'));
  const m = shape(system, 'Model');
  // Typed actuals for 2026–2028, then the forecast formula.
  // The actuals are the rectangle's own numbers in their periods; the tree is the formula alone.
  expect(m.formulaOf('Revenue')).toBe('×(shift(-1 @Revenue), +([Revenue: 1|1], @Revenue growth))');
  expect(m.rect('Revenue').text).toBe('Revenue\n\n£');
  expect(m.rect('Revenue').literalPeriods).toEqual([0, 1, 2]);
  expect(m.rect('Revenue').periodValues).toEqual([1000, 1100, 1210, 0, 0]);
  // No "(typed)" rectangles and no switch of its own in any row.
  expect(m.c.nodes.filter(n => n.type === 'value' && /\(typed\)|: 3\n/.test(n.text))).toEqual([]);
  expect(m.c.nodes.filter(n => n.type === 'operator' && n.text === '≤')).toEqual([]);
  // A blank first period, a formula, then typed numbers: the formula alone, its own numbers around it.
  expect(m.formulaOf('Revenue growth')).toBe('−(÷(@Revenue, shift(-1 @Revenue)), [Revenue growth: 1|1])');
  expect(m.rect('Revenue growth').literalPeriods).toEqual([0, 3, 4]);
  // One formula for the actual years, another for the forecast.
  // Its switch is the canvas's shared "Up to 2028": 1 in 2026–2028, 0 after.
  expect(m.formulaOf('Depreciation')).toBe('if(@Up to 2028, ×(@Capex, [Depreciation: 0.5|0.5]), ×(shift(-1 @Assets closing), [Depreciation: 0.2|0.2]))');
  expect(m.rect('Up to 2028').periodValues).toEqual([1, 1, 1, 0, 0]);
  // The column before the first period: in 2026 the previous Profit is the blank C9, 0.
  // Through the canvas's shared switch for the first year (no period test of its own).
  expect(m.formulaOf('Change in profit')).toBe('−(@Profit, if(@Up to 2026, [Change in profit: Excel\'s C9|0], shift(-1 @Profit)))');
  expect(m.rect('Up to 2026').periodValues).toEqual([1, 0, 0, 0, 0]);
  expect(m.c.nodes.filter(n => n.type === 'operator' && (n.text === 'period' || n.text === '='))).toEqual([]);
  // Spending reads Paid in the actual years, Paid reads Spending in the forecast: no loop in any one period.
  expect(report.notTranslated).toEqual([]);
  expect(m.formulaOf('Spending')).toBe('@Paid');
  expect(m.rect('Spending').literalPeriods).toEqual([3, 4]);
  expect(m.formulaOf('Paid')).toBe('@Spending');
  expect(m.rect('Paid').literalPeriods).toEqual([0, 1, 2]);
  for(const x of compare(system, report)) expect(agrees(x), x.where + ': ' + x.got + ' against ' + x.saved).toBe(true);
  // An opening balance's own first period stays its typed number (no extra if).
  expect(m.formulaOf('Assets opening')).toBe('shift(-1 @Assets closing)');
});

// A sheet of sections (step 20 tidy-up): titles and the rows under them, blank rows between.
// `rows` is [row, label, values or a formula per period (with {f, v}) or null for a title].
function sectionSheet(rows){
  const cols = ['B', 'C', 'D', 'E'];
  const str = (ref, t) => '<c r="' + ref + '" t="inlineStr"><is><t>' + t + '</t></is></c>';
  let xml = '<row r="1">' + cols.map((c, i) => '<c r="' + c + '1"><v>' + (2026 + i) + '</v></c>').join('') + '</row>';
  for(const [r, label, cells] of rows){
    xml += '<row r="' + r + '">' + str('A' + r, label);
    if(cells) cells.forEach((x, i) => {
      const ref = cols[i] + r;
      xml += typeof x === 'number' ? '<c r="' + ref + '"><v>' + x + '</v></c>' : '<c r="' + ref + '"><f>' + x.f.replace(/#/g, cols[i]) + '</f><v>' + x.v[i] + '</v></c>';
    });
    xml += '</row>';
  }
  return sheetXml(xml);
}
const SECTION_ROWS = [
  [2, 'Inputs', null], [3, 'Price', [10, 10, 10, 10]], [4, 'Volume', [1, 2, 3, 4]],
  [7, 'Revenue', null], [8, 'Revenue', [{ f: '#3*#4', v: [10, 20, 30, 40] }, { f: '#3*#4', v: [10, 20, 30, 40] }, { f: '#3*#4', v: [10, 20, 30, 40] }, { f: '#3*#4', v: [10, 20, 30, 40] }]],
  [11, 'Costs', null], [12, 'Cost rate', [0.5, 0.5, 0.5, 0.5]], [13, 'Costs', [0, 1, 2, 3].map(() => ({ f: '#8*#12', v: [5, 10, 15, 20] }))],
  [15, 'Profit', null], [16, 'Profit', [0, 1, 2, 3].map(() => ({ f: '#8-#13', v: [5, 10, 15, 20] }))],
];

test('a sheet in sections: found from its titles and blank rows, a canvas each when asked, aliases between them', async () => {
  const bytes = await craft({ sheets: [{ name: 'Model', xml: sectionSheet(SECTION_ROWS) }] });
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytes));
  const plans = L.xlAnalyseWorkbook(book).sheets;
  // Two blank rows above Revenue and Costs (one above Profit); the rows before the first are a
  // section of their own, named after their title.
  expect(plans[0].sections).toEqual([{ row: 1, label: 'Inputs' }, { row: 7, label: 'Revenue' }, { row: 11, label: 'Costs' }]);
  expect(L.xlRectangleRows(plans[0])).toBe(6);
  expect(L.XL_SECTION_MIN_ROWS).toBe(40);

  const one = B.xlBuildModel(book, plans, [true]);
  expect(one.system.canvases.map(c => c.name)).toEqual(['Model']);
  const split = B.xlBuildModel(book, plans, [true], [true]);
  expect(split.system.canvases.map(c => c.name)).toEqual(['Inputs', 'Revenue', 'Costs']);
  expect(split.report.notes).toContain('“Model” is 3 canvases, one per section');
  expect(shape(split.system, 'Revenue').formulaOf('Revenue')).toBe('×(@Inputs!Price, @Inputs!Volume)');
  const costs = shape(split.system, 'Costs');
  expect(costs.formulaOf('Costs')).toBe('×(@Revenue!Revenue, @Cost rate)');
  expect(costs.formulaOf('Profit')).toBe('−(@Revenue!Revenue, @Costs)');
  for(const x of compare(split.system, split.report)) expect(agrees(x), x.where).toBe(true);
  expect(C.xlCheckModel(split.system, split.report).agree).toBe(12);

  // Only one blank row above each title: those are the sections. One title: no sections.
  const f = (formula, v) => [0, 1, 2, 3].map(() => ({ f: formula, v }));
  const tight = [[2, 'Inputs', null], [3, 'Price', [10, 10, 10, 10]], [4, 'Volume', [1, 2, 3, 4]],
    [6, 'Revenue', null], [7, 'Revenue', f('#3*#4', [10, 20, 30, 40])], [9, 'Costs', null], [10, 'Cost rate', [0.5, 0.5, 0.5, 0.5]],
    [11, 'Costs', f('#7*#10', [5, 10, 15, 20])], [13, 'Profit', null], [14, 'Profit', f('#7-#11', [5, 10, 15, 20])]];
  const tightPlan = L.xlAnalyseWorkbook(F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({ sheets: [{ name: 'Model', xml: sectionSheet(tight) }] })))).sheets[0];
  expect(tightPlan.sections.map(x => [x.row, x.label])).toEqual([[1, 'Inputs'], [6, 'Revenue'], [9, 'Costs'], [13, 'Profit']]);
  const single = L.xlAnalyseWorkbook(F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({ sheets: [{ name: 'Model', xml: sectionSheet(SECTION_ROWS.slice(0, 3)) }] })))).sheets[0];
  expect(single.sections).toEqual([]);
  expect(B.xlBuildModel(F.xlFillSharedFormulas(await W.xlReadWorkbook(await craft({ sheets: [{ name: 'Model', xml: sectionSheet(SECTION_ROWS.slice(0, 3)) }] }))), [single], [true], [true]).system.canvases.map(c => c.name)).toEqual(['Model']);
});

test('the layout for ExcelExporter: rows, titles and blank rows in the sheet\'s order, per canvas; the formulas\' numbers; space on the canvas', async () => {
  const bytes = await craft({ sheets: [{ name: 'Model', xml: sectionSheet(SECTION_ROWS) }] });
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytes));
  const plans = L.xlAnalyseWorkbook(book).sheets;
  const words = (built, id) => {
    const c = built.system.canvases.find(x => x.id === id);
    const nameOf = (nid) => c.nodes.find(n => n.id === nid).text.split('\n')[0];
    return built.layout.canvases.find(x => x.id === id).items.map(it => it.node !== undefined ? nameOf(it.node) : it.title !== undefined ? '# ' + it.title : '');
  };
  const one = B.xlBuildModel(book, plans, [true]);
  expect(words(one, 'xl1')).toEqual(['# Inputs', 'Price', 'Volume', '', '', '# Revenue', 'Revenue', '', '', '# Costs', 'Cost rate', 'Costs', '', '# Profit', 'Profit']);
  expect(one.layout.constants).toEqual([]);
  // On the canvas, each blank row and title is space: Revenue sits two blanks and a title further down.
  const m = shape(one.system, 'Model');
  expect(m.rect('Volume').y - m.rect('Price').y).toBe(110);
  expect(m.rect('Revenue').y - m.rect('Volume').y).toBe(110 + 3 * 45);
  const split = B.xlBuildModel(book, plans, [true], [true]);
  expect(['xl1', 'xl2', 'xl3'].map(id => words(split, id))).toEqual([['# Inputs', 'Price', 'Volume'], ['# Revenue', 'Revenue'], ['# Costs', 'Cost rate', 'Costs', '', '# Profit', 'Profit']]);
  // The numbers written in the formulas, each a rectangle of its own.
  const three = await importBook(bytesOf('03-two-sheets.xlsx'));
  const calc = three.system.canvases.find(c => c.name === 'Calc');
  const constNames = three.layout.constants.filter(k => k.canvasId === calc.id).map(k => calc.nodes.find(n => n.id === k.nodeId).text.split('\n')[0]);
  expect(constNames).toEqual(expect.arrayContaining(['Variable costs: 0.4', 'Variable costs: 0', 'Tax: 0']));
  expect(constNames.every(n => /: /.test(n))).toBe(true);
  // The sheet's header row of years is not a blank row: only the empty row after it is.
  expect(words(three, calc.id)).toEqual(['# Profit and loss', '', 'Revenue', 'Fixed costs', 'Variable costs', 'Total costs', 'EBIT', 'Tax', 'Net income', 'Net margin', 'Loss flag']);
  // The header row's years and the extras come first in their canvas's layout.
  const header = (await importBook(bytesOf('04-not-supported.xlsx'))).layout;
  expect(header.canvases.every(c => c.items.length > 0)).toBe(true);
});

test('a cell\'s look: bold, italic, text colour, fill and borders, with the theme\'s colours and tints; a row\'s look for ExcelExporter', async () => {
  const styles = '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="_(#,##0_)_%;\\(#,##0\\)_%"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><color theme="1"/></font><font><b/><color rgb="FF3271D2"/></font><font><i/><color rgb="FF0000FF"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE7F2FF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor theme="4" tint="0.5"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/></border><border><left/><right/><top style="thin"><color rgb="FF000000"/></top><bottom style="double"><color indexed="10"/></bottom></border></borders>' +
    '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0"/>' +
    '<xf numFmtId="164" fontId="2" fillId="0" borderId="0"/><xf numFmtId="165" fontId="1" fillId="3" borderId="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0"/></cellXfs>';
  const theme = '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="T">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1>' +
    '</a:clrScheme></a:themeElements></a:theme>';
  const str = (ref, t, st) => '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t>' + t + '</t></is></c>';
  const num = (ref, v, st) => '<c r="' + ref + '" s="' + st + '"><v>' + v + '</v></c>';
  const fx = (ref, f, v, st) => '<c r="' + ref + '" s="' + st + '"><f>' + f + '</f><v>' + v + '</v></c>';
  const xml = sheetXml('<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c></row>' +
    '<row r="2">' + str('A2', 'Revenue', 1) + '</row>' +
    '<row r="3">' + str('A3', 'Growth') + num('B3', 0.1, 2) + num('C3', 0.2, 2) + '</row>' +
    '<row r="4">' + str('A4', 'Sales', 1) + num('B4', 100, 2) + fx('C4', 'B4*(1+C3)', 120, 3) + '</row>' +
    '<row r="5">' + str('A5', 'Plain') + num('B5', 1, 0) + num('C5', 2, 4) + num('D5', 0, 0) + '</row>');
  const bytes = await craft({ sheets: [{ name: 'S', xml }], styles, extra: [['xl/theme/theme1.xml', theme]] });
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytes));
  const cells = book.sheets[0].cells;
  expect(cells.get('A2').look).toEqual({ bold: true, italic: false, color: '#3271d2', fill: '#e7f2ff', border: {} });
  expect(cells.get('B3').look).toMatchObject({ bold: false, italic: true, color: '#0000ff', fill: null });
  // The theme's dark 1 (theme 1) and accent 1 lightened by half; an indexed colour (10, red).
  expect(cells.get('B5').look.color).toBe('#000000');
  expect(cells.get('C4').look.fill).toBe('#a7c0de');
  expect(cells.get('C4').look.border).toEqual({ top: { style: 'thin', color: '#000000' }, bottom: { style: 'double', color: '#ff0000' } });
  expect(W.xlColour(null, [])).toBeNull();
  expect(W.xlColour({ attrs: { auto: '1' } }, [])).toBeNull();
  expect(W.xlColour({ attrs: { theme: '1', tint: '-0.5' } }, ['FFFFFF', '808080'])).toBe('#404040');

  // Number formats as ExcelExporter's kinds; `_%` is a space, not a percent.
  expect(['General', '0.0%', '_(#,##0_)_%;\\(#,##0\\)_%', '"$"#,##0.00', '_-* #,##0.00_-', '@', 'yyyy-mm-dd', '0.0000'].map(B.xlNumberKind)).toEqual([
    { kind: 'general', decimals: 0 }, { kind: 'percent', decimals: 1 }, { kind: 'number', decimals: 0 }, { kind: 'currency', decimals: 2 },
    { kind: 'number', decimals: 2 }, null, null, { kind: 'number', decimals: 4 }]);

  // A row's look: its period cells' most common look, its label's bold, top and bottom borders.
  const plan = L.xlAnalyseWorkbook(book).sheets[0];
  const { layout } = B.xlBuildModel(book, [plan], [true]);
  const items = layout.canvases[0].items;
  expect(items[0]).toEqual({ title: 'Revenue', look: { fill: '#e7f2ff', font: { color: '#3271d2', weight: '700' }, border: { style: 'none' } } });
  expect(items[1].look).toEqual({ fill: null, font: { color: '#0000ff', weight: 'normal' }, border: { style: 'none' }, numberFormat: { kind: 'percent', decimals: 1 } });
  // Sales (typed, then a formula): its formula cell's look, bold from its label.
  expect(items[2].look).toEqual({ fill: '#a7c0de', font: { color: '#3271d2', weight: '700' },
    border: { style: 'solid', color: '#000000', sides: ['top', 'bottom'] }, numberFormat: { kind: 'number', decimals: 0 } });
  // Plain: two cells of the first style against one of the other.
  expect(items[3].look.numberFormat).toEqual({ kind: 'general', decimals: 0 });
  // No styles in the file: no look.
  const bare = await importBook(await craft({ sheets: [{ name: 'Model', xml: sectionSheet(SECTION_ROWS) }] }));
  expect(bare.layout.canvases[0].items.every(it => it.look === undefined)).toBe(true);
});

test('the round trip: a workbook worked out from its formulas\' text, as Excel would; cells compared with the original\'s', () => {
  const n = (v) => ({ t: 'n', v }), f = (formula) => ({ t: 'n', f: formula, v: 0 });
  const wb = { SheetNames: ['Calc', 'In puts'], Sheets: {
    'In puts': { B2: n(10), B3: n(0.25), B4: { t: 's', v: 'text' }, B5: { t: 'b', v: true } },
    Calc: {
      E3: n(1), F3: n(2), E4: f("'In puts'!B2*(1+'In puts'!B3)"), F4: f('E4*2'), E5: f('SUM(E4:F4,1)'), E6: f('IF(E$3=1,0,NA())'), F6: f('IF(F$3=1,0,NA())'),
      E7: f('IFERROR(F6,7)'), E8: f('ROUND(2.5,0)+ROUND(-2.5,0)+ROUNDUP(1.21,1)+ROUNDDOWN(-1.29,1)'), E9: f('CHOOSE(2,10,20,30)'),
      E10: f('INDEX($E$4:$F$4,2)'), E11: f('INDEX(E4:F5,2,1)'), E12: f('E4>12'), E13: f('AND(E3=1,NOT(F3=1))'), E14: f('MAX(0,-E4)+MIN(E4:F4)+AVERAGE(E4:F4)'),
      E15: f('1/0'), E16: f('MOD(-7,3)+ABS(-2)+INT(-1.5)+TRUNC(-1.5)+POWER(2,3)+SQRT(16)'), E17: f('N(TRUE)+N(\'In puts\'!B5)+SUM(\'In puts\'!B2:B5)'),
      E18: f('E19+1'), E19: f('E18+1'), E20: f('VLOOKUP(1,E4:F4,2)'), E21: f('E99*3'), E22: f('5%'), E23: f('-E4^2'),
    } } };
  const { valueOf } = R.xlRecalc(wb);
  expect(valueOf('Calc', 'E4')).toBeCloseTo(12.5, 12);
  expect(valueOf('Calc', 'F4')).toBeCloseTo(25, 12);
  expect(valueOf('Calc', 'E5')).toBeCloseTo(38.5, 12);
  expect(valueOf('Calc', 'E6')).toBe(0);
  expect(valueOf('Calc', 'F6')).toEqual({ error: '#N/A' });
  expect(valueOf('Calc', 'E7')).toBe(7);
  expect(valueOf('Calc', 'E8')).toBeCloseTo(3 - 3 + 1.3 - 1.2, 12); // half away from zero, as Excel
  expect(valueOf('Calc', 'E9')).toBe(20);
  expect(valueOf('Calc', 'E10')).toBeCloseTo(25, 12);
  expect(valueOf('Calc', 'E11')).toBeCloseTo(38.5, 12);
  expect(valueOf('Calc', 'E12')).toBe(true);
  expect(valueOf('Calc', 'E13')).toBe(true);
  expect(valueOf('Calc', 'E14')).toBeCloseTo(0 + 12.5 + 18.75, 12);
  expect(valueOf('Calc', 'E15')).toEqual({ error: '#DIV/0!' });
  expect(valueOf('Calc', 'E16')).toBe(2 + 2 - 2 - 1 + 8 + 4);
  expect(valueOf('Calc', 'E17')).toBe(1 + 1 + 10.25); // a range's text and TRUE left out
  expect(valueOf('Calc', 'E18')).toEqual({ error: '#CYCLE' });
  expect(valueOf('Calc', 'E20')).toEqual({ error: '#NAME?' });
  expect(valueOf('Calc', 'E21')).toBe(0); // an empty cell is 0
  expect(valueOf('Calc', 'E22')).toBeCloseTo(0.05, 12);
  expect(valueOf('Calc', 'E23')).toBeCloseTo(156.25, 12); // -E4^2 is (-E4)^2, as in Excel
  // The comparison: agree, differ, an Excel error agreeing with an error, what isn't checked.
  const at = (a) => ({ tab: 'Calc', address: a });
  const trip = R.xlRoundTrip(valueOf, [
    { sheet: 'S', address: 'D4', label: 'A', period: 0, saved: 12.5, at: at('E4') },
    { sheet: 'S', address: 'E4', label: 'B', period: 1, saved: 24, at: at('F4') },
    { sheet: 'S', address: 'D6', label: 'C', period: 1, saved: null, excel: '#N/A', at: at('F6') },
    { sheet: 'S', address: 'D9', label: 'D', period: 0, saved: 1, at: at('E12') },
    { sheet: 'S', address: 'D18', label: 'E', period: 0, saved: 1, at: at('E18') },
    { sheet: 'S', address: 'D20', label: 'F', period: 0, saved: 1, at: at('E20') },
  ]);
  expect({ compared: trip.compared, agree: trip.agree, unchecked: trip.unchecked }).toEqual({ compared: 4, agree: 3, unchecked: 2 });
  expect(trip.differ.map(d => [d.address, d.got, d.saved])).toEqual([['E4', 25, 24]]);
});

test('sections of two sheets are named after their sheet; a section name used twice is made unique', async () => {
  const twice = SECTION_ROWS.map(([r, l, c]) => [r, r === 11 ? 'Revenue' : l, c]);
  const bytes = await craft({ sheets: [{ name: 'Model', xml: sectionSheet(twice) }, { name: 'Copy', xml: sectionSheet(SECTION_ROWS) }] });
  const book = F.xlFillSharedFormulas(await W.xlReadWorkbook(bytes));
  const plans = L.xlAnalyseWorkbook(book).sheets;
  const { system } = B.xlBuildModel(book, plans, [true, true], [true, false]);
  expect(system.canvases.map(c => c.name)).toEqual(['Model — Inputs', 'Model — Revenue', 'Model — Revenue (2)', 'Copy']);
  const solo = B.xlBuildModel(book, plans, [true, false], [true, false]).system;
  expect(solo.canvases.map(c => c.name)).toEqual(['Inputs', 'Revenue', 'Revenue (2)']);
});

test('a real loop in parts is still cut; one formula row with a blank cell is no part', async () => {
  // A reads B and B reads A in the forecast (G–H): a loop there; the actual years are typed.
  const strings = '<si><t>A</t></si><si><t>B</t></si>';
  const row = (r, other) => '<row r="' + r + '"><c r="A' + r + '" t="s"><v>' + (r - 2) + '</v></c>' +
    '<c r="B' + r + '"><v>1</v></c><c r="C' + r + '"><v>2</v></c><c r="D' + r + '"><f>D' + other + '+1</f><v>3</v></c><c r="E' + r + '"><f>E' + other + '+1</f><v>3</v></c></row>';
  const { report } = await importBook(await craft({ strings, sheets: [{ name: 'S', xml: sheetXml(
    '<row r="1"><c r="B1"><v>2026</v></c><c r="C1"><v>2027</v></c><c r="D1"><v>2028</v></c><c r="E1"><v>2029</v></c></row>' + row(2, 3) + row(3, 2)) }] }));
  expect(report.notTranslated.map(n => [n.label, n.why])).toEqual([['B', 'a circular reference']]);
});
