// ============================================================
// Charts (G2): two general building blocks, made of the same bars as a bar widget. Nothing
// here knows about balance sheets or income statements: those are just ways of filling them in.
//
//   columns  { id, layout: 'columns', title, periods, groups: [{ name, parts: [key] }], check }
//            Each group is one column per period, its rectangles stacked (values below zero
//            stack downwards); the groups stand side by side. One rectangle per group is a
//            plain column chart, one group of several a stacked chart, two groups whose totals
//            should agree (check: true) a balance sheet.
//   flow     { id, layout: 'flow', title, period, steps: [{ key, role }] }
//            A waterfall in one period: 'start' (a full bar), 'add' and 'subtract' (floating
//            steps up or down from the running total), 'total' (a full bar of that rectangle's
//            own value, checked against the steps before it; the flow carries on from it).
//   scenarios { id, layout: 'scenarios', title, period, outputs: [key], use: [scenario name] | null }
//            The scenario waterfall (scenarios S2): for each output, in one period, a waterfall
//            from the model's own number (Start) through each scenario in turn — each step the
//            change from the one before (sc01 − Start, sc02 − sc01, …) — to the last scenario's
//            number (End). `use`: the scenarios it goes through, in the Scenarios panel's
//            order; null for every one (05f-scenarios.js).
//   tornado / spider (step 18) { id, layout, title, output: key | null, period, steps,
//            inputs: [{ key, by: 'percent' | 'amount', low, high, show }], colour, colour2 }
//            What moves one output most, measured around where the sliders stand now: each input
//            moved on its own, in every period (percent: × (1 + x / 100); amount: + x), the output
//            read in one period. The Tornado: Low and High against the base, sorted by swing. The
//            Spider: `steps` points from the base out to Low and to High, a line per input. The
//            same meanings and limits as ExcelExporter's Sensitivity (docs/file-formats.md);
//            `show: false` keeps an input listed but leaves it out of the drawing. colour /
//            colour2: the Tornado's Low and High; a Spider's line takes its input's colour.
//
// A chart may give any of its rectangles its own colour: colours { key: '#rrggbb' }, kept in the
// file on that part or step (`colour`).
//
// Numbers agree when they differ by less than a millionth of their size (AGREE_TOLERANCE):
// tiny rounding in the calculation is ignored, any real gap is not.
// ============================================================
const CHART_LIMITS = { groups: 12, parts: 30, steps: 40, title: 80, name: 60, outputs: 6 };
const FLOW_ROLES = ['start', 'add', 'subtract', 'total'];
const AGREE_TOLERANCE = 1e-6;
const agree = (a, b) => Math.abs(a - b) <= AGREE_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
const SENSITIVITY_LAYOUTS = ['tornado', 'spider'];
const SENSITIVITY_LIMITS = { inputs: 50, bound: 1e9, steps: 10, defaultSteps: 5 };
const isSensitivity = (c) => !!c && SENSITIVITY_LAYOUTS.includes(c.layout);
const defaultBounds = (by) => by === 'amount' ? { low: -1, high: 1 } : { low: -10, high: 10 };
// A Low or High from a file: a number, cut to ±1e9; anything else the default.
function cleanBound(v, fallback){
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if(!Number.isFinite(n)) return fallback;
  return Math.max(-SENSITIVITY_LIMITS.bound, Math.min(SENSITIVITY_LIMITS.bound, n));
}
const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

// Reads a chart from storage (or later a file); rectFor finds a part's rectangle by canvas id,
// node id and name. Parts on rectangles that aren't there are left out (a Tornado's or Spider's
// inputs, or ones no longer inputs, are also counted through drop, when given).
function cleanChart(raw, rectFor, count, drop){
  if(!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, CHART_LIMITS.title);
  const colours = {};
  const keep = (entry, r) => { const c = cleanColour(entry && entry.colour); if(c) colours[r.key] = c; return r; };
  const periodOf = () => { const p = Math.round(Number(raw.period)); return Number.isFinite(p) && p >= 0 && p < count ? p : 0; };
  if(isSensitivity(raw)){
    const out = raw.output && typeof raw.output === 'object' ? rectFor(raw.output) : null;
    const inputs = [];
    (Array.isArray(raw.inputs) ? raw.inputs : []).slice(0, SENSITIVITY_LIMITS.inputs).forEach(i => {
      const r = i && typeof i === 'object' ? rectFor(i) : null;
      if(!r || !r.input || inputs.some(x => x.key === r.key)){ if(drop) drop(); return; }
      const by = i.by === 'amount' ? 'amount' : 'percent', d = defaultBounds(by);
      inputs.push({ key: keep(i, r).key, by, low: cleanBound(i.low, d.low), high: cleanBound(i.high, d.high), show: i.show !== false });
    });
    const st = Math.round(Number(raw.steps));
    return { id: newWidgetId('c'), kind: 'chart', wide: true, layout: raw.layout, title, output: out ? out.key : null, period: periodOf(),
      steps: Number.isFinite(st) && st >= 1 && st <= SENSITIVITY_LIMITS.steps ? st : SENSITIVITY_LIMITS.defaultSteps, inputs,
      colour: cleanColour(raw.colour), colour2: cleanColour(raw.colour2), colours };
  }
  if(raw.layout === 'scenarios'){
    const outputs = (Array.isArray(raw.outputs) ? raw.outputs : []).slice(0, CHART_LIMITS.outputs).map(o => rectFor(o)).filter(Boolean).map(r => r.key);
    let use = null;
    if(Array.isArray(raw.scenarios)){
      use = [];
      raw.scenarios.slice(0, SCENARIOS_LIMIT).forEach(n => { const t = cleanText(n, SCENARIO_NAME_MAX); if(t && !use.some(u => sameName(u, t))) use.push(t); });
    }
    const p = Math.round(Number(raw.period));
    return { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'scenarios', title, period: Number.isFinite(p) && p >= 0 && p < count ? p : 0, outputs: [...new Set(outputs)], use, colours: {} };
  }
  if(raw.layout === 'flow'){
    const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, CHART_LIMITS.steps).map(s => {
      const r = rectFor(s);
      return r ? { key: keep(s, r).key, role: FLOW_ROLES.includes(s.role) ? s.role : 'add' } : null;
    }).filter(Boolean);
    const p = Math.round(Number(raw.period));
    return { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'flow', title, period: Number.isFinite(p) && p >= 0 && p < count ? p : 0, steps, colours };
  }
  const groups = (Array.isArray(raw.groups) ? raw.groups : []).slice(0, CHART_LIMITS.groups).map(g => ({
    name: cleanText(g && g.name, CHART_LIMITS.name),
    parts: (g && Array.isArray(g.parts) ? g.parts : []).slice(0, CHART_LIMITS.parts).map(p => { const r = rectFor(p); return r ? keep(p, r) : null; }).filter(Boolean).map(r => r.key),
  }));
  if(!groups.length) groups.push({ name: '', parts: [] });
  return { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'columns', title, periods: cleanPeriods(raw.periods, count), groups, check: raw.check === true, colours };
}

// A chart's file form; at(key) gives a rectangle's { canvasId, nodeId, name }.
function chartData(c, at){
  const withColour = (key, extra) => Object.assign(at(key), extra || {}, c.colours && c.colours[key] ? { colour: c.colours[key] } : {});
  if(isSensitivity(c)) return Object.assign({ layout: c.layout, title: c.title, output: c.output ? at(c.output) : null, period: c.period, steps: c.steps,
    inputs: c.inputs.map(i => withColour(i.key, Object.assign({ by: i.by, low: i.low, high: i.high }, i.show ? {} : { show: false }))) },
    c.colour ? { colour: c.colour } : {}, c.colour2 ? { colour2: c.colour2 } : {});
  if(c.layout === 'scenarios') return Object.assign({ layout: 'scenarios', title: c.title, period: c.period, outputs: c.outputs.map(k => at(k)) }, c.use ? { scenarios: c.use.slice() } : {});
  if(c.layout === 'flow') return { layout: 'flow', title: c.title, period: c.period, steps: c.steps.map(s => withColour(s.key, { role: s.role })) };
  return { layout: 'columns', title: c.title, periods: Object.assign({}, c.periods), check: c.check,
    groups: c.groups.map(g => ({ name: g.name, parts: g.parts.map(k => withColour(k)) })) };
}

// A new chart: columns with one group holding one calculated rectangle, or a flow with one step.
function addChart(layout){
  if(board.charts.length >= BOARD_LIMIT) return null;
  const first = model.rects.find(r => !r.input) || model.rects[0];
  const c = layout === 'flow'
    ? { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'flow', title: '', period: 0, steps: first ? [{ key: first.key, role: 'start' }] : [], colours: {} }
    : { id: newWidgetId('c'), kind: 'chart', wide: true, layout: 'columns', title: '', periods: { mode: 'all' }, groups: [{ name: '', parts: first ? [first.key] : [] }], check: false, colours: {} };
  board.items.push(c);
  saveBoardSoon();
  return c;
}

// Every rectangle a chart shows.
function chartKeys(c){ return isSensitivity(c) ? [c.output].concat(c.inputs.map(i => i.key)).filter(Boolean) : c.layout === 'flow' ? c.steps.map(s => s.key) : c.layout === 'scenarios' ? c.outputs.slice() : c.groups.flatMap(g => g.parts); }

// What a columns chart shows in one calculation: per period, per group, each part's result,
// the total of what goes up (above zero) and down, and whether the groups' totals agree.
function columnsFigures(c, results){
  return periodsOf(c.periods).map(p => {
    const groups = c.groups.map(g => {
      const parts = g.parts.map(key => resultOf(results, model.byKey.get(key), p));
      const ok = parts.filter(r => !r.error);
      return { parts, error: parts.some(r => r.error),
        total: ok.reduce((s, r) => s + r.value, 0),
        up: ok.reduce((s, r) => s + Math.max(0, r.value), 0), down: ok.reduce((s, r) => s + Math.min(0, r.value), 0) };
    });
    let check = null;
    const full = groups.filter(g => g.parts.length);
    if(c.check && full.length >= 2){
      if(full.some(g => g.error)) check = { error: true };
      else {
        const totals = full.map(g => g.total);
        const gap = Math.max(...totals) - Math.min(...totals);
        check = { ok: totals.every(t => agree(t, totals[0])), gap };
      }
    }
    return { p, groups, check };
  });
}

// What a flow shows in one calculation: each step's result, where its bar starts and ends,
// and, for a total, what the steps before it add up to and whether it agrees.
function flowFigures(c, results){
  let running = 0, broken = false;
  return c.steps.map((s, i) => {
    const r = resultOf(results, model.byKey.get(s.key), c.period);
    if(r.error){ broken = true; return { role: s.role, error: r.error }; }
    const v = r.value;
    let from, to, check = null;
    if(s.role === 'start'){ from = 0; to = v; running = v; broken = false; }
    else if(s.role === 'total'){
      from = 0; to = v;
      if(i > 0) check = broken ? { error: true } : { ok: agree(running, v), expected: running };
      running = v; broken = false;
    }
    else if(s.role === 'subtract'){ from = running; to = running - v; running = to; }
    else { from = running; to = running + v; running = to; }
    return { role: s.role, value: v, from, to, check };
  });
}

// The scenarios a scenario waterfall goes through, in the panel's order.
function chartScenarios(c){
  return c.use ? scenarios.filter(sc => c.use.some(n => sameName(n, sc.name))) : scenarios.slice();
}
// What a scenario waterfall shows for one output: [{ name, kind ('start' | 'step' | 'end'),
// value (the number, or for a step the change), from, to, error? }] — Start the model's own
// number, a step per scenario (the change from the one before), End the last scenario's number.
// The results of each scenario are worked out once for all outputs (resultsFor).
function scenarioFigures(c, key, resultsFor){
  const rect = model.byKey.get(key);
  const start = resultOf(model.base, rect, c.period);
  if(start.error) return [{ name: 'Start', kind: 'start', error: start.error }];
  const out = [{ name: 'Start', kind: 'start', value: start.value, from: 0, to: start.value }];
  let prev = start.value, broken = false;
  chartScenarios(c).forEach(sc => {
    const r = resultOf(resultsFor(sc), rect, c.period);
    if(r.error){ out.push({ name: sc.name, kind: 'step', error: r.error }); broken = true; return; }
    out.push({ name: sc.name, kind: 'step', value: r.value - prev, from: prev, to: r.value, number: r.value });
    prev = r.value;
  });
  if(out.length > 1){
    out.push(broken ? { name: 'End', kind: 'end', error: out.slice().reverse().find(f => f.error).error } : { name: 'End', kind: 'end', value: prev, from: 0, to: prev });
  }
  return out;
}

// ---- the Tornado and the Spider (step 18) ----
// A new Tornado or Spider's output and inputs: the first calculated rectangle (or the one given),
// and every input that reaches it, in the model's order (at most 50).
function sensitivityStart(outputKey){
  const out = outputKey ? model.byKey.get(outputKey) : (model.rects.find(r => !r.input) || model.rects[0]);
  if(!out) return { output: null, inputs: [] };
  const inputs = model.inputs.filter(r => r.key !== out.key && model.reach(r.key).has(out.key)).slice(0, SENSITIVITY_LIMITS.inputs)
    .map(r => Object.assign({ key: r.key, by: 'percent', show: true }, defaultBounds('percent')));
  return { output: out.key, inputs };
}

// The numbers laid over the model with one input moved: its number in every period, as the
// sliders leave it (or the model's own), changed by percent or by an amount; the rest as given.
function movedOverrides(base, key, by, x){
  const rect = model.byKey.get(key);
  const from = base.get(key) || model.periods.map((_, p) => baseValue(rect, p));
  const out = new Map(base);
  out.set(key, from.map(v => by === 'amount' ? v + x : v * (1 + x / 100)));
  return out;
}
// The Spider's points along one side: k / steps of the way out, for k = 1 … steps.
const spiderShares = (steps) => Array.from({ length: steps }, (_, k) => (k + 1) / steps);

// Every set of numbers a Tornado or Spider works out, around the base (for working them out
// ahead on a slow model).
function sensitivityRuns(c, base){
  const out = [];
  c.inputs.forEach(i => {
    const xs = c.layout === 'spider' ? spiderShares(c.steps).flatMap(f => [i.low * f, i.high * f]) : [i.low, i.high];
    xs.forEach(x => out.push(movedOverrides(base, i.key, i.by, x)));
  });
  return out;
}

// What a Tornado or Spider shows, around base (the overrides the board shows now):
//   { base: number | { error }, inputs: [{ key, by, low, high, show, lowValue, highValue, swing,
//     error?, points? }] } — the Tornado's sorted by swing (largest first; equal swings keep the
//   inputs' order; ones that can't be worked out last), the Spider's in the inputs' order with
//   points [{ at (−1 … 1, a share of Low or High), change, value | error }].
// null when there is no output.
function sensitivityFigures(c, base){
  const rect = c.output && model.byKey.get(c.output);
  if(!rect) return null;
  const read = (overrides) => resultOf(resultsWith(overrides), rect, c.period);
  const b = read(base);
  const inputs = c.inputs.map((i, n) => {
    const f = { n, key: i.key, by: i.by, low: i.low, high: i.high, show: i.show };
    const lo = read(movedOverrides(base, i.key, i.by, i.low)), hi = read(movedOverrides(base, i.key, i.by, i.high));
    if(lo.error || hi.error) f.error = lo.error || hi.error;
    else Object.assign(f, { lowValue: lo.value, highValue: hi.value, swing: Math.abs(hi.value - lo.value) });
    if(c.layout === 'spider'){
      const point = (at, x) => { const r = read(movedOverrides(base, i.key, i.by, x)); return r.error ? { at, change: x, error: r.error } : { at, change: x, value: r.value }; };
      const shares = spiderShares(c.steps);
      f.points = shares.slice().reverse().map(s => point(-s, i.low * s))
        .concat([b.error ? { at: 0, change: 0, error: b.error } : { at: 0, change: 0, value: b.value }])
        .concat(shares.map(s => point(s, i.high * s)));
    }
    return f;
  });
  if(c.layout === 'tornado') inputs.sort((x, y) => (x.error ? 1 : 0) - (y.error ? 1 : 0) || (y.swing || 0) - (x.swing || 0) || x.n - y.n);
  return { base: b.error ? { error: b.error } : b.value, inputs };
}
