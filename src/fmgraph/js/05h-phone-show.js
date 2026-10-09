// ============================================================
// fmGraph on a phone, sideways and showing (step 17, phase P1b; docs/step17-phones.md).
// - The mixer: a phone turned sideways shows the board's sliders as faders standing on end,
//   at the screen's two edges under the thumbs (#mixerLeft, #mixerRight; at most MIXER_MAX),
//   each the shared phone slider (vertical: up is more, sideways is finer). Each finger moves
//   its own fader, so several move at once. Which sliders: the board's first ones, or those
//   picked by a tap on a fader's name (#faderMenu), remembered in this browser per model and
//   board (fmgraph-mixer, the person's own setting, never in a file).
// - Show: one bar or chart on the whole screen (#showView), from its quick look; the screen
//   is kept on while it shows (keepScreenOn); ×, Esc or the phone's back gesture ends it. It
//   follows the sliders like the board.
// - Holding A: while a finger is on a scenario's A (05f-scenarios.js) or on the compare strip's
//   A (05e-compare.js), the bars show those numbers instead of the sliders' (lookingAt,
//   03-calc.js), with #lookBar saying so; letting go brings the sliders' numbers back. A quick
//   tap still compares, as before.
// ============================================================
const MIXER_MAX = 4;
const MIXER_KEY = 'fmgraph-mixer';
const MIXER_REMEMBERED = 100;   // boards whose mixer is remembered
let mixerChoice = {};           // model signature | board name → [slider setting key…]
let mixerControls = new Map();  // slider id → its fader
const landscape = (() => { try{ return window.matchMedia('(orientation: landscape)'); }catch(e){ return null; } })();

const isMixing = () => isPhone() && !!landscape && landscape.matches;
const mixerBoardKey = () => model.signature + '|' + board.name;

// The sliders on the mixer, in order: those picked for this board that are still on it, then
// the board's others, up to MIXER_MAX.
function mixerSliders(){
  const picked = (mixerChoice[mixerBoardKey()] || []).map(k => board.sliders.find(s => settingKey(s) === k)).filter(Boolean);
  const out = [...new Set(picked)];
  board.sliders.forEach(s => { if(out.length < MIXER_MAX && !out.includes(s)) out.push(s); });
  return out.slice(0, MIXER_MAX);
}
function pickForMixer(at, s){
  const list = mixerSliders();
  const was = list.indexOf(s);
  if(was >= 0) list[was] = list[at]; // swapping two already on the mixer
  list[at] = s;
  mixerChoice[mixerBoardKey()] = list.map(settingKey);
  const keys = Object.keys(mixerChoice);
  if(keys.length > MIXER_REMEMBERED) delete mixerChoice[keys[0]];
  store.put(MIXER_KEY, JSON.stringify(mixerChoice)).catch(() => {});
  renderMixer();
}
// What was kept: an object of short strings only.
function cleanMixerChoice(raw){
  const out = {};
  let data = null;
  try{ data = JSON.parse(raw); }catch(e){ return out; }
  if(!data || typeof data !== 'object' || Array.isArray(data)) return out;
  Object.keys(data).slice(-MIXER_REMEMBERED).forEach(k => {
    const v = data[k];
    if(k.length <= 200 && Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string' && x.length <= 400).slice(0, MIXER_MAX);
  });
  return out;
}

function renderMixer(){
  const left = $('mixerLeft'), right = $('mixerRight');
  left.textContent = '';
  right.textContent = '';
  mixerControls = new Map();
  closeFaderMenu();
  const on = isMixing() && !!model && !!board;
  document.body.classList.toggle('mixing', on);
  const list = on ? mixerSliders() : [];
  // Fewer on the left: the right thumb takes the odd one.
  const nLeft = Math.floor(list.length / 2);
  list.forEach((s, i) => (i < nLeft ? left : right).appendChild(fader(s, i)));
  left.classList.toggle('hidden', !on || nLeft === 0);
  right.classList.toggle('hidden', !on || list.length === 0);
  if(on) updateMixer();
  const w = (el) => el.classList.contains('hidden') ? 0 : el.offsetWidth;
  document.body.style.setProperty('--gbar-h', document.querySelector('.gbar').offsetHeight + 'px');
  document.body.style.setProperty('--mix-l', w(left) + 'px');
  document.body.style.setProperty('--mix-r', w(right) + 'px');
}

function fader(s, at){
  const rect = model.byKey.get(s.key);
  const el = make('div', 'fader');
  el.dataset.id = s.id;
  const name = make('button', 'fader-name', rect.name);
  name.type = 'button';
  name.title = 'Put another slider here';
  name.setAttribute('aria-haspopup', 'menu');
  name.addEventListener('click', () => openFaderMenu(name, at));
  const ctl = createPhoneSlider({
    label: rect.name, min: s.min, max: s.max, step: s.step, value: sliderShown(s), base: sliderBase(s), vertical: true,
    format: (v) => sliderText(s, v),
    vibrate: () => vibrateOn,
    onStart: () => { setActiveSlider(s.id); workOutAhead(s); },
    onInput: (v, atBase) => {
      if(atBase){ s.value = null; setActiveSlider(s.id); quietSoon(1500); scheduleUpdate(); }
      else moveSlider(s, v);
    },
    onEnd: () => quietSoon(1200),
  });
  mixerControls.set(s.id, ctl);
  el.append(name, ctl.el, make('div', 'fader-change'));
  return el;
}
function updateMixer(){
  if(!isMixing() || !model || !board) return;
  board.sliders.forEach(s => {
    const ctl = mixerControls.get(s.id);
    const el = document.querySelector('.fader[data-id="' + s.id + '"]');
    if(!ctl || !el) return;
    if(!ctl.dragging()) ctl.setValue(sliderShown(s));
    const first = baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
    const v = sliderShown(s);
    el.querySelector('.fader-change').textContent = s.value === null ? '' : s.mode === 'shift'
      ? fmtDiff(first * (1 + v / 100), first).split(' ')[0] : fmtDiff(v, sliderBase(s)).split(' ')[0];
    el.classList.toggle('moved', s.value !== null);
  });
}

// A tap on a fader's name: every slider on the board, the one there marked.
function openFaderMenu(anchor, at){
  const menu = $('faderMenu');
  menu.textContent = '';
  const here = mixerSliders()[at];
  board.sliders.forEach(s => {
    const b = make('button', null, model.byKey.get(s.key).name + (periodsText(s.periods) ? ' · ' + periodsText(s.periods) : ''));
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', s === here ? 'true' : 'false');
    b.addEventListener('click', () => { closeFaderMenu(); if(s !== here) pickForMixer(at, s); });
    menu.appendChild(b);
  });
  const r = anchor.getBoundingClientRect();
  menu.style.top = Math.round(r.bottom + 6) + 'px';
  menu.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - 240, r.left))) + 'px';
  menu.style.right = 'auto';
  menu.classList.remove('hidden');
}
function closeFaderMenu(){ $('faderMenu').classList.add('hidden'); }
document.addEventListener('pointerdown', (ev) => {
  if(!$('faderMenu').classList.contains('hidden') && !ev.target.closest('#faderMenu, .fader-name')) closeFaderMenu();
}, true);
if(landscape) landscape.addEventListener('change', () => { if(isPhone() && model){ closePeek(); renderDock(); renderPhoneBoards(); } });
store.ready.then(() => store.get(MIXER_KEY)).then(raw => {
  if(typeof raw === 'string' && raw) mixerChoice = cleanMixerChoice(raw);
  if(isMixing()) renderMixer();
}, () => {});

// ---- Show ----
let showing = null;       // the bar or chart shown
let letScreenSleep = null;
function openShow(w){
  if(!model || !board.items.includes(w)) return;
  if(showing) closeShow();
  showing = w;
  $('showTitle').textContent = w.kind === 'chart' ? (w.title || 'Chart') : model.byKey.get(w.key).name;
  const body = $('showBody');
  body.textContent = '';
  const el = make('div', 'show-widget');
  el.dataset.id = w.id;
  el.append(make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
  body.appendChild(el);
  $('showView').classList.remove('hidden');
  document.body.classList.add('showing');
  letScreenSleep = keepScreenOn();
  try{ history.pushState({ fmGraphShow: true }, ''); }catch(e){ /* no history: × and Esc still close */ }
  drawShow(currentResults());
  $('showClose').focus({ preventScroll: true });
}
// fromHistory: the back gesture already took the step back.
function closeShow(fromHistory){
  if(!showing) return;
  showing = null;
  $('showView').classList.add('hidden');
  $('showBody').textContent = '';
  document.body.classList.remove('showing');
  if(letScreenSleep){ letScreenSleep(); letScreenSleep = null; }
  if(!fromHistory && history.state && history.state.fmGraphShow){ try{ history.back(); }catch(e){ /* stays */ } }
}
// Drawn like the board's own, without gliding (its bars sit elsewhere than the board's).
function drawShow(results){
  if(!showing) return;
  if(!board.items.includes(showing)){ closeShow(); return; }
  const el = $('showBody').querySelector('.show-widget');
  const kept = new Map(lastGeometry), glides = animateNow;
  animateNow = false;
  if(showing.kind === 'chart') drawChart(el, showing, results); else drawBars(el, showing, results);
  lastGeometry = kept;
  animateNow = glides;
}
$('showClose').addEventListener('click', () => closeShow());
$('showShare').addEventListener('click', () => { if(showing) shareWidgetPicture(showing); }); // (05i-phone-share.js)
window.addEventListener('popstate', () => { if(showing) closeShow(true); });
document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape' && showing && $('peekBack').classList.contains('hidden')){ ev.stopPropagation(); closeShow(); } }, true);

// ---- Holding A to look ----
const LOOK_HOLD_MS = 220;
// On a phone, a finger held on el looks at what get() gives ({ overrides, label }) until it
// lifts; a quick tap does what el's click does.
function holdToLook(el, get){
  el.addEventListener('pointerdown', (ev) => {
    if(!isPhone() || ev.pointerType === 'mouse') return;
    const id = ev.pointerId;
    let looked = false;
    const timer = setTimeout(() => {
      const what = get();
      if(!what) return;
      looked = true;
      startLook(what);
    }, LOOK_HOLD_MS);
    const up = (e) => {
      if(e.pointerId !== id) return;
      clearTimeout(timer);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      if(!looked) return;
      endLook();
      // The click that follows the lift is not a tap.
      const swallow = (c) => { c.stopPropagation(); c.preventDefault(); };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
    };
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
  });
  el.addEventListener('contextmenu', (ev) => { if(isPhone()) ev.preventDefault(); });
}
function startLook(what){
  lookingAt = what;
  const bar = $('lookBar');
  bar.textContent = '';
  bar.appendChild(make('strong', null, 'Looking at ' + what.label));
  bar.appendChild(document.createTextNode(' — let go to come back'));
  bar.classList.remove('hidden');
  document.body.classList.add('looking');
  updateValues();
}
function endLook(){
  if(!lookingAt) return;
  lookingAt = null;
  $('lookBar').classList.add('hidden');
  document.body.classList.remove('looking');
  if(model) updateValues();
}

// ---- the phone layout starts (05g-phone.js) ----
applyPhoneLayout();
window.addEventListener('resize', () => { if(isPhoneScreen() !== document.body.classList.contains('phone-screen')) applyPhoneLayout(); else updateDockSpace(); });
store.ready.then(() => Promise.all([store.get(FULL_APP_KEY), store.get(VIBRATE_KEY)])).then(([full, vib]) => {
  fullApp = full === '1';
  vibrateOn = vib !== 'off';
  applyPhoneLayout();
}, () => {});
