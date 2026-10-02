  // =====================================================================================
  // ---------- Zoom (build step 13, phases 13a and 13b; docs/step13-zoom.md) ----------
  // =====================================================================================
  // The canvas is drawn at a scale, from ZOOM_MIN to ZOOM_MAX: #canvas is scaled (CSS
  // transform, set through --zoom on #viewport) inside #canvasZoom, which is sized to the scaled
  // canvas so the viewport scrolls over all of it. Nodes keep their positions in canvas units:
  // every place that turns the pointer into a canvas position goes through canvasPoint() or
  // divides a pointer's movement by zoom, so dragging, arrows, resizing, the selection box and
  // snapping work alike at every zoom. Pickers and popups opened on the canvas are scaled back
  // (--unzoom) so they stay readable.
  // Each canvas keeps its own zoom (canvasZooms, by canvas id), the person's own UI setting
  // (ui.canvasZoom: saved with the autosave, never from an imported file, never in a model file
  // or a Preferences file). A model that comes in (Open, Load System, …) starts at 100%; undo
  // never changes the zoom. Zoom is a view, like scrolling: macros don't record it.
  const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const ZOOM_MIN = 0.25, ZOOM_MAX = 2;
  const ZOOM_MAX_REMEMBERED = 200;
  let zoom = 1;
  let canvasZooms = {}; // canvas id → its zoom (absent: 100%)

  function clampZoom(z){
    const n = Number(z);
    if(!isFinite(n)) return 1;
    return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n)) * 1000) / 1000;
  }
  // Saved zooms (the autosave's ui.canvasZoom): canvas ids and zooms in range, at most 200.
  function cleanCanvasZooms(v){
    const out = {};
    if(!v || typeof v !== 'object' || Array.isArray(v)) return out;
    Object.keys(v).slice(0, ZOOM_MAX_REMEMBERED).forEach(id => {
      const n = Number(v[id]);
      if(typeof id === 'string' && id.length <= 64 && isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX && n !== 1) out[id] = clampZoom(n);
    });
    return out;
  }
  function zoomText(z){ return Math.round((z === undefined ? zoom : z) * 100) + '%'; }

  // A pointer position (client coordinates) as a position on the canvas, in canvas units.
  function canvasPoint(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
  }
  // The middle of what is in view, in canvas units.
  function viewCentre(){
    return { x: (viewport.scrollLeft + viewport.clientWidth / 2) / zoom, y: (viewport.scrollTop + viewport.clientHeight / 2) / zoom };
  }
  // What is in view, in canvas units.
  function viewRect(){
    return { x: viewport.scrollLeft / zoom, y: viewport.scrollTop / zoom, w: viewport.clientWidth / zoom, h: viewport.clientHeight / zoom };
  }

  // Draws the canvas at z (no saving): the scale, the scrolling area and the control.
  function showZoom(z){
    zoom = clampZoom(z);
    viewport.style.setProperty('--zoom', String(zoom));
    viewport.style.setProperty('--unzoom', String(1 / zoom));
    viewport.classList.toggle('zoomed', zoom !== 1);
    renderZoomControl();
  }
  // Sets the zoom, keeping the canvas point under (clientX, clientY) — the middle of the view
  // when none is given — where it is on the screen.
  function setZoom(z, clientX, clientY){
    const next = clampZoom(z);
    const vr = viewport.getBoundingClientRect();
    const ax = clientX === undefined ? viewport.clientWidth / 2 : clientX - vr.left;
    const ay = clientY === undefined ? viewport.clientHeight / 2 : clientY - vr.top;
    const px = (viewport.scrollLeft + ax) / zoom, py = (viewport.scrollTop + ay) / zoom;
    showZoom(next);
    viewport.scrollLeft = Math.max(0, px * zoom - ax);
    viewport.scrollTop = Math.max(0, py * zoom - ay);
    rememberZoom();
    return zoom;
  }
  function rememberZoom(){
    if(!activeCanvasId) return;
    if(zoom === 1) delete canvasZooms[activeCanvasId];
    else canvasZooms[activeCanvasId] = zoom;
    saveWorkspaceSoon();
  }
  // The canvas being shown changed (loadCanvasState): its own zoom.
  function showZoomOfCanvas(id){
    const z = canvasZooms[id] || 1;
    if(z !== zoom) showZoom(z);
  }
  // A model came in (applySystemDataDirect): every canvas starts at 100%.
  function forgetCanvasZooms(){ canvasZooms = {}; }

  function nextZoomStep(dir){
    const eps = 0.001;
    if(dir > 0) return ZOOM_STEPS.find(s => s > zoom + eps) || ZOOM_MAX;
    return ZOOM_STEPS.slice().reverse().find(s => s < zoom - eps) || ZOOM_MIN;
  }
  function zoomIn(){ return setZoom(nextZoomStep(1)); }
  function zoomOut(){ return setZoom(nextZoomStep(-1)); }
  function zoomReset(){ return setZoom(1); }

  // Shows the box (canvas units) as large as fits, with a margin, centred.
  function zoomToBox(b){
    const margin = 40;
    const z = clampZoom(Math.min((viewport.clientWidth - 2 * margin) / Math.max(1, b.w), (viewport.clientHeight - 2 * margin) / Math.max(1, b.h), ZOOM_MAX));
    showZoom(z);
    viewport.scrollLeft = Math.max(0, (b.x + b.w / 2) * zoom - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, (b.y + b.h / 2) * zoom - viewport.clientHeight / 2);
    rememberZoom();
    return zoom;
  }
  function boxOfNodes(list){
    if(!list.length) return null;
    const x = Math.min(...list.map(n => n.x)), y = Math.min(...list.map(n => n.y));
    const r = Math.max(...list.map(n => n.x + n.w)), b = Math.max(...list.map(n => n.y + n.h));
    return { x, y, w: r - x, h: b - y };
  }
  // Every node on this canvas in view (an empty canvas: 100%).
  function zoomToFit(){
    const b = boxOfNodes(nodes);
    if(!b){ viewport.scrollLeft = 0; viewport.scrollTop = 0; return setZoom(1); }
    return zoomToBox(b);
  }
  function zoomToSelection(){
    const b = boxOfNodes(nodes.filter(n => selectedNodeIds.has(n.id)));
    if(!b) return zoom;
    return zoomToBox(b);
  }

  // Ctrl (Cmd on a Mac) + the wheel, or a trackpad's pinch (which the browser sends as a wheel
  // with Ctrl): zoom around the pointer, smoothly. A plain wheel scrolls, as before.
  viewport.addEventListener('wheel', (ev) => {
    if(!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    const factor = Math.exp(-Math.max(-100, Math.min(100, dy)) * 0.0025);
    setZoom(zoom * factor, ev.clientX, ev.clientY);
  }, { passive: false });

  // ---------- two fingers on a tablet (phase 13b) ----------
  // Two fingers on the canvas pinch to zoom around the point between them, and moving them
  // together moves the canvas. A drag the first finger had begun is cancelled and undone
  // (cancelFingerActions, shared pointer input). A pinch ending within 5% of 100% settles at
  // 100%. Scrolling can only be stopped from touchmove, so the pinch follows touch events: while
  // the browser lets us cancel them, it moves the canvas itself; once the browser has started
  // scrolling (the first finger moved before the second landed), the browser moves it and the
  // pinch only zooms around the point between the fingers. One finger is as before (step 9).
  const PINCH_SNAP_TO_100 = 0.05;
  let pinch = null; // { a, b: touch identifiers, d0, z0, mid }
  function pinchTouches(ev){
    if(!pinch) return null;
    const list = Array.from(ev.touches);
    const a = list.find(t => t.identifier === pinch.a), b = list.find(t => t.identifier === pinch.b);
    return a && b ? [a, b] : null;
  }
  const fingerGap = (a, b) => Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY));
  const fingerMid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
  // Shows zoom z with the canvas point under client point `from` moved to client point `to`.
  function zoomMoving(z, from, to){
    const vr = viewport.getBoundingClientRect();
    const px = (viewport.scrollLeft + from.x - vr.left) / zoom, py = (viewport.scrollTop + from.y - vr.top) / zoom;
    showZoom(z);
    viewport.scrollLeft = Math.max(0, px * zoom - (to.x - vr.left));
    viewport.scrollTop = Math.max(0, py * zoom - (to.y - vr.top));
  }
  viewport.addEventListener('touchstart', (ev) => {
    if(pinch || ev.touches.length !== 2) return;
    const [a, b] = Array.from(ev.touches);
    if(!viewport.contains(a.target) || !viewport.contains(b.target)) return;
    cancelFingerActions();
    closeZoomMenu();
    pinch = { a: a.identifier, b: b.identifier, d0: fingerGap(a, b), z0: zoom, mid: fingerMid(a, b) };
    if(ev.cancelable) ev.preventDefault();
  }, { passive: false });
  // Followed on the document: a finger's events keep going to the element it went down on, which
  // a redraw may have taken out of the page.
  document.addEventListener('touchmove', (ev) => {
    const t = pinchTouches(ev);
    if(!t) return;
    const ours = ev.cancelable;
    if(ours) ev.preventDefault();
    const mid = fingerMid(t[0], t[1]);
    zoomMoving(pinch.z0 * fingerGap(t[0], t[1]) / pinch.d0, ours ? pinch.mid : mid, mid);
    pinch.mid = mid;
  }, { passive: false });
  function endPinch(ev){
    if(!pinch || pinchTouches(ev)) return;
    if(zoom !== 1 && Math.abs(zoom - 1) < PINCH_SNAP_TO_100) zoomMoving(1, pinch.mid, pinch.mid);
    pinch = null;
    rememberZoom();
  }
  document.addEventListener('touchend', endPinch);
  document.addEventListener('touchcancel', endPinch);

  // ---------- the zoom control, bottom-right of the canvas ----------
  let zoomControl = null;
  function buildZoomControl(){
    zoomControl = el('div', 'zoom-control');
    zoomControl.id = 'zoomControl';
    const minus = el('button', 'zoom-out', '−');
    minus.type = 'button';
    minus.title = 'Zoom out';
    minus.addEventListener('click', () => runCommand('zoomOut'));
    const level = el('button', 'zoom-level', '100%');
    level.type = 'button';
    level.title = 'Zoom: choose a level, fit the model or the selection';
    level.addEventListener('click', (ev) => { ev.stopPropagation(); toggleZoomMenu(); });
    const plus = el('button', 'zoom-in', '+');
    plus.type = 'button';
    plus.title = 'Zoom in';
    plus.addEventListener('click', () => runCommand('zoomIn'));
    zoomControl.append(minus, level, plus);
    document.body.appendChild(zoomControl);
  }
  function renderZoomControl(){
    if(!zoomControl) return;
    zoomControl.querySelector('.zoom-level').textContent = zoomText();
    zoomControl.querySelector('.zoom-out').disabled = zoom <= ZOOM_MIN + 0.0001;
    zoomControl.querySelector('.zoom-in').disabled = zoom >= ZOOM_MAX - 0.0001;
  }
  function closeZoomMenu(){ const m = document.getElementById('zoomMenu'); if(m) m.remove(); }
  function toggleZoomMenu(){
    if(document.getElementById('zoomMenu')){ closeZoomMenu(); return; }
    const menu = el('div', 'zoom-menu');
    menu.id = 'zoomMenu';
    const item = (text, fn, current) => {
      const b = el('button', current ? 'current' : '', text);
      b.type = 'button';
      b.addEventListener('click', () => { closeZoomMenu(); fn(); });
      menu.appendChild(b);
      return b;
    };
    item('Fit the model', () => runCommand('zoomFit'));
    const sel = item('Fit the selection', () => runCommand('zoomSelection'));
    sel.disabled = !selectedNodeIds.size;
    menu.appendChild(el('hr'));
    ZOOM_STEPS.slice().reverse().forEach(s => item(zoomText(s), () => setZoom(s), Math.abs(s - zoom) < 0.001));
    document.body.appendChild(menu);
    const close = (ev) => { if(!menu.contains(ev.target)){ closeZoomMenu(); document.removeEventListener('mousedown', close, true); } };
    document.addEventListener('mousedown', close, true);
  }
  buildZoomControl();
