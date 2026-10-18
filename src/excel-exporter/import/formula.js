// ---------- importing an Excel model: formulas (src/excel-exporter/import/formula.js; step 20c) ----------
// Excel's formula language (A1 references, as an .xlsx saves it) read into a tree, never run:
//   { type: 'num', value } · { type: 'str', value } · { type: 'bool', value } · { type: 'err', value }
//   { type: 'ref', sheet, col, row, colAbs, rowAbs }          a cell (sheet null: this sheet)
//   { type: 'range', sheet, from, to }                        from/to: { col, row, colAbs, rowAbs };
//                                                             a whole column has row null, a whole row col null
//   { type: 'name', name }                                    a defined name
//   { type: 'func', name, args }                              name in capitals, _xlfn. taken off
//   { type: 'unary', op ('-' | '+'), arg } · { type: 'percent', arg }
//   { type: 'binary', op ('+' '-' '*' '/' '^' '&' '=' '<>' '<' '>' '<=' '>='), left, right }
//   { type: 'missing' }                                       an argument left out: IF(a,,b)
//   { type: 'unsupported', what, text }                       an array constant, a table's column,
//                                                             another workbook, several sheets
// with Excel's precedence (negation before ^, so -2^2 is 4; ^ from the left). xlShiftFormula
// moves a tree's relative references, as Excel copies a shared formula to each of its cells;
// xlFormulaText writes a tree back as text.

import { XlImportError, XL_LIMITS } from './zip.js';
import { xlColNumber, xlColLetters, XL_MAX_ROW, XL_MAX_COL } from './workbook.js';

const XL_ERROR_LITERALS = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA', '#SPILL!', '#CALC!'];

function xlUnreadable(text, why){
  return new XlImportError('formula-unreadable', 'The formula ' + JSON.stringify(String(text).slice(0, 80)) + ' can\'t be read' + (why ? ': ' + why : '') + '.');
}

// A reference part ("$B$7", "C", "12") as { col, row, colAbs, rowAbs }; null when out of the grid.
function xlRefPart(colText, rowText){
  const part = { col: null, row: null, colAbs: false, rowAbs: false };
  if(colText){
    part.colAbs = colText[0] === '$';
    part.col = xlColNumber(colText.replace('$', ''));
    if(!part.col) return null;
  }
  if(rowText){
    part.rowAbs = rowText[0] === '$';
    part.row = Number(rowText.replace('$', ''));
    if(!Number.isInteger(part.row) || part.row < 1 || part.row > XL_MAX_ROW) return null;
  }
  return part;
}

// The tokens of a formula: { t: 'num'|'str'|'bool'|'err'|'ref'|'range'|'name'|'func'|'op'|'('|')'|','|'unsupported', … }.
const XL_SHEET = "(?:'((?:[^']|'')+)'|([A-Za-z_\\u00C0-\\uFFFF][A-Za-z0-9_.\\u00C0-\\uFFFF]*))!";
const XL_CELL = '(\\$?[A-Za-z]{1,3})(\\$?[0-9]{1,7})';
const XL_RE_SHEET = new RegExp('^' + XL_SHEET);
const XL_RE_RANGE = new RegExp('^' + XL_CELL + ':' + XL_CELL + '(?![A-Za-z0-9_(.])');
const XL_RE_CELL = new RegExp('^' + XL_CELL + '(?![A-Za-z0-9_(.!])');
const XL_RE_COLS = /^(\$?[A-Za-z]{1,3}):(\$?[A-Za-z]{1,3})(?![A-Za-z0-9_(.])/;
const XL_RE_ROWS = /^(\$?[0-9]{1,7}):(\$?[0-9]{1,7})(?![A-Za-z0-9_(.])/;
const XL_RE_NUM = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/;
const XL_RE_NAME = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*/;

function xlTokenize(text){
  const tokens = [];
  let i = 0;
  const s = text;
  while(i < s.length){
    const ch = s[i];
    if(ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'){ i++; continue; }
    const rest = s.slice(i);
    if(ch === '"'){
      let j = i + 1, out = '';
      for(;;){
        if(j >= s.length) throw xlUnreadable(text, 'a text is not closed');
        if(s[j] === '"'){ if(s[j + 1] === '"'){ out += '"'; j += 2; continue; } break; }
        out += s[j++];
      }
      tokens.push({ t: 'str', value: out });
      i = j + 1;
      continue;
    }
    if(ch === '{'){
      const j = s.indexOf('}', i);
      if(j < 0) throw xlUnreadable(text, 'a list is not closed');
      tokens.push({ t: 'unsupported', what: 'an array constant', text: s.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if(ch === '#'){
      const e = XL_ERROR_LITERALS.find(x => rest.toUpperCase().startsWith(x));
      if(!e) throw xlUnreadable(text, 'an error that is not one of Excel\'s');
      tokens.push({ t: 'err', value: e });
      i += e.length;
      continue;
    }
    if(ch === '['){
      // Another workbook ([1]Sheet!A1) or a table's column (Table1[Col] is read with the name).
      const j = s.indexOf(']', i);
      if(j < 0) throw xlUnreadable(text, 'a bracket is not closed');
      let k = j + 1;
      const after = XL_RE_SHEET.exec(s.slice(k)) || /^[A-Za-z_][A-Za-z0-9_.]*!?/.exec(s.slice(k));
      if(after) k += after[0].length;
      const ref = /^(\$?[A-Za-z]{1,3}\$?[0-9]{1,7}(?::\$?[A-Za-z]{1,3}\$?[0-9]{1,7})?)/.exec(s.slice(k));
      if(ref) k += ref[0].length;
      tokens.push({ t: 'unsupported', what: 'another workbook', text: s.slice(i, k) });
      i = k;
      continue;
    }
    // A sheet name, then the reference it qualifies ('Jan:Mar'!A1 spans several sheets).
    let sheet = null, at = i;
    const sm = XL_RE_SHEET.exec(rest);
    if(sm){
      sheet = sm[1] !== undefined ? sm[1].replace(/''/g, '\'') : sm[2];
      at = i + sm[0].length;
    }
    const several = sheet !== null && sheet.includes(':');
    const r2 = s.slice(at);
    let m;
    if((m = XL_RE_RANGE.exec(r2))){
      const from = xlRefPart(m[1], m[2]), to = xlRefPart(m[3], m[4]);
      if(!from || !to) throw xlUnreadable(text, 'a reference outside Excel\'s grid');
      tokens.push(several ? { t: 'unsupported', what: 'several sheets', text: s.slice(i, at + m[0].length) } : { t: 'range', sheet, from, to });
      i = at + m[0].length;
      continue;
    }
    if((m = XL_RE_CELL.exec(r2))){
      const p = xlRefPart(m[1], m[2]);
      if(p && !/^(TRUE|FALSE)$/i.test(m[0])){
        tokens.push(several ? { t: 'unsupported', what: 'several sheets', text: s.slice(i, at + m[0].length) } : { t: 'ref', sheet, ...p });
        i = at + m[0].length;
        continue;
      }
    }
    if((m = XL_RE_COLS.exec(r2)) && !/^(TRUE|FALSE)$/i.test(m[1].replace('$', ''))){
      const from = xlRefPart(m[1], ''), to = xlRefPart(m[2], '');
      if(from && to){ tokens.push({ t: 'range', sheet, from, to }); i = at + m[0].length; continue; }
    }
    if((m = XL_RE_ROWS.exec(r2))){
      const from = xlRefPart('', m[1]), to = xlRefPart('', m[2]);
      if(from && to){ tokens.push({ t: 'range', sheet, from, to }); i = at + m[0].length; continue; }
    }
    if(several) throw xlUnreadable(text, 'several sheets without a reference');
    if(sheet !== null){
      // A name on a sheet (Sheet1!Rate) is read as the name.
      const nm = XL_RE_NAME.exec(r2);
      if(!nm) throw xlUnreadable(text, 'a sheet name without a reference');
      tokens.push({ t: 'name', name: nm[0], sheet });
      i = at + nm[0].length;
      continue;
    }
    if((m = XL_RE_NUM.exec(rest))){
      const value = Number(m[0]);
      if(!Number.isFinite(value)) throw xlUnreadable(text, 'a number too large');
      tokens.push({ t: 'num', value });
      i += m[0].length;
      continue;
    }
    if((m = XL_RE_NAME.exec(rest))){
      let name = m[0];
      let j = i + name.length;
      while(s[j] === ' ') j++;
      if(s[j] === '('){
        tokens.push({ t: 'func', name: name.toUpperCase().replace(/^_XLFN\.(_XLWS\.)?/, '').replace(/^_XLWS\./, '') });
        i = j;
        continue;
      }
      if(s[i + name.length] === '['){
        // A table's column: Sales[Amount], Sales[[#This Row],[Amount]].
        let depth = 0, k = i + name.length;
        for(; k < s.length; k++){ if(s[k] === '[') depth++; else if(s[k] === ']'){ depth--; if(!depth){ k++; break; } } }
        tokens.push({ t: 'unsupported', what: 'a table\'s column', text: s.slice(i, k) });
        i = k;
        continue;
      }
      if(/^(TRUE|FALSE)$/i.test(name)) tokens.push({ t: 'bool', value: /^TRUE$/i.test(name) });
      else tokens.push({ t: 'name', name, sheet: null });
      i += name.length;
      continue;
    }
    const two = s.slice(i, i + 2);
    if(two === '<>' || two === '<=' || two === '>='){ tokens.push({ t: 'op', op: two }); i += 2; continue; }
    if('+-*/^&=<>%'.includes(ch)){ tokens.push({ t: 'op', op: ch }); i++; continue; }
    if(ch === '(' || ch === ')' || ch === ','){ tokens.push({ t: ch }); i++; continue; }
    if(ch === ';') throw xlUnreadable(text, 'a semicolon (a formula saved in another form)');
    throw xlUnreadable(text, 'an unexpected ' + JSON.stringify(ch));
  }
  return tokens;
}

const XL_COMPARE = new Set(['=', '<>', '<', '>', '<=', '>=']);

// A formula's text (without its '=') as a tree; throws an XlImportError when it can't be read.
export function xlParseFormula(text){
  if(typeof text !== 'string') throw xlUnreadable('', 'it is not text');
  if(text.length > XL_LIMITS.formulaChars) throw new XlImportError('formula-too-long', 'A formula is longer than ' + XL_LIMITS.formulaChars + ' characters, more than Excel allows.');
  const source = text[0] === '=' ? text.slice(1) : text;
  const tokens = xlTokenize(source);
  let pos = 0, depth = 0;
  const peek = () => tokens[pos];
  const isOp = (tok, ops) => tok && tok.t === 'op' && ops.includes(tok.op);
  const deeper = () => {
    if(++depth > XL_LIMITS.nesting) throw new XlImportError('formula-too-deep', 'A formula nests more than ' + XL_LIMITS.nesting + ' levels deep.');
  };

  function compare(){
    let left = concat();
    while(peek() && peek().t === 'op' && XL_COMPARE.has(peek().op)){ const op = tokens[pos++].op; left = { type: 'binary', op, left, right: concat() }; }
    return left;
  }
  function concat(){
    let left = additive();
    while(isOp(peek(), ['&'])){ pos++; left = { type: 'binary', op: '&', left, right: additive() }; }
    return left;
  }
  function additive(){
    let left = multiplicative();
    while(isOp(peek(), ['+', '-'])){ const op = tokens[pos++].op; left = { type: 'binary', op, left, right: multiplicative() }; }
    return left;
  }
  function multiplicative(){
    let left = power();
    while(isOp(peek(), ['*', '/'])){ const op = tokens[pos++].op; left = { type: 'binary', op, left, right: power() }; }
    return left;
  }
  function power(){
    let left = unary();
    while(isOp(peek(), ['^'])){ pos++; left = { type: 'binary', op: '^', left, right: unary() }; }
    return left;
  }
  function unary(){
    if(isOp(peek(), ['-', '+'])){
      const op = tokens[pos++].op;
      deeper();
      const arg = unary();
      depth--;
      return { type: 'unary', op, arg };
    }
    let node = primary();
    while(isOp(peek(), ['%'])){ pos++; node = { type: 'percent', arg: node }; }
    return node;
  }
  function primary(){
    const tok = tokens[pos++];
    if(!tok) throw xlUnreadable(source, 'it ends too soon');
    switch(tok.t){
      case 'num': return { type: 'num', value: tok.value };
      case 'str': return { type: 'str', value: tok.value };
      case 'bool': return { type: 'bool', value: tok.value };
      case 'err': return { type: 'err', value: tok.value };
      case 'ref': return { type: 'ref', sheet: tok.sheet, col: tok.col, row: tok.row, colAbs: tok.colAbs, rowAbs: tok.rowAbs };
      case 'range': return { type: 'range', sheet: tok.sheet, from: tok.from, to: tok.to };
      case 'name': return tok.sheet ? { type: 'name', name: tok.name, sheet: tok.sheet } : { type: 'name', name: tok.name };
      case 'unsupported': return { type: 'unsupported', what: tok.what, text: tok.text };
      case '(': {
        deeper();
        const inner = compare();
        depth--;
        if(!peek() || peek().t !== ')') throw xlUnreadable(source, 'a bracket is not closed');
        pos++;
        return inner;
      }
      case 'func': {
        deeper();
        pos++; // the '('
        const args = [];
        if(peek() && peek().t === ')'){ pos++; depth--; return { type: 'func', name: tok.name, args }; }
        for(;;){
          const next = peek();
          if(next && (next.t === ',' || next.t === ')')) args.push({ type: 'missing' });
          else args.push(compare());
          const sep = tokens[pos++];
          if(!sep) throw xlUnreadable(source, 'a bracket is not closed');
          if(sep.t === ')') break;
          if(sep.t !== ',') throw xlUnreadable(source, 'something unexpected in ' + tok.name + '(…)');
          if(peek() && peek().t === ')'){ args.push({ type: 'missing' }); pos++; break; }
        }
        depth--;
        return { type: 'func', name: tok.name, args };
      }
      default: throw xlUnreadable(source, 'something unexpected');
    }
  }
  if(!tokens.length) throw xlUnreadable(source, 'it is empty');
  const tree = compare();
  if(pos < tokens.length) throw xlUnreadable(source, 'something after its end');
  return tree;
}

// A tree with its relative references moved by dRow rows and dCol columns (a shared formula
// copied to another cell). A reference moved off the grid becomes #REF!, as in Excel.
export function xlShiftFormula(tree, dRow, dCol){
  const movePart = (p) => {
    const q = { ...p };
    if(q.col !== null && !q.colAbs) q.col += dCol;
    if(q.row !== null && !q.rowAbs) q.row += dRow;
    const ok = (q.col === null || (q.col >= 1 && q.col <= XL_MAX_COL)) && (q.row === null || (q.row >= 1 && q.row <= XL_MAX_ROW));
    return ok ? q : null;
  };
  const walk = (n) => {
    switch(n.type){
      case 'ref': { const p = movePart(n); return p ? { ...n, col: p.col, row: p.row } : { type: 'err', value: '#REF!' }; }
      case 'range': { const a = movePart(n.from), b = movePart(n.to); return a && b ? { ...n, from: a, to: b } : { type: 'err', value: '#REF!' }; }
      case 'func': return { ...n, args: n.args.map(walk) };
      case 'unary': case 'percent': return { ...n, arg: walk(n.arg) };
      case 'binary': return { ...n, left: walk(n.left), right: walk(n.right) };
      default: return n;
    }
  };
  return walk(tree);
}

const XL_PRECEDENCE = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

function xlSheetPrefix(sheet){
  if(sheet === null || sheet === undefined) return '';
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) && !/^[A-Za-z]{1,3}[0-9]+$/.test(sheet) ? sheet + '!' : '\'' + sheet.replace(/'/g, '\'\'') + '\'!';
}
function xlPartText(p){
  return (p.col !== null ? (p.colAbs ? '$' : '') + xlColLetters(p.col) : '') + (p.row !== null ? (p.rowAbs ? '$' : '') + p.row : '');
}
function xlNumberText(v){
  const s = String(v);
  return s.replace(/e\+/, 'E+').replace(/e-/, 'E-');
}

// A tree as Excel's text (without '='), brackets only where precedence needs them.
export function xlFormulaText(tree){
  const text = (n, parentPrec, rightSide) => {
    switch(n.type){
      case 'num': return xlNumberText(n.value);
      case 'str': return '"' + n.value.replace(/"/g, '""') + '"';
      case 'bool': return n.value ? 'TRUE' : 'FALSE';
      case 'err': return n.value;
      case 'missing': return '';
      case 'ref': return xlSheetPrefix(n.sheet) + xlPartText(n);
      case 'range': return xlSheetPrefix(n.sheet) + xlPartText(n.from) + ':' + xlPartText(n.to);
      case 'name': return xlSheetPrefix(n.sheet) + n.name;
      case 'unsupported': return n.text;
      case 'func': return n.name + '(' + n.args.map(a => text(a, 0, false)).join(',') + ')';
      case 'unary': return n.op + text(n.arg, 6, false);
      case 'percent': return text(n.arg, 7, false) + '%';
      case 'binary': {
        const p = XL_PRECEDENCE[n.op];
        const s = text(n.left, p, false) + n.op + text(n.right, p, true);
        return p < parentPrec || (p === parentPrec && rightSide) ? '(' + s + ')' : s;
      }
      default: return '';
    }
  };
  return text(tree, 0, false);
}

// Gives every cell of a shared formula its own text, as Excel copies it (xlReadWorkbook keeps
// only the first cell's): the first cell's tree moved by the distance to each cell. A cell
// whose first cell is missing or can't be read gets `unreadable`, saying why.
export function xlFillSharedFormulas(book){
  for(const sheet of book.sheets){
    const masters = new Map();
    for(const c of sheet.cells.values()){
      if(c.shared && c.formula !== null && !masters.has(c.shared.index)) masters.set(c.shared.index, c);
    }
    const trees = new Map();
    for(const c of sheet.cells.values()){
      if(!c.shared || c.formula !== null) continue;
      const m = masters.get(c.shared.index);
      if(!m){ c.unreadable = 'its shared formula is missing'; continue; }
      if(!trees.has(m)){
        try{ trees.set(m, xlParseFormula(m.formula)); } catch(e){ trees.set(m, e); }
      }
      const tree = trees.get(m);
      if(tree instanceof Error){ c.unreadable = tree.message; continue; }
      c.formula = xlFormulaText(xlShiftFormula(tree, c.row - m.row, c.col - m.col));
    }
  }
  return book;
}
