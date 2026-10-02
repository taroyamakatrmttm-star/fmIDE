// 51. fmGraph's exploring (step 15, phase G4a; docs/step15-fmgraph.md): Trace and Biggest movers.
// - Trace: 🔍 on a bar or chart lights the sliders that reach it and says, in words, the way
//   each one gets there, and which inputs reach it with no slider (+ Slider); 🔍 again, × and
//   Esc clear it; a slider being moved shows its own reach meanwhile; nothing is an undo step.
// - Biggest movers: against the model's own numbers, largest change in % first, inputs left
//   out, a value that can't be worked out any more first; + Bar; only while the panel is open.
// - Hostile names as text; a finger; window.fmGraph.trace and movers.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp } = require('./helpers/apps');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
// The sample's board: charts Balance sheet and Profit, bars Profit and Closing cash; sliders Price, Volume.
const widget = (page, i) => page.locator('#barList > .widget').nth(i);
const note = (page) => page.locator('.trace-note');
const sliderIds = (page) => g(page, () => fmGraph.board().sliders.map(s => s.id));

test('Trace: 🔍 on a bar lights the sliders that reach it and says the way there', async ({ page, pageErrors }) => {
  await openSample(page);
  const profit = widget(page, 2);
  await profit.locator('.widget-trace').click();
  await expect(profit.locator('.widget-trace')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board')).toHaveClass(/tracing/);
  await expect(note(page)).toHaveCount(1);
  await expect(profit.locator('.trace-note .trace-paths li')).toHaveText(['Price → Revenue → Gross profit → Profit', 'Volume → Revenue → Gross profit → Profit']);
  await expect(profit.locator('.trace-inputs li')).toHaveText([/^Unit cost\s*Profit\s*\+ Slider$/, /^Overheads\s*Profit\s*\+ Slider$/]);
  await expect(page.locator('.slider-widget.traced')).toHaveCount(2);
  await expect(profit).toHaveClass(/traced/);
  // Tracing is not a change: nothing to undo.
  await expect(page.locator('#btnUndo')).toBeDisabled();
  // 🔍 again clears it.
  await profit.locator('.widget-trace').click();
  await expect(note(page)).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/tracing/);
  await expect(page.locator('.slider-widget.traced')).toHaveCount(0);
  // × and Esc clear it too.
  await profit.locator('.widget-trace').click();
  await note(page).locator('.trace-close').click();
  await expect(note(page)).toHaveCount(0);
  await profit.locator('.widget-trace').click();
  await page.keyboard.press('Escape');
  await expect(note(page)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Trace: + Slider adds one on an input that reaches it; a chart; a slider on another input fades', async ({ page }) => {
  await openSample(page);
  // The balance sheet: everything feeding it.
  const sheet = widget(page, 0);
  await sheet.locator('.widget-trace').click();
  await expect(sheet.locator('.trace-inputs li span:first-child')).toHaveText(['Unit cost', 'Overheads', 'Equipment', 'Debt']);
  await sheet.locator('.trace-inputs li', { hasText: 'Equipment' }).locator('button').click();
  await expect(page.locator('.slider-widget')).toHaveCount(3);
  // Still traced, and Equipment is now a slider that reaches it.
  await expect(sheet.locator('.trace-paths li')).toHaveCount(3);
  await expect(sheet.locator('.trace-paths li').nth(2)).toHaveText(/^Equipment/);
  await expect(sheet.locator('.trace-inputs li span:first-child')).toHaveText(['Unit cost', 'Overheads', 'Debt']);
  await expect(page.locator('.slider-widget.traced')).toHaveCount(3);
  // The waterfall of Profit: Equipment doesn't reach it, so its slider fades.
  const flow = widget(page, 1);
  await flow.locator('.widget-trace').click();
  await expect(note(page)).toHaveCount(1); // one trace at a time
  await expect(sheet.locator('.widget-trace')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.slider-widget.traced')).toHaveCount(2);
  const equipment = page.locator('.slider-widget').nth(2);
  await expect(equipment).not.toHaveClass(/traced/);
  await expect.poll(() => equipment.evaluate(el => getComputedStyle(el).opacity)).toBe('0.45'); // (it fades)
  // Adding the slider was a change (undo takes it back); the trace wasn't.
  await page.click('#btnUndo');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  await expect(page.locator('#btnUndo')).toBeDisabled();
});

test('Trace: a slider being moved shows its own reach meanwhile; the trace comes back', async ({ page }) => {
  await openSample(page);
  const closing = widget(page, 3);
  await closing.locator('.widget-trace').click();
  const price = page.locator('.slider-widget').first().locator('input[type=range]');
  await price.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#board')).toHaveClass(/moving/);
  await expect(page.locator('#board')).not.toHaveClass(/tracing/);
  await price.blur();
  await expect(page.locator('#board')).toHaveClass(/tracing/);
  await expect(page.locator('.slider-widget.traced')).toHaveCount(2);
  // Another board, or the traced widget removed: the trace goes.
  await page.locator('#boardTabs .board-tool', { hasText: '+ Board' }).click();
  await expect(note(page)).toHaveCount(0);
  await page.locator('#boardTabs .board-tab').first().click();
  await expect(note(page)).toHaveCount(0);
  await widget(page, 3).locator('.widget-trace').click();
  await widget(page, 3).locator('.widget-remove').click();
  await expect(note(page)).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/tracing/);
});

test('Trace: a bar of an input, and a board without sliders', async ({ page }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addBar('Price'));
  expect(await g(page, (i) => fmGraph.trace(i), id)).toEqual({ sliders: [{ id: (await sliderIds(page))[0], path: ['Price'] }], inputs: [] });
  await page.locator('#boardTabs .board-tool', { hasText: '+ Board' }).click();
  const bar = await g(page, () => fmGraph.addBar('Profit'));
  await page.locator('#barList > .widget').first().locator('.widget-trace').click();
  await expect(note(page).locator('.trace-none')).toHaveText('There are no sliders on this board yet.');
  await expect(note(page).locator('.trace-inputs li')).toHaveCount(4);
  expect(await g(page, () => fmGraph.traced())).toBe(bar);
});

test('Biggest movers: against the model\'s own numbers, largest change first, + Bar', async ({ page, pageErrors }) => {
  await openSample(page);
  const panel = page.locator('#moversPanel');
  await expect(panel).toHaveAttribute('open', '');
  await expect(page.locator('#moversEmpty')).toBeVisible();
  await expect(page.locator('#moversList li')).toHaveCount(0);
  const [price] = await sliderIds(page);
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  await expect(page.locator('#moversEmpty')).toBeHidden();
  const rows = page.locator('#moversList li');
  await expect(rows).toHaveCount(7);
  await expect(rows.first().locator('.mover-name')).toHaveText('Profit');
  await expect(rows.first().locator('.mover-where')).toHaveText('Profit · Year 1');
  await expect(rows.first().locator('.mover-change')).toHaveText('1,500 → 4,500 (+3,000 (+200%))');
  await expect(rows.first().locator('.mover-change')).toHaveClass(/up/);
  // Inputs (what the sliders set) are not listed.
  await expect(page.locator('#moversList .mover-name', { hasText: /^Price$/ })).toHaveCount(0);
  // Profit has a bar: "On the board". + Bar puts Revenue on it.
  await expect(rows.first().locator('button')).toHaveText('On the board');
  await expect(rows.first().locator('button')).toBeDisabled();
  const revenue = page.locator('#moversList li', { has: page.locator('.mover-name', { hasText: /^Revenue$/ }) });
  await revenue.locator('button').click();
  await expect(page.locator('.bar-widget')).toHaveCount(3);
  await expect(revenue.locator('button')).toHaveText('On the board');
  expect(await g(page, () => fmGraph.board().bars.map(b => b.name))).toEqual(['Profit', 'Closing cash', 'Revenue']);
  expect((await g(page, () => fmGraph.movers(2)))).toEqual([
    { name: 'Profit', canvas: 'Profit', period: 'Year 1', was: 1500, now: 4500 },
    { name: 'Opening equity', canvas: 'Balance sheet', period: 'Year 4', was: 6400, now: 16300 },
  ]);
  // Back to the model's own numbers: nothing moved.
  await page.click('#btnResetAll');
  await expect(page.locator('#moversList li')).toHaveCount(0);
  await expect(page.locator('#moversEmpty')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Biggest movers: a value that can\'t be worked out any more comes first; closed, it waits', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const model = { kind: 'system', version: 9, periods: ['P1', 'P2'], canvases: [{ id: 'c', name: 'C', nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: 'Ten\n10' }, { id: 'z', type: 'value', x: 0, y: 100, text: 'Split\n2' },
    { id: 'd', type: 'operator', x: 100, y: 50, text: '÷' }, { id: 'q', type: 'value', x: 200, y: 50, text: 'Share' },
    { id: 'm', type: 'operator', x: 100, y: 150, text: '×' }, { id: 'r', type: 'value', x: 200, y: 150, text: 'Double' },
  ], edges: [{ id: 'e1', from: 'a', to: 'd' }, { id: 'e2', from: 'z', to: 'd' }, { id: 'e3', from: 'd', to: 'q' },
    { id: 'e4', from: 'a', to: 'm' }, { id: 'e5', from: 'z', to: 'm' }, { id: 'e6', from: 'm', to: 'r' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Shares'), model);
  // Close the panel first: moving a slider then works nothing out for it.
  await page.locator('#moversPanel > summary').click();
  await expect(page.locator('#moversPanel')).not.toHaveAttribute('open', '');
  const s = await g(page, () => fmGraph.addSlider('Split', { min: 0, max: 4, step: 1 }));
  await g(page, (i) => fmGraph.setSlider(i, 0), s);
  await expect(page.locator('#moversList li')).toHaveCount(0);
  // Opened: worked out then.
  await page.locator('#moversPanel > summary').click();
  const rows = page.locator('#moversList li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.mover-name')).toHaveText('Share');
  await expect(rows.first().locator('.mover-change')).toHaveText(/^was 5, now: .+/);
  await expect(rows.first().locator('.mover-change')).toHaveClass(/err/);
  await expect(rows.nth(1).locator('.mover-change')).toHaveText('20 → 0 (−20 (−100%))');
  expect((await g(page, () => fmGraph.movers()))[0]).toEqual({ name: 'Share', canvas: 'C', period: 'P1', was: 5, now: { error: expect.any(String) } });
});

test('hostile names stay text in the trace and the movers', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: '<b>Canvas</b>', nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: evil + '\n2' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Three\n3' },
    { id: 'm', type: 'operator', x: 100, y: 50, text: '×' }, { id: 'r', type: 'value', x: 200, y: 50, text: '<script>x()</script>' },
  ], edges: [{ id: 'e1', from: 'a', to: 'm' }, { id: 'e2', from: 'b', to: 'm' }, { id: 'e3', from: 'm', to: 'r' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Hostile'), model);
  const bar = await g(page, () => fmGraph.addBar('<script>x()</script>'));
  // The starting board already has a slider on the first input that reaches something.
  const [s] = await sliderIds(page);
  expect(await g(page, () => fmGraph.board().sliders.map(x => x.name))).toEqual([evil]);
  await g(page, (i) => fmGraph.setSlider(i, 4), s);
  await g(page, (i) => fmGraph.trace(i), bar);
  await expect(note(page).locator('.trace-paths li')).toHaveText(evil + ' → <script>x()</script>');
  await expect(note(page).locator('.trace-inputs li span:first-child')).toHaveText(['Three']);
  await expect(page.locator('#moversList .mover-name')).toHaveText(['<script>x()</script>']);
  await expect(page.locator('#moversList .mover-where')).toHaveText('<b>Canvas</b> · P1');
  expect(await page.locator('#board img, #board script, #board b').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('by finger: a tap on 🔍 traces, and + Bar in the movers works', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 1400 } });
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url() === 'http://local.test/fmGraph.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(__dirname, '..', 'apps', 'fmGraph.html')) })
    : route.abort());
  try{
    await page.goto('http://local.test/fmGraph.html');
    await page.click('#btnSample');
    await expect(page.locator('.chart-widget')).toHaveCount(2);
    const types = await watchPointerTypes(page);
    const f = await finger(page);
    const lens = widget(page, 3).locator('.widget-trace');
    await lens.scrollIntoViewIfNeeded();
    await f.tap(centre(await lens.boundingBox()));
    await expect(note(page)).toHaveCount(1);
    await g(page, (i) => fmGraph.setSlider(i, 12), (await sliderIds(page))[1]);
    const add = page.locator('#moversList li', { has: page.locator('.mover-name', { hasText: /^Revenue$/ }) }).locator('button');
    await add.scrollIntoViewIfNeeded();
    await f.tap(centre(await add.boundingBox()));
    await expect(page.locator('.bar-widget')).toHaveCount(3);
    expect(await types()).toEqual(['touch']);
  } finally {
    await context.close();
  }
});
