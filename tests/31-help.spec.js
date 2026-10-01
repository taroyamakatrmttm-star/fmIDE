// Test group 31 — the Help panel (build step 10, phase H1; docs/step10-help.md).
// - F1, ❓ beside the ribbon's search box, View → Help and fm.command('openHelp') open and close
//   it; Esc closes it from inside; shortcuts keep working while it is open.
// - The help text (src/help/fmide-help.js, read here in Node): every command has a plain
//   sentence, every command and topic a topic names exists, topic ids are unique.
// - Search finds topics and commands; a command's ▶ runs it and is off when it can't run.
// - Help topics in the Command Launcher; tooltips carry the sentence; a customised ribbon gets
//   the Help group once; the panel at tablet size; no network request.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('./helpers/apps');
const A = require('./helpers/apps');
const F = require('./helpers/fmide');

// The help text and the operator catalogue, on their own (no app).
function loadHelp(){
  const src = path.join(__dirname, '..', 'src');
  const code = [path.join(src, 'shared', 'operators.js'), path.join(src, 'help', 'fmide-help.js')]
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
  return vm.runInContext(code + '\n;({ HELP_GROUPS, HELP_TOPICS, COMMAND_HELP, OPERATOR_HELP, OPERATORS })', vm.createContext({}));
}
const H = loadHelp();
const panel = (page) => page.locator('#helpPanel');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await F.openFmIDE(page);
});

test.describe('opening and closing', () => {
  test('F1, ❓, View → Help and fm.command open and close it; Esc closes it from inside', async ({ page }) => {
    await page.mouse.click(600, 600);                           // the canvas has the keyboard
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('#helpPanel .help-search')).toBeFocused();
    await page.keyboard.press('F1');                            // F1 again, from the search box
    await expect(panel(page)).toBeHidden();

    await page.click('#rbHelp');
    await expect(panel(page)).toBeVisible();
    await page.click('#rbHelp');
    await expect(panel(page)).toBeHidden();

    await page.locator('.rb-tab', { hasText: 'View' }).click();
    await page.locator('.rb-btn', { hasText: 'Help' }).click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();

    await page.evaluate(() => fm.command('openHelp'));
    await expect(panel(page)).toBeVisible();
    await page.click('#helpPanel .help-close');
    await expect(panel(page)).toBeHidden();
    expect(await page.evaluate(() => fm.commands().find(c => c.id === 'openHelp').shortcut)).toBe('F1');
  });

  test('beside the canvas, not over it: shortcuts and the canvas keep working', async ({ page }) => {
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    const vp = await page.locator('#viewport').boundingBox();
    const hp = await panel(page).boundingBox();
    expect(vp.x + vp.width).toBeLessThanOrEqual(hp.x + 1);    // the canvas narrows beside it
    const before = await page.evaluate(() => fm.nodes().length);
    await page.evaluate(() => fm.createRect({ name: 'Added with Help open' }));
    expect(await page.evaluate(() => fm.nodes().length)).toBe(before + 1);
    await page.mouse.click(300, 700);                           // the canvas, not the search box
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => fm.nodes().length)).toBe(before);
    await expect(panel(page)).toBeVisible();
  });
});

test.describe('the help text', () => {
  test('every command has a plain sentence, and no sentence names a missing command', async ({ page }) => {
    const ids = await page.evaluate(() => fm.commands().map(c => c.id).filter(id => !id.startsWith('macro:')));
    const opCommands = ids.filter(id => /^insertOp\d+$/.test(id));
    expect(opCommands.length).toBe(H.OPERATORS.length);
    const missing = ids.filter(id => {
      const m = /^insertOp(\d+)$/.exec(id);
      if(m) return !(H.OPERATORS[+m[1]] && H.OPERATOR_HELP[H.OPERATORS[+m[1]].id]);
      return !(typeof H.COMMAND_HELP[id] === 'string' && H.COMMAND_HELP[id].trim());
    });
    expect(missing).toEqual([]);
    expect(Object.keys(H.COMMAND_HELP).filter(id => !ids.includes(id))).toEqual([]);
    expect(Object.keys(H.OPERATOR_HELP).filter(id => !H.OPERATORS.some(op => op.id === id))).toEqual([]);
  });

  test('topics: unique ids, known groups, and every command and topic they name exists', async ({ page }) => {
    const ids = await page.evaluate(() => fm.commands().map(c => c.id));
    const topicIds = H.HELP_TOPICS.map(t => t.id);
    expect(new Set(topicIds).size).toBe(topicIds.length);
    const groups = H.HELP_GROUPS.map(g => g.id);
    const problems = [];
    H.HELP_TOPICS.forEach(t => {
      if(!groups.includes(t.group)) problems.push(t.id + ': group ' + t.group);
      if(!t.title || !t.summary || !Array.isArray(t.body) || !t.body.length) problems.push(t.id + ': empty');
      t.body.forEach(b => {
        [b.p, b.tip].concat(b.steps || []).filter(s => typeof s === 'string').forEach(s => {
          (s.match(/\{cmd:[^}]*\}/g) || []).forEach(m => { if(!ids.includes(m.slice(5, -1))) problems.push(t.id + ': ' + m); });
        });
        (b.see || []).forEach(id => { if(!topicIds.includes(id)) problems.push(t.id + ': see ' + id); });
      });
    });
    expect(problems).toEqual([]);
    // Every group has a topic, and the panel lists every topic under its group.
    expect(groups.filter(g => !H.HELP_TOPICS.some(t => t.group === g))).toEqual([]);
    await page.keyboard.press('F1');
    // (H3 put the Tutorials group, and a link to the welcome card, above the topics: group 33;
    // H5b What's new above them: group 43.)
    await expect(page.locator('#helpPanel .help-topic-link[data-topic]')).toHaveCount(H.HELP_TOPICS.length);
    await expect(page.locator('#helpPanel .help-group:not(.help-news-heading)')).toHaveText(['Tutorials'].concat(H.HELP_GROUPS.map(g => g.title)), { ignoreCase: true });
  });

  test('a topic shows its steps as text, and a command in it runs', async ({ page }) => {
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-topic-link[data-topic="first-model"]').click();
    const topic = page.locator('#helpPanel .help-topic[data-topic="first-model"]');
    await expect(topic.locator('.help-topic-title')).toHaveText('Your first model in five minutes');
    await expect(topic.locator('.help-steps li')).toHaveCount(H.HELP_TOPICS.find(t => t.id === 'first-model').body.find(b => b.steps).steps.length);
    await expect(topic).not.toContainText('{cmd:');
    const before = await page.evaluate(() => fm.nodes().length);
    await topic.locator('.help-cmd[data-cmd="addRect"]').click();
    expect(await page.evaluate(() => fm.nodes().length)).toBe(before + 1);
    await page.keyboard.press('Escape');                        // leave the new rectangle's text
    // See also, then Back.
    await topic.locator('.help-topic-link[data-topic="operators"]').click();
    await expect(page.locator('#helpPanel .help-topic-title')).toHaveText('Operators');
    await page.locator('#helpPanel .help-back').click();
    await expect(page.locator('#helpPanel .help-topic-title')).toHaveText('Your first model in five minutes');
    await page.locator('#helpPanel .help-back').click();
    await expect(page.locator('#helpPanel .help-intro')).toBeVisible();
  });
});

test.describe('search', () => {
  test('finds topics and commands; ▶ runs a command and is off when it cannot run', async ({ page }) => {
    await page.keyboard.press('F1');
    const search = page.locator('#helpPanel .help-search');
    await search.fill('period shift');
    await expect(page.locator('#helpPanel .help-topic-link').first()).toHaveAttribute('data-topic', 'period-shifts');
    await search.fill('template');
    await expect(page.locator('#helpPanel .help-topic-link[data-topic="templates"]')).toBeVisible();
    await expect(page.locator('#helpPanel .help-command[data-cmd="openTemplates"]')).toBeVisible();
    await expect(page.locator('#helpPanel .help-command[data-cmd="openTemplates"] .help-command-sentence')).toHaveText(H.COMMAND_HELP.openTemplates);

    await search.fill('align left');
    const run = page.locator('#helpPanel .help-command[data-cmd="alignLeft"] .help-run');
    await page.evaluate(() => fm.clearSelection());
    await expect(run).toBeDisabled();                           // needs two selected boxes
    await page.evaluate(() => fm.select('@all'));
    await expect(run).toBeEnabled();

    await search.fill('new canvas');
    const count = await page.evaluate(() => fm.canvases().length);
    await page.locator('#helpPanel .help-command[data-cmd="newCanvas"] .help-run').click();
    expect(await page.evaluate(() => fm.canvases().length)).toBe(count + 1);

    await search.fill('xyzzy nothing');
    await expect(page.locator('#helpPanel .help-empty')).toContainText('Nothing matches');
    await search.fill('');
    await expect(page.locator('#helpPanel .help-intro')).toBeVisible();
  });

  test('the Command Launcher finds help topics and opens them', async ({ page }) => {
    await page.mouse.click(600, 600);
    await page.keyboard.press('Control+k');
    const input = page.locator('.launcher input.lq');
    await expect(input).toHaveAttribute('placeholder', 'Type a command, action, macro or help topic…');
    await input.fill('period shift');
    const row = page.locator('.launcher .lrow', { hasText: 'Period shifts: last period and next period' });
    await expect(row.locator('.lcat')).toHaveText('Help');
    await row.click();
    await expect(page.locator('.launcher-overlay')).toHaveCount(0);
    await expect(page.locator('#helpPanel .help-topic-title')).toHaveText('Period shifts: last period and next period');
  });
});

test.describe('tooltips and the ribbon', () => {
  // H2 replaced the browser's own tooltip with a tip of fmIDE's own (group 32 covers the tip);
  // the sentence stays on the button for screen readers.
  test('a ribbon button carries its sentence', async ({ page }) => {
    await page.locator('.rb-tab', { hasText: 'Home' }).click();
    const b = page.locator('.rb-btn', { hasText: 'Add Rectangle' });
    await expect(b).toHaveAttribute('aria-description', H.COMMAND_HELP.addRect);
    await expect(b).toHaveAttribute('aria-label', 'Add Rectangle');
    await expect(b).not.toHaveAttribute('title', /./);
    // An Insert Operator button: its operator's sentence.
    await page.locator('.rb-tab', { hasText: 'Insert' }).click();
    const expected = 'Adds the if operator, which ' + H.OPERATOR_HELP.if;
    const texts = await page.locator('.rb-btn').evaluateAll(bs => bs.map(b => b.getAttribute('aria-description')));
    expect(texts.filter(t => t === expected)).toHaveLength(1);
  });

  test('a customised ribbon gets the Help group once; removed, it stays removed', async ({ page }, testInfo) => {
    const ws = (flag) => JSON.stringify({ kind: 'fmIDE-workspace', version: 6, system: A.readFixture('formats', 'sys-current.json'),
      ui: { ribbonCustomized: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
        libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: flag,
        ribbon: { qat: [], tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Stuff', items: [{ cmd: 'openShortcuts' }] }] }] } } });
    const groups = () => page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(',')));
    const write = (name, text) => { const f = testInfo.outputPath(name); fs.writeFileSync(f, text); return f; };
    await F.importViaCommand(page, 'importWorkspace', write('old.json', ws(undefined)));
    await F.acceptAll(page);
    expect(await groups()).toEqual(['Stuff:openShortcuts', 'Help:openHelp,openWhatsNew']); // H5b: What's New beside Help
    await F.importViaCommand(page, 'importWorkspace', write('removed.json', ws(true)));
    await F.acceptAll(page);
    expect(await groups()).toEqual(['Stuff:openShortcuts']);
    await expect(page.locator('#rbHelp')).toBeVisible();        // ❓ is always there
  });
});

test.describe('screen and network', () => {
  test('at tablet size the panel fits the screen and the canvas stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.keyboard.press('F1');
    const hp = await panel(page).boundingBox();
    expect(hp.x + hp.width).toBeLessThanOrEqual(1024 + 1);
    expect(hp.y + hp.height).toBeLessThanOrEqual(768 + 1);
    const vp = await page.locator('#viewport').boundingBox();
    expect(vp.width).toBeGreaterThan(500);
    await page.setViewportSize({ width: 600, height: 800 });    // a narrow window: it covers the canvas
    const narrow = await panel(page).boundingBox();
    expect(Math.round(narrow.width)).toBe(600);
  });

  test('the single file makes no request while Help is used', async ({ page }) => {
    const seen = [];
    page.on('request', r => seen.push(r.url()));
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-search').fill('excel');
    await page.locator('#helpPanel .help-topic-link').first().click();
    await page.locator('#helpPanel .help-back').click();
    await page.keyboard.press('Escape');
    expect(seen.filter(u => !u.startsWith('data:'))).toEqual([]);
  });
});
