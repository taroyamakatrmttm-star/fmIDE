// 29. Resizable windows and the Templates tree (fmIDE): a large window can be made bigger
// or smaller from its corner, keeps that size (in the person's own UI settings), goes back
// to its own size on a double-click on the corner, and is never larger than the screen. The
// Templates window lists templates as a tree of groups that open and close.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');

// The windows, by the command that opens them and their box's class.
const WINDOWS = [
  ['templates', 'openTemplates', '.modal-box.template-box:not(.function-box)'],
  ['functions', 'openFunctions', '.modal-box.function-box'],
  ['macroBuilder', 'openMacros', '.modal-box.macro-box'],
  ['ribbon', 'customizeRibbon', '.modal-box.rbc-box'],
];

// The UI settings as saved in the autosave.
async function savedUi(page){
  const entries = await S.storedEntries(page, 'fmIDE', 'fmIDE-workspace-v1');
  const text = entries['fmIDE-workspace-v1'];
  return text ? (JSON.parse(text).ui || {}) : {};
}
// Resize a window the way dragging its corner does: the browser writes the new size into
// the box's style.
const resizeTo = (box, w, h) => box.evaluate((el, [w, h]) => { el.style.width = w + 'px'; el.style.height = h + 'px'; }, [w, h]);
const sizeOf = (box) => box.evaluate(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await F.openFmIDE(page);
});

for(const [key, command, selector] of WINDOWS){
  test(`${key}: resizable from its corner; the size is kept after a reload; a double-click on the corner resets it`, async ({ page }) => {
    await page.evaluate((c) => fm.command(c), command);
    let box = page.locator(selector);
    await expect(box).toBeVisible();
    expect(await box.evaluate(el => getComputedStyle(el).resize)).toBe('both');
    const before = await sizeOf(box);
    await resizeTo(box, 700, 520);
    await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes[key]), { timeout: 5000 }).toEqual({ w: 700, h: 520 });
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await page.evaluate((c) => fm.command(c), command);
    box = page.locator(selector);
    expect(await sizeOf(box)).toEqual({ w: 700, h: 520 });
    // Double-click the corner: back to the window's own size, and forgotten.
    const r = await box.boundingBox();
    await page.mouse.dblclick(r.x + r.width - 6, r.y + r.height - 6);
    expect(await sizeOf(box)).toEqual(before);
    await expect.poll(() => savedUi(page).then(ui => (ui.windowSizes || {})[key]), { timeout: 5000 }).toBeUndefined();
  });
}

test('a real drag on the corner resizes the window, and the new size is kept', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  const box = page.locator('.modal-box.template-box');
  const before = await sizeOf(box);
  const r = await box.boundingBox();
  await page.mouse.move(r.x + r.width - 4, r.y + r.height - 4);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width + 96, r.y + r.height + 76, { steps: 8 });
  await page.mouse.up();
  const after = await sizeOf(box);
  expect(after.w).toBeGreaterThan(before.w);
  expect(after.h).toBeGreaterThan(before.h);
  await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes.templates), { timeout: 5000 }).toBeTruthy();
});

test('a saved size larger than the screen opens at most the screen\'s size; bad saved sizes are ignored', async ({ page }) => {
  await page.evaluate(() => fm.command('openTemplates'));
  const box = page.locator('.modal-box.template-box');
  await resizeTo(box, 3000, 2000);
  await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes.templates && ui.windowSizes.templates.w), { timeout: 5000 }).toBe(3000);
  await page.reload();
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  await page.evaluate(() => fm.command('openTemplates'));
  const s = await sizeOf(page.locator('.modal-box.template-box'));
  expect(s.w).toBeLessThanOrEqual(Math.floor(1400 * 0.98));
  expect(s.h).toBeLessThanOrEqual(Math.floor(900 * 0.96));
});

test('a window size in someone else\'s workspace file is never taken', async ({ page }, testInfo) => {
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  data.ui = Object.assign({}, data.ui, { windowSizes: { templates: { w: 333, h: 444 } }, templateGroupsClosed: ['Financial Statement'] });
  const file = testInfo.outputPath('ws-with-sizes.json');
  fs.writeFileSync(file, JSON.stringify(data));
  await F.importViaCommand(page, 'importWorkspace', file);
  await F.acceptAll(page);
  await page.evaluate(() => fm.command('openTemplates'));
  const s = await sizeOf(page.locator('.modal-box.template-box'));
  expect(s).not.toEqual({ w: 333, h: 444 });
});

test.describe('the Templates tree', () => {
  async function importSearchTemplates(page){
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', fixture('templates', 'search.json'));
    await F.dismissMessage(page);
    return page.locator('.modal-box.template-box');
  }
  const headings = (box) => box.locator('.template-list > .template-group-toggle');
  const names = async (box) => (await box.locator('.template-list button.template-family').allInnerTexts()).map(t => t.split('\n')[0]);

  test('groups open and close (Enter too), stay closed after a reload, and a search still finds what is inside', async ({ page }) => {
    let box = await importSearchTemplates(page);
    const all = await names(box);
    expect(all.length).toBe(4);
    const fs1 = headings(box).filter({ hasText: 'Financial Statement' });
    await expect(fs1).toHaveAttribute('aria-expanded', 'true');
    // The templates inside the Financial Statement group (the heading's count).
    const inside = Number((await fs1.innerText()).match(/\((\d+)\)/)[1]);
    expect(inside).toBeGreaterThan(0);
    await fs1.click();
    await expect(fs1).toHaveAttribute('aria-expanded', 'false');
    // Its templates are hidden; the others stay.
    expect((await names(box)).length).toBe(all.length - inside);
    // Kept after a reload.
    await expect.poll(() => savedUi(page).then(ui => ui.templateGroupsClosed), { timeout: 5000 }).toEqual(['Financial Statement']);
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await page.evaluate(() => fm.command('openTemplates'));
    box = page.locator('.modal-box.template-box');
    await expect(headings(box).filter({ hasText: 'Financial Statement' })).toHaveAttribute('aria-expanded', 'false');
    // A search shows every match, closed group or not.
    await box.locator('.template-search').fill('statement');
    expect((await names(box)).some(n => /Income Statement|Cash flow statement/.test(n))).toBe(true);
    await box.locator('.template-search').fill('');
    // Enter on the focused heading opens it again.
    await headings(box).filter({ hasText: 'Financial Statement' }).focus();
    await page.keyboard.press('Enter');
    await expect(headings(box).filter({ hasText: 'Financial Statement' })).toHaveAttribute('aria-expanded', 'true');
    expect((await names(box)).length).toBe(all.length);
  });

  test('Collapse all closes every group (and older versions shown), Expand all opens them; kept after a reload; hidden while searching', async ({ page }) => {
    let box = await importSearchTemplates(page);
    // templates-v2.json adds a group Statements whose Balance Sheet has an older version.
    await box.locator('.modal-actions button', { hasText: /^Close$/ }).click();
    await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', fixture('formats', 'templates-v2.json'));
    await F.dismissMessage(page);
    box = page.locator('.modal-box.template-box');
    const groupCount = await headings(box).count();
    expect(groupCount).toBeGreaterThan(1);
    const expandAll = box.locator('button.template-expand-all'), collapseAll = box.locator('button.template-collapse-all');
    await expect(expandAll).toBeDisabled(); // every group is open
    await expect(collapseAll).toBeEnabled();
    await box.locator('.template-family', { hasText: 'Balance Sheet' }).click();
    await box.locator('button.template-versions-toggle').first().click();
    await expect(box.locator('.template-list button.template-version')).toHaveCount(1);
    await collapseAll.click();
    for(let i = 0; i < groupCount; i++) await expect(headings(box).nth(i)).toHaveAttribute('aria-expanded', 'false');
    expect(await names(box)).toEqual([]);
    await expect(collapseAll).toBeDisabled();
    await expect(expandAll).toBeEnabled();
    await expect.poll(() => savedUi(page).then(ui => (ui.templateGroupsClosed || []).length), { timeout: 5000 }).toBe(groupCount);
    // Kept after a reload.
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    await page.evaluate(() => fm.command('openTemplates'));
    box = page.locator('.modal-box.template-box');
    for(let i = 0; i < groupCount; i++) await expect(headings(box).nth(i)).toHaveAttribute('aria-expanded', 'false');
    // A search shows every match and hides the two buttons.
    await box.locator('.template-search').fill('statement');
    await expect(box.locator('.template-tree-tools')).toBeHidden();
    expect((await names(box)).length).toBeGreaterThan(0);
    await box.locator('.template-search').fill('');
    await box.locator('button.template-expand-all').click();
    for(let i = 0; i < groupCount; i++) await expect(headings(box).nth(i)).toHaveAttribute('aria-expanded', 'true');
    // Older versions stay closed after Expand all; every template shows.
    await expect(box.locator('.template-list button.template-version')).toHaveCount(0);
    expect((await names(box)).length).toBe(7);
    await expect.poll(() => savedUi(page).then(ui => ui.templateGroupsClosed), { timeout: 5000 }).toEqual([]);
  });

  test('the window\'s buttons: one toolbar, the library-wide ones under the list, Edit info and Delete beside the name', async ({ page }) => {
    const box = await importSearchTemplates(page);
    const toolbar = box.locator('.template-toolbar');
    for(const t of ['+ Save Canvas as Template', '+ Save System as Template', '+ New Recipe…', '⇩ Export Templates', '⇧ Import Templates']) {
      await expect(toolbar.locator('button', { hasText: t })).toBeVisible();
    }
    const footer = box.locator('.template-list-col .template-list-footer');
    await expect(footer.locator('button.template-dedupe')).toBeVisible();
    await expect(footer.locator('button.template-clear-all')).toBeVisible();
    await box.locator('.template-list button.template-family').first().click();
    const head = box.locator('.template-detail-head');
    await expect(head.locator('button', { hasText: '✎ Edit info' })).toBeVisible();
    await expect(head.locator('button.template-delete')).toBeVisible();
    // The toolbar's two groups and the selected template's actions each fit on one line.
    const rows = await box.evaluate((b) => {
      const tops = (sel) => [...new Set([...b.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().top)))].length;
      return { toolbar: tops('.template-toolbar button'), actions: tops('.template-actions button') };
    });
    expect(rows).toEqual({ toolbar: 1, actions: 1 });
    // Edit info still works from there.
    await head.locator('button', { hasText: '✎ Edit info' }).click();
    await expect(page.locator('.modal-box').last()).toBeVisible();
  });
});

test.describe('the 📈 chart (values across periods)', () => {
  // A rectangle and its 📈 window open, with `count` periods.
  async function openChart(page, count){
    const id = await page.evaluate((count) => {
      fm.clearAll();
      fm.setPeriodCount(count);
      const id = fm.createRect({ x: 80, y: 80, name: 'Price', value: '10' });
      fm.select(['#' + id]);
      return id;
    }, count);
    const node = page.locator(`.node[data-id="${id}"]`);
    await node.hover();
    await node.locator('.curve-btn').click();
    const box = page.locator('.modal-box.period-values-box');
    await expect(box).toBeVisible();
    return box;
  }
  // What the chart shows: its size, its space, its dots and the period numbers along the bottom.
  const chartState = (box) => box.evaluate(el => {
    const wrap = el.querySelector('.period-values-chart');
    const svg = wrap.querySelector('svg');
    const dots = [...svg.querySelectorAll('circle')].map(c => Number(c.getAttribute('cx')) + Number(c.getAttribute('r')));
    return {
      svgW: Number(svg.getAttribute('width')), svgH: Number(svg.getAttribute('height')),
      wrapW: wrap.clientWidth, wrapH: wrap.clientHeight,
      wrapScrolls: wrap.scrollWidth > wrap.clientWidth, boxScrolls: el.scrollWidth > el.clientWidth,
      dots: dots.length, rightmostDot: Math.max(...dots),
      labels: [...svg.querySelectorAll('text')].map(t => t.textContent),
    };
  });
  const values = (box) => box.locator('input[type="number"]').evaluateAll(els => els.slice(2).map(e => Number(e.value)));

  for(const count of [6, 24, 120]){
    test(`${count} periods: every period fits on the chart with no scrolling, and drawing reaches the first and last`, async ({ page, pageErrors }) => {
      const box = await openChart(page, count);
      const s = await chartState(box);
      expect(s.dots).toBe(count);
      expect(s.svgW).toBeLessThanOrEqual(s.wrapW);
      expect(s.rightmostDot).toBeLessThanOrEqual(s.svgW);
      expect(s.wrapScrolls).toBe(false);
      expect(s.boxScrolls).toBe(false);
      // The first and last period are numbered along the bottom.
      expect(s.labels).toContain('1');
      expect(s.labels).toContain(String(count));
      // Draw from high on the left to low on the right, edge to edge.
      const before = await values(box);
      const plot = await box.locator('.period-values-chart svg').boundingBox();
      await page.mouse.move(plot.x + 54, plot.y + plot.height * 0.2);
      await page.mouse.down();
      await page.mouse.move(plot.x + plot.width - 20, plot.y + plot.height * 0.8, { steps: 20 });
      await page.mouse.up();
      const after = await values(box);
      expect(after.length).toBe(count);
      expect(after[0]).not.toBe(before[0]);
      expect(after[count - 1]).not.toBe(before[count - 1]);
      expect(after[0]).toBeGreaterThan(after[count - 1]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('resizing the window resizes the chart; the size is kept after a reload', async ({ page, pageErrors }) => {
    let box = await openChart(page, 24);
    expect(await box.evaluate(el => getComputedStyle(el).resize)).toBe('both');
    const before = await chartState(box);
    await resizeTo(box, 1200, 700);
    await expect.poll(() => chartState(box).then(s => s.svgW)).toBeGreaterThan(before.svgW);
    let s = await chartState(box);
    expect(s.svgH).toBeGreaterThan(before.svgH);
    expect(s.wrapScrolls).toBe(false);
    await resizeTo(box, 500, 500);
    await expect.poll(() => chartState(box).then(s => s.svgW)).toBeLessThan(before.svgW);
    s = await chartState(box);
    expect(s.dots).toBe(24);
    expect(s.rightmostDot).toBeLessThanOrEqual(s.svgW);
    expect(s.wrapScrolls).toBe(false);
    expect(s.boxScrolls).toBe(false);
    await expect.poll(() => savedUi(page).then(ui => ui.windowSizes && ui.windowSizes.periodValues), { timeout: 5000 }).toEqual({ w: 500, h: 500 });
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
    box = await openChart(page, 24);
    expect(await sizeOf(box)).toEqual({ w: 500, h: 500 });
    expect(pageErrors).toEqual([]);
  });

  test('a smaller browser window makes the chart smaller, still with every period', async ({ page }) => {
    const box = await openChart(page, 60);
    const before = await chartState(box);
    await page.setViewportSize({ width: 700, height: 700 });
    await expect.poll(() => chartState(box).then(s => s.svgW)).toBeLessThan(before.svgW);
    const s = await chartState(box);
    expect(s.dots).toBe(60);
    expect(s.rightmostDot).toBeLessThanOrEqual(s.svgW);
    expect(s.boxScrolls).toBe(false);
  });
});
