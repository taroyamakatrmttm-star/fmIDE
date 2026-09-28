// 3. Excel output — layout rules.
const { test, expect } = require('./helpers/apps');
const X = require('./helpers/excel');
const { MODELS, INPUTS_MODES } = require('./helpers/models');

async function generateFor(page, model, { inputs = false } = {}){
  await X.openExporter(page);
  await X.loadFixtureModel(page, model);
  await X.setInputsTab(page, inputs);
  return (await X.generate(page)).wb;
}

// A tab has period columns when its header row 3 carries a period counter.
const hasPeriods = (ws) => X.periodOneCol(ws) !== null;

test.describe('fixed column layout', () => {
  for(const model of MODELS){
    for(const inputsOn of INPUTS_MODES){
      test(`${model} — Inputs tab ${inputsOn ? 'on' : 'off'}`, async ({ page }) => {
        const wb = await generateFor(page, model, { inputs: inputsOn });
        const problems = [];
        const periodTabs = wb.SheetNames.filter(n => hasPeriods(wb.Sheets[n]));
        // Only the Scenarios tab (a case matrix, no timeline) has no period columns.
        const noPeriods = wb.SheetNames.filter(n => !periodTabs.includes(n));
        expect(noPeriods.filter(n => n !== 'Scenarios'), 'tabs without a period counter in row 3').toEqual([]);
        const cols = new Set(periodTabs.map(n => X.periodOneCol(wb.Sheets[n])));
        if(cols.size !== 1) problems.push('period 1 is in different columns: ' + periodTabs.map(n => `${n}=${X.numToCol(X.periodOneCol(wb.Sheets[n]))}`).join(', '));
        for(const name of periodTabs){
          const ws = wb.Sheets[name], p1 = X.periodOneCol(ws);
          // Row 3 holds the period counter 1..N in consecutive columns.
          const counter = X.cellAddrs(ws).filter(a => X.splitAddr(a).row === 3 && X.splitAddr(a).col >= p1)
            .sort((a, b) => X.splitAddr(a).col - X.splitAddr(b).col);
          counter.forEach((a, i) => {
            if(X.splitAddr(a).col !== p1 + i || ws[a].v !== i + 1) problems.push(`${name}!${a}: period counter ${JSON.stringify(ws[a].v)}, expected ${i + 1}`);
          });
          const n = counter.length;
          if(n < 1) problems.push(`${name}: no period counter`);
          const headerPeriods = X.cellAddrs(ws).filter(a => X.splitAddr(a).row === 2 && X.splitAddr(a).col >= p1).length;
          if(headerPeriods !== n) problems.push(`${name}: ${headerPeriods} period headers in row 2 but ${n} periods in row 3`);
          // The column immediately left of period 1 is completely empty on every row.
          const spacer = X.numToCol(p1 - 1);
          X.cellAddrs(ws).filter(a => X.splitAddr(a).col === p1 - 1).forEach(a => {
            const c = ws[a];
            const styled = c.s && (c.s.fill || c.s.border || (c.s.font && (c.s.font.color || c.s.font.bold)));
            if(X.formulaOf(c) || (c.v !== undefined && c.v !== null && c.v !== '') || styled) problems.push(`${name}!${a}: spacer column ${spacer} is not empty`);
          });
          // Column C header.
          const hasVintage = X.cellAddrs(ws).some(a => a.startsWith('C') && X.splitAddr(a).row > 3 && /— Vintage \d+$/.test(X.text(ws, 'A' + X.splitAddr(a).row)));
          const want = inputsOn && name === 'Inputs' ? 'Variable Scenario' : (hasVintage ? 'Vintage' : '');
          if(X.text(ws, 'C2') !== want) problems.push(`${name}!C2 header is ${JSON.stringify(X.text(ws, 'C2'))}, expected ${JSON.stringify(want)}`);
        }
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  }
});

test.describe('vertical blocks', () => {
  for(const model of ['vertical-depreciation-block.json', 'combined-bs-corkscrew-block.json']){
    for(const inputsOn of INPUTS_MODES){
      test(`${model} — Inputs tab ${inputsOn ? 'on' : 'off'}`, async ({ page }) => {
        const wb = await generateFor(page, model, { inputs: inputsOn });
        const problems = [];
        let vintageBlocks = 0;
        for(const name of wb.SheetNames){
          const ws = wb.Sheets[name];
          // No "Vertical Index" row anywhere.
          X.cellAddrs(ws).filter(a => /Vertical Index/i.test(X.text(ws, a))).forEach(a => problems.push(`${name}!${a}: "Vertical Index" row`));
          const rows = X.rowsOf(ws);
          // Line items: consecutive rows labelled "<item> — Vintage k".
          const blocks = {};
          Object.keys(rows).map(Number).forEach(r => {
            const m = /^(.*) — Vintage (\d+)$/.exec(X.text(ws, 'A' + r));
            if(m) (blocks[m[1]] = blocks[m[1]] || []).push({ row: r, k: Number(m[2]) });
          });
          if(!Object.keys(blocks).length) continue;
          if(X.text(ws, 'C2') !== 'Vintage') problems.push(`${name}!C2 is not "Vintage"`);
          const p1 = X.periodOneCol(ws);
          // Helper columns: between column C and the spacer, headed "<input> @ vintage".
          const helperCols = [];
          for(let c = 4; c < p1 - 1; c++){
            const h = X.text(ws, X.numToCol(c) + 2);
            if(!/^.+ @ vintage$/.test(h)) problems.push(`${name}!${X.numToCol(c)}2 helper header ${JSON.stringify(h)} is not "<input> @ vintage"`);
            helperCols.push(c);
          }
          for(const [item, list] of Object.entries(blocks)){
            vintageBlocks++;
            const rs = list.map(x => x.row);
            if(rs.some((r, i) => i && r !== rs[i - 1] + 1)) problems.push(`${name} "${item}": vintage rows are not contiguous`);
            if(list.some((x, i) => x.k !== i + 1)) problems.push(`${name} "${item}": vintages not numbered 1..N`);
            // Exactly one distinct formula per column group (each helper column, then all period columns).
            const lastCol = Math.max(...Object.keys(rows[rs[0]]).map(Number));
            const groups = helperCols.map(c => [c]).concat([Array.from({ length: lastCol - p1 + 1 }, (_, i) => p1 + i)]);
            groups.forEach(cols => {
              const forms = new Set();
              rs.forEach(r => cols.forEach(c => {
                const a = X.numToCol(c) + r, f = X.formulaOf(ws[a]);
                forms.add(f === null ? '(no formula: ' + JSON.stringify(ws[a] && ws[a].v) + ')' : X.toR1C1(f, a));
              }));
              if(forms.size !== 1) problems.push(`${name} "${item}" columns ${cols.map(X.numToCol).join(',')}: ${forms.size} distinct formulas: ${[...forms].slice(0, 4).join(' | ')}`);
            });
            // Vintage column C holds 1..N.
            rs.forEach((r, i) => { if(ws['C' + r] && ws['C' + r].v !== i + 1 && !X.formulaOf(ws['C' + r])) problems.push(`${name}!C${r} vintage ${ws['C' + r].v}, expected ${i + 1}`); });
            // A Total row, if present for this item, is SUM over exactly the vintage rows.
            const totalRow = Object.keys(rows).map(Number).find(r => X.text(ws, 'A' + r) === item + ' (Total)');
            if(totalRow){
              for(let c = p1; c <= lastCol; c++){
                const a = X.numToCol(c) + totalRow, col = X.numToCol(c);
                const want = `SUM(${col}${rs[0]}:${col}${rs[rs.length - 1]})`;
                if(X.formulaOf(ws[a]) !== want) problems.push(`${name}!${a}: Total is ${X.formulaOf(ws[a])}, expected ${want}`);
              }
            }
          }
          // Every output total exists: at least one "(Total)" row on a vintage tab.
          if(!Object.keys(rows).some(r => / \(Total\)$/.test(X.text(ws, 'A' + r)))) problems.push(`${name}: no Total row`);
        }
        expect(vintageBlocks, 'vintage blocks found').toBeGreaterThan(0);
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  }
});

test('comparisons export as native TRUE/FALSE', async ({ page }) => {
  const wb = await generateFor(page, 'comparisons.json');
  const found = {};
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name];
    for(const label of ['BS check', 'Min probe', 'GE probe']){
      X.findRow(ws, label).forEach(r => {
        const p1 = X.periodOneCol(ws);
        (found[label] = found[label] || []).push(X.formulaOf(ws[X.numToCol(p1) + r]));
      });
    }
  }
  expect(Object.keys(found).sort()).toEqual(['BS check', 'GE probe', 'Min probe']);
  for(const f of found['BS check']){ expect(f).toMatch(/^ABS\(.+\)<=.+$/); expect(f).not.toMatch(/IF\(/); }
  for(const f of found['Min probe']) expect(f).toMatch(/^MIN\(N\(.+\),.+\)$/);
  for(const f of found['GE probe']) expect(f).toMatch(/^N\(.+\)>=.+$/);
});

test.describe('Inputs tab', () => {
  const MODEL = 'revenue-bs-corkscrew.json';

  test('is first; input rows link to it; period-shifted rows are not gathered', async ({ page }) => {
    const wb = await generateFor(page, MODEL, { inputs: true });
    expect(wb.SheetNames[0]).toBe('Inputs');
    const inputs = wb.Sheets['Inputs'];
    const gathered = new Set(Object.keys(X.rowsOf(inputs)).map(r => X.text(inputs, 'A' + r)));
    expect(gathered.has('Beginning Balance'), '"Beginning Balance" (fed through a period shift) is not gathered').toBe(false);
    const problems = [];
    let links = 0;
    for(const name of wb.SheetNames.slice(1)){
      const ws = wb.Sheets[name], p1 = X.periodOneCol(ws);
      for(const r of Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3)){
        const label = X.text(ws, 'A' + r);
        const cells = [];
        for(let c = p1; ws[X.numToCol(c) + 3]; c++) cells.push({ addr: X.numToCol(c) + r, col: X.numToCol(c), cell: ws[X.numToCol(c) + r] });
        const isLink = cells.some(x => /Inputs'?!/.test(X.formulaOf(x.cell) || ''));
        if(!isLink) continue;
        links++;
        if(!gathered.has(label)) problems.push(`${name}!A${r} "${label}" links to Inputs but has no row there`);
        cells.forEach(x => {
          const f = X.formulaOf(x.cell) || '';
          const m = /^'?Inputs'?!\$?([A-Z]+)\$?(\d+)$/.exec(f);
          if(!m) problems.push(`${name}!${x.addr}: ${JSON.stringify(f)} is not a sheet-qualified single-cell link`);
          else if(m[1] !== x.col) problems.push(`${name}!${x.addr}: links to column ${m[1]}`);
          else if(X.text(inputs, 'A' + m[2]) !== label) problems.push(`${name}!${x.addr}: links to Inputs row "${X.text(inputs, 'A' + m[2])}"`);
        });
      }
      // Beginning Balance stays on its own tab, not linked.
      X.findRow(ws, 'Beginning Balance').forEach(r => {
        const f = X.formulaOf(ws[X.numToCol(p1) + r]) || '';
        if(/Inputs/.test(f)) problems.push(`${name}!A${r}: Beginning Balance links to the Inputs tab`);
      });
    }
    expect(links).toBeGreaterThan(0);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // Group header rows on the Inputs tab: a label with no numbers or formulas.
  function inputsLayout(wb){
    const ws = wb.Sheets['Inputs'], p1 = X.periodOneCol(ws);
    return Object.keys(X.rowsOf(ws)).map(Number).filter(r => r > 3).map(r => {
      const label = X.text(ws, 'A' + r), c = ws[X.numToCol(p1) + r];
      const data = c && (X.formulaOf(c) || typeof c.v === 'number');
      return { label, header: !data };
    }).filter(x => x.label && !/^(INPUTS|CALCULATIONS|OUTPUTS)$/.test(x.label));
  }
  const describe = (layout) => layout.map(x => (x.header ? '# ' : '') + x.label);

  async function relayout(page, group, order){
    await page.selectOption('#cfgInputsGroup', group);
    await page.selectOption('#cfgInputsOrder', order);
    await page.click('#btnInputsRelayout');
    await expect(page.locator('#inputsStatus')).toContainText('re-arranged');
  }

  test('grouping and ordering', async ({ page }) => {
    await X.openExporter(page);
    await X.loadFixtureModel(page, MODEL);
    await X.setInputsTab(page, true);
    // Rename the "BS" tab so Excel-tab groups and canvas groups are distinguishable.
    const tabInputs = await page.locator('#tabsBody input[type=text]').all();
    let renamed = false;
    for(const input of tabInputs){
      if(await input.inputValue() === 'BS'){ await input.fill('Balance'); await input.dispatchEvent('change'); renamed = true; break; }
    }
    expect(renamed, 'renamed tab BS').toBe(true);

    // The BS sheet's inputs in its order: a new layout starts in calculation order (inputs first, formula order).
    const BS_SHEET = ['Volume', 'Unit Price', 'AR outstanding rate', 'Cash', 'Inventory'];
    const CORK_SHEET = ['Additions', 'Subtractions'];
    const alpha = (xs) => xs.slice().sort((a, b) => a.localeCompare(b));

    await relayout(page, 'tab', 'sheet');
    let wb = (await X.generate(page)).wb;
    expect(describe(inputsLayout(wb))).toEqual(['# Balance', ...BS_SHEET, '# Corkscrew', ...CORK_SHEET]);

    await relayout(page, 'canvas', 'sheet');
    wb = (await X.generate(page)).wb;
    expect(describe(inputsLayout(wb))).toEqual(['# BS', ...BS_SHEET, '# Corkscrew', ...CORK_SHEET]);

    await relayout(page, 'none', 'sheet');
    wb = (await X.generate(page)).wb;
    expect(describe(inputsLayout(wb))).toEqual([...BS_SHEET, ...CORK_SHEET]);

    await relayout(page, 'tab', 'alpha');
    wb = (await X.generate(page)).wb;
    expect(describe(inputsLayout(wb))).toEqual(['# Balance', ...alpha(BS_SHEET), '# Corkscrew', ...alpha(CORK_SHEET)]);

    await relayout(page, 'none', 'alpha');
    wb = (await X.generate(page)).wb;
    expect(describe(inputsLayout(wb))).toEqual(alpha([...BS_SHEET, ...CORK_SHEET]));
  });

  test('Block Input rectangles on their own canvas are gathered and linked', async ({ page }) => {
    // Volume and DSO are marked Block Input in fmIDE; on their own canvas they are typed inputs.
    const wb = await generateFor(page, 'block-input-rectangles.json', { inputs: true });
    const inputs = wb.Sheets['Inputs'];
    const gathered = inputsLayout(wb).filter(x => !x.header).map(x => x.label);
    expect(gathered).toEqual(expect.arrayContaining(['Volume', 'DSO', 'Unit Price']));
    const ws = wb.Sheets['Revenue AR'], p1 = X.periodOneCol(ws);
    for(const label of ['Volume', 'DSO']){
      const rows = X.findRow(ws, label);
      expect(rows.length, `"${label}" row on Revenue AR`).toBe(1);
      const f = X.formulaOf(ws[X.numToCol(p1) + rows[0]]) || '';
      const m = /^'?Inputs'?!\$?([A-Z]+)\$?(\d+)$/.exec(f);
      expect(m, `${label} links to the Inputs tab (got ${JSON.stringify(f)})`).not.toBeNull();
      expect(X.text(inputs, 'A' + m[2])).toBe(label);
    }
    expect(X.findRow(inputs, 'DSO').map(r => inputs[X.numToCol(X.periodOneCol(inputs)) + r].v)).toEqual([0.08]);
  });
});

test.describe('unfed block inputs', () => {
  // Negatizer (Inputs × Negative one → Output) used twice: on Case1 its input is fed by a
  // "+" with nothing plugged in, on Case2 it is not connected. Its Inputs holds a typed 4.
  const MODEL = 'block-unfed-inputs.json';

  test('each instance gets its own Inputs row, gathered on the Inputs tab and used by the block', async ({ page }) => {
    const wb = await generateFor(page, MODEL, { inputs: true });
    const inputs = wb.Sheets['Inputs'], ip1 = X.numToCol(X.periodOneCol(inputs));
    const problems = [];
    for(const tab of ['Negatizer (instance 1)', 'Negatizer (instance 2)']){
      const ws = wb.Sheets[tab], p1 = X.numToCol(X.periodOneCol(ws));
      const [inRow] = X.findRow(ws, 'Inputs'), [negRow] = X.findRow(ws, 'Negative one'), [outRow] = X.findRow(ws, 'Output');
      if(!inRow){ problems.push(`${tab}: no "Inputs" row`); continue; }
      // Its first-period cell links to an Inputs-tab row holding the typed 4, under this instance's group.
      const m = /^'?Inputs'?!\$?([A-Z]+)\$?(\d+)$/.exec(X.formulaOf(ws[p1 + inRow]) || '');
      if(!m){ problems.push(`${tab}!${p1}${inRow} does not link to the Inputs tab: ${JSON.stringify(X.formulaOf(ws[p1 + inRow]))}`); continue; }
      const target = Number(m[2]);
      if(X.text(inputs, 'A' + target) !== 'Inputs') problems.push(`${tab}: links to Inputs row "${X.text(inputs, 'A' + target)}"`);
      if(inputs[ip1 + target].v !== 4) problems.push(`${tab}: Inputs-tab value ${inputs[ip1 + target].v}, expected 4`);
      const groupAbove = Object.keys(X.rowsOf(inputs)).map(Number).filter(r => r < target && /^Negatizer/.test(X.text(inputs, 'A' + r))).pop();
      if(X.text(inputs, 'A' + groupAbove) !== tab) problems.push(`${tab}: gathered under "${X.text(inputs, 'A' + groupAbove)}"`);
      // Output multiplies the two rows — no typed 0 for the input.
      const f = (X.formulaOf(ws[p1 + outRow]) || '').replace(/\$/g, '');
      if(!f.includes(p1 + inRow) || !f.includes(p1 + negRow)) problems.push(`${tab}: Output is ${JSON.stringify(f)}`);
    }
    // The definition's own tab keeps its placeholder where it is (not gathered).
    const def = wb.Sheets['Negatizer'], [defIn] = X.findRow(def, 'Inputs');
    if(/Inputs'?!/.test(X.formulaOf(def[X.numToCol(X.periodOneCol(def)) + defIn]) || '')) problems.push('Negatizer tab: its Inputs placeholder was gathered');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

test.describe('an input read from another tab', () => {
  // "Days in a Period" is an input on its own canvas; Inventory reads it through a plug, AP
  // through an alias; DIO and DPO are inputs on the tabs that use them.
  const MODEL = 'inputs-reached-through-links.json';
  const firstFormula = (wb, sheet, label) => {
    // Below the title and header rows (a sheet's title can carry the same name).
    const ws = wb.Sheets[sheet], [r] = X.findRow(ws, label).filter(r => r > 3);
    expect(r, `"${label}" on ${sheet}`).toBeTruthy();
    return X.formulaOf(ws[X.numToCol(X.periodOneCol(ws)) + r]);
  };

  test('with the Inputs tab, the rows reading it point straight at the Inputs tab; the same tab stays local', async ({ page }) => {
    const wb = await generateFor(page, MODEL, { inputs: true });
    const inputs = wb.Sheets['Inputs'];
    // The input's row (the group heading above it carries the same name).
    const daysRow = Math.max(...X.findRow(inputs, 'Days in a Period'));
    const daysCell = X.numToCol(X.periodOneCol(inputs)) + daysRow;
    // Through a plug (Inventory) and through an alias (AP): the Inputs tab, not the input's own tab.
    expect(firstFormula(wb, 'Inventory', 'Days in a period')).toBe("'Inputs'!" + daysCell);
    expect(firstFormula(wb, 'AP', 'Days in a period')).toBe("'Inputs'!" + daysCell);
    // The input's own row is still a link to the Inputs tab.
    expect(firstFormula(wb, 'Days in a Period', 'Days in a Period')).toBe("'Inputs'!" + daysCell);
    // A gathered input on the same tab (DIO) is read from its row right there.
    expect(firstFormula(wb, 'Inventory', 'Inv outstanding')).toMatch(/^[A-Z]+\d+\/[A-Z]+\d+$/);
  });

  test('without the Inputs tab, they point at the input\'s own tab', async ({ page }) => {
    const wb = await generateFor(page, MODEL, { inputs: false });
    expect(firstFormula(wb, 'Inventory', 'Days in a period')).toMatch(/^'Days in a Period'!E\d+$/);
    expect(firstFormula(wb, 'AP', 'Days in a period')).toMatch(/^'Days in a Period'!E\d+$/);
  });
});
