// A rectangle's effective formatting, mirroring fmIDE exactly: an explicit per-node
// style always wins; otherwise an input rectangle (no incoming edge) falls back to the
// shared "Inputs" format preset, when one was included in the loaded export (only a
// full "Export Workspace" JSON carries formatPresets — a plain "Save System" export
// won't have one, in which case rows just get Excel's default look).
// ============================================================
// Format roles — the ONE place cell formatting comes from. Every cell this tool writes
// has a role; each role is a format preset of that name in fmIDE (Formats manager),
// read from the loaded JSON. A role missing from the file (an older export) falls back
// to the built-in default below — kept identical to fmIDE's own defaults.
// Rule for rectangle rows: the ROLE owns fill, font colour and border — so the look
// always says what kind of cell it is — and the rectangle's own 🎨 format owns number
// format, weight and size. A rectangle whose format has "Use this fill, font colour &
// border in Excel too" (style.keepColours) keeps its own fill, colour and border as well.
// Excel-only style settings: border.sides (which cell sides get the border; absent = all
// four, [] = none) and font.excelDefaultSize (leave the size to the workbook default).
// ============================================================
const NF_GENERAL = { kind: 'general', decimals: 2, currencySymbol: '$' };
const DEFAULT_ROLE_STYLES = {
  'Inputs':          { numberFormat: NF_GENERAL, fill: '#eff6ff', border: { color: '#93c5fd', width: 1.5, style: 'solid' }, font: { family: '', size: 14, weight: 'normal', color: '#1e3a8a' } },
  'Calculations':    { numberFormat: NF_GENERAL, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: null } },
  'Links':           { numberFormat: NF_GENERAL, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: '#008000' } },
  'Headers':         { numberFormat: NF_GENERAL, fill: '#f1f5f9', border: null, font: { family: '', size: null, weight: '700', color: null } },
  'Section Headers': { numberFormat: NF_GENERAL, fill: '#f8fafc', border: null, font: { family: '', size: null, weight: '700', color: '#475569' } },
  'Labels':          { numberFormat: NF_GENERAL, fill: null, border: null, font: { family: '', size: null, weight: '700', color: '#475569' } },
  'Notes':           { numberFormat: NF_GENERAL, fill: null, border: null, font: { family: '', size: 9, weight: 'normal', color: '#94a3b8' } }
};
const ROLE_NAMES = Object.keys(DEFAULT_ROLE_STYLES);

// The role's style (fmIDE-style object): from the file's presets, else the default.
function roleStyle(name){
  const p = model && (model.formatPresets || []).find(x => x && x.name === name && x.style);
  return p ? p.style : DEFAULT_ROLE_STYLES[name];
}
function roleSource(name){
  return model && (model.formatPresets || []).some(x => x && x.name === name && x.style) ? 'fmIDE' : 'default';
}
// Role colours + the rectangle's own look (see the rule above). Returns an fmIDE-style object.
function composeStyle(roleName, own){
  const role = roleStyle(roleName) || {};
  const out = JSON.parse(JSON.stringify(role));
  if(own){
    if(own.numberFormat && own.numberFormat.kind && own.numberFormat.kind !== 'general') out.numberFormat = own.numberFormat;
    if(own.font){
      out.font = Object.assign({}, out.font || {});
      ['family', 'weight'].forEach(k => { if(own.font[k]) out.font[k] = own.font[k]; });
      // size: the rectangle's own (or its "Excel default size" choice) wins over the role's
      if(own.font.excelDefaultSize){ out.font.size = null; out.font.excelDefaultSize = true; }
      else if(own.font.size){ out.font.size = own.font.size; delete out.font.excelDefaultSize; }
    }
    if(own.keepColours){
      out.fill = own.fill || null;
      out.font = Object.assign({}, out.font || {}, { color: (own.font && own.font.color) || null });
      out.border = own.border || null;
    }
  }
  return out;
}
// Excel cell style for a structural cell of a role, plus layout-only extras (alignment,
// wrap) — never colours.
function roleCellStyle(name, extra){
  return mergeXlStyle(nodeStyleToExcelCellStyle(roleStyle(name)), extra);
}
function mergeXlStyle(base, extra){
  const out = Object.assign({}, base || {});
  if(extra){
    Object.keys(extra).forEach(k => {
      out[k] = (typeof extra[k] === 'object' && extra[k] && !Array.isArray(extra[k])) ? Object.assign({}, out[k] || {}, extra[k]) : extra[k];
    });
  }
  return Object.keys(out).length ? out : null;
}
const CENTER = { alignment: { horizontal: 'center' } };

// Read-only legend: each role's look and whether it came from the file or the default.
function renderRolesLegend(){
  const el = $('rolesLegend'); if(!el) return;
  el.innerHTML = '';
  ROLE_NAMES.forEach(name => {
    const st = roleStyle(name) || {};
    const chip = document.createElement('span');
    chip.className = 'role-chip';
    chip.textContent = name;
    chip.style.background = st.fill || '#fff';
    chip.style.color = (st.font && st.font.color) || '#1e293b';
    chip.style.fontWeight = (st.font && st.font.weight) || 'normal';
    chip.style.border = (st.border && st.border.style && st.border.style !== 'none') ? `1px ${st.border.style} ${st.border.color || '#94a3b8'}` : '1px solid #e2e8f0';
    const src = roleSource(name);
    chip.title = name + (src === 'fmIDE' ? ' — from this file (fmIDE preset)' : ' — built-in default (this file has no "' + name + '" preset)');
    if(src !== 'fmIDE'){ const d = document.createElement('span'); d.className = 'role-default'; d.textContent = 'default'; chip.appendChild(d); }
    el.appendChild(chip);
  });
}

function resolveNodeStyle(canvas, node, formatPresets){
  if(node.style) return node.style;
  if(node.type === 'value' && isInputRectangle(canvas, node)){
    const preset = (formatPresets || []).find(p => p.name === 'Inputs');
    if(preset) return preset.style;
  }
  return null;
}

function styleColorToRgbHex(hex){
  if(!hex || typeof hex !== 'string') return null;
  const h = hex.replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : null;
}

// Translates fmIDE's style shape ({numberFormat, fill, border, font}) into a SheetJS
// cell.s style object (fill/border/font colors) — the number format is kept separate,
// via cell.z (numberFormatToExcel), since that's a distinct property either way.
function nodeStyleToExcelCellStyle(style){
  if(!style) return null;
  const s = {};
  if(style.font){
    const f = {};
    const color = styleColorToRgbHex(style.font.color);
    if(color) f.color = { rgb: color };
    if(style.font.size && !style.font.excelDefaultSize) f.sz = style.font.size; // else: workbook default
    if(style.font.weight === '700' || style.font.weight === 'bold' || style.font.weight === '600') f.bold = true;
    if(Object.keys(f).length) s.font = f;
  }
  if(style.fill){
    const color = styleColorToRgbHex(style.fill);
    if(color) s.fill = { patternType: 'solid', fgColor: { rgb: color } };
  }
  if(style.border && style.border.style && style.border.style !== 'none'){
    const excelStyle = { solid: 'thin', dashed: 'dashed', dotted: 'dotted' }[style.border.style] || 'thin';
    const color = styleColorToRgbHex(style.border.color) || '94A3B8';
    const edge = { style: excelStyle, color: { rgb: color } };
    // Only the sides the style asks for (older styles without "sides" = all four).
    const sides = Array.isArray(style.border.sides) ? style.border.sides : ['top', 'bottom', 'left', 'right'];
    const b = {};
    sides.forEach(k => { if(['top', 'bottom', 'left', 'right'].includes(k)) b[k] = edge; });
    if(Object.keys(b).length) s.border = b;
  }
  return Object.keys(s).length ? s : null;
}

// ============================================================
// App state
// ============================================================
let model = null;      // { periods, canvases: [{id,name,nodes,edges}] }
let mapping = null;    // { tabs:[{id,name,order}], rows:[{id,canvasId,nodeId,tabId,section,order,label,include}], cfg:{...} }
let mappingKey = null; // localStorage key derived from the loaded model's structure

const $ = (id) => document.getElementById(id);

// Group header "<name> ... <count>" built as text — names come from the loaded file.
function setGroupHeader(header, name, count){
  header.innerHTML = '';
  const a = document.createElement('span'); a.textContent = String(name);
  const b = document.createElement('span'); b.className = 'count'; b.textContent = String(count);
  header.appendChild(a); header.appendChild(b);
}

function setStatus(el, msg, kind){
  // Text only: messages include file names, tab names and error text from loaded files.
  el.innerHTML = '';
  if(!msg) return;
  const d = document.createElement('div');
  d.className = 'status ' + (['ok', 'err', 'info', 'warn'].includes(kind) ? kind : 'info');
  d.textContent = String(msg);
  el.appendChild(d);
}

// ---------- Loading & default mapping ----------
function signatureOf(m){
  const parts = [];
  m.canvases.forEach(c => { parts.push(c.id); c.nodes.forEach(n => parts.push(n.id)); });
  let h = 0;
  const s = parts.join('|');
  for(let i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'fmide-excelmap-' + (h >>> 0).toString(36);
}

function exportableNodesOf(canvas){
  return canvas.nodes.filter(n => classifyNode(canvas, n) !== null);
}

// Aliases don't carry their own name — fmIDE always displays the *source* rectangle's
// name for an alias, so the default row label must follow the same rule (recursing
// through chained aliases) instead of reading the alias's own (usually empty) text.
function nodeDisplayName(canvasById, node){
  if(node.type === 'alias'){
    const srcCanvas = node.sourceCanvasId && canvasById[node.sourceCanvasId];
    const srcNode = srcCanvas && srcCanvas.nodes.find(n => n.id === node.sourceNodeId);
    return srcNode ? nodeDisplayName(canvasById, srcNode) : '(unnamed)';
  }
  const { name } = parseNodeText(node.text);
  return name || '(unnamed)';
}

// One default tab per block instance, holding its unpacked internal rows (and, for
// a block that itself contains a nested block instance, that nested instance's rows
// too — collectUnpackedRows already folds those in under the same top-level tab).
// Fully renameable/reassignable afterward via the existing Tabs/Rows UI, exactly
// like a canvas's own default tab.
function buildBlockInstanceTabsAndRows(m, canvasById, tabs, rows){
  const instanceCounterByDef = {};
  const periodCount = m.periods.length;
  findAllBlockInstances(m).forEach(({ hostCanvasId, hostNode }) => {
    if(!hostNode.blockDefCanvasId) return;
    const tabId = 'tab_blk_' + hostCanvasId + '_' + hostNode.id;
    if(tabs.some(t => t.id === tabId)) return; // already has a tab (reconcile path)
    const defCanvas = canvasById[hostNode.blockDefCanvasId];
    instanceCounterByDef[hostNode.blockDefCanvasId] = (instanceCounterByDef[hostNode.blockDefCanvasId] || 0) + 1;
    const n = instanceCounterByDef[hostNode.blockDefCanvasId];
    const tabName = sanitizeSheetName((defCanvas ? (defCanvas.name || hostNode.blockDefCanvasId) : 'Block') + ' (instance ' + n + ')');
    tabs.push({ id: tabId, name: tabName, order: tabs.length });

    const unpacked = collectInstanceRows(canvasById, [], hostCanvasId, hostNode, new Set(), periodCount)
      .map(u => ({ u, node: canvasById[u.canvasId].nodes.find(nn => nn.id === u.nodeId) }));
    // Default ordering: for a NON-vertical instance this is unchanged — pure
    // canvas-layout (y, then x) order. For a VERTICAL instance: every shared row
    // (verticalShared — provably identical in every vintage, see isVintageVarying)
    // is pinned at the very top, ahead of everything else, ordered among themselves
    // by canvas layout. Then each remaining LINE ITEM groups by canvas-layout
    // position (every vintage's copy of the same rectangle, like "Depreciation",
    // clusters together), ordered inside the group by vintage 1, 2, …, N, with that
    // item's combined/reduced Total row (if any) last in the group — e.g.
    // "Depreciation — Vintage 1" … "Depreciation — Vintage 10", "Depreciation
    // (Total)", then the next line item's own vintage-1..N run. Either way this is
    // only the starting point; every row stays freely reorderable afterward via the
    // existing Order/Move/Tree tools.
    unpacked.sort((a, b) => {
      const aShared = !!a.u.verticalShared, bShared = !!b.u.verticalShared;
      if(aShared !== bShared) return aShared ? -1 : 1;
      const posCmp = (a.node.y - b.node.y) || (a.node.x - b.node.x);
      if(posCmp !== 0) return posCmp;
      if(aShared) return 0;
      const av = a.u.verticalCombined ? Infinity : (a.u.verticalVintage || 0);
      const bv = b.u.verticalCombined ? Infinity : (b.u.verticalVintage || 0);
      return av - bv;
    });
    let order = 0;
    unpacked.forEach(({ u, node }) => {
      let label = nodeDisplayName(canvasById, node);
      if(u.verticalCombined) label += ' (Total)';
      else if(u.verticalShared) label += ' (shared)';
      else if(typeof u.verticalVintage === 'number') label += ' — Vintage ' + u.verticalVintage;
      rows.push({
        id: pathKey(u.path, u.canvasId, u.nodeId), canvasId: u.canvasId, nodeId: u.nodeId, path: u.path,
        tabId, section: u.section, order: order++,
        label, include: true, inlineConstant: false,
        verticalCombined: !!u.verticalCombined,
        verticalShared: !!u.verticalShared,
        verticalVintage: typeof u.verticalVintage === 'number' ? u.verticalVintage : undefined
      });
    });
  });
}

function buildDefaultMapping(m){
  const canvasById = {}; m.canvases.forEach(c => canvasById[c.id] = c);
  const tabs = m.canvases.map((c, i) => ({ id: 'tab_' + c.id, name: sanitizeSheetName(c.name || ('Canvas ' + (i + 1))), order: i }));
  const tabIdByCanvas = {}; m.canvases.forEach((c, i) => tabIdByCanvas[c.id] = tabs[i].id);
  const rows = [];
  m.canvases.forEach(c => {
    let order = 0;
    exportableNodesOf(c).sort((a, b) => (a.y - b.y) || (a.x - b.x)).forEach(n => {
      const section = classifyNode(c, n);
      rows.push({
        id: pathKey([], c.id, n.id), canvasId: c.id, nodeId: n.id, path: [],
        tabId: tabIdByCanvas[c.id], section, order: order++,
        label: nodeDisplayName(canvasById, n), include: true, inlineConstant: false
      });
    });
  });
  buildBlockInstanceTabsAndRows(m, canvasById, tabs, rows);
  return {
    tabs, rows,
    customRows: [],
    cfg: { startLabel: '2027', frequency: 'annual', fallbackFormat: '#,##0', fileName: 'fmIDE-export', sectionsEnabled: true }
  };
}

