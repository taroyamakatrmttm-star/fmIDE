// ---------- importing an Excel model: the check (src/excel-exporter/import/check.js; step 20f) ----------
// xlCheckModel(system, report) calculates the imported model with the shared IR (the same
// calculation fmIDE and the rest of ExcelExporter use) and compares every cell of every row
// it translated from a formula (inputs and assumptions are Excel's own numbers) with the
// value Excel saved for it:
//   { compared, agree, differ: [{ sheet, address, label, period, got, saved, error }],
//     excelErrors (cells where Excel shows an error; they agree when the model fails too),
//     noSaved (formula cells saved without a value: nothing to compare), kept (rows kept as
//     Excel's saved values, not compared) }.
// Two numbers agree within a billionth of their size (and of 1).

import { compileModel, evaluateModel } from '../../shared/ir.js';

export const XL_CHECK_TOLERANCE = 1e-9;

export function xlAgree(got, saved){
  return typeof got === 'number' && Number.isFinite(got) && typeof saved === 'number'
    && Math.abs(got - saved) <= XL_CHECK_TOLERANCE * Math.max(1, Math.abs(saved));
}

export function xlCheckModel(system, report){
  const ir = compileModel(system);
  const results = evaluateModel(ir);
  const indexOf = new Map(ir.order.map((c, i) => [c, i]));
  const out = { compared: 0, agree: 0, differ: [], excelErrors: 0, noSaved: 0, kept: 0 };
  for(const row of report.rows){
    if(!row.translated){ out.kept++; continue; }
    if(row.kind === 'input' || row.kind === 'assumption') continue;
    const r = results[indexOf.get(ir.canvases.get(row.canvasId))];
    for(const cell of row.cells){
      if(cell.noSaved){ out.noSaved++; continue; }
      const p = cell.period === null ? 0 : cell.period;
      const got = r && r.values[p] ? r.values[p][row.nodeId] : undefined;
      const error = r && r.errors[p] ? r.errors[p][row.nodeId] || null : null;
      out.compared++;
      if(cell.error){
        out.excelErrors++;
        if(error || got === null || got === undefined) out.agree++;
        else out.differ.push({ sheet: row.sheet, address: cell.address, label: row.label, period: cell.period, got, saved: null, excel: cell.error, error });
        continue;
      }
      if(xlAgree(got, cell.saved)) out.agree++;
      else out.differ.push({ sheet: row.sheet, address: cell.address, label: row.label, period: cell.period, got: typeof got === 'number' ? got : null, saved: cell.saved, error });
    }
  }
  return out;
}
