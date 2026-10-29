// The showcase gallery (phase V6 of docs/viewer-brief.md): from a folder of made viewers (the
// .html files File → Make Showcase Viewer… or npm run make-viewers write), the site's /gallery —
//   gallery/index.html       a plain page, no JavaScript: a card per viewer (its picture, title,
//                            description, author, licence, size, Open and Download), in the
//                            sections gallery.json gives, else by title
//   gallery/style.css        the catalogue's style sheet (src/library/style.css) and the gallery's
//                            own (src/gallery/gallery.css)
//   gallery/v/<id>.html      each viewer, REBUILT with the viewer's current page: only its three
//                            data blocks are read out of the file (as text, madeViewerBlocks),
//                            each read again with the shared readers, and filled into today's
//                            apps/fmViewer.html — so every gallery viewer runs exactly the site's
//                            own viewer code (one script hash, the policy's), whatever made it
//   gallery/p/<id>.png       its picture, when the folder has one (make-viewers --pictures)
// and the two rules of its security policy, on paths that never overlap (every matching _headers
// rule applies): the page runs no script at all; the viewers run only the viewer's own and
// connect to nothing. The viewers sit in a folder of their own, v/, so one rule covers them all
// (Cloudflare allows 100 rules in _headers). Every text through escapeXml, every link and file
// name from a checked id. A viewer that doesn't read, an id used twice or a list naming a viewer
// that isn't there stops the build (GalleryError, nothing written).
'use strict';

const fs = require('fs');
const path = require('path');
const { escapeXml } = require('../src/shared/escaping.js');
const { fileTextProblem } = require('../src/shared/file-formats.js');
const { readFmData, FMIDE_FILE_MIGRATIONS } = require('../src/shared/fmide-files.js');
const SC = require('../src/shared/showcase.js');

const ROOT = path.join(__dirname, '..');
const h = (s) => escapeXml(String(s));
const GALLERY_POLICY = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
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

function card(v, picture){
  const by = [v.author, v.licence, sizeText(v.size)].filter(Boolean).map(h).join(' · ');
  return [
    '<article class="viewer-card">',
    picture ? '<a class="viewer-picture" href="v/' + v.id + '"><img src="p/' + v.id + '.png" alt="" loading="lazy"></a>' : '',
    '<h3><a href="v/' + v.id + '">' + h(v.title) + '</a></h3>',
    v.description ? '<p>' + h(v.description) + '</p>' : '',
    '<p class="viewer-by">' + by + '</p>',
    '<p class="viewer-actions"><a class="viewer-open" href="v/' + v.id + '">Open</a> <a href="v/' + v.id + '.html" download="' + v.id + '.html">Download</a></p>',
    '</article>',
  ].filter(Boolean).join('\n');
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
  if(!viewers.length) main.push('<p>No viewers yet.</p>');
  sections.forEach(s => {
    main.push('<section>' + (s.title ? '<h2>' + h(s.title) + '</h2>' : ''));
    main.push('<div class="viewer-cards">');
    s.viewers.forEach(v => main.push(card(v, pictures.has(v.id))));
    main.push('</div></section>');
  });
  return [
    '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + h(title) + '</title>', '<link rel="stylesheet" href="style.css">',
    '<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">', '</head>', '<body>',
    '<header class="top"><a class="home" href="./">' + h(title) + '</a><a href="../">Open fmIDE</a></header>',
    '<main>', main.join('\n'), '</main>',
    '<footer><p>Each model © its author, under the licence its card names. The viewer, fmShowcase, is licensed under the Apache License 2.0 (<a href="../LICENSE.txt">the full text</a>).</p></footer>',
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

module.exports = { buildGallery, findGallery, galleryHeaders, GalleryError, GALLERY_POLICY, pageScripts };
