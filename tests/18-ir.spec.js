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
