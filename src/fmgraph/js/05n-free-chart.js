// ============================================================
// Drawing and editing the Free chart (phase F1; the data is 04f-free.js). Each piece is drawn
// as a bar or a stack in its grid column, its name under the column, its total above it (with
// the difference against A, or the model's own numbers), a dashed connector from the piece it
// rests on, and its check's ✓ / ✗. Edit chart lists the pieces: name, Sits, the column (← →),
// Minus, Should equal…, the rectangles; + Piece and + From chart….
// ============================================================

// The key's items, worked out before anything is drawn (so which ones show can be chosen in
// one place later): per piece, its label and its rectangles with their colours. A piece that is
// just its one rectangle (named after it, or not named, and without Minus) has no label: label null.
function freeKeyItems(c, colours){
  return c.pieces.map(p => {
    const items = p.parts.map(k => ({ key: k, name: partLabel(k), colour: colours.get(k) }));
    const plain = items.length === 1 && !p.minus && (!p.name || p.name === items[0].name);
    return { label: plain ? null : pieceLabel(c, p), items };
  }).filter(g => g.items.length);
}
// Draws key groups ({ label, items }) into the key, a line each; the groups without a label
// share one line. A swatch per rectangle picks its colour, once each.
function drawKeyGroups(key, groups){
  const seen = new Set();
  const item = (it) => {
    const el = make('label', 'key-item');
    const sw = colourPicker(it.colour, 'Colour of ' + it.name, pickRectColour(it.key), automaticColour(it.key, PART_COLOURS[0], redrawColours));
    sw.classList.add('key-swatch');
    el.append(sw, document.createTextNode(it.name));
    return el;
  };
  const labelled = groups.filter(g => g.label !== null), plain = groups.filter(g => g.label === null);
  labelled.forEach(g => {
    const line = make('div', 'key-line');
    line.appendChild(make('span', 'key-group', g.label + ':'));
    g.items.forEach(it => line.appendChild(item(it)));
    key.appendChild(line);
  });
  const rest = plain.flatMap(g => g.items).filter(it => !seen.has(it.key) && seen.add(it.key));
  if(rest.length){
    const line = make('div', 'key-line');
    rest.forEach(it => line.appendChild(item(it)));
    key.appendChild(line);
  }
}

function drawFree(c, results, problems, key){
  const now = freeFigures(c, results), was = freeFigures(c, compareResults()); // A, or the model's own numbers
  const colours = partColours(c);
  const drawn = (f) => !!f.parts;
  const ncols = Math.max(1, ...c.pieces.map(p => p.column + 1));
  const labels = ncols <= 16;
  let lo = 0, hi = 0;
  now.concat(was).forEach(f => { if(drawn(f)){ lo = Math.min(lo, f.bottom, f.base); hi = Math.max(hi, f.top, f.base); } });
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(c, lo, hi); // Auto, the common scale, or the chart's fixed scale (04d-scale.js)
  const checked = now.some(f => f.check);
  const W = 560, top = 18 + (labels ? 30 : 0) + (checked ? 4 : 0), bottom = 36, H = 170 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / ncols, bw = Math.max(3, Math.min(46, slot * 0.62));
  const cxOf = (col) => 4 + slot * col + slot / 2;
  const chart = svg('svg', { class: 'bar-chart free-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-layout': 'free' });
  chart.setAttribute('aria-label', (c.title || 'Free') + ', ' + model.periods[c.period]);
  drawScaleAxis(chart, sc, y, W, top, plotH);
  if(!c.pieces.length) problems.push('Add a piece to start: Edit chart, then + Piece or + From chart….');
  c.pieces.forEach((p, i) => {
    const f = now[i], b = was[i], label = pieceLabel(c, p);
    const cx = cxOf(p.column), x = cx - bw / 2;
    const g = svg('g', { class: 'fr-piece', 'data-piece': i, 'data-column': p.column });
    if(f.error !== undefined){
      g.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
      g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
      problems.push(label + ', ' + partLabel(p.parts[f.part]) + ': ' + errorText(f.error));
    } else if(f.blocked !== undefined){
      const t = svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!');
      g.appendChild(t);
      problems.push(label + ' is not drawn: it rests on ' + f.blocked + ', which ' + (f.why === 'error' ? 'has an error' : 'can\'t be drawn either') + '.');
    } else {
      // The dashed connector from the piece it rests on, when that one stands in another column.
      const of = restsOn(c, p), fo = of ? now[c.pieces.indexOf(of)] : null;
      if(of && fo && drawn(fo) && of.column !== p.column){
        const x1 = cxOf(of.column) + (of.column < p.column ? bw / 2 : -bw / 2), x2 = of.column < p.column ? x : x + bw;
        g.appendChild(svg('line', { class: 'f-link', x1, x2, y1: y(f.base), y2: y(f.base) }));
      }
      f.parts.forEach((pt, pi) => {
        const k = p.parts[pi];
        const rect = animKey(svg('rect', { class: 'c-part', x, y: Math.min(y(pt.from), y(pt.to)), width: bw, height: Math.max(pt.value === 0 ? 0 : 1, Math.abs(y(pt.to) - y(pt.from))), fill: colours.get(k) }), c.id + '|' + p.id + '|' + pi);
        const before = drawn(b) ? b.parts[pi] : null;
        const diff = before ? fmtDiff(pt.value, before.value) : '';
        rect.appendChild(svg('title', {}, label + ' · ' + partLabel(k) + ', ' + model.periods[c.period] + ': ' + fmtNum(pt.value) + (diff ? ' — was ' + fmtNum(before.value) + ', ' + diff : '')));
        g.appendChild(rect);
      });
      drawOverMarks(g, sc, cx, top, plotH, f.top, f.bottom);
      if(drawn(b) && (!agree(b.top, f.top) || !agree(b.bottom, f.bottom))){
        g.appendChild(svg('rect', { class: 'b-base', x, y: y(b.top), width: bw, height: Math.max(1, y(b.bottom) - y(b.top)) }));
      }
      if(labels){
        const diff = drawn(b) ? fmtDiff(f.value, b.value) : '';
        const topY = y(f.top);
        g.appendChild(svg('text', { class: 't-value', x: cx, y: topY - 4, 'text-anchor': 'middle' }, fmtNum(f.value)));
        if(diff) g.appendChild(svg('text', { class: 't-diff ' + (f.value > b.value ? 'up' : 'down'), x: cx, y: topY - 17, 'text-anchor': 'middle' }, diff.split(' ')[0]));
      }
    }
    if(f.check){
      const other = c.pieces.find(q => q.id === p.check), otherLabel = other ? pieceLabel(c, other) : '?';
      const mark = f.check.error ? '?' : f.check.agree ? '✓' : '✗';
      const t = svg('text', { class: 't-check ' + (f.check.agree ? 'ok' : 'bad'), x: cx, y: 13, 'text-anchor': 'middle' }, mark);
      t.appendChild(svg('title', {}, f.check.error ? 'Can\'t check: a rectangle couldn\'t be worked out'
        : f.check.agree ? label + ' equals where ' + otherLabel + ' ends' : label + ' is ' + fmtNum(f.check.a) + '; ' + otherLabel + ' ends at ' + fmtNum(f.check.b)));
      g.appendChild(t);
      if(!f.check.error && !f.check.agree) problems.push(label + ' should equal ' + otherLabel + ': it is ' + fmtNum(f.check.a) + ', and ' + otherLabel + ' ends at ' + fmtNum(f.check.b) + '.');
    }
    chart.appendChild(g);
  });
  // Each column's names under it, shortened to fit (in full when pointed at).
  const room = Math.max(3, Math.floor(slot / 6.2));
  [...new Set(c.pieces.map(p => p.column))].forEach(col => {
    const name = c.pieces.filter(p => p.column === col).map(p => pieceLabel(c, p)).join(' / ');
    const t = svg('text', { class: 't-period', x: cxOf(col), y: H - 20, 'text-anchor': 'middle' }, name.length > room ? name.slice(0, room - 1) + '…' : name);
    t.appendChild(svg('title', {}, name));
    chart.appendChild(t);
  });
  chart.appendChild(svg('text', { class: 't-period', x: W / 2, y: H - 4, 'text-anchor': 'middle' }, model.periods[c.period]));
  // What reading the file put right (never saved: the file is written as it is now).
  const n = c.notes || {};
  if(n.loops) problems.push(n.loops + ' piece' + (n.loops === 1 ? ' was' : 's were') + ' in a loop (resting on each other) and now sit' + (n.loops === 1 ? 's' : '') + ' on zero.');
  if(n.moved) problems.push(n.moved + ' piece' + (n.moved === 1 ? '' : 's') + ' moved to a free column: two pieces share a column only when one rests on the other.');
  drawKeyGroups(key, freeKeyItems(c, colours));
  raiseScaleLabels(chart);
  return chart;
}

// Edit chart's list of pieces (box: the editor; periodRow: its "In" period row).
function freeEditor(c, box, periodRow, changed){
  box.appendChild(periodRow);
  box.appendChild(make('div', 'edit-head', 'Pieces'));
  if(!c.pieces.length) box.appendChild(make('p', 'empty-note', 'None yet: + Piece adds one, or + From chart… copies a Columns or Waterfall chart.'));
  const firstCalc = () => (model.rects.find(r => !r.input) || model.rects[0]).key;
  const button = (cls, text, label, fn, off) => {
    const x = make('button', cls, text);
    x.type = 'button';
    if(label){ x.title = label; x.setAttribute('aria-label', label); }
    x.disabled = !!off;
    x.addEventListener('click', fn);
    return x;
  };
  c.pieces.forEach((p, i) => {
    const set = make('fieldset', 'group-edit piece-edit');
    set.dataset.piece = String(i);
    const head = make('div', 'edit-row piece-head');
    const name = make('input', 'group-name piece-name');
    name.type = 'text';
    name.placeholder = pieceLabel(c, Object.assign({}, p, { name: '', minus: false }));
    name.value = p.name;
    name.maxLength = CHART_LIMITS.name;
    name.setAttribute('aria-label', 'Piece name');
    name.addEventListener('change', () => { p.name = cleanText(name.value, CHART_LIMITS.name); saveBoardSoon(); updateValues(); });
    // Sits: on zero, on top of another piece, where another ends, at a number.
    const sits = make('select', 'piece-sits');
    sits.setAttribute('aria-label', 'Sits');
    const option = (value, text) => { const o = make('option', null, text); o.value = value; sits.appendChild(o); };
    option('zero', 'On zero');
    c.pieces.forEach(q => { if(q !== p) option('top:' + q.id, 'On top of ' + pieceLabel(c, q)); });
    c.pieces.forEach(q => { if(q !== p) option('end:' + q.id, 'Where ' + pieceLabel(c, q) + ' ends'); });
    option('level', 'At a number');
    sits.value = p.sits.on === 'level' ? 'level' : p.sits.of ? p.sits.on + ':' + p.sits.of : 'zero';
    sits.addEventListener('change', () => {
      const v = sits.value;
      if(v === 'zero') p.sits = { on: 'zero' };
      else if(v === 'level') p.sits = { on: 'level', value: 0 };
      else {
        const [on, of] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
        if(wouldLoop(c, p, of)){
          const q = c.pieces.find(x => x.id === of);
          notify('That would make a loop: ' + (q ? pieceLabel(c, q) : 'that piece') + ' already rests on ' + pieceLabel(c, p) + '.', 'err');
          renderBoard();
          return;
        }
        p.sits = { on, of };
        // On top of another piece: into its column, as a second stack on the first.
        const q = c.pieces.find(x => x.id === of);
        if(on === 'top' && q && fitsColumn(c, p, q.column)) p.column = q.column;
      }
      settleColumns(c);
      changed();
    });
    head.append(name, make('span', null, 'Sits'), sits);
    if(p.sits.on === 'level'){
      const level = make('input', 'piece-level');
      level.type = 'number';
      level.value = String(p.sits.value);
      level.setAttribute('aria-label', 'Sits at');
      level.addEventListener('change', () => { p.sits = { on: 'level', value: cleanLevel(level.value) }; changed(); });
      head.appendChild(level);
    }
    // The column: ← → to the next one it may stand in.
    const step = (dir) => { for(let col = p.column + dir; col >= 0 && col < FREE_LIMITS.columns; col += dir) if(fitsColumn(c, p, col)) return col; return null; };
    const moveTo = (col) => () => { if(col === null) return; p.column = col; changed(); };
    const cols = make('span', 'row-buttons piece-columns');
    cols.append(button('mini piece-left', '←', 'Column to the left', moveTo(step(-1)), step(-1) === null),
      make('span', 'piece-column', 'Column ' + (p.column + 1)),
      button('mini piece-right', '→', 'Column to the right', moveTo(step(1)), step(1) === null),
      button('mini piece-remove', '×', 'Remove this piece', () => { removePiece(c, p); changed(); }));
    head.appendChild(cols);
    set.appendChild(head);
    const more = make('div', 'edit-row piece-more');
    const minusLabel = make('label', 'piece-minus-label');
    const minus = make('input', 'piece-minus');
    minus.type = 'checkbox';
    minus.checked = p.minus;
    minus.addEventListener('change', () => { p.minus = minus.checked; changed(); });
    minusLabel.append(minus, document.createTextNode(' Minus'));
    const check = make('select', 'piece-check');
    check.setAttribute('aria-label', 'Should equal');
    const none = make('option', null, 'Nothing');
    none.value = '';
    check.appendChild(none);
    c.pieces.forEach(q => { if(q !== p){ const o = make('option', null, 'Where ' + pieceLabel(c, q) + ' ends'); o.value = q.id; check.appendChild(o); } });
    check.value = p.check || '';
    check.addEventListener('change', () => { p.check = check.value || null; changed(); });
    more.append(minusLabel, make('span', null, 'Should equal'), check);
    set.appendChild(more);
    p.parts.forEach((k, pi) => {
      const r = make('div', 'edit-row part-row');
      const rs = rectSelect(k, false);
      rs.setAttribute('aria-label', 'Rectangle ' + (pi + 1) + ' of ' + pieceLabel(c, p));
      rs.addEventListener('change', () => { p.parts[pi] = rs.value; changed(); });
      const b = make('span', 'row-buttons');
      b.append(button('mini', '↑', 'Move up', () => { [p.parts[pi - 1], p.parts[pi]] = [p.parts[pi], p.parts[pi - 1]]; changed(); }, pi === 0),
        button('mini', '↓', 'Move down', () => { [p.parts[pi + 1], p.parts[pi]] = [p.parts[pi], p.parts[pi + 1]]; changed(); }, pi === p.parts.length - 1),
        button('mini', '×', 'Remove', () => { p.parts.splice(pi, 1); changed(); }));
      r.append(rs, b);
      set.appendChild(r);
    });
    set.appendChild(button('link-btn add-piece-part', '+ Rectangle', null, () => { p.parts.push(firstCalc()); changed(); }, p.parts.length >= FREE_LIMITS.parts));
    box.appendChild(set);
  });
  const add = button('link-btn add-piece', '+ Piece', null, () => {
    c.pieces.push({ id: newPieceId(), name: '', column: nextFreeColumn(c), sits: { on: 'zero' }, minus: false, check: null, parts: [firstCalc()] });
    chartsEditing.add(c.id);
    changed();
  }, c.pieces.length >= FREE_LIMITS.pieces);
  box.appendChild(add);
  // + From chart…: another Columns or Waterfall chart on this board, copied in as pieces.
  const sources = board.charts.filter(x => x !== c && (x.layout === 'columns' || x.layout === 'flow'));
  const from = make('select', 'piece-from');
  from.setAttribute('aria-label', 'Copy pieces from a chart');
  const head = make('option', null, '+ From chart…');
  head.value = '';
  from.appendChild(head);
  sources.forEach((x, i) => {
    const o = make('option', null, (x.title || (x.layout === 'flow' ? 'Waterfall' : 'Columns')) + ' (' + (x.layout === 'flow' ? 'Waterfall' : 'Columns') + ')');
    o.value = String(i);
    from.appendChild(o);
  });
  from.disabled = !sources.length || c.pieces.length >= FREE_LIMITS.pieces;
  from.addEventListener('change', () => {
    const src = sources[Number(from.value)];
    if(!src) return;
    const left = addPiecesFrom(c, src);
    if(left) notify(left + ' piece' + (left === 1 ? '' : 's') + ' left out: a Free chart holds at most ' + FREE_LIMITS.pieces + '.', 'info');
    chartsEditing.add(c.id);
    changed();
  });
  box.appendChild(from);
}
