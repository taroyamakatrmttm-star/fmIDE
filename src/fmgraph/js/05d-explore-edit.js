// ============================================================
// Trace and Biggest movers on fmGraph's page: the 🔍 buttons, the note under a traced widget
// (with + Slider), the movers' panel (with + Bar). What reaches what is 05d-explore.js.
// ============================================================

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

function updateMovers(results){
  const panel = $('moversPanel');
  if(!panel || !model || !panel.open || playNow()) return; // waits while Play runs (05m-play.js)
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
    add.addEventListener('click', () => { if(addBar(m.rect.key)) renderBoard(); });
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
