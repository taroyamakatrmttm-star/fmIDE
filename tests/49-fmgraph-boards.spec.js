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
  // The colour shown on the screen (not only the one recorded).
  const shown = (loc) => loc.evaluate(el => getComputedStyle(el).fill);
  await expect.poll(() => shown(bar.locator('.b-now').first())).toBe('rgb(255, 0, 0)');
  const bs = page.locator('.chart-widget').first();
  await pickColour(bs.locator('.chart-key input.key-swatch').first(), '#00ff00');
  await expect.poll(() => shown(bs.locator('.c-period').first().locator('.c-part').first())).toBe('rgb(0, 255, 0)');
  const flow = page.locator('.chart-widget').nth(1);
  await flow.locator('summary').click();
  await pickColour(flow.locator('.step-row').first().locator('input.colour-pick'), '#0000ff');
  await expect.poll(() => shown(flow.locator('.f-bar').first())).toBe('rgb(0, 0, 255)');
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
  expect(await shown(page.locator('.bar-widget .b-now').first())).toBe('rgb(15, 118, 110)'); // the usual colour
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
  expect(one.version).toBe(7);
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
  const newer = { kind: 'fmIDE-graph-board', version: 8, boards: [{ name: 'Later', items: [{ type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit' }] }] };
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

test('folding sliders: one by its ▸, Collapse all / Expand all; undo; kept; the board file version 6', async ({ page, pageErrors }) => {
  await openSample(page);
  const sliders = page.locator('.slider-widget');
  await expect(sliders).toHaveCount(2);
  const folded = () => g(page, () => fmGraph.board().sliders.map(s => s.folded === true));
  // Unfolded at first: every setting shows; the column's button collapses all.
  await expect(sliders.first().locator('.slider-base')).toBeVisible();
  await expect(page.locator('#btnFoldSliders')).toHaveText('Collapse all');
  // One slider folded: its name, track and number only.
  await sliders.first().getByRole('button', { name: 'Folded' }).click();
  await expect(sliders.first()).toHaveClass(/folded/);
  await expect(sliders.first().getByRole('button', { name: 'Folded' })).toHaveAttribute('aria-pressed', 'true');
  for(const hidden of ['.slider-base', '.slider-range', 'select[aria-label="What the slider does"]', 'button:text("Reset")']) await expect(sliders.first().locator(hidden)).toBeHidden();
  await expect(sliders.first().locator('.widget-head select')).toBeVisible();
  await expect(sliders.first().locator('input[type=range]')).toBeVisible();
  await expect(sliders.first().locator('input.slider-value')).toBeVisible();
  await expect(sliders.nth(1).locator('.slider-base')).toBeVisible();
  expect(await folded()).toEqual([true, false]);
  // A folded slider still moves the bars.
  const before = await g(page, () => fmGraph.value('Profit', 1));
  await sliders.first().locator('input.slider-value').fill('14');
  await sliders.first().locator('input.slider-value').press('Enter');
  expect(await g(page, () => fmGraph.value('Profit', 1))).not.toBe(before);
  // Collapse all, then Expand all: one undo step each.
  await page.click('#btnFoldSliders');
  expect(await folded()).toEqual([true, true]);
  await expect(page.locator('#btnFoldSliders')).toHaveText('Expand all');
  await page.click('#btnFoldSliders');
  expect(await folded()).toEqual([false, false]);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await folded()).toEqual([true, true]);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await folded()).toEqual([true, false]);
  await expect(sliders.nth(1).locator('.slider-base')).toBeVisible();
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  expect(await folded()).toEqual([true, false]);
  await expect(page.locator('.slider-widget').first()).toHaveClass(/folded/);
  // The board file: version 7 (6 brought `folded`), `folded` only on a folded slider; imported back with it.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(7);
  expect(file.boards[0].sliders.map(s => s.folded)).toEqual([true, undefined]);
  expect(await g(page, (d) => fmGraph.importBoards(d), file)).toBe(1);
  await g(page, () => fmGraph.showBoard(1));
  expect(await folded()).toEqual([true, false]);
  expect(pageErrors).toEqual([]);
});

test('a version 5 board file opens with its sliders unfolded; a folded that isn\'t true is not folded', async ({ page, pageErrors }) => {
  await openSample(page);
  const v5 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v5.json'), 'utf8'));
  expect(await g(page, (d) => fmGraph.importBoards(d), v5)).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before folded sliders'));
  const b = await g(page, () => fmGraph.board());
  expect(b.sliders.map(s => [s.name, s.mode, s.min, s.max, s.step, s.folded])).toEqual([['Price', 'set', 5, 15, 0.5, undefined], ['Volume', 'shift', -50, 50, 1, undefined]]);
  expect(b.items[0].scale).toEqual({ min: 0, max: 8000 });
  await expect(page.locator('.slider-widget.folded')).toHaveCount(0);
  const at = { canvasId: 'cProfit', nodeId: 'price', name: 'Price', periods: { mode: 'all' }, mode: 'set' };
  const odd = ['true', 1, {}, [true], null];
  expect(await g(page, (d) => fmGraph.importBoards(d), { kind: 'fmIDE-graph-board', version: 6, boards: [{ name: 'Odd folds',
    sliders: odd.map(folded => Object.assign({ folded }, at)).concat([Object.assign({ folded: true }, at)]) }] })).toBe(1);
  await g(page, () => fmGraph.showBoard('Odd folds'));
  expect((await g(page, () => fmGraph.board())).sliders.map(s => s.folded === true)).toEqual([false, false, false, false, false, true]);
  expect(pageErrors).toEqual([]);
});

test('the Sliders column stays on screen beside the bars and scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await openSample(page);
  await g(page, () => { for(let i = 0; i < 6; i++) fmGraph.addSlider('Debt'); });
  await expect(page.locator('.slider-widget')).toHaveCount(8);
  await g(page, () => window.scrollBy(0, 500));
  const col = await g(page, () => {
    const c = document.querySelector('#board > .board-col');
    return { top: c.getBoundingClientRect().top, bottom: c.getBoundingClientRect().bottom, gbar: document.querySelector('.gbar').offsetHeight,
      scrolls: c.scrollHeight > c.clientHeight, y: window.scrollY };
  });
  expect(col.y).toBeGreaterThan(0); // the page scrolled…
  expect(Math.abs(col.top - (col.gbar + 8))).toBeLessThan(2); // …and the column stayed just under the top bar,
  expect(col.bottom).toBeLessThanOrEqual(700); // on screen,
  expect(col.scrolls).toBe(true); // scrolling on its own.
  // Folded, the sliders take well under half the room.
  const tall = () => g(page, () => document.querySelector('#sliderList').offsetHeight);
  const unfolded = await tall();
  await page.click('#btnFoldSliders');
  expect(await tall()).toBeLessThan(unfolded / 2);
});

test('by finger: a slider moves by its handle, and the handle never scrolls the page (Safari on an iPad)', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 1400 } });
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url() === 'http://local.test/fmGraph.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(require('path').join(__dirname, '..', 'apps', 'fmGraph.html')) })
    : route.abort());
  await page.goto('http://local.test/fmGraph.html');
  await page.click('#btnSample');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  expect(await page.evaluate(() => fmGraph.board().sliders.map(s => s.name))).toEqual(['Price', 'Volume']);
  const from = await page.locator('.slider-widget').nth(1).locator('.drag-handle').boundingBox();
  const to = await page.locator('.slider-widget').first().boundingBox();
  const cdp = await context.newCDPSession(page);
  const pt = (x, y) => [{ x, y }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x + from.width / 2, from.y + from.height / 2) });
  for(let i = 1; i <= 8; i++){
    const f = i / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + (to.x + 40 - from.x) * f, from.y + (to.y + 10 - from.y) * f) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => fmGraph.board().sliders.map(s => s.name))).toEqual(['Volume', 'Price']);
  // A finger's move on the handle is stopped there, so the browser can't scroll instead.
  const stopped = await page.evaluate(() => {
    const h = document.querySelector('.slider-widget .drag-handle');
    const t = new Touch({ identifier: 9, target: h, clientX: 10, clientY: 10 });
    return !h.dispatchEvent(new TouchEvent('touchmove', { cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
  });
  expect(stopped).toBe(true);
  // The handle's text can't be selected or dragged by the browser itself.
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.drag-handle')).userSelect)).toBe('none');
  await context.close();
});

// Shared slider positions (the owner's request, 15 October 2026): boards share where the sliders
// stand by default; a board can keep its own. Which sliders a board shows stays its own.
const typeSlider = async (page, name, value) => {
  const box = page.locator('.slider-widget').filter({ has: page.locator('.widget-head select option:checked', { hasText: name }) }).first().locator('input.slider-value');
  await box.fill(String(value));
  await box.press('Enter');
};
const shown = (page) => g(page, () => fmGraph.board().sliders.map(s => [s.name, s.value]));
const profit1 = (page) => g(page, () => fmGraph.value('Profit', 1));

test('shared slider positions: each board shows its own sliders; a slider moved on one board counts on the others', async ({ page, pageErrors }) => {
  await openSample(page);
  const base = await profit1(page);
  // One board: no tick box, nothing shared to say.
  await expect(page.locator('#shareSlidersRow')).toBeHidden();
  await typeSlider(page, 'Price', 14);
  const moved = await profit1(page);
  expect(moved).not.toBe(base);
  // A second board, with only a Volume slider: Price at 14 still counts there, and the note says so.
  await page.getByRole('button', { name: 'Add an empty board' }).click();
  await expect(page.locator('#shareSlidersRow')).toBeVisible();
  await expect(page.locator('#shareSliders')).toBeChecked();
  expect(await profit1(page)).toBe(moved);
  await expect(page.locator('#sharedNote')).toHaveText('Also moved on other boards: Price 14.');
  await g(page, () => fmGraph.addSlider('Volume', { mode: 'shift' }));
  expect((await shown(page)).map(s => s[0])).toEqual(['Volume']); // its own sliders only
  await typeSlider(page, 'Volume', 10);
  const both = await profit1(page);
  expect(both).not.toBe(moved);
  // Back on the first board: its own Volume slider (also a change by %) is the same slider, at +10%.
  await tabs(page).first().click();
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', 10]]);
  expect(await profit1(page)).toBe(both);
  await expect(page.locator('#sharedNote')).toBeHidden(); // nothing moved that isn't shown here
  // A Volume slider that sets the number is another setting: not moved with them.
  await g(page, () => fmGraph.addSlider('Volume', { mode: 'set' }));
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', 10], ['Volume', null]]);
  await g(page, (id) => fmGraph.remove(id), (await g(page, () => fmGraph.board().sliders[2].id)));
  // A Price slider added on the second board stands at 14 already; moving it moves the first board's.
  await tabs(page).nth(1).click();
  await g(page, () => fmGraph.addSlider('Price'));
  expect(await shown(page)).toEqual([['Volume', 10], ['Price', 14]]);
  await typeSlider(page, 'Price', 12);
  await tabs(page).first().click();
  expect((await shown(page))[0]).toEqual(['Price', 12]);
  await expect(page.locator('.slider-widget').first().locator('input.slider-value')).toHaveValue('12');
  // Reset all on a sharing board puts every shared slider back.
  await page.click('#btnResetAll');
  expect(await profit1(page)).toBe(base);
  await tabs(page).nth(1).click();
  expect(await shown(page)).toEqual([['Volume', null], ['Price', null]]);
  expect(pageErrors).toEqual([]);
});

test('a board with its own slider positions: untouched by the others, and back to sharing takes the shared ones', async ({ page, pageErrors }) => {
  await openSample(page);
  await typeSlider(page, 'Price', 14);
  const shared = await profit1(page);
  await page.getByRole('button', { name: 'Duplicate this board' }).click();
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', null]]);
  // Unticked: it keeps what it shows as its own; the tab is marked; one undo step.
  await page.locator('#shareSliders').uncheck();
  await expect(tabs(page).nth(1).locator('.own-mark')).toHaveCount(1);
  await expect(tabs(page).first().locator('.own-mark')).toHaveCount(0);
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', null]]);
  expect(await profit1(page)).toBe(shared);
  await typeSlider(page, 'Price', 6);
  const own = await profit1(page);
  expect(own).not.toBe(shared);
  // The first board doesn't move with it, and moving the first doesn't move it.
  await tabs(page).first().click();
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', null]]);
  expect(await profit1(page)).toBe(shared);
  await typeSlider(page, 'Volume', 1200);
  await tabs(page).nth(1).click();
  expect(await shown(page)).toEqual([['Price', 6], ['Volume', null]]);
  expect(await profit1(page)).toBe(own);
  await expect(page.locator('#sharedNote')).toBeHidden();
  // Reset all here resets only its own.
  await page.click('#btnResetAll');
  await tabs(page).first().click();
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', 1200]]);
  // Kept in the board file (version 7, `ownSliders` only where true) and after a reload.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(7);
  expect(file.boards.map(b => b.ownSliders)).toEqual([undefined, true]);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(tabs(page).nth(1).locator('.own-mark')).toHaveCount(1);
  // Ticked again: it takes the shared positions (its own are dropped).
  await tabs(page).first().click();
  await typeSlider(page, 'Price', 13);
  await tabs(page).nth(1).click();
  await typeSlider(page, 'Price', 7);
  await page.locator('#shareSliders').check();
  expect(await shown(page)).toEqual([['Price', 13], ['Volume', null]]);
  await expect(tabs(page).nth(1).locator('.own-mark')).toHaveCount(0);
  // Undo takes the switch back: its own again.
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  await expect(tabs(page).nth(1).locator('.own-mark')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test('scenarios and Pin as A on sharing boards take every shared slider, shown or not', async ({ page, pageErrors }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Add an empty board' }).click();
  await g(page, () => fmGraph.addSlider('Unit cost'));
  await typeSlider(page, 'Unit cost', 5);
  await tabs(page).first().click();
  await typeSlider(page, 'Price', 13);
  const both = await profit1(page);
  expect(await g(page, () => fmGraph.saveScenario('Both'))).toBeTruthy();
  expect((await g(page, () => fmGraph.scenarios()))[0].settings).toBe('Price 13, Unit cost 5');
  expect(await g(page, () => fmGraph.pinA())).toBe('Price 13, Unit cost 5');
  await g(page, () => fmGraph.unpinA());
  await page.click('#btnResetAll');
  expect(await profit1(page)).not.toBe(both);
  // ▶ Show from the first board sets the second board's slider too.
  await g(page, () => fmGraph.showScenario('Both'));
  expect(await profit1(page)).toBe(both);
  await tabs(page).nth(1).click();
  expect(await shown(page)).toEqual([['Unit cost', 5]]);
  expect(pageErrors).toEqual([]);
});

test('a version 6 board file opens with every board sharing; an ownSliders that isn\'t true shares', async ({ page, pageErrors }) => {
  await openSample(page);
  const v6 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v6.json'), 'utf8'));
  expect(await g(page, (d) => fmGraph.importBoards(d), v6)).toBe(2);
  await g(page, () => fmGraph.showBoard('Saved before shared sliders'));
  const b = await g(page, () => fmGraph.board());
  expect(b.ownSliders).toBeUndefined();
  expect(b.sliders.map(s => [s.name, s.folded])).toEqual([['Price', true]]);
  await expect(page.locator('#shareSliders')).toBeChecked();
  await expect(page.locator('.own-mark')).toHaveCount(0);
  // Shared with the sample's own board: Price moved here stands there too.
  await typeSlider(page, 'Price', 11);
  await g(page, () => fmGraph.showBoard('Board'));
  expect((await shown(page))[0]).toEqual(['Price', 11]);
  const at = { name: 'Odd', items: [], sliders: [] };
  const odd = ['true', 1, {}, [true], null];
  expect(await g(page, (d) => fmGraph.importBoards(d), { kind: 'fmIDE-graph-board', version: 7,
    boards: odd.map((ownSliders, i) => Object.assign({}, at, { name: 'Odd ' + i, ownSliders })).concat([Object.assign({}, at, { name: 'Own', ownSliders: true })]) })).toBe(0);
  // Empty boards aren't added; the same with a slider each.
  const slider = { canvasId: 'cProfit', nodeId: 'price', name: 'Price', periods: { mode: 'all' }, mode: 'set' };
  expect(await g(page, (d) => fmGraph.importBoards(d), { kind: 'fmIDE-graph-board', version: 7,
    boards: odd.map((ownSliders, i) => ({ name: 'Odd ' + i, ownSliders, sliders: [slider] })).concat([{ name: 'Own', ownSliders: true, sliders: [slider] }]) })).toBe(6);
  const owns = [];
  for(const name of ['Odd 0', 'Odd 1', 'Odd 2', 'Odd 3', 'Odd 4', 'Own']){ await g(page, (n) => fmGraph.showBoard(n), name); owns.push((await g(page, () => fmGraph.board())).ownSliders === true); }
  expect(owns).toEqual([false, false, false, false, false, true]);
  expect(pageErrors).toEqual([]);
});
