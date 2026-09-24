// Both apps open offline, with no page errors and no network requests.
const { test, expect } = require('./helpers/apps');
const { openExporter } = require('./helpers/excel');
const { openFmIDE } = require('./helpers/fmide');

test('ExcelExporter opens offline and loads its sample', async ({ page, pageErrors }) => {
  await openExporter(page);
  await page.click('#btnLoadSample');
  await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
  expect(await page.evaluate(() => typeof XLSX.write)).toBe('function');
  expect(pageErrors).toEqual([]);
});

test('fmIDE opens offline with its automation API', async ({ page, pageErrors }) => {
  await openFmIDE(page);
  expect(await page.evaluate(() => fm.actions().length)).toBeGreaterThan(10);
  expect(await page.evaluate(() => fm.canvases().length)).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});
