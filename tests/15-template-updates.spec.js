// 15. Canvases linked to their template — a canvas made from a canvas template remembers its
// family and version (system v4); when a newer version is in the library fmIDE says so, and
// "Update this canvas" rebuilds it from that version, keeping the input values typed on it.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

const picker = (page) => page.locator('.modal-box.template-box');
const form = (page) => page.locator('.modal-box.template-form');
const banner = (page) => page.locator('#templateUpdateBanner');
const updateBox = (page) => page.locator('.modal-box.template-update-box');
const openTemplates = async (page) => {
  await page.evaluate(() => fm.command('openTemplates'));
  await expect(picker(page)).toBeVisible();
};
const closeTemplates = (page) => picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
const canvasInfo = (page, name) => page.evaluate((n) => fm.canvases().find(c => c.name === n), name);
const valueOn = (page, canvas, name) => page.evaluate(([c, n]) => { fm.switchCanvas(c); return fm.getValue({ node: n }); }, [canvas, name]);
const namesOn = (page, canvas) => page.evaluate((c) => { fm.switchCanvas(c); return fm.nodes().map(n => n.name).filter(Boolean).sort(); }, canvas);

async function saveCanvasAsTemplate(page, name, note){
  await openTemplates(page);
  await picker(page).locator('button', { hasText: '+ Save Canvas as Template' }).click();
  await form(page).locator('input.template-form-name').fill(name);
  await form(page).locator('input.template-form-note').fill(note);
  await form(page).locator('button.primary', { hasText: 'Save Template' }).click();
  await closeTemplates(page);
}
async function saveNewVersion(page, family, note){
  await openTemplates(page);
  await picker(page).locator('.template-list button.template-family', { hasText: family }).click();
  await picker(page).locator('button.template-save-version').click();
  await form(page).locator('input.template-form-note').fill(note);
  await form(page).locator('button.primary', { hasText: /^Save version \d+$/ }).click();
  await closeTemplates(page);
}

// "Sales" v1 is built on an "Author" canvas: inputs Price 10, Volume 5, Discount 1, and
// Revenue = Price × Volume. It is then added on a canvas of its own, "Sales" (linked, v1).
async function salesV1(page){
  await page.evaluate(() => {
    fm.clearAll();
    fm.renameCanvas({ canvas: '@current', name: 'Author' });
    fm.createRect({ x: 60, y: 60, name: 'Price', value: '10' });
    fm.createRect({ x: 60, y: 160, name: 'Volume', value: '5' });
    fm.createRect({ x: 60, y: 260, name: 'Discount', value: '1' });
    const op = fm.createOperator({ x: 320, y: 110, op: '×' });
    fm.connect('Price', op); fm.connect('Volume', op);
    fm.connect(op, fm.createRect({ x: 460, y: 100, name: 'Revenue', value: '0' }));
  });
  await saveCanvasAsTemplate(page, 'Sales', 'first');
  await page.evaluate(() => fm.insertTemplate('Sales', 'newCanvas'));
}
// v2, saved from the Author canvas: Discount removed, a new input Tax 2.
async function salesV2(page){
  await page.evaluate(() => {
    fm.switchCanvas('Author');
    fm.deleteNodes({ nodes: ['Discount'] });
    fm.createRect({ x: 60, y: 360, name: 'Tax', value: '2' });
  });
  await saveNewVersion(page, 'Sales', 'tax added');
  await page.evaluate(() => fm.switchCanvas('Sales'));
}

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

// ---------- linking ----------
test('a canvas added from a canvas template remembers it — and after a reload', async ({ page }) => {
  await salesV1(page);
  const sales = await canvasInfo(page, 'Sales');
  expect(sales.template).toMatchObject({ name: 'Sales', version: 1, status: 'current', latest: 1 });
  expect(sales.template.family).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  // The canvas it was saved from is linked too.
  expect((await canvasInfo(page, 'Author')).template).toMatchObject({ version: 1, status: 'current' });
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  expect(data.version).toBe(8);
  expect(data.canvases.find(c => c.name === 'Sales').template).toMatchObject({ family: sales.template.family, version: 1, name: 'Sales' });
  await page.waitForTimeout(2500);  // the autosave
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ version: 1, status: 'current' });
});

test('"Add to current canvas" links only an empty canvas; mixing content unlinks', async ({ page }) => {
  await salesV1(page);
  await page.evaluate(() => { fm.addCanvas({ name: 'Empty' }); fm.insertTemplate('Sales', 'here'); });
  expect((await canvasInfo(page, 'Empty')).template).toMatchObject({ version: 1 });
  await page.evaluate(() => { fm.addCanvas({ name: 'Busy' }); fm.createRect({ x: 600, y: 400, name: 'Mine', value: '1' }); fm.insertTemplate('Sales', 'here'); });
  expect((await canvasInfo(page, 'Busy')).template).toBeUndefined();
  // A second template into the linked canvas makes it a mix: the link goes.
  await page.evaluate(() => { fm.switchCanvas('Empty'); fm.insertTemplate('Sales', 'here'); });
  expect((await canvasInfo(page, 'Empty')).template).toBeUndefined();
});

test('Save Module leaves the link out; Unlink removes it', async ({ page }) => {
  await salesV1(page);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveModule')));
  expect(data.kind).toBe('module');
  expect(JSON.stringify(data)).not.toContain('"template"');
  await page.evaluate(() => fm.unlinkCanvasFromTemplate());
  expect((await canvasInfo(page, 'Sales')).template).toBeUndefined();
  await page.evaluate(() => fm.command('undo'));
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ version: 1 });
});

// ---------- the notice ----------
test('a newer version shows the bar and the tab marker; "Not now" waits for the next one', async ({ page }) => {
  await salesV1(page);
  await expect(banner(page)).toHaveCount(0);
  await salesV2(page);
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ version: 1, status: 'newer', latest: 2 });
  await expect(banner(page).locator('.template-update-text')).toHaveText('This canvas came from “Sales” v1. Version 2 is available — ‘tax added’.');
  await expect(page.locator('.canvas-tab', { hasText: 'Sales' }).locator('.template-update-mark')).toHaveCount(1);
  // The Author canvas is at v2: no bar there.
  await page.evaluate(() => fm.switchCanvas('Author'));
  await expect(banner(page)).toHaveCount(0);
  await page.evaluate(() => fm.switchCanvas('Sales'));
  await banner(page).locator('button', { hasText: 'Not now' }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator('.template-update-mark')).toHaveCount(0);
  // v3 brings it back.
  await page.evaluate(() => { fm.switchCanvas('Author'); fm.setValue({ node: 'Tax', value: '3' }); });
  await saveNewVersion(page, 'Sales', 'tax 3');
  await page.evaluate(() => fm.switchCanvas('Sales'));
  await expect(banner(page).locator('.template-update-text')).toHaveText('This canvas came from “Sales” v1. Version 3 is available — ‘tax 3’.');
});

// ---------- updating ----------
test('Update keeps typed input values, brings new rectangles, drops removed ones; Undo goes back', async ({ page }) => {
  await salesV1(page);
  // Typed on the Sales canvas: a new price, and per-period volumes.
  await page.evaluate(() => {
    fm.setPeriodCount(3);
    fm.setValue({ node: 'Price', value: '12' });
    fm.setPeriodValues({ node: 'Volume', values: '5, 6, 7' });
  });
  const salesId = (await canvasInfo(page, 'Sales')).id;
  await salesV2(page);
  await banner(page).locator('button', { hasText: 'Update this canvas…' }).click();
  await expect(updateBox(page).locator('.template-update-kept')).toHaveText('Input values kept: Price, Volume (2)');
  await expect(updateBox(page).locator('.template-update-dropped')).toHaveText('Not in v2 (values dropped): Discount');
  await expect(updateBox(page).locator('.template-update-warning')).toHaveCount(0);
  await expect(updateBox(page).locator('.template-update-notes li')).toHaveText(['v2 — tax added']);
  await updateBox(page).locator('button.primary', { hasText: 'Update' }).click();
  expect(await F.dialogText(page)).toBe('Updated to v2. Kept 2 input values.');
  await F.dismissMessage(page);
  await expect(banner(page)).toHaveCount(0);
  const after = await canvasInfo(page, 'Sales');
  expect(after.id).toBe(salesId);
  expect(after.template).toMatchObject({ version: 2, status: 'current' });
  expect(await namesOn(page, 'Sales')).toEqual(['Price', 'Revenue', 'Tax', 'Volume']);
  expect(await valueOn(page, 'Sales', 'Tax')).toBe(2);
  expect(await page.evaluate(() => [1, 2, 3].map(p => fm.getValue({ node: 'Revenue', period: p })))).toEqual([60, 72, 84]);
  await page.evaluate(() => fm.command('undo'));
  expect(await namesOn(page, 'Sales')).toEqual(['Discount', 'Price', 'Revenue', 'Volume']);
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ version: 1 });
});

test('an alias on another canvas still points at a matched rectangle after the update', async ({ page }) => {
  await salesV1(page);
  await page.evaluate(() => {
    fm.addCanvas({ name: 'Summary' });
    fm.createAlias({ x: 80, y: 80, sourceCanvas: 'Sales', source: 'Revenue' });
    fm.createAlias({ x: 80, y: 200, sourceCanvas: 'Sales', source: 'Discount' });
  });
  await salesV2(page);
  const r = await page.evaluate(() => fm.updateCanvasFromTemplate());
  expect(r).toEqual({ version: 2, kept: 2, lostAliases: ['Summary'] });
  expect(await page.evaluate(() => { fm.switchCanvas('Summary'); return fm.nodes().map(n => n.name); })).toContain('Revenue');
  expect(await valueOn(page, 'Summary', 'Revenue')).toBe(50);
});

test('changes of the canvas\'s own are warned about; typed values alone are not', async ({ page }) => {
  await salesV1(page);
  await page.evaluate(() => fm.setValue({ node: 'Price', value: '99' }));
  await salesV2(page);
  await page.evaluate(() => fm.command('updateCanvasTemplate'));
  await expect(updateBox(page)).toBeVisible();
  await expect(updateBox(page).locator('.template-update-warning')).toHaveCount(0);
  await updateBox(page).locator('button', { hasText: 'Cancel' }).click();
  await page.evaluate(() => fm.createRect({ x: 600, y: 500, name: 'My note', value: '1' }));
  await page.evaluate(() => fm.command('updateCanvasTemplate'));
  await expect(updateBox(page).locator('.template-update-warning')).toHaveText('This canvas has changes of its own since v1 was added. Updating replaces them; Undo brings them back.');
});

test('an older version can be chosen; the command works when nothing is newer', async ({ page }) => {
  await salesV1(page);
  await salesV2(page);
  await page.evaluate(() => fm.updateCanvasFromTemplate());
  await expect(banner(page)).toHaveCount(0);
  await page.evaluate(() => fm.command('updateCanvasTemplate'));
  const pick = updateBox(page).locator('select');
  await expect(pick.locator('option')).toHaveText(['v2 (latest) (this canvas)', 'v1']);
  await pick.selectOption('1');
  await expect(updateBox(page).locator('.template-update-notes li')).toHaveText(['v2 — tax added']);
  await updateBox(page).locator('button.primary', { hasText: 'Update' }).click();
  await F.dismissMessage(page);
  expect(await namesOn(page, 'Sales')).toEqual(['Discount', 'Price', 'Revenue', 'Volume']);
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ version: 1, status: 'newer', latest: 2 });
  expect(await page.evaluate(() => { try{ fm.updateCanvasFromTemplate({ version: '7' }); }catch(e){ return e.message; } }))
    .toBe('There is no version 7 of "Sales" (it has versions 1, 2).');
});

test('a template that is no longer in the library: no notice, and the update says so', async ({ page }) => {
  await salesV1(page);
  await page.evaluate(() => fm.command('clearAllTemplates'));
  await F.confirmDanger(page);
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ status: 'not-in-library', latest: null });
  await expect(banner(page)).toHaveCount(0);
  expect(await page.evaluate(() => { try{ fm.updateCanvasFromTemplate(); }catch(e){ return e.message; } }))
    .toBe('Canvas "Sales" came from “Sales”, which isn\'t in your template library.');
});

test('a macro records the update', async ({ page }) => {
  await salesV1(page);
  await salesV2(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.evaluate(() => fm.command('updateCanvasTemplate'));
  await updateBox(page).locator('button.primary', { hasText: 'Update' }).click();
  await F.dismissMessage(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const steps = data.macros[data.macros.length - 1].steps.filter(s => s.action === 'updateCanvasFromTemplate');
  expect(steps.map(s => s.args)).toEqual([{ canvas: 'Sales', version: '2' }]);
});

// ---------- files ----------
test('a link from a file is checked: a bad one is dropped, names are shown as text', async ({ page }, testInfo) => {
  await salesV1(page);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  const sales = data.canvases.find(c => c.name === 'Sales');
  const author = data.canvases.find(c => c.name === 'Author');
  author.template = { family: '<script>', version: 'one', name: 'x' };
  sales.template = Object.assign({}, sales.template, { version: 1, name: '<img src=x onerror="window.__pwned=1">', versionId: 'not-in-this-library' });
  const path = testInfo.outputPath('links.json');
  fs.writeFileSync(path, JSON.stringify(data));
  await F.importViaCommand(page, 'loadSystem', path);
  await F.acceptAll(page);
  expect((await canvasInfo(page, 'Author')).template).toBeUndefined();
  // Sales: its family is here but not that version — a newer one is offered after a new save.
  expect((await canvasInfo(page, 'Sales')).template).toMatchObject({ status: 'unknown-version' });
  await salesV2(page);
  await expect(banner(page).locator('.template-update-text')).toHaveText('This canvas came from “<img src=x onerror="window.__pwned=1">” v1. Version 2 is available — ‘tax added’.');
  await expect(page.locator('#templateUpdateBanner img')).toHaveCount(0);
  await banner(page).locator('button', { hasText: 'Update this canvas…' }).click();
  await expect(updateBox(page).locator('.template-update-warning')).toContainText("isn't in your library, so fmIDE can't check for changes of your own");
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('system v3 files still open; sys-newer-v4 is now a current file', async ({ page }) => {
  await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-newer-v4.json'));
  const seen = await F.acceptAll(page);
  expect(seen[0]).toMatch(/^Load this system\?/);
  await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-current.json'));
  await F.acceptAll(page);
  expect((await page.evaluate(() => fm.canvases())).map(c => c.name)).toEqual(['Revenue Model']);
  expect((await page.evaluate(() => fm.canvases()))[0].template).toBeUndefined();
});
