// 58. fmGraph's tutorials (step 15, G6; docs/step15-fmgraph.md).
// - Four tutorials at the top of fmGraph's Help panel (and 🎓 Learn with a tutorial on the first
//   screen), each played through here with real clicks and typing: the coach card moves on by
//   itself once a step is done, the ring points at what to press.
// - Practice: a copy of the sample model; nothing kept in the browser or sent to fmIDE; the model
//   from before comes back at the end (Finish or Exit) — read again with its boards, or asked
//   for from fmIDE — or the first screen when there was none; another model opened ends it.
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');

const g = (page, fn, arg) => page.evaluate(fn, arg);
const card = (page) => page.locator('#tutorialCard');
const stepIs = (page, id) => expect(card(page)).toHaveAttribute('data-step', id);
async function openFmGraph(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
}
async function openSample(page){
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
// Starts a tutorial from the Help panel.
async function startFromHelp(page, id){
  await page.click('#btnHelp');
  const row = page.locator(`.help-tutorial[data-tutorial="${id}"]`);
  await expect(row).toBeVisible();
  await row.locator('.help-tutorial-start').click();
  await expect(card(page)).toHaveAttribute('data-tutorial', id);
}
// Types a number into a slider's box (the n-th slider).
async function typeSlider(page, n, value){
  const box = page.locator('.slider-widget').nth(n).locator('.slider-value');
  await box.fill(String(value));
  await box.press('Enter');
}
// What fmGraph keeps in this browser for boards.
const storedBoards = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('fmGraph');
  req.onsuccess = () => {
    const db = req.result;
    if(!db.objectStoreNames.contains('kv')){ db.close(); resolve({}); return; }
    const tx = db.transaction('kv'), out = {};
    const cur = tx.objectStore('kv').openCursor();
    cur.onsuccess = () => { const c = cur.result; if(!c){ db.close(); resolve(out); return; } if(String(c.key).startsWith('fmgraph-')) out[c.key] = c.value; c.continue(); };
  };
  req.onerror = () => resolve({});
}));

test('Sliders and bars, from the first screen: played through; the first screen comes back; nothing kept', async ({ page, pageErrors }) => {
  await openFmGraph(page);
  await page.click('#btnTutorials');
  await expect(page.locator('.help-tutorial')).toHaveCount(4);
  expect(await page.locator('.help-tutorial .help-command-name').allTextContents()).toEqual(['🎓 Sliders and bars · 3 min', '🎓 Charts · 4 min', '🎓 Trace and compare · 3 min', '🎓 Scenarios · 4 min']);
  await page.locator('.help-tutorial[data-tutorial="sliders-and-bars"] .help-tutorial-start').click();
  await stepIs(page, 'intro');
  await expect(page.locator('#helpPanel')).toBeHidden();
  await expect(card(page)).toContainText('Practice: nothing here is kept');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  await expect(page.locator('.bar-widget, .chart-widget')).toHaveCount(0);
  await card(page).locator('.tutorial-next').click();
  await stepIs(page, 'add-bar');
  await expect(page.locator('#tutorialPointer')).toBeVisible();
  await page.click('#btnAddBar');
  await stepIs(page, 'choose-profit');
  await page.locator('.bar-widget select').first().selectOption({ label: 'Profit' });
  await stepIs(page, 'move-price');
  await typeSlider(page, 0, 12);
  await stepIs(page, 'reset');
  await page.click('#btnResetAll');
  await stepIs(page, 'end');
  await card(page).locator('.tutorial-back').click();
  await stepIs(page, 'reset');            // Back shows the step before; already done, it waits for Next
  await page.waitForTimeout(700);
  await stepIs(page, 'reset');
  await card(page).locator('.tutorial-next').click();
  await stepIs(page, 'end');
  await card(page).locator('.tutorial-finish').click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('#welcome')).toBeVisible();
  expect(await g(page, () => fmGraph.tutorial())).toBeNull();
  expect(Object.keys(await storedBoards(page)).filter(k => k.startsWith('fmgraph-board') || k === 'fmgraph-last-board')).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Charts: a waterfall built step by step; the model from before comes back with its boards', async ({ page, pageErrors }) => {
  await openFmGraph(page);
  await openSample(page);
  await g(page, () => fmGraph.addBoard('Mine'));
  await page.waitForTimeout(500);
  const before = await storedBoards(page);
  await startFromHelp(page, 'charts');
  await stepIs(page, 'add-chart');
  await page.click('#btnAddChart');
  await stepIs(page, 'waterfall');
  await page.locator('.chart-widget select[aria-label="Kind of chart"]').selectOption('flow');
  await stepIs(page, 'steps');
  const chart = page.locator('.chart-widget').first();
  if(!(await chart.locator('details.chart-edit').evaluate(d => d.open))) await chart.locator('summary', { hasText: 'Edit chart' }).click();
  await chart.locator('.add-step').click();
  await chart.locator('.step-row').nth(1).locator('select[aria-label="Step"]').selectOption('subtract');
  await chart.locator('.step-row').nth(1).locator('select[aria-label="Rectangle"]').selectOption({ label: 'Cost of sales' });
  await chart.locator('.add-step').click();
  await chart.locator('.step-row').nth(2).locator('select[aria-label="Step"]').selectOption('total');
  await chart.locator('.step-row').nth(2).locator('select[aria-label="Rectangle"]').selectOption({ label: 'Gross profit' });
  await stepIs(page, 'check');
  await expect(chart.locator('.t-check.ok')).toHaveCount(1);
  await typeSlider(page, 0, 14);
  await stepIs(page, 'end');
  await expect(chart.locator('.t-check.ok')).toHaveCount(1);
  await card(page).locator('.tutorial-finish').click();
  // The sample model again, with its boards as they were (Mine included); nothing changed in storage.
  await expect.poll(() => g(page, () => fmGraph.boards())).toEqual([{ name: 'Board', shown: false }, { name: 'Mine', shown: true }]);
  expect(await storedBoards(page)).toEqual(before);
  await g(page, () => fmGraph.showBoard('Board'));
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test('Trace and compare: played through', async ({ page, pageErrors }) => {
  await openFmGraph(page);
  await startFromHelp(page, 'trace-and-compare');
  await stepIs(page, 'trace');
  await page.locator('.bar-widget .widget-trace').first().click();
  await stepIs(page, 'price');
  await typeSlider(page, 0, 12);
  await stepIs(page, 'pin');
  await page.click('#btnPinA');
  await stepIs(page, 'volume');
  await typeSlider(page, 1, 10);
  await stepIs(page, 'unpin');
  await page.locator('#compareBar button', { hasText: 'Unpin' }).click();
  await stepIs(page, 'end');
  await card(page).locator('.tutorial-finish').click();
  await expect(page.locator('#welcome')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Scenarios: played through, ending with a scenario waterfall', async ({ page, pageErrors }) => {
  await openFmGraph(page);
  await startFromHelp(page, 'scenarios');
  await stepIs(page, 'price');
  await typeSlider(page, 0, 12);
  await stepIs(page, 'save');
  await page.click('#btnSaveScenario');
  await stepIs(page, 'second');
  await page.locator('#scenarioList .scenario-name').first().press('Enter');
  await typeSlider(page, 1, 10);
  await page.click('#btnSaveScenario');
  await stepIs(page, 'show');
  await page.locator('#scenarioList .scenario-show').first().click();
  await stepIs(page, 'chart');
  await page.click('#btnAddChart');
  await page.locator('.chart-widget').last().locator('select[aria-label="Kind of chart"]').selectOption('scenarios');
  await stepIs(page, 'output');
  const sc = page.locator('.chart-widget[data-layout="scenarios"]');
  if(!(await sc.locator('details.chart-edit').evaluate(d => d.open))) await sc.locator('summary', { hasText: 'Edit chart' }).click();
  await sc.locator('.output-row select').first().selectOption({ label: 'Profit' });
  await stepIs(page, 'end');
  await expect(sc.locator('svg.scenario-flow .f-step')).toHaveCount(4);
  await card(page).locator('.tutorial-finish').click();
  await expect(page.locator('#welcome')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Exit puts the model back; opening another model during a tutorial ends it', async ({ page }) => {
  await openFmGraph(page);
  await openSample(page);
  await startFromHelp(page, 'charts');
  await card(page).locator('.tutorial-exit').click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.chart-widget')).toHaveCount(2);           // the sample's own board
  expect(await g(page, () => fmGraph.tutorial())).toBeNull();
  await startFromHelp(page, 'sliders-and-bars');
  await g(page, () => fmGraph.load({ kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [{ id: 'a', type: 'value', x: 0, y: 0, text: 'Alone\n1' }], edges: [] }] }, 'Other'));
  await expect(card(page)).toHaveCount(0);
  expect(await g(page, () => fmGraph.tutorial())).toBeNull();
  expect(await g(page, () => fmGraph.rectangles().map(r => r.name))).toEqual(['Alone']);
});

test('with the model from fmIDE: nothing reaches the document while practising; Finish asks fmIDE again', async ({ page }) => {
  await F.openFmIDE(page);
  const [graph] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await graph.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0 && fmGraph.boards().length > 0);
  const names = await graph.evaluate(() => fmGraph.rectangles().map(r => r.name));
  const title = await page.title();
  expect(await graph.evaluate(() => fmGraph.startTutorial('sliders-and-bars'))).toBe(true);
  await graph.evaluate(() => fmGraph.addBar('Profit'));
  await graph.evaluate(() => fmGraph.addBoard('Practice board'));
  await graph.waitForTimeout(800);
  expect(await page.title()).toBe(title);                                // not marked unsaved
  await graph.locator('#tutorialCard .tutorial-exit').click();
  await expect.poll(() => graph.evaluate(() => fmGraph.rectangles().map(r => r.name))).toEqual(names);
  await expect(graph.locator('#btnAttachTemplate')).toBeAttached();
  expect(await page.title()).toBe(title);
});
