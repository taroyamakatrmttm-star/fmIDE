// 25. The community library's catalogue (step 8, phase 8c-3): what `npm run build` writes into
// the site under /library from the library folder (tools/build-library.js).
// - The pages: the index, one page per pack (its items, the CC BY credit, the report link),
//   the pack files byte for byte, and index.json.
// - Text from packs is only ever plain text: a hostile pack's markup shows as written, and no
//   link, script or element comes from it.
// - Its own security policy (no scripts at all), and pack files that download.
// - The library is checked again: a pack that fails stops the build, and nothing is written.
//   No library (missing or empty folder) means no catalogue, unless --require-library.
// - It stays out of the app: the same version, sw.js and _headers with or without a
//   library, nothing of it in the offline copy.
// Samples: tests/fixtures/library/sample-library/ (Ann's pack and Bob's, which shares Ann's
// Margin again) and tests/fixtures/library/catalogue-hostile/ (a pack saved by fmIDE with
// markup in every text the catalogue shows).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const base = require('@playwright/test');
const { fixture, ROOT } = require('./helpers/apps');
const W = require('./helpers/site');
const { buildSite, LibraryError } = require('../tools/build.js');
const { startPagesServer } = require('../tools/pages-server.js');
const { LIBRARY_POLICY } = require('../tools/build-library.js');
const { expect } = base;

const SAMPLE = fixture('library', 'sample-library');
const HOSTILE = fixture('library', 'catalogue-hostile');
const ANN_PACK = 'pack-checker-good-1';
const BOB_PACK = '06f097dd-fa44-4104-94ec-b29789a2b900';
const HOSTILE_PACK = 'fb017b0c-78e5-4579-a9c8-f454ff365690';
const BUILD = path.join(ROOT, 'tools', 'build.js');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-catalogue-'));

// A site built from `library`, served the way Cloudflare Pages serves it.
const test = base.test.extend({
  served: async ({}, use) => {
    const open = [];
    await use(async (library) => {
      const dir = tmpDir();
      buildSite(dir, { library });
      const server = await startPagesServer(dir);
      open.push({ dir, server });
      return { dir, origin: server.origin };
    });
    for(const { dir, server } of open){ await server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  },
});
// Security-policy violations on every page, collected from the start (an init script is not
// the page's own, so the policy doesn't stop it).
async function watchPolicy(page){
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
}
function run(args){
  return spawnSync(process.execPath, [BUILD].concat(args), { encoding: 'utf8' });
}
// A copy of the sample library; `change(dir)` edits it.
function sampleCopy(testInfo, change){
  const dir = testInfo.outputPath('library');
  fs.cpSync(SAMPLE, dir, { recursive: true });
  if(change) change(dir);
  return dir;
}

test.describe('the pages', () => {
  test('the index lists every pack, newest first, with its counts, tags and licence', async ({ page, served }) => {
    await watchPolicy(page);
    const site = await served(SAMPLE);
    await page.goto(site.origin + 'library/');
    await expect(page.locator('h1')).toHaveText('fmIDE community library');
    const packs = page.locator('li.pack');
    await expect(packs).toHaveCount(2);
    await expect(packs.nth(0).locator('h3')).toHaveText('Markups');
    await expect(packs.nth(0).locator('.by')).toHaveText('by Bob Sample · added 2026-09-28');
    await expect(packs.nth(0).locator('.counts')).toHaveText('2 functions · CC BY 4.0');
    await expect(packs.nth(0).locator('.tags li')).toHaveText(['pricing']);
    await expect(packs.nth(1).locator('h3')).toHaveText('Checker sample');
    await expect(packs.nth(1).locator('.counts')).toHaveText('1 recipe · 2 canvas templates · 1 system template · 2 functions · CC BY 4.0');
    await expect(page.locator('main')).toContainText('File → Open Library Pack…');
    await expect(page.locator('a', { hasText: 'report an item' })).toHaveAttribute('href', 'https://github.com/taroyamakatrmttm-star/fmide-library/issues/new?template=report-an-item.yml');
    await packs.nth(1).locator('h3 a').click();
    await expect(page).toHaveURL(site.origin + 'library/' + ANN_PACK);
    await expect(page.locator('h1')).toHaveText('Checker sample');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });

  test('a pack page shows each item, the CC BY credit and the report link', async ({ page, served }) => {
    await watchPolicy(page);
    const site = await served(SAMPLE);
    await page.goto(site.origin + 'library/' + ANN_PACK);
    await expect(page.locator('.by').first()).toHaveText('by Ann Example');
    await expect(page.locator('dl.details')).toContainText('Added to the library2026-09-27');
    await expect(page.locator('main h3')).toHaveText(['Recipes', 'Canvas templates', 'System templates', 'Functions']);
    const items = page.locator('li.item');
    await expect(items.locator('h4')).toHaveText(['Statements version 1', 'Income Statement version 1', 'Balance Sheet version 1', 'Margins model version 1', 'Profit version 1', 'Margin version 1']);
    // A recipe's parts link to the items further down; a function's calls too.
    const parts = items.nth(0).locator('ol.parts a');
    expect(await parts.count()).toBeGreaterThan(0);
    for(const href of await parts.evaluateAll(as => as.map(a => a.getAttribute('href')))) expect(href).toMatch(/^#item-[2-3]$/);
    await expect(items.nth(4).locator('a', { hasText: 'Margin v1' })).toHaveAttribute('href', '#item-6');
    await expect(items.nth(5).locator('pre.formula')).toHaveText('Margin(Revenue, Cost) = (Revenue - Cost) / Revenue');
    await expect(items.nth(3)).toContainText(/\d+ canvas(es)?: /);
    // The credit CC BY 4.0 asks for: title, author, source and licence.
    await expect(page.locator('.credit blockquote')).toHaveText('“Checker sample” by Ann Example, from the fmIDE community library (pack pack-checker-good-1), licensed under CC BY 4.0.');
    await expect(page.locator('.credit blockquote a')).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(page.locator('a', { hasText: 'Report this pack' })).toHaveAttribute('href',
      'https://github.com/taroyamakatrmttm-star/fmide-library/issues/new?template=report-an-item.yml&title=Report%3A%20pack%20pack-checker-good-1&pack=pack-checker-good-1');
    await expect(page.locator('.report')).toContainText('copies already downloaded stay their owners’');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });

  test('an item shared again credits its original author and links to that pack', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await page.goto(site.origin + 'library/' + BOB_PACK);
    const margin = page.locator('li.item', { has: page.locator('h4', { hasText: 'Margin' }) }).filter({ hasNotText: 'Markup' });
    await expect(margin.locator('.origin')).toHaveText('Shared again from “Checker sample” by Ann Example (its pack)');
    await expect(margin.locator('.origin a')).toHaveAttribute('href', ANN_PACK);
    await expect(page.locator('.credit li')).toHaveText('Margin v1: “Checker sample” by Ann Example (pack pack-checker-good-1), licensed under CC BY 4.0.');
    await page.locator('.credit li a', { hasText: 'pack pack-checker-good-1' }).click();
    await expect(page.locator('h1')).toHaveText('Checker sample');
  });

  test('the download is the approved pack, byte for byte, with its SHA-256', async ({ page, served }) => {
    const site = await served(SAMPLE);
    await page.goto(site.origin + 'library/' + BOB_PACK);
    const file = path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json');
    const bytes = fs.readFileSync(file);
    await expect(page.locator('.hash code')).toHaveText(sha256(bytes));
    expect(readJson(SAMPLE, 'packs.json').packs[BOB_PACK].sha256).toBe(sha256(bytes));
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('a.button', { hasText: 'Download the pack' }).click()]);
    expect(download.suggestedFilename()).toBe(BOB_PACK + '.fmide-pack.json');
    expect(fs.readFileSync(await download.path()).equals(bytes)).toBe(true);
    // Every pack file in the site is its library file.
    for(const id of [ANN_PACK, BOB_PACK]){
      expect(fs.readFileSync(path.join(site.dir, 'library', 'packs', id + '.fmide-pack.json')).equals(fs.readFileSync(path.join(SAMPLE, 'packs', id + '.fmide-pack.json')))).toBe(true);
    }
  });

  test('index.json lists the packs and their items for browsing later', async ({ served }) => {
    const site = await served(SAMPLE);
    const index = readJson(site.dir, 'library', 'index.json');
    expect(index.kind).toBe('fmIDE-library-index');
    expect(index.version).toBe(1);
    expect(index.packs.map(p => p.id)).toEqual([BOB_PACK, ANN_PACK]);
    const bob = index.packs[0];
    const bytes = fs.readFileSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'));
    expect(bob).toEqual({
      id: BOB_PACK, title: 'Markups', author: 'Bob Sample', licence: 'CC-BY-4.0',
      description: 'A function that builds on Ann\'s Margin.', tags: ['pricing'], created: '2026-09-27', added: '2026-09-28',
      page: BOB_PACK, file: 'packs/' + BOB_PACK + '.fmide-pack.json', bytes: bytes.length, sha256: sha256(bytes), packVersion: 2,
      counts: { templates: 0, recipes: 0, functions: 2 },
      items: [
        { type: 'function', name: 'Markup', family: '27ba4bf7-abd0-46ab-8138-0cb706a638e1', version: 1, versionId: '380e3c9f-7ceb-4ef2-839e-20e510730d7a', description: 'Markup on cost, from the margin.' },
        { type: 'function', name: 'Margin', family: 'family-margin', version: 1, versionId: 'version-margin-1', description: 'The share of revenue left after cost.', note: 'First version',
          origin: { packId: ANN_PACK, packTitle: 'Checker sample', author: 'Ann Example', licence: 'CC-BY-4.0' } }
      ]
    });
    const ann = index.packs[1];
    expect(ann.counts).toEqual({ templates: 3, recipes: 1, functions: 2 });
    expect(ann.items.map(i => (i.kind || i.type) + ':' + i.name)).toEqual(['recipe:Statements', 'module:Income Statement', 'module:Balance Sheet', 'system:Margins model', 'function:Profit', 'function:Margin']);
    // The same file every time: nothing in it depends on when it was built.
    const again = tmpDir();
    buildSite(again, { library: SAMPLE });
    expect(fs.readFileSync(path.join(again, 'library', 'index.json'), 'utf8')).toBe(fs.readFileSync(path.join(site.dir, 'library', 'index.json'), 'utf8'));
    fs.rmSync(again, { recursive: true, force: true });
  });
});

test.describe('text from packs', () => {
  test('a hostile pack shows its markup as plain text, and adds no element or link', async ({ page, served }) => {
    await watchPolicy(page);
    const site = await served(HOSTILE);
    const pack = readJson(HOSTILE, 'packs', HOSTILE_PACK + '.fmide-pack.json');
    // In the files: no script, handler or link that came from the pack.
    const allowed = /^(\.\/|\.\.\/|style\.css|\.\.\/icons\/icon\.svg|LICENSE-CC-BY-4\.0\.txt|\.\.\/LICENSE\.txt|#item-\d+|packs\/[A-Za-z0-9-]+\.fmide-pack\.json|[A-Za-z0-9-]{8,64}|https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/|https:\/\/github\.com\/taroyamakatrmttm-star\/fmide-library[A-Za-z0-9#/?=&;.%_-]*)$/;
    for(const name of ['index.html', HOSTILE_PACK + '.html']){
      const html = fs.readFileSync(path.join(site.dir, 'library', name), 'utf8');
      expect(html).not.toMatch(/<script|<img|<svg|<iframe|<\/title>.*<\/title>/i);
      // Escaped text holds no < or >, so every tag here is the build's own: none has a handler.
      const tags = html.match(/<[^>]*>/g);
      expect(tags.filter(t => /\son[a-z]+\s*=/i.test(t))).toEqual([]);
      expect(html).toContain('&lt;script&gt;alert(7)&lt;/script&gt;');
      for(const [, href] of html.matchAll(/(?:href|src)="([^"]*)"/g)) expect(href).toMatch(allowed);
    }
    // In the browser: exactly the pack's text.
    await page.goto(site.origin + 'library/');
    await expect(page.locator('li.pack h3')).toHaveText(pack.pack.title);
    await expect(page.locator('li.pack .by')).toHaveText('by ' + pack.pack.author + ' · added 2026-10-01');
    await expect(page.locator('li.pack .tags li')).toHaveText(pack.pack.tags);
    await page.locator('li.pack h3 a').click();
    await expect(page).toHaveTitle(pack.pack.title + ' — fmIDE community library');
    await expect(page.locator('h1')).toHaveText(pack.pack.title);
    expect(await page.locator('main > p.description').evaluate(e => e.textContent)).toBe(pack.pack.description);
    const items = page.locator('li.item');
    const recipe = pack.templates.find(t => t.kind === 'recipe');
    const canvas = pack.templates.find(t => t.kind === 'module');
    await expect(items.nth(0).locator('h4')).toHaveText(recipe.name + ' version 1');
    await expect(items.nth(0).locator('.group')).toHaveText('Group: ' + recipe.group);
    expect(await items.nth(0).locator('.description').evaluate(e => e.textContent)).toBe(recipe.description);
    await expect(items.nth(0).locator('.note')).toHaveText('Change note: ' + recipe.note);
    await expect(items.nth(1).locator('h4')).toHaveText(canvas.name + ' version 1');
    await expect(items.nth(1)).toContainText('Plugs: ' + canvas.data.nodes[0].plugs.join(', '));
    await expect(items.nth(1)).toContainText('Sockets: ' + canvas.data.nodes[1].socket);
    await expect(items.nth(2).locator('.description')).toHaveText(pack.functions.find(f => f.text.startsWith('Worse')).description);
    // No element the pack's text could have made: the page's own markup only.
    expect(await page.locator('script, img, svg, iframe, object, embed, form, u, i').count()).toBe(0);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    // index.json holds the same text, as JSON.
    const index = readJson(site.dir, 'library', 'index.json');
    expect(index.packs[0].title).toBe(pack.pack.title);
    expect(index.packs[0].items.map(i => i.name)).toEqual([recipe.name, canvas.name, 'Worse', 'Evil']);
  });
});

test.describe('the security policy', () => {
  test('/library has its own policy: no scripts at all; pack files download', async ({ page, served }) => {
    const site = await served(SAMPLE);
    const get = (p) => page.request.get(site.origin + p, { maxRedirects: 0 });
    for(const p of ['library/', 'library/' + ANN_PACK, 'library/index.json', 'library/style.css', 'library/packs/' + ANN_PACK + '.fmide-pack.json']){
      const r = await get(p);
      expect(r.status(), p).toBe(200);
      expect(r.headers()['content-security-policy'], p).toBe(LIBRARY_POLICY);
      expect(r.headers()['x-content-type-options'], p).toBe('nosniff');
    }
    expect(LIBRARY_POLICY).toBe("default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    expect((await get('library/packs/' + ANN_PACK + '.fmide-pack.json')).headers()['content-disposition']).toBe('attachment');
    expect((await get('library/')).headers()['content-disposition']).toBeUndefined();
    // Cloudflare's addresses for a folder and a page.
    expect((await get('library')).headers().location).toBe('/library/');
    expect((await get('library/index.html')).headers().location).toBe('/library/');
    expect((await get('library/' + ANN_PACK + '.html')).headers().location).toBe('/library/' + ANN_PACK);
    // The app's own policy is untouched.
    expect((await get('')).headers()['content-security-policy']).toContain("script-src 'self' 'sha256-");
  });

  test('a script injected into a catalogue page is blocked', async ({ page, served }) => {
    await watchPolicy(page);
    const site = await served(SAMPLE);
    await page.goto(site.origin + 'library/' + ANN_PACK);
    await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__injected = true;'; document.body.appendChild(s); });
    await expect.poll(() => page.evaluate(() => window.__cspViolations.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
    // Styling from the site works; the style sheet is the only one.
    expect(await page.locator('header.top').evaluate(e => getComputedStyle(e).display)).toBe('flex');
  });
});

test.describe('checking the library when building', () => {
  test('a pack that fails its check stops the build, and nothing is written', async ({}, testInfo) => {
    const lib = sampleCopy(testInfo, (dir) => {
      const f = path.join(dir, 'packs', BOB_PACK + '.fmide-pack.json');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Markup on cost', 'Markup on costs'));
    });
    const out = testInfo.outputPath('site');
    const r = run(['--site', out, '--library', lib]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('fails its check, so nothing is published');
    expect(r.stderr).toContain('its hash differs from its record in packs.json');
    expect(fs.existsSync(out)).toBe(false);
    expect(() => buildSite(testInfo.outputPath('site2'), { library: lib })).toThrow(LibraryError);
    expect(fs.existsSync(testInfo.outputPath('site2'))).toBe(false);
  });

  test('a pack without its records is refused too', async ({}, testInfo) => {
    const lib = sampleCopy(testInfo, (dir) => {
      const f = path.join(dir, 'packs.json');
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      delete d.packs[BOB_PACK];
      fs.writeFileSync(f, JSON.stringify(d, null, 2));
    });
    const r = run(['--site', testInfo.outputPath('site'), '--library', lib]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('has no record in packs.json');
  });

  test('without a library there is no catalogue; --require-library refuses', async ({}, testInfo) => {
    const empty = testInfo.outputPath('empty');
    fs.mkdirSync(empty, { recursive: true });
    fs.writeFileSync(path.join(empty, '.git'), 'gitdir: ../.git/modules/library\n'); // a submodule never fetched
    for(const lib of [testInfo.outputPath('missing'), empty]){
      const out = testInfo.outputPath('site-' + path.basename(lib));
      const r = run(['--site', out, '--library', lib]);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain('no library/ folder, so no catalogue');
      expect(fs.existsSync(path.join(out, 'library'))).toBe(false);
      expect(fs.existsSync(path.join(out, 'index.html'))).toBe(true);
      const refused = run(['--site', testInfo.outputPath('refused'), '--library', lib, '--require-library']);
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('There is no community library');
    }
    expect(fs.existsSync(testInfo.outputPath('refused'))).toBe(false);
  });
});

test.describe('the catalogue stays out of the app', () => {
  test('the same version, sw.js and _headers with or without a library, and none of it offline', () => {
    const builds = [null, SAMPLE, HOSTILE].map(library => {
      const dir = tmpDir();
      const r = buildSite(dir, { library });
      const out = { r, sw: fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'), headers: fs.readFileSync(path.join(dir, '_headers'), 'utf8') };
      fs.rmSync(dir, { recursive: true, force: true });
      return out;
    });
    expect(builds[0].r.library).toBeNull();
    expect(builds[1].r.library).toEqual({ packs: 2 });
    builds.slice(1).forEach(b => {
      expect(b.r.version).toBe(builds[0].r.version);
      expect(b.sw).toBe(builds[0].sw);
      expect(b.headers).toBe(builds[0].headers);
    });
    const list = JSON.parse(/const FILES = (\[[^\n]*\]);/.exec(builds[1].sw)[1]);
    expect(list.filter(f => f.startsWith('library'))).toEqual([]);
    expect(builds[1].r.files).toContain('library/index.html');
  });

  test('the app works offline; the catalogue comes from the network only', async ({ page }) => {
    const site = await W.startSiteServer({ library: SAMPLE });
    try{
      await W.openSite(page, site.origin);
      await W.waitForController(page);
      await page.goto(site.origin + 'library/');
      await expect(page.locator('li.pack')).toHaveCount(2);
      const cached = await page.evaluate(async () => {
        const keys = [];
        for(const name of await caches.keys()) for(const req of await (await caches.open(name)).keys()) keys.push(new URL(req.url).pathname);
        return keys;
      });
      expect(cached.length).toBeGreaterThan(0);
      expect(cached.filter(p => p.startsWith('/library'))).toEqual([]);
      await site.close(); // the server is gone
      await W.openSite(page, site.origin);
      expect(await page.evaluate(() => fm.canvases().length)).toBeGreaterThan(0);
      await expect(page.goto(site.origin + 'library/')).rejects.toThrow();
    } finally {
      await site.close();
      fs.rmSync(site.dir, { recursive: true, force: true });
    }
  });
});
