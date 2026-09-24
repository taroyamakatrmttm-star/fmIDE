// ---------- file formats (shared: src/shared/file-formats.js, used by both apps) ----------
// The two kinds both apps read — a system and a workspace — keep their current version
// and their upgrade steps here, once. Each app builds its own FILE_FORMATS and
// FILE_MIGRATIONS from these, adding its own kinds, labels and messages
// (docs/file-formats.md). To change one of these formats: raise its version here and add
// SHARED_FILE_MIGRATIONS[kind][oldVersion], which upgrades a copy of an old payload by
// exactly one version.
const SHARED_FILE_VERSIONS = { 'system': 2, 'fmIDE-workspace': 1 };
const SHARED_FILE_MIGRATIONS = {
  // v1 systems were accepted with fields the loader already defaults (periods, ids…);
  // the only structural difference handled here is a single-canvas file that kept its
  // nodes/edges at the top level.
  'system': {
    1: d => {
      if(!Array.isArray(d.canvases) && Array.isArray(d.nodes)){
        d.canvases = [{ id: 'c1', name: d.name || 'Canvas 1', nodes: d.nodes, edges: Array.isArray(d.edges) ? d.edges : [] }];
        d.activeCanvasId = 'c1';
        delete d.nodes; delete d.edges;
      }
    }
  }
};
// A file's kind: its "kind" field, or — for files saved before kinds were written — its
// shape. recogniseLegacyMapping: also recognise an ExcelExporter mapping saved before
// versions were written (tabs + rows).
function inferFileKind(d, recogniseLegacyMapping){
  if(Array.isArray(d)) return 'fmIDE-macros';                       // a bare macro list
  if(typeof d.kind === 'string') return d.kind;
  if(Array.isArray(d.canvases)) return 'system';
  if(Array.isArray(d.nodes) && Array.isArray(d.edges)) return 'module';
  if(recogniseLegacyMapping && Array.isArray(d.tabs) && Array.isArray(d.rows)) return 'fmIDE-excel-mapping';
  if(Array.isArray(d.templates)) return 'fmIDE-templates';
  if(Array.isArray(d.presets)) return 'fmIDE-format-presets';
  if(d.bindings && typeof d.bindings === 'object') return 'fmIDE-shortcuts';
  if(Array.isArray(d.macros)) return 'fmIDE-macros';
  return null;
}
// The version check and step-by-step upgrade, applied in place to `data` (a copy of the
// file, of a kind listed in `formats`). A file from a NEWER version is left as it is so the
// caller can ask before a best-effort open. Returns { fromVersion, newer }.
function upgradeFileData(data, kind, formats, migrations){
  const fmt = formats[kind];
  let version = Number(data.version);
  if(!Number.isInteger(version) || version < 1) version = 1;          // files from before versions were written
  const newer = version > fmt.current;
  if(!newer){
    for(let v = version; v < fmt.current; v++){
      const step = migrations[kind] && migrations[kind][v];
      if(step) step(data);
    }
    data.version = fmt.current;
  }
  data.kind = kind;
  return { fromVersion: version, newer };
}
