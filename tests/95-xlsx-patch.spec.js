// 95. The showcase viewer's patch (phase V4 of docs/viewer-brief.md; src/shared/xlsx-patch.js),
// in Node: a prebuilt workbook (made here by ExcelExporter's writer, as ExcelExporter makes a
// viewer's workbook) gets a few input cells written — a number or TRUE / FALSE, nothing else —
// and is packed again. The zip is read with limits (a crafted file is refused, quickly), only
// the named cells change, the check numbers are right, JSZip and ExcelJS read the result.
// Also: what the download writes for each state a visitor can be in (excelPatchPlan in
// src/shared/showcase.js), and the licence checks — the patch is new Apache code, nothing of
// ExcelExporter's is in it or in any Apache app.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { test, expect } = require('./helpers/apps');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');
const P = require('../src/shared/xlsx-patch.js');
const S = require('../src/shared/showcase.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// A workbook as ExcelExporter writes one: a Dashboard with a blank Typed cell kept for its
// style, a TRUE / FALSE Use cell, a Scenarios tab with its Global Case, formulas reading them.
function sampleWorkbook(){
  const wb = XLSX.utils.book_new();
  const bold = { font: { bold: true } };
  XLSX.utils.book_append_sheet(wb, {
    A1: { t: 's', v: 'Dashboard' },
    E5: { t: 'n', v: 3 }, F5: { t: 'z', s: bold }, G5: { t: 'n', f: 'IF(ISNUMBER(F5),F5,J5+E5*L5)', v: 10, s: bold },
    I5: { t: 'b', v: false, s: bold }, J5: { t: 'n', v: 7 }, L5: { t: 'n', v: 1 },
    F6: { t: 'z' }, G6: { t: 'n', f: 'IF(ISNUMBER(F6),F6,0)' },
    '!ref': 'A1:L6'
  }, 'Dash & board');
  XLSX.utils.book_append_sheet(wb, {
    A2: { t: 's', v: 'Global Case' }, C2: { t: 'n', v: 1, s: bold }, D2: { t: 's', f: 'INDEX(H3:I3,C2)', v: 'Base' },
    H3: { t: 's', v: 'Base' }, I3: { t: 's', v: 'High' }, B4: { t: 's', v: '<b>not markup</b> & more' },
    '!ref': 'A1:I4'
  }, 'Scenarios');
  return XLSX.write(wb);
}
async function parts(bytes){
  const z = await JSZip.loadAsync(bytes);
  const out = {};
  for(const name of Object.keys(z.files)) out[name] = await z.file(name).async('string');
  return out;
}
const WRITES = [
  { sheet: 'Dash & board', cell: 'F5', value: 13.25 },
  { sheet: 'Dash & board', cell: 'I5', value: true },
  { sheet: 'Scenarios', cell: 'C2', value: 2 }
];

test.describe('the patch', () => {
  test('only the named cells change; every other part is the same; JSZip and ExcelJS read it', async () => {
    const bytes = sampleWorkbook();
    const r = await P.patchXlsx(bytes, WRITES);
    expect(r.error).toBeUndefined();
    const before = await parts(bytes), after = await parts(r.bytes);
    expect(Object.keys(after)).toEqual(Object.keys(before)); // the same parts, in the same order
    const changed = Object.keys(before).filter(n => before[n] !== after[n]);
    expect(changed).toEqual(['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']);
    // In each changed sheet only the named <c> elements differ, and they keep their style.
    const cellXml = (xml, r) => (xml.match(new RegExp('<c r="' + r + '"[^>]*?(?:/>|>.*?</c>)')) || [])[0];
    expect(cellXml(before['xl/worksheets/sheet1.xml'], 'F5')).toBe('<c r="F5" s="1"/>');
    expect(cellXml(after['xl/worksheets/sheet1.xml'], 'F5')).toBe('<c r="F5" s="1"><v>13.25</v></c>');
    expect(cellXml(after['xl/worksheets/sheet1.xml'], 'I5')).toBe('<c r="I5" s="1" t="b"><v>1</v></c>');
    expect(cellXml(after['xl/worksheets/sheet2.xml'], 'C2')).toBe('<c r="C2" s="1"><v>2</v></c>');
    const strip = (xml, cells) => cells.reduce((t, c) => t.replace(cellXml(t, c), ''), xml);
    expect(strip(after['xl/worksheets/sheet1.xml'], ['F5', 'I5'])).toBe(strip(before['xl/worksheets/sheet1.xml'], ['F5', 'I5']));
    expect(strip(after['xl/worksheets/sheet2.xml'], ['C2'])).toBe(strip(before['xl/worksheets/sheet2.xml'], ['C2']));
    // ExcelJS reads the values (and the formulas untouched).
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(r.bytes));
    const dash = book.getWorksheet('Dash & board');
    expect(dash.getCell('F5').value).toBe(13.25);
    expect(dash.getCell('I5').value).toBe(true);
    expect(dash.getCell('G5').value.formula).toBe('IF(ISNUMBER(F5),F5,J5+E5*L5)');
    expect(book.getWorksheet('Scenarios').getCell('C2').value).toBe(2);
    expect(book.getWorksheet('Scenarios').getCell('B4').value).toBe('<b>not markup</b> & more');
  });

  test('the zip written is well formed: every check number right, every part stored', async () => {
    const r = await P.patchXlsx(sampleWorkbook(), WRITES);
    const again = await P.zipEntriesOf(r.bytes); // reads only when every CRC matches
    expect(again.map(e => e.name)).toContain('xl/workbook.xml');
    const z = await JSZip.loadAsync(r.bytes, { checkCRC32: true });
    Object.values(z.files).forEach(f => expect(f._data.compression.magic).toBe('\x00\x00'));
    expect(P.crc32Of(new TextEncoder().encode('123456789'))).toBe(0xCBF43926); // the standard check value
  });

  test('a deflated workbook is read too, and the same cells are written', async () => {
    const deflated = await (await JSZip.loadAsync(sampleWorkbook())).generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const r = await P.patchXlsx(deflated, WRITES);
    expect(r.error).toBeUndefined();
    const after = await parts(r.bytes);
    expect(after['xl/worksheets/sheet1.xml']).toContain('<c r="F5" s="1"><v>13.25</v></c>');
  });

  test('a cell with a formula, a text or a number becomes the number; numbers are written as JavaScript gives them', () => {
    const xml = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c><c r="B1" s="3"><f>A1*2</f><v>4</v></c>' +
      '<c r="C1" t="s"><v>0</v></c><c r="D1"><v>1</v></c></row></sheetData></worksheet>';
    const out = P.writeCellsInSheet(xml, [{ cell: 'A1', value: -0.5 }, { cell: 'b1', value: 1e-7 }, { cell: 'C1', value: false }, { cell: 'D1', value: 123456789012 }]);
    expect(out).toBe('<worksheet><sheetData><row r="1"><c r="A1"><v>-0.5</v></c><c r="B1" s="3"><v>1e-7</v></c>' +
      '<c r="C1" t="b"><v>0</v></c><c r="D1"><v>123456789012</v></c></row></sheetData></worksheet>');
    // Nothing outside sheetData is touched, even something that looks like a cell.
    const tricky = '<worksheet><x r="A1"/><sheetData><row r="1"><c r="A1"/></row></sheetData><extLst><c r="A1"/></extLst></worksheet>';
    expect(P.writeCellsInSheet(tricky, [{ cell: 'A1', value: 1 }])).toBe('<worksheet><x r="A1"/><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData><extLst><c r="A1"/></extLst></worksheet>');
  });

  test('anything but a number or TRUE / FALSE, a cell or sheet not there, a bad address: refused, nothing written', async () => {
    const bytes = sampleWorkbook();
    const cases = [
      [[{ sheet: 'Nope', cell: 'A1', value: 1 }], 'no-sheet'],
      [[{ sheet: 'Scenarios', cell: 'Z99', value: 1 }], 'no-cell'],
      [[{ sheet: 'Scenarios', cell: 'XFE1', value: 1 }], 'address'],
      [[{ sheet: 'Scenarios', cell: 'A0', value: 1 }], 'address'],
      [[{ sheet: 'Scenarios', cell: 'C2', value: '=HYPERLINK("x")' }], 'value'],
      [[{ sheet: 'Scenarios', cell: 'C2', value: NaN }], 'value'],
      [[{ sheet: 'Scenarios', cell: 'C2', value: Infinity }], 'value'],
      [[{ sheet: 'Scenarios', cell: 'C2', value: 1 }, { sheet: 'Scenarios', cell: 'c2', value: 2 }], 'twice'],
      [[{ cell: 'C2', value: 1 }], 'sheet'],
      [Array.from({ length: 401 }, () => ({ sheet: 'Scenarios', cell: 'C2', value: 1 })), 'writes'],
    ];
    for(const [writes, code] of cases){
      const r = await P.patchXlsx(bytes, writes);
      expect(r.bytes, code).toBeUndefined();
      expect(r.code).toBe(code);
      expect(typeof r.error).toBe('string');
    }
    expect(P.xlsxCellAddress('xfd1048576')).toBe('XFD1048576');
    expect(P.xlsxCellAddress('A1048577')).toBeNull();
  });
});

// ---------- crafted zips ----------
// A zip of the given parts, written by hand so each field can be made wrong on purpose.
function craft(list, tweak){
  const t = Object.assign({ method: () => 0, flags: () => 0x0800, crc: (e) => P.crc32Of(e.data), size: (e) => e.data.length,
    packed: (e) => e.stored.length, localAt: (e, at) => at, count: (n) => n, dirAt: (at) => at }, tweak || {});
  const chunks = [], dir = [];
  let at = 0;
  list.forEach(e => {
    e.stored = e.packedBytes || e.data;
    const name = Buffer.from(e.name);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(t.flags(e), 6); h.writeUInt16LE(t.method(e), 8);
    h.writeUInt32LE(t.crc(e) >>> 0, 14); h.writeUInt32LE(t.packed(e) >>> 0, 18); h.writeUInt32LE(t.size(e) >>> 0, 22); h.writeUInt16LE(name.length, 26);
    chunks.push(h, name, Buffer.from(e.stored));
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(t.flags(e), 8); c.writeUInt16LE(t.method(e), 10);
    c.writeUInt32LE(t.crc(e) >>> 0, 16); c.writeUInt32LE(t.packed(e) >>> 0, 20); c.writeUInt32LE(t.size(e) >>> 0, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(t.localAt(e, at) >>> 0, 42);
    dir.push(c, name);
    at += 30 + name.length + e.stored.length;
  });
  const dirBytes = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(t.count(list.length) & 0xFFFF, 8); end.writeUInt16LE(t.count(list.length) & 0xFFFF, 10);
  end.writeUInt32LE(dirBytes.length, 12); end.writeUInt32LE(t.dirAt(at) >>> 0, 16);
  return new Uint8Array(Buffer.concat([...chunks, dirBytes, end]));
}
const part = (name, text) => ({ name, data: Buffer.from(text) });

test.describe('crafted zips are refused, quickly and with a reason', () => {
  test('the hand-made zip helper makes a zip that is read', async () => {
    const e = await P.zipEntriesOf(craft([part('a.xml', '<a/>'), part('b/c.xml', '<c/>')]));
    expect(e.map(x => [x.name, Buffer.from(x.data).toString()])).toEqual([['a.xml', '<a/>'], ['b/c.xml', '<c/>']]);
  });

  test('a zip bomb: a part that unpacks to far more than its size, or to more than it says', async () => {
    const zeros = Buffer.alloc(30 * 1024 * 1024);
    const packedBytes = zlib.deflateRawSync(zeros);
    const t0 = Date.now();
    const bomb = { name: 'xl/worksheets/sheet1.xml', data: zeros, packedBytes };
    await expect(P.zipEntriesOf(craft([bomb], { method: () => 8 }))).rejects.toMatchObject({ code: 'bomb' });
    // Saying it is small but unpacking to more: stopped as soon as it passes the size it gave.
    const small = { name: 'x.xml', data: Buffer.alloc(2000), packedBytes: zlib.deflateRawSync(Buffer.alloc(200000)) };
    await expect(P.zipEntriesOf(craft([small], { method: () => 8, size: () => 2000, crc: () => 0 }))).rejects.toMatchObject({ code: 'size' });
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('ZIP64, a password, a wrong check number, an unknown packing, a name outside the workbook', async () => {
    const one = [part('a.xml', '<a/>')];
    await expect(P.zipEntriesOf(craft(one, { count: () => 0xFFFF }))).rejects.toMatchObject({ code: 'zip64' });
    await expect(P.zipEntriesOf(craft(one, { dirAt: () => 0xFFFFFFFF }))).rejects.toMatchObject({ code: 'zip64' });
    await expect(P.zipEntriesOf(craft(one, { flags: () => 0x0801 }))).rejects.toMatchObject({ code: 'encrypted' });
    await expect(P.zipEntriesOf(craft(one, { crc: () => 12345 }))).rejects.toMatchObject({ code: 'crc' });
    await expect(P.zipEntriesOf(craft(one, { method: () => 12 }))).rejects.toMatchObject({ code: 'method' });
    for(const name of ['../evil.xml', '/abs.xml', 'a\\b.xml', 'a/./b.xml', 'x\u0001.xml']){
      await expect(P.zipEntriesOf(craft([part(name, '<a/>')]))).rejects.toMatchObject({ code: 'name' });
    }
    await expect(P.zipEntriesOf(craft([part('a.xml', '1'), part('a.xml', '2')]))).rejects.toMatchObject({ code: 'twice' });
  });

  test('overlapping parts, too many parts, a cut-short file, something that is not a zip', async () => {
    const two = [part('a.xml', '<aaaa/>'), part('b.xml', '<bbbb/>')];
    await expect(P.zipEntriesOf(craft(two, { localAt: () => 0 }))).rejects.toMatchObject({ code: 'overlap' });
    const many = Array.from({ length: 2001 }, (_, i) => part('p' + i + '.xml', 'x'));
    await expect(P.zipEntriesOf(craft(many))).rejects.toMatchObject({ code: 'entries' });
    const whole = craft(two);
    await expect(P.zipEntriesOf(whole.slice(0, whole.length - 30))).rejects.toBeInstanceOf(P.XlsxPatchError);
    await expect(P.zipEntriesOf(new TextEncoder().encode('<html>not a workbook</html> '.repeat(3)))).rejects.toMatchObject({ code: 'not-zip' });
    await expect(P.zipEntriesOf(new Uint8Array(5))).rejects.toMatchObject({ code: 'short' });
    // patchXlsx never throws: it answers with the reason.
    const r = await P.patchXlsx(new Uint8Array(5), []);
    expect(r).toEqual({ error: 'That is not a workbook: it is too short.', code: 'short' });
  });
});

// ---------- what the download writes (excelPatchPlan) ----------
const MAP = S.cleanCellMap({
  case: { sheet: 'Scenarios', cell: 'C2' },
  cases: [{ name: 'High price', case: 2 }, { name: 'Partly', case: 3, missing: 1 }],
  sliders: [
    { canvasId: 'c', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, typed: { sheet: 'Dashboard', cell: 'F5' }, use: { sheet: 'Dashboard', cell: 'I5' } },
    { canvasId: 'c', nodeId: 'vol', name: 'Volume', mode: 'shift', periods: { mode: 'all' }, typed: { sheet: 'Dashboard', cell: 'F6' }, rest: 0 },
    { canvasId: 'c', nodeId: 'cost', name: 'Cost', mode: 'shift', periods: { mode: 'range', from: 1, to: 2 }, typed: { sheet: 'Dashboard', cell: 'F7' }, rest: 0.5 },
  ] }).value;
const slider = (nodeId, mode, value, periods) => ({ canvasId: 'c', nodeId, name: { price: 'Price', vol: 'Volume', cost: 'Cost', other: 'Other' }[nodeId], mode, periods: periods || { mode: 'all' }, value });

test.describe('what the download writes for each state', () => {
  test('Base, nothing moved: case 1, and 0 into a change by % that rests elsewhere', () => {
    const p = S.excelPatchPlan(MAP, { scenario: null, sliders: [slider('price', 'set', null), slider('vol', 'shift', null)] }, 4);
    expect(p.writes).toEqual([{ sheet: 'Scenarios', cell: 'C2', value: 1 }, { sheet: 'Dashboard', cell: 'F7', value: 0 }]);
    expect([p.line, p.suffix, p.missing]).toEqual(['The model\'s own numbers', '', []]);
  });

  test('a scenario shown exactly: only its Global Case (the sliders are where it put them, but not written)', () => {
    const p = S.excelPatchPlan(MAP, { scenario: 'High price', sliders: [slider('price', 'set', 13)] }, 4);
    expect(p.writes).toEqual([{ sheet: 'Scenarios', cell: 'C2', value: 2 }, { sheet: 'Dashboard', cell: 'F7', value: 0 }]);
    expect([p.line, p.suffix]).toEqual(['Scenario: High price', ' – High price']);
    expect(S.excelPatchPlan(MAP, { scenario: 'high PRICE' }, 4).writes[0].value).toBe(2);
    expect(S.excelPatchPlan(MAP, { scenario: 'Partly' }, 4).line).toBe('Scenario: Partly (in the workbook without 1 of its change)');
  });

  test('a scenario the workbook doesn\'t hold: Base, and the line says so', () => {
    const p = S.excelPatchPlan(MAP, { scenario: 'Gone' }, 4);
    expect(p.writes[0]).toEqual({ sheet: 'Scenarios', cell: 'C2', value: 1 });
    expect(p.missing).toEqual(['Gone']);
    expect(p.line).toBe('The model\'s own numbers — the scenario “Gone” isn\'t in the workbook');
  });

  test('Base plus the sliders (a scenario left by moving one): Typed, and TRUE in Use for a set slider', () => {
    const p = S.excelPatchPlan(MAP, { scenario: null, sliders: [slider('price', 'set', 13), slider('vol', 'shift', -5),
      slider('cost', 'shift', 0.5, { mode: 'range', from: 2, to: 1 })] }, 4);
    expect(p.writes).toEqual([
      { sheet: 'Scenarios', cell: 'C2', value: 1 },
      { sheet: 'Dashboard', cell: 'F5', value: 13 }, { sheet: 'Dashboard', cell: 'I5', value: true },
      { sheet: 'Dashboard', cell: 'F6', value: -5 },
    ]); // Cost sits where the workbook rests it: nothing to write (its periods match, written the other way round)
    expect(p.line).toBe('Price set to 13, Volume -5%, Cost +0.5%');
    expect(p.suffix).toBe(' – my sliders');
  });

  test('a slider the workbook doesn\'t hold (not on its Dashboard, other periods): named in the line', () => {
    const p = S.excelPatchPlan(MAP, { scenario: null, sliders: [slider('other', 'set', 3), slider('price', 'set', 2, { mode: 'one', p: 0 }), slider('vol', 'shift', 10)] }, 4);
    expect(p.missing).toEqual(['Other', 'Price']);
    expect(p.line).toBe('Volume +10% — Other, Price aren\'t in the workbook');
    expect(p.writes).toContainEqual({ sheet: 'Dashboard', cell: 'F6', value: 10 });
    expect(p.writes.some(w => w.cell === 'F5')).toBe(false);
  });

  test('a download name says what it holds', () => {
    expect(S.showcaseDownloadName('Loan basics.xlsx', ' – High price')).toBe('Loan basics – High price.xlsx');
    expect(S.showcaseDownloadName('Loan basics.xlsx', '')).toBe('Loan basics.xlsx');
    expect(S.showcaseDownloadName('', ' – my sliders')).toBe('Model – my sliders.xlsx');
    expect(S.showcaseDownloadName('a.xlsx', ' – x/y:z<>')).toBe('a – x y z.xlsx');
  });
});

// ---------- the licences: the patch is new, nothing of ExcelExporter's is in the Apache apps ----------
test.describe('nothing of ExcelExporter\'s in the patch or the Apache apps', () => {
  test('no line of the patch is found in ExcelExporter\'s writer or its import\'s zip reader', () => {
    const lines = (t) => t.split('\n').map(l => l.replace(/\s+/g, '')).filter(l => l.length >= 30);
    const theirs = new Set([...lines(read('src/excel-exporter/js-head/01-xlsx-writer.js')), ...lines(read('src/excel-exporter/import/zip.js'))]);
    const shared = lines(read('src/shared/xlsx-patch.js')).filter(l => theirs.has(l));
    expect(shared).toEqual([]);
  });

  test('the patch imports only shared code', () => {
    const patch = read('src/shared/xlsx-patch.js');
    [...patch.matchAll(/^import .* from '([^']+)';$/gm)].forEach(m => expect(m[1]).toMatch(/^\.\/[a-z-]+\.js$/));
  });
  // The Apache apps' sources and built pages are checked in group 96, which opens the viewer
  // anyway: read here, a change to the board engine would run this group too (group 74).
});
