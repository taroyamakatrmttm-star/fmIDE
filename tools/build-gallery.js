// The showcase gallery (phase V6 of docs/viewer-brief.md): from a folder of made viewers (the
// .html files File → Make Showcase Viewer… or npm run make-viewers write), the site's /gallery —
//   gallery/index.html       a card per viewer (its picture, title, description, author, licence,
//                            size, Open and Download), in the sections gallery.json gives, else
//                            by title; and a list of the same viewers, a row each (hidden), the
//                            search box and the Grid / List switch (hidden): its one small
//                            script, src/gallery/gallery.js, shows them — without it, the cards
//                            as before
//   gallery/style.css        the catalogue's style sheet (src/library/style.css) and the gallery's
//                            own (src/gallery/gallery.css)
//   gallery/v/<id>.html      each viewer, REBUILT with the viewer's current page: only its three
//                            data blocks are read out of the file (as text, madeViewerBlocks),
//                            each read again with the shared readers, and filled into today's
//                            apps/fmViewer.html — so every gallery viewer runs exactly the site's
//                            own viewer code (one script hash, the policy's), whatever made it
//   gallery/p/<id>.png       its picture, when the folder has one (make-viewers --pictures)
// and the two rules of its security policy, on paths that never overlap (every matching _headers
// rule applies): the page runs only its own script, allowed by its exact hash (GALLERY_SCRIPT_HASH,
// worked out from the script's bytes; the owner's choice of 3 November 2026), loads nothing and
// connects to nothing; the viewers run only the viewer's own and connect to nothing.
// The viewers sit in a folder of their own, v/, so one rule covers them all
// (Cloudflare allows 100 rules in _headers). Every text through escapeXml, every link and file
// name from a checked id. A viewer that doesn't read, an id used twice or a list naming a viewer
// that isn't there stops the build (GalleryError, nothing written).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { escapeXml } = require('../src/shared/escaping.js');
const { fileTextProblem } = require('../src/shared/file-formats.js');
const { readFmData, FMIDE_FILE_MIGRATIONS } = require('../src/shared/fmide-files.js');
const SC = require('../src/shared/showcase.js');

const ROOT = path.join(__dirname, '..');
const h = (s) => escapeXml(String(s));
// The page's one script, its line ends made LF so its hash is the same on every computer.
const GALLERY_SCRIPT = fs.readFileSync(path.join(ROOT, 'src', 'gallery', 'gallery.js'), 'utf8').replace(/\r\n?/g, '\n');
if(/<\/script/i.test(GALLERY_SCRIPT) || /<!--/.test(GALLERY_SCRIPT)) throw new Error('src/gallery/gallery.js must not spell out a closing script tag or <!--.');
const GALLERY_SCRIPT_HASH = "'sha256-" + crypto.createHash('sha256').update(GALLERY_SCRIPT, 'utf8').digest('base64') + "'";
const GALLERY_POLICY = "default-src 'none'; script-src " + GALLERY_SCRIPT_HASH + "; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PICTURE_MAX = 2 * 1024 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

class GalleryError extends Error {}

// The gallery's two _headers rules: the page's, and the viewers' (viewerPolicy: the viewer
// page's own, as the site gives /fmViewer.html).
function galleryHeaders(viewerPolicy){
  return [
    { paths: ['/gallery', '/gallery/', '/gallery/index.html'], headers: ['Content-Security-Policy: ' + GALLERY_POLICY] },
    { paths: ['/gallery/v/*'], headers: ['Content-Security-Policy: ' + viewerPolicy] },
  ];
}

// A folder that holds a gallery: at least one .html in it (else none, like an empty library).
function findGallery(dir){
  if(!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  return fs.readdirSync(dir).some(n => /\.html?$/i.test(n)) ? dir : null;
}

// The scripts a page runs (its plain <script> blocks), for comparing two pages.
const pageScripts = (text) => [...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

// One made viewer read and rebuilt: { id, title, description, author, licence, page, size }.
function rebuildViewer(file, text, viewerPage){
  const say = (what) => new GalleryError(path.basename(file) + ': ' + what);
  const big = fileTextProblem(text);
  if(big) throw say(big);
  const r = SC.madeViewerBlocks(text);
  if(r.error) throw say(r.error);
  const parse = (block, what) => { try{ return JSON.parse(block); }catch(e){ throw say('its ' + what + ' is not readable.'); } };
  const scRaw = r.blocks.showcase ? parse(r.blocks.showcase, 'showcase') : { kind: SC.SHOWCASE_KIND, version: 1 };
  const sr = SC.readShowcaseData(scRaw);
  if(sr.error) throw say(sr.error);
  if(sr.recipe) throw say('its showcase is a recipe, which no viewer can show.');
  const sc = SC.cleanShowcase(sr.data).value;
  const model = parse(r.blocks.model, 'model');
  const m = readFmData(model, ['system', 'fmIDE-workspace'], FMIDE_FILE_MIGRATIONS);
  if(m.error) throw say('its model: ' + m.error);
  let excel = null;
  if(r.blocks.excel){
    excel = parse(r.blocks.excel, 'workbook');
    const w = SC.readViewerWorkbook(excel);
    if(w.error) throw say(w.error);
  }
  const id = sc.id || SC.showcaseIdFrom(path.basename(file).replace(/\.html?$/i, ''));
  if(!SC.SHOWCASE_ID.test(id)) throw say('it has no id a gallery address can be made of.');
  const filled = SC.fillViewerPage(viewerPage, SC.showcaseForFile(Object.assign({}, sc, { id })), model, excel);
  if(filled.error) throw say(filled.error);
  // The page served runs exactly the viewer's own scripts, as the policy's hash says.
  if(JSON.stringify(pageScripts(filled.page)) !== JSON.stringify(pageScripts(viewerPage))) throw say('rebuilt, it would run other scripts than the viewer\'s own.');
  return { id, title: sc.title || id, description: sc.description || '', author: sc.author || '', licence: sc.licence || '', page: filled.page, size: Buffer.byteLength(filled.page, 'utf8') };
}

const sizeText = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// What the page's search looks in: the title, the description and the section's name, one line.
const searchText = (v, section) => [v.title, v.description, section].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
// A description as one line for the list, cut at a word near 160 characters.
function oneLine(text){
  const t = String(text).replace(/\s+/g, ' ').trim();
  if(t.length <= 160) return t;
  const cut = t.slice(0, 160);
  const at = cut.lastIndexOf(' ');
  return (at > 100 ? cut.slice(0, at) : cut).replace(/[\s.,;:–—-]+$/, '') + '…';
}

function card(v, picture, section){
  const by = [v.author, v.licence, sizeText(v.size)].filter(Boolean).map(h).join(' · ');
  return [
    '<article class="viewer-card" data-id="' + v.id + '" data-search="' + h(searchText(v, section)) + '">',
    picture ? '<a class="viewer-picture" href="v/' + v.id + '"><img src="p/' + v.id + '.png" alt="" loading="lazy"></a>' : '',
    '<h3><a href="v/' + v.id + '">' + h(v.title) + '</a></h3>',
    v.description ? '<p>' + h(v.description) + '</p>' : '',
    '<p class="viewer-by">' + by + '</p>',
    '<p class="viewer-actions"><a class="viewer-open" href="v/' + v.id + '">Open</a> <a href="v/' + v.id + '.html" download="' + v.id + '.html">Download</a></p>',
    '</article>',
  ].filter(Boolean).join('\n');
}

function row(v, section){
  const desc = oneLine(v.description);
  return [
    '<li class="viewer-row" data-id="' + v.id + '" data-search="' + h(searchText(v, section)) + '">',
    '<a class="row-title" href="v/' + v.id + '">' + h(v.title) + '</a>',
    section ? '<span class="row-section">' + h(section) + '</span>' : '',
    desc ? '<span class="row-description">' + h(desc) + '</span>' : '',
    '<span class="row-actions"><a class="viewer-open" href="v/' + v.id + '">Open</a> <a href="v/' + v.id + '.html" download="' + v.id + '.html">Download</a></span>',
    '</li>',
  ].filter(Boolean).join('\n');
}

// The search box and the Grid / List switch, hidden until the script shows them.
const TOOLS = [
  '<div class="gallery-tools" id="galleryTools" hidden>',
  '<label class="gallery-search" for="gallerySearch">Search</label>',
  '<input type="search" id="gallerySearch" autocomplete="off" spellcheck="false" placeholder="Title, description or section">',
  '<span class="gallery-count" id="galleryCount" aria-live="polite"></span>',
  '<span class="gallery-views" role="group" aria-label="Show the viewers as"><button type="button" id="viewGrid" aria-pressed="true">Grid</button><button type="button" id="viewList" aria-pressed="false">List</button></span>',
  '</div>',
  '<p class="gallery-none" id="galleryNone" hidden>No viewer matches your search.</p>',
].join('\n');

// The guide (gallery.json version 2, `cleanGalleryGuide`): how the series connect, drawn here as
// an SVG from its boxes and arrows — every word through h(), every number from the grid, styled by
// the page's own style sheet (src/gallery/gallery.css), so the page's policy is unchanged — then
// its legend, caption and table, folded under a <details> so the viewers stay at the top.
const GRID = { x: 20, y: 30, col: 230, row: 115, w: 150, h: 60 };
function guideSvg(g){
  const at = new Map(g.boxes.map(b => {
    const x = GRID.x + b.col * GRID.col, y = GRID.y + b.row * GRID.row, w = GRID.w + (b.span - 1) * GRID.col;
    return [b.id, { x, y, w, cx: x + w / 2, cy: y + GRID.h / 2, b }];
  }));
  const width = Math.max(...[...at.values()].map(p => p.x + p.w)) + GRID.x;
  const height = Math.max(...[...at.values()].map(p => p.y + GRID.h)) + 46;
  const out = [];
  const text = (x, y, s, cls, anchor) => '<text x="' + x + '" y="' + y + '"' + ' class="' + [cls, anchor ? 'guide-' + anchor : ''].filter(Boolean).join(' ') + '"' + '>' + h(s) + '</text>';
  const line = (x1, y1, x2, y2, kind) => '<line class="guide-arrow ' + kind + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#guide-' + kind + ')"/>';
  g.labels.forEach(l => out.push(text(GRID.x, GRID.y + l.row * GRID.row - 10, l.text.toUpperCase(), 'guide-row', 'start')));
  const diagonalsInto = new Map();
  g.arrows.forEach(a => {
    const f = at.get(a.from), t = at.get(a.to);
    if(f.b.row === t.b.row){ // across: below the arrow, its label
      const [l, r] = f.x < t.x ? [f, t] : [t, f];
      const y = f.cy, x1 = f === l ? l.x + l.w : r.x, x2 = f === l ? r.x - 2 : l.x + l.w + 2, mid = (l.x + l.w + r.x) / 2;
      out.push(line(x1, y, x2, y, a.kind));
      a.label.forEach((s, k) => out.push(text(mid, y + 46 + k * 13, s, 'guide-label')));
      return;
    }
    const down = f.b.row < t.b.row, lo = Math.max(f.x, t.x), hi = Math.min(f.x + f.w, t.x + t.w);
    if(hi - lo >= 20){ // up or down, at the narrower box's middle
      const narrow = f.w <= t.w ? f : t, x = Math.min(Math.max(narrow.cx, lo + 10), hi - 10);
      const y1 = down ? f.y + GRID.h : f.y, y2 = down ? t.y - 4 : t.y + GRID.h + 4;
      out.push(line(x, y1, x, y2, a.kind));
      if(down) a.label.forEach((s, k) => out.push(text(x + 10, t.y - 24 + k * 13, s, 'guide-label', 'start')));
      else a.label.forEach((s, k) => out.push(text(x - 10, (y1 + y2) / 2 - 6 + k * 13, s, 'guide-label', 'end')));
      return;
    }
    // Diagonal: from the facing edge's middle to the facing edge of the other, each further one
    // into the same box landing a little further along it.
    const k = diagonalsInto.get(a.to) || 0; diagonalsInto.set(a.to, k + 1);
    const side = f.cx > t.cx ? 1 : -1;
    const fx = f.cx, fy = down ? f.y + GRID.h : f.y, tx = t.cx + side * Math.min(t.w / 2 - 8, 25 + 30 * k), ty = down ? t.y - 4 : t.y + GRID.h + 4;
    out.push(line(fx, fy, tx, ty, a.kind));
    a.label.forEach((s, n) => out.push(text(fx + side * 12, fy + 14 + n * 13, s, 'guide-label guide-muted', side > 0 ? 'start' : 'end')));
  });
  g.boxes.forEach(b => {
    const p = at.get(b.id);
    out.push('<rect class="guide-box ' + b.kind + '" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + GRID.h + '" rx="6"/>');
    const lines = b.title.map(s => [s, 'guide-title']).concat(b.note ? [[b.note, 'guide-note']] : []);
    const top = lines.length > 1 ? p.cy - 4 : p.cy + 5;
    lines.forEach(([s, cls], i) => out.push(text(p.cx, top + i * 18, s, cls)));
  });
  return '<svg class="guide-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + h(g.caption || g.title) + '">'
    + '<defs><marker id="guide-sequence" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="guide-head sequence" d="M0,0 L10,5 L0,10 z"/></marker>'
    + '<marker id="guide-related" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="guide-head related" d="M0,0 L10,5 L0,10 z"/></marker></defs>'
    + out.join('') + '</svg>';
}
function guideHtml(g){
  if(!g) return '';
  const parts = ['<details class="gallery-guide" id="galleryGuide"><summary>' + h(g.title) + '</summary>'];
  if(g.boxes.length){
    parts.push('<div class="guide-scroll">' + guideSvg(g) + '</div>');
    const keys = [['sequence', g.legend.sequence], ['related', g.legend.related]].filter(([, t]) => t);
    if(keys.length) parts.push('<p class="guide-legend">' + keys.map(([k, t]) => '<span class="guide-key ' + k + '"></span>' + h(t)).join(' ') + '</p>');
  }
  if(g.caption) parts.push('<p class="guide-caption">' + h(g.caption) + '</p>');
  if(g.table) parts.push('<div class="guide-table"><table><thead><tr>' + g.table.head.map(c => '<th>' + h(c) + '</th>').join('') + '</tr></thead><tbody>'
    + g.table.rows.map(r => '<tr>' + r.map(c => '<td>' + h(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
  parts.push('</details>');
  return parts.join('\n');
}

function indexPage(list, viewers, pictures){
  const byId = new Map(viewers.map(v => [v.id, v]));
  const title = list.title || 'Showcase gallery';
  const sections = [];
  const listed = new Set();
  list.sections.forEach(s => { s.viewers.forEach(id => listed.add(id)); sections.push({ title: s.title, viewers: s.viewers.map(id => byId.get(id)) }); });
  const rest = viewers.filter(v => !listed.has(v.id)).sort((a, b) => a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));
  if(rest.length) sections.push({ title: sections.length ? 'More' : '', viewers: rest });
  const main = [];
  main.push('<h1>' + h(title) + '</h1>');
  main.push('<p class="lead">' + (list.intro ? h(list.intro) : 'Models made with fmIDE: open one to move its sliders, see how each number is worked out and download it in Excel. Nothing is installed, and nothing you do leaves your device.') + '</p>');
  main.push('<p class="viewer-note">On an iPhone or iPad, <b>Open</b> runs a viewer in Safari; send its address to share it. A downloaded viewer opens there only in a preview, so keep downloads for a computer.</p>');
  if(list.guide) main.push(guideHtml(list.guide));
  if(!viewers.length) main.push('<p>No viewers yet.</p>');
  else main.push(TOOLS);
  main.push('<div id="viewerGrid">');
  sections.forEach(s => {
    main.push('<section>' + (s.title ? '<h2>' + h(s.title) + '</h2>' : ''));
    main.push('<div class="viewer-cards">');
    s.viewers.forEach(v => main.push(card(v, pictures.has(v.id), s.title)));
    main.push('</div></section>');
  });
  main.push('</div>');
  main.push('<ul class="viewer-rows" id="viewerList" hidden>');
  sections.forEach(s => s.viewers.forEach(v => main.push(row(v, s.title))));
  main.push('</ul>');
  return [
    '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + h(title) + '</title>', '<link rel="stylesheet" href="style.css">',
    '<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">', '</head>', '<body>',
    '<header class="top"><a class="home" href="./">' + h(title) + '</a><a href="../">Open fmIDE</a></header>',
    '<main>', main.join('\n'), '</main>',
    '<footer><p>Each model © its author, under the licence its card names. The viewer, fmShowcase, is licensed under the Apache License 2.0 (<a href="../LICENSE.txt">the full text</a>).</p></footer>',
    // The page's one script (search, Grid / List), allowed by its hash; none without viewers.
    ...(viewers.length ? ['<script>' + GALLERY_SCRIPT + '</script>'] : []),
    '</body>', '</html>', ''
  ].join('\n');
}

// The gallery from a folder: { files: Map site path → Buffer, viewers: [{ id, title, size }] }.
// viewerPage: the viewer's page as the site serves it (its scripts the ones the policy hashes).
function buildGallery(dir, viewerPage){
  if(typeof viewerPage !== 'string' || !viewerPage) throw new GalleryError('No viewer page to build the gallery with.');
  const names = fs.readdirSync(dir).sort();
  const viewers = [];
  const ids = new Map();
  names.filter(n => /\.html?$/i.test(n)).forEach(n => {
    const file = path.join(dir, n);
    const v = rebuildViewer(file, fs.readFileSync(file, 'utf8'), viewerPage);
    if(ids.has(v.id)) throw new GalleryError(n + ': its id "' + v.id + '" is ' + ids.get(v.id) + '\'s too; each viewer needs its own.');
    ids.set(v.id, n);
    viewers.push(v);
  });
  let list = { title: '', intro: '', sections: [] };
  const listFile = path.join(dir, 'gallery.json');
  if(fs.existsSync(listFile)){
    let raw;
    try{ raw = JSON.parse(fs.readFileSync(listFile, 'utf8')); }catch(e){ throw new GalleryError('gallery.json is not a JSON file.'); }
    const r = SC.cleanGalleryList(raw);
    if(r.error) throw new GalleryError(r.error);
    if(r.problems.length) throw new GalleryError('gallery.json: ' + r.problems.join(' '));
    r.value.sections.forEach(s => s.viewers.forEach(id => { if(!ids.has(id)) throw new GalleryError('gallery.json names the viewer "' + id + '", which is not in the folder.'); }));
    list = r.value;
  }
  const pictures = new Set();
  const files = new Map();
  viewers.forEach(v => {
    files.set('gallery/v/' + v.id + '.html', Buffer.from(v.page, 'utf8'));
    const pic = path.join(dir, v.id + '.png');
    if(!fs.existsSync(pic)) return;
    const bytes = fs.readFileSync(pic);
    if(bytes.length > PICTURE_MAX || !bytes.subarray(0, 8).equals(PNG)) throw new GalleryError(v.id + '.png is not a PNG picture of at most 2 MB.');
    pictures.add(v.id);
    files.set('gallery/p/' + v.id + '.png', bytes);
  });
  files.set('gallery/index.html', Buffer.from(indexPage(list, viewers, pictures), 'utf8'));
  files.set('gallery/style.css', Buffer.concat([fs.readFileSync(path.join(ROOT, 'src', 'library', 'style.css')), Buffer.from('\n'), fs.readFileSync(path.join(ROOT, 'src', 'gallery', 'gallery.css'))]));
  return { files, viewers: viewers.map(v => ({ id: v.id, title: v.title, size: v.size, picture: pictures.has(v.id) })) };
}

module.exports = { buildGallery, findGallery, galleryHeaders, GalleryError, guideHtml, GALLERY_POLICY, GALLERY_SCRIPT, GALLERY_SCRIPT_HASH, pageScripts };
