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
//
// Numbers agree when they differ by less than a millionth of their size (AGREE_TOLERANCE):
// tiny rounding in the calculation is ignored, any real gap is not.
// ============================================================
const CHART_LIMITS = { groups: 12, parts: 30, steps: 40, title: 80, name: 60 };
const FLOW_ROLES = ['start', 'add', 'subtract', 'total'];
const AGREE_TOLERANCE = 1e-6;
const agree = (a, b) => Math.abs(a - b) <= AGREE_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

// Reads a chart from storage (or later a file); rectFor finds a part's rectangle by canvas id,
// node id and name. Parts on rectangles that aren't there are left out.
function cleanChart(raw, rectFor, count){
  if(!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, CHART_LIMITS.title);
  if(raw.layout === 'flow'){
    const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, CHART_LIMITS.steps).map(s => {
      const r = rectFor(s);
      return r ? { key: r.key, role: FLOW_ROLES.includes(s.role) ? s.role : 'add' } : null;
    }).filter(Boolean);
    const p = Math.round(Number(raw.period));
    return { id: newWidgetId('c'), layout: 'flow', title, period: Number.isFinite(p) && p >= 0 && p < count ? p : 0, steps };
  }
  const groups = (Array.isArray(raw.groups) ? raw.groups : []).slice(0, CHART_LIMITS.groups).map(g => ({
    name: cleanText(g && g.name, CHART_LIMITS.name),
    parts: (g && Array.isArray(g.parts) ? g.parts : []).slice(0, CHART_LIMITS.parts).map(rectFor).filter(Boolean).map(r => r.key),
  }));
  if(!groups.length) groups.push({ name: '', parts: [] });
  return { id: newWidgetId('c'), layout: 'columns', title, periods: cleanPeriods(raw.periods, count), groups, check: raw.check === true };
}

// A chart's file form; at(key) gives a rectangle's { canvasId, nodeId, name }.
function chartData(c, at){
  if(c.layout === 'flow') return { layout: 'flow', title: c.title, period: c.period, steps: c.steps.map(s => Object.assign(at(s.key), { role: s.role })) };
  return { layout: 'columns', title: c.title, periods: Object.assign({}, c.periods), check: c.check,
    groups: c.groups.map(g => ({ name: g.name, parts: g.parts.map(at) })) };
}

// A new chart: columns with one group holding one calculated rectangle, or a flow with one step.
function addChart(layout){
  if(board.charts.length >= BOARD_LIMIT) return null;
  const first = model.rects.find(r => !r.input) || model.rects[0];
  const c = layout === 'flow'
    ? { id: newWidgetId('c'), layout: 'flow', title: '', period: 0, steps: first ? [{ key: first.key, role: 'start' }] : [] }
    : { id: newWidgetId('c'), layout: 'columns', title: '', periods: { mode: 'all' }, groups: [{ name: '', parts: first ? [first.key] : [] }], check: false };
  board.charts.push(c);
  saveBoardSoon();
  return c;
}

// Every rectangle a chart shows.
function chartKeys(c){ return c.layout === 'flow' ? c.steps.map(s => s.key) : c.groups.flatMap(g => g.parts); }

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
