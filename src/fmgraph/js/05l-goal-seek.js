// ============================================================
// Goal seek (19 October 2026; docs/step15-fmgraph.md, later ideas): "what value of this
// slider makes that rectangle reach a number?". The Goal seek panel under the sliders,
// #goalSeekPanel: Set [rectangle] in [period] to [number] by changing [slider] → Seek.
// - The slider's own number is varied — the number set, or the % change for a slider that
//   changes by % — with the other sliders where they stand, through the same overrides as the
//   sliders (overridesFor, resultsWith in 03-calc.js); nothing on the board moves until the
//   answer is found.
// - The search: first within the slider's range — GOAL_SEEK_SCAN pieces, looking for where the
//   rectangle passes the number (the crossing nearest the slider's position when there are
//   several) — then outward, the span four times wider each time, up to ±GOAL_SEEK_LIMIT; then
//   Brent's method (bisection and interpolation) to GOAL_SEEK_TOLERANCE of the number. A value
//   the model can't work out (dividing by zero, …) is skipped, and the words say so.
// - Found: the slider is put there (as moving it would: not an undo step), a round number
//   preferred when it reaches the number as well, and the words say so: "Price 8.5 makes
//   Profit in Year 1 equal 0". Found outside the slider's range: the range widens to take it
//   in (its step kept; a board change, so an undo step) and the words say so. Not found: the
//   words say what the rectangle stayed between.
// - At most GOAL_SEEK_MAX_RUNS runs of the model and GOAL_SEEK_MAX_MS: on a slow model it
//   stops there and says so.
// - Not kept in the board file; on a phone the panel is hidden (desk-only).
// Every name goes in as text (textContent); the number typed is forced to a number.
// ============================================================
const GOAL_SEEK_SCAN = 40;            // pieces the slider's range is looked through in
const GOAL_SEEK_OUT = 6;              // pieces each side, each time the search widens
const GOAL_SEEK_LIMIT = 1e9;          // how far out it looks
const GOAL_SEEK_TOLERANCE = 1e-9;     // reached: within this share of the number (at least of 1)
const GOAL_SEEK_MAX_RUNS = 400;       // runs of the model at most
const GOAL_SEEK_MAX_MS = 3000;        // and time
const GOAL_SEEK_RANGE_STEPS = 100000; // a slider's range has at most this many steps (cleanRange)
let goalSeekChoice = { key: null, p: 0, slider: null }; // what the panel shows
let goalSeekWords = null;                                // { text, kind } of the last seek
let goalSeekModel = null;                                // the model they are for: another model forgets them

function forgetGoalSeek(){ // (a new model: renderGoalSeek)
  goalSeekChoice = { key: null, p: 0, slider: null };
  goalSeekWords = null;
  const t = $('goalTarget');
  if(t) t.value = '';
}

// The sliders a seek can change: those that count on this board (shared with other boards or
// its own), this board's own one in place of a like one on another board.
function goalSeekSliders(){
  if(!model || !board) return [];
  return liveSliders().map(o => board.sliders.find(x => settingKey(x) === settingKey(o)) || o);
}
function goalSliderLabel(s){
  const rect = model.byKey.get(s.key);
  return (rect ? rect.name : '?') + ' — ' + (periodsText(s.periods) || 'all periods') + (s.mode === 'shift' ? ', by %' : '');
}
function goalValueText(s, v){
  return s.mode === 'shift' ? (v >= 0 ? '+' : '−') + fmtNum(Math.abs(v)) + '%' : fmtNum(v);
}

// The search itself: the value of slider s that makes rect equal target in period p.
// → { reached: true, value, runs } | { reached: false, low, high, runs, stopped?, jump?, at? }
//   | { reached: false, error, runs }; errors: the first error met along the way, or null.
function seekGoal(s, rect, p, target){
  const started = performance.now();
  const sk = settingKey(s), live = liveSliders();
  const list = live.some(o => settingKey(o) === sk) ? live : live.concat([s]);
  const tol = GOAL_SEEK_TOLERANCE * Math.max(1, Math.abs(target));
  const STOP = {};
  let runs = 0, error = null, low = Infinity, high = -Infinity;
  // f(v): how far the rectangle is from the number with the slider at v; null when it can't be worked out.
  const f = (v) => {
    if(runs >= GOAL_SEEK_MAX_RUNS || performance.now() - started > GOAL_SEEK_MAX_MS) throw STOP;
    runs++;
    const overrides = overridesFor(list.map(o => settingKey(o) === sk ? Object.assign({}, o, { value: v }) : o));
    const r = resultOf(resultsWith(overrides), rect, p);
    if(r.error){ error = error || r.error; return null; }
    low = Math.min(low, r.value); high = Math.max(high, r.value);
    return r.value - target;
  };
  const here = sliderShown(s);
  const all = []; // { v, f } sorted by v
  const look = (vs) => {
    vs.forEach(v => { if(isFinite(v) && !all.some(x => x.v === v)) all.push({ v, f: f(v) }); });
    all.sort((a, b) => a.v - b.v);
  };
  // The crossing (or a value that reaches it) nearest the slider's position.
  const nearest = () => {
    let best = null;
    const offer = (c, d) => { if(!best || d < best.d) best = Object.assign(c, { d }); };
    const ok = all.filter(x => x.f !== null);
    ok.forEach(x => { if(Math.abs(x.f) <= tol) offer({ exact: x.v }, Math.abs(x.v - here)); });
    for(let i = 1; i < ok.length; i++){
      const a = ok[i - 1], b = ok[i];
      if(Math.abs(a.f) <= tol || Math.abs(b.f) <= tol || (a.f < 0) === (b.f < 0) || rejected.has(a.v + '|' + b.v)) continue;
      offer({ a: a.v, fa: a.f, b: b.v, fb: b.f }, here >= a.v && here <= b.v ? 0 : Math.min(Math.abs(here - a.v), Math.abs(here - b.v)));
    }
    return best;
  };
  const out = (extra) => Object.assign({ reached: false, runs, errors: error },
    low <= high ? { low, high } : { low: null, high: null, error: error || 'missing-input' }, extra || {});
  let value = null, jump = null;
  const rejected = new Set();
  try{
    const pts = [];
    for(let i = 0; i <= GOAL_SEEK_SCAN; i++) pts.push(i === GOAL_SEEK_SCAN ? s.max : s.min + (s.max - s.min) * i / GOAL_SEEK_SCAN);
    look(pts);
    let lo = s.min, hi = s.max, w = s.max - s.min;
    while(value === null){
      let hit = nearest();
      while(!hit && (lo > -GOAL_SEEK_LIMIT || hi < GOAL_SEEK_LIMIT)){
        w *= 4;
        const nlo = Math.max(-GOAL_SEEK_LIMIT, lo - w), nhi = Math.min(GOAL_SEEK_LIMIT, hi + w);
        const more = [];
        for(let i = 0; i < GOAL_SEEK_OUT; i++){
          if(nlo < lo) more.push(nlo + (lo - nlo) * i / GOAL_SEEK_OUT);
          if(nhi > hi) more.push(nhi - (nhi - hi) * i / GOAL_SEEK_OUT);
        }
        lo = nlo; hi = nhi;
        look(more);
        hit = nearest();
      }
      if(!hit) break;
      if(hit.exact !== undefined){ value = hit.exact; break; }
      rejected.add(hit.a + '|' + hit.b); // tried: a crossing that turns out not to reach it isn't tried again
      const b = brentRoot(f, hit.a, hit.fa, hit.b, hit.fb, tol);
      if(b.error) continue; // couldn't be worked out inside: look further
      const scale = Math.max(1, Math.abs(target), Math.abs(b.f + target));
      if(Math.abs(b.f) > tol && Math.abs(b.f) > GOAL_SEEK_TOLERANCE * scale){
        // Narrowed to a point without reaching it: the rectangle jumps past the number there
        // (a step, or dividing by something passing 0). Look further; say so if nothing else reaches it.
        if(!jump) jump = { jump: true, at: b.v, from: Math.min(hit.fa, hit.fb) + target, to: Math.max(hit.fa, hit.fb) + target };
        continue;
      }
      value = b.v;
    }
    if(value === null) return out(jump);
  } catch(e){
    if(e !== STOP) throw e;
    if(value === null) return out(Object.assign({ stopped: true }, jump || {}));
  }
  // A round number, when it reaches the number as well (8.5 rather than 8.499999999999).
  try{
    for(let k = 1; k < 16; k++){
      const c = Number(value.toPrecision(k));
      if(c === value) break;
      const d = f(c);
      if(d !== null && Math.abs(d) <= tol){ value = c; break; }
    }
  } catch(e){ if(e !== STOP) throw e; }
  return { reached: true, value, runs, errors: error };
}

// Brent's method on [a, b], where f changes sign: → { v, f } or { error }. A value f can't
// work out is stepped round by halving towards the other end.
function brentRoot(f, a, fa, b, fb, tol){
  let c = a, fc = fa, d = b - a, e = d;
  const xtol = Number.EPSILON * Math.abs(b - a); // near a pole the bracket would otherwise narrow to the smallest number there is
  for(let iter = 0; iter < 200; iter++){
    if((fb < 0) === (fc < 0)){ c = a; fc = fa; d = e = b - a; }
    if(Math.abs(fc) < Math.abs(fb)){ a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + xtol;
    const xm = 0.5 * (c - b);
    if(Math.abs(fb) <= tol || Math.abs(xm) <= tol1) return { v: b, f: fb };
    if(Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)){
      const s = fb / fa;
      let p, q;
      if(a === c){ p = 2 * xm * s; q = 1 - s; }
      else { const qq = fa / fc, r = fb / fc; p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1)); q = (qq - 1) * (r - 1) * (s - 1); }
      if(p > 0) q = -q;
      p = Math.abs(p);
      if(2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))){ e = d; d = p / q; }
      else { d = xm; e = d; }
    } else { d = xm; e = d; }
    a = b; fa = fb;
    let next = b + (Math.abs(d) > tol1 ? d : (xm >= 0 ? tol1 : -tol1));
    let fn = f(next);
    // Can't be worked out there: halve towards the other end (c) until it can.
    const steppedRound = fn === null;
    for(let tries = 0; fn === null && tries < 30; tries++){ next = (next + c) / 2; fn = f(next); }
    if(fn === null) return { error: true };
    b = next; fb = fn;
    if(steppedRound) d = e = b - a; // after a step round, the interpolation starts afresh
  }
  return { v: b, f: fb };
}

// Seek and, when found, put the slider there. → the result with its words (message, kind)
// and, when the range widened, range { min, max }.
function goalSeekNow(s, rect, p, target){
  const res = seekGoal(s, rect, p, target);
  const sliderName = model.byKey.get(s.key).name;
  const what = rect.name + ' in ' + model.periods[p];
  const skipped = res.errors ? ' At some values of ' + sliderName + ' it couldn\'t be worked out (' + errorText(res.errors).replace(/[()]/g, '') + '); those were skipped.' : '';
  let text, kind = 'err';
  if(res.reached){
    const v = res.value;
    let outside = '';
    if(v < s.min || v > s.max){
      widenRange(s, v);
      res.range = { min: s.min, max: s.max };
      outside = ' That is outside the slider\'s range, so it now goes from ' + goalValueText(s, s.min) + ' to ' + goalValueText(s, s.max) + '.';
      saveBoardSoon(); // the wider range is a board change
    }
    s.value = v;
    text = sliderName + ' ' + goalValueText(s, v) + ' makes ' + what + ' equal ' + fmtNum(target) + '.' + outside;
    kind = 'ok';
  } else if(res.low === null){
    text = what + ' couldn\'t be worked out at any value of ' + sliderName + ' tried: ' + errorText(res.error) + '.';
  } else if(res.jump && !res.stopped){
    text = what + ' can\'t equal ' + fmtNum(target) + ' by changing ' + sliderName + ': it jumps from ' + fmtNum(res.from) + ' to ' + fmtNum(res.to) + ' at ' + sliderName + ' ' + goalValueText(s, Math.abs(res.at) < 1e-9 ? 0 : Number(res.at.toPrecision(6))) + '.' + skipped;
  } else {
    const stays = (verb) => res.low === res.high ? 'it ' + verb + ' at ' + fmtNum(res.low) : 'it ' + verb + ' between ' + fmtNum(res.low) + ' and ' + fmtNum(res.high);
    text = res.stopped
      ? 'Stopped after ' + res.runs + ' tries (this model takes ' + fmtNum(model.baseMs) + ' ms to work out): ' + what + ' didn\'t reach ' + fmtNum(target) + ' by changing ' + sliderName + '; in what was tried, ' + stays('stayed') + '.' + skipped
      : what + ' can\'t reach ' + fmtNum(target) + ' by changing ' + sliderName + ': ' + stays('stays') + '.' + skipped;
  }
  if(res.reached && skipped) text += skipped;
  goalSeekWords = { text, kind };
  res.message = text;
  renderBoard(); // the slider and everything it reaches redrawn, and the words shown
  return res;
}

// The widest range a slider's step allows past its ends, the step kept (a larger one only
// when the step would give more than GOAL_SEEK_RANGE_STEPS steps).
function widenRange(s, v){
  let step = s.step;
  const span = Math.max(s.max, v) - Math.min(s.min, v);
  if(span / step > GOAL_SEEK_RANGE_STEPS) step = niceStep(span / (GOAL_SEEK_RANGE_STEPS / 2));
  const min = roundToStep(Math.floor(Math.min(s.min, v) / step) * step, step);
  const max = roundToStep(Math.ceil(Math.max(s.max, v) / step) * step, step);
  const r = cleanRange({ min: Math.min(min, v), max: Math.max(max, v), step }, null);
  if(r) Object.assign(s, r);
}

// ---- the panel ----
function renderGoalSeek(){
  const panel = $('goalSeekPanel');
  if(!panel) return;
  if(goalSeekModel !== model){ forgetGoalSeek(); goalSeekModel = model; }
  const host = $('goalRectHost'), per = $('goalPeriod'), sl = $('goalSlider'), note = $('goalSeekNote');
  note.textContent = goalSeekWords ? goalSeekWords.text : '';
  note.className = 'goal-note' + (goalSeekWords ? ' ' + goalSeekWords.kind : '');
  if(!model || !board){ host.textContent = ''; per.textContent = ''; sl.textContent = ''; return; }
  if(!panel.open) return; // filled when opened
  if(!model.byKey.has(goalSeekChoice.key)){
    const first = board.bars[0] || model.rects.find(r => !r.input) || model.rects[0];
    goalSeekChoice.key = first ? first.key : null;
  }
  host.textContent = '';
  if(model.rects.length){
    const sel = rectSelect(goalSeekChoice.key, false);
    sel.id = 'goalRect';
    sel.setAttribute('aria-label', 'Rectangle to set');
    sel.addEventListener('change', () => { goalSeekChoice.key = sel.value; });
    host.appendChild(sel);
  }
  per.textContent = '';
  if(!(goalSeekChoice.p >= 0 && goalSeekChoice.p < model.periods.length)) goalSeekChoice.p = 0;
  model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(i === goalSeekChoice.p) o.selected = true; per.appendChild(o); });
  sl.textContent = '';
  const sliders = goalSeekSliders();
  if(!sliders.some(s => s.id === goalSeekChoice.slider)) goalSeekChoice.slider = sliders.length ? sliders[0].id : null;
  sliders.forEach(s => { const o = make('option', null, goalSliderLabel(s)); o.value = s.id; if(s.id === goalSeekChoice.slider) o.selected = true; sl.appendChild(o); });
  sl.disabled = !sliders.length;
  $('btnGoalSeek').disabled = !sliders.length || !model.rects.length;
  if(!sliders.length && !goalSeekWords){ note.textContent = 'Add a slider first: goal seek changes one.'; note.className = 'goal-note'; }
}

$('goalSeekPanel').addEventListener('toggle', () => { if(model) renderGoalSeek(); });
$('goalPeriod').addEventListener('change', () => { goalSeekChoice.p = Number($('goalPeriod').value); });
$('goalSlider').addEventListener('change', () => { goalSeekChoice.slider = $('goalSlider').value; });
$('goalTarget').addEventListener('keydown', (ev) => { if(ev.key === 'Enter'){ ev.preventDefault(); $('btnGoalSeek').click(); } });
$('btnGoalSeek').addEventListener('click', () => {
  if(!model || !board) return;
  const typed = $('goalTarget').value.trim(), target = Number(typed);
  const rect = model.byKey.get(goalSeekChoice.key);
  const s = goalSeekSliders().find(x => x.id === goalSeekChoice.slider);
  const say = (text, kind) => { goalSeekWords = { text, kind }; renderGoalSeek(); };
  if(!rect) return say('Choose the rectangle to set.', 'err');
  if(!s) return say('Choose the slider to change.', 'err');
  if(typed === '' || !isFinite(target)) return say('Type the number ' + rect.name + ' should reach.', 'err');
  const btn = $('btnGoalSeek');
  btn.disabled = true;
  $('goalSeekNote').textContent = 'Seeking…';
  $('goalSeekNote').className = 'goal-note';
  // A moment for the words to show before the model is worked out.
  setTimeout(() => {
    btn.disabled = false;
    if(!model || !board || model.byKey.get(rect.key) !== rect) return;
    goalSeekNow(s, rect, goalSeekChoice.p, target);
  }, 0);
});
