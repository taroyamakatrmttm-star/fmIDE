// 70. fmIDE on a phone (step 17, phase P2a; docs/step17-phones.md). Chromium at 390 × 844 with a
// touchscreen, real touch through the Chrome DevTools Protocol.
// - Which screens: a phone takes the phone layout (Inputs · Watch · Canvas · ☰), a tablet and a
//   computer keep fmIDE as it was.
// - Inputs: every input with a number, by canvas, searched; the phone slider changes the model
//   (one undo step per gesture, the document unsaved), typing and − / +; an input with a number
//   per period changed in the period shown, or all periods by %; an input in a block says so.
// - Watch: ★ on an input or a rectangle's card, how far each has moved since the start, kept in
//   this browser after a reload.
// - Canvas: fitted, a canvas picked, nothing edited by a drag or a double-tap; a tap on a
//   rectangle opens its card (its value per period, what it is worked out from, what reads it).
// - ☰ → Full app and back (kept); hostile names as text; no network, no page errors.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, ROOT, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');

const URL = 'http://local.test/fmIDE.html';
const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

// A small model: Sales (Price, a Volume per period, Revenue) and Report (an alias of Revenue,
// Tax rate, Tax), three periods.
const MODEL = {
  kind: 'system', version: 9, periods: ['Y1', 'Y2', 'Y3'],
  canvases: [
    { id: 'cS', name: 'Sales', nodes: [
      { id: 'price', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'Price\n10\n$' },
      { id: 'vol', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Volume\n100', periodValues: [100, 110, 121], periodValuesRange: { min: 0, max: 200 } },
      { id: 'm', type: 'operator', x: 200, y: 50, text: '×' },
      { id: 'rev', type: 'value', x: 280, y: 50, w: 150, h: 64, text: 'Revenue' },
    ], edges: [{ id: 'e1', from: 'price', to: 'm' }, { id: 'e2', from: 'vol', to: 'm' }, { id: 'e3', from: 'm', to: 'rev' }] },
    { id: 'cR', name: 'Report', nodes: [
      { id: 'a', type: 'alias', x: 0, y: 0, w: 150, h: 64, sourceCanvasId: 'cS', sourceNodeId: 'rev' },
      { id: 'rate', type: 'value', x: 0, y: 100, w: 150, h: 64, text: 'Tax rate\n0.25' },
      { id: 'm2', type: 'operator', x: 200, y: 50, text: '×' },
      { id: 'tax', type: 'value', x: 280, y: 50, w: 150, h: 64, text: 'Tax' },
    ], edges: [{ id: 'f1', from: 'a', to: 'm2' }, { id: 'f2', from: 'rate', to: 'm2' }, { id: 'f3', from: 'm2', to: 'tax' }] },
  ],
};

async function openPhone(browser, options = PHONE){
  const context = await browser.newContext(options);
  const blocked = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if(url === URL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html')) });
    blocked.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y })) });
  const api = {
    context, page, errors, touch,
    async tap(p){ await touch('touchStart', [p]); await touch('touchEnd', []); },
    async tapOn(locator){
      await expect(locator).toBeVisible();
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await api.tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    },
    // A finger along a slider's rail: from a fraction of it to another, stopping before it lifts.
    async slide(rail, from, to){
      const b = await rail.boundingBox();
      const y = b.y + b.height / 2, a = { x: b.x + b.width * from, y };
      await touch('touchStart', [a]);
      for(let i = 1; i <= 8; i++) await touch('touchMove', [{ x: a.x + b.width * (to - from) * i / 8, y }]);
      await page.waitForTimeout(80);
      await touch('touchEnd', []);
    },
    async done(){
      expect(blocked, 'fmIDE tried to reach the network').toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    },
  };
  return api;
}
async function loadModel(phone, model, name = 'phone-model.json'){
  // (A folder named after a title with ★ or − in it doesn't reach the page's file box.)
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-phone-')), name);
  fs.writeFileSync(file, JSON.stringify(model));
  const [chooser] = await Promise.all([phone.page.waitForEvent('filechooser'), phone.page.evaluate(() => fm.command('loadSystem'))]);
  await chooser.setFiles(file);
  await phone.page.locator('.modal-box button', { hasText: 'OK' }).click(); // "replace everything currently open?"
  await expect(phone.page.locator('#phonePanel .phone-group .phone-head').first()).toHaveText(model.canvases[0].name);
}
const input = (page, name) => page.locator('#phonePanel .phone-input', { has: page.locator('.phone-input-name', { hasText: new RegExp('^' + name + '$') }) });
const value = (page, canvas, rect, period) => page.evaluate(([c, r, p]) => { fm.switchCanvas(c); return fm.getValue(r, p); }, [canvas, rect, period]);
const typeInto = async (phone, card, text) => {
  await phone.tapOn(card.locator('.ps-value'));
  const box = card.locator('.ps-type');
  await box.fill(text);
  await box.press('Enter');
};

test('a phone opens to the inputs; a tablet and a computer keep fmIDE as it was', async ({ browser, page }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('#ribbon')).toBeHidden();
  await expect(p.locator('#canvasTabs')).toBeHidden();
  await expect(p.locator('#viewport')).toBeHidden();
  await expect(p.locator('#phoneNav')).toBeVisible();
  await expect(p.locator('#phoneNav-inputs')).toHaveAttribute('aria-current', 'page');
  await expect(p.locator('#phonePanel .phone-group .phone-head')).toHaveText(['Sales', 'Report']);
  await expect(p.locator('#phonePanel .phone-input-name')).toHaveText(['Price', 'Volume', 'Tax rate']);
  await expect(input(p, 'Price').locator('.phone-input-unit')).toHaveText('$');
  await expect(input(p, 'Price').locator('.ps-value')).toHaveText('10');
  await expect(input(p, 'Volume').locator('.phone-all')).toBeVisible(); // a number per period
  await expect(input(p, 'Price').locator('.phone-all')).toHaveCount(0);
  await expect(p.locator('#phonePeriodPick')).toHaveValue('0');
  // Search.
  await p.fill('#phoneSearch', 'tax');
  await expect(p.locator('#phonePanel .phone-input-name')).toHaveText(['Tax rate']);
  await p.fill('#phoneSearch', 'sales'); // a canvas's name finds its inputs
  await expect(p.locator('#phonePanel .phone-input-name')).toHaveText(['Price', 'Volume']);
  await p.fill('#phoneSearch', 'nothing like it');
  await expect(p.locator('#phonePanel .phone-empty')).toContainText('No input matches');
  await phone.done();

  const tablet = await openPhone(browser, { viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, hasTouch: true });
  await expect(tablet.page.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await expect(tablet.page.locator('#ribbon')).toBeVisible();
  await expect(tablet.page.locator('#phoneNav')).toBeHidden();
  await tablet.done();

  await page.goto(URL);
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await expect(page.locator('#ribbon')).toBeVisible();
  await expect(page.locator('#phoneNav')).toBeHidden();
  await expect(page.locator('#phoneTop')).toBeHidden();
  await expect(page.locator('#phonePanel')).toBeHidden();
});

test('the slider changes the model: one undo step per move, the document unsaved, typing and − / +', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  const price = input(p, 'Price');
  // The range is half the number either way (5 to 15): a fifth of the rail is 2.
  await phone.slide(price.locator('.ps-rail'), 0.5, 0.7);
  await expect(price.locator('.ps-value')).toHaveText('12');
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(1200);
  expect(await value(p, 'Report', 'Tax', 1)).toBe(300);
  await expect(p.locator('#phoneTitle')).toHaveText('Untitled •');
  await expect(price.locator('.phone-input-change')).toContainText('+2');
  await expect(price.locator('.phone-input-start')).toHaveText('At the start: 10');
  // ↶ takes the whole move back, ↷ brings it again.
  await phone.tapOn(p.locator('#phoneUndo'));
  await expect(price.locator('.ps-value')).toHaveText('10');
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(1000);
  await phone.tapOn(p.locator('#phoneRedo'));
  await expect(price.locator('.ps-value')).toHaveText('12');
  // A touch on the slider that moves nothing is no undo step: one ↶ still takes back the move.
  await phone.slide(price.locator('.ps-rail'), 0.3, 0.3);
  await expect(price.locator('.ps-value')).toHaveText('12');
  await phone.tapOn(p.locator('#phoneUndo'));
  await expect(price.locator('.ps-value')).toHaveText('10');
  // Typed, and − / +.
  await typeInto(phone, price, '20');
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(2000);
  await expect(p.locator('#phonePanel .phone-input', { has: p.locator('.phone-input-name', { hasText: /^Price$/ }) }).locator('.ps-value')).toHaveText('20');
  await phone.tapOn(input(p, 'Price').locator('.ps-plus'));
  await expect(input(p, 'Price').locator('.ps-value')).toHaveText('20.5'); // a new range around 20: steps of 0.5
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(2050);
  // The rectangle's text keeps its name and unit.
  expect(await p.evaluate(() => { fm.switchCanvas('Sales'); return fm.nodes().find(n => n.id === 'price').text; })).toBe('Price\n20.5\n$');
  await phone.done();
});

test('an input with a number per period: the period shown, or all periods by %', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  const vol = () => input(p, 'Volume');
  await phone.tapOn(p.locator('#phoneNextPeriod'));
  await expect(p.locator('#phonePeriodPick')).toHaveValue('1');
  await expect(vol().locator('.ps-value')).toHaveText('110');
  await typeInto(phone, vol(), '150');
  const pv = () => p.evaluate(() => { fm.switchCanvas('Sales'); return [1, 2, 3].map(k => fm.getValue('Volume', k)); });
  expect(await pv()).toEqual([100, 150, 121]);
  expect(await value(p, 'Sales', 'Revenue', 2)).toBe(1500);
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(1000);
  // All periods by %: +10% of each.
  await phone.tapOn(vol().locator('.phone-all input'));
  await expect(vol().locator('.ps-value')).toHaveText('0%');
  await typeInto(phone, vol(), '10');
  expect(await pv()).toEqual([110, 165, 133.1]);
  await expect(vol().locator('.ps-value')).toHaveText('+10%');
  // One undo step: back to before the %.
  await phone.tapOn(p.locator('#phoneUndo'));
  expect(await pv()).toEqual([100, 150, 121]);
  // Back to one period at a time.
  await phone.tapOn(vol().locator('.phone-all input'));
  await expect(vol().locator('.ps-value')).toHaveText('150');
  // The period picked from the list.
  await p.selectOption('#phonePeriodPick', '2');
  await expect(vol().locator('.ps-value')).toHaveText('121');
  await phone.done();
});

test('Watch: ★ on an input and on a rectangle\'s card; how far each moved; kept after a reload', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  await phone.tapOn(input(p, 'Tax rate').locator('.phone-star'));
  await expect(p.locator('#phoneWatch .phone-watch-name')).toHaveText(['Tax rate']);
  await expect(input(p, 'Tax rate').locator('.phone-star')).toHaveAttribute('aria-pressed', 'true');
  // Revenue, from its card on the canvas.
  await phone.tapOn(p.locator('#phoneNav-canvas'));
  await p.selectOption('#phoneCanvasPick', 'cS');
  await expect(p.locator('#canvas .node', { hasText: 'Revenue' })).toBeVisible();
  await phone.tapOn(p.locator('#canvas .node', { hasText: 'Revenue' }));
  await expect(p.locator('#phoneCard')).toBeVisible();
  await phone.tapOn(p.locator('.phone-card-star'));
  await expect(p.locator('.phone-card-star')).toHaveText('★ Watching');
  await phone.tapOn(p.locator('.phone-card-close'));
  await phone.tapOn(p.locator('#phoneNav-watch'));
  await expect(p.locator('#phoneWatch .phone-watch-name')).toHaveText(['Tax rate', 'Revenue']);
  await expect(p.locator('#phonePanel .phone-input')).toHaveCount(0); // Watch alone
  // Move Price: Revenue's row says how far.
  await phone.tapOn(p.locator('#phoneNav-inputs'));
  await typeInto(phone, input(p, 'Price'), '15');
  const rev = p.locator('#phoneWatch .phone-watch-row', { hasText: 'Revenue' });
  await expect(rev.locator('.phone-watch-value')).toHaveText('1,500');
  await expect(rev.locator('.phone-watch-change')).toHaveText('+500 (+50%)');
  await expect(rev.locator('.phone-watch-change')).toHaveClass(/up/);
  // A row opens the rectangle's card.
  await phone.tapOn(rev);
  await expect(p.locator('#phoneCardTitle')).toHaveText('Revenue');
  await phone.tapOn(p.locator('.phone-card-close'));
  // Kept after a reload (the autosave brings the model back; the list is this browser's).
  await p.waitForTimeout(2500);
  await p.reload();
  await p.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await expect(p.locator('#phoneWatch .phone-watch-name')).toHaveText(['Tax rate', 'Revenue']);
  // Not in the document: the workspace saved holds no Watch list; the phone's own key does.
  const saved = await p.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('fmIDE');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', 'readonly'), kv = tx.objectStore('kv');
      const a = kv.get('fmIDE-workspace-v1'), b = kv.get('fmIDE-phone');
      tx.oncomplete = () => resolve([String(a.result || ''), String(b.result || '')]);
    };
  }));
  expect(saved[0]).toContain('Tax rate');
  expect(saved[0]).not.toContain('cR|rate');
  expect(saved[1]).toContain('cR|rate');
  await phone.done();
});

test('the canvas is to look at: a drag or a double-tap edits nothing; a tap opens the card', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  await phone.tapOn(p.locator('#phoneNav-canvas'));
  await expect(p.locator('#viewport')).toBeVisible();
  await expect(p.locator('#phonePanel')).toBeHidden();
  await p.selectOption('#phoneCanvasPick', 'cS');
  const node = p.locator('#canvas .node', { hasText: 'Price' });
  const at = () => p.evaluate(() => { const n = fm.nodes().find(x => x.id === 'price'); return [n.x, n.y]; });
  const before = await at();
  const b = await node.boundingBox();
  const s = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await phone.touch('touchStart', [s]);
  for(let i = 1; i <= 6; i++) await phone.touch('touchMove', [{ x: s.x + i * 12, y: s.y + i * 6 }]);
  await phone.touch('touchEnd', []);
  expect(await at()).toEqual(before);
  await expect(p.locator('#phoneCardBack')).toBeHidden(); // a drag is not a tap
  // A double-tap opens no editor.
  await phone.tap(s); await phone.tap(s);
  await expect(p.locator('#canvas .node textarea, #canvas .node [contenteditable="true"]')).toHaveCount(0);
  await phone.tapOn(p.locator('.phone-card-close')).catch(() => {}); // the taps open its card
  await expect(p.locator('#phoneCardBack')).toBeHidden();
  // A tap on Revenue: its card.
  await phone.tapOn(p.locator('#canvas .node', { hasText: 'Revenue' }));
  await expect(p.locator('#phoneCardTitle')).toHaveText('Revenue');
  await expect(p.locator('.phone-card-where')).toHaveText('Sales');
  await expect(p.locator('.phone-card-formula')).toHaveText('= Price × Volume');
  await expect(p.locator('.phone-card-readers')).toHaveText('Read by the Report canvas.');
  await expect(p.locator('.phone-card-table tbody tr')).toHaveCount(3);
  await expect(p.locator('.phone-card-table tbody tr').nth(2)).toContainText('1,210');
  await expect(p.locator('.phone-card-input')).toHaveCount(0); // not an input
  await p.keyboard.press('Escape');
  await expect(p.locator('#phoneCardBack')).toBeHidden();
  // An input's card has its slider.
  await phone.tapOn(p.locator('#canvas .node', { hasText: 'Price' }));
  await expect(p.locator('.phone-card-formula')).toHaveText('An input: a number typed in.');
  await expect(p.locator('.phone-card-readers')).toHaveText('Read by Revenue.');
  await phone.tapOn(p.locator('.phone-card-input .ps-plus'));
  expect(await value(p, 'Sales', 'Revenue', 1)).toBe(1050); // steps of 0.5 around 10
  await expect(p.locator('.phone-card-table tbody tr').first()).toContainText('10.5');
  // A tap on the dim page around it closes it; the operator opens nothing.
  await phone.tap({ x: 195, y: 120 });
  await expect(p.locator('#phoneCardBack')).toBeHidden();
  await p.selectOption('#phoneCanvasPick', 'cR');
  await phone.tapOn(p.locator('#canvas .node', { hasText: 'Tax rate' }));
  await expect(p.locator('#phoneCardTitle')).toHaveText('Tax rate');
  await phone.tapOn(p.locator('.phone-card-close'));
  await phone.tapOn(p.locator('#canvas .node[data-id="a"]')); // the alias of Revenue
  await expect(p.locator('.phone-card-formula')).toHaveText('The same as Revenue on Sales.');
  await phone.done();
});

// The shared input rule decides (src/shared/input-rule.js), as for ExcelExporter's Inputs tab: an
// input with nothing typed (a template's rectangle fed by a socket nothing feeds) is listed, at 0.
test('every input by the shared rule, nothing typed included: the same inputs as ExcelExporter\'s Inputs tab', async ({ browser, page }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const model = JSON.parse(fs.readFileSync(fixture('models', 'phone-blank-inputs.json'), 'utf8'));
  await loadModel(phone, model);
  const names = await p.locator('#phonePanel .phone-input-name').allTextContents();
  expect(names).toEqual(['Cash', 'Accounts Receivable', 'Gross PPE']);
  await expect(input(p, 'Cash').locator('.phone-input-blank')).toHaveText('No number yet (counts as 0)');
  await expect(input(p, 'Cash').locator('.ps-value')).toHaveText('0');
  await expect(input(p, 'Gross PPE').locator('.phone-input-blank')).toHaveCount(0);
  expect(await value(p, 'Balance Sheet', 'Total Asset', 1)).toBe(500);
  // Setting a number writes it into the rectangle, as typing it on a computer: one undo step.
  await typeInto(phone, input(p, 'Cash'), '100');
  expect(await value(p, 'Balance Sheet', 'Total Asset', 1)).toBe(600);
  expect(await p.evaluate(() => { fm.switchCanvas('Balance Sheet'); return fm.nodes().find(n => n.id === 'cash').text; })).toBe('Cash\n100');
  await expect(input(p, 'Cash').locator('.phone-input-blank')).toHaveCount(0);
  await expect(p.locator('#phoneTitle')).toHaveText(/•$/);
  await phone.tapOn(p.locator('#phoneUndo'));
  expect(await p.evaluate(() => { fm.switchCanvas('Balance Sheet'); return fm.nodes().find(n => n.id === 'cash').text; })).toBe('Cash');
  await expect(input(p, 'Cash').locator('.phone-input-blank')).toBeVisible();
  // The slider moves it too (around 0: −10 to +10).
  await phone.slide(input(p, 'Accounts Receivable').locator('.ps-rail'), 0.5, 0.75);
  expect(await value(p, 'Balance Sheet', 'Total Asset', 1)).toBe(505);
  await phone.done();

  // ExcelExporter gathers the same rectangles on its Inputs tab, and not the total.
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'phone-blank-inputs.json');
  await X.setInputsTab(page, true);
  const { wb } = await X.generate(page);
  const ws = wb.Sheets['Inputs'];
  for(const n of names) expect(X.findRow(ws, n).length, n + ' on the Inputs tab').toBeGreaterThan(0);
  expect(X.findRow(ws, 'Total Asset')).toEqual([]);
});

test('an input on a canvas used as a block says so', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => fm.command('loadSystem'))]);
  await chooser.setFiles(fixture('models', 'vertical-depreciation-block.json'));
  await p.locator('.modal-box button', { hasText: 'OK' }).click();
  await expect(p.locator('#phonePanel .phone-group[data-canvas="cDef"] .phone-input-name')).toHaveText(['Tax rate']);
  await expect(p.locator('#phonePanel .phone-group[data-canvas="cDef"] .phone-input-note')).toHaveText('Used in 1 block: a change here changes every copy.');
  await expect(p.locator('#phonePanel .phone-group[data-canvas="cHost"] .phone-input-note')).toHaveCount(0);
  await phone.done();
});

test('☰: Full app and back, kept after a reload; Help', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await loadModel(phone, MODEL);
  await phone.tapOn(p.locator('#phoneNav-menu'));
  await expect(p.locator('#phoneMenu')).toBeVisible();
  await phone.tapOn(p.locator('#phoneHelp'));
  await expect(p.locator('#helpPanel')).toBeVisible();
  await p.keyboard.press('F1');
  await phone.tapOn(p.locator('#phoneNav-menu'));
  await phone.tapOn(p.locator('#phoneFullApp'));
  await expect(p.locator('#ribbon')).toBeVisible();
  await expect(p.locator('#phoneNav')).toBeHidden();
  await expect(p.locator('#phoneLayoutBtn')).toBeVisible();
  await p.reload();
  await p.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await expect(p.locator('#ribbon')).toBeVisible();
  await phone.tapOn(p.locator('#phoneLayoutBtn'));
  await expect(p.locator('#phoneNav')).toBeVisible();
  await expect(p.locator('#ribbon')).toBeHidden();
  await phone.done();
});

test('hostile names stay text on a phone', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = JSON.parse(JSON.stringify(MODEL));
  model.canvases[0].name = '<b>Sales</b>';
  model.canvases[0].nodes[0].text = evil + '\n10';
  model.canvases[0].nodes[3].text = '<i>Rev</i>';
  await loadModel(phone, model, 'evil.json');
  await expect(p.locator('#phonePanel .phone-input-name').first()).toHaveText(evil);
  await expect(p.locator('#phonePanel .phone-head').first()).toHaveText('<b>Sales</b>');
  await phone.tapOn(p.locator('#phoneNav-canvas'));
  await expect(p.locator('#phoneCanvasPick option').first()).toHaveText('<b>Sales</b>');
  await p.selectOption('#phoneCanvasPick', 'cS');
  await phone.tapOn(p.locator('#canvas .node', { hasText: '<i>Rev</i>' }));
  await expect(p.locator('#phoneCardTitle')).toHaveText('<i>Rev</i>');
  await expect(p.locator('.phone-card-formula')).toHaveText('= ' + evil + ' × Volume');
  expect(await p.locator('#phonePanel img, #phoneCard img, #phoneCard i, #phonePanel b').count()).toBe(0);
  expect(await p.evaluate(() => window.__pwned)).toBeUndefined();
  await phone.done();
});
