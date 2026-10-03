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
const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

// Reads a chart from storage (or later a file); rectFor finds a part's rectangle by canvas id,
// node id and name. Parts on rectangles that aren't there are left out.
function cleanChart(raw, rectFor, count){
  if(!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, CHART_LIMITS.title);
  const colours = {};
  const keep = (entry, r) => { const c = cleanColour(entry && entry.colour); if(c) colours[r.key] = c; return r; };
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
function chartKeys(c){ return c.layout === 'flow' ? c.steps.map(s => s.key) : c.layout === 'scenarios' ? c.outputs.slice() : c.groups.flatMap(g => g.parts); }

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
