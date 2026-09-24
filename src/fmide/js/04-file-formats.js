  // ---------- save / load ----------
  // ============================================================
  // File formats — every JSON file fmIDE writes carries { kind, version }. Every file it
  // reads goes through readFmFile(), which:
  //   1. identifies the kind (older files without "kind" are recognised by their shape),
  //   2. rejects the wrong kind of file with a message saying what it is and where to open it,
  //   3. upgrades older versions one step at a time via FILE_MIGRATIONS,
  //   4. flags a file saved by a NEWER fmIDE (version above what this build reads), so the
  //      caller can warn before a best-effort open,
  //   5. does the same for nested content (a workspace's system, each template's model).
  // To change a format: bump its "current" here, and add FILE_MIGRATIONS[kind][oldVersion]
  // that upgrades a copy of an old payload by exactly one version. The system and
  // workspace formats are shared with ExcelExporter: change those in src/shared/file-formats.js.
  // ============================================================
  // build:include shared/file-formats.js
  const FILE_FORMATS = {
    'system':               { current: SHARED_FILE_VERSIONS['system'], label: 'system', where: 'File → Load System' },
    'module':               { current: 1, label: 'module',              where: 'File → Load Module' },
    'fmIDE-workspace':      { current: SHARED_FILE_VERSIONS['fmIDE-workspace'], label: 'workspace', where: 'File → Import Workspace' },
    'fmIDE-templates':      { current: 1, label: 'templates file',      where: 'Templates → Import Templates' },
    'fmIDE-format-presets': { current: 1, label: 'format presets file', where: 'Format Presets → Import Presets' },
    'fmIDE-shortcuts':      { current: 2, label: 'shortcuts file',      where: 'Keyboard Shortcuts → Import Shortcuts' },
    'fmIDE-macros':         { current: 1, label: 'macros file',         where: 'Macro Builder → Import' },
    'fmIDE-preferences':    { current: 1, label: 'preferences file',    where: 'File → Import Preferences' }
  };
  const FILE_MIGRATIONS = Object.assign({}, SHARED_FILE_MIGRATIONS, {
    // v1 shortcut files stored combos in the old notation.
    'fmIDE-shortcuts': {
      1: d => { Object.keys(d.bindings || {}).forEach(k => { d.bindings[k] = canonicalCombo(d.bindings[k], true); }); }
    }
  });
  function fileKindLabel(kind){ return FILE_FORMATS[kind] ? FILE_FORMATS[kind].label : 'file'; }
  // Returns { error } or { kind, data (a migrated copy), fromVersion, newer, warnings }.
  function readFmFile(raw, accept){
    if(!raw || typeof raw !== 'object') return { error: "That file doesn't contain fmIDE data." };
    const kind = inferFileKind(raw);
    const fmt = kind && FILE_FORMATS[kind];
    if(!fmt){
      return { error: kind === 'fmIDE-excel-mapping'
        ? 'That is an ExcelExporter mapping file — open it in ExcelExporter (Import Mapping JSON).'
        : "That file isn't an fmIDE file this version recognises" + (kind ? ` (kind "${String(kind).slice(0, 40)}")` : '') + '.' };
    }
    if(!accept.includes(kind)){
      const wanted = accept.map(fileKindLabel);
      return { error: `That is an fmIDE ${fmt.label}, not a ${wanted.join(' or ')}. Open it with ${fmt.where}.` };
    }
    let data = cloneData(Array.isArray(raw) ? { kind, version: 1, macros: raw } : raw);
    const { fromVersion: version, newer } = upgradeFileData(data, kind, FILE_FORMATS, FILE_MIGRATIONS);
    const warnings = [];
    // Nested content.
    const nestedTemplates = (list) => (list || []).map(t => {
      if(!t || !t.data || (t.kind !== 'module' && t.kind !== 'system')) return t;
      const r = readFmFile(t.data, [t.kind]);
      if(r.error){ warnings.push(`Template "${String(t.name || '').slice(0, 60)}" was skipped: ${r.error}`); return null; }
      if(r.newer) warnings.push(`Template "${String(t.name || '').slice(0, 60)}" was saved by a newer fmIDE and may not load completely.`);
      return Object.assign({}, t, { data: r.data });
    }).filter(Boolean);
    if(kind === 'fmIDE-workspace'){
      if(data.system){
        const r = readFmFile(data.system, ['system']);
        if(r.error) return { error: 'The workspace\'s system is unreadable: ' + r.error };
        data.system = r.data;
        if(r.newer) warnings.push('Its system was saved by a newer fmIDE and may not load completely.');
      }
      data.templates = nestedTemplates(data.templates);
      // shortcuts embedded in a v1 workspace may still use the old combo notation
      if(data.shortcutBindings && typeof data.shortcutBindings === 'object' && !(data.shortcutBindingsVersion >= 2)){
        Object.keys(data.shortcutBindings).forEach(k => { data.shortcutBindings[k] = canonicalCombo(data.shortcutBindings[k], true); });
        data.shortcutBindingsVersion = 2;
      }
    }
    if(kind === 'fmIDE-templates') data.templates = nestedTemplates(data.templates);
    return { kind, data, fromVersion: version, newer, warnings };
  }
  // UI wrapper: parse → read → (warn if newer) → onOk(data, result). Returns nothing.
  function openFmFileText(text, accept, onOk){
    let raw;
    try{ raw = JSON.parse(text); }
    catch(err){ showMessage('That file is not valid JSON.'); return; }
    const r = readFmFile(raw, accept);
    if(r.error){ showMessage(r.error); return; }
    const go = () => onOk(r.data, r);
    // Anything to flag (a newer format, or nested parts that are newer / were skipped)
    // is asked about ONCE, before the normal import flow starts.
    if(r.newer || r.warnings.length){
      const fmt = FILE_FORMATS[r.kind];
      const lines = [];
      if(r.newer) lines.push(`This ${fmt.label} was saved by a newer version of fmIDE (format version ${r.fromVersion}; this fmIDE reads up to version ${fmt.current}). Updating fmIDE is the safe option; anything the newer version added may be lost.`);
      r.warnings.forEach(w => lines.push(w));
      lines.push('Continue?');
      showConfirm(lines.join('\n\n'), go);
      return;
    }
    go();
  }

  function downloadJSON(payload, filename){
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

  // Whole system: every canvas, replaces everything on load.
  function buildSystemPayload(){
    syncActiveIntoRegistry();
    return {
      version: 2, kind: 'system',
      nextId, nextCanvasId, activeCanvasId,
      periods, currentPeriod,
      canvases: canvases.map(c => ({ id:c.id, name:c.name, nodes:c.nodes, edges:c.edges })),
      // format roles/presets ride along so ExcelExporter formats a plain system export too
      formatPresets: FORMAT_PRESETS.map(p => ({ id: p.id, name: p.name, style: p.style }))
    };
  }

  function saveSystemToFile(){
    downloadJSON(buildSystemPayload(), `fmIDE-system-${timestamp()}.json`);
  }

