  // ---------------------------------- Functions (step 7, phase D2) ----------------------------------
  // The function library through fm actions (the Functions manager uses them too, so macros
  // record what it does). References are "Name" (the latest version), "Name@latest",
  // "Name@3", the same with the family id, or { family, version, versionId }.

  // A definition as the actions return it (a copy; the text is data, never run).
  function functionInfo(d){
    const parsed = parseFunctionText(d.text);
    return { family: d.family, version: d.version, versionId: d.versionId, name: functionNameOf(d),
      inputs: parsed.ok ? parsed.params.slice() : [], readable: parsed.ok, text: d.text,
      description: d.description, note: d.note, latest: isLatestFunction(d),
      calls: d.calls.map(c => ({ name: c.name, family: c.family, version: c.version, versionId: c.versionId })) };
  }
  // fm actions that take a file object as their first input also accept { file, … } (the fm
  // wrapper passes a lone object as the first input when that input is JSON).
  function unwrapFileArgs(a){
    if(a.file && typeof a.file === 'object' && !a.file.kind && !Array.isArray(a.file.functions) && a.file.file) Object.assign(a, a.file);
    return a;
  }

  defineAction({ name:'saveFunction', label:'Save Function', category:'Insert', icon:'ƒ', returns:'value', tx:false,
    desc:'Saves a function to your library: text is the whole definition, like "Margin(Revenue, Cost) = (Revenue - Cost) / Revenue". A name already used fails unless newVersionOf names that function (its next version). calls pins the functions it calls, like {"Margin": "Margin@1"}; without it a new version keeps the pins of the latest version, and a name one function has takes its latest version. Returns "Name@version".',
    params:[ P('text','text'), P('description','string',{ def:'' }), P('note','string',{ def:'' }),
      P('newVersionOf','string',{ def:'', help:'a function to save the next version of' }),
      P('calls','json',{ optional:true, help:'{"Name": "Name@version"} for each function it calls' }) ],
    run(a){
      const base = a.newVersionOf.trim() ? latestFunctionOf(resolveFunctionRef(a.newVersionOf).family) : null;
      const picks = Object.create(null);
      if(a.calls != null){
        if(typeof a.calls !== 'object' || Array.isArray(a.calls)) fail('calls must be like {"Margin": "Margin@1"}.');
        Object.keys(a.calls).forEach(k => { picks[k.trim().toLowerCase()] = resolveFunctionRef(a.calls[k]); });
      }
      const check = checkFunctionDraft(a.text, base, picks);
      if(check.problem) fail(check.problem.message + (typeof check.problem.at === 'number' && !check.parsed.ok ? ` (at character ${check.problem.at + 1})` : ''));
      if(!base){
        const taken = functionFamiliesNamed(check.parsed.name)[0];
        if(taken) fail(`There is already a function called ${functionLabel(taken)}. Choose another name, or use newVersionOf to save its next version.`);
      }
      const d = saveFunctionDraft(check, base, a.description, a.note);
      return functionRefText(d).replace(/@\d+$/, '') + '@' + d.version;
    } });

  defineAction({ name:'listFunctions', label:'List Functions', category:'Insert', icon:'ƒ', returns:'value', mutates:false, tx:false, record:false,
    desc:'Returns your function library, one entry per function: { family, name, latest, versions: [{ version, versionId, name, inputs, text, description, note, calls }] }, newest version first. of: "model" lists instead the definitions the open model carries (the ones it calculates with), one entry per version.',
    params:[ P('of','enum',{ options:['library','model'], def:'library' }) ],
    run(a){
      if(a.of === 'model') return modelFunctions.map(d => {
        const parsed = parseFunctionText(d.text);
        return { family: d.family, version: d.version, versionId: d.versionId, name: functionNameOf(d),
          inputs: parsed.ok ? parsed.params.slice() : [], readable: parsed.ok, text: d.text, description: d.description, note: d.note,
          calls: d.calls.map(c => ({ name: c.name, family: c.family, version: c.version, versionId: c.versionId })) };
      });
      return functionFamilies().map(f => ({ family: f.family, name: functionNameOf(f), latest: f.version,
        versions: functionFamilyVersions(f.family).map(functionInfo) }));
    } });

  defineAction({ name:'getFunction', label:'Get Function', category:'Insert', icon:'ƒ', returns:'value', mutates:false, tx:false, record:false,
    desc:'Returns one version from your library: { family, version, versionId, name, inputs, text, description, note, calls, latest }.',
    params:[ P('function','string') ],
    run(a){ return functionInfo(resolveFunctionRef(a.function)); } });

  defineAction({ name:'setFunctionInfo', label:'Edit Function Description', category:'Insert', icon:'✎', tx:false,
    desc:'Changes the description and change note of one version in your library (neither changes the calculation).',
    params:[ P('function','string'), P('description','string',{ def:'' }), P('note','string',{ def:'' }) ],
    run(a){
      const d = resolveFunctionRef(a.function);
      d.description = String(a.description).trim().slice(0, FUNCTION_LIMITS.description);
      d.note = String(a.note).trim().slice(0, FUNCTION_LIMITS.note);
      saveWorkspaceSoon();
    } });

  defineAction({ name:'deleteFunction', label:'Delete Function', category:'Insert', icon:'🗑', returns:'value', tx:false,
    desc:'Deletes from your library: "Name" (or whole: true) the whole function with every version; "Name@2" one older version. The latest version goes only with the whole function, so its number is never used again. The open model keeps its own copy. Returns how many versions were deleted.',
    params:[ P('function','string'), P('whole','bool',{ def:false, help:'every version' }) ],
    run(a){
      const s = String(a.function).trim();
      const d = resolveFunctionRef(s);
      const pinned = /@\s*\d+$/.test(s);
      if(!a.whole && pinned && isLatestFunction(d)) fail(`Version ${d.version} is the latest version of ${functionLabel(d)}: it can only be deleted with the whole function (whole: true, or "${functionLabel(d)}").`);
      return deleteLibraryFunction(a.whole || !pinned ? latestFunctionOf(d.family) : d);
    } });

  defineAction({ name:'importFunctions', label:'Import Functions', category:'File', icon:'⇧', returns:'value', tx:false,
    desc:'Adds the functions in an fmIDE-functions file (its JSON) to your library, following the template rules: versions already there are skipped, a version whose number is taken is added under the next number. A file from a newer fmIDE fails unless allowNewer is true. Returns { added, present, renumbered }.',
    params:[ P('file','json'), P('allowNewer','bool',{ def:false }) ],
    run(a){
      unwrapFileArgs(a);
      const r = readFmFile(a.file, ['fmIDE-functions']);
      if(r.error) fail(r.error);
      if(r.newer && !a.allowNewer) fail(`This functions file was saved by a newer version of fmIDE (format version ${r.fromVersion}). Pass allowNewer: true to read it anyway.`);
      const out = addMissingFunctions(r.data.functions);
      saveWorkspaceSoon();
      return out;
    } });

  defineAction({ name:'exportFunctions', label:'Export Functions', category:'File', icon:'⇩', returns:'value', mutates:false, tx:false,
    desc:'Writes an fmIDE-functions file: the functions named in functions (each with all its versions), or the whole library, and every function they call. Downloads it unless download is false; returns the file\'s content.',
    params:[ P('download','bool',{ def:true }), P('functions','json',{ optional:true, help:'list of function references' }) ],
    run(a){
      let families = null;
      if(a.functions != null){
        if(!Array.isArray(a.functions)) fail('functions must be a list, like ["Margin", "Profit"].');
        families = a.functions.map(ref => resolveFunctionRef(ref).family);
      }
      const payload = functionsFilePayload(families);
      if(a.download) downloadJSON(payload, `fmIDE-functions-${timestamp()}.json`);
      return payload;
    } });

  // ---------- function nodes (step 7, phase D2b) ----------
  // A node's `fn` points at one version the model carries (modelFunctions). Inserting a
  // version copies it, and every function it calls, from the library into the model;
  // updating and changing move a node to another version, matching its arrows to the new
  // inputs by name. Each is one undo step, definitions included.
  function requireFunctionNode(n){ return requireType(n, ['function'], 'a function node'); }
  // Nodes named in updateFunctionUses: "Canvas::#id" or "#id" / "id" on any canvas.
  function functionNodesFromRefs(list){
    if(!Array.isArray(list)) fail('nodes must be a list of node references, like ["#n12", "Canvas 2::#n7"].');
    syncActiveIntoRegistry();
    return list.map(ref => {
      const s = String(ref == null ? '' : ref).trim();
      if(s.includes('::')){ const [n] = resolveNodes(s); return { canvas: canvasOfNode(n), node: n }; }
      const id = s.replace(/^#/, '');
      const hits = [];
      canvases.forEach(c => nodesIn(c).forEach(n => { if(n.id === id) hits.push({ canvas: c, node: n }); }));
      if(hits.length !== 1) fail(hits.length ? `More than one canvas has a node #${id} — write it as "Canvas::#${id}".` : `There is no node #${id}.`);
      return hits[0];
    });
  }

  defineAction({ name:'insertFunction', label:'Insert Function', category:'Insert', icon:'ƒ', returns:'node',
    desc:'Adds a function node for a version in your library: "Name" (the latest version), "Name@latest", "Name@2", or the same with the family id. The version, and every function it calls, is copied into the model. Fails when the model already carries a different version under the same number (update its nodes first).',
    params:[ P('function','string'), PX, PY ],
    run(a){
      const d = resolveFunctionRef(a.function);
      const parsed = parseFunctionText(d.text);
      if(!parsed.ok) fail(`${functionLabel(d)} v${d.version} can't be read, so it can't be inserted: ${parsed.error.message}`);
      const list = functionWithCallees(d);
      addFunctionsToModel(list, 'check', d);
      pushHistory();
      addFunctionsToModel(list, 'refuse', d);
      const n = { id: uid('n'), type:'function', x: clampPos(a.x), y: clampPos(a.y), w:190, h: functionNodeHeight(parsed.params.length, false),
        fn: { family: d.family, version: d.version, versionId: d.versionId, name: functionNameOf(d) } };
      nodes.push(n);
      clearComputed();
      evaluateAll();
      return n.id;
    } });

  // The library version `version` ("latest" or a number) of node n's family.
  function functionTargetFor(n, version){
    const st = functionNodeState(n);
    const fam = st.lib ? st.lib.family : (st.ref && FUNCTIONS.some(f => f.family === st.ref.family) ? st.ref.family : null);
    if(!fam) fail(`${functionNodeTitle(n, st)} isn't in your function library, so there is nothing to update it to.`);
    const want = String(version == null ? 'latest' : version).trim().toLowerCase();
    const all = functionFamilyVersions(fam);
    const t = (want === '' || want === 'latest') ? all[0] : all.find(v => String(v.version) === want);
    if(!t) fail(`There is no version ${want} of ${functionLabel(all[0])} (it has version${all.length === 1 ? '' : 's'} ${all.map(v => v.version).reverse().join(', ')}).`);
    return { st, target: t };
  }

  defineAction({ name:'updateFunctionNode', label:'Update Function Node', category:'Insert', icon:'⬆', returns:'value',
    desc:'Moves one function node to another version of its function in your library ("latest", or a number). Arrows follow their inputs by name; an arrow into an input the new version doesn\'t have is dropped. Returns { version, dropped: [{ node, canvas, input, from }] }.',
    params:[ P('node','node'), P('version','string',{ def:'latest', help:'"latest" or a version number' }) ],
    run(a){
      requireFunctionNode(a.node);
      const { st, target } = functionTargetFor(a.node, a.version);
      if(st.lib === target && !st.problem) return { version: target.version, dropped: [] };
      const plan = functionNodeUpdatePlan(canvasOfNode(a.node), a.node, target);
      pushHistory();
      return { version: target.version, dropped: applyFunctionNodeUpdates([plan]) };
    } });

  defineAction({ name:'changeFunction', label:'Change Function', category:'Insert', icon:'ƒ', returns:'value',
    desc:'Switches a function node to another function or version from your library ("Name", "Name@2", …), like a block\'s "Change block". Arrows follow their inputs by name; the others are dropped. Returns { dropped: [{ node, canvas, input, from }] }.',
    params:[ P('node','node'), P('function','string') ],
    run(a){
      requireFunctionNode(a.node);
      const target = resolveFunctionRef(a.function);
      const st = functionNodeState(a.node);
      if(st.lib === target && !st.problem) return { dropped: [] };
      const plan = functionNodeUpdatePlan(canvasOfNode(a.node), a.node, target);
      pushHistory();
      return { dropped: applyFunctionNodeUpdates([plan]) };
    } });

  defineAction({ name:'updateFunctionUses', label:'Update Every Use of a Function', category:'Insert', icon:'⬆', returns:'value',
    desc:'Moves the model\'s nodes of a function to a version in your library ("Name" = the latest, "Name@3"). Without nodes: every node on an older version, except those marked "Not now" for it or a newer one; nodes on that version or newer are left alone. nodes names the ones to update ("#id" or "Canvas::#id"). One undo step. Returns { updated, dropped: [{ node, canvas, input, from }] }.',
    params:[ P('function','string'), P('nodes','json',{ optional:true, help:'list of node references' }) ],
    run(a){
      const target = resolveFunctionRef(a.function);
      let picked;
      if(a.nodes == null){
        picked = functionUsesPlan(target.family, target).filter(r => r.tick);
      } else {
        picked = functionNodesFromRefs(a.nodes).map(({ canvas, node }) => {
          requireFunctionNode(node);
          const st = functionNodeState(node);
          if(!st.ref || st.ref.family !== target.family) fail(`${functionNodeTitle(node, st)} isn't a node of ${functionLabel(target)}.`);
          return { canvas, node };
        });
      }
      if(!picked.length) return { updated: 0, dropped: [] };
      const plans = picked.map(r => functionNodeUpdatePlan(r.canvas, r.node, target));
      pushHistory();
      return { updated: plans.length, dropped: applyFunctionNodeUpdates(plans) };
    } });

  defineAction({ name:'skipFunctionUpdate', label:'Not Now (Function Update)', category:'Insert', icon:'⏸',
    desc:'Declines the newer version of a function node\'s function for now: its ⬆ goes away until an even newer version appears (the node remembers the version it declined, fn.skipped).',
    params:[ P('node','node') ],
    run(a){
      requireFunctionNode(a.node);
      const st = functionNodeState(a.node);
      if(!st.newer) return NOOP;
      pushHistory();
      a.node.fn = Object.assign({}, a.node.fn, { skipped: st.newer.version });
    } });

  defineAction({ name:'addFunctionDefinition', label:'Add Function Definition from Library', category:'Insert', icon:'ƒ',
    desc:'For a function node whose definition is missing from the model, copies that exact version (the same versionId) from your library into the model, with what it calls.',
    params:[ P('node','node') ],
    run(a){
      requireFunctionNode(a.node);
      const st = functionNodeState(a.node);
      if(!st.problem) return NOOP;
      if(!st.repair) fail(`Your library doesn't have this exact version of ${st.name}, so its definition can't be added.`);
      pushHistory();
      // The model may use this version's number for another version: it comes in renumbered.
      const remap = addFunctionsToModel(functionWithCallees(st.repair), 'renumber');
      const r = remap(st.repair);
      if(r) a.node.fn = Object.assign({}, a.node.fn, { version: r.version });
      clearComputed();
      evaluateAll();
    } });
