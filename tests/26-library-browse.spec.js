// 26. Browsing the community library inside fmIDE (step 8, phase 8d): File → Browse Library….
// - The window: the list from the site's /library/index.json, search, tag and "holds"
//   filters, sorting, a pack's details, and Preview and add handing the pack to the Open
//   Library Pack preview (nothing added without it).
// - What the site sends is checked: a pack must be exactly the bytes the list names (size and
//   SHA-256); list entries failing the shared reader's checks are left out; text is plain text.
// - Offline, a site without a library, and the single file (apps/): a message, no change, and
//   from the single file no request at all.
// - Requests go only to the site itself; the security policy and the offline copy don't change.
// - window.fm: listLibrary, previewLibraryPackFromLibrary, addFromLibrary (never in macros).
// - The ribbon: Browse Library… in the File tab's Library group; a customised ribbon gets it once.
// Samples: tests/fixtures/library/sample-library/ and catalogue-hostile/ (as group 25).
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const A = require('./helpers/apps');
const F = require('./helpers/fmide');
const W = require('./helpers/site');
const { LIBRARY_POLICY } = require('../tools/build-library.js');
const { expect } = base;

const SAMPLE = A.fixture('library', 'sample-library');
const HOSTILE = A.fixture('library', 'catalogue-hostile');
const ANN_PACK = 'pack-checker-good-1';
const BOB_PACK = '06f097dd-fa44-4104-94ec-b29789a2b900';
const HOSTILE_PACK = 'fb017b0c-78e5-4579-a9c8-f454ff365690';
const MISMATCH = /doesn't match the library's list, so it was not opened/;

// A site built with `library` (null for none), served like Cloudflare Pages. Every request
// the browser makes must be to that site.
const test = base.test.extend({
  served: async ({ context }, use) => {
    const open = [];
    const seen = [];
    context.on('request', r => seen.push(r.url()));
    await use(async (library) => {
      const site = await W.startSiteServer({ library });
      open.push(site);
      return site;
    });
    for(const site of open){ await site.close().catch(() => {}); fs.rmSync(site.dir, { recursive: true, force: true }); }
    const origins = open.map(s => s.origin);
    expect(seen.filter(u => !origins.some(o => u.startsWith(o)) && !u.startsWith('data:') && !u.startsWith('blob:')), 'fmIDE reached another site').toEqual([]);
  },
});
async function watchPage(page){
  const events = { violations: [], dialogs: [], errors: [] };
  page.on('dialog', d => { events.dialogs.push(d.message()); d.dismiss(); });
  page.on('pageerror', e => events.errors.push(e.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  return events;
}
async function openBrowser(page){
  await page.evaluate(() => fm.command('browseLibrary'));
  return page.locator('.modal-box.library-browse');
}
const titles = (box) => box.locator('.library-browse-pack-title').allTextContents();
// The message an action fails with (the text after Playwright's own prefix), or null.
const errorOf = (page, fn, arg) => page.evaluate(fn, arg).then(() => null, e => e.message.replace(/^[\s\S]*?Error: /, '').split('\n')[0]);

test.describe('the window', () => {
  test('lists every pack, newest first; search, tag, holds and sort', async ({ page, served }) => {
    const events = await watchPage(page);
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-pack')).toHaveCount(2);
    expect(await titles(box)).toEqual(['Markups', 'Checker sample']);
    await expect(box.locator('.library-browse-status')).toHaveText('2 packs.');
    await expect(box.locator('.library-browse-pack').nth(1)).toContainText('by Ann Example · added 2026-09-27');
    await expect(box.locator('.library-browse-pack-counts').nth(1)).toHaveText('1 recipe · 2 canvas templates · 1 system template · 2 functions');
    const search = box.locator('.library-browse-search');
    await search.fill('MARGIN');                // item names, ignoring capitals
    expect(await titles(box)).toEqual(['Markups', 'Checker sample']);
    await search.fill('profit');
    expect(await titles(box)).toEqual(['Checker sample']);
    await expect(box.locator('.library-browse-status')).toHaveText('1 of 2 packs.');
    await search.fill('bob sample');            // the author
    expect(await titles(box)).toEqual(['Markups']);
    await search.fill('nothing like this');
    await expect(box.locator('.library-browse-none')).toHaveText('No pack matches.');
    await search.fill('');
    expect(await box.locator('.library-browse-tag option').allTextContents()).toEqual(['Any tag', 'pricing', 'statements', 'tests']);
    await box.locator('.library-browse-tag').selectOption('pricing');
    expect(await titles(box)).toEqual(['Markups']);
    await box.locator('.library-browse-tag').selectOption('');
    await box.locator('.library-browse-holds').selectOption('recipe');
    expect(await titles(box)).toEqual(['Checker sample']);
    await box.locator('.library-browse-holds').selectOption('function');
    expect(await titles(box)).toEqual(['Markups', 'Checker sample']);
    await box.locator('.library-browse-sort').selectOption('title');
    expect(await titles(box)).toEqual(['Checker sample', 'Markups']);
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(events.errors).toEqual([]);
  });

  test('a pack\'s details, and Preview and add opens the usual preview: nothing is added without it', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-add')).toBeDisabled();
    await box.locator(`.library-browse-pack[data-id="${BOB_PACK}"]`).click();
    const details = box.locator('.library-browse-details');
    await expect(details.locator('.library-pack-title')).toHaveText('Markups');
    await expect(details.locator('.library-pack-item-origin')).toHaveText('Shared before: From the library pack “Checker sample” by Ann Example · CC BY 4.0');
    await box.locator(`.library-browse-pack[data-id="${ANN_PACK}"]`).click();
    await expect(details.locator('.library-pack-title')).toHaveText('Checker sample');
    await expect(details.locator('.library-pack-by')).toContainText('By Ann Example · CC BY 4.0');
    await expect(details.locator('.library-pack-licence')).toContainText('Credit: “Checker sample” by Ann Example, from the fmIDE community library, licensed under CC BY 4.0');
    expect(await details.locator('.library-browse-item-name').allTextContents()).toEqual(
      ['Statements v1 · My Templates', 'Income Statement v1 · Statements', 'Balance Sheet v1 · Statements', 'Margins model v1 · Models', 'Profit v1', 'Margin v1']);
    await expect(details.locator('.library-browse-item-here')).toHaveCount(0);
    await expect(details.locator('a.library-browse-page')).toHaveAttribute('href', 'library/' + ANN_PACK);
    await expect(details.locator('a.library-browse-page')).toHaveAttribute('target', '_blank');
    // Preview, then Cancel: nothing added.
    await box.locator('.library-browse-add').click();
    const preview = page.locator('.modal-box.library-pack-preview');
    await expect(preview.locator('.library-pack-title')).toHaveText('Checker sample');
    await expect(preview.locator('.library-pack-item')).toHaveCount(6);
    await preview.locator('button', { hasText: 'Cancel' }).click();
    expect(await page.evaluate(() => fm.listFunctions().length)).toBe(0);
    // Preview, then add: the items join the library, remembering the pack.
    await box.locator('.library-browse-add').click();
    await preview.locator('button', { hasText: 'Add to My Library' }).click();
    await expect(F.topDialog(page)).toContainText('From the library pack: 4 templates added; 2 function versions added.');
    await F.dismissMessage(page);
    await expect(details.locator('.library-browse-item-here')).toHaveCount(6);
    const fns = await page.evaluate(() => fm.listFunctions().map(f => f.versions[0].origin));
    expect(fns).toEqual([
      { packId: ANN_PACK, packTitle: 'Checker sample', author: 'Ann Example', licence: 'CC-BY-4.0' },
      { packId: ANN_PACK, packTitle: 'Checker sample', author: 'Ann Example', licence: 'CC-BY-4.0' }]);
  });

  test('hostile text in the list and the pack shows as plain text', async ({ page, served }) => {
    const events = await watchPage(page);
    const site = await served(HOSTILE);
    const raw = JSON.parse(fs.readFileSync(path.join(site.dir, 'library', 'index.json'), 'utf8')).packs[0];
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-pack')).toHaveCount(1);
    await expect(box.locator('.library-browse-pack-title')).toHaveText(raw.title);
    await box.locator('.library-browse-pack').click();
    const details = box.locator('.library-browse-details');
    await expect(details.locator('.library-pack-title')).toHaveText(raw.title);
    await expect(details.locator('.library-pack-description')).toHaveText(raw.description);
    await expect(details.locator('.library-pack-by')).toContainText(raw.author);
    expect(await box.locator('script, img, b, iframe, object').count()).toBe(0);
    await box.locator('.library-browse-add').click();
    const preview = page.locator('.modal-box.library-pack-preview');
    await expect(preview.locator('.library-pack-title')).toHaveText(raw.title);
    expect(await page.locator('.modal-box script, .modal-box img, .modal-box b').count()).toBe(0);
    expect(events.dialogs).toEqual([]);
    expect(events.errors).toEqual([]);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(await page.evaluate(() => fm.listLibrary().then(l => l.packs[0].id))).toBe(HOSTILE_PACK);
  });
});

test.describe('checking what the site sends', () => {
  test('a pack changed after publishing is refused: its fingerprint, or its size, differs', async ({ page, served }) => {
    const site = await served(SAMPLE);
    const file = path.join(site.dir, 'library', 'packs', ANN_PACK + '.fmide-pack.json');
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.replace('Checker sample', 'Checker sampla'));   // same size
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await box.locator(`.library-browse-pack[data-id="${ANN_PACK}"]`).click();
    await box.locator('.library-browse-add').click();
    await expect(F.topDialog(page)).toContainText(MISMATCH);
    await expect(page.locator('.modal-box.library-pack-preview')).toHaveCount(0);
    await F.dismissMessage(page);
    expect(await errorOf(page, (id) => fm.previewLibraryPackFromLibrary({ id }), ANN_PACK)).toMatch(MISMATCH);
    fs.writeFileSync(file, original + ' ');                                          // one byte more
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toMatch(MISMATCH);
    fs.writeFileSync(file, original.slice(0, -2));                                    // shorter
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toMatch(MISMATCH);
    // A pack carrying another id than the list's.
    const bob = path.join(site.dir, 'library', 'packs', BOB_PACK + '.fmide-pack.json');
    fs.writeFileSync(file, fs.readFileSync(bob));
    const index = path.join(site.dir, 'library', 'index.json');
    const list = JSON.parse(fs.readFileSync(index, 'utf8'));
    const ann = list.packs.find(p => p.id === ANN_PACK), bobEntry = list.packs.find(p => p.id === BOB_PACK);
    Object.assign(ann, { bytes: bobEntry.bytes, sha256: bobEntry.sha256 });
    fs.writeFileSync(index, JSON.stringify(list));
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toMatch(MISMATCH);
    // A pack taken away since the list was read.
    fs.rmSync(file);
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toBe('This pack is no longer in the library.');
    expect(await page.evaluate(() => fm.listFunctions().length)).toBe(0);
  });

  test('list entries that fail the checks are left out; the rest are shown', async ({ page, served }) => {
    const site = await served(SAMPLE);
    const index = path.join(site.dir, 'library', 'index.json');
    const list = JSON.parse(fs.readFileSync(index, 'utf8'));
    const good = list.packs[0];
    const bad = (change) => { const e = JSON.parse(JSON.stringify(good)); change(e); return e; };
    const RLO = String.fromCharCode(0x202E);
    list.packs.push(
      bad(e => { e.id = '../../evil-pack'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; }),
      bad(e => { e.id = 'another-pack-1'; e.page = e.id; e.file = 'https://example.com/pack.json'; }),
      bad(e => { e.id = 'another-pack-2'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.bytes = 'many'; }),
      bad(e => { e.id = 'another-pack-3'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.title = 'Innocent ' + RLO + 'txt.exe'; }),
      bad(e => { e.id = 'another-pack-4'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.counts.functions = 9; }),
      bad(e => { e.id = 'another-pack-5'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.bytes = 6 * 1024 * 1024; }),
      bad(e => { e.id = 'another-pack-6'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.licence = 'All rights reserved'; }),
      bad(e => { e.id = 'another-pack-7'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.sha256 = 'not-a-hash'; }),
      bad(e => { e.id = 'another-pack-8'; e.page = e.id; e.file = 'packs/' + e.id + '.fmide-pack.json'; e.items[0].name = '<b>x</b>' + RLO; }),
      good);                                                                            // the same id twice
    fs.writeFileSync(index, JSON.stringify(list));
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-status')).toHaveText("2 packs · 10 packs could not be shown (the list's details for them failed fmIDE's checks).");
    expect(await titles(box)).toEqual(['Markups', 'Checker sample']);
    const out = await page.evaluate(() => fm.listLibrary());
    expect(out.dropped).toBe(10);
    expect(out.packs.map(p => p.id)).toEqual([BOB_PACK, ANN_PACK]);
    expect(out.packs[0]).not.toHaveProperty('file');
    expect(out.packs[0].items.map(it => it.here)).toEqual([false, false]);
  });

  test('a list that is not a list, from a newer fmIDE, or too large', async ({ page, served }) => {
    const site = await served(SAMPLE);
    const index = path.join(site.dir, 'library', 'index.json');
    const list = fs.readFileSync(index, 'utf8');
    await W.openSite(page, site.origin);
    fs.writeFileSync(index, '{ not json');
    expect(await errorOf(page, () => fm.listLibrary())).toBe('The library\'s list is not valid JSON.');
    fs.writeFileSync(index, JSON.stringify({ kind: 'fmIDE-library-pack', version: 2, pack: {} }));
    expect(await errorOf(page, () => fm.listLibrary())).toMatch(/That is an fmIDE library pack, not a library list/);
    fs.writeFileSync(index, list.replace('"version": 1', '"version": 2'));
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-status')).toContainText('2 packs. The list was written by a newer fmIDE');
    await page.keyboard.press('Escape');
    fs.writeFileSync(index, ' '.repeat(10 * 1024 * 1024 + 1));
    expect(await errorOf(page, () => fm.listLibrary())).toBe('The library sent more than 10 MB, so nothing was read.');
    // Opened by hand, the list says where it belongs.
    expect(await errorOf(page, (file) => fm.openLibraryPack(file), JSON.parse(list))).toMatch(/That is an fmIDE library list, not a library pack\. Open it with File → Browse Library/);
  });
});

test.describe('offline, no library, and the site\'s rules', () => {
  test('offline: a message, nothing changes; the library is never in the offline copy', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    await W.waitForController(page);
    await page.evaluate(() => fm.listLibrary());
    await page.evaluate((id) => fm.addFromLibrary({ id, items: ['f0'] }), BOB_PACK);
    const cached = await page.evaluate(async () => {
      const urls = [];
      for(const k of await caches.keys()) for(const r of await (await caches.open(k)).keys()) urls.push(r.url);
      return urls;
    });
    expect(cached.length).toBeGreaterThan(3);
    expect(cached.filter(u => u.includes('/library'))).toEqual([]);
    await site.close();
    await W.openSite(page, site.origin);                  // fmIDE itself works offline
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-status')).toHaveText("Can't reach the library. You may be offline: the library needs a connection (everything else in fmIDE works offline).");
    await expect(box.locator('.library-browse-pack')).toHaveCount(0);
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toMatch(/Can't reach the library/);
  });

  test('a site without a library says so', async ({ page, served }) => {
    const site = await served(null);
    await W.openSite(page, site.origin);
    const box = await openBrowser(page);
    await expect(box.locator('.library-browse-status')).toHaveText("This copy of fmIDE's site has no library.");
  });

  test('the security policy is unchanged: fmIDE connects to its own site only; the catalogue runs no scripts', async ({ page, served }) => {
    const site = await served(SAMPLE);
    const headers = fs.readFileSync(path.join(site.dir, '_headers'), 'utf8');
    const appPolicy = headers.split('\n/index.html\n')[1].split('\n')[0];
    expect(appPolicy).toContain("connect-src 'self'");
    expect(appPolicy).toContain("default-src 'self'");
    expect(headers).toContain('/library/*\n  Content-Security-Policy: ' + LIBRARY_POLICY);
    const res = await page.goto(site.origin);
    expect(res.headers()['content-security-policy']).toContain("connect-src 'self'");
    // A page can't reach another site, even when asked to.
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => 'reached', e => 'refused: ' + e.name));
    expect(blocked).toBe('refused: TypeError');
  });
});

test.describe('window.fm and macros', () => {
  test('listLibrary, previewLibraryPackFromLibrary, addFromLibrary', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    const list = await page.evaluate(() => fm.listLibrary());
    expect(list.packs.map(p => [p.id, p.title, p.author, p.licence, p.added])).toEqual([
      [BOB_PACK, 'Markups', 'Bob Sample', 'CC-BY-4.0', '2026-09-28'], [ANN_PACK, 'Checker sample', 'Ann Example', 'CC-BY-4.0', '2026-09-27']]);
    const preview = await page.evaluate((id) => fm.previewLibraryPackFromLibrary({ id }), BOB_PACK);
    expect(preview.pack.title).toBe('Markups');
    expect(preview.items.map(it => [it.key, it.name, it.status])).toEqual([['f0', 'Markup', 'new'], ['f1', 'Margin', 'new']]);
    expect(await page.evaluate(() => fm.listFunctions().length)).toBe(0);
    const out = await page.evaluate((id) => fm.addFromLibrary({ id, items: ['f1'] }), BOB_PACK);
    expect(out.functions).toEqual({ added: 1, present: 0, renumbered: 0 });
    const after = await page.evaluate(() => fm.listLibrary());
    expect(after.packs[0].items.map(it => [it.name, it.here])).toEqual([['Markup', false], ['Margin', true]]);
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), 'no-such-pack')).toBe('The library has no pack "no-such-pack".');
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), '../index')).toMatch(/Give a pack id from the library/);
  });

  test('never in macros: not offered, and refused when a macro holds one', async ({ page, served }, testInfo) => {
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    const system = A.readFixture('formats', 'sys-current.json');
    const file = testInfo.outputPath('ws.json');
    fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 6, system,
      macros: [{ id: 'm-lib', name: 'Library Macro', steps: [{ kind: 'action', action: 'addFromLibrary', args: { id: BOB_PACK } }] }] }));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    const err = await errorOf(page, () => fm.runMacro('Library Macro'));
    expect(err).toMatch(/The community library can't be used in a macro/);
    expect(await page.evaluate(() => fm.listFunctions().length)).toBe(0);
    // The Command Launcher offers Browse Library…, not the actions (which answer later).
    await page.evaluate(() => fm.command('openLauncher'));
    await page.locator('.launcher input.lq').fill('library');
    const rows = await page.locator('.launcher .lrow').allTextContents();
    expect(rows.some(r => r.includes('Browse Library…'))).toBe(true);
    expect(rows.filter(r => /Add from the Library|Preview a Pack from the Library|List the Library/.test(r))).toEqual([]);
    await page.keyboard.press('Escape');
    // Recording: run from outside a macro it works, and is never recorded.
    await page.evaluate(() => fm.command('toggleRecord'));
    await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
    await page.evaluate((id) => fm.addFromLibrary({ id }), BOB_PACK);
    await page.evaluate(() => fm.command('toggleRecord'));
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    expect(data.macros.filter(m => m.name !== 'Library Macro').flatMap(m => m.steps.map(s => s.action))).not.toContain('addFromLibrary');
    expect(await page.evaluate(() => fm.listFunctions().length)).toBe(2);   // it did run, outside the macro
  });
});

test.describe('the shared reader, in Node', () => {
  test('the build\'s own index.json reads cleanly, for both sample libraries', async ({ served }) => {
    const S = require('../tools/check-pack.js').shared;
    for(const [library, n] of [[SAMPLE, 2], [HOSTILE, 1]]){
      const site = await served(library);
      const r = S.readLibraryIndexData(JSON.parse(fs.readFileSync(path.join(site.dir, 'library', 'index.json'), 'utf8')));
      expect(r.error).toBeUndefined();
      expect(r.dropped).toBe(0);
      expect(r.packs.length).toBe(n);
    }
    expect(S.readLibraryIndexData({ kind: 'fmIDE-library-index', version: 1 }).error).toBe('The library\'s list has no packs in it.');
    expect(S.readLibraryIndexData({ kind: 'fmIDE-library-index', version: 1, packs: [] })).toMatchObject({ packs: [], dropped: 0 });
  });
});

test.describe('the ribbon', () => {
  test('Browse Library… in the File tab\'s Library group, no shortcut', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await W.openSite(page, site.origin);
    const cfg = await page.evaluate(() => __fmIDE.getRibbonConfig());
    const lib = cfg.tabs.find(t => t.id === 'file').groups.find(g => g.label === 'Library').items.map(i => i.cmd);
    expect(lib).toEqual(['openTemplates', 'openFunctions', 'openFormats', 'browseLibrary', 'openLibraryPack', 'saveLibraryPack']);
    expect(await page.evaluate(() => fm.commands().filter(c => c.id === 'browseLibrary'))).toEqual([
      { id: 'browseLibrary', label: 'Browse Library…', category: 'File', shortcut: null }]);
  });
});

// The single file (apps/fmIDE.html): no site to reach, so no request at all (the apps
// fixture fails a test that makes any).
A.test.describe('the single file', () => {
  A.test('Browse Library says where the library is, and makes no request', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await page.evaluate(() => fm.command('browseLibrary'));
    await expect(F.topDialog(page)).toContainText("Browsing the library needs fmIDE's website. This copy of fmIDE is a single file, which never connects to anything.");
    await expect(F.topDialog(page)).toContainText('https://fmide.pages.dev/library/');
    await expect(page.locator('.modal-box.library-browse')).toHaveCount(0);
    await F.dismissMessage(page);
    expect(await errorOf(page, () => fm.listLibrary())).toMatch(/needs fmIDE's website/);
    expect(await errorOf(page, (id) => fm.addFromLibrary({ id }), ANN_PACK)).toMatch(/needs fmIDE's website/);
    // A ribbon customised before 8d gets Browse Library… once, before Open Library Pack….
    const ws = (flag) => JSON.stringify({ kind: 'fmIDE-workspace', version: 6, system: A.readFixture('formats', 'sys-current.json'),
      ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
        libraryPacksAdded: true, libraryBrowseAdded: flag,
        ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Stuff', items: [{ cmd: 'openFormats' }, { cmd: 'openLibraryPack' }] }] }] } } });
    const items = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
    const write = (name, text) => { const f = testInfo.outputPath(name); fs.writeFileSync(f, text); return f; };
    await F.importViaCommand(page, 'importWorkspace', write('old.json', ws(undefined)));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats,browseLibrary,openLibraryPack']);
    await F.importViaCommand(page, 'importWorkspace', write('removed.json', ws(true)));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats,openLibraryPack']);
  });
});
