// ============================================================
// Drawing and editing charts (G2; the data is 04b-charts.js). A chart widget has its chart, a
// key of what each colour is, any problems (errors, totals that don't agree) as text, and
// "Edit chart", where its groups and rectangles (or its steps) are chosen. Like a bar widget,
// it shows the model's own values as dashed outlines once a slider has changed them, and lights
// up when a slider reaches any of its rectangles.
// ============================================================
const PART_COLOURS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#9f1239'];
const chartsEditing = new Set(); // charts whose editor is open (this page only)
const ROLE_LABELS = { start: 'Start', add: 'Add', subtract: 'Subtract', total: 'Total' };

function chartWidget(c){
  const w = make('div', 'widget chart-widget');
  w.dataset.id = c.id;
  w.dataset.layout = c.layout;
  // On a phone, holding the chart opens its quick look (05g-phone.js).
  w.addEventListener('pointerdown', (ev) => phoneBarPress(ev, c));
  w.addEventListener('contextmenu', (ev) => { if(isPhone()) ev.preventDefault(); });
  const head = make('div', 'widget-head');
  const title = make('input', 'chart-title');
  title.type = 'text';
  title.placeholder = c.layout === 'columns' || isSensitivity(c) ? 'Chart title' : 'Waterfall title';
  title.value = c.title;
  title.maxLength = CHART_LIMITS.title;
  title.setAttribute('aria-label', 'Chart title');
  title.addEventListener('change', () => { c.title = cleanText(title.value, CHART_LIMITS.title); saveBoardSoon(); });
  const layout = make('select');
  layout.setAttribute('aria-label', 'Kind of chart');
  [['columns', 'Columns'], ['flow', 'Waterfall'], ['scenarios', 'Scenario waterfall'], ['tornado', 'Tornado'], ['spider', 'Spider']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; if(c.layout === v) o.selected = true; layout.appendChild(o); });
  layout.addEventListener('change', () => { switchLayout(c, layout.value); saveBoardSoon(); renderBoard(); });
  head.append(title, layout, removeButton(c.id, 'chart'));
  w.append(head, make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
  w.appendChild(chartEditor(c));
  return w;
}

// Switching kind keeps the rectangles: every part becomes a step (the first a start, the rest
// added), every step a part of one group, and a scenario waterfall's outputs the first six of
// them (calculated rectangles first). A Tornado or Spider measures the first calculated one,
// moving every input that reaches it (step 18); between the two they keep everything.
function switchLayout(c, layout){
  if(layout === c.layout) return;
  if(isSensitivity(c) && SENSITIVITY_LAYOUTS.includes(layout)){ c.layout = layout; return; }
  const keys = chartKeys(c);
  const period = c.layout === 'columns' ? (periodsOf(c.periods)[0] || 0) : c.period;
  ['groups', 'periods', 'check', 'steps', 'period', 'outputs', 'use', 'output', 'inputs', 'colour', 'colour2'].forEach(k => { delete c[k]; });
  if(layout === 'flow') Object.assign(c, { layout: 'flow', period, steps: keys.map((key, i) => ({ key, role: i === 0 ? 'start' : 'add' })) });
  else if(layout === 'scenarios'){
    const unique = [...new Set(keys)];
    const calc = unique.filter(k => !model.byKey.get(k).input).concat(unique.filter(k => model.byKey.get(k).input));
    Object.assign(c, { layout: 'scenarios', period, outputs: calc.slice(0, CHART_LIMITS.outputs), use: null });
  }
  else if(SENSITIVITY_LAYOUTS.includes(layout)){
    const start = sensitivityStart(keys.find(k => !model.byKey.get(k).input));
    c.colours = {};
    Object.assign(c, { layout, period, output: start.output, inputs: start.inputs, steps: SENSITIVITY_LIMITS.defaultSteps, colour: null, colour2: null });
  }
  else Object.assign(c, { layout: 'columns', periods: { mode: 'all' }, groups: [{ name: '', parts: keys }], check: false });
}

// Which editors are open, read from the page just before it is drawn again: the browser tells
// the 'toggle' listener a moment after the click, so a redraw in between (a slow machine) would
// otherwise close an editor just opened.
function rememberOpenEditors(){
  document.querySelectorAll('#barList .chart-widget').forEach(el => {
    const box = el.querySelector('details.chart-edit');
    if(!box) return;
    if(box.open) chartsEditing.add(el.dataset.id); else chartsEditing.delete(el.dataset.id);
  });
}

// Edit chart: what the chart shows, then its vertical scale (04d-scale.js).
function chartEditor(c){
  const box = chartEditorParts(c);
  const scaleRow = make('div', 'widget-row scale-row');
  scaleRow.appendChild(scaleChooser(c, () => { saveBoardSoon(); updateValues(); }));
  box.appendChild(scaleRow);
  return box;
}
function chartEditorParts(c){
  const box = make('details', 'chart-edit');
  if(chartsEditing.has(c.id)) box.open = true;
  box.addEventListener('toggle', () => { if(box.open) chartsEditing.add(c.id); else chartsEditing.delete(c.id); });
  box.appendChild(make('summary', null, 'Edit chart'));
  const changed = () => { saveBoardSoon(); renderBoard(); };
  // A row of buttons that move or remove item i of list.
  const rowButtons = (list, i) => {
    const b = make('span', 'row-buttons');
    const btn = (text, label, fn, off) => { const x = make('button', 'mini', text); x.type = 'button'; x.title = label; x.setAttribute('aria-label', label); x.disabled = !!off; x.addEventListener('click', fn); b.appendChild(x); };
    btn('↑', 'Move up', () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; changed(); }, i === 0);
    btn('↓', 'Move down', () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; changed(); }, i === list.length - 1);
    btn('×', 'Remove', () => { list.splice(i, 1); changed(); });
    return b;
  };
  const firstCalc = () => (model.rects.find(r => !r.input) || model.rects[0]).key;
  const periodRow = () => {
    const row = make('div', 'widget-row');
    const sel = make('select');
    sel.setAttribute('aria-label', 'Period');
    model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(i === c.period) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', () => { c.period = Number(sel.value); changed(); });
    row.append(make('span', null, 'In'), sel);
    return row;
  };
  if(isSensitivity(c)){
    // A2 brings the full editor (each input's mode, Low, High and Show); here: the output, its
    // period, the Spider's points, and the inputs it moves, listed.
    box.appendChild(periodRow());
    const outRow = make('div', 'edit-row output-row');
    const rs = rectSelect(c.output || firstCalc(), false);
    rs.setAttribute('aria-label', 'Output');
    rs.addEventListener('change', () => { c.output = rs.value; changed(); });
    outRow.append(make('span', null, 'Output'), rs);
    box.appendChild(outRow);
    if(c.layout === 'spider'){
      const row = make('div', 'widget-row');
      const sel = make('select');
      sel.setAttribute('aria-label', 'Points each side');
      for(let i = 1; i <= SENSITIVITY_LIMITS.steps; i++){ const o = make('option', null, String(i)); o.value = String(i); if(i === c.steps) o.selected = true; sel.appendChild(o); }
      sel.addEventListener('change', () => { c.steps = Number(sel.value); changed(); });
      row.append(make('span', null, 'Points each side'), sel);
      box.appendChild(row);
    }
    box.appendChild(make('div', 'edit-head', 'Inputs moved, one at a time'));
    if(!c.inputs.length) box.appendChild(make('p', 'empty-note', 'None yet: + Input adds one, or ↻ takes every input that reaches the output.'));
    c.inputs.forEach((inp, n) => box.appendChild(sensitivityInputRow(c, inp, n, changed, rowButtons)));
    const add = make('button', 'link-btn sens-add', '+ Input');
    add.type = 'button';
    const spare = () => {
      const listed = new Set(c.inputs.map(i => i.key));
      const free = model.inputs.filter(r => !listed.has(r.key));
      return free.find(r => c.output && model.reach(r.key).has(c.output)) || free[0];
    };
    add.disabled = c.inputs.length >= SENSITIVITY_LIMITS.inputs || !spare();
    add.addEventListener('click', () => {
      const r = spare();
      if(!r) return;
      c.inputs.push(Object.assign({ key: r.key, by: 'percent', show: true }, defaultBounds('percent')));
      changed();
    });
    box.appendChild(add);
    const reach = make('button', 'link-btn sens-reach', '↻ Use the inputs that reach the output');
    reach.type = 'button';
    reach.addEventListener('click', () => { c.inputs = sensitivityStart(c.output).inputs; changed(); });
    box.appendChild(reach);
    return box;
  }
  if(c.layout === 'scenarios'){
    box.appendChild(periodRow());
    box.appendChild(make('div', 'edit-head', 'Outputs'));
    c.outputs.forEach((key, i) => {
      const r = make('div', 'edit-row output-row');
      const rs = rectSelect(key, false);
      rs.addEventListener('change', () => { c.outputs[i] = rs.value; changed(); });
      r.append(rs, rowButtons(c.outputs, i));
      box.appendChild(r);
    });
    const add = make('button', 'link-btn add-output', '+ Output');
    add.type = 'button';
    add.disabled = c.outputs.length >= CHART_LIMITS.outputs;
    add.addEventListener('click', () => { c.outputs.push(firstCalc()); chartsEditing.add(c.id); changed(); });
    box.appendChild(add);
    box.appendChild(make('div', 'edit-head', 'Through the scenarios'));
    if(!scenarios.length) box.appendChild(make('p', 'empty-note', 'None yet: save some in the Scenarios panel.'));
    const ticks = make('div', 'scenario-ticks');
    scenarios.forEach(sc => {
      const l = make('label', 'scenario-tick');
      const t = make('input');
      t.type = 'checkbox';
      t.checked = !c.use || c.use.some(n => sameName(n, sc.name));
      t.addEventListener('change', () => {
        const picked = [...ticks.querySelectorAll('input')].map((x, i) => x.checked ? scenarios[i].name : null).filter(Boolean);
        c.use = picked.length === scenarios.length ? null : picked;
        changed();
      });
      l.append(t, document.createTextNode(sc.name));
      ticks.appendChild(l);
    });
    box.appendChild(ticks);
    return box;
  }
  if(c.layout === 'flow'){
    const row = make('div', 'widget-row');
    const sel = make('select');
    sel.setAttribute('aria-label', 'Period');
    model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(i === c.period) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', () => { c.period = Number(sel.value); changed(); });
    row.append(make('span', null, 'In'), sel);
    box.appendChild(row);
    c.steps.forEach((s, i) => {
      const r = make('div', 'edit-row step-row');
      const rs = rectSelect(s.key, false);
      rs.addEventListener('change', () => { s.key = rs.value; changed(); });
      const role = make('select');
      role.setAttribute('aria-label', 'Step');
      FLOW_ROLES.forEach(v => { const o = make('option', null, ROLE_LABELS[v]); o.value = v; if(s.role === v) o.selected = true; role.appendChild(o); });
      role.addEventListener('change', () => { s.role = role.value; changed(); });
      // Its own colour (otherwise by direction: up, down, or a full bar).
      const own = c.colours && c.colours[s.key];
      const pick = colourPicker(own || '#334155', 'Colour of this step', (v) => { c.colours = Object.assign({}, c.colours, { [s.key]: v }); changed(); });
      r.append(role, rs, pick, rowButtons(c.steps, i));
      box.appendChild(r);
    });
    const add = make('button', 'link-btn add-step', '+ Step');
    add.type = 'button';
    add.disabled = c.steps.length >= CHART_LIMITS.steps;
    add.addEventListener('click', () => { c.steps.push({ key: firstCalc(), role: c.steps.length ? 'add' : 'start' }); chartsEditing.add(c.id); changed(); });
    box.appendChild(add);
    return box;
  }
  const row = make('div', 'widget-row');
  row.appendChild(periodsChooser(c.periods, (p) => { c.periods = p; saveBoardSoon(); updateValues(); }));
  box.appendChild(row);
  const checkRow = make('label', 'widget-row check-row');
  const check = make('input');
  check.type = 'checkbox';
  check.checked = c.check;
  check.disabled = c.groups.length < 2;
  check.addEventListener('change', () => { c.check = check.checked; changed(); });
  checkRow.append(check, make('span', null, 'Check that the groups\' totals agree'));
  box.appendChild(checkRow);
  c.groups.forEach((g, gi) => {
    const set = make('fieldset', 'group-edit');
    const top = make('div', 'edit-row');
    const name = make('input', 'group-name');
    name.type = 'text';
    name.placeholder = 'Group ' + (gi + 1);
    name.value = g.name;
    name.maxLength = CHART_LIMITS.name;
    name.setAttribute('aria-label', 'Group name');
    name.addEventListener('change', () => { g.name = cleanText(name.value, CHART_LIMITS.name); saveBoardSoon(); updateValues(); });
    top.append(name, rowButtons(c.groups, gi));
    set.appendChild(top);
    g.parts.forEach((key, pi) => {
      const r = make('div', 'edit-row part-row');
      const rs = rectSelect(key, false);
      rs.addEventListener('change', () => { g.parts[pi] = rs.value; changed(); });
      r.append(rs, rowButtons(g.parts, pi));
      set.appendChild(r);
    });
    const add = make('button', 'link-btn add-part', '+ Rectangle');
    add.type = 'button';
    add.disabled = g.parts.length >= CHART_LIMITS.parts;
    add.addEventListener('click', () => { g.parts.push(firstCalc()); changed(); });
    set.appendChild(add);
    box.appendChild(set);
  });
  const addGroup = make('button', 'link-btn add-group', '+ Group');
  addGroup.type = 'button';
  addGroup.disabled = c.groups.length >= CHART_LIMITS.groups;
  addGroup.addEventListener('click', () => { c.groups.push({ name: '', parts: [firstCalc()] }); changed(); });
  box.appendChild(addGroup);
  return box;
}

function partLabel(key){ const r = model.byKey.get(key); return r ? r.name : '?'; }
function groupLabel(c, gi){ return c.groups[gi].name || 'Group ' + (gi + 1); }

function drawChart(el, c, results){
  const host = el.querySelector('.bar-chart-host'), key = el.querySelector('.chart-key'), list = el.querySelector('.bar-errors');
  host.textContent = ''; key.textContent = ''; list.textContent = '';
  const problems = [];
  if(c.layout === 'flow') host.appendChild(drawFlow(c, results, problems));
  else if(c.layout === 'scenarios') host.appendChild(drawScenarioFlows(c, problems));
  else if(isSensitivity(c)) host.appendChild(drawSensitivity(c, problems, key));
  else host.appendChild(drawColumns(c, results, problems, key));
  glide(host);
  // Rectangles in different units side by side or stacked don't add up: say so. (A Tornado's
  // inputs are only moved, never added up.)
  const units = isSensitivity(c) ? [] : [...new Set(chartKeys(c).map(k => model.byKey.get(k)).filter(r => r && r.unit).map(r => r.unit))];
  if(units.length > 1) problems.push('This chart mixes units (' + units.join(', ') + '): its totals may not mean much.');
  problems.forEach(t => list.appendChild(make('li', null, t)));
}

// The colour of each rectangle, in the order the chart lists them (the same rectangle twice
// keeps its first colour).
function partColours(c){
  const out = new Map();
  chartKeys(c).forEach(k => { if(!out.has(k)) out.set(k, PART_COLOURS[out.size % PART_COLOURS.length]); });
  Object.keys(c.colours || {}).forEach(k => { if(out.has(k)) out.set(k, c.colours[k]); });
  return out;
}

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
  // The key: each group, left to right, with its rectangles' colours.
  c.groups.forEach((grp, gi) => {
    const line = make('div', 'key-line');
    if(ng > 1) line.appendChild(make('span', 'key-group', groupLabel(c, gi) + ':'));
    grp.parts.forEach(k => {
      const item = make('label', 'key-item');
      // The swatch is the colour box: a click picks this rectangle's colour in this chart.
      const sw = colourPicker(colours.get(k), 'Colour of ' + partLabel(k), (v) => { c.colours = Object.assign({}, c.colours, { [k]: v }); saveBoardSoon(); updateValues(); });
      sw.classList.add('key-swatch');
      item.append(sw, document.createTextNode(partLabel(k)));
      line.appendChild(item);
    });
    key.appendChild(line);
  });
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
      if(c.colours && c.colours[s.key]) rect.style.fill = c.colours[s.key]; // a style, over the page's colours by direction
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

// ---- the Tornado and the Spider (step 18; figures in 04b-charts.js, kept in 03-calc.js) ----
// One input's row in Edit chart (A2): shown or not, the input, by percent or amount, Low and High,
// and what those are in the input's own numbers now ("now 10: 9 … 11", in the chart's period,
// with the sliders where they are).
function sensitivityInputRow(c, inp, n, changed, rowButtons){
  const wrap = make('div', 'sens-row');
  wrap.dataset.input = partLabel(inp.key);
  const row = make('div', 'edit-row');
  const show = make('input');
  show.type = 'checkbox';
  show.checked = inp.show;
  show.title = 'Show in the chart';
  show.setAttribute('aria-label', 'Show in the chart');
  show.addEventListener('change', () => { inp.show = show.checked; changed(); });
  const rs = rectSelect(inp.key, true);
  rs.addEventListener('change', () => {
    if(c.inputs.some((x, i) => i !== n && x.key === rs.value)){
      notify(partLabel(rs.value) + ' is already in this chart: each input is moved once.', 'err', 'chart');
      rs.value = inp.key;
      return;
    }
    notify('', null, 'chart');
    inp.key = rs.value;
    changed();
  });
  const by = make('select');
  by.setAttribute('aria-label', 'Change by');
  [['percent', '%'], ['amount', '±']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; o.title = v === 'percent' ? 'By a percent' : 'By an amount'; if(inp.by === v) o.selected = true; by.appendChild(o); });
  by.title = 'By a percent (%) or an amount (±)';
  // Another mode starts from its own Low and High (−10% … +10%, or −1 … +1).
  by.addEventListener('change', () => { Object.assign(inp, { by: by.value }, defaultBounds(by.value)); changed(); });
  const note = make('div', 'sens-own');
  const writeNote = () => {
    const rect = model.byKey.get(inp.key);
    const now = (shownOverrides().get(inp.key) || [])[c.period];
    const v = typeof now === 'number' ? now : baseValue(rect, c.period);
    const at = (x) => inp.by === 'amount' ? v + x : v * (1 + x / 100);
    note.textContent = 'Now ' + fmtNum(v) + ': ' + fmtNum(at(inp.low)) + ' … ' + fmtNum(at(inp.high)) + ' in ' + model.periods[c.period]
      + (inp.by === 'percent' && model.periods.every((_, p) => baseValue(rect, p) === 0) ? ' — it is 0, so a percent doesn\'t move it: choose ±.' : '');
  };
  const bound = (label, side) => {
    const box = make('input', 'sens-bound');
    box.type = 'number';
    box.step = 'any';
    box.value = String(inp[side]);
    box.title = label + (inp.by === 'percent' ? ' (%)' : '');
    box.setAttribute('aria-label', label);
    box.addEventListener('change', () => {
      const v = box.value.trim() === '' ? NaN : Number(box.value);
      if(!Number.isFinite(v)){
        notify(label + ' wasn\'t changed: it must be a number.', 'err', 'chart');
        box.value = String(inp[side]);
        return;
      }
      notify('', null, 'chart');
      inp[side] = cleanBound(v, inp[side]);
      box.value = String(inp[side]);
      writeNote();
      saveBoardSoon();
      updateValues();
    });
    return box;
  };
  row.append(show, rs, by, bound('Low', 'low'), make('span', 'scale-to', 'to'), bound('High', 'high'), rowButtons(c.inputs, n));
  writeNote();
  wrap.append(row, note);
  return wrap;
}

const TORNADO_LOW = '#2563eb', TORNADO_HIGH = '#d97706';
const shortName = (name, room) => name.length > room ? name.slice(0, Math.max(1, room - 1)) + '…' : name;
const signed = (v, by) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v)) + (by === 'percent' ? '%' : '');
// A Spider line's colour: its input's own, else the next of the chart colours.
function spiderColour(c, key, i){ return (c.colours && c.colours[key]) || PART_COLOURS[i % PART_COLOURS.length]; }

function drawSensitivity(c, problems, key){
  const { figures, ready } = sensitivityNow(c, shownOverrides());
  const where = model.periods[c.period];
  const name = c.output ? partLabel(c.output) : '';
  const kind = c.layout === 'tornado' ? 'Tornado' : 'Spider';
  if(!c.output) problems.push('No output yet: Edit chart chooses it.');
  else if(!c.inputs.length) problems.push('No inputs to move: none reaches ' + name + '.');
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
  // The key: its swatches pick the colours.
  const line = make('div', 'key-line');
  const swatch = (colour, label, text, set) => {
    const item = make('label', 'key-item');
    const sw = colourPicker(colour, label, (v) => { set(v); saveBoardSoon(); updateValues(); });
    sw.classList.add('key-swatch');
    item.append(sw, document.createTextNode(text));
    line.appendChild(item);
  };
  if(c.layout === 'tornado'){
    swatch(c.colour || TORNADO_LOW, 'Colour of Low', 'Low', (v) => { c.colour = v; });
    swatch(c.colour2 || TORNADO_HIGH, 'Colour of High', 'High', (v) => { c.colour2 = v; });
  } else {
    figures.inputs.forEach((f, i) => { if(f.show) swatch(spiderColour(c, f.key, i), 'Colour of ' + partLabel(f.key), partLabel(f.key), (v) => { c.colours = Object.assign({}, c.colours, { [f.key]: v }); }); });
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
