// 28. Where new nodes go (fmIDE): nothing new lands on another node, and the Macro
// Builder's "Run selected step" moves on to the next step.
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

// Pairs of nodes on the current canvas whose boxes overlap.
async function overlaps(page){
  return page.evaluate(() => {
    const list = fm.nodes(), out = [];
    for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
      const a = list[i], b = list[j];
      if(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(a.id + ' ~ ' + b.id);
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await F.openFmIDE(page);
  await page.evaluate(() => fm.clearCanvas());
});

test('Insert commands put each new node in free space near the middle of the view', async ({ page }) => {
  for(let k = 0; k < 4; k++){
    await page.evaluate(() => fm.command('addRect'));
    await page.keyboard.press('Escape'); // the new rectangle opens its text for typing
    await page.evaluate(() => fm.command('insertOp0'));
    await page.evaluate(() => fm.command('addPeriodShift'));
  }
  expect(await page.evaluate(() => fm.nodes().length)).toBe(12);
  expect(await overlaps(page)).toEqual([]);
  // Near the middle: the first rectangle is where the view's centre is.
  const first = await page.evaluate(() => fm.nodes()[0]);
  const view = await page.evaluate(() => { const v = document.getElementById('viewport'); return { x: v.scrollLeft + v.clientWidth / 2, y: v.scrollTop + v.clientHeight / 2 }; });
  expect(Math.abs(first.x + first.w / 2 - view.x)).toBeLessThan(2);
  expect(Math.abs(first.y + first.h / 2 - view.y)).toBeLessThan(2);
});

test('fm.create… without x/y finds free space; with x/y it goes exactly there', async ({ page }) => {
  const r = await page.evaluate(() => {
    const ids = [];
    for(let k = 0; k < 5; k++) ids.push(fm.createRect({ name: 'R' + k }));
    ids.push(fm.createOperator({ op: '+' }));
    ids.push(fm.createAlias({ source: 'R0' }));
    const exact = fm.createRect({ x: 50, y: 60, name: 'Exact' });
    const onTop = fm.createRect({ x: 50, y: 60, name: 'On top' }); // asked for: kept, even overlapping
    const n = fm.nodes();
    return { exact: n.find(x => x.id === exact), onTop: n.find(x => x.id === onTop), others: n.filter(x => ids.includes(x.id)).length };
  });
  expect(r.others).toBe(7);
  expect([r.exact.x, r.exact.y, r.onTop.x, r.onTop.y]).toEqual([50, 60, 50, 60]);
  expect(await overlaps(page)).toEqual(['' + r.exact.id + ' ~ ' + r.onTop.id]);
});

test('Duplicate and aliases with the default offset keep their layout and land in free space', async ({ page }) => {
  const [a, b] = await page.evaluate(() => {
    const ids = [fm.createRect({ x: 100, y: 100, name: 'A' }), fm.createRect({ x: 100, y: 200, name: 'B' })];
    fm.createRect({ x: 124, y: 124, name: 'Blocker 1' });  // where a copy offset by 24 would go
    fm.createRect({ x: 130, y: 130, name: 'Blocker 2' });  // where an alias offset by 30 would go
    return ids;
  });
  const before = await overlaps(page); // the two blockers, placed by hand on purpose
  const copies = await page.evaluate((ids) => fm.duplicate({ nodes: ids }), [a, b]);
  const aliases = await page.evaluate((ids) => fm.aliasOf({ nodes: ids }), [a, b]);
  // Nothing new overlaps anything.
  expect(await overlaps(page)).toEqual(before);
  const pos = await page.evaluate((ids) => { const n = fm.nodes(); return ids.map(id => n.find(x => x.id === id)); }, copies.concat(aliases));
  // Each pair keeps its layout: the second stays 100px under the first.
  expect([pos[1].x - pos[0].x, pos[1].y - pos[0].y]).toEqual([0, 100]);
  expect([pos[3].x - pos[2].x, pos[3].y - pos[2].y]).toEqual([0, 100]);
  // An offset given explicitly is kept exactly.
  const exact = await page.evaluate((id0) => { const [id] = fm.duplicate({ nodes: [id0], dx: 5, dy: 5 }); return fm.nodes().find(x => x.id === id); }, a);
  expect([exact.x, exact.y]).toEqual([105, 105]);
});

test('the automatic aliases a socket gets from other canvases never overlap', async ({ page }) => {
  const result = await page.evaluate(() => {
    fm.renameCanvas({ name: 'Summary' });
    const op = fm.createOperator({ x: 260, y: 60, op: '+' });
    fm.setSocket(op, 'Revenue');
    fm.createRect({ x: 60, y: 40, name: 'Sitting left' });   // where the aliases would go
    fm.createRect({ x: 60, y: 120, name: 'Also left' });
    fm.addCanvas({ name: 'Sales' });
    for(let k = 0; k < 4; k++){ const r = fm.createRect({ x: 60, y: 40 + k * 100, name: 'Seg ' + k, value: String(k + 1) }); fm.setPlugs(r, ['Revenue']); }
    fm.switchCanvas('Summary');
    return fm.nodes().filter(n => n.type === 'alias').length;
  });
  expect(result).toBe(4);
  expect(await overlaps(page)).toEqual([]);
});

test('"Run selected step" runs it and selects the next step', async ({ page }) => {
  await page.evaluate(() => __fmIDE.importMacros([{ id: 'macStep', name: 'Step through', steps: [
    { kind: 'action', action: 'createRect', args: { x: 40, y: 40, name: 'One' } },
    { kind: 'group', label: 'Two and three', children: [
      { kind: 'action', action: 'createRect', args: { x: 40, y: 140, name: 'Two' } },
      { kind: 'action', action: 'createRect', args: { x: 40, y: 240, name: 'Three' } },
    ] },
    { kind: 'action', action: 'createRect', args: { x: 40, y: 340, name: 'Four' } },
  ] }], 'add') && __fmIDE.syncMacroCommands());
  await page.evaluate(() => fm.command('openMacros'));
  const builder = page.locator('.modal-box.macro-box');
  await builder.locator('.macro-list button', { hasText: 'Step through' }).first().click();
  const rows = builder.locator('.mrow');
  const selected = () => builder.locator('.mrow.sel');
  const run = builder.locator('button', { hasText: '▶ Run selected step' });
  await rows.filter({ hasText: 'One' }).first().click();
  await run.click();
  await expect(selected()).toContainText('Two and three'); // the group after it
  await run.click();                                       // runs the group (Two, Three)…
  await expect(selected()).toContainText('Four');          // …and skips over what is inside it
  await run.click();
  await expect(builder).toContainText('It was the last step.');
  await expect(selected()).toContainText('Four');
  expect(await page.evaluate(() => fm.nodes().map(n => n.name))).toEqual(['One', 'Two', 'Three', 'Four']);
  // Inside a group, the step after the last one is the group's next sibling.
  await rows.filter({ hasText: 'Three' }).first().click();
  await run.click();
  await expect(selected()).toContainText('Four');
});

test('pasting a group twice puts each copy in free space and keeps its layout', async ({ page }) => {
  const ids = await page.evaluate(() => [fm.createRect({ x: 100, y: 100, name: 'A' }), fm.createRect({ x: 100, y: 220, name: 'B' })]);
  await page.evaluate((ids) => fm.select(ids), ids);
  await page.evaluate(() => fm.command('copy'));
  await page.evaluate(() => fm.command('paste'));
  await page.evaluate(() => fm.command('paste'));
  const nodes = await page.evaluate(() => fm.nodes());
  expect(nodes.length).toBe(6);
  expect(await overlaps(page)).toEqual([]);
  // Each copy keeps B 120 px under A.
  const as = nodes.filter(n => n.name === 'A').sort((p, q) => p.x - q.x || p.y - q.y);
  for(const a of as){
    const b = nodes.find(n => n.name === 'B' && n.x === a.x && n.y === a.y + 120);
    expect(b, `a B under the A at ${a.x}, ${a.y}`).toBeTruthy();
  }
});
