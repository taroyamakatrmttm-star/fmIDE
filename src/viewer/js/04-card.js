// ============================================================
// A node's card: what it is, its value in every period shown, and how it is worked out — the
// operator and each input it reads, with their values ("Revenue = Price × Volume: 12 × 1,000").
// Tapping an input goes to it, on whatever canvas it sits. Everything is read from the shared
// calculation's compiled model (the IR), never worked out again here.
// ============================================================
const EXPLAIN_DEPTH = 3; // operators feeding operators are followed this far

function irNode(canvasId, nodeId){ const c = state.vm.ir.canvases.get(canvasId); return c ? c.byId.get(nodeId) : undefined; }
function rawNode(canvasId, nodeId){ const c = state.vm.byId.get(canvasId); return c ? c.nodeById.get(nodeId) : undefined; }

// A node's name as the card says it.
function nodeName(canvasId, nodeId){
  const n = rawNode(canvasId, nodeId) || (irNode(canvasId, nodeId) || {}).node;
  if(!n) return '(missing)';
  if(n.type === 'value') return rectParts(n).name || '(unnamed)';
  if(n.type === 'alias'){
    const src = sourceOf(canvasId, nodeId);
    return src ? nodeName(src.canvasId, src.nodeId) : '(an alias to nothing)';
  }
  if(n.type === 'periodShift') return 'Period shift ' + shiftLabel(typeof n.shift === 'number' ? n.shift : -1);
  if(n.type === 'blockInstance'){ const b = blockPorts(state.vm, n.blockDefCanvasId); return b.def ? b.def.name + ' (block)' : '(missing block)'; }
  if(n.type === 'function'){ const c = state.vm.byId.get(canvasId); return c ? functionPorts(state.vm, c, n).name + ' (function)' : '(function)'; }
  return 'Operator ' + String(n.text || '').slice(0, 20);
}
// What an alias shows: { canvasId, nodeId } of its rectangle (following aliases of aliases), or null.
function sourceOf(canvasId, nodeId){
  let c = canvasId, id = nodeId;
  for(let i = 0; i < 20; i++){
    const n = irNode(c, id);
    if(!n || n.type !== 'alias') return n ? { canvasId: c, nodeId: id } : null;
    if(!n.sourceCanvasId || !n.sourceNodeId) return null;
    c = String(n.sourceCanvasId); id = String(n.sourceNodeId);
  }
  return null;
}

// A value in one period, written as its rectangle writes it: { text, error }.
function valueText(canvasId, nodeId, period){
  const c = state.vm.byId.get(canvasId), n = rawNode(canvasId, nodeId);
  const r = nodeResult(state.vm, canvasId, nodeId, period);
  if(r.error) return { text: '?', error: r.error };
  if(n && n.type === 'value' && !cvHasIncoming(c, nodeId)){
    const moved = movedValue(canvasId, nodeId, period); // moved on the Board (06-board.js)
    const lit = moved !== null ? moved : effectiveLiteral(n, period);
    return { text: formatFor(state.vm, c, n, lit !== null ? lit : 0) };
  }
  if(r.value === undefined) return { text: '—' };
  if(n && n.type === 'value') return { text: formatFor(state.vm, c, n, r.value) };
  if(n && n.type === 'alias'){
    const src = sourceOf(canvasId, nodeId);
    const sn = src && rawNode(src.canvasId, src.nodeId);
    if(sn && sn.type === 'value') return { text: formatFor(state.vm, state.vm.byId.get(src.canvasId), sn, r.value) };
  }
  return { text: formatNum(r.value) };
}

// What an arrow brings into a node, as a term of a formula: { names, values, leaves } — the
// formula with names and with values, and the rectangles it reads (each { canvasId, nodeId,
// name, value }, to go to).
function term(canvasId, edge, period, depth){
  const src = irNode(canvasId, String(edge.from));
  if(!src) return { names: '(missing)', values: '?', leaves: [] };
  const id = String(edge.from);
  if(src.type === 'value' || src.type === 'alias'){
    const target = src.type === 'alias' ? sourceOf(canvasId, id) : { canvasId, nodeId: id };
    const name = nodeName(canvasId, id);
    const v = valueText(canvasId, id, period).text;
    return { names: name, values: v, leaves: [{ canvasId: target ? target.canvasId : canvasId, nodeId: target ? target.nodeId : id, name, value: v, missing: !target }] };
  }
  if(src.type === 'blockInstance'){
    const b = blockPorts(state.vm, src.blockDefCanvasId);
    const port = Number(edge.fromPort) || 0;
    const out = b.outputs[port];
    const name = (out ? rectParts(out).name || ('out' + port) : 'out' + port) + ' of ' + (b.def ? b.def.name : 'a missing block');
    const r = portResult(state.vm, canvasId, id, port, period);
    const v = r.value !== undefined ? formatNum(r.value) : '?';
    return { names: name, values: v, leaves: [{ canvasId, nodeId: id, name, value: v }] };
  }
  if(depth >= EXPLAIN_DEPTH){
    const v = valueText(canvasId, id, period).text;
    return { names: '(…)', values: v, leaves: [{ canvasId, nodeId: id, name: nodeName(canvasId, id), value: v }] };
  }
  const inner = formulaOf(canvasId, id, period, depth + 1);
  // Brackets round an operator inside another; none round the whole formula.
  const wrap = (s) => depth === 0 || /^[^\s(]+\(.*\)$|^[^\s]+$/.test(s) ? s : '(' + s + ')';
  return { names: wrap(inner.names), values: wrap(inner.values), leaves: inner.leaves };
}

// How a node other than a rectangle works out its value: { names, values, leaves, note }.
function formulaOf(canvasId, nodeId, period, depth){
  const n = irNode(canvasId, nodeId);
  const empty = { names: '', values: '', leaves: [] };
  if(!n) return empty;
  const join = (parts, sep, open, close) => ({
    names: open + parts.map(p => p.names).join(sep) + close,
    values: open + parts.map(p => p.values).join(sep) + close,
    leaves: parts.flatMap(p => p.leaves),
  });
  if(n.type === 'periodShift'){
    if(!n.incoming.length) return { names: '(nothing)', values: '?', leaves: [] };
    const t = term(canvasId, n.incoming[0], Math.min(Math.max(0, period + n.offset), state.vm.periods.length - 1), depth);
    const off = n.offset, when = off === -1 ? 'the period before' : off === 1 ? 'the period after' : off === 0 ? 'this period' : (off < 0 ? (-off) + ' periods before' : off + ' periods after');
    return { names: t.names + ' in ' + when, values: t.values, leaves: t.leaves };
  }
  if(n.type === 'function'){
    const fp = functionPorts(state.vm, state.vm.byId.get(canvasId), n.node);
    const c = state.vm.ir.canvases.get(canvasId);
    const ports = c.portEdges.get(nodeId);
    const parts = fp.params.map((p, i) => { const e = ports && ports.get(i); return e ? term(canvasId, e, period, depth) : { names: '(nothing)', values: '?', leaves: [] }; });
    return join(parts, ', ', fp.name + '(', ')');
  }
  if(n.type === 'blockInstance') return { names: nodeName(canvasId, nodeId), values: '', leaves: [] };
  // An operator.
  const op = n.op;
  const sym = String(n.symbol || '?');
  if(op && op.ports && n.portInputs){
    const names = operatorPortNames(op, op.choices ? n.portInputs.length - 1 : 0);
    const parts = n.portInputs.map((e, i) => {
      const t = e ? term(canvasId, e, period, depth) : { names: '(nothing)', values: '?', leaves: [] };
      const label = names[i] || ('input ' + (i + 1));
      return { names: label + ': ' + t.names, values: t.values, leaves: t.leaves };
    }).filter((p, i) => n.portInputs[i] || i < (op.choices ? 1 : names.length));
    return join(parts, ', ', sym + '(', ')');
  }
  const parts = (n.inputs || []).map(e => term(canvasId, e, period, depth));
  if(!parts.length) return { names: '(nothing connected)', values: '0', leaves: [] };
  if(op && !op.fn && parts.length > 1) return join(parts, ' ' + sym + ' ', '', '');
  return join(parts, ', ', sym + '(', ')');
}

// Where a rectangle's value comes from: { kind, names, values, leaves, error }.
function explain(canvasId, nodeId, period){
  const n = irNode(canvasId, nodeId);
  if(!n) return { kind: 'missing' };
  const r = nodeResult(state.vm, canvasId, nodeId, period);
  if(n.type === 'value'){
    if(n.isInput || !n.incoming.length) return { kind: 'input' };
    if(n.incoming.length > 1) return { kind: 'error', error: 'ambiguous' };
    const t = term(canvasId, n.incoming[0], period, 0);
    return { kind: 'calc', names: t.names, values: t.values, leaves: t.leaves, error: r.error };
  }
  if(n.type === 'alias'){
    const src = sourceOf(canvasId, nodeId);
    return { kind: 'alias', leaves: src ? [{ canvasId: src.canvasId, nodeId: src.nodeId, name: nodeName(src.canvasId, src.nodeId), value: valueText(canvasId, nodeId, period).text }] : [], error: r.error };
  }
  if(n.type === 'blockInstance') return { kind: 'block' };
  const f = formulaOf(canvasId, nodeId, period, 0);
  return { kind: 'node', names: f.names, values: f.values, leaves: f.leaves, error: r.error };
}

// Whether a canvas is used as a block (its rectangles then have numbers per use).
function usedAsBlock(canvasId){ return state.vm.canvases.some(c => c.nodes.some(n => n.type === 'blockInstance' && String(n.blockDefCanvasId) === canvasId)); }

function openCard(canvasId, nodeId){
  const n = rawNode(canvasId, nodeId);
  if(!n) return false;
  state.card = { canvasId, nodeId };
  const card = $('card'), body = $('cardBody');
  body.textContent = '';
  const name = n.type === 'alias' ? '🔗 ' + nodeName(canvasId, nodeId) : nodeName(canvasId, nodeId);
  $('cardTitle').textContent = name;
  const where = [canvasName(canvasId)];
  if(n.type === 'value' || n.type === 'alias'){ const u = unitText(state.vm, state.vm.byId.get(canvasId), n); if(u.text) where.push(u.text); }
  $('cardWhere').textContent = where.join(' · ');

  const ex = explain(canvasId, nodeId, state.period);
  // What it is, and how it is worked out.
  if(ex.kind === 'input'){
    body.appendChild(make('p', 'card-kind', 'An input: a number typed into the model.'));
    if(movedValue(canvasId, nodeId, state.period) !== null){
      const lit = effectiveLiteral(n, state.period);
      body.appendChild(make('p', 'card-kind card-moved', 'Moved on the Board, from ' + formatFor(state.vm, state.vm.byId.get(canvasId), n, lit !== null ? lit : 0) + ' (the model\'s number).'));
    }
  } else if(ex.kind === 'alias'){
    body.appendChild(make('p', 'card-kind', 'Shows another rectangle\'s value.'));
  } else if(ex.kind === 'block'){
    const b = blockPorts(state.vm, n.blockDefCanvasId);
    body.appendChild(make('p', 'card-kind', b.def ? 'A use of the block "' + b.def.name + '": its inputs feed that canvas, and its outputs come back.' : 'A block whose canvas no longer exists.'));
  } else if(ex.kind === 'error'){
    body.appendChild(make('p', 'card-kind card-error', 'Can\'t be worked out: ' + errorWords(ex.error) + '.'));
  }
  if(ex.kind === 'calc' || ex.kind === 'node'){
    body.appendChild(make('h3', '', 'How it is worked out'));
    const lhs = n.type === 'value' ? (rectParts(n).name || '(unnamed)') + ' = ' : '= ';
    body.appendChild(make('p', 'card-formula', lhs + ex.names));
    if(ex.values) body.appendChild(make('p', 'card-formula with-values', lhs + ex.values + (state.vm.periods[state.period] ? '   (' + state.vm.periods[state.period] + ')' : '')));
  }
  if(ex.error && ex.kind !== 'error') body.appendChild(make('p', 'card-note card-error', 'Can\'t be worked out: ' + errorWords(ex.error) + '.'));

  // Its value in every period shown.
  if(n.type !== 'blockInstance'){
    body.appendChild(make('h3', '', 'Value'));
    const table = make('table', 'card-values');
    state.shown.periods.forEach(p => {
      const tr = make('tr', p === state.period ? 'shown' : '');
      tr.appendChild(make('td', '', state.vm.periods[p] || 'Period ' + (p + 1)));
      const vt = valueText(canvasId, nodeId, p);
      tr.appendChild(make('td', vt.error ? 'card-error' : '', vt.text));
      table.appendChild(tr);
    });
    body.appendChild(table);
  } else {
    const b = blockPorts(state.vm, n.blockDefCanvasId);
    if(b.outputs.length){
      body.appendChild(make('h3', '', 'Outputs'));
      const table = make('table', 'card-values');
      b.outputs.forEach((o, i) => {
        state.shown.periods.forEach(p => {
          const tr = make('tr', p === state.period ? 'shown' : '');
          tr.appendChild(make('td', '', (rectParts(o).name || 'out' + i) + ', ' + (state.vm.periods[p] || 'Period ' + (p + 1))));
          const r = portResult(state.vm, canvasId, nodeId, i, p);
          tr.appendChild(make('td', r.error ? 'card-error' : '', r.value !== undefined ? formatNum(r.value) : '?'));
          table.appendChild(tr);
        });
      });
      body.appendChild(table);
    }
  }

  // The inputs it reads, each to go to.
  const leaves = [];
  (ex.leaves || []).forEach(l => { if(!leaves.some(x => x.canvasId === l.canvasId && x.nodeId === l.nodeId)) leaves.push(l); });
  if(leaves.length){
    body.appendChild(make('h3', '', ex.kind === 'alias' ? 'Shows' : 'Reads'));
    const ul = make('ul', 'card-inputs');
    leaves.forEach(l => {
      const li = make('li');
      const b = make('button', 'card-input');
      b.type = 'button';
      const left = make('span');
      left.appendChild(make('span', 'card-input-name', l.name));
      const shown = state.shown.canvases.includes(l.canvasId);
      const whereText = l.missing ? 'missing' : (shown ? canvasName(l.canvasId) : 'on a canvas not shown here');
      left.appendChild(make('span', 'card-input-where', whereText));
      b.appendChild(left);
      b.appendChild(make('span', 'card-input-value', l.value));
      if(!shown || l.missing) b.disabled = true;
      else b.addEventListener('click', () => goTo(l.canvasId, l.nodeId));
      b.dataset.canvas = l.canvasId; b.dataset.node = l.nodeId;
      li.appendChild(b);
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }
  if(usedAsBlock(canvasId)) body.appendChild(make('p', 'card-note', 'This canvas is a block: each use of it has its own numbers. These are the canvas\'s own.'));

  card.classList.remove('hidden');
  markPicked();
  return true;
}
function closeCard(){
  state.card = null;
  $('card').classList.add('hidden');
  markPicked();
}
// The node whose card is open, and what it reads on this canvas, outlined.
function markPicked(){
  document.querySelectorAll('#world .cv-node.picked, #world .cv-node.reads').forEach(e => e.classList.remove('picked', 'reads'));
  if(!state.card || state.card.canvasId !== state.canvasId) return;
  const find = (id) => Array.from(document.querySelectorAll('#world .cv-node')).find(e => e.dataset.id === id);
  const me = find(state.card.nodeId);
  if(me) me.classList.add('picked');
  const ex = explain(state.card.canvasId, state.card.nodeId, state.period);
  (ex.leaves || []).forEach(l => { if(l.canvasId === state.canvasId){ const e = find(l.nodeId); if(e && e !== me) e.classList.add('reads'); } });
}
// Goes to a rectangle: its canvas, the rectangle in the middle, its card open.
function goTo(canvasId, nodeId){
  if(canvasId !== state.canvasId && !showCanvas(canvasId, { keepCard: true })) return false;
  openCard(canvasId, nodeId);
  centreOn(nodeId);
  return true;
}

function wireCard(){
  $('cardClose').addEventListener('click', () => closeCard());
}
