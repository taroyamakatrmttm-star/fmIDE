// 34. The site's help pages, /help (step 10, phase H4a; docs/step10-help.md): what
// `npm run build` writes from the apps' help text (tools/build-help.js).
// - The pages: the index (tutorials, then topics by group), a page per topic and per tutorial,
//   every topic on one page, and ExcelExporter's help under /help/excel/ with its own licence.
// - Every link on every help page leads somewhere; See also and Try it work.
// - A {cmd:id} shows the command's name and ribbon tab: both read from fmIDE's source, and
//   checked here against fmIDE itself (fm.commands() and the ribbon as drawn).
// - Text is only ever plain text: hostile help text shows as written, adding no element or link.
// - A topic naming a command or topic that doesn't exist, or an id that can't be an address,
//   stops the build.
// - Their own security policy (no scripts at all), and out of the app: not in the offline copy.
const fs = require('fs');
const os = require('os');
const path = require('path');
const base = require('@playwright/test');
const W = require('./helpers/site');
const { buildSite } = require('../tools/build.js');
const { startPagesServer } = require('../tools/pages-server.js');
const { buildHelp, loadHelpSources, commandPlaces, HelpError, HELP_POLICY } = require('../tools/build-help.js');
const { expect } = base;

const SRC = loadHelpSources();
const clone = (x) => JSON.parse(JSON.stringify(x));
// The sources with the command list (a Map) kept.
const sources = (change) => { const s = { fmide: clone(SRC.fmide), excel: clone(SRC.excel), commands: SRC.commands, ribbon: SRC.ribbon }; if(change) change(s); return s; };

// One site for the whole group (no library), served the way Cloudflare Pages serves it.
let site;
base.test.beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-help-site-'));
  const r = buildSite(dir, { library: null });
  const server = await startPagesServer(dir);
  site = { dir, origin: server.origin, close: server.close, r };
});
base.test.afterAll(async () => {
  if(!site) return;
  await site.close();
  fs.rmSync(site.dir, { recursive: true, force: true });
});
const test = base.test;

async function watchPolicy(page){
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
}
// Every help page in the site, as its address (/help/x, /help/tutorials/, …).
function helpPages(){
  const out = [];
  const walk = (dir, rel) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if(e.isDirectory()) return walk(path.join(dir, e.name), rel + e.name + '/');
    if(e.name.endsWith('.html')) out.push(rel + (e.name === 'index.html' ? '' : e.name.slice(0, -5)));
  });
  walk(path.join(site.dir, 'help'), 'help/');
  return out.sort();
}

test.describe('the pages', () => {
  test('the index lists the tutorials, then every topic by group, in order', async ({ page }) => {
    await watchPolicy(page);
    await page.goto(site.origin + 'help/');
    await expect(page).toHaveTitle('fmIDE help');
    await expect(page.locator('h1')).toHaveText('fmIDE help');
    const groups = SRC.fmide.groups.filter(g => SRC.fmide.topics.some(t => t.group === g.id));
    await expect(page.locator('main h2')).toHaveText(['Tutorials'].concat(groups.map(g => g.title)));
    await expect(page.locator('ul.tutorials > li > a')).toHaveText(SRC.fmide.tutorials.map(t => t.title));
    await expect(page.locator('ul.tutorials .minutes').first()).toHaveText('about ' + SRC.fmide.tutorials[0].minutes + ' minutes');
    const topics = groups.flatMap(g => SRC.fmide.topics.filter(t => t.group === g.id));
    await expect(page.locator('ul.topics:not(.tutorials) > li > a')).toHaveText(topics.map(t => t.title));
    await expect(page.locator('ul.topics:not(.tutorials) > li .summary').first()).toHaveText(topics[0].summary);
    // One page per topic and per tutorial, and nothing else.
    expect(helpPages()).toEqual([
      'help/', 'help/all', 'help/excel/', 'help/excel/all',
      ...SRC.excel.topics.map(t => 'help/excel/' + t.id),
      ...SRC.fmide.topics.map(t => 'help/' + t.id),
      'help/tutorials/', ...SRC.fmide.tutorials.map(t => 'help/tutorials/' + t.id)
    ].sort());
    await page.locator('ul.topics > li > a', { hasText: 'Aliases' }).click();
    await expect(page).toHaveURL(site.origin + 'help/aliases');
    await expect(page.locator('h1')).toHaveText('Aliases');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });

  test('a topic page: summary, steps, tip, commands by name and tab, See also and Try it', async ({ page }) => {
    await watchPolicy(page);
    await page.goto(site.origin + 'help/first-model');
    const t = SRC.fmide.topics.find(x => x.id === 'first-model');
    await expect(page).toHaveTitle(t.title + ' — fmIDE help');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', t.summary);
    await expect(page.locator('h1')).toHaveText(t.title);
    await expect(page.locator('main > p.lead')).toHaveText(t.summary);
    await expect(page.locator('ol.steps > li')).toHaveCount(t.body.find(b => b.steps).steps.length);
    // {cmd:addRect}: its icon and name, and the ribbon tab it is on.
    const first = page.locator('ol.steps > li').first();
    await expect(first.locator('.cmd-name')).toHaveText('▭ Add Rectangle');
    await expect(first.locator('.cmd-where')).toHaveText('(Home tab)');
    await expect(first).toContainText('Press ▭ Add Rectangle (Home tab). A rectangle appears');
    await expect(page.locator('p.tip')).toHaveText('💡 ' + t.body.find(b => b.tip).tip.replace('{cmd:evaluate}', '▶ Evaluate (Home tab)'));
    await expect(page.locator('main')).not.toContainText('{cmd:');
    await expect(page.locator('.back a')).toHaveText(['← All topics', 'Getting started']);
    const see = t.body.find(b => b.see).see.map(id => SRC.fmide.topics.find(x => x.id === id).title);
    await expect(page.locator('section.see li > a')).toHaveText(see);
    await expect(page.locator('section.try li > a')).toHaveText(['Your first model']);
    await page.locator('section.try li > a').click();
    await expect(page).toHaveURL(site.origin + 'help/tutorials/first-model');
    await page.goBack();
    await page.locator('section.see li > a', { hasText: see[0] }).click();
    await expect(page.locator('h1')).toHaveText(see[0]);
    // A command not on the ribbon is found with the Command Launcher.
    await page.goto(site.origin + 'help/templates');
    expect(commandPlaces(SRC.ribbon).has('removeDuplicateTemplates')).toBe(false);
    await expect(page.locator('.cmd', { hasText: 'Remove Duplicate Templates' }).first().locator('.cmd-where')).toHaveText('(Command Launcher)');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });

  test('a tutorial page lists every step, what it starts from, and its topic', async ({ page }) => {
    await watchPolicy(page);
    const tu = SRC.fmide.tutorials.find(x => x.id === 'templates');
    await page.goto(site.origin + 'help/tutorials/templates');
    await expect(page).toHaveTitle(tu.title + ' — fmIDE tutorial');
    await expect(page.locator('h1')).toHaveText(tu.title);
    await expect(page.locator('.crumb')).toHaveText('Tutorial · about ' + tu.minutes + ' minutes');
    await expect(page.locator('ol.tutorial-steps > li')).toHaveCount(tu.steps.length);
    expect(await page.locator('ol.tutorial-steps > li').evaluateAll(ls => ls.map(l => l.dataset.step))).toEqual(tu.steps.map(s => s.id));
    await expect(page.locator('ol.tutorial-steps > li').nth(1)).toContainText('Open 📚 Templates (File tab) and press + Save Canvas as Template.');
    await expect(page.locator('p.start')).toHaveText('It starts from a small ready-made model: a canvas named Revenue, holding Price (10 $/t), Quantity (5 t), ×, Revenue.');
    await expect(page.locator('p.how')).toContainText('open Help (F1');
    await expect(page.locator('section.see li > a')).toHaveText(['Templates']);
    await page.locator('section.see li > a').click();
    await expect(page).toHaveURL(site.origin + 'help/templates');
    // A tutorial without a start model says nothing about one.
    await page.goto(site.origin + 'help/tutorials/first-model');
    await expect(page.locator('p.start')).toHaveCount(0);
    await page.goto(site.origin + 'help/tutorials/');
    await expect(page.locator('ul.tutorials > li > a')).toHaveText(SRC.fmide.tutorials.map(t => t.title));
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });

  test('every topic on one page, with See also inside it', async ({ page }) => {
    await page.goto(site.origin + 'help/all');
    await expect(page.locator('article.topic')).toHaveCount(SRC.fmide.topics.length);
    expect(await page.locator('article.topic').evaluateAll(as => as.map(a => a.id))).toEqual(
      SRC.fmide.groups.flatMap(g => SRC.fmide.topics.filter(t => t.group === g.id).map(t => t.id)));
    await expect(page.locator('article#aliases h3')).toHaveText('Aliases');
    const hrefs = await page.locator('section.see a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(10);
    for(const href of hrefs){
      expect(href).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(href)).toHaveCount(1);
    }
    await expect(page.locator('main')).not.toContainText('{cmd:');
  });

  test('ExcelExporter\'s help: its topics, its own licence, links between the two', async ({ page }) => {
    await watchPolicy(page);
    await page.goto(site.origin + 'help/');
    await page.locator('header a', { hasText: 'ExcelExporter help' }).click();
    await expect(page).toHaveURL(site.origin + 'help/excel/');
    await expect(page.locator('h1')).toHaveText('ExcelExporter help');
    await expect(page.locator('ul.topics > li > a')).toHaveText(SRC.excel.groups.flatMap(g => SRC.excel.topics.filter(t => t.group === g.id).map(t => t.title)));
    await expect(page.locator('footer')).toContainText('All rights reserved');
    await expect(page.locator('footer')).toContainText('not shared under CC BY');
    await expect(page.locator('footer a')).toHaveAttribute('href', '../../ExcelExporter-LICENSE.txt');
    expect(await page.locator('a[href*="creativecommons"]').count()).toBe(0);
    await page.locator('ul.topics > li > a', { hasText: 'The Tree View' }).click();
    await expect(page).toHaveURL(site.origin + 'help/excel/tree-view');
    await expect(page.locator('ol.steps > li')).toHaveCount(SRC.excel.topics.find(t => t.id === 'tree-view').body.find(b => b.steps).steps.length);
    await page.locator('header a', { hasText: 'Open ExcelExporter' }).click();
    await expect(page).toHaveURL(site.origin + 'ExcelExporter');
    await page.goto(site.origin + 'help/excel/rows');
    await page.locator('header a', { hasText: 'fmIDE help' }).click();
    await expect(page).toHaveURL(site.origin + 'help/');
    // fmIDE's pages carry fmIDE's licences.
    await expect(page.locator('footer a[href="https://creativecommons.org/licenses/by/4.0/"]')).toHaveText('CC BY 4.0');
    await expect(page.locator('footer a[href="LICENSE-CC-BY-4.0.txt"]')).toHaveText('the full text');
  });

  test('every link on every help page leads somewhere', async ({ page }) => {
    const seen = new Map();
    for(const p of helpPages()){
      const html = fs.readFileSync(path.join(site.dir, ...(p.endsWith('/') ? p + 'index.html' : p + '.html').split('/')), 'utf8');
      for(const [, href] of html.matchAll(/(?:href|src)="([^"]*)"/g)){
        if(href.startsWith('#')) continue;
        if(/^https:/.test(href)){ expect(href, p).toBe('https://creativecommons.org/licenses/by/4.0/'); continue; }
        const url = new URL(href, site.origin + p).href.replace(/#.*$/, '');
        if(!seen.has(url)) seen.set(url, (await page.request.get(url)).status());
        expect(seen.get(url), p + ' → ' + href).toBe(200);
      }
    }
    expect(seen.size).toBeGreaterThan(60);
  });
});

test.describe('the commands named in the text', () => {
  test('their names and ribbon tabs are fmIDE\'s own', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await W.openSite(page, site.origin);
    const inApp = await page.evaluate(() => fm.commands().filter(c => !c.id.startsWith('macro:')).map(c => [c.id, c.label]));
    expect([...SRC.commands.keys()].sort()).toEqual(inApp.map(([id]) => id).sort());
    inApp.forEach(([id, label]) => expect(SRC.commands.get(id).label, id).toBe(label));
    // The ribbon as drawn: each tab in turn, the first tab holding each command.
    const drawn = new Map();
    const tabs = page.locator('#ribbon .rb-tab');
    for(let i = 0; i < await tabs.count(); i++){
      await tabs.nth(i).click();
      const label = (await tabs.nth(i).textContent()).trim();
      for(const id of await page.locator('#ribbon .rb-body .rb-btn[data-tip-cmd]').evaluateAll(bs => bs.map(b => b.dataset.tipCmd))){
        if(!drawn.has(id)) drawn.set(id, label + ' tab');
      }
    }
    expect(drawn.size).toBeGreaterThan(50);
    expect(Object.fromEntries(commandPlaces(SRC.ribbon))).toEqual(Object.fromEntries(drawn));
    // The icons match the ribbon's buttons too.
    await tabs.filter({ hasText: 'Home' }).click();
    await expect(page.locator('#ribbon .rb-body .rb-btn[data-tip-cmd="addRect"] .ic').first()).toContainText(SRC.commands.get('addRect').icon);
  });
});

test.describe('text from the help files', () => {
  test('hostile text shows as written, and adds no element or link', async ({ page }, testInfo) => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>"\'&';
    const src = sources(s => {
      const t = s.fmide.topics[0];
      t.title = evil; t.summary = evil;
      t.body = [{ p: evil + ' {cmd:addRect} ' + evil }, { tip: evil }, { steps: [evil] }, { see: [s.fmide.topics[1].id] }];
      s.fmide.groups[0].title = evil;
      Object.assign(s.fmide.tutorials[0], { title: evil, summary: evil, minutes: evil });
      s.fmide.tutorials[0].steps[0].text = evil;
      const started = s.fmide.tutorials.find(tu => tu.start);
      started.start.canvases[0].name = evil;
      started.start.canvases[0].nodes[0].text = evil;
      s.excel.topics[0].title = evil;
    });
    const { files } = buildHelp(src);
    const dir = testInfo.outputPath('help-evil');
    const allowed = /^(\.\/|\.\.\/|\.\.\/\.\.\/|#[a-z0-9-]+|\.\/#[a-z0-9-]+|[a-z0-9-]+|(\.\.\/)?excel\/|tutorials\/[a-z0-9-]+|\.\.\/[a-z0-9-]+|(\.\.\/)*(style|help)\.css|(\.\.\/)*icons\/icon\.svg|(\.\.\/)*LICENSE(-CC-BY-4\.0)?\.txt|\.\.\/\.\.\/ExcelExporter(-LICENSE\.txt)?|https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/)$/;
    for(const [name, data] of files){
      if(!name.endsWith('.html')) continue;
      const html = data.toString('utf8');
      expect(html, name).not.toMatch(/<script|<img|<iframe|<svg/i);
      // Escaped text holds no < > or ", so every tag, and every attribute outside its quoted
      // value, is the build's own: none is a handler.
      expect(html.match(/<[^>]*>/g).map(t => t.replace(/"[^"]*"/g, '""')).filter(t => /\son[a-z]+\s*=/i.test(t)), name).toEqual([]);
      for(const [, href] of html.matchAll(/(?:href|src)="([^"]*)"/g)) expect(href, name).toMatch(allowed);
      const target = path.join(dir, ...name.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }
    // In the browser: exactly the text.
    const t = src.fmide.topics[0];
    await page.goto('file://' + path.join(dir, 'help', t.id + '.html'));
    await expect(page.locator('h1')).toHaveText(evil);
    await expect(page).toHaveTitle(evil + ' — fmIDE help');
    await expect(page.locator('article.topic > p').first()).toHaveText(evil + ' ▭ Add Rectangle (Home tab) ' + evil);
    await expect(page.locator('p.tip')).toHaveText('💡 ' + evil);
    expect(await page.locator('script, img, iframe, svg, object, embed, form').count()).toBe(0);
    const tu = src.fmide.tutorials.find(x => x.start);
    await page.goto('file://' + path.join(dir, 'help', 'tutorials', tu.id + '.html'));
    await expect(page.locator('p.start')).toContainText('a canvas named ' + evil + ', holding ' + evil);
    await page.goto('file://' + path.join(dir, 'help', 'tutorials', src.fmide.tutorials[0].id + '.html'));
    await expect(page.locator('h1')).toHaveText(evil);
    await expect(page.locator('.crumb')).toHaveText('Tutorial · about ' + evil + ' minutes');
    await expect(page.locator('ol.tutorial-steps > li').first()).toHaveText(evil);
    expect(await page.locator('script, img, iframe, svg, object, embed, form').count()).toBe(0);
  });

  test('a missing command or topic, or an id that can\'t be an address, stops the build', () => {
    const bad = sources(s => {
      s.fmide.topics[0].body.push({ p: 'Press {cmd:noSuchCommand}.' }, { see: ['no-such-topic'] });
      s.fmide.topics[1].id = 'all';
      s.fmide.topics[2].id = 'Bad Id';
      s.fmide.topics[3].group = 'nowhere';
      s.fmide.tutorials[0].topic = 'gone';
      s.fmide.tutorials[1].steps[0].text = '{cmd:alsoMissing}';
      s.excel.topics[0].body.push({ p: 'ExcelExporter has no commands: {cmd:addRect}' });
      s.excel.topics[1].id = s.excel.topics[2].id;
    });
    let error;
    try{ buildHelp(bad); } catch(e){ error = e; }
    expect(error).toBeInstanceOf(HelpError);
    const m = error.message;
    expect(m).toContain('nothing is published');
    expect(m).toContain('names a command that doesn\'t exist: noSuchCommand');
    expect(m).toContain('sees a topic that doesn\'t exist: no-such-topic');
    expect(m).toContain('fmIDE topic id "all" must be letters, digits and dashes, and not one of');
    expect(m).toContain('fmIDE topic id "Bad Id" must be');
    expect(m).toContain('is in a group that doesn\'t exist: nowhere');
    expect(m).toContain('tutorial ' + bad.fmide.tutorials[0].id + ' names a topic that doesn\'t exist: gone');
    expect(m).toContain('names a command that doesn\'t exist: alsoMissing');
    expect(m).toContain('ExcelExporter topic ' + bad.excel.topics[0].id + ' names a command that doesn\'t exist: addRect');
    expect(m).toContain('ExcelExporter topic ' + bad.excel.topics[1].id + ' appears twice');
    // The real help text builds.
    expect(buildHelp(sources()).topics).toBe(SRC.fmide.topics.length);
  });
});

test.describe('the security policy, and out of the app', () => {
  test('/help has its own policy: no scripts at all', async ({ page }) => {
    const get = (p) => page.request.get(site.origin + p, { maxRedirects: 0 });
    for(const p of ['help/', 'help/aliases', 'help/all', 'help/tutorials/', 'help/tutorials/time', 'help/excel/', 'help/excel/rows', 'help/style.css', 'help/help.css', 'help/LICENSE-CC-BY-4.0.txt']){
      const r = await get(p);
      expect(r.status(), p).toBe(200);
      expect(r.headers()['content-security-policy'], p).toBe(HELP_POLICY);
      expect(r.headers()['x-content-type-options'], p).toBe('nosniff');
    }
    expect(HELP_POLICY).toBe("default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    expect((await get('help')).headers().location).toBe('/help/');
    expect((await get('help/aliases.html')).headers().location).toBe('/help/aliases');
    expect((await get('')).headers()['content-security-policy']).toContain("script-src 'self' 'sha256-");
    // A script put into a help page is blocked; the style sheets work.
    await watchPolicy(page);
    await page.goto(site.origin + 'help/aliases');
    await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__injected = true;'; document.body.appendChild(s); });
    await expect.poll(() => page.evaluate(() => window.__cspViolations.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
    expect(await page.locator('header.top').evaluate(e => getComputedStyle(e).display)).toBe('flex');
    expect(await page.locator('ul.topics').first().evaluate(e => getComputedStyle(e).listStyleType)).toBe('none');
  });

  test('not in the offline copy; the pages fit a phone\'s width', async ({ page }) => {
    const sw = fs.readFileSync(path.join(site.dir, 'sw.js'), 'utf8');
    const list = JSON.parse(/const FILES = (\[[^\n]*\]);/.exec(sw)[1]);
    expect(list.filter(f => f.startsWith('help'))).toEqual([]);
    expect(site.r.files).toContain('help/index.html');
    await page.setViewportSize({ width: 390, height: 844 });
    for(const p of ['help/', 'help/first-model', 'help/tutorials/blocks', 'help/excel/tree-view', 'help/all']){
      await page.goto(site.origin + p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), p).toBeLessThanOrEqual(390);
    }
  });
});
