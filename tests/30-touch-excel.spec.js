// 30. Touch — ExcelExporter's Tree view by finger (step 9c): press and hold a row for its menu,
// which then also offers what Ctrl- and Shift-click do; double-tap a row to rename it. Chromium
// with a touchscreen at tablet size; real touch input through the Chrome DevTools Protocol, and
// each test checks the page saw touch, not a mouse. The mouse is covered, unchanged, by group 7.
const { test, expect } = require('./helpers/apps');
const X = require('./helpers/excel');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

const rows = (page) => page.locator('#rowGroupsTree .tree-row');
const labelOf = (row) => row.locator('.tree-row-label').textContent();
const selectedLabels = (page) => page.locator('#rowGroupsTree .tree-row.selected .tree-row-label').allTextContents();
const menu = (page) => page.locator('#treeCtxMenu');
const menuItem = (page, text) => menu(page).locator('button', { hasText: text });
// Where to put the finger on it (scrolled into view first: the page is taller than the screen).
async function spot(locator){ await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox(); expect(b).toBeTruthy(); return centre(b); }

async function open(page){
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'revenue-bs-corkscrew.json');
  await page.click('#viewByTree');
  await expect(rows(page).nth(5)).toBeVisible();
}

test('a hold on a row opens its menu, leaving the selection as it was; a tap on a row selects just that row', async ({ page, pageErrors }) => {
  await open(page);
  const types = await watchPointerTypes(page);
  const f = await finger(page);
  const row2 = rows(page).nth(2);
  await f.tap(await spot(row2.locator('.tree-row-label')));
  await expect.poll(() => selectedLabels(page)).toEqual([await labelOf(row2)]);

  const row4 = rows(page).nth(4);
  const at = await spot(row4.locator('.tree-row-label'));
  await f.hold(at);
  await expect(menu(page)).toBeVisible();
  // Still open once the finger has lifted (a long press's own contextmenu doesn't open it again,
  // and no tap reaches the page).
  await page.waitForTimeout(400);
  await expect(menu(page)).toBeVisible();
  expect(await selectedLabels(page)).toEqual([await labelOf(row2)]);
  const items = await menu(page).locator('button[role=menuitem]').allTextContents();
  expect(items.slice(0, 2)).toEqual(['☑ Add to selection', '⇕ Select from the last row to here']);
  // Beside the finger, not under it.
  const m = await menu(page).boundingBox();
  expect(m.x).toBeGreaterThan(at.x);
  expect(await types()).toEqual(['touch']);
  expect(pageErrors).toEqual([]);
});

test('Add to selection, Remove from selection and Select from the last row to here do what Ctrl- and Shift-click do', async ({ page, pageErrors }) => {
  await open(page);
  const f = await finger(page);
  const labels = await rows(page).locator('.tree-row-label').allTextContents();
  await f.tap(await spot(rows(page).nth(1).locator('.tree-row-label')));
  // Add row 3.
  await f.hold(await spot(rows(page).nth(3).locator('.tree-row-label')));
  await f.tap(await spot(menuItem(page, 'Add to selection')));
  await expect(menu(page)).toBeHidden();
  await expect.poll(() => selectedLabels(page)).toEqual([labels[1], labels[3]]);
  // Remove row 1.
  await f.hold(await spot(rows(page).nth(1).locator('.tree-row-label')));
  await expect(menuItem(page, 'Remove from selection')).toBeVisible();
  await f.tap(await spot(menuItem(page, 'Remove from selection')));
  await expect.poll(() => selectedLabels(page)).toEqual([labels[3]]);
  // A range from the last row (row 1, the one just removed, as with Ctrl-click) to row 5.
  await f.hold(await spot(rows(page).nth(5).locator('.tree-row-label')));
  await f.tap(await spot(menuItem(page, 'Select from the last row to here')));
  await expect.poll(() => selectedLabels(page)).toEqual(labels.slice(1, 6));
  await expect(page.locator('#bulkMoveBar')).toContainText('5');
  expect(pageErrors).toEqual([]);
});

test('a menu command on a held row outside the selection acts on just that row, as a right-click does', async ({ page, pageErrors }) => {
  await open(page);
  const f = await finger(page);
  const tabRows = page.locator('#rowGroupsTree .canvas-group').first().locator('.tree-row');
  const labels = await tabRows.locator('.tree-row-label').allTextContents();
  expect(labels.length).toBeGreaterThan(3);
  await f.tap(await spot(tabRows.nth(0).locator('.tree-row-label')));
  const last = labels[labels.length - 1];
  await f.hold(await spot(tabRows.nth(labels.length - 1).locator('.tree-row-label')));
  await f.tap(await spot(menuItem(page, 'Move to Top')));
  await expect.poll(() => page.locator('#rowGroupsTree .canvas-group').first().locator('.tree-row-label').allTextContents())
    .toEqual([last, ...labels.slice(0, -1)]);
  expect(await selectedLabels(page)).toEqual([last]);
  expect(pageErrors).toEqual([]);
});

test('Select from the last row to here waits for a first row', async ({ page, pageErrors }) => {
  await open(page);
  const f = await finger(page);
  await f.hold(await spot(rows(page).nth(2).locator('.tree-row-label')));
  await expect(menuItem(page, 'Select from the last row to here')).toBeDisabled();
  expect(pageErrors).toEqual([]);
});

test('a double-tap on a row renames it, in a 16px text box', async ({ page, pageErrors }) => {
  await open(page);
  const types = await watchPointerTypes(page);
  const f = await finger(page);
  const row = rows(page).nth(3);
  await f.doubleTap(await spot(row.locator('.tree-row-label')));
  const input = page.locator('#rowGroupsTree .tree-row-label-input');
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Renamed by finger');
  await page.keyboard.press('Enter');
  await expect(rows(page).nth(3).locator('.tree-row-label')).toHaveText('Renamed by finger');
  expect(await types()).toEqual(['touch']);
  expect(pageErrors).toEqual([]);
});

test('a double-tap renames the row its first tap selected, even when the selection bar pushed the list down', async ({ page, pageErrors }) => {
  await open(page);
  const f = await finger(page);
  await expect(page.locator('#rowGroupsTree .tree-row.selected')).toHaveCount(0);
  const row = rows(page).nth(4);
  const label = await labelOf(row);
  const at = await spot(row.locator('.tree-row-label'));
  // The first tap selects the row; the bar that appears may move the list under the finger.
  await f.tap(at);
  await expect.poll(() => selectedLabels(page)).toEqual([label]);
  await f.tap(at);
  const input = page.locator('#rowGroupsTree .tree-row-label-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(label);
  expect(pageErrors).toEqual([]);
});

test('a right-click still opens the menu straight away, without the finger\'s items', async ({ page, pageErrors }) => {
  await open(page);
  const row = rows(page).nth(2);
  await row.locator('.tree-row-label').click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
  expect(await selectedLabels(page)).toEqual([await labelOf(row)]);
  const items = await menu(page).locator('button[role=menuitem]').allTextContents();
  expect(items[0]).toBe('▲ Move Up');
  expect(items.some(t => /selection|last row/.test(t))).toBe(false);
  expect(pageErrors).toEqual([]);
});
