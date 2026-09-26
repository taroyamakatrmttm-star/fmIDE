  // build:include shared/escaping.js

  // ---------- templates ----------

  function buildPreviewSVG(previewNodes, previewEdges){
    // Coordinates go into a markup string below — coerce them to numbers first.
    previewNodes = (previewNodes || []).map(n => Object.assign({}, n, { x: safeNum(n.x), y: safeNum(n.y), w: safeNum(n.w, 170), h: safeNum(n.h, 64) }));
    if(previewNodes.length === 0) return '<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"></svg>';
    const minX = Math.min(...previewNodes.map(n => n.x));
    const minY = Math.min(...previewNodes.map(n => n.y));
    const maxX = Math.max(...previewNodes.map(n => n.x + n.w));
    const maxY = Math.max(...previewNodes.map(n => n.y + n.h));
    const pad = 30;
    const vx = minX - pad, vy = minY - pad, vw = (maxX - minX) + pad*2, vh = (maxY - minY) + pad*2;

    let svg = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">`;
    svg += '<defs><marker id="pvArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';

    previewEdges.forEach(e => {
      const a = previewNodes.find(n => n.id === e.from), b = previewNodes.find(n => n.id === e.to);
      if(!a || !b) return;
      const { p1, p2 } = edgePath(rectOf(a), rectOf(b));
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#94a3b8" stroke-width="2" marker-end="url(#pvArrow)"/>`;
    });

    previewNodes.forEach(n => {
      let fill = '#ffffff', stroke = '#cbd5e1', dash = '';
      if(n.type === 'operator'){ fill = '#fef3c7'; stroke = '#f59e0b'; }
      else if(n.type === 'periodShift'){ fill = '#fdf4ff'; stroke = '#a855f7'; }
      else if(n.type === 'alias'){ fill = '#ecfeff'; stroke = '#0891b2'; dash = 'stroke-dasharray="5 3"'; }
      else if(n.type === 'blockInstance'){ fill = '#f5f3ff'; stroke = '#7c3aed'; }
      else if(n.blockRole === 'input'){ stroke = '#22c55e'; }
      else if(n.blockRole === 'output'){ stroke = '#3b82f6'; }
      svg += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${dash}/>`;
      const label = n.type === 'operator' ? n.text : (n.type === 'periodShift' ? shiftLabel(typeof n.shift === 'number' ? n.shift : -1) : (n.type === 'alias' ? '🔗' : (n.type === 'blockInstance' ? '(block)' : (parseNode(n).name || ''))));
      svg += `<text x="${n.x + n.w/2}" y="${n.y + n.h/2 + 4}" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#1e293b">${escapeXml(label)}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  function cloneData(d){ return JSON.parse(JSON.stringify(d)); }

  function showTemplateForm(opts){
    // opts: { title, kind, initialName, initialDescription, initialGroup, submitLabel, onSubmit }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.minWidth = '320px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = opts.title;
    box.appendChild(title);

    function field(labelText){
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '10px';
      const lbl = document.createElement('label');
      lbl.textContent = labelText;
      lbl.style.cssText = 'display:block;font-size:12px;color:#6b7280;margin-bottom:4px;';
      wrap.appendChild(lbl);
      box.insertBefore(wrap, box.querySelector('.modal-actions'));
      return wrap;
    }

    const inputStyle = 'width:100%;font-size:13px;padding:7px 9px;border-radius:6px;border:1px solid #d1d5db;font-family:inherit;box-sizing:border-box;';

    const actionsPlaceholder = document.createElement('div');
    actionsPlaceholder.className = 'modal-actions';
    box.appendChild(actionsPlaceholder);

    const nameWrap = field('Name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.style.cssText = inputStyle;
    nameInput.value = opts.initialName || '';
    nameWrap.appendChild(nameInput);

    const descWrap = field('Description');
    const descInput = document.createElement('textarea');
    descInput.rows = 3; descInput.style.cssText = inputStyle + 'resize:vertical;';
    descInput.value = opts.initialDescription || '';
    descWrap.appendChild(descInput);

    const groupWrap = field('Group');
    const groupInput = document.createElement('input');
    groupInput.type = 'text'; groupInput.style.cssText = inputStyle;
    groupInput.setAttribute('list', 'tplGroupOptions');
    groupInput.value = opts.initialGroup || 'My Templates';
    const datalist = document.createElement('datalist');
    datalist.id = 'tplGroupOptions';
    Array.from(new Set(TEMPLATES.map(t => t.group || 'My Templates'))).forEach(g => {
      const o = document.createElement('option'); o.value = g; datalist.appendChild(o);
    });
    groupWrap.appendChild(groupInput);
    groupWrap.appendChild(datalist);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const submitBtn = document.createElement('button');
    submitBtn.className = 'primary';
    submitBtn.textContent = opts.submitLabel || 'Save';
    submitBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      opts.onSubmit({ name, description: descInput.value.trim(), group: groupInput.value.trim() || 'My Templates' });
      close();
    });
    actionsPlaceholder.appendChild(cancelBtn);
    actionsPlaceholder.appendChild(submitBtn);
    nameInput.focus();
  }

  function saveCurrentCanvasAsTemplate(reopenPicker){
    syncActiveIntoRegistry();
    const active = canvases.find(c => c.id === activeCanvasId);
    showTemplateForm({
      title: 'Save this canvas as a Template',
      initialName: active ? active.name : 'My Module',
      submitLabel: 'Save Template',
      onSubmit: ({name, description, group}) => {
        const payload = { version:1, kind:'module', name, selfCanvasId: activeCanvasId, nextId, nodes, edges };
        TEMPLATES.push({
          id: 'usr' + (nextTemplateId++), name, description, group, kind:'module', builtin:false,
          data: cloneData(payload)
        });
        reopenPicker(TEMPLATES[TEMPLATES.length - 1]);
      }
    });
  }

  function saveCurrentSystemAsTemplate(reopenPicker){
    syncActiveIntoRegistry();
    showTemplateForm({
      title: 'Save this whole system as a Template',
      initialName: 'My System',
      submitLabel: 'Save Template',
      onSubmit: ({name, description, group}) => {
        const payload = {
          version:2, kind:'system', nextId, nextCanvasId, activeCanvasId,
          canvases: canvases.map(c => ({ id:c.id, name:c.name, nodes:c.nodes, edges:c.edges }))
        };
        TEMPLATES.push({
          id: 'usr' + (nextTemplateId++), name, description, group, kind:'system', builtin:false,
          data: cloneData(payload)
        });
        reopenPicker(TEMPLATES[TEMPLATES.length - 1]);
      }
    });
  }

  function editTemplateMeta(t, onDone){
    showTemplateForm({
      title: 'Edit Template',
      initialName: t.name, initialDescription: t.description, initialGroup: t.group,
      submitLabel: 'Save Changes',
      onSubmit: ({name, description, group}) => {
        t.name = name; t.description = description; t.group = group;
        onDone();
      }
    });
  }

  function deleteTemplate(t, onDone){
    showConfirm(`Delete the template "${t.name}"? This can't be undone.`, () => {
      TEMPLATES = TEMPLATES.filter(x => x.id !== t.id);
      onDone();
    });
  }

  // Templates from a file (Open, Import Workspace, Import Templates) join the person's
  // library, unless the same one — same name, kind and content — is already there. Nothing of
  // theirs is replaced or removed; a same-name template with different content is added.
  // Returns { added, present } (present: valid ones skipped because they are already there).
  function templateFingerprint(name, kind, data){ return name + '\u0000' + kind + '\u0000' + JSON.stringify(data); }
  function addMissingTemplates(list){
    const have = new Set(TEMPLATES.map(x => templateFingerprint(x.name, x.kind, x.data)));
    let added = 0, present = 0;
    (Array.isArray(list) ? list : []).forEach(t => {
      if(!t || typeof t.name !== 'string' || !t.name.trim() || !t.data || (t.kind !== 'module' && t.kind !== 'system')) return;
      const name = t.name.trim();
      const key = templateFingerprint(name, t.kind, t.data);
      if(have.has(key)){ present++; return; }
      have.add(key);
      TEMPLATES.push({
        id: 'usr' + (nextTemplateId++), name,
        description: typeof t.description === 'string' ? t.description : '',
        group: (typeof t.group === 'string' && t.group.trim()) ? t.group.trim() : 'My Templates',
        kind: t.kind, builtin: false, data: t.data
      });
      added++;
    });
    return { added, present };
  }

  // Exact copies (same name, kind and content) beyond the first of each.
  function duplicateTemplates(){
    const seen = new Set();
    return TEMPLATES.filter(t => {
      const key = templateFingerprint(t.name, t.kind, t.data);
      if(seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  }
  function removeDuplicateTemplates(onDone){
    const extra = duplicateTemplates();
    if(!extra.length){ showMessage('There are no duplicate templates.'); return; }
    const n = extra.length;
    showConfirm(`Remove ${n} duplicate template${n === 1 ? '' : 's'}? Only exact copies (same name, kind and content) are removed; one of each is kept.`, () => {
      const drop = new Set(extra); // the copies themselves, not their ids (copies may share one)
      TEMPLATES = TEMPLATES.filter(t => !drop.has(t));
      saveWorkspace();
      toast(`Removed ${n} duplicate template${n === 1 ? '' : 's'}.`);
      if(onDone) onDone();
    });
  }

  function clearAllTemplates(onDone){
    const n = TEMPLATES.length;
    if(!n){ showMessage("You don't have any templates."); return; }
    showConfirm(`Delete all ${n} template${n === 1 ? '' : 's'}? This can't be undone — use ⇩ Export Templates first if you might want them back.`, () => {
      TEMPLATES = [];
      saveWorkspace();
      toast(`Deleted ${n} template${n === 1 ? '' : 's'}.`);
      if(onDone) onDone();
    });
  }

  function exportTemplatesToFile(){
    if(TEMPLATES.length === 0){
      showMessage("You don't have any templates to export.");
      return;
    }
    const payload = {
      version: 1, kind: 'fmIDE-templates',
      templates: TEMPLATES.map(t => ({ name: t.name, description: t.description, group: t.group, kind: t.kind, data: t.data }))
    };
    downloadJSON(payload, `fmIDE-templates-${timestamp()}.json`);
  }

  function importTemplatesFromFile(file, onDone){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['fmIDE-templates'], (data) => {
      if(!Array.isArray(data.templates)){
        showMessage('That templates file has no "templates" list.');
        return;
      }
      const { added, present } = addMissingTemplates(data.templates);
      if(added === 0 && present === 0) showMessage("That file didn't contain any templates fmIDE could recognize.");
      else if(added === 0) showMessage(`All ${present} template${present === 1 ? ' in that file is' : 's in that file are'} already in your library.`);
      else showMessage(`Imported ${added} template${added === 1 ? '' : 's'}` + (present ? ` (${present} ${present === 1 ? 'was' : 'were'} already there).` : '.'));
      onDone(added);
      });
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  // ---------- rectangle formatting presets ----------
  function styleSummary(st){
    if(!st) return '(no formatting set)';
    const parts = [];
    if(st.numberFormat && st.numberFormat.kind && st.numberFormat.kind !== 'general') parts.push(st.numberFormat.kind);
    if(st.fill) parts.push('fill');
    if(st.border && st.border.style && st.border.style !== 'none') parts.push(st.border.style + ' border');
    if(st.font && st.font.family) parts.push('custom font');
    return parts.length ? parts.join(', ') : 'general formatting';
  }

  function saveStyleAsPreset(style, reopen){
    showTemplateForm({
      title: 'Save this formatting as a preset',
      initialName: 'My Format',
      submitLabel: 'Save Preset',
      onSubmit: ({name}) => {
        const preset = { id: 'fmt' + (nextFormatPresetId++), name, style: cloneData(style) };
        FORMAT_PRESETS.push(preset);
        if(reopen) reopen(preset);
      }
    });
  }

  function deleteFormatPreset(p, onDone){
    showConfirm(`Delete the format preset "${p.name}"? This can't be undone.`, () => {
      FORMAT_PRESETS = FORMAT_PRESETS.filter(x => x.id !== p.id);
      onDone();
    });
  }

  function exportFormatPresetsToFile(){
    if(FORMAT_PRESETS.length === 0){ showMessage("You don't have any format presets to export."); return; }
    const payload = { version: 1, kind: 'fmIDE-format-presets', presets: FORMAT_PRESETS.map(p => ({ name: p.name, style: p.style })) };
    downloadJSON(payload, `fmIDE-formats-${timestamp()}.json`);
  }

  function importFormatPresetsFromFile(file, onDone){
    const reader = new FileReader();
    reader.onload = () => {
      openFmFileText(reader.result, ['fmIDE-format-presets'], (data) => {
      if(!Array.isArray(data.presets)){
        showMessage('That format presets file has no "presets" list.');
        return;
      }
      let count = 0;
      data.presets.forEach(p => {
        if(!p || typeof p.name !== 'string' || !p.name.trim() || !p.style) return;
        FORMAT_PRESETS.push({ id: 'fmt' + (nextFormatPresetId++), name: p.name.trim(), style: p.style });
        count++;
      });
      if(count === 0) showMessage("That file didn't contain any format presets fmIDE could recognize.");
      onDone(count);
      });
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  // Manager dialog: browse/rename/delete/export/import presets. If node is given, each row
  // also gets an "Apply" button that applies that preset's style straight to the rectangle.
  function showFormatPresetsPicker(node, onApplied){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Format Presets & Roles';
    box.appendChild(title);

    const ioRow = document.createElement('div');
    ioRow.className = 'template-import-actions';
    ioRow.style.marginBottom = '12px';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⇩ Export Presets';
    const importBtn = document.createElement('button');
    importBtn.textContent = '⇧ Import Presets';
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.style.display = 'none';
    ioRow.appendChild(exportBtn); ioRow.appendChild(importBtn); ioRow.appendChild(fileInput);
    box.appendChild(ioRow);
    exportBtn.addEventListener('click', exportFormatPresetsToFile);
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if(!file) return;
      importFormatPresetsFromFile(file, (count) => {
        if(count > 0){ showMessage(`Imported ${count} format preset${count===1?'':'s'}.`); renderList(); }
      });
    });

    const list = document.createElement('div');
    list.className = 'picker-list';
    box.appendChild(list);

    function renderList(){
      list.innerHTML = '';
      if(FORMAT_PRESETS.length === 0){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = "No format presets yet — open a rectangle's 🎨 formatting dialog and use \"Save as preset\".";
        list.appendChild(empty);
      }
      ensureDefaultFormatPresets();
      FORMAT_PRESETS.slice().sort((a, b) => {
        const ra = FORMAT_ROLES.findIndex(r => r.name === a.name), rb = FORMAT_ROLES.findIndex(r => r.name === b.name);
        return (ra < 0 ? 999 : ra) - (rb < 0 ? 999 : rb);
      }).forEach(p => {
        const row = document.createElement('div');
        row.className = 'picker-row';
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:default;';
        const label = document.createElement('span');
        const role = formatRoleOf(p.name);
        label.innerHTML = role
          ? `<strong>${escapeXml(p.name)}</strong> <span style="font-size:10px; font-weight:700; color:#1e3a8a; background:#dbeafe; border-radius:3px; padding:1px 5px;">ROLE · ${escapeXml(role.where)}</span><span class="sub">${escapeXml(role.desc)}</span>`
          : `<strong>${escapeXml(p.name)}</strong><span class="sub">${escapeXml(styleSummary(p.style))}</span>`;
        const swatch = document.createElement('span');
        const st0 = p.style || {};
        swatch.textContent = 'Aa 1,234';
        // Individual style properties with validated values (never a concatenated cssText).
        swatch.style.display = 'inline-block'; swatch.style.marginLeft = '8px'; swatch.style.padding = '1px 8px';
        swatch.style.borderRadius = '3px'; swatch.style.fontSize = '12px';
        const bStyle = st0.border && ['solid', 'dashed', 'dotted'].includes(st0.border.style) ? st0.border.style : null;
        swatch.style.border = bStyle ? `1px ${bStyle} ${safeColor(st0.border.color, '#94a3b8')}` : '1px solid #e5e7eb';
        swatch.style.background = safeColor(st0.fill, '#fff');
        swatch.style.color = safeColor(st0.font && st0.font.color, '#1e2937');
        swatch.style.fontWeight = ['normal', '600', '700', 'bold'].includes(String(st0.font && st0.font.weight)) ? String(st0.font.weight) : 'normal';
        label.querySelector('strong').after(swatch);
        row.appendChild(label);
        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
        if(node){
          const applyBtn = document.createElement('button');
          applyBtn.className = 'tbtn primary';
          applyBtn.textContent = 'Apply';
          applyBtn.addEventListener('click', () => {
            close();
            guarded(() => fm.applyFormat([node.id], p.name));
            if(onApplied) onApplied();
          });
          btns.appendChild(applyBtn);
        }
        const editBtn = document.createElement('button');
        editBtn.className = 'tbtn';
        editBtn.textContent = '✎';
        editBtn.title = 'Edit this preset\'s formatting';
        editBtn.addEventListener('click', () => showEditFormatPresetStyle(p));
        btns.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.className = 'tbtn';
        delBtn.textContent = '🗑';
        delBtn.title = 'Delete preset';
        delBtn.addEventListener('click', () => deleteFormatPreset(p, renderList));
        if(formatRoleOf(p.name)){ delBtn.disabled = true; delBtn.title = 'Format roles can\'t be deleted — edit it instead'; delBtn.style.opacity = '0.35'; }
        btns.appendChild(delBtn);
        row.appendChild(btns);
        list.appendChild(row);
      });
    }
    renderList();

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const doneBtn = document.createElement('button');
    doneBtn.className = 'primary';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', close);
    actions.appendChild(doneBtn);
    box.appendChild(actions);
  }


  function showTemplatesPicker(){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Templates';
    box.appendChild(title);

    const saveRow = document.createElement('div');
    saveRow.className = 'template-import-actions';
    saveRow.style.marginBottom = '8px';
    const saveCanvasBtn = document.createElement('button');
    saveCanvasBtn.textContent = '+ Save Canvas as Template';
    const saveSystemBtn = document.createElement('button');
    saveSystemBtn.textContent = '+ Save System as Template';
    saveRow.appendChild(saveCanvasBtn);
    saveRow.appendChild(saveSystemBtn);
    box.appendChild(saveRow);

    const ioRow = document.createElement('div');
    ioRow.className = 'template-import-actions';
    ioRow.style.marginBottom = '12px';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⇩ Export Templates';
    const importBtn = document.createElement('button');
    importBtn.textContent = '⇧ Import Templates';
    const tplFileInput = document.createElement('input');
    tplFileInput.type = 'file';
    tplFileInput.accept = 'application/json,.json';
    tplFileInput.style.display = 'none';
    const dedupeBtn = document.createElement('button');
    dedupeBtn.className = 'template-dedupe';
    dedupeBtn.addEventListener('click', () => removeDuplicateTemplates(() => {
      if(selected && !TEMPLATES.includes(selected)) selected = TEMPLATES[0] || null;
      renderList(); renderDetail();
    }));
    ioRow.appendChild(exportBtn);
    ioRow.appendChild(importBtn);
    ioRow.appendChild(dedupeBtn);
    const clearBtn = document.createElement('button');
    clearBtn.className = 'template-clear-all';
    clearBtn.textContent = '🗑 Clear all templates';
    clearBtn.addEventListener('click', () => clearAllTemplates(() => { selected = null; renderList(); renderDetail(); }));
    ioRow.appendChild(clearBtn);
    ioRow.appendChild(tplFileInput);
    box.appendChild(ioRow);

    exportBtn.addEventListener('click', exportTemplatesToFile);
    importBtn.addEventListener('click', () => tplFileInput.click());
    tplFileInput.addEventListener('change', () => {
      const file = tplFileInput.files && tplFileInput.files[0];
      tplFileInput.value = '';
      if(!file) return;
      importTemplatesFromFile(file, (count) => {
        if(count > 0){ renderList(); renderDetail(); }
      });
    });

    const layout = document.createElement('div');
    layout.className = 'template-layout';
    box.appendChild(layout);

    // Search box over the list, as in the Command Launcher (Ctrl+K): the same fuzzy match,
    // best match first; ↑↓ select, Enter runs the selected template's main button, Esc closes.
    const listCol = document.createElement('div');
    listCol.className = 'template-list-col';
    layout.appendChild(listCol);
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'template-search';
    search.placeholder = 'Search templates…';
    search.setAttribute('autocomplete', 'off');
    search.spellcheck = false;
    listCol.appendChild(search);

    const list = document.createElement('div');
    list.className = 'template-list';
    listCol.appendChild(list);
    let shown = []; // templates in the list, in display order

    const detail = document.createElement('div');
    detail.className = 'template-detail';
    layout.appendChild(detail);

    let selected = TEMPLATES[0];
    let previewCanvasIdx = 0;

    saveCanvasBtn.addEventListener('click', () => {
      saveCurrentCanvasAsTemplate((newTpl) => { selected = newTpl; previewCanvasIdx = 0; renderList(); renderDetail(); });
    });
    saveSystemBtn.addEventListener('click', () => {
      saveCurrentSystemAsTemplate((newTpl) => { selected = newTpl; previewCanvasIdx = 0; renderList(); renderDetail(); });
    });

    // The selected template's main (blue) button: Add to current canvas / Add System.
    function runMain(){
      const t = selected;
      if(!t) return;
      close();
      if(t.kind === 'module'){ guarded(() => fm.insertTemplate(t.id, 'here')); return; }
      const collisions = (t.data.canvases || [])
        .filter(c => canvases.some(ec => ec.name.trim().toLowerCase() === (c.name || '').trim().toLowerCase()))
        .map(c => ({ name: c.name || 'Canvas' }));
      if(collisions.length === 0) guarded(() => fm.insertTemplate(t.id, 'add'));
      else showCanvasMergeDecisionModal(collisions, (decisions) => guarded(() => fm.insertTemplate({ template: t.id, mode: 'add', decisions })));
    }

    function renderDetail(){
      detail.innerHTML = '';
      if(!selected){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = 'No template selected.';
        detail.appendChild(empty);
        return;
      }
      const h = document.createElement('h4');
      h.textContent = selected.name;
      detail.appendChild(h);
      const desc = document.createElement('p');
      desc.className = 'template-desc';
      desc.textContent = selected.description || '(no description)';
      detail.appendChild(desc);

      const data = selected.data;
      let previewCanvases;
      if(selected.kind === 'system'){
        previewCanvases = data.canvases;
        const tabs = document.createElement('div');
        tabs.className = 'template-preview-tabs';
        previewCanvases.forEach((c, i) => {
          const t = document.createElement('button');
          t.textContent = c.name;
          t.className = i === previewCanvasIdx ? 'active' : '';
          t.addEventListener('click', () => { previewCanvasIdx = i; renderDetail(); });
          tabs.appendChild(t);
        });
        detail.appendChild(tabs);
      } else {
        previewCanvases = [{ nodes: data.nodes, edges: data.edges }];
        previewCanvasIdx = 0;
      }

      const previewBox = document.createElement('div');
      previewBox.className = 'template-preview';
      const pc = previewCanvases[Math.min(previewCanvasIdx, previewCanvases.length - 1)];
      previewBox.innerHTML = buildPreviewSVG(pc.nodes, pc.edges);
      detail.appendChild(previewBox);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'template-import-actions';
      if(selected.kind === 'module'){
        const addBtn = document.createElement('button');
        addBtn.className = 'primary';
        addBtn.textContent = 'Add to current canvas';
        addBtn.addEventListener('click', runMain);
        const addNewCanvasBtn = document.createElement('button');
        addNewCanvasBtn.textContent = 'Add to new canvas';
        addNewCanvasBtn.addEventListener('click', () => { close(); guarded(() => fm.insertTemplate(selected.id, 'newCanvas')); });
        actionsRow.appendChild(addBtn);
        actionsRow.appendChild(addNewCanvasBtn);
      } else {
        const replaceBtn = document.createElement('button');
        replaceBtn.textContent = 'Replace System';
        replaceBtn.addEventListener('click', () => {
          close();
          showConfirm('Load this system? It will replace everything currently open — all canvases. (You can Undo afterward if needed.)',
            () => guarded(() => fm.insertTemplate(selected.id, 'replace')));
        });
        const addSysBtn = document.createElement('button');
        addSysBtn.className = 'primary';
        addSysBtn.textContent = 'Add System';
        addSysBtn.addEventListener('click', runMain);
        actionsRow.appendChild(replaceBtn);
        actionsRow.appendChild(addSysBtn);
      }
      {
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎ Edit info';
        editBtn.addEventListener('click', () => editTemplateMeta(selected, () => { renderList(); renderDetail(); }));
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑 Delete';
        delBtn.addEventListener('click', () => deleteTemplate(selected, () => {
          selected = TEMPLATES[0] || null; previewCanvasIdx = 0; renderList(); renderDetail();
        }));
        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(delBtn);
      }
      detail.appendChild(actionsRow);
    }

    function templateButton(t, idx, groupName){
      const b = document.createElement('button');
      b.className = (selected && t.id === selected.id) ? 'active' : '';
      b.appendChild(idx ? highlightLabel(t.name, idx) : document.createTextNode(t.name));
      b.appendChild(document.createElement('br'));
      const kind = t.kind === 'system' ? 'system' : 'module';
      const tag = document.createElement('span');
      tag.className = 'kind-tag ' + kind;
      tag.textContent = kind;
      b.appendChild(tag);
      if(groupName){
        const g = document.createElement('span');
        g.className = 'template-group-tag';
        g.textContent = groupName;
        b.appendChild(g);
      }
      b.addEventListener('click', () => { selected = t; previewCanvasIdx = 0; renderList(); renderDetail(); });
      list.appendChild(b);
    }

    function renderList(){
      const extra = duplicateTemplates().length;
      dedupeBtn.textContent = `🧹 Remove ${extra} duplicate${extra === 1 ? '' : 's'}`;
      dedupeBtn.style.display = extra ? '' : 'none';
      clearBtn.style.display = TEMPLATES.length ? '' : 'none';
      list.innerHTML = '';
      shown = [];
      if(TEMPLATES.length === 0){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = 'No templates yet — use "+ Save Canvas as Template" / "+ Save System as Template" above, or import some.';
        list.appendChild(empty);
        return;
      }
      const q = search.value.trim();
      if(q){
        // Name first; group and description only when the name doesn't match.
        const hits = TEMPLATES.map(t => {
          const onName = fuzzyMatch(q, t.name || '');
          if(onName) return { t, score: onName.score + 500, idx: onName.idx };
          const other = fuzzyMatch(q, t.group || '') || fuzzyMatch(q, t.description || '');
          return other ? { t, score: other.score, idx: [] } : null;
        }).filter(Boolean).sort((a, b) => b.score - a.score);
        if(hits.length === 0){
          const none = document.createElement('p');
          none.className = 'template-desc';
          none.textContent = 'No matching templates';
          list.appendChild(none);
          return;
        }
        hits.forEach(h => { shown.push(h.t); templateButton(h.t, h.idx, h.t.group || 'Ungrouped'); });
        return;
      }
      const groups = {};
      TEMPLATES.forEach(t => {
        const g = t.group || 'Ungrouped';
        (groups[g] = groups[g] || []).push(t);
      });
      Object.keys(groups).forEach(g => {
        const header = document.createElement('div');
        header.textContent = g;
        header.style.cssText = 'font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;margin:8px 0 2px;';
        list.appendChild(header);
        groups[g].forEach(t => { shown.push(t); templateButton(t, null, null); });
      });
    }

    function selectShown(i){
      if(!shown.length) return;
      selected = shown[Math.max(0, Math.min(shown.length - 1, i))];
      previewCanvasIdx = 0;
      renderList(); renderDetail();
      const b = list.querySelector('button.active');
      if(b) b.scrollIntoView({ block: 'nearest' });
    }
    search.addEventListener('input', () => {
      renderList();
      if(search.value.trim() && shown.length && shown[0] !== selected) selectShown(0);
    });
    // Keys act only while this window is on top (not under a confirm or edit dialog).
    function onKey(ev){
      const overlays = document.querySelectorAll('.modal-overlay');
      if(overlays[overlays.length - 1] !== overlay) return;
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); return; }
      if(document.activeElement !== search && !list.contains(document.activeElement)) return;
      if(ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
        ev.preventDefault();
        const i = shown.indexOf(selected);
        selectShown(i < 0 ? 0 : i + (ev.key === 'ArrowDown' ? 1 : -1));
        search.focus();
      } else if(ev.key === 'Enter' && document.activeElement === search){
        ev.preventDefault(); ev.stopPropagation();
        if(selected && shown.includes(selected)) runMain();
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

