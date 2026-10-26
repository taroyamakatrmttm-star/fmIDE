// ============================================================
// A bar's or chart's vertical scale (the owner's request, 12 October 2026). Auto, as before:
// stretched to the numbers shown and always taking in zero, so it changes as a slider moves.
// Fixed: from a min to a max the person chose, so a change shows as a change in size. A
// widget's `scale` is absent or null (Auto) or { min, max } with min below max (board file
// version 5; the template form leaves it out). A number past a fixed scale is drawn to the
// edge with ▲ or ▼; its label and hover text still give the number itself. A scenario
// waterfall's fixed scale is shared by all its outputs.
// Either may give way to the common scale for every bar and chart (below, board file 12).
// ============================================================
const SCALE_LIMIT = 1e15;
const autoScales = new Map(); // widget id → { lo, hi }: what Auto would show now (Fix at current scale)

// A scale from a file, storage or a script: { min, max }, or null (Auto).
function cleanScale(raw){
  if(!raw || typeof raw !== 'object' || typeof raw.min !== 'number' || typeof raw.max !== 'number') return null;
  const { min, max } = raw;
  if(!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(min) > SCALE_LIMIT || Math.abs(max) > SCALE_LIMIT || !(min < max)) return null;
  return { min, max };
}

// Auto's range rounded outwards to two significant figures of its span: 0 to 1,234.5 → 0 to 1,300.
function niceScale(lo, hi){
  if(!(hi > lo)) return { min: lo, max: lo + 1 };
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo)) - 1);
  const r = (x) => Number(x.toPrecision(12));
  return { min: r(Math.floor(lo / step + 1e-9) * step), max: r(Math.ceil(hi / step - 1e-9) * step) };
}

// The range a widget is drawn on: its fixed scale, or Auto's. record: remember Auto's range for
// Fix at current scale (a scenario waterfall records the range of all its outputs itself).
function scaleFor(w, lo, hi, record){
  if(record !== false) autoScales.set(w.id, { lo, hi });
  if(followsCommonScale(w)){ // the common scale, below
    if(commonScale.mode === 'fixed') return { lo: commonScale.min, hi: commonScale.max, fixed: true };
    if(commonAuto) return { lo: commonAuto.lo, hi: commonAuto.hi, fixed: false };
  }
  return w.scale ? { lo: w.scale.min, hi: w.scale.max, fixed: true } : { lo, hi, fixed: false };
}
// y for a number on that range, kept inside the plot.
function scaleY(top, plotH, sc){
  return (v) => top + (sc.hi - Math.max(sc.lo, Math.min(sc.hi, v))) / (sc.hi - sc.lo) * plotH;
}
// The zero line (when zero is on the scale) and, on a fixed scale, its two ends.
function drawScaleAxis(chart, sc, y, W, top, plotH){
  if(sc.lo <= 0 && sc.hi >= 0) chart.appendChild(svg('line', { class: 'b-zero', x1: 0, x2: W, y1: y(0), y2: y(0) }));
  if(!sc.fixed) return;
  chart.appendChild(svg('line', { class: 'b-scale-edge', x1: 0, x2: W, y1: top, y2: top }));
  chart.appendChild(svg('line', { class: 'b-scale-edge', x1: 0, x2: W, y1: top + plotH, y2: top + plotH }));
  chart.appendChild(svg('text', { class: 't-axis', x: W - 2, y: top + 10, 'text-anchor': 'end' }, fmtNum(sc.hi)));
  chart.appendChild(svg('text', { class: 't-axis', x: W - 2, y: top + plotH - 3, 'text-anchor': 'end' }, fmtNum(sc.lo)));
}
// The scale's two numbers drawn last, over the bars.
function raiseScaleLabels(chart){ chart.querySelectorAll('.t-axis').forEach(t => chart.appendChild(t)); }
// ▲ / ▼ where a number goes past a fixed scale.
function drawOverMarks(g, sc, cx, top, plotH, highest, lowest){
  if(!sc.fixed) return;
  const mark = (up) => {
    const t = svg('text', { class: 't-over', x: cx, y: up ? top + 11 : top + plotH - 3, 'text-anchor': 'middle' }, up ? '▲' : '▼');
    t.appendChild(svg('title', {}, up ? 'Above the scale (' + fmtNum(sc.hi) + ')' : 'Below the scale (' + fmtNum(sc.lo) + ')'));
    g.appendChild(t);
  };
  if(highest > sc.hi) mark(true);
  if(lowest < sc.lo) mark(false);
}

// Sets a widget's scale: null (Auto), 'current' (Fix at current scale), { min, max }, or
// 'shared' (follows the common scale again). While the common scale is on, any other choice
// keeps the widget's own. Returns the scale set, or throws when it isn't one.
function setWidgetScale(w, spec){
  if(spec === 'shared'){
    w.ownScale = false;
    syncCommonScale();
    return w.scale ? Object.assign({}, w.scale) : null;
  }
  if(commonScale.mode !== 'own' && canFollowScale(w)) w.ownScale = true;
  if(spec === null){ w.scale = null; return null; }
  if(spec === 'current'){
    const a = autoScales.get(w.id);
    w.scale = a ? niceScale(a.lo, a.hi) : { min: 0, max: 1 };
    return Object.assign({}, w.scale);
  }
  const s = cleanScale(spec);
  if(!s) throw new Error('A scale is two numbers, its "from" below its "to".');
  w.scale = s;
  return Object.assign({}, s);
}

// Scale: Auto or Fixed, from … to …, and 📏 Fix at current scale — with "Shared (…)" first
// while the common scale is on (below). onChange after each change.
function scaleChooser(w, onChange){
  const wrap = make('span', 'scale-chooser');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Vertical scale');
  const sharing = commonScale.mode !== 'own' && canFollowScale(w);
  if(sharing){ const o = make('option', null, commonScaleText()); o.value = 'shared'; mode.appendChild(o); }
  [['auto', 'Auto scale'], ['fixed', 'Fixed scale']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; mode.appendChild(o); });
  const box = (label) => {
    const i = make('input', 'scale-box');
    i.type = 'number';
    i.step = 'any';
    i.setAttribute('aria-label', label);
    i.title = label;
    return i;
  };
  const minBox = box('Scale from'), maxBox = box('Scale to');
  const to = make('span', 'scale-to', 'to');
  const fixNow = make('button', 'mini scale-fix', '📏');
  fixNow.type = 'button';
  fixNow.title = 'Fix at current scale';
  fixNow.setAttribute('aria-label', 'Fix at current scale');
  const show = () => {
    const follows = sharing && followsCommonScale(w), own = w.scale && !follows;
    mode.value = follows ? 'shared' : w.scale ? 'fixed' : 'auto';
    minBox.value = own ? String(w.scale.min) : '';
    maxBox.value = own ? String(w.scale.max) : '';
    [minBox, to, maxBox].forEach(el => el.classList.toggle('hidden', !own));
  };
  const fixCurrent = () => { setWidgetScale(w, 'current'); show(); onChange(); };
  mode.addEventListener('change', () => {
    if(mode.value === 'shared'){ setWidgetScale(w, 'shared'); show(); onChange(); }
    else if(mode.value === 'auto'){ setWidgetScale(w, null); show(); onChange(); }
    else if(followsCommonScale(w)){
      // Leaving the common scale for a fixed one keeps the range it shows.
      const sh = shownScale(w);
      setWidgetScale(w, sh ? (sh.fixed ? { min: sh.min, max: sh.max } : niceScale(sh.min, sh.max)) : 'current');
      show(); onChange();
    }
    else fixCurrent();
  });
  fixNow.addEventListener('click', fixCurrent);
  const typed = () => {
    const num = (i) => i.value.trim() === '' ? NaN : Number(i.value);
    const s = cleanScale({ min: num(minBox), max: num(maxBox) });
    if(!s){
      notify('The scale wasn\'t changed: its "from" and "to" must be numbers, "from" below "to".', 'err', 'scale');
      show();
      return;
    }
    notify('', null, 'scale');
    if(w.scale && w.scale.min === s.min && w.scale.max === s.max) return;
    setWidgetScale(w, s);
    onChange();
  };
  [minBox, maxBox].forEach(i => i.addEventListener('change', typed));
  wrap.append(mode, minBox, to, maxBox, fixNow);
  show();
  return wrap;
}

// ============================================================
// The common scale (the owner's request, 26 October 2026): one vertical scale for every bar and
// chart on every board of the model, which any of them can leave to keep its own — on the
// pattern of the shared period (05k-shared-period.js).
// - Three settings, beside the shared period above the bars and charts: Each its own (as before,
//   where every model and every older file starts), Auto for all (one range taking in every
//   follower on the board shown, and zero) and Fixed for all (from a min to a max). Kept with
//   the model's boards (`commonScale`, board file 12), undone and redone like any board change.
// - A bar or chart follows it unless it keeps its own (`ownScale`): its scale list's first
//   choice, "Shared (…)", follows; Auto scale or Fixed scale there keeps its own. Bars, Columns,
//   Lines, Waterfall and Scenario waterfall charts can follow; the Tornado and the Spider always
//   keep their own (their scale is around the output's base number, the Tornado's sideways).
// - What follows takes Fixed for all into its own `scale`, and Auto for all as Auto
//   (syncCommonScale), so going back to Each its own keeps what each shows. In a file each
//   follower writes the scale it shows — under Auto for all its board's range as the file is
//   written, rounded as 📏 rounds it — so ExcelExporter's Dashboard gets one scale on every chart.
// - Not in the template form, which carries no scales. Not on the phone, whose views follow it.
// ============================================================
let commonScale = { mode: 'own' }; // 'own' (Each its own), 'auto' (Auto for all), or 'fixed' with min and max
let commonAuto = null;             // { lo, hi }: Auto for all's range on the board shown, worked out before it is drawn

// The common scale from a file, storage or a script; anything unreadable is Each its own.
function cleanCommonScale(raw){
  if(!raw || typeof raw !== 'object') return { mode: 'own' };
  if(raw.mode === 'auto') return { mode: 'auto' };
  const s = raw.mode === 'fixed' ? cleanScale(raw) : null;
  return s ? { mode: 'fixed', min: s.min, max: s.max } : { mode: 'own' };
}
function commonScaleData(){ return Object.assign({}, commonScale); }

const canFollowScale = (w) => !isSensitivity(w);
function followsCommonScale(w){ return commonScale.mode !== 'own' && !w.ownScale && canFollowScale(w); }

// Every bar and chart following the common scale, on every board, takes it.
function syncCommonScale(){
  if(!model || commonScale.mode === 'own') return;
  boards.forEach(b => b.items.forEach(w => {
    if(followsCommonScale(w)) w.scale = commonScale.mode === 'fixed' ? { min: commonScale.min, max: commonScale.max } : null;
  }));
}

// The range Auto gives a bar or chart on these results, worked out as its drawing works it out
// (drawBars, drawColumns, drawLines, drawFlow, drawScenarioFlows): taking in zero and the
// numbers it is compared with. null for a Tornado or Spider.
function autoRange(w, results){
  let lo = 0, hi = 0;
  const take = (v) => { if(Number.isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } };
  const cmp = compareResults();
  if(w.kind === 'bar'){
    const rect = model.byKey.get(w.key);
    if(!rect) return null;
    periodsOf(w.periods).forEach(p => [resultOf(results, rect, p), resultOf(cmp, rect, p)].forEach(r => { if(!r.error) take(r.value); }));
  } else if(isSensitivity(w)) return null;
  else if(w.layout === 'flow') flowFigures(w, results).concat(flowFigures(w, cmp)).forEach(f => { if(!f.error){ take(f.from); take(f.to); } });
  else if(w.layout === 'lines') linesFigures(w, results).concat(linesFigures(w, cmp)).forEach(f => f.values.forEach(r => { if(!r.error) take(r.value); }));
  else if(w.layout === 'scenarios'){
    const memo = new Map();
    const resultsFor = (sc) => { if(!memo.has(sc)) memo.set(sc, scenarioResults(sc)); return memo.get(sc); };
    w.outputs.forEach(key => scenarioFigures(w, key, resultsFor).forEach(f => { if(!f.error){ take(f.from); take(f.to); } }));
  }
  else columnsFigures(w, results).concat(columnsFigures(w, cmp)).forEach(f => f.groups.forEach(g => { take(g.down); take(g.up); }));
  return { lo, hi };
}
// Auto for all's range on a board: its followers' Auto ranges together (all: every bar and
// chart that can follow). null when there are none.
function boardAutoRange(b, results, all){
  let out = null;
  b.items.forEach(w => {
    if(!(all ? canFollowScale(w) : followsCommonScale(w))) return;
    const r = autoRange(w, results);
    if(!r) return;
    out = out ? { lo: Math.min(out.lo, r.lo), hi: Math.max(out.hi, r.hi) } : r;
  });
  if(out && out.hi === out.lo) out.hi = out.lo + 1;
  return out;
}
// Before the board shown is drawn: Auto for all's range on it.
function prepareCommonScale(results){
  commonAuto = commonScale.mode === 'auto' ? boardAutoRange(board, results) : null;
}
// The scale a board's followers show, for the file: Fixed for all's, or Auto for all's range
// on that board's own slider positions, rounded as Fix at current scale rounds it.
function shownCommonScale(b){
  if(commonScale.mode === 'fixed') return { min: commonScale.min, max: commonScale.max };
  if(commonScale.mode !== 'auto') return null;
  const results = b === board ? currentResults() : resultsWith(overridesFor(liveSliders(b)));
  const r = boardAutoRange(b, results);
  return r ? niceScale(r.lo, r.hi) : null;
}

// Sets the common scale: null or 'own' (Each its own), 'auto', 'current' (Fixed for all at the
// range the board shown's bars and charts take now) or { min, max }. Returns it, or throws.
function setCommonScale(spec){
  if(spec === null || spec === 'own') commonScale = { mode: 'own' };
  else if(spec === 'auto') commonScale = { mode: 'auto' };
  else if(spec === 'current'){
    const r = model ? boardAutoRange(board, currentResults(), true) : null;
    commonScale = Object.assign({ mode: 'fixed' }, r ? niceScale(r.lo, r.hi) : { min: 0, max: 1 });
  } else {
    const s = cleanScale(spec);
    if(!s) throw new Error('A scale is two numbers, its "from" below its "to".');
    commonScale = { mode: 'fixed', min: s.min, max: s.max };
  }
  syncCommonScale();
  return commonScaleData();
}

// A widget's scale list's first choice: "Shared (Auto for all)", "Shared (0 to 1,000)".
function commonScaleText(){
  return commonScale.mode === 'fixed' ? 'Shared (' + fmtNum(commonScale.min) + ' to ' + fmtNum(commonScale.max) + ')' : 'Shared (Auto for all)';
}
// The scale a bar or chart shows now: { min, max, fixed, shared }, or null before it is drawn.
function shownScale(w){
  const follows = followsCommonScale(w);
  const sc = follows
    ? (commonScale.mode === 'fixed' ? { lo: commonScale.min, hi: commonScale.max, fixed: true } : commonAuto)
    : w.scale ? { lo: w.scale.min, hi: w.scale.max, fixed: true } : autoScales.get(w.id);
  return sc ? { min: sc.lo, max: sc.hi, fixed: !!sc.fixed, shared: follows } : null;
}

// Scale: Each its own, Auto for all or Fixed for all (from … to …, 📏), above the bars and charts.
function commonScaleChooser(){
  const wrap = make('span', 'scale-chooser common-scale');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Common scale');
  mode.title = 'One vertical scale for every bar and chart, on every board, unless it keeps its own (its scale list\'s first choice is Shared). The Tornado and Spider keep their own.';
  [['own', 'Each its own'], ['auto', 'Auto for all'], ['fixed', 'Fixed for all']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; mode.appendChild(o); });
  const box = (label) => {
    const i = make('input', 'scale-box');
    i.type = 'number';
    i.step = 'any';
    i.setAttribute('aria-label', label);
    i.title = label;
    return i;
  };
  const minBox = box('Common scale from'), maxBox = box('Common scale to');
  const to = make('span', 'scale-to', 'to');
  const fixNow = make('button', 'mini scale-fix', '📏');
  fixNow.type = 'button';
  fixNow.title = 'Fix the common scale at the current scale';
  fixNow.setAttribute('aria-label', 'Fix the common scale at the current scale');
  // Shown in place, so a change keeps the focus where it is.
  const show = () => {
    const fixed = commonScale.mode === 'fixed';
    mode.value = commonScale.mode;
    minBox.value = fixed ? String(commonScale.min) : '';
    maxBox.value = fixed ? String(commonScale.max) : '';
    [minBox, to, maxBox, fixNow].forEach(el => el.classList.toggle('hidden', !fixed));
  };
  const changed = () => { notify('', null, 'scale'); show(); commonScaleChanged(); };
  mode.addEventListener('change', () => { setCommonScale(mode.value === 'fixed' ? 'current' : mode.value); changed(); });
  fixNow.addEventListener('click', () => { setCommonScale('current'); changed(); });
  const typed = () => {
    const num = (i) => i.value.trim() === '' ? NaN : Number(i.value);
    const s = cleanScale({ min: num(minBox), max: num(maxBox) });
    if(!s){
      notify('The common scale wasn\'t changed: its "from" and "to" must be numbers, "from" below "to".', 'err', 'scale');
      show();
      return;
    }
    if(commonScale.min === s.min && commonScale.max === s.max) return;
    setCommonScale(s);
    changed();
  };
  [minBox, maxBox].forEach(i => i.addEventListener('change', typed));
  wrap.append(mode, minBox, to, maxBox, fixNow);
  show();
  return wrap;
}
function commonScaleChanged(){
  saveBoardSoon();
  renderBoard(); // the widgets' "Shared (…)" choices say the new scale
}
