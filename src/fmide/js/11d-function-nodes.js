  // ---------- function nodes on the canvas (step 7, phase D2b) ----------
  // A function node is { type: 'function', fn: { family, version, versionId, name, skipped? } }:
  // one call to one version of a function the model carries (modelFunctions). It is drawn
  // like a block instance — "ƒ Name vN", one labelled input port per input in the
  // definition's order, one output — and each arrow into it carries `toPort` (from 0).
  // Its inputs come from the model's own definition, never from the library; the library
  // only says whether a newer version exists (⬆). Everything shown from a definition or from
  // `fn` (names, formulas, notes) is text from a file: it goes in with textContent only.

  // The model's definitions, compiled once per change of the model (for names and inputs).
  function modelFunctionTable(){
    if(!modelFunctionCache || modelFunctionCache.list !== modelFunctions || modelFunctionCache.length !== modelFunctions.length){
      modelFunctionCache = { list: modelFunctions, length: modelFunctions.length, table: compileFunctions(modelFunctions) };
    }
    return modelFunctionCache.table;
  }

  // A function node's name for showing: its definition's, else the name its `fn` carries
  // (from a file: only ever text, and cut to the longest a function name can be).
  function functionNodeName(n, compiled){
    const own = compiled && typeof compiled.name === 'string' ? compiled.name : '';
    const carried = n && n.fn && typeof n.fn.name === 'string' ? n.fn.name.trim() : '';
    return (own || carried).slice(0, FUNCTION_LIMITS.name) || '(unnamed)';
  }

  // Everything about a function node the canvas and the menus need:
  //  ref       its { family, version, versionId }, or null when `fn` is malformed
  //  compiled  the model's definition it calls (compiled), or null when the model lacks it
  //  problem   'missing' | 'unreadable' | null;  params  its inputs (null with a problem)
  //  lib       the library's entry for this exact version (by versionId first), or null
  //  newer     the library's latest version when it is newer and not declined ("Not now")
  //  repair    the library's entry when the model lacks the definition but the library has
  //            exactly this version (same versionId): "Add the definition from your library"
  function functionNodeState(n){
    const ref = cleanFunctionRef(n && n.fn);
    const compiled = ref ? modelFunctionTable().resolve(ref) : null;
    const problem = !compiled ? 'missing' : (compiled.parseError ? 'unreadable' : null);
    const params = problem ? null : compiled.params;
    const lib = ref ? libraryFunctionFor(ref) : null;
    const latest = lib ? latestFunctionOf(lib.family) : null;
    const skipped = n && n.fn && Number.isInteger(n.fn.skipped) ? n.fn.skipped : 0;
    const newer = (lib && latest && latest !== lib && latest.version > lib.version && latest.version > skipped) ? latest : null;
    const repair = (problem === 'missing' && ref && ref.versionId && lib && lib.versionId === ref.versionId) ? lib : null;
    return { ref, compiled, problem, params, lib, latest, newer, repair, name: functionNodeName(n, compiled) };
  }
  function functionNodeTitle(n, st){
    st = st || functionNodeState(n);
    return 'ƒ ' + st.name + ' v' + (st.ref ? st.ref.version : '?');
  }
  function functionProblemText(st){
    if(st.problem === 'unreadable') return "This function's formula can't be read.";
    if(st.problem === 'missing') return "This function's definition isn't in the model." + (st.repair ? ' Your library has this exact version: ⋯ → Add the definition from your library.' : '');
    return '';
  }

  // The arrows of a canvas (the active one's live list, else the saved one).
  function edgesOfCanvas(c){ return c.id === activeCanvasId ? edges : (Array.isArray(c.edges) ? c.edges : []); }
  function setEdgesOfCanvas(c, list){ if(c.id === activeCanvasId) edges = list; c.edges = list; }

  // The input ports drawn on a node: the definition's inputs, or — without a readable
  // definition — one numbered port for each port its arrows use, so they still land somewhere.
  function functionNodePorts(n, st){
    if(st.params) return st.params.slice();
    let count = 0;
    edges.forEach(e => { if(e.to === n.id && Number.isInteger(e.toPort) && e.toPort >= 0 && e.toPort < FUNCTION_LIMITS.inputs) count = Math.max(count, e.toPort + 1); });
    const out = [];
    for(let i = 0; i < count; i++) out.push('#' + (i + 1));
    return out;
  }
  // Size of a function node with `inputs` input rows (and a warning row).
  function functionNodeHeight(inputs, warn){ return 26 + (warn ? 20 : 0) + Math.max(inputs, 2) * 20 + 8; }

  function renderFunctionNodeBody(el, n){
    const st = functionNodeState(n);
    const ports = functionNodePorts(n, st);
    const warn = !!st.problem;
    const rowH = 20, headerH = 26;
    n.h = functionNodeHeight(ports.length, warn);
    if(!n.w || n.w < 150) n.w = 190;
    el.innerHTML = '';
    el.classList.toggle('fn-problem', warn);

    const header = document.createElement('div');
    header.className = 'block-header fn-header';
    header.textContent = functionNodeTitle(n, st);
    el.appendChild(header);
    el.title = functionNodeTitle(n, st);

    if(st.newer){
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'tag-btn fn-update-btn';
      up.textContent = '⬆';
      up.title = `Version ${st.newer.version} of ${st.name} is in your library — click to update`;
      el.appendChild(up);
    }
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'tag-btn fn-menu-btn';
    menuBtn.textContent = '⋯';
    menuBtn.title = 'Update, change function or version, show the definition';
    el.appendChild(menuBtn);

    let top = headerH;
    if(warn){
      const w = document.createElement('div');
      w.className = 'fn-warning';
      w.style.top = top + 'px';
      w.textContent = st.problem === 'unreadable' ? "⚠ Formula can't be read" : '⚠ Definition missing';
      w.title = functionProblemText(st);
      el.appendChild(w);
      top += rowH;
    }

    ports.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'io-row io-row-in fn-in';
      row.style.top = (top + i * rowH) + 'px';
      const dot = document.createElement('div');
      dot.className = 'io-port';
      dot.dataset.portIndex = i;
      dot.dataset.portDir = 'in';
      const label = document.createElement('span');
      label.className = 'io-label';
      label.textContent = name;
      label.title = name;
      row.append(dot, label);
      el.appendChild(row);
    });

    // The output: its value (or "?" with the reason on hover) and its unit, then the dot.
    const out = document.createElement('div');
    out.className = 'fn-output';
    out.style.top = top + 'px';
    const val = document.createElement('span');
    val.className = 'io-value fn-value';
    const v = computedValues[n.id];
    if(v !== undefined && v !== null){ val.textContent = '= ' + formatNum(v); val.classList.add('computed'); }
    else if(computeErrors[n.id]){ val.textContent = '?'; val.classList.add('error'); val.title = errorTitle(computeErrors[n.id]); }
    else if(warn){ val.textContent = '?'; val.classList.add('error'); val.title = functionProblemText(st); }
    const unit = document.createElement('span');
    unit.className = 'fn-unit';
    const u = st.problem ? null : nodeUOM(activeCanvasId, n.id);
    unit.textContent = u ? formatUOM(u) : '';
    const dot = document.createElement('div');
    dot.className = 'io-port fn-out-port';
    dot.dataset.portIndex = 0;
    dot.dataset.portDir = 'out';
    out.append(val, unit, dot);
    el.appendChild(out);
  }

  // A function node's input port from an fm reference: its input name (capitals don't
  // matter) or its number counted from 1, like a block's ports. Empty: its only input.
  function resolveFunctionPort(n, ref){
    const st = functionNodeState(n);
    if(!st.params) fail(`ƒ ${st.name} can't take arrows: ` + (st.problem === 'unreadable' ? "its formula can't be read." : "its definition isn't in the model."));
    const ps = st.params;
    if(!ps.length) fail(`ƒ ${st.name} has no inputs.`);
    const s = ref == null ? '' : String(ref).trim();
    if(s === ''){
      if(ps.length === 1) return 0;
      fail(`ƒ ${st.name} has ${ps.length} inputs — say which one (${ps.join(', ')}).`);
    }
    if(/^\d+$/.test(s)){
      const i = Number(s) - 1;
      if(i < 0 || i >= ps.length) fail(`ƒ ${st.name} has no input #${s} (it has ${ps.length}).`);
      return i;
    }
    const i = ps.findIndex(p => p.toLowerCase() === s.toLowerCase());
    if(i < 0) fail(`ƒ ${st.name} has no input called "${s}" (its inputs: ${ps.join(', ')}).`);
    return i;
  }
  // The name a recorded macro uses for port `i` of a function node ('' when it has none).
  function functionPortName(n, i){
    const st = functionNodeState(n);
    return st.params && st.params[i] != null ? st.params[i] : '';
  }
  // Where an arrow dropped on a function node's body goes: its first input with no arrow.
  function firstFreeFunctionPort(n){
    const st = functionNodeState(n);
    if(!st.params) return { error: `ƒ ${st.name} can't take arrows: ` + (st.problem === 'unreadable' ? "its formula can't be read." : "its definition isn't in the model.") };
    if(!st.params.length) return { error: `ƒ ${st.name} has no inputs.` };
    const i = st.params.findIndex((p, k) => !edges.some(e => e.to === n.id && e.toPort === k));
    if(i < 0) return { error: `Every input of ƒ ${st.name} already has an arrow — drop the arrow on the input you want to replace.` };
    return { index: i };
  }

  // ---------- updating and changing a node ----------
  // What moving node `n` (on canvas `c`) to library version `target` does to its arrows:
  // each is matched to the new version's inputs by its input's name (capitals don't matter);
  // an arrow into an input the new version doesn't have is dropped. Without a readable
  // definition the old inputs' names are unknown, so arrows keep their port number while the
  // new version has that many inputs.
  function functionNodeUpdatePlan(c, n, target){
    const st = functionNodeState(n);
    const parsed = parseFunctionText(target.text);
    if(!parsed.ok) fail(`${functionLabel(target)} v${target.version} can't be read, so nothing can use it: ${parsed.error.message}`);
    const newParams = parsed.params;
    const pool = nodesIn(c);
    const moves = [], dropped = [];
    edgesOfCanvas(c).forEach(e => {
      if(e.to !== n.id) return;
      const p = e.toPort;
      let to = -1, input = '(no input)';
      if(Number.isInteger(p)){
        if(st.params){
          input = st.params[p] != null ? st.params[p] : '#' + (p + 1);
          if(st.params[p] != null) to = newParams.findIndex(x => x.toLowerCase() === st.params[p].toLowerCase());
        } else {
          input = '#' + (p + 1);
          if(p >= 0 && p < newParams.length) to = p;
        }
      }
      const from = pool.find(x => x.id === e.from);
      if(to < 0) dropped.push({ edge: e, input, from: from ? describeNode(from) : '#' + e.from });
      else moves.push({ edge: e, to });
    });
    return { canvas: c, node: n, target, moves, dropped, params: newParams };
  }
  // Carries out plans (after pushHistory): the target versions (and what they call) join the
  // model — a different version under a taken number comes in renumbered — then each node
  // points at its version, its arrows move to their inputs, and the dropped ones go.
  // Returns the dropped arrows as { node, canvas, input, from }.
  function applyFunctionNodeUpdates(plans){
    const out = [];
    const targets = [];
    plans.forEach(p => functionWithCallees(p.target).forEach(x => { if(!targets.includes(x)) targets.push(x); }));
    const remap = addFunctionsToModel(targets, 'renumber');
    plans.forEach(p => {
      const { canvas: c, node: n, target } = p;
      const drop = new Set(p.dropped.map(d => d.edge.id));
      p.moves.forEach(m => { m.edge.toPort = m.to; });
      if(drop.size) setEdgesOfCanvas(c, edgesOfCanvas(c).filter(e => !drop.has(e.id)));
      const r = remap(target);
      n.fn = { family: target.family, version: r ? r.version : target.version, versionId: target.versionId, name: functionNameOf(target) };
      n.h = functionNodeHeight(p.params.length, false);
      p.dropped.forEach(d => out.push({ node: n.id, canvas: c.name, input: d.input, from: d.from }));
    });
    trimModelFunctions();
    clearComputed();
    evaluateAll();
    return out;
  }
  function droppedArrowsText(list){
    return list.map(d => `• the arrow from ${d.from} into “${d.input}”`).join('\n');
  }

  // The function nodes of the model using `family`, with what "Update every use" does to
  // each for library version `target`: nodes already on the target or a newer version are
  // left out; the others are ticked unless their version isn't in the library (can't tell
  // if it is older) or "Not now" declined the target or a newer one.
  function functionUsesPlan(family, target){
    const out = [];
    functionNodesUsing(family).forEach(({ canvas: c, node: n }) => {
      const st = functionNodeState(n);
      if(st.lib && (st.lib === target || st.lib.version >= target.version)) return;
      const skipped = Number.isInteger(n.fn.skipped) && n.fn.skipped >= target.version;
      const plan = functionNodeUpdatePlan(c, n, target);
      out.push({ canvas: c, node: n, state: st, plan, tick: !!st.lib && !skipped,
        why: !st.lib ? 'this version isn’t in your library' : (skipped ? '“Not now”' : '') });
    });
    return out;
  }

  // ---------- the windows ----------
  function modalShell(className){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box ' + className;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      const overlays = document.querySelectorAll('.modal-overlay');
      if(overlays[overlays.length - 1] !== overlay) return;
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    const p = (text, cls) => { const el = document.createElement('p'); if(cls) el.className = cls; el.textContent = text; box.appendChild(el); return el; };
    const actions = () => { const a = document.createElement('div'); a.className = 'modal-actions'; box.appendChild(a); return a; };
    const button = (parent, label, cls, run) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if(cls) b.className = cls; b.addEventListener('click', run); parent.appendChild(b); return b; };
    return { overlay, box, close, p, actions, button };
  }

  // Insert Function… (node null), or "Change function or version…" for node `node`: the
  // library's families, searchable, with a version to pick (the latest by default).
  function showFunctionPicker(node){
    const families = functionFamilies();
    if(!families.length){
      showMessage('Your function library is empty. Create a function first (File → Functions → + New Function…), or import some.');
      return;
    }
    const ui = modalShell('function-picker');
    const nodeSt = node ? functionNodeState(node) : null;
    ui.p(node ? `Change ${functionNodeTitle(node, nodeSt)} to another function or version` : 'Insert Function');
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'template-search function-picker-search';
    search.placeholder = 'Search functions…';
    search.setAttribute('autocomplete', 'off');
    search.spellcheck = false;
    ui.box.appendChild(search);
    const list = document.createElement('div');
    list.className = 'picker-list function-picker-list';
    ui.box.appendChild(list);
    const verRow = document.createElement('label');
    verRow.className = 'function-picker-version-row';
    verRow.textContent = 'Version ';
    const verSel = document.createElement('select');
    verSel.className = 'function-picker-version';
    verRow.appendChild(verSel);
    ui.box.appendChild(verRow);
    const detail = ui.p('', 'function-picker-detail');
    const acts = ui.actions();
    ui.button(acts, 'Cancel', '', ui.close);
    const okBtn = ui.button(acts, node ? 'Change' : 'Insert', 'primary function-picker-ok', () => choose());

    let selected = (nodeSt && nodeSt.lib) ? latestFunctionOf(nodeSt.lib.family) : families[0];
    let version = (nodeSt && nodeSt.lib) ? nodeSt.lib : null;
    let shown = [];
    function renderVersions(){
      verSel.innerHTML = '';
      if(!selected) return;
      const all = functionFamilyVersions(selected.family);
      if(!version || version.family !== selected.family) version = all[0];
      all.forEach((v, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = 'v' + v.version + (i === 0 ? ' (latest)' : '') + (v.note ? ' — ' + v.note.slice(0, 60) : '');
        if(v === version) o.selected = true;
        verSel.appendChild(o);
      });
      const parsed = parseFunctionText(version.text);
      detail.textContent = (parsed.ok ? (parsed.params.length ? 'Inputs: ' + parsed.params.join(', ') : 'No inputs') : "⚠ This formula can't be read.")
        + (version.description ? ' — ' + version.description : '');
      okBtn.disabled = !parsed.ok;
    }
    function renderList(){
      list.innerHTML = '';
      shown = [];
      const q = search.value.trim();
      const hits = !q ? families.map(d => ({ d, idx: null })) : families.map(d => {
        const onName = fuzzyMatch(q, functionLabel(d));
        if(onName) return { d, score: onName.score + 500, idx: onName.idx };
        const other = fuzzyMatch(q, d.description || '');
        return other ? { d, score: other.score, idx: [] } : null;
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      if(!hits.length){ const none = document.createElement('p'); none.className = 'template-desc'; none.textContent = 'No matching functions'; list.appendChild(none); }
      hits.forEach(({ d, idx }) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'picker-row function-picker-row' + (selected === d ? ' active' : '');
        const main = document.createElement('span');
        const name = functionLabel(d);
        main.appendChild(idx && idx.length ? highlightLabel(name, idx) : document.createTextNode(name));
        const sub = document.createElement('span');
        sub.className = 'sub';
        const bits = ['v' + d.version];
        if(functionFamiliesNamed(name).length > 1) bits.push('family ' + d.family);
        if(d.description) bits.push(d.description.slice(0, 80));
        sub.textContent = bits.join(' · ');
        row.append(main, sub);
        row.addEventListener('click', () => { selected = d; version = null; renderList(); renderVersions(); });
        row.addEventListener('dblclick', () => { selected = d; version = null; renderVersions(); choose(); });
        list.appendChild(row);
        shown.push(d);
      });
    }
    verSel.addEventListener('change', () => { version = functionFamilyVersions(selected.family)[Number(verSel.value)] || null; renderVersions(); });
    search.addEventListener('input', () => { renderList(); if(shown.length && !shown.includes(selected)){ selected = shown[0]; version = null; renderList(); } renderVersions(); });
    search.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter'){ ev.preventDefault(); choose(); }
      if(ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
        ev.preventDefault();
        if(!shown.length) return;
        const i = shown.indexOf(selected);
        selected = shown[Math.max(0, Math.min(shown.length - 1, i < 0 ? 0 : i + (ev.key === 'ArrowDown' ? 1 : -1)))];
        version = null; renderList(); renderVersions();
      }
    });
    function choose(){
      if(!selected || !version || okBtn.disabled) return;
      const ref = functionRefText(version);
      if(!node){
        ui.close();
        const {x, y} = spawnPoint();
        const id = guarded(() => fm.insertFunction({ function: ref, x, y }));
        if(id) selectNodesOnly([id]);
        return;
      }
      const c = canvasOfNode(node);
      const plan = guarded(() => functionNodeUpdatePlan(c, node, version));
      if(!plan) return;
      ui.close();
      const go = () => { const r = guarded(() => fm.changeFunction({ node: '#' + node.id, function: ref })); if(r && r.dropped.length) toast(`Dropped ${r.dropped.length} arrow${r.dropped.length === 1 ? '' : 's'} (undo puts ${r.dropped.length === 1 ? 'it' : 'them'} back).`, 3500); };
      if(plan.dropped.length) showConfirm(`Changing to ${functionLabel(version)} v${version.version} drops ${plan.dropped.length === 1 ? 'this arrow' : 'these arrows'} (the new version has no input of that name):\n\n${droppedArrowsText(plan.dropped)}`, go);
      else go();
    }
    renderList();
    renderVersions();
    search.focus();
  }

  // The ⋯ menu (and the ⬆ badge) of a function node.
  function showFunctionNodeMenu(n){
    const st = functionNodeState(n);
    const ui = modalShell('function-node-menu');
    ui.p(functionNodeTitle(n, st));
    if(st.problem) ui.p('⚠ ' + functionProblemText(st), 'function-node-problem');
    else if(st.newer) ui.p(`Version ${st.newer.version} is in your library.` + (st.newer.note ? ' — ' + st.newer.note : ''), 'function-node-newer');
    else if(!st.lib) ui.p('This version isn’t in your function library, so no updates are offered.', 'template-desc');
    const list = document.createElement('div');
    list.className = 'picker-list';
    ui.box.appendChild(list);
    const item = (label, cls, run) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker-row ' + cls;
      b.textContent = label;
      b.addEventListener('click', () => { ui.close(); run(); });
      list.appendChild(b);
    };
    if(st.newer){
      item(`⬆ Update to v${st.newer.version}`, 'fn-menu-update', () => updateOneFunctionNode(n));
      item('Not now', 'fn-menu-skip', () => guarded(() => fm.skipFunctionUpdate({ node: '#' + n.id })));
    }
    if(st.latest) item('Update every use…', 'fn-menu-update-all', () => showUpdateUsesWindow(st.latest.family));
    if(st.repair) item('Add the definition from your library', 'fn-menu-repair', () => guarded(() => fm.addFunctionDefinition({ node: '#' + n.id })));
    item('Change function or version…', 'fn-menu-change', () => showFunctionPicker(n));
    item('Show definition', 'fn-menu-show', () => showFunctionDefinition(n));
    const acts = ui.actions();
    ui.button(acts, 'Cancel', '', ui.close);
  }

  // "Update" for one node: asks first only when arrows would be dropped (decided in D2b).
  function updateOneFunctionNode(n){
    const st = functionNodeState(n);
    if(!st.newer) return;
    const plan = guarded(() => functionNodeUpdatePlan(canvasOfNode(n), n, st.newer));
    if(!plan) return;
    const go = () => guarded(() => fm.updateFunctionNode({ node: '#' + n.id }));
    if(plan.dropped.length) showConfirm(`Version ${st.newer.version} of ${st.name} has no input for ${plan.dropped.length === 1 ? 'this arrow' : 'these arrows'}, so updating drops ${plan.dropped.length === 1 ? 'it' : 'them'}:\n\n${droppedArrowsText(plan.dropped)}\n\nUpdate anyway? (Undo puts ${plan.dropped.length === 1 ? 'it' : 'them'} back.)`, go);
    else go();
  }

  // "Update every use…": every node of the family, ticked as functionUsesPlan says, with the
  // arrows each would lose; one undo step.
  function showUpdateUsesWindow(family){
    const target = latestFunctionOf(family);
    if(!target){ showMessage('That function isn’t in your library any more.'); return; }
    const rows = guarded(() => functionUsesPlan(family, target));
    if(!rows) return;
    const name = functionLabel(target);
    if(!rows.length){ showMessage(`Every ${name} node in this model is already on version ${target.version} (or newer).`); return; }
    const ui = modalShell('function-uses');
    ui.p(`Update ${name} to version ${target.version}` + (target.note ? ' — ' + target.note : ''));
    const list = document.createElement('div');
    list.className = 'function-uses-list';
    ui.box.appendChild(list);
    const ticks = rows.map(r => {
      const row = document.createElement('label');
      row.className = 'function-use-row';
      row.dataset.node = r.node.id;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = r.tick;
      const text = document.createElement('span');
      text.textContent = `${r.canvas.name} — ${functionNodeTitle(r.node, r.state)}` + (r.why ? ` (${r.why})` : '');
      row.append(cb, text);
      if(r.plan.dropped.length){
        const lost = document.createElement('div');
        lost.className = 'function-use-lost';
        lost.textContent = 'Loses ' + r.plan.dropped.map(d => `the arrow from ${d.from} into “${d.input}”`).join('; ');
        row.appendChild(lost);
      }
      list.appendChild(row);
      return cb;
    });
    const acts = ui.actions();
    ui.button(acts, 'Cancel', '', ui.close);
    const ok = ui.button(acts, 'Update', 'primary function-uses-update', () => {
      const chosen = rows.filter((r, i) => ticks[i].checked);
      if(!chosen.length) return;
      ui.close();
      const same = rows.every((r, i) => ticks[i].checked === r.tick);
      const args = { function: functionRefText(target) };
      if(!same) args.nodes = chosen.map(r => r.canvas.id + '::#' + r.node.id);
      const res = guarded(() => fm.updateFunctionUses(args));
      if(res) toast(`Updated ${res.updated} node${res.updated === 1 ? '' : 's'}` + (res.dropped.length ? `; dropped ${res.dropped.length} arrow${res.dropped.length === 1 ? '' : 's'}` : '') + '.', 3500);
    });
    const sync = () => { ok.disabled = !ticks.some(t => t.checked); };
    ticks.forEach(t => t.addEventListener('change', sync));
    sync();
  }

  // The command Update Function…: the selected function node's family, or a choice among the
  // model's functions that have a newer version in the library.
  function updateFunctionCommand(){
    const sel = Array.from(selectedNodeIds).map(getNode).filter(n => n && n.type === 'function');
    const selSt = sel.length === 1 ? functionNodeState(sel[0]) : null;
    if(selSt && selSt.latest){ showUpdateUsesWindow(selSt.latest.family); return; }
    syncActiveIntoRegistry();
    const families = [];
    canvases.forEach(c => (c.nodes || []).forEach(n => {
      if(n.type !== 'function') return;
      const st = functionNodeState(n);
      if(st.lib && st.latest && st.lib !== st.latest && !families.includes(st.latest)) families.push(st.latest);
    }));
    if(!families.length){ showMessage('Every function node in this model is on the latest version in your library.'); return; }
    if(families.length === 1){ showUpdateUsesWindow(families[0].family); return; }
    const ui = modalShell('function-update-choose');
    ui.p('Which function do you want to update?');
    const list = document.createElement('div');
    list.className = 'picker-list';
    ui.box.appendChild(list);
    families.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker-row';
      b.textContent = `${functionLabel(f)} → v${f.version}`;
      b.addEventListener('click', () => { ui.close(); showUpdateUsesWindow(f.family); });
      list.appendChild(b);
    });
    ui.button(ui.actions(), 'Cancel', '', ui.close);
  }

  // Double-click: the definition — in the Functions manager when the library has this exact
  // version, else the model's own copy (read only).
  function showFunctionDefinition(n){
    const st = functionNodeState(n);
    if(st.lib && (!st.ref.versionId || st.lib.versionId === st.ref.versionId)){ showFunctionsManager(st.lib); return; }
    if(!st.compiled){ showMessage(functionNodeTitle(n, st) + ': ' + functionProblemText(st)); return; }
    const d = st.compiled.def;
    const ui = modalShell('function-definition-view');
    ui.p(functionNodeTitle(n, st) + ' — the model’s own copy (not in your library)');
    const pre = document.createElement('pre');
    pre.className = 'function-detail-text';
    pre.textContent = d.text;
    ui.box.appendChild(pre);
    if(st.params) ui.p(st.params.length ? 'Inputs: ' + st.params.join(', ') : 'No inputs', 'function-detail-inputs');
    else ui.p('⚠ ' + functionProblemText(st), 'function-detail-problem');
    if(d.description) ui.p(d.description, 'template-desc');
    if(d.note) ui.p('Note: ' + d.note, 'template-desc');
    ui.button(ui.actions(), 'Close', '', ui.close);
  }
