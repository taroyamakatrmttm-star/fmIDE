// ============================================================
// Opening a model in fmGraph (the model itself is read and built in 02-model.js, which the
// showcase viewer takes in too): fmGraph's trial, tutorial, templates and boards around it.
// ============================================================

// Opens a file's text (from the disk, a drop or fmIDE). Resolves true when a model was loaded.
// opts.boards: the document's own boards (an fmIDE-graph-board file, parsed or as text) —
// fmIDE's (step 15 G3b), or a workspace's `graphBoards`; opts.fromFmide: the model came from
// fmIDE's window, so changes to the boards go back to it (06-page.js); opts.trial: a template
// tried from fmIDE's Browse Library ({ name, pack }, G5c, 06e-trial.js): nothing kept;
// opts.practice: a tutorial's practice copy ('sliders' | 'sample', its starting board; G6,
// 07b-tutorials.js): nothing kept.
async function openModelText(text, name, opts){
  const big = fileTextProblem(text);
  if(big){ notify(big, 'err', 'load'); return false; }
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ notify("That file isn't JSON fmGraph can read.", 'err', 'load'); return false; }
  const deep = fileDataProblem(raw);
  if(deep){ notify(deep, 'err', 'load'); return false; }
  const r = readModelData(raw);
  if(r.error){ notify(r.error, 'err', 'load'); return false; }
  if(r.newer || r.newerParts.length){
    const what = r.newer ? 'This ' + FILE_FORMATS[r.kind].label + ' (format version ' + r.fromVersion + ')' : 'Part of this file — ' + r.newerParts.join(', ') + ' —';
    const go = await askConfirm('Saved by a newer version', what + ' was saved by a newer version of fmIDE. Open it anyway? Anything the newer version added may be ignored.', 'Open Anyway');
    if(!go) return false;
  }
  const o = opts || {};
  if(practice && !o.practice) stopTutorial(false); // another model opened during a tutorial ends it (07b-tutorials.js)
  try{
    const docBoards = o.boards !== undefined ? o.boards : (r.kind === 'fmIDE-workspace' ? r.data.graphBoards : null);
    // Its templates' boards (G5b): from fmIDE, or a workspace's own templates.
    const templates = o.templates !== undefined ? o.templates
      : r.kind === 'fmIDE-workspace' && Array.isArray(r.data.templates) ? r.data.templates.filter(t => t && t.attachments && t.attachments.graph)
        .map(t => ({ family: t.family, kind: t.kind, name: t.name, version: t.version, versionId: t.versionId, board: t.attachments.graph })) : [];
    await loadModel(r.kind === 'fmIDE-workspace' ? r.data.system : r.data, name, { boards: docBoards, fromFmide: !!o.fromFmide, templates, trial: o.trial, practice: o.practice });
    // What a tutorial puts back afterwards (its boards then from this browser, where they were saved).
    if(!o.practice && !o.trial) lastOpened = { text, name, opts: { boards: null, fromFmide: !!o.fromFmide, templates } };
  }catch(e){
    notify(e && e.message ? e.message : 'That model could not be opened.', 'err', 'load');
    return false;
  }
  return true;
}

async function loadModel(system, name, opts){
  const m = buildModel(system, name);
  model = m;
  linkedToFmide = !!(opts && opts.fromFmide);
  trying = opts && opts.trial ? opts.trial : null; // G5c (06e-trial.js)
  practiceStart = opts && opts.practice ? opts.practice : null; // G6 (07b-tutorials.js)
  clearResultCache();
  resetSharedValues(); // (03-calc.js)
  pinA = null; forgetGeometry(); renderCompareBar(); // a new model: no A, nothing to glide from (05e-compare.js)
  m.templateSources = cleanTemplateSources(opts && opts.templates); // its templates' boards (06d-template-sources.js)
  await loadBoardFor(m, opts && opts.boards);
  renderTrialBar();
  showBoard();
}
