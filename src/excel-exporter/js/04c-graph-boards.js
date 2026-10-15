// ============================================================
// fmGraph boards — ExcelExporter's own reader of the fmIDE-graph-board format (step 19,
// phase B2; docs/step19-fmgraph-in-excel.md). Written from the format's documentation
// (docs/file-formats.md, "fmGraph boards", CC BY 4.0): no code comes from fmGraph, which is
// under another licence (LICENSING.md).
//
// A board file comes from someone else as often as not (fmGraph's Export, a document's
// graphBoards), so everything in it is untrusted: names are kept as plain text and cut to
// the documented lengths, numbers forced to numbers, periods checked, and a rectangle is used
// only where the open model has it — same canvas id, node id and name (capitals and outer
// spaces ignored). Anything else is left out and counted, and the window says so.
//
//   readGraphBoards(raw)         → { error } or { version, boards, scenarios, badScenarios, badSettings }
//   matchGraphScenarios(read)    → the scenarios with each setting matched to a layout row
//   cleanGraphCopy(raw, periods) → the layout's cfg.graph (mapping file 4), checked
// ============================================================
const GRAPH_BOARD_KIND = 'fmIDE-graph-board';
const GRAPH_BOARD_VERSION = 7; // the newest version this reader knows
const GRAPH_LIMITS = { boards: 20, scenarios: 50, settings: 40, boardName: 60, scenarioName: 40, rectName: 60, value: 1e15 };

let modelGraphBoards = null; // the graphBoards a loaded workspace or .fmide carried (raw; read only when used)

// Plain text, outer spaces off, at most `max` characters.
function graphText(v, max){
  if(typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}
// A number, or null: numbers and number-looking text forced, nothing beyond ±10¹⁵.
function graphNumber(v){
  if(typeof v === 'string' && v.trim() === '') return null;
  if(typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= GRAPH_LIMITS.value ? n : null;
}
// A widget's periods: all, one period or a range (counting from 0); a period the model
// doesn't have, or anything else, reads as all.
function cleanGraphPeriods(p, periodCount){
  const n = Math.max(1, periodCount || 1);
  const whole = (x) => { const v = Number(x); return Number.isInteger(v) && v >= 0 && v < n ? v : null; };
  if(p && typeof p === 'object' && !Array.isArray(p)){
    if(p.mode === 'one'){ const at = whole(p.p); if(at !== null) return { mode: 'one', p: at }; }
    if(p.mode === 'range'){
      const from = whole(p.from), to = whole(p.to);
      if(from !== null && to !== null && from <= to) return { mode: 'range', from, to };
    }
  }
  return { mode: 'all' };
}
function graphPeriodsCover(periods, p){
  if(!periods || periods.mode === 'all') return true;
  if(periods.mode === 'one') return p === periods.p;
  return p >= periods.from && p <= periods.to;
}
function graphPeriodsText(periods, labels){
  if(!periods || periods.mode === 'all') return 'all periods';
  const at = (i) => (labels && labels[i]) || ('period ' + (i + 1));
  return periods.mode === 'one' ? at(periods.p) : at(periods.from) + '–' + at(periods.to);
}

// Reads a board file's structure (not yet matched to a model). The template form, a newer
// version and anything not a board file are refused with the reason.
function readGraphBoards(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.kind !== GRAPH_BOARD_KIND){
    return { error: 'That is not an fmGraph boards file (made with Export all boards in fmGraph).' };
  }
  const version = raw.version === undefined ? 1 : Number(raw.version);
  if(!Number.isInteger(version) || version < 1) return { error: 'That fmGraph boards file has no version this ExcelExporter can read.' };
  if(version > GRAPH_BOARD_VERSION){
    return { error: 'That fmGraph boards file is from a newer version (format version ' + version + '; this ExcelExporter reads up to version ' + GRAPH_BOARD_VERSION + '). Update ExcelExporter to use it.' };
  }
  if(raw.form === 'template'){
    return { error: 'That fmGraph boards file is for a template (Export for a template…), not for one model: export the model\'s boards with Export all boards.' };
  }
  // Before boards had tabs, one board sat at the top level (no `boards`).
  const list = Array.isArray(raw.boards) ? raw.boards : [raw];
  const boards = [];
  list.slice(0, GRAPH_LIMITS.boards).forEach((b, i) => {
    if(!b || typeof b !== 'object' || Array.isArray(b)) return;
    const count = (x) => Array.isArray(x) ? x.length : 0;
    boards.push({ name: graphText(b.name, GRAPH_LIMITS.boardName) || ('Board ' + (i + 1)),
      sliders: count(b.sliders), items: count(b.items) + count(b.bars) + count(b.charts) });
  });
  // Named scenarios came in version 3: an older file's are not read.
  const scenarios = [];
  let badScenarios = 0, badSettings = 0;
  const seen = new Set();
  (version >= 3 && Array.isArray(raw.scenarios) ? raw.scenarios : []).forEach(sc => {
    const name = sc && typeof sc === 'object' ? graphText(sc.name, GRAPH_LIMITS.scenarioName) : '';
    const key = name.toLowerCase();
    if(!name || seen.has(key) || scenarios.length >= GRAPH_LIMITS.scenarios){ badScenarios++; return; }
    seen.add(key);
    const settings = [];
    (Array.isArray(sc.sliders) ? sc.sliders : []).forEach(s => {
      if(!s || typeof s !== 'object' || typeof s.canvasId !== 'string' || typeof s.nodeId !== 'string'
        || !s.canvasId || !s.nodeId || s.canvasId.length > 200 || s.nodeId.length > 200
        || (s.mode !== 'set' && s.mode !== 'shift') || settings.length >= GRAPH_LIMITS.settings){ badSettings++; return; }
      const value = graphNumber(s.value);
      if(value === null){ badSettings++; return; }
      settings.push({ canvasId: s.canvasId, nodeId: s.nodeId, name: graphText(s.name, GRAPH_LIMITS.rectName), mode: s.mode, periods: s.periods, value });
    });
    scenarios.push({ name, settings });
  });
  return { version, boards, scenarios, badScenarios, badSettings };
}

// Each scenario's settings matched to the open model: kept only on an input rectangle the
// model has under that canvas id, node id and name, outside any block. The rest counted.
// → { scenarios: [{ name, settings: [{ row, name, mode, periods, value }] }], left: { notFound, notInput, inBlock, bad, names (of those not found) } }
function matchGraphScenarios(read){
  const left = { notFound: 0, notInput: 0, inBlock: 0, bad: read.badSettings || 0, names: [] };
  const norm = (s) => String(s || '').trim().toLowerCase();
  const scenarios = read.scenarios.map(sc => ({ name: sc.name, settings: sc.settings.filter(s => {
    const canvas = model.canvases.find(c => c.id === s.canvasId);
    const node = canvas && canvas.nodes.find(n => n.id === s.nodeId);
    const row = node && mapping.rows.find(r => r.id === pathKey([], s.canvasId, s.nodeId));
    const named = node && node.type === 'value' && norm(parseRectText(node.text).name) === norm(s.name);
    const why = !row || !named ? 'notFound' : isUsedAsBlock(s.canvasId) ? 'inBlock' : !isSensitivityInputRow(row) ? 'notInput' : null;
    if(why){
      left[why]++;
      if(why === 'notFound' && s.name && !left.names.includes(s.name) && left.names.length < 20) left.names.push(s.name);
      return false;
    }
    s.row = row.id;
    s.periods = cleanGraphPeriods(s.periods, model.periods.length);
    return true;
  }).map(s => ({ row: s.row, name: s.name || row0Label(s.row), mode: s.mode, periods: s.periods, value: s.value })) }));
  return { scenarios, left };
}
function row0Label(rowId){ const r = mapping.rows.find(x => x.id === rowId); return r ? String(r.label || '') : ''; }

// ---------- The layout's copy: cfg.graph (mapping file 4) ----------
// What Layout → Use fmGraph boards… copied, as settings ExcelExporter owns from then on:
//   { from: [board names], board: the board picked, scenarios: [{ name, settings: [{ row, name, mode, periods, value }] }] }
function defaultGraphCopy(){ return { from: [], board: '', scenarios: [] }; }
function cleanGraphCopy(raw, periodCount){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = defaultGraphCopy();
  out.from = (Array.isArray(src.from) ? src.from : []).map(n => graphText(n, GRAPH_LIMITS.boardName)).filter(Boolean).slice(0, GRAPH_LIMITS.boards);
  out.board = graphText(src.board, GRAPH_LIMITS.boardName);
  const seen = new Set();
  (Array.isArray(src.scenarios) ? src.scenarios : []).forEach(sc => {
    const name = sc && typeof sc === 'object' ? graphText(sc.name, GRAPH_LIMITS.scenarioName) : '';
    if(!name || seen.has(name.toLowerCase()) || out.scenarios.length >= GRAPH_LIMITS.scenarios) return;
    seen.add(name.toLowerCase());
    const settings = [];
    (Array.isArray(sc.settings) ? sc.settings : []).forEach(s => {
      if(!s || typeof s !== 'object' || typeof s.row !== 'string' || !s.row || s.row.length > 400) return;
      if((s.mode !== 'set' && s.mode !== 'shift') || settings.length >= GRAPH_LIMITS.settings) return;
      const value = graphNumber(s.value);
      if(value === null) return;
      settings.push({ row: s.row, name: graphText(s.name, GRAPH_LIMITS.rectName), mode: s.mode, periods: cleanGraphPeriods(s.periods, periodCount), value });
    });
    out.scenarios.push({ name, settings });
  });
  return out;
}
// Called when a model or a layout is read: settings on rows that are gone, or no longer
// inputs that can be moved, are dropped.
function reconcileGraph(){
  const g = cleanGraphCopy(mapping.cfg.graph, model.periods.length);
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  g.scenarios.forEach(sc => { sc.settings = sc.settings.filter(s => isSensitivityInputRow(byId.get(s.row))); });
  mapping.cfg.graph = g;
  graphPlanCache = null;
}
function graphScenariosInLayout(){ return !!(mapping && mapping.cfg.graph && mapping.cfg.graph.scenarios && mapping.cfg.graph.scenarios.length); }
