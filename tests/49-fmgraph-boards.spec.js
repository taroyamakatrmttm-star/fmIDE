// 49. fmGraph's boards (step 15, phase G3a; docs/step15-fmgraph.md): several boards as tabs,
// arranging widgets in the grid (drag by mouse, finger or keyboard; wide or narrow), colours,
// undo and redo, and the board file (fmIDE-graph-board 1: export, import, dropped on the page).
const fs = require('fs');
const { test, expect, openApp, BOARD_FILE_VERSION } = require('./helpers/apps');

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
  const before = await g(page, () => fmGraph.colours());
  const n = await g(page, () => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 1, boards: [{ name: 'Odd', items: [
    { type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', colour: 'url(javascript:alert(1))' },
    { type: 'bar', canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', colour: '#12345' }] }] }));
  expect(n).toBe(1);
  // The file's colours are ignored: the rectangles keep their shared colours (board file 11; changed on purpose).
  expect(await g(page, () => fmGraph.colours())).toEqual(before);
  expect(await shown(page.locator('.bar-widget .b-now').first())).toBe('rgb(255, 0, 0)');
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
  expect(one.version).toBe(BOARD_FILE_VERSION);
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
  // A newer version: asked first (one past the current version, BOARD_FILE_VERSION + 1; changed on purpose: it was 13 when 12 was current).
  const newer = { kind: 'fmIDE-graph-board', version: BOARD_FILE_VERSION + 1, boards: [{ name: 'Later', items: [{ type: 'bar', canvasId: 'cProfit', nodeId: 'profit', name: 'Profit' }] }] };
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

test('a slider\'s Range and step stays open while From, to and step are changed (Tab or a click to the next box)', async ({ page, pageErrors }) => {
  await openSample(page);
  const slider = page.locator('.slider-widget').first();
  const box = slider.locator('details.slider-range');
  await box.locator('summary').click();
  await expect(box).toHaveAttribute('open', '');
  const from = box.getByLabel('From', { exact: true }), to = box.getByLabel('to', { exact: true }), step = box.getByLabel('step', { exact: true });
  const id = await slider.getAttribute('data-id');
  const range = () => g(page, (sid) => { const s = fmGraph.board().sliders.find(x => x.id === sid); return [s.min, s.max, s.step]; }, id);
  // From, then Tab: the new range is taken, the box stays open and the focus is in "to".
  await from.fill('2');
  await from.press('Tab');
  await expect.poll(range).toEqual([2, expect.any(Number), expect.any(Number)]);
  await expect(box).toHaveAttribute('open', '');
  await expect(to).toBeFocused();
  // Typing in "to" (all of it selected, as Tab leaves it), then a click in "step".
  await page.keyboard.type('40');
  await step.click();
  await expect.poll(range).toEqual([2, 40, expect.any(Number)]);
  await expect(box).toHaveAttribute('open', '');
  await expect(step).toBeFocused();
  await step.fill('2');
  await step.press('Tab');
  await expect.poll(range).toEqual([2, 40, 2]);
  await expect(box).toHaveAttribute('open', '');
  // The slider's own track follows; a redraw for another reason (what the slider does) leaves it open too.
  await expect(slider.locator('input[type=range]')).toHaveAttribute('max', '40');
  await slider.locator('select[aria-label="What the slider does"]').selectOption('shift');
  await expect(page.locator('.slider-widget').first().locator('details.slider-range')).toHaveAttribute('open', '');
  // Closed by its heading, it stays closed.
  await page.locator('.slider-widget').first().locator('details.slider-range summary').click();
  await page.locator('.slider-widget').first().getByLabel('From', { exact: true }).evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(range).toEqual([1, expect.any(Number), expect.any(Number)]);
  await expect(page.locator('.slider-widget').first().locator('details.slider-range')).not.toHaveAttribute('open', '');
  expect(pageErrors).toEqual([]);
});

// Changed on purpose (board file 14, the owner's request of 30 October 2026): a slider has three
// looks — Open, Folded, Minimum — its button steps through them, and Collapse all / Expand all
// became All: Open · Folded · Minimum.
test('a slider\'s look: Open, Folded, Minimum by its button and for all; undo; kept; the board file', async ({ page, pageErrors }) => {
  await openSample(page);
  const sliders = page.locator('#sliderList > .slider-widget');
  await expect(sliders).toHaveCount(2);
  const looks = () => g(page, () => fmGraph.board().sliders.map(s => s.folded || false));
  const all = (look) => page.locator('#sliderLooks button[data-look="' + look + '"]');
  // Open at first: every setting shows; All: Open is marked.
  await expect(sliders.first().locator('.slider-base')).toBeVisible();
  await expect(all('open')).toHaveAttribute('aria-pressed', 'true');
  await expect(all('min')).toHaveAttribute('aria-pressed', 'false');
  // Its button: Folded — its rectangle, track and number only.
  await sliders.first().getByRole('button', { name: 'Slider look: Open' }).click();
  await expect(sliders.first()).toHaveClass(/folded/);
  for(const hidden of ['.slider-base', '.slider-range', 'select[aria-label="What the slider does"]', 'button:text("Reset")']) await expect(sliders.first().locator(hidden)).toBeHidden();
  await expect(sliders.first().locator('.widget-head select')).toBeVisible();
  await expect(sliders.first().locator('input[type=range]')).toBeVisible();
  await expect(sliders.first().locator('input.slider-value')).toBeVisible();
  await expect(sliders.nth(1).locator('.slider-base')).toBeVisible();
  expect(await looks()).toEqual([true, false]);
  await expect(all('open')).toHaveAttribute('aria-pressed', 'false');
  // A folded slider still moves the bars.
  const before = await g(page, () => fmGraph.value('Profit', 1));
  await sliders.first().locator('input.slider-value').fill('14');
  await sliders.first().locator('input.slider-value').press('Enter');
  expect(await g(page, () => fmGraph.value('Profit', 1))).not.toBe(before);
  // Again: Minimum — one short row, its name, the slider and its number, its handle and its button.
  await sliders.first().getByRole('button', { name: 'Slider look: Folded' }).click();
  await expect(sliders.first()).toHaveClass(/minimum/);
  expect(await looks()).toEqual(['min', false]);
  const row = sliders.first();
  await expect(row.locator('.slider-name')).toHaveText('Price');
  await expect(row.locator('.ps-track')).toBeVisible();
  await expect(row.locator('.ps-value')).toHaveText('14');
  await expect(row.locator('.drag-handle')).toBeVisible();
  for(const gone of ['select', 'input.slider-colour', '.widget-remove', '.ps-minus']) await expect(row.locator(gone)).toBeHidden();
  const box = await row.boundingBox();
  expect(box.height).toBeLessThanOrEqual(48);
  const mid = (sel) => row.locator(sel).evaluate(el => { const r = el.getBoundingClientRect(); return r.y + r.height / 2; });
  expect(Math.abs(await mid('.slider-name') - await mid('.ps-track'))).toBeLessThan(4); // side by side
  // It moves the bars, by its keys; and follows a slider moved elsewhere.
  const at14 = await g(page, () => fmGraph.value('Profit', 1));
  await row.locator('.ps-track').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => g(page, () => fmGraph.value('Profit', 1))).not.toBe(at14);
  await g(page, () => fmGraph.setSlider(fmGraph.board().sliders[0].id, 12));
  await expect(row.locator('.ps-value')).toHaveText('12');
  // Again: Open.
  await row.getByRole('button', { name: 'Slider look: Minimum' }).click();
  expect(await looks()).toEqual([false, false]);
  await expect(sliders.first().locator('.slider-base')).toBeVisible();
  // All: Minimum, then All: Folded — one undo step each.
  await all('min').click();
  expect(await looks()).toEqual(['min', 'min']);
  await expect(all('min')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sliderList > .slider-widget.minimum')).toHaveCount(2);
  await all('folded').click();
  expect(await looks()).toEqual([true, true]);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await looks()).toEqual(['min', 'min']);
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await looks()).toEqual([false, false]);
  // The API, and a mixed board: no All button marked.
  expect(await g(page, () => fmGraph.setSliderLook(fmGraph.board().sliders[0].id, 'min'))).toBe(true);
  expect(await g(page, () => fmGraph.setSliderLook(fmGraph.board().sliders[1].id, 'folded'))).toBe(true);
  expect(await g(page, () => fmGraph.sliderLook(fmGraph.board().sliders[0].id))).toBe('min');
  for(const look of ['open', 'folded', 'min']) await expect(all(look)).toHaveAttribute('aria-pressed', 'false');
  expect(await g(page, () => { try{ fmGraph.setSliderLook('all', 'tiny'); return 'no'; }catch(e){ return e.message; } })).toMatch(/open, folded or min/);
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('#sliderList > .slider-widget')).toHaveCount(2);
  expect(await looks()).toEqual(['min', true]);
  await expect(page.locator('#sliderList > .slider-widget').first()).toHaveClass(/minimum/);
  // The board file: version 14 brought "min" (6 brought `folded`); imported back with it.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(BOARD_FILE_VERSION);
  expect(file.boards[0].sliders.map(s => s.folded)).toEqual(['min', true]);
  expect(await g(page, (d) => fmGraph.importBoards(d), file)).toBe(1);
  await g(page, () => fmGraph.showBoard(1));
  expect(await looks()).toEqual(['min', true]);
  expect(pageErrors).toEqual([]);
});

test('a version 13 board file opens as it was saved: folded sliders folded, the others open', async ({ page, pageErrors }) => {
  await openSample(page);
  const v13 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v13.json'), 'utf8'));
  expect(v13.version).toBe(13);
  expect(await g(page, (d) => fmGraph.importBoards(d), v13)).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before the minimum'));
  const b = await g(page, () => fmGraph.board());
  expect(b.sliders.map(s => [s.name, s.folded])).toEqual([['Price', true], ['Volume', undefined]]);
  await expect(page.locator('#sliderList > .slider-widget.folded')).toHaveCount(1);
  await expect(page.locator('#sliderList > .slider-widget.minimum')).toHaveCount(0);
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
  await page.click('#sliderLooks button[data-look="folded"]'); // All: Folded (changed on purpose: was Collapse all)
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
  // Kept in the board file (version 8 (7 brought it), `ownSliders` only where true) and after a reload.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(BOARD_FILE_VERSION);
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

// The shared period (the owner's request, 18 October 2026): one period setting for every bar and
// chart on every board, which any of them can leave to keep its own.
test('the shared period: every board follows it, a chart can keep its own and come back; undo, the file, a reload', async ({ page, pageErrors }) => {
  await openSample(page);
  const bar = page.locator('#sharedPeriodBar');
  await expect(bar).toBeVisible();
  const items = () => g(page, () => fmGraph.board().items.map(w => [w.layout || w.type, w.periods || null, w.period === undefined ? null : w.period, w.ownPeriod === true]));
  // The sample follows it: all periods, and Year 1 for the waterfall.
  expect(await items()).toEqual([
    ['columns', { mode: 'all' }, null, false], ['flow', null, 0, false], ['bar', { mode: 'all' }, null, false], ['bar', { mode: 'all' }, null, false]]);
  // Year 2 to Year 4, and Year 4 for one-period charts: every bar and chart follows.
  await bar.locator('select[aria-label="Shared periods"]').selectOption('range');
  await bar.locator('select[aria-label="Shared first period"]').selectOption('1');
  await bar.locator('select[aria-label="Shared period for one-period charts"]').selectOption('3');
  const range = { mode: 'range', from: 1, to: 3 };
  expect(await items()).toEqual([['columns', range, null, false], ['flow', null, 3, false], ['bar', range, null, false], ['bar', range, null, false]]);
  const firstBar = page.locator('.bar-widget').first();
  await expect(firstBar.locator('.bar-settings select[aria-label="Periods"]')).toHaveValue('shared');
  await expect(firstBar.locator('.bar-settings select[aria-label="Periods"] option').first()).toHaveText('Shared (Year 2 to Year 4)');
  await expect(firstBar.locator('.bar-settings select[aria-label="Period"]')).toBeHidden();
  await expect(firstBar.locator('.t-period')).toHaveText(['Year 2', 'Year 3', 'Year 4']);
  // The waterfall's own list says the same.
  const flow = page.locator('.chart-widget[data-layout="flow"]');
  await flow.locator('summary').click();
  await expect(flow.locator('.chart-edit select[aria-label="Period"]')).toHaveValue('shared');
  await expect(flow.locator('.chart-edit select[aria-label="Period"] option').first()).toHaveText('Shared (Year 4)');
  // A bar keeping its own (One period, Year 1): the shared periods no longer move it.
  await firstBar.locator('.bar-settings select[aria-label="Periods"]').selectOption('one');
  await firstBar.locator('.bar-settings select[aria-label="Period"]').selectOption('0');
  await bar.locator('select[aria-label="Shared periods"]').selectOption('all');
  expect(await items()).toEqual([['columns', { mode: 'all' }, null, false], ['flow', null, 3, false], ['bar', { mode: 'one', p: 0 }, null, true], ['bar', { mode: 'all' }, null, false]]);
  // The waterfall keeping its own Year 2; the shared one-period year doesn't move it.
  await flow.locator('.chart-edit select[aria-label="Period"]').selectOption('1');
  await bar.locator('select[aria-label="Shared period for one-period charts"]').selectOption('2');
  expect((await items())[1]).toEqual(['flow', null, 1, true]);
  // Shared again: it follows once more.
  await page.locator('.chart-widget[data-layout="flow"] .chart-edit select[aria-label="Period"]').selectOption('shared');
  expect((await items())[1]).toEqual(['flow', null, 2, false]);
  // Another board: a new bar there follows the same shared periods.
  await page.locator('#boardTabs').getByRole('button', { name: 'Add an empty board' }).click();
  await page.click('#btnAddBar');
  await bar.locator('select[aria-label="Shared periods"]').selectOption('one');
  await bar.locator('select[aria-label="Shared first period"]').selectOption('3');
  expect(await items()).toEqual([['bar', { mode: 'one', p: 3 }, null, false]]);
  // ... and the first board's followers changed with it, its own bar didn't.
  await g(page, () => fmGraph.showBoard(0));
  expect(await items()).toEqual([['columns', { mode: 'one', p: 3 }, null, false], ['flow', null, 2, false], ['bar', { mode: 'one', p: 0 }, null, true], ['bar', { mode: 'one', p: 3 }, null, false]]);
  // Undo takes the last shared change back.
  await page.click('#btnUndo');
  await expect(bar.locator('select[aria-label="Shared periods"]')).toHaveValue('one');
  await expect(bar.locator('select[aria-label="Shared first period"]')).toHaveValue('0');
  expect((await items())[0]).toEqual(['columns', { mode: 'one', p: 0 }, null, false]);
  await page.click('#btnRedo');
  // The board file (version 10; 9 brought the shared period): the shared period, `ownPeriod` only where kept, every chart's periods as shown.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(BOARD_FILE_VERSION);
  expect(file.sharedPeriods).toEqual({ periods: { mode: 'one', p: 3 }, period: 2 });
  expect(file.boards[0].items.map(w => [w.periods || w.period, w.ownPeriod])).toEqual([[{ mode: 'one', p: 3 }, undefined], [2, undefined], [{ mode: 'one', p: 0 }, true], [{ mode: 'one', p: 3 }, undefined]]);
  // Kept after a reload.
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('#sharedPeriodBar select[aria-label="Shared periods"]')).toHaveValue('one');
  await expect(page.locator('#sharedPeriodBar select[aria-label="Shared period for one-period charts"]')).toHaveValue('2');
  expect((await items())[2]).toEqual(['bar', { mode: 'one', p: 0 }, null, true]);
  // fmGraph.addBar without periods follows; with periods it keeps them.
  await g(page, () => fmGraph.addBar('Revenue'));
  await g(page, () => fmGraph.addBar('Revenue', 2));
  expect((await items()).slice(-2)).toEqual([['bar', { mode: 'one', p: 3 }, null, false], ['bar', { mode: 'one', p: 1 }, null, true]]);
  expect(pageErrors).toEqual([]);
});

test('a version 8 board file opens with every bar and chart keeping its own periods', async ({ page, pageErrors }) => {
  await openSample(page);
  const v8 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v8.json'), 'utf8'));
  expect(await g(page, (d) => fmGraph.importBoards(d), v8)).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before the shared period'));
  const items = () => g(page, () => fmGraph.board().items.map(w => [w.layout || w.type, w.periods || w.period, w.ownPeriod === true]));
  expect(await items()).toEqual([['bar', { mode: 'range', from: 1, to: 2 }, true], ['flow', 2, true], ['tornado', 3, true]]);
  // The shared period doesn't move them.
  await page.locator('#sharedPeriodBar select[aria-label="Shared period for one-period charts"]').selectOption('0');
  await page.locator('#sharedPeriodBar select[aria-label="Shared periods"]').selectOption('one');
  expect(await items()).toEqual([['bar', { mode: 'range', from: 1, to: 2 }, true], ['flow', 2, true], ['tornado', 3, true]]);
  expect(pageErrors).toEqual([]);
});

// Version 9 (before the lines chart): opens as it was saved — the 9 → 10 step changes nothing,
// so its bars and charts keep following the shared period, and the one kept own stays own.
test('a version 9 board file opens unchanged: followers follow, its own keeps its own; colours and charts as saved', async ({ page, pageErrors }) => {
  await openSample(page);
  const v9 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v9.json'), 'utf8'));
  expect(await g(page, (d) => fmGraph.importBoards(d), v9)).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before lines charts'));
  const b = await g(page, () => fmGraph.board());
  // The model's shared periods (all, Year 1) for the followers; the Revenue bar its own Year 1.
  expect(b.items.map(w => [w.layout || w.type, w.name || w.title, w.periods || w.period, w.ownPeriod === true])).toEqual([
    ['bar', 'Profit', { mode: 'all' }, false], ['bar', 'Revenue', { mode: 'one', p: 0 }, true],
    ['columns', 'Costs', { mode: 'all' }, false], ['flow', 'Profit', 0, false]]);
  expect(b.items[1].colour).toBe('#ff0000');
  // Its colours are the rectangles' now (board file 11; changed on purpose): Cost of sales an automatic one.
  expect(b.items[2].groups[0].parts.map(p => [p.name, p.colour])).toEqual([['Cost of sales', expect.stringMatching(/^#[0-9a-f]{6}$/)], ['Overheads', '#00ff00']]);
  expect(await g(page, () => fmGraph.colours().map(c => [c.name, c.colour]))).toEqual([['Revenue', '#ff0000'], ['Overheads', '#00ff00']]);
  expect(b.items[3].steps.map(s => [s.name, s.role])).toEqual([['Revenue', 'start'], ['Profit', 'total']]);
  expect(b.sliders.map(s => [s.name, s.min, s.max, s.step])).toEqual([['Price', 5, 15, 0.5]]);
  // The shared period moves the followers only.
  await page.locator('#sharedPeriodBar select[aria-label="Shared periods"]').selectOption('one');
  const after = await g(page, () => fmGraph.board().items.map(w => w.periods || w.period));
  expect(after).toEqual([{ mode: 'one', p: 0 }, { mode: 'one', p: 0 }, { mode: 'one', p: 0 }, 0]);
  await page.locator('#sharedPeriodBar select[aria-label="Shared first period"]').selectOption('2');
  expect((await g(page, () => fmGraph.board().items.map(w => w.periods || w.period)))[1]).toEqual({ mode: 'one', p: 0 });
  // Saved again as version 10.
  expect((await g(page, () => fmGraph.exportBoards(false))).version).toBe(BOARD_FILE_VERSION);
  expect(pageErrors).toEqual([]);
});

test('a version 6 board file opens with every board sharing;an ownSliders that isn\'t true shares', async ({ page, pageErrors }) => {
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

// Shared colours (the owner's request of 26 October 2026, board file 11): a rectangle has one
// colour on every board — its slider, its bars, every chart — picked in any of them.
test('shared colours: one colour per rectangle on every board, picked from a slider, a bar or a chart; undo, the file, a reload', async ({ page, pageErrors }) => {
  await openSample(page);
  const shown = (loc) => loc.evaluate(el => getComputedStyle(el).fill);
  const rgb = (hex) => 'rgb(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
  // Closing cash: the Balance sheet's first part, so its bar takes the chart's first colour.
  expect(await g(page, () => fmGraph.rectColour('Closing cash'))).toEqual({ colour: '#0f766e', chosen: false });
  const equip = (await g(page, () => fmGraph.rectColour('Equipment'))).colour;
  expect(equip).toBe('#2563eb');
  // Profit is in no Columns, Lines or Spider chart: the usual look, and its waterfall step by direction.
  expect(await g(page, () => fmGraph.rectColour('Profit'))).toEqual({ colour: null, chosen: false });
  // A second board: a lines chart and a bar of Equipment take the same colour.
  await g(page, () => { fmGraph.addBoard('Second'); fmGraph.addChart({ layout: 'lines', title: 'Trend', lines: ['Debt', 'Equipment'] }); fmGraph.addBar('Equipment'); fmGraph.addSlider('Price'); fmGraph.addBar('Price'); });
  const second = page.locator('.chart-widget').first();
  await expect(second.locator('.l-line[data-line="Equipment"] .l-path')).toHaveAttribute('stroke', equip);
  await expect.poll(() => shown(page.locator('.bar-widget').first().locator('.b-now').first())).toBe(rgb(equip));
  // The slider's colour box picks Price's colour: its bar takes it, and the slider's stripe.
  await pickColour(page.locator('.slider-widget').first().locator('input.slider-colour'), '#ff00ff');
  await expect.poll(() => shown(page.locator('.bar-widget').nth(1).locator('.b-now').first())).toBe('rgb(255, 0, 255)');
  await expect(page.locator('.slider-widget').first()).toHaveCSS('border-left-color', 'rgb(255, 0, 255)');
  expect(await g(page, () => fmGraph.rectColour('Price'))).toEqual({ colour: '#ff00ff', chosen: true });
  // A key's swatch here changes Equipment on the first board too, and its bar.
  await pickColour(second.locator('.chart-key input.key-swatch').nth(1), '#00ff00');
  await expect.poll(() => shown(page.locator('.bar-widget').first().locator('.b-now').first())).toBe('rgb(0, 255, 0)');
  await g(page, () => fmGraph.showBoard(0));
  const bs = page.locator('.chart-widget').first();
  await expect(bs.locator('.chart-key input.key-swatch').nth(1)).toHaveValue('#00ff00');
  await expect.poll(() => shown(bs.locator('.c-period').first().locator('.c-part').nth(1))).toBe('rgb(0, 255, 0)');
  // A waterfall step keeps its colour by direction until one is chosen for it; then everywhere.
  const flow = page.locator('.chart-widget').nth(1);
  const upColour = await shown(flow.locator('.f-bar').first());
  await flow.locator('summary').click();
  await pickColour(flow.locator('.step-row').nth(4).locator('input.colour-pick'), '#123456');
  await expect.poll(() => shown(flow.locator('.f-bar').nth(4))).toBe('rgb(18, 52, 86)');
  expect(await shown(flow.locator('.f-bar').first())).toBe(upColour);
  await expect.poll(() => shown(page.locator('.bar-widget').first().locator('.b-now').first())).toBe('rgb(18, 52, 86)'); // the Profit bar
  // In the file: the chosen colours, and each widget the colour it shows.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(BOARD_FILE_VERSION);
  expect(file.colours.map(c => [c.name, c.colour])).toEqual([['Price', '#ff00ff'], ['Equipment', '#00ff00'], ['Profit', '#123456']]);
  expect(file.boards[0].items.find(w => w.layout === 'columns').groups[0].parts.map(p => p.colour)).toEqual(['#0f766e', '#00ff00']);
  expect(file.boards[1].items.find(w => w.type === 'bar').colour).toBe('#00ff00');
  // Undo puts back the step's colour; the others stay.
  await g(page, () => fmGraph.undo());
  expect(await g(page, () => fmGraph.colours().map(c => c.name))).toEqual(['Price', 'Equipment']);
  // Through the API on a slider; null goes back to the automatic colour.
  await g(page, () => { fmGraph.showBoard('Second'); fmGraph.setColour(fmGraph.board().sliders[0].id, '#00ffff'); });
  expect(await g(page, () => fmGraph.rectColour('Price').colour)).toBe('#00ffff');
  await g(page, () => fmGraph.setColour(fmGraph.board().charts[0].id, null, 'Equipment'));
  expect(await g(page, () => fmGraph.rectColour('Equipment'))).toEqual({ colour: '#2563eb', chosen: false });
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect.poll(() => g(page, () => fmGraph.boards().length)).toBe(2);
  expect(await g(page, () => fmGraph.colours().map(c => [c.name, c.colour]))).toEqual([['Price', '#00ffff']]);
  expect(pageErrors).toEqual([]);
});

test('a version 10 board file: its colours become the rectangles\' shared ones, the first one winning, with a note', async ({ page, pageErrors }) => {
  await openSample(page);
  const v10 = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'fixtures', 'formats', 'board-v10.json'), 'utf8'));
  expect(await g(page, (d) => fmGraph.importBoards(d), v10)).toBe(2);
  // Revenue: red in the Columns chart first, green on its bar, yellow in a lines chart: red.
  await expect(page.locator('.note[data-slot="colours"]')).toContainText('1 rectangle had different colours in different bars or charts');
  expect(await g(page, () => fmGraph.colours().map(c => [c.name, c.colour]))).toEqual([['Revenue', '#ff0000'], ['Profit', '#0000ff']]);
  await g(page, () => fmGraph.showBoard('Saved before shared colours'));
  const shown = (loc) => loc.evaluate(el => getComputedStyle(el).fill);
  await expect.poll(() => shown(page.locator('.bar-widget .b-now').first())).toBe('rgb(255, 0, 0)');
  await g(page, () => fmGraph.showBoard('Lines before shared colours'));
  await expect(page.locator('.l-line[data-line="Revenue"] .l-path')).toHaveAttribute('stroke', '#ff0000');
  // Saved again as version 11, each widget with the colour it shows.
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(BOARD_FILE_VERSION);
  const saved = file.boards.find(b => b.name === 'Saved before shared colours');
  expect(saved.items.find(w => w.type === 'bar').colour).toBe('#ff0000');
  expect(saved.items.find(w => w.layout === 'flow').steps.map(s => s.colour || null)).toEqual(['#ff0000', '#0000ff']);
  // A version 11 file's colours are read from `colours`, not from its widgets; a bad one ignored.
  const v11 = { kind: 'fmIDE-graph-board', version: 11,
    colours: [{ canvasId: 'cProfit', nodeId: 'gp', name: 'Gross profit', colour: '#ABCDEF' }, { canvasId: 'cProfit', nodeId: 'gp', name: 'Gross profit', colour: 'red' }, { canvasId: 'cProfit', nodeId: 'cogs', name: 'Cost of sales', colour: 'url(javascript:alert(1))' }],
    boards: [{ name: 'Eleven', items: [{ type: 'bar', canvasId: 'cProfit', nodeId: 'over', name: 'Overheads', colour: '#000000' }, { type: 'bar', canvasId: 'cProfit', nodeId: 'gp', name: 'Gross profit' }, { type: 'bar', canvasId: 'cProfit', nodeId: 'cogs', name: 'Cost of sales' }] }] };
  expect(await g(page, (d) => fmGraph.importBoards(d), v11)).toBe(1);
  expect(await g(page, () => fmGraph.rectColour('Overheads').chosen)).toBe(false);
  expect(await g(page, () => fmGraph.rectColour('Cost of sales').chosen)).toBe(false);
  expect(await g(page, () => fmGraph.rectColour('Gross profit'))).toEqual({ colour: '#abcdef', chosen: true });
  expect(pageErrors).toEqual([]);
});

// The contrast of an 'rgb(r, g, b)' colour against white (WCAG's relative luminance).
function contrastWithWhite(rgb){
  const [r, gr, b] = rgb.match(/\d+/g).map(Number).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 1.05 / (0.2126 * r + 0.7152 * gr + 0.0722 * b + 0.05);
}

test('a slider takes its rectangle\'s colour: the grip and the filled bar, a pale one darkened to 3:1 (stripe exact)', async ({ page, pageErrors }) => {
  await openSample(page);
  const slider = page.locator('#sliderList .slider-widget').first();
  const range = slider.locator('.slider-track input[type=range]');
  const accent = () => range.evaluate(el => getComputedStyle(el).accentColor);
  // The sample's Price slider has the usual colour.
  expect(await accent()).toBe('rgb(15, 118, 110)');
  // A colour set through the API reaches the slider at once, exactly.
  await g(page, () => fmGraph.setColour(fmGraph.board().sliders[0].id, '#db2777'));
  await expect.poll(accent).toBe('rgb(219, 39, 119)');
  await expect(slider).toHaveCSS('border-left-color', 'rgb(219, 39, 119)');
  // A pale yellow: the stripe and colour box keep it, the slider is darker, with the same hue, at 3:1.
  await g(page, () => fmGraph.setColour(fmGraph.board().sliders[0].id, '#fde68a'));
  await expect(slider).toHaveCSS('border-left-color', 'rgb(253, 230, 138)');
  await expect(slider.locator('input.slider-colour')).toHaveValue('#fde68a');
  const pale = await accent();
  expect(pale).not.toBe('rgb(253, 230, 138)');
  const c = contrastWithWhite(pale);
  expect(c).toBeGreaterThanOrEqual(3);
  expect(c).toBeLessThan(3.1); // no darker than it needs
  const [r, gr, b] = pale.match(/\d+/g).map(Number);
  expect(Math.abs(r / b - 253 / 138)).toBeLessThan(0.1); // the hue kept
  expect(Math.abs(gr / b - 230 / 138)).toBeLessThan(0.1);
  // Back to the automatic colour: the usual one again.
  await g(page, () => fmGraph.setColour(fmGraph.board().sliders[0].id, null));
  await expect.poll(accent).toBe('rgb(15, 118, 110)');
  expect(pageErrors).toEqual([]);
});

// ---- copying or moving a widget to another board (⇄, 04-board-edit.js; the owner's request of 30 October 2026) ----
// Every board's file form; a Free chart's piece ids (made anew whenever a chart is read) as places in its list.
const allBoards = (page) => g(page, () => fmGraph.exportBoards(true).boards.map(b => Object.assign(b, { items: b.items.map(w => {
  if(!w.pieces) return w;
  const at = (id) => w.pieces.findIndex(p => p.id === id);
  return Object.assign(w, { pieces: w.pieces.map(({ id, ...p }) => Object.assign(p, p.sits && p.sits.of ? { sits: Object.assign({}, p.sits, { of: at(p.sits.of) }) } : {}, p.check ? { check: at(p.check) } : {})) });
}) })));
// A window.fmGraph call's error, in words ('Error: …'), or what it gave.
const apiError = (page, call, args) => page.evaluate(([c, a]) => { try{ return fmGraph[c](...a); }catch(e){ return 'Error: ' + e.message; } }, [call, args]);

test('⇄ copies or moves a bar, a chart of every kind or a slider to another board, with all it carries; one undo step each', async ({ page, pageErrors }) => {
  await openSample(page);
  // Charts of the other kinds, and settings of every sort to carry.
  await g(page, () => {
    fmGraph.addChart({ layout: 'lines', title: 'Lines', periods: [1, 2], lines: ['Revenue', 'Profit'] });
    fmGraph.addChart({ layout: 'tornado', title: 'What matters', output: 'Profit', period: 1 });
    fmGraph.addChart({ layout: 'free', title: 'Free', period: 1, pieces: [{ name: 'Rev', column: 0, parts: ['Revenue'] }, { name: 'Cost', column: 0, sits: { on: 'top', of: 0 }, parts: ['Cost of sales'] }] });
    const b = fmGraph.board();
    fmGraph.setScale(b.items[0].id, { min: 0, max: 900 });
    fmGraph.setWide(b.items[2].id, true);
  });
  await page.locator('.slider-widget').first().locator('.slider-fold').click();
  await g(page, () => { fmGraph.addBoard('Other'); fmGraph.showBoard(0); });
  const before = await allBoards(page);
  const ids = await g(page, () => { const b = fmGraph.board(); return { items: b.items.map(w => w.id), sliders: b.sliders.map(s => s.id) }; });
  // The menu: Copy to every board (this one too) and a new one; Move to the others and a new one.
  const send = page.locator('.chart-widget').first().locator('.widget-send');
  await send.click();
  await expect(page.locator('.send-menu .send-head')).toHaveText(['Copy to', 'Move to']);
  await expect(page.locator('.send-menu .send-item')).toHaveText(['Board (this board)', 'Other', 'New board', 'Other', 'New board']);
  await expect(send).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.send-menu .send-item').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.send-menu .send-item').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.send-menu')).toHaveCount(0);
  await expect(send).toHaveAttribute('aria-expanded', 'false');
  await send.click();
  await page.locator('.send-menu .send-item').nth(1).click();
  await expect(page.locator('.send-menu')).toHaveCount(0);
  await expect(page.locator('#notices .note.ok[data-slot="send"]')).toContainText('Copied to "Other".');
  await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true'); // this board stays shown
  await expect(page.locator('#barList > .widget')).toHaveCount(7);
  // The other charts and the folded Price slider by the API; the Profit bar moved.
  for(const id of [ids.items[1], ids.items[4], ids.items[5], ids.items[6]]) await g(page, (i) => fmGraph.copyTo(i, 'Other'), id);
  await g(page, (i) => fmGraph.copyTo(i, 1), ids.sliders[0]);
  const moved = await g(page, (i) => fmGraph.moveTo(i, 'Other'), ids.items[2]);
  expect(ids.items).not.toContain(moved);
  await expect(page.locator('#barList > .widget')).toHaveCount(6);
  const after = await allBoards(page);
  const src = before[0].items;
  expect(after[1].items).toEqual([src[0], src[1], src[4], src[5], src[6], src[2]]);
  expect(after[1].items[0].scale).toEqual({ min: 0, max: 900 });
  expect(after[1].items[5].wide).toBe(true);
  expect(after[1].sliders).toEqual([before[0].sliders[0]]);
  expect(after[1].sliders[0].folded).toBe(true);
  expect(after[0].items).toEqual(src.filter((_, i) => i !== 2));
  expect(after[0].sliders).toEqual(before[0].sliders);
  // Each copy and the move one undo step: the move back in one, everything as before in all seven.
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  const one = await allBoards(page);
  expect(one[0].items).toEqual(src);
  expect(one[1].items).toEqual(after[1].items.slice(0, 5));
  for(let i = 0; i < 6; i++) expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await allBoards(page)).toEqual(before);
  for(let i = 0; i < 7; i++) await g(page, () => fmGraph.redo());
  expect(await allBoards(page)).toEqual(after);
  // A copy on its own board goes just after the original.
  await g(page, () => fmGraph.copyTo(fmGraph.board().items[2].id, 0)); // ids are made anew by undo and redo
  expect((await order(page)).slice(2, 4)).toEqual(['Closing cash', 'Closing cash']);
  // Kept after a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(tabs(page)).toHaveText(['Board', 'Other']);
  await g(page, () => fmGraph.showBoard('Other'));
  await expect(page.locator('#barList > .widget')).toHaveCount(6);
  await expect(page.locator('.slider-widget')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test('⇄ for a slider: a like one already there refused with a note; the position shared, or kept on a board of its own; a new board; a full board', async ({ page, pageErrors }) => {
  await openSample(page);
  await typeSlider(page, 'Price', 14);
  const ids = await g(page, () => fmGraph.board().sliders.map(s => s.id));
  // Copied to its own board: refused, nothing added, nothing to undo.
  await page.locator('.slider-widget').first().locator('.widget-send').click();
  await page.locator('.send-menu .send-item', { hasText: 'Board (this board)' }).click();
  await expect(page.locator('#notices .note.err[data-slot="send"]')).toContainText('"Board" already has this slider.');
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', null]]);
  await expect(page.locator('#btnUndo')).toBeDisabled();
  // A board keeping its own positions: the copy stands where the slider stands now, then on its own.
  await g(page, () => fmGraph.addBoard('Own'));
  await page.locator('#shareSliders').uncheck();
  await g(page, () => fmGraph.showBoard(0));
  await g(page, (i) => fmGraph.copyTo(i, 'Own'), ids[0]);
  expect(await apiError(page, 'copyTo', [ids[0], 'Own'])).toBe('Error: "Own" already has this slider.');
  expect(await apiError(page, 'moveTo', [ids[0], 0])).toBe('Error: It is on "Board" already.');
  expect(await apiError(page, 'copyTo', [ids[0], 'Nowhere'])).toBe('Error: There is no board "Nowhere".');
  expect(await apiError(page, 'copyTo', ['s999', 0])).toBe('Error: There is no bar, chart or slider "s999".');
  await g(page, () => fmGraph.showBoard('Own'));
  expect(await shown(page)).toEqual([['Price', 14]]);
  await typeSlider(page, 'Price', 6);
  await g(page, () => fmGraph.showBoard(0));
  expect(await shown(page)).toEqual([['Price', 14], ['Volume', null]]);
  // A slider of another kind on the same rectangle is another setting: added.
  await g(page, () => fmGraph.showBoard('Own'));
  const shift = await g(page, () => fmGraph.addSlider('Price', { mode: 'shift' }));
  await g(page, (i) => fmGraph.copyTo(i, 0), shift);
  expect(await g(page, () => fmGraph.exportBoards(true).boards[0].sliders.map(s => s.mode))).toEqual(['set', 'shift', 'shift']);
  // Moved to a new board (sharing): it takes the shared position; one undo step takes the board away too.
  await g(page, () => fmGraph.showBoard(0));
  await typeSlider(page, 'Price', 12);
  await g(page, (i) => fmGraph.moveTo(i, 'new'), ids[0]);
  expect(await g(page, () => fmGraph.boards())).toEqual([{ name: 'Board', shown: true }, { name: 'Own', shown: false }, { name: 'Board (2)', shown: false }]);
  expect(await shown(page)).toEqual([['Volume', null], ['Price', null]]);
  await g(page, () => fmGraph.showBoard('Board (2)'));
  expect(await shown(page)).toEqual([['Price', 12]]);
  await g(page, () => fmGraph.undo());
  expect((await g(page, () => fmGraph.boards())).map(b => b.name)).toEqual(['Board', 'Own']);
  // A full board refuses.
  await g(page, () => { fmGraph.showBoard('Own'); for(let i = 0; i < 40; i++) fmGraph.addBar('Profit'); fmGraph.showBoard(0); });
  const bar = await g(page, () => fmGraph.board().bars[0].id);
  expect(await apiError(page, 'copyTo', [bar, 'Own'])).toBe('Error: "Own" has as many bars as a board can hold.');
  expect(pageErrors).toEqual([]);
});

test('⇄ is not on a phone, where the boards are not edited', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url() === 'http://local.test/fmGraph.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(require('path').join(__dirname, '..', 'apps', 'fmGraph.html')) })
    : route.abort());
  await page.goto('http://local.test/fmGraph.html');
  await page.click('#btnSample');
  await expect(page.locator('body.phone')).toHaveCount(1);
  await expect(page.locator('.widget-send')).toHaveCount(6);
  for(const b of await page.locator('.widget-send').all()) await expect(b).toBeHidden();
  await context.close();
});
