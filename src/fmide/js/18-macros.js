  // =====================================================================================
  // ---------- Macros: model · recorder · runner ----------
  // =====================================================================================
  // A macro is a tree of steps:
  //   { kind:'action',  action:'createRect', args:{...}, assign:'r1' }   run one fm action
  //   { kind:'group',   label, children:[...] }                          just organises steps
  //   { kind:'repeat',  count:'3', var:'i', children:[...] }             $i = 1..count
  //   { kind:'forEach', nodes:'@sel', var:'item', children:[...] }       $item = each node's id
  //   { kind:'set',     var:'x', value:'100 + $i*80' }                   set a variable
  //   { kind:'comment', text }
  // Every step may have disabled:true and comment:'...'.
  let MACROS = [];
  let nextMacroNum = 1;
  let lastRunMacroId = null;
  let stepSeq = 1;
  function newStepId(){ return 's' + (stepSeq++) + Math.random().toString(36).slice(2, 6); }
  const CONTAINER_KINDS = new Set(['group', 'repeat', 'forEach']);

  function walkSteps(steps, fn, parentStep){
    (steps || []).forEach((st, i) => { fn(st, steps, i, parentStep || null); if(CONTAINER_KINDS.has(st.kind)) walkSteps(st.children, fn, st); });
  }
  function findStep(steps, id){
    let hit = null;
    walkSteps(steps, (st, arr, i, parent) => { if(!hit && st.id === id) hit = { step: st, arr, index: i, parent }; });
    return hit;
  }
  function normalizeSteps(steps){
    return (Array.isArray(steps) ? steps : []).filter(s => s && typeof s === 'object').map(s => {
      const st = Object.assign({}, s, { id: newStepId() });
      if(!st.kind) st.kind = 'action';
      if(st.kind === 'action') st.args = Object.assign({}, st.args || {});
      if(CONTAINER_KINDS.has(st.kind)) st.children = normalizeSteps(st.children);
      return st;
    });
  }
  function createMacro(name){
    const m = { id: 'mac' + Date.now().toString(36) + (nextMacroNum++), name: name || ('Macro ' + (MACROS.length + 1)), description:'', relative:false, pinned:false, steps:[] };
    MACROS.push(m);
    return m;
  }
  function countSteps(steps){ let n = 0; walkSteps(steps, () => n++); return n; }

  function fmtArg(v){
    if(Array.isArray(v)) return '[' + v.map(fmtArg).join(', ') + ']';
    if(v && typeof v === 'object') return JSON.stringify(v);
    const s = String(v);
    return /[\s,=]/.test(s) || s === '' ? JSON.stringify(s) : s;
  }
  function stepSummaryText(st){
    switch(st.kind){
      case 'action': {
        const args = Object.keys(st.args || {}).map(k => k + '=' + fmtArg(st.args[k])).join(' ');
        return st.action + (args ? ' ' + args : '') + (st.assign ? '  → $' + st.assign : '');
      }
      case 'group': return 'Group: ' + (st.label || '(untitled)');
      case 'repeat': return `Repeat ${st.count || 1}× (as $${st.var || 'i'})`;
      case 'forEach': return `For each node in ${fmtArg(st.nodes || '@sel')} (as $${st.var || 'item'})`;
      case 'set': return `$${st.var || 'x'} = ${st.value == null ? '' : st.value}`;
      case 'comment': return '# ' + (st.text || '');
    }
    return st.kind;
  }

  // ---------- recorder ----------
  const recorder = {
    active:false, steps:[], created:new Map(), createdCanvases:new Map(), counter:0,
    selRefs:false, initialSel:[], selCanvasId:null, origin:null, macroId:null, isNewMacro:false, histAtStart:0,

    refOf(n){
      if(this.created.has(n.id)) return this.created.get(n.id);
      if(this.selRefs && n && this.initialSel.includes(n.id)) return `@sel[${this.initialSel.indexOf(n.id)}]`;
      const c = canvasOfNode(n);
      const nm = refNameOf(n);
      if(nm && isPlainRefName(nm) && c){
        try{ if(resolveOneNode(nm, c) === n) return nm; }catch(err){ /* ambiguous: fall back to id */ }
      }
      return '#' + n.id;
    },
    refsOf(list){
      const ids = list.map(n => n.id);
      if(this.selRefs && ids.length && ids.length === this.initialSel.length && ids.every(id => this.initialSel.includes(id))) return '@sel';
      return list.map(n => this.refOf(n));
    },
    canvasRef(c){
      if(this.createdCanvases.has(c.id)) return this.createdCanvases.get(c.id);
      const same = canvases.filter(x => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      return same.length === 1 && isPlainRefName(c.name) ? c.name : '#' + c.id;
    },
    convertArgs(name, args){
      const def = ACTIONS[name];
      const out = {};
      def.params.forEach(p => {
        if(!(p.name in args)) return;
        let v = args[p.name];
        if(v === null || v === undefined) return;
        if(p.type === 'node') v = this.refOf(v);
        else if(p.type === 'nodes') v = this.refsOf(v);
        else if(p.type === 'canvas') v = this.canvasRef(v);
        else if(p.type === 'template') v = TEMPLATES.filter(t => t.name === v.name).length === 1 ? v.name : '#' + v.id;
        else if(p.type === 'macro') v = v.name;
        else if(p.coord && this.origin && typeof v === 'number') v = v - this.origin[p.coord];
        if(typeof v === 'number') v = Math.round(v * 1000) / 1000;
        const simple = !['node', 'nodes', 'canvas', 'template', 'macro'].includes(p.type);
        if(simple && p.def !== undefined && typeof p.def !== 'function' && String(v) === String(p.def)) return;
        out[p.name] = v;
      });
      return out;
    },
    push(name, args, result){
      const def = ACTIONS[name];
      const step = { id: newStepId(), kind:'action', action: name, args };
      if(def.returns && def.returns !== 'value' && def.returns !== 'edge' && result != null){
        const v = (def.returns === 'canvas' ? 'c' : 'r') + (++this.counter);
        step.assign = v;
        if(Array.isArray(result)) result.forEach((id, i) => this.created.set(id, `$${v}[${i}]`));
        else if(def.returns === 'canvas') this.createdCanvases.set(result, '$' + v);
        else this.created.set(result, '$' + v);
      }
      if(!this.coalesce(step)) this.steps.push(step);
      refreshCommandStates();
    },
    // record an interaction that was already applied directly (e.g. a mouse drag)
    add(name, resolvedArgs, result){
      if(!this.active) return;
      this.push(name, this.convertArgs(name, resolvedArgs), result);
    },
    // folds follow-up edits into the step that created the node, and merges repeats
    coalesce(step){
      const last = this.steps[this.steps.length - 1];
      if(!last || last.kind !== 'action') return false;
      const A = step.args, L = last.args;
      const sameList = (a, b) => JSON.stringify(Array.isArray(a) ? a : [a]) === JSON.stringify(Array.isArray(b) ? b : [b]);
      if(last.assign){
        const ref = '$' + last.assign;
        if(step.action === 'setText' && last.action === 'createRect' && A.node === ref){
          const parts = textParts({ text: A.text });
          ['name', 'value', 'uom'].forEach(k => { if(parts[k] !== '' || k !== 'uom') L[k] = parts[k]; else delete L[k]; });
          if(L.name === 'New Node') delete L.name;
          if(L.value === '0') delete L.value;
          return true;
        }
        if(step.action === 'setOperator' && last.action === 'createOperator' && A.node === ref){ L.op = A.op; return true; }
        if(step.action === 'setShift' && last.action === 'createPeriodShift' && A.node === ref){ L.shift = A.shift; return true; }
        if(step.action === 'move' && /^create/.test(last.action) && sameList(A.nodes, ref) && typeof L.x === 'number' && typeof L.y === 'number'){
          L.x = Math.round((L.x + (A.dx || 0)) * 1000) / 1000; L.y = Math.round((L.y + (A.dy || 0)) * 1000) / 1000; return true;
        }
        if(step.action === 'resize' && last.action === 'createRect' && A.node === ref){ L.w = A.w; L.h = A.h; return true; }
      }
      if(step.action === 'move' && last.action === 'move' && sameList(A.nodes, L.nodes)){
        L.dx = (L.dx || 0) + (A.dx || 0); L.dy = (L.dy || 0) + (A.dy || 0);
        if(!L.dx) delete L.dx;
        if(!L.dy) delete L.dy;
        return true;
      }
      if((step.action === 'setPeriod' || step.action === 'switchCanvas') && last.action === step.action){ last.args = A; return true; }
      if(step.action === 'setText' && last.action === 'setText' && L.node === A.node){ L.text = A.text; return true; }
      return false;
    },
    onUndo(){
      if(history.length <= this.histAtStart || !this.steps.length) return;
      const isMut = s => s.kind === 'action' && ACTIONS[s.action] && ACTIONS[s.action].mutates !== false;
      while(this.steps.length && !isMut(this.steps[this.steps.length - 1])) this.steps.pop();
      if(this.steps.length) this.steps.pop();
      toast('Undo — the last recorded step was removed.');
      refreshCommandStates();
    },
  };

  function viewCenter(){
    return { x: Math.round(viewport.scrollLeft + viewport.clientWidth / 2 - 85), y: Math.round(viewport.scrollTop + viewport.clientHeight / 2 - 32) };
  }
  // Origin for relative-coordinate macros: the selection's top-left corner, else the view centre.
  function computeOrigin(){
    const sel = selectedNodesList();
    if(sel.length){ const bb = boundingBoxOf(sel); return { x: Math.round(bb.minX), y: Math.round(bb.minY) }; }
    return viewCenter();
  }

  function startRecording(opts){
    if(recorder.active) return;
    let m = opts.macroId ? MACROS.find(x => x.id === opts.macroId) : null;
    recorder.isNewMacro = !m;
    if(!m){ m = createMacro(opts.name); m.relative = !!opts.relative; }
    recorder.macroId = m.id;
    recorder.steps = [];
    recorder.created = new Map();
    recorder.createdCanvases = new Map();
    let maxN = 0;
    walkSteps(m.steps, st => { const mm = /^[rc](\d+)$/.exec(st.assign || ''); if(mm) maxN = Math.max(maxN, +mm[1]); });
    recorder.counter = maxN;
    recorder.initialSel = Array.from(selectedNodeIds);
    recorder.selRefs = !!opts.selRefs && recorder.initialSel.length > 0;
    recorder.selCanvasId = activeCanvasId;
    recorder.origin = m.relative ? computeOrigin() : null;
    recorder.histAtStart = history.length;
    recorder.active = true;
    renderRibbon();
    toast('Recording — work on the canvas as usual. Click the red pill to stop.', 3500);
  }

  function stopRecording(){
    if(!recorder.active) return;
    recorder.active = false;
    const m = MACROS.find(x => x.id === recorder.macroId);
    const steps = recorder.steps;
    recorder.steps = [];
    if(!m){ renderRibbon(); return; }
    if(steps.length === 0){
      if(recorder.isNewMacro) MACROS = MACROS.filter(x => x !== m);
      syncMacroCommands();
      toast('Nothing was recorded.');
      return;
    }
    m.steps = m.steps.concat(steps);
    syncMacroCommands();
    saveWorkspaceToLocalStorage();
    showMacroBuilder(m.id, steps[0].id);
    mbSetStatus(`Recorded ${steps.length} step${steps.length === 1 ? '' : 's'}.`, 'ok');
  }

  function toggleRecordingQuick(){
    if(recorder.active) stopRecording();
    else showRecordDialog({});
  }

  // ---------- runner ----------
  function evalSetValue(v){
    if(typeof v === 'number') return v;
    const s = String(v == null ? '' : v).trim();
    if(/^\$[A-Za-z_]\w*(\[\d+\])?$/.test(s)) return lookupVar(s);
    try{ return evalNumber(s, 'value'); }catch(err){ return interpolate(s); }
  }

  function execSteps(steps){
    for(const st of steps || []){
      if(st.disabled) continue;
      try{
        switch(st.kind){
          case 'action': {
            const r = callAction(st.action, Object.assign({}, st.args || {}));
            if(st.assign) runCtx.vars[st.assign] = r;
            break;
          }
          case 'group': execSteps(st.children); break;
          case 'repeat': {
            const n = Math.floor(evalNumber(st.count == null || st.count === '' ? 1 : st.count, 'Repeat count'));
            if(n < 0) fail('Repeat count cannot be negative.');
            if(n > 5000) fail('Repeat count is limited to 5000.');
            const v = st.var || 'i';
            for(let k = 1; k <= n; k++){ runCtx.vars[v] = k; execSteps(st.children); }
            break;
          }
          case 'forEach': {
            const ids = resolveNodes(st.nodes == null || st.nodes === '' ? '@sel' : st.nodes).map(n => n.id);
            const v = st.var || 'item';
            ids.forEach((id, k) => { runCtx.vars[v] = id; runCtx.vars[v + 'Index'] = k + 1; execSteps(st.children); });
            break;
          }
          case 'set': runCtx.vars[st.var || 'x'] = evalSetValue(st.value); break;
          default: break;
        }
      }catch(err){
        if(!err.macroStepId){
          err.macroStepId = st.id;
          err.macroId = runCtx && runCtx.macro ? runCtx.macro.id : null;
          if(err instanceof FmError) err.message = `Step "${stepSummaryText(st)}" — ${err.message}`;
        }
        throw err;
      }
    }
  }

  function executeMacro(m, onlySteps){
    if(macroDepth >= 16) fail('Macros are nested too deeply — is a macro running itself?');
    const prev = runCtx;
    runCtx = { vars: {}, startSelection: prev ? prev.startSelection : Array.from(selectedNodeIds), origin: m.relative ? computeOrigin() : null, macro: m };
    macroDepth++;
    try{ execSteps(onlySteps || m.steps); }
    finally{ macroDepth--; runCtx = prev; }
  }

  defineAction({ name:'runMacro', label:'Run Macro', category:'Macros', icon:'⚡', batch:true,
    desc:'Runs another macro (as one undo step; if any step fails, nothing is changed).',
    params:[ P('macro','macro') ],
    run(a){ executeMacro(a.macro); } });

  function runMacroInteractive(id, onlyStepIds){
    const m = MACROS.find(x => x.id === id);
    if(!m) return false;
    lastRunMacroId = id;
    try{
      if(onlyStepIds){
        const steps = onlyStepIds.map(sid => { const f = findStep(m.steps, sid); return f && f.step; }).filter(Boolean);
        apiDepth++;
        try{ runBatch(() => executeMacro(m, steps)); } finally{ apiDepth--; }
      } else {
        callAction('runMacro', { macro: m });
      }
      refreshCommandStates();
      if(!mb.overlay) toast(`Macro "${m.name}" finished.`);
      return true;
    }catch(err){
      refreshCommandStates();
      const msg = (err instanceof FmError ? err.message : ('Error: ' + (err && err.message)));
      if(mb.overlay && mb.macroId === id){
        mb.errorStepId = err.macroStepId || null;
        if(err.macroStepId) mb.selStepId = err.macroStepId;
        renderMBTree(); renderMBProps();
        mbSetStatus('Stopped — nothing was changed. ' + msg, 'err');
      } else {
        showMessage(`Macro "${m.name}" stopped, and nothing was changed.\n\n${msg}`);
      }
      return false;
    }
  }

  // Keeps the COMMANDS list (and so shortcuts, launcher, ribbon) in step with MACROS.
  function syncMacroCommands(){
    for(let i = COMMANDS.length - 1; i >= 0; i--) if(COMMANDS[i].id.startsWith('macro:')) COMMANDS.splice(i, 1);
    MACROS.forEach(m => {
      COMMANDS.push({ id:'macro:' + m.id, label:'Macro: ' + m.name, short: m.name, icon:'⚡', category:'Macros', defaultShortcut:null,
        action:() => runMacroInteractive(m.id) });
    });
    Object.keys(shortcutBindings).forEach(k => { if(k.startsWith('macro:') && !getCommand(k)) delete shortcutBindings[k]; });
    COMMANDS.forEach(c => { if(!(c.id in shortcutBindings)) shortcutBindings[c.id] = c.defaultShortcut || null; });
    rebuildShortcutMap();
    syncPinnedMacrosIntoRibbon();
    renderRibbon();
  }
  function syncPinnedMacrosIntoRibbon(){
    const cfg = ribbonState.config;
    const alive = id => !id.startsWith('macro:') || MACROS.some(m => 'macro:' + m.id === id);
    cfg.qat = (cfg.qat || []).filter(alive);
    cfg.tabs.forEach(t => t.groups.forEach(g => { g.items = (g.items || []).filter(it => alive(it.cmd)); }));
    let g = null;
    cfg.tabs.forEach(t => t.groups.forEach(gg => { if(gg.id === 'myMacros') g = gg; }));
    const pinned = MACROS.filter(m => m.pinned);
    if(!g && pinned.length){
      let t = cfg.tabs.find(x => x.id === 'macros');
      if(!t){ t = { id:'macros', label:'Macros', keytip:'X', groups:[] }; cfg.tabs.push(t); }
      g = { label:'My Macros', id:'myMacros', items:[] };
      t.groups.push(g);
    }
    if(!g) return;
    g.items = g.items.filter(it => { const m = MACROS.find(x => 'macro:' + x.id === it.cmd); return !m || m.pinned; });
    pinned.forEach(m => { if(!g.items.some(it => it.cmd === 'macro:' + m.id)) g.items.push({ cmd:'macro:' + m.id, size:'large' }); });
  }

