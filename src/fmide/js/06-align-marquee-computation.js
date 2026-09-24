  // ---------- align / distribute ----------
  function selectedNodesList(){ return nodes.filter(n => selectedNodeIds.has(n.id)); }

  function boundingBoxOf(list){
    return {
      minX: Math.min(...list.map(n => n.x)),
      maxX: Math.max(...list.map(n => n.x + n.w)),
      minY: Math.min(...list.map(n => n.y)),
      maxY: Math.max(...list.map(n => n.y + n.h)),
    };
  }

  function alignSelected(mode, list){
    list = list || selectedNodesList();
    if(list.length < 2) return;
    pushHistory();
    const bbox = boundingBoxOf(list);
    list.forEach(n => {
      switch(mode){
        case 'left': n.x = bbox.minX; break;
        case 'right': n.x = bbox.maxX - n.w; break;
        case 'centerH': n.x = (bbox.minX + bbox.maxX)/2 - n.w/2; break;
        case 'top': n.y = bbox.minY; break;
        case 'bottom': n.y = bbox.maxY - n.h; break;
        case 'centerV': n.y = (bbox.minY + bbox.maxY)/2 - n.h/2; break;
      }
    });
    clearComputed();
    render();
  }

  function distributeSelected(axis, list){
    list = list || selectedNodesList();
    if(list.length < 3) return;
    pushHistory();
    if(axis === 'h'){
      const sorted = list.slice().sort((a,b) => a.x - b.x);
      const first = sorted[0], last = sorted[sorted.length-1];
      const span = (last.x + last.w) - first.x;
      const totalW = sorted.reduce((s,n) => s + n.w, 0);
      const gap = (span - totalW) / (sorted.length - 1);
      let cursor = first.x + first.w + gap;
      for(let i=1;i<sorted.length-1;i++){
        sorted[i].x = cursor;
        cursor = sorted[i].x + sorted[i].w + gap;
      }
    } else {
      const sorted = list.slice().sort((a,b) => a.y - b.y);
      const first = sorted[0], last = sorted[sorted.length-1];
      const span = (last.y + last.h) - first.y;
      const totalH = sorted.reduce((s,n) => s + n.h, 0);
      const gap = (span - totalH) / (sorted.length - 1);
      let cursor = first.y + first.h + gap;
      for(let i=1;i<sorted.length-1;i++){
        sorted[i].y = cursor;
        cursor = sorted[i].y + sorted[i].h + gap;
      }
    }
    clearComputed();
    render();
  }

  // ---------- marquee (range) selection ----------
  function rectsIntersect(a,b){ return !(b.x > a.x+a.w || b.x+b.w < a.x || b.y > a.y+a.h || b.y+b.h < a.y); }

  function startMarquee(downEvent){
    const additive = downEvent.shiftKey || downEvent.ctrlKey || downEvent.metaKey;
    if(!additive) clearSelection(); else render();
    const canvasRect = canvas.getBoundingClientRect();
    const startX = downEvent.clientX - canvasRect.left, startY = downEvent.clientY - canvasRect.top;
    const box = document.createElement('div');
    box.className = 'marquee';
    canvas.appendChild(box);
    document.body.classList.add('dragging');
    let last = {x:startX,y:startY,w:0,h:0};

    function onMove(ev){
      const curX = ev.clientX - canvasRect.left, curY = ev.clientY - canvasRect.top;
      const x = Math.min(startX,curX), y = Math.min(startY,curY);
      const w = Math.abs(curX-startX), h = Math.abs(curY-startY);
      last = {x,y,w,h};
      box.style.left = x+'px'; box.style.top = y+'px'; box.style.width = w+'px'; box.style.height = h+'px';
    }
    function onUp(){
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('dragging');
      box.remove();
      if(last.w > 3 || last.h > 3){
        nodes.filter(n => rectsIntersect(last, {x:n.x,y:n.y,w:n.w,h:n.h})).forEach(n => selectedNodeIds.add(n.id));
        render();
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  viewport.addEventListener('mousedown', (e) => {
    if(e.button === 2) return; // right button is reserved for arrow-drawing, started from a node
    if(e.target === viewport || e.target === canvas || e.target === svg){
      startMarquee(e);
    }
  });
  viewport.addEventListener('contextmenu', (e) => { e.preventDefault(); });

  // ---------- computation ----------
  function nodesOf(canvasId){ const c = canvases.find(c => c.id === canvasId); return c ? c.nodes : []; }
  function edgesOf(canvasId){ const c = canvases.find(c => c.id === canvasId); return c ? c.edges : []; }
  function nodeIn(canvasId, nodeId){ return nodesOf(canvasId).find(n => n.id === nodeId); }

  function sortedIncoming(nodeId){
    return edges.filter(e => e.to === nodeId).slice().sort((a,b) => {
      const na = getNode(a.from), nb = getNode(b.from);
      if(!na || !nb) return 0;
      return (na.x - nb.x) || (na.y - nb.y);
    });
  }

  function sortedIncomingIn(canvasId, nodeId){
    return edgesOf(canvasId).filter(e => e.to === nodeId).slice().sort((a,b) => {
      const na = nodeIn(canvasId, a.from), nb = nodeIn(canvasId, b.from);
      if(!na || !nb) return 0;
      return (na.x - nb.x) || (na.y - nb.y);
    });
  }

  function resolveEdgeValue(canvasId, edge, period, scope, visiting, memo, errors){
    const srcNode = nodeIn(canvasId, edge.from);
    if(!srcNode) return null;
    if(srcNode.type === 'blockInstance'){
      return computeBlockInstanceOutput(canvasId, srcNode, edge.fromPort || 0, period, scope, visiting, memo, errors);
    }
    return computeValue(canvasId, edge.from, period, scope, visiting, memo, errors);
  }

  function computeValue(canvasId, nodeId, period, scope, visiting, memo, errors){
    const key = period + '|' + scope.prefix + nodeId;
    if(memo.hasOwnProperty(key)) return memo[key];
    if(visiting.has(key)){ errors[key] = 'cycle'; memo[key] = null; return null; }
    const n = nodeIn(canvasId, nodeId);
    if(!n) return null;
    visiting.add(key);
    let result = null;

    if(n.type === 'alias'){
      if(!n.sourceCanvasId || !n.sourceNodeId){
        errors[key] = 'alias-unset';
      } else {
        const srcCanvasExists = canvases.some(c => c.id === n.sourceCanvasId);
        if(!srcCanvasExists){
          errors[key] = 'alias-missing-canvas';
        } else {
          const srcNode = nodeIn(n.sourceCanvasId, n.sourceNodeId);
          if(!srcNode){
            errors[key] = 'alias-missing-node';
          } else {
            // An alias that points back into the SAME canvas it lives in is just a local
            // routing jump (e.g. re-exposing an internal subtotal as a block output) — it
            // must stay inside the current evaluation scope so it still sees the current
            // block instance's bound inputs. An alias into a genuinely different canvas
            // has no such scope to inherit, so it evaluates that canvas fresh, as top-level.
            const aliasScope = (n.sourceCanvasId === canvasId) ? scope : { prefix:'', bindings:{} };
            result = computeValue(n.sourceCanvasId, srcNode.id, period, aliasScope, visiting, memo, errors);
            if(result === null && !errors[key]) errors[key] = 'missing-input';
          }
        }
      }
    } else if(n.type === 'blockInstance'){
      // has no single scalar value; callers should resolve a specific output via resolveEdgeValue instead
      errors[key] = 'no-input';
    } else if(n.type === 'value'){
      if(scope.bindings.hasOwnProperty(nodeId)){
        // A block input port's binding is the OUTER edge feeding it, resolved fresh at
        // whatever period is actually being asked for here — not the value at the period
        // the block instance's output was originally requested at. This matters whenever
        // the block definition looks at another period internally (a corkscrew reaching
        // back via a period-shift node): each historical period along that chain must see
        // its own period's input values, not the value frozen from the outermost call.
        //
        // A binding is {edge, fixedPeriod, literal}: normally fixedPeriod is null and the
        // edge resolves at the current `period` (broadcast — today's only behavior, still
        // the default). A Vertical Block instance (see computeVerticalBlockInstanceOutput)
        // can instead pin an "indexed" input's edge to a fixed period (that instance's own
        // vertical index) regardless of which period is being asked for, or, for the
        // block's Vertical Index rectangle, skip the edge entirely and hand back a literal.
        const binding = scope.bindings[nodeId];
        if(binding && typeof binding.literal === 'number'){
          result = binding.literal;
        } else {
          const inEdge = binding ? binding.edge : null;
          const bindPeriod = (binding && typeof binding.fixedPeriod === 'number') ? binding.fixedPeriod : period;
          const bound = inEdge ? resolveEdgeValue(scope.outerCanvasId, inEdge, bindPeriod, scope.outerScope, visiting, memo, errors) : null;
          if(bound === null || bound === undefined || (typeof bound === 'number' && Number.isNaN(bound))){
            const literal = effectiveLiteral(n, period);
            result = (literal !== null) ? literal : 0;
          } else result = bound;
        }
      } else {
        const incoming = edgesOf(canvasId).filter(e => e.to === nodeId);
        if(incoming.length === 0){
          // True input (nothing wired in): driven purely by its own number, defaulting to zero.
          const literal = effectiveLiteral(n, period);
          result = (literal !== null) ? literal : 0;
        } else if(incoming.length === 1){
          // Not an input — always follow the wired source when it can produce a value.
          // Its own typed number, if any, is only a fallback for periods the source can't
          // reach (e.g. a corkscrew's first period, before a period-shift has anything to read).
          const edgeVal = resolveEdgeValue(canvasId, incoming[0], period, scope, visiting, memo, errors);
          if(edgeVal !== null && edgeVal !== undefined && !Number.isNaN(edgeVal)){
            result = edgeVal;
          } else {
            const literal = effectiveLiteral(n, period);
            if(literal !== null){
              result = literal;
            } else {
              // A period-shift wired straight into this rectangle couldn't reach a prior
              // period (e.g. a corkscrew's period-0 opening balance) and the rectangle has
              // no typed number/curve of its own — default to zero instead of erroring,
              // the same "default to zero" rule true-input rectangles already get. Other
              // failure reasons (broken links, cycles, math errors) still surface as "?".
              const srcNode = nodeIn(canvasId, incoming[0].from);
              const srcKey = period + '|' + scope.prefix + incoming[0].from;
              if(srcNode && srcNode.type === 'periodShift' && errors[srcKey] === 'period-out-of-range'){
                result = 0;
              } else if(!errors[key]){
                errors[key] = 'missing-input';
              }
            }
          }
        } else {
          errors[key] = 'ambiguous';
        }
      }
    } else if(n.type === 'periodShift'){
      const incoming = edgesOf(canvasId).filter(e => e.to === nodeId);
      if(incoming.length === 0){
        errors[key] = 'no-input';
      } else if(incoming.length > 1){
        errors[key] = 'ambiguous';
      } else {
        const offset = (typeof n.shift === 'number') ? n.shift : -1;
        const targetPeriod = period + offset;
        if(targetPeriod < 0 || targetPeriod >= periods.length){
          errors[key] = 'period-out-of-range';
        } else {
          result = resolveEdgeValue(canvasId, incoming[0], targetPeriod, scope, visiting, memo, errors);
          if(result === null && !errors[key]) errors[key] = 'missing-input';
        }
      }
    } else {
      const incomingEdges = sortedIncomingIn(canvasId, nodeId).filter(e => nodeIn(canvasId, e.from));

      if(n.text === 'iferror'){
        if(incomingEdges.length === 0){
          errors[key] = 'no-input';
        } else {
          const primary = resolveEdgeValue(canvasId, incomingEdges[0], period, scope, visiting, memo, errors);
          const primaryBad = (primary === null || primary === undefined || Number.isNaN(primary));
          if(!primaryBad){
            result = primary;
          } else if(incomingEdges.length >= 2){
            const fallback = resolveEdgeValue(canvasId, incomingEdges[1], period, scope, visiting, memo, errors);
            if(fallback === null || fallback === undefined || Number.isNaN(fallback)){
              errors[key] = 'missing-input';
            } else {
              result = fallback;
            }
          } else {
            errors[key] = 'missing-input';
          }
        }
      } else if(incomingEdges.length === 0){
        errors[key] = 'no-input';
      } else {
        const values = incomingEdges.map(e => resolveEdgeValue(canvasId, e, period, scope, visiting, memo, errors));
        if(values.some(v => v === null || v === undefined || Number.isNaN(v))){
          errors[key] = 'missing-input';
        } else if(n.text === 'abs'){
          if(values.length !== 1){ errors[key] = 'unary-only'; }
          else result = Math.abs(values[0]);
        } else if(n.text === 'min'){
          result = Math.min(...values);
        } else if(n.text === 'max'){
          result = Math.max(...values);
        } else if(n.text === 'ave'){
          result = values.reduce((a,b) => a+b, 0) / values.length;
        } else {
          result = values.reduce((acc, v, idx) => {
            if(idx === 0) return v;
            switch(n.text){
              case '+': return acc + v;
              case '−': return acc - v;
              case '×': return acc * v;
              case '÷': return v === 0 ? NaN : acc / v;
              case '^': return Math.pow(acc, v);
              case '%': return v === 0 ? NaN : acc % v;
              case '≤': return (acc <= v) ? 1 : 0;
              case '≥': return (acc >= v) ? 1 : 0;
              case '<': return (acc < v) ? 1 : 0;
              case '>': return (acc > v) ? 1 : 0;
              default: return acc;
            }
          });
          if(Number.isNaN(result)){ errors[key] = 'math-error'; result = null; }
        }
      }
    }

    visiting.delete(key);
    memo[key] = result;
    return result;
  }

  function computeBlockInstanceOutput(outerCanvasId, instanceNode, outputIndex, period, outerScope, visiting, memo, errors){
    const key = period + '|' + outerScope.prefix + instanceNode.id + '::out' + outputIndex;
    if(memo.hasOwnProperty(key)) return memo[key];

    const def = canvases.find(c => c.id === instanceNode.blockDefCanvasId);
    if(!def){ errors[key] = 'block-missing-def'; memo[key] = null; return null; }

    if(instanceNode.vertical){
      return computeVerticalBlockInstanceOutput(outerCanvasId, instanceNode, outputIndex, period, outerScope, visiting, memo, errors, def, key);
    }

    const blockCycleKey = period + '|#block#' + def.id;
    if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; memo[key] = null; return null; }

    const { outputs } = blockPortsOf(def);
    const outNode = outputs[outputIndex];
    if(!outNode){ errors[key] = 'block-missing-output'; memo[key] = null; return null; }

    const bindings = singleInstanceBindings(def, outerCanvasId, instanceNode);

    const innerScope = { prefix: outerScope.prefix + instanceNode.id + '::', bindings, outerCanvasId, outerScope };
    visiting.add(blockCycleKey);
    const result = computeValue(def.id, outNode.id, period, innerScope, visiting, memo, errors);
    visiting.delete(blockCycleKey);

    memo[key] = result;
    if(result === null && !errors[key]){
      errors[key] = errors[period + '|' + innerScope.prefix + outNode.id] || 'missing-input';
    }
    return result;
  }

  // Bind each declared Input port to the outer EDGE feeding it (not a precomputed value at
  // this call's period) — see the matching comment in computeValue's 'value' branch for why:
  // the block definition may need each bound input re-evaluated at other periods too. This is
  // the ordinary "broadcast" binding shared by a ordinary (non-vertical) instance and by every
  // vertical instance's non-indexed inputs.
  function singleInstanceBindings(def, outerCanvasId, instanceNode){
    const { inputs } = blockPortsOf(def);
    const bindings = {};
    inputs.forEach((inp, i) => {
      const inEdge = edgesOf(outerCanvasId).find(e => e.to === instanceNode.id && e.toPort === i);
      bindings[inp.id] = { edge: inEdge || null, fixedPeriod: null };
    });
    return bindings;
  }

  // A Vertical Block instance runs the SAME block definition once per period (the vertical
  // "instance index" i = 0..periods.length-1, exposed 1-based inside the definition via its
  // Vertical Index rectangle, if any), then folds the N independent results together with the
  // output rectangle's chosen reducer. An input port's edge is "indexed" (edge.verticalIndexed)
  // when it should read its outer source at that FIXED instance period i — e.g. a per-period
  // Capex row becoming "this vintage's own capex" — instead of the period actually being asked
  // for; every other input keeps today's broadcast behavior (same value resolved fresh at
  // whichever period the definition's internal formulas are looking at).
  function computeVerticalBlockInstanceOutput(outerCanvasId, instanceNode, outputIndex, period, outerScope, visiting, memo, errors, def, key){
    const { inputs, outputs, indexNode } = blockPortsOf(def);
    const outNode = outputs[outputIndex];
    if(!outNode){ errors[key] = 'block-missing-output'; memo[key] = null; return null; }

    const N = periods.length;
    const results = [];
    for(let i = 0; i < N; i++){
      const blockCycleKey = period + '|#block#' + def.id + '#v' + instanceNode.id + '#' + i;
      if(visiting.has(blockCycleKey)){ errors[key] = 'block-cycle'; results.push(null); continue; }

      const bindings = {};
      inputs.forEach((inp, portIdx) => {
        const inEdge = edgesOf(outerCanvasId).find(e => e.to === instanceNode.id && e.toPort === portIdx);
        const indexed = !!(inEdge && inEdge.verticalIndexed);
        bindings[inp.id] = { edge: inEdge || null, fixedPeriod: indexed ? i : null };
      });
      if(indexNode) bindings[indexNode.id] = { edge: null, fixedPeriod: null, literal: i + 1 };

      const innerScope = { prefix: outerScope.prefix + instanceNode.id + '::v' + i + '::', bindings, outerCanvasId, outerScope };
      visiting.add(blockCycleKey);
      const r = computeValue(def.id, outNode.id, period, innerScope, visiting, memo, errors);
      visiting.delete(blockCycleKey);
      results.push(r);
    }

    let result = null;
    if(results.length === 0){
      errors[key] = 'no-input';
    } else if(results.some(v => v === null || v === undefined || Number.isNaN(v))){
      errors[key] = 'missing-input';
    } else {
      const mode = outNode.verticalReducer || 'sum';
      if(mode === 'max') result = Math.max(...results);
      else if(mode === 'min') result = Math.min(...results);
      else if(mode === 'ave') result = results.reduce((a,b) => a+b, 0) / results.length;
      else if(mode === 'product') result = results.reduce((a,b) => a*b, 1);
      else result = results.reduce((a,b) => a+b, 0); // 'sum' (default)
    }

    memo[key] = result;
    // Stashed alongside the reduced result so evaluateAll can surface the per-instance
    // breakdown (see c.periodPortInstances) without recomputing it — used only by the
    // "view instances" table on a vertical block instance, never by the graph itself.
    memo[key + '::instances'] = results.slice();
    return result;
  }

  // Evaluates every period, for every canvas, and keeps a full per-period
  // snapshot on each canvas (c.periodComputedValues[p], etc.) so switching the
  // viewed period is just a re-slice, not a recompute.
  // Inside a transaction (a macro run, or one API action) evaluation is deferred and done
  // once when the transaction finishes; evaluateAllNow() forces it immediately.
  function evaluateAll(){
    if(tx.depth > 0){ tx.needEval = true; return; }
    evaluateAllNow();
  }

  function evaluateAllNow(){
    syncActiveIntoRegistry();
    const TOP = () => ({ prefix:'', bindings:{} });

    canvases.forEach(c => {
      c.periodComputedValues = [];
      c.periodComputeErrors = [];
      c.periodPortValues = [];
      c.periodPortErrors = [];
      c.periodPortInstances = [];
    });

    for(let p = 0; p < periods.length; p++){
      const memo = {}, errors = {};

      canvases.forEach(c => {
        c.nodes.forEach(n => {
          if(n.type === 'blockInstance'){
            const def = canvases.find(cc => cc.id === n.blockDefCanvasId);
            const { outputs } = blockPortsOf(def);
            outputs.forEach((_, i) => computeBlockInstanceOutput(c.id, n, i, p, TOP(), new Set(), memo, errors));
          } else {
            computeValue(c.id, n.id, p, TOP(), new Set(), memo, errors);
          }
        });
      });

      canvases.forEach(c => {
        const cv = {}, ce = {}, pv = {}, pe = {}, pin = {};
        c.nodes.forEach(n => {
          if(n.type === 'blockInstance'){
            const def = canvases.find(cc => cc.id === n.blockDefCanvasId);
            const { outputs } = blockPortsOf(def);
            const vals = [], errs = [];
            let insts = null;
            outputs.forEach((_, i) => {
              const k = p + '|' + n.id + '::out' + i;
              vals.push(memo.hasOwnProperty(k) ? memo[k] : null);
              errs.push(errors[k] || null);
              if(n.vertical){
                if(!insts) insts = [];
                insts.push(memo.hasOwnProperty(k + '::instances') ? memo[k + '::instances'] : []);
              }
            });
            pv[n.id] = vals; pe[n.id] = errs;
            if(insts) pin[n.id] = insts;
          } else {
            const k = p + '|' + n.id;
            if(memo.hasOwnProperty(k) && memo[k] !== null) cv[n.id] = memo[k];
            if(errors[k]) ce[n.id] = errors[k];
          }
        });
        c.periodComputedValues[p] = cv; c.periodComputeErrors[p] = ce;
        c.periodPortValues[p] = pv; c.periodPortErrors[p] = pe;
        c.periodPortInstances[p] = pin;
      });
    }

    canvases.forEach(c => {
      c.computedValues = c.periodComputedValues[currentPeriod] || {};
      c.computeErrors = c.periodComputeErrors[currentPeriod] || {};
      c.portValues = c.periodPortValues[currentPeriod] || {};
      c.portErrors = c.periodPortErrors[currentPeriod] || {};
    });
    loadCanvasState(canvases.find(c => c.id === activeCanvasId));
    renderPeriodControls();
    render();
  }

  // Changes which period's already-computed values are shown, without recomputing.
  function setCurrentPeriod(idx){
    currentPeriod = Math.max(0, Math.min(periods.length - 1, idx));
    canvases.forEach(c => {
      c.computedValues = (c.periodComputedValues && c.periodComputedValues[currentPeriod]) || {};
      c.computeErrors = (c.periodComputeErrors && c.periodComputeErrors[currentPeriod]) || {};
      c.portValues = (c.periodPortValues && c.periodPortValues[currentPeriod]) || {};
      c.portErrors = (c.periodPortErrors && c.periodPortErrors[currentPeriod]) || {};
    });
    loadCanvasState(canvases.find(c => c.id === activeCanvasId));
    renderPeriodControls();
    render();
  }

