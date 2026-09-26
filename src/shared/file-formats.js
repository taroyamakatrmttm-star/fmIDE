// ---------- file formats (shared: src/shared/file-formats.js, used by both apps) ----------
// The two kinds both apps read — a system and a workspace — keep their current version
// and their upgrade steps here, once. Each app builds its own FILE_FORMATS and
// FILE_MIGRATIONS from these, adding its own kinds, labels and messages
// (docs/file-formats.md). To change one of these formats: raise its version here and add
// SHARED_FILE_MIGRATIONS[kind][oldVersion], which upgrades a copy of an old payload by
// exactly one version.
const SHARED_FILE_VERSIONS = { 'system': 3, 'fmIDE-workspace': 2 };
// Before system v3 (module v2) a rectangle had one plug name, `plug: "Revenue"`; now it
// has a list, `plugs: ["Revenue", …]`. Upgrades a list of nodes in place.
function upgradeNodePlugs(nodes){
  (Array.isArray(nodes) ? nodes : []).forEach(n => {
    if(!n || typeof n !== 'object' || !('plug' in n)) return;
    if(!Array.isArray(n.plugs)){
      const p = typeof n.plug === 'string' ? n.plug.trim() : '';
      n.plugs = p ? [p] : [];
    }
    delete n.plug;
  });
}
// A random ID in the UUID v4 form, for things that must never clash between people (a
// template family, one version of it). crypto.getRandomValues works everywhere, file:// too.
function newRandomId(){
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
// Before templates file v2 (workspace v2) a template had no family or version. Each one
// becomes a family of its own, version 1, with no change note. Upgrades a list in place.
function upgradeTemplateEntries(list){
  (Array.isArray(list) ? list : []).forEach(t => {
    if(!t || typeof t !== 'object') return;
    if(t.family === undefined) t.family = newRandomId();
    if(t.version === undefined) t.version = 1;
    if(t.note === undefined) t.note = '';
    if(t.versionId === undefined) t.versionId = newRandomId();
  });
}
const SHARED_FILE_MIGRATIONS = {
  // v1 → v2: templates get a family, a version number, a change note and a version id.
  'fmIDE-workspace': {
    1: d => upgradeTemplateEntries(d.templates)
  },
  'system': {
    // v1 systems were accepted with fields the loader already defaults (periods, ids…);
    // the only structural difference handled here is a single-canvas file that kept its
    // nodes/edges at the top level.
    1: d => {
      if(!Array.isArray(d.canvases) && Array.isArray(d.nodes)){
        d.canvases = [{ id: 'c1', name: d.name || 'Canvas 1', nodes: d.nodes, edges: Array.isArray(d.edges) ? d.edges : [] }];
        d.activeCanvasId = 'c1';
        delete d.nodes; delete d.edges;
      }
    },
    // v2 → v3: one plug name per rectangle becomes a list of plug names.
    2: d => { (Array.isArray(d.canvases) ? d.canvases : []).forEach(c => { if(c) upgradeNodePlugs(c.nodes); }); }
  }
};
// A file's kind: its "kind" field, or — for files saved before kinds were written — its
// shape, so either app can say where a file belongs.
function inferFileKind(d){
  if(Array.isArray(d)) return 'fmIDE-macros';                       // a bare macro list
  if(typeof d.kind === 'string') return d.kind;
  if(Array.isArray(d.canvases)) return 'system';
  if(Array.isArray(d.nodes) && Array.isArray(d.edges)) return 'module';
  if(Array.isArray(d.tabs) && Array.isArray(d.rows)) return 'fmIDE-excel-mapping'; // an ExcelExporter mapping saved before versions were written
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
