  // ---------- Unit of measure (UOM) ----------
  // A rectangle's optional 3rd text line ("Name\nValue\nUOM") is a manual unit label,
  // e.g. "kt", "$/t". For rectangles with no manual UOM, the UOM of a formula-driven
  // rectangle is derived automatically from its inputs' UOMs through the same × ÷ + −
  // (and abs/min/max/ave/iferror) logic used to compute its value — so "Unit Price ($/t)
  // × Volume (kt)" resolves to "$k" automatically. A UOM is represented internally as
  // {scale, dims}: dims maps a base symbol (e.g. '$', 't') to its exponent (denominator
  // atoms are negative), and scale is the numeric multiplier from a recognized prefix
  // (k=1e3, m/mm=1e6, bn=1e9) that may be attached to either end of an atom's token.
  const UOM_PREFIXES = [['bn', 1e9], ['mm', 1e6], ['k', 1e3], ['m', 1e6]]; // checked longest-first
  const UOM_CURRENCY_SYMBOLS = new Set(['$', '€', '£', '¥']);
  const UOM_SCALE_TO_PREFIX = { 1: '', 1000: 'k', 1000000: 'm', 1000000000: 'bn' };

  function parseUOMAtom(tok){
    tok = tok.trim();
    if(!tok) return null;
    if(tok === '%') return { scale: 0.01, symbol: '' };
    for(const [pfx, mult] of UOM_PREFIXES){
      if(tok.length > pfx.length){
        if(tok.slice(0, pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(pfx.length).trim() };
        if(tok.slice(-pfx.length).toLowerCase() === pfx) return { scale: mult, symbol: tok.slice(0, -pfx.length).trim() };
      }
    }
    return { scale: 1, symbol: tok };
  }

  function parseUOMSegment(seg){
    return seg.split(/[*·]/).map(parseUOMAtom).filter(Boolean);
  }

  // Parses a manually-typed UOM string (e.g. "$/t", "kt", "$k") into {scale, dims}, or
  // null if blank/unparseable.
  function parseUOM(str){
    if(!str) return null;
    const s = str.trim();
    if(!s) return null;
    const slashIdx = s.indexOf('/');
    const numAtoms = parseUOMSegment(slashIdx === -1 ? s : s.slice(0, slashIdx));
    const denAtoms = slashIdx === -1 ? [] : parseUOMSegment(s.slice(slashIdx + 1));
    if(numAtoms.length === 0 && denAtoms.length === 0) return null;
    let scale = 1;
    const dims = {};
    numAtoms.forEach(a => { scale *= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) + 1; });
    denAtoms.forEach(a => { scale /= a.scale; if(a.symbol) dims[a.symbol] = (dims[a.symbol] || 0) - 1; });
    Object.keys(dims).forEach(k => { if(dims[k] === 0) delete dims[k]; });
    return { scale, dims };
  }

  // Renders {scale, dims} back to a display string, e.g. {scale:1000, dims:{$:1}} -> "$k".
  function formatUOM(u){
    if(!u) return '';
    const numSyms = Object.keys(u.dims).filter(k => u.dims[k] > 0).sort();
    const denSyms = Object.keys(u.dims).filter(k => u.dims[k] < 0).sort();
    const prefix = UOM_SCALE_TO_PREFIX.hasOwnProperty(u.scale) ? UOM_SCALE_TO_PREFIX[u.scale] : '';
    const atomStr = (sym, exp) => (exp > 1 ? sym + '^' + exp : sym);
    let numPart;
    if(numSyms.length === 0){
      numPart = prefix;
    } else if(numSyms.length === 1 && prefix){
      const sym = numSyms[0];
      numPart = UOM_CURRENCY_SYMBOLS.has(sym) ? (atomStr(sym, u.dims[sym]) + prefix) : (prefix + atomStr(sym, u.dims[sym]));
    } else {
      numPart = (prefix ? prefix + '·' : '') + numSyms.map(s => atomStr(s, u.dims[s])).join('·');
    }
    const denPart = denSyms.map(s => atomStr(s, -u.dims[s])).join('·');
    return denPart ? (numPart || '1') + '/' + denPart : numPart;
  }

  function uomCombineDims(a, b, sign){
    const dims = Object.assign({}, a.dims);
    Object.keys(b.dims).forEach(k => {
      dims[k] = (dims[k] || 0) + sign * b.dims[k];
      if(dims[k] === 0) delete dims[k];
    });
    return dims;
  }
  function uomMultiply(a, b){ return (a && b) ? { scale: a.scale * b.scale, dims: uomCombineDims(a, b, 1) } : null; }
  function uomDivide(a, b){ return (a && b) ? { scale: a.scale / b.scale, dims: uomCombineDims(a, b, -1) } : null; }
  function uomDimsEqual(a, b){
    const ak = Object.keys(a.dims), bk = Object.keys(b.dims);
    return ak.length === bk.length && ak.every(k => a.dims[k] === b.dims[k]);
  }

  // Active-canvas-aware node/edge lookup for UOM propagation: mirrors how the alias
  // render branch already special-cases the active canvas (its `canvases[i].nodes` entry
  // is stale until synced, so the live `nodes`/`edges` globals must be used instead).
  function uomNodesOf(canvasId){ return canvasId === activeCanvasId ? nodes : nodesOf(canvasId); }
  function uomEdgesOf(canvasId){ return canvasId === activeCanvasId ? edges : edgesOf(canvasId); }
  function uomNodeIn(canvasId, nodeId){ return uomNodesOf(canvasId).find(x => x.id === nodeId); }

  // Recursively derives a node's effective UOM: its own manual 3rd-line label if set,
  // else propagated from its input(s) through × ÷ + − abs/min/max/ave/iferror (aliases
  // and period-shifts pass their source's UOM straight through). Returns null when
  // there's no manual label and no derivable UOM (e.g. block-instance outputs, ^, %,
  // comparisons, or mismatched +/− operand units — out of scope for this feature).
  function computeNodeUOM(canvasId, nodeId, visiting, memo){
    const key = canvasId + '|' + nodeId;
    if(memo.hasOwnProperty(key)) return memo[key];
    if(visiting.has(key)) return null;
    const n = uomNodeIn(canvasId, nodeId);
    if(!n){ memo[key] = null; return null; }
    visiting.add(key);
    let result = null;

    if(n.type === 'value'){
      const manual = parseNode(n).uom;
      if(manual){
        result = parseUOM(manual);
      } else {
        const incoming = uomEdgesOf(canvasId).filter(e => e.to === nodeId);
        if(incoming.length === 1) result = resolveEdgeUOM(canvasId, incoming[0], visiting, memo);
      }
    } else if(n.type === 'alias'){
      if(n.sourceCanvasId && n.sourceNodeId) result = computeNodeUOM(n.sourceCanvasId, n.sourceNodeId, visiting, memo);
    } else if(n.type === 'periodShift'){
      const incoming = uomEdgesOf(canvasId).filter(e => e.to === nodeId);
      if(incoming.length === 1) result = resolveEdgeUOM(canvasId, incoming[0], visiting, memo);
    } else if(n.type === 'operator'){
      const incomingEdges = uomEdgesOf(canvasId).filter(e => e.to === nodeId && uomNodeIn(canvasId, e.from));
      incomingEdges.sort((a, b) => {
        const na = uomNodeIn(canvasId, a.from), nb = uomNodeIn(canvasId, b.from);
        return (na.x - nb.x) || (na.y - nb.y);
      });
      const uoms = incomingEdges.map(e => resolveEdgeUOM(canvasId, e, visiting, memo));
      if(uoms.length > 0 && !uoms.some(u => u === null)){
        if(n.text === '×') result = uoms.reduce((acc, u, i) => i === 0 ? u : uomMultiply(acc, u));
        else if(n.text === '÷') result = uoms.reduce((acc, u, i) => i === 0 ? u : uomDivide(acc, u));
        else if(['+', '−', 'abs', 'min', 'max', 'ave', 'iferror'].includes(n.text)){
          result = uoms.every(u => uomDimsEqual(u, uoms[0])) ? uoms[0] : null;
        }
        // ^, %, and comparisons (≤ ≥ < >) don't map to simple unit algebra — left null
      }
    }
    // blockInstance outputs: out of scope — left null

    visiting.delete(key);
    memo[key] = result;
    return result;
  }

  function resolveEdgeUOM(canvasId, edge, visiting, memo){
    const srcNode = uomNodeIn(canvasId, edge.from);
    if(!srcNode || srcNode.type === 'blockInstance') return null;
    return computeNodeUOM(canvasId, edge.from, visiting, memo);
  }

  // A value rectangle's own typed number applies to every period by default.
  // node.literalPeriods, when present, is the sparse list of period indices where
  // the rectangle's own number is used; other periods fall through to an incoming
  // edge instead (e.g. a period-shift connector carrying a prior period forward).
  function effectiveLiteral(n, period){
    if(Array.isArray(n.periodValues) && typeof n.periodValues[period] === 'number' && isFinite(n.periodValues[period])){
      return n.periodValues[period];
    }
    const {literal} = parseNode(n);
    if(literal === null) return null;
    if(Array.isArray(n.literalPeriods) && !n.literalPeriods.includes(period)) return null;
    return literal;
  }

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

  // ---------- format roles ----------
  // One place defines how every kind of cell looks — on the canvas AND in the Excel file
  // ExcelExporter writes. Each role is an ordinary format preset with a reserved name
  // (edit it in the Formats manager); ExcelExporter reads these presets from the saved
  // workspace/system JSON. "Inputs" and "Calculations" also style canvas rectangles; the
  // rest only exist in the spreadsheet. A rectangle's own 🎨 format sets how it looks
  // (number format, weight, size, border); the ROLE owns the colours (fill, font colour)
  // (and border) in Excel unless the rectangle's format has "Use this fill, font colour &
  // border in Excel too" ticked. Border sides and "Use Excel's default font size" are
  // Excel-only settings of a style.
  const FORMAT_ROLES = [
    { name: 'Inputs', where: 'Canvas + Excel',
      desc: 'Hard-coded numbers: input rectangles, scenario values, and the cells you type on the Scenarios tab.',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#eff6ff',
               border: { color: '#93c5fd', width: 1.5, style: 'solid' }, font: { family: '', size: 14, weight: 'normal', color: '#1e3a8a' } } },
    { name: 'Calculations', where: 'Canvas + Excel',
      desc: 'Formulas: rectangles fed by an arrow, and every calculated cell in Excel. Blank by default (the normal rectangle look).',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: null } } },
    { name: 'Links', where: 'Excel',
      desc: 'Formulas that only pull a value from another sheet (e.g. a row linked to the Inputs tab).',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: '#008000' } } },
    { name: 'Headers', where: 'Excel',
      desc: 'Each sheet\'s title and column-header row.',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#f1f5f9', border: null, font: { family: '', size: null, weight: '700', color: null } } },
    { name: 'Section Headers', where: 'Excel',
      desc: 'The INPUTS / CALCULATIONS / OUTPUTS bands.',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#f8fafc', border: null, font: { family: '', size: null, weight: '700', color: '#475569' } } },
    { name: 'Labels', where: 'Excel',
      desc: 'Custom / label rows and group headers (unless the row has its own format in ExcelExporter).',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: '700', color: '#475569' } } },
    { name: 'Notes', where: 'Excel',
      desc: 'Notes, the Period # counter, scenario numbering and other helper text.',
      style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: 9, weight: 'normal', color: '#94a3b8' } } }
  ];
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
      case 'alias-unset': return "This alias isn't linked to a rectangle yet — click its 🔗 icon to choose one.";
      case 'alias-missing-canvas': return 'The canvas this alias points to no longer exists.';
      case 'alias-missing-node': return 'The rectangle this alias points to no longer exists.';
      case 'block-missing-def': return 'The Block this instance uses no longer exists.';
      case 'block-missing-output': return 'This output no longer exists on the Block definition.';
      case 'block-cycle': return 'This Block contains an instance of itself, directly or indirectly.';
      case 'cycle': return 'This is part of a circular reference.';
      case 'period-out-of-range': return "There's no period that far back/forward for this shifter to read — it's fine at the timeline's edge.";
      default: return 'Could not compute.';
    }
  }

  function clearComputed(){ computedValues = {}; computeErrors = {}; portValues = {}; portErrors = {}; }

