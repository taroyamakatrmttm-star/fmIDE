// ============================================================
// How each operator is written in Excel, keyed by the operator catalogue's lasting ids
// (src/shared/operators.js). What an operator means lives in the catalogue; how Excel
// spells it lives only here. Every catalogue operator needs an entry (a test checks it).
//   infix:   a + b + c, in brackets          fold:    MOD(MOD(a, b), c)
//   compare: (a <= b), or AND(a<=b, b<=c)   fn:      MIN(a, b, …)
//   one:     exactly one input (ABS); otherwise an error, as fmIDE's "?"
//   numeric: a TRUE/FALSE read from a cell is turned into 1/0 first (N())
//   fallback: IFERROR(first, second), or IFERROR(first, 0) with one input
// This file holds nothing but the table (the test reads it on its own, in Node).
// ============================================================
const EXCEL_SPELLINGS = {
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
};
