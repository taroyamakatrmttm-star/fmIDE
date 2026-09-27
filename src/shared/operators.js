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
//   into a function node; `apply` takes them in that order. `branches` (if): the first is
//   the condition, and only the input it picks (then when it isn't 0, else otherwise) is
//   read. An input read with no arrow is 'operator-input-unwired'.
// Comparisons treat two numbers as equal when they differ only in the last few binary
// digits (approxEqual), as Excel and LibreOffice do: 0.1 + 0.2 = 0.3.
// `unit` is how the unit of measure passes through: 'multiply', 'divide', 'same' (every
// input must have the same unit, which the result takes), 'first' (the first input's),
// 'branches' (then and else must have the same unit, which the result takes), or null.
// How each operator is spelled in Excel lives in ExcelExporter, not here.
const OPERATORS = [
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
  { id: 'if',        symbol: 'if',        fn: true, ports: ['condition', 'then', 'else'], branches: true, unit: 'branches' },
  { id: 'eq',        symbol: '=',         word: 'Equal',     compare: (a, b) => approxEqual(a, b), unit: null },
  { id: 'ne',        symbol: '≠',         word: 'Not equal', compare: (a, b) => !approxEqual(a, b), unit: null },
  { id: 'and',       symbol: 'and',       fn: true, all: (vs) => vs.every(v => v !== 0) ? 1 : 0, unit: null },
  { id: 'or',        symbol: 'or',        fn: true, all: (vs) => vs.some(v => v !== 0) ? 1 : 0, unit: null },
  { id: 'not',       symbol: 'not',       fn: true, unary: (a) => a === 0 ? 1 : 0, unit: null },
  { id: 'round',     symbol: 'round',     fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'half'), unit: 'first' },
  { id: 'roundup',   symbol: 'roundup',   fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'up'), unit: 'first' },
  { id: 'rounddown', symbol: 'rounddown', fn: true, ports: ['value', 'digits'], apply: (v, d) => roundLikeExcel(v, d, 'down'), unit: 'first' },
];

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
function operatorForSymbol(symbol){ return OPERATOR_BY_SYMBOL.get(symbol) || null; }
function operatorById(id){ return OPERATOR_BY_ID.get(id) || null; }

// Applies an operator to its inputs' values (every one a number; iferror, if and period are
// handled by the evaluator, which reads their inputs one at a time). Returns { value } or
// { error: code }. An unknown operator (only a hand-edited file has one) is an error.
function applyOperator(op, values){
  if(!op) return { error: 'operator-unknown' };
  if(op.apply){
    const r = op.apply(...values);
    return isFinite(r) ? { value: r } : { error: 'math-error' };
  }
  if(op.unary){
    return values.length === 1 ? { value: op.unary(values[0]) } : { error: 'unary-only' };
  }
  if(op.compare){
    if(values.length < 2) return { error: 'needs-two' };
    return { value: values.slice(1).every((v, i) => op.compare(values[i], v)) ? 1 : 0 };
  }
  if(op.all) return { value: op.all(values) };
  const result = values.reduce((acc, v, idx) => idx === 0 ? v : op.fold(acc, v));
  return Number.isNaN(result) ? { error: 'math-error' } : { value: result };
}
