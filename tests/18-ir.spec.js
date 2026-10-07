// 18. The shared IR (src/shared/operators.js, uom.js, ir.js) and fmIDE's values on it.
// - Pinned: for every sample model, fmIDE's value or error message for every rectangle,
//   operator, alias, period shift and block instance in every period, and every unit shown on
//   the canvas. Taken from fmIDE before it ran on the IR, so the switch changed nothing.
// - Units on the canvas: known answers.
// After a deliberate change: npm run test:update-snapshots
const fs = require('fs');
const path = require('path');
const { test, expect, fixture, FIXTURES } = require('./helpers/apps');
const { openFmIDE, importViaCommand, acceptAll } = require('./helpers/fmide');
const { matchSnapshot } = require('./helpers/snapshot');

const jsonIn = (dir) => fs.readdirSync(path.join(FIXTURES, dir)).filter(f => f.endsWith('.json')).sort().map(f => [dir, f]);
const CASES = jsonIn('models').concat(jsonIn('agreement'), jsonIn('ir'));

// Everything fmIDE shows for one model: { canvas: { nodeId: { values[], unit? } } }, where a
// value is a number, a block instance's list of outputs, or the error message.
async function fmideState(page, file){
  await openFmIDE(page);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  await importViaCommand(page, json.kind === 'fmIDE-workspace' ? 'importWorkspace' : 'loadSystem', file);
  await acceptAll(page);
  await page.waitForFunction((n) => fm.canvases().length === n, (json.system || json).canvases.length);
  return page.evaluate(() => {
    const out = {};
    fm.canvases().forEach(c => {
      fm.switchCanvas(c.name);
      const nodes = {};
      fm.nodes().forEach(n => {
        const values = [];
        for(let p = 1; ; p++){
          try{ values.push(fm.getValue('#' + n.id, p)); }
          catch(e){ if(/There is no period/.test(e.message)) break; values.push('error: ' + e.message); }
        }
        const entry = { values };
        const uom = document.querySelector(`.node[data-id="${n.id}"] .line-uom`);
        if(uom && uom.textContent) entry.unit = uom.textContent + (uom.classList.contains('auto') ? ' (auto)' : '');
        nodes[n.id] = entry;
      });
      out[c.name] = nodes;
    });
    return out;
  });
}

for(const [dir, model] of CASES){
  test(`${dir}/${model}: fmIDE's values, errors and units are unchanged`, async ({ page }, testInfo) => {
    const state = await fmideState(page, fixture(dir, model));
    matchSnapshot(testInfo, 'fmide-values--' + dir + '--' + model.replace(/\.json$/, ''), state);
  });
}

test('units on the canvas: worked out from the inputs, or typed', async ({ page }) => {
  const state = await fmideState(page, fixture('ir', 'units.json'));
  const unit = (canvas, id) => state[canvas][id].unit || '';
  expect(unit('Units', 'price')).toBe('$/t');                    // typed
  expect(unit('Units', 'rev')).toBe('$k (auto)');                // $/t × kt
  expect(unit('Units', 'back')).toBe('t/$ (auto)');              // kt ÷ $k (inputs go left to right)
  expect(unit('Units', 'tot')).toBe('$k (auto)');                // $k + $k
  expect(unit('Units', 'mism')).toBe('');                        // $/t + kt: no unit
  expect(unit('Units', 'prior')).toBe('$k (auto)');              // through a period shift
  expect(unit('Units', 'typed')).toBe('USD');                    // a typed unit wins
  expect(unit('Units', 'pow')).toBe('');                         // ^ has no unit rule
  expect(unit('Units', 'mxr')).toBe('$k (auto)');                // max of $k and $k
  expect(unit('Units', 'per')).toBe('');                         // $k ÷ $k: no unit left
  expect(unit('Units', 'bout')).toBe('');                        // block outputs: none
  expect(unit('Linked', 'la')).toBe('$k (auto)');                // an alias shows its source's unit
  expect(unit('Linked', 'lr')).toBe('$k (auto)');                // and passes it on
  expect(unit('Linked', 'lb')).toBe('$/t (auto)');
});

// Changing a unit shows at once, before any Evaluate, and so does undoing it.
test('units follow an edit and its undo straight away', async ({ page }) => {
  await openFmIDE(page);
  await importViaCommand(page, 'loadSystem', fixture('ir', 'units.json'));
  await acceptAll(page);
  await page.waitForFunction(() => fm.canvases().length === 3);
  const unitOn = (id) => page.locator(`.node[data-id="${id}"] .line-uom`);
  await expect(unitOn('rev')).toHaveText('$k');
  await page.evaluate(() => fm.setUOM('#price', '€/t'));
  await expect(unitOn('rev')).toHaveText('€k');
  await expect(unitOn('tot')).toHaveText('');                    // €k + $k: no unit
  await page.evaluate(() => fm.command('undo'));
  await expect(unitOn('rev')).toHaveText('$k');
  await expect(unitOn('tot')).toHaveText('$k');
});

// ---- the shared IR on its own, in Node: no browser, no app ----
// The shared modules, required as they are (step 3c): compileModel can only use what they
// import, so any use of fmIDE's own state would fail here. (functions.js too: samples may carry
// functions; ir.js imports it.)
function loadIR(){
  return Object.assign({}, require('../src/shared/operators.js'), require('../src/shared/uom.js'), require('../src/shared/ir.js'));
}
const SNAPSHOTS = path.join(__dirname, 'snapshots');

for(const [dir, model] of CASES){
  test(`${dir}/${model}: compileModel alone gives fmIDE's values and units, and leaves the file as it was`, () => {
    const IR = loadIR();
    const json = JSON.parse(fs.readFileSync(fixture(dir, model), 'utf8'));
    const system = json.system || json;
    const before = JSON.stringify(system);
    const ir = IR.compileModel(system);
    const results = IR.evaluateModel(ir);
    expect(JSON.stringify(system)).toBe(before);

    const pinned = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS, 'fmide-values--' + dir + '--' + model.replace(/\.json$/, '') + '.json'), 'utf8'));
    system.canvases.forEach((c, ci) => {
      const r = results[ci];
      (c.nodes || []).forEach(n => {
        // An automatic alias saved in the file is fmIDE's drawing of a plug link: fmIDE redraws
        // it (new id) on opening, and compileModel works the links out from the names itself.
        if(n.type === 'alias' && n.auto) return;
        const shown = pinned[c.name][n.id];
        shown.values.forEach((v, p) => {
          const where = `${c.name} ${n.id} period ${p + 1}`;
          // + 0 turns -0 into 0, as the JSON snapshot does.
          if(n.type === 'blockInstance') expect(r.portValues[p][n.id].map(x => x === null ? null : x + 0), where).toEqual(v);
          else if(typeof v === 'number') expect(r.values[p][n.id] + 0, where).toBe(v);
          else{
            expect(r.values[p][n.id], where).toBeUndefined();
            expect(r.errors[p][n.id], where).toBeTruthy();
          }
        });
        if(n.type === 'value' || n.type === 'alias'){
          const lines = (n.text || '').split('\n');
          const typed = n.type === 'value' && lines.length >= 3 ? lines[2].trim() : '';
          const unit = IR.unitOf(ir, c.id, n.id);
          const expected = typed || (unit && IR.formatUOM(unit) ? IR.formatUOM(unit) + ' (auto)' : '');
          expect(expected, `${c.name} ${n.id} unit`).toBe(shown.unit || '');
        }
      });
    });
  });
}

// The catalogue's ids are lasting: plugins and saved references will use them.
test('the operator catalogue: lasting ids, one symbol each, in palette order', () => {
  const IR = loadIR();
  expect(IR.OPERATORS.map(op => op.id)).toEqual(['add', 'subtract', 'multiply', 'divide', 'power', 'mod', 'le', 'ge', 'lt', 'gt', 'abs', 'min', 'max', 'average', 'iferror',
    'period', 'if', 'eq', 'ne', 'and', 'or', 'not', 'round', 'roundup', 'rounddown', // phase E1 added the second line, at the end
    'ln', 'exp', 'sqrt', 'int', 'trunc', 'choose']); // and phases E2a and E2b the third
  expect(IR.OPERATORS.map(op => op.symbol)).toEqual(['+', '−', '×', '÷', '^', '%', '≤', '≥', '<', '>', 'abs', 'min', 'max', 'ave', 'iferror',
    'period', 'if', '=', '≠', 'and', 'or', 'not', 'round', 'roundup', 'rounddown',
    'ln', 'exp', 'sqrt', 'int', 'trunc', 'choose']);
  IR.OPERATORS.forEach(op => {
    const kinds = ['fold', 'all', 'unary', 'compare', 'fallback', 'period', 'branches', 'apply'].filter(k => op[k]);
    expect(kinds, op.id).toHaveLength(1);
    expect(IR.operatorById(op.id)).toBe(op);
    expect(IR.operatorForSymbol(op.symbol)).toBe(op);
  });
  expect(IR.operatorForSymbol('foo')).toBeNull();
  const apply = (id, vs) => IR.applyOperator(IR.operatorById(id), vs);
  expect(apply('mod', [-7, 3])).toEqual({ value: 2 });
  expect(apply('divide', [1, 0])).toEqual({ error: 'math-error' });
  expect(apply('abs', [1, 2])).toEqual({ error: 'unary-only' });
  expect(apply('lt', [1])).toEqual({ error: 'needs-two' });
  expect(apply('lt', [1, 3, 2])).toEqual({ value: 0 });
  // Phase E1: an unknown operator is an error (it passed its first input through before).
  expect(IR.applyOperator(null, [4, 5])).toEqual({ error: 'operator-unknown' });
  expect(apply('eq', [0.1 + 0.2, 0.3])).toEqual({ value: 1 });               // equal as Excel compares
  expect(apply('lt', [0.3, 0.1 + 0.2])).toEqual({ value: 0 });
  expect(apply('ne', [1, 2])).toEqual({ value: 1 });
  expect(apply('and', [1, 2, 0])).toEqual({ value: 0 });
  expect(apply('or', [0, 0, -3])).toEqual({ value: 1 });
  expect(apply('not', [0])).toEqual({ value: 1 });
  expect(apply('not', [1, 2])).toEqual({ error: 'unary-only' });
  expect(apply('round', [2.675, 2])).toEqual({ value: 2.68 });
  expect(apply('round', [-1250, -2])).toEqual({ value: -1300 });
  expect(apply('roundup', [1.21, 1])).toEqual({ value: 1.3 });
  expect(apply('rounddown', [-1.29, 1])).toEqual({ value: -1.2 });
  expect(apply('round', [1, Infinity])).toEqual({ error: 'math-error' });
  expect(IR.operatorById('if').ports).toEqual(['condition', 'then', 'else']);
  expect(IR.operatorById('round').ports).toEqual(['value', 'digits']);
  // Phase E2a: one input each; what Excel calls #NUM! is a math error.
  expect(apply('ln', [Math.E])).toEqual({ value: 1 });
  expect(apply('ln', [0])).toEqual({ error: 'math-error' });
  expect(apply('ln', [-1])).toEqual({ error: 'math-error' });
  expect(apply('exp', [0])).toEqual({ value: 1 });
  expect(apply('exp', [1000])).toEqual({ error: 'math-error' });
  expect(apply('sqrt', [9])).toEqual({ value: 3 });
  expect(apply('sqrt', [-4])).toEqual({ error: 'math-error' });
  expect(apply('int', [-2.5])).toEqual({ value: -3 });
  expect(apply('trunc', [-2.5])).toEqual({ value: -2 });
  expect(Object.is(apply('trunc', [-0.5]).value, 0)).toBe(true); // never −0
  expect(apply('int', [(0.1 + 0.7) * 10])).toEqual({ value: 7 }); // as Excel: on the number as stored
  expect(apply('sqrt', [4, 9])).toEqual({ error: 'unary-only' });
  expect(['ln', 'exp', 'sqrt', 'int', 'trunc'].map(id => IR.operatorById(id).unit)).toEqual([null, null, null, 'same', 'same']);
  // Phase E2b: choose's index picks a choice (cut to a whole number), or none.
  const choose = IR.operatorById('choose');
  expect([2, 2.7, 1, 3, 0, 0.9, -1, 4, NaN].map(i => choose.pick(i, 3))).toEqual([2, 2, 1, 3, 0, 0, 0, 0, 0]);
  expect(IR.operatorPortNames(choose, 3)).toEqual(['index', 'choice 1', 'choice 2', 'choice 3']);
  expect(IR.operatorPortNames(choose, 999)).toHaveLength(255);                 // Excel's 254 choices
  expect(IR.chooseChoiceCount([0, 1, 3, undefined, 'x', 300])).toBe(3);        // the highest choice wired
  expect(IR.operatorPortNames(IR.operatorById('if'), 7)).toEqual(['condition', 'then', 'else']);
});

// ---- phase E1 in fmIDE, through window.fm (the canvas drawing of named inputs is E1b) ----
const F = require('./helpers/fmide');
test.describe('phase E1 operators in fmIDE', () => {
  // A small model built through fm: Period → flag; IF(flag, Revenue, Cost); ROUND.
  async function build(page){
    await openFmIDE(page);
    return page.evaluate(() => {
      fm.clearCanvas();
      fm.setPeriodCount(3);
      const rev = fm.createRect({ x: 0, y: 0, name: 'Revenue', value: 100.456, uom: '$k' });
      const cost = fm.createRect({ x: 0, y: 100, name: 'Cost', value: 60, uom: '$k' });
      const two = fm.createRect({ x: 200, y: 200, name: 'Two', value: 2 });
      const per = fm.createOperator({ x: 0, y: 200, op: 'period' });
      const p = fm.createRect({ x: 100, y: 200, name: 'Period' });
      fm.connect('#' + per, '#' + p);
      const ge = fm.createOperator({ x: 300, y: 200, op: '≥' });
      fm.connect('#' + p, '#' + ge); fm.connect('#' + two, '#' + ge);
      const iff = fm.createOperator({ x: 400, y: 100, op: 'if' });
      fm.connect('#' + ge, '#' + iff, '', 'condition');
      fm.connect('#' + rev, '#' + iff, '', 'Then');      // any capitals
      fm.connect('#' + cost, '#' + iff, '', '3');        // or the number, from 1
      const pick = fm.createRect({ x: 500, y: 100, name: 'Picked' });
      fm.connect('#' + iff, '#' + pick);
      const digits = fm.createRect({ x: 400, y: 300, name: 'Digits', value: 1 });
      const rnd = fm.createOperator({ x: 550, y: 200, op: 'round' });
      fm.connect('#' + pick, '#' + rnd, '', 'value'); fm.connect('#' + digits, '#' + rnd, '', 'digits');
      const out = fm.createRect({ x: 650, y: 200, name: 'Rounded' });
      fm.connect('#' + rnd, '#' + out);
      return { iff, rnd };
    });
  }
  const values = (page, name) => page.evaluate((n) => [1, 2, 3].map(p => { try{ return fm.getValue(n, p); }catch(e){ return 'error: ' + e.message; } }), name);

  test('fm creates them and wires IF and ROUND by input name or number; values and units', async ({ page }) => {
    await build(page);
    expect(await values(page, 'Period')).toEqual([1, 2, 3]);
    expect(await values(page, 'Picked')).toEqual([60, 100.456, 100.456]);
    expect(await values(page, 'Rounded')).toEqual([60, 100.5, 100.5]);
    // A wrong input name says which ones there are.
    const err = await page.evaluate(({ rnd }) => { try{ fm.connect('Revenue', '#' + rnd, '', 'places'); }catch(e){ return e.message; } }, await page.evaluate(() => ({ rnd: fm.nodes().find(n => n.text === 'round').id })));
    expect(err).toMatch(/has no input called "places" \(its inputs: value, digits\)/);
    const none = await page.evaluate(() => { try{ fm.connect('Revenue', '#' + fm.nodes().find(n => n.text === 'if').id); }catch(e){ return e.message; } });
    expect(none).toMatch(/takes each input by name — say which one \(condition, then, else\)/);
  });

  test('saved as system v9 (v6 brought toPort) with toPort; loading it again calculates the same; deleting an input by name', async ({ page }) => {
    await build(page);
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
    expect(data.version).toBe(9);
    const iff = data.canvases[0].nodes.find(n => n.text === 'if');
    expect(data.canvases[0].edges.filter(e => e.to === iff.id).map(e => e.toPort).sort()).toEqual([0, 1, 2]);
    await page.evaluate(() => fm.clearCanvas());
    const file = test.info().outputPath('e1.json');
    fs.writeFileSync(file, JSON.stringify(data));
    await importViaCommand(page, 'loadSystem', file);
    await acceptAll(page);
    expect(await values(page, 'Rounded')).toEqual([60, 100.5, 100.5]);
    await page.evaluate(() => fm.deleteEdge('Cost', '#' + fm.nodes().find(n => n.text === 'if').id, 'else'));
    expect(await values(page, 'Picked')).toEqual([expect.stringMatching(/could not be computed/), 100.456, 100.456]);
    const ifId = await page.evaluate(() => '#' + fm.nodes().find(n => n.text === 'if').id);
    expect(await values(page, ifId)).toEqual([expect.stringMatching(/An input this operator reads isn't connected/), 100.456, 100.456]);
  });

  test('a macro records the inputs by name; every operator has an Insert Operator command (E1b)', async ({ page }) => {
    await openFmIDE(page);
    await page.evaluate(() => fm.command('toggleRecord'));
    await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
    await page.evaluate(() => {
      const a = fm.createRect({ x: 0, y: 0, name: 'A', value: 1 });
      const iff = fm.createOperator({ x: 200, y: 0, op: 'if' });
      fm.connect('#' + a, '#' + iff, '', '2');
    });
    await page.evaluate(() => fm.command('toggleRecord'));
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    const steps = data.macros[data.macros.length - 1].steps;
    expect(steps.map(s => s.action)).toEqual(['createRect', 'createOperator', 'connect']);
    expect(steps[2].args.toPort).toBe('then');
    // Since E1b the new operators follow the first 15, whose numbers stay the same.
    const insertOps = await page.evaluate(() => fm.commands().filter(c => /^insertOp\d+$/.test(c.id)).map(c => c.id + ' ' + c.label));
    expect(insertOps).toHaveLength(31);
    expect(insertOps[0]).toBe('insertOp0 Insert Operator + (Add)');
    expect(insertOps[14]).toBe('insertOp14 Insert Operator iferror');
    expect(insertOps.slice(15)).toEqual(['insertOp15 Insert Operator period', 'insertOp16 Insert Operator if', 'insertOp17 Insert Operator = (Equal)',
      'insertOp18 Insert Operator ≠ (Not equal)', 'insertOp19 Insert Operator and', 'insertOp20 Insert Operator or', 'insertOp21 Insert Operator not',
      'insertOp22 Insert Operator round', 'insertOp23 Insert Operator roundup', 'insertOp24 Insert Operator rounddown',
      // Phase E2a's after those.
      'insertOp25 Insert Operator ln', 'insertOp26 Insert Operator exp', 'insertOp27 Insert Operator sqrt', 'insertOp28 Insert Operator int',
      'insertOp29 Insert Operator trunc', 'insertOp30 Insert Operator choose']);
  });

  // ---- E1b: the canvas ----
  const opNode = (page, id) => page.locator(`.node[data-id="${id}"]`);
  const edgesInto = (page, id) => page.evaluate((id) => fm.edges().filter(e => e.to === id).map(e => fm.nodes().find(n => n.id === e.from).text.split('\n')[0] + '→' + e.toPort).sort(), id);

  test('if and round draw a labelled dot per input; the period number and the others draw as before', async ({ page }) => {
    const { iff, rnd } = await build(page);
    await expect(opNode(page, iff)).toHaveClass(/portop/);
    await expect(opNode(page, iff).locator('.opsym')).toHaveText('if');
    await expect(opNode(page, iff).locator('.op-in .io-label')).toHaveText(['condition', 'then', 'else']);
    await expect(opNode(page, iff).locator('.io-port[data-port-dir="in"]')).toHaveCount(3);
    await expect(opNode(page, rnd).locator('.op-in .io-label')).toHaveText(['value', 'digits']);
    const per = await page.evaluate(() => fm.nodes().find(n => n.text === 'period').id);
    await expect(opNode(page, per)).not.toHaveClass(/portop/);
    await expect(opNode(page, per).locator('.io-port')).toHaveCount(0);
    // Each arrow ends on its own input's dot, with no order badge (order doesn't set the input).
    const ends = await page.evaluate((iff) => {
      const canvasRect = document.getElementById('canvas').getBoundingClientRect();
      return fm.edges().filter(e => e.to === iff).map(e => {
        const g = document.querySelector(`g.edge[data-id="${e.id}"]`);
        const end = g.querySelector('path').getAttribute('d').trim().split(/\s+/).slice(-2).map(Number);
        const dot = document.querySelector(`.node[data-id="${iff}"] .io-port[data-port-index="${e.toPort}"]`).getBoundingClientRect();
        return { port: e.toPort, dx: Math.round(end[0] - (dot.left + dot.width / 2 - canvasRect.left)), dy: Math.round(end[1] - (dot.top + dot.height / 2 - canvasRect.top)), badge: !!g.querySelector('.order-badge') };
      }).sort((a, b) => a.port - b.port);
    }, iff);
    expect(ends).toEqual([0, 1, 2].map(port => ({ port, dx: 0, dy: 0, badge: false })));
    // The picker offers every operator.
    await page.evaluate(() => fm.command('insertOp16'));
    const added = await page.evaluate(() => fm.nodes().filter(n => n.text === 'if').length);
    expect(added).toBe(2);
  });

  test('dragging an arrow onto an input\'s dot, or onto the body (its first free input); none into the period number', async ({ page }) => {
    await openFmIDE(page);
    const ids = await page.evaluate(() => {
      fm.clearCanvas();
      const a = fm.createRect({ x: 40, y: 40, name: 'Flag', value: 1 });
      const b = fm.createRect({ x: 40, y: 160, name: 'Yes', value: 10 });
      const c = fm.createRect({ x: 40, y: 280, name: 'No', value: 20 });
      const iff = fm.createOperator({ x: 400, y: 140, op: 'if' });
      const per = fm.createOperator({ x: 400, y: 320, op: 'period' });
      return { a, b, c, iff, per };
    });
    const drag = async (fromId, target) => {
      const a = await page.locator(`.node[data-id="${fromId}"] .label`).boundingBox();
      const b = await target.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
      await page.mouse.up({ button: 'right' });
    };
    await drag(ids.c, opNode(page, ids.iff).locator('.io-port[data-port-dir="in"][data-port-index="2"]'));
    expect(await edgesInto(page, ids.iff)).toEqual(['No→2']);
    await drag(ids.a, opNode(page, ids.iff).locator('.opsym'));
    await drag(ids.b, opNode(page, ids.iff).locator('.opsym'));
    expect(await edgesInto(page, ids.iff)).toEqual(['Flag→0', 'No→2', 'Yes→1']);
    await drag(ids.b, opNode(page, ids.iff).locator('.opsym'));
    expect(await F.dialogText(page)).toMatch(/Every input of .* already has an arrow/);
    await F.dismissMessage(page);
    expect(await page.evaluate((iff) => fm.getValue('#' + iff), ids.iff)).toBe(10);
    await drag(ids.a, opNode(page, ids.per));
    expect(await F.dialogText(page)).toMatch(/The period number takes no inputs/);
    await F.dismissMessage(page);
    expect(await edgesInto(page, ids.per)).toEqual([]);
  });

  test('changing an operator\'s symbol: its arrows take the named inputs left to right, and give them up again', async ({ page }) => {
    await openFmIDE(page);
    const ids = await page.evaluate(() => {
      fm.clearCanvas();
      const c = fm.createRect({ x: 40, y: 40, name: 'Cond', value: 0 });
      const t = fm.createRect({ x: 60, y: 160, name: 'Then', value: 1 });
      const e = fm.createRect({ x: 80, y: 280, name: 'Else', value: 2 });
      const op = fm.createOperator({ x: 400, y: 140, op: '+' });
      ['Cond', 'Then', 'Else'].forEach(n => fm.connect(n, '#' + op));
      return { op };
    });
    await page.evaluate((op) => fm.setOperator('#' + op, 'if'), ids.op);
    expect(await edgesInto(page, ids.op)).toEqual(['Cond→0', 'Else→2', 'Then→1']);
    expect(await page.evaluate((op) => fm.getValue('#' + op), ids.op)).toBe(2);
    await expect(opNode(page, ids.op)).toHaveClass(/portop/);
    await page.evaluate((op) => fm.setOperator('#' + op, 'round'), ids.op);
    expect(await edgesInto(page, ids.op)).toEqual(['Cond→0', 'Else→undefined', 'Then→1']);
    await expect(opNode(page, ids.op).locator('.op-in .io-label')).toHaveText(['value', 'digits']);
    await page.evaluate((op) => fm.setOperator('#' + op, '+'), ids.op);
    expect(await edgesInto(page, ids.op)).toEqual(['Cond→undefined', 'Else→undefined', 'Then→undefined']);
    expect(await page.evaluate((op) => fm.getValue('#' + op), ids.op)).toBe(3);
    await expect(opNode(page, ids.op)).not.toHaveClass(/portop/);
    // Undo brings the named inputs back.
    await page.evaluate(() => fm.command('undo'));
    expect(await edgesInto(page, ids.op)).toEqual(['Cond→0', 'Else→undefined', 'Then→1']);
  });

  test('the ribbon: = and ≠ with the comparisons, the others with the Excel functions; a customised ribbon gets them once', async ({ page }) => {
    await openFmIDE(page);
    const groups = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'insert').groups.map(g => g.label + ':' + g.items.map(i => i.cmd.replace('insertOp', '')).join(',')));
    expect(groups).toContain('Compare:6,7,8,9,17,18');
    expect(groups).toContain('Excel Functions:10,11,12,13,14,16,19,20,21,22,23,24,15,25,26,27,28,29,30');
    // A ribbon customised before E1b (saved without the flag): its groups get them once.
    const file = test.info().outputPath('old-ribbon.json');
    const ws = { kind: 'fmIDE-workspace', version: 4, system: { kind: 'system', version: 5, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] },
      ui: { ribbonCustomized: true, zoomGroupAdded: true, /* (the Zoom group's own test: group 44) */ documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true,
        ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'My maths', items: [{ cmd: 'insertOp0' }, { cmd: 'insertOp11' }] }, { label: 'Tests', items: [{ cmd: 'insertOp6' }] }] }] } } };
    fs.writeFileSync(file, JSON.stringify(ws));
    await importViaCommand(page, 'importWorkspace', file);
    await acceptAll(page);
    const mine = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd.replace('insertOp', '')).join(',')));
    expect(mine).toEqual(['My maths:0,11,16,19,20,21,22,23,24,15,25,26,27,28,29,30', 'Tests:6,17,18']);
    // Once only: saved again, it carries the flag, and a removed operator stays removed.
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
    expect(data.ui.operatorsE1Added).toBe(true);
    expect(data.ui.operatorsE2Added).toBe(true);
    expect(data.ui.operatorsE2bAdded).toBe(true);
  });

  test('phase E2a: a ribbon customised after E1b gets ln, exp, sqrt, int and trunc once, in the Excel functions\' group', async ({ page }) => {
    await openFmIDE(page);
    const file = test.info().outputPath('e1-ribbon.json');
    const ws = { kind: 'fmIDE-workspace', version: 8, system: { kind: 'system', version: 7, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] },
      ui: { ribbonCustomized: true, zoomGroupAdded: true, /* (the Zoom group's own test: group 44) */ documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
        ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Excel', items: [{ cmd: 'insertOp11' }, { cmd: 'insertOp27' }] }, { label: 'Other', items: [{ cmd: 'insertOp0' }] }] }] } } };
    fs.writeFileSync(file, JSON.stringify(ws));
    await importViaCommand(page, 'importWorkspace', file);
    await acceptAll(page);
    const mine = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs[0].groups.map(g => g.label + ':' + g.items.map(i => i.cmd.replace('insertOp', '')).join(',')));
    expect(mine).toEqual(['Excel:11,27,25,26,28,29,30', 'Other:0']); // sqrt was there already; E2b's choose too
    // Drawn as word operators with one input, calculated on the canvas.
    const got = await page.evaluate(() => {
      fm.clearCanvas();
      const a = fm.createRect({ x: 0, y: 0, name: 'A', value: 16 });
      const out = {};
      ['ln', 'exp', 'sqrt', 'int', 'trunc'].forEach((op, i) => {
        const o = fm.createOperator({ x: 250, y: i * 100, op });
        const r = fm.createRect({ x: 450, y: i * 100, name: 'R ' + op });
        fm.connect('#' + a, '#' + o); fm.connect('#' + o, '#' + r);
      });
      fm.evaluate();
      ['ln', 'exp', 'sqrt', 'int', 'trunc'].forEach(op => { out[op] = fm.getValue('R ' + op); });
      return out;
    });
    expect(got.sqrt).toBe(4);
    expect(got.int).toBe(16);
    expect(got.trunc).toBe(16);
    expect(got.ln).toBeCloseTo(Math.log(16), 12);
    expect(got.exp).toBeCloseTo(Math.exp(16), 3);
  });

  // ---- E2b: choose ----
  test('choose: wired by name or number, it picks a choice; its dots grow with its arrows, and an arrow dropped on it takes the next choice', async ({ page }) => {
    await openFmIDE(page);
    const ids = await page.evaluate(() => {
      fm.clearCanvas();
      const s = fm.createRect({ x: 40, y: 40, name: 'Scenario', value: 2 });
      const a = fm.createRect({ x: 40, y: 160, name: 'Base', value: 100 });
      const b = fm.createRect({ x: 40, y: 280, name: 'Upside', value: 120 });
      const c = fm.createRect({ x: 40, y: 400, name: 'Downside', value: 80 });
      const ch = fm.createOperator({ x: 400, y: 140, op: 'choose' });
      const r = fm.createRect({ x: 650, y: 140, name: 'Picked' });
      fm.connect('#' + ch, '#' + r);
      return { s, a, b, c, ch };
    });
    // A new choose: its index and one empty choice.
    await expect(opNode(page, ids.ch)).toHaveClass(/portop/);
    await expect(opNode(page, ids.ch).locator('.op-in .io-label')).toHaveText(['index', 'choice 1']);
    await page.evaluate((ids) => {
      fm.connect('#' + ids.s, '#' + ids.ch, '', 'Index');
      fm.connect('#' + ids.a, '#' + ids.ch, '', 'choice 1');
      fm.connect('#' + ids.b, '#' + ids.ch, '', '3');                // the 3rd input: choice 2
    }, ids);
    await expect(opNode(page, ids.ch).locator('.op-in .io-label')).toHaveText(['index', 'choice 1', 'choice 2', 'choice 3']);
    expect(await page.evaluate(() => fm.getValue('Picked'))).toBe(120);
    // An arrow dropped on the body takes the first empty choice.
    const drag = async (fromId, target) => {
      const a = await page.locator(`.node[data-id="${fromId}"] .label`).boundingBox();
      const t = await target.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
      await page.mouse.up({ button: 'right' });
    };
    await drag(ids.c, opNode(page, ids.ch).locator('.opsym'));
    expect(await edgesInto(page, ids.ch)).toEqual(['Base→1', 'Downside→3', 'Scenario→0', 'Upside→2']);
    await expect(opNode(page, ids.ch).locator('.op-in .io-label')).toHaveText(['index', 'choice 1', 'choice 2', 'choice 3', 'choice 4']);
    // The index picks; out of range is "?" with its own message.
    await page.evaluate(() => fm.setValue('Scenario', 3));
    expect(await page.evaluate(() => fm.getValue('Picked'))).toBe(80);
    await page.evaluate(() => fm.setValue('Scenario', 5));
    const err = await page.evaluate((ch) => { try{ return fm.getValue('#' + ch); }catch(e){ return e.message; } }, ids.ch);
    expect(err).toMatch(/The index picks no choice/);
    // A choice by a name it doesn't take.
    const bad = await page.evaluate((ids) => { try{ fm.connect('#' + ids.a, '#' + ids.ch, '', 'choice 255'); }catch(e){ return e.message; } }, ids);
    expect(bad).toMatch(/takes choices 1 to 254/);
    // Saved with toPort and loaded back, it calculates the same.
    await page.evaluate(() => fm.setValue('Scenario', 1));
    const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
    expect(data.version).toBe(9);
    const ch = data.canvases[0].nodes.find(n => n.text === 'choose');
    expect(data.canvases[0].edges.filter(e => e.to === ch.id).map(e => e.toPort).sort()).toEqual([0, 1, 2, 3]);
    await page.evaluate(() => fm.clearCanvas());
    const file = test.info().outputPath('choose.json');
    fs.writeFileSync(file, JSON.stringify(data));
    await importViaCommand(page, 'loadSystem', file);
    await acceptAll(page);
    expect(await page.evaluate(() => fm.getValue('Picked'))).toBe(100);
  });

  test('changing an operator into choose: its arrows become the index and the choices, left to right', async ({ page }) => {
    await openFmIDE(page);
    const op = await page.evaluate(() => {
      fm.clearCanvas();
      const i = fm.createRect({ x: 40, y: 40, name: 'I', value: 2 });
      const a = fm.createRect({ x: 60, y: 160, name: 'A', value: 5 });
      const b = fm.createRect({ x: 80, y: 280, name: 'B', value: 7 });
      const o = fm.createOperator({ x: 400, y: 140, op: 'min' });
      [i, a, b].forEach(x => fm.connect('#' + x, '#' + o));
      const r = fm.createRect({ x: 650, y: 140, name: 'R' });
      fm.connect('#' + o, '#' + r);
      fm.setOperator('#' + o, 'choose');
      return o;
    });
    expect(await edgesInto(page, op)).toEqual(['A→1', 'B→2', 'I→0']);
    expect(await page.evaluate(() => fm.getValue('R'))).toBe(7);
    await page.evaluate(() => fm.command('undo'));
    expect(await page.evaluate(() => fm.getValue('R'))).toBe(2);
  });
});

// ---- each period is worked out once (results kept across periods), in Node ----
test.describe('results kept across periods', () => {
  // A model whose work should grow with the number of periods: a corkscrew (Opening is last
  // period's Closing) on the top level, fed into a block that has a corkscrew of its own.
  function corkscrewModel(periods){
    return { periods: Array.from({ length: periods }, (_, i) => 'P' + (i + 1)), canvases: [
      { id: 'main', name: 'Main', nodes: [
        { id: 'flow', type: 'value', text: 'Flow\n5' }, { id: 'open', type: 'value', text: 'Opening\n100' },
        { id: 'add', type: 'operator', text: '+' }, { id: 'close', type: 'value', text: 'Closing' },
        { id: 'sh', type: 'periodShift', shift: -1 },
        { id: 'inst', type: 'blockInstance', blockDefCanvasId: 'blk' }, { id: 'res', type: 'value', text: 'Result' },
      ], edges: [
        { id: 'e1', from: 'flow', to: 'add' }, { id: 'e2', from: 'open', to: 'add' }, { id: 'e3', from: 'add', to: 'close' },
        { id: 'e4', from: 'close', to: 'sh' }, { id: 'e5', from: 'sh', to: 'open' },
        { id: 'e6', from: 'close', to: 'inst', toPort: 0 }, { id: 'e7', from: 'inst', to: 'res', fromPort: 0 },
      ] },
      { id: 'blk', name: 'Block', nodes: [
        { id: 'bi', type: 'value', text: 'In', blockRole: 'input' }, { id: 'bo', type: 'value', text: 'Out', blockRole: 'output' },
        { id: 'bopen', type: 'value', text: 'Before\n0' }, { id: 'bs', type: 'periodShift', shift: -1 }, { id: 'bp', type: 'operator', text: '+' },
      ], edges: [
        { id: 'x1', from: 'bi', to: 'bp' }, { id: 'x2', from: 'bopen', to: 'bp' }, { id: 'x3', from: 'bp', to: 'bo' },
        { id: 'x4', from: 'bo', to: 'bs' }, { id: 'x5', from: 'bs', to: 'bopen' },
      ] },
    ] };
  }
  // How much work a calculation does: every node looked up goes through ir.canvases.get.
  function workFor(IR, periods){
    const ir = IR.compileModel(corkscrewModel(periods));
    let lookups = 0;
    const get = ir.canvases.get.bind(ir.canvases);
    ir.canvases.get = (id) => { lookups++; return get(id); };
    const results = IR.evaluateModel(ir);
    return { lookups, results };
  }

  test('twice the periods is about twice the work, not four times; the values are right', () => {
    const IR = loadIR();
    const small = workFor(IR, 24), big = workFor(IR, 48);
    // Before, each period worked every earlier one out again: the ratio was about 4.
    expect(big.lookups / small.lookups).toBeLessThan(2.5);
    // Closing = 100 + 5 in period 1, then 5 more each period; the block adds Closing up.
    const r = big.results[0];
    expect(r.values[0].close).toBe(105);
    expect(r.values[47].close).toBe(100 + 5 * 48);
    const closings = Array.from({ length: 48 }, (_, p) => 100 + 5 * (p + 1));
    expect(r.values[47].res).toBe(closings.reduce((a, b) => a + b, 0));
    // The same in every period, with and without tracing.
    const traced = IR.evaluateModel(IR.compileModel(corkscrewModel(48)), { trace: true })[0];
    expect(traced.values).toEqual(r.values);
  });

  test('in a loop, a period shift shows the value shown for the period it reads', () => {
    const IR = loadIR();
    // Result comes out of a block (Out = In + its own last Out); In is Fed back, which is
    // Result again: a loop. Shift reads Result two periods back.
    const system = { periods: ['P1', 'P2', 'P3'], canvases: [
      { id: 'main', name: 'Main', nodes: [
        { id: 'fed', type: 'value', text: 'Fed back\n1' }, { id: 'result', type: 'value', text: 'Result\n3' },
        { id: 'shift', type: 'periodShift', shift: -2 }, { id: 'inst', type: 'blockInstance', blockDefCanvasId: 'blk' },
      ], edges: [
        { id: 'e1', from: 'result', to: 'shift' }, { id: 'e2', from: 'result', to: 'fed' },
        { id: 'e3', from: 'fed', to: 'inst', toPort: 0 }, { id: 'e4', from: 'inst', to: 'result', fromPort: 0 },
      ] },
      { id: 'blk', name: 'Block', nodes: [
        { id: 'bi', type: 'value', text: 'In', blockRole: 'input' }, { id: 'bo', type: 'value', text: 'Out', blockRole: 'output' },
        { id: 'bs', type: 'periodShift', shift: -1 }, { id: 'bp', type: 'operator', text: '+' },
      ], edges: [
        { id: 'x1', from: 'bi', to: 'bp' }, { id: 'x2', from: 'bs', to: 'bp' }, { id: 'x3', from: 'bp', to: 'bo' }, { id: 'x4', from: 'bo', to: 'bs' },
      ] },
    ] };
    const r = IR.evaluateModel(IR.compileModel(system))[0];
    expect(r.errors[0].fed).toBe('cycle');
    // Result shows 0 in period 1, so the shift shows 0 in period 3 (before, it worked period 1
    // out again by another way into the loop and showed "?").
    expect(r.values[0].result).toBe(0);
    expect(r.values[2].shift).toBe(0);
    expect(r.errors[2].shift).toBeUndefined();
  });
});
