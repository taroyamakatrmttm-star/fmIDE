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

// The model as fmGraph and the showcase viewer use it: the IR compiled once, every value
// rectangle (its key, name, unit, whether it is an input), the model's own numbers, what each
// rectangle reaches. Throws when there is nothing to show.
function buildModel(system, name){
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
  // The canvas template each canvas was made from (G5a; a system file's canvas.template), for
  // Export for a template….
  const canvasTemplates = new Map(), canvasVersionIds = new Map();
  system.canvases.forEach(c => {
    const t = c && c.template;
    if(!c || typeof c.id !== 'string' || !t || typeof t !== 'object' || typeof t.family !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(t.family)) return;
    if(!canvasTemplates.has(c.id)) canvasTemplates.set(c.id, { family: t.family, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 120) : 'a canvas template' });
    if(typeof t.versionId === 'string' && !canvasVersionIds.has(c.id)) canvasVersionIds.set(c.id, t.versionId);
  });
  const m = { name: typeof name === 'string' && name ? name.slice(0, 120) : 'Model', periods, ir, canvasIndex, rects, byKey, canvasTemplates, canvasVersionIds,
    inputs: rects.filter(r => r.input), base, baseMs, signature: modelSignature(ir), reach: reachMap(ir) };
  return m;
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
  function reachOf(key){
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
  }
  // Trace (G4a): the shortest way along the arrows from one key to another, as the list of
  // keys passed through (both ends included), or null when `from` doesn't reach `to`.
  reachOf.path = function(from, to){
    if(from === to) return [from];
    const back = new Map([[from, null]]), queue = [from];
    for(let i = 0; i < queue.length; i++){
      const outs = next.get(queue[i]);
      if(!outs) continue;
      for(const o of outs){
        if(back.has(o)) continue;
        back.set(o, queue[i]);
        if(o === to){
          const out = [to];
          for(let k = queue[i]; k !== null; k = back.get(k)) out.unshift(k);
          return out;
        }
        queue.push(o);
      }
    }
    return null;
  };
  return reachOf;
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
