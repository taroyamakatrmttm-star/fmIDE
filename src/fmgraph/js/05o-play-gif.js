// ============================================================
// A GIF of the play (the owner's idea of 27 October 2026: "can GIF file be generated for "Play"
// for selected graph(s)?"): 🎞 GIF in the full screen's strip makes an animated GIF of what it
// shows, and 🎞 on a bar's or chart's header one of that one alone, playing between the ends
// chosen under Scenarios (Play's own: playChoice, 05m-play.js), so it can be put in a message,
// a slide or a document.
// - Frames: one full swing there and back at about GIF_FPS frames a second — Play's own
//   positions (playFractions, every other of PLAY_POSITIONS, so a play already watched has them
//   worked out in resultCache), each end held PLAY_PAUSE_MS. Each is drawn off the page (the
//   stage, #gifStage) exactly as the board draws it — playAt set only while drawing, so the
//   page itself never shows the GIF's positions — and turned to pixels as ⇪ Share does
//   (svgPicture, 05i-phone-share.js: works from a file opened from disk and on an iPad), GIF_W
//   pixels wide, the rectangles' edges crisp (fewer colours: the chart colours stay exact more
//   often; the writer keeps 255 by median cut beyond). The swing back reuses the frames there.
// - The page stays free: a frame at a time, then a pause; #gifProgress says how far it is
//   ("Making the GIF… 40%") with Cancel. Over GIF_MAX_BYTES it stops and says so.
// - Then the share sheet where files can be shared (an iPad: Save to Files, Photos, Messages),
//   else a download, fmGraph-<the chart's or the board's name>.gif. Nothing is saved with the
//   board, no undo step, no board file change.
// ============================================================
// The animated-GIF writer (makeGif, GIF_LIMITS).
// build:include shared/gif.js

const GIF_W = 720;                  // pixels across
const GIF_FPS = 15;                 // about this many frames a second while it swings
const GIF_MAX_BYTES = 10 * 1024 * 1024;
const GIF_PAD = 20;
const GIF_GAP = 16;
let gifMaking = null;               // while a GIF is made: { model, positions, cancelled }

// The frames' positions: indexes into playFractions(PLAY_POSITIONS), one swing, both ends included.
function gifSwingIndexes(){
  const k = Math.max(2, Math.round(PLAY_SWING_MS / 1000 * GIF_FPS));
  const out = [];
  for(let j = 0; j <= k; j++) out.push(Math.round(j * PLAY_POSITIONS / k));
  return out;
}
// The order the frames are shown in: there (0 … k), and back (k − 1 … 1); then it loops.
function gifOrder(k){
  const out = [];
  for(let j = 0; j <= k; j++) out.push(j);
  for(let j = k - 1; j >= 1; j--) out.push(j);
  return out;
}

// Makes the GIF of the play for the board's widgets ids. Resolves { bytes, blob, name, frames,
// width, height, ms, colours }, or { problem: words } (nothing to play, too large, cancelled,
// another model), never throws for those.
async function makePlayGif(ids, opts){
  opts = opts || {};
  if(!model || !board) return { problem: 'Open a model first.' };
  if(gifMaking) return { problem: 'A GIF is being made already.' };
  const list = board.items.filter(w => ids.includes(w.id));
  if(!list.length) return { problem: 'Choose a bar or chart for the GIF.' };
  // The ends: those playing now, else those chosen under Scenarios.
  let fromId, toId;
  if(playing){ fromId = playing.from.id; toId = playing.to.id; stopPlay(); }
  else { renderPlayRow(); fromId = playChoice.from; toId = playChoice.to; }
  const a = playEnd(fromId), b = playEnd(toId);
  const pairs = a && b ? playPairs(overridesFor(a.settings), overridesFor(b.settings)) : [];
  if(!pairs.some(p => p.moves)) return { problem: 'Nothing to play: choose two different ends under Scenarios.' };
  const fractions = playFractions(PLAY_POSITIONS), indexes = gifSwingIndexes();
  const positions = indexes.map(i => overridesAt(pairs, fractions[i]));
  const maxBytes = Number.isFinite(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : GIF_MAX_BYTES;
  const title = list.length > 1 ? board.name : widgetName(list[0]); // (05i-phone-share.js)
  const me = gifMaking = { model, board, positions, cancelled: false };
  const started = performance.now();
  const stage = gifStage(list);
  showGifProgress(0);
  try{
    const shots = [];
    let height = 0;
    for(let k = 0; k < positions.length; k++){
      if(me.cancelled) return { problem: 'The GIF was cancelled.', cancelled: true };
      if(model !== me.model || board !== me.board) return { problem: 'The model or board changed: the GIF was not made.' };
      const parts = gifDrawPosition(stage, list, positions[k], positions[0]);
      const words = 'Playing ' + a.name + ' ⇄ ' + b.name + ': ' + gifSettingsWords(a, b, fractions[indexes[k]]);
      for(const p of parts) p.images = await Promise.all(p.images);
      const frame = gifFrame(title, words, parts, height);
      height = frame.height;
      shots.push(frame.rgba);
      showGifProgress((k + 1) / positions.length * 0.9);
      await gifPause();
    }
    if(me.cancelled) return { problem: 'The GIF was cancelled.', cancelled: true };
    const k = positions.length - 1, step = Math.round(1000 / GIF_FPS / 10) * 10;
    const frames = gifOrder(k).map(j => ({ rgba: shots[j], delayMs: j === 0 || j === k ? PLAY_PAUSE_MS : step }));
    showGifProgress(0.95);
    await gifPause();
    const bytes = makeGif({ width: GIF_W, height, frames, loop: 0 });
    if(bytes.length > maxBytes){
      const mb = (n) => (n / 1024 / 1024).toFixed(1).replace(/\.0$/, '');
      return { problem: 'The GIF would be ' + mb(bytes.length) + ' MB, more than the ' + mb(maxBytes) + ' MB it may be: show fewer charts in it.', tooLarge: true, size: bytes.length };
    }
    const name = 'fmGraph-' + safeFileName(title) + '.gif'; // (06b-board-files.js)
    return { bytes, blob: new Blob([bytes], { type: 'image/gif' }), name, frames: frames.length, width: GIF_W, height, ms: Math.round(performance.now() - started) };
  } catch(e){
    return { problem: 'The GIF could not be made: ' + String(e && e.message || e).slice(0, 200) };
  } finally {
    if(gifMaking === me) gifMaking = null;
    stage.remove();
    hideGifProgress();
    if(model) updateValues(); // the key as it is again
  }
}

// What the frame's line says: where the moving sliders stand, f of the way (as Play's strip).
function gifSettingsWords(a, b, f){
  const was = playing;
  playing = { from: a, to: b }; // movingSettings reads the ends from it (05m-play.js)
  try{ return settingsLabel(movingSettings(f)); } finally { playing = was; }
}

// The stage: a place off the page for each widget, drawn as the board draws it.
function gifStage(list){
  const stage = make('div', 'gif-stage');
  stage.id = 'gifStage';
  stage.setAttribute('aria-hidden', 'true');
  list.forEach(w => {
    const el = make('div', 'gif-widget');
    el.append(make('div', 'bar-chart-host'), make('div', 'chart-key'), make('ul', 'bar-errors'));
    stage.appendChild(el);
  });
  document.body.appendChild(stage);
  return stage;
}
// One position drawn on the stage; returns pictureParts (the drawings taken at once, before the
// page can change). playAt is set only while drawing.
function gifDrawPosition(stage, list, now, from){
  const kept = new Map(lastGeometry), glides = animateNow, was = playAt;
  animateNow = false;
  playAt = { model, now, from }; // (03-calc.js)
  try{
    const results = resultsWith(now);
    prepareCommonScale(results); // (04d-scale.js)
    const els = [...stage.children];
    list.forEach((w, i) => { if(w.kind === 'chart') drawChart(els[i], w, results); else drawBars(els[i], w, results); });
    return pictureParts(list.map((w, i) => ({ el: els[i], name: list.length > 1 ? widgetName(w) : '' })), true);
  } finally {
    playAt = was;
    lastGeometry = kept;
    animateNow = glides;
  }
}

// A frame: the title, the play's words, the widgets in a grid (side by side when several), each
// its name, drawings, key and problems; the height is the first frame's for every later one.
function gifFrame(title, words, parts, fixedHeight){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const inner = GIF_W - 2 * GIF_PAD;
  const cols = parts.length <= 1 ? 1 : parts.length <= 4 ? 2 : 3;
  const cellW = (inner - GIF_GAP * (cols - 1)) / cols;
  const font = (size, weight) => { ctx.font = (weight || 400) + ' ' + size + 'px ' + PICTURE_FONT; };
  const ops = [];
  const text = (t, x, y, width, size, weight, colour) => {
    font(size, weight);
    wrapText(ctx, t, width).forEach(line => { ops.push({ t: line, x, y: y + size, size, weight, colour }); y += Math.round(size * 1.3); });
    return y;
  };
  let y = GIF_PAD;
  y = text(title, GIF_PAD, y, inner, 24, 700, '#1b2333') + 2;
  y = text(model.name, GIF_PAD, y, inner, 14, 400, '#5f6b7d');
  y = text(words, GIF_PAD, y, inner, 14, 400, '#5f6b7d') + 12;
  for(let r = 0; r < parts.length; r += cols){
    let bottom = y;
    parts.slice(r, r + cols).forEach((p, c) => {
      const x = GIF_PAD + c * (cellW + GIF_GAP);
      let cy = y;
      if(p.name) cy = text(p.name, x, cy, cellW, 16, 700, '#1b2333') + 4;
      p.images.forEach(im => {
        const w = Math.min(cellW, im.w * PICTURE_ZOOM), h = Math.round(w * im.h / im.w);
        ops.push({ im: im.img, x: x + (cellW - w) / 2, y: cy, w, h });
        cy += h + 6;
      });
      p.key.forEach(k => { cy = text(k, x, cy, cellW, 12, 400, '#5f6b7d'); });
      p.problems.forEach(k => { cy = text(k, x, cy, cellW, 12, 400, '#b42318'); });
      bottom = Math.max(bottom, cy);
    });
    y = bottom + GIF_GAP;
  }
  y = text('Made with fmGraph', GIF_PAD, y, inner, 11, 400, '#94a3b8');
  const height = fixedHeight || Math.min(GIF_LIMITS.maxSide, Math.round(y + GIF_PAD));
  canvas.width = GIF_W;
  canvas.height = height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, GIF_W, height);
  ops.forEach(op => {
    if(op.y > height) return;
    if(op.im){ ctx.drawImage(op.im, op.x, op.y, op.w, op.h); return; }
    font(op.size, op.weight);
    ctx.fillStyle = op.colour;
    ctx.fillText(op.t, op.x, op.y);
  });
  return { rgba: ctx.getImageData(0, 0, GIF_W, height).data, height };
}

const gifPause = () => new Promise(r => setTimeout(r, 0));

// ---- the progress strip, with Cancel ----
function showGifProgress(f){
  $('gifProgress').classList.remove('hidden');
  $('gifProgressText').textContent = 'Making the GIF… ' + Math.round(f * 100) + '%';
}
function hideGifProgress(){ $('gifProgress').classList.add('hidden'); }
function cancelPlayGif(){
  if(!gifMaking) return false;
  gifMaking.cancelled = true;
  return true;
}
$('btnGifCancel').addEventListener('click', () => cancelPlayGif());

// Made, then shared or downloaded; any problem said where the person is (the strip, or a notice).
async function playGifFor(ids){
  const say = (words, kind) => {
    if(showing) $('showNote').textContent = words; // (05h-phone-show.js)
    notify(words, kind, 'gif');
  };
  say('', null);
  const r = await makePlayGif(ids);
  if(r.problem){ say(r.cancelled ? '' : r.problem, 'err'); return r; }
  const file = new File([r.blob], r.name, { type: 'image/gif' });
  const how = await shareFiles([file], r.name);
  if(how === 'downloaded') say('Saved the GIF: ' + r.name + '.', 'ok');
  return Object.assign(r, { how });
}

// 🎞 on a bar's or chart's header (05-render.js).
function gifButton(w){
  const b = make('button', 'widget-gif', '🎞');
  b.type = 'button';
  const label = 'GIF of this ' + (w.kind === 'chart' ? 'chart' : 'bar') + ': make an animated GIF of it playing between the ends chosen under Scenarios';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => playGifFor([w.id]));
  return b;
}
$('showGif').addEventListener('click', () => { if(showing) playGifFor(showing.slice()); });
