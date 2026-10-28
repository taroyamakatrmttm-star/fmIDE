// ============================================================
// Changing a Free chart's pieces on fmGraph's page (+ From chart…, removing, placing, align,
// distribute, tidy). Reading and working out the pieces are 04f-free.js, the board engine's.
// ============================================================

// A Columns or Flow chart's rectangles as pieces (+ From chart…, and switching to Free),
// starting at column `from`: a Columns chart's groups on zero (with its check, each later group
// should equal the first); a Flow's steps — start and total on zero, add where the step before
// ends, subtract the same with Minus, total should equal where the step before ends.
function piecesFromChart(src, from){
  const out = [];
  if(src.layout === 'columns'){
    src.groups.forEach(g => out.push({ id: newPieceId(), name: g.name, column: from + out.length, sits: { on: 'zero' }, minus: false, check: null, parts: g.parts.slice(0, FREE_LIMITS.parts) }));
    if(src.check) out.slice(1).forEach(p => { if(p.parts.length && out[0].parts.length) p.check = out[0].id; });
  } else if(src.layout === 'flow'){
    src.steps.forEach((s, i) => {
      const prev = out[i - 1];
      const p = { id: newPieceId(), name: '', column: from + i, sits: { on: 'zero' }, minus: false, check: null, parts: [s.key] };
      if(prev && (s.role === 'add' || s.role === 'subtract')) p.sits = { on: 'end', of: prev.id };
      if(s.role === 'subtract') p.minus = true;
      if(s.role === 'total' && prev) p.check = prev.id;
      out.push(p);
    });
  }
  return out;
}

// Adds a chart's pieces to a Free chart, after its last column; at most 40 pieces in all.
// Returns how many were left out.
function addPiecesFrom(c, src){
  const from = c.pieces.length ? Math.max(...c.pieces.map(p => p.column)) + 1 : 0;
  const all = piecesFromChart(src, from);
  const room = FREE_LIMITS.pieces - c.pieces.length;
  const taken = all.slice(0, Math.max(0, room));
  const ids = new Set(taken.map(p => p.id));
  taken.forEach(p => {
    p.column = Math.min(p.column, FREE_LIMITS.columns - 1);
    if(p.sits.of && !ids.has(p.sits.of)) p.sits = { on: 'zero' };
    if(p.check && !ids.has(p.check)) p.check = null;
  });
  c.pieces.push(...taken);
  settleColumns(c);
  return all.length - taken.length;
}

// Removes a piece; pieces resting on it go on zero, checks against it go.
function removePiece(c, p){
  c.pieces = c.pieces.filter(q => q !== p);
  c.pieces.forEach(q => {
    if(q.sits.of === p.id) q.sits = { on: 'zero' };
    if(q.check === p.id) q.check = null;
  });
  settleColumns(c);
}

// ---- placing on the grid (phase F2) ----
// The pieces that move across with p: p and those resting on it (through any chain) in its own
// column — a stack on a stack goes with it; a waterfall step in another column stays (the owner's
// choice 3a, 27 October 2026).
function pieceStack(c, p){ return c.pieces.filter(q => q === p || (q.column === p.column && restsOnChain(c, q, p))); }

const sameSits = (a, b) => a.on === b.on && (a.on === 'level' ? a.value === b.value : (a.of || null) === (b.of || null));

// Where p could sit, as the drag's guides propose it: on zero, then on top of and where each other
// piece ends (none that would make a loop, none that can't be worked out), each with the level
// it gives in figs (freeFigures, in the list's order).
function sitsChoices(c, p, figs){
  const out = [{ sits: { on: 'zero' }, level: 0, label: 'on zero' }];
  c.pieces.forEach((q, i) => {
    const f = figs[i];
    if(q === p || wouldLoop(c, p, q.id) || !f || f.top === undefined) return;
    out.push({ sits: { on: 'top', of: q.id }, level: f.up > 0 || f.down === 0 ? f.top : f.bottom, label: 'on top of ' + pieceLabel(c, q) });
    out.push({ sits: { on: 'end', of: q.id }, level: f.end, label: 'where ' + pieceLabel(c, q) + ' ends' });
  });
  return out;
}

// Puts piece p in column col (0–39) and, when sits is given, sits it there. Its stack moves with
// it; a piece already in that column which can't share it with p swaps to the column p left (the
// owner's choice 2a). If p still can't stand there (it no longer rests on a piece in its own
// column), its stack moves to the nearest column it fits. Returns null, or why it was refused.
function placePiece(c, p, col, sits){
  if(sits && (sits.on === 'top' || sits.on === 'end') && wouldLoop(c, p, sits.of)) return 'loop';
  col = Math.round(Number(col));
  if(!Number.isFinite(col)) return 'column';
  col = Math.max(0, Math.min(FREE_LIMITS.columns - 1, col));
  const stack = pieceStack(c, p), from = p.column;
  if(sits) p.sits = sits.on === 'level' ? { on: 'level', value: cleanLevel(sits.value) } : sits.of ? { on: sits.on, of: sits.of } : { on: 'zero' };
  if(col !== from){
    stack.forEach(q => { q.column = col; });
    c.pieces.forEach(q => { if(!stack.includes(q) && q.column === col && !freeRelated(c, p, q)) q.column = from; });
  }
  const fits = (at) => c.pieces.every(q => stack.includes(q) || q.column !== at || stack.every(s => freeRelated(c, s, q)));
  if(!fits(p.column)){
    for(let k = 1; k < FREE_LIMITS.columns; k++){
      const at = [p.column + k, p.column - k].find(x => x >= 0 && x < FREE_LIMITS.columns && fits(x));
      if(at !== undefined){ stack.forEach(q => { q.column = at; }); break; }
    }
  }
  settleColumns(c);
  return null;
}

// Align bottoms: the pieces on zero, staying in their columns where they may.
function alignPieceBottoms(c, list){
  list.forEach(p => { p.sits = { on: 'zero' }; });
  settleColumns(c);
}

// Distribute (the rule of fmIDE's Distribute, src/shared/snap.js): the columns the pieces stand
// in, three or more, spread evenly across the columns they span, whole columns, each column's
// pieces moving together. Returns false when there are fewer than three columns.
function distributePieces(c, list){
  const cols = [...new Set(list.map(p => p.column))].sort((a, b) => a - b);
  const at = distributePositions(cols.map(x => ({ x, y: 0, w: 1, h: 1 })), 'h');
  if(!at) return false;
  const to = new Map(cols.map((x, i) => [x, Math.round(at[i])]));
  const moving = c.pieces.filter(p => to.has(p.column));
  const still = c.pieces.filter(p => !to.has(p.column));
  moving.forEach(p => { p.column = to.get(p.column); });
  // Pieces not chosen standing where a column moved to go, their column together, to the next
  // free one.
  const displaced = [...new Set(still.filter(p => moving.some(q => q.column === p.column && !freeRelated(c, p, q))).map(p => p.column))];
  displaced.forEach(col => {
    const group = still.filter(p => p.column === col);
    group.forEach(p => { p.column = -1; });
    const free = nextFreeColumn({ pieces: c.pieces.filter(x => x.column >= 0) });
    group.forEach(p => { p.column = free; });
  });
  settleColumns(c);
  return true;
}

// Tidy: the empty columns closed up, the pieces keeping their order.
function tidyPieces(c){
  const cols = [...new Set(c.pieces.map(p => p.column))].sort((a, b) => a - b);
  const to = new Map(cols.map((x, i) => [x, i]));
  c.pieces.forEach(p => { p.column = to.get(p.column); });
}
