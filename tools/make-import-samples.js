#!/usr/bin/env node
// The sample workbooks for importing an Excel model (step 20, docs/step20-excel-import.md):
// small financial models as people build them in Excel, written with exceljs (test tooling,
// dev-only — never loaded by an app), each with the values Excel would have saved for its
// formulas worked out here. What the importer should find in each is described beside it in
// tests/fixtures/excel-import/expected.json. Test group 78 checks the samples: this tool
// writes the same cells again, the description fits them, and LibreOffice, recalculating a
// copy written without saved values, gives the values saved here.
//
//   node tools/make-import-samples.js            write the samples into tests/fixtures/excel-import/
//   node tools/make-import-samples.js DIR        write them into DIR
//   build(name, { results: false })             one sample's workbook, without saved values
'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = path.join(__dirname, '..', 'tests', 'fixtures', 'excel-import');
const YEARS = [2026, 2027, 2028, 2029, 2030];
const COLS = ['D', 'E', 'F', 'G', 'H'];
const FIXED_DATE = new Date(Date.UTC(2026, 9, 18));

// Excel's ROUND: half away from zero (the samples avoid exact halves).
const round = (x, d) => Math.sign(x) * Math.round(Math.abs(x) * 10 ** d) / 10 ** d;

// A sheet writer: cells by address, a formula with the value Excel would save.
function writer(ws, results){
  const put = (addr, value, numFmt) => { const c = ws.getCell(addr); c.value = value; if(numFmt) c.numFmt = numFmt; return c; };
  return {
    text: (addr, t, bold) => { const c = put(addr, t); if(bold) c.font = { bold: true }; },
    num: (addr, n, numFmt) => put(addr, n, numFmt),
    f: (addr, formula, result, numFmt) => put(addr, results ? { formula, result } : { formula }, numFmt),
    // A formula filled along a row as Excel saves it: the first cell holds it, the others share it.
    shared: (row, formula, values, numFmt) => {
      const ref = COLS[0] + row + ':' + COLS[COLS.length - 1] + row;
      put(COLS[0] + row, results ? { formula, result: values[0], shareType: 'shared', ref } : { formula, shareType: 'shared', ref }, numFmt);
      for(let i = 1; i < COLS.length; i++){
        put(COLS[i] + row, results ? { sharedFormula: COLS[0] + row, result: values[i] } : { sharedFormula: COLS[0] + row }, numFmt);
      }
    },
    // The same formula typed into each period's cell (no sharing), column letters moved along.
    each: (row, formulaFor, values, numFmt) => COLS.forEach((c, i) => put(c + row, results ? { formula: formulaFor(c, i), result: values[i] } : { formula: formulaFor(c, i) }, numFmt)),
    row: (row, label, unit, bold) => { put('A' + row, label); if(bold) ws.getCell('A' + row).font = { bold: true }; if(unit) put('B' + row, unit); },
    inputs: (row, values, numFmt) => COLS.forEach((c, i) => put(c + row, values[i], numFmt)),
  };
}

function yearHeader(w, row){
  w.text('A' + row, 'Year', true);
  w.inputs(row, YEARS);
}

const prev = (c) => String.fromCharCode(c.charCodeAt(0) - 1);

// ---------- the samples ----------

const SAMPLES = {
  // Rows by periods, one formula along each row: what the importer must get fully right.
  '01-simple-rows': (wb, results) => {
    const ws = wb.addWorksheet('Model');
    const w = writer(ws, results);
    w.text('A1', 'Simple profit model', true);
    yearHeader(w, 3);
    w.text('A5', 'Revenue', true);
    const volume = [400, 420, 441, 463, 486], price = [10, 10.5, 11, 11.5, 12];
    w.row(6, 'Volume', 'units'); w.inputs(6, volume, '#,##0');
    w.row(7, 'Price', '£'); w.inputs(7, price, '#,##0.00');
    const revenue = volume.map((v, i) => v * price[i]);
    w.row(8, 'Revenue', '£'); w.shared(8, 'D6*D7', revenue, '#,##0');
    w.text('A10', 'Costs', true);
    const rate = [0.6, 0.6, 0.58, 0.58, 0.55];
    w.row(11, 'Cost rate', '%'); w.inputs(11, rate, '0%');
    const costs = revenue.map((r, i) => r * rate[i]);
    w.row(12, 'Costs', '£'); w.shared(12, 'D8*D11', costs, '#,##0');
    const profit = revenue.map((r, i) => r - costs[i]);
    w.row(14, 'Profit', '£', true); w.each(14, (c) => c + '8-' + c + '12', profit, '#,##0');
  },

  // A corkscrew: the opening balance is typed in the first period, then the previous closing;
  // one assumption in its own cell, read with $ in every period.
  '02-corkscrew': (wb, results) => {
    const ws = wb.addWorksheet('Assets');
    const w = writer(ws, results);
    w.text('A1', 'Fixed assets', true);
    yearHeader(w, 3);
    w.row(5, 'Depreciation rate', '%'); w.num('C5', 0.1, '0%');
    const additions = [200, 150, 100, 100, 50];
    const opening = [], dep = [], closing = [];
    additions.forEach((a, i) => {
      opening.push(i === 0 ? 1000 : closing[i - 1]);
      dep.push(opening[i] * 0.1);
      closing.push(opening[i] + a - dep[i]);
    });
    w.row(7, 'Opening balance', '£');
    w.num('D7', 1000, '#,##0');
    COLS.slice(1).forEach((c, k) => w.f(c + '7', prev(c) + '10', opening[k + 1], '#,##0'));
    w.row(8, 'Additions', '£'); w.inputs(8, additions, '#,##0');
    w.row(9, 'Depreciation', '£'); w.shared(9, 'D7*$C$5', dep, '#,##0');
    w.row(10, 'Closing balance', '£', true); w.shared(10, 'D7+D8-D9', closing, '#,##0');
  },

  // Two sheets: inputs on one, the calculation on the other; a named cell; the functions
  // fmIDE has operators for; a header row linked to the other sheet's.
  '03-two-sheets': (wb, results) => {
    const inp = wb.addWorksheet('Inputs');
    const wi = writer(inp, results);
    wi.text('A1', 'Inputs', true);
    yearHeader(wi, 3);
    const units = [0, 1200, 1500, 1800, 2000], price = [25, 25, 26, 27, 28], fixed = [8000, 9000, 9000, 50000, 9500];
    wi.row(5, 'Units sold', 'units'); wi.inputs(5, units, '#,##0');
    wi.row(6, 'Unit price', '£'); wi.inputs(6, price, '#,##0.00');
    wi.row(7, 'Fixed costs', '£'); wi.inputs(7, fixed, '#,##0');
    wi.row(8, 'Tax rate', '%'); wi.num('C8', 0.25, '0%');
    wb.definedNames.add('Inputs!$C$8', 'TaxRate');

    const ws = wb.addWorksheet('Calc');
    const w = writer(ws, results);
    w.text('A1', 'Profit and loss', true);
    w.text('A3', 'Year', true);
    w.each(3, (c) => 'Inputs!' + c + '3', YEARS);
    const revenue = units.map((u, i) => u * price[i]);
    w.row(5, 'Revenue', '£'); w.each(5, (c) => 'Inputs!' + c + '5*Inputs!' + c + '6', revenue, '#,##0');
    w.row(6, 'Fixed costs', '£'); w.each(6, (c) => 'Inputs!' + c + '7', fixed, '#,##0');
    const variable = revenue.map(r => round(r * 0.4, 0));
    w.row(7, 'Variable costs', '£'); w.shared(7, 'ROUND(D5*0.4,0)', variable, '#,##0');
    const total = fixed.map((f, i) => f + variable[i]);
    w.row(8, 'Total costs', '£'); w.shared(8, 'SUM(D6:D7)', total, '#,##0');
    const ebit = revenue.map((r, i) => r - total[i]);
    w.row(9, 'EBIT', '£', true); w.shared(9, 'D5-D8', ebit, '#,##0');
    const tax = ebit.map(e => Math.max(0, e * 0.25));
    w.row(10, 'Tax', '£'); w.shared(10, 'MAX(0,D9*TaxRate)', tax, '#,##0');
    const net = ebit.map((e, i) => e - tax[i]);
    w.row(11, 'Net income', '£', true); w.shared(11, 'D9-D10', net, '#,##0');
    const margin = net.map((n, i) => revenue[i] === 0 ? 0 : n / revenue[i]);
    w.row(12, 'Net margin', '%'); w.shared(12, 'IFERROR(D11/D5,0)', margin, '0.0%');
    const flag = net.map(n => n < 0 ? 1 : 0);
    w.row(13, 'Loss flag', ''); w.shared(13, 'IF(D11<0,1,0)', flag, '0');
  },

  // What the first version can't translate: a lookup, sums across the periods, a running
  // total, a typed number in the middle of a formula row; dates as the period header.
  '04-not-supported': (wb, results) => {
    const ws = wb.addWorksheet('Valuation');
    const lk = wb.addWorksheet('Lookup');
    const wl = writer(lk, results);
    wl.text('A1', 'Region', true); wl.text('B1', 'Growth', true);
    const growthOf = { 1: 0.02, 2: 0.05, 3: 0.08 };
    [1, 2, 3].forEach((r, i) => { wl.num('A' + (i + 2), r); wl.num('B' + (i + 2), growthOf[r], '0%'); });

    const w = writer(ws, results);
    w.text('A1', 'Valuation', true);
    w.text('A3', 'Year end', true);
    COLS.forEach((c, i) => w.num(c + '3', new Date(Date.UTC(YEARS[i], 11, 31)), 'dd/mm/yyyy'));
    w.row(5, 'Region', ''); w.num('C5', 2, '0');
    const growth = YEARS.map(() => growthOf[2]);
    w.row(6, 'Growth', '%'); w.shared(6, 'VLOOKUP($C$5,Lookup!$A$2:$B$4,2,FALSE)', growth, '0%');
    const revenue = [];
    growth.forEach((g, i) => revenue.push(i === 0 ? 1000 : revenue[i - 1] * (1 + g)));
    w.row(7, 'Revenue', '£'); w.num('D7', 1000, '#,##0');
    COLS.slice(1).forEach((c, k) => w.f(c + '7', prev(c) + '7*(1+' + c + '6)', revenue[k + 1], '#,##0'));
    const cash = revenue.map(r => r * 0.2);
    w.row(8, 'Cash flow', '£'); w.shared(8, 'D7*0.2', cash, '#,##0');
    w.row(9, 'Discount rate', '%'); w.num('C9', 0.1, '0%');
    const npv = cash.reduce((s, c, i) => s + c / (1.1 ** (i + 1)), 0);
    w.row(10, 'NPV', '£', true); w.f('C10', 'NPV(C9,D8:H8)', npv, '#,##0');
    const cumulative = []; cash.forEach((c, i) => cumulative.push((i ? cumulative[i - 1] : 0) + c));
    w.row(11, 'Cumulative cash', '£'); w.each(11, (c) => 'SUM($D$8:' + c + '8)', cumulative, '#,##0');
    w.row(12, 'Cash doubled', '£');
    COLS.forEach((c, i) => i === 2 ? w.num(c + '12', 999, '#,##0') : w.f(c + '12', c + '8*2', cash[i] * 2, '#,##0'));
    w.row(13, 'Years above 220', ''); w.f('C13', 'COUNTIF(D8:H8,">220")', cash.filter(c => c > 220).length, '0');
  },
};

// One sample as a workbook (results: false leaves the saved values out, for LibreOffice).
function build(name, opts){
  const results = !(opts && opts.results === false);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'fmIDE test samples';
  wb.created = FIXED_DATE;
  wb.modified = FIXED_DATE;
  SAMPLES[name](wb, results);
  return wb;
}

async function writeAll(dir){
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for(const name of Object.keys(SAMPLES)){
    const file = path.join(dir, name + '.xlsx');
    await build(name).xlsx.writeFile(file);
    written.push(file);
  }
  return written;
}

module.exports = { SAMPLES, build, writeAll, YEARS, COLS };

if(require.main === module){
  writeAll(process.argv[2] ? path.resolve(process.argv[2]) : OUT)
    .then(files => files.forEach(f => console.log('wrote ' + path.relative(process.cwd(), f))))
    .catch(e => { console.error(e); process.exit(1); });
}
