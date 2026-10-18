// ---------- importing an Excel model: the zip (src/excel-exporter/import/zip.js; step 20b) ----------
// An .xlsx file is a zip archive of XML parts. This reads the zip's central directory and
// unpacks one part at a time, stored or deflated, with the browser's own
// DecompressionStream('deflate-raw') (Node 18+ has it too) — no library. Every size is
// checked against XL_LIMITS while unpacking, so a part that unpacks to far more than it
// claims (a "zip bomb") is stopped before it fills the memory. Nothing in the file runs.
// Every top-level name starts with xl: the build puts these modules into ExcelExporter's one
// wrapped function, beside the rest of the app.

// The limits on a workbook that is imported (docs/step20-excel-import.md, "Safety").
export const XL_LIMITS = {
  fileBytes: 50 * 1024 * 1024,      // the .xlsx itself
  partBytes: 100 * 1024 * 1024,     // one part, unpacked
  totalBytes: 200 * 1024 * 1024,    // every part read, unpacked
  parts: 10000,                     // entries in the zip
  sheets: 64,
  cells: 200000,                    // cells holding a number, text or formula, in all
  formulaChars: 8192,               // Excel's own limit
  nesting: 64,                      // brackets and function calls inside each other
};

// An error the person is shown: `code` for tests, `message` in plain words.
export class XlImportError extends Error {
  constructor(code, message){ super(message); this.name = 'XlImportError'; this.code = code; }
}

const XL_OLE_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

function xlU16(b, i){ return b[i] | (b[i + 1] << 8); }
function xlU32(b, i){ return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000; }

// The entries of a zip: [{ name, method, flags, compressedSize, size, offset }].
export function xlZipEntries(bytes){
  if(!(bytes instanceof Uint8Array)) throw new XlImportError('not-a-file', 'This is not a file.');
  if(bytes.length > XL_LIMITS.fileBytes) throw new XlImportError('too-big', 'This file is larger than 50 MB, the most an import reads.');
  if(XL_OLE_SIGNATURE.every((v, i) => bytes[i] === v)){
    throw new XlImportError('old-or-protected', 'This is an old Excel file (.xls) or a password-protected workbook. Open it in Excel and save it as an .xlsx workbook without a password, then import that.');
  }
  // The end of central directory record: within the last 65,557 bytes (22 + a comment).
  let eocd = -1;
  for(let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--){
    if(bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06){ eocd = i; break; }
  }
  if(eocd < 0) throw new XlImportError('not-xlsx', 'This is not an Excel workbook (.xlsx): it is not a zip file.');
  const count = xlU16(bytes, eocd + 10);
  const dirOffset = xlU32(bytes, eocd + 16);
  if(count === 0xFFFF || dirOffset === 0xFFFFFFFF) throw new XlImportError('not-xlsx', 'This workbook uses a zip form (zip64) the import does not read.');
  if(count > XL_LIMITS.parts) throw new XlImportError('too-many-parts', 'This file has more than ' + XL_LIMITS.parts + ' parts.');
  const entries = [];
  let p = dirOffset;
  const decoder = new TextDecoder('utf-8');
  for(let k = 0; k < count; k++){
    if(p + 46 > bytes.length || xlU32(bytes, p) !== 0x02014B50) throw new XlImportError('broken', 'This workbook is damaged: its list of parts can\'t be read.');
    const flags = xlU16(bytes, p + 8), method = xlU16(bytes, p + 10);
    const compressedSize = xlU32(bytes, p + 20), size = xlU32(bytes, p + 24);
    const nameLen = xlU16(bytes, p + 28), extraLen = xlU16(bytes, p + 30), commentLen = xlU16(bytes, p + 32);
    const offset = xlU32(bytes, p + 42);
    if(p + 46 + nameLen > bytes.length) throw new XlImportError('broken', 'This workbook is damaged: its list of parts can\'t be read.');
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, flags, compressedSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// A budget shared by every part read from one file: { used }.
export function xlZipBudget(){ return { used: 0 }; }

// One entry's bytes, unpacked, within the limits (budget: xlZipBudget()).
export async function xlZipRead(bytes, entry, budget){
  if(entry.flags & 1) throw new XlImportError('old-or-protected', 'This workbook is password-protected. Save it without a password in Excel, then import it.');
  const h = entry.offset;
  if(h + 30 > bytes.length || xlU32(bytes, h) !== 0x04034B50) throw new XlImportError('broken', 'This workbook is damaged: a part can\'t be found.');
  const start = h + 30 + xlU16(bytes, h + 26) + xlU16(bytes, h + 28);
  const end = start + entry.compressedSize;
  if(end > bytes.length) throw new XlImportError('broken', 'This workbook is damaged: a part is cut short.');
  const raw = bytes.subarray(start, end);
  const allow = Math.min(XL_LIMITS.partBytes, XL_LIMITS.totalBytes - budget.used);
  const tooBig = () => new XlImportError('too-big', 'This workbook unpacks to more than the import reads (' + (XL_LIMITS.partBytes / 1048576) + ' MB a part, ' + (XL_LIMITS.totalBytes / 1048576) + ' MB in all).');
  let out;
  if(entry.method === 0){
    if(raw.length > allow) throw tooBig();
    out = raw.slice();
  } else if(entry.method === 8){
    out = await xlInflate(raw, allow, tooBig);
  } else {
    throw new XlImportError('broken', 'This workbook packs its parts in a way the import does not read.');
  }
  budget.used += out.length;
  return out;
}

// Deflated bytes unpacked, stopping as soon as they pass `allow`.
async function xlInflate(raw, allow, tooBig){
  if(typeof DecompressionStream !== 'function') throw new XlImportError('no-unzip', 'This browser can\'t unpack workbooks. Use a current Chrome, Edge, Firefox or Safari.');
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(raw).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;
  try{
    for(;;){
      const { done, value } = await reader.read();
      if(done) break;
      total += value.length;
      if(total > allow){ reader.cancel().catch(() => {}); throw tooBig(); }
      chunks.push(value);
    }
  } catch(e){
    if(e instanceof XlImportError) throw e;
    throw new XlImportError('broken', 'This workbook is damaged: a part can\'t be unpacked.');
  }
  const out = new Uint8Array(total);
  let at = 0;
  for(const c of chunks){ out.set(c, at); at += c.length; }
  return out;
}
