// 9. Storage — both apps keep their autosave in IndexedDB (src/shared/store.js), copy
// what an older version left in localStorage across once, fall back to localStorage
// where IndexedDB is unavailable, and ask the browser to keep the data once.
const { test, expect, readFixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const S = require('./helpers/storage');

const WS_KEY = 'fmIDE-workspace-v1';
const canvasNames = (page) => page.evaluate(() => fm.canvases().map(c => c.name));

// What an older fmIDE left in localStorage: a workspace autosave holding sys-current.
const legacyWorkspace = () => JSON.stringify({
  version: 1, kind: 'fmIDE-workspace',
  system: readFixture('formats', 'sys-current.json'),
  templates: [], formatPresets: []
});

// Puts key → text into localStorage before the app first starts (not again on reload).
function seedLocalStorage(page, key, text){
  return page.addInitScript(({ key, text }) => {
    if(sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem(key, text);
  }, { key, text });
}

// A fake navigator.storage whose persist() counts its calls (across reloads). The test
// origin is not a secure context, so the browser offers no navigator.storage of its own.
function fakePersist(page, answer){
  return page.addInitScript((answer) => {
    const persist = () => {
      localStorage.setItem('__persistCalls', String(Number(localStorage.getItem('__persistCalls') || 0) + 1));
      return Promise.resolve(answer);
    };
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist, persisted: () => Promise.resolve(false) } });
  }, answer);
}
const persistCalls = (page) => page.evaluate(() => Number(localStorage.getItem('__persistCalls') || 0));

test.describe('fmIDE', () => {
  test('a workspace left in localStorage by an older fmIDE opens, and is kept there', async ({ page }) => {
    const text = legacyWorkspace();
    await seedLocalStorage(page, WS_KEY, text);
    await F.openFmIDE(page);
    expect(await canvasNames(page)).toEqual(['Revenue Model']);
    expect(await page.evaluate(() => fm.nodes().length)).toBeGreaterThan(0);
    // Copied into IndexedDB; the old copy is left alone.
    expect((await S.storedEntries(page, 'fmIDE', WS_KEY))[WS_KEY]).toBe(text);
    expect(await page.evaluate((k) => localStorage.getItem(k), WS_KEY)).toBe(text);
  });

  test('after the move, the IndexedDB autosave wins over the old localStorage copy', async ({ page }) => {
    await seedLocalStorage(page, WS_KEY, legacyWorkspace());
    await F.openFmIDE(page);
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Edited Since' }));
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', WS_KEY))[WS_KEY] || '').toContain('Edited Since');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await canvasNames(page)).toEqual(['Edited Since']);
  });

  test('hiding the page saves the workspace', async ({ page }) => {
    await page.clock.install(); // the 8-second timer never fires on its own
    await F.openFmIDE(page);
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Saved On Hide' }));
    expect(await S.storedKeys(page, 'fmIDE', WS_KEY)).toEqual([]);
    await S.hidePage(page);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', WS_KEY))[WS_KEY] || '').toContain('Saved On Hide');
  });

  test('without IndexedDB it autosaves to localStorage and restores after a reload', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
    await F.openFmIDE(page);
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'No IndexedDB' }));
    await S.hidePage(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), WS_KEY)).toContain('No IndexedDB');
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    expect(await canvasNames(page)).toEqual(['No IndexedDB']);
  });

  test('asks the browser to keep the data once — on the first change, never again', async ({ page }) => {
    await fakePersist(page, false); // declined: still never asked again
    await F.openFmIDE(page);
    expect(await persistCalls(page)).toBe(0); // not at start-up
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'First Change' }));
    await expect.poll(() => persistCalls(page)).toBe(1);
    await expect.poll(async () => (await S.storedEntries(page, 'fmIDE', 'fmIDE/persistence-requested'))['fmIDE/persistence-requested'] || '')
      .toContain('"granted":false');
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'Second Change' }));
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'After Reload' }));
    await page.waitForTimeout(300);
    expect(await persistCalls(page)).toBe(1);
  });
});
