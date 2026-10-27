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

// ---- Full screen (Show) ----
// One or several of the board's bars and charts on the whole screen, on any screen: ⛶ on a bar's
// or chart's header (or ⤢ Show in a phone's quick look) opens it with that one; the chips in the
// strip add or take away the others (a tap, so it works on an iPad); several share the screen in
// a grid that fits it best (showGrid). The browser's own full screen where it can (the whole
// page, so Help and the phone's dock and mixer stay over it; an iPhone has none: the view still
// covers the page). The strip — the chips, ▶ Play / ■ Stop, ⇪ Share, ?, × — fades after
// SHOW_STRIP_MS; a tap, a key or the mouse brings it back, and × stays. ×, Esc, the back gesture
// (a history step) or leaving the browser's full screen ends it. It follows the sliders and Play
// like the board (drawShow, from updateValues) and keeps the screen on; a tap in it never stops
// Play. Which are shown is this page's only: never saved, nothing in the board file.
// #showMore in the strip, before ⇪ Share, holds more buttons: 🎞 GIF of what is shown (05o-play-gif.js).
const SHOW_STRIP_MS = 3000;
const SHOW_ASPECT = 1.6;   // a bar's or chart's drawing, about this much wider than tall
const SHOW_GAP = 12;       // pixels between two shown
let showing = null;       // the ids shown, in the board's order; null when closed
let letScreenSleep = null;
let showFull = false;     // the browser's own full screen is on, asked for by this view
let showItemsMark = '';   // the board's widgets when the chips were made
let showQuietTimer = null;

// The widgets shown, as they are on the board now.
const shownWidgets = () => showing && board ? board.items.filter(w => showing.includes(w.id)) : [];

function openShow(w){
  if(!model || !board.items.includes(w)) return;
  if(showing){ showing = [w.id]; buildShowBody(); drawShow(currentResults()); return; }
  showing = [w.id];
  $('showView').classList.remove('hidden');
  document.body.classList.add('showing');
  letScreenSleep = keepScreenOn();
  try{ history.pushState({ fmGraphShow: true }, ''); }catch(e){ /* no history: × and Esc still close */ }
  enterFullScreen();
  buildShowBody();
  drawShow(currentResults());
  wakeShowStrip();
  $('showClose').focus({ preventScroll: true });
}
// fromHistory: the back gesture already took the step back.
function closeShow(fromHistory){
  if(!showing) return;
  showing = null;
  clearTimeout(showQuietTimer);
  $('showView').classList.add('hidden');
  $('showView').classList.remove('quiet');
  $('showBody').textContent = '';
  $('showChips').textContent = '';
  $('showNote').textContent = '';
  document.body.classList.remove('showing');
  if(letScreenSleep){ letScreenSleep(); letScreenSleep = null; }
  leaveFullScreen();
  if(!fromHistory && history.state && history.state.fmGraphShow){ try{ history.back(); }catch(e){ /* stays */ } }
}

// The browser's own full screen, where it has one (Safari on an iPad: webkit…; an iPhone none).
const fullScreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function enterFullScreen(){
  const el = document.documentElement;
  const ask = el.requestFullscreen || el.webkitRequestFullscreen;
  if(!ask || fullScreenElement()) return;
  try{
    const p = ask.call(el);
    if(p && p.catch) p.catch(() => { /* refused: the view still covers the page */ });
  }catch(e){ /* the same */ }
}
function leaveFullScreen(){
  if(!showFull) return;
  showFull = false;
  const leave = document.exitFullscreen || document.webkitExitFullscreen;
  if(leave && fullScreenElement()){ try{ const p = leave.call(document); if(p && p.catch) p.catch(() => {}); }catch(e){ /* stays */ } }
}
function fullScreenChanged(){
  if(fullScreenElement()){ if(showing) showFull = true; }
  else if(showFull){ showFull = false; closeShow(); } // the browser's full screen left: the view goes too
  if(showing) fitShowGrid();
}
document.addEventListener('fullscreenchange', fullScreenChanged);
document.addEventListener('webkitfullscreenchange', fullScreenChanged);

// The chips: every bar and chart on the board, those shown pressed.
function renderShowChips(){
  const box = $('showChips');
  box.textContent = '';
  showItemsMark = board.items.map(w => w.id).join('|');
  box.classList.toggle('hidden', board.items.length < 2);
  board.items.forEach(w => {
    const on = showing.includes(w.id);
    const b = make('button', 'show-chip', widgetName(w)); // (05i-phone-share.js)
    b.type = 'button';
    b.dataset.id = w.id;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? (showing.length > 1 ? 'Take it away' : 'Shown') : 'Show it too';
    b.addEventListener('click', () => toggleShown(w.id));
    box.appendChild(b);
  });
}
// A chip tapped: shown too, or taken away (the last one stays).
function toggleShown(id){
  if(!showing || !board.items.some(w => w.id === id)) return false;
  if(showing.includes(id)){
    if(showing.length === 1) return false;
    showing = showing.filter(x => x !== id);
  } else showing = board.items.filter(w => w.id === id || showing.includes(w.id)).map(w => w.id);
  const scroll = $('showChips').scrollLeft;
  buildShowBody();
  $('showChips').scrollLeft = scroll;
  drawShow(currentResults());
  return true;
}

// A place for each widget shown, laid out in the grid.
function buildShowBody(){
  const body = $('showBody');
  body.textContent = '';
  const list = shownWidgets();
  list.forEach(w => {
    const el = make('div', 'show-widget' + (list.length > 1 ? ' boxed' : ''));
    el.dataset.id = w.id;
    if(list.length > 1) el.appendChild(make('h3', 'show-name', widgetName(w)));
    el.append(make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
    body.appendChild(el);
  });
  const title = $('showTitle');
  title.textContent = list.length === 1 ? widgetName(list[0]) : '';
  title.classList.toggle('hidden', list.length !== 1);
  renderShowChips();
  fitShowGrid();
}
// Columns and rows for n on a w × h space: the largest drawing each can have.
function showGrid(n, w, h, gap){
  let best = { cols: 1, rows: Math.max(1, n), size: -1 };
  for(let cols = 1; cols <= Math.max(1, n); cols++){
    const rows = Math.ceil(n / cols);
    const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
    const size = Math.min(cw, ch * SHOW_ASPECT);
    if(size > best.size + 0.5) best = { cols, rows, size };
  }
  return best;
}
function fitShowGrid(){
  if(!showing) return;
  const view = $('showView'), body = $('showBody');
  body.style.setProperty('--show-top', $('showStrip').offsetHeight + 'px');
  const cs = getComputedStyle(body);
  const w = body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const h = body.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
  const g = showGrid(shownWidgets().length, Math.max(1, w), Math.max(1, h), SHOW_GAP);
  body.style.setProperty('--show-cols', String(g.cols));
  body.style.setProperty('--show-rows', String(g.rows));
  view.dataset.cols = String(g.cols);
  view.dataset.rows = String(g.rows);
}
window.addEventListener('resize', () => { if(showing) fitShowGrid(); });

// Drawn like the board's own, without gliding (its bars sit elsewhere than the board's).
function drawShow(results){
  if(!showing) return;
  const list = shownWidgets();
  if(!list.length){ closeShow(); return; }
  if(list.length !== showing.length){ showing = list.map(w => w.id); buildShowBody(); }
  else if(board.items.map(w => w.id).join('|') !== showItemsMark) renderShowChips();
  const kept = new Map(lastGeometry), glides = animateNow;
  animateNow = false;
  list.forEach(w => {
    const el = $('showBody').querySelector('.show-widget[data-id="' + w.id + '"]');
    if(!el) return;
    if(w.kind === 'chart') drawChart(el, w, results); else drawBars(el, w, results);
  });
  lastGeometry = kept;
  animateNow = glides;
  syncShowStrip();
}
// ▶ Play or ■ Stop, as Play is now (05m-play.js); ⇪ Share where sharing is (a phone, or a
// browser that shares files).
function syncShowStrip(){
  const b = $('showPlay'), on = !!playing;
  const text = on ? '■ Stop' : '▶ Play';
  if(b.textContent !== text){ b.textContent = text; b.title = on ? 'Stop playing' : 'Play between the ends chosen under Scenarios'; }
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if(on) $('showNote').textContent = '';
  $('showShare').classList.toggle('hidden', !(isPhone() || (navigator.share && navigator.canShare)));
}
$('showPlay').addEventListener('click', () => {
  if(playing){ stopPlay(); return; }
  renderPlayRow(); // the ends chosen under Scenarios, or the usual ones (05m-play.js)
  const words = startPlay(playChoice.from, playChoice.to);
  $('showNote').textContent = words ? '' : 'Nothing to play: choose two different ends under Scenarios.';
  syncShowStrip();
});

// The strip fades after a few seconds; anything the person does in the view brings it back.
function wakeShowStrip(){
  if(!showing) return;
  $('showView').classList.remove('quiet');
  clearTimeout(showQuietTimer);
  showQuietTimer = setTimeout(quietShowStrip, SHOW_STRIP_MS);
}
function quietShowStrip(){
  if(!showing) return;
  const strip = $('showStrip');
  // Not while the mouse is on it, or the keys are working in it.
  if(strip.matches(':hover') || strip.querySelector(':focus-visible:not(.show-close)')){ wakeShowStrip(); return; }
  $('showView').classList.add('quiet');
}
['pointerdown', 'focusin'].forEach(t => $('showView').addEventListener(t, wakeShowStrip, true));
document.addEventListener('keydown', () => { if(showing) wakeShowStrip(); }, true);
$('showView').addEventListener('pointermove', (ev) => { if(ev.pointerType === 'mouse') wakeShowStrip(); });

$('showClose').addEventListener('click', () => closeShow());
$('showHelp').addEventListener('click', () => help.open('full-screen')); // (07-help.js)
$('showShare').addEventListener('click', () => { if(showing) shareShownPicture(shownWidgets()); }); // (05i-phone-share.js)
window.addEventListener('popstate', () => { if(showing) closeShow(true); });
// Esc ends the view, and does only that (a play goes on: a second Esc stops it): on the window,
// before the page's other keys. Not while the quick look, a rectangle search or the colour grid
// is open (each closes itself).
window.addEventListener('keydown', (ev) => {
  if(ev.key !== 'Escape' || !showing || !$('peekBack').classList.contains('hidden')) return;
  if(document.querySelector('.colour-grid') || document.getElementById('rectSearch')) return;
  ev.preventDefault(); ev.stopPropagation(); closeShow();
}, true);

// ⛶ on a bar's or chart's header (05-render.js).
function fullScreenButton(w){
  const b = make('button', 'widget-full', '⛶');
  b.type = 'button';
  const label = 'Full screen: show this ' + (w.kind === 'chart' ? 'chart' : 'bar') + ' on the whole screen';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => openShow(w));
  return b;
}

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
