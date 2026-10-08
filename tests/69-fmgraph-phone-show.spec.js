// 69. fmGraph on a phone, sideways and showing (step 17, phase P1b; docs/step17-phones.md).
// Chromium with a phone's screen (844 × 390 sideways, 390 × 844 upright) and a touchscreen;
// real touch input, several fingers at once, through the Chrome DevTools Protocol. The phone's
// share sheet and Wake Lock are replaced inside the page by stand-ins that record what they
// were given (the app is not changed for testing).
// - The mixer: faders at the two edges, moved by two and three fingers at once; finer
//   sideways; the notch; a tap on a name puts another slider there, remembered per board.
// - Show: a chart or bar on the whole screen from its quick look, following the sliders, the
//   screen kept on and let go; ×, Esc and the back gesture.
// - Holding A: on a scenario card and on the compare strip, the bars show it until the finger
//   lifts; a quick tap still compares.
// - Share: a picture of the board and of a chart shown (a real PNG of the right size), the
//   board file, the download where sharing can't, a cancelled share, hostile names.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT } = require('./helpers/apps');

const URL = 'http://local.test/fmGraph.html';
const SIDEWAYS = { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
const UPRIGHT = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

// The stand-ins: the share sheet (canShare / share, recording each call's files) and Wake Lock
// (recording each request and release). `share` says what the share sheet does: 'ok', 'cancel', or
// 'none' (a browser that can't share files).
async function openPhone(browser, options = SIDEWAYS, { share = 'ok' } = {}){
  const context = await browser.newContext(options);
  const blocked = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if(url === URL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) });
    blocked.push(url);
    return route.abort();
  });
  await context.addInitScript((mode) => {
    window.__shared = [];
    window.__locks = [];
    if(mode !== 'none'){
      navigator.canShare = (d) => !!(d && Array.isArray(d.files) && d.files.every(f => f instanceof File));
      navigator.share = async (d) => {
        if(mode === 'cancel'){ const e = new Error('cancelled'); e.name = 'AbortError'; throw e; }
        window.__shared.push(d);
      };
    } else {
      navigator.canShare = undefined;
      navigator.share = undefined;
    }
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (type) => {
      const lock = { type, released: false, release: async () => { lock.released = true; } };
      window.__locks.push(lock);
      return lock;
    } } });
  }, share);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => !!window.fmGraph);
  const cdp = await context.newCDPSession(page);
  // Each point { x, y, id }: one finger per id.
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y, id: p.id || 1 })) });
  const api = {
    context, page, errors, touch,
    async tap(p){ await touch('touchStart', [p]); await touch('touchEnd', []); },
    async hold(p, ms = 700){ await touch('touchStart', [p]); await page.waitForTimeout(ms); await touch('touchEnd', []); },
    async tapOn(locator){
      await expect(locator).toBeVisible();
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await api.tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    },
    async holdOn(locator, ms){
      await expect(locator).toBeVisible();
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await api.hold({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, ms);
    },
    async done(){
      expect(blocked, 'fmGraph tried to reach the network').toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    },
  };
  return api;
}
async function sample(page){
  await page.click('#btnSample');
  await expect(page.locator('#board')).toBeVisible();
}
const values = (page) => page.evaluate(() => fmGraph.board().sliders.map(s => s.value));
const revenue = (page) => page.evaluate(() => fmGraph.value('Revenue', 1));
// A fader's rail: its top, height and middle.
async function faderRail(page, i){
  const b = await page.locator('.fader').nth(i).locator('.ps-rail').boundingBox();
  return { x: b.x + b.width / 2, top: b.y, h: b.height, at: (f) => b.y + b.height * (1 - f) };
}
// What was shared: each call's files' name, type and size, and a PNG's width and height.
const sharedFiles = (page) => page.evaluate(async () => {
  const out = [];
  for(const call of window.__shared){
    const files = [];
    for(const f of call.files){
      const one = { name: f.name, type: f.type, size: f.size };
      if(f.type === 'image/png'){
        const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
        one.png = Array.from(head).join(',') === '137,80,78,71,13,10,26,10';
        const bmp = await createImageBitmap(f);
        one.w = bmp.width; one.h = bmp.height;
      } else one.text = await f.text();
      files.push(one);
    }
    out.push({ title: call.title, files });
  }
  return out;
});

test('the mixer: faders at the edges, two fingers move two sliders at once, the board between them', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await expect(p.locator('body')).toHaveClass(/mixing/);
  await expect(p.locator('#sliderDock')).toBeHidden();
  await expect(p.locator('#mixerLeft .fader')).toHaveCount(1);
  await expect(p.locator('#mixerRight .fader')).toHaveCount(1);
  await expect(p.locator('#mixerLeft .fader-name')).toHaveText('Price');
  await expect(p.locator('#mixerRight .fader-name')).toHaveText('Volume');
  // The board sits between the faders.
  const left = await p.locator('#mixerLeft').boundingBox(), right = await p.locator('#mixerRight').boundingBox(), bars = await p.locator('#barList').boundingBox();
  expect(bars.x).toBeGreaterThanOrEqual(left.x + left.width);
  expect(bars.x + bars.width).toBeLessThanOrEqual(right.x);
  // Two thumbs, one on each fader, both pushed up a fifth: Price 5–15 by 2, Volume −50…50 by 20.
  const a = await faderRail(p, 0), b = await faderRail(p, 1);
  const fa = { x: a.x, y: a.at(0.5), id: 1 }, fb = { x: b.x, y: b.at(0.5), id: 2 };
  await phone.touch('touchStart', [fa]);
  await phone.touch('touchStart', [fa, fb]);
  for(let i = 1; i <= 8; i++) await phone.touch('touchMove', [{ ...fa, y: fa.y - a.h * 0.2 * i / 8 }, { ...fb, y: fb.y - b.h * 0.2 * i / 8 }]);
  await expect(p.locator('.fader .ps.dragging')).toHaveCount(2); // both held at once
  await phone.touch('touchEnd', []);
  const [price, volume] = await values(p);
  expect(Math.abs(price - 12)).toBeLessThanOrEqual(0.25);
  expect(Math.abs(volume - 20)).toBeLessThanOrEqual(1);
  expect(await revenue(p)).toBeCloseTo(price * 1000 * (1 + volume / 100), 6);
  await expect(p.locator('.fader').first().locator('.ps-value')).toHaveText(String(price));
  await expect(p.locator('.fader').first().locator('.fader-change')).toContainText('+');
  // Finer: the finger moved sideways, away from the fader (×¼), then up a fifth: 0.5.
  const c = await faderRail(p, 0);
  const s = { x: c.x, y: c.at(0.5), id: 1 };
  await phone.touch('touchStart', [s]);
  for(let i = 1; i <= 5; i++) await phone.touch('touchMove', [{ x: s.x + 120 * i / 5, y: s.y, id: 1 }]);
  for(let i = 1; i <= 8; i++) await phone.touch('touchMove', [{ x: s.x + 120, y: s.y - c.h * 0.2 * i / 8, id: 1 }]);
  await expect(p.locator('.fader').first().locator('.ps-bubble')).toHaveText('fine ×¼');
  await phone.touch('touchEnd', []);
  expect((await values(p))[0]).toBe(price + 0.5);
  // A double-tap: the model's own number.
  await phone.tap({ x: c.x, y: c.at(0.9) });
  await phone.tap({ x: c.x, y: c.at(0.9) });
  await expect.poll(async () => (await values(p))[0]).toBeNull();
  // Upright again: the dock, no mixer.
  await p.setViewportSize({ width: 390, height: 844 });
  await expect(p.locator('#sliderDock')).toBeVisible();
  await expect(p.locator('.fader')).toHaveCount(0);
  await expect(p.locator('body')).not.toHaveClass(/mixing/);
  await phone.done();
});

test('three fingers, three faders; a tap on a name puts another slider there, remembered per board', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await p.evaluate(() => { fmGraph.addSlider('Unit cost'); fmGraph.addSlider('Overheads'); fmGraph.addSlider('Equipment'); });
  // Four on the mixer (the most), two each side; the fifth slider waits.
  await expect(p.locator('.fader')).toHaveCount(4);
  await expect(p.locator('#mixerLeft .fader-name')).toHaveText(['Price', 'Volume']);
  await expect(p.locator('#mixerRight .fader-name')).toHaveText(['Unit cost', 'Overheads']);
  // Three fingers at once.
  const r = await Promise.all([0, 1, 2].map(i => faderRail(p, i)));
  const down = r.map((f, i) => ({ x: f.x, y: f.at(0.5), id: i + 1 }));
  await phone.touch('touchStart', down.slice(0, 1));
  await phone.touch('touchStart', down.slice(0, 2));
  await phone.touch('touchStart', down);
  for(let k = 1; k <= 6; k++) await phone.touch('touchMove', down.map((d, i) => ({ ...d, y: d.y - r[i].h * 0.25 * k / 6 })));
  await phone.touch('touchEnd', []);
  const v = await values(p);
  expect(v.slice(0, 3).every(x => x !== null && x > 0)).toBe(true);
  expect(v[3]).toBeNull();
  // Equipment in place of Overheads.
  await phone.tapOn(p.locator('#mixerRight .fader-name').nth(1));
  await expect(p.locator('#faderMenu')).toBeVisible();
  await expect(p.locator('#faderMenu [aria-checked="true"]')).toHaveText('Overheads');
  await phone.tapOn(p.locator('#faderMenu button', { hasText: 'Equipment' }));
  await expect(p.locator('#faderMenu')).toBeHidden();
  await expect(p.locator('#mixerRight .fader-name')).toHaveText(['Unit cost', 'Equipment']);
  // Two already there swap places.
  await phone.tapOn(p.locator('#mixerLeft .fader-name').first());
  await phone.tapOn(p.locator('#faderMenu button', { hasText: 'Volume' }));
  await expect(p.locator('#mixerLeft .fader-name')).toHaveText(['Volume', 'Price']);
  // Kept after a reload, for this board only.
  await p.reload();
  await p.waitForFunction(() => !!window.fmGraph);
  await sample(p);
  await expect(p.locator('#mixerLeft .fader-name')).toHaveText(['Volume', 'Price']);
  await expect(p.locator('#mixerRight .fader-name')).toHaveText(['Unit cost', 'Equipment']);
  await p.evaluate(() => { fmGraph.duplicateBoard(); fmGraph.renameBoard('Other'); });
  await expect(p.locator('#mixerLeft .fader-name')).toHaveText(['Price', 'Volume']);
  await phone.done();
});

test('Show: a chart on the whole screen from its quick look, following the faders, the screen kept on', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const chart = p.locator('.chart-widget').first();
  await chart.evaluate(e => e.scrollIntoView({ block: 'start' }));
  const b = await chart.boundingBox();
  await phone.hold({ x: b.x + b.width / 2, y: b.y + 120 });
  // A chart's quick look: its rectangles in the period it shows.
  await expect(p.locator('#peekCard')).toBeVisible();
  await expect(p.locator('#peekTitle')).toHaveText('Balance sheet');
  await expect(p.locator('#peekWhere')).toHaveText('Columns · Year 1');
  await expect(p.locator('#peekTable tbody tr')).toHaveCount(4);
  await expect(p.locator('#peekTable tbody tr').first()).toContainText('Closing cash');
  await expect(p.locator('#peekChart')).toBeHidden();
  await phone.tapOn(p.locator('#peekShow'));
  await expect(p.locator('#showView')).toBeVisible();
  await expect(p.locator('#showTitle')).toHaveText('Balance sheet');
  await expect(p.locator('#showBody svg.bar-chart')).toHaveCount(1);
  await expect(p.locator('#showBody .chart-key')).toContainText('Assets');
  expect(await p.evaluate(() => window.__locks.length)).toBe(1); // the screen kept on
  expect(await p.evaluate(() => window.__locks[0].type)).toBe('screen');
  // The faders still work beside it, and it follows them.
  await expect(p.locator('.fader')).toHaveCount(2);
  const label = () => p.locator('#showBody .t-value').first().textContent();
  const before = await label();
  const a = await faderRail(p, 0);
  await phone.touch('touchStart', [{ x: a.x, y: a.at(0.5) }]);
  for(let i = 1; i <= 6; i++) await phone.touch('touchMove', [{ x: a.x, y: a.at(0.5) - a.h * 0.2 * i / 6 }]);
  await phone.touch('touchEnd', []);
  await expect.poll(label).not.toBe(before);
  // × ends it and lets the screen sleep.
  await phone.tapOn(p.locator('#showClose'));
  await expect(p.locator('#showView')).toBeHidden();
  expect(await p.evaluate(() => window.__locks[0].released)).toBe(true);
  // The back gesture ends it too; so does Esc.
  const bar = p.locator('.bar-widget').first();
  await bar.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await phone.holdOn(bar.locator('.bar-chart-host'));
  await phone.tapOn(p.locator('#peekShow'));
  await expect(p.locator('#showTitle')).toHaveText('Profit');
  await expect(p.locator('#showBody svg.bar-chart')).toHaveCount(1);
  await p.goBack();
  await expect(p.locator('#showView')).toBeHidden();
  expect(await p.evaluate(() => window.__locks.every(l => l.released))).toBe(true);
  await expect(p.locator('#board')).toBeVisible(); // still fmGraph, the same model
  await phone.holdOn(bar.locator('.bar-chart-host'));
  await phone.tapOn(p.locator('#peekShow'));
  await p.keyboard.press('Escape');
  await expect(p.locator('#showView')).toBeHidden();
  await phone.done();
});

test('Show upright: the dock stays under the chart', async ({ browser }) => {
  const phone = await openPhone(browser, UPRIGHT);
  const p = phone.page;
  await sample(p);
  const chart = p.locator('.chart-widget').first();
  await chart.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b = await chart.boundingBox();
  await phone.hold({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await phone.tapOn(p.locator('#peekShow'));
  await expect(p.locator('#showView')).toBeVisible();
  const dock = await p.locator('#sliderDock').boundingBox(), shown = await p.locator('#showBody svg').boundingBox();
  expect(shown.y + shown.height).toBeLessThanOrEqual(dock.y + 1);
  await expect(p.locator('#dockCards .dock-card').first()).toBeVisible();
  await phone.tapOn(p.locator('#dockCards .dock-card').first().locator('.ps-plus'));
  expect((await values(p))[0]).toBe(10.25);
  await phone.done();
});

test('holding A: the bars show the scenario until the finger lifts; a quick tap still compares', async ({ browser }) => {
  const phone = await openPhone(browser, UPRIGHT);
  const p = phone.page;
  await sample(p);
  await p.evaluate(() => { fmGraph.setSlider(fmGraph.board().sliders[0].id, 12); fmGraph.saveScenario('High <i>price</i>'); fmGraph.resetAll(); });
  await expect(p.locator('#scenarioList .scenario')).toHaveCount(1);
  await expect(p.locator('.scenario-hint')).toBeVisible();
  const A = p.locator('#scenarioList .scenario-compare').first();
  await A.scrollIntoViewIfNeeded();
  const ab = await A.boundingBox();
  const at = { x: ab.x + ab.width / 2, y: ab.y + ab.height / 2 };
  await phone.touch('touchStart', [at]);
  await expect(p.locator('#lookBar')).toBeVisible();
  await expect(p.locator('#lookBar')).toHaveText('Looking at scenario “High <i>price</i>” — let go to come back');
  await expect(p.locator('#lookBar i')).toHaveCount(0);
  expect(await revenue(p)).toBe(12000); // the bars show the scenario…
  expect((await values(p))[0]).toBeNull(); // …the sliders stay where they were
  await phone.touch('touchEnd', []);
  await expect(p.locator('#lookBar')).toBeHidden();
  expect(await revenue(p)).toBe(10000);
  await p.waitForTimeout(500);
  await expect(p.locator('#compareBar')).toBeHidden(); // the hold was not a tap
  // A quick tap compares, as before; then the strip's A held looks at A.
  await phone.tap(at);
  await expect(p.locator('#compareBar')).toBeVisible();
  const mark = p.locator('#compareBar .compare-mark');
  await mark.scrollIntoViewIfNeeded();
  const mb = await mark.boundingBox();
  await phone.touch('touchStart', [{ x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 }]);
  await expect(p.locator('#lookBar')).toHaveText('Looking at A — let go to come back');
  expect(await revenue(p)).toBe(12000);
  await phone.touch('touchEnd', []);
  await expect(p.locator('#lookBar')).toBeHidden();
  expect(await revenue(p)).toBe(10000);
  await expect(p.locator('#compareBar')).toBeVisible();
  await phone.done();
});

test('Share: a picture of the board, a picture of the chart shown, the board file', async ({ browser }) => {
  const phone = await openPhone(browser, UPRIGHT);
  const p = phone.page;
  await sample(p);
  await phone.tapOn(p.locator('#dockCards .dock-card').first().locator('.ps-plus'));
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await phone.tapOn(p.locator('#phoneSharePicture'));
  await expect.poll(async () => (await sharedFiles(p)).length).toBe(1);
  let shared = await sharedFiles(p);
  expect(shared[0].title).toBe('Board');
  expect(shared[0].files).toHaveLength(1);
  const pic = shared[0].files[0];
  expect(pic.name).toBe('Sample model - Board.png');
  expect(pic.type).toBe('image/png');
  expect(pic.png).toBe(true);
  expect(pic.w).toBe(1080);
  expect(pic.h).toBeGreaterThan(1500); // two charts and two bars, one under the other
  // The board file.
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await phone.tapOn(p.locator('#phoneShareFile'));
  await expect.poll(async () => (await sharedFiles(p)).length).toBe(2);
  shared = await sharedFiles(p);
  const file = shared[1].files[0];
  expect(file.name).toBe('Sample model - Board.board.json');
  expect(file.type).toBe('application/json');
  const data = JSON.parse(file.text);
  expect(data.kind).toBe('fmIDE-graph-board');
  expect(data.boards).toHaveLength(1);
  expect(data.boards[0].sliders.every(s => !('value' in s) || s.value === undefined)).toBe(true); // never where the sliders are
  // In Show: the chart shown, alone.
  const chart = p.locator('.chart-widget').nth(1);
  await chart.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b = await chart.boundingBox();
  await phone.hold({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await phone.tapOn(p.locator('#peekShow'));
  await phone.tapOn(p.locator('#showShare'));
  await expect.poll(async () => (await sharedFiles(p)).length).toBe(3);
  shared = await sharedFiles(p);
  expect(shared[2].title).toBe('Profit');
  expect(shared[2].files[0].name).toBe('Sample model - Profit.png');
  expect(shared[2].files[0].png).toBe(true);
  expect(shared[2].files[0].h).toBeLessThan(pic.h);
  await phone.done();
});

test('Share where the phone can\'t share files: downloads; a cancelled share does nothing', async ({ browser }) => {
  const none = await openPhone(browser, UPRIGHT, { share: 'none' });
  await sample(none.page);
  await none.tapOn(none.page.locator('#btnPhoneMenu'));
  const download = none.page.waitForEvent('download');
  await none.tapOn(none.page.locator('#phoneSharePicture'));
  const d = await download;
  expect(d.suggestedFilename()).toBe('Sample model - Board.png');
  await expect(none.page.locator('[data-slot="share"]')).toContainText('Saved the picture: Sample model - Board.png.');
  await none.done();

  const cancel = await openPhone(browser, UPRIGHT, { share: 'cancel' });
  await sample(cancel.page);
  await cancel.tapOn(cancel.page.locator('#btnPhoneMenu'));
  await cancel.tapOn(cancel.page.locator('#phoneShareFile'));
  await cancel.page.waitForTimeout(500);
  await expect(cancel.page.locator('.note.err')).toHaveCount(0);
  await expect(cancel.page.locator('[data-slot="share"]')).toHaveCount(0);
  await cancel.done();
});

test('hostile names on the mixer, in Show and in a shared picture stay text', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: [evil, 'P2'], canvases: [{ id: 'c1', name: evil, nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: evil + '\n5' }, { id: 'o', type: 'operator', x: 100, y: 0, text: '+' }, { id: 'b', type: 'value', x: 200, y: 0, text: '<b>Out</b>' },
  ], edges: [{ id: 'e1', from: 'a', to: 'o' }, { id: 'e2', from: 'o', to: 'b' }] }] };
  await p.evaluate((m) => fmGraph.load(m, '<i>Model</i>'), model);
  await p.evaluate(() => { fmGraph.addSlider('#a'); fmGraph.addBar('#b'); fmGraph.renameBoard('<svg onload="window.__pwned=2">'); });
  await expect(p.locator('.fader-name').first()).toHaveText(evil);
  const bar = p.locator('.bar-widget').first();
  await phone.holdOn(bar.locator('.bar-chart-host'));
  await phone.tapOn(p.locator('#peekShow'));
  await expect(p.locator('#showTitle')).toHaveText('<b>Out</b>');
  await phone.tapOn(p.locator('#showShare'));
  await expect.poll(async () => (await sharedFiles(p)).length).toBe(1);
  const shared = await sharedFiles(p);
  expect(shared[0].files[0].png).toBe(true);
  await phone.tapOn(p.locator('#showClose'));
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await phone.tapOn(p.locator('#phoneSharePicture'));
  await expect.poll(async () => (await sharedFiles(p)).length).toBe(2);
  expect((await sharedFiles(p))[1].files[0].name).toBe('_i_Model_i_ - _svg onload_window.__pwned_2_.png'); // the name made safe for a file
  expect(await p.locator('img, #board b, #showView b, .gbar i').count()).toBe(0);
  expect(await p.evaluate(() => window.__pwned)).toBeUndefined();
  await phone.done();
});

test('a tablet sideways and a computer: no mixer, no Show', async ({ browser, page }) => {
  const tablet = await openPhone(browser, { viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, hasTouch: true });
  await tablet.page.click('#btnSample');
  await expect(tablet.page.locator('.slider-widget')).toHaveCount(2);
  await expect(tablet.page.locator('.fader')).toHaveCount(0);
  await expect(tablet.page.locator('body')).not.toHaveClass(/mixing/);
  await tablet.done();
  await page.goto(URL);
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.fader')).toHaveCount(0);
  await expect(page.locator('#mixerLeft')).toBeHidden();
  await expect(page.locator('#mixerRight')).toBeHidden();
  // A quick click on a scenario's A compares at once, as before.
  await page.evaluate(() => { fmGraph.setSlider(fmGraph.board().sliders[0].id, 12); fmGraph.saveScenario('S'); fmGraph.resetAll(); });
  await page.click('#scenarioList .scenario-compare');
  await expect(page.locator('#compareBar')).toBeVisible();
  await expect(page.locator('#lookBar')).toBeHidden();
});
