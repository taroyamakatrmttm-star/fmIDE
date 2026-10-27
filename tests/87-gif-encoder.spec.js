// 87. The animated-GIF writer (src/shared/gif.js; the owner's idea of 27 October 2026, a GIF of
// fmGraph's Play): makeGif written here with no library, read back by a small GIF decoder
// written in this file, in Node. The frames' pixels come back as written (exactly, with at most
// 255 colours; near, with more), with the loop block, each frame's delay and disposal, and only
// the rectangle that changed; bad input is refused. One test also has Chromium's own decoder
// (ImageDecoder) read the frames, so the encoder and this decoder can't share a mistake.
const { test, expect } = require('@playwright/test');
const { makeGif, gifLzw, GIF_LIMITS } = require('../src/shared/gif.js');

// ---------- a small GIF decoder (GIF89a, global colour table, no interlace) ----------
function lzwDecode(bytes, minCode, count){
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1, prev = -1;
  let dict = [];
  const reset = () => { dict = []; for(let i = 0; i < clear; i++) dict[i] = [i]; size = minCode + 1; next = eoi + 1; prev = -1; };
  reset();
  const out = [];
  let acc = 0, accBits = 0, pos = 0;
  for(;;){
    while(accBits < size){
      if(pos >= bytes.length) throw new Error('LZW data ended without the end code');
      acc |= bytes[pos++] << accBits; accBits += 8;
    }
    const code = acc & ((1 << size) - 1);
    acc >>>= size; accBits -= size;
    if(code === clear){ reset(); continue; }
    if(code === eoi) break;
    let entry;
    if(prev < 0){
      if(!dict[code]) throw new Error('LZW: first code ' + code + ' unknown');
      entry = dict[code];
    } else {
      if(code < next && dict[code]) entry = dict[code];
      else if(code === next) entry = dict[prev].concat(dict[prev][0]);
      else throw new Error('LZW: code ' + code + ' out of order (next ' + next + ')');
      if(next < 4096) dict[next++] = dict[prev].concat(entry[0]);
      if(next === (1 << size) && size < 12) size++;
    }
    for(const v of entry) out.push(v);
    prev = code;
  }
  if(out.length !== count) throw new Error('LZW gave ' + out.length + ' pixels, not ' + count);
  return out;
}

function decodeGif(bytes){
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => { const v = bytes[p] | (bytes[p + 1] << 8); p += 2; return v; };
  const text = (n) => { let s = ''; for(let i = 0; i < n; i++) s += String.fromCharCode(bytes[p++]); return s; };
  const blocks = () => { const parts = []; for(let n = u8(); n; n = u8()){ parts.push(...bytes.subarray(p, p + n)); p += n; } return parts; };
  const gif = { header: text(6), loop: null, frames: [] };
  gif.width = u16(); gif.height = u16();
  const packed = u8(); u8(); u8();
  if(!(packed & 0x80)) throw new Error('no global colour table');
  const tableSize = 1 << ((packed & 7) + 1);
  gif.palette = [];
  for(let i = 0; i < tableSize; i++) gif.palette.push([u8(), u8(), u8()]);
  const canvas = new Uint8ClampedArray(gif.width * gif.height * 4);
  let gce = null;
  for(;;){
    const b = u8();
    if(b === 0x3b) break;
    if(b === 0x21){
      const label = u8();
      if(label === 0xf9){
        u8(); const pk = u8(); const delay = u16(); const ti = u8(); u8();
        gce = { disposal: (pk >> 2) & 7, transparent: (pk & 1) ? ti : -1, delay };
      } else if(label === 0xff){
        const n = u8(); const id = text(n); const data = blocks();
        if(id === 'NETSCAPE2.0') gif.loop = data[1] | (data[2] << 8);
        continue;
      } else blocks();
      continue;
    }
    if(b !== 0x2c) throw new Error('unexpected block ' + b + ' at ' + (p - 1));
    const left = u16(), top = u16(), w = u16(), h = u16();
    if(u8() & 0xc0) throw new Error('local table or interlace not expected');
    const minCode = u8();
    const idx = lzwDecode(Uint8Array.from(blocks()), minCode, w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const v = idx[y * w + x];
      if(gce && v === gce.transparent) continue;
      const j = ((top + y) * gif.width + left + x) * 4;
      const c = gif.palette[v];
      canvas[j] = c[0]; canvas[j + 1] = c[1]; canvas[j + 2] = c[2]; canvas[j + 3] = 255;
    }
    gif.frames.push({ left, top, w, h, delay: gce ? gce.delay : 0, disposal: gce ? gce.disposal : 0, transparent: gce ? gce.transparent : -1, rgba: canvas.slice() });
    gce = null;
  }
  return gif;
}

// ---------- frames to write ----------
// A chart-like frame: white, a bar of the given height in a colour, grey grid lines and a few
// "anti-aliased" greys at the bar's top.
function chartFrame(w, h, barHeight, colour){
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  const set = (x, y, c) => { const j = (y * w + x) * 4; px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = 255; };
  for(let y = 0; y < h; y += 10) for(let x = 0; x < w; x++) set(x, y, [220, 220, 220]);
  for(let y = h - barHeight; y < h; y++) for(let x = 20; x < 40; x++) set(x, y, colour);
  for(let x = 20; x < 40; x++) set(x, Math.max(0, h - barHeight - 1), [180 + (x % 5) * 10, 180, 180]);
  return px;
}
const sameRgb = (a, b) => { for(let i = 0; i < a.length; i += 4) if(a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return false; return true; };

test('frames come back as written: pixels, loop, delays, disposal, the changed rectangle', () => {
  const W = 64, H = 48;
  const frames = [
    { rgba: chartFrame(W, H, 10, [15, 118, 110]), delayMs: 100 },
    { rgba: chartFrame(W, H, 20, [15, 118, 110]), delayMs: 40 },
    { rgba: chartFrame(W, H, 20, [15, 118, 110]), delayMs: 1000 },  // nothing changed
    { rgba: chartFrame(W, H, 30, [220, 38, 38]), delayMs: 64 },
  ];
  const bytes = makeGif({ width: W, height: H, frames });
  expect(bytes).toBeInstanceOf(Uint8Array);
  const gif = decodeGif(bytes);
  expect(gif.header).toBe('GIF89a');
  expect([gif.width, gif.height]).toEqual([W, H]);
  expect(gif.loop).toBe(0);
  expect(gif.frames).toHaveLength(4);
  expect(gif.frames.map(f => f.delay)).toEqual([10, 4, 100, 6]);
  expect(gif.frames.map(f => f.disposal)).toEqual([1, 1, 1, 1]);
  expect(gif.frames[0].transparent).toBe(-1);
  gif.frames.forEach((f, k) => expect(sameRgb(f.rgba, frames[k].rgba), 'frame ' + (k + 1)).toBe(true));
  // The first frame is whole; the second only the rows the bar grew into (its old top line
  // of greys, now teal, to the new top line), the bar's columns; the third one pixel.
  expect(gif.frames[0]).toMatchObject({ left: 0, top: 0, w: W, h: H });
  expect(gif.frames[1]).toMatchObject({ left: 20, top: H - 21, w: 20, h: 11 });
  expect(gif.frames[2]).toMatchObject({ w: 1, h: 1 });
  expect(gif.frames[3]).toMatchObject({ left: 20, top: H - 31, w: 20, h: 31 });
  // Few colours, so a small table: white, the grid grey, 5 greys, teal, red (+ "unchanged").
  expect(gif.palette.length).toBe(16);
});

test('the loop: a count, none (plays once), and a canvas\'s clear pixels as white', () => {
  const W = 4, H = 3;
  const clear = new Uint8ClampedArray(W * H * 4); // all 0: transparent black
  const half = new Uint8ClampedArray(W * H * 4).map((v, i) => i % 4 === 3 ? 128 : 0);
  let gif = decodeGif(makeGif({ width: W, height: H, frames: [{ rgba: clear, delayMs: 0 }, { rgba: half, delayMs: 5 }], loop: 3 }));
  expect(gif.loop).toBe(3);
  expect([...gif.frames[0].rgba.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  expect([...gif.frames[1].rgba.subarray(0, 4)]).toEqual([127, 127, 127, 255]);
  expect(gif.frames.map(f => f.delay)).toEqual([0, 1]);
  gif = decodeGif(makeGif({ width: W, height: H, frames: [{ rgba: clear }], loop: null }));
  expect(gif.loop).toBe(null);
  expect(gif.frames).toHaveLength(1);
});

test('LZW: long and varied data fills the table, clears it, and decodes exactly', () => {
  // Noise in 256 values (minimum code size 8) and in 4 (size 2), long enough to clear many times.
  let seed = 7;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 16) % n; };
  for(const [minCode, n] of [[8, 256], [2, 4], [4, 13]]){
    const data = Uint8Array.from({ length: 60000 }, (_, i) => i % 97 < 40 ? rand(n) : (i >> 6) % n);
    expect(Uint8Array.from(lzwDecode(gifLzw(data, minCode), minCode, data.length))).toEqual(data);
  }
  expect(lzwDecode(gifLzw(new Uint8Array([1]), 2), 2, 1)).toEqual([1]);
});

test('more than 255 colours: still written, every pixel near its colour', () => {
  const W = 96, H = 64;
  const px = new Uint8ClampedArray(W * H * 4);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const j = (y * W + x) * 4;
    px[j] = Math.round(x * 255 / (W - 1)); px[j + 1] = Math.round(y * 255 / (H - 1)); px[j + 2] = (x * 7 + y * 3) % 256; px[j + 3] = 255;
  }
  const gif = decodeGif(makeGif({ width: W, height: H, frames: [{ rgba: px, delayMs: 50 }] }));
  expect(gif.palette.length).toBe(256);
  let worst = 0, sum = 0;
  for(let i = 0; i < px.length; i += 4){
    const d = Math.max(Math.abs(px[i] - gif.frames[0].rgba[i]), Math.abs(px[i + 1] - gif.frames[0].rgba[i + 1]), Math.abs(px[i + 2] - gif.frames[0].rgba[i + 2]));
    worst = Math.max(worst, d); sum += d;
  }
  expect(worst).toBeLessThanOrEqual(64);
  expect(sum / (W * H)).toBeLessThan(16);
});

test('bad input is refused, saying what is wrong', () => {
  const ok = { rgba: new Uint8ClampedArray(2 * 2 * 4), delayMs: 10 };
  const bad = [
    [undefined, /options must be an object/],
    [{ width: 0, height: 2, frames: [ok] }, /width must be a whole number/],
    [{ width: 2.5, height: 2, frames: [ok] }, /width must be a whole number/],
    [{ width: '2', height: 2, frames: [ok] }, /width must be a whole number/],
    [{ width: 2, height: GIF_LIMITS.maxSide + 1, frames: [ok] }, /height must be a whole number/],
    [{ width: 2, height: 2, frames: [] }, /frames must be a list/],
    [{ width: 2, height: 2, frames: 'x' }, /frames must be a list/],
    [{ width: 2, height: 2, frames: [{ rgba: [0, 0, 0, 0] }] }, /frame 1 has no rgba/],
    [{ width: 2, height: 2, frames: [ok, { rgba: new Uint8ClampedArray(12) }] }, /frame 2 is not 2 × 2/],
    [{ width: 2, height: 2, frames: [{ rgba: ok.rgba, delayMs: -1 }] }, /delay must be/],
    [{ width: 2, height: 2, frames: [{ rgba: ok.rgba, delayMs: NaN }] }, /delay must be/],
    [{ width: 2, height: 2, frames: [{ rgba: ok.rgba, delayMs: '10' }] }, /delay must be/],
    [{ width: 2, height: 2, frames: [ok], loop: -1 }, /loop must be/],
    [{ width: 2, height: 2, frames: [ok], loop: 1.5 }, /loop must be/],
  ];
  for(const [options, message] of bad) expect(() => makeGif(options), JSON.stringify(options)).toThrow(message);
});

test('70 frames of 720 × 400 are written in reasonable time', () => {
  const W = 720, H = 400;
  const frames = Array.from({ length: 70 }, (_, k) => ({ rgba: chartFrame(W, H, 50 + (k < 35 ? k : 70 - k) * 8, [15, 118, 110]), delayMs: 33 }));
  const t0 = Date.now();
  const bytes = makeGif({ width: W, height: H, frames });
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: 'speed', description: `70 frames of 720 × 400: ${ms} ms, ${bytes.length} bytes` });
  console.log(`gif: 70 frames of 720 × 400 in ${ms} ms, ${bytes.length} bytes`);
  const gif = decodeGif(bytes);
  expect(gif.frames).toHaveLength(70);
  expect(sameRgb(gif.frames[69].rgba, frames[69].rgba)).toBe(true);
  expect(ms).toBeLessThan(10000);
});

test('the browser\'s own GIF decoder reads the same frames (Chromium\'s ImageDecoder)', async ({ page }) => {
  const W = 120, H = 80;
  const charts = [10, 25, 25, 60, 5].map((bar, k) => ({ rgba: chartFrame(W, H, bar, k === 3 ? [220, 38, 38] : [15, 118, 110]), delayMs: 50 + k * 10 }));
  // And with a frame of more than 255 colours: every frame through the 255 of the median cut.
  const noisy = new Uint8ClampedArray(W * H * 4);
  for(let i = 0; i < noisy.length; i += 4){ noisy[i] = (i * 13) % 256; noisy[i + 1] = (i * 7) % 256; noisy[i + 2] = (i >> 4) % 256; noisy[i + 3] = 255; }
  const mixed = charts.concat({ rgba: noisy, delayMs: 200 });
  // ImageDecoder needs a secure page: an https address answered here, nothing on the network.
  await page.route('https://gif.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('https://gif.test/');
  for(const [frames, exact, loop] of [[charts, true, 0], [mixed, false, 2]]){
    const bytes = makeGif({ width: W, height: H, frames, loop });
    const ours = decodeGif(bytes);
    const theirs = await page.evaluate(async (list) => {
      if(typeof ImageDecoder === 'undefined') return null;
      const dec = new ImageDecoder({ data: new Uint8Array(list), type: 'image/gif' });
      await dec.tracks.ready;
      const n = dec.tracks.selectedTrack.frameCount;
      const out = [];
      for(let k = 0; k < n; k++){
        const { image } = await dec.decode({ frameIndex: k });
        const c = new OffscreenCanvas(image.displayWidth, image.displayHeight);
        const g = c.getContext('2d');
        g.drawImage(image, 0, 0);
        out.push({ duration: image.duration, rgba: Array.from(g.getImageData(0, 0, c.width, c.height).data) });
        image.close();
      }
      return { n, repetition: dec.tracks.selectedTrack.repetitionCount, frames: out };
    }, Array.from(bytes));
    expect(theirs, 'Chromium has ImageDecoder').not.toBeNull();
    expect(theirs.n).toBe(frames.length);
    expect(theirs.repetition).toBe(loop === 0 ? Infinity : loop);
    theirs.frames.forEach((f, k) => {
      const rgba = Uint8ClampedArray.from(f.rgba);
      expect(f.duration, 'frame ' + (k + 1)).toBe(frames[k].delayMs * 1000);
      expect(sameRgb(rgba, ours.frames[k].rgba), 'frame ' + (k + 1) + ' as our decoder reads it').toBe(true);
      if(exact) expect(sameRgb(rgba, frames[k].rgba), 'frame ' + (k + 1) + ' as written').toBe(true);
    });
  }
});
