(function(){
'use strict';

// ============================================================
// Core translation logic (parsing / UOM / formula building) —
// unit-tested standalone before being wired to this UI.
// ============================================================

function parseNodeText(text){
  const raw = text || '';
  const lines = raw.split('\n');
  if(lines.length === 1){
    const t = lines[0].trim();
    if(t !== '' && !isNaN(Number(t))) return { name: '', literal: Number(t), uom: null };
    return { name: lines[0], literal: null, uom: null };
  }
  const name = lines[0];
  const second = (lines[1] || '').trim();
  const literal = (second !== '' && !isNaN(Number(second))) ? Number(second) : null;
  const uom = (lines.length >= 3 && lines[2].trim() !== '') ? lines[2].trim() : null;
  return { name, literal, uom };
}

// Only consulted by buildCellContent for a node with no single incoming edge (a genuine
// input, or a broken/ambiguous multi-edge state) — a wired, edge-driven node is handled
// entirely in buildCellContent itself and never reaches this function, so a stale
// periodValues array left over from before a rectangle was wired up can't override it.
function effectiveLiteral(node, periodIndex){
  if(Array.isArray(node.periodValues) && typeof node.periodValues[periodIndex] === 'number' && isFinite(node.periodValues[periodIndex])){
    return node.periodValues[periodIndex];
  }
  const { literal } = parseNodeText(node.text);
  if(literal === null) return null;
  if(Array.isArray(node.literalPeriods) && !node.literalPeriods.includes(periodIndex)) return null;
  return literal;
}

const UOM_PREFIXES = [['bn', 1e9], ['mm', 1e6], ['k', 1e3], ['m', 1e6]];
const UOM_CURRENCY_SYMBOLS = new Set(['$', '€', '£', '¥']);
const UOM_SCALE_TO_PREFIX = { 1: '', 1000: 'k', 1000000: 'm', 1000000000: 'bn' };

function parseUOMAtom(tok){
  tok = tok.trim();
  if(!tok) return null;
  if(tok === '%') return { scale: 0.01, symbol: '' };
  for(const [pfx, mult] of UOM_PREFIXES){
    if(tok.length > pfx.length){
      if(tok.slice(0, pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(pfx.length).trim() };
      if(tok.slice(-pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(0, -pfx.length).trim() };
    }
  }
  return { scale: 1, symbol: tok };
}
function parseUOMSegment(seg){ return seg.split(/[*·]/).map(parseUOMAtom).filter(Boolean); }
function parseUOM(str){
  if(!str) return null;
  const s = str.trim();
  if(!s) return null;
  const slashIdx = s.indexOf('/');
  const numAtoms = parseUOMSegment(slashIdx === -1 ? s : s.slice(0, slashIdx));
  const denAtoms = slashIdx === -1 ? [] : parseUOMSegment(s.slice(slashIdx + 1));
  if(numAtoms.length === 0 && denAtoms.length === 0) return null;
  let scale = 1;
  const dims = {};
  numAtoms.forEach(a => { scale *= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) + 1; });
  denAtoms.forEach(a => { scale /= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) - 1; });
  Object.keys(dims).forEach(k => { if(dims[k] === 0) delete dims[k]; });
  return { scale, dims };
}
function formatUOM(u){
  if(!u) return '';
  const numSyms = Object.keys(u.dims).filter(k => u.dims[k] > 0).sort();
  const denSyms = Object.keys(u.dims).filter(k => u.dims[k] < 0).sort();
  const prefix = UOM_SCALE_TO_PREFIX.hasOwnProperty(u.scale) ? UOM_SCALE_TO_PREFIX[u.scale] : '';
  const atomStr = (sym, exp) => (exp > 1 ? sym + '^' + exp : sym);
  let numPart;
  if(numSyms.length === 0) numPart = prefix;
  else if(numSyms.length === 1 && prefix){
    const sym = numSyms[0];
    numPart = UOM_CURRENCY_SYMBOLS.has(sym) ? (atomStr(sym, u.dims[sym]) + prefix) : (prefix + atomStr(sym, u.dims[sym]));
  } else numPart = (prefix ? prefix + '·' : '') + numSyms.map(s => atomStr(s, u.dims[s])).join('·');
  const denPart = denSyms.map(s => atomStr(s, -u.dims[s])).join('·');
  return denPart ? (numPart || '1') + '/' + denPart : numPart;
}
function uomCombineDims(a, b, sign){
  const dims = Object.assign({}, a.dims);
  Object.keys(b.dims).forEach(k => { dims[k] = (dims[k] || 0) + sign * b.dims[k]; if(dims[k] === 0) delete dims[k]; });
  return dims;
}
function uomMultiply(a, b){ return (a && b) ? { scale: a.scale * b.scale, dims: uomCombineDims(a, b, 1) } : null; }
function uomDivide(a, b){ return (a && b) ? { scale: a.scale / b.scale, dims: uomCombineDims(a, b, -1) } : null; }
function uomDimsEqual(a, b){
  const ak = Object.keys(a.dims), bk = Object.keys(b.dims);
  return ak.length === bk.length && ak.every(k => a.dims[k] === b.dims[k]);
}
// `path` mirrors operandRef's instance-path threading — a rectangle's UOM can
// legitimately differ per block instance (an alias/Block-Input redirect resolves to
// whatever is wired externally, which varies by instance), so the memo/visiting keys
// must be instance-scoped (pathKey), not just canvasId|nodeId.
function computeNodeUOM(canvasId, nodeId, ctx, visiting, memo, path){
  path = path || [];
  const key = pathKey(path, canvasId, nodeId);
  if(memo.hasOwnProperty(key)) return memo[key];
  if(visiting.has(key)) return null;
  const n = ctx.nodeById[canvasId + '|' + nodeId];
  if(!n){ memo[key] = null; return null; }
  visiting.add(key);
  let result = null;
  const canvas = ctx.canvasById[canvasId];
  if(n.type === 'value' && n.blockRole === 'input' && path.length > 0 && !isUnfedBlockInput(ctx.canvasById, path, canvas, n)){
    // Same redirect as operandRef: a Block Input port's UOM comes from whatever
    // feeds the CURRENT instance's corresponding port, one level up the path.
    const outerHop = path[path.length - 1];
    const outerPath = path.slice(0, -1);
    const outerCanvas = ctx.canvasById[outerHop.canvasId];
    const portIndex = blockInputPortIndex(canvas, n);
    const edge = outerCanvas && outerCanvas.edges.find(e => e.to === outerHop.nodeId && e.toPort === portIndex);
    result = edge ? resolveEdgeUOM(outerHop.canvasId, edge, ctx, visiting, memo, outerPath) : null;
  } else if(n.type === 'value'){
    const manual = parseNodeText(n.text).uom;
    if(manual) result = parseUOM(manual);
    else {
      const incoming = canvas.edges.filter(e => e.to === n.id);
      if(incoming.length === 1) result = resolveEdgeUOM(canvasId, incoming[0], ctx, visiting, memo, path);
    }
  } else if(n.type === 'alias'){
    if(n.sourceCanvasId && n.sourceNodeId){
      const nextPath = (n.sourceCanvasId === canvasId) ? path : [];
      result = computeNodeUOM(n.sourceCanvasId, n.sourceNodeId, ctx, visiting, memo, nextPath);
    }
  } else if(n.type === 'periodShift'){
    const incoming = canvas.edges.filter(e => e.to === n.id);
    if(incoming.length === 1) result = resolveEdgeUOM(canvasId, incoming[0], ctx, visiting, memo, path);
  } else if(n.type === 'operator'){
    const incomingEdges = canvas.edges.filter(e => e.to === n.id && ctx.nodeById[canvasId + '|' + e.from]);
    incomingEdges.sort((a, b) => {
      const na = ctx.nodeById[canvasId + '|' + a.from], nb = ctx.nodeById[canvasId + '|' + b.from];
      return (na.x - nb.x) || (na.y - nb.y);
    });
    const uoms = incomingEdges.map(e => resolveEdgeUOM(canvasId, e, ctx, visiting, memo, path));
    if(uoms.length > 0 && !uoms.some(u => u === null)){
      if(n.text === '×') result = uoms.reduce((acc, u, i) => i === 0 ? u : uomMultiply(acc, u));
      else if(n.text === '÷') result = uoms.reduce((acc, u, i) => i === 0 ? u : uomDivide(acc, u));
      else if(['+', '−', 'abs', 'min', 'max', 'ave', 'iferror'].includes(n.text)){
        result = uoms.every(u => uomDimsEqual(u, uoms[0])) ? uoms[0] : null;
      }
    }
  }
  visiting.delete(key);
  memo[key] = result;
  return result;
}
function resolveEdgeUOM(canvasId, edge, ctx, visiting, memo, path){
  path = path || [];
  const srcNode = ctx.nodeById[canvasId + '|' + edge.from];
  if(!srcNode) return null;
  if(srcNode.type === 'blockInstance'){
    const defCanvasId = srcNode.blockDefCanvasId;
    const defCanvas = defCanvasId && ctx.canvasById[defCanvasId];
    if(!defCanvas || edge.fromPort === undefined) return null;
    const outNode = blockOutputPortNode(defCanvas, edge.fromPort);
    if(!outNode) return null;
    const childPath = path.concat([{ canvasId, nodeId: edge.from }]);
    return computeNodeUOM(defCanvasId, outNode.id, ctx, visiting, memo, childPath);
  }
  return computeNodeUOM(canvasId, edge.from, ctx, visiting, memo, path);
}

function colLetter(n){
  let s = '';
  while(n > 0){ const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
// Column layout — identical on EVERY tab of a workbook:
//   A = line item, B = UOM, C = Vintage (a vertical block's per-vintage number; blank on
//   every other row), then `helperColCount` helper columns ("<input> @ vintage" — one per
//   indexed input port of a vertical block, sized to the widest need in the workbook,
//   blank where a tab doesn't use them), then ONE ALWAYS-EMPTY SPACER COLUMN, then the
//   periods — so the column immediately left of period 1 is blank on every row of every
//   tab. With no indexed inputs, D is the spacer and periods start at E. Row 3 holds a
//   period counter (1, 2, …) above the period columns.
const VINTAGE_COL = 'C';
// A truly EMPTY cell carrying only formatting. Writing { t:'s', v:'' } instead would put
// an empty TEXT string in the cell, and =C5+1 on it gives #VALUE! — an empty cell counts
// as 0 like a blank cell typed by hand. (Written as a formatted stub; see writeFile.)
function blankCell(style, numFmt){
  const c = { t: 'z', z: numFmt || 'General' };
  if(style) c.s = style;
  return c;
}
function textCell(v, style){ return (v === '' || v === null || v === undefined) ? blankCell(style) : Object.assign({ t: 's', v }, style ? { s: style } : {}); }
let helperColCount = 0; // set per export by generateWorkbook
function helperCol(slot){ return colLetter(4 + slot); }
function periodCol(periodIndex){ return 5 + helperColCount + periodIndex; } // +1 = spacer column
function sanitizeSheetName(name){
  return (name || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet';
}
function sheetRef(tabName, col, row, currentTabName, absRow){
  const addr = col + (absRow ? '$' : '') + row;
  return (tabName === currentTabName) ? addr : ("'" + tabName + "'!" + addr);
}
// Renders a JS number as a bare literal safe to splice into an Excel formula string —
// negatives are parenthesized so they never collide with an adjacent operator (e.g. the
// infix reducer's "A*" + "-1" must read "A*(-1)", not the ambiguous-looking "A*-1").
function formatLiteralForFormula(n){
  return n < 0 ? '(' + n + ')' : String(n);
}

// Resolves what an edge "into" nodeId should read as, for a formula at periodIndex.
// Operators, aliases, and period-shift nodes never get their own row (see classifyNode) —
// they're all inlined recursively here, exactly like operators always were:
//   - operator        -> the operator's own formula, inlined
//   - alias           -> recurse straight to the alias's source (handles chained aliases)
//   - period shift     -> recurse to the shift's own incoming source, but at the
//                        shifted period column — i.e. the referencing rectangle points
//                        directly at the shifted source's cell, no intermediate row
//   - flagged constant -> the rectangle's own literal (or periodValues[periodIndex]),
//                        spliced directly into the formula text instead of a cell ref —
//                        an explicit per-row opt-in (mapping.rows[].inlineConstant), never
//                        automatic, since only the modeler knows a value is disposable
//                        formula plumbing (a sign flip, a unit-scale factor) rather than a
//                        labeled assumption that belongs in its own auditable cell
//   - block instance   -> resolves the SOURCE edge's fromPort against the instance's own
//                        definition canvas's Block Output ports, then recurses ONE LEVEL
//                        DEEPER into that definition (path gains a hop) to find the
//                        output rectangle's own (instance-scoped) row/formula
//   - Block Input port -> (only reached while already inside a block instance, i.e.
//                        path is non-empty) never gets its own row either — recurses
//                        back UP one level (path loses its last hop) to whatever the
//                        CURRENT instance's corresponding port is wired from on its
//                        host canvas; an unwired port falls back to literal 0, mirroring
//                        fmIDE's own "unbound Block input ports default to 0" rule,
//                        rather than this rectangle's own typed/chart value (which only
//                        applies when this canvas is rendered standalone, path === [])
//   - anything else    -> a direct cell reference to that node's own row
//
// `path` is the chain of blockInstance hops (outermost first) identifying which
// instance's copy is currently being resolved; [] means "not inside any instance"
// (ordinary top-level canvas). `fromPort` is only meaningful when nodeId resolves to
// a blockInstance node — it's the specific output port the calling edge used.
// The path a node's OWN row is actually keyed under. Ordinarily this is just
// whatever `path` the caller is resolving under. But when the last hop belongs to a
// vertical block instance (carries a `vIndex`) and this particular node is provably
// vintage-invariant (isVintageVarying === false), that node was only ever given ONE
// shared row — with the vIndex stripped from that same hop — instead of one per
// vintage (see collectInstanceRows). So any reference reached from inside vintage
// v's run must resolve to that same no-vIndex identity, never to a per-vintage row
// that was never created.
function resolvedRowPath(canvasId, nodeId, path, ctx){
  if(!path || path.length === 0) return path || [];
  const hop = path[path.length - 1];
  if(typeof hop.vIndex !== 'number') return path;
  const hostNodeForHop = ctx.nodeById[hop.canvasId + '|' + hop.nodeId];
  if(!hostNodeForHop || !hostNodeForHop.vertical) return path;
  if(isVintageVarying(ctx.canvasById, hop.canvasId, hostNodeForHop, canvasId, nodeId, new Set())) return path;
  return path.slice(0, -1).concat([{ canvasId: hop.canvasId, nodeId: hop.nodeId }]);
}

// If `ref` is a plain cell in period `periodIndex`'s column, returns
// INDEX(<that row's whole period range, absolute>, $C<current row>) — "the value in this
// row's vintage period"; otherwise null (an inlined formula, a literal, a shifted read).
function indexIntoRowRange(ref, periodIndex, ctx){
  const m = /^('(?:[^']|'')*'!)?([A-Z]+)\$?(\d+)$/.exec(ref);
  if(!m || m[2] !== colLetter(periodCol(periodIndex))) return null;
  const range = (m[1] || '') + '$' + colLetter(periodCol(0)) + '$' + m[3] + ':$' + colLetter(periodCol(ctx.periodCount - 1)) + '$' + m[3];
  return 'INDEX(' + range + ',$' + VINTAGE_COL + ctx.currentRow + ')';
}

// Indexed input ports (edge.verticalIndexed) of a vertical block instance, in port order:
// [{ portIndex, edge, name }] — each gets one helper column on that instance's rows.
function indexedPortsOf(ctx, hostCanvasId, hostNodeId){
  const host = ctx.nodeById[hostCanvasId + '|' + hostNodeId];
  const hostCanvas = ctx.canvasById[hostCanvasId];
  const defCanvas = host && host.blockDefCanvasId && ctx.canvasById[host.blockDefCanvasId];
  if(!host || !host.vertical || !hostCanvas || !defCanvas) return [];
  return blockPortNodes(defCanvas, 'input').map((portNode, portIndex) => {
    const edge = hostCanvas.edges.find(e => e.to === hostNodeId && e.toPort === portIndex);
    return edge && edge.verticalIndexed ? { portIndex, edge, name: parseNodeText(portNode.text).name || ('Input ' + (portIndex + 1)) } : null;
  }).filter(Boolean);
}

// Formula for one helper cell: this vintage's value of an indexed input — the same
// INDEX(..., $C<row>) shape on every vintage row; falls back to the direct expression
// when the input isn't a plain row (still correct, just row-specific).
function helperCellFormula(ctx, hop, outerPath, port, excelRow, tabName){
  const saved = [ctx.currentRow, ctx.currentRowVintage, ctx.currentHelper];
  ctx.currentRow = null; ctx.currentRowVintage = null; ctx.currentHelper = null;
  const ref = operandRef(hop.canvasId, port.edge.from, hop.vIndex - 1, ctx, tabName, outerPath, port.edge.fromPort);
  [ctx.currentRow, ctx.currentRowVintage, ctx.currentHelper] = saved;
  ctx.currentRow = excelRow;
  const idx = indexIntoRowRange(ref, hop.vIndex - 1, ctx);
  ctx.currentRow = saved[0];
  return idx || ref;
}

function operandRef(canvasId, nodeId, periodIndex, ctx, currentTabName, path, fromPort){
  path = path || [];
  const node = ctx.nodeById[canvasId + '|' + nodeId];
  if(!node) return '0';

  if(node.type === 'blockInstance'){
    const defCanvasId = node.blockDefCanvasId;
    const defCanvas = defCanvasId && ctx.canvasById[defCanvasId];
    if(!defCanvas || fromPort === undefined) return '0';
    const outNode = blockOutputPortNode(defCanvas, fromPort);
    if(!outNode) return '0';
    const childPath = path.concat([{ canvasId, nodeId }]);
    return operandRef(defCanvasId, outNode.id, periodIndex, ctx, currentTabName, childPath);
  }

  // A node that's provably vintage-invariant (isVintageVarying === false) was only
  // ever given ONE row, keyed with its hop's vIndex stripped (see collectInstanceRows
  // / buildVerticalCombinedFormula's "verticalShared" rows) — so a reference reached
  // from INSIDE a specific vintage's run must resolve to that same shared identity,
  // not to a (nonexistent) per-vintage row of its own.
  const rowPath = resolvedRowPath(canvasId, nodeId, path, ctx);
  const key = pathKey(rowPath, canvasId, nodeId);
  if(ctx.inlineConstantIds && ctx.inlineConstantIds.has(key)){
    if(ctx.onRef) ctx.onRef(key, !!ctx.lagDepth); // dependency tracing for row sorting (see rowDependencyTracer)
    const lit = effectiveLiteral(node, periodIndex);
    return lit !== null ? formatLiteralForFormula(lit) : '0';
  }
  if(node.type === 'operator') return buildOperatorFormula(canvasId, node, periodIndex, ctx, currentTabName, path);
  if(node.type === 'alias'){
    if(!node.sourceCanvasId || !node.sourceNodeId) return '0';
    // An alias source on the SAME canvas as the current context stays inside the
    // current instance (same path); a source on a DIFFERENT canvas is an
    // unambiguous escape back to that canvas's own single, global identity —
    // aliases always address a literal node by id, never a per-instance copy.
    const nextPath = (node.sourceCanvasId === canvasId) ? path : [];
    return operandRef(node.sourceCanvasId, node.sourceNodeId, periodIndex, ctx, currentTabName, nextPath);
  }
  if(node.type === 'periodShift'){
    const canvas = ctx.canvasById[canvasId];
    const incoming = canvas ? canvas.edges.filter(e => e.to === node.id) : [];
    if(incoming.length !== 1) return '0';
    const offset = (typeof node.shift === 'number') ? node.shift : -1;
    const targetPeriod = periodIndex + offset;
    // Outside the timeline. A row whose own formula would read this shows its typed number
    // or 0 instead (reachesOutsideTimeline in buildCellContent), so this is only reached
    // inside an iferror's first input — where fmIDE falls back to the second input, so it
    // must be an error for IFERROR to catch — or through a block's input port.
    if(targetPeriod < 0 || targetPeriod >= ctx.periodCount) return ctx.iferrorDepth ? 'NA()' : '0';
    // lagDepth > 0 marks every reference reached through a period shift as a prior-/
    // later-period one — only consulted by the row sorter (a corkscrew's shifted link is
    // not a same-period dependency); generation never reads it.
    ctx.lagDepth = (ctx.lagDepth || 0) + 1;
    try{ return operandRef(canvasId, incoming[0].from, targetPeriod, ctx, currentTabName, path, incoming[0].fromPort); }
    finally{ ctx.lagDepth--; }
  }
  // "Vertical Index" port (fmIDE's Vertical Block feature): resolves to the current
  // vintage/run's own 1-based index as a literal, constant across every period column
  // in that run — never a cell reference, since it isn't wired to anything upstream.
  // Falls back to 1 outside a vertical run's path (e.g. this canvas rendered
  // standalone), mirroring "unbound Block input ports default to 0"-style graceful
  // fallbacks elsewhere in this file rather than erroring.
  if(node.blockRole === 'index'){
    const hop = path.length > 0 ? path[path.length - 1] : null;
    const v = (hop && typeof hop.vIndex === 'number') ? hop.vIndex : 1;
    // While writing a per-vintage row, its own Vintage cell holds exactly this v — refer
    // to it (fixed column, relative row) instead of typing the number into the formula.
    if(ctx.currentRow && ctx.currentRowVintage === v) return '$' + VINTAGE_COL + ctx.currentRow;
    return formatLiteralForFormula(v);
  }
  // A port nothing feeds has its own row (see classifyUnpackedNode): it resolves below
  // like any input rectangle instead.
  if(node.blockRole === 'input' && path.length > 0 && !isUnfedBlockInput(ctx.canvasById, path, ctx.canvasById[canvasId], node)){
    const outerHop = path[path.length - 1];
    const outerPath = path.slice(0, -1);
    const outerCanvas = ctx.canvasById[outerHop.canvasId];
    const defCanvas = ctx.canvasById[canvasId];
    const portIndex = blockInputPortIndex(defCanvas, node);
    const edge = outerCanvas && outerCanvas.edges.find(e => e.to === outerHop.nodeId && e.toPort === portIndex);
    if(!edge) return '0';
    // Inside a vertical instance's vintage/run v, a port whose feeding edge is marked
    // `verticalIndexed` is pinned to its source's value AT PERIOD (v-1) for every
    // column of this run, instead of following whichever period is currently being
    // computed — this is what lets e.g. a per-vintage Capex/Life series feed a fixed
    // value into the whole schedule for that vintage. A non-indexed port (or a
    // non-vertical instance) keeps the existing per-column pass-through unchanged.
    const pinned = typeof outerHop.vIndex === 'number' && edge.verticalIndexed;
    const effectivePeriodIndex = pinned ? (outerHop.vIndex - 1) : periodIndex;
    const ref = operandRef(outerHop.canvasId, edge.from, effectivePeriodIndex, ctx, currentTabName, outerPath, edge.fromPort);
    // Pinned read inside a per-vintage row: when the source resolves to a plain cell in
    // that period's column, write it as INDEX(<the source row's period range>, $C<row>)
    // — "this vintage's period" — so every vintage row carries the same formula instead
    // of a hard-wired column. Anything else (an inlined formula, a literal, a period-
    // shifted read) keeps the direct reference.
    if(pinned && ctx.currentRow && ctx.currentRowVintage === outerHop.vIndex){
      // This row's own helper cell ("<input> @ vintage") already holds exactly this value.
      const h = ctx.currentHelper;
      if(h && h.hopCanvasId === outerHop.canvasId && h.hopNodeId === outerHop.nodeId && h.slotByPort[portIndex] !== undefined){
        return '$' + helperCol(h.slotByPort[portIndex]) + ctx.currentRow;
      }
      const idx = indexIntoRowRange(ref, effectivePeriodIndex, ctx);
      if(idx) return idx;
    }
    return ref;
  }
  if(ctx.onRef) ctx.onRef(key, !!ctx.lagDepth); // dependency tracing for row sorting (see rowDependencyTracer)
  const pos = ctx.cellPos[key];
  if(!pos) return '0';
  const col = colLetter(periodCol(periodIndex));
  // Inside a per-vintage row, a reference to a row of the SAME vintage stays relative
  // (each line item's vintages sit in parallel runs, so the offset is the same for every
  // vintage); a reference to anything else — a shared row, another tab, a total — gets
  // an absolute row, so the formula is identical all the way down the vintage block.
  const absRow = ctx.currentRowVintage != null && pathKey(rowPath, '', '') !== ctx.currentRowHopsKey;
  return sheetRef(pos.tabName, col, pos.row, currentTabName, absRow);
}
// Comparison operators produce Excel's native TRUE/FALSE (e.g. =ABS(C8)<=C9), not an
// IF(...,1,0) wrapper. Two Excel behaviors make a TRUE/FALSE cell differ from fmIDE's
// 1/0 when it's read somewhere else, and only there does a reference get N() (which
// turns TRUE/FALSE into 1/0):
//   - SUM / MIN / MAX / AVERAGE / PRODUCT silently SKIP logical values read from a cell
//     (min/max/ave operators here, and a vertical block's reducer row);
//   - a comparison ranks any logical value above every number (TRUE > 1000 is TRUE).
// Plain arithmetic (+ − × ÷ ^ MOD ABS) already treats TRUE as 1, so it's left alone.
const COMPARISON_SYMBOLS = new Set(['≤', '≥', '<', '>']);

// True if what an edge from nodeId reads is a comparison's TRUE/FALSE — looking through
// value rectangles fed by a single edge, aliases, period shifts, and block ports, the
// same inlining operandRef does. A vertical instance's output is its reducer row, which
// is always numeric (see buildVerticalCombinedFormula). Conservative: anything unclear
// is treated as numeric (no N() added), which is exactly the previous behavior.
function isLogicalValued(canvasId, nodeId, ctx, path, fromPort, visiting){
  path = path || [];
  visiting = visiting || new Set();
  const vKey = pathKey(path, canvasId, nodeId) + '#' + (fromPort === undefined ? '' : fromPort);
  if(visiting.has(vKey)) return false;
  visiting.add(vKey);
  const node = ctx.nodeById[canvasId + '|' + nodeId];
  if(!node) return false;
  const canvas = ctx.canvasById[canvasId];
  if(node.type === 'operator') return COMPARISON_SYMBOLS.has(node.text);
  if(node.type === 'alias'){
    if(!node.sourceCanvasId || !node.sourceNodeId) return false;
    return isLogicalValued(node.sourceCanvasId, node.sourceNodeId, ctx, node.sourceCanvasId === canvasId ? path : [], undefined, visiting);
  }
  if(node.type === 'periodShift'){
    const inc = canvas ? canvas.edges.filter(e => e.to === node.id) : [];
    return inc.length === 1 && isLogicalValued(canvasId, inc[0].from, ctx, path, inc[0].fromPort, visiting);
  }
  if(node.type === 'blockInstance'){
    if(node.vertical) return false;
    const defCanvas = node.blockDefCanvasId && ctx.canvasById[node.blockDefCanvasId];
    const outNode = defCanvas && fromPort !== undefined ? blockOutputPortNode(defCanvas, fromPort) : null;
    return !!outNode && isLogicalValued(node.blockDefCanvasId, outNode.id, ctx, path.concat([{ canvasId, nodeId }]), undefined, visiting);
  }
  if(node.type !== 'value' || node.blockRole === 'index') return false;
  if(ctx.inlineConstantIds && ctx.inlineConstantIds.has(pathKey(resolvedRowPath(canvasId, nodeId, path, ctx), canvasId, nodeId))) return false;
  if(node.blockRole === 'input' && path.length > 0 && !isUnfedBlockInput(ctx.canvasById, path, canvas, node)){
    const hop = path[path.length - 1];
    const outerCanvas = ctx.canvasById[hop.canvasId];
    const edge = outerCanvas && outerCanvas.edges.find(e => e.to === hop.nodeId && e.toPort === blockInputPortIndex(canvas, node));
    return !!edge && isLogicalValued(hop.canvasId, edge.from, ctx, path.slice(0, -1), edge.fromPort, visiting);
  }
  const inc = canvas ? canvas.edges.filter(e => e.to === node.id) : [];
  return inc.length === 1 && isLogicalValued(canvasId, inc[0].from, ctx, path, inc[0].fromPort, visiting);
}

function buildOperatorFormula(canvasId, opNode, periodIndex, ctx, currentTabName, path){
  path = path || [];
  const canvas = ctx.canvasById[canvasId];
  const incoming = canvas.edges.filter(e => e.to === opNode.id)
    .map(e => ({ edge: e, from: ctx.nodeById[canvasId + '|' + e.from] }))
    .filter(x => x.from)
    .sort((a, b) => (a.from.x - b.from.x) || (a.from.y - b.from.y));
  const sym = opNode.text;
  const needsNumeric = sym === 'min' || sym === 'max' || sym === 'ave' || COMPARISON_SYMBOLS.has(sym);
  const operandStrs = incoming.map((x, i) => {
    // An iferror's first input is where a failure is caught (see the period-shift branch of operandRef).
    const catches = sym === 'iferror' && i === 0;
    if(catches) ctx.iferrorDepth = (ctx.iferrorDepth || 0) + 1;
    let ref;
    try{ ref = operandRef(canvasId, x.from.id, periodIndex, ctx, currentTabName, path, x.edge.fromPort); }
    finally{ if(catches) ctx.iferrorDepth--; }
    return (needsNumeric && ref !== '0' && isLogicalValued(canvasId, x.from.id, ctx, path, x.edge.fromPort)) ? 'N(' + ref + ')' : ref;
  });
  if(operandStrs.length === 0) return '0';
  // An error, as fmIDE shows "?": abs takes exactly one input, a comparison at least two.
  if(sym === 'abs') return operandStrs.length === 1 ? 'ABS(' + operandStrs[0] + ')' : 'NA()';
  if(sym === 'min') return 'MIN(' + operandStrs.join(',') + ')';
  if(sym === 'max') return 'MAX(' + operandStrs.join(',') + ')';
  if(sym === 'ave') return 'AVERAGE(' + operandStrs.join(',') + ')';
  if(sym === 'iferror') return 'IFERROR(' + operandStrs[0] + ',' + (operandStrs[1] !== undefined ? operandStrs[1] : '0') + ')';
  const infix = { '+': '+', '−': '-', '×': '*', '÷': '/', '^': '^' }[sym];
  if(infix) return '(' + operandStrs.reduce((acc, s, i) => i === 0 ? s : acc + infix + s) + ')';
  if(sym === '%') return operandStrs.reduce((acc, s, i) => i === 0 ? s : 'MOD(' + acc + ',' + s + ')');
  const cmp = { '≤': '<=', '≥': '>=', '<': '<', '>': '>' }[sym];
  if(cmp){
    // Native TRUE/FALSE. Parenthesized so it stays a single operand wherever it's
    // inlined into a bigger formula; buildCellContent strips nothing, and Excel shows
    // =(A<=B) identically to =A<=B.
    if(operandStrs.length === 1) return 'NA()';
    if(operandStrs.length === 2) return '(' + operandStrs[0] + cmp + operandStrs[1] + ')';
    const pairs = operandStrs.slice(0, -1).map((s, i) => s + cmp + operandStrs[i + 1]);
    return 'AND(' + pairs.join(',') + ')';
  }
  return '0';
}
function buildCellContent(canvasId, node, periodIndex, ctx, currentTabName, path){
  path = path || [];
  const canvas = ctx.canvasById[canvasId];
  if(node.type === 'value'){
    const incoming = canvas.edges.filter(e => e.to === node.id);
    const effectiveInput = isInputRectangle(canvas, node); // includes "fed by an operator fed by nothing"

    // Mirrors fmIDE's own "Value-node priority fixed" rule: a rectangle with a single
    // incoming edge is ALWAYS driven by that edge, regardless of any number typed into
    // the rectangle or any periodValues array it happens to carry — periodValues is only
    // ever meaningful for a genuine input (no incoming edge; see below), and a stale
    // array left over from before the rectangle was wired up must not silently override
    // its live formula. The one carve-out is literalPeriods: a rectangle can explicitly
    // mark specific periods to use its own typed literal instead (e.g. a corkscrew's
    // period-0 opening balance), which is checked here regardless of edge presence.
    if(incoming.length === 1 && !effectiveInput){
      const restrictedToLiteral = Array.isArray(node.literalPeriods) && node.literalPeriods.includes(periodIndex);
      if(restrictedToLiteral){
        const { literal } = parseNodeText(node.text);
        if(literal !== null) return { isFormula: false, value: literal };
      }
      // src can be an operator, an alias, a period-shift node, a block instance, or
      // another value rectangle — operandRef inlines through all of them uniformly.
      const src = ctx.nodeById[canvasId + '|' + incoming[0].from];
      // Where the source would need a period outside the timeline (a corkscrew's opening
      // balance in period 1), the rectangle's own typed number applies, or 0 — the shared
      // rule fmIDE follows too.
      if(src && reachesOutsideTimeline(id => ctx.canvasById[id], canvasId, src.id, periodIndex, ctx.periodCount)){
        const lit = effectiveLiteral(node, periodIndex);
        return { isFormula: false, value: lit !== null ? lit : 0 };
      }
      if(src) return { isFormula: true, formula: operandRef(canvasId, src.id, periodIndex, ctx, currentTabName, path, incoming[0].fromPort) };
      return { isFormula: false, value: null };
    }

    // No single incoming edge — either a genuine input (0 edges) or a broken/ambiguous
    // state (2+ edges). periodValues and the typed literal (gated by literalPeriods, same
    // as before) apply only here.
    const lit = effectiveLiteral(node, periodIndex);
    if(lit !== null) return { isFormula: false, value: lit };
    // A true input (no incoming edge at all) with nothing typed in yet — default to 0
    // rather than leaving the cell blank, so downstream formulas never hit an empty
    // string. A node with more than one incoming edge is a genuinely broken/ambiguous
    // state rather than "an input with no value", so that's left blank instead.
    if(incoming.length === 0 || effectiveInput) return { isFormula: false, value: 0 };
    return { isFormula: false, value: null };
  }
  // Operators, aliases, and period-shift nodes never reach here as a row's own node —
  // classifyNode excludes them from getting rows, and operandRef inlines them wherever
  // something else points at them. This fallback only covers a stray/unexpected type.
  return { isFormula: false, value: null };
}
// build:include shared/input-rule.js

function classifyNode(canvas, node){
  // Operators, block instances, aliases, and period-shift nodes never get their own row:
  // operators and now aliases/period-shift nodes are always inlined into the formula of
  // whatever references them (see operandRef) instead of occupying a row of their own.
  if(node.type === 'operator' || node.type === 'blockInstance' || node.type === 'alias' || node.type === 'periodShift') return null;
  // A block's "Vertical Index" rectangle never gets a row either: inside a vertical
  // instance it's the row's own Vintage cell (column C); anywhere else it resolves to
  // the literal 1 (see operandRef), so a row of its own would only show a misleading value.
  if(node.blockRole === 'index') return null;
  const hasIncoming = canvas.edges.some(e => e.to === node.id);
  const hasOutgoing = canvas.edges.some(e => e.from === node.id);
  if(!hasIncoming || isInputRectangle(canvas, node)) return 'input';
  if(!hasOutgoing) return 'output';
  return 'calc';
}

