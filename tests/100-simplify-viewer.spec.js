// 100. Simplify to the sliders in Make Showcase Viewer… (phase 2 of docs/simplify-brief.md): the
// viewer's model, and the workbook ExcelExporter makes for it, hold only what the chosen boards'
// sliders move — each scenario tried too, the boards' rectangles kept as fixed numbers unless 0 —
// with Keep anyway from the showcase (version 2, `simplify`). The document keeps its whole model
// and the author's choices; the made viewer gives the full model's numbers for what it keeps.
const fs = require('fs');
const zlib = require('zlib');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('../src/shared/showcase.js');
const JSZip = require('jszip');

const maker = (page) => page.locator('.modal-box.showcase-maker');
// Profit = Units × Price − Costs; Costs = Fixed cost + Overhead; Notes: Unrelated. A board with a
// slider on Units (0–10) and a bar on Profit; a scenario "Cheap" setting Price to 5.
function lessonDoc(testInfo, extraItems){
  const v = (id, text, x, y) => ({ id, type: 'value', x, y, w: 170, h: 64, text });
  const o = (id, text, x, y) => ({ id, type: 'operator', x, y, w: 56, h: 56, text });
  const system = { version: 9, periods: ['P1', 'P2'], canvases: [
    { id: 'c1', name: 'Sales', nodes: [v('units', 'Units\n4', 0, 0), v('price', 'Price\n10', 0, 100), o('m', '×', 200, 50), v('rev', 'Revenue', 300, 50),
      v('fixed', 'Fixed cost\n5', 0, 300), v('over', 'Overhead\n2', 0, 400), o('p', '+', 200, 350), v('costs', 'Costs', 300, 350),
      o('s', '−', 450, 200), v('profit', 'Profit', 600, 200)],
    edges: [['units', 'm'], ['price', 'm'], ['m', 'rev'], ['fixed', 'p'], ['over', 'p'], ['p', 'costs'], ['rev', 's'], ['costs', 's'], ['s', 'profit']].map((x, i) => ({ id: 'e' + i, from: x[0], to: x[1] })) },
    { id: 'c2', name: 'Notes', nodes: [v('n1', 'Unrelated\n3', 0, 0)], edges: [] },
  ] };
  const graphBoards = { kind: 'fmIDE-graph-board', version: 14, boards: [{ name: 'Lesson',
    items: [{ type: 'bar', canvasId: 'c1', nodeId: 'profit', name: 'Profit' }].concat(extraItems || []),
    sliders: [{ canvasId: 'c1', nodeId: 'units', name: 'Units', periods: { mode: 'all' }, mode: 'set', min: 0, max: 10, step: 1 }] }],
    scenarios: [{ name: 'Cheap', sliders: [{ canvasId: 'c1', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: 5 }] }] };
  const file = testInfo.outputPath('Lesson one.fmide');
  fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 16, system, graphBoards }));
  return file;
}
async function fmideWith(page, file){
  await F.openFmIDE(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(file);
  await expect.poll(() => page.evaluate(() => fm.canvases().map(c => c.id).join())).toBe('c1,c2');
}
const blockOf = (text, id) => {
  const open = '<script type="application/json" id="' + id + '">';
  const at = text.indexOf(open);
  return text.slice(at + open.length, text.indexOf('</script>', at));
};
const nodesOf = (model) => model.canvases.map(c => c.id + ':' + c.nodes.map(n => n.id).sort().join(','));
async function openMade(browser, testInfo, name, text){
  const file = testInfo.outputPath(name);
  fs.writeFileSync(file, text);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.fmViewer && fmViewer.state().loaded);
  return { context, page };
}

test('the window: Simplify to the sliders, Show what goes… with Keep anyway, and the made viewer holding only what the slider and the scenario move', async ({ page }, testInfo) => {
  await fmideWith(page, lessonDoc(testInfo));
  await page.evaluate(() => fm.command('makeShowcaseViewer'));
  const box = maker(page);
  await expect(box.locator('.sm-simplify')).not.toBeChecked();
  await expect(box.locator('.sm-simplify-list')).toBeDisabled();
  await box.locator('.sm-excel').uncheck();
  await box.locator('.sm-simplify').check();
  await box.locator('.sm-simplify-list').click();
  const keepBox = page.locator('.simplify-keep-box');
  await expect(keepBox).toBeVisible();
  // Units moves Revenue and Profit; the scenario moves Price; Costs is read: a fixed 7.
  await expect(keepBox.locator('.sim-summary')).toContainText('The viewer keeps 7 of 11 items on 1 of 2 canvases');
  await expect(keepBox.locator('.sim-fixed-item', { hasText: 'Costs' })).toBeVisible();
  await keepBox.locator('.sim-keep[data-node="fixed"]').click();
  await expect(keepBox.locator('.sim-summary')).toContainText('The viewer keeps 8 of 11 items');
  await keepBox.locator('.sim-keep-done').click();
  await expect(box.locator('.sm-simplify-note')).toHaveText('The viewer keeps 8 of 11 items on 1 of 2 canvases.');
  const [download] = await Promise.all([page.waitForEvent('download'), box.locator('.sm-make').click()]);
  const text = fs.readFileSync(await download.path(), 'utf8');
  const model = JSON.parse(blockOf(text, 'model'));
  expect(nodesOf(model)).toEqual(['c1:costs,fixed,m,price,profit,rev,s,units']);
  expect(model.canvases[0].nodes.find(n => n.id === 'costs').text).toBe('Costs\n7');
  const shown = JSON.parse(blockOf(text, 'showcase'));
  expect([shown.version, shown.canvases.show, shown.simplify]).toEqual([2, ['c1'], { on: true, keep: [{ canvasId: 'c1', nodeId: 'fixed' }] }]);
  expect(blockOf(text, 'excel')).toBe('');
  await expect(page.locator('#fmToast')).toContainText('Simplified to the sliders, it keeps 8 of 11 items on 1 of 2 canvases.');
  // The document keeps its whole model and the author's choices.
  expect(await page.evaluate(() => fm.canvases().length)).toBe(2);
  expect(await page.evaluate(() => fm.showcase().simplify)).toEqual({ on: true, keep: [{ canvasId: 'c1', nodeId: 'fixed' }] });
  await page.evaluate(() => fm.command('makeShowcaseViewer'));
  await expect(maker(page).locator('.sm-simplify')).toBeChecked();
});

test('fm.makeShowcaseViewer({ simplify }): the viewer gives the full model\'s numbers, sliders and the scenario included; a board with no sliders is refused', async ({ page, browser }, testInfo) => {
  await fmideWith(page, lessonDoc(testInfo, [{ type: 'bar', canvasId: 'c2', nodeId: 'n1', name: 'Unrelated' }]));
  const made = await page.evaluate(() => fm.makeShowcaseViewer({ simplify: true, excel: false }));
  // Unrelated is on the board: it stays as a fixed number, so Notes stays too.
  expect([made.simplified.kept, made.simplified.canvases.kept, made.simplified.checked.ok]).toEqual([8, 2, true]);
  expect(made.showcase.simplify).toEqual({ on: true, keep: [] });
  const v = await openMade(browser, testInfo, made.fileName, made.text);
  const profit = () => v.page.evaluate(() => fmViewer.value('c1', 'profit', 0));
  expect(await profit()).toBe(33);
  await v.page.evaluate(() => fmViewer.setSlider('Units', 10));
  expect(await profit()).toBe(93);
  await v.page.evaluate(() => fmViewer.showScenario('Cheap'));
  expect(await profit()).toBe(13); // 4 × 5 − 7
  expect(await v.page.evaluate(() => fmViewer.canvases().map(c => c.id))).toEqual(['c1', 'c2']);
  await v.context.close();
  // simplify: false makes the whole model again; a board with no sliders can't be simplified.
  const whole = await page.evaluate(() => fm.makeShowcaseViewer({ simplify: false, excel: false }));
  expect(whole.simplified).toBeNull();
  expect(JSON.parse(blockOf(whole.text, 'model')).canvases[0].nodes.length).toBe(10);
  await page.evaluate(() => fm.showcaseChooseForMe());
  await expect(page.evaluate(() => fm.makeShowcaseViewer({ simplify: true, excel: false, boards: [] }))).rejects.toThrow('Simplify to the sliders needs a board with sliders');
});

test('with Excel: ExcelExporter makes the workbook from the simplified model — no Notes tab, no Fixed cost row', async ({ page, context }, testInfo) => {
  await fmideWith(page, lessonDoc(testInfo));
  const popups = [];
  context.on('page', p => popups.push(p));
  const made = await page.evaluate(() => fm.makeShowcaseViewer({ simplify: true, excel: true }));
  expect(made.excel).toBeTruthy();
  const block = S.readViewerWorkbook(JSON.parse(blockOf(made.text, 'excel')));
  expect(block.error).toBeUndefined();
  const bytes = zlib.inflateRawSync(Buffer.from(block.value.workbook, 'base64'));
  const zip = await JSZip.loadAsync(bytes);
  const workbook = await zip.file('xl/workbook.xml').async('string');
  const sheets = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m => m[1]);
  expect(sheets).toContain('Sales');
  expect(sheets).not.toContain('Notes');
  const strings = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
  const sheetXml = (await Promise.all(Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).map(n => zip.file(n).async('string')))).join('');
  expect(strings + sheetXml).toContain('Profit');
  expect(strings + sheetXml).not.toContain('Fixed cost');
  expect(strings + sheetXml).not.toContain('Unrelated');
  // The slider made it to the Dashboard.
  expect(block.value.cells.sliders.length).toBe(1);
  await expect.poll(() => popups.every(p => p.isClosed())).toBe(true);
  // The document's own Excel request is untouched: the whole model.
  expect(await page.evaluate(() => fm.canvases().length)).toBe(2);
});
