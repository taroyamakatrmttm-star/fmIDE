// ============================================================
// Built-in .xlsx writer — replaces the external xlsx-js-style library (no CDN, works
// offline). It implements exactly what this tool uses, with the same interface:
//   XLSX.utils.book_new(), XLSX.utils.book_append_sheet(wb, ws, name),
//   XLSX.writeFile(wb, fileName)   (download), XLSX.write(wb) -> Uint8Array (bytes)
// Worksheet object: { 'A1': cell, …, '!ref', '!cols': [{wch}], '!merges': [{s:{r,c},e:{r,c}}] }
// Cell: { t:'s'|'n'|'z', v, f (formula, no leading '='), z (number format), s (style) }
//   t:'s' with f  -> a formula with a text result;  t:'z' -> an empty cell (style only).
// Style: { font:{bold, sz, color:{rgb}}, fill:{patternType:'solid', fgColor:{rgb}},
//          border:{top|bottom|left|right:{style, color:{rgb}}}, alignment:{horizontal, vertical, wrapText} }
// Formulas are written without cached values and the workbook asks Excel to recalculate
// on open (fullCalcOnLoad), so every app shows live results — never stale zeros.
// The package is a standard ZIP (stored entries) of the Office Open XML parts.
// ============================================================
import { escapeXml } from '../../shared/escaping.js';
export var XLSX = (function(){
  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

  // build:include shared/escaping.js
  // XML text: escape markup characters and drop characters XML 1.0 forbids.
  function esc(s){ return escapeXml(s, true); }
  function colToNum(letters){ let n = 0; for(const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
  function numToCol(n){ let s = ''; while(n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function encodeCell(r, c){ return numToCol(c + 1) + (r + 1); } // 0-based -> "A1"
  function argb(rgb){ const h = String(rgb || '').replace('#', '').toUpperCase(); return /^[0-9A-F]{6}$/.test(h) ? 'FF' + h : (/^[0-9A-F]{8}$/.test(h) ? h : null); }

  // ---------- styles ----------
  const BUILTIN_NUMFMTS = { 'General': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '@': 49 };
  function makeStyleTable(){
    const fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'];
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const numFmts = []; // [{id, code}]
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const index = (list, xml) => { let i = list.indexOf(xml); if(i < 0){ list.push(xml); i = list.length - 1; } return i; };
    const xfIndex = new Map();
    function numFmtId(code){
      if(!code || code === 'General') return 0;
      if(BUILTIN_NUMFMTS[code] !== undefined) return BUILTIN_NUMFMTS[code];
      let e = numFmts.find(x => x.code === code);
      if(!e){ e = { id: 164 + numFmts.length, code }; numFmts.push(e); }
      return e.id;
    }
    function fontXml(f){
      if(!f) return null;
      const color = f.color && argb(f.color.rgb);
      if(!f.bold && !f.italic && !f.sz && !color) return null;
      return '<font>' + (f.bold ? '<b/>' : '') + (f.italic ? '<i/>' : '') +
        '<sz val="' + (Number(f.sz) > 0 ? Number(f.sz) : 11) + '"/>' + (color ? '<color rgb="' + color + '"/>' : '') +
        '<name val="Calibri"/><family val="2"/><scheme val="minor"/></font>';
    }
    function fillXml(fl){
      const color = fl && fl.fgColor && argb(fl.fgColor.rgb);
      if(!color) return null;
      return '<fill><patternFill patternType="solid"><fgColor rgb="' + color + '"/><bgColor indexed="64"/></patternFill></fill>';
    }
    function borderXml(b){
      if(!b) return null;
      const OK = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double', 'hair'];
      const side = (k) => {
        const e = b[k];
        if(!e || !OK.includes(e.style)) return '<' + k + '/>';
        const color = e.color && argb(e.color.rgb);
        return '<' + k + ' style="' + e.style + '">' + (color ? '<color rgb="' + color + '"/>' : '') + '</' + k + '>';
      };
      const xml = '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>';
      return xml === borders[0] ? null : xml;
    }
    function alignmentXml(a){
      if(!a) return '';
      const H = ['left', 'center', 'right', 'general', 'fill', 'justify', 'centerContinuous', 'distributed'];
      const V = ['top', 'center', 'bottom', 'justify', 'distributed'];
      let at = '';
      if(H.includes(a.horizontal)) at += ' horizontal="' + a.horizontal + '"';
      if(V.includes(a.vertical)) at += ' vertical="' + a.vertical + '"';
      if(a.wrapText) at += ' wrapText="1"';
      // Indent (Excel's Increase Indent): a whole number of steps, with left alignment.
      if(Number.isInteger(a.indent) && a.indent > 0 && a.indent <= 250){
        if(!H.includes(a.horizontal)) at += ' horizontal="left"';
        at += ' indent="' + a.indent + '"';
      }
      return at ? '<alignment' + at + '/>' : '';
    }
    // Style index for a cell's (style, number format) pair; 0 = default.
    function styleIndex(s, z){
      const fx = s && fontXml(s.font), flx = s && fillXml(s.fill), bx = s && borderXml(s.border);
      const ax = s ? alignmentXml(s.alignment) : '';
      const nf = numFmtId(z);
      if(!fx && !flx && !bx && !ax && !nf) return 0;
      const fontId = fx ? index(fonts, fx) : 0, fillId = flx ? index(fills, flx) : 0, borderId = bx ? index(borders, bx) : 0;
      const key = [nf, fontId, fillId, borderId, ax].join('|');
      if(xfIndex.has(key)) return xfIndex.get(key);
      const xml = '<xf numFmtId="' + nf + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' +
        (nf ? ' applyNumberFormat="1"' : '') + (fontId ? ' applyFont="1"' : '') + (fillId ? ' applyFill="1"' : '') +
        (borderId ? ' applyBorder="1"' : '') + (ax ? ' applyAlignment="1">' + ax + '</xf>' : '/>');
      xfs.push(xml);
      xfIndex.set(key, xfs.length - 1);
      return xfs.length - 1;
    }
    function toXml(){
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<styleSheet xmlns="' + NS_MAIN + '">' +
        (numFmts.length ? '<numFmts count="' + numFmts.length + '">' + numFmts.map(n => '<numFmt numFmtId="' + n.id + '" formatCode="' + esc(n.code) + '"/>').join('') + '</numFmts>' : '') +
        '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>' +
        '<fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
        '<borders count="' + borders.length + '">' + borders.join('') + '</borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
        '</styleSheet>';
    }
    return { styleIndex, toXml };
  }

  // ---------- one worksheet ----------
  function sheetXml(ws, styles){
    const rows = new Map(); // row number -> [{c, xml}]
    let maxR = 0, maxC = 0;
    Object.keys(ws).forEach(addr => {
      if(addr[0] === '!') return;
      const m = /^([A-Z]{1,3})(\d+)$/.exec(addr);
      if(!m) return;
      const cell = ws[addr];
      if(!cell) return;
      const c = colToNum(m[1]), r = Number(m[2]);
      const si = styles.styleIndex(cell.s, cell.z);
      const sAttr = si ? ' s="' + si + '"' : '';
      let xml = null;
      const hasFormula = typeof cell.f === 'string' && cell.f !== '';
      if(hasFormula){
        const f = cell.f.charAt(0) === '=' ? cell.f.slice(1) : cell.f;
        xml = '<c r="' + addr + '"' + sAttr + (cell.t === 's' ? ' t="str"' : '') + '><f>' + esc(f) + '</f></c>';
      } else if(cell.t === 'n' && typeof cell.v === 'number' && isFinite(cell.v)){
        xml = '<c r="' + addr + '"' + sAttr + '><v>' + cell.v + '</v></c>';
      } else if(cell.t === 'b' && typeof cell.v === 'boolean'){
        xml = '<c r="' + addr + '"' + sAttr + ' t="b"><v>' + (cell.v ? 1 : 0) + '</v></c>';
      } else if((cell.t === 's' || cell.t === 'str') && cell.v !== undefined && cell.v !== null && String(cell.v) !== ''){
        xml = '<c r="' + addr + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + esc(cell.v) + '</t></is></c>';
      } else if(si){
        xml = '<c r="' + addr + '"' + sAttr + '/>'; // empty cell that keeps its formatting
      }
      if(!xml) return;
      if(!rows.has(r)) rows.set(r, []);
      rows.get(r).push({ c, xml });
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    });
    const ref = ws['!ref'] && /^[A-Z]{1,3}\d+(:[A-Z]{1,3}\d+)?$/.test(ws['!ref']) ? ws['!ref'] : (maxR ? 'A1:' + numToCol(Math.max(maxC, 1)) + maxR : 'A1');
    let cols = '';
    if(Array.isArray(ws['!cols']) && ws['!cols'].length){
      cols = '<cols>' + ws['!cols'].map((col, i) => {
        if(!col || !(Number(col.wch) > 0)) return '';
        const width = Math.round((Number(col.wch) + 0.71) * 100) / 100;
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
      }).join('') + '</cols>';
      if(cols === '<cols></cols>') cols = '';
    }
    const rowXml = [...rows.keys()].sort((a, b) => a - b).map(r =>
      '<row r="' + r + '">' + rows.get(r).sort((a, b) => a.c - b.c).map(x => x.xml).join('') + '</row>').join('');
    let merges = '';
    if(Array.isArray(ws['!merges']) && ws['!merges'].length){
      const list = ws['!merges'].filter(m => m && m.s && m.e).map(m => '<mergeCell ref="' + encodeCell(m.s.r, m.s.c) + ':' + encodeCell(m.e.r, m.e.c) + '"/>');
      if(list.length) merges = '<mergeCells count="' + list.length + '">' + list.join('') + '</mergeCells>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
      '<dimension ref="' + ref + '"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + rowXml + '</sheetData>' + merges +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
  }

  // ---------- package ----------
  function buildParts(wb){
    if(!wb || !Array.isArray(wb.SheetNames) || !wb.SheetNames.length) throw new Error('The workbook has no sheets.');
    const styles = makeStyleTable();
    const n = wb.SheetNames.length;
    const sheets = wb.SheetNames.map((name, i) => ({ path: 'xl/worksheets/sheet' + (i + 1) + '.xml', xml: sheetXml(wb.Sheets[name] || {}, styles) }));
    const parts = [];
    parts.push({ path: '[Content_Types].xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(s => '<Override PartName="/' + s.path + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>' });
    parts.push({ path: '_rels/.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="' + NS_PKG_REL + '">' +
      '<Relationship Id="rId1" Type="' + REL_BASE + 'officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="' + REL_BASE + 'extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>' });
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    parts.push({ path: 'docProps/core.xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>fmIDE ExcelExporter</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>' });
    parts.push({ path: 'docProps/app.xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>fmIDE ExcelExporter</Application></Properties>' });
    parts.push({ path: 'xl/workbook.xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>' +
      wb.SheetNames.map((name, i) => '<sheet name="' + esc(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
      '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' });
    parts.push({ path: 'xl/_rels/workbook.xml.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="' + NS_PKG_REL + '">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + REL_BASE + 'worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (n + 1) + '" Type="' + REL_BASE + 'styles" Target="styles.xml"/>' +
      '</Relationships>' });
    sheets.forEach(s => parts.push(s));
    parts.push({ path: 'xl/styles.xml', xml: styles.toXml() });
    return parts;
  }

  // ---------- ZIP (stored entries) ----------
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(bytes){ let c = 0xFFFFFFFF; for(let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files){
    const enc = new TextEncoder();
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.path), data = enc.encode(f.xml), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true); cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0; all.forEach(b => { out.set(b, p); p += b.length; });
    return out;
  }

  function write(wb){ return zip(buildParts(wb)); }
  function writeFile(wb, fileName){
    const bytes = write(wb);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName || 'workbook.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; }
    },
    write, writeFile
  };
})();
