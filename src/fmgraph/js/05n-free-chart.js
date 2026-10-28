// ============================================================
// Drawing the Free chart (phase F1; the data is 04f-free.js; its editor is fmGraph's page,
// 05n-free-chart-edit.js, and its grid 05p-free-grid.js). Each piece is drawn
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
function drawKeyGroups(key, groups, choice){
  const seen = new Set();
  const item = (it) => {
    const el = make('label', 'key-item');
    if(choice) markKeyZero(el, it.key, choice);
    const sw = rectKeySwatch(it.key, it.colour, 'Colour of ' + it.name, PART_COLOURS[0]);
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
  // The key, those at 0 left out (05b-chart-render.js, keyChoice).
  const groups = freeKeyItems(c, colours);
  const choice = keyChoice(c, groups.flatMap(g => g.items.map(it => it.key)), [c.period], results);
  drawKeyGroups(key, groups.map(g => Object.assign({}, g, { items: g.items.filter(it => choice.shows(it.key)) })).filter(g => g.items.length), choice);
  drawKeyZeros(key, c, choice);
  raiseScaleLabels(chart);
  // The grid's geometry, for placing pieces by dragging (05p-free-grid.js).
  chart.freeGeo = { W, top, plotH, slot, bw, ncols, cxOf, y, figs: now };
  return chart;
}
