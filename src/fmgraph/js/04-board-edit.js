// ============================================================
// fmGraph's boards kept in this browser, and the board changes made on fmGraph's page (adding,
// removing and moving widgets). Reading boards is 04-board.js, the board engine's.
// ============================================================

const store = createStore('fmGraph');

const BOARD_PREFIX = 'fmgraph-board-';

const LAST_BOARD_KEY = 'fmgraph-last-board';

let saveTimer = null;

function saveBoardSoon(){
  forgetAutoColours(); // a chart may have changed (04e-colours.js)
  noteChange(); // undo (04c-undo.js)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoardNow, 300);
}

function saveBoardNow(){
  clearTimeout(saveTimer);
  if(!model || trying || practiceStart) return; // a template tried from the library (G5c), or a tutorial's practice (G6), is never kept
  const text = JSON.stringify(boardsData());
  Promise.all([store.put(BOARD_PREFIX + model.signature, text), store.put(LAST_BOARD_KEY, text)])
    .catch(() => notify('This browser could not keep the boards; they will be gone after a reload.', 'err', 'storage'));
}

// The document's own boards (G3b), when it brings any with something on them, win over the
// ones this browser keeps for the model, and are then kept here too.
function documentBoards(raw){
  try{
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if(!data || typeof data !== 'object' || fileDataProblem(data)) return null;
    const r = cleanBoards(data);
    return r && r.boards.some(b => b.items.length || b.sliders.length) ? r : null;
  }catch(e){ return null; }
}

async function loadBoardFor(m, docRaw){
  // A tutorial's practice copy (G6): its starting board, nothing read from or kept in the browser.
  if(practiceStart){
    boards = practiceBoards(practiceStart);
    board = boards[0];
    scenarios = [];
    sharedPeriods = cleanSharedPeriods(null, m.periods.length);
    commonScale = cleanCommonScale(null);
    rectColours = new Map(); forgetAutoColours();
    resetUndo();
    return;
  }
  // A template tried from the library (G5c): its own boards, nothing read from or kept in the browser.
  if(trying){
    const fromTemplate = (m.templateSources || []).flatMap(src => boardsFromTemplate(src).boards).slice(0, BOARDS_LIMIT);
    boards = fromTemplate.length ? fromTemplate : [startingBoard()];
    board = boards[0];
    scenarios = [];
    sharedPeriods = cleanSharedPeriods(null, m.periods.length);
    commonScale = cleanCommonScale(null);
    rectColours = new Map(); forgetAutoColours();
    resetUndo();
    return;
  }
  let restored = docRaw ? documentBoards(docRaw) : null;
  if(restored){
    boards = restored.boards;
    board = boards[restored.active];
    scenarios = restored.scenarios;
    sharedPeriods = restored.sharedPeriods;
    commonScale = restored.commonScale;
    rectColours = restored.colours; forgetAutoColours();
    resetUndo();
    setTimeout(saveBoardNow, 0);
    return;
  }
  try{
    await store.ready;
    let raw = await store.get(BOARD_PREFIX + m.signature);
    let fromLast = false;
    if(typeof raw !== 'string' || !raw){ raw = await store.get(LAST_BOARD_KEY); fromLast = true; }
    if(typeof raw === 'string' && raw){
      const r = cleanBoards(JSON.parse(raw));
      if(r && r.boards.some(b => b.items.length || b.sliders.length)) restored = r;
      if(restored && fromLast) setTimeout(saveBoardNow, 0);
    }
  }catch(e){ /* unreadable: start a new board */ }
  // None of its own: its templates' boards (G5b, 06d-template-sources.js), else a starting board.
  const fromTemplates = restored ? [] : templateStartBoards();
  if(fromTemplates.length) setTimeout(saveBoardNow, 0);
  boards = restored ? restored.boards : fromTemplates.length ? fromTemplates : [startingBoard()];
  board = boards[restored ? restored.active : 0];
  scenarios = restored ? restored.scenarios : [];
  sharedPeriods = restored ? restored.sharedPeriods : cleanSharedPeriods(null, m.periods.length);
  commonScale = restored ? restored.commonScale : cleanCommonScale(null);
  rectColours = restored ? restored.colours : new Map(); forgetAutoColours();
  resetUndo();
}

// A new model's board: a slider on the first input that reaches a calculated rectangle, and
// a bar on the last rectangle it reaches, so something moves straight away.
function startingBoard(){
  const b = makeBoard('Board');
  for(const input of model.inputs){
    const reached = model.reach(input.key);
    const targets = model.rects.filter(r => !r.input && reached.has(r.key));
    if(!targets.length) continue;
    const periods = { mode: 'all' };
    b.sliders.push(Object.assign({ id: newWidgetId('s'), key: input.key, periods, mode: 'set', value: null }, defaultRange(input, periods, 'set')));
    b.items.push({ id: newWidgetId('b'), kind: 'bar', key: targets[targets.length - 1].key, periods: { mode: 'all' }, wide: false, colour: null });
    break;
  }
  return b;
}

function addBar(key, periods){
  const rect = model.byKey.get(key) || model.rects.find(r => !r.input) || model.rects[0];
  if(!rect || board.bars.length >= BOARD_LIMIT) return null;
  // Given periods, it keeps them; without, it follows the shared periods (05k-shared-period.js).
  const bar = { id: newWidgetId('b'), kind: 'bar', key: rect.key, periods: cleanPeriods(periods, model.periods.length), wide: false, colour: null, ownPeriod: periods !== undefined };
  board.items.push(bar);
  saveBoardSoon();
  return bar;
}

function addSlider(key, periods, mode, range){
  const rect = (model.byKey.get(key) && model.byKey.get(key).input) ? model.byKey.get(key) : model.inputs[0];
  if(!rect || board.sliders.length >= BOARD_LIMIT) return null;
  const p = cleanPeriods(periods, model.periods.length);
  const m = mode === 'shift' ? 'shift' : 'set';
  const s = Object.assign({ id: newWidgetId('s'), key: rect.key, periods: p, mode: m, value: null }, cleanRange(range || {}, defaultRange(rect, p, m)));
  board.sliders.push(s);
  saveBoardSoon();
  return s;
}

function removeWidget(id){
  const before = board.items.length + board.sliders.length;
  board.items = board.items.filter(w => w.id !== id);
  board.sliders = board.sliders.filter(s => s.id !== id);
  if(board.items.length + board.sliders.length !== before) saveBoardSoon();
}

// Moves a widget (a bar or chart among the items, or a slider among the sliders) to index `to`.
function moveWidget(id, to){
  const list = board.items.some(w => w.id === id) ? board.items : board.sliders;
  const from = list.findIndex(w => w.id === id);
  if(from < 0) return false;
  const at = Math.max(0, Math.min(list.length - 1, to));
  if(at === from) return false;
  const [w] = list.splice(from, 1);
  list.splice(at, 0, w);
  saveBoardSoon();
  return true;
}
