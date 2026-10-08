// ============================================================
// Built-in .xlsx writer — replaces the external xlsx-js-style library (no CDN, works
// offline). It implements exactly what this tool uses, with the same interface:
//   XLSX.utils.book_new(), XLSX.utils.book_append_sheet(wb, ws, name),
//   XLSX.writeFile(wb, fileName)   (download), XLSX.write(wb) -> Uint8Array (bytes)
// Worksheet object: { 'A1': cell, …, '!ref', '!cols': [{wch}], '!merges': [{s:{r,c},e:{r,c}}],
//   '!charts': [{ chart, from: {c, r}, to: {c, r} }] (charts placed between two cells, 0-based) }
// A chart tab: XLSX.utils.book_append_chartsheet(wb, chart, name). Charts: see chartXml.
// Cell: { t:'s'|'n'|'z', v, f (formula, no leading '='), z (number format), s (style) }
//   t:'s' with f  -> a formula with a text result;  t:'z' -> an empty cell (style only).
//   dataTable: { ref, r1, r2 } on a Data Table's top-left cell (see dataTableXml); its value
//   v is written too, as are the plain numbers of the table's other cells.
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
  // A Data Table's definition, { ref: 'N21:X25', r1: 'C7', r2: 'C6' } (two inputs: r1 the
  // cell the top row's values go into, r2 the one the left column's go into), or
  // { ref, r1, row: true|false } with one input (the values along the top row, or down the
  // left column). Anything not shaped like that is no table (null).
  const RANGE = /^[A-Z]{1,3}[1-9]\d{0,6}:[A-Z]{1,3}[1-9]\d{0,6}$/, ADDR = /^[A-Z]{1,3}[1-9]\d{0,6}$/;
  function dataTableXml(t){
    if(!t || typeof t !== 'object' || !RANGE.test(t.ref) || !ADDR.test(t.r1)) return null;
    if(t.r2 !== undefined){
      if(!ADDR.test(t.r2)) return null;
      return '<f t="dataTable" ref="' + t.ref + '" dt2D="1" dtr="1" r1="' + t.r1 + '" r2="' + t.r2 + '"/>';
    }
    return '<f t="dataTable" ref="' + t.ref + '"' + (t.row ? ' dtr="1"' : '') + ' r1="' + t.r1 + '"/>';
  }
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
      const dt = dataTableXml(cell.dataTable);
      if(dt){
        // The top-left cell of an Excel Data Table (What-If Analysis): the whole table's
        // definition, plus its own value; the table's other cells hold only values.
        xml = '<c r="' + addr + '"' + sAttr + '>' + dt + (cell.t === 'n' && typeof cell.v === 'number' && isFinite(cell.v) ? '<v>' + cell.v + '</v>' : '') + '</c>';
      } else if(hasFormula){
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
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
      (chartsOn(ws).length ? '<drawing r:id="rId1"/>' : '') + '</worksheet>';
  }
  // The charts placed on a worksheet: [{ chart, from: { c, r }, to: { c, r } }] (0-based cells).
  function chartsOn(ws){ return Array.isArray(ws && ws['!charts']) ? ws['!charts'].filter(x => x && x.chart && typeof x.chart === 'object') : []; }
  // A chart tab: { '!chartsheet': true, '!chart': chart } (book_append_chartsheet).
  function isChartsheet(ws){ return !!(ws && ws['!chartsheet'] && ws['!chart'] && typeof ws['!chart'] === 'object'); }
  function chartsheetXml(){
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<chartsheet xmlns="' + NS_MAIN + '" xmlns:r="' + NS_REL + '"><sheetPr/><sheetViews><sheetView zoomToFit="1" workbookViewId="0"/></sheetViews>' +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><drawing r:id="rId1"/></chartsheet>';
  }

  // ---------- charts ----------
  // A chart (plain data, so a workbook stays JSON):
  //   { type: 'bar' | 'line', title: { ref, text },
  //     bar: { dir: 'bar' | 'col', overlap, gapWidth },
  //     catAxis: { title, reverse }, valAxis: { title, numFmt },
  //     legend: 'b' | 'r' | 't' | null,
  //     series: [{ name: { ref, text }, cat: { ref, values: [text|number], numFmt? },
  //                val: { ref, values: [number|null], numFmt? }, color: 'RRGGBB', marker: bool }] }
  // `ref` is a cell or range on a sheet ("'Sensitivity'!$B$16:$B$20"); `text` / `values` are
  // what it holds now (Excel shows them until it recalculates). A ref not shaped like that
  // leaves the text or values standing alone.
  const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const REF = /^(?:'(?:[^'\u0000-\u001f]|'')+'|[A-Za-z0-9_.]+)!\$?[A-Z]{1,3}\$?[1-9]\d{0,6}(?::\$?[A-Z]{1,3}\$?[1-9]\d{0,6})?$/;
  const goodRef = (r) => typeof r === 'string' && REF.test(r);
  const hex = (c) => /^[0-9A-Fa-f]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : null;
  const finite = (v) => typeof v === 'number' && isFinite(v);
  function richText(text, rot){
    return '<c:tx><c:rich><a:bodyPr' + (rot ? ' rot="-5400000" vert="horz"' : '') + '/><a:lstStyle/><a:p><a:pPr><a:defRPr/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>' + esc(text) + '</a:t></a:r></a:p></c:rich></c:tx>';
  }
  function strRef(src){
    const cache = '<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + esc(src && src.text != null ? src.text : '') + '</c:v></c:pt></c:strCache>';
    return goodRef(src && src.ref) ? '<c:strRef><c:f>' + esc(src.ref) + '</c:f>' + cache + '</c:strRef>' : null;
  }
  function titleXml(t, rot){
    if(!t) return '';
    if(typeof t === 'string') return '<c:title>' + richText(t, rot) + '<c:overlay val="0"/></c:title>';
    const sr = strRef(t);
    if(sr) return '<c:title><c:tx>' + sr + '</c:tx><c:overlay val="0"/></c:title>';
    return t.text ? '<c:title>' + richText(t.text, rot) + '<c:overlay val="0"/></c:title>' : '';
  }
  function numData(src, tag){
    const vals = Array.isArray(src && src.values) ? src.values : [];
    const pts = vals.map((v, i) => finite(v) ? '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>' : '').join('');
    const cache = '<c:numCache><c:formatCode>' + esc((src && src.numFmt) || 'General') + '</c:formatCode><c:ptCount val="' + vals.length + '"/>' + pts + '</c:numCache>';
    if(goodRef(src && src.ref)) return '<' + tag + '><c:numRef><c:f>' + esc(src.ref) + '</c:f>' + cache + '</c:numRef></' + tag + '>';
    return '<' + tag + '><c:numLit>' + cache.slice('<c:numCache>'.length, -'</c:numCache>'.length) + '</c:numLit></' + tag + '>';
  }
  function catData(src){
    const vals = Array.isArray(src && src.values) ? src.values : [];
    if(vals.every(v => finite(v) || v === null) && vals.some(finite)) return numData(src, 'c:cat');
    const pts = vals.map((v, i) => '<c:pt idx="' + i + '"><c:v>' + esc(v == null ? '' : v) + '</c:v></c:pt>').join('');
    const cache = '<c:ptCount val="' + vals.length + '"/>' + pts;
    if(goodRef(src && src.ref)) return '<c:cat><c:strRef><c:f>' + esc(src.ref) + '</c:f><c:strCache>' + cache + '</c:strCache></c:strRef></c:cat>';
    return '<c:cat><c:strLit>' + cache + '</c:strLit></c:cat>';
  }
  function seriesXml(s, i, type){
    const color = hex(s.color);
    const fill = color ? '<a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill>' : '';
    const sp = type === 'line'
      ? '<c:spPr><a:ln w="22225" cap="rnd">' + fill + '<a:round/></a:ln></c:spPr>'
      : (fill ? '<c:spPr>' + fill + '</c:spPr>' : '');
    const name = s.name ? (strRef(s.name) ? '<c:tx>' + strRef(s.name) + '</c:tx>' : '<c:tx><c:v>' + esc(s.name.text || '') + '</c:v></c:tx>') : '';
    const marker = type === 'line' ? (s.marker === false ? '<c:marker><c:symbol val="none"/></c:marker>'
      : '<c:marker><c:symbol val="circle"/><c:size val="5"/>' + (fill ? '<c:spPr>' + fill + '</c:spPr>' : '') + '</c:marker>') : '';
    return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>' + name + sp +
      (type === 'bar' ? '<c:invertIfNegative val="0"/>' : marker) +
      catData(s.cat) + numData(s.val, 'c:val') + (type === 'line' ? '<c:smooth val="0"/>' : '') + '</c:ser>';
  }
  function chartXml(ch){
    const type = ch.type === 'line' ? 'line' : 'bar';
    const series = (Array.isArray(ch.series) ? ch.series : []).map((s, i) => seriesXml(s || {}, i, type)).join('');
    const bar = ch.bar || {};
    const cat = ch.catAxis || {}, val = ch.valAxis || {};
    const horizontal = type === 'bar' && bar.dir !== 'col';
    const plot = type === 'bar'
      ? '<c:barChart><c:barDir val="' + (horizontal ? 'bar' : 'col') + '"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + series +
        '<c:gapWidth val="' + Math.max(0, Math.min(500, Math.round(Number(bar.gapWidth)) || 150)) + '"/>' +
        '<c:overlap val="' + Math.max(-100, Math.min(100, Math.round(Number(bar.overlap)) || 0)) + '"/>' +
        '<c:axId val="1001"/><c:axId val="1002"/></c:barChart>'
      : '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + series + '<c:marker val="1"/><c:axId val="1001"/><c:axId val="1002"/></c:lineChart>';
    // The categories: on the left of a horizontal bar chart (reversed: the first at the top,
    // the values' axis at the bottom); along the bottom otherwise.
    const catAx = '<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="' + (cat.reverse ? 'maxMin' : 'minMax') + '"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="' + (horizontal ? 'l' : 'b') + '"/>' + titleXml(cat.title, horizontal) +
      '<c:numFmt formatCode="' + esc(cat.numFmt || 'General') + '" sourceLinked="' + (cat.numFmt ? 0 : 1) + '"/>' +
      '<c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>' +
      '<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>';
    const valAx = '<c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>' +
      '<c:axPos val="' + (horizontal ? 'b' : 'l') + '"/><c:majorGridlines/>' + titleXml(val.title, !horizontal) +
      '<c:numFmt formatCode="' + esc(val.numFmt || 'General') + '" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="1001"/><c:crosses val="' + (cat.reverse ? 'max' : 'autoZero') + '"/><c:crossBetween val="between"/></c:valAx>';
    const legend = ['b', 'r', 't', 'l'].includes(ch.legend) ? '<c:legend><c:legendPos val="' + ch.legend + '"/><c:overlay val="0"/></c:legend>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<c:chartSpace xmlns:c="' + NS_C + '" xmlns:a="' + NS_A + '" xmlns:r="' + NS_REL + '"><c:roundedCorners val="0"/>' +
      '<c:chart>' + titleXml(ch.title) + '<c:autoTitleDeleted val="' + (ch.title ? 0 : 1) + '"/><c:plotArea><c:layout/>' + plot + catAx + valAx + '</c:plotArea>' +
      legend + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
  }
  // A drawing: the charts on a worksheet (each between two cells, 0-based) or one filling a
  // chart tab. `ids` are the drawing's relationship ids for its charts.
  function graphicFrame(id, rid){
    return '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (id + 1) + '" name="Chart ' + id + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
      '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="' + NS_C + '">' +
      '<c:chart xmlns:c="' + NS_C + '" r:id="' + rid + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/>';
  }
  function drawingXml(anchors){
    const cellIdx = (n, max) => Math.max(0, Math.min(max, Math.round(Number(n)) || 0));
    const body = anchors.map((a, i) => {
      if(a.whole) return '<xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="9300000" cy="6000000"/>' + graphicFrame(i + 1, 'rId' + (i + 1)) + '</xdr:absoluteAnchor>';
      const f = a.from || {}, t = a.to || {};
      const pt = (p) => '<xdr:col>' + cellIdx(p.c, 16383) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + cellIdx(p.r, 1048575) + '</xdr:row><xdr:rowOff>0</xdr:rowOff>';
      return '<xdr:twoCellAnchor><xdr:from>' + pt(f) + '</xdr:from><xdr:to>' + pt(t) + '</xdr:to>' + graphicFrame(i + 1, 'rId' + (i + 1)) + '</xdr:twoCellAnchor>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="' + NS_XDR + '" xmlns:a="' + NS_A + '" xmlns:r="' + NS_REL + '">' + body + '</xdr:wsDr>';
  }
  function relsXml(list){
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="' + NS_PKG_REL + '">' +
      list.map((r, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + REL_BASE + r.type + '" Target="' + r.target + '"/>').join('') + '</Relationships>';
  }

  // ---------- package ----------
  function buildParts(wb){
    if(!wb || !Array.isArray(wb.SheetNames) || !wb.SheetNames.length) throw new Error('The workbook has no sheets.');
    const styles = makeStyleTable();
    const n = wb.SheetNames.length;
    // Worksheets and chart tabs, each numbered in its own folder; then each one's drawing (if
    // it has charts) and the charts themselves.
    let wsCount = 0, csCount = 0, drawingCount = 0, chartCount = 0;
    const extra = [], overrides = [];
    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name] || {};
      const chartsheet = isChartsheet(ws);
      const sheet = chartsheet
        ? { path: 'xl/chartsheets/sheet' + (++csCount) + '.xml', xml: chartsheetXml(), type: 'chartsheet', ct: 'spreadsheetml.chartsheet+xml' }
        : { path: 'xl/worksheets/sheet' + (++wsCount) + '.xml', xml: sheetXml(ws, styles), type: 'worksheet', ct: 'spreadsheetml.worksheet+xml' };
      const anchors = chartsheet ? [{ whole: true, chart: ws['!chart'] }] : chartsOn(ws);
      if(anchors.length){
        const d = ++drawingCount;
        const dir = sheet.path.slice(0, sheet.path.lastIndexOf('/'));
        extra.push({ path: dir + '/_rels/' + sheet.path.slice(dir.length + 1) + '.rels', xml: relsXml([{ type: 'drawing', target: '../drawings/drawing' + d + '.xml' }]) });
        extra.push({ path: 'xl/drawings/drawing' + d + '.xml', xml: drawingXml(anchors) });
        overrides.push(['/xl/drawings/drawing' + d + '.xml', 'drawing+xml']);
        const charts = anchors.map(a => {
          const k = ++chartCount;
          extra.push({ path: 'xl/charts/chart' + k + '.xml', xml: chartXml(a.chart) });
          overrides.push(['/xl/charts/chart' + k + '.xml', 'drawingml.chart+xml']);
          return { type: 'chart', target: '../charts/chart' + k + '.xml' };
        });
        extra.push({ path: 'xl/drawings/_rels/drawing' + d + '.xml.rels', xml: relsXml(charts) });
      }
      return sheet;
    });
    const parts = [];
    parts.push({ path: '[Content_Types].xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(s => '<Override PartName="/' + s.path + '" ContentType="application/vnd.openxmlformats-officedocument.' + s.ct + '"/>').join('') +
      overrides.map(([part, ct]) => '<Override PartName="' + part + '" ContentType="application/vnd.openxmlformats-officedocument.' + ct + '"/>').join('') +
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
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + REL_BASE + s.type + '" Target="' + s.path.slice(3) + '"/>').join('') +
      '<Relationship Id="rId' + (n + 1) + '" Type="' + REL_BASE + 'styles" Target="styles.xml"/>' +
      '</Relationships>' });
    sheets.forEach(s => parts.push({ path: s.path, xml: s.xml }));
    extra.forEach(x => parts.push(x));
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
      book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
      // A chart tab holding one chart (see chartXml).
      book_append_chartsheet: (wb, chart, name) => { wb.SheetNames.push(name); wb.Sheets[name] = { '!chartsheet': true, '!chart': chart }; }
    },
    write, writeFile
  };
})();
