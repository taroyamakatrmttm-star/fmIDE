// ============================================================
// How each operator is written in Excel, keyed by the operator catalogue's lasting ids
// (src/shared/operators.js). What an operator means lives in the catalogue; how Excel
// spells it lives only here. Every catalogue operator needs an entry (a test checks it).
//   infix:   a + b + c, in brackets          fold:    MOD(MOD(a, b), c)
//   compare: (a <= b), or AND(a<=b, b<=c)   fn:      MIN(a, b, …)
//   one:     exactly one input (ABS); otherwise an error, as fmIDE's "?"
//   numeric: a TRUE/FALSE read from a cell is turned into 1/0 first (N())
//   fallback: IFERROR(first, second), or IFERROR(first, 0) with one input
//   period:  the period number: the "Period #" cell (row 3) of the formula's own sheet
//   ports:   the inputs by name (toPort), in the catalogue's order; one with no arrow is NA()
//   branches: IF, CHOOSE — inside the inputs it may pick, a period outside the timeline is
//            an error (NA()); `index`: its first input is a number (a TRUE/FALSE read gets N())
//   logical: the result is Excel's TRUE/FALSE (AND, OR, NOT), like a comparison's
// This file holds nothing but the table (the test reads it on its own, in Node).
// ============================================================
export const EXCEL_SPELLINGS = {
  add:      { infix: '+' },
  subtract: { infix: '-' },
  multiply: { infix: '*' },
  divide:   { infix: '/' },
  power:    { infix: '^' },
  mod:      { fold: 'MOD' },
  le:       { compare: '<=' },
  ge:       { compare: '>=' },
  lt:       { compare: '<' },
  gt:       { compare: '>' },
  abs:      { fn: 'ABS', one: true },
  min:      { fn: 'MIN', numeric: true },
  max:      { fn: 'MAX', numeric: true },
  average:  { fn: 'AVERAGE', numeric: true },
  iferror:  { fn: 'IFERROR', fallback: true },
  // Phase E1.
  period:    { period: 'Period #' },
  if:        { fn: 'IF', ports: true, branches: true },
  eq:        { compare: '=' },
  ne:        { compare: '<>' },
  and:       { fn: 'AND', logical: true },
  or:        { fn: 'OR', logical: true },
  not:       { fn: 'NOT', one: true, logical: true },
  round:     { fn: 'ROUND', ports: true, numeric: true },
  roundup:   { fn: 'ROUNDUP', ports: true, numeric: true },
  rounddown: { fn: 'ROUNDDOWN', ports: true, numeric: true },
  // Phase E2a.
  ln:        { fn: 'LN', one: true, numeric: true },
  exp:       { fn: 'EXP', one: true, numeric: true },
  sqrt:      { fn: 'SQRT', one: true, numeric: true },
  int:       { fn: 'INT', one: true, numeric: true },
  trunc:     { fn: 'TRUNC', one: true, numeric: true },
  // Phase E2b: CHOOSE(index, choice 1, …); with no choice it is NA(), as fmIDE's "?".
  choose:    { fn: 'CHOOSE', ports: true, branches: true, index: true },
};
