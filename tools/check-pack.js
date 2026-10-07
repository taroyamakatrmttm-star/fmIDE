#!/usr/bin/env node
// Checks library packs (fmIDE-library-pack files) before they join the community library
// (step 8, phase 8c; docs/step8-community-library.md). Node only, no packages: it reads
// each pack with fmIDE's own shared code — the file reader and upgrade steps
// (src/shared/fmide-files.js), the pack checks (library-pack.js), the function parser
// (functions.js) and the calculation (ir.js) — so it accepts exactly what fmIDE reads.
//
//   node tools/check-pack.js PACK.json [PACK.json …]      a report for people
//   node tools/check-pack.js --json PACK.json [ … ]       the same, as JSON
//   node tools/check-pack.js --library DIR [--base DIR] [--account LOGIN --account-id N]
//        [--date YYYY-MM-DD] [--write-records] [--records-on-merge] [--json | --markdown]
//                                     a whole library, or a pull request to it (check-library.js)
//
// The rule: fmIDE is forgiving so that people's files still open — it quietly drops or
// repairs what it can't use. The library only takes clean files, so anything fmIDE would
// drop or repair is an error here. Each report lists
//   errors    the pack can't join the library until they are fixed;
//   warnings  for the person approving it to look at;
//   notes     what the checker saw, for information.
// Exit code: 0 when every pack passes, 1 when any has an error, 2 when a file can't be read
// or the command is wrong.
//
// Every text in a pack is someone else's: the checker never runs it, and quotes it only
// through JSON.stringify, cut short, so a hostile name can't disguise a report.
'use strict';

const fs = require('fs');
const path = require('path');

// The shared modules (src/shared/, step 3c), exactly as the apps take them. They use only
// what they import, and Node's own crypto.getRandomValues for the ids an old file's upgrade
// gives.
const SHARED_FILES = ['file-formats.js', 'operators.js', 'uom.js', 'input-rule.js', 'functions.js', 'ir.js', 'library-pack.js', 'fmide-files.js'];
const S = Object.assign({}, ...SHARED_FILES.map(f => require(path.join(__dirname, '..', 'src', 'shared', f))));

// Limits of the library, on top of fmIDE's own (FILE_LIMITS): a pack is at most 5 MB.
const CHECK_LIMITS = { bytes: 5 * 1024 * 1024 };
// Packs older than this get a warning to save them again (see checkPack).
const PACK_VERSION_WORTH_RESAVING = 2;
// Periods calculated when a template's model is tried out: enough to reach every rule that
// looks at other periods, without letting a file ask for millions.
const TRY_PERIODS = 12;
const NODE_TYPES = new Set(['value', 'operator', 'alias', 'periodShift', 'blockInstance', 'function']);
const PACK_FIELDS = ['kind', 'version', 'pack', 'templates', 'functions'];
const PACK_INFO_FIELDS = ['id', 'title', 'author', 'licence', 'description', 'tags', 'created'];
const TEMPLATE_FIELDS = ['name', 'description', 'group', 'kind', 'family', 'version', 'note', 'versionId', 'data', 'origin', 'attachments'];
const FUNCTION_FIELDS = ['family', 'version', 'versionId', 'text', 'description', 'note', 'calls', 'origin'];
const ORIGIN_FIELDS = ['packId', 'packTitle', 'author', 'licence'];
const FUNCTION_STATUS = {
  'function-missing': 'it calls a function that isn\'t in the pack (or isn\'t listed in its "calls")',
  'function-unreadable': 'a function it calls can\'t be read',
  'function-cycle': 'it calls itself through other functions, in a loop',
  'function-too-deep': 'its calls are nested more than ' + S.FUNCTION_LIMITS.callDepth + ' functions deep',
  'function-arguments': 'it calls a function with the wrong number of inputs'
};

// Characters that make text look different from what it is: they change the direction of
// text (a name can be made to read backwards), are invisible, or are control characters.
const HIDDEN = [
  [/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/, 'changes the direction of text'],
  [/[\u00AD\u180E\u200B-\u200D\u2060-\u2064\uFEFF]/, 'is invisible'],
  [/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/, 'is a control character']
];
function hiddenCharacter(text){
  if(typeof text !== 'string') return null;
  for(const [re, what] of HIDDEN){
    const m = re.exec(text);
    if(m) return 'U+' + m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + ', which ' + what;
  }
  return null;
}
// Text from the pack, quoted for a report: cut short, JSON-escaped, and every hidden
// character written as \uXXXX (JSON.stringify leaves most of them as they are).
const HIDDEN_ALL = new RegExp(HIDDEN.map(([re]) => re.source).join('|'), 'g');
function quote(v){
  const s = String(v);
  return JSON.stringify(s.length > 60 ? s.slice(0, 60) + '…' : s)
    .replace(HIDDEN_ALL, hiddenEscape);
}
function hiddenEscape(ch){ return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'); }
function showHidden(text){ return String(text).replace(HIDDEN_ALL, hiddenEscape); }
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const extraFields = (o, known) => Object.keys(o).filter(k => !known.includes(k));
const sameOrigin = (a, b) => ORIGIN_FIELDS.every(k => a[k] === b[k]);

// Checks one pack, given its file's bytes (a Buffer) or text. Returns the report:
// { file, ok, pack: { id, title, author, licence, created, version } | null,
//   counts: { templates, recipes, functions }, errors, warnings, notes } — each of the
// last three a list of { where, message }.
function checkPack(content, fileName){
  const report = { file: fileName || '', ok: false, pack: null, counts: { templates: 0, recipes: 0, functions: 0 }, errors: [], warnings: [], notes: [] };
  // Messages may quote pack text by other routes too (the parser's message about a
  // formula): every hidden character in them is written out as \uXXXX.
  const add = (list) => (where, message) => list.push({ where: showHidden(where), message: showHidden(message) });
  const error = add(report.errors), warning = add(report.warnings), note = add(report.notes);
  const done = () => { report.ok = report.errors.length === 0; return report; };

  // ---- the file ----
  const bytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(String(content), 'utf8');
  if(bytes > CHECK_LIMITS.bytes){
    error('file', `It is ${(bytes / 1048576).toFixed(1)} MB; a library pack may be at most ${CHECK_LIMITS.bytes / 1048576} MB.`);
    return done();
  }
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);
  if(Buffer.isBuffer(content) && !Buffer.from(text, 'utf8').equals(content)){ error('file', 'It isn\'t valid UTF-8 text.'); return done(); }
  if(text.charCodeAt(0) === 0xFEFF){ error('file', 'It starts with a byte-order mark; save it as plain UTF-8, as fmIDE does.'); return done(); }
  const tooBig = S.fileTextProblem(text);
  if(tooBig){ error('file', tooBig); return done(); }
  let raw;
  try{ raw = JSON.parse(text); }
  catch(err){ error('file', 'It isn\'t valid JSON (' + String(err.message).slice(0, 120) + ').'); return done(); }
  const shape = S.fileDataProblem(raw);
  if(shape){ error('file', shape); return done(); }
  if(!isObject(raw) || raw.kind !== 'fmIDE-library-pack'){
    const r = S.readFmData(raw, ['fmIDE-library-pack'], S.FMIDE_FILE_MIGRATIONS);
    error('file', r.error || 'It isn\'t a library pack (its "kind" isn\'t "fmIDE-library-pack").');
    return done();
  }
  const current = S.FILE_FORMATS['fmIDE-library-pack'].current;
  if(!Number.isInteger(raw.version) || raw.version < 1){ error('file', 'Its "version" isn\'t a whole number from 1 up.'); return done(); }
  if(raw.version > current){
    error('file', `It was saved by a newer fmIDE (library pack version ${raw.version}; this checker reads up to version ${current}). The checker has to be updated first.`);
    return done();
  }
  // Version 1 packs lose the credit of an item shared again (origin, v2); what later versions
  // add is optional (v3: a template's Excel layout), so only those are worth saving again.
  if(raw.version < PACK_VERSION_WORTH_RESAVING) warning('file', `It was saved by an older fmIDE (library pack version ${raw.version}; the current version is ${current}). It opens, but saving it again from a current fmIDE is better.`);
  const extra = extraFields(raw, PACK_FIELDS);
  if(extra.length) warning('file', `fmIDE ignores its fields ${extra.map(quote).join(', ')}.`);

  // ---- the pack details ----
  const info = S.cleanLibraryPackInfo(raw.pack);
  if(info.error){ error('pack', info.error); return done(); }
  const p = info.info, rp = raw.pack;
  report.pack = { id: p.id, title: p.title, author: p.author, licence: p.licence, created: p.created || null, version: raw.version };
  if(rp.title !== p.title) error('pack', `Its title has line breaks, extra spaces or more than ${S.LIBRARY_PACK_LIMITS.title} characters.`);
  if(rp.author !== p.author) error('pack', `Its author has line breaks, extra spaces or more than ${S.LIBRARY_PACK_LIMITS.author} characters.`);
  if(rp.licence !== p.licence) error('pack', 'Its licence has extra spaces.');
  if(rp.description !== undefined && (typeof rp.description !== 'string' || rp.description.replace(/\r\n?/g, '\n') !== p.description)) {
    error('pack', `Its description isn't text, has spaces at the start or end, or has more than ${S.LIBRARY_PACK_LIMITS.description} characters.`);
  }
  if(rp.tags !== undefined && (!Array.isArray(rp.tags) || rp.tags.length !== p.tags.length || rp.tags.some((t, i) => t !== p.tags[i]))) {
    error('pack', `Its tags must be a list of at most ${S.LIBRARY_PACK_LIMITS.tags} different tags in lower case, one line and at most ${S.LIBRARY_PACK_LIMITS.tag} characters each.`);
  }
  if(rp.created === undefined) warning('pack', 'It has no date ("created"); fmIDE always writes one.');
  else if(!p.created || !realDate(p.created)) error('pack', 'Its date ("created") isn\'t a real date written YYYY-MM-DD.');
  const infoExtra = extraFields(rp, PACK_INFO_FIELDS);
  if(infoExtra.length) warning('pack', `fmIDE ignores its details ${infoExtra.map(quote).join(', ')}.`);
  checkHidden(error, 'pack', { title: rp.title, author: rp.author, description: rp.description }, true);
  (Array.isArray(rp.tags) ? rp.tags : []).forEach(t => checkHidden(error, 'pack', { tag: t }));
  if(fileName && path.basename(fileName) !== p.id + '.fmide-pack.json') {
    note('file', `In the library it will be named ${p.id}.fmide-pack.json (its pack id).`);
  }

  // ---- the items ----
  if(raw.templates !== undefined && !Array.isArray(raw.templates)) error('file', '"templates" isn\'t a list.');
  if(raw.functions !== undefined && !Array.isArray(raw.functions)) error('file', '"functions" isn\'t a list.');
  const rawTemplates = Array.isArray(raw.templates) ? raw.templates : [];
  const rawFunctions = Array.isArray(raw.functions) ? raw.functions : [];
  if(!rawTemplates.length && !rawFunctions.length) error('file', 'It holds no templates, recipes or functions.');
  const max = S.LIBRARY_PACK_LIMITS.items;
  if(rawTemplates.length > max) error('file', `It holds ${rawTemplates.length} templates; fmIDE reads at most ${max}.`);
  if(rawFunctions.length > max) error('file', `It holds ${rawFunctions.length} functions; fmIDE reads at most ${max}.`);

  const templates = checkTemplates(rawTemplates.slice(0, max), raw.version, { error, warning, note }, p);
  const functions = checkFunctions(rawFunctions.slice(0, max), { error, warning, note }, p);
  checkRecipeParts(templates, rawTemplates, error);
  report.counts = { templates: templates.filter(t => t.kind !== 'recipe').length, recipes: templates.filter(t => t.kind === 'recipe').length, functions: functions.length };

  // ---- the same result as fmIDE ----
  // What fmIDE's own reader makes of the pack: it must read every item the checker passed.
  if(!report.errors.length){
    const read = S.readLibraryPackData(raw);
    if(read.error) error('file', read.error);
    else {
      read.warnings.forEach(w => error('file', w));
      if(read.templates.length !== rawTemplates.length || read.functions.length !== rawFunctions.length) error('file', 'fmIDE would leave some of its items out.');
    }
  }
  return done();
}

function realDate(s){
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
// Reports a hidden character in any of `fields` ({ label: text }). `multiline`: line breaks
// (and tabs) are allowed.
function checkHidden(error, where, fields, multiline){
  Object.keys(fields).forEach(k => {
    const v = fields[k];
    if(typeof v !== 'string') return;
    const found = hiddenCharacter(multiline ? v : v.replace(/[\n\t\r]/g, ' '));
    if(found) error(where, `Its ${k} contains a hidden character (${found}).`);
    else if(!multiline && /[\n\t\r]/.test(v) && k !== 'text') error(where, `Its ${k} has a line break or tab.`);
  });
}
// An item's `origin` (where it came from before this pack): it must pass fmIDE's check
// exactly, or fmIDE would drop it.
function checkOrigin(o, where, out, pack){
  if(o === undefined) return;
  const clean = S.cleanItemOrigin(o);
  if(!clean || !sameOrigin(clean, o) || extraFields(o, ORIGIN_FIELDS).length){
    out.error(where, 'Its record of where it came from ("origin") is malformed; fmIDE would drop it.');
    return;
  }
  checkHidden(out.error, where, { 'origin\'s pack title': o.packTitle, 'origin\'s author': o.author });
  if(S.sameAuthorName(o.author, pack.author) && o.packId === pack.id) return;
  out.note(where, `It says it was shared before: in the pack ${quote(o.packTitle)} (${o.packId}) by ${quote(o.author)}. It must be exactly a version approved in that pack.`);
}

// A template's attachments (step 11c; fmGraph's board, step 15 G5a): fmIDE keeps them only when
// they pass its general checks exactly (known outputs on the kinds of template they belong to,
// plain data, not too large or deep, made for the template's own family; a board in its
// template form); anything it would drop is an error. An Excel layout's contents are
// ExcelExporter's to check when it uses it; a board's are checked here against the template
// (checkGraphBoard). Here too: no text hides characters.
function checkAttachments(t, where, out){
  if(t.attachments === undefined) return;
  const clean = S.cleanTemplateAttachments(t.attachments, t.family, t.kind);
  if(!clean || JSON.stringify(clean) !== JSON.stringify(t.attachments)){
    out.error(where, `Its attachments ("attachments") aren't what fmIDE keeps: only a canvas template's Excel layout and a canvas or system template's fmGraph board (in its template form), made for this template's family, as plain data of at most ${S.TEMPLATE_ATTACHMENT_LIMITS.bytes / 1024} KB. fmIDE would drop them.`);
    return;
  }
  const texts = [];
  const walk = (v) => { if(typeof v === 'string') texts.push(v); else if(v && typeof v === 'object') Object.keys(v).forEach(k => { texts.push(k); walk(v[k]); }); };
  walk(t.attachments);
  const hidden = texts.map(hiddenCharacter).find(Boolean);
  if(hidden) out.error(where, `A text in its attachments contains a hidden character (${hidden}).`);
  if(t.attachments.excel) out.note(where, 'It carries an Excel layout for ExcelExporter (checked there when it is used).');
  if(t.attachments.graph) out.note(where, 'It carries an fmGraph board.');
}

// A template's fmGraph board (step 15 G5a), against the template it comes with: every
// rectangle it names — by name, and for a system template in the canvas of that name — must be
// in the template exactly once (fmGraph would leave out a widget it can't place, or can't tell
// apart), and it holds no more than fmGraph shows (20 boards, 40 bars and charts and 40 sliders
// a board).
const GRAPH_BOARD_CHECK_LIMITS = { boards: 20, items: 40, sliders: 40 };
function checkGraphBoard(t, where, out){
  const a = t.attachments && t.attachments.graph;
  if(!a) return;
  const err = (m) => out.error(where, 'Its fmGraph board: ' + m);
  if(!Array.isArray(a.boards) || !a.boards.length) return err('it holds no boards.');
  if(a.boards.length > GRAPH_BOARD_CHECK_LIMITS.boards) err(`it holds ${a.boards.length} boards; fmGraph shows at most ${GRAPH_BOARD_CHECK_LIMITS.boards}.`);
  const system = t.kind === 'system';
  const canvases = system ? (Array.isArray(t.data.canvases) ? t.data.canvases : []) : [t.data];
  const lower = (s) => String(s).trim().toLowerCase();
  const names = new Map();
  canvases.forEach(c => (isObject(c) && Array.isArray(c.nodes) ? c.nodes : []).forEach(n => {
    if(!isObject(n) || n.type !== 'value') return;
    const name = lower(S.parseRectText(n.text).name || '');
    if(!name) return;
    const k = (system ? lower(c.name || '') : '') + '\u0000' + name;
    names.set(k, (names.get(k) || 0) + 1);
  }));
  const ref = (r, what) => {
    if(!isObject(r) || typeof r.name !== 'string' || !r.name.trim()) return err(what + ' names no rectangle.');
    if(system && (typeof r.canvas !== 'string' || !r.canvas.trim())) return err(what + ' names no canvas.');
    const shown = (system ? quote(r.canvas) + ' / ' : '') + quote(r.name);
    const n = names.get((system ? lower(r.canvas) : '') + '\u0000' + lower(r.name));
    if(!n) err(what + ' names ' + shown + ', which the template doesn\'t have.');
    else if(n > 1) err(what + ' names ' + shown + ', which the template has more than once, so fmGraph can\'t tell which.');
  };
  a.boards.forEach((b, bi) => {
    const bw = `board ${bi + 1}`;
    if(!isObject(b)) return err(bw + ' isn\'t a board.');
    const items = Array.isArray(b.items) ? b.items : [], sliders = Array.isArray(b.sliders) ? b.sliders : [];
    if(items.length > GRAPH_BOARD_CHECK_LIMITS.items) err(`${bw} holds ${items.length} bars and charts; fmGraph shows at most ${GRAPH_BOARD_CHECK_LIMITS.items}.`);
    if(sliders.length > GRAPH_BOARD_CHECK_LIMITS.sliders) err(`${bw} holds ${sliders.length} sliders; fmGraph shows at most ${GRAPH_BOARD_CHECK_LIMITS.sliders}.`);
    items.forEach((w, wi) => {
      const ww = `${bw}, item ${wi + 1}`;
      if(!isObject(w) || (w.type !== 'bar' && w.type !== 'chart')) return err(ww + ' isn\'t a bar or a chart.');
      if(w.type === 'bar') return ref(w, ww);
      const refs = w.layout === 'flow' ? (Array.isArray(w.steps) ? w.steps : [])
        : (Array.isArray(w.groups) ? w.groups.flatMap(g => isObject(g) && Array.isArray(g.parts) ? g.parts : []) : []);
      if(!refs.length) return err(ww + ' shows no rectangles.');
      refs.forEach((r, ri) => ref(r, `${ww}, rectangle ${ri + 1}`));
    });
    sliders.forEach((s, si) => ref(s, `${bw}, slider ${si + 1}`));
  });
}

// ---- templates and recipes ----
// Returns the templates that passed their own checks, as { i, raw, where, kind, family,
// version, versionId, name }.
function checkTemplates(list, packVersion, out, pack){
  const passed = [];
  const byFamily = new Map();
  const versionIds = new Map();
  list.forEach((t, i) => {
    let where = `template #${i + 1}`;
    if(!isObject(t)){ out.error(where, 'It isn\'t a template.'); return; }
    if(typeof t.name === 'string' && t.name.trim()) where = `template ${quote(t.name)}` + (Number.isInteger(t.version) ? ' v' + t.version : '');
    let bad = false;
    const err = (m) => { bad = true; out.error(where, m); };
    if(typeof t.name !== 'string' || !t.name.trim()) err('It has no name.');
    else if(t.name !== t.name.trim()) err('Its name has spaces at the start or end.');
    if(!['module', 'system', 'recipe'].includes(t.kind)) err(`Its kind (${quote(t.kind)}) isn't "module", "system" or "recipe".`);
    if(!S.isTemplateUid(t.family)) err('Its family id is missing or malformed (8–64 letters, digits and dashes).');
    if(!Number.isInteger(t.version) || t.version < 1) err('Its version isn\'t a whole number from 1 up.');
    if(!S.isTemplateUid(t.versionId)) err('Its version id is missing or malformed (8–64 letters, digits and dashes).');
    if(t.note !== undefined && t.note !== S.cleanTemplateNote(t.note)) err(`Its change note isn't text, has spaces at the start or end, or has more than ${S.TEMPLATE_NOTE_MAX} characters.`);
    if(t.description !== undefined && typeof t.description !== 'string') err('Its description isn\'t text.');
    if(t.group !== undefined && typeof t.group !== 'string') err('Its group isn\'t text.');
    if(!isObject(t.data)) err('It holds no model.');
    const extra = extraFields(t, TEMPLATE_FIELDS);
    if(extra.length) out.warning(where, `fmIDE ignores its fields ${extra.map(quote).join(', ')}.`);
    checkHidden(out.error, where, { name: t.name, group: t.group, 'change note': t.note });
    checkHidden(out.error, where, { description: t.description }, true);
    checkOrigin(t.origin, where, out, pack);
    checkAttachments(t, where, out);
    if(bad) return;
    if(t.kind === 'recipe') checkRecipe(t, where, err);
    else checkTemplateModel(t, where, err, out);
    if(bad) return;
    checkGraphBoard(t, where, out);
    // Within the pack: one family is one kind and one name; a version is there once.
    const fam = byFamily.get(t.family);
    if(fam && fam.kind !== t.kind) { out.error(where, `Its family is also used by ${fam.where}, which is a different kind of template.`); return; }
    if(fam && fam.name !== t.name) out.warning(where, `Its family is also ${fam.where}, under another name; fmIDE gives a family's versions one name.`);
    if(!fam) byFamily.set(t.family, { kind: t.kind, name: t.name, where });
    if(passed.some(x => x.family === t.family && x.version === t.version)) { out.error(where, `The pack holds version ${t.version} of this family twice.`); return; }
    if(versionIds.has(t.versionId)) { out.error(where, `Its version id is also used by ${versionIds.get(t.versionId)}.`); return; }
    versionIds.set(t.versionId, where);
    passed.push({ i, raw: t, where, kind: t.kind, family: t.family, version: t.version, versionId: t.versionId, name: t.name });
  });
  return passed;
}
// A recipe's parts, as fmIDE reads them (cleanRecipeData): every part must survive.
function checkRecipe(t, where, err){
  const parts = isObject(t.data) && Array.isArray(t.data.parts) ? t.data.parts : null;
  if(!parts || !parts.length){ err('The recipe has no parts.'); return; }
  if(parts.length > S.RECIPE_MAX_PARTS){ err(`The recipe has ${parts.length} parts; fmIDE reads at most ${S.RECIPE_MAX_PARTS}.`); return; }
  const clean = S.cleanRecipeData(t.data);
  parts.forEach((part, j) => {
    const w = `part ${j + 1}`;
    if(!isObject(part) || !S.isTemplateUid(part.family)) return err(`Its ${w} has no valid family id.`);
    if(part.version !== 'latest' && !(Number.isInteger(part.version) && part.version >= 1)) return err(`Its ${w} has no valid version ("latest" or a whole number from 1 up).`);
    if(part.version !== 'latest' && part.versionId !== undefined && !S.isTemplateUid(part.versionId)) return err(`Its ${w} has a malformed version id.`);
    if(part.name !== undefined && (typeof part.name !== 'string' || part.name.length > 200)) return err(`Its ${w}'s name isn't text of at most 200 characters.`);
    const found = hiddenCharacter(part.name);
    if(found) err(`Its ${w}'s name contains a hidden character (${found}).`);
  });
  if(!clean || clean.parts.length !== parts.length) err('fmIDE would leave out some of the recipe\'s parts.');
}
// A canvas or system template's model: read and upgraded by the shared reader, then its
// shape checked and its calculation tried.
function checkTemplateModel(t, where, err, out){
  const r = S.readFmData(t.data, [t.kind], S.FMIDE_FILE_MIGRATIONS);
  if(r.error){ err('Its model can\'t be read: ' + r.error); return; }
  if(r.newer){ err(`Its model was saved by a newer fmIDE (${S.FILE_FORMATS[t.kind].label} version ${r.fromVersion}).`); return; }
  const d = r.data;
  let canvases;
  if(t.kind === 'module'){
    if(!Array.isArray(d.nodes) || !Array.isArray(d.edges)){ err('Its model has no "nodes" and "edges" lists.'); return; }
    if(d.name !== undefined){
      if(typeof d.name !== 'string') err('Its canvas name isn\'t text.');
      const found = hiddenCharacter(d.name);
      if(found) err(`Its canvas name contains a hidden character (${found}).`);
    }
    const id = typeof d.selfCanvasId === 'string' && d.selfCanvasId ? d.selfCanvasId : 'c1';
    canvases = [{ id, name: typeof d.name === 'string' ? d.name : '', nodes: d.nodes, edges: d.edges }];
  } else {
    if(!Array.isArray(d.canvases) || !d.canvases.length){ err('Its model has no canvases.'); return; }
    canvases = d.canvases;
    if(d.periods !== undefined && (!Array.isArray(d.periods) || d.periods.some(x => typeof x !== 'string'))) err('Its periods aren\'t a list of names.');
  }
  const canvasIds = new Set();
  canvases.forEach((c, ci) => {
    const cw = t.kind === 'system' ? `canvas ${isObject(c) && typeof c.name === 'string' ? quote(c.name) : '#' + (ci + 1)}` : 'canvas';
    if(!isObject(c)){ err(`Its canvas #${ci + 1} isn't a canvas.`); return; }
    if(t.kind === 'system'){
      if(typeof c.id !== 'string' || !c.id) err(`Its ${cw} has no id.`);
      else if(canvasIds.has(c.id)) err(`Two of its canvases have the id ${quote(c.id)}.`);
      canvasIds.add(c.id);
      if(typeof c.name !== 'string') err(`Its ${cw} has no name.`);
      const found = hiddenCharacter(c.name);
      if(found) err(`Its ${cw}'s name contains a hidden character (${found}).`);
      if(!Array.isArray(c.nodes) || !Array.isArray(c.edges)){ err(`Its ${cw} has no "nodes" and "edges" lists.`); return; }
    }
    checkCanvasShape(c, cw, err);
  });
  // Function definitions the model carries, and the calls its function nodes make.
  const fnList = Array.isArray(d.functions) ? d.functions : [];
  if(d.functions !== undefined && !Array.isArray(d.functions)) err('Its "functions" isn\'t a list.');
  fnList.forEach((f, k) => {
    const clean = S.cleanFunctionDefinition(f);
    if(!clean){ err(`Its model's function #${k + 1} is missing its family, version or formula.`); return; }
    const parsed = S.parseFunctionText(clean.text);
    if(!parsed.ok) err(`Its model's function ${quote(S.functionNameOf(clean) || '#' + (k + 1))} can't be read: ${parsed.error.message}`);
    const found = hiddenCharacter(String(f.text).replace(/[\n\t]/g, ' '));
    if(found) err(`Its model's function ${quote(S.functionNameOf(clean) || '#' + (k + 1))} contains a hidden character (${found}).`);
  });
  const compiled = S.compileFunctions(fnList);
  canvases.forEach(c => (isObject(c) && Array.isArray(c.nodes) ? c.nodes : []).forEach(n => {
    if(!isObject(n) || n.type !== 'function') return;
    const f = compiled.resolve(n.fn);
    const label = isObject(n.fn) && typeof n.fn.name === 'string' ? quote(n.fn.name) : 'a function';
    if(!f) err(`Its model uses ${label}, whose definition the model doesn't carry.`);
    else if(f.status) err(`Its model uses ${label}, which can't be calculated: ${FUNCTION_STATUS[f.status] || f.status}.`);
  }));
  // Try the calculation: a model fmIDE can't calculate at all has no place in the library.
  try{
    const periods = Array.isArray(d.periods) && d.periods.length ? d.periods.slice(0, TRY_PERIODS) : ['Period 1'];
    S.evaluateModel(S.compileModel({ periods, canvases, functions: fnList }));
  }catch(e){
    err('Its model can\'t be calculated (' + String(e && e.message || e).slice(0, 120) + ').');
  }
  // Notes on links out of a canvas template: they only work next to the right canvases.
  if(t.kind === 'module'){
    const self = canvases[0].id;
    const outside = d.nodes.filter(n => isObject(n) && ((n.type === 'alias' && !n.auto && n.sourceCanvasId !== self) || (n.type === 'blockInstance' && n.blockDefCanvasId !== self)));
    if(outside.length) out.warning(where, `${outside.length} of its aliases or block instances refer to another canvas, which the template doesn't carry; they show as broken links.`);
  }
}
// One canvas's nodes and arrows: what fmIDE needs to draw and calculate them.
function checkCanvasShape(c, cw, err){
  const ids = new Set();
  let reported = 0;
  const once = (m) => { if(reported++ < 5) err(m); };
  c.nodes.forEach((n, k) => {
    if(!isObject(n)) return once(`Its ${cw}'s node #${k + 1} isn't a node.`);
    if(typeof n.id !== 'string' || !n.id) return once(`Its ${cw}'s node #${k + 1} has no id.`);
    if(ids.has(n.id)) once(`Its ${cw} has two nodes with the id ${quote(n.id)}.`);
    ids.add(n.id);
    if(!NODE_TYPES.has(n.type)) once(`Its ${cw}'s node ${quote(n.id)} is of a type fmIDE doesn't know (${quote(n.type)}).`);
    if(!Number.isFinite(n.x) || !Number.isFinite(n.y)) once(`Its ${cw}'s node ${quote(n.id)} has no position (x and y numbers).`);
    ['w', 'h'].forEach(k2 => { if(n[k2] !== undefined && !(Number.isFinite(n[k2]) && n[k2] > 0)) once(`Its ${cw}'s node ${quote(n.id)} has a size that isn't a positive number.`); });
    if(n.text !== undefined && typeof n.text !== 'string') once(`Its ${cw}'s node ${quote(n.id)} has text that isn't text.`);
    const texts = [n.text, n.socket].concat(Array.isArray(n.plugs) ? n.plugs : []);
    texts.forEach(v => {
      const found = typeof v === 'string' ? hiddenCharacter(v.replace(/[\n\t]/g, ' ')) : null;
      if(found) once(`Its ${cw}'s node ${quote(n.id)} contains a hidden character (${found}).`);
    });
  });
  c.edges.forEach((e, k) => {
    if(!isObject(e)) return once(`Its ${cw}'s arrow #${k + 1} isn't an arrow.`);
    if(!ids.has(e.from) || !ids.has(e.to)) once(`Its ${cw}'s arrow #${k + 1} doesn't join two of its nodes.`);
    if(e.toPort !== undefined && !(Number.isInteger(e.toPort) && e.toPort >= 0)) once(`Its ${cw}'s arrow #${k + 1} has an input number ("toPort") that isn't a whole number.`);
  });
}
// Each recipe part must be in the pack, as a canvas template or another recipe (the version
// it pins, or any version for "latest"). A recipe inside a recipe is built in its place, as
// fmIDE does, at most RECIPE_MAX_DEPTH deep; one that contains itself is an error.
const RECIPE_MAX_DEPTH = 8;
function checkRecipeParts(templates, rawList, error){
  const resolve = (part) => {
    const same = templates.filter(x => x.family === part.family);
    if(part.version === 'latest') return same.sort((a, b) => b.version - a.version)[0];
    return same.find(x => part.versionId && x.versionId === part.versionId) || same.find(x => x.version === part.version);
  };
  // The deepest a recipe's recipes go, or 'loop' when one leads back to one on the way.
  const depthOf = (t, stack) => {
    if(stack.includes(t.family)) return 'loop';
    let deepest = 0;
    for(const part of t.raw.data.parts){
      const hit = resolve(part);
      if(!hit || hit.kind !== 'recipe') continue;
      const d = depthOf(hit, stack.concat([t.family]));
      if(d === 'loop') return 'loop';
      deepest = Math.max(deepest, d + 1);
    }
    return deepest;
  };
  templates.filter(t => t.kind === 'recipe').forEach(t => {
    const depth = depthOf(t, []);
    if(depth === 'loop') error(t.where, 'The recipe contains itself, through the recipes inside it; fmIDE can\'t build it.');
    else if(depth > RECIPE_MAX_DEPTH) error(t.where, `The recipe has recipes inside recipes ${depth} deep; fmIDE builds at most ${RECIPE_MAX_DEPTH}.`);
    t.raw.data.parts.forEach((part, j) => {
      const hit = resolve(part);
      const shown = part.name ? quote(part.name) : `part ${j + 1}`;
      const vText = part.version === 'latest' ? '@latest' : ' v' + part.version;
      if(!hit){
        const inPack = rawList.some(x => isObject(x) && x.family === part.family);
        return error(t.where, `The recipe needs ${shown}${vText}, which ` + (inPack ? 'has errors of its own.' : 'the pack doesn\'t carry.'));
      }
      if(hit.kind !== 'module' && hit.kind !== 'recipe') return error(t.where, `The recipe's part ${shown} is not a canvas template or a recipe.`);
      if(part.version !== 'latest' && part.versionId && hit.versionId !== part.versionId) error(t.where, `The recipe was made with a different ${shown}${vText} than the one in the pack.`);
    });
  });
}

// ---- functions ----
function checkFunctions(list, out, pack){
  const passed = [];
  const versionIds = new Map();
  list.forEach((f, i) => {
    let where = `function #${i + 1}`;
    if(!isObject(f)){ out.error(where, 'It isn\'t a function definition.'); return; }
    const name = S.functionNameOf(f);
    if(name) where = `function ${quote(name)}` + (Number.isInteger(f.version) ? ' v' + f.version : '');
    let bad = false;
    const err = (m) => { bad = true; out.error(where, m); };
    if(!S.isTemplateUid(f.family)) err('Its family id is missing or malformed (8–64 letters, digits and dashes).');
    if(!Number.isInteger(f.version) || f.version < 1) err('Its version isn\'t a whole number from 1 up.');
    if(!S.isTemplateUid(f.versionId)) err('Its version id is missing or malformed (8–64 letters, digits and dashes).');
    if(typeof f.text !== 'string' || !f.text.trim()) err('It has no formula.');
    if(f.description !== undefined && (typeof f.description !== 'string' || f.description.length > S.FUNCTION_LIMITS.description)) err(`Its description isn't text of at most ${S.FUNCTION_LIMITS.description} characters.`);
    if(f.note !== undefined && (typeof f.note !== 'string' || f.note.length > S.FUNCTION_LIMITS.note)) err(`Its change note isn't text of at most ${S.FUNCTION_LIMITS.note} characters.`);
    if(f.calls !== undefined && !Array.isArray(f.calls)) err('Its "calls" isn\'t a list.');
    const extra = extraFields(f, FUNCTION_FIELDS);
    if(extra.length) out.warning(where, `fmIDE ignores its fields ${extra.map(quote).join(', ')}.`);
    checkHidden(out.error, where, { formula: typeof f.text === 'string' ? f.text.replace(/[\n\t]/g, ' ') : f.text, 'change note': f.note });
    checkHidden(out.error, where, { description: f.description }, true);
    checkOrigin(f.origin, where, out, pack);
    if(bad) return;
    const clean = S.cleanFunctionDefinition(f);
    const calls = Array.isArray(f.calls) ? f.calls : [];
    if(calls.length > S.FUNCTION_LIMITS.calls) return err(`It lists ${calls.length} calls; fmIDE reads at most ${S.FUNCTION_LIMITS.calls}.`);
    if(!clean || clean.calls.length !== calls.length) return err('Some of its "calls" are malformed (each needs a name, a family id and a version).');
    if(calls.some(c => !S.isTemplateUid(c.versionId))) return err('Some of its "calls" have no version id.');
    const parsed = S.parseFunctionText(f.text);
    if(!parsed.ok) return err('Its formula can\'t be read: ' + parsed.error.message);
    if(passed.some(x => x.family === f.family && x.version === f.version)) return err(`The pack holds version ${f.version} of this function twice.`);
    if(versionIds.has(f.versionId)) return err(`Its version id is also used by ${versionIds.get(f.versionId)}.`);
    versionIds.set(f.versionId, where);
    passed.push({ i, raw: f, where, family: f.family, version: f.version, versionId: f.versionId, name: parsed.name });
  });
  // The calls between them: each called version is in the pack, and each can be calculated.
  const missingCall = new Set();
  passed.forEach(x => (x.raw.calls || []).forEach(c => {
    if(passed.some(y => y.family === c.family && y.versionId === c.versionId)) return;
    missingCall.add(x);
    const inPack = list.some(y => isObject(y) && y.family === c.family && y.versionId === c.versionId);
    out.error(x.where, `It calls ${quote(c.name)} v${c.version}, which ` + (inPack ? 'has errors of its own.' : 'the pack doesn\'t carry.'));
  }));
  const compiled = S.compileFunctions(passed.map(x => x.raw));
  passed.forEach(x => {
    const c = compiled.resolve(x.raw);
    if(!c || !c.status || (c.status === 'function-missing' && missingCall.has(x))) return;
    out.error(x.where, `It can't be calculated: ${FUNCTION_STATUS[c.status] || c.status}.`);
  });
  return passed;
}

// ---- reports ----
function formatReport(r){
  const lines = [];
  lines.push('Checking ' + (r.file || 'the pack'));
  if(r.pack) {
    const c = r.counts;
    lines.push(`  Pack ${quote(r.pack.title)} by ${quote(r.pack.author)} (${(S.LIBRARY_PACK_LICENCES[r.pack.licence] || {}).short || r.pack.licence}), id ${r.pack.id}` + (r.pack.created ? ', ' + r.pack.created : ''));
    lines.push(`  ${c.templates} template${c.templates === 1 ? '' : 's'}, ${c.recipes} recipe${c.recipes === 1 ? '' : 's'}, ${c.functions} function${c.functions === 1 ? '' : 's'}`);
  }
  const section = (title, list, mark) => {
    if(!list.length) return;
    lines.push(`  ${title} (${list.length}):`);
    list.forEach(x => lines.push(`    ${mark} ${x.where}: ${x.message}`));
  };
  section('Errors', r.errors, '✗');
  section('Warnings', r.warnings, '!');
  section('Notes', r.notes, '·');
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  lines.push(`  Result: ${r.ok ? 'PASSED' : 'FAILED'} — ${count(r.errors.length, 'error')}, ${count(r.warnings.length, 'warning')}.`);
  return lines.join('\n');
}

function main(argv){
  const args = argv.slice(2);
  if(args.includes('--library')) return mainLibrary(args);
  const json = args.includes('--json');
  const files = args.filter(a => a !== '--json');
  const unknown = files.filter(a => a.startsWith('--'));
  if(unknown.length || !files.length){
    process.stderr.write((unknown.length ? `Unknown option ${unknown[0]}.\n` : '') + 'Usage: node tools/check-pack.js [--json] PACK.json [PACK.json …]\n');
    return 2;
  }
  const reports = [];
  for(const f of files){
    let content;
    try{ content = fs.readFileSync(f); }
    catch(e){ process.stderr.write(`Can't read ${f}: ${e.code || e.message}\n`); return 2; }
    reports.push(checkPack(content, f));
  }
  if(json) process.stdout.write(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2) + '\n');
  else process.stdout.write(reports.map(formatReport).join('\n\n') + '\n');
  return reports.every(r => r.ok) ? 0 : 1;
}

// The library mode (check-library.js): options with a value, and flags.
const LIBRARY_OPTIONS = ['--library', '--base', '--account', '--account-id', '--date'];
const LIBRARY_FLAGS = ['--write-records', '--records-on-merge', '--json', '--markdown'];
function mainLibrary(args){
  const L = require('./check-library');
  const usage = 'Usage: node tools/check-pack.js --library DIR [--base DIR] [--account LOGIN --account-id N] [--date YYYY-MM-DD] [--write-records] [--records-on-merge] [--json | --markdown]\n';
  const o = {};
  for(let i = 0; i < args.length; i++){
    const a = args[i];
    if(LIBRARY_FLAGS.includes(a)) o[a] = true;
    else if(LIBRARY_OPTIONS.includes(a) && i + 1 < args.length && !args[i + 1].startsWith('--')) o[a] = args[++i];
    else { process.stderr.write(`Unknown or incomplete option ${a}.\n` + usage); return 2; }
  }
  if(!o['--library'] || (o['--json'] && o['--markdown'])){ process.stderr.write(usage); return 2; }
  if(!!o['--account'] !== !!o['--account-id']){ process.stderr.write('--account and --account-id go together (the GitHub login and its numeric id).\n'); return 2; }
  let account = null;
  if(o['--account']){
    const id = Number(o['--account-id']);
    if(!L.LOGIN.test(o['--account']) || !/^[1-9][0-9]{0,15}$/.test(o['--account-id']) || !Number.isSafeInteger(id)){ process.stderr.write('That isn\'t a GitHub login and account id.\n'); return 2; }
    account = { login: o['--account'], id };
  }
  if(o['--date'] && !(/^\d{4}-\d{2}-\d{2}$/.test(o['--date']) && realDate(o['--date']))){ process.stderr.write('--date must be a real date, YYYY-MM-DD.\n'); return 2; }
  for(const d of [o['--library'], o['--base']].filter(Boolean)){
    if(!fs.existsSync(d) || !fs.statSync(d).isDirectory()){ process.stderr.write(`Can't read the folder ${d}.\n`); return 2; }
  }
  if(o['--records-on-merge'] && !o['--base']){ process.stderr.write('--records-on-merge is for a pull request; give --base.\n'); return 2; }
  const opts = { baseDir: o['--base'] || null, account, date: o['--date'], recordsOnMerge: !!o['--records-on-merge'] };
  let report;
  if(o['--write-records']){
    if(opts.baseDir){ process.stderr.write('--write-records works on one folder; leave out --base.\n'); return 2; }
    const w = L.writeRecords(o['--library'], opts);
    if(!w.written) process.stderr.write(w.reason + '\n');
    else process.stderr.write('Added records to ' + w.files.join(', ') + '.\n');
    if(!w.report) return 2;
    report = w.report;
  } else report = L.checkLibrary(o['--library'], opts);
  if(o['--json']) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else if(o['--markdown']) process.stdout.write(L.formatMarkdown(report));
  else process.stdout.write(L.formatLibraryReport(report) + '\n');
  return report.ok ? 0 : 1;
}

// `shared`: the shared code as the checker loaded it (the tests compare it with fmIDE).
module.exports = { checkPack, formatReport, hiddenCharacter, quote, CHECK_LIMITS, shared: S };
if(require.main === module) process.exitCode = main(process.argv);
