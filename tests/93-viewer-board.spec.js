// 93. fmShowcase, the showcase viewer: the Board (phase V2 of docs/viewer-brief.md).
// The sample tests/fixtures/viewer/every-widget.fmide (every kind of bar, chart and slider
// fmGraph has, two scenarios, two boards) and its showcase every-widget.showcase.json.
// - Offline, the Board first: every widget drawn by fmGraph's board engine, the same figures as
//   fmGraph's for the same sliders.
// - Sliders stay in the author's range (dragging, keys, a typed number); scenarios shown exactly
//   (inputs with no slider too), left by a slider; Play, Esc, reduced motion; Reset; A/B; Trace;
//   Biggest movers.
// - The Logic view follows the Board; the state kept on the device, a tampered one ignored.
// - No editing control; the phone's layout; Help; Try the sample; the periods; hostile names.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, fixture, readFixture, openApp } = require('./helpers/apps');

const MODEL = fixture('viewer', 'every-widget.fmide');
const SHOWCASE = fixture('viewer', 'every-widget.showcase.json');
const V = (page, fn, arg) => page.evaluate(fn, arg);

async function openViewer(page){
  await openApp(page, 'fmViewer');
  await page.waitForFunction(() => !!window.fmViewer);
}
// Opens files and waits until they are shown (the next model shown, not the one already open).
async function openFiles(page, files){
  const before = await page.evaluate(() => fmViewer.state().loads);
  await page.setInputFiles('#fileInput', files);
  await page.waitForFunction((n) => fmViewer.state().loads > n, before);
}
async function openBoard(page){
  await openViewer(page);
  await openFiles(page, [MODEL, SHOWCASE]);
  await expect(page.locator('#boardView')).toBeVisible();
}
// The bare app with its data blocks filled in, as a made viewer is (every < as <).
function madeViewer(showcase, model){
  const block = (id, data) => '<script type="application/json" id="' + id + '">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
  return fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8')
    .replace('<script type="application/json" id="showcase"></script>', () => block('showcase', showcase))
    .replace('<script type="application/json" id="model"></script>', () => block('model', model));
}
// A context serving one page at http://local.test/viewer.html, nothing else.
async function serve(browser, html, options){
  const context = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 900 } }, options || {}));
  const outside = [];
  await context.route('**/*', route => route.request().url() === 'http://local.test/viewer.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
    : (outside.push(route.request().url()), route.abort()));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://local.test/viewer.html');
  await page.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  return { context, page, outside, errors };
}
async function openGraph(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  expect(await page.evaluate((t) => fmGraph.load(t, 'Every widget'), fs.readFileSync(MODEL, 'utf8'))).toBe(true);
}

test('the Board opens first, every bar and chart drawn by fmGraph\'s engine, nothing requested', async ({ page, pageErrors }) => {
  await openBoard(page);
  expect(await V(page, () => fmViewer.state())).toMatchObject({ title: 'Every widget', view: 'board', hasBoard: true });
  await expect(page.locator('#logic')).toBeHidden();
  await expect(page.locator('#boardTabs .board-tab')).toHaveText(['Everything', 'Own sliders']);
  await expect(page.locator('#barList > .bar-widget')).toHaveCount(3);
  await expect(page.locator('#barList > .chart-widget')).toHaveCount(7);
  expect(await page.locator('#barList > .chart-widget').evaluateAll(els => els.map(e => e.dataset.layout))).toEqual(['columns', 'flow', 'lines', 'free', 'tornado', 'spider', 'scenarios']);
  for(const el of await page.locator('#barList > .widget').all()) await expect(el.locator('svg.bar-chart').first()).toBeVisible();
  await expect(page.locator('#barList > .bar-widget .widget-title')).toHaveText(['Profit', 'Closing cash', 'Broken']);
  await expect(page.locator('#barList > .bar-widget').nth(2).locator('.bar-errors li')).toContainText('something it reads could not be worked out');
  await expect(page.locator('.slider-widget .slider-name')).toHaveText(['Price', 'Volume', 'Unit cost', 'Overheads']);
  await expect(page.locator('#scenarioRow .scenario-btn')).toHaveText(['Base', 'High price', 'Big year']);
  await expect(page.locator('#scenarioRow .scenario-btn.current')).toHaveText('Base');
  // The showcase's Play ends.
  expect(await page.locator('#playFrom').inputValue()).toBe('model');
  expect(await page.locator('#playTo').inputValue()).toBe('sc:High price');
  await expect(page.locator('#playFrom option')).toHaveText(['Base', 'My sliders', 'High price', 'Big year']);
  // The key's swatches are marks, not colour boxes.
  expect(await page.locator('.chart-key .key-swatch').count()).toBeGreaterThan(5);
  expect(await page.locator('input[type=color]').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('the same numbers as fmGraph\'s for the same sliders, in every chart', async ({ page, browser }) => {
  await openBoard(page);
  const graph = await page.context().newPage();
  await openGraph(graph);
  const set = { Price: 12, Volume: 10, 'Unit cost': 7, Overheads: 3200 };
  for(const [name, v] of Object.entries(set)){
    await V(page, ([n, x]) => fmViewer.setSlider(n, x), [name, v]);
    await graph.evaluate(([n, x]) => fmGraph.setSlider(fmGraph.board().sliders.find(s => s.name === n).id, x), [name, v]);
  }
  const ours = await V(page, () => fmViewer.board().items.filter(w => w.kind === 'chart').map(w => fmViewer.chart(w.id)));
  const theirs = await graph.evaluate(() => fmGraph.board().items.filter(w => w.type === 'chart').map(w => fmGraph.chart(w.id)));
  expect(ours.length).toBe(7);
  expect(ours).toEqual(theirs);
  // A bar's numbers, and the model's values behind them.
  const bar = await V(page, () => fmViewer.bar(fmViewer.board().items[0].id));
  for(let p = 0; p < 4; p++) expect(bar[p].value).toBeCloseTo(await graph.evaluate((i) => fmGraph.value('Profit', i + 1), p), 9);
  await graph.close();
});

test('a slider stays in the author\'s range: dragging, the keys, − and +, a typed number, a double tap', async ({ page }) => {
  await openBoard(page);
  const price = page.locator('.slider-widget').first();
  // Typed past the end: kept at the end of the range.
  await price.locator('.ps-value').click();
  await price.locator('input.ps-type').fill('99');
  await price.locator('input.ps-type').press('Enter');
  await expect.poll(() => V(page, () => fmViewer.board().sliders[0].value)).toBe(15);
  await expect(price.locator('.ps-value')).toHaveText('15');
  // Between steps: on the nearest step (0.25).
  await price.locator('.ps-value').click();
  await price.locator('input.ps-type').fill('7.1');
  await price.locator('input.ps-type').press('Enter');
  await expect.poll(() => V(page, () => fmViewer.board().sliders[0].value)).toBe(7);
  // The keys, and − / +.
  await price.locator('.ps-track').focus();
  await page.keyboard.press('Home');
  expect(await V(page, () => fmViewer.board().sliders[0].value)).toBe(5);
  await price.locator('.ps-minus').click();
  expect(await V(page, () => fmViewer.board().sliders[0].value)).toBe(5);
  await price.locator('.ps-plus').click();
  expect(await V(page, () => fmViewer.board().sliders[0].value)).toBe(5.25);
  // A drag far past the end.
  const track = await price.locator('.ps-track').boundingBox();
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 3, track.y + track.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await V(page, () => fmViewer.board().sliders[0].value)).toBe(15);
  // A double tap (click) on the track: back on the model's own number.
  await price.locator('.ps-track').dblclick();
  expect(await V(page, () => fmViewer.board().sliders[0].value)).toBeNull();
  // The API keeps to the range too.
  expect(await V(page, () => fmViewer.setSlider('Volume', -400))).toBe(-50);
  expect(await V(page, () => fmViewer.setSlider('Volume', 3.4))).toBe(3);
});

test('scenarios: shown exactly, inputs with no slider too; a slider leaves one; Base', async ({ page, browser }) => {
  await openBoard(page);
  await page.locator('#scenarioRow .scenario-btn', { hasText: 'Big year' }).click();
  await expect(page.locator('#scenarioRow .scenario-btn.current')).toHaveText('Big year');
  let b = await V(page, () => fmViewer.board());
  expect(b.sliders.map(s => s.value)).toEqual([13, 20, null, null]);
  // On the second board, which has no slider for Price or Volume, the numbers are still Big year's.
  const graph = await page.context().newPage();
  await openGraph(graph);
  await graph.evaluate(() => fmGraph.showScenario('Big year'));
  const equity = await graph.evaluate(() => [1, 2, 3, 4].map(p => fmGraph.value('Equity', p)));
  await page.locator('#boardTabs .board-tab', { hasText: 'Own sliders' }).click();
  expect((await V(page, () => fmViewer.bar(fmViewer.board().items[0].id))).map(x => x.value)).toEqual(equity);
  await expect(page.locator('#scenarioRow .scenario-btn.current')).toHaveText('Big year');
  // Moving a slider leaves it, and says what it changed with no slider here.
  await V(page, () => fmViewer.setSlider('Overheads', 3000));
  await expect(page.locator('#scenarioRow .scenario-btn.current')).toHaveCount(0);
  await expect(page.locator('#scenarioNote')).toContainText('Leaving “Big year”: its change to Price, Volume has no slider here');
  expect((await V(page, () => fmViewer.board())).shownScenario).toBeNull();
  // Base: every slider back.
  await page.locator('#scenarioRow .scenario-btn', { hasText: 'Base' }).click();
  b = await V(page, () => fmViewer.board());
  expect(b.sliders.map(s => s.value)).toEqual([null]);
  await expect(page.locator('#scenarioRow .scenario-btn.current')).toHaveText('Base');
  await graph.close();
});

test('Play, ■ Stop and Esc; Reset; Pin as A, Swap, Unpin; Trace; Biggest movers', async ({ page }) => {
  await openBoard(page);
  await page.locator('#btnPlay').click();
  await expect(page.locator('#playBar')).toContainText('Playing Base ⇄ High price');
  expect((await V(page, () => fmViewer.board())).playing).toMatchObject({ from: 'Base', to: 'High price', still: false });
  await expect.poll(() => V(page, () => document.querySelector('.slider-widget').classList.contains('playing'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#playBar')).toBeHidden();
  expect((await V(page, () => fmViewer.board())).playing).toBeNull();
  await V(page, () => fmViewer.play('Big year', 'My sliders'));
  await page.locator('#btnPlayStop').click();
  expect((await V(page, () => fmViewer.board())).playing).toBeNull();
  // A, compare, swap.
  await V(page, () => fmViewer.setSlider('Price', 12));
  await page.locator('#btnPinA').click();
  await expect(page.locator('#compareBar')).toContainText('Comparing with A: Price 12');
  await V(page, () => fmViewer.setSlider('Price', 14));
  await expect(page.locator('#barList > .bar-widget').first().locator('.b-base').first()).toBeAttached();
  await page.locator('#compareBar .compare-btn', { hasText: 'Swap' }).click();
  expect((await V(page, () => fmViewer.board())).sliders[0].value).toBe(12);
  await expect(page.locator('#compareBar')).toContainText('Price 14');
  await page.locator('#compareBar .compare-btn', { hasText: 'Unpin' }).click();
  await expect(page.locator('#compareBar')).toBeHidden();
  // Trace: the sliders that reach Profit are lit; the note, with no + Slider.
  await page.locator('#barList > .bar-widget').first().locator('.widget-trace').click();
  await expect(page.locator('.trace-note')).toContainText('Price → Revenue → Gross profit → Profit');
  await expect(page.locator('.slider-widget.traced')).toHaveCount(4);
  expect(await page.locator('.trace-note button').evaluateAll(bs => bs.map(b => b.textContent))).toEqual(['×']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.trace-note')).toHaveCount(0);
  // Biggest movers, folded away until opened.
  await expect(page.locator('#moversList')).toBeHidden();
  await page.locator('#moversPanel summary').click();
  await expect(page.locator('#moversList .mover').first()).toBeVisible();
  expect(await page.locator('#moversList button').count()).toBe(0);
  // Reset.
  await page.locator('#btnReset').click();
  expect((await V(page, () => fmViewer.board())).sliders.every(s => s.value === null)).toBe(true);
});

test('reduced motion: Play shows one end against the other, and ⇄ steps', async ({ browser }) => {
  const { context, page, errors } = await serve(browser, madeViewer(readFixture('viewer', 'every-widget.showcase.json'), readFixture('viewer', 'every-widget.fmide')), { reducedMotion: 'reduce' });
  await page.locator('#btnPlay').click();
  await expect(page.locator('#playBar')).toContainText('Showing High price; the outlines show Base');
  await page.locator('#btnPlayStep').click();
  await expect(page.locator('#playBar')).toContainText('Showing Base');
  expect((await V(page, () => fmViewer.board())).playing.still).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('the Logic view follows the Board: the numbers, a ring on what moved, the card', async ({ page, browser }) => {
  await openBoard(page);
  await V(page, () => fmViewer.setSlider('Price', 12));
  await page.locator('#tabLogic').click();
  await expect(page.locator('#logic')).toBeVisible();
  await expect(page.locator('#world .cv-node[data-id="price"] text.value')).toHaveText('12');
  await expect(page.locator('#world .cv-node[data-id="price"]')).toHaveClass(/moved/);
  await expect(page.locator('#world .cv-node.moved')).toHaveCount(1);
  const graph = await page.context().newPage();
  await openGraph(graph);
  await graph.evaluate(() => fmGraph.setSlider(fmGraph.board().sliders[0].id, 12));
  for(let p = 0; p < 4; p++){
    expect(await V(page, (i) => fmViewer.value('cProfit', 'rev', i), p)).toBeCloseTo(await graph.evaluate((i) => fmGraph.value('Revenue', i + 1), p), 9);
    expect(await V(page, (i) => fmViewer.value('cProfit', 'price', i), p)).toBe(12);
  }
  await V(page, () => fmViewer.openCard('cProfit', 'price'));
  await expect(page.locator('#card')).toContainText('Moved on the Board, from 10 (the model\'s number).');
  await V(page, () => fmViewer.openCard('cProfit', 'rev'));
  await expect(page.locator('#card .card-formula.with-values')).toContainText('12 × 1000');
  // Back on the Board, the card is closed; the scenario's inputs are moved on the Logic view too.
  await page.locator('#tabBoard').click();
  await page.locator('#scenarioRow .scenario-btn', { hasText: 'Big year' }).click();
  await page.locator('#tabLogic').click();
  await expect(page.locator('#world .cv-node.moved')).toHaveCount(2);
  expect(await V(page, () => fmViewer.modelText() === fmViewer.modelTextAtLoad())).toBe(true);
  await graph.close();
});

test('what a visitor moved is kept on this device, Reset forgets it, a tampered state is ignored', async ({ browser }) => {
  const html = madeViewer(readFixture('viewer', 'every-widget.showcase.json'), readFixture('viewer', 'every-widget.fmide'));
  const { context, page, outside, errors } = await serve(browser, html);
  await V(page, () => { fmViewer.setSlider('Price', 12.5); fmViewer.showBoard(1); fmViewer.setSlider('Overheads', 2000); fmViewer.saveNow(); });
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  await expect.poll(() => V(page, () => fmViewer.board().shown)).toBe(1);
  expect((await V(page, () => fmViewer.board())).sliders[0].value).toBe(2000);
  await V(page, () => fmViewer.showBoard(0));
  expect((await V(page, () => fmViewer.board())).sliders[0].value).toBe(12.5);
  // A scenario shown comes back as shown.
  await V(page, () => { fmViewer.showScenario('High price'); fmViewer.saveNow(); });
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  await expect.poll(() => V(page, () => fmViewer.board().shownScenario)).toBe('High price');
  // Reset forgets it.
  await page.locator('#btnReset').click();
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  expect((await V(page, () => fmViewer.board())).sliders.map(s => s.value)).toEqual([null, null, null, null]);
  // Something else written under its key: out of range, unknown, markup — none of it taken.
  const key = await V(page, () => fmViewer.stateKey());
  await V(page, async ([k]) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('fmShowcase', 1); r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(JSON.stringify({ v: 1, board: 7, scenario: '<img src=x onerror=alert(1)>', sliders: [[1e9, '13', null, -1e9]] }), k); tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  }, [key]);
  await page.reload();
  await page.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  const b = await V(page, () => fmViewer.board());
  expect(b.shown).toBe(0);
  expect(b.shownScenario).toBeNull();
  expect(b.sliders.map(s => s.value)).toEqual([null, null, null, null]);
  expect(await page.locator('img').count()).toBe(0);
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
  // Without storage at all, everything else works.
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); Object.defineProperty(window, 'localStorage', { get(){ throw new Error('no storage'); } }); });
  await ctx.route('**/*', route => route.request().url() === 'http://local.test/viewer.html' ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }) : route.abort());
  const p2 = await ctx.newPage();
  const e2 = [];
  p2.on('pageerror', e => e2.push(e.message));
  await p2.goto('http://local.test/viewer.html');
  await p2.waitForFunction(() => !!window.fmViewer && fmViewer.state().loaded);
  expect(await V(p2, () => fmViewer.setSlider('Price', 11))).toBe(11);
  await p2.locator('#btnReset').click();
  expect(e2).toEqual([]);
  await ctx.close();
});

test('no editing control: nothing to add, remove, colour, arrange or rename, and the model unchanged', async ({ page }) => {
  await openBoard(page);
  for(const sel of ['input[type=color]', '.drag-handle', '.widget-remove', '.chart-edit', '.size-toggle', '.slider-range', '.scenario-name', '.board-tab-name', '#btnSaveScenario', '#btnAddBar', '#btnUndo', '[contenteditable]', 'textarea'])
    expect(await page.locator(sel).count(), sel).toBe(0);
  expect(await page.locator('select').evaluateAll(els => els.map(e => e.id))).toEqual(['playFrom', 'playTo']);
  expect(await page.locator('input').evaluateAll(els => els.map(e => e.id))).toEqual(['fileInput']);
  await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
  await V(page, () => { fmViewer.setSlider('Price', 13); fmViewer.showScenario('Big year'); fmViewer.reset(); });
  expect(await V(page, () => fmViewer.modelText() === fmViewer.modelTextAtLoad())).toBe(true);
});

test('on a phone: Board and Logic at the bottom, the sliders in a row above them', async ({ browser }) => {
  const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const { context, page, errors } = await serve(browser, madeViewer(readFixture('viewer', 'every-widget.showcase.json'), readFixture('viewer', 'every-widget.fmide')), PHONE);
  expect(await page.evaluate(() => document.body.classList.contains('phone'))).toBe(true);
  await expect(page.locator('#phoneViews')).toBeVisible();
  await expect(page.locator('#viewSwitch')).toBeHidden();
  const tabs = await page.locator('#phoneViews').boundingBox();
  expect(Math.round(tabs.y + tabs.height)).toBe(844);
  const dock = await page.locator('#sliderList').boundingBox();
  expect(dock.y + dock.height).toBeLessThanOrEqual(tabs.y + 1);
  for(const sel of ['#phoneTabBoard', '#phoneTabLogic', '#btnReset', '#btnPinA', '#scenarioRow .scenario-btn']){
    expect((await page.locator(sel).first().boundingBox()).height, sel).toBeGreaterThanOrEqual(40);
  }
  await page.locator('#phoneTabLogic').tap();
  await expect(page.locator('#logic')).toBeVisible();
  await expect(page.locator('#sliderList')).toBeHidden();
  const box = await page.locator('#world .cv-node[data-id="profit"] .box').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#card')).toBeVisible();
  const c = await page.locator('#card').boundingBox();
  expect(c.y + c.height).toBeLessThanOrEqual(tabs.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  await context.close();
});

test('Help: ? and F1 open the viewer\'s topics, asking nothing of the network', async ({ page }) => {
  await openBoard(page);
  await page.locator('#btnHelp').click();
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(page.locator('.help-panel')).toContainText('What this viewer is');
  await expect(page.locator('.help-panel')).toContainText('Scenarios and Play');
  expect(await page.locator('.help-panel a.help-manual').count()).toBe(0);
  await page.keyboard.press('F1'); // F1 closes it and opens it again
  await expect(page.locator('.help-panel')).toBeHidden();
  await page.keyboard.press('F1');
  await expect(page.locator('.help-panel')).toBeVisible();
});

test('Try the sample: fmGraph\'s sample model and board, two scenarios, Play from Base', async ({ page, pageErrors }) => {
  await openViewer(page);
  await page.locator('#btnSample').click();
  await page.waitForFunction(() => fmViewer.state().loaded);
  expect(await V(page, () => fmViewer.state())).toMatchObject({ title: 'A small profit model', view: 'board' });
  await expect(page.locator('#barList > .bar-widget')).toHaveCount(2);
  await expect(page.locator('#barList > .chart-widget')).toHaveCount(2);
  await expect(page.locator('#scenarioRow .scenario-btn')).toHaveText(['Base', 'High price', 'Busy year']);
  expect(await page.locator('#playTo').inputValue()).toBe('sc:High price');
  await expect(page.locator('#mark')).toContainText('CC BY 4.0');
  expect(pageErrors).toEqual([]);
});

test('the periods: the showcase\'s are the boards\' shared ones, and the Logic view\'s first', async ({ page }) => {
  await openViewer(page);
  const sc = readFixture('viewer', 'every-widget.showcase.json');
  sc.periods = { mode: 'range', from: 1, to: 2 };
  const dir = test.info().outputPath('files');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'periods.json'), JSON.stringify(sc));
  await openFiles(page, [MODEL, path.join(dir, 'periods.json')]);
  expect((await V(page, () => fmViewer.state())).period).toBe(1);
  // Profit follows the shared periods (2 to 3); Closing cash keeps its own (2 to 4).
  await expect(page.locator('#barList > .bar-widget').nth(0).locator('.t-period')).toHaveText(['Year 2', 'Year 3']);
  await expect(page.locator('#barList > .bar-widget').nth(1).locator('.t-period')).toHaveText(['Year 2', 'Year 3', 'Year 4']);
  // Without: the boards' own shared period (the first year) for the Logic view.
  await openFiles(page, [MODEL, SHOWCASE]);
  expect((await V(page, () => fmViewer.state())).period).toBe(0);
  await page.locator('#tabLogic').click();
  await expect(page.locator('#periodNote')).toHaveText('Numbers for Year 1');
});

test('hostile names in the boards are shown as text; older board files open', async ({ page, pageErrors }) => {
  await openViewer(page);
  const sc = readFixture('viewer', 'every-widget.showcase.json');
  sc.boards.boards[0].name = '<img src=x onerror=alert(1)>';
  sc.boards.boards[0].items[3].title = '<script>window.__ran=1</script>';
  sc.boards.scenarios[0].name = '<b onclick=alert(1)>High</b>';
  sc.boards.boards[0].items[0].colour = 'red;background:url(x)';
  const dir = test.info().outputPath('files');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hostile.json'), JSON.stringify(sc));
  await openFiles(page, [MODEL, path.join(dir, 'hostile.json')]);
  await expect(page.locator('#boardTabs .board-tab').first()).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#barList > .chart-widget .widget-title').first()).toHaveText('<script>window.__ran=1</script>');
  await expect(page.locator('#scenarioRow .scenario-btn').nth(1)).toHaveText('<b onclick=alert(1)>High</b>');
  expect(await page.locator('img, b, #barList script').count()).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('*')].some(e => [...e.attributes].some(a => /^on/i.test(a.name))))).toBe(false);
  expect(await V(page, () => window.__ran)).toBeUndefined();
  // An fmGraph board file of version 7, with the model it was made for.
  const old = JSON.parse(fs.readFileSync(fixture('graph-boards', 'profit.board.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'old.json'), JSON.stringify({ kind: 'fmIDE-showcase', version: 1, id: 'old', title: 'Old boards', boards: old }));
  await openFiles(page, [fixture('graph-boards', 'profit.fmide'), path.join(dir, 'old.json')]);
  expect((await V(page, () => fmViewer.board())).boards).toEqual(['Profit board']); // its empty second board left out
  await expect(page.locator('#scenarioRow .scenario-btn')).toHaveText(['Base', 'High price', 'Volume up', 'Mixed', 'Also high', 'Cost cut']);
  expect(pageErrors).toEqual([]);
});
