(function(){
'use strict';

// ============================================================
// Core translation: the model's calculation comes from the shared IR (src/shared/ir.js,
// compileModel — the same one fmIDE calculates on), with the shared operator catalogue and
// units; this file turns it into Excel formulas.
// ============================================================

// build:include shared/operators.js
// build:include shared/uom.js
// build:include shared/input-rule.js
// build:include shared/ir.js

// The loaded model's IR (compileModel), set by loadModel. Every question about the graph —
// what feeds what, in which order, block ports, plug-to-socket links, units — is asked of
// it; the layout's `model.canvases` are its canvases as the calculation sees them.
let modelIR = null;
function irCanvas(canvasId){ return modelIR ? modelIR.canvases.get(canvasId) : undefined; }
function irNode(canvasId, nodeId){ return modelIR ? irNodeIn(modelIR, canvasId, nodeId) : undefined; }
// The block-instance hops of a row path, as the IR reads them (a vintage doesn't change units).
function irPath(path){ return (path || []).map(h => ({ canvasId: h.canvasId, nodeId: h.nodeId })); }

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
  const hostNodeForHop = irNode(hop.canvasId, hop.nodeId);
  if(!hostNodeForHop || !hostNodeForHop.vertical) return path;
  if(isVintageVarying(hop.canvasId, hostNodeForHop, canvasId, nodeId, new Set())) return path;
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
  const host = irNode(hostCanvasId, hostNodeId);
  const def = host && host.blockDefCanvasId && irCanvas(host.blockDefCanvasId);
  if(!host || !host.vertical || !def) return [];
  return def.ports.inputs.map((portNode, portIndex) => {
    const edge = irPortEdge(modelIR, hostCanvasId, hostNodeId, portIndex);
    return edge && edge.verticalIndexed ? { portIndex, edge, name: parseRectText(portNode.node.text).name || ('Input ' + (portIndex + 1)) } : null;
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

// True if the block instance whose output `path` is about to enter (definition `defId`) is
// already one of the instances on the path: a block that contains itself. fmIDE shows "?"
// there (block-cycle); the formula reads 0, and the check before download lists it.
function pathEntersItself(path, defId){
  return path.some(h => { const inst = irNode(h.canvasId, h.nodeId); return !!inst && inst.blockDefCanvasId === defId; });
}

function operandRef(canvasId, nodeId, periodIndex, ctx, currentTabName, path, fromPort){
  path = path || [];
  const n = irNode(canvasId, nodeId);
  if(!n) return '0';
  const node = n.node;

  if(n.type === 'blockInstance'){
    const def = n.blockDefCanvasId && irCanvas(n.blockDefCanvasId);
    if(!def || fromPort === undefined) return '0';
    const outNode = def.ports.outputs[fromPort];
    if(!outNode || pathEntersItself(path, def.id)) return '0';
    const childPath = path.concat([{ canvasId, nodeId }]);
    return operandRef(def.id, outNode.id, periodIndex, ctx, currentTabName, childPath);
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
  // Operators, aliases and period shifts are written inline. A loop made only of them (no
  // rectangle with a row of its own to break it) would never end: it reads 0 instead —
  // fmIDE shows "?" (a loop), and the check before download lists it.
  const inline = n.type === 'operator' || n.type === 'alias' || n.type === 'periodShift';
  const loopKey = inline ? key + '@' + periodIndex : null;
  if(inline){
    if(!ctx.inlining) ctx.inlining = new Set();
    if(ctx.inlining.has(loopKey)) return '0';
    ctx.inlining.add(loopKey);
  }
  try{
    if(n.type === 'operator') return buildOperatorFormula(canvasId, n, periodIndex, ctx, currentTabName, path);
    if(n.type === 'alias'){
      if(!n.sourceCanvasId || !n.sourceNodeId) return '0';
      // An alias source on the SAME canvas as the current context stays inside the
      // current instance (same path); a source on a DIFFERENT canvas is an
      // unambiguous escape back to that canvas's own single, global identity —
      // aliases always address a literal node by id, never a per-instance copy.
      const nextPath = (n.sourceCanvasId === canvasId) ? path : [];
      return operandRef(n.sourceCanvasId, n.sourceNodeId, periodIndex, ctx, currentTabName, nextPath);
    }
    if(n.type === 'periodShift'){
      if(n.incoming.length !== 1) return '0';
      const targetPeriod = periodIndex + n.offset;
      // Outside the timeline. A row whose own formula would read this shows its typed number
      // or 0 instead (reachesOutsideTimeline in buildCellContent; a block's input port does
      // the same), so this is only reached inside an iferror's first input — where fmIDE
      // falls back to the second input, so it must be an error for IFERROR to catch.
      if(targetPeriod < 0 || targetPeriod >= ctx.periodCount) return ctx.iferrorDepth ? 'NA()' : '0';
      // lagDepth > 0 marks every reference reached through a period shift as a prior-/
      // later-period one — only consulted by the row sorter (a corkscrew's shifted link is
      // not a same-period dependency); generation never reads it.
      ctx.lagDepth = (ctx.lagDepth || 0) + 1;
      try{ return operandRef(canvasId, n.incoming[0].from, targetPeriod, ctx, currentTabName, path, n.incoming[0].fromPort); }
      finally{ ctx.lagDepth--; }
    }
  } finally {
    if(inline) ctx.inlining.delete(loopKey);
  }
  // "Vertical Index" port (fmIDE's Vertical Block feature): resolves to the current
  // vintage/run's own 1-based index as a literal, constant across every period column
  // in that run — never a cell reference, since it isn't wired to anything upstream.
  // Falls back to 1 outside a vertical run's path (e.g. this canvas rendered
  // standalone), mirroring "unbound Block input ports default to 0"-style graceful
  // fallbacks elsewhere in this file rather than erroring.
  if(n.blockRole === 'index'){
    const hop = path.length > 0 ? path[path.length - 1] : null;
    const v = (hop && typeof hop.vIndex === 'number') ? hop.vIndex : 1;
    // While writing a per-vintage row, its own Vintage cell holds exactly this v — refer
    // to it (fixed column, relative row) instead of typing the number into the formula.
    if(ctx.currentRow && ctx.currentRowVintage === v) return '$' + VINTAGE_COL + ctx.currentRow;
    return formatLiteralForFormula(v);
  }
  // A port nothing feeds has its own row (see classifyUnpackedNode): it resolves below
  // like any input rectangle instead.
  if(n.blockRole === 'input' && path.length > 0 && !irPortUnfed(modelIR, path, canvasId, n)){
    const outerHop = path[path.length - 1];
    const outerPath = path.slice(0, -1);
    const portIndex = irCanvas(canvasId).ports.inputs.indexOf(n);
    const edge = irPortEdge(modelIR, outerHop.canvasId, outerHop.nodeId, portIndex);
    if(!edge) return '0';
    // Inside a vertical instance's vintage/run v, a port whose feeding edge is marked
    // `verticalIndexed` is pinned to its source's value AT PERIOD (v-1) for every
    // column of this run, instead of following whichever period is currently being
    // computed — this is what lets e.g. a per-vintage Capex/Life series feed a fixed
    // value into the whole schedule for that vintage. A non-indexed port (or a
    // non-vertical instance) keeps the existing per-column pass-through unchanged.
    const pinned = typeof outerHop.vIndex === 'number' && edge.verticalIndexed;
    const effectivePeriodIndex = pinned ? (outerHop.vIndex - 1) : periodIndex;
    // Where what feeds the port needs a period outside the timeline, the port's own typed
    // number applies, or 0 — as fmIDE does, and as for any wired rectangle.
    if(reachesOutsideTimeline(irRawCanvas, outerHop.canvasId, edge.from, effectivePeriodIndex, ctx.periodCount)){
      const lit = effectiveLiteral(node, periodIndex);
      return formatLiteralForFormula(lit !== null ? lit : 0);
    }
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
  if(!pos){
    // A rectangle whose row was left out of the layout: the formula reads 0 (the check
    // before download lists it).
    if(ctx.onMissingRow) ctx.onMissingRow(key);
    return '0';
  }
  const col = colLetter(periodCol(periodIndex));
  // Inside a per-vintage row, a reference to a row of the SAME vintage stays relative
  // (each line item's vintages sit in parallel runs, so the offset is the same for every
  // vintage); a reference to anything else — a shared row, another tab, a total — gets
  // an absolute row, so the formula is identical all the way down the vintage block.
  const absRow = ctx.currentRowVintage != null && pathKey(rowPath, '', '') !== ctx.currentRowHopsKey;
  return sheetRef(pos.tabName, col, pos.row, currentTabName, absRow);
}
// A canvas as the calculation sees it ({ nodes, edges }), for the shared rules that read a
// whole canvas.
function irRawCanvas(canvasId){ const c = irCanvas(canvasId); return c ? c.raw : undefined; }

// Comparison operators produce Excel's native TRUE/FALSE (e.g. =ABS(C8)<=C9), not an
// IF(...,1,0) wrapper. Two Excel behaviors make a TRUE/FALSE cell differ from fmIDE's
// 1/0 when it's read somewhere else, and only there does a reference get N() (which
// turns TRUE/FALSE into 1/0):
//   - SUM / MIN / MAX / AVERAGE / PRODUCT silently SKIP logical values read from a cell
//     (min/max/ave operators here, and a vertical block's reducer row);
//   - a comparison ranks any logical value above every number (TRUE > 1000 is TRUE).
// Plain arithmetic (+ − × ÷ ^ MOD ABS) already treats TRUE as 1, so it's left alone.
function isComparison(n){ return !!(n && n.op && EXCEL_SPELLINGS[n.op.id] && EXCEL_SPELLINGS[n.op.id].compare); }

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
  const n = irNode(canvasId, nodeId);
  if(!n) return false;
  if(n.type === 'operator') return isComparison(n);
  if(n.type === 'alias'){
    if(!n.sourceCanvasId || !n.sourceNodeId) return false;
    return isLogicalValued(n.sourceCanvasId, n.sourceNodeId, ctx, n.sourceCanvasId === canvasId ? path : [], undefined, visiting);
  }
  if(n.type === 'periodShift'){
    const inc = n.incoming;
    return inc.length === 1 && isLogicalValued(canvasId, inc[0].from, ctx, path, inc[0].fromPort, visiting);
  }
  if(n.type === 'blockInstance'){
    if(n.vertical) return false;
    const def = n.blockDefCanvasId && irCanvas(n.blockDefCanvasId);
    const outNode = def && fromPort !== undefined ? def.ports.outputs[fromPort] : null;
    return !!outNode && isLogicalValued(def.id, outNode.id, ctx, path.concat([{ canvasId, nodeId }]), undefined, visiting);
  }
  if(n.type !== 'value' || n.blockRole === 'index') return false;
  if(ctx.inlineConstantIds && ctx.inlineConstantIds.has(pathKey(resolvedRowPath(canvasId, nodeId, path, ctx), canvasId, nodeId))) return false;
  if(n.blockRole === 'input' && path.length > 0 && !irPortUnfed(modelIR, path, canvasId, n)){
    const hop = path[path.length - 1];
    const edge = irPortEdge(modelIR, hop.canvasId, hop.nodeId, irCanvas(canvasId).ports.inputs.indexOf(n));
    return !!edge && isLogicalValued(hop.canvasId, edge.from, ctx, path.slice(0, -1), edge.fromPort, visiting);
  }
  const inc = n.incoming;
  return inc.length === 1 && isLogicalValued(canvasId, inc[0].from, ctx, path, inc[0].fromPort, visiting);
}

// An operator's formula: its inputs left to right (the IR's order), spelled as
// EXCEL_SPELLINGS says for its catalogue id. An operator the catalogue doesn't know (only a
// hand-edited file has one) is written as 0; the check before download lists it.
function buildOperatorFormula(canvasId, opNode, periodIndex, ctx, currentTabName, path){
  path = path || [];
  const spell = opNode.op ? EXCEL_SPELLINGS[opNode.op.id] : null;
  const inputs = opNode.inputs;
  const needsNumeric = !!(spell && (spell.numeric || spell.compare));
  const operandStrs = inputs.map((edge, i) => {
    // An iferror's first input is where a failure is caught (see the period-shift branch of operandRef).
    const catches = !!(spell && spell.fallback) && i === 0;
    if(catches) ctx.iferrorDepth = (ctx.iferrorDepth || 0) + 1;
    let ref;
    try{ ref = operandRef(canvasId, edge.from, periodIndex, ctx, currentTabName, path, edge.fromPort); }
    finally{ if(catches) ctx.iferrorDepth--; }
    return (needsNumeric && ref !== '0' && isLogicalValued(canvasId, edge.from, ctx, path, edge.fromPort)) ? 'N(' + ref + ')' : ref;
  });
  if(operandStrs.length === 0 || !spell) return '0';
  return spellOperator(spell, operandStrs);
}

// One operator applied to its operands' formula text (at least one), as `spell` says.
function spellOperator(spell, operandStrs){
  // An error, as fmIDE shows "?": abs takes exactly one input, a comparison at least two.
  if(spell.one) return operandStrs.length === 1 ? spell.fn + '(' + operandStrs[0] + ')' : 'NA()';
  if(spell.fallback) return spell.fn + '(' + operandStrs[0] + ',' + (operandStrs[1] !== undefined ? operandStrs[1] : '0') + ')';
  if(spell.fn) return spell.fn + '(' + operandStrs.join(',') + ')';
  if(spell.infix) return '(' + operandStrs.reduce((acc, s, i) => i === 0 ? s : acc + spell.infix + s) + ')';
  if(spell.fold) return operandStrs.reduce((acc, s, i) => i === 0 ? s : spell.fold + '(' + acc + ',' + s + ')');
  if(spell.compare){
    // Native TRUE/FALSE. Parenthesized so it stays a single operand wherever it's
    // inlined into a bigger formula; Excel shows =(A<=B) identically to =A<=B.
    if(operandStrs.length === 1) return 'NA()';
    if(operandStrs.length === 2) return '(' + operandStrs[0] + spell.compare + operandStrs[1] + ')';
    const pairs = operandStrs.slice(0, -1).map((s, i) => s + spell.compare + operandStrs[i + 1]);
    return 'AND(' + pairs.join(',') + ')';
  }
  return '0';
}

function buildCellContent(canvasId, node, periodIndex, ctx, currentTabName, path){
  path = path || [];
  const n = irNode(canvasId, node.id);
  if(n && n.type === 'value'){
    const incoming = n.incoming;
    const effectiveInput = n.isInput; // includes "fed by an operator fed by nothing"

    // Mirrors fmIDE's own "Value-node priority fixed" rule: a rectangle with a single
    // incoming edge is ALWAYS driven by that edge, regardless of any number typed into
    // the rectangle or any periodValues array it happens to carry — periodValues is only
    // ever meaningful for a genuine input (no incoming edge; see below), and a stale
    // array left over from before the rectangle was wired up must not silently override
    // its live formula. The one carve-out is literalPeriods: a rectangle can explicitly
    // mark specific periods to use its own typed literal instead (e.g. a corkscrew's
    // period-0 opening balance), which is checked here regardless of edge presence.
    if(incoming.length === 1 && !effectiveInput){
      const restrictedToLiteral = Array.isArray(n.literalPeriods) && n.literalPeriods.includes(periodIndex);
      if(restrictedToLiteral && n.typed !== null) return { isFormula: false, value: n.typed };
      // src can be an operator, an alias, a period-shift node, a block instance, or
      // another value rectangle — operandRef inlines through all of them uniformly.
      const src = irNode(canvasId, incoming[0].from);
      // Where the source would need a period outside the timeline (a corkscrew's opening
      // balance in period 1), the rectangle's own typed number applies, or 0 — the shared
      // rule fmIDE follows too.
      if(src && reachesOutsideTimeline(irRawCanvas, canvasId, src.id, periodIndex, ctx.periodCount)){
        const lit = effectiveLiteral(n.node, periodIndex);
        return { isFormula: false, value: lit !== null ? lit : 0 };
      }
      if(src) return { isFormula: true, formula: operandRef(canvasId, src.id, periodIndex, ctx, currentTabName, path, incoming[0].fromPort) };
      return { isFormula: false, value: null };
    }

    // No single incoming edge — either a genuine input (0 edges) or a broken/ambiguous
    // state (2+ edges). periodValues and the typed literal (gated by literalPeriods, same
    // as before) apply only here.
    const lit = effectiveLiteral(n.node, periodIndex);
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

// True if `node` on `canvas` (a canvas of `model.canvases`) is an input rectangle — the
// shared input rule, as the IR worked it out.
function isInputNode(canvas, node){
  const n = canvas && node ? irNode(canvas.id, node.id) : null;
  return !!n && !!n.isInput;
}

function classifyNode(canvas, node){
  // Operators, block instances, aliases, and period-shift nodes never get their own row:
  // operators and now aliases/period-shift nodes are always inlined into the formula of
  // whatever references them (see operandRef) instead of occupying a row of their own.
  if(node.type === 'operator' || node.type === 'blockInstance' || node.type === 'alias' || node.type === 'periodShift') return null;
  // A block's "Vertical Index" rectangle never gets a row either: inside a vertical
  // instance it's the row's own Vintage cell (column C); anywhere else it resolves to
  // the literal 1 (see operandRef), so a row of its own would only show a misleading value.
  if(node.blockRole === 'index') return null;
  const n = irNode(canvas.id, node.id);
  const hasIncoming = !!n && n.incoming.length > 0;
  const hasOutgoing = !!n && n.outgoing.length > 0;
  if(!hasIncoming || (n && n.isInput)) return 'input';
  if(!hasOutgoing) return 'output';
  return 'calc';
}

