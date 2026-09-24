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
    nodes = c.nodes; edges = c.edges;
    computedValues = c.computedValues; computeErrors = c.computeErrors;
    portValues = c.portValues || {}; portErrors = c.portErrors || {};
  }

  function snapshot(){
    syncActiveIntoRegistry();
    return JSON.stringify({ canvases, activeCanvasId, nextId, nextCanvasId, periods, currentPeriod });
  }

  function pushHistory(){
    // Inside a transaction (one API action, or a whole macro run) only the first push
    // records a snapshot, so the entire transaction undoes as a single step.
    if(tx.depth > 0){ if(tx.pushed) return; tx.pushed = true; }
    history.push(snapshot());
    if(history.length > MAX_HISTORY) history.shift();
    future = [];
    updateHistoryButtons();
    requestStoragePersistence();
    markDocDirty();
  }

  function restore(snap){
    const data = JSON.parse(snap);
    canvases = data.canvases;
    activeCanvasId = data.activeCanvasId;
    nextId = data.nextId;
    nextCanvasId = data.nextCanvasId;
    periods = Array.isArray(data.periods) && data.periods.length ? data.periods : ['Period 1'];
    currentPeriod = (typeof data.currentPeriod === 'number') ? Math.max(0, Math.min(periods.length - 1, data.currentPeriod)) : 0;
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
    tab.addEventListener('mousedown', (ev) => {
      if(ev.target === closeX || ev.target.tagName === 'INPUT' || tab.dataset.renaming) return;
      // no text selection on tabs: a selected tab name would turn a drag into a native text drag
      ev.preventDefault();
      if(ev.button !== 0) return;
      startCanvasTabDrag(ev, tab.dataset.id, tab);
    });
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
  }

  // Drag a canvas tab left/right to reorder canvases: the tab follows the pointer and a
  // marker shows the drop slot; the drop runs fm.moveCanvas (one undo step, recordable).
  let tabDragJustEnded = false;
  function startCanvasTabDrag(downEv, canvasId, tabEl){
    const startX = downEv.clientX;
    let dragging = false, marker = null, targetPos = null;
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
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if(!dragging) return;
      tabEl.classList.remove('tab-dragging');
      tabEl.style.transform = '';
      document.body.classList.remove('dragging');
      if(marker) marker.remove();
      tabDragJustEnded = true;
      setTimeout(() => { tabDragJustEnded = false; }, 0);
      if(targetPos) guarded(() => fm.moveCanvas(canvasId, targetPos));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
    } else {
      return;
    }
    clearComputed();
    render();
  }

  // ---------- clipboard: copy / cut / paste ----------
  let clipboard = null;       // { nodes:[...], edges:[...], originCanvasId }
  let clipboardPasteCount = 0;

  function copySelection(){ copyNodeIds(Array.from(selectedNodeIds)); }

  // Copies the given node ids (on the active canvas) plus the edges between them.
  function copyNodeIds(ids){
    if(!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    clipboard = {
      nodes: ids.map(id => getNode(id)).filter(Boolean).map(n => Object.assign({}, n)),
      edges: edges.filter(e => !e.auto && idSet.has(e.from) && idSet.has(e.to)).map(e => Object.assign({}, e)),
      originCanvasId: activeCanvasId
    };
    clipboardPasteCount = 0;
    updateClipboardButtons();
  }

  function pasteClipboard(){
    if(!clipboard || clipboard.nodes.length === 0) return;
    pushHistory();
    clipboardPasteCount++;
    const offset = clipboardPasteCount * 24;
    const idMap = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = uid('n');
      idMap[n.id] = newId;
      return Object.assign({}, n, { id: newId, x: n.x + offset, y: n.y + offset });
    });
    newNodes.forEach(n => {
      if(n.type === 'alias' && n.sourceCanvasId === clipboard.originCanvasId && idMap[n.sourceNodeId] !== undefined){
        n.sourceNodeId = idMap[n.sourceNodeId];
        n.sourceCanvasId = activeCanvasId;
      }
    });
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
    const {x,y} = spawnPoint();
    const id = fm.createOperator(sym ? { x, y, op: sym } : { x, y });
    selectNodesOnly([id]);
    if(!sym) showOpPicker(id);
  }
  function addPeriodShiftInteractive(){
    const {x,y} = spawnPoint();
    const id = fm.createPeriodShift({ x, y });
    selectNodesOnly([id]);
  }
  function renderPeriodControls(){ refreshCommandStates(); }

  function spawnPoint(){
    const x = viewport.scrollLeft + viewport.clientWidth/2 - 60 + (nodes.length % 5) * 14;
    const y = viewport.scrollTop + viewport.clientHeight/2 - 30 + (nodes.length % 5) * 14;
    return { x: Math.max(10,x), y: Math.max(10,y) };
  }

  // ---------- in-page dialogs (native confirm/alert are blocked in many embedded previews) ----------
  function showConfirm(message, onConfirm){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    const p = document.createElement('p');
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
    box.className = 'modal-box';
    const p = document.createElement('p');
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

