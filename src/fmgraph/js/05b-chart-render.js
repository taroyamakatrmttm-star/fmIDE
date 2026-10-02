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
  const head = make('div', 'widget-head');
  const title = make('input', 'chart-title');
  title.type = 'text';
  title.placeholder = c.layout === 'flow' ? 'Waterfall title' : 'Chart title';
  title.value = c.title;
  title.maxLength = CHART_LIMITS.title;
  title.setAttribute('aria-label', 'Chart title');
  title.addEventListener('change', () => { c.title = cleanText(title.value, CHART_LIMITS.title); saveBoardSoon(); });
  const layout = make('select');
  layout.setAttribute('aria-label', 'Kind of chart');
  [['columns', 'Columns'], ['flow', 'Waterfall']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; if(c.layout === v) o.selected = true; layout.appendChild(o); });
  layout.addEventListener('change', () => { switchLayout(c, layout.value); saveBoardSoon(); renderBoard(); });
  head.append(title, layout, removeButton(c.id, 'chart'));
  w.append(head, make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
  w.appendChild(chartEditor(c));
  return w;
}

// Columns ↔ waterfall keeps the rectangles: every part becomes a step (the first a start,
// the rest added), and every step a part of one group.
function switchLayout(c, layout){
  if(layout === c.layout) return;
  if(layout === 'flow'){
    const keys = chartKeys(c);
    Object.assign(c, { layout: 'flow', period: periodsOf(c.periods)[0] || 0, steps: keys.map((key, i) => ({ key, role: i === 0 ? 'start' : 'add' })) });
    delete c.groups; delete c.periods; delete c.check;
  } else {
    const keys = chartKeys(c);
    Object.assign(c, { layout: 'columns', periods: { mode: 'all' }, groups: [{ name: '', parts: keys }], check: false });
    delete c.steps; delete c.period;
  }
}

function chartEditor(c){
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
  else host.appendChild(drawColumns(c, results, problems, key));
  glide(host);
  // Rectangles in different units side by side or stacked don't add up: say so.
  const units = [...new Set(chartKeys(c).map(k => model.byKey.get(k)).filter(r => r && r.unit).map(r => r.unit))];
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
  const checked = now.some(f => f.check);
  const W = 560, top = 18 + (labels ? 16 : 0) + (checked ? 16 : 0), bottom = 22 + (lo < 0 && labels ? 16 : 0), H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = (v) => top + (hi - v) / (hi - lo) * plotH;
  const slot = (W - 8) / n, gap = 6;
  const bw = Math.max(3, Math.min(44, (slot * 0.8 - gap * (ng - 1)) / ng));
  const chart = svg('svg', { class: 'bar-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', c.title || 'Columns');
  chart.appendChild(svg('line', { class: 'b-zero', x1: 0, x2: W, y1: y(0), y2: y(0) }));
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
  return chart;
}

function drawFlow(c, results, problems){
  const now = flowFigures(c, results), was = flowFigures(c, compareResults());
  const n = Math.max(1, now.length), labels = n <= 12;
  let lo = 0, hi = 0;
  now.concat(was).forEach(f => { if(!f.error){ lo = Math.min(lo, f.from, f.to); hi = Math.max(hi, f.from, f.to); } });
  if(hi === lo) hi = lo + 1;
  const W = 560, top = 18 + (labels ? 30 : 0), bottom = 36, H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = (v) => top + (hi - v) / (hi - lo) * plotH;
  const slot = (W - 8) / n, bw = Math.max(3, Math.min(46, slot * 0.62));
  const chart = svg('svg', { class: 'bar-chart flow-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', (c.title || 'Waterfall') + ', ' + model.periods[c.period]);
  chart.appendChild(svg('line', { class: 'b-zero', x1: 0, x2: W, y1: y(0), y2: y(0) }));
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
  return chart;
}
