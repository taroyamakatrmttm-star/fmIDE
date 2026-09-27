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
  // The kinds, versions, upgrade steps and the reader itself are in src/shared/fmide-files.js
  // (the library's checker reads files with them too). To change a format: bump its
  // "current" there, and add FMIDE_FILE_MIGRATIONS[kind][oldVersion] that upgrades a copy of
  // an old payload by exactly one version. The system and workspace formats are shared with
  // ExcelExporter: change those in src/shared/file-formats.js.
  // ============================================================
  // build:include shared/file-formats.js
  // build:include shared/fmide-files.js
  // fmIDE's upgrade steps: the shared ones, plus the shortcuts file's.
  const FILE_MIGRATIONS = Object.assign({}, FMIDE_FILE_MIGRATIONS, {
    // v1 shortcut files stored combos in the old notation.
    'fmIDE-shortcuts': {
      1: d => { Object.keys(d.bindings || {}).forEach(k => { d.bindings[k] = canonicalCombo(d.bindings[k], true); }); }
    }
  });
  // Returns { error } or { kind, data (a migrated copy), fromVersion, newer, warnings }
  // (readFmData in src/shared/fmide-files.js). A workspace's own shortcuts may still use
  // the old combo notation (a v1 workspace).
  function readFmFile(raw, accept){
    const r = readFmData(raw, accept, FILE_MIGRATIONS);
    if(!r.error && r.kind === 'fmIDE-workspace'){
      const data = r.data;
      if(data.shortcutBindings && typeof data.shortcutBindings === 'object' && !(data.shortcutBindingsVersion >= 2)){
        Object.keys(data.shortcutBindings).forEach(k => { data.shortcutBindings[k] = canonicalCombo(data.shortcutBindings[k], true); });
        data.shortcutBindingsVersion = 2;
      }
    }
    return r;
  }
  // UI wrapper: parse → read → (warn if newer) → onOk(data, result). Returns nothing.
  // A file that is too large or nested too deep is refused first (FILE_LIMITS).
  function openFmFileText(text, accept, onOk){
    const tooBig = fileTextProblem(text);
    if(tooBig){ showMessage(tooBig); return; }
    let raw;
    try{ raw = JSON.parse(text); }
    catch(err){ showMessage('That file is not valid JSON.'); return; }
    const shape = fileDataProblem(raw);
    if(shape){ showMessage(shape); return; }
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

  // Whole system: every canvas, replaces everything on load. It carries the function
  // definitions its canvases use (11b-functions.js).
  function buildSystemPayload(){
    syncActiveIntoRegistry();
    return withFunctions({
      version: SHARED_FILE_VERSIONS['system'], kind: 'system',
      nextId, nextCanvasId, activeCanvasId,
      periods, currentPeriod,
      canvases: canvases.map(c => Object.assign({ id:c.id, name:c.name, nodes:c.nodes, edges:c.edges }, c.template ? { template: c.template } : {})),
      // format roles/presets ride along so ExcelExporter formats a plain system export too
      formatPresets: FORMAT_PRESETS.map(p => ({ id: p.id, name: p.name, style: p.style }))
    }, canvases);
  }

  function saveSystemToFile(){
    downloadJSON(buildSystemPayload(), `fmIDE-system-${timestamp()}.json`);
  }

