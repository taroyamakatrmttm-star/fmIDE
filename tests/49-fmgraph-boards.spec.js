// 49. fmGraph's boards (step 15, phase G3a; docs/step15-fmgraph.md): several boards as tabs,
// arranging widgets in the grid (drag by mouse, finger or keyboard; wide or narrow), colours,
// undo and redo, and the board file (fmIDE-graph-board 1: export, import, dropped on the page).
const fs = require('fs');
const { test, expect, openApp } = require('./helpers/apps');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const order = (page) => g(page, () => fmGraph.board().items.map(i => i.title || i.name));
const tabs = (page) => page.locator('#boardTabs .board-tab');
// Sets a colour box as the browser's own picker would, then tells the page.
const pickColour = (loc, colour) => loc.evaluate((el, c) => { el.value = c; el.dispatchEvent(new Event('change', { bubbles: true })); }, colour);

test('boards as tabs: add, switch, rename, duplicate, delete (asked), kept after a reload', async ({ page, pageErrors }) => {
  await openSample(page);
  await expect(tabs(page)).toHaveText(['Board']);
  await expect(page.locator('#boardTabs .board-tool[aria-label="Delete this board"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Add an empty board' }).click();
  await expect(tabs(page)).toHaveText(['Board', 'Board (2)']);
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#barList > .widget')).toHaveCount(0);
  await expect(page.locator('#noBars')).toBeVisible();
  await page.click('#btnAddBar');
  // Rename by double-clicking the tab.
  await tabs(page).nth(1).dblclick();
  await page.locator('.board-tab-name').fill('Pricing');
  await page.locator('.board-tab-name').press('Enter');
  await expect(tabs(page)).toHaveText(['Board', 'Pricing']);
  // Switching shows each board's own widgets and sliders.
  await tabs(page).first().click();
  await expect(page.locator('#barList > .widget')).toHaveCount(4);
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  await tabs(page).nth(1).click();
  await expect(page.locator('#barList > .widget')).toHaveCount(1);
  // Duplicate, then delete the copy: asked first; Cancel keeps it.
  await page.getByRole('button', { name: 'Duplicate this board' }).click();
  await expect(tabs(page)).toHaveText(['Board', 'Pricing', 'Pricing copy']);
  await page.getByRole('button', { name: 'Delete this board' }).click();
  await expect(page.locator('#confirmTitle')).toHaveText('Delete this board?');
  await page.click('#confirmNo');
  await expect(tabs(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Delete this board' }).click();
  await page.click('#confirmYes');
  await expect(tabs(page)).toHaveText(['Board', 'Pricing']);
  // Kept after a reload, Pricing still shown.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(tabs(page)).toHaveText(['Board', 'Pricing']);
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  expect(pageErrors).toEqual([]);
});

test('arranging with the mouse and the keyboard: drag by the handle, ← →, wide and narrow; kept', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1800 });
  await openSample(page);
  expect(await order(page)).toEqual(['Balance sheet', 'Profit', 'Profit', 'Closing cash']);
  // Drag Closing cash (last) to the front.
  const handle = page.locator('#barList > .widget').nth(3).locator('.drag-handle');
  const from = await handle.boundingBox(), to = await page.locator('#barList > .widget').first().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 30, to.y + 30, { steps: 8 });
  await expect(page.locator('#barList > .widget.dragging')).toHaveCount(1);
  await page.mouse.up();
  expect(await order(page)).toEqual(['Closing cash', 'Balance sheet', 'Profit', 'Profit']);
  // The keyboard: → on its handle moves it one place later.
  await page.locator('#barList > .widget').first().locator('.drag-handle').focus();
  await page.keyboard.press('ArrowRight');
  expect(await order(page)).toEqual(['Balance sheet', 'Closing cash', 'Profit', 'Profit']);
  await expect(page.locator('#barList > .widget').nth(1).locator('.drag-handle')).toBeFocused();
  // Wide: the whole row; narrow: half of it.
  const bar = page.locator('#barList > .widget').nth(1);
  const narrowW = (await bar.boundingBox()).width;
  await bar.getByRole('button', { name: 'Wide' }).click();
  await expect(page.locator('#barList > .widget').nth(1)).toHaveClass(/wide/);
  await expect(page.locator('#barList > .widget').nth(1).getByRole('button', { name: 'Wide' })).toHaveAttribute('aria-pressed', 'true');
  expect((await page.locator('#barList > .widget').nth(1).boundingBox()).width).toBeGreaterThan(narrowW * 1.8);
  // Sliders move among the sliders.
  const s2 = page.locator('.slider-widget').nth(1).locator('.drag-handle');
  const s1 = await page.locator('.slider-widget').first().boundingBox(), sb = await s2.boundingBox();
  await page.mouse.move(sb.x + 5, sb.y + 5);
  await page.mouse.down();
  await page.mouse.move(s1.x + 40, s1.y + 10, { steps: 6 });
  await page.mouse.up();
  expect(await g(page, () => fmGraph.board().sliders.map(s => s.name))).toEqual(['Volume', 'Price']);
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  expect(await order(page)).toEqual(['Balance sheet', 'Closing cash', 'Profit', 'Profit']);
  expect(await g(page, () => fmGraph.board().items[1].wide)).toBe(true);
});

test('arranging by finger: the handle drags a widget', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 1400 } });
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url() === 'http://local.test/fmGraph.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(require('path').join(__dirname, '..', 'apps', 'fmGraph.html')) })
    : route.abort());
  await page.goto('http://local.test/fmGraph.html');
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  await page.evaluate(() => { window.__types = []; window.addEventListener('pointerdown', ev => window.__types.push(ev.pointerType), true); });
  const from = await page.locator('#barList > .widget').nth(3).locator('.drag-handle').boundingBox();
  const to = await page.locator('#barList > .widget').first().boundingBox();
  const cdp = await context.newCDPSession(page);
  const pt = (x, y) => [{ x, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x + from.width / 2, from.y + from.height / 2) });
  for(let i = 1; i <= 8; i++){
    const f = i / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + (to.x + 30 - from.x) * f, from.y + (to.y + 30 - from.y) * f) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => fmGraph.board().items.map(i => i.title || i.name))).toEqual(['Closing cash', 'Balance sheet', 'Profit', 'Profit']);
  expect(await page.evaluate(() => Array.from(new Set(window.__types)))).toEqual(['touch']);
  await context.close();
});

test('colours: a bar, a chart\'s rectangle, a waterfall step; in the file; a bad one ignored', async ({ page }) => {
  await openSample(page);
  const bar = page.locator('.bar-widget').first();
  await pickColour(bar.locator('input.colour-pick'), '#ff0000');
  await expect(bar.locator('.b-now').first()).toHaveAttribute('fill', '#ff0000');
  const bs = page.locator('.chart-widget').first();
  await pickColour(bs.locator('.chart-key input.key-swatch').first(), '#00ff00');
  await expect(bs.locator('.c-period').first().locator('.c-part').first()).toHaveAttribute('fill', '#00ff00');
  const flow = page.locator('.chart-widget').nth(1);
  await flow.locator('summary').click();
  await pickColour(flow.locator('.step-row').first().locator('input.colour-pick'), '#0000ff');
  await expect(flow.locator('.f-bar').first()).toHaveAttribute('fill', '#0000ff');
  const d = await g(page, () => fmGraph.board());
  expect(d.items[2].colour).toBe('#ff0000');
  expect(d.items[0].groups[0].parts[0].colour).toBe('#00ff00');
  expect(d.items[1].steps[0].colour).toBe('#0000ff');
  // Through the API; a colour that isn't #rrggbb is refused, and one from a file ignored.
  expect(await g(page, () => { try{ fmGraph.setColour(fmGraph.board().items[2].id, 'red'); return 'set'; }catch(e){ return e.message; } })).toMatch(/#rrggbb/);
  const n = await g(page, () => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 1, boards: [{ name: 'Odd', items: [
    { type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', colour: 'url(javascript:alert(1))' },
    { type: 'bar', canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', colour: '#12345' }] }] }));
  expect(n).toBe(1);
  expect((await g(page, () => fmGraph.board())).items.map(i => i.colour)).toEqual([undefined, undefined]);
  await expect(page.locator('.bar-widget .b-now[fill]')).toHaveCount(0);
});

test('undo and redo: every board change, by button and keyboard; a slider move is not one', async ({ page }) => {
  await openSample(page);
  await expect(page.locator('#btnUndo')).toBeDisabled();
  // Moving a slider changes nothing to undo.
  await g(page, () => fmGraph.setSlider(fmGraph.board().sliders[0].id, 12));
  await expect(page.locator('#btnUndo')).toBeDisabled();
  await page.click('#btnAddBar');
  await expect(page.locator('.bar-widget')).toHaveCount(3);
  await expect(page.locator('#btnUndo')).toBeEnabled();
  await page.click('#btnUndo');
  await expect(page.locator('.bar-widget')).toHaveCount(2);
  await page.click('#btnRedo');
  await expect(page.locator('.bar-widget')).toHaveCount(3);
  // The keyboard (not while typing in a text box).
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar-widget')).toHaveCount(2);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.bar-widget')).toHaveCount(3);
  // A chart's title, a removed chart, a deleted board: each one step.
  const title = page.locator('.chart-widget').first().locator('input.chart-title');
  await title.fill('Statement of position');
  await title.press('Tab');
  await page.locator('.chart-widget').nth(1).getByRole('button', { name: 'Remove this chart' }).click();
  await expect(page.locator('.chart-widget')).toHaveCount(1);
  await page.click('#btnUndo');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  await page.click('#btnUndo');
  await expect(page.locator('.chart-widget').first().locator('input.chart-title')).toHaveValue('Balance sheet');
  await g(page, () => { fmGraph.addBoard('Spare'); });
  await page.getByRole('button', { name: 'Delete this board' }).click();
  await page.click('#confirmYes');
  await expect(tabs(page)).toHaveText(['Board']);
  await page.click('#btnUndo');
  await expect(tabs(page)).toHaveText(['Board', 'Spare']);
  // The slider kept its place through all of it.
  await tabs(page).first().click();
  expect(await g(page, () => fmGraph.value('Revenue', 1))).toBe(12000);
});

test('the board file: export one or all, import into the same model, a model it doesn\'t fit, a dropped file', async ({ page }, testInfo) => {
  await openSample(page);
  await g(page, () => fmGraph.addBoard('Second'));
  await page.click('#btnAddBar');
  // Export this board (the menu).
  await page.click('.gbar-menu summary');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportBoard')]);
  expect(dl.suggestedFilename()).toBe('Sample model - Second.board.json');
  const one = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  expect(one.kind).toBe('fmIDE-graph-board');
  expect(one.version).toBe(1);
  expect(one.boards.map(b => b.name)).toEqual(['Second']);
  // Export all.
  await page.click('.gbar-menu summary');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportBoards')]);
  const all = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
  expect(all.boards.map(b => b.name)).toEqual(['Board', 'Second']);
  expect(all.boards[0].items.map(i => i.type)).toEqual(['chart', 'chart', 'bar', 'bar']);
  expect(all.boards[0].sliders.map(s => s.name)).toEqual(['Price', 'Volume']);
  // Import it back: added as new tabs, names kept apart.
  const file = testInfo.outputPath('all.board.json');
  fs.writeFileSync(file, JSON.stringify(all));
  await page.click('.gbar-menu summary');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btnImportBoards')]);
  await chooser.setFiles(file);
  await expect(tabs(page)).toHaveText(['Board', 'Second', 'Board (2)', 'Second (2)']);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('Added "Board (2)", "Second (2)".');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  // Dropped on the page, too.
  const dt = await page.evaluateHandle((t) => { const d = new DataTransfer(); d.items.add(new File([t], 'one.board.json', { type: 'application/json' })); return d; }, JSON.stringify(one));
  await page.dispatchEvent('main', 'drop', { dataTransfer: dt });
  await expect(tabs(page)).toHaveCount(5);
  await expect(tabs(page).nth(4)).toHaveText('Second (3)');
  // Another model: nothing fits, nothing added; a model that fits partly says what was left out.
  await g(page, (m) => fmGraph.load(m, 'Other'), { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'cX', name: 'X', nodes: [{ id: 'a', type: 'value', x: 0, y: 0, text: 'A\n1' }], edges: [] }] });
  expect(await g(page, (d) => fmGraph.importBoards(d), all)).toBe(0);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('None of the rectangles on that board are in this model');
  await g(page, (m) => fmGraph.load(m, 'Partly'), { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'cProfit', name: 'Profit', nodes: [{ id: 'profit', type: 'value', x: 0, y: 0, text: 'Profit\n5' }], edges: [] }] });
  expect(await g(page, (d) => fmGraph.importBoards(d), all)).toBe(1);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('left out: their rectangles aren\'t in this model');
});

test('the board file is read like any file: wrong kind, not JSON, newer version, hostile text, the old form, limits', async ({ page, pageErrors }, testInfo) => {
  await openSample(page);
  expect(await g(page, () => fmGraph.importBoards('not json'))).toBe(0);
  await expect(page.locator('.note.err')).toContainText("isn't JSON");
  expect(await g(page, () => fmGraph.importBoards({ kind: 'fmIDE-templates', version: 9, templates: [] }))).toBe(0);
  await expect(page.locator('.note.err')).toContainText("isn't an fmGraph board file");
  // A newer version: asked first.
  const newer = { kind: 'fmIDE-graph-board', version: 7, boards: [{ name: 'Later', items: [{ type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit' }] }] };
  const p = g(page, (d) => fmGraph.importBoards(d), newer);
  await expect(page.locator('#confirmTitle')).toHaveText('Saved by a newer version');
  await page.click('#confirmNo');
  expect(await p).toBe(0);
  // Hostile text in names and titles is shown as text.
  const evil = '<img src=x onerror="window.__pwned=1">';
  expect(await g(page, (e) => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 1, boards: [{ name: e, items: [
    { type: 'chart', layout: 'columns', title: e, groups: [{ name: e, parts: [{ canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue' }] }] }] }] }), evil)).toBe(1);
  await expect(tabs(page).last()).toHaveText(evil.slice(0, 60));
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // The form of G1 and G2 (one board: bars, charts and sliders at the top): one board, charts first.
  expect(await g(page, () => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 1,
    bars: [{ canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', periods: { mode: 'all' } }],
    charts: [{ layout: 'flow', title: 'Old', period: 0, steps: [{ canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', role: 'start' }] }],
    sliders: [{ canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', min: 1, max: 20, step: 1 }] }))).toBe(1);
  expect(await order(page)).toEqual(['Old', 'Profit']);
  expect((await g(page, () => fmGraph.board())).items.map(i => i.wide)).toEqual([true, false]);
  // At most 20 boards.
  const many = { kind: 'fmIDE-graph-board', version: 1, boards: Array.from({ length: 30 }, (_, i) => ({ name: 'B' + i, items: [{ type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit' }] })) };
  await g(page, (d) => fmGraph.importBoards(d), many);
  await expect(tabs(page)).toHaveCount(20);
  await expect(page.locator('.note').last()).toContainText('a model has at most 20 boards');
  await expect(page.getByRole('button', { name: 'Add an empty board' })).toBeDisabled();
  expect(pageErrors).toEqual([]);
  void testInfo;
});
