  // ---------- action registry ----------
  const ACTIONS = {};
  const ACTION_LIST = [];
  const STRINGY = new Set(['string', 'text', 'numstr']);
  const ACTION_CATEGORY_ORDER = ['Insert', 'Connect', 'Edit', 'Format', 'Arrange', 'Select', 'Canvas', 'Periods', 'Compute', 'File', 'Macros'];
  function P(name, type, extra){ return Object.assign({ name, type, label: name }, extra || {}); }
  const PX = P('x', 'number', { coord:'x', def: () => spawnPoint().x, help:'canvas x (px)' });
  const PY = P('y', 'number', { coord:'y', def: () => spawnPoint().y, help:'canvas y (px)' });
  const SEL_NODES = (help) => P('nodes', 'nodes', { def:'@sel', help: help || 'default: the selection' });

  function defineAction(def){
    def.params = def.params || [];
    def.category = def.category || 'Edit';
    if(def.mutates === undefined) def.mutates = true;
    ACTIONS[def.name] = def;
    ACTION_LIST.push(def);
  }

  function paramOptions(p){ return typeof p.options === 'function' ? p.options() : (p.options || []); }

  function coerceParam(p, v, out, fromDefault){
    switch(p.type){
      case 'number': case 'int': {
        let n = evalNumber(v, p.label);
        if(p.type === 'int') n = Math.round(n);
        if(p.coord && runCtx && runCtx.origin && !fromDefault) n += runCtx.origin[p.coord];
        if(p.min !== undefined && n < p.min) fail(`${p.label} must be at least ${p.min}.`);
        return n;
      }
      case 'string': case 'text': return interpolate(v == null ? '' : String(v));
      case 'numstr': {
        // a rectangle's value line: blank, a number, or an expression (100 * $i)
        if(typeof v === 'number') return formatNum(v);
        const s = interpolate(String(v == null ? '' : v)).trim();
        if(s === '' || /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return s;
        return formatNum(evalNumber(s, p.label));
      }
      case 'bool': return toBool(v);
      case 'enum': {
        const opts = paramOptions(p);
        const s = String(v).trim();
        const hit = opts.find(o => String(o).toLowerCase() === s.toLowerCase());
        if(hit === undefined) fail(`${p.label} must be one of: ${opts.join(', ')} (got "${s}").`);
        return hit;
      }
      case 'json': {
        if(v === null || v === '') return null;
        if(typeof v === 'object') return v;
        try{ return JSON.parse(v); }catch(err){ fail(`${p.label} is not valid JSON.`); }
        return null;
      }
      case 'canvas': return resolveCanvasRef(v);
      case 'template': return resolveTemplateRef(v);
      case 'macro': return resolveMacroRef(v);
      case 'node': return resolveOneNode(v, p.inCanvas && out[p.inCanvas] ? out[p.inCanvas] : undefined);
      case 'nodes': return resolveNodes(v, p.inCanvas && out[p.inCanvas] ? out[p.inCanvas] : undefined);
      default: return v;
    }
  }

  function prepareArgs(def, raw){
    if(Array.isArray(raw)){
      const o = {};
      def.params.forEach((p, i) => { if(i < raw.length) o[p.name] = raw[i]; });
      raw = o;
    }
    raw = raw || {};
    const out = {};
    const isNodeType = p => p.type === 'node' || p.type === 'nodes';
    // node references are resolved last, since they may depend on a canvas argument
    [false, true].forEach(nodePass => {
      def.params.forEach(p => {
        if(isNodeType(p) !== nodePass) return;
        let v = raw[p.name];
        const missing = v === undefined || v === null || (v === '' && !STRINGY.has(p.type));
        if(missing){
          if(p.def !== undefined){
            v = typeof p.def === 'function' ? p.def(out) : p.def;
          } else if(p.optional){
            out[p.name] = p.type === 'nodes' ? [] : null;
            return;
          } else {
            fail(`${def.label}: "${p.label}" is required.`);
          }
        }
        out[p.name] = coerceParam(p, v, out, missing);
      });
    });
    return out;
  }

  // The single entry point for running an action (API, UI, launcher, macros).
  function callAction(name, rawArgs){
    const def = ACTIONS[name];
    if(!def) fail(`Unknown action "${name}".`);
    const top = apiDepth === 0;
    apiDepth++;
    let result, recArgs = null;
    try{
      const args = prepareArgs(def, rawArgs);
      if(top && recorder.active && def.record !== false){
        const rec = def.recordAs ? def.recordAs(args) : { name, args };
        if(rec) recArgs = { name: rec.name, args: recorder.convertArgs(rec.name, rec.args) };
      }
      if(def.batch) result = runBatch(() => def.run(args));
      else if(def.tx === false) result = def.run(args);
      else result = inTx(() => def.run(args));
    }finally{
      apiDepth--;
    }
    if(result === NOOP) return undefined;
    if(recArgs) recorder.push(recArgs.name, recArgs.args, result);
    return result;
  }

  // ---------- helpers used by actions ----------
  function requireType(n, types, what){
    if(!types.includes(n.type)) fail(`${describeNode(n)} is not ${what}.`);
    return n;
  }
  function onActiveCanvas(n){
    if(!nodes.includes(n)) fail(`${describeNode(n)} is not on the current canvas.`);
    return n;
  }
  function clampPos(v){ return Math.max(0, v); }
  function portLabel(portNode, i, dir){ return (parseNode(portNode).name || (dir === 'in' ? 'in' : 'out') + i).trim(); }
  function resolvePort(inst, ref, dir){
    const def = canvases.find(c => c.id === inst.blockDefCanvasId);
    const ports = blockPortsOf(def)[dir === 'in' ? 'inputs' : 'outputs'];
    const kind = dir === 'in' ? 'input' : 'output';
    const bname = def ? def.name : '(missing block)';
    if(ports.length === 0) fail(`Block "${bname}" has no ${kind}s.`);
    const s = ref == null ? '' : String(ref).trim();
    if(s === ''){
      if(ports.length === 1) return 0;
      fail(`Block "${bname}" has ${ports.length} ${kind}s — say which one (${ports.map((p, i) => portLabel(p, i, dir)).join(', ')}).`);
    }
    if(/^\d+$/.test(s)){
      const idx = Number(s) - 1;
      if(idx < 0 || idx >= ports.length) fail(`Block "${bname}" has no ${kind} #${s}.`);
      return idx;
    }
    const idx = ports.findIndex((p, i) => portLabel(p, i, dir).toLowerCase() === s.toLowerCase());
    if(idx < 0) fail(`Block "${bname}" has no ${kind} called "${s}".`);
    return idx;
  }
  function parsePeriodList(v){
    if(Array.isArray(v)) return v.map(x => evalNumber(x, 'period'));
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if(s === '' || s === 'all') return null;
    if(s === 'first') return [1];
    if(s === 'none') return [];
    return s.split(/[,\s]+/).filter(Boolean).flatMap(tok => {
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(tok);
      if(m){ const a = +m[1], b = +m[2]; const r = []; for(let k = Math.min(a,b); k <= Math.max(a,b); k++) r.push(k); return r; }
      return [evalNumber(tok, 'period')];
    });
  }
  function parseNumberList(v){
    if(Array.isArray(v)) return v.map(x => evalNumber(x, 'value'));
    const s = String(v == null ? '' : v).trim();
    if(s === '') return null;
    return s.split(/[,;\s]+/).filter(Boolean).map(x => evalNumber(x, 'value'));
  }

  // ---------------------------------- Insert ----------------------------------
  defineAction({ name:'createRect', label:'Create Rectangle', category:'Insert', icon:'▭', returns:'node',
    desc:'Adds a value rectangle at x, y. Its three text lines are name / value / unit of measure.',
    params:[ PX, PY, P('name','string',{ def:'New Node' }), P('value','numstr',{ def:'0', help:'number, expression, or blank' }),
      P('uom','string',{ def:'', help:'unit, e.g. kt or $/t' }), P('w','number',{ def:170, min:40 }), P('h','number',{ def:64, min:30 }) ],
    run(a){
      pushHistory();
      const n = { id: uid('n'), type:'value', x: clampPos(a.x), y: clampPos(a.y), w: a.w, h: a.h, text: composeText(a), plugs:[] };
      nodes.push(n);
      clearComputed();
      return n.id;
    } });

  defineAction({ name:'createOperator', label:'Create Operator', category:'Insert', icon:'±', returns:'node',
    desc:'Adds an operator node. For − ÷ ^ % and comparisons, inputs are taken left-to-right by x position.',
    params:[ PX, PY, P('op','enum',{ options: OPS, def:'+' }) ],
    run(a){
      pushHistory();
      const size = operatorSize(a.op);
      const n = { id: uid('n'), type:'operator', x: clampPos(a.x), y: clampPos(a.y), w: size.w, h: size.h, text: a.op, socket:'' };
      nodes.push(n);
      clearComputed();
      return n.id;
    } });

  defineAction({ name:'createPeriodShift', label:'Create Period Shift', category:'Insert', icon:'⇥', returns:'node',
    desc:'Adds a period-shift connector: its output at period p is its input at period p + shift (e.g. −1 = prior period).',
    params:[ PX, PY, P('shift','int',{ def:-1 }) ],
    run(a){
      pushHistory();
      const n = { id: uid('n'), type:'periodShift', x: clampPos(a.x), y: clampPos(a.y), w:56, h:56, shift: a.shift };
      nodes.push(n);
      clearComputed();
      return n.id;
    } });

  defineAction({ name:'createAlias', label:'Create Alias', category:'Insert', icon:'🔗', returns:'node',
    desc:'Adds an alias that shows another rectangle (on this or another canvas).',
    params:[ PX, PY, P('sourceCanvas','canvas',{ def:'@current', label:'source canvas' }), P('source','node',{ inCanvas:'sourceCanvas', label:'source rectangle' }) ],
    run(a){
      requireType(a.source, ['value'], 'a plain rectangle (only rectangles can be aliased)');
      const srcCanvas = canvasOfNode(a.source);
      pushHistory();
      const n = { id: uid('n'), type:'alias', x: clampPos(a.x), y: clampPos(a.y), w:170, h:64, sourceCanvasId: srcCanvas.id, sourceNodeId: a.source.id, plugs:[] };
      nodes.push(n);
      clearComputed();
      evaluateAll();
      return n.id;
    } });

  defineAction({ name:'createBlock', label:'Create Block Instance', category:'Insert', icon:'▣', returns:'node',
    desc:'Inserts an instance of a Block (a canvas with Output rectangles).',
    params:[ PX, PY, P('block','canvas',{ help:'the Block canvas' }), P('vertical','bool',{ def:false }) ],
    run(a){
      if(blockPortsOf(a.block).outputs.length === 0) fail(`Canvas "${a.block.name}" has no Output rectangles, so it isn't a Block yet.`);
      pushHistory();
      const n = { id: uid('n'), type:'blockInstance', x: clampPos(a.x), y: clampPos(a.y), w:190, h:80, blockDefCanvasId: a.block.id, vertical: a.vertical };
      nodes.push(n);
      clearComputed();
      evaluateAll();
      return n.id;
    } });

  defineAction({ name:'duplicate', label:'Duplicate Nodes', category:'Insert', icon:'⧉', returns:'nodes',
    desc:'Copies nodes (and the connections between them) offset by dx, dy — like Ctrl+drag.',
    params:[ SEL_NODES(), P('dx','number',{ def:24 }), P('dy','number',{ def:24 }) ],
    run(a){
      const list = a.nodes.map(onActiveCanvas);
      if(list.length === 0) return NOOP;
      pushHistory();
      const idMap = {};
      const clones = list.map(orig => {
        const newId = uid('n');
        idMap[orig.id] = newId;
        return Object.assign(cloneData(orig), { id: newId, x: clampPos(orig.x + a.dx), y: clampPos(orig.y + a.dy) });
      });
      const clonedEdges = edges
        .filter(e => !e.auto && idMap[e.from] !== undefined && idMap[e.to] !== undefined)
        .map(e => Object.assign({}, e, { id: uid('e'), from: idMap[e.from], to: idMap[e.to] }));
      nodes = nodes.concat(clones);
      edges = edges.concat(clonedEdges);
      syncAutoConnections();
      clearComputed();
      return clones.map(n => n.id);
    } });

  defineAction({ name:'aliasOf', label:'Create Aliases Of', category:'Insert', icon:'🔗', returns:'nodes',
    desc:'Creates an alias of each rectangle, offset by dx, dy — like Alt+drag.',
    params:[ SEL_NODES(), P('dx','number',{ def:30 }), P('dy','number',{ def:30 }) ],
    run(a){
      const list = a.nodes.map(onActiveCanvas);
      if(list.length === 0) return NOOP;
      list.forEach(n => requireType(n, ['value'], 'a plain rectangle (only rectangles can be aliased)'));
      pushHistory();
      const newNodes = list.map(sn => ({
        id: uid('n'), type:'alias', x: clampPos(sn.x + a.dx), y: clampPos(sn.y + a.dy), w: sn.w, h: sn.h,
        sourceCanvasId: activeCanvasId, sourceNodeId: sn.id, plugs:[]
      }));
      nodes = nodes.concat(newNodes);
      clearComputed();
      evaluateAll();
      return newNodes.map(n => n.id);
    } });

  defineAction({ name:'insertTemplate', label:'Insert Template', category:'Insert', icon:'📚',
    desc:'Inserts a saved template. Modules: "here" (this canvas) or "newCanvas". Systems: "add" (merge alongside) or "replace".',
    params:[ P('template','template'), P('mode','enum',{ options:['auto','here','newCanvas','add','replace'], def:'auto' }),
      P('onCollision','enum',{ options:['merge','keep'], def:'merge', label:'same-name canvases', help:'systems added alongside' }),
      P('decisions','json',{ optional:true, help:'per-canvas {"Name":"merge"|"keep"}' }) ],
    run(a){
      const t = a.template;
      const data = cloneData(t.data);
      const mode = a.mode === 'auto' ? (t.kind === 'system' ? 'add' : 'here') : a.mode;
      if(t.kind !== 'system'){
        if(mode === 'here'){ pushHistory(); applyModuleDataDirect(data); }
        else if(mode === 'newCanvas'){ applyModuleDataToNewCanvas(data); }
        else fail(`"${t.name}" is a module template — use mode "here" or "newCanvas".`);
      } else {
        if(!Array.isArray(data.canvases) || !data.canvases.length) fail(`Template "${t.name}" has no canvases.`);
        if(mode === 'replace'){ pushHistory(); applySystemDataDirect(data); }
        else if(mode === 'add'){
          const decisions = Object.assign({}, a.decisions || {});
          data.canvases.forEach(c => { const k = c.name || 'Canvas'; if(!(k in decisions)) decisions[k] = a.onCollision; });
          performAddSystem(data, decisions);
        }
        else fail(`"${t.name}" is a system template — use mode "add" or "replace".`);
      }
    } });

  // ---------------------------------- Connect ----------------------------------
  defineAction({ name:'connect', label:'Connect', category:'Connect', icon:'→', returns:'edge',
    desc:'Draws an arrow from one node to another. Block instances take a port: its name or 1-based number.',
    params:[ P('from','node'), P('to','node'), P('fromPort','string',{ def:'', label:'from port', help:'block outputs only' }),
      P('toPort','string',{ def:'', label:'to port', help:'block inputs only' }) ],
    run(a){
      const A = onActiveCanvas(a.from), B = onActiveCanvas(a.to);
      if(A === B) fail('A node cannot be connected to itself.');
      let fp = null, tp = null;
      if(A.type === 'blockInstance') fp = resolvePort(A, a.fromPort, 'out');
      else if(a.fromPort !== '') fail(`${describeNode(A)} has no output ports — leave "from port" empty.`);
      if(B.type === 'blockInstance') tp = resolvePort(B, a.toPort, 'in');
      else if(a.toPort !== '') fail(`${describeNode(B)} has no input ports — leave "to port" empty.`);
      if(tp === null){
        const dup = edges.find(e => e.from === A.id && e.to === B.id && (fp == null ? e.fromPort == null : e.fromPort === fp) && e.toPort == null);
        if(dup) return NOOP;
      }
      pushHistory();
      if(tp !== null) edges = edges.filter(e => !(e.to === B.id && e.toPort === tp));
      const edge = { id: uid('e'), from: A.id, to: B.id };
      if(fp !== null) edge.fromPort = fp;
      if(tp !== null) edge.toPort = tp;
      edges.push(edge);
      clearComputed();
      return edge.id;
    },
    recordAs(a){
      const out = Object.assign({}, a);
      [['fromPort', a.from, 'out'], ['toPort', a.to, 'in']].forEach(([k, n, dir]) => {
        if(n.type !== 'blockInstance' || !/^\d+$/.test(String(a[k]))) return;
        const def = canvases.find(c => c.id === n.blockDefCanvasId);
        const ports = blockPortsOf(def)[dir === 'in' ? 'inputs' : 'outputs'];
        const idx = Number(a[k]) - 1;
        const nm = ports[idx] ? portLabel(ports[idx], idx, dir) : '';
        if(nm && ports.filter((p, i) => portLabel(p, i, dir).toLowerCase() === nm.toLowerCase()).length === 1 && !/^\d+$/.test(nm)) out[k] = nm;
      });
      return { name:'connect', args: out };
    } });

  defineAction({ name:'deleteEdge', label:'Delete Connection', category:'Connect', icon:'✕',
    params:[ P('from','node'), P('to','node'), P('toPort','string',{ def:'', label:'to port' }) ],
    run(a){
      let tp = null;
      if(a.to.type === 'blockInstance' && a.toPort !== '') tp = resolvePort(a.to, a.toPort, 'in');
      const e = edges.find(x => !x.auto && x.from === a.from.id && x.to === a.to.id && (tp === null || x.toPort === tp));
      if(!e) fail(`There is no arrow from ${describeNode(a.from)} to ${describeNode(a.to)}.`);
      pushHistory();
      edges = edges.filter(x => x !== e);
      if(selectedEdgeId === e.id) selectedEdgeId = null;
      clearComputed();
    } });

