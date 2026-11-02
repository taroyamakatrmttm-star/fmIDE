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
// - Stopping: only ■ Stop, Esc, a slider moved (a deliberate change) or another model (the owner's
//   request of 27 October 2026). Scrolling, a tap or press, a key, opening a panel, Edit chart
//   and another board leave it playing: Play moves the model's inputs, not one board's sliders,
//   so the board now shown is painted (playFrame notices a redraw). Everything is then as it
//   was: nothing is saved, no undo step, nothing in the file.
// - Reduced motion: no constant motion — the board shows the "to" end against the "from" end's
//   outlines, and ⇄ on the strip steps between the two. Unless this device's own choice says to
//   animate Play anyway (playMotionAnyway, the owner's request of 2 November 2026: Remote Desktop
//   or a thin client often asks for reduced motion when the person wants the motion): ▶ Animate
//   beside ⇄ on the strip (and in the full screen's) turns it on and plays again, moving; ⇄ Still
//   there turns it off. setPlayMotion(on, quiet) sets it; the page keeps it on the device
//   (rememberPlayMotion, part of the page interface) and reads it back with quiet set. Off until
//   chosen, so reduced motion is respected unless the person asks.
// ============================================================
const PLAY_SWING_MS = 2000;
const PLAY_PAUSE_MS = 600;
const PLAY_POSITIONS = 60;      // positions per swing (and one more: both ends)
const PLAY_MIN_POSITIONS = 12;
const PLAY_AHEAD_MS = 3000;     // a slow model has fewer positions, worked out within about this

let playChoice = { from: null, to: null, picked: false }; // 'model', 'sliders' or 'sc:' + name; until the page reloads
let playing = null;
let playMotionAnyway = false; // animate Play even when the device asks for reduced motion (this device's choice)

// The device asks for reduced motion (05e-compare.js); Play then stands still unless chosen otherwise.
const motionReduced = () => !!(reducedMotion && reducedMotion.matches);
const playStill = () => motionReduced() && !playMotionAnyway;
// The words on ▶ Animate (still) and ⇄ Still (moving), on the strip and in the full screen.
function playMotionTitle(still){
  return still ? 'This device asks for less motion, so Play shows the two ends still. Animate Play anyway (remembered in this browser)'
    : 'Show Play still again, as this device asks for less motion (remembered in this browser)';
}
// Sets the choice; a play running plays again between the same ends, still or moving.
// quiet: not remembered (the page reading it back). Returns the choice.
function setPlayMotion(on, quiet){
  playMotionAnyway = !!on;
  if(!quiet) rememberPlayMotion(playMotionAnyway);
  if(playing && playing.still !== playStill()){
    const me = playing;
    startPlay(me.from.id, me.to.id, { swingMs: me.swingMs, pauseMs: me.pauseMs });
  }
  if(showing) syncShowStrip(); // (05gs-show.js)
  return playMotionAnyway;
}

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

// The n + 1 positions of a swing, f of the way: spaced by a cosine (slow at the ends), exact at
// both (also the GIF's, 05o-play-gif.js).
function playFractions(n){
  const out = [];
  for(let i = 0; i <= n; i++) out.push(i === 0 ? 0 : i === n ? 1 : (1 - Math.cos(Math.PI * i / n)) / 2);
  return out;
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
  const fractions = playFractions(n);
  const me = playing = {
    model, board, from: a, to: b, fractions, positions: fractions.map(f => overridesAt(pairs, f)),
    moving: pairs.filter(p => p.moves).map(p => p.key),
    swingMs: Number.isFinite(opts.swingMs) ? Math.max(200, Math.min(60000, opts.swingMs)) : PLAY_SWING_MS,
    pauseMs: Number.isFinite(opts.pauseMs) ? Math.max(0, Math.min(10000, opts.pauseMs)) : PLAY_PAUSE_MS,
    still: playStill(),
    sliders: sliderPositions(), painted: null, index: -1, startedAt: null, runs: 0, ready: false, raf: 0,
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
// Where every slider on every board stands (id → value): a slider moved stops the play; one
// added or removed does not.
function sliderPositions(){
  syncShared(); // (03-calc.js) so a board shown for the first time takes the shared positions first
  const out = new Map();
  boards.forEach(b => b.sliders.forEach(s => out.set(s.id, s.value)));
  return out;
}
function sliderMoved(){
  const now = sliderPositions();
  const moved = [...now].some(([id, v]) => playing.sliders.has(id) && !Object.is(playing.sliders.get(id), v));
  playing.sliders = now;
  return moved;
}
function playFrame(now){
  if(!playing) return;
  if(playing.model !== model || !model || !board || sliderMoved()){ stopPlay(); return; }
  playing.raf = requestAnimationFrame(playFrame);
  const mark = paintMark(), redrawn = !playing.painted || mark.some((x, i) => x !== playing.painted[i]);
  if(playing.still || !playing.ready){ if(redrawn && playing.index >= 0) showPlayPosition(playing.index); return; }
  if(playing.startedAt === null) playing.startedAt = now;
  const i = playIndexAt(now - playing.startedAt);
  if(i !== playing.index || redrawn) showPlayPosition(i);
}
function showPlayPosition(i){
  const me = playing, o = me.positions[i], from = me.positions[0];
  [o, from].forEach(x => { if(!resultCache.has(overridesKey(x))) me.runs++; });
  me.index = i;
  playAt = { model, now: o, from }; // (03-calc.js)
  updateValues();
  paintPlay(me.fractions[i]);
  me.painted = paintMark();
}

function playWords(){
  if(!playing) return null;
  return playing.still ? 'Showing ' + playing.to.name + ' against ' + playing.from.name : 'Playing ' + playing.from.name + ' ⇄ ' + playing.to.name;
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
