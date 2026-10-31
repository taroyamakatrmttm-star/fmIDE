  // ---------------------------------- Simplify for inputs (11h-simplify.js) ----------------------------------
  // Working it out takes seconds on a large model, in pieces so the page stays responsive, so
  // these return a Promise and a macro can't run them (macro: false): not offered in the Macro
  // Builder, never recorded. The copy is a document, not a node or a canvas: what they give back
  // is a value.
  const SIMPLIFY_NOT_IN_MACROS = 'Simplifying can\'t be a macro step: it works for seconds. Use File → Simplify for Inputs….';

  // The inputs as the API takes them: { rectangle: name or #id, canvas: name or #id (the current
  // one if left out), min, max, step, mode: 'set' | 'shift', periods: 'all', a period counted
  // from 1, or { from, to } } — or { canvasId, nodeId, … }. None given: the boards' sliders.
  function simplifyInputsFromArgs(list){
    if(list === null || list === undefined){
      const s = simplifyFromBoards().sliders;
      if(!s.length) fail('Name the inputs: the document has no fmGraph boards with sliders to take them from.');
      return s;
    }
    if(!Array.isArray(list) || !list.length) fail('inputs: a list like [{ "rectangle": "Units", "min": 0, "max": 10, "step": 1 }].');
    return list.map((x, i) => {
      if(!x || typeof x !== 'object') fail('Input ' + (i + 1) + ' isn\'t an input: give { "rectangle": …, "min": …, "max": … }.');
      let canvasId = x.canvasId, nodeId = x.nodeId;
      if(nodeId === undefined){
        const c = resolveCanvasRef(x.canvas);
        const nodes = resolveNodes(x.rectangle, c);
        if(nodes.length !== 1) fail('Input ' + (i + 1) + ' names ' + nodes.length + ' rectangles on ' + c.name + ': name just one.');
        canvasId = c.id; nodeId = nodes[0].id;
      }
      const p = x.periods;
      const periods = typeof p === 'number' ? { mode: 'one', p: p - 1 }
        : p && typeof p === 'object' && p.from !== undefined ? { mode: 'range', from: p.from - 1, to: p.to - 1 }
        : p && typeof p === 'object' && p.mode ? p : { mode: 'all' };
      return { canvasId, nodeId, min: x.min, max: x.max, step: x.step, mode: x.mode, periods };
    });
  }
  function simplifyFromArgs(a){
    if(runCtx) fail(SIMPLIFY_NOT_IN_MACROS);
    if(inPractice()) fail('Not while practising a tutorial: the practice model isn\'t your document.');
    const { inputs, problems } = simplifyInputs(buildSystemPayload(), simplifyInputsFromArgs(a.sliders ? null : a.inputs));
    if(problems.length) fail(problems.join(' '));
    if(!inputs.length) fail('No inputs to simplify for.');
    const boards = simplifyBoardsFor(inputs);
    const keep = Array.isArray(a.keep) ? a.keep : [];
    return runSimplify(inputs, { keep, extraRuns: boards.extraRuns, shown: boards.shown }).promise.then(r => Object.assign(r, { scenariosLeft: boards.left }));
  }

  defineAction({ name:'simplifyPlan', label:'Simplify Plan', category:'File', icon:'✂', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Works out what Simplify for Inputs… would keep, without making the copy: the model at every step of each input, at the corners and at random combinations, every other input at today\'s number. inputs: [{ rectangle, canvas, min, max, step, mode, periods }] (periods: "all", a period counted from 1, or { from, to }); left out, or sliders true, the fmGraph boards\' sliders. keep: [{ canvasId, nodeId }] or [{ canvasId }], kept anyway. The boards\' scenarios are tried when every input they set is one of these (else left out: scenariosLeft); the canvases marked Always Keep When Simplifying are kept (alwaysKept). Returns a Promise of { kept, total, canvases, removed, fixed, folded, removedCanvases, unlinked, alwaysKept, scenariosLeft, zeros, runs, ms, checked }. Not in macros.',
    params:[ P('sliders','bool',{ def:false, help:'the fmGraph boards\' sliders as the inputs (as when inputs is left out)' }),
      P('inputs','json',{ optional:true, help:'[{ "rectangle": "Units", "min": 0, "max": 10, "step": 1 }]' }),
      P('keep','json',{ optional:true, help:'[{ "canvasId": "c1", "nodeId": "n5" }]' }) ],
    run(a){ return simplifyFromArgs(a).then(simplifySummary); } });

  defineAction({ name:'simplifyForInputs', label:'Simplify for Inputs', category:'File', icon:'✂', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Makes a copy of the model holding only what the inputs move within their ranges (as simplifyPlan), and opens it as a new, unsaved document; the model open now is not changed. With unsaved changes it fails unless discardChanges is true. download: true downloads the copy as a .fmide file instead of opening it. name: the copy\'s name. Returns a Promise of simplifyPlan\'s answer with { name, opened, downloaded }. Not in macros.',
    params:[ P('sliders','bool',{ def:false, help:'the fmGraph boards\' sliders as the inputs (as when inputs is left out)' }),
      P('inputs','json',{ optional:true, help:'[{ "rectangle": "Units", "min": 0, "max": 10, "step": 1 }]' }),
      P('keep','json',{ optional:true, help:'[{ "canvasId": "c1", "nodeId": "n5" }]' }),
      P('name','string',{ optional:true, help:'the copy\'s name; left out, this one\'s with (simplified)' }),
      P('download','bool',{ def:false }), P('discardChanges','bool',{ def:false }) ],
    run(a){
      if(!a.download && currentDoc.dirty && !a.discardChanges) fail('The open document has unsaved changes: save it first, or pass discardChanges: true.');
      return simplifyFromArgs(a).then(r => {
        const data = simplifiedDocument(r), name = (a.name && a.name.trim() ? a.name.trim() : simplifiedName()).slice(0, 120);
        if(a.download) downloadDocument(JSON.stringify(data, null, 2), withDocExt(name));
        else openSimplifiedCopy(data, name);
        return Object.assign(simplifySummary(r), { name, opened: !a.download, downloaded: !!a.download });
      });
    } });

  defineAction({ name:'alwaysKeepWhenSimplifying', label:'Always Keep When Simplifying', category:'Canvas', icon:'⚓', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Marks a canvas (the current one if left out) to be always kept when the model is simplified — by Simplify for Inputs… and Make Showcase Viewer…\'s Simplify to the sliders — or, with on false, unmarks it. Kept in the document (workspace v16, simplifyAlwaysKeep), so it marks the document unsaved; not an undo step. Returns the names of the canvases marked.',
    params:[ P('canvas','canvas',{ optional:true }), P('on','bool',{ def:true }) ],
    run(a){
      if(inPractice()) fail('Not while practising a tutorial: the practice model isn\'t your document.');
      const c = a.canvas || activeCanvas();
      const had = docAlwaysKeep.includes(c.id);
      if(a.on && !had) docAlwaysKeep.push(c.id);
      else if(!a.on && had) docAlwaysKeep = docAlwaysKeep.filter(id => id !== c.id);
      if(had !== !!a.on){
        markDocDirty();
        renderCanvasTabs();
        toast(a.on ? 'Canvas ' + c.name + ' is always kept when simplifying.' : 'Canvas ' + c.name + ' is no longer always kept when simplifying.', 3500);
      }
      return canvases.filter(x => docAlwaysKeep.includes(x.id)).map(x => x.name);
    } });

  defineAction({ name:'simplified', label:'Simplified For', category:'File', icon:'✂', returns:'value', mutates:false, tx:false, record:false,
    desc:'What the open document was simplified from and for (workspace v16: from, made, inputs, kept, total, runs, fixed, removed), or null.',
    run(){ return docSimplified ? cloneData(docSimplified) : null; } });
