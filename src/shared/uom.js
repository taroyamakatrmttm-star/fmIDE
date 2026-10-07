// ---------- unit of measure (UOM) (shared: src/shared/uom.js) ----------
// A rectangle's optional 3rd text line ("Name\nValue\nUOM") is a manual unit label,
// e.g. "kt", "$/t". For rectangles with no manual UOM, the UOM of a formula-driven
// rectangle is derived automatically from its inputs' UOMs through the same × ÷ + −
// (and abs/min/max/ave/iferror) logic used to compute its value — so "Unit Price ($/t)
// × Volume (kt)" resolves to "$k" automatically. A UOM is represented internally as
// {scale, dims}: dims maps a base symbol (e.g. '$', 't') to its exponent (denominator
// atoms are negative), and scale is the numeric multiplier from a recognized prefix
// (k=1e3, m/mm=1e6, bn=1e9) that may be attached to either end of an atom's token.
const UOM_PREFIXES = [['bn', 1e9], ['mm', 1e6], ['k', 1e3], ['m', 1e6]]; // checked longest-first
const UOM_CURRENCY_SYMBOLS = new Set(['$', '€', '£', '¥']);
const UOM_SCALE_TO_PREFIX = { 1: '', 1000: 'k', 1000000: 'm', 1000000000: 'bn' };

function parseUOMAtom(tok){
  tok = tok.trim();
  if(!tok) return null;
  if(tok === '%') return { scale: 0.01, symbol: '' };
  for(const [pfx, mult] of UOM_PREFIXES){
    if(tok.length > pfx.length){
      if(tok.slice(0, pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(pfx.length).trim() };
      if(tok.slice(-pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(0, -pfx.length).trim() };
    }
  }
  return { scale: 1, symbol: tok };
}

function parseUOMSegment(seg){
  return seg.split(/[*·]/).map(parseUOMAtom).filter(Boolean);
}

// Parses a manually-typed UOM string (e.g. "$/t", "kt", "$k") into {scale, dims}, or
// null if blank/unparseable.
export function parseUOM(str){
  if(!str) return null;
  const s = str.trim();
  if(!s) return null;
  const slashIdx = s.indexOf('/');
  const numAtoms = parseUOMSegment(slashIdx === -1 ? s : s.slice(0, slashIdx));
  const denAtoms = slashIdx === -1 ? [] : parseUOMSegment(s.slice(slashIdx + 1));
  if(numAtoms.length === 0 && denAtoms.length === 0) return null;
  let scale = 1;
  const dims = {};
  numAtoms.forEach(a => { scale *= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) + 1; });
  denAtoms.forEach(a => { scale /= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) - 1; });
  Object.keys(dims).forEach(k => { if(dims[k] === 0) delete dims[k]; });
  return { scale, dims };
}

// Renders {scale, dims} back to a display string, e.g. {scale:1000, dims:{$:1}} -> "$k".
export function formatUOM(u){
  if(!u) return '';
  const numSyms = Object.keys(u.dims).filter(k => u.dims[k] > 0).sort();
  const denSyms = Object.keys(u.dims).filter(k => u.dims[k] < 0).sort();
  const prefix = UOM_SCALE_TO_PREFIX.hasOwnProperty(u.scale) ? UOM_SCALE_TO_PREFIX[u.scale] : '';
  const atomStr = (sym, exp) => (exp > 1 ? sym + '^' + exp : sym);
  let numPart;
  if(numSyms.length === 0){
    numPart = prefix;
  } else if(numSyms.length === 1 && prefix){
    const sym = numSyms[0];
    numPart = UOM_CURRENCY_SYMBOLS.has(sym) ? (atomStr(sym, u.dims[sym]) + prefix) : (prefix + atomStr(sym, u.dims[sym]));
  } else {
    numPart = (prefix ? prefix + '·' : '') + numSyms.map(s => atomStr(s, u.dims[s])).join('·');
  }
  const denPart = denSyms.map(s => atomStr(s, -u.dims[s])).join('·');
  return denPart ? (numPart || '1') + '/' + denPart : numPart;
}

function uomCombineDims(a, b, sign){
  const dims = Object.assign({}, a.dims);
  Object.keys(b.dims).forEach(k => {
    dims[k] = (dims[k] || 0) + sign * b.dims[k];
    if(dims[k] === 0) delete dims[k];
  });
  return dims;
}
export function uomMultiply(a, b){ return (a && b) ? { scale: a.scale * b.scale, dims: uomCombineDims(a, b, 1) } : null; }
export function uomDivide(a, b){ return (a && b) ? { scale: a.scale / b.scale, dims: uomCombineDims(a, b, -1) } : null; }
export function uomDimsEqual(a, b){
  const ak = Object.keys(a.dims), bk = Object.keys(b.dims);
  return ak.length === bk.length && ak.every(k => a.dims[k] === b.dims[k]);
}

