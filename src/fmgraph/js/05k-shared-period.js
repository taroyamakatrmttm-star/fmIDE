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

// The shared settings above the bars and charts. Drawn with the tabs (a model, undo, redo), not
// with the board, so a change keeps the focus where it is.
function renderSharedPeriods(){
  const bar = $('sharedPeriodBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !model);
  if(!model) return;
  const multi = periodsChooser(sharedPeriods.periods, (p) => {
    sharedPeriods.periods = p;
    sharedPeriodsChanged();
  });
  const names = { Periods: 'Shared periods', Period: 'Shared first period', 'Last period': 'Shared last period' };
  multi.querySelectorAll('select').forEach(s => s.setAttribute('aria-label', names[s.getAttribute('aria-label')] || s.getAttribute('aria-label')));
  const one = make('select');
  one.setAttribute('aria-label', 'Shared period for one-period charts');
  model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(i === sharedPeriods.period) o.selected = true; one.appendChild(o); });
  one.addEventListener('change', () => { sharedPeriods.period = Number(one.value); sharedPeriodsChanged(); });
  const lead = make('span', 'shared-period-lead', 'Every board:');
  lead.title = 'The periods every bar and chart shows, on every board, unless it keeps its own (its period list\'s first choice is Shared)';
  const oneLabel = make('span', 'shared-period-one', 'One-period charts in');
  oneLabel.title = 'The year Waterfall, Scenario waterfall, Tornado and Spider charts show';
  const scaleLabel = make('span', 'shared-period-one', 'Scale');
  scaleLabel.title = 'The vertical scale every bar and chart shows, on every board, unless it keeps its own (its scale list\'s first choice is Shared); the Tornado and Spider keep their own';
  bar.append(lead, multi, oneLabel, one, scaleLabel, commonScaleChooser());
}

function sharedPeriodsChanged(){
  syncSharedPeriods();
  saveBoardSoon();
  renderBoard(); // the widgets' "Shared (…)" choices say the new periods
}

// A bar's or Columns chart's periods: the shared choice first, then the usual chooser.
function widgetPeriodsChooser(w){
  return periodsChooser(w.periods, (p) => {
    w.periods = p;
    w.ownPeriod = true;
    saveBoardSoon(); updateValues();
  }, {
    following: !w.ownPeriod,
    sharedText: 'Shared (' + sharedPeriodsText(sharedPeriods.periods) + ')',
    onShared: () => { w.ownPeriod = false; syncSharedPeriods(); saveBoardSoon(); updateValues(); },
  });
}

// A one-period chart's period: "Shared (Year 1)", then each period.
function widgetPeriodSelect(c, changed){
  const sel = make('select');
  sel.setAttribute('aria-label', 'Period');
  const shared = make('option', null, 'Shared (' + model.periods[sharedPeriods.period] + ')');
  shared.value = 'shared';
  if(!c.ownPeriod) shared.selected = true;
  sel.appendChild(shared);
  model.periods.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); if(c.ownPeriod && i === c.period) o.selected = true; sel.appendChild(o); });
  sel.addEventListener('change', () => {
    if(sel.value === 'shared'){ c.ownPeriod = false; syncSharedPeriods(); }
    else { c.period = Number(sel.value); c.ownPeriod = true; }
    changed();
  });
  return sel;
}
