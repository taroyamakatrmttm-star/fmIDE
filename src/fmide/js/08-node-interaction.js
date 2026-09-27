  // ---------- node interaction ----------
  function attachNodeEvents(el){
    el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); });
    el.addEventListener('mousedown', (ev) => {
      const id = el.dataset.id;
      // The small buttons, and a vertical block's broadcast/indexed toggle: no select or drag
      // (which redraws a block's body and would replace the toggle before its click lands).
      if(ev.target.classList.contains('tag-btn') || ev.target.classList.contains('vindex-toggle')){ ev.stopPropagation(); ev.preventDefault(); return; }
      if(ev.target.classList.contains('io-port')){
        ev.stopPropagation(); ev.preventDefault();
        // A function node's one output has no port number (its arrows carry no fromPort).
        if(ev.target.classList.contains('fn-out-port')) startConnection(id, ev);
        else if(ev.target.dataset.portDir === 'out'){
          startConnection(id, ev, parseInt(ev.target.dataset.portIndex, 10));
        }
        return;
      }
      if(ev.target.classList.contains('port')){ startConnection(id, ev); return; }
      if(ev.target.classList.contains('resize-handle')){ startResize(id, ev); return; }
      if(ev.target.tagName === 'TEXTAREA') return;

      // Right mouse button, anywhere on the node body: draw an arrow, same as
      // dragging from one of the N/S/E/W port dots but without needing to hit
      // the small port hitbox. Works from any node type onto any node type.
      if(ev.button === 2){
        ev.stopPropagation();
        ev.preventDefault();
        startConnection(id, ev);
        return;
      }

      // Alt+drag: spin off an alias of the dragged rectangle(s) instead of moving
      // them. Only plain value rectangles can be aliased (matches the Alias
      // picker's own rule), so alt+dragging anything else — an operator, an
      // existing alias, a block instance, a period-shift node, or a selection
      // that mixes those in — is a no-op: nothing moves, nothing is created.
      // Shift+alt+drag restricts the alias drag to one axis, same convention
      // as plain shift-drag restricting a normal move.
      if(ev.altKey){
        ev.stopPropagation();
        startAliasDragInit(id, ev);
        return;
      }

      if(ev.shiftKey || ev.ctrlKey || ev.metaKey){
        ev.stopPropagation();
        startModifiedInteraction(id, ev);
        return;
      }
      if(!selectedNodeIds.has(id) || selectedEdgeId){
        selectNodesOnly([id]);
      }
      startDrag(id, ev);
    });
    el.addEventListener('click', (ev) => {
      const n = getNode(el.dataset.id);
      if(!n) return;
      if(ev.target.classList.contains('plug-btn')){ showTagEditor(n, 'plug'); }
      if(ev.target.classList.contains('socket-btn')){ showTagEditor(n, 'socket'); }
      if(ev.target.classList.contains('relink-btn')){
        if(n.auto) showMessage("This alias was auto-created by a Plug/Socket match on another canvas. It regenerates automatically — to change it, edit the Plug or Socket name instead.");
        else showAliasPicker(n);
      }
      if(ev.target.classList.contains('io-btn')){ showRolePicker(n); }
      if(ev.target.classList.contains('block-relink')){ showBlockPicker(n); }
      if(ev.target.classList.contains('fn-menu-btn') || ev.target.classList.contains('fn-update-btn')){ showFunctionNodeMenu(n); }
      if(ev.target.classList.contains('vrows-btn')){ showVerticalInstancesViewer(n); }
      if(ev.target.classList.contains('props-btn')){ showPropertiesEditor(n); }
      if(ev.target.classList.contains('period-btn')){ showLiteralPeriodsPicker(n); }
      if(ev.target.classList.contains('curve-btn')){ showPeriodValuesEditor(n); }
      if(ev.target.classList.contains('reducer-chip')){
        const order = REDUCERS;
        const cur = order.includes(n.verticalReducer) ? n.verticalReducer : 'sum';
        guarded(() => fm.setReducer('#' + n.id, order[(order.indexOf(cur) + 1) % order.length]));
      }
      if(ev.target.classList.contains('vindex-toggle')){
        const portIdx = parseInt(ev.target.dataset.portIndex, 10);
        const inEdge = edges.find(e => e.to === n.id && e.toPort === portIdx);
        if(inEdge) guarded(() => fm.setPortMode('#' + n.id, String(portIdx + 1), !inEdge.verticalIndexed));
      }
    });
    el.addEventListener('dblclick', (ev) => {
      if(ev.target.tagName === 'TEXTAREA') return;
      const n = getNode(el.dataset.id);
      if(!n) return;
      if(n.type === 'operator') showOpPicker(n.id);
      else if(n.type === 'periodShift') showShiftPicker(n);
      else if(n.type === 'alias'){
        if(n.auto) showMessage("This alias was auto-created by a Plug/Socket match on another canvas. It regenerates automatically — to change it, edit the Plug or Socket name instead.");
        else showAliasPicker(n);
      }
      else if(n.type === 'blockInstance') showBlockPicker(n);
      else if(n.type === 'function'){ if(!ev.target.classList.contains('tag-btn')) showFunctionDefinition(n); }
      else startEdit(n.id);
    });
  }

  function computeSnap(movingNode, x, y, excludeIds){
    const w = movingNode.w, h = movingNode.h;
    const others = nodes.filter(n => !excludeIds.includes(n.id));
    let bestX = x, bestXDist = SNAP_THRESHOLD, guideX = null;
    let bestY = y, bestYDist = SNAP_THRESHOLD, guideY = null;
    const me = { left:x, right:x+w, centerX:x+w/2 };
    const meY = { top:y, bottom:y+h, centerY:y+h/2 };

    others.forEach(o => {
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
    return { x: Math.max(0,bestX), y: Math.max(0,bestY), guideX, guideY };
  }

  function updateGuides(gx, gy){
    if(gx !== null){ guideV.style.left = gx+'px'; guideV.classList.add('show'); } else guideV.classList.remove('show');
    if(gy !== null){ guideH.style.top = gy+'px'; guideH.classList.add('show'); } else guideH.classList.remove('show');
  }
  function hideGuides(){ guideV.classList.remove('show'); guideH.classList.remove('show'); }

  function startModifiedInteraction(id, downEvent){
    const startX = downEvent.clientX, startY = downEvent.clientY;
    let committed = false;

    function onMove(ev){
      if(committed) return;
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if(dist > 3){
        committed = true;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if(!selectedNodeIds.has(id) || selectedEdgeId){
          selectNodesOnly([id]);
        }
        startDrag(id, downEvent);
      }
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if(!committed) toggleNodeSelection(id);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startDrag(id, downEvent){
    downEvent.preventDefault();
    let workingIds = selectedNodeIds.size ? Array.from(selectedNodeIds) : [id];
    let workingStartPositions = {};
    workingIds.forEach(nid => { const nd = getNode(nid); if(nd) workingStartPositions[nid] = {x:nd.x, y:nd.y}; });
    let workingPrimaryId = id;
    let workingPrimaryStart = workingStartPositions[id] || (() => { const p = getNode(id); return {x:p.x, y:p.y}; })();
    const startX = downEvent.clientX, startY = downEvent.clientY;
    document.body.classList.add('dragging');
    let historyPushed = false;
    let duplicated = false;
    const originalIds = workingIds.slice();
    // references are taken before anything changes (a duplicate would make names ambiguous)
    const originalRefs = recorder.active ? recorder.refsOf(originalIds.map(getNode).filter(Boolean)) : null;

    function onMove(ev){
      if(!historyPushed){ pushHistory(); historyPushed = true; }

      if(!duplicated && (ev.ctrlKey || ev.metaKey)){
        duplicated = true;
        const idMap = {};
        const clones = workingIds.map(nid => {
          const orig = getNode(nid);
          const newId = uid('n');
          idMap[nid] = newId;
          return Object.assign({}, orig, { id: newId });
        });
        const clonedEdges = edges
          .filter(e => !e.auto && idMap[e.from] !== undefined && idMap[e.to] !== undefined)
          .map(e => Object.assign({}, e, { id: uid('e'), from: idMap[e.from], to: idMap[e.to] }));
        nodes = nodes.concat(clones);
        edges = edges.concat(clonedEdges);

        const newStart = {};
        workingIds.forEach(oldId => { newStart[idMap[oldId]] = { x: workingStartPositions[oldId].x, y: workingStartPositions[oldId].y }; });
        workingIds = workingIds.map(oldId => idMap[oldId]);
        workingStartPositions = newStart;
        workingPrimaryId = idMap[workingPrimaryId];
        workingPrimaryStart = newStart[workingPrimaryId];
        selectedNodeIds = new Set(workingIds);
      }

      let dx = ev.clientX - startX, dy = ev.clientY - startY;
      if(ev.shiftKey){
        if(Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
      }
      const tentX = Math.max(0, workingPrimaryStart.x + dx);
      const tentY = Math.max(0, workingPrimaryStart.y + dy);
      const workingPrimaryNode = getNode(workingPrimaryId);
      const snap = computeSnap(workingPrimaryNode, tentX, tentY, workingIds);
      const appliedDX = snap.x - workingPrimaryStart.x;
      const appliedDY = snap.y - workingPrimaryStart.y;
      workingIds.forEach(nid => {
        const nd = getNode(nid), sp = workingStartPositions[nid];
        if(!nd || !sp) return;
        nd.x = Math.max(0, sp.x + appliedDX);
        nd.y = Math.max(0, sp.y + appliedDY);
      });
      updateGuides(snap.guideX, snap.guideY);
      render();
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('dragging');
      hideGuides();
      if(duplicated){ syncAutoConnections(); clearComputed(); render(); }
      if(historyPushed && recorder.active){
        const pn = getNode(workingPrimaryId);
        const dx = pn ? pn.x - workingPrimaryStart.x : 0, dy = pn ? pn.y - workingPrimaryStart.y : 0;
        if(duplicated && originalRefs) recorder.push('duplicate', { nodes: originalRefs, dx, dy }, workingIds.slice());
        else if(dx || dy) recorder.add('move', { nodes: workingIds.map(getNode).filter(Boolean), dx, dy });
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Alt+drag: gatekeeper. Resolves which nodes would be dragged (mirrors the
  // "click an unselected node -> select just it" rule startDrag itself uses),
  // and refuses to do anything at all — no selection change, no drag, no
  // alias — unless every one of them is a plain value rectangle.
  function startAliasDragInit(id, downEvent){
    const prospectiveIds = (selectedNodeIds.has(id) && !selectedEdgeId) ? Array.from(selectedNodeIds) : [id];
    const allRects = prospectiveIds.length > 0 && prospectiveIds.every(nid => { const nd = getNode(nid); return nd && nd.type === 'value'; });
    if(!allRects){ downEvent.preventDefault(); return; }
    if(!selectedNodeIds.has(id) || selectedEdgeId){
      selectNodesOnly([id]);
    }
    startAliasDrag(prospectiveIds, downEvent);
  }

  // Creates one alias per source rectangle (sourceCanvasId is always the active
  // canvas, since we're dragging nodes that live on it) the first time the mouse
  // actually moves, then drags those new alias nodes — snap-to-align and all —
  // exactly like a normal node drag, leaving the source rectangles untouched.
  // A plain alt+click with no movement creates nothing.
  function startAliasDrag(sourceIds, downEvent){
    downEvent.preventDefault();
    const sourceNodes = sourceIds.map(getNode).filter(Boolean);
    if(sourceNodes.length === 0) return;
    const startX = downEvent.clientX, startY = downEvent.clientY;
    let created = false;
    let historyPushed = false;
    let aliasIds = [];
    let aliasStartPositions = {};
    let primaryId = null;

    function createAliases(){
      if(!historyPushed){ pushHistory(); historyPushed = true; }
      const newNodes = sourceNodes.map(sn => ({
        id: uid('n'), type:'alias', x: sn.x, y: sn.y, w: sn.w, h: sn.h,
        sourceCanvasId: activeCanvasId, sourceNodeId: sn.id, plugs:[]
      }));
      nodes = nodes.concat(newNodes);
      aliasIds = newNodes.map(n => n.id);
      newNodes.forEach(n => { aliasStartPositions[n.id] = { x:n.x, y:n.y }; });
      primaryId = aliasIds[0];
      selectNodesOnly(aliasIds);
      created = true;
    }

    function onMove(ev){
      if(!created) createAliases();
      let dx = ev.clientX - startX, dy = ev.clientY - startY;
      if(ev.shiftKey){
        if(Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
      }
      const primaryStart = aliasStartPositions[primaryId];
      const primaryNode = getNode(primaryId);
      const tentX = Math.max(0, primaryStart.x + dx);
      const tentY = Math.max(0, primaryStart.y + dy);
      const snap = computeSnap(primaryNode, tentX, tentY, aliasIds);
      const appliedDX = snap.x - primaryStart.x;
      const appliedDY = snap.y - primaryStart.y;
      aliasIds.forEach(nid => {
        const nd = getNode(nid), sp = aliasStartPositions[nid];
        if(!nd || !sp) return;
        nd.x = Math.max(0, sp.x + appliedDX);
        nd.y = Math.max(0, sp.y + appliedDY);
      });
      updateGuides(snap.guideX, snap.guideY);
      render();
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('dragging');
      hideGuides();
      if(created){
        clearComputed(); render(); evaluateAll();
        if(recorder.active){
          const pn = getNode(primaryId), ps = aliasStartPositions[primaryId];
          recorder.add('aliasOf', { nodes: sourceNodes.filter(n => nodes.includes(n)), dx: pn.x - ps.x, dy: pn.y - ps.y }, aliasIds.slice());
        }
      }
    }
    document.body.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(id, downEvent){
    downEvent.preventDefault();
    downEvent.stopPropagation();
    selectNodesOnly([id]);
    const n = getNode(id);
    const startX = downEvent.clientX, startY = downEvent.clientY;
    const origW = n.w, origH = n.h;
    document.body.classList.add('dragging');
    let historyPushed = false;

    function onMove(ev){
      if(!historyPushed){ pushHistory(); historyPushed = true; }
      n.w = Math.max(80, origW + (ev.clientX - startX));
      n.h = Math.max(44, origH + (ev.clientY - startY));
      render();
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('dragging');
      if(historyPushed && recorder.active) recorder.add('resize', { node: n, w: n.w, h: n.h });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startEdit(id, selectAll){
    const n = getNode(id);
    const el = canvas.querySelector(`.node[data-id="${id}"]`);
    if(!el) return;
    const lbl = el.querySelector('.label');
    if(!lbl) return;
    const ta = document.createElement('textarea');
    ta.value = n.text;
    ta.title = 'Line 1: name · Line 2: value · Line 3: unit of measure, e.g. "kt" or "$/t" (optional). Shift+Enter for a new line.';
    lbl.replaceWith(ta);
    ta.focus();
    if(selectAll) ta.select();

    function commit(){
      const newText = ta.value.trim() || 'Untitled';
      const newLbl = document.createElement('div');
      newLbl.className = 'label';
      newLbl.innerHTML = '<div class="line-name"></div><div class="line-value"></div><div class="line-uom"></div>';
      if(ta.parentNode) ta.replaceWith(newLbl);
      if(newText !== n.text && nodes.includes(n)) guarded(() => fm.setText('#' + n.id, newText));
      clearComputed();
      render();
    }
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); ta.blur(); }
      if(ev.key === 'Escape'){ ta.value = n.text; ta.blur(); }
    });
  }

  function closePicker(){ if(activePicker){ activePicker.remove(); activePicker = null; } }

  function showOpPicker(id){
    closePicker();
    const n = getNode(id);
    const el = canvas.querySelector(`.node[data-id="${id}"]`);
    if(!n || !el) return;

    const picker = document.createElement('div');
    picker.className = 'op-picker';
    picker.style.left = n.x + 'px';
    picker.style.top = (n.y + n.h + 8) + 'px';
    OPS.forEach(sym => {
      const b = document.createElement('button');
      b.textContent = sym;
      b.addEventListener('mousedown', (ev) => ev.stopPropagation());
      b.addEventListener('click', () => {
        closePicker();
        guarded(() => fm.setOperator('#' + n.id, sym));
      });
      picker.appendChild(b);
    });
    canvas.appendChild(picker);
    activePicker = picker;

    setTimeout(() => {
      document.addEventListener('mousedown', function onDoc(ev){
        if(!picker.contains(ev.target)){ closePicker(); document.removeEventListener('mousedown', onDoc); }
      });
    }, 0);
  }

  function showShiftPicker(node){
    closePicker();
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if(!el) return;

    const picker = document.createElement('div');
    picker.className = 'op-picker';
    picker.style.left = node.x + 'px';
    picker.style.top = (node.y + node.h + 8) + 'px';

    [-2,-1,1,2].forEach(off => {
      const b = document.createElement('button');
      b.textContent = shiftLabel(off);
      b.addEventListener('mousedown', ev => ev.stopPropagation());
      b.addEventListener('click', () => {
        closePicker();
        guarded(() => fm.setShift('#' + node.id, off));
      });
      picker.appendChild(b);
    });

    const customWrap = document.createElement('div');
    customWrap.style.display = 'flex';
    customWrap.style.gap = '4px';
    customWrap.style.width = '100%';
    customWrap.style.marginTop = '4px';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.value = (typeof node.shift === 'number') ? node.shift : -1;
    input.style.width = '64px';
    input.style.padding = '4px 6px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid #374151';
    input.style.background = '#1f2937';
    input.style.color = '#f3f4f6';
    input.addEventListener('mousedown', ev => ev.stopPropagation());
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if(ev.key === 'Enter') applyCustom();
    });
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Set';
    okBtn.addEventListener('mousedown', ev => ev.stopPropagation());
    okBtn.addEventListener('click', applyCustom);
    function applyCustom(){
      const v = parseInt(input.value, 10);
      if(!Number.isFinite(v)) return;
      closePicker();
      guarded(() => fm.setShift('#' + node.id, v));
    }
    customWrap.appendChild(input);
    customWrap.appendChild(okBtn);
    picker.appendChild(customWrap);

    canvas.appendChild(picker);
    activePicker = picker;

    setTimeout(() => {
      document.addEventListener('mousedown', function onDoc(ev){
        if(!picker.contains(ev.target)){ closePicker(); document.removeEventListener('mousedown', onDoc); }
      });
    }, 0);
  }

  function showPeriodsManager(){
    closePicker();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.minWidth = '360px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    const title = document.createElement('p');
    title.textContent = 'Periods';
    box.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'template-desc';
    desc.textContent = 'Periods form a shared timeline across every canvas. Period-shift connectors read values across them. New periods are added at the end; only the last one can be removed, so existing references never shift.';
    box.appendChild(desc);

    const list = document.createElement('div');
    list.className = 'picker-list';
    box.appendChild(list);

    let delBtn;
    function renderList(){
      list.innerHTML = '';
      periods.forEach((label, i) => {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.gap = '6px'; row.style.alignItems = 'center';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = label;
        input.style.flex = '1'; input.style.fontSize = '13px'; input.style.padding = '6px 8px';
        input.style.borderRadius = '6px'; input.style.border = '1px solid #d1d5db';
        input.addEventListener('change', () => {
          const v = input.value.trim() || ('Period ' + (i + 1));
          if(v !== periods[i]) guarded(() => fm.renamePeriod(i + 1, v));
        });
        row.appendChild(input);
        const idxTag = document.createElement('span');
        idxTag.textContent = (i + 1) + (i === currentPeriod ? ' · viewing' : '');
        idxTag.style.fontSize = '11px'; idxTag.style.color = '#6b7280'; idxTag.style.minWidth = '64px';
        row.appendChild(idxTag);
        list.appendChild(row);
      });
      if(delBtn) delBtn.disabled = periods.length <= 1;
    }

    const countRow = document.createElement('div');
    countRow.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:4px;';
    const countLabel = document.createElement('label');
    countLabel.textContent = 'Number of periods';
    countLabel.style.cssText = 'font-size:12px; color:#374151;';
    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.style.cssText = 'width:70px; font-size:13px; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db;';
    countInput.value = periods.length;
    const setBtn = document.createElement('button');
    setBtn.className = 'tbtn primary';
    setBtn.textContent = 'Set';
    countRow.appendChild(countLabel);
    countRow.appendChild(countInput);
    countRow.appendChild(setBtn);
    box.appendChild(countRow);
    const countHint = document.createElement('p');
    countHint.className = 'template-desc';
    countHint.style.marginTop = '6px';
    countHint.textContent = 'Growing adds new periods at the end (named "Period N"); shrinking removes from the end. Rectangles with values drawn per-period hold their last value flat into any new periods.';
    box.appendChild(countHint);

    function applyCount(){
      const target = Math.max(1, Math.round(Number(countInput.value)) || periods.length);
      if(target === periods.length){ countInput.value = periods.length; return; }
      guarded(() => fm.setPeriodCount(target));
      renderList();
      countInput.value = periods.length;
    }
    setBtn.addEventListener('click', applyCount);
    countInput.addEventListener('keydown', (ev) => { if(ev.key === 'Enter'){ ev.preventDefault(); applyCount(); } });
    renderList();

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '14px';
    const doneBtn = document.createElement('button');
    doneBtn.className = 'primary';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', close);
    actions.appendChild(doneBtn);
    box.appendChild(actions);
  }

  function showLiteralPeriodsPicker(node){
    closePicker();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.minWidth = '300px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    const title = document.createElement('p');
    title.textContent = "Which periods use this rectangle's own number?";
    box.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'template-desc';
    desc.textContent = "Uncheck a period to leave this rectangle blank there instead, so it picks up whatever feeds into it — e.g. a period-shift connector carrying the prior period's ending balance forward.";
    box.appendChild(desc);

    const list = document.createElement('div');
    list.className = 'picker-list';
    const checks = periods.map((label, i) => {
      const row = document.createElement('label');
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
      row.style.fontSize = '13px'; row.style.cursor = 'pointer';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !Array.isArray(node.literalPeriods) || node.literalPeriods.includes(i);
      row.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = label;
      row.appendChild(span);
      list.appendChild(row);
      return cb;
    });
    box.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const allBtn = document.createElement('button');
    allBtn.textContent = 'All periods';
    allBtn.addEventListener('click', () => checks.forEach(cb => cb.checked = true));
    const firstBtn = document.createElement('button');
    firstBtn.textContent = 'First period only';
    firstBtn.addEventListener('click', () => checks.forEach((cb,i) => cb.checked = (i === 0)));
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const chosen = checks.map((cb,i) => cb.checked ? i + 1 : null).filter(i => i !== null);
      close();
      guarded(() => fm.setLiteralPeriods('#' + node.id, chosen.length === periods.length ? 'all' : chosen.join(',')));
    });
    actions.appendChild(allBtn);
    actions.appendChild(firstBtn);
    actions.appendChild(saveBtn);
    box.appendChild(actions);
  }

