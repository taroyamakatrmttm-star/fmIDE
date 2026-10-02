// ============================================================
// Undo and Redo (G3a) for every change to the boards: adding, removing, moving, resizing and
// colouring widgets, editing charts, sliders' settings, boards added, renamed or deleted, a
// board imported. Each change (saveBoardSoon → noteChange) keeps the boards as they were
// before it, in their file form; Undo puts that back. Moving a slider is a "what if", not a
// change, and showing another board is not one either. Sliders keep their positions through an
// undo where they are still there.
// ============================================================
const UNDO_LIMIT = 100;
let undoStack = [], redoStack = [], lastState = null, restoring = false;

// The boards' state for undo: their file form, without which one is shown.
function undoState(){ const d = boardsData(); delete d.active; return JSON.stringify(d); }

function resetUndo(){
  undoStack = []; redoStack = [];
  lastState = model ? undoState() : null;
  syncUndoButtons();
}
function noteChange(){
  if(restoring || !model) return;
  const now = undoState();
  if(lastState !== null && now !== lastState){
    undoStack.push(lastState);
    if(undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
    sendBoardsToFmideSoon();
  }
  lastState = now;
  syncUndoButtons();
}
function restoreState(text){
  const shown = Math.max(0, boards.indexOf(board));
  // Slider positions, by board, rectangle and setting, to keep them where the slider survives.
  const positions = new Map();
  boards.forEach((b, bi) => b.sliders.forEach(s => { if(s.value !== null) positions.set(bi + '|' + s.key + '|' + s.mode, s.value); }));
  const r = cleanBoards(JSON.parse(text));
  if(!r || !r.boards.length) return;
  boards = r.boards;
  boards.forEach((b, bi) => b.sliders.forEach(s => { const v = positions.get(bi + '|' + s.key + '|' + s.mode); if(v !== undefined) s.value = v; }));
  board = boards[Math.min(shown, boards.length - 1)];
  lastState = text;
  restoring = true;
  try{ saveBoardNow(); } finally { restoring = false; }
  sendBoardsToFmideSoon();
  renderAll();
}
function undo(){
  if(!undoStack.length) return false;
  redoStack.push(lastState);
  restoreState(undoStack.pop());
  syncUndoButtons();
  return true;
}
function redo(){
  if(!redoStack.length) return false;
  undoStack.push(lastState);
  restoreState(redoStack.pop());
  syncUndoButtons();
  return true;
}
function syncUndoButtons(){
  const u = $('btnUndo'), r = $('btnRedo');
  if(u) u.disabled = !model || !undoStack.length;
  if(r) r.disabled = !model || !redoStack.length;
}
