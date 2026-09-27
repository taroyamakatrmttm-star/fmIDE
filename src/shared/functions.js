// ---------- function plugins (shared: src/shared/functions.js) ----------
// A function is a formula held in a file, written with the operators of the catalogue
// (operators.js), for example
//   Margin(Revenue, Cost) = (Revenue - Cost) / Revenue
// It is read by the parser below — never run as code: no eval, no new Function. Everything
// in a definition comes from a file and is untrusted; the parser only builds a small tree
// of plain objects, and names never reach a formula or the page as markup.
//
// A definition, as files carry it (system v5, module v3, fmIDE-workspace v4,
// fmIDE-functions v1; docs/file-formats.md):
//   { family, version, versionId, text, description, note,
//     calls: [{ name, family, version, versionId }] }
// `family` is a lasting random id (never the name), `version` 1, 2, 3…, `versionId` random.
// `text` is the whole definition: its name, its inputs and its formula. `calls` pins each
// function the formula calls, by the name it is written with, to a family and version: the
// calculation follows `calls`, never the name alone.
// A function node on a canvas refers to one version:
//   { type: 'function', fn: { family, version, versionId, name } }
// and each arrow into it carries `toPort`, the index of the input it feeds (from 0).
// Uses operators.js (applyOperator, operatorById) and uom.js (units).

// Limits, so a file can't make either app work without end.
const FUNCTION_LIMITS = { text: 4000, name: 64, inputs: 32, nesting: 64, callDepth: 16, description: 2000, note: 500, calls: 64 };

// The functions of the syntax that are built in: the catalogue's operators by their Excel
// names, with Excel's number of arguments. (Lookup tables without a prototype, so no name
// from a file can match anything but their own entries.)
const FUNCTION_BUILTINS = Object.assign(Object.create(null), {
  MIN:     { id: 'min',     min: 1, max: Infinity },
  MAX:     { id: 'max',     min: 1, max: Infinity },
  AVERAGE: { id: 'average', min: 1, max: Infinity },
  ABS:     { id: 'abs',     min: 1, max: 1 },
  MOD:     { id: 'mod',     min: 2, max: 2 },
  IFERROR: { id: 'iferror', min: 2, max: 2 },
});
// Names kept back: Excel functions that are not available (yet), so a formula using one
// says so instead of looking for a function of that name.
const FUNCTION_RESERVED = new Set(['IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR', 'SUM', 'PRODUCT', 'ROUND', 'ROUNDUP',
  'ROUNDDOWN', 'INT', 'TRUNC', 'LN', 'LOG', 'LOG10', 'EXP', 'SQRT', 'POWER', 'SIGN', 'COUNT', 'LET', 'LAMBDA',
  'CHOOSE', 'INDEX', 'NA', 'TRUE', 'FALSE', 'PI', 'CEILING', 'FLOOR', 'MEDIAN', 'SUMPRODUCT']);
// Symbols and the catalogue operator each one is. The typographic signs fmIDE shows on its
// operators are accepted too.
const FUNCTION_SYMBOLS = Object.assign(Object.create(null), {
  '+': 'add', '-': 'subtract', '−': 'subtract', '*': 'multiply', '×': 'multiply', '/': 'divide', '÷': 'divide',
  '^': 'power', '<': 'lt', '<=': 'le', '≤': 'le', '>': 'gt', '>=': 'ge', '≥': 'ge',
});
const FUNCTION_COMPARISONS = new Set(['lt', 'le', 'gt', 'ge']);

// ---- the parser ----
// Returns { ok: true, name, params, body, calls } or { ok: false, error: { message, at, length } }
// (`at` is the position in the text, from 0). `body` is a tree of
//   { t: 'num', v } · { t: 'param', i } (input i, from 0) · { t: 'neg', a } ·
//   { t: 'op', id, args } (a catalogue operator: binary for symbols, any count for built-ins) ·
//   { t: 'call', name, key, args } (another function; `key` is its name in lower case)
// and `calls` lists the called names (lower case) in the order they first appear.
// Precedence follows Excel: a leading minus binds tightest (-2^2 = 4), then ^ (from the
// left), then * and /, then + and −, then one comparison.
function parseFunctionText(text){
  const src = typeof text === 'string' ? text : '';
  const fail = (message, at, length) => { throw { fnParseError: true, message, at: at || 0, length: Math.max(1, length || 1) }; };
  try{
    if(src.length > FUNCTION_LIMITS.text) fail(`The definition is too long (at most ${FUNCTION_LIMITS.text} characters).`, FUNCTION_LIMITS.text, 1);
    const tokens = tokenizeFunctionText(src, fail);
    let pos = 0, depth = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const at = () => (tokens[pos] ? tokens[pos].at : src.length);
    const expect = (type, value, message) => {
      const tok = peek();
      if(!tok || tok.type !== type || (value !== undefined && tok.value !== value)) fail(message, at(), tok ? tok.text.length : 1);
      return next();
    };

    // The header: Name(Input, Input, …) =
    const nameTok = peek();
    if(!nameTok || nameTok.type !== 'name') fail('A definition starts with the function\'s name and its inputs, like Margin(Revenue, Cost) = (Revenue - Cost) / Revenue.', at(), 1);
    next();
    const name = nameTok.value;
    const upperName = name.toUpperCase();
    if(FUNCTION_BUILTINS[upperName] || FUNCTION_RESERVED.has(upperName)) fail(`"${name}" is the name of a built-in Excel function: choose another name.`, nameTok.at, name.length);
    expect('punct', '(', 'Expected "(" after the function\'s name, then its inputs.');
    const params = [], paramIndex = new Map();
    if(!(peek() && peek().type === 'punct' && peek().value === ')')){
      for(;;){
        const p = expect('name', undefined, 'Expected the name of an input.');
        const key = p.value.toLowerCase();
        const upper = p.value.toUpperCase();
        if(FUNCTION_BUILTINS[upper] || FUNCTION_RESERVED.has(upper)) fail(`"${p.value}" is the name of a built-in Excel function and can't be an input's name.`, p.at, p.text.length);
        if(key === name.toLowerCase()) fail(`An input can't have the function's own name, "${p.value}".`, p.at, p.text.length);
        if(paramIndex.has(key)) fail(`Two inputs are both called "${p.value}".`, p.at, p.text.length);
        if(params.length >= FUNCTION_LIMITS.inputs) fail(`A function can have at most ${FUNCTION_LIMITS.inputs} inputs.`, p.at, p.text.length);
        paramIndex.set(key, params.length);
        params.push(p.value);
        const sep = peek();
        if(sep && sep.type === 'punct' && sep.value === ','){ next(); continue; }
        break;
      }
    }
    expect('punct', ')', 'Expected "," or ")" after an input\'s name.');
    expect('punct', '=', 'Expected "=" after the inputs, then the formula.');
    if(!peek()) fail('The formula after "=" is missing.', src.length, 1);

    const calls = [];
    const enter = () => { if(++depth > FUNCTION_LIMITS.nesting) fail(`The formula is nested too deeply (at most ${FUNCTION_LIMITS.nesting} levels).`, at(), 1); };
    const leave = () => { depth--; };
    const isOp = (ids) => { const tok = peek(); return !!tok && tok.type === 'op' && ids.includes(tok.value); };

    function comparison(){
      const left = additive();
      if(peek() && peek().type === 'op' && FUNCTION_COMPARISONS.has(peek().value)){
        const op = next();
        const right = additive();
        if(peek() && peek().type === 'op' && FUNCTION_COMPARISONS.has(peek().value)){
          fail('Comparisons can\'t be chained (a < b < c): compare two values at a time.', peek().at, peek().text.length);
        }
        return { t: 'op', id: op.value, args: [left, right] };
      }
      return left;
    }
    function additive(){
      let left = multiplicative();
      while(isOp(['add', 'subtract'])){ const op = next(); left = { t: 'op', id: op.value, args: [left, multiplicative()] }; }
      return left;
    }
    function multiplicative(){
      let left = power();
      while(isOp(['multiply', 'divide'])){ const op = next(); left = { t: 'op', id: op.value, args: [left, power()] }; }
      return left;
    }
    function power(){
      let left = unary();
      while(isOp(['power'])){ next(); left = { t: 'op', id: 'power', args: [left, unary()] }; }
      return left;
    }
    function unary(){
      if(isOp(['subtract', 'add'])){
        const op = next();
        enter();
        const a = unary();
        leave();
        return op.value === 'subtract' ? { t: 'neg', a } : a;
      }
      return primary();
    }
    function primary(){
      const tok = peek();
      if(!tok) fail('The formula ends too soon: expected a number, an input or "(".', src.length, 1);
      if(tok.type === 'num'){ next(); return { t: 'num', v: tok.value }; }
      if(tok.type === 'punct' && tok.value === '('){
        next();
        enter();
        const inner = comparison();
        leave();
        expect('punct', ')', 'Expected ")" here.');
        return inner;
      }
      if(tok.type === 'name'){
        next();
        const key = tok.value.toLowerCase();
        const upper = tok.value.toUpperCase();
        const opens = peek() && peek().type === 'punct' && peek().value === '(';
        if(!opens){
          if(paramIndex.has(key)) return { t: 'param', i: paramIndex.get(key) };
          if(FUNCTION_BUILTINS[upper]) fail(`${upper} needs its inputs in brackets, like ${upper}(a, b).`, tok.at, tok.text.length);
          fail(`"${tok.value}" isn't one of this function's inputs.`, tok.at, tok.text.length);
        }
        if(paramIndex.has(key)) fail(`"${tok.value}" is an input, not a function.`, tok.at, tok.text.length);
        if(FUNCTION_RESERVED.has(upper)) fail(`${upper} isn't available in functions yet.`, tok.at, tok.text.length);
        if(key === name.toLowerCase()) fail('A function can\'t call itself.', tok.at, tok.text.length);
        next(); // (
        enter();
        const args = [];
        if(!(peek() && peek().type === 'punct' && peek().value === ')')){
          for(;;){
            args.push(comparison());
            if(peek() && peek().type === 'punct' && peek().value === ','){ next(); continue; }
            break;
          }
        }
        leave();
        expect('punct', ')', 'Expected "," or ")" in the list of inputs.');
        const builtin = FUNCTION_BUILTINS[upper];
        if(builtin){
          if(args.length < builtin.min || args.length > builtin.max){
            const count = builtin.min === builtin.max ? `exactly ${builtin.min}` : `at least ${builtin.min}`;
            fail(`${upper} takes ${count} input${builtin.min === 1 && builtin.max === 1 ? '' : 's'}.`, tok.at, tok.text.length);
          }
          return { t: 'op', id: builtin.id, args };
        }
        if(!calls.includes(key)){
          if(calls.length >= FUNCTION_LIMITS.calls) fail(`A function can call at most ${FUNCTION_LIMITS.calls} other functions.`, tok.at, tok.text.length);
          calls.push(key);
        }
        return { t: 'call', name: tok.value, key, args };
      }
      if(tok.type === 'punct' && tok.value === ')') fail('Unexpected ")".', tok.at, 1);
      if(tok.type === 'punct' && tok.value === '=') fail('"=" can only follow the inputs. To compare, use <, <=, > or >=.', tok.at, 1);
      fail(`Expected a number, an input or "(" here, not "${tok.text}".`, tok.at, tok.text.length);
    }

    const body = comparison();
    if(peek()){
      const tok = peek();
      if(tok.type === 'punct' && tok.value === ')') fail('Unexpected ")": there is no "(" for it to close.', tok.at, 1);
      if(tok.type === 'punct' && tok.value === '=') fail('"=" can only follow the inputs. To compare, use <, <=, > or >=.', tok.at, 1);
      fail(`Unexpected "${tok.text}": expected an operator such as + or *.`, tok.at, tok.text.length);
    }
    return { ok: true, name, params, body, calls };
  } catch(err){
    if(err && err.fnParseError) return { ok: false, error: { message: err.message, at: err.at, length: err.length } };
    if(err instanceof RangeError) return { ok: false, error: { message: 'The formula is nested too deeply.', at: 0, length: 1 } };
    throw err;
  }
}

// The text as tokens: { type: 'name' | 'num' | 'op' | 'punct', value, text, at }.
function tokenizeFunctionText(src, fail){
  const tokens = [];
  const nameStart = /[\p{L}_]/u, namePart = /[\p{L}\p{N}_.]/u;
  let i = 0;
  while(i < src.length){
    const ch = src[i];
    if(/\s/.test(ch)){ i++; continue; }
    const start = i;
    if(/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))){
      const m = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i, i + 400));
      const text = m[0];
      const value = Number(text);
      if(!isFinite(value)) fail('That number is too large.', start, text.length);
      if(nameStart.test(src[i + text.length] || '')) fail(`"${src.slice(i, i + text.length + 1)}" isn't a number or a name: a name can't start with a digit.`, start, text.length + 1);
      tokens.push({ type: 'num', value, text, at: start });
      i += text.length;
      continue;
    }
    if(nameStart.test(ch)){
      let j = i + 1;
      while(j < src.length && namePart.test(src[j])) j++;
      const text = src.slice(i, j);
      if(text.length > FUNCTION_LIMITS.name) fail(`A name can be at most ${FUNCTION_LIMITS.name} characters long.`, start, text.length);
      tokens.push({ type: 'name', value: text, text, at: start });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if(two === '<=' || two === '>='){ tokens.push({ type: 'op', value: FUNCTION_SYMBOLS[two], text: two, at: start }); i += 2; continue; }
    if(two === '<>') fail('"<>" isn\'t supported: comparisons are <, <=, > and >=.', start, 2);
    if(FUNCTION_SYMBOLS[ch]){ tokens.push({ type: 'op', value: FUNCTION_SYMBOLS[ch], text: ch, at: start }); i++; continue; }
    if(ch === '(' || ch === ')' || ch === ',' || ch === '='){ tokens.push({ type: 'punct', value: ch, text: ch, at: start }); i++; continue; }
    if(ch === '%') fail('"%" isn\'t supported: use MOD(a, b) for a remainder, or / 100 for a percentage.', start, 1);
    if(ch === ';') fail('Inputs are separated by "," not ";".', start, 1);
    const shown = ch === '"' ? 'a quote (")' : `"${ch}"`;
    fail(`${shown} can't be used in a function's formula.`, start, 1);
  }
  return tokens;
}

// ---- definitions from files ----
// A clean copy of each definition in `list` that has what a definition needs; anything else
// is left out. Nothing from the file is kept that isn't listed here.
function cleanFunctionDefinitions(list){
  const out = [];
  (Array.isArray(list) ? list : []).forEach(d => {
    const clean = cleanFunctionDefinition(d);
    if(clean) out.push(clean);
  });
  return out;
}
function cleanFunctionDefinition(d){
  if(!d || typeof d !== 'object') return null;
  const ref = cleanFunctionRef(d);
  if(!ref || typeof d.text !== 'string' || !d.text.trim()) return null;
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const calls = [];
  (Array.isArray(d.calls) ? d.calls : []).slice(0, FUNCTION_LIMITS.calls).forEach(c => {
    const r = cleanFunctionRef(c);
    if(r && typeof c.name === 'string' && c.name.trim()) calls.push({ name: c.name.trim().slice(0, FUNCTION_LIMITS.name), family: r.family, version: r.version, versionId: r.versionId });
  });
  return { family: ref.family, version: ref.version, versionId: ref.versionId, text: d.text.slice(0, FUNCTION_LIMITS.text + 1),
    description: str(d.description, FUNCTION_LIMITS.description), note: str(d.note, FUNCTION_LIMITS.note), calls };
}
// { family, version, versionId } from a reference (a function node's `fn`, an entry of
// `calls`), or null. Ids are 8–64 letters, digits and dashes, as for templates; a malformed
// `versionId` counts as unknown ('').
const FUNCTION_ID = /^[A-Za-z0-9-]{8,64}$/;
function cleanFunctionRef(r){
  if(!r || typeof r !== 'object') return null;
  if(typeof r.family !== 'string' || !FUNCTION_ID.test(r.family)) return null;
  const version = Number(r.version);
  if(!Number.isInteger(version) || version < 1) return null;
  const versionId = (typeof r.versionId === 'string' && FUNCTION_ID.test(r.versionId)) ? r.versionId : '';
  return { family: r.family, version, versionId };
}
function functionKey(ref){ return ref.family + '@' + ref.version; }

// The function name a definition's text starts with, or '' (for showing a definition whose
// text can't be read).
function functionNameOf(def){
  const m = def && typeof def.text === 'string' ? /^\s*([\p{L}_][\p{L}\p{N}_.]*)/u.exec(def.text) : null;
  return m ? m[1].slice(0, FUNCTION_LIMITS.name) : '';
}

// ---- compiling: the definitions a model carries ----
// Reads `list` (a file's `functions`) and returns { resolve(ref) → compiled or null, list }.
// A compiled function is { family, version, versionId, name, params, body, targets, status }:
// `targets` maps each called name (lower case) to the compiled function it calls, and
// `status` is null when it can be calculated, or an error code:
//   function-unreadable (its text doesn't parse), function-missing (it calls a function
//   that isn't in the file), function-cycle (functions calling each other in a loop),
//   function-too-deep (calls nested more than FUNCTION_LIMITS.callDepth deep),
//   function-arguments (it calls a function with the wrong number of inputs).
// A reference with a versionId matches only the definition with that versionId.
function compileFunctions(list){
  const byKey = new Map();
  const compiled = [];
  cleanFunctionDefinitions(list).forEach(def => {
    const key = functionKey(def);
    if(byKey.has(key)) return; // the first definition of a family and version is the one used
    const parsed = parseFunctionText(def.text);
    const c = { family: def.family, version: def.version, versionId: def.versionId, def,
      name: parsed.ok ? parsed.name : functionNameOf(def), params: parsed.ok ? parsed.params : [],
      body: parsed.ok ? parsed.body : null, parseError: parsed.ok ? null : parsed.error,
      calledNames: parsed.ok ? parsed.calls : [], targets: new Map(), status: undefined, depth: 0 };
    byKey.set(key, c);
    compiled.push(c);
  });
  const resolve = (ref) => {
    const r = cleanFunctionRef(ref);
    const c = r ? byKey.get(functionKey(r)) : null;
    if(!c) return null;
    if(r.versionId && c.versionId && r.versionId !== c.versionId) return null;
    return c;
  };
  // Status and depth, following the calls (a loop is found by the walk meeting itself).
  const visiting = new Set();
  const settle = (c) => {
    if(c.status !== undefined) return;
    if(visiting.has(c)){ c.status = 'function-cycle'; return; }
    if(c.parseError){ c.status = 'function-unreadable'; return; }
    visiting.add(c);
    let status = null, depth = 1;
    for(const key of c.calledNames){
      const entry = c.def.calls.find(e => e.name.toLowerCase() === key);
      const target = entry ? resolve(entry) : null;
      if(!target){ status = status || 'function-missing'; continue; }
      c.targets.set(key, target);
      settle(target);
      if(visiting.has(target) || target.status === 'function-cycle'){ status = 'function-cycle'; continue; }
      if(target.status) status = status || target.status;
      depth = Math.max(depth, target.depth + 1);
    }
    // Every call gives the function it calls exactly as many inputs as it has.
    if(!status){
      const wrongCount = (x) => {
        if(x.t === 'call' && x.args.length !== c.targets.get(x.key).params.length) return true;
        if(x.t === 'neg') return wrongCount(x.a);
        return (x.t === 'op' || x.t === 'call') && x.args.some(wrongCount);
      };
      if(wrongCount(c.body)) status = 'function-arguments';
    }
    visiting.delete(c);
    if(c.status === 'function-cycle') return; // met itself on the way round
    if(!status && depth > FUNCTION_LIMITS.callDepth) status = 'function-too-deep';
    c.status = status;
    c.depth = depth;
  };
  compiled.forEach(settle);
  return { resolve, list: compiled };
}

// ---- calculating a call ----
// `fn` is a compiled function whose status is null; `input(i)` returns input i's result,
// { value } or { error, edge? }, and is asked only for inputs the formula actually reads
// (so IFERROR inside a function catches a failing input, as Excel does). Returns { value }
// or { error, edge? }: a failing input's own result, or { error: 'math-error' } for a result
// that isn't a finite number (a divide by zero; Excel shows #DIV/0! or #NUM!).
function runFunction(fn, input){
  const memo = [];
  const arg = (i) => {
    if(!memo[i]) memo[i] = i < fn.params.length ? input(i) : { error: 'function-input-unwired' };
    return memo[i];
  };
  return evalFunctionExpr(fn, fn.body, arg);
}
function evalFunctionExpr(fn, x, arg){
  switch(x.t){
    case 'num': return { value: x.v };
    case 'param': return arg(x.i);
    case 'neg': {
      const r = evalFunctionExpr(fn, x.a, arg);
      return r.error ? r : { value: -r.value };
    }
    case 'call': {
      // The same call written twice in one formula (the same function, the same arguments,
      // read from the same inputs) is worked out once: otherwise a function using its input
      // several times, nested, would take four times as long for each level.
      const cache = functionCallCache(arg);
      const key = functionCallKey(x);
      if(cache.has(key)) return cache.get(key);
      const target = fn.targets.get(x.key);
      const memo = [];
      const inner = (i) => {
        if(!memo[i]) memo[i] = i < x.args.length ? evalFunctionExpr(fn, x.args[i], arg) : { error: 'function-input-unwired' };
        return memo[i];
      };
      const r = runFunctionWith(target, inner);
      cache.set(key, r);
      return r;
    }
    case 'op': {
      const op = operatorById(x.id);
      if(op.fallback){
        const first = evalFunctionExpr(fn, x.args[0], arg);
        return first.error ? evalFunctionExpr(fn, x.args[1], arg) : first;
      }
      const values = [];
      for(const a of x.args){
        const r = evalFunctionExpr(fn, a, arg);
        if(r.error) return r;
        values.push(r.value);
      }
      const r = applyOperator(op, values);
      if(r.error) return { error: r.error };
      return isFinite(r.value) ? { value: r.value } : { error: 'math-error' };
    }
  }
  return { error: 'function-unreadable' };
}
// A call inside a formula: the callee's formula, with its inputs read from the caller.
function runFunctionWith(target, input){
  return evalFunctionExpr(target, target.body, input);
}

// Remembered calls, per set of inputs (`arg`, one for each formula being worked out): a call
// reads nothing but its function and its arguments, and its arguments read nothing but
// these inputs, so an identical call gives the identical result — the same value, the same
// error, the same failing arrow. Only inputs the first one read are read at all.
const FUNCTION_CALL_CACHES = new WeakMap();
function functionCallCache(arg){
  let cache = FUNCTION_CALL_CACHES.get(arg);
  if(!cache){ cache = new Map(); FUNCTION_CALL_CACHES.set(arg, cache); }
  return cache;
}
// A call as text — the called name and its argument trees — worked out once per call.
const FUNCTION_CALL_KEYS = new WeakMap();
function functionCallKey(x){
  let key = FUNCTION_CALL_KEYS.get(x);
  if(key === undefined){
    key = x.key + '(' + x.args.map(functionExprKey).join(',') + ')';
    FUNCTION_CALL_KEYS.set(x, key);
  }
  return key;
}
function functionExprKey(x){
  switch(x.t){
    case 'num': return '#' + x.v;
    case 'param': return '$' + x.i;
    case 'neg': return '-' + functionExprKey(x.a);
    case 'op': return x.id + '(' + x.args.map(functionExprKey).join(',') + ')';
    case 'call': return functionCallKey(x);
  }
  return '?';
}

// ---- units ----
// The unit of a call to `fn` (status null), where `inputUnit(i)` is input i's unit (or null).
// Worked out from the formula with the catalogue's unit rules. A number written in the
// formula has no unit of its own: it counts as a plain number for × and ÷ (Revenue * 1.1
// keeps Revenue's unit) and is left out for the rules that need equal units (Revenue + 100
// keeps it too). Returns a unit or null.
const FUNCTION_UNIT_NUMBER = { number: true };
function functionUnit(fn, inputUnit){
  const memo = [];
  const arg = (i) => { if(!(i in memo)) memo[i] = inputUnit(i); return memo[i]; };
  const u = functionExprUnit(fn, fn.body, arg);
  return u === FUNCTION_UNIT_NUMBER ? null : u;
}
function functionExprUnit(fn, x, arg){
  switch(x.t){
    case 'num': return FUNCTION_UNIT_NUMBER;
    case 'param': return arg(x.i) || null;
    case 'neg': return functionExprUnit(fn, x.a, arg);
    case 'call': {
      // As for values: an identical call in one formula has the identical unit.
      const cache = functionCallCache(arg);
      const key = functionCallKey(x);
      if(cache.has(key)) return cache.get(key);
      const target = fn.targets.get(x.key);
      const memo = [];
      const inner = (i) => { if(!(i in memo)) memo[i] = i < x.args.length ? functionExprUnit(fn, x.args[i], arg) : null; return memo[i]; };
      const u = functionExprUnit(target, target.body, inner);
      cache.set(key, u);
      return u;
    }
    case 'op': {
      const rule = operatorById(x.id).unit;
      const units = x.args.map(a => functionExprUnit(fn, a, arg));
      if(units.some(u => u === null)) return null;
      if(rule === 'multiply' || rule === 'divide'){
        if(units.every(u => u === FUNCTION_UNIT_NUMBER)) return FUNCTION_UNIT_NUMBER;
        const plain = { scale: 1, dims: {} };
        const us = units.map(u => u === FUNCTION_UNIT_NUMBER ? plain : u);
        return us.reduce((acc, u, i) => i === 0 ? u : (rule === 'multiply' ? uomMultiply(acc, u) : uomDivide(acc, u)));
      }
      if(rule === 'same'){
        const us = units.filter(u => u !== FUNCTION_UNIT_NUMBER);
        if(!us.length) return FUNCTION_UNIT_NUMBER;
        return us.every(u => uomDimsEqual(u, us[0])) ? us[0] : null;
      }
      return null;
    }
  }
  return null;
}

// ---- which definitions a model needs ----
// The definitions in `list` that the function nodes of `canvases` use, and every function
// those call, in `list`'s order — what a file carries. Unused ones are left out.
function functionsUsedBy(canvases, list){
  const defs = cleanFunctionDefinitions(list);
  if(!defs.length) return [];
  const byKey = new Map();
  defs.forEach(d => { const k = functionKey(d); if(!byKey.has(k)) byKey.set(k, d); });
  const find = (ref) => {
    const r = cleanFunctionRef(ref);
    const d = r ? byKey.get(functionKey(r)) : null;
    return (d && !(r.versionId && d.versionId && r.versionId !== d.versionId)) ? d : null;
  };
  const used = new Set();
  const visit = (d) => {
    if(!d || used.has(d)) return;
    used.add(d);
    d.calls.forEach(c => visit(find(c)));
  };
  (Array.isArray(canvases) ? canvases : []).forEach(c => (c && Array.isArray(c.nodes) ? c.nodes : []).forEach(n => {
    if(n && n.type === 'function') visit(find(n.fn));
  }));
  // In the list's order; the first definition of a family and version only.
  return defs.filter(d => used.has(d));
}
