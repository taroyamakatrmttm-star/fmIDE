// 2. Excel output — calculated values, recalculated by LibreOffice.
const { test, expect } = require('./helpers/apps');
const X = require('./helpers/excel');
const { requireSoffice, recalc, valueOf } = require('./helpers/soffice');
const { MODELS, INPUTS_MODES, variantName } = require('./helpers/models');

// Tick "scenarios" on an Inputs-tab row in Tree view and set its count.
async function setScenarios(page, label, count){
  const row = page.locator('#rowGroupsTree .tree-row', { has: page.locator('.scn-ctl') })
    .filter({ has: page.locator('.tree-row-label', { hasText: new RegExp('^' + label + '$') }) });
  await expect(row).toHaveCount(1);
  await row.locator('.scn-ctl input[type=checkbox]').check();
  const num = row.locator('.scn-ctl input[type=number]');
  await num.fill(String(count));
  await num.dispatchEvent('change');
  await expect(num).toHaveValue(String(count));
}

// Row numbers of the scenario rows that feed an Inputs-tab variable row, from its INDEX formula.
function scenarioRows(ws, variableRow, p1){
  const f = X.formulaOf(ws[X.numToCol(p1) + variableRow]);
  const m = /^INDEX\(([A-Z]+)(\d+):\1(\d+),/.exec(f || '');
  if(!m) throw new Error('Inputs row ' + variableRow + ' is not a scenario INDEX formula: ' + f);
  const rows = [];
  for(let r = Number(m[2]); r <= Number(m[3]); r++) rows.push(r);
  return rows;
}

test.describe('known answers — scenarios and global cases', () => {
  test('Revenue follows the global case', async ({ page }) => {
    requireSoffice(test);
    await X.openExporter(page);
    await X.loadFixtureModel(page, 'scenario-unit-price-volume.json');
    await X.setInputsTab(page, true);
    await page.click('#viewByTree');
    await setScenarios(page, 'Unit Price', 3);
    await setScenarios(page, 'Volume', 5);
    await page.fill('#cfgInputsCases', '5');
    await page.locator('#cfgInputsCases').dispatchEvent('change');
    await expect(page.locator('#cfgInputsCases')).toHaveValue('5');
    const { wb } = await X.generate(page);

    const inputs = wb.Sheets['Inputs'], scen = wb.Sheets['Scenarios'], calc = wb.Sheets['Canvas 1'];
    expect(inputs && scen && calc, 'Inputs, Scenarios and Canvas 1 tabs exist').toBeTruthy();
    const p1 = X.periodOneCol(inputs), P1 = X.numToCol(p1);
    const [upRow] = X.findRow(inputs, 'Unit Price'), [volRow] = X.findRow(inputs, 'Volume');
    const upScen = scenarioRows(inputs, upRow, p1), volScen = scenarioRows(inputs, volRow, p1);
    expect(upScen).toHaveLength(3);
    expect(volScen).toHaveLength(5);

    // Scenario values (first period).
    [10, 20, 30].forEach((v, i) => { inputs[P1 + upScen[i]] = { t: 'n', v }; });
    [5, 6, 7, 8, 9].forEach((v, i) => { inputs[P1 + volScen[i]] = { t: 'n', v }; });
    // Rename scenario 2 of Unit Price.
    expect(X.text(inputs, 'A' + upScen[1])).toBe('Scenario 2');
    inputs['A' + upScen[1]] = { t: 's', v: 'Upside' };

    // Case matrix on the Scenarios tab: the rows whose column A links to each Inputs row.
    const scenRowFor = (inputsRow) => {
      const hits = X.cellAddrs(scen).filter(a => a.startsWith('A') && /^\d+$/.test(a.slice(1)) &&
        (X.formulaOf(scen[a]) || '').replace(/\$/g, '') === `'Inputs'!A${inputsRow}`);
      expect(hits, 'Scenarios row linked to Inputs!A' + inputsRow).toHaveLength(1);
      return Number(hits[0].slice(1));
    };
    const upS = scenRowFor(upRow), volS = scenRowFor(volRow);
    const caseCols = [];
    for(let c = 1; c < 60; c++){ if(/^Case \d+$/.test(X.text(scen, X.numToCol(c) + 3))) caseCols.push(X.numToCol(c)); }
    expect(caseCols).toHaveLength(5);
    [1, 1, 2, 3, 3].forEach((v, i) => { scen[caseCols[i] + upS] = { t: 'n', v }; });
    [1, 2, 1, 1, 2].forEach((v, i) => { scen[caseCols[i] + volS] = { t: 'n', v }; });

    // Probe: an empty scenario cell + 1 = 1 (not #VALUE!). Period 2 of Volume scenario 2 stays empty.
    const emptyAddr = X.numToCol(p1 + 1) + volScen[1];
    expect(inputs[emptyAddr] && inputs[emptyAddr].t).toBe('z');
    const probeAddr = 'A' + (Math.max(...X.cellAddrs(inputs).map(a => X.splitAddr(a).row)) + 3);
    inputs[probeAddr] = { t: 'n', f: emptyAddr + '+1' };
    inputs['!ref'] = undefined;

    const [revRow] = X.findRow(calc, 'Revenue');
    const revAddr = X.numToCol(X.periodOneCol(calc)) + revRow;
    const cases = [
      { gc: 1, revenue: 50, check: 'OK' },
      { gc: 2, revenue: 60, check: 'OK' },
      { gc: 3, revenue: 100, check: 'OK' },
      { gc: 4, revenue: 150, check: 'OK' },
      { gc: 5, revenue: 180, check: 'OK' },
      { gc: 9, revenue: 180, check: 'Out of range - using 5' },
      { gc: 'x', revenue: 50, check: 'Not a number - using 1' },
    ];
    // The Global Case cell is C2; its check message sits on row 2 as a formula mentioning C2.
    expect(X.text(scen, 'A2')).toBe('Global Case');
    const checkAddr = X.cellAddrs(scen).find(a => X.splitAddr(a).row === 2 && /ISNUMBER\(C2\)/.test(X.formulaOf(scen[a]) || ''));
    expect(checkAddr, 'global case check cell').toBeTruthy();
    // Scenario name column on the Scenarios tab (header "Scenario name").
    const nameCol = X.cellAddrs(scen).find(a => X.text(scen, a) === 'Scenario name').replace(/\d+$/, '');

    const files = {};
    for(const c of cases){
      const w = JSON.parse(JSON.stringify(wb));
      w.Sheets['Scenarios']['C2'] = typeof c.gc === 'number' ? { t: 'n', v: c.gc } : { t: 's', v: c.gc };
      files['case-' + c.gc] = await X.writeWithApp(page, w);
    }
    const out = recalc(files);
    const problems = [];
    for(const c of cases){
      const book = await X.readBack(out['case-' + c.gc]);
      const rev = valueOf(book.getWorksheet('Canvas 1').getCell(revAddr));
      if(rev !== c.revenue) problems.push(`global case ${c.gc}: Revenue ${rev}, expected ${c.revenue}`);
      const chk = valueOf(book.getWorksheet('Scenarios').getCell(checkAddr));
      if(chk !== c.check) problems.push(`global case ${c.gc}: check says ${JSON.stringify(chk)}, expected ${JSON.stringify(c.check)}`);
      const probe = valueOf(book.getWorksheet('Inputs').getCell(probeAddr));
      if(probe !== 1) problems.push(`global case ${c.gc}: empty scenario cell + 1 = ${JSON.stringify(probe)}, expected 1`);
      // Case 3 applies Unit Price scenario 2, now named "Upside".
      if(c.gc === 3){
        const nm = valueOf(book.getWorksheet('Scenarios').getCell(nameCol + upS));
        if(nm !== 'Upside') problems.push(`Scenarios!${nameCol}${upS} shows ${JSON.stringify(nm)}, expected "Upside"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

test.describe('known answers — unfed block inputs', () => {
  // block-unfed-inputs.json: COGS = Negatizer(Inputs) = Inputs × -1, with Inputs typed 4 and
  // nothing feeding either instance's port. Each instance's Inputs row is its own input.
  test('the typed value is used, and each instance follows its own Inputs-tab cell', async ({ page }) => {
    requireSoffice(test);
    await X.openExporter(page);
    await X.loadFixtureModel(page, 'block-unfed-inputs.json');
    await X.setInputsTab(page, true);
    const { wb } = await X.generate(page);
    const inputs = wb.Sheets['Inputs'], p1 = X.numToCol(X.periodOneCol(inputs));
    // The "Inputs" row gathered under "Negatizer (instance 1)".
    const group = X.findRow(inputs, 'Negatizer (instance 1)')[0];
    const target = X.findRow(inputs, 'Inputs').filter(r => r > group).sort((a, b) => a - b)[0];
    expect(target, 'Inputs row under Negatizer (instance 1)').toBeTruthy();
    const edited = JSON.parse(JSON.stringify(wb));
    edited.Sheets['Inputs'][p1 + target] = { t: 'n', v: 5 };
    const out = recalc({ as_typed: (await X.generate(page)).bytes, edited: await X.writeWithApp(page, edited) });
    const cogs = async (name, tab) => {
      const ws = wb.Sheets[tab], [r] = X.findRow(ws, 'COGS');
      return valueOf((await X.readBack(out[name])).getWorksheet(tab).getCell(X.numToCol(X.periodOneCol(ws)) + r));
    };
    expect(await cogs('as_typed', 'Case1')).toBe(-4);
    expect(await cogs('as_typed', 'Case2')).toBe(-4);
    expect(await cogs('edited', 'Case1')).toBe(-5);
    expect(await cogs('edited', 'Case2')).toBe(-4);
  });
});

// Block-definition tabs compute with unconnected inputs, so #DIV/0! is expected there.
const BLOCK_DEF_TABS = ['DepBlock', 'Depreciation Block'];

test.describe('no error cells after recalculation', () => {
  for(const model of MODELS){
    test(model, async ({ page }) => {
      requireSoffice(test);
      await X.openExporter(page);
      await X.loadFixtureModel(page, model);
      const files = {};
      for(const inputsOn of INPUTS_MODES){
        await X.setInputsTab(page, inputsOn);
        files[variantName(model, inputsOn)] = (await X.generate(page)).bytes;
      }
      const out = recalc(files);
      const errors = [];
      for(const [name, bytes] of Object.entries(out)){
        const book = await X.readBack(bytes);
        book.eachSheet(ws => ws.eachRow(r => r.eachCell(c => {
          const v = valueOf(c);
          if(typeof v === 'string' && /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!)/.test(v)){
            if(v === '#DIV/0!' && BLOCK_DEF_TABS.includes(ws.name)) return;
            errors.push(`${name}: ${ws.name}!${c.address} = ${v}`);
          }
        })));
      }
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
