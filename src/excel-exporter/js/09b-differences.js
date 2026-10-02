// ============================================================
// Before download: where the workbook will differ from fmIDE (step 7, decision 6)
//
// Excel keeps writing 0, or leaving a cell blank, where fmIDE shows "?" because something is
// broken: an alias that points nowhere, two arrows into one rectangle, a period shift with
// no input, a missing block or block output, a block inside itself, a loop. The panel next
// to Generate lists the rows where that happens, with the periods and where it starts —
// worked out with fmIDE's own calculation (the shared IR). It also lists a row left out of
// the layout that other rows read (fmIDE shows a number, the formula reads 0).
// Function calls (step 7 phase D3): a call fmIDE can't calculate is #N/A in Excel, and a
// formula a call makes too long or too deeply nested for Excel is written as #N/A; both are
// listed too. It never stops the download.
// ============================================================

// Where a "?" starts (the IR's error codes) that Excel writes as 0 or a blank cell. The
// others — a divide by zero, abs of several inputs, a comparison of one, a period shift
// outside the timeline inside an iferror — are errors in Excel too.
const SILENT_IN_EXCEL = {
  'cycle': 'it is part of a loop',
  'alias-unset': 'an alias there points to nothing',
  'alias-missing-canvas': 'an alias there points to a canvas that no longer exists',
  'alias-missing-node': 'an alias there points to a rectangle that no longer exists',
  'no-input': 'nothing is wired into it',
  'ambiguous': 'more than one arrow goes into it',
  'missing-source': 'an arrow there comes from something that no longer exists',
  'block-missing-def': 'its block’s definition canvas no longer exists',
  'block-missing-output': 'it reads a block output that no longer exists',
  'block-cycle': 'a block there contains itself',
};

// Where a "?" starts in a function call (the IR's error codes); Excel shows #N/A there.
const NA_IN_EXCEL = {
  'function-missing': 'its function’s definition, or one it calls, isn’t in the file (or is another version)',
  'function-unreadable': 'its function’s definition can’t be read',
  'function-cycle': 'its function calls itself through other functions',
  'function-too-deep': 'its function’s calls are nested more than 16 deep',
  'function-arguments': 'its function calls another with the wrong number of inputs',
  'function-input-unwired': 'an input its function reads has no arrow',
  // Phase E1.
  'operator-unknown': 'an operator there isn’t one fmIDE knows',
  'operator-input-unwired': 'an input its operator reads has no arrow',
};

// Quick look at the IR for anything that can make fmIDE show "?" where Excel writes 0 or a
// blank. Only when there is something does the check run fmIDE's calculation (a healthy
// model costs nothing extra).
function mayDifferFromFmide(ir){
  let found = false;
  ir.order.forEach(c => c.list.forEach(n => {
    if(found) return;
    if(n.incoming.some(e => !c.byId.has(e.from))) found = true;
    else if(n.type === 'alias') found = !n.sourceCanvasId || !n.sourceNodeId || !irNodeIn(ir, n.sourceCanvasId, n.sourceNodeId);
    else if(n.type === 'value') found = n.incoming.length > 1 && !n.isInput;
    else if(n.type === 'periodShift') found = n.incoming.length !== 1;
    else if(n.type === 'blockInstance'){
      const def = ir.canvases.get(n.blockDefCanvasId);
      found = !def || n.outgoing.some(e => !def.ports.outputs[e.fromPort || 0]) || blockContainsItself(ir, def.id, new Set());
    } else if(n.type === 'operator'){
      found = !n.op
        || (n.op.ports ? n.portInputs.some(e => !e) : (n.inputs.length === 0 && !n.op.fallback && !n.op.period));
    }
    else if(n.type === 'function') found = !n.call || !!n.call.status || n.call.params.some((p, i) => !irPortEdge(ir, c.id, n.id, i));
  }));
  return found || hasLoop(ir);
}

function blockContainsItself(ir, defId, visiting){
  if(visiting.has(defId)) return true;
  const def = ir.canvases.get(defId);
  if(!def) return false;
  visiting.add(defId);
  const inside = def.list.some(n => n.type === 'blockInstance' && blockContainsItself(ir, n.blockDefCanvasId, visiting));
  visiting.delete(defId);
  return inside;
}

// True if some value depends on itself in the same period: through arrows, aliases and
// block ports, but not through a period shift that moves to another period (a corkscrew).
// A block's Input port is taken to depend on whatever feeds it in any instance, so this may
// find a loop that isn't one; the calculation then decides.
function hasLoop(ir){
  const portFeeds = new Map(); // "defCanvasId|portNodeId" -> [{ canvasId, edge }]
  ir.order.forEach(c => c.list.forEach(n => {
    if(n.type !== 'blockInstance') return;
    const def = ir.canvases.get(n.blockDefCanvasId);
    if(!def) return;
    def.ports.inputs.forEach((port, i) => {
      const edge = irPortEdge(ir, c.id, n.id, i);
      if(!edge) return;
      const k = def.id + '|' + port.id;
      if(!portFeeds.has(k)) portFeeds.set(k, []);
      portFeeds.get(k).push({ canvasId: c.id, edge });
    });
  }));
  const edgeTarget = (canvasId, edge) => {
    const src = irNodeIn(ir, canvasId, edge.from);
    if(!src) return null;
    if(src.type !== 'blockInstance') return canvasId + '|' + src.id;
    const def = ir.canvases.get(src.blockDefCanvasId);
    const out = def && def.ports.outputs[edge.fromPort || 0];
    return out ? def.id + '|' + out.id : null;
  };
  const depsOf = (key) => {
    const bar = key.indexOf('|');
    const c = ir.canvases.get(key.slice(0, bar));
    const n = c && c.byId.get(key.slice(bar + 1));
    if(!n) return [];
    if(n.type === 'alias') return n.sourceCanvasId && n.sourceNodeId ? [n.sourceCanvasId + '|' + n.sourceNodeId] : [];
    if(n.type === 'periodShift' && n.offset !== 0) return [];
    if(n.type === 'value' && n.blockRole === 'input'){
      return (portFeeds.get(c.id + '|' + n.id) || []).map(f => edgeTarget(f.canvasId, f.edge)).filter(Boolean);
    }
    if(n.type === 'value' && n.isInput) return [];
    return n.incoming.map(e => edgeTarget(c.id, e)).filter(Boolean);
  };
  const state = new Map(); // 1 = on the current trail, 2 = done
  for(const c of ir.order){
    for(const n of c.list){
      const start = c.id + '|' + n.id;
      if(state.has(start)) continue;
      const stack = [{ key: start, deps: depsOf(start), i: 0 }];
      state.set(start, 1);
      while(stack.length){
        const top = stack[stack.length - 1];
        if(top.i >= top.deps.length){ state.set(top.key, 2); stack.pop(); continue; }
        const next = top.deps[top.i++];
        const st = state.get(next);
        if(st === 1) return true;
        if(st === 2) continue;
        state.set(next, 1);
        stack.push({ key: next, deps: depsOf(next), i: 0 });
      }
    }
  }
  return false;
}

// The rows where fmIDE shows "?" and Excel writes 0 or leaves the cell blank, from fmIDE's
// calculation: [{ row, periods: [1-based], code, where, blank }]. Remembered per model.
let fmideDifferenceCache = null; // { ir, list }
function fmideQuestionMarkRows(){
  if(fmideDifferenceCache && fmideDifferenceCache.ir === modelIR) return fmideDifferenceCache.rows;
  const rows = [];
  const ir = modelIR;
  if(ir && mayDifferFromFmide(ir)){
    const results = evaluateModel(ir, { instances: true });
    const indexOf = new Map(ir.order.map((c, i) => [c, i]));
    // Every result inside a block instance, by the row id ExcelExporter gives it.
    const hopsOf = (path) => path.map(h => (typeof h.vintage === 'number') ? { canvasId: h.canvasId, nodeId: h.nodeId, vIndex: h.vintage } : { canvasId: h.canvasId, nodeId: h.nodeId });
    const inside = new Map();
    (results.instances || []).forEach((list, p) => list.forEach(e => {
      const id = pathKey(hopsOf(e.path), e.canvasId, e.nodeId);
      if(!inside.has(id)) inside.set(id, []);
      inside.get(id)[p] = e;
    }));
    const rowResults = (row) => {
      if(!row.path || !row.path.length){
        const c = irCanvas(row.canvasId);
        const r = c && results[indexOf.get(c)];
        if(!r) return [];
        return r.errors.map((errs, p) => errs[row.nodeId] ? { error: errs[row.nodeId], origin: r.origins[p][row.nodeId] } : null);
      }
      let path = row.path;
      // A vintage-invariant row stands for every vintage: vintage 1's result.
      if(row.verticalShared) path = path.slice(0, -1).concat([Object.assign({}, path[path.length - 1], { vIndex: 1 })]);
      return inside.get(pathKey(path, row.canvasId, row.nodeId)) || [];
    };
    mapping.rows.forEach(row => {
      const found = rowResults(row);
      const periods = [];
      let first = null;
      found.forEach((e, p) => {
        if(!e || !e.error || !e.origin || !(SILENT_IN_EXCEL[e.origin.code] || NA_IN_EXCEL[e.origin.code])) return;
        periods.push(p + 1);
        if(!first) first = e;
      });
      if(!first) return;
      rows.push({ row, periods, code: first.origin.code, where: first.origin, blank: first.error === 'ambiguous', na: !!NA_IN_EXCEL[first.origin.code] });
    });
  }
  fmideDifferenceCache = { ir, rows };
  return rows;
}

// "1–3, 5" from [1, 2, 3, 5].
function periodRanges(list){
  const out = [];
  for(let i = 0; i < list.length; i++){
    let j = i;
    while(j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(j > i ? list[i] + '–' + list[j] : String(list[i]));
    i = j;
  }
  return out.join(', ');
}

// The rectangle (or other node) where a "?" starts, in words: 'the alias on "Summary"'.
function describeOrigin(o){
  if(!o || !o.canvasId) return '';
  const c = irCanvas(o.canvasId);
  const n = c && c.byId.get(o.nodeId);
  const canvasName = (c && c.name) || o.canvasId;
  let what = 'a node';
  if(n){
    if(n.type === 'value') what = '“' + (parseRectText(n.node.text).name || '(unnamed)') + '”';
    else if(n.type === 'alias') what = 'an alias';
    else if(n.type === 'periodShift') what = 'a period shift';
    else if(n.type === 'blockInstance') what = 'a block';
    else if(n.type === 'function') what = 'the function ' + functionNodeLabel(n);
    else what = 'an operator (' + String(n.symbol == null ? '' : n.symbol) + ')';
  }
  const inBlock = o.path && o.path.length ? ' inside a block' : '';
  return what + ' on “' + canvasName + '”' + inBlock;
}

// "“Margin” v2" for a function node — its name as the file gives it (plain text, shown with
// textContent), or its definition's name.
function functionNodeLabel(n){
  const fn = n.node && n.node.fn;
  const raw = n.call ? n.call.name : (fn && typeof fn.name === 'string' ? fn.name : '');
  const name = String(raw || '').slice(0, 64) || '(unnamed)';
  return '“' + name + '”' + (n.fn ? ' v' + n.fn.version : '');
}

// The cells whose formula a function call makes too long or too deeply nested for Excel
// (buildWorkbook's `tooLong`). Worked out by building the workbook without downloading it,
// only when the model writes out a call; remembered until the model or the layout changes.
let tooLongCache = null; // { ir, layout, list }
function tooLongCells(){
  const ir = modelIR;
  const writes = ir && ir.order.some(c => c.list.some(n => n.type === 'function' && n.call && !n.call.status));
  if(!writes) return [];
  const layout = JSON.stringify(mapping);
  if(tooLongCache && tooLongCache.ir === ir && tooLongCache.layout === layout) return tooLongCache.list;
  let list = [];
  try{ list = buildWorkbook().tooLong; }catch(err){ /* nothing to export yet */ }
  tooLongCache = { ir, layout, list };
  return list;
}

// Every place the workbook will differ from fmIDE, as lines of plain text.
function differenceLines(){
  if(!model || !modelIR || !mapping) return [];
  const tabName = (id) => { const t = mapping.tabs.find(x => x.id === id); return t ? t.name : ''; };
  const lines = [];
  fmideQuestionMarkRows().forEach(d => {
    if(!d.row.include && !d.row.inlineConstant) return;
    const period = d.periods.length === 1 ? 'period ' : 'periods ';
    lines.push('“' + d.row.label + '” (tab “' + tabName(d.row.tabId) + '”): fmIDE shows ? in ' + period + periodRanges(d.periods)
      + ' because ' + (d.na ? NA_IN_EXCEL[d.code] : SILENT_IN_EXCEL[d.code]) + ' (' + describeOrigin(d.where) + '); Excel '
      + (d.na ? 'shows #N/A there.' : d.blank ? 'leaves the cell blank.' : 'writes 0 there.'));
  });
  // Formulas a function call makes too long for Excel.
  tooLongCells().forEach(t => {
    const where = t.periods.length ? (t.periods.length === 1 ? 'period ' : 'periods ') + periodRanges(t.periods) : 'its helper cell';
    const why = t.problem.kind === 'nesting'
      ? 'nests brackets ' + t.problem.size + ' deep (Excel allows ' + EXCEL_LIMITS.nesting + ')'
      : 'would be ' + (t.problem.size ? t.problem.size.toLocaleString('en-US') + ' characters' : 'longer than Excel allows') + ' (Excel allows ' + EXCEL_LIMITS.length.toLocaleString('en-US') + ')';
    lines.push('“' + t.row.label + '” (tab “' + t.tabName + '”): the formula in ' + where + ' writes out a function call that '
      + why + ', so Excel shows #N/A there, where fmIDE shows its value. Putting a rectangle between the function and what feeds it breaks the formula up.');
  });
  // Rows left out of the layout that other rows' formulas read.
  const aliasTargets = new Set();
  modelIR.order.forEach(c => c.list.forEach(n => { if(n.type === 'alias' && n.sourceCanvasId) aliasTargets.add(n.sourceCanvasId + '|' + n.sourceNodeId); }));
  mapping.rows.forEach(row => {
    if(row.include || row.inlineConstant) return;
    const n = irNode(row.canvasId, row.nodeId);
    if(!n) return;
    const hop = row.path && row.path.length ? row.path[row.path.length - 1] : null;
    let read = n.outgoing.length > 0 || aliasTargets.has(row.canvasId + '|' + row.nodeId);
    if(hop && n.blockRole === 'output'){
      if(typeof hop.vIndex === 'number') read = true; // a vintage: its Total row reads it
      else {
        // What the instance's output feeds outside the block.
        const inst = irNode(hop.canvasId, hop.nodeId);
        const port = irCanvas(row.canvasId).ports.outputs.indexOf(n);
        if(inst && inst.outgoing.some(e => (e.fromPort || 0) === port)) read = true;
      }
    }
    if(!read) return;
    lines.push('“' + row.label + '” is left out of the layout, but other rows read it: in Excel they read 0 there, where fmIDE uses its value.');
  });
  return lines;
}

function renderDifferences(){
  const panel = $('differencesPanel');
  if(!panel) return;
  const lines = differenceLines();
  panel.textContent = '';
  panel.classList.toggle('hidden', lines.length === 0);
  if(!lines.length) return;
  const head = document.createElement('div');
  head.className = 'differences-head';
  head.textContent = 'Where the workbook will differ from fmIDE (' + lines.length + '):';
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'panel-help';
  help.textContent = '?';
  help.title = 'Help: where the workbook differs from fmIDE';
  help.addEventListener('click', () => excelHelp.open('differences'));
  head.appendChild(help);
  panel.appendChild(head);
  const ul = document.createElement('ul');
  lines.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  panel.appendChild(ul);
  const note = document.createElement('div');
  note.className = 'hint';
  note.textContent = 'You can still download. Fix these in fmIDE (or include the rows) and both give the same numbers.';
  panel.appendChild(note);
}
