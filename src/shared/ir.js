// ---------- the formula IR (shared: src/shared/ir.js) ----------
// The IR (intermediate representation) is the model's calculation, read once from the saved
// system — { periods, canvases: [{ id, name, nodes, edges }] } — and kept in memory only
// (never saved). compileModel(system) is a pure function of that object: it reads nothing
// else, and changes nothing in it. evaluateModel(ir) calculates every rectangle in every
// period; unitOf(ir, canvasId, nodeId) gives a rectangle's unit of measure.
// Uses operators.js (the operator catalogue), uom.js (units), input-rule.js and
// functions.js (function plugins: the definitions a system carries in `functions`).
//
// Lookups follow the file as it is: where a file repeats an id, the first canvas (or the
// first node on a canvas) with that id is the one used.

// A value rectangle's text: "Name\nValue\nUnit"; a single line that is a number is a value
// with no name.
function parseRectText(text){
  const raw = text || '';
  const lines = raw.split('\n');
  if(lines.length === 1){
    const t = lines[0].trim();
    if(t !== '' && !isNaN(Number(t))) return { name: '', literal: Number(t), uom: null };
    return { name: lines[0], literal: null, uom: null };
  }
  const name = lines[0];
  const second = lines[1].trim();
  const literal = (second !== '' && !isNaN(Number(second))) ? Number(second) : null;
  const uom = (lines.length >= 3 && lines[2].trim() !== '') ? lines[2].trim() : null;
  return { name, literal, uom };
}

// A value rectangle's own typed number applies to every period by default.
// node.literalPeriods, when present, is the sparse list of period indices where
// the rectangle's own number is used; other periods fall through to an incoming
// edge instead (e.g. a period-shift connector carrying a prior period forward).
// node.periodValues, when present, is a number per period (a drawn curve).
function effectiveLiteral(n, period){
  if(Array.isArray(n.periodValues) && typeof n.periodValues[period] === 'number' && isFinite(n.periodValues[period])){
    return n.periodValues[period];
  }
  const {literal} = parseRectText(n.text);
  if(literal === null) return null;
  if(Array.isArray(n.literalPeriods) && !n.literalPeriods.includes(period)) return null;
  return literal;
}

// Left to right, then top to bottom: the order an operator reads its inputs in.
function irByPosition(a, b){ return (a.x - b.x) || (a.y - b.y); }

// ---- plugs and sockets ----
// A rectangle's plug names (system v3: a list, `plugs`). Tolerates a node still holding the
// older single `plug` text and drops anything that isn't a non-empty name; names match
// case-insensitively, so a name appears once.
function plugsOf(n){
  if(!n) return [];
  const raw = Array.isArray(n.plugs) ? n.plugs : (typeof n.plug === 'string' ? [n.plug] : []);
  const out = [], seen = new Set();
  raw.forEach(p => {
    if(typeof p !== 'string') return;
    const t = p.trim(), k = t.toLowerCase();
    if(t && !seen.has(k)){ seen.add(k); out.push(t); }
  });
  return out;
}

// The automatic links plugs make: every operator with a socket name is fed by every value
// rectangle, anywhere in the model, carrying a plug of that name (trimmed, any capitals).
// `list` is the canvases [{ id, nodes, edges }] in the system's order, without automatic
// links. Returns one list per canvas, in order: { from, to } — an arrow from a plugged
// rectangle on the socket's own canvas (none where an arrow is already drawn) — or
// { to, alias: { sourceCanvasId, sourceNodeId, x, y } } — an alias of a plugged rectangle on
// another canvas (ordered by canvas, then left to right), placed left of the socket, stacked
// downwards. fmIDE draws exactly these; compileModel follows them.
function plugLinks(list){
  const sources = [];
  list.forEach((c, idx) => (c.nodes || []).forEach(n => {
    if(!n || n.type !== 'value') return;
    const keys = new Set(plugsOf(n).map(p => p.toLowerCase()));
    if(keys.size) sources.push({ canvasId: c.id, canvasIndex: idx, node: n, keys });
  }));
  return list.map(c => {
    const links = [];
    if(!sources.length) return links;
    const wired = new Set((c.edges || []).filter(Boolean).map(e => e.from + '\u0000' + e.to));
    (c.nodes || []).forEach(op => {
      if(!op || op.type !== 'operator' || typeof op.socket !== 'string' || op.socket.trim() === '') return;
      const key = op.socket.trim().toLowerCase();
      const matches = sources.filter(p => p.keys.has(key));
      matches.filter(p => p.canvasId === c.id).forEach(p => {
        const k = p.node.id + '\u0000' + op.id;
        if(wired.has(k)) return;
        wired.add(k);
        links.push({ from: p.node.id, to: op.id });
      });
      matches.filter(p => p.canvasId !== c.id)
        .sort((a, b) => (a.canvasIndex - b.canvasIndex) || (a.node.x - b.node.x) || (a.node.y - b.node.y))
        .forEach((p, i) => links.push({ to: op.id, alias: {
          sourceCanvasId: p.canvasId, sourceNodeId: p.node.id, x: Math.max(0, op.x - 200 + i * 2), y: op.y + i * 74 } }));
    });
    return links;
  });
}

// A canvas as the calculation sees it: the automatic links saved in the file (aliases and
// arrows marked `auto`) are set aside and replaced by the ones the plugs make now
// (plugLinks). A saved link that still matches keeps its id and its place in the lists
// (fmIDE shows values on the aliases it draws); new ones are added at the end. An alias
// always sits where plugLinks places it, as fmIDE redraws it — its place sets the order its
// operator reads it in. Returns new lists; the file's own objects are never changed.
function withPlugLinks(c, links){
  const autoAliases = new Set(c.nodes.filter(n => n.type === 'alias' && n.auto));
  const autoAliasById = new Map();
  autoAliases.forEach(n => { if(!autoAliasById.has(n.id)) autoAliasById.set(n.id, n); });
  const savedAuto = (e) => e.auto || autoAliasById.has(e.from) || autoAliasById.has(e.to);
  if(!links.length && !autoAliases.size && !c.edges.some(savedAuto)) return c;
  const savedEdges = c.edges.filter(savedAuto);
  const keepNodes = new Set(), keepEdges = new Set(), addNodes = [], addEdges = [], moved = new Map();
  const nodeIds = new Set(c.nodes.map(n => n.id)), edgeIds = new Set(c.edges.map(e => e.id));
  const freshId = (used, base) => { let id = base, k = 2; while(used.has(id)) id = base + '~' + (k++); used.add(id); return id; };
  links.forEach(l => {
    if(l.alias){
      const saved = savedEdges.find(e => {
        if(keepEdges.has(e) || e.to !== l.to) return false;
        const a = autoAliasById.get(e.from);
        return !!a && !keepNodes.has(a) && a.sourceCanvasId === l.alias.sourceCanvasId && a.sourceNodeId === l.alias.sourceNodeId;
      });
      if(saved){
        const a = autoAliasById.get(saved.from);
        keepEdges.add(saved); keepNodes.add(a);
        if(a.x !== l.alias.x || a.y !== l.alias.y) moved.set(a, Object.assign({}, a, { x: l.alias.x, y: l.alias.y }));
        return;
      }
      const id = freshId(nodeIds, 'plug:' + l.alias.sourceCanvasId + ':' + l.alias.sourceNodeId + '>' + l.to);
      addNodes.push({ id, type: 'alias', auto: true, x: l.alias.x, y: l.alias.y, w: 170, h: 64,
        sourceCanvasId: l.alias.sourceCanvasId, sourceNodeId: l.alias.sourceNodeId, plugs: [] });
      addEdges.push({ id: freshId(edgeIds, 'plug:' + id), from: id, to: l.to, auto: true });
    } else {
      const saved = savedEdges.find(e => !keepEdges.has(e) && e.auto && e.from === l.from && e.to === l.to && !autoAliasById.has(e.from));
      if(saved){ keepEdges.add(saved); return; }
      addEdges.push({ id: freshId(edgeIds, 'plug:' + l.from + '>' + l.to), from: l.from, to: l.to, auto: true });
    }
  });
  return {
    id: c.id, name: c.name,
    nodes: c.nodes.filter(n => !autoAliases.has(n) || keepNodes.has(n)).map(n => moved.get(n) || n).concat(addNodes),
    edges: c.edges.filter(e => !savedAuto(e) || keepEdges.has(e)).concat(addEdges),
  };
}

// `c` is { id, name, nodes, edges } as the calculation sees it (withPlugLinks); `functions`
// is the model's compiled function definitions (compileFunctions).
function compileCanvas(c, functions){
  const nodes = c.nodes, edges = c.edges;
  // The canvas as the calculation sees it, for rules that read a whole canvas (the input
  // rule, reaching outside the timeline) and for ExcelExporter's layout.
  const raw = { id: c.id, name: c.name, nodes, edges };
  const rawById = new Map();
  nodes.forEach(n => { if(!rawById.has(n.id)) rawById.set(n.id, n); });
  const incoming = new Map();
  const outgoing = new Map();
  const portEdges = new Map(); // block instance id → (input port → the first arrow into it)
  edges.forEach(e => {
    if(!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to).push(e);
    if(!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from).push(e);
    if(!portEdges.has(e.to)) portEdges.set(e.to, new Map());
    const ports = portEdges.get(e.to);
    if(!ports.has(e.toPort)) ports.set(e.toPort, e);
  });
  const copyList = (v) => Array.isArray(v) ? v.slice() : undefined;

  const compileNode = (n) => {
    const inc = incoming.get(n.id) || [];
    // `node` is the node as saved (ExcelExporter reads its text, style and roles from it).
    const out = { id: n.id, type: n.type, x: n.x, y: n.y, incoming: inc, outgoing: outgoing.get(n.id) || [], node: n };
    if(n.type === 'value'){
      const parsed = parseRectText(n.text);
      out.typed = parsed.literal;
      out.unitText = parsed.uom;
      // What effectiveLiteral reads, copied so the IR stays as it was compiled.
      out.literal = { text: n.text, periodValues: copyList(n.periodValues), literalPeriods: copyList(n.literalPeriods) };
      out.literalPeriods = out.literal.literalPeriods;
      out.isInput = isInputRectangle(raw, n);
      out.blockRole = n.blockRole;
      out.verticalReducer = n.verticalReducer;
      out.plugs = plugsOf(n);
    } else if(n.type === 'alias'){
      out.sourceCanvasId = n.sourceCanvasId;
      out.sourceNodeId = n.sourceNodeId;
    } else if(n.type === 'periodShift'){
      out.offset = (typeof n.shift === 'number') ? n.shift : -1;
    } else if(n.type === 'blockInstance'){
      out.blockDefCanvasId = n.blockDefCanvasId;
      out.vertical = !!n.vertical;
    } else if(n.type === 'function'){
      // A call to one version of a function: `call` is its compiled definition, or null when
      // the file doesn't carry it. Its inputs are the arrows into its ports (portEdges).
      out.fn = cleanFunctionRef(n.fn);
      out.call = out.fn ? functions.resolve(out.fn) : null;
    } else {
      // An operator — or any other type, which calculates the same way.
      out.symbol = n.text;
      out.op = operatorForSymbol(n.text);
      out.socket = typeof n.socket === 'string' ? n.socket : '';
      // Inputs whose source exists, left to right.
      out.inputs = inc.slice().sort((a, b) => {
        const na = rawById.get(a.from), nb = rawById.get(b.from);
        if(!na || !nb) return 0;
        return irByPosition(na, nb);
      }).filter(e => rawById.has(e.from));
      // The same, in the order units read them (sources checked first, then sorted).
      out.unitInputs = inc.filter(e => rawById.has(e.from)).sort((a, b) => irByPosition(rawById.get(a.from), rawById.get(b.from)));
      // An operator with named inputs (phase E1: if, round…): the arrow into each, by its
      // `toPort`, or null (the first arrow into a port counts, as for a function node).
      // A choose (phase E2b) has as many choices as its arrows reach.
      if(out.op && out.op.ports){
        const ports = portEdges.get(n.id);
        const names = operatorPortNames(out.op, out.op.choices && ports ? chooseChoiceCount([...ports.keys()]) : 0);
        out.portInputs = names.map((_, i) => {
          const e = ports ? ports.get(i) : undefined;
          return e && rawById.has(e.from) ? e : null;
        });
      }
    }
    return out;
  };

  const list = nodes.map(compileNode);
  // The compiled definition of each function node, for the timeline rule (input-rule.js),
  // which reads the canvas as saved.
  raw.calls = new Map(list.filter(n => n.type === 'function').map(n => [n.id, n.call]));
  const byId = new Map();
  list.forEach(n => { if(!byId.has(n.id)) byId.set(n.id, n); });
  // A block's ports: its Input and Output rectangles, left to right, and its Vertical Index.
  const byRole = (role) => list.filter(n => n.type === 'value' && n.blockRole === role).sort(irByPosition);
  const indexNode = list.find(n => n.type === 'value' && n.blockRole === 'index') || null;
  return { id: c.id, name: c.name, raw, list, byId, portEdges,
    ports: { inputs: byRole('input'), outputs: byRole('output'), indexNode } };
}

// Reads { periods, canvases, functions } and nothing else. Plug-to-socket links are worked
// out here, from the plug and socket names (plugLinks); the automatic links saved in the file
// are only reused where they still match. `functions` are the function definitions the
// model carries (functions.js); a model without any reads none.
const IR_NO_FUNCTIONS = { resolve: () => null, list: [] };
function compileModel(system){
  const periods = system && Array.isArray(system.periods) ? system.periods : [];
  const source = system && Array.isArray(system.canvases) ? system.canvases : [];
  const saved = source.map(c => {
    c = (c && typeof c === 'object') ? c : {};
    return { id: c.id, name: c.name,
      nodes: Array.isArray(c.nodes) ? c.nodes.filter(n => n && typeof n === 'object') : [],
      edges: Array.isArray(c.edges) ? c.edges.filter(e => e && typeof e === 'object') : [] };
  });
  const links = plugLinks(saved.map(c => {
    const autoAliasIds = new Set(c.nodes.filter(n => n.type === 'alias' && n.auto).map(n => n.id));
    return { id: c.id,
      nodes: c.nodes.filter(n => !(n.type === 'alias' && n.auto)),
      edges: c.edges.filter(e => !e.auto && !autoAliasIds.has(e.from) && !autoAliasIds.has(e.to)) };
  }));
  const functions = system && Array.isArray(system.functions) && system.functions.length ? compileFunctions(system.functions) : IR_NO_FUNCTIONS;
  const order = saved.map((c, i) => compileCanvas(withPlugLinks(c, links[i]), functions));
  const canvases = new Map();
  order.forEach(c => { if(!canvases.has(c.id)) canvases.set(c.id, c); });
  return { periodCount: periods.length, order, canvases, units: new Map(), functions };
}

function irNodeIn(ir, canvasId, nodeId){
  const c = ir.canvases.get(canvasId);
  return c ? c.byId.get(nodeId) : undefined;
}
// The ports of a block definition canvas (none when it is missing).
function irBlockPorts(ir, defCanvasId){
  const def = ir.canvases.get(defCanvasId);
  return def ? def.ports : { inputs: [], outputs: [], indexNode: null };
}

// ---- units ----
// A rectangle's unit: its own typed 3rd line if set, else worked out from its input(s)
// through the operator catalogue's unit rules (aliases and period shifts pass their
// source's unit straight through). null when there is none (e.g. ^, %, comparisons, or +/−
// of different units). Remembered in the IR.
//
// Blocks: what an arrow reads from a block instance has the unit of the block's Output
// rectangle in that instance, where each Input port has the unit of whatever feeds that
// instance's port (a port nothing feeds keeps its own). `path` says which instance a
// rectangle inside a block is seen in: the block-instance hops from the top level down,
// [{ canvasId, nodeId }] (the canvas the instance sits on, and the instance); [] or none is
// the rectangle on its own canvas. A block that contains itself gives no unit.
function unitOf(ir, canvasId, nodeId, path){ return irUnit(ir, canvasId, nodeId, path || [], new Set()); }

function irScopeKey(path){
  let k = '';
  for(let i = 0; i < path.length; i++) k += path[i].canvasId + ':' + path[i].nodeId + '>';
  return k;
}

// The arrow feeding input port `portIndex` of block instance `instanceId` on canvas
// `hostCanvasId`, or null.
function irPortEdge(ir, hostCanvasId, instanceId, portIndex){
  const c = ir.canvases.get(hostCanvasId);
  const ports = c && c.portEdges.get(instanceId);
  return (ports && ports.get(portIndex)) || null;
}

// True if block Input port `node` (of definition `defCanvasId`), seen in the instance that
// `path` ends in, is fed by nothing there: no arrow into the instance's port, or one from
// something fed by nothing (feedsNothing — e.g. an operator whose socket nothing plugs into).
// Such a port is an input of the instance: its own typed number, or 0.
function irPortUnfed(ir, path, defCanvasId, node){
  if(!path.length) return false;
  const hop = path[path.length - 1];
  const def = ir.canvases.get(defCanvasId);
  const edge = def ? irPortEdge(ir, hop.canvasId, hop.nodeId, def.ports.inputs.indexOf(node)) : null;
  if(!edge) return true;
  const host = ir.canvases.get(hop.canvasId);
  return feedsNothing(host.raw, edge.from, new Set());
}

function irUnit(ir, canvasId, nodeId, path, visiting){
  const key = irScopeKey(path) + canvasId + '|' + nodeId;
  if(ir.units.has(key)) return ir.units.get(key);
  if(visiting.has(key)) return null;
  const n = irNodeIn(ir, canvasId, nodeId);
  if(!n){ ir.units.set(key, null); return null; }
  visiting.add(key);
  const fromEdge = (edge) => irEdgeUnit(ir, canvasId, edge, path, visiting);
  let result = null;
  if(n.type === 'value'){
    if(n.blockRole === 'input' && path.length && !irPortUnfed(ir, path, canvasId, n)){
      // A fed Input port passes on the unit of what feeds this instance's port.
      const hop = path[path.length - 1];
      const def = ir.canvases.get(canvasId);
      const edge = irPortEdge(ir, hop.canvasId, hop.nodeId, def.ports.inputs.indexOf(n));
      result = irEdgeUnit(ir, hop.canvasId, edge, path.slice(0, -1), visiting);
    } else if(n.unitText) result = parseUOM(n.unitText);
    else if(n.incoming.length === 1) result = fromEdge(n.incoming[0]);
  } else if(n.type === 'alias'){
    // An alias into its own canvas stays in the same instance; into another canvas, it reads
    // that canvas's rectangle on its own.
    if(n.sourceCanvasId && n.sourceNodeId) result = irUnit(ir, n.sourceCanvasId, n.sourceNodeId, n.sourceCanvasId === canvasId ? path : [], visiting);
  } else if(n.type === 'periodShift'){
    if(n.incoming.length === 1) result = fromEdge(n.incoming[0]);
  } else if(n.type === 'function'){
    // Worked out from the function's formula, with the units of what feeds its inputs.
    if(n.call && !n.call.status) result = functionUnit(n.call, (i) => irEdgeUnit(ir, canvasId, irPortEdge(ir, canvasId, n.id, i), path, visiting));
  } else if(n.type === 'operator' && n.op && n.op.ports){
    // Named inputs: 'first' is the value's unit (round); 'branches' is the unit every input
    // it may pick shares (if: then and else; choose: every choice).
    const unitOfPort = (i) => n.portInputs[i] ? fromEdge(n.portInputs[i]) : null;
    if(n.op.unit === 'first') result = unitOfPort(0);
    else if(n.op.unit === 'branches'){
      const us = n.portInputs.slice(1).map((_, i) => unitOfPort(i + 1));
      result = us.length && us.every(u => u && uomDimsEqual(u, us[0])) ? us[0] : null;
    }
  } else if(n.type === 'operator'){
    const units = n.unitInputs.map(fromEdge);
    const rule = n.op ? n.op.unit : null;
    if(units.length > 0 && !units.some(u => u === null)){
      if(rule === 'multiply') result = units.reduce((acc, u, i) => i === 0 ? u : uomMultiply(acc, u));
      else if(rule === 'divide') result = units.reduce((acc, u, i) => i === 0 ? u : uomDivide(acc, u));
      else if(rule === 'same') result = units.every(u => uomDimsEqual(u, units[0])) ? units[0] : null;
    }
  }
  visiting.delete(key);
  ir.units.set(key, result);
  return result;
}

// The unit of what `edge` (on canvas `canvasId`, seen in instance `path`) reads.
function irEdgeUnit(ir, canvasId, edge, path, visiting){
  const src = edge && irNodeIn(ir, canvasId, edge.from);
  if(!src) return null;
  if(src.type !== 'blockInstance') return irUnit(ir, canvasId, edge.from, path, visiting);
  const def = ir.canvases.get(src.blockDefCanvasId);
  const out = def && def.ports.outputs[edge.fromPort || 0];
  if(!out) return null;
  // A block inside itself (directly or not) has no unit.
  for(let i = 0; i < path.length; i++){
    const inst = irNodeIn(ir, path[i].canvasId, path[i].nodeId);
    if(inst && inst.blockDefCanvasId === def.id) return null;
  }
  return irUnit(ir, def.id, out.id, path.concat([{ canvasId, nodeId: src.id }]), visiting);
}

// ---- values ----
// Calculates every period. Returns one entry per canvas, in the system's order:
// { values[p], errors[p], portValues[p], portErrors[p], portInstances[p] }, where values and
// errors map a node id to its number or error code; portValues / portErrors map a block
// instance id to a list per output; portInstances maps a vertical block instance id to each
// output's list of per-instance results.
//
// Error codes: cycle, alias-unset, alias-missing-canvas, alias-missing-node, no-input,
// ambiguous, missing-input, period-out-of-range, math-error, unary-only, needs-two,
// block-missing-def, block-missing-output, block-cycle, operator-unknown (an operator's text
// isn't in the catalogue), operator-input-unwired (a named input it reads has no arrow),
// choose-out-of-range (a choose's index picks no choice: below 1 or past the last); for
// function nodes also
// function-missing, function-unreadable, function-cycle, function-too-deep,
// function-arguments (compileFunctions) and function-input-unwired.
//
// `options` (both off unless asked for; fmIDE asks for neither):
// - trace: each entry also carries origins[p], mapping a node id with an error to where
//   its failure starts: { canvasId, nodeId, path, code } (see irOrigin).
// - instances: the result also carries `instances[p]`, every rectangle inside every block
//   instance: [{ path, canvasId, nodeId, value, error, origin? }], where `path` is the
//   block-instance hops from the top level down ([{ canvasId, nodeId, vintage? }]; `vintage`,
//   from 1, is one run of a vertical instance). A vertical instance's combined output is
//   listed once more with its hop's vintage left out and `combined: true`.
//
// Results are remembered for the whole calculation, per period, canvas, block-instance
// scope and node, so a period that reads an earlier one (a period shift) takes the result
// already worked out for it — the one shown for that period — instead of working it out
// again: the time grows with the number of periods, not with its square. (Before, each
// period started with an empty memory; in a loop that could give a shift a different
// answer from the one shown for the period it reads.)
// Inside a block instance, `scope` is { prefix, bindings, outerCanvasId, outerScope, hops },
// where `bindings` maps each Input port to the outer arrow feeding it.
function evaluateModel(ir, options){
  const periodCount = ir.periodCount;
  const trace = !!(options && (options.trace || options.instances));
  const wantInstances = !!(options && options.instances);
  const TOP_HOPS = [];
  const TOP = () => ({ prefix: '', bindings: {}, hops: TOP_HOPS });
  const rawCanvasOf = (id) => { const c = ir.canvases.get(id); return c ? c.raw : undefined; };
  const bad = (v) => v === null || v === undefined || Number.isNaN(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const valueKey = (period, canvasId, scope, nodeId) => period + '|' + canvasId + '|' + scope.prefix + nodeId;
  const memo = {}, errors = {};
  // Tracing only: where each failure starts (a key, or '!missing-source' for an arrow from a
  // node that doesn't exist), what each key is, and every block-instance scope met.
  const origins = {}, keyInfo = {}, scopesSeen = new Map();

  // The memory key of what `edge` reads (null when its source doesn't exist).
  function edgeKey(canvasId, edge, period, scope){
    const src = irNodeIn(ir, canvasId, edge.from);
    if(!src) return null;
    if(src.type === 'blockInstance') return valueKey(period, canvasId, scope, src.id + '::out' + (edge.fromPort || 0));
    return valueKey(period, canvasId, scope, edge.from);
  }
  // Tracing: `key` failed because what `edge` reads failed.
  function failedFrom(key, canvasId, edge, period, scope){
    const k = edgeKey(canvasId, edge, period, scope);
    origins[key] = k === null ? '!missing-source' : (origins[k] || k);
  }
  function note(key, canvasId, scope, nodeId){ keyInfo[key] = { canvasId, nodeId, hops: scope.hops }; }

  function resolveEdge(canvasId, edge, period, scope, visiting){
    const src = irNodeIn(ir, canvasId, edge.from);
    if(!src) return null;
    if(src.type === 'blockInstance') return blockOutput(canvasId, src, edge.fromPort || 0, period, scope, visiting);
    return value(canvasId, edge.from, period, scope, visiting);
  }
  const literalOrZero = (n, period) => { const l = effectiveLiteral(n.literal, period); return l !== null ? l : 0; };

  function value(canvasId, nodeId, period, scope, visiting){
    const key = valueKey(period, canvasId, scope, nodeId);
    if(has(memo, key)) return memo[key];
    if(visiting.has(key)){ errors[key] = 'cycle'; memo[key] = null; return null; }
    const n = irNodeIn(ir, canvasId, nodeId);
    if(!n) return null;
    visiting.add(key);
    if(trace) note(key, canvasId, scope, nodeId);
    let result = null;

    if(n.type === 'alias'){
      if(!n.sourceCanvasId || !n.sourceNodeId){
        errors[key] = 'alias-unset';
      } else if(!ir.canvases.has(n.sourceCanvasId)){
        errors[key] = 'alias-missing-canvas';
      } else {
        const src = irNodeIn(ir, n.sourceCanvasId, n.sourceNodeId);
        if(!src){
          errors[key] = 'alias-missing-node';
        } else {
          // An alias into its own canvas is a local routing jump (e.g. re-exposing an
          // internal subtotal as a block output): it stays in the current block-instance
          // scope. An alias into another canvas evaluates that canvas at the top level.
          const aliasScope = (n.sourceCanvasId === canvasId) ? scope : TOP();
          result = value(n.sourceCanvasId, src.id, period, aliasScope, visiting);
          if(result === null && !errors[key]){
            errors[key] = 'missing-input';
            if(trace){ const k = valueKey(period, n.sourceCanvasId, aliasScope, src.id); origins[key] = origins[k] || k; }
          }
        }
      }
    } else if(n.type === 'blockInstance'){
      // No single value: an arrow from it reads one output (resolveEdge).
      errors[key] = 'no-input';
    } else if(n.type === 'value'){
      if(has(scope.bindings, nodeId)){
        // A block Input port: the outer arrow feeding it, read at the period asked for here
        // (the definition may look at other periods through a period shift), unless a
        // vertical instance pins it to its own period (fixedPeriod) or hands the Vertical
        // Index rectangle a number (literal).
        const binding = scope.bindings[nodeId];
        if(binding && typeof binding.literal === 'number'){
          result = binding.literal;
        } else {
          const inEdge = binding ? binding.edge : null;
          const bindPeriod = (binding && typeof binding.fixedPeriod === 'number') ? binding.fixedPeriod : period;
          const bound = inEdge ? resolveEdge(scope.outerCanvasId, inEdge, bindPeriod, scope.outerScope, visiting) : null;
          if(!bad(bound)){
            result = bound;
          } else if(!inEdge || feedsNothing(rawCanvasOf(scope.outerCanvasId), inEdge.from, new Set())
            || reachesOutsideTimeline(rawCanvasOf, scope.outerCanvasId, inEdge.from, bindPeriod, periodCount)){
            // Nothing feeds the port (it is an input of the instance), or what feeds it needs
            // a period outside the timeline: the port's own typed number, or 0 — as for any
            // wired rectangle. Any other failure shows as an error.
            result = literalOrZero(n, period);
          } else if(!errors[key]){
            errors[key] = 'missing-input';
            if(trace) failedFrom(key, scope.outerCanvasId, inEdge, bindPeriod, scope.outerScope);
          }
        }
      } else {
        const incoming = n.incoming;
        if(incoming.length === 0 || n.isInput){
          // An input (nothing wired in, or only an operator that nothing feeds — the shared
          // input rule): its own number, or 0.
          result = literalOrZero(n, period);
        } else if(incoming.length === 1 && Array.isArray(n.literalPeriods) && n.literalPeriods.includes(period) && n.typed !== null){
          // A period ticked under "Which periods use this rectangle's own number?" uses it,
          // wired or not.
          result = n.typed;
        } else if(incoming.length === 1){
          // Follow the wired source. Where it needs a period outside the timeline (e.g. a
          // corkscrew's opening balance in period 1), the typed number applies, or 0 — the
          // rule ExcelExporter follows too. Any other failure shows as an error.
          const edgeVal = resolveEdge(canvasId, incoming[0], period, scope, visiting);
          if(!bad(edgeVal)){
            result = edgeVal;
          } else if(reachesOutsideTimeline(rawCanvasOf, canvasId, incoming[0].from, period, periodCount)){
            result = literalOrZero(n, period);
          } else if(!errors[key]){
            errors[key] = 'missing-input';
            if(trace) failedFrom(key, canvasId, incoming[0], period, scope);
          }
        } else {
          errors[key] = 'ambiguous';
        }
      }
    } else if(n.type === 'periodShift'){
      const incoming = n.incoming;
      if(incoming.length === 0){
        errors[key] = 'no-input';
      } else if(incoming.length > 1){
        errors[key] = 'ambiguous';
      } else {
        const targetPeriod = period + n.offset;
        if(targetPeriod < 0 || targetPeriod >= periodCount){
          errors[key] = 'period-out-of-range';
        } else {
          result = resolveEdge(canvasId, incoming[0], targetPeriod, scope, visiting);
          if(result === null && !errors[key]){
            errors[key] = 'missing-input';
            if(trace) failedFrom(key, canvasId, incoming[0], targetPeriod, scope);
          }
        }
      }
    } else if(n.type === 'function'){
      // A call: the function's formula, reading only the inputs it needs. Each input is the
      // arrow into its port; one with no arrow is an error where the formula reads it.
      if(!n.call){
        errors[key] = 'function-missing';
      } else if(n.call.status){
        errors[key] = n.call.status;
      } else {
        const r = runFunction(n.call, (i) => {
          const edge = irPortEdge(ir, canvasId, n.id, i);
          if(!edge) return { error: 'function-input-unwired' };
          const v = resolveEdge(canvasId, edge, period, scope, visiting);
          return bad(v) ? { error: 'missing-input', edge } : { value: v };
        }, period);
        if(r.error){
          errors[key] = r.error;
          if(trace && r.edge) failedFrom(key, canvasId, r.edge, period, scope);
        } else result = r.value;
      }
    } else if(!n.op){
      // An operator fmIDE doesn't know (only a hand-edited file has one).
      errors[key] = 'operator-unknown';
    } else if(n.op.period){
      // The period number, counted from 1.
      result = period + 1;
    } else if(n.op.ports){
      // Named inputs (if, round…), each read only when needed. An if reads its condition,
      // then only the branch it picks; a choose its index, then only the choice it picks.
      const read = (i) => {
        const edge = n.portInputs[i];
        if(!edge) return { error: 'operator-input-unwired' };
        const v = resolveEdge(canvasId, edge, period, scope, visiting);
        return bad(v) ? { error: 'missing-input', edge } : { value: v };
      };
      let r;
      if(n.op.branches){
        const c = read(0);
        const k = c.error ? 0 : n.op.pick(c.value, n.portInputs.length - 1);
        r = c.error ? c : k ? read(k) : { error: 'choose-out-of-range' };
      } else {
        const got = n.op.ports.map((_, i) => read(i));
        r = got.find(g => g.error) || applyOperator(n.op, got.map(g => g.value));
      }
      if(r.error){
        errors[key] = r.error;
        if(trace && r.edge) failedFrom(key, canvasId, r.edge, period, scope);
      } else result = r.value;
    } else {
      const inputs = n.inputs;
      if(n.op && n.op.fallback){
        // iferror(first, second): the first input, or when it fails the second; with no
        // second input, or nothing wired in at all, 0 (Excel: IFERROR(x,0) / 0).
        if(inputs.length === 0){
          result = 0;
        } else {
          const primary = resolveEdge(canvasId, inputs[0], period, scope, visiting);
          if(!bad(primary)){
            result = primary;
          } else if(inputs.length >= 2){
            const fallback = resolveEdge(canvasId, inputs[1], period, scope, visiting);
            if(bad(fallback)){
              errors[key] = 'missing-input';
              if(trace) failedFrom(key, canvasId, inputs[1], period, scope);
            } else result = fallback;
          } else {
            result = 0;
          }
        }
      } else if(inputs.length === 0){
        errors[key] = 'no-input';
      } else {
        const values = inputs.map(e => resolveEdge(canvasId, e, period, scope, visiting));
        const failed = values.findIndex(bad);
        if(failed >= 0){
          errors[key] = 'missing-input';
          if(trace) failedFrom(key, canvasId, inputs[failed], period, scope);
        } else {
          const r = applyOperator(n.op, values);
          if(r.error) errors[key] = r.error;
          else result = r.value;
        }
      }
    }

    visiting.delete(key);
    memo[key] = result;
    return result;
  }

  // Each Input port is bound to the outer arrow feeding it (read fresh at whatever period
  // the definition asks for).
  function portEdge(outerCanvasId, instanceId, port){ return irPortEdge(ir, outerCanvasId, instanceId, port); }

  function blockOutput(outerCanvasId, inst, outputIndex, period, outerScope, visiting){
    const key = valueKey(period, outerCanvasId, outerScope, inst.id + '::out' + outputIndex);
    if(has(memo, key)) return memo[key];
    if(trace) note(key, outerCanvasId, outerScope, inst.id);
    const def = ir.canvases.get(inst.blockDefCanvasId);
    if(!def){ errors[key] = 'block-missing-def'; memo[key] = null; return null; }
    if(inst.vertical) return verticalBlockOutput(outerCanvasId, inst, outputIndex, period, outerScope, visiting, def, key);

    const blockCycleKey = period + '|#block#' + def.id;
    if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; memo[key] = null; return null; }
    const outNode = def.ports.outputs[outputIndex];
    if(!outNode){ errors[key] = 'block-missing-output'; memo[key] = null; return null; }

    const bindings = {};
    def.ports.inputs.forEach((inp, i) => { bindings[inp.id] = { edge: portEdge(outerCanvasId, inst.id, i), fixedPeriod: null }; });
    const innerScope = { prefix: outerScope.prefix + outerCanvasId + '/' + inst.id + '::', bindings, outerCanvasId, outerScope,
      hops: trace ? outerScope.hops.concat([{ canvasId: outerCanvasId, nodeId: inst.id }]) : null };
    if(wantInstances && !scopesSeen.has(innerScope.prefix)) scopesSeen.set(innerScope.prefix, { scope: innerScope, def });
    visiting.add(blockCycleKey);
    const result = value(def.id, outNode.id, period, innerScope, visiting);
    visiting.delete(blockCycleKey);

    memo[key] = result;
    if(result === null && !errors[key]){
      const innerKey = valueKey(period, def.id, innerScope, outNode.id);
      errors[key] = errors[innerKey] || 'missing-input';
      if(trace) origins[key] = origins[innerKey] || innerKey;
    }
    return result;
  }

  // A vertical block instance runs the definition once per period i (its Vertical Index
  // rectangle, if any, reads i + 1), then combines the results with the output's reducer.
  // An input arrow marked verticalIndexed reads its source at period i; the others are read
  // at whatever period the definition asks for.
  function verticalBlockOutput(outerCanvasId, inst, outputIndex, period, outerScope, visiting, def, key){
    const { inputs, outputs, indexNode } = def.ports;
    const outNode = outputs[outputIndex];
    if(!outNode){ errors[key] = 'block-missing-output'; memo[key] = null; return null; }

    const results = [], innerKeys = [];
    for(let i = 0; i < periodCount; i++){
      const blockCycleKey = period + '|#block#' + def.id + '#v' + inst.id + '#' + i;
      if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; results.push(null); innerKeys.push(null); continue; }
      const bindings = {};
      inputs.forEach((inp, portIdx) => {
        const inEdge = portEdge(outerCanvasId, inst.id, portIdx);
        bindings[inp.id] = { edge: inEdge, fixedPeriod: (inEdge && inEdge.verticalIndexed) ? i : null };
      });
      if(indexNode) bindings[indexNode.id] = { edge: null, fixedPeriod: null, literal: i + 1 };
      const innerScope = { prefix: outerScope.prefix + outerCanvasId + '/' + inst.id + '::v' + i + '::', bindings, outerCanvasId, outerScope,
        hops: trace ? outerScope.hops.concat([{ canvasId: outerCanvasId, nodeId: inst.id, vintage: i + 1 }]) : null };
      if(wantInstances && !scopesSeen.has(innerScope.prefix)) scopesSeen.set(innerScope.prefix, { scope: innerScope, def });
      visiting.add(blockCycleKey);
      results.push(value(def.id, outNode.id, period, innerScope, visiting));
      innerKeys.push(valueKey(period, def.id, innerScope, outNode.id));
      visiting.delete(blockCycleKey);
    }

    let result = null;
    if(results.length === 0){
      errors[key] = 'no-input';
    } else if(results.some(bad)){
      errors[key] = 'missing-input';
      if(trace){
        const k = innerKeys[results.findIndex(bad)];
        origins[key] = k === null ? key : (origins[k] || k);
      }
    } else {
      const mode = outNode.verticalReducer || 'sum';
      if(mode === 'max') result = Math.max(...results);
      else if(mode === 'min') result = Math.min(...results);
      else if(mode === 'ave') result = results.reduce((a, b) => a + b, 0) / results.length;
      else if(mode === 'product') result = results.reduce((a, b) => a * b, 1);
      else result = results.reduce((a, b) => a + b, 0); // 'sum' (default)
    }
    memo[key] = result;
    memo[key + '::instances'] = results.slice(); // the per-instance breakdown, for display only
    return result;
  }

  // Tracing: where the failure at `key` starts — { canvasId, nodeId, path, code }. A failure
  // whose trail comes back to itself is a loop ('cycle'); an arrow from a node that doesn't
  // exist is 'missing-source'.
  function irOrigin(key){
    const o = origins[key] || key;
    if(o === '!missing-source') return { canvasId: null, nodeId: null, path: [], code: 'missing-source' };
    const info = keyInfo[o] || {};
    let code = errors[o] || 'missing-input';
    if(code === 'missing-input') code = 'cycle';
    return { canvasId: info.canvasId, nodeId: info.nodeId, path: info.hops || [], code };
  }

  const out = ir.order.map(() => ({ values: [], errors: [], portValues: [], portErrors: [], portInstances: [], origins: trace ? [] : undefined }));
  const instances = wantInstances ? [] : undefined;
  for(let p = 0; p < periodCount; p++){
    ir.order.forEach(c => c.list.forEach(n => {
      if(n.type === 'blockInstance'){
        irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach((_, i) => blockOutput(c.id, n, i, p, TOP(), new Set()));
      } else {
        value(c.id, n.id, p, TOP(), new Set());
      }
    }));
    if(wantInstances){
      // Every rectangle of every instance met so far (nested instances are met on the way).
      const list = [];
      for(const { scope, def } of scopesSeen.values()){
        def.list.forEach(n => {
          if(n.type === 'blockInstance'){
            irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach((_, i) => {
              const k = valueKey(p, def.id, scope, n.id + '::out' + i);
              blockOutput(def.id, n, i, p, scope, new Set());
              if(n.vertical){
                const outNode = irBlockPorts(ir, n.blockDefCanvasId).outputs[i];
                list.push({ path: scope.hops.concat([{ canvasId: def.id, nodeId: n.id }]), canvasId: n.blockDefCanvasId, nodeId: outNode.id,
                  combined: true, value: memo[k], error: errors[k] || null, origin: errors[k] ? irOrigin(k) : null });
              }
            });
            return;
          }
          if(n.type !== 'value') return;
          const k = valueKey(p, def.id, scope, n.id);
          value(def.id, n.id, p, scope, new Set());
          list.push({ path: scope.hops, canvasId: def.id, nodeId: n.id, value: has(memo, k) ? memo[k] : null,
            error: errors[k] || null, origin: errors[k] ? irOrigin(k) : null });
        });
      }
      // Vertical instances on the top level: their combined outputs.
      ir.order.forEach(c => c.list.forEach(n => {
        if(n.type !== 'blockInstance' || !n.vertical) return;
        irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach((outNode, i) => {
          const k = valueKey(p, c.id, TOP(), n.id + '::out' + i);
          list.push({ path: [{ canvasId: c.id, nodeId: n.id }], canvasId: n.blockDefCanvasId, nodeId: outNode.id,
            combined: true, value: memo[k], error: errors[k] || null, origin: errors[k] ? irOrigin(k) : null });
        });
      }));
      instances[p] = list;
    }
    ir.order.forEach((c, ci) => {
      const cv = {}, ce = {}, pv = {}, pe = {}, pin = {}, po = {};
      c.list.forEach(n => {
        if(n.type === 'blockInstance'){
          const vals = [], errs = [];
          let insts = null;
          irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach((_, i) => {
            const k = valueKey(p, c.id, TOP(), n.id + '::out' + i);
            vals.push(has(memo, k) ? memo[k] : null);
            errs.push(errors[k] || null);
            if(n.vertical){
              if(!insts) insts = [];
              insts.push(has(memo, k + '::instances') ? memo[k + '::instances'] : []);
            }
          });
          pv[n.id] = vals; pe[n.id] = errs;
          if(insts) pin[n.id] = insts;
        } else {
          const k = valueKey(p, c.id, TOP(), n.id);
          if(has(memo, k) && memo[k] !== null) cv[n.id] = memo[k];
          if(errors[k]){
            ce[n.id] = errors[k];
            if(trace) po[n.id] = irOrigin(k);
          }
        }
      });
      const r = out[ci];
      r.values[p] = cv; r.errors[p] = ce; r.portValues[p] = pv; r.portErrors[p] = pe; r.portInstances[p] = pin;
      if(trace) r.origins[p] = po;
    });
  }
  if(wantInstances) out.instances = instances;
  return out;
}
