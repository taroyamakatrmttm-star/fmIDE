// 90. fmGraph's Free chart on ExcelExporter's Dashboard (phase F3 of docs/fmgraph-free-chart.md;
// layout file 11). The owner checked the method in Excel on Windows and the iPad (27 October
// 2026) with a workbook this group first wrote by hand; it now comes from ExcelExporter itself.
// - The owner's case (group 84's balance sheet and cash flow) and an "On CFF" stack resting
//   where CFF ends, built in fmGraph with two sliders, exported as a board file and imported in
//   ExcelExporter: the window lists the chart ("Free · 2027 · 10 pieces · wide"), Use copies it,
//   Generate writes the stacked-column chart (a hidden filler above and below 0 per piece, four
//   series per rectangle, one category per grid column, each rectangle once in the key) and its
//   helper rows. The workbook is kept as tests/output/f3-free-chart-check.xlsx for the owner.
// - At six slider positions (typed on the Dashboard, Use on), the helper rows, worked out from
//   their formulas' text (the import's xlRecalc), give fmGraph's own chart(id) numbers; Excel's
//   stacking of the series draws every rectangle where fmGraph does, except a piece hanging back
//   into the one under it (More at CFO −200), drawn pushed aside and marked "overlaps".
// - ExcelExporter's own reader (no code from fmGraph) puts a hostile file right as fmGraph does:
//   sits it doesn't know, `of` and `check` naming no piece, a loop, two pieces in one column, a
//   column and a level as text, a level past 10⁹, a rectangle not in the model, markup in names.
// - A Free chart needing more than 255 series is listed as not carried.
// - The layout keeps the chart (Export / Import Mapping, version 11).
// - LibreOffice (skipped locally without it) recalculates the workbook to the same numbers.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp } = require('./helpers/apps');
const X = require('./helpers/excel');
const D = require('./helpers/documents');
const { xlRecalc } = require('../src/excel-exporter/import/recalc.js');
const { requireSoffice, recalc, valueOf: cellValue } = require('./helpers/soffice');

// ---------- the owner's case (group 84) and the "On CFF" stack ----------
// Cash EB = BB + CFO + CFF − CFI; Equity = Cash EB + PPE − Loan; Other an input.
const MODEL = { kind: 'system', version: 9, periods: ['P1'], canvases: [{ id: 'c', name: 'C', nodes: [
  { id: 'bb', type: 'value', x: 0, y: 0, text: 'Cash BB\n100' },
  { id: 'cfo', type: 'value', x: 0, y: 100, text: 'CFO\n50' },
  { id: 'cff', type: 'value', x: 0, y: 200, text: 'CFF\n70' },
  { id: 'cfi', type: 'value', x: 300, y: 300, text: 'CFI\n100' },
  { id: 'o1', type: 'operator', x: 150, y: 100, text: '+' },
  { id: 'sub', type: 'value', x: 250, y: 100, text: 'Before CFI' },
  { id: 'o2', type: 'operator', x: 350, y: 150, text: '−' },
  { id: 'eb', type: 'value', x: 450, y: 150, text: 'Cash EB' },
  { id: 'ppe', type: 'value', x: 0, y: 400, text: 'Gross PPE\n380' },
  { id: 'loan', type: 'value', x: 700, y: 500, text: 'Loan\n300' },
  { id: 'o3', type: 'operator', x: 550, y: 300, text: '+' },
  { id: 'gross', type: 'value', x: 650, y: 300, text: 'Gross' },
  { id: 'o4', type: 'operator', x: 750, y: 350, text: '−' },
  { id: 'eq', type: 'value', x: 850, y: 350, text: 'Equity' },
  { id: 'other', type: 'value', x: 0, y: 700, text: 'Other\n40' },
], edges: [
  { id: 'e1', from: 'bb', to: 'o1' }, { id: 'e2', from: 'cfo', to: 'o1' }, { id: 'e3', from: 'cff', to: 'o1' }, { id: 'e4', from: 'o1', to: 'sub' },
  { id: 'e5', from: 'sub', to: 'o2' }, { id: 'e6', from: 'cfi', to: 'o2' }, { id: 'e7', from: 'o2', to: 'eb' },
  { id: 'e8', from: 'eb', to: 'o3' }, { id: 'e9', from: 'ppe', to: 'o3' }, { id: 'e10', from: 'o3', to: 'gross' },
  { id: 'e11', from: 'gross', to: 'o4' }, { id: 'e12', from: 'loan', to: 'o4' }, { id: 'e13', from: 'o4', to: 'eq' },
] }] };
const OWNER = [
  { name: 'Asset', column: 0, sits: { on: 'zero' }, parts: ['Cash EB', 'Gross PPE'] },          // 0
  { name: 'L + Eq', column: 1, sits: { on: 'zero' }, check: 0, parts: ['Loan', 'Equity'] },    // 1
  { name: 'Cash BB', column: 3, sits: { on: 'zero' }, parts: ['Cash BB'] },                   // 2
  { name: 'CFO', column: 4, sits: { on: 'end', of: 2 }, parts: ['CFO'] },                      // 3
  { name: 'CFI', column: 5, sits: { on: 'end', of: 3 }, minus: true, parts: ['CFI'] },         // 4
  { name: 'CFF', column: 6, sits: { on: 'end', of: 4 }, parts: ['CFF'] },                      // 5
  { name: 'Cash EB', column: 7, sits: { on: 'zero' }, check: 5, parts: ['Cash EB'] },          // 6
  { name: 'Target', column: 8, sits: { on: 'level', value: 400 }, parts: ['Loan'] },           // 7
  { name: 'More', column: 1, sits: { on: 'top', of: 1 }, parts: ['CFO'] },                     // 8
  { name: 'On CFF', column: 9, sits: { on: 'end', of: 5 }, parts: ['CFO', 'Other'] },          // 9
];
const TITLE = 'Balance sheet and cash';
const CASES = [
  { title: 'the start (CFO 50, Other 40)', values: { CFO: 50, Other: 40 } },
  { title: 'CFO 80 (group 84)', values: { CFO: 80, Other: 40 } },
  { title: 'CFO −200: CFO crosses 0, Cash EB below 0, Asset on both sides, More overlapping', values: { CFO: -200, Other: 40 } },
  { title: 'Other 150', values: { CFO: 50, Other: 150 } },
  { title: 'Other −150: the On CFF stack crosses 0 from the moving CFF end', values: { CFO: 50, Other: -150 } },
  { title: 'CFO −200 and Other −150', values: { CFO: -200, Other: -150 } },
];
const rect = (id, name) => ({ canvasId: 'c', nodeId: id, name });
const close = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const genStatus = (page) => page.locator('#genStatus .status');
const leftOut = (page) => page.locator('#graphLeftOut li').allTextContents();

// fmGraph with the model, a Free chart and the sliders: { graph, id, sliders, file (the board file) }.
async function fmGraphWith(context, pieces, sliders){
  const graph = await context.newPage();
  await openApp(graph, 'fmGraph');
  await graph.waitForFunction(() => !!window.fmGraph);
  await graph.evaluate((m) => fmGraph.load(m, 'Owner'), MODEL);
  await graph.evaluate(() => { const b = fmGraph.board(); b.items.concat(b.sliders).forEach(w => fmGraph.remove(w.id)); }); // the first bar fmGraph starts with
  const id = pieces ? await graph.evaluate(([t, p]) => fmGraph.addChart({ layout: 'free', title: t, pieces: p }), [TITLE, pieces]) : null;
  const ids = await graph.evaluate((list) => Object.fromEntries(list.map(s => [s.name, fmGraph.addSlider(s.name, { min: s.min, max: s.max, step: 1 })])), sliders || []);
  const file = await graph.evaluate(() => fmGraph.exportBoards(false));
  return { graph, id, sliders: ids, file };
}
// ExcelExporter with the model, a board file imported: the Use fmGraph boards… window open.
async function exporterWith(page, testInfo, file){
  await X.openExporter(page);
  await X.loadModelFile(page, D.tempFile(testInfo, 'owner.json', JSON.stringify(MODEL)));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), X.menuCommand(page, 'btnImportGraphBoards')]);
  await chooser.setFiles(D.tempFile(testInfo, 'owner.board.json', JSON.stringify(file)));
  await expect(page.locator('#graphModal')).toBeVisible();
}
// The workbook with the Dashboard's sliders typed (Typed and Use), worked out: valueOf(sheet, addr).
function workedOut(wb, values){
  const w = JSON.parse(JSON.stringify(wb));
  const d = w.Sheets.Dashboard;
  Object.entries(values || {}).forEach(([name, v]) => {
    const r = [5, 6, 7, 8].find(k => d['A' + k] && d['A' + k].v === name);
    expect(r, 'the slider row of ' + name).toBeTruthy();
    d['F' + r] = { t: 'n', v };
    d['I' + r] = { t: 'b', v: true };
  });
  return { wb: w, valueOf: xlRecalc(w).valueOf };
}
// The Free chart's helper block on the Dashboard, read: per piece its figures, as fmGraph's chart(id).
function helperFigures(d, valueOf, title, counts){
  const top = Object.keys(d).filter(a => /^N\d+$/.test(a) && String(d[a].v || '') === 'Chart data: ' + title + ' (2027)').map(a => Number(a.slice(1)))[0];
  expect(top, 'the chart data of ' + title).toBeTruthy();
  const head = top + 1;
  expect(d['N' + head].v).toBe('Piece');
  const rowOf = (name) => { for(let r = head + 1; r < head + 40; r++) if(d['N' + r] && d['N' + r].v === name) return r; return null; };
  const v = (addr) => valueOf('Dashboard', addr);
  const rectHead = rowOf('Rectangle');
  expect(rectHead).toBeTruthy();
  let rr = rectHead + 1;
  return counts.map((nParts, i) => {
    const C = X.numToCol(15 + i);
    const at = (name) => v(C + rowOf(name));
    const parts = [];
    for(let k = 0; k < nParts; k++, rr++) parts.push({ label: d['N' + rr].v, value: v('O' + rr), from: v('P' + rr), to: v('Q' + rr) });
    return { name: d[C + head].v, column: d[C + rowOf('Column')].v - 1, value: at('Value'), base: at('Sits at'), top: at('Top'), bottom: at('Bottom'), end: at('End'),
      check: at('Check'), overlaps: at('Overlaps') === 'overlaps', parts };
  });
}
// Excel's stacking of a chart's series: positives up from 0, negatives down, in series order, per
// category. → Map('category|series name' → [lowest, highest]) of what is drawn (fillers left out).
function stacked(chart, valueOf){
  const up = {}, down = {}, drawn = new Map();
  chart.series.forEach(s => {
    const m = /^'Dashboard'!\$([A-Z]+)\$(\d+):\$([A-Z]+)\$\d+$/.exec(s.val.ref);
    expect(m, s.val.ref).toBeTruthy();
    const c1 = X.colToNum(m[1]), c2 = X.colToNum(m[3]);
    for(let c = c1; c <= c2; c++){
      const val = valueOf('Dashboard', X.numToCol(c) + m[2]);
      if(typeof val !== 'number' || val === 0) continue;
      const k = c - c1;
      up[k] = up[k] || 0; down[k] = down[k] || 0;
      let seg;
      if(val > 0){ seg = [up[k], up[k] + val]; up[k] += val; } else { seg = [down[k] + val, down[k]]; down[k] += val; }
      if(s.noFill) continue;
      const key = k + '|' + s.name.text, had = drawn.get(key);
      drawn.set(key, had ? [Math.min(had[0], seg[0]), Math.max(had[1], seg[1])] : seg);
    }
  });
  return drawn;
}
// The helper rows against fmGraph's own figures, and the stacking against where fmGraph draws
// each rectangle. → the names of the pieces marked "overlaps".
function compareWithFmGraph(f, h, chart, valueOf, at){
  const overlaps = [];
  f.pieces.forEach((p, i) => {
    const x = h[i], where = at + ', ' + p.name;
    expect(x.name, where).toBe(p.name);
    expect(x.column, where).toBe(p.column);
    if(p.error !== undefined || p.blocked !== undefined) return;
    ['value', 'base', 'top', 'bottom', 'end'].forEach(k => expect(close(x[k], p[k]), where + ' ' + k + ': ' + x[k] + ' vs ' + p[k]).toBe(true));
    expect(x.check || null, where).toBe(p.check ? (p.check.agree ? '✓' : '✗') : null);
    p.parts.forEach((q, k) => expect(close(x.parts[k].from, q.from) && close(x.parts[k].to, q.to), where + ' ' + q.name + ' from / to').toBe(true));
    if(x.overlaps) overlaps.push(p.name);
  });
  const drawn = stacked(chart, valueOf);
  // Where fmGraph draws each rectangle in each column (a rectangle once per column in these cases).
  const want = new Map();
  f.pieces.forEach((p, i) => p.parts.forEach(q => {
    if(q.value === 0) return;
    const key = p.column + '|' + q.name;
    expect(want.has(key), key).toBe(false);
    want.set(key, { span: [Math.min(q.from, q.to), Math.max(q.from, q.to)], overlaps: h[i].overlaps });
  }));
  want.forEach((w, key) => {
    const got = drawn.get(key);
    const same = !!got && close(got[0], w.span[0]) && close(got[1], w.span[1]);
    expect(same, at + ', ' + key + ': drawn ' + JSON.stringify(got) + ', fmGraph ' + JSON.stringify(w.span)).toBe(!w.overlaps);
  });
  expect([...drawn.keys()].filter(k => !want.has(k)), at + ': nothing else drawn').toEqual([]);
  return overlaps;
}

test('the owner\'s case: listed, used and drawn on the Dashboard; the helper rows and the stacking agree with fmGraph at six slider positions', async ({ page, context, pageErrors }, testInfo) => {
  const { graph, id, sliders, file } = await fmGraphWith(context, OWNER, [{ name: 'CFO', min: -300, max: 300 }, { name: 'Other', min: -200, max: 200 }]);
  await exporterWith(page, testInfo, file);
  await expect(page.locator('#graphChartList .graph-scn-name')).toHaveText([TITLE]);
  await expect(page.locator('#graphChartList .graph-scn-what')).toHaveText(['Free · 2027 · 10 pieces · wide']);
  expect((await leftOut(page)).join(' ')).not.toContain('Free');
  await page.click('#graphUse');
  await expect(genStatus(page)).toContainText('1 chart on the Dashboard');

  const { wb, bytes } = await X.generate(page);
  // The workbook for the owner's own Excel (Windows and the iPad), from ExcelExporter itself.
  const out = path.join(__dirname, 'output');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'f3-free-chart-check.xlsx'), bytes);
  const book = await X.readBack(bytes);
  expect(book.worksheets[0].name).toBe('Dashboard');

  const d = wb.Sheets.Dashboard;
  const charts = d['!charts'];
  expect(charts).toHaveLength(1);
  const chart = charts[0].chart;
  expect(chart.bar).toMatchObject({ dir: 'col', grouping: 'stacked' });
  expect(chart.title).toBe(TITLE);
  expect(chart.series).toHaveLength(72); // 10 pieces × 2 fillers + 13 rectangles × 4
  expect(chart.series.filter(s => s.noFill)).toHaveLength(20);
  expect(chart.series.filter(s => !s.noFill && !s.noLegend).map(s => s.name.text)).toEqual(['Cash EB', 'Gross PPE', 'Loan', 'Equity', 'Cash BB', 'CFO', 'CFI', 'CFF', 'Other']);
  expect(chart.series[2].cat.values).toEqual(['Asset', 'L + Eq / More', '', 'Cash BB', 'CFO', '−CFI', 'CFF', 'Cash EB', 'Target', 'On CFF']);
  // One colour per rectangle on its four series.
  const colours = new Map();
  chart.series.filter(s => !s.noFill).forEach(s => { if(colours.has(s.name.text)) expect(s.color, s.name.text).toBe(colours.get(s.name.text)); else colours.set(s.name.text, s.color); });
  expect([...colours.values()].every(c => /^[0-9A-F]{6}$/.test(c))).toBe(true);
  // What Excel shows before it recalculates: the chart's own copy of the numbers is fmIDE's.
  const start = workedOut(wb, {});
  chart.series.forEach(s => {
    const m = /\$([A-Z]+)\$(\d+):\$([A-Z]+)/.exec(s.val.ref);
    s.val.values.forEach((v, k) => {
      const now = start.valueOf('Dashboard', X.numToCol(X.colToNum(m[1]) + k) + m[2]);
      if(v === null) expect([null, 0, '']).toContain(now === undefined ? null : now);
      else expect(close(v, now), s.name.text + ' ' + k).toBe(true);
    });
  });

  const counts = OWNER.map(p => p.parts.length);
  const overlaps = {};
  for(const c of CASES){
    await graph.evaluate(([s, v]) => { fmGraph.setSlider(s.CFO, v.CFO); fmGraph.setSlider(s.Other, v.Other); }, [sliders, c.values]);
    const f = await graph.evaluate((i) => fmGraph.chart(i), id);
    const w = workedOut(wb, c.values);
    const h = helperFigures(w.wb.Sheets.Dashboard, w.valueOf, TITLE, counts);
    const o = compareWithFmGraph(f, h, chart, w.valueOf, c.title);
    if(o.length) overlaps[c.title] = o;
  }
  expect(overlaps).toEqual({ [CASES[2].title]: ['More'], [CASES[5].title]: ['More'] });
  expect(pageErrors).toEqual([]);
});

test('someone else\'s board file: put right as fmGraph puts it right, names as text, numbers forced; the helper rows agree with fmGraph', async ({ page, context, pageErrors }, testInfo) => {
  const odd = { kind: 'fmIDE-graph-board', version: 13, boards: [{ name: 'Odd', sliders: [], items: [{ type: 'chart', layout: 'free', title: 'Odd <b>chart</b>', period: 0, pieces: [
    { id: 'a', name: '<img src=x onerror="window.__x=1">', column: '2', sits: { on: 'float' }, parts: [rect('cfo', 'CFO')] },   // 0: column as text, sits not known
    { id: 'b', name: 'On a', column: 2, sits: { on: 'top', of: 'a' }, parts: [rect('bb', 'Cash BB'), Object.assign(rect('cfi', 'CFI'), { colour: '#ABCDEF' })] }, // 1
    { id: 'c', name: 'Loop 1', column: 4, sits: { on: 'end', of: 'd' }, parts: [rect('cff', 'CFF')] },                           // 2: a loop
    { id: 'd', name: 'Loop 2', column: 5, sits: { on: 'end', of: 'c' }, parts: [rect('loan', 'Loan')] },                          // 3
    { id: 'e', name: 'Clash', column: 2, sits: { on: 'zero' }, parts: [rect('ppe', 'Gross PPE')] },                             // 4: moves on
    { id: 'f', name: 'Far', column: 99, sits: { on: 'level', value: '1e20' }, parts: [rect('other', 'Other'), rect('nope', 'Gone')] }, // 5
    { id: 'g', name: 'Unknown', column: 7, sits: { on: 'end', of: 'zzz' }, check: 'zzz', minus: true, parts: [rect('eb', 'Cash EB')] }, // 6
    'a string',
    { id: 'h', name: 'Text level', column: 8, sits: { on: 'level', value: ' 25 ' }, check: 'g', parts: [rect('cfo', 'CFO')] },      // 7
  ] }] }] };
  // fmGraph reads it.
  const { graph } = await fmGraphWith(context, null, []);
  await graph.evaluate((t) => fmGraph.importBoards(t), JSON.stringify(odd));
  await graph.evaluate(() => fmGraph.showBoard('Odd'));
  const gid = await graph.evaluate(() => fmGraph.board().items.find(w => w.layout === 'free').id);
  const f = await graph.evaluate((i) => fmGraph.chart(i), gid);
  expect(f.pieces.map(p => p.column)).toEqual([2, 2, 4, 5, 3, 9, 7, 8]); // Far: after the last column used
  // ExcelExporter reads the same.
  await exporterWith(page, testInfo, odd);
  await expect(page.locator('#graphChartList .graph-scn-name')).toHaveText(['Odd <b>chart</b>']); // as text
  await expect(page.locator('#graphChartList .graph-scn-what')).toHaveText(['Free · 2027 · 8 pieces · wide']);
  expect(await leftOut(page)).toContain('1 rectangle of the bars and charts left out (not in this model, inside a block, or not readable).');
  await page.click('#graphUse');
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const map = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(map.version).toBe(11);
  const c = map.cfg.graph.charts[0];
  expect(c.kind).toBe('free');
  expect(c.pieces).toEqual([
    { name: '<img src=x onerror="window.__x=1">', column: 2, sits: { on: 'zero' } },
    { name: 'On a', column: 2, sits: { on: 'top', of: 0 } },
    { name: 'Loop 1', column: 4, sits: { on: 'zero' } },
    { name: 'Loop 2', column: 5, sits: { on: 'zero' } },
    { name: 'Clash', column: 3, sits: { on: 'zero' } },
    { name: 'Far', column: 9, sits: { on: 'level', value: 1e9 } },
    { name: 'Unknown', column: 7, sits: { on: 'zero' }, minus: true },
    { name: 'Text level', column: 8, sits: { on: 'level', value: 25 }, check: 6 },
  ]);
  expect(c.parts.map(x => [x.name, x.piece])).toEqual([['CFO', 0], ['Cash BB', 1], ['CFI', 1], ['CFF', 2], ['Loan', 3], ['Gross PPE', 4], ['Other', 5], ['Cash EB', 6], ['CFO', 7]]);
  expect(c.parts[2].colour).toBe('#abcdef');
  const { wb } = await X.generate(page);
  const w = workedOut(wb, {});
  const h = helperFigures(w.wb.Sheets.Dashboard, w.valueOf, 'Odd <b>chart</b>', [1, 2, 1, 1, 1, 1, 1, 1]);
  compareWithFmGraph(f, h, wb.Sheets.Dashboard['!charts'][0].chart, w.valueOf, 'someone else\'s file');
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test('a Free chart needing more than 255 series is listed as not carried', async ({ page }, testInfo) => {
  const many = Array.from({ length: 30 }, () => rect('cfo', 'CFO'));
  const file = { kind: 'fmIDE-graph-board', version: 13, boards: [{ name: 'Big', sliders: [], items: [
    { type: 'chart', layout: 'free', title: 'Too big', period: 0, pieces: [0, 1, 2].map(k => ({ id: 'p' + k, name: 'P' + k, column: k, sits: { on: 'zero' }, parts: many })) },
    { type: 'chart', layout: 'free', title: 'Small', period: 0, pieces: [{ id: 'q', name: 'Q', column: 0, sits: { on: 'zero' }, parts: [rect('cfo', 'CFO')] }] },
  ] }] };
  await exporterWith(page, testInfo, file); // 3 × 2 + 90 × 4 = 366 series
  await expect(page.locator('#graphChartList .graph-scn-name')).toHaveText(['Small']);
  expect(await leftOut(page)).toContain('1 Free chart not carried: an Excel chart holds at most 255 series.');
});

test('the layout keeps the chart: Export Mapping and Import Mapping give the same Dashboard', async ({ page, context }, testInfo) => {
  const { file } = await fmGraphWith(context, OWNER, []);
  await exporterWith(page, testInfo, file);
  await page.click('#graphUse');
  const first = await X.generate(page);
  const [download] = await Promise.all([page.waitForEvent('download'), X.menuCommand(page, 'btnExportMapping')]);
  const saved = await download.path();
  const map = JSON.parse(fs.readFileSync(saved, 'utf8'));
  expect(map.version).toBe(11);
  expect(map.cfg.graph.charts[0].pieces[3]).toEqual({ name: 'CFO', column: 4, sits: { on: 'end', of: 2 } });
  expect(map.cfg.graph.charts[0].pieces[4]).toEqual({ name: 'CFI', column: 5, sits: { on: 'end', of: 3 }, minus: true });
  expect(map.cfg.graph.charts[0].pieces[6]).toEqual({ name: 'Cash EB', column: 7, sits: { on: 'zero' }, check: 5 });
  // Remove the copy (no chart on the Dashboard then), then import the layout back.
  await X.menuCommand(page, 'btnUseGraphBoards');
  await page.click('#confirmOk'); // the boards were used, so it offers Remove
  await expect(genStatus(page)).toContainText('removed');
  const none = await X.generate(page);
  expect(none.wb.Sheets.Dashboard).toBeUndefined();
  await page.setInputFiles('#mappingFileInput', saved);
  await expect(genStatus(page)).toHaveText('Mapping imported.');
  const again = await X.generate(page);
  const cells = (ws) => Object.fromEntries(Object.entries(ws).filter(([a]) => a[0] !== '!').map(([a, c]) => [a, c.f || c.v]));
  expect(cells(again.wb.Sheets.Dashboard)).toEqual(cells(first.wb.Sheets.Dashboard));
});

test('LibreOffice recalculates the Dashboard to the same numbers', async ({ page, context }, testInfo) => {
  requireSoffice(test);
  testInfo.setTimeout(240_000);
  const { file } = await fmGraphWith(context, OWNER, [{ name: 'CFO', min: -300, max: 300 }, { name: 'Other', min: -200, max: 200 }]);
  await exporterWith(page, testInfo, file);
  await page.click('#graphUse');
  const { wb } = await X.generate(page);
  const w = workedOut(wb, { CFO: -200, Other: -150 });
  const back = await X.readBack(recalc({ wb: await X.writeWithApp(page, w.wb) }).wb);
  const dash = back.getWorksheet('Dashboard');
  let n = 0;
  Object.entries(w.wb.Sheets.Dashboard).forEach(([a, c]) => {
    if(a[0] === '!' || !c.f || X.colToNum(a.replace(/\d+/g, '')) < 14) return; // the chart's helper block (from column N)
    const want = w.valueOf('Dashboard', a), got = cellValue(dash.getCell(a));
    if(typeof want === 'number') expect(close(got, want) || Math.abs(got - want) < 1e-9, a + ': ' + got + ' vs ' + want).toBe(true);
    else expect(got || null, a).toBe(want || null);
    n++;
  });
  expect(n).toBeGreaterThan(200);
});
