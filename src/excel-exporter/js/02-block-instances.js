// ============================================================
// Block-instance unpacking
//
// A blockInstance node's definition canvas holds real rectangles/operators (the
// block's "calculation logic"); we walk that graph and give each of its rectangles
// its own row, once per instance, exactly as if the definition canvas were inlined
// at that point — instead of leaving the instance as an opaque, unmapped node.
// "Live (shared-definition, independent-instance)" semantics are preserved: the
// SAME definition canvas/edges are walked for every instance (shared structure),
// but each instance gets its own physical rows and its own resolution of the
// block's Input ports (independent values), so two instances of the same block
// never collide or share a cell.
// ============================================================

// Canonical row-id / cellPos key for a node reached via a given instance path. An
// empty path reproduces the exact pre-existing "canvasId|nodeId" format, so normal
// (non-block) rows and any mapping already saved in browser storage are unaffected.
// A hop that belongs to a specific vintage/run of a VERTICAL block instance carries
// a `vIndex` (1-based); it's folded into the key so each vintage's copy of a node
// gets its own distinct row identity, while the hop with no vIndex stays the
// identity of the combined/reduced row (see collectInstanceRows) — exactly the same
// key a non-vertical instance's single copy would already use, so existing mappings
// and existing cross-instance references are completely unaffected.
function pathKey(path, canvasId, nodeId){
  const hops = (path || []).map(h => h.canvasId + ':' + h.nodeId + (typeof h.vIndex === 'number' ? ':v' + h.vIndex : '')).join('>>');
  return (hops ? hops + '>>' : '') + canvasId + '|' + nodeId;
}

// Like classifyNode, but used only while walking INSIDE a block definition during
// unpacking: a rectangle marked as a Block Input port is a pure pass-through to
// whatever feeds the instance's corresponding port (see operandRef) — it never
// gets its own row, the same treatment already given to an alias or period-shift
// node. A rectangle marked as a Block Output port is NOT special-cased here; it
// still gets a normal, auditable row like any other rectangle — only its
// cross-instance port identity (used when something OUTSIDE the block references
// it) is special. A rectangle marked as the block's "Vertical Index" port
// (blockRole 'index', fmIDE's Vertical Block feature) gets the same pass-through
// treatment as a Block Input — it never gets a row either; operandRef resolves it
// directly to the current vintage/run's 1-based index as a literal.
//
// Exception: a Block Input port that nothing feeds in this instance (isUnfedBlockInput)
// is a real input of the instance — it gets its own row holding the port's own typed
// number(s), as fmIDE uses them, and operandRef refers to that row.
function classifyUnpackedNode(canvas, node, path){
  if(node.blockRole === 'index') return null;
  if(node.blockRole === 'input') return path ? (isUnfedBlockInput(path, canvas, node) ? 'input' : null) : null;
  return classifyNode(canvas, node);
}

// True if `node`, a Block Input port of `defCanvas` reached through `path` (its last hop
// is the instance), is fed by nothing: no arrow into the instance's port, or one from
// something fed by nothing (feedsNothing — e.g. an operator with an empty socket). The
// IR's rule (irPortUnfed), which fmIDE's calculation follows too.
function isUnfedBlockInput(path, defCanvas, node){
  if(!node || node.blockRole !== 'input' || !path || !path.length) return false;
  const n = irNode(defCanvas.id, node.id);
  if(!n || !irCanvas(path[path.length - 1].canvasId)) return false;
  return irPortUnfed(modelIR, path, defCanvas.id, n);
}

// A block definition's ports, in the IR's order: its Block Input / Output rectangles left
// to right (x, then y) — the same order fmIDE reads them in. Raw nodes.
function blockPortNodes(defCanvas, role){
  const def = irCanvas(defCanvas.id);
  if(!def) return [];
  return (role === 'input' ? def.ports.inputs : def.ports.outputs).map(n => n.node);
}

// Recursively collects unpack rows for everything reachable from a block instance's
// definition canvas, including nested block instances (the path grows by one hop
// per level of nesting, via collectInstanceRows). `visitingDefIds` guards against a
// block directly or indirectly instantiating itself. `skipNodeIds`, when given, is a
// Set of node ids (within THIS SAME defCanvasId) to leave out entirely — used for a
// vertical instance's per-vintage walk, to avoid re-emitting a node that's already
// been given a single shared row (see collectInstanceRows / isVintageVarying).
function collectUnpackedRows(defCanvasId, pathPrefix, visitingDefIds, periodCount, skipNodeIds){
  const out = [];
  if(visitingDefIds.has(defCanvasId)) return out;
  const canvas = irRawCanvas(defCanvasId);
  if(!canvas) return out;
  const nextVisiting = new Set(visitingDefIds); nextVisiting.add(defCanvasId);
  canvas.nodes.forEach(n => {
    if(skipNodeIds && skipNodeIds.has(n.id)) return;
    if(n.type === 'blockInstance'){
      if(!n.blockDefCanvasId) return;
      out.push(...collectInstanceRows(pathPrefix, defCanvasId, n, nextVisiting, periodCount));
      return;
    }
    const section = classifyUnpackedNode(canvas, n, pathPrefix);
    if(section === null) return;
    out.push({ path: pathPrefix, canvasId: defCanvasId, nodeId: n.id, section });
  });
  return out;
}

// True if resolving `nodeId` (in `canvasId`) from INSIDE a vertical instantiation of
// `hostNode` (sitting on `hostCanvasId`) could differ from one vintage/run to
// another — i.e. its formula chain (through operators, aliases, period-shifts —
// everything operandRef already inlines) ever reaches the "Vertical Index" port
// (blockRole 'index'), or a Block Input port whose feeding edge (at hostCanvasId
// level) is marked `verticalIndexed`. A node for which this returns false computes
// the EXACT same formula/value regardless of which vintage it's evaluated for — see
// operandRef: the only two places a hop's `vIndex` is ever consulted are exactly
// these two cases — so such a node is safe to collapse to a single shared row
// instead of duplicating it once per vintage. Conservative (returns true, i.e. "keep
// this per-vintage") on anything unclear — a cycle, an unresolved edge, a nested
// block instance's own internals — so a row is only ever collapsed when it's
// actually provable to be vintage-invariant.
function isVintageVarying(hostCanvasId, hostNode, canvasId, nodeId, visiting){
  const key = canvasId + '|' + nodeId;
  if(visiting.has(key)) return true;
  const n = irNode(canvasId, nodeId);
  if(!n) return true;
  if(n.blockRole === 'index') return true;
  const nextVisiting = new Set(visiting); nextVisiting.add(key);
  if(n.type === 'operator' || n.type === 'periodShift' || n.type === 'function'){
    return n.incoming.some(e => isVintageVarying(hostCanvasId, hostNode, canvasId, e.from, nextVisiting));
  }
  if(n.type === 'alias'){
    if(!n.sourceCanvasId || !n.sourceNodeId) return false;
    return isVintageVarying(hostCanvasId, hostNode, n.sourceCanvasId, n.sourceNodeId, nextVisiting);
  }
  if(n.type === 'blockInstance') return true; // not analyzed — conservative
  if(n.type === 'value'){
    if(n.blockRole === 'input'){
      if(canvasId !== hostNode.blockDefCanvasId) return true; // only the immediate definition is analyzed
      const edge = irPortEdge(modelIR, hostCanvasId, hostNode.id, irCanvas(canvasId).ports.inputs.indexOf(n));
      if(!edge) return false; // unwired port defaults to a fixed literal (0) — invariant
      if(edge.verticalIndexed) return true;
      return isVintageVarying(hostCanvasId, hostNode, hostCanvasId, edge.from, nextVisiting);
    }
    if(n.incoming.length === 1) return isVintageVarying(hostCanvasId, hostNode, canvasId, n.incoming[0].from, nextVisiting);
    return false; // a true input (literal / periodValues only) — invariant
  }
  return true;
}

// Produces every unpacked row for ONE block instance — vertical or not — given the
// path prefix leading up to (but not including) this instance's own hop; the hop(s)
// for this instance are added here. `hostCanvasId`/`hostNode` identify the instance
// (the canvas it sits on, and its own blockInstance node).
//
// Non-vertical: unchanged from before — one hop, one full walk of the definition.
//
// Vertical (fmIDE's Vertical Block feature — see semantics notes): the definition is
// walked once per "vintage"/run v = 1..periodCount (the vertical axis is tied to the
// period count), each with its OWN hop carrying `vIndex: v` — a distinct row per
// node per vintage, exactly like a real vintage/waterfall schedule. Inside a v-tagged
// run: a Block Input port whose feeding edge is marked `verticalIndexed` resolves to
// its source pinned at period (v-1) for every column, instead of following the
// column's own period (see operandRef); a rectangle with blockRole 'index' (the
// "Vertical Index") resolves to the literal v. Additionally, for every Block Output
// port of the definition, ONE extra "combined" row is emitted using the hop WITHOUT
// a vIndex — the same identity a non-vertical instance's output row would use, so a
// reference to this instance's output from outside the block (operandRef's
// `blockInstance` branch, unchanged) keeps resolving exactly where it always has.
// That combined row's actual formula (reducing the v=1..periodCount rows via the
// output's verticalReducer, default sum) is built separately at generation time
// (see buildVerticalCombinedFormula) — collectInstanceRows only records that the row
// exists and is a reducer (`verticalCombined: true`). Any other internal node that's
// provably the same in every vintage (isVintageVarying) also gets just ONE row
// (`verticalShared: true`) instead of N identical duplicates.
function collectInstanceRows(pathPrefixOuter, hostCanvasId, hostNode, visitingDefIds, periodCount){
  const out = [];
  if(!hostNode.blockDefCanvasId) return out;
  const defCanvas = irRawCanvas(hostNode.blockDefCanvasId);
  if(!defCanvas) return out;
  if(hostNode.vertical){
    const combinedPath = pathPrefixOuter.concat([{ canvasId: hostCanvasId, nodeId: hostNode.id }]);
    blockPortNodes(defCanvas, 'output').forEach(outNode => {
      out.push({
        path: combinedPath, canvasId: hostNode.blockDefCanvasId, nodeId: outNode.id,
        section: classifyUnpackedNode(defCanvas, outNode) || 'output', verticalCombined: true
      });
    });
    // Any other top-level node in the definition (not a nested block instance, not a
    // Block Output port — those are always handled above, unconditionally) that's
    // provably vintage-invariant (see isVintageVarying) gets ONE shared row instead
    // of being duplicated once per vintage — e.g. a plain per-period reference value
    // that never touches the Vertical Index or an indexed input. Uses the same
    // no-vIndex hop as the combined rows, so toggling `vertical` on/off later keeps
    // this row's identity stable. `skipNodeIds` then keeps the per-vintage walk below
    // from re-emitting these nodes.
    const skipNodeIds = new Set();
    defCanvas.nodes.forEach(dn => {
      if(dn.type === 'blockInstance' || dn.blockRole === 'output') return;
      if(classifyUnpackedNode(defCanvas, dn, combinedPath) === null) return;
      if(!isVintageVarying(hostCanvasId, hostNode, hostNode.blockDefCanvasId, dn.id, new Set())){
        skipNodeIds.add(dn.id);
        out.push({
          path: combinedPath, canvasId: hostNode.blockDefCanvasId, nodeId: dn.id,
          section: classifyUnpackedNode(defCanvas, dn, combinedPath), verticalShared: true
        });
      }
    });
    const n = Math.max(1, periodCount || 1);
    for(let v = 1; v <= n; v++){
      const vPath = pathPrefixOuter.concat([{ canvasId: hostCanvasId, nodeId: hostNode.id, vIndex: v }]);
      out.push(...collectUnpackedRows(hostNode.blockDefCanvasId, vPath, visitingDefIds, periodCount, skipNodeIds)
        .map(u => Object.assign({}, u, { verticalVintage: v })));
    }
  } else {
    const path = pathPrefixOuter.concat([{ canvasId: hostCanvasId, nodeId: hostNode.id }]);
    out.push(...collectUnpackedRows(hostNode.blockDefCanvasId, path, visitingDefIds, periodCount));
  }
  return out;
}

// Excel reducer functions for a vertical block instance's output ports, keyed by
// fmIDE's own `verticalReducer` node property — 'sum' is the documented default.
const VERTICAL_REDUCER_EXCEL_FN = { sum: 'SUM', max: 'MAX', min: 'MIN', ave: 'AVERAGE', average: 'AVERAGE', product: 'PRODUCT' };

// Builds the formula for a vertical block instance's combined/reduced output row at
// a given period column: REDUCER(ref to vintage 1's row at this column, vintage 2's, …).
// `path` is the combined row's own path (its last hop has no vIndex); each vintage's
// row is looked up by re-adding `vIndex: v` to that same hop and re-deriving its
// pathKey, exactly matching how collectInstanceRows constructed those rows' ids —
// so this never needs to duplicate the per-vintage row-collection logic. A vintage
// whose row was since excluded/deleted from the mapping (cellPos lookup misses) is
// simply skipped rather than erroring, so the reducer degrades gracefully instead of
// producing a broken formula.
function buildVerticalCombinedFormula(canvasId, node, periodIndex, ctx, currentTabName, path){
  const p = path || [];
  const lastHop = p[p.length - 1];
  const outerPath = p.slice(0, -1);
  const n = Math.max(1, ctx.periodCount || 1);
  const col = colLetter(periodCol(periodIndex));
  const refs = [];
  const positions = [];
  // SUM/MAX/… skip TRUE/FALSE read from cells — a flag-valued output (e.g. a per-vintage
  // check) is counted as 1/0 instead, matching fmIDE.
  const logical = isLogicalValued(canvasId, node.id, ctx, outerPath.concat([Object.assign({}, lastHop, { vIndex: 1 })]));
  for(let v = 1; v <= n; v++){
    const vHop = Object.assign({}, lastHop, { vIndex: v });
    const key = pathKey(outerPath.concat([vHop]), canvasId, node.id);
    if(ctx.onRef) ctx.onRef(key, !!ctx.lagDepth);
    const pos = rowPosFor(key, currentTabName, ctx);
    if(!pos) continue;
    const r = sheetRef(pos.tabName, col, pos.row, currentTabName);
    positions.push(pos);
    refs.push(logical ? 'N(' + r + ')' : r);
  }
  if(refs.length === 0) return '0';
  const fn = VERTICAL_REDUCER_EXCEL_FN[node.verticalReducer] || 'SUM';
  // Vintage rows 1..N sitting in one contiguous run on one sheet -> a plain range.
  if(!logical && positions.length === refs.length && positions.length > 1 &&
     positions.every((q, i) => q.tabName === positions[0].tabName && q.row === positions[0].row + i)){
    const p0 = positions[0], pl = positions[positions.length - 1];
    const a = sheetRef(p0.tabName, col, p0.row, currentTabName), z = col + pl.row;
    return fn + '(' + a + ':' + z + ')';
  }
  return fn + '(' + refs.join(',') + ')';
}

// Every blockInstance node anywhere in the model, as an unpack root (nested
// instances are discovered by collectUnpackedRows itself, not listed here too).
function findAllBlockInstances(model){
  const result = [];
  model.canvases.forEach(c => c.nodes.forEach(n => {
    if(n.type === 'blockInstance') result.push({ hostCanvasId: c.id, hostNode: n });
  }));
  return result;
}
function numberFormatToExcel(style, fallback){
  const nf = style && style.numberFormat;
  if(!nf || !nf.kind || nf.kind === 'general') return fallback || 'General';
  const decimals = typeof nf.decimals === 'number' ? nf.decimals : 2;
  const zeros = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
  if(nf.kind === 'number') return '#,##0' + zeros;
  if(nf.kind === 'percent') return '0' + zeros + '%';
  if(nf.kind === 'currency') return '"' + (nf.currencySymbol || '$') + '"#,##0' + zeros;
  return fallback || 'General';
}

