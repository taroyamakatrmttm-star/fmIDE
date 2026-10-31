// 100. Simplifying a model for some inputs (the owner's idea of 1 November 2026; phase 1 of
// docs/simplify-brief.md; src/shared/simplify.js), in Node: inputs with a range, the others
// staying at today's numbers; only what those inputs move stays. Small models made here, each
// checked the same way — the copy gives the full model's numbers for everything it keeps, in
// every period, at every step of every input and at random combinations (the agreement check),
// and the original is never changed. Also: the fixed numbers, the zeros dropped, the period
// shifts, blocks, errors, the corners, the tolerance, plugs, templates, Keep anyway and the
// × −1 folded into a minus.
const { test, expect } = require('./helpers/apps');
const S = require('../src/shared/simplify.js');
const { compileModel, evaluateModel, irNodeIn } = require('../src/shared/ir.js');

// A small model builder: value(id, 'Name', 5 | [1,2,3], extra), op(id, '+'), edges by [from, to].
const value = (id, name, num, extra) => Object.assign({ id, type: 'value', x: 0, y: 0, w: 170, h: 64,
  text: name + (num === undefined || Array.isArray(num) ? '' : '\n' + num) }, Array.isArray(num) ? { text: name + '\n' + num[0], periodValues: num } : {}, extra || {});
const op = (id, symbol, extra) => Object.assign({ id, type: 'operator', x: 0, y: 0, w: 56, h: 56, text: symbol }, extra || {});
const shift = (id, extra) => Object.assign({ id, type: 'periodShift', x: 0, y: 0, w: 56, h: 56, shift: -1 }, extra || {});
let edgeNo = 0;
const canvas = (id, name, nodes, edges, extra) => Object.assign({ id, name, nodes,
  edges: edges.map(e => Object.assign({ id: 'e' + (++edgeNo), from: e[0], to: e[1] }, e[2] || {})) }, extra || {});
const model = (canvases, periods) => ({ periods: periods || ['P1', 'P2', 'P3'], canvases });
// Positions matter where an operator reads its inputs left to right.
const at = (x, y) => ({ x, y });

// Works a system out with these inputs' numbers laid over it (vals: one per input).
function resultsWith(system, inputs, vals){
  const ir = compileModel(system);
  const P = ir.periodCount;
  const base = evaluateModel(ir);
  inputs.forEach((x, i) => {
    const n = irNodeIn(ir, x.canvasId, x.nodeId);
    if(!n || vals[i] === null) return;
    const ci = ir.order.findIndex(c => c.id === x.canvasId);
    const values = Array.from({ length: P }, (_, p) => { const v = base[ci].values[p][x.nodeId]; return typeof v === 'number' ? v : 0; });
    const ps = x.periods.mode === 'one' ? [x.periods.p] : Array.from({ length: P }, (_, p) => p);
    ps.forEach(p => { values[p] = vals[i]; });
    n.literal = { text: n.literal.text, periodValues: values };
  });
  return { ir, results: evaluateModel(ir) };
}
function rectValues(system, inputs, vals){
  const { ir, results } = resultsWith(system, inputs, vals);
  const out = new Map();
  ir.order.forEach((c, ci) => c.list.forEach(n => {
    if(n.type !== 'value') return;
    out.set(c.id + '/' + n.id, Array.from({ length: ir.periodCount }, (_, p) => {
      const e = results[ci].errors[p][n.id];
      return e ? 'E:' + e : results[ci].values[p][n.id];
    }));
  }));
  return out;
}
// The agreement check: every value rectangle of the copy gives the full model's numbers.
function expectAgrees(full, copy, inputs, points){
  points.forEach(vals => {
    const a = rectValues(full, inputs, vals), b = rectValues(copy, inputs, vals);
    b.forEach((vs, k) => {
      if(!a.has(k)) return; // a fixed number made from an operator or a block output
      vs.forEach((v, p) => {
        const w = a.get(k)[p];
        if(typeof v === 'number' && typeof w === 'number') expect(Math.abs(v - w), k + ' in period ' + (p + 1) + ' at ' + vals).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(w)));
        else expect(v, k + ' in period ' + (p + 1) + ' at ' + vals).toEqual(w);
      });
    });
  });
}
function everyPoint(inputs){
  const steps = inputs.map(S.simplifySteps);
  const out = [];
  steps.forEach((list, i) => list.forEach(v => { const r = inputs.map(() => null); r[i] = v; out.push(r); }));
  for(let k = 0; k < 20; k++) out.push(steps.map((s, i) => s[(k * 7 + i * 3) % s.length]));
  return out;
}
function simplify(system, list, opts){
  const before = JSON.stringify(system);
  const { inputs, problems } = S.simplifyInputs(system, list);
  expect(problems).toEqual([]);
  const r = S.simplifyModel(system, inputs, opts);
  expect(JSON.stringify(system), 'the original is never changed').toBe(before);
  expect(r.checked.ok, JSON.stringify(r.checked.mismatches)).toBe(true);
  expectAgrees(system, r.system, inputs, everyPoint(inputs));
  return Object.assign(r, { inputs });
}
const nodeIn = (system, canvasId, nodeId) => { const c = system.canvases.find(c => c.id === canvasId); return c && c.nodes.find(n => n.id === nodeId); };
const removedWhy = (r, nodeId) => (r.removed.find(x => x.nodeId === nodeId) || {}).why;

// Profit = Units × Price − Costs, Costs = Fixed cost + Overhead; Other, read by nothing.
function profitModel(){
  return model([
    canvas('c1', 'Sales', [
      value('units', 'Units', 4, at(0, 0)), value('price', 'Price', 10, at(0, 100)), op('m', '×', at(200, 50)), value('rev', 'Revenue', undefined, at(300, 50)),
      value('fixed', 'Fixed cost', [5, 6, 7], at(0, 300)), value('over', 'Overhead', 2, at(0, 400)), op('p', '+', at(200, 350)), value('costs', 'Costs', undefined, at(300, 350)),
      op('s', '−', at(450, 200)), value('profit', 'Profit', undefined, at(600, 200)),
      value('tax', 'Tax rate', 0.3, at(0, 600)), op('m2', '×', at(200, 600)), value('other', 'Other', undefined, at(300, 600)),
    ], [['units', 'm'], ['price', 'm'], ['m', 'rev'], ['fixed', 'p'], ['over', 'p'], ['p', 'costs'], ['rev', 's'], ['costs', 's'], ['s', 'profit'], ['tax', 'm2'], ['over', 'm2'], ['m2', 'other']]),
  ]);
}
const UNITS = { canvasId: 'c1', nodeId: 'units', min: 0, max: 10, step: 1 };

test.describe('100. Simplify for inputs (Node)', () => {
  test('what moves stays; what it reads that doesn\'t is a fixed number; the rest goes', () => {
    const sys = profitModel();
    const r = simplify(sys, [UNITS]);
    const c = r.system.canvases[0];
    const ids = c.nodes.map(n => n.id).sort();
    expect(ids).toEqual(['costs', 'm', 'price', 'profit', 'rev', 's', 'units'].sort());
    // Costs: its numbers per period, its arrow in cut; Price: an input, as it was.
    const costs = nodeIn(r.system, 'c1', 'costs');
    expect(costs.periodValues).toEqual([7, 8, 9]);
    expect(costs.text.split('\n')[0]).toBe('Costs');
    expect(c.edges.some(e => e.to === 'costs')).toBe(false);
    expect(nodeIn(r.system, 'c1', 'price')).toEqual(nodeIn(sys, 'c1', 'price'));
    expect(r.fixed.map(f => f.nodeId).sort()).toEqual(['costs', 'price']);
    expect(r.fixed.find(f => f.nodeId === 'price').input).toBe(true);
    expect(r.fixed.find(f => f.nodeId === 'price').text).toBe('an input, kept as it is, read by × operator on Sales');
    expect(r.fixed.find(f => f.nodeId === 'costs').text).toBe('kept as a fixed number, read by − operator on Sales');
    ['fixed', 'over', 'p', 'tax', 'm2', 'other'].forEach(id => expect(removedWhy(r, id), id).toBe('never-moved'));
    expect(r.removed.find(x => x.nodeId === 'other').text).toBe('never moved across ' + r.runs + ' runs');
    expect(r.total).toBe(13);
    expect(r.kept).toBe(7);
  });

  test('the runs: every step of each input, the corners, random combinations; many steps thinned to 101', () => {
    const a = { min: 0, max: 10, step: 1 }, b = { min: -1, max: 1, step: 0.5 };
    expect(S.simplifySteps(a)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(S.simplifySteps({ min: 0, max: 1, step: 0.1 })).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(S.simplifySteps({ min: 0, max: 1000, step: 1 }).length).toBe(101);
    expect(S.simplifySteps({ min: 0, max: 400, step: 1 }).length).toBe(401);
    expect(S.simplifySteps({ min: 3, max: 3, step: 1 })).toEqual([3]);
    expect(S.simplifyRunPlan([a]).length).toBe(11); // one input: its steps are everything
    const plan = S.simplifyRunPlan([a, b]);
    expect(plan.length).toBe(11 + 5 + 4 + S.SIMPLIFY_RANDOM_RUNS);
    expect(plan.slice(16, 20)).toEqual([[0, -1], [10, -1], [0, 1], [10, 1]]);
    expect(S.simplifyRunPlan([a, b])).toEqual(plan); // the same every time
  });

  test('inputs are checked: a worked-out rectangle is refused, min and max put in order, periods kept in range', () => {
    const sys = profitModel();
    const r = S.simplifyInputs(sys, [{ canvasId: 'c1', nodeId: 'rev', min: 0, max: 1 }, { canvasId: 'c1', nodeId: 'nope', min: 0, max: 1 },
      { canvasId: 'c1', nodeId: 'units', min: 9, max: 2, step: 1, periods: { mode: 'one', p: 7 } }, { canvasId: 'c1', nodeId: 'price', min: 'x', max: 1 }]);
    expect(r.problems.length).toBe(3);
    expect(r.problems[0]).toContain('Revenue');
    expect(r.inputs).toEqual([{ canvasId: 'c1', nodeId: 'units', name: 'Units', min: 2, max: 9, step: 1, mode: 'set', periods: { mode: 'all' } }]);
  });

  test('a 0 in every period is dropped from a + and from a − after its first input; kept elsewhere', () => {
    const sys = model([canvas('c1', 'Zeros', [
      value('x', 'X', 1, at(0, 0)), value('z1', 'Zero A', 0, at(0, 100)), op('add', '+', at(200, 50)), value('r1', 'Sum', undefined, at(300, 50)),
      value('z2', 'Zero B', 0, at(0, 200)), op('sub', '−', at(200, 250)), value('r2', 'Less zero', undefined, at(300, 250)),
      value('z3', 'Zero C', 0, at(0, 400)), op('sub0', '−', at(200, 450)), value('r3', 'Zero less', undefined, at(300, 450)),
      value('z4', 'Zero D', 0, at(0, 600)), op('mx', 'max', at(200, 650)), value('r4', 'At least zero', undefined, at(300, 650)),
    ], [['x', 'add'], ['z1', 'add'], ['add', 'r1'], ['x', 'sub'], ['z2', 'sub'], ['sub', 'r2'],
      ['z3', 'sub0'], ['x', 'sub0'], ['sub0', 'r3'], ['x', 'mx'], ['z4', 'mx'], ['mx', 'r4']].map(e => e))]);
    // Zero C sits above X (left to right, then top to bottom): move it before X.
    nodeIn(sys, 'c1', 'z3').x = -50;
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: -5, max: 5, step: 1 }]);
    expect(removedWhy(r, 'z1')).toBe('zero');
    expect(removedWhy(r, 'z2')).toBe('zero');
    expect(r.removed.find(x => x.nodeId === 'z1').text).toBe('0 in every period — dropped from + on Zeros');
    expect(nodeIn(r.system, 'c1', 'z3')).toBeTruthy(); // 0 − X needs its 0
    expect(nodeIn(r.system, 'c1', 'z4')).toBeTruthy(); // max(X, 0) too
    expect(r.zeros).toBe(2);
  });

  test('a period shift stays and what it reads is fixed; a corkscrew moved by its flow stays whole', () => {
    const sys = model([canvas('c1', 'Timing', [
      value('a', 'A', [1, 2, 3], at(0, 0)), value('b', 'B', 2, at(0, 100)), op('ab', '+', at(150, 50)), value('base', 'Base', undefined, at(250, 50)),
      shift('sh', at(400, 50)), value('x', 'X', 0, at(400, 200)), op('px', '+', at(550, 100)), value('r', 'Prior base plus X', undefined, at(650, 100)),
      // Close = Open + Flow; Open ← Close a period before, 100 in the first.
      value('flow', 'Flow', 10, at(0, 400)), value('open', 'Open', 100, at(200, 300)), op('cp', '+', at(350, 400)), value('close', 'Close', undefined, at(500, 400)), shift('sh2', at(350, 300)),
    ], [['a', 'ab'], ['b', 'ab'], ['ab', 'base'], ['base', 'sh'], ['sh', 'px'], ['x', 'px'], ['px', 'r'],
      ['open', 'cp'], ['flow', 'cp'], ['cp', 'close'], ['close', 'sh2'], ['sh2', 'open']])]);
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 3, step: 1 }, { canvasId: 'c1', nodeId: 'flow', min: 0, max: 20, step: 5, periods: { mode: 'one', p: 1 } }]);
    expect(nodeIn(r.system, 'c1', 'sh').type).toBe('periodShift');
    expect(nodeIn(r.system, 'c1', 'base').periodValues).toEqual([3, 4, 5]);
    expect(nodeIn(r.system, 'c1', 'ab')).toBeFalsy();
    ['open', 'cp', 'close', 'sh2', 'flow'].forEach(id => expect(nodeIn(r.system, 'c1', id), id).toBeTruthy());
    // The first period reads outside the timeline: Prior base plus X uses its own number, 0, in both.
    const v = rectValues(r.system, r.inputs, [1, null]);
    expect(v.get('c1/r')).toEqual([0, 4, 5]);
  });

  test('a block instance stays with its whole definition when it moves; one that doesn\'t is a fixed output, its definition gone when nothing uses it', () => {
    const def = (id) => canvas(id, 'Double ' + id, [value(id + 'in', 'In', 0, { x: 0, y: 0, blockRole: 'input' }), value(id + 'two', 'Two', 2, at(0, 100)),
      op(id + 'm', '×', at(150, 50)), value(id + 'out', 'Out', undefined, { x: 300, y: 50, blockRole: 'output' }), value(id + 'spare', 'Spare', 9, at(0, 300))],
    [[id + 'in', id + 'm'], [id + 'two', id + 'm'], [id + 'm', id + 'out']]);
    const sys = model([
      canvas('c1', 'Top', [
        value('x', 'X', 1, at(0, 0)), { id: 'b1', type: 'blockInstance', x: 150, y: 0, w: 170, h: 90, blockDefCanvasId: 'd1' }, value('r1', 'Doubled X', undefined, at(400, 0)),
        value('k', 'K', 5, at(0, 200)), { id: 'b2', type: 'blockInstance', x: 150, y: 200, w: 170, h: 90, blockDefCanvasId: 'd2' },
        op('p', '+', at(400, 150)), value('r2', 'Both', undefined, at(500, 150)),
      ], [['x', 'b1', { toPort: 0 }], ['b1', 'r1', { fromPort: 0 }], ['k', 'b2', { toPort: 0 }], ['r1', 'p'], ['b2', 'p', { fromPort: 0 }], ['p', 'r2']]),
      def('d1'), def('d2'),
    ]);
    nodeIn(sys, 'c1', 'p').x = 400; nodeIn(sys, 'c1', 'r1').y = 0;
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 4, step: 1 }]);
    // d1 stays whole, its spare rectangle too; d2 goes: b2's output is a fixed 10 beside it.
    expect(r.system.canvases.map(c => c.id)).toEqual(['c1', 'd1']);
    expect(r.system.canvases[1].nodes.map(n => n.id)).toEqual(['d1in', 'd1two', 'd1m', 'd1out', 'd1spare']);
    expect(nodeIn(r.system, 'c1', 'b2')).toBeFalsy();
    const fixedOut = nodeIn(r.system, 'c1', 'b2~out0');
    expect(fixedOut.text).toBe('Double d2 – Out\n10');
    expect(r.system.canvases[0].edges.some(e => e.from === 'b2~out0' && e.to === 'p' && e.fromPort === undefined)).toBe(true);
    expect(removedWhy(r, 'd2spare')).toBe('block');
    expect(r.removedCanvases.map(c => c.canvasId)).toEqual(['d2']);
  });

  test('an error in some runs and not others moves; the same error in every run doesn\'t', () => {
    const sys = model([canvas('c1', 'Errors', [
      value('x', 'X', 1, at(0, 0)), value('one', 'One', 1, at(0, -100)), op('d', '÷', at(150, 0)), value('r', 'One over X', undefined, at(300, 0)),
      value('zero', 'Zero', 0, at(0, 200)), op('d2', '÷', at(150, 200)), value('r2', 'One over zero', undefined, at(300, 200)),
    ], [['one', 'd'], ['x', 'd'], ['d', 'r'], ['one', 'd2'], ['zero', 'd2'], ['d2', 'r2']])]);
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: -1, max: 1, step: 1 }]);
    expect(nodeIn(r.system, 'c1', 'r')).toBeTruthy();
    expect(removedWhy(r, 'r2')).toBe('never-moved');
    // A kept item reading one that is always an error keeps it with its calculation.
    const sys2 = model([canvas('c1', 'Errors', [
      value('x', 'X', 1, at(0, 0)), value('one', 'One', 1, at(0, 100)), value('zero', 'Zero', 0, at(0, 200)), op('d2', '÷', at(150, 150)),
      op('ie', 'iferror', at(300, 50)), op('p', '+', at(450, 0)), value('r', 'X or one', undefined, at(600, 0)), value('two', 'Two', 2, at(150, 300)),
    ], [['one', 'd2'], ['zero', 'd2'], ['d2', 'ie'], ['two', 'ie'], ['x', 'p'], ['ie', 'p'], ['p', 'r']])]);
    const r2 = simplify(sys2, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 2, step: 1 }]);
    expect(nodeIn(r2.system, 'c1', 'ie').type).toBe('value'); // iferror gives 2: a fixed number
    expect(nodeIn(r2.system, 'c1', 'd2')).toBeFalsy();
  });

  test('every step is tried, and the corners find what only two inputs together move', () => {
    const sys = model([canvas('c1', 'Switches', [
      value('x', 'X', 0, at(0, 0)), value('seven', 'Seven', 7, at(0, 100)), op('eq', '=', at(150, 50)), value('r', 'X is seven', undefined, at(300, 50)),
      value('a', 'A', 0, at(0, 300)), value('b', 'B', 0, at(0, 400)), op('and', 'and', at(150, 350)), value('both', 'Both on', undefined, at(300, 350)),
    ], [['x', 'eq'], ['seven', 'eq'], ['eq', 'r'], ['a', 'and'], ['b', 'and'], ['and', 'both']])]);
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 10, step: 1 }, { canvasId: 'c1', nodeId: 'a', min: 0, max: 1, step: 1 }, { canvasId: 'c1', nodeId: 'b', min: 0, max: 1, step: 1 }]);
    expect(nodeIn(r.system, 'c1', 'r')).toBeTruthy();
    expect(nodeIn(r.system, 'c1', 'both')).toBeTruthy();
  });

  test('rounding noise is not a change (1e-9 × the value)', () => {
    const sys = model([canvas('c1', 'Noise', [
      value('x', 'X', 0.7, at(0, 0)), value('tenth', 'Tenth', 0.1, at(0, 100)), op('p', '+', at(150, 50)), op('s', '−', at(300, 0)), value('r', 'A tenth', undefined, at(450, 0)),
      op('m', '×', at(150, 300)), value('rx', 'Twice X', undefined, at(300, 300)), value('two', 'Two', 2, at(0, 300)),
    ], [['x', 'p'], ['tenth', 'p'], ['p', 's'], ['x', 's'], ['s', 'r'], ['x', 'm'], ['two', 'm'], ['m', 'rx']])]);
    nodeIn(sys, 'c1', 'x').y = 200; // X below the sum: the − reads (X + 0.1) − X
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 1, step: 0.1 }]);
    expect(removedWhy(r, 'r')).toBe('never-moved');
    expect(nodeIn(r.system, 'c1', 'rx')).toBeTruthy();
  });

  test('plugs: a 0 plugged into a socket goes with its canvas; a number plugged in stays, frozen, with its plug', () => {
    const sys = model([
      canvas('c1', 'Totals', [value('x', 'X', 1, at(0, 0)), op('sock', '+', { x: 300, y: 0, socket: 'Extras' }), value('tot', 'Total', undefined, at(450, 0)),
        { id: 'auto1', type: 'alias', auto: true, x: 100, y: 100, sourceCanvasId: 'c2', sourceNodeId: 'zero', plugs: [] }],
      [['x', 'sock'], ['sock', 'tot'], ['auto1', 'sock', { auto: true }]]),
      canvas('c2', 'Zero extras', [value('zero', 'Nothing', 0, { x: 0, y: 0, plugs: ['Extras'] })], []),
      canvas('c3', 'Some extras', [value('five', 'Base', 5, at(0, 0)), op('dbl', '×', at(150, 0)), value('two', 'Two', 2, at(0, 100)), value('ten', 'Ten', undefined, { x: 300, y: 0, plugs: ['Extras'] })],
        [['five', 'dbl'], ['two', 'dbl'], ['dbl', 'ten']]),
    ]);
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 3, step: 1 }]);
    expect(r.system.canvases.map(c => c.id)).toEqual(['c1', 'c3']);
    expect(removedWhy(r, 'zero')).toBe('zero');
    const ten = nodeIn(r.system, 'c3', 'ten');
    expect(ten.plugs).toEqual(['Extras']);
    expect(ten.text).toBe('Ten\n10');
    expect(r.system.canvases[1].nodes.map(n => n.id)).toEqual(['ten']);
    expect(r.system.canvases[0].nodes.some(n => n.auto)).toBe(false); // drawn again from the plugs
  });

  test('canvases left empty go; the ones that stay are unlinked from their templates; Keep anyway keeps an item or a canvas', () => {
    const sys = profitModel();
    sys.canvases[0].template = { family: 'abcdefgh-1234', version: 1, versionId: 'v1', name: 'Sales' };
    sys.canvases.push(canvas('c9', 'Notes', [value('n1', 'Unrelated', 3, at(0, 0))], [], { template: { family: 'zzzzzzzz-1', version: 2, versionId: 'v2', name: 'Notes' } }));
    let r = simplify(sys, [UNITS]);
    expect(r.system.canvases.map(c => c.id)).toEqual(['c1']);
    expect(r.system.canvases[0].template).toBeUndefined();
    expect(r.unlinked).toEqual([{ canvasId: 'c1', canvas: 'Sales' }]);
    expect(r.removedCanvases).toEqual([{ canvasId: 'c9', canvas: 'Notes', why: 'empty' }]);
    r = simplify(sys, [UNITS], { keep: [{ canvasId: 'c1', nodeId: 'other' }, { canvasId: 'c9' }] });
    expect(r.system.canvases.map(c => c.id)).toEqual(['c1', 'c9']);
    // Other stays with its calculation, back to the rectangles it reads (inputs here, as they were).
    ['other', 'm2', 'tax', 'over'].forEach(id => expect(nodeIn(r.system, 'c1', id), id).toBeTruthy());
    expect(nodeIn(r.system, 'c1', 'over').text).toBe('Overhead\n2');
  });

  test('× a fixed −1 feeding the second input of a two-input + or − is folded into it, and the −1 goes', () => {
    const sys = model([canvas('c1', 'Signs', [
      value('a', 'A', 10, at(0, 0)), value('x', 'X', 3, at(0, 100)), value('neg', 'Negative one', -1, at(0, 200)),
      op('m', '×', at(150, 150)), op('p', '+', at(300, 50)), value('r', 'A less X', undefined, at(450, 50)),
      // B − (Y × −1): folded to B + Y; Y sits above B, so the × becomes an alias of Y where it was.
      value('y', 'Y', 4, at(0, 300)), value('b', 'B', 1, at(0, 400)), value('neg2', 'Minus one', -1, at(0, 500)),
      op('m2', '×', at(150, 450)), op('s', '−', at(300, 400)), value('r2', 'B plus Y', undefined, at(450, 400)),
      // × −1 straight into a rectangle: nothing to fold into, the −1 stays.
      value('neg3', 'Flip', -1, at(0, 700)), op('m3', '×', at(150, 650)), value('r3', 'Minus X', undefined, at(300, 650)),
    ], [['a', 'p'], ['x', 'm'], ['neg', 'm'], ['m', 'p'], ['p', 'r'], ['b', 's'], ['y', 'm2'], ['neg2', 'm2'], ['m2', 's'], ['s', 'r2'],
      ['x', 'm3'], ['neg3', 'm3'], ['m3', 'r3']])]);
    // B sits left of the × so B is the −'s first input; Y further left still.
    nodeIn(sys, 'c1', 'b').x = -10;
    nodeIn(sys, 'c1', 'y').x = -20;
    const r = simplify(sys, [{ canvasId: 'c1', nodeId: 'x', min: 0, max: 5, step: 1 }, { canvasId: 'c1', nodeId: 'y', min: 0, max: 5, step: 1 }]);
    const n = (id) => nodeIn(r.system, 'c1', id);
    expect(n('p').text).toBe('−');
    expect(n('m')).toBeFalsy();
    expect(n('neg')).toBeFalsy();
    expect(r.system.canvases[0].edges.some(e => e.from === 'x' && e.to === 'p')).toBe(true);
    expect(n('s').text).toBe('+');
    expect(n('m2')).toEqual(expect.objectContaining({ type: 'alias', sourceCanvasId: 'c1', sourceNodeId: 'y' }));
    expect(n('neg2')).toBeFalsy();
    expect(n('neg3')).toBeTruthy();
    expect(r.folded.map(f => [f.nodeId, f.from, f.to])).toEqual([['m', '+', '−'], ['m2', '−', '+']]);
    expect(removedWhy(r, 'neg')).toBe('folded');
    expect(removedWhy(r, 'm')).toBe('folded');
  });

  test('a board\'s rectangles that don\'t move stay as fixed numbers unless 0; a scenario is one more run', () => {
    const sys = profitModel();
    // Other (0.6) is shown; Revenue moves; a scenario sets Tax rate, which no input reaches.
    let r = simplify(sys, [UNITS], { shown: [{ canvasId: 'c1', nodeId: 'other' }, { canvasId: 'c1', nodeId: 'rev' }] });
    expect(nodeIn(r.system, 'c1', 'other').text).toBe('Other\n0.6');
    expect(r.fixed.find(f => f.nodeId === 'other').text).toBe('kept as a fixed number, shown on a board');
    r = simplify(sys, [UNITS], { extraRuns: [[{ canvasId: 'c1', nodeId: 'tax', value: 0.5, mode: 'set', periods: { mode: 'all' } }]] });
    ['other', 'm2', 'tax'].forEach(id => expect(nodeIn(r.system, 'c1', id), id).toBeTruthy());
    // A 0 shown on a board goes.
    const zeroSys = profitModel();
    nodeIn(zeroSys, 'c1', 'tax').text = 'Tax rate\n0';
    r = simplify(zeroSys, [UNITS], { shown: [{ canvasId: 'c1', nodeId: 'other' }] });
    expect(nodeIn(r.system, 'c1', 'other')).toBeFalsy();
  });

  test('the manual\'s sample (lesson 8.5): Units from 0 to 10 keeps 7 of 11 items, in 11 runs', () => {
    const doc = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'simplify', 'profit-plan.fmide'), 'utf8'));
    const r = simplify(doc.system, [{ canvasId: 'c1', nodeId: 'units', min: 0, max: 10, step: 1 }]);
    expect([r.kept, r.total, r.canvases.kept, r.canvases.total, r.fixed.length, r.zeros, r.runs]).toEqual([7, 11, 1, 2, 2, 0, 11]);
    expect(r.removed.map(x => x.name)).toEqual(['Fixed cost', 'Overhead', '+ operator', 'Unrelated']);
    expect(nodeIn(r.system, 'c1', 'costs').text).toBe('Costs\n7');
    expect(rectValues(r.system, r.inputs, [null]).get('c1/profit')).toEqual([33, 33]);
    expect(rectValues(r.system, r.inputs, [10]).get('c1/profit')).toEqual([93, 93]);
  });

  test('canvases always kept (the document\'s simplifyAlwaysKeep) are kept whole and listed; an id no canvas has is ignored', () => {
    const sys = profitModel();
    sys.canvases.push(canvas('audit', 'Audit', [value('chk', 'Check', 1, at(0, 0)), value('chk2', 'Check two', 0, at(0, 100))], []));
    const r = simplify(sys, [UNITS], { alwaysKeep: ['audit', 'nope', 'audit'] });
    expect(r.alwaysKept).toEqual([{ canvasId: 'audit', canvas: 'Audit' }]);
    expect(r.system.canvases.map(c => c.id)).toEqual(['c1', 'audit']);
    expect(r.system.canvases[1].nodes.map(n => n.id)).toEqual(['chk', 'chk2']);
  });

  test('the inputs a board file moves, each with why; an input left out takes its sliders and the scenarios setting it', () => {
    const file = { kind: 'fmIDE-graph-board', version: 14,
      boards: [{ name: 'Lesson', items: [{ type: 'bar', canvasId: 'c1', nodeId: 'profit' }],
        sliders: [{ canvasId: 'c1', nodeId: 'units', name: 'Units', min: 0, max: 10, step: 1, mode: 'set', periods: { mode: 'all' } },
          { canvasId: 'c1', nodeId: 'price', name: 'Price', min: 5, max: 15, step: 1, mode: 'set', periods: { mode: 'all' } }] },
      { name: 'More', items: [], sliders: [{ canvasId: 'c1', nodeId: 'units', name: 'Units', min: 0, max: 10, step: 1, mode: 'set', periods: { mode: 'all' } }] }],
      scenarios: [{ name: 'Cheap', sliders: [{ canvasId: 'c1', nodeId: 'price', name: 'Price', value: 5, mode: 'set', periods: { mode: 'all' } }] },
        { name: 'Big', sliders: [{ canvasId: 'c1', nodeId: 'units', name: 'Units', value: 9, mode: 'set' }, { canvasId: 'c1', nodeId: 'fixed', name: 'Fixed cost', value: 1, mode: 'set' }] }] };
    let p = S.simplifyBoardInputs(file, []);
    expect(p.inputs.map(x => [x.name, x.boards, x.scenarios, x.on])).toEqual([
      ['Units', ['Lesson', 'More'], ['Big'], true], ['Price', ['Lesson'], ['Cheap'], true], ['Fixed cost', [], ['Big'], true]]);
    expect(p.sliders.map(s => s.nodeId)).toEqual(['units', 'price']); // Units once
    expect(p.scenarios.kept.map(s => s.name)).toEqual(['Cheap', 'Big']);
    expect(p.shown).toEqual([{ canvasId: 'c1', nodeId: 'profit' }]);
    p = S.simplifyBoardInputs(file, [{ canvasId: 'c1', nodeId: 'price' }, { canvasId: 'c1', nodeId: 'fixed' }]);
    expect(p.sliders.map(s => s.nodeId)).toEqual(['units']);
    expect(p.scenarios.kept).toEqual([]);
    expect(p.scenarios.left).toEqual([{ name: 'Cheap', because: ['Price'] }, { name: 'Big', because: ['Fixed cost'] }]);
    const pruned = S.simplifyBoardsWithout(file, [{ canvasId: 'c1', nodeId: 'price' }], p.scenarios.left);
    expect(pruned.boards[0].sliders.map(s => s.nodeId)).toEqual(['units']);
    expect(pruned.scenarios).toEqual([]);
    expect(file.scenarios.length).toBe(2); // a copy
    // Simplified with Units alone (Price and Fixed cost left out): Price stays an input, Costs fixed.
    const r = simplify(profitModel(), p.sliders, { extraRuns: p.scenarios.kept.map(s => s.settings), shown: p.shown });
    expect(r.kept).toBe(7);
  });

  test('the Excel layout: tabs and rows of what is gone go; an empty row stays only beside a kept row, never two together; looks kept', () => {
    const sys = profitModel();
    sys.canvases.push(canvas('c2', 'Notes', [value('n1', 'Unrelated', 3, at(0, 0))], []));
    const row = (id, order, extra) => Object.assign({ id: 'c1|' + id, canvasId: 'c1', nodeId: id, path: [], tabId: 'tab_c1', section: 'calc', order, flatOrder: order, label: id, include: true }, extra || {});
    const empty = (id, order, tabId) => ({ id, isCustom: true, tabId: tabId || 'tab_c1', section: 'calc', label: '', style: null, order, flatOrder: order });
    const layout = { kind: 'fmIDE-excel-mapping', version: 11,
      tabs: [{ id: 'tab__inputs', name: 'Inputs', order: 0 }, { id: 'tab_c1', name: 'Sales', order: 1 }, { id: 'tab_c2', name: 'Notes', order: 2 }],
      rows: [row('units', 0), row('price', 1), row('rev', 3), row('fixed', 6), row('over', 7), row('costs', 9), row('profit', 11, { style: { font: { color: '#475569', weight: 'bold' } } }),
        { id: 'c2|n1', canvasId: 'c2', nodeId: 'n1', path: [], tabId: 'tab_c2', section: 'input', order: 0, flatOrder: 0, label: 'Unrelated' }],
      customRows: [empty('e2', 2), empty('e4', 4), empty('e5', 5), empty('e8', 8), empty('e10', 10), { id: 'h1', isCustom: true, tabId: 'tab_c1', section: 'calc', label: 'Costs below', order: 5.5, flatOrder: 5.5 },
        empty('n-e', 1, 'tab_c2'), { id: 'custom_inpgrp_tab:tab_c2', isCustom: true, autoInputsGroup: 'tab:tab_c2', tabId: 'tab__inputs', section: 'input', label: 'Notes', order: 0, flatOrder: 0 }],
      inputRows: [{ id: 'inp|c2|n1', sourceRowId: 'c2|n1', isInputMirror: true, tabId: 'tab__inputs', canvasId: 'c2', nodeId: 'n1', path: [], order: 1, flatOrder: 1 }],
      cfg: { sectionsEnabled: false, inputsTab: { enabled: true } } };
    const r = simplify(sys, [UNITS]);
    const before = JSON.stringify(layout);
    const x = S.simplifyExcelLayout(layout, r.system);
    expect(JSON.stringify(layout)).toBe(before); // a copy
    expect(x.layout.tabs.map(t => t.id)).toEqual(['tab__inputs', 'tab_c1']);
    expect(x.layout.rows.map(rw => rw.nodeId)).toEqual(['units', 'price', 'rev', 'costs', 'profit']);
    expect(x.layout.rows.find(rw => rw.nodeId === 'profit').style).toEqual({ font: { color: '#475569', weight: 'bold' } });
    // Units Price e2 Rev e4 (e5 gone: no kept row beside it) [Costs below] e8 Costs e10 Profit: e4 beside Rev, e8
    // beside Costs, e10 between Costs and Profit; the heading stays.
    expect(x.layout.customRows.map(c => c.id)).toEqual(['e2', 'e4', 'e8', 'e10', 'h1']);
    expect(x.layout.inputRows).toEqual([]);
    expect(x.dropped).toEqual({ tabs: 1, rows: 4, empties: 1 });
    // Without the heading, e4 and e8 would be two empties together: one goes.
    const noHeading = Object.assign({}, layout, { customRows: layout.customRows.filter(c => c.id !== 'h1') });
    expect(S.simplifyExcelLayout(noHeading, r.system).layout.customRows.map(c => c.id)).toEqual(['e2', 'e4', 'e10']);
    // With sections on, each section is a run of its own (by `order`): Costs and e8 in output; in calc,
    // e4 and e10 end up together, so e10 goes.
    const sectioned = JSON.parse(JSON.stringify(noHeading));
    sectioned.cfg.sectionsEnabled = true;
    sectioned.rows.find(rw => rw.nodeId === 'costs').section = 'output';
    sectioned.customRows.find(c => c.id === 'e8').section = 'output';
    expect(S.simplifyExcelLayout(sectioned, r.system).layout.customRows.map(c => c.id)).toEqual(['e2', 'e4', 'e8']);
    // Not a layout: left as it was.
    expect(S.simplifyExcelLayout(null, r.system).layout).toBeNull();
  });

  test('a job works in pieces and reports its progress', () => {
    const sys = profitModel();
    const { inputs } = S.simplifyInputs(sys, [UNITS]);
    const job = S.simplifyJob(sys, inputs);
    let pieces = 0;
    while(!job.step(0)){ pieces++; expect(job.progress).toBeGreaterThanOrEqual(0); expect(job.progress).toBeLessThan(1); }
    expect(pieces).toBeGreaterThan(10);
    expect(job.progress).toBe(1);
    expect(job.result.kept).toBe(7);
    expect(job.result.checked.ok).toBe(true);
  });
});
