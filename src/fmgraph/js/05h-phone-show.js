// ============================================================
// fmGraph on a phone, sideways and showing (step 17, phase P1b; docs/step17-phones.md).
// - The mixer: a phone turned sideways shows the board's sliders as faders standing on end,
//   at the screen's two edges under the thumbs (#mixerLeft, #mixerRight; at most MIXER_MAX),
//   each the shared phone slider (vertical: up is more, sideways is finer). Each finger moves
//   its own fader, so several move at once. Which sliders: the board's first ones, or those
//   picked by a tap on a fader's name (#faderMenu), remembered in this browser per model and
//   board (fmgraph-mixer, the person's own setting, never in a file).
// - Show, the full screen (on any screen, the owner's idea of 27 October 2026): one or several
//   bars and charts on the whole screen (#showView), from ⛶ on a header or a phone's quick look;
//   the screen is kept on while it shows (keepScreenOn); ×, Esc, the back gesture or leaving
//   the browser's full screen ends it. It follows the sliders and Play like the board.
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
  el.style.setProperty('--slider-accent', sliderAccent(shownColour(s.key))); // the fader takes its colour (04e-colours.js)
  const name = make('button', 'fader-name', rect.name);
  name.type = 'button';
  name.title = 'Put another slider here';
  name.setAttribute('aria-haspopup', 'menu');
  name.style.setProperty('--rect-colour', shownColour(s.key)); // its rectangle's colour (04e-colours.js)
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

// ---- Full screen (Show): the board engine's 05gs-show.js, and fmGraph's own part ----
// #showMore in the strip, before ⇪ Share, holds more buttons: 🎞 GIF of what is shown (05o-play-gif.js).
// ⇪ Share where sharing is (a phone, or a browser that shares files).
function showStripExtras(){
  $('showShare').classList.toggle('hidden', !(isPhone() || (navigator.share && navigator.canShare)));
}
// A slider beside the full screen: one short row, as at its minimum (05c-arrange.js). On a phone
// the dock and the mixer are the sliders there (styles.css), shown or hidden by 🎚 Sliders.
function showSliderRow(s){ return sliderLine(s, 'widget slider-widget show-slider'); }
const SHOW_SLIDERS_KEY = 'fmgraph-show-sliders';
function rememberShowSliders(on){ store.put(SHOW_SLIDERS_KEY, on ? 'on' : 'off').catch(() => {}); }
store.ready.then(() => store.get(SHOW_SLIDERS_KEY)).then(raw => {
  if(raw === 'on' || raw === 'off') setShowSliders(raw === 'on', true);
}, () => {});
// Esc belongs to the quick look, a rectangle search or the colour grid while one is open.
function showEscapeBlocked(){
  return !$('peekBack').classList.contains('hidden') || !!document.querySelector('.colour-grid') || !!document.getElementById('rectSearch');
}
$('showShare').addEventListener('click', () => { if(showing) shareShownPicture(shownWidgets()); }); // (05i-phone-share.js)

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
