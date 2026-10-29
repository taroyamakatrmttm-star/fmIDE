// 97. Making many showcase viewers at once (phase V5 of docs/viewer-brief.md), in Node: the
// batch's own work (tools/viewer-batch.js) and the shared placing and choosing
// (src/shared/showcase-boards.js). The viewer's page is a stand-in here (a page with the three
// empty data blocks), so nothing an app does is needed and nothing an app's change can alter is
// checked: the made files opened in a browser, with the real page and ExcelExporter's
// workbooks, are group 96's (the command end to end).
// Samples: tests/fixtures/viewer/batch/ — three shop models built alike (shop-c names Volume
// "Units"; shop-b keeps its own showcase and boards with a scenario), a model with no input, a
// model with markup in its names, and a recipe.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { test, expect } = require('@playwright/test');
const B = require('../tools/viewer-batch.js');
const S = require('../src/shared/showcase.js');
const SB = require('../src/shared/showcase-boards.js');

const DIR = path.join(__dirname, 'fixtures', 'viewer', 'batch');
const sample = (name) => ({ fileName: name, text: fs.readFileSync(path.join(DIR, name), 'utf8') });
const RECIPE = B.readRecipeText(fs.readFileSync(path.join(DIR, 'shops.recipe.json'), 'utf8')).recipe;
// The stand-in for the viewer's page: its three empty data blocks and a script of its own.
const END = '<' + '/script>';
const PAGE = '<!doctype html><title>stand-in</title><script>var standIn = 1;' + END + '\n'
  + S.VIEWER_BLOCKS.showcase + '\n' + S.VIEWER_BLOCKS.model + '\n' + S.VIEWER_BLOCKS.excel + '\n';
const run = (models, opts) => B.makeViewers(models.map(sample), Object.assign({ viewerPage: PAGE, excel: false }, opts));
const blocks = (v) => S.madeViewerBlocks(v.text).blocks;
const showcaseOf = (v) => JSON.parse(blocks(v).showcase);
const entryOf = (r, file) => r.report.viewers.find(e => e.file === file);
const sliderNames = (file) => file.boards.flatMap(b => b.sliders.map(s => s.name));
const barNames = (file) => file.boards.flatMap(b => b.items.filter(w => w.type === 'bar').map(w => w.name));

test('a recipe placed by name in each model: its canvases, sliders, bars and chart, title, periods, Excel name, ids made unique', async () => {
  const r = await run(['shop-a.fmide', 'shop-b.fmide', 'shop-c.fmide'], { recipe: RECIPE });
  expect(r.report.made).toBe(3);
  const [a, b, c] = r.viewers;
  const sa = showcaseOf(a);
  expect(sa.title).toBe('shop-a: the shop');
  expect(a.id).toBe('shop-a-the-shop');
  expect(sa.canvases).toEqual({ show: ['cShop', 'cSum'], start: 'cShop' });
  expect(sa.periods).toEqual({ mode: 'range', from: 0, to: 2 });
  // Board file 9 with no bar keeping its own periods: the recipe's periods are what every bar shows.
  expect(sa.boards.version).toBe(9);
  expect(sa.boards.boards[0].items.some(w => 'ownPeriod' in w)).toBe(false);
  expect(sa.description).toBe('Move the price and watch the profit.');
  expect(sliderNames(sa.boards)).toEqual(['Price', 'Volume']);
  expect(barNames(sa.boards)).toEqual(['Profit', 'Margin']); // Margin named without its canvas: unique in the model
  const chart = sa.boards.boards[0].items.find(w => w.type === 'chart');
  expect(chart.groups[0].parts.map(p => [p.canvasId, p.nodeId, p.name])).toEqual([['cShop', 'rev', 'Revenue'], ['cShop', 'cogs', 'Costs']]);
  expect(sa.boards.boards[0].sliders[0]).toMatchObject({ canvasId: 'cShop', nodeId: 'price', mode: 'set', min: 5, max: 15, step: 0.5 });
  // shop-b's own ids (c1, c2) found by the same names; its own scenario comes along.
  const sb = showcaseOf(b);
  expect(sb.canvases.show).toEqual(['c1', 'c2']);
  expect(sb.boards.boards[0].sliders[0].canvasId).toBe('c1');
  expect(sb.boards.scenarios.map(s => s.name)).toEqual(['Busy']);
  // The model block is the model itself (its system), with nothing else of the document.
  expect(JSON.parse(blocks(a).model).canvases.map(x => x.id)).toEqual(['cShop', 'cSum']);
  // shop-c calls Volume "Units": not found, said, left out.
  expect(sliderNames(showcaseOf(c).boards)).toEqual(['Price']);
  expect(entryOf(r, 'shop-c.fmide').notFound).toEqual([{ name: 'Volume', canvas: 'Shop' }]);
  expect(entryOf(r, 'shop-a.fmide').canvasesNotFound).toEqual(['Nowhere']);
  expect(entryOf(r, 'shop-a.fmide').source).toBe('recipe');
  // Two models with the same title: the second's id gets a number.
  const twice = await B.makeViewers([sample('shop-a.fmide'), Object.assign(sample('shop-a.fmide'), { fileName: 'copy/shop-a.fmide' })], { recipe: RECIPE, viewerPage: PAGE, excel: false });
  expect(twice.viewers.map(v => v.fileName)).toEqual(['shop-a-the-shop.html', 'shop-a-the-shop-2.html']);
});

test('without a recipe: the document\'s own showcase, else its boards, else auto when asked, else the logic only', async () => {
  const plain = await run(['shop-a.fmide', 'shop-b.fmide', 'no-inputs.json'], {});
  expect(plain.report.viewers.map(e => e.source)).toEqual(['logic', 'showcase', 'logic']);
  const own = showcaseOf(plain.viewers[1]);
  expect(own.title).toBe('Shop B, its own showcase');
  expect(plain.viewers[1].id).toBe('shop-b-own');
  expect(own.play).toEqual({ from: 'Base', to: 'Busy' });
  expect(entryOf(plain, 'shop-a.fmide').notes.join(' ')).toMatch(/logic only/);
  const auto = await run(['shop-a.fmide', 'no-inputs.json'], { auto: true });
  expect(auto.report.viewers.map(e => e.source)).toEqual(['auto', 'logic']);
  expect(showcaseOf(auto.viewers[0]).boards.boards[0].name).toBe('Chosen for me');
  // A document with boards and no showcase shows its boards.
  const boards = await B.makeViewers([{ fileName: 'every-widget.fmide', text: fs.readFileSync(path.join(__dirname, 'fixtures', 'viewer', 'every-widget.fmide'), 'utf8') }], { viewerPage: PAGE, excel: false });
  expect(boards.report.viewers[0].source).toBe('boards');
  // A recipe naming nothing a model has: its auto chooses for it.
  const none = await run(['no-inputs.json'], { recipe: Object.assign({}, RECIPE, { auto: null }) });
  expect(entryOf(none, 'no-inputs.json').source).toBe('logic');
});

test('auto: sliders on inputs that move something (set or shift), bars on results, at most 12, the fallback', () => {
  const shop = JSON.parse(sample('shop-a.fmide').text).system;
  const r = SB.autoShowcaseBoards(shop, { sliders: 'inputs', bars: 'outputs', range: 50 });
  expect(r.sliders).toEqual([
    { name: 'Price', canvas: 'Shop', mode: 'set', min: 5, max: 15, step: 0.1 },
    { name: 'Volume', canvas: 'Shop', mode: 'shift', min: -50, max: 50, step: 1 }, // its periods differ: a shift keeps their shape
    { name: 'Unit cost', canvas: 'Shop', mode: 'set', min: 3, max: 9, step: 0.1 }]);
  expect(r.bars).toEqual([{ name: 'Margin', canvas: 'Summary' }]); // Profit and Revenue are read by Summary
  expect(r.file.version).toBe(SB.SB_BOARD_VERSION);
  // A range of 20 %, and the model's own number always a step.
  const narrow = SB.autoShowcaseBoards(shop, { sliders: 'inputs', range: 20 });
  for(const s of narrow.sliders.filter(x => x.mode === 'set')){
    const own = s.name === 'Price' ? 10 : 6;
    expect(Math.abs((own - s.min) / s.step - Math.round((own - s.min) / s.step))).toBeLessThan(1e-9);
    expect(s.min).toBeCloseTo(own * 0.8, 9);
  }
  // 15 inputs, 0 among them: 12 sliders, the 0 one from −10 to 10; and an input that moves nothing gets none.
  const nodes = [], edges = [];
  for(let i = 0; i < 15; i++){
    nodes.push({ id: 'i' + i, type: 'value', x: 0, y: i * 80, w: 150, h: 64, text: 'In ' + i + '\n' + i }, { id: 'o' + i, type: 'operator', x: 180, y: i * 80, text: '+' }, { id: 'r' + i, type: 'value', x: 250, y: i * 80, w: 150, h: 64, text: 'Out ' + i });
    edges.push({ id: 'a' + i, from: 'i' + i, to: 'o' + i }, { id: 'b' + i, from: 'o' + i, to: 'r' + i });
  }
  nodes.push({ id: 'lone', type: 'value', x: 0, y: -100, w: 150, h: 64, text: 'Alone\n3' });
  const many = SB.autoShowcaseBoards({ kind: 'system', version: 9, periods: ['1', '2'], canvases: [{ id: 'c', name: 'Many', nodes, edges }] }, { sliders: 'inputs', bars: 'outputs' });
  expect(many.sliders.length).toBe(12);
  expect(many.sliders[0]).toEqual({ name: 'In 0', canvas: 'Many', mode: 'set', min: -10, max: 10, step: 0.2 });
  expect(many.sliders.map(s => s.name)).not.toContain('Alone');
  expect(many.bars.length).toBe(12);
  expect(many.notes).toEqual(['Only the first 12 inputs got a slider.', 'Only the first 12 results got a bar.']);
  // Every calculated rectangle read by another (here through an alias): the last one the first slider reaches.
  const loop = { kind: 'system', version: 9, periods: ['1'], canvases: [
    { id: 'c1', name: 'One', nodes: [{ id: 'x', type: 'value', x: 0, y: 0, w: 150, h: 64, text: 'X\n2' }, { id: 'op', type: 'operator', x: 180, y: 0, text: '×' },
      { id: 'y', type: 'value', x: 250, y: 0, w: 150, h: 64, text: 'Y' }], edges: [{ id: 'e1', from: 'x', to: 'op' }, { id: 'e2', from: 'x', to: 'op' }, { id: 'e3', from: 'op', to: 'y' }] },
    { id: 'c2', name: 'Two', nodes: [{ id: 'al', type: 'alias', x: 0, y: 0, w: 150, h: 64, sourceCanvasId: 'c1', sourceNodeId: 'y' }], edges: [] }] };
  const fb = SB.autoShowcaseBoards(loop, { sliders: 'inputs', bars: 'outputs' });
  expect(fb.bars).toEqual([{ name: 'Y', canvas: 'One' }]);
  expect(fb.notes.join(' ')).toMatch(/last one the first slider reaches/);
  // Nothing to choose.
  expect(SB.autoShowcaseBoards(JSON.parse(sample('no-inputs.json').text), { sliders: 'inputs', bars: 'outputs' }).file).toBeNull();
});

test('placing the template form: a system template by canvas and name, a canvas template on each canvas made from it, names used twice not found', () => {
  const sys = JSON.parse(sample('shop-a.fmide').text).system;
  const fam = 'family-0001';
  const twoCopies = JSON.parse(JSON.stringify(sys));
  twoCopies.canvases[0].template = { family: fam, name: 'Shop' };
  const copy = JSON.parse(JSON.stringify(twoCopies.canvases[0]));
  copy.id = 'cShop2'; copy.name = 'Second shop';
  twoCopies.canvases.push(copy);
  const board = { name: 'B', items: [{ type: 'bar', name: 'Profit' }], sliders: [{ name: 'Price', mode: 'set', min: 1, max: 20, step: 1 }] };
  const placed = SB.placeRecipeBoards({ kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'module', family: fam }, boards: [board] }, twoCopies, null);
  expect(placed.file.boards.map(b => b.name)).toEqual(['B — Shop', 'B — Second shop']);
  expect(placed.file.boards.map(b => b.items[0].canvasId)).toEqual(['cShop', 'cShop2']);
  expect(placed.missing).toEqual([]);
  // A system template: the canvas by name; a name used on two canvases needs its canvas.
  const sysPlaced = SB.placeRecipeBoards({ kind: 'fmIDE-graph-board', version: 2, form: 'template', template: { kind: 'system' }, boards: [board] }, twoCopies, null);
  expect(sysPlaced.file).toBeNull();
  expect(sysPlaced.missing).toEqual([{ name: 'Profit', canvas: '' }, { name: 'Price', canvas: '' }]);
  // The same rule as fmGraph's own template boards (06d-template-sources.js): no canvas name, no match there.
  const rects = SB.sbModelRects(twoCopies).rects;
  expect(SB.sbTemplatePlaces('system', null, rects, new Map())[0].find({ name: 'Margin' })).toBeNull();
  expect(SB.sbTemplatePlaces('system', null, rects, new Map(), { anyCanvas: true })[0].find({ name: 'Margin' })).toEqual({ canvasId: 'cSum', nodeId: 'margin', name: 'Margin' });
  expect(SB.sbTemplatePlaces('system', null, rects, new Map())[0].find({ canvas: 'second SHOP ', name: ' price' })).toEqual({ canvasId: 'cShop2', nodeId: 'price', name: 'Price' });
  // The layouts the template form never carries are left out.
  const at = (ref) => Object.assign({}, ref, { canvasId: 'c', nodeId: 'n' });
  expect(SB.sbPlaceTemplateBoard({ items: [{ type: 'chart', layout: 'tornado' }, { type: 'chart', layout: 'flow', steps: [{ name: 'a' }] }] }, at).items)
    .toEqual([null, { type: 'chart', layout: 'flow', steps: [{ name: 'a', canvasId: 'c', nodeId: 'n' }] }]);
});

test('markup in names stays text: the data blocks hold no "<" of their own, and a model that fails doesn\'t stop the others', async () => {
  const r = await B.makeViewers([sample('hostile.fmide'), { fileName: 'broken.fmide', text: '{ not json' }, sample('shop-a.fmide')], { recipe: Object.assign({}, RECIPE, { title: '{model} </script><b>' }), viewerPage: PAGE, excel: false });
  expect(r.report.made).toBe(2);
  expect(showcaseOf(r.viewers[0]).title).toBe('hostile </script><b>');
  expect(r.viewers[0].id).toBe('hostile-script-b');
  expect(r.report.failed).toBe(1);
  expect(entryOf(r, 'broken.fmide').error).toMatch(/JSON/);
  const v = r.viewers[0];
  for(const id of ['showcase', 'model']) expect(blocks(v)[id]).not.toContain('<');
  const model = JSON.parse(blocks(v).model);
  expect(model.canvases[0].name).toBe('<img src=x onerror=alert(1)>');
  expect(model.canvases[0].nodes[0].text).toBe('<script>alert(1)</script>\n10');
  // Only the stand-in's own script is a script the page runs.
  expect(v.text.match(/<script>/g)).toHaveLength(1);
  // The report names its canvas, not found by the recipe, as text.
  expect(entryOf(r, 'hostile.fmide').canvasesNotFound).toEqual(['Shop', 'Nowhere']);
  expect(B.reportText(r.report)).toContain('FAILED: ');
});

test('the made page read back: its blocks found once each, crafted pages refused', () => {
  const filled = S.fillViewerPage(PAGE, { kind: 'fmIDE-showcase', version: 1, title: 'T' }, { kind: 'system', version: 9, canvases: [] }).page;
  expect(S.madeViewerBlocks(filled).blocks).toEqual({ showcase: '{"kind":"fmIDE-showcase","version":1,"title":"T"}', model: '{"kind":"system","version":9,"canvases":[]}', excel: '' });
  expect(S.madeViewerBlocks(PAGE).error).toMatch(/no model/);
  expect(S.madeViewerBlocks('<p>hello</p>').error).toMatch(/isn't a viewer/);
  const twice = filled + S.VIEWER_BLOCKS.model.replace('><', '>{}<');
  expect(S.madeViewerBlocks(twice).error).toMatch(/isn't a viewer/);
  const raw = filled.replace('"title":"T"', '"title":"<b>T"');
  expect(S.madeViewerBlocks(raw).error).toMatch(/isn't a viewer/);
  // The opening tag's words met in the page's script are not a block.
  const named = filled.replace('var standIn = 1;', 'var tag = \'' + S.VIEWER_BLOCKS.model.slice(0, 40) + '\';');
  expect(S.madeViewerBlocks(named).blocks.model).toBe('{"kind":"system","version":9,"canvases":[]}');
});

test('the workbook: the answer packed into the block as the viewer unpacks it; a failure leaves Excel out', async () => {
  const xlsx = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(200, 7)]);
  const asked = [];
  const r = await run(['shop-a.fmide'], { recipe: RECIPE, excel: true, makeWorkbook: async (text, boards) => {
    asked.push({ text: JSON.parse(text), boards });
    return { base64: xlsx.toString('base64'), map: { case: null, cases: [], sliders: [] }, notes: ['A note.'] };
  } });
  expect(asked[0].text.kind).toBe('fmIDE-workspace');
  expect(asked[0].text.system.canvases.length).toBe(2);
  expect(sliderNames(asked[0].boards)).toEqual(['Price', 'Volume']);
  const block = S.readViewerWorkbook(JSON.parse(blocks(r.viewers[0]).excel));
  expect(block.value.size).toBe(xlsx.length);
  expect(zlib.inflateRawSync(Buffer.from(block.value.workbook, 'base64')).equals(xlsx)).toBe(true);
  expect(block.value.notes).toEqual(['A note.']);
  expect(showcaseOf(r.viewers[0]).excel).toEqual({ file: 'shop-a workbook.xlsx' });
  expect(entryOf(r, 'shop-a.fmide').excel).toEqual({ file: 'shop-a workbook.xlsx', size: xlsx.length, notes: ['A note.'] });
  const failing = await run(['shop-a.fmide'], { excel: true, makeWorkbook: async () => { throw new Error('No answer.'); } });
  expect(blocks(failing.viewers[0]).excel).toBe('');
  expect(showcaseOf(failing.viewers[0]).excel).toBeUndefined();
  expect(entryOf(failing, 'shop-a.fmide').notes).toContain('Made without Excel: No answer.');
  const notBook = await run(['shop-a.fmide'], { excel: true, makeWorkbook: async () => ({ base64: Buffer.from('hello').toString('base64') }) });
  expect(entryOf(notBook, 'shop-a.fmide').excel.error).toMatch(/isn't a workbook/);
});

test('a recipe written from a viewer\'s choices, run again, chooses the same; the report in both forms', async () => {
  const first = await run(['shop-a.fmide'], { auto: true });
  const recipe = B.recipeFrom(first.viewers[0]);
  expect(recipe.boards.form).toBe('template');
  expect(recipe.boards.boards[0].sliders.every(s => s.canvas === 'Shop' && !('canvasId' in s) && !('nodeId' in s))).toBe(true);
  const read = S.cleanShowcaseRecipe(recipe);
  expect(read.problems).toEqual([]);
  const again = await run(['shop-a.fmide', 'shop-c.fmide'], { recipe: read.value });
  const first0 = showcaseOf(first.viewers[0]).boards;
  const again0 = showcaseOf(again.viewers[0]).boards;
  expect(sliderNames(again0)).toEqual(sliderNames(first0));
  expect(barNames(again0)).toEqual(barNames(first0));
  expect(entryOf(again, 'shop-c.fmide').notFound).toEqual([{ name: 'Volume', canvas: 'Shop' }]);
  const rep = again.report;
  expect(rep).toMatchObject({ kind: 'fmIDE-viewer-report', version: 1, made: 2, failed: 0, recipe: true, excel: false });
  expect(rep.bytes).toBe(again.viewers.reduce((s, v) => s + Buffer.byteLength(v.text), 0));
  const text = B.reportText(rep);
  expect(text).toContain('Not found: Volume (on Shop) — left out');
  expect(text).toContain('Shows: the recipe; canvases: Shop, Summary');
});

test('the recipe\'s fields of phase V5: canvases by name, play, periods, excel with {model}; the old recipe sample reads as before', () => {
  const r = S.cleanShowcaseRecipe({ kind: 'fmIDE-showcase', version: 1, form: 'recipe', canvases: { show: ['Loan', 'LOAN', '', 7, { x: 1 }], start: 'Loan' },
    play: { from: 'Base', to: 'High' }, periods: { mode: 'range', from: 1, to: 3 }, excel: { file: '{model}.xlsx' } });
  expect(r.value.canvases).toEqual({ show: ['Loan', '7'], start: 'Loan' });
  expect(r.value.play).toEqual({ from: 'Base', to: 'High' });
  expect(r.value.periods).toEqual({ mode: 'range', from: 1, to: 3 });
  expect(r.value.excel).toEqual({ file: '{model}.xlsx' });
  expect(r.problems).toEqual(['Some entries of "canvases.show" are not canvas names, or repeat: they are left out.']);
  const bad = S.cleanShowcaseRecipe({ kind: 'fmIDE-showcase', version: 1, form: 'recipe', canvases: 'all', play: { from: 'Base' }, periods: { from: 2, to: 1 }, excel: { file: '' } });
  expect(bad.value.canvases).toEqual({ show: null, start: null });
  expect(bad.problems.length).toBe(4);
  const old = S.cleanShowcaseRecipe(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'formats', 'showcase-recipe-v1.json'), 'utf8')));
  expect(old.problems).toEqual([]);
  expect(old.value).toMatchObject({ title: '{model}', author: 'A teacher', canvases: { show: null, start: null }, play: null, periods: null, excel: null, auto: { sliders: 'inputs', bars: 'outputs', range: 50 } });
  // A recipe given where one model's showcase is wanted, and the other way round.
  expect(B.readRecipeText(fs.readFileSync(path.join(__dirname, 'fixtures', 'viewer', 'every-widget.showcase.json'), 'utf8')).error).toMatch(/not a recipe/);
});
