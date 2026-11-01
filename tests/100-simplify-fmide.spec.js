// 100. Simplify for inputs… in fmIDE (the window, the copy, the banner, the API; phase 1 of
// docs/simplify-brief.md). The window starts from the boards' sliders, works the model out,
// lists what goes and why, keeps what is ticked, and opens the copy as a new, unsaved document
// that says what it was simplified for (workspace v16, `simplified`); the model it came from is
// not changed. The shared module itself is tested in Node (100-simplify.spec.js).
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

const box = (page) => page.locator('.modal-box.simplify-box').first();
async function openDocument(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(file);
}
async function fmideWith(page, file){
  await F.openFmIDE(page);
  await openDocument(page, file);
  await expect.poll(() => page.evaluate(() => document.title)).toContain(require('path').basename(file).replace(/\.fmide$/, ''));
}
// Units × Price − Costs; Costs = Fixed cost + Overhead; Other, read by nothing.
function profitDoc(testInfo, extra){
  const v = (id, text, x, y) => ({ id, type: 'value', x, y, w: 170, h: 64, text });
  const o = (id, text, x, y) => ({ id, type: 'operator', x, y, w: 56, h: 56, text });
  const e = (from, to, i) => ({ id: 'e' + i, from, to });
  const system = { version: 9, periods: ['P1', 'P2'], canvases: [
    { id: 'c1', name: 'Sales', nodes: [v('units', 'Units\n4', 0, 0), v('price', 'Price\n10', 0, 100), o('m', '×', 200, 50), v('rev', 'Revenue', 300, 50),
      v('fixed', 'Fixed cost\n5', 0, 300), v('over', 'Overhead\n2', 0, 400), o('p', '+', 200, 350), v('costs', 'Costs', 300, 350),
      o('s', '−', 450, 200), v('profit', 'Profit', 600, 200)],
    edges: [['units', 'm'], ['price', 'm'], ['m', 'rev'], ['fixed', 'p'], ['over', 'p'], ['p', 'costs'], ['rev', 's'], ['costs', 's'], ['s', 'profit']].map((x, i) => e(x[0], x[1], i)) },
    { id: 'c2', name: 'Notes', nodes: [v('n1', 'Unrelated\n3', 0, 0)], edges: [] },
  ] };
  const file = testInfo.outputPath('Profit plan.fmide');
  fs.writeFileSync(file, JSON.stringify(Object.assign({ kind: 'fmIDE-workspace', version: 16, system }, extra || {})));
  return file;
}
const UNITS = [{ rectangle: 'Units', canvas: 'Sales', min: 0, max: 10, step: 1 }];

test('the window: the boards\' sliders, Work out, the list, Keep anyway, and the copy opened as a new document', async ({ page }, testInfo) => {
  const graphBoards = { kind: 'fmIDE-graph-board', version: 14, boards: [{ name: 'Board', items: [{ type: 'bar', canvasId: 'c1', nodeId: 'profit' }, { type: 'bar', canvasId: 'c2', nodeId: 'n1' }],
    sliders: [{ canvasId: 'c1', nodeId: 'units', name: 'Units', periods: { mode: 'all' }, mode: 'set', min: 0, max: 10, step: 1 }] }] };
  const file = profitDoc(testInfo, { graphBoards });
  await fmideWith(page, file);
  await page.evaluate(() => fm.command('simplifyForInputs'));
  const b = box(page);
  await expect(b).toBeVisible();
  await expect(b.locator('.window-help')).toBeVisible();
  await expect(b.locator('.sim-input .sim-input-name')).toHaveText(['Units']);
  await expect(b.locator('.sim-open')).toBeDisabled();
  await b.locator('.sim-work').click();
  // Unrelated is shown on the board: it stays as a fixed number, so Notes stays too.
  await expect(b.locator('.sim-summary')).toHaveText(/^Keeps 8 of 11 items on 2 of 2 canvases · 3 fixed numbers · 0 zeros dropped · \d+ runs, [\d.]+ s · checked$/);
  await expect(b.locator('.sim-item', { hasText: 'Fixed cost' })).toContainText(/never moved across \d+ runs/);
  // Keep anyway: the copy is made again at once, and checked again when it is made.
  await b.locator('.sim-keep[data-node="p"]').click(); // the list is drawn again at once
  await expect(b.locator('.sim-summary')).toContainText(/^Keeps 11 of 11 items/);
  await expect(b.locator('.sim-summary')).toContainText('checked again when the copy is made');
  await expect(b.locator('.sim-keep[data-node="p"]')).toBeChecked(); // under Kept anyway, to take back
  await b.locator('.sim-keep[data-node="p"]').click();
  await b.locator('.sim-open').click();
  await expect(b).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.title)).toContain('Profit plan (simplified)');
  expect(await page.evaluate(() => { fm.switchCanvas('Sales'); return fm.nodes().map(n => n.id).sort(); })).toEqual(['costs', 'm', 'price', 'profit', 'rev', 's', 'units']);
  await expect(page.locator('#simplifiedBanner')).toContainText('Simplified from “Profit plan” for Units (0 to 10). Its 3 fixed numbers are right only while the other inputs stay as they were.');
  const record = await page.evaluate(() => fm.simplified());
  expect([record.from, record.kept, record.total, record.inputs.map(x => x.name)]).toEqual(['Profit plan', 8, 11, ['Units']]);
  // Unsaved, saved as workspace 16 with its record and its board; the file it came from is unchanged.
  expect(await page.evaluate(() => document.title)).toContain('•');
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(data.version).toBe(16);
  expect(data.simplified.from).toBe('Profit plan');
  expect(data.graphBoards.boards[0].items.length).toBe(2);
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).simplified).toBeUndefined();
  // What was removed… lists it.
  await page.locator('#simplifiedBanner .simplified-list').click();
  await expect(page.locator('.simplify-record')).toContainText('What was removed');
  await expect(page.locator('.simplify-record .sim-item', { hasText: 'Fixed cost' })).toBeVisible();
});

test('the window takes fmGraph\'s boards as they are now, never the showcase\'s copy of older boards', async ({ page }, testInfo) => {
  const slider = (nodeId, name) => ({ canvasId: 'c1', nodeId, name, periods: { mode: 'all' }, mode: 'set', min: 0, max: 10, step: 1 });
  const graphBoards = { kind: 'fmIDE-graph-board', version: 14, boards: [{ name: 'BS', items: [{ type: 'bar', canvasId: 'c1', nodeId: 'profit' }],
    sliders: [slider('units', 'Units'), slider('price', 'Price'), slider('fixed', 'Fixed cost')] }] };
  // The showcase's boards: what Make Showcase Viewer… copied when it was last run.
  const showcase = { kind: 'fmIDE-showcase', version: 2, title: 'Old viewer',
    boards: { kind: 'fmIDE-graph-board', version: 14, boards: [{ name: 'Viewer', items: [{ type: 'bar', canvasId: 'c1', nodeId: 'profit' }], sliders: [slider('over', 'Overhead')] }] } };
  await fmideWith(page, profitDoc(testInfo, { graphBoards, showcase }));
  await page.evaluate(() => fm.command('simplifyForInputs'));
  const b = box(page);
  await expect(b.locator('.sim-use-sliders')).toHaveText('Use the boards\' sliders (3)');
  await expect(b.locator('.sim-input .sim-input-name')).toHaveText(['Units', 'Price', 'Fixed cost']);
  // The API's sliders are the same.
  await page.keyboard.press('Escape');
  const plan = await page.evaluate(() => fm.simplifyPlan({ sliders: true }));
  expect(plan.removed.map(x => x.name)).not.toContain('Fixed cost');
  expect(plan.fixed.map(x => x.name)).toContain('Overhead');
});

test('a slider on a block\'s input rectangle is named by the rectangle, and Work out finishes', async ({ page }, testInfo) => {
  const v = (id, text, x, y, more) => Object.assign({ id, type: 'value', x, y, w: 170, h: 64, text }, more || {});
  const system = { version: 9, periods: ['P1', 'P2'], canvases: [
    { id: 'c1', name: 'Top', nodes: [{ id: 'b1', type: 'blockInstance', x: 150, y: 0, w: 170, h: 90, blockDefCanvasId: 'd1' }, v('r1', 'Facility', 400, 0)],
      edges: [{ id: 'e1', from: 'b1', to: 'r1', fromPort: 0 }] },
    { id: 'd1', name: 'Loan', nodes: [v('n59185', 'Draw down\n100', 0, 0, { blockRole: 'input' }), v('two', 'Rate\n2', 0, 100),
      { id: 'm', type: 'operator', x: 200, y: 50, w: 56, h: 56, text: '×' }, v('out', 'Out', 300, 50, { blockRole: 'output' })],
      edges: [{ id: 'e2', from: 'n59185', to: 'm' }, { id: 'e3', from: 'two', to: 'm' }, { id: 'e4', from: 'm', to: 'out' }] },
  ] };
  const graphBoards = { kind: 'fmIDE-graph-board', version: 14, boards: [{ name: 'BS', items: [{ type: 'bar', canvasId: 'c1', nodeId: 'r1' }],
    sliders: [{ canvasId: 'd1', nodeId: 'n59185', periods: { mode: 'all' }, mode: 'set', min: 0, max: 200, step: 10 }] }] };
  const file = testInfo.outputPath('Loan plan.fmide');
  fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 16, system, graphBoards }));
  await fmideWith(page, file);
  await page.evaluate(() => fm.command('simplifyForInputs'));
  const b = box(page);
  await expect(b.locator('.sim-input .sim-input-name')).toHaveText(['Draw down']);
  // The picker's list is as it was: a block's input rectangle isn't in it.
  await expect(b.locator('.sim-pick option', { hasText: 'Draw down' })).toHaveCount(0);
  await b.locator('.sim-work').click();
  await expect(b.locator('.sim-summary')).toHaveText(/^Keeps .* · checked$/);
  await expect(b.locator('.sim-open')).toBeEnabled();
});

test('fm.simplifyPlan and fm.simplifyForInputs: the plan, the copy, its numbers, unsaved changes, a download', async ({ page }, testInfo) => {
  await fmideWith(page, profitDoc(testInfo));
  const profitBefore = await page.evaluate(() => { fm.switchCanvas('Sales'); return fm.getValue({ node: 'Profit' }); });
  const plan = await page.evaluate((inputs) => fm.simplifyPlan({ inputs }), UNITS);
  expect([plan.kept, plan.total, plan.canvases.kept, plan.checked.ok]).toEqual([7, 11, 1, true]);
  expect(plan.fixed.map(f => f.name).sort()).toEqual(['Costs', 'Price']);
  expect(plan.removedCanvases.map(c => c.canvas)).toEqual(['Notes']);
  expect(await page.evaluate(() => fm.canvases().length)).toBe(2); // the plan changes nothing
  const made = await page.evaluate((inputs) => fm.simplifyForInputs({ inputs }), UNITS);
  expect([made.name, made.opened]).toEqual(['Profit plan (simplified)', true]);
  expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Sales']);
  expect(await page.evaluate(() => { fm.switchCanvas('Sales'); return fm.getValue({ node: 'Profit' }); })).toBe(profitBefore);
  // The copy has unsaved changes: making another fails unless told to discard them.
  const err = await page.evaluate((inputs) => fm.simplifyForInputs({ inputs }).then(() => 'made', e => e.message), UNITS).catch(e => e.message);
  expect(err).toContain('unsaved changes');
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate((inputs) => fm.simplifyForInputs({ inputs, download: true }), UNITS)]);
  expect(download.suggestedFilename()).toBe('Profit plan (simplified) (simplified).fmide');
  const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect([saved.kind, saved.version, saved.simplified.kept]).toEqual(['fmIDE-workspace', 16, 7]);
});

test('a document\'s record read from a file is checked: text stays text, numbers are numbers, lists are capped', async ({ page }, testInfo) => {
  const simplified = { from: '<img src=x onerror="window.__pwned=1">', made: 5, kept: '7', total: 11, runs: -3,
    inputs: [{ canvasId: 'c1', nodeId: 'units', name: '<b>Units</b>', min: 'a', max: 10, step: 1, periods: { mode: 'one', p: 'x' } }],
    fixed: [{ canvasId: 'c1', nodeId: 'costs', name: 'Costs' }, 'nope'], removed: Array.from({ length: 6000 }, (_, i) => ({ canvasId: 'c1', nodeId: 'n' + i, name: 'N', why: 'never-moved', text: 'x' })) };
  await fmideWith(page, profitDoc(testInfo, { simplified }));
  const banner = page.locator('#simplifiedBanner');
  await expect(banner).toContainText('Simplified from “<img src=x onerror="window.__pwned=1">” for <b>Units</b> (0 to 10).');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  const r = await page.evaluate(() => fm.simplified());
  expect([r.made, r.kept, r.runs, r.inputs[0].min, r.inputs[0].periods, r.fixed.length, r.removed.length]).toEqual(['', 0, 0, 0, { mode: 'all' }, 1, 5000]);
  // New forgets it.
  await page.evaluate(() => fm.command('newDocument'));
  await expect(banner).toHaveCount(0);
});

test('practice refuses it: a tutorial\'s model isn\'t your document', async ({ page }, testInfo) => {
  await fmideWith(page, profitDoc(testInfo));
  await page.keyboard.press('F1');
  await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
  await page.evaluate(() => fm.command('simplifyForInputs'));
  await expect(page.locator('#fmToast')).toContainText('Finish or exit the tutorial first');
  await expect(box(page)).toHaveCount(0);
  await expect(page.evaluate((inputs) => fm.simplifyPlan({ inputs }), UNITS)).rejects.toThrow('Not while practising a tutorial');
});
