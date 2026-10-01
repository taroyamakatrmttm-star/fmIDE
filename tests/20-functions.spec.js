// 20. Function plugins (step 7, phase D): formulas held in files, read by our own parser
// (src/shared/functions.js), calculated by the shared IR, and carried with the model.
// - The parser in Node: what it accepts and how it calculates it, what it rejects (with the
//   message and where), its limits, and text from a hostile file.
// - The samples in tests/fixtures/functions/: known answers and units in Node, and the same
//   in fmIDE.
// - Files carry the definitions they use: Save System, Save Module, Export Workspace, the
//   autosave, and templates.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');

// ---- the shared code alone, in Node ----
const SHARED = path.join(__dirname, '..', 'src', 'shared');
function loadShared(){
  const code = ['operators.js', 'uom.js', 'input-rule.js', 'functions.js', 'ir.js'].map(f => fs.readFileSync(path.join(SHARED, f), 'utf8')).join('\n');
  return vm.runInContext(code + '\n;({ parseFunctionText, compileFunctions, runFunction, functionUnit, cleanFunctionDefinitions, functionsUsedBy, compileModel, evaluateModel, unitOf, formatUOM, parseUOM, FUNCTION_LIMITS })', vm.createContext({}));
}
const S = loadShared();
const sample = (name) => JSON.parse(fs.readFileSync(fixture('functions', name + '.json'), 'utf8'));

// The result of the definition `text` with inputs `args` ({ value } or { error }).
function run(text, args, others){
  const defs = [{ family: 'family-f', version: 1, versionId: 'version-v', text, calls: (others || []).map((o, i) => ({ name: o.name, family: 'family-o' + i, version: 1, versionId: 'version-v' })) }]
    .concat((others || []).map((o, i) => ({ family: 'family-o' + i, version: 1, versionId: 'version-v', text: o.text })));
  const fn = S.compileFunctions(defs).resolve({ family: 'family-f', version: 1 });
  if(fn.status) return { error: fn.status };
  const r = S.runFunction(fn, (i) => (i < args.length ? { value: args[i] } : { error: 'function-input-unwired' }));
  return r.error ? { error: r.error } : { value: r.value };
}

test.describe('the parser', () => {
  const ACCEPTED = [
    ['Margin(Revenue, Cost) = (Revenue - Cost) / Revenue', [100, 60], 0.4],
    ['margin(revenue, cost) = (REVENUE - Cost) / revenue', [100, 60], 0.4],       // names in any capitals
    ['F(x) = -x^2', [3], 9],                                                       // Excel: the minus first
    ['F(x) = -(x^2)', [3], -9],
    ['F(x) = 2^-x', [1], 0.5],
    ['F(x) = 2^3^2', [0], 64],                                                     // ^ from the left, as Excel
    ['F(x) = 1 + 2 * 3 - 4 / 2', [0], 5],
    ['F(x) = (1 + 2) * 3', [0], 9],
    ['F(x) = x--1', [1], 2],
    ['F(x) = +x', [4], 4],
    ['F(a, b) = a × b ÷ 2 − 1', [3, 4], 5],                                        // fmIDE's own signs
    ['F(a, b) = a ≤ b', [1, 2], 1],
    ['F(a, b) = a >= b', [1, 2], 0],
    ['F(a, b) = (a < b) * 10 + (a > b)', [1, 2], 10],
    ['F(a, b) = MOD(a, b)', [-7, 3], 2],                                           // Excel's MOD
    ['F(a, b, c) = MIN(a, b, c) + MAX(a, b, c) + AVERAGE(a, b, c)', [1, 2, 6], 10],
    ['F(a) = ABS(a)', [-3], 3],
    ['F(a, b) = IFERROR(a / b, -1)', [1, 0], -1],
    ['F(a, b) = IFERROR(a / 0, b)', [5], { error: 'function-input-unwired' }],     // the second input is read, and missing
    ['F(a, b) = IFERROR(b, a)', [5], 5],                                           // a missing input is caught
    ['F(a, b) = a * 2', [5], 10],                                                  // an input never read may be missing
    ['F() = 1.5e3 + .5', [], 1500.5],
    ['F(x) = x / 0', [1], { error: 'math-error' }],
    ['F(x) = x ^ 0.5', [-4], { error: 'math-error' }],                             // Excel: #NUM!
    ['F(x) = 10 ^ x', [400], { error: 'math-error' }],                             // too large: Excel #NUM!
    ['Fx_1.b(a_1, b.2) = a_1 + b.2', [1, 2], 3],
    ['Marge(Chiffre, Coût) = Chiffre - Coût', [10, 4], 6],                         // letters of any language
    ['F(__proto__, constructor) = __proto__ + constructor', [1, 2], 3],
    // Phase E1 (these were rejected before).
    ['F(a, b) = a = b', [0.1 + 0.2, 0.3], 1],                                       // "=" compares, as Excel does
    ['F(a, b) = a <> b', [1, 2], 1],
    ['F(a, b) = a ≠ b', [2, 2], 0],
    ['F(a) = IF(a, 1, 2)', [0], 2],
    ['F(a, b) = IF(b = 0, 0, a / b)', [1, 0], 0],                                   // the branch not taken may fail
    ['F(a, b) = IF(a > 0, a, b)', [1], 1],                                          // …or be missing
    ['F(a, b) = IF(a < 0, a, b)', [1], { error: 'function-input-unwired' }],     // …but not when taken
    ['F(a, b) = AND(a, b) + OR(a, 0) * 10 + NOT(b) * 100', [2, 0], 110],
    ['F(x) = ROUND(x, 2) + ROUNDUP(x, 0) * 10 + ROUNDDOWN(x, -1) * 100', [2.675, 0], 32.68],
    ['F() = PERIOD()', [], 1],                                                      // the first period, here
    ['F(period) = period * 2', [4], 8],                                             // an input may be called Period
    // Phase E2a (these were kept back before).
    ['F(x) = LN(EXP(x)) + SQRT(x * x)', [3], 6],
    ['F(x) = INT(x) * 10 + TRUNC(x)', [-2.5], -32],                                  // INT down, TRUNC towards zero
    ['F(x) = LN(x)', [0], { error: 'math-error' }],                                 // Excel: #NUM!
    ['F(x) = SQRT(x)', [-1], { error: 'math-error' }],
    ['F(x) = IFERROR(LN(x), 0)', [-1], 0],
    ['F(x) = ln(x) + Sqrt(4)', [1], 2],                                             // any capitals, as Excel
    // Phase E2b.
    ['F(i, a, b, c) = CHOOSE(i, a, b, c)', [2, 10, 20, 30], 20],
    ['F(i, a, b) = CHOOSE(i, a, b)', [2.9, 10, 20], 20],                            // the index is cut to a whole number
    ['F(j, a, b) = CHOOSE(j, a, b)', [3, 10, 20], { error: 'choose-out-of-range' }], // Excel: #VALUE!
    ['F(i, a) = CHOOSE(i, a, a / 0)', [1, 10], 10],                                 // only the choice picked is read
    ['F(k, a, b) = CHOOSE(k, a, b)', [1, 10], 10],                                  // …so one not picked may be missing
    ['F(i, a) = IFERROR(CHOOSE(i, a), -1)', [0, 10], -1],
    ['F(a, b) = choose(a > b, a, b) + 1', [2, 1], 3],
  ];
  for(const [text, args, expected] of ACCEPTED){
    test(`accepts ${text}`, () => {
      const parsed = S.parseFunctionText(text);
      expect(parsed.ok, JSON.stringify(parsed.error)).toBe(true);
      expect(run(text, args)).toEqual(typeof expected === 'number' ? { value: expected } : expected);
    });
  }

  test('a function calling another, by the version its entry in `calls` pins', () => {
    const other = [{ name: 'Margin', text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue' }];
    expect(run('Profit(Revenue, Cost) = Margin(Revenue, Cost) * Revenue', [100, 60], other)).toEqual({ value: 40 });
    expect(run('P(R, C) = margin(R, C * 2)', [100, 20], other)).toEqual({ value: 0.6 });
    expect(run('P(R, C) = Margin(R)', [100, 20], other)).toEqual({ error: 'function-arguments' });
    expect(run('P(R, C) = Margin(R, C) + Other(R)', [100, 20], other)).toEqual({ error: 'function-missing' });
    // The inner function's IFERROR catches the caller's failing input.
    const safe = [{ name: 'Safe', text: 'Safe(x, y) = IFERROR(x, y)' }];
    expect(run('P(a, b) = Safe(a / b, 7)', [1, 0], safe)).toEqual({ value: 7 });
  });

  const REJECTED = [
    ['= 1', /starts with the function's name/, 0],
    ['F x = 1', /Expected "\(" after the function's name/, 2],
    ['F(x) x', /Expected "=" after the inputs/, 5],
    ['F(x) =', /formula after "=" is missing/, 6],
    ['F(x, x) = x', /Two inputs are both called "x"/, 5],
    ['F(x, X) = x', /Two inputs are both called "X"/, 5],
    ['F(F) = 1', /can't have the function's own name/, 2],
    ['MIN(x) = x', /name of a built-in Excel function/, 0],
    ['F(Sum) = Sum', /"Sum" is the name of a built-in Excel function/, 2],
    ['F(x) = y', /"y" isn't one of this function's inputs/, 7],
    ['F(x) = x +', /ends too soon/, 10],
    ['F(x) = (x', /Expected "\)" here/, 9],
    ['F(x) = x)', /no "\(" for it to close/, 8],
    ['F(x) = x x', /Unexpected "x"/, 9],
    ['F(a, b) = a < b < a', /can't be chained/, 16],
    ['F(a, b) = a = b = a', /can't be chained/, 16],
    ['F(a) = a%', /"%" isn't supported/, 8],
    ['F(a) = a & "x"', /"&" can't be used/, 9],
    ['F(a) = "a"', /a quote/, 7],
    ['F(a) = SUM(a, 1, 2)', /SUM isn't available in functions yet/, 7],
    ['F(a) = IF(a, 1)', /IF takes exactly 3 inputs/, 7],
    ['F(a) = PERIOD(a)', /PERIOD takes exactly 0 inputs/, 7],
    ['Period(a) = a', /name of a built-in Excel function/, 0],
    ['F(a) = ABS(a, a)', /ABS takes exactly 1 input/, 7],
    ['F(a) = LN(a, 2)', /LN takes exactly 1 input/, 7],
    ['F(a) = TRUNC(a, 2)', /TRUNC takes exactly 1 input/, 7],                         // ROUNDDOWN takes digits
    ['Sqrt(a) = a', /name of a built-in Excel function/, 0],
    ['F(Int) = Int', /"Int" is the name of a built-in Excel function/, 2],
    ['F(a) = CHOOSE(a)', /CHOOSE takes at least 2 inputs/, 7],
    ['Choose(a) = a', /name of a built-in Excel function/, 0],
    ['F(a) = MOD(a)', /MOD takes exactly 2 inputs/, 7],
    ['F(a) = IFERROR(a)', /IFERROR takes exactly 2 inputs/, 7],
    ['F(a) = MIN()', /MIN takes at least 1 input/, 7],
    ['F(a) = MIN', /MIN needs its inputs in brackets/, 7],
    ['F(a) = a(1)', /"a" is an input, not a function/, 7],
    ['F(a) = F(a)', /can't call itself/, 7],
    ['F(a) = 1a', /a name can't start with a digit/, 7],
    ['F(a; b) = a', /separated by "," not ";"/, 3],
    ['F(a) = 1e999', /too large/, 7],
    ['F(a) = a +\n  \u0000', /can't be used/, 13],
  ];
  for(const [text, message, at] of REJECTED){
    test(`rejects ${JSON.stringify(text)} with a message and its place`, () => {
      const r = S.parseFunctionText(text);
      expect(r.ok).toBe(false);
      expect(r.error.message).toMatch(message);
      expect(r.error.at).toBe(at);
      expect(r.error.length).toBeGreaterThanOrEqual(1);
    });
  }

  test('limits: length, inputs, names, nesting — a hostile file can\'t make it work without end', () => {
    const L = S.FUNCTION_LIMITS;
    expect(S.parseFunctionText('F(x) = ' + 'x+'.repeat(L.text) + 'x').error.message).toMatch(/too long/);
    const inputs = Array.from({ length: L.inputs + 1 }, (_, i) => 'a' + i);
    expect(S.parseFunctionText(`F(${inputs.join(',')}) = a0`).error.message).toMatch(/at most 32 inputs/);
    expect(S.parseFunctionText(`F(${inputs.slice(0, L.inputs).join(',')}) = a0`).ok).toBe(true);
    expect(S.parseFunctionText('F(' + 'a'.repeat(L.name + 1) + ') = 1').error.message).toMatch(/at most 64 characters/);
    expect(S.parseFunctionText('F(x) = ' + '('.repeat(L.nesting + 1) + 'x' + ')'.repeat(L.nesting + 1)).error.message).toMatch(/nested too deeply/);
    expect(S.parseFunctionText('F(x) = ' + '-'.repeat(L.nesting + 1) + 'x').error.message).toMatch(/nested too deeply/);
    expect(S.parseFunctionText('F(x) = ' + 'MIN('.repeat(L.nesting + 1) + 'x' + ')'.repeat(L.nesting + 1)).error.message).toMatch(/nested too deeply/);
    expect(S.parseFunctionText('F(x) = ' + '('.repeat(L.nesting) + 'x' + ')'.repeat(L.nesting)).ok).toBe(true);
    // A long flat formula (every character used) still calculates.
    expect(run('F(x) = x' + '+x'.repeat(1990), [1])).toEqual({ value: 1991 });
    // Not text at all.
    for(const bad of [null, undefined, 42, {}, []]) expect(S.parseFunctionText(bad).ok).toBe(false);
  });

  test('text from a file is only ever data: the parser runs nothing', () => {
    // Nothing in the shared function code can run text as code.
    const src = fs.readFileSync(path.join(SHARED, 'functions.js'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\beval\s*\(|new\s+Function|\bFunction\s*\(|setTimeout|setInterval|import\s*\(|require\s*\(/);
    // Names that look like JavaScript are only names.
    for(const text of ['F(x) = constructor(x)', 'F(x) = toString(x)', 'F(x) = __proto__(x)', 'F(x) = globalThis.process(x)']){
      const r = S.parseFunctionText(text);
      expect(r.ok, text).toBe(true);
      expect(r.body.t).toBe('call');
      expect(run(text, [1])).toEqual({ error: 'function-missing' });
    }
    expect(S.parseFunctionText('F(x) = x; process.exit(1)').ok).toBe(false);
    expect(S.parseFunctionText('F(x) = `x`').ok).toBe(false);
  });

  test('definitions from files are cleaned: anything malformed is left out', () => {
    const good = { family: 'family-f', version: 2, versionId: '<b>bad id</b>', text: 'F(x) = x', description: 'd'.repeat(5000), note: 7,
      calls: [null, { name: 'G', family: 'family-g', version: 1 }, { name: '', family: 'family-h', version: 1 }, { name: 'H', family: 'short', version: 1 }], extra: '<script>' };
    const cleaned = S.cleanFunctionDefinitions([null, 'text', 42, { family: '', version: 1, text: 'F() = 1' }, { family: 'family-f', version: 0, text: 'F() = 1' },
      { family: 'family-f', version: 1.5, text: 'F() = 1' }, { family: 'family-f', version: 1, text: '' }, { family: 'family-f', version: 1, text: 5 },
      { family: 'fam', version: 1, text: 'F() = 1' }, { family: '<script>alert(1)</script>', version: 1, text: 'F() = 1' }, good]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toEqual({ family: 'family-f', version: 2, versionId: '', text: 'F(x) = x', description: 'd'.repeat(S.FUNCTION_LIMITS.description), note: '',
      calls: [{ name: 'G', family: 'family-g', version: 1, versionId: '' }] });
    expect(S.cleanFunctionDefinitions('not a list')).toEqual([]);
  });
});

// ---- the samples, in Node ----
// What every rectangle of a sample shows, from the shared IR alone: name → [value or error code per period].
function sharedValues(sys){
  const ir = S.compileModel(sys);
  const r = S.evaluateModel(ir);
  const out = {};
  sys.canvases.forEach((c, ci) => c.nodes.forEach(n => {
    const key = c.name + '::' + (n.type === 'value' ? n.text.split('\n')[0] : '#' + n.id);
    out[key] = r[ci].values.map((v, p) => (v[n.id] !== undefined ? v[n.id] : r[ci].errors[p][n.id]));
  }));
  return { ir, out };
}
const BASIC = {
  'Margin v1': [0.4, 0.7, -0.2],
  'Margin v2': [40, 70, -20],                    // two versions of one family in one model
  'Profit': [40, 140, -10],                      // a function calling a function
  'Precedence': [11, 11, 11],                    // -x^2 + 2^-1 * 3 - (1 - x) / 4, x = 3
  'Safe ratio': [0, 0, 0],                       // IFERROR(a / b, 0), b = 0
  'Caught': [7, 7, 7],                           // IFERROR catches a failing input
  'In band': [1, 1, 1],                          // comparisons give 1 or 0
  'Clamped': [4, 4, 4],
  'Rate': [0.05, 0.05, 0.05],                    // no inputs
  'Closing': [100, 105, 110.25],                 // a corkscrew through a function: period 1 uses the typed number
  'Stats': [10, 10, 10],                         // MOD(-7, 3) + AVERAGE(-7, 3) + ABS(3 - -7)
  'Per unit': [25000, 50000, 12500],
  'Total': [260, 360, 210],
  'Square': [10000, 40000, 2500],
  'Block margin': [0.4, 0.7, -0.2],              // a function inside a block
};
const BASIC_UNITS = { 'Profit': '$k', 'Per unit': '$/t', 'Total': '$k', 'Margin v1': '', 'Square': '', 'Precedence': '', 'Rate': '' };
const BROKEN = {
  '#fmiss': 'function-missing',                  // not in the file
  '#fvid': 'function-missing',                   // same family and version, another versionId
  '#fbad': 'function-unreadable',
  '#floop': 'function-cycle',                    // LoopA calls LoopB calls LoopA (only a hand-edited file)
  '#fnocall': 'function-missing',                // calls a name its `calls` doesn't list
  '#farity': 'function-arguments',
  '#fdeep': 'function-too-deep',                 // 17 levels of calls
  '#funw': 'function-input-unwired',
  '#ffail': 'missing-input',                     // an input that fails
  '#fself': 'missing-input',                     // a loop through the function node
};

test('functions/basic.json in Node: known answers and units', () => {
  const sys = sample('basic');
  const before = JSON.stringify(sys);
  const { ir, out } = sharedValues(sys);
  expect(JSON.stringify(sys)).toBe(before);       // compileModel changes nothing in the file
  for(const [name, values] of Object.entries(BASIC)) expect(out['Functions::' + name], name).toEqual(values);
  const unitByName = (name) => {
    const n = sys.canvases[0].nodes.find(x => x.type === 'value' && x.text.split('\n')[0] === name);
    return S.formatUOM(S.unitOf(ir, 'cMain', n.id));
  };
  for(const [name, unit] of Object.entries(BASIC_UNITS)) expect(unitByName(name), name).toBe(unit);
});

test('functions/broken.json in Node: each problem has its own error, and the rest still calculates', () => {
  const { out } = sharedValues(sample('broken'));
  for(const [id, code] of Object.entries(BROKEN)) expect(out['Broken::' + id], id).toEqual([code, code]);
  expect(out['Broken::Deep enough']).toEqual([115, 115]);      // 16 levels are allowed
  expect(out['Broken::Unwired unused']).toEqual([200, 200]);
  expect(out['Broken::Unwired caught']).toEqual([100, 100]);
});

test('a model without functions compiles none, and a missing list is no list', () => {
  const sys = JSON.parse(fs.readFileSync(fixture('models', 'combined-bs-corkscrew-block.json'), 'utf8'));
  expect(S.compileModel(sys.system || sys).functions.list).toEqual([]);
  expect(S.compileModel(Object.assign({}, sys.system || sys, { functions: 'junk' })).functions.list).toEqual([]);
});

test('functionsUsedBy: what a file carries — the versions in use, and what they call', () => {
  const sys = sample('basic');
  const used = S.functionsUsedBy(sys.canvases, sys.functions);
  expect(used.map(d => d.family + '@' + d.version)).toEqual(sys.functions.filter(d => d.family !== 'family-unused').map(d => d.family + '@' + d.version));
  const onlyProfit = [{ nodes: [sys.canvases[0].nodes.find(n => n.id === 'fp')] }];
  expect(S.functionsUsedBy(onlyProfit, sys.functions).map(d => d.family + '@' + d.version)).toEqual(['family-margin@1', 'family-profit@1']);
  expect(S.functionsUsedBy([{ nodes: [] }], sys.functions)).toEqual([]);
});

// ---- the same call written several times ----
// A function reading its input four times, nested `levels` deep (at most 16 are allowed):
// R0(x) = R1(x) + R1(x) + R1(x) + R1(x), …, the last one x + x + x + x. Worked out call by
// call, that is 4^levels calls — hours at 16 levels; an identical call in one formula is
// worked out once.
function repeatedCalls(levels){
  const fam = (i) => 'family-rep-' + String(i).padStart(3, '0');
  const functions = [];
  for(let i = 0; i < levels; i++){
    const next = i + 1 < levels ? 'R' + (i + 1) + '(x)' : 'x';
    functions.push({ family: fam(i), version: 1, versionId: 'version-rep-' + i, text: 'R' + i + '(x) = ' + [next, next, next, next].join(' + '),
      calls: i + 1 < levels ? [{ name: 'R' + (i + 1), family: fam(i + 1), version: 1, versionId: 'version-rep-' + (i + 1) }] : [] });
  }
  return { kind: 'system', version: 5, periods: ['P1', 'P2'], functions, canvases: [{ id: 'cRep', name: 'Repeat', nodes: [
    { id: 'x', type: 'value', x: 0, y: 0, text: 'x\n1\n$k', periodValues: [1, 2] },
    { id: 'f', type: 'function', x: 200, y: 0, fn: { family: fam(0), version: 1, versionId: 'version-rep-0', name: 'R0' } },
    { id: 'big', type: 'value', x: 400, y: 0, text: 'Big' },
  ], edges: [{ id: 'e1', from: 'x', to: 'f', toPort: 0 }, { id: 'e2', from: 'f', to: 'big' }] }] };
}

// 11 levels here: call by call, about 4 s (so a return of the problem fails instead of
// stopping the test run for hours, as 16 would in Node); fmIDE below has 16.
test('a call written several times in one formula is worked out once: 11 levels calculate at once', () => {
  const started = Date.now();
  const ir = S.compileModel(repeatedCalls(11));
  const [r] = S.evaluateModel(ir);
  expect(r.values[0].big).toBe(4 ** 11);
  expect(r.values[1].big).toBe(2 * 4 ** 11);
  expect(S.formatUOM(S.unitOf(ir, 'cRep', 'big'))).toBe('$k');
  expect(Date.now() - started).toBeLessThan(1000);
});

test('an identical call gives the identical result, errors and IFERROR included', () => {
  const others = [{ name: 'Inv', text: 'Inv(x) = 1 / x' }];
  // Caught by one IFERROR, then read again under another: the same error both times.
  expect(run('F(x) = IFERROR(Inv(x), 5) + IFERROR(Inv(x), 6)', [0], others)).toEqual({ value: 11 });
  expect(run('F(x) = IFERROR(Inv(x), 5) + Inv(x)', [0], others)).toEqual({ error: 'math-error' });
  expect(run('F(x) = Inv(x) + Inv(x) * 2', [4], others)).toEqual({ value: 0.75 });
  // Different arguments are different calls.
  expect(run('F(x, y) = Inv(x) + Inv(y) + Inv(x + 0) + Inv(-x)', [2, 4], others)).toEqual({ value: 0.75 });
  // A missing input is read only where a call needs it, however often the call is written.
  expect(run('F(a, b) = IFERROR(Inv(b), a) + IFERROR(Inv(b), a)', [5], others)).toEqual({ value: 10 });
});

// ---- fmIDE ----
async function openSample(page, name){
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'loadSystem', fixture('functions', name + '.json'));
  await F.acceptAll(page);
  await page.waitForFunction(() => fm.canvases().some(c => c.name === 'Functions' || c.name === 'Broken'));
}
// fmIDE's value of each rectangle named in `names` on `canvas`, in every period.
function fmideValues(page, canvas, names, periods){
  return page.evaluate(([canvas, names, periods]) => {
    fm.switchCanvas(canvas);
    const out = {};
    names.forEach(n => {
      out[n] = [];
      for(let p = 1; p <= periods; p++){
        try{ out[n].push(fm.getValue(n, p)); }
        catch(e){ out[n].push('error: ' + e.message); }
      }
    });
    return out;
  }, [canvas, names, periods]);
}

test('fmIDE calculates functions/basic.json as the shared IR does', async ({ page }) => {
  await openSample(page, 'basic');
  expect(await fmideValues(page, 'Functions', Object.keys(BASIC), 3)).toEqual(BASIC);
});

test('fmIDE says what is wrong with a function node', async ({ page }) => {
  await openSample(page, 'broken');
  const messages = await page.evaluate((ids) => {
    fm.switchCanvas('Broken');
    return ids.map(id => { try{ return fm.getValue('#' + id, 1); }catch(e){ return e.message; } });
  }, Object.keys(BROKEN).map(k => k.slice(1)));
  expect(messages).toEqual([
    "function Gone has no value: This function's definition isn't in the model (or a function it calls is missing)..",
    "function Margin has no value: This function's definition isn't in the model (or a function it calls is missing)..",
    "function Bad has no value: This function's formula can't be read..",
    'function LoopA has no value: This function calls itself through other functions, in a loop..',
    "function NoCall has no value: This function's definition isn't in the model (or a function it calls is missing)..",
    'function OneOnly has no value: This function calls another function with the wrong number of inputs..',
    'function L0 has no value: This function calls other functions nested too deeply..',
    "function Margin has no value: One of this function's inputs isn't connected..",
    "function Margin has no value: One of this operator's inputs could not be computed..",
    "function IgnoreSecond has no value: One of this operator's inputs could not be computed..",
  ]);
  expect(await fmideValues(page, 'Broken', ['Deep enough', 'Unwired unused', 'Unwired caught'], 2))
    .toEqual({ 'Deep enough': [115, 115], 'Unwired unused': [200, 200], 'Unwired caught': [100, 100] });
});

test('fmIDE calculates a call written several times, 16 levels deep, at once', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('repeated-calls.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(repeatedCalls(16)));
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'loadSystem', file);
  await F.acceptAll(page);
  await page.waitForFunction(() => fm.canvases().some(c => c.name === 'Repeat'));
  expect(await fmideValues(page, 'Repeat', ['Big'], 2)).toEqual({ Big: [4 ** 16, 2 * 4 ** 16] });
});

test('Save System carries the functions the model uses (system v5, now v9); the saved file calculates the same', async ({ page }, testInfo) => {
  await openSample(page, 'basic');
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  expect(data.version).toBe(9);
  const all = sample('basic').functions;
  expect(data.functions).toEqual(all.filter(d => d.family !== 'family-unused'));
  const saved = testInfo.outputPath('saved.json');
  fs.writeFileSync(saved, JSON.stringify(data));
  await page.evaluate(() => fm.renameCanvas({ canvas: 'Functions', name: 'Before' }));
  await F.importViaCommand(page, 'loadSystem', saved);
  await F.acceptAll(page);
  expect(await fmideValues(page, 'Functions', Object.keys(BASIC), 3)).toEqual(BASIC);
});

test('the workspace carries the function library (v4, now v10), and the autosave keeps it', async ({ page }) => {
  await openSample(page, 'basic');
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(data.version).toBe(10);
  expect(data.system.version).toBe(9);
  // The library holds every version the file brought, the unused one too.
  expect(data.functions.map(d => d.family + '@' + d.version)).toEqual(sample('basic').functions.map(d => d.family + '@' + d.version));
  expect(data.system.functions.map(d => d.family)).not.toContain('family-unused');

  await page.reload();
  await page.waitForFunction(() => window.fm && fm.canvases().some(c => c.name === 'Functions'));
  expect(await fmideValues(page, 'Functions', Object.keys(BASIC), 3)).toEqual(BASIC);
  const again = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(again.data.functions).toEqual(data.functions);
});

test('Save Module carries its canvas\'s functions (module v3, now v7); loading it brings them along', async ({ page }, testInfo) => {
  await openSample(page, 'basic');
  await page.evaluate(() => fm.switchCanvas('Margin Block'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  expect(data.version).toBe(7);
  expect(data.functions.map(d => d.family + '@' + d.version)).toEqual(['family-margin@1']);
  const saved = testInfo.outputPath('module.json');
  fs.writeFileSync(saved, JSON.stringify(data));

  // A new model knows no functions; the module brings its own.
  await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-current.json'));
  await F.acceptAll(page);
  await F.importViaCommand(page, 'loadModule', saved);
  await F.acceptAll(page);
  const value = await page.evaluate(() => {
    const f = fm.nodes().find(n => n.type === 'function');
    return fm.getValue('#' + f.id);
  }).catch(e => e.message);
  // Its Input ports are fed by nothing here: (0 - 0) / 0.
  expect(value).toMatch(/Invalid result/);
  const saveAgain = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  expect(saveAgain.data.functions.map(d => d.family + '@' + d.version)).toEqual(['family-margin@1']);
});

test('a template holding a model with functions (templates v4) brings them when inserted', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  const sys = sample('basic');
  const file = testInfo.outputPath('templates.json');
  fs.writeFileSync(file, JSON.stringify({ version: 4, kind: 'fmIDE-templates', templates: [
    { name: 'Margins', kind: 'system', family: 'family-t', version: 1, versionId: 'version-t', note: '', data: sys }] }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file);
  await expect(page.locator('.modal-box .template-list button', { hasText: 'Margins' })).toHaveCount(1);
  await page.evaluate(() => fm.insertTemplate('Margins', 'replace'));
  expect(await fmideValues(page, 'Functions', ['Profit', 'Margin v2'], 3)).toEqual({ 'Profit': BASIC['Profit'], 'Margin v2': BASIC['Margin v2'] });
});

// ---- ExcelExporter reads them ----
test('ExcelExporter loads a system with functions and generates a workbook', async ({ page }) => {
  await X.openExporter(page);
  await X.loadModelFile(page, fixture('functions', 'basic.json'));
  await expect(page.locator('#loadStatus .status')).toHaveClass(/ok/);
  const { bytes } = await X.generate(page);
  expect(bytes.length).toBeGreaterThan(0);
});
