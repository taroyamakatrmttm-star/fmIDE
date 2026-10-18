// ---------- importing an Excel model: the layout (src/excel-exporter/import/layout.js; step 20d) ----------
// What each sheet of a workbook read by xlReadWorkbook (and xlFillSharedFormulas) holds:
// the header row of periods, the period columns, the label and unit columns, and each row's
// kind (docs/step20-excel-import.md, "How a spreadsheet is read"):
//   title       a label and nothing in the periods or before them
//   input       a typed number in the periods (a formula among them keeps its saved value)
//   assumption  one typed number before the period columns, used by every period
//   calculation a formula in the periods, the same along the row (its signature)
//   opening     a typed number in the first period, then the same formula
//   single      one formula before the period columns
//   parts       the row changes along the periods in up to four runs, each typed numbers (or
//               blank) or one formula copied along: actuals typed, then a forecast formula; or
//               one formula for the actual years and another for the forecast (`parts`)
// A formula's signature is its text moved to the first period column: two cells of a row
// with the same signature hold the same formula, copied along. Cells that differ are `odd`.
// The person can change the header row, the period columns and the label and unit columns
// (the confirm screen); xlAnalyseSheet(sheet, choice) works the sheet out again with them.

import { xlParseFormula, xlShiftFormula, xlFormulaText } from './formula.js';
import { xlAddress, xlColLetters, xlSerialToDate } from './workbook.js';

const XL_HEADER_SEARCH_ROWS = 50;
const XL_PERIOD_TEXT = /(?:^|[^0-9])(?:19|20|21)[0-9]{2}(?:[^0-9]|$)|^(?:FY|CY|Q[1-4]|H[12]|P(?:eriod)?\s*[0-9]+|Y(?:ea)?r?\s*[0-9]+|M(?:onth)?\s*[0-9]+)\b|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-.']*[0-9]{2,4}$/i;

// A header cell as a period: { kind: 'year' | 'date' | 'text', value } or null.
function xlPeriodOf(cell){
  if(!cell || cell.error) return null;
  const v = cell.value;
  if(typeof v === 'number'){
    if(cell.date) return { kind: 'date', value: v };
    if(Number.isInteger(v) && v >= 1900 && v <= 2200) return { kind: 'year', value: v };
    return null;
  }
  if(typeof v === 'string'){
    const t = v.trim();
    return t && t.length <= 40 && XL_PERIOD_TEXT.test(t) ? { kind: 'text', value: t } : null;
  }
  return null;
}

// The period columns a header row holds: the longest run of two or more cells side by side
// that read as periods, of one kind, numbers rising. { firstCol, lastCol } or null.
function xlPeriodRun(sheet, row){
  let best = null, start = 0, prev = null;
  const close = (end) => {
    if(start && end - start + 1 >= 2 && (!best || end - start > best.lastCol - best.firstCol)) best = { firstCol: start, lastCol: end };
  };
  for(let col = 1; col <= sheet.cols + 1; col++){
    const p = col <= sheet.cols ? xlPeriodOf(sheet.cells.get(xlAddress(col, row))) : null;
    const continues = p && prev && p.kind === prev.kind && (p.kind === 'text' || p.value > prev.value);
    if(continues){ prev = p; continue; }
    close(col - 1);
    start = p ? col : 0;
    prev = p;
  }
  return best;
}

// The header row: the first row (of the first 50) holding the longest run of periods.
export function xlFindHeader(sheet){
  let best = null;
  const last = Math.min(sheet.rows, XL_HEADER_SEARCH_ROWS);
  for(let row = 1; row <= last; row++){
    const run = xlPeriodRun(sheet, row);
    if(run && (!best || run.lastCol - run.firstCol > best.lastCol - best.firstCol)) best = { row, ...run };
  }
  return best;
}

// The periods' names, from the header cells: years as "2026"; dates as their year when each
// is in a year of its own, else "2026-03"; text as written.
export function xlPeriodLabels(sheet, headerRow, firstCol, lastCol, date1904){
  const ps = [];
  for(let col = firstCol; col <= lastCol; col++) ps.push(xlPeriodOf(sheet.cells.get(xlAddress(col, headerRow))));
  const dates = ps.map(p => p && p.kind === 'date' ? xlSerialToDate(p.value, date1904) : null);
  const years = dates.map(d => d ? d.getUTCFullYear() : null);
  const yearsUnique = new Set(years.filter(y => y !== null)).size === years.filter(y => y !== null).length;
  return ps.map((p, i) => {
    if(!p){
      const c = sheet.cells.get(xlAddress(firstCol + i, headerRow));
      const v = c && c.value !== null ? String(c.value).trim().slice(0, 40) : '';
      return v || xlColLetters(firstCol + i);
    }
    if(p.kind === 'year') return String(p.value);
    if(p.kind === 'text') return p.value;
    const d = dates[i];
    return yearsUnique ? String(d.getUTCFullYear()) : d.toISOString().slice(0, 7);
  });
}

const xlIsText = (c) => !!c && typeof c.value === 'string' && c.formula === null && c.value.trim() !== '';
const xlIsFormula = (c) => !!c && (c.formula !== null || !!c.unreadable);
const xlIsNumber = (c) => !!c && c.formula === null && !c.unreadable && typeof c.value === 'number';

// The label and unit columns, left of the periods: the label column holds the most text
// (the leftmost of equals); the unit column, short text, the most of the others.
function xlFindLabelColumns(sheet, headerRow, firstCol){
  const counts = [];
  for(let col = 1; col < firstCol; col++){
    let n = 0, len = 0;
    for(const c of sheet.cells.values()){
      if(c.col === col && c.row !== headerRow && xlIsText(c)){ n++; len += c.value.trim().length; }
    }
    counts.push({ col, n, avg: n ? len / n : 0 });
  }
  const label = counts.filter(c => c.n).sort((a, b) => b.n - a.n || a.col - b.col)[0];
  const unit = counts.filter(c => c.n && (!label || c.col !== label.col) && c.avg <= 12).sort((a, b) => b.n - a.n || a.col - b.col)[0];
  return { labelCol: label ? label.col : null, unitCol: unit ? unit.col : null };
}

// A formula's signature: its text as if it were in the first period column.
export function xlSignature(cell, firstCol){
  if(!cell.formula) return '!unreadable ' + cell.address;
  try{ return xlFormulaText(xlShiftFormula(xlParseFormula(cell.formula), 0, firstCol - cell.col)); }
  catch(e){ return '!unreadable ' + cell.address; }
}

// One sheet worked out. `choice` (from the confirm screen) may fix headerRow, firstCol,
// lastCol, labelCol and unitCol (null for none). The result:
// { name, hidden, byPeriods, headerRow, firstCol, lastCol, labelCol, unitCol, periods,
//   rows: [{ row, label, unit, kind, signature, formula, odd, cells, before }], sections }.
export function xlAnalyseSheet(sheet, choice, date1904){
  const ch = choice || {};
  let header = null;
  if(ch.headerRow){
    const run = ch.firstCol && ch.lastCol ? { firstCol: ch.firstCol, lastCol: ch.lastCol } : xlPeriodRun(sheet, ch.headerRow);
    if(run && run.lastCol >= run.firstCol) header = { row: ch.headerRow, firstCol: run.firstCol, lastCol: run.lastCol };
  } else header = xlFindHeader(sheet);
  const plan = { name: sheet.name, hidden: sheet.hidden, byPeriods: !!header, headerRow: header ? header.row : null,
    firstCol: header ? header.firstCol : null, lastCol: header ? header.lastCol : null, labelCol: null, unitCol: null, periods: [], rows: [], sections: [] };
  if(!header) return plan;
  const found = xlFindLabelColumns(sheet, header.row, header.firstCol);
  plan.labelCol = ch.labelCol !== undefined ? ch.labelCol : found.labelCol;
  plan.unitCol = ch.unitCol !== undefined ? ch.unitCol : found.unitCol;
  if(plan.unitCol === plan.labelCol) plan.unitCol = null;
  plan.periods = xlPeriodLabels(sheet, header.row, header.firstCol, header.lastCol, date1904);

  const byRow = new Map();
  for(const c of sheet.cells.values()){
    if(!byRow.has(c.row)) byRow.set(c.row, []);
    byRow.get(c.row).push(c);
  }
  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b);
  for(const r of rowNumbers){
    if(r === header.row) continue;
    const at = (col) => col ? sheet.cells.get(xlAddress(col, r)) : undefined;
    const labelCell = at(plan.labelCol), unitCell = at(plan.unitCol);
    const label = labelCell && labelCell.value !== null && labelCell.formula === null ? String(labelCell.value).trim()
      : (labelCell && typeof labelCell.value === 'string' ? labelCell.value.trim() : '');
    const unit = unitCell && typeof unitCell.value === 'string' ? unitCell.value.trim() : '';
    const cells = [];
    for(let col = header.firstCol; col <= header.lastCol; col++){
      const c = at(col);
      cells.push(c ? c : { col, row: r, address: xlAddress(col, r), value: null, error: null, formula: null, empty: true });
    }
    // Before the periods: a number or formula outside the label and unit columns.
    let before = null;
    for(let col = 1; col < header.firstCol; col++){
      if(col === plan.labelCol || col === plan.unitCol) continue;
      const c = at(col);
      if(c && (xlIsFormula(c) || xlIsNumber(c))){ before = c; break; }
    }
    const nForm = cells.filter(xlIsFormula).length, nNum = cells.filter(xlIsNumber).length;
    const row = { row: r, label, unit, kind: 'title', signature: null, formula: null, odd: [], cells, before };
    if(!nForm && !nNum){
      if(before) row.kind = xlIsFormula(before) ? 'single' : 'assumption';
      else if(!label) continue;
      plan.rows.push(row);
      continue;
    }
    // In parts: actuals typed, then a forecast formula (or two formulas, one after the other).
    const runs = xlRuns(cells, header.firstCol);
    if(xlIsParts(runs)){
      row.kind = 'parts';
      row.parts = runs.map(r => ({ from: r.from, to: r.to, typed: r.typed, signature: r.signature, formula: r.typed ? null : cells[r.from].formula }));
      const last = runs.filter(r => !r.typed).pop();
      row.signature = last.signature;
      row.formula = runs.map(r => (r.from === r.to ? plan.periods[r.from] : plan.periods[r.from] + '–' + plan.periods[r.to]) + ': ' + (r.typed ? 'typed' : cells[r.from].formula)).join('; ');
      plan.rows.push(row);
      continue;
    }
    if(nForm <= nNum && nNum > 0 && !(nForm && xlIsNumber(cells[0]) && nForm === cells.length - 1)){
      row.kind = 'input';
      row.odd = cells.filter(c => !xlIsNumber(c) && !c.empty).map(c => c.address);
      plan.rows.push(row);
      continue;
    }
    // Formulas: the most common signature is the row's formula.
    const tally = new Map();
    cells.forEach(c => { if(xlIsFormula(c)){ const s = xlSignature(c, header.firstCol); c.signature = s; tally.set(s, (tally.get(s) || 0) + 1); } });
    let sig = null, most = 0;
    for(const [s, n] of tally) if(n > most && !s.startsWith('!')){ sig = s; most = n; }
    row.signature = sig;
    row.formula = sig;
    const fits = (c) => xlIsFormula(c) && c.signature === sig;
    if(sig !== null && xlIsNumber(cells[0]) && cells.slice(1).every(fits)) row.kind = 'opening';
    else row.kind = 'calculation';
    row.odd = cells.filter((c, i) => !(fits(c) || (row.kind === 'opening' && i === 0))).map(c => c.address);
    plan.rows.push(row);
  }
  plan.sections = xlSections(plan, new Set(rowNumbers));
  return plan;
}

// A sheet's sections, for one canvas each: the titles with at least two empty rows above
// them (with fewer than two such, those with one), [{ row, label }] in order, or [] when
// there aren't two. Rows before the first are a section of their own, named after their
// first title (or the sheet), from row 1.
export const XL_SECTION_MIN_ROWS = 40; // a sheet with more rows than this is split by default
function xlSections(plan, used){
  const titles = plan.rows.filter(r => r.kind === 'title' && r.label);
  const blanksAbove = (r) => { let n = 0; while(n < 2 && r - n - 1 >= 1 && !used.has(r - n - 1) && r - n - 1 !== plan.headerRow) n++; return n; };
  for(const need of [2, 1]){
    const heads = titles.filter(t => blanksAbove(t.row) >= need);
    if(heads.length < 2) continue;
    const out = heads.map(t => ({ row: t.row, label: t.label }));
    const before = plan.rows.filter(r => r.row < out[0].row);
    if(before.some(r => r.kind !== 'title')){
      const first = before.find(r => r.kind === 'title' && r.label);
      out.unshift({ row: 1, label: first ? first.label : plan.name });
    }
    return out;
  }
  return [];
}

// How many rows of a sheet become rectangles (all but titles).
export function xlRectangleRows(plan){ return plan.rows.filter(r => r.kind !== 'title').length; }

// A row's period cells as runs side by side: typed (a number, or blank) or one formula
// signature. [{ from, to, typed, signature }], period indices from 0.
function xlRuns(cells, firstCol){
  const runs = [];
  cells.forEach((c, i) => {
    let typed, sig = null;
    if(xlIsFormula(c)){ typed = false; sig = c.signature || xlSignature(c, firstCol); c.signature = sig; }
    else if(xlIsNumber(c) || c.empty || (c.value === null && !c.error)) typed = true;
    else { typed = false; sig = '!text ' + c.address; }
    const last = runs[runs.length - 1];
    if(last && last.typed === typed && last.signature === sig) last.to = i;
    else runs.push({ from: i, to: i, typed, signature: sig });
  });
  return runs;
}
// A row in parts: two to four runs, at least one a formula, none unreadable or text, each at
// least two periods long (the first may be one typed period, but not as an opening balance:
// a typed first period then one formula is that).
function xlIsParts(runs){
  if(runs.length < 2 || runs.length > 4) return false;
  if(runs.some(r => r.signature && r.signature.startsWith('!'))) return false;
  if(!runs.some(r => !r.typed)) return false;
  if(runs.length === 2 && runs[0].typed && runs[0].from === runs[0].to) return false;
  return runs.every((r, i) => r.to > r.from || (i === 0 && r.typed));
}

// Every sheet of a workbook worked out: { sheets: [plan], names, date1904, notes }. A sheet
// without a header row of periods is not imported unless the person picks one.
export function xlAnalyseWorkbook(book){
  return { sheets: book.sheets.map(s => xlAnalyseSheet(s, null, book.date1904)), names: book.names, date1904: book.date1904, notes: book.notes };
}

// How many rows of each kind a sheet's plan holds.
export function xlKindCounts(plan){
  const counts = { title: 0, input: 0, assumption: 0, calculation: 0, opening: 0, single: 0, parts: 0 };
  plan.rows.forEach(r => { counts[r.kind]++; });
  return counts;
}
