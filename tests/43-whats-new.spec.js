// 43. What's new (step 10, phase H5b): the Help panel lists every update, newest first, each
// with its own page (what changed, why, how to use it, good to know, read more). Updates not yet
// seen are marked New and put a dot on the app's Help button; opening the list of every update
// marks them seen — fmIDE in the person's own UI settings (ui.whatsNewSeen, never from someone
// else's file), ExcelExporter in its browser storage. The data (src/help/fmide-whats-new.js,
// src/excel-exporter/help/excel-whats-new.js) is checked in Node: ids, dates newest first, and
// every command and topic it names.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');

const SRC = path.join(__dirname, '..', 'src');
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const FM = vm.runInContext(read('help', 'fmide-help.js') + '\n' + read('help', 'fmide-whats-new.js') + '\n;({ topics: HELP_TOPICS, news: WHATS_NEW })', vm.createContext({}));
const EE = vm.runInContext(read('excel-exporter', 'help', 'excel-help.js') + '\n' + read('excel-exporter', 'help', 'excel-whats-new.js') + '\n;({ topics: EXCEL_HELP_TOPICS, news: EXCEL_WHATS_NEW })', vm.createContext({}));

const panel = (page) => page.locator('#helpPanel');
const newsLinks = (page) => panel(page).locator('.help-news-link');

// The problems in one app's entries (commandIds: the commands {cmd:…} may name, or null for none).
function problemsIn(data, commandIds){
  const problems = [];
  const ids = data.news.map(e => e.id);
  if(new Set(ids).size !== ids.length) problems.push('ids are not unique');
  const topicIds = data.topics.map(t => t.id);
  data.news.forEach((e, i) => {
    const where = e.id + ': ';
    if(!/^[a-z0-9-]+$/.test(e.id || '')) problems.push(where + 'id');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || !isFinite(Date.parse(e.date))) problems.push(where + 'date');
    if(i > 0 && e.date > data.news[i - 1].date) problems.push(where + 'not newest first');
    if(!e.title || !e.summary || !e.why) problems.push(where + 'title, summary or why missing');
    if(!Array.isArray(e.what) || !e.what.length || !Array.isArray(e.how) || !e.how.length) problems.push(where + 'what or how missing');
    if(!Array.isArray(e.see) || !e.see.length) problems.push(where + 'no topic to read more');
    (e.see || []).forEach(id => { if(!topicIds.includes(id)) problems.push(where + 'see ' + id); });
    const texts = [e.title, e.summary, e.why].concat(e.what || [], e.how || [], e.notes || []);
    texts.forEach(s => {
      if(typeof s !== 'string') { problems.push(where + 'a text is not text'); return; }
      (s.match(/\{cmd:[^}]*\}/g) || []).forEach(m => {
        if(!commandIds || !commandIds.includes(m.slice(5, -1))) problems.push(where + m);
      });
    });
  });
  return problems;
}

test.describe('the data', () => {
  test('fmIDE\'s updates: unique ids, newest first, every command and topic they name exists', async ({ page }) => {
    await F.openFmIDE(page);
    const commands = await page.evaluate(() => fm.commands().map(c => c.id));
    expect(FM.news.length).toBeGreaterThan(30);
    expect(problemsIn(FM, commands)).toEqual([]);
  });
  test('ExcelExporter\'s updates: the same checks, and no {cmd:} (it has no commands)', () => {
    expect(EE.news.length).toBeGreaterThan(15);
    expect(problemsIn(EE, null)).toEqual([]);
  });
});

test.describe('the shared panel on its own', () => {
  // The panel with three made-up updates and a date seen, in an empty page.
  async function panelWith(page, seen){
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: read('shared', 'help-panel.js') });
    await page.evaluate((seen) => {
      window.seenNow = seen;
      window.p = createHelpPanel({ topics: [{ id: 't', group: 'g', title: 'T', summary: 's', body: [] }], groups: [{ id: 'g', title: 'G' }],
        whatsNew: { entries: [
          { id: 'c', date: '2026-10-02', title: 'C', summary: 'c', what: ['c'], why: 'c', how: ['c'], see: ['t'] },
          { id: 'b', date: '2026-09-29', title: 'B', summary: 'b', what: ['b'], why: 'b', how: ['b'], see: ['t'] },
          { id: 'a', date: '2026-09-01', title: 'A', summary: 'a', what: ['a'], why: 'a', how: ['a'], see: ['t'] },
        ], seen: { get: () => window.seenNow, set: (d) => { window.seenNow = d; } } } });
    }, seen);
  }
  test('nothing seen yet: the updates from the newest one\'s last 14 days are new', async ({ page }) => {
    await panelWith(page, '');
    expect(await page.evaluate(() => p.unseenCount())).toBe(2);
  });
  test('a date seen: only later updates are new; a bad date counts as none seen', async ({ page }) => {
    await panelWith(page, '2026-09-29');
    expect(await page.evaluate(() => p.unseenCount())).toBe(1);
    await page.evaluate(() => { p.open(); });
    await expect(newsLinks(page)).toHaveCount(3);
    await expect(page.locator('.help-news-link .help-new')).toHaveCount(1);
    await expect(page.locator('.help-news-link[data-news="c"] .help-new')).toHaveText('New');
    // Every update: grouped by day, and all seen.
    await page.locator('.help-news-all').click();
    await expect(page.locator('.help-news-day')).toHaveText(['2 October 2026', '29 September 2026', '1 September 2026']);
    expect(await page.evaluate(() => window.seenNow)).toBe('2026-10-02');
    expect(await page.evaluate(() => p.unseenCount())).toBe(0);
    await page.evaluate(() => { window.seenNow = '<b>nonsense</b>'; });
    expect(await page.evaluate(() => p.unseenCount())).toBe(2);
  });
});

test.describe('fmIDE', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await F.openFmIDE(page);
  });

  test('Help opens with What\'s new: the latest three, New marks, a dot on ❓; Every update marks them seen, kept after a reload', async ({ page }) => {
    await expect(page.locator('#rbHelp')).toHaveClass(/\bhas-news\b/);
    await page.keyboard.press('F1');
    await expect(panel(page).locator('.help-news-heading')).toContainText('What\'s new');
    await expect(newsLinks(page)).toHaveCount(3);
    await expect(newsLinks(page).first()).toHaveAttribute('data-news', FM.news[0].id);
    await expect(newsLinks(page).first().locator('.help-new')).toHaveText('New');
    // The list of every update, under the day each came, newest first.
    await panel(page).locator('.help-news-all').click();
    await expect(newsLinks(page)).toHaveCount(FM.news.length);
    expect(await newsLinks(page).evaluateAll(as => as.map(a => a.dataset.news))).toEqual(FM.news.map(e => e.id));
    expect(await panel(page).locator('.help-news-day').count()).toBe(new Set(FM.news.map(e => e.date)).size);
    await expect(page.locator('#rbHelp')).not.toHaveClass(/\bhas-news\b/);
    await expect.poll(async () => {
      const text = (await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1'))['fmIDE-workspace-v1'];
      return text ? (JSON.parse(text).ui || {}).whatsNewSeen : undefined;
    }, { timeout: 5000 }).toBe(FM.news[0].date);
    await panel(page).locator('.help-back').click();
    await expect(panel(page).locator('.help-new')).toHaveCount(0);
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await expect(page.locator('#rbHelp')).not.toHaveClass(/\bhas-news\b/);
  });

  test('an update\'s page: what changed, why, how to use it, a command that runs, and its guide', async ({ page }) => {
    await page.keyboard.press('F1');
    await panel(page).locator('.help-news-all').click();
    await panel(page).locator('.help-news-link[data-news="add-many-rectangles"]').click();
    const art = panel(page).locator('.help-news-item[data-news="add-many-rectangles"]');
    await expect(art.locator('.help-topic-title')).toHaveText('Add many rectangles at once');
    await expect(art.locator('h3.help-group')).toHaveText(['What changed', 'Why', 'How to use it', 'Good to know', 'Read more']);
    await expect(panel(page).locator('.help-crumb')).toContainText('2 October 2026');
    expect(await art.innerText()).not.toContain('{cmd:');
    await art.locator('.help-cmd[data-cmd="addManyRects"]').first().click();
    await expect(page.locator('.modal-box').last()).toBeVisible();
    await page.keyboard.press('Escape');
    await art.locator('.help-topic-link[data-topic="rectangles"]').click();
    await expect(panel(page).locator('.help-topic[data-topic="rectangles"]')).toBeVisible();
    await panel(page).locator('.help-back').click();
    await expect(art).toBeVisible();
  });

  test('search finds updates; What\'s New is a command and sits beside Help on the View tab', async ({ page }) => {
    await page.keyboard.press('F1');
    await panel(page).locator('.help-search').fill('equal spacing');
    await expect(panel(page).locator('.help-news-link[data-news="equal-spacing"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => fm.command('openWhatsNew'));
    await expect(panel(page).locator('.help-news-day').first()).toBeVisible();
    const view = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'view').groups.find(g => g.id === 'help').items.map(i => i.cmd));
    expect(view).toEqual(['openHelp', 'openWhatsNew']);
  });

  test('the updates seen are never taken from someone else\'s workspace file', async ({ page }, testInfo) => {
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    data.ui = Object.assign({}, data.ui, { whatsNewSeen: '2099-01-01' });
    const file = testInfo.outputPath('ws-seen.json');
    fs.writeFileSync(file, JSON.stringify(data));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    await expect(page.locator('#rbHelp')).toHaveClass(/\bhas-news\b/);
  });
});

test.describe('ExcelExporter', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1400, height: 900 }); await openApp(page, 'ExcelExporter'); });

  test('its own updates, a dot on ❓ Help until the list is opened, kept in its browser storage', async ({ page }) => {
    await expect(page.locator('#btnHelp')).toHaveClass(/\bhas-news\b/);
    await page.click('#btnHelp');
    await expect(newsLinks(page).first()).toHaveAttribute('data-news', EE.news[0].id);
    await panel(page).locator('.help-news-all').click();
    expect(await newsLinks(page).evaluateAll(as => as.map(a => a.dataset.news))).toEqual(EE.news.map(e => e.id));
    await panel(page).locator('.help-news-link[data-news="module-layouts"]').click();
    await expect(panel(page).locator('.help-news-item h3.help-group')).toHaveText(['What changed', 'Why', 'How to use it', 'Good to know', 'Read more']);
    await expect(page.locator('#btnHelp')).not.toHaveClass(/\bhas-news\b/);
    await expect.poll(async () => (await S.storedEntries(page, 'ExcelExporter', 'fmide-excel-whats-new-seen'))['fmide-excel-whats-new-seen'], { timeout: 5000 })
      .toBe(EE.news[0].date);
    await page.reload();
    await page.waitForTimeout(300);
    await expect(page.locator('#btnHelp')).not.toHaveClass(/\bhas-news\b/);
  });
});
