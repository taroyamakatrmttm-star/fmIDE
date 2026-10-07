// ============================================================
import { irPortEdge } from '../../shared/ir.js';
import { modelIR, colLetter, periodCol, operandRef, isLogicalValued, isWrapped, formulaLevel } from './core-translation.js';
import { EXCEL_SPELLINGS } from './operator-spellings.js';
// Function calls (function plugins, step 7 phase D3): a call is written out in full inside
// each formula that reads it (step 7 decision 5) — no LAMBDA, no named function. The
// function's formula comes from the shared parser's tree (parseFunctionText, through the
// IR's compiled definitions); each input is replaced by what the arrow into its port reads
// (operandRef, so blocks, vintages, aliases, period shifts and the Inputs tab work as for
// an operator), and the built-in functions are spelled as EXCEL_SPELLINGS says.
//
// - Brackets only where Excel's order of operations needs them: a leading minus first, then
//   ^, then * and /, then + and -, then one comparison — the parser's own order, so the
//   tree reads the same in Excel (-x^2 is (-x)^2 in both).
// - A comparison gives Excel's TRUE/FALSE; wherever something other than + - * / ^ reads
//   it, and as the call's result, it is turned into 1/0 with N(), so a function's result
//   is always a number, as in fmIDE. An input read from a TRUE/FALSE cell gets N() too.
// - Errors, as fmIDE's "?": a call that can't be calculated (missing or unreadable
//   definition, a loop of functions, nested too deep, a wrong number of inputs) is NA(); so
//   is an input with no arrow, only where the formula reads it, so an IFERROR in the
//   function still catches it. Inside an IFERROR's first input, a period outside the
//   timeline is NA() too (ctx.iferrorDepth, as for the iferror operator).
// - Excel's limits: a formula of at most 8,192 characters and 64 levels. Writing a call
//   stops as soon as its text passes the length (a file that repeats inputs over and over
//   can't freeze the page); the row loop then writes NA() and the check before download
//   lists the cell.
// ============================================================

export const EXCEL_LIMITS = { length: 8192, nesting: 64 };
// Thrown while writing a call whose text is already too long for Excel.
function ExcelFormulaTooLong(){ this.excelTooLong = true; }

// Binding strength, as Excel reads it (higher binds tighter).
export const FN_LEVEL = { compare: 1, add: 2, subtract: 2, multiply: 3, divide: 3, power: 4, neg: 5, atom: 6 };

// A number from a formula, as Excel reads it: 1500, 0.5, 1E-7, 1E+21. (The parser gives
// only numbers of 0 or more; a minus is its own step.)
export function excelNumber(v){
  return String(v).replace('e', 'E');
}

// The call a function node makes, written out in full: formula text that can stand anywhere
// another formula reads it (a cell reference, a bracketed expression or a function call).
export function buildFunctionCallFormula(canvasId, n, periodIndex, ctx, currentTabName, path){
  if(!n.call || n.call.status) return 'NA()';
  ctx.fnWrites = (ctx.fnWrites || 0) + 1;
  if(ctx.onFunction) ctx.onFunction(n.call);
  // Input i, read by the arrow into port i; `caught` when inside an IFERROR's first input.
  const cache = new Map();
  const input = (i, caught) => {
    const k = caught ? 'c' + i : String(i);
    if(cache.has(k)) return cache.get(k);
    const edge = irPortEdge(modelIR, canvasId, n.id, i);
    let s;
    if(!edge) s = 'NA()';
    else {
      if(caught) ctx.iferrorDepth = (ctx.iferrorDepth || 0) + 1;
      try{ s = operandRef(canvasId, edge.from, periodIndex, ctx, currentTabName, path, edge.fromPort); }
      finally{ if(caught) ctx.iferrorDepth--; }
      if(s !== '0' && isLogicalValued(canvasId, edge.from, ctx, path, edge.fromPort)) s = 'N(' + s + ')';
    }
    // An operator's bracketed piece counts at its own level, so it keeps only the brackets
    // the function's formula needs around it.
    const inner = isWrapped(s) ? s.slice(1, -1) : null;
    const level = inner !== null ? formulaLevel(inner) : FN_LEVEL.atom;
    const e = level >= FN_LEVEL.compare && level < FN_LEVEL.atom ? fnPiece(inner, level, false) : fnPiece(s, FN_LEVEL.atom, false);
    cache.set(k, e);
    return e;
  };
  // PERIOD() reads this column's "Period #" cell (a call reached through a period shift is
  // written for another column, so the column is kept for the call and put back after).
  const savedPeriod = ctx.fnPeriodIndex;
  ctx.fnPeriodIndex = periodIndex;
  try{ return fnAtom(fnNumeric(writeFunctionExpr(n.call, n.call.body, input, false, ctx))); }
  finally{ ctx.fnPeriodIndex = savedPeriod; }
}

// A piece of formula text: how tightly it binds, and whether it is a TRUE/FALSE.
function fnPiece(s, level, logical){
  if(s.length > EXCEL_LIMITS.length) throw new ExcelFormulaTooLong();
  return { s, level, logical };
}
// As a number: a comparison's TRUE/FALSE becomes 1/0.
function fnNumeric(p){ return p.logical ? fnPiece('N(' + p.s + ')', FN_LEVEL.atom, false) : p; }
// As one item that can go anywhere.
function fnAtom(p){ return p.level === FN_LEVEL.atom ? p.s : '(' + p.s + ')'; }

// The formula text of expression `x` of compiled function `fn`, where `input(i, caught)` is
// input i's text.
function writeFunctionExpr(fn, x, input, caught, ctx){
  switch(x.t){
    case 'num': return fnPiece(excelNumber(x.v), FN_LEVEL.atom, false);
    case 'param': return input(x.i, caught);
    case 'neg': {
      const a = writeFunctionExpr(fn, x.a, input, caught, ctx);
      // Another minus, or anything looser than a minus, goes in brackets: -(-x), -(x^2).
      return fnPiece('-' + (a.level > FN_LEVEL.neg ? a.s : '(' + a.s + ')'), FN_LEVEL.neg, false);
    }
    case 'call': {
      const target = fn.targets.get(x.key);
      if(ctx.onFunction) ctx.onFunction(target);
      // The callee's inputs are this call's arguments, written where the callee reads them.
      const memo = new Map();
      const inner = (i, innerCaught) => {
        const k = innerCaught ? 'c' + i : String(i);
        if(memo.has(k)) return memo.get(k);
        const e = i < x.args.length
          ? fnPiece(fnAtom(fnNumeric(writeFunctionExpr(fn, x.args[i], input, innerCaught, ctx))), FN_LEVEL.atom, false)
          : fnPiece('NA()', FN_LEVEL.atom, false);
        memo.set(k, e);
        return e;
      };
      return writeFunctionExpr(target, target.body, inner, caught, ctx);
    }
    case 'op': {
      const spell = EXCEL_SPELLINGS[x.id];
      if(spell.fallback){
        // IFERROR(first, second): a failure inside the first input is caught.
        const first = fnNumeric(writeFunctionExpr(fn, x.args[0], input, true, ctx));
        const second = fnNumeric(writeFunctionExpr(fn, x.args[1], input, caught, ctx));
        return fnPiece(spell.fn + '(' + first.s + ',' + second.s + ')', FN_LEVEL.atom, false);
      }
      // PERIOD(): the "Period #" cell (row 3) of the formula's own sheet, in this column.
      if(spell.period) return fnPiece(colLetter(periodCol(ctx.fnPeriodIndex || 0)) + '$3', FN_LEVEL.atom, false);
      if(spell.branches){
        // IF(condition, then, else), CHOOSE(index, choice…): only the input picked counts, so
        // inside each one it may pick a period outside the timeline is an error (NA()), as for
        // IFERROR's first input. CHOOSE's index is a number (N() of a TRUE/FALSE).
        const c = writeFunctionExpr(fn, x.args[0], input, caught, ctx);
        const picks = x.args.slice(1).map(a => fnNumeric(writeFunctionExpr(fn, a, input, true, ctx)).s);
        return fnPiece(spell.fn + '(' + (spell.index ? fnNumeric(c) : c).s + ',' + picks.join(',') + ')', FN_LEVEL.atom, false);
      }
      const args = x.args.map(a => writeFunctionExpr(fn, a, input, caught, ctx));
      // AND, OR, NOT: Excel's TRUE/FALSE, which N() turns into 1/0 where needed.
      if(spell.logical) return fnPiece(spell.fn + '(' + args.map(p => p.s).join(',') + ')', FN_LEVEL.atom, true);
      if(spell.infix){
        const level = FN_LEVEL[x.id];
        const left = args[0].level >= level ? args[0].s : '(' + args[0].s + ')';
        // The right side binds tighter (a-(b-c)); one that starts with a minus is bracketed
        // to read clearly (a+(-b), a+(-b^2/4)).
        const right = (args[1].level > level && args[1].s.charAt(0) !== '-') ? args[1].s : '(' + args[1].s + ')';
        return fnPiece(left + spell.infix + right, level, false);
      }
      const nums = args.map(fnNumeric);
      if(spell.compare){
        const side = (p) => p.level > FN_LEVEL.compare && p.s.charAt(0) !== '-' ? p.s : '(' + p.s + ')';
        return fnPiece(side(nums[0]) + spell.compare + side(nums[1]), FN_LEVEL.compare, true);
      }
      const name = spell.fn || spell.fold;
      return fnPiece(name + '(' + nums.map(p => p.s).join(',') + ')', FN_LEVEL.atom, false);
    }
  }
  return fnPiece('NA()', FN_LEVEL.atom, false);
}

// Why `formula` can't go into Excel, or null: longer than 8,192 characters (with its "="),
// or brackets nested deeper than 64 (every bracket counts, the stricter reading of Excel's
// limit; brackets inside a quoted sheet name don't).
export function excelFormulaProblem(formula){
  if(formula.length + 1 > EXCEL_LIMITS.length) return { kind: 'length', size: formula.length + 1 };
  let depth = 0, most = 0, quoted = false;
  for(let i = 0; i < formula.length; i++){
    const ch = formula.charCodeAt(i);
    if(ch === 39) quoted = !quoted; // ' ('' inside a name toggles twice)
    else if(quoted) continue;
    else if(ch === 40){ if(++depth > most) most = depth; }
    else if(ch === 41) depth--;
  }
  return most > EXCEL_LIMITS.nesting ? { kind: 'nesting', size: most } : null;
}
