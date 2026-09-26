// 13. Plugs — a rectangle can carry several plug names (system v3 / module v2), each
// feeding the operators whose socket has that name; older files with one plug still open.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');
const X = require('./helpers/excel');

const file = (name) => fixture('formats', name + '.json');

// "Income Tax" (30) on a Tax canvas, plugged into two differently named sockets: one on an
// Income Statement canvas, one on a Cash Flow canvas.
async function buildTaxModel(page){
  return page.evaluate(() => {
    fm.clearAll();
    fm.renameCanvas({ canvas: '@current', name: 'Tax' });
    const tax = fm.createRect({ x: 60, y: 60, name: 'Income Tax', value: '30' });
    fm.addPlug(tax, 'to Income Tax expense');
    fm.addPlug(tax, 'to CF Income Tax paid');
    fm.addCanvas({ name: 'Income Statement' });
    fm.switchCanvas('Income Statement');
    const op1 = fm.createOperator({ x: 300, y: 120, op: '+' });
    fm.setSocket(op1, 'to Income Tax expense');
    const expense = fm.createRect({ x: 420, y: 110, name: 'Income Tax expense', value: '0' });
    fm.connect(op1, expense);
    fm.addCanvas({ name: 'Cash Flow' });
    fm.switchCanvas('Cash Flow');
    const op2 = fm.createOperator({ x: 300, y: 120, op: '+' });
    fm.setSocket(op2, 'to CF Income Tax paid');
    const paid = fm.createRect({ x: 420, y: 110, name: 'Income Tax paid', value: '0' });
    fm.connect(op2, paid);
    fm.switchCanvas('Tax');
    return { tax, expense, paid };
  });
}
// A rectangle's computed value ("Canvas::Name"; getValue reads the canvas on screen).
const valueOf = (page, ref) => page.evaluate((r) => {
  const [canvas, name] = r.split('::');
  const back = fm.canvases().find(c => c.active);
  fm.switchCanvas(canvas);
  try{ return fm.getValue({ node: name }); }
  finally{ if(back) fm.switchCanvas(back.name); }
}, ref);
// Every rectangle's saved node ("Canvas::Name" → node), read from File → Save System.
async function savedNodes(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  const out = {};
  data.canvases.forEach(c => c.nodes.forEach(n => { if(n.type === 'value') out[c.name + '::' + n.text.split('\n')[0]] = n; }));
  return { data, nodes: out };
}
const plugsOfNode = async (page, ref) => (await savedNodes(page)).nodes[ref].plugs;

test.describe('several plugs on one rectangle', () => {
  test.beforeEach(async ({ page }) => { await F.openFmIDE(page); });

  test('one rectangle feeds two differently named sockets on two canvases', async ({ page }) => {
    await buildTaxModel(page);
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to Income Tax expense', 'to CF Income Tax paid']);
    expect(await valueOf(page, 'Income Statement::Income Tax expense')).toBe(30);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(30);
  });

  test('removing one plug removes only that connection; undo brings it back', async ({ page }) => {
    await buildTaxModel(page);
    await page.evaluate(() => fm.removePlug('Tax::Income Tax', 'TO CF INCOME TAX PAID'));  // names match regardless of capitals
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to Income Tax expense']);
    expect(await valueOf(page, 'Income Statement::Income Tax expense')).toBe(30);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(0);
    await page.evaluate(() => fm.command('undo'));
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to Income Tax expense', 'to CF Income Tax paid']);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(30);
  });

  test('addPlug ignores a name already there; setPlug replaces them all; setPlugs sets a list', async ({ page }) => {
    await buildTaxModel(page);
    await page.evaluate(() => fm.addPlug('Tax::Income Tax', ' To Income Tax Expense '));
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to Income Tax expense', 'to CF Income Tax paid']);

    await page.evaluate(() => fm.setPlug('Tax::Income Tax', 'to CF Income Tax paid'));
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to CF Income Tax paid']);
    expect(await valueOf(page, 'Income Statement::Income Tax expense')).toBe(0);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(30);

    await page.evaluate(() => fm.setPlugs('Tax::Income Tax', ['to Income Tax expense', '', 'to CF Income Tax paid', 'to income tax expense']));
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual(['to Income Tax expense', 'to CF Income Tax paid']);

    await page.evaluate(() => fm.setPlugs('Tax::Income Tax', []));
    expect(await plugsOfNode(page, 'Tax::Income Tax')).toEqual([]);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(0);

    const err = await page.evaluate(() => { try{ fm.setPlugs('Tax::Income Tax', [1, 2]); return null; }catch(e){ return e.message; } });
    expect(err).toMatch(/list of names/);
  });

  test('the plug editor lists each plug, removes one with ✕ and adds a typed name', async ({ page }) => {
    const { tax } = await buildTaxModel(page);
    const node = page.locator(`.node[data-id="${tax}"]`);
    await expect(node.locator('.plug-chip')).toHaveText('🔌 to Income Tax expense · to CF Income Tax paid');

    await node.hover();
    await node.locator('.plug-btn').click();
    const editor = page.locator('.tag-popup.plug-editor');
    await expect(editor.locator('.plug-item')).toHaveText(['🔌 to Income Tax expense✕', '🔌 to CF Income Tax paid✕']);
    await editor.locator('.plug-item', { hasText: 'to CF Income Tax paid' }).locator('.plug-remove').click();
    await expect(editor.locator('.plug-item')).toHaveText(['🔌 to Income Tax expense✕']);
    await expect(node.locator('.plug-chip')).toHaveText('🔌 to Income Tax expense');

    await editor.locator('input').fill('New name');
    await editor.locator('input').press('Enter');
    await expect(editor.locator('.plug-item')).toHaveText(['🔌 to Income Tax expense✕', '🔌 New name✕']);
    // a name typed but not added is dropped by Escape
    await editor.locator('input').fill('Dropped');
    await editor.locator('input').press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(node.locator('.plug-chip')).toHaveText('🔌 to Income Tax expense · New name');
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(0);
    expect(await valueOf(page, 'Income Statement::Income Tax expense')).toBe(30);

    // a name typed and then a click elsewhere is added
    await node.hover();
    await node.locator('.plug-btn').click();
    await editor.locator('input').fill('to CF Income Tax paid');
    await page.mouse.click(5, 300);
    await expect(editor).toHaveCount(0);
    expect(await valueOf(page, 'Cash Flow::Income Tax paid')).toBe(30);
  });

  test('plug names from a file are shown as plain text', async ({ page }, testInfo) => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    const sys = JSON.parse(fs.readFileSync(file('sys-v2-plug'), 'utf8'));
    sys.canvases[0].nodes[0].plug = evil;
    const path = testInfo.outputPath('evil-plug.json');
    fs.writeFileSync(path, JSON.stringify(sys));
    await F.importViaCommand(page, 'loadSystem', path);
    await F.acceptAll(page);
    const chip = page.locator('.node', { hasText: 'Income Tax' }).first().locator('.plug-chip');
    await expect(chip).toHaveText('🔌 ' + evil);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(await page.locator('.plug-chip img').count()).toBe(0);
  });
});

test('ExcelExporter: a rectangle with two plugs feeds both sockets in the workbook', async ({ page }, testInfo) => {
  await F.openFmIDE(page);
  await buildTaxModel(page);
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.command('saveSystem')));
  expect(data.version).toBe(4);
  const path = testInfo.outputPath('two-plugs.json');
  fs.writeFileSync(path, JSON.stringify(data));

  await X.openExporter(page);
  await X.loadModelFile(page, path);
  await expect(page.locator('#loadStatus .status')).toHaveClass(/ok/);
  await X.setInputsTab(page, false);   // so a rectangle fed by nothing would be a typed number
  const { wb } = await X.generate(page);
  const problems = [];
  for(const [label, tab] of [['Income Tax expense', 'Income Statement'], ['Income Tax paid', 'Cash Flow']]){
    const ws = wb.Sheets[tab];
    if(!ws){ problems.push(`no "${tab}" tab (tabs: ${wb.SheetNames.join(', ')})`); continue; }
    const [row] = X.findRow(ws, label);
    const f = row ? X.formulaOf(ws[X.numToCol(X.periodOneCol(ws)) + row]) : null;
    if(!f) problems.push(`${tab}: "${label}" is not a formula`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
