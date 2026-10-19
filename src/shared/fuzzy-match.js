// ---------- fuzzy match (shared: src/shared/fuzzy-match.js; fmIDE's Command Launcher and
// searches, fmGraph's rectangle search) ----------
// Returns { score, idx } or null: does `q` match `text`, and how well — a run of the letters
// as typed scores highest (higher still at the start of a word), else the letters in order,
// a letter right after the last or at a word's start scoring higher. idx: where they matched.
export function fuzzyMatch(q, text){
  const t = String(text).toLowerCase();
  q = String(q).toLowerCase().trim();
  if(!q) return { score: 0, idx: [] };
  const sub = t.indexOf(q);
  if(sub >= 0){
    const wordStart = sub === 0 || /[^a-z0-9]/.test(t[sub - 1]);
    return { score: 1000 - sub + (wordStart ? 200 : 0) - t.length * 0.1, idx: Array.from({ length: q.length }, (_, k) => sub + k) };
  }
  const idx = [];
  let ti = 0, score = 0, prev = -2;
  for(const ch of q){
    if(ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if(found < 0) return null;
    idx.push(found);
    if(found === prev + 1) score += 15;
    if(found === 0 || /[^a-z0-9]/.test(t[found - 1])) score += 25;
    score -= (found - ti);
    prev = found; ti = found + 1;
  }
  return { score, idx };
}
