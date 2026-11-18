// ============================================================
// Numbers and the calculation's errors as people read them. Part of the board engine, which
// the showcase viewer takes in too (docs/viewer-brief.md, phase V2): nothing here edits.
// ============================================================

// Numbers as people read them: thousands separated, at most a few decimals.
function fmtNum(v){
  if(typeof v !== 'number' || !isFinite(v)) return '—';
  if(v === 0) v = 0; // −0 reads as 0
  const a = Math.abs(v);
  const digits = a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 3 : 4;
  const text = v.toLocaleString('en-US', { maximumFractionDigits: digits });
  return /[1-9]/.test(text) ? text.replace('-', '−') : '0'; // −0.00001 rounds to 0, not −0
}

function fmtDiff(now, base){
  const d = now - base;
  if(!isFinite(d) || Math.abs(d) < 1e-12 * Math.max(1, Math.abs(base))) return '';
  const size = fmtNum(Math.abs(d));
  let t = (size === '0' ? '' : d > 0 ? '+' : '−') + size; // a change that rounds to 0 has no sign
  if(base !== 0 && isFinite(base)){
    const pct = d / Math.abs(base) * 100;
    t += ' (' + (pct > 0 ? '+' : '−') + Math.abs(pct).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%)';
  }
  return t;
}

// What an error code means, in plain words (the calculation's codes; the shared words,
// src/shared/error-words.js, which the showcase viewer uses too).
function errorText(code){ return errorWords(code); }
