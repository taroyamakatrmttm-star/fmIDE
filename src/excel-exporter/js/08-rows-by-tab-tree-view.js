// ---------- Rows grouped by Excel tab (a live preview of the actual sheet layout) ----------
// Builds one editable <tr> for either a real row or a custom row, sharing the same
// column set so both kinds can sit in the same table, ordered exactly as they will be
// written to the sheet (see buildCtx). Include/Type/Delete/Format/Periods cells are
// simply left empty for whichever row kind doesn't have that concept.
// Small tag on both ends of an input link: the original row ("→ Inputs") and its
// Inputs-tab row ("from <tab>").
function appendInputLinkTag(parent, row){
  if(!inputsEnabled() || row.isCustom) return;
  let text = null, title = '';
  if(row.isInputMirror){
    const src = mapping.rows.find(r => r.id === row.sourceRowId);
    const t = src && mapping.tabs.find(x => x.id === src.tabId);
    text = 'from ' + (t ? t.name : '?');
    title = 'Holds the typed numbers; the original row on "' + (t ? t.name : '?') + '" links here';
  } else if(inputMirrorRows().some(m => m.sourceRowId === row.id)){
    text = '→ ' + (inputsTab() ? inputsTab().name : 'Inputs');
    title = 'Links to its row on the inputs tab (green font in Excel)';
  }
  if(!text) return;
  const tg = document.createElement('span'); tg.className = 'link-tag'; tg.textContent = text; tg.title = title;
  parent.appendChild(tg);
}

function buildTabViewRowTR(row, sortedTabs){
  const _tr = buildTabViewRowTRInner(row, sortedTabs);
  if(row.isInputMirror){ const td = [..._tr.children].find(c => c.querySelector('.link-tag')) || _tr.children[1]; if(td) td.appendChild(buildScenarioControl(row)); }
  return _tr;
}
function buildTabViewRowTRInner(row, sortedTabs){
  const tr = document.createElement('tr');
  const isCustom = !!row.isCustom;
  if(!isCustom && !row.include) tr.classList.add('excluded');

  const tdSel = document.createElement('td');
  const selChk = document.createElement('input'); selChk.type = 'checkbox'; selChk.checked = isRowSelected(row.id);
  selChk.title = 'Select for a bulk move (Move to Top/Bottom, or relocate to another tab/section)';
  selChk.addEventListener('change', () => setRowSelected(row.id, selChk.checked));
  tdSel.appendChild(selChk);
  tr.appendChild(tdSel);

  const tdInc = document.createElement('td');
  if(!isCustom){
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = row.include;
    chk.addEventListener('change', () => { row.include = chk.checked; saveMapping(); renderRows(); });
    tdInc.appendChild(chk);
  }
  tr.appendChild(tdInc);

  const tdLabel = document.createElement('td');
  const labelInput = document.createElement('input'); labelInput.type = 'text'; labelInput.value = row.label;
  labelInput.addEventListener('change', () => { row.label = labelInput.value; saveMapping(); isCustom ? renderCustomRows() : renderRows(); });
  tdLabel.appendChild(labelInput);
  tr.appendChild(tdLabel);

  const tdType = document.createElement('td');
  if(isCustom){
    tdType.textContent = 'Custom label';
  } else {
    const canvas = model.canvases.find(c => c.id === row.canvasId);
    const node = canvas && canvas.nodes.find(n => n.id === row.nodeId);
    tdType.textContent = node ? ({ value: 'Rectangle', alias: 'Alias', periodShift: 'Period Shift' }[node.type] || node.type) : '?';
    if(node && (node.blockRole === 'input' || node.blockRole === 'output')){
      const brTag = document.createElement('span');
      brTag.className = 'block-role-tag ' + node.blockRole;
      brTag.textContent = node.blockRole === 'input' ? 'Block In' : 'Block Out';
      brTag.title = 'Marked as a Block ' + (node.blockRole === 'input' ? 'Input' : 'Output') + ' in fmIDE\'s Block feature';
      tdType.appendChild(brTag);
    }
    const vTag = buildVerticalRowTag(row, node);
    if(vTag) tdType.appendChild(vTag);
  }
  appendInputLinkTag(tdType, row);
  tr.appendChild(tdType);

  const tdTab = document.createElement('td');
  const tabSel = document.createElement('select');
  tabSel.disabled = !!row.isInputMirror;
  sortedTabs.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; tabSel.appendChild(o); });
  tabSel.value = row.tabId;
  tabSel.addEventListener('change', () => { row.tabId = tabSel.value; saveMapping(); renderTabs(); isCustom ? renderCustomRows() : renderRows(); });
  tdTab.appendChild(tabSel);
  tr.appendChild(tdTab);

  const tdSection = document.createElement('td');
  tdSection.style.cssText = 'display:flex; align-items:center; gap:6px;';
  const secSel = document.createElement('select');
  [['input', 'Input'], ['calc', 'Calc'], ['output', 'Output']].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; secSel.appendChild(o); });
  secSel.value = row.section;
  secSel.disabled = !!row.isInputMirror;
  secSel.addEventListener('change', () => { row.section = secSel.value; saveMapping(); isCustom ? renderCustomRows() : renderRows(); });
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
  if(isCustom){
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!row.showPeriodLabels;
    chk.title = 'Repeat the period/timeline header labels across this row instead of leaving it blank';
    chk.addEventListener('change', () => { row.showPeriodLabels = chk.checked; saveMapping(); });
    tdPeriods.appendChild(chk);
  }
  tr.appendChild(tdPeriods);

  const tdFormat = document.createElement('td');
  if(isCustom){
    const fmtBtn = document.createElement('button'); fmtBtn.className = 'icon'; fmtBtn.textContent = '🎨';
    fmtBtn.addEventListener('click', () => toggleCustomRowStyleEditor(tr, row));
    tdFormat.appendChild(fmtBtn);
  }
  tr.appendChild(tdFormat);

  const tdDel = document.createElement('td');
  if(isCustom){
    const delBtn = document.createElement('button'); delBtn.className = 'icon danger'; delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => deleteCustomRow(row));
    tdDel.appendChild(delBtn);
  }
  tr.appendChild(tdDel);

  return tr;
}

function renderRowsByTab(){
  const container = $('rowGroupsByTab');
  const scrollTops = captureScrollTops(container);
  container.innerHTML = '';
  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  if(sortedTabs.length === 0){
    container.innerHTML = '<p style="color:var(--muted); font-size:13px;">No tabs yet.</p>';
    return;
  }
  const sectioned = sectionsEnabled();
  sortedTabs.forEach(tab => {
    const sections = sectioned
      ? ['input', 'calc', 'output'].map(sec => ({ sec, rows: combinedRowsFor(tab.id, sec) })).filter(x => x.rows.length > 0)
      : [{ sec: null, rows: combinedRowsForTab(tab.id) }].filter(x => x.rows.length > 0);
    const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);

    const group = document.createElement('div');
    group.className = 'canvas-group';
    group.setAttribute('data-scroll-key', tab.id);
    const header = document.createElement('div');
    header.className = 'canvas-group-header';
    setGroupHeader(header, tab.name, `${totalRows} row${totalRows === 1 ? '' : 's'}`);
    group.appendChild(header);

    if(totalRows === 0){
      const empty = document.createElement('p');
      empty.style.cssText = 'padding:10px 12px; margin:0; color:var(--muted); font-size:12px;';
      empty.textContent = 'No rows assigned to this tab yet.';
      group.appendChild(empty);
      container.appendChild(group);
      return;
    }

    const scroll = document.createElement('div'); scroll.className = 'rows-scroll';
    const table = document.createElement('table'); table.className = 'rows-table';
    table.innerHTML = '<thead><tr><th></th><th>Include</th><th>Row label</th><th>Type</th><th>Tab</th><th>Section</th><th>Order</th><th>Periods</th><th>Format</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    sections.forEach(({ sec, rows }) => {
      if(sec !== null){
        const sectionRow = document.createElement('tr');
        const sectionTd = document.createElement('td');
        sectionTd.colSpan = 10;
        sectionTd.style.cssText = 'background:#f8fafc; font-weight:700; font-size:11px; color:#475569; text-transform:uppercase; letter-spacing:.03em; padding:6px 8px;';
        sectionTd.textContent = { input: 'INPUTS', calc: 'CALCULATIONS', output: 'OUTPUTS' }[sec];
        sectionRow.appendChild(sectionTd);
        tbody.appendChild(sectionRow);
      }
      rows.forEach(row => tbody.appendChild(buildTabViewRowTR(row, sortedTabs)));
    });

    table.appendChild(tbody);
    scroll.appendChild(table);
    group.appendChild(scroll);
    container.appendChild(group);
  });
  restoreScrollTops(container, scrollTops);
}

let currentRowView = 'canvas';
function setRowView(view){
  currentRowView = view;
  $('viewByCanvas').classList.toggle('active', view === 'canvas');
  $('viewByTab').classList.toggle('active', view === 'tab');
  $('viewByTree').classList.toggle('active', view === 'tree');
  $('rowGroups').classList.toggle('hidden', view !== 'canvas');
  $('blockInstanceGroups').classList.toggle('hidden', view !== 'canvas');
  $('rowGroupsByTab').classList.toggle('hidden', view !== 'tab');
  $('rowGroupsTree').classList.toggle('hidden', view !== 'tree');
  $('customRowsPanel').classList.toggle('hidden', view !== 'canvas');
  if(view === 'tree') renderTreeView();
}

// ---------- Tree view (Tab -> Row, always flat regardless of the section toggle) ----------
// A third, purely-organizational view: one collapsible node per tab, its rows in their
// real final order (via combinedRowsForTab — the same ordering generation itself uses),
// rendered as a plain clickable list rather than an editable table. Selection reuses the
// same `selectedRowIds` set as the checkbox-based views (so the existing bulk-move bar
// works here unchanged), but is driven by click/Ctrl-click/Shift-click like a file
// manager instead of checkboxes — no drag-and-drop, by design (see "Multi-select rows +
// bulk move" in project notes for why drag was avoided for the checkbox views; the same
// reasoning applies here).
let treeCollapsedTabIds = new Set(); // transient UI-only state, never saved
let treeAnchorIndex = null;          // last clicked row's index into treeVisibleRows, for Shift-range
let treeVisibleRows = [];            // flat list of {id} for every rendered (non-collapsed) row, in DOM order
let treeRowElements = [];            // {id, el} for every rendered row div, so a plain selection change
                                      // can flip `.selected` in place instead of rebuilding the whole tree

function renderTreeView(){
  const container = $('rowGroupsTree');
  if(!container) return;
  const scrollTops = captureScrollTops(container);
  container.innerHTML = '';
  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  treeVisibleRows = [];
  treeRowElements = [];

  if(sortedTabs.length === 0){
    container.innerHTML = '<p style="color:var(--muted); font-size:13px;">No tabs yet.</p>';
    return;
  }

  sortedTabs.forEach(tab => {
    // Unlike the Tab view (a preview of the final sheet), the Tree view is a full
    // per-tab row manager: it shows EVERY row assigned to this tab, including an
    // excluded or inlined-constant one (dimmed — see buildTreeRowEl), so those can be
    // selected and brought back via the bulk Include/Constant actions below.
    const rows = allRowsForTab(tab.id);
    const collapsed = treeCollapsedTabIds.has(tab.id);

    const group = document.createElement('div');
    group.className = 'canvas-group';
    group.setAttribute('data-scroll-key', 'tree_' + tab.id);

    const header = document.createElement('div');
    header.className = 'canvas-group-header tree-tab-header';
    setGroupHeader(header, `${collapsed ? '▸' : '▾'} ${tab.name}`, `${rows.length} row${rows.length === 1 ? '' : 's'}`);
    header.addEventListener('click', () => {
      if(collapsed) treeCollapsedTabIds.delete(tab.id); else treeCollapsedTabIds.add(tab.id);
      renderTreeView();
    });
    group.appendChild(header);

    if(!collapsed){
      if(rows.length === 0){
        const empty = document.createElement('p');
        empty.style.cssText = 'padding:10px 12px; margin:0; color:var(--muted); font-size:12px;';
        empty.textContent = 'No rows in this tab yet.';
        group.appendChild(empty);
      } else {
        const scroll = document.createElement('div'); scroll.className = 'rows-scroll';
        const list = document.createElement('div'); list.className = 'tree-row-list';
        rows.forEach(row => {
          const flatIndex = treeVisibleRows.length;
          treeVisibleRows.push({ id: row.id });
          const rowEl = buildTreeRowEl(row, flatIndex);
          treeRowElements.push({ id: row.id, el: rowEl });
          list.appendChild(rowEl);
        });
        scroll.appendChild(list);
        group.appendChild(scroll);
      }
    }
    container.appendChild(group);
  });

  restoreScrollTops(container, scrollTops);
}

function buildTreeRowEl(row, flatIndex){
  const el = document.createElement('div');
  const isExcluded = !row.isCustom && !row.include && !row.inlineConstant;
  el.className = 'tree-row' + (isRowSelected(row.id) ? ' selected' : '') + (isExcluded ? ' excluded' : '');
  el.title = isExcluded ? 'Excluded — not written to the sheet. Select it and use "Include" in the bar above to bring it back.' : '';

  const label = document.createElement('span'); label.className = 'tree-row-label';
  label.textContent = row.label;
  el.appendChild(label);

  if(row.inlineConstant){
    const constTag = document.createElement('span'); constTag.className = 'const-tag';
    constTag.textContent = 'Const';
    constTag.title = 'Inlined as a constant — spliced directly into referencing formulas, no row of its own in the sheet';
    el.appendChild(constTag);
  }

  const tag = document.createElement('span'); tag.className = 'section-tag ' + row.section;
  tag.textContent = row.isCustom ? 'label' : row.section;
  el.appendChild(tag);
  appendInputLinkTag(el, row);
  if(row.isInputMirror) el.appendChild(buildScenarioControl(row));

  if(!row.isCustom){
    const canvas = model.canvases.find(c => c.id === row.canvasId);
    const node = canvas && canvas.nodes.find(n => n.id === row.nodeId);
    if(node && (node.blockRole === 'input' || node.blockRole === 'output')){
      const brTag = document.createElement('span');
      brTag.className = 'block-role-tag ' + node.blockRole;
      brTag.textContent = node.blockRole === 'input' ? 'Block In' : 'Block Out';
      brTag.title = 'Marked as a Block ' + (node.blockRole === 'input' ? 'Input' : 'Output') + ' in fmIDE\'s Block feature';
      el.appendChild(brTag);
    }
    const vTag = buildVerticalRowTag(row, node);
    if(vTag) el.appendChild(vTag);
  } else {
    // Custom (label/blank) rows are the only ones with a meaningful Periods toggle — a
    // real data row's period cells are driven by its formulas. Click toggles it in place;
    // stopPropagation keeps it from also selecting the row like the rest of the row does.
    const periodsBtn = document.createElement('span');
    periodsBtn.className = 'periods-toggle' + (row.showPeriodLabels ? ' on' : '');
    periodsBtn.textContent = row.showPeriodLabels ? 'Periods: On' : 'Periods: Off';
    periodsBtn.title = 'Toggle whether this row repeats the period/timeline header labels across its cells';
    periodsBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      row.showPeriodLabels = !row.showPeriodLabels;
      saveMapping();
      renderCustomRows(); // cascades into renderRowsByTab() + renderTreeView()
    });
    el.appendChild(periodsBtn);

    // Format and delete — the last two capabilities the Canvas/Tab views had that the
    // tree lacked for custom rows. Both stopPropagation so they never also select the row.
    const fmtBtn = document.createElement('button'); fmtBtn.className = 'icon tree-fmt-btn'; fmtBtn.textContent = '🎨';
    fmtBtn.title = 'Edit this row\'s fill, font, and border';
    fmtBtn.addEventListener('click', (ev) => { ev.stopPropagation(); toggleTreeRowStyleEditor(el, row); });
    el.appendChild(fmtBtn);

    const delBtn = document.createElement('button'); delBtn.className = 'icon danger tree-del-btn'; delBtn.textContent = '🗑';
    delBtn.title = 'Delete this custom row';
    delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteCustomRow(row); });
    el.appendChild(delBtn);
  }

  el.addEventListener('click', (ev) => handleTreeRowClick(ev, flatIndex));
  el.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    // Standard file-manager behavior: right-clicking a row outside the selection selects
    // just that row; right-clicking inside it keeps the whole selection.
    if(!selectedRowIds.has(row.id)){
      selectedRowIds.clear();
      selectedRowIds.add(row.id);
      treeAnchorIndex = flatIndex;
      applyTreeSelectionHighlight();
      renderBulkBar();
    }
    openTreeContextMenu(ev.clientX, ev.clientY, row, el, label);
  });
  el.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    // The first click of a double-click selects a row, which can make the selection bar
    // appear and push the list down — so the second click may land on a different row.
    // Always rename the row the first click actually selected.
    const first = treeClickHistory[treeClickHistory.length - 2];
    const last = treeClickHistory[treeClickHistory.length - 1];
    if(first && last && last.id === row.id && first.id !== row.id && last.time - first.time < 800){
      const target = treeRowElements.find(e => e.id === first.id);
      const targetRow = findRowById(first.id);
      if(target && targetRow){
        selectedRowIds.clear(); selectedRowIds.add(first.id);
        treeAnchorIndex = treeVisibleRows.findIndex(e => e.id === first.id);
        applyTreeSelectionHighlight(); renderBulkBar();
        startTreeRowRename(target.el, target.el.querySelector('.tree-row-label'), targetRow);
        return;
      }
    }
    startTreeRowRename(el, label, row);
  });
  return el;
}

// Right-click menu for a Tree row. With several rows selected, "above" means above the
// first selected row and "below" means below the last (in sheet order).
function openTreeContextMenu(x, y, row, rowEl, labelSpan){
  const menu = $('treeCtxMenu');
  menu.innerHTML = '';
  const sel = selectionInSheetOrder();
  const first = sel[0] || row, last = sel[sel.length - 1] || row;
  const item = (text, onClick, opts) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.setAttribute('role', 'menuitem');
    if(opts && opts.danger) b.className = 'danger';
    if(opts && opts.disabled){ b.disabled = true; if(opts.title) b.title = opts.title; }
    b.addEventListener('click', () => { closeTreeContextMenu(); onClick(); });
    menu.appendChild(b);
  };
  item('Insert custom row above', () => insertCustomRowNear(first, 'above'));
  item('Insert custom row below', () => insertCustomRowNear(last, 'below'));
  menu.appendChild(document.createElement('hr'));
  item('Rename', () => startTreeRowRename(rowEl, labelSpan, row),
    sel.length > 1 ? { disabled: true, title: 'Rename works on one row at a time' } : null);
  if(row.isCustom){
    const customs = sel.filter(r => r.isCustom);
    item(customs.length > 1 ? `Delete ${customs.length} custom rows` : 'Delete custom row', () => {
      const ids = new Set(customs.length ? customs.map(r => r.id) : [row.id]);
      mapping.customRows = mapping.customRows.filter(r => !ids.has(r.id));
      ids.forEach(id => selectedRowIds.delete(id));
      saveMapping(); renderCustomRows(); renderTabs(); renderBulkBar();
    }, { danger: true });
  }
  menu.classList.remove('hidden');
  // Keep the menu on-screen near the cursor.
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
}
function closeTreeContextMenu(){ $('treeCtxMenu').classList.add('hidden'); }
document.addEventListener('mousedown', (ev) => { if(!$('treeCtxMenu').contains(ev.target)) closeTreeContextMenu(); }, true);
document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') closeTreeContextMenu(); });
// Close on user scrolling only (wheel / touch) — not on 'scroll', which also fires when
// the layout shifts (e.g. the selection bar appearing as the menu opens).
window.addEventListener('wheel', closeTreeContextMenu, { capture: true, passive: true });
window.addEventListener('touchmove', closeTreeContextMenu, { capture: true, passive: true });
window.addEventListener('resize', closeTreeContextMenu);

// Tree-view equivalent of toggleCustomRowStyleEditor (Canvas/Tab views), for a custom row
// only — same fields (fill, font color, bold, border, border color), same `row.style`
// shape, just laid out as a flex block appended INSIDE the row's own div instead of a
// sibling <tr> (the tree isn't a table). Appending it as a child of `el` — the very
// element `handleTreeRowClick`'s listener is bound to — would let a click inside the
// editor bubble up and reset the selection to just this row, so the editor container
// itself stops that one bit of propagation.
function toggleTreeRowStyleEditor(rowEl, row){
  const last = rowEl.children[rowEl.children.length - 1];
  if(last && last.classList && last.classList.contains('tree-style-editor')){
    last.remove();
    return;
  }
  // Only one style editor open across the tree at a time, mirroring the table views.
  treeRowElements.forEach(({ el }) => {
    const lastChild = el.children[el.children.length - 1];
    if(lastChild && lastChild.classList && lastChild.classList.contains('tree-style-editor')) lastChild.remove();
  });

  const st = row.style || {};
  const editor = document.createElement('div');
  editor.className = 'tree-style-editor style-fields';
  editor.addEventListener('click', (ev) => ev.stopPropagation());

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

  editor.appendChild(labeled('Fill', fillInput));
  editor.appendChild(labeled('No fill', fillNone));
  editor.appendChild(labeled('Font color', fontColor));
  editor.appendChild(labeled('Bold', boldChk));
  editor.appendChild(labeled('Border', borderChk));
  editor.appendChild(labeled('Border color', borderColor));

  function commit(){
    row.style = {
      fill: fillNone.checked ? null : fillInput.value,
      font: { color: fontColor.value, weight: boldChk.checked ? '700' : 'normal' },
      border: borderChk.checked ? { color: borderColor.value, style: 'solid' } : { style: 'none' }
    };
    saveMapping();
  }
  [fillInput, fillNone, fontColor, boldChk, borderChk, borderColor].forEach(fieldEl => fieldEl.addEventListener('change', commit));

  rowEl.appendChild(editor);
}

// Double-click a row's label to rename just that one row in place — the only label edit
// the Tree view supports (renaming several rows to the same text at once isn't useful the
// way a bulk Include/Constant toggle is). Swaps the label <span> for a text <input>,
// commits on blur or Enter, discards on Escape.
function startTreeRowRename(rowEl, labelSpan, row){
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tree-row-label-input';
  input.value = row.label;
  // Clicking into the input, or selecting text in it, must not re-trigger the row's own
  // click handler (which would reset the selection to just this row).
  input.addEventListener('click', (ev) => ev.stopPropagation());
  input.addEventListener('mousedown', (ev) => ev.stopPropagation());
  let settled = false;
  function commit(){
    if(settled) return;
    settled = true;
    const v = input.value.trim();
    if(v) row.label = v;
    saveMapping();
    row.isCustom ? renderCustomRows() : renderRows(); // both cascade into renderTreeView()
  }
  function discard(){
    if(settled) return;
    settled = true;
    renderTreeView();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (ev) => {
    if(ev.key === 'Enter'){ ev.preventDefault(); input.blur(); }
    else if(ev.key === 'Escape'){ ev.preventDefault(); discard(); }
  });
  rowEl.replaceChild(input, labelSpan);
  input.focus();
  input.select();
}

// Click = select only this row. Ctrl/Cmd-click = toggle this row in/out of the selection
// without disturbing the rest. Shift-click = select the contiguous range between the
// last-clicked row (the anchor) and this one — standard file-manager semantics. The range
// is computed over `treeVisibleRows`, the single flat list spanning every expanded tab in
// DOM order, so a range can span tab boundaries exactly like a Windows-Explorer-style
// grouped list allows (the existing bulk-move actions already tolerate a selection
// spanning several tabs/sections, acting on each group independently).
// Flips `.selected` on the already-rendered row elements to match `selectedRowIds`,
// without touching anything else about them. A plain selection change never needs a full
// renderTreeView() rebuild — and MUST avoid one: the browser's native dblclick detection
// requires the two constituent clicks to land on the very same DOM element, so rebuilding
// the tree (innerHTML='' + recreate) on every single click would hand the second click of
// a double-click a brand-new element and silently defeat rename-by-double-click.
function applyTreeSelectionHighlight(){
  treeRowElements.forEach(({ id, el }) => { el.classList.toggle('selected', isRowSelected(id)); });
}

let treeClickHistory = []; // last two plain row clicks {id, time} — see the dblclick handler
function handleTreeRowClick(ev, flatIndex){
  const entry = treeVisibleRows[flatIndex];
  if(!entry) return;
  treeClickHistory = treeClickHistory.slice(-1).concat([{ id: entry.id, time: Date.now() }]);
  if(ev.shiftKey && treeAnchorIndex !== null && treeVisibleRows[treeAnchorIndex]){
    if(!(ev.ctrlKey || ev.metaKey)) selectedRowIds.clear();
    const lo = Math.min(treeAnchorIndex, flatIndex), hi = Math.max(treeAnchorIndex, flatIndex);
    for(let i = lo; i <= hi; i++){ if(treeVisibleRows[i]) selectedRowIds.add(treeVisibleRows[i].id); }
  } else if(ev.ctrlKey || ev.metaKey){
    if(selectedRowIds.has(entry.id)) selectedRowIds.delete(entry.id); else selectedRowIds.add(entry.id);
    treeAnchorIndex = flatIndex;
  } else {
    selectedRowIds.clear();
    selectedRowIds.add(entry.id);
    treeAnchorIndex = flatIndex;
  }
  applyTreeSelectionHighlight();
  renderBulkBar();
}

