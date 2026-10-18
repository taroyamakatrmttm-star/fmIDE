// ---------- importing an Excel model: the workbook (src/excel-exporter/import/workbook.js; step 20b) ----------
// xlReadWorkbook(bytes) reads an .xlsx file into plain data: its sheets in order, each cell's
// saved value (number, text, true/false, error), its formula as written, whether its number
// format is a date, and the workbook's defined names. Nothing from the file runs: formulas
// are kept as text (import/formula.js reads them), macros are never opened. Every text is
// kept as text, for the window to show with textContent. Cell addresses are checked.

import { XL_LIMITS, XlImportError, xlZipEntries, xlZipBudget, xlZipRead } from './zip.js';
import { xlParseXml, xlChild, xlChildren, xlAttr } from './xml.js';

export const XL_MAX_ROW = 1048576;
export const XL_MAX_COL = 16384;

// Column letters to a number (A = 1) and back; 0 when not letters or past XFD.
export function xlColNumber(letters){
  if(!/^[A-Za-z]{1,3}$/.test(letters)) return 0;
  let n = 0;
  for(const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n <= XL_MAX_COL ? n : 0;
}
export function xlColLetters(n){
  let s = '';
  while(n > 0){ const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
// "B7" to { col: 2, row: 7 }; null when it isn't a cell address inside Excel's grid.
export function xlCellRef(addr){
  const m = /^([A-Za-z]{1,3})([1-9][0-9]{0,6})$/.exec(String(addr));
  if(!m) return null;
  const col = xlColNumber(m[1]), row = Number(m[2]);
  return col && row <= XL_MAX_ROW ? { col, row } : null;
}
export function xlAddress(col, row){ return xlColLetters(col) + row; }

// Excel's built-in number formats that show dates or times.
const XL_DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

// Excel's built-in number format codes (a file names them by id only).
const XL_BUILTIN_FORMATS = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00',
  12: '# ?/?', 13: '# ??/??', 14: 'mm-dd-yy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM',
  20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@' };

// Whether a number format's code shows a date or time: d, m, y, h or s outside quotes,
// brackets and escapes ([h] counts; [Red] and [$-409] don't).
export function xlIsDateFormat(code){
  if(typeof code !== 'string' || code === '' || /^general$/i.test(code)) return false;
  const s = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/_./g, '').replace(/\*./g, '')
    .replace(/\[(h+|m+|s+)\]/gi, 'h').replace(/\[[^\]]*\]/g, '');
  return /[dmyhs]/i.test(s.split(';')[0]);
}

// A part's path inside the zip from a relationship's target, relative to the part `from`.
function xlResolve(from, target){
  if(target.startsWith('/')) return target.slice(1);
  const parts = from.split('/'); parts.pop();
  for(const seg of target.split('/')){
    if(seg === '..') parts.pop();
    else if(seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}
function xlRelsPath(part){
  const k = part.lastIndexOf('/');
  return (k < 0 ? '' : part.slice(0, k + 1)) + '_rels/' + part.slice(k + 1) + '.rels';
}

// The text of a shared string or inline string: its <t>, or its runs' <t>s (phonetic
// guides, <rPh>, left out).
function xlStringText(si){
  const t = xlChild(si, 't');
  if(t && !xlChildren(si, 'r').length) return t.text;
  return xlChildren(si, 'r').map(r => { const rt = xlChild(r, 't'); return rt ? rt.text : ''; }).join('') || (t ? t.text : '');
}

// Reads the workbook: { sheets: [{ name, hidden, cells: Map(address → cell), rows, cols }],
// names: [{ name, ref, sheet (index of the sheet it belongs to, or null) }], date1904, notes }.
// A cell: { col, row, address, value (number | string | boolean | null), error (Excel's
// error text, as '#DIV/0!', or null), formula (text without '=', or null), shared ({ index,
// ref } on the cell holding a shared formula's text, { index } on the others), array (an
// array formula's range), dataTable (true for a Data Table's cell), date (its format shows a
// date), format (its number format code), look (its style's { bold, italic, color, fill,
// border: { top, bottom, left, right: { style, color } } }, colours #rrggbb or null) }.
export async function xlReadWorkbook(bytes){
  const entries = xlZipEntries(bytes);
  const byName = new Map(entries.map(e => [e.name, e]));
  const budget = xlZipBudget();
  const decoder = new TextDecoder('utf-8');
  const has = (name) => byName.has(name);
  const readText = async (name) => decoder.decode(await xlZipRead(bytes, byName.get(name), budget));
  const readXml = async (name) => xlParseXml(await readText(name));
  const notes = [];

  // The workbook part: from the package's relationships, else where Excel puts it.
  let wbPath = 'xl/workbook.xml';
  if(has('_rels/.rels')){
    const rels = await readXml('_rels/.rels');
    const office = xlChildren(rels, 'Relationship').find(r => /\/officeDocument$/.test(r.attrs.Type || ''));
    if(office && office.attrs.Target) wbPath = xlResolve('', office.attrs.Target);
  }
  if(!has(wbPath)) throw new XlImportError('not-xlsx', 'This is not an Excel workbook (.xlsx): it has no workbook part.');
  const wb = await readXml(wbPath);
  const pr = xlChild(wb, 'workbookPr');
  const date1904 = !!pr && /^(1|true)$/.test(pr.attrs.date1904 || '');

  // Its relationships: sheet id → part.
  const relTargets = new Map(), relTypes = new Map();
  if(has(xlRelsPath(wbPath))){
    const rels = await readXml(xlRelsPath(wbPath));
    for(const r of xlChildren(rels, 'Relationship')){
      if((r.attrs.TargetMode || '') === 'External') continue;
      relTargets.set(r.attrs.Id, xlResolve(wbPath, r.attrs.Target || ''));
      relTypes.set(r.attrs.Id, r.attrs.Type || '');
    }
  }
  if([...relTypes.values()].some(t => /\/externalLink$/.test(t))) notes.push('links to other workbooks: their saved values are kept');
  if(has('xl/vbaProject.bin')) notes.push('macros: not read, never run');

  // Shared strings.
  const sstPath = [...relTypes.entries()].filter(([, t]) => /\/sharedStrings$/.test(t)).map(([id]) => relTargets.get(id))[0]
    || (has('xl/sharedStrings.xml') ? 'xl/sharedStrings.xml' : null);
  const strings = [];
  if(sstPath && has(sstPath)){
    const sst = await readXml(sstPath);
    for(const si of xlChildren(sst, 'si')) strings.push(xlStringText(si));
  }

  // The theme's colours, for a style naming one (theme="1").
  const themePath = [...relTypes.entries()].filter(([, t]) => /\/theme$/.test(t)).map(([id]) => relTargets.get(id))[0]
    || (has('xl/theme/theme1.xml') ? 'xl/theme/theme1.xml' : null);
  const theme = themePath && has(themePath) ? xlThemeColours(await readXml(themePath)) : [];

  // Number formats: which style index shows a date, and each one's code; and each style's
  // look (bold, italic, text colour, fill, borders), for ExcelExporter's row formats.
  const stylesPath = [...relTypes.entries()].filter(([, t]) => /\/styles$/.test(t)).map(([id]) => relTargets.get(id))[0]
    || (has('xl/styles.xml') ? 'xl/styles.xml' : null);
  const xfFormats = [];
  if(stylesPath && has(stylesPath)){
    const st = await readXml(stylesPath);
    const codes = new Map();
    for(const f of xlChildren(xlChild(st, 'numFmts'), 'numFmt')) codes.set(Number(f.attrs.numFmtId), String(f.attrs.formatCode || ''));
    const fonts = xlChildren(xlChild(st, 'fonts'), 'font').map(f => ({
      bold: xlOn(xlChild(f, 'b')), italic: xlOn(xlChild(f, 'i')), color: xlColour(xlChild(f, 'color'), theme) }));
    const fills = xlChildren(xlChild(st, 'fills'), 'fill').map(f => {
      const p = xlChild(f, 'patternFill');
      return p && p.attrs.patternType === 'solid' ? xlColour(xlChild(p, 'fgColor'), theme) : null;
    });
    const borders = xlChildren(xlChild(st, 'borders'), 'border').map(b => {
      const out = {};
      for(const side of ['top', 'bottom', 'left', 'right']){
        const e = xlChild(b, side);
        if(e && e.attrs.style && e.attrs.style !== 'none') out[side] = { style: String(e.attrs.style), color: xlColour(xlChild(e, 'color'), theme) };
      }
      return out;
    });
    for(const xf of xlChildren(xlChild(st, 'cellXfs'), 'xf')){
      const id = Number(xf.attrs.numFmtId || 0);
      const code = codes.has(id) ? codes.get(id) : (XL_BUILTIN_FORMATS[id] || '');
      const font = fonts[Number(xf.attrs.fontId || 0)] || {};
      const look = { bold: !!font.bold, italic: !!font.italic, color: font.color || null,
        fill: fills[Number(xf.attrs.fillId || 0)] || null, border: borders[Number(xf.attrs.borderId || 0)] || {} };
      xfFormats.push({ code, date: codes.has(id) ? xlIsDateFormat(code) : XL_DATE_FORMAT_IDS.has(id), look });
    }
  }

  // The sheets, in the workbook's order. Chart sheets and others are left out, and noted.
  const sheetEls = xlChildren(xlChild(wb, 'sheets'), 'sheet');
  const worksheets = [];
  let skipped = 0;
  sheetEls.forEach((s, index) => {
    const id = xlAttr(s, 'id');
    const part = relTargets.get(id);
    if(!part || !/\/worksheet$/.test(relTypes.get(id) || '') || !has(part)){ skipped++; return; }
    worksheets.push({ index, name: String(s.attrs.name || ''), hidden: s.attrs.state === 'hidden' || s.attrs.state === 'veryHidden', part });
  });
  if(skipped) notes.push(skipped + (skipped === 1 ? ' chart or other sheet' : ' chart or other sheets') + ': left out');
  if(!worksheets.length) throw new XlImportError('no-sheets', 'This workbook has no worksheets to import.');
  if(worksheets.length > XL_LIMITS.sheets) throw new XlImportError('too-many-sheets', 'This workbook has ' + worksheets.length + ' sheets; an import reads at most ' + XL_LIMITS.sheets + '.');

  let cellCount = 0;
  const sheets = [];
  for(const ws of worksheets){
    const doc = await readXml(ws.part);
    const cells = new Map();
    let maxRow = 0, maxCol = 0, rowNo = 0;
    for(const rowEl of xlChildren(xlChild(doc, 'sheetData'), 'row')){
      const r = rowEl.attrs.r !== undefined ? Number(rowEl.attrs.r) : rowNo + 1;
      if(!Number.isInteger(r) || r < 1 || r > XL_MAX_ROW || r <= rowNo) throw new XlImportError('broken', 'This workbook is damaged: sheet “' + ws.name + '” has a row out of order.');
      rowNo = r;
      let colNo = 0;
      for(const c of xlChildren(rowEl, 'c')){
        let col;
        if(c.attrs.r !== undefined){
          const ref = xlCellRef(c.attrs.r);
          if(!ref || ref.row !== r) throw new XlImportError('broken', 'This workbook is damaged: sheet “' + ws.name + '” has a cell with an address that is not one.');
          col = ref.col;
        } else col = colNo + 1;
        if(col <= colNo || col > XL_MAX_COL) throw new XlImportError('broken', 'This workbook is damaged: sheet “' + ws.name + '” has a cell out of order.');
        colNo = col;
        const cell = xlReadCell(c, col, r, strings, xfFormats, date1904);
        if(cell.value === null && cell.error === null && cell.formula === null && !cell.shared) continue;
        if(++cellCount > XL_LIMITS.cells) throw new XlImportError('too-many-cells', 'This workbook has more than ' + XL_LIMITS.cells.toLocaleString('en') + ' cells with numbers, text or formulas, the most an import reads.');
        cells.set(cell.address, cell);
        if(r > maxRow) maxRow = r;
        if(col > maxCol) maxCol = col;
      }
    }
    sheets.push({ name: ws.name, hidden: ws.hidden, cells, rows: maxRow, cols: maxCol, workbookIndex: ws.index });
  }

  // Defined names (Excel's own, _xlnm., and hidden ones kept but marked).
  const names = [];
  for(const d of xlChildren(xlChild(wb, 'definedNames'), 'definedName')){
    const local = d.attrs.localSheetId !== undefined ? Number(d.attrs.localSheetId) : null;
    const k = local === null ? -1 : sheets.findIndex(s => s.workbookIndex === local);
    names.push({ name: String(d.attrs.name || ''), ref: d.text, sheet: k < 0 ? null : k, hidden: d.attrs.hidden === '1' || d.attrs.hidden === 'true' });
  }
  sheets.forEach(s => { delete s.workbookIndex; });
  return { sheets, names, date1904, notes };
}

const XL_ERRORS = new Set(['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA', '#SPILL!', '#CALC!', '#FIELD!', '#BLOCKED!', '#UNKNOWN!', '#BUSY!', '#CONNECT!', '#PYTHON!']);

// One <c> element as a cell.
function xlReadCell(c, col, row, strings, xfFormats, date1904){
  const t = c.attrs.t || 'n';
  const style = xfFormats[Number(c.attrs.s || 0)] || { code: 'General', date: false, look: null };
  const vEl = xlChild(c, 'v');
  const v = vEl ? vEl.text : null;
  let value = null, error = null;
  if(t === 's'){
    const k = Number(v);
    value = v !== null && Number.isInteger(k) && k >= 0 && k < strings.length ? strings[k] : null;
  } else if(t === 'inlineStr'){
    const is = xlChild(c, 'is');
    value = is ? xlStringText(is) : null;
  } else if(t === 'str'){
    value = v === null ? null : v;
  } else if(t === 'b'){
    value = v === null ? null : (v.trim() === '1' || v.trim() === 'true');
  } else if(t === 'e'){
    error = v !== null && XL_ERRORS.has(v.trim()) ? v.trim() : (v === null ? null : '#VALUE!');
  } else if(t === 'd'){
    value = v === null ? null : xlDateSerial(v, date1904);
  } else if(v !== null && v.trim() !== ''){
    const num = Number(v);
    value = Number.isFinite(num) ? num : null;
  }
  const fEl = xlChild(c, 'f');
  let formula = null, shared = null, array = null, dataTable = false;
  if(fEl){
    const ft = fEl.attrs.t || 'normal';
    if(fEl.text.length > XL_LIMITS.formulaChars) throw new XlImportError('formula-too-long', 'Cell ' + xlAddress(col, row) + ' has a formula longer than ' + XL_LIMITS.formulaChars + ' characters, more than Excel allows.');
    const text = fEl.text.trim() === '' ? null : fEl.text;
    if(ft === 'shared'){
      const si = Number(fEl.attrs.si);
      if(Number.isInteger(si) && si >= 0){
        shared = { index: si };
        if(text !== null){ formula = text; if(fEl.attrs.ref) shared.ref = fEl.attrs.ref; }
      } else formula = text;
    } else if(ft === 'array'){
      formula = text; array = fEl.attrs.ref || xlAddress(col, row);
    } else if(ft === 'dataTable'){
      dataTable = true;
    } else formula = text;
  }
  return { col, row, address: xlAddress(col, row), value, error, formula, shared, array, dataTable,
    date: typeof value === 'number' && style.date, format: style.code, look: style.look || null };
}

// ---------- a style's look ----------
// A font's <b/> or <i/>: on unless val says 0 or false.
function xlOn(el){ return !!el && el.attrs.val !== '0' && el.attrs.val !== 'false'; }

// Excel's first sixteen indexed colours (the rest, and 64, the automatic colour: none).
const XL_INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF'];

// The theme's colours by Excel's theme number: 0 light 1, 1 dark 1, 2 light 2, 3 dark 2,
// 4–9 the accents, 10 and 11 the links (the scheme lists the darks first). Each as RRGGBB.
export function xlThemeColours(doc){
  const find = (el, name) => { if(!el) return null; if(el.name === name) return el; for(const c of el.children){ const f = find(c, name); if(f) return f; } return null; };
  const scheme = find(doc, 'clrScheme');
  if(!scheme) return [];
  const hexOf = (name) => {
    const e = xlChild(scheme, name);
    const srgb = xlChild(e, 'srgbClr'), sys = xlChild(e, 'sysClr');
    const v = srgb ? srgb.attrs.val : sys ? sys.attrs.lastClr : null;
    return typeof v === 'string' && /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
  };
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(hexOf);
}

// A style's colour (<color rgb="FF0000FF"/>, theme="1" with a tint, indexed="12") as
// #rrggbb, or null (automatic, or one it can't tell).
export function xlColour(el, theme){
  if(!el) return null;
  let hex = null;
  const rgb = el.attrs.rgb;
  if(typeof rgb === 'string' && /^([0-9a-fA-F]{2})?[0-9a-fA-F]{6}$/.test(rgb)) hex = rgb.slice(-6);
  else if(el.attrs.theme !== undefined) hex = (theme || [])[Number(el.attrs.theme)] || null;
  else if(el.attrs.indexed !== undefined) hex = XL_INDEXED[Number(el.attrs.indexed)] || null;
  if(!hex) return null;
  const tint = Number(el.attrs.tint);
  if(Number.isFinite(tint) && tint !== 0) hex = xlTint(hex, Math.max(-1, Math.min(1, tint)));
  return '#' + hex.toLowerCase();
}

// A colour lightened (tint > 0) or darkened (< 0), as Excel does: on its lightness.
function xlTint(hex, tint){
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, sat = 0, l = (max + min) / 2;
  if(max !== min){
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const hue = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  let out;
  if(sat === 0) out = [l, l, l];
  else {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    out = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  }
  return out.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// An ISO date (t="d") as Excel's serial number.
function xlDateSerial(text, date1904){
  const ms = Date.parse(text.trim().replace(/Z?$/, 'Z'));
  if(!Number.isFinite(ms)) return null;
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return (ms - base) / 86400000;
}

// A serial number as a date (UTC), the workbook's 1900 or 1904 system.
export function xlSerialToDate(serial, date1904){
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.round(serial * 86400000));
}
