// ---------- snapping (shared: src/shared/snap.js; fmIDE's canvas and fmGraph's Free chart) ----------
// The geometry of fmIDE's snapping (step 12a), moved here for fmGraph's Free chart (phase F2 of
// docs/fmgraph-free-chart.md) with no change to what it does: plain functions on boxes
// { x, y, w, h } and a distance. fmIDE passes SNAP_THRESHOLD / zoom (6 pixels on the screen at
// every zoom); fmGraph passes columns as boxes. Nothing here touches the page.

// Where a w × h box dragged to x, y snaps among `boxes`. Each direction on its own: lining up an
// edge or the middle with another box (the guides, guideX / guideY), or equal spacing with the
// boxes in its row (horizontally) or column (vertically): after the last of a run, before the
// first, or halfway between two neighbours, with the gaps between edges equal (the rule of
// distributePositions). The nearer snap wins, alignment on a tie; nothing as far as `threshold`.
// `gaps` are the equal gaps to mark while it snaps. Positions are not kept inside anything:
// the caller does that.
export function snapPlace(boxes, x, y, w, h, threshold){
  let bestX = x, bestXDist = threshold, guideX = null;
  let bestY = y, bestYDist = threshold, guideY = null;
  const me = { left:x, right:x+w, centerX:x+w/2 };
  const meY = { top:y, bottom:y+h, centerY:y+h/2 };

  boxes.forEach(o => {
    const oe = { left:o.x, right:o.x+o.w, centerX:o.x+o.w/2 };
    const oeY = { top:o.y, bottom:o.y+o.h, centerY:o.y+o.h/2 };
    ['left','right','centerX'].forEach(k => {
      const dist = Math.abs(me[k]-oe[k]);
      if(dist < bestXDist){
        bestXDist = dist;
        bestX = k==='left' ? oe[k] : (k==='right' ? oe[k]-w : oe[k]-w/2);
        guideX = oe[k];
      }
    });
    ['top','bottom','centerY'].forEach(k => {
      const dist = Math.abs(meY[k]-oeY[k]);
      if(dist < bestYDist){
        bestYDist = dist;
        bestY = k==='top' ? oeY[k] : (k==='bottom' ? oeY[k]-h : oeY[k]-h/2);
        guideY = oeY[k];
      }
    });
  });

  const gaps = [];
  const ex = equalSpacingSnap(boxes, x, y, w, h, 'x', threshold);
  if(ex && ex.dist < bestXDist){ bestX = ex.pos; guideX = null; gaps.push(...ex.gaps); }
  const ey = equalSpacingSnap(boxes, x, y, w, h, 'y', threshold);
  if(ey && ey.dist < bestYDist){ bestY = ey.pos; guideY = null; gaps.push(...ey.gaps); }
  return { x: bestX, y: bestY, guideX, guideY, gaps };
}

// Equal spacing along one axis ('x': a row, 'y': a column) for a w × h box at x, y: the
// nearest place closer than `threshold`, or null. `gaps` lists each equal gap as
// { axis, from, to, at } (from / to along the axis, `at` across it). A place below 0 is never
// offered.
export function equalSpacingSnap(boxes, x, y, w, h, axis, threshold){
  const X = axis === 'x';
  const pos = X ? x : y, len = X ? w : h;
  const crossA = X ? y : x, crossB = crossA + (X ? h : w);
  const lo = b => X ? b.x : b.y, hi = b => X ? b.x + b.w : b.y + b.h;
  const cLo = b => X ? b.y : b.x, cHi = b => X ? b.y + b.h : b.x + b.w;
  // The row (or column): boxes overlapping the dragged one across the axis, in order.
  const line = boxes.filter(b => cLo(b) < crossB && cHi(b) > crossA).sort((p, q) => lo(p) - lo(q) || hi(p) - hi(q));
  if(line.length < 2) return null;
  const free = (a, b) => line.every(o => hi(o) <= a || lo(o) >= b);
  // Where the gap between two boxes is marked across the axis: the middle of what they share
  // across it, or the dragged box's middle.
  const at = (p, q) => {
    const a = Math.max(cLo(p), cLo(q)), b = Math.min(cHi(p), cHi(q));
    return a < b ? (a + b) / 2 : (crossA + crossB) / 2;
  };
  const me = (p) => X ? { x: p, y, w, h } : { x, y: p, w, h };
  let best = null;
  const consider = (p, gapList) => {
    const dist = Math.abs(p - pos);
    if(p >= 0 && dist < threshold && (!best || dist < best.dist)) best = { pos: p, dist, gaps: gapList };
  };
  const mark = (p, q) => ({ axis, from: hi(p), to: lo(q), at: at(p, q) });
  for(let i = 0; i + 1 < line.length; i++){
    const A = line[i], B = line[i + 1];
    const g = lo(B) - hi(A);
    if(g < 0 || !free(hi(A), lo(B))) continue; // overlapping, or not neighbours
    // After B: [A] g [B] g [C]
    const after = hi(B) + g;
    if(free(hi(B), after + len)){ const C = me(after); consider(after, [mark(A, B), mark(B, C)]); }
    // Before A: [C] g [A] g [B]
    const before = lo(A) - g - len;
    if(free(before, lo(A))){ const C = me(before); consider(before, [mark(C, A), mark(A, B)]); }
    // Halfway between A and B: [A] e [C] e [B]
    if(g >= len){ const mid = hi(A) + (g - len) / 2; const C = me(mid); consider(mid, [mark(A, C), mark(C, B)]); }
  }
  return best;
}

// Distribute: the boxes spread along one axis ('h' across, 'v' down) with equal gaps between
// their edges, the first and the last staying where they are. Gives each box's new x (or y),
// in the order the boxes were given; null for fewer than three.
export function distributePositions(boxes, axis){
  if(boxes.length < 3) return null;
  const H = axis === 'h';
  const at = b => H ? b.x : b.y, len = b => H ? b.w : b.h;
  const out = boxes.map(at);
  const order = boxes.map((b, i) => i).sort((i, j) => at(boxes[i]) - at(boxes[j]));
  const first = boxes[order[0]], last = boxes[order[order.length - 1]];
  const span = (at(last) + len(last)) - at(first);
  const total = order.reduce((s, i) => s + len(boxes[i]), 0);
  const gap = (span - total) / (order.length - 1);
  let cursor = at(first) + len(first) + gap;
  for(let k = 1; k < order.length - 1; k++){
    const i = order[k];
    out[i] = cursor;
    cursor = out[i] + len(boxes[i]) + gap;
  }
  return out;
}
