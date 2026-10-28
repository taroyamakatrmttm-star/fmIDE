// 94. Making a showcase viewer (phase V3 of docs/viewer-brief.md): the packer the build uses to
// carry the viewer's page inside fmIDE (tools/pack.js), the made page's two data blocks
// (fillViewerPage in src/shared/showcase.js) and the showcase built from an author's choices
// (showcaseFromChoices, showcaseBoardList, showcaseIdFrom). Node, plus a made viewer opened from
// disk. fmIDE's File → Make showcase viewer… comes with the rest of V3.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { test, expect, ROOT, fixture, readFixture } = require('./helpers/apps');
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
    expect(await page.locator('script').count()).toBe(3);
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
  for(const app of ['fmIDE', 'ExcelExporter', 'fmGraph', 'fmViewer']){
    const page = fs.readFileSync(path.join(ROOT, 'apps', app + '.html'), 'utf8');
    const opened = page.split('\n').filter(l => /^\s*<script[\s>]/i.test(l)).length;
    const closed = (page.match(/<\/script/gi) || []).length;
    expect(closed, app).toBe(opened);
    for(const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)){
      expect(m[1].includes('<!--') && /<script/i.test(m[1]), app).toBe(false);
    }
  }
});
