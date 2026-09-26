// 7. UI flows — fmIDE.
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');

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
  const breakStorage = () => S.breakStorage(page);
  const fixStorage = () => S.fixStorage(page);
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

// ---------- Templates search ----------
test.describe('Templates search', () => {
  const { fixture } = require('./helpers/apps');
  const picker = (page) => page.locator('.modal-box.template-box');
  const search = (page) => picker(page).locator('input.template-search');
  const listNames = async (page) => (await picker(page).locator('.template-list button').allInnerTexts()).map(t => t.split('\n')[0]);
  const selectedName = (page) => picker(page).locator('.template-list button.active');
  const rectNames = (page) => page.evaluate(() => fm.nodes().filter(n => n.type === 'value').map(n => n.text.split('\n')[0]));

  // Import four templates, then reopen the window fresh.
  async function openWithTemplates(page){
    await F.openFmIDE(page);
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', fixture('templates', 'search.json'));
    await F.dismissMessage(page);
    await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
    await expect(picker(page)).toHaveCount(0);
    await page.evaluate(() => fm.command('openTemplates'));
    await expect(picker(page)).toBeVisible();
  }

  test('the search box has the cursor when the window opens', async ({ page }) => {
    await openWithTemplates(page);
    await expect(search(page)).toBeFocused();
  });

  test('typing narrows the list, best match first, and previews it; clearing restores the groups', async ({ page }) => {
    await openWithTemplates(page);
    await page.keyboard.type('inc st');
    // A name match comes first; "Cash flow statement" matches only through its group "Financial Statement".
    expect(await listNames(page)).toEqual(['Income Statement', 'Cash flow statement']);
    await expect(selectedName(page)).toContainText('Income Statement');
    await expect(picker(page).locator('.template-detail h4')).toHaveText('Income Statement');
    // Matches the group and description too, after name matches.
    await search(page).fill('straight');
    expect(await listNames(page)).toEqual(['Depreciation schedule']);
    await search(page).fill('zzzz');
    await expect(picker(page).locator('.template-list')).toContainText('No matching templates');
    await search(page).fill('');
    expect((await listNames(page)).sort()).toEqual(['Audit BS', 'Cash flow statement', 'Depreciation schedule', 'Income Statement']);
    await expect(picker(page).locator('.template-list')).toContainText('Financial Statement');
  });

  test('arrow keys move the selection; Enter adds the selected canvas template', async ({ page }) => {
    await openWithTemplates(page);
    await page.keyboard.type('statement');
    expect(await listNames(page)).toEqual(['Income Statement', 'Cash flow statement']);
    await page.keyboard.press('ArrowDown');
    await expect(selectedName(page)).toContainText('Cash flow statement');
    await expect(search(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(picker(page)).toHaveCount(0);
    expect(await rectNames(page)).toContain('CF Rect');
    expect(await rectNames(page)).not.toContain('IS Rect');
  });

  test('Esc closes the window', async ({ page }) => {
    await openWithTemplates(page);
    await page.keyboard.press('Escape');
    await expect(picker(page)).toHaveCount(0);
  });
});

// ---------- Templates duplicates ----------
test.describe('Templates duplicates', () => {
  const fs = require('fs');
  const { fixture, readFixture } = require('./helpers/apps');
  const picker = (page) => page.locator('.modal-box.template-box');
  const listNames = async (page) => (await picker(page).locator('.template-list button').allInnerTexts()).map(t => t.split('\n')[0]).sort();
  const FOUR = ['Audit BS', 'Cash flow statement', 'Depreciation schedule', 'Income Statement'];
  const importTemplates = (page, name) => F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', fixture('templates', name));
  const closePicker = (page) => picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();

  test('importing templates you already have adds nothing and says so', async ({ page }) => {
    await F.openFmIDE(page);
    await importTemplates(page, 'search.json');
    await F.dismissMessage(page);
    await closePicker(page);
    await importTemplates(page, 'search.json');
    expect(await F.dialogText(page)).toBe('All 4 templates in that file are already in your library.');
    await F.dismissMessage(page);
    expect(await listNames(page)).toEqual(FOUR);
  });

  test('only the templates you don\'t have are added', async ({ page }) => {
    await F.openFmIDE(page);
    await importTemplates(page, 'search.json');
    await F.dismissMessage(page);
    await closePicker(page);
    await importTemplates(page, 'one-new.json');
    expect(await F.dialogText(page)).toBe('Imported 1 template (1 was already there).');
    await F.dismissMessage(page);
    expect(await listNames(page)).toEqual([...FOUR, 'Tax schedule'].sort());
  });

  test('Import Workspace of your own export does not copy your templates again', async ({ page }, testInfo) => {
    await F.openFmIDE(page);
    await importTemplates(page, 'search.json');
    await F.dismissMessage(page);
    await closePicker(page);
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    expect(data.templates).toHaveLength(4);
    const file = testInfo.outputPath('own-workspace.json');
    fs.writeFileSync(file, JSON.stringify(data));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    await page.evaluate(() => fm.command('openTemplates'));
    expect(await listNames(page)).toEqual(FOUR);
  });

  // Seeds the autosave (as an older version left it) with these templates, before start-up.
  function seedTemplates(page, templates){
    const ws = { version: 1, kind: 'fmIDE-workspace', system: readFixture('formats', 'sys-current.json'), templates, formatPresets: [] };
    return page.addInitScript((text) => {
      if(sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('fmIDE-workspace-v1', text);
    }, JSON.stringify(ws));
  }
  // The four search.json templates twice — each copy with its original's id, as an older
  // Import Workspace left them — plus an "Audit BS" with different content.
  function copiesSharingIds(){
    const tpl = readFixture('templates', 'search.json').templates;
    const withIds = tpl.map((t, i) => Object.assign({ id: 'usr' + (i + 1) }, t));
    const other = JSON.parse(JSON.stringify(withIds[3]));
    other.id = 'usr5';
    other.data.canvases[0].nodes[0].text = 'Audit Rect\n2';
    return [...withIds, ...JSON.parse(JSON.stringify(withIds)), other];
  }
  const selectTemplate = (page, name, nth = 0) => picker(page).locator('.template-list button', { hasText: name }).nth(nth).click();

  test('"Remove duplicates" removes exact copies only, after asking — even when copies share an id', async ({ page }) => {
    await seedTemplates(page, copiesSharingIds());
    await F.openFmIDE(page);
    expect(await page.evaluate(() => fm.commands().find(c => c.id === 'removeDuplicateTemplates').label)).toBe('Remove Duplicate Templates');
    await page.evaluate(() => fm.command('openTemplates'));
    expect((await listNames(page)).length).toBe(9);
    const btn = picker(page).locator('button.template-dedupe');
    await expect(btn).toHaveText('🧹 Remove 4 duplicates');
    await btn.click();
    expect(await F.dialogText(page)).toContain('Remove 4 duplicate templates?');
    await F.confirmDanger(page);
    expect(await listNames(page)).toEqual(['Audit BS', 'Audit BS', 'Cash flow statement', 'Depreciation schedule', 'Income Statement']);
    await expect(btn).toBeHidden();
  });

  test('deleting one of two copies that shared an id deletes only that one', async ({ page }) => {
    await seedTemplates(page, copiesSharingIds());
    await F.openFmIDE(page);
    await page.evaluate(() => fm.command('openTemplates'));
    await selectTemplate(page, 'Income Statement', 1);
    await expect(picker(page).locator('.template-list button.active')).toHaveCount(1);
    await picker(page).locator('.template-detail button', { hasText: 'Delete' }).click();
    await F.confirmDanger(page);
    expect((await listNames(page)).filter(n => n === 'Income Statement')).toHaveLength(1);
    expect((await listNames(page)).length).toBe(8);
  });

  test('a template added after a restart gets a new id, so deleting it leaves the others', async ({ page }) => {
    const tpl = readFixture('templates', 'search.json').templates.map((t, i) => Object.assign({ id: 'usr' + (i + 1) }, t));
    await seedTemplates(page, tpl);
    await F.openFmIDE(page);
    await importTemplates(page, 'one-new.json'); // adds "Tax schedule" only
    await F.dismissMessage(page);
    await selectTemplate(page, 'Tax schedule');
    await picker(page).locator('.template-detail button', { hasText: 'Delete' }).click();
    await F.confirmDanger(page);
    expect(await listNames(page)).toEqual(FOUR);
  });

  test('"Clear all templates" asks first, then removes every template and nothing else', async ({ page }) => {
    await F.openFmIDE(page);
    const canvasesBefore = await page.evaluate(() => fm.canvases().map(c => c.name));
    await importTemplates(page, 'search.json');
    await F.dismissMessage(page);
    const btn = picker(page).locator('button.template-clear-all');
    await expect(btn).toHaveText('🗑 Clear all templates');
    await btn.click();
    expect(await F.dialogText(page)).toContain('Delete all 4 templates?');
    await F.cancelDialog(page);
    expect(await listNames(page)).toEqual(FOUR);
    await btn.click();
    await F.confirmDanger(page);
    await expect(picker(page).locator('.template-list')).toContainText('No templates yet');
    await expect(btn).toBeHidden();
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(canvasesBefore);
    expect(await page.evaluate(() => fm.commands().some(c => c.id === 'clearAllTemplates'))).toBe(true);
  });
});
