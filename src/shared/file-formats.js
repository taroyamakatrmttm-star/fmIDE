// ---------- file formats (shared: src/shared/file-formats.js, used by both apps) ----------
// The two kinds both apps read — a system and a workspace — keep their current version
// and their upgrade steps here, once. Each app builds its own FILE_FORMATS and
// FILE_MIGRATIONS from these, adding its own kinds, labels and messages
// (docs/file-formats.md). To change one of these formats: raise its version here and add
// SHARED_FILE_MIGRATIONS[kind][oldVersion], which upgrades a copy of an old payload by
// exactly one version.
const SHARED_FILE_VERSIONS = { 'system': 9, 'fmIDE-workspace': 12 };
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
// Step 11a (decision 9): the Excel look belongs to ExcelExporter, which keeps the person's own
// Excel style. Files from before it carried Excel-only settings in fmIDE's formats: the five
// Excel-only role presets, and in any style "Use this fill, font colour & border in Excel too"
// (`keepColours`), Excel border sides (`border.sides`) and "Use Excel's default font size"
// (`font.excelDefaultSize`). The upgrade drops them; everything else stays.
const EXCEL_ONLY_ROLE_NAMES = ['Links', 'Headers', 'Section Headers', 'Labels', 'Notes'];
function dropExcelOnlyStyle(st){
  if(!st || typeof st !== 'object' || Array.isArray(st)) return;
  delete st.keepColours;
  if(st.border && typeof st.border === 'object') delete st.border.sides;
  if(st.font && typeof st.font === 'object') delete st.font.excelDefaultSize;
}
// A list of format presets upgraded in place: the Excel-only roles go, every style is cleaned.
function dropExcelOnlyPresets(list){
  if(!Array.isArray(list)) return list;
  for(let i = list.length - 1; i >= 0; i--){
    const p = list[i];
    if(p && typeof p === 'object' && EXCEL_ONLY_ROLE_NAMES.includes(p.name)) list.splice(i, 1);
    else if(p && typeof p === 'object') dropExcelOnlyStyle(p.style);
  }
  return list;
}
// Every node's own style in a list of nodes.
function dropExcelOnlyNodeStyles(nodes){
  (Array.isArray(nodes) ? nodes : []).forEach(n => { if(n && typeof n === 'object') dropExcelOnlyStyle(n.style); });
}
const SHARED_FILE_MIGRATIONS = {
  // v1 → v2: templates get a family, a version number, a change note and a version id.
  'fmIDE-workspace': {
    1: d => upgradeTemplateEntries(d.templates),
    // v2 → v3: templates may be recipes (kind "recipe"); older files have none.
    2: () => {},
    // v3 → v4: a workspace may carry a library of functions (`functions`); older ones have
    // none.
    3: () => {},
    // v4 → v5: its system (v6) and templates (v5) may use the operators of phase E1; older
    // ones don't.
    4: () => {},
    // v5 → v6: its templates and library functions may say which library pack they came
    // from (`origin`, step 8 phase 8b); older ones have no such record.
    5: () => {},
    // v6 → v7: the Excel look moved to ExcelExporter (step 11a): the Excel-only format roles
    // and style settings are dropped. Its system and templates upgrade on their own.
    6: d => { dropExcelOnlyPresets(d.formatPresets); },
    // v7 → v8: its templates may carry attachments for other outputs (`attachments`, step
    // 11c); older ones have none.
    7: () => {},
    // v8 → v9: its system (v8) and templates (v8) may use the operators of phase E2a; older
    // ones don't.
    8: () => {},
    // v9 → v10: its system (v9) and templates (v9) may use choose (phase E2b); older ones don't.
    9: () => {},
    // v10 → v11: a document may carry the fmGraph boards of its model (`graphBoards`, an
    // fmIDE-graph-board file; step 15 G3b); older ones have none.
    10: () => {},
    // v11 → v12: its templates — canvas and system templates — may carry an fmGraph board
    // (`attachments.graph`, step 15 G5a); older ones have none.
    11: () => {}
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
    2: d => { (Array.isArray(d.canvases) ? d.canvases : []).forEach(c => { if(c) upgradeNodePlugs(c.nodes); }); },
    // v3 → v4: a canvas may remember the canvas template it came from (`template`). Older
    // systems have no such links, so there is nothing to change.
    3: () => {},
    // v4 → v5: a system may carry the function definitions its function nodes use
    // (`functions`, src/shared/functions.js); older systems have none.
    4: () => {},
    // v5 → v6: the operators of phase E1 (period, if, =, ≠, and, or, not, round, roundup,
    // rounddown; arrows into if and round name their input with `toPort`). Older systems
    // have none, so nothing changes; an older app asks before opening a v6 file instead of
    // calculating those operators as ones it doesn't know.
    5: () => {},
    // v6 → v7: the Excel look moved to ExcelExporter (step 11a): the Excel-only format roles
    // and every rectangle's Excel-only style settings are dropped.
    6: d => {
      dropExcelOnlyPresets(d.formatPresets);
      (Array.isArray(d.canvases) ? d.canvases : []).forEach(c => { if(c) dropExcelOnlyNodeStyles(c.nodes); });
    },
    // v7 → v8: the operators of phase E2a (ln, exp, sqrt, int, trunc). Older systems have
    // none, so nothing changes; an older app asks before opening a v8 file instead of
    // calculating those operators as ones it doesn't know.
    7: () => {},
    // v8 → v9: choose (phase E2b; arrows into it name their input with `toPort`: 0 the index,
    // n choice n). Older systems have none, so nothing changes.
    8: () => {}
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
// Limits on a file someone opens (step 8, phase 8a). Files may come from other people, so a
// hostile one must not freeze the page: too many characters, JSON nested too deep (which
// would overflow the stack of code that walks it) or too many values are refused with a
// plain message before anything else reads the file. The autosave is never checked: it is
// the person's own work. Generous for real models (the largest sample is 60 kB, 5 deep).
const FILE_LIMITS = { chars: 50 * 1024 * 1024, depth: 100, values: 5000000 };
// A message when a file's text is too long to open, else null.
function fileTextProblem(text){
  if(typeof text !== 'string' || text.length <= FILE_LIMITS.chars) return null;
  return 'That file is too large to open (' + Math.ceil(text.length / 1048576) + ' MB; the limit is ' + (FILE_LIMITS.chars / 1048576) + ' MB).';
}
// A message when parsed data is nested too deep or holds too many values, else null.
// Walks without recursion, so a deep file can't overflow the stack here either.
function fileDataProblem(raw){
  const stack = [[raw, 1]];
  let values = 0;
  while(stack.length){
    const [v, depth] = stack.pop();
    if(++values > FILE_LIMITS.values) return 'That file holds too much data to open (more than ' + FILE_LIMITS.values.toLocaleString('en-US') + ' values).';
    if(!v || typeof v !== 'object') continue;
    if(depth > FILE_LIMITS.depth) return 'That file is nested too deeply to open (more than ' + FILE_LIMITS.depth + ' levels).';
    const items = Array.isArray(v) ? v : Object.values(v);
    for(let i = 0; i < items.length; i++) stack.push([items[i], depth + 1]);
  }
  return null;
}
