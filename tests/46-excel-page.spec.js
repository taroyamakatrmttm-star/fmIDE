// 46. ExcelExporter's page: the top bar's menus (every file and reset), Settings (this model's
// workbook and your Excel style), the welcome screen, dropping a file anywhere, Paste JSON, the
// tabs beside the rows, the Tree first, messages that can be dismissed, and little text on the page.
// What each button does is covered by the groups that own it (4, 6, 7, 9, 36, 39); this group
// covers where they are and how the page around them behaves.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

const MODEL = fixture('models', 'revenue-bs-corkscrew.json');
const list = (page, id) => page.locator('#' + id + 'List');
const box = (page, sel) => page.locator(sel).boundingBox();
const panel = (page) => page.locator('#helpPanel');

test.describe('the page', () => {
  test.beforeEach(async ({ page }) => { await X.openExporter(page); });

  test('before a model: the welcome screen, Generate off, this model\'s menu items off', async ({ page, pageErrors }) => {
    await expect(page.locator('#loadPanel')).toBeVisible();
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#afterLoad')).toBeHidden();
    await expect(page.locator('#btnGenerate')).toBeDisabled();
    await expect(page.locator('#modelName')).toHaveText('');
    await page.click('#menuLayout');
    for(const id of ['btnImportMapping', 'btnExportMapping', 'btnResetMapping']){
      await expect(page.locator('#' + id)).toBeDisabled();
      await expect(page.locator('#' + id)).toHaveAttribute('title', 'Load a model first');
    }
    for(const id of ['btnImportModuleLayouts', 'btnExportModuleLayouts', 'btnMenuStyle']) await expect(page.locator('#' + id)).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });

  test('after loading: the welcome screen goes, the model\'s name shows, the tabs beside the rows, the Tree first; Start Over brings it back', async ({ page, pageErrors }) => {
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await expect(page.locator('#loadPanel')).toBeHidden();
    await expect(page.locator('#modelName')).toHaveText('revenue-bs-corkscrew.json');
    await expect(page.locator('#btnGenerate')).toBeEnabled();
    await expect(page.locator('#viewByTree')).toHaveClass(/active/);
    await expect(page.locator('#rowGroupsTree .tree-row').first()).toBeVisible();
    await expect(page.locator('#rowGroups')).toBeHidden();
    const tabs = await box(page, '#tabsPanel'), rows = await box(page, '#rowsPanel');
    expect(rows.x, 'the rows beside the tabs').toBeGreaterThan(tabs.x + tabs.width);
    await page.click('#menuLayout');
    for(const id of ['btnImportMapping', 'btnExportMapping', 'btnResetMapping']) await expect(page.locator('#' + id)).toBeEnabled();
    await expect(page.locator('#btnExportMapping')).toHaveAttribute('title', /Save this model/);
    await page.keyboard.press('Escape');

    await X.menuCommand(page, 'btnClearAll');
    await expect(page.locator('#loadPanel')).toBeVisible();
    await expect(page.locator('#afterLoad')).toBeHidden();
    await expect(page.locator('#btnGenerate')).toBeDisabled();
    await expect(page.locator('#modelName')).toHaveText('');
    await expect(page.locator('#loadStatus .status')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('menus: a click opens and closes one, a click elsewhere or Esc closes it, choosing an item closes it', async ({ page }) => {
    await page.click('#menuFile');
    await expect(list(page, 'menuFile')).toBeVisible();
    await expect(page.locator('#menuFile')).toHaveAttribute('aria-expanded', 'true');
    await page.click('#menuFile');
    await expect(list(page, 'menuFile')).toBeHidden();
    await page.click('#menuFile');
    await page.mouse.click(700, 600);                                  // elsewhere
    await expect(list(page, 'menuFile')).toBeHidden();
    // With one open, pointing at the other opens it instead; a click straight after keeps it open.
    await page.click('#menuFile');
    await page.hover('#menuLayout');
    await expect(list(page, 'menuLayout')).toBeVisible();
    await expect(list(page, 'menuFile')).toBeHidden();
    await page.click('#menuLayout');
    await expect(list(page, 'menuLayout')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list(page, 'menuLayout')).toBeHidden();
    // Choosing an item: File → Load Sample Model loads it and closes the menu.
    await X.menuCommand(page, 'btnMenuSample');
    await expect(list(page, 'menuFile')).toBeHidden();
    await expect(page.locator('#loadStatus .status.ok')).toContainText('the sample model');
    await expect(page.locator('#modelName')).toHaveText('Sample model');
  });

  test('menus by keyboard: ↓ opens, ↑ ↓ Home End move, ← → change menu, Esc closes and returns to its name', async ({ page }) => {
    await page.focus('#menuFile');
    await page.keyboard.press('ArrowDown');
    await expect(list(page, 'menuFile')).toBeVisible();
    await expect(page.locator('#btnOpenModel')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#btnMenuSample')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('#btnClearAll')).toBeFocused();
    await page.keyboard.press('ArrowDown');                               // round to the top
    await expect(page.locator('#btnOpenModel')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(list(page, 'menuLayout')).toBeVisible();
    await expect(list(page, 'menuFile')).toBeHidden();
    await expect(page.locator('#btnImportModuleLayouts')).toBeFocused(); // the first item that is on (no model yet)
    await page.keyboard.press('Escape');
    await expect(list(page, 'menuLayout')).toBeHidden();
    await expect(page.locator('#menuLayout')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(list(page, 'menuLayout')).toBeVisible();
  });

  test('Settings: before a model only your Excel style; then the Workbook tab; Esc, the backdrop and Done close it', async ({ page }) => {
    await page.click('#btnSettings');
    await expect(page.locator('#settingsModal')).toBeVisible();
    await expect(page.locator('#excelStyleBlock')).toBeVisible();
    await expect(page.locator('#excelStyleBody tr')).toHaveCount(7);
    await expect(page.locator('#settingsTabWorkbook')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsModal')).toBeHidden();
    await expect(page.locator('#btnSettings')).toBeFocused();             // the focus goes back
    await X.menuCommand(page, 'btnMenuStyle');                           // Layout → Excel Style…
    await expect(page.locator('#excelStyleBlock')).toBeVisible();
    await page.mouse.click(5, 450);                                      // the backdrop
    await expect(page.locator('#settingsModal')).toBeHidden();

    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await page.click('#btnSettings');
    await expect(page.locator('#periodsPanel')).toBeVisible();
    await expect(page.locator('#excelStyleBlock')).toBeHidden();
    await expect(page.locator('#settingsTabWorkbook')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#periodCountLabel')).toHaveText(/^\d+$/);
    await page.fill('#cfgFileName', 'Q3 model');
    await page.locator('#cfgFileName').dispatchEvent('change');
    await page.click('#settingsDone');
    await expect(page.locator('#settingsModal')).toBeHidden();
    const { name } = await X.generate(page);
    expect(name).toBe('Q3 model.xlsx');
  });

  test('a file dropped anywhere on the page opens, the page outlined while it is held over it', async ({ page }) => {
    await X.menuCommand(page, 'btnMenuSample');
    await expect(page.locator('#modelName')).toHaveText('Sample model');
    const dt = await page.evaluateHandle((text) => {
      const d = new DataTransfer();
      d.items.add(new File([text], 'dropped.json', { type: 'application/json' }));
      return d;
    }, fs.readFileSync(MODEL, 'utf8'));
    await page.dispatchEvent('#rowsPanel', 'dragenter', { dataTransfer: dt });
    await expect(page.locator('body')).toHaveClass(/file-over/);
    await page.dispatchEvent('#rowsPanel', 'drop', { dataTransfer: dt });
    await expect(page.locator('body')).not.toHaveClass(/file-over/);
    await expect(page.locator('#loadStatus .status.ok')).toContainText('dropped.json');
    await expect(page.locator('#modelName')).toHaveText('dropped.json');
  });

  test('Paste JSON…: Esc and Cancel close it; Load loads the text', async ({ page }) => {
    await X.menuCommand(page, 'btnMenuPaste');
    await expect(page.locator('#pasteModal')).toBeVisible();
    await expect(page.locator('#pasteArea')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pasteModal')).toBeHidden();
    await page.click('#btnTogglePaste');                                 // the welcome screen's
    await page.click('#pasteCancel');
    await expect(page.locator('#pasteModal')).toBeHidden();
    await page.click('#btnTogglePaste');
    await page.fill('#pasteArea', fs.readFileSync(MODEL, 'utf8'));
    await page.click('#btnLoadPasted');
    await expect(page.locator('#pasteModal')).toBeHidden();
    await expect(page.locator('#loadStatus .status.ok')).toContainText('pasted JSON');
    await expect(page.locator('#modelName')).toHaveText('Pasted model');
    await expect(page.locator('#afterLoad')).toBeVisible();
  });

  test('a message can be dismissed; its text is only the message', async ({ page }) => {
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    const msg = page.locator('#loadStatus .status');
    await expect(msg).toHaveText(/^Loaded revenue-bs-corkscrew\.json — \d+ canvases, \d+ periods\.$/);
    await msg.locator('.status-close').click();
    await expect(msg).toHaveCount(0);
  });

  test('a tab\'s row count shows its rows; + Label Row from By Canvas shows the new row in the Tree, ready to name', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await page.click('#viewByCanvas');
    const last = page.locator('#tabsBody tr').last();
    const tabId = await last.getAttribute('data-tab-id');
    await last.locator('.tab-count').click();
    await expect(page.locator('#viewByTree')).toHaveClass(/active/);
    await expect(page.locator(`#rowGroupsTree [data-scroll-key="tree_${tabId}"]`)).toBeInViewport();

    await page.click('#viewByCanvas');
    await page.click('#btnAddCustomRow');
    await expect(page.locator('#viewByTree')).toHaveClass(/active/);
    const input = page.locator('.tree-row-label-input');
    await expect(input).toBeFocused();
    await input.fill('Notes');
    await input.press('Enter');
    const firstTab = page.locator('#rowGroupsTree .canvas-group').first();
    await expect(firstTab.locator('.tree-row-label').last()).toHaveText('Notes');
    await expect(page.locator('#customRowsPanel')).toHaveCount(0);       // no separate table any more
  });

  test('little text on the page: no paragraph of explanation, the details in tooltips and Help', async ({ page }) => {
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    await X.setInputsTab(page, true);
    for(const view of ['#viewByTree', '#viewByTab', '#viewByCanvas']){
      await page.click(view);
      const long = await page.locator('main').evaluate(main => [...main.querySelectorAll('p, .hint, .limits')]
        .filter(el => el.offsetParent && el.textContent.trim().length > 120).map(el => el.textContent.trim().slice(0, 60)));
      expect(long, view).toEqual([]);
    }
    for(const id of ['#cfgSectionsEnabled', '#cfgInputsEnabled']) await expect(page.locator(id).locator('xpath=..')).toHaveAttribute('title', /.{20,}/);
  });

  test('the differences list has a "?" to its topic', async ({ page }) => {
    await X.loadModelFile(page, fixture('ir', 'error-cases.json'));
    await page.locator('#differencesPanel .panel-help').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Where the workbook differs from fmIDE');
  });

  test('on a tablet with Help open, the tabs go above the rows; closed, beside them', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
    let tabs = await box(page, '#tabsPanel'), rows = await box(page, '#rowsPanel');
    expect(rows.x).toBeGreaterThan(tabs.x + tabs.width);
    await page.click('#btnHelp');
    await expect(panel(page)).toBeVisible();
    tabs = await box(page, '#tabsPanel'); rows = await box(page, '#rowsPanel');
    expect(rows.y, 'the rows below the tabs').toBeGreaterThan(tabs.y + tabs.height);
    const hp = await panel(page).boundingBox();
    expect(rows.x + rows.width).toBeLessThanOrEqual(hp.x + 1);
    // Nothing wider than the page beside Help.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('by finger', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test('a tap opens a menu and chooses an item; a tap elsewhere closes it', async ({ page, pageErrors }) => {
    await X.openExporter(page);
    const types = await watchPointerTypes(page);
    const f = await finger(page);
    await f.tap(centre(await box(page, '#menuLayout')));
    await expect(list(page, 'menuLayout')).toBeVisible();
    await f.tap({ x: 600, y: 600 });
    await expect(list(page, 'menuLayout')).toBeHidden();
    await f.tap(centre(await box(page, '#menuLayout')));
    await f.tap(centre(await box(page, '#btnMenuStyle')));
    await expect(list(page, 'menuLayout')).toBeHidden();
    await expect(page.locator('#excelStyleBlock')).toBeVisible();
    expect(await types()).toEqual(['touch']);
    expect(pageErrors).toEqual([]);
  });
});
