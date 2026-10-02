// ============================================================
// Wiring
// ============================================================
// A file that is too large or nested too deep is refused first (FILE_LIMITS, shared).
function parseFileText(text){
  const tooBig = fileTextProblem(text);
  if(tooBig) return { error: tooBig };
  let parsed;
  try{ parsed = JSON.parse(text); }
  catch(err){ return { error: 'That is not valid JSON.' }; }
  const shape = fileDataProblem(parsed);
  return shape ? { error: shape } : { parsed };
}
// `label` names it in messages; `name`, shown in the top bar, defaults to it.
async function tryLoad(jsonText, label, name){
  const { parsed, error } = parseFileText(jsonText);
  if(error){ setStatus($('loadStatus'), error, 'err'); return; }
  const r = readKnownFile(parsed, ['system', 'fmIDE-workspace']);
  if(r.error){ setStatus($('loadStatus'), r.error, 'err'); return; }
  if(!(await confirmNewerFile(r))){ setStatus($('loadStatus'), 'Not loaded.', 'info'); return; }
  try{
    await loadModel(r.data);
    currentModelLabel = name || label; // only once it has loaded: a file that fails leaves the name as it was
    syncPageState();
    setStatus($('genStatus'), '', null); // a message about the last model's workbook
    setStatus($('loadStatus'), `Loaded ${label} — ${model.canvases.length} canvas${model.canvases.length === 1 ? '' : 'es'}, ${model.periods.length} periods.`, 'ok');
  }catch(err){
    setStatus($('loadStatus'), 'Could not read that as an fmIDE system export: ' + err.message, 'err');
  }
}

$('dropZone').addEventListener('click', () => $('fileInput').click());
$('dropZone').addEventListener('dragover', (ev) => { ev.preventDefault(); $('dropZone').classList.add('drag'); });
$('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('drag'));
$('dropZone').addEventListener('drop', (ev) => {
  ev.preventDefault(); $('dropZone').classList.remove('drag');
  const file = ev.dataTransfer.files[0];
  if(file) readFile(file);
});
$('fileInput').addEventListener('change', () => {
  const file = $('fileInput').files[0];
  if(file) readFile(file);
  $('fileInput').value = ''; // lets the same file be picked again (browsers skip 'change' for an unchanged value)
});
function readFile(file){
  const reader = new FileReader();
  reader.onload = () => tryLoad(reader.result, file.name);
  reader.onerror = () => setStatus($('loadStatus'), 'Could not read that file.', 'err');
  reader.readAsText(file);
}

$('btnLoadSample').addEventListener('click', () => tryLoad(JSON.stringify(sampleModel()), 'the sample model', 'Sample model'));
$('btnTogglePaste').addEventListener('click', () => openPasteDialog());
$('btnLoadPasted').addEventListener('click', () => { const text = $('pasteArea').value; closePasteDialog(); tryLoad(text, 'pasted JSON', 'Pasted model'); });
$('dropZone').addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); $('fileInput').click(); } });

$('cfgStartLabel').addEventListener('change', () => { mapping.cfg.startLabel = $('cfgStartLabel').value; saveMapping(); });
$('cfgFrequency').addEventListener('change', () => { mapping.cfg.frequency = $('cfgFrequency').value; saveMapping(); });
$('cfgFallbackFormat').addEventListener('change', () => { mapping.cfg.fallbackFormat = $('cfgFallbackFormat').value; saveMapping(); });
$('cfgFileName').addEventListener('change', () => { mapping.cfg.fileName = $('cfgFileName').value; saveMapping(); });

$('btnAddTab').addEventListener('click', () => {
  const n = mapping.tabs.length + 1;
  mapping.tabs.push({ id: 'tab_custom_' + Date.now(), name: 'Sheet' + n, order: mapping.tabs.length });
  saveMapping(); renderTabs(); renderRows(); renderCustomRows(); renderBulkBar();
});

$('btnAddCustomRow').addEventListener('click', addCustomRow);
$('viewByCanvas').addEventListener('click', () => setRowView('canvas'));
$('viewByTab').addEventListener('click', () => setRowView('tab'));
$('viewByTree').addEventListener('click', () => setRowView('tree'));
setRowView('tree'); // the Tree is the main row editor

$('cfgInputsEnabled').addEventListener('change', () => setInputsEnabled($('cfgInputsEnabled').checked));
$('cfgInputsName').addEventListener('change', () => setInputsTabName($('cfgInputsName').value));
$('cfgInputsGroup').addEventListener('change', applyInputsLayoutSetting);
$('cfgInputsOrder').addEventListener('change', applyInputsLayoutSetting);
$('btnInputsRelayout').addEventListener('click', applyInputsLayoutSetting);
$('cfgInputsCases').addEventListener('change', () => {
  inputsCfg().globalCases = Math.max(0, Math.min(MAX_CASES, Math.round(Number($('cfgInputsCases').value)) || 0));
  $('cfgInputsCases').value = inputsCfg().globalCases;
  saveMapping();
});
$('cfgInputsScenarios').addEventListener('change', () => {
  inputsCfg().defaultScenarios = Math.max(2, Math.min(MAX_SCENARIOS, Math.round(Number($('cfgInputsScenarios').value)) || 3));
  $('cfgInputsScenarios').value = inputsCfg().defaultScenarios;
  saveMapping();
});

$('sortMethod').addEventListener('change', () => { mapping.cfg.sortMethod = $('sortMethod').value; saveMapping(); refreshSortControls(); });
$('sortWithin').addEventListener('change', () => { mapping.cfg.sortWithin = $('sortWithin').value; saveMapping(); });
$('btnApplySort').addEventListener('click', () => applyRowSort($('sortMethod').value, $('sortWithin').value, $('sortScope').value));

$('cfgSectionsEnabled').addEventListener('change', () => setSectionsEnabled($('cfgSectionsEnabled').checked));

$('btnGenerate').addEventListener('click', () => {
  try{
    generateWorkbook();
    setStatus($('genStatus'), 'Workbook generated — check your downloads.', 'ok');
  }catch(err){
    setStatus($('genStatus'), 'Could not generate the workbook: ' + err.message, 'err');
  }
});

$('btnExportMapping').addEventListener('click', () => {
  const out = Object.assign({ kind: 'fmIDE-excel-mapping', version: FILE_FORMATS['fmIDE-excel-mapping'].current }, JSON.parse(JSON.stringify(mapping)));
  out.kind = 'fmIDE-excel-mapping'; out.version = FILE_FORMATS['fmIDE-excel-mapping'].current;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'excelexporter-mapping.json'; a.click();
  URL.revokeObjectURL(url);
});
$('btnImportMapping').addEventListener('click', () => $('mappingFileInput').click());
$('mappingFileInput').addEventListener('change', () => {
  const file = $('mappingFileInput').files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { parsed, error } = parseFileText(reader.result);
    if(error){ setStatus($('genStatus'), error, 'err'); return; }
    const r = readKnownFile(parsed, ['fmIDE-excel-mapping']);
    if(r.error){ setStatus($('genStatus'), r.error, 'err'); return; }
    if(!(await confirmNewerFile(r))){ setStatus($('genStatus'), 'Mapping not imported.', 'info'); return; }
    try{
      const imported = r.data;
      if(!Array.isArray(imported.tabs) || !Array.isArray(imported.rows)) throw new Error('missing tabs/rows');
      delete imported.kind; delete imported.version; // file envelope, not part of the mapping itself
      mapping = imported;
      reconcileMapping();
      saveMapping();
      renderAll();
      setStatus($('genStatus'), 'Mapping imported.', 'ok');
    }catch(err){ setStatus($('genStatus'), 'That does not look like a mapping JSON file.', 'err'); }
  };
  reader.readAsText(file);
  $('mappingFileInput').value = '';
});

// In-page confirm dialog (native confirm() is silently blocked in sandboxed frames).
// Resolves true on OK, false on Cancel / Escape / backdrop click.
function showConfirm(title, message, okLabel){
  return new Promise(resolve => {
    const modal = $('confirmModal');
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmOk').textContent = okLabel || 'OK';
    const close = (result) => {
      modal.classList.add('hidden');
      $('confirmOk').removeEventListener('click', onOk);
      $('confirmCancel').removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (ev) => { if(ev.target === modal) close(false); };
    const onKey = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); close(false); } };
    $('confirmOk').addEventListener('click', onOk);
    $('confirmCancel').addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey, true);
    modal.classList.remove('hidden');
    $('confirmCancel').focus();
  });
}

// Discard the saved mapping for the currently loaded model and rebuild the default —
// exactly what loadModel() produces for a model that has never been seen before.
// Deliberately does NOT save afterwards (same as a first load): the next real edit saves.
async function resetMappingToDefaults(){
  if(!model) return;
  try{ await layoutStore.remove(mappingKey); }catch(err){ /* ignore */ }
  mapping = buildDefaultMapping(model);
  reconcileMapping();
  sortNewLayout();
  applyModuleLayouts(); // a new layout starts from the modules' remembered layouts
  resetModuleBaselines();
  renderAll();
}

$('btnResetMapping').addEventListener('click', async () => {
  if(!model) return;
  const ok = await showConfirm(
    'Reset mapping to defaults?',
    'This discards every tab, row order, label, custom row, Include/Constant choice and export setting you have made for this model, and rebuilds the default layout (a module\'s tab starts from the layout remembered for that module). This cannot be undone — use "Export Mapping JSON" first if you might want it back.',
    'Reset Mapping'
  );
  if(!ok) return;
  await resetMappingToDefaults();
  setStatus($('genStatus'), 'Mapping reset to defaults.', 'ok');
});

// A write started only while the page unloads may not finish, so save when it is hidden.
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') writeMapping(); });

// On the published site (the service worker already runs this page; fmIDE registers it):
// say when a new version is ready. The layout is saved first; the model file is not kept.
// build:include shared/update-notice.js
watchForUpdates({
  appName: 'ExcelExporter',
  note: 'Your layout is kept; load your file again after reloading.',
  beforeReload: () => writeMapping(),
});

$('btnClearAll').addEventListener('click', () => {
  model = null; modelIR = null; mapping = null; mappingKey = null;
  canvasModules = {}; moduleBaselines = {}; moduleLayoutsApplied = []; templateLayouts = {}; tabLayoutFromTemplate = {};
  $('fileInput').value = '';
  $('afterLoad').classList.add('hidden');
  $('pasteArea').value = '';
  ['loadStatus', 'genStatus', 'moduleLayoutsStatus'].forEach(id => setStatus($(id), '', null));
  $('differencesPanel').classList.add('hidden');
  syncPageState();
});

syncPageState();

})();
