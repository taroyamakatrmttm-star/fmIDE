// ---------- library packs (shared: src/shared/library-pack.js; step 8, phase 8a) ----------
// A library pack is one file of templates, recipes and functions to share with other people
// (kind "fmIDE-library-pack", docs/file-formats.md). Its `pack` object says what it is and
// who made it. Everything in it comes from someone else, so it is checked here and only ever
// shown as plain text. Pure functions: fmIDE reads packs with them, and the library's
// checker (phase 8c) can run them in Node.

// The licences a shared item may carry (decision: CC BY 4.0 only, for now).
const LIBRARY_PACK_LICENCES = {
  'CC-BY-4.0': { short: 'CC BY 4.0', name: 'Creative Commons Attribution 4.0 International',
    summary: 'anyone may use, change and share it, including commercially, with credit to the author' }
};
const LIBRARY_PACK_LIMITS = { title: 120, author: 120, description: 2000, tags: 10, tag: 40, items: 500 };

// Text a person typed or a file holds: trimmed, one line (or not), at most `max` characters.
function packText(v, max, multiline){
  if(typeof v !== 'string') return '';
  let s = v.replace(/\r\n?/g, '\n');
  if(!multiline) s = s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}
// Tags: a list (or comma-separated text), lower case, no duplicates, at most 10 of 40
// characters each.
function packTags(v){
  const list = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',') : []);
  const out = [];
  list.forEach(t => {
    const s = packText(t, LIBRARY_PACK_LIMITS.tag).toLowerCase();
    if(s && !out.includes(s) && out.length < LIBRARY_PACK_LIMITS.tags) out.push(s);
  });
  return out;
}

// A pack's `pack` object read from a file (or typed when saving). Returns { info } with only
// the known fields, cleaned, or { error } saying what is missing.
function cleanLibraryPackInfo(p){
  if(!p || typeof p !== 'object' || Array.isArray(p)) return { error: "This library pack doesn't say what it is (it has no \"pack\" details)." };
  const id = typeof p.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(p.id) ? p.id : null;
  if(!id) return { error: "This library pack has no valid id." };
  const title = packText(p.title, LIBRARY_PACK_LIMITS.title);
  if(!title) return { error: 'This library pack has no title.' };
  const author = packText(p.author, LIBRARY_PACK_LIMITS.author);
  if(!author) return { error: 'This library pack doesn\'t say who made it (no author).' };
  const licence = typeof p.licence === 'string' ? p.licence.trim() : '';
  if(!Object.prototype.hasOwnProperty.call(LIBRARY_PACK_LICENCES, licence)) {
    return { error: licence
      ? `This library pack's licence ("${licence.slice(0, 40)}") isn't one fmIDE accepts for shared items (only CC BY 4.0).`
      : 'This library pack has no licence, so nobody may use what is in it.' };
  }
  const info = { id, title, author, licence,
    description: packText(p.description, LIBRARY_PACK_LIMITS.description, true),
    tags: packTags(p.tags) };
  if(typeof p.created === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.created)) info.created = p.created;
  return { info };
}

// ---------- where an item came from (phase 8b) ----------
// A template or function version added from a library pack remembers the pack:
// `origin: { packId, packTitle, author, licence }` (docs/file-formats.md). It is a record of
// what the pack said, not proof. Read from a file it is untrusted like everything else: the
// same rules as the pack details; anything else is dropped. Returns a clean copy or null
// (then the item simply has no origin).
function cleanItemOrigin(o){
  if(!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const packId = typeof o.packId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(o.packId) ? o.packId : null;
  const packTitle = packText(o.packTitle, LIBRARY_PACK_LIMITS.title);
  const author = packText(o.author, LIBRARY_PACK_LIMITS.author);
  const licence = typeof o.licence === 'string' ? o.licence.trim() : '';
  if(!packId || !packTitle || !author || !Object.prototype.hasOwnProperty.call(LIBRARY_PACK_LICENCES, licence)) return null;
  return { packId, packTitle, author, licence };
}
// The origin an item gets from the pack (cleaned `pack` details) it is added from.
function originFromPack(info){
  return { packId: info.id, packTitle: info.title, author: info.author, licence: info.licence };
}
// Whether two author names are the same person's, as far as fmIDE can tell: capitals and
// spaces don't count.
function sameAuthorName(a, b){
  const k = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return !!k(a) && k(a) === k(b);
}
// One line for people: 'From the library pack "…" by … · CC BY 4.0'.
function originText(o){
  const lic = LIBRARY_PACK_LICENCES[o.licence];
  return `From the library pack “${o.packTitle}” by ${o.author}` + (lic ? ` · ${lic.short}` : '');
}

// ---------- the library's list (phase 8d) ----------
// /library/index.json (kind "fmIDE-library-index", docs/file-formats.md), written by the
// site's build (tools/build-library.js) and read by fmIDE's Browse Library. Every text in it
// comes from the packs, so it is checked like a pack: an entry that fails any check is left
// out whole (the rest are still shown), and what is kept is only ever shown as plain text.
// Addresses are never taken from it: fmIDE builds a pack's address from its id alone.
const LIBRARY_INDEX_LIMITS = { bytes: 10 * 1024 * 1024, packs: 5000, packBytes: 5 * 1024 * 1024 };
// Characters that make text look different from what it is (the same ones the library's
// checker refuses, tools/check-pack.js): they change the direction of text, are invisible,
// or are control characters (a line break is allowed where text may have several lines).
const LIBRARY_HIDDEN_CHARACTERS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u00AD\u180E\u200B-\u200D\u2060-\u2064\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/;
function hasHiddenCharacter(text){ return typeof text === 'string' && LIBRARY_HIDDEN_CHARACTERS.test(text); }
const LIBRARY_INDEX_KINDS = ['module', 'system', 'recipe'];
// One entry of the list, checked. Returns { entry } (only the known fields, cleaned) or
// { error } (a short reason, for the count of packs that could not be shown).
function cleanLibraryIndexEntry(e){
  if(!e || typeof e !== 'object' || Array.isArray(e)) return { error: 'not an entry' };
  const info = cleanLibraryPackInfo(e);
  if(info.error) return { error: info.error };
  const id = info.info.id;
  const texts = [e.title, e.author, e.description].concat(Array.isArray(e.tags) ? e.tags : []);
  if(texts.some(hasHiddenCharacter)) return { error: 'hidden characters in its details' };
  if(e.page !== id || e.file !== 'packs/' + id + '.fmide-pack.json') return { error: 'its addresses are not its own' };
  if(!Number.isInteger(e.bytes) || e.bytes < 1 || e.bytes > LIBRARY_INDEX_LIMITS.packBytes) return { error: 'its size is wrong' };
  if(typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.sha256)) return { error: 'no fingerprint' };
  if(!Number.isInteger(e.packVersion) || e.packVersion < 1) return { error: 'no pack version' };
  const date = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  if(!Array.isArray(e.items) || e.items.length > 2 * LIBRARY_PACK_LIMITS.items) return { error: 'no items' };
  const uid = (v) => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v);
  const items = [];
  for(const it of e.items){
    if(!it || typeof it !== 'object' || Array.isArray(it)) return { error: 'an item is not an item' };
    if(it.type !== 'template' && it.type !== 'function') return { error: 'an item of an unknown type' };
    if(it.type === 'template' && !LIBRARY_INDEX_KINDS.includes(it.kind)) return { error: 'a template of an unknown kind' };
    if(!uid(it.family) || !uid(it.versionId) || !Number.isInteger(it.version) || it.version < 1) return { error: 'an item without its ids' };
    if([it.name, it.group, it.note, it.description].some(hasHiddenCharacter)) return { error: 'hidden characters in an item' };
    const name = packText(it.name, 200);
    if(!name) return { error: 'an item without a name' };
    const item = { type: it.type, kind: it.type === 'function' ? 'function' : it.kind, name, family: it.family, version: it.version,
      versionId: it.versionId, group: packText(it.group, 80), description: packText(it.description, LIBRARY_PACK_LIMITS.description, true),
      note: packText(it.note, 200), origin: null };
    if(it.origin !== undefined){
      const o = it.origin;
      if(o && typeof o === 'object' && [o.packTitle, o.author].some(hasHiddenCharacter)) return { error: 'hidden characters in an item' };
      item.origin = cleanItemOrigin(o);
      if(!item.origin) return { error: 'an item with a bad origin' };
    }
    items.push(item);
  }
  const n = (k) => items.filter(it => it.kind === k).length;
  const c = e.counts;
  if(!c || typeof c !== 'object' || c.templates !== n('module') + n('system') || c.recipes !== n('recipe') || c.functions !== n('function'))
    return { error: 'its counts do not match its items' };
  const entry = Object.assign({}, info.info, { added: date(e.added), bytes: e.bytes, sha256: e.sha256, packVersion: e.packVersion,
    counts: { templates: c.templates, recipes: c.recipes, functions: c.functions }, items });
  if(!entry.created) entry.created = null;
  return { entry };
}
