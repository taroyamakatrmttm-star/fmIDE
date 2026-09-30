// ============================================================
// Rendering
// ============================================================
function renderAll(){
  $('afterLoad').classList.remove('hidden');
  $('periodCountLabel').textContent = model.periods.length;
  $('cfgStartLabel').value = mapping.cfg.startLabel;
  $('cfgFrequency').value = mapping.cfg.frequency;
  $('cfgFallbackFormat').value = mapping.cfg.fallbackFormat;
  $('cfgFileName').value = mapping.cfg.fileName;
  $('cfgSectionsEnabled').checked = sectionsEnabled();
  renderExcelStyle();
  renderModuleLayoutsInfo();
  selectedRowIds.clear(); // a freshly (re)loaded model invalidates any prior selection
  treeCollapsedTabIds.clear();
  treeAnchorIndex = null;
  lastSortUndo = null; renderSortStatus('', false);
  renderTabs();
  renderRows();
  renderCustomRows();
  renderBulkBar();
}

function renderTabs(){
  refreshSortControls(); // tab names/order feed the sort scope picker
  renderInputsSettings();
  const body = $('tabsBody');
  body.innerHTML = '';
  mapping.tabs.slice().sort((a, b) => a.order - b.order).forEach((tab, idx, arr) => {
    const rowCount = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tab.id && r.include).length + mapping.customRows.filter(r => r.tabId === tab.id).length;
    const isInputsTab = tab.id === INPUTS_TAB_ID;
    const tr = document.createElement('tr');

    const tdHandle = document.createElement('td');
    const upBtn = document.createElement('button'); upBtn.className = 'icon'; upBtn.textContent = '↑'; upBtn.disabled = idx === 0;
    const dnBtn = document.createElement('button'); dnBtn.className = 'icon'; dnBtn.textContent = '↓'; dnBtn.disabled = idx === arr.length - 1;
    upBtn.addEventListener('click', () => { swapTabOrder(tab, arr[idx - 1]); });
    dnBtn.addEventListener('click', () => { swapTabOrder(tab, arr[idx + 1]); });
    tdHandle.appendChild(upBtn); tdHandle.appendChild(dnBtn);
    tr.appendChild(tdHandle);

    const tdName = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = tab.name;
    nameInput.addEventListener('change', () => {
      if(isInputsTab){ setInputsTabName(nameInput.value); return; }
      tab.name = sanitizeSheetName(nameInput.value); nameInput.value = tab.name; saveMapping(); renderRows();
    });
    tdName.appendChild(nameInput);
    const modTag = moduleTabTag(tab);
    if(modTag) tdName.appendChild(modTag);
    tr.appendChild(tdName);

    const tdCount = document.createElement('td'); tdCount.textContent = rowCount + ' row' + (rowCount === 1 ? '' : 's');
    if(isInputsTab){ const tg = document.createElement('span'); tg.className = 'link-tag'; tg.textContent = 'Inputs'; tg.title = 'Gathered input rows — see the settings below'; const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex; align-items:center; gap:8px;'; wrap.appendChild(nameInput); wrap.appendChild(tg); tdName.appendChild(wrap); }
    tr.appendChild(tdCount);

    const tdActions = document.createElement('td');
    const delBtn = document.createElement('button'); delBtn.className = 'icon danger'; delBtn.textContent = '🗑 Delete';
    delBtn.disabled = arr.length <= 1 || isInputsTab;
    delBtn.title = isInputsTab ? 'Turn this tab off with "Gather inputs on a separate tab" below'
      : arr.length <= 1 ? 'At least one tab is required' : 'Delete this tab (its rows move to the first remaining tab)';
    delBtn.addEventListener('click', () => {
      const fallback = arr.find(t => t.id !== tab.id);
      mapping.rows.forEach(r => { if(r.tabId === tab.id) r.tabId = fallback.id; });
      mapping.customRows.forEach(r => { if(r.tabId === tab.id) r.tabId = fallback.id; });
      mapping.tabs = mapping.tabs.filter(t => t.id !== tab.id);
      saveMapping(); renderAll();
    });
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    body.appendChild(tr);
  });
}

function swapTabOrder(a, b){
  const tmp = a.order; a.order = b.order; b.order = tmp;
  saveMapping(); renderTabs(); renderRows();
}

// A full re-render tears down and rebuilds every .rows-scroll container (one per canvas
// group / tab group), which would otherwise silently reset its scroll position to the
// top — very annoying when nudging a row's order or bulk-moving on a long list. These
// capture each container's scrollTop (keyed by the stable canvas/tab id on its group
// wrapper) right before a render and restore it right after.
function captureScrollTops(container){
  const map = {};
  container.querySelectorAll('[data-scroll-key]').forEach(g => {
    const scrollEl = g.querySelector('.rows-scroll');
    if(scrollEl) map[g.getAttribute('data-scroll-key')] = scrollEl.scrollTop;
  });
  return map;
}
function restoreScrollTops(container, scrollTops){
  container.querySelectorAll('[data-scroll-key]').forEach(g => {
    const key = g.getAttribute('data-scroll-key');
    if(!Object.prototype.hasOwnProperty.call(scrollTops, key)) return;
    const scrollEl = g.querySelector('.rows-scroll');
    if(scrollEl) scrollEl.scrollTop = scrollTops[key];
  });
}

// Builds one editable <tr> for a real (non-custom) row in the canvas-view / block-
// instance-view tables — shared by both renderRows()'s per-canvas groups and
// renderBlockInstanceGroups()'s per-instance groups, which differ only in how rows
// are grouped, not in how a single row renders. `definitionCanvas` is the canvas
// that actually owns the underlying node (the row's own canvasId) — for an
// unpacked row this is the block's definition canvas, not whatever canvas the
// block instance itself sits on.
// Small badge for a row that belongs to a vertical block instance's unpacking — a
// "V<n>" tag on one vintage/run's copy of a node, a "Σ Total" tag on the combined
// row that reduces all of them, or a "Shared" tag on a node that's provably the same
// in every vintage and so only gets one row (see collectInstanceRows /
// buildVerticalCombinedFormula / isVintageVarying). Returns null for an ordinary row
// so callers can just skip appending it.
function buildVerticalRowTag(row, node){
  if(row.verticalCombined){
    const tag = document.createElement('span');
    tag.className = 'block-role-tag vertical-total';
    tag.textContent = 'Σ Total';
    tag.title = 'Combines every vintage/run of this vertical block instance via its reducer (' + ((node && node.verticalReducer) || 'sum') + ')';
    return tag;
  }
  if(row.verticalShared){
    const tag = document.createElement('span');
    tag.className = 'block-role-tag vertical-shared';
    tag.textContent = 'Shared';
    tag.title = 'Identical in every vintage/run of this vertical block instance, so it gets one row instead of one per vintage';
    return tag;
  }
  if(typeof row.verticalVintage === 'number'){
    const tag = document.createElement('span');
    tag.className = 'block-role-tag vertical-vintage';
    tag.textContent = 'V' + row.verticalVintage;
    tag.title = 'Vintage/run ' + row.verticalVintage + ' of a vertical block instance';
    return tag;
  }
  return null;
}

function buildCanvasViewRowTR(r, definitionCanvas, sortedTabs){
  const node = definitionCanvas.nodes.find(n => n.id === r.nodeId);
  const isTrueInput = !!node && isInputRectangle(definitionCanvas, node);
  const tr = document.createElement('tr');
  if(!r.include || r.inlineConstant) tr.classList.add('excluded');

  const tdSel = document.createElement('td');
  const selChk = document.createElement('input'); selChk.type = 'checkbox'; selChk.checked = isRowSelected(r.id);
  selChk.title = 'Select for a bulk move (Move to Top/Bottom, or relocate to another tab/section)';
  selChk.addEventListener('change', () => setRowSelected(r.id, selChk.checked));
  tdSel.appendChild(selChk);
  tr.appendChild(tdSel);

  const tdInc = document.createElement('td');
  const incChk = document.createElement('input'); incChk.type = 'checkbox'; incChk.checked = r.include;
  incChk.disabled = !!r.inlineConstant;
  incChk.title = r.inlineConstant ? 'Inlined as a constant — this rectangle never gets its own row' : '';
  incChk.addEventListener('change', () => { r.include = incChk.checked; saveMapping(); renderRows(); });
  tdInc.appendChild(incChk);
  tr.appendChild(tdInc);

  const tdLabel = document.createElement('td');
  const labelInput = document.createElement('input'); labelInput.type = 'text'; labelInput.value = r.label;
  if(rowIndent(r)) labelInput.style.textIndent = rowIndent(r) + 'em'; // the label's indent in Excel (set in the Tree view)
  labelInput.addEventListener('change', () => { r.label = labelInput.value; saveMapping(); });
  tdLabel.appendChild(labelInput);
  tr.appendChild(tdLabel);

  const tdType = document.createElement('td');
  tdType.textContent = node ? ({ value: 'Rectangle', alias: 'Alias', periodShift: 'Period Shift' }[node.type] || node.type) : '?';
  if(node && (node.blockRole === 'input' || node.blockRole === 'output')){
    const brTag = document.createElement('span');
    brTag.className = 'block-role-tag ' + node.blockRole;
    brTag.textContent = node.blockRole === 'input' ? 'Block In' : 'Block Out';
    brTag.title = 'Marked as a Block ' + (node.blockRole === 'input' ? 'Input' : 'Output') + ' in fmIDE\'s Block feature';
    tdType.appendChild(brTag);
  }
  const vTag = buildVerticalRowTag(r, node);
  if(vTag) tdType.appendChild(vTag);
  appendInputLinkTag(tdType, r);
  tr.appendChild(tdType);

  const tdTab = document.createElement('td');
  const tabSel = document.createElement('select');
  sortedTabs.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; tabSel.appendChild(o); });
  tabSel.value = r.tabId;
  tabSel.addEventListener('change', () => { r.tabId = tabSel.value; saveMapping(); renderTabs(); });
  tdTab.appendChild(tabSel);
  tr.appendChild(tdTab);

  const tdSection = document.createElement('td');
  tdSection.style.cssText = 'display:flex; align-items:center; gap:6px;';
  const secSel = document.createElement('select');
  [['input', 'Input'], ['calc', 'Calc'], ['output', 'Output']].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; secSel.appendChild(o); });
  secSel.value = r.section;
  secSel.addEventListener('change', () => { r.section = secSel.value; saveMapping(); renderRows(); });
  const tag = document.createElement('span'); tag.className = 'section-tag ' + r.section; tag.textContent = r.section;
  tdSection.appendChild(tag);
  tdSection.appendChild(secSel);
  tr.appendChild(tdSection);

  const tdOrder = document.createElement('td');
  const wrap = document.createElement('div'); wrap.className = 'order-btns';
  const upBtn = document.createElement('button'); upBtn.textContent = '↑';
  const dnBtn = document.createElement('button'); dnBtn.textContent = '↓';
  upBtn.addEventListener('click', () => { nudgeRowOrder(r, -1); });
  dnBtn.addEventListener('click', () => { nudgeRowOrder(r, 1); });
  wrap.appendChild(upBtn); wrap.appendChild(dnBtn);
  tdOrder.appendChild(wrap);
  tr.appendChild(tdOrder);

  const tdConst = document.createElement('td');
  const constChk = document.createElement('input'); constChk.type = 'checkbox'; constChk.checked = !!r.inlineConstant;
  constChk.disabled = !isTrueInput;
  constChk.title = isTrueInput
    ? 'Splice this rectangle\'s value directly into every formula that references it, instead of giving it its own row'
    : 'Only available for a true input (no incoming edge) — this rectangle is itself formula-driven';
  constChk.addEventListener('change', () => {
    r.inlineConstant = constChk.checked;
    if(r.inlineConstant) r.include = true; // include is moot once inlined, but keep it true so re-toggling off restores a normal row
    saveMapping(); renderRows();
  });
  tdConst.appendChild(constChk);
  tr.appendChild(tdConst);

  return tr;
}

function renderRows(){
  const container = $('rowGroups');
  const scrollTops = captureScrollTops(container);
  container.innerHTML = '';
  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  model.canvases.forEach(canvas => {
    // Only this canvas's OWN top-level rows (path is empty) — a canvas used as a
    // block definition still gets its normal standalone tab here; its per-instance
    // unpacked copies render separately below, in renderBlockInstanceGroups().
    const rowsForCanvas = mapping.rows.filter(r => r.canvasId === canvas.id && (!r.path || r.path.length === 0));
    if(rowsForCanvas.length === 0) return;
    const group = document.createElement('div');
    group.className = 'canvas-group';
    group.setAttribute('data-scroll-key', canvas.id);
    const header = document.createElement('div');
    header.className = 'canvas-group-header';
    setGroupHeader(header, canvas.name || canvas.id, `${rowsForCanvas.length} rectangle${rowsForCanvas.length === 1 ? '' : 's'}`);
    group.appendChild(header);

    const scroll = document.createElement('div'); scroll.className = 'rows-scroll';
    const table = document.createElement('table'); table.className = 'rows-table';
    table.innerHTML = '<thead><tr><th></th><th>Include</th><th>Row label</th><th>Type</th><th>Tab</th><th>Section</th><th>Order</th><th>Constant</th></tr></thead>';
    const tbody = document.createElement('tbody');

    const bySection = { input: [], calc: [], output: [] };
    rowsForCanvas.forEach(r => bySection[r.section].push(r));
    Object.values(bySection).forEach(arr => arr.sort((a, b) => a.order - b.order));
    const orderedRows = [...bySection.input, ...bySection.calc, ...bySection.output];

    orderedRows.forEach(r => tbody.appendChild(buildCanvasViewRowTR(r, canvas, sortedTabs)));
    table.appendChild(tbody);
    scroll.appendChild(table);
    group.appendChild(scroll);
    container.appendChild(group);
  });
  restoreScrollTops(container, scrollTops);
  renderBlockInstanceGroups();
  renderRowsByTab();
  renderTreeView();
  renderDifferences();
}

// Mirrors renderRows()'s per-canvas grouping, but one group per top-level block
// instance (identified by the FIRST hop of a row's path — a nested instance's rows
// are folded into its outermost ancestor's group rather than spawning their own,
// so a deeply-nested block doesn't fragment into many tiny sections). Every row
// still carries its own path, so a formula/cell reference across nesting levels
// stays fully correct regardless of how the rows are visually grouped here.
function renderBlockInstanceGroups(){
  const container = $('blockInstanceGroups');
  if(!container) return;
  const scrollTops = captureScrollTops(container);
  container.innerHTML = '';
  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  const canvasById = {}; model.canvases.forEach(c => canvasById[c.id] = c);

  const unpackedRows = mapping.rows.filter(r => r.path && r.path.length > 0);
  const groupKeyOf = r => r.path[0].canvasId + '|' + r.path[0].nodeId;
  const groupKeys = [...new Set(unpackedRows.map(groupKeyOf))];

  groupKeys.forEach(key => {
    const rowsForGroup = unpackedRows.filter(r => groupKeyOf(r) === key);
    const [hostCanvasId, hostNodeId] = [key.split('|')[0], key.split('|').slice(1).join('|')];
    const hostCanvas = canvasById[hostCanvasId];
    const hostNode = hostCanvas && hostCanvas.nodes.find(n => n.id === hostNodeId);
    const defCanvas = hostNode && canvasById[hostNode.blockDefCanvasId];
    const label = `▤ Block instance${hostNode && hostNode.vertical ? ' (vertical)' : ''} — ${defCanvas ? (defCanvas.name || defCanvas.id) : '?'} (used on '${hostCanvas ? (hostCanvas.name || hostCanvas.id) : '?'}')`;

    const group = document.createElement('div');
    group.className = 'canvas-group';
    group.setAttribute('data-scroll-key', 'blk_' + key);
    const header = document.createElement('div');
    header.className = 'canvas-group-header';
    setGroupHeader(header, label, `${rowsForGroup.length} rectangle${rowsForGroup.length === 1 ? '' : 's'}`);
    group.appendChild(header);

    const scroll = document.createElement('div'); scroll.className = 'rows-scroll';
    const table = document.createElement('table'); table.className = 'rows-table';
    table.innerHTML = '<thead><tr><th></th><th>Include</th><th>Row label</th><th>Type</th><th>Tab</th><th>Section</th><th>Order</th><th>Constant</th></tr></thead>';
    const tbody = document.createElement('tbody');

    const bySection = { input: [], calc: [], output: [] };
    rowsForGroup.forEach(r => bySection[r.section].push(r));
    Object.values(bySection).forEach(arr => arr.sort((a, b) => a.order - b.order));
    const orderedRows = [...bySection.input, ...bySection.calc, ...bySection.output];

    orderedRows.forEach(r => tbody.appendChild(buildCanvasViewRowTR(r, canvasById[r.canvasId], sortedTabs)));
    table.appendChild(tbody);
    scroll.appendChild(table);
    group.appendChild(scroll);
    container.appendChild(group);
  });
  restoreScrollTops(container, scrollTops);
}

function renderCustomRows(){
  const body = $('customRowsBody');
  body.innerHTML = '';
  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  mapping.customRows.forEach(row => {
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    const labelInput = document.createElement('input'); labelInput.type = 'text'; labelInput.value = row.label;
    if(rowIndent(row)) labelInput.style.textIndent = rowIndent(row) + 'em'; // the label's indent in Excel (set in the Tree view)
    labelInput.addEventListener('change', () => { row.label = labelInput.value; saveMapping(); });
    tdLabel.appendChild(labelInput);
    tr.appendChild(tdLabel);

    const tdTab = document.createElement('td');
    const tabSel = document.createElement('select');
    sortedTabs.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; tabSel.appendChild(o); });
    tabSel.value = row.tabId;
    tabSel.addEventListener('change', () => { row.tabId = tabSel.value; saveMapping(); renderTabs(); });
    tdTab.appendChild(tabSel);
    tr.appendChild(tdTab);

    const tdSection = document.createElement('td');
    tdSection.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const secSel = document.createElement('select');
    [['input', 'Input'], ['calc', 'Calc'], ['output', 'Output']].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; secSel.appendChild(o); });
    secSel.value = row.section;
    secSel.addEventListener('change', () => { row.section = secSel.value; saveMapping(); renderCustomRows(); });
    const tag = document.createElement('span'); tag.className = 'section-tag ' + row.section; tag.textContent = row.section;
    tdSection.appendChild(tag);
    tdSection.appendChild(secSel);
    tr.appendChild(tdSection);

    const tdOrder = document.createElement('td');
    const wrap = document.createElement('div'); wrap.className = 'order-btns';
    const upBtn = document.createElement('button'); upBtn.textContent = '↑';
    const dnBtn = document.createElement('button'); dnBtn.textContent = '↓';
    upBtn.addEventListener('click', () => nudgeRowOrder(row, -1));
    dnBtn.addEventListener('click', () => nudgeRowOrder(row, 1));
    wrap.appendChild(upBtn); wrap.appendChild(dnBtn);
    tdOrder.appendChild(wrap);
    tr.appendChild(tdOrder);

    const tdPeriods = document.createElement('td');
    const periodsChk = document.createElement('input'); periodsChk.type = 'checkbox'; periodsChk.checked = !!row.showPeriodLabels;
    periodsChk.title = 'Repeat the period/timeline header labels across this row instead of leaving it blank';
    periodsChk.addEventListener('change', () => { row.showPeriodLabels = periodsChk.checked; saveMapping(); });
    tdPeriods.appendChild(periodsChk);
    tr.appendChild(tdPeriods);

    const tdFormat = document.createElement('td');
    const fmtBtn = document.createElement('button'); fmtBtn.className = 'icon'; fmtBtn.textContent = '🎨';
    fmtBtn.addEventListener('click', () => toggleCustomRowStyleEditor(tr, row));
    tdFormat.appendChild(fmtBtn);
    tr.appendChild(tdFormat);

    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button'); delBtn.className = 'icon danger'; delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => deleteCustomRow(row));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    body.appendChild(tr);
  });
  renderRowsByTab();
  renderTreeView();
}

function toggleCustomRowStyleEditor(afterRowEl, row){
  const existing = afterRowEl.nextElementSibling;
  if(existing && existing.classList.contains('style-editor-row')){ existing.remove(); return; }
  document.querySelectorAll('.style-editor-row').forEach(el => el.remove());

  const st = row.style || {};
  const tr = document.createElement('tr');
  tr.className = 'style-editor-row';
  const td = document.createElement('td');
  td.colSpan = afterRowEl.children.length || 7;
  const fields = document.createElement('div');
  fields.className = 'style-fields';

  function labeled(labelText, inputEl){
    const lab = document.createElement('label');
    lab.textContent = labelText;
    lab.appendChild(inputEl);
    return lab;
  }

  const fillInput = document.createElement('input'); fillInput.type = 'color'; fillInput.value = st.fill || '#f8fafc';
  const fillNone = document.createElement('input'); fillNone.type = 'checkbox'; fillNone.checked = !st.fill;
  const fontColor = document.createElement('input'); fontColor.type = 'color'; fontColor.value = (st.font && st.font.color) || '#475569';
  const boldChk = document.createElement('input'); boldChk.type = 'checkbox'; boldChk.checked = !!(st.font && (st.font.weight === '700' || st.font.weight === 'bold'));
  const borderChk = document.createElement('input'); borderChk.type = 'checkbox'; borderChk.checked = !!(st.border && st.border.style && st.border.style !== 'none');
  const borderColor = document.createElement('input'); borderColor.type = 'color'; borderColor.value = (st.border && st.border.color) || '#94a3b8';

  fields.appendChild(labeled('Fill', fillInput));
  fields.appendChild(labeled('No fill', fillNone));
  fields.appendChild(labeled('Font color', fontColor));
  fields.appendChild(labeled('Bold', boldChk));
  fields.appendChild(labeled('Border', borderChk));
  fields.appendChild(labeled('Border color', borderColor));

  function commit(){
    row.style = {
      fill: fillNone.checked ? null : fillInput.value,
      font: { color: fontColor.value, weight: boldChk.checked ? '700' : 'normal' },
      border: borderChk.checked ? { color: borderColor.value, style: 'solid' } : { style: 'none' }
    };
    saveMapping();
  }
  [fillInput, fillNone, fontColor, boldChk, borderChk, borderColor].forEach(el => el.addEventListener('change', commit));

  td.appendChild(fields);
  tr.appendChild(td);
  afterRowEl.after(tr);
}

