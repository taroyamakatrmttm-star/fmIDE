  // ---------- canvases + whole-system undo/redo ----------
  const MAX_HISTORY = 80;
  let history = [];
  let future = [];

  // writes the live nodes/edges/computedValues/computeErrors back into the
  // canvases registry entry for whichever canvas is currently active
  function syncActiveIntoRegistry(){
    const c = canvases.find(c => c.id === activeCanvasId);
    if(!c) return;
    c.nodes = nodes; c.edges = edges;
    c.computedValues = computedValues; c.computeErrors = computeErrors;
    c.portValues = portValues; c.portErrors = portErrors;
  }

  function loadCanvasState(c){
    invalidateIR();
    nodes = c.nodes; edges = c.edges;
    computedValues = c.computedValues; computeErrors = c.computeErrors;
    portValues = c.portValues || {}; portErrors = c.portErrors || {};
    showZoomOfCanvas(c.id); // each canvas its own zoom (07b)
  }

  function snapshot(){
    syncActiveIntoRegistry();
    // The model's function definitions are part of it (undoing an insert takes back the
    // definitions it brought).
    return JSON.stringify({ canvases, activeCanvasId, nextId, nextCanvasId, periods, currentPeriod, modelFunctions });
  }

  function pushHistory(){
    invalidateIR(); // the model is about to change
    // Inside a transaction (one API action, or a whole macro run) only the first push
    // records a snapshot, so the entire transaction undoes as a single step.
    if(tx.depth > 0){ if(tx.pushed) return; tx.pushed = true; }
    history.push(snapshot());
    if(history.length > MAX_HISTORY) history.shift();
    future = [];
    updateHistoryButtons();
    requestStoragePersistence();
    markDocDirty();
    hideWelcomeCard(); // the welcome card steps aside once you start building (01c)
  }

  // Takes back a change that began and was cancelled (a drag a pinch interrupted, 07b): the
  // model as it was before it, and no undo step for it.
  function dropLastHistory(){
    if(!history.length) return;
    restore(history.pop());
    render();
    updateHistoryButtons();
  }

  function restore(snap){
    const data = JSON.parse(snap);
    canvases = data.canvases;
    activeCanvasId = data.activeCanvasId;
    nextId = data.nextId;
    nextCanvasId = data.nextCanvasId;
    periods = Array.isArray(data.periods) && data.periods.length ? data.periods : ['Period 1'];
    currentPeriod = (typeof data.currentPeriod === 'number') ? Math.max(0, Math.min(periods.length - 1, data.currentPeriod)) : 0;
    modelFunctions = Array.isArray(data.modelFunctions) ? data.modelFunctions : [];
    const active = canvases.find(c => c.id === activeCanvasId) || canvases[0];
    activeCanvasId = active.id;
    loadCanvasState(active);
    renderPeriodControls();
  }

  function undo(){
    if(tx.depth > 0) fail('Undo cannot run inside a macro or another action.');
    if(history.length === 0) return;
    if(recorder.active) recorder.onUndo();
    future.push(snapshot());
    restore(history.pop());
    clearSelection();
    render();
    renderCanvasTabs();
    updateHistoryButtons();
    markDocDirty();
  }

  function redo(){
    if(tx.depth > 0) fail('Redo cannot run inside a macro or another action.');
    if(future.length === 0) return;
    if(recorder.active) toast('Redo is not captured by the macro recorder.');
    history.push(snapshot());
    restore(future.pop());
    clearSelection();
    render();
    renderCanvasTabs();
    updateHistoryButtons();
    markDocDirty();
  }

  function updateHistoryButtons(){ refreshCommandStates(); }

  function switchToCanvas(id){
    if(id === activeCanvasId) return;
    const target = canvases.find(c => c.id === id);
    if(!target) return;
    syncActiveIntoRegistry();
    activeCanvasId = id;
    loadCanvasState(target);
    clearSelection();
    renderCanvasTabs();
  }

  function addCanvas(){
    pushHistory();
    const c = {
      id: 'c' + (nextCanvasId++),
      name: 'Canvas ' + canvases.length,
      nodes: [], edges: [], computedValues: {}, computeErrors: {}, portValues: {}, portErrors: {}
    };
    canvases.push(c);
    activeCanvasId = c.id;
    loadCanvasState(c);
    clearSelection();
    renderCanvasTabs();
  }

  function deleteCanvasById(id){
    if(canvases.length <= 1){ showMessage('You need at least one canvas.'); return; }
    const c = canvases.find(c => c.id === id);
    if(!c) return;
    showConfirm(`Delete canvas "${c.name}" and everything on it?`, () => fm.deleteCanvas(id));
  }

  // Canvas tabs are rendered keyed by canvas id: an existing tab element is updated and
  // re-ordered in place rather than rebuilt, so a double-click (rename) and a drag always
  // land on the same element even when a click re-renders the tab strip in between.
  function canvasOfTab(tab){ return canvases.find(x => x.id === tab.dataset.id) || null; }

  function buildCanvasTab(id){
    const tab = document.createElement('div');
    tab.className = 'canvas-tab';
    tab.dataset.id = id;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    const closeX = document.createElement('span');
    closeX.className = 'close-x';
    closeX.textContent = '✕';
    closeX.title = 'Delete canvas';
    tab.appendChild(nameSpan);
    tab.appendChild(closeX);
    tab.title = 'Click to open · double-click to rename · drag to reorder';

    tab.addEventListener('click', (ev) => {
      if(ev.target === closeX || tabDragJustEnded || tab.dataset.renaming) return;
      const c = canvasOfTab(tab);
      if(c && c.id !== activeCanvasId) fm.switchCanvas(c.id);
    });
    tab.addEventListener('dblclick', (ev) => {
      if(ev.target === closeX || tab.dataset.renaming) return;
      const c = canvasOfTab(tab);
      if(c) startRenameCanvasTab(tab, c, tab.querySelector('.name'));
    });
    onPress(tab, (ev) => {
      if(ev.target === closeX || ev.target.tagName === 'INPUT' || tab.dataset.renaming) return;
      // no text selection on tabs: a selected tab name would turn a drag into a native text drag
      pressDefault(ev);
      if(ev.button !== 0) return;
      // A finger swipes the tab strip along; held still first, it moves the tab (step 9b).
      if(ev.type === 'pointerdown'){
        waitForHold(ev, { onHold: () => { holdBlocksScrolling(); startCanvasTabDrag(ev, tab.dataset.id, tab, true); } });
        return;
      }
      startCanvasTabDrag(ev, tab.dataset.id, tab);
    });
    // A finger's press and hold makes the browser's own menu; the hold moves the tab instead.
    tab.addEventListener('contextmenu', (ev) => { if(isEmulatedMouse(ev)) ev.preventDefault(); });
    tab.addEventListener('dragstart', (ev) => ev.preventDefault());
    closeX.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteCanvasById(tab.dataset.id);
    });
    return tab;
  }

  function renderCanvasTabs(){
    const existing = new Map();
    canvasTabsEl.querySelectorAll('.canvas-tab').forEach(t => existing.set(t.dataset.id, t));
    let cursor = canvasTabsEl.querySelector('.canvas-tab') || btnAddCanvas;
    canvases.forEach(c => {
      let tab = existing.get(c.id);
      if(tab) existing.delete(c.id); else tab = buildCanvasTab(c.id);
      tab.classList.toggle('active', c.id === activeCanvasId);
      if(!tab.dataset.renaming){
        const nameSpan = tab.querySelector('.name');
        if(nameSpan && nameSpan.textContent !== c.name) nameSpan.textContent = c.name;
      }
      if(tab === cursor) cursor = cursor.nextSibling;
      else canvasTabsEl.insertBefore(tab, cursor);
    });
    existing.forEach(t => t.remove());
    if(btnAddCanvas.parentNode === canvasTabsEl && btnAddCanvas.nextSibling && btnAddCanvas.nextSibling.classList && btnAddCanvas.nextSibling.classList.contains('canvas-tab')){
      canvasTabsEl.appendChild(btnAddCanvas);
    }
    refreshTemplateNotices();
  }

  // Drag a canvas tab left/right to reorder canvases: the tab follows the pointer and a
  // marker shows the drop slot; the drop runs fm.moveCanvas (one undo step, recordable).
  let tabDragJustEnded = false;
  // lifted: a finger's hold has already picked the tab up, before it moves.
  function startCanvasTabDrag(downEv, canvasId, tabEl, lifted){
    const startX = downEv.clientX;
    let dragging = false, marker = null, targetPos = null;
    if(lifted) tabEl.classList.add('tab-lifted');
    function computeTarget(clientX){
      const others = Array.from(canvasTabsEl.querySelectorAll('.canvas-tab')).filter(t => t !== tabEl);
      let idx = 0;
      others.forEach(t => { const r = t.getBoundingClientRect(); if(clientX > r.left + r.width / 2) idx++; });
      const hostRect = canvasTabsEl.getBoundingClientRect();
      let x;
      if(idx < others.length) x = others[idx].getBoundingClientRect().left - 2;
      else { const last = others[others.length - 1] || tabEl; x = last.getBoundingClientRect().right + 1; }
      marker.style.left = (x - hostRect.left + canvasTabsEl.scrollLeft) + 'px';
      return idx + 1;
    }
    function onMove(ev){
      const dx = ev.clientX - startX;
      if(!dragging){
        if(Math.abs(dx) < 5) return;
        dragging = true;
        tabEl.classList.add('tab-dragging');
        document.body.classList.add('dragging');
        marker = document.createElement('div');
        marker.className = 'tab-drop-marker';
        canvasTabsEl.appendChild(marker);
      }
      tabEl.style.transform = `translateX(${dx}px)`;
      targetPos = computeTarget(ev.clientX);
    }
    function onUp(ev, cancelled){
      tabEl.classList.remove('tab-lifted');
      if(!dragging) return;
      tabEl.classList.remove('tab-dragging');
      tabEl.style.transform = '';
      document.body.classList.remove('dragging');
      if(marker) marker.remove();
      tabDragJustEnded = true;
      setTimeout(() => { tabDragJustEnded = false; }, 0);
      if(targetPos && !cancelled) guarded(() => fm.moveCanvas(canvasId, targetPos));
    }
    followPointer(downEv, onMove, onUp);
  }

  function startRenameCanvasTab(tab, c, nameSpan){
    if(!nameSpan || tab.dataset.renaming) return;
    tab.dataset.renaming = '1';
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = c.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    function finish(save){
      if(done) return;
      done = true;
      const val = input.value.trim();
      delete tab.dataset.renaming;
      if(input.parentNode) input.replaceWith(nameSpan);
      if(save && val && val !== c.name) guarded(() => fm.renameCanvas(c.id, val));
      else renderCanvasTabs();
    }
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if(ev.key === 'Enter') finish(true);
      if(ev.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('mousedown', (ev) => ev.stopPropagation());
    input.addEventListener('dblclick', (ev) => ev.stopPropagation());
  }

  btnAddCanvas.addEventListener('click', () => fm.addCanvas());
  blockScrollWhileHolding(canvasTabsEl);

  function deleteSelected(){
    if(selectedEdgeId){
      pushHistory();
      edges = edges.filter(e => e.id !== selectedEdgeId);
      selectedEdgeId = null;
    } else if(selectedNodeIds.size){
      pushHistory();
      nodes = nodes.filter(n => !selectedNodeIds.has(n.id));
      edges = edges.filter(e => !selectedNodeIds.has(e.from) && !selectedNodeIds.has(e.to));
      selectedNodeIds.clear();
      trimModelFunctions();
    } else {
      return;
    }
    clearComputed();
    render();
  }

  // ---------- clipboard: copy / cut / paste ----------
  let clipboard = null;       // { nodes:[...], edges:[...], originCanvasId, functions:[...] }
  let clipboardPasteCount = 0;

  function copySelection(){ copyNodeIds(Array.from(selectedNodeIds)); }

  // Copies the given node ids (on the active canvas) plus the edges between them.
  function copyNodeIds(ids){
    if(!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const copied = ids.map(id => getNode(id)).filter(Boolean).map(n => cloneData(n));
    clipboard = {
      nodes: copied,
      edges: edges.filter(e => !e.auto && idSet.has(e.from) && idSet.has(e.to)).map(e => Object.assign({}, e)),
      originCanvasId: activeCanvasId,
      // The definitions its function nodes use (and what those call), so pasting into
      // another document still calculates.
      functions: functionsUsedBy([{ nodes: copied }], modelFunctions)
    };
    clipboardPasteCount = 0;
    updateClipboardButtons();
  }

  function pasteClipboard(){
    if(!clipboard || clipboard.nodes.length === 0) return;
    pushHistory();
    clipboardPasteCount++;
    const offset = clipboardPasteCount * 24;
    // The definitions join the model (and the library); a different version under a number
    // the model already uses comes in renumbered, and the pasted nodes follow.
    const remap = mergeModelFunctions(clipboard.functions);
    const idMap = {};
    const newNodes = remapFunctionNodes(clipboard.nodes, remap).map(n => {
      const newId = uid('n');
      idMap[n.id] = newId;
      return Object.assign(cloneData(n), { id: newId, x: n.x + offset, y: n.y + offset });
    });
    newNodes.forEach(n => {
      if(n.type === 'alias' && n.sourceCanvasId === clipboard.originCanvasId && idMap[n.sourceNodeId] !== undefined){
        n.sourceNodeId = idMap[n.sourceNodeId];
        n.sourceCanvasId = activeCanvasId;
      }
    });
    // The pasted nodes move together to the nearest free space, keeping their layout, so a
    // paste never lands on what is already on the canvas (the original, earlier pastes).
    moveGroupToFreeSpot(newNodes, nodes);
    const newEdges = clipboard.edges.map(e => Object.assign({}, e, { id: uid('e'), from: idMap[e.from], to: idMap[e.to] }));
    nodes = nodes.concat(newNodes);
    edges = edges.concat(newEdges);
    syncAutoConnections();
    clearComputed();
    return newNodes.map(n => n.id);
  }

  function updateClipboardButtons(){ refreshCommandStates(); }

  // Save / Save As / Open shortcuts also work while typing (the edit is committed first),
  // and are kept from the browser's own "Save page" / "Open file" while a dialog is open.
  // Listening on window in the capture phase: text boxes stop their key events bubbling,
  // and a dialog that captures keys itself (e.g. assigning a shortcut) still gets them.
  const DOCUMENT_SHORTCUT_COMMANDS = new Set(['saveDocument', 'saveDocumentAs', 'openDocument']);
  window.addEventListener('keydown', (e) => {
    const editing = document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
    const dialogOpen = !!document.querySelector('.modal-overlay, .launcher-overlay');
    if(!editing && !dialogOpen) return; // the handler below takes it
    const docCmd = shortcutMap[normalizeCombo(e) || ''];
    if(!docCmd || !DOCUMENT_SHORTCUT_COMMANDS.has(docCmd)) return;
    e.preventDefault();
    if(dialogOpen) return;
    e.stopPropagation();
    document.activeElement.blur();
    runCommand(docCmd);
  }, true);
  document.addEventListener('keydown', (e) => {
    const editing = document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
    if(editing) return;
    // dialogs own the keyboard while open (they handle their own Escape/Enter)
    if(document.querySelector('.modal-overlay, .launcher-overlay')) return;

    if(e.key === 'Backspace' && (selectedEdgeId || selectedNodeIds.size)){
      e.preventDefault(); runCommand('deleteSel'); return;
    }

    const combo = normalizeCombo(e);
    if(!combo) return;
    const cmdId = shortcutMap[combo];
    if(!cmdId) return;
    const cmd = COMMANDS.find(c => c.id === cmdId);
    if(!cmd) return;
    e.preventDefault();
    runCommand(cmd.id);
  });

  // Interactive (mouse/Ribbon) versions of the Insert commands: create through the API,
  // then do the UI-only follow-up (select, open the inline editor/picker).
  function addRectangleInteractive(){
    const {x,y} = spawnPoint();
    const id = fm.createRect({ x, y });
    selectNodesOnly([id]);
    startEdit(id, true);
  }
  function addOperatorInteractive(sym){
    const size = operatorSize(sym || '+');
    const {x,y} = spawnPoint(size.w, size.h);
    const id = fm.createOperator(sym ? { x, y, op: sym } : { x, y });
    selectNodesOnly([id]);
    if(!sym) showOpPicker(id);
  }
  function addPeriodShiftInteractive(){
    const {x,y} = spawnPoint(56, 56);
    const id = fm.createPeriodShift({ x, y });
    selectNodesOnly([id]);
  }
  function renderPeriodControls(){ refreshCommandStates(); }

  // Where a new w × h node goes: centred in the view, or the nearest free space to that, so
  // it never lands on another node (findFreeSpot). Default size: a rectangle's.
  function spawnPoint(w, h){
    w = w || 170; h = h || 64;
    const c = viewCentre(); // canvas units, at any zoom (07b)
    const x = Math.max(10, c.x - w/2);
    const y = Math.max(10, c.y - h/2);
    return findFreeSpot(nodes, w, h, x, y);
  }

  // ---------- resizable windows ----------
  // A large window gets a resize corner (bottom right; CSS resize), keeps the size it is
  // dragged to in the UI settings (ui.windowSizes, saved with the workspace, never in a
  // Preferences file: a size belongs to one screen), comes back at that size (never larger
  // than the screen) and goes back to its own size on a double-click on the corner.
  const WINDOW_SIZE_KEYS = ['templates', 'functions', 'formatPresets', 'libraryBrowse', 'libraryPack', 'macroBuilder', 'ribbon', 'periodValues', 'addManyRects'];
  let windowSizes = {};
  let templateGroupsClosed = []; // the Templates window's groups the person closed
  function cleanWindowSizes(v){
    const out = {};
    if(!v || typeof v !== 'object') return out;
    WINDOW_SIZE_KEYS.forEach(k => {
      const s = v[k];
      const w = s && Math.round(Number(s.w)), h = s && Math.round(Number(s.h));
      if(isFinite(w) && isFinite(h) && w >= 200 && h >= 150 && w <= 10000 && h <= 10000) out[k] = { w, h };
    });
    return out;
  }
  function makeResizableWindow(box, key){
    box.classList.add('resizable-window');
    box.dataset.windowKey = key;
    const s = windowSizes[key];
    if(s){
      box.style.width = Math.min(s.w, Math.floor(window.innerWidth * 0.98)) + 'px';
      box.style.height = Math.min(s.h, Math.floor(window.innerHeight * 0.96)) + 'px';
    }
    // Dragging the corner writes the new size into the box's style: remember it.
    let timer = null;
    new MutationObserver(() => {
      const w = Math.round(parseFloat(box.style.width)), h = Math.round(parseFloat(box.style.height));
      if(!(w > 0 && h > 0)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const cur = windowSizes[key];
        if(cur && cur.w === w && cur.h === h) return;
        windowSizes[key] = { w, h };
        saveWorkspaceSoon();
      }, 200);
    }).observe(box, { attributes: true, attributeFilter: ['style'] });
    box.addEventListener('dblclick', (ev) => {
      const r = box.getBoundingClientRect();
      if(ev.clientX < r.right - 20 || ev.clientY < r.bottom - 20) return;
      clearTimeout(timer);
      box.style.width = ''; box.style.height = '';
      delete windowSizes[key];
      saveWorkspaceSoon();
    });
  }

  // ---------- in-page dialogs (native confirm/alert are blocked in many embedded previews) ----------
  // A long message (a recipe's socket check can list dozens of sockets) scrolls inside its
  // window, whose buttons always stay on the visible screen (.message-box, styles.css).
  function showConfirm(message, onConfirm){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box message-box';
    const p = document.createElement('p');
    p.className = 'message-text';
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = 'danger';
    okBtn.textContent = 'OK';
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    box.appendChild(p);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    okBtn.addEventListener('click', () => { close(); onConfirm(); });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  }

  function showMessage(message){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box message-box';
    const p = document.createElement('p');
    p.className = 'message-text';
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const okBtn = document.createElement('button');
    okBtn.className = 'primary';
    okBtn.textContent = 'OK';
    actions.appendChild(okBtn);
    box.appendChild(p);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape' || ev.key === 'Enter') close(); }
    okBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  }

  function clearCanvasInteractive(){
    if(nodes.length === 0 && edges.length === 0) return;
    showConfirm('Remove all rectangles and connections?', () => fm.clearCanvas());
  }

