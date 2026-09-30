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
// Step 11d: a module used as a block also remembers the layout of its instances' tabs
// (`instance`, the same things but the tab's name), rows matched by name and, in a vertical
// instance, by which copy they are (a vintage, the Total, the shared row). A block inside
// the block is not matched: its rows go where the automatic sort puts them. "Lay out the
// other instances like this" copies an instance tab's layout to the block's other instances
// in the model (any block, from a template or not).
// - Remembered automatically: every save of the layout compares each module tab and instance
//   tab with how it was when the model was loaded (`moduleBaselines`), and remembers the ones
//   that changed.
// - Used only for a layout that is new (a model never seen here, or after Reset Mapping):
//   a layout saved for the whole model always wins. A rectangle the remembered layout
//   doesn't know goes where the automatic sort put it; a remembered one that is gone is
//   skipped. Rows moved to another tab are not followed (they stay in the module's tab).
// - Kept in this browser (MODULE_LAYOUTS_KEY, the fmIDE-excel-module-layouts file's JSON),
//   Export / Import in the Tabs panel. Everything read goes through cleanModuleLayout.
// ============================================================
const MODULE_LAYOUTS_KEY = 'fmide-excel-module-layouts';
const MODULE_LAYOUT_LIMITS = { modules: 500, rows: 2000, customs: 500, text: 500, vintages: 10000 };
let moduleLayouts = {};     // family → remembered layout
let canvasModules = {};     // canvas id → { family, name } for the loaded model's module canvases
let moduleBaselines = {};   // tab id → the module or instance tab's layout (JSON text) as last loaded or remembered
let moduleLayoutsApplied = []; // what the last new layout took from remembered modules, for the Tabs panel
// Step 11c-2: the layouts attached to the loaded document's canvas templates (fmIDE's
// "Attach Excel layout…"), by family: [{ versionId, version, layout }], each layout cleaned.
// Used for a module you have no remembered layout of your own for.
let templateLayouts = {};
let tabLayoutFromTemplate = {}; // tab id → true when the tab was laid out from its template's layout

function isModuleFamily(v){ return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v); }
function shortText(v, max){ return typeof v === 'string' ? v.slice(0, max || MODULE_LAYOUT_LIMITS.text) : ''; }
const MODULE_SECTIONS = ['input', 'calc', 'output'];
// Which copy of a rectangle an instance row is: a vintage (1, 2, …), 'total', 'shared', or
// null for the only copy. undefined when `v` is none of these.
function cleanRowCopy(v){
  if(v === undefined || v === null) return null;
  if(v === 'total' || v === 'shared') return v;
  return Number.isInteger(v) && v >= 1 && v <= MODULE_LAYOUT_LIMITS.vintages ? v : undefined;
}
const layoutRowKey = (name, copy) => copy === null || copy === undefined ? name : name + '\u0000' + copy;

// The rows, custom rows and orders of one remembered tab (untrusted). `withCopy`: an
// instance tab's rows, which say which copy they are.
function cleanLayoutPart(raw, withCopy){
  const out = { rows: [], customs: [] };
  const section = (s) => MODULE_SECTIONS.includes(s) ? s : 'calc';
  const withFormat = (entry, src) => {
    if(src.style !== undefined && src.style !== null){ const st = cleanRowFormat(src.style); if(st) entry.style = st; }
    const n = rowIndent(src); if(n) entry.indent = n;
    return entry;
  };
  const keys = new Set();
  (Array.isArray(raw.rows) ? raw.rows : []).slice(0, MODULE_LAYOUT_LIMITS.rows).forEach(r => {
    if(!r || typeof r !== 'object') { out.rows.push(null); return; }
    const name = typeof r.name === 'string' ? r.name.trim().toLowerCase().slice(0, 200) : '';
    const copy = withCopy ? cleanRowCopy(r.copy) : null;
    const key = layoutRowKey(name, copy);
    if(!name || copy === undefined || keys.has(key)){ out.rows.push(null); return; }
    keys.add(key);
    const entry = { name };
    if(copy !== null) entry.copy = copy;
    Object.assign(entry, { section: section(r.section), include: r.include !== false, constant: r.constant === true });
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
// One remembered layout from storage or a file (untrusted). null when it can't be used.
function cleanModuleLayout(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || !isModuleFamily(raw.family)) return null;
  const out = { family: raw.family, name: shortText(raw.name, 200) };
  if(typeof raw.tabName === 'string' && raw.tabName.trim()) out.tabName = sanitizeSheetName(raw.tabName.slice(0, 200));
  Object.assign(out, cleanLayoutPart(raw, false));
  const inst = raw.instance;
  if(inst && typeof inst === 'object' && !Array.isArray(inst)) out.instance = cleanLayoutPart(inst, true);
  return out;
}
// Whether a remembered layout holds one for the module's own tab (an entry made by an
// instance tab alone holds only `instance`).
function hasTabLayout(m){ return !!(m && (m.tabName || m.rows.length || m.customs.length)); }
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
// else the newest version of its template that has one. `has` picks the part wanted.
function templateLayoutFor(mod, has){
  const list = (templateLayouts[mod.family] || []).filter(x => has(x.layout));
  if(!list.length) return null;
  const same = mod.versionId && list.find(x => x.versionId === mod.versionId);
  return (same || list.slice().sort((a, b) => b.version - a.version)[0]).layout;
}

// ---- the tabs a layout is remembered for ----
// A spec says which tab, which rows it can match (by key: name, and for an instance which
// copy — names used more than once match nothing), and which rows are its own (the rest of
// the tab — rows moved in from elsewhere — keeps its place after them).
const moduleTabId = (canvasId) => 'tab_' + canvasId;
const instanceTabId = (hostCanvasId, nodeId) => 'tab_blk_' + hostCanvasId + '_' + nodeId;
function rowsByKey(rows, canvasById, keyOf){
  const byKey = new Map(), dup = new Set();
  rows.forEach(r => {
    const canvas = canvasById[r.canvasId];
    const node = canvas && canvas.nodes.find(n => n.id === r.nodeId);
    if(!node) return;
    const name = nodeDisplayName(canvasById, node).trim().toLowerCase();
    if(!name) return;
    const copy = keyOf(r);
    const key = layoutRowKey(name, copy);
    if(byKey.has(key)) dup.add(key);
    else byKey.set(key, { row: r, node, canvas, name, copy, label: keyOf === noCopy ? nodeDisplayName(canvasById, node) : unpackedRowLabel(canvasById, node, r) });
  });
  dup.forEach(k => byKey.delete(k));
  return byKey;
}
const noCopy = () => null;
const rowCopyOf = (r) => r.verticalCombined ? 'total' : r.verticalShared ? 'shared' : typeof r.verticalVintage === 'number' ? r.verticalVintage : null;
function canvasesById(){ const o = {}; model.canvases.forEach(c => { o[c.id] = c; }); return o; }
function moduleTabSpec(canvas){
  const tab = mapping.tabs.find(t => t.id === moduleTabId(canvas.id));
  if(!tab) return null;
  const own = (r) => !r.isCustom && r.canvasId === canvas.id && !(r.path && r.path.length);
  return { tab, own, byKey: rowsByKey(mapping.rows.filter(own), canvasesById(), noCopy) };
}
// Every block instance whose tab is in the layout: { hostCanvasId, hostNode, defCanvas, tab }.
function blockInstanceTabs(){
  const canvasById = canvasesById();
  return findAllBlockInstances(model).map(({ hostCanvasId, hostNode }) => {
    const defCanvas = hostNode.blockDefCanvasId && canvasById[hostNode.blockDefCanvasId];
    const tab = defCanvas && mapping.tabs.find(t => t.id === instanceTabId(hostCanvasId, hostNode.id));
    return tab ? { hostCanvasId, hostNode, defCanvas, tab } : null;
  }).filter(Boolean);
}
function instanceTabSpec(inst){
  const here = (r) => Array.isArray(r.path) && r.path.length > 0 && r.path[0].canvasId === inst.hostCanvasId && r.path[0].nodeId === inst.hostNode.id;
  const own = (r) => !r.isCustom && here(r);
  const direct = mapping.rows.filter(r => own(r) && r.path.length === 1 && r.canvasId === inst.defCanvas.id);
  return { tab: inst.tab, own, byKey: rowsByKey(direct, canvasesById(), rowCopyOf) };
}

// The tab's layout now, in the remembered shape (not yet cleaned or stored).
function captureTabLayout(spec){
  const tab = spec.tab;
  const refOf = new Map(), rows = [], customs = [];
  spec.byKey.forEach(({ row, name, copy, label }) => {
    if(row.tabId !== tab.id) return; // moved to another tab: not followed
    const entry = { name };
    if(copy !== null) entry.copy = copy;
    Object.assign(entry, { section: row.section, include: row.include !== false, constant: !!row.inlineConstant });
    if(row.label !== label) entry.label = row.label;
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
  return { rows, customs, sectioned, flat };
}
function captureModuleLayout(canvas){
  const mod = canvasModules[canvas.id];
  const spec = mod && moduleTabSpec(canvas);
  if(!spec) return null;
  const out = Object.assign({ family: mod.family, name: mod.name }, captureTabLayout(spec));
  if(spec.tab.name !== sanitizeSheetName(canvas.name || '')) out.tabName = spec.tab.name;
  return out;
}
function resetModuleBaselines(){
  moduleBaselines = {};
  model.canvases.forEach(c => {
    const m = canvasModules[c.id] && captureModuleLayout(c);
    if(m) moduleBaselines[moduleTabId(c.id)] = JSON.stringify(m);
  });
  blockInstanceTabs().forEach(inst => {
    if(canvasModules[inst.defCanvas.id]) moduleBaselines[inst.tab.id] = JSON.stringify(captureTabLayout(instanceTabSpec(inst)));
  });
}
const emptyTabLayout = (mod) => ({ family: mod.family, name: mod.name, rows: [], customs: [], sectioned: [], flat: [] });

// Called on every save of the layout: remembers each module tab and instance tab that
// changed since it was loaded (or last remembered).
function rememberModuleLayouts(){
  if(!model || !mapping) return;
  let changed = false, newlyRemembered = false;
  model.canvases.forEach(c => {
    if(!canvasModules[c.id]) return;
    const m0 = captureModuleLayout(c);
    const now = m0 && JSON.stringify(m0);
    if(!now || now === moduleBaselines[moduleTabId(c.id)]) return;
    moduleBaselines[moduleTabId(c.id)] = now;
    const m = cleanModuleLayout(m0);
    if(!m) return;
    const had = moduleLayouts[m.family];
    if(!hasTabLayout(had)) newlyRemembered = true;
    if(had && had.instance) m.instance = had.instance; // the instances' layout is kept
    moduleLayouts[m.family] = m;
    changed = true;
  });
  blockInstanceTabs().forEach(inst => {
    const mod = canvasModules[inst.defCanvas.id];
    if(!mod) return;
    const part = captureTabLayout(instanceTabSpec(inst));
    const now = JSON.stringify(part);
    if(now === moduleBaselines[inst.tab.id]) return;
    moduleBaselines[inst.tab.id] = now;
    const had = moduleLayouts[mod.family];
    if(!had || !had.instance) newlyRemembered = true;
    const m = had || emptyTabLayout(mod);
    m.instance = cleanLayoutPart(part, true);
    moduleLayouts[mod.family] = m;
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

// Lays a tab out as remembered (`m`: a cleaned part). Returns { matched, added }.
function applyTabLayout(spec, m){
  const tab = spec.tab, ownRow = spec.own;
  const refRow = new Map();
  m.rows.forEach((entry, i) => {
    if(!entry) return;
    const hit = spec.byKey.get(layoutRowKey(entry.name, entry.copy));
    if(!hit || hit.row.tabId !== tab.id) return;
    const row = hit.row;
    row.section = entry.section;
    if(entry.label !== undefined) row.label = entry.label;
    row.include = entry.include;
    row.inlineConstant = entry.constant && isInputRectangle(hit.canvas, hit.node);
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
// Lays the module canvas's tab out as remembered. Returns { matched, added } or null.
function applyModuleLayout(canvas, m){
  const spec = moduleTabSpec(canvas);
  if(!spec) return null;
  const tab = spec.tab;
  if(m.tabName && !mapping.tabs.some(t => t !== tab && t.name.toLowerCase() === m.tabName.toLowerCase())) tab.name = m.tabName;
  return applyTabLayout(spec, m);
}

// A new layout: every module canvas with a remembered layout gets it; one without, the
// layout attached to its template, if the loaded document carries one (step 11c-2). The
// same for the tabs of a module's block instances (step 11d).
function applyModuleLayouts(){
  moduleLayoutsApplied = [];
  tabLayoutFromTemplate = {};
  model.canvases.forEach(c => {
    const mod = canvasModules[c.id];
    if(!mod) return;
    const own = hasTabLayout(moduleLayouts[mod.family]) ? moduleLayouts[mod.family] : null;
    const m = own || templateLayoutFor(mod, hasTabLayout);
    if(!m) return;
    const r = applyModuleLayout(c, m);
    if(!r) return;
    if(!own) tabLayoutFromTemplate[moduleTabId(c.id)] = true;
    moduleLayoutsApplied.push(Object.assign({ canvas: c.name, module: mod.name, fromTemplate: !own }, r));
  });
  blockInstanceTabs().forEach(inst => {
    const mod = canvasModules[inst.defCanvas.id];
    if(!mod) return;
    const own = moduleLayouts[mod.family] && moduleLayouts[mod.family].instance;
    const tpl = own ? null : templateLayoutFor(mod, l => !!l.instance);
    const part = own || (tpl && tpl.instance);
    if(!part) return;
    const r = applyTabLayout(instanceTabSpec(inst), part);
    if(!own) tabLayoutFromTemplate[inst.tab.id] = true;
    moduleLayoutsApplied.push(Object.assign({ canvas: inst.tab.name, module: mod.name, fromTemplate: !own, instance: true }, r));
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

// The tag on a module's tab, or a block instance's, in the Tabs panel: which module,
// whether its layout is remembered, Forget, and for an instance tab "Lay out the other
// instances like this".
function moduleTabTag(tab){
  if(tab.id.startsWith('tab_blk_')) return instanceTabTag(tab);
  const canvasId = tab.id.startsWith('tab_') ? tab.id.slice(4) : null;
  const mod = canvasId && canvasModules[canvasId];
  if(!mod) return null;
  const wrap = document.createElement('span');
  wrap.className = 'module-tag';
  wrap.dataset.family = mod.family;
  const label = document.createElement('span');
  const remembered = hasTabLayout(moduleLayouts[mod.family]);
  const fromTemplate = !remembered && !!tabLayoutFromTemplate[tab.id];
  label.textContent = '🧩 ' + (mod.name || 'module') + (remembered ? ' · layout remembered' : fromTemplate ? ' · layout from the template' : '');
  label.title = remembered
    ? 'This tab comes from the module "' + mod.name + '". Its layout is remembered, and used wherever the module turns up in a model laid out here for the first time.'
    : fromTemplate
    ? 'This tab comes from the module "' + mod.name + '", laid out with the Excel layout attached to its template. Change it and your own layout is remembered instead.'
    : 'This tab comes from the module "' + mod.name + '". Change its layout and it is remembered for the next model with this module.';
  wrap.appendChild(label);
  if(remembered){
    wrap.appendChild(forgetButton('Forget the layout remembered for this module\'s own tab (this model\'s own layout is kept)', () => {
      const m = moduleLayouts[mod.family];
      if(m.instance) moduleLayouts[mod.family] = Object.assign(emptyTabLayout(mod), { instance: m.instance });
      else delete moduleLayouts[mod.family];
      const c = model.canvases.find(x => x.id === canvasId);
      const now = c && captureModuleLayout(c);
      if(now) moduleBaselines[tab.id] = JSON.stringify(now); // not remembered again until it changes
      return 'Forgot the layout remembered for "' + mod.name + '".';
    }));
  }
  return wrap;
}
function forgetButton(title, forget){
  const btn = document.createElement('button');
  btn.className = 'icon module-forget';
  btn.textContent = 'Forget';
  btn.title = title;
  btn.addEventListener('click', () => {
    const message = forget();
    saveModuleLayouts();
    renderTabs();
    setStatus($('moduleLayoutsStatus'), message, 'ok');
  });
  return btn;
}
function instanceTabTag(tab){
  const all = blockInstanceTabs();
  const inst = all.find(x => x.tab.id === tab.id);
  if(!inst) return null;
  const others = all.filter(x => x !== inst && x.defCanvas.id === inst.defCanvas.id);
  const mod = canvasModules[inst.defCanvas.id];
  if(!mod && !others.length) return null;
  const wrap = document.createElement('span');
  wrap.className = 'module-tag instance-tag';
  if(mod){
    wrap.dataset.family = mod.family;
    const remembered = !!(moduleLayouts[mod.family] && moduleLayouts[mod.family].instance);
    const fromTemplate = !remembered && !!tabLayoutFromTemplate[tab.id];
    const label = document.createElement('span');
    label.textContent = '🧩 ' + (mod.name || 'module') + (remembered ? ' · instance layout remembered' : fromTemplate ? ' · instance layout from the template' : '');
    label.title = remembered
      ? 'This tab is an instance of the block "' + mod.name + '". Its layout is remembered, and used for the instances of this block in a model laid out here for the first time.'
      : fromTemplate
      ? 'This tab is an instance of the block "' + mod.name + '", laid out with the Excel layout attached to its template. Change it and your own layout is remembered instead.'
      : 'This tab is an instance of the block "' + mod.name + '". Change its layout and it is remembered for this block\'s instances in the next model.';
    wrap.appendChild(label);
    if(remembered){
      wrap.appendChild(forgetButton('Forget the layout remembered for this block\'s instances (this model\'s own layout is kept)', () => {
        const m = moduleLayouts[mod.family];
        delete m.instance;
        if(!hasTabLayout(m)) delete moduleLayouts[mod.family];
        all.filter(x => x.defCanvas.id === inst.defCanvas.id).forEach(x => {
          moduleBaselines[x.tab.id] = JSON.stringify(captureTabLayout(instanceTabSpec(x))); // not remembered again until it changes
        });
        return 'Forgot the layout remembered for the instances of "' + mod.name + '".';
      }));
    }
  }
  if(others.length){
    const btn = document.createElement('button');
    btn.className = 'icon instance-copy';
    btn.textContent = 'Lay out the other instances like this';
    btn.title = 'Give the other ' + (others.length === 1 ? 'instance' : others.length + ' instances') + ' of this block this tab\'s layout';
    btn.addEventListener('click', () => layOutOtherInstances(inst, others));
    wrap.appendChild(btn);
  }
  return wrap;
}
async function layOutOtherInstances(inst, others){
  const n = others.length;
  const ok = await showConfirm('Lay out the other instances like this?',
    `The other ${n === 1 ? 'tab' : n + ' tabs'} of the block "${inst.defCanvas.name || 'Block'}" get this tab's row order, sections, labels, Include / Constant, formats and custom rows, replacing their own. Their tab names are kept.`,
    'Lay Out');
  if(!ok) return;
  const part = cleanLayoutPart(JSON.parse(JSON.stringify(captureTabLayout(instanceTabSpec(inst)))), true);
  others.forEach(o => applyTabLayout(instanceTabSpec(o), part));
  saveMapping();
  renderAll();
  setStatus($('moduleLayoutsStatus'), `Laid out ${n === 1 ? '1 other tab' : n + ' other tabs'} like "${inst.tab.name}".`, 'ok');
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
