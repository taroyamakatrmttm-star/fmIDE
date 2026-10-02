// ============================================================
// Reading a model: an fmIDE system, or a workspace (a .fmide document is one). Every file goes
// through readModelData: the kind is identified (older files by shape), a file of another
// kind is refused with where it belongs, older versions are upgraded step by step with the
// shared upgrades, and a file from a newer version is opened only after asking.
// ============================================================
const FILE_FORMATS = {
  'system':          { current: SHARED_FILE_VERSIONS['system'], label: 'fmIDE system' },
  'fmIDE-workspace': { current: SHARED_FILE_VERSIONS['fmIDE-workspace'], label: 'fmIDE workspace' },
};

// Returns { error } or { kind, data (an upgraded copy), fromVersion, newer, newerParts }.
function readModelData(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: "That file doesn't hold an fmIDE model." };
  const kind = inferFileKind(raw);
  if(!kind || !FILE_FORMATS[kind]){
    if(typeof kind === 'string' && /^(module|fmIDE-)/.test(kind)){
      return { error: 'That is an fmIDE file of another kind ("' + kind.slice(0, 40) + '"), not a whole model. In fmIDE, save the model with File → Save (a .fmide document) or Save System.' };
    }
    return { error: "That file isn't an fmIDE model this version recognises." };
  }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion, newer } = upgradeFileData(data, kind, FILE_FORMATS, SHARED_FILE_MIGRATIONS);
  const newerParts = [];
  if(kind === 'fmIDE-workspace'){
    if(!data.system || typeof data.system !== 'object') return { error: 'That workspace holds no model.' };
    const r = readModelData(data.system);
    if(r.error) return { error: "The workspace's model is unreadable: " + r.error };
    if(r.kind !== 'system') return { error: "The workspace's model is unreadable." };
    data.system = r.data;
    if(r.newer) newerParts.push('its model (format version ' + r.fromVersion + ')');
  }
  return { kind, data, fromVersion, newer, newerParts };
}

// Opens a file's text (from the disk, a drop or fmIDE). Resolves true when a model was loaded.
// opts.boards: the document's own boards (an fmIDE-graph-board file, parsed or as text) —
// fmIDE's (step 15 G3b), or a workspace's `graphBoards`; opts.fromFmide: the model came from
// fmIDE's window, so changes to the boards go back to it (06-page.js).
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
  try{
    const o = opts || {};
    const docBoards = o.boards !== undefined ? o.boards : (r.kind === 'fmIDE-workspace' ? r.data.graphBoards : null);
    await loadModel(r.kind === 'fmIDE-workspace' ? r.data.system : r.data, name, { boards: docBoards, fromFmide: !!o.fromFmide });
  }catch(e){
    notify(e && e.message ? e.message : 'That model could not be opened.', 'err', 'load');
    return false;
  }
  return true;
}

// ---- the loaded model ----
// model: { name, periods, ir, rects (every value rectangle), byKey, inputs, reach, base,
//          baseMs, signature }
let model = null;

const keyOf = (canvasId, nodeId) => canvasId + '\u0000' + nodeId;

// A rectangle's name: the first line of its text, or its id.
function rectName(n){
  const name = String(parseRectText(n.node && n.node.text).name || '').trim();
  return (name || '#' + n.id).slice(0, 120);
}

async function loadModel(system, name, opts){
  if(!system || !Array.isArray(system.canvases) || system.canvases.length === 0){
    throw new Error('That model has no canvases.');
  }
  const rawPeriods = Array.isArray(system.periods) && system.periods.length ? system.periods : ['Period 1'];
  const periods = rawPeriods.map((p, i) => (typeof p === 'string' || typeof p === 'number') ? String(p).slice(0, 40) : 'Period ' + (i + 1));
  const ir = compileModel({ periods, canvases: system.canvases, functions: system.functions });
  const canvasIndex = new Map();
  ir.order.forEach((c, i) => { if(!canvasIndex.has(c.id)) canvasIndex.set(c.id, i); });
  const rects = [], byKey = new Map();
  ir.order.forEach((c, ci) => {
    if(canvasIndex.get(c.id) !== ci) return; // a repeated canvas id: the first one counts
    const seen = new Set();
    c.list.forEach(n => {
      if(n.type !== 'value' || seen.has(n.id)) return;
      seen.add(n.id);
      const r = { key: keyOf(c.id, n.id), canvasId: String(c.id), nodeId: String(n.id), canvasName: String(c.name || 'Canvas').slice(0, 80),
        name: rectName(n), input: !!(n.isInput || n.incoming.length === 0), unit: '' };
      try{ const u = unitOf(ir, c.id, n.id); r.unit = u ? String(formatUOM(u)).slice(0, 40) : ''; }catch(e){ /* no unit */ }
      rects.push(r);
      byKey.set(r.key, r);
    });
  });
  const t = performance.now();
  const base = evaluateModel(ir);
  const baseMs = performance.now() - t;
  const m = { name: typeof name === 'string' && name ? name.slice(0, 120) : 'Model', periods, ir, canvasIndex, rects, byKey,
    inputs: rects.filter(r => r.input), base, baseMs, signature: modelSignature(ir), reach: reachMap(ir) };
  model = m;
  linkedToFmide = !!(opts && opts.fromFmide);
  clearResultCache();
  await loadBoardFor(m, opts && opts.boards);
  showBoard();
}

// The model's signature: its canvas and rectangle ids, as a short hash. A board is remembered
// under it (fmgraph-board-<signature>).
function modelSignature(ir){
  const ids = [];
  ir.order.forEach(c => { ids.push('c:' + c.id); c.list.forEach(n => { if(n.type === 'value') ids.push(c.id + '/' + n.id); }); });
  ids.sort();
  const text = ids.join('\n');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for(let i = 0; i < text.length; i++){
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// What each rectangle reaches: following the model's arrows forward (aliases read their
// source, a block instance reads what feeds it and its definition's outputs). A slider's
// input lights up exactly the bars it reaches, worked out from the model's structure, not
// from which values happened to change.
function reachMap(ir){
  const next = new Map(); // key → keys that read it
  const link = (from, to) => { if(!next.has(from)) next.set(from, new Set()); next.get(from).add(to); };
  ir.order.forEach(c => c.list.forEach(n => {
    const me = keyOf(c.id, n.id);
    (n.incoming || []).forEach(e => link(keyOf(c.id, e.from), me));
    if(n.type === 'alias' && n.sourceCanvasId && n.sourceNodeId) link(keyOf(n.sourceCanvasId, n.sourceNodeId), me);
    if(n.type === 'blockInstance'){
      irBlockPorts(ir, n.blockDefCanvasId).outputs.forEach(o => link(keyOf(n.blockDefCanvasId, o.id), me));
    }
  }));
  const cache = new Map();
  return function reachOf(key){
    if(cache.has(key)) return cache.get(key);
    const seen = new Set(), todo = [key];
    while(todo.length){
      const k = todo.pop();
      const outs = next.get(k);
      if(!outs) continue;
      outs.forEach(o => { if(!seen.has(o)){ seen.add(o); todo.push(o); } });
    }
    cache.set(key, seen);
    return seen;
  };
}

// A rectangle's result in one period of a calculation: { value } or { error }.
function resultOf(results, rect, p){
  const ci = model.canvasIndex.get(rect.canvasId);
  const r = results[ci];
  if(!r) return { error: 'missing-input' };
  const err = r.errors[p] && r.errors[p][rect.nodeId];
  if(err) return { error: err };
  const v = r.values[p] && r.values[p][rect.nodeId];
  return typeof v === 'number' && isFinite(v) ? { value: v } : { error: 'missing-input' };
}
function baseValue(rect, p){ const r = resultOf(model.base, rect, p); return r.error ? 0 : r.value; }
