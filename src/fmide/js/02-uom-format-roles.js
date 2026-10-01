  // ---------- Unit of measure (UOM) ----------
  // Parsing and unit arithmetic are shared (src/shared/uom.js); a node's unit comes from the
  // IR (nodeUOM, in 06-align-marquee-computation.js).
  // build:include shared/uom.js

  // Pads/truncates a per-period explicit-value array to a target length, holding the
  // last known value flat when growing so extending the timeline never breaks a drawn curve.
  function padPeriodValuesArray(arr, len){
    arr = (arr || []).slice(0, len);
    while(arr.length < len) arr.push(arr.length ? arr[arr.length - 1] : 0);
    return arr;
  }

  // Re-pads every node's periodValues (across every canvas) to the current periods.length.
  function reconcilePeriodValuesInCanvasList(list){
    (list || []).forEach(c => {
      (c.nodes || []).forEach(n => {
        if(Array.isArray(n.periodValues)) n.periodValues = padPeriodValuesArray(n.periodValues, periods.length);
      });
    });
  }

  function reconcilePeriodValuesEverywhere(){
    syncActiveIntoRegistry();
    reconcilePeriodValuesInCanvasList(canvases);
    const active = canvases.find(c => c.id === activeCanvasId);
    if(active) loadCanvasState(active);
  }

  // build:include shared/format-roles.js
  function formatRoleOf(name){ return FORMAT_ROLES.find(r => r.name === name) || null; }
  function rolePresetStyle(name){
    const p = FORMAT_PRESETS.find(x => x.name === name);
    if(p) return p.style;
    const r = formatRoleOf(name);
    return r ? r.style : null;
  }

  // build:include shared/input-rule.js
  // The rule applied to the active canvas.
  function isInputRect(n){ return isInputRectangle({ nodes, edges }, n); }
  // The role a value rectangle takes on the canvas.
  function canvasRoleOf(n){
    if(!n || n.type !== 'value') return null;
    return isInputRect(n) ? 'Inputs' : 'Calculations';
  }

  // A rectangle's effective formatting on the canvas: an explicit per-node override
  // (node.style) always wins; otherwise its role's preset ("Inputs" / "Calculations") —
  // so editing that one preset re-styles every rectangle in that role at once.
  function resolveNodeStyle(n){
    if(n.style) return n.style;
    const role = canvasRoleOf(n);
    return role ? rolePresetStyle(role) : null;
  }

  // Seeds any missing role preset (by name), in role order, ahead of your own presets.
  function ensureDefaultFormatPresets(){
    const missing = FORMAT_ROLES.filter(r => !FORMAT_PRESETS.some(p => p.name === r.name))
      .map(r => ({ id: 'fmt-role-' + r.name.toLowerCase().replace(/\s+/g, '-'), name: r.name, style: cloneData(r.style) }));
    if(missing.length) FORMAT_PRESETS = missing.concat(FORMAT_PRESETS);
  }

  function formatNumForNode(v, n){
    if(v === null || v === undefined || !isFinite(v)) return '?';
    const rs = n && resolveNodeStyle(n);
    const fmt = rs && rs.numberFormat;
    if(!fmt || !fmt.kind || fmt.kind === 'general') return formatNum(v);
    const decimals = (typeof fmt.decimals === 'number') ? fmt.decimals : 2;
    if(fmt.kind === 'percent'){
      return (v * 100).toFixed(decimals) + '%';
    }
    if(fmt.kind === 'currency'){
      return (fmt.currencySymbol || '$') + v.toLocaleString(undefined, { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
    }
    if(fmt.kind === 'number'){
      return v.toLocaleString(undefined, { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
    }
    return formatNum(v);
  }

  function shiftLabel(offset){
    if(offset > 0) return 't+' + offset;
    if(offset < 0) return 't−' + Math.abs(offset);
    return 't';
  }

  function errorTitle(code){
    switch(code){
      case 'unset': return 'No number set, and nothing feeds into this rectangle.';
      case 'ambiguous': return 'Multiple rectangles point straight into this one — route them through an operator instead.';
      case 'missing-input': return "One of this operator's inputs could not be computed.";
      case 'no-input': return 'This operator has nothing connected to it.';
      case 'math-error': return 'Invalid result (e.g. divide by zero).';
      case 'unary-only': return 'This operator takes exactly one input.';
      case 'needs-two': return 'A comparison needs at least two inputs.';
      case 'alias-unset': return "This alias isn't linked to a rectangle yet — click its 🔗 icon to choose one.";
      case 'alias-missing-canvas': return 'The canvas this alias points to no longer exists.';
      case 'alias-missing-node': return 'The rectangle this alias points to no longer exists.';
      case 'block-missing-def': return 'The Block this instance uses no longer exists.';
      case 'block-missing-output': return 'This output no longer exists on the Block definition.';
      case 'block-cycle': return 'This Block contains an instance of itself, directly or indirectly.';
      case 'cycle': return 'This is part of a circular reference.';
      case 'period-out-of-range': return "There's no period that far back/forward for this shifter to read — it's fine at the timeline's edge.";
      case 'function-missing': return "This function's definition isn't in the model (or a function it calls is missing).";
      case 'function-unreadable': return "This function's formula can't be read.";
      case 'function-cycle': return 'This function calls itself through other functions, in a loop.';
      case 'function-too-deep': return 'This function calls other functions nested too deeply.';
      case 'function-arguments': return 'This function calls another function with the wrong number of inputs.';
      case 'function-input-unwired': return "One of this function's inputs isn't connected.";
      case 'operator-unknown': return "fmIDE doesn't know this operator (only a hand-edited file has one).";
      case 'operator-input-unwired': return "An input this operator reads isn't connected.";
      case 'choose-out-of-range': return 'The index picks no choice: it is below 1 or past the last choice.';
      default: return 'Could not compute.';
    }
  }

  function clearComputed(){ invalidateIR(); computedValues = {}; computeErrors = {}; portValues = {}; portErrors = {}; }

