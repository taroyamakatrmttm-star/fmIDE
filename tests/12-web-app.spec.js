// 12. The installable web app (PWA): the site/ build served from this machine — manifest,
// service worker, offline, updates — plus what fmIDE does for it anywhere: Open
// ExcelExporter, and .fmide files handed over by the operating system (launchQueue).
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const apps = require('./helpers/apps');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');
const W = require('./helpers/site');
const { expect } = base;

// ---------- the site, from a local web server ----------
// Its own fixture: a fresh site server per test, and every request the browser makes
// (pages and service worker) must go to that server and nowhere else.
const test = base.test.extend({
  site: async ({}, use) => {
    const site = await W.startSiteServer();
    await use(site);
    await site.close();
    fs.rmSync(site.dir, { recursive: true, force: true });
  },
  requests: async ({ context, site }, use) => {
    const seen = [];
    context.on('request', r => seen.push(r.url()));
    await use(seen);
    expect(seen.filter(u => !u.startsWith(site.origin)), 'the app tried to reach another site').toEqual([]);
  },
});

test.describe('the site', () => {
  test('the manifest is valid and Chrome finds the app installable', async ({ page, site, requests }) => {
    void requests;
    await W.openSite(page, site.origin);
    expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('manifest.webmanifest');
    const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
    expect(manifest).toMatchObject({ name: 'fmIDE', start_url: './', scope: './', display: 'standalone' });
    expect(manifest.icons.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.file_handlers[0].accept).toEqual({ 'application/x-fmide': ['.fmide'] });
    for(const icon of manifest.icons){
      expect(await page.evaluate((src) => fetch(src).then(r => r.status), icon.src)).toBe(200);
    }
    await W.waitForController(page);
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  });

  test('after the first visit it works offline, fmIDE and ExcelExporter', async ({ page, site, requests }) => {
    void requests;
    await W.openSite(page, site.origin);
    await W.waitForController(page);
    await site.close(); // the server is gone
    await W.openSite(page, site.origin);
    expect(await page.evaluate(() => fm.canvases().length)).toBeGreaterThan(0);
    await page.goto(site.origin + 'ExcelExporter.html');
    await expect(page.locator('#dropZone')).toBeVisible();
  });

  test('a new version: the notice appears, Reload switches to it and keeps unsaved work', async ({ page, site, requests }) => {
    void requests;
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.type()); d.accept(); });
    await W.openSite(page, site.origin);
    await W.waitForController(page);
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Before The Update' }));
    // Publish a new version: the service worker's version changes.
    const swFile = path.join(site.dir, 'sw.js');
    fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace(JSON.stringify(site.version), '"test-new-version"'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    const banner = page.locator('#updateBanner');
    await expect(banner).toContainText('A new version of fmIDE is ready.');
    expect(await page.evaluate(() => caches.keys())).toContain('fmide-' + site.version); // not switched yet
    await Promise.all([page.waitForEvent('load'), banner.locator('button', { hasText: 'Reload' }).click()]);
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await page.evaluate(() => caches.keys())).toEqual(['fmide-test-new-version']);
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Before The Update']);
    await expect(page.locator('#recoveryBanner')).toContainText('Recovered unsaved changes');
    expect(dialogs).toEqual([]); // no "Leave site?" on the way
  });

  test('"Later" puts the notice away without switching', async ({ page, site, requests }) => {
    void requests;
    await W.openSite(page, site.origin);
    await W.waitForController(page);
    const swFile = path.join(site.dir, 'sw.js');
    fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace(JSON.stringify(site.version), '"test-later"'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await page.locator('#updateBanner button', { hasText: 'Later' }).click();
    await expect(page.locator('#updateBanner')).toHaveCount(0);
    expect(await page.evaluate(() => caches.keys())).toContain('fmide-' + site.version);
  });

  test('the licences ship with the app, and each app names its own', async ({ page, site, requests }) => {
    void requests;
    await W.openSite(page, site.origin);
    const text = (f) => page.evaluate((f) => fetch(f).then(r => r.ok ? r.text() : ''), f);
    expect(await text('LICENSE.txt')).toContain('Apache License');
    expect(await text('NOTICE.txt')).toContain('Copyright 2026 Taro Yamaka');
    expect(await text('ExcelExporter-LICENSE.txt')).toContain('ExcelExporter Licence');
    const html = (f) => fs.readFileSync(path.join(site.dir, f), 'utf8');
    expect(html('index.html')).toContain('Licensed under the Apache License 2.0');
    expect(html('ExcelExporter.html')).toContain('All rights reserved. Free to use, but not open source');
    // The licence files are part of the offline copy too.
    await W.waitForController(page);
    expect(await page.evaluate(() => caches.keys().then(k => caches.open(k[0])).then(c => c.keys()).then(r => r.map(q => new URL(q.url).pathname))))
      .toEqual(expect.arrayContaining(['/LICENSE.txt', '/NOTICE.txt', '/ExcelExporter-LICENSE.txt']));
  });

  // ---------- as served by Cloudflare Pages: short addresses and the security policy ----------
  // Every page records what the policy blocks. On the window, not the document: a window
  // opened by fmIDE starts with a blank document that is replaced when the page loads.
  const recordViolations = (context) => context.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });

  test('both apps work under the security policy: a whole workflow, no violations', async ({ page, context, site, requests }) => {
    void requests;
    await recordViolations(context);
    // A headless browser can't show Chrome's own save dialog: use the download route.
    await context.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }); });
    const response = await page.goto(site.origin);
    expect(response.headers()['content-security-policy']).toContain("script-src 'self' 'sha256-");
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    await W.waitForController(page);
    // fmIDE: build something, save it as a document (a download).
    await page.evaluate(() => { fm.clearCanvas(); fm.createRect({ x: 60, y: 60, name: 'Price', value: 5 }); });
    await page.evaluate(() => fm.command('saveDocumentAs'));
    await page.locator('#saveAsName').fill('Policy Check');
    const [saved] = await Promise.all([page.waitForEvent('download'), page.locator('#saveAsDialog button.primary').click()]);
    expect(saved.suggestedFilename()).toBe('Policy Check.fmide');
    // ExcelExporter, opened from fmIDE (its short address): load the sample, make a workbook.
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
    await popup.waitForLoadState();
    // Answered from the offline copy (so no redirect to the short address) — which must still
    // carry the policy: a script that isn't ExcelExporter's own is blocked there too.
    expect(new URL(popup.url()).pathname).toMatch(/^\/ExcelExporter(\.html)?$/);
    await popup.click('#btnLoadSample');
    await expect(popup.locator('#afterLoad')).toBeVisible();
    const [xlsx] = await Promise.all([popup.waitForEvent('download'), popup.click('#btnGenerate')]);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(await popup.evaluate(() => window.__cspViolations)).toEqual([]);
    await popup.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__injected = true;'; document.body.appendChild(s); });
    await expect.poll(() => popup.evaluate(() => window.__cspViolations.length)).toBeGreaterThan(0);
    expect(await popup.evaluate(() => window.__injected)).toBeUndefined();
  });

  test('the policy blocks a script that is not the app\'s own', async ({ page, context, site, requests }) => {
    void requests;
    await recordViolations(context);
    await W.openSite(page, site.origin);
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__injected = true;';
      document.body.appendChild(s);
    });
    await expect.poll(() => page.evaluate(() => window.__cspViolations.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  });

  test('short addresses work, and the host settings file is not served', async ({ page, site, requests }) => {
    void requests;
    await page.goto(site.origin + 'ExcelExporter.html');
    expect(new URL(page.url()).pathname).toBe('/ExcelExporter');
    await expect(page.locator('#dropZone')).toBeVisible();
    await page.goto(site.origin + 'index.html');
    expect(new URL(page.url()).pathname).toBe('/');
    expect((await page.request.get(site.origin + '_headers')).status()).toBe(404);
  });

  test('the single file in apps/ registers no service worker', async ({ page, site, requests }) => {
    void requests;
    await W.openSite(page, site.origin + 'apps/fmIDE.html');
    expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))).toBe(0);
  });
});

// ---------- anywhere: Open ExcelExporter and launched files (the usual offline fixture) ----------
apps.test.describe('fmIDE', () => {
  apps.test('Open ExcelExporter opens it in its own window', async ({ page }) => {
    await F.openFmIDE(page);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(apps.ORIGIN + 'ExcelExporter.html');
    await expect(popup.locator('#dropZone')).toBeVisible();
  });

  apps.test('Install fmIDE is disabled until the browser offers it, then prompts', async ({ page }) => {
    await F.openFmIDE(page);
    expect(await page.evaluate(() => fm.command('installApp'))).toBe(false); // nothing offered here
    await page.evaluate(() => {
      const ev = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = () => { window.__prompted = true; return Promise.resolve(); };
      ev.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(ev);
    });
    expect(await page.evaluate(() => fm.command('installApp'))).toBe(true);
    expect(await page.evaluate(() => window.__prompted)).toBe(true);
    expect(await page.evaluate(() => fm.command('installApp'))).toBe(false); // an offer is used once
  });

  // The operating system hands a double-clicked .fmide to the installed app. Chromium has
  // its own (read-only) launchQueue, so the fake is defined over it.
  function fakeLaunchQueue(){
    Object.defineProperty(window, 'launchQueue', { configurable: true, value: { setConsumer(fn){ window.__launch = fn; } } });
  }
  async function launchFile(page, name, text){
    await page.evaluate(({ name, text }) => window.__launch({ files: [{
      kind: 'file', name, getFile: async () => new File([text], name)
    }] }), { name, text });
  }
  const workspace = (canvasName) => {
    const system = apps.readFixture('formats', 'sys-current.json');
    system.canvases[0].name = canvasName;
    return JSON.stringify({ kind: 'fmIDE-workspace', version: 1, system });
  };

  apps.test('a .fmide handed over by the operating system opens as a document', async ({ page }) => {
    await page.addInitScript(fakeLaunchQueue);
    await F.openFmIDE(page);
    await page.waitForFunction(() => typeof window.__launch === 'function');
    await launchFile(page, 'Launched.fmide', workspace('From The Desktop'));
    await expect.poll(() => D.title(page)).toBe('Launched — fmIDE');
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['From The Desktop']);
  });

  apps.test('with unsaved changes it asks first', async ({ page }) => {
    await page.addInitScript(fakeLaunchQueue);
    await F.openFmIDE(page);
    await page.waitForFunction(() => typeof window.__launch === 'function');
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Unsaved' }));
    await launchFile(page, 'Launched.fmide', workspace('From The Desktop'));
    await page.locator('#saveChangesDialog button', { hasText: 'Cancel' }).click();
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Unsaved']);
    await launchFile(page, 'Launched.fmide', workspace('From The Desktop'));
    await page.locator('#saveChangesDialog button', { hasText: "Don't save" }).click();
    await expect.poll(() => D.title(page)).toBe('Launched — fmIDE');
  });
});
