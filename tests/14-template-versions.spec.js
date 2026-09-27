// 14. Template families and versions — every template belongs to a family (a lasting random
// id) and has a version number and a change note. "Save as new version" adds a version,
// insertTemplate takes "Name@latest" / "Name@3", and older files become one family each.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

const UID = /^[A-Za-z0-9-]{8,64}$/;
const picker = (page) => page.locator('.modal-box.template-box');
const form = (page) => page.locator('.modal-box.template-form');
const openTemplates = async (page) => {
  await page.evaluate(() => fm.command('openTemplates'));
  await expect(picker(page)).toBeVisible();
};
const closeTemplates = (page) => picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
const familyEntries = (page) => picker(page).locator('.template-list button.template-family');
const familyNames = async (page) => (await familyEntries(page).allInnerTexts()).map(t => t.split('\n')[0]);
const selectFamily = (page, name) => familyEntries(page).filter({ hasText: name }).click();
// The message an import shows (a box with a single OK). Waits for that box itself: the
// Templates window is also a .modal-box, so the topmost one may still be the window.
async function messageText(page){
  const box = page.locator('.modal-box', { has: page.locator('.modal-actions button', { hasText: /^OK$/ }) }).last();
  await expect(box).toBeVisible();
  return (await box.locator('p').first().textContent()) || '';
}

// One rectangle, "Revenue", holding `value`, on a cleared model.
const setRevenue = (page, value) => page.evaluate((v) => {
  if(!fm.nodes().some(n => n.name === 'Revenue')) fm.createRect({ x: 60, y: 60, name: 'Revenue', value: String(v) });
  else fm.setValue({ node: 'Revenue', value: String(v) });
}, value);

// "+ Save Canvas as Template" with this name and note (the form is left for the caller when
// `submit` is false).
async function saveCanvasAsTemplate(page, name, note, submit = true){
  await picker(page).locator('button', { hasText: '+ Save Canvas as Template' }).click();
  await form(page).locator('input.template-form-name').fill(name);
  await form(page).locator('input.template-form-note').fill(note);
  if(submit) await form(page).locator('button.primary', { hasText: 'Save Template' }).click();
}
// "⤴ Save as new version" on the selected family.
async function saveNewVersion(page, note){
  await picker(page).locator('button.template-save-version').click();
  await form(page).locator('input.template-form-note').fill(note);
  await form(page).locator('button.primary', { hasText: /^Save version \d+$/ }).click();
}
// The library as saved: the templates in an exported workspace.
async function library(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  return data.templates;
}
// Revenue v1 = 10 ("first") and v2 = 20 ("price up"), one family; the window is left open.
async function twoVersions(page){
  await page.evaluate(() => fm.clearAll());
  await setRevenue(page, 10);
  await openTemplates(page);
  await saveCanvasAsTemplate(page, 'Revenue plan', 'first');
  await closeTemplates(page);
  await setRevenue(page, 20);
  await openTemplates(page);
  await selectFamily(page, 'Revenue plan');
  await saveNewVersion(page, 'price up');
}
// Insert a module template on a new canvas; the value of its Revenue rectangle, or the error.
const insertedRevenue = (page, ref) => page.evaluate((r) => {
  try{ fm.insertTemplate(r, 'newCanvas'); return fm.getValue({ node: 'Revenue' }); }
  catch(err){ return 'Error: ' + err.message; }
}, ref);

test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

test('"Save as new version" adds version 2 to the same family, with its note', async ({ page }) => {
  await twoVersions(page);
  const saved = await library(page);
  expect(saved.map(t => [t.name, t.version, t.note])).toEqual([['Revenue plan', 1, 'first'], ['Revenue plan', 2, 'price up']]);
  expect(saved[0].family).toMatch(UID);
  expect(saved[1].family).toBe(saved[0].family);
  expect(saved[0].versionId).toMatch(UID);
  expect(saved[1].versionId).toMatch(UID);
  expect(saved[1].versionId).not.toBe(saved[0].versionId);
});

test('the window shows one entry per family; older versions underneath, newest first', async ({ page }) => {
  await twoVersions(page);
  await closeTemplates(page);
  await setRevenue(page, 30);
  await openTemplates(page);
  await selectFamily(page, 'Revenue plan');
  await saveNewVersion(page, 'third');
  expect(await familyNames(page)).toEqual(['Revenue plan']);
  await expect(familyEntries(page)).toContainText('v3');
  await expect(picker(page).locator('.template-version-info')).toHaveText('Version 3 of 3 — third');
  const toggle = picker(page).locator('button.template-versions-toggle');
  await expect(toggle).toHaveText('▸ 2 older versions');
  await expect(picker(page).locator('button.template-version')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveText('▾ 2 older versions');
  await expect(picker(page).locator('button.template-version')).toHaveText(['v2 — price up', 'v1 — first']);
  await picker(page).locator('button.template-version', { hasText: 'v1' }).click();
  await expect(picker(page).locator('.template-version-info')).toHaveText('Version 1 of 3 (an older version) — first');
  // "Add to new canvas" inserts the version selected.
  await picker(page).locator('button', { hasText: 'Add to new canvas' }).click();
  expect(await page.evaluate(() => fm.getValue({ node: 'Revenue' }))).toBe(10);
});

test('saving under a new name starts a new family; under a taken name it asks first', async ({ page }) => {
  await page.evaluate(() => fm.clearAll());
  await setRevenue(page, 10);
  await openTemplates(page);
  await saveCanvasAsTemplate(page, 'Revenue plan', '');
  // Same name: a question, and "Choose another name" goes back to the form, saving nothing.
  await saveCanvasAsTemplate(page, ' revenue PLAN ', 'second try', false);
  await form(page).locator('button.primary', { hasText: 'Save Template' }).click();
  const ask = page.locator('.modal-box.template-name-taken');
  await expect(ask.locator('p')).toHaveText('There is already a template called "Revenue plan" (version 1). Save this as its next version, or choose another name for a new template?');
  await ask.locator('button', { hasText: 'Choose another name' }).click();
  await expect(ask).toHaveCount(0);
  await expect(form(page)).toBeVisible();
  await form(page).locator('input.template-form-name').fill('Revenue plan B');
  await form(page).locator('button.primary', { hasText: 'Save Template' }).click();
  await expect(form(page)).toHaveCount(0);
  // Same name again, this time choosing a new version.
  await saveCanvasAsTemplate(page, 'Revenue plan', 'on purpose');
  await ask.locator('button', { hasText: 'Save as new version of "Revenue plan"' }).click();
  await expect(form(page)).toHaveCount(0);
  const saved = await library(page);
  expect(saved.map(t => [t.name, t.version, t.note])).toEqual([['Revenue plan', 1, ''], ['Revenue plan B', 1, 'second try'], ['Revenue plan', 2, 'on purpose']]);
  expect(saved[1].family).not.toBe(saved[0].family);
  expect(saved[2].family).toBe(saved[0].family);
});

test('insertTemplate takes "Name@latest", "Name@1" and the family id', async ({ page }) => {
  await twoVersions(page);
  await closeTemplates(page);
  const family = (await library(page))[0].family;
  expect(await insertedRevenue(page, 'Revenue plan')).toBe(20);
  expect(await insertedRevenue(page, 'Revenue plan@latest')).toBe(20);
  expect(await insertedRevenue(page, 'revenue plan @ 1')).toBe(10);
  expect(await insertedRevenue(page, 'Revenue plan@2')).toBe(20);
  expect(await insertedRevenue(page, family + '@1')).toBe(10);
  expect(await insertedRevenue(page, family)).toBe(20);
  expect(await insertedRevenue(page, 'Revenue plan@9')).toBe('Error: There is no version 9 of "Revenue plan" (it has versions 1, 2).');
  expect(await insertedRevenue(page, 'Nothing@1')).toBe('Error: There is no template called "Nothing".');
});

test('two families with the same name: refer to them by family id', async ({ page }, testInfo) => {
  await twoVersions(page);
  await closeTemplates(page);
  // Someone else's "Revenue plan": a family of its own.
  const other = testInfo.outputPath('other.json');
  fs.writeFileSync(other, JSON.stringify({ version: 2, kind: 'fmIDE-templates', templates: [{
    name: 'Revenue plan', kind: 'module', family: 'someone-elses-family', version: 1, note: '', versionId: 'someone-elses-v1',
    data: { version: 2, kind: 'module', nodes: [{ id: 'n1', type: 'value', x: 50, y: 50, w: 170, h: 64, text: 'Revenue\n99' }], edges: [] } }] }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', other);
  expect(await messageText(page)).toBe('Imported 1 template.');
  await F.dismissMessage(page);
  expect(await familyNames(page)).toEqual(['Revenue plan', 'Revenue plan']);
  expect(await insertedRevenue(page, 'Revenue plan@1')).toBe('Error: More than one template family is named "Revenue plan" — refer to it by its family ID.');
  expect(await insertedRevenue(page, 'someone-elses-family@latest')).toBe(99);
});

test('import: a version with a taken number but different content becomes the next number', async ({ page }, testInfo) => {
  await twoVersions(page);
  const [chosen] = await Promise.all([page.waitForEvent('download'), picker(page).locator('button', { hasText: '⇩ Export Templates' }).click()]);
  const exported = JSON.parse(fs.readFileSync(await chosen.path(), 'utf8'));
  expect(exported.kind).toBe('fmIDE-templates');
  expect(exported.version).toBe(6);
  await closeTemplates(page);
  // Their v2 holds something else; their v3 is new here.
  const theirs = JSON.parse(JSON.stringify(exported));
  theirs.templates[1].data.nodes[0].text = 'Revenue\n25';
  theirs.templates[1].note = 'their change';
  theirs.templates[1].versionId = 'their-v2-version-id';
  const v3 = JSON.parse(JSON.stringify(theirs.templates[1]));
  Object.assign(v3, { version: 3, note: 'their v3', versionId: 'their-v3-version-id' });
  v3.data.nodes[0].text = 'Revenue\n30';
  theirs.templates.push(v3);
  const path = testInfo.outputPath('theirs.json');
  fs.writeFileSync(path, JSON.stringify(theirs));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  expect(await messageText(page)).toBe('Imported 2 templates (1 was already there). 1 was added as a new version because its number was already taken by a different version.');
  await F.dismissMessage(page);
  const saved = await library(page);
  // Their v3 keeps its number (it was free); their v2 goes after it.
  expect(saved.map(t => [t.version, t.note])).toEqual([[1, 'first'], [2, 'price up'], [3, 'their v3'], [4, 'Imported — was v2 in the file: their change']]);
  expect(new Set(saved.map(t => t.family)).size).toBe(1);
  expect(saved[3].versionId).toBe('their-v2-version-id');
  // The same file again adds nothing.
  await closeTemplates(page);
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  expect(await messageText(page)).toBe('All 3 templates in that file are already in your library.');
});

test('the latest version is deleted only with the whole template; older ones one by one', async ({ page }) => {
  await twoVersions(page);
  const del = picker(page).locator('button.template-delete');
  await expect(del).toHaveText('🗑 Delete (all 2 versions)');
  await picker(page).locator('button.template-versions-toggle').click();
  await picker(page).locator('button.template-version', { hasText: 'v1' }).click();
  await expect(del).toHaveText('🗑 Delete version 1');
  await del.click();
  expect(await F.dialogText(page)).toBe('Delete version 1 of "Revenue plan"? The other versions stay. This can\'t be undone.');
  await F.confirmDanger(page);
  await expect(picker(page).locator('.template-version-info')).toHaveText('Version 2 — price up');
  await expect(picker(page).locator('button.template-versions-toggle')).toHaveCount(0);
  // A new version after that is 3: numbers are never reused.
  await saveNewVersion(page, 'after delete');
  await expect(del).toHaveText('🗑 Delete (all 2 versions)');
  await del.click();
  expect(await F.dialogText(page)).toBe('Delete the template "Revenue plan" and all 2 of its versions? This can\'t be undone.');
  await F.confirmDanger(page);
  await expect(familyEntries(page)).toHaveCount(0);
  expect(await library(page)).toEqual([]);
});

test('Edit info renames every version; the note belongs to one version', async ({ page }) => {
  await twoVersions(page);
  await picker(page).locator('button', { hasText: '✎ Edit info' }).click();
  await form(page).locator('input.template-form-name').fill('Sales plan');
  await form(page).locator('input.template-form-note').fill('price up 10%');
  await form(page).locator('button.primary', { hasText: 'Save Changes' }).click();
  const saved = await library(page);
  expect(saved.map(t => [t.name, t.version, t.note])).toEqual([['Sales plan', 1, 'first'], ['Sales plan', 2, 'price up 10%']]);
});

test('families, versions and notes survive a reload (autosave)', async ({ page }) => {
  await twoVersions(page);
  await closeTemplates(page);
  const before = await library(page);
  await page.waitForTimeout(1500);   // saving a template autosaves shortly after
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  const after = await library(page);
  expect(after.map(({ id, ...rest }) => rest)).toEqual(before.map(({ id, ...rest }) => rest));
});

test('a macro records an older version as "Name@1", the latest as the name', async ({ page }) => {
  await twoVersions(page);
  await closeTemplates(page);
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await openTemplates(page);
  await picker(page).locator('button.template-versions-toggle').click();
  await picker(page).locator('button.template-version', { hasText: 'v1' }).click();
  await picker(page).locator('button', { hasText: 'Add to new canvas' }).click();
  await openTemplates(page);
  await selectFamily(page, 'Revenue plan');
  await picker(page).locator('button', { hasText: 'Add to new canvas' }).click();
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const steps = data.macros[data.macros.length - 1].steps.filter(s => s.action === 'insertTemplate');
  expect(steps.map(s => s.args.template)).toEqual(['Revenue plan@1', 'Revenue plan']);
});

// ---------- older files ----------
test('a v1 templates file: each template becomes a family of its own, version 1', async ({ page }) => {
  const file = fixture('formats', 'templates-v1.json');
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file);
  expect(await messageText(page)).toBe('Imported 2 templates.');
  await F.dismissMessage(page);
  const saved = await library(page);
  expect(saved.map(t => [t.name, t.version, t.note])).toEqual([['Old Revenue', 1, ''], ['Old Costs', 1, '']]);
  saved.forEach(t => { expect(t.family).toMatch(UID); expect(t.versionId).toMatch(UID); });
  expect(saved[0].family).not.toBe(saved[1].family);
  // Read again, it gets new random families — but they are the same templates, so nothing is added.
  await closeTemplates(page);
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', file);
  expect(await messageText(page)).toBe('All 2 templates in that file are already in your library.');
});

test('a v1 workspace: its templates become families, and it saves as the current version (6)', async ({ page }) => {
  await F.importViaCommand(page, 'importWorkspace', fixture('formats', 'ws-v1-templates.json'));
  await F.acceptAll(page);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(data.version).toBe(6);
  expect(data.templates.map(t => [t.name, t.version, t.note])).toEqual([['Old Revenue', 1, ''], ['Old Costs', 1, '']]);
  data.templates.forEach(t => expect(t.family).toMatch(UID));
  expect(await insertedRevenue(page, 'Old Revenue@1')).toBe(100);
});

test('a workspace from a newer fmIDE (version 7) asks before opening', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('newer.json');
  const ws = JSON.parse(fs.readFileSync(fixture('formats', 'ws-v1-templates.json'), 'utf8'));
  ws.version = 7;
  fs.writeFileSync(path, JSON.stringify(ws));
  await F.importViaCommand(page, 'importWorkspace', path);
  expect(await F.dialogText(page)).toMatch(/^This workspace was saved by a newer version of fmIDE \(format version 7; this fmIDE reads up to version 6\)/);
});

// ---------- untrusted text ----------
test('a family id or note from a file is checked, and shown as text', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('hostile.json');
  const note = '<img src=x onerror="window.__pwned=1">';
  fs.writeFileSync(path, JSON.stringify({ version: 2, kind: 'fmIDE-templates', templates: [{
    name: 'Hostile', kind: 'module', family: '<script>alert(1)</script>', version: 'two', note, versionId: '"><b>',
    data: { version: 2, kind: 'module', nodes: [{ id: 'n1', type: 'value', x: 50, y: 50, w: 170, h: 64, text: 'Revenue\n1' }], edges: [] } }] }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  await F.dismissMessage(page);
  await selectFamily(page, 'Hostile');
  await expect(picker(page).locator('.template-version-info')).toHaveText('Version 1 — ' + note);
  await expect(picker(page).locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  const [saved] = await library(page);
  expect(saved.family).toMatch(UID);
  expect(saved.versionId).toMatch(UID);
  expect(saved.version).toBe(1);
  expect(saved.note).toBe(note);
});

// ---------- Remove duplicates ----------
test('Remove duplicates compares latest versions and removes a whole family', async ({ page }, testInfo) => {
  await twoVersions(page);   // "Revenue plan": v1 = 10, v2 = 20
  await closeTemplates(page);
  // Two other families: one the same as v2 (the latest), one the same as v1 (an older version).
  await openTemplates(page);
  const [chosen] = await Promise.all([page.waitForEvent('download'), picker(page).locator('button', { hasText: '⇩ Export Templates' }).click()]);
  const mine = JSON.parse(fs.readFileSync(await chosen.path(), 'utf8'));
  await closeTemplates(page);
  const copyOf = (t, name, family) => Object.assign({}, t, { name, family, versionId: family + '-v1', version: 1, note: '' });
  const path = testInfo.outputPath('copies.json');
  fs.writeFileSync(path, JSON.stringify({ version: 2, kind: 'fmIDE-templates', templates: [
    copyOf(mine.templates[1], 'Copy of latest', 'family-copy-of-latest'),
    copyOf(mine.templates[0], 'Copy of v1', 'family-copy-of-v1') ] }));
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  await F.dismissMessage(page);
  await picker(page).locator('button.template-dedupe').click();
  const dedupe = page.locator('.modal-box.dedupe-box');
  await dedupe.locator('label[data-option="name"] input').uncheck();
  await expect(dedupe.locator('.dedupe-summary')).toHaveText('1 set of duplicates — 1 template will be removed.');
  await expect(dedupe.locator('.dedupe-meta')).toHaveText(['My Templates · module · v2 (and 1 older version)', 'My Templates · module · v1']);
  // Keep the copy: "Revenue plan" goes, with both its versions.
  await dedupe.locator('.dedupe-row').nth(1).locator('input[type=radio]').check();
  await dedupe.locator('button.danger').click();
  await dedupe.locator('label[data-option="name"] input').waitFor({ state: 'detached' });
  expect((await library(page)).map(t => t.name)).toEqual(['Copy of latest', 'Copy of v1']);
});
