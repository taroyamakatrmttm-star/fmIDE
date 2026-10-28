// ============================================================
// fmGraph's board page: renderBoard() builds every widget with its editing controls;
// updateValues() redraws only the numbers and bars (it runs on every slider move). The SVG of the
// bars is 05-render.js, the board engine's. Everything from the model goes in as text.
// ============================================================

let activeSlider = null;   // the slider being moved or pointed at: its reach is lit

let quietTimer = null;

let updatePending = false;

function showBoard(){
  $('welcome').classList.add('hidden');
  $('board').classList.remove('hidden');
  $('boardTabs').classList.remove('hidden');
  $('modelName').textContent = model ? model.name : '';
  syncPageState();
  renderAll();
  if(model && model.baseMs >= SLOW_MS) setCalcNote('');
}

function syncPageState(){
  document.querySelectorAll('.needs-model').forEach(b => { b.disabled = !model; });
  $('btnAttachTemplate').classList.toggle('hidden', !(model && linkedToFmide)); // G5b: only with the model from fmIDE
  if(!model){ renderDock(); renderPhoneBoards(); } // the first screen again: no dock (05g-phone.js)
}

// A <select> of rectangles, by canvas. onlyInputs: a slider's.
function rectSelect(selectedKey, onlyInputs){
  const sel = make('select');
  sel.setAttribute('aria-label', onlyInputs ? 'Input rectangle' : 'Rectangle');
  const groups = new Map();
  model.rects.forEach(r => {
    if(onlyInputs && !r.input) return;
    let g = groups.get(r.canvasId);
    if(!g){ g = make('optgroup'); g.label = r.canvasName; groups.set(r.canvasId, g); sel.appendChild(g); }
    const o = make('option', null, r.name + (r.input && !onlyInputs ? '  (input)' : ''));
    o.value = r.key;
    if(r.key === selectedKey) o.selected = true;
    g.appendChild(o);
  });
  makeSearchable(sel); // a press, Enter or a letter opens a search over it (05j-rect-search.js)
  return sel;
}

// Which periods: all, one, or a range. With `shared` ({ following, sharedText, onShared }, a bar
// or Columns chart, 05k-shared-period.js) the first choice follows the shared periods.
function periodsChooser(spec, onChange, shared){
  const wrap = make('span', 'periods-chooser');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Periods');
  if(shared){ const o = make('option', null, shared.sharedText); o.value = 'shared'; if(shared.following) o.selected = true; mode.appendChild(o); }
  [['all', 'All periods'], ['one', 'One period'], ['range', 'Periods from…']].forEach(([v, t]) => {
    const o = make('option', null, t); o.value = v; if(spec.mode === v && !(shared && shared.following)) o.selected = true; mode.appendChild(o);
  });
  const periodSelect = (value, label) => {
    const s = make('select');
    s.setAttribute('aria-label', label);
    model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(i === value) o.selected = true; s.appendChild(o); });
    return s;
  };
  const a = periodSelect(spec.mode === 'one' ? spec.p : spec.mode === 'range' ? spec.from : 0, 'Period');
  const to = make('span', null, 'to');
  const b = periodSelect(spec.mode === 'range' ? spec.to : model.periods.length - 1, 'Last period');
  const show = () => {
    a.classList.toggle('hidden', mode.value === 'all' || mode.value === 'shared');
    to.classList.toggle('hidden', mode.value !== 'range');
    b.classList.toggle('hidden', mode.value !== 'range');
  };
  const changed = () => {
    show();
    const m = mode.value;
    if(m === 'shared'){ shared.onShared(); return; }
    onChange(m === 'all' ? { mode: 'all' } : m === 'one' ? { mode: 'one', p: Number(a.value) } : { mode: 'range', from: Number(a.value), to: Number(b.value) });
  };
  [mode, a, b].forEach(el => el.addEventListener('change', changed));
  wrap.append(mode, a, to, b);
  show();
  return wrap;
}

// A colour box (the shared colour grid opens from it, 09-start.js); onChange gets '#rrggbb';
// automatic (optional, automaticColour) gives the grid its Automatic swatch.
function colourPicker(value, label, onChange, automatic){
  const c = make('input', 'colour-pick');
  c.type = 'color';
  c.value = cleanColour(value) || DEFAULT_BAR_COLOUR;
  c.title = label;
  c.setAttribute('aria-label', label);
  c.addEventListener('change', () => { const v = cleanColour(c.value); if(v) onChange(v); });
  if(automatic) c.colourAutomatic = automatic;
  return c;
}

function redrawColours(){ saveBoardSoon(); renderBoard(); }

function removeButton(id, what){
  const x = make('button', 'widget-remove', '×');
  x.type = 'button';
  x.title = 'Remove this ' + what;
  x.setAttribute('aria-label', 'Remove this ' + what);
  x.addEventListener('click', () => { removeWidget(id); renderBoard(); });
  return x;
}

function renderBoard(){
  syncSharedPeriods(); // what follows the shared period takes it (05k-shared-period.js)
  syncCommonScale(); // and the common scale (04d-scale.js)
  adoptWidgetColours(); // an older file's colours, taken in (04e-colours.js)
  forgetAutoColours();
  rememberOpenEditors(); // (05b-chart-render.js)
  rememberOpenRanges();
  // A slider's From / to / step box being typed in keeps the focus through the redraw.
  const was = document.activeElement;
  const typing = was && was.dataset && was.dataset.range && was.closest('.slider-widget')
    ? { id: was.closest('.slider-widget').dataset.id, which: was.dataset.range } : null;
  syncShared(); // slider positions shared with other boards (03-calc.js)
  const bars = $('barList'), sliders = $('sliderList');
  bars.textContent = '';
  sliders.textContent = '';
  if(!model) return;
  board.sliders.forEach(s => sliders.appendChild(sliderWidget(s)));
  board.items.forEach(w => {
    const el = w.kind === 'chart' ? chartWidget(w) : barWidget(w);
    el.classList.toggle('wide', !!w.wide);
    const head = el.querySelector('.widget-head');
    head.prepend(arrangeControls(w, el));
    head.insertBefore(traceButton(w), head.querySelector('.widget-remove')); // Trace (05d-explore.js)
    head.insertBefore(fullScreenButton(w), head.querySelector('.widget-remove')); // ⛶ (05h-phone-show.js)
    head.insertBefore(gifButton(w), head.querySelector('.widget-remove')); // 🎞 a GIF of the play (05o-play-gif.js)
    bars.appendChild(el);
  });
  board.sliders.forEach(s => { const el = sliders.querySelector('.slider-widget[data-id="' + s.id + '"]'); if(el) el.querySelector('.widget-head').prepend(arrangeControls(s, el)); });
  $('noBars').classList.toggle('hidden', board.items.length > 0);
  $('noSliders').classList.toggle('hidden', board.sliders.length > 0);
  syncFoldAll(); // (05c-arrange.js)
  renderSharing(); // (05c-arrange.js)
  renderTraceNote();
  renderScenarios(); // (05f-scenarios.js)
  renderGoalSeek(); // (05l-goal-seek.js)
  updateValues();
  renderDock(); // on a phone, the sliders' dock (05g-phone.js)
  if(typing){
    const w = [...sliders.querySelectorAll('.slider-widget')].find(el => el.dataset.id === typing.id);
    const box = w && w.querySelector('input[data-range="' + typing.which + '"]');
    if(box){ box.focus(); box.select(); }
  }
}

// The sliders whose Range and step is open: kept open through a redraw (the page's own, not saved).
const slidersRanging = new Set();

function rememberOpenRanges(){
  document.querySelectorAll('#sliderList .slider-widget').forEach(el => {
    const box = el.querySelector('details.slider-range');
    if(!box) return;
    if(box.open) slidersRanging.add(el.dataset.id); else slidersRanging.delete(el.dataset.id);
  });
}

function barWidget(b){
  const w = make('div', 'widget bar-widget');
  w.dataset.id = b.id;
  const head = make('div', 'widget-head');
  const sel = rectSelect(b.key, false);
  sel.addEventListener('change', () => { b.key = sel.value; saveBoardSoon(); renderBoard(); });
  head.append(sel, make('span', 'widget-title phone-only', model.byKey.get(b.key).name), removeButton(b.id, 'bar'));
  // On a phone, holding the bar opens its quick look (05g-phone.js).
  w.addEventListener('pointerdown', (ev) => phoneBarPress(ev, b));
  w.addEventListener('contextmenu', (ev) => { if(isPhone()) ev.preventDefault(); });
  const row = make('div', 'widget-row bar-settings');
  row.appendChild(widgetPeriodsChooser(b)); // its own periods, or the shared ones (05k-shared-period.js)
  // The rectangle's colour, shared by its slider and every chart (04e-colours.js).
  row.appendChild(colourPicker(shownColour(b.key), 'Bar colour', (c) => { chooseRectColour(b.key, c); saveBoardSoon(); renderBoard(); }, automaticColour(b.key, DEFAULT_BAR_COLOUR, redrawColours)));
  row.appendChild(scaleChooser(b, () => { saveBoardSoon(); updateValues(); })); // (04d-scale.js)
  const rect = model.byKey.get(b.key);
  w.append(head, row);
  if(rect.unit) w.appendChild(make('div', 'widget-unit', 'In ' + rect.unit));
  const chart = make('div', 'bar-chart-host');
  const errs = make('ul', 'bar-errors');
  w.append(chart, errs);
  return w;
}

function sliderWidget(s){
  const rect = model.byKey.get(s.key);
  const w = make('div', 'widget slider-widget' + (s.folded ? ' folded' : ''));
  w.dataset.id = s.id;
  const head = make('div', 'widget-head');
  const sel = rectSelect(s.key, true);
  sel.addEventListener('change', () => {
    s.key = sel.value;
    s.value = null;
    Object.assign(s, defaultRange(model.byKey.get(s.key), s.periods, s.mode));
    saveBoardSoon(); renderBoard();
  });
  // Its rectangle's colour, as its bars and charts show it; picking it here changes them too (04e-colours.js).
  const colour = colourPicker(shownColour(s.key), 'Colour of ' + rect.name, (c) => { chooseRectColour(s.key, c); saveBoardSoon(); renderBoard(); }, automaticColour(s.key, DEFAULT_BAR_COLOUR, redrawColours));
  colour.classList.add('slider-colour');
  w.style.setProperty('--rect-colour', shownColour(s.key));
  head.append(sel, colour, foldButton(s), removeButton(s.id, 'slider')); // (05c-arrange.js)

  const row = make('div', 'widget-row slider-more');
  row.appendChild(periodsChooser(s.periods, (p) => {
    s.periods = p;
    if(s.mode === 'set' && s.value === null) Object.assign(s, defaultRange(rect, p, 'set'));
    saveBoardSoon(); renderBoard();
  }));
  const modeRow = make('div', 'widget-row slider-more');
  const mode = make('select');
  mode.setAttribute('aria-label', 'What the slider does');
  [['set', 'Set the number to'], ['shift', 'Change it by %']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; if(s.mode === v) o.selected = true; mode.appendChild(o); });
  mode.addEventListener('change', () => {
    s.mode = mode.value === 'shift' ? 'shift' : 'set';
    s.value = null;
    Object.assign(s, defaultRange(rect, s.periods, s.mode));
    saveBoardSoon(); renderBoard();
  });
  modeRow.appendChild(mode);

  const track = make('div', 'slider-track');
  const range = make('input');
  range.type = 'range';
  range.min = String(s.min); range.max = String(s.max); range.step = String(s.step);
  range.value = String(sliderShown(s));
  range.setAttribute('aria-label', rect.name);
  const box = make('input', 'slider-value');
  box.type = 'number';
  box.step = 'any';
  box.value = String(sliderShown(s));
  box.setAttribute('aria-label', rect.name + ' (number)');
  range.addEventListener('input', () => { moveSlider(s, Number(range.value)); box.value = range.value; });
  box.addEventListener('change', () => {
    const v = Number(box.value);
    if(box.value.trim() === '' || !isFinite(v)){ box.value = String(sliderShown(s)); return; }
    moveSlider(s, v);
    range.value = String(v);
  });
  track.append(range, box);
  if(s.mode === 'shift') track.appendChild(make('span', null, '%'));
  const baseLine = make('div', 'slider-base slider-more');
  const reset = make('button', null, 'Reset');
  reset.type = 'button';
  reset.title = 'Back to the model\'s own number';
  reset.addEventListener('click', () => { s.value = null; range.value = box.value = String(sliderShown(s)); scheduleUpdate(); });

  const more = make('details', 'slider-range slider-more');
  more.open = slidersRanging.has(s.id);
  more.appendChild(make('summary', null, 'Range and step'));
  const rangeRow = make('div', 'widget-row');
  const num = (label, value, which) => {
    const l = make('label', null, label + ' ');
    const i = make('input'); i.type = 'number'; i.step = 'any'; i.value = String(value);
    i.dataset.range = which;
    l.appendChild(i); rangeRow.appendChild(l);
    return i;
  };
  const minBox = num('From', s.min, 'min'), maxBox = num('to', s.max, 'max'), stepBox = num('step', s.step, 'step');
  const rangeChanged = () => {
    const r = cleanRange({ min: minBox.value, max: maxBox.value, step: stepBox.value }, null);
    if(!r){ notify('A range needs a "from" below its "to", and a step above 0.', 'err', 'range'); return; }
    notify('', null, 'range');
    Object.assign(s, r);
    saveBoardSoon();
    // Redrawn once the focus has moved (Tab, or a click in the next box), so it stays there.
    setTimeout(renderBoard, 0);
  };
  [minBox, maxBox, stepBox].forEach(i => i.addEventListener('change', rangeChanged));
  more.appendChild(rangeRow);

  const foot = make('div', 'widget-row slider-more');
  foot.append(reset);
  w.append(head, row, modeRow, track, baseLine, more, foot);

  // Its reach lights up while it is pointed at, moved or focused.
  const light = () => setActiveSlider(s.id);
  w.addEventListener('pointerenter', light);
  w.addEventListener('pointerleave', () => { if(document.activeElement && w.contains(document.activeElement) && document.activeElement !== range) return; quietSoon(0); });
  range.addEventListener('focus', light);
  range.addEventListener('blur', () => quietSoon(0));
  range.addEventListener('pointerdown', () => { light(); workOutAhead(s); });
  range.addEventListener('keydown', () => { if(model.baseMs >= SLOW_MS) workOutAhead(s); });
  return w;
}

function moveSlider(s, v){
  s.value = v;
  setActiveSlider(s.id);
  quietSoon(1500);
  scheduleUpdate();
}

function scheduleUpdate(){
  if(updatePending) return;
  updatePending = true;
  requestAnimationFrame(() => { updatePending = false; updateValues(); });
}

function setActiveSlider(id){
  clearTimeout(quietTimer);
  activeSlider = id;
  paintReach();
}

function quietSoon(ms){
  clearTimeout(quietTimer);
  quietTimer = setTimeout(() => { activeSlider = null; paintReach(); }, ms);
}

function paintReach(){
  if(!model || !board) return; // (a timer after the model has gone: the first screen again)
  const s = board.sliders.find(x => x.id === activeSlider);
  const reached = s ? model.reach(s.key) : null;
  $('board').classList.toggle('moving', !!s);
  // With no slider being moved, a trace (05d-explore.js) shows instead.
  if(s || !paintTrace()) clearTracePaint();
  document.querySelectorAll('.slider-widget').forEach(el => el.classList.toggle('active', !!s && el.dataset.id === s.id));
  board.bars.forEach(b => {
    const el = document.querySelector('.bar-widget[data-id="' + b.id + '"]');
    if(el) el.classList.toggle('reached', !!reached && (reached.has(b.key) || b.key === s.key));
  });
  board.charts.forEach(c => {
    const el = document.querySelector('.chart-widget[data-id="' + c.id + '"]');
    if(el) el.classList.toggle('reached', !!reached && chartKeys(c).some(k => reached.has(k) || k === s.key));
  });
}

function updateValues(){
  if(!model) return;
  startDraw(); // whether bars glide this time (05e-compare.js)
  const results = currentResults();
  prepareCommonScale(results); // Auto for all's range on this board (04d-scale.js)
  board.bars.forEach(b => {
    const el = document.querySelector('.bar-widget[data-id="' + b.id + '"]');
    if(el) drawBars(el, b, results);
  });
  board.charts.forEach(c => {
    const el = document.querySelector('.chart-widget[data-id="' + c.id + '"]');
    if(el) drawChart(el, c, results);
  });
  board.sliders.forEach(s => {
    const el = document.querySelector('.slider-widget[data-id="' + s.id + '"]');
    if(!el) return;
    el.querySelector('.slider-base').textContent = sliderBaseText(s);
  });
  drawShow(results); // those on the whole screen (05h-phone-show.js)
  updateMovers(results);
  markScenarios(); // (05f-scenarios.js)
  paintReach();
  updateDock(); // (05g-phone.js)
}
