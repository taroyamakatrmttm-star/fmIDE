  // ---------- function plugins: the library and the model's definitions (step 7, phase D) ----------
  // A function is a formula held in files (src/shared/functions.js). fmIDE keeps two lists:
  // - FUNCTIONS, the person's library (one entry per version), saved in the workspace and in
  //   fmIDE-functions files;
  // - modelFunctions (06-align-marquee-computation.js), the definitions the open model carries
  //   and calculates with. A file written from the model carries the ones it uses
  //   (functionsForFile), so a model always takes its functions with it.
  // Definitions from files are cleaned (cleanFunctionDefinitions) and never run as code.
  let FUNCTIONS = [];

  // Library definitions from files are read with cleanLibraryFunctions (src/shared/fmide-files.js).

  // Same version: the same family and versionId (or, for a definition without a versionId,
  // the same family and version number).
  function sameFunctionVersion(a, b){
    if(a.family !== b.family) return false;
    return (a.versionId || b.versionId) ? a.versionId === b.versionId : a.version === b.version;
  }
  // Definitions from a file (Open, Import Workspace, Import Functions, a model's own) join
  // the library. Nothing of the person's is replaced or removed, as for templates:
  //  - a version already here (the same family and versionId, or — without a versionId —
  //    the same family and text) is skipped;
  //  - a version whose number is free in its family is added as it is;
  //  - a version whose number is taken by a different version is added after the file's
  //    other versions, as the family's next number, keeping its versionId, with a note
  //    saying so. Calls to it in the library follow it (they match by versionId).
  // Returns { added, present, renumbered }.
  // Whether a definition from a file is already in the library (the rule above).
  function functionAlreadyHere(d){
    return FUNCTIONS.some(f => sameFunctionVersion(f, d))
      || (!d.versionId && FUNCTIONS.some(f => f.family === d.family && f.text === d.text));
  }
  function addMissingFunctions(list){
    let added = 0, present = 0, renumbered = 0;
    const clashes = [], moved = [];
    const here = functionAlreadyHere;
    cleanLibraryFunctions(list).forEach(d => {
      if(here(d)){ present++; return; }
      if(FUNCTIONS.some(f => f.family === d.family && f.version === d.version)){ clashes.push(d); return; }
      FUNCTIONS.push(d); added++;
    });
    clashes.forEach(d => {
      if(here(d)){ present++; return; } // the same version twice in one file
      const was = d.version;
      d.version = nextFunctionVersion(d.family);
      if(!d.versionId) d.versionId = newRandomId();
      d.note = (`Imported — was v${was} in the file` + (d.note ? ': ' + d.note : '')).slice(0, FUNCTION_LIMITS.note);
      moved.push(d);
      FUNCTIONS.push(d); added++; renumbered++;
    });
    if(moved.length) FUNCTIONS.forEach(f => f.calls.forEach(c => {
      const m = c.versionId && moved.find(d => d.family === c.family && d.versionId === c.versionId);
      if(m) c.version = m.version;
    }));
    return { added, present, renumbered };
  }
  // The library as saved in the autosave.
  function restoreFunctions(list){ FUNCTIONS = cleanLibraryFunctions(list); }

  // A model's definitions replace the open model's (a system replaces everything).
  function setModelFunctions(list){
    modelFunctions = cleanFunctionDefinitions(list);
    addMissingFunctions(modelFunctions);
    invalidateIR();
  }
  // Definitions of content added to the open model (a module, a system added to it, a
  // template, pasted nodes): each version the model doesn't carry yet joins it, and the
  // library (addMissingFunctions). Returns remapFunctionRef — see addFunctionsToModel.
  function mergeModelFunctions(list){ return addFunctionsToModel(list, 'renumber'); }

  // Adds definitions to the model's own (decided September 2026, D2b):
  //  - a version the model already carries (the same family and versionId; without a
  //    versionId, the same family, number and text) is not added again;
  //  - a version whose number is free in the model's copy of its family is added as it is;
  //  - a different version under a number the model already uses: onClash 'refuse' fails
  //    (Insert Function, which points to Update; 'check' only checks, adding nothing);
  //    'renumber' adds it under the family's next
  //    free number in the model, keeping its versionId, with a note (the library's own import
  //    rule). Calls among the added definitions follow the new numbers.
  // Returns remap(ref): the { family, version, versionId } a node's `fn` (or a call) means in
  // the model now, or null when its number didn't change.
  function addFunctionsToModel(list, onClash, what){
    const defs = cleanFunctionDefinitions(list);
    const moved = []; // { family, versionId, from, to }
    const remap = (ref) => {
      const r = cleanFunctionRef(ref);
      const m = r && moved.find(x => x.family === r.family && x.from === r.version && (!r.versionId || !x.versionId || x.versionId === r.versionId));
      return (m && m.to !== m.from) ? { family: r.family, version: m.to, versionId: r.versionId } : null;
    };
    if(!defs.length) return remap;
    const added = [], clashes = [];
    const pool = () => modelFunctions.concat(added);
    defs.forEach(d => {
      const same = d.versionId && pool().find(m => m.family === d.family && m.versionId === d.versionId);
      if(same){ moved.push({ family: d.family, versionId: d.versionId, from: d.version, to: same.version }); return; }
      const there = pool().find(m => m.family === d.family && m.version === d.version);
      if(!there){ added.push(d); return; }
      if(!there.versionId && !d.versionId && there.text === d.text) return;
      if(onClash === 'refuse' || onClash === 'check'){
        const name = functionLabel(d);
        fail(`This model already uses a different version ${d.version} of ${name}` + (what && what !== d ? ` (which ${functionLabel(what)} calls)` : '')
          + `. To use this one, first update the model's ${name} nodes to another version (⋯ → Update, or Update Function…).`);
      }
      clashes.push(d);
    });
    if(onClash === 'check') return remap;
    clashes.forEach(d => {
      const same = d.versionId && pool().find(m => m.family === d.family && m.versionId === d.versionId);
      if(same){ moved.push({ family: d.family, versionId: d.versionId, from: d.version, to: same.version }); return; }
      const to = pool().reduce((mx, m) => (m.family === d.family ? Math.max(mx, m.version) : mx), 0) + 1;
      moved.push({ family: d.family, versionId: d.versionId, from: d.version, to });
      d.note = (`Was v${d.version} where it came from; this model already had a different v${d.version}` + (d.note ? ': ' + d.note : '')).slice(0, FUNCTION_LIMITS.note);
      d.version = to;
      added.push(d);
    });
    added.forEach(d => d.calls.forEach(c => { const r = remap(c); if(r) c.version = r.version; }));
    if(added.length){
      modelFunctions = modelFunctions.concat(added);
      addMissingFunctions(added);
      invalidateIR();
    }
    return remap;
  }
  // Points function nodes at the numbers `remap` (addFunctionsToModel) gave their versions.
  // Returns the list with changed nodes copied (the originals are left alone).
  function remapFunctionNodes(list, remap){
    return list.map(n => {
      if(!n || n.type !== 'function' || !n.fn) return n;
      const r = remap(n.fn);
      return r ? Object.assign({}, n, { fn: Object.assign({}, n.fn, { version: r.version }) }) : n;
    });
  }
  // Drops the definitions nothing in the model uses any more (a definition another one calls
  // stays). Called where nodes or canvases go, in the same undo step (decided in D2b).
  function trimModelFunctions(){
    if(!modelFunctions.length) return;
    syncActiveIntoRegistry();
    const keep = functionsUsedBy(canvases, modelFunctions);
    if(keep.length !== modelFunctions.length){ modelFunctions = keep; invalidateIR(); }
  }
  // What a file written from `canvasList` carries: the definitions its function nodes use,
  // and every function those call (the model's own first, then the library's).
  function functionsForFile(canvasList){
    return functionsUsedBy(canvasList, modelFunctions.concat(FUNCTIONS));
  }
  // `payload` with `functions` added when the canvases use any (files without functions stay
  // as they were).
  function withFunctions(payload, canvasList){
    const list = functionsForFile(canvasList);
    if(list.length) payload.functions = list;
    return payload;
  }

  // ---------- the library: families and versions (step 7, phase D2) ----------
  // FUNCTIONS holds one entry per version, like TEMPLATES: versions of one function share a
  // `family` (a lasting random id) and are numbered 1, 2, 3…, each with its own `versionId`,
  // `note` and `description`. The family's name is its latest version's function name (read
  // from its text). "Save as new version" is the only way to add a version; the latest is
  // deleted only with its whole family, so a number is never used twice.
  function functionFamilyVersions(family){
    return FUNCTIONS.filter(f => f.family === family).sort((a, b) => b.version - a.version);
  }
  function latestFunctionOf(family){ return functionFamilyVersions(family)[0] || null; }
  function isLatestFunction(d){ return latestFunctionOf(d.family) === d; }
  function nextFunctionVersion(family){
    return FUNCTIONS.reduce((m, f) => (f.family === family ? Math.max(m, f.version) : m), 0) + 1;
  }
  // One entry per family (its latest version), in the order the families first appear.
  function functionFamilies(){
    const seen = new Set(), out = [];
    FUNCTIONS.forEach(f => { if(!seen.has(f.family)){ seen.add(f.family); out.push(latestFunctionOf(f.family)); } });
    return out;
  }
  // A definition's function name, for showing (it may be unreadable).
  function functionLabel(d){ return functionNameOf(d) || '(unreadable)'; }
  // Families whose latest version is called `name` (capitals don't matter, as in formulas).
  function functionFamiliesNamed(name){
    const k = String(name || '').trim().toLowerCase();
    return functionFamilies().filter(f => functionNameOf(f).toLowerCase() === k);
  }
  // The library entry a reference (a node's `fn`, an entry of `calls`) means: the one with
  // its versionId (a version renumbered on import keeps it), else — without a versionId —
  // the family and number. Null when the library doesn't have it.
  function libraryFunctionFor(ref){
    const r = cleanFunctionRef(ref);
    if(!r) return null;
    if(r.versionId){
      const hit = FUNCTIONS.find(f => f.family === r.family && f.versionId === r.versionId);
      if(hit) return hit;
    }
    return FUNCTIONS.find(f => f.family === r.family && f.version === r.version && (!r.versionId || !f.versionId)) || null;
  }
  // `d` and every library function it calls, directly or not (each once, callees after).
  function functionWithCallees(d){
    const out = [];
    const visit = (x) => {
      if(!x || out.includes(x)) return;
      out.push(x);
      x.calls.forEach(c => visit(libraryFunctionFor(c)));
    };
    visit(d);
    return out;
  }
  // Library functions that call `d` (any version of them).
  function functionCallersOf(d){
    return FUNCTIONS.filter(f => f !== d && f.calls.some(c => libraryFunctionFor(c) === d));
  }
  // Function nodes of the open model that use `family` (a version of it when `version` is given).
  function functionNodesUsing(family, version){
    syncActiveIntoRegistry();
    const out = [];
    canvases.forEach(c => (c.nodes || []).forEach(n => {
      if(n.type === 'function' && n.fn && n.fn.family === family && (version == null || n.fn.version === version)) out.push({ canvas: c, node: n });
    }));
    return out;
  }
  // A call the function makes to an older version than the library's latest of that family.
  function olderCallsOf(d){
    return d.calls.map(c => {
      const target = libraryFunctionFor(c);
      const latest = target && latestFunctionOf(target.family);
      return (target && latest !== target) ? { name: c.name, version: target.version, latest: latest.version } : null;
    }).filter(Boolean);
  }

  // The name each called function is written with in a parsed formula, by its lower-case key.
  function writtenCallNames(body){
    const out = Object.create(null);
    const walk = (x) => {
      if(!x || typeof x !== 'object') return;
      if(x.t === 'call' && !(x.key in out)) out[x.key] = x.name;
      if(x.a) walk(x.a);
      if(Array.isArray(x.args)) x.args.forEach(walk);
    };
    walk(body);
    return out;
  }

  // How a definition being saved pins each function it calls (decided September 2026):
  //  - one the person picked (`picks`, by lower-case name: a library entry) is used;
  //  - a new version keeps what the version it starts from pinned (while the library has it);
  //  - otherwise a name that one family has takes that family's latest version;
  //  - a name several families have must be picked ('choose'); a name no family has can't be
  //    saved ('missing').
  // Returns { calls: [{ key, name, chosen, options, state, latest }], ok }: `options` are the
  // versions the person can choose from, newest first.
  function planFunctionCalls(parsed, base, picks){
    const names = writtenCallNames(parsed.body);
    const calls = parsed.calls.map(key => {
      const name = names[key] || key;
      const pinned = base && base.calls.find(c => c.name.toLowerCase() === key);
      const pinnedEntry = pinned ? libraryFunctionFor(pinned) : null;
      const families = functionFamiliesNamed(name).map(f => f.family);
      if(pinnedEntry && !families.includes(pinnedEntry.family)) families.unshift(pinnedEntry.family);
      const options = [];
      families.forEach(fam => functionFamilyVersions(fam).forEach(v => options.push(v)));
      let chosen = picks && picks[key] && FUNCTIONS.includes(picks[key]) ? picks[key] : null;
      if(chosen && !options.includes(chosen)) options.unshift(chosen);
      if(!chosen && pinnedEntry) chosen = pinnedEntry;
      if(!chosen && families.length === 1) chosen = latestFunctionOf(families[0]);
      const state = chosen ? 'ok' : (families.length ? 'choose' : 'missing');
      return { key, name, chosen, options, state, latest: chosen ? latestFunctionOf(chosen.family) : null };
    });
    return { calls, ok: calls.every(c => c.state === 'ok') };
  }

  // What a formula typed in the editor (or given to fm.saveFunction) would save as, and what
  // stops it: { parsed, plan, draft, problem } — `problem` is { message, at?, length? } or
  // null. `base` is the version it follows (a new version) or null (a new function).
  function checkFunctionDraft(text, base, picks){
    const parsed = parseFunctionText(text);
    if(!parsed.ok) return { parsed, plan: null, draft: null, problem: parsed.error };
    if(base){
      const famName = functionNameOf(latestFunctionOf(base.family) || base);
      if(famName && parsed.name.toLowerCase() !== famName.toLowerCase()){
        return { parsed, plan: null, draft: null, problem: { message: `A new version keeps the name ${famName}. To make a function with another name, use “+ New Function”.`, at: 0, length: parsed.name.length } };
      }
    }
    const plan = planFunctionCalls(parsed, base, picks);
    const draft = { family: base ? base.family : 'draft-function', version: base ? nextFunctionVersion(base.family) : 1, versionId: 'draft-version',
      text, description: '', note: '',
      calls: plan.calls.filter(c => c.chosen).map(c => ({ name: c.name, family: c.chosen.family, version: c.chosen.version, versionId: c.chosen.versionId })) };
    const missing = plan.calls.find(c => c.state === 'missing');
    if(missing) return { parsed, plan, draft, problem: { message: `${missing.name} isn't in your library — create it first.` } };
    const choose = plan.calls.find(c => c.state === 'choose');
    if(choose) return { parsed, plan, draft, problem: { message: `More than one function in your library is called ${choose.name}: choose which one this function calls.` } };
    // The whole chain calculates: inputs counted, no loop, not too deep.
    const callees = [];
    plan.calls.forEach(c => functionWithCallees(c.chosen).forEach(x => { if(!callees.includes(x)) callees.push(x); }));
    const compiled = compileFunctions([draft].concat(callees)).resolve(draft);
    if(compiled && compiled.status){
      const wrong = plan.calls.find(c => {
        const t = compiled.targets.get(c.key);
        return t && t.params.length !== countCallArgs(parsed.body, c.key);
      });
      const message = wrong
        ? `${wrong.name} v${wrong.chosen.version} takes ${compiled.targets.get(wrong.key).params.length} input${compiled.targets.get(wrong.key).params.length === 1 ? '' : 's'}; here it is given ${countCallArgs(parsed.body, wrong.key)}.`
        : (FUNCTION_DRAFT_PROBLEMS[compiled.status] || 'This function can\'t be calculated.');
      return { parsed, plan, draft, problem: { message } };
    }
    return { parsed, plan, draft, problem: null };
  }
  const FUNCTION_DRAFT_PROBLEMS = {
    'function-missing': 'A function it calls uses another function that isn\'t in your library.',
    'function-unreadable': 'A function it calls can\'t be read.',
    'function-cycle': 'Its functions call each other in a loop.',
    'function-too-deep': `Its calls are nested more than ${FUNCTION_LIMITS.callDepth} functions deep.`,
    'function-arguments': 'A function it calls gives another function the wrong number of inputs.',
  };
  // How many inputs the first call to `key` in a parsed formula is given (-1: none).
  function countCallArgs(body, key){
    let n = -1;
    const walk = (x) => {
      if(n >= 0 || !x || typeof x !== 'object') return;
      if(x.t === 'call' && x.key === key){ n = x.args.length; return; }
      if(x.a) walk(x.a);
      if(Array.isArray(x.args)) x.args.forEach(walk);
    };
    walk(body);
    return n;
  }

  // Saves a checked draft as a new family (base null) or the next version of base's family.
  function saveFunctionDraft(check, base, description, note){
    const d = cleanFunctionDefinition({
      family: base ? base.family : newRandomId(), version: base ? nextFunctionVersion(base.family) : 1, versionId: newRandomId(),
      text: check.draft.text, description: String(description || '').trim(), note: String(note || '').trim(), calls: check.draft.calls });
    FUNCTIONS.push(d);
    saveWorkspaceSoon();
    return d;
  }

  // Deletes one version, or (for the latest) the whole family. Returns how many versions went.
  function deleteLibraryFunction(d){
    const before = FUNCTIONS.length;
    FUNCTIONS = isLatestFunction(d) ? FUNCTIONS.filter(f => f.family !== d.family) : FUNCTIONS.filter(f => f !== d);
    saveWorkspaceSoon();
    return before - FUNCTIONS.length;
  }

  // An fmIDE-functions file holding `families` (all when null): every version of each, and
  // every function those call, in the library's order.
  function functionsFilePayload(families){
    const picked = new Set();
    FUNCTIONS.forEach(f => { if(!families || families.includes(f.family)) functionWithCallees(f).forEach(x => picked.add(x)); });
    return { version: FILE_FORMATS['fmIDE-functions'].current, kind: 'fmIDE-functions',
      functions: cloneData(FUNCTIONS.filter(f => picked.has(f))) };
  }

  // A function reference as typed in fm actions and macros: "Name" (the latest version),
  // "Name@latest", "Name@3", the same with the family id, or an object { family, version }.
  function resolveFunctionRef(ref){
    if(ref && typeof ref === 'object'){
      const hit = libraryFunctionFor(ref);
      if(!hit) fail('That function version isn\'t in your library.');
      return hit;
    }
    const s = String(ref == null ? '' : ref).trim();
    if(!s) fail('Name a function, like "Margin" or "Margin@2".');
    const family = (text) => {
      if(FUNCTIONS.some(f => f.family === text)) return latestFunctionOf(text);
      const named = functionFamiliesNamed(text);
      if(named.length > 1) fail(`More than one function in your library is called "${text}" — refer to it by its family ID.`);
      return named[0] || null;
    };
    const m = /^(.*?)\s*@\s*(latest|\d+)$/i.exec(s);
    const base = family(m ? m[1] : s);
    if(!base) fail(`There is no function called "${m ? m[1] : s}" in your library.`);
    if(!m || m[2].toLowerCase() === 'latest') return base;
    const all = functionFamilyVersions(base.family);
    const v = all.find(f => f.version === Number(m[2]));
    if(!v) fail(`There is no version ${m[2]} of ${functionLabel(base)} (it has version${all.length === 1 ? '' : 's'} ${all.map(f => f.version).reverse().join(', ')}).`);
    return v;
  }
  // How a recorded macro refers to a version: by name when one family has it, else by family id.
  function functionRefText(d){
    const name = functionNameOf(d);
    const head = (name && functionFamiliesNamed(name).length === 1) ? name : d.family;
    return isLatestFunction(d) ? head : head + '@' + d.version;
  }
