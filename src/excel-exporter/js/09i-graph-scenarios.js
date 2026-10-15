// ============================================================
// fmGraph's scenarios in the workbook (step 19, phase B2; docs/step19-fmgraph-in-excel.md).
// Layout → Use fmGraph boards… (and File → Import fmGraph boards… for a board file) copies the
// boards' named scenarios into the layout (cfg.graph, 04c-graph-boards.js). At Generate, the
// copy — never the board file — becomes ExcelExporter's own row scenarios and Global Cases:
//   · Global Case 1 is "Base" (every input on its scenario 1, fmIDE's numbers); each fmGraph
//     scenario is a further case, named after it, in order (at most MAX_CASES in all);
//   · each input a scenario moves gets row scenarios: 1 is fmIDE's numbers, then one for
//     each different way the scenarios set it (two that set it alike share one; at most
//     MAX_SCENARIOS) — a set value in its periods, a shift a live formula on scenario 1
//     (=<scenario 1's cell>*(1+x%)), every other period linking to scenario 1;
//   · the case matrix picks that row scenario in each case, and 1 everywhere else.
// What goes past a cut-off, or can't be moved, is listed in the window and after Generate.
// ============================================================
let graphPlanCache = null;

// The plan from the layout's copy (or `g`, a copy not yet used, for the window), or null:
// { cases: [names], byMirror: Map(Inputs-tab row id → { name, variants: [{ name, settings }], pick: [scenario per case] }),
//   bySource: Map(source row id → the same entry), notes: [text] }.
// `assumeInputs`: the Inputs tab will be turned on, so a row needs no Inputs-tab row yet.
function graphScenarioPlan(g, assumeInputs){
  const fromLayout = g === undefined;
  if(fromLayout){
    if(!mapping || !inputsEnabled() || !graphScenariosInLayout()) return null;
    if(graphPlanCache && graphPlanCache.mapping === mapping) return graphPlanCache.plan;
    g = mapping.cfg.graph;
  }
  if(!g || !g.scenarios || !g.scenarios.length) return null;
  const notes = [];
  const kept = g.scenarios.slice(0, MAX_CASES - 1);
  const past = g.scenarios.slice(MAX_CASES - 1);
  if(past.length) notes.push('Scenarios after the ' + (MAX_CASES - 1) + 'th are not written: ' + past.map(s => s.name).join(', ') + '.');
  const cases = ['Base'].concat(kept.map(s => s.name));
  const mirrors = new Map(inputMirrorRows().map(m => [m.sourceRowId, m]));
  const bySource = new Map(), byMirror = new Map();
  const cantMove = [];
  kept.forEach((sc, k) => {
    const caseIndex = k + 1; // 0 is Base
    const perRow = new Map();
    sc.settings.forEach(s => {
      if(!perRow.has(s.row)) perRow.set(s.row, []);
      perRow.get(s.row).push(s);
    });
    perRow.forEach((settings, rowId) => {
      const source = mapping.rows.find(r => r.id === rowId);
      const mirror = mirrors.get(rowId);
      const ok = source && source.include && !source.inlineConstant && isSensitivityInputRow(source)
        && (assumeInputs ? true : (mirror && mirror.tabId === INPUTS_TAB_ID));
      if(!ok){
        const name = (source && source.label) || settings[0].name || rowId;
        if(!cantMove.includes(name)) cantMove.push(name);
        return;
      }
      let entry = bySource.get(rowId);
      if(!entry){
        entry = { name: source.label || settings[0].name, variants: [], pick: cases.map(() => 1), over: [] };
        bySource.set(rowId, entry);
        if(mirror) byMirror.set(mirror.id, entry);
      }
      const key = JSON.stringify(settings.map(s => [s.mode, s.periods, s.value]));
      let at = entry.variants.findIndex(v => v.key === key);
      if(at < 0 && entry.variants.length < MAX_SCENARIOS - 1){
        entry.variants.push({ key, name: sc.name, settings: settings.map(s => ({ mode: s.mode, periods: s.periods, value: s.value })) });
        at = entry.variants.length - 1;
      }
      if(at < 0) entry.over.push(sc.name);
      else entry.pick[caseIndex] = at + 2; // scenario 1 is fmIDE's numbers
    });
  });
  if(cantMove.length) notes.push('Not moved (not on the Inputs tab, left out or a constant): ' + cantMove.join(', ') + '.');
  bySource.forEach(e => {
    if(e.over.length) notes.push('“' + e.name + '” needs ' + (MAX_SCENARIOS + e.over.length) + ' row scenarios; ' + e.over.join(', ') + ' use its scenario 1 in Excel.');
  });
  const plan = { cases, byMirror, bySource, notes };
  if(fromLayout) graphPlanCache = { mapping, plan };
  return plan;
}
// What Generate says after the workbook: the cut-offs and inputs that couldn't be moved.
function graphScenarioNotes(){ graphPlanCache = null; const p = graphScenarioPlan(); return p ? p.notes : []; }

// One cell of a row scenario the plan writes: a number, or a formula on scenario 1's cell
// (`baseRef`, same tab). Settings apply in order: a set value replaces, a shift changes by %.
function graphScenarioCell(variant, p, baseRef){
  const lit = (x) => String(x);
  let expr = baseRef, single = true, value = null; // single: a reference or a number, needing no brackets
  variant.settings.forEach(s => {
    if(!graphPeriodsCover(s.periods, p)) return;
    if(s.mode === 'set'){ value = s.value; expr = lit(s.value); single = true; return; }
    const by = s.value < 0 ? '1-' + lit(-s.value) + '%' : '1+' + lit(s.value) + '%';
    expr = (single ? expr : '(' + expr + ')') + '*(' + by + ')';
    value = null; single = false;
  });
  return value !== null ? { value } : { formula: expr };
}

// ---------- Layout → Use fmGraph boards… ----------
// `read` is readGraphBoards' result; `source` names where the boards came from.
function openGraphBoardsWindow(read, source){
  const matched = matchGraphScenarios(read);
  const modal = $('graphModal');
  const pick = $('graphBoardPick');
  pick.textContent = '';
  read.boards.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = b.name;
    pick.appendChild(o);
  });
  $('graphBoardRow').classList.toggle('hidden', !read.boards.length);
  $('graphSource').textContent = source;
  const list = $('graphScenarioList');
  list.textContent = '';
  matched.scenarios.forEach((sc, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true; cb.dataset.index = String(i);
    const name = document.createElement('span');
    name.className = 'graph-scn-name';
    name.textContent = sc.name;
    const what = document.createElement('span');
    what.className = 'graph-scn-what';
    what.textContent = sc.settings.length
      ? sc.settings.map(s => s.name + ' ' + (s.mode === 'shift' ? (s.value >= 0 ? '+' : '') + s.value + '%' : s.value) + (s.periods.mode === 'all' ? '' : ' (' + graphPeriodsText(s.periods, periodLabels()) + ')')).join(', ')
      : 'fmIDE\'s numbers';
    label.append(cb, name, what);
    li.appendChild(label);
    list.appendChild(li);
  });
  $('graphNoScenarios').classList.toggle('hidden', !!matched.scenarios.length);
  const chosen = () => [...list.querySelectorAll('input[type=checkbox]')].filter(c => c.checked).map(c => matched.scenarios[Number(c.dataset.index)]);
  const renderLeft = () => {
    const lines = [];
    const l = matched.left;
    if(l.notFound) lines.push(l.notFound + ' setting' + (l.notFound === 1 ? '' : 's') + ' on a rectangle this model doesn\'t have' + (l.names.length ? ' (' + l.names.join(', ') + ')' : '') + '.');
    if(l.inBlock) lines.push(l.inBlock + ' on an input inside a block, which every copy of the block shares.');
    if(l.notInput) lines.push(l.notInput + ' on a rectangle that isn\'t an input.');
    if(l.bad) lines.push(l.bad + ' setting' + (l.bad === 1 ? '' : 's') + ' not readable.');
    if(read.badScenarios) lines.push(read.badScenarios + ' scenario' + (read.badScenarios === 1 ? '' : 's') + ' without a name of its own, or past ' + GRAPH_LIMITS.scenarios + '.');
    const plan = graphScenarioPlan({ scenarios: chosen() }, true);
    if(plan) lines.push(...plan.notes);
    if(!inputsEnabled()) lines.push('The Inputs tab will be turned on: the scenarios move inputs there.');
    const ul = $('graphLeftOut');
    ul.textContent = '';
    lines.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    $('graphLeftOutHead').classList.toggle('hidden', !lines.length);
    $('graphUse').disabled = !chosen().length;
  };
  list.onchange = renderLeft;
  renderLeft();
  $('graphRemove').classList.toggle('hidden', !graphScenariosInLayout());
  const opener = document.activeElement;
  const close = () => {
    modal.classList.add('hidden');
    $('graphUse').onclick = $('graphCancel').onclick = $('graphRemove').onclick = null;
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey, true);
    if(opener && document.contains(opener) && opener.focus && !opener.closest('.hidden')) opener.focus();
  };
  const onBackdrop = (ev) => { if(ev.target === modal) close(); };
  const onKey = (ev) => { if(ev.key === 'Escape' && $('confirmModal').classList.contains('hidden')){ ev.preventDefault(); close(); } };
  $('graphCancel').onclick = close;
  $('graphRemove').onclick = async () => { close(); await removeGraphScenarios(); };
  $('graphUse').onclick = async () => {
    const scenarios = chosen();
    const board = read.boards[Number(pick.value)];
    close();
    await useGraphScenarios({ from: read.boards.map(b => b.name), board: board ? board.name : '', scenarios });
  };
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey, true);
  modal.classList.remove('hidden');
  (matched.scenarios.length ? $('graphUse') : $('graphCancel')).focus();
}

// Copies the chosen scenarios into the layout, after asking when it replaces cases there.
async function useGraphScenarios(copy){
  const had = graphScenariosInLayout();
  const ownScenarios = inputMirrorRows().filter(m => m.scenarios).length;
  if(had || ownScenarios){
    const ok = await showConfirm('Replace the cases?',
      (had ? 'This layout already has fmGraph scenarios; they are replaced. ' : '') +
      'The Global Cases become Base and the ' + copy.scenarios.length + ' scenario' + (copy.scenarios.length === 1 ? '' : 's') + ' chosen' +
      (ownScenarios ? '; inputs with scenarios of your own keep them, on scenario 1 in every case.' : '.'),
      'Replace');
    if(!ok){ setStatus($('genStatus'), 'fmGraph scenarios not used.', 'info'); return; }
  }
  const turnedOn = !inputsEnabled();
  if(turnedOn) await setInputsEnabled(true);
  mapping.cfg.graph = cleanGraphCopy(copy, model.periods.length);
  reconcileGraph();
  const plan = graphScenarioPlan();
  if(plan){
    // An input the scenarios move takes its row scenarios from them.
    plan.byMirror.forEach((e, id) => { const m = inputMirrorRows().find(x => x.id === id); if(m) delete m.scenarios; });
    inputsCfg().globalCases = plan.cases.length;
  }
  saveMapping(); renderAll();
  const n = plan ? plan.byMirror.size : 0;
  const msg = 'fmGraph scenarios used: ' + (plan ? plan.cases.length : 1) + ' Global Cases (Base and ' + copy.scenarios.length + '), ' +
    n + ' input' + (n === 1 ? '' : 's') + ' with scenarios.' + (turnedOn ? ' The Inputs tab is on.' : '') +
    (plan && plan.notes.length ? ' ' + plan.notes.join(' ') : '');
  setStatus($('genStatus'), msg, plan && plan.notes.length ? 'warn' : 'ok');
}
async function removeGraphScenarios(){
  const ok = await showConfirm('Remove the fmGraph scenarios?',
    'The Global Cases and row scenarios they made are removed from this layout. The boards themselves are not changed.', 'Remove');
  if(!ok) return;
  mapping.cfg.graph = defaultGraphCopy();
  graphPlanCache = null;
  delete inputsCfg().globalCases;
  saveMapping(); renderAll();
  setStatus($('genStatus'), 'fmGraph scenarios removed from this layout.', 'ok');
}

// A board file or a document's graphBoards, read and shown in the window.
function showGraphBoards(raw, source){
  const read = readGraphBoards(raw);
  if(read.error){ setStatus($('genStatus'), read.error, 'err'); return false; }
  openGraphBoardsWindow(read, source);
  return true;
}
$('btnUseGraphBoards').addEventListener('click', async () => {
  if(!model) return;
  if(modelGraphBoards){ showGraphBoards(modelGraphBoards, 'The boards that came with the model'); return; }
  if(graphScenariosInLayout()){ await removeGraphScenarios(); return; }
  setStatus($('genStatus'), 'This model came without fmGraph boards: use File → Import fmGraph boards… for a board file.', 'info');
});
$('btnImportGraphBoards').addEventListener('click', () => $('graphFileInput').click());
letAnyFileBePicked([$('graphFileInput')]);
$('graphFileInput').addEventListener('change', () => {
  const file = $('graphFileInput').files[0];
  $('graphFileInput').value = '';
  if(!file || !model) return;
  const reader = new FileReader();
  reader.onload = () => importGraphBoardsText(reader.result, file.name);
  reader.onerror = () => setStatus($('genStatus'), 'Could not read that file.', 'err');
  reader.readAsText(file);
});
function importGraphBoardsText(text, fileName){
  const { parsed, error } = parseFileText(text);
  if(error){ setStatus($('genStatus'), error, 'err'); return false; }
  return showGraphBoards(parsed, 'From “' + String(fileName || 'board file').slice(0, 120) + '”');
}
