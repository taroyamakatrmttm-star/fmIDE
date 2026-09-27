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
