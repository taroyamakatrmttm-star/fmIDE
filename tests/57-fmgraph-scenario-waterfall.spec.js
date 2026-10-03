// 57. fmGraph's scenario waterfall (step 15, scenarios S2; docs/step15-fmgraph.md).
// - A chart of kind "Scenario waterfall": for each output, in one period, a waterfall from the
//   model's own number (Start) through each scenario in turn — each step the change from the one
//   before — to the last scenario's number (End); one small waterfall per output.
// - It follows the scenarios (saved, updated, reordered, renamed, deleted, ticked), not where the
//   sliders are; built with the mouse; kept (board file 4); never in a template's board.
// - Problems said in words; names as text; window.fmGraph.addChart / chart.
const fs = require('fs');
const { test, expect, openApp, readFixture } = require('./helpers/apps');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const sliders = (page) => g(page, () => fmGraph.board().sliders.map(s => s.id));
// sc01: Price 13 (Profit 4,500 in Year 1); sc02: Price 13 and Volume +10% (5,200).
async function twoScenarios(page){
  const [price, volume] = await sliders(page);
  await g(page, (i) => fmGraph.setSlider(i, 13), price);
  await g(page, () => fmGraph.saveScenario());
  await g(page, (i) => fmGraph.setSlider(i, 10), volume);
  await g(page, () => fmGraph.saveScenario());
  return { price, volume };
}
// The words under the bars (each also carries its full name as hover text).
const labels = (svgEl) => svgEl.locator('.t-period').evaluateAll(els => els.map(e => e.firstChild.nodeValue));
// Opens a chart's editor (a new chart's is open already).
async function openEditor(chart){
  if(!(await chart.locator('details.chart-edit').evaluate(d => d.open))) await chart.locator('summary', { hasText: 'Edit chart' }).click();
}
const steps = (out) => out.steps.map(s => s.error ? [s.name, 'error'] : [s.name, s.kind, s.value, s.from, s.to]);

test('Start, a step per scenario and End, for each output; the sliders don\'t move it', async ({ page, pageErrors }) => {
  await openSample(page);
  const { price, volume } = await twoScenarios(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'scenarios', title: 'Through the scenarios', period: 1, outputs: ['Profit', 'Revenue'] }));
  const figures = await g(page, (i) => fmGraph.chart(i), id);
  expect(figures.map(o => o.name)).toEqual(['Profit', 'Revenue']);
  expect(steps(figures[0])).toEqual([['Start', 'start', 1500, 0, 1500], ['sc01', 'step', 3000, 1500, 4500], ['sc02', 'step', 700, 4500, 5200], ['End', 'end', 5200, 0, 5200]]);
  expect(steps(figures[1])).toEqual([['Start', 'start', 10000, 0, 10000], ['sc01', 'step', 3000, 10000, 13000], ['sc02', 'step', 1300, 13000, 14300], ['End', 'end', 14300, 0, 14300]]);
  const chart = page.locator('.chart-widget[data-layout="scenarios"]');
  await expect(chart.locator('svg.scenario-flow')).toHaveCount(2);
  await expect(chart.locator('svg.scenario-flow').first().locator('.f-step')).toHaveCount(4);
  expect(await chart.locator('svg.scenario-flow').first().locator('.t-value').allTextContents()).toEqual(['1,500', '+3,000', '+700', '5,200']);
  expect(await labels(chart.locator('svg.scenario-flow').first())).toEqual(['Start', 'sc01', 'sc02', 'End']);
  await expect(chart.locator('svg.scenario-flow').first().locator('.t-flow-title')).toHaveText('Profit — Year 1');
  await expect(chart.locator('svg.scenario-flow').first().locator('.f-step').nth(2).locator('.f-bar title')).toHaveText('sc02: 5,200 (+700 from sc01)');
  // Moving a slider changes the other charts, not this one.
  await g(page, (i) => fmGraph.setSlider(i, 5), price);
  await g(page, (i) => fmGraph.resetSlider(i), volume);
  expect(steps((await g(page, (i) => fmGraph.chart(i), id))[0])).toEqual(steps(figures[0]));
  expect(await chart.locator('.bar-errors li').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('it follows the scenarios: updated, reordered, ticked, renamed, deleted', async ({ page }) => {
  await openSample(page);
  const { price, volume } = await twoScenarios(page);
  await g(page, () => fmGraph.addChart({ layout: 'scenarios', period: 1, outputs: ['Profit'] }));
  // The chart's id changes with undo (the boards are read again), so it is looked up each time.
  const profit = async () => steps((await g(page, () => fmGraph.chart(fmGraph.board().charts.find(c => c.layout === 'scenarios').id)))[0]);
  // sc01 updated to Price 11 alone: +1,000, then +2,700 to sc02.
  await g(page, (i) => fmGraph.resetSlider(i), volume);
  await g(page, (i) => fmGraph.setSlider(i, 11), price);
  await g(page, () => fmGraph.updateScenario('sc01'));
  expect((await profit()).slice(1, 3)).toEqual([['sc01', 'step', 1000, 1500, 2500], ['sc02', 'step', 2700, 2500, 5200]]);
  // Reordered: sc02 first.
  await g(page, () => fmGraph.moveScenario('sc02', 0));
  expect((await profit()).map(s => s[0])).toEqual(['Start', 'sc02', 'sc01', 'End']);
  // Only sc01 ticked in Edit chart.
  const chart = page.locator('.chart-widget[data-layout="scenarios"]');
  await openEditor(chart);
  await chart.locator('.scenario-tick', { hasText: 'sc02' }).locator('input').uncheck();
  expect((await profit()).map(s => s[0])).toEqual(['Start', 'sc01', 'End']);
  expect((await g(page, () => fmGraph.board())).charts.find(c => c.layout === 'scenarios').scenarios).toEqual(['sc01']);
  // Renamed: the chart follows; deleted: it is gone from the chart, and says nothing is ticked.
  await g(page, () => fmGraph.renameScenario('sc01', 'Eleven'));
  expect((await profit()).map(s => s[0])).toEqual(['Start', 'Eleven', 'End']);
  await g(page, () => fmGraph.deleteScenario('Eleven'));
  expect((await profit()).map(s => s[0])).toEqual(['Start']);
  await expect(chart.locator('.bar-errors')).toContainText('None of the scenarios is ticked');
  // Undo brings it back.
  await g(page, () => fmGraph.undo());
  expect((await profit()).map(s => s[0])).toEqual(['Start', 'Eleven', 'End']);
});

test('built with the mouse, kept after a reload and in the board file (version 4)', async ({ page }) => {
  await openSample(page);
  await twoScenarios(page);
  await page.click('#btnAddChart');
  const chart = page.locator('.chart-widget').last();
  await chart.locator('select[aria-label="Kind of chart"]').selectOption('scenarios');
  const sc = page.locator('.chart-widget[data-layout="scenarios"]');
  await expect(sc).toHaveCount(1);
  await openEditor(sc);
  await sc.locator('select[aria-label="Period"]').selectOption({ label: 'Year 2' });
  await sc.locator('.add-output').click();
  await sc.locator('.output-row').last().locator('select').selectOption({ label: 'Profit' });
  await expect(sc.locator('svg.scenario-flow')).toHaveCount(2);
  await sc.locator('input.chart-title').fill('Cases');
  await sc.locator('input.chart-title').press('Enter');
  await page.waitForTimeout(600);
  const all = await g(page, () => fmGraph.exportBoards(true));
  expect(all.version).toBe(4);
  const saved = all.boards[0].items.find(i => i.layout === 'scenarios');
  expect(saved).toMatchObject({ type: 'chart', layout: 'scenarios', title: 'Cases', period: 1 });
  expect(saved).not.toHaveProperty('scenarios'); // every scenario
  expect(saved.outputs.map(o => o.name)).toContain('Profit');
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget[data-layout="scenarios"] svg.scenario-flow')).toHaveCount(2);
  await expect(page.locator('.chart-widget[data-layout="scenarios"] input.chart-title')).toHaveValue('Cases');
});

test('problems in words: no scenarios, no outputs, a scenario that is gone; names as text', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'scenarios', period: 1, outputs: [] }));
  const chart = page.locator('.chart-widget[data-layout="scenarios"]');
  await expect(chart.locator('.bar-errors')).toContainText('No scenarios yet: save some in the Scenarios panel');
  await expect(chart.locator('.bar-errors')).toContainText('No outputs yet');
  expect(await g(page, (i) => fmGraph.chart(i), id)).toEqual([]);
  // A file naming a scenario this model doesn't have, and a hostile scenario name.
  const hostile = '<img src=x onerror="window.__pwned=1">';
  await g(page, (h) => fmGraph.importBoards({ kind: 'fmIDE-graph-board', version: 4, boards: [{ name: 'Odd', items: [
    { type: 'chart', layout: 'scenarios', title: h, period: 0, outputs: [{ canvasId: 'cProfit', nodeId: 'profit', name: 'Profit' }], scenarios: [h, 'Gone'] }] }],
  scenarios: [{ name: h, sliders: [{ canvasId: 'cProfit', nodeId: 'price', name: 'Price', mode: 'set', periods: { mode: 'all' }, value: 12 }] }] }), hostile);
  const odd = page.locator('.chart-widget[data-layout="scenarios"]');
  await expect(odd).toHaveCount(1); // the board "Odd" is shown
  await expect(odd.locator('.bar-errors')).toContainText('No scenario called “Gone” any more.');
  expect((await labels(odd.locator('svg.scenario-flow')))[1]).toMatch(/^<img/);
  await expect(odd.locator('img')).toHaveCount(0);
  await expect(odd.locator('input.chart-title')).toHaveValue(hostile);
  expect(await g(page, () => window.__pwned)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('a template\'s board leaves a scenario waterfall out; a version 3 file still imports', async ({ page }) => {
  await openSample(page);
  await twoScenarios(page);
  await g(page, () => fmGraph.addChart({ layout: 'scenarios', period: 1, outputs: ['Profit'] }));
  await page.locator('.gbar-menu > summary').click();
  await page.locator('#btnExportTemplate').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#templateYes').click()]);
  const saved = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(saved.version).toBe(2);
  expect(saved.boards[0].items.some(i => i.layout === 'scenarios')).toBe(false);
  await expect(page.locator('.note[data-slot="boards"]')).toContainText('left out');
  // A board file saved with scenarios before the scenario waterfall.
  expect(await g(page, (d) => fmGraph.importBoards(d), readFixture('formats', 'board-v3.json'))).toBe(1);
  expect((await g(page, () => fmGraph.scenarios())).map(s => s.name)).toContain('Before waterfalls');
});
