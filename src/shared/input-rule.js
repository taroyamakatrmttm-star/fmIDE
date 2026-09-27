// ---------- input-rectangle rule (shared: src/shared/input-rule.js, used by both apps) ----------
// `canvas` is { nodes, edges }.
// True if nothing actually feeds `nodeId`: an operator (or period shift) whose every input
// is itself fed by nothing — including one with no inputs at all, like a socket operator
// with nothing plugged into it. Aliases, rectangles and block instances always count as a
// real source.
function feedsNothing(canvas, nodeId, visiting){
  if(visiting.has(nodeId)) return false;
  visiting.add(nodeId);
  const n = canvas.nodes.find(x => x.id === nodeId);
  if(!n) return true;
  if(n.type !== 'operator' && n.type !== 'periodShift') return false;
  return canvas.edges.filter(e => e.to === nodeId).every(e => feedsNothing(canvas, e.from, visiting));
}
// An input rectangle: a value rectangle with no incoming arrow, or whose single incoming
// arrow comes from something fed by nothing (feedsNothing) — e.g. Cash ← [+] where the
// + operator's socket has nothing plugged in. fmIDE then uses the rectangle's own typed
// number, so both apps treat it as an input everywhere (canvas look, Excel section,
// values, the "Inputs" role, Constant eligibility and the Inputs tab).
function isInputRectangle(canvas, node){
  if(!canvas || !node || node.type !== 'value') return false;
  const inc = canvas.edges.filter(e => e.to === node.id);
  if(inc.length === 0) return true;
  return inc.length === 1 && feedsNothing(canvas, inc[0].from, new Set());
}

// ---------- reaching outside the timeline (shared: src/shared/input-rule.js) ----------
// True if what feeds `nodeId` at `period` needs a period before the first or after the last,
// through a period shift (e.g. a corkscrew's opening balance in period 1). A rectangle fed
// this way shows its own typed number there, or 0 — in fmIDE and in Excel alike. The walk
// follows what both apps compute in one step — operators, period shifts and aliases — and
// stops at rectangles and block instances, which settle their own value. An iferror with a
// fallback only fails when both of its first two inputs fail; with one input it gives 0. A
// function node (functions.js) is followed like an operator: through any of its inputs.
// `canvasOf(id)` returns a canvas { nodes, edges }; inputs are in left-to-right order.
function reachesOutsideTimeline(canvasOf, canvasId, nodeId, period, periodCount, visiting){
  visiting = visiting || new Set();
  const key = canvasId + '|' + nodeId + '|' + period;
  if(visiting.has(key)) return false;
  visiting.add(key);
  const canvas = canvasOf(canvasId);
  const n = canvas && canvas.nodes.find(x => x.id === nodeId);
  if(!n) return false;
  const reach = (cid, id, p) => reachesOutsideTimeline(canvasOf, cid, id, p, periodCount, visiting);
  if(n.type === 'alias'){
    return !!(n.sourceCanvasId && n.sourceNodeId) && reach(n.sourceCanvasId, n.sourceNodeId, period);
  }
  const incoming = canvas.edges.filter(e => e.to === nodeId);
  if(n.type === 'periodShift'){
    if(incoming.length !== 1) return false;
    const target = period + ((typeof n.shift === 'number') ? n.shift : -1);
    if(target < 0 || target >= periodCount) return true;
    return reach(canvasId, incoming[0].from, target);
  }
  if(n.type !== 'operator' && n.type !== 'function') return false;
  const inputs = incoming.map(e => canvas.nodes.find(x => x.id === e.from)).filter(Boolean)
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));
  if(n.type === 'operator' && n.text === 'iferror'){
    return inputs.length >= 2 && reach(canvasId, inputs[0].id, period) && reach(canvasId, inputs[1].id, period);
  }
  return inputs.some(src => reach(canvasId, src.id, period));
}
