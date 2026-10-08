// 68. fmGraph on a phone (step 17, phase P1a; docs/step17-phones.md). Chromium with a phone's
// screen (390 × 844, and sideways) and a touchscreen, real touch input through the Chrome
// DevTools Protocol (Input.dispatchTouchEvent). The phone's vibration is replaced inside the
// page by a stand-in that records what it was asked (the app is not changed for testing).
// - Which screens take the phone layout: a phone upright and sideways; not a tablet, not a
//   narrow window with a mouse.
// - The sample on a phone: the board first, the sliders in the dock, nothing to build with.
// - The phone slider: grabbed anywhere without a jump, finer by moving the finger up, the notch
//   at the model's own number and the tick (and its switch), − and + (held: repeating), typing,
//   a double-tap, the keys; the numbers always fmIDE's calculation.
// - Boards by a swipe and ‹ ›; the dock drawn up and down; a bar's quick look by holding it;
//   ☰ and Full app (kept); hostile names as text; nothing sent anywhere, no page errors.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT } = require('./helpers/apps');

const URL = 'http://local.test/fmGraph.html';
const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, hasTouch: true, isMobile: true };

// A page of fmGraph in its own browser context (a phone unless `options` says otherwise),
// served offline; every request elsewhere is blocked and counted.
async function openPhone(browser, options = PHONE, { vibrate = true } = {}){
  const context = await browser.newContext(options);
  const blocked = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if(url === URL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) });
    blocked.push(url);
    return route.abort();
  });
  // The phone's vibration, recorded (Android has it; Chromium on a desktop answers false).
  if(vibrate) await context.addInitScript(() => {
    window.__vibrations = [];
    Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function(p){ window.__vibrations.push(p); return true; } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => !!window.fmGraph);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y })) });
  const api = {
    context, page, errors, touch,
    // A finger down at a, through each point, then lifted.
    async drag(a, points, { lift = true } = {}){
      await touch('touchStart', [a]);
      for(const p of points) await touch('touchMove', [p]);
      if(lift) await touch('touchEnd', []);
    },
    async tap(p){ await touch('touchStart', [p]); await touch('touchEnd', []); },
    async hold(p, ms = 700){ await touch('touchStart', [p]); await page.waitForTimeout(ms); await touch('touchEnd', []); },
    async tapOn(locator){
      await expect(locator).toBeVisible();
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await api.tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
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
  await expect(page.locator('#dockCards .dock-card')).toHaveCount(2);
}
const card = (page, i) => page.locator('#dockCards .dock-card').nth(i);
// The slider's rail (the track less the knob's room at each end) and its middle line.
async function rail(page, i = 0){
  const b = await card(page, i).locator('.ps-rail').boundingBox();
  return { x: b.x, w: b.width, y: b.y + b.height / 2, at: (f) => b.x + f * b.width };
}
// n even steps from a to b (not counting a).
const steps = (a, b, n = 8) => Array.from({ length: n }, (_, i) => ({ x: a.x + (b.x - a.x) * (i + 1) / n, y: a.y + (b.y - a.y) * (i + 1) / n }));
const price = (page) => page.evaluate(() => fmGraph.board().sliders[0].value);
const revenue = (page) => page.evaluate(() => fmGraph.value('Revenue', 1));

test('a phone takes the phone layout, upright and sideways; a tablet and a narrow mouse window do not', async ({ browser, page }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('#btnPhoneMenu')).toBeVisible();
  for(const id of ['btnOpen', 'btnAddBar', 'btnAddChart', 'btnAddSlider', 'btnResetAll', 'btnPinA', 'btnHelp', 'btnTutorials']) await expect(p.locator('#' + id)).toBeHidden();
  await expect(p.locator('#backToFmide')).toBeVisible();
  await expect(p.locator('#backToFmide')).toHaveAccessibleName('Back to fmIDE');
  await expect(p.locator('#dropBox')).toContainText('Choose a .fmide or .json file');
  await expect(p.locator('#sliderDock')).toBeHidden(); // no model yet
  await phone.done();

  const sideways = await openPhone(browser, SIDEWAYS);
  await expect(sideways.page.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await sample(sideways.page);
  await expect(sideways.page.locator('#sliderDock')).toBeVisible();
  await sideways.done();

  const tablet = await openPhone(browser, { viewport: { width: 1024, height: 768 }, screen: { width: 1024, height: 768 }, hasTouch: true });
  await expect(tablet.page.locator('body')).not.toHaveClass(/phone/);
  await tablet.page.click('#btnSample');
  await expect(tablet.page.locator('.slider-widget')).toHaveCount(2);
  await expect(tablet.page.locator('#sliderDock')).toBeHidden();
  await expect(tablet.page.locator('#btnAddBar')).toBeVisible();
  await expect(tablet.page.locator('#btnPhoneMenu')).toBeHidden();
  await tablet.done();

  // A window as narrow as a phone, with a mouse: the page as it was.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.fmGraph);
  await expect(page.locator('body')).not.toHaveClass(/phone/);
  await expect(page.locator('#btnAddBar')).toBeVisible();
});

test('the sample on a phone: the board first, the sliders in the dock, nothing to build with', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await expect(card(p, 0).locator('.dock-name')).toHaveText('Price');
  await expect(card(p, 0).locator('.ps-value')).toHaveText('10');
  await expect(card(p, 0).locator('.dock-base')).toHaveText('Model\'s number: 10');
  await expect(card(p, 1).locator('.dock-name')).toHaveText('Volume');
  await expect(card(p, 1).locator('.ps-value')).toHaveText('0%');
  await expect(p.locator('#dockDots .dock-dot')).toHaveCount(2);
  await expect(p.locator('#phoneBoards .phone-board-title')).toHaveText('Board');
  // The desktop sliders, the editors and the arranging are out of the way.
  await expect(p.locator('#sliderList')).toBeHidden();
  for(const sel of ['.arrange', '.widget-remove', '.bar-widget .widget-head select', '.bar-settings', '.chart-edit', '#boardTabs']) {
    const all = await p.locator(sel).all();
    for(const el of all) await expect(el).toBeHidden();
  }
  await expect(p.locator('.bar-widget .widget-title').first()).toHaveText('Profit');
  // The bars and charts come first, the scenarios after them.
  const bars = await p.locator('#barList').boundingBox(), sc = await p.locator('#scenariosPanel').boundingBox();
  expect(bars.y).toBeLessThan(sc.y);
  // No sideways scrolling of the page.
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // A swipe along the dock shows the next slider.
  const head = await card(p, 0).locator('.dock-card-head').boundingBox();
  const y = head.y + head.height / 2;
  await phone.drag({ x: 330, y }, steps({ x: 330, y }, { x: 40, y }, 10));
  await expect(p.locator('#dockDots .dock-dot').nth(1)).toHaveClass(/on/);
  await expect.poll(async () => Math.round((await card(p, 1).boundingBox()).x)).toBe(0);
  await phone.done();
});

test('the phone slider: grabbed anywhere it moves from where it is, the bars follow, the reach lights', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const r = await rail(p);
  // Grab a quarter of the way along, well away from the knob (in the middle): nothing jumps.
  const a = { x: r.at(0.25), y: r.y };
  await phone.touch('touchStart', [a]);
  expect(await revenue(p)).toBe(10000);
  await expect(card(p, 0).locator('.ps')).toHaveClass(/dragging/);
  // A fifth of the rail to the right: the range 5–15 moves by 2.
  for(const q of steps(a, { x: a.x + 0.2 * r.w, y: a.y })) await phone.touch('touchMove', [q]);
  await expect(p.locator('#board')).toHaveClass(/moving/); // the reached bars stand out
  await expect(p.locator('.bar-widget.reached')).toHaveCount(2);
  await phone.touch('touchEnd', []);
  expect(Math.abs(await price(p) - 12)).toBeLessThanOrEqual(0.25);
  const v = await price(p);
  expect(await revenue(p)).toBe(v * 1000);
  await expect(card(p, 0).locator('.ps-value')).toHaveText(String(v));
  await expect(card(p, 0).locator('.dock-change')).toContainText('+');
  await expect(card(p, 0).locator('.dock-base')).toContainText('double-tap to go back');
  expect(await p.evaluate(() => fmGraph.modelValue('Revenue', 1))).toBe(10000); // the model is never changed
  await expect(card(p, 0).locator('.ps')).not.toHaveClass(/dragging/);
  await phone.done();
});

test('finer by sliding the finger up: ×½, ×¼, ×⅒, said over the knob', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const r = await rail(p);
  const a = { x: r.at(0.5), y: r.y };
  // Up 120 pixels first (×¼), then a fifth of the rail to the right: 2 × ¼ = 0.5.
  await phone.drag(a, [...steps(a, { x: a.x, y: a.y - 120 }, 6), ...steps({ x: a.x, y: a.y - 120 }, { x: a.x + 0.2 * r.w, y: a.y - 120 })], { lift: false });
  await expect(card(p, 0).locator('.ps-bubble')).toBeVisible();
  await expect(card(p, 0).locator('.ps-bubble')).toHaveText('fine ×¼');
  expect(await price(p)).toBe(10.5);
  // Further up (×⅒): another fifth of the rail is 0.2, snapped to the step (0.25).
  const b = { x: a.x + 0.2 * r.w, y: a.y - 180 };
  await phone.touch('touchMove', [b]);
  for(const q of steps(b, { x: b.x + 0.2 * r.w, y: b.y })) await phone.touch('touchMove', [q]);
  await expect(card(p, 0).locator('.ps-bubble')).toHaveText('fine ×⅒');
  expect(await price(p)).toBe(10.75);
  await phone.touch('touchEnd', []);
  await expect(card(p, 0).locator('.ps-bubble')).toBeHidden();
  // Down again near the slider: full speed (a tenth of the rail is 1).
  const r2 = await rail(p);
  const c = { x: r2.at(0.5), y: r2.y };
  await phone.drag(c, steps(c, { x: c.x + 0.1 * r2.w, y: c.y }));
  expect(await price(p)).toBe(11.75);
  await phone.done();
});

test('the notch at the model\'s number, the tick, and its switch (kept)', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const r = await rail(p);
  const a = { x: r.at(0.5), y: r.y };
  // Out to about 12, then back to a little past the model's number: it settles there.
  await phone.drag(a, [...steps(a, { x: a.x + 0.2 * r.w, y: a.y }), ...steps({ x: a.x + 0.2 * r.w, y: a.y }, { x: a.x + 4, y: a.y })]);
  expect(await price(p)).toBeNull(); // the model's own number
  expect(await revenue(p)).toBe(10000);
  await expect(card(p, 0).locator('.ps')).toHaveClass(/at-base/);
  await expect(card(p, 0).locator('.dock-change')).toHaveText('');
  // Ticks on the way: the round marks, and the notch.
  const felt = await p.evaluate(() => window.__vibrations.length);
  expect(felt).toBeGreaterThanOrEqual(2);
  // ☰ → the switch: no more vibrations; the setting is kept.
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await expect(p.locator('#phoneVibrate')).toHaveText('Vibrate on the marks: On');
  await phone.tapOn(p.locator('#phoneVibrate'));
  await expect(p.locator('#phoneMenu')).toBeHidden();
  await p.evaluate(() => { window.__vibrations = []; });
  await phone.drag(a, steps(a, { x: a.x + 0.3 * r.w, y: a.y }));
  expect(await p.evaluate(() => window.__vibrations.length)).toBe(0);
  await p.reload();
  await p.waitForFunction(() => !!window.fmGraph);
  await sample(p);
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await expect(p.locator('#phoneVibrate')).toHaveText('Vibrate on the marks: Off');
  await expect(p.locator('#phoneVibrate')).toHaveAttribute('aria-checked', 'false');
  await phone.done();
});

test('no vibration on the phone (an iPhone): the switch is not offered, the tick is still seen', async ({ browser }) => {
  const phone = await openPhone(browser, PHONE, { vibrate: false });
  const p = phone.page;
  await p.evaluate(() => { delete Navigator.prototype.vibrate; });
  await sample(p);
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await expect(p.locator('#phoneVibrate')).toBeHidden();
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  const r = await rail(p);
  const a = { x: r.at(0.5), y: r.y };
  await phone.drag(a, steps(a, { x: a.x + 0.3 * r.w, y: a.y }), { lift: false });
  await expect(card(p, 0).locator('.ps')).toHaveClass(/ticked/);
  await phone.touch('touchEnd', []);
  await phone.done();
});

test('− and + step it (held: repeating, faster), the number typed, a double-tap and the keys', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await phone.tapOn(card(p, 0).locator('.ps-plus'));
  expect(await price(p)).toBe(10.25);
  expect(await revenue(p)).toBe(10250);
  await phone.tapOn(card(p, 0).locator('.ps-minus'));
  await phone.tapOn(card(p, 0).locator('.ps-minus'));
  expect(await price(p)).toBe(9.75);
  // Held for a second and a half: it repeats, faster and faster.
  const plus = await card(p, 0).locator('.ps-plus').boundingBox();
  await phone.hold({ x: plus.x + plus.width / 2, y: plus.y + plus.height / 2 }, 1500);
  const held = await price(p);
  expect(held).toBeGreaterThanOrEqual(11.25);
  await p.waitForTimeout(300);
  expect(await price(p)).toBe(held); // stopped on lifting
  // Typed: the number keyboard (with no minus sign needed for a price).
  await phone.tapOn(card(p, 0).locator('.ps-value'));
  const box = card(p, 0).locator('.ps-type');
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute('inputmode', 'decimal');
  expect(await box.evaluate(e => getComputedStyle(e).fontSize)).toBe('30px'); // as large as the number, not the 16px of other text boxes
  await box.fill('12.5');
  await box.press('Enter');
  expect(await price(p)).toBe(12.5);
  expect(await revenue(p)).toBe(12500);
  await expect(card(p, 0).locator('.ps-value')).toHaveText('12.5');
  // Something that isn't a number changes nothing.
  await phone.tapOn(card(p, 0).locator('.ps-value'));
  await card(p, 0).locator('.ps-type').fill('abc');
  await card(p, 0).locator('.ps-type').press('Enter');
  expect(await price(p)).toBe(12.5);
  // A double-tap on the slider: the model's own number.
  const r = await rail(p);
  const t = { x: r.at(0.1), y: r.y };
  await phone.tap(t);
  await phone.tap(t);
  await expect.poll(() => price(p)).toBeNull();
  expect(await revenue(p)).toBe(10000);
  // The keys.
  await card(p, 0).locator('.ps-track').focus();
  await p.keyboard.press('ArrowRight');
  expect(await price(p)).toBe(10.25);
  await p.keyboard.press('End');
  expect(await price(p)).toBe(15);
  await expect(card(p, 0).locator('.ps-track')).toHaveAttribute('aria-valuenow', '15');
  await p.keyboard.press('Home');
  expect(await price(p)).toBe(5);
  // A change by %: the keyboard can type a minus sign; the line says the first period's number.
  await p.evaluate(() => { const c = document.querySelectorAll('#dockCards .dock-card')[1]; c.scrollIntoView(); });
  await phone.tapOn(card(p, 1).locator('.ps-value'));
  await expect(card(p, 1).locator('.ps-type')).toHaveAttribute('inputmode', 'text');
  await card(p, 1).locator('.ps-type').fill('−10');
  await card(p, 1).locator('.ps-type').press('Enter');
  expect(await p.evaluate(() => fmGraph.value('Volume', 2))).toBe(990);
  await expect(card(p, 1).locator('.dock-change')).toHaveText('900 (−100)');
  await expect(card(p, 1).locator('.ps-value')).toHaveText('−10%');
  await phone.done();
});

test('boards: a swipe sideways across the bars, ‹ and ›; up and down scrolls', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await p.evaluate(() => { fmGraph.addBoard('Second <b>board</b>'); fmGraph.showBoard(0); });
  await expect(p.locator('#phoneBoards .phone-board-title')).toHaveText('Board');
  await expect(p.locator('#phoneBoards .dock-dot')).toHaveCount(2);
  await expect(p.locator('#phoneBoards .phone-board-arrow').first()).toBeDisabled();
  const shown = () => p.evaluate(() => fmGraph.boards().findIndex(b => b.shown));
  const chart = await p.locator('.chart-widget').first().boundingBox();
  const a = { x: 320, y: chart.y + 120 };
  // Up and down: no change of board.
  await phone.drag(a, steps(a, { x: a.x + 10, y: a.y - 150 }));
  expect(await shown()).toBe(0);
  // Right to left: the next board.
  await p.evaluate(() => window.scrollTo(0, 0));
  const c2 = await p.locator('.chart-widget').first().boundingBox();
  const a2 = { x: 320, y: c2.y + 120 };
  await phone.drag(a2, steps(a2, { x: 60, y: a2.y + 10 }, 6));
  await expect.poll(shown).toBe(1);
  await expect(p.locator('#phoneBoards .phone-board-title')).toHaveText('Second <b>board</b>');
  await expect(p.locator('#phoneBoards b')).toHaveCount(0);
  await expect(p.locator('#noBars')).toContainText('add them on a tablet or computer');
  await expect(p.locator('#dockEmpty')).toBeVisible();
  // Past the last: nothing.
  const b = { x: 320, y: 400 };
  await phone.drag(b, steps(b, { x: 60, y: 405 }, 6));
  expect(await shown()).toBe(1);
  await phone.tapOn(p.locator('#phoneBoards .phone-board-arrow').first());
  await expect.poll(shown).toBe(0);
  await expect(p.locator('#dockCards .dock-card')).toHaveCount(2);
  // A swipe that starts on the dock moves the dock, not the board.
  const head = await card(p, 0).locator('.dock-card-head').boundingBox();
  await phone.drag({ x: 330, y: head.y + 8 }, steps({ x: 330, y: head.y + 8 }, { x: 40, y: head.y + 8 }));
  expect(await shown()).toBe(0);
  await phone.done();
});

test('the dock: a tap shows every slider, drawn down it gets out of the way, the last bar scrolls above it', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const dock = p.locator('#sliderDock');
  await expect(dock).toHaveAttribute('data-state', 'peek');
  await phone.tapOn(p.locator('#dockHandle'));
  await expect(dock).toHaveAttribute('data-state', 'open');
  await expect(p.locator('#dockHandle')).toHaveAttribute('aria-expanded', 'true');
  const one = await card(p, 0).boundingBox(), two = await card(p, 1).boundingBox();
  expect(two.y).toBeGreaterThan(one.y + one.height - 2); // one under the other
  expect(Math.round(two.x)).toBe(Math.round(one.x));
  // Drawn down: one at a time, then out of the way (its name and number on the handle).
  const handleSwipe = async (dy) => {
    const h = await p.locator('#dockHandle').boundingBox();
    const a = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    await phone.drag(a, steps(a, { x: a.x, y: a.y + dy }, 5));
  };
  await handleSwipe(80);
  await expect(dock).toHaveAttribute('data-state', 'peek');
  await handleSwipe(80);
  await expect(dock).toHaveAttribute('data-state', 'closed');
  await expect(card(p, 0)).toBeHidden();
  await expect(p.locator('#dockHandleText')).toHaveText('Price: 10 ▴');
  await handleSwipe(-80);
  await expect(dock).toHaveAttribute('data-state', 'peek');
  // The page has room under it for the dock: the end of the page scrolls above it.
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await p.locator('#moversPanel').boundingBox(), d = await dock.boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(d.y + 1);
  await phone.done();
});

test('holding a bar: its quick look — every period, now and the model\'s, Trace; a tap is not a hold', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  await phone.tapOn(card(p, 0).locator('.ps-plus')); // Price 10.25
  const bar = p.locator('.bar-widget').first();
  await bar.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b = await bar.locator('.bar-chart-host').boundingBox();
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await phone.tap(at);
  await p.waitForTimeout(700);
  await expect(p.locator('#peekBack')).toBeHidden();
  await phone.hold(at);
  await expect(p.locator('#peekCard')).toBeVisible();
  await expect(p.locator('#peekTitle')).toHaveText('Profit');
  await expect(p.locator('#peekWhere')).toHaveText('Profit');
  await expect(p.locator('#peekTable tbody tr')).toHaveCount(4);
  await expect(p.locator('#peekTable tbody tr').first()).toContainText('Year 1');
  await expect(p.locator('#peekTable tbody tr').first()).toContainText('1,750');
  await expect(p.locator('#peekTable tbody tr').first()).toContainText('+250');
  await expect(p.locator('#peekChart polyline')).toHaveCount(2);
  // The lift of the finger that opened it doesn't close it; a tap around it does.
  await p.waitForTimeout(400);
  await expect(p.locator('#peekCard')).toBeVisible();
  await phone.tap({ x: 195, y: 30 });
  await expect(p.locator('#peekBack')).toBeHidden();
  // 🔍 Trace from it.
  await phone.hold(at);
  await expect(p.locator('#peekCard')).toBeVisible();
  await phone.tapOn(p.locator('#peekTrace'));
  await expect(p.locator('#peekBack')).toBeHidden();
  await expect(bar.locator('.widget-trace')).toHaveAttribute('aria-pressed', 'true');
  // Esc closes it too (the trace's note above has moved the bar down).
  await bar.evaluate(e => e.scrollIntoView({ block: 'center' }));
  const b2 = await bar.locator('.bar-chart-host').boundingBox();
  await phone.hold({ x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 });
  await expect(p.locator('#peekCard')).toBeVisible();
  await p.keyboard.press('Escape');
  await expect(p.locator('#peekBack')).toBeHidden();
  await phone.done();
});

test('☰: Reset, Pin as A, Help without tutorials, Full app and back (kept)', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  await sample(p);
  const menu = async (id) => { await phone.tapOn(p.locator('#btnPhoneMenu')); await expect(p.locator('#phoneMenu')).toBeVisible(); await phone.tapOn(p.locator('#' + id)); await expect(p.locator('#phoneMenu')).toBeHidden(); };
  await phone.tapOn(card(p, 0).locator('.ps-plus'));
  await menu('phonePin');
  await expect(p.locator('#compareBar')).toBeVisible();
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await expect(p.locator('#phonePin')).toHaveText('📌 Unpin A');
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await menu('phoneReset');
  expect(await price(p)).toBeNull();
  await expect(card(p, 0).locator('.ps-value')).toHaveText('10');
  // A tap outside closes the menu.
  await phone.tapOn(p.locator('#btnPhoneMenu'));
  await phone.tap({ x: 100, y: 500 });
  await expect(p.locator('#phoneMenu')).toBeHidden();
  await menu('phoneHelp');
  await expect(p.locator('#helpPanel')).toBeVisible();
  await expect(p.locator('#helpPanel .help-tutorial')).toHaveCount(0);
  await p.keyboard.press('F1');
  // Full app: the whole page, on a phone too; kept after a reload.
  await menu('phoneFullApp');
  await expect(p.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await expect(p.locator('body')).toHaveClass(/phone-screen/);
  await expect(p.locator('.slider-widget')).toHaveCount(2);
  await expect(p.locator('#sliderDock')).toBeHidden();
  await expect(p.locator('#btnPhoneLayout')).toBeVisible();
  await p.reload();
  await p.waitForFunction(() => !!window.fmGraph);
  await expect(p.locator('#btnPhoneLayout')).toBeVisible();
  await expect(p.locator('body')).not.toHaveClass(/(^| )phone( |$)/);
  await phone.tapOn(p.locator('#btnPhoneLayout'));
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await p.reload();
  await p.waitForFunction(() => !!window.fmGraph);
  await expect(p.locator('body')).toHaveClass(/(^| )phone( |$)/);
  await sample(p);
  await phone.done();
});

test('a model\'s hostile names stay text on a phone', async ({ browser }) => {
  const phone = await openPhone(browser);
  const p = phone.page;
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: [evil, 'P2'], canvases: [{ id: 'c1', name: evil, nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: evil + '\n5' }, { id: 'o', type: 'operator', x: 100, y: 0, text: '+' }, { id: 'b', type: 'value', x: 200, y: 0, text: '<b>Out</b>' },
  ], edges: [{ id: 'e1', from: 'a', to: 'o' }, { id: 'e2', from: 'o', to: 'b' }] }] };
  await p.evaluate((m) => fmGraph.load(m, '<i>Model</i>'), model);
  await expect(p.locator('#board')).toBeVisible();
  await p.evaluate(() => { fmGraph.addSlider('#a'); fmGraph.addBar('#b'); });
  await expect(card(p, 0).locator('.dock-name')).toHaveText(evil);
  await expect(p.locator('.bar-widget .widget-title').first()).toHaveText('<b>Out</b>');
  await expect(p.locator('#modelName')).toHaveText('<i>Model</i>');
  const b = await p.locator('.bar-widget .bar-chart-host').first().boundingBox();
  await phone.hold({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await expect(p.locator('#peekTitle')).toHaveText('<b>Out</b>');
  await expect(p.locator('#peekWhere')).toHaveText(evil);
  await expect(p.locator('#peekTable tbody tr').first()).toContainText(evil);
  expect(await p.locator('img, #board b, .gbar i').count()).toBe(0);
  expect(await p.evaluate(() => window.__pwned)).toBeUndefined();
  await phone.done();
});
