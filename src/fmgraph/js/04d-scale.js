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
  else if(w.layout === 'free') freeFigures(w, results).concat(freeFigures(w, cmp)).forEach(f => { if(f.parts){ take(f.top); take(f.bottom); take(f.base); } });
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
