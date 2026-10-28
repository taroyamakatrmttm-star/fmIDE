// ---------- writing a few input cells into a prebuilt workbook (shared: src/shared/xlsx-patch.js) ----------
// The showcase viewer's ⬇ Excel (phase V4 of docs/viewer-brief.md): a viewer carries the
// workbook its author made, and writes the visitor's scenario and slider values into its input
// cells before handing it over. An .xlsx is a zip of XML parts; this reads the zip, finds a
// sheet's part through the workbook's own list of sheets, replaces each named cell with a
// number or TRUE / FALSE (nothing else is ever written, and no formula is touched), and packs
// the zip again (every part stored, with its check number worked out again).
//
// New code, written from the zip and Office Open XML descriptions (APPNOTE.TXT, ECMA-376):
// nothing here comes from ExcelExporter's writer or its import, which are ExcelExporter's
// (test group 95 checks no line was copied). The workbook may come from anyone, so the zip is
// read with limits (sizes, counts, how far a part may unpack: a "zip bomb" is a tiny file that
// unpacks to gigabytes), and every refusal is an XlsxPatchError with a code and plain words.
// Runs in the browser and in Node 22 (DecompressionStream, Blob, TextEncoder).

export const XLSX_PATCH_LIMITS = { bytes: 60 * 1024 * 1024, entries: 2000, part: 50 * 1024 * 1024, total: 100 * 1024 * 1024,
  ratio: 200, name: 260, writes: 400 };

export class XlsxPatchError extends Error {
  constructor(code, message){ super(message); this.name = 'XlsxPatchError'; this.code = code; }
}
const refuse = (code, message) => { throw new XlsxPatchError(code, message); };

// ---- the check number each zip part carries (CRC-32, the polynomial 0xEDB88320) ----
let crcTable = null;
export function crc32Of(bytes){
  if(!crcTable){
    crcTable = new Int32Array(256);
    for(let k = 0; k < 256; k++){
      let r = k;
      for(let bit = 8; bit > 0; bit--) r = (r & 1) === 1 ? (r >>> 1) ^ 0xEDB88320 : r >>> 1;
      crcTable[k] = r;
    }
  }
  let sum = -1;
  for(let at = 0; at < bytes.length; at++) sum = crcTable[(sum ^ bytes[at]) & 255] ^ (sum >>> 8);
  return (~sum) >>> 0;
}

// ---- reading ----
const LOCAL_SIG = 0x04034b50, CENTRAL_SIG = 0x02014b50, END_SIG = 0x06054b50;

// A deflated part unpacked by the browser's own DecompressionStream, stopping as soon as it
// passes the size it says it has (so a lying header can't fill the memory).
async function inflatePart(packed, size, name){
  if(typeof DecompressionStream !== 'function') refuse('no-inflate', 'This browser can\'t unpack the workbook. Use a current Chrome, Edge, Firefox or Safari.');
  const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const out = new Uint8Array(size);
  let filled = 0;
  try{
    for(;;){
      const step = await reader.read();
      if(step.done) break;
      const chunk = step.value;
      if(filled + chunk.length > size){ reader.cancel().catch(() => {}); refuse('size', 'A part of the workbook (' + name + ') unpacks to more than it says.'); }
      out.set(chunk, filled);
      filled += chunk.length;
    }
  }catch(err){
    if(err instanceof XlsxPatchError) throw err;
    refuse('inflate', 'A part of the workbook (' + name + ') could not be unpacked.');
  }
  if(filled !== size) refuse('size', 'A part of the workbook (' + name + ') is not the size it says.');
  return out;
}

// A part's name as the zip holds it: a path inside the workbook, never outside it.
function checkedName(raw){
  const name = new TextDecoder('utf-8').decode(raw);
  const bad = !name || name.length > XLSX_PATCH_LIMITS.name || name.startsWith('/') || name.includes('\\') ||
    /[\u0000-\u001f]/.test(name) || name.split('/').some(seg => seg === '..' || seg === '.');
  if(bad) refuse('name', 'The workbook holds a part with a name it shouldn\'t have.');
  return name;
}

// The zip's parts, in its order: a Promise of [{ name, data (Uint8Array, unpacked), time, date }].
export async function zipEntriesOf(input, limits){
  const L = Object.assign({}, XLSX_PATCH_LIMITS, limits || {});
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if(bytes.length < 22) refuse('short', 'That is not a workbook: it is too short.');
  if(bytes.length > L.bytes) refuse('big', 'The workbook is too big to open here.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record sits in the last 22 bytes, or before a comment of at most 65,535.
  let end = -1;
  for(let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at--){
    if(view.getUint32(at, true) === END_SIG){ end = at; break; }
  }
  if(end < 0) refuse('not-zip', 'That is not a workbook (no zip directory).');
  const count = view.getUint16(end + 10, true), dirSize = view.getUint32(end + 12, true), dirAt = view.getUint32(end + 16, true);
  if(count === 0xFFFF || dirAt === 0xFFFFFFFF || dirSize === 0xFFFFFFFF) refuse('zip64', 'The workbook uses the large-zip form (ZIP64), which isn\'t read here.');
  if(view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 8, true) !== count) refuse('split', 'The workbook is split over several files.');
  if(count > L.entries) refuse('entries', 'The workbook holds too many parts.');
  if(dirAt + dirSize > end) refuse('directory', 'The workbook\'s zip directory is damaged.');
  const found = [], names = new Set();
  let at = dirAt, total = 0;
  for(let i = 0; i < count; i++){
    if(at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIG) refuse('directory', 'The workbook\'s zip directory is damaged.');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true);
    const time = view.getUint16(at + 12, true), date = view.getUint16(at + 14, true);
    const crc = view.getUint32(at + 16, true), packedSize = view.getUint32(at + 20, true), size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true), extraLen = view.getUint16(at + 30, true), noteLen = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    if(at + 46 + nameLen > end) refuse('directory', 'The workbook\'s zip directory is damaged.');
    const name = checkedName(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + noteLen;
    if(names.has(name)) refuse('twice', 'The workbook holds the same part twice.');
    names.add(name);
    if(flags & 1) refuse('encrypted', 'The workbook is protected with a password.');
    if(packedSize === 0xFFFFFFFF || size === 0xFFFFFFFF || localAt === 0xFFFFFFFF) refuse('zip64', 'The workbook uses the large-zip form (ZIP64), which isn\'t read here.');
    if(method !== 0 && method !== 8) refuse('method', 'The workbook is packed in a way that isn\'t read here.');
    if(size > L.part) refuse('big', 'A part of the workbook is too big.');
    total += size;
    if(total > L.total) refuse('big', 'The workbook unpacks to too much.');
    if(method === 0 && packedSize !== size) refuse('size', 'A part of the workbook is not the size it says.');
    if(method === 8 && size > Math.max(1024, packedSize * L.ratio)) refuse('bomb', 'A part of the workbook unpacks to far more than its size: it isn\'t opened.');
    if(localAt + 30 > dirAt || view.getUint32(localAt, true) !== LOCAL_SIG) refuse('local', 'A part of the workbook is damaged.');
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    if(dataAt + packedSize > dirAt) refuse('local', 'A part of the workbook is damaged.');
    found.push({ name, method, crc, size, time, date, from: localAt, dataAt, to: dataAt + packedSize });
  }
  // No two parts may share bytes (a trick that makes a small file unpack many times).
  const spans = found.slice().sort((a, b) => a.from - b.from);
  for(let i = 1; i < spans.length; i++) if(spans[i].from < spans[i - 1].to) refuse('overlap', 'The workbook\'s parts overlap.');
  const entries = [];
  for(const f of found){
    const packed = bytes.subarray(f.dataAt, f.to);
    const data = f.method === 0 ? packed.slice() : await inflatePart(packed, f.size, f.name);
    if(crc32Of(data) !== f.crc) refuse('crc', 'A part of the workbook (' + f.name + ') is damaged: its check number is wrong.');
    entries.push({ name: f.name, data, time: f.time, date: f.date });
  }
  return entries;
}

// ---- writing: every part stored, in the order given, with its check number ----
export function zipFrom(entries){
  const enc = new TextEncoder();
  const pieces = [], directory = [];
  let offset = 0;
  const header = (size) => { const b = new Uint8Array(size); return { b, v: new DataView(b.buffer) }; };
  entries.forEach(e => {
    const name = enc.encode(e.name), data = e.data, crc = crc32Of(data);
    const time = Number.isInteger(e.time) ? e.time & 0xFFFF : 0, date = Number.isInteger(e.date) ? e.date & 0xFFFF : 0x21;
    const local = header(30);
    local.v.setUint32(0, LOCAL_SIG, true); local.v.setUint16(4, 20, true); local.v.setUint16(6, 0x0800, true);
    local.v.setUint16(8, 0, true); local.v.setUint16(10, time, true); local.v.setUint16(12, date, true);
    local.v.setUint32(14, crc, true); local.v.setUint32(18, data.length, true); local.v.setUint32(22, data.length, true);
    local.v.setUint16(26, name.length, true); local.v.setUint16(28, 0, true);
    pieces.push(local.b, name, data);
    const dir = header(46);
    dir.v.setUint32(0, CENTRAL_SIG, true); dir.v.setUint16(4, 20, true); dir.v.setUint16(6, 20, true); dir.v.setUint16(8, 0x0800, true);
    dir.v.setUint16(10, 0, true); dir.v.setUint16(12, time, true); dir.v.setUint16(14, date, true); dir.v.setUint32(16, crc, true);
    dir.v.setUint32(20, data.length, true); dir.v.setUint32(24, data.length, true); dir.v.setUint16(28, name.length, true);
    dir.v.setUint32(42, offset, true);
    directory.push(dir.b, name);
    offset += local.b.length + name.length + data.length; // the next part's header starts here
  });
  const dirSize = directory.reduce((n, b) => n + b.length, 0);
  const last = header(22);
  last.v.setUint32(0, END_SIG, true); last.v.setUint16(8, entries.length, true); last.v.setUint16(10, entries.length, true);
  last.v.setUint32(12, dirSize, true); last.v.setUint32(16, offset, true);
  const all = pieces.concat(directory, [last.b]);
  const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
  let p = 0;
  all.forEach(b => { out.set(b, p); p += b.length; });
  return out;
}

// ---- the XML: a small tag reader (no DOM, so it runs in Node too) ----
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
function xmlUnescape(s){
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e) => {
    if(e[0] === '#'){ const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m; }
    return Object.prototype.hasOwnProperty.call(XML_ENTITIES, e) ? XML_ENTITIES[e] : m;
  });
}
// Every start tag named `tag` (with any prefix) in the text, from `from` to `to`:
// [{ at, end (after its >), closed (/>), attrs: { name: value } }].
function tagsNamed(text, tag, from, to){
  const out = [];
  const stop = to === undefined ? text.length : to;
  let i = from || 0;
  for(;;){
    i = text.indexOf('<', i);
    if(i < 0 || i >= stop) break;
    let j = i + 1;
    while(j < text.length && /[A-Za-z0-9_:.-]/.test(text[j])) j++;
    const full = text.slice(i + 1, j);
    const local = full.includes(':') ? full.slice(full.lastIndexOf(':') + 1) : full;
    if(local !== tag || !full){ i = j; continue; }
    const attrs = {};
    let k = j, closed = false;
    for(;;){
      while(k < text.length && /\s/.test(text[k])) k++;
      if(k >= text.length) refuse('xml', 'A part of the workbook is not well formed.');
      if(text[k] === '>'){ k++; break; }
      if(text[k] === '/' && text[k + 1] === '>'){ k += 2; closed = true; break; }
      let n = k;
      while(n < text.length && /[A-Za-z0-9_:.-]/.test(text[n])) n++;
      const name = text.slice(k, n);
      while(n < text.length && /\s/.test(text[n])) n++;
      if(!name || text[n] !== '=') refuse('xml', 'A part of the workbook is not well formed.');
      n++;
      while(n < text.length && /\s/.test(text[n])) n++;
      const quote = text[n];
      if(quote !== '"' && quote !== '\'') refuse('xml', 'A part of the workbook is not well formed.');
      const close = text.indexOf(quote, n + 1);
      if(close < 0) refuse('xml', 'A part of the workbook is not well formed.');
      attrs[name] = xmlUnescape(text.slice(n + 1, close));
      k = close + 1;
    }
    out.push({ at: i, end: k, closed, attrs, tag: full });
    i = k;
  }
  return out;
}
const attrLocal = (attrs, local) => { const k = Object.keys(attrs).find(a => a === local || a.endsWith(':' + local)); return k === undefined ? undefined : attrs[k]; };

function partText(entries, name){
  const e = entries.find(x => x.name === name);
  return e ? new TextDecoder('utf-8').decode(e.data) : null;
}
// A target in a relationships part, from the folder of the part that has it.
function resolveTarget(base, target){
  if(target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  target.split('/').forEach(seg => { if(seg === '..') parts.pop(); else if(seg && seg !== '.') parts.push(seg); });
  return parts.join('/');
}
function relsOf(entries, partName){
  const folder = partName.split('/').slice(0, -1).join('/');
  const file = partName.split('/').pop();
  const text = partText(entries, (folder ? folder + '/' : '') + '_rels/' + file + '.rels');
  if(text === null) return [];
  return tagsNamed(text, 'Relationship').map(t => ({ id: t.attrs.Id, type: t.attrs.Type || '', target: t.attrs.Target ? resolveTarget(partName, t.attrs.Target) : '' }));
}

// The part holding the sheet named `sheetName`, found through the workbook's own list.
export function sheetPartOf(entries, sheetName){
  const rootRels = partText(entries, '_rels/.rels');
  let book = 'xl/workbook.xml';
  if(rootRels !== null){
    const office = tagsNamed(rootRels, 'Relationship').find(t => /\/officeDocument$/.test(t.attrs.Type || ''));
    if(office && office.attrs.Target) book = resolveTarget('', office.attrs.Target);
  }
  const bookText = partText(entries, book);
  if(bookText === null) refuse('no-book', 'The workbook has no list of sheets.');
  const sheet = tagsNamed(bookText, 'sheet').find(t => t.attrs.name === sheetName);
  if(!sheet) refuse('no-sheet', 'The workbook has no sheet named “' + String(sheetName).slice(0, 40) + '”.');
  const rid = attrLocal(sheet.attrs, 'id');
  const rel = relsOf(entries, book).find(r => r.id === rid);
  if(!rel || !rel.target || !entries.some(e => e.name === rel.target)) refuse('no-sheet', 'The sheet “' + String(sheetName).slice(0, 40) + '” can\'t be found in the workbook.');
  return rel.target;
}

// A cell's address, A1 to XFD1048576, upper case; else null.
export function xlsxCellAddress(v){
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(String(v || '').trim().toUpperCase());
  if(!m) return null;
  let col = 0;
  for(const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]);
  return col <= 16384 && row <= 1048576 ? m[1] + m[2] : null;
}
const xmlAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// The sheet's XML with each cell in `writes` ([{ cell, value: number | boolean }]) replaced: a
// number as <v>, TRUE / FALSE as t="b"; the cell keeps its style (s), anything else it held is
// gone. Every cell must be in the sheet already. Nothing else changes.
export function writeCellsInSheet(xml, writes){
  const open = tagsNamed(xml, 'sheetData')[0];
  if(!open) refuse('xml', 'The sheet holds no cells.');
  const close = open.closed ? open.end : xml.indexOf('</' + open.tag + '>', open.end);
  if(close < 0) refuse('xml', 'The sheet is not well formed.');
  const cells = new Map();
  tagsNamed(xml, 'c', open.end, close).forEach(t => {
    const r = xlsxCellAddress(t.attrs.r);
    if(!r) return;
    let end = t.end;
    if(!t.closed){
      const shut = xml.indexOf('</' + t.tag + '>', t.end);
      if(shut < 0 || shut > close) refuse('xml', 'The sheet is not well formed.');
      end = shut + t.tag.length + 3;
    }
    cells.set(r, { at: t.at, end, tag: t.tag, style: t.attrs.s });
  });
  const changes = [];
  const seen = new Set();
  writes.forEach(w => {
    const r = xlsxCellAddress(w.cell);
    if(!r) refuse('address', 'A cell to write is not an address.');
    if(seen.has(r)) refuse('twice', 'The same cell is written twice.');
    seen.add(r);
    const c = cells.get(r);
    if(!c) refuse('no-cell', 'The cell ' + r + ' is not in the sheet.');
    let body;
    if(typeof w.value === 'boolean') body = ' t="b"><v>' + (w.value ? 1 : 0) + '</v>';
    else if(typeof w.value === 'number' && Number.isFinite(w.value)) body = '><v>' + String(w.value) + '</v>';
    else refuse('value', 'Only a number or TRUE / FALSE is written into a cell.');
    const v = c.tag.includes(':') ? c.tag.slice(0, c.tag.lastIndexOf(':') + 1) + 'v' : 'v';
    if(v !== 'v') body = body.replace(/<v>/, '<' + v + '>').replace(/<\/v>/, '</' + v + '>');
    const style = c.style !== undefined ? ' s="' + xmlAttr(c.style) + '"' : '';
    changes.push({ at: c.at, end: c.end, text: '<' + c.tag + ' r="' + r + '"' + style + body + '</' + c.tag + '>' });
  });
  changes.sort((a, b) => b.at - a.at);
  let out = xml;
  changes.forEach(ch => { out = out.slice(0, ch.at) + ch.text + out.slice(ch.end); });
  return out;
}

// The workbook with `writes` ([{ sheet, cell, value }]) made: a Promise of { bytes } or
// { error, code }. All or nothing.
export async function patchXlsx(bytes, writes, limits){
  try{
    const list = Array.isArray(writes) ? writes : [];
    if(list.length > XLSX_PATCH_LIMITS.writes) refuse('writes', 'Too many cells to write.');
    const entries = await zipEntriesOf(bytes, limits);
    const bySheet = new Map();
    list.forEach(w => {
      if(!w || typeof w.sheet !== 'string' || !w.sheet) refuse('sheet', 'A cell to write names no sheet.');
      if(!bySheet.has(w.sheet)) bySheet.set(w.sheet, []);
      bySheet.get(w.sheet).push(w);
    });
    const enc = new TextEncoder();
    bySheet.forEach((ws, sheet) => {
      const part = sheetPartOf(entries, sheet);
      const e = entries.find(x => x.name === part);
      e.data = enc.encode(writeCellsInSheet(new TextDecoder('utf-8').decode(e.data), ws));
    });
    return { bytes: zipFrom(entries) };
  }catch(err){
    if(err instanceof XlsxPatchError) return { error: err.message, code: err.code };
    return { error: 'The workbook could not be written.', code: 'failed' };
  }
}
