// 44. Zoom (step 13, phase 13a): the canvas zooms from 25% to 200% — Ctrl + the wheel around
// the pointer, Ctrl + = / − / 0, the control at the bottom-right and its menu, Zoom to Fit and
// to Selection — and everything works alike at any zoom: dragging, resizing, arrows, the
// selection box, snapping, new nodes in view, pickers readable. Each canvas keeps its own
// zoom in the person's UI settings (never from an imported file, never in a model file or a
// macro); a model that comes in starts at 100%; undo leaves the zoom alone; a tutorial starts
// at 100% and gives the zoom back. Driven with a real mouse and keyboard at 1400 × 900.
const fs = require('fs');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');
const A = require('./helpers/apps');

const node = (page, id) => page.locator(`.node[data-id="${id}"]`);
const pos = (page, id) => page.evaluate((id) => { const n = fm.nodes().find(n => n.id === id); return { x: n.x, y: n.y, w: n.w, h: n.h }; }, id);
const zoomOf = (page) => page.evaluate(() => fm.zoom());
const level = (page) => page.locator('#zoomControl .zoom-level');
async function place(page, list){
  return page.evaluate((list) => { fm.clearAll(); return list.map(r => fm.createRect(Object.assign({ name: r.name, value: '1' }, r))); }, list);
}
async function savedUi(page){
  const text = (await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1'))['fmIDE-workspace-v1'];
  return text ? (JSON.parse(text).ui || {}) : {};
}
// The middle of a node on the screen.
async function centre(page, id){ const b = await node(page, id).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await F.openFmIDE(page);
});

test('Ctrl + the wheel zooms around the pointer, smoothly; a plain wheel still scrolls', async ({ page, pageErrors }) => {
  const [a] = await place(page, [{ name: 'A', x: 1500, y: 1000 }]);
  await page.evaluate(() => document.getElementById('viewport').scrollTo(1000, 700)); // room to zoom around it
  await expect(level(page)).toHaveText('100%');
  await expect(page.locator('#viewport')).not.toHaveClass(/\bzoomed\b/); // nothing transformed at 100%
  const before = await centre(page, a);
  await page.mouse.move(before.x, before.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 200);
  await page.keyboard.up('Control');
  await expect.poll(() => zoomOf(page)).toBeLessThan(0.8);
  const z = await zoomOf(page);
  await expect(level(page)).toHaveText(Math.round(z * 100) + '%');
  // The node under the pointer stays under it, at its new size.
  const after = await centre(page, a);
  expect(Math.abs(after.x - before.x)).toBeLessThan(3);
  expect(Math.abs(after.y - before.y)).toBeLessThan(3);
  expect(Math.round((await node(page, a).boundingBox()).width)).toBe(Math.round(170 * z));
  // A plain wheel scrolls.
  const top = await page.locator('#viewport').evaluate(v => v.scrollTop);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.locator('#viewport').evaluate(v => v.scrollTop)).toBeGreaterThan(top);
  expect(await zoomOf(page)).toBe(z);
  expect(pageErrors).toEqual([]);
});

test('Ctrl + = / − / 0 step the zoom; the control\'s − and + and its menu; the limits', async ({ page }) => {
  await page.mouse.click(700, 500); // the canvas has the keyboard
  await page.keyboard.press('Control+=');
  await expect(level(page)).toHaveText('110%');
  await page.keyboard.press('Control+-');
  await page.keyboard.press('Control+-');
  await expect(level(page)).toHaveText('90%');
  await page.keyboard.press('Control+0');
  await expect(level(page)).toHaveText('100%');
  await page.locator('#zoomControl .zoom-in').click();
  await expect(level(page)).toHaveText('110%');
  await page.locator('#zoomControl .zoom-out').click();
  await page.locator('#zoomControl .zoom-out').click();
  await expect(level(page)).toHaveText('90%');
  // The menu: every level, Fit the model, Fit the selection (off with nothing selected).
  await level(page).click();
  const menu = page.locator('#zoomMenu');
  await expect(menu.locator('button')).toHaveText(['Fit the model', 'Fit the selection', '200%', '175%', '150%', '125%', '110%', '100%', '90%', '75%', '67%', '50%', '33%', '25%']);
  await expect(menu.locator('button.current')).toHaveText('90%');
  await expect(menu.locator('button', { hasText: 'Fit the selection' })).toBeDisabled();
  await menu.getByRole('button', { name: '25%', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(level(page)).toHaveText('25%');
  await expect(page.locator('#zoomControl .zoom-out')).toBeDisabled();
  await page.evaluate(() => fm.setZoom(2));
  await expect(level(page)).toHaveText('200%');
  await expect(page.locator('#zoomControl .zoom-in')).toBeDisabled();
  expect(await page.evaluate(() => fm.setZoom(9))).toBe(2);
  expect(await page.evaluate(() => fm.setZoom(0.01))).toBe(0.25);
  expect(await page.evaluate(() => { try{ fm.setZoom('big'); return 'no error'; } catch(e){ return e.message; } })).toContain('setZoom takes a zoom level');
});

test('Zoom to Fit shows every node; Zoom to Selection the selected ones', async ({ page }) => {
  const ids = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 2600, y: 1700 }, { name: 'C', x: 1300, y: 900 }]);
  await page.evaluate(() => fm.command('zoomFit'));
  const z = await zoomOf(page);
  expect(z).toBeLessThan(0.5);
  const vp = await page.locator('#viewport').boundingBox();
  for(const id of ids){
    const b = await node(page, id).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(vp.x); expect(b.y).toBeGreaterThanOrEqual(vp.y);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.x + vp.width); expect(b.y + b.height).toBeLessThanOrEqual(vp.y + vp.height);
  }
  await page.evaluate((id) => fm.select(['#' + id]), ids[2]);
  await page.evaluate(() => fm.command('zoomSelection'));
  expect(await zoomOf(page)).toBe(2); // one box: as large as allowed
  const b = await node(page, ids[2]).boundingBox();
  expect(Math.abs(b.x + b.width / 2 - (vp.x + vp.width / 2))).toBeLessThan(20);
});

test('at 50%: a drag moves a node by what the pointer moved, resizing and the selection box follow the pointer', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 200, y: 200 }, { name: 'B', x: 700, y: 200 }, { name: 'C', x: 200, y: 700 }]);
  await page.evaluate(() => { fm.setZoom(0.5); document.getElementById('viewport').scrollTo(0, 0); });
  // Drag A 100 screen pixels right and 50 down: 200 and 100 in canvas units.
  const s = await centre(page, a);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 50, s.y + 25, { steps: 4 }); await page.mouse.move(s.x + 100, s.y + 50, { steps: 4 });
  await page.mouse.up();
  expect(await pos(page, a)).toMatchObject({ x: 400, y: 300 });
  const after = await centre(page, a);
  expect(Math.abs(after.x - (s.x + 100))).toBeLessThan(2);
  // The resize corner: 40 screen pixels wider is 80 canvas units.
  await node(page, b).click();
  const r = await page.locator(`.node[data-id="${b}"] .resize-handle`).boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 40, r.y + r.height / 2, { steps: 4 }); await page.mouse.up();
  expect((await pos(page, b)).w).toBe(250);
  // A selection box drawn around C (screen) selects exactly C.
  const cb = await node(page, c).boundingBox();
  await page.mouse.move(cb.x - 10, cb.y - 10); await page.mouse.down();
  await page.mouse.move(cb.x + cb.width + 10, cb.y + cb.height + 10, { steps: 5 }); await page.mouse.up();
  expect(await page.evaluate(() => fm.selection())).toEqual([c]);
});

test('at 50%: an arrow drawn with the right button joins the right nodes; snapping still snaps', async ({ page }) => {
  const [a, b, c] = await place(page, [{ name: 'A', x: 100, y: 100 }, { name: 'B', x: 300, y: 100 }, { name: 'C', x: 600, y: 400 }]);
  await page.evaluate(() => { fm.setZoom(0.5); document.getElementById('viewport').scrollTo(0, 0); });
  const pa = await centre(page, a), pb = await centre(page, b);
  await page.mouse.move(pa.x, pa.y); await page.mouse.down({ button: 'right' });
  await page.mouse.move(pb.x, pb.y, { steps: 6 }); await page.mouse.up({ button: 'right' });
  expect(await page.evaluate(() => fm.edges().map(e => [e.from, e.to]))).toEqual([[a, b]]);
  // C dropped near x 503 (canvas): snaps to 500, as at 100%.
  const p = await pos(page, c), sc = await centre(page, c);
  await page.mouse.move(sc.x, sc.y); await page.mouse.down();
  await page.mouse.move(sc.x + (503 - p.x) * 0.25, sc.y + (101 - p.y) * 0.25, { steps: 4 });
  await page.mouse.move(sc.x + (503 - p.x) * 0.5, sc.y + (101 - p.y) * 0.5, { steps: 4 });
  await page.mouse.up();
  expect(await pos(page, c)).toMatchObject({ x: 500, y: 100 });
});

test('new nodes land in view at any zoom; pickers on the canvas stay readable', async ({ page }) => {
  await page.evaluate(() => { fm.clearAll(); fm.setZoom(0.5); document.getElementById('viewport').scrollTo(400, 300); });
  await page.evaluate(() => fm.command('addRect'));
  const id = await page.evaluate(() => fm.nodes().slice(-1)[0].id);
  const vp = await page.locator('#viewport').boundingBox();
  const b = await node(page, id).boundingBox();
  expect(b.x).toBeGreaterThan(vp.x); expect(b.x + b.width).toBeLessThan(vp.x + vp.width);
  expect(b.y).toBeGreaterThan(vp.y); expect(b.y + b.height).toBeLessThan(vp.y + vp.height);
  // The operator picker at 50% is as large as at 100%.
  const opId = await page.evaluate(() => fm.createOperator({ op: '+' }));
  await node(page, opId).dblclick();
  const w50 = (await page.locator('#canvas > .op-picker').boundingBox()).width;
  await page.keyboard.press('Escape');
  await page.evaluate(() => fm.setZoom(1));
  await node(page, opId).dblclick();
  const w100 = (await page.locator('#canvas > .op-picker').boundingBox()).width;
  expect(Math.abs(w50 - w100)).toBeLessThan(2);
});

test('each canvas keeps its own zoom, kept after a reload; undo leaves it; a model that comes in starts at 100%', async ({ page }) => {
  const first = await page.evaluate(() => fm.canvases()[0].id);
  await page.evaluate(() => fm.setZoom(0.5));
  await page.evaluate(() => fm.command('newCanvas'));
  await expect(level(page)).toHaveText('100%');
  await page.evaluate(() => fm.setZoom(1.5));
  await page.locator('.canvas-tab').first().click();
  await expect(level(page)).toHaveText('50%');
  // Undo (of adding the canvas) doesn't change the zoom shown.
  await page.evaluate(() => fm.createRect({ name: 'X' }));
  await page.evaluate(() => fm.command('undo'));
  await expect(level(page)).toHaveText('50%');
  await expect.poll(() => savedUi(page).then(ui => ui.canvasZoom && ui.canvasZoom[first]), { timeout: 5000 }).toBe(0.5);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await expect(level(page)).toHaveText('50%'); // the first canvas, shown after a reload
  // A new document: 100%.
  await page.evaluate(() => fm.command('newDocument'));
  const dontSave = page.locator('.modal-box button', { hasText: /Don.t save/ });
  if(await dontSave.count()) await dontSave.click();
  await expect(level(page)).toHaveText('100%');
});

test('never in a model file, never from someone else\'s workspace, never recorded in a macro', async ({ page }, testInfo) => {
  await page.evaluate(() => fm.setZoom(0.75));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  expect(JSON.stringify(data.system)).not.toMatch(/zoom/i);
  data.ui = Object.assign({}, data.ui, { canvasZoom: { [data.system.canvases[0].id]: 0.33 } });
  const file = testInfo.outputPath('ws-zoom.json');
  fs.writeFileSync(file, JSON.stringify(data));
  await F.importViaCommand(page, 'importWorkspace', file);
  await F.acceptAll(page);
  await expect(level(page)).toHaveText('100%');
  // Macros: zooming while recording records nothing (only the rectangle added).
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.evaluate(() => { fm.setZoom(0.5); fm.command('zoomIn'); fm.createRect({ name: 'R', x: 50, y: 50 }); fm.command('zoomFit'); });
  await page.locator('#zoomControl .zoom-out').click();
  await page.evaluate(() => fm.command('toggleRecord'));
  const exported = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = exported.data.macros[exported.data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['createRect']);
});

test('a tutorial starts at 100% and gives your zoom back', async ({ page }) => {
  await page.evaluate(() => fm.setZoom(0.67));
  await page.keyboard.press('F1');
  await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
  await expect(page.locator('#tutorialCard')).toBeVisible();
  await expect(level(page)).toHaveText('100%');
  await page.evaluate(() => fm.setZoom(1.5));
  await page.locator('#tutorialCard button', { hasText: /exit/i }).first().click();
  await F.acceptAll(page);
  await expect(page.locator('#tutorialCard')).toHaveCount(0);
  await expect(level(page)).toHaveText('67%');
});

test('the View tab\'s Zoom group; a customised ribbon gets it once', async ({ page }, testInfo) => {
  const view = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'view').groups.find(g => g.id === 'zoom').items.map(i => i.cmd));
  expect(view).toEqual(['zoomFit', 'zoomIn', 'zoomOut', 'zoomReset', 'zoomSelection']);
  const ws = (flag) => JSON.stringify({ kind: 'fmIDE-workspace', version: 6, system: A.readFixture('formats', 'sys-current.json'),
    ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true, operatorsE2Added: true, operatorsE2bAdded: true,
      libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: true, whatsNewAdded: true, addManyRectsAdded: true, zoomGroupAdded: flag,
      ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Stuff', items: [{ cmd: 'openShortcuts' }] }] }] } } });
  const groups = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
  const write = (name, text) => { const f = testInfo.outputPath(name); fs.writeFileSync(f, text); return f; };
  await F.importViaCommand(page, 'importWorkspace', write('old.json', ws(undefined)));
  await F.acceptAll(page);
  expect(await groups()).toEqual(['Stuff:openShortcuts', 'Zoom:zoomFit,zoomIn,zoomOut,zoomReset,zoomSelection']);
  await F.importViaCommand(page, 'importWorkspace', write('removed.json', ws(true)));
  await F.acceptAll(page);
  expect(await groups()).toEqual(['Stuff:openShortcuts']);
});
