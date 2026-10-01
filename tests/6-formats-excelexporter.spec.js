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

// A newer system is v10 since system v9 (phase E2b, the operator choose)
// became current: sys-newer-v5 to -v9 are now ordinary files.
test('sys-newer-v10 asks: Cancel → "Not loaded.", Open Anyway → loads', async ({ page }) => {
  await page.setInputFiles('#fileInput', file('sys-newer-v10'));
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmMessage')).toContainText('format version 10');
  await page.click('#confirmCancel');
  await expect(page.locator('#confirmModal')).toBeHidden();
  await expect(loadStatus(page)).toHaveText('Not loaded.');
  await expect(page.locator('#afterLoad')).toBeHidden();

  await page.setInputFiles('#fileInput', file('sys-newer-v10'));
  await expect(page.locator('#confirmModal')).toBeVisible();
  await expect(page.locator('#confirmOk')).toHaveText('Open Anyway');
  await page.click('#confirmOk');
  await expect(loadStatus(page)).toHaveClass(/ok/);
  await expect(page.locator('#afterLoad')).toBeVisible();
});

test('sys-newer-v5 to -v9, the workspaces with a v5 to v9 system inside, and the v6 files with Excel settings are now current files: no question', async ({ page }) => {
  for(const name of ['sys-newer-v5', 'sys-newer-v6', 'sys-newer-v7', 'sys-newer-v8', 'sys-newer-v9', 'ws-nested-newer', 'ws-nested-newer-v6', 'ws-nested-newer-v7', 'ws-nested-newer-v8', 'ws-nested-newer-v9', 'ws-v3', 'ws-v4',
    'sys-v6-excel-settings', 'ws-v6-excel-settings']){
    await page.setInputFiles('#fileInput', file(name));
    await expect(loadStatus(page)).toHaveClass(/ok/);
    await expect(page.locator('#confirmModal')).toBeHidden();
  }
});

test('ws-nested-newer-v10: the confirm mentions its system', async ({ page }) => {
  await page.setInputFiles('#fileInput', file('ws-nested-newer-v10'));
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
  ['functions', /functions file.*import it in fmIDE/],
  ['excel-style', /Excel style file.*Import Excel Style/],
  ['module-layouts', /module layouts file.*Import Module Layouts/],
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
    expect(exported.version).toBe(2); // v2: a row may carry its own format and indent
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

test('a version 2 workspace (templates with families and versions) loads', async ({ page }, testInfo) => {
  const ws = JSON.parse(fs.readFileSync(fixture('models', 'roles-workspace-edited.json'), 'utf8'));
  ws.version = 2;
  ws.templates = [{ name: 'Revenue plan', kind: 'module', family: '3f2a9c1e-0000-4000-8000-000000000001', version: 2,
    note: 'price up', versionId: '3f2a9c1e-0000-4000-8000-000000000002', data: { version: 2, kind: 'module', nodes: [], edges: [] } }];
  const doc = testInfo.outputPath('v2.fmide');
  fs.writeFileSync(doc, JSON.stringify(ws));
  await X.loadModelFile(page, doc);
  await expect(loadStatus(page)).toHaveClass(/ok/);
  await expect(loadStatus(page)).toContainText('Loaded v2.fmide');
});

test('a version 3 workspace (with a recipe template) loads', async ({ page }, testInfo) => {
  const ws = JSON.parse(fs.readFileSync(fixture('models', 'roles-workspace-edited.json'), 'utf8'));
  ws.version = 3;
  ws.templates = [{ name: 'Three Statements', kind: 'recipe', family: '3f2a9c1e-0000-4000-8000-000000000011', version: 1, note: '',
    versionId: '3f2a9c1e-0000-4000-8000-000000000012', data: { kind: 'recipe', parts: [{ family: '3f2a9c1e-0000-4000-8000-000000000001', version: 'latest', name: 'Income Statement' }] } }];
  const doc = testInfo.outputPath('v3.fmide');
  fs.writeFileSync(doc, JSON.stringify(ws));
  await X.loadModelFile(page, doc);
  await expect(loadStatus(page)).toHaveClass(/ok/);
  await expect(loadStatus(page)).toContainText('Loaded v3.fmide');
});

// Workspace v6 (step 8, phase 8b): templates and library functions may say which library pack
// they came from (`origin`). ExcelExporter ignores both, so a v5 and a v6 workspace open the
// same, and write the same workbook; a v7 one asks first.
test.describe('workspace v6 (origins)', () => {
  const withOrigins = () => {
    const ws = JSON.parse(fs.readFileSync(file('ws-v5'), 'utf8'));
    ws.version = 6;
    const origin = { packId: 'pack-sample-0001', packTitle: '<b>Sample</b> pack', author: '<img src=x onerror="window.__pwned=1">', licence: 'CC-BY-4.0' };
    ws.templates.forEach(t => { t.origin = origin; });
    ws.functions.forEach(d => { d.origin = origin; });
    return ws;
  };
  test('ws-v5 and a v6 workspace with origins load without a question and give the same workbook', async ({ page, pageErrors }, testInfo) => {
    const sheets = [];
    for(const p of [file('ws-v5'), (() => { const q = testInfo.outputPath('ws-v6-origins.json'); fs.writeFileSync(q, JSON.stringify(withOrigins())); return q; })()]){
      await page.setInputFiles('#fileInput', p);
      await expect(loadStatus(page)).toHaveClass(/ok/);
      await expect(page.locator('#confirmModal')).toBeHidden();
      const { wb } = await X.generate(page);
      sheets.push(JSON.stringify(wb));
    }
    expect(sheets[1]).toBe(sheets[0]);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(pageErrors).toEqual([]);
  });
  // Workspace v10 is current since phase E2b: a newer one is v11.
  test('a v11 workspace asks first', async ({ page }, testInfo) => {
    const ws = withOrigins();
    ws.version = 11;
    const p = testInfo.outputPath('ws-v11.json');
    fs.writeFileSync(p, JSON.stringify(ws));
    await page.setInputFiles('#fileInput', p);
    await expect(page.locator('#confirmModal')).toBeVisible();
    await expect(page.locator('#confirmMessage')).toContainText('format version 11');
  });
});
