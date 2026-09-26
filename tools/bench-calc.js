#!/usr/bin/env node
// Times fmIDE's calculation (fm.evaluate: every canvas, every period, then one redraw) on the
// biggest sample model and on a large generated one, so a change to the calculation can be
// checked for speed before and after. Uses the dev-only Playwright from `npm install`; the
// app is opened straight from apps/fmIDE.html, offline.
//   node tools/bench-calc.js [runs]        (npm run bench)
// Prints the median and fastest time per model. Timings vary between machines: compare
// runs made on the same one.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const RUNS = Math.max(3, Number(process.argv[2]) || 15);

// A large model, the same every time: 20 canvases of about 100 rectangles and operators each
// (inputs, chains of calculations, corkscrews through period shifts, an alias to the canvas
// before), a block definition with a corkscrew inside, and on every canvas two block
// instances and one vertical block instance; 24 periods (BENCH_PERIODS changes it).
function largeModel(){
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const PERIODS = Number(process.env.BENCH_PERIODS) || 24, CANVASES = 20;
  const canvases = [];
  const V = (id, x, y, text, extra) => Object.assign({ id, type: 'value', x, y, text }, extra || {});
  const O = (id, x, y, text) => ({ id, type: 'operator', x, y, text });
  const S = (id, x, y) => ({ id, type: 'periodShift', x, y, shift: -1 });

  // The block: In → (opening + In × rate) → Out, with its own corkscrew.
  canvases.push({ id: 'cBlock', name: 'Block', nodes: [
    V('bin', 0, 0, 'In', { blockRole: 'input' }), V('brate', 0, 100, 'Rate\n0.1'),
    O('bmul', 100, 50, '×'), V('bopen', 200, 150, 'Opening\n0'), S('bsh', 300, 200),
    O('badd', 300, 50, '+'), V('bout', 400, 50, 'Out', { blockRole: 'output', verticalReducer: 'sum' }),
  ], edges: [
    { id: 'be1', from: 'bin', to: 'bmul' }, { id: 'be2', from: 'brate', to: 'bmul' },
    { id: 'be3', from: 'bmul', to: 'badd' }, { id: 'be4', from: 'bopen', to: 'badd' },
    { id: 'be5', from: 'badd', to: 'bout' }, { id: 'be6', from: 'bout', to: 'bsh' }, { id: 'be7', from: 'bsh', to: 'bopen' },
  ] });

  for(let c = 0; c < CANVASES; c++){
    const nodes = [], edges = [];
    let e = 0;
    const edge = (from, to, extra) => edges.push(Object.assign({ id: 'e' + (e++), from, to }, extra || {}));
    const rects = [];
    for(let i = 0; i < 10; i++){
      const id = 'in' + i;
      nodes.push(V(id, 0, i * 80, 'Input ' + i + '\n' + (1 + Math.floor(rnd() * 9)),
        i % 3 === 0 ? { periodValues: Array.from({ length: PERIODS }, () => 1 + Math.floor(rnd() * 9)) } : null));
      rects.push(id);
    }
    if(c > 0){
      nodes.push({ id: 'al', type: 'alias', x: 0, y: 900, sourceCanvasId: 'c' + (c - 1), sourceNodeId: 'r29' });
      nodes.push(V('fromPrev', 100, 900, 'From previous'));
      edge('al', 'fromPrev');
      rects.push('fromPrev');
    }
    const ops = ['+', '×', '−', '+', 'max', 'ave'];
    for(let i = 0; i < 30; i++){
      const a = rects[Math.floor(rnd() * rects.length)], b = rects[Math.floor(rnd() * rects.length)];
      nodes.push(O('o' + i, 200 + i * 30, 50 + (i % 10) * 70, ops[i % ops.length]));
      edge(a, 'o' + i); if(b !== a) edge(b, 'o' + i);
      nodes.push(V('r' + i, 260 + i * 30, 50 + (i % 10) * 70, 'Calc ' + i));
      edge('o' + i, 'r' + i);
      rects.push('r' + i);
    }
    for(let k = 0; k < 3; k++){
      const p = 'k' + k + '_';
      nodes.push(V(p + 'open', 1300, k * 200, 'Opening ' + k + '\n100'), S(p + 'sh', 1500, k * 200 + 100),
        O(p + 'add', 1400, k * 200, '+'), O(p + 'sub', 1450, k * 200, '−'), V(p + 'close', 1550, k * 200, 'Closing ' + k));
      edge(p + 'open', p + 'add'); edge(rects[10 + k], p + 'add');
      edge(p + 'add', p + 'sub'); edge('in' + (k + 1), p + 'sub');
      edge(p + 'sub', p + 'close'); edge(p + 'close', p + 'sh'); edge(p + 'sh', p + 'open');
    }
    for(let b = 0; b < 3; b++){
      const vertical = b === 2;
      nodes.push({ id: 'bi' + b, type: 'blockInstance', x: 1700, y: b * 200, blockDefCanvasId: 'cBlock', vertical });
      edge('r' + (5 + b), 'bi' + b, { toPort: 0, verticalIndexed: vertical });
      nodes.push(V('bo' + b, 1900, b * 200, 'Block out ' + b));
      edge('bi' + b, 'bo' + b, { fromPort: 0 });
    }
    canvases.push({ id: 'c' + c, name: 'Sheet ' + (c + 1), nodes, edges });
  }
  return { kind: 'system', version: 4, periods: Array.from({ length: PERIODS }, (_, i) => 'P' + (i + 1)), canvases };
}

async function timeModel(page, file){
  await page.goto(pathToFileURL(path.join(ROOT, 'apps', 'fmIDE.html')).href);
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('loadSystem'))]);
  await chooser.setFiles(file);
  // Answer any question (e.g. "replace the current model?") and close any message.
  for(let i = 0; i < 5; i++){
    const box = page.locator('.modal-box').last();
    try{ await box.waitFor({ state: 'visible', timeout: 1000 }); }catch(e){ break; }
    await box.locator('button').first().waitFor();
    if(await box.locator('button.danger').count()) await box.locator('button.danger').click();
    else await box.locator('.modal-actions button').first().click();
    await page.waitForTimeout(100);
  }
  const count = JSON.parse(fs.readFileSync(file, 'utf8')).canvases.length;
  await page.waitForFunction((n) => fm.canvases().length === n, count);
  return page.evaluate((runs) => {
    fm.evaluate(); // warm up
    const times = [];
    for(let i = 0; i < runs; i++){
      const t = performance.now();
      fm.evaluate();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    return { median: times[Math.floor(times.length / 2)], fastest: times[0] };
  }, RUNS);
}

async function main(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-bench-'));
  const large = path.join(tmp, 'large-model.json');
  const model = largeModel();
  fs.writeFileSync(large, JSON.stringify(model));
  const nodeCount = model.canvases.reduce((s, c) => s + c.nodes.length, 0);
  const cases = [
    ['combined-bs-corkscrew-block.json (biggest sample: 33 nodes, 3 periods)', path.join(ROOT, 'tests', 'fixtures', 'models', 'combined-bs-corkscrew-block.json')],
    [`generated large model (${nodeCount} nodes, ${model.canvases.length} canvases, ${model.periods.length} periods)`, large],
  ];
  const browser = await chromium.launch();
  try{
    const page = await browser.newPage();
    // Offline, like the tests: nothing but the file itself may load.
    await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
    console.log(`fm.evaluate(), ${RUNS} runs each:`);
    for(const [label, file] of cases){
      const r = await timeModel(page, file);
      console.log(`  ${label}: median ${r.median.toFixed(2)} ms, fastest ${r.fastest.toFixed(2)} ms`);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { largeModel };
if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
