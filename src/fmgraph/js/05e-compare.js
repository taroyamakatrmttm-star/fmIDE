// ============================================================
// Comparing and moving (G4b).
// - The A/B snapshot: 📌 Pin as A keeps where the sliders are now (the numbers they lay over
//   the model, so it holds on every board and through undo). Until it is unpinned, the dashed
//   outlines, the difference labels and Biggest movers compare with A instead of the model's
//   own numbers; a strip above the board says what A is. ⇄ Swap puts the sliders where A had
//   them and keeps where they were as the new A. Like the sliders' positions, A is never
//   saved; opening a model clears it. Nothing here is an undo step.
// - Animation: when values change, each bar glides from where it was to where it is (ANIM_MS),
//   with the Web Animations API on the redrawn SVG. Not while a slider is being dragged (a
//   redraw within DRAG_GAP_MS of the last one), and never when the device asks for reduced
//   motion. Where each bar was is kept by widget and position (`lastGeometry`), so a widget
//   drawn again (a reset, a typed number, undo) glides too.
// ============================================================
let pinA = null;   // { overrides, sliders: [{ key, mode, periods, value }], label }

// What the outlines and differences compare with: A, or the model's own numbers.
function compareResults(){ return pinA ? resultsWith(pinA.overrides) : model.base; }

function sliderSetting(s){ return { key: s.key, mode: s.mode, periods: JSON.stringify(s.periods), value: s.value }; }

// "Price 13, Volume +5%", or the model's own numbers when no slider is moved.
function settingsLabel(list){
  const words = list.filter(s => s.value !== null && model.byKey.has(s.key)).map(s => model.byKey.get(s.key).name + ' '
    + (s.mode === 'shift' ? (s.value >= 0 ? '+' : '−') + fmtNum(Math.abs(s.value)) + '%' : fmtNum(s.value)));
  return words.length ? words.join(', ') : 'the model\'s own numbers';
}

function pinAsA(){
  if(!model) return null;
  const sliders = board.sliders.map(sliderSetting);
  pinA = { overrides: overridesFor(board.sliders), sliders, label: settingsLabel(sliders) };
  renderCompareBar();
  updateValues();
  return pinA.label;
}
function unpinA(){
  pinA = null;
  renderCompareBar();
  if(model) updateValues();
}
// Swap: the sliders go where A had them (a slider A didn't have goes back to the model's own
// number), and where they were becomes A.
function swapWithA(){
  if(!pinA || !model) return null;
  const old = pinA.sliders.slice();
  pinAsA();
  board.sliders.forEach(s => {
    const me = sliderSetting(s);
    const i = old.findIndex(o => o.key === me.key && o.mode === me.mode && o.periods === me.periods);
    s.value = i >= 0 ? old.splice(i, 1)[0].value : null;
  });
  renderBoard();
  return pinA.label;
}

function renderCompareBar(){
  const bar = $('compareBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !pinA || !model);
  $('btnPinA').setAttribute('aria-pressed', pinA ? 'true' : 'false');
  if(!pinA || !model) return;
  bar.appendChild(make('span', 'compare-mark', 'A'));
  const text = make('span', 'compare-text');
  text.appendChild(make('strong', null, 'Comparing with A: '));
  text.appendChild(document.createTextNode(pinA.label));
  bar.appendChild(text);
  const button = (label, title, fn) => { const b = make('button', 'compare-btn', label); b.type = 'button'; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); return b; };
  button('⇄ Swap', 'Put the sliders where A had them, and keep where they are now as A', () => swapWithA());
  button('Unpin', 'Compare with the model\'s own numbers again', () => unpinA());
}

$('btnPinA').addEventListener('click', () => pinAsA());

// ---- Animation ----
const ANIM_MS = 200;
const DRAG_GAP_MS = 150;
let lastGeometry = new Map();   // anim key → { y, h }
let lastDrawAt = 0;
let animateNow = false;
const reducedMotion = (() => { try{ return window.matchMedia('(prefers-reduced-motion: reduce)'); }catch(e){ return null; } })();

// Called once per redraw, before the widgets draw: whether bars glide this time.
function startDraw(){
  const now = performance.now();
  animateNow = now - lastDrawAt > DRAG_GAP_MS && !(reducedMotion && reducedMotion.matches);
  lastDrawAt = now;
}
// A bar that may glide: its key says which widget and which bar in it.
function animKey(rect, key){ rect.dataset.anim = key; return rect; }
// After a widget's SVG is in place: glide each bar from where it was.
function glide(host){
  host.querySelectorAll('rect[data-anim]').forEach(r => {
    const key = r.dataset.anim, y1 = Number(r.getAttribute('y')), h1 = Number(r.getAttribute('height'));
    const was = lastGeometry.get(key);
    lastGeometry.set(key, { y: y1, h: h1 });
    if(!animateNow || !was || h1 < 0.5 || typeof r.animate !== 'function') return;
    if(Math.abs(was.y - y1) < 0.5 && Math.abs(was.h - h1) < 0.5) return;
    const a = was.h / h1, b = was.y - a * y1;
    r.animate([{ transform: 'matrix(1,0,0,' + a + ',0,' + b + ')' }, { transform: 'matrix(1,0,0,1,0,0)' }], { duration: ANIM_MS, easing: 'ease-out' });
  });
}
function forgetGeometry(){ lastGeometry = new Map(); }
