  // ---------------------------------- Edit ----------------------------------
  function editValueText(n, mutate){
    requireType(n, ['value'], 'a rectangle');
    const parts = textParts(n);
    mutate(parts);
    const text = composeText(parts);
    if(text === n.text) return NOOP;
    pushHistory();
    n.text = text;
    clearComputed();
  }
  defineAction({ name:'setText', label:'Set Rectangle Text', category:'Edit', icon:'✎',
    desc:'Replaces all of a rectangle\'s text (name, value and unit lines).',
    params:[ P('node','node'), P('text','text') ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      const text = a.text.trim() || 'Untitled';
      if(text === a.node.text) return NOOP;
      pushHistory();
      a.node.text = text;
      clearComputed();
    } });
  defineAction({ name:'setName', label:'Rename Rectangle', category:'Edit', icon:'✎',
    params:[ P('node','node'), P('name','string') ], run(a){ return editValueText(a.node, p => { p.name = a.name; }); } });
  defineAction({ name:'setValue', label:'Set Rectangle Value', category:'Edit', icon:'#',
    params:[ P('node','node'), P('value','numstr',{ help:'number, expression, or blank' }) ], run(a){ return editValueText(a.node, p => { p.value = a.value; }); } });
  defineAction({ name:'setUOM', label:'Set Unit of Measure', category:'Edit', icon:'㎏',
    params:[ P('node','node'), P('uom','string') ], run(a){ return editValueText(a.node, p => { p.uom = a.uom; }); } });
  defineAction({ name:'setOperator', label:'Set Operator Symbol', category:'Edit', icon:'±',
    params:[ P('node','node'), P('op','enum',{ options: OPS }) ],
    run(a){
      requireType(a.node, ['operator'], 'an operator');
      if(a.node.text === a.op) return NOOP;
      pushHistory();
      a.node.text = a.op;
      const size = operatorSize(a.op);
      a.node.w = size.w; a.node.h = size.h;
      clearComputed();
    } });
  defineAction({ name:'setShift', label:'Set Period Shift', category:'Edit', icon:'⇥',
    params:[ P('node','node'), P('shift','int') ],
    run(a){
      requireType(a.node, ['periodShift'], 'a period shift');
      if(a.node.shift === a.shift) return NOOP;
      pushHistory();
      a.node.shift = a.shift;
      clearComputed();
    } });
  // A rectangle's plugs are a list of names (`plugs`); every change replaces the list
  // (never edits it in place — copies made by paste/duplicate may share it).
  function applyPlugs(node, list){
    const next = plugsOf({ plugs: list });
    const cur = plugsOf(node);
    if(!('plug' in node) && next.length === cur.length && next.every((p, i) => p === cur[i])) return NOOP;
    pushHistory();
    node.plugs = next;
    delete node.plug;
    syncAutoConnections();
    clearComputed();
  }
  defineAction({ name:'setPlug', label:'Set Plug', category:'Edit', icon:'🔌',
    desc:'Replaces all of this rectangle\'s plugs with one name. A plug name auto-feeds the rectangle into every operator whose socket has the same name.',
    params:[ P('node','node'), P('plug','string',{ def:'', help:'blank clears all plugs' }) ],
    run(a){
      requireType(a.node, ['value','alias'], 'a rectangle or alias');
      const v = a.plug.trim();
      return applyPlugs(a.node, v ? [v] : []);
    } });
  defineAction({ name:'setPlugs', label:'Set Plugs', category:'Edit', icon:'🔌',
    desc:'Replaces all of this rectangle\'s plugs with a list of names — one rectangle can feed several differently named sockets.',
    params:[ P('node','node'), P('plugs','json',{ def:'[]', help:'a list, e.g. ["Income Tax", "Tax paid"]; [] clears' }) ],
    run(a){
      requireType(a.node, ['value','alias'], 'a rectangle or alias');
      const list = a.plugs == null ? [] : a.plugs;
      if(!Array.isArray(list) || !list.every(p => typeof p === 'string')) fail('Plugs must be a list of names, e.g. ["Income Tax", "Tax paid"].');
      return applyPlugs(a.node, list.map(interpolate));
    } });
  defineAction({ name:'addPlug', label:'Add Plug', category:'Edit', icon:'🔌',
    desc:'Adds a plug name to this rectangle, keeping its other plugs.',
    params:[ P('node','node'), P('plug','string') ],
    run(a){
      requireType(a.node, ['value','alias'], 'a rectangle or alias');
      const v = a.plug.trim();
      if(!v) fail('Give a plug name to add.');
      return applyPlugs(a.node, plugsOf(a.node).concat([v]));
    } });
  defineAction({ name:'removePlug', label:'Remove Plug', category:'Edit', icon:'🔌',
    desc:'Removes one plug name from this rectangle (names match regardless of capitals).',
    params:[ P('node','node'), P('plug','string') ],
    run(a){
      requireType(a.node, ['value','alias'], 'a rectangle or alias');
      const k = a.plug.trim().toLowerCase();
      return applyPlugs(a.node, plugsOf(a.node).filter(p => p.toLowerCase() !== k));
    } });
  defineAction({ name:'setSocket', label:'Set Socket', category:'Edit', icon:'⚡',
    params:[ P('node','node'), P('socket','string',{ def:'', help:'blank clears' }) ],
    run(a){
      requireType(a.node, ['operator'], 'an operator');
      const v = a.socket.trim();
      if((a.node.socket || '') === v) return NOOP;
      pushHistory();
      a.node.socket = v;
      syncAutoConnections();
      clearComputed();
    } });
  defineAction({ name:'setRole', label:'Set Block Role', category:'Edit', icon:'⇄',
    desc:'Marks a rectangle as a Block input, output, or the Vertical Index.',
    params:[ P('node','node'), P('role','enum',{ options:['none','input','output','index'] }) ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      const v = a.role === 'none' ? null : a.role;
      if((a.node.blockRole || null) === v) return NOOP;
      pushHistory();
      a.node.blockRole = v;
      clearComputed();
    } });
  defineAction({ name:'setReducer', label:'Set Vertical Reducer', category:'Edit', icon:'Σ',
    params:[ P('node','node'), P('reducer','enum',{ options: REDUCERS }) ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      if((a.node.verticalReducer || 'sum') === a.reducer && a.node.verticalReducer) return NOOP;
      pushHistory();
      a.node.verticalReducer = a.reducer;
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'setVertical', label:'Set Block Vertical', category:'Edit', icon:'▤',
    params:[ P('node','node'), P('vertical','bool') ],
    run(a){
      requireType(a.node, ['blockInstance'], 'a block instance');
      if(!!a.node.vertical === a.vertical) return NOOP;
      pushHistory();
      a.node.vertical = a.vertical;
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'setPortMode', label:'Set Port Indexed/Broadcast', category:'Edit', icon:'⇶',
    desc:'On a vertical block instance: indexed = instance i reads this input at period i; broadcast = every instance sees the same value.',
    params:[ P('node','node'), P('port','string'), P('indexed','bool') ],
    run(a){
      requireType(a.node, ['blockInstance'], 'a block instance');
      const idx = resolvePort(a.node, a.port, 'in');
      const e = edges.find(x => x.to === a.node.id && x.toPort === idx);
      if(!e) fail('Connect something to that input first.');
      if(!!e.verticalIndexed === a.indexed) return NOOP;
      pushHistory();
      e.verticalIndexed = a.indexed;
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'relinkAlias', label:'Relink Alias', category:'Edit', icon:'🔗',
    params:[ P('node','node'), P('sourceCanvas','canvas',{ def:'@current', label:'source canvas' }), P('source','node',{ inCanvas:'sourceCanvas', label:'source rectangle' }) ],
    run(a){
      requireType(a.node, ['alias'], 'an alias');
      if(a.node.auto) fail('This alias was created by a Plug/Socket match — change the plug or socket name instead.');
      requireType(a.source, ['value'], 'a plain rectangle');
      const sc = canvasOfNode(a.source);
      if(a.node.sourceCanvasId === sc.id && a.node.sourceNodeId === a.source.id) return NOOP;
      pushHistory();
      a.node.sourceCanvasId = sc.id;
      a.node.sourceNodeId = a.source.id;
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'relinkBlock', label:'Relink Block Instance', category:'Edit', icon:'▣',
    params:[ P('node','node'), P('block','canvas') ],
    run(a){
      requireType(a.node, ['blockInstance'], 'a block instance');
      if(blockPortsOf(a.block).outputs.length === 0) fail(`Canvas "${a.block.name}" has no Output rectangles.`);
      if(a.node.blockDefCanvasId === a.block.id) return NOOP;
      pushHistory();
      a.node.blockDefCanvasId = a.block.id;
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'setLiteralPeriods', label:'Set Periods Using Own Number', category:'Edit', icon:'🕒',
    desc:'Which periods use the rectangle\'s own typed number: "all", "first", or a list like "1,3,5-8" (1-based).',
    params:[ P('node','node'), P('periods','string',{ def:'all' }) ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      const list = parsePeriodList(a.periods);
      let next = null;
      if(list !== null){
        const idx = Array.from(new Set(list.map(k => Math.round(k) - 1))).filter(k => k >= 0 && k < periods.length).sort((x, y) => x - y);
        next = idx.length === periods.length ? null : idx;
      }
      const cur = Array.isArray(a.node.literalPeriods) ? a.node.literalPeriods : null;
      if(JSON.stringify(cur) === JSON.stringify(next)) return NOOP;
      pushHistory();
      if(next === null) delete a.node.literalPeriods; else a.node.literalPeriods = next;
      clearComputed();
    } });
  defineAction({ name:'setPeriodValues', label:'Set Per-Period Values', category:'Edit', icon:'📈',
    desc:'Explicit value for each period ("10, 12, 15, …"), padded flat to the timeline; blank clears. Inputs only.',
    params:[ P('node','node'), P('values','string',{ def:'' }), P('min','number',{ optional:true }), P('max','number',{ optional:true }) ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      const list = parseNumberList(a.values);
      if(list === null){
        if(!Array.isArray(a.node.periodValues)) return NOOP;
        pushHistory();
        delete a.node.periodValues; delete a.node.periodValuesRange;
      } else {
        if(edges.some(e => e.to === a.node.id)) fail(`${describeNode(a.node)} has an incoming arrow — per-period values are only for input rectangles.`);
        const vals = padPeriodValuesArray(list, periods.length);
        const min = a.min !== null ? a.min : Math.min(0, ...vals);
        let max = a.max !== null ? a.max : Math.max(1, ...vals);
        if(max <= min) max = min + 1;
        pushHistory();
        a.node.periodValues = vals;
        a.node.periodValuesRange = { min, max };
      }
      clearComputed();
      evaluateAll();
    } });
  defineAction({ name:'deleteNodes', label:'Delete Nodes', category:'Edit', icon:'🗑',
    params:[ SEL_NODES() ],
    run(a){
      const list = a.nodes.map(onActiveCanvas);
      if(list.length === 0) return NOOP;
      const ids = new Set(list.map(n => n.id));
      pushHistory();
      nodes = nodes.filter(n => !ids.has(n.id));
      edges = edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
      ids.forEach(id => selectedNodeIds.delete(id));
      clearComputed();
    } });
  defineAction({ name:'deleteSelected', label:'Delete Selected', category:'Edit', icon:'🗑',
    run(){
      if(!selectedEdgeId && !selectedNodeIds.size) return NOOP;
      deleteSelected();
    },
    recordAs(){
      if(selectedEdgeId){
        const e = edges.find(x => x.id === selectedEdgeId);
        if(!e) return null;
        const to = getNode(e.to);
        let toPort = '';
        if(to && to.type === 'blockInstance' && e.toPort != null) toPort = String(e.toPort + 1);
        return { name:'deleteEdge', args:{ from: getNode(e.from), to, toPort } };
      }
      return { name:'deleteNodes', args:{ nodes: selectedNodesList() } };
    } });
  defineAction({ name:'clearCanvas', label:'Clear Canvas', category:'Edit', icon:'⌫',
    desc:'Removes every node and arrow on the current canvas (no confirmation).',
    run(){
      if(nodes.length === 0 && edges.length === 0) return NOOP;
      pushHistory();
      nodes = []; edges = [];
      selectedNodeIds.clear(); selectedEdgeId = null;
      clearComputed();
    } });
  defineAction({ name:'copy', label:'Copy', category:'Edit', icon:'⧉', mutates:false, params:[ SEL_NODES() ],
    run(a){ if(!a.nodes.length) return NOOP; copyNodeIds(a.nodes.map(onActiveCanvas).map(n => n.id)); } });
  defineAction({ name:'cut', label:'Cut', category:'Edit', icon:'✂', params:[ SEL_NODES() ],
    run(a){
      if(!a.nodes.length) return NOOP;
      copyNodeIds(a.nodes.map(onActiveCanvas).map(n => n.id));
      callAction('deleteNodes', { nodes: a.nodes });
    } });
  defineAction({ name:'paste', label:'Paste', category:'Edit', icon:'📋', returns:'nodes',
    run(){
      if(!clipboard || !clipboard.nodes.length) return NOOP;
      return pasteClipboard();
    } });

  // ---------------------------------- Format ----------------------------------
  defineAction({ name:'setStyle', label:'Set Rectangle Format', category:'Format', icon:'🎨',
    desc:'Per-rectangle format as JSON {numberFormat, fill, border, font, keepColours}; blank resets to the rectangle\'s format role ("Inputs" or "Calculations").',
    params:[ P('node','node'), P('style','json',{ optional:true }) ],
    run(a){
      requireType(a.node, ['value'], 'a rectangle');
      if(a.style === null){
        if(!a.node.style) return NOOP;
        pushHistory();
        delete a.node.style;
      } else {
        if(JSON.stringify(a.node.style || null) === JSON.stringify(a.style)) return NOOP;
        pushHistory();
        a.node.style = cloneData(a.style);
      }
    } });
  defineAction({ name:'applyFormat', label:'Apply Format Preset', category:'Format', icon:'🎨',
    params:[ SEL_NODES(), P('preset','enum',{ options: () => FORMAT_PRESETS.map(p => p.name) }) ],
    run(a){
      const p = FORMAT_PRESETS.find(x => x.name === a.preset);
      const list = a.nodes.filter(n => n.type === 'value');
      if(!list.length) return NOOP;
      pushHistory();
      list.forEach(n => { n.style = cloneData(p.style); });
    } });

  // ---------------------------------- Arrange ----------------------------------
  defineAction({ name:'move', label:'Move Nodes', category:'Arrange', icon:'✥',
    params:[ SEL_NODES(), P('dx','number',{ def:0 }), P('dy','number',{ def:0 }) ],
    run(a){
      const list = a.nodes.map(onActiveCanvas);
      if(!list.length || (!a.dx && !a.dy)) return NOOP;
      pushHistory();
      list.forEach(n => { n.x = clampPos(n.x + a.dx); n.y = clampPos(n.y + a.dy); });
    } });
  defineAction({ name:'moveTo', label:'Move Node To', category:'Arrange', icon:'✥',
    params:[ P('node','node'), P('x','number',{ coord:'x' }), P('y','number',{ coord:'y' }) ],
    run(a){
      onActiveCanvas(a.node);
      if(a.node.x === clampPos(a.x) && a.node.y === clampPos(a.y)) return NOOP;
      pushHistory();
      a.node.x = clampPos(a.x); a.node.y = clampPos(a.y);
    } });
  defineAction({ name:'resize', label:'Resize Node', category:'Arrange', icon:'⤡',
    params:[ P('node','node'), P('w','number'), P('h','number') ],
    run(a){
      onActiveCanvas(a.node);
      if(a.node.type === 'blockInstance') fail('Block instances size themselves to their ports.');
      const minW = (a.node.type === 'value' || a.node.type === 'alias') ? 80 : 30;
      const minH = (a.node.type === 'value' || a.node.type === 'alias') ? 44 : 30;
      const w = Math.max(minW, a.w), h = Math.max(minH, a.h);
      if(a.node.w === w && a.node.h === h) return NOOP;
      pushHistory();
      a.node.w = w; a.node.h = h;
    } });
  defineAction({ name:'align', label:'Align Nodes', category:'Arrange', icon:'⇤',
    params:[ P('mode','enum',{ options:['left','centerH','right','top','centerV','bottom'] }), SEL_NODES() ],
    run(a){ const list = a.nodes.map(onActiveCanvas); if(list.length < 2) return NOOP; alignSelected(a.mode, list); } });
  defineAction({ name:'distribute', label:'Distribute Nodes', category:'Arrange', icon:'⇿',
    params:[ P('axis','enum',{ options:['h','v'] }), SEL_NODES() ],
    run(a){ const list = a.nodes.map(onActiveCanvas); if(list.length < 3) return NOOP; distributeSelected(a.axis, list); } });

  // ---------------------------------- Select ----------------------------------
  defineAction({ name:'select', label:'Select Nodes', category:'Select', icon:'▢', mutates:false, params:[ P('nodes','nodes') ],
    run(a){ selectNodesOnly(a.nodes.map(onActiveCanvas).map(n => n.id)); } });
  defineAction({ name:'addToSelection', label:'Add to Selection', category:'Select', icon:'▢', mutates:false, params:[ P('nodes','nodes') ],
    run(a){ selectedEdgeId = null; a.nodes.map(onActiveCanvas).forEach(n => selectedNodeIds.add(n.id)); } });
  defineAction({ name:'selectAll', label:'Select All', category:'Select', icon:'▦', mutates:false,
    run(){ selectNodesOnly(nodes.map(n => n.id)); } });
  defineAction({ name:'clearSelection', label:'Clear Selection', category:'Select', icon:'⎋', mutates:false,
    run(){ clearSelection(); } });
  defineAction({ name:'selectEdge', label:'Select Connection', category:'Select', icon:'→', mutates:false,
    params:[ P('from','node'), P('to','node') ],
    run(a){
      const e = edges.find(x => x.from === a.from.id && x.to === a.to.id);
      if(!e) fail(`There is no arrow from ${describeNode(a.from)} to ${describeNode(a.to)}.`);
      selectEdgeOnly(e.id);
    } });

  // ---------------------------------- Canvas ----------------------------------
  defineAction({ name:'addCanvas', label:'New Canvas', category:'Canvas', icon:'🗋', returns:'canvas',
    params:[ P('name','string',{ def:'', help:'blank = automatic' }) ],
    run(a){
      addCanvas();
      const c = activeCanvas();
      if(a.name.trim()) c.name = a.name.trim();
      return c.id;
    } });
  defineAction({ name:'switchCanvas', label:'Go to Canvas', category:'Canvas', icon:'🗂', mutates:false,
    params:[ P('canvas','canvas') ],
    run(a){ if(a.canvas.id === activeCanvasId) return NOOP; switchToCanvas(a.canvas.id); } });
  defineAction({ name:'renameCanvas', label:'Rename Canvas', category:'Canvas', icon:'✎',
    params:[ P('canvas','canvas',{ def:'@current' }), P('name','string') ],
    run(a){
      const v = a.name.trim();
      if(!v) fail('A canvas name cannot be blank.');
      if(v === a.canvas.name) return NOOP;
      pushHistory();
      a.canvas.name = v;
    } });
  defineAction({ name:'deleteCanvas', label:'Delete Canvas', category:'Canvas', icon:'🗙',
    desc:'Deletes a canvas and everything on it (no confirmation).',
    params:[ P('canvas','canvas',{ def:'@current' }) ],
    run(a){
      if(canvases.length <= 1) fail('You need at least one canvas.');
      pushHistory();
      const idx = canvases.indexOf(a.canvas);
      const wasActive = a.canvas.id === activeCanvasId;
      canvases.splice(idx, 1);
      if(wasActive){
        const next = canvases[Math.max(0, idx - 1)];
        activeCanvasId = next.id;
        loadCanvasState(next);
        selectedNodeIds.clear(); selectedEdgeId = null;
      }
    } });

  defineAction({ name:'moveCanvas', label:'Move Canvas (reorder tabs)', category:'Canvas', icon:'⇄',
    desc:'Moves a canvas tab to a position (1 = first). Same as dragging the tab.',
    params:[ P('canvas','canvas',{ def:'@current' }), P('position','int',{ help:'1-based; ' + 'last = number of canvases' }) ],
    run(a){
      const from = canvases.indexOf(a.canvas);
      if(a.position < 1 || a.position > canvases.length) fail(`Position must be between 1 and ${canvases.length}.`);
      const to = a.position - 1;
      if(from === to) return NOOP;
      pushHistory();
      canvases.splice(from, 1);
      canvases.splice(to, 0, a.canvas);
    } });
  defineAction({ name:'clearAll', label:'Clear All Canvases', category:'Canvas', icon:'🧹',
    desc:'Removes every canvas and leaves one empty canvas named "Canvas 1" (no confirmation). Periods, templates, format presets and macros are kept.',
    run(){
      if(canvases.length === 1 && nodes.length === 0 && edges.length === 0 && canvases[0].name === 'Canvas 1') return NOOP;
      pushHistory();
      const c = { id: 'c' + (nextCanvasId++), name: 'Canvas 1', nodes: [], edges: [], computedValues: {}, computeErrors: {}, portValues: {}, portErrors: {} };
      canvases = [c];
      activeCanvasId = c.id;
      loadCanvasState(c);
      selectedNodeIds.clear(); selectedEdgeId = null;
      closePicker();
      clearComputed();
    } });

  // ---------------------------------- Periods ----------------------------------
  defineAction({ name:'setPeriodCount', label:'Set Number of Periods', category:'Periods', icon:'📅',
    params:[ P('count','int',{ min:1 }) ],
    run(a){
      if(a.count === periods.length) return NOOP;
      pushHistory();
      if(a.count > periods.length){ while(periods.length < a.count) periods.push('Period ' + (periods.length + 1)); }
      else { while(periods.length > a.count) periods.pop(); if(currentPeriod > periods.length - 1) currentPeriod = periods.length - 1; }
      reconcilePeriodValuesEverywhere();
      evaluateAll();
    } });
  defineAction({ name:'renamePeriod', label:'Rename Period', category:'Periods', icon:'✎',
    params:[ P('index','int',{ help:'1-based' }), P('label','string') ],
    run(a){
      const i = a.index - 1;
      if(i < 0 || i >= periods.length) fail(`There is no period ${a.index} (there are ${periods.length}).`);
      const v = a.label.trim() || ('Period ' + a.index);
      if(periods[i] === v) return NOOP;
      pushHistory();
      periods[i] = v;
    } });
  defineAction({ name:'setPeriod', label:'View Period', category:'Periods', icon:'📅', mutates:false,
    params:[ P('index','int',{ help:'1-based' }) ],
    run(a){
      if(a.index < 1 || a.index > periods.length) fail(`There is no period ${a.index} (there are ${periods.length}).`);
      if(a.index - 1 === currentPeriod) return NOOP;
      setCurrentPeriod(a.index - 1);
    } });
  defineAction({ name:'nextPeriod', label:'Next Period', category:'Periods', icon:'›', mutates:false,
    run(){ if(currentPeriod >= periods.length - 1) return NOOP; setCurrentPeriod(currentPeriod + 1); } });
  defineAction({ name:'prevPeriod', label:'Previous Period', category:'Periods', icon:'‹', mutates:false,
    run(){ if(currentPeriod <= 0) return NOOP; setCurrentPeriod(currentPeriod - 1); } });

  // ---------------------------------- Compute / File ----------------------------------
  defineAction({ name:'evaluate', label:'Evaluate', category:'Compute', icon:'▶', mutates:false,
    run(){ evaluateAll(); } });
  defineAction({ name:'getValue', label:'Get Computed Value', category:'Compute', icon:'=', mutates:false, tx:false, record:false, returns:'value',
    desc:'Evaluates the model and returns a node\'s value (a block instance returns its outputs). Save it to a variable to use in later steps.',
    params:[ P('node','node'), P('period','int',{ optional:true, help:'1-based; default = viewed period' }) ],
    run(a){
      evaluateAllNow();
      const c = activeCanvas();
      const p = a.period === null ? currentPeriod : a.period - 1;
      if(p < 0 || p >= periods.length) fail(`There is no period ${a.period}.`);
      if(a.node.type === 'blockInstance'){
        const pv = (c.periodPortValues && c.periodPortValues[p] && c.periodPortValues[p][a.node.id]) || [];
        return pv.slice();
      }
      const v = c.periodComputedValues && c.periodComputedValues[p] ? c.periodComputedValues[p][a.node.id] : undefined;
      if(v === undefined || v === null){
        const err = c.periodComputeErrors && c.periodComputeErrors[p] ? c.periodComputeErrors[p][a.node.id] : null;
        fail(`${describeNode(a.node)} has no value${err ? ': ' + errorTitle(err) : ''}.`);
      }
      return v;
    } });
  defineAction({ name:'saveSystem', label:'Save System (download)', category:'File', icon:'💾', mutates:false, tx:false,
    run(){ saveSystemToFile(); } });
  defineAction({ name:'saveModule', label:'Save Module (download)', category:'File', icon:'📦', mutates:false, tx:false,
    run(){ syncActiveIntoRegistry(); saveModuleToFile(); } });
  defineAction({ name:'exportWorkspace', label:'Export Workspace (download)', category:'File', icon:'⇩', mutates:false, tx:false,
    run(){ exportWorkspaceToFile(); } });
  defineAction({ name:'message', label:'Show Message', category:'Macros', icon:'💬', mutates:false, tx:false, record:false,
    desc:'Shows a message box (useful in macros). ${var} inserts a variable.',
    params:[ P('text','text') ],
    run(a){ showMessage(a.text); } });

  // ---------------------------------- public API ----------------------------------
  // fm.createRect({x:100, y:200, name:'Revenue'})  or positionally  fm.createRect(100, 200, 'Revenue')
  const fm = {};
  ACTION_LIST.forEach(def => {
    fm[def.name] = function(...argsIn){
      const named = argsIn.length === 1 && argsIn[0] && typeof argsIn[0] === 'object' && !Array.isArray(argsIn[0])
        && !(argsIn[0].id && argsIn[0].type) && !(def.params[0] && ['json'].includes(def.params[0].type));
      return callAction(def.name, named ? argsIn[0] : argsIn);
    };
  });
  fm.batch = (fn) => runBatch(fn);
  fm.run = (name, args) => callAction(name, args);
  fm.actions = () => ACTION_LIST.map(d => ({ name: d.name, label: d.label, category: d.category, description: d.desc || '',
    params: d.params.map(p => ({ name: p.name, type: p.type, default: typeof p.def === 'function' ? '(auto)' : p.def, optional: !!p.optional, options: p.type === 'enum' ? paramOptions(p) : undefined })) }));
  fm.find = (ref) => { const n = resolveOneNode(ref); return n.id; };
  fm.nodes = () => nodes.map(n => ({ id: n.id, type: n.type, name: refNameOf(n), x: n.x, y: n.y, w: n.w, h: n.h, text: n.text }));
  fm.edges = () => edges.map(e => Object.assign({}, e));
  fm.selection = () => Array.from(selectedNodeIds);
  fm.canvases = () => canvases.map(c => ({ id: c.id, name: c.name, active: c.id === activeCanvasId }));
  fm.command = (id) => runCommand(id);
  fm.commands = () => COMMANDS.map(c => ({ id: c.id, label: c.label, category: c.category, shortcut: shortcutBindings[c.id] || null }));
  fm.runMacro = (ref) => callAction('runMacro', { macro: ref });

