// ============================================================
// Tutorials (step 15, G6). Four short tutorials, listed at the top of the Help panel, each
// practising on a copy of the sample model: the model open before is set aside (its boards are
// saved first) and comes back at the end — asked for again from fmIDE when it came from there,
// else read again from what was opened, its boards from this browser. While practising nothing
// is kept in the browser or sent to fmIDE. A coach card (#tutorialCard) shows one step at a time;
// a ring (#tutorialPointer) points at what to press; a step moves on by itself once what it asks
// for is true (checks in src/help/fmgraph-tutorials.js, data only). Nothing is done for the
// person. Opening another model during a tutorial ends it.
// ============================================================
// build:include help/fmgraph-tutorials.js

let practice = null;      // { tutorial, step, back, timer }
let practiceStart = null; // the board a practice model starts with ('sliders' | 'sample'), while practising
let lastOpened = null;    // { text, name, opts } of the model opened last (not a practice or a try)

function tutorialById(id){ return FMGRAPH_TUTORIALS.find(t => t.id === id) || null; }

async function startTutorial(id){
  const t = tutorialById(id);
  if(!t) return false;
  if(practice) stopTutorial(false);
  help.close();
  if(model) saveBoardNow();
  const back = model && !practiceStart ? { model: lastOpened, fromFmide: linkedToFmide } : null;
  practice = { tutorial: t, step: 0, back, timer: null, shown: -1, armed: false };
  const ok = await openModelText(JSON.stringify(SAMPLE_MODEL), 'Practice — ' + t.title, { boards: null, templates: [], practice: t.board || 'sample' });
  if(!ok || !practice){ practice = null; return false; }
  document.body.classList.add('practising');
  renderTutorialCard();
  practice.timer = setInterval(tutorialTick, 300);
  return true;
}

// The board a practice model starts with.
function practiceBoards(kind){
  const r = cleanBoards(JSON.parse(JSON.stringify(SAMPLE_BOARD)));
  if(kind === 'sliders') r.boards.forEach(b => { b.items = []; });
  return r.boards;
}

// Ends the tutorial; restore: put the model from before back.
function stopTutorial(restore){
  if(!practice) return;
  const back = practice.back;
  clearInterval(practice.timer);
  practice = null;
  practiceStart = null;
  document.body.classList.remove('practising');
  const card = $('tutorialCard'); if(card) card.remove();
  hideTutorialPointer();
  if(!restore) return;
  if(back && back.fromFmide && fmideOpener()) askFmideForModel();
  else if(back && back.model) openModelText(back.model.text, back.model.name, back.model.opts);
  else showWelcomeScreen();
}

// The first screen again (no model).
function showWelcomeScreen(){
  clearTimeout(saveTimer); clearTimeout(sendTimer); clearTimeout(quietTimer);
  model = null; boards = []; board = null; pinA = null; traceId = null; scenarios = [];
  linkedToFmide = false; trying = null;
  $('welcome').classList.remove('hidden');
  $('board').classList.add('hidden');
  $('boardTabs').classList.add('hidden');
  $('trialBar').classList.add('hidden');
  $('compareBar').classList.add('hidden');
  $('modelName').textContent = '';
  syncPageState();
  syncUndoButtons();
}

// ---- the checks ----
function rectNamed(key){ const r = model.byKey.get(key); return r ? r.name.trim().toLowerCase() : ''; }
const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
function checkPasses(c){
  if(!model || !board) return false;
  if('bar' in c) return board.bars.some(b => c.bar === null || sameText(rectNamed(b.key), c.bar));
  if('slider' in c) return board.sliders.some(s => sameText(rectNamed(s.key), c.slider) && (!c.moved || (s.value !== null && isFinite(s.value))));
  if('reset' in c) return board.sliders.length > 0 && board.sliders.every(s => s.value === null);
  if('chart' in c) return board.charts.some(ch => {
    if(ch.layout !== c.chart) return false;
    if(c.steps && !(ch.steps && ch.steps.length === c.steps.length && c.steps.every(([n, role], i) => sameText(rectNamed(ch.steps[i].key), n) && ch.steps[i].role === role))) return false;
    if(c.outputs && !(ch.outputs && c.outputs.every(n => ch.outputs.some(k => sameText(rectNamed(k), n))))) return false;
    return true;
  });
  if('traced' in c) return (traceId !== null) === !!c.traced;
  if('pinned' in c) return !!pinA === !!c.pinned;
  if('scenarios' in c) return scenarios.length >= c.scenarios;
  if('scenarioShown' in c) return !!scenarios[c.scenarioShown] && scenarioShown(scenarios[c.scenarioShown]);
  return false;
}
function stepDone(step){ return !!(step.done && step.done.length && step.done.every(checkPasses)); }

// A step moves on once its checks hold — but one already done when it is shown (Back) waits for
// Next, until it is undone again.
function tutorialTick(){
  if(!practice) return;
  const t = practice.tutorial, step = t.steps[practice.step];
  const done = stepDone(step);
  if(!practice.armed){ if(!done && step.done && step.done.length){ practice.armed = true; renderTutorialCard(); } }
  else if(done && practice.step < t.steps.length - 1){ practice.step++; renderTutorialCard(); return; }
  showTutorialPointer(step && step.point);
}

// ---- the coach card ----
function renderTutorialCard(){
  let card = $('tutorialCard');
  if(!card){ card = make('div', 'tutorial-card'); card.id = 'tutorialCard'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Tutorial'); document.body.appendChild(card); }
  const t = practice.tutorial, i = practice.step, step = t.steps[i], last = i === t.steps.length - 1;
  card.dataset.tutorial = t.id;
  card.dataset.step = step.id;
  const checks = !!(step.done && step.done.length);
  if(practice.shown !== i){ practice.shown = i; practice.armed = checks && !stepDone(step); }
  card.textContent = '';
  const head = make('div', 'tutorial-head');
  head.append(make('span', 'tutorial-title', '🎓 ' + t.title), make('span', 'tutorial-count', 'Step ' + (i + 1) + ' of ' + t.steps.length));
  const bar = make('div', 'tutorial-progress');
  const fill = make('div', 'tutorial-progress-fill');
  fill.style.width = Math.round((i + 1) / t.steps.length * 100) + '%';
  bar.appendChild(fill);
  card.append(head, bar, make('p', 'tutorial-text', step.text));
  if(practice.armed && !last) card.appendChild(make('p', 'tutorial-waiting', 'Moves on when you have done it.'));
  if(i === 0) card.appendChild(make('p', 'tutorial-waiting', 'Practice: nothing here is kept, and your own model comes back at the end.'));
  const actions = make('div', 'tutorial-actions');
  const btn = (label, cls, fn) => { const b = make('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); actions.appendChild(b); return b; };
  btn('Exit', 'tutorial-exit', () => stopTutorial(true));
  if(i > 0) btn('Back', 'tutorial-back', () => { practice.step--; renderTutorialCard(); });
  if(last) btn('Finish', 'primary tutorial-finish', () => stopTutorial(true));
  else if(!practice.armed) btn('Next', 'primary tutorial-next', () => { practice.step++; renderTutorialCard(); });
  card.appendChild(actions);
  showTutorialPointer(step.point);
}

function showTutorialPointer(selector){
  const target = selector ? document.querySelector(selector) : null;
  if(!target || !target.getClientRects().length){ hideTutorialPointer(); return; }
  let ring = $('tutorialPointer');
  if(!ring){ ring = make('div', 'tutorial-pointer'); ring.id = 'tutorialPointer'; document.body.appendChild(ring); }
  const r = target.getBoundingClientRect();
  ring.style.left = (r.left - 4) + 'px';
  ring.style.top = (r.top - 4) + 'px';
  ring.style.width = (r.width + 8) + 'px';
  ring.style.height = (r.height + 8) + 'px';
}
function hideTutorialPointer(){ const ring = $('tutorialPointer'); if(ring) ring.remove(); }

// ---- where they are found: the top of the Help panel, and the first screen ----
function renderTutorialList(body, mk){
  if(isPhone()) return; // they practise building charts: a tablet or computer (step 17)
  body.appendChild(mk('h3', 'help-group', 'Tutorials'));
  FMGRAPH_TUTORIALS.forEach(t => {
    const row = mk('div', 'help-tutorial');
    row.dataset.tutorial = t.id;
    const text = mk('div', 'help-command-text');
    text.appendChild(mk('div', 'help-command-name', '🎓 ' + t.title + ' · ' + t.minutes + ' min'));
    text.appendChild(mk('div', 'help-command-sentence', t.summary));
    row.appendChild(text);
    const go = mk('button', 'help-run help-tutorial-start', '▶');
    go.type = 'button';
    go.title = 'Start this tutorial (on a practice copy of the sample model; your own model comes back untouched)';
    go.setAttribute('aria-label', 'Start the tutorial ' + t.title);
    go.addEventListener('click', () => { startTutorial(t.id); });
    row.appendChild(go);
    body.appendChild(row);
  });
}
$('btnTutorials').addEventListener('click', () => { help.open(); });
