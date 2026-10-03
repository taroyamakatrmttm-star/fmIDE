// 50. fmGraph's boards inside fmIDE's documents (step 15, phase G3b; docs/step15-fmgraph.md).
// - A change to the boards in fmGraph, opened from fmIDE, goes back to fmIDE: the document has
//   unsaved changes and Save (and the autosave) keeps the boards (workspace v11, graphBoards);
//   undo in fmGraph goes back too; a slider moved or another board shown does not.
// - A document's boards win over the ones fmGraph keeps in the browser for the model; a
//   document without boards shows the browser's. fmGraph opening a .fmide file uses its boards.
// - fmIDE keeps the boards as they came but drops anything that isn't a board file, plain data,
//   at most 16 deep and 1 MB; a message from another window, or one during a tutorial, is ignored.
// - New, a system file and Import Workspace; ExcelExporter opens a document with boards.
const { test, expect, readFixture, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');
const E = require('./helpers/excel');

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept()); // "Leave site?" on reloads with unsaved changes
});

// The sample system (Unit Price × Volume = Revenue) and a board file for it.
function system(){ return readFixture('formats', 'sys-current.json'); }
function boardFile(name, extra = {}){
  return Object.assign({ kind: 'fmIDE-graph-board', version: 1, active: 0, boards: [{ name, items: [
    { type: 'bar', canvasId: 'c1', nodeId: 'n22', name: 'Revenue', periods: { mode: 'all' }, wide: false },
  ], sliders: [
    { canvasId: 'c1', nodeId: 'n19', name: 'Unit Price', periods: { mode: 'all' }, mode: 'set', min: 0, max: 20, step: 1 },
  ] }] }, extra);
}
function documentText(graphBoards){
  return JSON.stringify(Object.assign({ kind: 'fmIDE-workspace', version: 11, system: system() }, graphBoards === undefined ? {} : { graphBoards }));
}
async function openDocument(page, testInfo, name, text){
  await D.openViaInput(page, 'openDocument', D.tempFile(testInfo, name, text));
  await expect.poll(() => D.title(page)).toBe(name.replace(/\.fmide$/, '') + ' — fmIDE');
}
async function exported(page){
  return (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
}
async function openGraphFromFmide(page){
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await popup.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0 && fmGraph.boards().length > 0);
  return popup;
}
const boardNames = (popup) => popup.evaluate(() => fmGraph.boards().map(b => b.name));

test('a change in fmGraph goes back to the document: unsaved, then saved with it; undo too; sliders and tabs do not', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await openDocument(page, testInfo, 'Plan.fmide', documentText(boardFile('Prices')));
  const popup = await openGraphFromFmide(page);
  expect(await boardNames(popup)).toEqual(['Prices']);
  // Moving a slider and showing another board are not changes to the document.
  const slider = await popup.evaluate(() => fmGraph.board().sliders[0].id);
  await popup.evaluate((id) => fmGraph.setSlider(id, 15), slider);
  expect(await popup.evaluate(() => fmGraph.value('Revenue', 1))).toBe(75);
  await popup.waitForTimeout(700);
  expect(await D.title(page)).toBe('Plan — fmIDE');
  // Adding a board is: the document has unsaved changes, and holds the boards.
  await popup.evaluate(() => fmGraph.addBoard('Volumes'));
  await expect.poll(() => D.title(page)).toBe('Plan • — fmIDE');
  let data = await exported(page);
  expect(data.version).toBe(12);
  expect(data.graphBoards.kind).toBe('fmIDE-graph-board');
  expect(data.graphBoards.boards.map(b => b.name)).toEqual(['Prices', 'Volumes']);
  // Showing the first board again sends nothing.
  await popup.evaluate(() => fmGraph.showBoard(0));
  // Undo in fmGraph goes back as well.
  await popup.evaluate(() => fmGraph.undo());
  await expect.poll(async () => (await exported(page)).graphBoards.boards.map(b => b.name)).toEqual(['Prices']);
  // Save writes the boards into the .fmide file; the slider's position is never in it.
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => fm.command('saveDocument'))]);
  const saved = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(saved.graphBoards.boards).toHaveLength(1);
  expect(saved.graphBoards.boards[0].sliders[0]).not.toHaveProperty('value');
  expect(JSON.stringify(saved.graphBoards)).not.toContain('15');
  await expect.poll(() => D.title(page)).toBe('Plan — fmIDE');
  // The autosave keeps them: after a reload, Open fmGraph shows them again.
  await popup.close();
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
  const again = await openGraphFromFmide(page);
  expect(await boardNames(again)).toEqual(['Prices']);
});

test('a document\'s boards win over the browser\'s; a document without boards shows the browser\'s', async ({ page, context }, testInfo) => {
  // fmGraph on its own, with the same model: a board kept in this browser.
  const own = await context.newPage();
  await openApp(own, 'fmGraph');
  await own.waitForFunction(() => !!window.fmGraph);
  await own.evaluate((s) => fmGraph.load(s, 'Plan'), system());
  await own.evaluate(() => fmGraph.renameBoard('From the browser'));
  await own.waitForTimeout(500); // kept shortly after the change
  await own.close();

  await F.openFmIDE(page);
  await openDocument(page, testInfo, 'With boards.fmide', documentText(boardFile('From the document')));
  let popup = await openGraphFromFmide(page);
  expect(await boardNames(popup)).toEqual(['From the document']);
  expect(await popup.evaluate(() => fmGraph.board().bars.map(b => b.name))).toEqual(['Revenue']);
  expect(await D.title(page)).toBe('With boards — fmIDE'); // showing them changes nothing
  await popup.close();

  // A document without boards: the browser's — and now that the document's were shown, the
  // browser keeps those for the model.
  await page.evaluate(() => fm.command('newDocument'));
  await openDocument(page, testInfo, 'Without.fmide', documentText());
  popup = await openGraphFromFmide(page);
  expect(await boardNames(popup)).toEqual(['From the document']);
  expect(await D.title(page)).toBe('Without — fmIDE');
  // A document whose boards hold nothing for this model: the browser's.
  await popup.close();
  await openDocument(page, testInfo, 'Other.fmide', documentText({ kind: 'fmIDE-graph-board', version: 1, boards: [{ name: 'Elsewhere', items: [
    { type: 'bar', canvasId: 'zz', nodeId: 'q', name: 'Nothing here' }] }] }));
  popup = await openGraphFromFmide(page);
  expect(await boardNames(popup)).toEqual(['From the document']);
});

test('fmGraph opening a .fmide file shows its boards; a system file and New carry none', async ({ page }, testInfo) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.setInputFiles('#fileInput', D.tempFile(testInfo, 'Plan.fmide', documentText(boardFile('In the file'))));
  await expect(page.locator('#board')).toBeVisible();
  expect(await boardNames(page)).toEqual(['In the file']);
  await expect(page.locator('#boardTabs')).toContainText('In the file');

  // fmIDE: a system file opened as a document, and New, have no boards.
  const fmide = await page.context().newPage();
  fmide.on('dialog', d => d.accept());
  await F.openFmIDE(fmide);
  await openDocument(fmide, testInfo, 'Plan.fmide', documentText(boardFile('Kept')));
  expect((await exported(fmide)).graphBoards.boards[0].name).toBe('Kept');
  await D.openViaInput(fmide, 'openDocument', D.tempFile(testInfo, 'System.json', JSON.stringify(system())));
  await expect.poll(() => D.title(fmide)).toBe('System — fmIDE');
  expect(await exported(fmide)).not.toHaveProperty('graphBoards');
  await openDocument(fmide, testInfo, 'Plan.fmide', documentText(boardFile('Kept')));
  await fmide.evaluate(() => fm.command('newDocument'));
  await expect.poll(() => D.title(fmide)).toBe('Untitled — fmIDE');
  expect(await exported(fmide)).not.toHaveProperty('graphBoards');
  // Import Workspace brings its model's boards.
  await F.importViaCommand(fmide, 'importWorkspace', D.tempFile(testInfo, 'ws.json', documentText(boardFile('Imported'))));
  await F.acceptAll(fmide);
  expect((await exported(fmide)).graphBoards.boards[0].name).toBe('Imported');
});

test('fmIDE keeps boards as they came, and drops what is not a plain board file within the limits', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  // Kept as it came, also what fmIDE doesn't know (fmGraph reads it with its own checks).
  const odd = boardFile('<img src=x onerror=alert(1)>', { later: { note: 'from a newer fmGraph' } });
  await openDocument(page, testInfo, 'Odd.fmide', documentText(odd));
  expect((await exported(page)).graphBoards).toEqual(odd);
  const popup = await openGraphFromFmide(page);
  await expect(popup.locator('#boardTabs')).toContainText('<img src=x onerror=alert(1)>');
  expect(await popup.locator('#boardTabs img').count()).toBe(0);
  await popup.close();

  let deep = 'bottom';
  for(let i = 0; i < 20; i++) deep = { d: deep };
  const big = boardFile('Big'); big.boards[0].padding = 'x'.repeat(1024 * 1024);
  for(const [name, bad] of [
    ['wrong kind', { kind: 'fmIDE-workspace', boards: [] }],
    ['not an object', 'fmIDE-graph-board'],
    ['a list', [boardFile('List')]],
    ['too deep', boardFile('Deep', { deep })],
    ['too big', big],
  ]){
    await openDocument(page, testInfo, 'Bad.fmide', documentText(bad));
    expect(await exported(page), name).not.toHaveProperty('graphBoards');
  }
});

test('boards from another window, or sent during a tutorial, are ignored', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await openDocument(page, testInfo, 'Plan.fmide', documentText(boardFile('Mine')));
  const popup = await openGraphFromFmide(page);
  // A window fmIDE didn't open for fmGraph.
  await page.evaluate((text) => new Promise(resolve => {
    const w = window.open('', 'other');
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'fmGraph:boards', text }, source: w, origin: location.origin }));
    setTimeout(() => { w.close(); resolve(); }, 300);
  }), JSON.stringify(boardFile('Forged')));
  expect(await D.title(page)).toBe('Plan — fmIDE');
  expect((await exported(page)).graphBoards.boards[0].name).toBe('Mine');
  // fmGraph's window itself, sending something that isn't a board file: ignored.
  await popup.evaluate(() => window.opener.postMessage({ type: 'fmGraph:boards', text: '{"kind":"other"}' }, '*'));
  await popup.evaluate(() => window.opener.postMessage({ type: 'fmGraph:boards', text: 'not json' }, '*'));
  await page.waitForTimeout(300);
  expect(await D.title(page)).toBe('Plan — fmIDE');
  // During a tutorial: fmGraph's changes don't reach the document.
  await page.evaluate(() => fm.command('openHelp'));
  await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
  await expect(page.locator('#tutorialCard')).toBeVisible();
  await popup.evaluate(() => fmGraph.addBoard('While practising'));
  await page.waitForTimeout(700);
  await page.locator('#tutorialCard .tutorial-exit').click();
  await expect(page.locator('#tutorialCard')).toHaveCount(0);
  expect(await D.title(page)).toBe('Plan — fmIDE');
  expect((await exported(page)).graphBoards.boards.map(b => b.name)).toEqual(['Mine']);
});

test('ExcelExporter opens a document with fmGraph\'s boards', async ({ page }, testInfo) => {
  await E.openExporter(page);
  await E.loadModelFile(page, D.tempFile(testInfo, 'Plan.json', documentText(boardFile('Prices'))));
  await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
  await expect(page.locator('#afterLoad')).toBeVisible();
  await expect(page.locator('#btnGenerate')).toBeEnabled();
});
