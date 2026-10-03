// 59. ExcelExporter reads the model open in fmIDE. Opened by fmIDE's Open ExcelExporter (its own
// window), ExcelExporter asks fmIDE for its model and loads it like a file dropped there: the
// model, its format presets, and the canvas templates whose Excel layout it may use. File →
// ↻ From fmIDE, or Open ExcelExporter again, loads it as it is now. Only the window fmIDE opened
// is answered, and ExcelExporter listens only to the window that opened it.
const { test, expect, fixture, openApp, ORIGIN } = require('./helpers/apps');
const F = require('./helpers/fmide');
const D = require('./helpers/documents');
const X = require('./helpers/excel');

const treeLabels = (p) => p.locator('#rowsPanel .tree-row-label').allTextContents();
const tabNames = (p) => p.locator('#tabsBody input[type=text]').evaluateAll(els => els.map(e => e.value));

async function buildPay(page){
  await page.evaluate(() => {
    fm.clearCanvas();
    const a = fm.createRect({ name: 'Hours', value: 8, x: 40, y: 40 });
    const b = fm.createRect({ name: 'Rate', value: 50, x: 40, y: 160 });
    const op = fm.createOperator({ op: '×', x: 240, y: 100 });
    const c = fm.createRect({ name: 'Pay', x: 340, y: 100 });
    fm.connect(a, op); fm.connect(b, op); fm.connect(op, c);
  });
}
async function openExcelFromFmide(page){
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
  await popup.waitForLoadState();
  await expect(popup.locator('#afterLoad')).toBeVisible();
  return popup;
}
// The number typed for an input, as the workbook holds it (period 1, the cell that is no formula).
async function inputOf(popup, label){
  const { wb } = await X.generate(popup);
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name];
    const col = X.periodOneCol(ws);
    for(const row of X.findRow(ws, label)){
      const cell = col && ws[X.numToCol(col) + row];
      if(cell && typeof cell.v === 'number' && !X.formulaOf(cell)) return cell.v;
    }
  }
  return null;
}

test('opened from fmIDE, it shows fmIDE\'s model; From fmIDE and Open again bring it up to date', async ({ page, pageErrors }) => {
  await F.openFmIDE(page);
  await buildPay(page);
  const popup = await openExcelFromFmide(page);
  await expect(popup.locator('#modelName')).toHaveText('Untitled');
  await expect(popup.locator('#loadStatus .status.ok')).toContainText('“Untitled” from fmIDE');
  await expect(popup.locator('#loadPanel')).toBeHidden();
  expect(await treeLabels(popup)).toEqual(expect.arrayContaining(['Hours', 'Rate', 'Pay']));
  expect(await inputOf(popup, 'Hours')).toBe(8);
  // A layout change made here, a new number in fmIDE, then File → ↻ From fmIDE: the model as
  // it is now, the layout kept (it is remembered for the model, as for a file loaded again).
  const tab = popup.locator('#tabsBody input[type=text]').first();
  await tab.fill('My Pay');
  await tab.dispatchEvent('change');
  await page.evaluate(() => fm.setValue('Hours', 10));
  await expect(popup.locator('#btnFromFmide')).toBeHidden(); // inside the closed menu
  await X.menuCommand(popup, 'btnFromFmide');
  await expect.poll(() => inputOf(popup, 'Hours')).toBe(10);
  expect(await tabNames(popup)).toContain('My Pay');
  // A new rectangle in fmIDE arrives too.
  await page.evaluate(() => fm.createRect({ name: 'Bonus', value: 5, x: 40, y: 280 }));
  await X.menuCommand(popup, 'btnFromFmide');
  await expect.poll(() => treeLabels(popup)).toContain('Bonus');
  // Open ExcelExporter again: the same window, brought up to date.
  await popup.evaluate(() => { window.__stillHere = true; });
  await page.evaluate(() => fm.setValue('Rate', 60));
  await page.evaluate(() => fm.command('openExcelExporter'));
  await expect.poll(() => inputOf(popup, 'Rate')).toBe(60);
  expect(await popup.evaluate(() => window.__stillHere)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('the name fmIDE sends is shown as text, and the menu item is reached by keyboard', async ({ page }) => {
  await F.openFmIDE(page);
  await buildPay(page);
  const popup = await openExcelFromFmide(page);
  // fmIDE's own window sending a name with markup in it (fmIDE itself tidies document names).
  const hostile = '<img src=x onerror="window.__pwned=1">Sales';
  await page.evaluate((name) => {
    const w = window.open('', 'fmIDE-ExcelExporter');
    w.postMessage({ type: 'fmIDE:model', name, text: JSON.stringify(buildSystemPayloadForTest()) }, location.origin);
    function buildSystemPayloadForTest(){
      return { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c1', name: 'Main', nodes: [{ id: 'n1', type: 'value', x: 40, y: 40, text: 'Price\n5' }], edges: [] }] };
    }
  }, hostile);
  await expect(popup.locator('#modelName')).toHaveText(hostile);
  await expect(popup.locator('#loadStatus .status.ok')).toContainText(hostile);
  expect(await popup.locator('#modelName img, #notices img').count()).toBe(0);
  expect(await popup.evaluate(() => window.__pwned)).toBeUndefined();
  // File menu by keyboard: ↓ from the menu's name, then End reaches its last item, ↑ the one before.
  await popup.locator('#menuFile').focus();
  await popup.keyboard.press('ArrowDown');
  const items = await popup.locator('#menuFileList [role=menuitem]:not(.hidden)').allTextContents();
  expect(items).toEqual(['Open Model…', 'Load Sample Model', 'Paste JSON…', '↻ From fmIDE', 'Start Over']);
  for(let i = 0; i < 3; i++) await popup.keyboard.press('ArrowDown');
  await expect(popup.locator('#btnFromFmide')).toBeFocused();
});

test('a template\'s attached Excel layout comes along with the model', async ({ page }) => {
  await F.openFmIDE(page);
  await D.openViaInput(page, 'openDocument', fixture('module-layouts', 'doc-with-layouts.json'));
  await page.waitForFunction(() => fm.canvases().some(c => c.name === 'Sales (Gold)'));
  const popup = await openExcelFromFmide(page);
  expect(await tabNames(popup)).toEqual(['Overview', 'Sales from v1']);
  await expect(popup.locator('#tabsBody .module-tag').first()).toHaveText('🧩 Sales · layout from the template');
});

test('messages from other windows are ignored, and fmIDE answers only the window it opened', async ({ page }) => {
  await F.openFmIDE(page);
  await buildPay(page);
  const popup = await openExcelFromFmide(page);
  // A model from any window but fmIDE (here: the page itself) is ignored.
  await popup.evaluate(() => window.postMessage({ type: 'fmIDE:model', name: 'Fake', text: JSON.stringify({ kind: 'system', version: 9, periods: ['X'], canvases: [{ id: 'z', name: 'Z', nodes: [{ id: 'q', type: 'value', x: 0, y: 0, text: 'Fake\n1' }], edges: [] }] }) }, '*'));
  await popup.waitForTimeout(300);
  expect(await treeLabels(popup)).not.toContain('Fake');
  await expect(popup.locator('#modelName')).toHaveText('Untitled');
  // fmIDE answers no other window, not even one it opened under another name.
  const answered = await page.evaluate(() => new Promise(resolve => {
    const w = window.open('', 'other');
    let got = false;
    w.addEventListener('message', () => { got = true; });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'excel:want-model' }, source: w, origin: location.origin }));
    setTimeout(() => { w.close(); resolve(got); }, 300);
  }));
  expect(answered).toBe(false);
});

test('a broken model from fmIDE is said in words and changes nothing', async ({ page }) => {
  await F.openFmIDE(page);
  await buildPay(page);
  const popup = await openExcelFromFmide(page);
  // What a broken answer would do: fmIDE's own window sending text that is not a model.
  await page.evaluate(() => {
    const w = window.open('', 'fmIDE-ExcelExporter');
    w.postMessage({ type: 'fmIDE:model', name: 'Broken', text: '{"kind":"fmIDE-macros","version":1,"macros":[]}' }, location.origin === 'null' ? '*' : location.origin);
  });
  await expect(popup.locator('#loadStatus .status.err')).toBeVisible();
  await expect(popup.locator('#modelName')).toHaveText('Untitled');
  expect(await treeLabels(popup)).toContain('Pay');
});

test('opened on its own, nothing changes: the welcome screen, and no From fmIDE', async ({ page, pageErrors }) => {
  await openApp(page, 'ExcelExporter');
  await expect(page.locator('#dropZone')).toBeVisible();
  await page.click('#menuFile');
  await expect(page.locator('#btnFromFmide')).toBeHidden();
  await expect(page.locator('#btnOpenModel')).toBeVisible();
  expect(page.url()).toBe(ORIGIN + 'ExcelExporter.html');
  expect(pageErrors).toEqual([]);
});

test('after fmIDE is reloaded, From fmIDE still reaches it', async ({ page }) => {
  await F.openFmIDE(page);
  await buildPay(page);
  const popup = await openExcelFromFmide(page);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
  await page.evaluate(() => fm.setValue('Hours', 9));
  await X.menuCommand(popup, 'btnFromFmide');
  await expect.poll(() => inputOf(popup, 'Hours')).toBe(9);
});
