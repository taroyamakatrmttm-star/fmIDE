// ============================================================
// window.fmViewer: what the tests read and do, through the page as a visitor would (V4 adds
// excelBytes). It changes nothing in the model: there is nothing to change it with. The
// Board's commands (V2) only do what a visitor can: move a slider within its range, show a
// scenario, play, pin A, trace.
// ============================================================
// A slider on the board shown, by id or by its rectangle's name.
function sliderNamed(which){
  if(!board) throw new Error('This viewer has no Board.');
  const byId = board.sliders.find(s => s.id === which);
  if(byId) return byId;
  const name = String(which === undefined || which === null ? '' : which).trim().toLowerCase();
  const named = board.sliders.filter(s => model.byKey.get(s.key).name.toLowerCase() === name);
  if(named.length === 1) return named[0];
  throw new Error(named.length ? 'More than one slider changes "' + String(which).slice(0, 60) + '": give its id.' : 'There is no slider "' + String(which).slice(0, 60) + '".');
}
const playEndId = (x) => x === undefined || x === null || /^base$/i.test(String(x)) ? 'model' : /^my sliders$/i.test(String(x)) ? 'sliders' : 'sc:' + findScenario(x).name;
const answerOf = (r) => r.error ? { error: r.error } : r.value;

window.fmViewer = {
  state(){
    return { loaded: !!state.vm, title: $('showTitle').textContent, canvases: state.shown ? state.shown.canvases.slice() : [],
      canvas: state.canvasId, period: state.period, periods: state.shown ? state.shown.periods.slice() : [],
      zoom: state.vm ? currentView().zoom : null, card: state.card ? Object.assign({}, state.card) : null,
      mark: !$('mark').classList.contains('hidden'), view: state.viewName, hasBoard: boardsShown, loads: state.loads };
  },
  canvases(){ return state.vm ? state.shown.canvases.map(id => ({ id, name: canvasName(id) })) : []; },
  showCanvas(id){ if(state.viewName !== 'logic') showView('logic'); return showCanvas(String(id)); },
  openCard(canvasId, nodeId){ if(state.viewName !== 'logic') showView('logic'); if(canvasId !== state.canvasId && !showCanvas(String(canvasId), { keepCard: true })) return false; return openCard(String(canvasId), String(nodeId)); },
  closeCard(){ closeCard(); },
  goTo(canvasId, nodeId){ if(state.viewName !== 'logic') showView('logic'); return goTo(String(canvasId), String(nodeId)); },
  // A node's number in a period (from 0), with the Board's sliders: the number, or { error }, or null.
  value(canvasId, nodeId, period){
    if(!state.vm) return null;
    if(boardsShown) setLogicNumbers(null);
    const n = rawNode(String(canvasId), String(nodeId));
    if(n && n.type === 'value' && !cvHasIncoming(state.vm.byId.get(String(canvasId)), String(nodeId))){
      const moved = movedValue(String(canvasId), String(nodeId), Number(period) || 0);
      if(moved !== null) return moved;
      const lit = effectiveLiteral(n, period); return lit !== null ? lit : 0;
    }
    const r = nodeResult(state.vm, String(canvasId), String(nodeId), Number(period) || 0);
    return r.error ? { error: r.error } : (r.value !== undefined ? r.value : null);
  },
  view(){ return state.vm ? Object.assign({}, currentView()) : null; },
  fit(){ if(state.vm) fitView(); },
  // The drawing of the canvas shown: boxes and arrow ends (to compare with fmIDE's).
  layout(){
    if(!state.layout) return null;
    return { nodes: state.layout.nodes.map(b => ({ id: b.id, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h })),
      edges: state.layout.edges.map(e => ({ id: e.id, from: e.from, to: e.to, d: e.d, auto: e.auto, badge: e.badge ? e.badge.n : null })) };
  },
  // The model as it was read: the same after anything a visitor does.
  modelText(){ return state.model ? JSON.stringify(state.model.system) : ''; },
  modelTextAtLoad(){ return state.modelJson; },

  // ---- the Board (phase V2) ----
  showView(name){ return showView(name === 'board' ? 'board' : 'logic'); },
  board(){
    if(!board) return null;
    return { boards: boards.map(b => b.name), shown: boards.indexOf(board), scenario: currentScenario(), shownScenario,
      sliders: board.sliders.map(s => ({ id: s.id, name: model.byKey.get(s.key).name, mode: s.mode, value: s.value, shown: sliderShown(s), min: s.min, max: s.max, step: s.step })),
      items: board.items.map(w => ({ id: w.id, kind: w.kind, layout: w.kind === 'chart' ? w.layout : null, name: w.kind === 'chart' ? w.title : model.byKey.get(w.key).name })),
      scenarios: scenarios.map(sc => sc.name), comparing: pinA ? pinA.label : null, traced: traceId,
      playing: playing ? { from: playEndWords(playing.from.id), to: playEndWords(playing.to.id), still: playing.still, index: playing.index } : null };
  },
  showBoard(i){ return showBoardAt(Number(i)); },
  // Moves a slider as a visitor would: kept within its range and on its steps.
  setSlider(which, value){
    const s = sliderNamed(which);
    const v = Number(value);
    if(!Number.isFinite(v)) throw new Error('A slider takes a number.');
    const kept = inRange(s, v);
    moveSlider(s, kept, kept === sliderBase(s));
    renderBoard();
    return s.value === null ? sliderShown(s) : s.value;
  },
  showScenario(name){ if(name === null || name === undefined || /^base$/i.test(String(name))){ showBase(); return 'Base'; } return showScenarioExact(findScenario(name)); },
  reset(){ resetAll(); },
  play(from, to){ const w = startPlay(playEndId(from), playEndId(to)); if(!w) throw new Error('From and to give the same numbers: there is nothing to play.'); return w; },
  stopPlay(){ return stopPlay(); },
  stepPlay(){ return stepPlay(); },
  pinA(){ return pinNow(); },
  unpinA(){ unpinA(); },
  swapA(){ return swapNow(); },
  trace(id){ return setTrace(id === undefined ? null : id); },
  // A bar's numbers per period, as shown: [{ period, value | error }].
  bar(id){
    const b = board && board.items.find(w => w.id === id && w.kind === 'bar');
    if(!b) throw new Error('There is no bar "' + String(id).slice(0, 40) + '".');
    const rect = model.byKey.get(b.key), results = currentResults();
    return periodsOf(b.periods).map(p => ({ period: model.periods[p], value: answerOf(resultOf(results, rect, p)) }));
  },
  // A chart's figures, as fmGraph's chart(id) gives them (the board engine's, with the sliders shown).
  chart(id){
    const c = board && board.items.find(w => w.id === id && w.kind === 'chart');
    if(!c) throw new Error('There is no chart "' + String(id).slice(0, 40) + '".');
    return chartAnswer(c); // (04b-charts.js: the same as fmGraph.chart)
  },
  movers(n){ return model && board ? biggestMovers(currentResults(), Math.max(1, Math.min(200, Number(n) || MOVERS_SHOWN))).map(m => ({ name: m.rect.name, period: model.periods[m.p] })) : []; },
  trySample(){ return openSample(); },
  saveNow(){ saveStateNow(); },
  // The key this viewer keeps its state under on this device (08-state.js), or null.
  stateKey(){ return stateKey; },
};

wireFiles();
wireStage();
wireCard();
wireBoard();
wireHelp();
$('tabBoard').addEventListener('click', () => showView('board'));
$('tabLogic').addEventListener('click', () => showView('logic'));
$('phoneTabBoard').addEventListener('click', () => showView('board'));
$('phoneTabLogic').addEventListener('click', () => showView('logic'));
window.addEventListener('pagehide', () => saveStateNow());
startFromPage().catch(() => notify('That viewer could not be opened.', 'err', 'load'));
})();
