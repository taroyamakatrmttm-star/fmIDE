// ============================================================
// Named scenarios (step 15, after G5; the owner's request, 3 October 2026). A scenario is a
// name and where sliders were when it was saved — each slider's input, mode, periods and value
// ({ key, mode, periods, value }, the moved ones only) — so its numbers are worked out the same
// way the sliders' are (overridesFor), whatever board is shown. The model's scenarios, in
// order (the order a scenario waterfall follows), sit in the Scenarios panel under the sliders:
// - + Save as scenario keeps where the board's sliders are, named sc01, sc02… (renamed in its
//   box; names are unique, ignoring capitals);
// - ▶ Show puts the board's sliders where the scenario had them (a slider it doesn't name goes
//   back to the model's own number; an input it changes with no slider on this board is said);
//   the scenario the sliders match is marked;
// - A compares with it: the outlines, differences and Biggest movers measure from that
//   scenario, as from 📌 Pin as A (05e-compare.js);
// - ⟳ keeps where the sliders are now in it; ↑ ↓ reorder; × deletes.
// Scenarios are kept with the boards (the board file's `scenarios`, version 3, in this browser
// and in fmIDE's document), and every change to them is an undo step; showing one is not (it
// moves sliders). A board's template form carries none.
// ============================================================
const SCENARIOS_LIMIT = 50;
const SCENARIO_NAME_MAX = 40;
let scenarios = []; // [{ name, settings: [{ key, mode, periods, value }] }]

// Read from a file or storage: names unique, settings on input rectangles of this model.
function cleanScenarios(raw, rectFor){
  const out = [];
  (Array.isArray(raw) ? raw : []).slice(0, SCENARIOS_LIMIT).forEach(sc => {
    if(!sc || typeof sc !== 'object') return;
    const name = cleanText(sc.name, SCENARIO_NAME_MAX);
    if(!name || out.some(o => sameName(o.name, name))) return;
    const settings = [];
    (Array.isArray(sc.sliders) ? sc.sliders : []).slice(0, BOARD_LIMIT).forEach(s => {
      const rect = rectFor(s);
      const value = Number(s && s.value);
      if(!rect || !rect.input || s.value === null || !Number.isFinite(value)) return;
      settings.push({ key: rect.key, mode: s.mode === 'shift' ? 'shift' : 'set', periods: cleanPeriods(s.periods, model.periods.length), value });
    });
    out.push({ name, settings });
  });
  return out;
}
// The file form.
function scenariosData(){
  const at = (key) => { const r = model.byKey.get(key); return { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name }; };
  return scenarios.map(sc => ({ name: sc.name, sliders: sc.settings.map(s => Object.assign(at(s.key), { mode: s.mode, periods: Object.assign({}, s.periods), value: s.value })) }));
}
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
function freeScenarioName(){
  for(let i = 1; ; i++){ const n = 'sc' + String(i).padStart(2, '0'); if(!scenarios.some(s => sameName(s.name, n))) return n; }
}
function findScenario(name){
  const s = scenarios.find(x => sameName(x.name, String(name)));
  if(!s) throw new Error('There is no scenario "' + String(name).slice(0, 60) + '".');
  return s;
}

// Where the board's sliders are now (the moved ones).
function slidersNow(){
  return board.sliders.filter(s => s.value !== null && isFinite(s.value)).map(s => ({ key: s.key, mode: s.mode, periods: Object.assign({}, s.periods), value: s.value }));
}
const settingKey = (s) => s.key + '|' + s.mode + '|' + JSON.stringify(s.periods);
// Whether the board's sliders are exactly where the scenario had them.
function scenarioShown(sc){
  const now = slidersNow();
  if(now.length !== sc.settings.length) return false;
  return sc.settings.every(s => now.some(n => settingKey(n) === settingKey(s) && n.value === s.value));
}
// The scenario's numbers worked out (results, as resultsWith).
function scenarioResults(sc){ return resultsWith(overridesFor(sc.settings)); }

function saveScenario(name){
  if(!model) return null;
  if(scenarios.length >= SCENARIOS_LIMIT){ notify('A model has at most ' + SCENARIOS_LIMIT + ' scenarios.', 'err', 'scenarios'); return null; }
  let n = cleanText(name, SCENARIO_NAME_MAX);
  if(n && scenarios.some(s => sameName(s.name, n))){ notify('There is already a scenario called “' + n + '”.', 'err', 'scenarios'); return null; }
  if(!n) n = freeScenarioName();
  scenarios.push({ name: n, settings: slidersNow() });
  saveBoardSoon();
  renderBoard();
  return n;
}
function renameScenario(sc, name){
  const n = cleanText(name, SCENARIO_NAME_MAX);
  if(!n || n === sc.name) return false;
  if(scenarios.some(s => s !== sc && sameName(s.name, n))){ notify('There is already a scenario called “' + n + '”.', 'err', 'scenarios'); renderScenarios(); return false; }
  if(pinA && pinA.scenario === sc.name){ pinA.scenario = n; pinA.label = scenarioLabel(n, sc.settings); renderCompareBar(); }
  eachScenarioChart(c => { c.use = c.use.map(u => sameName(u, sc.name) ? n : u); }); // scenario waterfalls follow the name
  sc.name = n;
  saveBoardSoon();
  renderBoard();
  return true;
}
function updateScenario(sc){
  sc.settings = slidersNow();
  saveBoardSoon();
  renderBoard();
}
function moveScenario(sc, to){
  const from = scenarios.indexOf(sc);
  const i = Math.max(0, Math.min(scenarios.length - 1, to));
  if(from < 0 || from === i) return;
  scenarios.splice(from, 1);
  scenarios.splice(i, 0, sc);
  saveBoardSoon();
  renderBoard();
}
function deleteScenario(sc){
  scenarios = scenarios.filter(s => s !== sc);
  eachScenarioChart(c => { c.use = c.use.filter(u => !sameName(u, sc.name)); });
  saveBoardSoon();
  renderBoard();
}
// Every scenario waterfall that names its scenarios, on every board (04b-charts.js).
function eachScenarioChart(fn){ boards.forEach(b => b.items.forEach(w => { if(w.kind === 'chart' && w.layout === 'scenarios' && w.use) fn(w); })); }
// ▶ Show: the board's sliders where the scenario had them. Returns how many of the inputs it
// changes have no slider on this board.
function showScenario(sc){
  const left = sc.settings.slice();
  board.sliders.forEach(s => {
    const i = left.findIndex(o => settingKey(o) === settingKey(s));
    s.value = i >= 0 ? left.splice(i, 1)[0].value : null;
  });
  renderBoard();
  if(left.length){
    const names = [...new Set(left.map(s => model.byKey.get(s.key).name))];
    notify('“' + sc.name + '” also changes ' + names.join(', ') + ', with no slider ' + (names.length === 1 ? 'like it' : 'like them') + ' on this board: + Slider adds one.', 'info', 'scenarios');
  }
  return left.length;
}
function scenarioLabel(name, settings){ return 'scenario “' + name + '”' + (settings.length ? ' (' + settingsLabel(settings) + ')' : ' (the model\'s own numbers)'); }
// A: compare with this scenario, as with a pinned A (05e-compare.js).
function compareWithScenario(sc){
  pinA = { overrides: overridesFor(sc.settings), sliders: sc.settings.map(s => ({ key: s.key, mode: s.mode, periods: JSON.stringify(s.periods), value: s.value })),
    label: scenarioLabel(sc.name, sc.settings), scenario: sc.name };
  renderCompareBar();
  updateValues();
  return pinA.label;
}

// ---- the panel ----
function renderScenarios(){
  const list = $('scenarioList');
  list.textContent = '';
  $('scenariosEmpty').classList.toggle('hidden', !!scenarios.length);
  if(!model) return;
  scenarios.forEach((sc, i) => {
    const li = make('li', 'scenario');
    li.dataset.name = sc.name;
    const name = make('input', 'scenario-name');
    name.type = 'text';
    name.value = sc.name;
    name.maxLength = SCENARIO_NAME_MAX;
    name.setAttribute('aria-label', 'Scenario name');
    name.addEventListener('change', () => { if(!renameScenario(sc, name.value)) name.value = sc.name; });
    name.addEventListener('keydown', (ev) => { if(ev.key === 'Enter') name.blur(); });
    const button = (cls, label, title, fn) => { const b = make('button', 'scenario-btn ' + cls, label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); return b; };
    li.append(name,
      button('scenario-show', '▶', 'Show: put the sliders where this scenario has them', () => showScenario(sc)),
      button('scenario-compare', 'A', 'Compare with this scenario', () => { if(pinA && pinA.scenario === sc.name) unpinA(); else compareWithScenario(sc); markScenarios(); }),
      button('scenario-update', '⟳', 'Keep where the sliders are now in this scenario', () => updateScenario(sc)),
      button('scenario-up', '↑', 'Move up', () => moveScenario(sc, i - 1)),
      button('scenario-down', '↓', 'Move down', () => moveScenario(sc, i + 1)),
      button('scenario-delete', '×', 'Delete this scenario', () => deleteScenario(sc)));
    // On a phone, a finger held on A looks at the scenario until it lifts (05h-phone-show.js).
    holdToLook(li.querySelector('.scenario-compare'), () => ({ overrides: overridesFor(sc.settings), label: 'scenario “' + sc.name + '”' }));
    li.querySelector('.scenario-up').disabled = i === 0;
    li.querySelector('.scenario-down').disabled = i === scenarios.length - 1;
    const what = make('div', 'scenario-what', sc.settings.length ? settingsLabel(sc.settings) : 'The model\'s own numbers');
    li.appendChild(what);
    list.appendChild(li);
  });
  markScenarios();
}
// Marks the scenario the sliders match, and the one compared with.
function markScenarios(){
  if(!model) return;
  document.querySelectorAll('#scenarioList .scenario').forEach(li => {
    const sc = scenarios.find(s => s.name === li.dataset.name);
    if(!sc) return;
    const shown = scenarioShown(sc);
    li.classList.toggle('current', shown);
    li.querySelector('.scenario-show').setAttribute('aria-pressed', shown ? 'true' : 'false');
    li.querySelector('.scenario-compare').setAttribute('aria-pressed', pinA && pinA.scenario === sc.name ? 'true' : 'false');
  });
}

$('btnSaveScenario').addEventListener('click', () => {
  const n = saveScenario();
  if(!n) return;
  const box = document.querySelector('#scenarioList .scenario[data-name="' + CSS.escape(n) + '"] .scenario-name');
  if(box){ box.focus(); box.select(); }
});
