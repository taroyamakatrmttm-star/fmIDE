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
// Loaded into an empty context, so compileModel can only use what the shared files define:
// any use of fmIDE's own state would fail here.
const vm = require('vm');
const SHARED = path.join(__dirname, '..', 'src', 'shared');
function loadIR(){
  const code = ['operators.js', 'uom.js', 'input-rule.js', 'ir.js'].map(f => fs.readFileSync(path.join(SHARED, f), 'utf8')).join('\n');
  const ctx = vm.createContext({});
  return vm.runInContext(code + '\n;({ compileModel, evaluateModel, unitOf, formatUOM, OPERATORS, operatorForSymbol, operatorById, applyOperator })', ctx);
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
  expect(IR.OPERATORS.map(op => op.id)).toEqual(['add', 'subtract', 'multiply', 'divide', 'power', 'mod', 'le', 'ge', 'lt', 'gt', 'abs', 'min', 'max', 'average', 'iferror']);
  expect(IR.OPERATORS.map(op => op.symbol)).toEqual(['+', '−', '×', '÷', '^', '%', '≤', '≥', '<', '>', 'abs', 'min', 'max', 'ave', 'iferror']);
  IR.OPERATORS.forEach(op => {
    const kinds = ['fold', 'all', 'unary', 'compare', 'fallback'].filter(k => op[k]);
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
  expect(IR.applyOperator(null, [4, 5])).toEqual({ value: 4 }); // unknown: first input
});
