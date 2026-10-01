  // =====================================================================================
  // ---------- Customize Ribbon & KeyTips dialog ----------
  // =====================================================================================
  function showCustomizeRibbon(){
    const cfg = ribbonState.config;
    const cfgAtOpen = JSON.stringify(cfg);
    const overlay = el('div', 'modal-overlay');
    const box = el('div', 'modal-box rbc-box');
    addWindowHelp(box, 'customize-ribbon');
    makeResizableWindow(box, 'ribbon');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => {
      overlay.remove(); document.removeEventListener('keydown', onKey);
      // only a layout the user actually changed is saved; otherwise new default buttons keep appearing in updates
      if(JSON.stringify(ribbonState.config) !== cfgAtOpen) ribbonState.customized = true;
      renderRibbon(); saveWorkspaceSoon();
    };
    function onKey(ev){ if(ev.key === 'Escape' && !keytipCaptureListener && !focusIsTyping()) close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', ev => { if(ev.target === overlay) close(); });

    box.appendChild(el('p', '', '⚙ Customize Ribbon & KeyTips'));
    const layout = el('div', 'rbc-layout');
    box.appendChild(layout);

    // left: commands
    const left = el('div', 'rbc-pane');
    left.appendChild(el('h5', '', 'Commands'));
    const search = el('input', 'shortcuts-search');
    search.placeholder = 'Search commands…';
    search.style.marginBottom = '6px';
    search.addEventListener('keydown', ev => ev.stopPropagation());
    left.appendChild(search);
    const cmdList = el('div', 'rbc-list');
    left.appendChild(cmdList);
    let selCmd = null;

    // middle
    const mid = el('div', 'rbc-mid');
    const addBtn = el('button', 'mbtn primary', 'Add »');
    const remBtn = el('button', 'mbtn', '« Remove');
    mid.appendChild(addBtn); mid.appendChild(remBtn);

    // right: layout tree
    const right = el('div', 'rbc-pane');
    right.appendChild(el('h5', '', 'Ribbon layout'));
    const tree = el('div', 'rbc-list');
    right.appendChild(tree);
    const rtools = el('div', '');
    rtools.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap; margin-top:6px;';
    right.appendChild(rtools);
    const propsRow = el('div', 'rbc-props');
    right.appendChild(propsRow);
    layout.appendChild(left); layout.appendChild(mid); layout.appendChild(right);

    // selection in the tree: {type:'qat'|'qatItem'|'tab'|'group'|'item', t, g, i}
    let sel = { type:'tab', t: cfg.tabs.findIndex(t => t.id === ribbonState.activeTab) };
    if(sel.t < 0) sel.t = 0;

    function renderCmds(){
      cmdList.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const byCat = {};
      COMMANDS.forEach(c => {
        if(q && !(c.label + ' ' + c.category).toLowerCase().includes(q)) return;
        (byCat[c.category] = byCat[c.category] || []).push(c);
      });
      Object.keys(byCat).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)).forEach(cat => {
        cmdList.appendChild(el('div', 'shortcut-cat-header', cat)).style.margin = '6px 10px 2px';
        byCat[cat].forEach(c => {
          const r = el('div', 'rbc-row' + (selCmd === c.id ? ' sel' : ''));
          r.appendChild(el('span', 'ic', c.icon || '•'));
          r.appendChild(el('span', '', c.label));
          r.addEventListener('click', () => { selCmd = c.id; renderCmds(); });
          r.addEventListener('dblclick', () => { selCmd = c.id; addSelected(); });
          cmdList.appendChild(r);
        });
      });
    }
    search.addEventListener('input', renderCmds);

    function isSel(s){ return JSON.stringify(s) === JSON.stringify(sel); }
    function renderTree(){
      tree.innerHTML = '';
      const row = (s, depth, icon, text, meta) => {
        const r = el('div', 'rbc-row' + (isSel(s) ? ' sel' : ''));
        r.style.paddingLeft = (10 + depth * 16) + 'px';
        r.appendChild(el('span', 'ic', icon));
        r.appendChild(el('span', '', text));
        if(meta) r.appendChild(el('span', 'meta', meta));
        r.addEventListener('click', () => { sel = s; renderTree(); renderProps(); });
        tree.appendChild(r);
      };
      row({ type:'qat' }, 0, '⚡', 'Quick Access Toolbar', 'numbers 1–9');
      cfg.qat.forEach((id, i) => { const c = getCommand(id); if(c) row({ type:'qatItem', i }, 1, c.icon || '•', c.label, String(i + 1)); });
      cfg.tabs.forEach((t, ti) => {
        row({ type:'tab', t: ti }, 0, '▭', t.label, t.keytip ? 'KeyTip ' + t.keytip : 'auto');
        t.groups.forEach((g, gi) => {
          row({ type:'group', t: ti, g: gi }, 1, '▣', g.label, g.id === 'myMacros' ? 'pinned macros' : '');
          (g.items || []).forEach((it, ii) => {
            const c = getCommand(it.cmd);
            if(!c) return;
            row({ type:'item', t: ti, g: gi, i: ii }, 2, c.icon || '•', it.label || c.label, (it.size === 'large' ? 'large' : 'small') + (it.keytip ? ' · ' + it.keytip : ''));
          });
        });
      });
      const s = tree.querySelector('.rbc-row.sel');
      if(s) s.scrollIntoView({ block:'nearest' });
    }

    function renderProps(){
      propsRow.innerHTML = '';
      const inp = (label, val, ph, onChange, width) => {
        const l = el('span', '', label); propsRow.appendChild(l);
        const i = el('input'); i.type = 'text'; i.value = val || ''; i.placeholder = ph || ''; i.style.width = (width || 110) + 'px';
        i.addEventListener('keydown', ev => ev.stopPropagation());
        i.addEventListener('change', () => { onChange(i.value.trim()); renderTree(); renderRibbon(); });
        propsRow.appendChild(i);
        return i;
      };
      if(sel.type === 'tab'){
        const t = cfg.tabs[sel.t];
        inp('Tab name', t.label, '', v => { if(v) t.label = v; });
        inp('KeyTip', t.keytip, 'auto', v => { t.keytip = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || undefined; if(!t.keytip) delete t.keytip; checkTip(); }, 50);
      } else if(sel.type === 'group'){
        const g = cfg.tabs[sel.t].groups[sel.g];
        inp('Group name', g.label, '', v => { if(v) g.label = v; });
      } else if(sel.type === 'item'){
        const it = cfg.tabs[sel.t].groups[sel.g].items[sel.i];
        const c = getCommand(it.cmd);
        inp('Label', it.label, c ? (c.short || c.label) : '', v => { if(v) it.label = v; else delete it.label; });
        propsRow.appendChild(el('span', '', 'Size'));
        const s = el('select');
        [['small','Small'],['large','Large']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v; s.appendChild(o); });
        s.value = it.size === 'large' ? 'large' : 'small';
        s.addEventListener('change', () => { if(s.value === 'large') it.size = 'large'; else delete it.size; renderTree(); renderRibbon(); });
        propsRow.appendChild(s);
        inp('KeyTip', it.keytip, 'auto', v => { it.keytip = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || undefined; if(!it.keytip) delete it.keytip; checkTip(); }, 50);
      } else {
        propsRow.appendChild(el('span', '', sel.type === 'qat' || sel.type === 'qatItem'
          ? 'Quick Access buttons sit left of the tabs; their KeyTips are 1–9.' : ''));
      }
      const warn = el('span', '');
      warn.id = 'rbcWarn';
      warn.style.cssText = 'color:#b45309; font-size:11px; flex-basis:100%;';
      propsRow.appendChild(warn);
      checkTip();
    }
    function checkTip(){
      const w = document.getElementById('rbcWarn');
      if(!w) return;
      const msgs = [];
      const tabTips = cfg.tabs.map(t => t.keytip).filter(Boolean);
      const dup = tabTips.filter((k, i) => tabTips.indexOf(k) !== i);
      if(dup.length) msgs.push(`Tab KeyTip "${dup[0]}" is used twice.`);
      if(tabTips.some(k => /^[0-9]/.test(k))) msgs.push('Tab KeyTips starting with a digit clash with Quick Access numbers.');
      if(sel.t !== undefined && cfg.tabs[sel.t]){
        const tips = [];
        cfg.tabs[sel.t].groups.forEach(g => (g.items || []).forEach(it => { if(it.keytip) tips.push(it.keytip); }));
        const d2 = tips.filter((k, i) => tips.indexOf(k) !== i);
        if(d2.length) msgs.push(`KeyTip "${d2[0]}" is used twice on this tab.`);
      }
      w.textContent = msgs.join(' ');
    }

    function addSelected(){
      if(!selCmd) return;
      if(sel.type === 'qat' || sel.type === 'qatItem'){
        if(!cfg.qat.includes(selCmd)) cfg.qat.splice(sel.type === 'qatItem' ? sel.i + 1 : cfg.qat.length, 0, selCmd);
      } else {
        let t = sel.t, g = sel.g;
        if(sel.type === 'tab'){
          if(!cfg.tabs[t].groups.length) cfg.tabs[t].groups.push({ label:'New Group', items:[] });
          g = cfg.tabs[t].groups.length - 1;
        }
        const items = cfg.tabs[t].groups[g].items = cfg.tabs[t].groups[g].items || [];
        const at = sel.type === 'item' ? sel.i + 1 : items.length;
        items.splice(at, 0, { cmd: selCmd });
        sel = { type:'item', t, g, i: at };
      }
      renderTree(); renderProps(); renderRibbon();
    }
    function removeSelected(){
      if(sel.type === 'qatItem'){ cfg.qat.splice(sel.i, 1); sel = { type:'qat' }; }
      else if(sel.type === 'item'){ cfg.tabs[sel.t].groups[sel.g].items.splice(sel.i, 1); sel = { type:'group', t: sel.t, g: sel.g }; }
      else if(sel.type === 'group'){ cfg.tabs[sel.t].groups.splice(sel.g, 1); sel = { type:'tab', t: sel.t }; }
      else if(sel.type === 'tab'){
        if(cfg.tabs.length <= 1){ toast('The ribbon needs at least one tab.'); return; }
        cfg.tabs.splice(sel.t, 1); sel = { type:'tab', t: Math.max(0, sel.t - 1) };
      }
      renderTree(); renderProps(); renderRibbon();
    }
    function moveSelected(dir){
      const swap = (arr, i) => { const j = i + dir; if(j < 0 || j >= arr.length) return false; const x = arr[i]; arr[i] = arr[j]; arr[j] = x; return true; };
      if(sel.type === 'qatItem'){ if(swap(cfg.qat, sel.i)) sel.i += dir; }
      else if(sel.type === 'item'){ if(swap(cfg.tabs[sel.t].groups[sel.g].items, sel.i)) sel.i += dir; }
      else if(sel.type === 'group'){ if(swap(cfg.tabs[sel.t].groups, sel.g)) sel.g += dir; }
      else if(sel.type === 'tab'){ if(swap(cfg.tabs, sel.t)) sel.t += dir; }
      renderTree(); renderRibbon();
    }
    addBtn.addEventListener('click', addSelected);
    remBtn.addEventListener('click', removeSelected);
    const rt = (label, title, fn) => { const b = el('button', 'mbtn', label); b.title = title; b.addEventListener('click', fn); rtools.appendChild(b); };
    rt('New Tab', 'Add a tab after the selected one', () => {
      const at = (sel.t !== undefined ? sel.t : cfg.tabs.length - 1) + 1;
      cfg.tabs.splice(at, 0, { id: 'tab' + Date.now().toString(36), label:'New Tab', groups:[ { label:'New Group', items:[] } ] });
      sel = { type:'tab', t: at };
      renderTree(); renderProps(); renderRibbon();
    });
    rt('New Group', 'Add a group to the selected tab', () => {
      if(sel.t === undefined){ toast('Select a tab first.'); return; }
      const groups = cfg.tabs[sel.t].groups;
      const at = sel.g !== undefined ? sel.g + 1 : groups.length;
      groups.splice(at, 0, { label:'New Group', items:[] });
      sel = { type:'group', t: sel.t, g: at };
      renderTree(); renderProps(); renderRibbon();
    });
    rt('↑', 'Move up', () => moveSelected(-1));
    rt('↓', 'Move down', () => moveSelected(1));
    const reopen = () => { overlay.remove(); document.removeEventListener('keydown', onKey); renderRibbon(); showCustomizeRibbon(); };
    rt('Export Preferences…', 'Download your shortcuts, ribbon and KeyTips settings as a file', () => {
      if(JSON.stringify(ribbonState.config) !== cfgAtOpen) ribbonState.customized = true; // include edits made in this dialog
      exportPreferencesToFile();
    });
    rt('Import Preferences…', 'Replace your shortcuts, ribbon and KeyTips settings with a preferences file', () => importPreferencesInteractive(reopen));
    rt('Reset', 'Restore the default ribbon layout', () => {
      showConfirm('Reset the ribbon and Quick Access Toolbar to the default layout?', () => {
        ribbonState.config = cloneData(DEFAULT_RIBBON);
        ribbonState.customized = false;
        syncPinnedMacrosIntoRibbon();
        overlay.remove(); document.removeEventListener('keydown', onKey);
        renderRibbon(); showCustomizeRibbon();
      });
    });

    // KeyTips trigger
    const trig = el('div', 'rbc-trigger');
    trig.appendChild(el('strong', '', 'KeyTips trigger:'));
    const trigSel = el('select');
    const choices = [
      ['tap:Alt', isMac() ? 'Tap Option (⌥)' : 'Tap Alt'],
      ['tap:Shift', isMac() ? 'Tap Shift (⇧)' : 'Tap Shift'],
      ['tap:Control', isMac() ? 'Tap Control (⌃)' : 'Tap Ctrl'],
      ...(isMac() ? [['tap:Meta', 'Tap Command (⌘)']] : []),
      ['combo:F10', 'F10'],
      ['custom', 'Custom key…'],
    ];
    const curKey = keytipTrigger.type === 'tap' ? 'tap:' + keytipTrigger.key : 'combo:' + keytipTrigger.combo;
    if(!choices.some(c => c[0] === curKey)) choices.splice(4, 0, [curKey, triggerLabel()]);
    choices.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; trigSel.appendChild(o); });
    trigSel.value = curKey;
    const trigNote = el('span', '', '');
    trigNote.style.color = '#6b7280';
    trigSel.addEventListener('change', () => {
      const v = trigSel.value;
      if(v === 'custom'){
        trigNote.textContent = 'Press the key (or key combination) to use…';
        keytipCaptureListener = (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          if(ev.key === 'Escape'){ keytipCaptureListener = null; trigNote.textContent = ''; trigSel.value = curKey; return; }
          const combo = normalizeCombo(ev);
          if(!combo) return; // modifiers alone: pick them from the list instead
          if(shortcutMap[combo]){ trigNote.textContent = `${prettyCombo(combo)} is already the shortcut for "${(getCommand(shortcutMap[combo]) || {}).label}". Try another key.`; return; }
          keytipCaptureListener = null;
          keytipTrigger = { type:'combo', combo };
          trigNote.textContent = `KeyTips now open with ${prettyCombo(combo)}.`;
          const o = el('option', '', prettyCombo(combo)); o.value = 'combo:' + combo; trigSel.insertBefore(o, trigSel.lastChild);
          trigSel.value = 'combo:' + combo;
          saveWorkspaceSoon();
        };
        return;
      }
      const [type, key] = v.split(':');
      keytipTrigger = type === 'tap' ? { type:'tap', key } : { type:'combo', combo: key };
      trigNote.textContent = `KeyTips now open with ${triggerLabel()}.`;
      saveWorkspaceSoon();
    });
    trig.appendChild(trigSel);
    trig.appendChild(trigNote);
    box.appendChild(trig);
    const tip = el('div', 'template-desc', 'Tap the trigger, then type a tab letter and a command letter — e.g. H then the letter shown on a button. Holding Alt/Option and pressing a tab letter also works. Double-click the command list to add; KeyTips are auto-assigned unless you set one.');
    tip.style.margin = '8px 0 0';
    box.appendChild(tip);

    const actions = el('div', 'modal-actions');
    actions.style.marginTop = '10px';
    const done = el('button', 'primary', 'Done');
    done.addEventListener('click', close);
    actions.appendChild(done);
    box.appendChild(actions);

    renderCmds(); renderTree(); renderProps();
  }

  // ---------- persistence of UI state (saved inside the workspace) ----------
  let saveSoonTimer = null;
  function saveWorkspaceSoon(){ clearTimeout(saveSoonTimer); saveSoonTimer = setTimeout(saveWorkspace, 600); }
  function buildUiPayload(){
    return {
      ribbon: ribbonState.customized ? cloneData(ribbonState.config) : null, ribbonCustomized: !!ribbonState.customized,
      ribbonCollapsed: ribbonState.collapsed, activeTab: ribbonState.activeTab,
      keytipTrigger: Object.assign({}, keytipTrigger), comboVersion: 2, launcherRecent: launcherRecent.slice(), lastRunMacroId,
      dedupeMatch: Object.assign({}, dedupeMatch),
      documentGroupAdded: true, // the default ribbon has it; a customised one got it once
      functionsGroupAdded: true,
      functionCommandsAdded: true, // D2b: Insert Function… and Update Function… in My Functions
      operatorsE1Added: true, // E1b: the new operators in the Compare and Excel Functions groups
      operatorsE2Added: true, // E2a: ln, exp, sqrt, int and trunc in the Excel Functions group
      operatorsE2bAdded: true, // E2b: choose in the same group
      libraryPacksAdded: true, // 8a: Open Library Pack… and Save as Library Pack… in the File tab's Library group
      libraryBrowseAdded: true, // 8d: Browse Library… in the same group
      helpAdded: true, // step 10: the Help group at the end of the View tab
      addManyRectsAdded: true, // 12b: Add Many Rectangles… after Add Rectangle
      libraryAuthor,
      windowSizes: cleanWindowSizes(windowSizes), templateGroupsClosed: templateGroupsClosed.slice(0, 200),
      helpSize: cleanHelpSize(helpPanelSize)
    };
  }
  // One-time update of a ribbon customised before the Document group existed: add it at
  // the front of the File tab (or the first tab, if File was removed).
  function addDocumentGroupToRibbon(){
    const tabs = ribbonState.config.tabs;
    const tab = tabs.find(t => t && t.id === 'file') || tabs[0];
    if(!tab) return;
    if(!Array.isArray(tab.groups)) tab.groups = [];
    tab.groups.unshift(cloneData(DOCUMENT_RIBBON_GROUP));
  }
  // One-time update of a ribbon customised before your own functions existed: the My
  // Functions group joins the Insert tab (before its Library group). A ribbon without an
  // Insert tab is left as its owner made it (Functions is still in the Command Launcher).
  function addFunctionsGroupToRibbon(){
    const tab = ribbonState.config.tabs.find(t => t && t.id === 'insert');
    if(!tab) return;
    if(!Array.isArray(tab.groups)) tab.groups = [];
    if(tab.groups.some(g => g && g.id === 'myFunctions')) return;
    const lib = tab.groups.findIndex(g => g && g.label === 'Library');
    tab.groups.splice(lib < 0 ? tab.groups.length : lib, 0, cloneData(FUNCTIONS_RIBBON_GROUP));
  }
  // One-time update (D2b) of a customised ribbon's My Functions group: Insert Function… and
  // Update Function… join it, wherever the person moved the group. A ribbon without the group
  // is left alone; a command removed afterwards stays removed (this runs once).
  function addFunctionCommandsToRibbon(){
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => {
      if(!g || g.id !== 'myFunctions') return;
      if(!Array.isArray(g.items)) g.items = [];
      ['insertFunction', 'updateFunction'].forEach((cmd, i) => {
        if(!g.items.some(it => it && it.cmd === cmd)) g.items.splice(Math.min(g.items.length, 1 + i), 0, { cmd });
      });
    }));
  }
  // One-time update (E1b) of a customised ribbon: = and ≠ join the group holding the
  // comparisons, and if, and, or, not, the rounding operators and the period number the group
  // holding the Excel functions (min, max…), wherever the person moved them. A ribbon without
  // such a group is left alone (the Command Launcher has every operator); an operator removed
  // afterwards stays removed (this runs once).
  function addE1OperatorsToRibbon(){
    const groups = [];
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => { if(g && Array.isArray(g.items)) groups.push(g); }));
    const holding = (i) => groups.find(g => g.items.some(it => it && it.cmd === 'insertOp' + i));
    [[holding(6), E1_COMPARE_OPS], [holding(11), E1_FUNCTION_OPS]].forEach(([g, list]) => {
      if(!g) return;
      list.forEach(i => { if(!g.items.some(it => it && it.cmd === 'insertOp' + i)) g.items.push({ cmd: 'insertOp' + i }); });
    });
  }
  // One-time update (E2a, and E2b for choose) of a customised ribbon: ln, exp, sqrt, int and
  // trunc (`list`) join the group holding the Excel functions (min…), wherever the person
  // moved it, as in E1b.
  function addE2OperatorsToRibbon(list){
    const groups = [];
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => { if(g && Array.isArray(g.items)) groups.push(g); }));
    const g = groups.find(x => x.items.some(it => it && it.cmd === 'insertOp11'));
    if(!g) return;
    list.forEach(i => { if(!g.items.some(it => it && it.cmd === 'insertOp' + i)) g.items.push({ cmd: 'insertOp' + i }); });
  }
  // One-time update (8a) of a customised ribbon: Open Library Pack… and Save as Library
  // Pack… join the group holding Format Presets (the File tab's Library group), wherever the
  // person moved it. A ribbon without it is left alone (the Command Launcher has both); a
  // command removed afterwards stays removed (this runs once).
  function addLibraryPackCommandsToRibbon(){
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => {
      if(!g || !Array.isArray(g.items) || !g.items.some(it => it && it.cmd === 'openFormats')) return;
      ['openLibraryPack', 'saveLibraryPack'].forEach(cmd => { if(!g.items.some(it => it && it.cmd === cmd)) g.items.push({ cmd }); });
    }));
  }
  // One-time update (8d) of a customised ribbon: Browse Library… joins the group holding Open
  // Library Pack… (or else Format Presets), just before Open Library Pack…, wherever the
  // person moved it. A ribbon without either is left alone (the Command Launcher has it); a
  // command removed afterwards stays removed (this runs once).
  function addLibraryBrowseCommandToRibbon(){
    const groups = [];
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => { if(g && Array.isArray(g.items)) groups.push(g); }));
    const has = (g, cmd) => g.items.some(it => it && it.cmd === cmd);
    if(groups.some(g => has(g, 'browseLibrary'))) return;
    const g = groups.find(x => has(x, 'openLibraryPack')) || groups.find(x => has(x, 'openFormats'));
    if(!g) return;
    const at = g.items.findIndex(it => it && it.cmd === 'openLibraryPack');
    g.items.splice(at < 0 ? g.items.length : at, 0, { cmd: 'browseLibrary' });
  }
  // One-time update (step 12b) of a customised ribbon: Add Many Rectangles… right after every
  // Add Rectangle it has (none: left alone; already there: left alone).
  function addManyRectsCommandToRibbon(){
    const groups = [];
    ribbonState.config.tabs.forEach(t => (t && Array.isArray(t.groups) ? t.groups : []).forEach(g => { if(g && Array.isArray(g.items)) groups.push(g); }));
    if(groups.some(g => g.items.some(it => it && it.cmd === 'addManyRects'))) return;
    groups.forEach(g => {
      const at = g.items.findIndex(it => it && it.cmd === 'addRect');
      if(at >= 0) g.items.splice(at + 1, 0, { cmd: 'addManyRects' });
    });
  }
  // One-time update (step 10) of a customised ribbon: the Help group joins the end of the tab
  // holding Keyboard Shortcuts (the View tab), or else the View tab. A ribbon with neither, or
  // that already has Help, is left alone (❓ beside the search box and F1 still open it); a
  // group removed afterwards stays removed (this runs once).
  function addHelpGroupToRibbon(){
    const tabs = ribbonState.config.tabs.filter(t => t && Array.isArray(t.groups));
    if(tabs.some(t => t.groups.some(g => g && Array.isArray(g.items) && g.items.some(it => it && it.cmd === 'openHelp')))) return;
    const tab = tabs.find(t => t.groups.some(g => g && Array.isArray(g.items) && g.items.some(it => it && it.cmd === 'openShortcuts')))
      || tabs.find(t => t.id === 'view');
    if(!tab) return;
    tab.groups.push(cloneData(HELP_RIBBON_GROUP));
  }
  // fromImport: a workspace file (maybe someone else's) — its author name for library packs
  // is not taken over; only your own autosave remembers yours.
  function applyUiPayload(ui, fromImport){
    if(!ui || typeof ui !== 'object') return;
    const fileRibbon = ui.ribbonCustomized ? cleanRibbonConfig(ui.ribbon) : null;
    if(fileRibbon){
      ribbonState.config = fileRibbon;
      ribbonState.customized = true;
      if(ui.documentGroupAdded !== true) addDocumentGroupToRibbon();
      if(ui.functionsGroupAdded !== true) addFunctionsGroupToRibbon();
      if(ui.functionCommandsAdded !== true) addFunctionCommandsToRibbon();
      if(ui.operatorsE1Added !== true) addE1OperatorsToRibbon();
      if(ui.operatorsE2Added !== true) addE2OperatorsToRibbon(E2_FUNCTION_OPS);
      if(ui.operatorsE2bAdded !== true) addE2OperatorsToRibbon(E2B_FUNCTION_OPS);
      if(ui.libraryPacksAdded !== true) addLibraryPackCommandsToRibbon();
      if(ui.libraryBrowseAdded !== true) addLibraryBrowseCommandToRibbon();
      if(ui.helpAdded !== true) addHelpGroupToRibbon();
      if(ui.addManyRectsAdded !== true) addManyRectsCommandToRibbon();
    }
    if(!fromImport && typeof ui.libraryAuthor === 'string') libraryAuthor = ui.libraryAuthor.slice(0, LIBRARY_PACK_LIMITS.author);
    // Window sizes, closed template groups and the Help panel's width belong to this screen and person: never from
    // someone else's file.
    if(!fromImport){
      windowSizes = cleanWindowSizes(ui.windowSizes);
      helpPanelSize = cleanHelpSize(ui.helpSize);
      if(Array.isArray(ui.templateGroupsClosed)) templateGroupsClosed = ui.templateGroupsClosed.filter(g => typeof g === 'string').map(g => g.slice(0, 200)).slice(0, 200);
    }
    if(typeof ui.ribbonCollapsed === 'boolean') ribbonState.collapsed = ui.ribbonCollapsed;
    if(typeof ui.activeTab === 'string') ribbonState.activeTab = ui.activeTab;
    if(ui.keytipTrigger && (ui.keytipTrigger.type === 'tap' && ui.keytipTrigger.key || ui.keytipTrigger.type === 'combo' && ui.keytipTrigger.combo)){
      keytipTrigger = Object.assign({}, ui.keytipTrigger);
      if(keytipTrigger.type === 'combo') keytipTrigger.combo = canonicalCombo(keytipTrigger.combo, !(ui.comboVersion >= 2)) || 'F10';
    }
    if(Array.isArray(ui.launcherRecent)) launcherRecent = ui.launcherRecent.slice(0, LAUNCHER_RECENT_MAX);
    if(typeof ui.lastRunMacroId === 'string') lastRunMacroId = ui.lastRunMacroId;
    if(ui.dedupeMatch && typeof ui.dedupeMatch === 'object'){
      Object.keys(dedupeMatch).forEach(k => { if(typeof ui.dedupeMatch[k] === 'boolean') dedupeMatch[k] = ui.dedupeMatch[k]; });
    }
  }

  // A ribbon layout read from a file (a workspace or preferences file, maybe someone
  // else's): only the known fields, with the right types, so a malformed layout can't break
  // the ribbon. Returns null when there is no usable layout.
  function cleanRibbonConfig(r){
    if(!r || typeof r !== 'object' || !Array.isArray(r.tabs)) return null;
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);
    const obj = v => !!v && typeof v === 'object';
    const tabs = r.tabs.filter(obj).map((t, ti) => {
      const tab = { id: str(t.id, 80) || ('tab' + ti), label: str(t.label, 60) || 'Tab', groups: [] };
      if(str(t.keytip, 3)) tab.keytip = str(t.keytip, 3);
      tab.groups = (Array.isArray(t.groups) ? t.groups : []).filter(obj).map(g => {
        const group = { label: str(g.label, 60) || 'Group', items: [] };
        if(str(g.id, 80)) group.id = str(g.id, 80);
        group.items = (Array.isArray(g.items) ? g.items : []).filter(it => obj(it) && typeof it.cmd === 'string').map(it => {
          const item = { cmd: it.cmd.slice(0, 120) };
          if(it.size === 'large') item.size = 'large';
          if(str(it.keytip, 3)) item.keytip = str(it.keytip, 3);
          if(str(it.label, 60)) item.label = str(it.label, 60);
          return item;
        });
        return group;
      });
      return tab;
    });
    if(!tabs.length) return null;
    return { qat: (Array.isArray(r.qat) ? r.qat : []).filter(x => typeof x === 'string').map(x => x.slice(0, 120)), tabs };
  }

  // ---------- Preferences file (fmIDE-preferences) ----------
  // The person's own settings, to take to another computer or share: shortcuts for built-in
  // commands, the ribbon and Quick Access Toolbar, the ribbon's collapsed state and the
  // KeyTips trigger. Macro shortcuts stay out (macro ids belong to one person's library)
  // and are kept on import, unless a built-in command from the file takes the same key;
  // ribbon buttons for macros this person doesn't have are dropped.
  const fileInputPreferences = document.getElementById('fileInputPreferences');
  let afterPreferencesImport = null;

  function buildPreferencesPayload(){
    const bindings = {};
    COMMANDS.forEach(c => { if(!c.id.startsWith('macro:')) bindings[c.id] = shortcutBindings[c.id] || null; });
    return {
      kind: 'fmIDE-preferences', version: 1,
      shortcutBindings: bindings, shortcutBindingsVersion: 2,
      ribbonCustomized: !!ribbonState.customized,
      ribbon: ribbonState.customized ? cloneData(ribbonState.config) : null,
      ribbonCollapsed: !!ribbonState.collapsed,
      keytipTrigger: Object.assign({}, keytipTrigger)
    };
  }
  function exportPreferencesToFile(){ downloadJSON(buildPreferencesPayload(), 'fmIDE-preferences.json'); }

  function applyPreferencesPayload(data){
    COMMANDS.forEach(c => { if(!c.id.startsWith('macro:')) shortcutBindings[c.id] = c.defaultShortcut || null; });
    if(data.shortcutBindings && typeof data.shortcutBindings === 'object'){
      const legacy = !(data.shortcutBindingsVersion >= 2);
      Object.keys(data.shortcutBindings).forEach(id => {
        if(id.startsWith('macro:') || !COMMANDS.some(c => c.id === id)) return;
        const v = data.shortcutBindings[id];
        shortcutBindings[id] = typeof v === 'string' ? (canonicalCombo(v, legacy) || null) : null;
      });
    }
    const fileRibbon = data.ribbonCustomized ? cleanRibbonConfig(data.ribbon) : null;
    ribbonState.config = fileRibbon || cloneData(DEFAULT_RIBBON);
    ribbonState.customized = !!fileRibbon;
    ribbonState.collapsed = data.ribbonCollapsed === true;
    ribbonState.flyout = false;
    if(!ribbonState.config.tabs.some(t => t.id === ribbonState.activeTab)) ribbonState.activeTab = ribbonState.config.tabs[0].id;
    // A tap trigger is one of the modifier keys the dialog offers (any other key would
    // arm KeyTips while typing); a combo must be a valid shortcut.
    const kt = data.keytipTrigger;
    const combo = kt && kt.type === 'combo' ? canonicalCombo(kt.combo, false) : null;
    if(kt && kt.type === 'tap' && ['Alt', 'Shift', 'Control', 'Meta'].includes(kt.key)) keytipTrigger = { type: 'tap', key: kt.key };
    else if(combo) keytipTrigger = { type: 'combo', combo };
    else keytipTrigger = Object.assign({}, DEFAULT_KEYTIP_TRIGGER);
    dedupeBindings();      // built-in commands come first, so they win over a macro's key
    rebuildShortcutMap();
    syncPinnedMacrosIntoRibbon();
    renderRibbon();
    saveWorkspaceSoon();
  }

  // onDone runs after the settings were replaced (e.g. to reopen the Customize dialog).
  function importPreferencesInteractive(onDone){
    afterPreferencesImport = onDone || null;
    fileInputPreferences.click();
  }
  fileInputPreferences.addEventListener('change', () => {
    const file = fileInputPreferences.files && fileInputPreferences.files[0];
    fileInputPreferences.value = '';
    const onDone = afterPreferencesImport;
    afterPreferencesImport = null;
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => openFmFileText(String(reader.result), ['fmIDE-preferences'], (data) => {
      showConfirm('Replace your shortcuts, ribbon and KeyTips settings with the ones in this file?', () => {
        applyPreferencesPayload(data);
        if(onDone) onDone();
        toast('Preferences imported.');
      });
    });
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  });

  function startRenameActiveCanvas(){
    const tab = canvasTabsEl.querySelector(`.canvas-tab[data-id="${activeCanvasId}"]`);
    const c = activeCanvas();
    if(tab && c) startRenameCanvasTab(tab, c, tab.querySelector('.name'));
  }

  renderRibbon();

  // The autosaved workspace is read asynchronously (IndexedDB), so the rest of start-up
  // waits for it; window.fm appears once fmIDE is ready.
  loadWorkspaceFromStore().then(restored => loadDocumentSession(restored).then(() => restored)).then(restoredFromWorkspace => {
    ensureDefaultFormatPresets();

    if(!restoredFromWorkspace){
      // seed: Unit Price x Volume x FX = Revenue
      (function seed(){
        const unitPrice = { id: uid('n'), type:'value', x:80,  y:60,  w:160, h:64, text:'Unit Price\n50\n$/t' };
        const volume    = { id: uid('n'), type:'value', x:80,  y:190, w:160, h:64, text:'Volume\n1200\nkt' };
        const fx        = { id: uid('n'), type:'value', x:80,  y:320, w:160, h:64, text:'FX\n1.1' };
        const mul       = { id: uid('n'), type:'operator', x:380, y:196, w:56, h:56, text:'×' };
        const revenue   = { id: uid('n'), type:'value', x:620, y:190, w:160, h:64, text:'Revenue' };
        nodes.push(unitPrice, volume, fx, mul, revenue);
        edges.push({id:uid('e'), from:unitPrice.id, to:mul.id});
        edges.push({id:uid('e'), from:volume.id,    to:mul.id});
        edges.push({id:uid('e'), from:fx.id,        to:mul.id});
        edges.push({id:uid('e'), from:mul.id,       to:revenue.id});

        // plug / socket demo: any rectangle plugged "Revenue" auto-feeds the + operator socketed "Revenue"
        const gold   = { id: uid('n'), type:'value', x:80,  y:480, w:160, h:64, text:'Gold Revenue\n500', plugs:['Revenue'] };
        const silver = { id: uid('n'), type:'value', x:80,  y:600, w:160, h:64, text:'Silver Revenue\n300', plugs:['Revenue'] };
        const copper = { id: uid('n'), type:'value', x:80,  y:720, w:160, h:64, text:'Copper Revenue\n200', plugs:['Revenue'] };
        const sumOp  = { id: uid('n'), type:'operator', x:380, y:596, w:56, h:56, text:'+', socket:'Revenue' };
        const total  = { id: uid('n'), type:'value', x:620, y:590, w:160, h:64, text:'Total Revenue' };
        nodes.push(gold, silver, copper, sumOp, total);
        edges.push({id:uid('e'), from:sumOp.id, to:total.id});
      })();

      render();

      canvases.push({
        id: 'c' + (nextCanvasId++),
        name: 'Revenue Model',
        nodes, edges, computedValues, computeErrors, portValues, portErrors
      });
      activeCanvasId = canvases[0].id;
      syncAutoConnections();
      evaluateAll();
      renderCanvasTabs();
    }

    syncMacroCommands();   // also renders the ribbon with any restored layout
    updateHistoryButtons();

    // Autosave the whole workspace (system + templates + format presets + shortcuts) so
    // nothing needs re-loading next time the app is opened — no explicit save action needed.
    // Saving is asynchronous, so it also happens as soon as the page is hidden (switching
    // tab, minimising, closing): a write started only while the page unloads may not finish.
    workspaceRestored = true;
    updateDocTitle();
    showRecoveryNotice();
    if(!restoredFromWorkspace) showWelcomeCard(); // the very first start (step 10, H3)
    startWebApp();
    setInterval(saveWorkspace, 8000);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') saveWorkspace(); });
    window.addEventListener('beforeunload', saveWorkspace);

    // Debug/test hook only — not used by the running app itself. Lets an isolated Node.js
    // test harness load this whole file in a stubbed DOM and drive the computation engine
    // directly (load a system export, evaluate, inspect results) without simulating any UI.
    if(typeof window !== 'undefined'){
      window.__fmIDE = {
        applySystemData: applySystemDataDirect,
        evaluateAll,
        getCanvases: () => canvases,
        getPeriods: () => periods,
        getMacros: () => MACROS,
        recorder,
        startRecording, stopRecording, runMacroInteractive, importMacros, syncMacroCommands,
        getRibbonConfig: () => ribbonState.config
      };
      // Public automation API: every action a user can take with the mouse/keyboard.
      // fm.actions() lists them with their parameters.
      window.fm = fm;
    }
  });
})();
