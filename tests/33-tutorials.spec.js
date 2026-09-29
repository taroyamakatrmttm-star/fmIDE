// Test group 33 — tutorials and the welcome card (build step 10, phase H3; docs/step10-help.md).
// - Every tutorial is played through as a person would: real clicks, typing and right-button
//   drags, following each step's text. Each step must move on by itself (or with Next), and
//   whatever a step points at must be on screen. A step with no action here fails the test, so
//   a tutorial can't change without its test changing too.
// - Practice mode: your own model, undo history and document come back unchanged after
//   finishing or exiting; a reload mid-tutorial brings back your own work (the autosave was
//   paused); commands touching your files are refused while practising.
// - The welcome card: on the very first start only, in a corner, blocking nothing; its choices.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('./helpers/apps');
const F = require('./helpers/fmide');

const SRC = path.join(__dirname, '..', 'src');
const T = vm.runInContext(fs.readFileSync(path.join(SRC, 'help', 'fmide-tutorials.js'), 'utf8') + '\n;({ TUTORIALS })', vm.createContext({})).TUTORIALS;
const card = (page) => page.locator('#tutorialCard');

// ---------- a person's actions ----------
const nodeByName = (page, name) => page.evaluate((name) => {
  const n = fm.nodes().find(n => n.type === 'value' && n.text.split('\n')[0].trim().toLowerCase() === name.toLowerCase());
  return n ? n.id : null;
}, name);
const nodeOfType = (page, type, text) => page.evaluate(([type, text]) => {
  const n = fm.nodes().find(n => n.type === type && (text === undefined || n.text === text));
  return n ? n.id : null;
}, [type, text]);
const ribbon = (page, cmd) => page.locator(`#ribbon [data-tip-cmd="${cmd}"]`).first();
async function addRect(page, lines){
  await ribbon(page, 'addRect').click();
  const ta = page.locator('#canvas textarea');
  await expect(ta).toBeFocused();
  for(let i = 0; i < lines.length; i++){
    if(i) await page.keyboard.press('Shift+Enter');
    await page.keyboard.type(lines[i]);
  }
  await page.keyboard.press('Enter');
}
async function addOperator(page, sym){
  await ribbon(page, 'addOperator').click();
  await page.locator('.op-picker button').filter({ hasText: new RegExp('^' + sym.replace(/[+*]/g, '\\$&') + '$') }).first().click();
}
async function drawArrow(page, fromId, toId){
  const at = async (id) => { const b = await page.locator(`.node[data-id="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const a = await at(fromId), b = await at(toId);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up({ button: 'right' });
}
const arrowByNames = (from, to) => async (page) => {
  const id = async (ref) => typeof ref === 'string' ? nodeByName(page, ref)
    : ref.op ? nodeOfType(page, 'operator', ref.op) : nodeOfType(page, 'periodShift');
  await drawArrow(page, await id(from), await id(to));
};
const next = async (page) => { await card(page).locator('.tutorial-next').click(); };
const finish = async (page) => { await card(page).locator('.tutorial-finish').click(); };
const evaluate = async (page) => { await ribbon(page, 'evaluate').click(); };

// What a person does at each step, by tutorial and step id.
const ACTIONS = {
  'first-model': {
    'intro': next,
    'price': (page) => addRect(page, ['Price', '10', '$/t']),
    'quantity': (page) => addRect(page, ['Quantity', '5', 't']),
    'revenue': (page) => addRect(page, ['Revenue']),
    'multiply': (page) => addOperator(page, '×'),
    'arrow-price': arrowByNames('Price', { op: '×' }),
    'arrow-quantity': arrowByNames('Quantity', { op: '×' }),
    'arrow-revenue': arrowByNames({ op: '×' }, 'Revenue'),
    'evaluate': evaluate,
    'done': finish,
  },
  'time': {
    'intro': next,
    'periods': async (page) => {
      await ribbon(page, 'managePeriods').click();
      const box = F.topDialog(page);
      await box.locator('input[type=number]').fill('5');
      await box.locator('button', { hasText: /^Set$/ }).click();
      await box.locator('button', { hasText: /^Done$/ }).click();
    },
    'opening': (page) => addRect(page, ['Opening', '100']),
    'additions': (page) => addRect(page, ['Additions', '20']),
    'closing': (page) => addRect(page, ['Closing']),
    'plus': (page) => addOperator(page, '+'),
    'wire': async (page) => {
      await arrowByNames('Opening', { op: '+' })(page);
      await arrowByNames('Additions', { op: '+' })(page);
      await arrowByNames({ op: '+' }, 'Closing')(page);
    },
    'first-value': evaluate,
    'shift': (page) => ribbon(page, 'addPeriodShift').click(),
    'shift-wire': async (page) => {
      await arrowByNames('Closing', { shift: -1 })(page);
      await arrowByNames({ shift: -1 }, 'Opening')(page);
    },
    'own-number': async (page) => {
      const id = await nodeByName(page, 'Opening');
      await page.locator(`.node[data-id="${id}"]`).click();
      await page.locator(`.node[data-id="${id}"] .period-btn`).click();
      const box = F.topDialog(page);
      await box.locator('button', { hasText: 'First period only' }).click();
      await box.locator('button', { hasText: /^Save$/ }).click();
    },
    'later': async (page) => {
      await evaluate(page);
      await ribbon(page, 'nextPeriod').click();
      await ribbon(page, 'nextPeriod').click();
    },
    'done': finish,
  },
};

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1400, height: 900 }); await F.openFmIDE(page); });

const ownModel = (page) => page.evaluate(() => ({
  canvases: fm.canvases().map(c => c.name), nodes: fm.nodes().map(n => n.text).sort(), periods: __fmIDE.getPeriods().slice(), title: document.title,
}));

test('every tutorial step has an action in this test, and every tutorial has steps', async () => {
  expect(T.length).toBeGreaterThanOrEqual(2);
  const missing = [];
  T.forEach(t => {
    if(!t.steps.length) missing.push(t.id + ': no steps');
    t.steps.forEach(s => { if(!(ACTIONS[t.id] && ACTIONS[t.id][s.id])) missing.push(t.id + '/' + s.id); });
  });
  expect(missing).toEqual([]);
});

for(const t of T){
  test(`tutorial "${t.title}", played through as a person would; your model comes back unchanged`, async ({ page, pageErrors }) => {
    // Your own work, with an unsaved change and something to undo.
    await page.evaluate(() => fm.createRect({ name: 'Mine', value: 7 }));
    const before = await ownModel(page);
    await page.keyboard.press('F1');
    await page.locator(`#helpPanel .help-tutorial[data-tutorial="${t.id}"] .help-tutorial-start`).click();
    await expect(card(page)).toBeVisible();
    await expect(page.locator('#helpPanel')).toBeHidden();
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Practice']);
    expect(await page.evaluate(() => fm.nodes().length)).toBe(0);
    for(let i = 0; i < t.steps.length; i++){
      const s = t.steps[i];
      await expect(card(page)).toHaveAttribute('data-step', s.id);
      await expect(card(page).locator('.tutorial-count')).toHaveText(`Step ${i + 1} of ${t.steps.length}`);
      await expect(card(page).locator('.tutorial-text')).not.toContainText('{cmd:');
      if(s.point) await expect(page.locator('#tutorialPointer'), `${t.id}/${s.id} points at something on screen`).toBeVisible();
      await ACTIONS[t.id][s.id](page);
      if(i < t.steps.length - 1) await expect(card(page), `${t.id}/${s.id} moves on`).toHaveAttribute('data-step', t.steps[i + 1].id);
    }
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator('#tutorialPointer')).toHaveCount(0);
    expect(await ownModel(page)).toEqual(before);
    await page.evaluate(() => fm.command('undo'));                 // your own undo history is back
    expect(await page.evaluate(() => fm.nodes().some(n => n.text.startsWith('Mine')))).toBe(false);
    expect(pageErrors).toEqual([]);
  });
}

// Found while writing the "Time" tutorial: the 🕒 button sat under the rectangle's own resize
// corner, so a click on it started a resize.
test('a rectangle\'s 🕒 button is on top where it is drawn, and opens its window', async ({ page }) => {
  const id = await page.evaluate(() => { fm.clearAll(); const o = fm.createRect({ x: 200, y: 200, name: 'Opening', value: 100 }); fm.select(['#' + o]); return o; });
  const hit = await page.evaluate((id) => {
    const b = document.querySelector(`.node[data-id="${id}"] .period-btn`).getBoundingClientRect();
    return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).className;
  }, id);
  expect(hit).toContain('period-btn');
  // …and clear of the bottom dot, where arrows start.
  const dotHit = await page.evaluate((id) => {
    const b = document.querySelector(`.node[data-id="${id}"] .port.s`).getBoundingClientRect();
    return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).className;
  }, id);
  expect(dotHit).toContain('port');
  // The resize corner is still reachable.
  const hit2 = await page.evaluate((id) => {
    const b = document.querySelector(`.node[data-id="${id}"] .resize-handle`).getBoundingClientRect();
    return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).className;
  }, id);
  expect(hit2).toContain('resize-handle');
  await page.locator(`.node[data-id="${id}"] .period-btn`).click();
  await expect(F.topDialog(page)).toContainText("Which periods use this rectangle's own number?");
});

// Found on CI: a refresh of the ribbon (after any change) turned the tutorials' ▶ grey, as if
// they were commands that can't run.
test('the tutorials\' ▶ stay enabled when the Help panel refreshes its commands', async ({ page }) => {
  await page.keyboard.press('F1');
  await page.locator('#helpPanel .help-search').fill('align left');
  const run = page.locator('#helpPanel .help-command[data-cmd="alignLeft"] .help-run');
  await page.evaluate(() => fm.clearSelection());
  await expect(run).toBeDisabled();
  await page.locator('#helpPanel .help-search').fill('');
  await page.evaluate(() => fm.createRect({ name: 'A change' }));   // the ribbon, and the panel, refresh
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const starts = page.locator('#helpPanel .help-tutorial-start');
  await expect(starts).toHaveCount(T.length);
  for(let i = 0; i < T.length; i++) await expect(starts.nth(i)).toBeEnabled();
  await page.locator('#helpPanel .help-search').fill('align left');
  await page.evaluate(() => fm.select('@all'));
  await expect(run).toBeEnabled();                                  // commands still follow what can run
});

test.describe('practice mode', () => {
  test('Exit puts everything back; files and documents are refused while practising', async ({ page }) => {
    const before = await ownModel(page);
    await page.evaluate(() => fm.command('openLauncher'));
    await page.locator('.launcher input.lq').fill('tutorial first');
    await page.locator('.launcher .lrow', { hasText: 'Tutorial: Your first model' }).click();
    await expect(card(page)).toHaveAttribute('data-step', 'intro');
    expect(await page.evaluate(() => document.title)).toContain('Practice');
    await next(page);
    await addRect(page, ['Price', '10']);
    await expect(card(page)).toHaveAttribute('data-step', 'quantity');
    expect(await page.evaluate(() => fm.command('saveDocument'))).toBe(false);
    await expect(page.locator('#fmToast')).toContainText('Finish or exit the tutorial first');
    // Skip and Back
    await card(page).locator('.tutorial-skip').click();
    await expect(card(page)).toHaveAttribute('data-step', 'revenue');
    await card(page).locator('.tutorial-back').click();
    await expect(card(page)).toHaveAttribute('data-step', 'quantity');
    await card(page).locator('.tutorial-exit').click();
    await expect(card(page)).toHaveCount(0);
    expect(await ownModel(page)).toEqual(before);
  });

  test('a reload in the middle of a tutorial brings back your own work, not the practice', async ({ page }) => {
    await page.evaluate(() => fm.renameCanvas({ canvas: '@current', name: 'My Real Work' }));
    await page.evaluate(() => new Promise(r => setTimeout(r, 2600)));   // autosaved
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
    await next(page);
    await addRect(page, ['Price', '10']);
    await page.evaluate(() => new Promise(r => setTimeout(r, 2600)));   // an autosave would have run by now
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['My Real Work']);
    await expect(card(page)).toHaveCount(0);
  });

  test('the last step can download what was built', async ({ page }) => {
    await page.evaluate(() => { const b = document.createElement('div'); document.body.appendChild(b); });
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-tutorial[data-tutorial="first-model"] .help-tutorial-start').click();
    await next(page);
    await addRect(page, ['Price', '10']);
    // Go to the last step with Skip, then download.
    for(let i = 0; i < 20 && await card(page).locator('.tutorial-skip').count(); i++) await card(page).locator('.tutorial-skip').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), card(page).locator('.tutorial-download').click()]);
    expect(dl.suggestedFilename()).toBe('practice.fmide');
    const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    expect(data.kind).toBe('fmIDE-workspace');
    expect(JSON.stringify(data.system)).toContain('Price');
    await finish(page);
  });
});

test.describe('the welcome card', () => {
  test('on the very first start, in a corner, blocking nothing; not again once there is saved work', async ({ page }) => {
    const w = page.locator('#welcomeCard');
    await expect(w).toBeVisible();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    // A window opened with it showing is on top of it (its buttons are never covered).
    await page.evaluate(() => fm.command('openTemplates'));
    const z = await page.evaluate(() => [getComputedStyle(document.getElementById('welcomeCard')).zIndex, getComputedStyle(document.querySelector('.modal-overlay')).zIndex].map(Number));
    expect(z[0]).toBeLessThan(z[1]);
    await F.topDialog(page).locator('button', { hasText: /^Close$/ }).click();
    const b = await w.boundingBox();
    expect(b.x + b.width).toBeGreaterThan(1400 - 40);           // bottom-right corner
    expect(b.y + b.height).toBeGreaterThan(900 - 40);
    // Shortcuts still work with it showing.
    await page.mouse.click(300, 500);
    await page.keyboard.press('F1');
    await expect(page.locator('#helpPanel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => fm.createRect({ name: 'Saved' }));
    await expect(w).toHaveCount(0);                                    // it steps aside once you start building
    await page.evaluate(() => new Promise(r => setTimeout(r, 2600)));   // autosaved
    await page.reload();
    await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    await expect(w).toHaveCount(0);
    // It can be shown again from the Help panel.
    await page.keyboard.press('F1');
    await page.locator('#helpPanel .help-show-welcome').click();
    await expect(w).toBeVisible();
  });

  test('its choices: the tour, the sample, start blank, Help', async ({ page }) => {
    const w = page.locator('#welcomeCard');
    await w.locator('.welcome-tour').click();
    await expect(card(page)).toHaveAttribute('data-tutorial', 'first-model');
    await expect(w).toHaveCount(0);
    await card(page).locator('.tutorial-exit').click();
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Revenue Model']);
    await page.evaluate(() => fm.command('openHelp'));
    await page.locator('#helpPanel .help-show-welcome').click();
    await w.locator('.welcome-sample').click();
    await expect(w).toHaveCount(0);
    expect(await page.evaluate(() => fm.canvases().map(c => c.name))).toEqual(['Revenue Model']);
    await page.evaluate(() => fm.command('openHelp'));
    await page.locator('#helpPanel .help-show-welcome').click();
    await w.locator('.welcome-help').click();
    await expect(page.locator('#helpPanel')).toBeVisible();
    await page.locator('#helpPanel .help-show-welcome').click();
    await w.locator('.welcome-blank').click();
    await expect.poll(() => page.evaluate(() => fm.nodes().length)).toBe(0);
  });
});
