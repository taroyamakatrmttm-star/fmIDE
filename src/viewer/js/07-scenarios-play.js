// ============================================================
// Scenarios, Play, Reset, A/B, Trace and Biggest movers on the Board (phase V2). The numbers
// are the board engine's (scenarioResults, startPlay, pinA, traceOf, biggestMovers); this is
// how a visitor uses them.
// - A scenario is shown exactly, the inputs it changes with no slider on this board included
//   (the numbers looked at, `lookingAt`, 03-calc.js), with the sliders where it has them.
//   Moving a slider leaves it: the numbers are then the model's own plus the sliders, and a line
//   says what the scenario changed that has no slider here (the owner's choice 3 of phase V2;
//   it is also the rule the Excel download follows, phase V4).
// - Base is the model's own numbers: every slider back, no scenario.
// ============================================================

// ---- the scenario row ----
function renderScenarioRow(){
  const row = $('scenarioRow');
  row.textContent = '';
  row.classList.toggle('hidden', !scenarios.length);
  if(!scenarios.length) return;
  const button = (label, name, title) => {
    const b = make('button', 'scenario-btn', label);
    b.type = 'button';
    b.dataset.name = name;
    b.title = title;
    b.addEventListener('click', () => { if(name === '') showBase(); else showScenarioExact(findScenario(name)); });
    row.appendChild(b);
  };
  button('Base', '', 'The model\'s own numbers');
  scenarios.forEach(sc => button(sc.name, sc.name, scenarioLabel(sc.name, sc.settings)));
}
// Which button is on: the scenario shown, else one the sliders happen to match, else Base when
// no slider is moved.
function currentScenario(){
  if(shownScenario) return shownScenario;
  if(!slidersNow().length) return '';
  const sc = scenarios.find(x => scenarioShown(x));
  return sc ? sc.name : null;
}
function markScenarioRow(){
  const now = currentScenario();
  document.querySelectorAll('#scenarioRow .scenario-btn').forEach(b => {
    const on = now !== null && b.dataset.name === now;
    b.classList.toggle('current', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// Shows scenario sc exactly: its numbers, the sliders where it has them.
function showScenarioExact(sc){
  if(playing) stopPlay();
  const left = sc.settings.slice();
  liveSliders().forEach(s => {
    const i = left.findIndex(o => settingKey(o) === settingKey(s));
    s.value = i >= 0 ? left.splice(i, 1)[0].value : null;
  });
  shownScenario = sc.name;
  lookingAt = { overrides: overridesFor(sc.settings), label: sc.name };
  scenarioNote('');
  renderBoard();
  saveStateSoon();
  return sc.name;
}
function showBase(){
  if(playing) stopPlay();
  boards.forEach(b => b.sliders.forEach(s => { s.value = null; }));
  shownScenario = null;
  lookingAt = null;
  scenarioNote('');
  renderBoard();
  saveStateSoon();
}
// A slider moved while a scenario is shown: the numbers become the sliders' own.
function leaveScenario(){
  const sc = scenarios.find(x => x.name === shownScenario);
  shownScenario = null;
  lookingAt = null;
  if(!sc) return;
  const here = new Set(liveSliders().map(settingKey));
  const names = [...new Set(sc.settings.filter(s => !here.has(settingKey(s))).map(s => model.byKey.get(s.key).name))];
  scenarioNote(names.length ? 'Leaving “' + sc.name + '”: its change to ' + names.join(', ') + ' has no slider here, so the model\'s own number is back.' : '');
}
function scenarioNote(text){ const n = $('scenarioNote'); n.textContent = text; n.classList.toggle('hidden', !text); }

// Reset: every slider on the model's own numbers, no scenario, and nothing kept on this device.
function resetAll(){
  if(!model || !board) return;
  if(playing) stopPlay();
  boards.forEach(b => b.sliders.forEach(s => { s.value = null; }));
  shownScenario = null;
  lookingAt = null;
  scenarioNote('');
  forgetState();
  renderBoard();
}

// ---- A/B ----
function pinNow(){
  if(!model || !board) return null;
  if(shownScenario) return compareWithScenario(findScenario(shownScenario)); // its exact numbers
  return pinAsA();
}
function renderCompareBar(){
  const bar = $('compareBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !pinA || !model);
  $('btnPinA').setAttribute('aria-pressed', pinA ? 'true' : 'false');
  if(!pinA || !model) return;
  bar.appendChild(make('span', 'compare-mark', 'A'));
  const text = make('span', 'compare-text');
  text.appendChild(make('strong', null, 'Comparing with A: '));
  text.appendChild(document.createTextNode(pinA.label));
  bar.appendChild(text);
  const button = (label, title, fn) => { const b = make('button', 'compare-btn', label); b.type = 'button'; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); return b; };
  button('⇄ Swap', 'Put the sliders where A had them, and keep where they are now as A', () => swapNow());
  button('Unpin', 'Compare with the model\'s own numbers again', () => unpinA());
}
function swapNow(){
  if(!pinA) return null;
  if(shownScenario){ shownScenario = null; lookingAt = null; }
  const r = swapWithA();
  saveStateSoon();
  return r;
}

// ---- Play ----
// The ends offered: Base, each scenario, my sliders.
function playEndWords(id){
  if(id === 'model') return 'Base';
  if(id === 'sliders') return 'My sliders';
  return id.slice(3);
}
// The showcase's ends ("Base" or a scenario's name), once, until the visitor picks.
let playFromShowcase = null;
function renderPlayRow(){
  const row = $('playRow');
  const options = playOptions(), ids = options.map(o => o[0]);
  row.classList.toggle('hidden', !board || !(board.sliders.length || scenarios.length));
  const want = (name) => !name ? null : /^base$/i.test(name) ? 'model' : (scenarios.find(s => sameName(s.name, name)) ? 'sc:' + scenarios.find(s => sameName(s.name, name)).name : null);
  let def = playDefaults();
  if(playFromShowcase){
    const f = want(playFromShowcase.from), t = want(playFromShowcase.to);
    if(f && t && f !== t) def = { from: f, to: t };
  }
  if(!playChoice.picked || !ids.includes(playChoice.from)) playChoice.from = def.from;
  if(!playChoice.picked || !ids.includes(playChoice.to)) playChoice.to = def.to;
  [['playFrom', 'from'], ['playTo', 'to']].forEach(([id, end]) => {
    const sel = $(id);
    sel.textContent = '';
    options.forEach(([v]) => { const o = make('option', null, playEndWords(v)); o.value = v; sel.appendChild(o); });
    sel.value = playChoice[end];
  });
}
// The strip while it plays: what plays, where it is, ■ Stop (and ⇄ with reduced motion).
function renderPlayBar(){
  const bar = $('playBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !playing);
  $('board').classList.toggle('playing', !!playing);
  // ⬇ Excel is off while Play runs, however Play was started or stopped (a button, a key,
  // fmViewer.play): its line follows at once, not only after the visitor's next click.
  if(typeof refreshExcel === 'function') setTimeout(refreshExcel, 0);
  if(!playing) return;
  if(lookingAt){ lookingAt = null; shownScenario = null; } // Play shows its own numbers
  const from = playEndWords(playing.from.id), to = playEndWords(playing.to.id);
  const text = make('span', 'play-text');
  const words = make('strong', 'play-words');
  words.setAttribute('aria-live', 'polite');
  if(playing.still){
    const at = playing.index === 0 ? from : to;
    words.textContent = 'Showing ' + at + '; the outlines show ' + from;
  } else words.textContent = 'Playing ' + from + ' ⇄ ' + to;
  text.appendChild(words);
  const now = make('span', 'play-at');
  now.id = 'playAt';
  text.appendChild(now);
  bar.appendChild(text);
  const button = (label, title, fn) => { const b = make('button', 'compare-btn', label); b.type = 'button'; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); return b; };
  if(playing.still) button('⇄', 'Step to the other end', () => stepPlay()).id = 'btnPlayStep';
  button('■ Stop', 'Stop playing: everything goes back as it was', () => stopPlay()).id = 'btnPlayStop';
}
// The sliders and the reach, f of the way between the ends.
function paintPlay(f){
  board.sliders.forEach(s => {
    const a = endSliderValue(playing.from.settings, s), b = endSliderValue(playing.to.settings, s);
    let v = mixAt(a, b, f);
    if(f !== 0 && f !== 1) v = roundToStep(v, s.step);
    const el = document.querySelector('.slider-widget[data-id="' + s.id + '"]');
    if(el) el.classList.toggle('playing', !Object.is(a, b));
    const ctl = sliderControls.get(s.id);
    if(ctl && !ctl.dragging()) ctl.setValue(v);
  });
  const reached = new Set(playing.moving);
  playing.moving.forEach(k => model.reach(k).forEach(r => reached.add(r)));
  $('board').classList.add('moving');
  board.items.forEach(w => {
    const el = document.querySelector('#barList > .widget[data-id="' + w.id + '"]');
    if(!el) return;
    el.classList.toggle('reached', itemKeys(w).some(k => reached.has(k)));
    if(w.kind === 'chart') el.classList.toggle('play-held', isSensitivity(w));
  });
  const at = $('playAt');
  if(at) at.textContent = settingsLabel(movingSettings(f));
}

// ---- Trace ----
function setTrace(id){
  traceId = id && board && board.items.some(w => w.id === id) ? id : null;
  document.querySelectorAll('.widget-trace').forEach(b => {
    const el = b.closest('.widget');
    b.setAttribute('aria-pressed', el && el.dataset.id === traceId ? 'true' : 'false');
  });
  renderTraceNote();
  paintReach();
  return traceId;
}
// The note under a traced bar or chart: each slider's way there, and the inputs with no slider.
function renderTraceNote(){
  document.querySelectorAll('.trace-note').forEach(n => n.remove());
  if(!traceId || !model || !board) return;
  const w = board.items.find(x => x.id === traceId);
  const el = w && document.querySelector('#barList > .widget[data-id="' + traceId + '"]');
  if(!el){ traceId = null; return; }
  const t = traceOf(w);
  const note = make('div', 'trace-note');
  note.setAttribute('role', 'status');
  const head = make('div', 'trace-head');
  head.appendChild(make('strong', null, 'What reaches this'));
  const x = make('button', 'trace-close', '×');
  x.type = 'button';
  x.title = 'Stop tracing (Esc)';
  x.setAttribute('aria-label', 'Stop tracing');
  x.addEventListener('click', () => setTrace(null));
  head.appendChild(x);
  note.appendChild(head);
  if(t.sliders.length){
    const list = make('ul', 'trace-paths');
    t.sliders.forEach(s => { const li = make('li', null, s.path.join(' → ')); li.dataset.slider = s.id; list.appendChild(li); });
    note.appendChild(list);
  } else note.appendChild(make('p', 'trace-none', 'No slider on this board reaches it.'));
  if(t.inputs.length){
    note.appendChild(make('p', 'trace-sub', 'Inputs that reach it, with no slider here:'));
    const list = make('ul', 'trace-inputs');
    t.inputs.slice(0, TRACE_INPUTS_SHOWN).forEach(r => { const li = make('li'); li.append(make('span', null, r.name), make('span', 'trace-canvas', r.canvas)); list.appendChild(li); });
    note.appendChild(list);
    if(t.inputs.length > TRACE_INPUTS_SHOWN) note.appendChild(make('p', 'trace-sub', 'and ' + (t.inputs.length - TRACE_INPUTS_SHOWN) + ' more.'));
  } else if(!t.sliders.length) note.appendChild(make('p', 'trace-sub', 'No input reaches it: it is worked out from numbers that are not inputs.'));
  el.querySelector('.widget-head').after(note);
}

// ---- Biggest movers (folded away) ----
function updateMovers(results){
  const panel = $('moversPanel');
  if(!panel.open || !model || playNow()) return; // waits while Play runs
  const list = $('moversList');
  const movers = biggestMovers(results, MOVERS_SHOWN);
  list.textContent = '';
  $('moversEmpty').classList.toggle('hidden', movers.length > 0);
  movers.forEach(m => {
    const li = make('li', 'mover');
    li.dataset.key = m.rect.key;
    const top = make('div', 'mover-top');
    top.append(make('span', 'mover-name', m.rect.name), make('span', 'mover-where', m.rect.canvasName + ' · ' + model.periods[m.p]));
    li.append(top, make('div', 'mover-change ' + (m.now.error || m.was.error ? 'err' : (m.now.value > m.was.value ? 'up' : 'down')), moverText(m)));
    list.appendChild(li);
  });
}
