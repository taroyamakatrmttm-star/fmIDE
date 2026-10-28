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
