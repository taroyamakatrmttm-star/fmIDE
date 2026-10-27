// 91. fmShowcase, the showcase viewer: the Logic view (phase V1 of docs/viewer-brief.md;
// apps/fmViewer.html, src/viewer/, src/shared/canvas-view.js, src/shared/showcase.js).
// - Offline, with no request tried; from disk (file:) too, as a viewer made for one model,
//   its showcase and model in the page's data blocks.
// - The bare app takes a model dropped or chosen, with or without a showcase: the canvases it
//   names, the one it opens on, the periods, the title, description, author, licence, mark.
// - Drawn as fmIDE draws it: every box and every arrow's ends (into and out of ports too) the
//   same as fmIDE's for the same model, within a pixel; every value the same as fmIDE's.
// - A rectangle's card: its value in each period shown, how it is worked out, the inputs it
//   reads; going to an input on another canvas; one on a canvas not shown.
// - Pan, the wheel, + / −, Fit, a pinch; nothing a visitor does changes the model, and there is
//   no editing control at all.
// - Hostile files shown as text; a phone's layout; the viewer's sources hold nothing of
//   ExcelExporter's; the site's page under its own security policy.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, fixture, readFixture, openApp } = require('./helpers/apps');
const F = require('./helpers/fmide');
const T = require('./helpers/touch');

const EVERY = fixture('viewer', 'every-kind.fmide');
const SHOWCASE = fixture('viewer', 'every-kind.showcase.json');
const V = (page, fn, arg) => page.evaluate(fn, arg);

async function openViewer(page){
  await openApp(page, 'fmViewer');
  await page.waitForFunction(() => !!window.fmViewer);
}
async function openFiles(page, files){
  await page.setInputFiles('#fileInput', files);
  await page.waitForFunction(() => fmViewer.state().loaded);
}
// The bare app with the page's data blocks filled in, written as a viewer is (every < as <).
function madeViewer(dir, showcase, model){
  const block = (id, data) => '<script type="application/json" id="' + id + '">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
  let html = fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8');
  if(showcase) html = html.replace('<script type="application/json" id="showcase"></script>', () => block('showcase', showcase));
  if(model) html = html.replace('<script type="application/json" id="model"></script>', () => block('model', model));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'viewer.html');
  fs.writeFileSync(file, html);
  return file;
}
// Opens a page from disk in a context of its own; every request that isn't a file is counted.
async function fromDisk(browser, file, options){
  const context = await browser.newContext(options || {});
  const outside = [];
  await context.route('**/*', route => { const u = route.request().url(); if(u.startsWith('file:')) return route.continue(); outside.push(u); return route.abort(); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction(() => !!window.fmViewer);
  return { context, page, outside, errors };
}
const numbersOf = (d) => (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number);
const close = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1);

test('the bare app opens offline, takes a model and a showcase, and shows what the showcase says', async ({ page, pageErrors }) => {
  await openViewer(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#logic')).toBeHidden();
  // A model alone: every canvas, the first opening, the model's name.
  await openFiles(page, [EVERY]);
  let s = await V(page, () => fmViewer.state());
  expect(s).toMatchObject({ title: 'every-kind', canvases: ['c2', 'c3', 'c4'], canvas: 'c2', period: 0, periods: [0, 1, 2], mark: true });
  await expect(page.locator('#canvasTabs .canvas-tab')).toHaveText(['Inputs', 'Block', 'Model']);
  await expect(page.locator('#periodNote')).toHaveText('Numbers for Period 1');
  // With its showcase: the two canvases it names, opening on Model, the periods 2 and 3.
  await openFiles(page, [EVERY, SHOWCASE]);
  s = await V(page, () => fmViewer.state());
  expect(s).toMatchObject({ title: 'Every kind of node', canvases: ['c4', 'c2'], canvas: 'c4', period: 1, periods: [1, 2], mark: true });
  await expect(page.locator('#canvasTabs .canvas-tab')).toHaveText(['Model', 'Inputs']);
  await expect(page.locator('#canvasTabs .canvas-tab[aria-selected="true"]')).toHaveText('Model');
  await expect(page.locator('#showDescription')).toHaveText('Price times volume, a block, a function and a period shift.\nTap a rectangle to see how it is worked out.');
  await expect(page.locator('#showByline')).toHaveText('By The fmIDE tests');
  await expect(page.locator('#mark')).toHaveText('Made with fmIDECC BY 4.0');
  await expect(page.locator('#periodNote')).toHaveText('Numbers for Period 2');
  // The numbers on the canvas are period 2's (Volume 1100 there), the card's periods 2 and 3.
  await expect(page.locator('#world .cv-node[data-id="n29"] text.value')).toHaveText('📈 1100');
  await V(page, () => fmViewer.openCard('c4', 'n31'));
  await expect(page.locator('#card .card-values tr')).toHaveText([/Period 2\s*13,200/, /Period 3\s*15,000/]);
  // A showcase on its own is laid over the model open; a recipe is refused.
  const only = readFixture('viewer', 'every-kind.showcase.json');
  only.canvases = { show: ['c3'] };
  const dir = test.info().outputPath('files');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'only-block.json'), JSON.stringify(only));
  await page.setInputFiles('#fileInput', path.join(dir, 'only-block.json'));
  await expect.poll(() => V(page, () => fmViewer.state().canvases.join())).toBe('c3');
  await page.setInputFiles('#fileInput', fixture('formats', 'showcase-recipe-v1.json'));
  await expect(page.locator('#notices .note.err')).toContainText('That is a recipe');
  // Another kind of file: refused with where it belongs.
  await page.setInputFiles('#fileInput', fixture('formats', 'functions.json'));
  await expect(page.locator('#notices .note.err').last()).toContainText('another kind');
  expect(await V(page, () => fmViewer.state().canvases.join())).toBe('c3');
  expect(pageErrors).toEqual([]);
});

test('a viewer made for one model opens from disk on its showcase, with nothing requested', async ({ browser }) => {
  const doc = JSON.parse(fs.readFileSync(EVERY, 'utf8'));
  const sc = readFixture('viewer', 'every-kind.showcase.json');
  sc.mark = false;
  // A name that would close the block early if the < were written as it is.
  doc.system.canvases[2].nodes.find(n => n.id === 'n31').text = 'Revenue </script><script>window.__ran = 1</script>\n0';
  const file = madeViewer(test.info().outputPath('made'), sc, doc);
  const { context, page, outside, errors } = await fromDisk(browser, file);
  try{
    await page.waitForFunction(() => fmViewer.state().loaded);
    expect(await V(page, () => fmViewer.state())).toMatchObject({ title: 'Every kind of node', canvases: ['c4', 'c2'], canvas: 'c4', mark: false });
    await expect(page.locator('#welcome')).toBeHidden();
    await expect(page.locator('#mark')).toBeHidden();
    expect(await V(page, () => window.__ran)).toBeUndefined();
    await expect(page.locator('#world .cv-node[data-id="n31"]')).toContainText('</script><script>w');
    expect(await page.locator('script').count()).toBe(3); // the two data blocks and the app's own
    // The model is read, never changed: its text after looking around is as it was.
    await page.locator('#btnZoomIn').click();
    await V(page, () => fmViewer.openCard('c4', 'n55'));
    expect(await V(page, () => fmViewer.modelText() === fmViewer.modelTextAtLoad())).toBe(true);
    expect(outside).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('every canvas is drawn as fmIDE draws it: boxes, arrow ends and values', async ({ page, browser }) => {
  // fmIDE's drawing of the same document.
  const ctx = await browser.newContext();
  await ctx.route('**/*', route => route.request().url() === 'http://local.test/fmIDE.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmIDE.html')) })
    : route.abort());
  const ide = await ctx.newPage();
  await ide.goto('http://local.test/fmIDE.html');
  await ide.waitForFunction(() => window.fm && fm.nodes);
  const [chooser] = await Promise.all([ide.waitForEvent('filechooser'), ide.evaluate(() => fm.command('openDocument'))]);
  await chooser.setFiles(EVERY);
  await expect.poll(() => ide.evaluate(() => fm.canvases().length)).toBe(3);
  await openViewer(page);
  await openFiles(page, [EVERY]);
  for(const c of ['c2', 'c3', 'c4']){
    for(const period of [0, 1, 2]){
      const want = await ide.evaluate(([id, p]) => {
        fm.switchCanvas('#' + id); fm.setPeriod(p + 1);
        return {
          nodes: [...document.querySelectorAll('#canvas .node')].map(el => ({ id: el.dataset.id, auto: !!(fm.nodes().find(n => n.id === el.dataset.id) || {}).auto, box: [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight],
            value: (el.querySelector('.label .line-value') || {}).textContent || null })),
          edges: [...document.querySelectorAll('svg#edges g.edge')].map(g => g.querySelector('path.line').getAttribute('d')),
          values: fm.nodes().filter(n => n.type === 'value').map(n => { try{ return { id: n.id, v: fm.getValue({ node: n.id }) }; }catch(e){ return { id: n.id, v: null }; } }),
        };
      }, [c, period]);
      await V(page, (id) => fmViewer.showCanvas(id), c);
      const mine = await V(page, () => fmViewer.layout());
      // Boxes: the same for every node (automatic plug aliases by place: fmIDE makes them anew).
      for(const n of want.nodes){
        const m = mine.nodes.find(x => x.id === n.id) || mine.nodes.find(x => x.type === 'alias' && x.x === n.box[0] && x.y === n.box[1]);
        expect(m, c + ' ' + n.id).toBeTruthy();
        expect([m.x, m.y, m.w, m.h], c + ' ' + n.id).toEqual(n.box);
      }
      expect(mine.nodes.length, c).toBe(want.nodes.length);
      // Arrows: each of fmIDE's has one of the viewer's with the same ends, within a pixel.
      const left = mine.edges.map(e => numbersOf(e.d));
      for(const d of want.edges){
        const i = left.findIndex(x => close(x, numbersOf(d)));
        expect(i, c + ': ' + d).toBeGreaterThanOrEqual(0);
        left.splice(i, 1);
      }
      expect(left, c).toEqual([]);
      if(period === 0){
        // Values: fmIDE's calculation in every period, and the value text on the canvas.
        const texts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#world .cv-node')].map(g => [g.dataset.id, (g.querySelector('text.value') || {}).textContent || null])));
        for(const n of want.nodes.filter(x => x.value !== null && x.id in texts)) expect(texts[n.id], c + ' ' + n.id).toBe(n.value);
      }
      for(const v of want.values){
        const mineV = await V(page, ([cid, nid, p]) => fmViewer.value(cid, nid, p), [c, v.id, period]);
        if(typeof v.v === 'number') expect(mineV, c + ' ' + v.id + ' period ' + (period + 1)).toBeCloseTo(v.v, 9);
      }
    }
  }
  // The block's ports and the function's: arrows end on the dots.
  await V(page, () => fmViewer.showCanvas('c4'));
  const L = await V(page, () => fmViewer.layout());
  expect(L.edges.find(e => e.from === 'n31' && e.to === 'n64').d).toMatch(/L 688 257$/);
  expect(L.edges.find(e => e.from === 'n64').d).toMatch(/^M 862 257 /);
  expect(L.edges.find(e => e.from === 'n68').d).toMatch(/^M 862 757 /);
  await ctx.close();
});

test('a rectangle\'s card says how it is worked out, and goes to what it reads', async ({ page }) => {
  await openViewer(page);
  await openFiles(page, [EVERY, SHOWCASE]);
  const card = page.locator('#card');
  const open = (c, n) => V(page, ([a, b]) => fmViewer.openCard(a, b), [c, n]);
  // A tap on a rectangle opens its card.
  await page.locator('#world .cv-node[data-id="n31"]').click();
  await expect(card).toBeVisible();
  await expect(page.locator('#cardTitle')).toHaveText('Revenue');
  await expect(page.locator('#cardWhere')).toHaveText('Model · $');
  await expect(card.locator('.card-formula')).toHaveText(['Revenue = Price × Volume', 'Revenue = $12.00 × 1100   (Period 2)']);
  await expect(card.locator('.card-input-name')).toHaveText(['Price', 'Volume']);
  await expect(page.locator('#world .cv-node.picked')).toHaveAttribute('data-id', 'n31');
  await expect(page.locator('#world .cv-node.reads')).toHaveCount(2);
  // An input.
  await open('c4', 'n28');
  await expect(card.locator('.card-kind')).toHaveText('An input: a number typed into the model.');
  await expect(card.locator('.card-values tr')).toHaveText([/Period 2\s*\$12\.00/, /Period 3\s*\$12\.00/]);
  // Named inputs, a period shift, a function, a block's output, an error.
  await open('c4', 'n47');
  await expect(card.locator('.card-formula').first()).toHaveText('Chosen = if(condition: Switch, then: Revenue, else: Price)');
  await open('c4', 'n42');
  await expect(card.locator('.card-formula').first()).toHaveText('Revenue before = Revenue in the period before');
  await expect(card.locator('.card-formula').nth(1)).toHaveText('Revenue before = 12,000   (Period 2)');
  await open('c4', 'n69');
  await expect(card.locator('.card-formula').first()).toHaveText('Margin = Margin(Revenue, Tax)');
  await open('c4', 'n65');
  await expect(card.locator('.card-formula').first()).toHaveText('Block share = Out of Block');
  await open('c4', 'n75');
  await expect(card.locator('.card-note.card-error')).toContainText('something it reads could not be worked out');
  await open('c4', 'n74');
  await expect(card.locator('.card-note.card-error')).toContainText('an invalid result');
  await open('c4', 'n38');
  await expect(card.locator('.card-formula').first()).toHaveText('Sales = Volume + Extra sales');
  // Going to an input on another canvas: Tax reads Tax rate, on Inputs, through an alias.
  await open('c4', 'n55');
  await expect(card.locator('.card-input-name')).toHaveText(['Tax rate', 'Revenue']);
  await card.locator('.card-input', { hasText: 'Tax rate' }).click();
  expect(await V(page, () => fmViewer.state())).toMatchObject({ canvas: 'c2', card: { canvasId: 'c2', nodeId: 'n19' } });
  await expect(page.locator('#cardTitle')).toHaveText('Tax rate');
  await expect(card.locator('.card-values tr').first()).toHaveText(/25\.0%/);
  // A canvas not shown: said, and not gone to.
  const sc = readFixture('viewer', 'every-kind.showcase.json');
  sc.canvases = { show: ['c4'] };
  const file = test.info().outputPath('model-only.json');
  fs.writeFileSync(file, JSON.stringify(sc));
  await openFiles(page, [EVERY, file]);
  await open('c4', 'n55');
  const hidden = card.locator('.card-input', { hasText: 'Tax rate' });
  await expect(hidden).toBeDisabled();
  await expect(hidden).toContainText('on a canvas not shown here');
  expect(await V(page, () => fmViewer.goTo('c2', 'n19'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});

test('pan, zoom and Fit; nothing a visitor does changes the model, and nothing can edit it', async ({ page }) => {
  await openViewer(page);
  await openFiles(page, [EVERY, SHOWCASE]);
  const view = () => V(page, () => fmViewer.view());
  const stage = await page.locator('#stage').boundingBox();
  const fitted = await view();
  // A drag on the canvas pans it.
  await page.mouse.move(stage.x + 40, stage.y + stage.height - 60);
  await page.mouse.down();
  await page.mouse.move(stage.x + 140, stage.y + stage.height - 10, { steps: 5 });
  await page.mouse.up();
  let v = await view();
  expect(v.x).toBeCloseTo(fitted.x - 100 / fitted.zoom, 5);
  expect(v.y).toBeCloseTo(fitted.y - 50 / fitted.zoom, 5);
  expect(await V(page, () => fmViewer.state().card)).toBeNull(); // a drag opens no card
  // Dragging a rectangle moves the view, not the rectangle.
  const before = (await V(page, () => fmViewer.layout())).nodes.find(n => n.id === 'n31');
  const box = await page.locator('#world .cv-node[data-id="n31"] .box').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 60, { steps: 4 }); await page.mouse.up();
  expect((await V(page, () => fmViewer.layout())).nodes.find(n => n.id === 'n31')).toEqual(before);
  // The wheel zooms about the pointer; + and − and the keys; the limits; Fit.
  v = await view();
  await page.mouse.move(stage.x + 200, stage.y + 150);
  await page.mouse.wheel(0, -100);
  const w = await view();
  expect(w.zoom).toBeCloseTo(v.zoom * 1.25, 5);
  expect(w.x + 200 / w.zoom).toBeCloseTo(v.x + 200 / v.zoom, 5);
  for(let i = 0; i < 20; i++) await page.locator('#btnZoomIn').click();
  expect((await view()).zoom).toBe(4);
  for(let i = 0; i < 30; i++) await page.locator('#btnZoomOut').click();
  expect((await view()).zoom).toBeCloseTo(0.1, 9);
  await page.locator('#btnFit').click();
  expect(await view()).toEqual(fitted);
  // Each canvas keeps its own view.
  await page.locator('#btnZoomIn').click();
  const zoomed = await view();
  await page.locator('#canvasTabs .canvas-tab', { hasText: 'Inputs' }).click();
  await page.locator('#canvasTabs .canvas-tab', { hasText: 'Model' }).click();
  expect(await view()).toEqual(zoomed);
  // No editing control exists: no text box, nothing editable, only the file box.
  expect(await page.locator('textarea, select, [contenteditable]').count()).toBe(0);
  expect(await page.locator('input').evaluateAll(els => els.map(e => e.id))).toEqual(['fileInput']);
  await page.keyboard.press('Delete'); await page.keyboard.press('Control+z'); await page.keyboard.press('Control+x');
  expect(await V(page, () => fmViewer.modelText() === fmViewer.modelTextAtLoad())).toBe(true);
});

test('a pinch zooms about the fingers, one finger pans, a tap opens a card', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  await context.route('**/*', route => route.request().url() === 'http://local.test/fmViewer.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html')) })
    : route.abort());
  const page = await context.newPage();
  await page.goto('http://local.test/fmViewer.html');
  await page.waitForFunction(() => !!window.fmViewer);
  await openFiles(page, [EVERY, SHOWCASE]);
  const types = await T.watchPointerTypes(page);
  const stage = await page.locator('#stage').boundingBox();
  const v0 = await V(page, () => fmViewer.view());
  const two = await T.twoFingers(page);
  const mid = { x: stage.x + 300, y: stage.y + 200 };
  await two.down({ x: mid.x - 50, y: mid.y }, { x: mid.x + 50, y: mid.y });
  await two.pinch({ x: mid.x - 100, y: mid.y }, { x: mid.x + 100, y: mid.y });
  await two.up();
  const v1 = await V(page, () => fmViewer.view());
  expect(v1.zoom).toBeCloseTo(v0.zoom * 2, 2);
  expect(v1.x + 300 / v1.zoom).toBeCloseTo(v0.x + 300 / v0.zoom, 1); // the point between the fingers stays put
  // One finger pans.
  const cdp = await context.newCDPSession(page);
  const t = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await t('touchStart', { x: stage.x + 40, y: stage.y + stage.height - 40 });
  for(let i = 1; i <= 5; i++) await t('touchMove', { x: stage.x + 40 + i * 20, y: stage.y + stage.height - 40 });
  await t('touchEnd');
  const v2 = await V(page, () => fmViewer.view());
  expect(v2.x).toBeCloseTo(v1.x - 100 / v1.zoom, 3);
  expect(v2.zoom).toBe(v1.zoom);
  // A tap on a rectangle opens its card.
  await V(page, () => fmViewer.fit());
  const box = await page.locator('#world .cv-node[data-id="n28"] .box').boundingBox();
  await (await T.finger(page)).tap(T.centre(box));
  await expect.poll(() => V(page, () => (fmViewer.state().card || {}).nodeId)).toBe('n28');
  expect(await types()).toEqual(['touch']);
  await context.close();
});

test('hostile files are shown as text: no markup, no colour or font from them, nothing sent', async ({ page, pageErrors }) => {
  await openViewer(page);
  await openFiles(page, [fixture('viewer', 'hostile-model.json'), fixture('viewer', 'hostile-showcase.json')]);
  const s = await V(page, () => fmViewer.state());
  expect(s.canvases).toEqual(['c1']);
  await expect(page.locator('#showTitle')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#showByline')).toHaveText('By <a href=javascript:alert(1)>me</a>');
  await expect(page.locator('#canvasTabs')).toBeHidden(); // one canvas: no tabs
  await expect(page.locator('#notices .note.warn').first()).toContainText('The showcase:');
  // Nothing from the files became an element or a handler.
  expect(await page.locator('img, iframe, a, object, embed').count()).toBe(0);
  expect(await page.locator('script').count()).toBe(3);
  expect(await page.evaluate(() => [...document.querySelectorAll('*')].some(e => [...e.attributes].some(a => /^on/i.test(a.name))))).toBe(false);
  await expect(page.locator('#world .cv-node[data-id="n1"] text.name').first()).toContainText('<img src=x');
  await expect(page.locator('#world .cv-node[data-id="n3"] text.name').first()).toContainText('<svg><script>');
  // The style: a fill, border and font that aren't colours or names are not used.
  const look = await page.locator('#world .cv-node[data-id="n1"]').evaluate(g => {
    const box = g.querySelector('.box'), name = g.querySelector('text.name');
    return { fill: box.style.fill, stroke: box.style.stroke, width: box.style.strokeWidth, dash: box.style.strokeDasharray, family: name.style.fontFamily, size: name.style.fontSize, colour: name.style.fill };
  });
  expect(look).toEqual({ fill: '', stroke: '', width: '', dash: '', family: '', size: '', colour: '' });
  // Coordinates forced into the canvas; an odd id kept as a value, never markup.
  const L = await V(page, () => fmViewer.layout());
  for(const n of L.nodes) for(const k of ['x', 'y', 'w', 'h']) expect(Number.isFinite(n[k]) && Math.abs(n[k]) <= 100000, n.id + ' ' + k).toBe(true);
  expect(L.nodes.find(n => n.id === 'n1')).toMatchObject({ x: 0, y: 100000, w: 170, h: 64 });
  expect(L.nodes.find(n => n.id === 'n7')).toMatchObject({ x: 0, y: -100000, w: 5000, h: 5000 });
  expect(await page.locator('#world .cv-node').evaluateAll(els => els.map(e => e.dataset.id))).toContain('n5"><script>alert(1)</script>');
  // Its card: text only too.
  await V(page, () => fmViewer.openCard('c1', 'n3'));
  await expect(page.locator('#cardTitle')).toHaveText('<svg><script>alert(1)</script></svg>');
  expect(await page.locator('#card script, #card svg').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('on a phone: the canvases in a menu, the card from the bottom of the screen', async ({ browser }) => {
  const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const context = await browser.newContext(PHONE);
  await context.route('**/*', route => route.request().url() === 'http://local.test/fmViewer.html'
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html')) })
    : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://local.test/fmViewer.html');
  await page.waitForFunction(() => !!window.fmViewer);
  expect(await page.evaluate(() => document.body.classList.contains('phone'))).toBe(true);
  await openFiles(page, [EVERY, SHOWCASE]);
  await expect(page.locator('#canvasTabs')).toBeHidden();
  const menuBtn = page.locator('#btnCanvasMenu');
  await expect(menuBtn).toBeVisible();
  await expect(menuBtn).toContainText('Model');
  const f = await T.finger(page);
  await f.tap(T.centre(await menuBtn.boundingBox()));
  await expect(page.locator('#canvasMenu')).toBeVisible();
  await expect(page.locator('#canvasMenu button')).toHaveText(['Model', 'Inputs']);
  await f.tap(T.centre(await page.locator('#canvasMenu button', { hasText: 'Inputs' }).boundingBox()));
  await expect.poll(() => V(page, () => fmViewer.state().canvas)).toBe('c2');
  await expect(page.locator('#canvasMenu')).toBeHidden();
  // Every button is big enough for a finger.
  for(const id of ['#btnZoomIn', '#btnZoomOut', '#btnFit', '#btnCanvasMenu', '#btnOpen']){
    const b = await page.locator(id).boundingBox();
    expect(b.height, id).toBeGreaterThanOrEqual(40);
  }
  // A tap on a rectangle: its card from the bottom, the whole width.
  const box = await page.locator('#world .cv-node[data-id="n19"] .box').boundingBox();
  await f.tap(T.centre(box));
  await expect(page.locator('#card')).toBeVisible();
  const c = await page.locator('#card').boundingBox();
  expect(Math.round(c.y + c.height)).toBe(844);
  expect(Math.round(c.width)).toBe(390);
  // No page scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
  await context.close();
});

test('the viewer is made from shared code and its own: nothing of ExcelExporter\'s, nothing of fmGraph\'s yet', () => {
  const { appSources } = require('../tools/build.js');
  const viewer = appSources().find(a => a.app === 'fmViewer');
  expect(viewer.out).toBe('apps/fmViewer.html');
  expect(viewer.files.filter(f => f.startsWith('src/excel-exporter/'))).toEqual([]);
  expect(viewer.files.filter(f => f.startsWith('src/fmgraph/') || f.startsWith('src/fmide/'))).toEqual([]);
  expect(viewer.files).toEqual(expect.arrayContaining(['src/shared/canvas-view.js', 'src/shared/showcase.js', 'src/viewer/index.html']));
  // The licence notice stays at the top of the page.
  expect(fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8').split('\n')[2]).toMatch(/^<!-- fmShowcase — Copyright 2026 .* Apache License 2\.0/);
});

test('on the site: the viewer\'s page runs under its own security policy, offline, with nothing sent', async ({ browser }) => {
  const W = require('./helpers/site');
  const site = await W.startSiteServer();
  const context = await browser.newContext();
  const seen = [];
  context.on('request', r => seen.push(r.url()));
  try{
    const page = await context.newPage();
    const violations = [];
    page.on('console', m => { if(/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
    const headers = fs.readFileSync(path.join(site.dir, '_headers'), 'utf8');
    expect(headers).toMatch(/\/fmViewer\.html\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-[^']+'; style-src/);
    await page.goto(site.origin + 'fmViewer.html');
    await page.waitForFunction(() => !!window.fmViewer);
    await openFiles(page, [EVERY, SHOWCASE]);
    await expect(page.locator('#world .cv-node')).toHaveCount(25);
    expect(violations).toEqual([]);
    expect(seen.filter(u => !u.startsWith(site.origin))).toEqual([]);
  } finally {
    await context.close();
    await site.close().catch(() => {});
    fs.rmSync(site.dir, { recursive: true, force: true });
  }
});
