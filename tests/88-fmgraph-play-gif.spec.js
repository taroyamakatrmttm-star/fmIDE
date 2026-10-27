// 88. A GIF of fmGraph's Play (the owner's idea of 27 October 2026; 05o-play-gif.js): 🎞 GIF in
// the full screen's strip makes an animated GIF of what it shows, 🎞 on a bar's or chart's header
// one of that one, playing between the ends chosen under Scenarios.
// - The bytes are a GIF (GIF89a) that loops for ever, GIF_W 720 pixels wide; its frames are one
//   swing there and back (31 positions there, 29 back), the ends held 0.6 s, the others 70 ms.
// - The first frame and the other end differ where the bars moved; the title above them doesn't.
// - Read back by Chromium's own decoder (ImageDecoder, on a secure page answered here, as group
//   87 does), not by anything of the app's.
// - Nothing is made when the ends give the same numbers ("Nothing to play"), over the cap it
//   stops and says so, Cancel stops it; the board is unchanged (no undo step, nothing saved).
// - Delivered as a download fmGraph-<name>.gif where the browser can't share files.
const { test, expect, openApp } = require('./helpers/apps');

const g = (page, fn, arg) => page.evaluate(fn, arg);
const SWING = 30;                       // frames a swing: 2 s at 15 a second
const FRAMES = 2 * SWING;               // there (0 … 30) and back (29 … 1)

async function openSample(page){
  // No share sheet here: the GIF downloads, as on a browser that can't share files.
  await page.addInitScript(() => { try{ delete Navigator.prototype.share; delete Navigator.prototype.canShare; }catch(e){ /* none */ } });
  await openApp(page, 'fmGraph');
  await page.waitForFunction(() => !!window.fmGraph);
  await page.click('#btnSample');
  await expect(page.locator('.chart-widget')).toHaveCount(2);
}
// Two scenarios on the sample, Low (Price 8) and High (Price 14): Play's ends by default.
async function lowAndHigh(page){
  const price = await g(page, () => fmGraph.board().sliders[0].id);
  await g(page, (i) => fmGraph.setSlider(i, 8), price);
  await g(page, () => fmGraph.saveScenario('Low'));
  await g(page, (i) => fmGraph.setSlider(i, 14), price);
  await g(page, () => fmGraph.saveScenario('High'));
  await g(page, () => fmGraph.resetAll());
}
const boardText = (page) => g(page, () => JSON.stringify(fmGraph.board()));

// The GIF as Chromium reads it: the frames' count, loop, durations, size, and how many pixels
// differ between frame 0 and frame `other` (all, and in the top `top` rows).
async function readGif(page, bytes, other, top){
  const dec = await page.context().newPage();
  await dec.route('https://gif.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await dec.goto('https://gif.test/');
  const out = await dec.evaluate(async ({ list, other, top }) => {
    if(typeof ImageDecoder === 'undefined') return null;
    const d = new ImageDecoder({ data: new Uint8Array(list), type: 'image/gif' });
    await d.tracks.ready;
    const n = d.tracks.selectedTrack.frameCount;
    const durations = [], pixels = [];
    let w = 0, h = 0;
    for(let k = 0; k < n; k++){
      const { image } = await d.decode({ frameIndex: k });
      durations.push(image.duration / 1000);
      w = image.displayWidth; h = image.displayHeight;
      if(k === 0 || k === other){
        const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
        x.drawImage(image, 0, 0);
        pixels.push(x.getImageData(0, 0, w, h).data);
      }
      image.close();
    }
    let differ = 0, differTop = 0;
    const [a, b] = pixels;
    for(let i = 0; i < a.length; i += 4){
      if(a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]){ differ++; if(i / 4 < top * w) differTop++; }
    }
    return { n, repetition: d.tracks.selectedTrack.repetitionCount, durations, w, h, differ, differTop };
  }, { list: Array.from(bytes), other, top });
  await dec.close();
  return out;
}
function checkGif(r){
  expect(r, 'Chromium has ImageDecoder').not.toBeNull();
  expect(r.n).toBe(FRAMES);
  expect(r.repetition).toBe(Infinity);
  expect(r.w).toBe(720);
  expect(r.h).toBeGreaterThan(150);
  expect(r.durations[0]).toBe(600);
  expect(r.durations[SWING]).toBe(600);
  r.durations.forEach((d, k) => { if(k !== 0 && k !== SWING) expect(d, 'frame ' + k).toBe(70); });
  expect(r.differ, 'the bars moved between the ends').toBeGreaterThan(200);
  expect(r.differTop, 'the title stays').toBe(0);
}
const isGif = (bytes) => String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a';

test('🎞 GIF in the full screen with two charts: a looping 720-pixel GIF of one swing, downloaded', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSample(page);
  await lowAndHigh(page);
  const before = await boardText(page);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await page.locator('.show-chip[data-id="' + await page.locator('.chart-widget').nth(1).getAttribute('data-id') + '"]').click();
  await expect(page.locator('#showBody .show-widget')).toHaveCount(2);
  await expect(page.locator('#showGif')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#showGif').click()]);
  const boardName = await g(page, () => fmGraph.boards().find(b => b.shown).name);
  expect(download.suggestedFilename()).toBe('fmGraph-' + boardName.replace(/[^A-Za-z0-9 ._()-]+/g, '_') + '.gif');
  const bytes = require('fs').readFileSync(await download.path());
  expect(isGif(bytes)).toBe(true);
  checkGif(await readGif(page, bytes, SWING, 45));
  // Still in the full screen; the page as before: no play, no undo step, the board unchanged.
  await expect(page.locator('#showView')).toBeVisible();
  await expect(page.locator('#gifProgress')).toBeHidden();
  await expect(page.locator('#gifStage')).toHaveCount(0);
  expect(await g(page, () => fmGraph.playing())).toBeNull();
  expect(await boardText(page)).toBe(before);
  expect(pageErrors).toEqual([]);
});

test('🎞 on one chart: a GIF of that chart alone, named after it; the same through fmGraph.makePlayGif', async ({ page, pageErrors }) => {
  await openSample(page);
  await lowAndHigh(page);
  const chart = page.locator('.chart-widget').first();
  await expect(page.locator('.widget-gif')).toHaveCount(await g(page, () => fmGraph.board().items.length));
  const title = await chart.locator('.chart-title').inputValue();
  const [download] = await Promise.all([page.waitForEvent('download'), chart.locator('.widget-gif').click()]);
  expect(download.suggestedFilename()).toBe('fmGraph-' + title + '.gif');
  const bytes = require('fs').readFileSync(await download.path());
  checkGif(await readGif(page, bytes, SWING, 30));
  // The scriptable call: the bytes, without a download; the play's own ends while it plays.
  const id = await chart.getAttribute('data-id');
  await g(page, () => fmGraph.play({ from: 'Low', to: 'High' }));
  const r = await g(page, async (id) => {
    const r = await fmGraph.makePlayGif({ ids: [id] });
    return { bytes: Array.from(r.bytes), frames: r.frames, width: r.width, height: r.height, name: r.name, ms: r.ms, blob: r.blob.type, size: r.blob.size };
  }, id);
  expect(isGif(r.bytes)).toBe(true);
  expect(r).toMatchObject({ frames: FRAMES, width: 720, name: 'fmGraph-' + title + '.gif', blob: 'image/gif', size: r.bytes.length });
  expect(await g(page, () => fmGraph.playing())).toBeNull(); // the play stopped for it
  checkGif(await readGif(page, r.bytes, SWING, 30));
  expect(pageErrors).toEqual([]);
});

test('nothing to play: no GIF, and the strip says so', async ({ page, pageErrors }) => {
  await openSample(page);
  // No scenarios and the sliders untouched: the model's own numbers both ends.
  let downloads = 0;
  page.on('download', () => downloads++);
  const r = await g(page, () => fmGraph.makePlayGif({}));
  expect(r.problem).toMatch(/^Nothing to play/);
  await page.locator('.chart-widget').first().locator('.widget-full').click();
  await page.locator('#showGif').click();
  await expect(page.locator('#showNote')).toHaveText(/Nothing to play: choose two different ends under Scenarios/);
  await expect(page.locator('#gifProgress')).toBeHidden();
  expect(downloads).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('over the cap it stops and says so; Cancel stops it; the board is unchanged', async ({ page, pageErrors }) => {
  await openSample(page);
  await lowAndHigh(page);
  const before = await boardText(page);
  const id = await page.locator('.chart-widget').first().getAttribute('data-id');
  const big = await g(page, (id) => fmGraph.makePlayGif({ ids: [id], maxBytes: 20000 }), id);
  expect(big.problem).toMatch(/^The GIF would be [\d.]+ MB, more than the 0 MB it may be: show fewer charts/);
  expect(big.tooLarge).toBe(true);
  expect(big.size).toBeGreaterThan(20000);
  // Cancel: started, then Cancel on the progress strip while it shows.
  await g(page, (id) => { window.gifRun = fmGraph.makePlayGif({ ids: [id] }); }, id);
  await expect(page.locator('#gifProgress')).toBeVisible();
  await expect(page.locator('#gifProgressText')).toHaveText(/^Making the GIF… \d+%$/);
  await page.locator('#btnGifCancel').click();
  const r = await g(page, () => window.gifRun);
  expect(r).toEqual({ problem: 'The GIF was cancelled.', cancelled: true });
  await expect(page.locator('#gifProgress')).toBeHidden();
  await expect(page.locator('#gifStage')).toHaveCount(0);
  expect(await g(page, () => fmGraph.cancelPlayGif())).toBe(false);
  expect(await boardText(page)).toBe(before);
  expect(pageErrors).toEqual([]);
});
