// 7. UI flows — fmIDE.
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

const ROLES = ['Inputs', 'Calculations', 'Links', 'Headers', 'Section Headers', 'Labels', 'Notes'];
const nodeEl = (page, id) => page.locator(`.node[data-id="${id}"]`);
const look = (loc) => loc.evaluate(e => { const s = getComputedStyle(e); return { background: s.backgroundColor, border: s.borderTopColor, borderWidth: s.borderTopWidth, color: s.color }; });

// Unit Price × Volume → Revenue, built with the automation API.
async function buildRevenue(page){
  return page.evaluate(() => {
    fm.clearCanvas();
    const up = fm.createRect({ x: 100, y: 80, name: 'Unit Price', value: '10' });
    const vol = fm.createRect({ x: 100, y: 240, name: 'Volume', value: '5' });
    const op = fm.createOperator({ x: 360, y: 160, op: '×' });
    const rev = fm.createRect({ x: 520, y: 150, name: 'Revenue', value: '0' });
    fm.connect('Unit Price', op); fm.connect('Volume', op); fm.connect(op, 'Revenue');
    return { up, vol, op, rev };
  });
}

test.describe('canvas', () => {
  test('Unit Price × Volume → Revenue: the model computes and the arrow markup is stable', async ({ page }) => {
    await F.openFmIDE(page);
    const ids = await buildRevenue(page);
    expect(await page.evaluate(() => fm.edges().length)).toBe(3);
    expect(await page.evaluate((id) => fm.getValue({ node: id }), ids.rev)).toBe(50);
    const markup = await page.locator('svg#edges').evaluate(e => e.outerHTML);
    expect(markup.replace(/></g, '>\n<') + '\n').toMatchSnapshot('fmide-revenue-arrows.svg');
  });

  test('a rectangle fed by an operator with no inputs gets the Inputs look', async ({ page }) => {
    await F.openFmIDE(page);
    const ids = await page.evaluate(() => {
      fm.clearCanvas();
      const input = fm.createRect({ x: 100, y: 80, name: 'Plain Input', value: '10' });
      const empty = fm.createOperator({ x: 360, y: 90, op: '+' });
      const fed = fm.createRect({ x: 520, y: 80, name: 'Fed By Empty Op', value: '3' });
      fm.connect(empty, 'Fed By Empty Op');
      const a = fm.createRect({ x: 100, y: 300, name: 'Source', value: '1' });
      const op = fm.createOperator({ x: 360, y: 310, op: '+' });
      const calc = fm.createRect({ x: 520, y: 300, name: 'Calc', value: '0' });
      fm.connect('Source', op); fm.connect(op, 'Calc');
      return { input, fed, calc };
    });
    const inputLook = await look(nodeEl(page, ids.input));
    expect(await look(nodeEl(page, ids.fed))).toEqual(inputLook);
    expect(await look(nodeEl(page, ids.calc))).not.toEqual(inputLook);
  });
});

test.describe('format dialogs', () => {
  test('the Formats manager lists the 7 roles first, with delete disabled', async ({ page }) => {
    await F.openFmIDE(page);
    await page.evaluate(() => fm.command('openFormats'));
    const rows = page.locator('.modal-box .picker-row');
    await expect(rows.first()).toBeVisible();
    const names = await rows.locator('strong').allTextContents();
    expect(names.slice(0, 7)).toEqual(ROLES);
    for(let i = 0; i < 7; i++) await expect(rows.nth(i).locator('button', { hasText: '🗑' })).toBeDisabled();
  });

  test('the rectangle format dialog has the Excel settings', async ({ page }) => {
    await F.openFmIDE(page);
    const ids = await buildRevenue(page);
    const node = nodeEl(page, ids.rev);
    await node.hover();
    await node.locator('.props-btn').click();
    const dialog = F.topDialog(page);
    await expect(dialog).toContainText('Use this fill, font colour & border in Excel too');
    await expect(dialog).toContainText('Excel border sides');
    await expect(dialog).toContainText("Use Excel's default font size");
  });
});

test('autosave failure banner', async ({ page }) => {
  await page.clock.install();
  await F.openFmIDE(page);
  const breakStorage = () => page.evaluate(() => {
    window.__realSetItem = window.__realSetItem || Storage.prototype.setItem;
    Storage.prototype.setItem = function(){ throw new DOMException('full', 'QuotaExceededError'); };
  });
  const fixStorage = () => page.evaluate(() => { Storage.prototype.setItem = window.__realSetItem; });
  const banner = page.locator('#autosaveBanner');
  const tick = () => page.clock.runFor(9000);

  await breakStorage();
  await tick();
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Autosave failed');

  // "Export workspace now" downloads the workspace.
  const exported = await F.downloadJson(page, () => banner.locator('button', { hasText: 'Export workspace now' }).click());
  expect(exported.data.kind).toBe('fmIDE-workspace');

  // Dismiss: stays hidden while saving keeps failing.
  await banner.locator('button', { hasText: 'Dismiss' }).click();
  await expect(banner).toBeHidden();
  await tick();
  await expect(banner).toBeHidden();

  // A successful save, then a new failure: it comes back.
  await fixStorage();
  await tick();
  await expect(banner).toBeHidden();
  await breakStorage();
  await tick();
  await expect(banner).toBeVisible();

  // Once saving works again it disappears by itself.
  await fixStorage();
  await tick();
  await expect(banner).toBeHidden();
});
