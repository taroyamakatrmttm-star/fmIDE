  // ---------- plug / socket ----------
  // plugsOf (a rectangle's plug names) and plugLinks (which links plugs make) are shared
  // (src/shared/ir.js): the calculation works the links out itself from the names, and the
  // automatic aliases and arrows drawn here are exactly those links.
  function syncAutoConnections(){
    syncActiveIntoRegistry();
    invalidateIR();

    // wipe everything auto-generated from a previous sync, everywhere
    canvases.forEach(c => {
      const autoAliasIds = new Set(c.nodes.filter(n => n.type === 'alias' && n.auto).map(n => n.id));
      c.nodes = c.nodes.filter(n => !(n.type === 'alias' && n.auto));
      c.edges = c.edges.filter(e => !e.auto && !autoAliasIds.has(e.from) && !autoAliasIds.has(e.to));
    });

    // each plugged rectangle is connected at most once to each socket: an arrow on the same
    // canvas, an alias from another canvas
    const links = plugLinks(canvases);
    canvases.forEach((c, ci) => links[ci].forEach(l => {
      if(!l.alias){
        c.edges.push({ id: uid('e'), from: l.from, to: l.to, auto: true });
        return;
      }
      const aliasId = uid('n');
      c.nodes.push({
        id: aliasId, type: 'alias', auto: true,
        x: l.alias.x, y: l.alias.y,
        w: 170, h: 64,
        sourceCanvasId: l.alias.sourceCanvasId, sourceNodeId: l.alias.sourceNodeId, plugs: []
      });
      c.edges.push({ id: uid('e'), from: aliasId, to: l.to, auto: true });
    }));

    loadCanvasState(canvases.find(cc => cc.id === activeCanvasId));
  }

  // Sockets nothing feeds: operators whose socket name matches no plug on any of `list`'s
  // canvases ({ name, nodes }), by the same rule as syncAutoConnections (trimmed, any
  // capitals). Returns [{ canvas, socket }], each socket once per canvas.
  function unfedSocketsIn(list){
    const plugged = new Set();
    list.forEach(c => (c.nodes || []).forEach(n => { if(n && n.type === 'value') plugsOf(n).forEach(p => plugged.add(p.toLowerCase())); }));
    const out = [], seen = new Set();
    list.forEach(c => (c.nodes || []).forEach(n => {
      if(!n || n.type !== 'operator' || typeof n.socket !== 'string' || !n.socket.trim()) return;
      const k = n.socket.trim().toLowerCase(), key = c.name + '\u0000' + k;
      if(plugged.has(k) || seen.has(key)) return;
      seen.add(key);
      out.push({ canvas: c.name, socket: n.socket.trim() });
    }));
    return out;
  }

  // Every plug name (lower case) → the rectangles carrying it, as "Canvas::Name", across
  // `list`'s canvases ({ name, nodes }).
  function plugSourcesIn(list){
    const map = new Map();
    list.forEach(c => (c.nodes || []).forEach(n => {
      if(!n || n.type !== 'value') return;
      plugsOf(n).forEach(p => {
        const k = p.toLowerCase();
        if(!map.has(k)) map.set(k, []);
        map.get(k).push((c.name || 'Canvas') + '::' + ((parseNode(n).name || '').trim() || '(unnamed)'));
      });
    }));
    return map;
  }
  // Sockets fed by more than one plug: their values are added together, which can double a
  // number by accident (the same template added twice). Returns [{ canvas, socket, sources }],
  // each socket once per canvas.
  function multiFedSocketsIn(list){
    const sources = plugSourcesIn(list);
    const out = [], seen = new Set();
    list.forEach(c => (c.nodes || []).forEach(n => {
      if(!n || n.type !== 'operator' || typeof n.socket !== 'string' || !n.socket.trim()) return;
      const k = n.socket.trim().toLowerCase(), key = c.name + '\u0000' + k;
      const from = sources.get(k) || [];
      if(from.length < 2 || seen.has(key)) return;
      seen.add(key);
      out.push({ canvas: c.name, socket: n.socket.trim(), sources: from.slice() });
    }));
    return out;
  }
  function multiFedSocketsText(list){
    return 'Sockets fed by more than one plug (their values are added): '
      + list.map(m => `“${m.socket}” (${m.canvas}) ← ${m.sources.join(', ')}`).join('; ') + '.';
  }
  // The canvases as they are now ({ name, nodes }), the one on screen included.
  function liveCanvasList(){
    return canvases.map(c => ({ name: c.name, nodes: c.id === activeCanvasId ? nodes : c.nodes }));
  }

  function collectAllTagNames(){
    const values = new Set();
    canvases.forEach(c => {
      const pool = c.id === activeCanvasId ? nodes : c.nodes;
      pool.forEach(n => {
        if(n.type === 'value') plugsOf(n).forEach(p => values.add(p));
        if(n.type === 'operator' && n.socket && n.socket.trim() !== '') values.add(n.socket.trim());
      });
    });
    return Array.from(values).sort((a,b) => a.localeCompare(b));
  }

  function tagNameDatalist(){
    const datalist = document.createElement('datalist');
    datalist.id = 'tagNameOptions';
    collectAllTagNames().forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      datalist.appendChild(o);
    });
    return datalist;
  }

  // A rectangle's plugs: one chip per name (✕ removes it) and a field that adds another.
  // Each add or remove is its own undo step; a name typed but not yet added is added when
  // the popup closes by a click elsewhere (Escape drops it).
  function showPlugEditor(node){
    closePicker();
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if(!el) return;

    const popup = document.createElement('div');
    popup.className = 'tag-popup plug-editor';
    popup.style.left = node.x + 'px';
    popup.style.top = Math.max(0, node.y - 46) + 'px';

    const list = document.createElement('div');
    list.className = 'plug-list';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add a plug name (e.g. Revenue)';
    input.setAttribute('list', 'tagNameOptions');
    input.setAttribute('autocomplete', 'off');

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear all';

    function refreshList(){
      list.textContent = '';
      const names = plugsOf(getNode(node.id) || node);
      names.forEach(name => {
        const chip = document.createElement('span');
        chip.className = 'plug-item';
        const txt = document.createElement('span');
        txt.textContent = '🔌 ' + name;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'plug-remove';
        rm.textContent = '✕';
        rm.title = 'Remove this plug';
        rm.addEventListener('mousedown', (ev) => ev.stopPropagation());
        rm.addEventListener('click', () => { guarded(() => fm.removePlug(node.id, name)); render(); refreshList(); input.focus(); });
        chip.appendChild(txt);
        chip.appendChild(rm);
        list.appendChild(chip);
      });
      list.style.display = names.length ? 'flex' : 'none';
      clearBtn.style.display = names.length ? '' : 'none';
    }
    function addTyped(){
      const v = input.value.trim();
      if(!v) return;
      guarded(() => fm.addPlug(node.id, v));
      input.value = '';
      render();
      refreshList();
    }

    const row = document.createElement('div');
    row.className = 'plug-add-row';
    row.appendChild(input);
    row.appendChild(addBtn);
    row.appendChild(clearBtn);
    popup.appendChild(list);
    popup.appendChild(row);
    popup.appendChild(tagNameDatalist());
    canvas.appendChild(popup);
    activePicker = popup;
    refreshList();
    input.focus();

    let docListener = null;
    function finish(commit){
      if(docListener) document.removeEventListener('mousedown', docListener);
      if(commit) addTyped();
      closePicker();
      render();
    }
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if(ev.key === 'Enter'){ if(input.value.trim()) addTyped(); else finish(false); }
      if(ev.key === 'Escape'){ finish(false); }
    });
    [addBtn, clearBtn].forEach(b => b.addEventListener('mousedown', (ev) => ev.stopPropagation()));
    addBtn.addEventListener('click', () => { addTyped(); input.focus(); });
    clearBtn.addEventListener('click', () => { input.value = ''; guarded(() => fm.setPlugs(node.id, [])); finish(false); });

    setTimeout(() => {
      docListener = (ev) => { if(!popup.contains(ev.target)) finish(true); };
      document.addEventListener('mousedown', docListener);
    }, 0);
  }

  function showTagEditor(node, kind){
    if(kind === 'plug'){ showPlugEditor(node); return; }
    closePicker();
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if(!el) return;

    const popup = document.createElement('div');
    popup.className = 'tag-popup';
    popup.style.left = node.x + 'px';
    popup.style.top = Math.max(0, node.y - 46) + 'px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Socket name (e.g. Revenue)';
    input.value = node.socket || '';
    input.setAttribute('list', 'tagNameOptions');
    input.setAttribute('autocomplete', 'off');

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';

    popup.appendChild(input);
    popup.appendChild(tagNameDatalist());
    popup.appendChild(clearBtn);
    canvas.appendChild(popup);
    activePicker = popup;
    input.focus();
    input.select();

    let docListener = null;
    function finish(commit){
      if(docListener) document.removeEventListener('mousedown', docListener);
      if(commit){
        const trimmed = input.value.trim();
        if(trimmed !== (node.socket || '')) guarded(() => fm.setSocket(node.id, trimmed));
      }
      closePicker();
      render();
    }
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if(ev.key === 'Enter'){ finish(true); }
      if(ev.key === 'Escape'){ finish(false); }
    });
    clearBtn.addEventListener('mousedown', (ev) => ev.stopPropagation());
    clearBtn.addEventListener('click', () => { input.value = ''; finish(true); });

    setTimeout(() => {
      docListener = (ev) => { if(!popup.contains(ev.target)) finish(true); };
      document.addEventListener('mousedown', docListener);
    }, 0);
  }

  function showRolePicker(node){
    closePicker();
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if(!el) return;

    const picker = document.createElement('div');
    picker.className = 'op-picker';
    picker.style.left = node.x + 'px';
    picker.style.top = (node.y + node.h + 8) + 'px';

    const options = [
      { label: 'None', value: null },
      { label: 'Input', value: 'input' },
      { label: 'Output', value: 'output' },
      { label: 'Vertical Index', value: 'index' }
    ];
    options.forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.addEventListener('mousedown', (ev) => ev.stopPropagation());
      b.addEventListener('click', () => {
        closePicker();
        guarded(() => fm.setRole(node.id, opt.value || 'none'));
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

  function showAliasPicker(existingNode){
    syncActiveIntoRegistry();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box alias-picker-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    function finish(canvasId, nodeId){
      close();
      guarded(() => {
        if(existingNode){
          fm.relinkAlias(existingNode.id, '#' + nodeId, canvasId);
        } else {
          const {x, y} = spawnPoint();
          const id = fm.createAlias({ x, y, source: '#' + nodeId, sourceCanvas: canvasId });
          selectNodesOnly([id]);
        }
      });
    }

    function renderRectStep(canvasObj){
      box.innerHTML = '';
      const title = document.createElement('p');
      title.textContent = `Choose a rectangle in "${canvasObj.name}":`;
      box.appendChild(title);

      const list = document.createElement('div');
      list.className = 'picker-list';
      const pool = canvasObj.id === activeCanvasId ? nodes : canvasObj.nodes;
      const sourceNodes = pool.filter(n => n.type === 'value' && n !== existingNode);
      if(sourceNodes.length === 0){
        const empty = document.createElement('p');
        empty.textContent = 'This canvas has no plain rectangles to link to yet.';
        empty.style.cssText = 'color:#6b7280;font-size:13px;margin:0 0 10px;';
        list.appendChild(empty);
      }
      sourceNodes.forEach(sn => {
        const row = document.createElement('button');
        row.className = 'picker-row';
        row.textContent = parseNode(sn).name || '(unnamed rectangle)';
        row.addEventListener('click', () => finish(canvasObj.id, sn.id));
        list.appendChild(row);
      });
      box.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', renderCanvasStep);
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', close);
      actions.appendChild(backBtn);
      actions.appendChild(cancelBtn);
      box.appendChild(actions);
    }

    function renderCanvasStep(){
      box.innerHTML = '';
      const title = document.createElement('p');
      title.textContent = existingNode ? 'Relink: choose a canvas' : 'Add alias: choose a canvas';
      box.appendChild(title);

      const list = document.createElement('div');
      list.className = 'picker-list';
      canvases.forEach(c => {
        const row = document.createElement('button');
        row.className = 'picker-row';
        row.textContent = c.name + (c.id === activeCanvasId ? '  (this canvas)' : '');
        row.addEventListener('click', () => renderRectStep(c));
        list.appendChild(row);
      });
      box.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', close);
      actions.appendChild(cancelBtn);
      box.appendChild(actions);
    }

    renderCanvasStep();
  }

  function showBlockPicker(existingInstance){
    syncActiveIntoRegistry();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box alias-picker-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = existingInstance ? 'Relink: choose a Block' : 'Choose a Block to insert';
    box.appendChild(title);

    const vertRow = document.createElement('label');
    vertRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;margin:2px 0 12px;cursor:pointer;color:#334155;';
    const vertCb = document.createElement('input');
    vertCb.type = 'checkbox';
    vertCb.checked = !!(existingInstance && existingInstance.vertical);
    const vertText = document.createElement('span');
    vertText.textContent = 'Vertical — run one instance per period, then reduce them into a single output (see each Output rectangle\'s Σ chip for how)';
    vertRow.appendChild(vertCb);
    vertRow.appendChild(vertText);
    box.appendChild(vertRow);
    if(existingInstance){
      const hint = document.createElement('p');
      hint.style.cssText = 'color:#6b7280;font-size:12px;margin:-6px 0 10px;';
      hint.textContent = 'Pick a Block below to apply this checkbox (choose the same one again if you only want to change this setting).';
      box.appendChild(hint);
    }

    const list = document.createElement('div');
    list.className = 'picker-list';
    const withOutputs = canvases.map(c => ({ c, ports: blockPortsOf(c) })).filter(x => x.ports.outputs.length > 0);

    if(withOutputs.length === 0){
      const empty = document.createElement('p');
      empty.textContent = "No canvas has an Output rectangle yet. Mark a rectangle's ⇄ role as Output on the canvas you want to publish as a Block.";
      empty.style.cssText = 'color:#6b7280;font-size:13px;margin:0 0 10px;';
      list.appendChild(empty);
    }
    withOutputs.forEach(({c, ports}) => {
      const row = document.createElement('button');
      row.className = 'picker-row';
      row.innerHTML = '';
      const main = document.createElement('span');
      main.textContent = c.name + (c.id === activeCanvasId ? '  (this canvas)' : '');
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = `${ports.inputs.length} input${ports.inputs.length===1?'':'s'} · ${ports.outputs.length} output${ports.outputs.length===1?'':'s'}`;
      row.appendChild(main);
      row.appendChild(sub);
      row.addEventListener('click', () => {
        close();
        guarded(() => {
          if(existingInstance){
            fm.batch(() => {
              fm.relinkBlock(existingInstance.id, c.id);
              fm.setVertical(existingInstance.id, vertCb.checked);
            });
          } else {
            const {x, y} = spawnPoint();
            const id = fm.createBlock({ x, y, block: c.id, vertical: vertCb.checked });
            selectNodesOnly([id]);
          }
        });
      });
      list.appendChild(row);
    });
    box.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    actions.appendChild(cancelBtn);
    box.appendChild(actions);
  }

  // Read-only table of a Vertical Block instance's individual, pre-reduction rows — one row
  // per instance (the same numbers a spreadsheet vintage table like Depreciation_0…_9 would
  // show), plus the already-visible combined Total row underneath for reference. Data comes
  // straight from c.periodPortInstances, filled in by evaluateAll(); this never recomputes
  // anything itself.
  function showVerticalInstancesViewer(instanceNode){
    syncActiveIntoRegistry();
    const def = canvases.find(c => c.id === instanceNode.blockDefCanvasId);
    const { outputs } = blockPortsOf(def);
    const c = canvases.find(cc => cc.id === activeCanvasId);
    const N = periods.length;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box alias-picker-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = (def ? def.name : '(missing block)') + ' — each instance’s own row';
    box.appendChild(title);

    if(outputs.length === 0){
      const empty = document.createElement('p');
      empty.textContent = 'This block has no Output rectangle yet.';
      empty.style.cssText = 'color:#6b7280;font-size:13px;margin:0 0 10px;';
      box.appendChild(empty);
    }

    outputs.forEach((outNode, outIdx) => {
      const sub = document.createElement('p');
      sub.style.cssText = 'font-weight:600;margin:10px 0 4px;';
      sub.textContent = parseNode(outNode).name || ('Output ' + (outIdx + 1));
      box.appendChild(sub);

      const wrap = document.createElement('div');
      wrap.className = 'vinst-table-wrap';
      const table = document.createElement('table');
      table.className = 'vinst-table';

      const thead = document.createElement('tr');
      const cornerTh = document.createElement('th');
      cornerTh.className = 'vinst-rowlabel';
      thead.appendChild(cornerTh);
      periods.forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        thead.appendChild(th);
      });
      table.appendChild(thead);

      for(let i = 0; i < N; i++){
        const tr = document.createElement('tr');
        const rowLabel = document.createElement('td');
        rowLabel.className = 'vinst-rowlabel';
        rowLabel.textContent = 'Instance ' + (i + 1);
        tr.appendChild(rowLabel);
        for(let p = 0; p < N; p++){
          const insts = c && c.periodPortInstances[p] && c.periodPortInstances[p][instanceNode.id];
          const v = insts && insts[outIdx] ? insts[outIdx][i] : null;
          const td = document.createElement('td');
          if(v === null || v === undefined || Number.isNaN(v)){ td.textContent = '?'; }
          else {
            td.textContent = formatNum(v);
            if(v === 0) td.classList.add('vinst-zero');
          }
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }

      const totalTr = document.createElement('tr');
      totalTr.className = 'vinst-total';
      const totalLabel = document.createElement('td');
      totalLabel.className = 'vinst-rowlabel';
      totalLabel.textContent = 'Total (' + (outNode.verticalReducer || 'sum') + ')';
      totalTr.appendChild(totalLabel);
      for(let p = 0; p < N; p++){
        const vals = c && c.periodPortValues[p] && c.periodPortValues[p][instanceNode.id];
        const v = vals ? vals[outIdx] : null;
        const td = document.createElement('td');
        td.textContent = (v === null || v === undefined || Number.isNaN(v)) ? '?' : formatNum(v);
        totalTr.appendChild(td);
      }
      table.appendChild(totalTr);

      wrap.appendChild(table);
      box.appendChild(wrap);
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', close);
    actions.appendChild(closeBtn);
    box.appendChild(actions);
  }

