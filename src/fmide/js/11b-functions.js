  // ---------- function plugins: the library and the model's definitions (step 7, phase D) ----------
  // A function is a formula held in files (src/shared/functions.js). fmIDE keeps two lists:
  // - FUNCTIONS, the person's library (one entry per version), saved in the workspace and in
  //   fmIDE-functions files;
  // - modelFunctions (06-align-marquee-computation.js), the definitions the open model carries
  //   and calculates with. A file written from the model carries the ones it uses
  //   (functionsForFile), so a model always takes its functions with it.
  // Definitions from files are cleaned (cleanFunctionDefinitions) and never run as code.
  let FUNCTIONS = [];

  // Same version: the same family and versionId (or, for a definition without a versionId,
  // the same family and version number).
  function sameFunctionVersion(a, b){
    if(a.family !== b.family) return false;
    return (a.versionId || b.versionId) ? a.versionId === b.versionId : a.version === b.version;
  }
  // Adds to the library the definitions in `list` it doesn't have yet. Returns how many.
  function addMissingFunctions(list){
    let added = 0;
    cleanFunctionDefinitions(list).forEach(d => {
      if(!FUNCTIONS.some(f => sameFunctionVersion(f, d))){ FUNCTIONS.push(d); added++; }
    });
    return added;
  }
  // The library as saved in the autosave.
  function restoreFunctions(list){ FUNCTIONS = cleanFunctionDefinitions(list); }

  // A model's definitions replace the open model's (a system replaces everything).
  function setModelFunctions(list){
    modelFunctions = cleanFunctionDefinitions(list);
    addMissingFunctions(modelFunctions);
    invalidateIR();
  }
  // Definitions of content added to the open model (a module, a system added to it, a
  // template): each family and version the model doesn't carry yet joins it. One it already
  // carries stays as it is — the model's nodes already use it.
  function mergeModelFunctions(list){
    const defs = cleanFunctionDefinitions(list);
    if(!defs.length) return;
    defs.forEach(d => {
      if(!modelFunctions.some(f => f.family === d.family && f.version === d.version)) modelFunctions.push(d);
    });
    addMissingFunctions(defs);
    invalidateIR();
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
