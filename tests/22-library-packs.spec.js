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
    expect(pack.version).toBe(2);
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
    const newer = Object.assign(readFixture('library', 'pack-v1.json'), { version: 3 });
    expect(await err(page, (f) => fm.openLibraryPack(f), newer)).toMatch(/newer version of fmIDE \(format version 3\)/);
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
    expect(lib).toEqual(['openTemplates', 'openFunctions', 'openFormats', 'browseLibrary', 'openLibraryPack', 'saveLibraryPack']);
    expect(await page.evaluate(() => fm.commands().filter(c => /LibraryPack$/.test(c.id)))).toEqual([
      { id: 'openLibraryPack', label: 'Open Library Pack…', category: 'File', shortcut: null },
      { id: 'saveLibraryPack', label: 'Save as Library Pack…', category: 'File', shortcut: null },
    ]);
  });

  test('a customised ribbon gets them once, in the group holding Format Presets; removing them is respected', async ({ page }, testInfo) => {
    const ws = (flag, groups) => {
      const system = readFixture('formats', 'sys-current.json');
      return JSON.stringify({ kind: 'fmIDE-workspace', version: 5, system, ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true,
        functionCommandsAdded: true, operatorsE1Added: true, libraryPacksAdded: flag, libraryBrowseAdded: flag, libraryAuthor: 'Someone Else',
        ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups }] } } });
    };
    const items = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
    await F.importViaCommand(page, 'importWorkspace', writeFile(testInfo, 'old.json', ws(undefined, [{ label: 'Stuff', items: [{ cmd: 'openFormats' }] }, { label: 'Other', items: [{ cmd: 'addRect' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats,browseLibrary,openLibraryPack,saveLibraryPack', 'Other:addRect']); // Browse Library… since 8d
    await F.importViaCommand(page, 'importWorkspace', writeFile(testInfo, 'removed.json', ws(true, [{ label: 'Stuff', items: [{ cmd: 'openFormats' }] }])));
    await F.acceptAll(page);
    expect(await items()).toEqual(['Stuff:openFormats']);
    // Someone else's workspace never sets the author name offered for your packs.
    await page.evaluate(() => fm.saveFunction({ text: 'One(a) = a' }));
    await page.evaluate(() => fm.command('saveLibraryPack'));
    await expect(page.locator('.modal-box.library-pack-save input.pack-author')).toHaveValue('');
  });
});

// Phase 8b: where items came from. A template or function version added from a pack remembers
// the pack (`origin`: packId, packTitle, author, licence); the windows show it; the preview
// warns when a pack adds a version to a family from another author or of your own.
const SAM = { packId: 'pack-sample-0001', packTitle: 'Sample pack', author: 'Sam Sample', licence: 'CC-BY-4.0' };
async function templateOrigins(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const out = {};
  data.templates.forEach(t => { out[`${t.name}@${t.version}`] = t.origin || null; });
  return out;
}
const functionOrigins = (page) => page.evaluate(() => {
  const out = {};
  fm.listFunctions().forEach(f => f.versions.forEach(v => { out[`${v.name}@${v.version}`] = v.origin; }));
  return out;
});
// SAMPLE with other pack details (and a fresh Balance Sheet v4, so there is always a new version).
function otherPack(over, itemOrigin){
  const pack = readFixture('library', 'pack-v1.json');
  Object.assign(pack.pack, over);
  const bs = pack.templates.find(t => t.name === 'Balance Sheet');
  Object.assign(bs, { version: 4, versionId: 'vid-balance-v4-other', note: 'Fourth' });
  bs.data = JSON.parse(JSON.stringify(bs.data).replace('Balance Sheet', 'Balance Sheet (v4)'));
  if(itemOrigin) pack.templates.concat(pack.functions).forEach(x => { x.origin = itemOrigin; });
  return pack;
}

test.describe('where items came from (origin)', () => {
  test('items added from a pack remember it; it survives the autosave and every export; new versions of yours have none', async ({ page }) => {
    await page.evaluate((file) => fm.openLibraryPack(file), readFixture('library', 'pack-v1.json'));
    expect(await templateOrigins(page)).toEqual({ 'Income Statement@1': SAM, 'Balance Sheet@3': SAM, 'Cash Flow@1': SAM });
    expect(await functionOrigins(page)).toEqual({ 'Margin@3': SAM, 'Growth@1': SAM });
    expect((await page.evaluate(() => fm.getFunction('Growth'))).origin).toEqual(SAM);
    // The functions file and the templates file carry it.
    const fnFile = await page.evaluate(() => fm.exportFunctions({ download: false }));
    expect(fnFile.version).toBe(2);
    expect(fnFile.functions.map(d => d.origin)).toEqual([SAM, SAM]);
    await page.evaluate(() => fm.command('openTemplates'));
    const { data: tFile } = await F.downloadJson(page, () => page.locator('.modal-box.template-box button', { hasText: '⇩ Export Templates' }).click());
    expect(tFile.templates.map(t => t.origin)).toEqual([SAM, SAM, SAM]);
    await page.locator('.modal-box.template-box .modal-actions button', { hasText: /^Close$/ }).click();
    // After a reload (the autosave), still there.
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    expect(await functionOrigins(page)).toEqual({ 'Margin@3': SAM, 'Growth@1': SAM });
    expect((await templateOrigins(page))['Cash Flow@1']).toEqual(SAM);
    // A new version you save is yours: no origin; the older one keeps its own.
    await page.evaluate(() => fm.saveFunction({ text: 'Growth(Now, Before) = Now - Before', newVersionOf: 'Growth' }));
    expect(await functionOrigins(page)).toEqual({ 'Margin@3': SAM, 'Growth@1': SAM, 'Growth@2': null });
    await page.evaluate(() => fm.saveRecipe({ name: 'Two', parts: ['Income Statement', 'Cash Flow'] }));
    expect((await templateOrigins(page))['Two@1']).toBeNull();
    // Changing a description keeps it.
    await page.evaluate(() => fm.setFunctionInfo({ function: 'Growth@1', description: 'Changed', note: '' }));
    expect((await page.evaluate(() => fm.getFunction('Growth@1'))).origin).toEqual(SAM);
  });

  test('a model never carries an origin: a function node\'s definition in a saved system has none', async ({ page }) => {
    await page.evaluate((file) => fm.openLibraryPack(file), readFixture('library', 'pack-v1.json'));
    await page.evaluate(() => fm.insertFunction({ function: 'Growth', x: 300, y: 200 }));
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
    expect(data.functions.map(d => d.family + '@' + d.version)).toEqual(['family-growth@1', 'family-margin@3']);
    expect(JSON.stringify(data)).not.toContain('"origin"');
    expect(JSON.stringify(await page.evaluate(() => fm.listFunctions({ of: 'model' })))).not.toContain('origin');
    // The library keeps its own.
    expect((await functionOrigins(page))['Growth@1']).toEqual(SAM);
  });

  test('a renumbered item keeps its origin; one already in your library is left as it was', async ({ page }) => {
    await fillLibrary(page);   // Income Statement v1 (the pack's too), Margin v1–v2 — yours
    const pack = readFixture('library', 'pack-v1.json');
    pack.functions[0].version = 2;   // Margin "v2" from the pack: its number is taken here
    const out = await page.evaluate((file) => fm.openLibraryPack(file), pack);
    expect(out.functions).toEqual({ added: 2, present: 0, renumbered: 1 });
    expect(await functionOrigins(page)).toMatchObject({ 'Margin@1': null, 'Margin@2': null, 'Margin@3': SAM, 'Growth@1': SAM });
    expect((await templateOrigins(page))['Income Statement@1']).toBeNull();
  });

  test('the Templates window and the Functions manager say where a version came from', async ({ page }) => {
    await importTemplates(page);   // Balance Sheet v1–v2, yours
    await page.evaluate((file) => fm.openLibraryPack({ file, items: ['t1', 'f1'] }), readFixture('library', 'pack-v1.json'));
    await page.evaluate(() => fm.command('openTemplates'));
    const box = page.locator('.modal-box.template-box');
    await box.locator('.template-list button', { hasText: 'Balance Sheet' }).first().click();
    await expect(box.locator('.template-origin')).toHaveText([
      'From the library pack “Sample pack” by Sam Sample · CC BY 4.0.',
      'Versions: v1, v2 yours · v3 from “Sample pack” by Sam Sample.']);
    await box.locator('.template-list button', { hasText: 'Income Statement' }).first().click();
    await expect(box.locator('.template-origin')).toHaveCount(0);
    await box.locator('.modal-actions button', { hasText: /^Close$/ }).click();
    await page.evaluate(() => fm.command('openFunctions'));
    const fns = page.locator('.modal-box').last();
    await fns.locator('button', { hasText: /^Growth/ }).first().click();
    await expect(fns.locator('.template-origin')).toHaveText(['From the library pack “Sample pack” by Sam Sample · CC BY 4.0.']);
  });

  test('"Update this canvas" says where the version came from', async ({ page }) => {
    await importTemplates(page);
    await page.evaluate(() => fm.insertTemplate('Balance Sheet@1', 'newCanvas'));
    await page.evaluate((file) => fm.openLibraryPack({ file, items: ['t1'] }), readFixture('library', 'pack-v1.json'));
    await page.evaluate(() => fm.command('updateCanvasTemplate'));
    const box = page.locator('.modal-box.template-update-box');
    await expect(box.locator('.template-update-origin')).toHaveText('v3: From the library pack “Sample pack” by Sam Sample · CC BY 4.0.');
    await box.locator('select').selectOption('2');
    await expect(box.locator('.template-update-origin')).toHaveCount(0);
  });

  test('the family rule: a warning when a pack adds a version to your own work or to another author\'s', async ({ page }) => {
    // Your own (no record): Balance Sheet and Margin came from ordinary files.
    await fillLibrary(page);
    let items = (await page.evaluate((file) => fm.previewLibraryPack(file), readFixture('library', 'pack-v1.json'))).items;
    const byName = (list, n) => list.find(i => i.name === n);
    expect(byName(items, 'Balance Sheet')).toMatchObject({ status: 'new-version', warningKind: 'own' });
    expect(byName(items, 'Balance Sheet').warning).toBe('Your “Balance Sheet” is your own (or has no record of where it came from); this pack by Sam Sample would add a version to it.');
    expect(byName(items, 'Margin')).toMatchObject({ status: 'new-version', warningKind: 'own' });
    expect(byName(items, 'Growth')).toMatchObject({ status: 'new', warning: null, warningKind: null });
    expect(byName(items, 'Cash Flow').warning).toBeNull();
  });

  test('the family rule: the same author adds versions quietly; another author is warned about, whatever the items claim', async ({ page }) => {
    await page.evaluate((file) => fm.openLibraryPack(file), readFixture('library', 'pack-v1.json'));   // all from Sam
    const preview = (pack) => page.evaluate((file) => fm.previewLibraryPack(file), pack).then(r => r.items.find(i => i.name === 'Balance Sheet'));
    // Sam again (capitals and spaces don't count), in another pack.
    expect(await preview(otherPack({ id: 'pack-sample-0002', author: '  sam   SAMPLE ' }))).toMatchObject({ status: 'new-version', warning: null });
    // Someone else.
    const mallory = await preview(otherPack({ id: 'pack-mallory-001', author: 'Mallory' }));
    expect(mallory.warningKind).toBe('other-author');
    expect(mallory.warning).toBe('Your “Balance Sheet” came from Sam Sample (the pack “Sample pack”); this pack is by Mallory.');
    // Someone else whose items claim to be Sam's: still warned (the pack's author counts).
    const claims = await preview(otherPack({ id: 'pack-mallory-002', author: 'Mallory' }, SAM));
    expect(claims.warningKind).toBe('other-author');
    expect(claims.origin).toEqual(SAM);
  });

  test('the preview window: warned items start unticked, say why, and a ticked item that needs one says so', async ({ page }) => {
    await fillLibrary(page);
    await F.importViaCommand(page, 'openLibraryPack', SAMPLE);
    const box = page.locator('.modal-box.library-pack-preview');
    await expect(box.locator('.library-pack-warning')).toContainText('someone other than Sam Sample, or that you made. They are not ticked');
    const bs = box.locator('.library-pack-item[data-key="t1"]');
    await expect(bs.locator('input')).not.toBeChecked();
    await expect(bs.locator('.library-pack-item-warning')).toHaveText('⚠ Your “Balance Sheet” is your own (or has no record of where it came from); this pack by Sam Sample would add a version to it.');
    await expect(box.locator('.library-pack-item[data-key="f0"] input')).not.toBeChecked();   // Margin v3
    await expect(box.locator('.library-pack-item[data-key="t2"] input')).toBeChecked();       // Cash Flow (same name, no warning)
    const growth = box.locator('.library-pack-item[data-key="f1"]');
    await expect(growth.locator('input')).toBeChecked();
    await expect(growth.locator('.library-pack-item-status')).toContainText('brings 1 item it needs (one has a warning ⚠ — it comes along when this is ticked)');
  });

  test('sharing someone\'s item again keeps their credit: it arrives as theirs, and the preview says so', async ({ page, browser }) => {
    await page.evaluate((file) => fm.openLibraryPack(file), readFixture('library', 'pack-v1.json'));
    // The Save window names where it came from.
    await page.evaluate(() => fm.command('saveLibraryPack'));
    await expect(page.locator('.modal-box.library-pack-save label.library-pack-pick', { hasText: /^ Growth/ })).toContainText("from Sam Sample's pack “Sample pack”");
    await F.cancelDialog(page);
    const pack = await page.evaluate(() => fm.saveLibraryPack({ title: 'Bob re-shares', author: 'Bob', functions: ['Growth'], download: false }));
    expect(pack.version).toBe(2);
    expect(pack.functions.map(d => d.origin)).toEqual([SAM, SAM]);
    const ctx = await browser.newContext();
    await ctx.route('**/*', (route) => route.request().url() === ORIGIN + 'fmIDE.html'
      ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html')) })
      : route.abort('blockedbyclient'));
    const other = await ctx.newPage();
    try{
      await F.openFmIDE(other);
      expect((await other.evaluate((file) => fm.previewLibraryPack(file), pack)).items.map(i => i.origin)).toEqual([SAM, SAM]);
      await other.evaluate((file) => fm.openLibraryPack(file), pack);
      expect(await functionOrigins(other)).toEqual({ 'Growth@1': SAM, 'Margin@3': SAM });
      // An item without one takes the pack's.
      const own = await other.evaluate(() => { fm.saveFunction({ text: 'Mine(a) = a * 3' }); return fm.saveLibraryPack({ title: 'Bob own', author: 'Bob', functions: ['Mine'], download: false }); });
      expect(own.functions[0]).not.toHaveProperty('origin');
      await F.importViaCommand(other, 'openLibraryPack', writeFile(test.info(), 'reshared.json', pack));
      await expect(other.locator('.modal-box.library-pack-preview .library-pack-item-origin').first()).toHaveText('Shared before: From the library pack “Sample pack” by Sam Sample · CC BY 4.0');
    }finally{ await ctx.close(); }
  });

  test('an origin read from a file is checked: bad ones are dropped, text is shown as text', async ({ page, pageErrors }, testInfo) => {
    const html = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
    const good = { packId: 'pack-hostile-01', packTitle: html, author: html + ' '.repeat(3) + 'x'.repeat(300), licence: 'CC-BY-4.0', extra: 'dropped' };
    const bad = [
      null, 'Sam', ['x'], { packId: 'no', packTitle: 'T', author: 'A', licence: 'CC-BY-4.0' },
      { packId: 'pack-hostile-02', packTitle: '', author: 'A', licence: 'CC-BY-4.0' },
      { packId: 'pack-hostile-03', packTitle: 'T', author: 42, licence: 'CC-BY-4.0' },
      { packId: 'pack-hostile-04', packTitle: 'T', author: 'A', licence: 'All rights reserved' },
    ];
    const tpl = readFixture('formats', 'templates-v5.json');
    const templates = [Object.assign({}, tpl.templates[0], { version: 6, origin: good })];
    bad.forEach((o, i) => templates.push(Object.assign({}, tpl.templates[0], { name: 'Bad ' + i, family: 'fam-bad-origin-' + i, versionId: 'vid-bad-origin-' + i, origin: o })));
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', writeFile(testInfo, 'origins.json', { kind: 'fmIDE-templates', version: 6, templates }));
    await F.dismissMessage(page);
    await page.locator('.modal-box.template-box .modal-actions button', { hasText: /^Close$/ }).click();
    const origins = await templateOrigins(page);
    expect(origins['Income Statement@6']).toEqual({ packId: 'pack-hostile-01', packTitle: html, author: (html + ' x' + 'x'.repeat(299)).slice(0, 120), licence: 'CC-BY-4.0' });
    bad.forEach((o, i) => expect(origins[`Bad ${i}@1`]).toBeNull());
    // Functions: the same check.
    await page.evaluate((file) => fm.importFunctions(file), { kind: 'fmIDE-functions', version: 2, functions: [
      { family: 'family-hostile', version: 1, versionId: 'version-hostile-1', text: 'H(a) = a', description: '', note: '', calls: [], origin: good },
      { family: 'family-hostile', version: 2, versionId: 'version-hostile-2', text: 'H(a) = a * 2', description: '', note: '', calls: [], origin: bad[6] }] });
    expect(await functionOrigins(page)).toEqual({ 'H@1': origins['Income Statement@6'], 'H@2': null });
    // Shown as text.
    await page.evaluate(() => fm.command('openTemplates'));
    const box = page.locator('.modal-box.template-box');
    await box.locator('.template-list button', { hasText: 'Income Statement' }).first().click();
    await expect(box.locator('.template-origin').first()).toContainText(html);
    expect(await box.locator('.template-origin img, .template-origin b').count()).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(pageErrors).toEqual([]);
  });
});
