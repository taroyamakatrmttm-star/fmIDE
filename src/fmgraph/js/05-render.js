// ============================================================
// Drawing the board. renderBoard() builds every widget; updateValues() redraws only the
// numbers and bars (it runs on every slider move). Everything from the model (names, canvas
// and period labels) goes in as text — textContent, or SVG text nodes — never as markup.
// ============================================================
const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, text){
  const el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(k => el.setAttribute(k, String(attrs[k])));
  if(text !== undefined) el.textContent = String(text);
  return el;
}

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
  return sel;
}

// Which periods: all, one, or a range.
function periodsChooser(spec, onChange){
  const wrap = make('span', 'periods-chooser');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Periods');
  [['all', 'All periods'], ['one', 'One period'], ['range', 'Periods from…']].forEach(([v, t]) => {
    const o = make('option', null, t); o.value = v; if(spec.mode === v) o.selected = true; mode.appendChild(o);
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
    a.classList.toggle('hidden', mode.value === 'all');
    to.classList.toggle('hidden', mode.value !== 'range');
    b.classList.toggle('hidden', mode.value !== 'range');
  };
  const changed = () => {
    show();
    const m = mode.value;
    onChange(m === 'all' ? { mode: 'all' } : m === 'one' ? { mode: 'one', p: Number(a.value) } : { mode: 'range', from: Number(a.value), to: Number(b.value) });
  };
  [mode, a, b].forEach(el => el.addEventListener('change', changed));
  wrap.append(mode, a, to, b);
  show();
  return wrap;
}

// A colour box (the browser's own picker); onChange gets '#rrggbb'.
const DEFAULT_BAR_COLOUR = '#0f766e';
function colourPicker(value, label, onChange){
  const c = make('input', 'colour-pick');
  c.type = 'color';
  c.value = cleanColour(value) || DEFAULT_BAR_COLOUR;
  c.title = label;
  c.setAttribute('aria-label', label);
  c.addEventListener('change', () => { const v = cleanColour(c.value); if(v) onChange(v); });
  return c;
}

function removeButton(id, what){
  const x = make('button', 'widget-remove', '×');
  x.type = 'button';
  x.title = 'Remove this ' + what;
  x.setAttribute('aria-label', 'Remove this ' + what);
  x.addEventListener('click', () => { removeWidget(id); renderBoard(); });
  return x;
}

function renderBoard(){
  rememberOpenEditors(); // (05b-chart-render.js)
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
    bars.appendChild(el);
  });
  board.sliders.forEach(s => { const el = sliders.querySelector('.slider-widget[data-id="' + s.id + '"]'); if(el) el.querySelector('.widget-head').prepend(arrangeControls(s, el)); });
  $('noBars').classList.toggle('hidden', board.items.length > 0);
  $('noSliders').classList.toggle('hidden', board.sliders.length > 0);
  renderTraceNote();
  renderScenarios(); // (05f-scenarios.js)
  updateValues();
}

function barWidget(b){
  const w = make('div', 'widget bar-widget');
  w.dataset.id = b.id;
  const head = make('div', 'widget-head');
  const sel = rectSelect(b.key, false);
  sel.addEventListener('change', () => { b.key = sel.value; saveBoardSoon(); renderBoard(); });
  head.append(sel, removeButton(b.id, 'bar'));
  const row = make('div', 'widget-row');
  row.appendChild(periodsChooser(b.periods, (p) => { b.periods = p; saveBoardSoon(); updateValues(); }));
  row.appendChild(colourPicker(b.colour || DEFAULT_BAR_COLOUR, 'Bar colour', (c) => { b.colour = c === DEFAULT_BAR_COLOUR ? null : c; saveBoardSoon(); updateValues(); }));
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
  const w = make('div', 'widget slider-widget');
  w.dataset.id = s.id;
  const head = make('div', 'widget-head');
  const sel = rectSelect(s.key, true);
  sel.addEventListener('change', () => {
    s.key = sel.value;
    s.value = null;
    Object.assign(s, defaultRange(model.byKey.get(s.key), s.periods, s.mode));
    saveBoardSoon(); renderBoard();
  });
  head.append(sel, removeButton(s.id, 'slider'));

  const row = make('div', 'widget-row');
  row.appendChild(periodsChooser(s.periods, (p) => {
    s.periods = p;
    if(s.mode === 'set' && s.value === null) Object.assign(s, defaultRange(rect, p, 'set'));
    saveBoardSoon(); renderBoard();
  }));
  const modeRow = make('div', 'widget-row');
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
  const baseLine = make('div', 'slider-base');
  const reset = make('button', null, 'Reset');
  reset.type = 'button';
  reset.title = 'Back to the model\'s own number';
  reset.addEventListener('click', () => { s.value = null; range.value = box.value = String(sliderShown(s)); scheduleUpdate(); });

  const more = make('details', 'slider-range');
  more.appendChild(make('summary', null, 'Range and step'));
  const rangeRow = make('div', 'widget-row');
  const num = (label, value) => {
    const l = make('label', null, label + ' ');
    const i = make('input'); i.type = 'number'; i.step = 'any'; i.value = String(value);
    l.appendChild(i); rangeRow.appendChild(l);
    return i;
  };
  const minBox = num('From', s.min), maxBox = num('to', s.max), stepBox = num('step', s.step);
  const rangeChanged = () => {
    const r = cleanRange({ min: minBox.value, max: maxBox.value, step: stepBox.value }, null);
    if(!r){ notify('A range needs a "from" below its "to", and a step above 0.', 'err', 'range'); return; }
    notify('', null, 'range');
    Object.assign(s, r);
    saveBoardSoon(); renderBoard();
  };
  [minBox, maxBox, stepBox].forEach(i => i.addEventListener('change', rangeChanged));
  more.appendChild(rangeRow);

  const foot = make('div', 'widget-row');
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

// What a slider shows: its value, or where the model's own number sits.
function sliderShown(s){
  if(s.value !== null) return s.value;
  if(s.mode === 'shift') return 0;
  return baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
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
    const rect = model.byKey.get(s.key);
    const ps = periodsOf(s.periods);
    const first = ps[0] || 0, last = ps[ps.length - 1] || 0;
    const same = ps.every(p => baseValue(rect, p) === baseValue(rect, first));
    el.querySelector('.slider-base').textContent = same
      ? 'Model\'s number: ' + fmtNum(baseValue(rect, first))
      : 'Model\'s numbers: ' + fmtNum(baseValue(rect, first)) + ' (' + model.periods[first] + ') to ' + fmtNum(baseValue(rect, last)) + ' (' + model.periods[last] + ')';
  });
  updateMovers(results);
  markScenarios(); // (05f-scenarios.js)
  paintReach();
}

// One bar per period, the model's own value as a dashed outline behind it.
function drawBars(el, b, results){
  const rect = model.byKey.get(b.key);
  const ps = periodsOf(b.periods);
  const now = ps.map(p => resultOf(results, rect, p));
  const base = ps.map(p => resultOf(compareResults(), rect, p)); // A, or the model's own numbers (05e-compare.js)
  const nums = [];
  now.concat(base).forEach(r => { if(!r.error) nums.push(r.value); });
  let lo = Math.min(0, ...nums), hi = Math.max(0, ...nums);
  if(hi === lo) hi = lo + 1;
  // Room above for the labels of bars going up, and below for those of bars going down.
  const n = Math.max(1, ps.length), labels = n <= 8;
  const W = 300, top = hi > 0 && labels ? 34 : 12, bottom = 22 + (lo < 0 && labels ? 30 : 0), H = 130 + top + bottom;
  const plotH = H - top - bottom;
  const y = (v) => top + (hi - v) / (hi - lo) * plotH;
  const slot = (W - 8) / n, bw = Math.max(3, Math.min(46, slot * 0.62));
  const chart = svg('svg', { class: 'bar-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', rect.name);
  chart.appendChild(svg('line', { class: 'b-zero', x1: 0, x2: W, y1: y(0), y2: y(0) }));
  const problems = new Map();
  ps.forEach((p, i) => {
    const cx = 4 + slot * i + slot / 2, x = cx - bw / 2;
    const g = svg('g', { class: 'b-period', 'data-period': p });
    const r = now[i], was = base[i];
    if(r.error){
      g.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
      g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
      problems.set(r.error, (problems.get(r.error) || []).concat([model.periods[p]]));
      g.appendChild(svg('title', {}, model.periods[p] + ': ' + errorText(r.error)));
    } else {
      const y0 = y(0), y1 = y(r.value);
      const bar = animKey(svg('rect', { class: 'b-now' + (r.value < 0 ? ' neg' : ''), x, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)) }), b.id + '|' + p);
      if(b.colour) bar.style.fill = b.colour; // a style, so the page's usual bar colour doesn't paint over it
      g.appendChild(bar);
      if(!was.error && was.value !== r.value){
        const yb = y(was.value);
        g.appendChild(svg('rect', { class: 'b-base', x, y: Math.min(y0, yb), width: bw, height: Math.max(1, Math.abs(yb - y0)) }));
      }
      const diff = was.error ? '' : fmtDiff(r.value, was.value);
      const textY = r.value >= 0 ? Math.min(y0, y1) - 4 : Math.max(y0, y1) + 12;
      if(labels){
        g.appendChild(svg('text', { class: 't-value', x: cx, y: textY, 'text-anchor': 'middle' }, fmtNum(r.value)));
        if(diff) g.appendChild(svg('text', { class: 't-diff ' + (r.value > was.value ? 'up' : 'down'), x: cx, y: r.value >= 0 ? textY - 13 : textY + 13, 'text-anchor': 'middle' }, diff.split(' ')[0]));
      }
      g.appendChild(svg('title', {}, model.periods[p] + ': ' + fmtNum(r.value) + (diff ? ' — was ' + fmtNum(was.value) + ', ' + diff : '')));
    }
    if(labels || i === 0 || i === n - 1) g.appendChild(svg('text', { class: 't-period', x: cx, y: H - 6, 'text-anchor': 'middle' }, model.periods[p]));
    chart.appendChild(g);
  });
  const host = el.querySelector('.bar-chart-host');
  host.textContent = '';
  host.appendChild(chart);
  glide(host);
  const list = el.querySelector('.bar-errors');
  list.textContent = '';
  problems.forEach((periods, code) => list.appendChild(make('li', null, periods.join(', ') + ': ' + errorText(code))));
}
