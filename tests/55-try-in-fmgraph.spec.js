// 55. Try in fmGraph (step 15, phase G5c; docs/step15-fmgraph.md): fmIDE's Browse Library offers
// 📈 Try in fmGraph on a canvas or system template whose pack carries an fmGraph board (the
// library's list marks it, `board`). The pack is fetched with the usual checks; fmGraph shows the
// template's model with its board in its try mode: a strip saying so (text from the pack as plain
// text), nothing read from or kept in the browser, nothing sent back to fmIDE, nothing added to
// fmIDE's library or document. Show fmIDE's model goes back to the model open in fmIDE.
// Sample: tests/fixtures/library/try-library/ (built into a site, as groups 25 and 26).
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const A = require('./helpers/apps');
const F = require('./helpers/fmide');
const W = require('./helpers/site');
const { expect } = base;

const LIBRARY = A.fixture('library', 'try-library');
const PACK = 'pack-try-boards-01';
const HOSTILE = '<img src=x onerror="window.__pwned=1"> & "quotes"';

const test = base.test.extend({
  site: async ({ context }, use) => {
    const seen = [];
    context.on('request', r => seen.push(r.url()));
    const site = await W.startSiteServer({ library: LIBRARY });
    await use(site);
    await site.close().catch(() => {});
    fs.rmSync(site.dir, { recursive: true, force: true });
    expect(seen.filter(u => !u.startsWith(site.origin) && !u.startsWith('data:') && !u.startsWith('blob:')), 'a request to another site').toEqual([]);
  },
});

async function openPack(page){
  await page.evaluate(() => fm.command('browseLibrary'));
  const box = page.locator('.modal-box.library-browse');
  await box.locator(`.library-browse-pack[data-id="${PACK}"]`).click();
  return box;
}
const itemRow = (box, versionId) => box.locator(`.library-browse-item[data-version-id="${versionId}"]`);
// Clicks Try in fmGraph on an item and waits for fmGraph to show the template.
async function tryItem(page, box, versionId, { popup = true } = {}){
  const button = itemRow(box, versionId).locator('.library-browse-try');
  let graph;
  if(popup) [graph] = await Promise.all([page.waitForEvent('popup'), button.click()]);
  else { await button.click(); graph = page.context().pages().find(p => p !== page); }
  await graph.waitForFunction(() => !!window.fmGraph && !!fmGraph.trying());
  return graph;
}
// fmIDE's library, model, boards and title (an unsaved document shows •).
async function fmideState(page){
  const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
  return { templates: ws.templates.map(t => t.name), canvases: ws.system.canvases.map(c => c.name), boards: ws.graphBoards || null, title: await page.title() };
}
// What fmGraph keeps in this browser (its IndexedDB store).
const storedKeys = (graph) => graph.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('fmGraph');
  req.onsuccess = () => {
    const db = req.result;
    if(!db.objectStoreNames.contains('kv')){ db.close(); resolve([]); return; }
    const r = db.transaction('kv').objectStore('kv').getAllKeys();
    r.onsuccess = () => { db.close(); resolve(r.result.map(String).filter(k => k.startsWith('fmgraph-board') || k === 'fmgraph-last-board')); };
  };
  req.onerror = () => resolve([]);
}));

test('the list marks templates with a board; Try in fmGraph shows a canvas template with its board, keeping nothing', async ({ page, site }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await W.openSite(page, site.origin);
  const index = JSON.parse(fs.readFileSync(path.join(site.dir, 'library', 'index.json'), 'utf8'));
  expect(index.packs[0].items.map(it => [it.name.split(' ')[0], it.board === true])).toEqual([['Sales', true], ['Plain', false], ['Plan', true]]);
  const before = await fmideState(page);
  const box = await openPack(page);
  await expect(box.locator('.library-browse-try')).toHaveCount(2);            // not on Plain
  await expect(itemRow(box, 'vid-try-plain-00001').locator('.library-browse-try')).toHaveCount(0);
  const graph = await tryItem(page, box, 'vid-try-sales-00001');
  graph.on('pageerror', e => errors.push(e.message));
  expect(await graph.evaluate(() => fmGraph.trying())).toEqual({ name: 'Sales ' + HOSTILE, pack: 'Boards to try ' + HOSTILE });
  const strip = graph.locator('#trialBar');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('Trying “Sales ' + HOSTILE + '” from the library pack “Boards to try ' + HOSTILE + '”. Nothing is kept');
  await expect(strip.locator('img')).toHaveCount(0);
  // Its one canvas, in fmIDE's periods, with the template's board placed on it.
  expect((await graph.evaluate(() => fmGraph.rectangles())).map(r => [r.name, r.input])).toEqual([['Price', true], ['Volume', true], ['Revenue', false]]);
  expect(await graph.evaluate(() => fmGraph.boards())).toEqual([{ name: ('Sales board ' + HOSTILE).slice(0, 60), shown: true }]); // names are at most 60 characters
  const b = await graph.evaluate(() => fmGraph.board());
  expect(b.items.map(w => w.name)).toEqual(['Revenue']);
  expect(b.sliders.map(s => s.name)).toEqual(['Price']);
  const slider = b.sliders[0].id;
  await graph.evaluate((id) => fmGraph.setSlider(id, 12), slider);
  expect(await graph.evaluate(() => fmGraph.value('Revenue', 1))).toBe(60);
  // Changing the boards: kept nowhere, sent nowhere.
  await graph.evaluate(() => fmGraph.addBar('Price'));
  await graph.waitForTimeout(800);
  expect(await storedKeys(graph)).toEqual([]);
  await expect(graph.locator('#btnAttachTemplate')).toBeHidden();
  const after = await fmideState(page);
  expect(after).toEqual(before);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await graph.evaluate(() => window.__pwned)).toBeUndefined();
  // Show fmIDE's model: the try ends, the model from fmIDE is shown (and linked again).
  await strip.getByRole('button', { name: 'Show fmIDE\'s model' }).click();
  await graph.waitForFunction(() => !fmGraph.trying());
  await expect(strip).toBeHidden();
  const names = await graph.evaluate(() => fmGraph.rectangles().map(r => r.name));
  expect(names).toContain('Total Revenue');          // fmIDE's starter model
  expect(errors).toEqual([]);
});

test('a system template is its whole model, its board placed by canvas name; an open fmGraph window is reused', async ({ page, site }) => {
  await W.openSite(page, site.origin);
  // fmGraph already open with fmIDE's model.
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  const own = await storedKeys(graph);
  const box = await openPack(page);
  await tryItem(page, box, 'vid-try-plan-000001', { popup: false });
  expect(page.context().pages().length).toBe(2);
  expect(await graph.evaluate(() => fmGraph.trying())).toEqual({ name: 'Plan', pack: 'Boards to try ' + HOSTILE });
  expect(await graph.evaluate(() => fmGraph.rectangles().map(r => r.canvas + '/' + r.name))).toEqual(['Sales/Price', 'Sales/Revenue', 'Sales/Units', 'Costs/Cost']);
  expect(await graph.evaluate(() => fmGraph.boards())).toEqual([{ name: 'Plan board', shown: true }]);
  const b = await graph.evaluate(() => fmGraph.board());
  const chart = b.items[0];
  expect(chart.layout).toBe('columns');
  expect((await graph.evaluate((id) => fmGraph.chart(id), chart.id)).map(p => p.groups[0].total)).toEqual([35, 35]); // Y1, Y2: 30 + 5
  await graph.evaluate((id) => fmGraph.setSlider(id, 20), b.sliders[0].id);
  expect((await graph.evaluate((id) => fmGraph.chart(id), chart.id))[0].groups[0].total).toBe(65);
  await graph.waitForTimeout(600);
  expect(await storedKeys(graph)).toEqual(own);                                 // what the browser kept is unchanged
  // ↻ From fmIDE ends the try too.
  await graph.locator('#btnFromFmide').click();
  await graph.waitForFunction(() => !fmGraph.trying());
});

test('a pack changed after publishing is refused: fmGraph shows fmIDE\'s model instead', async ({ page, site }) => {
  const file = path.join(site.dir, 'library', 'packs', PACK + '.fmide-pack.json');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('Volume', 'Volumo'));                // same size, another fingerprint
  await W.openSite(page, site.origin);
  const box = await openPack(page);
  const [graph] = await Promise.all([page.waitForEvent('popup'), itemRow(box, 'vid-try-sales-00001').locator('.library-browse-try').click()]);
  await expect(F.topDialog(page)).toContainText(/doesn't match the library's list/);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  expect(await graph.evaluate(() => fmGraph.trying())).toBeNull();
  expect(await graph.evaluate(() => fmGraph.rectangles().map(r => r.name))).not.toContain('Volumo');
});

test('a message from another window is ignored', async ({ page, site }) => {
  await W.openSite(page, site.origin);
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  const names = await graph.evaluate(() => fmGraph.rectangles().map(r => r.name));
  await graph.evaluate(() => window.postMessage({ type: 'fmIDE:try', name: 'X', pack: 'Y',
    text: JSON.stringify({ kind: 'system', version: 9, periods: ['P'], canvases: [{ id: 'c', name: 'C', nodes: [{ id: 'z', type: 'value', x: 0, y: 0, text: 'Intruder\n1' }], edges: [] }] }) }, '*'));
  await graph.waitForTimeout(300);
  expect(await graph.evaluate(() => fmGraph.trying())).toBeNull();
  expect(await graph.evaluate(() => fmGraph.rectangles().map(r => r.name))).toEqual(names);
});
