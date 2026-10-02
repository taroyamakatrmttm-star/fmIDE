// ============================================================
// Exploring (G4a).
// - Trace: 🔍 on a bar or chart pins what reaches it. The sliders on the board that reach it
//   light up (the others fade), and a note under its heading says, in words, the way each one
//   gets there ("Price → Revenue → Profit"), and which inputs reach it with no slider yet
//   (+ Slider). 🔍 again, × on the note or Esc clears it. Moving a slider shows that slider's
//   reach meanwhile, as before; the trace comes back when it is still. Worked out from the
//   arrows (model.reach, model.reach.path), like the lighting.
// - Biggest movers: the rectangles whose values the sliders change most, against the model's
//   own numbers (the owner's choice: the dashed outlines' comparison, steady while dragging) —
//   or against A while one is pinned (G4b, 05e-compare.js),
//   from the whole model, not only the board. Ranked by the change in % in the period where it
//   is largest (a rectangle that couldn't be worked out before, or can't now, comes first);
//   inputs left out (the sliders set them). + Bar puts one on the board. Worked out only while
//   the panel is open.
// Nothing here changes the model or the boards (+ Bar and + Slider do, as their buttons).
// ============================================================
const MOVERS_SHOWN = 8;
const TRACE_INPUTS_SHOWN = 12;
let traceId = null;            // the bar or chart traced, or null

function traceButton(w){
  const t = make('button', 'widget-trace', '🔍');
  t.type = 'button';
  const label = 'Trace: what reaches this ' + (w.kind === 'chart' ? 'chart' : 'bar');
  t.title = label;
  t.setAttribute('aria-label', label);
  t.setAttribute('aria-pressed', traceId === w.id ? 'true' : 'false');
  t.addEventListener('click', () => setTrace(traceId === w.id ? null : w.id));
  return t;
}

function setTrace(id){
  traceId = id && board.items.some(w => w.id === id) ? id : null;
  document.querySelectorAll('.widget-trace').forEach(b => {
    const el = b.closest('.widget');
    b.setAttribute('aria-pressed', el && el.dataset.id === traceId ? 'true' : 'false');
  });
  renderTraceNote();
  paintReach();
}

// The keys a bar or chart shows.
function itemKeys(w){ return w.kind === 'chart' ? chartKeys(w) : [w.key]; }

// What reaches a bar or chart: for each slider on the board and each input, the way there.
function traceOf(w, withPaths = true){
  const keys = itemKeys(w).filter(k => model.byKey.has(k));
  // Whether an input reaches it: the reach sets are kept (cheap); the way there is worked out
  // only for the sliders, whose ways are shown.
  const reaches = (from) => { const r = model.reach(from); return keys.some(k => k === from || r.has(k)); };
  const wayTo = (from) => {
    for(const k of keys){ const p = model.reach.path(from, k); if(p) return p; }
    return null;
  };
  const names = (path) => path.filter(k => model.byKey.has(k)).map(k => model.byKey.get(k).name);
  const sliders = [], withSlider = new Set();
  board.sliders.forEach(s => {
    if(!reaches(s.key)) return;
    withSlider.add(s.key);
    if(!withPaths){ sliders.push({ id: s.id, key: s.key }); return; }
    sliders.push({ id: s.id, key: s.key, path: names(wayTo(s.key)) });
  });
  const inputs = withPaths ? model.inputs.filter(r => !withSlider.has(r.key) && reaches(r.key)).map(r => ({ key: r.key, name: r.name, canvas: r.canvasName })) : [];
  return { sliders, inputs };
}

function renderTraceNote(){
  document.querySelectorAll('.trace-note').forEach(n => n.remove());
  if(!traceId || !model) return;
  const w = board.items.find(x => x.id === traceId);
  const el = w && document.querySelector('.widget[data-id="' + traceId + '"]');
  if(!el){ traceId = null; return; }
  const t = traceOf(w);
  const note = make('div', 'trace-note');
  note.setAttribute('role', 'status');
  const head = make('div', 'trace-head');
  head.appendChild(make('strong', null, 'What reaches this'));
  const x = make('button', 'trace-close', '×');
  x.type = 'button';
  x.title = 'Stop tracing (Esc)';
  x.setAttribute('aria-label', 'Stop tracing');
  x.addEventListener('click', () => setTrace(null));
  head.appendChild(x);
  note.appendChild(head);
  if(t.sliders.length){
    const list = make('ul', 'trace-paths');
    t.sliders.forEach(s => {
      const li = make('li');
      li.dataset.slider = s.id;
      li.textContent = s.path.join(' → ');
      list.appendChild(li);
    });
    note.appendChild(list);
  } else {
    note.appendChild(make('p', 'trace-none', board.sliders.length ? 'No slider on this board reaches it.' : 'There are no sliders on this board yet.'));
  }
  if(t.inputs.length){
    note.appendChild(make('p', 'trace-sub', 'Inputs that reach it, with no slider:'));
    const list = make('ul', 'trace-inputs');
    t.inputs.slice(0, TRACE_INPUTS_SHOWN).forEach(r => {
      const li = make('li');
      li.appendChild(make('span', null, r.name));
      li.appendChild(make('span', 'trace-canvas', r.canvas));
      const add = make('button', 'link-btn', '+ Slider');
      add.type = 'button';
      add.title = 'Add a slider on ' + r.name;
      add.disabled = board.sliders.length >= BOARD_LIMIT;
      add.addEventListener('click', () => { if(addSlider(r.key)) renderBoard(); });
      li.appendChild(add);
      list.appendChild(li);
    });
    note.appendChild(list);
    if(t.inputs.length > TRACE_INPUTS_SHOWN) note.appendChild(make('p', 'trace-sub', 'and ' + (t.inputs.length - TRACE_INPUTS_SHOWN) + ' more.'));
  } else if(!t.sliders.length){
    note.appendChild(make('p', 'trace-sub', 'No input reaches it: it is worked out from numbers that are not inputs.'));
  }
  el.querySelector('.widget-head').after(note);
}

// The trace's lighting (paintReach calls it when no slider is being moved): returns false
// when there is nothing traced.
function paintTrace(){
  const w = traceId && board.items.find(x => x.id === traceId);
  if(!w) return false;
  const lit = new Set(traceOf(w, false).sliders.map(s => s.id));
  $('board').classList.add('tracing');
  document.querySelectorAll('.slider-widget').forEach(el => el.classList.toggle('traced', lit.has(el.dataset.id)));
  document.querySelectorAll('#barList > .widget').forEach(el => el.classList.toggle('traced', el.dataset.id === traceId));
  return true;
}
function clearTracePaint(){
  $('board').classList.remove('tracing');
  document.querySelectorAll('.widget.traced').forEach(el => el.classList.remove('traced'));
}

// ---- Biggest movers ----
// Every rectangle that isn't an input, with the period where it changed most (against the
// model's own numbers), largest change in % first. Changes within AGREE_TOLERANCE are none.
function biggestMovers(results, limit){
  const base = compareResults(); // A when pinned (05e-compare.js), else the model's own numbers
  if(results === base) return [];
  const out = [];
  model.rects.forEach(rect => {
    if(rect.input) return;
    let best = null;
    model.periods.forEach((_, p) => {
      const now = resultOf(results, rect, p), was = resultOf(base, rect, p);
      let m = null;
      if(now.error || was.error){
        if(!!now.error !== !!was.error) m = { p, score: Infinity, size: Infinity, now, was };
      } else {
        const d = now.value - was.value, size = Math.abs(d);
        if(size <= AGREE_TOLERANCE * Math.max(Math.abs(now.value), Math.abs(was.value))) return;
        m = { p, score: was.value !== 0 ? size / Math.abs(was.value) : Infinity, size, now, was };
      }
      if(m && (!best || m.score > best.score || (m.score === best.score && m.size > best.size))) best = m;
    });
    if(best) out.push(Object.assign({ rect }, best));
  });
  out.sort((a, b) => (b.score - a.score) || (b.size - a.size) || 0);
  return out.slice(0, limit);
}

// In words: "1,000 → 1,250 (+250, +25%)", or what can't be worked out.
function moverText(m){
  if(m.now.error) return 'was ' + fmtNum(m.was.value) + ', now: ' + errorText(m.now.error);
  if(m.was.error) return 'now ' + fmtNum(m.now.value) + ' (couldn\'t be worked out before)';
  return fmtNum(m.was.value) + ' → ' + fmtNum(m.now.value) + ' (' + fmtDiff(m.now.value, m.was.value) + ')';
}

function updateMovers(results){
  const panel = $('moversPanel');
  if(!panel || !model || !panel.open) return;
  const list = $('moversList');
  const movers = biggestMovers(results, MOVERS_SHOWN);
  list.textContent = '';
  $('moversEmpty').classList.toggle('hidden', movers.length > 0);
  movers.forEach(m => {
    const li = make('li', 'mover');
    li.dataset.key = m.rect.key;
    const top = make('div', 'mover-top');
    top.appendChild(make('span', 'mover-name', m.rect.name));
    top.appendChild(make('span', 'mover-where', m.rect.canvasName + ' · ' + model.periods[m.p]));
    const onBoard = board.bars.some(b => b.key === m.rect.key);
    const add = make('button', 'link-btn', onBoard ? 'On the board' : '+ Bar');
    add.type = 'button';
    add.disabled = onBoard || board.bars.length >= BOARD_LIMIT;
    add.title = onBoard ? 'This board has a bar for it' : 'Show ' + m.rect.name + ' as a bar';
    add.addEventListener('click', () => { if(addBar(m.rect.key, { mode: 'all' })) renderBoard(); });
    top.appendChild(add);
    li.append(top, make('div', 'mover-change ' + (m.now.error || m.was.error ? 'err' : (m.now.value > m.was.value ? 'up' : 'down')), moverText(m)));
    list.appendChild(li);
  });
}

$('moversPanel').addEventListener('toggle', () => { if(model) updateMovers(currentResults()); });
document.addEventListener('keydown', (ev) => {
  if(ev.key !== 'Escape' || !traceId || ev.defaultPrevented) return;
  if(!$('confirmBox').classList.contains('hidden')) return;
  setTrace(null);
});
