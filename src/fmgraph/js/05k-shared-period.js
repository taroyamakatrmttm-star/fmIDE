// ============================================================
// The shared period (the owner's request, 18 October 2026): one period setting for every bar and
// chart on every board of the model, which any of them can leave to keep its own.
// - Two linked settings, above the bars and charts: Periods (all, one, or a range) for bars and
//   Columns and Lines charts, and Period (one year) for the one-period charts — Waterfall, Scenario
//   waterfall, Tornado and Spider. Kept with the model's boards (`sharedPeriods`, board file 9),
//   undone and redone like any board change.
// - A bar or chart follows them unless it keeps its own (`ownPeriod`): its period list's first
//   choice, "Shared (…)", follows; choosing any period there keeps its own; "Shared" again
//   follows. A new bar or chart follows; one from a file before version 9, or from a template,
//   keeps the periods it had (the owner's choice).
// - What follows takes the shared values into its own `periods` / `period` (syncSharedPeriods),
//   so the drawing, the calculation and the file read them as before — and ExcelExporter, which
//   reads a board file's charts, gets the periods each chart shows.
// - Sliders are not part of it: a slider's periods say which periods it changes.
// ============================================================

let sharedPeriods = { periods: { mode: 'all' }, period: 0 };

// Bars, Columns and Lines charts show several periods; the others one.
const usesPeriods = (w) => w.kind === 'bar' || w.layout === 'columns' || w.layout === 'lines';

function cleanSharedPeriods(raw, count){
  const p = raw && typeof raw === 'object' ? Math.round(Number(raw.period)) : NaN;
  return { periods: cleanPeriods(raw && raw.periods, count), period: Number.isFinite(p) && p >= 0 && p < count ? p : 0 };
}

// Every bar and chart following the shared period, on every board, takes it.
function syncSharedPeriods(){
  if(!model) return;
  boards.forEach(b => b.items.forEach(w => {
    if(w.ownPeriod) return;
    if(usesPeriods(w)) w.periods = Object.assign({}, sharedPeriods.periods);
    else w.period = sharedPeriods.period;
  }));
}

// A periods spec in words: "All periods", "Year 2", "Year 2 to Year 4".
function sharedPeriodsText(spec){
  if(!spec || spec.mode === 'all') return 'All periods';
  if(spec.mode === 'one') return model.periods[spec.p];
  return model.periods[spec.from] + ' to ' + model.periods[spec.to];
}
