// ============================================================
// Boards from templates (G5b). A template may carry an fmGraph board (`attachments.graph`, in the
// board file's template form, G5a). fmGraph gets them with the model — from fmIDE (`templateBoards`,
// every version of the library's templates that has one) or from a `.fmide` / workspace file's
// templates — and:
// - a model with no boards of its own (none from its document, none kept in this browser) starts
//   with its templates' boards instead of the automatic starting board (the owner's choice): every
//   canvas template a canvas was made from, and a system template whose every widget fits;
// - Boards ▾ → Add boards from templates… lists them all, with how much of each fits, and adds the
//   ticked ones as tabs (one undo step);
// - Boards ▾ → Attach to template… (only with the model from fmIDE) sends boards in the template
//   form to fmIDE, which asks before attaching them (21-web-app.js there).
// "Fits" counts rectangles: a chart missing one of its parts doesn't fit, though the rest of it
// is shown.
// A template board names rectangles by name (and canvas name, for a system template): a canvas
// template's board is placed on each canvas made from that template, by rectangle name there; a
// system template's finds each canvas by its name. A name used twice can't be told apart, so what
// it names is left out, and counted. Everything from a template is read like a file: through
// cleanBoards, every text as text.
// ============================================================
const TEMPLATE_SOURCES_LIMIT = 60;

// The templates' boards, from fmIDE's list or a workspace's templates: one entry per family, with
// every version that has a board (newest first). Which version a canvas uses is decided per canvas
// (boardsFromTemplate): the one it was made from when that has a board, else the newest.
function cleanTemplateSources(list){
  const raw = (Array.isArray(list) ? list : []).slice(0, 500).filter(t => t && typeof t === 'object'
    && (t.kind === 'module' || t.kind === 'system') && typeof t.family === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(t.family)
    && t.board && typeof t.board === 'object' && t.board.kind === 'fmIDE-graph-board' && t.board.form === 'template'
    && t.board.template && t.board.template.kind === t.kind && Array.isArray(t.board.boards));
  const fromCanvases = new Set();
  model.canvasTemplates.forEach(ct => fromCanvases.add(ct.family));
  const byFamily = new Map();
  raw.forEach(t => {
    let f = byFamily.get(t.family);
    if(!f){
      f = { family: t.family, kind: t.kind, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 120) : 'A template', versions: [], linked: fromCanvases.has(t.family) };
      byFamily.set(t.family, f);
    }
    if(f.kind !== t.kind) return;
    f.versions.push({ version: Math.round(Number(t.version)) || 0, versionId: typeof t.versionId === 'string' ? t.versionId : '', board: t.board });
  });
  const out = [...byFamily.values()].slice(0, TEMPLATE_SOURCES_LIMIT);
  out.forEach(f => { f.versions.sort((x, y) => y.version - x.version); f.version = f.versions[0].version; });
  return out;
}
// The version of a template a canvas uses: the one it was made from when it has a board, else the newest.
function versionFor(src, canvasId){
  const vid = canvasId && model.canvasVersionIds ? model.canvasVersionIds.get(canvasId) : null;
  return (vid && src.versions.find(v => v.versionId === vid)) || src.versions[0];
}

// A template's boards placed in this model: { boards (as cleanBoards gives them), total, missing } —
// how many rectangles they name, and how many of those this model doesn't have by that name.
function boardsFromTemplate(src){
  const lower = (s) => String(s).trim().toLowerCase();
  const rectsOn = (canvasId) => model.rects.filter(r => r.canvasId === canvasId);
  const unique = (list, key) => { const m = new Map(); list.forEach(x => { const k = key(x); m.set(k, m.has(k) ? null : x); }); return m; };
  // Where a reference lands: { canvasId, nodeId, name }, or one that cleanBoards leaves out.
  let resolve, copies;
  if(src.kind === 'module'){
    const canvasIds = [...model.canvasTemplates.entries()].filter(([, ct]) => ct.family === src.family).map(([id]) => id);
    copies = canvasIds.map(id => ({ id, label: (model.rects.find(r => r.canvasId === id) || { canvasName: id }).canvasName, names: unique(rectsOn(id), r => lower(r.name)) }));
    resolve = (copy, ref) => {
      const r = ref && typeof ref.name === 'string' ? copy.names.get(lower(ref.name)) : null;
      return r ? { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name } : { canvasId: '', nodeId: '', name: '' };
    };
  } else {
    const canvases = unique([...new Set(model.rects.map(r => r.canvasId))].map(id => ({ id, name: model.rects.find(r => r.canvasId === id).canvasName })), c => lower(c.name));
    const names = new Map();
    copies = [{ id: null, label: null }];
    resolve = (copy, ref) => {
      const c = ref && typeof ref.canvas === 'string' ? canvases.get(lower(ref.canvas)) : null;
      if(!c) return { canvasId: '', nodeId: '', name: '' };
      if(!names.has(c.id)) names.set(c.id, unique(rectsOn(c.id), r => lower(r.name)));
      const r = typeof ref.name === 'string' ? names.get(c.id).get(lower(ref.name)) : null;
      return r ? { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name } : { canvasId: '', nodeId: '', name: '' };
    };
  }
  const out = [];
  let total = 0, missing = 0;
  copies.forEach(copy => {
    const at = (ref) => {
      const where = resolve(copy, ref);
      total++;
      if(!where.canvasId) missing++;
      return Object.assign({}, ref && typeof ref === 'object' ? ref : {}, where);
    };
    const v = versionFor(src, copy.id);
    const boardsIn = v.board.boards.slice(0, BOARDS_LIMIT).filter(b => b && typeof b === 'object').map(b => ({
      name: (typeof b.name === 'string' && b.name.trim() ? b.name : src.name) + (copies.length > 1 ? ' — ' + copy.label : ''),
      items: (Array.isArray(b.items) ? b.items : []).map(w => {
        if(!w || typeof w !== 'object') return w;
        if(w.type === 'bar') return at(w);
        if(w.layout === 'flow') return Object.assign({}, w, { steps: (Array.isArray(w.steps) ? w.steps : []).map(at) });
        return Object.assign({}, w, { groups: (Array.isArray(w.groups) ? w.groups : []).map(g => Object.assign({}, g, { parts: (g && Array.isArray(g.parts) ? g.parts : []).map(at) })) });
      }),
      sliders: (Array.isArray(b.sliders) ? b.sliders : []).map(at),
    }));
    const r = cleanBoards({ kind: 'fmIDE-graph-board', version: TEMPLATE_BOARD_VERSION, boards: boardsIn });
    if(!r) return;
    r.boards.forEach(b => { if(b.items.length || b.sliders.length) out.push(b); });
  });
  return { boards: out, total, missing };
}

// A model with no boards of its own starts with these: every canvas template a canvas was made
// from, and every system template whose widgets all fit. Empty when there are none.
function templateStartBoards(){
  const out = [];
  (model.templateSources || []).forEach(src => {
    const r = boardsFromTemplate(src);
    if(!r.boards.length) return;
    if(src.kind === 'module' ? src.linked : r.missing === 0) out.push(...r.boards);
  });
  return out.slice(0, BOARDS_LIMIT);
}

// ---- Boards ▾ → Add boards from templates… ----
function showAddFromTemplates(){
  if(!model) return;
  const sources = (model.templateSources || []).map(src => Object.assign({ src }, boardsFromTemplate(src))).filter(x => x.boards.length);
  if(!sources.length){
    notify('This model\'s templates carry no boards that fit it. In fmIDE, attach one: Templates → 📈 Attach fmGraph board….', 'info', 'boards');
    return;
  }
  const back = $('fromTemplatesBox'), box = $('fromTemplatesChoices');
  box.textContent = '';
  sources.forEach((x, i) => {
    const l = make('label');
    const c = make('input');
    c.type = 'checkbox'; c.value = String(i);
    c.checked = x.src.kind === 'module' ? x.src.linked : x.missing === 0;
    const words = make('span');
    words.appendChild(make('strong', null, '“' + x.src.name + '”'));
    words.appendChild(document.createTextNode(' (' + (x.src.kind === 'module' ? 'canvas' : 'system') + ' template' + (x.src.kind === 'system' ? ', v' + x.src.version : '') + '): '
      + x.boards.length + ' board' + (x.boards.length === 1 ? '' : 's') + ', ' + (x.total - x.missing) + ' of ' + x.total + ' rectangles found'));
    l.append(c, words);
    box.appendChild(l);
  });
  back.classList.remove('hidden');
  const done = (go) => {
    back.classList.add('hidden');
    $('fromTemplatesYes').removeEventListener('click', yes);
    $('fromTemplatesNo').removeEventListener('click', no);
    document.removeEventListener('keydown', key, true);
    if(!go) return;
    const picked = [...box.querySelectorAll('input[type=checkbox]:checked')].map(c => sources[Number(c.value)]);
    addTemplateBoards(picked);
  };
  const yes = () => done(true), no = () => done(false);
  const key = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); done(false); } };
  $('fromTemplatesYes').addEventListener('click', yes);
  $('fromTemplatesNo').addEventListener('click', no);
  document.addEventListener('keydown', key, true);
  $('fromTemplatesYes').focus();
}
// Adds the boards of these sources as tabs; returns how many.
function addTemplateBoards(picked){
  const all = picked.flatMap(x => x.boards);
  if(!all.length) return 0;
  const room = Math.max(0, BOARDS_LIMIT - boards.length);
  const adding = all.slice(0, room);
  adding.forEach(b => { b.name = freeBoardName(b.name); boards.push(b); });
  if(adding.length) board = adding[0];
  saveBoardSoon();
  renderAll();
  const left = picked.reduce((n, x) => n + x.missing, 0);
  notify('Added ' + adding.map(b => '“' + b.name + '”').join(', ') + '.'
    + (left ? ' ' + left + ' rectangle' + (left === 1 ? '' : 's') + ' left out: not in this model by that name.' : '')
    + (all.length > adding.length ? ' ' + (all.length - adding.length) + ' not added: a model has at most ' + BOARDS_LIMIT + ' boards.' : ''), adding.length ? 'ok' : 'err', 'boards');
  return adding.length;
}

// ---- Boards ▾ → Attach to template… (the model from fmIDE) ----
// Sends the boards, in the template form, to fmIDE; fmIDE asks, attaches and answers
// ('fmIDE:board-attached' or 'fmIDE:board-not-attached', 06-page.js).
function attachToTemplate(target, onlyShown){
  const op = fmideOpener();
  if(!linkedToFmide || !op){ notify('Attach to template works with fmGraph opened from fmIDE. Use Export for a template… instead.', 'info', 'boards'); return null; }
  const r = templateBoardsData(target, onlyShown);
  if(!r.data.boards.length){ notify('Nothing on ' + (onlyShown ? 'this board' : 'these boards') + ' fits that template, so nothing was sent.', 'err', 'boards'); return null; }
  try{ op.postMessage({ type: 'fmGraph:attach-board', text: JSON.stringify(r.data) }, messageTarget()); }catch(e){ return null; }
  notify('Sent to fmIDE: answer its question there.' + (r.left ? ' ' + r.left + ' widget' + (r.left === 1 ? '' : 's') + ' left out (see Export for a template… in Help).' : ''), 'info', 'boards');
  return r;
}

$('btnAddFromTemplates').addEventListener('click', () => { closeMenus(); showAddFromTemplates(); });
$('btnAttachTemplate').addEventListener('click', () => { closeMenus(); showTemplateExport('attach'); });
