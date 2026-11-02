// 82. fmGraph's Play (the owner's idea of 26 October 2026; 05m-play.js): the model swings between
// two ends — a scenario, the model's own numbers or the sliders now — and back, like a pendulum,
// until stopped.
// - The motion: every number moves in a straight line between the ends, at positions spaced by
//   a cosine (slow at the ends), 2 s a swing, 0.6 s still at each end; the sliders show where
//   it is, what they are set to unchanged. Timed by the page's own clock (performance.now and
//   fmGraph.playing().elapsed, sampled every frame inside the page), never by a wall-clock
//   limit around Playwright steps.
// - A %-change slider, a slider over some periods and an input with no slider all move.
// - Only ■ Stop, Esc and a slider moved stop it (the owner's request of 27 October 2026), and
//   leave everything as it was: nothing saved, no undo step, A kept. A press, a key, a scroll
//   and another board leave it playing; the board then shown follows the play.
// - Each position worked out once; a slow model works them all out ahead.
// - Reduced motion: no motion, ⇄ steps between the ends. A phone: the dock follows; a touch and a
//   swipe leave it playing, ■ Stop stops it.
// - window.fmGraph: play, stopPlay, stepPlay, playing.
const fs = require('fs');
const path = require('path');
const { test, expect, openApp, ROOT } = require('./helpers/apps');
const { largeModel } = require('../tools/bench-calc.js');

async function openSample(page){
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
const g = (page, fn, arg) => page.evaluate(fn, arg);
const profit = (page) => g(page, () => fmGraph.value('Profit', 1));
// Two scenarios on the sample: Low (Price 8) and High (Price 14); the sliders back after.
async function lowAndHigh(page){
  const price = await g(page, () => fmGraph.board().sliders[0].id);
  await g(page, (i) => fmGraph.setSlider(i, 8), price);
  const low = await profit(page);
  await g(page, () => fmGraph.saveScenario('Low'));
  await g(page, (i) => fmGraph.setSlider(i, 14), price);
  const high = await profit(page);
  await g(page, () => fmGraph.saveScenario('High'));
  await g(page, () => fmGraph.resetAll());
  return { price, low, high };
}
// The pendulum, as the app spaces it: position i of n, f of the way.
const fraction = (i, n) => i === 0 ? 0 : i === n ? 1 : (1 - Math.cos(Math.PI * i / n)) / 2;
// The position shown at t ms on the play's clock.
function indexAt(t, n, swing, pause){
  t = t % (2 * (pause + swing));
  if(t < pause) return 0;
  if(t < pause + swing) return Math.min(n, Math.round((t - pause) / swing * n));
  if(t < 2 * pause + swing) return n;
  return Math.max(0, n - Math.round((t - 2 * pause - swing) / swing * n));
}
// Samples fmGraph.playing() and what the page shows every frame until `until` ms of play.
function sample(page, until){
  return g(page, (until) => new Promise(done => {
    const out = [];
    const tick = () => {
      const p = fmGraph.playing();
      if(!p) return done({ out, stopped: true });
      if(p.elapsed !== null) out.push({ t: p.elapsed, index: p.index, n: p.positions - 1, swing: p.swing, pause: p.pause,
        box: Number(document.querySelector('.slider-widget .slider-value').value), profit: fmGraph.value('Profit', 1),
        set: fmGraph.board().sliders.map(s => s.value), runs: p.runs });
      if(p.elapsed !== null && p.elapsed > until) return done({ out });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), until);
}

test('Play swings between two scenarios like a pendulum, timed by the page\'s own clock', async ({ page, pageErrors }) => {
  await openSample(page);
  const { low, high } = await lowAndHigh(page);
  // The row offers the ends, the first two scenarios chosen.
  await expect(page.locator('#playFrom option')).toHaveText(['The model\'s own numbers', 'The sliders now', 'Low', 'High']);
  await expect(page.locator('#playFrom')).toHaveValue('sc:Low');
  await expect(page.locator('#playTo')).toHaveValue('sc:High');
  await page.click('#btnPlay');
  await expect(page.locator('#playBar')).toBeVisible();
  await expect(page.locator('#playBar .play-words')).toHaveText('Playing “Low” ⇄ “High”');
  // Two whole swings there and back (2 × 2 × (2 s + 0.6 s)).
  const { out, stopped } = await sample(page, 2 * 2 * 2600 + 100);
  expect(stopped).toBeUndefined();
  expect(out.length).toBeGreaterThan(20);
  const { n, swing, pause } = out[0];
  expect([n, swing, pause]).toEqual([60, 2000, 600]);
  // Shown to the slider's step's digits and one more (its step 0.25: two decimals).
  const shown = (i) => i === 0 ? 8 : i === n ? 14 : Number((8 * (1 - fraction(i, n)) + 14 * fraction(i, n)).toFixed(2));
  out.forEach((s, k) => {
    // Every frame: the slider shows the position's number, the bars its numbers, the slider's
    // own setting unchanged.
    expect(s.box).toBeCloseTo(shown(s.index), 6);
    expect(s.set).toEqual([null, null]);
    expect(s.profit).toBeGreaterThanOrEqual(Math.min(low, high));
    expect(s.profit).toBeLessThanOrEqual(Math.max(low, high));
    if(s.index === 0) expect(s.profit).toBe(low);
    if(s.index === n) expect(s.profit).toBe(high);
    // The position is the one the page's clock gives: between where it was a frame before
    // (the play redraws on its own frame) and now.
    const from = k ? out[k - 1].t - 20 : 0, can = new Set();
    for(let t = Math.max(0, from); t <= s.t; t += 2) can.add(indexAt(t, n, swing, pause));
    can.add(indexAt(s.t, n, swing, pause));
    expect([...can]).toContain(s.index);
  });
  // Both ends reached and held through each pause; it rises on the way up and falls back.
  const phase = (s) => s.t % (2 * (pause + swing));
  expect(out.some(s => s.index === 0 && phase(s) > 100 && phase(s) < pause)).toBe(true);
  expect(out.some(s => s.index === n && phase(s) > pause + swing + 100 && phase(s) < 2 * pause + swing)).toBe(true);
  for(let k = 1; k < out.length; k++){
    const a = out[k - 1], b = out[k];
    if(Math.floor(a.t / 2600) !== Math.floor(b.t / 2600)) continue; // the same swing
    if(Math.floor(b.t / 2600) % 2 === 0) expect(b.box).toBeGreaterThanOrEqual(a.box); else expect(b.box).toBeLessThanOrEqual(a.box);
  }
  // Slow at the ends, quickest in the middle.
  expect(shown(1) - shown(0)).toBeLessThan(shown(n / 2 + 1) - shown(n / 2));
  // ■ Stop: everything as it was.
  await page.click('#btnPlayStop');
  expect(await g(page, () => fmGraph.playing())).toBeNull();
  await expect(page.locator('#playBar')).toBeHidden();
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue('10');
  await expect(page.locator('.slider-widget.playing')).toHaveCount(0);
  expect(await profit(page)).toBe(await g(page, () => fmGraph.modelValue('Profit', 1)));
  expect(pageErrors).toEqual([]);
});

test('a change by %, a slider over some periods and an input with no slider all move', async ({ page, pageErrors }) => {
  await openSample(page);
  const [, volume] = await g(page, () => fmGraph.board().sliders.map(s => s.id));
  const cost = await g(page, () => fmGraph.addSlider('Unit cost', { periods: 2, mode: 'set', min: 0, max: 20, step: 0.5 }));
  await g(page, ([v, c]) => { fmGraph.setSlider(v, 50); fmGraph.setSlider(c, 9); }, [volume, cost]);
  await g(page, () => fmGraph.saveScenario('Mixed'));
  await g(page, (c) => fmGraph.remove(c), cost); // no Unit cost slider on the board now
  await g(page, () => fmGraph.resetAll());
  const own = await g(page, () => ({ v1: fmGraph.modelValue('Volume', 1), c1: fmGraph.modelValue('Unit cost', 1), c2: fmGraph.modelValue('Unit cost', 2) }));
  // One scenario: the row plays from the model's own numbers to it.
  await expect(page.locator('#playFrom')).toHaveValue('model');
  await expect(page.locator('#playTo')).toHaveValue('sc:Mixed');
  expect(await g(page, () => fmGraph.play({ from: 'model', to: 'Mixed', seconds: 1, pause: 1 }))).toBe('Playing the model\'s own numbers ⇄ “Mixed”');
  // Sampled on the page every frame through one swing there and back.
  const seen = await g(page, () => new Promise(done => {
    const out = [];
    const tick = () => {
      const p = fmGraph.playing();
      if(!p) return done(out);
      if(p.index >= 0) out.push({ i: p.index, n: p.positions - 1, v1: fmGraph.value('Volume', 1), c1: fmGraph.value('Unit cost', 1), c2: fmGraph.value('Unit cost', 2),
        box: Number(document.querySelectorAll('.slider-widget .slider-value')[1].value) });
      if(p.elapsed !== null && p.elapsed > 4100) return done(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const n = seen[0].n;
  const at = (s) => fraction(s.i, n);
  seen.forEach(s => {
    expect(s.v1).toBeCloseTo(own.v1 * (1 + 0.5 * at(s)), 6);   // Volume +50% at the end
    expect(s.box).toBeCloseTo(Number((50 * at(s)).toFixed(1)), 6); // its slider shows the %
    expect(s.c1).toBe(own.c1);                                    // Unit cost in period 1 stays
    expect(s.c2).toBeCloseTo(own.c2 * (1 - at(s)) + 9 * at(s), 6); // in period 2 it moves to 9
  });
  expect(seen.some(s => s.i === n && s.c2 === 9 && s.v1 === own.v1 * 1.5)).toBe(true);
  expect(seen.some(s => s.i === 0 && s.c2 === own.c2 && s.v1 === own.v1)).toBe(true);
  expect(seen.some(s => s.i > 0 && s.i < n)).toBe(true);
  await expect(page.locator('#playAt')).not.toHaveText('');
  expect(await g(page, () => fmGraph.stopPlay())).toBe(true);
  expect(await g(page, () => fmGraph.stopPlay())).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('stopping by Stop, Esc or a slider moved leaves everything as it was', async ({ page, pageErrors }) => {
  await openSample(page);
  const { price } = await lowAndHigh(page);
  await g(page, (i) => fmGraph.setSlider(i, 9), price);
  await g(page, () => fmGraph.pinA());
  const before = await g(page, () => JSON.stringify({ board: fmGraph.board(), scenarios: fmGraph.scenarios(), comparing: fmGraph.comparing(), boards: fmGraph.boards() }));
  const strip = await page.locator('#compareBar').textContent();
  const play = async () => {
    await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index >= 0);
    await expect(page.locator('#compareBar')).toHaveText(strip); // A stays A
  };
  const stopped = async () => {
    await page.waitForFunction(() => fmGraph.playing() === null);
    await expect(page.locator('#playBar')).toBeHidden();
  };
  await play(); await page.click('#btnPlayStop'); await stopped();
  await play(); await page.keyboard.press('Escape'); await stopped();
  expect(await g(page, () => JSON.stringify({ board: fmGraph.board(), scenarios: fmGraph.scenarios(), comparing: fmGraph.comparing(), boards: fmGraph.boards() }))).toBe(before);
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue('9');
  // No undo step: the last one is still saving High.
  expect(await g(page, () => fmGraph.undo())).toBe(true);
  expect(await g(page, () => fmGraph.scenarios().map(s => s.name))).toEqual(['Low']);
  expect(await g(page, () => fmGraph.redo())).toBe(true);
  const priceNow = await g(page, () => fmGraph.board().sliders[0].id); // undo gives the board new ids
  // A slider moved stops it: by the API, and dragged by the mouse (a deliberate change).
  await play(); await g(page, (i) => fmGraph.setSlider(i, 12), priceNow); await stopped();
  expect(await g(page, () => fmGraph.board().sliders[0].value)).toBe(12);
  await play();
  const range = page.locator('.slider-widget input[type="range"]').first();
  const box = await range.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await stopped();
  const dragged = await g(page, () => fmGraph.board().sliders[0].value);
  expect(dragged).not.toBe(12);
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue(String(dragged));
  expect(pageErrors).toEqual([]);
});

test('a press, a key or a scroll leaves it playing', async ({ page, pageErrors }) => {
  await openSample(page);
  await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.3, pause: 0.8 }));
  // Still playing, and still moving: it reaches both ends again after each thing done.
  const goesOn = async () => {
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === fmGraph.playing().positions - 1);
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === 0);
    await expect(page.locator('#playBar')).toBeVisible();
  };
  await goesOn();
  await page.locator('.board-col .col-head').first().click(); await goesOn();
  await page.locator('.bar-widget svg').first().click(); await goesOn();
  await page.keyboard.press('Shift'); await goesOn();
  await page.keyboard.press('a'); await goesOn();
  await page.mouse.move(300, 300); await page.mouse.wheel(0, 400); await goesOn();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => fmGraph.playing() === null);
  expect(pageErrors).toEqual([]);
});

test('another board leaves it playing, and the board shown follows the play', async ({ page, pageErrors }) => {
  await openSample(page);
  await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.3, pause: 0.8 }));
  const goesOn = async () => {
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === fmGraph.playing().positions - 1);
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === 0);
    await expect(page.locator('#playBar')).toBeVisible();
  };
  // Another board: still playing; back on the first, its slider shows where the play is.
  await g(page, () => fmGraph.addBoard('Second'));
  expect(await g(page, () => fmGraph.boards().find(b => b.shown).name)).toBe('Second');
  await goesOn();
  await page.locator('.board-tab').first().click();
  expect(await g(page, () => fmGraph.boards()[0].shown)).toBe(true);
  await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === fmGraph.playing().positions - 1);
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue('14');
  await expect(page.locator('.slider-widget').first()).toHaveClass(/playing/);
  await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === 0);
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue('8');
  expect(await g(page, () => fmGraph.board().sliders[0].value)).toBe(null); // what it is set to, unchanged
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => fmGraph.playing() === null);
  expect(pageErrors).toEqual([]);
});

test('each position is worked out once; the Tornado holds still', async ({ page, pageErrors }) => {
  await openSample(page);
  await lowAndHigh(page);
  const tornado = await g(page, () => fmGraph.addChart({ layout: 'tornado', title: 'T', output: 'Profit', period: 1 }));
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.5, pause: 0.1 }));
  // The Tornado is drawn the same at both ends: held at Low.
  const drawn = (i) => g(page, ([id, i]) => new Promise(done => {
    const tick = () => { const p = fmGraph.playing(); if(p.index === (i < 0 ? p.positions - 1 : i)) done(document.querySelector('.chart-widget[data-id="' + id + '"] .bar-chart-host').innerHTML); else requestAnimationFrame(tick); };
    tick();
  }), [tornado, i]);
  const atLow = await drawn(0), atHigh = await drawn(-1);
  expect(atHigh).toBe(atLow);
  // Three swings there and back, on the page's clock.
  await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().elapsed > 3 * 1200);
  const p = await g(page, () => fmGraph.playing());
  expect(p.runs).toBeLessThanOrEqual(p.positions);           // never a position worked out twice
  expect(p.worked).toBeGreaterThan(2);
  await expect(page.locator('.chart-widget[data-id="' + tornado + '"]')).toHaveClass(/play-held/);
  await g(page, () => fmGraph.stopPlay());
  await expect(page.locator('.chart-widget[data-id="' + tornado + '"]')).not.toHaveClass(/play-held/);
  expect(pageErrors).toEqual([]);
});

test('a slow model: the play\'s positions are worked out ahead, then played', async ({ page, pageErrors }) => {
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await g(page, (m) => fmGraph.load(m, 'Large'), largeModel());
  const ms = await g(page, () => fmGraph.calcTime());
  test.skip(ms < 25, 'this machine works the large model out in ' + ms.toFixed(1) + ' ms: nothing to work out ahead');
  const input = await g(page, () => fmGraph.rectangles().find(r => r.input).name);
  const id = await g(page, (r) => fmGraph.addSlider(r, { mode: 'set', min: -1e6, max: 1e6, step: 1 }), input);
  await g(page, (i) => fmGraph.setSlider(i, 123457), id);
  await g(page, () => fmGraph.play({ from: 'model', to: 'sliders' }));
  await expect(page.locator('#calcNote')).toHaveText('Working out the play…');
  await expect(page.locator('#calcNote')).toHaveText('', { timeout: 120000 });
  const p = await g(page, () => fmGraph.playing());
  expect(p.ready).toBe(true);
  expect(p.worked).toBe(p.positions);
  if(ms * 61 > 3000) expect(p.positions).toBeLessThan(61); else expect(p.positions).toBe(61);
  expect(p.positions).toBeGreaterThanOrEqual(13);
  // Playing then works nothing more out.
  await page.waitForFunction((t) => fmGraph.playing() && fmGraph.playing().elapsed > t, 2 * (p.swing + p.pause));
  expect(await g(page, () => fmGraph.playing().runs)).toBe(p.runs);
  await g(page, () => fmGraph.stopPlay());
  expect(pageErrors).toEqual([]);
});

test('reduced motion: no motion; ⇄ steps between the ends', async ({ page, pageErrors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSample(page);
  const { low, high } = await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
  await expect(page.locator('#playBar .play-words')).toHaveText('Showing “High”; the outlines show “Low”');
  // A second on the page's clock: it stays at "to", and nothing animates.
  const still = await g(page, () => new Promise(done => {
    const t0 = performance.now(), seen = new Set();
    const tick = () => {
      seen.add(fmGraph.playing().index);
      if(performance.now() - t0 < 1000) requestAnimationFrame(tick); else done({ seen: [...seen], animations: document.getAnimations().length, p: fmGraph.playing() });
    };
    requestAnimationFrame(tick);
  }));
  expect(still.seen).toEqual([still.p.positions - 1]);
  expect(still.animations).toBe(0);
  expect(still.p.still).toBe(true);
  expect(still.p.elapsed).toBeNull();
  expect(await profit(page)).toBe(high);
  await expect(page.locator('.slider-widget .slider-value').first()).toHaveValue('14');
  await page.click('#btnPlayStep');
  expect(await g(page, () => fmGraph.playing().index)).toBe(0);
  expect(await profit(page)).toBe(low);
  await expect(page.locator('#playBar .play-words')).toHaveText('Showing “Low”; the outlines show “Low”');
  expect(await g(page, () => fmGraph.stepPlay())).toBe(true);
  expect(await profit(page)).toBe(high);
  await page.keyboard.press('Escape');
  expect(await g(page, () => fmGraph.playing())).toBeNull();
  expect(pageErrors).toEqual([]);
});

// The owner's request of 2 November 2026: Remote Desktop asks for reduced motion, so fmGraph has
// its own choice to animate Play anyway — ▶ Animate on the strip, ⇄ Still back, kept in the browser.
test('reduced motion: ▶ Animate plays it moving, remembered after a reload; ⇄ Still goes back', async ({ page, pageErrors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSample(page);
  await lowAndHigh(page);
  expect(await g(page, () => fmGraph.playMotion())).toEqual({ animateAnyway: false, reducedMotion: true, still: true });
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.5, pause: 0.1 }));
  expect(await g(page, () => fmGraph.playing().still)).toBe(true);
  await expect(page.locator('#btnPlayMotion')).toHaveText('▶ Animate');
  await page.click('#btnPlayMotion');
  // Playing again, moving: the positions advance on the page's clock.
  const moving = async () => {
    const seen = await g(page, () => new Promise(done => {
      const t0 = performance.now(), seen = new Set();
      const tick = () => { const p = fmGraph.playing(); seen.add(p.index); if(performance.now() - t0 < 1200) requestAnimationFrame(tick); else done({ seen: [...seen], p }); };
      requestAnimationFrame(tick);
    }));
    expect(seen.p.still).toBe(false);
    expect(seen.seen.length).toBeGreaterThan(5);
    expect(seen.seen.some(i => i > 0 && i < seen.p.positions - 1)).toBe(true);
  };
  await moving();
  await expect(page.locator('#playBar .play-words')).toHaveText('Playing “Low” ⇄ “High”');
  await expect(page.locator('#btnPlayStep')).toHaveCount(0);
  await expect(page.locator('#btnPlayMotion')).toHaveText('⇄ Still');
  await g(page, () => fmGraph.stopPlay());
  // Kept in this browser: after a reload Play moves at once.
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph && fmGraph.playMotion().animateAnyway === true);
  await page.click('#btnSample');
  await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.5, pause: 0.1 }));
  await moving();
  // The full screen's strip offers the same choice: ⇄ Still there stops the motion.
  await page.locator('.bar-widget .widget-full').first().click();
  await expect(page.locator('#showMotion')).toHaveText('⇄ Still');
  await page.click('#showMotion');
  expect(await g(page, () => fmGraph.playing().still)).toBe(true);
  await expect(page.locator('#showMotion')).toHaveText('▶ Animate');
  await page.click('#showClose');
  await expect(page.locator('#btnPlayMotion')).toHaveText('▶ Animate');
  await expect(page.locator('#btnPlayStep')).toHaveCount(1);
  // Off again, and remembered so.
  await page.reload();
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
  expect(await g(page, () => fmGraph.playing().still)).toBe(true);
  expect(await g(page, () => fmGraph.setPlayMotion(true))).toBe(true);
  expect(await g(page, () => fmGraph.playing().still)).toBe(false);
  expect(await g(page, () => fmGraph.setPlayMotion(false))).toBe(false);
  expect(await g(page, () => fmGraph.playing().still)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('without reduced motion: no ▶ Animate, Play moves whatever the choice', async ({ page, pageErrors }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openSample(page);
  await lowAndHigh(page);
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
  expect(await g(page, () => fmGraph.playing().still)).toBe(false);
  await expect(page.locator('#btnPlayMotion')).toHaveCount(0);
  await page.locator('.bar-widget .widget-full').first().click();
  await expect(page.locator('#showMotion')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('window.fmGraph: play refuses ends that give the same numbers, or an unknown scenario', async ({ page, pageErrors }) => {
  await openSample(page);
  // No scenarios: the model's own numbers to the sliders now.
  await expect(page.locator('#playFrom')).toHaveValue('model');
  await expect(page.locator('#playTo')).toHaveValue('sliders');
  await page.click('#btnPlay');
  await expect(page.locator('.note[data-slot="play"]')).toContainText('nothing to play');
  expect(await g(page, () => fmGraph.playing())).toBeNull();
  const err = (spec) => g(page, (spec) => { try{ fmGraph.play(spec); return null; }catch(e){ return e.message; } }, spec);
  expect(await err({ from: 'model', to: 'sliders' })).toContain('nothing to play');
  expect(await err({ from: 'model', to: 'Nope' })).toBe('There is no scenario "Nope".');
  await lowAndHigh(page);
  expect(await err({ from: 'Low', to: 'low' })).toContain('nothing to play');
  expect(await g(page, () => fmGraph.play({ from: 'High', to: 'model' }))).toBe('Playing “High” ⇄ the model\'s own numbers');
  expect(await g(page, () => fmGraph.playing().to)).toBe('the model\'s own numbers');
  expect(await g(page, () => fmGraph.stepPlay())).toBe(false); // only without motion
  await g(page, () => fmGraph.stopPlay());
  expect(pageErrors).toEqual([]);
});

test('on a phone: the dock follows the play; a touch and a swipe leave it playing, ■ Stop stops it', async ({ browser }) => {
  const URL = 'http://local.test/fmGraph.html';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.route('**/*', route => route.request().url() === URL
    ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'apps', 'fmGraph.html')) })
    : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try{
    await page.goto(URL);
    await page.waitForFunction(() => !!window.fmGraph);
    await page.click('#btnSample');
    await expect(page.locator('#dockCards .dock-card')).toHaveCount(2);
    await lowAndHigh(page);
    await g(page, () => fmGraph.play({ from: 'Low', to: 'High', seconds: 0.3, pause: 1.5 }));
    const value = page.locator('#dockCards .dock-card').first().locator('.ps-value');
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === fmGraph.playing().positions - 1);
    await expect(value).toHaveText('14');
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === 0);
    await expect(value).toHaveText('8');
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('.bar-widget').first().boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 20, y: box.y + 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === fmGraph.playing().positions - 1);
    await expect(value).toHaveText('14');
    // A finger scrolling the page (as on an iPad) leaves it playing too.
    const top = await g(page, () => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 400 }] });
    for(const y of [370, 330, 290, 250]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
    await page.waitForTimeout(300); // the finger rests before it lifts, so the page does not glide on
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 250 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => fmGraph.playing() && fmGraph.playing().index === 0);
    await expect(value).toHaveText('8');
    expect(await g(page, () => scrollY)).toBeGreaterThan(top); // it did scroll
    // A tap on ■ Stop stops it.
    const stop = await page.locator('#btnPlayStop').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stop.x + stop.width / 2, y: stop.y + stop.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => fmGraph.playing() === null);
    await expect(value).toHaveText('10');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
