// 56. fmGraph's named scenarios (step 15, after G5; docs/step15-fmgraph.md).
// - + Save as scenario keeps where the board's sliders are, named sc01, sc02… (renamed in its
//   box, names unique); ▶ Show puts the sliders there (the matching scenario marked; an input
//   with no slider on this board said); A compares with it; ⟳ keeps where the sliders are now;
//   ↑ ↓ reorder; × deletes. Each change is an undo step; showing one is not.
// - Kept with the boards: the browser (after a reload), the board file (version 3, `scenarios`;
//   export all carries them, one board and the template form don't), import adding new names,
//   fmIDE's document; read like any file (inputs only, names unique, markup as text).
// - window.fmGraph: saveScenario, scenarios, showScenario, compareWith, renameScenario,
//   updateScenario, moveScenario, deleteScenario.
const { test, expect, openApp, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const sliders = (page) => g(page, () => fmGraph.board().sliders.map(s => s.id));
const values = (page) => g(page, () => fmGraph.board().sliders.map(s => s.value));
const list = (page) => g(page, () => fmGraph.scenarios());
const rows = (page) => page.locator('#scenarioList .scenario');
const profit = (page) => g(page, () => fmGraph.value('Profit', 1));

test('save, show, compare, update, rename, reorder and delete scenarios', async ({ page, pageErrors }) => {
  await openSample(page);
  const [price, volume] = await sliders(page);
  await expect(page.locator('#scenariosEmpty')).toBeVisible();
  // sc01: Price 13. Saved with the button; its name box is ready to type in.
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  await page.click('#btnSaveScenario');
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('#scenariosEmpty')).toBeHidden();
  await expect(rows(page).first().locator('.scenario-name')).toBeFocused();
  await page.keyboard.type('High price');
  await page.keyboard.press('Enter');
  await expect(rows(page).first().locator('.scenario-what')).toHaveText('Price 13');
  await expect(rows(page).first()).toHaveClass(/current/);
  // sc02: Price 13 and Volume +10%.
  await g(page, (i) => fmGraph.setSlider(i, 10), volume);
  await expect(rows(page).first()).not.toHaveClass(/current/);
  expect(await g(page, () => fmGraph.saveScenario())).toBe('sc01');
  expect(await g(page, () => fmGraph.saveScenario('sc01'))).toBeNull();          // a name used
  await expect(page.locator('.note[data-slot="scenarios"]')).toContainText('There is already a scenario called “sc01”');
  expect(await list(page)).toEqual([
    { name: 'High price', settings: 'Price 13', shown: false, compared: false },
    { name: 'sc01', settings: 'Price 13, Volume +10%', shown: true, compared: false }]);
  expect(await profit(page)).toBe(5200);
  // ▶ Show: the sliders go where High price had them (Volume back to the model's own number).
  await rows(page).first().locator('.scenario-show').click();
  expect(await values(page)).toEqual([13, null]);
  expect(await profit(page)).toBe(4500);
  await expect(rows(page).first().locator('.scenario-show')).toHaveAttribute('aria-pressed', 'true');
  // A: compare with sc01; the strip names it and the differences are from it.
  await rows(page).nth(1).locator('.scenario-compare').click();
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: scenario “sc01” (Price 13, Volume +10%)');
  await expect(rows(page).nth(1).locator('.scenario-compare')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.bar-widget').first().locator('.t-diff').first().textContent()).toBe('−700');
  // Pressing it again unpins.
  await rows(page).nth(1).locator('.scenario-compare').click();
  await expect(page.locator('#compareBar')).toBeHidden();
  // Renaming the one compared with keeps the strip in step; a name used is refused.
  await g(page, () => fmGraph.compareWith('sc01'));
  await rows(page).nth(1).locator('.scenario-name').fill('Growth');
  await rows(page).nth(1).locator('.scenario-name').press('Enter');
  await expect(page.locator('#compareBar .compare-text')).toHaveText('Comparing with A: scenario “Growth” (Price 13, Volume +10%)');
  await rows(page).nth(1).locator('.scenario-name').fill('HIGH PRICE');
  await rows(page).nth(1).locator('.scenario-name').press('Enter');
  await expect(rows(page).nth(1).locator('.scenario-name')).toHaveValue('Growth');
  // ⟳ keeps where the sliders are now; ↑ ↓; ×.
  await g(page, (i) => fmGraph.setSlider(i, 8), price);
  await rows(page).first().locator('.scenario-update').click();
  await expect(rows(page).first().locator('.scenario-what')).toHaveText('Price 8');
  await rows(page).nth(1).locator('.scenario-up').click();
  expect((await list(page)).map(s => s.name)).toEqual(['Growth', 'High price']);
  await expect(rows(page).first().locator('.scenario-up')).toBeDisabled();
  await expect(rows(page).nth(1).locator('.scenario-down')).toBeDisabled();
  await rows(page).first().locator('.scenario-delete').click();
  expect((await list(page)).map(s => s.name)).toEqual(['High price']);
  expect(pageErrors).toEqual([]);
});

test('undo and redo: each change to the scenarios is a step; showing one is not', async ({ page }) => {
  await openSample(page);
  const [price] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 12), price);
  await g(page, () => fmGraph.saveScenario('Up'));
  await g(page, () => fmGraph.saveScenario('Same'));
  await g(page, () => fmGraph.renameScenario('Same', 'Twin'));
  await g(page, (i) => fmGraph.resetSlider(i), price);
  await g(page, () => fmGraph.showScenario('Up'));                       // not a step
  expect(await values(page)).toEqual([12, null]);
  expect(await g(page, () => fmGraph.undo())).toBe(true);                 // the rename
  expect((await list(page)).map(s => s.name)).toEqual(['Up', 'Same']);
  expect(await values(page)).toEqual([12, null]);                         // sliders kept
  await g(page, () => fmGraph.undo());
  await g(page, () => fmGraph.undo());
  expect(await list(page)).toEqual([]);
  await expect(rows(page)).toHaveCount(0);
  await g(page, () => fmGraph.redo());
  expect((await list(page)).map(s => s.name)).toEqual(['Up']);
});

test('a scenario reaches inputs on any board; one with no slider on this board is said', async ({ page }) => {
  await openSample(page);
  const [price, volume] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 14), price);
  await g(page, (i) => fmGraph.setSlider(i, -10), volume);
  await g(page, () => fmGraph.saveScenario('Both'));
  await g(page, () => fmGraph.addBoard('Only price'));
  await g(page, () => fmGraph.addSlider('Price'));
  expect(await g(page, () => fmGraph.showScenario('Both'))).toBe(1);
  await expect(page.locator('.note[data-slot="scenarios"]')).toContainText('“Both” also changes Volume, with no slider like it on this board: + Slider adds one.');
  expect(await values(page)).toEqual([14]);
  // Comparing with it still uses both of its inputs.
  await g(page, () => fmGraph.compareWith('Both'));
  await g(page, () => fmGraph.addBar('Profit'));
  expect(await page.locator('.bar-widget').first().locator('.t-diff').first().textContent()).toBe('+800'); // 5,500 now (Price 14), 4,700 in Both (Price 14, Volume −10%)
});

test('kept: after a reload, in the board file (version 3 and later), and imported into another model', async ({ page }) => {
  await openSample(page);
  const [price] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 11), price);
  await g(page, () => fmGraph.saveScenario('Eleven'));
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(rows(page)).toHaveCount(1);
  expect(await list(page)).toEqual([{ name: 'Eleven', settings: 'Price 11', shown: false, compared: false }]);
  expect(await values(page)).toEqual([null, null]);                       // sliders start on the model's numbers
  // Export all: version 4 (since the scenario waterfall) with the scenarios; one board: none.
  const all = await g(page, () => fmGraph.exportBoards(true));
  expect(all.version).toBe(4);
  expect(all.scenarios).toEqual([{ name: 'Eleven', sliders: [{ canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: 11 }] }]);
  expect(await g(page, () => fmGraph.exportBoards(false))).not.toHaveProperty('scenarios');
  // Importing: a new name is added, a name used here keeps yours.
  await g(page, () => fmGraph.renameScenario('Eleven', 'Mine'));
  await g(page, (i) => fmGraph.setSlider(i, 11), price);
  await g(page, () => fmGraph.saveScenario('Eleven'));
  const theirs = Object.assign({}, all, { scenarios: all.scenarios.concat([{ name: 'Theirs', sliders: [{ canvasId: 'cProfit', nodeId: 'vol', name: 'Volume', mode: 'shift', periods: { mode: 'one', p: 1 }, value: 20 }] }]) });
  expect(await g(page, (d) => fmGraph.importBoards(d), theirs)).toBe(1);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('Added the scenarios “Theirs”.');
  expect((await list(page)).map(s => [s.name, s.settings])).toEqual([['Mine', 'Price 11'], ['Eleven', 'Price 11'], ['Theirs', 'Volume +20%']]);
  // A file holding only scenarios adds them.
  expect(await g(page, () => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 3, boards: [], scenarios: [{ name: 'Lone', sliders: [] }] }))).toBe(0);
  expect((await list(page)).map(s => s.name)).toContain('Lone');
  // The template form carries none and stays version 2.
  await page.locator('.gbar-menu > summary').click();
  await page.locator('#btnExportTemplate').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#templateYes').click()]);
  const saved = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(saved.version).toBe(2);
  expect(saved).not.toHaveProperty('scenarios');
  // A version 2 file still imports.
  expect(await g(page, (d) => fmGraph.importBoards(Object.assign({}, d, { version: 2, scenarios: undefined })), all)).toBe(1);
});

test('scenarios from a file are read like any file: inputs only, names unique, markup as text', async ({ page, pageErrors }) => {
  await openSample(page);
  const hostile = '<img src=x onerror="window.__pwned=1">';
  const file = { kind: 'fmIDE-graph-board', version: 3, boards: [], scenarios: [
    { name: hostile, sliders: [
      { canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: 9 },
      { canvasId: 'cProfit', nodeId: 'profit', name: 'Profit', mode: 'set', periods: { mode: 'all' }, value: 1 },   // not an input
      { canvasId: 'cProfit', nodeId: 'nope', name: 'Nope', mode: 'set', value: 1 },                                  // not there
      { canvasId: 'cProfit', nodeId: 'ucost', name: 'Unit cost', mode: 'set', value: 'x' },                          // not a number
      { canvasId: 'cProfit', nodeId: 'vol', name: 'Other name', mode: 'set', value: 1 } ] },                         // another name
    { name: '<IMG src=x onerror="window.__pwned=1">', sliders: [] },                                               // the same name
    { name: '   ', sliders: [] }, 'junk', null ] };
  await g(page, (d) => fmGraph.importBoards(d), file);
  expect(await list(page)).toEqual([{ name: hostile, settings: 'Price 9', shown: false, compared: false }]);
  await expect(rows(page).first().locator('.scenario-name')).toHaveValue(hostile);
  await expect(page.locator('#scenarioList img')).toHaveCount(0);
  await g(page, () => fmGraph.compareWith(document.querySelector('#scenarioList .scenario-name').value));
  await expect(page.locator('#compareBar .compare-text')).toContainText(hostile);
  await expect(page.locator('#compareBar img')).toHaveCount(0);
  expect(await g(page, () => window.__pwned)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('with the model from fmIDE, scenarios go into the document', async ({ page }) => {
  await F.openFmIDE(page);
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0 && fmGraph.boards().length > 0);
  const id = await graph.evaluate(() => fmGraph.addSlider(fmGraph.rectangles().find(r => r.input).name));
  await graph.evaluate((i) => fmGraph.setSlider(i, 3), id);
  await graph.evaluate(() => fmGraph.saveScenario('Three'));
  await expect.poll(async () => {
    const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
    return ws.graphBoards && ws.graphBoards.scenarios ? ws.graphBoards.scenarios.map(s => s.name) : null;
  }).toEqual(['Three']);
  expect(await page.title()).toContain('•');
});

test('a board file from before scenarios (version 2) still imports', async ({ page }) => {
  await openSample(page);
  expect(await g(page, (d) => fmGraph.importBoards(d), readFixture('formats', 'board-v2.json'))).toBe(1);
  expect((await g(page, () => fmGraph.boards())).map(b => b.name)).toContain('Saved before scenarios');
  expect(await list(page)).toEqual([]);
});
