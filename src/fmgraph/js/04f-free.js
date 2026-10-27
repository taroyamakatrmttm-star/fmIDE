// ============================================================
// The Free chart (phase F1, docs/fmgraph-free-chart.md; board file 13): columns and waterfalls
// together, in one period. A chart of layout `free` is made of pieces, each a stack of
// rectangles (one rectangle: a plain bar) standing in a whole grid column and saying where it
// sits:
//   free { id, layout: 'free', title, period, pieces: [piece], notes }
//   piece { id, name, column (0–39), sits: { on: 'zero' | 'top' | 'end' | 'level', of, value },
//           minus, check (a piece's id, or null), parts: [key] }
// - on zero: the bar stands on the axis; on top of another piece: it starts at that piece's
//   highest point (its lowest, when that piece only goes down); where another piece ends: it
//   starts at that piece's end (a waterfall step); at a number: it starts at `value`.
// - minus: the piece shows its value with the sign turned round (a Flow's subtract step).
// - check: the piece's total should equal that piece's end (✓ / ✗, `agree`).
// - Two pieces share a column only when one rests on the other (through any chain of top / end).
// A piece's value is the sum of its rectangles in the chart's period (turned round with minus);
// its positive part goes up from where it sits, its negative part down; its end is where it
// sits plus its value. `notes` (never saved) counts what reading the file put right: pieces in
// a loop put on zero, pieces moved to a free column.
// ============================================================
const FREE_LIMITS = { pieces: 40, parts: 30, columns: 40, level: 1e9 };
const FREE_SITS = ['zero', 'top', 'end', 'level'];
let freePieceCount = 0;
const newPieceId = () => 'q' + (++freePieceCount);

// A number from a file (numbers as text too), cut to ±1e9; anything else 0.
function cleanLevel(v){
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(-FREE_LIMITS.level, Math.min(FREE_LIMITS.level, n)) : 0;
}

// The piece p rests on (its `of`), or null.
function restsOn(c, p){
  if(p.sits.on !== 'top' && p.sits.on !== 'end') return null;
  return c.pieces.find(q => q.id === p.sits.of) || null;
}
// Whether a rests on b, through any chain of pieces.
function restsOnChain(c, a, b){
  const seen = new Set();
  for(let q = restsOn(c, a); q && !seen.has(q.id); q = restsOn(c, q)){
    if(q === b) return true;
    seen.add(q.id);
  }
  return false;
}
const freeRelated = (c, a, b) => restsOnChain(c, a, b) || restsOnChain(c, b, a);
// Whether piece p may stand in column col: every other piece there rests on it, or it on them.
function fitsColumn(c, p, col){
  return c.pieces.every(q => q === p || q.column !== col || freeRelated(c, p, q));
}
// Whether p resting on piece `of` would make a loop.
function wouldLoop(c, p, ofId){
  const of = c.pieces.find(q => q.id === ofId);
  return !of || of === p || restsOnChain(c, of, p);
}

// Rule 4 (the owner's choice, 27 October 2026): a piece standing in a column with one it isn't
// resting on (nor it on this one) moves to the next free column, the later piece in the list
// moving. Returns how many moved.
function settleColumns(c){
  let moved = 0;
  c.pieces.forEach((p, i) => {
    const earlier = c.pieces.slice(0, i);
    const fits = (col) => earlier.every(q => q.column !== col || freeRelated(c, p, q));
    if(fits(p.column)) return;
    for(let k = 1; k < FREE_LIMITS.columns; k++){
      const col = (p.column + k) % FREE_LIMITS.columns;
      if(fits(col)){ p.column = col; moved++; return; }
    }
  });
  return moved;
}
// The next column no piece stands in (after the last one used), for a new piece.
function nextFreeColumn(c){
  const used = new Set(c.pieces.map(p => p.column));
  const last = c.pieces.length ? Math.max(...c.pieces.map(p => p.column)) : -1;
  for(let k = 1; k <= FREE_LIMITS.columns; k++){
    const col = (last + k) % FREE_LIMITS.columns;
    if(!used.has(col)) return col;
  }
  return 0;
}

// The pieces of a Free chart read from a file (or storage). rectFor finds a rectangle; keep
// notes a part's colour. Rectangles not in the model are left out (counted through drop).
function cleanFreePieces(rawPieces, rectFor, keep, drop){
  const c = { pieces: [] };
  const fileIds = new Map();
  (Array.isArray(rawPieces) ? rawPieces : []).slice(0, FREE_LIMITS.pieces).forEach(raw => {
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const col = Math.round(Number(raw.column));
    const sits = raw.sits && typeof raw.sits === 'object' ? raw.sits : {};
    const on = FREE_SITS.includes(sits.on) ? sits.on : 'zero';
    const parts = [];
    (Array.isArray(raw.parts) ? raw.parts : []).slice(0, FREE_LIMITS.parts).forEach(x => {
      const r = x && typeof x === 'object' ? rectFor(x) : null;
      if(!r){ if(drop) drop(); return; }
      parts.push(keep(x, r).key);
    });
    const p = { id: newPieceId(), name: cleanText(raw.name, CHART_LIMITS.name), column: Number.isFinite(col) && col >= 0 && col < FREE_LIMITS.columns ? col : -1,
      sits: on === 'level' ? { on, value: cleanLevel(sits.value) } : { on }, minus: raw.minus === true, check: null, parts,
      fileOf: typeof sits.of === 'string' ? sits.of : null, fileCheck: typeof raw.check === 'string' ? raw.check : null };
    if(typeof raw.id === 'string' && !fileIds.has(raw.id)) fileIds.set(raw.id, p.id);
    c.pieces.push(p);
  });
  // `of` and `check` naming no piece (or the piece itself) read as on zero and none.
  c.pieces.forEach(p => {
    if(p.sits.on === 'top' || p.sits.on === 'end'){
      const of = fileIds.get(p.fileOf);
      if(of && of !== p.id) p.sits.of = of; else p.sits = { on: 'zero' };
    }
    const chk = fileIds.get(p.fileCheck);
    p.check = chk && chk !== p.id ? chk : null;
    delete p.fileOf; delete p.fileCheck;
  });
  // A loop (A on top of B, B where A ends): the pieces in it go on zero, and are counted.
  let loops = 0;
  c.pieces.forEach(p => {
    const path = [];
    for(let q = p; q; q = restsOn(c, q)){
      const at = path.indexOf(q);
      if(at >= 0){ path.slice(at).forEach(x => { x.sits = { on: 'zero' }; loops++; }); break; }
      path.push(q);
    }
  });
  // Rule 4 for the pieces with a column; then a piece with none takes the next free one.
  const moved = settleColumns(c);
  c.pieces.forEach(p => { if(p.column < 0) p.column = nextFreeColumn({ pieces: c.pieces.filter(x => x.column >= 0) }); });
  return { pieces: c.pieces, notes: { loops, moved } };
}

// A piece's file form; partOf(key) gives a rectangle's { canvasId, nodeId, name } with its colour.
function freePieceData(p, partOf){
  const sits = p.sits.on === 'level' ? { on: 'level', value: p.sits.value } : p.sits.of ? { on: p.sits.on, of: p.sits.of } : { on: 'zero' };
  return Object.assign({ id: p.id, name: p.name, column: p.column, sits }, p.minus ? { minus: true } : {}, p.check ? { check: p.check } : {},
    { parts: p.parts.map(partOf) });
}

// A piece's name as shown: its own, else its one rectangle's, else "Piece n"; "−" with Minus.
function pieceLabel(c, p){
  const name = p.name || (p.parts.length === 1 ? partLabel(p.parts[0]) : 'Piece ' + (c.pieces.indexOf(p) + 1));
  return (p.minus ? '−' : '') + name;
}

// What a Free chart shows in one calculation, a figure per piece in the list's order:
// { value, up, down, base, top, bottom, end, parts: [{ value, from, to }], check } — or
// { error: code, part } when one of its rectangles can't be worked out, or { blocked: name }
// when the piece it rests on can't be drawn. check: { agree, a (this piece's total), b (that
// piece's end) }, { error: true }, or null.
function freeFigures(c, results){
  const figs = new Map(), busy = new Set();
  const figure = (p) => {
    if(figs.has(p.id)) return figs.get(p.id);
    if(busy.has(p.id)) return { value: 0, up: 0, down: 0, base: 0, top: 0, bottom: 0, end: 0, parts: [] }; // never: loops are put right when read
    busy.add(p.id);
    let f;
    const rs = p.parts.map(key => resultOf(results, model.byKey.get(key), c.period));
    const bad = rs.findIndex(r => r.error);
    if(bad >= 0) f = { error: rs[bad].error, part: bad };
    else {
      const vals = rs.map(r => p.minus ? -r.value : r.value);
      const up = vals.reduce((s, v) => s + Math.max(0, v), 0), down = vals.reduce((s, v) => s + Math.min(0, v), 0);
      const value = vals.reduce((s, v) => s + v, 0);
      let base = 0;
      const of = restsOn(c, p);
      if(p.sits.on === 'level') base = p.sits.value;
      else if(of){
        const o = figure(of);
        if(o.error !== undefined || o.blocked !== undefined) f = { blocked: pieceLabel(c, of), why: o.error !== undefined ? 'error' : 'blocked' };
        else base = p.sits.on === 'end' ? o.end : (o.up > 0 || o.down === 0 ? o.top : o.bottom);
      }
      if(!f){
        let u = base, d = base;
        const parts = vals.map(v => { const from = v >= 0 ? u : d, to = from + v; if(v >= 0) u = to; else d = to; return { value: v, from, to }; });
        f = { value, up, down, base, top: base + up, bottom: base + down, end: base + value, parts };
      }
    }
    busy.delete(p.id);
    figs.set(p.id, f);
    return f;
  };
  return c.pieces.map(p => {
    const f = Object.assign({}, figure(p));
    const other = p.check ? c.pieces.find(q => q.id === p.check) : null;
    f.check = null;
    if(other){
      const o = figure(other);
      f.check = f.value === undefined || o.end === undefined ? { error: true } : { agree: agree(f.value, o.end), a: f.value, b: o.end };
    }
    return f;
  });
}

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
