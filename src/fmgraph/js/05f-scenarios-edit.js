// ============================================================
// The Scenarios panel on fmGraph's page: saving, renaming, updating, moving, deleting and
// showing scenarios. Reading them and their numbers are 05f-scenarios.js, the board engine's.
// ============================================================

function freeScenarioName(){
  for(let i = 1; ; i++){ const n = 'sc' + String(i).padStart(2, '0'); if(!scenarios.some(s => sameName(s.name, n))) return n; }
}

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
  liveSliders().forEach(s => {
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
  renderPlayRow(); // (05m-play.js)
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
