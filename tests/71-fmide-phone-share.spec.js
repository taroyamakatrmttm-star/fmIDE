// 71. fmIDE on a phone, getting the work out (step 17, phase P2b; docs/step17-phones.md).
// Chromium at 390 × 844 with a touchscreen, real touch through the Chrome DevTools Protocol. The
// phone's share sheet, and the browser's offer to install, are stand-ins put in the page by the
// test; a phone's browser has no save picker, so the test takes Chromium's away.
// - ⇪ Share the document: the .fmide file (as Save writes it) to the share sheet, a copy (the
//   document stays unsaved); a download where files can't be shared; a cancelled share; a
//   hostile document name.
// - 💾 Save: the name box fits the phone's screen, the file downloads, the document is saved.
// - 📈 Open fmGraph: fmGraph opens with the model, in its phone layout.
// - The install note: on the site only, not installed, shown until Got it (kept after a reload);
//   an iPhone's steps; Install where the browser offers it; ⤓ Install fmIDE in ☰; not on a
//   computer, from disk, or inside the installed app.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, ROOT } = require('./helpers/apps');

const BASE = 'http://local.test/';
const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const MODEL = {
  kind: 'system', version: 9, periods: ['Y1', 'Y2'],
  canvases: [
    { id: 'cS', name: 'Sales', nodes: [
      { id: 'price', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Price\n10' },
      { id: 'vol', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Volume\n100' },
      { id: 'm', type: 'operator', x: 200, y: 50, text: '×' },
      { id: 'rev', type: 'value', x: 280, y: 50, w: 150, h: 64, text: 'Revenue' },
    ], edges: [{ id: 'e1', from: 'price', to: 'm' }, { id: 'e2', from: 'vol', to: 'm' }, { id: 'e3', from: 'm', to: 'rev' }] },
  ],
};

// The share sheet as a phone has it: records what it was given (each file's name and text).
// how: 'share' (shares), 'cancel' (the person closes it), 'none' (the browser can't share files).
function shareStandIn(how){
  return `(() => {
    window.__shared = [];
    if(${JSON.stringify(how)} === 'none'){ navigator.canShare = undefined; navigator.share = undefined; return; }
    navigator.canShare = (data) => !!(data && data.files && data.files.length);
    navigator.share = async (data) => {
      if(${JSON.stringify(how)} === 'cancel') throw new DOMException('closed', 'AbortError');
      for(const f of data.files) window.__shared.push({ name: f.name, type: f.type, text: await f.text(), title: data.title });
    };
  })();`;
}
// A phone's browser has no save picker: Save asks for a name and downloads.
const NO_SAVE_PICKER = 'delete window.showSaveFilePicker; window.showSaveFilePicker = undefined;';

async function openPhone(browser, { options = PHONE, init = [], url = BASE + 'fmIDE.html', serve = true } = {}){
  const context = await browser.newContext({ acceptDownloads: true, ...options });
  for(const s of init) await context.addInitScript(s);
  const blocked = [];
  if(serve){
    await context.route('**/*', route => {
      const u = route.request().url();
      const app = { [BASE + 'fmIDE.html']: 'fmIDE.html', [BASE + 'fmGraph.html']: 'fmGraph.html' }[u];
      if(app) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', app)) });
      blocked.push(u);
      return route.abort();
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y })) });
  const api = {
    context, page, errors,
    async tapOn(locator){
      await expect(locator).toBeVisible();
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      await touch('touchStart', [p]);
      await touch('touchEnd', []);
    },
    async menu(id){
      await api.tapOn(page.locator('#phoneNav-menu'));
      await api.tapOn(page.locator('#' + id));
    },
    async done(){
      expect(blocked, 'fmIDE tried to reach the network').toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    },
  };
  return api;
}
const tempFile = (name, text) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-phone-')), name);
  fs.writeFileSync(file, text);
  return file;
};
async function loadModel(phone, model = MODEL){
  const [chooser] = await Promise.all([phone.page.waitForEvent('filechooser'), phone.page.evaluate(() => fm.command('loadSystem'))]);
  await chooser.setFiles(tempFile('phone-model.json', JSON.stringify(model)));
  await phone.page.locator('.modal-box button', { hasText: 'OK' }).click(); // "replace everything currently open?"
  await expect(phone.page.locator('#phonePanel .phone-input-name').first()).toHaveText('Price');
}
// A change, so the document has something unsaved.
async function changePrice(phone, text = '12'){
  const price = phone.page.locator('#phonePanel .phone-input', { has: phone.page.locator('.phone-input-name', { hasText: /^Price$/ }) });
  await phone.tapOn(price.locator('.ps-value'));
  await price.locator('.ps-type').fill(text);
  await price.locator('.ps-type').press('Enter');
  await expect(phone.page.locator('#phoneTitle')).toHaveText(/•$/);
}

test('⇪ Share the document: the .fmide file to the share sheet, a copy — the document stays unsaved', async ({ browser }) => {
  const phone = await openPhone(browser, { init: [shareStandIn('share')] });
  const p = phone.page;
  await loadModel(phone);
  await changePrice(phone);
  await phone.menu('phoneShare');
  await expect.poll(() => p.evaluate(() => window.__shared.length)).toBe(1);
  const shared = (await p.evaluate(() => window.__shared))[0];
  expect(shared.name).toBe('Untitled.fmide');
  expect(shared.title).toBe('Untitled');
  const doc = JSON.parse(shared.text);
  expect(doc.kind).toBe('fmIDE-workspace');
  expect(doc.system.canvases.map(c => c.name)).toEqual(['Sales']);
  expect(doc.system.canvases[0].nodes.find(n => n.id === 'price').text).toBe('Price\n12');
  await expect(p.locator('#fmToast')).toContainText('Shared a copy of “Untitled.fmide”');
  // A copy: still unsaved.
  await expect(p.locator('#phoneTitle')).toHaveText('Untitled •');
  expect(await p.evaluate(() => document.title)).toBe('Untitled • — fmIDE');
  // It opens again as a document, with the change.
  const again = await openPhone(browser);
  const [chooser] = await Promise.all([again.page.waitForEvent('filechooser'), again.page.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(tempFile('Untitled.fmide', shared.text));
  await expect(again.page.locator('#phonePanel .phone-input', { has: again.page.locator('.phone-input-name', { hasText: /^Price$/ }) }).locator('.ps-value')).toHaveText('12');
  await again.done();
  await phone.done();
});

test('⇪ Share: a download where files can’t be shared; a cancelled share does nothing', async ({ browser }) => {
  const none = await openPhone(browser, { init: [shareStandIn('none')] });
  await loadModel(none);
  await changePrice(none);
  const [download] = await Promise.all([none.page.waitForEvent('download'), none.menu('phoneShare')]);
  expect(download.suggestedFilename()).toBe('Untitled.fmide');
  expect(JSON.parse(fs.readFileSync(await download.path(), 'utf8')).kind).toBe('fmIDE-workspace');
  await expect(none.page.locator('#fmToast')).toContainText('Downloaded a copy: Untitled.fmide');
  await expect(none.page.locator('#phoneTitle')).toHaveText('Untitled •');
  await none.done();

  const cancel = await openPhone(browser, { init: [shareStandIn('cancel')] });
  await loadModel(cancel);
  let downloads = 0;
  cancel.page.on('download', () => downloads++);
  await cancel.menu('phoneShare');
  await cancel.page.waitForTimeout(400);
  expect(downloads).toBe(0);
  expect(await cancel.page.evaluate(() => window.__shared.length)).toBe(0);
  await expect(cancel.page.locator('#fmToast')).toHaveCount(0);
  await cancel.done();
});

test('⇪ Share: a document with a hostile name is shared under a safe file name, its name shown as text', async ({ browser }) => {
  const phone = await openPhone(browser, { init: [shareStandIn('share')] });
  const p = phone.page;
  const ws = { kind: 'fmIDE-workspace', version: 12, system: MODEL };
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(tempFile('<img src=x onerror=alert(1)> plan.fmide', JSON.stringify(ws)));
  await expect(p.locator('#phoneTitle')).toHaveText('<img src=x onerror=alert(1)> plan');
  await phone.menu('phoneShare');
  await expect.poll(() => p.evaluate(() => window.__shared.length)).toBe(1);
  const shared = (await p.evaluate(() => window.__shared))[0];
  expect(shared.name).toMatch(/\.fmide$/);
  expect(shared.name).not.toMatch(/[<>"/\\:*?|]/);
  expect(shared.title).toBe('<img src=x onerror=alert(1)> plan');
  await expect(p.locator('#fmToast')).toContainText('Shared a copy of “');
  expect(await p.locator('#fmToast img, #phoneTop img').count()).toBe(0);
  await phone.done();
});

test('💾 Save on a phone: the name box fits the screen, the file downloads, the document is saved', async ({ browser }) => {
  const phone = await openPhone(browser, { init: [NO_SAVE_PICKER] });
  const p = phone.page;
  await loadModel(phone);
  await changePrice(phone);
  await phone.menu('phoneSave');
  const box = p.locator('#saveAsDialog');
  await expect(box).toBeVisible();
  const b = await box.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  expect(await p.locator('#saveAsName').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16); // no zooming in on it
  await p.locator('#saveAsName').fill('Pricing');
  const [download] = await Promise.all([p.waitForEvent('download'), phone.tapOn(box.locator('button', { hasText: 'Save' }))]);
  expect(download.suggestedFilename()).toBe('Pricing.fmide');
  await expect(p.locator('#phoneTitle')).toHaveText('Pricing');
  await phone.done();
});

test('📈 Open fmGraph: fmGraph opens with the model, in its phone layout', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone);
  await changePrice(phone, '20');
  const [popup] = await Promise.all([p.waitForEvent('popup'), phone.menu('phoneGraph')]);
  await popup.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  await expect(popup.locator('body')).toHaveClass(/(^| )phone( |$)/);
  expect(await popup.evaluate(() => fmGraph.value('Revenue', 1))).toBe(2000);
  await expect(popup.locator('#sliderDock')).toBeVisible();
  await phone.done();
});

// ---- The install note: only on the published site ----
test('the install note: on the site, shown until Got it; the steps for an iPhone; ⤓ Install fmIDE in ☰', async ({ browser }) => {
  const W = require('./helpers/site');
  const site = await W.startSiteServer();
  try{
    const phone = await openPhone(browser, { url: site.origin, serve: false, options: { ...PHONE, userAgent: IPHONE_UA } });
    const p = phone.page;
    const note = p.locator('#phoneInstallNote');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Safari may clear what fmIDE keeps here');
    await expect(note.locator('.phone-install-steps')).toHaveText('Tap Share ⇪, then Add to Home Screen.');
    await expect(note.locator('#phoneInstallNow')).toHaveCount(0); // Safari has no install button to offer
    await expect(p.locator('#phonePanel > *').first()).toHaveId('phoneInstallNote'); // at the top of Inputs
    // Not on Watch.
    await phone.tapOn(p.locator('#phoneNav-watch'));
    await expect(note).toHaveCount(0);
    await phone.tapOn(p.locator('#phoneNav-inputs'));
    await expect(note).toBeVisible();
    // ⤓ Install fmIDE in ☰ gives the same steps.
    await phone.menu('phoneInstall');
    await expect(p.locator('.message-box')).toContainText('tap Share ⇪ in Safari, then Add to Home Screen');
    await p.locator('.message-box button', { hasText: 'OK' }).click();
    // Got it: gone, and still gone after a reload; the ☰ item stays.
    await phone.tapOn(note.locator('#phoneInstallOk'));
    await expect(note).toHaveCount(0);
    // The browser keeps it a moment later (IndexedDB): reload once it is kept, as a person would.
    await expect.poll(() => p.evaluate(() => new Promise(resolve => {
      const open = indexedDB.open('fmIDE');
      open.onerror = () => resolve('');
      open.onsuccess = () => {
        const req = open.result.transaction('kv', 'readonly').objectStore('kv').get('fmIDE-phone');
        req.onsuccess = () => resolve(String(req.result || ''));
        req.onerror = () => resolve('');
      };
    }))).toContain('"installNoteSeen":true');
    await p.reload();
    await p.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await expect(p.locator('#phonePanel .phone-input, #phonePanel .phone-empty').first()).toBeVisible();
    await p.waitForTimeout(300);
    await expect(note).toHaveCount(0);
    await phone.tapOn(p.locator('#phoneNav-menu'));
    await expect(p.locator('#phoneInstall')).toBeVisible();
    // Kept as the phone's own setting, never in the workspace.
    const saved = await p.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('fmIDE');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', 'readonly'), kv = tx.objectStore('kv');
        const a = kv.get('fmIDE-workspace-v1'), b = kv.get('fmIDE-phone');
        tx.oncomplete = () => resolve([String(a.result || ''), String(b.result || '')]);
      };
    }));
    expect(saved[0]).not.toContain('installNoteSeen');
    expect(JSON.parse(saved[1]).installNoteSeen).toBe(true);
    await phone.done();
  } finally {
    await site.close();
    fs.rmSync(site.dir, { recursive: true, force: true });
  }
});

test('the install note: Install where the browser offers it; none inside the installed app, on a computer or from disk', async ({ browser }) => {
  const W = require('./helpers/site');
  const site = await W.startSiteServer();
  try{
    // Android: the browser's offer (a stand-in) gives an Install button.
    const android = await openPhone(browser, { url: site.origin, serve: false });
    const a = android.page;
    await expect(a.locator('#phoneInstallNote')).toBeVisible();
    await expect(a.locator('#phoneInstallNote')).toContainText('A browser may clear what fmIDE keeps here');
    await expect(a.locator('#phoneInstallNote .phone-install-steps')).toContainText('Install app or Add to Home screen');
    await a.evaluate(() => {
      const ev = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
      window.dispatchEvent(ev);
    });
    await expect(a.locator('#phoneInstallNow')).toBeVisible();
    await expect(a.locator('#phoneInstallNote .phone-install-steps')).toHaveCount(0);
    await android.tapOn(a.locator('#phoneInstallNow'));
    await expect.poll(() => a.evaluate(() => window.__prompted)).toBe(1);
    await expect(a.locator('#phoneInstallNote')).toHaveCount(0);
    await android.done();

    // Inside the installed app (an iPhone's home-screen app says so through navigator.standalone).
    const installed = await openPhone(browser, { url: site.origin, serve: false, init: ['Object.defineProperty(navigator, "standalone", { value: true });'] });
    await expect(installed.page.locator('#phonePanel')).toBeVisible();
    await installed.page.waitForTimeout(300);
    await expect(installed.page.locator('#phoneInstallNote')).toHaveCount(0);
    await installed.tapOn(installed.page.locator('#phoneNav-menu'));
    await expect(installed.page.locator('#phoneInstall')).toBeHidden();
    await installed.done();

    // A computer on the site: fmIDE as it was.
    const computer = await browser.newContext();
    const c = await computer.newPage();
    await W.openSite(c, site.origin);
    await expect(c.locator('#ribbon')).toBeVisible();
    await expect(c.locator('#phoneInstallNote')).toHaveCount(0);
    await computer.close();
  } finally {
    await site.close();
    fs.rmSync(site.dir, { recursive: true, force: true });
  }
  // From disk (no manifest): nothing to install, no note, no ☰ item.
  const disk = await openPhone(browser);
  await expect(disk.page.locator('#phonePanel')).toBeVisible();
  await disk.page.waitForTimeout(300);
  await expect(disk.page.locator('#phoneInstallNote')).toHaveCount(0);
  await disk.tapOn(disk.page.locator('#phoneNav-menu'));
  await expect(disk.page.locator('#phoneInstall')).toBeHidden();
  await expect(disk.page.locator('#phoneShare')).toBeVisible();
  await expect(disk.page.locator('#phoneGraph')).toBeVisible();
  await disk.done();
});
