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
