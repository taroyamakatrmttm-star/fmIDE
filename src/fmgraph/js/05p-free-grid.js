// ============================================================
// Placing a Free chart's pieces on the grid (phase F2, docs/fmgraph-free-chart.md): on a
// computer or an iPad, on the board only — never in the full screen (05h), a GIF (05o) or on a
// phone, where Edit chart's list places the pieces.
// - Drag a piece (a mouse at once; a finger or pen after holding it still, so a swipe still
//   scrolls the page). Across, it moves column by column, its stack with it (pieceStack); the
//   equal-gap marks (⟷) show, and it snaps, where the empty columns either side of it match
//   those between its neighbours (the shared equalSpacingSnap, step 12a). Up and down, the chart
//   proposes where it sits (sitsChoices): a blue guide on zero, on another piece's top or where
//   another ends, with its words; letting go takes it. With no guide near it keeps its Sits (the
//   owner's choice 1a). A column it can't share: the piece there swaps (2a, placePiece).
// - Shift+click (or a box dragged on the chart's empty space) selects several: Align bottoms,
//   Distribute (fmIDE's rule, the shared distributePositions) and Tidy, in .free-tools.
// - A selected piece's keys: ← → a column, ↑ ↓ the next place it could sit above or below.
// Each change is one undo step (saveBoardSoon). The selection is this page's only, never saved.
// ============================================================
const FREE_GUIDE_PX = 10;  // how near (screen pixels) a guide takes the dragged piece
const FREE_DRAG_PX = 3;    // a press that moves less is a click
const freeSelection = new Map(); // chart id → Set of piece ids
let freeDrag = null;       // the drag under way: { chartId, pieceId, dx, dy, col, choice, gaps }

const freeGridOn = (el) => !isPhone() && !!el.closest('#board');
const freeChartSvg = (id) => document.querySelector('#board .chart-widget[data-id="' + id + '"] svg.free-chart');
function selectedPieces(c){
  const set = freeSelection.get(c.id) || new Set();
  [...set].forEach(id => { if(!c.pieces.some(p => p.id === id)) set.delete(id); });
  freeSelection.set(c.id, set);
  return set;
}
// A pointer's place in the drawing's own units.
function svgPoint(chart, ev){
  const m = chart.getScreenCTM();
  return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
const svgPerPixel = (chart) => chart.freeGeo.W / Math.max(1, chart.getBoundingClientRect().width);

// Called by drawChart (05b) after a Free chart is drawn into el.
function freeGridHook(el, c, chart){
  if(!freeGridOn(el)) return;
  chart.classList.add('free-grid');
  const sel = selectedPieces(c);
  chart.querySelectorAll('.fr-piece').forEach(g => {
    const p = c.pieces[Number(g.dataset.piece)];
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', pieceLabel(c, p) + ', column ' + (p.column + 1));
    g.classList.toggle('selected', sel.has(p.id));
  });
  onPress(chart, (ev) => freePress(ev, c, chart));
  chart.addEventListener('keydown', (ev) => freeKey(ev, c));
  // A finger holding a piece drags it: the page must not scroll under it.
  chart.addEventListener('touchmove', (ev) => { if(freeDrag && ev.cancelable) ev.preventDefault(); }, { passive: false });
  renderFreeTools(el, c);
  if(freeDrag && freeDrag.chartId === c.id) paintFreeDrag(chart, c);
}

function freePress(ev, c, chart){
  if(ev.type === 'mousedown' && ev.button !== 0) return;
  const g = ev.target.closest && ev.target.closest('.fr-piece');
  const p = g ? c.pieces[Number(g.dataset.piece)] : null;
  const mouse = ev.type === 'mousedown' || ev.pointerType === 'mouse';
  const sel = selectedPieces(c);
  if(!p){
    if(mouse){ pressDefault(ev); freeBox(ev, c, chart); }
    return;
  }
  if(ev.shiftKey){
    pressDefault(ev);
    if(sel.has(p.id)) sel.delete(p.id); else sel.add(p.id);
    showFreeSelection(c);
    return;
  }
  if(mouse){
    pressDefault(ev);
    g.focus({ preventScroll: true });
    freePieceDrag(ev, c, p);
    return;
  }
  // A finger or pen: a hold drags, a tap selects.
  waitForHold(ev, {
    onHold: () => freePieceDrag(ev, c, p, true),
    onRelease: (up, cancelled) => { if(!cancelled){ sel.clear(); sel.add(p.id); showFreeSelection(c); } }
  });
}

// Selection classes and the buttons, without drawing the chart again.
function showFreeSelection(c){
  const sel = selectedPieces(c);
  const chart = freeChartSvg(c.id);
  if(chart) chart.querySelectorAll('.fr-piece').forEach(g => g.classList.toggle('selected', sel.has(c.pieces[Number(g.dataset.piece)].id)));
  const el = document.querySelector('#board .chart-widget[data-id="' + c.id + '"]');
  if(el) renderFreeTools(el, c);
}

// Dragging piece p. held: a finger that held it (the drag starts at once, the page kept still).
function freePieceDrag(down, c, p, held){
  const chart0 = freeChartSvg(c.id);
  if(!chart0 || !chart0.freeGeo) return;
  const start = svgPoint(chart0, down);
  const x0 = down.clientX, y0 = down.clientY;
  let moved = !!held;
  const sel = selectedPieces(c);
  const begin = () => {
    freeDrag = { chartId: c.id, pieceId: p.id, dx: 0, dy: 0, col: p.column, choice: null, gaps: [] };
    if(!sel.has(p.id)){ sel.clear(); sel.add(p.id); }
    document.body.classList.add('free-dragging');
  };
  if(held) begin();
  followPointer(down, (mv) => {
    if(!moved){
      if(Math.hypot(mv.clientX - x0, mv.clientY - y0) < FREE_DRAG_PX) return;
      moved = true;
      begin();
    }
    const chart = freeChartSvg(c.id);
    if(!chart || !chart.freeGeo || !freeDrag) return;
    const pt = svgPoint(chart, mv);
    freeDrag.dx = pt.x - start.x; freeDrag.dy = pt.y - start.y;
    freeDragTarget(chart, c, p);
    paintFreeDrag(chart, c);
  }, (up, cancelled) => {
    const d = freeDrag;
    freeDrag = null;
    document.body.classList.remove('free-dragging');
    if(!moved){ sel.clear(); sel.add(p.id); showFreeSelection(c); return; }
    if(!cancelled && d && c.pieces.includes(p)){
      const sits = d.choice && !sameSits(d.choice.sits, p.sits) ? d.choice.sits : null;
      if(d.col !== p.column || sits){
        placePiece(c, p, d.col, sits);
        saveBoardSoon();
      }
    }
    renderBoard();
  });
}

// Where the drag would put the piece now: its column (with the equal-gap marks) and the guide.
function freeDragTarget(chart, c, p){
  const geo = chart.freeGeo, d = freeDrag;
  const i = c.pieces.indexOf(p), f = geo.figs[i];
  const stack = pieceStack(c, p);
  const maxCol = Math.min(FREE_LIMITS.columns - 1, geo.ncols);
  // Across: the column under the piece's middle, or the equal-spacing place within half a column.
  const colF = (geo.cxOf(p.column) + d.dx - 4) / geo.slot - 0.5;
  const boxes = [...new Set(c.pieces.filter(q => !stack.includes(q)).map(q => q.column))].map(x => ({ x, y: 0, w: 1, h: 1 }));
  const es = equalSpacingSnap(boxes, colF, 0, 1, 1, 'x', 0.5);
  if(es && Number.isInteger(es.pos) && es.pos <= maxCol){ d.col = es.pos; d.gaps = es.gaps; }
  else { d.col = Math.max(0, Math.min(maxCol, Math.round(colF))); d.gaps = []; }
  // Up and down: the nearest place it could sit, none further than FREE_GUIDE_PX on the screen
  // (then it keeps its Sits). Places at the same height: where it sits now first, then on top of
  // a piece in the column it is going to (a stack), then where a piece in another column ends (a
  // waterfall step).
  d.choice = null;
  if(!f || f.base === undefined) return;
  const at = geo.y(f.base) + d.dy, near = FREE_GUIDE_PX * svgPerPixel(chart);
  const rank = (ch) => {
    if(sameSits(ch.sits, p.sits)) return 3;
    const q = ch.sits.of ? c.pieces.find(x => x.id === ch.sits.of) : null;
    if(q && ch.sits.on === 'top' && q.column === d.col) return 2;
    if(q && ch.sits.on === 'end' && q.column !== d.col) return 1;
    return 0;
  };
  let best = null;
  sitsChoices(c, p, geo.figs).forEach(ch => {
    const dist = Math.abs(geo.y(ch.level) - at);
    if(dist >= near) return;
    const same = best && Math.abs(dist - best.dist) < 0.5;
    if(!best || (same ? rank(ch) > best.rank : dist < best.dist)) best = { dist, rank: rank(ch), ch };
  });
  if(best) d.choice = best.ch;
}

// The dragged piece (and its stack) where the pointer has it, the target column, the guide and
// the equal-gap marks; drawn again after any redraw while the drag goes on.
function paintFreeDrag(chart, c){
  const d = freeDrag, geo = chart.freeGeo;
  chart.querySelectorAll('.fr-drag-mark').forEach(x => x.remove());
  const p = c.pieces.find(q => q.id === d.pieceId);
  if(!p || !geo) return;
  const f = geo.figs[c.pieces.indexOf(p)];
  const dy = d.choice && f && f.base !== undefined ? geo.y(d.choice.level) - geo.y(f.base) : d.dy;
  pieceStack(c, p).forEach(q => {
    const g = chart.querySelector('.fr-piece[data-piece="' + c.pieces.indexOf(q) + '"]');
    if(g){ g.setAttribute('transform', 'translate(' + d.dx + ' ' + dy + ')'); g.classList.add('dragging'); }
  });
  const mark = (tag, attrs, text) => chart.appendChild(svg(tag, Object.assign({}, attrs, { class: 'fr-drag-mark ' + (attrs.class || '') }), text));
  const cx = geo.cxOf(d.col);
  mark('rect', { class: 'fr-target', x: cx - geo.bw / 2 - 3, y: geo.top, width: geo.bw + 6, height: geo.plotH });
  if(d.choice){
    const gy = geo.y(d.choice.level);
    mark('line', { class: 'fr-guide', x1: 0, x2: geo.W, y1: gy, y2: gy });
    const right = cx > geo.W * 0.6;
    mark('text', { class: 'fr-guide-label', x: right ? cx - geo.bw / 2 - 6 : cx + geo.bw / 2 + 6, y: gy - 4, 'text-anchor': right ? 'end' : 'start' }, d.choice.label);
  }
  const ex = (col) => 4 + geo.slot * col; // a column's left edge
  const gapY = geo.top + geo.plotH + 6;
  d.gaps.forEach(gp => {
    const x1 = ex(gp.from), x2 = ex(gp.to);
    mark('line', { class: 'fr-gap', x1, x2, y1: gapY, y2: gapY });
    mark('line', { class: 'fr-gap', x1, x2: x1, y1: gapY - 4, y2: gapY + 4 });
    mark('line', { class: 'fr-gap', x1: x2, x2, y1: gapY - 4, y2: gapY + 4 });
  });
}

// A box dragged on the chart's empty space selects the pieces it touches (Shift: adds them); a
// click there clears the selection.
function freeBox(down, c, chart0){
  const start = svgPoint(chart0, down);
  const sel = selectedPieces(c);
  const keep = down.shiftKey ? new Set(sel) : new Set();
  let box = null;
  followPointer(down, (mv) => {
    const chart = freeChartSvg(c.id);
    if(!chart) return;
    const pt = svgPoint(chart, mv);
    if(!box){
      if(Math.hypot(mv.clientX - down.clientX, mv.clientY - down.clientY) < FREE_DRAG_PX) return;
      box = { x: start.x, y: start.y };
    }
    box.w = pt.x - start.x; box.h = pt.y - start.y;
    chart.querySelectorAll('.fr-box').forEach(x => x.remove());
    chart.appendChild(svg('rect', { class: 'fr-box fr-drag-mark', x: Math.min(start.x, pt.x), y: Math.min(start.y, pt.y), width: Math.abs(box.w), height: Math.abs(box.h) }));
  }, () => {
    const chart = freeChartSvg(c.id);
    if(chart) chart.querySelectorAll('.fr-box').forEach(x => x.remove());
    sel.clear();
    keep.forEach(id => sel.add(id));
    if(box && chart){
      const x1 = Math.min(box.x, box.x + box.w), x2 = Math.max(box.x, box.x + box.w);
      const y1 = Math.min(box.y, box.y + box.h), y2 = Math.max(box.y, box.y + box.h);
      chart.querySelectorAll('.fr-piece').forEach(g => {
        const b = g.getBBox();
        if(b.width + b.height > 0 && b.x <= x2 && b.x + b.width >= x1 && b.y <= y2 && b.y + b.height >= y1) sel.add(c.pieces[Number(g.dataset.piece)].id);
      });
    }
    showFreeSelection(c);
  });
}

// Keys on a piece: ← → a column (its stack with it, a piece there swapping), ↑ ↓ the next place
// it could sit above or below where it sits now; Esc clears the selection.
function freeKey(ev, c){
  const g = ev.target.closest && ev.target.closest('.fr-piece');
  if(!g) return;
  const i = Number(g.dataset.piece), p = c.pieces[i];
  if(!p) return;
  if(ev.key === 'Escape'){ selectedPieces(c).clear(); showFreeSelection(c); return; }
  const across = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
  const down = ev.key === 'ArrowDown' ? -1 : ev.key === 'ArrowUp' ? 1 : 0;
  if(!across && !down) return;
  ev.preventDefault();
  if(across){
    const col = p.column + across;
    if(col < 0 || col >= FREE_LIMITS.columns) return;
    placePiece(c, p, col, null);
  } else {
    const figs = freeFigures(c, currentResults()), f = figs[i];
    if(!f || f.base === undefined) return;
    const ahead = sitsChoices(c, p, figs).filter(ch => down > 0 ? ch.level > f.base && !agree(ch.level, f.base) : ch.level < f.base && !agree(ch.level, f.base));
    if(!ahead.length) return;
    ahead.sort((a, b) => down > 0 ? a.level - b.level : b.level - a.level);
    placePiece(c, p, p.column, ahead[0].sits);
  }
  const sel = selectedPieces(c);
  sel.clear(); sel.add(p.id);
  saveBoardSoon();
  renderBoard();
  const again = document.querySelector('#board .chart-widget[data-id="' + c.id + '"] .fr-piece[data-piece="' + c.pieces.indexOf(p) + '"]');
  if(again) again.focus({ preventScroll: true });
}

// Align bottoms, Distribute and Tidy, under the chart (made once per widget, then kept in step).
function renderFreeTools(el, c){
  let tools = el.querySelector('.free-tools');
  if(!tools){
    tools = make('div', 'free-tools');
    const button = (cls, text, title, fn) => {
      const b = make('button', 'mini ' + cls, text);
      b.type = 'button';
      b.title = title;
      b.addEventListener('click', () => { const cc = board.charts.find(x => x.id === c.id); if(cc) fn(cc); });
      tools.appendChild(b);
    };
    const chosen = (cc) => cc.pieces.filter(p => selectedPieces(cc).has(p.id));
    button('free-align', 'Align bottoms', 'Put the selected pieces on zero', (cc) => { alignPieceBottoms(cc, chosen(cc)); saveBoardSoon(); renderBoard(); });
    button('free-distribute', 'Distribute', 'Spread the selected pieces evenly across the columns they span', (cc) => { if(distributePieces(cc, chosen(cc))){ saveBoardSoon(); renderBoard(); } });
    button('free-tidy', 'Tidy', 'Close up the empty columns', (cc) => { tidyPieces(cc); saveBoardSoon(); renderBoard(); });
    el.querySelector('.bar-chart-host').after(tools);
  }
  const sel = c.pieces.filter(p => selectedPieces(c).has(p.id));
  const cols = new Set(c.pieces.map(p => p.column));
  tools.querySelector('.free-align').disabled = sel.length < 2 || sel.every(p => p.sits.on === 'zero');
  tools.querySelector('.free-distribute').disabled = new Set(sel.map(p => p.column)).size < 3;
  tools.querySelector('.free-tidy').disabled = !c.pieces.length || cols.size === Math.max(...cols) + 1;
  tools.classList.toggle('hidden', !c.pieces.length);
}
