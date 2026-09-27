// The library mode of the pack checker (step 8, phase 8c-2; docs/step8-community-library.md):
// checks a whole community-library folder, and — given the folder as it was before — what a
// pull request changes in it. Node only, no packages, no git and no network: CI hands it the
// two folders. Used through tools/check-pack.js:
//
//   node tools/check-pack.js --library DIR [--base DIR] [--account LOGIN --account-id N]
//                            [--date YYYY-MM-DD] [--write-records] [--json | --markdown]
//
// The library folder holds packs/<pack id>.fmide-pack.json and three records, which are only
// ever added to (never changed): families.json (who owns each template or function family:
// the GitHub account of the first approved pack that holds it), authors.json (each account's
// author name) and packs.json (every approved pack: its account, date, hash and version ids —
// kept when a pack is taken down, so no id is ever used again). checker.json names the fmIDE
// commit whose checker the library's CI runs, and the maintainers.
//
// Accounts are recorded by GitHub's numeric user id (a login can be renamed, and a freed login
// taken by someone else); the login is kept beside it for people to read.
//
// Every text in a pack is someone else's: reports quote it only through the checker's quote(),
// and the Markdown report (for the pull request) puts it inside a fenced block, where nothing
// renders, with the characters that could close the block written as \uXXXX.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { checkPack, formatReport, quote, shared: S } = require('./check-pack');

const RECORD_FILES = { families: 'families.json', authors: 'authors.json', packs: 'packs.json' };
const RECORD_KINDS = { families: 'fmIDE-library-families', authors: 'fmIDE-library-authors', packs: 'fmIDE-library-packs', checker: 'fmIDE-library-checker' };
const PACKS_DIR = 'packs';
const PACK_SUFFIX = '.fmide-pack.json';
// Files a library holds at its top; others are warned about.
const KNOWN_TOP = new Set(['README.md', 'SUBMITTING.md', 'LICENSING.md', 'LICENSE-CC-BY-4.0.txt', 'LICENSE-APACHE-2.0.txt',
  'checker.json', 'families.json', 'authors.json', 'packs.json', '.gitignore', '.gitattributes']);
const KNOWN_TOP_DIRS = new Set([PACKS_DIR, '.github']);
// What a submission may change; anything else is for the maintainers.
const SUBMITTER_FILES = (p) => p.startsWith(PACKS_DIR + '/') || Object.values(RECORD_FILES).includes(p);
// GitHub's rule for a login: letters, digits and single dashes, at most 39.
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPOSITORY = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
// The Markdown report stays under GitHub's limit for a comment (65,536 characters).
const MARKDOWN_MAX = 60000;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isAccountId = (v) => Number.isSafeInteger(v) && v > 0;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function realDate(s){
  if(typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// An item as it was approved, apart from where it came from: two copies of one version match
// when this text is the same (fmIDE writes a version shared again exactly as it read it).
function itemText(item){
  const copy = Object.assign({}, item);
  delete copy.origin;
  return JSON.stringify(copy);
}
function sortedObject(o){
  const out = {};
  Object.keys(o).sort().forEach(k => { out[k] = o[k]; });
  return out;
}
function sameJSON(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

// ---- reading a library folder ----
// Every file under `dir` (not .git), as { 'relative/path': Buffer }.
function readFolder(dir){
  const files = new Map();
  const walk = (rel) => {
    const abs = path.join(dir, rel);
    fs.readdirSync(abs, { withFileTypes: true }).forEach(e => {
      const r = rel ? rel + '/' + e.name : e.name;
      if(e.name === '.git') return;
      if(e.isDirectory()) walk(r);
      else if(e.isFile()) files.set(r, fs.readFileSync(path.join(dir, r)));
      else files.set(r, null); // links and the like: reported, never followed
    });
  };
  walk('');
  return files;
}

// A record file's entries, checked. Returns { entries, problems } — entries only those that
// are well-formed, so later checks can go on.
function readRecord(files, name, out){
  const file = RECORD_FILES[name];
  const empty = {};
  if(!files.has(file)){ out.error(file, 'The library has no ' + file + '.', { missing: true }); return empty; }
  let data;
  try{ data = JSON.parse(files.get(file).toString('utf8')); }
  catch(e){ out.error(file, 'It isn\'t valid JSON (' + String(e.message).slice(0, 120) + ').'); return empty; }
  if(!isObject(data) || data.kind !== RECORD_KINDS[name]) { out.error(file, `Its "kind" isn't "${RECORD_KINDS[name]}".`); return empty; }
  if(data.version !== 1) { out.error(file, 'Its "version" isn\'t 1, the one this checker reads.'); return empty; }
  const map = data[name];
  if(!isObject(map)) { out.error(file, `It has no "${name}" list.`); return empty; }
  const extra = Object.keys(data).filter(k => !['kind', 'version', name].includes(k));
  if(extra.length) out.error(file, `It has fields the library doesn't use: ${extra.map(quote).join(', ')}.`);
  const entries = {};
  Object.keys(map).forEach(key => {
    const problem = ENTRY_CHECKS[name](key, map[key]);
    if(problem) out.error(file, `Its entry ${quote(key)} ${problem}`);
    else entries[key] = map[key];
  });
  return entries;
}
function fieldsProblem(e, fields){
  if(!isObject(e)) return 'isn\'t a record.';
  const extra = Object.keys(e).filter(k => !fields.includes(k));
  if(extra.length) return `has fields the library doesn't use (${extra.map(quote).join(', ')}).`;
  return null;
}
const ENTRY_CHECKS = {
  families(key, e){
    if(!S.isTemplateUid(key)) return 'isn\'t a family id (8–64 letters, digits and dashes).';
    const f = fieldsProblem(e, ['type', 'kind', 'accountId', 'account', 'firstPack', 'added']);
    if(f) return f;
    if(e.type !== 'template' && e.type !== 'function') return 'has a "type" that isn\'t "template" or "function".';
    if(e.type === 'template' && !['module', 'system', 'recipe'].includes(e.kind)) return 'has a "kind" that isn\'t "module", "system" or "recipe".';
    if(e.type === 'function' && e.kind !== undefined) return 'is a function but has a "kind".';
    return accountProblem(e) || (S.isTemplateUid(e.firstPack) ? null : 'has no valid "firstPack".') || (realDate(e.added) ? null : 'has no real date ("added", YYYY-MM-DD).');
  },
  authors(key, e){
    if(!/^[1-9][0-9]{0,15}$/.test(key) || !isAccountId(Number(key))) return 'isn\'t a GitHub account id.';
    const f = fieldsProblem(e, ['account', 'author', 'added']);
    if(f) return f;
    if(typeof e.account !== 'string' || !LOGIN.test(e.account)) return 'has no valid "account" (a GitHub login).';
    const clean = S.cleanLibraryPackInfo({ id: 'author-check', title: 'x', author: e.author, licence: 'CC-BY-4.0' });
    if(clean.error || clean.info.author !== e.author) return 'has no valid "author" (one line, at most ' + S.LIBRARY_PACK_LIMITS.author + ' characters, no extra spaces).';
    return realDate(e.added) ? null : 'has no real date ("added", YYYY-MM-DD).';
  },
  packs(key, e){
    if(!S.isTemplateUid(key)) return 'isn\'t a pack id (8–64 letters, digits and dashes).';
    const f = fieldsProblem(e, ['accountId', 'account', 'added', 'sha256', 'versions']);
    if(f) return f;
    if(typeof e.sha256 !== 'string' || !SHA256.test(e.sha256)) return 'has no valid "sha256".';
    if(!Array.isArray(e.versions) || !e.versions.length || e.versions.some(v => !S.isTemplateUid(v)) || new Set(e.versions).size !== e.versions.length) return 'has no valid "versions" (the version ids of its items, each once).';
    return accountProblem(e) || (realDate(e.added) ? null : 'has no real date ("added", YYYY-MM-DD).');
  }
};
function accountProblem(e){
  if(!isAccountId(e.accountId)) return 'has no valid "accountId" (a GitHub account id).';
  if(typeof e.account !== 'string' || !LOGIN.test(e.account)) return 'has no valid "account" (a GitHub login).';
  return null;
}
// checker.json: the fmIDE commit and the maintainers.
function readChecker(files, out){
  if(!files.has('checker.json')){ out.error('checker.json', 'The library has no checker.json.'); return null; }
  let c;
  try{ c = JSON.parse(files.get('checker.json').toString('utf8')); }
  catch(e){ out.error('checker.json', 'It isn\'t valid JSON.'); return null; }
  const bad = (m) => { out.error('checker.json', m); return null; };
  if(!isObject(c) || c.kind !== RECORD_KINDS.checker || c.version !== 1) return bad(`Its "kind" isn't "${RECORD_KINDS.checker}" version 1.`);
  if(!isObject(c.fmide) || typeof c.fmide.repository !== 'string' || !REPOSITORY.test(c.fmide.repository)) return bad('It doesn\'t name fmIDE\'s repository ("fmide.repository", owner/name).');
  if(typeof c.fmide.commit !== 'string' || !COMMIT.test(c.fmide.commit)) return bad('It doesn\'t name a commit of fmIDE ("fmide.commit", the full 40-character id — never a branch).');
  if(!Array.isArray(c.maintainers) || !c.maintainers.length || c.maintainers.some(m => fieldsProblem(m, ['accountId', 'account']) || accountProblem(m))) {
    return bad('Its "maintainers" isn\'t a list of { accountId, account }.');
  }
  return c;
}

// ---- checking a library ----
// Checks the library in `headDir`; with `opts.baseDir`, also what changed since that folder
// (a pull request). opts: { baseDir, account: { login, id }, date }.
// Returns the report: { ok, mode, account, summary, recordsToAdd, errors, warnings, notes, packs }.
function checkLibrary(headDir, opts){
  opts = opts || {};
  const report = { ok: false, mode: opts.baseDir ? 'pull-request' : 'library', library: headDir,
    account: opts.account ? { login: opts.account.login, id: opts.account.id } : null,
    summary: { packs: 0, newPacks: [], takedowns: [], newFamilies: [], newAuthors: [], reshared: [] },
    recordsToAdd: null, errors: [], warnings: [], notes: [], packs: [] };
  const add = (list) => (where, message, extra) => list.push(Object.assign({ where, message }, extra || {}));
  const out = { error: add(report.errors), warning: add(report.warnings), note: add(report.notes) };
  const done = () => { report.ok = !report.errors.length && report.packs.every(p => p.ok); return report; };
  const date = opts.date || new Date().toISOString().slice(0, 10);

  const files = readFolder(headDir);
  const baseFiles = opts.baseDir ? readFolder(opts.baseDir) : null;

  // ---- the layout ----
  files.forEach((buf, p) => {
    if(buf === null) return out.error(p, 'It isn\'t an ordinary file (a link or the like); the library holds only files.');
    const top = p.split('/')[0];
    if(p.includes('/')){
      if(!KNOWN_TOP_DIRS.has(top)) out.warning(p, 'The library doesn\'t use this folder.');
      else if(top === PACKS_DIR && !isPackPath(p)) out.error(p, `The ${PACKS_DIR} folder holds only packs, each named after its pack id (<pack id>${PACK_SUFFIX}).`);
    } else if(!KNOWN_TOP.has(p)) out.warning(p, 'The library doesn\'t use this file.');
  });
  const checker = readChecker(files, out);
  const baseChecker = baseFiles ? readChecker(baseFiles, { error: () => {}, warning: () => {}, note: () => {} }) : null;
  // The maintainers are the ones on the side the pull request can't change.
  const maintainers = ((baseFiles ? baseChecker : checker) || { maintainers: [] }).maintainers;
  const isMaintainer = !!opts.account && maintainers.some(m => m.accountId === opts.account.id);
  const rec = {};
  Object.keys(RECORD_FILES).forEach(k => { rec[k] = readRecord(files, k, out); });
  // The records as they were before the pull request (none when checking a library alone).
  const baseRec = {};
  const quiet = { error: () => {}, warning: () => {}, note: () => {} };
  if(baseFiles) Object.keys(RECORD_FILES).forEach(k => { baseRec[k] = baseFiles.has(RECORD_FILES[k]) ? readRecord(baseFiles, k, quiet) : {}; });
  // A pack not yet approved: new in the pull request, or without a record.
  const isNewPack = (id) => baseFiles ? !has(baseRec.packs, id) : !rec.packs[id];

  // ---- the packs ----
  const packs = new Map(); // id -> { id, file, bytes, raw, report }
  files.forEach((buf, p) => {
    if(buf === null || !isPackPath(p)) return;
    const r = checkPack(buf, p);
    // In the library a pack must be named after its id: the note becomes an error.
    r.notes = r.notes.filter(n => {
      if(!/will be named/.test(n.message)) return true;
      r.errors.push({ where: 'file', message: `It must be named ${r.pack.id}${PACK_SUFFIX} (its pack id).` });
      r.ok = false;
      return false;
    });
    report.packs.push(r);
    if(!r.pack) return;
    let raw = null;
    try{ raw = JSON.parse(buf.toString('utf8')); }catch(e){ /* checkPack said so */ }
    if(packs.has(r.pack.id)) { out.error(p, `Another file holds the pack id ${r.pack.id} too.`); return; }
    packs.set(r.pack.id, { id: r.pack.id, file: p, bytes: buf, raw, report: r });
  });
  report.summary.packs = packs.size;

  // Items of every pack, for matching versions across the library.
  const itemsOf = (pk) => {
    if(!pk.raw) return [];
    const t = (Array.isArray(pk.raw.templates) ? pk.raw.templates : []).filter(isObject).map(x => ({ type: 'template', raw: x }));
    const f = (Array.isArray(pk.raw.functions) ? pk.raw.functions : []).filter(isObject).map(x => ({ type: 'function', raw: x }));
    return t.concat(f).map(it => Object.assign(it, {
      family: it.raw.family, version: it.raw.version, versionId: it.raw.versionId, kind: it.type === 'template' ? it.raw.kind : undefined,
      name: it.type === 'template' ? it.raw.name : S.functionNameOf(it.raw), text: itemText(it.raw),
      where: `pack ${pk.id}: ${it.type} ${quote(it.type === 'template' ? it.raw.name : S.functionNameOf(it.raw))} v${it.raw.version}`,
      pack: pk, reshared: !!(isObject(it.raw.origin) && it.raw.origin.packId !== pk.id) }));
  };

  // ---- records for every pack; what is missing is worked out, to be written or shown ----
  const toAdd = { families: {}, authors: {}, packs: {} };
  const accountOf = (pk) => rec.packs[pk.id] ? { id: rec.packs[pk.id].accountId, login: rec.packs[pk.id].account } : null;
  const missingRecord = (where, message) => out.error(where, message, { missing: true });
  // Authors named by the packs without a record, per account (one account, one name).
  packs.forEach(pk => {
    const r = pk.report;
    if(!r.ok) return;
    const record = rec.packs[pk.id];
    const items = itemsOf(pk);
    if(!record){
      if(!opts.account) { missingRecord(pk.file, `The pack has no record in packs.json. Run the checker with --account and --account-id (the submitting GitHub account) to work it out.`); return; }
      toAdd.packs[pk.id] = { accountId: opts.account.id, account: opts.account.login, added: date, sha256: sha256(pk.bytes), versions: items.map(i => i.versionId) };
      missingRecord(pk.file, 'The pack has no record in packs.json.');
    } else {
      if(record.sha256 !== sha256(pk.bytes)) out.error(pk.file, 'The file isn\'t the one approved: its hash differs from its record in packs.json. Approved packs are never edited; put a new version in a new pack.');
      if(!sameJSON(record.versions, items.map(i => i.versionId))) out.error(pk.file, 'Its record in packs.json lists other version ids than the pack holds.');
    }
    // The author name and the account.
    const acc = accountOf(pk) || (opts.account ? { id: opts.account.id, login: opts.account.login } : null);
    const known = rec.authors[String(acc.id)] || toAdd.authors[String(acc.id)];
    if(known){
      if(!S.sameAuthorName(known.author, r.pack.author)) out.error(pk.file, `Its author, ${quote(r.pack.author)}, isn't the name the account ${acc.login} shares under (${quote(known.author)}).`);
    } else {
      toAdd.authors[String(acc.id)] = { account: acc.login, author: r.pack.author, added: date };
      missingRecord('authors.json', `The account ${acc.login} (${acc.id}) has no author name in authors.json yet.`);
    }
    const taken = Object.keys(rec.authors).concat(Object.keys(toAdd.authors)).find(id => id !== String(acc.id) &&
      S.sameAuthorName((rec.authors[id] || toAdd.authors[id]).author, r.pack.author));
    if(taken) out.error(pk.file, `Its author name, ${quote(r.pack.author)}, belongs to another account (${(rec.authors[taken] || toAdd.authors[taken]).account}).`);
  });
  if(Object.keys(rec.authors).length){
    const names = Object.keys(rec.authors);
    names.forEach((a, i) => names.slice(i + 1).forEach(b => {
      if(S.sameAuthorName(rec.authors[a].author, rec.authors[b].author)) out.error('authors.json', `The accounts ${rec.authors[a].account} and ${rec.authors[b].account} use the same author name.`);
    }));
  }
  // Packs whose record stays but whose file is gone: taken down.
  Object.keys(rec.packs).forEach(id => { if(!packs.has(id)) out.note('packs.json', `The pack ${id} has a record but no file: it was taken down. Its ids stay used.`); });
  // Every pack record's account has an author name.
  Object.keys(rec.packs).forEach(id => { if(!rec.authors[String(rec.packs[id].accountId)] && !toAdd.authors[String(rec.packs[id].accountId)]) out.error('packs.json', `The pack ${id}'s account ${rec.packs[id].account} has no entry in authors.json.`); });

  // ---- items across the library ----
  const allItems = [];
  packs.forEach(pk => { if(pk.report.ok) allItems.push(...itemsOf(pk)); });
  const byVersionId = new Map();
  allItems.forEach(it => { if(!byVersionId.has(it.versionId)) byVersionId.set(it.versionId, []); byVersionId.get(it.versionId).push(it); });
  // The version as first approved comes first: a copy of one's own before one shared again,
  // then the earliest record.
  const approved = (it) => (rec.packs[it.pack.id] ? rec.packs[it.pack.id].added : '9999-99-99') + ' ' + it.pack.id;
  byVersionId.forEach(list => list.sort((a, b) => (a.reshared - b.reshared) || (approved(a) < approved(b) ? -1 : approved(a) > approved(b) ? 1 : 0)));
  // Version ids of packs taken down: still used.
  const takenDownIds = new Map();
  Object.keys(rec.packs).forEach(id => { if(!packs.has(id)) rec.packs[id].versions.forEach(v => takenDownIds.set(v, id)); });

  allItems.forEach(it => {
    const acc = accountOf(it.pack) || (opts.account ? opts.account : null);
    // One version id is one version: everywhere the same family, number and content.
    const same = byVersionId.get(it.versionId);
    const first = same[0];
    if(first !== it){
      if(first.family !== it.family || first.version !== it.version || first.type !== it.type) out.error(it.where, `Its version id is already used by ${first.where}, a different version.`);
      else if(first.text !== it.text) out.error(it.where, `It isn't an exact copy of ${first.where}, which has the same version id. An approved version is never changed; a new version needs a new version id (fmIDE gives one when you save a new version).`);
    }
    // A version of a pack taken down isn't shared again in a new pack, unless an approved
    // pack still holds it as its owner's.
    if(takenDownIds.has(it.versionId) && isNewPack(it.pack.id) && !same.some(o => !o.reshared && !isNewPack(o.pack.id))) out.error(it.where, `Its version id was used in the pack ${takenDownIds.get(it.versionId)}, which was taken down; it can't be shared again.`);
    const clash = allItems.find(o => o !== it && o.family === it.family && o.version === it.version && o.versionId !== it.versionId);
    if(clash) out.error(it.where, `Version ${it.version} of this family is already in the library as a different version (${clash.where}).`);
    // Sharing again: an exact copy of a version approved in the pack its origin names.
    if(it.reshared){
      const o = it.raw.origin;
      const from = packs.get(o.packId);
      if(!from){
        out.error(it.where, rec.packs[o.packId]
          ? `It says it came from the pack ${o.packId}, which was taken down; it can't be shared again.`
          : `It says it came from the pack ${o.packId} (${quote(o.packTitle)} by ${quote(o.author)}), which isn't in the library.`);
        return;
      }
      const fp = from.report.pack;
      if(!fp || fp.title !== o.packTitle || fp.author !== o.author || fp.licence !== o.licence) {
        out.error(it.where, `Its origin doesn't match the pack ${o.packId}: the title, author and licence must be exactly that pack's.`);
        return;
      }
      const orig = itemsOf(from).find(x => x.versionId === it.versionId);
      if(!orig || orig.reshared) out.error(it.where, `The pack ${o.packId} doesn't hold this version as its own, so it can't be shared again as coming from there.`);
      else if(orig.text !== it.text) out.error(it.where, `It isn't an exact copy of the version approved in the pack ${o.packId}; only an exact copy may be shared again. A version of your own in someone else's family is not accepted.`);
      else report.summary.reshared.push({ pack: it.pack.id, type: it.type, family: it.family, version: it.version, from: o.packId });
      return;
    }
    // Your own work: the family is yours, or new and becomes yours.
    const fam = rec.families[it.family] || toAdd.families[it.family];
    if(fam){
      if(fam.type !== it.type || (it.type === 'template' && fam.kind !== it.kind)) out.error(it.where, `Its family is recorded as ${fam.type === 'template' ? 'a ' + fam.kind + ' template' : 'a function'} in families.json; one family is one kind.`);
      if(acc && fam.accountId !== acc.id) out.error(it.where, `Its family belongs to the account ${fam.account} (first shared in the pack ${fam.firstPack}); only a family's owner adds versions to it. To share their version, share it exactly as fmIDE saves it, with its origin; to build on it, save it as a new ${it.type} of your own.`);
      else if(acc && first !== it && !first.reshared) out.note(it.where, `It is already in the library (${first.where}); the same version, shared again by its owner.`);
    } else if(acc) {
      toAdd.families[it.family] = it.type === 'template'
        ? { type: 'template', kind: it.kind, accountId: acc.id, account: acc.login, firstPack: it.pack.id, added: date }
        : { type: 'function', accountId: acc.id, account: acc.login, firstPack: it.pack.id, added: date };
      report.summary.newFamilies.push({ family: it.family, type: it.type, kind: it.kind, pack: it.pack.id, account: acc.login });
      missingRecord(it.where, 'Its family has no record in families.json; this pack is its first.');
    }
  });
  // Families recorded: their first pack is recorded, by the same account.
  Object.keys(rec.families).forEach(f => {
    const e = rec.families[f], p = rec.packs[e.firstPack];
    if(!p) out.error('families.json', `The family ${f}'s first pack, ${e.firstPack}, has no record in packs.json.`);
    else if(p.accountId !== e.accountId) out.error('families.json', `The family ${f} is recorded for the account ${e.account}, but its first pack is ${p.account}'s.`);
    else if(packs.has(e.firstPack) && !itemsOf(packs.get(e.firstPack)).some(it => it.family === f)) out.error('families.json', `The family ${f}'s first pack, ${e.firstPack}, doesn't hold it.`);
  });

  // ---- what the pull request changes ----
  if(baseFiles){
    if(!opts.account) out.error('pull request', 'The submitting account isn\'t known (--account and --account-id).');
    const changed = [];
    new Set([...files.keys(), ...baseFiles.keys()]).forEach(p => {
      const a = baseFiles.get(p), b = files.get(p);
      if(a === undefined) changed.push({ path: p, how: 'added' });
      else if(b === undefined) changed.push({ path: p, how: 'removed' });
      else if(!(a && b && a.equals(b))) changed.push({ path: p, how: 'changed' });
    });
    if(!isMaintainer) changed.filter(c => !SUBMITTER_FILES(c.path)).forEach(c => out.error(c.path, `It is ${c.how} by the pull request; only the library's maintainers change its own files. A submission adds a pack and its records.`));
    const addedPacks = changed.filter(c => isPackPath(c.path) && c.how === 'added').map(c => c.path);
    changed.filter(c => isPackPath(c.path) && c.how === 'changed').forEach(c => out.error(c.path, 'An approved pack is never edited. Put a new version in a new pack.'));
    const removed = changed.filter(c => isPackPath(c.path) && c.how === 'removed').map(c => c.path);
    removed.forEach(p => { report.summary.takedowns.push(packIdOfPath(p)); out.warning(p, 'The pull request removes this pack: a takedown. Its records stay, so its ids are never used again.'); });
    if(removed.length && addedPacks.length) out.error('pull request', 'It removes packs and adds packs; a takedown is a pull request of its own.');
    // Records only added.
    Object.keys(RECORD_FILES).forEach(k => {
      Object.keys(baseRec[k]).forEach(key => {
        if(has(rec[k], key) && sameJSON(rec[k][key], baseRec[k][key])) return;
        const what = `The pull request ${has(rec[k], key) ? 'changes' : 'removes'} the entry ${quote(key)}; records are only ever added.`;
        if(isMaintainer && !addedPacks.length) out.warning(RECORD_FILES[k], what + ' (A maintainer\'s change of records: check it is meant.)');
        else out.error(RECORD_FILES[k], what + (isMaintainer ? ' A change of records is a pull request of its own.' : ''));
      });
      // New entries name the submitting account, and new packs.
      Object.keys(rec[k]).filter(key => !has(baseRec[k], key)).forEach(key => {
        const e = rec[k][key];
        const accId = k === 'authors' ? Number(key) : e.accountId;
        if(opts.account && accId !== opts.account.id && !isMaintainer) out.error(RECORD_FILES[k], `Its new entry ${quote(key)} names the account ${k === 'authors' ? e.account : e.account}, not the one submitting (${opts.account.login}).`);
        if(k === 'packs' && !addedPacks.includes(PACKS_DIR + '/' + key + PACK_SUFFIX)) out.error('packs.json', `Its new entry ${quote(key)} is for a pack the pull request doesn't add.`);
        if(k === 'families' && !addedPacks.includes(PACKS_DIR + '/' + e.firstPack + PACK_SUFFIX)) out.error('families.json', `Its new entry ${quote(key)} names a first pack the pull request doesn't add.`);
        if(k === 'packs') report.summary.newPacks.push(packSummary(packs.get(key), key));
        if(k === 'families') report.summary.newFamilies.push({ family: key, type: e.type, kind: e.kind, pack: e.firstPack, account: e.account });
        if(k === 'authors') report.summary.newAuthors.push({ accountId: accId, account: e.account });
      });
    });
    // A pack id is never used again, even after a takedown.
    addedPacks.forEach(p => {
      const id = packIdOfPath(p);
      if(has(baseRec.packs, id)) out.error(p, `The pack id ${id} was used before (by a pack that was taken down, or approved already); every pack needs a new id. Save the pack again from fmIDE.`);
      if(!has(rec.packs, id) && !report.summary.newPacks.some(x => x.id === id)) report.summary.newPacks.push(packSummary(packs.get(id), id));
    });
    // Only the pull request's own packs may be missing records; anything else was already wrong.
    report.errors.forEach(e => { if(e.missing && e.where !== 'authors.json' && !addedPacks.some(p => e.where === p || e.where.startsWith('pack ' + packIdOfPath(p) + ':'))) e.missing = false; });
  } else {
    Object.keys(toAdd.packs).forEach(id => report.summary.newPacks.push(packSummary(packs.get(id), id)));
    Object.keys(toAdd.authors).forEach(id => report.summary.newAuthors.push({ accountId: Number(id), account: toAdd.authors[id].account }));
  }
  // Families first counted from the missing records (library mode) aren't counted twice.
  const seenFam = new Set();
  report.summary.newFamilies = report.summary.newFamilies.filter(f => !seenFam.has(f.family) && seenFam.add(f.family));
  if(Object.keys(toAdd.packs).length || Object.keys(toAdd.families).length || Object.keys(toAdd.authors).length) {
    report.recordsToAdd = { families: sortedObject(toAdd.families), authors: sortedObject(toAdd.authors), packs: sortedObject(toAdd.packs) };
  }
  return done();
}
function isPackPath(p){
  const m = /^packs\/([^/]+)\.fmide-pack\.json$/.exec(p);
  return !!m && S.isTemplateUid(m[1]);
}
function packIdOfPath(p){ return p.slice(PACKS_DIR.length + 1, -PACK_SUFFIX.length); }
function packSummary(pk, id){
  const r = pk && pk.report && pk.report.pack;
  return { id, title: r ? r.title : null, author: r ? r.author : null, counts: pk ? pk.report.counts : null };
}

// ---- writing the records ----
// Adds the records a library's packs are missing (never changing one) and returns the report
// of the library as written. Refuses (writes nothing) when anything else is wrong.
function writeRecords(dir, opts){
  if(!opts || !opts.account) return { written: false, reason: 'The submitting account is needed (--account and --account-id).' };
  const before = checkLibrary(dir, Object.assign({}, opts, { baseDir: null }));
  const blocking = before.errors.filter(e => !e.missing).length + before.packs.filter(p => !p.ok).length;
  if(blocking) return { written: false, reason: 'The library has errors other than missing records; nothing was written.', report: before };
  if(!before.recordsToAdd) return { written: false, reason: 'No records are missing.', report: before };
  const files = [];
  Object.keys(RECORD_FILES).forEach(k => {
    const add = before.recordsToAdd[k];
    if(!Object.keys(add).length) return;
    const file = path.join(dir, RECORD_FILES[k]);
    const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { kind: RECORD_KINDS[k], version: 1, [k]: {} };
    Object.keys(add).forEach(key => { if(!has(data[k], key)) data[k][key] = add[key]; });
    data[k] = sortedObject(data[k]);
    fs.writeFileSync(file, JSON.stringify({ kind: data.kind, version: data.version, [k]: data[k] }, null, 2) + '\n');
    files.push(RECORD_FILES[k]);
  });
  return { written: true, files, added: before.recordsToAdd, report: checkLibrary(dir, Object.assign({}, opts, { baseDir: null })) };
}

// ---- reports ----
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function countErrors(r){ return r.errors.length + r.packs.reduce((n, p) => n + p.errors.length, 0); }
function countWarnings(r){ return r.warnings.length + r.packs.reduce((n, p) => n + p.warnings.length, 0); }
// The summary: only the checker's own words, numbers, ids and GitHub logins — never pack text.
function summaryLines(r){
  const s = r.summary, lines = [];
  if(r.account) lines.push(`Submitted by the GitHub account ${r.account.login} (id ${r.account.id}).`);
  lines.push(`${plural(s.packs, 'pack')} in the library; ${r.mode === 'pull-request' ? 'this pull request adds ' + plural(s.newPacks.length, 'pack') : plural(s.newPacks.length, 'pack') + ' without records'}.`);
  s.newPacks.forEach(p => lines.push(`New pack ${p.id}` + (p.counts ? `: ${plural(p.counts.templates, 'template')}, ${plural(p.counts.recipes, 'recipe')}, ${plural(p.counts.functions, 'function')}` : '') + '.'));
  s.newFamilies.forEach(f => lines.push(`Claims the ${f.type === 'template' ? f.kind + ' template' : 'function'} family ${f.family} for ${f.account} (first pack ${f.pack}).`));
  s.newAuthors.forEach(a => lines.push(`New author: the account ${a.account} (id ${a.accountId}).`));
  s.reshared.forEach(x => lines.push(`Shares again ${x.type} ${x.family} v${x.version} from the pack ${x.from} (an exact copy, with its origin).`));
  s.takedowns.forEach(id => lines.push(`Takes down the pack ${id}.`));
  return lines;
}
function formatLibraryReport(r){
  const lines = ['Checking the library' + (r.mode === 'pull-request' ? ': what the pull request changes' : '')];
  summaryLines(r).forEach(l => lines.push('  ' + l));
  const section = (title, list, mark) => {
    if(!list.length) return;
    lines.push(`  ${title} (${list.length}):`);
    list.forEach(x => lines.push(`    ${mark} ${x.where}: ${x.message}`));
  };
  section('Errors', r.errors, '✗');
  section('Warnings', r.warnings, '!');
  section('Notes', r.notes, '·');
  if(r.recordsToAdd) {
    lines.push('  Records to add (run with --write-records, or add these entries):');
    JSON.stringify(r.recordsToAdd, null, 2).split('\n').forEach(l => lines.push('    ' + l));
  }
  lines.push(`  Result: ${r.ok ? 'PASSED' : 'FAILED'} — ${plural(countErrors(r), 'error')}, ${plural(countWarnings(r), 'warning')}.`);
  return lines.join('\n') + (r.packs.length ? '\n\n' + r.packs.map(formatReport).join('\n\n') : '');
}
// For a pull request: a heading and summary in the checker's own words, then the full report
// in a fenced block. Pack text reaches the block only through quote() (hidden characters as
// \uXXXX); backticks and tildes are written as ` and ~ as well, so nothing in it can
// close the block, and inside it nothing renders — no links, images, HTML or @mentions.
function formatMarkdown(r){
  const fenceSafe = (t) => t.replace(/[`~]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
  const head = [];
  head.push(`## Library check: ${r.ok ? 'PASSED ✅' : 'FAILED ❌'}`, '');
  head.push(`${plural(countErrors(r), 'error')}, ${plural(countWarnings(r), 'warning')}.`, '');
  summaryLines(r).forEach(l => head.push('- ' + l));
  if(r.recordsToAdd) head.push('', 'Records are missing: add the entries listed at the end of the report (or a maintainer runs the checker with `--write-records`).');
  head.push('', '<details open><summary>The full report</summary>', '', '~~~~text');
  const tail = ['~~~~', '', '</details>'];
  let body = fenceSafe(formatLibraryReport(r));
  const room = MARKDOWN_MAX - head.join('\n').length - tail.join('\n').length - 200;
  if(body.length > room) body = body.slice(0, room).replace(/\n[^\n]*$/, '') + '\n… (cut short; the whole report is in the job\'s log)';
  return head.concat([body], tail).join('\n') + '\n';
}

module.exports = { checkLibrary, writeRecords, formatLibraryReport, formatMarkdown, readFolder, LOGIN, RECORD_KINDS, MARKDOWN_MAX };
