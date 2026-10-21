// 81. The user manual (docs/manual/; phase 6, the owner's request of 21 October 2026): what
// tools/build-manual.js checks, and the pages it writes into the site, /manual.
// - The manual as it is builds: a page per file, every lesson an anchor, linked from the contents.
// - The checks that stop the build: a Help topic or tutorial that doesn't exist or has another
//   title, a lesson without its anchor or a card line, a broken link or anchor, an anchor used
//   twice, a lesson the contents don't link, a link to anything but a web page or the repository.
// - Text is only ever text: HTML in the manual shows as written; a javascript: link is no link.
// - On the site: every page served under its own policy (no scripts), every link leading
//   somewhere, a Help topic named in a lesson linking to its help page.
const fs = require('fs');
const os = require('os');
const path = require('path');
const base = require('@playwright/test');
const { buildSite } = require('../tools/build.js');
const { startPagesServer } = require('../tools/pages-server.js');
const { buildManual, loadManualSources, ManualError, pageName } = require('../tools/build-manual.js');
const { expect } = base;
const test = base.test;

const SRC = loadManualSources();
// The sources with one file's text changed (or added).
function sources(file, change){
  const files = new Map(SRC.files);
  files.set(file, change(files.get(file) || ''));
  return Object.assign({}, SRC, { files });
}
const fails = (src, re) => {
  let error = null;
  try{ buildManual(src); } catch(e){ error = e; }
  expect(error).toBeInstanceOf(ManualError);
  expect(error.message).toMatch(re);
};
const html = (r, name) => r.files.get('manual/' + name + '.html').toString('utf8');

test.describe('building the manual', () => {
  test('the manual as it is builds: a page per file, every lesson an anchor, linked from the contents', () => {
    const r = buildManual();
    expect(r.pages).toBe(SRC.files.size);
    expect(r.lessons).toBeGreaterThanOrEqual(67);
    expect([...r.files.keys()].sort()).toEqual([...[...SRC.files.keys()].map(f => 'manual/' + pageName(f) + '.html'), 'manual/manual.css'].sort());
    expect(r.files.has('manual/index.html')).toBe(true);
    expect(r.files.has('manual/writing-lessons.html')).toBe(true);
    // Every lesson heading carries its anchor, and the contents link it.
    const index = html(r, 'index');
    for(const [file, text] of SRC.files){
      // (A lesson shown as an example inside a code block, as in STYLE.md, isn't a lesson.)
      for(const m of text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/<a id="([a-z0-9-]+)"><\/a>\n## Lesson (\d+\.\d+) — /g)){
        expect(html(r, pageName(file))).toContain('<h2 id="' + m[1] + '">Lesson ' + m[2] + ' — ');
        expect(index, 'lesson ' + m[2]).toContain('href="' + pageName(file) + '#' + m[1] + '"');
      }
    }
  });

  test('a lesson naming a Help topic or tutorial that doesn\'t exist, or by another title, stops the build', () => {
    fails(sources('02-building-models.md', t => t.replace('(`timing-conditions`)', '(`no-such-topic`)')), /lesson 2\.5 names fmIDE Help topic no-such-topic, which doesn't exist/);
    fails(sources('02-building-models.md', t => t.replace('*Timing, conditions and rounding* (`timing-conditions`)', '*Timing and rounding* (`timing-conditions`)')),
      /lesson 2\.5 calls fmIDE Help topic timing-conditions "Timing and rounding"; its title is "Timing, conditions and rounding"/);
    fails(sources('06-fmgraph.md', t => t.replace('fmGraph tutorial *Sliders and bars* (`sliders-and-bars`)', 'fmGraph tutorial *Sliders and bars* (`sliders`)')), /fmGraph tutorial sliders, which doesn't exist/);
    fails(sources('07-excel-import.md', t => t.replace(/ExcelExporter Help → \*Importing an Excel model\* \(`import-excel`\)/, 'ExcelExporter Help → *Importing an Excel model* (`import`)')), /ExcelExporter Help topic import, which doesn't exist/);
  });

  test('a lesson without its anchor line or a card line stops the build', () => {
    fails(sources('02-building-models.md', t => t.replace('<a id="first-model"></a>\n', '')), /lesson 2\.1 has no anchor line/);
    fails(sources('02-building-models.md', t => t.replace(/> \*\*Time:\*\* about 5 minutes\.\n(> \*\*In the app:\*\* fmIDE Help → \*Your first model)/, '$1')), /lesson 2\.1 has no "Time" line/);
  });

  test('a broken link, a missing anchor, an anchor used twice or a lesson the contents miss stops the build', () => {
    fails(sources('README.md', t => t.replace('(02-building-models.md#first-model)', '(02-building-models.md#nowhere)')), /README\.md: the link 02-building-models\.md#nowhere leads to no anchor in 02-building-models\.md/);
    fails(sources('README.md', t => t.replace('(02-building-models.md#first-model)', '(09-nowhere.md#first-model)')), /leads to a page of the manual that doesn't exist/);
    fails(sources('03-reuse.md', t => t + '\nSee [the samples](../../tests/fixtures/no-such-folder/).\n'), /leads to tests\/fixtures\/no-such-folder, which isn't in the repository/);
    fails(sources('03-reuse.md', t => t + '\nSee [below](#no-such-anchor).\n'), /the link #no-such-anchor leads to no anchor on its page/);
    fails(sources('03-reuse.md', t => t + '\n<a id="first-model"></a>\n## More\n'), /the anchor first-model is used already/);
    fails(sources('README.md', t => t.replace('[2.1 Your first model: rectangles, operators and arrows](02-building-models.md#first-model)', '2.1 Your first model')), /the contents don't link lesson 2\.1/);
    fails(sources('03-reuse.md', t => t + '\nA [trap](javascript:alert).\n'), /the link "javascript:alert" isn't https:, http: or an address in the repository/);
  });
});

test.describe('the pages', () => {
  test('text is only text: HTML in the manual shows as written, and makes no element', () => {
    const evil = '<script>alert(1)</script> <img src=x onerror=alert(2)> <b>bold?</b> "quotes" & ampersands';
    const r = buildManual(sources('03-reuse.md', t => t + '\n' + evil + '\n\n| a | b |\n|---|---|\n| <i>x</i> | `<u>` |\n\n- <em>y</em>\n\n```\n<script>z</script>\n```\n'));
    const page = html(r, '03-reuse');
    expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &lt;img src=x onerror=alert(2)&gt; &lt;b&gt;bold?&lt;/b&gt; &quot;quotes&quot; &amp; ampersands');
    expect(page).toContain('<td>&lt;i&gt;x&lt;/i&gt;</td><td><code>&lt;u&gt;</code></td>');
    expect(page).toContain('<li>&lt;em&gt;y&lt;/em&gt;</li>');
    expect(page).toContain('<pre><code>&lt;script&gt;z&lt;/script&gt;</code></pre>');
    // The only elements in every page are the ones the build writes.
    const allowed = new Set(['html', 'head', 'meta', 'title', 'link', 'body', 'header', 'nav', 'main', 'footer', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'blockquote', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'strong', 'em', 'hr']);
    for(const [name, data] of r.files){
      if(!name.endsWith('.html')) continue;
      const text = data.toString('utf8');
      for(const m of text.matchAll(/<([a-z][a-z0-9]*)[\s>]/g)) expect(allowed.has(m[1]), name + ' has a <' + m[1] + '>').toBe(true);
      expect(text, name).not.toMatch(/<script/i);
      // No handler or script address in any element the build writes (the text may say them, escaped).
      for(const [tag] of text.matchAll(/<[a-z][^>]*>/g)) expect(tag, name).not.toMatch(/\son[a-z]+=|javascript:/i);
    }
  });

  test('links: the manual\'s pages by name, the repository\'s files on GitHub, Help topics to their help pages', () => {
    const r = buildManual();
    const index = html(r, 'index');
    expect(index).toContain('<a href="02-building-models#timing-conditions">2.5 Timing, conditions and rounding: period, if, choose, round…</a>');
    expect(index).toContain('href="writing-lessons"');
    expect(index).toContain('<a href="../help/LICENSE-CC-BY-4.0.txt">CC BY 4.0</a>');
    const part2 = html(r, '02-building-models');
    expect(part2).toContain('<a href="../help/timing-conditions"><em>Timing, conditions and rounding</em></a> (<code>timing-conditions</code>)');
    expect(part2).toContain('<a href="./">Contents</a>');
    const part7 = html(r, '07-excel-import');
    expect(part7).toContain('<a href="../help/excel/import-excel"><em>Importing an Excel model</em></a>');
    expect(part7).toContain('href="https://github.com/taroyamakatrmttm-star/fmIDE/tree/main/tests/fixtures/excel-import"');
    expect(part7).toContain('href="https://github.com/taroyamakatrmttm-star/fmIDE/blob/main/docs/step20-excel-import.md"');
    // fmGraph's help is only inside fmGraph: its topics stay as text.
    const part6 = html(r, '06-fmgraph');
    expect(part6).toContain('<em>Bars</em> (<code>bars</code>)');
    expect(part6).not.toMatch(/href="[^"]*bars"/);
    expect(part6).toContain('fmGraph tutorial <em>Sliders and bars</em>');
  });
});

test.describe('on the site', () => {
  let site;
  test.beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-manual-site-'));
    buildSite(dir, { library: null });
    const server = await startPagesServer(dir);
    site = { dir, origin: server.origin, close: server.close };
  });
  test.afterAll(async () => {
    if(!site) return;
    await site.close();
    fs.rmSync(site.dir, { recursive: true, force: true });
  });

  test('every page is served under its own policy, with no scripts, and out of the offline copy', async ({ page }) => {
    const headers = fs.readFileSync(path.join(site.dir, '_headers'), 'utf8');
    expect(headers).toContain("/manual/*\n  Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    expect(fs.readFileSync(path.join(site.dir, 'sw.js'), 'utf8')).not.toContain('manual/');
    const violations = [];
    page.on('console', m => { if(/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    const res = await page.goto(site.origin + 'manual/');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-security-policy']).toContain("default-src 'none'");
    await expect(page).toHaveTitle('The fmIDE manual');
    await expect(page.locator('header.top a.home')).toHaveText('fmIDE manual');
    await page.locator('a', { hasText: '2.5 Timing, conditions and rounding' }).click();
    await expect(page).toHaveURL(site.origin + 'manual/02-building-models#timing-conditions');
    await expect(page.locator('#timing-conditions')).toHaveText('Lesson 2.5 — Timing, conditions and rounding');
    await page.locator('#timing-conditions ~ blockquote a', { hasText: 'Timing, conditions and rounding' }).first().click();
    await expect(page).toHaveURL(site.origin + 'help/timing-conditions');
    await expect(page.locator('h1')).toHaveText('Timing, conditions and rounding');
    expect(violations).toEqual([]);
  });

  test('every link on every page leads somewhere', async () => {
    const names = fs.readdirSync(path.join(site.dir, 'manual')).filter(f => f.endsWith('.html'));
    const seen = new Map();
    for(const name of names){
      const p = 'manual/' + (name === 'index.html' ? '' : name.slice(0, -5));
      const text = fs.readFileSync(path.join(site.dir, 'manual', name), 'utf8');
      for(const [, raw] of text.matchAll(/(?:href|src)="([^"]*)"/g)){
        const href = raw.replace(/&amp;/g, '&');
        if(/^https:/.test(href)){ expect(href, p).toMatch(/^https:\/\/(github\.com\/taroyamakatrmttm-star\/fmIDE\/|fmide\.pages\.dev(\/|$))/); continue; }
        const url = new URL(href, site.origin + p);
        const key = url.href.replace(/#.*$/, '');
        if(!seen.has(key)){
          const res = await fetch(key);
          seen.set(key, { status: res.status, body: res.status === 200 ? await res.text() : '' });
        }
        expect(seen.get(key).status, p + ' → ' + href).toBe(200);
        if(url.hash) expect(seen.get(key).body, p + ' → ' + href).toContain('id="' + url.hash.slice(1) + '"');
      }
    }
  });
});
