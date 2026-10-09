// ============================================================
// fmGraph on a phone (step 17, phase P1a; docs/step17-phones.md). On a touchscreen whose
// shorter side is under 600 pixels (isPhoneScreen, src/shared/phone.js) the page takes its
// phone layout, body.phone:
// - the top bar keeps ←, the model's name and ☰ (#phoneMenu: Open, ↻ From fmIDE, Reset all,
//   Pin as A, Scenarios, Biggest movers, Undo / Redo, the tick's switch, Help, Full app);
// - the bars and charts fill the screen in one column; a swipe sideways across them, or ‹ ›
//   (#phoneBoards), shows the next or previous board;
// - the sliders sit in the dock along the bottom (#sliderDock), in reach of the thumb: one at a
//   time, large (the shared phone slider), a swipe along the dock to the next; drawn up it
//   lists them all, drawn down it gets out of the way;
// - holding a bar opens its quick look (#peekCard): every period, now against the model's own
//   numbers (or A), 🔍 Trace and ⤢ Show (05h-phone-show.js); holding a chart, its rectangles;
// - building and editing (+ Bar, + Chart, + Slider, the Boards menu, editors, arranging,
//   colours, the tutorials) is left to a tablet or computer: ☰ → Full app shows the full page,
//   📱 Phone layout goes back. Both settings are the person's own, kept in this browser
//   (fmgraph-full-app, fmgraph-vibrate), never in a file.
// ============================================================
// build:include shared/phone.js

const FULL_APP_KEY = 'fmgraph-full-app';
const VIBRATE_KEY = 'fmgraph-vibrate';
let fullApp = false;     // the full page on a phone (☰ → Full app)
let vibrateOn = true;    // the tick felt, where the phone allows it
let dockIndex = 0;       // the slider the dock shows
let dockControls = new Map(); // slider id → its phone slider

const isPhone = () => document.body.classList.contains('phone');

function applyPhoneLayout(){
  const screenIsPhone = isPhoneScreen();
  const phone = screenIsPhone && !fullApp;
  const was = isPhone();
  document.body.classList.toggle('phone-screen', screenIsPhone);
  document.body.classList.toggle('phone', phone);
  $('btnPhoneLayout').classList.toggle('hidden', !(screenIsPhone && fullApp));
  if(!phone){ closePhoneMenu(); closePeek(); closeShow(); }
  if(was !== phone && model && board) renderAll();
  else { renderDock(); renderPhoneBoards(); }
}
function setFullApp(on){
  fullApp = !!on;
  store.put(FULL_APP_KEY, fullApp ? '1' : '').catch(() => {});
  applyPhoneLayout();
}

// ---- the dock ----
function sliderText(s, v){
  return s.mode === 'shift' ? (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v)) + '%' : fmtNum(v);
}
function sliderBase(s){
  return s.mode === 'shift' ? 0 : baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
}
function periodsText(spec){
  if(!spec || spec.mode === 'all') return '';
  const ps = periodsOf(spec);
  return ps.length === 1 ? model.periods[ps[0]] : model.periods[ps[0]] + ' to ' + model.periods[ps[ps.length - 1]];
}

function renderDock(){
  const dock = $('sliderDock'), cards = $('dockCards');
  const on = isPhone() && !!model && !!board && !isMixing(); // sideways: the mixer instead (05h-phone-show.js)
  dock.classList.toggle('hidden', !on);
  cards.textContent = '';
  dockControls = new Map();
  if(on){
    board.sliders.forEach(s => cards.appendChild(dockCard(s)));
    $('dockEmpty').classList.toggle('hidden', board.sliders.length > 0);
    dockIndex = Math.max(0, Math.min(dockIndex, board.sliders.length - 1));
    renderDockDots();
    showDockCard(dockIndex);
    updateDock();
  }
  renderMixer();
  updateDockSpace();
}

function dockCard(s){
  const rect = model.byKey.get(s.key);
  const card = make('div', 'dock-card');
  card.dataset.id = s.id;
  const head = make('div', 'dock-card-head');
  head.appendChild(make('span', 'dock-name', rect.name));
  const when = periodsText(s.periods);
  if(when) head.appendChild(make('span', 'dock-periods', when));
  head.appendChild(make('span', 'dock-change'));
  const ctl = createPhoneSlider({
    label: rect.name, min: s.min, max: s.max, step: s.step, value: sliderShown(s), base: sliderBase(s),
    format: (v) => sliderText(s, v),
    vibrate: () => vibrateOn,
    onStart: () => { setActiveSlider(s.id); workOutAhead(s); },
    onInput: (v, atBase) => {
      if(atBase){ s.value = null; setActiveSlider(s.id); quietSoon(1500); scheduleUpdate(); }
      else moveSlider(s, v);
    },
    onEnd: () => quietSoon(1200),
  });
  dockControls.set(s.id, ctl);
  card.append(head, ctl.el, make('div', 'dock-base'));
  return card;
}

// The words under each slider, after every redraw (updateValues).
function updateDock(){
  if(!isPhone() || !model || !board) return;
  updateMixer();
  board.sliders.forEach(s => {
    const card = document.querySelector('#dockCards .dock-card[data-id="' + s.id + '"]');
    const ctl = dockControls.get(s.id);
    if(!card || !ctl) return;
    if(!ctl.dragging()) ctl.setValue(sliderShown(s));
    const v = sliderShown(s), base = sliderBase(s);
    // What the change does to the first period's number (for a change by %, that number too).
    const first = baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
    card.querySelector('.dock-change').textContent = s.value === null ? '' : s.mode === 'shift'
      ? fmtNum(first * (1 + v / 100)) + ' (' + fmtDiff(first * (1 + v / 100), first).split(' ')[0] + ')' : fmtDiff(v, base);
    card.querySelector('.dock-base').textContent = sliderBaseText(s) + (s.value === null ? '' : ' · double-tap to go back');
    card.classList.toggle('moved', s.value !== null);
  });
  updateDockHandle();
}

function renderDockDots(){
  const dots = $('dockDots');
  dots.textContent = '';
  if(board.sliders.length < 2) return;
  board.sliders.forEach((s, i) => dots.appendChild(make('span', 'dock-dot' + (i === dockIndex ? ' on' : ''))));
}
function showDockCard(i){
  const cards = $('dockCards');
  if($('sliderDock').dataset.state !== 'peek') return;
  requestAnimationFrame(() => { cards.scrollLeft = i * cards.clientWidth; });
}
$('dockCards').addEventListener('scroll', () => {
  const cards = $('dockCards');
  if($('sliderDock').dataset.state !== 'peek' || !board || !cards.clientWidth) return;
  const i = Math.max(0, Math.min(board.sliders.length - 1, Math.round(cards.scrollLeft / cards.clientWidth)));
  if(i === dockIndex) return;
  dockIndex = i;
  document.querySelectorAll('#dockDots .dock-dot').forEach((d, k) => d.classList.toggle('on', k === i));
  updateDockHandle();
}, { passive: true });

// Drawn up: every slider; drawn down: out of the way; a tap: one or all.
const DOCK_STATES = ['closed', 'peek', 'open'];
function setDockState(state){
  const dock = $('sliderDock');
  dock.dataset.state = DOCK_STATES.includes(state) ? state : 'peek';
  $('dockHandle').setAttribute('aria-expanded', dock.dataset.state === 'open' ? 'true' : 'false');
  $('dockHandle').setAttribute('aria-label', dock.dataset.state === 'open' ? 'Show one slider at a time' : 'Show every slider');
  showDockCard(dockIndex);
  updateDockHandle();
  updateDockSpace();
}
function updateDockHandle(){
  const s = board && board.sliders[dockIndex];
  $('dockHandleText').textContent = $('sliderDock').dataset.state === 'closed' && s && model
    ? model.byKey.get(s.key).name + ': ' + sliderText(s, sliderShown(s)) + ' ▴' : '';
}
let handleY = null, handleSwiped = false;
$('dockHandle').addEventListener('pointerdown', (ev) => { handleY = ev.clientY; handleSwiped = false; });
$('dockHandle').addEventListener('pointerup', (ev) => {
  if(handleY === null) return;
  const dy = ev.clientY - handleY, at = DOCK_STATES.indexOf($('sliderDock').dataset.state);
  handleY = null;
  if(Math.abs(dy) < 30) return;
  handleSwiped = true;
  setDockState(DOCK_STATES[Math.max(0, Math.min(2, at + (dy < 0 ? 1 : -1)))]);
});
$('dockHandle').addEventListener('click', () => {
  if(handleSwiped){ handleSwiped = false; return; }
  setDockState($('sliderDock').dataset.state === 'peek' ? 'open' : 'peek');
});

// Room under the page for the dock, so the last bar can be scrolled above it.
function updateDockSpace(){
  const dock = $('sliderDock');
  const h = dock.classList.contains('hidden') || !isPhone() ? 0 : dock.offsetHeight;
  document.body.style.setProperty('--dock-h', h + 'px');
}
if(typeof ResizeObserver === 'function') new ResizeObserver(() => updateDockSpace()).observe($('sliderDock'));

// ---- boards: ‹ name › and a swipe sideways ----
function renderPhoneBoards(){
  const nav = $('phoneBoards');
  nav.textContent = '';
  if(!isPhone() || !model || !board) return;
  const i = boards.indexOf(board);
  const arrow = (text, label, to) => {
    const b = make('button', 'phone-board-arrow', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = to < 0 || to >= boards.length;
    b.addEventListener('click', () => swipeBoard(to - i));
    return b;
  };
  const name = make('div', 'phone-board-name');
  name.appendChild(make('span', 'phone-board-title', board.name));
  if(boards.length > 1){
    const dots = make('span', 'phone-board-dots');
    dots.setAttribute('aria-label', 'Board ' + (i + 1) + ' of ' + boards.length);
    boards.forEach((b, k) => dots.appendChild(make('span', 'dock-dot' + (k === i ? ' on' : ''))));
    name.appendChild(dots);
  }
  nav.append(arrow('‹', 'Previous board', i - 1), name, arrow('›', 'Next board', i + 1));
}
function swipeBoard(by){
  const i = boards.indexOf(board) + by;
  if(by === 0 || i < 0 || i >= boards.length) return false;
  showBoardAt(i);
  const el = $('board');
  if(!(reducedMotion && reducedMotion.matches) && typeof el.animate === 'function'){
    el.animate([{ transform: 'translateX(' + (by > 0 ? 40 : -40) + 'px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }
  return true;
}
$('board').addEventListener('pointerdown', (ev) => {
  if(!isPhone() || ev.pointerType === 'mouse' || ev.target.closest('.ps, button, input, select, summary, .scenarios, .movers')) return;
  const id = ev.pointerId, x0 = ev.clientX, y0 = ev.clientY, t0 = performance.now();
  const up = (e) => {
    if(e.pointerId !== id) return;
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if(e.type === 'pointerup' && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && performance.now() - t0 < 900) swipeBoard(dx < 0 ? 1 : -1);
  };
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
});

// ---- holding a bar: its quick look ----
let peekFor = null, peekOpenedAt = 0, peekDownOnBack = false;
function phoneBarPress(ev, b){
  if(!isPhone() || ev.pointerType === 'mouse' || ev.target.closest('button, select, input')) return;
  waitForHold(ev, { onHold: () => openPeek(b), onMoveFirst: () => {}, onRelease: () => {} });
}
function openPeek(b){
  if(!model || !board.items.includes(b)) return;
  if(b.kind === 'chart') return openChartPeek(b);
  $('peekChart').classList.remove('hidden');
  const rect = model.byKey.get(b.key);
  const results = currentResults(), cmp = compareResults();
  peekFor = b;
  peekOpenedAt = performance.now();
  $('peekTitle').textContent = rect.name;
  $('peekWhere').textContent = rect.canvasName + (rect.unit ? ' · in ' + rect.unit : '');
  const all = model.periods.map((_, p) => ({ p, now: resultOf(results, rect, p), was: resultOf(cmp, rect, p) }));
  // Every period as a small line: now, and the model's own numbers (or A) dashed.
  const host = $('peekChart');
  host.textContent = '';
  const nums = [];
  all.forEach(r => { if(!r.now.error) nums.push(r.now.value); if(!r.was.error) nums.push(r.was.value); });
  if(nums.length){
    let lo = Math.min(0, ...nums), hi = Math.max(0, ...nums);
    if(hi === lo) hi = lo + 1;
    const W = 320, H = 110, n = all.length;
    const x = (i) => n === 1 ? W / 2 : 14 + i * (W - 28) / (n - 1);
    const y = (v) => 8 + (hi - v) / (hi - lo) * (H - 16);
    const chart = svg('svg', { class: 'peek-line', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    chart.setAttribute('aria-label', rect.name + ', every period');
    chart.appendChild(svg('line', { class: 'b-zero', x1: 0, x2: W, y1: y(0), y2: y(0) }));
    const line = (key, cls) => {
      const pts = all.filter(r => !r[key].error).map(r => x(r.p) + ',' + y(r[key].value)).join(' ');
      if(pts) chart.appendChild(svg('polyline', { class: cls, points: pts }));
    };
    line('was', 'peek-was');
    line('now', 'peek-now');
    all.forEach(r => { if(!r.now.error) chart.appendChild(svg('circle', { class: 'peek-dot', cx: x(r.p), cy: y(r.now.value), r: 3.5 })); });
    host.appendChild(chart);
  }
  const table = $('peekTable');
  table.textContent = '';
  const headRow = make('tr');
  [['Period'], ['Now'], [pinA ? 'From A' : 'From the model\'s']].forEach(([t]) => headRow.appendChild(make('th', null, t)));
  const thead = make('thead');
  thead.appendChild(headRow);
  const tbody = make('tbody');
  all.forEach(r => {
    const tr = make('tr');
    tr.appendChild(make('td', null, model.periods[r.p]));
    tr.appendChild(make('td', 'num', r.now.error ? '! ' + errorText(r.now.error) : fmtNum(r.now.value)));
    const diff = r.now.error || r.was.error ? '' : fmtDiff(r.now.value, r.was.value);
    tr.appendChild(make('td', 'num ' + (diff ? (r.now.value > r.was.value ? 'up' : 'down') : ''), diff || '—'));
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  showPeekCard(b);
}
function showPeekCard(w){
  $('peekTrace').setAttribute('aria-pressed', traceId === w.id ? 'true' : 'false');
  $('peekBack').classList.remove('hidden');
  $('peekClose').focus({ preventScroll: true });
}
// A chart's quick look: each of its rectangles in the period it shows (the first, for columns).
function openChartPeek(c){
  const results = currentResults(), cmp = compareResults();
  peekFor = c;
  peekOpenedAt = performance.now();
  const p = c.layout === 'columns' ? (periodsOf(c.periods)[0] || 0) : c.period;
  const kind = { columns: 'Columns', flow: 'Waterfall', scenarios: 'Scenario waterfall' }[c.layout] || 'Chart';
  $('peekTitle').textContent = c.title || kind;
  $('peekWhere').textContent = kind + ' · ' + model.periods[p];
  $('peekChart').textContent = '';
  $('peekChart').classList.add('hidden');
  const table = $('peekTable');
  table.textContent = '';
  const headRow = make('tr');
  ['Rectangle', 'Now', pinA ? 'From A' : 'From the model\'s'].forEach(t => headRow.appendChild(make('th', null, t)));
  const thead = make('thead');
  thead.appendChild(headRow);
  const tbody = make('tbody');
  [...new Set(chartKeys(c))].forEach(k => {
    const rect = model.byKey.get(k);
    if(!rect) return;
    const now = resultOf(results, rect, p), was = resultOf(cmp, rect, p);
    const tr = make('tr');
    tr.appendChild(make('td', null, rect.name));
    tr.appendChild(make('td', 'num', now.error ? '! ' + errorText(now.error) : fmtNum(now.value)));
    const diff = now.error || was.error ? '' : fmtDiff(now.value, was.value);
    tr.appendChild(make('td', 'num ' + (diff ? (now.value > was.value ? 'up' : 'down') : ''), diff || '—'));
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  showPeekCard(c);
}
function closePeek(){
  peekFor = null;
  $('peekBack').classList.add('hidden');
}
$('peekClose').addEventListener('click', closePeek);
$('peekTrace').addEventListener('click', () => { const b = peekFor; closePeek(); if(b) setTrace(traceId === b.id ? null : b.id); });
$('peekShow').addEventListener('click', () => { const w = peekFor; closePeek(); if(w) openShow(w); });
// A tap on the dim page around the card closes it (not the finger that opened it, lifting).
$('peekBack').addEventListener('pointerdown', (ev) => { peekDownOnBack = ev.target === $('peekBack') && performance.now() - peekOpenedAt > 300; });
$('peekBack').addEventListener('click', (ev) => { if(ev.target === $('peekBack') && peekDownOnBack) closePeek(); peekDownOnBack = false; });

// ---- ☰ ----
function openPhoneMenu(){
  const menu = $('phoneMenu');
  $('phoneFromFmide').classList.toggle('hidden', $('btnFromFmide').classList.contains('hidden'));
  $('phonePin').textContent = pinA ? '📌 Unpin A' : '📌 Pin as A';
  $('phoneUndo').disabled = $('btnUndo').disabled;
  $('phoneRedo').disabled = $('btnRedo').disabled;
  $('phoneVibrate').classList.toggle('hidden', !canVibrate());
  $('phoneVibrate').setAttribute('aria-checked', vibrateOn ? 'true' : 'false');
  $('phoneVibrate').textContent = 'Vibrate on the marks: ' + (vibrateOn ? 'On' : 'Off');
  menu.classList.remove('hidden');
  $('btnPhoneMenu').setAttribute('aria-expanded', 'true');
}
function closePhoneMenu(){
  $('phoneMenu').classList.add('hidden');
  $('btnPhoneMenu').setAttribute('aria-expanded', 'false');
}
$('btnPhoneMenu').addEventListener('click', () => { if($('phoneMenu').classList.contains('hidden')) openPhoneMenu(); else closePhoneMenu(); });
document.addEventListener('pointerdown', (ev) => {
  if(!$('phoneMenu').classList.contains('hidden') && !ev.target.closest('#phoneMenu, #btnPhoneMenu')) closePhoneMenu();
}, true);
document.addEventListener('keydown', (ev) => {
  if(ev.key !== 'Escape') return;
  if(!$('peekBack').classList.contains('hidden')){ ev.stopPropagation(); closePeek(); }
  else if(!$('phoneMenu').classList.contains('hidden')){ ev.stopPropagation(); closePhoneMenu(); $('btnPhoneMenu').focus(); }
}, true);
const menuItem = (id, fn) => $(id).addEventListener('click', () => { closePhoneMenu(); fn(); });
const openPanel = (id) => { const p = $(id); p.open = true; p.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
menuItem('phoneOpen', () => $('btnOpen').click());
menuItem('phoneFromFmide', () => $('btnFromFmide').click());
menuItem('phoneReset', () => $('btnResetAll').click());
menuItem('phonePin', () => { if(pinA) unpinA(); else pinAsA(); });
menuItem('phoneScenarios', () => openPanel('scenariosPanel'));
menuItem('phoneMovers', () => openPanel('moversPanel'));
menuItem('phoneUndo', () => $('btnUndo').click());
menuItem('phoneRedo', () => $('btnRedo').click());
menuItem('phoneHelp', () => help.toggle());
menuItem('phoneSharePicture', () => shareBoardPicture()); // (05i-phone-share.js)
menuItem('phoneShareFile', () => shareBoardFile());
menuItem('phoneFullApp', () => setFullApp(true));
$('phoneVibrate').addEventListener('click', () => {
  vibrateOn = !vibrateOn;
  store.put(VIBRATE_KEY, vibrateOn ? '' : 'off').catch(() => {});
  closePhoneMenu();
});
$('btnPhoneLayout').addEventListener('click', () => setFullApp(false));

// The phone layout starts at the end of 05h-phone-show.js, once everything it draws is defined.
