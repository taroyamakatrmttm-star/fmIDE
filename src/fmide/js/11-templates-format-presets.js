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
    // opts: { title, fields (default name, description, group), initialName, initialDescription,
    //         initialGroup, initialNote, noteLabel, submitLabel, onSubmit(values, close) }.
    // onSubmit may return false to keep the form open (it then closes it itself, or not).
    const fields = opts.fields || ['name', 'description', 'group'];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-form';
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

    let nameInput = null, descInput = null, groupInput = null, noteInput = null;
    if(fields.includes('name')){
      nameInput = document.createElement('input');
      nameInput.type = 'text'; nameInput.style.cssText = inputStyle;
      nameInput.className = 'template-form-name';
      nameInput.value = opts.initialName || '';
      field('Name').appendChild(nameInput);
    }

    if(fields.includes('description')){
      descInput = document.createElement('textarea');
      descInput.rows = 3; descInput.style.cssText = inputStyle + 'resize:vertical;';
      descInput.value = opts.initialDescription || '';
      field('Description').appendChild(descInput);
    }

    if(fields.includes('group')){
      const groupWrap = field('Group');
      groupInput = document.createElement('input');
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
    }

    if(fields.includes('note')){
      noteInput = document.createElement('input');
      noteInput.type = 'text'; noteInput.style.cssText = inputStyle;
      noteInput.className = 'template-form-note';
      noteInput.maxLength = TEMPLATE_NOTE_MAX;
      noteInput.placeholder = 'What changed (optional)';
      noteInput.value = opts.initialNote || '';
      field(opts.noteLabel || 'Change note').appendChild(noteInput);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const submitBtn = document.createElement('button');
    submitBtn.className = 'primary';
    submitBtn.textContent = opts.submitLabel || 'Save';
    submitBtn.addEventListener('click', () => {
      const values = {};
      if(nameInput){
        values.name = nameInput.value.trim();
        if(!values.name){ nameInput.focus(); return; }
      }
      if(descInput) values.description = descInput.value.trim();
      if(groupInput) values.group = groupInput.value.trim() || 'My Templates';
      if(noteInput) values.note = cleanTemplateNote(noteInput.value);
      if(opts.onSubmit(values, close) !== false) close();
    });
    actionsPlaceholder.appendChild(cancelBtn);
    actionsPlaceholder.appendChild(submitBtn);
    (nameInput || noteInput || submitBtn).focus();
    return { focusName(){ if(nameInput){ nameInput.focus(); nameInput.select(); } } };
  }

  // The model a template of this kind holds, taken from what is open now: the active
  // canvas (a module) or every canvas (a system).
  function openModelAsTemplateData(kind, name){
    syncActiveIntoRegistry();
    const payload = kind === 'module'
      ? withFunctions({ version: FILE_FORMATS['module'].current, kind:'module', name, selfCanvasId: activeCanvasId, nextId, nodes, edges }, [{ nodes }])
      : withFunctions({ version: SHARED_FILE_VERSIONS['system'], kind:'system', nextId, nextCanvasId, activeCanvasId,
          canvases: canvases.map(c => ({ id:c.id, name:c.name, nodes:c.nodes, edges:c.edges })) }, canvases);
    return cloneData(payload);
  }

  // The open canvas or system as the next version of the family `fam` (any of its versions).
  function saveTemplateVersion(fam, note){
    const latest = latestOfFamily(fam.family);
    const t = {
      id: 'usr' + (nextTemplateId++), name: latest.name, description: latest.description, group: latest.group,
      kind: latest.kind, builtin: false, family: latest.family, version: nextVersionNumber(latest.family),
      note: cleanTemplateNote(note), versionId: newRandomId(), data: openModelAsTemplateData(latest.kind, latest.name)
    };
    TEMPLATES.push(t);
    if(t.kind === 'module') linkActiveCanvasTo(t);
    saveWorkspaceSoon();
    return t;
  }
  // The canvas just saved as a template now matches it: link them.
  function linkActiveCanvasTo(t){
    setCanvasTemplateLink(canvases.find(c => c.id === activeCanvasId), t);
    markDocDirty();
    renderCanvasTabs();
  }

  // "Save as new version" in the Templates window.
  function saveNewVersionOf(fam, reopenPicker){
    const latest = latestOfFamily(fam.family);
    const n = nextVersionNumber(latest.family);
    showTemplateForm({
      title: `Save the open ${latest.kind === 'system' ? 'system' : 'canvas'} as version ${n} of "${latest.name}"`,
      fields: ['note'], submitLabel: `Save version ${n}`,
      onSubmit: ({ note }) => { reopenPicker(saveTemplateVersion(latest, note)); }
    });
  }

  // Template names are unique among the families here (any kind), so "Name@3" means one
  // thing; imports may still bring in a second family of the same name.
  // Saving under a name a family of the same kind already has: a new version only when the
  // person chooses it; otherwise they pick another name (the form stays open).
  function askNameTaken(fam, onNewVersion, onRename){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-name-taken';
    const p = document.createElement('p');
    p.textContent = `There is already a template called "${fam.name}" (version ${fam.version}). Save this as its next version, or choose another name for a new template?`;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const renameBtn = document.createElement('button'); renameBtn.textContent = 'Choose another name';
    const versionBtn = document.createElement('button'); versionBtn.className = 'primary';
    versionBtn.textContent = `Save as new version of "${fam.name}"`;
    actions.append(renameBtn, versionBtn);
    box.append(p, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){ if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); onRename(); } }
    renameBtn.addEventListener('click', () => { close(); onRename(); });
    versionBtn.addEventListener('click', () => { close(); onNewVersion(); });
    document.addEventListener('keydown', onKey, true);
    versionBtn.focus();
  }

  // "+ Save Canvas / System as Template": a new family, version 1.
  function saveOpenAsTemplate(kind, reopenPicker){
    syncActiveIntoRegistry();
    const active = canvases.find(c => c.id === activeCanvasId);
    const form = showTemplateForm({
      title: kind === 'module' ? 'Save this canvas as a Template' : 'Save this whole system as a Template',
      fields: ['name', 'description', 'group', 'note'],
      initialName: kind === 'module' ? (active ? active.name : 'My Module') : 'My System',
      submitLabel: 'Save Template',
      onSubmit: ({ name, description, group, note }, closeForm) => {
        const other = familiesNamed(name).find(f => f.kind !== kind);
        if(other){
          showMessage(`There is already a ${other.kind === 'system' ? 'system' : 'canvas'} template called "${other.name}". Choose another name.`);
          return false;
        }
        const taken = familiesNamed(name, kind);
        if(taken.length){
          askNameTaken(taken[0], () => { closeForm(); reopenPicker(saveTemplateVersion(taken[0], note)); }, () => form.focusName());
          return false;
        }
        const t = {
          id: 'usr' + (nextTemplateId++), name, description, group, kind, builtin: false,
          family: newRandomId(), version: 1, note, versionId: newRandomId(),
          data: openModelAsTemplateData(kind, name)
        };
        TEMPLATES.push(t);
        if(kind === 'module') linkActiveCanvasTo(t);
        saveWorkspaceSoon();
        reopenPicker(t);
      }
    });
  }
  function saveCurrentCanvasAsTemplate(reopenPicker){ saveOpenAsTemplate('module', reopenPicker); }
  function saveCurrentSystemAsTemplate(reopenPicker){ saveOpenAsTemplate('system', reopenPicker); }

  // Name, group and description belong to the family (all its versions); the change note to
  // this version.
  function editTemplateMeta(t, onDone){
    showTemplateForm({
      title: 'Edit Template',
      fields: ['name', 'description', 'group', 'note'],
      initialName: t.name, initialDescription: t.description, initialGroup: t.group, initialNote: t.note,
      noteLabel: `Change note (version ${t.version})`,
      submitLabel: 'Save Changes',
      onSubmit: ({ name, description, group, note }) => {
        if(familiesNamed(name).some(f => f.family !== t.family)){
          showMessage(`There is already another template called "${name}". Choose another name.`);
          return false;
        }
        TEMPLATES.forEach(x => { if(x.family === t.family){ x.name = name; x.description = description; x.group = group; } });
        t.note = note;
        saveWorkspaceSoon();
        onDone();
      }
    });
  }

  // The latest version deletes the whole template (every version); an older version can go
  // on its own. The latest never goes alone, so a version number is never used twice.
  function deleteTemplate(t, onDone){
    const all = familyVersions(t.family);
    const message = !isLatestVersion(t)
      ? `Delete version ${t.version} of "${t.name}"? The other versions stay. This can't be undone.`
      : `Delete the template "${t.name}"` + (all.length > 1 ? ` and all ${all.length} of its versions` : '') + `? This can't be undone.`;
    showConfirm(message, () => {
      TEMPLATES = isLatestVersion(t) ? TEMPLATES.filter(x => x.family !== t.family) : TEMPLATES.filter(x => x !== t);
      saveWorkspaceSoon();
      onDone();
    });
  }

  // ---------- template families and versions ----------
  // TEMPLATES holds one entry per version. Versions of the same template share a `family` —
  // a lasting random id, so templates from different people never clash — and are numbered
  // 1, 2, 3 (`version`), each with a short change `note` and its own random `versionId`.
  // Name, group, description and kind belong to the family: every version carries the
  // same ones, and Edit info changes them all. `id` ("usrN") is local and reassigned on
  // import and restore; nothing lasting may refer to it.
  // Family and version ids and change notes are checked by isTemplateUid and
  // cleanTemplateNote (src/shared/fmide-files.js).
  // A family's versions, newest first.
  function familyVersions(family){
    return TEMPLATES.filter(t => t.family === family).sort((a, b) => b.version - a.version);
  }
  function latestOfFamily(family){ return familyVersions(family)[0] || null; }
  function isLatestVersion(t){ return latestOfFamily(t.family) === t; }
  function nextVersionNumber(family){
    return TEMPLATES.reduce((m, t) => (t.family === family ? Math.max(m, t.version) : m), 0) + 1;
  }
  // One entry per family (its latest version), in the order the families first appear.
  function templateFamilies(){
    const seen = new Set(), out = [];
    TEMPLATES.forEach(t => { if(!seen.has(t.family)){ seen.add(t.family); out.push(latestOfFamily(t.family)); } });
    return out;
  }
  // Families of this kind called `name` (case and outer spaces ignored), as their latest versions.
  function familiesNamed(name, kind){
    const k = String(name || '').trim().toLowerCase();
    return templateFamilies().filter(t => t.name.trim().toLowerCase() === k && (!kind || t.kind === kind));
  }
  // How a template is written to a file (workspace, templates file, library pack). `origin`
  // (the library pack a version came from, phase 8b) only when it has one.
  function templateRecord(t, withId){
    const r = withId ? { id: t.id } : {};
    Object.assign(r, { name: t.name, description: t.description, group: t.group, kind: t.kind,
      family: t.family, version: t.version, note: t.note, versionId: t.versionId, data: t.data });
    if(t.origin) r.origin = Object.assign({}, t.origin);
    return r;
  }

  // A library entry from a template read from a file (or the autosave), with its family
  // fields checked: text from files is untrusted. A missing or malformed family or version
  // id gets a fresh one, a version that isn't a whole number ≥ 1 becomes 1. `family`,
  // `version` and `versionId` in `over` replace the file's (after checking). An `origin`
  // (phase 8b) is kept only when it passes cleanItemOrigin. Returns null for something that
  // isn't a template. The caller gives it an id.
  function templateEntryFrom(t, over){
    if(!t || typeof t !== 'object' || typeof t.name !== 'string' || !t.name.trim() || !t.data || typeof t.data !== 'object') return null;
    if(t.kind !== 'module' && t.kind !== 'system' && t.kind !== 'recipe') return null;
    const data = t.kind === 'recipe' ? cleanRecipeData(t.data) : t.data;
    if(!data) return null;
    const o = Object.assign({}, t, over || {});
    const version = Number(o.version);
    const e = {
      id: null, name: t.name.trim(),
      description: typeof t.description === 'string' ? t.description : '',
      group: (typeof t.group === 'string' && t.group.trim()) ? t.group.trim() : 'My Templates',
      kind: t.kind, builtin: false,
      family: isTemplateUid(o.family) ? o.family : newRandomId(),
      version: Number.isInteger(version) && version >= 1 ? version : 1,
      note: cleanTemplateNote(o.note),
      versionId: isTemplateUid(o.versionId) && !TEMPLATES.some(x => x.versionId === o.versionId) ? o.versionId : newRandomId(),
      data
    };
    const origin = cleanItemOrigin(o.origin);
    if(origin) e.origin = origin;
    return e;
  }
  // Makes a new entry fit the library: a family already holding the other kind can't take
  // it (it starts a family of its own); a version number already taken in its family moves
  // to the next free one. Returns true when the number was moved.
  function fitTemplateEntry(e){
    const fam = latestOfFamily(e.family);
    if(fam && fam.kind !== e.kind){ e.family = newRandomId(); return false; }
    if(fam){ e.name = fam.name; e.description = fam.description; e.group = fam.group; }
    if(TEMPLATES.some(x => x.family === e.family && x.version === e.version)){ e.version = nextVersionNumber(e.family); return true; }
    return false;
  }

  // Templates from a file (Open, Import Workspace, Import Templates) join the person's
  // library. Nothing of theirs is replaced or removed:
  //  - a version of a family already here: skipped when its content is the same (under its
  //    number, or under the one an earlier import gave it); added as it is when its number
  //    is free; otherwise added after the file's other versions, as the family's next number,
  //    with a note saying so. The family keeps its name, group and description.
  //  - a family not here: skipped when the same template (name, kind and content) is already
  //    in the library — an older file read twice gets fresh random families each time —
  //    otherwise added, even when a family of that name exists.
  // Returns { added, present, renumbered } (present: skipped because already there;
  // renumbered: added under a new number because theirs was taken).
  function templateFingerprint(name, kind, data){ return name + '\u0000' + kind + '\u0000' + JSON.stringify(data); }
  // Whether a template from a file (`t`, read into the entry `e`) is already in the library,
  // by the rules above: the same content in its family (under the same number or version
  // id), or — for a family not here — the same name, kind and content.
  function templateAlreadyHere(e, t){
    if(TEMPLATES.some(x => x.family === e.family && x.kind === e.kind)){
      const data = JSON.stringify(e.data);
      return TEMPLATES.some(x => x.family === e.family && (x.version === e.version || x.versionId === t.versionId)
        && JSON.stringify(x.data) === data);
    }
    const key = templateFingerprint(e.name, e.kind, e.data);
    return TEMPLATES.some(x => templateFingerprint(x.name, x.kind, x.data) === key);
  }
  function addMissingTemplates(list){
    let added = 0, present = 0, renumbered = 0;
    const clashes = [];
    const add = (e) => {
      const was = e.version;
      if(fitTemplateEntry(e)){
        e.note = cleanTemplateNote(`Imported — was v${was} in the file` + (e.note ? ': ' + e.note : ''));
        renumbered++;
      }
      e.id = 'usr' + (nextTemplateId++);
      TEMPLATES.push(e);
      added++;
    };
    (Array.isArray(list) ? list : []).forEach(t => {
      const e = templateEntryFrom(t);
      if(!e) return;
      const known = TEMPLATES.some(x => x.family === e.family && x.kind === e.kind);
      // Already here: the same content under the same number, or under the number it was
      // given when an earlier import found its number taken (same version id).
      if(templateAlreadyHere(e, t)){ present++; return; }
      // A taken number waits until the file's other versions are in, so those keep theirs.
      if(known && TEMPLATES.some(x => x.family === e.family && x.version === e.version)){ clashes.push(e); return; }
      add(e);
    });
    clashes.forEach(add);
    return { added, present, renumbered };
  }

  // Restoring the autosave keeps every template as it was saved, after the same checks.
  function restoreTemplates(list){
    (Array.isArray(list) ? list : []).forEach(t => {
      const m = t && typeof t.id === 'string' && /^usr(\d+)$/.exec(t.id);
      if(m) nextTemplateId = Math.max(nextTemplateId, Number(m[1]) + 1);
    });
    const taken = new Set(TEMPLATES.map(x => x.id));
    (Array.isArray(list) ? list : []).forEach(t => {
      // (A workspace has always read a kind other than 'system' as a canvas template.)
      const e = templateEntryFrom(t && typeof t === 'object' ? Object.assign({}, t, { kind: templateKindOf(t.kind) }) : t);
      if(!e) return;
      // Every template keeps its own id: new ids continue after the highest saved "usrN",
      // and one whose id is missing or already taken gets a fresh one.
      e.id = (typeof t.id === 'string' && t.id && !taken.has(t.id)) ? t.id : ('usr' + (nextTemplateId++));
      taken.add(e.id);
      fitTemplateEntry(e);
      TEMPLATES.push(e);
    });
  }

  // ---------- Remove duplicates… (a choice of what must match) ----------
  // What two templates must share to count as copies. Kind and the calculation always;
  // the rest per the tick boxes in the window (remembered in the workspace's UI settings).
  // Imports never use this: they skip only exact copies (templateFingerprint).
  const DEDUPE_OPTIONS = [
    { key:'name',        label:'Name', hint:'exactly the same name' },
    { key:'layout',      label:'Layout and formatting', hint:'positions and sizes on the canvas, 🎨 formats, and the format presets inside a system' },
    { key:'group',       label:'Group', hint:'' },
    { key:'description', label:'Description', hint:'' },
  ];

  // JSON text with object keys sorted, so the order keys were written in never matters.
  function stableJSON(v){
    if(Array.isArray(v)) return '[' + v.map(stableJSON).join(',') + ']';
    if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableJSON(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  // A text describing a template's calculation — and its layout too, when `layout` — that
  // leaves out internal ids and counters. Nodes are renumbered in an order worked out from
  // their own content (not their ids); arrows, alias targets and block references follow that
  // renumbering, and canvases are numbered by their place in the list. Equal texts mean the
  // same model; when in doubt (two otherwise identical rectangles wired differently) the
  // texts differ, so templates are only ever treated as the same when they really are.
  function templateLogicKey(t, layout){
    // A recipe is its list of parts (the names shown for them don't count).
    if(t.kind === 'recipe') return stableJSON({ recipe: ((t.data && t.data.parts) || []).map(p => [p.family, p.version, p.versionId || null]) });
    const d = t.data || {};
    const canvases = t.kind === 'system'
      ? (Array.isArray(d.canvases) ? d.canvases : [])
      : [{ id: d.selfCanvasId, name: null, nodes: d.nodes, edges: d.edges }];
    const canvasIndex = new Map();
    canvases.forEach((c, i) => { if(c && c.id !== undefined) canvasIndex.set(c.id, i); });
    const canvasRef = (id) => canvasIndex.has(id) ? 'C' + canvasIndex.get(id) : ['external', id];
    const LAYOUT = new Set(['x', 'y', 'w', 'h', 'style']);
    const REFS = new Set(['id', 'sourceNodeId', 'sourceCanvasId', 'blockDefCanvasId']);
    const own = (n) => {
      const o = {};
      Object.keys(n || {}).forEach(k => { if(!REFS.has(k) && k !== 'plug' && k !== 'plugs' && (layout || !LAYOUT.has(k))) o[k] = n[k]; });
      const plugs = plugsOf(n);                     // the same plugs in any order are the same
      if(plugs.length) o.plugs = plugs.slice().sort();
      if(n && n.blockDefCanvasId !== undefined) o.blockDef = canvasRef(n.blockDefCanvasId);
      return o;
    };
    // Pass 1: number every node by its own content, canvas by canvas.
    const nodeName = new Map(); // canvasIndex + '|' + node id -> canonical name
    const ordered = canvases.map((c, ci) => {
      const nodes = (c && Array.isArray(c.nodes) ? c.nodes : []).map((n, i) => ({ n, i, sig: stableJSON(own(n)) }));
      nodes.sort((a, b) => (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : a.i - b.i));
      nodes.forEach((x, k) => nodeName.set(ci + '|' + (x.n && x.n.id), ci + ':' + k));
      return nodes;
    });
    // Pass 2: each canvas's nodes (with references renamed) and arrows.
    const out = canvases.map((c, ci) => {
      const nodes = ordered[ci].map(({ n }) => {
        const o = own(n);
        if(n && n.sourceNodeId !== undefined){
          const sc = canvasIndex.has(n.sourceCanvasId) ? canvasIndex.get(n.sourceCanvasId) : null;
          o.source = sc !== null && nodeName.has(sc + '|' + n.sourceNodeId)
            ? nodeName.get(sc + '|' + n.sourceNodeId) : ['external', n.sourceCanvasId, n.sourceNodeId];
        }
        return o;
      });
      const edges = (c && Array.isArray(c.edges) ? c.edges : []).map(e => {
        const o = {};
        Object.keys(e || {}).forEach(k => { if(k !== 'id' && k !== 'from' && k !== 'to') o[k] = e[k]; });
        o.from = nodeName.get(ci + '|' + (e && e.from)) || ['missing', e && e.from];
        o.to = nodeName.get(ci + '|' + (e && e.to)) || ['missing', e && e.to];
        return stableJSON(o);
      }).sort();
      return { name: t.kind === 'system' ? (c && c.name) : null, nodes, edges };
    });
    // Everything else in the data, less the internal counters (and formats, unless layout).
    const rest = {};
    const SKIP = new Set(['canvases', 'nodes', 'edges', 'nextId', 'nextCanvasId', 'selfCanvasId', 'activeCanvasId', 'currentPeriod', 'name', 'version', 'kind']);
    Object.keys(d).forEach(k => { if(!SKIP.has(k) && (layout || k !== 'formatPresets')) rest[k] = d[k]; });
    return stableJSON({ canvases: out, rest });
  }

  // Sets of templates that match under `match` (2 or more each), in library order. Each
  // family takes part once, as its latest version; versions of one family are never
  // compared with each other.
  function duplicateTemplateSets(match){
    const sets = new Map();
    templateFamilies().forEach(t => {
      const key = stableJSON([t.kind, match.name ? t.name : null, match.group ? (t.group || '') : null,
        match.description ? (t.description || '') : null, templateLogicKey(t, !!match.layout)]);
      if(!sets.has(key)) sets.set(key, []);
      sets.get(key).push(t);
    });
    return [...sets.values()].filter(s => s.length > 1);
  }

  function showRemoveDuplicatesDialog(onDone){
    if(templateFamilies().length < 2){ showMessage('There are no duplicate templates.'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box dedupe-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      const all = document.querySelectorAll('.modal-overlay');
      if(ev.key === 'Escape' && all[all.length - 1] === overlay){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Remove duplicate templates';
    box.appendChild(title);
    const intro = document.createElement('p');
    intro.className = 'template-desc';
    intro.textContent = 'Templates count as copies when everything ticked below matches, comparing each template\'s latest version. Internal ids and counters are always ignored. Pick which one of each set to keep; removing a template removes all its versions.';
    box.appendChild(intro);

    const opts = document.createElement('div');
    opts.className = 'dedupe-options';
    box.appendChild(opts);
    const addOption = (label, hint, checked, disabled, onChange) => {
      const row = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = checked; cb.disabled = disabled;
      if(onChange) cb.addEventListener('change', () => onChange(cb.checked));
      const txt = document.createElement('span');
      txt.textContent = label;
      row.append(cb, txt);
      if(hint){ const h = document.createElement('span'); h.className = 'dedupe-hint'; h.textContent = ' — ' + hint; row.appendChild(h); }
      opts.appendChild(row);
      return row;
    };
    addOption('Kind (canvas or system)', 'always', true, true);
    addOption('The calculation', 'always: the same rectangles, numbers, operators, blocks, arrows, canvases and periods', true, true);
    DEDUPE_OPTIONS.forEach(o => addOption(o.label, o.hint, !!dedupeMatch[o.key], false, (on) => {
      dedupeMatch[o.key] = on; saveWorkspaceSoon(); render();
    }).dataset.option = o.key);

    const summary = document.createElement('p');
    summary.className = 'dedupe-summary';
    box.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'dedupe-body';
    const setsEl = document.createElement('div');
    setsEl.className = 'dedupe-sets';
    const preview = document.createElement('div');
    preview.className = 'template-preview dedupe-preview';
    body.append(setsEl, preview);
    box.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'danger';
    actions.append(cancelBtn, removeBtn);
    box.appendChild(actions);

    const showPreview = (t) => {
      if(t.kind === 'recipe'){ preview.innerHTML = ''; return; }
      const pc = t.kind === 'system' ? ((t.data.canvases || [])[0] || { nodes: [], edges: [] }) : t.data;
      preview.innerHTML = buildPreviewSVG(pc.nodes || [], pc.edges || []);
    };
    let sets = [], keep = [];
    function render(){
      sets = duplicateTemplateSets(dedupeMatch);
      keep = sets.map(s => s[0]);
      setsEl.innerHTML = '';
      preview.innerHTML = '';
      sets.forEach((s, si) => {
        const setEl = document.createElement('div');
        setEl.className = 'dedupe-set';
        const head = document.createElement('div');
        head.className = 'dedupe-set-head';
        head.textContent = `Set ${si + 1}`;
        setEl.appendChild(head);
        s.forEach(t => {
          const row = document.createElement('label');
          row.className = 'dedupe-row';
          const radio = document.createElement('input');
          radio.type = 'radio'; radio.name = 'dedupe-keep-' + si; radio.checked = keep[si] === t;
          radio.addEventListener('change', () => { keep[si] = t; paint(); });
          const nm = document.createElement('span');
          nm.className = 'dedupe-name';
          nm.textContent = t.name;
          const meta = document.createElement('span');
          meta.className = 'dedupe-meta';
          const older = familyVersions(t.family).length - 1;
          meta.textContent = (t.group || 'Ungrouped') + ' · ' + t.kind + ' · v' + t.version
            + (older ? ` (and ${older} older version${older === 1 ? '' : 's'})` : '');
          const fate = document.createElement('span');
          fate.className = 'dedupe-fate';
          const info = document.createElement('span');
          info.className = 'dedupe-info';
          info.append(nm, meta);
          row.append(radio, info, fate);
          row.addEventListener('mouseenter', () => showPreview(t));
          row._tpl = t; row._set = si;
          setEl.appendChild(row);
        });
        setsEl.appendChild(setEl);
      });
      paint();
    }
    function toRemove(){ return sets.flatMap((s, si) => s.filter(t => t !== keep[si])); }
    function paint(){
      setsEl.querySelectorAll('.dedupe-row').forEach(r => {
        const kept = keep[r._set] === r._tpl;
        r.classList.toggle('remove', !kept);
        r.querySelector('.dedupe-fate').textContent = kept ? 'keep' : 'remove';
      });
      const n = toRemove().length;
      summary.textContent = sets.length
        ? `${sets.length} set${sets.length === 1 ? '' : 's'} of duplicates — ${n} template${n === 1 ? '' : 's'} will be removed.`
        : 'No duplicates with these settings.';
      removeBtn.textContent = `Remove ${n} template${n === 1 ? '' : 's'}`;
      removeBtn.disabled = n === 0;
    }
    removeBtn.addEventListener('click', () => {
      const drop = new Set(toRemove().map(t => t.family)); // whole families, never ids
      if(!drop.size) return;
      TEMPLATES = TEMPLATES.filter(t => !drop.has(t.family));
      saveWorkspace();
      close();
      toast(`Removed ${drop.size} template${drop.size === 1 ? '' : 's'}.`);
      if(onDone) onDone();
    });
    render();
  }

  function clearAllTemplates(onDone){
    const n = templateFamilies().length, v = TEMPLATES.length;
    if(!n){ showMessage("You don't have any templates."); return; }
    showConfirm(`Delete all ${n} template${n === 1 ? '' : 's'}` + (v > n ? ` (${v} versions)` : '') + `? This can't be undone — use ⇩ Export Templates first if you might want them back.`, () => {
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
      version: FILE_FORMATS['fmIDE-templates'].current, kind: 'fmIDE-templates',
      templates: TEMPLATES.map(t => templateRecord(t, false))
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
      const { added, present, renumbered } = addMissingTemplates(data.templates);
      if(added === 0 && present === 0) showMessage("That file didn't contain any templates fmIDE could recognize.");
      else if(added === 0) showMessage(`All ${present} template${present === 1 ? ' in that file is' : 's in that file are'} already in your library.`);
      else showMessage(`Imported ${added} template${added === 1 ? '' : 's'}` + (present ? ` (${present} ${present === 1 ? 'was' : 'were'} already there).` : '.')
        + (renumbered ? ` ${renumbered} ${renumbered === 1 ? 'was' : 'were'} added as a new version because ${renumbered === 1 ? 'its number was' : 'their numbers were'} already taken by a different version.` : ''));
      saveWorkspaceSoon();
      onDone(added);
      });
    };
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  }

  // ---------- recipes (templates of kind "recipe", templates file v3) ----------
  // A recipe lists canvas templates to add together: data = { kind: 'recipe', parts: [
  // { family, version: 'latest' | N, versionId?, name } ] }. A pinned part records the version
  // id it was made with; `name` is only shown when the family isn't in the library. Building
  // adds one canvas per part (each linked to its template, like Add to new canvas); plugs and
  // sockets then connect them by name (syncAutoConnections).
  // RECIPE_MAX_PARTS, templateKindOf and cleanRecipeData (reading recipes from files) are in
  // src/shared/fmide-files.js.

  // A part for the recipe from a library version: pinned to it, or following the latest.
  function recipePartOf(t, pinned){
    const part = { family: t.family, version: pinned ? t.version : 'latest', name: t.name };
    if(pinned) part.versionId = t.versionId;
    return part;
  }
  // How a part stands against the library: { part, template (the version to use, or null),
  // state: 'ok' | 'differs' (pinned number here, but not the same version) | 'missing-version'
  // | 'missing-family' | 'wrong-kind', label (for people) }.
  function recipePartStatus(part){
    const latest = latestOfFamily(part.family);
    const shown = (latest && latest.name) || part.name || 'A part';
    const vText = part.version === 'latest' ? '@latest' : '@' + part.version;
    if(!latest) return { part, template: null, state: 'missing-family', label: `${shown} ${vText} — not in your library` };
    if(latest.kind !== 'module') return { part, template: null, state: 'wrong-kind', label: `${shown} — not a canvas template` };
    if(part.version === 'latest') return { part, template: latest, state: 'ok', label: `${shown} @latest (v${latest.version})` };
    const t = familyVersions(part.family).find(v => v.version === part.version);
    if(!t) return { part, template: null, state: 'missing-version', label: `${shown} v${part.version} — not in your library` };
    if(part.versionId && t.versionId !== part.versionId) return { part, template: t, state: 'differs', label: `${shown} v${part.version} — yours differs from the one this recipe was made with` };
    return { part, template: t, state: 'ok', label: `${shown} v${part.version}` };
  }
  // The versions a recipe would use, as canvases ({ name, nodes }).
  function recipeCanvasList(parts){
    return parts.map(recipePartStatus).filter(st => st.template)
      .map(st => ({ name: st.template.name, nodes: st.template.data.nodes || [] }));
  }
  // Sockets nothing feeds among the versions a recipe would use.
  function recipeUnfedSockets(parts){ return unfedSocketsIn(recipeCanvasList(parts)); }
  // The socket check shown for a recipe: unfed sockets, and sockets more than one plug feeds.
  function recipeCheckText(parts){
    const list = recipeCanvasList(parts);
    const unfed = unfedSocketsIn(list), multi = multiFedSocketsIn(list);
    const lines = [];
    if(unfed.length) lines.push(unfedSocketsText(unfed));
    if(multi.length) lines.push(multiFedSocketsText(multi));
    return { warn: lines.length > 0, text: lines.length ? lines.join('\n') : 'Every socket is fed by a plug in these parts.' };
  }
  function unfedSocketsText(list){
    return 'Sockets nothing feeds: ' + list.map(u => `“${u.socket}” (${u.canvas})`).join(', ') + '.';
  }

  // Builds recipe `t` into the open system (the caller is an action: one undo step).
  // Returns { canvases: [ids], warnings: [text], unfedSockets: [{ canvas, socket }] }.
  function buildRecipe(t){
    const made = [], warnings = [];
    t.data.parts.forEach(part => {
      const st = recipePartStatus(part);
      if(!st.template){ warnings.push(`Skipped ${st.label}.`); return; }
      if(st.state === 'differs') warnings.push(`${st.template.name} v${st.template.version} in your library isn't the one this recipe was made with — built with yours.`);
      applyModuleDataToNewCanvas(cloneData(st.template.data));
      const c = canvases.find(x => x.id === activeCanvasId);
      setCanvasTemplateLink(c, st.template);
      made.push(c.id);
    });
    if(!made.length) fail(`Nothing to build: none of the parts of "${t.name}" is in your library.`);
    syncAutoConnections();
    clearComputed();
    evaluateAll();
    syncActiveIntoRegistry();
    const all = canvases.map(c => ({ name: c.name, nodes: c.nodes }));
    const unfed = unfedSocketsIn(all);
    // Sockets more than one plug feeds, where the build is involved (the socket or a plug
    // is on a canvas it added) — e.g. a part whose canvas was already in the model.
    const newNames = new Set(made.map(id => canvases.find(c => c.id === id).name));
    const multi = multiFedSocketsIn(all).filter(m => newNames.has(m.canvas) || m.sources.some(s => newNames.has(s.split('::')[0])));
    return { canvases: made, warnings, unfedSockets: unfed, multiFedSockets: multi };
  }
  function recipeBuildSummary(t, r){
    const lines = [`Built ${t.name}: ${r.canvases.length} canvas${r.canvases.length === 1 ? '' : 'es'}.`];
    r.warnings.forEach(w => lines.push(w));
    if(r.unfedSockets.length) lines.push(unfedSocketsText(r.unfedSockets));
    if(r.multiFedSockets && r.multiFedSockets.length) lines.push(multiFedSocketsText(r.multiFedSockets));
    return lines.join('\n');
  }

  // Saves a recipe of these parts: a new family, or (newVersionOf) the next version of one.
  function saveRecipeTemplate(opts){
    const base = opts.newVersionOf ? latestOfFamily(opts.newVersionOf.family) : null;
    const t = {
      id: 'usr' + (nextTemplateId++),
      name: base ? base.name : opts.name, description: base ? base.description : (opts.description || ''),
      group: base ? base.group : (opts.group || 'My Templates'), kind: 'recipe', builtin: false,
      family: base ? base.family : newRandomId(), version: base ? nextVersionNumber(base.family) : 1,
      note: cleanTemplateNote(opts.note), versionId: newRandomId(),
      data: { kind: 'recipe', parts: cloneData(opts.parts) }
    };
    TEMPLATES.push(t);
    saveWorkspaceSoon();
    return t;
  }

  // The recipe window: name etc. (new recipe), parts with their version, a live socket check.
  // `from` (a recipe) starts from its parts and saves the next version of it.
  function showRecipeEditor(from, onSaved){
    let parts = from ? cloneData(from.data.parts) : [];
    const modules = () => templateFamilies().filter(f => f.kind === 'module');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box recipe-editor';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      const all = document.querySelectorAll('.modal-overlay');
      if(ev.key === 'Escape' && all[all.length - 1] === overlay){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);

    const title = document.createElement('p');
    title.textContent = from ? `New version of the recipe “${from.name}” (v${nextVersionNumber(from.family)})` : 'New recipe';
    box.appendChild(title);
    const inputStyle = 'width:100%;font-size:13px;padding:6px 8px;border-radius:6px;border:1px solid #d1d5db;font-family:inherit;box-sizing:border-box;';
    const field = (label, el) => {
      const w = document.createElement('label'); w.className = 'recipe-field';
      const l = document.createElement('span'); l.textContent = label;
      el.style.cssText = inputStyle; w.append(l, el); box.appendChild(w); return el;
    };
    let nameIn = null, groupIn = null, descIn = null;
    if(!from){
      nameIn = field('Name', document.createElement('input')); nameIn.className = 'recipe-name';
      groupIn = field('Group', document.createElement('input')); groupIn.value = 'My Templates';
      descIn = field('Description', document.createElement('input'));
    }
    const noteIn = field('Change note', document.createElement('input'));
    noteIn.className = 'recipe-note'; noteIn.maxLength = TEMPLATE_NOTE_MAX; noteIn.placeholder = 'What changed (optional)';

    const head = document.createElement('p'); head.className = 'recipe-parts-head'; head.textContent = 'Parts (canvas templates, added in this order)';
    const list = document.createElement('div'); list.className = 'recipe-parts';
    const addBtn = document.createElement('button'); addBtn.className = 'recipe-add-part'; addBtn.textContent = '+ Add part';
    const check = document.createElement('p'); check.className = 'recipe-check';
    box.append(head, list, addBtn, check);

    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; cancelBtn.addEventListener('click', close);
    const saveBtn = document.createElement('button'); saveBtn.className = 'primary'; saveBtn.textContent = from ? `Save version ${nextVersionNumber(from.family)}` : 'Save Recipe';
    actions.append(cancelBtn, saveBtn);
    box.appendChild(actions);

    function render(){
      list.innerHTML = '';
      parts.forEach((part, i) => {
        const row = document.createElement('div'); row.className = 'recipe-part';
        const fam = document.createElement('select'); fam.className = 'recipe-part-family';
        const fams = modules();
        if(!fams.some(f => f.family === part.family)){
          const o = document.createElement('option'); o.value = part.family; o.textContent = (part.name || 'Unknown') + ' (not in your library)'; fam.appendChild(o);
        }
        fams.forEach(f => { const o = document.createElement('option'); o.value = f.family; o.textContent = f.name; fam.appendChild(o); });
        fam.value = part.family;
        fam.addEventListener('change', () => {
          const f = latestOfFamily(fam.value);
          parts[i] = f ? recipePartOf(f, false) : parts[i];
          render();
        });
        const ver = document.createElement('select'); ver.className = 'recipe-part-version';
        const latestOpt = document.createElement('option'); latestOpt.value = 'latest'; latestOpt.textContent = 'latest'; ver.appendChild(latestOpt);
        familyVersions(part.family).forEach(v => { const o = document.createElement('option'); o.value = String(v.version); o.textContent = 'v' + v.version; ver.appendChild(o); });
        if(part.version !== 'latest' && !familyVersions(part.family).some(v => v.version === part.version)){
          const o = document.createElement('option'); o.value = String(part.version); o.textContent = `v${part.version} (missing)`; ver.appendChild(o);
        }
        ver.value = String(part.version);
        ver.addEventListener('change', () => {
          if(ver.value === 'latest'){ parts[i] = Object.assign({}, part, { version: 'latest' }); delete parts[i].versionId; }
          else {
            const v = familyVersions(part.family).find(x => String(x.version) === ver.value);
            if(v) parts[i] = recipePartOf(v, true);
          }
          render();
        });
        const st = recipePartStatus(part);
        const mark = document.createElement('span'); mark.className = 'recipe-part-state ' + st.state;
        mark.textContent = st.state === 'ok' ? '✓' : '⚠'; mark.title = st.label;
        const btn = (label, cls, fn, disabled) => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
        row.append(fam, ver, mark,
          btn('↑', 'recipe-up', () => { [parts[i - 1], parts[i]] = [parts[i], parts[i - 1]]; render(); }, i === 0),
          btn('↓', 'recipe-down', () => { [parts[i + 1], parts[i]] = [parts[i], parts[i + 1]]; render(); }, i === parts.length - 1),
          btn('✕', 'recipe-remove', () => { parts.splice(i, 1); render(); }));
        list.appendChild(row);
      });
      if(!parts.length){ const p = document.createElement('p'); p.className = 'template-desc'; p.textContent = 'No parts yet.'; list.appendChild(p); }
      addBtn.disabled = !modules().length || parts.length >= RECIPE_MAX_PARTS;
      const chk = recipeCheckText(parts);
      check.classList.toggle('warn', parts.length > 0 && chk.warn);
      check.textContent = !parts.length ? '' : chk.text;
      saveBtn.disabled = !parts.length;
    }
    addBtn.addEventListener('click', () => {
      const used = new Set(parts.map(p => p.family));
      const f = modules().find(x => !used.has(x.family)) || modules()[0];
      if(f){ parts.push(recipePartOf(f, false)); render(); }
    });
    saveBtn.addEventListener('click', () => {
      const note = cleanTemplateNote(noteIn.value);
      if(from){ close(); onSaved(saveRecipeTemplate({ newVersionOf: from, parts, note })); return; }
      const name = nameIn.value.trim();
      if(!name){ nameIn.focus(); return; }
      const other = familiesNamed(name).find(f => f.kind !== 'recipe');
      if(other){ showMessage(`There is already a ${other.kind === 'system' ? 'system' : 'canvas'} template called "${other.name}". Choose another name.`); return; }
      const opts = { name, group: groupIn.value.trim() || 'My Templates', description: descIn.value.trim(), parts, note };
      const taken = familiesNamed(name, 'recipe');
      if(taken.length){
        askNameTaken(taken[0], () => { close(); onSaved(saveRecipeTemplate(Object.assign(opts, { newVersionOf: taken[0] }))); }, () => { nameIn.focus(); nameIn.select(); });
        return;
      }
      close();
      onSaved(saveRecipeTemplate(opts));
    });
    render();
    (nameIn || noteIn).focus();
  }

  // ---------- canvases linked to a canvas template (system v4) ----------
  // A canvas made from a canvas template remembers it: canvas.template = { family, version,
  // versionId, name, skipped? } (name only for display; skipped: a newer version the person
  // chose "Not now" for). Set by "Add to new canvas", by "Add to current canvas" on an empty
  // canvas, and by saving the canvas as a template; adding a template into a canvas with
  // content removes it (the content is mixed). Saved in system files (and so workspaces,
  // documents, the autosave); never in module files.
  function templateLinkOf(t){
    return { family: t.family, version: t.version, versionId: t.versionId, name: t.name };
  }
  // A link read from a file (untrusted): kept only when its ids and version are valid.
  function cleanTemplateLink(l){
    if(!l || typeof l !== 'object' || !isTemplateUid(l.family)) return null;
    const version = Number(l.version);
    if(!Number.isInteger(version) || version < 1) return null;
    const out = { family: l.family, version, versionId: isTemplateUid(l.versionId) ? l.versionId : null,
      name: typeof l.name === 'string' ? l.name.slice(0, 200) : '' };
    const skipped = Number(l.skipped);
    if(Number.isInteger(skipped) && skipped > version) out.skipped = skipped;
    return out;
  }
  function withTemplateLink(c, link){
    const clean = cleanTemplateLink(link);
    if(clean) c.template = clean;
    return c;
  }
  function setCanvasTemplateLink(c, t){
    if(!c) return;
    if(t && t.family && t.kind === 'module') c.template = templateLinkOf(t);
    else delete c.template;
  }
  // The library version a link came from: the same family and version id. (A number alone
  // is not enough: an import may have given that number to different content.)
  function linkedTemplate(link){
    return (link && link.versionId && TEMPLATES.find(t => t.family === link.family && t.versionId === link.versionId)) || null;
  }
  // { state, link, source, latest }: state 'current', 'newer' (a newer version is in the
  // library), 'unknown-version' (the family is here, this version isn't) or 'not-in-library'.
  function templateLinkStatus(c){
    const link = c && c.template;
    if(!link) return null;
    const latest = latestOfFamily(link.family);
    if(!latest || latest.kind !== 'module') return { state: 'not-in-library', link, source: null, latest: null };
    const source = linkedTemplate(link);
    if(!source) return { state: 'unknown-version', link, source: null, latest };
    return { state: latest.version > source.version ? 'newer' : 'current', link, source, latest };
  }
  // The newer version to offer, or null: none, or the person said "Not now" to it.
  function offeredTemplateUpdate(c){
    const st = templateLinkStatus(c);
    if(!st || !st.latest) return null;
    const newer = st.state === 'newer' || (st.state === 'unknown-version' && st.latest.version > st.link.version);
    if(!newer || (st.link.skipped && st.link.skipped >= st.latest.version)) return null;
    return st;
  }
  function templateUpdateText(st){
    return `This canvas came from “${st.link.name || st.latest.name}” v${st.link.version}. Version ${st.latest.version} is available`
      + (st.latest.note ? ` — ‘${st.latest.note}’.` : '.');
  }

  // The bar above the canvas (active canvas only) and the ⬆ marker on canvas tabs. Called
  // from renderCanvasTabs(), which every action and canvas switch ends with.
  function refreshTemplateNotices(){
    canvasTabsEl.querySelectorAll('.canvas-tab').forEach(tab => {
      const c = canvases.find(x => x.id === tab.dataset.id);
      const st = c ? offeredTemplateUpdate(c) : null;
      let mark = tab.querySelector('.template-update-mark');
      if(st && !mark){
        mark = document.createElement('span');
        mark.className = 'template-update-mark';
        mark.textContent = '⬆';
        tab.insertBefore(mark, tab.querySelector('.close-x'));
      }
      if(!st){ if(mark) mark.remove(); }
      else mark.title = templateUpdateText(st);
    });
    const active = canvases.find(c => c.id === activeCanvasId);
    const st = active ? offeredTemplateUpdate(active) : null;
    let bar = document.getElementById('templateUpdateBanner');
    if(!st){ if(bar) bar.remove(); return; }
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'templateUpdateBanner';
      bar.setAttribute('role', 'status');
      const msg = document.createElement('span');
      msg.className = 'template-update-text';
      const update = document.createElement('button');
      update.className = 'template-update-go';
      update.textContent = 'Update this canvas…';
      update.addEventListener('click', () => showUpdateCanvasDialog());
      const later = document.createElement('button');
      later.className = 'template-update-later';
      later.textContent = 'Not now';
      later.addEventListener('click', () => {
        const c = canvases.find(x => x.id === activeCanvasId);
        const s2 = c && offeredTemplateUpdate(c);
        if(s2){ c.template.skipped = s2.latest.version; saveWorkspaceSoon(); }
        refreshTemplateNotices();
      });
      bar.append(msg, update, later);
      document.getElementById('app').insertBefore(bar, document.getElementById('viewport'));
    }
    bar.querySelector('.template-update-text').textContent = templateUpdateText(st);
  }

  // What updating canvas `c` to template version `t` would do, without doing it.
  // Rectangles are matched by name (capitals and outer spaces ignored; a name that appears
  // more than once on either side matches nothing). Matched rectangles keep their ids, so
  // aliases and block ports elsewhere still find them; each input rectangle of the new
  // version keeps the value typed on the canvas when the old one was an input too.
  function planCanvasUpdate(c, t){
    const old = { nodes: c.id === activeCanvasId ? nodes : c.nodes, edges: c.id === activeCanvasId ? edges : c.edges };
    const neu = { nodes: t.data.nodes || [], edges: t.data.edges || [] };
    const byName = (canvas) => {
      const m = new Map(), dup = new Set();
      canvas.nodes.forEach(n => {
        if(!n || n.type !== 'value') return;
        const k = (parseNode(n).name || '').trim().toLowerCase();
        if(!k) return;
        if(m.has(k)) dup.add(k); else m.set(k, n);
      });
      dup.forEach(k => m.delete(k));
      return m;
    };
    const oldByName = byName(old), newByName = byName(neu);
    const keepIds = new Map(), kept = [], dropped = [];
    newByName.forEach((n, k) => {
      const o = oldByName.get(k);
      if(!o) return;
      keepIds.set(n.id, o.id);
      if(isInputRectangle(neu, n) && isInputRectangle(old, o)) kept.push({ from: o, to: n });
    });
    oldByName.forEach((o, k) => {
      if(!isInputRectangle(old, o)) return;
      const n = newByName.get(k);
      if(!n || !isInputRectangle(neu, n)) dropped.push(o);
    });
    const source = linkedTemplate(c.template);
    return { canvas: c, target: t, keepIds, kept, dropped, source,
      ownChanges: source ? canvasDiffersFromTemplate(old, c.id, source) : null };
  }

  // True when the canvas has changes of its own compared with the template version it came
  // from: anything but input values (and positions, sizes, formats) counts.
  function canvasDiffersFromTemplate(old, canvasId, source){
    const strip = (canvas, selfId) => {
      const ns = canvas.nodes.map(n => {
        if(!isInputRectangle(canvas, n)) return n;
        const o = Object.assign({}, n);
        const lines = String(o.text || '').split('\n');
        if(lines.length > 1) lines[1] = '';
        o.text = lines.join('\n');
        delete o.periodValues; delete o.periodValuesRange; delete o.literalPeriods;
        return o;
      });
      return { kind: 'module', data: { selfCanvasId: selfId, nodes: ns, edges: canvas.edges.filter(e => !e.auto) } };
    };
    const srcCanvas = { nodes: source.data.nodes || [], edges: source.data.edges || [] };
    return templateLogicKey(strip(old, canvasId), false) !== templateLogicKey(strip(srcCanvas, source.data.selfCanvasId), false);
  }

  // Replaces the canvas's content with the planned version's. The caller has pushed history.
  // Returns { kept, lostAliases }.
  function applyCanvasUpdate(plan){
    const c = plan.canvas;
    if(c.id !== activeCanvasId){
      syncActiveIntoRegistry();
      activeCanvasId = c.id;
      loadCanvasState(c);
    }
    nodes = []; edges = [];
    applyModuleDataDirect(cloneData(plan.target.data), plan.keepIds);
    plan.kept.forEach(({ from, to }) => {
      const n = nodes.find(x => x.id === plan.keepIds.get(to.id));
      if(!n) return;
      const lines = String(n.text || '').split('\n');
      const oldValue = String(from.text || '').split('\n')[1];
      while(lines.length < 2) lines.push('');
      lines[1] = oldValue === undefined ? '' : oldValue;
      n.text = lines.join('\n');
      ['periodValues', 'periodValuesRange', 'literalPeriods'].forEach(k => {
        if(from[k] !== undefined) n[k] = cloneData(from[k]); else delete n[k];
      });
      if(Array.isArray(n.periodValues)) n.periodValues = padPeriodValuesArray(n.periodValues, periods.length);
    });
    syncAutoConnections();
    clearComputed();
    evaluateAll();
    syncActiveIntoRegistry();
    setCanvasTemplateLink(c, plan.target);
    const ids = new Set(nodes.map(n => n.id));
    const lostAliases = [];
    canvases.forEach(o => {
      if(o === c) return;
      o.nodes.forEach(n => {
        if(n.type === 'alias' && n.sourceCanvasId === c.id && !ids.has(n.sourceNodeId)) lostAliases.push(o.name);
      });
    });
    return { kept: plan.kept.length, lostAliases };
  }

  // "Update this canvas…": choose a version, see what happens, then Update (one undo step).
  function showUpdateCanvasDialog(canvasRef){
    const c = canvasRef || canvases.find(x => x.id === activeCanvasId);
    const st = templateLinkStatus(c);
    if(!st){ showMessage("This canvas wasn't made from a canvas template."); return; }
    if(!st.latest){ showMessage(`This canvas came from “${st.link.name}” v${st.link.version}, which isn't in your template library.`); return; }
    const versions = familyVersions(st.latest.family);
    let target = st.latest;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box template-update-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      const all = document.querySelectorAll('.modal-overlay');
      if(ev.key === 'Escape' && all[all.length - 1] === overlay){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = `Update “${c.name}” from its template`;
    box.appendChild(title);
    const pickRow = document.createElement('label');
    pickRow.className = 'template-update-pick';
    pickRow.append(document.createTextNode(`${st.latest.name}: v${st.link.version} → `));
    const pick = document.createElement('select');
    versions.forEach(v => {
      const o = document.createElement('option');
      o.value = String(v.version);
      o.textContent = 'v' + v.version + (v === st.latest ? ' (latest)' : '') + (v === st.source ? ' (this canvas)' : '');
      pick.appendChild(o);
    });
    pickRow.appendChild(pick);
    box.appendChild(pickRow);
    const body = document.createElement('div');
    body.className = 'template-update-body';
    box.appendChild(body);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    const goBtn = document.createElement('button');
    goBtn.className = 'primary';
    goBtn.textContent = 'Update';
    actions.append(cancelBtn, goBtn);
    box.appendChild(actions);

    const line = (text, cls) => { const p = document.createElement('p'); p.className = cls || 'template-desc'; p.textContent = text; body.appendChild(p); return p; };
    const nameList = (list) => list.map(x => (parseNode(x).name || '').trim()).join(', ');
    function paint(){
      body.innerHTML = '';
      const plan = planCanvasUpdate(c, target);
      const fromV = st.source ? st.source.version : st.link.version;
      // Where the chosen version came from (phase 8b): a version from someone's library pack says so.
      if(target.origin) line(`v${target.version}: ${originText(target.origin)}.`, 'template-origin template-update-origin');
      const between = versions.filter(v => v.version > Math.min(fromV, target.version) && v.version <= Math.max(fromV, target.version) && v.note);
      if(between.length){
        const ul = document.createElement('ul');
        ul.className = 'template-update-notes';
        between.forEach(v => { const li = document.createElement('li'); li.textContent = `v${v.version} — ${v.note}`; ul.appendChild(li); });
        line(target.version >= fromV ? 'What changed:' : 'Going back past:');
        body.appendChild(ul);
      }
      line(plan.kept.length ? `Input values kept: ${nameList(plan.kept.map(k => k.from))} (${plan.kept.length})` : 'No input values to keep.', 'template-update-kept');
      if(plan.dropped.length) line(`Not in v${target.version} (values dropped): ${nameList(plan.dropped)}`, 'template-update-dropped');
      if(plan.ownChanges === null) line(`The version this canvas came from (v${st.link.version}) isn't in your library, so fmIDE can't check for changes of your own. Updating replaces everything on the canvas except the input values above; Undo brings it back.`, 'template-update-warning');
      else if(plan.ownChanges) line(`This canvas has changes of its own since v${fromV} was added. Updating replaces them; Undo brings them back.`, 'template-update-warning');
      else line('Everything else on the canvas is replaced by the new version. Undo brings it back.');
    }
    pick.value = String(target.version);
    pick.addEventListener('change', () => { target = versions.find(v => String(v.version) === pick.value) || st.latest; paint(); });
    goBtn.addEventListener('click', () => {
      close();
      guarded(() => {
        const r = fm.updateCanvasFromTemplate({ canvas: '#' + c.id, version: String(target.version) });
        if(r) showMessage(updateSummary(r));
      });
    });
    paint();
    goBtn.focus();
  }
  function updateSummary(r){
    let text = `Updated to v${r.version}. Kept ${r.kept} input value${r.kept === 1 ? '' : 's'}.`;
    if(r.lostAliases.length) text += ` ${r.lostAliases.length} alias${r.lostAliases.length === 1 ? '' : 'es'} on other canvases lost what ${r.lostAliases.length === 1 ? 'it' : 'they'} pointed to (on ${Array.from(new Set(r.lostAliases)).join(', ')}).`;
    return text;
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
    box.className = 'modal-box template-box format-presets-box';
    makeResizableWindow(box, 'formatPresets');
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
    makeResizableWindow(box, 'templates');
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
    const newRecipeBtn = document.createElement('button');
    newRecipeBtn.className = 'template-new-recipe';
    newRecipeBtn.textContent = '+ New Recipe…';
    newRecipeBtn.title = 'A recipe adds several canvas templates together; their plugs and sockets connect them.';
    saveRow.appendChild(saveCanvasBtn);
    saveRow.appendChild(saveSystemBtn);
    saveRow.appendChild(newRecipeBtn);
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
    dedupeBtn.addEventListener('click', () => showRemoveDuplicatesDialog(() => {
      if(selected && !TEMPLATES.includes(selected)) selected = templateFamilies()[0] || null;
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

    let selected = templateFamilies()[0] || null;
    let previewCanvasIdx = 0;
    const expanded = new Set(); // families whose older versions are showing

    saveCanvasBtn.addEventListener('click', () => {
      saveCurrentCanvasAsTemplate((newTpl) => { selected = newTpl; previewCanvasIdx = 0; renderList(); renderDetail(); });
    });
    newRecipeBtn.addEventListener('click', () => {
      showRecipeEditor(null, (newTpl) => { selected = newTpl; previewCanvasIdx = 0; renderList(); renderDetail(); });
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
      if(t.kind === 'recipe'){
        guarded(() => { const r = fm.insertTemplate(t.id, 'add'); if(r) showMessage(recipeBuildSummary(t, r)); });
        return;
      }
      const collisions = (t.data.canvases || [])
        .filter(c => canvases.some(ec => ec.name.trim().toLowerCase() === (c.name || '').trim().toLowerCase()))
        .map(c => ({ name: c.name || 'Canvas' }));
      if(collisions.length === 0) guarded(() => fm.insertTemplate(t.id, 'add'));
      else showCanvasMergeDecisionModal(collisions, (decisions) => guarded(() => fm.insertTemplate({ template: t.id, mode: 'add', decisions })));
    }

    // A recipe: its parts (with how each stands against the library), the socket check,
    // and Build / Edit as new version / Edit info / Delete.
    function renderRecipeDetail(all){
      const ul = document.createElement('ul');
      ul.className = 'recipe-detail-parts';
      selected.data.parts.forEach(part => {
        const st = recipePartStatus(part);
        const li = document.createElement('li');
        li.className = 'recipe-part-state ' + st.state;
        li.textContent = (st.state === 'ok' ? '✓ ' : '⚠ ') + st.label;
        ul.appendChild(li);
      });
      detail.appendChild(ul);
      const chk = recipeCheckText(selected.data.parts);
      const check = document.createElement('p');
      check.className = 'recipe-check' + (chk.warn ? ' warn' : '');
      check.textContent = chk.text;
      detail.appendChild(check);
      const actionsRow = document.createElement('div');
      actionsRow.className = 'template-import-actions';
      const buildBtn = document.createElement('button');
      buildBtn.className = 'primary recipe-build';
      buildBtn.textContent = 'Build (add canvases)';
      buildBtn.addEventListener('click', runMain);
      const editBtn = document.createElement('button');
      editBtn.className = 'recipe-edit';
      editBtn.textContent = 'Edit as new version…';
      editBtn.addEventListener('click', () => showRecipeEditor(selected, (t) => { selected = t; renderList(); renderDetail(); }));
      const infoBtn = document.createElement('button');
      infoBtn.textContent = '✎ Edit info';
      infoBtn.addEventListener('click', () => editTemplateMeta(selected, () => { renderList(); renderDetail(); }));
      const delBtn = document.createElement('button');
      delBtn.className = 'template-delete';
      const latest = isLatestVersion(selected);
      delBtn.textContent = !latest ? `🗑 Delete version ${selected.version}` : (all.length > 1 ? `🗑 Delete (all ${all.length} versions)` : '🗑 Delete');
      delBtn.addEventListener('click', () => deleteTemplate(selected, () => {
        const left = TEMPLATES.includes(selected) ? selected : latestOfFamily(selected.family);
        selected = left || templateFamilies()[0] || null; renderList(); renderDetail();
      }));
      actionsRow.append(buildBtn, editBtn, infoBtn, delBtn);
      detail.appendChild(actionsRow);
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
      const all = familyVersions(selected.family);
      const ver = document.createElement('p');
      ver.className = 'template-version-info';
      const verLabel = document.createElement('b');
      verLabel.textContent = `Version ${selected.version}` + (all.length > 1 ? ` of ${all[0].version}` : '');
      ver.appendChild(verLabel);
      if(!isLatestVersion(selected)) ver.appendChild(document.createTextNode(' (an older version)'));
      if(selected.note){
        const note = document.createElement('span');
        note.className = 'template-note';
        note.textContent = ' — ' + selected.note;
        ver.appendChild(note);
      }
      detail.appendChild(ver);
      appendOriginLines(detail, selected, all);
      const desc = document.createElement('p');
      desc.className = 'template-desc';
      desc.textContent = selected.description || '(no description)';
      detail.appendChild(desc);

      const data = selected.data;
      if(selected.kind === 'recipe'){ renderRecipeDetail(all); return; }
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
        const versionBtn = document.createElement('button');
        versionBtn.className = 'template-save-version';
        versionBtn.textContent = '⤴ Save as new version';
        versionBtn.title = `Save the open ${selected.kind === 'system' ? 'system' : 'canvas'} as version ${nextVersionNumber(selected.family)} of this template`;
        versionBtn.addEventListener('click', () => saveNewVersionOf(selected, (t) => {
          selected = t; previewCanvasIdx = 0; renderList(); renderDetail();
        }));
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎ Edit info';
        editBtn.addEventListener('click', () => editTemplateMeta(selected, () => { renderList(); renderDetail(); }));
        const delBtn = document.createElement('button');
        delBtn.className = 'template-delete';
        const latest = isLatestVersion(selected);
        delBtn.textContent = !latest ? `🗑 Delete version ${selected.version}`
          : (all.length > 1 ? `🗑 Delete (all ${all.length} versions)` : '🗑 Delete');
        if(latest && all.length > 1) delBtn.title = 'The latest version can only be deleted with the whole template, so its number is never used again. Older versions can be deleted one by one.';
        delBtn.addEventListener('click', () => deleteTemplate(selected, () => {
          const left = TEMPLATES.includes(selected) ? selected : latestOfFamily(selected.family);
          selected = left || templateFamilies()[0] || null; previewCanvasIdx = 0; renderList(); renderDetail();
        }));
        actionsRow.appendChild(versionBtn);
        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(delBtn);
      }
      detail.appendChild(actionsRow);
    }

    // One entry per family (its latest version); a family with older versions gets a
    // "▸ N older versions" toggle, and when open, one entry per older version, newest first.
    function templateButton(t, idx, groupName, into){
      into = into || list;
      const b = document.createElement('button');
      b.className = 'template-family' + (selected === t ? ' active' : '');
      b.appendChild(idx ? highlightLabel(t.name, idx) : document.createTextNode(t.name));
      b.appendChild(document.createElement('br'));
      const kind = t.kind;
      const tag = document.createElement('span');
      tag.className = 'kind-tag ' + kind;
      tag.textContent = kind;
      b.appendChild(tag);
      const v = document.createElement('span');
      v.className = 'template-version-tag';
      v.textContent = 'v' + t.version;
      b.appendChild(v);
      if(groupName){
        const g = document.createElement('span');
        g.className = 'template-group-tag';
        g.textContent = groupName;
        b.appendChild(g);
      }
      b.addEventListener('click', () => { selected = t; previewCanvasIdx = 0; renderList(); renderDetail(); });
      into.appendChild(b);
      shown.push(t);
      const older = familyVersions(t.family).slice(1);
      if(!older.length) return;
      const open = expanded.has(t.family) || (selected && selected.family === t.family && selected !== t);
      const toggle = document.createElement('button');
      toggle.className = 'template-versions-toggle';
      toggle.textContent = (open ? '▾ ' : '▸ ') + older.length + ' older version' + (older.length === 1 ? '' : 's');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.addEventListener('click', () => {
        if(open){
          expanded.delete(t.family);
          if(selected && selected.family === t.family) selected = t;
        } else expanded.add(t.family);
        renderList(); renderDetail();
      });
      into.appendChild(toggle);
      if(!open) return;
      older.forEach(o => {
        const ob = document.createElement('button');
        ob.className = 'template-version' + (selected === o ? ' active' : '');
        const label = document.createElement('b');
        label.textContent = 'v' + o.version;
        ob.appendChild(label);
        if(o.note) ob.appendChild(document.createTextNode(' — ' + o.note));
        ob.addEventListener('click', () => { selected = o; expanded.add(t.family); previewCanvasIdx = 0; renderList(); renderDetail(); });
        into.appendChild(ob);
        shown.push(o);
      });
    }

    function renderList(){
      const families = templateFamilies();
      dedupeBtn.textContent = '🧹 Remove duplicates…';
      dedupeBtn.style.display = families.length > 1 ? '' : 'none';
      clearBtn.style.display = TEMPLATES.length ? '' : 'none';
      list.innerHTML = '';
      shown = [];
      if(families.length === 0){
        const empty = document.createElement('p');
        empty.className = 'template-desc';
        empty.textContent = 'No templates yet — use "+ Save Canvas as Template" / "+ Save System as Template" above, or import some.';
        list.appendChild(empty);
        return;
      }
      const q = search.value.trim();
      if(q){
        // Name first; group and description only when the name doesn't match.
        const hits = families.map(t => {
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
        hits.forEach(h => templateButton(h.t, h.idx, h.t.group || 'Ungrouped'));
        return;
      }
      const groups = {};
      families.forEach(t => {
        const g = t.group || 'Ungrouped';
        (groups[g] = groups[g] || []).push(t);
      });
      // A tree: each group opens and closes (remembered in the UI settings); its templates
      // sit under it. A search shows every match, whatever is closed.
      Object.keys(groups).forEach(g => {
        const closed = templateGroupsClosed.includes(g);
        const header = document.createElement('div');
        header.className = 'template-group-toggle';
        header.setAttribute('role', 'button');
        header.tabIndex = 0;
        header.setAttribute('aria-expanded', String(!closed));
        header.appendChild(document.createTextNode((closed ? '▸ ' : '▾ ') + g));
        const count = document.createElement('span');
        count.className = 'template-group-count';
        count.textContent = '(' + groups[g].length + ')';
        header.appendChild(count);
        const toggleGroup = () => {
          templateGroupsClosed = closed ? templateGroupsClosed.filter(x => x !== g) : templateGroupsClosed.concat([g]);
          saveWorkspaceSoon();
          renderList();
        };
        header.addEventListener('click', toggleGroup);
        header.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); toggleGroup(); } });
        list.appendChild(header);
        if(closed) return;
        const items = document.createElement('div');
        items.className = 'template-group-items';
        list.appendChild(items);
        groups[g].forEach(t => templateButton(t, null, null, items));
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

