// ============================================================
// File formats — the two kinds ExcelExporter reads from fmIDE (system, workspace; their
// versions and upgrades are shared with fmIDE in src/shared/file-formats.js) plus its own
// mapping file. Every loaded file goes through
// readKnownFile(): it identifies the kind (older files by shape), says plainly when a
// file is the wrong kind and where it belongs, upgrades older versions step by step,
// and flags a file from a NEWER app version so the user can choose to open it anyway.
// ============================================================
// build:include shared/file-formats.js
const FILE_FORMATS = {
  'system':              { current: SHARED_FILE_VERSIONS['system'], label: 'fmIDE system' },
  'fmIDE-workspace':     { current: SHARED_FILE_VERSIONS['fmIDE-workspace'], label: 'fmIDE workspace' },
  'fmIDE-excel-mapping': { current: 1, label: 'ExcelExporter mapping file' }
};
// Kinds that are fmIDE files but not something ExcelExporter reads — say where they belong.
const OTHER_FMIDE_KINDS = {
  'module': 'an fmIDE module (one canvas). ExcelExporter needs the whole model: in fmIDE use File → Save System or Export Workspace',
  'fmIDE-templates': 'an fmIDE templates file — import it in fmIDE',
  'fmIDE-format-presets': 'an fmIDE format presets file — import it in fmIDE (a workspace or system export already carries your formats)',
  'fmIDE-shortcuts': 'an fmIDE shortcuts file — import it in fmIDE',
  'fmIDE-macros': 'an fmIDE macros file — import it in fmIDE'
};
// The mapping file has had no upgrades yet.
const FILE_MIGRATIONS = Object.assign({}, SHARED_FILE_MIGRATIONS);
// Returns { error } or { kind, data (migrated copy), fromVersion, newer, newerParts }.
function readKnownFile(raw, accept){
  if(!raw || typeof raw !== 'object') return { error: "That file doesn't contain fmIDE data." };
  const kind = inferFileKind(raw, true); // true: also recognise mappings saved before versions were written
  if(!kind || !FILE_FORMATS[kind]){
    if(OTHER_FMIDE_KINDS[kind]) return { error: 'That is ' + OTHER_FMIDE_KINDS[kind] + '.' };
    return { error: "That file isn't an fmIDE file this version recognises" + (kind ? ' (kind "' + String(kind).slice(0, 40) + '")' : '') + '.' };
  }
  if(!accept.includes(kind)){
    return { error: 'That is an ' + FILE_FORMATS[kind].label + ', not ' + accept.map(k => 'an ' + FILE_FORMATS[k].label).join(' or ') + '.' +
      (kind === 'fmIDE-excel-mapping' ? ' Use "Import Mapping JSON" after loading the model.' : ' Load it with the file picker in section 1.') };
  }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion: version, newer } = upgradeFileData(data, kind, FILE_FORMATS, FILE_MIGRATIONS);
  const newerParts = [];
  if(kind === 'fmIDE-workspace' && data.system){
    const r = readKnownFile(data.system, ['system']);
    if(r.error) return { error: "The workspace's system is unreadable: " + r.error };
    data.system = r.data;
    if(r.newer) newerParts.push('its system (format version ' + r.fromVersion + ')');
  }
  return { kind, data, fromVersion: version, newer, newerParts };
}
// A newer-format file: ask before a best-effort open. Resolves true to go ahead.
function confirmNewerFile(r){
  if(!r.newer && !r.newerParts.length) return Promise.resolve(true);
  const fmt = FILE_FORMATS[r.kind];
  const what = r.newer ? 'This ' + fmt.label + ' (format version ' + r.fromVersion + '; this ExcelExporter reads up to version ' + fmt.current + ')'
                       : 'Part of this ' + fmt.label + ' — ' + r.newerParts.join(', ') + ' —';
  return showConfirm('Saved by a newer version',
    what + ' was saved by a newer version of fmIDE / ExcelExporter. Updating is the safe option. Open it anyway? Anything the newer version added may be ignored.',
    'Open Anyway');
}

function loadModel(m){
  let systemData = m, formatPresets = [];
  if(m && m.kind === 'fmIDE-workspace' && m.system){
    systemData = m.system;
    if(Array.isArray(m.formatPresets)) formatPresets = m.formatPresets;
  }
  // fmIDE's system export carries the format presets / roles too
  if(!formatPresets.length && systemData && Array.isArray(systemData.formatPresets)) formatPresets = systemData.formatPresets;
  if(!systemData || !Array.isArray(systemData.canvases) || systemData.canvases.length === 0){
    throw new Error('Expected a system export (or a workspace export containing one) with a non-empty "canvases" array.');
  }
  model = {
    periods: Array.isArray(systemData.periods) && systemData.periods.length ? systemData.periods : ['Period 1'],
    canvases: systemData.canvases,
    formatPresets
  };
  mappingKey = signatureOf(model);
  let restored = null;
  try{
    const raw = localStorage.getItem(mappingKey);
    if(raw) restored = JSON.parse(raw);
  }catch(err){ /* ignore */ }
  mapping = restored || buildDefaultMapping(model);
  // reconcile: drop rows/tabs referencing nodes/canvases no longer present, add rows for new nodes
  reconcileMapping();
  renderAll();
}

function reconcileMapping(){
  const canvasById = {}; model.canvases.forEach(c => canvasById[c.id] = c);
  const validRowIds = new Set();
  model.canvases.forEach(c => exportableNodesOf(c).forEach(n => validRowIds.add(pathKey([], c.id, n.id))));
  const allInstances = findAllBlockInstances(model);
  allInstances.forEach(({ hostCanvasId, hostNode }) => {
    if(!hostNode.blockDefCanvasId) return;
    collectInstanceRows(canvasById, [], hostCanvasId, hostNode, new Set(), model.periods.length)
      .forEach(u => validRowIds.add(pathKey(u.path, u.canvasId, u.nodeId)));
  });
  mapping.rows = mapping.rows.filter(r => validRowIds.has(r.id));
  mapping.rows.forEach(r => { if(!Array.isArray(r.path)) r.path = []; }); // back-compat: rows saved before block-unpacking existed are all top-level
  if(!Array.isArray(mapping.customRows)) mapping.customRows = []; // back-compat for mappings saved before custom rows existed
  if(!Array.isArray(mapping.inputRows)) mapping.inputRows = [];   // back-compat for mappings saved before the Inputs tab existed
  if(!mapping.cfg.inputsTab) mapping.cfg.inputsTab = { enabled: false, name: 'Inputs', groupBy: 'tab', orderWithin: 'sheet' };
  if(typeof mapping.cfg.sectionsEnabled !== 'boolean') mapping.cfg.sectionsEnabled = true; // back-compat for mappings saved before the section toggle existed
  const existingIds = new Set(mapping.rows.map(r => r.id));
  const defaultTabId = mapping.tabs[0] ? mapping.tabs[0].id : null;
  model.canvases.forEach(c => {
    let tabForCanvas = mapping.tabs.find(t => t.id === 'tab_' + c.id);
    exportableNodesOf(c).forEach((n, i) => {
      const id = pathKey([], c.id, n.id);
      if(!existingIds.has(id)){
        const section = classifyNode(c, n);
        mapping.rows.push({
          id, canvasId: c.id, nodeId: n.id, path: [],
          tabId: (tabForCanvas || mapping.tabs[0] || { id: defaultTabId }).id,
          section, order: 1000 + i, label: nodeDisplayName(canvasById, n), include: true, inlineConstant: false
        });
      }
    });
  });
  // Back-fill a default tab + rows for any block instance that doesn't have one yet
  // (a mapping saved before this feature existed, or a newly-added instance).
  const scratchTabs = mapping.tabs.slice();
  const scratchRows = [];
  buildBlockInstanceTabsAndRows(model, canvasById, scratchTabs, scratchRows);
  scratchTabs.forEach(t => { if(!mapping.tabs.some(mt => mt.id === t.id)) mapping.tabs.push(t); });
  scratchRows.forEach(r => { if(!existingIds.has(r.id)){ mapping.rows.push(r); existingIds.add(r.id); } });
  // drop custom rows pointing at a tab that no longer exists (reassign to first tab instead of losing them)
  const validTabIds = new Set(mapping.tabs.map(t => t.id));
  mapping.customRows.forEach(r => { if(!validTabIds.has(r.tabId) && mapping.tabs[0]) r.tabId = mapping.tabs[0].id; });
  // "Inline as constant" only ever makes sense for a true input (no incoming edge) — if
  // the underlying rectangle has since been wired to a formula (edited in fmIDE, then
  // reloaded here), clear the stale flag so the row goes back to being a normal,
  // edge-driven row instead of silently vanishing from the sheet (combinedRowsFor always
  // excludes an inlineConstant row, so a stale flag on a now-wired node would otherwise
  // leave it with neither a row nor a way for other formulas to reach it).
  mapping.rows.forEach(r => {
    if(!r.inlineConstant) return;
    const c = canvasById[r.canvasId];
    const node = c && c.nodes.find(n => n.id === r.nodeId);
    if(!node || !isInputRectangle(c, node)) r.inlineConstant = false;
  });
  syncInputMirrors(); // add/drop Inputs-tab rows for inputs that appeared/disappeared in fmIDE
  // Keep both order dimensions clean and fully populated regardless of which one is
  // currently "live" (sectioned `order` vs. flat `flatOrder`, see sectionsEnabled()) —
  // so flipping the toggle later never lands on a row with a stale/missing value in
  // whichever dimension it hasn't been using.
  mapping.tabs.forEach(t => { ensureSectionOrderAll(t.id); ensureFlatOrder(t.id); });
}

// The layout autosaves on every change. If the browser refuses (storage full or
// unavailable), say so once — the layout still works now, but would be gone after a
// reload unless exported. Clears itself when a save succeeds again.
let mappingSaveFailing = false;
function saveMapping(){
  if(!mappingKey) return;
  try{
    localStorage.setItem(mappingKey, JSON.stringify(mapping));
    if(mappingSaveFailing){ mappingSaveFailing = false; $('storageWarn').classList.add('hidden'); }
  }catch(err){
    if(!mappingSaveFailing){
      mappingSaveFailing = true;
      const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      $('storageWarn').textContent = (full ? "Autosave failed: the browser's storage is full." : 'Autosave failed: this browser is not letting ExcelExporter store data.') +
        ' Your layout works for now but will be lost on reload — use "Export Mapping JSON" to keep it.';
      $('storageWarn').classList.remove('hidden');
    }
  }
}


