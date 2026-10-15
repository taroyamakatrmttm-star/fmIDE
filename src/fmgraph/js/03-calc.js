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

// ---- shared slider positions (the owner's request, 15 October 2026) ----
// Every board shares where its sliders stand with the other sharing boards, unless it keeps
// its own (`ownSliders`, board file 7; the tick box under the Sliders heading). Which sliders a
// board shows stays its own. Sliders are the same when their rectangle, periods and kind are
// (settingKey). A slider moved on one sharing board moves its like on the others, and counts
// on every sharing board, with a slider there or not. sharedValues holds the positions;
// syncShared, before each drawing, takes in what moved since (any of the sharing boards'
// sliders whose value is not what it was given) and gives every sharing slider its position. A
// slider new to sharing (added, changed, or its board just switched to sharing) takes the
// shared position rather than giving its own.
let sharedValues = new Map(); // settingKey → value
function resetSharedValues(){ sharedValues = new Map(); }
function sharingBoards(){ return boards.filter(b => !b.ownSliders); }
function syncShared(){
  if(!model) return;
  const list = sharingBoards().flatMap(b => b.sliders);
  list.forEach(s => {
    const k = settingKey(s);
    if(s._sharedKey !== k) return; // new to sharing: takes the shared position below
    if(s.value === s._sharedValue) return;
    if(s.value === null || !isFinite(s.value)) sharedValues.delete(k); else sharedValues.set(k, s.value);
  });
  const present = new Set(list.map(settingKey));
  [...sharedValues.keys()].forEach(k => { if(!present.has(k)) sharedValues.delete(k); }); // no slider left: it no longer counts
  list.forEach(s => {
    const k = settingKey(s);
    s.value = sharedValues.has(k) ? sharedValues.get(k) : null;
    s._sharedKey = k;
    s._sharedValue = s.value;
  });
}
// The sliders whose positions count on board b: its own when it keeps them; else every sharing
// board's, in tab order, a setting given by an earlier board left out of the later ones.
function liveSliders(b){
  b = b || board;
  if(!b) return [];
  if(b.ownSliders) return b.sliders;
  syncShared();
  const out = [], seen = new Set();
  sharingBoards().forEach(x => {
    const mine = [];
    x.sliders.forEach(s => { const k = settingKey(s); if(!seen.has(k)){ out.push(s); mine.push(k); } });
    mine.forEach(k => seen.add(k));
  });
  return out;
}
// The moved sliders counting on this board that are on other boards (for the note under the
// Sliders heading), one per setting.
function slidersFromOtherBoards(){
  if(!board || board.ownSliders) return [];
  const here = new Set(board.sliders.map(settingKey));
  return liveSliders().filter(s => !here.has(settingKey(s)) && s.value !== null && isFinite(s.value));
}
// Keep this board's own positions (on), or share them (off: it takes the shared positions).
function setOwnSliders(b, on){
  on = !!on;
  if(!!b.ownSliders === on) return false;
  syncShared(); // what moved so far is shared before the board leaves or joins
  b.ownSliders = on;
  b.sliders.forEach(s => { delete s._sharedKey; delete s._sharedValue; });
  saveBoardSoon();
  renderAll();
  return true;
}

// While a finger holds A (05h-phone-show.js), the numbers looked at instead of the sliders'.
let lookingAt = null;
function currentResults(){ return resultsWith(lookingAt ? lookingAt.overrides : overridesFor(liveSliders())); }

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
  const others = liveSliders(), sk = settingKey(s);
  const todo = steps.slice();
  setCalcNote('Working out this slider\'s steps…');
  const piece = () => {
    if(job !== aheadJob || !model) return;
    const until = performance.now() + 30;
    while(todo.length && performance.now() < until){
      const v = todo.shift();
      resultsWith(overridesFor(others.map(o => settingKey(o) === sk ? Object.assign({}, o, { value: v }) : o)));
    }
    if(todo.length) setTimeout(piece, 0);
    else setCalcNote('');
  };
  setTimeout(piece, 0);
}

function setCalcNote(text){ const el = $('calcNote'); if(el) el.textContent = text; }
