// 75. Attaching a module's Excel layout to its template from ExcelExporter (a follow-up to step
// 11c; docs/step11-excel-output.md, "Attach to Template…").
// - Opened from fmIDE, ExcelExporter's Layout → 📎 Attach to Template… (a module picked from a
//   list) and 📎 Attach on a module's tab send that module's layout as this model shows it to
//   fmIDE, which asks first and attaches it to the template's latest version; the answer comes
//   back in words. Cancel says so; a second attach says it replaces the first.
// - fmIDE refuses during a tutorial and for a template not in its library, and listens only to
//   the ExcelExporter window it opened. Opened on its own, ExcelExporter offers neither.
// - Names are text.
const fs = require('fs');
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');

const FAMILY = 'fam-sales-module-0001';
const salesData = { version: 7, kind: 'module', nodes: [
  { id: 'n1', type: 'value', x: 60, y: 60, w: 170, h: 64, text: 'Price\n10', plugs: [] },
  { id: 'n2', type: 'value', x: 60, y: 180, w: 170, h: 64, text: 'Volume\n5', plugs: [] },
  { id: 'n3', type: 'operator', x: 300, y: 120, w: 56, h: 56, text: '×' },
  { id: 'n4', type: 'value', x: 420, y: 110, w: 170, h: 64, text: 'Revenue', plugs: [] }],
  edges: [{ id: 'e1', from: 'n1', to: 'n3' }, { id: 'e2', from: 'n2', to: 'n3' }, { id: 'e3', from: 'n3', to: 'n4' }] };
const sales = (name) => ({ name, kind: 'module', group: 'Mine', description: '', family: FAMILY, version: 1, note: '',
  versionId: 'vid-sales-module-0001', data: salesData });

const status = (popup) => popup.locator('#moduleLayoutsStatus .status');
async function importTemplates(page, testInfo, templates){
  const p = testInfo.outputPath('templates.json');
  fs.writeFileSync(p, JSON.stringify({ kind: 'fmIDE-templates', version: 10, templates }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', p);
  await F.dismissMessage(page);
  await page.locator('.modal-box.template-box .modal-actions button', { hasText: /^Close$/ }).click();
}
// fmIDE with a canvas made from the template "name", and ExcelExporter opened from it.
async function setUp(page, testInfo, name){
  await F.openFmIDE(page);
  await importTemplates(page, testInfo, [sales(name)]);
  await page.evaluate(() => { fm.clearCanvas(); fm.insertTemplate('fam-sales-module-0001@1', 'here'); });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => fm.command('openExcelExporter'))]);
  await popup.waitForLoadState();
  await expect(popup.locator('#tabsBody .module-tag')).toBeVisible();
  return popup;
}
const attachedLayout = async (page) => {
  const ws = (await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()))).data;
  const t = ws.templates.find(x => x.family === FAMILY);
  return t.attachments && t.attachments.excel;
};

test('Layout → Attach to Template… and 📎 Attach send the module\'s layout; fmIDE asks first', async ({ page, pageErrors }, testInfo) => {
  const popup = await setUp(page, testInfo, 'Sales');
  // The module's tab, renamed here: its layout as this model shows it is what goes.
  const tab = popup.locator('#tabsBody input[type=text]').first();
  await tab.fill('Sales plan');
  await tab.dispatchEvent('change');
  await X.menuCommand(popup, 'btnAttachLayout');
  await expect(popup.locator('#attachModal')).toBeVisible();
  await expect(popup.locator('#attachPick option')).toHaveText(['Sales — tab “Sales plan”']);
  await popup.click('#attachOk');
  await expect(popup.locator('#attachModal')).toBeHidden();
  await expect(status(popup)).toContainText('Sent the layout of “Sales” to fmIDE');
  // fmIDE asks; Cancel first.
  const dialog = page.locator('.modal-box').last();
  await expect(dialog).toContainText('Attach this Excel layout to version 1 of the canvas template "Sales"?');
  await dialog.locator('button', { hasText: 'Cancel' }).click();
  await expect(status(popup)).toHaveText('Not attached: cancelled in fmIDE.');
  expect(await attachedLayout(page)).toBeUndefined();
  // The tab's own button, and Attach.
  await popup.locator('#tabsBody .module-tag .module-attach').click();
  await page.locator('.modal-box').last().locator('button', { hasText: /^Attach$/ }).click();
  expect(await F.dialogText(page)).toBe('Excel layout attached to version 1 of "Sales".');
  await F.dismissMessage(page);
  await expect(status(popup)).toHaveText('Attached to version 1 of “Sales” in fmIDE.');
  const att = await attachedLayout(page);
  expect(att).toMatchObject({ family: FAMILY, name: 'Sales', tabName: 'Sales plan' });
  expect(att.rows.map(r => r.name).sort()).toEqual(['price', 'revenue', 'volume']);
  // Again: fmIDE says it replaces the one attached.
  await X.menuCommand(popup, 'btnAttachLayout');
  await popup.click('#attachOk');
  await expect(page.locator('.modal-box').last()).toContainText('It replaces the layout that version has.');
  await page.locator('.modal-box').last().locator('button', { hasText: 'Cancel' }).click();
  await expect(status(popup)).toHaveText('Not attached: cancelled in fmIDE.');
  expect(pageErrors).toEqual([]);
});

test('fmIDE refuses in a tutorial and for a template not in its library; other windows are not heard', async ({ page }, testInfo) => {
  const popup = await setUp(page, testInfo, 'Sales');
  const send = (family) => popup.evaluate((family) => window.opener.postMessage({ type: 'excel:attach-layout',
    text: JSON.stringify({ kind: 'fmIDE-excel-module-layouts', version: 2, modules: [{ family, name: 'X', rows: [], customs: [], sectioned: [], flat: [] }] }) }, location.origin), family);
  // Not in the library.
  await send('fam-nowhere-module-01');
  expect(await F.dialogText(page)).toBe('That layout is for a canvas template that isn\'t in your library.');
  await F.dismissMessage(page);
  await expect(status(popup)).toHaveText('Not attached: that canvas template isn\'t in fmIDE\'s library.');
  // Not a layouts file.
  await popup.evaluate(() => window.opener.postMessage({ type: 'excel:attach-layout', text: '{"kind":"fmIDE-macros","version":1}' }, location.origin));
  await expect(status(popup)).toHaveText('Not attached: fmIDE couldn\'t read it.');
  // Any other window — here fmIDE's own page — is not heard.
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: window,
    data: { type: 'excel:attach-layout', text: '{}' } })));
  await page.waitForTimeout(300);
  expect(await page.locator('.modal-box').count()).toBe(0);
  // In a tutorial.
  await page.keyboard.press('F1');
  await page.locator('#helpPanel .help-tutorial[data-tutorial="functions"] .help-tutorial-start').click();
  await expect(page.locator('#tutorialCard')).toBeVisible();
  await send(FAMILY);
  expect(await F.dialogText(page)).toBe('Finish or exit the tutorial first, then attach the layout again.');
  await F.dismissMessage(page);
  await expect(status(popup)).toHaveText('Not attached: fmIDE is in a tutorial.');
  await page.locator('#tutorialCard .tutorial-exit').click();
});

test('a template\'s name is text; opened on its own, ExcelExporter offers no Attach', async ({ page }, testInfo) => {
  const name = '<img src=x onerror="window.__pwned=1">Sales';
  const popup = await setUp(page, testInfo, name);
  await X.menuCommand(popup, 'btnAttachLayout');
  await expect(popup.locator('#attachPick option').first()).toContainText(name);
  await popup.click('#attachCancel');
  await expect(popup.locator('#attachModal')).toBeHidden();
  await popup.locator('#tabsBody .module-tag .module-attach').click();
  await expect(page.locator('.modal-box').last()).toContainText(name);
  await page.locator('.modal-box').last().locator('button', { hasText: 'Cancel' }).click();
  expect(await popup.locator('#tabsBody img, #attachModal img, #notices img').count()).toBe(0);
  expect(await page.locator('.modal-box img').count()).toBe(0);
  expect(await popup.evaluate(() => window.__pwned)).toBeUndefined();

  const alone = await page.context().newPage();
  await openApp(alone, 'ExcelExporter');
  await alone.click('#btnLoadSample');
  await expect(alone.locator('#afterLoad')).toBeVisible();
  await expect(alone.locator('#btnAttachLayout')).toHaveClass(/hidden/);
  expect(await alone.locator('.module-attach').count()).toBe(0);
  await alone.close();
});
