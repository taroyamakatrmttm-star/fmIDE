// ============================================================
// Inputs tab — optional. Gathers every input rectangle (a value rectangle with no
// incoming arrow) onto one tab holding the hard-coded numbers; each original row stays
// where it is but becomes a green-font link to its Inputs-tab cell (see generateWorkbook).
//
// The Inputs tab is a real tab (id INPUTS_TAB_ID) and its rows are "mirror" rows kept in
// mapping.inputRows: { id: 'inp|'+sourceRowId, sourceRowId, isInputMirror, tabId, order,
// flatOrder, canvasId, nodeId, path }. A mirror has no label/Include/Constant of its own
// — those read and write through to its source row (non-enumerable accessors, so they're
// never serialized), which keeps the pair in lockstep: rename either and both change;
// exclude or inline the source and its Inputs-tab row goes too.
// ============================================================
const INPUTS_TAB_ID = 'tab__inputs';
let inputsLayoutUndo = null; // transient, never saved

function inputMirrorRows(){ return (mapping && mapping.inputRows) || []; }
function inputsCfg(){ return mapping.cfg.inputsTab; }
function inputsEnabled(){ return !!(mapping && mapping.cfg.inputsTab && mapping.cfg.inputsTab.enabled); }
function inputsTab(){ return mapping.tabs.find(t => t.id === INPUTS_TAB_ID) || null; }
function mirrorIdFor(sourceRowId){ return 'inp|' + sourceRowId; }

// A real rectangle row whose rectangle has no incoming arrow — i.e. its numbers are typed.
// A Block Input rectangle counts too: inside an instance (row.path not empty) when nothing
// feeds that instance's port (it then has a row of its own); on its own canvas unless the
// canvas is used as a block, where it is only a placeholder for what instances wire in.
function isTrueInputRow(row){
  if(!row || row.isCustom || row.isInputMirror || row.verticalCombined) return false;
  const c = model.canvases.find(x => x.id === row.canvasId);
  const n = c && c.nodes.find(x => x.id === row.nodeId);
  if(!n || n.type !== 'value' || n.blockRole === 'index') return false;
  if(n.blockRole === 'input'){
    if(row.path && row.path.length) return isUnfedBlockInput(row.path, c, n);
    if(isUsedAsBlock(c.id)) return false;
  }
  return isInputRectangle(c, n);
}
function isUsedAsBlock(canvasId){
  return model.canvases.some(cv => cv.nodes.some(x => x.type === 'blockInstance' && x.blockDefCanvasId === canvasId));
}

function attachMirror(m){
  const src = mapping.rows.find(r => r.id === m.sourceRowId);
  m.isInputMirror = true;
  m.tabId = INPUTS_TAB_ID;
  if(src){ m.canvasId = src.canvasId; m.nodeId = src.nodeId; m.path = src.path || []; }
  const proxy = (prop) => Object.defineProperty(m, prop, {
    configurable: true, enumerable: false,
    get(){ const s = mapping.rows.find(r => r.id === m.sourceRowId); return s ? s[prop] : undefined; },
    set(v){ const s = mapping.rows.find(r => r.id === m.sourceRowId); if(s) s[prop] = v; }
  });
  ['label', 'include', 'inlineConstant', 'verticalShared', 'verticalVintage'].forEach(proxy);
  Object.defineProperty(m, 'section', { configurable: true, enumerable: false, get(){ return 'input'; }, set(){} });
  return m;
}

// Every non-Inputs row in final sheet order, as a Map id -> index.
function sheetOrderIndex(){
  const idx = new Map(); let i = 0;
  mapping.tabs.slice().sort((a, b) => a.order - b.order).forEach(t => {
    if(t.id === INPUTS_TAB_ID) return;
    allRowsForTab(t.id).forEach(r => idx.set(r.id, i++));
  });
  return idx;
}

// Which group an Inputs-tab row belongs to, per the "Group by" setting:
//  'tab'    — the Excel tab its source row sits on;
//  'canvas' — the canvas it's drawn on; a rectangle inside a block instance groups under
//             that instance (named like the instance's own default tab), since every
//             instance has its own copy of the block's inputs;
//  'none'   — one group, no header.
function inputGroupOf(mirror, mode){
  const src = mapping.rows.find(r => r.id === mirror.sourceRowId);
  if(!src || mode === 'none') return { key: '', name: null, rank: 0 };
  if(mode === 'tab'){
    const t = mapping.tabs.find(x => x.id === src.tabId);
    return { key: 'tab:' + src.tabId, name: t ? t.name : '(no tab)', rank: t ? t.order : 1e9 };
  }
  if(src.path && src.path.length){
    const hop = src.path[0];
    const tid = 'tab_blk_' + hop.canvasId + '_' + hop.nodeId;
    const t = mapping.tabs.find(x => x.id === tid);
    const c = model.canvases.find(x => x.id === src.canvasId);
    return { key: 'blk:' + hop.canvasId + '_' + hop.nodeId, name: t ? t.name : ((c && c.name) || 'Block'), rank: 1e6 + (t ? t.order : 0) };
  }
  const ci = model.canvases.findIndex(x => x.id === src.canvasId);
  return { key: 'cv:' + src.canvasId, name: ci >= 0 ? (model.canvases[ci].name || ('Canvas ' + (ci + 1))) : '?', rank: ci };
}

function makeGroupHeader(g){
  return { id: 'custom_inpgrp_' + g.key.replace(/[^A-Za-z0-9_:-]/g, '_'), isCustom: true, autoInputsGroup: g.key,
           tabId: INPUTS_TAB_ID, section: 'input', label: g.name, style: null, showPeriodLabels: true };
}

// Writes `seq` (every row on the Inputs tab, in the wanted order) into both order
// dimensions — flat order directly, sectioned order via a clean per-band renumber.
function commitInputsSequence(seq){
  seq.forEach((r, i) => { r.flatOrder = i; r.order = i; });
  ensureSectionOrderAll(INPUTS_TAB_ID);
  ensureFlatOrder(INPUTS_TAB_ID);
}

// Rebuilds the Inputs tab from scratch per the Group by / Order settings: auto group
// headers are regenerated; any rows you added there yourself (custom rows, or other rows
// moved onto this tab) are kept, after the gathered inputs.
function relayoutInputsTab(){
  if(!inputsEnabled()) return;
  const cfg = inputsCfg();
  mapping.customRows = mapping.customRows.filter(r => !(r.autoInputsGroup !== undefined && r.tabId === INPUTS_TAB_ID));
  const sheetIdx = sheetOrderIndex();
  const pos = (m) => { const v = sheetIdx.get(m.sourceRowId); return v === undefined ? 1e12 : v; };
  const groups = new Map();
  inputMirrorRows().forEach(m => {
    const g = inputGroupOf(m, cfg.groupBy);
    if(!groups.has(g.key)) groups.set(g.key, Object.assign(g, { items: [] }));
    groups.get(g.key).items.push(m);
  });
  const ordered = [...groups.values()].sort((a, b) => (a.rank - b.rank) || labelCollator.compare(a.name || '', b.name || ''));
  const seq = [];
  ordered.forEach(g => {
    g.items.sort(cfg.orderWithin === 'alpha'
      ? (a, b) => labelCollator.compare(a.label || '', b.label || '') || (pos(a) - pos(b))
      : (a, b) => pos(a) - pos(b));
    if(cfg.groupBy !== 'none' && g.items.length){
      const h = makeGroupHeader(g);
      mapping.customRows.push(h);
      seq.push(h);
    }
    seq.push(...g.items);
  });
  const inSeq = new Set(seq);
  allRowsForTab(INPUTS_TAB_ID).forEach(r => { if(!inSeq.has(r)) seq.push(r); });
  commitInputsSequence(seq);
}

// Keeps mirrors 1:1 with the model's input rows (called on every load/reconcile). New
// inputs join the end of their own group (a new group gets a header at the bottom);
// gone ones are dropped, along with any auto header left with nothing under it.
// Everything else about the tab's arrangement is left exactly as it was.
function syncInputMirrors(){
  if(!inputsEnabled()){
    mapping.inputRows = [];
    return;
  }
  if(!inputsTab()){
    mapping.tabs.push({ id: INPUTS_TAB_ID, name: uniqueTabName(inputsCfg().name || 'Inputs', INPUTS_TAB_ID).name, order: -1 });
    mapping.tabs.sort((a, b) => a.order - b.order).forEach((t, i) => t.order = i);
  }
  const eligible = new Map(mapping.rows.filter(isTrueInputRow).map(r => [r.id, r]));
  mapping.inputRows = mapping.inputRows.filter(m => eligible.has(m.sourceRowId));
  mapping.inputRows.forEach(attachMirror);
  const have = new Set(mapping.inputRows.map(m => m.sourceRowId));
  const fresh = [];
  eligible.forEach((src, id) => { if(!have.has(id)) fresh.push(attachMirror({ id: mirrorIdFor(id), sourceRowId: id })); });
  if(fresh.length){
    const list = allRowsForTab(INPUTS_TAB_ID); // before the fresh mirrors are registered
    mapping.inputRows.push(...fresh);
    const cfg = inputsCfg();
    const sheetIdx = sheetOrderIndex();
    fresh.sort((a, b) => (sheetIdx.get(a.sourceRowId) || 0) - (sheetIdx.get(b.sourceRowId) || 0)).forEach(m => {
      const g = inputGroupOf(m, cfg.groupBy);
      if(cfg.groupBy === 'none'){ list.push(m); return; }
      const h = list.findIndex(r => r.autoInputsGroup === g.key);
      if(h < 0){
        const header = makeGroupHeader(g);
        mapping.customRows.push(header);
        list.push(header, m);
        return;
      }
      let j = h + 1;
      while(j < list.length && list[j].autoInputsGroup === undefined) j++;
      list.splice(j, 0, m);
    });
    commitInputsSequence(list);
  }
  // Drop auto headers whose group is now empty.
  const liveKeys = new Set(inputMirrorRows().map(m => inputGroupOf(m, inputsCfg().groupBy).key));
  mapping.customRows = mapping.customRows.filter(r => !(r.autoInputsGroup !== undefined && r.tabId === INPUTS_TAB_ID && !liveKeys.has(r.autoInputsGroup)));
}

// Excel needs unique sheet names (case-insensitive). Returns { name, changed }.
function uniqueTabName(desired, selfId){
  const base = sanitizeSheetName(desired);
  const taken = new Set(mapping.tabs.filter(t => t.id !== selfId).map(t => t.name.toLowerCase()));
  if(!taken.has(base.toLowerCase())) return { name: base, changed: false };
  for(let n = 2; ; n++){
    const suffix = ' ' + n;
    const cand = base.slice(0, 31 - suffix.length).trim() + suffix;
    if(!taken.has(cand.toLowerCase())) return { name: cand, changed: true };
  }
}

function setInputsTabName(desired){
  const t = inputsTab();
  const { name, changed } = uniqueTabName(desired, INPUTS_TAB_ID);
  inputsCfg().name = name;
  if(t) t.name = name;
  saveMapping();
  renderTabs(); renderRows(); renderCustomRows();
  setStatus($('inputsStatus'), changed ? `"${sanitizeSheetName(desired)}" is already a tab name, so this tab is named "${name}".` : '', changed ? 'err' : null);
}

async function setInputsEnabled(on){
  const cfg = inputsCfg();
  if(on){
    cfg.enabled = true;
    const wanted = sanitizeSheetName(cfg.name || 'Inputs');
    syncInputMirrors();
    relayoutInputsTab();
    const t = inputsTab();
    cfg.name = t.name;
    saveMapping(); renderAll();
    const renamed = t.name !== wanted;
    setStatus($('inputsStatus'), renamed ? `"${wanted}" is already a tab name, so the inputs tab is named "${t.name}".` : '', renamed ? 'err' : null);
    return;
  }
  const ok = await showConfirm('Remove the inputs tab?',
    'The inputs tab and its arrangement are removed, and every input row goes back to holding its own numbers. Rows you added to that tab yourself move to the first remaining tab.',
    'Remove Inputs Tab');
  if(!ok){ $('cfgInputsEnabled').checked = true; return; }
  cfg.enabled = false;
  mapping.inputRows = [];
  mapping.customRows = mapping.customRows.filter(r => !(r.autoInputsGroup !== undefined && r.tabId === INPUTS_TAB_ID));
  mapping.tabs = mapping.tabs.filter(t => t.id !== INPUTS_TAB_ID);
  const fallback = mapping.tabs.slice().sort((a, b) => a.order - b.order)[0];
  [...mapping.rows, ...mapping.customRows].forEach(r => { if(r.tabId === INPUTS_TAB_ID) r.tabId = fallback.id; });
  mapping.tabs.sort((a, b) => a.order - b.order).forEach((t, i) => t.order = i);
  mapping.tabs.forEach(t => { ensureSectionOrderAll(t.id); ensureFlatOrder(t.id); });
  inputsLayoutUndo = null;
  saveMapping(); renderAll();
  setStatus($('inputsStatus'), '', null);
}

function applyInputsLayoutSetting(){
  const snap = {
    customRows: JSON.parse(JSON.stringify(mapping.customRows)),
    orders: Object.fromEntries([...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === INPUTS_TAB_ID).map(r => [r.id, [r.order, r.flatOrder]])),
    cfg: { groupBy: inputsCfg().groupBy, orderWithin: inputsCfg().orderWithin }
  };
  inputsCfg().groupBy = $('cfgInputsGroup').value;
  inputsCfg().orderWithin = $('cfgInputsOrder').value;
  relayoutInputsTab();
  inputsLayoutUndo = snap;
  saveMapping(); renderTabs(); renderRows(); renderCustomRows(); renderBulkBar();
  const el = $('inputsStatus');
  el.innerHTML = '<div class="status ok" style="display:flex; align-items:center; gap:8px;"><span>Inputs tab re-arranged.</span></div>';
  const b = document.createElement('button'); b.className = 'icon'; b.textContent = '↶ Undo';
  b.addEventListener('click', undoInputsLayout);
  el.firstChild.appendChild(b);
}

function undoInputsLayout(){
  const u = inputsLayoutUndo; if(!u) return;
  mapping.customRows = u.customRows;
  [...mapping.rows, ...inputMirrorRows()].forEach(r => { if(u.orders[r.id]){ r.order = u.orders[r.id][0]; r.flatOrder = u.orders[r.id][1]; } });
  inputsCfg().groupBy = u.cfg.groupBy; inputsCfg().orderWithin = u.cfg.orderWithin;
  inputsLayoutUndo = null;
  ensureSectionOrderAll(INPUTS_TAB_ID); ensureFlatOrder(INPUTS_TAB_ID);
  saveMapping(); renderTabs(); renderRows(); renderCustomRows(); renderBulkBar();
  setStatus($('inputsStatus'), 'Layout change undone.', 'ok');
}

// ---------- Variable scenarios (Inputs tab only) ----------
// A gathered input can carry N scenarios (mirror.scenarios = N >= 2). In Excel its
// Inputs-tab block becomes N scenario rows (scenario 1 = the fmIDE values, the rest
// empty for you to fill), then the variable's own row picking one of them with INDEX by
// the number in its column C, which links to that variable's "Applied" cell on the
// Scenarios tab. Every other tab keeps linking to the variable's own row.
const MAX_SCENARIOS = 20;
function scenarioCountOf(row){
  if(!row || !row.isInputMirror || !inputsEnabled()) return 0;
  const n = Math.round(Number(row.scenarios));
  return n >= 2 ? Math.min(n, MAX_SCENARIOS) : 0;
}
// Global cases (Scenarios tab): 0 = off (type each variable's Applied number directly).
const MAX_CASES = 50;
function globalCaseCount(){
  const v = inputsCfg().globalCases;
  const n = Math.round(Number(v === undefined ? 3 : v));
  return n >= 1 ? Math.min(n, MAX_CASES) : 0;
}
function defaultScenarioCount(){
  const n = Math.round(Number(inputsCfg().defaultScenarios));
  return n >= 2 ? Math.min(n, MAX_SCENARIOS) : 3;
}
function setRowScenarios(row, n){
  if(!row || !row.isInputMirror) return;
  if(n) row.scenarios = Math.max(2, Math.min(MAX_SCENARIOS, Math.round(n))); else delete row.scenarios;
}
// Inline control on an Inputs-tab row: [☐ scenarios] or [☑ scenarios [3]].
function buildScenarioControl(row){
  const wrap = document.createElement('span');
  wrap.className = 'scn-ctl';
  wrap.title = 'Give this input several scenarios in Excel (scenario 1 = the fmIDE values; the rest start empty). Pick the one applied on the Scenarios tab.';
  ['click', 'mousedown', 'dblclick', 'contextmenu'].forEach(ev => wrap.addEventListener(ev, e => e.stopPropagation()));
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!scenarioCountOf(row);
  const lab = document.createElement('span'); lab.textContent = 'scenarios';
  const num = document.createElement('input'); num.type = 'number'; num.min = 2; num.max = MAX_SCENARIOS;
  num.value = scenarioCountOf(row) || defaultScenarioCount();
  num.classList.toggle('hidden', !cb.checked);
  cb.addEventListener('change', () => {
    setRowScenarios(row, cb.checked ? Number(num.value) || defaultScenarioCount() : 0);
    num.classList.toggle('hidden', !cb.checked);
    wrap.classList.toggle('on', cb.checked);
    saveMapping(); renderCasesHint();
  });
  num.addEventListener('change', () => {
    const v = Math.max(2, Math.min(MAX_SCENARIOS, Math.round(Number(num.value)) || 2));
    num.value = v;
    if(cb.checked){ setRowScenarios(row, v); saveMapping(); renderCasesHint(); }
  });
  wrap.classList.toggle('on', cb.checked);
  wrap.append(cb, lab, num);
  return wrap;
}
function bulkSetScenarios(on){
  let changed = 0;
  selectedRowIds.forEach(id => {
    const r = findRowById(id);
    if(r && r.isInputMirror){ setRowScenarios(r, on ? defaultScenarioCount() : 0); changed++; }
  });
  if(!changed) return;
  saveMapping(); renderRows(); renderCustomRows(); renderBulkBar(); renderCasesHint();
}

// "(N combinations possible)" — the product of every scenario variable's count.
function renderCasesHint(){
  const el = $('casesHint'); if(!el) return;
  const counts = inputMirrorRows().filter(r => r.include && !r.inlineConstant).map(scenarioCountOf).filter(Boolean);
  if(!inputsEnabled() || !counts.length){ el.textContent = ''; return; }
  const combos = counts.reduce((a, b) => a * b, 1);
  el.textContent = counts.length + ' variable' + (counts.length === 1 ? '' : 's') + ' with scenarios · ' + combos.toLocaleString() + ' possible combination' + (combos === 1 ? '' : 's');
}

function renderInputsSettings(){
  const cfg = inputsCfg();
  $('cfgInputsEnabled').checked = !!cfg.enabled;
  $('cfgInputsName').value = inputsTab() ? inputsTab().name : (cfg.name || 'Inputs');
  $('cfgInputsGroup').value = cfg.groupBy || 'tab';
  $('cfgInputsOrder').value = cfg.orderWithin || 'sheet';
  $('cfgInputsScenarios').value = defaultScenarioCount();
  $('cfgInputsCases').value = globalCaseCount();
  renderCasesHint();
  ['cfgInputsName', 'cfgInputsGroup', 'cfgInputsOrder', 'btnInputsRelayout', 'cfgInputsScenarios', 'cfgInputsCases'].forEach(id => { $(id).disabled = !cfg.enabled; });
  $('inputsOptions').classList.toggle('hidden', !cfg.enabled); // its settings show once it is on
}

// ---------- Custom / label rows ----------
// A custom row is a purely presentational row — a section divider or a labeled header —
// with no fmIDE rectangle behind it. It shares the same {tabId, section, order} shape as
// a real row so it can be interleaved with them via combinedRowsFor(), but carries its
// own label/style/showPeriodLabels instead of a nodeId.
function combinedRowsFor(tabId, section){
  // A row flagged inlineConstant never occupies a physical row (like an alias or
  // period-shift node) — its value is spliced directly into whatever formula
  // references it instead (see operandRef), so it's excluded here regardless of
  // its own `include` state.
  const nodeRows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId && r.section === section && r.include && !r.inlineConstant);
  const customRows = mapping.customRows.filter(r => r.tabId === tabId && r.section === section);
  return [...nodeRows, ...customRows].sort((a, b) => a.order - b.order);
}

// ---------- Section toggle (Input/Calc/Output as an optional layout partition) ----------
// When true (the historical/default behavior), `order` is scoped per (tabId, section) and
// section is a hard band in the generated sheet (see buildCtx/generateWorkbook) — nothing
// below changes. When false, section becomes a purely informational tag (still shown, still
// auto-classified, still overridable) and every row in a tab shares one flat sequence via
// `flatOrder` instead — see combinedRowsForTab(), the single source of truth for that flat
// order, used by the Tree view, the Tab view, and generation alike whenever this is off.
function sectionsEnabled(){
  return !mapping.cfg || mapping.cfg.sectionsEnabled !== false;
}

function setSectionsEnabled(on){
  mapping.cfg.sectionsEnabled = !!on;
  mapping.tabs.forEach(t => { ensureSectionOrderAll(t.id); ensureFlatOrder(t.id); });
  saveMapping();
  renderRows();
  renderCustomRows();
  renderBulkBar();
}

// Renumbers a single (tabId, section) group's `order` to a clean 0..n-1 sequence,
// preserving every row's existing relative position (ties break by array/insertion
// order). Safe to call at any time, sectioned mode or not — it's what keeps `order`
// valid and ready for whenever sectioned mode is (re)enabled.
function renumberSectionOrderClean(tabId, section){
  const rows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId && r.section === section);
  const customs = mapping.customRows.filter(r => r.tabId === tabId && r.section === section);
  const all = [...rows, ...customs].sort((a, b) =>
    (typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER) - (typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER));
  all.forEach((r, i) => { r.order = i; });
}
function ensureSectionOrderAll(tabId){
  ['input', 'calc', 'output'].forEach(sec => renumberSectionOrderClean(tabId, sec));
}

const SECTION_RANK = { input: 0, calc: 1, output: 2 };

// Renumbers every row/custom-row in a tab to a clean, tab-wide 0..n-1 `flatOrder`
// sequence, regardless of section. A row that already has a flatOrder keeps its
// relative position (this is what makes flat mode stable across repeated toggling —
// it's never recomputed from scratch once a row has been placed in it); a row that has
// never been flattened before (a freshly-added row, or one from a mapping saved before
// this feature existed) is seeded by section rank then its sectioned `order`, so a
// first-time flatten reproduces exactly what sectioned mode was already showing rather
// than an arbitrary shuffle.
function ensureFlatOrder(tabId){
  const rows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId);
  const customs = mapping.customRows.filter(r => r.tabId === tabId);
  const all = [...rows, ...customs];
  all.sort((a, b) => {
    const av = typeof a.flatOrder === 'number' ? a.flatOrder : Infinity;
    const bv = typeof b.flatOrder === 'number' ? b.flatOrder : Infinity;
    if(av !== bv) return av - bv;
    const ra = SECTION_RANK.hasOwnProperty(a.section) ? SECTION_RANK[a.section] : 1;
    const rb = SECTION_RANK.hasOwnProperty(b.section) ? SECTION_RANK[b.section] : 1;
    if(ra !== rb) return ra - rb;
    return (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0);
  });
  all.forEach((r, i) => { r.flatOrder = i; });
}

// The single source of truth for "every row in this tab, in final order" — branches on
// sectionsEnabled() so the Tree view, the Tab view (in flat mode), and generation
// (buildCtx) can all just call this instead of each re-implementing the branch.
function combinedRowsForTab(tabId){
  if(sectionsEnabled()){
    return [].concat(combinedRowsFor(tabId, 'input'), combinedRowsFor(tabId, 'calc'), combinedRowsFor(tabId, 'output'));
  }
  const nodeRows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId && r.include && !r.inlineConstant);
  const customRows = mapping.customRows.filter(r => r.tabId === tabId);
  return [...nodeRows, ...customRows].sort((a, b) => (typeof a.flatOrder === 'number' ? a.flatOrder : 0) - (typeof b.flatOrder === 'number' ? b.flatOrder : 0));
}

// Same grouping as combinedRowsFor()/combinedRowsForTab(), but WITHOUT filtering out an
// excluded (`include:false`) or inlined-constant row — used by every "move" operation
// (nudge/relocate/bulk-nudge) instead of the filtered lists, so an excluded/constant row
// keeps a coherent, stable position in its group's order sequence even though it's
// currently invisible in the generated sheet. Without this, selecting an excluded row
// (now possible via the Tree view, which shows every row) and moving it would silently
// no-op, since it wouldn't be found in a filtered list at all. combinedRowsFor/
// combinedRowsForTab themselves are left untouched — they still mean "what will actually
// be written to the sheet" and stay exactly as generation (buildCtx) and the Tab view's
// live preview expect.
function allRowsForSection(tabId, section){
  const rows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId && r.section === section);
  const customs = mapping.customRows.filter(r => r.tabId === tabId && r.section === section);
  return [...rows, ...customs].sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0));
}
function allRowsForTab(tabId){
  if(sectionsEnabled()){
    return [].concat(allRowsForSection(tabId, 'input'), allRowsForSection(tabId, 'calc'), allRowsForSection(tabId, 'output'));
  }
  const rows = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tabId);
  const customs = mapping.customRows.filter(r => r.tabId === tabId);
  return [...rows, ...customs].sort((a, b) => (typeof a.flatOrder === 'number' ? a.flatOrder : 0) - (typeof b.flatOrder === 'number' ? b.flatOrder : 0));
}

// Real + custom rows in the order they appear across the whole workbook (tab order, then
// each tab's own row order) — used to find the first/last row of a multi-row selection.
function selectionInSheetOrder(){
  const out = [];
  mapping.tabs.slice().sort((a, b) => a.order - b.order).forEach(t => {
    allRowsForTab(t.id).forEach(r => { if(selectedRowIds.has(r.id)) out.push(r); });
  });
  return out;
}

// Inserts a new, empty custom row directly above or below `anchor` — same tab, and (with
// sections enforced) the same Input/Calc/Output band, since a row can only sit in its own
// band. Both order dimensions are kept valid (see ensureSectionOrderAll/ensureFlatOrder).
// The new row becomes the selection, so repeated inserts keep stacking where you are; in
// the Tree view it opens straight into rename so the label can be typed immediately.
function insertCustomRowNear(anchor, where){
  if(!anchor) return null;
  const sectioned = sectionsEnabled();
  const newRow = {
    id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    isCustom: true, tabId: anchor.tabId, section: anchor.section || 'input',
    label: '', style: null, showPeriodLabels: false
  };
  const list = sectioned ? allRowsForSection(anchor.tabId, newRow.section) : allRowsForTab(anchor.tabId);
  const idx = list.indexOf(anchor);
  mapping.customRows.push(newRow);
  relocateRows([newRow.id], anchor.tabId, newRow.section, idx < 0 ? Number.MAX_SAFE_INTEGER : (where === 'above' ? idx : idx + 1));
  ensureSectionOrderAll(anchor.tabId);
  ensureFlatOrder(anchor.tabId);
  saveMapping();
  selectedRowIds.clear();
  selectedRowIds.add(newRow.id);
  renderCustomRows(); // cascades into the Tab and Tree views
  renderTabs();
  renderBulkBar();
  if(currentRowView === 'tree'){
    const i = treeVisibleRows.findIndex(e => e.id === newRow.id);
    if(i >= 0) treeAnchorIndex = i;
    const entry = treeRowElements.find(e => e.id === newRow.id);
    if(entry){
      entry.el.scrollIntoView({ block: 'nearest' });
      startTreeRowRename(entry.el, entry.el.querySelector('.tree-row-label'), newRow);
    }
  }
  return newRow;
}

// "+ Label Row": with rows selected, inserts just below the last selected row;
// with nothing selected, keeps the original behavior (bottom of the first tab).
function addCustomRow(){
  const sel = selectionInSheetOrder();
  if(sel.length){ insertCustomRowNear(sel[sel.length - 1], 'below'); return; }
  const tab = mapping.tabs.slice().sort((a, b) => a.order - b.order)[0];
  if(!tab) return;
  mapping.customRows.push({
    id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    isCustom: true, tabId: tab.id, section: 'input',
    order: Number.MAX_SAFE_INTEGER, flatOrder: Number.MAX_SAFE_INTEGER,
    label: '', style: null, showPeriodLabels: false
  });
  // Land it at the end of wherever it was just appended (its own section's bottom in
  // sectioned mode, the tab's bottom in flat mode) instead of leaving the sentinel value in place.
  ensureSectionOrderAll(tab.id);
  ensureFlatOrder(tab.id);
  saveMapping();
  renderCustomRows();
  renderTabs();
  // Label rows are edited where they sit: from the By Canvas view, show the new one in the Tree.
  if(currentRowView === 'canvas') setRowView('tree');
  if(currentRowView === 'tree'){
    const row = mapping.customRows[mapping.customRows.length - 1];
    const entry = treeRowElements.find(e => e.id === row.id);
    if(entry){
      entry.el.scrollIntoView({ block: 'nearest' });
      startTreeRowRename(entry.el, entry.el.querySelector('.tree-row-label'), row);
    }
  }
}

function deleteCustomRow(row){
  mapping.customRows = mapping.customRows.filter(r => r.id !== row.id);
  saveMapping();
  renderCustomRows();
  renderTabs();
  renderBulkBar();
}

// Reorders any row (real or custom) relative to the FULL combined list for its
// tab+section — real rows included, custom rows included — so ↑/↓ always means "up in
// the final sheet", not just within whichever sub-view happens to be showing it.
function nudgeRowOrder(row, dir){
  const sectioned = sectionsEnabled();
  const combined = sectioned ? allRowsForSection(row.tabId, row.section) : allRowsForTab(row.tabId);
  const idx = combined.indexOf(row);
  const swapIdx = idx + dir;
  if(swapIdx < 0 || swapIdx >= combined.length) return;
  const other = combined[swapIdx];
  if(sectioned){ const tmp = row.order; row.order = other.order; other.order = tmp; }
  else { const tmp = row.flatOrder; row.flatOrder = other.flatOrder; other.flatOrder = tmp; }
  saveMapping();
  renderRows();
  renderCustomRows();
}

