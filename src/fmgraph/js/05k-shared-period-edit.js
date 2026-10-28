// ============================================================
// Choosing the shared period on fmGraph's page, and a widget's own. Reading and following it
// are 05k-shared-period.js, the board engine's.
// ============================================================

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
