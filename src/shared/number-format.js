// ---------- numbers on the canvas (shared: src/shared/number-format.js; fmIDE's canvas and the showcase viewer) ----------
// How fmIDE writes a value on its canvas: plainly (formatNum), or in a rectangle's number
// format (General, Number, Percent, Currency), and a period shift's label. Moved out of fmIDE
// (01-setup-commands-keys.js, 02-uom-format-roles.js) unchanged for the showcase viewer
// (phase V1 of docs/viewer-brief.md). fmIDE still chooses which format applies
// (formatNumForNode); this only writes the number.

// A number as fmIDE shows it without a format: up to six decimals, "?" for none.
export function formatNum(v){
  if(v === null || v === undefined || !isFinite(v)) return '?';
  const r = Math.round(v * 1e6) / 1e6;
  return r.toString();
}

// A number in a number format ({ kind, decimals, currencySymbol }); none, or General, is
// formatNum's. "?" for no number. A value that rounds to zero at the shown decimals (−0, or
// −0.00001 at one decimal) is written as zero, with no minus sign, as Excel writes it.
export function formatByNumberFormat(v, fmt){
  if(v === null || v === undefined || !isFinite(v)) return '?';
  if(!fmt || !fmt.kind || fmt.kind === 'general') return formatNum(v);
  const decimals = (typeof fmt.decimals === 'number') ? fmt.decimals : 2;
  if(fmt.kind === 'percent'){
    return unsignedZero(v * 100, x => x.toFixed(decimals)) + '%';
  }
  const local = x => x.toLocaleString(undefined, { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
  if(fmt.kind === 'currency'){
    return (fmt.currencySymbol || '$') + unsignedZero(v, local);
  }
  if(fmt.kind === 'number'){
    return unsignedZero(v, local);
  }
  return formatNum(v);
}

// write(v), or write(0) when what it writes shows no digit but 0: never "-0.0".
function unsignedZero(v, write){
  const text = write(v);
  return /[1-9]/.test(text) ? text : write(0);
}

// A period shift's label: t, t+1, t−1.
export function shiftLabel(offset){
  if(offset > 0) return 't+' + offset;
  if(offset < 0) return 't−' + Math.abs(offset);
  return 't';
}
