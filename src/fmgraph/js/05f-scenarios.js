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
function findScenario(name){
  const s = scenarios.find(x => sameName(x.name, String(name)));
  if(!s) throw new Error('There is no scenario "' + String(name).slice(0, 60) + '".');
  return s;
}

// Where the board's sliders are now (the moved ones; shared with other boards, or its own).
function slidersNow(){
  return liveSliders().filter(s => s.value !== null && isFinite(s.value)).map(s => ({ key: s.key, mode: s.mode, periods: Object.assign({}, s.periods), value: s.value }));
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

function scenarioLabel(name, settings){ return 'scenario “' + name + '”' + (settings.length ? ' (' + settingsLabel(settings) + ')' : ' (the model\'s own numbers)'); }
// A: compare with this scenario, as with a pinned A (05e-compare.js).
function compareWithScenario(sc){
  pinA = { overrides: overridesFor(sc.settings), sliders: sc.settings.map(s => ({ key: s.key, mode: s.mode, periods: JSON.stringify(s.periods), value: s.value })),
    label: scenarioLabel(sc.name, sc.settings), scenario: sc.name };
  renderCompareBar();
  updateValues();
  return pinA.label;
}
