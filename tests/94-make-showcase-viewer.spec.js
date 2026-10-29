// 94. Making a showcase viewer (phase V3 of docs/viewer-brief.md): the packer the build uses to
// carry the viewer's page inside fmIDE (tools/pack.js), the made page's two data blocks
// (fillViewerPage in src/shared/showcase.js) and the showcase built from an author's choices
// (showcaseFromChoices, showcaseBoardList, showcaseIdFrom), in Node; and fmIDE's File → Make
// Showcase Viewer… (src/fmide/js/11g-showcase-maker.js, the actions in 14d), from the window to
// the made file opened from disk in a browser, as a visitor opens it.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { test, expect, ROOT, fixture, readFixture, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { deflateRaw, packBase64 } = require('../tools/pack.js');
const S = require('../src/shared/showcase.js');

const VIEWER = path.join(ROOT, 'apps', 'fmViewer.html');

test.describe('tools/pack.js: deflate that gives the same bytes everywhere', () => {
  test('what it packs unpacks to the same bytes, and packing again gives the same bytes', () => {
    const bytes = (n, f) => Buffer.from(Array.from({ length: n }, (_, i) => f(i)));
    let seed = 7;
    const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed & 0xff; };
    const cases = [
      Buffer.alloc(0), Buffer.from([0]), Buffer.from('a'), Buffer.from('abcabcabcabcabc'),
      Buffer.alloc(100000, 65),                         // one long run
      bytes(256 * 50, i => i % 256),                     // every byte value
      bytes(70000, noise),                               // nothing to find
      bytes(40000, i => (i % 300 < 3 ? noise() : 'xyz'.charCodeAt(i % 3))), // matches broken up
      Buffer.from('0123456789'.repeat(5000) + 'tail'),   // distances up to the whole window
      fs.readFileSync(VIEWER),
    ];
    for(const c of cases){
      const packed = deflateRaw(c);
      expect(zlib.inflateRawSync(packed).equals(c)).toBe(true);
      expect(deflateRaw(c).equals(packed)).toBe(true);
      expect(packBase64(c)).toBe(packed.toString('base64'));
    }
  });

  test('the viewer packs to about a third of its size', () => {
    const page = fs.readFileSync(VIEWER);
    const ratio = deflateRaw(page).length / page.length;
    expect(ratio).toBeLessThan(0.4);
  });

  test('the browser\'s own DecompressionStream unpacks it', async ({ page }) => {
    const text = 'Revenue = Price × Volume. '.repeat(2000) + '</script><!-- ✓';
    const b64 = packBase64(Buffer.from(text, 'utf8'));
    await page.goto('about:blank');
    const back = await page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }, b64);
    expect(back).toBe(text);
  });
});

// The JSON text in a page's block, as a browser reads it: everything up to the first </script>.
function blockText(page, id){
  const open = '<script type="application/json" id="' + id + '">';
  const at = page.indexOf(open);
  return page.slice(at + open.length, page.indexOf('</script>', at));
}

test.describe('fillViewerPage: the made viewer\'s two data blocks', () => {
  const bare = fs.readFileSync(VIEWER, 'utf8');
  const evil = '</script><script>window.__pwned=1</script><!-- "quoted" \\   ✓';

  test('the showcase and the model go in as data; markup in them can\'t end the block', () => {
    const showcase = { kind: 'fmIDE-showcase', version: 1, title: evil };
    const model = { kind: 'system', version: 9, canvases: [{ id: 'c1', name: evil, nodes: [], edges: [] }] };
    const r = S.fillViewerPage(bare, showcase, model);
    expect(r.error).toBeUndefined();
    expect(JSON.parse(blockText(r.page, 'showcase'))).toEqual(showcase);
    expect(JSON.parse(blockText(r.page, 'model'))).toEqual(model);
    expect(blockText(r.page, 'showcase')).not.toContain('<');
    expect(blockText(r.page, 'model')).not.toContain('<');
  });

  test('nothing outside the two blocks changes, so the viewer\'s own script is the same in every viewer', () => {
    const r = S.fillViewerPage(bare, { title: 'A' }, { kind: 'system', canvases: [] });
    const scripts = (t) => [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts(r.page)).toEqual(scripts(bare));
    expect(scripts(bare)).toHaveLength(1);
    const outside = (t) => t.replace(/(<script type="application\/json" id="(?:showcase|model)">)[^<]*<\/script>/g, '$1</script>');
    expect(outside(r.page)).toBe(bare);
  });

  test('a page whose blocks are missing or doubled makes nothing', () => {
    const s = S.VIEWER_BLOCKS.showcase, m = S.VIEWER_BLOCKS.model;
    for(const page of [bare.replace(s, ''), bare.replace(m, ''), bare.replace(s, s + s), bare.replace(m, m + '\n' + m), '', null]){
      const r = S.fillViewerPage(page, {}, {});
      expect(r.page).toBeUndefined();
      expect(r.error).toMatch(/^The viewer page isn't as expected/);
    }
  });

  test('a made viewer opened from disk shows the hostile names as text and runs none of them', async ({ browser }, testInfo) => {
    const model = readFixture('viewer', 'hostile-model.json');
    const showcase = S.cleanShowcase(readFixture('viewer', 'hostile-showcase.json')).value;
    const r = S.fillViewerPage(bare, showcase, model);
    const file = testInfo.outputPath('made.html');
    fs.writeFileSync(file, r.page);
    const context = await browser.newContext();
    const outside = [];
    await context.route('**/*', route => { const u = route.request().url(); if(u.startsWith('file:')) return route.continue(); outside.push(u); return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
    await page.goto('file://' + file);
    await page.waitForFunction(() => window.fmViewer && fmViewer.state().loaded);
    const st = await page.evaluate(() => fmViewer.state());
    expect(st.title).toBe(showcase.title);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(await page.locator('script').count()).toBe(4); // the app's script and its three data blocks (V4: excel)
    expect(errors).toEqual([]);
    expect(outside).toEqual([]);
    await context.close();
  });
});

test.describe('the showcase from an author\'s choices', () => {
  const boards = {
    kind: 'fmIDE-graph-board', version: 13, active: 1, colours: { 'c1/n1': '#ff0000' },
    boards: [{ name: 'Prices', items: [], sliders: [] }, { name: 'Cash', items: [], sliders: [] }, { name: '<b>Third</b>', items: [], sliders: [] }],
    scenarios: [{ name: 'High price', settings: [] }, { name: 'Low price', settings: [] }]
  };
  const model = { canvases: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], periodCount: 5 };

  test('ids from titles: letters and digits, dashes, at most 60; "showcase" when nothing is left', () => {
    expect(S.showcaseIdFrom('How a loan is repaid')).toBe('how-a-loan-is-repaid');
    expect(S.showcaseIdFrom('  Café — Crème Brûlée, 2026!  ')).toBe('cafe-creme-brulee-2026');
    expect(S.showcaseIdFrom('ローンの返済')).toBe('showcase');
    expect(S.showcaseIdFrom('')).toBe('showcase');
    expect(S.showcaseIdFrom(null)).toBe('showcase');
    const long = S.showcaseIdFrom('word '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(S.SHOWCASE_ID);
    expect(long).not.toMatch(/-$/);
  });

  test('the board list: names only, as text; ticks follow the showcase made before', () => {
    expect(S.showcaseBoardList(boards)).toEqual({ boards: [{ name: 'Prices', chosen: true }, { name: 'Cash', chosen: true }, { name: '<b>Third</b>', chosen: true }],
      scenarios: ['High price', 'Low price'] });
    const before = { boards: { kind: 'fmIDE-graph-board', version: 13, boards: [{ name: 'Cash' }, { name: 'Gone' }] } };
    expect(S.showcaseBoardList(boards, before).boards.map(b => b.chosen)).toEqual([false, true, false]);
    expect(S.showcaseBoardList(boards, { title: 'no boards before' }).boards.map(b => b.chosen)).toEqual([false, false, false]);
    expect(S.showcaseBoardList({ kind: 'fmIDE-graph-board', version: 2, form: 'template', boards: [{ name: 'T' }] })).toEqual({ boards: [], scenarios: [] });
    expect(S.showcaseBoardList(null)).toEqual({ boards: [], scenarios: [] });
    expect(S.showcaseBoardList({ boards: [null, { name: 5 }, {}], scenarios: [{ name: '' }, null, { name: 'A' }, { name: 'A' }] }))
      .toEqual({ boards: [{ name: 'Board 1', chosen: true }, { name: '5', chosen: true }, { name: 'Board 3', chosen: true }], scenarios: ['A'] });
  });

  test('every choice goes into the showcase, checked as a showcase file is', () => {
    const r = S.showcaseFromChoices({ title: 'How prices move cash', description: 'Move the price.', author: 'A teacher', licence: 'CC BY 4.0',
      mark: false, canvases: ['c3', 'c1'], start: 'c3', periods: { from: 1, to: 3 }, boards: [2, 0], play: { from: 'Base', to: 'High price' } }, boards, model);
    expect(r.error).toBeNull();
    expect(r.problems).toEqual([]);
    expect(r.value).toMatchObject({ kind: 'fmIDE-showcase', version: 1, id: 'how-prices-move-cash', title: 'How prices move cash', description: 'Move the price.',
      author: 'A teacher', licence: 'CC BY 4.0', mark: false, canvases: { show: ['c1', 'c3'], start: 'c3' }, periods: { mode: 'range', from: 1, to: 3 },
      play: { from: 'Base', to: 'High price' } });
    expect(r.value).not.toHaveProperty('excel');
    // The boards chosen, in the document's order, the first shown; the file's scenarios and colours kept.
    expect(r.value.boards).toEqual(Object.assign({}, boards, { active: 0, boards: [boards.boards[0], boards.boards[2]] }));
    // What comes out reads back as the same showcase, with nothing to complain about.
    const again = S.cleanShowcase(JSON.parse(JSON.stringify(r.value)));
    expect(again.problems).toEqual([]);
    expect(S.showcaseForFile(again.value)).toEqual(r.value);
  });

  test('left out: every period, no boards, an id of the author\'s own', () => {
    const r = S.showcaseFromChoices({ id: 'my-model', title: 'T', canvases: ['c1', 'c2', 'c3'], periods: { from: 0, to: 4 }, boards: [], play: { from: 'Base', to: 'High price' } }, boards, model);
    expect(r.value).toMatchObject({ id: 'my-model', mark: true, canvases: { show: ['c1', 'c2', 'c3'], start: 'c1' } });
    for(const k of ['periods', 'boards', 'play', 'excel']) expect(r.value).not.toHaveProperty(k);
    expect(r.problems).toEqual([]);
    const odd = S.showcaseFromChoices({ id: 'Not an id', title: 'Ignored', canvases: ['c1'] }, null, model);
    expect(odd.value.id).toBe('not-an-id');
  });

  test('what is no longer there is left out and said; Play needs two ends; "Base" as a scenario is pointed out', () => {
    const r = S.showcaseFromChoices({ title: 'T', canvases: ['c1', 'gone'], start: 'gone', boards: [1, 9, 'x'], play: { from: 'Base', to: 'Nowhere' } }, boards, model);
    expect(r.value.canvases).toEqual({ show: ['c1'], start: 'c1' });
    expect(r.value.boards.boards.map(b => b.name)).toEqual(['Cash']);
    expect(r.value).not.toHaveProperty('play');
    expect(r.problems).toEqual(['A canvas chosen is no longer in the model: it is left out.', 'A board chosen is no longer in the model: it is left out.',
      'Play needs two different ends, Base or a scenario: left out.']);
    const same = S.showcaseFromChoices({ canvases: ['c1'], boards: [0], play: { from: 'Low price', to: 'Low price' } }, boards, model);
    expect(same.value).not.toHaveProperty('play');
    const withBase = Object.assign({}, boards, { scenarios: [{ name: 'Base', settings: [] }, { name: 'High price', settings: [] }] });
    const b = S.showcaseFromChoices({ canvases: ['c1'], boards: [0], play: { from: 'Base', to: 'High price' } }, withBase, model);
    expect(b.problems).toEqual(['A scenario is named "Base", which Play keeps for the model\'s own numbers: it can\'t be one of Play\'s ends.']);
    expect(b.value.play).toEqual({ from: 'Base', to: 'High price' });
  });

  test('no canvas chosen makes nothing; periods past the model are kept within it', () => {
    expect(S.showcaseFromChoices({ title: 'T', canvases: [] }, null, model)).toEqual({ value: null, problems: [], error: 'Choose at least one canvas to show.' });
    expect(S.showcaseFromChoices(null, null, model).error).toBe('Choose at least one canvas to show.');
    const p = S.showcaseFromChoices({ canvases: ['c1'], periods: { from: 3, to: 99 } }, null, model);
    expect(p.value.periods).toEqual({ mode: 'range', from: 3, to: 4 });
    const q = S.showcaseFromChoices({ canvases: ['c1'], periods: { from: 'x', to: -2 } }, null, model);
    expect(q.value.periods).toEqual({ mode: 'range', from: 0, to: 0 });
  });

  test('hostile texts are cut and kept as text', () => {
    const r = S.showcaseFromChoices({ title: '<img src=x onerror=alert(1)>' + 'x'.repeat(200), author: { toString: () => 'x' }, licence: 7,
      description: '<script>alert(1)</script>\u0000', canvases: ['c1'] }, null, model);
    expect(r.value.title.length).toBe(80);
    expect(r.value.title.startsWith('<img src=x onerror=alert(1)>')).toBe(true);
    expect(r.value.author).toBe('');
    expect(r.value.licence).toBe('7');
    expect(r.value.description).toBe('<script>alert(1)</script>');
    expect(r.value.id).toMatch(S.SHOWCASE_ID);
  });
});

// The apps carry src/shared/showcase.js (which names the viewer's data blocks) inside their own
// inline script: nothing there may end the script early, and no script may hold both "<!--" and
// "<script" (the parser would then read past its real end).
test('every closing script tag in the apps ends a script the page opened', () => {
  const apps = fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html'));
  expect(apps).toHaveLength(4);
  for(const app of apps){
    const page = fs.readFileSync(path.join(ROOT, 'apps', app), 'utf8');
    const opened = page.split('\n').filter(l => /^\s*<script[\s>]/i.test(l)).length;
    const closed = (page.match(/<\/script/gi) || []).length;
    expect(closed, app).toBe(opened);
    for(const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)){
      expect(m[1].includes('<!--') && /<script/i.test(m[1]), app).toBe(false);
    }
  }
});

// ---------- fmIDE: File → Make Showcase Viewer… ----------

const WIDGET = fixture('viewer', 'every-widget.fmide');
const maker = (page) => page.locator('.modal-box.showcase-maker');
async function openDocument(page, file){
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(file);
}
async function fmideWith(page, file, firstCanvas){
  await F.openFmIDE(page);
  await openDocument(page, file);
  await expect.poll(() => page.evaluate(() => fm.canvases()[0].id)).toBe(firstCanvas);
}
// The download Make viewer gives: its name and text.
async function makeFromWindow(page){
  const [download] = await Promise.all([page.waitForEvent('download'), maker(page).locator('.sm-make').click()]);
  return { name: download.suggestedFilename(), text: fs.readFileSync(await download.path(), 'utf8') };
}
// A made page opened from disk in a context of its own; every request that isn't the file is counted.
async function openMade(browser, testInfo, made){
  const file = testInfo.outputPath(made.name);
  fs.writeFileSync(file, made.text);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const outside = [];
  await context.route('**/*', route => { const u = route.request().url(); if(u.startsWith('file:')) return route.continue(); outside.push(u); return route.abort(); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.fmViewer && fmViewer.state().loaded);
  return { context, page, outside, errors };
}

test.describe('fmIDE: Make Showcase Viewer…', () => {
  test('the command opens the window, with its "?", started from the document', async ({ page }) => {
    await fmideWith(page, WIDGET, 'cProfit');
    // (Its place in the ribbon, and a customised ribbon getting it once: group 47, beside the command it follows.)
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    const box = maker(page);
    await expect(box).toBeVisible();
    await expect(box.locator('.window-help')).toHaveAttribute('data-topic', 'showcase-viewer');
    await expect(box.locator('.sm-title')).toHaveValue('every-widget');
    await expect(box.locator('.sm-id')).toHaveValue('every-widget');
    expect(await box.locator('.sm-canvas input').evaluateAll(l => l.map(i => [i.dataset.id, i.checked]))).toEqual([['cProfit', true], ['cCash', true], ['cBS', true], ['cChecks', true]]);
    expect(await box.locator('.sm-board').allTextContents()).toEqual([' Everything', ' Own sliders']);
    expect(await box.locator('.sm-board input').evaluateAll(l => l.map(i => i.checked))).toEqual([true, true]);
    await expect(box.locator('.sm-play-from')).toHaveValue('Base');
    await expect(box.locator('.sm-play-to')).toHaveValue('High price');
    await expect(box.locator('.sm-from')).toHaveValue('0');
    await expect(box.locator('.sm-to')).toHaveValue('3');
    await expect(box.locator('.sm-secrecy')).toContainText('Everything in the model goes into the file');
    // Typing a title changes the file name until the person changes it.
    await box.locator('.sm-title').fill('Prices and cash');
    await expect(box.locator('.sm-id')).toHaveValue('prices-and-cash');
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
  });

  test('the whole way: choose, make, open the file from disk, move a slider; making again remembers every choice', async ({ page, browser }, testInfo) => {
    await fmideWith(page, WIDGET, 'cProfit');
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    const box = maker(page);
    await box.locator('.sm-title').fill('Prices and <b>cash</b>');
    await box.locator('.sm-description').fill('Move the price.');
    await box.locator('.sm-author').fill('A teacher');
    await box.locator('.sm-licence').fill('CC BY 4.0');
    await box.locator('.sm-canvas input[data-id="cChecks"]').uncheck();
    await box.locator('.sm-start').selectOption('cCash');
    await box.locator('.sm-from').selectOption('1');
    await box.locator('.sm-to').selectOption('2');
    await box.locator('.sm-board input[data-index="1"]').uncheck();
    await box.locator('.sm-play-to').selectOption('Big year');
    const made = await makeFromWindow(page);
    expect(made.name).toBe('prices-and-b-cash-b.html');
    await expect(box).toHaveCount(0);
    await expect(page.locator('#fmToast')).toContainText('Made prices-and-b-cash-b.html (');
    await expect.poll(() => page.evaluate(() => document.title)).toContain('•'); // kept in the document: unsaved
    const kept = await page.evaluate(() => fm.showcase());
    expect(kept).toMatchObject({ kind: 'fmIDE-showcase', version: 1, id: 'prices-and-b-cash-b', title: 'Prices and <b>cash</b>', author: 'A teacher',
      licence: 'CC BY 4.0', canvases: { show: ['cProfit', 'cCash', 'cBS'], start: 'cCash' }, periods: { mode: 'range', from: 1, to: 2 }, play: { from: 'Base', to: 'Big year' } });
    expect(kept.boards.boards.map(b => b.name)).toEqual(['Everything']);
    // The made file opens offline on the author's choices.
    const v = await openMade(browser, testInfo, made);
    const st = await v.page.evaluate(() => fmViewer.state());
    expect(st.title).toBe('Prices and <b>cash</b>');
    expect(st.canvases).toEqual(['cProfit', 'cCash', 'cBS']);
    expect(st.periods).toEqual([1, 2]);
    expect(st.hasBoard).toBe(true);
    expect((await v.page.evaluate(() => fmViewer.board())).boards).toEqual(['Everything']);
    expect(await v.page.locator('#showTitle b').count()).toBe(0);
    expect(await v.page.locator('script').count()).toBe(4); // the app's script and its three data blocks (V4: excel)
    // A slider moved in the viewer gives fmIDE's own number for that price.
    await v.page.evaluate(() => fmViewer.setSlider('Price', 12));
    const inViewer = await v.page.evaluate(() => fmViewer.value('cProfit', 'rev', 1));
    await page.evaluate(() => { fm.switchCanvas({ canvas: '#cProfit' }); fm.setValue({ node: '#price', value: '12' }); });
    const inFmide = await page.evaluate(() => fm.getValue({ node: '#rev', period: 2 }));
    expect(inViewer).toBe(inFmide);
    expect(inViewer).toBe(13200); // 12 × 1,100 (Volume in Year 2)
    expect(v.outside).toEqual([]);
    expect(v.errors).toEqual([]);
    await v.context.close();
    // Making it again starts from every choice, also after a reload (the autosave).
    await page.evaluate(() => new Promise(r => setTimeout(r, 2600)));
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    await expect(box.locator('.sm-title')).toHaveValue('Prices and <b>cash</b>');
    await expect(box.locator('.sm-author')).toHaveValue('A teacher');
    expect(await box.locator('.sm-canvas input').evaluateAll(l => l.map(i => i.checked))).toEqual([true, true, true, false]);
    await expect(box.locator('.sm-start')).toHaveValue('cCash');
    await expect(box.locator('.sm-from')).toHaveValue('1');
    await expect(box.locator('.sm-to')).toHaveValue('2');
    expect(await box.locator('.sm-board input').evaluateAll(l => l.map(i => i.checked))).toEqual([true, false]);
    await expect(box.locator('.sm-play-to')).toHaveValue('Big year');
    await expect(box.locator('.sm-notes')).toBeHidden();
  });

  test('a canvas gone since is said; a new one comes unticked', async ({ page }) => {
    await fmideWith(page, WIDGET, 'cProfit');
    await page.evaluate(() => fm.makeShowcaseViewer({ canvases: ['cProfit', 'cChecks'] }));
    await page.evaluate(() => { fm.deleteCanvas({ canvas: '#cChecks' }); fm.addCanvas({ name: 'Brand new' }); });
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    const box = maker(page);
    await expect(box.locator('.sm-notes')).toHaveText('A canvas chosen before is no longer in the model: it is left out.');
    expect(await box.locator('.sm-canvas input').evaluateAll(l => l.map(i => i.checked))).toEqual([true, false, false, false]);
  });

  test('a hostile model makes a viewer that shows its names as text and runs nothing', async ({ page, browser }, testInfo) => {
    await fmideWith(page, fixture('viewer', 'hostile-model.json'), 'c1');
    const evil = '</script><script>window.__pwned=1</script><!-- <img src=x onerror="window.__pwned=2">';
    const made = await page.evaluate((t) => fm.makeShowcaseViewer({ title: t, description: t, author: t }).then(r => ({ name: r.fileName, text: r.text, bytes: r.bytes })), evil);
    expect(made.name).toMatch(/^[a-z0-9-]+\.html$/);
    expect(made.bytes).toBe(Buffer.byteLength(made.text));
    const v = await openMade(browser, testInfo, made);
    expect(await v.page.evaluate(() => fmViewer.state().title)).toBe(evil.slice(0, 80));
    expect(await v.page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(await v.page.locator('script').count()).toBe(4); // the app's script and its three data blocks (V4: excel)
    expect(await v.page.locator('img, iframe, object, embed').count()).toBe(0);
    expect(v.errors).toEqual([]);
    expect(v.outside).toEqual([]);
    await v.context.close();
  });

  test('the action: a Promise of the file, nothing downloaded; refusals in words; no DecompressionStream is said', async ({ page }) => {
    await fmideWith(page, WIDGET, 'cProfit');
    let downloads = 0;
    page.on('download', () => downloads++);
    const r = await page.evaluate(() => fm.makeShowcaseViewer({ boards: [1], play: { from: 'High price', to: 'Base' } })
      .then(x => ({ fileName: x.fileName, problems: x.problems, showcase: x.showcase, start: x.text.slice(0, 2) })));
    expect(r.fileName).toBe('every-widget.html');
    expect(r.problems).toEqual([]);
    expect(r.start).toBe('<!');
    expect(r.showcase.boards.boards.map(b => b.name)).toEqual(['Own sliders']);
    expect(r.showcase.play).toEqual({ from: 'High price', to: 'Base' });
    expect(await page.evaluate(() => fm.showcase())).toEqual(r.showcase);
    expect(downloads).toBe(0);
    await expect(page.evaluate(() => fm.makeShowcaseViewer({ canvases: [] }))).rejects.toThrow('Choose at least one canvas to show.');
    await page.evaluate(() => { delete window.DecompressionStream; });
    await expect(page.evaluate(() => fm.makeShowcaseViewer())).rejects.toThrow('This browser can\'t make a viewer. Use a current Chrome, Edge, Firefox or Safari.');
  });

  test('practice refuses it: a tutorial\'s model isn\'t your document', async ({ page }) => {
    await fmideWith(page, WIDGET, 'cProfit');
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
    await page.evaluate(() => fm.command('makeShowcaseViewer'));
    await expect(page.locator('#fmToast')).toContainText('Finish or exit the tutorial first');
    await expect(maker(page)).toHaveCount(0);
    await expect(page.evaluate(() => fm.makeShowcaseViewer())).rejects.toThrow('Not while practising a tutorial');
  });
});

test('fmIDE carries today\'s viewer: its packed page unpacks to apps/fmViewer.html exactly', () => {
  const ide = fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html'), 'utf8');
  const m = /<script type="application\/octet-stream" id="viewerPage">([A-Za-z0-9+/=]+)<\/script>/.exec(ide);
  expect(m).not.toBeNull();
  expect(zlib.inflateRawSync(Buffer.from(m[1], 'base64')).equals(fs.readFileSync(VIEWER))).toBe(true);
});

test('a document dropped on fmShowcase that keeps its showcase opens as its viewer would', async ({ page }, testInfo) => {
  const doc = readFixture('viewer', 'every-widget.fmide');
  doc.version = 14;
  doc.showcase = S.showcaseFromChoices({ title: 'Kept in the document', canvases: ['cCash', 'cProfit'], start: 'cCash', boards: [1] }, doc.graphBoards,
    { canvases: doc.system.canvases, periodCount: doc.system.periods.length }).value;
  const file = testInfo.outputPath('kept.fmide');
  fs.writeFileSync(file, JSON.stringify(doc));
  await openApp(page, 'fmViewer');
  await page.waitForFunction(() => !!window.fmViewer);
  const before = await page.evaluate(() => fmViewer.state().loads);
  await page.setInputFiles('#fileInput', file);
  await page.waitForFunction((n) => fmViewer.state().loads > n, before);
  const st = await page.evaluate(() => fmViewer.state());
  expect(st.title).toBe('Kept in the document');
  expect(st.canvases).toEqual(['cProfit', 'cCash']);
  expect((await page.evaluate(() => fmViewer.board())).boards).toEqual(['Own sliders']);
});

// Choose for me (phase V5): a model with no fmGraph boards gets one chosen for it — a slider on
// each input that moves something, a bar on each result — added to the document's boards, so the
// window ticks it and fmGraph would show it; the viewer made opens on it.
test('no boards: Choose for me adds "Chosen for me" to the document\'s boards, ticked; the viewer opens on it; fm.showcaseChooseForMe', async ({ page, browser }, testInfo) => {
  await fmideWith(page, fixture('formats', 'sys-current.json'), 'c1');
  await page.evaluate(() => fm.command('makeShowcaseViewer'));
  const box = maker(page);
  await expect(box.locator('.sm-choose-for-me')).toHaveText('Choose for me');
  await box.locator('.sm-choose-for-me').click();
  await expect(box.locator('.sm-board')).toHaveCount(1);
  expect(await box.locator('.sm-board').textContent()).toBe(' Chosen for me');
  await expect(box.locator('.sm-board input')).toBeChecked();
  await expect(box.locator('.sm-chosen')).toHaveText('Chosen for me: 2 sliders (Unit Price, Volume) and 1 bar (Revenue). Open fmGraph to adjust them.');
  const made = await makeFromWindow(page);
  const v = await openMade(browser, testInfo, made);
  expect(await v.page.evaluate(() => fmViewer.board().boards)).toEqual(['Chosen for me']);
  expect(await v.page.evaluate(() => fmViewer.board().sliders.map(s => [s.name, s.mode]))).toEqual([['Unit Price', 'set'], ['Volume', 'set']]);
  expect(v.errors).toEqual([]);
  await v.context.close();
  // Once the model has boards, there is nothing to choose for it.
  expect(await page.evaluate(() => { try{ fm.showcaseChooseForMe(); return 'chose'; }catch(e){ return e.message; } })).toMatch(/has fmGraph boards already/);
});

test('fm.showcaseChooseForMe on a model with no boards: what it chose, by name', async ({ page }) => {
  await fmideWith(page, fixture('formats', 'sys-current.json'), 'c1');
  expect(await page.evaluate(() => fm.showcaseChooseForMe())).toEqual({
    sliders: [{ name: 'Unit Price', canvas: expect.any(String), mode: 'set', min: expect.any(Number), max: expect.any(Number), step: expect.any(Number) },
      { name: 'Volume', canvas: expect.any(String), mode: 'set', min: expect.any(Number), max: expect.any(Number), step: expect.any(Number) }],
    bars: [{ name: 'Revenue', canvas: expect.any(String) }], notes: [] });
});
