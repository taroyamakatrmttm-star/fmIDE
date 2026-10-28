#!/usr/bin/env node
// Packs bytes with deflate (the "deflate-raw" form a browser's DecompressionStream unpacks), the
// same bytes on every computer: the build uses it to carry the showcase viewer's page inside
// fmIDE (phase V3 of docs/viewer-brief.md). Node's own zlib could give other bytes on another
// Node version or processor, and the built apps/ files must be the same wherever they are built
// (npm run build:check). Our own small packer: matches found by a hash of three bytes, a chain of
// earlier places with the same hash (at most MAX_CHAIN looked at), one step of lazy matching, and
// one block of deflate's fixed Huffman codes (RFC 1951, section 3.2.6). About 15% larger than
// zlib's best, and always the same.
//
//   node tools/pack.js FILE        prints FILE's size, packed and in base64 (a check by hand)
//
// Exports deflateRaw(bytes) → Buffer and packBase64(bytes) → string. Node only, no packages.
'use strict';

const WINDOW = 32768;
const MIN_MATCH = 3, MAX_MATCH = 258;
const MAX_CHAIN = 256;    // earlier places looked at per position
const GOOD_ENOUGH = 128;  // a match this long is taken without looking further
const HASH_BITS = 15, HASH_SIZE = 1 << HASH_BITS, HASH_MASK = HASH_SIZE - 1;

// Length codes 257…285: the shortest length each starts at, and its extra bits.
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
// Distance codes 0…29.
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

// For each length 3…258 and distance 1…32768, its code (looked up once).
const LENGTH_CODE = new Uint16Array(MAX_MATCH + 1);
for(let c = 0; c < LENGTH_BASE.length; c++){
  const end = c + 1 < LENGTH_BASE.length ? LENGTH_BASE[c + 1] : MAX_MATCH + 1;
  for(let l = LENGTH_BASE[c]; l < end && l <= MAX_MATCH; l++) LENGTH_CODE[l] = c;
}
LENGTH_CODE[MAX_MATCH] = 28;
function distCode(d){
  let lo = 0, hi = DIST_BASE.length - 1;
  while(lo < hi){ const mid = (lo + hi + 1) >> 1; if(DIST_BASE[mid] <= d) lo = mid; else hi = mid - 1; }
  return lo;
}

// Writes bits the way deflate reads them: each value least significant bit first, Huffman codes
// most significant bit first (so they are reversed before writing).
class BitWriter {
  constructor(size){ this.buf = Buffer.alloc(Math.max(64, size)); this.pos = 0; this.acc = 0; this.n = 0; }
  bits(value, count){
    this.acc |= value << this.n;
    this.n += count;
    while(this.n >= 8){
      if(this.pos >= this.buf.length){ const b = Buffer.alloc(this.buf.length * 2); this.buf.copy(b); this.buf = b; }
      this.buf[this.pos++] = this.acc & 0xff;
      this.acc >>>= 8;
      this.n -= 8;
    }
  }
  code(code, len){
    let r = 0;
    for(let i = 0; i < len; i++){ r = (r << 1) | (code & 1); code >>>= 1; }
    this.bits(r, len);
  }
  finish(){
    if(this.n > 0) this.bits(0, 8 - this.n);
    return this.buf.subarray(0, this.pos);
  }
}

// The fixed Huffman code of a literal or length symbol 0…287.
function litLen(w, sym){
  if(sym < 144) w.code(0x30 + sym, 8);
  else if(sym < 256) w.code(0x190 + sym - 144, 9);
  else if(sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

function writeMatch(w, len, dist){
  const lc = LENGTH_CODE[len];
  litLen(w, 257 + lc);
  if(LENGTH_EXTRA[lc]) w.bits(len - LENGTH_BASE[lc], LENGTH_EXTRA[lc]);
  const dc = distCode(dist);
  w.code(dc, 5);
  if(DIST_EXTRA[dc]) w.bits(dist - DIST_BASE[dc], DIST_EXTRA[dc]);
}

// Packs `input` (a Buffer or Uint8Array) as one deflate block with the fixed codes.
function deflateRaw(input){
  const src = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const n = src.length;
  const w = new BitWriter((n >> 1) + 64);
  w.bits(1, 1); // the last block
  w.bits(1, 2); // fixed Huffman codes
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(WINDOW);
  const hashAt = (i) => ((src[i] << 10) ^ (src[i + 1] << 5) ^ src[i + 2]) & HASH_MASK;
  const insert = (i) => {
    if(i + MIN_MATCH > n) return;
    const h = hashAt(i);
    prev[i & (WINDOW - 1)] = head[h];
    head[h] = i;
  };
  // The longest earlier match at i: [length, distance], length 0 when none.
  const longest = (i) => {
    if(i + MIN_MATCH > n) return [0, 0];
    const max = Math.min(MAX_MATCH, n - i);
    let best = 0, bestDist = 0, chain = MAX_CHAIN;
    let j = head[hashAt(i)];
    while(j >= 0 && i - j <= WINDOW && chain-- > 0){
      if(src[j + best] === src[i + best] && src[j] === src[i]){
        let l = 0;
        while(l < max && src[j + l] === src[i + l]) l++;
        if(l > best){ best = l; bestDist = i - j; if(l >= max || l >= GOOD_ENOUGH) break; }
      }
      const p = prev[j & (WINDOW - 1)];
      if(p >= j) break; // an older entry overwritten: no further back
      j = p;
    }
    return best >= MIN_MATCH ? [best, bestDist] : [0, 0];
  };
  let i = 0;
  while(i < n){
    const [len, dist] = longest(i);
    if(len === 0){ litLen(w, src[i]); insert(i); i++; continue; }
    // Lazy matching: a longer match one place on wins, and this byte goes as a literal.
    insert(i);
    const [len2] = len < GOOD_ENOUGH && i + 1 < n ? longest(i + 1) : [0];
    if(len2 > len){ litLen(w, src[i]); i++; continue; }
    writeMatch(w, len, dist);
    for(let k = 1; k < len; k++) insert(i + k);
    i += len;
  }
  litLen(w, 256); // the end of the block
  return Buffer.from(w.finish());
}

function packBase64(input){ return deflateRaw(input).toString('base64'); }

module.exports = { deflateRaw, packBase64 };

if(require.main === module){
  const file = process.argv[2];
  if(!file){ console.error('usage: node tools/pack.js FILE'); process.exit(2); }
  const data = require('fs').readFileSync(file);
  const packed = deflateRaw(data);
  console.log(file + ': ' + data.length + ' bytes, packed ' + packed.length + ' (' + (packed.length / data.length).toFixed(3) + '), base64 ' + Math.ceil(packed.length / 3) * 4);
}
