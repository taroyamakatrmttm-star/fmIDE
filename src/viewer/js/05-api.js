// ============================================================
// window.fmViewer: what the tests read and do, through the page as a visitor would (V2 adds
// setSlider, showScenario and play; V4 excelBytes). It changes nothing in the model: there is
// nothing to change it with.
// ============================================================
window.fmViewer = {
  state(){
    return { loaded: !!state.vm, title: $('showTitle').textContent, canvases: state.shown ? state.shown.canvases.slice() : [],
      canvas: state.canvasId, period: state.period, periods: state.shown ? state.shown.periods.slice() : [],
      zoom: state.vm ? currentView().zoom : null, card: state.card ? Object.assign({}, state.card) : null,
      mark: !$('mark').classList.contains('hidden') };
  },
  canvases(){ return state.vm ? state.shown.canvases.map(id => ({ id, name: canvasName(id) })) : []; },
  showCanvas(id){ return showCanvas(String(id)); },
  openCard(canvasId, nodeId){ if(canvasId !== state.canvasId && !showCanvas(String(canvasId), { keepCard: true })) return false; return openCard(String(canvasId), String(nodeId)); },
  closeCard(){ closeCard(); },
  goTo(canvasId, nodeId){ return goTo(String(canvasId), String(nodeId)); },
  // A node's number in a period (from 0): the number, or { error }, or null.
  value(canvasId, nodeId, period){
    if(!state.vm) return null;
    const n = rawNode(String(canvasId), String(nodeId));
    if(n && n.type === 'value' && !cvHasIncoming(state.vm.byId.get(String(canvasId)), String(nodeId))){
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
};

wireFiles();
wireStage();
wireCard();
startFromPage().catch(() => notify('That viewer could not be opened.', 'err', 'load'));
})();
