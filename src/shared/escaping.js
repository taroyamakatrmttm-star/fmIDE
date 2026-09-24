// ---------- escaping & validation (shared: src/shared/escaping.js, used by both apps) ----------
// Anything that came from a file (names, labels, kinds — including shared/community
// content) must never be parsed as markup: escape it (text), coerce it (numbers), or
// validate it (colours) before it goes into a markup string.
// escapeXml(s): for HTML/SVG markup — escapes & < > " and '.
// escapeXml(s, true): for XML 1.0 files (the .xlsx writer) — also drops the characters
// XML 1.0 forbids, and leaves ' as is (the writer quotes attributes with ").
function escapeXml(s, xmlFile){
  let t = String(s);
  if(xmlFile) t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return xmlFile ? t : t.replace(/'/g, '&#39;');
}
function safeNum(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : (fallback || 0); }
function safeColor(c, fallback){ return (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) ? c : fallback; }
