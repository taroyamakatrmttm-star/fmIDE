// 47. fmGraph (step 15, phase G1; docs/step15-fmgraph.md): bars and sliders.
// - The welcome screen and the sample model: the values, the starting board.
// - fmGraph's values agree with fmIDE's for every sample model (the pinned snapshots of group 18).
// - A slider: by mouse, by keyboard and by finger; it moves exactly the bars it reaches, lights
//   them, and never changes the model; set and change-by-%, one period or all; Reset; only inputs.
// - The board is remembered per model (not the sliders' positions), and not picked up by
//   another model that happens to use the same ids.
// - Files: hostile names shown as text, the wrong kind refused, a newer version asked about.
// - fmIDE: Open fmGraph sends the model straight over (and ↻ From fmIDE again); messages from
//   any other window are ignored; ← Back to fmIDE closes the window; the ribbon has the command.
// - A large model: a slider's steps are worked out ahead. Help.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, FIXTURES, openApp, ROOT } = require('./helpers/apps');
const { openFmIDE, importViaCommand, acceptAll } = require('./helpers/fmide');
const { largeModel } = require('../tools/bench-calc.js');

async function openGraph(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
}
async function openSample(page){
  await openGraph(page);
  await page.click('#btnSample');
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('.bar-widget')).toHaveCount(2);
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
async function loadFile(page, file){
  await page.setInputFiles('#fileInput', file);
  await expect(page.locator('#board')).toBeVisible();
}
const g = (page, fn, arg) => page.evaluate(fn, arg);

test('the welcome screen: Open, the sample, and nothing else to press yet', async ({ page, pageErrors }) => {
  await openGraph(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#board')).toBeHidden();
  for(const id of ['btnAddBar', 'btnAddChart', 'btnAddSlider', 'btnResetAll']) await expect(page.locator('#' + id)).toBeDisabled();
  await expect(page.locator('#btnFromFmide')).toBeHidden(); // not opened by fmIDE
  await page.click('#btnSample');
  await expect(page.locator('#modelName')).toHaveText('Sample model');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  await expect(page.locator('.bar-widget')).toHaveCount(2);
  await expect(page.locator('.chart-widget')).toHaveCount(2);
  expect(await g(page, () => [fmGraph.value('Revenue', 1), fmGraph.value('Profit', 1), fmGraph.value('Closing cash', 4)])).toEqual([10000, 1500, 9400]);
  expect(pageErrors).toEqual([]);
});

// The values fmIDE shows (tests/snapshots/fmide-values--*, pinned by group 18) — fmGraph
// shows the same, rectangle by rectangle and period by period, errors where fmIDE has errors.
const SAMPLES = ['models', 'agreement', 'ir'].flatMap(dir => fs.readdirSync(path.join(FIXTURES, dir)).filter(f => f.endsWith('.json')).sort().map(f => [dir, f]));
for(const [dir, file] of SAMPLES){
  test(`${dir}/${file}: fmGraph's values are fmIDE's`, async ({ page }) => {
    const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'snapshots', 'fmide-values--' + dir + '--' + file.replace(/\.json$/, '') + '.json'), 'utf8'));
    await openGraph(page);
    await loadFile(page, fixture(dir, file));
    const rects = await g(page, () => fmGraph.rectangles());
    expect(rects.length).toBeGreaterThan(0);
    const shown = await g(page, (list) => list.map(r => {
      const out = [];
      for(let p = 1; ; p++){
        try{ out.push(fmGraph.value('#' + r.id, p, r.canvasId)); }catch(e){ if(/no period/.test(e.message)) break; throw e; }
      }
      return out;
    }), rects);
    let compared = 0;
    rects.forEach((r, i) => {
      const fm = snap[r.canvas] && snap[r.canvas][r.id];
      if(!fm || rects.filter(x => x.canvas === r.canvas).length !== rects.filter(x => x.canvasId === r.canvasId).length) return;
      fm.values.forEach((v, p) => {
        if(typeof v === 'number') expect(shown[i][p] + 0, `${r.canvas} / ${r.name}, period ${p + 1}`).toBe(v); // + 0: −0 is 0 (the snapshot's JSON has no −0)
        else expect(typeof shown[i][p], `${r.canvas} / ${r.name}, period ${p + 1}: fmIDE shows "${v}"`).toBe('object');
        compared++;
      });
    });
    expect(compared).toBeGreaterThan(0);
  });
}

test('a slider moves exactly the bars it reaches, and the model is never changed', async ({ page }) => {
  await openSample(page);
  await g(page, () => { fmGraph.addBar('Revenue'); fmGraph.addBar('Cost of sales'); });
  const s = await g(page, () => fmGraph.board().sliders.find(x => x.name === 'Price').id);
  await g(page, (id) => fmGraph.setSlider(id, 12), s);
  expect(await g(page, () => [fmGraph.value('Revenue', 1), fmGraph.value('Profit', 1), fmGraph.value('Closing cash', 4), fmGraph.value('Cost of sales', 1)]))
    .toEqual([12000, 3500, 1000 + 3500 + 4100 + 4700 + 5300, 6000]);
  // The model's own numbers are untouched.
  expect(await g(page, () => [fmGraph.modelValue('Price', 1), fmGraph.modelValue('Profit', 1)])).toEqual([10, 1500]);
  // Price reaches Revenue, Profit and Closing cash (through an alias), not Cost of sales; and both
  // charts, which show rectangles it reaches.
  const names = await g(page, (id) => { const b = fmGraph.board(); return fmGraph.reached(id).map(x => { const bar = b.bars.find(y => y.id === x); return bar ? bar.name : 'chart: ' + b.charts.find(y => y.id === x).title; }); }, s);
  expect(names.sort()).toEqual(['Closing cash', 'Profit', 'Revenue', 'chart: Balance sheet', 'chart: Profit']);
  // A dashed outline (the model's value) and the difference on the bars that moved.
  const revenue = page.locator('.bar-widget').filter({ has: page.locator('option:checked', { hasText: /^Revenue$/ }) });
  await expect(revenue.locator('.b-base')).toHaveCount(4);
  await expect(revenue.locator('.t-diff.up').first()).toHaveText('+2,000');
  const cogs = page.locator('.bar-widget').filter({ has: page.locator('option:checked', { hasText: /^Cost of sales$/ }) });
  await expect(cogs.locator('.b-base')).toHaveCount(0);
  // Reset all: back to the model.
  await page.click('#btnResetAll');
  expect(await g(page, () => fmGraph.value('Profit', 1))).toBe(1500);
  await expect(revenue.locator('.b-base')).toHaveCount(0);
});

test('dragging a slider with the mouse: the bars follow, the reached ones light up', async ({ page }) => {
  await openSample(page);
  const price = page.locator('.slider-widget').first();
  const range = price.locator('input[type=range]');
  const box = await range.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 6 });
  await expect(page.locator('#board')).toHaveClass(/moving/);
  await expect(page.locator('.bar-widget.reached')).toHaveCount(2);
  await expect(page.locator('.chart-widget.reached')).toHaveCount(2);
  await page.mouse.up();
  const v = Number(await range.inputValue());
  expect(v).toBeGreaterThan(10);
  expect(await price.locator('.slider-value').inputValue()).toBe(String(v));
  expect(await g(page, () => fmGraph.value('Revenue', 1))).toBe(v * 1000);
  // The keyboard: one step down from where it is.
  await range.focus();
  await page.keyboard.press('ArrowLeft');
  expect(await g(page, () => fmGraph.value('Revenue', 1))).toBe((v - 0.25) * 1000);
  // Typing a number.
  await price.locator('.slider-value').fill('7');
  await price.locator('.slider-value').press('Enter');
  expect(await g(page, () => fmGraph.value('Revenue', 1))).toBe(7000);
  // Reset on the slider.
  await price.getByRole('button', { name: 'Reset' }).click();
  expect(await g(page, () => fmGraph.value('Revenue', 1))).toBe(10000);
  expect(Number(await range.inputValue())).toBe(10);
});

test('a slider by finger', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url === 'http://local.test/fmGraph.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) });
    return route.abort();
  });
  await page.goto('http://local.test/fmGraph.html');
  await page.click('#btnSample');
  await expect(page.locator('.slider-widget')).toHaveCount(2);
  await page.evaluate(() => { window.__types = []; window.addEventListener('pointerdown', ev => window.__types.push(ev.pointerType), true); });
  const range = page.locator('.slider-widget').first().locator('input[type=range]');
  const box = await range.boundingBox();
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y }] });
  for(let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2 - i * (box.width / 14), y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => Array.from(new Set(window.__types)))).toEqual(['touch']);
  const v = Number(await range.inputValue());
  expect(v).toBeLessThan(10);
  expect(await page.evaluate(() => fmGraph.value('Revenue', 1))).toBe(v * 1000);
  await context.close();
});

test('change by %, one period, a range; sliders only on inputs', async ({ page }) => {
  await openSample(page);
  // Volume: +10% in Year 2 only.
  const id = await g(page, () => fmGraph.addSlider('Volume', { mode: 'shift', periods: 2 }));
  await g(page, (s) => fmGraph.setSlider(s, 10), id);
  expect(await g(page, () => [1, 2, 3, 4].map(p => fmGraph.value('Revenue', p)))).toEqual([10000, 12100, 12000, 13000]);
  // Set a number in Years 3 to 4.
  const id2 = await g(page, () => fmGraph.addSlider('Unit cost', { periods: [3, 4] }));
  await g(page, (s) => fmGraph.setSlider(s, 5), id2);
  // Volume in Year 2 is 1,100 + 10% = 1,210; Unit cost 5 in Years 3 and 4.
  expect(await g(page, () => [1, 2, 3, 4].map(p => fmGraph.value('Cost of sales', p)))).toEqual([6000, 7260, 6000, 6500]);
  // Only inputs: Revenue is calculated.
  expect(await g(page, () => { try{ fmGraph.addSlider('Revenue'); return 'added'; }catch(e){ return e.message; } })).toMatch(/not an input/);
  // The list of a slider's rectangles holds inputs only (Opening cash and Opening equity are fed
  // by last year's closing figure after Year 1, so they aren't).
  const options = await page.locator('.slider-widget').first().locator('select').first().locator('option').allTextContents();
  expect(options.sort()).toEqual(['Debt', 'Equipment', 'Overheads', 'Price', 'Unit cost', 'Volume']);
  // The periods chooser on a widget: one period.
  const bar = page.locator('.bar-widget').first();
  await bar.locator('select[aria-label="Periods"]').selectOption('one');
  await bar.locator('select[aria-label="Period"]').selectOption({ label: 'Year 3' });
  await expect(bar.locator('.b-period')).toHaveCount(1);
  await expect(bar.locator('.t-period')).toHaveText('Year 3');
});

test('the board is remembered for the model, the sliders start on the model\'s numbers', async ({ page }) => {
  await openSample(page);
  const s = await g(page, () => fmGraph.board().sliders[0].id);
  await g(page, (id) => { fmGraph.setSlider(id, 13); fmGraph.addBar('Gross profit', 2); }, s);
  await page.waitForTimeout(500); // saved shortly after a change
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.bar-widget')).toHaveCount(3);
  const b = await g(page, () => fmGraph.board());
  expect(b.bars.map(x => x.name)).toContain('Gross profit');
  expect(b.bars.find(x => x.name === 'Gross profit').periods).toEqual({ mode: 'one', p: 1 });
  expect(b.sliders.every(x => x.value === null)).toBe(true);
  expect(await g(page, () => fmGraph.value('Profit', 1))).toBe(1500);
});

test('another model with the same ids but other names does not pick up the board', async ({ page }) => {
  await openSample(page);
  await page.waitForTimeout(500); // the sample's board is saved
  const model = { kind: 'system', version: 9, periods: ['A', 'B'], canvases: [{ id: 'cProfit', name: 'X', nodes: [
    { id: 'price', type: 'value', x: 0, y: 0, text: 'Rate\n3' }, { id: 'rev', type: 'value', x: 200, y: 0, text: 'Result' }, { id: 'op', type: 'operator', x: 100, y: 0, text: '×' },
    { id: 'k', type: 'value', x: 0, y: 100, text: 'Count\n2' },
  ], edges: [{ id: 'e1', from: 'price', to: 'op' }, { id: 'e2', from: 'k', to: 'op' }, { id: 'e3', from: 'op', to: 'rev' }] }] };
  await g(page, (m) => fmGraph.load(m, 'Other'), model);
  const b = await g(page, () => fmGraph.board());
  // Its own starting board: a slider on its first input, a bar on what it reaches.
  expect(b.sliders.map(x => x.name)).toEqual(['Rate']);
  expect(b.bars.map(x => x.name)).toEqual(['Result']);
});

test('files: hostile names are text, the wrong kind is refused, a newer version is asked about', async ({ page, pageErrors }) => {
  await openGraph(page);
  const evil = '<img src=x onerror="window.__pwned=1">';
  const model = { kind: 'system', version: 9, periods: [evil, 'P2'], canvases: [{ id: 'c1', name: evil, nodes: [
    { id: 'a', type: 'value', x: 0, y: 0, text: evil + '\n5' }, { id: 'o', type: 'operator', x: 100, y: 0, text: '+' }, { id: 'b', type: 'value', x: 200, y: 0, text: '<b>Out</b>' },
  ], edges: [{ id: 'e1', from: 'a', to: 'o' }, { id: 'e2', from: 'o', to: 'b' }] }] };
  const file = test.info().outputPath('evil.json');
  fs.writeFileSync(file, JSON.stringify(model));
  await loadFile(page, file);
  await expect(page.locator('.bar-widget')).toHaveCount(1);
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.locator('#board b').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(page.locator('.bar-widget select').first()).toContainText('<b>Out</b>');
  await expect(page.locator('.bar-widget .t-period').first()).toHaveText(evil.slice(0, 40));
  // The wrong kind of file.
  const tpl = test.info().outputPath('templates.json');
  fs.writeFileSync(tpl, JSON.stringify({ kind: 'fmIDE-templates', version: 9, templates: [] }));
  await page.setInputFiles('#fileInput', tpl);
  await expect(page.locator('.note.err')).toContainText('not a whole model');
  // Not JSON.
  const junk = test.info().outputPath('junk.json');
  fs.writeFileSync(junk, 'not json');
  await page.setInputFiles('#fileInput', junk);
  await expect(page.locator('.note.err')).toContainText("isn't JSON");
  // A newer version: asked first; Cancel opens nothing.
  const newer = test.info().outputPath('newer.json');
  fs.writeFileSync(newer, JSON.stringify(Object.assign({}, model, { version: 99, periods: ['N1'] })));
  await page.setInputFiles('#fileInput', newer);
  await expect(page.locator('#confirmBox')).toBeVisible();
  await expect(page.locator('#confirmTitle')).toHaveText('Saved by a newer version');
  await page.click('#confirmNo');
  expect(await g(page, () => fmGraph.rectangles()[0].name)).toBe(evil);
  await page.setInputFiles('#fileInput', newer);
  await page.click('#confirmYes');
  await expect(page.locator('.bar-widget .t-period').first()).toHaveText('N1');
  expect(pageErrors).toEqual([]);
});

test('a .fmide document (a workspace) opens, dropped on the page', async ({ page }) => {
  await openGraph(page);
  const text = fs.readFileSync(fixture('models', 'roles-workspace-defaults.json'), 'utf8');
  const dt = await page.evaluateHandle((t) => { const d = new DataTransfer(); d.items.add(new File([t], 'Plan.fmide', { type: '' })); return d; }, text);
  await page.dispatchEvent('main', 'dragenter', { dataTransfer: dt });
  await expect(page.locator('body')).toHaveClass(/file-over/);
  await page.dispatchEvent('main', 'drop', { dataTransfer: dt });
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#modelName')).toHaveText('Plan');
  await expect(page.locator('body')).not.toHaveClass(/file-over/);
});

test('fmIDE: Open fmGraph shows its model straight away, ↻ From fmIDE shows it again after a change', async ({ page }) => {
  await openFmIDE(page);
  await page.evaluate(() => {
    fm.clearCanvas();
    const a = fm.createRect({ name: 'Hours', value: 8, x: 40, y: 40 });
    const b = fm.createRect({ name: 'Rate', value: 50, x: 40, y: 160 });
    const op = fm.createOperator({ op: '×', x: 240, y: 100 });
    const c = fm.createRect({ name: 'Pay', x: 340, y: 100 });
    fm.connect(a, op); fm.connect(b, op); fm.connect(op, c);
  });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
  await popup.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
  await expect(popup.locator('#btnFromFmide')).toBeVisible();
  expect(await popup.evaluate(() => fmGraph.value('Pay', 1))).toBe(400);
  // A change in fmIDE, then ↻ From fmIDE.
  await page.evaluate(() => fm.setValue('Hours', 10));
  await popup.click('#btnFromFmide');
  await expect.poll(() => popup.evaluate(() => fmGraph.value('Pay', 1))).toBe(500);
  // Open fmGraph again: the same window, brought up to date.
  await page.evaluate(() => fm.setValue('Rate', 60));
  await page.evaluate(() => fm.command('openFmGraph'));
  await expect.poll(() => popup.evaluate(() => fmGraph.value('Pay', 1))).toBe(600);
  // A message from any other window is ignored (here: the page itself).
  await popup.evaluate(() => window.postMessage({ type: 'fmIDE:model', name: 'Fake', text: JSON.stringify({ kind: 'system', version: 9, periods: ['X'], canvases: [{ id: 'z', name: 'Z', nodes: [{ id: 'q', type: 'value', x: 0, y: 0, text: 'Fake\n1' }], edges: [] }] }) }, '*'));
  await popup.waitForTimeout(300);
  expect(await popup.evaluate(() => fmGraph.rectangles().map(r => r.name))).not.toContain('Fake');
  // fmIDE answers only the window it opened.
  const answered = await page.evaluate(() => new Promise(resolve => {
    const w = window.open('', 'other');
    let got = false;
    w.addEventListener('message', () => { got = true; });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'fmGraph:want-model' }, source: w, origin: location.origin }));
    setTimeout(() => { w.close(); resolve(got); }, 300);
  }));
  expect(answered).toBe(false);
  // ← Back to fmIDE closes fmGraph's window.
  // (The window may close before the click itself has finished: only the closing counts.)
  await Promise.all([popup.waitForEvent('close'), popup.click('#backToFmide', { noWaitAfter: true }).catch(() => {})]);
  expect(popup.isClosed()).toBe(true);
});

test('fmIDE: Open fmGraph sits in the File tab\'s App group, and a customised ribbon gets it once', async ({ page }, testInfo) => {
  await openFmIDE(page);
  const app = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'file').groups.find(g => g.label === 'App').items.map(i => i.cmd));
  expect(app).toEqual(['openExcelExporter', 'openFmGraph', 'installApp']);
  // A ribbon customised before step 15: Open fmGraph goes in after its Open ExcelExporter, once.
  const load = async (ui, name) => {
    const file = testInfo.outputPath(name);
    const ws = { kind: 'fmIDE-workspace', version: 10, system: { kind: 'system', version: 9, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] }, ui };
    fs.writeFileSync(file, JSON.stringify(ws));
    await importViaCommand(page, 'importWorkspace', file);
    await acceptAll(page);
    return page.evaluate(() => __fmIDE.getRibbonConfig().tabs.map(t => t.groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(','))));
  };
  const older = { ribbonCustomized: true, zoomGroupAdded: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
    operatorsE2Added: true, operatorsE2bAdded: true, libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: true, whatsNewAdded: true, addManyRectsAdded: true,
    ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Apps', items: [{ cmd: 'openExcelExporter', size: 'large' }, { cmd: 'undo' }] }] }] } };
  expect(await load(older, 'older.json')).toEqual([['Apps:openExcelExporter,openFmGraph,undo']]);
  // Once added, a ribbon without it (removed by the person) stays without it.
  expect(await load(Object.assign({}, older, { fmGraphAdded: true }), 'removed.json')).toEqual([['Apps:openExcelExporter,undo']]);
});

test('a large model: grabbing a slider works out its steps ahead, then dragging reads them', async ({ page }) => {
  await openGraph(page);
  await g(page, (m) => fmGraph.load(m, 'Large'), largeModel());
  const ms = await g(page, () => fmGraph.calcTime());
  test.skip(ms < 25, 'this machine works the large model out in ' + ms.toFixed(1) + ' ms: no need to work ahead');
  const range = page.locator('.slider-widget input[type=range]').first();
  const box = await range.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('#calcNote')).toContainText('Working out');
  await expect(page.locator('#calcNote')).toHaveText('', { timeout: 60000 });
  // Every step is ready: moving across the whole slider takes no new run.
  const t = Date.now();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  expect(Date.now() - t).toBeLessThan(ms * 10 + 2000);
  const sid = await g(page, () => fmGraph.board().sliders[0].id);
  const value = await g(page, (id) => fmGraph.board().sliders.find(s => s.id === id).value, sid);
  expect(value).toBe(Number(await range.inputValue()));
});

test('Help: F1 and ❓ open fmGraph\'s own topics; What\'s new', async ({ page }) => {
  await openGraph(page);
  await expect(page.locator('#btnHelp')).toHaveClass(/has-news/);
  await page.keyboard.press('F1');
  const panel = page.locator('.help-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('What fmGraph is');
  await expect(panel).toContainText('fmGraph: see how a value moves your model');
  await page.click('#btnHelp');
  await expect(panel).toBeHidden();
});

// The published site: fmGraph.html under its own security policy, kept for offline use, and
// "Back to fmIDE" leading to the site's front page. Nothing goes to another site.
test('on the site: its security policy lets it run, it works offline, Back leads to fmIDE', async ({ browser }) => {
  const W = require('./helpers/site');
  const site = await W.startSiteServer();
  const context = await browser.newContext();
  const seen = [];
  context.on('request', r => seen.push(r.url()));
  try{
    const page = await context.newPage();
    const violations = [];
    page.on('console', m => { if(/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
    await W.openSite(page, site.origin); // fmIDE registers the service worker
    await W.waitForController(page);
    const headers = fs.readFileSync(path.join(site.dir, '_headers'), 'utf8');
    expect(headers).toMatch(/\/fmGraph\.html\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-/);
    await site.close(); // offline from here
    await page.goto(site.origin + 'fmGraph.html');
    await page.waitForFunction(() => !!window.fmGraph);
    await page.click('#btnSample');
    await expect(page.locator('.bar-widget')).toHaveCount(2);
    expect(await page.locator('#backToFmide').getAttribute('href')).toBe('./');
    expect(violations).toEqual([]);
    expect(seen.filter(u => !u.startsWith(site.origin))).toEqual([]);
  } finally {
    await context.close();
    await site.close().catch(() => {});
    fs.rmSync(site.dir, { recursive: true, force: true });
  }
});

// Opened straight from disk (file: addresses, which Chrome gives the origin "file://"): Open
// fmGraph still hands the model over.
test('opened from disk: Open fmGraph still hands the model over', async ({ browser }) => {
  const context = await browser.newContext();
  const outside = [];
  await context.route('**/*', route => { const u = route.request().url(); if(u.startsWith('file:')) return route.continue(); outside.push(u); return route.abort(); });
  try{
    const page = await context.newPage();
    await page.goto('file://' + path.join(ROOT, 'apps', 'fmIDE.html'));
    await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
    await page.evaluate(() => { fm.clearCanvas(); fm.createRect({ name: 'Only', value: 7, x: 40, y: 40 }); });
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openFmGraph'))]);
    await popup.waitForFunction(() => !!window.fmGraph && fmGraph.rectangles().length > 0);
    expect(await popup.evaluate(() => fmGraph.value('Only', 1))).toBe(7);
    expect(outside).toEqual([]);
  } finally {
    await context.close();
  }
});
