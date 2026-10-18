// ---------- importing an Excel model: the round trip (src/excel-exporter/import/recalc.js) ----------
// xlRecalc(wb) works out the cells of a workbook as ExcelExporter's writer takes it
// (wb.SheetNames, wb.Sheets[name][address] = { t, v, f }) from their formulas' text, read by
// the import's own parser (formula.js) — never run as code. It knows the functions the
// workbook ExcelExporter writes uses (the arithmetic, comparisons, SUM, MIN, MAX, AVERAGE,
// PRODUCT, AND, OR, NOT, IF, IFERROR, the roundings, ABS, LN, EXP, SQRT, INT, TRUNC, MOD,
// POWER, CHOOSE, INDEX, N, NA); anything else is #NAME?, which the round trip counts as not
// checked. A value is a number, text, TRUE/FALSE, or { error: '#N/A' }.
// xlRoundTrip(valueOf, cells) compares cells of it with Excel's saved values: { compared,
// agree, differ, unchecked }.

import { xlParseFormula } from './formula.js';
import { xlAddress } from './workbook.js';
import { xlAgree } from './check.js';

const XL_RECALC_DEPTH = 5000; // formulas reading formulas, deeper than this: not checked

const xlErr = (code) => ({ error: code });
const xlIsErr = (v) => !!v && typeof v === 'object' && typeof v.error === 'string';

// A value as a number (TRUE 1, FALSE 0, a blank 0, numeric text its number), or an error.
function xlNum(v){
  if(xlIsErr(v)) return v;
  if(typeof v === 'number') return Number.isFinite(v) ? v : xlErr('#NUM!');
  if(typeof v === 'boolean') return v ? 1 : 0;
  if(v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).trim());
  return String(v).trim() !== '' && Number.isFinite(n) ? n : xlErr('#VALUE!');
}
function xlBool(v){
  const n = xlNum(v);
  return xlIsErr(n) ? n : n !== 0;
}
// Excel's rounding: half away from zero (up: away from zero, down: towards it), on the number
// as Excel shows it (15 significant digits).
function xlRound(v, d, mode){
  const digits = Math.trunc(d);
  const f = Math.pow(10, digits);
  const x = Number((Math.abs(v) * f).toPrecision(15));
  const r = mode === 'up' ? Math.ceil(x) : mode === 'down' ? Math.floor(x) : Math.round(x);
  return Math.sign(v) * r / f;
}

export function xlRecalc(wb){
  const memo = new Map();
  let depth = 0;
  const sheetOf = (name) => wb.Sheets[name] || null;

  function cellValue(sheetName, col, row){
    const key = sheetName + '!' + col + ',' + row;
    if(memo.has(key)){
      const m = memo.get(key);
      return m === XL_BUSY ? xlErr('#CYCLE') : m;
    }
    const ws = sheetOf(sheetName);
    if(!ws) return xlErr('#REF!');
    const cell = ws[xlAddress(col, row)];
    if(!cell) return null;
    if(typeof cell.f !== 'string' || !cell.f){
      return cell.v === undefined ? null : cell.v;
    }
    if(depth > XL_RECALC_DEPTH) return xlErr('#DEPTH');
    memo.set(key, XL_BUSY);
    depth++;
    let v;
    try{
      let tree;
      try{ tree = xlParseFormula(cell.f); } catch(e){ tree = null; }
      v = tree ? evaluate(tree, sheetName) : xlErr('#NAME?');
    } finally { depth--; }
    memo.set(key, v);
    return v;
  }

  // A range's cells, in order (rows, then columns), as values.
  function rangeValues(node, self){
    const sheet = node.sheet || self;
    const c1 = Math.min(node.from.col, node.to.col), c2 = Math.max(node.from.col, node.to.col);
    const r1 = Math.min(node.from.row, node.to.row), r2 = Math.max(node.from.row, node.to.row);
    if(!(c1 >= 1 && r1 >= 1) || (c2 - c1 + 1) * (r2 - r1 + 1) > 100000) return { error: xlErr('#REF!') };
    const out = [];
    for(let r = r1; r <= r2; r++) for(let c = c1; c <= c2; c++) out.push(cellValue(sheet, c, r));
    return { values: out, rows: r2 - r1 + 1, cols: c2 - c1 + 1 };
  }

  // The numbers of a list function's inputs: a range's numbers only (text, blanks and
  // TRUE/FALSE left out, as Excel does); an input written in the formula as a number.
  function numbersOf(args, self){
    const out = [];
    for(const a of args){
      if(a.type === 'range'){
        const r = rangeValues(a, self);
        if(r.error) return r.error;
        for(const v of r.values){ if(xlIsErr(v)) return v; if(typeof v === 'number') out.push(v); }
      } else {
        const v = xlNum(evaluate(a, self));
        if(xlIsErr(v)) return v;
        out.push(v);
      }
    }
    return out;
  }

  function evaluate(node, self){
    switch(node.type){
      case 'num': return node.value;
      case 'bool': return node.value;
      case 'str': return node.value;
      case 'err': return xlErr(node.value);
      case 'missing': return 0;
      case 'ref': return node.col && node.row ? cellValue(node.sheet || self, node.col, node.row) : xlErr('#REF!');
      case 'range': {
        const r = rangeValues(node, self);
        if(r.error) return r.error;
        return r.values.length === 1 ? r.values[0] : xlErr('#VALUE!');
      }
      case 'unary': {
        const v = xlNum(evaluate(node.arg, self));
        return xlIsErr(v) ? v : (node.op === '-' ? -v : v);
      }
      case 'percent': {
        const v = xlNum(evaluate(node.arg, self));
        return xlIsErr(v) ? v : v / 100;
      }
      case 'binary': return binary(node, self);
      case 'func': return func(node, self);
      default: return xlErr('#NAME?');
    }
  }

  function binary(node, self){
    const a = evaluate(node.left, self), b = evaluate(node.right, self);
    if(xlIsErr(a)) return a;
    if(xlIsErr(b)) return b;
    if(node.op === '&') return String(a === null ? '' : a) + String(b === null ? '' : b);
    if(['=', '<>', '<', '>', '<=', '>='].includes(node.op)){
      const x = a === null ? (typeof b === 'string' ? '' : 0) : a, y = b === null ? (typeof a === 'string' ? '' : 0) : b;
      let c;
      if(typeof x === 'number' && typeof y === 'number') c = Math.abs(x - y) <= 1e-12 * Math.max(Math.abs(x), Math.abs(y)) ? 0 : (x < y ? -1 : 1);
      else if(typeof x === typeof y) c = String(x).toLowerCase() < String(y).toLowerCase() ? -1 : String(x).toLowerCase() > String(y).toLowerCase() ? 1 : 0;
      else { const rank = (v) => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2; c = rank(x) - rank(y); }
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[node.op];
    }
    const x = xlNum(a), y = xlNum(b);
    if(xlIsErr(x)) return x;
    if(xlIsErr(y)) return y;
    let v;
    if(node.op === '+') v = x + y;
    else if(node.op === '-') v = x - y;
    else if(node.op === '*') v = x * y;
    else if(node.op === '/'){ if(y === 0) return xlErr('#DIV/0!'); v = x / y; }
    else if(node.op === '^'){ if(x === 0 && y < 0) return xlErr('#DIV/0!'); v = Math.pow(x, y); }
    else return xlErr('#NAME?');
    return Number.isFinite(v) ? v : xlErr('#NUM!');
  }

  function func(node, self){
    const f = node.name, a = node.args;
    const arg = (i) => i < a.length ? evaluate(a[i], self) : null;
    const num = (i) => xlNum(arg(i));
    const one = (fn) => { if(a.length !== 1) return xlErr('#VALUE!'); const v = num(0); if(xlIsErr(v)) return v; const r = fn(v); return typeof r === 'number' && Number.isFinite(r) ? r : xlErr('#NUM!'); };
    switch(f){
      case 'SUM': case 'MIN': case 'MAX': case 'AVERAGE': case 'PRODUCT': {
        const ns = numbersOf(a, self);
        if(xlIsErr(ns)) return ns;
        if(f === 'SUM') return ns.reduce((s, v) => s + v, 0);
        if(f === 'PRODUCT') return ns.length ? ns.reduce((s, v) => s * v, 1) : 0;
        if(f === 'AVERAGE') return ns.length ? ns.reduce((s, v) => s + v, 0) / ns.length : xlErr('#DIV/0!');
        if(!ns.length) return 0;
        return f === 'MIN' ? Math.min(...ns) : Math.max(...ns);
      }
      case 'AND': case 'OR': {
        const vs = [];
        for(const x of a){
          if(x.type === 'range'){ const r = rangeValues(x, self); if(r.error) return r.error; for(const v of r.values){ if(xlIsErr(v)) return v; if(typeof v === 'number' || typeof v === 'boolean') vs.push(v !== 0 && v !== false); } }
          else { const b = xlBool(evaluate(x, self)); if(xlIsErr(b)) return b; vs.push(b); }
        }
        if(!vs.length) return xlErr('#VALUE!');
        return f === 'AND' ? vs.every(Boolean) : vs.some(Boolean);
      }
      case 'NOT': { const b = xlBool(arg(0)); return xlIsErr(b) ? b : !b; }
      case 'IF': {
        const c = xlBool(arg(0));
        if(xlIsErr(c)) return c;
        return c ? (a.length > 1 ? arg(1) : true) : (a.length > 2 ? arg(2) : false);
      }
      case 'IFERROR': { const v = arg(0); return xlIsErr(v) ? arg(1) : v; }
      case 'ROUND': case 'ROUNDUP': case 'ROUNDDOWN': {
        const v = num(0), d = num(1);
        if(xlIsErr(v)) return v;
        if(xlIsErr(d)) return d;
        return xlRound(v, d, f === 'ROUND' ? 'half' : f === 'ROUNDUP' ? 'up' : 'down');
      }
      case 'ABS': return one(Math.abs);
      case 'LN': return one(v => v > 0 ? Math.log(v) : NaN);
      case 'EXP': return one(Math.exp);
      case 'SQRT': return one(v => v >= 0 ? Math.sqrt(v) : NaN);
      case 'INT': return one(Math.floor);
      case 'TRUNC': return one(Math.trunc);
      case 'MOD': {
        const x = num(0), y = num(1);
        if(xlIsErr(x)) return x;
        if(xlIsErr(y)) return y;
        if(y === 0) return xlErr('#DIV/0!');
        return x - y * Math.floor(x / y);
      }
      case 'POWER': return binary({ op: '^', left: a[0] || { type: 'missing' }, right: a[1] || { type: 'missing' } }, self);
      case 'CHOOSE': {
        const i = num(0);
        if(xlIsErr(i)) return i;
        const k = Math.trunc(i);
        return k >= 1 && k < a.length ? arg(k) : xlErr('#VALUE!');
      }
      case 'INDEX': {
        if(!a.length || a[0].type !== 'range') return xlErr('#VALUE!');
        const r = rangeValues(a[0], self);
        if(r.error) return r.error;
        let i = num(1), j = a.length > 2 ? num(2) : 1;
        if(xlIsErr(i)) return i;
        if(xlIsErr(j)) return j;
        i = Math.trunc(i); j = Math.trunc(j);
        // One row or one column: the one number picks along it.
        if(a.length === 2 && r.rows === 1){ j = i; i = 1; }
        if(i < 1 || j < 1 || i > r.rows || j > r.cols) return xlErr('#REF!');
        const v = r.values[(i - 1) * r.cols + (j - 1)];
        return v === null ? 0 : v;
      }
      case 'N': { const v = arg(0); return xlIsErr(v) ? v : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0; }
      case 'NA': return xlErr('#N/A');
      case 'TRUE': return true;
      case 'FALSE': return false;
      default: return xlErr('#NAME?');
    }
  }

  return { valueOf: (sheetName, address) => {
    const m = /^([A-Z]+)([0-9]+)$/.exec(address);
    if(!m) return xlErr('#REF!');
    let col = 0;
    for(const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    return cellValue(sheetName, col, Number(m[2]));
  } };
}
const XL_BUSY = Symbol('busy');

// The round trip: each cell { sheet, address, label, period, saved, excel? } — where the
// workbook ExcelExporter wrote holds an imported formula row's value (`at`: { tab, address }),
// next to the value the original saved for it — recalculated and compared. A value the
// recalculation can't give (an unknown function, a loop, too deep) is not checked; an Excel
// error agrees with an error.
export function xlRoundTrip(valueOf, cells){
  const out = { compared: 0, agree: 0, differ: [], unchecked: 0 };
  for(const c of cells){
    const got = valueOf(c.at.tab, c.at.address);
    if(xlIsErr(got) && (got.error === '#NAME?' || got.error === '#CYCLE' || got.error === '#DEPTH')){ out.unchecked++; continue; }
    out.compared++;
    const value = typeof got === 'boolean' ? (got ? 1 : 0) : got;
    if(c.excel ? xlIsErr(got) : xlAgree(value, c.saved)) out.agree++;
    else out.differ.push(Object.assign({}, c, { got: xlIsErr(got) ? got.error : value }));
  }
  return out;
}
