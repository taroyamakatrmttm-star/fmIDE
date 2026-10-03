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
  //   @all[3]          the 4th node on the canvas, counted without the automatic plug aliases
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
    if(n.type === 'function') return `function ${n.fn && typeof n.fn.name === 'string' ? n.fn.name : '(unnamed)'}`;
    if(n.type === 'periodShift') return `period shift ${shiftLabel(typeof n.shift === 'number' ? n.shift : -1)}`;
    return nm ? `"${nm}"` : `#${n.id}`;
  }

  // How a macro step refers to a node or canvas: its name when that finds exactly it, else
  // its id (#n12, #c3). The recorder and Copy Reference both use it.
  function macroRefOfNode(n){
    const c = canvasOfNode(n);
    const nm = refNameOf(n);
    if(nm && isPlainRefName(nm) && c){
      try{ if(resolveOneNode(nm, c) === n) return nm; }catch(err){ /* not unique: its id */ }
    }
    return '#' + n.id;
  }
  function macroRefOfCanvas(c){
    const same = canvases.filter(x => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    return same.length === 1 && isPlainRefName(c.name) ? c.name : '#' + c.id;
  }
  // Copy Reference: the selected nodes' references (else the current canvas's), to paste into
  // a macro step.
  function copyReferenceInteractive(ids){
    const list = (ids || Array.from(selectedNodeIds)).map(id => getNode(id)).filter(Boolean);
    const text = list.length ? list.map(macroRefOfNode).join(', ') : macroRefOfCanvas(activeCanvas());
    const what = list.length ? (list.length === 1 ? 'this node' : `these ${list.length} nodes`) : 'this canvas';
    const done = () => toast(`Copied ${text} — how a macro step refers to ${what}.`, 3500);
    const shown = () => showMessage(`How a macro step refers to ${what}:\n\n${text}`);
    try{
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, shown);
      else shown();
    }catch(err){ shown(); }
    return text;
  }

  // Why a variable has no value, in a macro: no step saves it (deleted or changed since), or
  // the step that does hasn't run (stepping from the middle, switched off, a loop run no times).
  function unsetVariableText(name){
    const m = runCtx && runCtx.macro;
    if(m && Array.isArray(m.steps) && !macroSavedVariables(m).has(name)){
      const kept = [...macroSavedVariables(m)].map(v => '$' + v);
      return `No step in this macro saves $${name}, so it has no value — the step that saved it was deleted or changed since. Use a variable a step saves${kept.length ? ' (' + kept.join(', ') + ')' : ''}, or add the step back.`;
    }
    if(runCtx && runCtx.stepping) return `$${name} is saved by an earlier step that hasn't run in this step-by-step run. Select the macro's first step and step through from there, or use ▶ Run macro.`;
    return `Variable $${name} has no value yet: the step that saves it hasn't run — it is switched off, comes later, or is inside a loop that ran no times.`;
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
    else fail(unsetVariableText(name));
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
    if(vals.length > 1) fail(`${vals.length} rectangles on "${c.name}" are named "${name}" (${idList(vals)}). Rename one, or write its id instead of the name, like ${'#' + vals[0].id} — select it and use Copy Reference to get it. If an earlier step made it, use that step's variable (like $r1).`);
    const others = pool.filter(n => (n.type === 'alias' || n.type === 'blockInstance') && refNameOf(n).toLowerCase() === lc);
    if(others.length === 1) return others[0];
    if(others.length > 1) fail(`${others.length} nodes on "${c.name}" are called "${name}" (${idList(others)}). Write the id of the one you mean instead of the name, like ${'#' + others[0].id} — select it and use Copy Reference to get it.`);
    fail(`There is no rectangle named "${name}" on canvas "${c.name}".`);
  }

  function idList(list){ return list.map(x => '#' + x.id).join(', '); }
  // The nodes "@all" counts with an index: the automatic plug aliases are left out, since they
  // are made again (with new ids, at the end) whenever plugs and sockets are worked out.
  function indexedNodes(pool){ return pool.filter(n => !(n.type === 'alias' && n.auto)); }
  function noSelectionText(){
    return 'Nothing was selected when the macro started, and this step works on the selection (@sel). Select the nodes it should work on, then run the macro again.';
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
      if(!one){
        if(m[1] === 'sel' && runCtx && !list.length) fail(noSelectionText());
        fail(`The selection has no item [${m[2]}] (it has ${list.length}).`);
      }
      return [one];
    }
    if(s === '@all') return pool.slice();
    m = /^@all\[(\d+)\]$/.exec(s);
    if(m){
      const list = indexedNodes(pool);
      const one = list[+m[1]];
      if(!one) fail(`Canvas "${c.name}" has no node @all[${m[1]}] (it has ${list.length}, counted from 0).`);
      return [one];
    }
    if(s.startsWith('$')){
      const v = lookupVar(s);
      const list = Array.isArray(v) ? v : [v];
      return list.map(id => {
        const n = pool.find(x => x.id === id);
        if(!n){
          if(id === null) fail(`${s} is empty: the step that saved it made nothing there (a part it skipped).`);
          if(canvases.some(x => x.id === id)) fail(`${s} holds a canvas, not a node. For a node on it, write ${/\[\d+\]$/.test(s) || list.length === 1 ? s : s + '[0]'}::Name (Name: the rectangle's name).`);
          fail(`${s} does not refer to a node on canvas "${c.name}".`);
        }
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
    if(list.length === 0){
      if(runCtx && !runCtx.startSelection.length && /^@sel(\[\d+\])?$/.test(String(ref).trim())) fail(noSelectionText());
      fail(ref === '' || ref == null ? 'No node was given.' : `Nothing matched "${ref}".`);
    }
    fail(`Expected one node, but "${Array.isArray(ref) ? ref.join(', ') : ref}" matched ${list.length}.`);
  }

  function resolveCanvasRef(ref){
    if(ref && typeof ref === 'object' && Array.isArray(ref.nodes)) return ref;
    if(ref === undefined || ref === null || ref === '' || ref === '@current') return activeCanvas();
    let s = String(ref).trim();
    if(s.startsWith('$')){
      const token = s;
      let v = lookupVar(token);
      if(Array.isArray(v)){
        if(v.length !== 1) fail(`${token} holds ${v.length} canvases or nodes — say which one, like ${token}[0] (counted from 0).`);
        v = v[0];
      }
      if(v === null || v === undefined) fail(`${token} is empty: the step that saved it made no canvas there (a part it skipped).`);
      const hit = canvases.find(c => c.id === v);
      if(hit) return hit;
      if(canvases.some(c => nodesIn(c).some(n => n.id === v))) fail(`${token} holds a node, not a canvas.`);
      s = String(v).trim();               // a variable holding a canvas's name (or #id)
    }
    const id = s.startsWith('#') ? s.slice(1) : s;
    const byId = canvases.find(c => c.id === id);
    if(byId) return byId;
    if(s.startsWith('#')) fail(`There is no canvas ${s} (ids belong to one document: a macro made in another one names other canvases).`);
    const lc = s.toLowerCase();
    const byName = canvases.filter(c => c.name.trim().toLowerCase() === lc);
    if(byName.length === 1) return byName[0];
    if(byName.length > 1) fail(`More than one canvas is named "${s}" (${idList(byName)}). Rename one (double-click its tab), or write the id of the one you mean instead of the name, like #${byName[0].id} — hover over a canvas tab to see its id. If an earlier step made the canvas, use that step's variable instead (like $t1[0] or $c1).`);
    fail(`There is no canvas called "${s}".`);
  }

  // A template reference: "#usrN" (that exact entry), or a family — its name or its family
  // id — optionally followed by "@latest" or "@<version>". No "@…" means the latest version.
  function resolveTemplateRef(ref){
    if(ref && typeof ref === 'object' && ref.data) return ref;
    const s = String(ref || '').trim();
    const byId = TEMPLATES.find(t => t.id === s || '#' + t.id === s);
    if(byId) return byId;
    const family = (text) => {
      if(TEMPLATES.some(t => t.family === text)) return latestOfFamily(text);
      const named = familiesNamed(text);
      if(named.length > 1) fail(`More than one template family is named "${text}" — refer to it by its family ID instead of the name — ${named.map(t => `${t.family} (latest v${t.version}${t.origin && t.origin.author ? ', by ' + t.origin.author : ''})`).join(', ')} — like "${named[0].family}@latest", or rename one in Templates.`);
      return named[0] || null;
    };
    const m = /^(.*?)\s*@\s*(latest|\d+)$/i.exec(s);
    const base = m && m[1] ? family(m[1]) : null;
    if(!base){
      const whole = family(s);            // a name that itself ends in "@…"
      if(whole) return whole;
      fail(`There is no template called "${m && m[1] ? m[1] : s}".`);
    }
    if(m[2].toLowerCase() === 'latest') return base;
    const n = Number(m[2]);
    const all = familyVersions(base.family);
    const v = all.find(t => t.version === n);
    if(!v) fail(`There is no version ${n} of "${base.name}" (it has version${all.length === 1 ? '' : 's'} ${all.map(t => t.version).reverse().join(', ')}).`);
    return v;
  }

  // How to refer to a template in a recorded macro: its name when that names one family
  // (else its family id), with "@N" for an older version — the latest follows updates.
  function templateRefText(t){
    const byName = familiesNamed(t.name).length === 1 && !/@\s*(latest|\d+)$/i.test(t.name);
    if(isLatestVersion(t)) return byName ? t.name : t.family + '@latest';
    return (byName ? t.name : t.family) + '@' + t.version;
  }

  function resolveMacroRef(ref){
    if(ref && typeof ref === 'object' && Array.isArray(ref.steps)) return ref;
    const s = String(ref || '').trim();
    const byId = MACROS.find(m => m.id === s || '#' + m.id === s);
    if(byId) return byId;
    const byName = MACROS.filter(m => m.name.trim().toLowerCase() === s.toLowerCase());
    if(byName.length === 1) return byName[0];
    if(byName.length > 1) fail(`More than one macro is named "${s}" — rename one in the Macro Builder.`);
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

