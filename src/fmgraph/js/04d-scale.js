// ============================================================
// A bar's or chart's vertical scale (the owner's request, 12 October 2026). Auto, as before:
// stretched to the numbers shown and always taking in zero, so it changes as a slider moves.
// Fixed: from a min to a max the person chose, so a change shows as a change in size. A
// widget's `scale` is absent or null (Auto) or { min, max } with min below max (board file
// version 5; the template form leaves it out). A number past a fixed scale is drawn to the
// edge with ▲ or ▼; its label and hover text still give the number itself. A scenario
// waterfall's fixed scale is shared by all its outputs.
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

// Sets a widget's scale: null (Auto), 'current' (Fix at current scale) or { min, max }.
// Returns the scale set, or throws when it isn't one.
function setWidgetScale(w, spec){
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

// Scale: Auto or Fixed, from … to …, and 📏 Fix at current scale. onChange after each change.
function scaleChooser(w, onChange){
  const wrap = make('span', 'scale-chooser');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Vertical scale');
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
    mode.value = w.scale ? 'fixed' : 'auto';
    minBox.value = w.scale ? String(w.scale.min) : '';
    maxBox.value = w.scale ? String(w.scale.max) : '';
    [minBox, to, maxBox].forEach(el => el.classList.toggle('hidden', !w.scale));
  };
  const fixCurrent = () => { setWidgetScale(w, 'current'); show(); onChange(); };
  mode.addEventListener('change', () => {
    if(mode.value === 'auto'){ w.scale = null; show(); onChange(); }
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
    w.scale = s;
    onChange();
  };
  [minBox, maxBox].forEach(i => i.addEventListener('change', typed));
  wrap.append(mode, minBox, to, maxBox, fixNow);
  show();
  return wrap;
}
