  // ---------- whole-workspace persistence (system + templates + format presets + shortcuts) ----------
  // The workspace autosaves to the browser's IndexedDB (database 'fmIDE') under this key —
  // the same key and JSON text older versions kept in localStorage, copied across once.
  // build:include shared/store.js
  const WORKSPACE_STORAGE_KEY = 'fmIDE-workspace-v1';
  const workspaceStore = createStore('fmIDE');

  function buildWorkspacePayload(){
    return {
      version: 1, kind: 'fmIDE-workspace',
      system: buildSystemPayload(),
      templates: TEMPLATES.filter(t => !t.builtin).map(t => ({
        id: t.id, name: t.name, description: t.description, group: t.group, kind: t.kind, data: t.data
      })),
      formatPresets: FORMAT_PRESETS.map(p => ({ id: p.id, name: p.name, style: p.style })),
      shortcutBindings: Object.assign({}, shortcutBindings),
      shortcutBindingsVersion: 2,
      macros: cloneData(MACROS),
      ui: buildUiPayload()
    };
  }

  function applyWorkspacePayload(data){
    if(data.system && Array.isArray(data.system.canvases) && data.system.canvases.length){
      applySystemDataDirect(data.system);
    }
    if(Array.isArray(data.templates)){
      data.templates.forEach(t => {
        if(!t || typeof t.name !== 'string' || !t.data) return;
        TEMPLATES.push({
          id: t.id || ('usr' + (nextTemplateId++)), name: t.name, description: t.description || '',
          group: t.group || 'My Templates', kind: t.kind === 'system' ? 'system' : 'module',
          builtin: false, data: t.data
        });
      });
    }
    if(Array.isArray(data.formatPresets)){
      data.formatPresets.forEach(p => {
        if(!p || typeof p.name !== 'string' || !p.style) return;
        FORMAT_PRESETS.push({ id: p.id || ('fmt' + (nextFormatPresetId++)), name: p.name, style: p.style });
      });
    }
    // ribbon/KeyTips settings, then macros (so macro commands exist before their
    // shortcut bindings are applied below); syncMacroCommands re-renders the ribbon
    if(data.ui) applyUiPayload(data.ui);
    if(Array.isArray(data.macros)) importMacros(data.macros, 'replace');
    if(data.ui || Array.isArray(data.macros)) syncMacroCommands();
    if(data.shortcutBindings && typeof data.shortcutBindings === 'object'){
      Object.keys(data.shortcutBindings).forEach(cmdId => {
        if(COMMANDS.some(c => c.id === cmdId)) shortcutBindings[cmdId] = canonicalCombo(data.shortcutBindings[cmdId], !(data.shortcutBindingsVersion >= 2));
      });
      dedupeBindings();
      rebuildShortcutMap();
    }
  }

  // Autosave runs every 8 s, when the page is hidden, and on close. If the browser refuses
  // to store (storage full, or unavailable e.g. in some private-browsing modes) a banner
  // says so ONCE per failure streak — fmIDE keeps working, but nothing done from now on
  // would survive a reload unless exported. It clears itself as soon as a save succeeds.
  // Writes are asynchronous; the browser applies them in the order they were made.
  let autosaveFailing = false, autosaveBannerDismissed = false;
  let workspaceRestored = false; // no autosave before the stored workspace is read: it would overwrite it
  function saveWorkspace(){
    if(!workspaceRestored) return;
    let text;
    try{ text = JSON.stringify(buildWorkspacePayload()); }
    catch(err){ onAutosaveFailed(err); return; }
    workspaceStore.put(WORKSPACE_STORAGE_KEY, text).then(() => {
      if(autosaveFailing){ autosaveFailing = false; autosaveBannerDismissed = false; hideAutosaveBanner(); }
    }, onAutosaveFailed);
  }
  function onAutosaveFailed(err){
    autosaveFailing = true;
    if(!autosaveBannerDismissed) showAutosaveBanner(err);
  }
  // Asks the browser (once, ever) to keep fmIDE's data — called on the first change to the
  // model rather than at start-up, since some browsers show the user a question.
  function requestStoragePersistence(){ workspaceStore.requestPersistence(); }
  function showAutosaveBanner(err){
    if(document.getElementById('autosaveBanner')) return;
    const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    const bar = document.createElement('div');
    bar.id = 'autosaveBanner';
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:2000; max-width:640px; ' +
      'display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#7f1d1d; color:#fff; ' +
      'font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.35);';
    const msg = document.createElement('span');
    msg.textContent = (full ? "Autosave failed: the browser's storage for fmIDE is full." : 'Autosave failed: this browser is not letting fmIDE store data.') +
      ' Changes from now on will be lost on reload unless you export your workspace.';
    const exp = document.createElement('button');
    exp.textContent = 'Export workspace now';
    exp.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:none; background:#fff; color:#7f1d1d; font-weight:700; cursor:pointer;';
    exp.addEventListener('click', () => exportWorkspaceToFile());
    const dis = document.createElement('button');
    dis.textContent = 'Dismiss';
    dis.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.5); background:transparent; color:#fff; cursor:pointer;';
    dis.addEventListener('click', () => { autosaveBannerDismissed = true; hideAutosaveBanner(); });
    bar.append(msg, exp, dis);
    document.body.appendChild(bar);
  }
  function hideAutosaveBanner(){ const b = document.getElementById('autosaveBanner'); if(b) b.remove(); }

  // Resolves true when the autosaved workspace was restored. A workspace left in
  // localStorage by an older fmIDE is copied into IndexedDB first (once).
  function loadWorkspaceFromStore(){
    return workspaceStore.migrateFromLocalStorage(k => k === WORKSPACE_STORAGE_KEY)
      .then(() => workspaceStore.get(WORKSPACE_STORAGE_KEY))
      .then(raw => {
        if(!raw) return false;
        let parsed;
        try{ parsed = JSON.parse(raw); }
        catch(err){ return false; }
        // Same reader as file imports (migrates an older autosave). A newer-format autosave
        // (after going back to an older fmIDE) still loads, best effort — there is no UI yet.
        const r = readFmFile(parsed, ['fmIDE-workspace']);
        if(r.error) return false;
        try{
          applyWorkspacePayload(r.data);
          return true;
        }catch(err){ return false; }
      }, () => false);
  }

  function exportWorkspaceToFile(){
    downloadJSON(buildWorkspacePayload(), `fmIDE-workspace-${timestamp()}.json`);
  }

  function importWorkspaceFromFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['fmIDE-workspace'], (data) => {
      showConfirm('Import this workspace? It will replace your current system, and add in the file\'s templates, format presets, and shortcut bindings. (You can Undo the canvas change afterward if needed.)', () => {
        pushHistory();
        applyWorkspacePayload(data);
        ensureDefaultFormatPresets();
        renderCanvasTabs();
        render();
        saveWorkspace();
        showMessage('Workspace imported.');
      });
      });
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  function showCanvasMergeDecisionModal(collisions, onContinue){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.minWidth = '380px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Some canvases already exist';
    box.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'template-desc';
    desc.textContent = "This import shares canvas names with your current system. For each one, choose whether it's the same dependency (merge — extra content gets added in, references get pointed at your existing canvas) or a separate copy.";
    box.appendChild(desc);

    const decisions = {};
    const rows = document.createElement('div');
    rows.className = 'picker-list';
    collisions.forEach(c => {
      decisions[c.name] = 'merge';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;';
      const label = document.createElement('span');
      label.textContent = c.name;
      label.style.cssText = 'flex:1;font-size:13px;';
      const group = document.createElement('div');
      group.className = 'btngroup';
      const mergeBtn = document.createElement('button');
      mergeBtn.className = 'tbtn seg active-choice';
      mergeBtn.textContent = 'Merge into existing';
      const keepBtn = document.createElement('button');
      keepBtn.className = 'tbtn seg';
      keepBtn.textContent = 'Keep as separate copy';
      mergeBtn.addEventListener('click', () => { decisions[c.name] = 'merge'; mergeBtn.classList.add('active-choice'); keepBtn.classList.remove('active-choice'); });
      keepBtn.addEventListener('click', () => { decisions[c.name] = 'keep'; keepBtn.classList.add('active-choice'); mergeBtn.classList.remove('active-choice'); });
      group.appendChild(mergeBtn);
      group.appendChild(keepBtn);
      row.appendChild(label);
      row.appendChild(group);
      rows.appendChild(row);
    });
    box.appendChild(rows);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel Import';
    cancelBtn.addEventListener('click', close);
    const continueBtn = document.createElement('button');
    continueBtn.className = 'primary';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => { close(); onContinue(decisions); });
    actions.appendChild(cancelBtn);
    actions.appendChild(continueBtn);
    box.appendChild(actions);
  }

  function performAddSystem(data, decisions){
    pushHistory();
    const canvasIdMap = {};
    const nodeIdMap = {};
    const mergeTargets = {};

    data.canvases.forEach((c, idx) => {
      const norm = (c.name || '').trim().toLowerCase();
      const existing = canvases.find(ec => ec.name.trim().toLowerCase() === norm);
      if(existing && decisions[c.name || 'Canvas'] === 'merge'){
        canvasIdMap[c.id] = existing.id;
        mergeTargets[idx] = existing;
      } else {
        canvasIdMap[c.id] = 'c' + (nextCanvasId++);
      }
    });

    const staged = data.canvases.map((c, idx) => {
      const target = mergeTargets[idx];
      const srcNodes = Array.isArray(c.nodes) ? c.nodes : [];
      const srcEdges = Array.isArray(c.edges) ? c.edges : [];
      const localNodeMap = {};
      const nodesToAdd = [];

      function addFresh(n, overrides){
        const newId = uid('n');
        localNodeMap[n.id] = newId;
        nodeIdMap[n.id] = newId;
        nodesToAdd.push(Object.assign({}, n, overrides || {}, { id: newId }));
      }

      if(!target){
        srcNodes.forEach(n => addFresh(n));
        const edgesToAdd = srcEdges
          .filter(e => !e.auto && localNodeMap[e.from] !== undefined && localNodeMap[e.to] !== undefined)
          .map(e => Object.assign({}, e, { id: uid('e'), from: localNodeMap[e.from], to: localNodeMap[e.to] }));
        return { name: (c.name || 'Canvas').toString(), target, nodesToAdd, edgesToAdd, newCanvasId: canvasIdMap[c.id] };
      }

      // Pass 1: value rectangles, matched by name (existing anchors for everything else)
      const existingValueByName = {};
      target.nodes.forEach(n => {
        if(n.type === 'value'){
          const nm = (parseNode(n).name || '').trim().toLowerCase();
          if(nm) existingValueByName[nm] = n.id;
        }
      });
      const structural = []; // operators, aliases, blockInstances — resolved in later passes
      srcNodes.forEach(n => {
        if(n.type === 'value'){
          const nm = (parseNode(n).name || '').trim().toLowerCase();
          if(nm && existingValueByName[nm] !== undefined){
            localNodeMap[n.id] = existingValueByName[nm];
            nodeIdMap[n.id] = existingValueByName[nm];
          } else {
            addFresh(n);
          }
        } else {
          structural.push(n);
        }
      });

      // Pass 2: aliases — identity is their resolved (sourceCanvasId, sourceNodeId); value targets are already resolved
      const existingAliasIndex = {};
      target.nodes.forEach(n => {
        if(n.type === 'alias') existingAliasIndex[n.sourceCanvasId + '::' + n.sourceNodeId] = n.id;
      });
      const remaining = [];
      structural.forEach(n => {
        if(n.type !== 'alias'){ remaining.push(n); return; }
        const rCanvas = canvasIdMap[n.sourceCanvasId] !== undefined ? canvasIdMap[n.sourceCanvasId] : n.sourceCanvasId;
        const rNode = nodeIdMap[n.sourceNodeId] !== undefined ? nodeIdMap[n.sourceNodeId] : n.sourceNodeId;
        const sig = rCanvas + '::' + rNode;
        if(existingAliasIndex[sig] !== undefined){
          localNodeMap[n.id] = existingAliasIndex[sig];
          nodeIdMap[n.id] = existingAliasIndex[sig];
        } else {
          addFresh(n, { sourceCanvasId: rCanvas, sourceNodeId: rNode });
        }
      });

      // Pass 3: operators & block instances — identity is symbol/definition + resolved incoming sources.
      // Iterated to a fixed point since one operator's output can feed another.
      function existingOpSig(exId){ return target.edges.filter(e => e.to === exId).map(e => e.from).sort().join(','); }
      function existingBlockSig(exId, portCount){
        const arr = [];
        for(let i=0;i<portCount;i++){ const e = target.edges.find(e2 => e2.to === exId && e2.toPort === i); arr.push(e ? e.from : ''); }
        return arr.join(',');
      }
      const existingOpIndex = {};
      const existingBlockIndex = {};
      target.nodes.forEach(n => {
        if(n.type === 'operator') existingOpIndex[n.text + '|' + existingOpSig(n.id)] = n.id;
        if(n.type === 'blockInstance'){
          const def = canvases.find(cc => cc.id === n.blockDefCanvasId);
          const portCount = def ? blockPortsOf(def).inputs.length : 0;
          existingBlockIndex[n.blockDefCanvasId + '|' + existingBlockSig(n.id, portCount)] = n.id;
        }
      });

      let pending = remaining;
      let progress = true;
      while(pending.length && progress){
        progress = false;
        const next = [];
        pending.forEach(n => {
          if(n.type === 'operator'){
            const incoming = srcEdges.filter(e => e.to === n.id);
            const resolved = [];
            let ok = true;
            incoming.forEach(e => { if(nodeIdMap[e.from] !== undefined) resolved.push(nodeIdMap[e.from]); else ok = false; });
            if(!ok){ next.push(n); return; }
            const sig = n.text + '|' + resolved.sort().join(',');
            if(existingOpIndex[sig] !== undefined){
              localNodeMap[n.id] = existingOpIndex[sig];
              nodeIdMap[n.id] = existingOpIndex[sig];
            } else {
              addFresh(n);
            }
            progress = true;
          } else if(n.type === 'blockInstance'){
            const rDef = canvasIdMap[n.blockDefCanvasId] !== undefined ? canvasIdMap[n.blockDefCanvasId] : n.blockDefCanvasId;
            const def = canvases.find(cc => cc.id === rDef);
            const portCount = def ? blockPortsOf(def).inputs.length : 0;
            const resolvedPorts = [];
            let ok = true;
            for(let i=0;i<portCount;i++){
              const e = srcEdges.find(e2 => e2.to === n.id && e2.toPort === i);
              if(!e){ resolvedPorts.push(''); continue; }
              if(nodeIdMap[e.from] !== undefined) resolvedPorts.push(nodeIdMap[e.from]); else ok = false;
            }
            if(!ok){ next.push(n); return; }
            const sig = rDef + '|' + resolvedPorts.join(',');
            if(existingBlockIndex[sig] !== undefined){
              localNodeMap[n.id] = existingBlockIndex[sig];
              nodeIdMap[n.id] = existingBlockIndex[sig];
            } else {
              addFresh(n, { blockDefCanvasId: rDef });
            }
            progress = true;
          }
        });
        pending = next;
      }
      // Fallback for anything that couldn't be resolved (shouldn't normally happen): add fresh rather than drop it.
      pending.forEach(n => {
        if(n.type === 'blockInstance'){
          const rDef = canvasIdMap[n.blockDefCanvasId] !== undefined ? canvasIdMap[n.blockDefCanvasId] : n.blockDefCanvasId;
          addFresh(n, { blockDefCanvasId: rDef });
        } else {
          addFresh(n);
        }
      });

      const edgesToAdd = srcEdges
        .filter(e => !e.auto && localNodeMap[e.from] !== undefined && localNodeMap[e.to] !== undefined)
        .map(e => Object.assign({}, e, { id: uid('e'), from: localNodeMap[e.from], to: localNodeMap[e.to] }));

      return { name: (c.name || 'Canvas').toString(), target, nodesToAdd, edgesToAdd, newCanvasId: canvasIdMap[c.id] };
    });

    staged.forEach(s => {
      s.nodesToAdd.forEach(n => {
        if(n.type === 'alias' && n.sourceCanvasId && canvasIdMap[n.sourceCanvasId] !== undefined){
          n.sourceCanvasId = canvasIdMap[n.sourceCanvasId];
          if(nodeIdMap[n.sourceNodeId] !== undefined) n.sourceNodeId = nodeIdMap[n.sourceNodeId];
        }
        if(n.type === 'blockInstance' && n.blockDefCanvasId && canvasIdMap[n.blockDefCanvasId] !== undefined){
          n.blockDefCanvasId = canvasIdMap[n.blockDefCanvasId];
        }
      });
    });

    let firstTouchedCanvasId = null;
    staged.forEach(s => {
      if(s.target){
        const edgeKey = e => e.from + '->' + e.to;
        const existingKeys = new Set(s.target.edges.map(edgeKey));
        const newEdgesFiltered = s.edgesToAdd.filter(e => !existingKeys.has(edgeKey(e)));
        s.target.nodes = s.target.nodes.concat(s.nodesToAdd);
        s.target.edges = s.target.edges.concat(newEdgesFiltered);
        if(firstTouchedCanvasId === null) firstTouchedCanvasId = s.target.id;
      } else {
        canvases.push({
          id: s.newCanvasId, name: s.name,
          nodes: s.nodesToAdd, edges: s.edgesToAdd,
          computedValues: {}, computeErrors: {}, portValues: {}, portErrors: {}
        });
        if(firstTouchedCanvasId === null) firstTouchedCanvasId = s.newCanvasId;
      }
    });

    activeCanvasId = firstTouchedCanvasId || activeCanvasId;
    reconcilePeriodValuesInCanvasList(canvases);
    loadCanvasState(canvases.find(c => c.id === activeCanvasId));
    syncAutoConnections();
    clearSelection();
    renderCanvasTabs();
    evaluateAll();
  }

  function applySystemData(data, mode){
    if(!data || !Array.isArray(data.canvases) || data.canvases.length === 0){
      showMessage('That does not look like an fmIDE system (expected a "canvases" array). Use a Module instead.');
      return;
    }

    if(mode === 'add'){
      const collisions = data.canvases
        .filter(c => canvases.some(ec => ec.name.trim().toLowerCase() === (c.name || '').trim().toLowerCase()))
        .map(c => ({ name: c.name || 'Canvas' }));

      if(collisions.length === 0){
        performAddSystem(data, {});
      } else {
        showCanvasMergeDecisionModal(collisions, (decisions) => performAddSystem(data, decisions));
      }
      return;
    }

    showConfirm('Load this system? It will replace everything currently open — all canvases. (You can Undo afterward if needed.)', () => {
      pushHistory();
      applySystemDataDirect(data);
    });
  }

  // Core of a full system replace, with no confirm/undo bookkeeping — used both by the
  // confirmed "Load System" flow above and by silent boot-time workspace restore.
  function applySystemDataDirect(data){
    let maxId = 0, maxCanvasNum = 0;
    data.canvases.forEach(c => {
      const cm = /(\d+)$/.exec(c.id || ''); if(cm) maxCanvasNum = Math.max(maxCanvasNum, +cm[1]);
      (c.nodes||[]).forEach(n => { const m=/(\d+)$/.exec(n.id||''); if(m) maxId=Math.max(maxId,+m[1]); });
      (c.edges||[]).forEach(e => { const m=/(\d+)$/.exec(e.id||''); if(m) maxId=Math.max(maxId,+m[1]); });
    });
    nextCanvasId = Math.max(nextCanvasId, maxCanvasNum + 1, typeof data.nextCanvasId === 'number' ? data.nextCanvasId : 0);
    canvases = data.canvases.map(c => ({
      id: c.id || ('c' + (nextCanvasId++)),
      name: (c.name || 'Canvas').toString(),
      nodes: Array.isArray(c.nodes) ? c.nodes : [],
      edges: Array.isArray(c.edges) ? c.edges : [],
      computedValues: {}, computeErrors: {}, portValues: {}, portErrors: {}
    }));
    nextId = Math.max(nextId, maxId + 1, typeof data.nextId === 'number' ? data.nextId : 0);
    activeCanvasId = (typeof data.activeCanvasId === 'string' && canvases.some(c => c.id === data.activeCanvasId))
      ? data.activeCanvasId : canvases[0].id;
    periods = Array.isArray(data.periods) && data.periods.length ? data.periods.map(String) : ['Period 1'];
    currentPeriod = (typeof data.currentPeriod === 'number') ? Math.max(0, Math.min(periods.length - 1, data.currentPeriod)) : 0;
    reconcilePeriodValuesInCanvasList(canvases);
    loadCanvasState(canvases.find(c => c.id === activeCanvasId));
    syncAutoConnections();
    clearSelection();
    renderCanvasTabs();
    evaluateAll();
  }

  function loadSystemFromFile(file, mode){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['system'], (data) => applySystemData(data, mode));
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  // Single canvas as a reusable module; loading adds it into the current canvas.
  function saveModuleToFile(){
    const active = canvases.find(c => c.id === activeCanvasId);
    const payload = {
      version: 1, kind: 'module',
      name: active ? active.name : 'Canvas',
      selfCanvasId: activeCanvasId,
      nextId, nodes, edges
    };
    const safeName = (active ? active.name : 'canvas').replace(/[^a-z0-9\-_]+/gi, '_');
    downloadJSON(payload, `fmIDE-module-${safeName}-${timestamp()}.json`);
  }

  function applyModuleData(data){
    if(!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)){
      showMessage('That does not look like an fmIDE module (expected "nodes" and "edges" arrays). Use a System instead.');
      return;
    }
    pushHistory();
    applyModuleDataDirect(data);
  }

  // Core of inserting a module's nodes/edges into whatever canvas is currently active
  // (remapping ids and self-referencing alias/blockInstance nodes) — used both when adding
  // to the current canvas and when adding to a freshly created one. No history/validation.
  function applyModuleDataDirect(data){
    const idMap = {};
    const newNodes = data.nodes.map(n => {
      const newId = uid('n');
      idMap[n.id] = newId;
      return Object.assign({}, n, { id: newId });
    });
    newNodes.forEach(n => {
      if(n.type === 'alias' && n.sourceCanvasId === data.selfCanvasId && idMap[n.sourceNodeId] !== undefined){
        n.sourceNodeId = idMap[n.sourceNodeId];
        n.sourceCanvasId = activeCanvasId;
      }
      if(n.type === 'blockInstance' && n.blockDefCanvasId === data.selfCanvasId){
        n.blockDefCanvasId = activeCanvasId;
      }
    });
    const newEdges = data.edges
      .filter(e => !e.auto && idMap[e.from] !== undefined && idMap[e.to] !== undefined)
      .map(e => Object.assign({}, e, { id: uid('e'), from: idMap[e.from], to: idMap[e.to] }));

    newNodes.forEach(n => { if(Array.isArray(n.periodValues)) n.periodValues = padPeriodValuesArray(n.periodValues, periods.length); });
    nodes = nodes.concat(newNodes);
    edges = edges.concat(newEdges);
    syncAutoConnections();
    clearComputed();
    selectNodesOnly(newNodes.map(n => n.id));
    render();
    evaluateAll();
  }

  // Creates a brand-new canvas and inserts the module template's contents into it,
  // rather than appending onto whatever canvas is currently active.
  function applyModuleDataToNewCanvas(data){
    if(!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)){
      showMessage('That does not look like an fmIDE module (expected "nodes" and "edges" arrays). Use a System instead.');
      return;
    }
    pushHistory();
    const name = (typeof data.name === 'string' && data.name.trim()) ? data.name.trim() : ('Canvas ' + canvases.length);
    const c = {
      id: 'c' + (nextCanvasId++),
      name,
      nodes: [], edges: [], computedValues: {}, computeErrors: {}, portValues: {}, portErrors: {}
    };
    canvases.push(c);
    activeCanvasId = c.id;
    loadCanvasState(c);
    clearSelection();
    applyModuleDataDirect(data);
    renderCanvasTabs();
  }

  function loadModuleFromFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['module'], (data) => applyModuleData(data));
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  fileInputWorkspace.addEventListener('change', () => {
    const file = fileInputWorkspace.files && fileInputWorkspace.files[0];
    fileInputWorkspace.value = '';
    if(file) importWorkspaceFromFile(file);
  });
  let pendingSystemLoadMode = 'replace';
  // File pickers can only be opened by a real user gesture, so Load/Add System, Load
  // Module and Import Workspace stay interactive (they are not available to macros).
  function promptLoadSystem(mode){ pendingSystemLoadMode = mode; fileInputSystem.click(); }
  fileInputSystem.addEventListener('change', () => {
    const file = fileInputSystem.files && fileInputSystem.files[0];
    if(file) loadSystemFromFile(file, pendingSystemLoadMode);
    fileInputSystem.value = '';
  });

  fileInputModule.addEventListener('change', () => {
    const file = fileInputModule.files && fileInputModule.files[0];
    if(file) loadModuleFromFile(file);
    fileInputModule.value = '';
  });


