// ============================================================
// The Logic view: the model's canvases drawn read-only (src/shared/canvas-view.js), the list
// of canvases, and moving around — drag to pan, the wheel, a pinch or + / − to zoom, Fit.
// ============================================================
const ZOOM_MIN = 0.1, ZOOM_MAX = 4, ZOOM_STEP = 1.25;

// state.model: { system, presets, name }; state.vm: the model as drawn (viewModel);
// state.showcase: the clean showcase or null; state.shown: { canvases, start, periods } —
// what the visitor may see; state.period: the period the canvas's numbers are for (the first
// shown: decision 3, visitors don't change the periods); state.canvasId: the canvas shown;
// state.layout / state.texts: its drawing; state.views: zoom and pan per canvas.
const state = { model: null, vm: null, showcase: null, shown: null, period: 0, canvasId: null, layout: null, texts: null,
  views: new Map(), card: null, modelJson: '' };

function showModel(m, showcase){
  state.model = m;
  state.modelJson = JSON.stringify(m.system);
  try{ state.vm = viewModel(m.system, m.presets); }
  catch(e){ notify('That model could not be shown.', 'err', 'load'); return; }
  state.showcase = showcase || null;
  const canvases = state.vm.canvases.map(c => ({ id: c.id, name: c.name }));
  const r = resolveShowcase(state.showcase, canvases, state.vm.periods.length);
  if(r.problems.length) notify('The showcase: ' + r.problems.join(' '), 'warn', 'resolve');
  else notify('', '', 'resolve');
  state.shown = r;
  state.period = r.periods.length ? r.periods[0] : 0;
  state.views = new Map();
  closeCard();
  notify('', '', 'load');
  renderAbout();
  $('welcome').classList.add('hidden');
  $('logic').classList.remove('hidden');
  document.body.classList.add('has-model');
  renderCanvasList();
  showCanvas(r.start, { quiet: true });
}

// The title, description, author and licence, and the mark.
function renderAbout(){
  const sc = state.showcase;
  const title = sc && sc.title ? sc.title : state.model.name;
  $('showTitle').textContent = title;
  document.title = title + ' — fmShowcase';
  const about = $('about');
  $('showDescription').textContent = sc ? sc.description : '';
  const by = [];
  if(sc && sc.author) by.push('By ' + sc.author);
  $('showByline').textContent = by.join('');
  about.classList.toggle('hidden', !(sc && (sc.description || sc.author)));
  const mark = $('mark');
  mark.classList.toggle('hidden', !!sc && sc.mark === false);
  $('markLicence').textContent = sc && sc.licence ? sc.licence : '';
}

function canvasName(id){ const c = state.vm && state.vm.byId.get(id); return c ? c.name : ''; }

// The canvases a visitor may see: tabs on a computer or an iPad, a menu on a phone.
function renderCanvasList(){
  const tabs = $('canvasTabs'), menu = $('canvasMenu');
  tabs.textContent = ''; menu.textContent = '';
  state.shown.canvases.forEach(id => {
    const t = make('button', 'canvas-tab', canvasName(id));
    t.type = 'button';
    t.setAttribute('role', 'tab');
    t.dataset.canvas = id;
    t.addEventListener('click', () => showCanvas(id));
    tabs.appendChild(t);
    const m = make('button', '', canvasName(id));
    m.type = 'button';
    m.setAttribute('role', 'menuitemradio');
    m.dataset.canvas = id;
    m.addEventListener('click', () => { closeCanvasMenu(); showCanvas(id); });
    menu.appendChild(m);
  });
  const several = state.shown.canvases.length > 1;
  tabs.classList.toggle('hidden', !several);
  $('btnCanvasMenu').classList.toggle('hidden', !several);
  $('logic').style.borderTopLeftRadius = several ? '' : '10px';
}
function markCanvasList(){
  document.querySelectorAll('#canvasTabs .canvas-tab').forEach(t => t.setAttribute('aria-selected', t.dataset.canvas === state.canvasId ? 'true' : 'false'));
  document.querySelectorAll('#canvasMenu button').forEach(b => b.setAttribute('aria-checked', b.dataset.canvas === state.canvasId ? 'true' : 'false'));
  $('canvasMenuName').textContent = canvasName(state.canvasId);
}
function closeCanvasMenu(){ $('canvasMenu').classList.add('hidden'); $('btnCanvasMenu').setAttribute('aria-expanded', 'false'); }

// Shows a canvas the visitor may see. Returns false for one that isn't shown.
function showCanvas(id, opts){
  if(!state.shown || !state.shown.canvases.includes(id)) return false;
  state.canvasId = id;
  markCanvasList();
  drawShown();
  const v = state.views.get(id);
  if(v) applyView(v); else fitView();
  if(!(opts && opts.keepCard)) closeCard();
  return true;
}

// Draws the canvas shown, for the period shown.
function drawShown(){
  const svg = $('canvasSvg');
  canvasDefs(svg);
  state.layout = canvasLayout(state.vm, state.canvasId);
  state.texts = nodeTexts(state.vm, state.canvasId, state.period, state.layout);
  drawCanvas($('world'), state.layout, state.texts);
  const name = state.vm.periods[state.period] || '';
  $('periodNote').textContent = name ? 'Numbers for ' + name : '';
  markPicked();
}

// ---------- zoom and pan ----------
// The view: the canvas point at the stage's top left (x, y), and the zoom.
function currentView(){ return state.views.get(state.canvasId) || { zoom: 1, x: 0, y: 0 }; }
function applyView(v){
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(v.zoom) || 1));
  const view = { zoom: z, x: Number(v.x) || 0, y: Number(v.y) || 0 };
  state.views.set(state.canvasId, view);
  $('world').setAttribute('transform', `scale(${z}) translate(${-view.x} ${-view.y})`);
}
function stageSize(){ const r = $('stage').getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height) }; }
// The whole canvas in sight, with a margin, never bigger than life-size.
function fitView(){
  const b = state.layout ? state.layout.bounds : { x: 0, y: 0, w: 400, h: 300 };
  const s = stageSize(), m = 24;
  const z = Math.min(1, Math.max(ZOOM_MIN, Math.min((s.w - 2 * m) / Math.max(1, b.w), (s.h - 2 * m) / Math.max(1, b.h))));
  applyView({ zoom: z, x: b.x - (s.w / z - b.w) / 2, y: b.y - (s.h / z - b.h) / 2 });
}
// Zooms by `factor` keeping the canvas point under (sx, sy) on the stage where it is.
function zoomAt(factor, sx, sy){
  const v = currentView();
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
  const cx = v.x + sx / v.zoom, cy = v.y + sy / v.zoom;
  applyView({ zoom: z, x: cx - sx / z, y: cy - sy / z });
}
function zoomCentre(factor){ const s = stageSize(); zoomAt(factor, s.w / 2, s.h / 2); }
// Puts a node in the middle of the stage (going to an input from the card).
function centreOn(nodeId){
  const b = state.layout && state.layout.byId.get(nodeId);
  if(!b) return;
  const v = currentView(), s = stageSize();
  const z = Math.max(v.zoom, 0.6);
  const sideCard = !onPhone && !$('card').classList.contains('hidden') ? Math.min(380, s.w / 2) : 0;
  const usable = s.w - sideCard;
  applyView({ zoom: z, x: b.x + b.w / 2 - (usable / 2) / z, y: b.y + b.h / 2 - (onPhone ? s.h / 4 : s.h / 2) / z });
}

function stagePoint(ev){ const r = $('stage').getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }

// Drag to pan; a press that doesn't move is a tap (a rectangle's card). Two fingers pinch.
const TAP_SLOP = 6;
const touches = new Map(); // pointer id → its last stage point, for the pinch
let pinch = null;
function wireStage(){
  const stage = $('stage');
  onPress(stage, (ev) => {
    if(ev.button !== undefined && ev.button !== 0 && ev.type === 'mousedown') return;
    pressDefault(ev);
    const start = stagePoint(ev), v0 = currentView();
    const nodeEl = ev.target && ev.target.closest ? ev.target.closest('.cv-node') : null;
    let moved = false;
    followPointer(ev, (mv) => {
      if(pinch) return;
      const p = stagePoint(mv);
      if(!moved && Math.hypot(p.x - start.x, p.y - start.y) < TAP_SLOP) return;
      moved = true;
      stage.classList.add('dragging');
      applyView({ zoom: v0.zoom, x: v0.x - (p.x - start.x) / v0.zoom, y: v0.y - (p.y - start.y) / v0.zoom });
    }, (up, cancelled) => {
      stage.classList.remove('dragging');
      if(moved || cancelled || pinch) return;
      if(nodeEl) openCard(state.canvasId, nodeEl.dataset.id);
      else closeCard();
    });
  });
  // A pinch: two fingers on the stage zoom about their middle, and pan as it moves.
  stage.addEventListener('pointerdown', (ev) => {
    if(ev.pointerType === 'mouse') return;
    touches.set(ev.pointerId, stagePoint(ev));
    if(touches.size === 2){
      cancelFingerActions();
      const [a, b] = [...touches.values()];
      pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: Object.assign({}, currentView()) };
    }
  });
  const lift = (ev) => { touches.delete(ev.pointerId); if(touches.size < 2) pinch = null; };
  stage.addEventListener('pointermove', (ev) => {
    if(!touches.has(ev.pointerId)) return;
    touches.set(ev.pointerId, stagePoint(ev));
    if(!pinch || touches.size < 2) return;
    const [a, b] = [...touches.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const v = pinch.view;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * dist / pinch.dist));
    const cx = v.x + pinch.mid.x / v.zoom, cy = v.y + pinch.mid.y / v.zoom; // the canvas point first under the middle
    applyView({ zoom: z, x: cx - mid.x / z, y: cy - mid.y / z });
  });
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  // The wheel zooms about the pointer (a trackpad's pinch arrives as the wheel with Ctrl).
  stage.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = stagePoint(ev);
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    zoomAt(Math.pow(ZOOM_STEP, -Math.max(-4, Math.min(4, dy / 100))), p.x, p.y);
  }, { passive: false });
  $('btnZoomIn').addEventListener('click', () => zoomCentre(ZOOM_STEP));
  $('btnZoomOut').addEventListener('click', () => zoomCentre(1 / ZOOM_STEP));
  $('btnFit').addEventListener('click', () => fitView());
  $('btnCanvasMenu').addEventListener('click', () => {
    const menu = $('canvasMenu'), open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    $('btnCanvasMenu').setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (ev) => {
    if($('canvasMenu').classList.contains('hidden')) return;
    if(ev.target.closest && (ev.target.closest('#canvasMenu') || ev.target.closest('#btnCanvasMenu'))) return;
    closeCanvasMenu();
  });
  document.addEventListener('keydown', (ev) => {
    if(!$('confirmBox').classList.contains('hidden')) return;
    if(ev.key === 'Escape'){ closeCard(); closeCanvasMenu(); return; }
    if(!state.vm || (ev.target && /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(ev.target.tagName) && ev.key !== '+' && ev.key !== '-')) return;
    if(ev.key === '+' || ev.key === '='){ zoomCentre(ZOOM_STEP); ev.preventDefault(); }
    else if(ev.key === '-'){ zoomCentre(1 / ZOOM_STEP); ev.preventDefault(); }
    else if(ev.key === '0'){ fitView(); ev.preventDefault(); }
  });
  window.addEventListener('resize', () => { if(state.vm && state.canvasId && !state.views.has(state.canvasId)) fitView(); });
}
