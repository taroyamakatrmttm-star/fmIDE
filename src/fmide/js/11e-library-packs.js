  // ---------- library packs (step 8, phase 8a; docs/file-formats.md) ----------
  // A library pack is a file of templates, recipes and functions to share. Save as Library
  // Pack… writes one from your library, with what each item needs (a recipe's parts, the
  // functions a function calls). Open Library Pack… shows what a pack holds, who made it and
  // its licence, and adds only what you tick, by the usual import rules (addMissingTemplates,
  // addMissingFunctions): nothing of yours is replaced. Everything in a pack is someone
  // else's text, shown with textContent only and never run.
  // build:include shared/library-pack.js

  // ---------- where items came from (phase 8b) ----------
  // The lines the Templates window and the Functions manager show for `selected` (a template
  // or function version) among `versions` (its family): where this version came from, and —
  // when the family's versions came from different places — where each did. Plain text.
  function originLines(selected, versions){
    const lines = [];
    if(selected.origin) lines.push(originText(selected.origin) + '.');
    const key = (v) => v.origin ? v.origin.packId + '\u0000' + v.origin.author : '';
    if(new Set(versions.map(key)).size > 1){
      const groups = [];
      versions.slice().sort((a, b) => a.version - b.version).forEach(v => {
        const g = groups.find(x => x.key === key(v));
        if(g) g.versions.push(v.version); else groups.push({ key: key(v), origin: v.origin, versions: [v.version] });
      });
      lines.push('Versions: ' + groups.map(g => g.versions.map(n => 'v' + n).join(', ') + ' '
        + (g.origin ? `from “${g.origin.packTitle}” by ${g.origin.author}` : 'yours')).join(' · ') + '.');
    }
    return lines;
  }
  function appendOriginLines(box, selected, versions){
    originLines(selected, versions).forEach(text => {
      const p = document.createElement('p');
      p.className = 'template-origin';
      p.textContent = text;
      box.appendChild(p);
    });
  }

  // ---------- writing a pack ----------
  // The versions a pack needs for `templates` and `functions` (library entries): each
  // recipe's parts (the version the recipe would build with) and every function a function
  // calls. A recipe part that isn't in the library fails: the pack would be broken.
  function libraryPackContents(templates, functions){
    const tList = [], fList = [];
    const addT = (t) => { if(!tList.includes(t)) tList.push(t); };
    templates.forEach(t => {
      addT(t);
      if(t.kind !== 'recipe') return;
      t.data.parts.forEach(part => {
        const st = recipePartStatus(part);
        if(!st.template) fail(`The recipe "${t.name}" needs a part your library doesn't have (${st.label}), so it can't be shared.`);
        addT(st.template);
      });
    });
    functions.forEach(d => functionWithCallees(d).forEach(x => { if(!fList.includes(x)) fList.push(x); }));
    return { templates: tList, functions: fList };
  }
  // The file: { kind, version, pack, templates, functions }. `info` is what the person typed
  // (title, author, description, tags); the pack gets a new random id and today's date.
  function libraryPackPayload(info, templates, functions){
    const today = new Date();
    const created = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if(!packText(info.title, LIBRARY_PACK_LIMITS.title)) fail('Give the pack a title.');
    if(!packText(info.author, LIBRARY_PACK_LIMITS.author)) fail('Give your name as the author.');
    const read = cleanLibraryPackInfo(Object.assign({}, info, { id: newRandomId(), licence: 'CC-BY-4.0', created }));
    const c = libraryPackContents(templates, functions);
    if(!c.templates.length && !c.functions.length) fail('Choose at least one template, recipe or function to put in the pack.');
    return { kind: 'fmIDE-library-pack', version: FILE_FORMATS['fmIDE-library-pack'].current, pack: read.info,
      templates: c.templates.map(t => cloneData(templateRecord(t, false))), functions: cloneData(c.functions) };
  }
  // A file name from the pack's title: "Three Statements" → "Three-Statements.fmide-pack.json".
  function libraryPackFileName(title){
    const base = String(title).replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
    return (base || 'library-pack') + '.fmide-pack.json';
  }

  // ---------- reading a pack ----------
  // A pack file (parsed JSON) read and checked (readLibraryPackData, src/shared/fmide-files.js,
  // which the library's checker uses too): { pack, templates, functions, newer } or fails
  // with a message for people.
  function readLibraryPack(raw){
    const r = readLibraryPackData(raw);
    if(r.error) fail(r.error);
    return r;
  }
  const TEMPLATE_KIND_WORDS = { module: 'canvas template', system: 'system template', recipe: 'recipe' };
  // The family rule (phase 8b): a pack adding a version to a family you have is warned about
  // when any version of that family came from another author, or has no record of where it
  // came from (your own work, or added before fmIDE kept records). Always compared with the
  // pack's author, never with an author an item in the pack claims — a pack could otherwise
  // label its items with the family's author. `versions`: your versions of the family;
  // `label`: how to name it (“Income Statement”). Returns { warning, warningKind } or null.
  function familyAuthorWarning(versions, pack, label){
    const others = [];
    versions.forEach(v => { if(v.origin && !sameAuthorName(v.origin.author, pack.author) && !others.some(o => sameAuthorName(o.author, v.origin.author))) others.push(v.origin); });
    if(others.length){
      const from = others.map(o => `${o.author} (the pack “${o.packTitle}”)`).join(' and ');
      return { warningKind: 'other-author', warning: `Your ${label} came from ${from}; this pack is by ${pack.author}.` };
    }
    if(versions.some(v => !v.origin)){
      return { warningKind: 'own', warning: `Your ${label} is your own (or has no record of where it came from); this pack by ${pack.author} would add a version to it.` };
    }
    return null;
  }
  // The origin an item gets when added from a pack: the one it carries (it was shared before,
  // in another pack — keeping its author's credit) or else this pack's.
  function packItemOrigin(raw, pack){ return cleanItemOrigin(raw && raw.origin) || originFromPack(pack); }
  // What each item in a pack would do to your library: [{ key ('t0', 'f1' — the order in the
  // file), type ('template' | 'function'), kind, name, version, description, note, status,
  // statusText, needs (keys of the items it brings along) }]. status: 'present' (already in
  // your library), 'new-version' (adds a version to a template or function you have), 'same-name'
  // (a different one of yours has this name; both are kept), 'new'. origin: where the item
  // came from before this pack (an item shared again), else null. warning / warningKind
  // ('other-author' | 'own'): the family rule (familyAuthorWarning), for 'new-version' only.
  function libraryPackItems(read){
    const items = [];
    const tEntries = read.templates.map(t => ({ t, e: templateEntryFrom(t) }));
    tEntries.forEach(({ t, e }, i) => {
      if(!e) return;
      const item = { key: 't' + i, type: 'template', kind: e.kind, name: e.name, version: e.version,
        description: e.description, note: e.note, group: e.group, needs: [], origin: e.origin || null, warning: null, warningKind: null };
      const mine = latestOfFamily(e.family);
      if(templateAlreadyHere(e, t)){ item.status = 'present'; item.statusText = 'Already in your library'; }
      else if(mine && mine.kind === e.kind){
        item.status = 'new-version';
        item.statusText = `Adds a version to your “${mine.name}” (you have up to v${mine.version})` + (mine.name !== e.name ? ` — the pack calls it “${e.name}”` : '');
        Object.assign(item, familyAuthorWarning(familyVersions(e.family), read.pack, `“${mine.name}”`));
      } else if(familiesNamed(e.name, e.kind).length){
        item.status = 'same-name'; item.statusText = `You have a different ${TEMPLATE_KIND_WORDS[e.kind]} called “${e.name}” — both will be kept`;
      } else { item.status = 'new'; item.statusText = 'New'; }
      if(e.kind === 'recipe') e.data.parts.forEach(part => {
        // The part's version in the pack: the one pinned (by version id, else number), or its latest.
        const hits = tEntries.map((x, j) => ({ x, j })).filter(({ x }) => x.e && x.e.family === part.family);
        let hit = null;
        if(part.version === 'latest') hit = hits.sort((a, b) => b.x.e.version - a.x.e.version)[0];
        else hit = hits.find(({ x }) => part.versionId && x.t.versionId === part.versionId) || hits.find(({ x }) => x.e.version === part.version);
        if(hit && !item.needs.includes('t' + hit.j)) item.needs.push('t' + hit.j);
      });
      items.push(item);
    });
    read.functions.forEach((d, i) => {
      const name = functionLabel(d);
      const item = { key: 'f' + i, type: 'function', kind: 'function', name, version: d.version,
        description: d.description, note: d.note, text: d.text, needs: [], origin: d.origin || null, warning: null, warningKind: null };
      const mine = latestFunctionOf(d.family);
      if(functionAlreadyHere(d)){ item.status = 'present'; item.statusText = 'Already in your library'; }
      else if(mine){
        item.status = 'new-version';
        item.statusText = `Adds a version to your ${functionLabel(mine)} (you have up to v${mine.version})`;
        Object.assign(item, familyAuthorWarning(functionFamilyVersions(d.family), read.pack, functionLabel(mine)));
      } else if(functionFamiliesNamed(name).length){
        item.status = 'same-name'; item.statusText = `You have a different function called ${name} — both will be kept`;
      } else { item.status = 'new'; item.statusText = 'New'; }
      d.calls.forEach(c => {
        const j = read.functions.findIndex(x => x.family === c.family && (c.versionId ? x.versionId === c.versionId : x.version === c.version));
        if(j >= 0 && !item.needs.includes('f' + j)) item.needs.push('f' + j);
      });
      items.push(item);
    });
    return items;
  }
  // `keys` and everything they need, directly or not.
  function libraryPackWithNeeds(items, keys){
    const byKey = new Map(items.map(it => [it.key, it]));
    const out = new Set();
    const visit = (k) => { const it = byKey.get(k); if(!it || out.has(k)) return; out.add(k); it.needs.forEach(visit); };
    keys.forEach(visit);
    return out;
  }
  // Adds the chosen items (keys; null for all) and what they need to the library, each
  // remembering where it came from (packItemOrigin). Returns
  // { templates: { added, present, renumbered }, functions: { … } }.
  function addFromLibraryPack(read, keys){
    const items = libraryPackItems(read);
    const known = new Set(items.map(it => it.key));
    (keys || []).forEach(k => { if(!known.has(k)) fail(`This pack has no item "${String(k).slice(0, 40)}" (its items are ${items.map(it => it.key).join(', ')}).`); });
    const chosen = libraryPackWithNeeds(items, keys || items.map(it => it.key));
    const templates = read.templates.filter((t, i) => chosen.has('t' + i)).map(t => Object.assign({}, t, { origin: packItemOrigin(t, read.pack) }));
    const functions = read.functions.filter((d, i) => chosen.has('f' + i)).map(d => Object.assign({}, d, { origin: packItemOrigin(d, read.pack) }));
    const out = { templates: addMissingTemplates(templates), functions: addMissingFunctions(functions) };
    saveWorkspaceSoon();
    return out;
  }

  // ---------- Save as Library Pack… ----------
  let libraryAuthor = '';   // remembered in the UI settings, so the name is typed once
  function packField(box, label, el){
    const l = document.createElement('label');
    l.className = 'fn-editor-label';
    l.textContent = label;
    box.append(l, el);
    return el;
  }
  function showSaveLibraryPack(){
    const families = templateFamilies(), fnFamilies = functionFamilies();
    if(!families.length && !fnFamilies.length){ showMessage("Your library has no templates or functions to share yet."); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box library-pack-save';
    addWindowHelp(box, 'library-packs');
    const intro = document.createElement('p');
    intro.textContent = 'Save as Library Pack — one file of templates, recipes and functions to share. What they need comes along: a recipe\'s parts and the functions a function calls. Each goes in as its latest version.';
    box.appendChild(intro);
    const input = (cls, value) => { const i = document.createElement('input'); i.type = 'text'; i.className = 'fn-editor-note ' + cls; i.value = value || ''; return i; };
    const title = packField(box, 'Title', input('pack-title'));
    title.maxLength = LIBRARY_PACK_LIMITS.title;
    const author = packField(box, 'Author (your name, as others will see it)', input('pack-author', libraryAuthor));
    author.maxLength = LIBRARY_PACK_LIMITS.author;
    const desc = document.createElement('textarea');
    desc.className = 'fn-editor-description pack-description';
    desc.rows = 3;
    desc.maxLength = LIBRARY_PACK_LIMITS.description;
    packField(box, 'Description', desc);
    const tags = packField(box, 'Tags (separated by commas, e.g. statements, tax)', input('pack-tags'));
    const lic = LIBRARY_PACK_LICENCES['CC-BY-4.0'];
    const licence = document.createElement('p');
    licence.className = 'library-pack-licence';
    licence.textContent = `Licence: ${lic.short} (${lic.name}) — ${lic.summary}. Share only what is yours to share.`;
    box.appendChild(licence);
    const ticks = [];
    const list = (heading, entries, labelOf) => {
      if(!entries.length) return;
      const h = document.createElement('p');
      h.className = 'library-pack-heading';
      h.textContent = heading;
      box.appendChild(h);
      entries.forEach(x => {
        const row = document.createElement('label');
        row.className = 'function-export-row library-pack-pick';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        row.append(cb, document.createTextNode(' ' + labelOf(x)));
        box.appendChild(row);
        ticks.push({ x, cb });
      });
    };
    // A version that came from someone's pack says so: it keeps that credit in your pack.
    const from = (x) => x.origin ? ` — from ${x.origin.author}'s pack “${x.origin.packTitle}”` : '';
    list('Templates and recipes', families, t => `${t.name} (${TEMPLATE_KIND_WORDS[t.kind]}, v${t.version})` + from(t));
    list('Functions', fnFamilies, f => `${functionLabel(f)} (v${f.version})` + from(f));
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = 'primary';
    okBtn.textContent = 'Save Pack';
    actions.append(cancelBtn, okBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const picked = ticks.filter(t => t.cb.checked).map(t => t.x);
      const ref = (x) => x.family + '@' + x.version;
      const out = guarded(() => fm.saveLibraryPack({ title: title.value, author: author.value, description: desc.value, tags: packTags(tags.value),
        templates: picked.filter(x => TEMPLATES.includes(x)).map(ref), functions: picked.filter(x => FUNCTIONS.includes(x)).map(ref) }));
      if(out) close();
    });
    title.focus();
  }

  // ---------- Open Library Pack… ----------
  function pickLibraryPackFile(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.className = 'library-pack-file-input';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => openFmFileText(String(reader.result), ['fmIDE-library-pack'], (data) => {
        const read = guarded(() => readLibraryPack(data));
        if(read) showLibraryPackPreview(read, data);
      });
      reader.onerror = () => showMessage('Could not read that file.');
      reader.readAsText(file);
    });
    input.click();
  }
  // The preview: who made the pack, its licence, and each item with what adding it would do.
  // Nothing is added until "Add to My Library". onAdded (optional): called after adding
  // (Browse Library refreshes its "In your library" marks).
  function showLibraryPackPreview(read, file, onAdded){
    const items = libraryPackItems(read);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box library-pack-preview';
    addWindowHelp(box, 'library-packs');
    makeResizableWindow(box, 'libraryPack');
    const para = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; box.appendChild(p); return p; };
    para('library-pack-title', read.pack.title);
    const lic = LIBRARY_PACK_LICENCES[read.pack.licence];
    para('library-pack-by', `By ${read.pack.author} · ${lic.short}` + (read.pack.created ? ` · ${read.pack.created}` : ''));
    if(read.pack.description) para('library-pack-description', read.pack.description);
    if(read.pack.tags.length) para('library-pack-tags', 'Tags: ' + read.pack.tags.join(', '));
    para('library-pack-licence', `Licence: ${lic.name} — ${lic.summary}. Credit: ${read.pack.author}.`);
    if(items.some(it => it.status === 'new-version')) {
      para('library-pack-caution', 'Some items add a version to a template or function you already have. Canvases made from those templates will then offer it as an update — add them only if you trust where this pack came from.');
    }
    if(items.some(it => it.warning)) {
      para('library-pack-warning', `⚠ Some items would add a version to a template or function that came from someone other than ${read.pack.author}, or that you made. They are not ticked: tick them only if you trust this pack.`);
    }
    if(!items.length) para('library-pack-empty', 'This pack has nothing fmIDE could read.');
    const rows = new Map();
    const section = (heading, list) => {
      if(!list.length) return;
      para('library-pack-heading', heading);
      list.forEach(it => {
        const row = document.createElement('label');
        row.className = 'library-pack-item ' + it.status;
        row.dataset.key = it.key;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = it.status !== 'present' && !it.warning;
        cb.disabled = it.status === 'present';
        const name = document.createElement('span');
        name.className = 'library-pack-item-name';
        name.textContent = `${it.name} v${it.version}` + (it.type === 'template' ? ` — ${TEMPLATE_KIND_WORDS[it.kind]}` : '');
        const status = document.createElement('span');
        status.className = 'library-pack-item-status';
        const warnedNeeds = it.needs.filter(k => items.some(x => x.key === k && x.warning)).length;
        status.textContent = it.statusText + (it.needs.length ? ` · brings ${it.needs.length} item${it.needs.length === 1 ? '' : 's'} it needs` : '')
          + (warnedNeeds ? ` (${warnedNeeds === 1 ? 'one has' : warnedNeeds + ' have'} a warning ⚠ — it comes along when this is ticked)` : '');
        row.append(cb, name, status);
        if(it.warning){
          const w = document.createElement('span');
          w.className = 'library-pack-item-warning';
          w.textContent = '⚠ ' + it.warning;
          row.appendChild(w);
        }
        if(it.origin && !sameAuthorName(it.origin.author, read.pack.author)){
          const o = document.createElement('span');
          o.className = 'library-pack-item-origin';
          o.textContent = `Shared before: ${originText(it.origin)}`;
          row.appendChild(o);
        }
        const detail = it.type === 'function' ? it.text : it.description;
        if(detail){
          const d = document.createElement('span');
          d.className = 'library-pack-item-detail';
          d.textContent = detail;
          row.appendChild(d);
        }
        box.appendChild(row);
        rows.set(it.key, cb);
      });
    };
    section('Templates and recipes', items.filter(it => it.type === 'template'));
    section('Functions', items.filter(it => it.type === 'function'));
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = 'primary';
    okBtn.textContent = 'Add to My Library';
    actions.append(cancelBtn, okBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const keys = items.filter(it => rows.get(it.key).checked && !rows.get(it.key).disabled).map(it => it.key);
      if(!keys.length){ close(); return; }
      const out = guarded(() => fm.openLibraryPack({ file, items: keys, allowNewer: true }));
      if(!out) return;
      close();
      showMessage(libraryPackResultText(out));
      if(onAdded) onAdded(out);
    });
    okBtn.focus();
  }
  function libraryPackResultText(out){
    const part = (r, one, many) => {
      if(!r.added && !r.present) return '';
      let s = r.added ? `${r.added} ${r.added === 1 ? one : many} added` : `no ${many} added`;
      if(r.present) s += ` (${r.present} already there)`;
      if(r.renumbered) s += `, ${r.renumbered} under a new version number because ${r.renumbered === 1 ? 'its number was' : 'their numbers were'} taken`;
      return s;
    };
    const parts = [part(out.templates, 'template', 'templates'), part(out.functions, 'function version', 'function versions')].filter(Boolean);
    return parts.length ? 'From the library pack: ' + parts.join('; ') + '.' : 'Nothing was added.';
  }
