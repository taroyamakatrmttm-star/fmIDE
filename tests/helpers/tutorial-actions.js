// What a person does at each step of each tutorial (src/help/fmide-tutorials.js), by tutorial and
// step id: real clicks, typing and drags, following each step's text. Shared by test group 33
// (tests/33-tutorials.spec.js), which plays every tutorial as a test, and the recorder
// (tools/record-tutorials.js, step 10 H4b), which plays them for the videos.
//
//   tutorialActions(pace) → { actions, command, addRect, next, finish, trip }
//     actions — { 'first-model': { intro: async (page) => …, … }, … }
//     trip    — the To Excel tutorial's ExcelExporter window (trip.popup), once opened
//
// pace says how a person's hands move: testPace does everything at once (the tests), and
// recordPace (tools/record-tutorials.js) moves the pointer across the screen, types a key at a
// time and pauses, so a viewer can follow. Both have the same methods:
//   click(page, locator), type(page, text), fill(page, locator, text), press(page, key),
//   drag(page, fromLocator, toLocator, button), attach(page, locator) — before a file is handed
//   to a file box, which a video can't show being picked
// Each call to tutorialActions has its own state (the To Excel tutorial's window).
const { expect } = require('@playwright/test');
const F = require('./fmide');

const centre = async (locator) => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

// The tests' pace: at once, as before.
const testPace = {
  click: (page, locator) => locator.click(),
  type: (page, text) => page.keyboard.type(text),
  fill: (page, locator, text) => locator.fill(text),
  press: (page, key) => page.keyboard.press(key),
  async drag(page, from, to, button){
    const a = await centre(from), b = await centre(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up({ button });
  },
  attach: async () => {},
};

function tutorialActions(P){
  P = P || testPace;
  const card = (page) => page.locator('#tutorialCard');
  const nodeByName = (page, name) => page.evaluate((name) => {
    const n = fm.nodes().find(n => n.type === 'value' && n.text.split('\n')[0].trim().toLowerCase() === name.toLowerCase());
    return n ? n.id : null;
  }, name);
  const nodeOfType = (page, type, text) => page.evaluate(([type, text]) => {
    const n = fm.nodes().find(n => n.type === type && (text === undefined || n.text === text));
    return n ? n.id : null;
  }, [type, text]);
  const nodeOf = (page, type) => nodeOfType(page, type);
  const nodeEl = (page, id) => page.locator(`.node[data-id="${id}"]`);
  const dialog = (page) => F.topDialog(page);
  // A ribbon command, going to its tab first when it is on another one (as the pointer shows).
  async function command(page, cmd){
    const b = page.locator(`#ribbon [data-tip-cmd="${cmd}"]:visible`).first();
    if(!await b.count()){
      const label = await page.evaluate((cmd) => __fmIDE.getRibbonConfig().tabs.find(t => t.groups.some(g => g.items.some(i => i.cmd === cmd))).label, cmd);
      await P.click(page, page.locator('.rb-tab', { hasText: new RegExp('^' + label + '$') }));
    }
    await P.click(page, page.locator(`#ribbon [data-tip-cmd="${cmd}"]:visible`).first());
  }
  async function addRect(page, lines){
    await command(page, 'addRect');
    await expect(page.locator('#canvas textarea')).toBeFocused();
    for(let i = 0; i < lines.length; i++){
      if(i) await P.press(page, 'Shift+Enter');
      await P.type(page, lines[i]);
    }
    await P.press(page, 'Enter');
  }
  async function addOperator(page, sym){
    await command(page, 'addOperator');
    await P.click(page, page.locator('.op-picker button').filter({ hasText: new RegExp('^' + sym.replace(/[+*]/g, '\\$&') + '$') }).first());
  }
  // An arrow drawn with the right button, from anywhere on one box to another.
  const arrowByNames = (from, to) => async (page) => {
    const id = async (ref) => typeof ref === 'string' ? nodeByName(page, ref)
      : ref.op ? nodeOfType(page, 'operator', ref.op) : nodeOfType(page, 'periodShift');
    await P.drag(page, nodeEl(page, await id(from)), nodeEl(page, await id(to)), 'right');
  };
  async function setRole(page, name, role){
    const id = await nodeByName(page, name);
    await P.click(page, nodeEl(page, id));
    await P.click(page, nodeEl(page, id).locator('.io-btn'));
    await P.click(page, page.locator('.op-picker button', { hasText: new RegExp('^' + role + '$') }));
  }
  const next = (page) => P.click(page, card(page).locator('.tutorial-next'));
  const finish = (page) => P.click(page, card(page).locator('.tutorial-finish'));
  const evaluate = (page) => command(page, 'evaluate');
  // What the To Excel tutorial downloads and opens, shared between its steps.
  const trip = {};

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
        await command(page, 'managePeriods');
        const box = dialog(page);
        await P.fill(page, box.locator('input[type=number]'), '5');
        await P.click(page, box.locator('button', { hasText: /^Set$/ }));
        await P.click(page, box.locator('button', { hasText: /^Done$/ }));
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
      'shift': (page) => command(page, 'addPeriodShift'),
      'shift-wire': async (page) => {
        await arrowByNames('Closing', { shift: -1 })(page);
        await arrowByNames({ shift: -1 }, 'Opening')(page);
      },
      'own-number': async (page) => {
        const id = await nodeByName(page, 'Opening');
        await P.click(page, nodeEl(page, id));
        await P.click(page, nodeEl(page, id).locator('.period-btn'));
        const box = dialog(page);
        await P.click(page, box.locator('button', { hasText: 'First period only' }));
        await P.click(page, box.locator('button', { hasText: /^Save$/ }));
      },
      'later': async (page) => {
        await evaluate(page);
        await command(page, 'nextPeriod');
        await command(page, 'nextPeriod');
      },
      'done': finish,
    },
    'blocks': {
      'intro': next,
      'rename': async (page) => {
        await command(page, 'renameCanvas');
        const input = page.locator('#canvasTabs input');
        await P.fill(page, input, 'Tax');
        await P.press(page, 'Enter');
      },
      'profit': (page) => addRect(page, ['Profit', '100']),
      'rate': (page) => addRect(page, ['Tax rate', '0.3']),
      'tax': (page) => addRect(page, ['Tax']),
      'multiply': (page) => addOperator(page, '×'),
      'wire': async (page) => {
        await arrowByNames('Profit', { op: '×' })(page);
        await arrowByNames('Tax rate', { op: '×' })(page);
        await arrowByNames({ op: '×' }, 'Tax')(page);
      },
      'roles': async (page) => { await setRole(page, 'Profit', 'Input'); await setRole(page, 'Tax', 'Output'); },
      'company': (page) => command(page, 'newCanvas'),
      'add-block': async (page) => {
        await command(page, 'addBlock');
        await P.click(page, dialog(page).locator('.picker-row', { hasText: 'Tax' }).first());
      },
      'feed': async (page) => {
        await addRect(page, ['Company profit', '1000']);
        const inst = await nodeOf(page, 'blockInstance');
        await P.drag(page, nodeEl(page, await nodeByName(page, 'Company profit')), nodeEl(page, inst).locator('.io-port[data-port-dir="in"]').first(), 'right');
      },
      'result': async (page) => {
        await addRect(page, ['Company tax']);
        const inst = await nodeOf(page, 'blockInstance');
        // From the output dot, with the left button.
        await P.drag(page, nodeEl(page, inst).locator('.io-port[data-port-dir="out"]').first(), nodeEl(page, await nodeByName(page, 'Company tax')), 'left');
      },
      'evaluate': evaluate,
      'done': finish,
    },
    'templates': {
      'intro': next,
      'save': async (page) => {
        await command(page, 'openTemplates');
        await P.click(page, dialog(page).locator('button', { hasText: '+ Save Canvas as Template' }));
        await P.click(page, dialog(page).locator('button', { hasText: /^Save Template$/ }));
      },
      'add': (page) => P.click(page, dialog(page).locator('button', { hasText: /^Add to new canvas$/ })),
      'done': finish,
    },
    'functions': {
      'intro': next,
      'write': async (page) => {
        await command(page, 'openFunctions');
        await P.click(page, dialog(page).locator('button', { hasText: '+ New Function…' }));
        await P.fill(page, dialog(page).locator('textarea').first(), 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue');
        await P.click(page, dialog(page).locator('.fn-editor-save'));
        await P.click(page, dialog(page).locator('button', { hasText: /^Close$/ }));
      },
      'insert': async (page) => {
        await command(page, 'insertFunction');
        await P.click(page, dialog(page).locator('.function-picker-ok'));
      },
      'wire': async (page) => {
        const fn = await nodeOf(page, 'function');
        await P.drag(page, nodeEl(page, await nodeByName(page, 'Revenue')), nodeEl(page, fn).locator('.io-port[data-port-dir="in"][data-port-index="0"]'), 'right');
        await P.drag(page, nodeEl(page, await nodeByName(page, 'Cost')), nodeEl(page, fn).locator('.io-port[data-port-dir="in"][data-port-index="1"]'), 'right');
      },
      'result': async (page) => {
        await addRect(page, ['Margin %']);
        const fn = await nodeOf(page, 'function');
        await P.drag(page, nodeEl(page, fn).locator('.fn-out-port'), nodeEl(page, await nodeByName(page, 'Margin %')), 'left');
      },
      'evaluate': evaluate,
      'done': finish,
    },
    'to-excel': {
      'intro': next,
      'open': async (page) => {
        const [popup] = await Promise.all([page.waitForEvent('popup'), command(page, 'openExcelExporter')]);
        await popup.waitForLoadState();
        trip.popup = popup;
      },
      // What the card says: the model fmIDE sent is already there; then Generate.
      'load': async (page) => {
        const popup = trip.popup;
        await expect(popup.locator('#afterLoad')).toBeVisible();
        await expect(popup.locator('#modelName')).toHaveText('Practice — From fmIDE to Excel');
        await next(page);
      },
      'generate': async (page) => {
        const popup = trip.popup;
        const [dl] = await Promise.all([popup.waitForEvent('download'), P.click(popup, popup.locator('#btnGenerate'))]);
        const fs = require('fs');
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
        const sheets = Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
        const xml = (await Promise.all(sheets.map(f => zip.file(f).async('string')))).join('');
        expect(xml).toMatch(/<f>[^<]*\*[^<]*<\/f>/);                 // Revenue is a live formula, a product
        await next(page);
      },
      'done': finish,
    },
  };
  return { actions: ACTIONS, command, addRect, next, finish, trip };
}

module.exports = { tutorialActions, testPace };
