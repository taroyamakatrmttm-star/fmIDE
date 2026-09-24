// 1. Excel output — structure and fidelity: what the app intended (window.__wb) is exactly
// what ends up in the .xlsx file.
const { test, expect } = require('./helpers/apps');
const X = require('./helpers/excel');
const { MODELS, INPUTS_MODES } = require('./helpers/models');

const BORDER_STYLES = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double', 'hair'];
const SIDES = ['top', 'bottom', 'left', 'right'];

function argb(rgb){
  const h = String(rgb || '').replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? 'FF' + h : (/^[0-9A-F]{8}$/.test(h) ? h : null);
}
const normFmt = (z) => (!z || z === 'General') ? 'General' : z;

// What the app intended for one cell, in comparable form.
function intended(cell){
  const s = cell.s || {}, font = s.font || {}, border = s.border || {};
  const hasFormula = typeof cell.f === 'string' && cell.f !== '';
  let value = null;
  if(!hasFormula){
    if(cell.t === 'n' && typeof cell.v === 'number') value = cell.v;
    else if(cell.t === 'b') value = cell.v;
    else if((cell.t === 's' || cell.t === 'str') && cell.v !== undefined && cell.v !== null && String(cell.v) !== '') value = String(cell.v);
  }
  return {
    formula: hasFormula ? cell.f.replace(/^=/, '') : null,
    value,
    fill: (s.fill && s.fill.fgColor && argb(s.fill.fgColor.rgb)) || null,
    fontColor: (font.color && argb(font.color.rgb)) || null,
    bold: !!font.bold,
    size: Number(font.sz) > 0 ? Number(font.sz) : 11,
    borders: SIDES.filter(k => border[k] && BORDER_STYLES.includes(border[k].style)),
    numFmt: normFmt(cell.z),
  };
}

// The same properties as read back from the file by exceljs.
function actual(xc){
  const v = xc.value;
  const isFormula = v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v);
  const fill = xc.fill && xc.fill.type === 'pattern' && xc.fill.pattern === 'solid' && xc.fill.fgColor ? xc.fill.fgColor.argb : null;
  const font = xc.font || {};
  const border = xc.border || {};
  return {
    formula: isFormula ? v.formula : null,
    value: isFormula ? null : (v === undefined ? null : v),
    fill: fill || null,
    fontColor: (font.color && font.color.argb) || null,
    bold: !!font.bold,
    size: font.size || 11,
    borders: SIDES.filter(k => border[k] && border[k].style),
    numFmt: normFmt(xc.numFmt),
  };
}

for(const model of MODELS){
  for(const inputsOn of INPUTS_MODES){
    test(`${model} — Inputs tab ${inputsOn ? 'on' : 'off'}`, async ({ page }) => {
      await X.openExporter(page);
      await X.loadFixtureModel(page, model);
      await X.setInputsTab(page, inputsOn);
      const { wb, bytes } = await X.generate(page);

      // 1. A valid ZIP whose XML parts are all well-formed.
      const parts = await X.unzip(bytes);
      expect(Object.keys(parts)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml']));
      const xmlReport = await page.evaluate((ps) => {
        const bad = [], cached = [], emptyText = [];
        let fullCalc = null;
        for(const [name, xml] of Object.entries(ps)){
          if(!/\.(xml|rels)$/.test(name)) continue;
          const doc = new DOMParser().parseFromString(xml, 'application/xml');
          if(doc.getElementsByTagName('parsererror').length){ bad.push(name); continue; }
          if(name === 'xl/workbook.xml'){
            const calc = doc.getElementsByTagName('calcPr')[0];
            fullCalc = calc ? calc.getAttribute('fullCalcOnLoad') : null;
          }
          if(name.startsWith('xl/worksheets/')){
            for(const c of doc.getElementsByTagName('c')){
              if(c.getElementsByTagName('f').length && c.getElementsByTagName('v').length) cached.push(name + ':' + c.getAttribute('r'));
              const t = c.getAttribute('t');
              if((t === 'inlineStr' || t === 's' || t === 'str') && !c.getElementsByTagName('f').length && c.textContent === '') emptyText.push(name + ':' + c.getAttribute('r'));
            }
          }
        }
        return { bad, cached, emptyText, fullCalc };
      }, parts);
      expect(xmlReport.bad, 'malformed XML parts').toEqual([]);

      // 4. Recalculate on open; formulas carry no cached value.
      expect(['1', 'true']).toContain(xmlReport.fullCalc);
      expect(xmlReport.cached, 'formula cells with a cached value').toEqual([]);

      // 3. No empty text strings (in the file XML, the intended workbook, or as read back).
      expect(xmlReport.emptyText, 'empty text cells').toEqual([]);

      // 2. Read back and compare every intended cell.
      const book = await X.readBack(bytes);
      expect(book.worksheets.map(w => w.name)).toEqual(wb.SheetNames);
      const mismatches = [];
      for(const name of wb.SheetNames){
        const ws = wb.Sheets[name], xs = book.getWorksheet(name);
        for(const addr of X.cellAddrs(ws)){
          const cell = ws[addr];
          const want = intended(cell);
          const { row, col } = X.splitAddr(addr);
          const xc = xs.findCell(row, col);
          const styled = want.fill || want.fontColor || want.bold || want.size !== 11 || want.borders.length ||
            want.numFmt !== 'General' || !!(cell.s && cell.s.alignment && Object.keys(cell.s.alignment).length);
          if(!xc){
            // Only cells with no value, no formula and no style may be left out.
            if(want.formula !== null || want.value !== null || styled) mismatches.push(`${name}!${addr}: missing from the file`);
            continue;
          }
          const got = actual(xc);
          if(cell.t === 'z' && got.value !== null) mismatches.push(`${name}!${addr}: empty cell has value ${JSON.stringify(got.value)}`);
          if(got.value === '') mismatches.push(`${name}!${addr}: empty text string`);
          for(const k of Object.keys(want)){
            if(JSON.stringify(want[k]) !== JSON.stringify(got[k])) mismatches.push(`${name}!${addr} ${k}: intended ${JSON.stringify(want[k])}, file has ${JSON.stringify(got[k])}`);
          }
        }
        // Nothing in the file that the app didn't intend (exceljs adds filler cells inside merges).
        xs.eachRow({ includeEmpty: false }, (r) => r.eachCell({ includeEmpty: false }, (xc) => {
          if(!ws[xc.address] && !xc.isMerged) mismatches.push(`${name}!${xc.address}: in the file but not intended`);
        }));
        // Column widths = wch + 0.71.
        (ws['!cols'] || []).forEach((c, i) => {
          if(!c || !(Number(c.wch) > 0)) return;
          const width = xs.getColumn(i + 1).width;
          if(Math.abs(width - (Number(c.wch) + 0.71)) > 0.006) mismatches.push(`${name} column ${X.numToCol(i + 1)} width ${width}, expected ${Number(c.wch) + 0.71}`);
        });
        // Merged ranges.
        const wantMerges = (ws['!merges'] || []).map(m => X.numToCol(m.s.c + 1) + (m.s.r + 1) + ':' + X.numToCol(m.e.c + 1) + (m.e.r + 1)).sort();
        const gotMerges = (xs.model.merges || []).slice().sort();
        if(JSON.stringify(wantMerges) !== JSON.stringify(gotMerges)) mismatches.push(`${name} merges: intended ${wantMerges}, file has ${gotMerges}`);
        // No empty strings in the intended workbook either.
        for(const addr of X.cellAddrs(ws)){
          const c = ws[addr];
          if((c.t === 's' || c.t === 'str') && !X.formulaOf(c) && c.v === '') mismatches.push(`${name}!${addr}: intended as an empty text string`);
        }
      }
      expect(mismatches, mismatches.slice(0, 50).join('\n')).toEqual([]);
    });
  }
}
