// ---------- simplifying a model for some inputs (shared: src/shared/simplify.js) ----------
// The owner's idea of 1 November 2026: choose inputs and a range for each, every other input
// staying at today's number, and keep only what those inputs move — so a lesson's model, and
// the workbook made from it, holds only the calculations the lesson teaches.
//
// How it works (all on the shared calculation, ir.js; nothing here reads an app):
// - The runs (simplifyRunPlan): every step of each input on its own, the others at today's
//   numbers; every corner (each input at its minimum or its maximum, for up to 10 inputs; a
//   sample of them for more); and 200 random combinations of steps. A slider stands only on its
//   steps, so every place one slider can reach on its own is tried.
// - What moves: every item (value rectangle, operator, alias, period shift, function, block
//   instance — by its outputs) is compared in every period with today's results: a number, or
//   an error code; two numbers are the same within 1e-9 × max(1, |value|) (the agreement tests'
//   tolerance). The same error in every run counts as not moving. The inside of a block's
//   definition canvas is never judged: it stays whole when an instance of it stays.
// - The copy (simplifyBuild): what moves stays, with what it reads. Where a kept item reads one
//   that doesn't move, that one stays as a fixed number in place (a value rectangle holding its
//   numbers per period, its arrows in cut; an input stays as it is; an operator or function
//   becomes a value rectangle where it was; a block output a rectangle beside the block). A
//   period shift is never made a fixed number: it stays, and what it reads is fixed instead, so
//   the first period's "outside the timeline" rule still uses the reader's own number. An item
//   with an error in some period is never made a fixed number either: it stays with its
//   calculation. A fixed 0 in every period is dropped where that changes nothing: from a +, from
//   a − when it is not the first input. A kept × by a fixed −1 in every period that feeds the
//   second input of a two-input + or − is folded into it (+ becomes −, − becomes +), so the −1
//   goes. Canvases left empty go; the canvases that stay are unlinked from their templates.
// - The check (part of simplifyJob): the copy is worked out again at the runs and at fresh
//   random ones, and every item it keeps must give the full model's numbers; one that doesn't
//   is kept with its calculation and the copy made again.
//
// Names start `simplify` / `SIMPLIFY_`, since the apps share one scope.
import { compileModel, evaluateModel, irNodeIn, irBlockPorts, parseRectText } from './ir.js';

export const SIMPLIFY_MAX_INPUTS = 20;
export const SIMPLIFY_MAX_STEPS = 401;     // more steps than this: 101 evenly spaced, ends included
export const SIMPLIFY_THIN_STEPS = 101;
export const SIMPLIFY_MAX_CORNERS = 1024;  // 2^10
export const SIMPLIFY_RANDOM_RUNS = 200;
export const SIMPLIFY_CHECK_RUNS = 50;     // fresh random runs for the check
export const SIMPLIFY_MAX_RUNS = 3000;
const SIMPLIFY_TOL = 1e-9;

const simKey = (canvasId, nodeId) => canvasId + '\u0000' + nodeId;
const simSame = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= SIMPLIFY_TOL * Math.max(1, Math.abs(a), Math.abs(b)));
const simZero = (v) => typeof v === 'number' && Math.abs(v) <= SIMPLIFY_TOL;
const simNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function simRandom(seed){ let s = seed % 2147483647; if(s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// The inputs, checked: [{ canvasId, nodeId, min, max, step, mode: 'set' | 'shift', periods }]
// (`periods` as a slider's: { mode: 'all' } | { mode: 'one', p } | { mode: 'range', from, to },
// counted from 0). Each must be an input rectangle of the model. Returns { inputs, problems }.
export function simplifyInputs(system, list){
  const ir = compileModel(system || {});
  const inputs = [], problems = [], seen = new Set();
  (Array.isArray(list) ? list : []).slice(0, SIMPLIFY_MAX_INPUTS).forEach((raw, i) => {
    if(!raw || typeof raw !== 'object'){ problems.push('Input ' + (i + 1) + ' isn\'t an input.'); return; }
    const canvasId = String(raw.canvasId || ''), nodeId = String(raw.nodeId || '');
    const n = irNodeIn(ir, canvasId, nodeId);
    if(!n || n.type !== 'value'){ problems.push('Input ' + (i + 1) + ': no rectangle ' + nodeId + ' on canvas ' + canvasId + '.'); return; }
    const name = simName(n);
    if(!(n.isInput || n.incoming.length === 0)){ problems.push(name + ' is worked out from other rectangles, so it isn\'t an input.'); return; }
    let min = simNum(raw.min), max = simNum(raw.max), step = simNum(raw.step);
    if(min === null || max === null){ problems.push(name + ': its minimum and maximum must be numbers.'); return; }
    if(min > max){ const t = min; min = max; max = t; }
    if(step === null || step <= 0) step = max > min ? (max - min) / 100 : 1;
    const mode = raw.mode === 'shift' ? 'shift' : 'set';
    const periods = simCleanPeriods(raw.periods, ir.periodCount);
    const k = simKey(canvasId, nodeId) + '|' + JSON.stringify(periods) + '|' + mode;
    if(seen.has(k)) return;
    seen.add(k);
    inputs.push({ canvasId, nodeId, name, min, max, step, mode, periods });
  });
  if(Array.isArray(list) && list.length > SIMPLIFY_MAX_INPUTS) problems.push('At most ' + SIMPLIFY_MAX_INPUTS + ' inputs: the others were left out.');
  return { inputs, problems };
}
function simCleanPeriods(raw, count){
  const idx = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < count ? n : null; };
  if(raw && raw.mode === 'one' && idx(raw.p) !== null) return { mode: 'one', p: idx(raw.p) };
  if(raw && raw.mode === 'range' && idx(raw.from) !== null && idx(raw.to) !== null) return { mode: 'range', from: idx(raw.from), to: idx(raw.to) };
  return { mode: 'all' };
}
function simPeriodList(spec, count){
  if(!spec || spec.mode === 'all') return Array.from({ length: count }, (_, i) => i);
  if(spec.mode === 'one') return [Math.min(count - 1, Math.max(0, spec.p))];
  const a = Math.min(spec.from, spec.to), b = Math.max(spec.from, spec.to);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(p => p >= 0 && p < count);
}

// The values one input takes: its steps from min to max (thinned to 101 when there are more
// than 401), rounded as a slider rounds them.
export function simplifySteps(input){
  const { min, max, step } = input;
  if(!(max > min)) return [min];
  let n = Math.round((max - min) / step);
  const out = [];
  if(n + 1 > SIMPLIFY_MAX_STEPS){
    n = SIMPLIFY_THIN_STEPS - 1;
    for(let i = 0; i <= n; i++) out.push(i === n ? max : min + (max - min) * i / n);
  } else {
    const d = Math.max(0, Math.min(12, Math.ceil(-Math.log10(step)) + 1));
    for(let i = 0; i <= n; i++) out.push(Number(Math.min(max, min + i * step).toFixed(d)));
    if(out[out.length - 1] < max) out.push(max);
  }
  return out;
}

// The runs: a list of value lists, one value per input (null: today's number).
export function simplifyRunPlan(inputs, opts){
  opts = opts || {};
  const steps = inputs.map(simplifySteps);
  const runs = [];
  const k = inputs.length;
  // Every step of each input on its own (thinned evenly when there are too many in all).
  const total = steps.reduce((a, s) => a + s.length, 0);
  const limit = SIMPLIFY_MAX_RUNS - Math.min(SIMPLIFY_MAX_CORNERS, 1 << Math.min(k, 10)) - SIMPLIFY_RANDOM_RUNS;
  steps.forEach((list, i) => {
    let use = list;
    if(total > limit){
      const keep = Math.max(2, Math.floor(list.length * limit / total));
      use = Array.from({ length: keep }, (_, j) => list[Math.round(j * (list.length - 1) / (keep - 1))]);
    }
    use.forEach(v => { const r = new Array(k).fill(null); r[i] = v; runs.push(r); });
  });
  if(k >= 2){
    const rnd = simRandom(opts.seed || 1);
    if(k <= 10){
      for(let m = 0; m < (1 << k); m++) runs.push(inputs.map((x, i) => (m >> i) & 1 ? x.max : x.min));
    } else {
      for(let r = 0; r < SIMPLIFY_MAX_CORNERS; r++) runs.push(inputs.map(x => rnd() < 0.5 ? x.min : x.max));
    }
    for(let r = 0; r < SIMPLIFY_RANDOM_RUNS; r++) runs.push(steps.map(s => s[Math.floor(rnd() * s.length)]));
  }
  return runs;
}
function simCheckRuns(inputs, seed){
  if(inputs.length < 2) return []; // one input: every step was tried already
  const steps = inputs.map(simplifySteps), rnd = simRandom(seed);
  return Array.from({ length: SIMPLIFY_CHECK_RUNS }, () => steps.map(s => s[Math.floor(rnd() * s.length)]));
}

function simName(n){
  if(!n) return '';
  const raw = n.node || n;
  if(n.type === 'value') return String(parseRectText(raw.text).name || '').trim() || '(no name)';
  if(n.type === 'operator') return (raw.text || '?') + ' operator';
  if(n.type === 'alias') return 'alias';
  if(n.type === 'periodShift') return 'period shift';
  if(n.type === 'function') return 'ƒ ' + ((raw.fn && raw.fn.name) || 'function');
  if(n.type === 'blockInstance') return 'block';
  return n.type || 'item';
}

// The model, compiled once, with its items: every node of every canvas (the first canvas with
// an id, the first node with an id), leaving out the aliases plugs make (`auto`).
function simModel(system){
  const ir = compileModel(system);
  const items = [], byKey = new Map(), firstCanvas = new Map();
  const defs = new Set();
  ir.order.forEach((c, ci) => {
    if(!firstCanvas.has(c.id)) firstCanvas.set(c.id, ci);
    c.list.forEach(n => { if(n.type === 'blockInstance' && n.blockDefCanvasId) defs.add(n.blockDefCanvasId); });
  });
  ir.order.forEach((c, ci) => {
    if(firstCanvas.get(c.id) !== ci) return;
    const seen = new Set();
    c.list.forEach(n => {
      if(seen.has(n.id)) return;
      seen.add(n.id);
      if(n.type === 'alias' && n.node && n.node.auto) return;
      const it = { key: simKey(c.id, n.id), canvasId: c.id, canvasName: String(c.name || ''), nodeId: n.id, ci, n, inDef: defs.has(c.id) };
      items.push(it);
      byKey.set(it.key, it);
    });
  });
  return { ir, items, byKey, defs, periodCount: ir.periodCount, system };
}

// One run: the inputs' numbers laid over the compiled model (as fmGraph's sliders do), worked
// out, and put back. `vals` has one value per input (null: today's); `base` today's results.
function simRun(m, inputs, vals, base, extra){
  const over = new Map();
  const todays = (it) => Array.from({ length: m.periodCount }, (_, p) => { const t = simToken(base, it, p); return typeof t === 'number' ? t : 0; });
  inputs.forEach((x, i) => {
    const v = vals ? vals[i] : null;
    if(v === null || v === undefined) return;
    const it = m.byKey.get(simKey(x.canvasId, x.nodeId));
    if(!it) return;
    const key = it.key;
    const values = over.get(key) || todays(it);
    simPeriodList(x.periods, m.periodCount).forEach(p => { values[p] = x.mode === 'shift' ? values[p] * (1 + v / 100) : v; });
    over.set(key, values);
  });
  // A scenario's settings, as a slider's: { canvasId, nodeId, value, mode, periods }, or a number
  // per period (`values`).
  (extra || []).forEach(e => {
    const it = e && m.byKey.get(simKey(e.canvasId, e.nodeId));
    if(!it || it.n.type !== 'value') return;
    if(Array.isArray(e.values)){ over.set(it.key, e.values.slice(0, m.periodCount).map(v => simNum(v) === null ? 0 : simNum(v))); return; }
    const v = simNum(e.value);
    if(v === null) return;
    const values = over.get(it.key) || todays(it);
    simPeriodList(simCleanPeriods(e.periods, m.periodCount), m.periodCount).forEach(p => { values[p] = e.mode === 'shift' ? values[p] * (1 + v / 100) : v; });
    over.set(it.key, values);
  });
  const saved = [];
  try{
    over.forEach((values, key) => {
      const it = m.byKey.get(key);
      const n = it && irNodeIn(m.ir, it.canvasId, it.nodeId);
      if(!n || n.type !== 'value') return;
      saved.push([n, n.literal]);
      n.literal = { text: n.literal ? n.literal.text : '', periodValues: values.slice() };
    });
    return evaluateModel(m.ir);
  } finally {
    saved.forEach(([n, lit]) => { n.literal = lit; });
  }
}

// An item's result in one period: its number, 'E:<code>' for an error, or for a block instance
// its outputs as one string.
function simToken(results, it, p){
  const r = results[it.ci];
  if(!r) return 'E:missing';
  if(it.n.type === 'blockInstance'){
    const vs = (r.portValues[p] && r.portValues[p][it.nodeId]) || [], es = (r.portErrors[p] && r.portErrors[p][it.nodeId]) || [];
    return vs.map((v, i) => es[i] ? 'E:' + es[i] : v);
  }
  const e = r.errors[p] && r.errors[p][it.nodeId];
  if(e) return 'E:' + e;
  const v = r.values[p] && r.values[p][it.nodeId];
  return typeof v === 'number' ? v : 'E:none';
}
function simTokensSame(a, b){
  if(Array.isArray(a) || Array.isArray(b)){
    if(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => simSame(x, b[i]));
  }
  return simSame(a, b);
}

// Works it all out, in pieces: simplifyJob(system, inputs, opts) returns { step(ms), done,
// progress, label, result }. step works for about `ms` milliseconds (Infinity: to the end) and
// returns true when done; `result` is then simplifyBuild's answer with the runs and the check.
// opts: keep — [{ canvasId, nodeId }] or { canvasId } (a whole canvas), kept anyway; extraRuns
// — [[{ canvasId, nodeId, values }]], more runs, each its inputs' numbers per period (a
// scenario: its settings as a slider's, { canvasId, nodeId, value, mode, periods }, or
// { canvasId, nodeId, values } a number per period); shown — [{ canvasId, nodeId }], rectangles
// shown elsewhere (a board's bars and charts): one that doesn't move stays as a fixed number,
// unless it is 0 in every period.
export function simplifyJob(system, inputs, opts){
  opts = opts || {};
  const job = { done: false, progress: 0, label: 'Working out…', result: null };
  const gen = simJobSteps(system, inputs, opts, job);
  job.step = (ms) => {
    const until = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (ms === undefined ? Infinity : ms);
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    while(!job.done){
      const r = gen.next();
      if(r.done){ job.done = true; job.progress = 1; break; }
      if(now() >= until) break;
    }
    return job.done;
  };
  return job;
}
// All at once (Node, tests, the batch tool).
export function simplifyModel(system, inputs, opts){
  const job = simplifyJob(system, inputs, opts);
  job.step(Infinity);
  return job.result;
}

function* simJobSteps(system, inputs, opts, job){
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t0 = clock();
  const m = simModel(system);
  const base = evaluateModel(m.ir);
  const runs = simplifyRunPlan(inputs, opts).map(vals => ({ vals }))
    .concat((Array.isArray(opts.extraRuns) ? opts.extraRuns : []).map(extra => ({ extra })));
  const checks = simCheckRuns(inputs, 97);
  const total = runs.length * 2 + checks.length * 2;
  let done = 0;
  const counted = () => { done++; job.progress = Math.min(0.99, done / total); };
  const moved = new Set();
  const P = m.periodCount;
  const runOn = (model, run, b) => run.extra ? simRun(model, [], null, b, run.extra) : simRun(model, inputs, run.vals, b);
  // Every item's results in one run, noting what moved.
  const rowOf = (results) => m.items.map(it => {
    const toks = Array.from({ length: P }, (_, p) => simToken(results, it, p));
    if(!moved.has(it.key) && toks.some((t, p) => !simTokensSame(t, simToken(base, it, p)))) moved.add(it.key);
    return toks;
  });
  job.label = 'Trying the inputs…';
  const record = [];
  for(const run of runs){ record.push(rowOf(runOn(m, run, base))); counted(); yield; }
  // The check: the copy at every run; the full model and the copy at fresh random runs. What
  // doesn't agree is kept with its calculation, and the copy made again (at most 3 times).
  job.label = 'Checking the copy…';
  const keepMore = new Set(), foundLate = new Set(), checkRows = [];
  let built, mismatches = [];
  for(let round = 0; round < 4; round++){
    built = simplifyBuild(m, base, moved, inputs, Object.assign({}, opts, { keepMore, runs: runs.length }));
    const cm = simModel(built.system);
    const cbase = evaluateModel(cm.ir);
    const bad = new Set();
    const compare = (fullRow, results) => m.items.forEach((it, i) => {
      if(built.notCompared.has(it.key)) return;
      const ct = cm.byKey.get(it.key);
      if(!ct || ct.n.type !== it.n.type) return;
      for(let p = 0; p < P; p++){ if(!simTokensSame(fullRow[i][p], simToken(results, ct, p))){ bad.add(it.key); return; } }
    });
    for(let r = 0; r < runs.length; r++){ compare(record[r], runOn(cm, runs[r], cbase)); if(!round) counted(); yield; }
    const before = new Set(moved);
    for(let r = 0; r < checks.length; r++){
      if(!checkRows[r]){ checkRows[r] = rowOf(simRun(m, inputs, checks[r], base)); if(!round) counted(); }
      compare(checkRows[r], simRun(cm, inputs, checks[r], cbase));
      if(!round) counted();
      yield;
    }
    moved.forEach(k => { if(!before.has(k)) foundLate.add(k); });
    if(!bad.size && moved.size === before.size){ mismatches = []; break; }
    mismatches = [...bad];
    if(round === 3) break;
    bad.forEach(k => keepMore.add(k));
  }
  job.result = Object.assign(built.result, {
    runs: runs.length + checks.length, ms: Math.round(clock() - t0),
    checked: { runs: runs.length + checks.length, ok: !mismatches.length, mismatches: mismatches.map(k => simDescribe(m, k)),
      foundByCheck: [...foundLate].map(k => simDescribe(m, k)) },
    system: built.system,
  });
  // The copy made again with other Keep anyway choices, from the same runs (not checked again:
  // `checked.ok` is null until the whole job runs with them).
  const rebuild = (keep) => {
    const b = simplifyBuild(m, base, moved, inputs, Object.assign({}, opts, { keep, keepMore, runs: runs.length }));
    return Object.assign(b.result, { runs: runs.length + checks.length, ms: 0, system: b.system, rebuild,
      checked: { runs: 0, ok: null, mismatches: [], foundByCheck: [] } });
  };
  job.result.rebuild = rebuild;
  job.label = 'Done';
}
function simDescribe(m, key){
  const it = m.byKey.get(key);
  return it ? { canvasId: it.canvasId, canvas: it.canvasName, nodeId: it.nodeId, name: simName(it.n), type: it.n.type } : { key };
}

// The copy, from what moves. Returns { system, result, notCompared }; `result` lists what was
// kept, removed, fixed and folded, each with its reason in words.
export function simplifyBuild(m, base, moved, inputs, opts){
  opts = opts || {};
  const P = m.periodCount, ir = m.ir;
  const runs = opts.runs || 0;
  const keepCanvases = new Set(), keepKeys = new Set();
  (Array.isArray(opts.keep) ? opts.keep : []).forEach(k => {
    if(!k || typeof k !== 'object') return;
    if(k.nodeId !== undefined && k.nodeId !== null) keepKeys.add(simKey(String(k.canvasId), String(k.nodeId)));
    else if(k.canvasId !== undefined) keepCanvases.add(String(k.canvasId));
  });
  if(opts.keepMore) opts.keepMore.forEach(k => keepKeys.add(k));
  const itemOf = (canvasId, nodeId) => m.byKey.get(simKey(canvasId, nodeId));
  const baseValues = (it) => Array.from({ length: P }, (_, p) => simToken(base, it, p));
  const hasError = (toks) => toks.some(t => Array.isArray(t) ? t.some(x => typeof x === 'string') : typeof t === 'string');

  // What stays with its calculation.
  const kept = new Map(); // key → why: 'moved', 'keep', 'block', 'shift', 'error', 'input'
  const todo = [];
  const keep = (it, why) => { if(!it || kept.has(it.key)) return; kept.set(it.key, why); todo.push(it); };
  const defsKept = new Set();
  const keepDef = (defId) => {
    if(defsKept.has(defId)) return;
    defsKept.add(defId);
    m.items.filter(it => it.canvasId === defId).forEach(it => keep(it, 'block'));
  };
  m.items.forEach(it => {
    if(it.inDef) return; // a block's inside: kept whole with an instance
    if(keepKeys.has(it.key) || keepCanvases.has(it.canvasId)) keep(it, 'keep');
    else if(moved.has(it.key)) keep(it, 'moved');
  });
  m.items.forEach(it => { if(it.inDef && (keepKeys.has(it.key) || keepCanvases.has(it.canvasId))) keepDef(it.canvasId); });

  // What a kept item reads: [{ edge, src, canvasId }] — src the item read (an alias plugs made
  // is read through: its plugged rectangle), edge the arrow (null for an alias's source).
  const readsOf = (it) => {
    const n = it.n, c = ir.canvases.get(it.canvasId);
    const out = [];
    if(n.type === 'alias'){
      const s = itemOf(n.sourceCanvasId, n.sourceNodeId);
      if(s) out.push({ edge: null, src: s });
      return out;
    }
    if(n.type === 'value' && (n.isInput || n.incoming.length === 0)) return out; // an input reads nothing
    (n.incoming || []).forEach(e => {
      const sn = c.byId.get(e.from);
      if(!sn) return;
      if(sn.type === 'alias' && sn.node && sn.node.auto){
        const s = itemOf(sn.sourceCanvasId, sn.sourceNodeId);
        if(s) out.push({ edge: e, src: s, plug: true });
        return;
      }
      const s = itemOf(it.canvasId, e.from);
      if(s) out.push({ edge: e, src: s });
    });
    return out;
  };

  // Settle what stays: a source that can't be a fixed number (a period shift, one with an error,
  // an alias's chain to one) stays with its calculation, and so on back.
  const requests = new Map(); // final source key → [{ reader, edge, chain, plug }]
  // Rectangles shown on a board: kept as fixed numbers (as if read by something kept that can't
  // do without them), unless 0 in every period; one with an error stays with its calculation.
  (Array.isArray(opts.shown) ? opts.shown : []).forEach(x => {
    const it = x && itemOf(String(x.canvasId), String(x.nodeId));
    if(!it || it.inDef || kept.has(it.key) || it.n.type !== 'value') return;
    const values = baseValues(it);
    if(hasError(values)){ keep(it, 'error'); return; }
    if(values.every(simZero)) return;
    if(!requests.has(it.key)) requests.set(it.key, []);
    requests.get(it.key).push({ reader: null, edge: null, chain: [], plug: false, fromPort: 0, shown: true });
  });
  {
    while(todo.length){
      const it = todo.pop();
      if(it.n.type === 'blockInstance' && it.n.blockDefCanvasId) keepDef(it.n.blockDefCanvasId);
      readsOf(it).forEach(r => {
        // Kept anyway: its own calculation stays, back to the rectangles it reads.
        if(kept.get(it.key) === 'keep' && ['operator', 'function', 'periodShift', 'blockInstance'].includes(r.src.n.type)){ keep(r.src, 'keep'); return; }
        let s = r.src;
        const chain = [];
        const seen = new Set();
        while(s && !kept.has(s.key) && s.n.type === 'alias' && !seen.has(s.key)){
          seen.add(s.key);
          chain.push(s);
          s = itemOf(s.n.sourceCanvasId, s.n.sourceNodeId);
        }
        if(!s){ chain.forEach(a => keep(a, 'error')); return; }
        if(kept.has(s.key)){ chain.forEach(a => keep(a, 'route')); return; }
        if(s.n.type === 'periodShift'){ keep(s, 'shift'); chain.forEach(a => keep(a, 'route')); return; }
        if(s.n.type === 'alias' || hasError(baseValues(s))){ keep(s, 'error'); chain.forEach(a => keep(a, 'route')); return; }
        if(!requests.has(s.key)) requests.set(s.key, []);
        requests.get(s.key).push({ reader: it, edge: r.edge, chain, plug: !!r.plug, fromPort: r.edge ? (r.edge.fromPort || 0) : 0 });
      });
    }
  }
  // A source asked for as a fixed number that stays with its calculation after all is read as it is.
  [...requests.keys()].forEach(k => { if(kept.has(k)) requests.delete(k); });

  // How each fixed source is read: dropped (0, and every reader can do without it), or fixed.
  const readerInputIndex = (req) => {
    const n = req.reader.n;
    if(!req.edge || !Array.isArray(n.inputs)) return -1;
    return n.inputs.indexOf(req.edge);
  };
  const canDrop = (req) => {
    if(!req.reader) return false; // shown on a board
    const n = req.reader.n;
    if(n.type !== 'operator' || !n.op || n.op.ports || !req.edge) return false;
    if(n.op.id === 'add') return true;
    if(n.op.id === 'subtract') return readerInputIndex(req) > 0;
    return false;
  };
  const dropped = new Map(), fixed = new Map(); // key → { values, reqs }
  const routes = new Set();
  requests.forEach((reqs, key) => {
    const it = m.byKey.get(key);
    if(it.n.type === 'blockInstance'){
      // Per output read: dropped or fixed.
      const byPort = new Map();
      reqs.forEach(r => { if(!byPort.has(r.fromPort)) byPort.set(r.fromPort, []); byPort.get(r.fromPort).push(r); });
      const ports = [];
      byPort.forEach((list, port) => {
        const values = baseValues(it).map(t => Array.isArray(t) ? t[port] : 0);
        if(values.every(simZero) && list.every(canDrop)) dropped.set(key + '#' + port, { it, values, reqs: list });
        else { ports.push({ port, values, reqs: list }); list.forEach(r => r.chain.forEach(a => routes.add(a.key))); }
      });
      if(ports.length) fixed.set(key, { it, ports, reqs });
      return;
    }
    const values = baseValues(it);
    if(values.every(simZero) && reqs.every(canDrop)) dropped.set(key, { it, values, reqs });
    else { fixed.set(key, { it, values, reqs }); reqs.forEach(r => r.chain.forEach(a => routes.add(a.key))); }
  });

  // × a fixed −1, feeding the second input of a two-input + or −: folded into it.
  const folds = [];
  kept.forEach((why, key) => {
    const it = m.byKey.get(key), n = it.n;
    if(it.inDef || n.type !== 'operator' || !n.op || n.op.id !== 'multiply' || !Array.isArray(n.inputs) || n.inputs.length !== 2) return;
    const c = ir.canvases.get(it.canvasId);
    const minusOne = [], other = [];
    n.inputs.forEach(e => {
      const sn = c.byId.get(e.from);
      const req = sn && fixedRequestFor(it, e);
      if(req && req.values.every(v => simSame(v, -1)) && sn.type !== 'blockInstance') minusOne.push({ e, f: req });
      else other.push(e);
    });
    if(minusOne.length !== 1 || other.length !== 1) return;
    const x = c.byId.get(other[0].from);
    if(!x || x.type === 'blockInstance' || (x.type === 'alias' && x.node && x.node.auto)) return;
    if(n.outgoing.length !== 1) return;
    const out = n.outgoing[0];
    const r = c.byId.get(out.to);
    const rIt = r && itemOf(it.canvasId, r.id);
    if(!rIt || !kept.has(rIt.key) || r.type !== 'operator' || !r.op || r.op.ports || (r.socket && r.socket.trim())) return;
    if(r.op.id !== 'add' && r.op.id !== 'subtract') return;
    if(!Array.isArray(r.inputs) || r.inputs.length !== 2 || r.inputs[1] !== out) return;
    // Plugs aliasing the ×'s result elsewhere would lose its value: only an × nothing else reads.
    if(m.items.some(o => o.n.type === 'alias' && o.n.sourceCanvasId === it.canvasId && o.n.sourceNodeId === it.nodeId)) return;
    const first = c.byId.get(r.inputs[0].from);
    const direct = first && (first.x - x.x || first.y - x.y) < 0; // x comes after the first input
    folds.push({ it, reader: rIt, out, xEdge: other[0], x, minus: minusOne[0], direct });
  });
  function fixedRequestFor(reader, edge){
    for(const [, f] of fixed){
      if(f.ports) continue;
      if(f.reqs.some(q => q.reader === reader && q.edge === edge)) return f;
    }
    return null;
  }
  // The −1's request from a folded × goes; a fixed source nobody reads any more goes too.
  folds.forEach(fd => {
    const f = fd.minus.f;
    f.reqs = f.reqs.filter(q => !(q.reader === fd.it && q.edge === fd.minus.e));
  });
  const foldedAway = new Set();
  [...fixed.keys()].forEach(k => {
    const f = fixed.get(k);
    if(!f.ports && !f.reqs.length){ fixed.delete(k); foldedAway.add(k); }
  });
  routes.clear();
  fixed.forEach(f => (f.ports ? f.ports.flatMap(p => p.reqs) : f.reqs).forEach(r => r.chain.forEach(a => routes.add(a.key))));

  // ---- write the copy ----
  const inCopy = new Set([...kept.keys(), ...fixed.keys(), ...routes]);
  const removedCanvases = [], unlinked = [];
  const dropEdgeIds = new Map(); // canvasId → Set of edge ids dropped (zeros)
  const dropEdge = (canvasId, id) => { if(!dropEdgeIds.has(canvasId)) dropEdgeIds.set(canvasId, new Set()); dropEdgeIds.get(canvasId).add(id); };
  dropped.forEach(d => d.reqs.forEach(r => { if(r.edge && !r.plug) dropEdge(r.reader.canvasId, r.edge.id); }));
  const foldByNode = new Map(folds.map(fd => [fd.it.key, fd]));
  const foldReaders = new Map(folds.map(fd => [fd.reader.key, fd]));
  const sys = m.system;
  const outCanvases = [], seenCanvas = new Set();
  (sys && Array.isArray(sys.canvases) ? sys.canvases : []).forEach(sc => {
    if(!sc || typeof sc !== 'object') return;
    // A canvas repeating an id: the calculation reads only the first.
    if(seenCanvas.has(sc.id)){ removedCanvases.push({ canvasId: sc.id, canvas: String(sc.name || ''), why: 'repeated' }); return; }
    seenCanvas.add(sc.id);
    const nodes = [], kept2 = new Set(), portIds = new Map();
    const added = [];
    (Array.isArray(sc.nodes) ? sc.nodes : []).forEach(sn => {
      if(!sn || typeof sn !== 'object' || kept2.has(sn.id)) return;
      if(sn.type === 'alias' && sn.auto) return; // plug aliases: drawn again from the plugs
      const key = simKey(sc.id, sn.id);
      if(!inCopy.has(key)) return;
      kept2.add(sn.id);
      const it = m.byKey.get(key);
      const fd = foldByNode.get(key);
      if(fd){
        if(fd.direct) return; // the × goes: its other input feeds the + or − straight
        nodes.push({ id: sn.id, type: 'alias', x: sn.x, y: sn.y, w: 170, h: 64, sourceCanvasId: sc.id, sourceNodeId: fd.x.id, plugs: [] });
        return;
      }
      const fr = foldReaders.get(key);
      if(fr){ nodes.push(Object.assign(cloneJson(sn), { text: sn.text === '−' ? '+' : '−' })); return; }
      const f = fixed.get(key);
      if(!f){ nodes.push(cloneJson(sn)); return; }
      if(f.ports){
        // A block instance's outputs read as fixed numbers: a rectangle beside it for each.
        const def = ir.canvases.get(it.n.blockDefCanvasId);
        const outs = irBlockPorts(ir, it.n.blockDefCanvasId).outputs;
        f.ports.forEach((pt, i) => {
          const outName = outs[pt.port] ? simName(outs[pt.port]) : 'output ' + (pt.port + 1);
          const pid = simFreshId(sc, sn.id + '~out' + pt.port);
          portIds.set(sn.id + '#' + pt.port, pid);
          added.push(fixedNode({ id: pid, x: sn.x, y: (Number(sn.y) || 0) + i * 80 },
            (def ? String(def.name || 'Block') : 'Block') + ' – ' + outName, null, pt.values));
        });
        return;
      }
      if(it.n.type === 'value' && (it.n.isInput || it.n.incoming.length === 0)){ nodes.push(cloneJson(sn)); return; } // an input stays as it is
      if(it.n.type === 'value'){
        const p = parseRectText(sn.text);
        const out = cloneJson(sn);
        delete out.literalPeriods;
        delete out.periodValues;
        nodes.push(Object.assign(out, fixedNode(out, String(p.name || ''), p.uom, f.values)));
        return;
      }
      // An operator or a function read as a fixed number: a value rectangle where it was.
      const reader = f.reqs[0] && f.reqs[0].reader;
      const rname = reader && reader.n.type === 'value' ? simName(reader.n) + ' (fixed part)' : 'Fixed number';
      nodes.push(fixedNode({ id: sn.id, x: sn.x, y: sn.y }, rname, null, f.values));
    });
    added.forEach(a => nodes.push(a));
    if(!nodes.length){ removedCanvases.push({ canvasId: sc.id, canvas: String(sc.name || ''), why: 'empty' }); return; }
    const ids = new Set(nodes.map(n => n.id));
    const cut = new Set(); // fixed rectangles: their arrows in are cut
    nodes.forEach(n => { const f = fixed.get(simKey(sc.id, n.id)); if(f && !f.ports) cut.add(n.id); });
    const drops = dropEdgeIds.get(sc.id) || new Set();
    const edges = [];
    (Array.isArray(sc.edges) ? sc.edges : []).forEach(se => {
      if(!se || typeof se !== 'object' || se.auto || drops.has(se.id)) return;
      const fromKey = simKey(sc.id, se.from);
      const fd = foldByNode.get(fromKey);
      if(foldByNode.has(simKey(sc.id, se.to))) return; // into a folded ×: gone (its alias reads x)
      if(fd && fd.direct){ edges.push(Object.assign(cloneJson(se), { from: fd.x.id })); return; }
      const f = fixed.get(fromKey);
      if(f && f.ports){
        const at = f.ports.findIndex(pt => pt.port === (se.fromPort || 0));
        if(at < 0 || !ids.has(se.to)) return;
        const e = cloneJson(se); delete e.fromPort;
        e.from = portIds.get(se.from + '#' + (se.fromPort || 0));
        edges.push(e);
        return;
      }
      if(!ids.has(se.from) || !ids.has(se.to) || cut.has(se.to)) return;
      edges.push(cloneJson(se));
    });
    const out = Object.assign({}, cloneJson(sc), { nodes, edges });
    if(out.template){ delete out.template; unlinked.push({ canvasId: sc.id, canvas: String(sc.name || '') }); }
    outCanvases.push(out);
  });
  const system = Object.assign({}, cloneJson(sys), { canvases: outCanvases });
  if(!outCanvases.length) system.canvases = [];

  // ---- the report ----
  const removed = [];
  const copyKeys = new Set();
  outCanvases.forEach(c => c.nodes.forEach(n => copyKeys.add(simKey(c.id, n.id))));
  const droppedKeys = new Map();
  dropped.forEach((d, k) => droppedKeys.set(d.it.key, d));
  m.items.forEach(it => {
    if(copyKeys.has(it.key) && !foldByNode.has(it.key)) return;
    if(foldByNode.has(it.key) && !foldByNode.get(it.key).direct) return;
    const entry = { canvasId: it.canvasId, canvas: it.canvasName, nodeId: it.nodeId, name: simName(it.n), type: it.n.type };
    const d = droppedKeys.get(it.key);
    if(d){
      const r = d.reqs[0].reader;
      entry.why = 'zero';
      entry.text = '0 in every period — dropped from ' + (r.n.node && r.n.node.text || '+') + ' on ' + r.canvasName;
    } else if(foldByNode.has(it.key)){
      entry.why = 'folded';
      entry.text = '× −1 folded into the ' + (foldByNode.get(it.key).reader.n.node.text) + ' it feeds';
    } else if(foldedAway.has(it.key)){
      entry.why = 'folded';
      entry.text = 'only read by × operators now folded into a minus';
    } else if(it.inDef){
      entry.why = 'block';
      entry.text = 'inside a block nothing kept uses';
    } else {
      entry.why = 'never-moved';
      entry.text = 'never moved across ' + runs + ' runs';
    }
    removed.push(entry);
  });
  const fixedList = [];
  fixed.forEach(f => {
    const it = f.it;
    const reqs = f.ports ? f.ports.flatMap(p => p.reqs) : f.reqs;
    const r = reqs[0] && reqs[0].reader;
    const input = it.n.type === 'value' && (it.n.isInput || it.n.incoming.length === 0);
    fixedList.push({ canvasId: it.canvasId, canvas: it.canvasName, nodeId: it.nodeId, name: simName(it.n), type: it.n.type,
      values: f.ports ? f.ports.map(p => p.values) : f.values, input,
      text: (input ? 'an input, kept as it is' : 'kept as a fixed number') + (r ? ', read by ' + simName(r.n) + ' on ' + r.canvasName : reqs.some(q => q.shown) ? ', shown on a board' : '') });
  });
  const foldList = folds.map(fd => ({ canvasId: fd.it.canvasId, canvas: fd.it.canvasName, nodeId: fd.it.nodeId,
    reader: fd.reader.nodeId, from: fd.reader.n.node.text, to: fd.reader.n.node.text === '−' ? '+' : '−' }));
  const notCompared = new Set(folds.map(fd => fd.it.key)); // a folded × now reads its other input
  const keptCount = m.items.filter(it => copyKeys.has(it.key)).length;
  return {
    system, notCompared,
    result: {
      total: m.items.length, kept: keptCount,
      canvases: { total: (sys && sys.canvases || []).length, kept: outCanvases.length },
      inputs: inputs.map(x => ({ canvasId: x.canvasId, nodeId: x.nodeId, name: x.name, min: x.min, max: x.max, step: x.step, mode: x.mode, periods: x.periods })),
      removed, fixed: fixedList, folded: foldList, removedCanvases, unlinked,
      zeros: removed.filter(r => r.why === 'zero').length,
    },
  };
}
function fixedNode(at, name, unit, values){
  const n = { id: at.id, type: 'value', x: at.x, y: at.y };
  const v0 = typeof values[0] === 'number' ? values[0] : 0;
  const all = values.every(v => simSame(v, v0));
  n.text = name + '\n' + String(v0) + (unit ? '\n' + unit : '');
  if(!all) n.periodValues = values.map(v => typeof v === 'number' ? v : 0);
  return n;
}
function simFreshId(sc, base){
  const used = new Set((sc.nodes || []).map(n => n && n.id));
  let id = base, k = 2;
  while(used.has(id)) id = base + '~' + (k++);
  return id;
}
function cloneJson(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
