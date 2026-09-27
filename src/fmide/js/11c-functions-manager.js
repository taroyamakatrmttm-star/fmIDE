  // ---------- the Functions manager (step 7, phase D2) ----------
  // A window in the style of the Templates window: the library by family, each family's
  // versions and notes, and New Function / Edit as new version / Delete / Import / Export.
  // Everything shown from a definition (name, formula, description, note) is text from a
  // file: it goes in with textContent only. The buttons act through fm actions, so a macro
  // being recorded records them.

  // The editor: the whole definition in one box, read as it is typed. It shows the name and
  // inputs, a parse error at its place in the text, and how each call to another function
  // is pinned; Save stays off until the formula reads and every call is settled.
  // `base`: the version a new version starts from (null for a new function).
  function showFunctionEditor(base, onSaved){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box function-editor';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      const overlays = document.querySelectorAll('.modal-overlay');
      if(overlays[overlays.length - 1] !== overlay) return;
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);

    const latest = base ? latestFunctionOf(base.family) : null;
    const title = document.createElement('p');
    title.textContent = base
      ? `New version of ${functionLabel(latest || base)} (version ${nextFunctionVersion(base.family)})`
      : 'New Function';
    box.appendChild(title);

    const label = (text) => { const l = document.createElement('label'); l.className = 'fn-editor-label'; l.textContent = text; box.appendChild(l); return l; };
    label('Definition — name, inputs and formula');
    const textBox = document.createElement('textarea');
    textBox.className = 'fn-editor-text';
    textBox.rows = 4;
    textBox.spellcheck = false;
    textBox.maxLength = FUNCTION_LIMITS.text + 1;
    textBox.placeholder = 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue';
    textBox.value = base ? base.text : '';
    box.appendChild(textBox);

    const parsedLine = document.createElement('p');
    parsedLine.className = 'fn-editor-parsed';
    box.appendChild(parsedLine);
    const where = document.createElement('pre');
    where.className = 'fn-editor-where';
    box.appendChild(where);
    const errorLine = document.createElement('p');
    errorLine.className = 'fn-editor-error';
    box.appendChild(errorLine);
    const callsBox = document.createElement('div');
    callsBox.className = 'fn-editor-calls';
    box.appendChild(callsBox);

    label('Description');
    const descBox = document.createElement('textarea');
    descBox.className = 'fn-editor-description';
    descBox.rows = 2;
    descBox.maxLength = FUNCTION_LIMITS.description;
    descBox.value = base ? base.description : '';
    box.appendChild(descBox);
    label(base ? 'Change note' : 'Note (optional)');
    const noteBox = document.createElement('input');
    noteBox.type = 'text';
    noteBox.className = 'fn-editor-note';
    noteBox.maxLength = FUNCTION_LIMITS.note;
    noteBox.placeholder = 'What changed (optional)';
    box.appendChild(noteBox);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary fn-editor-save';
    saveBtn.textContent = base ? `Save version ${nextFunctionVersion(base.family)}` : 'Save Function';
    actions.append(cancelBtn, saveBtn);
    box.appendChild(actions);

    const picks = Object.create(null); // the person's choices, by lower-case call name
    let check = null;

    function optionText(v){
      const bits = [`${functionLabel(v)} v${v.version}`];
      if(isLatestFunction(v)) bits.push('(latest)');
      if(v.description) bits.push('— ' + v.description.slice(0, 60));
      if(functionFamiliesNamed(functionLabel(v)).length > 1) bits.push(`[family ${v.family.slice(0, 8)}]`);
      return bits.join(' ');
    }
    function renderCalls(){
      callsBox.innerHTML = '';
      if(!check || !check.plan || !check.plan.calls.length) return;
      const head = document.createElement('div');
      head.className = 'fn-editor-label';
      head.textContent = 'Calls to other functions';
      callsBox.appendChild(head);
      check.plan.calls.forEach(c => {
        const row = document.createElement('div');
        row.className = 'fn-editor-call ' + c.state;
        row.dataset.call = c.key;
        const name = document.createElement('b');
        name.textContent = c.name;
        row.appendChild(name);
        row.appendChild(document.createTextNode(' → '));
        if(c.state === 'missing'){
          row.appendChild(document.createTextNode('not in your library'));
        } else {
          const sel = document.createElement('select');
          sel.className = 'fn-editor-call-pick';
          if(!c.chosen){
            const o = document.createElement('option');
            o.value = ''; o.textContent = 'Choose which function…';
            sel.appendChild(o);
          }
          c.options.forEach((v, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = optionText(v);
            if(v === c.chosen) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener('change', () => {
            const v = c.options[Number(sel.value)];
            if(v) picks[c.key] = v;
            refresh();
          });
          row.appendChild(sel);
          if(c.chosen && c.latest && c.latest !== c.chosen){
            const hint = document.createElement('button');
            hint.type = 'button';
            hint.className = 'fn-editor-use-latest';
            hint.textContent = `Use the latest (v${c.latest.version})`;
            hint.addEventListener('click', () => { picks[c.key] = c.latest; refresh(); });
            row.appendChild(hint);
          }
        }
        callsBox.appendChild(row);
      });
    }
    function refresh(){
      check = checkFunctionDraft(textBox.value, base, picks);
      const p = check.problem;
      if(check.parsed.ok){
        const params = check.parsed.params;
        parsedLine.textContent = `${check.parsed.name} — ${params.length ? 'inputs: ' + params.join(', ') : 'no inputs'}`;
      } else parsedLine.textContent = '';
      errorLine.textContent = p ? '⚠ ' + p.message : (textBox.value.trim() ? '✓ The formula reads.' : '');
      errorLine.classList.toggle('ok', !p);
      // The place of the error, marked in a copy of the text.
      where.innerHTML = '';
      if(p && typeof p.at === 'number' && textBox.value){
        const text = textBox.value;
        const at = Math.max(0, Math.min(text.length, p.at));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(at, at + (p.length || 1)) || ' ';
        where.append(document.createTextNode(text.slice(0, at)), mark, document.createTextNode(text.slice(at + (p.length || 1))));
        where.style.display = '';
      } else where.style.display = 'none';
      renderCalls();
      saveBtn.disabled = !!p || !textBox.value.trim();
    }
    textBox.addEventListener('input', refresh);

    function save(newVersionOf){
      const calls = {};
      check.plan.calls.forEach(c => { calls[c.name] = c.chosen.family + '@' + c.chosen.version; });
      const ref = guarded(() => fm.saveFunction({ text: textBox.value, description: descBox.value, note: noteBox.value,
        newVersionOf: newVersionOf || '', calls }));
      if(ref === undefined) return;
      close();
      if(onSaved) onSaved(FUNCTIONS[FUNCTIONS.length - 1]);
    }
    saveBtn.addEventListener('click', () => {
      refresh();
      if(saveBtn.disabled) return;
      if(base){ save(functionRefText(latest)); return; }
      const taken = functionFamiliesNamed(check.parsed.name)[0];
      if(!taken){ save(''); return; }
      askFunctionNameTaken(taken, () => {
        // As the family's next version: its pins and its name rule apply.
        base = taken;
        const again = checkFunctionDraft(textBox.value, base, picks);
        if(again.problem){ showMessage(again.problem.message); base = null; refresh(); return; }
        check = again;
        save(functionRefText(taken));
      }, () => textBox.focus());
    });

    refresh();
    textBox.focus();
  }

  // Saving a new function under a name one of the person's families already has: its next
  // version only when they choose it; otherwise they change the name.
  function askFunctionNameTaken(fam, onNewVersion, onRename){
    showChoice(`There is already a function called ${functionLabel(fam)} (version ${fam.version}). Save this as its next version, or change the name?`,
      [{ label: 'Change the name', run: onRename }, { label: `Save as new version of ${functionLabel(fam)}`, primary: true, run: onNewVersion }], 'function-name-taken');
  }
  // A message with a row of buttons (the last is the default); Escape runs the first.
  function showChoice(message, buttons, className){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box' + (className ? ' ' + className : '');
    const p = document.createElement('p');
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){ if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); buttons[0].run(); } }
    const els = buttons.map(b => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if(b.primary) el.className = 'primary';
      if(b.danger) el.className = 'danger';
      el.addEventListener('click', () => { close(); b.run(); });
      actions.appendChild(el);
      return el;
    });
    box.append(p, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    els[els.length - 1].focus();
  }

  // What deleting `d` means (decided September 2026: a warning, never a refusal — the open
  // model carries its own copy, so its nodes keep calculating).
  function functionDeleteMessage(d){
    const whole = isLatestFunction(d);
    const all = functionFamilyVersions(d.family);
    const name = functionLabel(d);
    const lines = [whole
      ? `Delete the function ${name}` + (all.length > 1 ? ` and all ${all.length} of its versions` : '') + '?'
      : `Delete version ${d.version} of ${name}? The other versions stay.`];
    const uses = functionNodesUsing(d.family, whole ? null : d.version).length;
    if(uses) lines.push(`${uses} node${uses === 1 ? '' : 's'} in the open model use${uses === 1 ? 's' : ''} it. ${uses === 1 ? 'It keeps' : 'They keep'} working — the model carries its own copy — but ${uses === 1 ? 'it' : 'they'} won't be offered updates from the library.`);
    const going = whole ? all : [d];
    const callers = [];
    going.forEach(g => functionCallersOf(g).forEach(c => { if(!going.includes(c) && !callers.includes(c)) callers.push(c); }));
    if(callers.length) lines.push(`${callers.map(c => functionLabel(c) + ' v' + c.version).join(', ')} call${callers.length === 1 ? 's' : ''} it: inserting ${callers.length === 1 ? 'that' : 'those'} from the library will leave the call missing.`);
    lines.push("This can't be undone — use ⇩ Export Functions first if you might want it back.");
    return lines.join('\n\n');
  }

  function exportFunctionsInteractive(){
    const families = functionFamilies();
    if(!families.length){ showMessage("You don't have any functions to export."); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box function-export';
    const p = document.createElement('p');
    p.textContent = 'Export functions — each ticked function goes with all its versions, and every function they call.';
    box.appendChild(p);
    const ticks = families.map(f => {
      const row = document.createElement('label');
      row.className = 'function-export-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true;
      row.append(cb, document.createTextNode(` ${functionLabel(f)} (v${f.version})`));
      box.appendChild(row);
      return { f, cb };
    });
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = 'primary';
    okBtn.textContent = 'Export';
    actions.append(cancelBtn, okBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const picked = ticks.filter(t => t.cb.checked).map(t => t.f.family);
      if(!picked.length) return;
      close();
      guarded(() => fm.exportFunctions({ download: true, functions: picked.length === families.length ? null : picked }));
    });
    okBtn.focus();
  }

  // Import Functions: an fmIDE-functions file joins the library (a file from a newer fmIDE
  // asks first, through openFmFileText).
  function importFunctionsFromFile(file, onDone){
    const reader = new FileReader();
    reader.onload = () => openFmFileText(reader.result, ['fmIDE-functions'], (data) => {
      const r = guarded(() => fm.importFunctions({ file: data, allowNewer: true }));
      if(!r) return;
      const { added, present, renumbered } = r;
      if(added === 0 && present === 0) showMessage("That file didn't contain any functions fmIDE could read.");
      else if(added === 0) showMessage(`All ${present} function version${present === 1 ? ' in that file is' : 's in that file are'} already in your library.`);
      else showMessage(`Imported ${added} function version${added === 1 ? '' : 's'}` + (present ? ` (${present} ${present === 1 ? 'was' : 'were'} already there).` : '.')
        + (renumbered ? ` ${renumbered} ${renumbered === 1 ? 'was' : 'were'} added under a new version number because ${renumbered === 1 ? 'its number was' : 'their numbers were'} already taken by a different version.` : ''));
      if(onDone) onDone(added);
    });
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }
  function pickFunctionsFile(onDone){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.className = 'function-file-input';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if(file) importFunctionsFromFile(file, onDone);
    });
    input.click();
  }

  // `initial`: the library version to show first (double-clicking a function node).
  function showFunctionsManager(initial){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-box function-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Functions';
    box.appendChild(title);

    const topRow = document.createElement('div');
    topRow.className = 'template-import-actions';
    topRow.style.marginBottom = '12px';
    const newBtn = document.createElement('button');
    newBtn.className = 'function-new';
    newBtn.textContent = '+ New Function…';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⇩ Export Functions';
    const importBtn = document.createElement('button');
    importBtn.textContent = '⇧ Import Functions';
    topRow.append(newBtn, exportBtn, importBtn);
    box.appendChild(topRow);

    const layout = document.createElement('div');
    layout.className = 'template-layout';
    box.appendChild(layout);
    const listCol = document.createElement('div');
    listCol.className = 'template-list-col';
    layout.appendChild(listCol);
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'template-search';
    search.placeholder = 'Search functions…';
    search.setAttribute('autocomplete', 'off');
    search.spellcheck = false;
    listCol.appendChild(search);
    const list = document.createElement('div');
    list.className = 'template-list function-list';
    listCol.appendChild(list);
    const detail = document.createElement('div');
    detail.className = 'template-detail function-detail';
    layout.appendChild(detail);

    let selected = (initial && FUNCTIONS.includes(initial)) ? initial : (functionFamilies()[0] || null);
    let shown = [];
    const expanded = new Set();
    if(selected && !isLatestFunction(selected)) expanded.add(selected.family);
    const reselect = (d) => { selected = d || (selected && FUNCTIONS.includes(selected) ? selected : (selected && latestFunctionOf(selected.family))) || functionFamilies()[0] || null; renderList(); renderDetail(); };

    newBtn.addEventListener('click', () => showFunctionEditor(null, reselect));
    exportBtn.addEventListener('click', exportFunctionsInteractive);
    importBtn.addEventListener('click', () => pickFunctionsFile(() => reselect()));

    const para = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; detail.appendChild(p); return p; };
    function renderDetail(){
      detail.innerHTML = '';
      if(!selected){ para('template-desc', 'No function selected.'); return; }
      const d = selected;
      const h = document.createElement('h4');
      h.textContent = functionLabel(d);
      detail.appendChild(h);
      const all = functionFamilyVersions(d.family);
      const ver = para('template-version-info', '');
      const verLabel = document.createElement('b');
      verLabel.textContent = `Version ${d.version}` + (all.length > 1 ? ` of ${all[0].version}` : '');
      ver.appendChild(verLabel);
      if(!isLatestFunction(d)) ver.appendChild(document.createTextNode(' (an older version)'));
      if(d.note){ const n = document.createElement('span'); n.className = 'template-note'; n.textContent = ' — ' + d.note; ver.appendChild(n); }
      para('template-desc', d.description || '(no description)');
      const pre = document.createElement('pre');
      pre.className = 'function-detail-text';
      pre.textContent = d.text;
      detail.appendChild(pre);
      const parsed = parseFunctionText(d.text);
      if(parsed.ok) para('function-detail-inputs', parsed.params.length ? 'Inputs: ' + parsed.params.join(', ') : 'No inputs');
      else para('function-detail-problem', "⚠ This formula can't be read: " + parsed.error.message);
      d.calls.forEach(c => {
        const target = libraryFunctionFor(c);
        const latest = target && latestFunctionOf(target.family);
        para('function-detail-call' + (target ? '' : ' missing') + (target && latest !== target ? ' older' : ''),
          `Calls ${c.name} v${target ? target.version : c.version}` + (!target ? ' — not in your library' : (latest !== target ? ` (the latest is v${latest.version}: save a new version to use it)` : '')));
      });
      const uses = functionNodesUsing(d.family, d.version).length;
      if(uses) para('function-detail-uses', `Used by ${uses} node${uses === 1 ? '' : 's'} in the open model.`);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'template-import-actions';
      const versionBtn = document.createElement('button');
      versionBtn.className = 'function-new-version';
      versionBtn.textContent = 'Edit as new version…';
      versionBtn.title = `Starts from version ${d.version}; saves version ${nextFunctionVersion(d.family)}`;
      versionBtn.addEventListener('click', () => showFunctionEditor(d, reselect));
      const infoBtn = document.createElement('button');
      infoBtn.className = 'function-edit-info';
      infoBtn.textContent = '✎ Edit description';
      infoBtn.addEventListener('click', () => editFunctionInfo(d, () => reselect(d)));
      const delBtn = document.createElement('button');
      delBtn.className = 'function-delete';
      delBtn.textContent = !isLatestFunction(d) ? `🗑 Delete version ${d.version}` : (all.length > 1 ? `🗑 Delete (all ${all.length} versions)` : '🗑 Delete');
      if(isLatestFunction(d) && all.length > 1) delBtn.title = 'The latest version can only be deleted with the whole function, so its number is never used again. Older versions can be deleted one by one.';
      delBtn.addEventListener('click', () => showConfirm(functionDeleteMessage(d), () => {
        const family = d.family;
        if(guarded(() => fm.deleteFunction({ function: functionRefText(d), whole: isLatestFunction(d) })) === undefined) return;
        reselect(latestFunctionOf(family));
      }));
      const insertBtn = document.createElement('button');
      insertBtn.className = 'function-insert';
      insertBtn.textContent = `ƒ Insert v${d.version}`;
      insertBtn.title = 'Adds a node for this version to the canvas';
      insertBtn.disabled = !parsed.ok;
      insertBtn.addEventListener('click', () => {
        const {x, y} = spawnPoint();
        const id = guarded(() => fm.insertFunction({ function: functionRefText(d), x, y }));
        if(id === undefined) return;
        close();
        selectNodesOnly([id]);
      });
      actionsRow.append(insertBtn, versionBtn, infoBtn, delBtn);
      detail.appendChild(actionsRow);
    }

    function entryButton(d, idx){
      const b = document.createElement('button');
      b.className = 'template-family function-family' + (selected === d ? ' active' : '');
      const name = functionLabel(d);
      b.appendChild(idx ? highlightLabel(name, idx) : document.createTextNode(name));
      b.appendChild(document.createElement('br'));
      const v = document.createElement('span');
      v.className = 'template-version-tag';
      v.textContent = 'v' + d.version;
      b.appendChild(v);
      // Two families of one name (from imports) are told apart by their family ids.
      if(functionFamiliesNamed(name).length > 1){
        const t = document.createElement('span');
        t.className = 'function-family-id';
        t.textContent = 'family ' + d.family.slice(0, 8);
        t.title = d.description || '';
        b.appendChild(t);
      }
      if(functionNodesUsing(d.family).length){
        const t = document.createElement('span');
        t.className = 'function-in-model-tag';
        t.textContent = 'in this model';
        b.appendChild(t);
      }
      if(olderCallsOf(d).length){
        const t = document.createElement('span');
        t.className = 'function-older-calls-tag';
        t.textContent = '⚠ calls an older version';
        t.title = olderCallsOf(d).map(c => `${c.name} v${c.version} (latest v${c.latest})`).join(', ');
        b.appendChild(t);
      }
      b.addEventListener('click', () => { selected = d; renderList(); renderDetail(); });
      list.appendChild(b);
      shown.push(d);
      const older = functionFamilyVersions(d.family).slice(1);
      if(!older.length) return;
      const open = expanded.has(d.family) || (selected && selected.family === d.family && selected !== d);
      const toggle = document.createElement('button');
      toggle.className = 'template-versions-toggle';
      toggle.textContent = (open ? '▾ ' : '▸ ') + older.length + ' older version' + (older.length === 1 ? '' : 's');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.addEventListener('click', () => {
        if(open){ expanded.delete(d.family); if(selected && selected.family === d.family) selected = d; }
        else expanded.add(d.family);
        renderList(); renderDetail();
      });
      list.appendChild(toggle);
      if(!open) return;
      older.forEach(o => {
        const ob = document.createElement('button');
        ob.className = 'template-version' + (selected === o ? ' active' : '');
        const l = document.createElement('b');
        l.textContent = 'v' + o.version;
        ob.appendChild(l);
        if(o.note) ob.appendChild(document.createTextNode(' — ' + o.note));
        ob.addEventListener('click', () => { selected = o; expanded.add(d.family); renderList(); renderDetail(); });
        list.appendChild(ob);
        shown.push(o);
      });
    }
    function renderList(){
      list.innerHTML = '';
      shown = [];
      const families = functionFamilies();
      if(!families.length){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = 'No functions yet — use "+ New Function…" above, or import some.';
        list.appendChild(empty);
        return;
      }
      const q = search.value.trim();
      if(!q){ families.forEach(d => entryButton(d, null)); return; }
      const hits = families.map(d => {
        const onName = fuzzyMatch(q, functionLabel(d));
        if(onName) return { d, score: onName.score + 500, idx: onName.idx };
        const other = fuzzyMatch(q, d.description || '');
        return other ? { d, score: other.score, idx: [] } : null;
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      if(!hits.length){
        const none = document.createElement('p');
        none.className = 'template-desc';
        none.textContent = 'No matching functions';
        list.appendChild(none);
        return;
      }
      hits.forEach(h => entryButton(h.d, h.idx));
    }
    search.addEventListener('input', () => {
      renderList();
      if(search.value.trim() && shown.length && shown[0] !== selected){ selected = shown[0]; renderList(); renderDetail(); }
    });
    function onKey(ev){
      const overlays = document.querySelectorAll('.modal-overlay');
      if(overlays[overlays.length - 1] !== overlay) return;
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); return; }
      if(document.activeElement !== search && !list.contains(document.activeElement)) return;
      if(ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
        ev.preventDefault();
        if(!shown.length) return;
        const i = shown.indexOf(selected);
        selected = shown[Math.max(0, Math.min(shown.length - 1, i < 0 ? 0 : i + (ev.key === 'ArrowDown' ? 1 : -1)))];
        renderList(); renderDetail();
        search.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);

    renderList();
    renderDetail();
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', close);
    actions.appendChild(closeBtn);
    box.appendChild(actions);
    search.focus();
  }

  // Description and note of one version (library only; neither changes the calculation).
  function editFunctionInfo(d, onDone){
    showTemplateForm({
      title: `Edit ${functionLabel(d)} v${d.version}`,
      fields: ['description', 'note'],
      initialDescription: d.description, initialNote: d.note,
      noteLabel: `Change note (version ${d.version})`,
      submitLabel: 'Save Changes',
      onSubmit: ({ description, note }) => {
        if(guarded(() => fm.setFunctionInfo({ function: functionRefText(d), description, note })) === undefined) return false;
        onDone();
      }
    });
  }
