// 54. fmGraph using templates' boards (step 15, phase G5b; docs/step15-fmgraph.md).
// - A model with no boards of its own starts with its templates' boards: a canvas template's on
//   each canvas made from it (the version it was made from, else the newest), a system template's
//   when all of it fits; boards of its own (the document's, the browser's) win.
// - Boards ▾ → Add boards from templates… lists them, with what fits, and adds the ticked ones.
// - Boards ▾ → Attach to template… (the model from fmIDE) sends boards to fmIDE, which asks:
//   a canvas template's own, or a system template picked from a list; Cancel says so.
// - Template names are text; a .fmide file's templates count too.
const fs = require('fs');
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');

const FAMILY = 'fam-sales-module-0001';
const SYS_FAMILY = 'fam-plan-system-0001';
const salesData = { version: 7, kind: 'module', nodes: [
  { id: 'n1', type: 'value', x: 60, y: 60, w: 170, h: 64, text: 'Price\n10', plugs: [] },
  { id: 'n2', type: 'value', x: 60, y: 180, w: 170, h: 64, text: 'Volume\n5', plugs: [] },
  { id: 'n3', type: 'operator', x: 300, y: 120, w: 56, h: 56, text: '×' },
  { id: 'n4', type: 'value', x: 420, y: 110, w: 170, h: 64, text: 'Revenue', plugs: [] }],
  edges: [{ id: 'e1', from: 'n1', to: 'n3' }, { id: 'e2', from: 'n2', to: 'n3' }, { id: 'e3', from: 'n3', to: 'n4' }] };
const moduleBoard = (name, extra) => Object.assign({ family: FAMILY, kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'module', family: FAMILY, name: 'Sales' }, active: 0,
  boards: [{ name, items: [{ type: 'bar', name: 'Revenue', periods: { mode: 'all' }, wide: false }],
    sliders: [{ name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 0, max: 20, step: 1 }] }] }, extra || {});
const sales = (version, board, extra) => Object.assign({ name: 'Sales', kind: 'module', group: 'Mine', description: '', family: FAMILY, version, note: '',
  versionId: 'vid-sales-module-000' + version, data: salesData }, board ? { attachments: { graph: board } } : {}, extra || {});

const picker = (page) => page.locator('.modal-box.template-box');
async function writeJson(testInfo, name, data){ const p = testInfo.outputPath(name); fs.writeFileSync(p, JSON.stringify(data)); return p; }
async function importTemplates(page, testInfo, templates){
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', await writeJson(testInfo, 'templates-' + Math.random().toString(36).slice(2) + '.json', { kind: 'fmIDE-templates', version: 10, templates }));
  await F.dismissMessage(page);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
}
async function openGraph(page){
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0 && fmGraph.boards().length > 0);
  return graph;
}
const boardNames = (graph) => graph.evaluate(() => fmGraph.boards().map(b => b.name));
async function openBoardsMenu(graph){ await graph.locator('.gbar-menu > summary').click(); }

test('a model built from a canvas template starts with its board — on each canvas, the version it was made from', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [sales(1, moduleBoard('Sales v1 board')), sales(2, moduleBoard('Sales v2 board'), { note: 'two' })]);
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Sales@1', 'here'); fm.insertTemplate('Sales', 'newCanvas'); });
  await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'East' }));
  const graph = await openGraph(page);
  expect(await boardNames(graph)).toEqual(['Sales v1 board — Revenue Model', 'Sales v2 board — East']);
  expect(await graph.evaluate(() => fmGraph.board().bars.map(b => b.name))).toEqual(['Revenue']);
  expect(await graph.evaluate(() => fmGraph.board().sliders.map(s => s.name))).toEqual(['Price']);
  // Showing them is not a change: nothing is sent to the document.
  await graph.waitForTimeout(700);
  expect((await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data).not.toHaveProperty('graphBoards');
});

test('boards of its own win; Add boards from templates… adds them as tabs, one undo step', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [sales(1, moduleBoard('Sales board'))]);
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Sales', 'here'); });
  let graph = await openGraph(page);
  expect(await boardNames(graph)).toEqual(['Sales board']);
  await graph.evaluate(() => fmGraph.renameBoard('Mine')); // a change: the document now has boards of its own
  await expect.poll(() => D.title(page)).toContain('•');
  await graph.close();
  graph = await openGraph(page);
  expect(await boardNames(graph)).toEqual(['Mine']); // the document's own win
  await openBoardsMenu(graph);
  await graph.locator('#btnAddFromTemplates').click();
  await expect(graph.locator('#fromTemplatesBox')).toBeVisible();
  await expect(graph.locator('#fromTemplatesChoices label')).toHaveText(['“Sales” (canvas template): 1 board, 2 of 2 rectangles found']);
  await expect(graph.locator('#fromTemplatesChoices input')).toBeChecked();
  await graph.locator('#fromTemplatesYes').click();
  expect(await boardNames(graph)).toEqual(['Mine', 'Sales board']);
  await expect(graph.locator('.note[data-slot="boards"]')).toContainText('Added “Sales board”.');
  await expect.poll(async () => (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data.graphBoards.boards.length).toBe(2);
  await graph.click('#btnUndo');
  expect(await boardNames(graph)).toEqual(['Mine']);
});

// A .fmide file with a system template "<b>Plan</b>" carrying a board (Cost named costName).
function planDoc(costName){
  const system = { version: 9, kind: 'system', periods: ['P1'], canvases: [
    { id: 'c1', name: 'Sales', nodes: [{ id: 'a', type: 'value', x: 0, y: 0, text: 'Price\n10' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Revenue\n20' }], edges: [] },
    { id: 'c2', name: 'Costs', nodes: [{ id: 'c', type: 'value', x: 0, y: 0, text: 'Cost\n5' }], edges: [] }] };
  const board = { family: SYS_FAMILY, kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'system' }, active: 0,
    boards: [{ name: 'Plan board', items: [{ type: 'chart', wide: true, layout: 'columns', title: 'Both', periods: { mode: 'all' }, check: false,
      groups: [{ name: '', parts: [{ canvas: 'Sales', name: 'Revenue' }, { canvas: 'Costs', name: costName }] }] }],
      sliders: [{ canvas: 'Sales', name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 0, max: 20, step: 1 }] }] };
  return JSON.stringify({ kind: 'fmIDE-workspace', version: 12, system,
    templates: [{ name: '<b>Plan</b>', kind: 'system', family: SYS_FAMILY, version: 3, versionId: 'vid-plan-system-0003', note: '', data: system, attachments: { graph: board } }] });
}

test('a .fmide file\'s system template: its board, when all of it fits', async ({ page }, testInfo) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.setInputFiles('#fileInput', D.tempFile(testInfo, 'Plan.fmide', planDoc('Cost')));
  await expect(page.locator('#board')).toBeVisible();
  expect(await boardNames(page)).toEqual(['Plan board']);
  expect(await page.evaluate(() => fmGraph.board().charts[0].groups[0].parts.length)).toBe(2);
});

test('a system template\'s board that doesn\'t all fit: not started with, but offered, unticked; its name is text', async ({ page }, testInfo) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.setInputFiles('#fileInput', D.tempFile(testInfo, 'Plan.fmide', planDoc('Costs')));
  await expect(page.locator('#board')).toBeVisible();
  expect(await boardNames(page)).toEqual(['Board']);
  await openBoardsMenu(page);
  await page.locator('#btnAddFromTemplates').click();
  await expect(page.locator('#fromTemplatesChoices label')).toHaveText(['“<b>Plan</b>” (system template, v3): 1 board, 2 of 3 rectangles found']);
  await expect(page.locator('#fromTemplatesChoices input')).not.toBeChecked();
  expect(await page.locator('#fromTemplatesChoices b').count()).toBe(0);
  // Ticked and added: what fits.
  await page.locator('#fromTemplatesChoices input').check();
  await page.locator('#fromTemplatesYes').click();
  expect(await boardNames(page)).toEqual(['Board', 'Plan board']);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('1 rectangle left out');
  // A model whose templates carry no boards: said.
  await page.evaluate(() => fmGraph.load({ kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'x', name: 'X', nodes: [{ id: 'q', type: 'value', x: 0, y: 0, text: 'Q\n1' }], edges: [] }] }, 'Plain'));
  await openBoardsMenu(page);
  await page.locator('#btnAddFromTemplates').click();
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('carry no boards that fit it');
  await expect(page.locator('#fromTemplatesBox')).toBeHidden();
});

test('Attach to template… sends the board to fmIDE, which asks first', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [sales(1, null)]);
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Sales', 'here'); });
  const graph = await openGraph(page);
  await openBoardsMenu(graph);
  await expect(graph.locator('#btnAttachTemplate')).toBeVisible();
  await graph.locator('#btnAttachTemplate').click();
  await expect(graph.locator('#templateTitle')).toHaveText('Attach to a template');
  await graph.locator('#templateYes').click();
  // fmIDE asks; Cancel first.
  const dialog = page.locator('.modal-box').last();
  await expect(dialog).toContainText('Attach this fmGraph board to version 1 of the canvas template "Sales"?');
  await dialog.locator('button', { hasText: 'Cancel' }).click();
  await expect(graph.locator('.note[data-slot="boards"]')).toContainText('Not attached: cancelled in fmIDE.');
  // Again, and Attach.
  await openBoardsMenu(graph);
  await graph.locator('#btnAttachTemplate').click();
  await graph.locator('#templateYes').click();
  await page.locator('.modal-box').last().locator('button', { hasText: /^Attach$/ }).click();
  expect(await F.dialogText(page)).toBe('fmGraph board attached to version 1 of "Sales".');
  await F.dismissMessage(page);
  await expect(graph.locator('.note[data-slot="boards"]')).toContainText('Attached to version 1 of “Sales” in fmIDE.');
  const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
  const att = ws.templates.find(t => t.name === 'Sales').attachments.graph;
  expect(att).toMatchObject({ family: FAMILY, form: 'template', template: { kind: 'module', family: FAMILY } });
  expect(att.boards[0].items.map(i => i.name)).toEqual(['Revenue']);

  // The whole model: no system template yet, so fmIDE says so.
  await openBoardsMenu(graph);
  await graph.locator('#btnAttachTemplate').click();
  await graph.locator('#templateChoices input[type=radio]').last().check();
  await graph.locator('#templateYes').click();
  expect(await F.dialogText(page)).toMatch(/There is no system template in your library/);
  await F.dismissMessage(page);
  await expect(graph.locator('.note[data-slot="boards"]')).toContainText('there is no system template');
});

test('Attach to template… for a system template: picked from a list; hidden without fmIDE', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  const system = (name, family) => ({ name, kind: 'system', group: 'Mine', description: '', family, version: 1, note: '', versionId: 'vid-' + family,
    data: { version: 9, kind: 'system', periods: ['Period 1'], canvases: [{ id: 'c1', name: 'Canvas 1', nodes: [], edges: [] }] } });
  await importTemplates(page, testInfo, [system('Plan A', 'fam-plan-a-system-01'), system('Plan B', 'fam-plan-b-system-01')]);
  await page.evaluate(() => { fm.clearCanvas(); fm.createRect({ name: 'Hours', value: 8, x: 40, y: 40 }); fm.createRect({ name: 'Pay', x: 300, y: 40 }); });
  const graph = await openGraph(page);
  await graph.evaluate(() => fmGraph.addBar('Pay'));
  await openBoardsMenu(graph);
  await graph.locator('#btnAttachTemplate').click();
  await expect(graph.locator('#templateChoices label')).toHaveText(['The whole model — for a system template']);
  await graph.locator('#templateYes').click();
  const dialog = page.locator('.modal-box.graph-attach-box');
  await expect(dialog).toContainText('Attach this fmGraph board to which system template?');
  await dialog.locator('select').selectOption({ label: 'Plan B (version 1)' });
  await dialog.locator('button', { hasText: /^Attach$/ }).click();
  expect(await F.dialogText(page)).toBe('fmGraph board attached to version 1 of "Plan B".');
  await F.dismissMessage(page);
  const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
  expect(ws.templates.filter(t => t.attachments).map(t => t.name)).toEqual(['Plan B']);
  expect(ws.templates.find(t => t.name === 'Plan B').attachments.graph.boards[0].items.map(i => [i.canvas, i.name])).toContainEqual(['Revenue Model', 'Pay']);

  // fmGraph on its own: no Attach to template….
  const alone = await page.context().newPage();
  await openApp(alone, 'fmGraph');
  await alone.waitForFunction(() => !!window.fmGraph);
  await alone.click('#btnSample');
  await expect(alone.locator('#board')).toBeVisible();
  await expect(alone.locator('#btnAttachTemplate')).toBeHidden();
  await alone.close();
});
