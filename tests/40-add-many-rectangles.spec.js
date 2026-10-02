// 40. Add Many Rectangles… and the quick chain (step 12b): type or paste a list of names and
// get one rectangle each, laid out with one gap, in one undo step; fm.createRects; Mod+Enter in
// a rectangle's editor starting the next one just below.
const fs = require('fs');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

const win = (page) => page.locator('.modal-box.add-many-box');
const nameBox = (page, i) => win(page).locator('.add-many-name').nth(i);
const rects = (page) => page.evaluate(() => fm.nodes().filter(n => n.type === 'value')
  .map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text })));
const nameOf = (r) => r.text.split('\n')[0];

async function openWindow(page){
  await page.evaluate(() => fm.command('addManyRects'));
  await expect(win(page)).toBeVisible();
  await expect(nameBox(page, 0)).toBeFocused();
}
async function setup(page){
  await F.openFmIDE(page);
  await page.evaluate(() => { fm.clearAll(); });
}

test.beforeEach(async ({ page }) => { await setup(page); });

test('typing a list with Enter: one rectangle per name, in a column with equal gaps, selected, one undo step', async ({ page, pageErrors }) => {
  await openWindow(page);
  expect(await win(page).locator('.add-many-name').count()).toBe(10);
  await page.keyboard.type('Revenue');
  await page.keyboard.press('Tab');
  await page.keyboard.type('100');
  await page.keyboard.press('Tab');
  await page.keyboard.type('$m');
  await page.keyboard.press('Enter');
  await expect(nameBox(page, 1)).toBeFocused();
  for(const n of ['Cost of sales', 'Gross margin']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  await expect(win(page).locator('.add-many-status')).toHaveText('3 of 10 rows filled — 3 rectangles will be added.');
  await expect(win(page).locator('button.add-many-add')).toHaveText('Add 3');
  await win(page).locator('button.add-many-add').click();
  await expect(win(page)).toHaveCount(0);

  const r = await rects(page);
  expect(r.map(x => x.text)).toEqual(['Revenue\n100\n$m', 'Cost of sales', 'Gross margin']);
  // A column: same x; each 22 pixels below the one before.
  expect(new Set(r.map(x => x.x)).size).toBe(1);
  expect(r[1].y - (r[0].y + r[0].h)).toBe(22);
  expect(r[2].y - (r[1].y + r[1].h)).toBe(22);
  expect((await page.evaluate(() => fm.selection())).sort()).toEqual(r.map(x => x.id).sort());
  // One undo step takes all three away.
  await page.evaluate(() => fm.command('undo'));
  expect(await rects(page)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Enter on the last row adds a row; Mod+Enter adds; Escape closes without adding', async ({ page }) => {
  await openWindow(page);
  await win(page).locator('.add-many-count input').fill('2');
  await win(page).locator('.add-many-count input').dispatchEvent('change');
  expect(await win(page).locator('.add-many-name').count()).toBe(2);
  await nameBox(page, 0).focus();
  for(const n of ['A', 'B', 'C']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  // Typed through: rows 3 and 4 were added, How many follows.
  expect(await win(page).locator('.add-many-name').count()).toBe(4);
  await expect(win(page).locator('.add-many-count input')).toHaveValue('4');
  await page.keyboard.press('Escape');
  await expect(win(page)).toHaveCount(0);
  expect(await rects(page)).toEqual([]);

  await openWindow(page);
  await page.keyboard.type('Only one');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(win(page)).toHaveCount(0);
  expect((await rects(page)).map(nameOf)).toEqual(['Only one']);
});

test('How many: more rows keep what is typed; fewer rows ask before dropping named ones', async ({ page }) => {
  await openWindow(page);
  const count = win(page).locator('.add-many-count input');
  const setCount = async (n) => { await count.fill(String(n)); await count.dispatchEvent('change'); };
  await nameBox(page, 0).fill('First');
  await nameBox(page, 4).fill('Fifth');
  await setCount(12);
  expect(await win(page).locator('.add-many-name').count()).toBe(12);
  await expect(nameBox(page, 4)).toHaveValue('Fifth');
  // Down to 6: rows 7 to 12 are empty, so no question.
  await setCount(6);
  expect(await win(page).locator('.add-many-name').count()).toBe(6);
  // Down to 3 would drop Fifth: asked; Cancel keeps all six rows.
  await setCount(3);
  const question = page.locator('.modal-box').last();
  await expect(question).toContainText('Remove the last 3 rows? 1 of them has a name.');
  await question.locator('button', { hasText: 'Cancel' }).click();
  expect(await win(page).locator('.add-many-name').count()).toBe(6);
  await expect(count).toHaveValue('6');
  await setCount(3);
  await page.locator('.modal-box').last().locator('button', { hasText: 'OK' }).click();
  expect(await win(page).locator('.add-many-name').count()).toBe(3);
  await expect(win(page).locator('.add-many-status')).toHaveText('1 of 3 rows filled — 1 rectangle will be added.');
});

test('pasting lines and Excel columns fills the rows, adding rows as needed; blank rows are skipped', async ({ page }) => {
  await openWindow(page);
  const paste = (i, text) => nameBox(page, i).evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
  // Lines from a text file, from row 2, with a blank line in the middle and a final newline.
  await paste(1, 'North\nSouth\n\nEast\n');
  expect(await win(page).locator('.add-many-name').evaluateAll(els => els.slice(0, 6).map(e => e.value))).toEqual(['', 'North', 'South', '', 'East', '']);
  // Columns copied from Excel, from row 9: name, value, unit — two more rows are added.
  await paste(8, 'Price\t10\t$/t\nVolume\t5\tkt\nRate\t0.1\n');
  expect(await win(page).locator('.add-many-name').count()).toBe(11);
  await expect(win(page).locator('.add-many-status')).toHaveText('6 of 11 rows filled — 6 rectangles will be added.');
  await win(page).locator('button.add-many-add').click();
  expect((await rects(page)).map(r => r.text)).toEqual(['North', 'South', 'East', 'Price\n10\n$/t', 'Volume\n5\nkt', 'Rate\n0.1']);
});

test('a row, a grid and the gap; the group lands where it overlaps nothing', async ({ page }) => {
  // Something in the middle of the view, where the group would go.
  await page.evaluate(() => fm.createRect({ name: 'In the way' }));
  await openWindow(page);
  for(const n of ['A', 'B', 'C', 'D', 'E']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  await win(page).locator('input[type=radio][value=grid]').check();
  await win(page).locator('.add-many-across').fill('2');
  await win(page).locator('.add-many-gap').fill('40');
  await win(page).locator('button.add-many-add').click();
  const all = await rects(page);
  const r = all.filter(x => nameOf(x) !== 'In the way');
  // Two across: A B / C D / E, 40 pixels apart.
  expect(r[1].x - (r[0].x + r[0].w)).toBe(40);
  expect(r[1].y).toBe(r[0].y);
  expect(r[2].x).toBe(r[0].x);
  expect(r[2].y - (r[0].y + r[0].h)).toBe(40);
  expect(r[4].x).toBe(r[0].x);
  // Nothing overlaps anything.
  for(let i = 0; i < all.length; i++) for(let j = i + 1; j < all.length; j++){
    const a = all[i], b = all[j];
    expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${nameOf(a)} / ${nameOf(b)}`).toBe(true);
  }

  await openWindow(page);
  for(const n of ['P', 'Q', 'R']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  await win(page).locator('input[type=radio][value=row]').check();
  await expect(win(page).locator('.add-many-across')).toBeHidden();
  await win(page).locator('button.add-many-add').click();
  const row = (await rects(page)).filter(x => ['P', 'Q', 'R'].includes(nameOf(x)));
  expect(new Set(row.map(x => x.y)).size).toBe(1);
  expect(row[1].x - (row[0].x + row[0].w)).toBe(22);
  expect(row[2].x - (row[1].x + row[1].w)).toBe(22);
});

test('a name already on the canvas, or twice in the list, is marked but still added', async ({ page }) => {
  await page.evaluate(() => fm.createRect({ name: 'Revenue' }));
  await openWindow(page);
  for(const n of ['revenue ', 'Cost', 'Cost']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  await expect(win(page).locator('.add-many-note').nth(0)).toHaveText('already on this canvas');
  await expect(win(page).locator('.add-many-note').nth(1)).toHaveText('');
  await expect(win(page).locator('.add-many-note').nth(2)).toHaveText('also in row 2');
  await win(page).locator('button.add-many-add').click();
  expect((await rects(page)).map(nameOf)).toEqual(['Revenue', 'revenue', 'Cost', 'Cost']);
});

test('hostile text in a name stays plain text', async ({ page, pageErrors }) => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  await openWindow(page);
  await page.keyboard.type(evil);
  await page.keyboard.press('Enter');
  await win(page).locator('button.add-many-add').click();
  expect((await rects(page)).map(nameOf)).toEqual([evil]);
  await expect(page.locator('.node .line-name', { hasText: '<img' })).toHaveCount(1);
  expect(await page.locator('.node img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('fm.createRects: items or names, x and y kept exactly, the errors; a bad value keeps the window open', async ({ page }) => {
  const ids = await page.evaluate(() => fm.createRects({ items: [{ name: 'Price', value: 10, uom: '$/t' }, 'Volume', { name: '  ' }], x: 100, y: 200 }));
  expect(ids.length).toBe(2);
  let r = await rects(page);
  expect(r.map(x => [x.text, x.x, x.y, x.w, x.h])).toEqual([['Price\n10\n$/t', 100, 200, 170, 64], ['Volume', 100, 286, 170, 64]]);
  await page.evaluate(() => fm.createRects({ names: 'One\nTwo\n\nThree', layout: 'row', gap: 10, x: 0, y: 500 }));
  r = (await rects(page)).slice(2);
  expect(r.map(x => [nameOf(x), x.x, x.y])).toEqual([['One', 0, 500], ['Two', 180, 500], ['Three', 360, 500]]);
  // Nothing to add, too many, a bad value: refused, nothing changed.
  const err = (args) => page.evaluate((args) => { try{ fm.createRects(args); return null; }catch(e){ return e.message; } }, args);
  expect(await err({ names: '\n \n' })).toContain('no names given');
  expect(await err({ names: Array.from({ length: 201 }, (_, i) => 'R' + i).join('\n') })).toContain('at most 200');
  expect(await err({ items: [{ name: 'Bad', value: '2 +' }] })).toBeTruthy();
  expect((await rects(page)).length).toBe(5);
  // In the window, a value that can't be read is shown and the window stays.
  await openWindow(page);
  await page.keyboard.type('Bad');
  await page.keyboard.press('Tab');
  await page.keyboard.type('2 +');
  await win(page).locator('button.add-many-add').click();
  await expect(win(page)).toBeVisible();
  await expect(win(page).locator('.add-many-status.add-many-error')).not.toHaveText('');
  expect((await rects(page)).length).toBe(5);
});

test('the macro recorder records the window as one createRects step, which plays back', async ({ page }) => {
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await openWindow(page);
  for(const n of ['A', 'B']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
  await win(page).locator('button.add-many-add').click();
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['createRects']);
  expect(macro.steps[0].args.items.map(i => i.name)).toEqual(['A', 'B']);
  await page.evaluate(() => fm.clearAll());
  await page.evaluate((name) => fm.runMacro(name), macro.name);
  expect((await rects(page)).map(nameOf)).toEqual(['A', 'B']);
});

test('Mod+Enter in a rectangle\'s editor saves it and starts the next one below, with the same gap', async ({ page, pageErrors }) => {
  await page.evaluate(() => { fm.createRect({ x: 200, y: 100, name: 'Top' }); fm.createRect({ x: 200, y: 200, name: 'Second' }); });
  const second = page.locator('.node', { hasText: 'Second' });
  await second.dblclick();
  await page.keyboard.press('ControlOrMeta+Enter');
  // A new rectangle, already editing: type its name and chain again.
  await expect(page.locator('.node textarea')).toBeFocused();
  await page.keyboard.type('Third');
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.keyboard.type('Fourth');
  await page.keyboard.press('Enter');
  const r = await rects(page);
  expect(r.map(x => [nameOf(x), x.x, x.y])).toEqual([['Top', 200, 100], ['Second', 200, 200], ['Third', 200, 300], ['Fourth', 200, 400]]);
  // Each one is its own step: undo takes Fourth away first.
  await page.evaluate(() => fm.command('undo'));
  await page.evaluate(() => fm.command('undo'));
  expect((await rects(page)).map(nameOf)).toEqual(['Top', 'Second', 'Third']);
  expect(pageErrors).toEqual([]);
});

test('Mod+Enter on a rectangle with nothing above uses the usual gap', async ({ page }) => {
  await page.evaluate(() => fm.createRect({ x: 300, y: 300, name: 'Alone' }));
  await page.locator('.node', { hasText: 'Alone' }).dblclick();
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.keyboard.type('Next');
  await page.keyboard.press('Enter');
  expect((await rects(page)).map(x => [nameOf(x), x.x, x.y])).toEqual([['Alone', 300, 300], ['Next', 300, 386]]);
});

test('the ribbon: after Add Rectangle on the Home and Insert tabs; a customised ribbon gets it once', async ({ page }, testInfo) => {
  const after = (cfg) => cfg.tabs.map(t => {
    for(const g of t.groups){ const i = g.items.findIndex(it => it.cmd === 'addRect'); if(i >= 0) return t.id + ':' + (g.items[i + 1] ? g.items[i + 1].cmd : '-'); }
    return null;
  }).filter(Boolean);
  expect(after(await page.evaluate(() => __fmIDE.getRibbonConfig()))).toEqual(['home:addManyRects', 'insert:addManyRects']);
  // A ribbon customised before step 12b: the command goes in after its Add Rectangle, once.
  const load = async (ui, name) => {
    const file = testInfo.outputPath(name);
    const ws = { kind: 'fmIDE-workspace', version: 10, system: { kind: 'system', version: 9, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] }, ui };
    fs.writeFileSync(file, JSON.stringify(ws));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    return page.evaluate(() => __fmIDE.getRibbonConfig().tabs.map(t => t.groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(','))));
  };
  const older = { ribbonCustomized: true, zoomGroupAdded: true, /* (the Zoom group's own test: group 44) */ documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
    operatorsE2Added: true, operatorsE2bAdded: true, libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: true,
    ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Make', items: [{ cmd: 'addRect' }, { cmd: 'addOperator' }] }, { label: 'Other', items: [{ cmd: 'undo' }] }] }] } };
  expect(await load(older, 'older.json')).toEqual([['Make:addRect,addManyRects,addOperator', 'Other:undo']]);
  // Once it has been added, a ribbon without it (removed by the person) stays without it.
  expect(await load(Object.assign({}, older, { addManyRectsAdded: true }), 'removed.json')).toEqual([['Make:addRect,addOperator', 'Other:undo']]);
});

test.describe('by touch', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  test('a finger opens the window, types a list and adds it', async ({ page, pageErrors }) => {
    const types = await watchPointerTypes(page);
    const f = await finger(page);
    await page.evaluate(() => fm.command('addManyRects'));
    await expect(win(page)).toBeVisible();
    await f.tap(centre(await nameBox(page, 0).boundingBox()));
    await expect(nameBox(page, 0)).toBeFocused();
    // Text boxes are 16 pixels under a finger, so the browser doesn't zoom in.
    expect(await nameBox(page, 0).evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
    for(const n of ['Alpha', 'Beta']){ await page.keyboard.type(n); await page.keyboard.press('Enter'); }
    await f.tap(centre(await win(page).locator('button.add-many-add').boundingBox()));
    await expect(win(page)).toHaveCount(0);
    expect((await rects(page)).map(nameOf)).toEqual(['Alpha', 'Beta']);
    expect(await types()).toEqual(['touch']);
    expect(pageErrors).toEqual([]);
  });
});
