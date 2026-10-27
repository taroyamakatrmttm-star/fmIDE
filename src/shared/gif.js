// ---------- animated GIF writer (shared: src/shared/gif.js; Apache, as the rest of src/shared/) ----------
// makeGif({ width, height, frames: [{ rgba, delayMs }], loop }) → Uint8Array, the bytes of an
// animated GIF (GIF89a), written here with no library:
// - one global colour table: the frames' own colours when there are at most 255 (charts have
//   few colours and some anti-aliasing greys), else 255 colours by median cut, each pixel the
//   nearest of them; the last index is kept for "unchanged" (transparent). A pixel's alpha is
//   laid over white (a canvas's clear pixels come out white, not black).
// - each frame after the first holds only the rectangle that changed since the frame before
//   (its unchanged pixels transparent, so they compress well), drawn over what is shown
//   (disposal 1, "leave it"); a frame with nothing changed is one transparent pixel.
// - its delay in hundredths of a second (delayMs / 10, rounded; browsers show under 2 as 10);
//   the NETSCAPE2.0 loop: loop 0 (the default) repeats for ever, n plays n + 1 times in most
//   viewers, loop null plays once (no loop block).
// - LZW as the GIF standard has it: variable code size up to 12 bits, a clear code when the
//   table is full.
// Inputs are checked (whole sizes within GIF_LIMITS, every frame's rgba the size's length):
// anything else throws an Error saying what is wrong.

export const GIF_LIMITS = { maxSide: 4096, maxFrames: 2000, maxDelayMs: 655350, maxLoop: 65535 };

export function makeGif(options){
  const { width, height, frames } = gifCheckInput(options);
  const loop = options.loop === undefined ? 0 : options.loop;
  const n = width * height;
  // The colours, as 0xRRGGBB per pixel per frame (alpha laid over white).
  const pixels = frames.map(f => gifRgb(f.rgba, n));
  const palette = gifPalette(pixels);
  const indexOf = gifIndexer(palette);
  const transparent = palette.length; // the index after the colours: "unchanged"
  let bits = 1;
  while((1 << bits) < palette.length + 1) bits++;
  const out = new GifBytes(n * frames.length / 4 + 1024);
  out.text('GIF89a');
  out.u16(width); out.u16(height);
  out.byte(0x80 | (7 << 4) | (bits - 1)); out.byte(0); out.byte(0);
  for(let i = 0; i < (1 << bits); i++){
    const c = palette[i] || 0;
    out.byte(c >> 16); out.byte((c >> 8) & 255); out.byte(c & 255);
  }
  if(loop !== null){
    out.byte(0x21); out.byte(0xff); out.byte(11); out.text('NETSCAPE2.0');
    out.byte(3); out.byte(1); out.u16(loop); out.byte(0);
  }
  let shown = null; // the indexes shown after the frame before
  frames.forEach((f, k) => {
    const idx = new Uint8Array(n);
    const px = pixels[k];
    for(let i = 0; i < n; i++) idx[i] = indexOf(px[i]);
    let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1, data = idx;
    if(shown){
      // The rectangle that changed; outside it nothing is written.
      x0 = width; y0 = height; x1 = -1; y1 = -1;
      for(let y = 0, i = 0; y < height; y++){
        for(let x = 0; x < width; x++, i++){
          if(idx[i] !== shown[i]){
            if(x < x0) x0 = x; if(x > x1) x1 = x;
            if(y < y0) y0 = y; y1 = y;
          }
        }
      }
      if(x1 < 0){ x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      data = new Uint8Array(w * h);
      for(let y = 0; y < h; y++){
        for(let x = 0; x < w; x++){
          const i = (y0 + y) * width + x0 + x;
          data[y * w + x] = idx[i] === shown[i] ? transparent : idx[i];
        }
      }
    }
    out.byte(0x21); out.byte(0xf9); out.byte(4);
    out.byte((1 << 2) | (shown ? 1 : 0));
    out.u16(Math.round(f.delayMs / 10)); out.byte(shown ? transparent : 0); out.byte(0);
    out.byte(0x2c); out.u16(x0); out.u16(y0); out.u16(x1 - x0 + 1); out.u16(y1 - y0 + 1); out.byte(0);
    const minCode = Math.max(2, bits);
    out.byte(minCode);
    gifSubBlocks(out, gifLzw(data, minCode));
    shown = idx;
  });
  out.byte(0x3b);
  return out.bytes();
}

function gifCheckInput(options){
  if(!options || typeof options !== 'object') throw new Error('makeGif: options must be an object');
  const { width, height, frames, loop } = options;
  const side = (v, name) => {
    if(!Number.isInteger(v) || v < 1 || v > GIF_LIMITS.maxSide) throw new Error('makeGif: ' + name + ' must be a whole number from 1 to ' + GIF_LIMITS.maxSide);
  };
  side(width, 'width'); side(height, 'height');
  if(!Array.isArray(frames) || frames.length < 1 || frames.length > GIF_LIMITS.maxFrames) throw new Error('makeGif: frames must be a list of 1 to ' + GIF_LIMITS.maxFrames);
  frames.forEach((f, k) => {
    if(!f || !(f.rgba instanceof Uint8ClampedArray || f.rgba instanceof Uint8Array)) throw new Error('makeGif: frame ' + (k + 1) + ' has no rgba pixels');
    if(f.rgba.length !== width * height * 4) throw new Error('makeGif: frame ' + (k + 1) + ' is not ' + width + ' × ' + height);
    const d = f.delayMs === undefined ? 0 : f.delayMs;
    if(typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > GIF_LIMITS.maxDelayMs) throw new Error('makeGif: frame ' + (k + 1) + "'s delay must be from 0 to " + GIF_LIMITS.maxDelayMs + ' ms');
  });
  if(loop !== undefined && loop !== null && (!Number.isInteger(loop) || loop < 0 || loop > GIF_LIMITS.maxLoop)) throw new Error('makeGif: loop must be null or a whole number from 0 to ' + GIF_LIMITS.maxLoop);
  return { width, height, frames: frames.map(f => ({ rgba: f.rgba, delayMs: f.delayMs || 0 })) };
}

function gifRgb(rgba, n){
  const out = new Int32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4){
    const a = rgba[j + 3];
    if(a === 255) out[i] = (rgba[j] << 16) | (rgba[j + 1] << 8) | rgba[j + 2];
    else {
      const over = (c) => Math.round((c * a + 255 * (255 - a)) / 255);
      out[i] = (over(rgba[j]) << 16) | (over(rgba[j + 1]) << 8) | over(rgba[j + 2]);
    }
  }
  return out;
}

// The colours of every frame: exact when at most 255, else 255 by median cut.
function gifPalette(pixels){
  const counts = new Map();
  for(const px of pixels){
    let last = -1;
    for(let i = 0; i < px.length; i++){
      const c = px[i];
      if(c === last) continue;
      last = c;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  if(counts.size <= 255) return [...counts.keys()].sort((a, b) => a - b);
  return gifMedianCut([...counts.entries()], 255);
}

function gifMedianCut(entries, size){
  const ch = (c, k) => (c >> (16 - 8 * k)) & 255;
  const boxes = [entries];
  while(boxes.length < size){
    // Split the box with the widest channel range (of those with more than one colour).
    let best = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((b, i) => {
      if(b.length < 2) return;
      for(let k = 0; k < 3; k++){
        let lo = 255, hi = 0;
        for(const [c] of b){ const v = ch(c, k); if(v < lo) lo = v; if(v > hi) hi = v; }
        if(hi - lo > bestRange){ bestRange = hi - lo; best = i; bestCh = k; }
      }
    });
    if(best < 0) break;
    const b = boxes[best].sort((p, q) => ch(p[0], bestCh) - ch(q[0], bestCh));
    // At the median pixel (by count), keeping both halves non-empty.
    let total = 0; for(const e of b) total += e[1];
    let run = 0, cut = 1;
    for(let i = 0; i < b.length - 1; i++){ run += b[i][1]; if(run * 2 >= total){ cut = i + 1; break; } cut = i + 1; }
    boxes.splice(best, 1, b.slice(0, cut), b.slice(cut));
  }
  return boxes.map(b => {
    let r = 0, g = 0, bl = 0, w = 0;
    for(const [c, k] of b){ r += ch(c, 0) * k; g += ch(c, 1) * k; bl += ch(c, 2) * k; w += k; }
    return (Math.round(r / w) << 16) | (Math.round(g / w) << 8) | Math.round(bl / w);
  });
}

// colour → palette index: exact, else the nearest (remembered per colour).
function gifIndexer(palette){
  const known = new Map(palette.map((c, i) => [c, i]));
  let lastC = -1, lastI = 0;
  return (c) => {
    if(c === lastC) return lastI;
    let i = known.get(c);
    if(i === undefined){
      const r = c >> 16, g = (c >> 8) & 255, b = c & 255;
      let bestD = Infinity;
      for(let k = 0; k < palette.length; k++){
        const p = palette[k];
        const dr = r - (p >> 16), dg = g - ((p >> 8) & 255), db = b - (p & 255);
        const d = dr * dr + dg * dg + db * db;
        if(d < bestD){ bestD = d; i = k; }
      }
      known.set(c, i);
    }
    lastC = c; lastI = i;
    return i;
  };
}

// LZW (GIF's form): codes from minCode + 1 bits up to 12, least significant bit first.
let gifLzwTables = null;
export function gifLzw(data, minCode){
  const clear = 1 << minCode, eoi = clear + 1;
  // (prefix, pixel) → code, valid when its stamp is this table's; kept between calls (a clear
  // is a new stamp, not 8 MB written again).
  if(!gifLzwTables || gifLzwTables.codes.length < (4096 << minCode)){
    gifLzwTables = { codes: new Int32Array(4096 << 8), stamps: new Int32Array(4096 << 8), stamp: 0 };
  }
  const { codes, stamps } = gifLzwTables;
  let stamp = ++gifLzwTables.stamp, next = eoi + 1, size = minCode + 1;
  const out = new GifBytes(data.length / 2 + 16);
  let acc = 0, accBits = 0;
  const emit = (code) => {
    acc |= code << accBits; accBits += size;
    while(accBits >= 8){ out.byte(acc & 255); acc >>>= 8; accBits -= 8; }
  };
  emit(clear);
  let prefix = data.length ? data[0] : -1;
  for(let i = 1; i < data.length; i++){
    const k = data[i];
    const key = (prefix << minCode) | k;
    if(stamps[key] === stamp){ prefix = codes[key]; continue; }
    emit(prefix);
    if(next === 4096){
      emit(clear);
      stamp = ++gifLzwTables.stamp; next = eoi + 1; size = minCode + 1;
    } else {
      if(next >= (1 << size)) size++;
      stamps[key] = stamp; codes[key] = next++;
    }
    prefix = k;
  }
  if(prefix >= 0) emit(prefix);
  emit(eoi);
  if(accBits > 0) out.byte(acc & 255);
  return out.bytes();
}

function gifSubBlocks(out, bytes){
  for(let i = 0; i < bytes.length; i += 255){
    const len = Math.min(255, bytes.length - i);
    out.byte(len);
    out.append(bytes.subarray(i, i + len));
  }
  out.byte(0);
}

class GifBytes {
  constructor(size){ this.buf = new Uint8Array(Math.max(64, Math.ceil(size))); this.n = 0; }
  room(k){
    if(this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k));
    b.set(this.buf.subarray(0, this.n)); this.buf = b;
  }
  byte(v){ this.room(1); this.buf[this.n++] = v; }
  u16(v){ this.byte(v & 255); this.byte((v >> 8) & 255); }
  text(s){ for(let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  append(bytes){ this.room(bytes.length); this.buf.set(bytes, this.n); this.n += bytes.length; }
  bytes(){ return this.buf.slice(0, this.n); }
}
