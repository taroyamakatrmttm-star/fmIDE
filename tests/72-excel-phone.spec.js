// 72. ExcelExporter on a phone, and Make Excel from fmIDE's phone layout (step 17, phase P3;
// docs/step17-phones.md). Chromium at 390 × 844 with a touchscreen, real touch through the Chrome
// DevTools Protocol. The phone's share sheet is a stand-in put in the page by the test.
// - One screen: before a model, Open a model file…; with one, the tabs the workbook will hold
//   (with their row counts) and the file name; the full page's panels, menus and Generate hidden.
// - ⬇ Make the workbook: the .xlsx to the share sheet, the same workbook Generate writes on a
//   computer; a download where files can't be shared; a cancelled share; the file name changed
//   on the phone (kept with the layout, made safe).
// - The layout set up in the full page is used (a renamed tab, the Inputs tab).
// - fmIDE's More (☰) → 📊 Make Excel: ExcelExporter's phone screen with the model, ↻ From fmIDE.
// - ☰ → Full app and back, kept after a reload; hostile names; a tablet and a computer unchanged.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { test, expect, ROOT, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');

const BASE = 'http://local.test/';
const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const MODEL_FILE = fixture('models', 'revenue-bs-corkscrew.json');

function shareStandIn(how){
  return `(() => {
    window.__shared = [];
    if(${JSON.stringify(how)} === 'none'){ navigator.canShare = undefined; navigator.share = undefined; return; }
    navigator.canShare = (data) => !!(data && data.files && data.files.length);
    navigator.share = async (data) => {
      if(${JSON.stringify(how)} === 'cancel') throw new DOMException('closed', 'AbortError');
      for(const f of data.files) window.__shared.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())), title: data.title });
    };
  })();`;
}
// Keeps the workbook object the app writes, to compare with the computer's.
const KEEP_WORKBOOK = `addEventListener('DOMContentLoaded', () => {
  const write = XLSX.write;
  XLSX.write = (wb) => { window.__wb = JSON.parse(JSON.stringify(wb)); return write(wb); };
});`;

async function openPhone(browser, { options = PHONE, init = [], app = 'ExcelExporter.html' } = {}){
  const context = await browser.newContext({ acceptDownloads: true, ...options });
  for(const s of init) await context.addInitScript(s);
  const blocked = [];
  await context.route('**/*', route => {
    const u = route.request().url();
    const name = { [BASE + 'fmIDE.html']: 'fmIDE.html', [BASE + 'ExcelExporter.html']: 'ExcelExporter.html' }[u];
    if(name) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', name)) });
    blocked.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + app);
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
      await api.tapOn(page.locator('#phoneMenuBtn'));
      await api.tapOn(page.locator('#' + id));
    },
    async open(file){
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), api.tapOn(page.locator('#phoneOpen'))]);
      await chooser.setFiles(file);
      await expect(page.locator('#phoneLoaded')).toBeVisible();
    },
    async done(){
      expect(blocked, 'the page tried to reach the network').toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    },
  };
  return api;
}
const tabsShown = (page) => page.locator('#phoneTabs li').evaluateAll(lis => lis.map(li => [li.querySelector('.phone-tab-name').textContent, li.querySelector('.phone-tab-count').textContent]));

test('one screen on a phone: Open a model file…, then the tabs and the file name; a tablet and a computer unchanged', async ({ browser, page }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('#phoneStart')).toBeVisible();
  await expect(p.locator('#loadPanel')).toBeHidden();
  await expect(p.locator('#btnGenerate')).toBeHidden();
  await expect(p.locator('#menuFile')).toBeHidden();
  await expect(p.locator('#btnSettings')).toBeHidden();
  await phone.open(MODEL_FILE);
  await expect(p.locator('#phoneStart')).toBeHidden();
  await expect(p.locator('#afterLoad')).toBeHidden();
  await expect(p.locator('#modelName')).toHaveText('revenue-bs-corkscrew.json');
  // The tabs, with the same names and row counts as the full page's Tabs panel.
  const shown = await tabsShown(p);
  expect(shown.length).toBeGreaterThan(1);
  const full = await p.evaluate(() => [...document.querySelectorAll('#tabsBody tr')].map(tr => [tr.querySelector('input[type=text]').value, tr.querySelector('.tab-count').textContent]));
  expect(shown).toEqual(full);
  await expect(p.locator('#phoneFileName')).toHaveValue('fmIDE-export');
  // Nothing wider than the screen.
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // ☰: no ↻ From fmIDE when fmIDE didn't open it.
  await phone.tapOn(p.locator('#phoneMenuBtn'));
  await expect(p.locator('#phoneMenuOpen')).toBeVisible();
  await expect(p.locator('#phoneMenuFromFmide')).toBeHidden();
  await phone.tapOn(p.locator('#phoneMenuHelp'));
  await expect(p.locator('#helpPanel')).toBeVisible();
  await expect(p.locator('#helpPanel')).toContainText('Making the workbook on a phone');
  await phone.done();

  const tablet = await openPhone(browser, { options: { viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, hasTouch: true } });
  await expect(tablet.page.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await expect(tablet.page.locator('#loadPanel')).toBeVisible();
  await expect(tablet.page.locator('#phoneView')).toBeHidden();
  await expect(tablet.page.locator('#phoneMenuBtn')).toBeHidden();
  await tablet.done();

  await page.goto(BASE + 'ExcelExporter.html');
  await expect(page.locator('#loadPanel')).toBeVisible();
  await expect(page.locator('#btnGenerate')).toBeVisible();
  await expect(page.locator('#phoneView')).toBeHidden();
  await expect(page.locator('#phoneMenuBtn')).toBeHidden();
});

test('⬇ Make the workbook: the .xlsx to the share sheet — the same workbook Generate writes on a computer', async ({ browser, page }) => {
  const phone = await openPhone(browser, { init: [shareStandIn('share'), KEEP_WORKBOOK] });
  const p = phone.page;
  await phone.open(MODEL_FILE);
  await phone.tapOn(p.locator('#phoneMake'));
  await expect.poll(() => p.evaluate(() => window.__shared.length)).toBe(1);
  const shared = (await p.evaluate(() => window.__shared))[0];
  expect(shared.name).toBe('fmIDE-export.xlsx');
  expect(shared.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await expect(p.locator('#genStatus .status.ok')).toHaveText(/Workbook shared: fmIDE-export\.xlsx/);
  // A real workbook, whose tabs are the ones listed.
  const zip = await JSZip.loadAsync(Buffer.from(shared.bytes));
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const listed = (await tabsShown(p)).map(t => t[0]);
  expect([...wbXml.matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1])).toEqual(listed);
  const book = await X.readBack(Buffer.from(shared.bytes));
  expect(book.worksheets.length).toBe(listed.length);
  // The computer's Generate, from the same file: the same formulas and values.
  const phoneWb = await p.evaluate(() => window.__wb);
  await page.goto(BASE + 'ExcelExporter.html');
  await X.loadModelFile(page, MODEL_FILE);
  const { wb } = await X.generate(page);
  expect(X.formulasAndValues(phoneWb)).toEqual(X.formulasAndValues(wb));
  await phone.done();
});

test('⬇ Make the workbook: a download where files can’t be shared; a cancelled share does nothing', async ({ browser }) => {
  const none = await openPhone(browser, { init: [shareStandIn('none')] });
  await none.open(MODEL_FILE);
  const [download] = await Promise.all([none.page.waitForEvent('download'), none.tapOn(none.page.locator('#phoneMake'))]);
  expect(download.suggestedFilename()).toBe('fmIDE-export.xlsx');
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  expect(zip.file('xl/workbook.xml')).toBeTruthy();
  await expect(none.page.locator('#genStatus .status.ok')).toHaveText(/Workbook downloaded: fmIDE-export\.xlsx/);
  await none.done();

  const cancel = await openPhone(browser, { init: [shareStandIn('cancel')] });
  await cancel.open(MODEL_FILE);
  let downloads = 0;
  cancel.page.on('download', () => downloads++);
  await cancel.tapOn(cancel.page.locator('#phoneMake'));
  await cancel.page.waitForTimeout(400);
  expect(downloads).toBe(0);
  await expect(cancel.page.locator('#genStatus .status')).toHaveCount(0);
  await cancel.done();
});

test('the file name, changed on the phone, is kept with the layout and made safe', async ({ browser }) => {
  const phone = await openPhone(browser, { init: [shareStandIn('share')] });
  const p = phone.page;
  await phone.open(MODEL_FILE);
  await p.locator('#phoneFileName').fill('Q3 plan');
  await p.locator('#phoneFileName').press('Enter');
  await p.locator('#phoneFileName').blur();
  await phone.tapOn(p.locator('#phoneMake'));
  await expect.poll(() => p.evaluate(() => window.__shared.map(f => f.name))).toEqual(['Q3 plan.xlsx']);
  // Kept: after a reload and the same file, and in the full page's Settings.
  await p.reload();
  await phone.open(MODEL_FILE);
  await expect(p.locator('#phoneFileName')).toHaveValue('Q3 plan');
  expect(await p.locator('#cfgFileName').inputValue()).toBe('Q3 plan');
  // A name no phone can save under: made safe.
  await p.locator('#phoneFileName').fill('a/b<c>:"d"');
  await p.locator('#phoneFileName').blur();
  await phone.tapOn(p.locator('#phoneMake'));
  await expect.poll(() => p.evaluate(() => window.__shared.length)).toBe(1);
  const name = (await p.evaluate(() => window.__shared))[0].name;
  expect(name).toMatch(/\.xlsx$/);
  expect(name).not.toMatch(/[<>"/\\:*?|]/);
  await phone.done();
});

test('the layout set up in the full page is used on the phone; ☰ → Full app and back, kept after a reload', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await phone.open(MODEL_FILE);
  const before = await tabsShown(p);
  await phone.menu('phoneMenuFullApp');
  await expect(p.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('#afterLoad')).toBeVisible();
  await expect(p.locator('#btnGenerate')).toBeVisible();
  await expect(p.locator('#phoneLayoutBtn')).toBeVisible();
  await expect(p.locator('#phoneView')).toBeHidden();
  // Set up in the full page: a tab renamed, the Inputs tab on.
  const first = p.locator('#tabsBody input[type=text]').first();
  await first.fill('My Revenue');
  await first.dispatchEvent('change');
  await X.setInputsTab(p, true);
  // Kept after a reload.
  await p.reload();
  await expect(p.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('#phoneLayoutBtn')).toBeVisible();
  await X.loadModelFile(p, MODEL_FILE);
  await phone.tapOn(p.locator('#phoneLayoutBtn'));
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  const after = await tabsShown(p);
  expect(after.map(t => t[0])).toContain('My Revenue');
  expect(after.map(t => t[0])).not.toContain(before[0][0]);
  expect(after.map(t => t[0])).toContain('Inputs');
  expect(after.length).toBe(before.length + 1);
  await p.reload();
  await expect(p.locator('#phoneStart')).toBeVisible();
  await phone.done();
});

test('fmIDE’s More (☰) → 📊 Make Excel: ExcelExporter’s phone screen with the model', async ({ browser }) => {
  const phone = await openPhone(browser, { app: 'fmIDE.html', init: [shareStandIn('share')] });
  const p = phone.page;
  await p.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await p.evaluate(() => {
    fm.clearCanvas();
    const a = fm.createRect({ name: 'Hours', value: 8, x: 40, y: 40 });
    const b = fm.createRect({ name: 'Rate', value: 50, x: 40, y: 160 });
    const op = fm.createOperator({ op: '×', x: 240, y: 100 });
    const c = fm.createRect({ name: 'Pay', x: 340, y: 100 });
    fm.connect(a, op); fm.connect(b, op); fm.connect(op, c);
  });
  await phone.tapOn(p.locator('#phoneNav-menu'));
  const [popup] = await Promise.all([p.waitForEvent('popup'), phone.tapOn(p.locator('#phoneExcel'))]);
  await popup.waitForLoadState();
  await expect(popup.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await expect(popup.locator('#phoneLoaded')).toBeVisible();
  await expect(popup.locator('#modelName')).toHaveText('Untitled');
  await expect(popup.locator('#phoneTabs li')).not.toHaveCount(0);
  // ☰ has ↻ From fmIDE here, which brings a change made in fmIDE.
  await popup.locator('#phoneMenuBtn').click();
  await expect(popup.locator('#phoneMenuFromFmide')).toBeVisible();
  await p.evaluate(() => fm.setValue('Hours', 10));
  await popup.locator('#phoneMenuFromFmide').click();
  await expect(popup.locator('#loadStatus .status.ok')).toContainText('from fmIDE');
  await phone.done();
});

test('hostile names on the phone screen are shown as text', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
  model.canvases[0].name = evil + ' Revenue';
  const file = path.join(test.info().outputPath(), evil.replace(/[<>"/=]/g, '_') + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(model));
  await phone.open(file);
  const names = (await tabsShown(p)).map(t => t[0]);
  expect(names.some(n => n.includes('<img'))).toBe(true);
  expect(await p.locator('#phoneView img, .topbar img').count()).toBe(0);
  expect(await p.evaluate(() => window.__pwned)).toBeUndefined();
  await phone.done();
});

test('where the workbook will differ from fmIDE shows on the phone screen too', async ({ browser }) => {
  const phone = await openPhone(browser);
  await phone.open(fixture('ir', 'error-cases.json'));
  const panel = phone.page.locator('#differencesPanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('li').first()).toBeVisible();
  const b = await panel.boundingBox();
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  await phone.done();
});
