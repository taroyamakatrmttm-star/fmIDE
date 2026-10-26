// 83. The colour grid (the owner's request of 27 October 2026; src/shared/colour-grid.js): every
// colour box in fmGraph, fmIDE and ExcelExporter opens a grid of ready colours — greys, twelve
// hues in six shades, the chart colours and the colours in use — instead of the browser's own box,
// which "More…" still opens. A pick goes through the app's own handlers, as the browser's box does.
const { test, expect, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');

const grid = (page) => page.locator('.colour-grid');
const swatch = (page, colour) => grid(page).locator(`.cg-swatch[data-colour="${colour}"]`).first();
const titles = (page) => grid(page).locator('.cg-title').allTextContents();

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}

test('the grid\'s colours, in Node: greys, 12 hues by 6 shades, only #rrggbb from data', async () => {
  const G = require('../src/shared/colour-grid.js');
  const secs = G.colourGridSections(['#0F766E', '#abc', 'red', 'url(x)', '#0f766e'], ['#12345', '#00ff00']);
  expect(secs.map(s => s.title)).toEqual(['Greys', 'Colours', 'Chart colours', 'In use']);
  expect(secs[0].swatches).toHaveLength(12);
  expect(secs[0].swatches[0]).toEqual({ colour: '#ffffff', name: 'White' });
  expect(secs[0].swatches[11]).toEqual({ colour: '#000000', name: 'Black' });
  expect(secs[1].swatches).toHaveLength(72);
  expect(secs[1].swatches[0].name).toBe('Red, lightest');
  for(const s of secs.flatMap(x => x.swatches)) expect(s.colour).toMatch(/^#[0-9a-f]{6}$/);
  expect(secs[2].swatches.map(s => s.colour)).toEqual(['#0f766e', '#aabbcc']);
  expect(secs[3].swatches.map(s => s.colour)).toEqual(['#00ff00']);
  expect(G.colourGridSections([], []).map(s => s.title)).toEqual(['Greys', 'Colours']);
  expect(G.coloursIn({ a: { fill: '#FFFFFF', font: { color: '#123' } }, b: [{ colour: 'javascript:x' }, '#00ff00'], c: { name: '#ff0000' } }))
    .toEqual(['#ffffff', '#112233', '#00ff00']);
});

test('fmGraph: a colour box opens the grid; a pick colours the rectangle; keys, names, More…', async ({ page, pageErrors }) => {
  await openSample(page);
  const box = page.locator('.slider-widget input.slider-colour').first();
  await box.click();
  await expect(grid(page)).toBeVisible();
  await expect(grid(page)).toHaveAttribute('role', 'dialog');
  await expect(grid(page)).toHaveAttribute('aria-label', /^Colour of /);
  expect(await titles(page)).toEqual(['Automatic', 'Greys', 'Colours', 'Chart colours', 'In use']);
  // The chart colours and those in use: the sample's Closing cash and Equipment among them.
  await expect(grid(page).locator('.cg-group').nth(3).locator('.cg-swatch')).toHaveCount(8);
  const inUse = await grid(page).locator('.cg-group').nth(4).locator('.cg-swatch').evaluateAll(els => els.map(e => e.dataset.colour));
  expect(inUse).toEqual(expect.arrayContaining(['#0f766e', '#2563eb']));
  // Every swatch has a name; the focus starts on the box's colour (Price has none chosen: Automatic), marked as pressed.
  await expect(swatch(page, '#ffffff')).toHaveAttribute('aria-label', 'White, #ffffff');
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.dataset.colour);
  expect(await focused()).toBe(await box.inputValue());
  await expect(grid(page).locator('.cg-swatch[aria-pressed="true"]')).toHaveCount(1);

  // Esc closes it and gives the focus back; Enter opens it again.
  await page.keyboard.press('Escape');
  await expect(grid(page)).toHaveCount(0);
  await expect(box).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(grid(page)).toBeVisible();
  // The arrows move through the grid: from White, right and down.
  await swatch(page, '#ffffff').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const target = await focused();
  expect(await grid(page).locator(`.cg-swatch[data-colour="${target}"]`).first().getAttribute('aria-label')).toBe('Orange, lightest, ' + target);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  // Up from White reaches Automatic, the top row: Up and Left there stay put; Left at a row's start goes up.
  await swatch(page, '#ffffff').focus();
  await page.keyboard.press('ArrowUp');
  await expect(grid(page).locator('.cg-auto')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await expect(grid(page).locator('.cg-auto')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  expect(await focused()).toBe('#ffffff');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  expect(await focused()).toBe('#000000');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  expect(await focused()).toBe('#ffffff');
  await swatch(page, '#ffffff').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  // Tab goes to More… and back to the grid.
  await page.keyboard.press('Tab');
  await expect(grid(page).locator('.cg-more')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focused()).toBe(target);
  // Enter picks it: the rectangle's colour is chosen, the bar drawn in it, one undo step.
  await page.keyboard.press('Enter');
  await expect(grid(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => fmGraph.rectColour('Price'))).toEqual({ colour: target, chosen: true });
  await expect(page.locator('.slider-widget input.slider-colour').first()).toHaveValue(target);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => fmGraph.rectColour('Price').chosen)).toBe(false);

  // A click picks too; a press outside closes it with nothing picked.
  await page.locator('.bar-widget input.colour-pick').first().click();
  await swatch(page, '#000000').click();
  await expect(page.locator('.bar-widget input.colour-pick').first()).toHaveValue('#000000');
  await page.locator('.bar-widget input.colour-pick').first().click();
  // Scrolling the page keeps it open beside its box.
  await page.evaluate(() => window.scrollBy(0, 40));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(grid(page)).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(grid(page)).toHaveCount(0);
  await expect(page.locator('.bar-widget input.colour-pick').first()).toHaveValue('#000000');

  // More… closes the grid and opens the browser's own box.
  await page.evaluate(() => { window.shown = 0; HTMLInputElement.prototype.showPicker = function(){ window.shown++; }; });
  await page.locator('.bar-widget input.colour-pick').first().click();
  await grid(page).locator('.cg-more').click();
  await expect(grid(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.shown)).toBe(1);
  expect(pageErrors).toEqual([]);
});

test('fmGraph: Automatic goes back to a rectangle\'s automatic colour everywhere, one undo step', async ({ page, pageErrors }) => {
  await openSample(page);
  const G = require('../src/shared/colour-grid.js');
  expect(G.colourGridSections([], [], { colour: '#0F766E', name: 'x' })[0]).toEqual({ title: 'Automatic', swatches: [{ colour: '#0f766e', auto: true, name: 'Automatic (x)' }] });
  const keySwatch = () => page.locator('.chart-widget').first().locator('input.key-swatch').first();
  const cash = () => page.evaluate(() => fmGraph.rectColour('Closing cash'));
  expect(await cash()).toEqual({ colour: '#0f766e', chosen: false });
  // Automatic comes first, showing the colour it has now, marked.
  await keySwatch().click();
  expect((await titles(page))[0]).toBe('Automatic');
  const auto = grid(page).locator('.cg-auto');
  await expect(auto).toHaveAttribute('data-colour', '#0f766e');
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  await expect(auto).toHaveAttribute('aria-label', 'Automatic, #0f766e');
  await expect(auto).toBeFocused();
  await swatch(page, '#000000').click();
  await expect.poll(cash).toEqual({ colour: '#000000', chosen: true });
  await expect(keySwatch()).toHaveValue('#000000');
  // Chosen: Automatic still shows the colour to go back to, no longer marked.
  await keySwatch().click();
  await expect(grid(page).locator('.cg-auto')).toHaveAttribute('data-colour', '#0f766e');
  await expect(grid(page).locator('.cg-auto')).not.toHaveAttribute('aria-pressed', 'true');
  await expect(grid(page).locator('.cg-swatch[aria-pressed="true"]')).toHaveAttribute('data-colour', '#000000');
  await grid(page).locator('.cg-auto').click();
  await expect(grid(page)).toHaveCount(0);
  await expect.poll(cash).toEqual({ colour: '#0f766e', chosen: false });
  await expect(keySwatch()).toHaveValue('#0f766e');
  await expect(page.locator('.bar-widget input.colour-pick').first()).toHaveValue('#0f766e'); // the Closing cash bar too
  // Undo brings the pick back.
  await page.keyboard.press('Control+z');
  await expect.poll(cash).toEqual({ colour: '#000000', chosen: true });
  expect(pageErrors).toEqual([]);
});

test('fmIDE: the rectangle format window\'s Fill opens the grid with the colours in use, and Esc keeps the window', async ({ page, pageErrors }) => {
  await F.openFmIDE(page);
  const id = await page.evaluate(() => {
    fm.clearCanvas();
    const a = fm.createRect({ x: 100, y: 80, name: 'Price', value: '10' });
    fm.setStyle('#' + a, { fill: '#fde68a' });
    return fm.createRect({ x: 100, y: 240, name: 'Volume', value: '5' });
  });
  const node = page.locator(`.node[data-id="${id}"]`);
  await node.hover();
  await node.locator('.props-btn').click();
  const dialog = F.topDialog(page);
  const fill = dialog.locator('input[type=color]').first();
  await fill.click();
  await expect(grid(page)).toBeVisible();
  expect(await titles(page)).toEqual(['Greys', 'Colours', 'In use']);
  await expect(grid(page).locator('.cg-group').nth(2).locator('.cg-swatch[data-colour="#fde68a"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(grid(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await fill.click();
  await grid(page).locator('.cg-group').nth(2).locator('.cg-swatch[data-colour="#fde68a"]').click();
  await expect(fill).toHaveValue('#fde68a');
  await dialog.locator('input[type=color]').first().locator('xpath=ancestor::*[1]/following-sibling::*[1]//input[@type="checkbox"]').uncheck(); // No fill (default) off
  await dialog.locator('button', { hasText: /^Save$/ }).click();
  await expect(F.topDialog(page)).toHaveCount(0);
  await expect.poll(() => node.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(253, 230, 138)');
  expect(pageErrors).toEqual([]);
});

test('ExcelExporter: an Excel style colour box opens the grid, and a pick is the style\'s', async ({ page, pageErrors }) => {
  await X.openExporter(page);
  await X.loadFixtureModel(page, 'roles-workspace-edited.json');
  await X.openSettings(page, 'style');
  const field = page.locator('#excelStyleBody tr[data-role="Links"] [data-field="fontColor"]');
  await field.click();
  await expect(grid(page)).toBeVisible();
  expect(await titles(page)).toEqual(['Greys', 'Colours', 'In use']);
  await expect(grid(page).locator('.cg-group').nth(2).locator('.cg-swatch[data-colour="#eff6ff"]')).toHaveCount(1);
  await swatch(page, '#000000').click();
  await expect(field).toHaveValue('#000000');
  await expect(page.locator('#excelStyleBody tr[data-role="Links"] [data-field="fontAuto"]')).not.toBeChecked();
  expect(pageErrors).toEqual([]);
});
