// ============================================================
// Module layouts (step 11b, decision 9): the layout of a module's tab is remembered per
// module and used again wherever that module turns up. A module is a canvas added from a
// canvas template in fmIDE; its lasting id is the template family (`canvas.template.family`),
// the same for every version. What is remembered, for the canvas's own tab: the tab's name
// (when renamed), the order of its rows with sections on and off, each row's section, own
// label, Include / Constant, own format and indent, and its custom rows (blank rows, labels,
// headings) in their places. Rows are matched by the rectangle's name — capitals and outer
// spaces ignored, a name used twice on the canvas matches nothing — as fmIDE's "Update this
// canvas" does.
// - Remembered automatically: every save of the layout compares each module tab with how it
//   was when the model was loaded (`moduleBaselines`), and remembers the ones that changed.
// - Used only for a layout that is new (a model never seen here, or after Reset Mapping):
//   a layout saved for the whole model always wins. A rectangle the remembered layout
//   doesn't know goes where the automatic sort put it; a remembered one that is gone is
//   skipped. Rows moved to another tab are not followed (they stay in the module's tab).
// - Kept in this browser (MODULE_LAYOUTS_KEY, the fmIDE-excel-module-layouts file's JSON),
//   Export / Import in the Tabs panel. Everything read goes through cleanModuleLayout.
// ============================================================
const MODULE_LAYOUTS_KEY = 'fmide-excel-module-layouts';
const MODULE_LAYOUT_LIMITS = { modules: 500, rows: 2000, customs: 500, text: 500 };
let moduleLayouts = {};     // family → remembered layout
let canvasModules = {};     // canvas id → { family, name } for the loaded model's module canvases
let moduleBaselines = {};   // canvas id → the module tab's layout (JSON text) as last loaded or remembered
let moduleLayoutsApplied = []; // what the last new layout took from remembered modules, for the Tabs panel
// Step 11c-2: the layouts attached to the loaded document's canvas templates (fmIDE's
// "Attach Excel layout…"), by family: [{ versionId, version, layout }], each layout cleaned.
// Used for a module you have no remembered layout of your own for.
let templateLayouts = {};
let canvasLayoutFromTemplate = {}; // canvas id → true when its tab was laid out from its template's layout

function isModuleFamily(v){ return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v); }
function shortText(v, max){ return typeof v === 'string' ? v.slice(0, max || MODULE_LAYOUT_LIMITS.text) : ''; }
const MODULE_SECTIONS = ['input', 'calc', 'output'];

// One remembered layout from storage or a file (untrusted). null when it can't be used.
function cleanModuleLayout(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || !isModuleFamily(raw.family)) return null;
  const out = { family: raw.family, name: shortText(raw.name, 200) };
  if(typeof raw.tabName === 'string' && raw.tabName.trim()) out.tabName = sanitizeSheetName(raw.tabName.slice(0, 200));
  const section = (s) => MODULE_SECTIONS.includes(s) ? s : 'calc';
  const withFormat = (entry, src) => {
    if(src.style !== undefined && src.style !== null){ const st = cleanRowFormat(src.style); if(st) entry.style = st; }
    const n = rowIndent(src); if(n) entry.indent = n;
    return entry;
  };
  out.rows = [];
  const names = new Set();
  (Array.isArray(raw.rows) ? raw.rows : []).slice(0, MODULE_LAYOUT_LIMITS.rows).forEach(r => {
    if(!r || typeof r !== 'object') { out.rows.push(null); return; }
    const key = typeof r.name === 'string' ? r.name.trim().toLowerCase().slice(0, 200) : '';
    if(!key || names.has(key)){ out.rows.push(null); return; }
    names.add(key);
    const entry = { name: key, section: section(r.section), include: r.include !== false, constant: r.constant === true };
    if(typeof r.label === 'string') entry.label = shortText(r.label);
    out.rows.push(withFormat(entry, r));
  });
  out.customs = (Array.isArray(raw.customs) ? raw.customs : []).slice(0, MODULE_LAYOUT_LIMITS.customs).map(c => {
    if(!c || typeof c !== 'object') return null;
    return withFormat({ label: shortText(c.label), section: section(c.section), showPeriodLabels: c.showPeriodLabels === true }, c);
  });
  // An order: references "r<index>" / "c<index>" to entries that exist, each at most once.
  const order = (list) => {
    const seen = new Set(), res = [];
    (Array.isArray(list) ? list : []).slice(0, MODULE_LAYOUT_LIMITS.rows + MODULE_LAYOUT_LIMITS.customs).forEach(ref => {
      const m = typeof ref === 'string' ? /^([rc])(\d{1,5})$/.exec(ref) : null;
      if(!m || seen.has(ref)) return;
      const arr = m[1] === 'r' ? out.rows : out.customs;
      if(!arr[Number(m[2])]) return;
      seen.add(ref); res.push(ref);
    });
    return res;
  };
  out.sectioned = order(raw.sectioned);
  out.flat = order(raw.flat);
  return out;
}
function cleanModuleLayouts(list){
  const out = {};
  (Array.isArray(list) ? list : []).slice(0, MODULE_LAYOUT_LIMITS.modules).forEach(raw => {
    const m = cleanModuleLayout(raw);
    if(m) out[m.family] = m;
  });
  return out;
}
function moduleLayoutsPayload(list){
  return { kind: 'fmIDE-excel-module-layouts', version: FILE_FORMATS['fmIDE-excel-module-layouts'].current,
    modules: (list || Object.values(moduleLayouts)).map(m => JSON.parse(JSON.stringify(m))) };
}
const moduleLayoutsLoaded = layoutsMigrated.then(() => layoutStore.get(MODULE_LAYOUTS_KEY)).then(raw => {
  if(typeof raw !== 'string' || !raw) return;
  try{
    const r = readKnownFile(JSON.parse(raw), ['fmIDE-excel-module-layouts']);
    if(!r.error) moduleLayouts = cleanModuleLayouts(r.data.modules);
  }catch(err){ /* unreadable: nothing remembered */ }
}, () => {});
function saveModuleLayouts(){
  return layoutStore.put(MODULE_LAYOUTS_KEY, JSON.stringify(moduleLayoutsPayload())).then(() => {}, onMappingSaveFailed);
}

// The loaded file's module canvases (the IR's canvases don't carry `template`).
function readCanvasModules(systemData){
  const out = {};
  (systemData.canvases || []).forEach(c => {
    const t = c && c.template;
    if(c && typeof c.id === 'string' && t && typeof t === 'object' && isModuleFamily(t.family)){
      out[c.id] = { family: t.family, name: shortText(t.name, 200) || shortText(c.name, 200),
        versionId: isModuleFamily(t.versionId) ? t.versionId : null };
    }
  });
  return out;
}

// The Excel layouts attached to the loaded file's canvas templates (a workspace or .fmide
// document carries its templates; a system file doesn't). Everything is someone else's data:
// each goes through cleanModuleLayout, and must be made for its template's own family.
const TEMPLATE_LAYOUT_LIMIT = 2000;
function readTemplateLayouts(file){
  const out = {};
  const list = file && Array.isArray(file.templates) ? file.templates.slice(0, TEMPLATE_LAYOUT_LIMIT) : [];
  list.forEach(t => {
    if(!t || typeof t !== 'object' || t.kind !== 'module' || !isModuleFamily(t.family)) return;
    const a = t.attachments && typeof t.attachments === 'object' ? t.attachments.excel : null;
    if(!a || typeof a !== 'object' || a.family !== t.family) return;
    const layout = cleanModuleLayout(a);
    if(!layout) return;
    const version = Math.round(Number(t.version));
    (out[t.family] = out[t.family] || []).push({ versionId: isModuleFamily(t.versionId) ? t.versionId : null,
      version: Number.isFinite(version) ? version : 0, layout });
  });
  return out;
}
// The attached layout for a module canvas: the one on the version the canvas was made from,
// else the newest version of its template that has one.
function templateLayoutFor(mod){
  const list = templateLayouts[mod.family];
  if(!list || !list.length) return null;
  const same = mod.versionId && list.find(x => x.versionId === mod.versionId);
  return (same || list.slice().sort((a, b) => b.version - a.version)[0]).layout;
}

// A canvas's rectangle rows by name key; names used more than once are left out.
function moduleRowsByName(canvas){
  const canvasById = {}; model.canvases.forEach(c => { canvasById[c.id] = c; });
  const byName = new Map(), dup = new Set();
  mapping.rows.forEach(r => {
    if(r.canvasId !== canvas.id || (r.path && r.path.length)) return;
    const node = canvas.nodes.find(n => n.id === r.nodeId);
    const key = node ? nodeDisplayName(canvasById, node).trim().toLowerCase() : '';
    if(!key) return;
    if(byName.has(key)) dup.add(key); else byName.set(key, { row: r, node, name: nodeDisplayName(canvasById, node) });
  });
  dup.forEach(k => byName.delete(k));
  return byName;
}
const moduleTabId = (canvasId) => 'tab_' + canvasId;

// The module tab's layout now, in the remembered shape (not yet cleaned or stored).
function captureModuleLayout(canvas){
  const mod = canvasModules[canvas.id];
  const tab = mapping.tabs.find(t => t.id === moduleTabId(canvas.id));
  if(!mod || !tab) return null;
  const byName = moduleRowsByName(canvas);
  const refOf = new Map(), rows = [], customs = [];
  byName.forEach(({ row, name }, key) => {
    if(row.tabId !== tab.id) return; // moved to another tab: not followed
    const entry = { name: key, section: row.section, include: row.include !== false, constant: !!row.inlineConstant };
    if(row.label !== name) entry.label = row.label;
    if(row.style) entry.style = row.style;
    if(rowIndent(row)) entry.indent = rowIndent(row);
    refOf.set(row, 'r' + rows.length); rows.push(entry);
  });
  mapping.customRows.filter(r => r.tabId === tab.id).forEach(r => {
    const entry = { label: r.label || '', section: r.section, showPeriodLabels: !!r.showPeriodLabels };
    if(r.style) entry.style = r.style;
    if(rowIndent(r)) entry.indent = rowIndent(r);
    refOf.set(r, 'c' + customs.length); customs.push(entry);
  });
  const byOrder = (key) => (a, b) => (typeof a[key] === 'number' ? a[key] : 0) - (typeof b[key] === 'number' ? b[key] : 0);
  const inTab = [...refOf.keys()];
  const sectioned = [].concat(...MODULE_SECTIONS.map(sec => inTab.filter(r => r.section === sec).sort(byOrder('order')))).map(r => refOf.get(r));
  const flat = inTab.slice().sort(byOrder('flatOrder')).map(r => refOf.get(r));
  const out = { family: mod.family, name: mod.name, rows, customs, sectioned, flat };
  if(tab.name !== sanitizeSheetName(canvas.name || '')) out.tabName = tab.name;
  return out;
}
function moduleBaselineOf(canvas){
  const m = captureModuleLayout(canvas);
  return m ? JSON.stringify(m) : null;
}
function resetModuleBaselines(){
  moduleBaselines = {};
  model.canvases.forEach(c => { if(canvasModules[c.id]) moduleBaselines[c.id] = moduleBaselineOf(c); });
}

// Called on every save of the layout: remembers each module tab that changed since it was
// loaded (or last remembered).
function rememberModuleLayouts(){
  if(!model || !mapping) return;
  let changed = false, newlyRemembered = false;
  model.canvases.forEach(c => {
    if(!canvasModules[c.id]) return;
    const now = moduleBaselineOf(c);
    if(!now || now === moduleBaselines[c.id]) return;
    moduleBaselines[c.id] = now;
    const m = cleanModuleLayout(JSON.parse(now));
    if(!m) return;
    if(!moduleLayouts[m.family]) newlyRemembered = true;
    moduleLayouts[m.family] = m;
    changed = true;
  });
  if(!changed) return;
  saveModuleLayouts();
  if(newlyRemembered) renderTabs(); // the tab's tag now says its layout is remembered
}

// `stored`: the remembered order (row objects); `auto`: the rows as the automatic sort placed
// them. Rows the remembered order doesn't hold go in after the row they followed in `auto`.
function mergeRememberedOrder(stored, auto){
  const result = stored.slice();
  const placed = new Set(result);
  auto.forEach((r, i) => {
    if(placed.has(r)) return;
    let at = 0;
    for(let j = i - 1; j >= 0; j--){ const k = result.indexOf(auto[j]); if(k >= 0){ at = k + 1; break; } }
    result.splice(at, 0, r);
    placed.add(r);
  });
  return result;
}

// Lays the module canvas's tab out as remembered. Returns { matched, added } or null.
function applyModuleLayout(canvas, m){
  const tab = mapping.tabs.find(t => t.id === moduleTabId(canvas.id));
  if(!tab) return null;
  if(m.tabName && !mapping.tabs.some(t => t !== tab && t.name.toLowerCase() === m.tabName.toLowerCase())) tab.name = m.tabName;
  const byName = moduleRowsByName(canvas);
  const refRow = new Map();
  m.rows.forEach((entry, i) => {
    if(!entry) return;
    const hit = byName.get(entry.name);
    if(!hit || hit.row.tabId !== tab.id) return;
    const row = hit.row;
    row.section = entry.section;
    if(entry.label !== undefined) row.label = entry.label;
    row.include = entry.include;
    row.inlineConstant = entry.constant && isInputRectangle(canvas, hit.node);
    if(entry.style) row.style = JSON.parse(JSON.stringify(entry.style)); else delete row.style; // a copy: editing the row never edits what is remembered
    if(entry.indent) row.indent = entry.indent; else delete row.indent;
    refRow.set('r' + i, row);
  });
  // The tab's own custom rows are replaced by the remembered ones (a new layout has none).
  mapping.customRows = mapping.customRows.filter(r => r.tabId !== tab.id);
  m.customs.forEach((c, i) => {
    if(!c) return;
    const row = { id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '_' + i, isCustom: true, tabId: tab.id,
      section: c.section, label: c.label, style: c.style ? JSON.parse(JSON.stringify(c.style)) : null, showPeriodLabels: c.showPeriodLabels };
    if(c.indent) row.indent = c.indent;
    mapping.customRows.push(row);
    refRow.set('c' + i, row);
  });
  const ownRow = (r) => !r.isCustom && r.canvasId === canvas.id && !(r.path && r.path.length);
  const resolve = (refs) => refs.map(ref => refRow.get(ref)).filter(Boolean);
  // With sections: each band in its remembered order.
  const sectionedAll = resolve(m.sectioned);
  MODULE_SECTIONS.forEach(sec => {
    const auto = allRowsForSection(tab.id, sec).filter(ownRow);
    const stored = sectionedAll.filter(r => r.section === sec);
    const others = allRowsForSection(tab.id, sec).filter(r => !ownRow(r) && !stored.includes(r));
    mergeRememberedOrder(stored, auto).concat(others).forEach((r, i) => { r.order = i; });
  });
  // Without sections: the tab in its remembered order.
  const autoFlat = [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tab.id && ownRow(r))
    .sort((a, b) => (typeof a.flatOrder === 'number' ? a.flatOrder : 0) - (typeof b.flatOrder === 'number' ? b.flatOrder : 0));
  const storedFlat = resolve(m.flat);
  const customsLeft = mapping.customRows.filter(r => r.tabId === tab.id && !storedFlat.includes(r));
  mergeRememberedOrder(storedFlat, autoFlat).concat(customsLeft).forEach((r, i) => { r.flatOrder = i; });
  ensureSectionOrderAll(tab.id);
  ensureFlatOrder(tab.id);
  const matched = m.rows.filter((e, i) => e && refRow.has('r' + i)).length;
  return { matched, added: autoFlat.length - matched };
}

// A new layout: every module canvas with a remembered layout gets it; one without, the
// layout attached to its template, if the loaded document carries one (step 11c-2).
function applyModuleLayouts(){
  moduleLayoutsApplied = [];
  canvasLayoutFromTemplate = {};
  model.canvases.forEach(c => {
    const mod = canvasModules[c.id];
    if(!mod) return;
    const own = moduleLayouts[mod.family];
    const m = own || templateLayoutFor(mod);
    if(!m) return;
    const r = applyModuleLayout(c, m);
    if(!r) return;
    if(!own) canvasLayoutFromTemplate[c.id] = true;
    moduleLayoutsApplied.push(Object.assign({ canvas: c.name, module: mod.name, fromTemplate: !own }, r));
  });
}

// The Tabs panel's line about module layouts.
function renderModuleLayoutsInfo(){
  const el = $('moduleLayoutsStatus');
  if(!el) return;
  if(!moduleLayoutsApplied.length){ setStatus(el, '', null); return; }
  const rows = moduleLayoutsApplied.reduce((n, a) => n + a.matched, 0);
  const added = moduleLayoutsApplied.reduce((n, a) => n + a.added, 0);
  const tabs = moduleLayoutsApplied.length;
  const fromTemplate = moduleLayoutsApplied.filter(a => a.fromTemplate).length;
  const where = fromTemplate === 0 ? `${tabs === 1 ? 'its module' : 'their modules'}' remembered layout`
    : fromTemplate === tabs ? `${tabs === 1 ? 'its template\'s' : 'their templates\''} layout`
    : `remembered layouts (${tabs - fromTemplate}) and templates' layouts (${fromTemplate})`;
  setStatus(el, `${tabs} tab${tabs === 1 ? '' : 's'} laid out from ${where}: ` +
    `${rows} row${rows === 1 ? '' : 's'} matched, ${added} new.`, 'info');
}

// The tag on a module's tab in the Tabs panel: which module, whether its layout is
// remembered, and Forget.
function moduleTabTag(tab){
  const canvasId = tab.id.startsWith('tab_') ? tab.id.slice(4) : null;
  const mod = canvasId && canvasModules[canvasId];
  if(!mod) return null;
  const wrap = document.createElement('span');
  wrap.className = 'module-tag';
  wrap.dataset.family = mod.family;
  const label = document.createElement('span');
  const remembered = !!moduleLayouts[mod.family];
  const fromTemplate = !remembered && !!canvasLayoutFromTemplate[canvasId];
  label.textContent = '🧩 ' + (mod.name || 'module') + (remembered ? ' · layout remembered' : fromTemplate ? ' · layout from the template' : '');
  label.title = remembered
    ? 'This tab comes from the module "' + mod.name + '". Its layout is remembered, and used wherever the module turns up in a model laid out here for the first time.'
    : fromTemplate
    ? 'This tab comes from the module "' + mod.name + '", laid out with the Excel layout attached to its template. Change it and your own layout is remembered instead.'
    : 'This tab comes from the module "' + mod.name + '". Change its layout and it is remembered for the next model with this module.';
  wrap.appendChild(label);
  if(remembered){
    const forget = document.createElement('button');
    forget.className = 'icon module-forget';
    forget.textContent = 'Forget';
    forget.title = 'Forget the layout remembered for this module (this model\'s own layout is kept)';
    forget.addEventListener('click', () => {
      delete moduleLayouts[mod.family];
      const c = model.canvases.find(x => x.id === canvasId);
      if(c) moduleBaselines[canvasId] = moduleBaselineOf(c); // not remembered again until it changes
      saveModuleLayouts();
      renderTabs();
      setStatus($('moduleLayoutsStatus'), 'Forgot the layout remembered for "' + mod.name + '".', 'ok');
    });
    wrap.appendChild(forget);
  }
  return wrap;
}

$('btnExportModuleLayouts').addEventListener('click', () => {
  const list = Object.values(moduleLayouts);
  if(!list.length){ setStatus($('moduleLayoutsStatus'), 'No module layouts are remembered yet.', 'info'); return; }
  const blob = new Blob([JSON.stringify(moduleLayoutsPayload(list), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'excelexporter-module-layouts.json'; a.click();
  URL.revokeObjectURL(url);
});
$('btnImportModuleLayouts').addEventListener('click', () => $('moduleLayoutsFileInput').click());
$('moduleLayoutsFileInput').addEventListener('change', () => {
  const file = $('moduleLayoutsFileInput').files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { parsed, error } = parseFileText(reader.result);
    if(error){ setStatus($('moduleLayoutsStatus'), error, 'err'); return; }
    const r = readKnownFile(parsed, ['fmIDE-excel-module-layouts']);
    if(r.error){ setStatus($('moduleLayoutsStatus'), r.error, 'err'); return; }
    if(!(await confirmNewerFile(r))){ setStatus($('moduleLayoutsStatus'), 'Module layouts not imported.', 'info'); return; }
    const incoming = cleanModuleLayouts(r.data.modules);
    const n = Object.keys(incoming).length;
    Object.assign(moduleLayouts, incoming);
    saveModuleLayouts();
    if(model && mapping) renderTabs();
    setStatus($('moduleLayoutsStatus'), n
      ? `Imported ${n} module layout${n === 1 ? '' : 's'}. ${n === 1 ? 'It is' : 'They are'} used for models laid out here from now on.`
      : 'That file holds no module layouts ExcelExporter could use.', n ? 'ok' : 'info');
  };
  reader.readAsText(file);
  $('moduleLayoutsFileInput').value = '';
});
