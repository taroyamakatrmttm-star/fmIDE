// ============================================================
// A Free chart's editor in Edit chart, on fmGraph's page. Drawing it is 05n-free-chart.js.
// ============================================================

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
