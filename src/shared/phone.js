// ---------- phones: what fmGraph and fmIDE share on a phone (step 17, docs/step17-phones.md) ----------
// - isPhoneScreen(): a touchscreen whose shorter side is under PHONE_MAX_SIDE pixels, upright or
//   sideways. The screen's own size, not the window's: an on-screen keyboard never turns a
//   tablet into a phone.
// - tick(): a short vibration, where the phone lets a page vibrate (Android; Safari on an
//   iPhone gives web pages none, so there the tick is only seen).
// - createPhoneSlider(options): the phone's own slider. Made for a thumb:
//   · grab anywhere along it: the value moves with the finger from where it is, never jumping
//     to where the finger landed;
//   · finer by sliding the finger up, away from it, while dragging (×½, ×¼, ×⅒, FINE_STEPS),
//     coarse and exact in one gesture, without letting go;
//   · a notch at the base (the model's own number): the value settles there when the finger
//     passes close, with a tick; ticks at round marks too;
//   · the number large, right above the finger (which hides the knob), and "fine ×¼" over the
//     knob while finer; tapping the number lets it be typed; − and + step it, repeating faster while held;
//   · a double-tap goes back to the base; the arrow keys, Page Up / Down, Home and End work.
//   Each finger is followed by its own pointer id, so several sliders move at once.
//   With `vertical`, it stands on end (a fader: up is more) and sliding the finger sideways,
//   away from it, makes it finer.
// - shareFiles(files, title): the phone's own share sheet (Messages, Mail, AirDrop…); the
//   person picks where the files go, nothing is sent first. Where a browser can't share files,
//   they download instead.
// - keepScreenOn(): asks the browser to keep the screen on (Wake Lock) until the function it
//   returns is called; asked again when the page comes back into view.
// Nothing here touches the page until it is called.

export const PHONE_MAX_SIDE = 600;
// How far up (pixels from where the finger went down) makes a drag finer, and by how much.
export const FINE_STEPS = [[0, 1, ''], [50, 1 / 2, '×½'], [110, 1 / 4, '×¼'], [170, 1 / 10, '×⅒']];
const NOTCH_PX = 9;      // the value settles at the base within this many pixels of it
const MARKS = 8;         // about this many round marks along a slider tick
const TICK_GAP_MS = 45;  // ticks closer than this are one

export function isPhoneScreen(){
  try{
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const side = Math.min(window.screen.width || Infinity, window.screen.height || Infinity);
    return coarse && side < PHONE_MAX_SIDE;
  }catch(e){ return false; }
}

export function canVibrate(){
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
export function tick(){
  if(!canVibrate()) return false;
  try{ return navigator.vibrate(8) !== false; }catch(e){ return false; }
}

// The finer factor for a finger this many pixels above where it went down.
export function fineStep(up){
  let pick = FINE_STEPS[0];
  FINE_STEPS.forEach(f => { if(up >= f[0]) pick = f; });
  return { factor: pick[1], label: pick[2] };
}

// A 1-2-5 step near x.
function roundStep(x){
  if(!(x > 0) || !isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function decimalsOf(step){ return Math.max(0, Math.min(12, Math.ceil(-Math.log10(step)) + 1)); }

// options: { label, min, max, step, value, base, format(v) → text, vibrate() → whether to
//   vibrate on a tick, onStart(), onInput(value, atBase), onEnd(), vertical }
// Returns { el, setValue(v), value(), dragging() }.
export function createPhoneSlider(options){
  const o = options;
  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text !== undefined && text !== null) e.textContent = String(text);
    return e;
  };
  const min = o.min, max = o.max, span = Math.max(1e-12, max - min), step = o.step > 0 ? o.step : span / 100;
  const base = Number.isFinite(o.base) ? o.base : min;
  const decimals = decimalsOf(step);
  const markStep = roundStep(span / MARKS);
  const format = typeof o.format === 'function' ? o.format : (v) => String(v);
  const vertical = !!o.vertical;
  let value = Number.isFinite(o.value) ? o.value : base;
  let drags = 0;
  let lastTickAt = 0;

  const el = mk('div', vertical ? 'ps vertical' : 'ps');
  const row = mk('div', 'ps-row');
  const minus = mk('button', 'ps-step ps-minus', '−');
  const plus = mk('button', 'ps-step ps-plus', '+');
  const shown = mk('button', 'ps-value');
  [minus, plus, shown].forEach(b => { b.type = 'button'; });
  minus.setAttribute('aria-label', 'Less: ' + o.label);
  plus.setAttribute('aria-label', 'More: ' + o.label);
  shown.title = 'Type a number';
  shown.setAttribute('aria-label', 'Type a number for ' + o.label);
  row.append(minus, shown, plus);
  const track = mk('div', 'ps-track');
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', o.label);
  track.setAttribute('aria-valuemin', String(min));
  track.setAttribute('aria-valuemax', String(max));
  if(vertical) track.setAttribute('aria-orientation', 'vertical');
  const rail = mk('div', 'ps-rail');
  rail.append(mk('div', 'ps-fill'), mk('div', 'ps-notch'));
  const thumb = mk('div', 'ps-thumb');
  const bubble = mk('div', 'ps-bubble');
  bubble.setAttribute('aria-hidden', 'true');
  track.append(rail, thumb, bubble);
  el.append(row, track);

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const frac = (v) => Math.min(1, Math.max(0, (v - min) / span));
  const snap = (v) => Number(clamp(min + Math.round((v - min) / step) * step).toFixed(decimals));
  function paint(){
    el.style.setProperty('--ps-f', String(frac(value)));
    el.style.setProperty('--ps-n', String(frac(base)));
    el.style.setProperty('--ps-a', String(Math.min(frac(value), frac(base))));
    el.style.setProperty('--ps-b', String(Math.max(frac(value), frac(base))));
    el.classList.toggle('at-base', value === base);
    shown.textContent = format(value);
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-valuetext', format(value));
  }
  function tickNow(){
    const now = performance.now();
    if(now - lastTickAt < TICK_GAP_MS) return;
    lastTickAt = now;
    el.classList.remove('ticked');
    void el.offsetWidth; // start the little pulse again
    el.classList.add('ticked');
    if(!o.vibrate || o.vibrate()) tick();
  }
  // Ticks for a move from a to b: reaching the base, or crossing a round mark.
  function ticksFor(a, b){
    if(a === b) return;
    if(b === base || (a - base) * (b - base) < 0) return tickNow();
    if(Math.floor(a / markStep + 1e-9) !== Math.floor(b / markStep + 1e-9)) tickNow();
  }
  function setTo(v, quiet){
    const was = value;
    value = v;
    paint();
    if(!quiet) ticksFor(was, v);
    if(o.onInput) o.onInput(value, value === base);
  }
  const start = () => { if(o.onStart) o.onStart(); };
  const end = () => { if(o.onEnd) o.onEnd(); };

  // ---- dragging ----
  track.addEventListener('pointerdown', (ev) => {
    if(ev.button > 0) return;
    if(ev.pointerType === 'mouse') ev.preventDefault(); // no text selection; a finger's is left alone (pointer-input.js)
    try{ track.setPointerCapture(ev.pointerId); }catch(e){ /* followed through the document anyway */ }
    const id = ev.pointerId, x0 = ev.clientX, y0 = ev.clientY;
    const box = rail.getBoundingClientRect();
    const length = Math.max(1, vertical ? box.height : box.width);
    // Along the slider (up is more on a fader), and away from it (finer).
    const along = (e) => vertical ? -e.clientY : e.clientX;
    const away = (e) => vertical ? Math.abs(e.clientX - x0) : y0 - e.clientY;
    let anchor = along(ev), raw = value, anchorV = value, factor = 1, moved = false;
    drags++;
    el.classList.add('dragging');
    track.focus({ preventScroll: true });
    start();
    const move = (e) => {
      if(e.pointerId !== id) return;
      const fine = fineStep(away(e));
      if(fine.factor !== factor){ anchor = along(e); anchorV = raw; factor = fine.factor; }
      if(!moved && Math.abs(along(e) - along(ev)) < 3) return;
      moved = true;
      raw = clamp(anchorV + (along(e) - anchor) / length * span * factor);
      const unitsPerPx = span * factor / length;
      const v = Math.abs(raw - base) / unitsPerPx <= NOTCH_PX && base >= min && base <= max ? base : snap(raw);
      el.classList.toggle('fine', factor < 1);
      if(v !== value) setTo(v);
      if(factor < 1) placeBubble('fine ' + fine.label);
    };
    const up = (e) => {
      if(e.pointerId !== id) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      drags = Math.max(0, drags - 1);
      el.classList.remove('dragging', 'fine');
      end();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
  // "fine ×¼" over the knob, kept inside the slider.
  function placeBubble(text){
    bubble.textContent = text;
    const pad = 24;
    if(vertical){
      const h = track.clientHeight, at = h - pad - frac(value) * (h - 2 * pad);
      bubble.style.top = Math.max(0, Math.min(h - bubble.offsetHeight, at - bubble.offsetHeight - 22)) + 'px';
      return;
    }
    const w = track.clientWidth, half = bubble.offsetWidth / 2 + 4;
    const at = pad + frac(value) * (w - 2 * pad);
    bubble.style.left = Math.max(half, Math.min(w - half, at)) + 'px';
  }
  // A double-tap (pointer-input.js sends a finger's as dblclick) or a double-click: the base.
  track.addEventListener('dblclick', (ev) => { ev.preventDefault(); start(); setTo(base); end(); });
  track.addEventListener('keydown', (ev) => {
    const k = ev.key;
    const by = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[k];
    let v = null;
    if(by !== undefined) v = snap(value + by);
    else if(k === 'Home') v = min;
    else if(k === 'End') v = max;
    if(v === null) return;
    ev.preventDefault();
    start(); setTo(v); end();
  });

  // ---- − and +: a step, repeating faster while held ----
  [[minus, -1], [plus, 1]].forEach(([b, dir]) => {
    let timer = null;
    const stepOnce = () => setTo(snap(value + dir * step));
    const stop = () => { if(timer === null) return; clearTimeout(timer); timer = null; end(); };
    b.addEventListener('pointerdown', (ev) => {
      if(ev.button > 0) return;
      if(ev.pointerType === 'mouse') ev.preventDefault();
      start();
      stepOnce();
      let gap = 380;
      const again = () => { stepOnce(); gap = Math.max(35, gap * 0.8); timer = setTimeout(again, gap); };
      timer = setTimeout(again, gap);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, stop));
    b.addEventListener('click', (ev) => { if(ev.detail === 0){ start(); stepOnce(); end(); } }); // the keyboard's Enter or Space
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });

  // ---- typing ----
  shown.addEventListener('click', () => {
    const box = mk('input', 'ps-type');
    box.type = 'text';
    box.inputMode = min >= 0 && base >= 0 ? 'decimal' : 'text';
    box.value = String(value);
    box.setAttribute('aria-label', o.label + ' (number)');
    let done = false;
    const finish = (keep) => {
      if(done) return;
      done = true;
      const v = Number(box.value.replace(/[\s,]/g, '').replace(/−/g, '-'));
      box.replaceWith(shown);
      if(keep && box.value.trim() !== '' && isFinite(v)){ start(); setTo(v, true); end(); }
      else paint();
    };
    box.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); }
      else if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); }
    });
    box.addEventListener('blur', () => finish(true));
    shown.replaceWith(box);
    box.focus();
    box.select();
  });

  paint();
  return {
    el,
    setValue(v){ if(Number.isFinite(v) && !drags){ value = v; paint(); } },
    value: () => value,
    dragging: () => drags > 0,
  };
}

// The phone's share sheet for these files (File objects); else they download. Resolves
// 'shared', 'cancelled' (the person closed the sheet) or 'downloaded'.
export async function shareFiles(files, title){
  try{
    if(navigator.share && navigator.canShare && navigator.canShare({ files })){
      await navigator.share({ files, title });
      return 'shared';
    }
  }catch(e){
    if(e && e.name === 'AbortError') return 'cancelled';
    // Not allowed here (or failed): download instead.
  }
  files.forEach(f => {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return 'downloaded';
}

// Keeps the screen on while something is being shown; call what it returns to let it sleep.
export function keepScreenOn(){
  let on = true, sentinel = null;
  const ask = () => {
    if(!on || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(s => {
      if(on) sentinel = s;
      else s.release().catch(() => {});
    }, () => { /* refused (battery saver…): the screen sleeps as usual */ });
  };
  const visible = () => { if(document.visibilityState === 'visible') ask(); };
  document.addEventListener('visibilitychange', visible);
  ask();
  return () => {
    on = false;
    document.removeEventListener('visibilitychange', visible);
    if(sentinel){ sentinel.release().catch(() => {}); sentinel = null; }
  };
}
