// ---------- fmIDE's files (shared: src/shared/fmide-files.js; step 8, phase 8c) ----------
import { SHARED_FILE_VERSIONS, SHARED_FILE_MIGRATIONS, upgradeNodePlugs, upgradeTemplateEntries, dropExcelOnlyPresets, dropExcelOnlyNodeStyles, inferFileKind, upgradeFileData, fileDataProblem } from './file-formats.js';
import { cleanFunctionDefinition } from './functions.js';
import { LIBRARY_PACK_LIMITS, LIBRARY_INDEX_LIMITS, cleanLibraryPackInfo, cleanItemOrigin, cleanLibraryIndexEntry } from './library-pack.js';
// The kinds of file fmIDE reads, their current versions and upgrade steps, the reader that
// identifies, checks and upgrades them (readFmData), and the checks on the templates,
// recipes and library functions they hold. Pure functions: fmIDE reads its files with them,
// and so does the library's checker (tools/check-pack.js, in Node), so both read a file
// exactly alike. fmIDE only: ExcelExporter reads its own kinds (its js/04-file-formats.js).
// Uses file-formats.js (the kinds both apps read), functions.js and library-pack.js.

// Every kind fmIDE knows: its current version, what people call it, and where it is opened.
export const FILE_FORMATS = {
  'system':               { current: SHARED_FILE_VERSIONS['system'], label: 'system', where: 'File → Load System' },
  'module':               { current: 7, label: 'module',              where: 'File → Load Module' },
  'fmIDE-workspace':      { current: SHARED_FILE_VERSIONS['fmIDE-workspace'], label: 'workspace', where: 'File → Import Workspace' },
  'fmIDE-templates':      { current: 10, label: 'templates file',      where: 'Templates → Import Templates' },
  'fmIDE-functions':      { current: 2, label: 'functions file',      where: 'Functions → Import Functions' },
  'fmIDE-format-presets': { current: 2, label: 'format presets file', where: 'Format Presets → Import Presets' },
  'fmIDE-shortcuts':      { current: 2, label: 'shortcuts file',      where: 'Keyboard Shortcuts → Import Shortcuts' },
  'fmIDE-macros':         { current: 1, label: 'macros file',         where: 'Macro Builder → Import' },
  'fmIDE-preferences':    { current: 1, label: 'preferences file',    where: 'File → Import Preferences' },
  'fmIDE-library-pack':   { current: 4, label: 'library pack',        where: 'File → Open Library Pack' },
  // The library's list, /library/index.json: written by the site's build, read from the site by
  // Browse Library (phase 8d); never opened as a file.
  'fmIDE-library-index':  { current: 1, label: 'library list',        where: 'File → Browse Library (fmIDE reads it from its website)' }
};
// The upgrade steps of the kinds above, except the shortcuts file's (its step reads fmIDE's
// key names, so fmIDE adds it: js/04-file-formats.js).
export const FMIDE_FILE_MIGRATIONS = Object.assign({}, SHARED_FILE_MIGRATIONS, {
  // v1 → v2: one plug name per rectangle becomes a list of plug names (as system v2 → v3).
  'module': {
    1: d => upgradeNodePlugs(d.nodes),
    // v2 → v3: a module may carry the function definitions it uses (`functions`); older
    // modules have none.
    2: () => {},
    // v3 → v4: the operators of phase E1, as system v5 → v6; older modules have none.
    3: () => {},
    // v4 → v5: the Excel look moved to ExcelExporter (step 11a), as system v6 → v7: every
    // rectangle's Excel-only style settings are dropped.
    4: d => { dropExcelOnlyNodeStyles(d.nodes); dropExcelOnlyPresets(d.formatPresets); },
    // v5 → v6: the operators of phase E2a, as system v7 → v8; older modules have none.
    5: () => {},
    // v6 → v7: choose (phase E2b), as system v8 → v9; older modules have none.
    6: () => {}
  },
  // v1 → v2: the Excel look moved to ExcelExporter (step 11a): the Excel-only format roles
  // and style settings are dropped.
  'fmIDE-format-presets': {
    1: d => { dropExcelOnlyPresets(d.presets); }
  },
  // v1 → v2: templates get a family, a version number, a change note and a version id.
  'fmIDE-templates': {
    1: d => upgradeTemplateEntries(d.templates),
    // v2 → v3: templates may be recipes (kind "recipe"); older files have none.
    2: () => {},
    // v3 → v4: a template's module or system may carry function definitions; older ones
    // have none.
    3: () => {},
    // v4 → v5: a template's module or system may use the operators of phase E1; older ones
    // don't.
    4: () => {},
    // v5 → v6: a template may say which library pack it came from (`origin`, phase 8b);
    // older ones have no such record.
    5: () => {},
    // v6 → v7: a canvas template may carry attachments for other outputs (`attachments`,
    // step 11c: its Excel layout); older ones have none.
    6: () => {},
    // v7 → v8: a template's module or system may use the operators of phase E2a; older ones
    // don't.
    7: () => {},
    // v8 → v9: a template's module or system may use choose (phase E2b); older ones don't.
    8: () => {},
    // v9 → v10: a canvas or system template may carry an fmGraph board (`attachments.graph`,
    // step 15 G5a); older ones have none.
    9: () => {}
  },
  // v1 → v2: an item in a pack may say which pack it came from before (`origin`, phase 8b),
  // so re-sharing keeps its author's credit; older packs have no such record.
  'fmIDE-library-pack': {
    1: () => {},
    // v2 → v3: a canvas template in a pack may carry its Excel layout (`attachments`, step
    // 11c); older packs have none.
    2: () => {},
    // v3 → v4: a canvas or system template in a pack may carry an fmGraph board
    // (`attachments.graph`, step 15 G5a); older packs have none.
    3: () => {}
  },
  // v1 → v2: a definition may say which library pack it came from (`origin`, phase 8b);
  // older ones have no such record.
  'fmIDE-functions': {
    1: () => {}
  }
});
function fileKindLabel(kind){ return FILE_FORMATS[kind] ? FILE_FORMATS[kind].label : 'file'; }

// Reads a parsed file of one of the kinds in `accept`: identifies its kind (older files
// without "kind" by their shape), refuses the wrong kind with a message saying where it
// belongs, upgrades a copy one version at a time (`migrations`: FMIDE_FILE_MIGRATIONS, or
// fmIDE's own list, which adds the shortcuts file's step), and does the same for nested
// content (a workspace's system, each template's model). A file from a NEWER version is
// flagged (`newer`), not refused, so the caller can ask first.
// Returns { error } or { kind, data (the upgraded copy), fromVersion, newer, warnings }.
export function readFmData(raw, accept, migrations){
  if(!raw || typeof raw !== 'object') return { error: "That file doesn't contain fmIDE data." };
  const kind = inferFileKind(raw);
  const fmt = kind && FILE_FORMATS[kind];
  if(!fmt){
    return { error: kind === 'fmIDE-excel-mapping'
      ? 'That is an ExcelExporter mapping file — open it in ExcelExporter (Import Mapping JSON).'
      : kind === 'fmIDE-excel-style'
      ? 'That is an ExcelExporter Excel style file — import it in ExcelExporter (Import Excel Style).'
      : kind === 'fmIDE-excel-module-layouts'
      ? 'That is an ExcelExporter module layouts file — import it in ExcelExporter (Import Module Layouts).'
      : "That file isn't an fmIDE file this version recognises" + (kind ? ` (kind "${String(kind).slice(0, 40)}")` : '') + '.' };
  }
  if(!accept.includes(kind)){
    const wanted = accept.map(fileKindLabel);
    return { error: `That is an fmIDE ${fmt.label}, not a ${wanted.join(' or ')}. Open it with ${fmt.where}.` };
  }
  const data = JSON.parse(JSON.stringify(Array.isArray(raw) ? { kind, version: 1, macros: raw } : raw));
  const { fromVersion: version, newer } = upgradeFileData(data, kind, FILE_FORMATS, migrations);
  const warnings = [];
  // Nested content.
  const nestedTemplates = (list) => (list || []).map(t => {
    // A recipe holds no model (only its parts, checked when it joins the library).
    if(!t || !t.data || (t.kind !== 'module' && t.kind !== 'system')) return t;
    const r = readFmData(t.data, [t.kind], migrations);
    if(r.error){ warnings.push(`Template "${String(t.name || '').slice(0, 60)}" was skipped: ${r.error}`); return null; }
    if(r.newer) warnings.push(`Template "${String(t.name || '').slice(0, 60)}" was saved by a newer fmIDE and may not load completely.`);
    return Object.assign({}, t, { data: r.data });
  }).filter(Boolean);
  if(kind === 'fmIDE-workspace'){
    if(data.system){
      const r = readFmData(data.system, ['system'], migrations);
      if(r.error) return { error: 'The workspace\'s system is unreadable: ' + r.error };
      data.system = r.data;
      if(r.newer) warnings.push('Its system was saved by a newer fmIDE and may not load completely.');
    }
    data.templates = nestedTemplates(data.templates);
  }
  if(kind === 'fmIDE-templates' || kind === 'fmIDE-library-pack') data.templates = nestedTemplates(data.templates);
  return { kind, data, fromVersion: version, newer, warnings };
}

// ---------- templates and recipes from files ----------
// A template family's id and a version id: 8–64 letters, digits and dashes (new ones are
// random, newRandomId). A change note: one line of at most 200 characters.
export const TEMPLATE_NOTE_MAX = 200;
export function isTemplateUid(v){ return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v); }
export function cleanTemplateNote(v){ return typeof v === 'string' ? v.trim().slice(0, TEMPLATE_NOTE_MAX) : ''; }
// A recipe holds at most this many parts.
export const RECIPE_MAX_PARTS = 50;
// The kinds a template can be. A workspace has always read an unknown kind as a canvas template.
export function templateKindOf(k){ return k === 'system' || k === 'recipe' ? k : 'module'; }
// A recipe's data read from a file (untrusted): bad parts are dropped; null when none is left.
export function cleanRecipeData(d){
  if(!d || typeof d !== 'object' || !Array.isArray(d.parts)) return null;
  const parts = [];
  d.parts.slice(0, RECIPE_MAX_PARTS).forEach(p => {
    if(!p || typeof p !== 'object' || !isTemplateUid(p.family)) return;
    const n = Number(p.version);
    const version = p.version === 'latest' ? 'latest' : (Number.isInteger(n) && n >= 1 ? n : null);
    if(version === null) return;
    const part = { family: p.family, version, name: typeof p.name === 'string' ? p.name.slice(0, 200) : '' };
    if(version !== 'latest' && isTemplateUid(p.versionId)) part.versionId = p.versionId;
    parts.push(part);
  });
  return parts.length ? { kind: 'recipe', parts } : null;
}

// ---------- a template's attachments (step 11c; fmGraph's, step 15 G5a) ----------
// A template version may carry attachments for outputs other than fmIDE:
// - `excel` (canvas templates only): the layout ExcelExporter remembers for that module (one
//   entry of an fmIDE-excel-module-layouts file);
// - `graph` (canvas and system templates): an fmGraph board file in its template form
//   (`form: "template"`, version 2 and later), which names rectangles by their name — and, for
//   a system template, their canvas's name — since a template gets new ids each time it is used.
// fmIDE never reads what is inside: it keeps an attachment with its template (workspace,
// templates file, library pack, new versions) when it passes these general checks — plain data
// only (objects, lists, text, numbers, true / false / null), nested at most 12 deep, at most
// 256 KB as text — and belongs to the template's own family (and, for `graph`, says it is that
// kind of board). ExcelExporter and fmGraph check the contents when they use them. Anything else
// is dropped.
export const TEMPLATE_ATTACHMENT_OUTPUTS = ['excel', 'graph'];
export const TEMPLATE_ATTACHMENT_KINDS = { excel: ['module'], graph: ['module', 'system'] };
export const TEMPLATE_ATTACHMENT_LIMITS = { bytes: 256 * 1024, depth: 12 };
function isPlainData(v, depth){
  if(depth > TEMPLATE_ATTACHMENT_LIMITS.depth) return false;
  if(v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if(typeof v === 'number') return Number.isFinite(v);
  if(Array.isArray(v)) return v.every(x => isPlainData(x, depth + 1));
  // (Not by prototype: the pack checker reads files in another JavaScript context.)
  if(typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]') return Object.keys(v).every(k => isPlainData(v[k], depth + 1));
  return false;
}
// Whether an attachment says it is a template's fmGraph board (only these few fields read).
function isTemplateGraphBoard(a, kind){
  return a.kind === 'fmIDE-graph-board' && a.form === 'template' && Number(a.version) >= 2
    && !!a.template && typeof a.template === 'object' && a.template.kind === kind;
}
// A template's attachments from a file (untrusted): a copy of the ones that pass, or null.
export function cleanTemplateAttachments(raw, family, kind){
  if((kind !== 'module' && kind !== 'system') || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  TEMPLATE_ATTACHMENT_OUTPUTS.forEach(k => {
    if(!TEMPLATE_ATTACHMENT_KINDS[k].includes(kind)) return;
    const a = Object.prototype.hasOwnProperty.call(raw, k) ? raw[k] : undefined;
    if(!a || typeof a !== 'object' || Array.isArray(a) || a.family !== family || !isPlainData(a, 1)) return;
    if(k === 'graph' && !isTemplateGraphBoard(a, kind)) return;
    const text = JSON.stringify(a);
    if(text.length > TEMPLATE_ATTACHMENT_LIMITS.bytes) return;
    out[k] = JSON.parse(text);
  });
  return Object.keys(out).length ? out : null;
}
// A document's fmGraph boards (workspace v11, `graphBoards`; step 15 G3b): an fmIDE-graph-board
// file that fmGraph wrote, kept with the document. fmIDE never reads what is inside: it keeps
// it when it is that kind of file, plain data, at most 16 deep and 1 MB as text; anything else
// is dropped. fmGraph reads it with its own checks (cleanBoards) when it shows the boards.
export const GRAPH_BOARDS_LIMITS = { bytes: 1024 * 1024, depth: 16 };
export function cleanGraphBoards(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.kind !== 'fmIDE-graph-board') return null;
  const plain = (v, depth) => {
    if(depth > GRAPH_BOARDS_LIMITS.depth) return false;
    if(v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if(typeof v === 'number') return Number.isFinite(v);
    if(Array.isArray(v)) return v.every(x => plain(x, depth + 1));
    if(typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]') return Object.keys(v).every(k => plain(v[k], depth + 1));
    return false;
  };
  if(!plain(raw, 1)) return null;
  const text = JSON.stringify(raw);
  return text.length > GRAPH_BOARDS_LIMITS.bytes ? null : JSON.parse(text);
}

// The Excel layout for one template family out of a file ExcelExporter's Export Module
// Layouts saved (parsed JSON). fmIDE reads only the file's kind, version and each entry's
// family. Returns { attachment } or { error }.
const EXCEL_MODULE_LAYOUTS_VERSION = 2; // v2 (step 11d): an entry may carry its block instances' layout
export function excelLayoutForFamily(raw, family){
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-excel-module-layouts' || !Array.isArray(raw.modules)) {
    return { error: 'That isn\'t a file of module layouts. In ExcelExporter, use Export Module Layouts (section 3) to save one.' };
  }
  if(!(Number(raw.version) >= 1 && Number(raw.version) <= EXCEL_MODULE_LAYOUTS_VERSION)) {
    return { error: 'That file of module layouts was saved by a newer ExcelExporter than this fmIDE knows. Update fmIDE, then try again.' };
  }
  const entry = raw.modules.find(m => m && typeof m === 'object' && m.family === family);
  if(!entry) return { error: 'That file has no layout for this template. In ExcelExporter, arrange a tab that comes from this template, then Export Module Layouts again.' };
  const clean = cleanTemplateAttachments({ excel: entry }, family, 'module');
  if(!clean) return { error: 'The layout for this template in that file is too large or not plain data, so it can\'t be attached.' };
  return { attachment: clean.excel };
}

// An fmGraph board for a template, out of a board file fmGraph's "Export for a template…"
// saved (parsed JSON; step 15 G5a). fmIDE reads only the file's kind, version, form and which
// kind of template it was made for (and, for a canvas template, its family). A board for a
// system template doesn't name one, so it takes the family it is attached to.
// Returns { attachment } or { error }.
const GRAPH_BOARD_VERSION = 2; // the board file versions fmIDE knows (v2: the template form)
export function graphBoardForTemplate(raw, family, kind){
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-graph-board') {
    return { error: 'That isn\'t an fmGraph board file. In fmGraph, use Boards → Export for a template… to save one.' };
  }
  if(!(Number(raw.version) >= 1 && Number(raw.version) <= GRAPH_BOARD_VERSION)) {
    return { error: 'That board file was saved by a newer fmGraph than this fmIDE knows. Update fmIDE, then try again.' };
  }
  if(raw.form !== 'template' || !raw.template || typeof raw.template !== 'object') {
    return { error: 'That board is for one model, not a template. In fmGraph, use Boards → Export for a template… to save one for a template.' };
  }
  if(raw.template.kind !== kind) {
    return { error: kind === 'system'
      ? 'That board was saved for a canvas template. For a system template, choose "The whole model" in fmGraph\'s Export for a template….'
      : 'That board was saved for a system template. For a canvas template, choose its canvas in fmGraph\'s Export for a template….' };
  }
  if(kind === 'module' && raw.template.family !== family) {
    return { error: 'That board was saved for another canvas template. In fmGraph, choose a canvas made from this template.' };
  }
  const clean = cleanTemplateAttachments({ graph: Object.assign({}, raw, { family }) }, family, kind);
  if(!clean) return { error: 'That board is too large or not plain data, so it can\'t be attached.' };
  return { attachment: clean.graph };
}

// ---------- the function library from files ----------
// Library definitions from a file (a workspace, an fmIDE-functions file, a library pack, the
// autosave): cleaned like any definition, keeping an `origin` (the library pack a version
// came from, phase 8b) that passes cleanItemOrigin. A model's own definitions never carry
// one: cleanFunctionDefinitions drops it, so an origin never reaches a system or module.
export function cleanLibraryFunctions(list){
  const out = [];
  (Array.isArray(list) ? list : []).forEach(raw => {
    const d = cleanFunctionDefinition(raw);
    if(!d) return;
    const origin = cleanItemOrigin(raw.origin);
    if(origin) d.origin = origin;
    out.push(d);
  });
  return out;
}

// ---------- library packs from files ----------
// A pack file (parsed JSON) read and checked. Returns { error } (a message for people) or
// { pack (its cleaned details), templates (as the file holds them, models upgraded),
// functions (cleaned), newer, fromVersion, warnings }. At most LIBRARY_PACK_LIMITS.items of
// each are read.
export function readLibraryPackData(raw){
  const shape = fileDataProblem(raw);
  if(shape) return { error: shape };
  const r = readFmData(raw, ['fmIDE-library-pack'], FMIDE_FILE_MIGRATIONS);
  if(r.error) return { error: r.error };
  const info = cleanLibraryPackInfo(r.data.pack);
  if(info.error) return { error: info.error };
  const templates = (Array.isArray(r.data.templates) ? r.data.templates : []).slice(0, LIBRARY_PACK_LIMITS.items);
  const functions = cleanLibraryFunctions(Array.isArray(r.data.functions) ? r.data.functions.slice(0, LIBRARY_PACK_LIMITS.items) : []);
  return { pack: info.info, templates, functions, newer: r.newer, fromVersion: r.fromVersion, warnings: r.warnings };
}

// ---------- the library's list (phase 8d) ----------
// /library/index.json (parsed JSON) read and checked: { error } or { packs (cleaned entries,
// cleanLibraryIndexEntry, each id once, in the list's order), dropped (how many entries
// could not be shown), newer, fromVersion }. At most LIBRARY_INDEX_LIMITS.packs are read.
export function readLibraryIndexData(raw){
  const shape = fileDataProblem(raw);
  if(shape) return { error: shape };
  const r = readFmData(raw, ['fmIDE-library-index'], FMIDE_FILE_MIGRATIONS);
  if(r.error) return { error: r.error };
  if(!Array.isArray(r.data.packs)) return { error: 'The library\'s list has no packs in it.' };
  const packs = [];
  let dropped = Math.max(0, r.data.packs.length - LIBRARY_INDEX_LIMITS.packs);
  r.data.packs.slice(0, LIBRARY_INDEX_LIMITS.packs).forEach(e => {
    const c = cleanLibraryIndexEntry(e);
    if(c.error || packs.some(p => p.id === c.entry.id)) dropped++;
    else packs.push(c.entry);
  });
  return { packs, dropped, newer: r.newer, fromVersion: r.fromVersion };
}
