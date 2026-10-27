// 90. fmGraph's Free chart on ExcelExporter's Dashboard (phase F3 of docs/fmgraph-free-chart.md).
// F3 starts with a check in Excel by the owner (Windows and the iPad): before ExcelExporter
// learns the Free chart, this group writes a workbook BY HAND with ExcelExporter's own writer
// (src/excel-exporter/js-head/, the XLSX global) that draws the owner's balance sheet and cash
// flow as one stacked-column chart over hidden fillers, with two scroll bars to move — the
// method F3 would use. It is kept in tests/output/f3-free-chart-check.xlsx for the owner.
// - The method: one category per grid column; per piece a hidden filler above 0 and one below 0;
//   per rectangle four series — above 0 as a positive part, above 0 as a negative part, below 0
//   the same — so Excel's own stacking (positives up from 0, negatives down from 0, each in the
//   order of the series) puts each segment where fmGraph does, whichever sign it has; pieces in
//   one column in the order they rest on each other. A piece that hangs back into the one it
//   rests on can't be drawn so: it is drawn pushed aside and its helper cell says "overlaps".
// - Checked here: the helper rows, worked out from their formulas' text (the import's own
//   recalculation, xlRecalc), give fmGraph's own chart(id) numbers for the same slider
//   positions; Excel's stacking of the series values gives back every rectangle's from and to
//   (except the overlap, which is flagged); ExcelJS reads the file; LibreOffice (when present)
//   recalculates it to the same numbers.
const { test, expect, openApp } = require('./helpers/apps');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { XLSX } = require('../src/excel-exporter/js-head/01-xlsx-writer.js');
const { xlRecalc } = require('../src/excel-exporter/import/recalc.js');
const { requireSoffice, recalc, valueOf: cellValue } = require('./helpers/soffice');

// ---------- the owner's case (group 84) and the "On CFF" stack ----------
// fmGraph's model: Cash EB = BB + CFO + CFF − CFI; Equity = Cash EB + PPE − Loan; Other an input.
const MODEL = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [
  { id: 'bb', type: 'value', x: 0, y: 0, text: 'Cash BB\n100' },
  { id: 'cfo', type: 'value', x: 0, y: 100, text: 'CFO\n50' },
  { id: 'cff', type: 'value', x: 0, y: 200, text: 'CFF\n70' },
  { id: 'cfi', type: 'value', x: 300, y: 300, text: 'CFI\n100' },
  { id: 'o1', type: 'operator', x: 150, y: 100, text: '+' },
  { id: 'sub', type: 'value', x: 250, y: 100, text: 'Before CFI' },
  { id: 'o2', type: 'operator', x: 350, y: 150, text: '−' },
  { id: 'eb', type: 'value', x: 450, y: 150, text: 'Cash EB' },
  { id: 'ppe', type: 'value', x: 0, y: 400, text: 'Gross PPE\n380' },
  { id: 'loan', type: 'value', x: 700, y: 500, text: 'Loan\n300' },
  { id: 'o3', type: 'operator', x: 550, y: 300, text: '+' },
  { id: 'gross', type: 'value', x: 650, y: 300, text: 'Gross' },
  { id: 'o4', type: 'operator', x: 750, y: 350, text: '−' },
  { id: 'eq', type: 'value', x: 850, y: 350, text: 'Equity' },
  { id: 'other', type: 'value', x: 0, y: 700, text: 'Other\n40' },
], edges: [
  { id: 'e1', from: 'bb', to: 'o1' }, { id: 'e2', from: 'cfo', to: 'o1' }, { id: 'e3', from: 'cff', to: 'o1' }, { id: 'e4', from: 'o1', to: 'sub' },
  { id: 'e5', from: 'sub', to: 'o2' }, { id: 'e6', from: 'cfi', to: 'o2' }, { id: 'e7', from: 'o2', to: 'eb' },
  { id: 'e8', from: 'eb', to: 'o3' }, { id: 'e9', from: 'ppe', to: 'o3' }, { id: 'e10', from: 'o3', to: 'gross' },
  { id: 'e11', from: 'gross', to: 'o4' }, { id: 'e12', from: 'loan', to: 'o4' }, { id: 'e13', from: 'o4', to: 'eq' },
] }] };

const PIECES = [
  { name: 'Asset', column: 0, sits: { on: 'zero' }, parts: ['Cash EB', 'Gross PPE'] },          // 0
  { name: 'L + Eq', column: 1, sits: { on: 'zero' }, check: 0, parts: ['Loan', 'Equity'] },    // 1
  { name: 'Cash BB', column: 3, sits: { on: 'zero' }, parts: ['Cash BB'] },                   // 2
  { name: 'CFO', column: 4, sits: { on: 'end', of: 2 }, parts: ['CFO'] },                      // 3
  { name: 'CFI', column: 5, sits: { on: 'end', of: 3 }, minus: true, parts: ['CFI'] },         // 4
  { name: 'CFF', column: 6, sits: { on: 'end', of: 4 }, parts: ['CFF'] },                      // 5
  { name: 'Cash EB', column: 7, sits: { on: 'zero' }, check: 5, parts: ['Cash EB'] },          // 6
  { name: 'Target', column: 8, sits: { on: 'level', value: 400 }, parts: ['Loan'] },           // 7
  { name: 'More', column: 1, sits: { on: 'top', of: 1 }, parts: ['CFO'] },                     // 8
  { name: 'On CFF', column: 9, sits: { on: 'end', of: 5 }, parts: ['CFO', 'Other'] },          // 9
];
const COLUMNS = 10;

// The Model tab: a row per rectangle (label in A, P1 in B). CFO and Other come from the Dashboard.
const ROWS = {
  'Cash BB': { row: 2, v: 100 }, 'CFO': { row: 3, f: 'Dashboard!$B$5' }, 'CFI': { row: 4, v: 100 }, 'CFF': { row: 5, v: 70 },
  'Cash EB': { row: 6, f: 'B2+B3+B5-B4' }, 'Gross PPE': { row: 7, v: 380 }, 'Loan': { row: 8, v: 300 },
  'Gross': { row: 9, f: 'B6+B7' }, 'Equity': { row: 10, f: 'B9-B8' }, 'Other': { row: 11, f: 'Dashboard!$B$6' },
};
// One colour per rectangle, as fmGraph's shared colours (Cash EB's from the owner's screenshot).
const COLOURS = { 'Cash EB': 'E8E83A', 'Gross PPE': '4C78A8', 'Loan': 'E45756', 'Equity': '72B7B2', 'Cash BB': '9D755D',
  'CFO': '54A24B', 'CFI': 'B279A2', 'CFF': 'F58518', 'Other': '7F7F7F' };
// The sliders: CFO −300 to 300, Other −200 to 200, by 1; Position = value − min.
const SLIDERS = [{ name: 'CFO', row: 5, min: -300, max: 300, start: 50 }, { name: 'Other', row: 6, min: -200, max: 200, start: 40 }];

const colLetter = (i) => { let s = ''; i += 1; while(i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const label = (p) => (p.minus ? '−' : '') + p.name;
const TABLE_COL = 13;                       // N: the helper tables' labels, as the Dashboard's (DASH_TABLE_COL)
const PC = (i) => colLetter(TABLE_COL + 1 + i); // a piece's column in the pieces table
const PIECE_HEAD = 5;
const PIECE_ROWS = ['Column', 'Sits', 'Value', 'Up', 'Down', 'Sits at', 'Top', 'Bottom', 'End', 'Check',
  'Filler above 0', 'Drawn up to', 'Filler below 0', 'Drawn down to', 'Overlaps'];
const PR = (name) => PIECE_HEAD + 1 + PIECE_ROWS.indexOf(name);
const RECT_TITLE = PR('Overlaps') + 2, RECT_HEAD = RECT_TITLE + 1;
const RECT_COLS = ['Piece', 'Rectangle', 'Value', 'From', 'To', 'Above 0', 'Below 0'];
const RC = (name) => colLetter(TABLE_COL + RECT_COLS.indexOf(name));

// Each rectangle of each piece, in order, with its row in the rectangles table.
function rectList(){
  const out = [];
  PIECES.forEach((p, i) => p.parts.forEach((name, k) => out.push({ piece: i, k, name, row: RECT_HEAD + 1 + out.length })));
  return out;
}
// The pieces in one column, in the order they rest on each other (depth first, then list order).
function depthOf(i){
  const p = PIECES[i];
  if(p.sits.on !== 'top' && p.sits.on !== 'end') return 0;
  const o = PIECES[p.sits.of];
  return o.column === p.column ? 1 + depthOf(p.sits.of) : 0;
}
const ORDER = PIECES.map((_, i) => i).sort((a, b) => depthOf(a) - depthOf(b) || a - b);
const belowInColumn = (i) => { const c = PIECES[i].column; const before = ORDER.slice(0, ORDER.indexOf(i)).filter(j => PIECES[j].column === c); return before.length ? before[before.length - 1] : null; };

// The series, in Excel's order: per piece (in ORDER) the filler above 0, its rectangles above 0
// (as a negative part, last first; then as a positive part, in order), the filler below 0, its
// rectangles below 0 (as a positive part, last first; then as a negative part, in order).
function seriesList(rects){
  const out = [];
  ORDER.forEach(i => {
    const mine = rects.filter(r => r.piece === i), rev = mine.slice().reverse();
    out.push({ piece: i, filler: 'above' });
    rev.forEach(r => out.push({ piece: i, rect: r, side: 'above', sign: 'neg' }));
    mine.forEach(r => out.push({ piece: i, rect: r, side: 'above', sign: 'pos' }));
    out.push({ piece: i, filler: 'below' });
    rev.forEach(r => out.push({ piece: i, rect: r, side: 'below', sign: 'pos' }));
    mine.forEach(r => out.push({ piece: i, rect: r, side: 'below', sign: 'neg' }));
  });
  return out;
}

// The workbook, with the sliders at `values` ({ CFO, Other }); cached values from `vals` when given.
function checkWorkbook(values, vals){
  const wb = XLSX.utils.book_new();
  const bold = { font: { bold: true } }, title = { font: { bold: true, sz: 14 } }, input = { fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } };
  const num = '#,##0;-#,##0;0';
  const model = { A1: { t: 's', v: 'Model (P1)', s: title }, B1: { t: 's', v: 'P1', s: bold } };
  Object.entries(ROWS).forEach(([name, r]) => {
    model['A' + r.row] = { t: 's', v: name };
    model['B' + r.row] = r.f ? { t: 'n', f: r.f, z: num } : { t: 'n', v: r.v, z: num, s: input };
  });
  model['!cols'] = [{ wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, model, 'Model');

  const d = {};
  const put = (addr, cell) => { d[addr] = cell; };
  const text = (addr, v, s) => put(addr, { t: 's', v, s });
  const calc = (addr, f) => put(addr, { t: 'n', f, z: num });
  text('A1', 'Free chart check (fmGraph phase F3)', title);
  text('A2', 'Move a scroll bar, or type a Position (0 to Max position). On the iPad, type the Position.');
  ['Slider', 'Value', '', '', '', '', 'Position', 'Min', 'Step', 'Max position'].forEach((h, c) => { if(h) text(colLetter(c) + 4, h, bold); });
  const controls = [];
  SLIDERS.forEach(s => {
    const r = s.row;
    text('A' + r, s.name);
    calc('B' + r, 'H' + r + '+G' + r + '*I' + r);
    put('G' + r, { t: 'n', v: values[s.name] - s.min, s: input });
    put('H' + r, { t: 'n', v: s.min }); put('I' + r, { t: 'n', v: 1 }); put('J' + r, { t: 'n', v: s.max - s.min });
    controls.push({ type: 'scroll', from: { c: 2, r: r - 1 }, to: { c: 6, r }, cell: '$G$' + r, min: 0, max: s.max - s.min, inc: 1, page: 10,
      val: values[s.name] - s.min, horiz: true });
  });
  text('A31', 'Pieces in one column stack in the order they rest on each other. A piece that hangs back into the one under it is drawn pushed aside ("overlaps" in its column).');

  // The pieces table.
  const N = colLetter(TABLE_COL);
  const rects = rectList();
  text(N + (PIECE_HEAD - 1), 'Pieces (P1)', bold);
  text(N + PIECE_HEAD, 'Piece', bold);
  PIECE_ROWS.forEach(r => text(N + PR(r), r));
  PIECES.forEach((p, i) => {
    const C = PC(i), at = (r) => C + PR(r);
    const mine = rects.filter(x => x.piece === i);
    const sum = (wrap) => mine.map(x => wrap(RC('Value') + x.row)).join('+');
    text(C + PIECE_HEAD, label(p), bold);
    put(at('Column'), { t: 'n', v: p.column + 1 });
    text(at('Sits'), p.sits.on === 'zero' ? 'on zero' : p.sits.on === 'level' ? 'at ' + p.sits.value
      : (p.sits.on === 'top' ? 'on top of ' : 'where ') + label(PIECES[p.sits.of]) + (p.sits.on === 'end' ? ' ends' : ''));
    calc(at('Value'), sum(c => c));
    calc(at('Up'), sum(c => 'MAX(0,' + c + ')'));
    calc(at('Down'), sum(c => 'MIN(0,' + c + ')'));
    const o = p.sits.of !== undefined ? PC(p.sits.of) : null;
    if(p.sits.on === 'zero') put(at('Sits at'), { t: 'n', v: 0, z: num });
    else if(p.sits.on === 'level') put(at('Sits at'), { t: 'n', v: p.sits.value, z: num });
    else if(p.sits.on === 'end') calc(at('Sits at'), o + PR('End'));
    else calc(at('Sits at'), 'IF(OR(' + o + PR('Up') + '>0,' + o + PR('Down') + '=0),' + o + PR('Top') + ',' + o + PR('Bottom') + ')');
    calc(at('Top'), at('Sits at') + '+' + at('Up'));
    calc(at('Bottom'), at('Sits at') + '+' + at('Down'));
    calc(at('End'), at('Sits at') + '+' + at('Value'));
    if(p.check !== undefined){
      const a = at('Value'), b = PC(p.check) + PR('End');
      put(at('Check'), { t: 's', f: 'IF(ABS(' + a + '-' + b + ')<=0.000001*MAX(1,ABS(' + a + '),ABS(' + b + ')),"✓","✗")' });
    }
    // The fillers: from 0 (or what the piece under it in this column was drawn to) to this piece.
    const q = belowInColumn(i);
    const prevUp = q === null ? '0' : PC(q) + PR('Drawn up to'), prevDown = q === null ? '0' : PC(q) + PR('Drawn down to');
    calc(at('Filler above 0'), 'MAX(0,MAX(0,' + at('Bottom') + ')-' + prevUp + ')');
    calc(at('Drawn up to'), prevUp + '+' + at('Filler above 0') + '+' + mine.map(x => RC('Above 0') + x.row).join('+'));
    calc(at('Filler below 0'), 'MIN(0,MIN(0,' + at('Top') + ')-' + prevDown + ')');
    calc(at('Drawn down to'), prevDown + '+' + at('Filler below 0') + '+' + mine.map(x => RC('Below 0') + x.row).join('+'));
    put(at('Overlaps'), { t: 's', f: 'IF(OR(AND(' + at('Top') + '>0,MAX(0,' + at('Bottom') + ')<' + prevUp + '-0.000000001),AND(' +
      at('Bottom') + '<0,MIN(0,' + at('Top') + ')>' + prevDown + '+0.000000001)),"overlaps","")' });
  });

  // The rectangles table: value, from and to (positives up from where the piece sits, negatives
  // down, in order, as fmGraph's freeFigures), and the part above and below 0.
  text(N + RECT_TITLE, 'Rectangles', bold);
  RECT_COLS.forEach(h => text(RC(h) + RECT_HEAD, h, bold));
  rects.forEach(x => {
    const p = PIECES[x.piece], r = x.row, base = PC(x.piece) + PR('Sits at');
    const before = rects.filter(y => y.piece === x.piece && y.k < x.k).map(y => RC('Value') + y.row);
    const V = RC('Value') + r, F = RC('From') + r, T = RC('To') + r;
    text(RC('Piece') + r, label(p));
    text(RC('Rectangle') + r, x.name);
    calc(V, (p.minus ? '-' : '') + 'Model!$B$' + ROWS[x.name].row);
    calc(F, before.length ? base + '+IF(' + V + '>=0,' + before.map(c => 'MAX(0,' + c + ')').join('+') + ',' + before.map(c => 'MIN(0,' + c + ')').join('+') + ')' : base);
    calc(T, F + '+' + V);
    calc(RC('Above 0') + r, 'MAX(0,MAX(' + F + ',' + T + '))-MAX(0,MIN(' + F + ',' + T + '))');
    calc(RC('Below 0') + r, 'MIN(0,MIN(' + F + ',' + T + '))-MIN(0,MAX(' + F + ',' + T + '))');
  });

  // The series table: a row per series, a column per grid column (the chart's categories).
  const series = seriesList(rects);
  const SER_TITLE = rects[rects.length - 1].row + 2, SER_HEAD = SER_TITLE + 1;
  const GC = (c) => colLetter(TABLE_COL + 1 + c);
  text(N + SER_TITLE, 'Chart series (hidden fillers have no fill)', bold);
  text(N + SER_HEAD, 'Series', bold);
  const catNames = [];
  for(let c = 0; c < COLUMNS; c++){
    const names = ORDER.filter(i => PIECES[i].column === c).map(i => label(PIECES[i])).join(' / ');
    catNames.push(names);
    text(GC(c) + SER_HEAD, names, bold);
  }
  const seen = new Set();
  const chartSeries = series.map((s, k) => {
    const r = SER_HEAD + 1 + k, p = PIECES[s.piece], cell = GC(p.column) + r;
    const P = PC(s.piece);
    let name;
    if(s.filler){ name = label(p) + ' filler ' + s.filler + ' 0'; calc(cell, P + PR(s.filler === 'above' ? 'Filler above 0' : 'Filler below 0')); }
    else {
      name = s.rect.name;
      const V = RC('Value') + s.rect.row, part = RC(s.side === 'above' ? 'Above 0' : 'Below 0') + s.rect.row;
      calc(cell, 'IF(' + V + (s.sign === 'pos' ? '>=0,' : '<0,') + part + ',0)');
    }
    text(N + r, name);
    const legend = !s.filler && s.side === 'above' && s.sign === 'pos' && !seen.has(name) && seen.add(name);
    const ref = "'Dashboard'!$" + GC(0) + '$' + r + ':$' + GC(COLUMNS - 1) + '$' + r;
    const valsNow = vals ? catNames.map((_, c) => c === p.column ? vals('Dashboard', GC(c) + r) : null) : catNames.map(() => null);
    return Object.assign({ name: { text: name }, cat: { ref: "'Dashboard'!$" + GC(0) + '$' + SER_HEAD + ':$' + GC(COLUMNS - 1) + '$' + SER_HEAD, values: catNames },
      val: { ref, values: valsNow, numFmt: num } }, s.filler ? { noFill: true } : { color: COLOURS[name] }, !s.filler && !legend ? { noLegend: true } : {});
  });
  d['!charts'] = [{ chart: { type: 'bar', title: 'Balance sheet and cash', bar: { dir: 'col', grouping: 'stacked', gapWidth: 50 }, legend: 'b',
    valAxis: { numFmt: num }, series: chartSeries }, from: { c: 0, r: 7 }, to: { c: 12, r: 29 } }];
  d['!controls'] = controls;
  d['!cols'] = [{ wch: 10 }, { wch: 9 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 9 }, { wch: 7 }, { wch: 6 }, { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 24 }].concat(PIECES.map(() => ({ wch: 11 })));
  XLSX.utils.book_append_sheet(wb, d, 'Dashboard');
  // Dashboard first, as ExcelExporter puts it.
  wb.SheetNames.reverse();
  // The writer keeps no results in formula cells (Excel recalculates on opening, fullCalcOnLoad);
  // the chart's own copy of the numbers (its cache) is what shows before that.
  return { wb, rects, series, SER_HEAD, GC };
}
// Worked out from the formulas' text, with the sliders at `values`.
function worked(values){
  const first = checkWorkbook(values);
  const { valueOf } = xlRecalc(first.wb);
  const built = checkWorkbook(values, valueOf);
  return Object.assign(built, { valueOf });
}

// What the helper rows say, in fmGraph's chart(id) shape.
function helperFigures(w){
  const v = (a) => w.valueOf('Dashboard', a);
  return PIECES.map((p, i) => ({ name: label(p), value: v(PC(i) + PR('Value')), base: v(PC(i) + PR('Sits at')), top: v(PC(i) + PR('Top')),
    bottom: v(PC(i) + PR('Bottom')), end: v(PC(i) + PR('End')), check: v(PC(i) + PR('Check')), overlaps: v(PC(i) + PR('Overlaps')) === 'overlaps',
    parts: w.rects.filter(x => x.piece === i).map(x => ({ name: x.name, value: v(RC('Value') + x.row), from: v(RC('From') + x.row), to: v(RC('To') + x.row) })) }));
}
// Excel's stacking of the series: positives up from 0, negatives down from 0, each column on its
// own, in the order of the series. → per rectangle row, its drawn [from, to] pieces above and below.
function stacked(w){
  const up = new Array(COLUMNS).fill(0), down = new Array(COLUMNS).fill(0), drawn = new Map();
  w.series.forEach((s, k) => {
    const c = PIECES[s.piece].column;
    const val = w.valueOf('Dashboard', w.GC(c) + (w.SER_HEAD + 1 + k));
    if(typeof val !== 'number' || val === 0) return;
    let seg;
    if(val > 0){ seg = [up[c], up[c] + val]; up[c] += val; } else { seg = [down[c] + val, down[c]]; down[c] += val; }
    if(s.filler) return;
    const list = drawn.get(s.rect.row) || [];
    list.push(seg);
    drawn.set(s.rect.row, list);
  });
  return drawn;
}
// A drawn rectangle as one span: its pieces above and below 0 joined.
const span = (list) => list && list.length ? [Math.min(...list.map(s => s[0])), Math.max(...list.map(s => s[1]))] : null;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const CASES = [
  { title: 'the start (CFO 50, Other 40)', values: { CFO: 50, Other: 40 } },
  { title: 'CFO 80 (group 84)', values: { CFO: 80, Other: 40 } },
  { title: 'CFO −200: CFO crosses 0, Cash EB below 0, Asset on both sides, More overlapping', values: { CFO: -200, Other: 40 } },
  { title: 'Other 150', values: { CFO: 50, Other: 150 } },
  { title: 'Other −150: the On CFF stack crosses 0 from the moving CFF end', values: { CFO: 50, Other: -150 } },
  { title: 'CFO −200 and Other −150', values: { CFO: -200, Other: -150 } },
];

test.describe('the check workbook for the owner (phase F3)', () => {
  test('written with ExcelExporter\'s writer to tests/output/f3-free-chart-check.xlsx; ExcelJS reads it back', async () => {
    const w = worked({ CFO: 50, Other: 40 });
    const bytes = XLSX.write(w.wb);
    const out = path.join(__dirname, 'output');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'f3-free-chart-check.xlsx'), bytes);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(bytes));
    expect(book.worksheets.map(s => s.name)).toEqual(['Dashboard', 'Model']);
    const dash = book.getWorksheet('Dashboard');
    expect(dash.getCell('G5').value).toBe(350);
    expect(dash.getCell('G6').value).toBe(240);
    expect(dash.getCell('B5').value).toMatchObject({ formula: 'H5+G5*I5' });
    expect(w.valueOf('Dashboard', 'B5')).toBe(50);
    // 10 pieces × 2 fillers + 13 rectangles × 4 = 72 series (Excel allows 255 in a chart).
    expect(w.series).toHaveLength(72);
    const legend = w.wb.Sheets.Dashboard['!charts'][0].chart.series.filter(s => !s.noFill && !s.noLegend).map(s => s.name.text);
    expect(legend).toEqual(['Cash EB', 'Gross PPE', 'Loan', 'Equity', 'Cash BB', 'CFO', 'CFI', 'CFF', 'Other']); // each rectangle once
  });

  test('its helper rows give fmGraph\'s own numbers, and Excel\'s stacking draws each rectangle where fmGraph does', async ({ page, pageErrors }) => {
    await openApp(page, 'fmGraph');
    await page.waitForFunction(() => !!window.fmGraph);
    await page.evaluate((m) => fmGraph.load(m, 'Owner'), MODEL);
    const id = await page.evaluate((pieces) => fmGraph.addChart({ layout: 'free', title: 'Balance sheet and cash', pieces }), PIECES);
    const sliders = await page.evaluate(() => ({ CFO: fmGraph.addSlider('CFO', { min: -300, max: 300, step: 1 }), Other: fmGraph.addSlider('Other', { min: -200, max: 200, step: 1 }) }));
    const overlaps = {};
    for(const c of CASES){
      await page.evaluate(([s, v]) => { fmGraph.setSlider(s.CFO, v.CFO); fmGraph.setSlider(s.Other, v.Other); }, [sliders, c.values]);
      const f = await page.evaluate((i) => fmGraph.chart(i), id);
      const w = worked(c.values);
      const h = helperFigures(w);
      const drawn = stacked(w);
      f.pieces.forEach((p, i) => {
        const at = c.title + ', ' + p.name;
        expect(h[i].name, at).toBe(p.name);
        ['value', 'base', 'top', 'bottom', 'end'].forEach(k => expect(close(h[i][k], p[k]), at + ' ' + k + ': ' + h[i][k] + ' vs ' + p[k]).toBe(true));
        expect(h[i].check, at).toBe(p.check ? (p.check.agree ? '✓' : '✗') : null);
        p.parts.forEach((q, k) => {
          const x = h[i].parts[k];
          expect(close(x.from, q.from) && close(x.to, q.to), at + ' ' + q.name + ' from/to').toBe(true);
          // Excel's stacking: where the rectangle is drawn (nothing for a 0).
          const sp = span(drawn.get(w.rects.find(r => r.piece === i && r.k === k).row));
          if(q.value === 0){ expect(sp, at).toBe(null); return; }
          const ok = close(sp[0], Math.min(q.from, q.to)) && close(sp[1], Math.max(q.from, q.to));
          expect(ok, at + ' ' + q.name + ' drawn ' + JSON.stringify(sp) + ', fmGraph ' + q.from + ' → ' + q.to).toBe(!h[i].overlaps);
        });
        if(h[i].overlaps) overlaps[c.title] = (overlaps[c.title] || []).concat(p.name);
      });
    }
    // The one case Excel can't draw as fmGraph does: More hanging back into L + Eq.
    expect(overlaps).toEqual({ 'CFO −200: CFO crosses 0, Cash EB below 0, Asset on both sides, More overlapping': ['More'],
      'CFO −200 and Other −150': ['More'] });
    expect(pageErrors).toEqual([]);
  });

  test('LibreOffice recalculates it to the same helper numbers', async ({}, testInfo) => {
    requireSoffice(test);
    testInfo.setTimeout(180_000);
    const w = worked({ CFO: -200, Other: -150 });
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(recalc({ wb: XLSX.write(w.wb) }).wb);
    const dash = back.getWorksheet('Dashboard');
    let n = 0;
    Object.entries(w.wb.Sheets.Dashboard).forEach(([a, c]) => {
      if(a[0] === '!' || !c.f) return;
      const want = w.valueOf('Dashboard', a), got = cellValue(dash.getCell(a));
      if(typeof want === 'number') expect(close(got, want), a + ': ' + got + ' vs ' + want).toBe(true);
      else expect(got || null, a).toBe(want || null);
      n++;
    });
    expect(n).toBeGreaterThan(200);
  });
});
