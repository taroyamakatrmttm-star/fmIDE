// ============================================================
// Drawing and editing charts (G2; the data is 04b-charts.js). A chart widget has its chart, a
// key of what each colour is, any problems (errors, totals that don't agree) as text, and
// "Edit chart", where its groups and rectangles (or its steps) are chosen. Like a bar widget,
// it shows the model's own values as dashed outlines once a slider has changed them, and lights
// up when a slider reaches any of its rectangles.
// The drawing is the board engine's (the showcase viewer draws charts with it too); the widget,
// Edit chart and the key's colour boxes are fmGraph's page (05b-chart-render-edit.js). A key's
// swatch comes from the page: rectKeySwatch / chartKeySwatch (fmGraph's a colour box, the
// viewer's a plain mark), and a Free chart's grid from freeGridHook (05p-free-grid.js).
// ============================================================
const ROLE_LABELS = { start: 'Start', add: 'Add', subtract: 'Subtract', total: 'Total' };

function partLabel(key){ const r = model.byKey.get(key); return r ? r.name : '?'; }
function groupLabel(c, gi){ return c.groups[gi].name || 'Group ' + (gi + 1); }

function drawChart(el, c, results){
  const host = el.querySelector('.bar-chart-host'), key = el.querySelector('.chart-key'), list = el.querySelector('.bar-errors');
  host.textContent = ''; key.textContent = ''; list.textContent = '';
  if(c.layout !== 'free'){ const tools = el.querySelector('.free-tools'); if(tools) tools.remove(); }
  const problems = [];
  if(c.layout === 'flow') host.appendChild(drawFlow(c, results, problems));
  else if(c.layout === 'free'){ const chart = drawFree(c, results, problems, key); host.appendChild(chart); freeGridHook(el, c, chart); } // 05n-free-chart.js, 05p-free-grid.js
  else if(c.layout === 'scenarios') host.appendChild(drawScenarioFlows(c, problems));
  else if(isSensitivity(c)) host.appendChild(drawSensitivity(c, problems, key));
  else if(c.layout === 'lines') host.appendChild(drawLines(c, results, problems, key));
  else host.appendChild(drawColumns(c, results, problems, key));
  glide(host);
  // Rectangles in different units side by side or stacked don't add up: say so. (A Tornado's
  // inputs are only moved, never added up; a lines chart adds nothing up.)
  const units = isSensitivity(c) || c.layout === 'lines' ? [] : [...new Set(chartKeys(c).map(k => model.byKey.get(k)).filter(r => r && r.unit).map(r => r.unit))];
  if(units.length > 1) problems.push('This chart mixes units (' + units.join(', ') + '): its totals may not mean much.');
  problems.forEach(t => list.appendChild(make('li', null, t)));
}

// The colour of each of the chart's rectangles: its shared one (04e-colours.js).
function partColours(c){
  const out = new Map();
  chartKeys(c).forEach(k => { if(!out.has(k)) out.set(k, rectColour(k) || PART_COLOURS[0]); });
  return out;
}

// ---- the key leaves out rectangles at 0 (the owner's idea of 27 October 2026) ----
// A balance sheet with only cash and a loan shouldn't list every account. A rectangle is left
// out of a chart's key when it is 0 in every period the chart shows, in the numbers on screen
// and in the dashed outlines (A, or the model's own numbers) — and while Play runs, at both of
// its ends, so the key doesn't change as it plays. One that can't be worked out stays listed.
// Its bars are still drawn; "+N at 0" at the end of the key shows them (Edit chart still
// chooses their colours). Always on: nothing about it is saved.
const keyZerosOpen = new Set(); // charts whose key shows the rectangles at 0 too (this page only)
let gifMaking = null;               // while a GIF is made: { model, positions, cancelled } (05o-play-gif.js)
// The calculations a key looks at.
function keyResults(results){
  const list = [results, compareResults()];
  // Play's two ends (05m-play.js): its first and last positions.
  // (While a GIF of the play is made, its ends: 05o-play-gif.js.)
  const now = playing && playing.model === model ? playing : gifMaking && gifMaking.model === model ? gifMaking : null;
  const ends = now && Array.isArray(now.positions) ? now.positions : null;
  if(ends && ends.length) list.push(resultsWith(ends[0]), resultsWith(ends[ends.length - 1]));
  return list;
}
// Whether rectangle k is 0 in every one of the periods, in every one of the calculations.
function keyAtZero(k, periods, list){
  const rect = model.byKey.get(k);
  if(!rect || !periods.length) return false;
  return list.every(rs => periods.every(p => { const r = resultOf(rs, rect, p); return !r.error && r.value === 0; }));
}
// Which of the keys the key lists: { shows(k), hidden (how many left out, once each), open }.
function keyChoice(c, keys, periods, results){
  const list = keyResults(results), zero = new Set();
  [...new Set(keys)].forEach(k => { if(keyAtZero(k, periods, list)) zero.add(k); });
  const open = keyZerosOpen.has(c.id);
  return { shows: (k) => open || !zero.has(k), zero, hidden: zero.size, open };
}
// The key's last line: "+N at 0" (shows them), or, once shown, a way back.
function drawKeyZeros(key, c, choice){
  if(!choice.hidden) return;
  const line = make('div', 'key-line key-zeros-line');
  const n = choice.hidden, them = n === 1 ? 'the rectangle' : 'the ' + n + ' rectangles';
  const b = make('button', 'key-zeros', choice.open ? 'Hide the ' + n + ' at 0' : '+' + n + ' at 0');
  b.type = 'button';
  b.title = choice.open ? 'Leave out of the key ' + them + ' at 0 in every period shown'
    : (n === 1 ? '1 rectangle is' : n + ' rectangles are') + ' 0 in every period shown: list ' + (n === 1 ? 'it' : 'them') + ' too';
  b.setAttribute('aria-expanded', choice.open ? 'true' : 'false');
  b.addEventListener('click', () => {
    if(keyZerosOpen.has(c.id)) keyZerosOpen.delete(c.id); else keyZerosOpen.add(c.id);
    const inShow = !!b.closest('#showView');
    updateValues();
    const again = document.querySelector((inShow ? '#showView .show-widget' : '.chart-widget[data-id="' + c.id + '"]') + ' .key-zeros');
    if(again) again.focus({ preventScroll: true });
  });
  line.appendChild(b);
  key.appendChild(line);
}
// A key item for rectangle k, marked when it is one at 0 shown on request.
function markKeyZero(item, k, choice){ if(choice.zero.has(k)) item.classList.add('key-zero'); return item; }

function drawColumns(c, results, problems, key){
  const now = columnsFigures(c, results), was = columnsFigures(c, compareResults()); // A, or the model's own numbers
  const colours = partColours(c);
  const n = Math.max(1, now.length), ng = Math.max(1, c.groups.length);
  const labels = n * ng <= 12;
  let lo = 0, hi = 0;
  now.concat(was).forEach(f => f.groups.forEach(g => { lo = Math.min(lo, g.down); hi = Math.max(hi, g.up); }));
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(c, lo, hi); // Auto, or the chart's fixed scale (04d-scale.js)
  const checked = now.some(f => f.check);
  const W = 560, top = 18 + (labels ? 16 : 0) + (checked ? 16 : 0), bottom = 22 + (sc.lo < 0 && labels ? 16 : 0), H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / n, gap = 6;
  const bw = Math.max(3, Math.min(44, (slot * 0.8 - gap * (ng - 1)) / ng));
  const chart = svg('svg', { class: 'bar-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', c.title || 'Columns');
  drawScaleAxis(chart, sc, y, W, top, plotH);
  now.forEach((f, i) => {
    const slotX = 4 + slot * i, groupsW = ng * bw + (ng - 1) * gap;
    const g = svg('g', { class: 'c-period', 'data-period': f.p });
    f.groups.forEach((grp, gi) => {
      const x = slotX + (slot - groupsW) / 2 + gi * (bw + gap), cx = x + bw / 2;
      const gEl = svg('g', { class: 'c-group', 'data-group': gi });
      const name = groupLabel(c, gi);
      if(grp.error){
        gEl.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
        gEl.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
        grp.parts.forEach((r, pi) => { if(r.error) problems.push(model.periods[f.p] + ', ' + partLabel(c.groups[gi].parts[pi]) + ': ' + errorText(r.error)); });
      } else {
        let up = 0, down = 0;
        grp.parts.forEach((r, pi) => {
          const k = c.groups[gi].parts[pi], v = r.value;
          const from = v >= 0 ? up : down, to = from + v;
          if(v >= 0) up = to; else down = to;
          const rect = animKey(svg('rect', { class: 'c-part', x, y: Math.min(y(from), y(to)), width: bw, height: Math.max(v === 0 ? 0 : 1, Math.abs(y(to) - y(from))), fill: colours.get(k) }), c.id + '|' + f.p + '|' + gi + '|' + pi);
          const before = was[i].groups[gi].parts[pi];
          const diff = before && !before.error ? fmtDiff(v, before.value) : '';
          rect.appendChild(svg('title', {}, name + ' · ' + partLabel(k) + ', ' + model.periods[f.p] + ': ' + fmtNum(v) + (diff ? ' — was ' + fmtNum(before.value) + ', ' + diff : '')));
          gEl.appendChild(rect);
        });
        drawOverMarks(gEl, sc, cx, top, plotH, grp.up, grp.down);
        const b = was[i].groups[gi];
        if(!b.error && (!agree(b.up, grp.up) || !agree(b.down, grp.down))){
          gEl.appendChild(svg('rect', { class: 'b-base', x, y: y(b.up), width: bw, height: Math.max(1, y(b.down) - y(b.up)) }));
        }
        if(labels){
          const diff = b.error ? '' : fmtDiff(grp.total, b.total);
          const t = svg('text', { class: 't-value', x: cx, y: y(grp.up) - 4, 'text-anchor': 'middle' }, fmtNum(grp.total));
          gEl.appendChild(t);
          if(diff) gEl.appendChild(svg('text', { class: 't-diff ' + (grp.total > b.total ? 'up' : 'down'), x: cx, y: y(grp.up) - 17, 'text-anchor': 'middle' }, diff.split(' ')[0]));
        }
      }
      g.appendChild(gEl);
    });
    if(f.check){
      const mark = f.check.error ? '?' : f.check.ok ? '✓' : '✗';
      const t = svg('text', { class: 't-check ' + (f.check.ok ? 'ok' : 'bad'), x: slotX + slot / 2, y: 13, 'text-anchor': 'middle' }, mark);
      t.appendChild(svg('title', {}, f.check.error ? 'Can\'t check: a rectangle couldn\'t be worked out'
        : f.check.ok ? 'The groups\' totals agree' : 'The groups\' totals differ by ' + fmtNum(f.check.gap)));
      g.appendChild(t);
      if(!f.check.error && !f.check.ok) problems.push(model.periods[f.p] + ': the groups\' totals differ by ' + fmtNum(f.check.gap) + '.');
    }
    if(n <= 8 || i === 0 || i === n - 1) g.appendChild(svg('text', { class: 't-period', x: slotX + slot / 2, y: H - 6, 'text-anchor': 'middle' }, model.periods[f.p]));
    chart.appendChild(g);
  });
  // The key: each group, left to right, with its rectangles' colours (those at 0 left out).
  const choice = keyChoice(c, c.groups.flatMap(g => g.parts), periodsOf(c.periods), results);
  c.groups.forEach((grp, gi) => {
    const parts = grp.parts.filter(choice.shows);
    if(!parts.length && grp.parts.length) return;
    const line = make('div', 'key-line');
    if(ng > 1) line.appendChild(make('span', 'key-group', groupLabel(c, gi) + ':'));
    parts.forEach(k => {
      const item = markKeyZero(make('label', 'key-item'), k, choice);
      // The swatch is the colour box: a click picks this rectangle's colour everywhere.
      const sw = rectKeySwatch(k, colours.get(k), 'Colour of ' + partLabel(k), PART_COLOURS[0]);
      item.append(sw, document.createTextNode(partLabel(k)));
      line.appendChild(item);
    });
    key.appendChild(line);
  });
  drawKeyZeros(key, c, choice);
  raiseScaleLabels(chart);
  return chart;
}

// A line per rectangle across the periods, a point on each period with its number where there is
// room; the model's own numbers (or A's) as a dashed line once a slider has changed them. A line
// is broken where a period can't be worked out, and that period's problem is listed.
function drawLines(c, results, problems, key){
  const now = linesFigures(c, results), was = linesFigures(c, compareResults());
  const colours = partColours(c);
  const n = Math.max(1, now.length);
  // Numbers on the points only when they can be read: few periods and few lines.
  const labels = n <= 12 && c.lines.length <= 3;
  let lo = 0, hi = 0;
  now.concat(was).forEach(f => f.values.forEach(r => { if(!r.error){ lo = Math.min(lo, r.value); hi = Math.max(hi, r.value); } }));
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(c, lo, hi); // Auto, or the chart's fixed scale (04d-scale.js)
  const W = 560, top = 18 + (labels ? 14 : 0), bottom = 22, H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / n;
  const xOf = (i) => 4 + slot * i + slot / 2;
  const chart = svg('svg', { class: 'bar-chart lines-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-layout': 'lines' });
  chart.setAttribute('aria-label', c.title || 'Lines');
  drawScaleAxis(chart, sc, y, W, top, plotH);
  now.forEach((f, i) => {
    if(n <= 8 || i === 0 || i === n - 1) chart.appendChild(svg('text', { class: 't-period', x: xOf(i), y: H - 6, 'text-anchor': 'middle' }, model.periods[f.p]));
  });
  if(!c.lines.length) problems.push('No lines yet: Edit chart adds them.');
  // A polyline through the runs of points that can be worked out.
  const path = (g, cls, pts, colour) => {
    let run = [];
    const flush = () => { if(run.length > 1) g.appendChild(svg('polyline', Object.assign({ class: cls, points: run.join(' '), fill: 'none' }, colour ? { stroke: colour } : {}))); run = []; };
    pts.forEach(pt => { if(!pt) flush(); else run.push(pt[0].toFixed(1) + ',' + pt[1].toFixed(1)); });
    flush();
  };
  c.lines.forEach((k, li) => {
    const name = partLabel(k), colour = colours.get(k);
    const g = svg('g', { class: 'l-line', 'data-line': name });
    const vals = now.map(f => f.values[li]), before = was.map(f => f.values[li]);
    // The model's own (or A's) numbers, dashed, when any of them differs from what is shown.
    const moved = vals.some((r, i) => !r.error && !before[i].error && !agree(r.value, before[i].value));
    if(moved) path(g, 'l-base', before.map((r, i) => r.error ? null : [xOf(i), y(r.value)]), null);
    path(g, 'l-path', vals.map((r, i) => r.error ? null : [xOf(i), y(r.value)]), colour);
    vals.forEach((r, i) => {
      const p = now[i].p, cx = xOf(i);
      if(r.error){
        problems.push(model.periods[p] + ', ' + name + ': ' + errorText(r.error));
        g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
        return;
      }
      const b = before[i];
      const diff = !b.error ? fmtDiff(r.value, b.value) : '';
      const dot = svg('circle', { class: 'l-point', cx, cy: y(r.value), r: 3, fill: colour });
      dot.appendChild(svg('title', {}, name + ', ' + model.periods[p] + ': ' + fmtNum(r.value) + (diff ? ' — was ' + fmtNum(b.value) + ', ' + diff : '')));
      g.appendChild(dot);
      drawOverMarks(g, sc, cx, top, plotH, r.value, r.value);
      if(labels) g.appendChild(svg('text', { class: 't-value', x: cx, y: y(r.value) - 6, 'text-anchor': 'middle' }, fmtNum(r.value)));
    });
    chart.appendChild(g);
  });
  // The key: each line's colour; its swatch picks it (those at 0 left out).
  const choice = keyChoice(c, c.lines, periodsOf(c.periods), results);
  const line = make('div', 'key-line');
  [...new Set(c.lines)].filter(choice.shows).forEach(k => {
    const item = markKeyZero(make('label', 'key-item'), k, choice);
    const sw = rectKeySwatch(k, colours.get(k), 'Colour of ' + partLabel(k), PART_COLOURS[0]);
    item.append(sw, document.createTextNode(partLabel(k)));
    line.appendChild(item);
  });
  key.appendChild(line);
  drawKeyZeros(key, c, choice);
  raiseScaleLabels(chart);
  return chart;
}

function drawFlow(c, results, problems){
  const now = flowFigures(c, results), was = flowFigures(c, compareResults());
  const n = Math.max(1, now.length), labels = n <= 12;
  let lo = 0, hi = 0;
  now.concat(was).forEach(f => { if(!f.error){ lo = Math.min(lo, f.from, f.to); hi = Math.max(hi, f.from, f.to); } });
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(c, lo, hi);
  const W = 560, top = 18 + (labels ? 30 : 0), bottom = 36, H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / n, bw = Math.max(3, Math.min(46, slot * 0.62));
  const chart = svg('svg', { class: 'bar-chart flow-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', (c.title || 'Waterfall') + ', ' + model.periods[c.period]);
  drawScaleAxis(chart, sc, y, W, top, plotH);
  let prevEnd = null;
  now.forEach((f, i) => {
    const s = c.steps[i], name = partLabel(s.key);
    const cx = 4 + slot * i + slot / 2, x = cx - bw / 2;
    const g = svg('g', { class: 'f-step', 'data-role': s.role });
    if(f.error){
      g.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
      g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
      problems.push(name + ': ' + errorText(f.error));
      prevEnd = null;
    } else {
      if(prevEnd !== null && (s.role === 'add' || s.role === 'subtract')) g.appendChild(svg('line', { class: 'f-link', x1: x - (slot - bw), x2: x, y1: y(prevEnd), y2: y(prevEnd) }));
      const kind = (s.role === 'start' || s.role === 'total') ? 'f-total' : (f.to >= f.from ? 'f-up' : 'f-down');
      const rect = animKey(svg('rect', { class: 'f-bar ' + kind, x, y: Math.min(y(f.from), y(f.to)), width: bw, height: Math.max(1, Math.abs(y(f.to) - y(f.from))) }), c.id + '|' + i);
      if(chosenColour(s.key)) rect.style.fill = chosenColour(s.key); // a style, over the page's colours by direction
      const b = was[i];
      const diff = b && !b.error ? fmtDiff(f.value, b.value) : '';
      rect.appendChild(svg('title', {}, name + ' (' + ROLE_LABELS[s.role].toLowerCase() + '), ' + model.periods[c.period] + ': ' + fmtNum(f.value) + (diff ? ' — was ' + fmtNum(b.value) + ', ' + diff : '')));
      g.appendChild(rect);
      drawOverMarks(g, sc, cx, top, plotH, Math.max(f.from, f.to), Math.min(f.from, f.to));
      if(b && !b.error && (!agree(b.from, f.from) || !agree(b.to, f.to))){
        g.appendChild(svg('rect', { class: 'b-base', x, y: Math.min(y(b.from), y(b.to)), width: bw, height: Math.max(1, Math.abs(y(b.to) - y(b.from))) }));
      }
      if(labels){
        const shown = s.role === 'add' ? (f.value >= 0 ? '+' : '') + fmtNum(f.value) : s.role === 'subtract' ? '−' + fmtNum(f.value) : fmtNum(f.value);
        const topY = Math.min(y(f.from), y(f.to));
        g.appendChild(svg('text', { class: 't-value', x: cx, y: topY - 4, 'text-anchor': 'middle' }, shown.replace('−−', '+')));
        if(diff) g.appendChild(svg('text', { class: 't-diff ' + (f.value > b.value ? 'up' : 'down'), x: cx, y: topY - 17, 'text-anchor': 'middle' }, diff.split(' ')[0]));
      }
      if(f.check && !f.check.error){
        const t = svg('text', { class: 't-check ' + (f.check.ok ? 'ok' : 'bad'), x: cx, y: 13, 'text-anchor': 'middle' }, f.check.ok ? '✓' : '✗');
        t.appendChild(svg('title', {}, f.check.ok ? 'The steps before it add up to it' : 'The steps before it add up to ' + fmtNum(f.check.expected)));
        g.appendChild(t);
        if(!f.check.ok) problems.push(name + ': the steps before it add up to ' + fmtNum(f.check.expected) + ', not ' + fmtNum(f.value) + '.');
      }
      prevEnd = f.to;
    }
    // The step's name under it, shortened to fit (in full when pointed at).
    const room = Math.max(3, Math.floor(slot / 6.2));
    const label = svg('text', { class: 't-period', x: cx, y: H - 20, 'text-anchor': 'middle' }, name.length > room ? name.slice(0, room - 1) + '…' : name);
    label.appendChild(svg('title', {}, name));
    g.appendChild(label);
    chart.appendChild(g);
  });
  chart.appendChild(svg('text', { class: 't-period', x: W / 2, y: H - 4, 'text-anchor': 'middle' }, model.periods[c.period]));
  raiseScaleLabels(chart);
  return chart;
}

// The scenario waterfall (scenarios S2): one small waterfall per output, side by side, from the
// model's own number through each scenario to the last. It shows the scenarios, not where the
// sliders are now, so moving a slider leaves it as it is.
function drawScenarioFlows(c, problems){
  const wrap = make('div', 'scenario-flows');
  const chain = chartScenarios(c);
  if(!scenarios.length) problems.push('No scenarios yet: save some in the Scenarios panel, under the sliders.');
  else if(!chain.length) problems.push('None of the scenarios is ticked: Edit chart chooses them.');
  if(c.use){
    const gone = c.use.filter(n => !scenarios.some(sc => sameName(sc.name, n)));
    if(gone.length) problems.push('No scenario called ' + gone.map(n => '“' + n + '”').join(', ') + ' any more.');
  }
  if(!c.outputs.length) problems.push('No outputs yet: Edit chart adds them.');
  const memo = new Map();
  const resultsFor = (sc) => { if(!memo.has(sc)) memo.set(sc, scenarioResults(sc)); return memo.get(sc); };
  const all = c.outputs.map(key => scenarioFigures(c, key, resultsFor));
  // Fix at current scale takes in every output: a fixed scale is shared by them all.
  let lo = 0, hi = 0;
  all.forEach(figs => figs.forEach(f => { if(!f.error){ lo = Math.min(lo, f.from, f.to); hi = Math.max(hi, f.from, f.to); } }));
  autoScales.set(c.id, { lo, hi: hi === lo ? lo + 1 : hi });
  c.outputs.forEach((key, oi) => wrap.appendChild(drawScenarioFlow(c, key, oi, all[oi], problems)));
  return wrap;
}
function drawScenarioFlow(c, key, oi, figs, problems){
  const name = partLabel(key);
  const n = Math.max(1, figs.length), labels = n <= 14;
  let lo = 0, hi = 0;
  figs.forEach(f => { if(!f.error){ lo = Math.min(lo, f.from, f.to); hi = Math.max(hi, f.from, f.to); } });
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(c, lo, hi, false);
  const W = Math.max(260, Math.min(560, 70 + n * 52)), top = 34 + (labels ? 14 : 0), bottom = 36, H = 150 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / n, bw = Math.max(3, Math.min(46, slot * 0.62));
  const chart = svg('svg', { class: 'bar-chart flow-chart scenario-flow' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-output': name });
  chart.setAttribute('aria-label', name + ' through the scenarios, ' + model.periods[c.period]);
  chart.appendChild(svg('text', { class: 't-flow-title', x: 6, y: 14 }, name + ' — ' + model.periods[c.period]));
  drawScaleAxis(chart, sc, y, W, top, plotH);
  let prevEnd = null;
  figs.forEach((f, i) => {
    const cx = 4 + slot * i + slot / 2, x = cx - bw / 2;
    const g = svg('g', { class: 'f-step', 'data-kind': f.kind });
    if(f.error){
      g.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
      g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
      problems.push(name + ', ' + f.name + ': ' + errorText(f.error));
      prevEnd = null;
    } else {
      if(prevEnd !== null && f.kind === 'step') g.appendChild(svg('line', { class: 'f-link', x1: x - (slot - bw), x2: x, y1: y(prevEnd), y2: y(prevEnd) }));
      const kind = f.kind === 'step' ? (f.to >= f.from ? 'f-up' : 'f-down') : 'f-total';
      const rect = animKey(svg('rect', { class: 'f-bar ' + kind, x, y: Math.min(y(f.from), y(f.to)), width: bw, height: Math.max(1, Math.abs(y(f.to) - y(f.from))) }), c.id + '|' + oi + '|' + i);
      rect.appendChild(svg('title', {}, f.kind === 'step'
        ? f.name + ': ' + fmtNum(f.number) + ' (' + (f.value >= 0 ? '+' : '−') + fmtNum(Math.abs(f.value)) + ' from ' + (i === 1 ? 'the start' : figs[i - 1].name) + ')'
        : (f.kind === 'start' ? 'Start (the model\'s own number)' : 'End (' + figs[figs.length - 2].name + ')') + ': ' + fmtNum(f.value)));
      g.appendChild(rect);
      drawOverMarks(g, sc, cx, top, plotH, Math.max(f.from, f.to), Math.min(f.from, f.to));
      if(labels){
        const shown = f.kind === 'step' ? (f.value >= 0 ? '+' : '−') + fmtNum(Math.abs(f.value)) : fmtNum(f.value);
        g.appendChild(svg('text', { class: 't-value', x: cx, y: Math.min(y(f.from), y(f.to)) - 4, 'text-anchor': 'middle' }, shown));
      }
      prevEnd = f.to;
    }
    const room = Math.max(3, Math.floor(slot / 6.2));
    const label = svg('text', { class: 't-period', x: cx, y: H - 20, 'text-anchor': 'middle' }, f.name.length > room ? f.name.slice(0, room - 1) + '…' : f.name);
    label.appendChild(svg('title', {}, f.name));
    g.appendChild(label);
    chart.appendChild(g);
  });
  raiseScaleLabels(chart);
  return chart;
}

const TORNADO_LOW = '#2563eb', TORNADO_HIGH = '#d97706';
const shortName = (name, room) => name.length > room ? name.slice(0, Math.max(1, room - 1)) + '…' : name;
const signed = (v, by) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v)) + (by === 'percent' ? '%' : '');
// A Spider line's colour: its input's shared one (04e-colours.js).
function spiderColour(c, key, i){ return rectColour(key) || PART_COLOURS[i % PART_COLOURS.length]; }

function drawSensitivity(c, problems, key){
  const { figures, ready } = sensitivityNow(c, shownOverrides());
  const where = model.periods[c.period];
  const name = c.output ? partLabel(c.output) : '';
  const kind = c.layout === 'tornado' ? 'Tornado' : 'Spider';
  if(!c.output) problems.push('No output yet: Edit chart chooses it.');
  else if(!c.inputs.length){
    const reaching = sensitivityStart(c.output).inputs.length;
    problems.push(reaching ? 'No inputs yet: in Edit chart, + Input adds one, or ↻ takes ' + (reaching === 1 ? 'the one that reaches ' : 'the ' + reaching + ' that reach ') + name + '.'
      : 'No inputs to move: none reaches ' + name + '.');
  }
  if(!ready) problems.push('Working out…');
  const W = 560;
  if(!figures || !figures.inputs.length){
    const empty = svg('svg', { class: 'bar-chart sens-chart sens-empty', viewBox: '0 0 ' + W + ' 40', role: 'img', 'data-layout': c.layout });
    empty.setAttribute('aria-label', (c.title || kind) + (name ? ', ' + name + ', ' + where : ''));
    return empty;
  }
  if(typeof figures.base === 'object'){
    problems.push(name + ', ' + where + ': ' + errorText(figures.base.error));
    const bad = svg('svg', { class: 'bar-chart sens-chart', viewBox: '0 0 ' + W + ' 40', role: 'img', 'data-layout': c.layout });
    bad.setAttribute('aria-label', (c.title || kind) + ', ' + name + ', ' + where);
    return bad;
  }
  const shown = figures.inputs.filter(f => f.show);
  shown.filter(f => f.error).forEach(f => problems.push(partLabel(f.key) + ': ' + errorText(f.error)));
  // Inputs that are 0 don't move by percent: say so.
  const flat = shown.filter(f => !f.error && f.by === 'percent' && f.swing === 0 && model.periods.every((_, p) => baseValue(model.byKey.get(f.key), p) === 0));
  if(flat.length) problems.push(flat.map(f => partLabel(f.key)).join(', ') + ' is 0: a change by percent doesn\'t move it (an amount would).');
  const chart = c.layout === 'tornado' ? drawTornado(c, figures, shown, name, where) : drawSpider(c, figures, shown, name, where);
  if(!ready) chart.classList.add('stale');
  // The key: its swatches pick the colours (on fmGraph's page).
  const line = make('div', 'key-line');
  const swatch = (sw, text) => {
    const item = make('label', 'key-item');
    item.append(sw, document.createTextNode(text));
    line.appendChild(item);
  };
  if(c.layout === 'tornado'){
    // The chart's own colours; Automatic goes back to the usual blue and orange.
    swatch(chartKeySwatch(c, 'colour', c.colour || TORNADO_LOW, 'Colour of Low', TORNADO_LOW), 'Low');
    swatch(chartKeySwatch(c, 'colour2', c.colour2 || TORNADO_HIGH, 'Colour of High', TORNADO_HIGH), 'High');
  } else {
    // An input at 0 whose line stays flat (it moves nothing) is left out, as at 0 elsewhere.
    const flatAtZero = new Set(shown.filter(f => !f.error && f.swing === 0).map(f => f.key));
    const choice = keyChoice(c, [...flatAtZero], [c.period], currentResults());
    figures.inputs.forEach((f, i) => {
      if(!f.show || !choice.shows(f.key)) return;
      swatch(rectKeySwatch(f.key, spiderColour(c, f.key, i), 'Colour of ' + partLabel(f.key), PART_COLOURS[i % PART_COLOURS.length]), partLabel(f.key));
      markKeyZero(line.lastChild, f.key, choice);
    });
    key.appendChild(line);
    drawKeyZeros(key, c, choice);
    raiseScaleLabels(chart);
    return chart;
  }
  key.appendChild(line);
  raiseScaleLabels(chart);
  return chart;
}

// One bar per input across the page, from the base to Low and to High, largest swing at the top.
function drawTornado(c, figures, shown, name, where){
  const base = figures.base;
  let lo = base, hi = base;
  shown.forEach(f => { if(!f.error){ lo = Math.min(lo, f.lowValue, f.highValue); hi = Math.max(hi, f.lowValue, f.highValue); } });
  if(hi === lo){ lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.04;
  const sc = scaleFor(c, lo - pad, hi + pad);
  const W = 560, left = 130, right = 12, top = 30, rowH = 26, bottom = 20;
  const H = top + Math.max(1, shown.length) * rowH + bottom, plotW = W - left - right;
  const x = (v) => left + (Math.max(sc.lo, Math.min(sc.hi, v)) - sc.lo) / (sc.hi - sc.lo) * plotW;
  const chart = svg('svg', { class: 'bar-chart sens-chart tornado-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-layout': 'tornado' });
  chart.setAttribute('aria-label', (c.title || 'Tornado') + ': what moves ' + name + ', ' + where);
  chart.appendChild(svg('text', { class: 't-flow-title', x: 6, y: 14 }, name + ' — ' + where));
  const bx = x(base);
  if(sc.fixed){
    chart.appendChild(svg('text', { class: 't-axis', x: left, y: H - 4, 'text-anchor': 'start' }, fmtNum(sc.lo)));
    chart.appendChild(svg('text', { class: 't-axis', x: W - right, y: H - 4, 'text-anchor': 'end' }, fmtNum(sc.hi)));
  }
  const lowColour = c.colour || TORNADO_LOW, highColour = c.colour2 || TORNADO_HIGH;
  shown.forEach((f, i) => {
    const label = partLabel(f.key), yTop = top + i * rowH, cy = yTop + rowH / 2;
    const g = svg('g', { class: 's-row', 'data-input': label });
    const t = svg('text', { class: 't-period s-name', x: left - 6, y: cy + 4, 'text-anchor': 'end' }, shortName(label, 20));
    t.appendChild(svg('title', {}, label + ' (' + signed(f.low, f.by) + ' … ' + signed(f.high, f.by) + ')'));
    g.appendChild(t);
    if(f.error){
      g.appendChild(svg('rect', { class: 'b-err', x: left, y: yTop + 4, width: plotW, height: rowH - 8 }));
      g.appendChild(svg('text', { class: 't-err', x: left + plotW / 2, y: cy + 4, 'text-anchor': 'middle' }, '!'));
    } else {
      [['low', f.lowValue, lowColour, f.low], ['high', f.highValue, highColour, f.high]].forEach(([side, v, colour, change]) => {
        const r = svg('rect', { class: 's-bar s-' + side, x: Math.min(bx, x(v)), y: yTop + 4, width: Math.max(v === base ? 0 : 1, Math.abs(x(v) - bx)), height: rowH - 8, fill: colour });
        r.dataset.axis = 'x';
        animKey(r, c.id + '|' + f.key + '|' + side);
        r.appendChild(svg('title', {}, label + ' ' + signed(change, f.by) + ': ' + name + ' ' + fmtNum(v) + ' (' + (v - base >= 0 ? '+' : '−') + fmtNum(Math.abs(v - base)) + ')'));
        g.appendChild(r);
        // The value at the bar's end, outside it.
        const rightOf = v >= base;
        const tx = x(v) + (rightOf ? 3 : -3);
        if(tx > left + 20 && tx < W - 20) g.appendChild(svg('text', { class: 't-value s-end', x: tx, y: cy + 4, 'text-anchor': rightOf ? 'start' : 'end' }, fmtNum(v)));
      });
      if(sc.fixed){
        const over = (v) => v > sc.hi || v < sc.lo;
        [f.lowValue, f.highValue].forEach(v => { if(over(v)) g.appendChild(svg('text', { class: 't-over', x: v > sc.hi ? W - right - 6 : left + 6, y: cy + 4, 'text-anchor': 'middle' }, v > sc.hi ? '▶' : '◀')); });
      }
    }
    chart.appendChild(g);
  });
  chart.appendChild(svg('line', { class: 's-base', x1: bx, x2: bx, y1: top - 4, y2: H - bottom + 2 }));
  chart.appendChild(svg('text', { class: 't-value s-base-label', x: bx, y: top - 7, 'text-anchor': 'middle' }, fmtNum(base)));
  return chart;
}

// A line per input through its points, from Low (left) through the base to High (right).
function drawSpider(c, figures, shown, name, where){
  const base = figures.base;
  let lo = base, hi = base;
  shown.forEach(f => f.points.forEach(p => { if(!p.error){ lo = Math.min(lo, p.value); hi = Math.max(hi, p.value); } }));
  if(hi === lo){ lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.05;
  const sc = scaleFor(c, lo - pad, hi + pad);
  const W = 560, left = 64, right = 12, top = 24, bottom = 24, H = 230;
  const plotW = W - left - right, plotH = H - top - bottom;
  const x = (at) => left + (at + 1) / 2 * plotW;
  const y = scaleY(top, plotH, sc);
  const chart = svg('svg', { class: 'bar-chart sens-chart spider-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-layout': 'spider' });
  chart.setAttribute('aria-label', (c.title || 'Spider') + ': what moves ' + name + ', ' + where);
  chart.appendChild(svg('text', { class: 't-flow-title', x: 6, y: 14 }, name + ' — ' + where));
  chart.appendChild(svg('line', { class: 's-axis', x1: x(0), x2: x(0), y1: top, y2: top + plotH }));
  chart.appendChild(svg('line', { class: 's-base', x1: left, x2: W - right, y1: y(base), y2: y(base) }));
  chart.appendChild(svg('text', { class: 't-axis s-side', x: left - 4, y: y(sc.hi) + 10, 'text-anchor': 'end' }, fmtNum(sc.hi)));
  chart.appendChild(svg('text', { class: 't-axis s-side', x: left - 4, y: y(sc.lo) - 2, 'text-anchor': 'end' }, fmtNum(sc.lo)));
  chart.appendChild(svg('text', { class: 't-value s-base-label', x: left - 4, y: y(base) + 4, 'text-anchor': 'end' }, fmtNum(base)));
  [['Low', x(-1), 'start'], ['0', x(0), 'middle'], ['High', x(1), 'end']].forEach(([t, at, anchor]) => chart.appendChild(svg('text', { class: 't-period', x: at, y: H - 6, 'text-anchor': anchor }, t)));
  figures.inputs.forEach((f, i) => {
    if(!f.show) return;
    const label = partLabel(f.key), colour = spiderColour(c, f.key, i);
    const g = svg('g', { class: 's-line', 'data-input': label });
    // Broken where a point can't be worked out.
    let run = [];
    const flush = () => {
      if(run.length > 1) g.appendChild(svg('polyline', { class: 's-path', points: run.join(' '), fill: 'none', stroke: colour }));
      run = [];
    };
    f.points.forEach(p => {
      if(p.error){ flush(); return; }
      const px = x(p.at), py = y(p.value);
      run.push(px.toFixed(1) + ',' + py.toFixed(1));
      const dot = svg('circle', { class: 's-point', cx: px, cy: py, r: 2.5, fill: colour });
      dot.appendChild(svg('title', {}, label + ' ' + signed(p.change, f.by) + ': ' + name + ' ' + fmtNum(p.value)));
      g.appendChild(dot);
    });
    flush();
    chart.appendChild(g);
  });
  return chart;
}
