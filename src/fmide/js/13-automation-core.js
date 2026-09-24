  // =====================================================================================
  // ---------- automation layer: transactions · node references · the fm API ----------
  // =====================================================================================
  // Every model-changing interaction in fmIDE is an *action* in ACTIONS below: mouse and
  // keyboard handlers, Ribbon/QAT buttons, the Command Launcher and macros all call the
  // same action through callAction(). An action runs inside a transaction, so it is one
  // undo step and renders once; a macro run is one bigger transaction that rolls back
  // completely if any step fails. The public surface is `window.fm` (fm.createRect(...),
  // fm.connect(...), ...), which is also what the Macro Builder's steps call.

  const tx = { depth: 0, pushed: false, needEval: false };
  let apiDepth = 0;        // >0 while an action is running (nested calls are not recorded)
  let runCtx = null;       // { vars, startSelection, origin, macro } while a macro runs
  let macroDepth = 0;
  const NOOP = { __noop: true };
  const REDUCERS = ['sum', 'max', 'min', 'ave', 'product'];

  class FmError extends Error { constructor(msg){ super(msg); this.name = 'FmError'; } }
  function fail(msg){ throw new FmError(msg); }

  function reportError(err){
    if(err instanceof FmError) showMessage(err.message);
    else { console.error(err); showMessage('Something went wrong: ' + (err && err.message ? err.message : String(err))); }
  }
  function guarded(fn){ try{ return fn(); }catch(err){ reportError(err); return undefined; } }

  let toastTimer = null;
  function toast(msg, ms){
    let el = document.getElementById('fmToast');
    if(!el){ el = document.createElement('div'); el.id = 'fmToast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; }, ms || 2200);
  }

  // One transaction: history is pushed at most once, rendering/evaluation happen at the end.
  function inTx(fn){
    tx.depth++;
    try{ return fn(); }
    finally{
      tx.depth--;
      if(tx.depth === 0){
        tx.pushed = false;
        const needEval = tx.needEval;
        tx.needEval = false;
        if(needEval) evaluateAllNow(); else render();
        renderCanvasTabs();
        refreshCommandStates();
      }
    }
  }

  // All-or-nothing transaction: on error everything the batch changed is rolled back.
  function runBatch(fn){
    if(tx.depth > 0) return fn();
    const before = snapshot();
    const histLen = history.length;
    const futureBefore = future.slice();
    const selBefore = Array.from(selectedNodeIds);
    const edgeSelBefore = selectedEdgeId;
    try{
      return inTx(fn);
    }catch(err){
      history.length = histLen;
      future = futureBefore;
      restore(before);
      selectedNodeIds = new Set(selBefore.filter(id => nodes.some(n => n.id === id)));
      selectedEdgeId = edges.some(e => e.id === edgeSelBefore) ? edgeSelBefore : null;
      render(); renderCanvasTabs(); refreshCommandStates();
      throw err;
    }
  }

  // ---------- node / canvas references ----------
  // A reference is how an action argument names something:
  //   Revenue          a rectangle by its name (1st line); aliases/blocks by the name they show
  //   #n12             a node by id           @sel / @sel[0]   the selection (in a macro: as it was when the macro started)
  //   @cur / @cur[0]   the live selection     @all             every node on the canvas
  //   $r1 / $r1[0]     a macro variable (e.g. the id a Create step returned)
  //   Canvas::Name     a rectangle on another canvas (alias sources)
  //   A, B, C          several references (for "nodes" arguments)
  function activeCanvas(){ return canvases.find(c => c.id === activeCanvasId); }
  function nodesIn(c){ return c.id === activeCanvasId ? nodes : c.nodes; }
  function canvasOfNode(n){ return canvases.find(c => nodesIn(c).includes(n)) || null; }

  function refNameOf(n){
    if(!n) return '';
    if(n.type === 'value') return (parseNode(n).name || '').trim();
    if(n.type === 'alias'){
      const sc = canvases.find(c => c.id === n.sourceCanvasId);
      const sn = sc ? nodesIn(sc).find(x => x.id === n.sourceNodeId) : null;
      return sn ? (parseNode(sn).name || '').trim() : '';
    }
    if(n.type === 'blockInstance'){
      const d = canvases.find(c => c.id === n.blockDefCanvasId);
      return d ? d.name.trim() : '';
    }
    return '';
  }
  function describeNode(n){
    const nm = refNameOf(n);
    if(n.type === 'operator') return `operator ${n.text}`;
    if(n.type === 'periodShift') return `period shift ${shiftLabel(typeof n.shift === 'number' ? n.shift : -1)}`;
    return nm ? `"${nm}"` : `#${n.id}`;
  }

  function lookupVar(token){
    const m = /^\$([A-Za-z_]\w*)(?:\[(\d+)\])?$/.exec(String(token).trim());
    if(!m) fail(`"${token}" is not a valid variable reference.`);
    const name = m[1];
    const vars = runCtx ? runCtx.vars : {};
    let v;
    if(Object.prototype.hasOwnProperty.call(vars, name)) v = vars[name];
    else if(name === 'periods') v = periods.length;
    else if(name === 'period') v = currentPeriod + 1;
    else fail(`Variable $${name} has no value yet.`);
    if(m[2] !== undefined){
      if(!Array.isArray(v)) fail(`$${name} is not a list, so $${name}[${m[2]}] is not valid.`);
      v = v[+m[2]];
      if(v === undefined) fail(`$${name} has no item [${m[2]}].`);
    }
    return v;
  }

  function isPlainRefName(s){ return !!s && !/^[@$#]/.test(s) && !s.includes(',') && !s.includes('::') && !/^n\d+$/.test(s); }

  function findNodeByName(name, c){
    const lc = name.trim().toLowerCase();
    const pool = nodesIn(c);
    const vals = pool.filter(n => n.type === 'value' && (parseNode(n).name || '').trim().toLowerCase() === lc);
    if(vals.length === 1) return vals[0];
    if(vals.length > 1) fail(`${vals.length} rectangles on "${c.name}" are named "${name}" — rename one, or refer to it by id (#id).`);
    const others = pool.filter(n => (n.type === 'alias' || n.type === 'blockInstance') && refNameOf(n).toLowerCase() === lc);
    if(others.length === 1) return others[0];
    if(others.length > 1) fail(`${others.length} nodes on "${c.name}" are called "${name}" — refer to one by id (#id).`);
    fail(`There is no rectangle named "${name}" on canvas "${c.name}".`);
  }

  function selectionIds(kind){
    if(kind === 'cur' || !runCtx) return Array.from(selectedNodeIds);
    return runCtx.startSelection;
  }

  function resolveNodes(ref, c){
    c = c || activeCanvas();
    if(ref === undefined || ref === null || ref === '') return [];
    if(Array.isArray(ref)) return ref.flatMap(r => resolveNodes(r, c));
    if(typeof ref === 'object'){
      if(ref.id && canvasOfNode(ref)) return [ref];
      fail('Unknown node.');
    }
    const s = String(ref).trim();
    if(s === '') return [];
    if(s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean).flatMap(x => resolveNodes(x, c));
    if(s.includes('::')){
      const k = s.indexOf('::');
      return resolveNodes(s.slice(k + 2), resolveCanvasRef(s.slice(0, k)));
    }
    const pool = nodesIn(c);
    let m = /^@(sel|cur)(?:\[(\d+)\])?$/.exec(s);
    if(m){
      const ids = selectionIds(m[1]);
      const list = ids.map(id => pool.find(n => n.id === id)).filter(Boolean);
      if(m[2] === undefined) return list;
      const one = list[+m[2]];
      if(!one) fail(`The selection has no item [${m[2]}] (it has ${list.length}).`);
      return [one];
    }
    if(s === '@all') return pool.slice();
    if(s.startsWith('$')){
      const v = lookupVar(s);
      const list = Array.isArray(v) ? v : [v];
      return list.map(id => {
        const n = pool.find(x => x.id === id);
        if(!n) fail(`${s} does not refer to a node on canvas "${c.name}".`);
        return n;
      });
    }
    if(s.startsWith('#')){
      const n = pool.find(x => x.id === s.slice(1));
      if(!n) fail(`There is no node ${s} on canvas "${c.name}".`);
      return [n];
    }
    if(/^n\d+$/.test(s)){
      const n = pool.find(x => x.id === s);
      if(n) return [n];
    }
    return [findNodeByName(s, c)];
  }

  function resolveOneNode(ref, c){
    const list = resolveNodes(ref, c);
    if(list.length === 1) return list[0];
    if(list.length === 0) fail(ref === '' || ref == null ? 'No node was given.' : `Nothing matched "${ref}".`);
    fail(`Expected one node, but "${Array.isArray(ref) ? ref.join(', ') : ref}" matched ${list.length}.`);
  }

  function resolveCanvasRef(ref){
    if(ref && typeof ref === 'object' && Array.isArray(ref.nodes)) return ref;
    if(ref === undefined || ref === null || ref === '' || ref === '@current') return activeCanvas();
    let s = String(ref).trim();
    if(s.startsWith('$')) s = String(lookupVar(s));
    const id = s.startsWith('#') ? s.slice(1) : s;
    const byId = canvases.find(c => c.id === id);
    if(byId) return byId;
    const lc = s.toLowerCase();
    const byName = canvases.filter(c => c.name.trim().toLowerCase() === lc);
    if(byName.length === 1) return byName[0];
    if(byName.length > 1) fail(`More than one canvas is named "${s}" — refer to it by id (#id).`);
    fail(`There is no canvas called "${s}".`);
  }

  function resolveTemplateRef(ref){
    if(ref && typeof ref === 'object' && ref.data) return ref;
    const s = String(ref || '').trim();
    const byId = TEMPLATES.find(t => t.id === s || '#' + t.id === s);
    if(byId) return byId;
    const byName = TEMPLATES.filter(t => t.name.trim().toLowerCase() === s.toLowerCase());
    if(byName.length === 1) return byName[0];
    if(byName.length > 1) fail(`More than one template is named "${s}".`);
    fail(`There is no template called "${s}".`);
  }

  function resolveMacroRef(ref){
    if(ref && typeof ref === 'object' && Array.isArray(ref.steps)) return ref;
    const s = String(ref || '').trim();
    const byId = MACROS.find(m => m.id === s || '#' + m.id === s);
    if(byId) return byId;
    const byName = MACROS.filter(m => m.name.trim().toLowerCase() === s.toLowerCase());
    if(byName.length === 1) return byName[0];
    if(byName.length > 1) fail(`More than one macro is named "${s}".`);
    fail(`There is no macro called "${s}".`);
  }

  // ---------- small expression language for numeric arguments ----------
  // Numbers, + - * / % ( ), $variables, and min/max/round/floor/ceil/abs(...).
  function evalExpr(src){
    let i = 0;
    const s = String(src);
    function ws(){ while(i < s.length && /\s/.test(s[i])) i++; }
    function expr(){
      let v = term();
      for(;;){ ws(); const c = s[i]; if(c === '+'){ i++; v += term(); } else if(c === '-'){ i++; v -= term(); } else return v; }
    }
    function term(){
      let v = factor();
      for(;;){
        ws(); const c = s[i];
        if(c === '*'){ i++; v *= factor(); }
        else if(c === '/'){ i++; v /= factor(); }
        else if(c === '%'){ i++; v %= factor(); }
        else return v;
      }
    }
    function factor(){
      ws();
      const c = s[i];
      if(c === '-'){ i++; return -factor(); }
      if(c === '+'){ i++; return factor(); }
      if(c === '('){ i++; const v = expr(); ws(); if(s[i] !== ')') fail(`Missing ")" in "${s}".`); i++; return v; }
      if(c === '$'){
        const m = /^\$[A-Za-z_]\w*(\[\d+\])?/.exec(s.slice(i));
        if(!m) fail(`Bad variable in "${s}".`);
        i += m[0].length;
        const v = lookupVar(m[0]);
        const num = typeof v === 'number' ? v : Number(v);
        if(!isFinite(num)) fail(`${m[0]} is not a number (it is "${v}").`);
        return num;
      }
      let m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
      if(m){ i += m[0].length; return Number(m[0]); }
      m = /^(min|max|round|floor|ceil|abs)\s*\(/i.exec(s.slice(i));
      if(m){
        i += m[0].length;
        const args = [expr()];
        ws();
        while(s[i] === ','){ i++; args.push(expr()); ws(); }
        if(s[i] !== ')') fail(`Missing ")" in "${s}".`);
        i++;
        return Math[m[1].toLowerCase()](...args);
      }
      fail(`Could not read the number or expression "${s}".`);
    }
    const v = expr();
    ws();
    if(i < s.length) fail(`Unexpected "${s.slice(i)}" in "${s}".`);
    return v;
  }
  function evalNumber(v, label){
    if(typeof v === 'number'){ if(!isFinite(v)) fail(`${label} is not a finite number.`); return v; }
    if(typeof v === 'boolean') return v ? 1 : 0;
    const s = String(v).trim();
    if(s === '') fail(`${label} is empty.`);
    const n = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : evalExpr(s);
    if(!isFinite(n)) fail(`${label} is not a finite number.`);
    return n;
  }
  // "${var}" / "${expr}" inside text arguments
  function interpolate(str){
    if(typeof str !== 'string' || !str.includes('${')) return str;
    return str.replace(/\$\{([^}]+)\}/g, (all, inner) => {
      const t = inner.trim();
      if(/^[A-Za-z_]\w*(\[\d+\])?$/.test(t)){
        const v = lookupVar('$' + t);
        return typeof v === 'number' ? formatNum(v) : String(v);
      }
      return formatNum(evalExpr(t.replace(/\b([A-Za-z_]\w*)\b(?!\s*\()/g, '$$$1')));
    });
  }
  function toBool(v){
    if(typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if(['true','yes','y','1','on'].includes(s)) return true;
    if(['false','no','n','0','off',''].includes(s)) return false;
    fail(`"${v}" is not true/false.`);
  }

  // ---------- rectangle text helpers (Name / Value / UOM lines) ----------
  function textParts(n){
    const lines = (n.text || '').split('\n');
    if(lines.length === 1){
      const t = lines[0].trim();
      if(t !== '' && !isNaN(Number(t))) return { name:'', value:t, uom:'' };
      return { name: lines[0], value:'', uom:'' };
    }
    return { name: lines[0], value: (lines[1] || '').trim(), uom: lines.slice(2).join(' ').trim() };
  }
  function composeText(p){
    const l = [p.name == null ? '' : String(p.name), p.value == null ? '' : String(p.value).trim(), p.uom == null ? '' : String(p.uom).trim()];
    while(l.length > 1 && l[l.length - 1] === '') l.pop();
    const t = l.join('\n');
    return t.trim() === '' ? 'Untitled' : t;
  }

