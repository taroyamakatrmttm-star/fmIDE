// 92. fmGraph's board kept as it was, and its board engine (phase V2 of docs/viewer-brief.md).
// The showcase viewer takes fmGraph's drawing of bars and charts 窶・the "board engine" 窶・without
// fmGraph's editing. To share it, fmGraph's fragments were split into the engine and fmGraph's
// own page and editing. These tests were written first, against fmGraph before the split, and
// hold it unchanged:
// - fmGraph's page, element by element, for a model with every kind of bar, chart and slider
//   (tests/fixtures/viewer/every-widget.fmide, made with fmGraph's own API), in several states,
//   on a desk and on a phone, compared with snapshots taken before the split;
// - window.fmGraph's commands, and every function fmGraph defined then, still there.
// Then, in Node, the separation itself:
// - the board engine's fragments (ENGINE) use nothing defined only in fmGraph's page and editing
//   fragments, except the page interface (PAGE_INTERFACE: what each app that draws boards
//   defines for itself), and fmGraph defines every name of it;
// - they do nothing when they load: declarations only, so a page can take them in.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, openApp, ROOT } = require('./helpers/apps');

const EVERY_WIDGET = fixture('viewer', 'every-widget.fmide');
const FMGRAPH_JS = path.join(ROOT, 'src', 'fmgraph', 'js');
// The board engine: fmGraph's fragments the showcase viewer takes in (src/viewer/js/01-core.js).
const ENGINE = ['01b-numbers.js', '02-model.js', '03-calc.js', '04-board.js', '04a-board-file.js', '04b-charts.js', '04d-scale.js',
  '04e-colours.js', '04f-free.js', '05-render.js', '05b-chart-render.js', '05d-explore.js', '05e-compare.js', '05f-scenarios.js',
  '05k-shared-period.js', '05m-play.js', '05n-free-chart.js', '06a-sample.js'];
// The names the engine calls that each page defines for itself (.claude/rules/fmgraph.md).
const PAGE_INTERFACE = ['$', 'make', 'notify', 'isPhone', 'renderBoard', 'updateValues', 'scheduleUpdate', 'renderCompareBar',
  'paintMark', 'paintPlay', 'renderPlayBar', 'rectKeySwatch', 'chartKeySwatch', 'freeGridHook'];

// Each fragment's top-level names, and the names a fragment uses (outside comments and strings,
// not after a dot), less those it declares itself anywhere (a local `const back`).
function fragments(){
  const out = new Map();
  fs.readdirSync(FMGRAPH_JS).filter(f => f.endsWith('.js')).sort().forEach(f => {
    const text = fs.readFileSync(path.join(FMGRAPH_JS, f), 'utf8');
    const top = new Set([...text.matchAll(/^(?:async )?(?:function\*? |const |let |var )([A-Za-z0-9_$]+)/gm)].map(m => m[1]));
    const code = text.replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`(?:[^`\\]|\\.)*`/g, '``').replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    const own = new Set([...code.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
    const used = new Set([...code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
    out.set(f, { text, top, own, used });
  });
  return out;
}

// The page as text: each element's tag, id, classes and attributes, the state of its controls
// and its own text, one line each, indented by depth. Numbers in attributes are rounded to 0.01,
// so a drawing's coordinates read the same however the browser writes them.
async function pageText(page){
  return page.evaluate(() => {
    const round = (v) => v.replace(/-?\d+\.\d+(?:e-?\d+)?/g, (n) => { const r = Math.round(Number(n) * 100) / 100; return String(Object.is(r, -0) ? 0 : r); });
    const lines = [];
    const walk = (el, depth) => {
      if(el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      const attrs = [...el.attributes].map(a => a.name + '=' + JSON.stringify(round(a.value))).sort();
      if(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement){
        attrs.push('.value=' + JSON.stringify(el.value));
        if(el.type === 'checkbox' || el.type === 'radio') attrs.push('.checked=' + el.checked);
      }
      if(el instanceof HTMLDetailsElement) attrs.push('.open=' + el.open);
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
      lines.push('  '.repeat(depth) + el.tagName.toLowerCase() + (attrs.length ? ' ' + attrs.join(' ') : '') + (own ? ' | ' + own : ''));
      [...el.children].forEach(c => walk(c, depth + 1));
    };
    walk(document.body, 0);
    return lines.join('\n') + '\n';
  });
}

async function openEveryWidget(page){
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const text = fs.readFileSync(EVERY_WIDGET, 'utf8');
  expect(await page.evaluate((t) => fmGraph.load(t, 'Every widget'), text)).toBe(true);
  await expect(page.locator('.chart-widget')).toHaveCount(7);
  await settle(page);
}
// Wait until nothing is still being worked out or drawn: the Tornado and Spider are worked out
// once the sliders stop, and a moved slider's reach stops being lit 1.5 s after it moved
// (quietSoon in fmGraph).
async function settle(page){
  await page.waitForTimeout(1700);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
const sliderId = (page, name) => page.evaluate((n) => fmGraph.board().sliders.find(s => s.name === n).id, name);

test.describe('fmGraph\'s page stays as it was', () => {
  test.use({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });

  test('every kind of bar, chart and slider, in four states', async ({ page, pageErrors }) => {
    await openEveryWidget(page);
    const parts = ['=== as opened\n' + await pageText(page)];
    // The sliders moved.
    await page.evaluate(([p, v]) => { fmGraph.setSlider(p, 12); fmGraph.setSlider(v, 10); }, [await sliderId(page, 'Price'), await sliderId(page, 'Volume')]);
    await settle(page);
    parts.push('=== sliders moved\n' + await pageText(page));
    // A pinned, a slider moved again, a Trace on the first bar, a scenario as A.
    const firstBar = await page.evaluate(() => document.querySelector('.bar-widget').dataset.id);
    await page.evaluate(([p, bar]) => { fmGraph.pinA(); fmGraph.setSlider(p, 14); fmGraph.trace(bar); }, [await sliderId(page, 'Price'), firstBar]);
    await settle(page);
    parts.push('=== A pinned, traced\n' + await pageText(page));
    // Play, held still at its "to" end (reduced motion), then the second board while it plays.
    await page.evaluate(() => { fmGraph.trace(null); fmGraph.unpinA(); fmGraph.resetAll(); fmGraph.play({ from: 'model', to: 'Big year' }); });
    await settle(page);
    // Stepped there and back once the Tornado and Spider are worked out: on a slower run they are
    // worked out after Play's first paint, and that redraw takes the lit reach away (fmGraph does
    // this today; reported with phase V2), so the page is written down after a paint of its own.
    await page.evaluate(() => { fmGraph.stepPlay(); fmGraph.stepPlay(); });
    await settle(page);
    parts.push('=== playing, still\n' + await pageText(page));
    await page.evaluate(() => { fmGraph.stopPlay(); fmGraph.showScenario('High price'); fmGraph.showBoard(1); });
    await settle(page);
    parts.push('=== a scenario shown, the second board\n' + await pageText(page));
    expect(parts.join('')).toMatchSnapshot('fmgraph-every-widget.txt');
    expect(pageErrors).toEqual([]);
  });
});

test('on a phone: the dock and the board, as they were', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' });
  const url = 'http://local.test/fmGraph.html';
  await context.route('**/*', route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) })
    : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.fmGraph);
  expect(await page.evaluate((t) => fmGraph.load(t, 'Every widget'), fs.readFileSync(EVERY_WIDGET, 'utf8'))).toBe(true);
  await expect(page.locator('body.phone')).toHaveCount(1);
  await settle(page);
  const parts = ['=== as opened\n' + await pageText(page)];
  await page.evaluate((p) => fmGraph.setSlider(p, 12), await sliderId(page, 'Price'));
  await settle(page);
  parts.push('=== a slider moved\n' + await pageText(page));
  expect(parts.join('')).toMatchSnapshot('fmgraph-every-widget-phone.txt');
  expect(errors).toEqual([]);
  await context.close();
});

test('window.fmGraph keeps every command, and fmGraph every function it had', async ({ page }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  const commands = await page.evaluate(() => Object.keys(window.fmGraph).sort());
  expect(commands.join('\n') + '\n').toMatchSnapshot('fmgraph-api.txt');
  // Every function fmGraph's built file defined before the split (names only; new ones may come).
  const built = fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html'), 'utf8');
  const names = [...new Set([...built.matchAll(/^\s*(?:async )?function\*? ([A-Za-z0-9_$]+)\(/gm)].map(m => m[1]))].sort();
  const file = path.join(ROOT, 'tests', 'snapshots', 'fmgraph-functions.txt');
  if(!fs.existsSync(file)) fs.writeFileSync(file, names.join('\n') + '\n');
  const before = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  expect(before.filter(n => !names.includes(n)), 'functions fmGraph no longer defines').toEqual([]);
});

test.describe('the board engine, in Node', () => {
  test('uses nothing of fmGraph\'s page or editing but the page interface, which fmGraph defines', () => {
    const all = fragments();
    ENGINE.forEach(f => expect(all.has(f), f).toBe(true));
    const inEngine = new Set(ENGINE.flatMap(f => [...all.get(f).top]));
    const outside = new Map(); // name → the fmGraph-only fragment defining it
    all.forEach((v, f) => { if(!ENGINE.includes(f)) v.top.forEach(n => { if(!inEngine.has(n)) outside.set(n, f); }); });
    const wrong = [], interfaceUsed = new Set();
    ENGINE.forEach(f => {
      const { used, own } = all.get(f);
      used.forEach(n => {
        if(!outside.has(n) || own.has(n)) return;
        if(PAGE_INTERFACE.includes(n)) interfaceUsed.add(n);
        else wrong.push(f + ' uses ' + n + ' (' + outside.get(n) + ')');
      });
    });
    expect(wrong, 'engine fragments reaching into fmGraph\'s page or editing').toEqual([]);
    // Every name of the page interface is used by the engine, and fmGraph's page defines it.
    expect(PAGE_INTERFACE.filter(n => !interfaceUsed.has(n)), 'page-interface names the engine no longer uses').toEqual([]);
    expect(PAGE_INTERFACE.filter(n => !outside.has(n)), 'page-interface names fmGraph doesn\'t define').toEqual([]);
  });

  test('does nothing when it loads: declarations only', () => {
    ENGINE.forEach(f => {
      const lines = fs.readFileSync(path.join(FMGRAPH_JS, f), 'utf8').split('\n');
      const running = lines.map((l, i) => [i + 1, l]).filter(([, l]) => l && !/^[ \t]/.test(l)
        && !/^(?:\/\/|(?:async )?function\b|const |let |var |[}\])])/.test(l));
      expect(running.map(([n, l]) => f + ':' + n + ': ' + l.slice(0, 80)), f).toEqual([]);
      // Nor a const whose value wires the page (a listener, an element looked up).
      const wiring = lines.filter(l => /^(?:const|let|var) /.test(l) && /\$\(|document\.|addEventListener/.test(l));
      expect(wiring, f).toEqual([]);
    });
  });

  test('the showcase viewer takes in exactly the engine, defines the page interface, and declares no name twice', () => {
    const { appSources } = require('../tools/build.js');
    const viewer = appSources().find(a => a.app === 'fmViewer');
    const taken = viewer.files.filter(f => f.startsWith('src/fmgraph/'));
    expect(taken.filter(f => f.endsWith('.js'))).toEqual(ENGINE.map(f => 'src/fmgraph/js/' + f));
    expect(taken.filter(f => !f.endsWith('.js'))).toEqual(['src/fmgraph/board.css']);
    // Its own fragments define every name of the page interface.
    const dir = path.join(ROOT, 'src', 'viewer', 'js');
    const own = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const defined = new Set([...own.matchAll(/^(?:async )?(?:function\*? |const |let |var )([A-Za-z0-9_$]+)/gm)].map(m => m[1]));
    expect(PAGE_INTERFACE.filter(n => !defined.has(n))).toEqual([]);
    // The built script: no name declared twice at its top level (its fragments share one scope,
    // where a second function of the same name would silently win).
    const html = fs.readFileSync(path.join(ROOT, 'apps', 'fmViewer.html'), 'utf8');
    const script = html.slice(html.indexOf('(function(){'));
    const names = [...script.matchAll(/^(?:async )?(?:function\*? |const |let |var |class )([A-Za-z0-9_$]+)/gm)].map(m => m[1]);
    expect(names.length).toBeGreaterThan(500);
    expect([...new Set(names.filter((n, i) => names.indexOf(n) !== i))]).toEqual([]);
  });
});
