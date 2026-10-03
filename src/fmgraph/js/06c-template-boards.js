// ============================================================
// Boards for a template (G5a). Boards ▾ → Export for a template… saves the boards in the board
// file's template form (version 2, `form: "template"`; docs/file-formats.md), for fmIDE's
// Templates → 📈 Attach fmGraph board…. A template gets new ids each time it is used, so the
// template form names each rectangle by its name — and, for a system template, its canvas's
// name — never by id:
// - for a canvas template (a canvas made from one, `canvas.template`): only that canvas's
//   rectangles (the owner's choice); `template: { kind: "module", family, name }`;
// - for a system template (the whole model): any canvas's; `template: { kind: "system" }`.
// A rectangle whose name isn't unique on its canvas (or whose canvas's name isn't unique in the
// model) can't be found again by name, so it is left out, like one on another canvas, and the
// export says how many were. Where sliders are set is never written.
// ============================================================

// The templates this model's boards can be saved for: each canvas made from a canvas template,
// then the whole model.
function templateTargets(){
  if(!model) return [];
  const out = [];
  model.canvasTemplates.forEach((t, canvasId) => {
    const r = model.rects.find(x => x.canvasId === canvasId);
    const canvasName = r ? r.canvasName : canvasId;
    out.push({ kind: 'module', canvasId, family: t.family, templateName: t.name, label: 'Canvas “' + canvasName + '” — canvas template “' + t.name + '”' });
  });
  out.push({ kind: 'system', label: 'The whole model — for a system template' });
  return out;
}

// A rectangle as the template form names it, or null when it can't be found again by name.
function templateRefMaker(target){
  const lower = (s) => String(s).trim().toLowerCase();
  const perCanvas = new Map(), canvasNames = new Map();
  model.rects.forEach(r => {
    const k = r.canvasId + '\u0000' + lower(r.name);
    perCanvas.set(k, (perCanvas.get(k) || 0) + 1);
  });
  [...new Set(model.rects.map(r => r.canvasId))].forEach(id => {
    const r = model.rects.find(x => x.canvasId === id);
    const k = lower(r.canvasName);
    canvasNames.set(k, (canvasNames.get(k) || 0) + 1);
  });
  return (key) => {
    const r = model.byKey.get(key);
    if(!r || perCanvas.get(r.canvasId + '\u0000' + lower(r.name)) !== 1) return null;
    if(target.kind === 'module') return r.canvasId === target.canvasId ? { name: r.name } : null;
    return canvasNames.get(lower(r.canvasName)) === 1 ? { canvas: r.canvasName, name: r.name } : null;
  };
}

// The boards (all, or the one shown) in the template form, and how many widgets were left out.
function templateBoardsData(target, onlyShown){
  const ref = templateRefMaker(target);
  let left = 0;
  const colourOf = (c, key) => c.colours && c.colours[key] ? { colour: c.colours[key] } : {};
  const one = (b) => {
    const items = [];
    b.items.forEach(w => {
      if(w.kind === 'bar'){
        const r = ref(w.key);
        if(!r){ left++; return; }
        items.push(Object.assign({ type: 'bar' }, r, { periods: Object.assign({}, w.periods), wide: w.wide }, w.colour ? { colour: w.colour } : {}));
        return;
      }
      if(w.layout === 'flow'){
        const steps = [];
        w.steps.forEach(s => { const r = ref(s.key); if(r) steps.push(Object.assign(r, { role: s.role }, colourOf(w, s.key))); else left++; });
        if(!steps.length) return;
        items.push({ type: 'chart', wide: w.wide, layout: 'flow', title: w.title, period: w.period, steps });
      } else {
        const groups = w.groups.map(g => ({ name: g.name, parts: g.parts.map(k => { const r = ref(k); if(!r) left++; return r ? Object.assign(r, colourOf(w, k)) : null; }).filter(Boolean) }));
        if(!groups.some(g => g.parts.length)) return;
        items.push({ type: 'chart', wide: w.wide, layout: 'columns', title: w.title, periods: Object.assign({}, w.periods), check: w.check, groups });
      }
    });
    const sliders = [];
    b.sliders.forEach(s => {
      const r = ref(s.key);
      if(!r){ left++; return; }
      sliders.push(Object.assign(r, { periods: Object.assign({}, s.periods), mode: s.mode, min: s.min, max: s.max, step: s.step }));
    });
    return { name: b.name, items, sliders };
  };
  const list = (onlyShown ? [board] : boards).map(one).filter(b => b.items.length || b.sliders.length);
  const template = target.kind === 'module' ? { kind: 'module', family: target.family, name: target.templateName } : { kind: 'system' };
  return { data: { kind: 'fmIDE-graph-board', version: TEMPLATE_BOARD_VERSION, form: 'template', template, active: 0, boards: list }, left };
}

// Writes the file; says what was left out. Returns { data, left } or null when nothing fits.
function exportForTemplate(target, onlyShown){
  const r = templateBoardsData(target, onlyShown);
  const leftText = r.left ? ' ' + r.left + ' widget' + (r.left === 1 ? '' : 's') + ' left out: ' + (target.kind === 'module'
    ? 'a canvas template\'s board shows only its own canvas, and each rectangle by a name used once on it.'
    : 'each rectangle is found by its canvas\'s name and its own, so both must be used once.') : '';
  if(!r.data.boards.length){
    notify('Nothing on ' + (onlyShown ? 'this board' : 'these boards') + ' fits that template, so nothing was saved.' + leftText, 'err', 'boards');
    return null;
  }
  const label = target.kind === 'module' ? target.templateName : model.name;
  downloadText(JSON.stringify(r.data, null, 2), safeFileName(label + ' - for a template') + '.board.json');
  notify('Saved ' + r.data.boards.length + ' board' + (r.data.boards.length === 1 ? '' : 's') + ' for ' + (target.kind === 'module' ? 'the canvas template “' + target.templateName + '”' : 'a system template')
    + '. In fmIDE, attach the file: Templates → 📈 Attach fmGraph board….' + leftText, 'ok', 'boards');
  return r;
}

// The dialog: one choice per target (the first canvas template ticked, else the whole model).
// mode 'attach' (G5b): the same choice, sent to fmIDE instead of saved as a file.
function showTemplateExport(mode){
  if(!model) return;
  const attaching = mode === 'attach';
  $('templateTitle').textContent = attaching ? 'Attach to a template' : 'Export for a template';
  $('templateYes').textContent = attaching ? 'Attach' : 'Export';
  $('templateHint').textContent = attaching ? 'fmIDE asks before attaching it.' : 'Then, in fmIDE: Templates → 📈 Attach fmGraph board….';
  const back = $('templateBox'), box = $('templateChoices');
  box.textContent = '';
  const targets = templateTargets();
  targets.forEach((t, i) => {
    const l = make('label');
    const r = make('input');
    r.type = 'radio'; r.name = 'templateTarget'; r.value = String(i); r.checked = i === 0;
    l.append(r, document.createTextNode(t.label));
    box.appendChild(l);
  });
  $('templateOnlyShown').checked = false;
  back.classList.remove('hidden');
  const done = (go) => {
    back.classList.add('hidden');
    $('templateYes').removeEventListener('click', yes);
    $('templateNo').removeEventListener('click', no);
    document.removeEventListener('keydown', key, true);
    if(!go) return;
    const picked = box.querySelector('input[name="templateTarget"]:checked');
    const target = targets[picked ? Number(picked.value) : targets.length - 1];
    if(attaching) attachToTemplate(target, $('templateOnlyShown').checked);
    else exportForTemplate(target, $('templateOnlyShown').checked);
  };
  const yes = () => done(true), no = () => done(false);
  const key = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); done(false); } };
  $('templateYes').addEventListener('click', yes);
  $('templateNo').addEventListener('click', no);
  document.addEventListener('keydown', key, true);
  $('templateYes').focus();
}
$('btnExportTemplate').addEventListener('click', () => { closeMenus(); showTemplateExport(); });
