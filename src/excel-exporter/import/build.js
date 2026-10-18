// ---------- importing an Excel model: building the model (src/excel-exporter/import/build.js; step 20e) ----------
// xlBuildModel(book, plans, include) turns the sheets ticked on the confirm screen into an
// fmIDE `system` (version 9, docs/file-formats.md) and a report of what it did:
//   - a canvas per sheet, a rectangle per row (its label as the name, its unit as the unit);
//   - an input's numbers per period (`periodValues`, or one number when they are all the
//     same), an assumption's one number, an opening balance's typed number in period 1;
//   - each formula row's signature (layout.js) as a small tree left of its rectangle:
//     operators, period shifts, and aliases of the rectangles it reads, each alias placed in
//     its operator's input column so the operator reads its inputs in Excel's order (fmIDE
//     reads them left to right, then top to bottom);
//   - a cell of the row that differs (odd) keeps Excel's saved value as the rectangle's own
//     number in that period (`literalPeriods`, with `periodValues` when they differ);
//   - a row in parts keeps its typed actuals the same way, and its tree is its formula; a
//     row of two formulas switches by period through the canvas's shared rectangle
//     "Up to 2024" (1 up to that period, 0 after): if(Up to 2024, the first, the second);
//   - a formula reading the column before the first period reads that cell, as Excel does
//     (a blank is 0): if(period = 1, Excel's C92, …);
//   - a row that can't be translated keeps Excel's saved values as an input, and is listed
//     with why; a circular reference (within one period) is cut the same way.
// Nothing from the file runs; every name is kept as text, cut to a length fmIDE shows.

import { XlImportError } from './zip.js';
import { xlParseFormula } from './formula.js';
import { xlAddress, xlColLetters } from './workbook.js';

export const XL_SYSTEM_VERSION = 9;
const XL_NAME_MAX = 120;
const XL_RANGE_MAX = 500;
const XL_LANE = 90;      // the height of one input in a row's tree
const XL_ROW_GAP = 20;   // between rows
const XL_STEP = 220;     // from an operator to its inputs, leftwards
const XL_ALIAS_STEP = 190; // from a period shift to the alias feeding it (an alias is 170 wide)
const XL_RECT_X = 2000;  // the rectangles' column, before the canvas is moved to start at the left
const XL_MARGIN = 40;
const XL_SPACE = 45;     // a blank row or a title of the sheet, as space between rectangles
const XL_BLANKS_MAX = 20; // blank rows kept between two rows of the sheet, at most

class XlNotTranslated extends Error {
  constructor(why){ super(why); this.why = why; }
}

const XL_BINARY = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^', '=': '=', '<>': '≠', '<': '<', '>': '>', '<=': '≤', '>=': '≥' };
const XL_ONE_INPUT = { ABS: 'abs', LN: 'ln', EXP: 'exp', SQRT: 'sqrt', INT: 'int', NOT: 'not' };
const XL_LISTS = { SUM: '+', PRODUCT: '×', MIN: 'min', MAX: 'max', AVERAGE: 'ave', AND: 'and', OR: 'or' };
const XL_ROUNDS = { ROUND: 'round', ROUNDUP: 'roundup', ROUNDDOWN: 'rounddown' };

// A name as fmIDE keeps it: one line, no more than XL_NAME_MAX characters.
function xlCleanName(s){
  const t = String(s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > XL_NAME_MAX ? t.slice(0, XL_NAME_MAX - 1) + '…' : t;
}
function xlNumberText(v){ return Number.isFinite(v) ? String(v) : '0'; }

// A rectangle's text: "Name\nnumber\nunit" (a second line keeps a name that is a number a name).
function xlRectText(name, literal, unit){
  let t = name;
  if(literal !== null && literal !== undefined) t += '\n' + xlNumberText(literal);
  else if(unit || /^\s*[-+0-9.]/.test(name)) t += '\n';
  if(unit) t += '\n' + unit;
  return t;
}

// A cell's saved value as a number: true is 1, false 0, nothing 0; text and errors null.
function xlSavedNumber(cell){
  if(!cell || cell.empty) return 0;
  if(cell.error) return null;
  if(typeof cell.value === 'number') return cell.value;
  if(typeof cell.value === 'boolean') return cell.value ? 1 : 0;
  if(cell.value === null) return 0;
  return null;
}

// Builds the model. `include[i]` says whether sheet i is imported (only sheets by periods);
// `split[i]`, whether it is a canvas per section (`plan.sections`, layout.js) instead of one.
export function xlBuildModel(book, plans, include, split){
  const sheetsIn = plans.map((p, i) => i).filter(i => include[i] && plans[i].byPeriods);
  if(!sheetsIn.length) throw new XlImportError('nothing-to-import', 'Tick a sheet with periods to import.');
  const periods = plans[sheetsIn[0]].periods.slice();
  const N = periods.length;
  const report = { periodsFrom: plans[sheetsIn[0]].name, notTranslated: [], odd: [], notes: [], rows: [], noSaved: 0 };
  sheetsIn.forEach(i => {
    if(plans[i].periods.length !== N) report.notes.push('“' + plans[i].name + '” has ' + plans[i].periods.length + ' periods, “' + report.periodsFrom + '” ' + N + ': periods are matched in order');
  });

  // Defined names (not Excel's own, _xlnm.).
  const names = new Map();
  for(const n of book.names || []){
    if(/^_xlnm\./i.test(n.name)) continue;
    const key = n.name.toLowerCase() + '|' + (n.sheet === null ? '' : n.sheet);
    if(!names.has(key)) names.set(key, n);
  }

  // A canvas per sheet, or per section of a sheet split; a rectangle per row (all but titles).
  const canvases = [], canvasOfSheet = new Map(), rows = new Map(), extras = new Map();
  const canvasNames = new Set();
  const newCanvas = (i, name) => {
    let n = name, k = 2;
    while(canvasNames.has(n.toLowerCase())) n = xlCleanName(name + ' (' + (k++) + ')');
    canvasNames.add(n.toLowerCase());
    const c = { id: 'xl' + (canvases.length + 1), name: n, nodes: [], edges: [], usedNames: new Set(), next: 1, nextEdge: 1, sheet: i, items: [], constants: [] };
    canvases.push(c);
    return c;
  };
  const sectionsOf = (i) => split && split[i] && plans[i].sections && plans[i].sections.length >= 2 ? plans[i].sections : null;
  // Two sheets split, or a sheet split beside others: a section's canvas is named "Sheet — Section".
  const severalSheets = sheetsIn.length > 1;
  sheetsIn.forEach((i, k) => {
    const sheetName = xlCleanName(plans[i].name) || ('Sheet ' + (k + 1));
    const sections = sectionsOf(i);
    if(!sections){ canvasOfSheet.set(i, [{ from: 0, canvas: newCanvas(i, sheetName) }]); return; }
    canvasOfSheet.set(i, sections.map(sec => ({ from: sec.row, canvas: newCanvas(i, xlCleanName(severalSheets ? sheetName + ' — ' + sec.label : sec.label)) })));
    report.notes.push('“' + plans[i].name + '” is ' + sections.length + ' canvases, one per section');
  });
  // The canvas a row of sheet i goes on: its section's (rows before the first, the first's).
  const canvasFor = (i, row) => {
    const list = canvasOfSheet.get(i);
    let c = list[0].canvas;
    for(const x of list) if(row >= x.from) c = x.canvas;
    return c;
  };
  const nodeId = (c) => 'n' + (c.next++);
  const uniqueName = (c, base, row) => {
    let name = base || ('Row ' + row);
    if(c.usedNames.has(name.toLowerCase())) name = xlCleanName(name + ' (row ' + row + ')');
    let k = 2;
    while(c.usedNames.has(name.toLowerCase())) name = xlCleanName(base + ' (' + (k++) + ')');
    c.usedNames.add(name.toLowerCase());
    return name;
  };
  for(const i of sheetsIn){
    for(const r of plans[i].rows){
      const c = canvasFor(i, r.row);
      if(r.kind === 'title'){ c.items.push({ row: r.row, title: xlCleanName(r.label) }); continue; }
      const entry = { sheet: i, plan: r, canvas: c, id: nodeId(c), name: uniqueName(c, xlCleanName(r.label), r.row), unit: xlCleanName(r.unit).slice(0, 40), kind: r.kind, expr: null, why: null, deps: [] };
      rows.set(i + '|' + r.row, entry);
      c.items.push({ row: r.row, entry });
    }
  }

  // A rectangle made for what a formula reads outside the rows: the header row, a number on
  // a sheet not imported, an empty cell (Excel reads it as 0). Shared by every formula of
  // the canvas that reads it, placed at the top.
  function extra(c, key, make){
    const k = c.id + '|' + key;
    if(!extras.has(k)){
      const e = make();
      e.canvas = c; e.id = nodeId(c); e.name = uniqueName(c, e.name, 0); e.extra = true;
      extras.set(k, e);
    }
    return extras.get(k);
  }

  // The switch of a row of two formulas: one rectangle per canvas and period, shared by
  // every such row there — 1 up to that period, 0 after ("Up to 2024").
  const upTo = (c, to) => ({ k: 'ref', shift: 0, entry: extra(c, 'upto|' + to, () => ({
    name: xlCleanName('Up to ' + periods[to]), values: periods.map((_, p) => p <= to ? 1 : 0) })) });

  const sheetIndex = (name, self) => {
    if(name === null || name === undefined) return self;
    const k = book.sheets.findIndex(s => s.name === name);
    if(k >= 0) return k;
    const j = book.sheets.findIndex(s => s.name.toLowerCase() === String(name).toLowerCase());
    if(j >= 0) return j;
    throw new XlNotTranslated('a sheet that isn\'t in the workbook');
  };

  // What a cell reference reads, from a formula on sheet `self` in its first period column
  // (mode 'period') or in a single cell (mode 'single'): { k: 'ref', entry, shift } or a constant.
  function cellExpr(self, ctx, ref, inRange){
    const s = sheetIndex(ref.sheet, self);
    const plan = plans[s];
    const sheet = book.sheets[s];
    const imported = canvasOfSheet.has(s);
    const cell = sheet.cells.get(xlAddress(ref.col, ref.row));
    if(imported){
      const entry = rows.get(s + '|' + ref.row);
      const inPeriods = ref.col >= plan.firstCol && ref.col <= plan.lastCol;
      if(entry && (entry.kind === 'assumption' || entry.kind === 'single')){
        if(entry.plan.before && ref.col === entry.plan.before.col) return { k: 'ref', entry, shift: 0 };
      } else if(entry){
        if(ctx.mode === 'single') throw new XlNotTranslated('one period of a row, read from outside the periods');
        if(ref.colAbs && inPeriods){
          if(entry.kind === 'input' && xlIsConstantRow(entry)) return { k: 'ref', entry, shift: 0 };
          throw new XlNotTranslated('a fixed period ($' + xlColLetters(ref.col) + ')');
        }
        if(inPeriods || ref.col < plan.firstCol || ref.col > plan.lastCol){
          return xlBeforeThePeriods({ k: 'ref', entry, shift: ref.col - plan.firstCol }, sheet, plan, ref.row, ctx);
        }
      } else if(ref.row === plan.headerRow && inPeriods && !ref.colAbs && ctx.mode === 'period'){
        // The header row's years (or numbers), as an input of its own.
        const values = [];
        for(let col = plan.firstCol; col <= plan.lastCol; col++){
          const v = xlSavedNumber(sheet.cells.get(xlAddress(col, ref.row)));
          if(v === null) throw new XlNotTranslated('the header row\'s text');
          values.push(v);
        }
        const e = extra(ctx.canvas, 'header|' + s, () => ({ name: xlCleanName((plan.labelCol && xlText(sheet, plan.labelCol, ref.row)) || 'Period') + ' (header)', values }));
        return { k: 'ref', entry: e, shift: ref.col - plan.firstCol };
      }
    }
    // Any other cell: what it holds now, as a constant.
    if(!cell || cell.empty || (cell.value === null && cell.formula === null && !cell.error)){
      if(inRange) return null;
      return { k: 'const', value: 0 };
    }
    if(typeof cell.value === 'string' && cell.formula === null){
      if(inRange) return null;
      throw new XlNotTranslated('text in a calculation (' + xlCellName(book, s, ref) + ')');
    }
    if(cell.formula !== null || cell.unreadable){
      if(imported) throw new XlNotTranslated('a formula outside the rows (' + xlCellName(book, s, ref) + ')');
      const v = xlSavedNumber(cell);
      if(v === null) throw new XlNotTranslated('a cell holding text or an error (' + xlCellName(book, s, ref) + ')');
      const e = extra(ctx.canvas, 'cell|' + s + '|' + cell.address, () => ({ name: xlCleanName(book.sheets[s].name + '!' + cell.address), value: v, saved: true }));
      return { k: 'ref', entry: e, shift: 0 };
    }
    const v = xlSavedNumber(cell);
    if(v === null) throw new XlNotTranslated('a cell holding an error (' + xlCellName(book, s, ref) + ')');
    const e = extra(ctx.canvas, 'cell|' + s + '|' + cell.address, () => ({ name: xlCleanName(book.sheets[s].name + '!' + cell.address), value: v }));
    return { k: 'ref', entry: e, shift: 0 };
  }

  // A range inside SUM, MIN, AND… as a list (empty cells and text left out, as Excel does).
  function rangeList(self, ctx, rg){
    const { from, to } = rg;
    if(from.col === null || from.row === null || to.col === null || to.row === null) throw new XlNotTranslated('a whole column or row');
    const s = sheetIndex(rg.sheet, self);
    const plan = plans[s];
    const imported = canvasOfSheet.has(s);
    const c1 = Math.min(from.col, to.col), c2 = Math.max(from.col, to.col), r1 = Math.min(from.row, to.row), r2 = Math.max(from.row, to.row);
    if(imported && plan.byPeriods && c2 >= plan.firstCol && c1 <= plan.lastCol){
      if(from.colAbs !== to.colAbs) throw new XlNotTranslated('a range growing along the periods');
      if(c1 !== c2) throw new XlNotTranslated('a range along the periods');
    }
    if((c2 - c1 + 1) * (r2 - r1 + 1) > XL_RANGE_MAX) throw new XlNotTranslated('a range of more than ' + XL_RANGE_MAX + ' cells');
    const out = [];
    for(let col = c1; col <= c2; col++){
      for(let row = r1; row <= r2; row++){
        const e = cellExpr(self, ctx, { sheet: rg.sheet, col, row, colAbs: from.colAbs, rowAbs: from.rowAbs }, true);
        if(e) out.push(e);
      }
    }
    return out;
  }

  // A name: its cell or range, as if written in the formula.
  function resolveName(self, node){
    const scoped = names.get(node.name.toLowerCase() + '|' + self);
    const global = names.get(node.name.toLowerCase() + '|');
    const n = scoped || global;
    if(!n) throw new XlNotTranslated('a name that isn\'t defined (' + node.name + ')');
    let tree;
    try{ tree = xlParseFormula(n.ref); } catch(e){ throw new XlNotTranslated('the name ' + node.name); }
    if(tree.type !== 'ref' && tree.type !== 'range') throw new XlNotTranslated('the name ' + node.name + ', which is not a cell or range');
    return tree;
  }

  // An Excel formula tree as the model's expression.
  function toExpr(tree, self, ctx){
    const list = (args) => {
      const out = [];
      for(const a of args){
        let t = a;
        if(t.type === 'name') t = resolveName(self, t);
        if(t.type === 'range') out.push(...rangeList(self, ctx, t));
        else out.push(toExpr(t, self, ctx));
      }
      return out;
    };
    switch(tree.type){
      case 'num': return { k: 'const', value: tree.value };
      case 'bool': return { k: 'const', value: tree.value ? 1 : 0 };
      case 'missing': return { k: 'const', value: 0 };
      case 'str': throw new XlNotTranslated('text in a calculation');
      case 'err': throw new XlNotTranslated('the error ' + tree.value);
      case 'unsupported': throw new XlNotTranslated(tree.what);
      case 'ref': return cellExpr(self, ctx, tree, false);
      case 'range': {
        const l = rangeList(self, ctx, tree);
        if(l.length === 1) return l[0];
        throw new XlNotTranslated('a range used as one value');
      }
      case 'name': return toExpr(resolveName(self, tree), self, ctx);
      case 'unary': return tree.op === '+' ? toExpr(tree.arg, self, ctx) : { k: 'op', op: '×', args: [{ k: 'const', value: -1 }, toExpr(tree.arg, self, ctx)] };
      case 'percent': return { k: 'op', op: '÷', args: [toExpr(tree.arg, self, ctx), { k: 'const', value: 100 }] };
      case 'binary': {
        if(tree.op === '&') throw new XlNotTranslated('joining text (&)');
        const op = XL_BINARY[tree.op];
        const left = toExpr(tree.left, self, ctx), right = toExpr(tree.right, self, ctx);
        // a+b+c is one + (and a−b−c one −, read left to right).
        const flat = op === '+' || op === '×' || op === '−' || op === '÷';
        const lefts = flat && left.k === 'op' && left.op === op && !left.named ? left.args : [left];
        const rights = (op === '+' || op === '×') && right.k === 'op' && right.op === op ? right.args : [right];
        return { k: 'op', op, args: [...lefts, ...rights] };
      }
      case 'func': {
        const f = tree.name, a = tree.args;
        if(XL_LISTS[f]){
          const l = list(a);
          if(!l.length){
            if(f === 'AVERAGE') throw new XlNotTranslated('an average of nothing (#DIV/0!)');
            return { k: 'const', value: f === 'PRODUCT' || f === 'AND' ? (f === 'AND' ? 1 : 0) : 0 };
          }
          if(l.length === 1 && (f === 'SUM' || f === 'PRODUCT' || f === 'MIN' || f === 'MAX' || f === 'AVERAGE')) return l[0];
          return { k: 'op', op: XL_LISTS[f], args: l };
        }
        if(XL_ONE_INPUT[f]){
          if(a.length !== 1) throw new XlNotTranslated(f + ' with ' + a.length + ' inputs');
          return { k: 'op', op: XL_ONE_INPUT[f], args: [toExpr(a[0], self, ctx)] };
        }
        if(f === 'TRUNC'){
          if(a.length !== 1) throw new XlNotTranslated('TRUNC with digits');
          return { k: 'op', op: 'trunc', args: [toExpr(a[0], self, ctx)] };
        }
        if(f === 'MOD' || f === 'POWER'){
          if(a.length !== 2) throw new XlNotTranslated(f + ' with ' + a.length + ' inputs');
          return { k: 'op', op: f === 'MOD' ? '%' : '^', args: [toExpr(a[0], self, ctx), toExpr(a[1], self, ctx)] };
        }
        if(f === 'IF'){
          if(a.length < 2 || a.length > 3) throw new XlNotTranslated('IF with ' + a.length + ' inputs');
          return { k: 'op', op: 'if', named: true, args: [toExpr(a[0], self, ctx), toExpr(a[1], self, ctx), a.length === 3 ? toExpr(a[2], self, ctx) : { k: 'const', value: 0 }] };
        }
        if(f === 'IFERROR'){
          if(a.length !== 2) throw new XlNotTranslated('IFERROR with ' + a.length + ' inputs');
          return { k: 'op', op: 'iferror', args: [toExpr(a[0], self, ctx), toExpr(a[1], self, ctx)] };
        }
        if(XL_ROUNDS[f]){
          if(a.length !== 2) throw new XlNotTranslated(f + ' with ' + a.length + ' inputs');
          return { k: 'op', op: XL_ROUNDS[f], named: true, args: [toExpr(a[0], self, ctx), toExpr(a[1], self, ctx)] };
        }
        if(f === 'CHOOSE'){
          if(a.length < 2 || a.length > 255) throw new XlNotTranslated('CHOOSE with ' + a.length + ' inputs');
          return { k: 'op', op: 'choose', named: true, args: a.map(x => toExpr(x, self, ctx)) };
        }
        if((f === 'TRUE' || f === 'FALSE') && !a.length) return { k: 'const', value: f === 'TRUE' ? 1 : 0 };
        throw new XlNotTranslated(f);
      }
      default: throw new XlNotTranslated('something it doesn\'t read');
    }
  }

  // Pass 1: each formula row's expression, or why it can't be translated.
  for(const entry of rows.values()){
    if(entry.kind === 'parts'){
      try{ Object.assign(entry, xlPartsExpr(entry, (sig, from) => {
        let tree;
        try{ tree = xlParseFormula(sig); } catch(e){ throw new XlNotTranslated('a formula that can\'t be read'); }
        return toExpr(tree, entry.sheet, { mode: 'period', canvas: entry.canvas, kind: 'parts', from });
      }, N, (to) => upTo(entry.canvas, to))); }
      catch(e){
        if(!(e instanceof XlNotTranslated)) throw e;
        entry.why = e.why;
        entry.expr = null;
      }
      continue;
    }
    if(entry.kind !== 'calculation' && entry.kind !== 'opening' && entry.kind !== 'single') continue;
    const ctx = { mode: entry.kind === 'single' ? 'single' : 'period', canvas: entry.canvas, kind: entry.kind, from: 0 };
    const text = entry.kind === 'single' ? entry.plan.before.formula : entry.plan.signature;
    try{
      if(!text) throw new XlNotTranslated('a formula that can\'t be read');
      let tree;
      try{ tree = xlParseFormula(text); } catch(e){ throw new XlNotTranslated('a formula that can\'t be read'); }
      entry.expr = toExpr(tree, entry.sheet, ctx);
    } catch(e){
      if(!(e instanceof XlNotTranslated)) throw e;
      entry.why = e.why;
      entry.expr = null;
    }
  }

  // Pass 2: circular references within a period (Excel's iterative calculation) cut.
  // Period by period: a row in parts reads only its part for that period (IF reads one
  // branch), so two rows reading each other in different periods are no loop.
  const depsIn = (p) => (entry) => {
    if(!entry.expr) return [];
    const part = entry.partExprs && entry.partExprs.find(x => p >= x.from && p <= x.to);
    const out = [];
    const walk = (x) => { if(!x) return; if(x.k === 'ref'){ if(x.shift === 0 && !x.entry.extra) out.push(x.entry); } else if(x.k === 'op') x.args.forEach(walk); };
    walk(part ? part.expr : entry.expr);
    return out;
  };
  const allRows = [...rows.values()];
  const distinct = new Set();
  for(let p = 0; p < N; p++){
    // Periods whose parts are the same have the same loops: each kind is looked at once.
    const key = allRows.map(e => e.partExprs ? (e.partExprs.findIndex(x => p >= x.from && p <= x.to)) : '').join(',');
    if(distinct.has(key)) continue;
    distinct.add(key);
    xlCutLoops(allRows, depsIn(p));
  }

  // Pass 3: the nodes.
  const nodeCount = { rectangles: 0 };
  for(const c of canvases){
    let y = XL_MARGIN;
    const add = (n) => { c.nodes.push(n); return n.id; };
    const edge = (from, to, port) => { const e = { id: 'e' + (c.nextEdge++), from, to }; if(port !== undefined) e.toPort = port; c.edges.push(e); };
    // The extras first (made while reading the formulas).
    for(const e of [...extras.values()].filter(x => x.canvas === c)){
      if(e.values){
        const all = e.values.every(v => v === e.values[0]);
        const node = { id: e.id, type: 'value', x: XL_RECT_X, y, text: xlRectText(e.name, e.values[0], '') };
        if(!all) node.periodValues = xlFit(e.values, N);
        add(node);
      } else add({ id: e.id, type: 'value', x: XL_RECT_X, y, text: xlRectText(e.name, e.value, '') });
      nodeCount.rectangles++;
      y += XL_LANE + XL_ROW_GAP;
    }
    // The sheet's layout, for ExcelExporter's tab (09k): the extras, then the rows, titles and
    // blank rows in the sheet's order. On the canvas a title or blank row is space between
    // the rectangles.
    const layout = [...extras.values()].filter(x => x.canvas === c).map(e => ({ node: e.id }));
    let prevRow = null, placed = layout.length > 0;
    for(const item of c.items){
      if(prevRow !== null){
        // The header row of periods is the workbook's own (ExcelExporter writes one): the
        // blank rows are counted after it.
        const head = plans[c.sheet].headerRow;
        const from = head > prevRow && head < item.row ? head : prevRow;
        const blanks = Math.min(XL_BLANKS_MAX, Math.max(0, item.row - from - 1));
        for(let k = 0; k < blanks; k++) layout.push({ blank: true });
        if(placed) y += blanks * XL_SPACE;
      }
      prevRow = item.row;
      if(item.title !== undefined){
        layout.push({ title: item.title });
        if(placed) y += XL_SPACE;
        continue;
      }
      const entry = item.entry;
      layout.push({ node: entry.id });
      placed = true;
      const plan = entry.plan;
      const rect = { id: entry.id, type: 'value', x: XL_RECT_X, y, text: '' };
      nodeCount.rectangles++;
      const out = { sheet: plans[entry.sheet].name, row: plan.row, label: entry.name, canvasId: c.id, nodeId: entry.id, kind: entry.kind, translated: true, cells: [] };
      const savedValues = plan.cells.map(cell => xlSavedNumber(cell));
      if(entry.kind === 'assumption' || entry.kind === 'single'){
        out.cells = [xlReportCell(plan.before, null)];
      } else {
        out.cells = plan.cells.slice(0, N).map((cell, p) => xlReportCell(cell, p));
      }
      out.cells.forEach(c => { if(c.noSaved) report.noSaved++; });
      let lanes = 1;
      if(entry.kind === 'input' || entry.kind === 'assumption' || ((entry.kind === 'calculation' || entry.kind === 'opening' || entry.kind === 'single' || entry.kind === 'parts') && !entry.expr)){
        // Typed numbers: an input, an assumption, or a row kept as Excel's saved values.
        if(entry.kind === 'assumption'){
          rect.text = xlRectText(entry.name, xlSavedNumber(plan.before) || 0, entry.unit);
        } else if(entry.kind === 'single'){
          rect.text = xlRectText(entry.name, xlSavedNumber(plan.before) || 0, entry.unit);
        } else {
          const values = xlFit(savedValues.map(v => v === null ? 0 : v), N);
          rect.text = xlRectText(entry.name, values[0], entry.unit);
          if(!values.every(v => v === values[0])) rect.periodValues = values;
        }
        if(entry.kind === 'input' && plan.odd.length) report.odd.push({ sheet: out.sheet, row: plan.row, label: entry.name, cells: plan.odd.slice(), how: 'Excel\'s saved values kept as numbers' });
        if(entry.kind !== 'input' && entry.kind !== 'assumption'){
          out.translated = false;
          report.notTranslated.push({ sheet: out.sheet, row: plan.row, label: entry.name, cells: entry.kind === 'single' ? plan.before.address : xlCellSpan(plan.cells, N), why: entry.why });
        }
        add(rect);
      } else {
        // A formula: the row's tree, then the rectangle. The periods holding a number of
        // their own — an opening balance's first, the cells that differ, a row in parts'
        // typed actuals beside its one formula — are the rectangle's own numbers there
        // (ticked under "Which periods use this rectangle's own number?", `literalPeriods`,
        // with `periodValues`), so the tree is the formula alone.
        let expr = entry.expr;
        const own = new Map();
        if(entry.kind === 'opening') own.set(0, savedValues[0]);
        const oddCells = entry.kind === 'single' || entry.kind === 'parts' ? [] : plan.cells.slice(0, N).map((cell, p) => ({ cell, p })).filter(({ cell }) => plan.odd.includes(cell.address));
        for(const { p } of oddCells) own.set(p, savedValues[p]);
        if(oddCells.length) report.odd.push({ sheet: out.sheet, row: plan.row, label: entry.name, cells: oddCells.map(o => o.cell.address), how: 'Excel\'s saved value in that period' });
        if(entry.partExprs){
          for(const part of entry.partExprs){
            if(part.expr.k !== 'typed') continue;
            for(let p = part.from; p <= part.to && p < N; p++) own.set(p, part.expr.values[p]);
          }
        }
        if(own.size){
          const ticked = [...own.keys()].sort((a, b) => a - b);
          const values = new Array(N).fill(0);
          ticked.forEach(p => { const v = own.get(p); values[p] = v === null || v === undefined ? 0 : v; });
          // One number in every ticked period (an opening balance) is typed, as fmIDE shows it.
          const one = ticked.every(p => values[p] === values[ticked[0]]);
          rect.text = xlRectText(entry.name, one ? values[ticked[0]] : null, entry.unit);
          if(!one) rect.periodValues = values;
          rect.literalPeriods = ticked;
        } else rect.text = xlRectText(entry.name, null, entry.unit);
        add(rect);
        const root = xlEmit(expr, XL_RECT_X - XL_STEP, y, { c, add, edge, nodeId, label: entry.name, constants: c.constants });
        edge(root.id, rect.id);
        lanes = root.lanes;
      }
      report.rows.push(out);
      y += lanes * XL_LANE + XL_ROW_GAP;
    }
    c.layout = layout;
    // The canvas starts at the left.
    const minX = Math.min(...c.nodes.map(n => n.x));
    const dx = XL_MARGIN - minX;
    c.nodes.forEach(n => { n.x += dx; });
  }

  const system = {
    kind: 'system', version: XL_SYSTEM_VERSION, periods, currentPeriod: 0,
    canvases: canvases.map(c => ({ id: c.id, name: c.name, nodes: c.nodes, edges: c.edges })),
  };
  report.canvases = canvases.length;
  report.rectangles = nodeCount.rectangles;
  report.nodes = canvases.reduce((s, c) => s + c.nodes.length, 0);
  // How ExcelExporter lays the model out to look like the workbook: per canvas, its rows in
  // the sheet's order with its titles and blank rows; the numbers written in the formulas
  // (each a rectangle of its own here), to be written back into the formulas there.
  const layout = { canvases: canvases.map(c => ({ id: c.id, items: c.layout })), constants: canvases.flatMap(c => c.constants.map(id => ({ canvasId: c.id, nodeId: id }))) };
  return { system, report, layout };
}

// A cell of the report: its saved number, or why there is none — Excel shows an error
// (`error`), or the program that saved it kept no value for its formula (`noSaved`).
function xlReportCell(cell, period){
  const out = { address: cell.address, period, saved: xlSavedNumber(cell) };
  if(cell.error) out.error = cell.error;
  else if((cell.formula !== null || cell.unreadable) && cell.value === null) out.noSaved = true;
  return out;
}

// A row in parts as one expression: its formula parts by period, the last one outermost —
// if(Up to 2024, formula 1, if(Up to 2027, formula 2, … the last formula)), each switch the
// canvas's shared "Up to …" rectangle (`upTo`). Its typed parts are the rectangle's own
// numbers in their periods (pass 3), so they are left out of the switch; `partExprs` keeps
// every part (typed ones as { k: 'typed', values }) for the loop check.
function xlPartsExpr(entry, formulaExpr, n, upTo){
  const runs = entry.plan.parts;
  const values = [];
  for(let p = 0; p < n; p++){
    const r = runs.find(x => p >= x.from && p <= x.to);
    const cell = entry.plan.cells[p];
    values.push(r && r.typed && cell ? (xlSavedNumber(cell) || 0) : 0);
  }
  const parts = runs.map(r => ({ from: r.from, to: r.to, expr: r.typed ? { k: 'typed', values } : formulaExpr(r.signature, r.from) }));
  const formulas = parts.filter(x => x.expr.k !== 'typed');
  let expr = formulas[formulas.length - 1].expr;
  for(let i = formulas.length - 2; i >= 0; i--){
    expr = { k: 'op', op: 'if', named: true, args: [upTo(formulas[i].to), formulas[i].expr, expr] };
  }
  return { expr, partExprs: parts };
}

// A reference some periods back reaching before the first period, in a period the formula
// is used in: there Excel reads the cell before the period columns (a blank is 0), so that
// period reads its value: if(period = 1, Excel's C92, …). An opening balance's first period
// is its typed number, so it is left as it is.
function xlBeforeThePeriods(ref, sheet, plan, row, ctx){
  if(ref.shift >= 0 || ctx.mode !== 'period') return ref;
  let expr = ref;
  const from = ctx.from || 0;
  for(let p = -ref.shift - 1; p >= from; p--){
    if(p === 0 && ctx.kind === 'opening') continue;
    const col = plan.firstCol + p + ref.shift;
    const cell = col >= 1 ? sheet.cells.get(xlAddress(col, row)) : null;
    const v = cell ? xlSavedNumber(cell) : 0;
    if(v === null) throw new XlNotTranslated('a cell before the periods holding text or an error (' + sheet.name + '!' + xlAddress(col, row) + ')');
    expr = { k: 'op', op: 'if', named: true, args: [{ k: 'op', op: '=', args: [{ k: 'period' }, { k: 'const', value: p + 1 }] }, { k: 'const', value: v, oddOf: col >= 1 ? xlAddress(col, row) : 'blank' }, expr] };
  }
  return expr;
}

// An input row whose numbers are the same in every period.
function xlIsConstantRow(entry){
  const vs = entry.plan.cells.map(c => xlSavedNumber(c));
  return vs.every(v => v === vs[0]);
}
function xlText(sheet, col, row){
  const c = sheet.cells.get(xlAddress(col, row));
  return c && typeof c.value === 'string' ? c.value : '';
}
function xlCellName(book, s, ref){ return book.sheets[s].name + '!' + xlAddress(ref.col, ref.row); }
function xlCellSpan(cells, n){
  const cs = cells.slice(0, n);
  return cs.length === 1 ? cs[0].address : cs[0].address + ':' + cs[cs.length - 1].address;
}
// A list of n numbers: cut, or padded with 0.
function xlFit(values, n){
  const out = values.slice(0, n);
  while(out.length < n) out.push(0);
  return out;
}

// Rows reading each other in the same period, round and round: the last row of each loop
// (in the sheet's order) keeps Excel's saved values, so the rest calculate.
function xlCutLoops(entries, depsOf){
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
  let counter = 0;
  const loops = [];
  const strong = (v) => {
    // Iterative, so a long chain can't overflow the stack.
    const work = [[v, 0]];
    index.set(v, counter); low.set(v, counter); counter++; stack.push(v); onStack.add(v);
    while(work.length){
      const top = work[work.length - 1];
      const [node, i] = top;
      const deps = node.expr ? depsOf(node) : [];
      if(i < deps.length){
        top[1]++;
        const w = deps[i];
        if(!index.has(w)){
          index.set(w, counter); low.set(w, counter); counter++; stack.push(w); onStack.add(w);
          work.push([w, 0]);
        } else if(onStack.has(w)) low.set(node, Math.min(low.get(node), index.get(w)));
      } else {
        work.pop();
        if(work.length){ const parent = work[work.length - 1][0]; low.set(parent, Math.min(low.get(parent), low.get(node))); }
        if(low.get(node) === index.get(node)){
          const comp = [];
          let w;
          do{ w = stack.pop(); onStack.delete(w); comp.push(w); } while(w !== node);
          if(comp.length > 1 || depsOf(node).includes(node)) loops.push(comp);
        }
      }
    }
  };
  for(const e of entries) if(!index.has(e)) strong(e);
  for(const comp of loops){
    const order = comp.slice().sort((a, b) => a.sheet - b.sheet || a.plan.row - b.plan.row);
    // Cut one row at a time until no loop is left among them.
    for(const cut of order.slice().reverse()){
      cut.expr = null;
      cut.partExprs = null;
      cut.why = 'a circular reference';
      const rest = order.filter(e => e.expr);
      if(!xlHasLoop(rest, depsOf)) break;
    }
  }
}
function xlHasLoop(entries, depsOf){
  const set = new Set(entries), state = new Map();
  for(const start of entries){
    if(state.has(start)) continue;
    const work = [[start, 0]];
    state.set(start, 1);
    while(work.length){
      const top = work[work.length - 1];
      const deps = depsOf(top[0]).filter(d => set.has(d));
      if(top[1] < deps.length){
        const w = deps[top[1]++];
        if(state.get(w) === 1) return true;
        if(!state.has(w)){ state.set(w, 1); work.push([w, 0]); }
      } else { state.set(top[0], 2); work.pop(); }
    }
  }
  return false;
}

// How many lanes (inputs stacked) an expression's tree takes.
function xlLanes(x){
  if(x.k === 'op') return Math.max(1, x.args.reduce((s, a) => s + xlLanes(a), 0));
  return 1;
}

// Places an expression's nodes: its own node at (x, y), its inputs one column to the left,
// each below the one before. Returns { id, lanes }.
function xlEmit(x, px, py, ctx){
  const { c, add, edge, nodeId } = ctx;
  if(x.k === 'const'){
    const id = nodeId(c);
    const name = x.oddOf ? xlCleanName(ctx.label + ': Excel\'s ' + x.oddOf) : xlCleanName(ctx.label + ': ' + xlNumberText(x.value));
    add({ id, type: 'value', x: px, y: py, text: xlRectText(name, x.value, '') });
    if(ctx.constants) ctx.constants.push(id);
    return { id, lanes: 1 };
  }
  if(x.k === 'period'){
    const id = nodeId(c);
    add({ id, type: 'operator', x: px, y: py, text: 'period', socket: '' });
    return { id, lanes: 1 };
  }
  if(x.k === 'ref'){
    const alias = (ax) => {
      const id = nodeId(c);
      add({ id, type: 'alias', x: ax, y: py, sourceCanvasId: x.entry.canvas.id, sourceNodeId: x.entry.id });
      return id;
    };
    if(x.shift === 0) return { id: alias(px), lanes: 1 };
    const id = nodeId(c);
    add({ id, type: 'periodShift', x: px, y: py, text: '', shift: x.shift });
    edge(alias(px - XL_ALIAS_STEP), id);
    return { id, lanes: 1 };
  }
  // An operator: its inputs in a column to its left, in order downwards.
  const id = nodeId(c);
  add({ id, type: 'operator', x: px, y: py, text: x.op, socket: '' });
  let lane = 0;
  x.args.forEach((a, i) => {
    const child = xlEmit(a, px - XL_STEP, py + lane * XL_LANE, ctx);
    edge(child.id, id, x.named ? i : undefined);
    lane += child.lanes;
  });
  return { id, lanes: Math.max(1, lane) };
}
