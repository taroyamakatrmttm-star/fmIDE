// ============================================================
// Choosing a scale on fmGraph's page: a bar's or chart's own, and the common scale's chooser.
// Working a scale out and drawing it are 04d-scale.js, the board engine's.
// ============================================================

// Sets a widget's scale: null (Auto), 'current' (Fix at current scale), { min, max }, or
// 'shared' (follows the common scale again). While the common scale is on, any other choice
// keeps the widget's own. Returns the scale set, or throws when it isn't one.
function setWidgetScale(w, spec){
  if(spec === 'shared'){
    w.ownScale = false;
    syncCommonScale();
    return w.scale ? Object.assign({}, w.scale) : null;
  }
  if(commonScale.mode !== 'own' && canFollowScale(w)) w.ownScale = true;
  if(spec === null){ w.scale = null; return null; }
  if(spec === 'current'){
    const a = autoScales.get(w.id);
    w.scale = a ? niceScale(a.lo, a.hi) : { min: 0, max: 1 };
    return Object.assign({}, w.scale);
  }
  const s = cleanScale(spec);
  if(!s) throw new Error('A scale is two numbers, its "from" below its "to".');
  w.scale = s;
  return Object.assign({}, s);
}

// Scale: Auto or Fixed, from … to …, and 📏 Fix at current scale — with "Shared (…)" first
// while the common scale is on (below). onChange after each change.
function scaleChooser(w, onChange){
  const wrap = make('span', 'scale-chooser');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Vertical scale');
  const sharing = commonScale.mode !== 'own' && canFollowScale(w);
  if(sharing){ const o = make('option', null, commonScaleText()); o.value = 'shared'; mode.appendChild(o); }
  [['auto', 'Auto scale'], ['fixed', 'Fixed scale']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; mode.appendChild(o); });
  const box = (label) => {
    const i = make('input', 'scale-box');
    i.type = 'number';
    i.step = 'any';
    i.setAttribute('aria-label', label);
    i.title = label;
    return i;
  };
  const minBox = box('Scale from'), maxBox = box('Scale to');
  const to = make('span', 'scale-to', 'to');
  const fixNow = make('button', 'mini scale-fix', '📏');
  fixNow.type = 'button';
  fixNow.title = 'Fix at current scale';
  fixNow.setAttribute('aria-label', 'Fix at current scale');
  const show = () => {
    const follows = sharing && followsCommonScale(w), own = w.scale && !follows;
    mode.value = follows ? 'shared' : w.scale ? 'fixed' : 'auto';
    minBox.value = own ? String(w.scale.min) : '';
    maxBox.value = own ? String(w.scale.max) : '';
    [minBox, to, maxBox].forEach(el => el.classList.toggle('hidden', !own));
  };
  const fixCurrent = () => { setWidgetScale(w, 'current'); show(); onChange(); };
  mode.addEventListener('change', () => {
    if(mode.value === 'shared'){ setWidgetScale(w, 'shared'); show(); onChange(); }
    else if(mode.value === 'auto'){ setWidgetScale(w, null); show(); onChange(); }
    else if(followsCommonScale(w)){
      // Leaving the common scale for a fixed one keeps the range it shows.
      const sh = shownScale(w);
      setWidgetScale(w, sh ? (sh.fixed ? { min: sh.min, max: sh.max } : niceScale(sh.min, sh.max)) : 'current');
      show(); onChange();
    }
    else fixCurrent();
  });
  fixNow.addEventListener('click', fixCurrent);
  const typed = () => {
    const num = (i) => i.value.trim() === '' ? NaN : Number(i.value);
    const s = cleanScale({ min: num(minBox), max: num(maxBox) });
    if(!s){
      notify('The scale wasn\'t changed: its "from" and "to" must be numbers, "from" below "to".', 'err', 'scale');
      show();
      return;
    }
    notify('', null, 'scale');
    if(w.scale && w.scale.min === s.min && w.scale.max === s.max) return;
    setWidgetScale(w, s);
    onChange();
  };
  [minBox, maxBox].forEach(i => i.addEventListener('change', typed));
  wrap.append(mode, minBox, to, maxBox, fixNow);
  show();
  return wrap;
}

// Sets the common scale: null or 'own' (Each its own), 'auto', 'current' (Fixed for all at the
// range the board shown's bars and charts take now) or { min, max }. Returns it, or throws.
function setCommonScale(spec){
  if(spec === null || spec === 'own') commonScale = { mode: 'own' };
  else if(spec === 'auto') commonScale = { mode: 'auto' };
  else if(spec === 'current'){
    const r = model ? boardAutoRange(board, currentResults(), true) : null;
    commonScale = Object.assign({ mode: 'fixed' }, r ? niceScale(r.lo, r.hi) : { min: 0, max: 1 });
  } else {
    const s = cleanScale(spec);
    if(!s) throw new Error('A scale is two numbers, its "from" below its "to".');
    commonScale = { mode: 'fixed', min: s.min, max: s.max };
  }
  syncCommonScale();
  return commonScaleData();
}

// Scale: Each its own, Auto for all or Fixed for all (from … to …, 📏), above the bars and charts.
function commonScaleChooser(){
  const wrap = make('span', 'scale-chooser common-scale');
  const mode = make('select');
  mode.setAttribute('aria-label', 'Common scale');
  mode.title = 'One vertical scale for every bar and chart, on every board, unless it keeps its own (its scale list\'s first choice is Shared). The Tornado and Spider keep their own.';
  [['own', 'Each its own'], ['auto', 'Auto for all'], ['fixed', 'Fixed for all']].forEach(([v, t]) => { const o = make('option', null, t); o.value = v; mode.appendChild(o); });
  const box = (label) => {
    const i = make('input', 'scale-box');
    i.type = 'number';
    i.step = 'any';
    i.setAttribute('aria-label', label);
    i.title = label;
    return i;
  };
  const minBox = box('Common scale from'), maxBox = box('Common scale to');
  const to = make('span', 'scale-to', 'to');
  const fixNow = make('button', 'mini scale-fix', '📏');
  fixNow.type = 'button';
  fixNow.title = 'Fix the common scale at the current scale';
  fixNow.setAttribute('aria-label', 'Fix the common scale at the current scale');
  // Shown in place, so a change keeps the focus where it is.
  const show = () => {
    const fixed = commonScale.mode === 'fixed';
    mode.value = commonScale.mode;
    minBox.value = fixed ? String(commonScale.min) : '';
    maxBox.value = fixed ? String(commonScale.max) : '';
    [minBox, to, maxBox, fixNow].forEach(el => el.classList.toggle('hidden', !fixed));
  };
  const changed = () => { notify('', null, 'scale'); show(); commonScaleChanged(); };
  mode.addEventListener('change', () => { setCommonScale(mode.value === 'fixed' ? 'current' : mode.value); changed(); });
  fixNow.addEventListener('click', () => { setCommonScale('current'); changed(); });
  const typed = () => {
    const num = (i) => i.value.trim() === '' ? NaN : Number(i.value);
    const s = cleanScale({ min: num(minBox), max: num(maxBox) });
    if(!s){
      notify('The common scale wasn\'t changed: its "from" and "to" must be numbers, "from" below "to".', 'err', 'scale');
      show();
      return;
    }
    if(commonScale.min === s.min && commonScale.max === s.max) return;
    setCommonScale(s);
    changed();
  };
  [minBox, maxBox].forEach(i => i.addEventListener('change', typed));
  wrap.append(mode, minBox, to, maxBox, fixNow);
  show();
  return wrap;
}

function commonScaleChanged(){
  saveBoardSoon();
  renderBoard(); // the widgets' "Shared (…)" choices say the new scale
}
