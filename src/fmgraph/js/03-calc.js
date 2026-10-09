// ============================================================
// Calculating with the sliders. A slider changes an input rectangle's number in the periods it
// covers, exactly as typing a different number in fmIDE would (a number per period); the
// whole model is then worked out again with the shared calculation. The model itself is never
// changed: the numbers are laid over the compiled calculation for one run and put back.
//
// Results are kept per set of slider values (resultCache), so going back to a position is
// instant. On a model too slow to work out on every move (SLOW_MS), grabbing a slider works out
// each of its steps ahead, in small pieces so the page stays responsive ("Working…"), with
// the other sliders where they are; dragging then only reads them. The slider snaps to its
// steps, so every value shown is exact. Every combination of several sliders can't be worked
// out ahead (two sliders of 41 steps: 1,681 runs), so only the slider being moved is.
// ============================================================
const SLOW_MS = 25;            // slower than this per run: work a slider's steps out ahead
const CACHE_MAX = 600;         // results kept
const AHEAD_MAX_STEPS = 401;   // a slider with more steps is worked out as it moves
let resultCache = new Map();
let aheadJob = 0;              // the current "work out ahead" job; a new one stops the old

function clearResultCache(){ resultCache = new Map(); aheadJob++; }

// The numbers the sliders lay over the model: key → a number per period. Sliders apply in
// order; a later one over the same input and period wins (a change by % applies to what the
// earlier ones left).
function overridesFor(sliders){
  const out = new Map();
  sliders.forEach(s => {
    if(s.value === null || !isFinite(s.value)) return;
    const rect = model.byKey.get(s.key);
    if(!rect || !rect.input) return;
    let values = out.get(s.key);
    if(!values){ values = model.periods.map((_, p) => baseValue(rect, p)); out.set(s.key, values); }
    periodsOf(s.periods).forEach(p => {
      values[p] = s.mode === 'shift' ? values[p] * (1 + s.value / 100) : s.value;
    });
  });
  return out;
}

function overridesKey(overrides){
  return [...overrides.keys()].sort().map(k => k + '=' + overrides.get(k).join(',')).join('|');
}

// Works the model out with these numbers laid over it (remembered).
function resultsWith(overrides){
  if(!overrides.size) return model.base;
  const key = overridesKey(overrides);
  const hit = resultCache.get(key);
  if(hit){ resultCache.delete(key); resultCache.set(key, hit); return hit; }
  const ir = model.ir, saved = [];
  try{
    overrides.forEach((values, k) => {
      const rect = model.byKey.get(k);
      const n = irNodeIn(ir, rect.canvasId, rect.nodeId);
      if(!n) return;
      saved.push([n, n.literal]);
      n.literal = { text: n.literal ? n.literal.text : '', periodValues: values.slice() };
    });
    const results = evaluateModel(ir);
    resultCache.set(key, results);
    if(resultCache.size > CACHE_MAX) resultCache.delete(resultCache.keys().next().value);
    return results;
  } finally {
    saved.forEach(([n, lit]) => { n.literal = lit; });
  }
}

// While a finger holds A (05h-phone-show.js), the numbers looked at instead of the sliders'.
let lookingAt = null;
function currentResults(){ return resultsWith(lookingAt ? lookingAt.overrides : overridesFor(board.sliders)); }

// The positions a slider snaps to.
function sliderSteps(s){
  const n = Math.round((s.max - s.min) / s.step);
  if(!(n >= 1) || n + 1 > AHEAD_MAX_STEPS) return null;
  const out = [];
  for(let i = 0; i <= n; i++) out.push(roundToStep(s.min + i * s.step, s.step));
  return out;
}
function roundToStep(v, step){
  const d = Math.max(0, Math.min(12, Math.ceil(-Math.log10(step)) + 1));
  return Number(v.toFixed(d));
}

// On a slow model: work out each of slider s's steps, the others where they are.
function workOutAhead(s){
  if(!model || model.baseMs < SLOW_MS) return;
  const steps = sliderSteps(s);
  if(!steps) return;
  const job = ++aheadJob;
  const others = board.sliders;
  const todo = steps.slice();
  setCalcNote('Working out this slider\'s steps…');
  const piece = () => {
    if(job !== aheadJob || !model) return;
    const until = performance.now() + 30;
    while(todo.length && performance.now() < until){
      const v = todo.shift();
      resultsWith(overridesFor(others.map(o => o === s ? Object.assign({}, o, { value: v }) : o)));
    }
    if(todo.length) setTimeout(piece, 0);
    else setCalcNote('');
  };
  setTimeout(piece, 0);
}

function setCalcNote(text){ const el = $('calcNote'); if(el) el.textContent = text; }
