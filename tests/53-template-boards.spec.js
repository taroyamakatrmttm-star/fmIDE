// 53. fmGraph boards on templates (step 15, phase G5a; docs/step15-fmgraph.md, docs/file-formats.md).
// - fmGraph: Boards → Export for a template… writes the board file's template form (version 2):
//   a canvas template's board only its canvas's rectangles, by name; a system template's by
//   canvas name and name; what can't be found again by name is left out and counted; a template
//   board can't be imported as a model's board; version 1 files still import.
// - fmIDE: Templates → 📈 Attach fmGraph board… on a canvas or system template (from that file),
//   kept in the workspace, templates file and autosave, carried by Save as new version, Remove;
//   files that don't fit are refused with a message; attachments from files are checked.
// - Packs (v4): the preview's mark and status, and the pack checker's checks of a board against
//   its template.
const fs = require('fs');
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { checkPack } = require('../tools/check-pack');

const FAMILY = 'fam-sales-module-0001';
const SYS_FAMILY = 'fam-plan-system-0001';
// A canvas template "Sales": Price × Volume = Revenue.
const salesTemplate = (attachments) => Object.assign({ name: 'Sales', kind: 'module', group: 'Mine', description: '', family: FAMILY, version: 1, note: '',
  versionId: 'vid-sales-module-0001',
  data: { version: 7, kind: 'module', nodes: [
    { id: 'n1', type: 'value', x: 60, y: 60, w: 170, h: 64, text: 'Price\n10', plugs: [] },
    { id: 'n2', type: 'value', x: 60, y: 180, w: 170, h: 64, text: 'Volume\n5', plugs: [] },
    { id: 'n3', type: 'operator', x: 300, y: 120, w: 56, h: 56, text: '×' },
    { id: 'n4', type: 'value', x: 420, y: 110, w: 170, h: 64, text: 'Revenue', plugs: [] }],
  edges: [{ id: 'e1', from: 'n1', to: 'n3' }, { id: 'e2', from: 'n2', to: 'n3' }, { id: 'e3', from: 'n3', to: 'n4' }] } }, attachments ? { attachments } : {});
// A system template "Plan": canvases Sales (Price, Revenue) and Costs (Cost).
const planTemplate = (attachments) => Object.assign({ name: 'Plan', kind: 'system', group: 'Mine', description: '', family: SYS_FAMILY, version: 1, note: '',
  versionId: 'vid-plan-system-0001',
  data: { version: 9, kind: 'system', periods: ['P1'], canvases: [
    { id: 'c1', name: 'Sales', nodes: [{ id: 'a', type: 'value', x: 0, y: 0, text: 'Price\n10' }, { id: 'b', type: 'value', x: 0, y: 100, text: 'Revenue\n20' }], edges: [] },
    { id: 'c2', name: 'Costs', nodes: [{ id: 'c', type: 'value', x: 0, y: 0, text: 'Cost\n5' }], edges: [] }] } }, attachments ? { attachments } : {});
// Template boards as fmGraph writes them.
const moduleBoard = (extra) => Object.assign({ kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'module', family: FAMILY, name: 'Sales' }, active: 0,
  boards: [{ name: 'Sales board', items: [{ type: 'bar', name: 'Revenue', periods: { mode: 'all' }, wide: false }],
    sliders: [{ name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 0, max: 20, step: 1 }] }] }, extra || {});
const systemBoard = (extra) => Object.assign({ kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'system' }, active: 0,
  boards: [{ name: 'Plan board', items: [{ type: 'chart', wide: true, layout: 'columns', title: 'Both', periods: { mode: 'all' }, check: false,
    groups: [{ name: '', parts: [{ canvas: 'Sales', name: 'Revenue' }, { canvas: 'Costs', name: 'Cost' }] }] }],
    sliders: [{ canvas: 'Sales', name: 'Price', periods: { mode: 'all' }, mode: 'set', min: 0, max: 20, step: 1 }] }] }, extra || {});

const picker = (page) => page.locator('.modal-box.template-box');
async function writeJson(testInfo, name, data){ const p = testInfo.outputPath(name); fs.writeFileSync(p, JSON.stringify(data)); return p; }
async function importTemplates(page, testInfo, templates){
  const p = await writeJson(testInfo, 'templates-' + Math.random().toString(36).slice(2) + '.json', { kind: 'fmIDE-templates', version: 9, templates });
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', p);
  await F.dismissMessage(page);
}
const selectTemplate = (page, name) => picker(page).locator('.template-list button.template-family', { hasText: name }).click();
async function attachBoard(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), picker(page).locator('button.template-attach-graph').click()]);
  await chooser.setFiles(file);
}
async function library(page){ return (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data; }
const attachmentsOf = async (page, name) => (await library(page)).templates.filter(t => t.name === name).map(t => t.attachments || null);

test('fmGraph → fmIDE: a board saved for a canvas template attaches to it, and goes along', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [salesTemplate()]);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('Sales', 'here'); });
  // fmGraph, opened from fmIDE: the canvas made from Sales is offered, then the whole model.
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  expect(await graph.evaluate(() => fmGraph.templates())).toEqual(['Canvas “Revenue Model” — canvas template “Sales”', 'The whole model — for a system template']);
  // Through the dialog.
  await graph.locator('.gbar-menu > summary').click();
  await graph.locator('#btnExportTemplate').click();
  await expect(graph.locator('#templateBox')).toBeVisible();
  await expect(graph.locator('#templateChoices input[type=radio]').first()).toBeChecked();
  const [download] = await Promise.all([graph.waitForEvent('download'), graph.locator('#templateYes').click()]);
  expect(download.suggestedFilename()).toBe('Sales - for a template.board.json');
  const file = testInfo.outputPath('sales.board.json');
  await download.saveAs(file);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(saved).toMatchObject({ kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'module', family: FAMILY, name: 'Sales' } });
  // The starting board: a slider on Price, a bar on Revenue — by name only, no ids.
  expect(saved.boards[0].sliders.map(s => s.name)).toEqual(['Price']);
  expect(saved.boards[0].items.map(i => [i.type, i.name])).toEqual([['bar', 'Revenue']]);
  expect(JSON.stringify(saved)).not.toMatch(/canvasId|nodeId/);
  await expect(graph.locator('.note[data-slot="boards"]')).toContainText('Templates → 📈 Attach fmGraph board…');

  // fmIDE: attach it to Sales.
  await page.evaluate(() => fm.command('openTemplates'));
  await selectTemplate(page, 'Sales');
  await expect(picker(page).locator('.template-attachment')).toContainText('Attach Excel layout'); // the Excel line is still there
  await attachBoard(page, file);
  expect(await F.dialogText(page)).toBe('fmGraph board attached to version 1 of "Sales".');
  await F.dismissMessage(page);
  await expect(picker(page).locator('.template-attachment-graph')).toContainText('An fmGraph board is attached');
  const ws = await library(page);
  expect(ws.templates.find(t => t.name === 'Sales').attachments).toEqual({ graph: Object.assign({}, saved, { family: FAMILY }) });
  const { data: tf } = await F.downloadJson(page, () => picker(page).locator('button', { hasText: '⇩ Export Templates' }).click());
  expect(tf.templates.find(t => t.name === 'Sales').attachments.graph.family).toBe(FAMILY);
  // Kept by the autosave.
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
  expect((await attachmentsOf(page, 'Sales'))[0].graph.boards[0].name).toBe('Board');
});

test('a system template takes a whole-model board; Save as new version carries it; Remove', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [planTemplate(), salesTemplate()]);
  await selectTemplate(page, 'Plan');
  await expect(picker(page).locator('.template-attachment')).toHaveCount(0); // no Excel layout on a system template
  // Files that don't fit say why.
  const tries = [
    [{ kind: 'fmIDE-excel-module-layouts', version: 2, modules: [] }, /isn't an fmGraph board file/],
    [Object.assign(systemBoard(), { version: 3 }), /newer fmGraph/],
    [{ kind: 'fmIDE-graph-board', version: 1, boards: [] }, /for one model, not a template/],
    [moduleBoard(), /saved for a canvas template/],
  ];
  for(const [data, message] of tries){
    await attachBoard(page, await writeJson(testInfo, 'try-' + Math.random().toString(36).slice(2) + '.json', data));
    expect(await F.dialogText(page)).toMatch(message);
    await F.dismissMessage(page);
  }
  expect(await attachmentsOf(page, 'Plan')).toEqual([null]);
  await attachBoard(page, await writeJson(testInfo, 'plan.board.json', systemBoard()));
  expect(await F.dialogText(page)).toBe('fmGraph board attached to version 1 of "Plan".');
  await F.dismissMessage(page);
  expect((await attachmentsOf(page, 'Plan'))[0]).toEqual({ graph: Object.assign(systemBoard(), { family: SYS_FAMILY }) });
  // On Sales, a system board is refused, and one for another canvas template too.
  await selectTemplate(page, 'Sales');
  await attachBoard(page, await writeJson(testInfo, 'sys.json', systemBoard()));
  expect(await F.dialogText(page)).toMatch(/saved for a system template/);
  await F.dismissMessage(page);
  await attachBoard(page, await writeJson(testInfo, 'other.json', moduleBoard({ template: { kind: 'module', family: 'fam-someone-else-01', name: 'Other' } })));
  expect(await F.dialogText(page)).toMatch(/another canvas template/);
  await F.dismissMessage(page);
  // A new version of Plan carries the board; Remove takes it off that version only.
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
  await page.evaluate(() => { fm.insertTemplate('Plan', 'replace'); });
  await page.evaluate(() => fm.command('openTemplates'));
  await selectTemplate(page, 'Plan');
  await picker(page).locator('button.template-save-version').click();
  const form = page.locator('.modal-box.template-form');
  await form.locator('input.template-form-note').fill('second');
  await form.locator('button.primary', { hasText: /^Save version 2$/ }).click();
  expect((await attachmentsOf(page, 'Plan')).map(a => !!(a && a.graph))).toEqual([true, true]);
  await picker(page).locator('.template-graph-remove').click();
  await expect(picker(page).locator('button.template-attach-graph')).toBeVisible();
  expect((await attachmentsOf(page, 'Plan')).map(a => !!(a && a.graph))).toEqual([true, false]);
});

test('boards on templates from a file are checked: another family, the wrong form or kind, too big', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  const templates = [
    salesTemplate({ graph: Object.assign(moduleBoard(), { family: FAMILY }) }),
    Object.assign(salesTemplate({ graph: Object.assign(moduleBoard(), { family: 'fam-someone-else-01' }) }), { name: 'Other family', family: 'fam-other-family-1', versionId: 'vid-other-family-1' }),
    Object.assign(salesTemplate({ graph: Object.assign(moduleBoard(), { family: 'fam-model-form-001', form: undefined }) }), { name: 'Model form', family: 'fam-model-form-001', versionId: 'vid-model-form-001' }),
    Object.assign(salesTemplate({ graph: Object.assign(systemBoard(), { family: 'fam-wrong-kind-001' }) }), { name: 'Wrong kind', family: 'fam-wrong-kind-001', versionId: 'vid-wrong-kind-001' }),
    Object.assign(salesTemplate({ graph: Object.assign(moduleBoard(), { family: 'fam-too-big-00001', big: 'x'.repeat(300 * 1024) }) }), { name: 'Too big', family: 'fam-too-big-00001', versionId: 'vid-too-big-00001' }),
    planTemplate({ graph: Object.assign(systemBoard(), { family: SYS_FAMILY }) }),
  ];
  await importTemplates(page, testInfo, templates);
  const byName = Object.fromEntries((await library(page)).templates.map(t => [t.name, t.attachments ? Object.keys(t.attachments) : null]));
  expect(byName).toEqual({ Sales: ['graph'], 'Other family': null, 'Model form': null, 'Wrong kind': null, 'Too big': null, Plan: ['graph'] });
});

// A pack (version 4) holding Plan with its board.
const planPack = () => ({ kind: 'fmIDE-library-pack', version: 4,
  pack: { id: 'pack-plan-system-01', title: 'Plan', author: 'Ann Example', licence: 'CC-BY-4.0', created: '2026-10-02' },
  templates: [planTemplate({ graph: Object.assign(systemBoard(), { family: SYS_FAMILY }) })], functions: [] });

test('a pack carries a template\'s board: the preview marks it, and offers it for a template you already have', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  const data = planPack();
  await F.importViaCommand(page, 'openLibraryPack', await writeJson(testInfo, 'pack-plan-system-01.fmide-pack.json', data));
  await expect(page.locator('.library-pack-item .library-pack-item-name').first()).toContainText('Plan v1 — system template · 📈 fmGraph board');
  await page.keyboard.press('Escape');
  await page.evaluate((f) => fm.openLibraryPack(f), data);
  expect((await attachmentsOf(page, 'Plan'))[0].graph.family).toBe(SYS_FAMILY);
  // Without its board: offered for the board.
  await page.evaluate(() => fm.command('openTemplates'));
  await selectTemplate(page, 'Plan');
  await picker(page).locator('.template-graph-remove').click();
  const again = await page.evaluate((f) => fm.previewLibraryPack(f), data);
  expect(again.items.map(i => [i.name, i.status, i.statusText])).toEqual([['Plan', 'attachment', 'Already in your library — adds its fmGraph board']]);
  await page.evaluate((f) => fm.openLibraryPack(f), data);
  expect((await attachmentsOf(page, 'Plan'))[0].graph.family).toBe(SYS_FAMILY);
  // Save as Library Pack writes version 4 with it, and the checker passes it.
  const saved = await page.evaluate(() => fm.saveLibraryPack({ title: 'Plan', author: 'Ann Example', templates: ['Plan'], download: false }));
  const pack = typeof saved === 'string' ? JSON.parse(saved) : saved;
  expect(pack.version).toBe(4);
  const r = checkPack(JSON.stringify(pack, null, 2), pack.pack.id + '.fmide-pack.json');
  expect(r.errors).toEqual([]);
  expect(r.notes.map(n => n.message).join('\n')).toContain('It carries an fmGraph board.');
});

test('the pack checker checks a board against its template', () => {
  const check = (change) => { const p = planPack(); change(p); return checkPack(JSON.stringify(p, null, 2), p.pack.id + '.fmide-pack.json'); };
  const errorsOf = (r) => r.errors.map(e => e.message).join('\n');
  const board = (p) => p.templates[0].attachments.graph.boards[0];
  expect(check(() => {}).errors).toEqual([]);
  expect(errorsOf(check(p => { board(p).sliders[0].name = 'Prices'; }))).toMatch(/slider 1 names "Sales" \/ "Prices", which the template doesn't have/);
  expect(errorsOf(check(p => { board(p).items[0].groups[0].parts[1].canvas = 'Nowhere'; }))).toMatch(/item 1, rectangle 2 names "Nowhere" \/ "Cost", which the template doesn't have/);
  expect(errorsOf(check(p => { delete board(p).sliders[0].canvas; }))).toMatch(/slider 1 names no canvas/);
  expect(errorsOf(check(p => { p.templates[0].data.canvases[0].nodes.push({ id: 'd', type: 'value', x: 0, y: 200, text: 'price\n3' }); }))).toMatch(/more than once/);
  expect(errorsOf(check(p => { board(p).items.push({ type: 'pie' }); }))).toMatch(/item 2 isn't a bar or a chart/);
  expect(errorsOf(check(p => { p.templates[0].attachments.graph.boards = []; }))).toMatch(/holds no boards/);
  expect(errorsOf(check(p => { p.templates[0].attachments.graph.form = 'model'; }))).toMatch(/aren't what fmIDE keeps/);
  expect(errorsOf(check(p => { board(p).name = 'Plan' + String.fromCharCode(0x202E); }))).toMatch(/hidden character/);
});

test('fmGraph: a canvas template\'s board keeps its own canvas; names used twice are left out; a template board isn\'t imported', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const model = { kind: 'system', version: 9, periods: ['P1'], canvases: [
    { id: 's', name: 'Sales', template: { family: FAMILY, version: 1, versionId: 'vid-sales-module-0001', name: 'Sales' }, nodes: [
      { id: 'p', type: 'value', x: 0, y: 0, text: 'Price\n10' }, { id: 'v', type: 'value', x: 0, y: 100, text: 'Volume\n5' },
      { id: 'm', type: 'operator', x: 100, y: 50, text: '×' }, { id: 'r', type: 'value', x: 200, y: 50, text: 'Revenue' },
      { id: 'x1', type: 'value', x: 0, y: 200, text: 'Note\n1' }, { id: 'x2', type: 'value', x: 0, y: 300, text: 'note\n2' }],
      edges: [{ id: 'e1', from: 'p', to: 'm' }, { id: 'e2', from: 'v', to: 'm' }, { id: 'e3', from: 'm', to: 'r' }] },
    { id: 'o', name: 'Other', nodes: [{ id: 'q', type: 'value', x: 0, y: 0, text: 'Elsewhere\n3' }], edges: [] }] };
  await page.evaluate((m) => fmGraph.load(m, 'Two canvases'), model);
  await page.evaluate(() => { fmGraph.addBar('Elsewhere'); fmGraph.addBar('#x1', 'all', 's'); fmGraph.addBar('Revenue'); fmGraph.addSlider('Volume'); });
  expect(await page.evaluate(() => fmGraph.templates())).toEqual(['Canvas “Sales” — canvas template “Sales”', 'The whole model — for a system template']);
  const forSales = await page.evaluate(() => fmGraph.exportForTemplate(0));
  expect(forSales.left).toBe(2); // Elsewhere (another canvas) and Note (used twice)
  expect(forSales.data.boards[0].items.map(i => i.name)).toEqual(['Revenue', 'Revenue']);
  expect(forSales.data.boards[0].sliders.map(s => s.name)).toEqual(['Price', 'Volume']);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('2 widgets left out');
  const whole = await page.evaluate(() => fmGraph.exportForTemplate(1, { onlyShown: true }));
  expect(whole.left).toBe(1); // Note, used twice on its canvas
  expect(whole.data.template).toEqual({ kind: 'system' });
  expect(whole.data.boards[0].items.find(i => i.name === 'Elsewhere')).toEqual({ type: 'bar', canvas: 'Other', name: 'Elsewhere', periods: { mode: 'all' }, wide: false });
  // A template board dropped on fmGraph: not taken as a model's board.
  expect(await page.evaluate((d) => fmGraph.importBoards(d), whole.data)).toBe(0);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('saved for a template');
  // A version 1 board file still imports.
  expect(await page.evaluate(() => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 1, boards: [{ name: 'Old', items: [{ type: 'bar', canvasId: 's', nodeId: 'r', name: 'Revenue' }] }] }))).toBe(1);
  // Nothing fits: nothing saved.
  await page.evaluate(() => fmGraph.addBoard('Only elsewhere'));
  await page.evaluate(() => { fmGraph.board().sliders.forEach(s => fmGraph.remove(s.id)); fmGraph.addBar('Elsewhere'); });
  expect(await page.evaluate(() => fmGraph.exportForTemplate(0, { onlyShown: true }))).toBeNull();
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('Nothing on this board fits that template');
});
