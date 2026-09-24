// 6. File formats — ExcelExporter: models and mapping files.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const X = require('./helpers/excel');
const S = require('./helpers/storage');

const file = (name) => fixture('formats', name + '.json');
const loadStatus = (page) => page.locator('#loadStatus .status');
const genStatus = (page) => page.locator('#genStatus .status');

async function tabNames(page){
  return page.locator('#tabsBody input[type=text]').evaluateAll(els => els.map(e => e.value));
}
async function renameFirstTab(page, name){
  const input = page.locator('#tabsBody input[type=text]').first();
  await input.fill(name);
  await input.dispatchEvent('change');
}
async function importMapping(page, path){
  await page.setInputFiles('#mappingFileInput', path);
}
// Saved layouts in browser storage never carry the file envelope.
async function expectCleanStorage(page){
  await expect.poll(() => S.storedKeys(page, 'ExcelExporter', 'fmide-excelmap-')).not.toHaveLength(0);
  const saved = Object.values(await S.storedEntries(page, 'ExcelExporter', 'fmide-excelmap-')).map(t => JSON.parse(t));
  for(const m of saved){
    expect(m).not.toHaveProperty('kind');
    expect(m).not.toHaveProperty('version');
  }
  return saved.length;
}

test.beforeEach(async ({ page }) => { await X.openExporter(page); });

for(const name of ['sys-current', 'sys-legacy']){
  test(`${name} loads`, async ({ page }) => {
    await X.loadModelFile(page, file(name));
    await expect(loadStatus(page)).toHaveClass(/ok/);
    await expect(loadStatus(page)).toContainText('1 canvas');
  });
}

test('sys-newer asks: Cancel → "Not loaded.", Open Anyway → loads', async ({ page }) => {
  await page.setInputFiles('#fileInput', file('sys-newer'));
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmMessage')).toContainText('format version 3');
  await page.click('#confirmCancel');
  await expect(page.locator('#confirmModal')).toBeHidden();
  await expect(loadStatus(page)).toHaveText('Not loaded.');
  await expect(page.locator('#afterLoad')).toBeHidden();

  await page.setInputFiles('#fileInput', file('sys-newer'));
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmOk')).toHaveText('Open Anyway');
  await page.click('#confirmOk');
  await expect(loadStatus(page)).toHaveClass(/ok/);
  await expect(page.locator('#afterLoad')).toBeVisible();
});

test('ws-nested-newer: the confirm mentions its system', async ({ page }) => {
  await page.setInputFiles('#fileInput', file('ws-nested-newer'));
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmMessage')).toContainText('its system');
  await page.click('#confirmOk');
  await expect(loadStatus(page)).toHaveClass(/ok/);
});

const NOT_A_MODEL = [
  ['module', /module.*Save System or Export Workspace/],
  ['templates', /templates file.*import it in fmIDE/],
  ['mapping', /mapping file.*Import Mapping JSON/],
  ['preferences', /preferences file.*File → Import Preferences/],
];
for(const [name, message] of NOT_A_MODEL){
  test(`${name} loaded as a model says what it is and where it belongs`, async ({ page }) => {
    await X.loadModelFile(page, file(name));
    await expect(loadStatus(page)).toHaveClass(/err/);
    await expect(loadStatus(page)).toHaveText(message);
    await expect(page.locator('#afterLoad')).toBeHidden();
  });
}

test.describe('mapping files', () => {
  test.beforeEach(async ({ page }) => {
    await X.loadModelFile(page, file('sys-current'));
    await expect(loadStatus(page)).toHaveClass(/ok/);
  });

  test('export has kind and version, and re-importing it works', async ({ page }, testInfo) => {
    await renameFirstTab(page, 'Exported Tab');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportMapping')]);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(exported.kind).toBe('fmIDE-excel-mapping');
    expect(exported.version).toBe(1);
    expect(exported.tabs.map(t => t.name)).toContain('Exported Tab');
    await renameFirstTab(page, 'Changed Since');
    const saved = testInfo.outputPath('exported-mapping.json');
    fs.writeFileSync(saved, JSON.stringify(exported));
    await importMapping(page, saved);
    await expect(genStatus(page)).toHaveText('Mapping imported.');
    expect(await tabNames(page)).toContain('Exported Tab');
    expect(await expectCleanStorage(page)).toBeGreaterThan(0);
  });

  for(const name of ['map-export', 'map-legacy']){
    test(`${name} imports`, async ({ page }) => {
      await renameFirstTab(page, 'Before Import');
      await importMapping(page, file(name));
      await expect(genStatus(page)).toHaveText('Mapping imported.');
      expect(await tabNames(page)).toEqual(['Revenue Model']);
      expect(await expectCleanStorage(page)).toBeGreaterThan(0);
    });
  }

  test('map-newer asks first', async ({ page }) => {
    await renameFirstTab(page, 'Before Import');
    await importMapping(page, file('map-newer'));
    await expect(page.locator('#confirmModal')).toBeVisible();
    await expect(page.locator('#confirmMessage')).toContainText('format version 4');
    await page.click('#confirmCancel');
    await expect(genStatus(page)).toHaveText('Mapping not imported.');
    expect(await tabNames(page)).toEqual(['Before Import']);

    await importMapping(page, file('map-newer'));
    await page.click('#confirmOk');
    await expect(genStatus(page)).toHaveText('Mapping imported.');
    expect(await tabNames(page)).toEqual(['Revenue Model']);
    await expectCleanStorage(page);
  });

  test('a system file imported as a mapping is rejected', async ({ page }) => {
    await renameFirstTab(page, 'Before Import');
    await importMapping(page, file('sys-current'));
    await expect(genStatus(page)).toHaveClass(/err/);
    await expect(genStatus(page)).toContainText('not an ExcelExporter mapping file');
    expect(await tabNames(page)).toEqual(['Before Import']);
    await expectCleanStorage(page);
  });
});

test('a .fmide document (a workspace) loads', async ({ page }, testInfo) => {
  expect(await page.locator('#fileInput').getAttribute('accept')).toContain('.fmide');
  const doc = testInfo.outputPath('Revenue.fmide');
  fs.writeFileSync(doc, fs.readFileSync(fixture('models', 'roles-workspace-edited.json'), 'utf8'));
  await X.loadModelFile(page, doc);
  await expect(loadStatus(page)).toHaveClass(/ok/);
  await expect(loadStatus(page)).toContainText('Loaded Revenue.fmide');
});
