// ---------- Multi-select + bulk move ----------
// Row ids (real or custom — both use the same {id, tabId, section, order} shape) the
// user has checked, for a bulk "Move to Top/Bottom" or a relocation to a different
// tab/section. Purely transient UI state — never saved to the mapping.
let selectedRowIds = new Set();

function findRowById(id){
  return mapping.rows.find(r => r.id === id) || mapping.customRows.find(r => r.id === id) || inputMirrorRows().find(r => r.id === id) || null;
}

function isRowSelected(id){ return selectedRowIds.has(id); }

function setRowSelected(id, on){
  if(on) selectedRowIds.add(id); else selectedRowIds.delete(id);
  renderBulkBar();
}

function clearSelection(){
  if(selectedRowIds.size === 0) return;
  selectedRowIds.clear();
  renderBulkBar();
  renderRows();
  renderCustomRows();
}

// Moves `ids` into the (tabId, section) group, preserving their relative order among
// themselves, inserted at `targetIndex` among the rows already there (0 = top; a value
// >= the group's size clamps to the bottom). A row whose current tabId/section differs
// is retargeted as part of the move — this is what lets a selection be relocated to a
// different tab or section, not just reordered within its current one. Order values for
// the whole affected group are renumbered as a clean 0..n-1 sequence afterward.
// `section` is only meaningful in sectioned mode — in flat mode it's ignored and a
// row's own `section` tag is left untouched (it's informational only at that point).
function relocateRows(ids, tabId, section, targetIndex){
  // An Inputs-tab row (a mirror of an input rectangle) only ever lives on the Inputs tab,
  // and only in its Input band — it can be reordered there, never moved elsewhere.
  const idSet = new Set([...(ids instanceof Set ? ids : new Set(ids))].filter(id => {
    const r = findRowById(id);
    return !(r && r.isInputMirror && (tabId !== r.tabId || (sectionsEnabled() && section !== 'input')));
  }));
  if(idSet.size === 0) return;
  const sectioned = sectionsEnabled();
  idSet.forEach(id => {
    const row = findRowById(id);
    if(!row) return;
    row.tabId = tabId;
    if(sectioned) row.section = section;
  });
  const combined = sectioned ? allRowsForSection(tabId, section) : allRowsForTab(tabId);
  const moving = combined.filter(r => idSet.has(r.id));
  const staying = combined.filter(r => !idSet.has(r.id));
  const clamped = Math.max(0, Math.min(targetIndex, staying.length));
  const result = staying.slice(0, clamped).concat(moving, staying.slice(clamped));
  if(sectioned) result.forEach((r, i) => { r.order = i; });
  else result.forEach((r, i) => { r.flatOrder = i; });
  saveMapping();
}

// Groups the current selection by each row's own group — (tabId, section) in sectioned
// mode, tabId alone in flat mode — used by "Move Up/Down" and "Move to Top/Bottom",
// which each act within whichever group(s) the selection is already in (possibly
// several at once) rather than relocating it.
function selectedRowsByGroup(){
  const sectioned = sectionsEnabled();
  const groups = new Map();
  selectedRowIds.forEach(id => {
    const row = findRowById(id);
    if(!row) return;
    const key = sectioned ? (row.tabId + '|' + row.section) : row.tabId;
    if(!groups.has(key)) groups.set(key, { tabId: row.tabId, section: row.section, ids: [] });
    groups.get(key).ids.push(id);
  });
  return [...groups.values()];
}

function bulkMoveSelected(edge){ // edge: 'top' | 'bottom'
  selectedRowsByGroup().forEach(g => {
    relocateRows(g.ids, g.tabId, g.section, edge === 'top' ? 0 : Number.MAX_SAFE_INTEGER);
  });
  renderRows();
  renderCustomRows();
  renderTabs();
  renderBulkBar();
}

// Relocates the whole current selection to a different tab (and section, in sectioned
// mode) in one action — the destination picker in the bulk bar drives this. Always
// lands at the top or bottom of the destination group; fine-tune afterward with a
// row's own ↑/↓, "Move Up/Down", or another bulk move.
function moveSelectedToDestination(tabId, section, edge){ // edge: 'top' | 'bottom'
  relocateRows(selectedRowIds, tabId, section, edge === 'top' ? 0 : Number.MAX_SAFE_INTEGER);
  clearSelection();
  renderTabs();
}

// Moves the WHOLE selection up or down by exactly one slot within its own group, as a
// block, preserving the selected rows' relative order among themselves and closing the
// gap left behind — the standard "reorder selected playlist items" algorithm: sweep the
// array in the direction of travel and swap each selected item past its immediate
// unselected neighbor. A single pass correctly handles a non-contiguous selection (e.g.
// rows 2 and 4 of 5) without the moving items colliding with each other.
function swapSelectionOneStep(arr, idSet, dir){
  const a = arr.slice();
  if(dir < 0){
    for(let i = 1; i < a.length; i++){
      if(idSet.has(a[i].id) && !idSet.has(a[i - 1].id)){ const t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; }
    }
  } else {
    for(let i = a.length - 2; i >= 0; i--){
      if(idSet.has(a[i].id) && !idSet.has(a[i + 1].id)){ const t = a[i + 1]; a[i + 1] = a[i]; a[i] = t; }
    }
  }
  return a;
}

function bulkNudgeSelected(dir){ // dir: -1 up, +1 down
  const sectioned = sectionsEnabled();
  selectedRowsByGroup().forEach(g => {
    const idSet = new Set(g.ids);
    if(sectioned){
      const combined = allRowsForSection(g.tabId, g.section);
      swapSelectionOneStep(combined, idSet, dir).forEach((r, i) => { r.order = i; });
    } else {
      const combined = allRowsForTab(g.tabId);
      swapSelectionOneStep(combined, idSet, dir).forEach((r, i) => { r.flatOrder = i; });
    }
  });
  saveMapping();
  renderRows();
  renderCustomRows();
  renderBulkBar();
}

// Sets Include on/off for every selected REAL row. Custom rows have no Include concept
// and are silently skipped; a row already inlined as a constant is also skipped — its
// Include is moot (always effectively excluded from the sheet regardless, per
// combinedRowsFor) and the single-row checkbox already keeps it disabled/true, so a bulk
// action shouldn't quietly change what happens if it's later un-inlined.
function bulkSetInclude(value){
  selectedRowIds.forEach(id => {
    const row = findRowById(id);
    if(!row || row.isCustom || row.inlineConstant) return;
    row.include = value;
  });
  saveMapping();
  renderRows();
  renderCustomRows();
  renderBulkBar();
}

// Sets "inline as constant" on/off for every selected row that's actually eligible — a
// true input (a value rectangle with zero incoming edges), the exact same rule the
// per-row Constant checkbox already enforces (see buildCanvasViewRowTR). Anything else in
// the selection (a custom row, a formula-driven row) is silently skipped rather than
// erroring, so a mixed selection just applies to whichever rows qualify.
function bulkSetInlineConstant(value){
  selectedRowIds.forEach(id => {
    const row = findRowById(id);
    if(!row || row.isCustom) return;
    const canvas = model.canvases.find(c => c.id === row.canvasId);
    const node = canvas && canvas.nodes.find(n => n.id === row.nodeId);
    const isTrueInput = !!node && !!canvas && isInputRectangle(canvas, node);
    if(!isTrueInput) return;
    row.inlineConstant = value;
    if(value) row.include = true; // mirrors the single-row checkbox's side effect
  });
  saveMapping();
  renderRows();
  renderCustomRows();
  renderBulkBar();
}


// ============================================================
// Row sorting ("Sort rows by…") — a one-shot action that rewrites the active order
// dimension (`order` per tab+section when sections are enforced, `flatOrder` per tab
// otherwise). Custom/label rows are PINNED: they keep their slot index and the sorted
// rectangle rows flow around them, so a hand-placed banner stays where it was put.
// Scope is one tab, every tab, or just the selected rows (which are re-sorted among the
// slots they already occupy; nothing else moves).
// ============================================================
const SORT_METHODS = [
  ['posYX',  'Canvas position: top → bottom'],
  ['posXY',  'Canvas position: left → right'],
  ['calcUp', 'Calculation order: inputs first'],
  ['calcDown', 'Calculation order: results first'],
  ['alpha',  'Alphabetical (A → Z)']
];
const SORT_WITHIN = [
  ['alpha', 'A → Z within each group'],
  ['formula', 'Formula order within each group']
];
let lastSortUndo = null; // { snapshot: {id: [order, flatOrder]}, label } — transient, never saved

// Builds a lazy, memoized "which rows does this row's formula reference" lookup, by
// running the SAME formula builders generation uses (buildCellContent /
// buildVerticalCombinedFormula → operandRef) against a ctx with an onRef hook. So every
// inlining rule — operators, aliases, block ports, vertical vintages, inlined constants —
// is followed exactly as the Excel formulas follow it, and operands come back in formula
// order (operators already read their inputs left-to-right by x). A reference reached
// through a Period Shift is a prior-period link, not a same-period dependency, and is
// dropped (otherwise a corkscrew would be a loop).
function rowDependencyTracer(){
  const inlineConstantIds = new Set(mapping.rows.filter(r => r.inlineConstant).map(r => r.id));
  const rowById = {}; mapping.rows.forEach(r => rowById[r.id] = r);
  const nP = model.periods.length;
  // A row's references can only change across periods at a period-shift boundary or a
  // literalPeriods-restricted period, so a sample of periods is enough — every period
  // for a normal-length timeline, first 12 + last for a very long one.
  const periods = [];
  for(let p = 0; p < nP && p < 36; p++) periods.push(p);
  if(nP > 36){ periods.length = 12; periods.push(nP - 1); }
  const memo = {};
  return function depsOf(id){
    if(memo[id]) return memo[id];
    const row = rowById[id];
    const found = [];
    const seen = new Set();
    memo[id] = found; // set before tracing, so a (malformed) self-reference can't recurse
    if(!row) return found;
    const n = irNode(row.canvasId, row.nodeId);
    const node = n && n.node;
    if(!node) return found;
    const ctx = {
      cellPos: {}, periodCount: nP, inlineConstantIds, lagDepth: 0,
      onRef(key, lagged){
        if(lagged || key === id || seen.has(key) || !rowById[key]) return;
        seen.add(key); found.push(key);
      }
    };
    periods.forEach(p => {
      try{
        if(row.verticalCombined) buildVerticalCombinedFormula(row.canvasId, node, p, ctx, '', row.path);
        else buildCellContent(row.canvasId, node, p, ctx, '', row.path);
      }catch(err){ /* a malformed graph just yields fewer dependencies */ }
    });
    return found;
  };
}

const labelCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function rowNodeOf(row){
  const c = model.canvases.find(x => x.id === row.canvasId);
  return c ? c.nodes.find(n => n.id === row.nodeId) : null;
}

// Orders `targets` (real rows, given in their current order) by `method`. For the
// calculation orders, `universe` is every real row in the targets' tab (current order):
// the chain is laid out across the whole tab and the targets take their relative order
// from it — so with sections enforced, the Input band still lists inputs in the order
// the calculations use them, even though inputs never reference each other.
function sortTargetRows(targets, method, within, depsOf, universe){
  const curIndex = new Map(targets.map((r, i) => [r.id, i]));
  if(method === 'alpha'){
    return keepVintageRunsTogether(targets.slice().sort((a, b) => labelCollator.compare(a.label || '', b.label || '') || (curIndex.get(a.id) - curIndex.get(b.id))));
  }
  if(method === 'posYX' || method === 'posXY'){
    const pos = new Map(targets.map(r => { const n = rowNodeOf(r); return [r.id, n ? { x: n.x, y: n.y } : { x: Infinity, y: Infinity }]; }));
    const vint = r => r.verticalCombined ? Infinity : (typeof r.verticalVintage === 'number' ? r.verticalVintage : 0);
    return targets.slice().sort((a, b) => {
      // Vertical block rows keep their default shape: shared rows first, then each
      // line item's Vintage 1..N run with its Total last.
      const sa = a.verticalShared ? 0 : 1, sb = b.verticalShared ? 0 : 1;
      if(sa !== sb) return sa - sb;
      const pa = pos.get(a.id), pb = pos.get(b.id);
      const primary = method === 'posYX' ? ((pa.y - pb.y) || (pa.x - pb.x)) : ((pa.x - pb.x) || (pa.y - pb.y));
      if(primary) return primary;
      return (vint(a) - vint(b)) || (curIndex.get(a.id) - curIndex.get(b.id));
    });
  }
  // --- Calculation order ---
  const seq = calcSequence(universe || targets, method, within, depsOf);
  const rank = new Map(seq.map((r, i) => [r.id, i]));
  return keepVintageRunsTogether(targets.slice().sort((a, b) =>
    ((rank.has(a.id) ? rank.get(a.id) : Infinity) - (rank.has(b.id) ? rank.get(b.id) : Infinity)) || (curIndex.get(a.id) - curIndex.get(b.id))));
}

// A vertical block's line item is one run of rows — Vintage 1..N, then its Total — and must
// stay one run in the sheet: each run goes where its first row landed, in vintage order.
function keepVintageRunsTogether(sorted){
  const runKey = r => (typeof r.verticalVintage === 'number' || r.verticalCombined)
    ? r.canvasId + '|' + r.nodeId + '|' + (r.path || []).map(h => h.canvasId + '/' + h.nodeId).join('>') : null;
  const vint = r => r.verticalCombined ? Infinity : r.verticalVintage;
  const runs = new Map();
  sorted.forEach(r => { const k = runKey(r); if(k){ if(!runs.has(k)) runs.set(k, []); runs.get(k).push(r); } });
  runs.forEach(list => list.sort((a, b) => vint(a) - vint(b)));
  const out = [], placed = new Set();
  sorted.forEach(r => {
    const k = runKey(r);
    if(!k){ out.push(r); return; }
    if(placed.has(k)) return;
    placed.add(k);
    out.push(...runs.get(k));
  });
  return out;
}

function calcSequence(targets, method, within, depsOf){
  const rowById = {}; mapping.rows.forEach(r => rowById[r.id] = r);
  const inT = new Set(targets.map(r => r.id));
  const kidsOf = (id) => {
    const deps = depsOf(id);
    if(within !== 'alpha') return deps;
    return deps.slice().sort((a, b) => labelCollator.compare((rowById[a] && rowById[a].label) || '', (rowById[b] && rowById[b].label) || '') || (deps.indexOf(a) - deps.indexOf(b)));
  };
  // Roots = targets that no other target needs (directly, or through rows outside the
  // scope — e.g. another tab or section). Taken in their current order.
  const reached = new Set();
  const stack = [];
  targets.forEach(t => depsOf(t.id).forEach(d => stack.push(d)));
  while(stack.length){
    const k = stack.pop();
    if(reached.has(k)) continue;
    reached.add(k);
    depsOf(k).forEach(d => { if(!reached.has(d)) stack.push(d); });
  }
  const out = [];
  const emitted = new Set();
  const emit = (id) => { if(inT.has(id) && !emitted.has(id)){ emitted.add(id); out.push(rowById[id]); } };
  const expanded = new Set();
  if(method === 'calcUp'){
    // Everything a row's inputs depend on first, then its inputs together as one
    // group, then the row itself — e.g. Unit Price, Volume, AR rate, Revenue, then
    // AR / Cash / Inventory side by side, then Total Assets.
    const prereqs = (id) => {
      if(expanded.has(id)) return;
      expanded.add(id);
      const kids = kidsOf(id);
      kids.forEach(prereqs);
      kids.forEach(emit);
    };
    const runRoot = (id) => { prereqs(id); emit(id); };
    targets.forEach(t => { if(!reached.has(t.id)) runRoot(t.id); });
    targets.forEach(t => runRoot(t.id)); // anything left (only possible in a cycle)
  } else {
    // Mirror image, read top-down: the result, then its inputs as one group, then each
    // input's own inputs as a group, and so on.
    const visit = (id) => {
      if(expanded.has(id)) return;
      expanded.add(id);
      const kids = kidsOf(id);
      kids.forEach(emit);
      kids.forEach(visit);
    };
    const runRoot = (id) => { emit(id); visit(id); };
    targets.forEach(t => { if(!reached.has(t.id)) runRoot(t.id); });
    targets.forEach(t => runRoot(t.id));
  }
  return out;
}

// scope: 'all' | 'tab:<tabId>' | 'selection'
function applyRowSort(method, within, scope){
  const { snapshot, moved, sortedCount } = sortRows(method, within, scope);
  const methodLabel = (SORT_METHODS.find(m => m[0] === method) || [, method])[1];
  lastSortUndo = { snapshot };
  saveMapping();
  renderRows(); renderCustomRows(); renderBulkBar();
  const msg = sortedCount === 0 ? 'Nothing to sort in that scope.'
    : `Sorted ${sortedCount} row${sortedCount === 1 ? '' : 's'} — ${methodLabel}${moved === 0 ? ' (already in that order)' : ''}.`;
  renderSortStatus(msg, sortedCount > 0 && moved > 0);
}

// A new layout (never saved for this model, or just reset) starts in calculation order,
// inputs first, formula order within each group — the sort a person would otherwise apply
// first. Nothing is saved: as before, the first real edit saves the layout.
const NEW_LAYOUT_SORT = ['calcUp', 'formula', 'all'];
// Both orders are sorted (with sections and without), so switching sections on or off later
// keeps the same reading order.
function sortNewLayout(){
  const was = mapping.cfg.sectionsEnabled;
  [true, false].forEach(on => { mapping.cfg.sectionsEnabled = on; sortRows(...NEW_LAYOUT_SORT); });
  mapping.cfg.sectionsEnabled = was;
}

// The sort itself: rewrites the order of the rows in scope and returns
// { snapshot (the orders before), moved, sortedCount }. No saving, no drawing.
function sortRows(method, within, scope){
  const sectioned = sectionsEnabled();
  const tabIds = scope === 'all' ? mapping.tabs.filter(t => t.id !== INPUTS_TAB_ID).map(t => t.id)
    : scope.startsWith('tab:') ? [scope.slice(4)]
    : [...new Set([...selectedRowIds].map(id => findRowById(id)).filter(Boolean).map(r => r.tabId))];
  const snapshot = {};
  [...mapping.rows, ...mapping.customRows, ...inputMirrorRows()].forEach(r => { snapshot[r.id] = [r.order, r.flatOrder]; });
  const depsOf = (method === 'calcUp' || method === 'calcDown') ? rowDependencyTracer() : null;
  let moved = 0, sortedCount = 0;
  tabIds.forEach(tabId => {
    const lists = sectioned ? ['input', 'calc', 'output'].map(sec => allRowsForSection(tabId, sec)) : [allRowsForTab(tabId)];
    lists.forEach(list => {
      const isTarget = r => !r.isCustom && !r.isInputMirror && (scope !== 'selection' || selectedRowIds.has(r.id));
      const targets = list.filter(isTarget);
      if(targets.length === 0) return;
      const universe = allRowsForTab(tabId).filter(r => !r.isCustom);
      const sorted = sortTargetRows(targets, method, within, depsOf, universe);
      let k = 0;
      const result = list.map(r => isTarget(r) ? sorted[k++] : r);
      result.forEach((r, i) => {
        if(list[i] !== r) moved++;
        if(sectioned) r.order = i; else r.flatOrder = i;
      });
      sortedCount += targets.length;
    });
  });
  return { snapshot, moved, sortedCount };
}

function undoLastSort(){
  if(!lastSortUndo) return;
  const snap = lastSortUndo.snapshot;
  [...mapping.rows, ...mapping.customRows, ...inputMirrorRows()].forEach(r => {
    if(snap[r.id]){ r.order = snap[r.id][0]; r.flatOrder = snap[r.id][1]; }
  });
  lastSortUndo = null;
  mapping.tabs.forEach(t => { ensureSectionOrderAll(t.id); ensureFlatOrder(t.id); });
  saveMapping();
  renderRows(); renderCustomRows(); renderBulkBar();
  renderSortStatus('Sort undone.', false);
}

function renderSortStatus(msg, offerUndo){
  const el = $('sortStatus');
  el.innerHTML = '';
  if(!msg) return;
  const span = document.createElement('span'); span.textContent = msg;
  el.appendChild(span);
  if(offerUndo && lastSortUndo){
    const b = document.createElement('button'); b.className = 'icon'; b.textContent = '↶ Undo';
    b.style.marginLeft = '8px';
    b.addEventListener('click', undoLastSort);
    el.appendChild(b);
  }
}

// Keeps the method/within/scope pickers in sync with the mapping (tab names, the
// current selection's size, the remembered method). Called from every render that can
// change any of those.
function refreshSortControls(){
  if(!mapping) return;
  const mSel = $('sortMethod'), wSel = $('sortWithin'), sSel = $('sortScope');
  if(!mSel.options.length){
    SORT_METHODS.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; mSel.appendChild(o); });
    SORT_WITHIN.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; wSel.appendChild(o); });
  }
  mSel.value = mapping.cfg.sortMethod || 'calcUp';
  wSel.value = mapping.cfg.sortWithin || 'formula';
  wSel.classList.toggle('hidden', !(mSel.value === 'calcUp' || mSel.value === 'calcDown'));
  const prev = sSel.value;
  sSel.innerHTML = '';
  const add = (v, l, disabled) => { const o = document.createElement('option'); o.value = v; o.textContent = l; o.disabled = !!disabled; sSel.appendChild(o); };
  add('all', 'All tabs');
  mapping.tabs.slice().sort((a, b) => a.order - b.order).filter(t => t.id !== INPUTS_TAB_ID).forEach(t => add('tab:' + t.id, 'Tab: ' + t.name));
  const nSel = [...selectedRowIds].filter(id => { const r = findRowById(id); return r && !r.isCustom && !r.isInputMirror; }).length;
  add('selection', nSel ? `Selected rows (${nSel})` : 'Selected rows (none)', nSel === 0);
  const still = [...sSel.options].find(o => o.value === prev && !o.disabled);
  sSel.value = still ? prev : (nSel && prev === 'selection' ? 'selection' : 'all');
}

function renderBulkBar(){
  // Drop selections pointing at a row deleted since it was checked (a deleted custom
  // row, or a tab/canvas that's gone) so the count and any bulk action stay accurate.
  selectedRowIds.forEach(id => { if(!findRowById(id)) selectedRowIds.delete(id); });
  refreshSortControls();
  const bar = $('bulkMoveBar');
  const n = selectedRowIds.size;
  if(n === 0){ bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = '';
  const sectioned = sectionsEnabled();
  const groupNoun = sectioned ? 'section' : 'tab';

  const summary = document.createElement('span');
  summary.style.cssText = 'font-size:12.5px; font-weight:600; color:#3730a3;';
  summary.textContent = n + ' row' + (n === 1 ? '' : 's') + ' selected';
  bar.appendChild(summary);

  const upBtn = document.createElement('button'); upBtn.className = 'icon'; upBtn.textContent = '▲ Move Up';
  upBtn.title = 'Move the selected rows up by one position within their own ' + groupNoun + ' (each group moves independently)';
  upBtn.addEventListener('click', () => bulkNudgeSelected(-1));
  bar.appendChild(upBtn);

  const dnBtn = document.createElement('button'); dnBtn.className = 'icon'; dnBtn.textContent = '▼ Move Down';
  dnBtn.title = 'Move the selected rows down by one position within their own ' + groupNoun + ' (each group moves independently)';
  dnBtn.addEventListener('click', () => bulkNudgeSelected(1));
  bar.appendChild(dnBtn);

  const topBtn = document.createElement('button'); topBtn.className = 'icon'; topBtn.textContent = '⤒ Move to Top';
  topBtn.title = 'Move the selected rows to the top of their own ' + groupNoun + ' (each group moves independently)';
  topBtn.addEventListener('click', () => bulkMoveSelected('top'));
  bar.appendChild(topBtn);

  const botBtn = document.createElement('button'); botBtn.className = 'icon'; botBtn.textContent = '⤓ Move to Bottom';
  botBtn.title = 'Move the selected rows to the bottom of their own ' + groupNoun + ' (each group moves independently)';
  botBtn.addEventListener('click', () => bulkMoveSelected('bottom'));
  bar.appendChild(botBtn);

  const divider1 = document.createElement('span'); divider1.className = 'bulk-divider';
  bar.appendChild(divider1);

  const incBtn = document.createElement('button'); incBtn.className = 'icon'; incBtn.textContent = '☑ Include';
  incBtn.title = 'Set Include on for every selected row (custom rows, and rows already inlined as a constant, are skipped)';
  incBtn.addEventListener('click', () => bulkSetInclude(true));
  bar.appendChild(incBtn);

  const excBtn = document.createElement('button'); excBtn.className = 'icon'; excBtn.textContent = '☐ Exclude';
  excBtn.title = 'Set Include off for every selected row (custom rows, and rows already inlined as a constant, are skipped)';
  excBtn.addEventListener('click', () => bulkSetInclude(false));
  bar.appendChild(excBtn);

  const constOnBtn = document.createElement('button'); constOnBtn.className = 'icon'; constOnBtn.textContent = '◆ Mark Constant';
  constOnBtn.title = 'Inline every eligible selected row (a true input, no incoming edge) directly into referencing formulas — skips anything else in the selection';
  constOnBtn.addEventListener('click', () => bulkSetInlineConstant(true));
  bar.appendChild(constOnBtn);

  const constOffBtn = document.createElement('button'); constOffBtn.className = 'icon'; constOffBtn.textContent = '◇ Unmark Constant';
  constOffBtn.title = 'Turn off "inline as constant" for every selected row that currently has it set';
  constOffBtn.addEventListener('click', () => bulkSetInlineConstant(false));
  bar.appendChild(constOffBtn);

  if([...selectedRowIds].some(id => { const r = findRowById(id); return r && r.isInputMirror; })){
    const dv = document.createElement('span'); dv.className = 'bulk-divider'; bar.appendChild(dv);
    const sOn = document.createElement('button'); sOn.className = 'icon'; sOn.textContent = '≡ Add Scenarios';
    sOn.title = 'Give every selected Inputs-tab row ' + defaultScenarioCount() + ' scenarios (the default set in the Tabs panel)';
    sOn.addEventListener('click', () => bulkSetScenarios(true));
    bar.appendChild(sOn);
    const sOff = document.createElement('button'); sOff.className = 'icon'; sOff.textContent = 'Remove Scenarios';
    sOff.addEventListener('click', () => bulkSetScenarios(false));
    bar.appendChild(sOff);
  }

  const dvIndent = document.createElement('span'); dvIndent.className = 'bulk-divider'; bar.appendChild(dvIndent);
  const indBtn = document.createElement('button'); indBtn.className = 'icon'; indBtn.textContent = '⇥ Indent';
  indBtn.title = 'Indent the selected rows\' labels one step in Excel, like Excel\'s Increase Indent (Alt+Shift+→ here)';
  indBtn.addEventListener('click', () => bulkIndentSelected(1));
  bar.appendChild(indBtn);
  const outBtn = document.createElement('button'); outBtn.className = 'icon'; outBtn.textContent = '⇤ Outdent';
  outBtn.title = 'Take one step of indent off the selected rows\' labels (Alt+Shift+← here)';
  outBtn.addEventListener('click', () => bulkIndentSelected(-1));
  bar.appendChild(outBtn);

  const divider2 = document.createElement('span'); divider2.className = 'bulk-divider';
  bar.appendChild(divider2);

  const destWrap = document.createElement('span');
  destWrap.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin-left:4px;';
  const destLabel = document.createElement('span');
  destLabel.style.cssText = 'font-size:12px; color:var(--muted);';
  destLabel.textContent = 'Move to:';
  destWrap.appendChild(destLabel);

  const tabSel = document.createElement('select');
  mapping.tabs.slice().sort((a, b) => a.order - b.order).forEach(t => {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; tabSel.appendChild(o);
  });
  destWrap.appendChild(tabSel);

  // Only meaningful in sectioned mode — a flat-mode destination is just a tab.
  let secSel = null;
  if(sectioned){
    secSel = document.createElement('select');
    [['input', 'Input'], ['calc', 'Calc'], ['output', 'Output']].forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; secSel.appendChild(o);
    });
    destWrap.appendChild(secSel);
  }

  const placeTopBtn = document.createElement('button'); placeTopBtn.className = 'icon'; placeTopBtn.textContent = 'at top';
  placeTopBtn.addEventListener('click', () => moveSelectedToDestination(tabSel.value, secSel ? secSel.value : null, 'top'));
  destWrap.appendChild(placeTopBtn);

  const placeBotBtn = document.createElement('button'); placeBotBtn.className = 'icon'; placeBotBtn.textContent = 'at bottom';
  placeBotBtn.addEventListener('click', () => moveSelectedToDestination(tabSel.value, secSel ? secSel.value : null, 'bottom'));
  destWrap.appendChild(placeBotBtn);

  bar.appendChild(destWrap);

  const spacer = document.createElement('span'); spacer.style.cssText = 'flex:1 1 auto;';
  bar.appendChild(spacer);

  const clearBtn = document.createElement('button'); clearBtn.className = 'icon'; clearBtn.textContent = 'Clear selection';
  clearBtn.addEventListener('click', clearSelection);
  bar.appendChild(clearBtn);
}

// ---------- Sample model ----------
function sampleModel(){
  return {
    version: 2, kind: 'system', periods: ['P1', 'P2', 'P3', 'P4', 'P5'], currentPeriod: 0,
    canvases: [
      {
        id: 'cRev', name: 'Revenue Model',
        nodes: [
          { id: 'unitPrice', type: 'value', x: 80, y: 60, text: 'Unit Price\n50\n$/t' },
          { id: 'volume', type: 'value', x: 80, y: 190, text: 'Volume\n1200\nkt' },
          { id: 'mul', type: 'operator', x: 380, y: 120, text: '×' },
          { id: 'revenue', type: 'value', x: 620, y: 120, text: 'Revenue' },
        ],
        edges: [
          { id: 'e1', from: 'unitPrice', to: 'mul' },
          { id: 'e2', from: 'volume', to: 'mul' },
          { id: 'e3', from: 'mul', to: 'revenue' },
        ]
      },
      {
        id: 'cCork', name: 'Cash Corkscrew',
        nodes: [
          { id: 'bb', type: 'value', x: 80, y: 40, text: 'Beginning Balance\n1000', literalPeriods: [0] },
          { id: 'add', type: 'value', x: 80, y: 160, text: 'Additions\n200' },
          { id: 'opAdd', type: 'operator', x: 280, y: 100, text: '+' },
          { id: 'sub', type: 'value', x: 480, y: 280, text: 'Subtractions\n50' },
          { id: 'opSub', type: 'operator', x: 680, y: 190, text: '−' },
          { id: 'eb', type: 'value', x: 880, y: 190, text: 'Ending Balance' },
          { id: 'shift', type: 'periodShift', x: 880, y: 320, text: '', shift: -1 },
        ],
        edges: [
          { id: 'c1', from: 'bb', to: 'opAdd' }, { id: 'c2', from: 'add', to: 'opAdd' },
          { id: 'c3', from: 'opAdd', to: 'opSub' }, { id: 'c4', from: 'sub', to: 'opSub' },
          { id: 'c5', from: 'opSub', to: 'eb' }, { id: 'c6', from: 'eb', to: 'shift' },
          { id: 'c7', from: 'shift', to: 'bb' },
        ]
      },
      {
        id: 'cSum', name: 'Summary',
        nodes: [ { id: 'revAlias', type: 'alias', x: 80, y: 60, text: 'Total Revenue', sourceCanvasId: 'cRev', sourceNodeId: 'revenue' } ],
        edges: []
      }
    ]
  };
}

