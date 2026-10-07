// ---------- operator catalogue (shared: src/shared/operators.js) ----------
// Every built-in operator, keyed by a lasting id that never changes (plugins and saved
// references use the id, never the symbol or a display name). `symbol` is what a file
// saves in an operator node's `text`; the order is the palette's order (fmIDE's
// "Insert Operator" commands are numbered by it, so new operators go at the end).
// `word` is the plain name shown next to a symbol ("+ Add"); function operators (fn) show
// ƒ and their symbol instead.
//
// How each one calculates, from its inputs' values in left-to-right order:
// - fold: combines the values pairwise from the left (a result of NaN is a 'math-error');
// - all: takes the whole list;
// - unary: exactly one input (otherwise 'unary-only');
// - compare: a chain a < b < c means a < b and b < c; 1 = true, 0 = false (needs two inputs:
//   otherwise 'needs-two');
// - fallback (iferror): its first input, or when that fails its second, or 0.
// - period (phase E): no inputs; the period being calculated, counted from 1.
// - ports (phase E): named inputs, each arrow into one by its `toPort` (counted from 0), as
//   into a function node; `apply` takes them in that order. `branches` (if, choose): the
//   first input picks one of the others (`pick`), and only that one is read — if: then when
//   the condition isn't 0, else otherwise; choose (phase E2b): choice n for index n. An input
//   read with no arrow is 'operator-input-unwired'. `choices` (choose): after its fixed named
//   inputs come "choice 1", "choice 2"… — as many as its arrows reach (operatorPortNames).
// Comparisons treat two numbers as equal when they differ only in the last few binary
// digits (approxEqual), as Excel and LibreOffice do: 0.1 + 0.2 = 0.3.
// `unit` is how the unit of measure passes through: 'multiply', 'divide', 'same' (every
// input must have the same unit, which the result takes), 'first' (the first input's),
// 'branches' (the inputs it may pick must have the same unit, which the result takes), or null.
// How each operator is spelled in Excel lives in ExcelExporter, not here.
export const OPERATORS = [
  { id: 'add',      symbol: '+',       word: 'Add',          fold: (a, b) => a + b, unit: 'same' },
  { id: 'subtract', symbol: '−',       word: 'Subtract',     fold: (a, b) => a - b, unit: 'same' },
  { id: 'multiply', symbol: '×',       word: 'Multiply',     fold: (a, b) => a * b, unit: 'multiply' },
  { id: 'divide',   symbol: '÷',       word: 'Divide',       fold: (a, b) => b === 0 ? NaN : a / b, unit: 'divide' },
  { id: 'power',    symbol: '^',       word: 'Power',        fold: (a, b) => Math.pow(a, b), unit: null },
  // Excel's MOD: the result takes the divisor's sign (MOD(-7,3) = 2).
  { id: 'mod',      symbol: '%',       word: 'Modulo',       fold: (a, b) => b === 0 ? NaN : a - b * Math.floor(a / b), unit: null },
  { id: 'le',       symbol: '≤',       word: 'At most',      compare: (a, b) => a < b || approxEqual(a, b), unit: null },
  { id: 'ge',       symbol: '≥',       word: 'At least',     compare: (a, b) => a > b || approxEqual(a, b), unit: null },
  { id: 'lt',       symbol: '<',       word: 'Less than',    compare: (a, b) => a < b && !approxEqual(a, b), unit: null },
  { id: 'gt',       symbol: '>',       word: 'Greater than', compare: (a, b) => a > b && !approxEqual(a, b), unit: null },
  { id: 'abs',      symbol: 'abs',     fn: true, unary: (a) => Math.abs(a), unit: 'same' },
  { id: 'min',      symbol: 'min',     fn: true, all: (vs) => Math.min(...vs), unit: 'same' },
  { id: 'max',      symbol: 'max',     fn: true, all: (vs) => Math.max(...vs), unit: 'same' },
  { id: 'average',  symbol: 'ave',     fn: true, all: (vs) => vs.reduce((a, b) => a + b, 0) / vs.length, unit: 'same' },
  { id: 'iferror',  symbol: 'iferror', fn: true, fallback: true, unit: 'same' },
  // Phase E1: timing, conditions and rounding.
  { id: 'period',    symbol: 'period',    fn: true, period: true, unit: null },
  { id: 'if',        symbol: 'if',        fn: true, ports: ['condition', 'then', 'else'], branches: true, pick: (c) => c !== 0 ? 1 : 2, unit: 'branches' },
  { id: 'eq',        symbol: '=',         word: 'Equal',     compare: (a, b) => approxEqual(a, b), unit: null },
  { id: 'ne',        symbol: '≠',         word: 'Not equal', compare: (a, b) => !approxEqual(a, b), unit: null },
  { id: 'and',       symbol: 'and',       fn: true, all: (vs) => vs.every(v => v !== 0) ? 1 : 0, unit: null },
  { id: 'or',        symbol: 'or',        fn: true, all: (vs) => vs.some(v => v !== 0) ? 1 : 0, unit: null },
  { id: 'not',       symbol: 'not',       fn: true, unary: (a) => a === 0 ? 1 : 0, unit: null },
  { id: 'round',     symbol: 'round',     fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'half'), unit: 'first' },
  { id: 'roundup',   symbol: 'roundup',   fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'up'), unit: 'first' },
  { id: 'rounddown', symbol: 'rounddown', fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'down'), unit: 'first' },
  // Phase E2a: one-input Excel functions. A result that isn't a finite number (the log of 0
  // or less, the root of a negative, e to a power too large) is a 'math-error', as Excel's
  // #NUM!. The log, e and root have no unit; int and trunc keep their input's. INT goes down
  // (towards minus infinity) and TRUNC towards zero, on the number as stored, as Excel does:
  // INT((0.1 + 0.7) * 10) is 7 (LibreOffice, which rounds first, says 8).
  { id: 'ln',        symbol: 'ln',        fn: true, unary: (a) => a > 0 ? Math.log(a) : NaN, unit: null },
  { id: 'exp',       symbol: 'exp',       fn: true, unary: (a) => Math.exp(a), unit: null },
  { id: 'sqrt',      symbol: 'sqrt',      fn: true, unary: (a) => a >= 0 ? Math.sqrt(a) : NaN, unit: null },
  { id: 'int',       symbol: 'int',       fn: true, unary: (a) => Math.floor(a) + 0, unit: 'same' }, // + 0: never −0, which Excel doesn't have
  { id: 'trunc',     symbol: 'trunc',     fn: true, unary: (a) => Math.trunc(a) + 0, unit: 'same' },
  // Phase E2b: CHOOSE(index, choice 1, choice 2, …), as Excel: the index cut to a whole
  // number picks a choice; below 1 or past the last choice it is 'choose-out-of-range' (Excel's
  // #VALUE!). Only the choice picked is read.
  { id: 'choose',    symbol: 'choose',    fn: true, ports: ['index'], choices: true, branches: true, pick: (c, n) => chooseIndex(c, n), unit: 'branches' },
];

// CHOOSE takes at most 254 choices, as Excel does.
export const CHOOSE_MAX_CHOICES = 254;
// The choice an index picks among `n` (1…n), or 0 when it picks none.
function chooseIndex(index, n){
  const i = Math.trunc(index);
  return i >= 1 && i <= n ? i : 0;
}
// An operator's named inputs, or null. For choose, `choiceCount` choices after the index.
export function operatorPortNames(op, choiceCount){
  if(!op || !op.ports) return null;
  if(!op.choices) return op.ports;
  const n = Math.max(0, Math.min(CHOOSE_MAX_CHOICES, choiceCount | 0));
  const out = op.ports.slice();
  for(let i = 1; i <= n; i++) out.push('choice ' + i);
  return out;
}
// How many choices a choose has: as many as its highest-numbered arrow reaches (`toPorts`, the
// `toPort` of each arrow into it; choice n is toPort n), at most CHOOSE_MAX_CHOICES.
export function chooseChoiceCount(toPorts){
  let most = 0;
  toPorts.forEach(p => { if(Number.isInteger(p) && p >= 1 && p <= CHOOSE_MAX_CHOICES && p > most) most = p; });
  return most;
}

// Equal but for the last few binary digits, as Excel and LibreOffice compare numbers.
function approxEqual(a, b){
  if(a === b) return true;
  const d = Math.abs(a - b);
  return isFinite(d) && d < Math.max(Math.abs(a), Math.abs(b)) * 3.552713678800501e-15; // 2^-48
}

// Excel's ROUND, ROUNDUP and ROUNDDOWN: `value` to `digits` places after the point (a
// negative number rounds to tens, hundreds…; a fraction is cut to a whole number), halves
// away from zero ('half'), away from zero ('up') or towards zero ('down'). Worked out on the
// number's 15 significant digits, as Excel shows it, so ROUND(2.675, 2) is 2.68 although
// 2.675 is stored as a little less. Returns NaN for a value or digits that isn't finite.
function roundLikeExcel(value, digits, mode){
  if(!isFinite(value) || !isFinite(digits)) return NaN;
  const d = Math.trunc(digits);
  if(value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const parts = Math.abs(value).toPrecision(15).split('e');
  const exponent = Number(parts[1] || 0) + d;
  if(exponent > 300) return value;         // far more places than the number has
  if(exponent < -300) return mode === 'up' ? sign * Math.pow(10, -d) : 0;
  const shifted = Number(parts[0] + 'e' + exponent);
  let whole;
  if(shifted >= 4503599627370496) whole = shifted; // 2^52: already a whole number
  else if(mode === 'half') whole = Math.floor(shifted + 0.5);
  else if(mode === 'up') whole = Math.ceil(shifted);
  else whole = Math.floor(shifted);
  if(whole === 0) return 0;
  const result = d > 0 ? (d <= 22 ? whole / Math.pow(10, d) : Number(whole + 'e-' + d)) : whole * Math.pow(10, -d);
  return sign * result;
}
const OPERATOR_BY_SYMBOL = new Map(OPERATORS.map(op => [op.symbol, op]));
const OPERATOR_BY_ID = new Map(OPERATORS.map(op => [op.id, op]));

// The catalogue entry for an operator node's saved text, or null (an unknown operator).
export function operatorForSymbol(symbol){ return OPERATOR_BY_SYMBOL.get(symbol) || null; }
export function operatorById(id){ return OPERATOR_BY_ID.get(id) || null; }

// Applies an operator to its inputs' values (every one a number; iferror, if and period are
// handled by the evaluator, which reads their inputs one at a time). Returns { value } or
// { error: code }. An unknown operator (only a hand-edited file has one) is an error.
export function applyOperator(op, values){
  if(!op) return { error: 'operator-unknown' };
  if(op.apply){
    const r = op.apply(...values);
    return isFinite(r) ? { value: r } : { error: 'math-error' };
  }
  if(op.unary){
    if(values.length !== 1) return { error: 'unary-only' };
    const r = op.unary(values[0]);
    return isFinite(r) ? { value: r } : { error: 'math-error' };
  }
  if(op.compare){
    if(values.length < 2) return { error: 'needs-two' };
    return { value: values.slice(1).every((v, i) => op.compare(values[i], v)) ? 1 : 0 };
  }
  if(op.all) return { value: op.all(values) };
  const result = values.reduce((acc, v, idx) => idx === 0 ? v : op.fold(acc, v));
  return Number.isNaN(result) ? { error: 'math-error' } : { value: result };
}
