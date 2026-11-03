// 98. The showcase gallery (phase V6 of docs/viewer-brief.md), in Node: tools/build-gallery.js
// with a stand-in for the viewer's page (its three empty data blocks and a script of its own),
// so no app is needed and no app's change can alter what is checked here. The site served with a
// gallery — the policies applied, the viewers running, the page's search and Grid / List in the
// browser — is group 91's.
// Samples: tests/fixtures/viewer/gallery/ — three viewers made with an older, smaller page (so
// they must be rebuilt), one with a workbook block, one with markup in every text; gallery.json;
// a picture.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const G = require('../tools/build-gallery.js');
const S = require('../src/shared/showcase.js');

const DIR = path.join(__dirname, 'fixtures', 'viewer', 'gallery');
const END = '<' + '/script>';
const PAGE = '<!doctype html><title>today</title><script>var today = "the viewer as built now";' + END + '\n'
  + S.VIEWER_BLOCKS.showcase + '\n' + S.VIEWER_BLOCKS.model + '\n' + S.VIEWER_BLOCKS.excel + '\n';
const text = (r, name) => r.files.get(name).toString('utf8');
// A gallery folder of these files (name → text or Buffer), in the test's own output.
function folder(testInfo, files){
  const dir = testInfo.outputPath('gallery');
  fs.mkdirSync(dir, { recursive: true });
  Object.entries(files).forEach(([n, t]) => fs.writeFileSync(path.join(dir, n), t));
  return dir;
}
const made = (sc, model, excel) => S.fillViewerPage(PAGE, sc, model, excel).page;
const SYSTEM = { kind: 'system', version: 9, periods: ['1'], canvases: [{ id: 'c', name: 'C', nodes: [], edges: [] }] };

test('the page: a card per viewer in the list\'s sections, every text escaped, links only from ids, its one script only', () => {
  const r = G.buildGallery(DIR, PAGE);
  expect(r.viewers.map(v => [v.id, v.picture])).toEqual([['loan', true], ['markup', false], ['shop-b', false]]);
  expect([...r.files.keys()].sort()).toEqual(['gallery/index.html', 'gallery/p/loan.png', 'gallery/style.css', 'gallery/v/loan.html', 'gallery/v/markup.html', 'gallery/v/shop-b.html']);
  const page = text(r, 'gallery/index.html');
  expect(G.pageScripts(page)).toEqual([G.GALLERY_SCRIPT]); // its own one script, nothing else
  expect(page.match(/<script/gi).length).toBe(1);
  // No handler in any tag (the words of an escaped title are text, also inside a quoted
  // attribute such as data-search, where they name no attribute: values are set aside first).
  expect(page.replace(/="[^"]*"/g, '=""')).not.toMatch(/<[^>]*\son[a-z]+=/i);
  expect(page).not.toMatch(/<[^>]*\son[a-z]+="/i);
  expect(page).toContain('<h1>Models for the course</h1>');
  // The list's section first, in its order; the rest under "More".
  expect([...page.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1])).toEqual(['Week 1', 'More']);
  expect([...page.matchAll(/<h3><a href="v\/([a-z0-9-]+)">/g)].map(m => m[1])).toEqual(['loan', 'shop-b', 'markup']);
  // Markup in a viewer's title, description, author and licence: shown as text.
  expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
  expect(page).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(page).toContain('&lt;b&gt;bold&lt;/b&gt; · &lt;i&gt;CC&lt;/i&gt;');
  // Every link and file name is an id's (or the page's own).
  const links = [...page.matchAll(/(?:href|src|download)="([^"]*)"/g)].map(m => m[1]);
  for(const l of links) expect(l, l).toMatch(/^(?:style\.css|\.\.\/icons\/icon\.svg|\.\/|\.\.\/|\.\.\/LICENSE\.txt|v\/[a-z0-9-]+(?:\.html)?|p\/[a-z0-9-]+\.png|[a-z0-9-]+\.html)$/);
  expect(page).toContain('<a href="v/loan.html" download="loan.html">Download</a>');
  expect(page).toContain('<img src="p/loan.png" alt=""');
  expect(text(r, 'gallery/style.css')).toContain('.viewer-cards');
  expect(r.files.get('gallery/p/loan.png').equals(fs.readFileSync(path.join(DIR, 'loan.png')))).toBe(true);
});

test('the list, the search box and the Grid / List switch: in the page, hidden until its script shows them; each row escaped, its words what the search looks in', () => {
  const r = G.buildGallery(DIR, PAGE);
  const page = text(r, 'gallery/index.html');
  // Hidden in the page itself, so without the script the cards show as before.
  expect(page).toContain('<div class="gallery-tools" id="galleryTools" hidden>');
  expect(page).toContain('<ul class="viewer-rows" id="viewerList" hidden>');
  expect(page).toContain('<p class="gallery-none" id="galleryNone" hidden>No viewer matches your search.</p>');
  expect(page).toMatch(/<input type="search" id="gallerySearch"[^>]*>/);
  expect(page).toContain('<button type="button" id="viewGrid" aria-pressed="true">Grid</button><button type="button" id="viewList" aria-pressed="false">List</button>');
  expect(page).toContain('<div id="viewerGrid">');
  expect(page).not.toMatch(/<div id="viewerGrid" hidden/);
  // A row per card, in the same order, with the same Open and Download.
  const rowIds = [...page.matchAll(/<li class="viewer-row" data-id="([a-z0-9-]+)"/g)].map(m => m[1]);
  const cardIds = [...page.matchAll(/<article class="viewer-card" data-id="([a-z0-9-]+)"/g)].map(m => m[1]);
  expect(rowIds).toEqual(['loan', 'shop-b', 'markup']);
  expect(cardIds).toEqual(rowIds);
  const rows = page.slice(page.indexOf('id="viewerList"'), page.indexOf('</ul>'));
  expect(rows).toContain('<span class="row-section">Week 1</span>');
  expect(rows).toContain('<span class="row-section">More</span>');
  expect(rows).toContain('<span class="row-actions"><a class="viewer-open" href="v/loan">Open</a> <a href="v/loan.html" download="loan.html">Download</a></span>');
  // Markup in a viewer's texts: text in the row and in the words searched (attributes escaped).
  expect(rows).toContain('<a class="row-title" href="v/markup">&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;</a>');
  expect(rows).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(rows).not.toMatch(/<(?!\/?(?:li|a|span)\b)[a-z]/i);
  for(const m of page.matchAll(/data-search="([^"]*)"/g)) expect(m[1]).not.toMatch(/[<>]/);
  expect(page).toMatch(/data-id="markup" data-search="&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quotes&quot; [^"]*More"/);
  // A long description is one line in the list, cut at a word.
  const long = 'Word '.repeat(80) + '\nend';
  const dir = path.join(test.info().outputPath('long'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'a.html'), made({ kind: 'fmIDE-showcase', version: 1, id: 'a', title: 'A', description: long.slice(0, 400) }, SYSTEM));
  const one = text(G.buildGallery(dir, PAGE), 'gallery/index.html').match(/<span class="row-description">([^<]*)<\/span>/)[1];
  expect(one.length).toBeLessThanOrEqual(161);
  expect(one).toMatch(/^Word( Word)*…$/);
  // With no viewers: no tools and no script.
  const empty = path.join(test.info().outputPath('empty'));
  fs.mkdirSync(empty, { recursive: true });
  fs.writeFileSync(path.join(empty, 'gallery.json'), JSON.stringify({ kind: 'fmIDE-gallery', version: 1, sections: [] }));
  const bare = text(G.buildGallery(empty, PAGE), 'gallery/index.html');
  expect(bare).toContain('<p>No viewers yet.</p>');
  expect(bare).not.toMatch(/<script|galleryTools/);
});

test('each viewer rebuilt with today\'s page: its blocks as they were, its scripts exactly the page\'s own', () => {
  const r = G.buildGallery(DIR, PAGE);
  for(const id of ['loan', 'markup', 'shop-b']){
    const was = S.madeViewerBlocks(fs.readFileSync(path.join(DIR, id + '.html'), 'utf8')).blocks;
    const now = text(r, 'gallery/v/' + id + '.html');
    expect(G.pageScripts(now)).toEqual(['var today = "the viewer as built now";']); // the older page's script is gone
    const blocks = S.madeViewerBlocks(now).blocks;
    expect(JSON.parse(blocks.model)).toEqual(JSON.parse(was.model));
    expect(JSON.parse(blocks.showcase).id).toBe(id);
    expect(blocks.excel ? JSON.parse(blocks.excel) : null).toEqual(was.excel ? JSON.parse(was.excel) : null);
    for(const k of ['showcase', 'model', 'excel']) expect(blocks[k]).not.toContain('<');
  }
});

test('refused, nothing written: a page that isn\'t a viewer, a recipe, an unreadable model or workbook, an id twice, a list naming a viewer not there, a bad picture', async ({}, testInfo) => {
  const sc = (id) => ({ kind: 'fmIDE-showcase', version: 1, id, title: id });
  const cases = [
    [{ 'a.html': '<p>hello</p>' }, /a\.html: That page isn't a viewer made by fmIDE/],
    [{ 'a.html': PAGE }, /a\.html: That page holds no model/],
    [{ 'a.html': made({ kind: 'fmIDE-showcase', version: 1, form: 'recipe' }, SYSTEM) }, /a recipe/],
    [{ 'a.html': made(sc('a'), { kind: 'fmIDE-excel-style', version: 1 }) }, /a\.html: its model: /],
    [{ 'a.html': made(sc('a'), SYSTEM, { kind: 'fmIDE-viewer-workbook', version: 1, packed: 'gzip' }) }, /packed in a way/],
    [{ 'a.html': made(sc('same'), SYSTEM), 'b.html': made(sc('same'), SYSTEM) }, /b\.html: its id "same" is a\.html's too/],
    [{ 'a.html': made(sc('a'), SYSTEM), 'gallery.json': JSON.stringify({ kind: 'fmIDE-gallery', version: 1, sections: [{ viewers: ['gone'] }] }) }, /names the viewer "gone", which is not in the folder/],
    [{ 'a.html': made(sc('a'), SYSTEM), 'gallery.json': '{ nope' }, /gallery\.json is not a JSON file/],
    [{ 'a.html': made(sc('a'), SYSTEM), 'a.png': 'not a picture' }, /a\.png is not a PNG picture/],
  ];
  for(const [i, [files, why]] of cases.entries()){
    const dir = testInfo.outputPath('bad-' + i);
    fs.mkdirSync(dir, { recursive: true });
    Object.entries(files).forEach(([n, t]) => fs.writeFileSync(path.join(dir, n), t));
    expect(() => G.buildGallery(dir, PAGE), String(why)).toThrow(why);
    try{ G.buildGallery(dir, PAGE); }catch(e){ expect(e).toBeInstanceOf(G.GalleryError); }
  }
  // A viewer with no id of its own takes its file's name; one whose page would run another script is refused.
  const dir = folder(testInfo, { 'Unnamed one.html': made({ kind: 'fmIDE-showcase', version: 1, title: 'T' }, SYSTEM) });
  expect(G.buildGallery(dir, PAGE).viewers.map(v => v.id)).toEqual(['unnamed-one']);
  expect(G.findGallery(testInfo.outputPath('none'))).toBeNull();
  expect(G.findGallery(dir)).toBe(dir);
});

test('its policy: two rules on paths that never overlap, the page running only its own script by its hash, the viewers the page\'s policy', () => {
  const policy = "default-src 'self'; script-src 'self' 'sha256-x'; connect-src 'none'";
  const rules = G.galleryHeaders(policy);
  expect(rules).toEqual([
    { paths: ['/gallery', '/gallery/', '/gallery/index.html'], headers: ['Content-Security-Policy: ' + G.GALLERY_POLICY] },
    { paths: ['/gallery/v/*'], headers: ['Content-Security-Policy: ' + policy] }]);
  expect(G.GALLERY_POLICY).toMatch(/^default-src 'none';/);
  // Its one script by its exact hash, worked out from the script's bytes (its line ends LF);
  // nothing loaded from or sent anywhere.
  const crypto = require('crypto');
  const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'gallery', 'gallery.js'), 'utf8').replace(/\r\n?/g, '\n');
  expect(G.GALLERY_SCRIPT).toBe(script);
  const hash = "'sha256-" + crypto.createHash('sha256').update(script, 'utf8').digest('base64') + "'";
  expect(G.GALLERY_SCRIPT_HASH).toBe(hash);
  expect(G.GALLERY_POLICY).toBe("default-src 'none'; script-src " + hash + "; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  expect(G.GALLERY_POLICY).not.toMatch(/connect-src|'unsafe-|'self'[^;]*script|script-src[^;]*'self'/);
  // The page's script is exactly the hashed one, and builds no markup from anything.
  const page = G.buildGallery(DIR, PAGE).files.get('gallery/index.html').toString('utf8');
  const inPage = G.pageScripts(page);
  expect(inPage.length).toBe(1);
  expect("'sha256-" + crypto.createHash('sha256').update(inPage[0], 'utf8').digest('base64') + "'").toBe(hash);
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\b|new Function|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|setAttribute\('on|\.src\s*=|\.href\s*=/);
  expect(script).not.toMatch(/<\/script|<!--/i);
  // No page of the gallery is under both: the viewers' folder is apart from the page's paths.
  const matches = (pattern, p) => new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(p);
  for(const p of ['/gallery', '/gallery/', '/gallery/index.html', '/gallery/v/loan', '/gallery/v/loan.html', '/gallery/p/loan.png', '/gallery/style.css']){
    expect(rules.filter(r => r.paths.some(x => matches(x, p))).length, p).toBeLessThanOrEqual(1);
  }
  // 200 viewers still need only those two rules.
  expect(rules.flatMap(r => r.paths).length).toBe(4);
});

test('gallery.json read: sections and their order, texts cut, bad entries each said; the old-version sample reads as written', () => {
  const r = S.cleanGalleryList({ kind: 'fmIDE-gallery', version: 1, title: 'x'.repeat(200), intro: 'Line one\nline two',
    sections: [{ title: 'A', viewers: ['loan', 'loan', 'not an id', 5] }, 'nope', { viewers: ['shop-b'] }] });
  expect(r.value.title.length).toBe(S.GALLERY_LIMITS.title);
  expect(r.value.intro).toBe('Line one\nline two');
  expect(r.value.sections).toEqual([{ title: 'A', viewers: ['loan'] }, { title: 'Section 3', viewers: ['shop-b'] }]);
  expect(r.problems.length).toBe(4);
  expect(S.cleanGalleryList({ kind: 'fmIDE-showcase' }).error).toMatch(/not a gallery list/);
  expect(S.cleanGalleryList({ kind: 'fmIDE-gallery', version: 2 }).newer).toBe(true);
  const old = S.cleanGalleryList(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'formats', 'gallery-v1.json'), 'utf8')));
  expect(old.problems).toEqual([]);
  expect(old.value).toEqual({ title: 'Models for the course', intro: 'Three small models.', sections: [{ title: 'Week 1', viewers: ['loan', 'shop-b'] }, { title: 'Week 2', viewers: ['markup'] }] });
});
