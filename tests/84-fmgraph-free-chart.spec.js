// 84. fmGraph's Free chart (phase F1, docs/fmgraph-free-chart.md; board file 13): columns and
// waterfalls together in one period, as pieces in grid columns.
// - The owner's case — a balance sheet and its cash flow as one chart — built through
//   fmGraph.addChart and checked number by number (each piece's base, top, bottom, end, its
//   rectangles' from and to); Minus; each kind of Sits; the checks' ✓ and ✗ in words; a slider
//   moving a piece and those resting on it.
// - An error: the piece shown as ! with its reason, the pieces resting on it not drawn, in words.
// - The editor: + Piece, Sits, Minus, Should equal, the column ← →; a loop refused; undo.
// - + From chart… and the layout menu from a Columns and a Waterfall chart give the same
//   numbers; Free back to Columns makes a group per piece.
// - The file: version 13, its form, read back; a loop from a file put on zero and two pieces in
//   one column with neither resting on the other moved, both counted in words; bad Sits, unknown
//   ids, numbers as text and names with markup read safely; a version 12 sample opens unchanged.
const { test, expect, openApp, readFixture, BOARD_FILE_VERSION } = require('./helpers/apps');

const g = (page, fn, arg) => page.evaluate(fn, arg);

// The owner's balance sheet and cash flow, in one period: Cash EB = BB + CFO + CFF − CFI, and
// equity = cash + PPE − loan, so the balance sheet balances whatever CFO is.
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
  { id: 'z', type: 'value', x: 0, y: 600, text: 'Zero\n0' },
  { id: 'd', type: 'operator', x: 150, y: 600, text: '÷' },
  { id: 'broken', type: 'value', x: 250, y: 600, text: 'Broken' },
], edges: [
  { id: 'e1', from: 'bb', to: 'o1' }, { id: 'e2', from: 'cfo', to: 'o1' }, { id: 'e3', from: 'cff', to: 'o1' }, { id: 'e4', from: 'o1', to: 'sub' },
  { id: 'e5', from: 'sub', to: 'o2' }, { id: 'e6', from: 'cfi', to: 'o2' }, { id: 'e7', from: 'o2', to: 'eb' },
  { id: 'e8', from: 'eb', to: 'o3' }, { id: 'e9', from: 'ppe', to: 'o3' }, { id: 'e10', from: 'o3', to: 'gross' },
  { id: 'e11', from: 'gross', to: 'o4' }, { id: 'e12', from: 'loan', to: 'o4' }, { id: 'e13', from: 'o4', to: 'eq' },
  { id: 'e14', from: 'cfo', to: 'd' }, { id: 'e15', from: 'z', to: 'd' }, { id: 'e16', from: 'd', to: 'broken' },
] }] };

const OWNER = { layout: 'free', title: 'Balance sheet and cash', pieces: [
  { name: 'Asset', column: 0, sits: { on: 'zero' }, parts: ['Cash EB', 'Gross PPE'] },          // 0
  { name: 'L + Eq', column: 1, sits: { on: 'zero' }, check: 0, parts: ['Loan', 'Equity'] },    // 1
  { name: 'Cash BB', column: 3, sits: { on: 'zero' }, parts: ['Cash BB'] },                   // 2
  { name: 'CFO', column: 4, sits: { on: 'end', of: 2 }, parts: ['CFO'] },                      // 3
  { name: 'CFI', column: 5, sits: { on: 'end', of: 3 }, minus: true, parts: ['CFI'] },         // 4
  { name: 'CFF', column: 6, sits: { on: 'end', of: 4 }, parts: ['CFF'] },                      // 5
  { name: 'Cash EB', column: 7, sits: { on: 'zero' }, check: 5, parts: ['Cash EB'] },          // 6
  { name: 'Target', column: 8, sits: { on: 'level', value: 400 }, parts: ['Loan'] },           // 7
  { name: 'More', column: 1, sits: { on: 'top', of: 1 }, parts: ['CFO'] },                     // 8
] };

async function openModel(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await g(page, (m) => fmGraph.load(m, 'Owner'), MODEL);
}
const figures = (page, id) => g(page, (i) => fmGraph.chart(i), id);
const brief = (f) => f.pieces.map(p => p.error !== undefined || p.blocked !== undefined ? [p.name, p.error !== undefined ? 'error' : 'blocked ' + p.blocked]
  : [p.name, p.column, p.value, p.base, p.top, p.bottom, p.end]);
const freeChart = (page) => page.locator('.chart-widget[data-layout="free"]');

test('the owner\'s balance sheet and cash flow as one chart: every piece where it should be', async ({ page, pageErrors }) => {
  await openModel(page);
  const id = await g(page, (s) => fmGraph.addChart(s), OWNER);
  const f = await figures(page, id);
  expect(f.period).toBe('P1');
  expect(brief(f)).toEqual([
    ['Asset', 0, 500, 0, 500, 0, 500],
    ['L + Eq', 1, 500, 0, 500, 0, 500],
    ['Cash BB', 3, 100, 0, 100, 0, 100],
    ['CFO', 4, 50, 100, 150, 100, 150],
    ['−CFI', 5, -100, 150, 150, 50, 50],
    ['CFF', 6, 70, 50, 120, 50, 120],
    ['Cash EB', 7, 120, 0, 120, 0, 120],
    ['Target', 8, 300, 400, 700, 400, 700],
    ['More', 1, 50, 500, 550, 500, 550],
  ]);
  expect(f.pieces[0].parts).toEqual([{ name: 'Cash EB', value: 120, from: 0, to: 120 }, { name: 'Gross PPE', value: 380, from: 120, to: 500 }]);
  expect(f.pieces[4].parts).toEqual([{ name: 'CFI', value: -100, from: 150, to: 50 }]);
  expect(f.pieces[1].check).toEqual({ agree: true, a: 500, b: 500 });
  expect(f.pieces[6].check).toEqual({ agree: true, a: 120, b: 120 });
  expect(f.pieces[0].check).toBe(null);
  // Drawn: a rectangle per part, the checks, a connector per waterfall step, names as text.
  const chart = freeChart(page);
  await expect(chart.locator('.c-part')).toHaveCount(11);
  await expect(chart.locator('.t-check.ok')).toHaveCount(2);
  await expect(chart.locator('.f-link')).toHaveCount(3); // CFO, CFI and CFF from the step before (More stands on L + Eq, in its column)
  await expect(chart.locator('.key-group')).toHaveText(['Asset:', 'L + Eq:', '−CFI:', 'Target:', 'More:']); // a piece that is just its rectangle has no label
  await expect(chart.locator('.bar-errors li')).toHaveCount(0);
  // CFO up 30: the cash flow, the balance sheet and the piece resting on L + Eq move with it.
  const s = await g(page, () => fmGraph.addSlider('CFO'));
  await g(page, (i) => fmGraph.setSlider(i, 80), s);
  const f2 = await figures(page, id);
  expect(brief(f2)).toEqual([
    ['Asset', 0, 530, 0, 530, 0, 530],
    ['L + Eq', 1, 530, 0, 530, 0, 530],
    ['Cash BB', 3, 100, 0, 100, 0, 100],
    ['CFO', 4, 80, 100, 180, 100, 180],
    ['−CFI', 5, -100, 180, 180, 80, 80],
    ['CFF', 6, 70, 80, 150, 80, 150],
    ['Cash EB', 7, 150, 0, 150, 0, 150],
    ['Target', 8, 300, 400, 700, 400, 700],
    ['More', 1, 80, 530, 610, 530, 610],
  ]);
  await expect(chart.locator('.b-base').first()).toBeVisible(); // the model's own numbers outlined
  // A check that fails, in words.
  await g(page, (i) => fmGraph.remove(i), s);
  const bad = await g(page, () => fmGraph.addChart({ layout: 'free', title: 'Off', pieces: [
    { name: 'A', column: 0, parts: ['Cash BB'] }, { name: 'B', column: 1, check: 0, parts: ['CFO'] }] }));
  expect((await figures(page, bad)).pieces[1].check).toEqual({ agree: false, a: 50, b: 100 });
  const off = page.locator('.chart-widget').filter({ has: page.locator('svg[aria-label^="Off"]') });
  await expect(off.locator('.t-check.bad')).toHaveCount(1);
  await expect(off.locator('.bar-errors li')).toHaveText(['B should equal A: it is 50, and A ends at 100.']);
  expect(pageErrors).toEqual([]);
});

test('an error: the piece shows ! with its reason; pieces resting on it are not drawn, and say why', async ({ page }) => {
  await openModel(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'free', title: 'Errors', pieces: [
    { name: 'Bad', column: 0, parts: ['Broken'] },
    { name: 'Next', column: 1, sits: { on: 'end', of: 0 }, parts: ['CFO'] },
    { name: 'Then', column: 2, sits: { on: 'end', of: 1 }, parts: ['CFF'] },
    { name: 'Fine', column: 3, parts: ['CFF'] }] }));
  expect(brief(await figures(page, id))).toEqual([['Bad', 'error'], ['Next', 'blocked Bad'], ['Then', 'blocked Next'], ['Fine', 3, 70, 0, 70, 0, 70]]);
  const chart = freeChart(page);
  await expect(chart.locator('.t-err')).toHaveCount(3);
  await expect(chart.locator('.bar-errors li')).toHaveText([
    'Bad, Broken: something it reads could not be worked out',
    'Next is not drawn: it rests on Bad, which has an error.',
    'Then is not drawn: it rests on Next, which can\'t be drawn either.']);
  await expect(chart.locator('.c-part')).toHaveCount(1);
});

test('the editor: + Piece, Sits, Minus, Should equal, the columns; a loop refused; undo', async ({ page, pageErrors }) => {
  await openModel(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'free', title: 'Built' }));
  const chart = freeChart(page);
  await expect(chart.locator('.bar-errors li')).toHaveText(['Add a piece to start: Edit chart, then + Piece or + From chart….']);
  await chart.locator('summary').click();
  await chart.locator('.add-piece').click();
  await chart.locator('.add-piece').click();
  const piece = (i) => chart.locator('.piece-edit').nth(i);
  await expect(chart.locator('.piece-edit')).toHaveCount(2);
  await expect(piece(1).locator('.piece-column')).toHaveText('Column 2');
  // The first: Cash BB; the second: CFI, with Minus, where Cash BB ends.
  await piece(0).locator('.part-row select').selectOption({ label: 'Cash BB (input)' });
  await piece(1).locator('.part-row select').selectOption({ label: 'CFI (input)' });
  await piece(1).locator('.piece-minus').check();
  await piece(1).locator('.piece-sits').selectOption({ label: 'Where Cash BB ends' });
  await piece(0).locator('.piece-name').fill('Start');
  await piece(0).locator('.piece-name').press('Tab');
  let f = await figures(page, id);
  expect(brief(f)).toEqual([['Start', 0, 100, 0, 100, 0, 100], ['−CFI', 1, -100, 100, 100, 0, 0]]);
  // A loop: Start where −CFI ends, refused (Start stays on zero).
  await piece(0).locator('.piece-sits').selectOption({ label: 'Where −CFI ends' });
  await expect(page.locator('#notices .note.err')).toContainText('That would make a loop: −CFI already rests on Start.');
  await expect(piece(0).locator('.piece-sits')).toHaveValue('zero');
  // Should equal, at a number, and the column moved right past a free one.
  await piece(1).locator('.piece-check').selectOption({ label: 'Where Start ends' });
  expect((await figures(page, id)).pieces[1].check).toEqual({ agree: false, a: -100, b: 100 });
  await piece(0).locator('.piece-sits').selectOption({ label: 'At a number' });
  await piece(0).locator('.piece-level').fill('50');
  await piece(0).locator('.piece-level').press('Tab');
  await piece(0).locator('.piece-right').click(); // column 2 is −CFI's, which rests on Start: they may share it
  f = await figures(page, id);
  expect(brief(f)).toEqual([['Start', 1, 100, 50, 150, 50, 150], ['−CFI', 1, -100, 150, 150, 50, 50]]);
  // On top of: into that piece's column, when it may stand there.
  await chart.locator('.add-piece').click();
  await piece(2).locator('.part-row select').selectOption({ label: 'CFF (input)' });
  await piece(2).locator('.piece-sits').selectOption({ label: 'On top of Start' });
  f = await figures(page, id);
  expect(brief(f)[2]).toEqual(['CFF', 2, 70, 150, 220, 150, 220]); // not into Start's column: −CFI rests there too, and neither rests on the other
  // Undo takes back the last change, redo puts it back (each makes the widgets anew, new ids).
  const now = async () => figures(page, await g(page, () => fmGraph.board().charts.find(c => c.layout === 'free').id));
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect((await now()).pieces[2].base).toBe(0);
  expect(await g(page, () => fmGraph.redo())).toBe(true);
  expect((await now()).pieces[2].base).toBe(150);
  // Removing a piece: the ones resting on it go on zero.
  await chart.locator('summary').click(); // (open again: the editor was the widget's before the undo)
  await chart.locator('.piece-edit').nth(0).locator('.piece-remove').click();
  expect(brief(await now())).toEqual([['−CFI', 1, -100, 0, 0, -100, -100], ['CFF', 2, 70, 0, 70, 0, 70]]);
  expect(pageErrors).toEqual([]);
});

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const SAMPLE_PIECES = [
  ['Assets', 0, 3000, 0, 3000, 0, 3000], ['Liabilities and equity', 1, 3000, 0, 3000, 0, 3000],
  ['Revenue', 2, 10000, 0, 10000, 0, 10000], ['−Cost of sales', 3, -6000, 10000, 10000, 4000, 4000], ['Gross profit', 4, 4000, 0, 4000, 0, 4000],
  ['−Overheads', 5, -2500, 4000, 4000, 1500, 1500], ['Profit', 6, 1500, 0, 1500, 0, 1500]];

test('+ From chart… and the layout menu: a Columns and a Waterfall chart become pieces; back to Columns, a group each', async ({ page, pageErrors }) => {
  await openSample(page);
  const id = await g(page, () => fmGraph.addChart({ layout: 'free', title: 'Both' }));
  const chart = freeChart(page);
  await chart.locator('summary').click();
  await chart.locator('.piece-from').selectOption({ label: 'Balance sheet (Columns)' });
  await chart.locator('.piece-from').selectOption({ label: 'Profit (Waterfall)' });
  const f = await figures(page, id);
  expect(brief(f)).toEqual(SAMPLE_PIECES);
  expect(f.pieces.map(p => p.check)).toEqual([null, { agree: true, a: 3000, b: 3000 }, null, null, { agree: true, a: 4000, b: 4000 }, null, { agree: true, a: 1500, b: 1500 }]);
  await expect(chart.locator('.t-check.ok')).toHaveCount(3);
  // The layout menu turns the sample's waterfall into the same pieces.
  const flow = page.locator('.chart-widget[data-layout="flow"]');
  await flow.locator('select[aria-label="Kind of chart"]').selectOption('free');
  const ids = await g(page, () => fmGraph.board().charts.map(c => c.id));
  expect(brief(await figures(page, ids[1])).map(p => p.slice(0, 1).concat(p.slice(2)))).toEqual(SAMPLE_PIECES.slice(2).map(p => p.slice(0, 1).concat(p.slice(2))));
  // Free back to Columns: a group per piece (following the shared periods, as a new Columns chart does).
  await freeChart(page).last().locator('select[aria-label="Kind of chart"]').selectOption('columns');
  const back = await figures(page, ids[2]);
  expect(back[0].period).toBe('Year 1');
  expect(back[0].groups.map(x => [x.name, x.total])).toEqual([['Assets', 3000], ['Liabilities and equity', 3000], ['Group 3', 10000], ['Group 4', 6000], ['Group 5', 4000], ['Group 6', 2500], ['Group 7', 1500]]);
  expect(pageErrors).toEqual([]);
});

test('the file: version 13 brought the Free chart (now 14), its pieces read back; loops, shared columns, bad values and markup read safely', async ({ page, pageErrors }) => {
  expect(BOARD_FILE_VERSION).toBe(14); // 13 brought the Free chart; 14 a slider's Minimum
  await openModel(page);
  const id = await g(page, (s) => fmGraph.addChart(s), OWNER);
  const before = await figures(page, id);
  const file = await g(page, () => fmGraph.exportBoards(true));
  expect(file.version).toBe(13);
  const chart = file.boards[0].items.find(w => w.layout === 'free');
  expect(chart.pieces.length).toBe(9);
  const ids = chart.pieces.map(p => p.id);
  expect(chart.pieces[3]).toEqual({ id: ids[3], name: 'CFO', column: 4, sits: { on: 'end', of: ids[2] }, parts: [{ canvasId: 'c', nodeId: 'cfo', name: 'CFO', colour: chart.pieces[3].parts[0].colour }] });
  expect(chart.pieces[4].minus).toBe(true);
  expect(chart.pieces[1].check).toBe(ids[0]);
  expect(chart.pieces[7].sits).toEqual({ on: 'level', value: 400 });
  // Read back as a new board: the same numbers.
  expect(await g(page, (d) => fmGraph.importBoards(d), file)).toBe(1);
  await g(page, () => fmGraph.showBoard(1));
  const again = await g(page, () => fmGraph.board().charts.find(c => c.layout === 'free').id);
  expect(await figures(page, again)).toEqual(before);
  // A hostile file.
  const evil = '<img src=x onerror="window.__hit=1">';
  const part = (nodeId, name) => ({ canvasId: 'c', nodeId, name });
  const hostile = { kind: 'fmIDE-graph-board', version: 13, boards: [{ name: 'Hostile', sliders: [], items: [{ type: 'chart', layout: 'free', title: evil, period: '0', pieces: [
    { id: 'a', name: evil, column: '2', sits: { on: 'float' }, parts: [part('bb', 'Cash BB'), part('nope', 'Gone')] },
    { id: 'b', name: 'Level', column: 3, sits: { on: 'level', value: '150' }, check: 'nobody', parts: [part('cfo', 'CFO')] },
    { id: 'c', name: 'Huge', column: 4, sits: { on: 'level', value: 1e20 }, parts: [part('cff', 'CFF')] },
    { id: 'd', name: 'Lost', column: 5, sits: { on: 'end', of: 'nobody' }, parts: [part('cff', 'CFF')] },
    { id: 'e', name: 'Loop 1', column: 6, sits: { on: 'top', of: 'f' }, parts: [part('cff', 'CFF')] },
    { id: 'f', name: 'Loop 2', column: 7, sits: { on: 'end', of: 'e' }, parts: [part('cff', 'CFF')] },
    { id: 'g', name: 'Crowd', column: 2, sits: { on: 'zero' }, parts: [part('cff', 'CFF')] },
    { id: 'h', name: 'Bad column', column: 99, parts: [part('cff', 'CFF')] },
    'not a piece'] }] }] };
  expect(await g(page, (d) => fmGraph.importBoards(d), hostile)).toBe(1);
  await g(page, () => fmGraph.showBoard('Hostile'));
  const hid = await g(page, () => fmGraph.board().charts[0].id);
  expect(brief(await figures(page, hid))).toEqual([
    [evil, 2, 100, 0, 100, 0, 100], ['Level', 3, 50, 150, 200, 150, 200], ['Huge', 4, 70, 1e9, 1e9 + 70, 1e9, 1e9 + 70],
    ['Lost', 5, 70, 0, 70, 0, 70], ['Loop 1', 6, 70, 0, 70, 0, 70], ['Loop 2', 7, 70, 0, 70, 0, 70],
    ['Crowd', 8, 70, 0, 70, 0, 70], ['Bad column', 9, 70, 0, 70, 0, 70]]);
  expect((await figures(page, hid)).pieces[1].check).toBe(null);
  const words = page.locator('.chart-widget[data-layout="free"] .bar-errors li');
  await expect(words).toContainText(['2 pieces were in a loop (resting on each other) and now sit on zero.', '1 piece moved to a free column: two pieces share a column only when one rests on the other.']);
  await expect(page.locator('.chart-widget[data-layout="free"] .key-group').first()).toHaveText(evil + ':');
  expect(await g(page, () => window.__hit)).toBeUndefined();
  expect(await g(page, () => document.querySelectorAll('#board img').length)).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('a version 12 board file opens unchanged, and is written again as version 14', async ({ page, pageErrors }) => {
  await openSample(page);
  expect(await g(page, (d) => fmGraph.importBoards(d), readFixture('formats', 'board-v12.json'))).toBe(1);
  await g(page, () => fmGraph.showBoard('Saved before the Free chart'));
  const b = await g(page, () => fmGraph.board());
  expect(b.charts.map(c => c.layout)).toEqual(['columns', 'flow']);
  const ids = b.charts.map(c => c.id);
  expect((await figures(page, ids[0]))[0].groups.map(x => x.total)).toEqual([3000, 3000]);
  expect((await figures(page, ids[1])).map(s => s.value)).toEqual([10000, 6000, 4000]);
  expect(await g(page, (i) => fmGraph.scale(i), ids[0])).toEqual({ min: 0, max: 20000 });
  const file = await g(page, () => fmGraph.exportBoards(false));
  expect(file.version).toBe(14);
  expect(file.boards[0].items.map(w => w.layout || w.type)).toEqual(['bar', 'columns', 'flow']);
  expect(file.boards[0].items[2].ownScale).toBe(true);
  expect(file.colours).toEqual([{ canvasId: 'cProfit', nodeId: 'rev', name: 'Revenue', colour: '#2563eb' }]);
  expect(pageErrors).toEqual([]);
});
