// Writes the community library's catalogue (step 8, phase 8c-3; docs/step8-community-library.md)
// into the site: plain HTML pages with no JavaScript, the pack files to download, and
// index.json for browsing inside fmIDE (8d, Browse Library). Called by tools/build.js when the library
// folder is there (the git submodule library/, pinned to one commit). Node only, no packages,
// no network.
//
//   library/index.html                     /library/            every pack
//   library/<pack id>.html                 /library/<pack id>   one pack: its items and credit
//   library/packs/<pack id>.fmide-pack.json                     the pack, byte for byte
//   library/index.json                                          the list, for Browse Library (8d)
//   library/style.css                                           from src/library/style.css
//   library/LICENSE-CC-BY-4.0.txt                               the licence of every item
//
// The library is checked again first, with the library checker (tools/check-library.js): if
// anything fails, nothing is published (the build stops with the checker's report).
//
// Everything in a pack is someone else's text: it goes into a page only through escapeXml()
// (src/shared/escaping.js), and never into an address — links are built from pack ids, which
// the checker allows only as letters, digits and dashes.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
// The repository people report items in, and submit packs to.
const LIBRARY_REPOSITORY = 'https://github.com/taroyamakatrmttm-star/fmide-library';
const LICENCES = { 'CC-BY-4.0': { short: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } };
const INDEX_DESCRIPTION_MAX = 300;

// escapeXml from the shared code, loaded into a context of its own (as the checker loads it).
const escapeXml = vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'escaping.js'), 'utf8') + '\n;escapeXml',
  vm.createContext({}));
const h = (s) => escapeXml(s == null ? '' : s);

class LibraryError extends Error {}

// The library folder, or null when there is none: missing, or empty (a submodule that was
// never fetched leaves an empty folder).
function findLibrary(dir){
  if(!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  return fs.readdirSync(dir).some(n => n !== '.git') ? dir : null;
}

// Checks the library and returns its catalogue as a Map of site path → Buffer (paths under
// library/). Throws a LibraryError, with the checker's report, when the library fails.
function buildLibrary(dir){
  const { checkLibrary, formatLibraryReport } = require('./check-library');
  const { shared: S } = require('./check-pack');
  const report = checkLibrary(dir);
  if(!report.ok) throw new LibraryError('The library in ' + path.relative(ROOT, dir) + ' fails its check, so nothing is published:\n' + formatLibraryReport(report));

  const records = JSON.parse(fs.readFileSync(path.join(dir, 'packs.json'), 'utf8')).packs;
  const packs = fs.readdirSync(path.join(dir, 'packs')).sort().map(name => {
    const bytes = fs.readFileSync(path.join(dir, 'packs', name));
    const raw = JSON.parse(bytes.toString('utf8'));
    const record = records[raw.pack.id];
    return { id: raw.pack.id, name, bytes, raw, info: raw.pack, added: record.added, sha256: record.sha256 };
  });
  packs.forEach(p => { p.items = itemsOf(p, S); p.counts = countsOf(p.items); });
  // Newest approved first, then by title.
  packs.sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0) || a.info.title.localeCompare(b.info.title) || (a.id < b.id ? -1 : 1));
  const byId = new Map(packs.map(p => [p.id, p]));

  const files = new Map();
  files.set('library/index.html', Buffer.from(indexPage(packs), 'utf8'));
  packs.forEach(p => {
    files.set('library/' + p.id + '.html', Buffer.from(packPage(p, byId), 'utf8'));
    files.set('library/packs/' + p.id + '.fmide-pack.json', p.bytes);
  });
  const index = indexJson(packs);
  // fmIDE's Browse Library reads the list with the shared reader, leaving out any entry that
  // fails its checks: every pack the catalogue publishes must pass it.
  const read = S.readLibraryIndexData(JSON.parse(JSON.stringify(index)));
  if(read.error || read.dropped || read.packs.length !== packs.length) throw new LibraryError('The library\'s list (index.json) would not read in fmIDE' + (read.error ? ': ' + read.error : ' (' + (read.dropped || packs.length - read.packs.length) + ' pack(s) left out)') + ', so nothing is published.');
  files.set('library/index.json', Buffer.from(JSON.stringify(index, null, 2) + '\n', 'utf8'));
  files.set('library/style.css', fs.readFileSync(path.join(ROOT, 'src', 'library', 'style.css')));
  files.set('library/LICENSE-CC-BY-4.0.txt', fs.readFileSync(path.join(ROOT, 'docs', 'LICENSE-CC-BY-4.0.txt')));
  return { files, packs: packs.length };
}

// ---- what a pack holds ----
const KIND_ORDER = ['recipe', 'module', 'system', 'function'];
const KIND_TITLE = { recipe: 'Recipes', module: 'Canvas templates', system: 'System templates', function: 'Functions' };
const KIND_ONE = { recipe: 'recipe', module: 'canvas template', system: 'system template', function: 'function' };

function itemsOf(p, S){
  const items = [];
  (p.raw.templates || []).forEach(t => items.push({ type: 'template', kind: t.kind, raw: t, name: t.name, family: t.family, version: t.version, versionId: t.versionId }));
  (p.raw.functions || []).forEach(f => items.push({ type: 'function', kind: 'function', raw: f, name: S.functionNameOf(f), family: f.family, version: f.version, versionId: f.versionId }));
  // Grouped by kind, in the pack's own order within each.
  const sorted = [];
  KIND_ORDER.forEach(k => items.filter(it => it.kind === k).forEach(it => sorted.push(it)));
  sorted.forEach((it, i) => {
    it.anchor = 'item-' + (i + 1);
    const o = it.raw.origin;
    it.reshared = !!(o && o.packId !== p.id) ? o : null;
    if(it.type === 'template' && it.kind !== 'recipe') it.model = S.readFmData(it.raw.data, [it.kind], S.FMIDE_FILE_MIGRATIONS).data;
  });
  return sorted;
}
function countsOf(items){
  const n = (k) => items.filter(it => it.kind === k).length;
  return { templates: n('module') + n('system'), recipes: n('recipe'), functions: n('function') };
}
function countsText(items){
  return KIND_ORDER.map(k => {
    const n = items.filter(it => it.kind === k).length;
    return n ? n + ' ' + KIND_ONE[k] + (n === 1 ? '' : 's') : null;
  }).filter(Boolean).join(' · ');
}
// Names, each once, in the order first met.
function uniqueNames(list){
  const out = [];
  list.forEach(s => { if(typeof s === 'string' && s.trim() && !out.includes(s)) out.push(s); });
  return out;
}
// The item in this pack a recipe part or a function call means (for a link on the page).
function findInPack(items, family, version, versionId){
  const same = items.filter(it => it.family === family);
  if(version === 'latest') return same.sort((a, b) => b.version - a.version)[0] || null;
  return same.find(it => versionId && it.versionId === versionId) || same.find(it => it.version === version) || null;
}

// ---- pages ----
function page(title, main){
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + h(title) + '</title>',
    '<link rel="stylesheet" href="style.css">',
    '<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">',
    '</head>',
    '<body>',
    '<header class="top"><a class="home" href="./">fmIDE community library</a><a href="../">Open fmIDE</a></header>',
    '<main>',
    main,
    '</main>',
    '<footer>',
    '<p>Items © their authors, each licensed under <a href="' + LICENCES['CC-BY-4.0'].url + '" rel="license noopener noreferrer">CC BY 4.0</a> (<a href="LICENSE-CC-BY-4.0.txt">the full text</a>). fmIDE is licensed under the Apache License 2.0 (<a href="../LICENSE.txt">the full text</a>).</p>',
    '</footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}
function licenceLink(code){
  const l = LICENCES[code];
  return '<a href="' + l.url + '" rel="license noopener noreferrer">' + l.short + '</a>';
}
function tagList(tags){
  return tags && tags.length ? '<ul class="tags">' + tags.map(t => '<li>' + h(t) + '</li>').join('') + '</ul>' : '';
}
const reportAddress = (id) => LIBRARY_REPOSITORY + '/issues/new?template=report-an-item.yml&title=' + encodeURIComponent('Report: pack ' + id) + '&pack=' + encodeURIComponent(id);
function takedownText(){
  return '<p>If the report holds up, the pack is taken down: it leaves the library and this catalogue. Its records stay, so its ids are never used again, and copies already downloaded stay their owners’, under CC BY 4.0.</p>';
}

function indexPage(packs){
  const out = [];
  out.push('<h1>fmIDE community library</h1>');
  out.push('<p class="lead">Templates, recipes and functions shared by people who build models in fmIDE. Everything here is formulas and layout, never code. Each pack is licensed by its author under ' + licenceLink('CC-BY-4.0') + '.</p>');
  out.push('<section class="how"><h2>Using a pack</h2><ol><li>Open its page and download it.</li><li>In fmIDE, choose <b>File → Open Library Pack…</b> and pick the file. fmIDE shows what the pack holds before adding anything; untick what you don’t want, then <b>Add to My Library</b>.</li></ol></section>');
  out.push('<section><h2>Packs (' + packs.length + ')</h2>');
  if(!packs.length) out.push('<p>No packs yet.</p>');
  else out.push('<ul class="packs">' + packs.map(p => {
    const d = p.info.description || '';
    const short = d.length > INDEX_DESCRIPTION_MAX ? d.slice(0, INDEX_DESCRIPTION_MAX).trimEnd() + '…' : d;
    return '<li class="pack">' +
      '<h3><a href="' + p.id + '">' + h(p.info.title) + '</a></h3>' +
      '<p class="by">by ' + h(p.info.author) + ' · added ' + h(p.added) + '</p>' +
      '<p class="counts">' + h(countsText(p.items)) + ' · ' + LICENCES[p.info.licence].short + '</p>' +
      (short ? '<p class="description">' + h(short) + '</p>' : '') +
      tagList(p.info.tags) + '</li>';
  }).join('\n') + '</ul>');
  out.push('</section>');
  out.push('<section><h2>Sharing your own</h2><p>In fmIDE, <b>File → Save as Library Pack…</b>, then submit the file to the library’s repository as a pull request. Read <a href="' + LIBRARY_REPOSITORY + '#sharing-a-pack" rel="noopener noreferrer">how to share a pack</a> and the <a href="' + LIBRARY_REPOSITORY + '/blob/main/SUBMITTING.md" rel="noopener noreferrer">submission terms</a> first. Every pack is checked automatically and approved by the maintainer.</p></section>');
  out.push('<section><h2>Reporting an item</h2><p>If a pack holds something that isn’t its author’s to share, credits the wrong person, or is harmful or broken, use <b>Report this pack</b> on its page, or <a href="' + LIBRARY_REPOSITORY + '/issues/new?template=report-an-item.yml" rel="noopener noreferrer">report an item</a> in the library’s repository.</p>' + takedownText() + '</section>');
  return page('fmIDE community library', out.join('\n'));
}

function packPage(p, byId){
  const i = p.info, out = [];
  out.push('<p class="back"><a href="./">← All packs</a></p>');
  out.push('<h1>' + h(i.title) + '</h1>');
  out.push('<p class="by">by ' + h(i.author) + '</p>');
  out.push('<dl class="details">' +
    '<dt>Added to the library</dt><dd>' + h(p.added) + '</dd>' +
    (i.created ? '<dt>Saved</dt><dd>' + h(i.created) + '</dd>' : '') +
    '<dt>Licence</dt><dd>' + licenceLink(i.licence) + '</dd>' +
    '<dt>Holds</dt><dd>' + h(countsText(p.items)) + '</dd>' +
    '<dt>Pack id</dt><dd><code>' + h(p.id) + '</code></dd>' +
    '</dl>');
  out.push(tagList(i.tags));
  if(i.description) out.push('<p class="description">' + h(i.description) + '</p>');
  out.push('<section class="download"><p><a class="button" href="packs/' + p.id + '.fmide-pack.json" download="' + p.id + '.fmide-pack.json">Download the pack (' + kb(p.bytes.length) + ')</a></p>' +
    '<p>Then in fmIDE: <b>File → Open Library Pack…</b></p>' +
    '<p class="hash">SHA-256 (a fingerprint of the file): <code>' + h(p.sha256) + '</code></p></section>');
  out.push('<section><h2>What it holds</h2>');
  KIND_ORDER.forEach(k => {
    const list = p.items.filter(it => it.kind === k);
    if(!list.length) return;
    out.push('<h3>' + KIND_TITLE[k] + '</h3>');
    out.push('<ul class="items">' + list.map(it => itemHtml(it, p, byId)).join('\n') + '</ul>');
  });
  out.push('</section>');
  // The credit CC BY 4.0 asks for: title, author, source, licence.
  out.push('<section class="credit"><h2>How to credit it</h2>' +
    '<p>CC BY 4.0 lets you use, change and share these items, commercially too, with credit to the author. For example:</p>' +
    '<blockquote>“' + h(i.title) + '” by ' + h(i.author) + ', from the fmIDE community library (pack <code>' + h(p.id) + '</code>), licensed under ' + licenceLink(i.licence) + '.</blockquote>' +
    reshareCredits(p, byId) +
    '<p>If you change an item, say so. fmIDE keeps this record for you: the Templates window and the Functions manager show where each item came from.</p></section>');
  out.push('<section class="report"><h2>Reporting this pack</h2><p>If it holds something that isn’t its author’s to share, credits the wrong person, or is harmful or broken: <a href="' + h(reportAddress(p.id)) + '" rel="noopener noreferrer">Report this pack</a>.</p>' + takedownText() + '</section>');
  return page(i.title + ' — fmIDE community library', out.join('\n'));
}
function kb(bytes){ return Math.max(1, Math.round(bytes / 1024)) + ' KB'; }

function reshareCredits(p, byId){
  const seen = new Map();
  p.items.filter(it => it.reshared).forEach(it => {
    const o = it.reshared;
    if(!seen.has(o.packId)) seen.set(o.packId, { o, names: [] });
    seen.get(o.packId).names.push(it.name + ' v' + it.version);
  });
  if(!seen.size) return '';
  return '<p>Some items were shared again from other packs; credit their authors too:</p><ul>' + [...seen.values()].map(({ o, names }) =>
    '<li>' + h(names.join(', ')) + ': “' + h(o.packTitle) + '” by ' + h(o.author) + ' (' + packLink(o.packId, byId, 'pack ' + o.packId) + '), licensed under ' + licenceLink(o.licence) + '.</li>').join('') + '</ul>';
}
function packLink(id, byId, text){
  return byId.has(id) ? '<a href="' + id + '">' + h(text) + '</a>' : h(text);
}

function itemHtml(it, p, byId){
  const r = it.raw, parts = [];
  parts.push('<h4>' + h(it.name) + ' <span class="version">version ' + it.version + '</span></h4>');
  if(it.reshared) parts.push('<p class="origin">Shared again from “' + h(it.reshared.packTitle) + '” by ' + h(it.reshared.author) + ' (' + packLink(it.reshared.packId, byId, 'its pack') + ')</p>');
  if(r.group) parts.push('<p class="group">Group: ' + h(r.group) + '</p>');
  if(r.description) parts.push('<p class="description">' + h(r.description) + '</p>');
  if(r.note) parts.push('<p class="note">Change note: ' + h(r.note) + '</p>');
  if(it.kind === 'recipe'){
    parts.push('<p>Builds, one canvas each:</p><ol class="parts">' + r.data.parts.map(part => {
      const hit = findInPack(p.items, part.family, part.version, part.versionId);
      const label = (part.name || (hit && hit.name) || 'a canvas template') + (part.version === 'latest' ? ' (latest)' : ' v' + part.version);
      return '<li>' + (hit ? '<a href="#' + hit.anchor + '">' + h(label) + '</a>' : h(label)) + '</li>';
    }).join('') + '</ol>');
  } else if(it.kind === 'module'){
    const nodes = Array.isArray(it.model.nodes) ? it.model.nodes : [];
    const rects = nodes.filter(n => n && n.type === 'value').length;
    const plugs = uniqueNames([].concat(...nodes.map(n => (n && Array.isArray(n.plugs)) ? n.plugs : [])));
    const sockets = uniqueNames(nodes.map(n => n && n.socket));
    parts.push('<p>' + rects + ' rectangle' + (rects === 1 ? '' : 's') + '</p>');
    if(plugs.length) parts.push('<p>Plugs: ' + plugs.map(s => '<span class="name">' + h(s) + '</span>').join(', ') + '</p>');
    if(sockets.length) parts.push('<p>Sockets: ' + sockets.map(s => '<span class="name">' + h(s) + '</span>').join(', ') + '</p>');
  } else if(it.kind === 'system'){
    const canvases = Array.isArray(it.model.canvases) ? it.model.canvases : [];
    const periods = Array.isArray(it.model.periods) ? it.model.periods.length : 0;
    parts.push('<p>' + canvases.length + ' canvas' + (canvases.length === 1 ? '' : 'es') + ': ' + canvases.map(c => '<span class="name">' + h(c && c.name) + '</span>').join(', ') + '</p>');
    if(periods) parts.push('<p>' + periods + ' period' + (periods === 1 ? '' : 's') + '</p>');
  } else {
    parts.push('<pre class="formula"><code>' + h(r.text) + '</code></pre>');
    const calls = Array.isArray(r.calls) ? r.calls : [];
    if(calls.length) parts.push('<p>Uses: ' + calls.map(c => {
      const hit = findInPack(p.items, c.family, c.version, c.versionId);
      const label = c.name + ' v' + c.version;
      return hit ? '<a href="#' + hit.anchor + '">' + h(label) + '</a>' : h(label);
    }).join(', ') + '</p>');
  }
  return '<li class="item" id="' + it.anchor + '">' + parts.join('') + '</li>';
}

// ---- index.json (kind fmIDE-library-index, docs/file-formats.md) ----
function indexJson(packs){
  return {
    kind: 'fmIDE-library-index',
    version: 1,
    packs: packs.map(p => ({
      id: p.id, title: p.info.title, author: p.info.author, licence: p.info.licence,
      description: p.info.description || '', tags: p.info.tags || [],
      created: p.info.created || null, added: p.added,
      page: p.id, file: 'packs/' + p.id + '.fmide-pack.json',
      bytes: p.bytes.length, sha256: p.sha256, packVersion: p.raw.version,
      counts: p.counts,
      items: p.items.map(it => {
        const e = { type: it.type };
        if(it.type === 'template') e.kind = it.kind;
        Object.assign(e, { name: it.name, family: it.family, version: it.version, versionId: it.versionId });
        if(it.raw.group) e.group = it.raw.group;
        e.description = it.raw.description || '';
        if(it.raw.note) e.note = it.raw.note;
        if(it.raw.origin) e.origin = it.raw.origin;
        return e;
      })
    }))
  };
}

// The site's HTTP headers for the catalogue (added to _headers by tools/build.js, always —
// with or without a library, so the app's version never depends on it). No scripts at all,
// styles only from the site, no connections, forms or embedding; pack files download.
const LIBRARY_POLICY = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const LIBRARY_HEADERS = [
  { paths: ['/library', '/library/*'], headers: ['Content-Security-Policy: ' + LIBRARY_POLICY] },
  { paths: ['/library/packs/*'], headers: ['Content-Disposition: attachment'] }
];

module.exports = { findLibrary, buildLibrary, LIBRARY_HEADERS, LibraryError, LIBRARY_POLICY, LIBRARY_REPOSITORY };
