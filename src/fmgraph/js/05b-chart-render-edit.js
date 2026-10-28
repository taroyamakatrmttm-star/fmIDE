// ============================================================
// fmGraph's charts on its page: each chart's widget, Edit chart, and the key's colour boxes.
// Drawing the charts is 05b-chart-render.js, the board engine's.
// ============================================================

const chartsEditing = new Set(); // charts whose editor is open (this page only)

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
  title.placeholder = c.layout === 'columns' || c.layout === 'lines' || c.layout === 'free' || isSensitivity(c) ? 'Chart title' : 'Waterfall title';
  title.value = c.title;
  title.maxLength = CHART_LIMITS.title;
  title.setAttribute('aria-label', 'Chart title');
  title.addEventListener('change', () => { c.title = cleanText(title.value, CHART_LIMITS.title); saveBoardSoon(); });
  const layout = make('select');
  layout.setAttribute('aria-label', 'Kind of chart');
  [['columns', 'Columns'], ['lines', 'Lines'], ['flow', 'Waterfall'], ['free', 'Free'], ['scenarios', 'Scenario waterfall'], ['tornado', 'Tornado'], ['spider', 'Spider']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; if(c.layout === v) o.selected = true; layout.appendChild(o); });
  layout.addEventListener('change', () => { switchLayout(c, layout.value); saveBoardSoon(); renderBoard(); });
  head.append(title, layout, removeButton(c.id, 'chart'));
  w.append(head, make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
  w.appendChild(chartEditor(c));
  return w;
}

// Switching kind keeps the rectangles: every part becomes a step (the first a start, the rest
// added), every step a part of one group, a line each (once each, at most 12; between Columns
// and Lines the periods are kept, the groups' parts flattened into lines and the lines one group), and a scenario waterfall's outputs the first six of
// them (calculated rectangles first). A Tornado or Spider measures the first calculated one,
// moving every input that reaches it (step 18); between the two they keep everything. A Columns
// or Waterfall chart becomes a Free chart as + From chart… copies it (04f-free.js), any other
// its rectangles as one piece; a Free chart becomes Columns with a group per piece (at most 12).
function switchLayout(c, layout){
  if(layout === c.layout) return;
  if(isSensitivity(c) && SENSITIVITY_LAYOUTS.includes(layout)){ c.layout = layout; return; }
  const keys = chartKeys(c);
  const period = usesPeriods(c) ? (periodsOf(c.periods)[0] || 0) : c.period;
  const periods = usesPeriods(c) ? Object.assign({}, c.periods) : { mode: 'all' };
  const pieces = layout === 'free'
    ? (c.layout === 'columns' || c.layout === 'flow' ? piecesFromChart(c, 0)
      : keys.length ? [{ id: newPieceId(), name: '', column: 0, sits: { on: 'zero' }, minus: false, check: null, parts: [...new Set(keys)].slice(0, FREE_LIMITS.parts) }] : [])
    : null;
  const groups = c.layout === 'free' && layout === 'columns' ? c.pieces.slice(0, CHART_LIMITS.groups).map(p => ({ name: p.name, parts: p.parts.slice() })) : null;
  ['groups', 'periods', 'check', 'steps', 'period', 'outputs', 'use', 'output', 'inputs', 'colour', 'colour2', 'lines', 'pieces', 'notes'].forEach(k => { delete c[k]; });
  if(pieces){
    Object.assign(c, { layout: 'free', period, pieces: pieces.slice(0, FREE_LIMITS.pieces), notes: null });
    c.pieces.forEach(p => { p.column = Math.min(p.column, FREE_LIMITS.columns - 1); });
    settleColumns(c);
    return;
  }
  if(groups){
    Object.assign(c, { layout: 'columns', periods: { mode: 'one', p: period }, groups: groups.length ? groups : [{ name: '', parts: [] }], check: false });
    return;
  }
  if(layout === 'lines') Object.assign(c, { layout: 'lines', periods, lines: [...new Set(keys)].slice(0, CHART_LIMITS.lines) });
  else if(layout === 'flow') Object.assign(c, { layout: 'flow', period, steps: keys.map((key, i) => ({ key, role: i === 0 ? 'start' : 'add' })) });
  else if(layout === 'scenarios'){
    const unique = [...new Set(keys)];
    const calc = unique.filter(k => !model.byKey.get(k).input).concat(unique.filter(k => model.byKey.get(k).input));
    Object.assign(c, { layout: 'scenarios', period, outputs: calc.slice(0, CHART_LIMITS.outputs), use: null });
  }
  else if(SENSITIVITY_LAYOUTS.includes(layout)){
    const start = sensitivityStart(keys.find(k => !model.byKey.get(k).input));
    Object.assign(c, { layout, period, output: start.output, inputs: start.inputs, steps: SENSITIVITY_LIMITS.defaultSteps, colour: null, colour2: null });
  }
  else Object.assign(c, { layout: 'columns', periods, groups: [{ name: '', parts: keys }], check: false });
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
    row.append(make('span', null, 'In'), widgetPeriodSelect(c, changed)); // its own, or the shared period (05k)
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
    // The owner's request of 27 October 2026: empty the list in one undo step, to pick a few with + Input.
    const clear = make('button', 'link-btn sens-clear', '× Remove all inputs');
    clear.type = 'button';
    clear.disabled = !c.inputs.length;
    clear.addEventListener('click', () => { c.inputs = []; changed(); });
    box.appendChild(clear);
    return box;
  }
  if(c.layout === 'free'){ freeEditor(c, box, periodRow(), changed); return box; } // 05n-free-chart.js
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
  if(c.layout === 'lines'){
    const row = make('div', 'widget-row');
    row.appendChild(widgetPeriodsChooser(c)); // its own periods, or the shared ones (05k-shared-period.js)
    box.appendChild(row);
    box.appendChild(make('div', 'edit-head', 'Lines'));
    if(!c.lines.length) box.appendChild(make('p', 'empty-note', 'None yet: + Rectangle adds one.'));
    c.lines.forEach((key, i) => {
      const r = make('div', 'edit-row line-row');
      const rs = rectSelect(key, false);
      rs.setAttribute('aria-label', 'Line ' + (i + 1));
      rs.addEventListener('change', () => { c.lines[i] = rs.value; changed(); });
      r.append(rs, rowButtons(c.lines, i));
      box.appendChild(r);
    });
    const add = make('button', 'link-btn add-line', '+ Rectangle');
    add.type = 'button';
    add.disabled = c.lines.length >= CHART_LIMITS.lines;
    add.addEventListener('click', () => {
      // The next calculated rectangle not yet drawn, else the first.
      const listed = new Set(c.lines);
      const next = model.rects.find(r => !r.input && !listed.has(r.key)) || model.rects.find(r => !listed.has(r.key));
      c.lines.push(next ? next.key : firstCalc());
      chartsEditing.add(c.id);
      changed();
    });
    box.appendChild(add);
    return box;
  }
  if(c.layout === 'flow'){
    const row = make('div', 'widget-row');
    row.append(make('span', null, 'In'), widgetPeriodSelect(c, changed)); // its own, or the shared period (05k)
    box.appendChild(row);
    c.steps.forEach((s, i) => {
      const r = make('div', 'edit-row step-row');
      const rs = rectSelect(s.key, false);
      rs.addEventListener('change', () => { s.key = rs.value; changed(); });
      const role = make('select');
      role.setAttribute('aria-label', 'Step');
      FLOW_ROLES.forEach(v => { const o = make('option', null, ROLE_LABELS[v]); o.value = v; if(s.role === v) o.selected = true; role.appendChild(o); });
      role.addEventListener('change', () => { s.role = role.value; changed(); });
      // Its rectangle's chosen colour, shared by every chart (otherwise by direction: up, down, or a full bar).
      const own = chosenColour(s.key);
      const byDirection = s.role === 'start' || s.role === 'total' ? '#334155' : '#047857'; // a full bar, or up (down is red)
      const pick = colourPicker(own || '#334155', 'Colour of this step', (v) => { setRectColour(s.key, v); changed(); },
        { colour: byDirection, name: 'by direction', chosen: !!own, choose: () => { setRectColour(s.key, null); changed(); } });
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
  row.appendChild(widgetPeriodsChooser(c)); // its own periods, or the shared ones (05k-shared-period.js)
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

// A key's swatch picks the rectangle's colour on every board.
function pickRectColour(k){ return (v) => { chooseRectColour(k, v); saveBoardSoon(); renderBoard(); }; }
// The swatch of rectangle k in a chart's key (the board engine asks for it): its colour box,
// with an Automatic swatch of `automatic` when nothing is chosen.
function rectKeySwatch(k, colour, label, automatic){
  const sw = colourPicker(colour, label, pickRectColour(k), automaticColour(k, automatic, redrawColours));
  sw.classList.add('key-swatch');
  return sw;
}
// The swatch of a chart's own colour (a Tornado's Low, `colour`, and High, `colour2`): Automatic
// goes back to `usual`.
function chartKeySwatch(c, prop, colour, label, usual){
  const sw = colourPicker(colour, label, (v) => { c[prop] = v; saveBoardSoon(); renderBoard(); },
    { colour: usual, chosen: !!c[prop], choose: () => { c[prop] = null; redrawColours(); } });
  sw.classList.add('key-swatch');
  return sw;
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
