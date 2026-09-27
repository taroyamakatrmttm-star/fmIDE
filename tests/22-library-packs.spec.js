// 22. Library packs (step 8, phase 8a): one file of templates, recipes and functions to share.
// - Save as Library Pack: fm.saveLibraryPack and its window; what a pack carries (a recipe's
//   parts, the functions a function calls), the pack details, the licence.
// - Open Library Pack: fm.previewLibraryPack / fm.openLibraryPack and the preview window;
//   what each item would do (new, already there, a new version of yours, a name you use);
//   ticking some items brings what they need; Cancel adds nothing.
// - Untrusted packs: hostile text is shown as text, a pack without author or with another
//   licence is refused, wrong kinds say where they belong (both apps), a newer pack asks.
// - Size limits for every file opened: too large, nested too deep (fmIDE and ExcelExporter).
// - The ribbon: the commands in the File tab's Library group; a customised ribbon gets them once.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, readFixture, openApp, ORIGIN, ROOT } = require('./helpers/apps');
const F = require('./helpers/fmide');

const TEMPLATES = fixture('formats', 'templates-v2.json'); // Income Statement v1, Balance Sheet v1–v2, Cash Flow v1
const SAMPLE = fixture('library', 'pack-v1.json');           // a pack saved by fmIDE (see below)
const err = (page, fn, arg) => page.evaluate(fn, arg).then(() => null, e => e.message);
const writeFile = (testInfo, name, data) => {
  const p = testInfo.outputPath(name);
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data));
  return p;
};
async function messageText(page){
  const box = page.locator('.modal-box', { has: page.locator('.modal-actions button', { hasText: /^OK$/ }) }).last();
  await expect(box).toBeVisible();
  return (await box.locator('p').first().textContent()) || '';
}
async function importTemplates(page){
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', TEMPLATES);
  await F.dismissMessage(page);
  await page.locator('.modal-box.template-box .modal-actions button', { hasText: /^Close$/ }).click();
}
// A library with templates (one recipe) and functions (Profit calls Margin v1).
async function fillLibrary(page){
  await importTemplates(page);
  await page.evaluate((file) => fm.importFunctions({ file }), readFixture('functions', 'library.json'));
  await page.evaluate(() => fm.saveRecipe({ name: 'Statements', parts: ['Income Statement', 'Balance Sheet@1'], description: 'IS and BS together' }));
}
async function libraryState(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  return { templates: data.templates.map(t => `${t.name}@${t.version}`).sort(),
    functions: (await page.evaluate(() => fm.listFunctions())).map(f => f.name + ':' + f.versions.map(v => v.version).join(',')).sort() };
}
const PACK_INFO = { title: 'Three statements starter', author: 'Ann Example', description: 'Line one\nLine two', tags: ['Statements', 'tax', 'statements'] };

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

test.describe('saving a pack', () => {
  test('saveLibraryPack writes the pack details, the licence, and what the items need', async ({ page }) => {
    await fillLibrary(page);
    const pack = await page.evaluate((info) => fm.saveLibraryPack(Object.assign({}, info, { templates: ['Statements'], functions: ['Profit'], download: false })), PACK_INFO);
    expect(pack.kind).toBe('fmIDE-library-pack');
    expect(pack.version).toBe(1);
    expect(pack.pack).toMatchObject({ title: 'Three statements starter', author: 'Ann Example', licence: 'CC-BY-4.0',
      description: 'Line one\nLine two', tags: ['statements', 'tax'] });
    expect(pack.pack.id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(pack.pack.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The recipe brings the versions it builds with: Income Statement (latest) and Balance Sheet v1.
    expect(pack.templates.map(t => `${t.name}@${t.version}:${t.kind}`)).toEqual(['Statements@1:recipe', 'Income Statement@1:module', 'Balance Sheet@1:module']);
    // Profit brings the Margin version it calls (v1), not the latest (v2).
    expect(pack.functions.map(f => `${f.family}@${f.version}`)).toEqual(['family-profit@1', 'family-margin@1']);
    // The file name comes from the title; the window remembers the author.
    const { name, data } = await F.downloadJson(page, () => page.evaluate((info) => fm.saveLibraryPack(Object.assign({}, info, { functions: ['Margin'] })), PACK_INFO));
    expect(name).toBe('Three-statements-starter.fmide-pack.json');
    expect(data.functions.map(f => f.version)).toEqual([2]);
  });

  test('what can\'t be saved says why', async ({ page }, testInfo) => {
    await fillLibrary(page);
    expect(await err(page, () => fm.saveLibraryPack({ title: '', author: 'Ann', functions: ['Margin'], download: false }))).toMatch(/Give the pack a title/);
    expect(await err(page, () => fm.saveLibraryPack({ title: 'T', author: '  ', functions: ['Margin'], download: false }))).toMatch(/Give your name as the author/);
    expect(await err(page, () => fm.saveLibraryPack({ title: 'T', author: 'Ann', download: false }))).toMatch(/Choose at least one/);
    expect(await err(page, () => fm.saveLibraryPack({ title: 'T', author: 'Ann', templates: ['Nope'], download: false }))).toMatch(/no template called "Nope"/);
    expect(await err(page, () => fm.saveLibraryPack({ title: 'T', author: 'Ann', templates: 42, download: false }))).toMatch(/must be a list/);
    // A recipe whose part isn't in the library can't be shared.
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', writeFile(testInfo, 'broken-recipe.json', { kind: 'fmIDE-templates', version: 5, templates: [
      { name: 'Broken', kind: 'recipe', family: 'fam-broken-recipe', version: 1, note: '', versionId: 'vid-broken-1',
        data: { kind: 'recipe', parts: [{ family: 'fam-not-here', version: 'latest', name: 'Gone' }] } }] }));
    await F.dismissMessage(page);
    expect(await err(page, () => fm.saveLibraryPack({ title: 'T', author: 'Ann', templates: ['Broken'], download: false })))
      .toMatch(/The recipe "Broken" needs a part your library doesn't have \(Gone @latest — not in your library\)/);
  });

  test('the Save as Library Pack window: details, licence, ticks; the author is remembered', async ({ page }) => {
    await fillLibrary(page);
    await page.evaluate(() => fm.command('saveLibraryPack'));
    const box = page.locator('.modal-box.library-pack-save');
    await expect(box).toBeVisible();
    await expect(box.locator('.library-pack-licence')).toContainText('CC BY 4.0');
    await box.locator('input.pack-title').fill('My pack');
    await box.locator('input.pack-author').fill('Bo Author');
    await box.locator('input.pack-tags').fill('a, b, a');
    await box.locator('label.library-pack-pick', { hasText: /^ Margin/ }).locator('input').check();
    const { data } = await F.downloadJson(page, () => box.locator('button.primary', { hasText: 'Save Pack' }).click());
    await expect(box).toHaveCount(0);
    expect(data.pack).toMatchObject({ title: 'My pack', author: 'Bo Author', tags: ['a', 'b'] });
    expect(data.functions.map(f => f.family)).toEqual(['family-margin']);
    await page.evaluate(() => fm.command('saveLibraryPack'));
    await expect(box.locator('input.pack-author')).toHaveValue('Bo Author');
    // Nothing ticked: it says so and stays open.
    await box.locator('input.pack-title').fill('Empty');
    await box.locator('button.primary').click();
    expect(await messageText(page)).toMatch(/Choose at least one/);
    await F.dismissMessage(page);
    await expect(box).toBeVisible();
  });
});

test.describe('opening a pack', () => {
  test('a pack saved in one browser opens in another: preview, then everything is added', async ({ page, browser }) => {
    await fillLibrary(page);
    const pack = await page.evaluate((info) => fm.saveLibraryPack(Object.assign({}, info, { templates: ['Statements'], functions: ['Profit'], download: false })), PACK_INFO);
    // Another browser: a fresh context (nothing stored), kept offline like the first.
    const ctx = await browser.newContext();
    await ctx.route('**/*', (route) => route.request().url() === ORIGIN + 'fmIDE.html'
      ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html')) })
      : route.abort('blockedbyclient'));
    const other = await ctx.newPage();
    try{
      await F.openFmIDE(other);
      const preview = await other.evaluate((file) => fm.previewLibraryPack(file), pack);
      expect(preview.pack.author).toBe('Ann Example');
      expect(preview.items.map(i => [i.key, i.name, i.version, i.status, i.needs])).toEqual([
        ['t0', 'Statements', 1, 'new', ['t1', 't2']], ['t1', 'Income Statement', 1, 'new', []], ['t2', 'Balance Sheet', 1, 'new', []],
        ['f0', 'Profit', 1, 'new', ['f1']], ['f1', 'Margin', 1, 'new', []]]);
      expect(await libraryState(other)).toEqual({ templates: [], functions: [] });
      const out = await other.evaluate((file) => fm.openLibraryPack(file), pack);
      expect(out).toEqual({ templates: { added: 3, present: 0, renumbered: 0 }, functions: { added: 2, present: 0, renumbered: 0 } });
      expect(await libraryState(other)).toEqual({ templates: ['Balance Sheet@1', 'Income Statement@1', 'Statements@1'], functions: ['Margin:1', 'Profit:1'] });
      // The recipe builds from what came with it.
      await other.evaluate(() => fm.insertTemplate('Statements'));
      expect((await other.evaluate(() => fm.canvases())).map(c => c.name).slice(-2)).toEqual(['Income Statement', 'Balance Sheet']);
      // Opening it again adds nothing.
      expect((await other.evaluate((file) => fm.previewLibraryPack(file), pack)).items.every(i => i.status === 'present')).toBe(true);
      expect(await other.evaluate((file) => fm.openLibraryPack(file), pack)).toEqual({ templates: { added: 0, present: 3, renumbered: 0 }, functions: { added: 0, present: 2, renumbered: 0 } });
    }finally{ await ctx.close(); }
  });

  test('item statuses: already there, a new version of yours, a name you already use', async ({ page }) => {
    await fillLibrary(page);   // has Income Statement v1, Balance Sheet v1–v2, Margin v1–v2, Profit v1
    const pack = readFixture('library', 'pack-v1.json');
    const items = (await page.evaluate((file) => fm.previewLibraryPack(file), pack)).items;
    expect(items.map(i => [i.name, i.version, i.status])).toEqual([
      ['Income Statement', 1, 'present'],
      ['Balance Sheet', 3, 'new-version'],
      ['Cash Flow', 1, 'same-name'],
      ['Margin', 3, 'new-version'],
      ['Growth', 1, 'new']]);
    expect(items[1].statusText).toMatch(/Adds a version to your “Balance Sheet” \(you have up to v2\)/);
    expect(items[2].statusText).toMatch(/different canvas template called “Cash Flow” — both will be kept/);
    // Only Growth (which calls Margin v3): Margin v3 comes along.
    const out = await page.evaluate((file) => fm.openLibraryPack({ file, items: ['f1'] }), pack);
    expect(out.functions).toEqual({ added: 2, present: 0, renumbered: 0 });
    expect(out.templates).toEqual({ added: 0, present: 0, renumbered: 0 });
    expect(await libraryState(page)).toMatchObject({ functions: ['Growth:1', 'Margin:3,2,1', 'Profit:1'] });
    expect(await err(page, (file) => fm.openLibraryPack({ file, items: ['x9'] }), pack)).toMatch(/no item "x9"/);
  });

  test('the preview window: who made it, the licence, statuses, the caution; Cancel adds nothing; Add adds the ticked ones', async ({ page }) => {
    await fillLibrary(page);
    const before = await libraryState(page);
    await F.importViaCommand(page, 'openLibraryPack', SAMPLE);
    const box = page.locator('.modal-box.library-pack-preview');
    await expect(box).toBeVisible();
    await expect(box.locator('.library-pack-title')).toHaveText('Sample pack');
    await expect(box.locator('.library-pack-by')).toHaveText('By Sam Sample · CC BY 4.0 · 2026-09-27');
    await expect(box.locator('.library-pack-licence')).toContainText('Creative Commons Attribution 4.0 International');
    await expect(box.locator('.library-pack-caution')).toBeVisible();
    const present = box.locator('.library-pack-item.present input');
    await expect(present).toBeDisabled();
    await expect(present).not.toBeChecked();
    await F.cancelDialog(page);
    await expect(box).toHaveCount(0);
    expect(await libraryState(page)).toEqual(before);
    // Again: untick Balance Sheet v3 and add the rest.
    await F.importViaCommand(page, 'openLibraryPack', SAMPLE);
    await box.locator('.library-pack-item[data-key="t1"] input').uncheck();
    await box.locator('button.primary', { hasText: 'Add to My Library' }).click();
    expect(await messageText(page)).toBe('From the library pack: 1 template added; 2 function versions added.');
    await F.dismissMessage(page);
    const after = await libraryState(page);
    expect(after.templates).toEqual(['Balance Sheet@1', 'Balance Sheet@2', 'Cash Flow@1', 'Cash Flow@1', 'Income Statement@1', 'Statements@1']);
    expect(after.functions).toEqual(['Growth:1', 'Margin:3,2,1', 'Profit:1']);
  });
});

test.describe('packs from other people', () => {
  test('hostile text in every field is shown as plain text, never run', async ({ page, pageErrors }, testInfo) => {
    const html = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
    const pack = readFixture('library', 'pack-v1.json');
    Object.assign(pack.pack, { title: html, author: html, description: html, tags: [html] });
    pack.templates.forEach(t => { t.name = html + t.name; t.description = html; t.note = html; });
    pack.functions.forEach(f => { f.description = html; });
    await F.importViaCommand(page, 'openLibraryPack', writeFile(testInfo, 'hostile.json', pack));
    const box = page.locator('.modal-box.library-pack-preview');
    await expect(box).toBeVisible();
    await expect(box.locator('.library-pack-title')).toHaveText(html);
    await expect(box.locator('.library-pack-by')).toContainText(html);
    expect(await box.locator('img, b').count()).toBe(0);
    await box.locator('button.primary').click();
    await F.dismissMessage(page);
    await page.evaluate(() => fm.command('openTemplates'));
    await expect(page.locator('.modal-box.template-box')).toContainText(html);
    // (The window has <b> labels of its own; none comes from the file.)
    expect(await page.locator('.modal-box img').count()).toBe(0);
    expect(await page.locator('.modal-box b', { hasText: /^bold$/ }).count()).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(pageErrors).toEqual([]);
  });

  test('a pack without an author, with another licence or without an id is refused, saying why', async ({ page }) => {
    const base = readFixture('library', 'pack-v1.json');
    const withInfo = (over) => Object.assign({}, base, { pack: Object.assign({}, base.pack, over) });
    const cases = [
      [withInfo({ author: '' }), /doesn't say who made it/],
      [withInfo({ licence: 'All rights reserved' }), /licence \("All rights reserved"\) isn't one fmIDE accepts/],
      [withInfo({ licence: undefined }), /has no licence/],
      [withInfo({ id: '<x>' }), /no valid id/],
      [withInfo({ title: '   ' }), /no title/],
      [Object.assign({}, base, { pack: undefined }), /doesn't say what it is/],
    ];
    for(const [file, why] of cases){
      expect(await err(page, (f) => fm.previewLibraryPack(f), file)).toMatch(why);
      expect(await err(page, (f) => fm.openLibraryPack(f), file)).toMatch(why);
    }
    expect(await libraryState(page)).toEqual({ templates: [], functions: [] });
  });

  test('wrong kinds say where they belong; a newer pack asks first', async ({ page }, testInfo) => {
    // A templates file through Open Library Pack…, a pack through Import Templates.
    await F.importViaCommand(page, 'openLibraryPack', TEMPLATES);
    expect(await messageText(page)).toBe('That is an fmIDE templates file, not a library pack. Open it with Templates → Import Templates.');
    await F.dismissMessage(page);
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', SAMPLE);
    expect(await messageText(page)).toBe('That is an fmIDE library pack, not a templates file. Open it with File → Open Library Pack.');
    await F.dismissMessage(page);
    await page.locator('.modal-box.template-box .modal-actions button', { hasText: /^Close$/ }).click();
    // A pack from a newer fmIDE: the action refuses without allowNewer; the window asks.
    const newer = Object.assign(readFixture('library', 'pack-v1.json'), { version: 2 });
    expect(await err(page, (f) => fm.openLibraryPack(f), newer)).toMatch(/newer version of fmIDE \(format version 2\)/);
    await F.importViaCommand(page, 'openLibraryPack', writeFile(testInfo, 'newer.json', newer));
    expect(await F.dialogText(page)).toMatch(/saved by a newer version of fmIDE/);
    await F.confirmDanger(page);
    await expect(page.locator('.modal-box.library-pack-preview')).toBeVisible();
  });

  test('ExcelExporter says a pack belongs in fmIDE', async ({ page }) => {
    await openApp(page, 'ExcelExporter');
    await page.locator('#fileInput').setInputFiles(SAMPLE);
    await expect(page.locator('#loadStatus')).toHaveText('That is an fmIDE library pack (templates and functions to share) — open it in fmIDE with File → Open Library Pack.');
  });
});

test.describe('size limits for every file opened', () => {
  const deep = '{"kind":"system","version":6,"canvases":' + '['.repeat(5000) + ']'.repeat(5000) + '}';

  test('fmIDE refuses a file nested too deeply or too large, with a message, and keeps working', async ({ page, pageErrors }, testInfo) => {
    await F.importViaCommand(page, 'loadSystem', writeFile(testInfo, 'deep.json', deep));
    expect(await messageText(page)).toBe('That file is nested too deeply to open (more than 100 levels).');
    await F.dismissMessage(page);
    await F.importViaCommand(page, 'openLibraryPack', writeFile(testInfo, 'deep-pack.json', deep.replace('"system","version":6', '"fmIDE-library-pack","version":1')));
    expect(await messageText(page)).toMatch(/nested too deeply/);
    await F.dismissMessage(page);
    // Just over 50 MB of text.
    const big = '{"kind":"system","version":6,"canvases":[],"pad":"' + 'x'.repeat(50 * 1024 * 1024) + '"}';
    await F.importViaCommand(page, 'importWorkspace', writeFile(testInfo, 'big.json', big));
    expect(await messageText(page)).toBe('That file is too large to open (51 MB; the limit is 50 MB).');
    await F.dismissMessage(page);
    expect(pageErrors).toEqual([]);
    // Still working: a real file opens.
    await F.importViaCommand(page, 'loadSystem', fixture('formats', 'sys-current.json'));
    await F.acceptAll(page);
    expect((await page.evaluate(() => fm.canvases())).length).toBeGreaterThan(0);
  });

  test('ExcelExporter refuses a file nested too deeply', async ({ page, pageErrors }, testInfo) => {
    await openApp(page, 'ExcelExporter');
    await page.locator('#fileInput').setInputFiles(writeFile(testInfo, 'deep.json', deep));
    await expect(page.locator('#loadStatus')).toHaveText('That file is nested too deeply to open (more than 100 levels).');
    expect(pageErrors).toEqual([]);
  });
});

test.describe('the ribbon', () => {
  test('Open Library Pack… and Save as Library Pack… in the File tab\'s Library group, no shortcuts', async ({ page }) => {
    const cfg = await page.evaluate(() => __fmIDE.getRibbonConfig());
    const lib = cfg.tabs.find(t => t.id === 'file').groups.find(g => g.label === 'Library').items.map(i => i.cmd);
    expect(lib).toEqual(['openTemplates', 'openFunctions', 'openFormats', 'openLibraryPack', 'saveLibraryPack']);
    expect(await page.evaluate(() => fm.commands().filter(c => /LibraryPack$/.test(c.id)))).toEqual([
      { id: 'openLibraryPack', label: 'Open Library Pack…', category: 'File', shortcut: null },
      { id: 'saveLibraryPack', label: 'Save as Library Pack…', category: 'File', shortcut: null },
    ]);
  });

  test('a customised ribbon gets them once, in the group holding Format Presets; removing them is respected', async ({ page }, testInfo) => {
    const ws = (flag, groups) => {
      const system = readFixture('formats', 'sys-current.json');
      return JSON.stringify({ kind: 'fmIDE-workspace', version: 5, system, ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true,
        functionCommandsAdded: true, operatorsE1Added: true, libraryPacksAdded: flag, libraryAuthor: 'Someone Else',
        ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups }] } } });
    };
    const items = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
    await F.importViaCommand(page, 'importWorkspace', writeFile(testInfo, 'old.json', ws(undefined, [{ label: 'Stuff', items: [{ cmd: 'openFormats' }] }, { label: 'Other', items: [{ cmd: 'addRect' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats,openLibraryPack,saveLibraryPack', 'Other:addRect']);
    await F.importViaCommand(page, 'importWorkspace', writeFile(testInfo, 'removed.json', ws(true, [{ label: 'Stuff', items: [{ cmd: 'openFormats' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats']);
    // Someone else's workspace never sets the author name offered for your packs.
    await page.evaluate(() => fm.saveFunction({ text: 'One(a) = a' }));
    await page.evaluate(() => fm.command('saveLibraryPack'));
    await expect(page.locator('.modal-box.library-pack-save input.pack-author')).toHaveValue('');
  });
});
