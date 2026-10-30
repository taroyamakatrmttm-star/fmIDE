// ============================================================
// The Board (phase V2): the bars and charts the author chose, with their sliders, drawn by
// fmGraph's board engine (taken in by 01-core.js). This file is the engine's page here: the
// page interface it asks for (renderBoard, updateValues, scheduleUpdate, isPhone, a key's
// swatch, freeGridHook, …: .claude/rules/fmgraph.md), the widgets' frames, the sliders and the
// board tabs. Nothing here edits a board: a visitor moves a slider within the author's range,
// and that is all (the range, the widgets and their order are the author's).
//
// The DOM uses fmGraph's class names and data-id (.widget, .bar-widget, .chart-widget,
// .slider-widget, .bar-chart-host, .chart-key, .bar-errors, #board, #barList), so the
// engine's painting of reach, Trace and Play works here unchanged.
// ============================================================

// The board engine's globals (model, boards, board, scenarios, …) hold the Board's state;
// these are the page's own.
const sliderControls = new Map(); // slider id → its shared phone slider ({ el, setValue, … })
let activeSlider = null;          // the slider being moved: its reach is lit
let quietTimer = null;
let updatePending = false;
let shownScenario = null;         // the scenario shown exactly (its name), or null: Base or my sliders
let boardsShown = false;          // whether this model has a Board

// ---- the page interface ----
function isPhone(){ return onPhone; }
function freeGridHook(){ /* no grid: a visitor doesn't move a Free chart's pieces */ }
// A key's swatch: a plain mark in the rectangle's (or the chart's) colour; nothing to pick.
function keyMark(colour, label){
  const sw = make('span', 'key-swatch');
  const c = cleanColour(colour);
  if(c) sw.style.background = c;
  sw.setAttribute('aria-hidden', 'true');
  sw.title = label;
  return sw;
}
function rectKeySwatch(k, colour, label){ return keyMark(colour, label); }
function chartKeySwatch(c, prop, colour, label){ return keyMark(colour, label); }
function scheduleUpdate(){
  if(updatePending) return;
  updatePending = true;
  requestAnimationFrame(() => { updatePending = false; updateValues(); });
}
// What Play last painted (05m-play.js): a redraw is painted again.
function paintMark(){ return [board, $('sliderList').firstElementChild, $('barList').firstElementChild]; }

// ---- reading the boards ----
// The showcase's boards (or a document's own), read as fmGraph's Import boards reads a file:
// the size and depth limits, the kind, the upgrades one version at a time, a newer version
// asked about, the template form refused; then cleanBoards against this model. Resolves
// { boards, active, scenarios, sharedPeriods, colours, commonScale, dropped } or null.
async function readBoards(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const deep = fileDataProblem(raw);
  if(deep){ notify('The boards: ' + deep, 'err', 'boards'); return null; }
  if(raw.kind !== 'fmIDE-graph-board'){ notify('The showcase\'s boards aren\'t an fmGraph board file.', 'err', 'boards'); return null; }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion, newer } = upgradeFileData(data, 'fmIDE-graph-board', BOARD_FILE_FORMAT, BOARD_FILE_MIGRATIONS);
  if(newer && !(await askConfirm('Saved by a newer version', 'These boards (format version ' + fromVersion + ') were saved by a newer version of fmGraph. Show them anyway? Anything the newer version added may be left out.', 'Show Anyway'))) return null;
  if(data.form === 'template'){ notify('Those boards are for a template: they name rectangles by name, for many models.', 'err', 'boards'); return null; }
  const r = cleanBoards(data);
  if(!r) return null;
  r.boards = r.boards.filter(b => b.items.length || b.sliders.length);
  if(!r.boards.length){ notify('None of the boards\' rectangles are in this model, so there is no Board.', 'warn', 'boards'); return null; }
  if(r.dropped) notify(r.dropped + ' bar' + (r.dropped === 1 ? '' : 's') + ', chart' + (r.dropped === 1 ? '' : 's') + ' or slider' + (r.dropped === 1 ? '' : 's') + ' left out: their rectangles aren\'t in this model.', 'warn', 'boards');
  r.active = Math.min(r.active, r.boards.length - 1);
  return r;
}

// Takes in boards read by readBoards (r) for the model built from `system`, or none.
function useBoards(r){
  sliderControls.clear();
  shownScenario = null;
  lookingAt = null;
  if(playing) stopPlay();
  pinA = null; forgetGeometry(); traceId = null;
  playChoice = { from: null, to: null, picked: false };
  clearResultCache(); resetSharedValues();
  if(!r){ boards = []; board = null; scenarios = []; boardsShown = false; return; }
  boards = r.boards;
  board = boards[r.active] || boards[0];
  scenarios = r.scenarios;
  sharedPeriods = r.sharedPeriods;
  commonScale = r.commonScale;
  rectColours = r.colours; forgetAutoColours();
  adoptWidgetColours();
  boardsShown = true;
}

// The showcase's periods, when it names them, are the boards' shared periods: bars, Columns and
// Lines show that range, the one-period charts (and the Logic view) its first (the owner's
// choice 4 of phase V2). A bar or chart the author gave its own periods keeps them.
function applyShowcasePeriods(periods){
  if(!boardsShown || !periods || !periods.length) return;
  const from = periods[0], to = periods[periods.length - 1];
  sharedPeriods = { periods: from === 0 && to === model.periods.length - 1 ? { mode: 'all' } : { mode: 'range', from, to }, period: from };
}

// ---- drawing ----
function renderBoard(){
  if(!model || !board) return;
  syncSharedPeriods(); // what follows the shared period takes it (05k-shared-period.js)
  syncCommonScale();   // and the common scale (04d-scale.js)
  forgetAutoColours();
  syncShared();        // slider positions shared with other boards (03-calc.js)
  renderBoardTabs();
  const bars = $('barList'), sliders = $('sliderList');
  bars.textContent = ''; sliders.textContent = '';
  sliderControls.clear();
  board.sliders.forEach(s => sliders.appendChild(sliderWidget(s)));
  board.items.forEach(w => {
    const el = w.kind === 'chart' ? chartFrame(w) : barFrame(w);
    el.classList.toggle('wide', !!w.wide);
    bars.appendChild(el);
  });
  $('noBars').classList.toggle('hidden', board.items.length > 0);
  sliders.classList.toggle('hidden', board.sliders.length === 0);
  renderScenarioRow();
  renderPlayRow();
  renderTraceNote();
  renderCompareBar();
  updateValues();
}

function renderBoardTabs(){
  const tabs = $('boardTabs');
  tabs.textContent = '';
  tabs.classList.toggle('hidden', boards.length < 2);
  if(boards.length < 2) return;
  boards.forEach((b, i) => {
    const t = make('button', 'board-tab', b.name);
    t.type = 'button';
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', b === board ? 'true' : 'false');
    t.addEventListener('click', () => showBoardAt(i));
    tabs.appendChild(t);
  });
}
function showBoardAt(i){
  const b = boards[i];
  if(!b || b === board) return false;
  board = b;
  if(traceId && !board.items.some(w => w.id === traceId)) traceId = null;
  renderBoard();
  saveStateSoon();
  return true;
}

// The frame of a bar: its rectangle's name and unit, the drawing (drawBars), its problems.
function barFrame(b){
  const rect = model.byKey.get(b.key);
  const w = make('div', 'widget bar-widget');
  w.dataset.id = b.id;
  const head = make('div', 'widget-head');
  // Its title opens its card (phase V6, 04-card.js): its value in each period, how it is worked out.
  const title = make('button', 'widget-title bar-card-open', rect ? rect.name : '');
  title.type = 'button';
  title.title = 'How it is worked out';
  title.addEventListener('click', () => openBarCard(b.id));
  head.append(title, traceButton(b));
  w.appendChild(head);
  if(rect && rect.unit) w.appendChild(make('div', 'widget-unit', 'In ' + rect.unit));
  w.append(make('div', 'bar-chart-host'), make('ul', 'bar-errors'));
  return w;
}
const LAYOUT_NAMES = { columns: 'Columns', flow: 'Waterfall', lines: 'Lines', free: 'Free chart', scenarios: 'Scenarios', tornado: 'Tornado', spider: 'Spider' };
// The frame of a chart: its title, the drawing (drawChart), its key, its problems.
function chartFrame(c){
  const w = make('div', 'widget chart-widget');
  w.dataset.id = c.id;
  w.dataset.layout = c.layout;
  const head = make('div', 'widget-head');
  head.append(make('span', 'widget-title', c.title || LAYOUT_NAMES[c.layout] || 'Chart'), traceButton(c));
  w.append(head, make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
  return w;
}
function traceButton(w){
  const t = make('button', 'widget-trace', '🔍');
  t.type = 'button';
  const label = 'Trace: what reaches this ' + (w.kind === 'chart' ? 'chart' : 'bar');
  t.title = label;
  t.setAttribute('aria-label', label);
  t.setAttribute('aria-pressed', traceId === w.id ? 'true' : 'false');
  t.addEventListener('click', () => setTrace(traceId === w.id ? null : w.id));
  return t;
}

// ---- the sliders ----
// Where a slider stands at the model's own number, and how its number reads.
function sliderBase(s){ return s.mode === 'shift' ? 0 : baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0); }
function sliderText(s, v){ return s.mode === 'shift' ? (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v)) + '%' : fmtNum(v); }
// The periods a slider covers, in words (nothing for all of them).
function sliderPeriodsText(spec){
  if(!spec || spec.mode === 'all') return '';
  if(spec.mode === 'one') return model.periods[spec.p] || '';
  return (model.periods[spec.from] || '') + ' to ' + (model.periods[spec.to] || '');
}
// A number kept within the slider's range and on its steps (a typed one too).
function inRange(s, v){
  const c = Math.min(s.max, Math.max(s.min, v));
  return roundToStep(s.min + Math.round((c - s.min) / s.step) * s.step, s.step);
}
function sliderWidget(s){
  const rect = model.byKey.get(s.key);
  const w = make('div', 'widget slider-widget');
  w.dataset.id = s.id;
  w.style.setProperty('--rect-colour', shownColour(s.key));
  w.style.setProperty('--slider-accent', sliderAccent(shownColour(s.key))); // the slider takes its colour (04e-colours.js)
  const head = make('div', 'slider-head');
  const stripe = make('span', 'rect-stripe');
  stripe.style.background = shownColour(s.key);
  head.append(stripe, make('span', 'slider-name', rect.name));
  const when = sliderPeriodsText(s.periods);
  if(when) head.appendChild(make('span', 'slider-when', when));
  if(rect.unit && s.mode === 'set') head.appendChild(make('span', 'slider-unit', rect.unit));
  const ctl = createPhoneSlider({
    label: rect.name, min: s.min, max: s.max, step: s.step, value: sliderShown(s), base: sliderBase(s),
    format: (v) => sliderText(s, v),
    vibrate: () => true,
    onStart: () => { setActiveSlider(s.id); workOutAhead(s); },
    onInput: (v, atBase) => {
      // A typed number stays in the author's range, on a step (the slider takes no other).
      const kept = atBase ? v : inRange(s, v);
      if(kept !== v) ctl.setValue(kept);
      moveSlider(s, kept, atBase || kept === sliderBase(s));
    },
    onEnd: () => quietSoon(1200),
  });
  sliderControls.set(s.id, ctl);
  keepThroughSwipe(s, ctl);
  w.append(head, ctl.el, make('div', 'slider-base'));
  w.addEventListener('pointerenter', () => { if(!onPhone) setActiveSlider(s.id); });
  w.addEventListener('pointerleave', () => { if(!onPhone) quietSoon(0); });
  return w;
}
// The sliders' list scrolls with a finger, even when the swipe starts on a track (its
// touch-action is pan-y, board-view.css): the browser then takes the gesture over and cancels
// the pointer. Whatever that swipe moved before the browser took it is put back — the slider's
// number, and the scenario that was shown — so scrolling never moves a slider.
function keepThroughSwipe(s, ctl){
  let before = null;
  ctl.el.addEventListener('pointerdown', (ev) => {
    before = ev.pointerType === 'mouse' ? null : { id: ev.pointerId, value: s.value, scenario: shownScenario };
  }, true);
  ctl.el.addEventListener('pointerup', (ev) => { if(before && before.id === ev.pointerId) before = null; }, true);
  ctl.el.addEventListener('pointercancel', (ev) => {
    const b = before;
    before = null;
    if(!b || b.id !== ev.pointerId || (s.value === b.value && shownScenario === b.scenario)) return;
    const sc = b.scenario && scenarios.find(x => x.name === b.scenario);
    if(sc){ showScenarioExact(sc); saveStateSoon(); return; }
    s.value = b.value;
    ctl.setValue(sliderShown(s));
    scheduleUpdate();
    saveStateSoon();
  }, true);
}
// A visitor moved slider s to v (null: back on the model's own number).
function moveSlider(s, v, atBase){
  if(shownScenario) leaveScenario();
  s.value = atBase ? null : v;
  setActiveSlider(s.id);
  quietSoon(1500);
  scheduleUpdate();
  saveStateSoon();
}
function setActiveSlider(id){ clearTimeout(quietTimer); activeSlider = id; paintReach(); }
function quietSoon(ms){ clearTimeout(quietTimer); quietTimer = setTimeout(() => { activeSlider = null; paintReach(); }, ms); }
// The bars and charts the slider being moved reaches are lit; with none, a trace shows.
function paintReach(){
  if(!model || !board) return;
  const s = board.sliders.find(x => x.id === activeSlider);
  const reached = s ? model.reach(s.key) : null;
  $('board').classList.toggle('moving', !!s);
  if(s || !paintTrace()) clearTracePaint();
  document.querySelectorAll('.slider-widget').forEach(el => el.classList.toggle('active', !!s && el.dataset.id === s.id));
  board.items.forEach(w => {
    const el = document.querySelector('#barList > .widget[data-id="' + w.id + '"]');
    if(el) el.classList.toggle('reached', !!reached && itemKeys(w).some(k => reached.has(k) || k === s.key));
  });
}

// ---- the numbers ----
// Redraws every number: the bars and charts, the sliders' words, Biggest movers, the scenario
// marks, and the Logic view's numbers (they follow the sliders).
function updateValues(){
  if(!model || !board) return;
  startDraw(); // whether bars glide this time (05e-compare.js)
  const results = currentResults();
  prepareCommonScale(results); // Auto for all's range on this board (04d-scale.js)
  board.items.forEach(w => {
    const el = document.querySelector('#barList > .widget[data-id="' + w.id + '"]');
    if(!el) return;
    if(w.kind === 'chart') drawChart(el, w, results); else drawBars(el, w, results);
  });
  board.sliders.forEach(s => {
    const el = document.querySelector('.slider-widget[data-id="' + s.id + '"]');
    if(!el) return;
    el.querySelector('.slider-base').textContent = sliderBaseText(s);
    el.title = sliderBaseText(s); // the notch shows it; the words as the row's tooltip (board-view.css)
    el.classList.toggle('moved', s.value !== null);
    const ctl = sliderControls.get(s.id);
    if(ctl && !ctl.dragging() && !playNow()) ctl.setValue(sliderShown(s));
  });
  updateMovers(results);
  markScenarioRow();
  paintReach();
  logicFollows(results);
}

// The Logic view's numbers: the shown results, and the inputs a slider or scenario moved.
function logicFollows(results){
  if(!setLogicNumbers(results)) return;
  if(!$('logic').classList.contains('hidden')){ drawShown(); if(state.card) openCard(state.card.canvasId, state.card.nodeId); }
}
// The Logic view's results and moved inputs, from the Board's numbers (results: those shown,
// or worked out here when null). The canvas and the card are the same calculation's, on the
// same model (viewModel and buildModel compile it alike, canvas by canvas in its order).
function setLogicNumbers(results){
  if(!state.vm || !model || !board) return false;
  if(model.ir.order.length !== state.vm.ir.order.length) return false; // (over the drawing's canvas limit: the model's own numbers)
  setResults(state.vm, results || currentResults());
  state.moved = movedInputs();
  return true;
}
// key → a number per period, for each input the numbers shown lay over the model and change.
function movedInputs(){
  const out = new Map();
  shownOverrides().forEach((values, k) => {
    const rect = model.byKey.get(k);
    if(rect && values.some((v, p) => !Object.is(v, baseValue(rect, p)))) out.set(k, values);
  });
  return out;
}

function wireBoard(){
  $('btnReset').addEventListener('click', () => resetAll());
  $('btnPinA').addEventListener('click', () => pinNow());
  $('btnPlay').addEventListener('click', () => startPlay(playChoice.from, playChoice.to));
  $('playFrom').addEventListener('change', () => { playChoice.from = $('playFrom').value; playChoice.picked = true; });
  $('playTo').addEventListener('change', () => { playChoice.to = $('playTo').value; playChoice.picked = true; });
  $('moversPanel').addEventListener('toggle', () => { if(model && board) updateMovers(currentResults()); });
  // Esc stops Play (and does only that); else it clears a trace.
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'Escape' || !$('confirmBox').classList.contains('hidden')) return;
    if(playing){ ev.preventDefault(); ev.stopPropagation(); stopPlay(); return; }
    if(traceId && !$('boardView').classList.contains('hidden')) setTrace(null);
  }, true);
}
