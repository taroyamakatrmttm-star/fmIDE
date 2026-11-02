// ============================================================
// Play on fmGraph's page: the row under the scenarios, the strip, its sliders, dock and mixer
// painted as it plays, Esc. The motion and its clock are 05m-play.js, the board engine's.
// ============================================================

// What the play last painted: the board and its first widgets, so a redraw (another board, a
// panel, Edit chart) is painted again.
const paintMark = () => [board, $('sliderList').firstElementChild, $('barList').firstElementChild];

// The sliders, the dock, the mixer, the reach and the strip, f of the way.
function paintPlay(f){
  board.sliders.forEach(s => {
    const a = endSliderValue(playing.from.settings, s), b = endSliderValue(playing.to.settings, s);
    let v = mixAt(a, b, f);
    if(f !== 0 && f !== 1) v = roundToStep(v, s.step);
    // Its row on the board, and beside the full screen (05gs-show.js).
    document.querySelectorAll('.slider-widget[data-id="' + s.id + '"]').forEach(row => row.classList.toggle('playing', !Object.is(a, b)));
    const el = document.querySelector('#sliderList .slider-widget[data-id="' + s.id + '"]');
    if(el){
      const range = el.querySelector('input[type="range"]'), box = el.querySelector('.slider-value');
      if(range) range.value = String(v); // a short row has none: updateLines below
      if(box) box.value = String(v);
    }
    [dockControls.get(s.id), mixerControls.get(s.id)].forEach(c => { if(c && !c.dragging()) c.setValue(v); }); // (05g, 05h)
  });
  updateLines((s) => { // the short rows: at their minimum, and beside the full screen (05c-arrange.js)
    const a = endSliderValue(playing.from.settings, s), b = endSliderValue(playing.to.settings, s);
    const v = mixAt(a, b, f);
    return f !== 0 && f !== 1 ? roundToStep(v, s.step) : v;
  });
  const reached = new Set(playing.moving);
  playing.moving.forEach(k => model.reach(k).forEach(r => reached.add(r)));
  $('board').classList.add('moving');
  board.bars.forEach(b => { const el = document.querySelector('.bar-widget[data-id="' + b.id + '"]'); if(el) el.classList.toggle('reached', reached.has(b.key)); });
  board.charts.forEach(c => {
    const el = document.querySelector('.chart-widget[data-id="' + c.id + '"]');
    if(!el) return;
    el.classList.toggle('reached', chartKeys(c).some(k => reached.has(k)));
    el.classList.toggle('play-held', isSensitivity(c));
  });
  const at = $('playAt');
  if(at) at.textContent = settingsLabel(movingSettings(f));
}

function renderPlayBar(){
  const bar = $('playBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !playing);
  if(!playing) return;
  const text = make('span', 'play-text');
  const words = make('strong', 'play-words');
  words.setAttribute('aria-live', 'polite');
  if(playing.still){
    const at = playing.index === 0 ? playing.from : playing.to, other = playing.index === 0 ? playing.to : playing.from;
    words.textContent = 'Showing ' + at.name + '; the outlines show ' + playing.from.name;
    text.title = 'Reduced motion is on: ⇄ steps between ' + at.name + ' and ' + other.name;
  } else words.textContent = playWords();
  text.appendChild(words);
  const now = make('span', 'play-at');
  now.id = 'playAt';
  text.appendChild(now);
  bar.appendChild(text);
  const button = (label, title, fn) => { const b = make('button', 'compare-btn', label); b.type = 'button'; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); return b; };
  if(playing.still) button('⇄', 'Step to the other end', () => stepPlay()).id = 'btnPlayStep';
  // The device asks for less motion: animate anyway, or back to still (05m-play.js).
  if(motionReduced()) button(playing.still ? '▶ Animate' : '⇄ Still', playMotionTitle(playing.still), () => setPlayMotion(!playMotionAnyway)).id = 'btnPlayMotion';
  button('■ Stop', 'Stop playing: everything goes back as it was', () => stopPlay()).id = 'btnPlayStop';
}

// Animate Play even with reduced motion: this browser's choice (the board engine's setPlayMotion).
const PLAY_MOTION_KEY = 'fmgraph-play-motion';
function rememberPlayMotion(on){ store.put(PLAY_MOTION_KEY, on ? 'on' : 'off').catch(() => {}); }
store.ready.then(() => store.get(PLAY_MOTION_KEY)).then(raw => {
  if(raw === 'on' || raw === 'off') setPlayMotion(raw === 'on', true);
}, () => {});

// ---- the row under the scenarios ----
function renderPlayRow(){
  const options = playOptions(), ids = options.map(o => o[0]), def = playDefaults();
  // The defaults follow the scenarios until the person picks an end.
  if(!playChoice.picked || !ids.includes(playChoice.from)) playChoice.from = def.from;
  if(!playChoice.picked || !ids.includes(playChoice.to)) playChoice.to = def.to;
  [['playFrom', 'from'], ['playTo', 'to']].forEach(([id, end]) => {
    const sel = $(id);
    sel.textContent = '';
    options.forEach(([v, words]) => { const o = make('option', null, words); o.value = v; sel.appendChild(o); });
    sel.value = playChoice[end];
  });
}

$('playFrom').addEventListener('change', () => { playChoice.from = $('playFrom').value; playChoice.picked = true; });
$('playTo').addEventListener('change', () => { playChoice.to = $('playTo').value; playChoice.picked = true; });
$('btnPlay').addEventListener('click', () => startPlay(playChoice.from, playChoice.to));

// Esc stops it (and does only that); a press, a scroll or another key leaves it playing.
document.addEventListener('keydown', (ev) => {
  if(!playing || ev.key !== 'Escape') return;
  ev.preventDefault(); ev.stopPropagation(); stopPlay();
}, true);
