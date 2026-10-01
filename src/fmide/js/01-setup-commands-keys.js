(function(){
  const canvas = document.getElementById('canvas');
  const svg = document.getElementById('edges');
  const viewport = document.getElementById('viewport');
  const app = document.getElementById('app');
  const ribbonEl = document.getElementById('ribbon');
  const fileInputWorkspace = document.getElementById('fileInputWorkspace');
  const fileInputSystem = document.getElementById('fileInputSystem');
  const fileInputModule = document.getElementById('fileInputModule');
  const guideV = document.getElementById('guideV');
  const guideH = document.getElementById('guideH');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const SNAP_THRESHOLD = 6;

  // build:include shared/operators.js
  // The operators, in palette order, from the shared catalogue (the ones phase E1 added come
  // last, so the Insert Operator commands of the others keep their numbers).
  const OPS = OPERATORS.map(op => op.symbol);
  const ALL_OPS = OPS;
  const WORD_OPS = OPERATORS.filter(op => op.fn).map(op => op.symbol);

  function operatorSize(sym){
    // An operator with named inputs (if, round…): a box with one labelled input per row.
    const op = operatorForSymbol(sym);
    // A choose starts with its index and one empty choice; it grows with its arrows.
    if(op && op.ports) return { w: 120, h: operatorPortsHeight(op.ports.length + (op.choices ? 1 : 0)) };
    if(WORD_OPS.includes(sym)){
      return { w: Math.max(56, 24 + sym.length * 10), h: 40 };
    }
    return { w: 56, h: 56 };
  }
  // The Insert Operator commands of phase E1's operators (numbered by catalogue order), as
  // the ribbon groups them: = and ≠ with the comparisons; the others with the Excel functions.
  const E1_COMPARE_OPS = ['=', '≠'].map(sym => OPS.indexOf(sym));
  const E1_FUNCTION_OPS = ['if', 'and', 'or', 'not', 'round', 'roundup', 'rounddown', 'period'].map(sym => OPS.indexOf(sym));
  // Phase E2a's, with the Excel functions too.
  const E2_FUNCTION_OPS = ['ln', 'exp', 'sqrt', 'int', 'trunc'].map(sym => OPS.indexOf(sym));
  // Phase E2b's choose, with them.
  const E2B_FUNCTION_OPS = ['choose'].map(sym => OPS.indexOf(sym));
  // Height of an operator box with `count` named inputs: its symbol, then a row per input.
  function operatorPortsHeight(count){ return 26 + count * 20 + 6; }

  // ---------- built-in templates ----------
  let TEMPLATES = []; // built-in starter templates removed by request — this now holds only user-saved templates
  let nextTemplateId = 1;
  // What "Remove duplicates…" requires to match, besides kind and the calculation (saved with the UI settings).
  let dedupeMatch = { name: true, layout: false, group: false, description: false };

  // Reusable rectangle-formatting presets (number format / border / font / fill),
  // saved and applied independently of any one rectangle, and exportable via JSON.
  let FORMAT_PRESETS = [];
  let nextFormatPresetId = 1;

  let nodes = [];   // {id, type:'value'|'operator', x, y, w, h, text}
  let edges = [];   // {id, from, to}
  let nextId = 1;
  let nextCanvasId = 1;
  let canvases = [];        // {id, name, nodes, edges, history, future, computedValues, computeErrors}
  let activeCanvasId = null;
  let periods = ['Period 1']; // shared timeline across every canvas; period-shift nodes read across these
  let currentPeriod = 0;      // which period's computed values are currently shown on canvas
  const canvasTabsEl = document.getElementById('canvasTabs');
  const btnAddCanvas = document.getElementById('btnAddCanvas');

  // ---------- command registry & keyboard shortcuts ----------
  // Every user-facing command lives here: the Ribbon, the Quick Access Toolbar, KeyTips,
  // the Command Launcher and keyboard shortcuts all read from this one list. Commands that
  // change the model call the `fm` automation API (defined further down), so a command run
  // from the Ribbon, a shortcut, the Launcher or a macro all go through the same code path.
  //   icon     — glyph shown on Ribbon/QAT/Launcher
  //   enabled  — optional () => bool; drives disabled state everywhere
  //   dynLabel — optional () => string; a live label (e.g. the current period)
  const hasNodeSel = () => selectedNodeIds.size > 0;
  let installPrompt = null; // the browser's offer to install fmIDE (21-web-app.js)
  const COMMANDS = [
    { id:'undo',        label:'Undo',                  icon:'↶', category:'Edit', defaultShortcut:'Mod+Z',       enabled:() => history.length > 0, action:() => undo() },
    { id:'redo',        label:'Redo',                  icon:'↷', category:'Edit', defaultShortcut:'Mod+Shift+Z', enabled:() => future.length > 0,  action:() => redo() },
    { id:'copy',        label:'Copy',                  icon:'⧉', category:'Edit', defaultShortcut:'Mod+C',       enabled:hasNodeSel, action:() => fm.copy() },
    { id:'cut',         label:'Cut',                   icon:'✂', category:'Edit', defaultShortcut:'Mod+X',       enabled:hasNodeSel, action:() => fm.cut() },
    { id:'paste',       label:'Paste',                 icon:'📋', category:'Edit', defaultShortcut:'Mod+V',      enabled:() => !!(clipboard && clipboard.nodes.length), action:() => { const ids = fm.paste(); if(ids) selectNodesOnly(ids); } },
    { id:'deleteSel',   label:'Delete Selected',       icon:'🗑', category:'Edit', defaultShortcut:'Delete',      enabled:() => !!(selectedEdgeId || selectedNodeIds.size), action:() => fm.deleteSelected() },
    { id:'selectAll',   label:'Select All',            icon:'▦', category:'Edit', defaultShortcut:'Mod+A',       enabled:() => nodes.length > 0, action:() => fm.selectAll() },
    { id:'deselect',    label:'Deselect / Cancel',     icon:'⎋', category:'Edit', defaultShortcut:'Escape',       action:() => { closePicker(); if(selectedEdgeId || selectedNodeIds.size) clearSelection(); } },

    { id:'addRect',     label:'Add Rectangle',         icon:'▭', category:'Insert', defaultShortcut:null, action:() => addRectangleInteractive() },
    { id:'addManyRects', label:'Add Many Rectangles…', icon:'▤', category:'Insert', defaultShortcut:null, action:() => showAddManyRectangles() },
    { id:'addOperator', label:'Add Operator',          icon:'±', category:'Insert', defaultShortcut:null, action:() => addOperatorInteractive() },
    { id:'addAlias',    label:'Add Alias',             icon:'🔗', category:'Insert', defaultShortcut:null, action:() => showAliasPicker(null) },
    { id:'addBlock',    label:'Add Block',             icon:'▣', category:'Insert', defaultShortcut:null, action:() => showBlockPicker(null) },
    { id:'addPeriodShift', label:'Add Period Shift',   icon:'⇥', category:'Insert', defaultShortcut:null, action:() => addPeriodShiftInteractive() },
    { id:'newCanvas',   label:'New Canvas',            icon:'🗋', category:'Canvas', defaultShortcut:null, action:() => fm.addCanvas() },
    { id:'renameCanvas',label:'Rename Canvas',         icon:'✎', category:'Canvas', defaultShortcut:null, action:() => startRenameActiveCanvas() },
    { id:'deleteCanvas',label:'Delete Canvas',         icon:'🗙', category:'Canvas', defaultShortcut:null, enabled:() => canvases.length > 1, action:() => deleteCanvasById(activeCanvasId) },
    { id:'clearCanvas', label:'Clear Canvas',          icon:'⌫', category:'Canvas', defaultShortcut:null, enabled:() => nodes.length > 0 || edges.length > 0, action:() => clearCanvasInteractive() },
    { id:'clearAll',    label:'Clear All Canvases',    icon:'🧹', category:'Canvas', defaultShortcut:null,
      enabled:() => canvases.length > 1 || nodes.length > 0 || edges.length > 0 || canvases[0].name !== 'Canvas 1',
      action:() => showConfirm('Clear everything? All canvases are removed, leaving one empty canvas named "Canvas 1". (You can Undo.)', () => fm.clearAll()) },
    { id:'moveCanvasLeft',  label:'Move Canvas Left',  icon:'⇠', category:'Canvas', defaultShortcut:null,
      enabled:() => canvases.findIndex(c => c.id === activeCanvasId) > 0, action:() => fm.moveCanvas('@current', canvases.findIndex(c => c.id === activeCanvasId)) },
    { id:'moveCanvasRight', label:'Move Canvas Right', icon:'⇢', category:'Canvas', defaultShortcut:null,
      enabled:() => canvases.findIndex(c => c.id === activeCanvasId) < canvases.length - 1, action:() => fm.moveCanvas('@current', canvases.findIndex(c => c.id === activeCanvasId) + 2) },

    { id:'alignLeft',   label:'Align Left',              icon:'⇤', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('left') },
    { id:'alignCenterH',label:'Align Center (horizontal)',icon:'⇹', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('centerH') },
    { id:'alignRight',  label:'Align Right',             icon:'⇥', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('right') },
    { id:'alignTop',    label:'Align Top',               icon:'⤒', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('top') },
    { id:'alignCenterV',label:'Align Middle (vertical)',  icon:'⇳', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('centerV') },
    { id:'alignBottom', label:'Align Bottom',            icon:'⤓', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 2, action:() => fm.align('bottom') },
    { id:'distH',       label:'Distribute Horizontally', icon:'⇿', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 3, action:() => fm.distribute('h') },
    { id:'distV',       label:'Distribute Vertically',   icon:'↕', category:'Arrange', defaultShortcut:null, enabled:() => selectedNodeIds.size >= 3, action:() => fm.distribute('v') },

    { id:'evaluate',    label:'Evaluate',              icon:'▶', category:'Compute', defaultShortcut:'F9', action:() => fm.evaluate() },
    { id:'prevPeriod',  label:'Previous Period',       icon:'‹', category:'Compute', defaultShortcut:null, enabled:() => currentPeriod > 0, action:() => fm.prevPeriod() },
    { id:'nextPeriod',  label:'Next Period',           icon:'›', category:'Compute', defaultShortcut:null, enabled:() => currentPeriod < periods.length - 1, action:() => fm.nextPeriod() },
    { id:'managePeriods',label:'Manage Periods',       icon:'📅', category:'Compute', defaultShortcut:null,
      dynLabel:() => `${periods[currentPeriod] || ('Period ' + (currentPeriod + 1))} (${currentPeriod + 1}/${periods.length})`,
      action:() => showPeriodsManager() },

    { id:'saveSystem',  label:'Save System',           icon:'💾', category:'File', defaultShortcut:null, action:() => fm.saveSystem() },
    { id:'loadSystem',  label:'Load System (replace)', icon:'📂', category:'File', defaultShortcut:null, action:() => promptLoadSystem('replace') },
    { id:'addSystem',   label:'Add System (merge)',    icon:'➕', category:'File', defaultShortcut:null, action:() => promptLoadSystem('add') },
    { id:'saveModule',  label:'Save Module',           icon:'📦', category:'File', defaultShortcut:null, action:() => fm.saveModule() },
    { id:'loadModule',  label:'Load Module',           icon:'📥', category:'File', defaultShortcut:null, action:() => fileInputModule.click() },
    { id:'exportWorkspace', label:'Export Workspace',  icon:'⇩', category:'File', defaultShortcut:null, action:() => fm.exportWorkspace() },
    { id:'importWorkspace', label:'Import Workspace',  icon:'⇧', category:'File', defaultShortcut:null, action:() => fileInputWorkspace.click() },
    { id:'exportPreferences', label:'Export Preferences…', icon:'⚙', category:'File', defaultShortcut:null, action:() => exportPreferencesToFile() },
    { id:'importPreferences', label:'Import Preferences…', icon:'⚙', category:'File', defaultShortcut:null, action:() => importPreferencesInteractive() },
    { id:'openTemplates',label:'Templates',            icon:'📚', category:'File', defaultShortcut:null, action:() => showTemplatesPicker() },
    { id:'openFunctions', label:'Functions',            icon:'ƒ', category:'File', defaultShortcut:null, action:() => showFunctionsManager() },
    { id:'importFunctions', label:'Import Functions…',  icon:'⇧', category:'File', defaultShortcut:null, action:() => pickFunctionsFile() },
    { id:'browseLibrary', label:'Browse Library…', icon:'📚', category:'File', defaultShortcut:null, action:() => showLibraryBrowser() },
    { id:'openLibraryPack', label:'Open Library Pack…', icon:'📦', category:'File', defaultShortcut:null, action:() => pickLibraryPackFile() },
    { id:'saveLibraryPack', label:'Save as Library Pack…', icon:'📦', category:'File', defaultShortcut:null, action:() => showSaveLibraryPack() },
    { id:'insertFunction', label:'Insert Function…',    icon:'ƒ', category:'Insert', defaultShortcut:null, action:() => showFunctionPicker(null) },
    { id:'updateFunction', label:'Update Function…',    icon:'⬆', category:'Insert', defaultShortcut:null, action:() => updateFunctionCommand() },
    { id:'removeDuplicateTemplates', label:'Remove Duplicate Templates…', icon:'🧹', category:'File', defaultShortcut:null, enabled:() => templateFamilies().length > 1, action:() => showRemoveDuplicatesDialog() },
    { id:'clearAllTemplates', label:'Clear All Templates', icon:'🗑', category:'File', defaultShortcut:null, enabled:() => TEMPLATES.length > 0, action:() => clearAllTemplates() },
    { id:'updateCanvasTemplate', label:'Update Canvas from Template…', icon:'⬆', category:'File', defaultShortcut:null, enabled:() => { const c = canvases.find(x => x.id === activeCanvasId); return !!(c && c.template); }, action:() => showUpdateCanvasDialog() },
    { id:'unlinkCanvasTemplate', label:'Unlink Canvas from Template', icon:'⛓', category:'File', defaultShortcut:null, enabled:() => { const c = canvases.find(x => x.id === activeCanvasId); return !!(c && c.template); }, action:() => guarded(() => fm.unlinkCanvasFromTemplate()) },
    { id:'openFormats', label:'Format Presets',        icon:'🎨', category:'File', defaultShortcut:null, action:() => showFormatPresetsPicker(null) },
    // Documents (.fmide files) — last in the File list, so a shortcut someone already gave
    // another command keeps priority over these defaults.
    { id:'newDocument', label:'New',                   icon:'📄', category:'File', defaultShortcut:null, action:() => newDocument() },
    { id:'openDocument',label:'Open…',                 icon:'📁', category:'File', defaultShortcut:'Mod+O', action:() => openDocument() },
    { id:'saveDocument',label:'Save',                  icon:'💾', category:'File', defaultShortcut:'Mod+S', action:() => saveDocument() },
    { id:'saveDocumentAs',label:'Save As…',            icon:'📝', category:'File', defaultShortcut:'Mod+Shift+S', action:() => saveDocumentAs() },
    { id:'openRecent',  label:'Open Recent…',          icon:'🕘', category:'File', defaultShortcut:null, action:() => showOpenRecent() },
    { id:'openExcelExporter', label:'Open ExcelExporter', icon:'📊', category:'File', defaultShortcut:null, action:() => openExcelExporter() },
    { id:'installApp',  label:'Install fmIDE',         icon:'⤓', category:'File', defaultShortcut:null, enabled:() => !!installPrompt, action:() => installApp() },

    { id:'openLauncher',label:'Command Launcher',      icon:'🔎', category:'View', defaultShortcut:'Mod+K', action:() => openLauncher() },
    { id:'openShortcuts',label:'Keyboard Shortcuts',   icon:'⌨', category:'View', defaultShortcut:null, action:() => showShortcutsPicker() },
    { id:'toggleRibbon',label:'Collapse / Expand Ribbon', icon:'⌃', category:'View', defaultShortcut:'Mod+F1', action:() => setRibbonCollapsed(!ribbonState.collapsed) },
    { id:'customizeRibbon',label:'Customize Ribbon & KeyTips', icon:'⚙', category:'View', defaultShortcut:null, action:() => showCustomizeRibbon() },
    { id:'openHelp',    label:'Help',                  icon:'❓', category:'View', defaultShortcut:'F1', action:() => toggleHelp() },

    { id:'openMacros',  label:'Macro Builder',         icon:'🧩', category:'Macros', defaultShortcut:null, action:() => showMacroBuilder() },
    { id:'toggleRecord',label:'Record Macro',          icon:'⏺', category:'Macros', defaultShortcut:null,
      dynLabel:() => recorder.active ? 'Stop Recording' : 'Record Macro', action:() => toggleRecordingQuick() },
    { id:'runLastMacro',label:'Run Last Macro',        icon:'⏵', category:'Macros', defaultShortcut:null, enabled:() => !!lastRunMacroId && MACROS.some(m => m.id === lastRunMacroId), action:() => runMacroInteractive(lastRunMacroId) },
  ];
  // Symbol operators show the symbol as the icon and a word as the label ("+ Add");
  // function operators show ƒ plus their name ("ƒ max"), so nothing is printed twice.
  const OP_NAMES = Object.fromEntries(OPERATORS.filter(op => op.word).map(op => [op.symbol, op.word]));
  OPS.forEach((sym, i) => {
    const word = OP_NAMES[sym];
    COMMANDS.push({ id:'insertOp' + i, label:'Insert Operator ' + sym + (word ? ' (' + word + ')' : ''), short: word || sym,
      icon: word ? sym : 'ƒ', category:'Insert', defaultShortcut:null, action:() => addOperatorInteractive(sym) });
  });
  const CATEGORY_ORDER = ['Edit','Insert','Arrange','Compute','Canvas','File','View','Macros'];
  function getCommand(id){ return COMMANDS.find(c => c.id === id); }
  function commandEnabled(c){ try{ return !c.enabled || !!c.enabled(); }catch(err){ return false; } }
  function commandLabel(c){ try{ return c.dynLabel ? c.dynLabel() : c.label; }catch(err){ return c.label; } }
  function runCommand(id){
    const c = getCommand(id);
    if(!c || !commandEnabled(c)) return false;
    if(practiceBlocks(id)) return false; // 01c: not while practising in a tutorial
    try{ c.action(); }
    catch(err){ reportError(err); }
    return true;
  }

  let shortcutBindings = {};
  let shortcutMap = {};

  // ---------- key combos ----------
  // Stored combos use platform-neutral tokens, always in this order:
  //   Mod   — the primary modifier: Command (⌘) on Mac, Ctrl on Windows/Linux
  //   Ctrl  — the Control key on Mac (⌃); not used elsewhere (Ctrl there is Mod)
  //   Alt   — Option (⌥) on Mac, Alt elsewhere
  //   Shift
  //   Meta  — the Windows key (Windows/Linux only)
  // so "Mod+Z" is Cmd+Z on a Mac and Ctrl+Z on Windows, while Cmd+R and Control+R on a
  // Mac are different shortcuts ("Mod+R" vs "Ctrl+R").
  const COMBO_MOD_ORDER = ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta'];
  const MODIFIER_KEY_NAMES = ['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'CapsLock', 'Fn', 'FnLock', 'OS', 'Hyper', 'Super'];

  // The key part of a combo. Letters and digits come from the physical key when the typed
  // character is altered by a modifier (Option+R types "®" on a Mac, Shift+1 types "!").
  function comboKeyName(e){
    let key = e.key || '';
    if(/^Key[A-Z]$/.test(e.code || '') && !/^[a-z]$/i.test(key)) key = e.code.slice(3);
    else if(/^Digit[0-9]$/.test(e.code || '') && (e.shiftKey || e.altKey || !/^[0-9]$/.test(key))) key = e.code.slice(5);
    if(key === ' ' || key === 'Spacebar') return 'Space';
    if(key === '+') return 'Plus';
    if(key === 'Esc') return 'Escape';
    if(key === 'Del') return 'Delete';
    if(key.length === 1) return key.toUpperCase();
    return key;
  }

  function normalizeCombo(e){
    if(!e.key || MODIFIER_KEY_NAMES.includes(e.key) || e.key === 'Dead' && !/^Key|^Digit/.test(e.code || '')) return null;
    const mac = isMac();
    const mods = new Set();
    if(mac){ if(e.metaKey) mods.add('Mod'); if(e.ctrlKey) mods.add('Ctrl'); }
    else { if(e.ctrlKey) mods.add('Mod'); if(e.metaKey) mods.add('Meta'); }
    if(e.altKey) mods.add('Alt');
    if(e.shiftKey) mods.add('Shift');
    return COMBO_MOD_ORDER.filter(m => mods.has(m)).concat(comboKeyName(e)).join('+');
  }

  // Canonicalises a stored/imported combo string. `legacy` = written before Mac modifiers
  // were told apart, when "Ctrl" meant "Ctrl, or Cmd on a Mac" — i.e. today's "Mod".
  function canonicalCombo(str, legacy){
    if(!str || typeof str !== 'string') return null;
    const raw = str.split('+');
    // a literal "+" key written as "Ctrl++"
    if(str.endsWith('++')){ raw.splice(raw.length - 2, 2, 'Plus'); }
    const tokens = raw.map(t => t.trim()).filter(Boolean);
    if(!tokens.length) return null;
    const key = tokens.pop();
    const alias = { cmd:'Mod', command:'Mod', '⌘':'Mod', mod:'Mod', option:'Alt', opt:'Alt', '⌥':'Alt', alt:'Alt',
      control:'Ctrl', ctl:'Ctrl', '⌃':'Ctrl', ctrl: legacy ? 'Mod' : 'Ctrl', shift:'Shift', '⇧':'Shift', meta:'Meta', win:'Meta', super:'Meta' };
    const mods = new Set();
    for(const t of tokens){
      const m = alias[t.toLowerCase()];
      if(!m) return null;
      mods.add(m);
    }
    const k = key.length === 1 ? key.toUpperCase() : key;
    return COMBO_MOD_ORDER.filter(m => mods.has(m)).concat(k).join('+');
  }

  // Combos browsers/OSes keep for themselves: pages never see them, so warn before binding.
  const RESERVED_COMBOS = new Set(['Mod+W', 'Mod+T', 'Mod+N', 'Mod+Shift+N', 'Mod+Shift+T', 'Mod+Shift+W', 'Mod+Q', 'Mod+Tab', 'Mod+Shift+Tab',
    'Mod+H', 'Mod+M', 'Mod+Alt+H', 'Mod+Alt+M', 'Mod+Space', 'Ctrl+Space', 'Alt+F4', 'Ctrl+Tab', 'Mod+Shift+Q']);
  function comboReservedNote(combo){
    if(!combo || !RESERVED_COMBOS.has(combo)) return '';
    return `${prettyCombo(combo)} is usually reserved by the browser or operating system, so it may never reach fmIDE.`;
  }

  function rebuildShortcutMap(){
    shortcutMap = {};
    COMMANDS.forEach(c => { const combo = shortcutBindings[c.id]; if(combo) shortcutMap[combo] = c.id; });
  }

  function dedupeBindings(){
    const seen = {};
    COMMANDS.forEach(c => {
      const combo = shortcutBindings[c.id];
      if(!combo) return;
      if(seen[combo]) shortcutBindings[c.id] = null;
      else seen[combo] = c.id;
    });
  }

  COMMANDS.forEach(c => { shortcutBindings[c.id] = c.defaultShortcut; });
  dedupeBindings();
  rebuildShortcutMap();

  let selectedNodeIds = new Set();
  let selectedEdgeId = null;
  let activePicker = null;

  let computedValues = {};
  let computeErrors = {};
  let portValues = {};   // blockInstanceId -> [value, value, ...] per declared output
  let portErrors = {};   // blockInstanceId -> [errCode, errCode, ...] per declared output

  // ---------- selection ----------
  function selectNodesOnly(ids){ selectedEdgeId = null; selectedNodeIds = new Set(ids); closePicker(); render(); }
  function toggleNodeSelection(id){ selectedEdgeId = null; if(selectedNodeIds.has(id)) selectedNodeIds.delete(id); else selectedNodeIds.add(id); closePicker(); render(); }
  function selectEdgeOnly(id){ selectedNodeIds.clear(); selectedEdgeId = id; closePicker(); render(); }
  function clearSelection(){ selectedNodeIds.clear(); selectedEdgeId = null; closePicker(); render(); }

  // ---------- helpers ----------
  function uid(prefix){ return prefix + (nextId++); }
  function getNode(id){ return nodes.find(n => n.id === id); }

  // A value rectangle's name, typed number and unit (parseRectText: src/shared/ir.js).
  function parseNode(n){ return parseRectText(n.text); }

  function formatNum(v){
    if(v === null || v === undefined || !isFinite(v)) return '?';
    const r = Math.round(v * 1e6) / 1e6;
    return r.toString();
  }

