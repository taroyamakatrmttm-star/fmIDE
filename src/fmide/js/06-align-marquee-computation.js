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
  // The calculation runs on the shared IR (src/shared/ir.js): compileModel reads the model,
  // evaluateModel calculates it, with the operators of src/shared/operators.js (included in
  // 01-setup-commands-keys.js, where the palette is built from it).
  // build:include shared/ir.js

  // The active canvas's incoming arrows of a node, its sources left to right (used to draw them).
  function sortedIncoming(nodeId){
    return edges.filter(e => e.to === nodeId).slice().sort((a,b) => {
      const na = getNode(a.from), nb = getNode(b.from);
      if(!na || !nb) return 0;
      return (na.x - nb.x) || (na.y - nb.y);
    });
  }

  // The IR of the model as it is now, compiled when first needed after a change (units on
  // the canvas read it); invalidateIR() is called wherever the model may change.
  let modelIR = null;
  function invalidateIR(){ modelIR = null; }
  function currentIR(){
    if(!modelIR){
      syncActiveIntoRegistry();
      modelIR = compileModel({ periods, canvases });
    }
    return modelIR;
  }
  // A node's unit of measure ({scale, dims}) from the IR, or null.
  function nodeUOM(canvasId, nodeId){ return unitOf(currentIR(), canvasId, nodeId); }

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
    const ir = compileModel({ periods, canvases });
    const results = evaluateModel(ir);
    canvases.forEach((c, i) => {
      const r = results[i];
      c.periodComputedValues = r.values;
      c.periodComputeErrors = r.errors;
      c.periodPortValues = r.portValues;
      c.periodPortErrors = r.portErrors;
      c.periodPortInstances = r.portInstances;
    });

    canvases.forEach(c => {
      c.computedValues = c.periodComputedValues[currentPeriod] || {};
      c.computeErrors = c.periodComputeErrors[currentPeriod] || {};
      c.portValues = c.periodPortValues[currentPeriod] || {};
      c.portErrors = c.periodPortErrors[currentPeriod] || {};
    });
    loadCanvasState(canvases.find(c => c.id === activeCanvasId));
    modelIR = ir;
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

