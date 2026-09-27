// 5. Security: files with script-carrying markup in every name field and in node coordinates
// must never run script, in either app. (An injected <img src=x> would also request "x",
// which the network guard in helpers/apps.js blocks and reports.)
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const F = require('./helpers/fmide');

const EVIL = ['evil-workspace.json', 'evil-system.json'];
const pwned = (page) => page.evaluate(() => window.__pwned);
const expectSafe = async (page) => {
  const p = await pwned(page);
  expect(p === undefined || (Array.isArray(p) && p.length === 0), 'window.__pwned = ' + JSON.stringify(p)).toBe(true);
};

// Let any delayed handlers (image errors, timers) fire before checking.
const settle = (page) => page.waitForTimeout(300);

for(const file of EVIL){
  test(`ExcelExporter: ${file}`, async ({ page }) => {
    await X.openExporter(page);
    await X.loadModelFile(page, fixture('security', file));
    await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
    for(const view of ['#viewByCanvas', '#viewByTab', '#viewByTree']){
      await page.click(view);
      await settle(page);
    }
    await X.setInputsTab(page, true);
    for(const view of ['#viewByCanvas', '#viewByTab', '#viewByTree']){
      await page.click(view);
      await settle(page);
    }
    await page.locator('#rolesLegend .role-chip').first().hover();
    await X.generate(page);
    await settle(page);
    await expectSafe(page);
  });
}

test('fmIDE: evil workspace through import, Format Presets and Templates', async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'importWorkspace', fixture('security', 'evil-workspace.json'));
  // Any up-front warning, then "Import this workspace?" — confirm each, then the result message.
  await F.acceptAll(page);
  await expect(page.locator('.modal-box')).toHaveCount(0);
  // The workspace really was imported: its canvas name arrives as literal text.
  expect(JSON.stringify(await page.evaluate(() => fm.canvases()))).toContain('<img src=x onerror=');
  await expect(page.getByText('<img src=x onerror=', { exact: false }).first()).toBeVisible();
  await settle(page);
  await expectSafe(page);

  // Format Presets dialog.
  await page.evaluate(() => fm.command('openFormats'));
  await expect(page.locator('.modal-box')).toBeVisible();
  await settle(page);
  await expectSafe(page);
  await page.keyboard.press('Escape');
  await page.locator('.modal-box button', { hasText: /^Done$/ }).click().catch(() => {});
  await expect(page.locator('.modal-box')).toHaveCount(0);

  // Templates dialog: hover and open each template so previews render.
  await page.evaluate(() => fm.command('openTemplates'));
  const buttons = page.locator('.modal-box .template-list button');
  const n = await buttons.count();
  expect(n, 'templates imported').toBeGreaterThan(0);
  for(let i = 0; i < n; i++){
    await buttons.nth(i).hover();
    await buttons.nth(i).click();
    await settle(page);
  }
  await expect(page.locator('.modal-box .template-preview svg')).toBeVisible();
  await expectSafe(page);
  await page.locator('.modal-box button', { hasText: /^Close$/ }).click();

  // Macros dialog also lists the macro name from the file.
  await page.evaluate(() => fm.command('openMacros'));
  await expect(page.locator('.modal-box')).toBeVisible();
  await settle(page);
  await expectSafe(page);
});

test('fmIDE: evil system through Load System', async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'loadSystem', fixture('security', 'evil-system.json'));
  await F.acceptAll(page);
  await settle(page);
  // The canvas really rendered the file's rectangles.
  expect(await page.evaluate(() => fm.nodes().length)).toBeGreaterThan(0);
  await expectSafe(page);
});

test('fmIDE: a functions file with markup in its formula, description, note and calls is shown as text', async ({ page }) => {
  await F.openFmIDE(page);
  await F.importViaCommand(page, 'importFunctions', fixture('security', 'evil-functions.json'));
  expect(await F.dialogText(page)).toBe('Imported 2 function versions.');
  await F.dismissMessage(page);
  await page.evaluate(() => fm.command('openFunctions'));
  const box = page.locator('.modal-box.function-box');
  await expect(box).toBeVisible();
  // The latest version: its note and its call's name, as text.
  await expect(box.locator('.template-note')).toHaveText(/<svg onload=/);
  await expect(box.locator('.function-detail-call')).toHaveText(/^Calls <img src=x onerror=.* — not in your library$/);
  // The older one: its formula (unreadable), description and note, as text.
  await box.locator('button.template-versions-toggle').click();
  await box.locator('button.template-version').click();
  await expect(box.locator('.function-detail-text')).toHaveText(/^Evil\(x\) = x <img src=x onerror=/);
  await expect(box.locator('.template-desc')).toHaveText(/^<img src=x onerror=.*<b>bold<\/b>$/);
  await expect(box.locator('.template-note')).toHaveText(/<script>/);
  await expect(box.locator('.function-detail-problem')).toBeVisible();
  // The editor shows the formula and its error place as text too.
  await box.locator('button.function-new-version').click();
  const editor = page.locator('.modal-box.function-editor');
  await expect(editor.locator('.fn-editor-where')).toHaveText(/^Evil\(x\) = x <img src=x onerror=/);
  await expect(editor.locator('.fn-editor-where mark')).toHaveText('"');
  await expect(editor.locator('.fn-editor-description')).toHaveValue(/<img src=x/);
  await editor.locator('button', { hasText: 'Cancel' }).click();
  // Delete's warning, and the export list.
  await box.locator('button.function-delete').click();
  await F.cancelDialog(page);
  await box.locator('button', { hasText: '⇩ Export Functions' }).click();
  await expect(page.locator('.modal-box.function-export label')).toHaveText([' Evil (v2)']);
  expect(await page.locator('.modal-box img, .modal-box script, .modal-box svg').count()).toBe(0);
  expect(await page.locator('.modal-box b', { hasText: 'bold' }).count()).toBe(0);
  await settle(page);
  await expectSafe(page);
});
