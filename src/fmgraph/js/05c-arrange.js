// ============================================================
// Arranging (G3a): the boards as tabs, and the widgets on a board in an ordered grid.
// - Tabs above the board: one per board; + Board adds one; the board shown can be renamed
//   (double-click its tab, or ✎), duplicated or deleted (asked first; the last can't go).
// - Every widget has a handle (⠿): drag it to move the widget among the others — a bar or
//   chart among the bars and charts, a slider among the sliders — by mouse, finger or pen
//   (shared pointer-input.js), or press ← ↑ / → ↓ on it. ⇔ makes a bar or chart wide (the
//   whole row) or narrow (half). Every change is one undo step.
// ============================================================
function renderAll(){ renderTabs(); renderBoard(); syncUndoButtons(); }

function renderTabs(){
  const strip = $('boardTabs');
  strip.textContent = '';
  if(!model) return;
  boards.forEach((b, i) => {
    const t = make('button', 'board-tab' + (b === board ? ' active' : ''), b.name);
    t.type = 'button';
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', b === board ? 'true' : 'false');
    t.dataset.index = String(i);
    t.addEventListener('click', () => { if(b !== board){ showBoardAt(i); } });
    t.addEventListener('dblclick', () => { if(b === board) renameBoard(t); });
    strip.appendChild(t);
  });
  const tool = (text, label, fn, cls) => { const x = make('button', 'board-tool' + (cls ? ' ' + cls : ''), text); x.type = 'button'; x.title = label; x.setAttribute('aria-label', label); x.addEventListener('click', fn); strip.appendChild(x); return x; };
  tool('+ Board', 'Add an empty board', () => addBoard()).disabled = boards.length >= BOARDS_LIMIT;
  tool('✎', 'Rename this board', () => renameBoard(strip.querySelector('.board-tab.active')));
  tool('⧉', 'Duplicate this board', () => duplicateBoard()).disabled = boards.length >= BOARDS_LIMIT;
  tool('🗑', 'Delete this board', () => deleteBoard(), 'danger').disabled = boards.length < 2;
}

function showBoardAt(i){
  board = boards[i];
  activeSlider = null;
  saveBoardNow();
  renderAll();
}
function freeBoardName(base){
  const names = new Set(boards.map(b => b.name.toLowerCase()));
  if(!names.has(base.toLowerCase())) return base;
  for(let n = 2; ; n++){ const t = base + ' (' + n + ')'; if(!names.has(t.toLowerCase())) return t; }
}
function addBoard(name){
  if(boards.length >= BOARDS_LIMIT) return null;
  const b = makeBoard(freeBoardName(name || 'Board'));
  boards.push(b);
  board = b;
  saveBoardSoon();
  renderAll();
  return b;
}
function duplicateBoard(){
  if(boards.length >= BOARDS_LIMIT) return null;
  const r = cleanBoards({ kind: 'fmIDE-graph-board', boards: [boardData(board)] });
  const copy = r.boards[0];
  copy.name = freeBoardName(board.name + ' copy');
  boards.splice(boards.indexOf(board) + 1, 0, copy);
  board = copy;
  saveBoardSoon();
  renderAll();
  return copy;
}
async function deleteBoard(){
  if(boards.length < 2) return false;
  if(!(await askConfirm('Delete this board?', '"' + board.name + '" and its bars, charts and sliders go. Undo brings it back.', 'Delete'))) return false;
  removeBoard(board);
  return true;
}
function removeBoard(b){
  const i = boards.indexOf(b);
  if(i < 0 || boards.length < 2) return;
  boards.splice(i, 1);
  board = boards[Math.min(i, boards.length - 1)];
  saveBoardSoon();
  renderAll();
}
function setBoardName(b, name){
  const n = cleanText(name, 60);
  if(!n || n === b.name) return;
  b.name = n;
  saveBoardSoon();
}
// The board's tab becomes a text box until Enter, Esc or a click elsewhere.
function renameBoard(tab){
  if(!tab) return;
  const box = make('input', 'board-tab-name');
  box.type = 'text';
  box.value = board.name;
  box.maxLength = 60;
  box.setAttribute('aria-label', 'Board name');
  let done = false;
  const finish = (keep) => { if(done) return; done = true; if(keep) setBoardName(board, box.value); renderAll(); };
  box.addEventListener('keydown', (ev) => { if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); } else if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); } });
  box.addEventListener('blur', () => finish(true));
  tab.replaceWith(box);
  box.focus();
  box.select();
}

// ---- moving widgets ----
// The handle and, for a bar or chart, the wide / narrow switch, for a widget's head.
function arrangeControls(w, el){
  const span = make('span', 'arrange');
  const handle = make('button', 'drag-handle', '⠿');
  handle.type = 'button';
  handle.title = 'Drag to move (or ← → with the keyboard)';
  handle.setAttribute('aria-label', 'Move');
  handle.addEventListener('keydown', (ev) => {
    const list = w.kind ? board.items : board.sliders;
    const i = list.indexOf(w);
    const step = (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') ? -1 : (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : 0;
    if(!step) return;
    ev.preventDefault();
    if(moveWidget(w.id, i + step)){ renderBoard(); const h = document.querySelector('[data-id="' + w.id + '"] .drag-handle'); if(h) h.focus(); }
  });
  onPress(handle, (ev) => startDrag(ev, w, el));
  span.appendChild(handle);
  if(w.kind){
    const size = make('button', 'size-toggle' + (w.wide ? ' on' : ''), '⇔');
    size.type = 'button';
    size.title = w.wide ? 'Make narrow (half a row)' : 'Make wide (the whole row)';
    size.setAttribute('aria-label', 'Wide');
    size.setAttribute('aria-pressed', w.wide ? 'true' : 'false');
    size.addEventListener('click', () => { w.wide = !w.wide; saveBoardSoon(); renderBoard(); });
    span.appendChild(size);
  }
  return span;
}

// Dragging by the handle: the widget follows the pointer's place among its neighbours (the
// others make room as it passes), and is put there when the pointer lifts. A cancelled drag
// (the browser took the finger over) leaves everything as it was.
function startDrag(ev, w, el){
  pressDefault(ev);
  const box = el.parentNode;
  const list = w.kind ? board.items : board.sliders;
  const from = list.indexOf(w);
  el.classList.add('dragging');
  document.body.classList.add('widget-dragging');
  const place = (x, y) => {
    const others = [...box.children].filter(c => c !== el && c.dataset.id);
    // The neighbour the pointer is over (or the nearest before it): the widget goes before
    // it when the pointer is on its first half, after it otherwise.
    let target = null, after = false, best = Infinity;
    others.forEach(c => {
      const r = c.getBoundingClientRect();
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      const d = inside ? -1 : Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if(d < best){ best = d; target = c; after = (r.width > r.height * 1.6 ? x > r.left + r.width / 2 : y > r.top + r.height / 2) || (!inside && y > r.bottom); }
    });
    if(!target) return;
    if(after) target.after(el); else target.before(el);
  };
  followPointer(ev, (mv) => place(mv.clientX, mv.clientY), (up, cancelled) => {
    el.classList.remove('dragging');
    document.body.classList.remove('widget-dragging');
    const to = [...box.children].filter(c => c.dataset.id).indexOf(el);
    if(!cancelled && to >= 0 && to !== from) moveWidget(w.id, to);
    renderBoard();
  });
}
