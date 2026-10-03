// 61. Moving between canvases from the keyboard (fmIDE): Next Canvas (Alt+PageDown) and
// Previous Canvas (Alt+PageUp) go to the tab beside the current one, round from the last to
// the first; they are commands (the launcher, the ribbon's Canvas group, Keyboard Shortcuts)
// and a macro records them as Go to Canvas.
const fs = require('fs');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

const active = (page) => page.evaluate(() => fm.canvases().find(c => c.active).name);

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
});

test('Alt+PageDown and Alt+PageUp move to the next and previous canvas, round the ends', async ({ page }) => {
  await page.evaluate(() => { fm.renameCanvas(fm.canvases()[0].id, 'One'); fm.addCanvas('Two'); fm.addCanvas('Three'); fm.switchCanvas(fm.canvases()[0].id); });
  expect(await active(page)).toBe('One');
  await page.locator('#viewport').click({ position: { x: 600, y: 400 } });
  await page.keyboard.press('Alt+PageDown');
  expect(await active(page)).toBe('Two');
  await page.keyboard.press('Alt+PageDown');
  expect(await active(page)).toBe('Three');
  await page.keyboard.press('Alt+PageDown');
  expect(await active(page)).toBe('One');
  await page.keyboard.press('Alt+PageUp');
  expect(await active(page)).toBe('Three');
  await page.keyboard.press('Alt+PageUp');
  expect(await active(page)).toBe('Two');
  await expect(page.locator('#canvasTabs .canvas-tab.active')).toContainText('Two');
  // The KeyTips (Alt alone) do not open on the way.
  await expect(page.locator('.keytip:visible')).toHaveCount(0);
});

test('with one canvas the commands are off and do nothing; typing in a box does not switch', async ({ page }) => {
  const cmds = await page.evaluate(() => fm.commands().filter(c => c.id === 'prevCanvas' || c.id === 'nextCanvas'));
  expect(cmds).toEqual([
    { id: 'prevCanvas', label: 'Previous Canvas', category: 'Canvas', shortcut: 'Alt+PageUp' },
    { id: 'nextCanvas', label: 'Next Canvas', category: 'Canvas', shortcut: 'Alt+PageDown' },
  ]);
  await page.locator('#viewport').click({ position: { x: 600, y: 400 } });
  await page.keyboard.press('Alt+PageDown');
  expect(await page.evaluate(() => fm.canvases().length)).toBe(1);
  await page.evaluate(() => fm.addCanvas('Two'));
  // Renaming a tab: the keys belong to the text box.
  await page.locator('#canvasTabs .canvas-tab.active').dblclick();
  const input = page.locator('#canvasTabs input');
  await expect(input).toBeVisible();
  await input.press('Alt+PageUp');
  expect(await active(page)).toBe('Two');
  await input.press('Escape');
});

test('the ribbon\'s Canvas group has them; a customised ribbon gets them once, after Move Canvas Right', async ({ page }, testInfo) => {
  const canvasGroup = (cfg) => cfg.tabs.flatMap(t => t.groups).find(g => g.label === 'Canvas').items.map(i => i.cmd);
  const items = canvasGroup(await page.evaluate(() => __fmIDE.getRibbonConfig()));
  expect(items.slice(items.indexOf('moveCanvasRight'), items.indexOf('moveCanvasRight') + 3)).toEqual(['moveCanvasRight', 'prevCanvas', 'nextCanvas']);
  // The ribbon's button works.
  await page.evaluate(() => fm.addCanvas('Two'));
  await page.evaluate(() => fm.switchCanvas(fm.canvases()[0].id));
  await page.evaluate(() => fm.command('nextCanvas'));
  expect(await active(page)).toBe('Two');
  const load = async (ui, name) => {
    const file = testInfo.outputPath(name);
    const ws = { kind: 'fmIDE-workspace', version: 10, system: { kind: 'system', version: 9, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] }, ui };
    fs.writeFileSync(file, JSON.stringify(ws));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    return page.evaluate(() => __fmIDE.getRibbonConfig().tabs.map(t => t.groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(','))));
  };
  const older = { ribbonCustomized: true, zoomGroupAdded: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
    operatorsE2Added: true, operatorsE2bAdded: true, libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: true, whatsNewAdded: true, addManyRectsAdded: true, fmGraphAdded: true,
    ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Tabs', items: [{ cmd: 'newCanvas' }, { cmd: 'moveCanvasRight' }, { cmd: 'undo' }] }] }] } };
  expect(await load(older, 'older.json')).toEqual([['Tabs:newCanvas,moveCanvasRight,prevCanvas,nextCanvas,undo']]);
  // Once added, a ribbon without them (removed by the person) stays without them.
  expect(await load(Object.assign({}, older, { canvasSwitchAdded: true }), 'removed.json')).toEqual([['Tabs:newCanvas,moveCanvasRight,undo']]);
});

test('the macro recorder records Go to Canvas, which plays back; the shortcut can be changed', async ({ page }) => {
  await page.evaluate(() => { fm.renameCanvas(fm.canvases()[0].id, 'One'); fm.addCanvas('Two'); fm.switchCanvas(fm.canvases()[0].id); });
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.locator('#viewport').click({ position: { x: 600, y: 400 } });
  await page.keyboard.press('Alt+PageDown');
  await page.evaluate(() => fm.command('toggleRecord'));
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  const macro = data.macros[data.macros.length - 1];
  expect(macro.steps.map(s => s.action)).toEqual(['switchCanvas']);
  await page.evaluate(() => fm.switchCanvas(fm.canvases()[0].id));
  await page.evaluate((name) => fm.runMacro(name), macro.name);
  expect(await active(page)).toBe('Two');
});

test('the Command Launcher finds Next Canvas', async ({ page }) => {
  await page.evaluate(() => fm.addCanvas('Two'));
  await page.evaluate(() => fm.switchCanvas(fm.canvases()[0].id));
  await page.evaluate(() => fm.command('openLauncher'));
  await page.keyboard.type('next canvas');
  await page.keyboard.press('Enter');
  expect(await active(page)).toBe('Two');
});
