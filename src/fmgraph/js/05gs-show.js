// ============================================================
// Full screen (Show): one or several of the board's bars and charts on the whole screen, on any
// screen. Part of the board engine (moved from 05h-phone-show.js on 30 October 2026, unchanged
// but for the sliders, so the showcase viewer has it too): declarations only; the page calls
// wireShow() once, when it starts. ⛶ on a bar's or chart's header (or ⤢ Show in fmGraph's quick look on a phone)
// opens it with that one; the chips in the strip add or take away the others (a tap, so it works
// on an iPad); several share the screen in a grid that fits it best (showGrid). The browser's own
// full screen where it can (the whole page, so Help and fmGraph's phone dock and mixer stay over
// it; an iPhone has none: the view still covers the page). The strip — the chips, ▶ Play / ■ Stop,
// 🎚 Sliders, the page's own buttons, ?, × — fades after SHOW_STRIP_MS; a tap, a key or the mouse
// brings it back, and × stays. ×, Esc, the back gesture (a history step) or leaving the browser's
// full screen ends it. It follows the sliders and Play like the board (drawShow, from the page's
// updateValues) and keeps the screen on; a tap in it never stops Play. Which are shown is the
// page's only: never saved, nothing in the board file.
// 🎚 Sliders (the owner's request of 30 October 2026): the board's sliders beside what is shown,
// one short row each (the page's showSliderRow) — on the right when the view is wider than tall,
// at its foot when taller; a slider reaching none of those shown is dimmed. Moving one moves the
// board's own. On or off is kept on this device by the page (rememberShowSliders); until chosen,
// on for a phone (fmGraph's dock and mixer there, which it hides when off), off elsewhere.
// The page defines, beside the usual page interface: renderPlayRow (the Play ends), help (topic
// full-screen), showStripExtras() (its own buttons in the strip), showSliderRow(s),
// rememberShowSliders(on) and showEscapeBlocked() (Esc belongs to something open over the view).
// ============================================================
const SHOW_STRIP_MS = 3000;
const SHOW_ASPECT = 1.6;   // a bar's or chart's drawing, about this much wider than tall
const SHOW_GAP = 12;       // pixels between two shown
let showing = null;       // the ids shown, in the board's order; null when closed
let letScreenSleep = null;
let showFull = false;     // the browser's own full screen is on, asked for by this view
let showItemsMark = '';   // the board's widgets when the chips were made
let showQuietTimer = null;
let showSlidersOn = null; // 🎚 Sliders: true or false once chosen; null, not yet (on for a phone)
let showSlidersMark = ''; // the board's sliders when their rows were made
let showSliderObjects = [];

// The widgets shown, as they are on the board now.
const shownWidgets = () => showing && board ? board.items.filter(w => showing.includes(w.id)) : [];
// A bar's or chart's name: its rectangle's, its title, or its kind.
const widgetName = (w) => w.kind === 'chart' ? (w.title || ({ columns: 'Columns', lines: 'Lines', flow: 'Waterfall', free: 'Free', scenarios: 'Scenario waterfall', tornado: 'Tornado', spider: 'Spider' }[w.layout] || 'Chart')) : model.byKey.get(w.key).name;
const showSlidersShown = () => showSlidersOn === null ? isPhone() : showSlidersOn;

function openShow(w){
  if(!model || !board.items.includes(w)) return;
  if(showing){ showing = [w.id]; buildShowBody(); drawShow(currentResults()); return; }
  showing = [w.id];
  $('showView').classList.remove('hidden');
  document.body.classList.add('showing');
  letScreenSleep = keepScreenOn();
  try{ history.pushState({ fmGraphShow: true }, ''); }catch(e){ /* no history: × and Esc still close */ }
  enterFullScreen();
  syncShowSliders();
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
  $('showSliders').textContent = '';
  showSlidersMark = '';
  showSliderObjects = [];
  document.body.classList.remove('showing', 'show-hide-sliders');
  if(letScreenSleep){ letScreenSleep(); letScreenSleep = null; }
  leaveFullScreen();
  if(!fromHistory && history.state && history.state.fmGraphShow){ try{ history.back(); }catch(e){ /* stays */ } }
}

// The browser's own full screen, where it has one (Safari on an iPad: webkit…; an iPhone none).
function fullScreenElement(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
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

// The chips: every bar and chart on the board, those shown pressed.
function renderShowChips(){
  const box = $('showChips');
  box.textContent = '';
  showItemsMark = board.items.map(w => w.id).join('|');
  box.classList.toggle('hidden', board.items.length < 2);
  board.items.forEach(w => {
    const on = showing.includes(w.id);
    const b = make('button', 'show-chip', widgetName(w));
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
  // The sliders beside (wider than tall) or at the foot (taller): decided before measuring.
  view.dataset.shape = view.clientWidth >= view.clientHeight ? 'wide' : 'tall';
  const top = $('showStrip').offsetHeight + 'px';
  body.style.setProperty('--show-top', top);
  $('showSliders').style.setProperty('--show-top', top);
  const cs = getComputedStyle(body);
  const w = body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const h = body.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
  const g = showGrid(shownWidgets().length, Math.max(1, w), Math.max(1, h), SHOW_GAP);
  body.style.setProperty('--show-cols', String(g.cols));
  body.style.setProperty('--show-rows', String(g.rows));
  view.dataset.cols = String(g.cols);
  view.dataset.rows = String(g.rows);
}

// Drawn like the board's own, without gliding (its bars sit elsewhere than the board's).
function drawShow(results){
  if(!showing) return;
  const list = shownWidgets();
  if(!list.length){ closeShow(); return; }
  if(list.length !== showing.length){ showing = list.map(w => w.id); buildShowBody(); }
  else if(board.items.map(w => w.id).join('|') !== showItemsMark) renderShowChips();
  if(showSlidersShown() && showSlidersChanged()) renderShowSliders();
  const kept = new Map(lastGeometry), glides = animateNow;
  animateNow = false;
  list.forEach(w => {
    const el = $('showBody').querySelector('.show-widget[data-id="' + w.id + '"]');
    if(!el) return;
    if(w.kind === 'chart') drawChart(el, w, results); else drawBars(el, w, results);
  });
  lastGeometry = kept;
  animateNow = glides;
  paintShowSliders();
  syncShowStrip();
}
// ▶ Play or ■ Stop, as Play is now (05m-play.js); the page's own buttons.
function syncShowStrip(){
  const b = $('showPlay'), on = !!playing;
  const text = on ? '■ Stop' : '▶ Play';
  if(b.textContent !== text){ b.textContent = text; b.title = on ? 'Stop playing' : 'Play between the ends chosen under Scenarios'; }
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if(on) $('showNote').textContent = '';
  showStripExtras();
}

// ---- 🎚 Sliders beside the full screen ----
// The board's sliders as they stand: which, on which rectangle, over what range.
function slidersSignature(){ return board.sliders.map(s => [s.id, s.key, s.mode, s.min, s.max, s.step, JSON.stringify(s.periods)].join(' ')).join('|'); }
function showSlidersChanged(){
  return showSliderObjects.length !== board.sliders.length || board.sliders.some((s, i) => s !== showSliderObjects[i]) || slidersSignature() !== showSlidersMark;
}
function setShowSliders(on, quiet){
  showSlidersOn = !!on;
  if(!quiet) rememberShowSliders(showSlidersOn);
  syncShowSliders();
  if(!showing) return;
  fitShowGrid();
  drawShow(currentResults());
}
function syncShowSliders(){
  const on = showSlidersShown();
  const b = $('showSlidersBtn');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = on ? 'Hide the sliders' : 'Show the board\'s sliders beside the full screen';
  $('showView').classList.toggle('with-sliders', on);
  document.body.classList.toggle('show-hide-sliders', !!showing && !on);
  renderShowSliders();
}
function renderShowSliders(){
  const box = $('showSliders');
  box.textContent = '';
  const on = !!showing && !!board && showSlidersShown();
  box.classList.toggle('hidden', !on);
  showSlidersMark = '';
  showSliderObjects = [];
  if(!on) return;
  showSliderObjects = board.sliders.slice();
  showSlidersMark = slidersSignature();
  if(!board.sliders.length){ box.appendChild(make('p', 'show-sliders-none', 'This board has no sliders.')); return; }
  board.sliders.forEach(s => box.appendChild(showSliderRow(s)));
  paintShowSliders();
}
// A slider reaching none of the bars and charts shown is dimmed (it still moves).
function paintShowSliders(){
  if(!showing || !showSlidersShown()) return;
  const keys = new Set(shownWidgets().flatMap(itemKeys));
  $('showSliders').querySelectorAll('.slider-widget').forEach(el => {
    const s = board.sliders.find(x => x.id === el.dataset.id);
    if(!s) return;
    const reaches = keys.has(s.key) || [...model.reach(s.key)].some(k => keys.has(k));
    el.classList.toggle('unreached', !reaches);
  });
}

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

// ⛶ on a bar's or chart's header.
function fullScreenButton(w){
  const b = make('button', 'widget-full', '⛶');
  b.type = 'button';
  const label = 'Full screen: show this ' + (w.kind === 'chart' ? 'chart' : 'bar') + ' on the whole screen';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => openShow(w));
  return b;
}

// The view's buttons and keys, wired once by the page.
function wireShow(){
  document.addEventListener('fullscreenchange', fullScreenChanged);
  document.addEventListener('webkitfullscreenchange', fullScreenChanged);
  window.addEventListener('resize', () => { if(showing) fitShowGrid(); });
  $('showPlay').addEventListener('click', () => {
    if(playing){ stopPlay(); return; }
    renderPlayRow(); // the ends chosen under Scenarios, or the usual ones (05m-play.js)
    const words = startPlay(playChoice.from, playChoice.to);
    $('showNote').textContent = words ? '' : 'Nothing to play: choose two different ends under Scenarios.';
    syncShowStrip();
  });
  $('showSlidersBtn').addEventListener('click', () => setShowSliders(!showSlidersShown()));
  ['pointerdown', 'focusin'].forEach(t => $('showView').addEventListener(t, wakeShowStrip, true));
  document.addEventListener('keydown', () => { if(showing) wakeShowStrip(); }, true);
  $('showView').addEventListener('pointermove', (ev) => { if(ev.pointerType === 'mouse') wakeShowStrip(); });
  $('showClose').addEventListener('click', () => closeShow());
  $('showHelp').addEventListener('click', () => help.open('full-screen'));
  window.addEventListener('popstate', () => { if(showing) closeShow(true); });
  // Esc ends the view, and does only that (a play goes on: a second Esc stops it): on the window,
  // before the page's other keys. Not while something open over it takes Esc itself.
  window.addEventListener('keydown', (ev) => {
    if(ev.key !== 'Escape' || !showing || showEscapeBlocked()) return;
    ev.preventDefault(); ev.stopPropagation(); closeShow();
  }, true);
}
