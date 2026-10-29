// 98. The showcase gallery (phase V6 of docs/viewer-brief.md), in Node: tools/build-gallery.js
// with a stand-in for the viewer's page (its three empty data blocks and a script of its own),
// so no app is needed and no app's change can alter what is checked here. The site served with a
// gallery — the policies applied, the viewers running — is group 91's.
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

test('the page: a card per viewer in the list\'s sections, every text escaped, links only from ids, no script', () => {
  const r = G.buildGallery(DIR, PAGE);
  expect(r.viewers.map(v => [v.id, v.picture])).toEqual([['loan', true], ['markup', false], ['shop-b', false]]);
  expect([...r.files.keys()].sort()).toEqual(['gallery/index.html', 'gallery/p/loan.png', 'gallery/style.css', 'gallery/v/loan.html', 'gallery/v/markup.html', 'gallery/v/shop-b.html']);
  const page = text(r, 'gallery/index.html');
  expect(page).not.toMatch(/<script/i);
  expect(page).not.toMatch(/<[^>]*\son[a-z]+=/i); // no handler in any tag (the words of an escaped title are text)
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

test('its policy: two rules on paths that never overlap, the page running no script, the viewers the page\'s policy', () => {
  const policy = "default-src 'self'; script-src 'self' 'sha256-x'; connect-src 'none'";
  const rules = G.galleryHeaders(policy);
  expect(rules).toEqual([
    { paths: ['/gallery', '/gallery/', '/gallery/index.html'], headers: ['Content-Security-Policy: ' + G.GALLERY_POLICY] },
    { paths: ['/gallery/v/*'], headers: ['Content-Security-Policy: ' + policy] }]);
  expect(G.GALLERY_POLICY).toMatch(/^default-src 'none';/);
  expect(G.GALLERY_POLICY).not.toContain('script-src');
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
