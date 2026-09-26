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
// `unit` is how the unit of measure passes through: 'multiply', 'divide', 'same' (every
// input must have the same unit, which the result takes), or null (no unit).
// How each operator is spelled in Excel lives in ExcelExporter, not here.
const OPERATORS = [
  { id: 'add',      symbol: '+',       word: 'Add',          fold: (a, b) => a + b, unit: 'same' },
  { id: 'subtract', symbol: '−',       word: 'Subtract',     fold: (a, b) => a - b, unit: 'same' },
  { id: 'multiply', symbol: '×',       word: 'Multiply',     fold: (a, b) => a * b, unit: 'multiply' },
  { id: 'divide',   symbol: '÷',       word: 'Divide',       fold: (a, b) => b === 0 ? NaN : a / b, unit: 'divide' },
  { id: 'power',    symbol: '^',       word: 'Power',        fold: (a, b) => Math.pow(a, b), unit: null },
  // Excel's MOD: the result takes the divisor's sign (MOD(-7,3) = 2).
  { id: 'mod',      symbol: '%',       word: 'Modulo',       fold: (a, b) => b === 0 ? NaN : a - b * Math.floor(a / b), unit: null },
  { id: 'le',       symbol: '≤',       word: 'At most',      compare: (a, b) => a <= b, unit: null },
  { id: 'ge',       symbol: '≥',       word: 'At least',     compare: (a, b) => a >= b, unit: null },
  { id: 'lt',       symbol: '<',       word: 'Less than',    compare: (a, b) => a < b, unit: null },
  { id: 'gt',       symbol: '>',       word: 'Greater than', compare: (a, b) => a > b, unit: null },
  { id: 'abs',      symbol: 'abs',     fn: true, unary: (a) => Math.abs(a), unit: 'same' },
  { id: 'min',      symbol: 'min',     fn: true, all: (vs) => Math.min(...vs), unit: 'same' },
  { id: 'max',      symbol: 'max',     fn: true, all: (vs) => Math.max(...vs), unit: 'same' },
  { id: 'average',  symbol: 'ave',     fn: true, all: (vs) => vs.reduce((a, b) => a + b, 0) / vs.length, unit: 'same' },
  { id: 'iferror',  symbol: 'iferror', fn: true, fallback: true, unit: 'same' },
];
const OPERATOR_BY_SYMBOL = new Map(OPERATORS.map(op => [op.symbol, op]));
const OPERATOR_BY_ID = new Map(OPERATORS.map(op => [op.id, op]));

// The catalogue entry for an operator node's saved text, or null (an unknown operator).
function operatorForSymbol(symbol){ return OPERATOR_BY_SYMBOL.get(symbol) || null; }
function operatorById(id){ return OPERATOR_BY_ID.get(id) || null; }

// Applies an operator to its inputs' values (every one a number; iferror is handled by the
// evaluator, which reads its inputs one at a time). Returns { value } or { error: code }.
// An unknown operator (only a hand-edited file has one) passes its first input through.
function applyOperator(op, values){
  if(!op) return { value: values[0] };
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
