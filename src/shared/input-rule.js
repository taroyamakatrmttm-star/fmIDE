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
