// Test group 32 — help where you are (build step 10, phase H2; docs/step10-help.md).
// - fmIDE: a ribbon button's tip (name, shortcut, sentence, "Learn more"; F1 while it shows
//   opens its topic; disabled buttons too); the "?" in the corner of the windows, above the
//   dimmed backdrop; Help in a node's touch menu.
// - ExcelExporter: ❓ Help and F1, the "?" beside each panel's heading, its topics and their
//   links, the page narrowing beside the panel, no network request.
// - The windows' and panels' topics exist (read from the source in Node).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');
const { finger, watchPointerTypes, centre } = require('./helpers/touch');

const SRC = path.join(__dirname, '..', 'src');
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const FM = vm.runInContext(read('shared', 'operators.js') + read('help', 'fmide-help.js') + '\n;({ HELP_TOPICS })', vm.createContext({}));
// ExcelExporter's topics: its help text, data of its own (src/excel-exporter/help/, since H4a).
const EE = vm.runInContext(read('excel-exporter', 'help', 'excel-help.js')
  + '\n;({ groups: EXCEL_HELP_GROUPS, topics: EXCEL_HELP_TOPICS })', vm.createContext({}));
const tip = (page) => page.locator('#commandTip');
const panel = (page) => page.locator('#helpPanel');

test.describe('fmIDE: a ribbon button\'s tip', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1400, height: 900 }); await F.openFmIDE(page); });

  test('a pause over a button shows its name, shortcut, sentence and Learn more; moving away hides it', async ({ page }) => {
    await page.locator('.rb-tab', { hasText: 'Home' }).click();
    await page.locator('.rb-btn', { hasText: 'Add Period Shift' }).hover();
    await expect(tip(page)).toBeVisible();
    await expect(tip(page).locator('.cmd-tip-name')).toHaveText('Add Period Shift');
    await expect(tip(page).locator('.cmd-tip-text')).toContainText('passes on a value from another period');
    await expect(tip(page).locator('.cmd-tip-more')).toHaveText('Learn more (F1)');
    await page.mouse.move(700, 600);
    await expect(tip(page)).toHaveCount(0);
    // A shortcut shows in the tip (Evaluate: F9).
    await page.locator('.rb-btn', { hasText: 'Evaluate' }).first().hover();
    await expect(tip(page).locator('.cmd-tip-kbd')).toHaveText('F9');
  });

  test('Learn more, or F1 while the tip shows, opens that command\'s topic', async ({ page }) => {
    await page.locator('.rb-tab', { hasText: 'Home' }).click();
    await page.locator('.rb-btn', { hasText: 'Add Period Shift' }).hover();
    await expect(tip(page)).toBeVisible();
    await page.keyboard.press('F1');
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Period shifts: last period and next period');
    await expect(tip(page)).toHaveCount(0);
    await page.locator('.rb-tab', { hasText: 'File' }).click();
    await page.locator('.rb-btn', { hasText: 'Templates' }).first().hover();
    await tip(page).locator('.cmd-tip-more').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Templates');
    // F1 with no tip showing closes the panel, as before.
    await page.mouse.move(700, 600);
    await expect(tip(page)).toHaveCount(0);
    await page.mouse.click(300, 700);
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeHidden();
  });

  test('a disabled button has its tip too, saying it isn\'t available now; an operator\'s goes to its topic', async ({ page }) => {
    await page.evaluate(() => fm.clearSelection());
    await page.locator('.rb-tab', { hasText: 'Home' }).click();
    const b = page.locator('.rb-btn', { hasText: 'Align Left' });
    await expect(b).toBeDisabled();
    await b.hover();
    await expect(tip(page).locator('.cmd-tip-off')).toHaveText('Not available right now.');
    await page.locator('.rb-tab', { hasText: 'Insert' }).click();
    const roundBtn = page.locator('.rb-btn[data-tip-cmd]').filter({ has: page.locator('.lb', { hasText: /^round$/ }) });
    await roundBtn.hover();
    await tip(page).locator('.cmd-tip-more').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Timing, conditions and rounding');
  });
});

test.describe('fmIDE: a "?" on each window', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1400, height: 900 }); await F.openFmIDE(page); });

  const WINDOWS = [
    ['openTemplates', 'Templates'], ['openFunctions', 'Your own functions'], ['openFormats', 'Formats and format roles'],
    ['managePeriods', 'Periods and the timeline'], ['openMacros', 'Macros'], ['customizeRibbon', 'Customising the ribbon'],
    ['openShortcuts', 'Command Launcher and keyboard shortcuts'], ['openRecent', 'Saving and opening documents'],
    ['addAlias', 'Aliases'],
  ];
  for(const [command, title] of WINDOWS){
    test(`${command}: its "?" opens "${title}" beside the window, which stays open`, async ({ page }) => {
      await page.evaluate((c) => fm.command(c), command);
      const box = F.topDialog(page);
      await expect(box.locator('.window-help')).toBeVisible();
      await box.locator('.window-help').click();
      await expect(panel(page).locator('.help-topic-title')).toHaveText(title);
      await expect(box).toBeVisible();
      // The panel is above the dimmed backdrop: a point inside it belongs to it.
      const hp = await panel(page).boundingBox();
      const onPanel = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('#helpPanel'), [hp.x + hp.width / 2, hp.y + hp.height - 20]);
      expect(onPanel).toBe(true);
    });
  }

  test('every window\'s "?" names a topic that exists', async () => {
    const js = fs.readdirSync(path.join(SRC, 'fmide', 'js')).map(f => read('fmide', 'js', f)).join('\n');
    const used = Array.from(js.matchAll(/addWindowHelp\((?:ui\.)?box, '([^']+)'\)/g)).map(m => m[1]);
    expect(used.length).toBeGreaterThanOrEqual(20);
    const ids = FM.HELP_TOPICS.map(t => t.id);
    expect(used.filter(id => !ids.includes(id))).toEqual([]);
  });
});

test.describe('fmIDE: Help in a node\'s touch menu', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  test('holding an operator, then Help, opens the Operators topic', async ({ page }) => {
    await F.openFmIDE(page);
    const op = await page.evaluate(() => { fm.clearCanvas(); return fm.createOperator({ x: 200, y: 160, op: '×' }); });
    const types = await watchPointerTypes(page);
    const f = await finger(page);
    await f.hold(centre(await page.locator(`.node[data-id="${op}"] .opsym`).boundingBox()));
    await expect(page.locator('.touch-menu')).toBeVisible();
    await f.tap(centre(await page.locator('.touch-menu button', { hasText: 'Help' }).boundingBox()));
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Operators');
    expect(await types()).toEqual(['touch']);
  });
});

test.describe('ExcelExporter', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1400, height: 900 }); await openApp(page, 'ExcelExporter'); });

  test('❓ Help and F1 open and close it; the page narrows beside it', async ({ page }) => {
    const before = (await page.locator('main').boundingBox()).width;
    await page.click('#btnHelp');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.help-topic-link[data-topic]')).toHaveCount(EE.topics.length); // (What's new above them: group 43)
    const hp = await panel(page).boundingBox();
    const main = await page.locator('main').boundingBox();
    expect(main.x + main.width).toBeLessThanOrEqual(hp.x + 1);
    expect(main.width).toBeLessThanOrEqual(before);
    await page.keyboard.press('F1');                            // from the search box
    await expect(panel(page)).toBeHidden();
    await page.mouse.click(10, 500);
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
  });

  test('the "?" beside each panel\'s heading opens its topic', async ({ page }) => {
    await page.click('#btnLoadSample');
    await expect(page.locator('#afterLoad')).toBeVisible();
    const cases = [['#tabsPanel', 'Tabs'], ['#inputsPanel', 'The Inputs tab'], ['#rowsPanel', 'Rows: what goes where']];
    for(const [sel, title] of cases){
      await page.locator(sel + ' h2 .panel-help').click();
      await expect(panel(page).locator('.help-topic-title')).toHaveText(title);
    }
    // Settings' two tabs, with Help beside the window.
    await page.click('#btnSettings');
    await page.locator('#periodsPanel h2 .panel-help').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Period columns and the file name');
    await page.click('#settingsTabStyle');
    await page.locator('#excelStyleBlock h2 .panel-help').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('How the workbook looks');
    const box = await page.locator('#settingsModal .modal').boundingBox(), hp = await panel(page).boundingBox();
    expect(box.x + box.width, 'Settings stays beside Help').toBeLessThanOrEqual(hp.x + 1);
    await page.click('#settingsDone');
    // The welcome screen's, after Start Over.
    await X.menuCommand(page, 'btnClearAll');
    await page.locator('#loadPanel h2 .panel-help').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('Loading a model');
    // Search, and See also.
    await panel(page).locator('.help-search').fill('scenario');
    await expect(panel(page).locator('.help-topic-link').first()).toHaveAttribute('data-topic', 'scenarios');
    await panel(page).locator('.help-topic-link').first().click();
    await panel(page).locator('.help-topic .help-topic-link[data-topic="inputs-tab"]').click();
    await expect(panel(page).locator('.help-topic-title')).toHaveText('The Inputs tab');
  });

  test('its topics: unique ids, known groups, See also links that exist', async () => {
    const ids = EE.topics.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = EE.groups.map(g => g.id);
    const problems = [];
    EE.topics.forEach(t => {
      if(!groups.includes(t.group)) problems.push(t.id + ': group');
      if(!t.title || !t.summary || !t.body.length) problems.push(t.id + ': empty');
      t.body.forEach(b => (b.see || []).forEach(id => { if(!ids.includes(id)) problems.push(t.id + ': see ' + id); }));
      if(JSON.stringify(t.body).includes('{cmd:')) problems.push(t.id + ': {cmd:} (ExcelExporter has no commands)');
    });
    expect(problems).toEqual([]);
    expect(groups.filter(g => !EE.topics.some(t => t.group === g))).toEqual([]);
  });

  test('no request while Help is used', async ({ page }) => {
    const seen = [];
    page.on('request', r => seen.push(r.url()));
    await page.click('#btnHelp');
    await panel(page).locator('.help-search').fill('tree');
    await panel(page).locator('.help-topic-link').first().click();
    await page.keyboard.press('Escape');
    expect(seen.filter(u => !u.startsWith('data:'))).toEqual([]);
  });
});
