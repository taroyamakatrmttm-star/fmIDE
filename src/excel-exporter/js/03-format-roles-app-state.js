// ============================================================
// The Excel style — how every cell in the workbook looks (step 11a, decision 9 in
// docs/decisions.md). It is ExcelExporter's and the person's own: seven roles, each with a
// fill, font colour, bold, font size (blank = Excel's default) and a border (style, colour,
// which sides). Edited in section 2 (03b-excel-style.js), saved in this browser, and moved
// between computers as an fmIDE-excel-style file. fmIDE says only what a rectangle is (an
// input or a calculation, by the shared input rule) and its number format; its canvas
// colours, fonts and borders never reach Excel. The Excel-only settings older fmIDE files
// carried are dropped when they are read (src/shared/file-formats.js).
// A rectangle row gets its role's look plus fmIDE's number format; a row's own format
// (Tree view 🎨) goes over both.
// ============================================================
const EXCEL_ROLES = [
  { name: 'Inputs', desc: 'Hard-coded numbers: input rows, scenario values, and the cells you type on the Scenarios tab.',
    style: { fill: '#eff6ff', font: { color: '#1e3a8a', weight: 'normal', size: null }, border: { style: 'solid', color: '#93c5fd', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Calculations', desc: 'Formulas: every calculated cell. Blank by default.',
    style: { fill: null, font: { color: null, weight: 'normal', size: null }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Links', desc: 'Formulas that only pull a value from another sheet (a row linked to the Inputs tab, or fed through a plug or alias from another canvas).',
    style: { fill: null, font: { color: '#008000', weight: 'normal', size: null }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Headers', desc: 'Each sheet\'s title and column-header row.',
    style: { fill: '#f1f5f9', font: { color: null, weight: '700', size: null }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Section Headers', desc: 'The INPUTS / CALCULATIONS / OUTPUTS bands.',
    style: { fill: '#f8fafc', font: { color: '#475569', weight: '700', size: null }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Labels', desc: 'Custom / label rows and group headers (unless the row has its own format).',
    style: { fill: null, font: { color: '#475569', weight: '700', size: null }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } },
  { name: 'Notes', desc: 'Notes, the Period # counter, scenario numbering and other helper text.',
    style: { fill: null, font: { color: '#94a3b8', weight: 'normal', size: 9 }, border: { style: 'none', color: '#94a3b8', sides: ['top', 'bottom', 'left', 'right'] } } }
];
const EXCEL_BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted'];
const EXCEL_SIDES = ['top', 'bottom', 'left', 'right'];
const EXCEL_FONT_SIZE_MIN = 6, EXCEL_FONT_SIZE_MAX = 72;
const EXCEL_STYLE_KEY = 'fmide-excel-style';
function defaultExcelStyle(){
  const out = {};
  EXCEL_ROLES.forEach(r => { out[r.name] = JSON.parse(JSON.stringify(r.style)); });
  return out;
}
// One role's style from storage or a file (untrusted): colours checked, sizes bounded, the
// border style and sides from their lists; anything missing or wrong takes the default's.
function cleanExcelRoleStyle(raw, dflt){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const f = src.font && typeof src.font === 'object' ? src.font : {};
  const b = src.border && typeof src.border === 'object' ? src.border : {};
  const out = { fill: 'fill' in src ? cleanHexColor(src.fill) : dflt.fill };
  const size = Math.round(Number(f.size));
  out.font = {
    color: 'color' in f ? cleanHexColor(f.color) : dflt.font.color,
    weight: 'weight' in f ? (f.weight === '700' || f.weight === 'bold' ? '700' : 'normal') : dflt.font.weight,
    size: 'size' in f ? (f.size !== null && Number.isFinite(size) ? Math.max(EXCEL_FONT_SIZE_MIN, Math.min(EXCEL_FONT_SIZE_MAX, size)) : null) : dflt.font.size
  };
  out.border = {
    style: EXCEL_BORDER_STYLES.includes(b.style) ? b.style : dflt.border.style,
    color: cleanHexColor(b.color) || dflt.border.color,
    sides: Array.isArray(b.sides) ? EXCEL_SIDES.filter(k => b.sides.includes(k)) : dflt.border.sides.slice()
  };
  return out;
}
// A whole Excel style ({ roleName: style }) read from storage or a file.
function cleanExcelStyle(roles){
  const src = roles && typeof roles === 'object' && !Array.isArray(roles) ? roles : {};
  const out = {};
  EXCEL_ROLES.forEach(r => { out[r.name] = cleanExcelRoleStyle(Object.prototype.hasOwnProperty.call(src, r.name) ? src[r.name] : null, r.style); });
  return out;
}
function excelStylePayload(){
  return { kind: 'fmIDE-excel-style', version: FILE_FORMATS['fmIDE-excel-style'].current, roles: JSON.parse(JSON.stringify(excelStyle)) };
}
let excelStyle = defaultExcelStyle();

// A role's style (the shape fmIDE's styles have, which nodeStyleToExcelCellStyle reads).
function roleStyle(name){ return excelStyle[name] || null; }
// The number format fmIDE gives a rectangle — the one part of its look that goes to Excel:
// its own 🎨 format's if it has one, else its canvas role's (Inputs or Calculations, as the
// file's presets say). Read from the file, so checked: a known kind, 0–10 decimals, a short
// currency symbol without quotes. The two roles' formats are worked out once per model.
function cleanModelNumberFormat(nf){
  if(!nf || typeof nf !== 'object' || !['number', 'percent', 'currency'].includes(nf.kind)) return null;
  const d = Math.round(Number(nf.decimals));
  const out = { kind: nf.kind, decimals: Number.isFinite(d) ? Math.max(0, Math.min(10, d)) : 2 };
  if(nf.kind === 'currency') out.currencySymbol = typeof nf.currencySymbol === 'string' && /^[^"\\]{1,5}$/.test(nf.currencySymbol) ? nf.currencySymbol : '$';
  return out;
}
const roleNumberFormats = new WeakMap(); // model → { Inputs, Calculations }
function roleNumberFormat(role){
  if(!model) return null;
  let byRole = roleNumberFormats.get(model);
  if(!byRole){
    byRole = {};
    ['Inputs', 'Calculations'].forEach(r => {
      const p = (model.formatPresets || []).find(x => x && x.name === r && x.style);
      byRole[r] = cleanModelNumberFormat(p && p.style.numberFormat);
    });
    roleNumberFormats.set(model, byRole);
  }
  return byRole[role];
}
function modelNumberFormat(canvas, node){
  if(node && node.style) return cleanModelNumberFormat(node.style.numberFormat);
  // isInputNode: the shared input rule, as the IR already worked it out for this node.
  return roleNumberFormat(canvas && node && isInputNode(canvas, node) ? 'Inputs' : 'Calculations');
}
// A rectangle row's look: its role's style plus fmIDE's number format.
function composeStyle(roleName, numberFormat){
  const out = JSON.parse(JSON.stringify(roleStyle(roleName) || {}));
  if(numberFormat) out.numberFormat = numberFormat;
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

// ---------- A row's own format and indent (set in the Tree view) ----------
// row.style on a custom row is its whole look; on a rectangle row it overrides what the
// role and the rectangle give it: fill, font colour, bold, border, and (optionally) the
// number format. row.indent: how many steps the label (column A) is indented, like Excel's
// Increase Indent (Alt+H+6). Both come from saved layouts and mapping files, so they are
// read through cleanRowFormat / rowIndent: colours checked, numbers forced and bounded.
const ROW_INDENT_MAX = 15;
const ROW_NUMBER_KINDS = ['general', 'number', 'percent', 'currency'];
function cleanHexColor(v){ return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null; }
function cleanRowFormat(st){
  if(!st || typeof st !== 'object' || Array.isArray(st)) return null;
  const out = { fill: cleanHexColor(st.fill) };
  const f = st.font && typeof st.font === 'object' ? st.font : {};
  out.font = { color: cleanHexColor(f.color) || '#1e293b', weight: (f.weight === '700' || f.weight === 'bold') ? '700' : 'normal' };
  out.border = cleanRowBorder(st.border);
  const nf = st.numberFormat;
  if(nf && typeof nf === 'object' && ROW_NUMBER_KINDS.includes(nf.kind)){
    const d = Math.round(Number(nf.decimals));
    out.numberFormat = { kind: nf.kind, decimals: Number.isFinite(d) ? Math.max(0, Math.min(10, d)) : 2 };
    if(nf.kind === 'currency') out.numberFormat.currencySymbol = '$';
  }
  return out;
}
// A row's own border: solid, one colour, on the sides it names — `sides` left out means all
// four (as every format before sides existed), none named means no border.
function cleanRowBorder(b){
  if(!b || typeof b !== 'object' || !b.style || b.style === 'none') return { style: 'none' };
  const out = { color: cleanHexColor(b.color) || '#94a3b8', style: 'solid' };
  if(Array.isArray(b.sides)){
    const sides = EXCEL_SIDES.filter(k => b.sides.includes(k));
    if(!sides.length) return { style: 'none' };
    if(sides.length < EXCEL_SIDES.length) out.sides = sides;
  }
  return out;
}
function rowIndent(row){
  const n = Math.round(Number(row && row.indent));
  return Number.isFinite(n) ? Math.max(0, Math.min(ROW_INDENT_MAX, n)) : 0;
}
// A rectangle row's style (fmIDE-style object) with the row's own format laid over it.
function withRowFormat(base, fmt){
  if(!fmt) return base;
  const out = JSON.parse(JSON.stringify(base || {}));
  out.fill = fmt.fill || null;
  out.font = Object.assign({}, out.font || {}, { color: fmt.font.color, weight: fmt.font.weight });
  out.border = fmt.border.style === 'none' ? { style: 'none' } : { color: fmt.border.color, style: 'solid' };
  if(fmt.border.sides) out.border.sides = fmt.border.sides.slice();
  if(fmt.numberFormat) out.numberFormat = fmt.numberFormat;
  return out;
}
// The label cell's Excel style: the row's style plus its indent.
function withIndent(cellStyle, row){
  const n = rowIndent(row);
  return n ? mergeXlStyle(cellStyle, { alignment: { horizontal: 'left', indent: n } }) : cellStyle;
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
    if(style.font.size) f.sz = style.font.size; // else: the workbook's default size
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
    // Only the sides the style asks for (a row's own format without "sides": all four).
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
let mappingKey = null; // storage key derived from the loaded model's structure ('fmide-excelmap-…')

// Saved layouts live in the browser's IndexedDB (database 'fmIDE-ExcelExporter'), one key
// per model — the same keys and JSON text older versions kept in localStorage, which are
// copied across once on start (the localStorage copies are kept).
// build:include shared/store.js
const layoutStore = createStore('fmIDE-ExcelExporter');
const layoutsMigrated = layoutStore.migrateFromLocalStorage(k => k.startsWith('fmide-excelmap-'));

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
  // × dismisses it (drawn by the style sheet, so the message's text stays just the message).
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'status-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.title = 'Dismiss';
  close.addEventListener('click', () => d.remove());
  d.appendChild(close);
  el.appendChild(d);
}

// ---------- Loading & default mapping ----------
// The key a model's layout is saved under: its canvas and node ids. `withoutAutoLinks`
// leaves out the aliases plugs make (marked `auto`), whose ids change whenever fmIDE redraws
// them; layouts saved before that was so used the key with them.
function signatureOf(m, withoutAutoLinks){
  const parts = [];
  m.canvases.forEach(c => {
    parts.push(c.id);
    c.nodes.forEach(n => { if(!(withoutAutoLinks && n && n.type === 'alias' && n.auto)) parts.push(n.id); });
  });
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
  const { name } = parseRectText(node.text);
  return name || '(unnamed)';
}

// The default label of a block instance's row: the rectangle's name, and which copy it is
// in a vertical instance (a vintage, the Total, or the row shared by every vintage).
function unpackedRowLabel(canvasById, node, u){
  const name = nodeDisplayName(canvasById, node);
  if(u.verticalCombined) return name + ' (Total)';
  if(u.verticalShared) return name + ' (shared)';
  if(typeof u.verticalVintage === 'number') return name + ' — Vintage ' + u.verticalVintage;
  return name;
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

    const unpacked = collectInstanceRows([], hostCanvasId, hostNode, new Set(), periodCount)
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
      rows.push({
        id: pathKey(u.path, u.canvasId, u.nodeId), canvasId: u.canvasId, nodeId: u.nodeId, path: u.path,
        tabId, section: u.section, order: order++,
        label: unpackedRowLabel(canvasById, node, u), include: true, inlineConstant: false,
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
    cfg: { startLabel: '2027', frequency: 'annual', fallbackFormat: '#,##0', fileName: 'fmIDE-export', sectionsEnabled: false }
  };
}

