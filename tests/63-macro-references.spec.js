// 63. Macros that keep working when the model is different from when they were recorded, and
// the ids a macro step can use. Insert Template saves what it made ($t1: the canvases — a
// recipe one per part, in order — or the nodes put on this canvas); the recorder refers to it,
// to a template's unnamed nodes by their place (@all[k]), and records skipping the parts
// already here as skipExisting; a reference that may not hold gets a ⚠ note. The Macro
// Builder names the result of a step that makes something; the messages that stop a macro say
// what to do; canvas tabs show their ids; Copy Reference copies a step's reference.
const fs = require('fs');
const { test, expect, fixture } = require('./helpers/apps');
const F = require('./helpers/fmide');

// templates-v2.json: Income Statement v1 (Net Income 40); Balance Sheet v1 and v2 (v2: two
// operators and two rectangles); Cash Flow v1.
const LIBRARY = fixture('formats', 'templates-v2.json');
const picker = (page) => page.locator('.modal-box.template-box');
const builder = (page) => page.locator('.modal-box.macro-box');
const closeBuilder = async (page) => { await builder(page).locator('.macro-foot button', { hasText: /^Close$/ }).click(); await expect(builder(page)).toHaveCount(0); };

async function importTemplates(page, path){
  await F.importViaDialog(page, 'openTemplates', '⇧ Import Templates', path);
  await F.dismissMessage(page);
  await picker(page).locator('.modal-actions button', { hasText: /^Close$/ }).click();
}
// Records what `fn` does (fm calls, in the page) as a new macro; the Macro Builder opens
// when it stops, and is closed again. Returns the macro as saved, and the builder's status.
async function record(page, fn, arg, { selection = false } = {}){
  await page.evaluate(() => fm.command('toggleRecord'));
  const box = page.locator('.modal-box', { has: page.locator('button.primary', { hasText: 'Start recording' }) });
  const sel = box.locator('label', { hasText: /as @sel/ }).locator('input');
  if(await sel.isEnabled() && (await sel.isChecked()) !== selection) await sel.click();
  await box.locator('button.primary').click();
  await page.evaluate(fn, arg);
  await page.evaluate(() => fm.command('toggleRecord'));
  await expect(builder(page)).toBeVisible();
  const status = await builder(page).locator('.macro-foot .status').textContent();
  await closeBuilder(page);
  return { macro: await lastMacro(page), status };
}
async function lastMacro(page){
  const { data } = await F.downloadJson(page, () => page.evaluate(() => fm.exportWorkspace()));
  return data.macros[data.macros.length - 1];
}
const run = (page, name) => page.evaluate((n) => { try{ fm.runMacro(n); return 'ok'; }catch(e){ return 'Error: ' + e.message; } }, name);
const canvasList = (page) => page.evaluate(() => fm.canvases().map(c => ({ id: c.id, name: c.name, active: c.active })));
const active = async (page) => (await canvasList(page)).find(c => c.active);
const actions = (macro) => macro.steps.map(s => s.action);

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await page.evaluate(() => fm.clearAll());
  await importTemplates(page, LIBRARY);
});

// ---------- the canvas a template made ----------
test('a recorded Go to Canvas finds the canvas the macro made, even when another has its name', async ({ page }) => {
  const { macro, status } = await record(page, () => {
    fm.insertTemplate('Income Statement', 'newCanvas');
    fm.switchCanvas('Canvas 1');
    fm.createRect({ x: 40, y: 40, name: 'Marker' });
    fm.switchCanvas(fm.canvases().find(c => c.name === 'Income Statement').id);
    fm.setValue('Net Income', 50);
  });
  expect(status).toBe('Recorded 5 steps.');
  expect(macro.steps.map(s => [s.action, s.args, s.assign || null])).toEqual([
    ['insertTemplate', { template: 'Income Statement', mode: 'newCanvas' }, 't1'],
    ['switchCanvas', { canvas: 'Canvas 1' }, null],
    ['createRect', { x: 40, y: 40, name: 'Marker' }, 'r2'],
    ['switchCanvas', { canvas: '$t1' }, null],
    ['setValue', { node: 'Net Income', value: '50' }, null],
  ]);
  // Before the fix the third step said "Income Statement", which two canvases are now called.
  await page.evaluate(() => fm.switchCanvas('Canvas 1'));
  expect(await run(page, macro.name)).toBe('ok');
  const list = await canvasList(page);
  expect(list.map(c => c.name)).toEqual(['Canvas 1', 'Income Statement', 'Income Statement']);
  expect((await active(page)).id).toBe(list[2].id);
  const values = await page.evaluate((ids) => ids.map(id => { fm.switchCanvas(id); return fm.getValue({ node: 'Net Income' }); }), [list[1].id, list[2].id]);
  expect(values).toEqual([50, 50]);
  // Once more: a third canvas of that name, and the macro still goes to the new one.
  expect(await run(page, macro.name)).toBe('ok');
  const after = await canvasList(page);
  expect(after).toHaveLength(4);
  expect((await active(page)).id).toBe(after[3].id);
});

test('fm.insertTemplate returns what it made: the new canvas, the nodes added here', async ({ page }) => {
  const r = await page.evaluate(() => {
    const id = fm.insertTemplate('Income Statement', 'newCanvas');
    fm.switchCanvas('Canvas 1');
    const here = fm.insertTemplate('Balance Sheet', 'here');
    return { id, active: fm.canvases().find(c => c.name === 'Income Statement').id, here, nodes: fm.nodes().map(n => n.id) };
  });
  expect(r.id).toBe(r.active);
  expect(r.here).toHaveLength(4);
  expect(r.nodes).toEqual(expect.arrayContaining(r.here));
});

test('a template added to this canvas: later steps refer to its nodes through $t1', async ({ page }) => {
  const { macro } = await record(page, () => {
    const made = fm.insertTemplate('Balance Sheet', 'here');
    fm.move(made[0], 30, 0);   // an operator: no name of its own
  });
  expect(macro.steps.map(s => [s.action, s.args, s.assign || null])).toEqual([
    ['insertTemplate', { template: 'Balance Sheet', mode: 'here' }, 't1'],
    ['move', { nodes: ['$t1[0]'], dx: 30 }, null],
  ]);
  const before = await page.evaluate(() => fm.nodes().filter(n => n.type === 'operator').map(n => n.x));
  expect(await run(page, macro.name)).toBe('ok');
  const after = await page.evaluate(() => fm.nodes().filter(n => n.type === 'operator').map(n => n.x));
  // The two operators already there stay; the copy's first operator moved 30 from where the template puts it.
  expect(after.slice(0, 2)).toEqual(before);
  expect(after[2]).toBe(before[0]);   // both copies come from the same template: same place, then moved
});

// ---------- recipes ----------
test('a recipe: one canvas per part, in order; a template\'s operator by its place, with a note', async ({ page }) => {
  await page.evaluate(() => fm.saveRecipe({ name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] }));
  const { macro, status } = await record(page, () => {
    fm.insertTemplate({ template: 'Three Statements', mode: 'add' });
    fm.switchCanvas('Canvas 1');
    fm.createRect({ x: 40, y: 40, name: 'Marker' });
    const bs = fm.canvases().find(c => c.name === 'Balance Sheet').id;
    fm.switchCanvas(bs);
    fm.move(fm.nodes().find(n => n.type === 'operator').id, 0, 40);
  });
  expect(status).toBe('Recorded 5 steps. One step has a ⚠ note: something it refers to may not be there when the macro runs.');
  const [ins, , , go, move] = macro.steps;
  expect(ins).toMatchObject({ action: 'insertTemplate', args: { template: 'Three Statements', mode: 'add' }, assign: 't1' });
  expect(go.args).toEqual({ canvas: '$t1[1]' });
  expect(move.args).toEqual({ nodes: ['@all[0]'], dy: 40 });
  expect(move.comment).toBe('⚠ @all[0] is node 1 on the canvas a template made (it has no name of its own) — if the template changes, check this step.');
  const firstY = await page.evaluate(() => fm.nodes().find(n => n.type === 'operator').y);
  await page.evaluate(() => fm.switchCanvas('Canvas 1'));
  expect(await run(page, macro.name)).toBe('ok');
  const list = await canvasList(page);
  expect(list.map(c => c.name)).toEqual(['Canvas 1', 'Income Statement', 'Balance Sheet', 'Income Statement', 'Balance Sheet']);
  expect((await active(page)).id).toBe(list[4].id);
  expect(await page.evaluate(() => fm.nodes().find(n => n.type === 'operator').y)).toBe(firstY);
  // The parts list: one canvas per part, also when a part is skipped as already here.
  const r = await page.evaluate(() => fm.insertTemplate({ template: 'Three Statements', mode: 'add', skip: [1] }));
  const now = await canvasList(page);
  expect(r.canvases).toEqual([now[5].id]);
  expect(r.parts).toEqual([list[1].id, now[5].id]);
  const none = await page.evaluate(() => fm.insertTemplate({ template: 'Three Statements', mode: 'add', skip: [1, 2] }));
  expect(none.parts).toEqual([list[1].id, list[2].id]);
});

test('building a recipe with the parts already here skipped records skipExisting, and $t1[0] is that canvas', async ({ page }) => {
  await page.evaluate(() => fm.saveRecipe({ name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] }));
  await page.evaluate(() => fm.insertTemplate('Income Statement', 'newCanvas'));
  const firstIncome = (await active(page)).id;
  await page.evaluate(() => fm.command('toggleRecord'));
  await page.locator('.modal-box button.primary', { hasText: 'Start recording' }).click();
  await page.evaluate(() => fm.command('openTemplates'));
  await picker(page).locator('.template-list button.template-family', { hasText: 'Three Statements' }).click();
  await expect(picker(page).locator('.recipe-part-skip input')).toBeChecked();
  await picker(page).locator('button.recipe-build').click();
  await F.dismissMessage(page);
  await page.evaluate((id) => { fm.switchCanvas('Canvas 1'); fm.createRect({ x: 40, y: 40, name: 'Marker' }); fm.switchCanvas(id); }, firstIncome);
  await page.evaluate(() => fm.command('toggleRecord'));
  await closeBuilder(page);
  const macro = await lastMacro(page);
  expect(macro.steps.map(s => [s.action, s.args])).toEqual([
    ['insertTemplate', { template: 'Three Statements', mode: 'add', skipExisting: true }],
    ['switchCanvas', { canvas: 'Canvas 1' }],
    ['createRect', { x: 40, y: 40, name: 'Marker' }],
    ['switchCanvas', { canvas: '$t1[0]' }],
  ]);
  // A second Income Statement canvas: the name finds neither, the macro still goes to the part.
  await page.evaluate(() => { fm.insertTemplate('Income Statement', 'newCanvas'); fm.switchCanvas('Canvas 1'); });
  expect(await run(page, macro.name)).toBe('ok');
  expect((await active(page)).id).toBe(firstIncome);
  // Both parts are here now, so it built none.
  expect((await canvasList(page)).filter(c => c.name === 'Balance Sheet')).toHaveLength(1);
});

// ---------- a system template ----------
test('a system template: its canvases in order, a canvas merged into yours giving yours', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('system-template.json');
  fs.writeFileSync(file, JSON.stringify({ version: 10, kind: 'fmIDE-templates', templates: [{
    name: 'Two Sheets', kind: 'system', family: 'fam-two-sheets', version: 1, note: '', versionId: 'vid-two-sheets-1',
    data: { version: 9, kind: 'system', periods: ['P1'], activeCanvasId: 'c1', canvases: [
      { id: 'c1', name: 'Income Statement', nodes: [{ id: 'n1', type: 'value', x: 40, y: 40, w: 170, h: 64, text: 'Tax\n5' }], edges: [] },
      { id: 'c2', name: 'Notes', nodes: [{ id: 'n1', type: 'value', x: 40, y: 40, w: 170, h: 64, text: 'Note\n1' }], edges: [] }] } }] }));
  await importTemplates(page, file);
  await page.evaluate(() => fm.insertTemplate('Income Statement', 'newCanvas'));
  const mine = (await active(page)).id;
  const r = await page.evaluate(() => fm.insertTemplate('Two Sheets', 'add'));
  const list = await canvasList(page);
  expect(list.map(c => c.name)).toEqual(['Canvas 1', 'Income Statement', 'Notes']);
  expect(r).toEqual([mine, list[2].id]);
  const kept = await page.evaluate(() => fm.insertTemplate({ template: 'Two Sheets', mode: 'add', onCollision: 'keep' }));
  const after = await canvasList(page);
  expect(kept).toEqual([after[3].id, after[4].id]);
});

// ---------- the Macro Builder ----------
test('the Macro Builder names the result of a step that makes something', async ({ page }) => {
  await page.evaluate(() => fm.command('openMacros'));
  await builder(page).locator('button', { hasText: '+ New' }).click();
  const tools = builder(page).locator('.macro-tools');
  await tools.locator('button', { hasText: '+ Action' }).click();
  await tools.locator('button', { hasText: '+ Action' }).click();
  const rows = builder(page).locator('.macro-tree .mrow');
  await expect(rows.locator('.asg')).toHaveText(['→ $r1', '→ $r2']);
  // A step changed to Insert Template keeps its name; one with nothing to save loses it.
  const action = builder(page).locator('.macro-props select').first();
  await action.selectOption('switchCanvas');
  await expect(rows.nth(1).locator('.asg')).toHaveCount(0);
  await action.selectOption('insertTemplate');
  await expect(rows.nth(1).locator('.asg')).toHaveText('→ $t2');
  await expect(builder(page).locator('.macro-props input[placeholder="e.g. t1"]')).toHaveValue('t2');
  await tools.locator('button[title^="Duplicate"]').click();
  await expect(rows.locator('.asg')).toHaveText(['→ $r1', '→ $t2', '→ $t3']);
  // The reference card names canvases and ids, and leads to Help.
  const card = builder(page).locator('.macro-ref-help');
  await expect(card).toContainText('#c3');
  await expect(card).toContainText('$t1[0]');
  await card.locator('button', { hasText: 'More about references' }).click();
  await expect(page.locator('#helpPanel')).toContainText('Referring to nodes, canvases and templates');
});

// ---------- notes on references that may not hold ----------
test('the recorder notes a node of this model by id, and a Paste whose Copy was not recorded', async ({ page }) => {
  await page.evaluate(() => { fm.insertTemplate('Balance Sheet', 'here'); fm.copy('Retained Earnings'); });
  const op = await page.evaluate(() => fm.nodes().find(n => n.type === 'operator').id);
  const { macro, status } = await record(page, (id) => { fm.move(id, 10, 0); fm.paste(); }, op);
  expect(status).toBe('Recorded 2 steps. 2 steps have a ⚠ note: something it refers to may not be there when the macro runs.');
  expect(macro.steps[0].args.nodes).toEqual(['#' + op]);
  expect(macro.steps[0].comment).toBe(`⚠ #${op} is a node of this model with no name of its own to use — run in another model, this step won't find it.`);
  expect(macro.steps[1].comment).toMatch(/^⚠ Pastes whatever was copied before the macro runs/);
  // With the Copy recorded too, no note.
  const second = await record(page, () => { fm.copy('Cash balance'); fm.paste(); });
  expect(second.status).toBe('Recorded 2 steps.');
  expect(second.macro.steps.map(s => s.comment || null)).toEqual([null, null]);
});

// ---------- messages that say what to do ----------
test('the messages that stop a macro say what to do, with the ids to choose from', async ({ page }) => {
  await page.evaluate(() => { fm.renameCanvas(fm.canvases()[0].id, 'Loan Interest'); fm.addCanvas('Other'); });
  const { macro } = await record(page, () => fm.switchCanvas('Loan Interest'));
  expect(macro.steps[0].args).toEqual({ canvas: 'Loan Interest' });
  await page.evaluate(() => fm.addCanvas('Loan Interest'));
  const ids = (await canvasList(page)).filter(c => c.name === 'Loan Interest').map(c => c.id);
  expect(await run(page, macro.name)).toBe(`Error: Step "switchCanvas canvas="Loan Interest"" — More than one canvas is named "Loan Interest" (#${ids[0]}, #${ids[1]}). Rename one (double-click its tab), or write the id of the one you mean instead of the name, like #${ids[0]} — hover over a canvas tab to see its id. If an earlier step made the canvas, use that step's variable instead (like $t1[0] or $c1).`);
  // The canvas tabs show their ids.
  const tabs = page.locator('#canvasTabs .canvas-tab', { hasText: 'Loan Interest' });
  await expect(tabs.nth(0)).toHaveAttribute('title', `Click to open · double-click to rename · drag to reorder · id #${ids[0]}`);
  await expect(tabs.nth(1)).toHaveAttribute('title', `Click to open · double-click to rename · drag to reorder · id #${ids[1]}`);
  // In the Builder, the step's error is shown and the step marked.
  await page.evaluate(() => fm.command('openMacros'));
  await builder(page).locator('.mitem', { hasText: macro.name }).click();
  await builder(page).locator('.macro-foot button', { hasText: 'Run macro' }).click();
  await expect(builder(page).locator('.macro-foot .status')).toContainText('Stopped — nothing was changed. Step "switchCanvas canvas="Loan Interest"" — More than one canvas is named "Loan Interest"');
  await expect(builder(page).locator('.macro-tree .mrow.err')).toHaveCount(1);
  await closeBuilder(page);
  // Rectangles named twice: their ids.
  const two = await page.evaluate(() => { const a = fm.createRect({ x: 40, y: 40, name: 'Rate' }); const b = fm.createRect({ x: 40, y: 200, name: 'Rate' }); return [a, b]; });
  const msg = await page.evaluate(() => { try{ fm.setValue('Rate', 3); return ''; }catch(e){ return e.message; } });
  expect(msg).toBe(`2 rectangles on "Loan Interest" are named "Rate" (#${two[0]}, #${two[1]}). Rename one, or write its id instead of the name, like #${two[0]} — select it and use Copy Reference to get it. If an earlier step made it, use that step's variable (like $r1).`);
  // An id from another model.
  expect(await page.evaluate(() => { try{ fm.switchCanvas('#c999'); return ''; }catch(e){ return e.message; } }))
    .toBe('There is no canvas #c999 (ids belong to one document: a macro made in another one names other canvases).');
});

test('a macro working on the selection, run with nothing selected, says to select first', async ({ page }) => {
  await page.evaluate(() => { const id = fm.createRect({ x: 40, y: 40, name: 'Price' }); fm.select(id); });
  const { macro } = await record(page, () => fm.setValue('Price', 7), undefined, { selection: true });
  expect(macro.steps[0].args).toEqual({ node: '@sel[0]', value: '7' });
  await page.evaluate(() => fm.clearSelection());
  expect(await run(page, macro.name)).toBe('Error: Step "setValue node=@sel[0] value=7" — Nothing was selected when the macro started, and this step works on the selection (@sel). Select the nodes it should work on, then run the macro again.');
});

test('a variable holding several canvases, or a node, in a canvas box: what to write instead', async ({ page }, testInfo) => {
  await page.evaluate(() => fm.saveRecipe({ name: 'Three Statements', parts: ['Income Statement', 'Balance Sheet@2'] }));
  const file = testInfo.outputPath('macros.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, kind: 'fmIDE-macros', macros: [
    { id: 'macA', name: 'Whole list', steps: [
      { kind: 'action', action: 'insertTemplate', args: { template: 'Three Statements' }, assign: 't1' },
      { kind: 'action', action: 'switchCanvas', args: { canvas: '$t1' } }] },
    { id: 'macB', name: 'A node', steps: [
      { kind: 'action', action: 'createRect', args: { name: 'X' }, assign: 'r1' },
      { kind: 'action', action: 'switchCanvas', args: { canvas: '$r1' } }] },
    { id: 'macC', name: 'A canvas as a node', steps: [
      { kind: 'action', action: 'addCanvas', args: { name: 'Fresh' }, assign: 'c1' },
      { kind: 'action', action: 'setValue', args: { node: '$c1', value: '1' } }] },
    { id: 'macD', name: 'By the name kept', steps: [
      { kind: 'set', var: 'where', value: 'Canvas 1' },
      { kind: 'action', action: 'switchCanvas', args: { canvas: '$where' } }] },
    { id: 'macE', name: 'Its nodes', steps: [
      { kind: 'action', action: 'insertTemplate', args: { template: 'Three Statements' }, assign: 't1' },
      { kind: 'action', action: 'setValue', args: { node: '$t1[0]::Net Income', value: '9' } }] }] }));
  await page.evaluate(() => fm.command('openMacros'));
  const chooser = page.waitForEvent('filechooser');
  await builder(page).locator('button', { hasText: '⇧ Import' }).click();
  await (await chooser).setFiles(file);
  await expect(builder(page).locator('.macro-foot .status')).toHaveText('Imported 5 macros.');
  await closeBuilder(page);
  expect(await run(page, 'Whole list')).toBe('Error: Step "switchCanvas canvas=$t1" — $t1 holds 2 canvases or nodes — say which one, like $t1[0] (counted from 0).');
  expect(await run(page, 'A node')).toBe('Error: Step "switchCanvas canvas=$r1" — $r1 holds a node, not a canvas.');
  expect(await run(page, 'A canvas as a node')).toBe('Error: Step "setValue node=$c1 value=1" — $c1 holds a canvas, not a node. For a node on it, write $c1::Name (Name: the rectangle\'s name).');
  await page.evaluate(() => fm.addCanvas('Elsewhere'));
  expect(await run(page, 'By the name kept')).toBe('ok');
  expect((await active(page)).name).toBe('Canvas 1');
  expect(await run(page, 'Its nodes')).toBe('ok');
  const income = (await canvasList(page)).find(c => c.name === 'Income Statement').id;
  expect(await page.evaluate((id) => { fm.switchCanvas(id); return fm.getValue({ node: 'Net Income' }); }, income)).toBe(9);
});

// ---------- Copy Reference ----------
test('Copy Reference copies the name, or the id when the name is used twice, or the canvas\'s', async ({ page }) => {
  await page.evaluate(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  });
  const ids = await page.evaluate(() => [fm.createRect({ x: 40, y: 40, name: 'Rate' }), fm.createRect({ x: 40, y: 200, name: 'Rate' }), fm.createRect({ x: 300, y: 40, name: 'Cost' })]);
  await page.evaluate((id) => { fm.select(id); fm.command('copyReference'); }, ids[2]);
  await page.evaluate((list) => { fm.select(list); fm.command('copyReference'); }, [ids[0], ids[2]]);
  await page.evaluate(() => { fm.clearSelection(); fm.command('copyReference'); });
  await page.evaluate(() => { fm.addCanvas('Canvas 1'); fm.command('copyReference'); });
  const second = (await active(page)).id;
  expect(await page.evaluate(() => window.__copied)).toEqual(['Cost', `#${ids[0]}, Cost`, 'Canvas 1', '#' + second]);
  await expect(page.locator('.toast').last()).toContainText(`Copied #${second} — how a macro step refers to this canvas.`);
  // Where the browser can't copy (a page without clipboard access), it shows the text instead.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.evaluate(() => fm.command('copyReference'));
  await expect(F.topDialog(page)).toContainText('How a macro step refers to this canvas:');
  await expect(F.topDialog(page)).toContainText('#' + second);
  await F.dismissMessage(page);
  // In the Macros group of the ribbon.
  const macros = await page.evaluate(() => __fmIDE.getRibbonConfig().tabs.find(t => t.id === 'macros').groups[0].items.map(i => i.cmd));
  expect(macros).toEqual(['openMacros', 'toggleRecord', 'runLastMacro', 'copyReference']);
});

test('the step boxes offer canvases sharing a name, and the selected nodes, by id', async ({ page }) => {
  await page.evaluate(() => { fm.addCanvas('Twin'); fm.addCanvas('Twin'); fm.switchCanvas('Canvas 1'); const a = fm.createRect({ x: 40, y: 40, name: 'Rate' }); fm.select(a); });
  const twins = (await canvasList(page)).filter(c => c.name === 'Twin').map(c => c.id);
  const sel = await page.evaluate(() => fm.selection()[0]);
  await page.evaluate(() => fm.command('openMacros'));
  await builder(page).locator('button', { hasText: '+ New' }).click();
  await builder(page).locator('.macro-tools button', { hasText: '+ Action' }).click();
  const action = builder(page).locator('.macro-props select').first();
  await action.selectOption('switchCanvas');
  const canvasOptions = await builder(page).locator('.macro-props datalist option').evaluateAll(os => os.map(o => [o.value, o.getAttribute('label') || o.value]));
  expect(canvasOptions).toEqual(expect.arrayContaining([['Canvas 1', 'Canvas 1'], ['#' + twins[0], 'Twin'], ['#' + twins[1], 'Twin']]));
  expect(canvasOptions.map(o => o[0])).not.toContain('Twin');
  await action.selectOption('setValue');
  const nodeOptions = await builder(page).locator('.macro-props datalist').first().locator('option').evaluateAll(os => os.map(o => [o.value, o.getAttribute('label') || o.value]));
  expect(nodeOptions).toEqual(expect.arrayContaining([['Rate', 'Rate'], ['#' + sel, 'Rate (selected)']]));
});

test('a ribbon customised before gets Copy Reference after Run Last Macro, once', async ({ page }, testInfo) => {
  const load = async (ui, name) => {
    const file = testInfo.outputPath(name);
    fs.writeFileSync(file, JSON.stringify({ kind: 'fmIDE-workspace', version: 10, system: { kind: 'system', version: 9, periods: ['P1'], activeCanvasId: 'c1', canvases: [{ id: 'c1', name: 'Model', nodes: [], edges: [] }] }, ui }));
    await F.importViaCommand(page, 'importWorkspace', file);
    await F.acceptAll(page);
    return page.evaluate(() => __fmIDE.getRibbonConfig().tabs.map(t => t.groups.map(g => g.label + ':' + g.items.map(i => i.cmd).join(','))));
  };
  const older = { ribbonCustomized: true, zoomGroupAdded: true, documentGroupAdded: true, functionsGroupAdded: true, functionCommandsAdded: true, operatorsE1Added: true,
    operatorsE2Added: true, operatorsE2bAdded: true, libraryPacksAdded: true, libraryBrowseAdded: true, helpAdded: true, whatsNewAdded: true, addManyRectsAdded: true, fmGraphAdded: true, canvasSwitchAdded: true,
    ribbon: { tabs: [{ id: 'mine', label: 'Mine', groups: [{ label: 'Mac', items: [{ cmd: 'openMacros' }, { cmd: 'runLastMacro' }, { cmd: 'undo' }] }] }] } };
  expect(await load(older, 'older.json')).toEqual([['Mac:openMacros,runLastMacro,copyReference,undo']]);
  expect(await load(Object.assign({}, older, { copyReferenceAdded: true }), 'removed.json')).toEqual([['Mac:openMacros,runLastMacro,undo']]);
});
