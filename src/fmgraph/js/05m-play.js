// ============================================================
// Play (the owner's idea of 26 October 2026): the model swings between two ends and back, like
// a pendulum, until it is stopped — so a change can be seen as it happens. Each end is a
// scenario, the model's own numbers, or where the sliders are now (the row under the Scenarios
// panel: Play from [▾] to [▾] ▶ Play).
// - The motion: each end gives a number per input and period (overridesFor); the play moves
//   each number in a straight line from one end's to the other's, so a set slider, a change by
//   %, several sliders, sliders over different periods and inputs with no slider on this board
//   all move together, and each end is exact. The time follows a pendulum (slow at the ends,
//   quickest in the middle): PLAY_POSITIONS positions per swing, spaced by a cosine, shown in
//   turn over PLAY_SWING_MS, PLAY_PAUSE_MS still at each end.
// - Meanwhile the sliders show where the play has them (what each is set to is never changed),
//   the dock and the mixer on a phone too, and the bars the moving inputs reach are lit; the
//   dashed outlines and differences measure from the "from" end (compareResults, 05e); the
//   Tornado and Spider hold still at the "from" end, faded (sensitivityNow, 03-calc.js), and
//   Biggest movers waits (05d); the strip #playBar says what plays and where it is.
// - Cost: the positions are the same every swing, so each is worked out once (resultCache); on
//   a slow model (SLOW_MS) all are worked out ahead in small pieces ("Working out the play…"),
//   fewer of them when that would take longer than PLAY_AHEAD_MS — the bars then glide between.
// - Stopping: ■ Stop, Esc, any key or press outside the strip, a slider moved, another board or
//   model. Everything is then as it was: nothing is saved, no undo step, nothing in the file.
// - Reduced motion: no constant motion — the board shows the "to" end against the "from" end's
//   outlines, and ⇄ on the strip steps between the two.
// ============================================================
const PLAY_SWING_MS = 2000;
const PLAY_PAUSE_MS = 600;
const PLAY_POSITIONS = 60;      // positions per swing (and one more: both ends)
const PLAY_MIN_POSITIONS = 12;
const PLAY_AHEAD_MS = 3000;     // a slow model has fewer positions, worked out within about this
let playChoice = { from: null, to: null, picked: false }; // 'model', 'sliders' or 'sc:' + name; until the page reloads
let playing = null;

// The ends offered: [id, words].
function playOptions(){
  return [['model', 'The model\'s own numbers'], ['sliders', 'The sliders now']].concat(scenarios.map(sc => ['sc:' + sc.name, sc.name]));
}
function playDefaults(){
  if(scenarios.length >= 2) return { from: 'sc:' + scenarios[0].name, to: 'sc:' + scenarios[1].name };
  if(scenarios.length === 1) return { from: 'model', to: 'sc:' + scenarios[0].name };
  return { from: 'model', to: 'sliders' };
}
// An end: its words and settings ({ key, mode, periods, value }, as a scenario's), or null.
function playEnd(id){
  if(id === 'model') return { id, name: 'the model\'s own numbers', settings: [] };
  if(id === 'sliders') return { id, name: 'the sliders now', settings: slidersNow() };
  const sc = scenarios.find(s => 'sc:' + s.name === id);
  return sc ? { id, name: '“' + sc.name + '”', settings: sc.settings.map(s => Object.assign({}, s, { periods: Object.assign({}, s.periods) })) } : null;
}

// Between two ends' numbers: per input, both ends' numbers per period (the model's own where an
// end leaves it), and whether they differ.
function playPairs(a, b){
  return [...new Set([...a.keys(), ...b.keys()])].map(k => {
    const rect = model.byKey.get(k), own = model.periods.map((_, p) => baseValue(rect, p));
    const x = a.get(k) || own, y = b.get(k) || own;
    return { key: k, x, y, moves: x.some((v, p) => !Object.is(v, y[p])) };
  });
}
// f of the way from x to y; exact at both ends, and a number the ends share stays exact.
function mixAt(x, y, f){ return Object.is(x, y) ? x : Number.isFinite(x) && Number.isFinite(y) ? (1 - f) * x + f * y : (f < 0.5 ? x : y); }
function overridesAt(pairs, f){
  const out = new Map();
  pairs.forEach(pr => out.set(pr.key, pr.x.map((v, p) => mixAt(v, pr.y[p], f))));
  return out;
}

// Where a slider stands at an end: the end's setting like it, or the model's own number.
function endSliderValue(settings, s){
  const k = settingKey(s), o = settings.find(x => settingKey(x) === k);
  if(o) return o.value;
  return s.mode === 'shift' ? 0 : baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
}
// The settings that differ between the ends, f of the way (for the strip's words).
function movingSettings(f){
  const all = [], seen = new Set();
  playing.from.settings.concat(playing.to.settings).forEach(s => { const k = settingKey(s); if(!seen.has(k)){ seen.add(k); all.push(s); } });
  return all.map(s => {
    const a = endSliderValue(playing.from.settings, s), b = endSliderValue(playing.to.settings, s);
    if(Object.is(a, b)) return null;
    const v = mixAt(a, b, f);
    return Object.assign({}, s, { value: f === 0 || f === 1 ? v : Number(v.toPrecision(4)) });
  }).filter(Boolean);
}

// Starts playing between two ends (ids as playOptions). Returns the strip's words, or null.
function startPlay(fromId, toId, opts){
  if(!model || !board) return null;
  if(playing) stopPlay();
  const a = playEnd(fromId), b = playEnd(toId);
  if(!a || !b) return null;
  const pairs = playPairs(overridesFor(a.settings), overridesFor(b.settings));
  if(!pairs.some(p => p.moves)){ notify('From and to give the same numbers: there is nothing to play.', 'err', 'play'); return null; }
  notify('', null, 'play');
  opts = opts || {};
  const per = Math.max(model.baseMs, 0.01);
  const n = per * (PLAY_POSITIONS + 1) > PLAY_AHEAD_MS ? Math.max(PLAY_MIN_POSITIONS, Math.floor(PLAY_AHEAD_MS / per) - 1) : PLAY_POSITIONS;
  const fractions = [];
  for(let i = 0; i <= n; i++) fractions.push(i === 0 ? 0 : i === n ? 1 : (1 - Math.cos(Math.PI * i / n)) / 2);
  const me = playing = {
    model, board, from: a, to: b, fractions, positions: fractions.map(f => overridesAt(pairs, f)),
    moving: pairs.filter(p => p.moves).map(p => p.key),
    swingMs: Number.isFinite(opts.swingMs) ? Math.max(200, Math.min(60000, opts.swingMs)) : PLAY_SWING_MS,
    pauseMs: Number.isFinite(opts.pauseMs) ? Math.max(0, Math.min(10000, opts.pauseMs)) : PLAY_PAUSE_MS,
    still: !!(reducedMotion && reducedMotion.matches), // (05e-compare.js)
    sliders: JSON.stringify(slidersNow()), index: -1, startedAt: null, runs: 0, ready: false, raf: 0,
    wake: keepScreenOn(),
  };
  document.body.classList.add('playing');
  renderPlayBar();
  if(isPhone()) $('playBar').scrollIntoView({ block: 'nearest' });
  if(me.still){ me.ready = true; showPlayPosition(n); }
  else if(model.baseMs >= SLOW_MS){
    // A slow model: every position worked out ahead, in small pieces.
    const todo = me.positions.slice();
    setCalcNote('Working out the play…');
    const piece = () => {
      if(playing !== me) return;
      const until = performance.now() + 30;
      while(todo.length && performance.now() < until){
        const o = todo.shift();
        if(!resultCache.has(overridesKey(o))) me.runs++;
        resultsWith(o);
      }
      if(todo.length){ setTimeout(piece, 0); return; }
      setCalcNote('');
      me.ready = true;
    };
    showPlayPosition(0);
    setTimeout(piece, 0);
  } else me.ready = true;
  me.raf = requestAnimationFrame(playFrame);
  return playWords();
}

// The position shown at t ms after the play began: still, up, still, down.
function playIndexAt(t){
  const P = playing.pauseMs, S = playing.swingMs, n = playing.fractions.length - 1;
  t = t % (2 * (P + S));
  if(t < P) return 0;
  if(t < P + S) return Math.min(n, Math.round((t - P) / S * n));
  if(t < 2 * P + S) return n;
  return Math.max(0, n - Math.round((t - 2 * P - S) / S * n));
}
function playFrame(now){
  if(!playing) return;
  if(playing.model !== model || playing.board !== board || !model || JSON.stringify(slidersNow()) !== playing.sliders){ stopPlay(); return; }
  playing.raf = requestAnimationFrame(playFrame);
  if(!playing.ready || playing.still) return;
  if(playing.startedAt === null) playing.startedAt = now;
  const i = playIndexAt(now - playing.startedAt);
  if(i !== playing.index) showPlayPosition(i);
}
function showPlayPosition(i){
  const me = playing, o = me.positions[i], from = me.positions[0];
  [o, from].forEach(x => { if(!resultCache.has(overridesKey(x))) me.runs++; });
  me.index = i;
  playAt = { model, now: o, from }; // (03-calc.js)
  updateValues();
  paintPlay(me.fractions[i]);
}

// The sliders, the dock, the mixer, the reach and the strip, f of the way.
function paintPlay(f){
  board.sliders.forEach(s => {
    const a = endSliderValue(playing.from.settings, s), b = endSliderValue(playing.to.settings, s);
    let v = mixAt(a, b, f);
    if(f !== 0 && f !== 1) v = roundToStep(v, s.step);
    const el = document.querySelector('.slider-widget[data-id="' + s.id + '"]');
    if(el){
      el.classList.toggle('playing', !Object.is(a, b));
      el.querySelector('input[type="range"]').value = String(v);
      el.querySelector('.slider-value').value = String(v);
    }
    [dockControls.get(s.id), mixerControls.get(s.id)].forEach(c => { if(c && !c.dragging()) c.setValue(v); }); // (05g, 05h)
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

function playWords(){
  if(!playing) return null;
  return playing.still ? 'Showing ' + playing.to.name + ' against ' + playing.from.name : 'Playing ' + playing.from.name + ' ⇄ ' + playing.to.name;
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
  button('■ Stop', 'Stop playing: everything goes back as it was', () => stopPlay()).id = 'btnPlayStop';
}
// Reduced motion: ⇄ shows the other end.
function stepPlay(){
  if(!playing || !playing.still) return false;
  showPlayPosition(playing.index === 0 ? playing.fractions.length - 1 : 0);
  renderPlayBar();
  paintPlay(playing.fractions[playing.index]);
  return true;
}

// Stops the play: the sliders, A and the outlines are as they were (nothing was changed).
function stopPlay(){
  if(!playing) return false;
  const me = playing;
  cancelAnimationFrame(me.raf);
  if(me.wake) me.wake();
  playing = null;
  playAt = null;
  setCalcNote('');
  document.body.classList.remove('playing');
  renderPlayBar();
  if(model && board) renderBoard();
  return true;
}

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

// Any press outside the strip, or any key, stops it (Esc only that).
document.addEventListener('pointerdown', (ev) => { if(playing && !(ev.target.closest && ev.target.closest('#playBar'))) stopPlay(); }, true);
document.addEventListener('keydown', (ev) => {
  if(!playing) return;
  if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); stopPlay(); return; }
  if(ev.target.closest && ev.target.closest('#playBar')) return;
  stopPlay();
}, true);
