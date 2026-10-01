  // =====================================================================================
  // ---------- Ribbon · Quick Access Toolbar · KeyTips ----------
  // =====================================================================================
  // The ribbon layout is plain data (tabs → groups → command ids) so users can customize
  // it; it is saved with the workspace. Items reference COMMANDS ids (including macros,
  // whose ids are "macro:<id>"). size: 'large' | 'small'; keytip: optional fixed KeyTip.
  // The Document group leads the File tab. Ribbons customised before it existed get it once
  // (addDocumentGroupToRibbon, 21); removing it afterwards is respected.
  const DOCUMENT_RIBBON_GROUP = { id:'document', label:'Document', items:[
    { cmd:'saveDocument', size:'large' }, { cmd:'newDocument' }, { cmd:'openDocument' }, { cmd:'saveDocumentAs' }, { cmd:'openRecent' } ] };
  // Your own functions (step 7, phase D2), on the Insert tab.
  const FUNCTIONS_RIBBON_GROUP = { id:'myFunctions', label:'My Functions', items:[
    { cmd:'openFunctions', size:'large' }, { cmd:'insertFunction' }, { cmd:'updateFunction' }, { cmd:'importFunctions' } ] };
  // Help (step 10), at the end of the View tab.
  const HELP_RIBBON_GROUP = { id:'help', label:'Help', items:[ { cmd:'openHelp', size:'large' } ] };
  const DEFAULT_RIBBON = {
    qat: ['undo', 'redo', 'evaluate', 'openLauncher'],
    tabs: [
      { id:'file', label:'File', keytip:'F', groups:[
        cloneData(DOCUMENT_RIBBON_GROUP),
        { label:'System', items:[ { cmd:'saveSystem', size:'large' }, { cmd:'loadSystem' }, { cmd:'addSystem' } ] },
        { label:'Module', items:[ { cmd:'saveModule', size:'large' }, { cmd:'loadModule' } ] },
        { label:'Workspace', items:[ { cmd:'exportWorkspace' }, { cmd:'importWorkspace' } ] },
        { label:'Preferences', items:[ { cmd:'exportPreferences' }, { cmd:'importPreferences' } ] },
        { label:'App', items:[ { cmd:'openExcelExporter', size:'large' }, { cmd:'installApp' } ] },
        { label:'Library', items:[ { cmd:'openTemplates', size:'large' }, { cmd:'openFunctions', size:'large' }, { cmd:'openFormats', size:'large' }, { cmd:'browseLibrary' }, { cmd:'openLibraryPack' }, { cmd:'saveLibraryPack' } ] },
      ]},
      { id:'home', label:'Home', keytip:'H', groups:[
        { label:'Clipboard', items:[ { cmd:'paste', size:'large' }, { cmd:'cut' }, { cmd:'copy' } ] },
        { label:'Insert', items:[ { cmd:'addRect', size:'large' }, { cmd:'addManyRects' }, { cmd:'addOperator', size:'large' }, { cmd:'addAlias' }, { cmd:'addBlock' }, { cmd:'insertFunction' }, { cmd:'addPeriodShift' } ] },
        { label:'Edit', items:[ { cmd:'undo' }, { cmd:'redo' }, { cmd:'deleteSel' }, { cmd:'selectAll' }, { cmd:'deselect' } ] },
        { label:'Arrange', items:[ { cmd:'alignLeft' }, { cmd:'alignCenterH' }, { cmd:'alignRight' }, { cmd:'alignTop' }, { cmd:'alignCenterV' }, { cmd:'alignBottom' } ] },
        { label:'Compute', items:[ { cmd:'evaluate', size:'large' }, { cmd:'prevPeriod' }, { cmd:'managePeriods' }, { cmd:'nextPeriod' } ] },
      ]},
      { id:'insert', label:'Insert', keytip:'N', groups:[
        { label:'Nodes', items:[ { cmd:'addRect', size:'large' }, { cmd:'addManyRects', size:'large' }, { cmd:'addAlias', size:'large' }, { cmd:'addBlock', size:'large' }, { cmd:'addPeriodShift', size:'large' } ] },
        { label:'Arithmetic', items:[0,1,2,3,4,5].map(i => ({ cmd:'insertOp' + i })) },
        { label:'Compare', items:[6,7,8,9].concat(E1_COMPARE_OPS).map(i => ({ cmd:'insertOp' + i })) },
        { label:'Excel Functions', items:[10,11,12,13,14].concat(E1_FUNCTION_OPS, E2_FUNCTION_OPS, E2B_FUNCTION_OPS).map(i => ({ cmd:'insertOp' + i })) },
        cloneData(FUNCTIONS_RIBBON_GROUP),
        { label:'Library', items:[ { cmd:'openTemplates', size:'large' }, { cmd:'updateCanvasTemplate' }, { cmd:'unlinkCanvasTemplate' } ] },
      ]},
      { id:'arrange', label:'Arrange', keytip:'A', groups:[
        { label:'Align', items:[ { cmd:'alignLeft' }, { cmd:'alignCenterH' }, { cmd:'alignRight' }, { cmd:'alignTop' }, { cmd:'alignCenterV' }, { cmd:'alignBottom' } ] },
        { label:'Distribute', items:[ { cmd:'distH', size:'large' }, { cmd:'distV', size:'large' } ] },
        { label:'Selection', items:[ { cmd:'selectAll' }, { cmd:'deselect' }, { cmd:'deleteSel' } ] },
      ]},
      { id:'model', label:'Model', keytip:'M', groups:[
        { label:'Compute', items:[ { cmd:'evaluate', size:'large' } ] },
        { label:'Periods', items:[ { cmd:'prevPeriod' }, { cmd:'managePeriods' }, { cmd:'nextPeriod' } ] },
        { label:'Canvas', items:[ { cmd:'newCanvas', size:'large' }, { cmd:'renameCanvas' }, { cmd:'deleteCanvas' }, { cmd:'clearCanvas' }, { cmd:'moveCanvasLeft' }, { cmd:'moveCanvasRight' }, { cmd:'clearAll', size:'large' } ] },
        { label:'Formatting', items:[ { cmd:'openFormats', size:'large' } ] },
      ]},
      { id:'view', label:'View', keytip:'W', groups:[
        { label:'Commands', items:[ { cmd:'openLauncher', size:'large' }, { cmd:'openShortcuts', size:'large' } ] },
        { label:'Ribbon', items:[ { cmd:'toggleRibbon' }, { cmd:'customizeRibbon' } ] },
        cloneData(HELP_RIBBON_GROUP),
      ]},
      { id:'macros', label:'Macros', keytip:'X', groups:[
        { label:'Macros', items:[ { cmd:'openMacros', size:'large' }, { cmd:'toggleRecord', size:'large' }, { cmd:'runLastMacro' } ] },
        { label:'My Macros', id:'myMacros', items:[] },
      ]},
    ]
  };

  const ribbonState = { config: cloneData(DEFAULT_RIBBON), activeTab:'home', collapsed:false, flyout:false };
  const DEFAULT_KEYTIP_TRIGGER = { type:'tap', key:'Alt' };
  let keytipTrigger = Object.assign({}, DEFAULT_KEYTIP_TRIGGER);
  let ribbonButtons = [];   // [{ el, cmdId, scope:'qat'|'tab', item }]
  let ribbonTabEls = [];    // [{ el, tab }]

  function isMac(){
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/i.test(p);
  }
  // Human-readable combo: "⌃⌥⇧⌘R" on a Mac (Apple's modifier order), "Ctrl+Alt+Shift+R" elsewhere.
  function prettyCombo(combo){
    if(!combo) return '';
    const tokens = combo.split('+');
    let key = tokens.pop();
    if(key === '' && combo.endsWith('+')) key = '+';
    const mods = new Set(tokens);
    const mac = isMac();
    const keyNames = mac
      ? { Plus:'+', Escape:'⎋', Delete:'⌦', Backspace:'⌫', Enter:'↩', Tab:'⇥', Space:'Space', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', PageUp:'⇞', PageDown:'⇟', Home:'↖', End:'↘' }
      : { Plus:'+', Escape:'Esc', Delete:'Del', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→' };
    const k = keyNames[key] || key;
    if(mac){
      return (mods.has('Ctrl') ? '⌃' : '') + (mods.has('Alt') ? '⌥' : '') + (mods.has('Shift') ? '⇧' : '') + (mods.has('Mod') || mods.has('Meta') ? '⌘' : '') + k;
    }
    const out = [];
    if(mods.has('Mod') || mods.has('Ctrl')) out.push('Ctrl');
    if(mods.has('Alt')) out.push('Alt');
    if(mods.has('Shift')) out.push('Shift');
    if(mods.has('Meta')) out.push('Win');
    out.push(k);
    return out.join('+');
  }
  function triggerLabel(t){
    t = t || keytipTrigger;
    if(t.type === 'tap'){
      const names = { Alt: isMac() ? 'Option (⌥)' : 'Alt', Shift: isMac() ? 'Shift (⇧)' : 'Shift', Control: isMac() ? 'Control (⌃)' : 'Ctrl', Meta: isMac() ? 'Command (⌘)' : 'Win' };
      return 'tap ' + (names[t.key] || t.key);
    }
    return prettyCombo(t.combo);
  }

  function el(tag, cls, text){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text !== undefined) e.textContent = text;
    return e;
  }


  let ribbonArrowsUpdate = null; // addRibbonScrollArrows' update, while the ribbon is open
  function renderRibbon(){
    const cfg = ribbonState.config;
    if(!cfg.tabs.some(t => t.id === ribbonState.activeTab)) ribbonState.activeTab = cfg.tabs[0] ? cfg.tabs[0].id : null;
    ribbonEl.innerHTML = '';
    ribbonEl.classList.toggle('collapsed', ribbonState.collapsed);
    ribbonEl.classList.toggle('flyout', ribbonState.collapsed && ribbonState.flyout);
    ribbonButtons = [];
    ribbonTabEls = [];

    const strip = el('div', 'rb-strip');
    strip.appendChild(el('div', 'rb-brand', 'fmIDE'));

    const qat = el('div', 'rb-qat');
    (cfg.qat || []).forEach(id => {
      const c = getCommand(id);
      if(!c) return;
      const b = el('button');
      b.type = 'button';
      b.textContent = c.icon || '•';
      setCommandTip(b, c);
      b.addEventListener('click', () => { closeRibbonFlyout(); runCommand(c.id); });
      qat.appendChild(b);
      ribbonButtons.push({ el: b, cmdId: c.id, scope:'qat' });
    });
    strip.appendChild(qat);

    cfg.tabs.forEach(t => {
      const tabEl = el('div', 'rb-tab' + (t.id === ribbonState.activeTab ? ' active' : '') + (ribbonState.collapsed && ribbonState.flyout && t.id === ribbonState.activeTab ? ' flyout-open' : ''), t.label);
      tabEl.addEventListener('mousedown', (ev) => ev.preventDefault());
      tabEl.addEventListener('click', () => {
        if(ribbonState.collapsed){
          const same = ribbonState.flyout && ribbonState.activeTab === t.id;
          ribbonState.activeTab = t.id;
          ribbonState.flyout = !same;
        } else {
          ribbonState.activeTab = t.id;
        }
        renderRibbon();
      });
      tabEl.addEventListener('dblclick', () => setRibbonCollapsed(!ribbonState.collapsed));
      strip.appendChild(tabEl);
      ribbonTabEls.push({ el: tabEl, tab: t });
    });

    const right = el('div', 'rb-right');
    const rec = el('div', 'rb-rec' + (recorder.active ? ' show' : ''));
    rec.id = 'rbRecPill';
    rec.title = 'Click to stop recording';
    rec.appendChild(el('span', 'dot'));
    rec.appendChild(el('span', 'rtxt', 'Recording'));
    rec.addEventListener('click', () => stopRecording());
    right.appendChild(rec);
    const search = el('div', 'rb-search');
    search.appendChild(el('span', '', '🔎'));
    search.appendChild(el('span', '', 'Search commands…'));
    const kbd = el('span', 'kbd', prettyCombo(shortcutBindings.openLauncher || ''));
    search.appendChild(kbd);
    search.title = 'Command Launcher — type a command name and press Enter';
    search.addEventListener('click', () => openLauncher());
    right.appendChild(search);
    const helpBtn = el('button', 'rb-iconbtn rb-help', '❓');
    helpBtn.type = 'button';
    helpBtn.id = 'rbHelp';
    helpBtn.title = 'Help' + (shortcutBindings.openHelp ? ` (${prettyCombo(shortcutBindings.openHelp)})` : '') + '\nPlain-English guides and a help search';
    helpBtn.addEventListener('click', () => { closeRibbonFlyout(); toggleHelp(); });
    right.appendChild(helpBtn);
    const colBtn = el('button', 'rb-iconbtn', ribbonState.collapsed ? '⌄' : '⌃');
    colBtn.type = 'button';
    colBtn.title = (ribbonState.collapsed ? 'Pin the ribbon open' : 'Collapse the ribbon') + (shortcutBindings.toggleRibbon ? ` (${prettyCombo(shortcutBindings.toggleRibbon)})` : '');
    colBtn.addEventListener('click', () => setRibbonCollapsed(!ribbonState.collapsed));
    right.appendChild(colBtn);
    strip.appendChild(right);
    ribbonEl.appendChild(strip);

    const body = el('div', 'rb-body');
    const tab = cfg.tabs.find(t => t.id === ribbonState.activeTab);
    if(tab){
      tab.groups.forEach(g => {
        const gEl = el('div', 'rb-group');
        const itemsEl = el('div', 'rb-group-items');
        let col = null, colCount = 0;
        const items = (g.items || []).filter(it => getCommand(it.cmd));
        items.forEach(it => {
          const c = getCommand(it.cmd);
          const large = it.size === 'large';
          const b = el('button', 'rb-btn ' + (large ? 'large' : 'small'));
          b.type = 'button';
          b.appendChild(el('span', 'ic', c.icon || '•'));
          b.appendChild(el('span', 'lb', it.label || c.short || commandLabel(c)));
          setCommandTip(b, c);
          b.addEventListener('mousedown', (ev) => ev.preventDefault());
          b.addEventListener('click', () => { closeRibbonFlyout(); runCommand(c.id); });
          if(large){
            itemsEl.appendChild(b);
            col = null;
          } else {
            if(!col || colCount >= 3){ col = el('div', 'rb-col'); itemsEl.appendChild(col); colCount = 0; }
            col.appendChild(b); colCount++;
          }
          ribbonButtons.push({ el: b, cmdId: c.id, scope:'tab', item: it });
        });
        if(items.length === 0){
          itemsEl.appendChild(el('div', 'rb-empty-note', g.id === 'myMacros'
            ? 'Tick "Show on Ribbon" in the Macro Builder to put macros here.'
            : 'Empty group — add commands in View › Customize Ribbon.'));
        }
        gEl.appendChild(itemsEl);
        gEl.appendChild(el('div', 'rb-group-label', g.label));
        body.appendChild(gEl);
      });
    }
    ribbonEl.appendChild(body);
    ribbonArrowsUpdate = ribbonState.collapsed ? null : addRibbonScrollArrows(body);
    updateRibbonHeight();
    refreshCommandStatesNow();
    if(keytips.active) keytipsRedraw();
  }

  // Arrows at the ends of the ribbon while a finger is in use (styles.css, .rb-more): each shows
  // when there is more of the ribbon that way, and a tap scrolls it most of a screen along.
  // Returns the function that shows or hides them (kept in ribbonArrowsUpdate).
  function addRibbonScrollArrows(body){
    const arrows = ['left', 'right'].map(side => {
      const a = el('button', 'rb-more ' + side, side === 'left' ? '‹' : '›');
      a.type = 'button';
      a.title = side === 'left' ? 'More of the ribbon to the left' : 'More of the ribbon to the right';
      a.setAttribute('aria-label', a.title);
      a.addEventListener('mousedown', (ev) => ev.preventDefault());
      // To a place worked out from where the ribbon is now (a scroll still under way included).
      a.addEventListener('click', () => {
        const step = (side === 'left' ? -1 : 1) * Math.max(120, body.clientWidth * 0.6);
        body.scrollTo({ left: Math.max(0, Math.min(body.scrollWidth - body.clientWidth, body.scrollLeft + step)), behavior: 'smooth' });
      });
      ribbonEl.appendChild(a);
      return a;
    });
    const update = () => {
      arrows[0].classList.toggle('show', body.scrollLeft > 1);
      arrows[1].classList.toggle('show', body.scrollLeft + body.clientWidth < body.scrollWidth - 1);
    };
    body.addEventListener('scroll', update, { passive: true });
    update();
    return update;
  }

  function updateRibbonHeight(){
    // flyout body is absolutely positioned, so it never pushes the canvas down
    const h = ribbonEl.offsetHeight || (ribbonState.collapsed ? 33 : 128);
    document.documentElement.style.setProperty('--ribbon-h', h + 'px');
  }

  function setRibbonCollapsed(v){
    ribbonState.collapsed = !!v;
    ribbonState.flyout = false;
    renderRibbon();
  }
  function closeRibbonFlyout(){
    if(ribbonState.collapsed && ribbonState.flyout){ ribbonState.flyout = false; renderRibbon(); }
  }
  document.addEventListener('mousedown', (ev) => {
    if(ribbonState.collapsed && ribbonState.flyout && !ribbonEl.contains(ev.target)) closeRibbonFlyout();
  });
  window.addEventListener('resize', () => { updateRibbonHeight(); if(ribbonArrowsUpdate) ribbonArrowsUpdate(); if(keytips.active) keytipsRedraw(); });

  let refreshQueued = false;
  function refreshCommandStates(){
    if(refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => { refreshQueued = false; refreshCommandStatesNow(); });
  }
  function refreshCommandStatesNow(){
    ribbonButtons.forEach(rb => {
      const c = getCommand(rb.cmdId);
      if(!c) return;
      rb.el.disabled = !commandEnabled(c);
      if(rb.scope === 'tab'){
        const lb = rb.el.querySelector('.lb');
        const text = rb.item.label || c.short || commandLabel(c);
        if(lb && lb.textContent !== text) lb.textContent = text;
      }
      if(c.dynLabel) setCommandTip(rb.el, c);
      rb.el.classList.toggle('active-choice', c.id === 'toggleRecord' && recorder.active);
    });
    refreshHelpCommands();
    const pill = document.getElementById('rbRecPill');
    if(pill){
      pill.classList.toggle('show', recorder.active);
      const t = pill.querySelector('.rtxt');
      if(t) t.textContent = recorder.active ? `Recording · ${recorder.steps.length} step${recorder.steps.length === 1 ? '' : 's'} — stop` : '';
    }
  }

  // ---------- KeyTips ----------
  // Tap the trigger key (Alt / Option by default; configurable) to show a letter badge on
  // every tab and QAT button; type a tab's letter to show its commands' badges; type a
  // command's letters to run it. Esc goes back a level. Holding Alt and pressing a
  // letter (e.g. Alt+H) jumps straight in, like Office.
  const keytips = { active:false, level:null, tabId:null, buffer:'', entries:[], armed:false, layer:null, hint:null, openedFlyout:false };

  function keytipChars(label){
    const up = String(label || '').toUpperCase();
    const words = up.split(/[^A-Z0-9]+/).filter(Boolean);
    const out = [];
    words.forEach(w => out.push(w[0]));
    up.replace(/[^A-Z0-9]/g, '').split('').forEach(ch => out.push(ch));
    return out;
  }

  // Assigns 1–2 character KeyTips to entries in one scope. Fixed tips win; auto tips use a
  // letter from the label, then any free letter, then two letters that don't collide with
  // any single-letter tip (so typing is never ambiguous).
  function assignKeytips(entries, reserved){
    const used = new Set(reserved || []);
    entries.forEach(e => { if(e.fixed){ e.key = e.fixed.toUpperCase(); used.add(e.key); } });
    const singles = () => new Set(Array.from(used).filter(k => k.length === 1));
    entries.forEach(e => {
      if(e.key) return;
      const cand = keytipChars(e.label).concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
      const hit = cand.find(ch => !used.has(ch) && !Array.from(used).some(k => k.length > 1 && k[0] === ch));
      if(hit){ e.key = hit; used.add(hit); return; }
      const s1 = singles();
      const first = keytipChars(e.label).concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).filter(ch => !s1.has(ch));
      const second = keytipChars(e.label).concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''));
      outer: for(const a of first){ for(const b of second){ if(!used.has(a + b)){ e.key = a + b; used.add(e.key); break outer; } } }
    });
    return entries;
  }

  function keytipsTopEntries(){
    const entries = ribbonTabEls.map(t => ({ kind:'tab', el: t.el, tab: t.tab, label: t.tab.label, fixed: t.tab.keytip || null }));
    const qatBtns = ribbonButtons.filter(b => b.scope === 'qat');
    const qatKeys = qatBtns.map((b, i) => i < 9 ? String(i + 1) : ('0' + (i - 8)));
    assignKeytips(entries, qatKeys);
    qatBtns.forEach((b, i) => entries.push({ kind:'cmd', el: b.el, cmdId: b.cmdId, key: qatKeys[i] }));
    return entries;
  }
  function keytipsTabEntries(){
    const entries = ribbonButtons.filter(b => b.scope === 'tab').map(b => {
      const c = getCommand(b.cmdId);
      return { kind:'cmd', el: b.el, cmdId: b.cmdId, label: b.item.label || c.short || c.label, fixed: b.item.keytip || null };
    });
    return assignKeytips(entries, []);
  }

  function keytipsStart(){
    if(document.querySelector('.modal-overlay, .launcher-overlay')) return false;
    keytips.active = true;
    keytips.level = 'top';
    keytips.buffer = '';
    keytips.openedFlyout = false;
    keytipsBuildEntries();
    return true;
  }
  function keytipsBuildEntries(){ keytipsRedraw(); }
  function keytipsRedraw(){
    if(!keytips.layer){ keytips.layer = el('div'); keytips.layer.id = 'keytipLayer'; document.body.appendChild(keytips.layer); }
    keytips.layer.innerHTML = '';
    // rebuilt every time: the ribbon may have re-rendered (assignment is deterministic)
    keytips.entries = keytips.level === 'top' ? keytipsTopEntries() : keytipsTabEntries();
    keytips.entries.forEach(e => {
      if(!e.el || !e.el.isConnected) return;
      const r = e.el.getBoundingClientRect();
      if(r.width === 0 && r.height === 0) return;
      const b = el('div', 'keytip');
      const matches = e.key.startsWith(keytips.buffer);
      if(!matches) b.classList.add('dim');
      if(keytips.buffer && matches){
        b.appendChild(el('span', 'typed', e.key.slice(0, keytips.buffer.length)));
        b.appendChild(document.createTextNode(e.key.slice(keytips.buffer.length)));
      } else b.textContent = e.key;
      const disabled = e.kind === 'cmd' && e.el.disabled;
      if(disabled) b.style.opacity = '.45';
      if(e.cmdId) b.dataset.cmd = e.cmdId;
      if(e.el.classList.contains('small')){
        // small buttons: badge sits on the icon so the label stays readable
        b.style.left = (r.left + 13) + 'px';
        b.style.top = (r.top + r.height / 2) + 'px';
        b.style.transform = 'translate(-50%, -50%)';
      } else {
        b.style.left = (r.left + r.width / 2) + 'px';
        b.style.top = (e.kind === 'tab' ? r.bottom - 4 : r.bottom + 1) + 'px';
        if(e.kind !== 'tab') b.style.transform = 'translate(-50%, -50%)';
      }
      keytips.layer.appendChild(b);
    });
    const hint = el('div', 'keytip-hint', keytips.level === 'top'
      ? 'KeyTips — type a tab letter (or a number for Quick Access). Esc to exit.'
      : 'KeyTips — type the letters of a command. Esc to go back.');
    keytips.layer.appendChild(hint);
  }
  function keytipsExit(){
    keytips.active = false;
    keytips.buffer = '';
    keytips.entries = [];
    if(keytips.layer){ keytips.layer.remove(); keytips.layer = null; }
    if(keytips.openedFlyout){ keytips.openedFlyout = false; closeRibbonFlyout(); }
  }
  function keytipsBack(){
    if(keytips.level === 'tab'){
      keytips.level = 'top';
      keytips.buffer = '';
      if(keytips.openedFlyout){ keytips.openedFlyout = false; closeRibbonFlyout(); }
      keytipsBuildEntries();
    } else keytipsExit();
  }
  function keytipsType(ch){
    keytips.buffer += ch;
    const cands = keytips.entries.filter(e => e.key.startsWith(keytips.buffer));
    if(cands.length === 0){ keytips.buffer = ''; keytipsRedraw(); return; }
    const exact = cands.find(e => e.key === keytips.buffer);
    if(exact){ keytipsActivate(exact); return; }
    keytipsRedraw();
  }
  function keytipsActivate(e){
    if(e.kind === 'tab'){
      ribbonState.activeTab = e.tab.id;
      if(ribbonState.collapsed){ ribbonState.flyout = true; keytips.openedFlyout = true; }
      renderRibbon();
      keytips.level = 'tab';
      keytips.tabId = e.tab.id;
      keytips.buffer = '';
      keytipsBuildEntries();
      return;
    }
    const c = getCommand(e.cmdId);
    if(c && !commandEnabled(c)){ keytips.buffer = ''; keytipsRedraw(); toast(`"${commandLabel(c)}" isn't available right now.`); return; }
    keytipsExit();
    runCommand(e.cmdId);
  }
  function keyCharOf(ev){
    if(/^Key[A-Z]$/.test(ev.code)) return ev.code.slice(3);
    if(/^Digit[0-9]$/.test(ev.code)) return ev.code.slice(5);
    if(ev.key && ev.key.length === 1 && /[a-z0-9]/i.test(ev.key)) return ev.key.toUpperCase();
    return null;
  }
  function focusIsTyping(){
    const a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable));
  }
  let keytipCaptureListener = null; // set while the trigger-capture UI is listening

  window.addEventListener('keydown', (ev) => {
    if(keytipCaptureListener){ keytipCaptureListener(ev); return; }
    if(keytips.active){
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.key === 'Escape'){ keytipsBack(); return; }
      if(ev.key === 'Backspace'){ keytips.buffer = keytips.buffer.slice(0, -1); keytipsRedraw(); return; }
      if(keytipTrigger.type === 'tap' && ev.key === keytipTrigger.key){ keytips.armed = true; return; }
      if(keytipTrigger.type === 'combo' && normalizeCombo(ev) === keytipTrigger.combo){ keytipsExit(); return; }
      const ch = keyCharOf(ev);
      if(ch) keytipsType(ch);
      return;
    }
    if(keytipTrigger.type === 'tap'){
      if(ev.key === keytipTrigger.key){
        const others = (ev.ctrlKey && ev.key !== 'Control') || (ev.metaKey && ev.key !== 'Meta') || (ev.shiftKey && ev.key !== 'Shift') || (ev.altKey && ev.key !== 'Alt');
        keytips.armed = !ev.repeat && !others;
        if(keytipTrigger.key === 'Alt' && keytips.armed) ev.preventDefault();
        return;
      }
      keytips.armed = false;
      // Alt+letter chord (Office style): jump straight into a tab
      if(keytipTrigger.key === 'Alt' && ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey){
        const ch = keyCharOf(ev);
        if(ch && !shortcutMap[normalizeCombo(ev)] && !focusIsTyping() && keytipsStart()){
          ev.preventDefault(); ev.stopPropagation();
          keytipsType(ch);
        }
      }
      return;
    }
    if(keytipTrigger.type === 'combo' && normalizeCombo(ev) === keytipTrigger.combo){
      if(focusIsTyping()) return;
      ev.preventDefault(); ev.stopPropagation();
      keytipsStart();
    }
  }, true);

  window.addEventListener('keyup', (ev) => {
    if(keytipCaptureListener) return;
    if(keytipTrigger.type !== 'tap' || ev.key !== keytipTrigger.key) return;
    const wasArmed = keytips.armed;
    keytips.armed = false;
    if(!wasArmed) return;
    ev.preventDefault();
    if(keytips.active){ keytipsExit(); return; }
    if(focusIsTyping()) return;
    keytipsStart();
  }, true);
  window.addEventListener('mousedown', () => { keytips.armed = false; if(keytips.active) keytipsExit(); }, true);
  window.addEventListener('blur', () => { keytips.armed = false; if(keytips.active) keytipsExit(); });

