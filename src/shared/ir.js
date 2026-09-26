// ---------- the formula IR (shared: src/shared/ir.js) ----------
// The IR (intermediate representation) is the model's calculation, read once from the saved
// system — { periods, canvases: [{ id, name, nodes, edges }] } — and kept in memory only
// (never saved). compileModel(system) is a pure function of that object: it reads nothing
// else, and changes nothing in it. evaluateModel(ir) calculates every rectangle in every
// period; unitOf(ir, canvasId, nodeId) gives a rectangle's unit of measure.
// Uses operators.js (the operator catalogue), uom.js (units) and input-rule.js.
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

function compileCanvas(c){
  const nodes = Array.isArray(c.nodes) ? c.nodes.filter(n => n && typeof n === 'object') : [];
  const edges = Array.isArray(c.edges) ? c.edges.filter(e => e && typeof e === 'object') : [];
  const raw = { nodes, edges };
  const rawById = new Map();
  nodes.forEach(n => { if(!rawById.has(n.id)) rawById.set(n.id, n); });
  const incoming = new Map();
  const portEdges = new Map(); // block instance id → (input port → the first arrow into it)
  edges.forEach(e => {
    if(!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to).push(e);
    if(!portEdges.has(e.to)) portEdges.set(e.to, new Map());
    const ports = portEdges.get(e.to);
    if(!ports.has(e.toPort)) ports.set(e.toPort, e);
  });
  const copyList = (v) => Array.isArray(v) ? v.slice() : undefined;

  const compileNode = (n) => {
    const inc = incoming.get(n.id) || [];
    const out = { id: n.id, type: n.type, x: n.x, y: n.y, incoming: inc };
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
      out.plugs = Array.isArray(n.plugs) ? n.plugs.filter(p => typeof p === 'string') : [];
    } else if(n.type === 'alias'){
      out.sourceCanvasId = n.sourceCanvasId;
      out.sourceNodeId = n.sourceNodeId;
    } else if(n.type === 'periodShift'){
      out.offset = (typeof n.shift === 'number') ? n.shift : -1;
    } else if(n.type === 'blockInstance'){
      out.blockDefCanvasId = n.blockDefCanvasId;
      out.vertical = !!n.vertical;
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
    }
    return out;
  };

  const list = nodes.map(compileNode);
  const byId = new Map();
  list.forEach(n => { if(!byId.has(n.id)) byId.set(n.id, n); });
  // A block's ports: its Input and Output rectangles, left to right, and its Vertical Index.
  const byRole = (role) => list.filter(n => n.type === 'value' && n.blockRole === role).sort(irByPosition);
  const indexNode = list.find(n => n.type === 'value' && n.blockRole === 'index') || null;
  return { id: c.id, name: c.name, raw, list, byId, portEdges,
    ports: { inputs: byRole('input'), outputs: byRole('output'), indexNode } };
}

function compileModel(system){
  const periods = system && Array.isArray(system.periods) ? system.periods : [];
  const source = system && Array.isArray(system.canvases) ? system.canvases : [];
  const order = source.map(c => compileCanvas(c || {}));
  const canvases = new Map();
  order.forEach(c => { if(!canvases.has(c.id)) canvases.set(c.id, c); });
  return { periodCount: periods.length, order, canvases, units: new Map() };
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
// source's unit straight through). null when there is none (e.g. block-instance outputs,
// ^, %, comparisons, or +/− of different units). Remembered in the IR.
function unitOf(ir, canvasId, nodeId){ return irUnit(ir, canvasId, nodeId, new Set()); }

function irUnit(ir, canvasId, nodeId, visiting){
  const key = canvasId + '|' + nodeId;
  if(ir.units.has(key)) return ir.units.get(key);
  if(visiting.has(key)) return null;
  const n = irNodeIn(ir, canvasId, nodeId);
  if(!n){ ir.units.set(key, null); return null; }
  visiting.add(key);
  const fromEdge = (edge) => {
    const src = irNodeIn(ir, canvasId, edge.from);
    if(!src || src.type === 'blockInstance') return null;
    return irUnit(ir, canvasId, edge.from, visiting);
  };
  let result = null;
  if(n.type === 'value'){
    if(n.unitText) result = parseUOM(n.unitText);
    else if(n.incoming.length === 1) result = fromEdge(n.incoming[0]);
  } else if(n.type === 'alias'){
    if(n.sourceCanvasId && n.sourceNodeId) result = irUnit(ir, n.sourceCanvasId, n.sourceNodeId, visiting);
  } else if(n.type === 'periodShift'){
    if(n.incoming.length === 1) result = fromEdge(n.incoming[0]);
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

// ---- values ----
// Calculates every period. Returns one entry per canvas, in the system's order:
// { values[p], errors[p], portValues[p], portErrors[p], portInstances[p] }, where values and
// errors map a node id to its number or error code; portValues / portErrors map a block
// instance id to a list per output; portInstances maps a vertical block instance id to each
// output's list of per-instance results.
//
// Error codes: cycle, alias-unset, alias-missing-canvas, alias-missing-node, no-input,
// ambiguous, missing-input, period-out-of-range, math-error, unary-only, needs-two,
// block-missing-def, block-missing-output, block-cycle.
//
// Each period starts with a fresh memory of results. A value is remembered per period,
// canvas, block-instance scope and node: `scope` is { prefix, bindings, outerCanvasId,
// outerScope } inside a block instance, where `bindings` maps each Input port to the outer
// arrow feeding it.
function evaluateModel(ir){
  const periodCount = ir.periodCount;
  const TOP = () => ({ prefix: '', bindings: {} });
  const rawCanvasOf = (id) => { const c = ir.canvases.get(id); return c ? c.raw : undefined; };
  const bad = (v) => v === null || v === undefined || Number.isNaN(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const valueKey = (period, canvasId, scope, nodeId) => period + '|' + canvasId + '|' + scope.prefix + nodeId;
  let memo = {}, errors = {};

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
          if(result === null && !errors[key]) errors[key] = 'missing-input';
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
          result = bad(bound) ? literalOrZero(n, period) : bound;
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
          if(result === null && !errors[key]) errors[key] = 'missing-input';
        }
      }
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
            if(bad(fallback)) errors[key] = 'missing-input';
            else result = fallback;
          } else {
            result = 0;
          }
        }
      } else if(inputs.length === 0){
        errors[key] = 'no-input';
      } else {
        const values = inputs.map(e => resolveEdge(canvasId, e, period, scope, visiting));
        if(values.some(bad)){
          errors[key] = 'missing-input';
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
  function portEdge(outerCanvasId, instanceId, port){
    const c = ir.canvases.get(outerCanvasId);
    const ports = c && c.portEdges.get(instanceId);
    return (ports && ports.get(port)) || null;
  }

  function blockOutput(outerCanvasId, inst, outputIndex, period, outerScope, visiting){
    const key = valueKey(period, outerCanvasId, outerScope, inst.id + '::out' + outputIndex);
    if(has(memo, key)) return memo[key];
    const def = ir.canvases.get(inst.blockDefCanvasId);
    if(!def){ errors[key] = 'block-missing-def'; memo[key] = null; return null; }
    if(inst.vertical) return verticalBlockOutput(outerCanvasId, inst, outputIndex, period, outerScope, visiting, def, key);

    const blockCycleKey = period + '|#block#' + def.id;
    if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; memo[key] = null; return null; }
    const outNode = def.ports.outputs[outputIndex];
    if(!outNode){ errors[key] = 'block-missing-output'; memo[key] = null; return null; }

    const bindings = {};
    def.ports.inputs.forEach((inp, i) => { bindings[inp.id] = { edge: portEdge(outerCanvasId, inst.id, i), fixedPeriod: null }; });
    const innerScope = { prefix: outerScope.prefix + outerCanvasId + '/' + inst.id + '::', bindings, outerCanvasId, outerScope };
    visiting.add(blockCycleKey);
    const result = value(def.id, outNode.id, period, innerScope, visiting);
    visiting.delete(blockCycleKey);

    memo[key] = result;
    if(result === null && !errors[key]){
      errors[key] = errors[valueKey(period, def.id, innerScope, outNode.id)] || 'missing-input';
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

    const results = [];
    for(let i = 0; i < periodCount; i++){
      const blockCycleKey = period + '|#block#' + def.id + '#v' + inst.id + '#' + i;
      if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; results.push(null); continue; }
      const bindings = {};
      inputs.forEach((inp, portIdx) => {
        const inEdge = portEdge(outerCanvasId, inst.id, portIdx);
        bindings[inp.id] = { edge: inEdge, fixedPeriod: (inEdge && inEdge.verticalIndexed) ? i : null };
      });
      if(indexNode) bindings[indexNode.id] = { edge: null, fixedPeriod: null, literal: i + 1 };
      const innerScope = { prefix: outerScope.prefix + outerCanvasId + '/' + inst.id + '::v' + i + '::', bindings, outerCanvasId, outerScope };
      visiting.add(blockCycleKey);
      results.push(value(def.id, outNode.id, period, innerScope, visiting));
      visiting.delete(blockCycleKey);
    }

    let result = null;
    if(results.length === 0){
      errors[key] = 'no-input';
    } else if(results.some(bad)){
      errors[key] = 'missing-input';
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

  const out = ir.order.map(() => ({ values: [], errors: [], portValues: [], portErrors: [], portInstances: [] }));
  for(let p = 0; p < periodCount; p++){
    memo = {}; errors = {};
    ir.order.forEach(c => c.list.forEach(n => {
      if(n.type === 'blockInstance'){
        irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach((_, i) => blockOutput(c.id, n, i, p, TOP(), new Set()));
      } else {
        value(c.id, n.id, p, TOP(), new Set());
      }
    }));
    ir.order.forEach((c, ci) => {
      const cv = {}, ce = {}, pv = {}, pe = {}, pin = {};
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
          if(errors[k]) ce[n.id] = errors[k];
        }
      });
      const r = out[ci];
      r.values[p] = cv; r.errors[p] = ce; r.portValues[p] = pv; r.portErrors[p] = pe; r.portInstances[p] = pin;
    });
  }
  return out;
}
