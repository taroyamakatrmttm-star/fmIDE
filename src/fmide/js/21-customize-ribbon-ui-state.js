  // =====================================================================================
  // ---------- Customize Ribbon & KeyTips dialog ----------
  // =====================================================================================
  function showCustomizeRibbon(){
    const cfg = ribbonState.config;
    const cfgAtOpen = JSON.stringify(cfg);
    const overlay = el('div', 'modal-overlay');
    const box = el('div', 'modal-box rbc-box');
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
      documentGroupAdded: true // the default ribbon has it; a customised one got it once
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
  function applyUiPayload(ui){
    if(!ui || typeof ui !== 'object') return;
    if(ui.ribbonCustomized && ui.ribbon && Array.isArray(ui.ribbon.tabs) && ui.ribbon.tabs.length){
      ribbonState.config = { qat: Array.isArray(ui.ribbon.qat) ? ui.ribbon.qat.slice() : [], tabs: cloneData(ui.ribbon.tabs) };
      ribbonState.customized = true;
      if(ui.documentGroupAdded !== true) addDocumentGroupToRibbon();
    }
    if(typeof ui.ribbonCollapsed === 'boolean') ribbonState.collapsed = ui.ribbonCollapsed;
    if(typeof ui.activeTab === 'string') ribbonState.activeTab = ui.activeTab;
    if(ui.keytipTrigger && (ui.keytipTrigger.type === 'tap' && ui.keytipTrigger.key || ui.keytipTrigger.type === 'combo' && ui.keytipTrigger.combo)){
      keytipTrigger = Object.assign({}, ui.keytipTrigger);
      if(keytipTrigger.type === 'combo') keytipTrigger.combo = canonicalCombo(keytipTrigger.combo, !(ui.comboVersion >= 2)) || 'F10';
    }
    if(Array.isArray(ui.launcherRecent)) launcherRecent = ui.launcherRecent.slice(0, LAUNCHER_RECENT_MAX);
    if(typeof ui.lastRunMacroId === 'string') lastRunMacroId = ui.lastRunMacroId;
  }

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
        const gold   = { id: uid('n'), type:'value', x:80,  y:480, w:160, h:64, text:'Gold Revenue\n500', plug:'Revenue' };
        const silver = { id: uid('n'), type:'value', x:80,  y:600, w:160, h:64, text:'Silver Revenue\n300', plug:'Revenue' };
        const copper = { id: uid('n'), type:'value', x:80,  y:720, w:160, h:64, text:'Copper Revenue\n200', plug:'Revenue' };
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
