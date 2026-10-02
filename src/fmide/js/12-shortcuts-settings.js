  // ---------- keyboard shortcuts settings ----------
  function exportShortcutsToFile(){
    const payload = { version: 2, kind: 'fmIDE-shortcuts', bindings: {} };
    COMMANDS.forEach(c => { payload.bindings[c.id] = shortcutBindings[c.id] || null; });
    downloadJSON(payload, `fmIDE-shortcuts-${timestamp()}.json`);
  }

  function importShortcutsFromFile(file, onDone){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['fmIDE-shortcuts'], (data) => {
      if(typeof data.bindings !== 'object' || data.bindings === null){
        showMessage('That shortcuts file has no "bindings".');
        return;
      }
      let count = 0;
      const legacy = false; // readFmFile already converted older combo notation
      Object.keys(data.bindings).forEach(cmdId => {
        if(COMMANDS.some(c => c.id === cmdId)){
          shortcutBindings[cmdId] = canonicalCombo(data.bindings[cmdId], legacy);
          count++;
        }
      });
      dedupeBindings();
      rebuildShortcutMap();
      onDone(count);
      });
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  function showShortcutsPicker(){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box shortcuts-box';
    addWindowHelp(box, 'launcher-shortcuts');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); renderRibbon(); saveWorkspaceSoon(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Keyboard Shortcuts';
    box.appendChild(title);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'shortcuts-search';
    search.placeholder = 'Search commands…';
    box.appendChild(search);

    const conflictNote = document.createElement('div');
    conflictNote.className = 'shortcut-conflict-note';
    conflictNote.style.display = 'none';
    box.appendChild(conflictNote);

    const list = document.createElement('div');
    list.className = 'shortcuts-list';
    box.appendChild(list);

    function renderList(){
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      const byCategory = {};
      COMMANDS.forEach(c => {
        if(q && !c.label.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return;
        (byCategory[c.category] = byCategory[c.category] || []).push(c);
      });
      const catOrder = CATEGORY_ORDER;
      const cats = Object.keys(byCategory).sort((a,b) => catOrder.indexOf(a) - catOrder.indexOf(b));
      if(cats.length === 0){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = 'No commands match your search.';
        list.appendChild(empty);
        return;
      }
      cats.forEach(cat => {
        const header = document.createElement('div');
        header.className = 'shortcut-cat-header';
        header.textContent = cat;
        list.appendChild(header);
        byCategory[cat].forEach(c => {
          const row = document.createElement('div');
          row.className = 'shortcut-row';

          const label = document.createElement('span');
          label.className = 'cmd-label';
          label.textContent = c.label;
          row.appendChild(label);

          const badge = document.createElement('span');
          const combo = shortcutBindings[c.id];
          badge.className = 'kbd-badge' + (combo ? '' : ' unbound');
          badge.textContent = combo ? prettyCombo(combo) : 'Unassigned';
          if(combo) badge.title = combo;
          row.appendChild(badge);

          const changeBtn = document.createElement('button');
          changeBtn.textContent = 'Change';
          changeBtn.addEventListener('click', () => {
            badge.textContent = 'Press a key…';
            badge.className = 'kbd-badge listening';
            changeBtn.disabled = true;
            conflictNote.style.display = 'none';

            function onKey(ev){
              ev.preventDefault();
              ev.stopImmediatePropagation();
              if(ev.key === 'Escape'){
                document.removeEventListener('keydown', onKey, true);
                renderList();
                return;
              }
              const newCombo = normalizeCombo(ev);
              if(!newCombo) return; // pure modifier press, keep listening
              document.removeEventListener('keydown', onKey, true);
              const conflictId = shortcutMap[newCombo];
              const notes = [];
              if(conflictId && conflictId !== c.id){
                const conflictCmd = COMMANDS.find(x => x.id === conflictId);
                shortcutBindings[conflictId] = null;
                notes.push(`"${prettyCombo(newCombo)}" was previously assigned to "${conflictCmd ? conflictCmd.label : conflictId}" — that binding has been cleared.`);
              }
              const reserved = comboReservedNote(newCombo);
              if(reserved) notes.push(reserved);
              if(keytipTrigger.type === 'combo' && keytipTrigger.combo === newCombo) notes.push(`${prettyCombo(newCombo)} also opens KeyTips; KeyTips take priority.`);
              if(notes.length){ conflictNote.textContent = notes.join(' '); conflictNote.style.display = 'block'; }
              shortcutBindings[c.id] = newCombo;
              rebuildShortcutMap();
              renderList();
            }
            document.addEventListener('keydown', onKey, true);
          });
          row.appendChild(changeBtn);

          const resetBtn = document.createElement('button');
          resetBtn.textContent = 'Reset';
          resetBtn.title = 'Reset to default';
          resetBtn.disabled = combo === (c.defaultShortcut || null);
          resetBtn.addEventListener('click', () => {
            shortcutBindings[c.id] = c.defaultShortcut || null;
            dedupeBindings();
            rebuildShortcutMap();
            renderList();
          });
          row.appendChild(resetBtn);

          const clearBtn = document.createElement('button');
          clearBtn.textContent = 'Clear';
          clearBtn.disabled = !combo;
          clearBtn.addEventListener('click', () => {
            shortcutBindings[c.id] = null;
            rebuildShortcutMap();
            renderList();
          });
          row.appendChild(clearBtn);

          list.appendChild(row);
        });
      });
    }

    search.addEventListener('input', renderList);
    renderList();

    const ioRow = document.createElement('div');
    ioRow.className = 'template-import-actions';
    ioRow.style.marginBottom = '10px';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⇩ Export Shortcuts';
    const importBtn = document.createElement('button');
    importBtn.textContent = '⇧ Import Shortcuts';
    const resetAllBtn = document.createElement('button');
    resetAllBtn.textContent = 'Reset All to Defaults';
    const shortcutFileInput = document.createElement('input');
    shortcutFileInput.type = 'file';
    shortcutFileInput.accept = 'application/json,.json';
    shortcutFileInput.style.display = 'none';
    ioRow.appendChild(exportBtn);
    ioRow.appendChild(importBtn);
    ioRow.appendChild(resetAllBtn);
    ioRow.appendChild(shortcutFileInput);
    box.appendChild(ioRow);

    exportBtn.addEventListener('click', exportShortcutsToFile);
    importBtn.addEventListener('click', () => shortcutFileInput.click());
    shortcutFileInput.addEventListener('change', () => {
      const file = shortcutFileInput.files && shortcutFileInput.files[0];
      shortcutFileInput.value = '';
      if(!file) return;
      importShortcutsFromFile(file, (count) => {
        showMessage(`Imported ${count} shortcut binding${count===1?'':'s'}.`);
        renderList();
      });
    });
    resetAllBtn.addEventListener('click', () => {
      showConfirm('Reset every command to its default shortcut?', () => {
        COMMANDS.forEach(c => { shortcutBindings[c.id] = c.defaultShortcut || null; });
        rebuildShortcutMap();
        renderList();
      });
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const closeBtn2 = document.createElement('button');
    closeBtn2.textContent = 'Close';
    closeBtn2.addEventListener('click', close);
    actions.appendChild(closeBtn2);
    box.appendChild(actions);
  }

  function startConnection(fromId, downEvent, fromPortIndex){
    pressDefault(downEvent);
    downEvent.stopPropagation();
    document.body.classList.add('dragging');

    const temp = document.createElementNS(SVGNS,'path');
    temp.setAttribute('class','temp');
    svg.appendChild(temp);

    function toCanvasCoords(ev){ return canvasPoint(ev.clientX, ev.clientY); }

    function onMove(ev){
      const a = getNode(fromId);
      const pt = toCanvasCoords(ev);
      const p1 = fromPortIndex != null
        ? (getPortCanvasPos(fromId, fromPortIndex, 'out') || borderPoint(rectOf(a), pt.x, pt.y))
        : borderPoint(rectOf(a), pt.x, pt.y);
      temp.setAttribute('d', `M ${p1.x} ${p1.y} L ${pt.x} ${pt.y}`);
    }
    function onUp(ev, cancelled){
      document.body.classList.remove('dragging');
      temp.remove();
      if(cancelled){ render(); return; }

      connectOnto(fromId, fromPortIndex, document.elementFromPoint(ev.clientX, ev.clientY));
    }
    followPointer(downEvent, onMove, onUp);
  }

  // An arrow from fromId (its output port fromPortIndex, if any) dropped on target, the element
  // under the finger or mouse: onto a node's body or one of its input dots. Shared by drawing an
  // arrow and by the touch menu's "Draw arrow from here" (a tap on the target).
  function connectOnto(fromId, fromPortIndex, target){
    const targetPortEl = target ? target.closest('.io-port') : null;
    const targetNodeEl = target ? target.closest('.node') : null;
    if(!targetNodeEl || targetNodeEl.dataset.id === fromId){ render(); return; }
    const toId = targetNodeEl.dataset.id;
    const toNode = getNode(toId);

    let toPort = null;
    if(targetPortEl && targetPortEl.dataset.portDir === 'in'){
      toPort = parseInt(targetPortEl.dataset.portIndex, 10);
    } else if(toNode && toNode.type === 'blockInstance'){
      // block instances require dropping precisely on one of their input dots
      render();
      return;
    } else if(toNode && toNode.type === 'function'){
      // Dropped on a function node's body: its first input with no arrow (decided in D2b).
      const free = firstFreeFunctionPort(toNode);
      if(free.error){ render(); showMessage(free.error); return; }
      toPort = free.index;
    } else if(toNode && operatorPortsOf(toNode)){
      // Dropped on the body of an operator with named inputs (if, round…): the same rule.
      const free = firstFreeOperatorPort(toNode);
      if(free.error){ render(); showMessage(free.error); return; }
      toPort = free.index;
    }

    guarded(() => {
      // By '#id': a node from a file may have any id, which as a bare word would be read as a name.
      const edgeId = fm.connect('#' + fromId, '#' + toId, fromPortIndex != null ? String(fromPortIndex + 1) : '', toPort !== null ? String(toPort + 1) : '');
      if(edgeId) selectEdgeOnly(edgeId); else render();
    });
  }


