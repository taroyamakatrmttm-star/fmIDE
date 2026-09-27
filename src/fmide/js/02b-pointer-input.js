  // ---------- pointer input: mouse, touch and pen (step 9a) ----------
  // A mouse keeps the mouse events it always had: an action starts on mousedown and follows
  // mousemove / mouseup. A finger or pen starts the same action on pointerdown and follows
  // that one pointer (pointermove / pointerup / pointercancel). After a tap the browser also
  // sends copies of it as mouse events; the canvas ignores those (isEmulatedMouse), while
  // everything else (closing a pop-up on a tap elsewhere) still sees them as before.
  const touchPointersDown = new Set();
  let lastTouchLift = null; // { x, y, time } where the last finger or pen lifted
  window.addEventListener('pointerdown', (ev) => { if(ev.pointerType !== 'mouse') touchPointersDown.add(ev.pointerId); }, true);
  function noteTouchLift(ev){
    if(ev.pointerType === 'mouse') return;
    touchPointersDown.delete(ev.pointerId);
    lastTouchLift = { x: ev.clientX, y: ev.clientY, time: performance.now() };
  }
  window.addEventListener('pointerup', noteTouchLift, true);
  window.addEventListener('pointercancel', noteTouchLift, true);

  // A mouse event the browser made from a finger or pen: one is down, or one just lifted there.
  function isEmulatedMouse(ev){
    if(touchPointersDown.size) return true;
    const t = lastTouchLift;
    return !!t && performance.now() - t.time < 1000 && Math.abs(ev.clientX - t.x) < 30 && Math.abs(ev.clientY - t.y) < 30;
  }

  // Run handler(ev) when a mouse button, a finger or a pen goes down on el. Only the first
  // finger acts: a second one, while the first is still down, starts nothing.
  function onPress(el, handler){
    el.addEventListener('mousedown', (ev) => { if(!isEmulatedMouse(ev)) handler(ev); });
    el.addEventListener('pointerdown', (ev) => { if(ev.pointerType !== 'mouse' && touchPointersDown.size === 1) handler(ev); });
  }

  // What mousedown's preventDefault did (no text selection, no focus change). A finger's
  // pointerdown is left alone: cancelling it would also cancel the mouse events copied from
  // a tap, which the rest of the page (closing pop-ups) still listens for.
  function pressDefault(ev){ if(ev.type !== 'pointerdown') ev.preventDefault(); }

  // Follow the pointer that made downEvent until it lifts: onMove(ev) on each move, then
  // onUp(ev, cancelled) once — cancelled when the browser took a finger over (ev is then the
  // last move, or downEvent). Returns a function that stops following without calling onUp.
  function followPointer(downEvent, onMove, onUp){
    if(downEvent.type !== 'pointerdown'){
      const up = (ev) => { stop(); onUp(ev, false); };
      function stop(){
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', up);
      return stop;
    }
    const id = downEvent.pointerId;
    let last = downEvent;
    const move = (ev) => { if(ev.pointerId !== id) return; last = ev; onMove(ev); };
    const up = (ev) => { if(ev.pointerId !== id) return; stop(); onUp(ev, false); };
    const cancel = (ev) => { if(ev.pointerId !== id) return; stop(); onUp(last, true); };
    function stop(){
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    return stop;
  }

  // ---------- touch replacements for the mouse-only gestures (step 9b) ----------
  let tapArrow = null;    // drawing an arrow by taps (08b-touch-menu.js): { fromId, banner }
  const HOLD_MS = 500;    // a press this long, with the finger kept still, is a hold
  const HOLD_SLOP = 10;   // pixels a finger may wander and still be holding (or tapping)

  // Follow a finger's press on something that also has a hold: onMoveFirst(ev) if the finger
  // moves before HOLD_MS (the caller then starts its drag from downEvent), onHold() once it has
  // been still that long, onRelease(ev, cancelled) if it lifts first (a tap).
  function waitForHold(downEvent, { onHold, onMoveFirst, onRelease }){
    const x0 = downEvent.clientX, y0 = downEvent.clientY;
    let settled = false;
    const timer = setTimeout(() => { if(settle()) onHold(); }, HOLD_MS);
    const stop = followPointer(downEvent, (ev) => {
      if(Math.hypot(ev.clientX - x0, ev.clientY - y0) > HOLD_SLOP && settle() && onMoveFirst) onMoveFirst(ev);
    }, (ev, cancelled) => {
      if(settle(true) && onRelease) onRelease(ev, cancelled);
    });
    function settle(lifted){
      if(settled) return false;
      settled = true;
      clearTimeout(timer);
      if(!lifted) stop();
      return true;
    }
  }

  // While a hold turns a finger's drag into an action (a selection box, moving a canvas tab),
  // the browser must not scroll under it. Scrolling can only be stopped from touchmove, so the
  // places that scroll by finger listen for it (blockScrollWhileHolding) and cancel it while
  // touchScrollBlocked is set; followPointer's lift clears it.
  let touchScrollBlocked = false;
  function blockScrollWhileHolding(el){
    el.addEventListener('touchmove', (ev) => { if(touchScrollBlocked && ev.cancelable) ev.preventDefault(); }, { passive:false });
  }
  function holdBlocksScrolling(){ touchScrollBlocked = true; }
  window.addEventListener('pointerup', () => { if(!touchPointersDown.size) touchScrollBlocked = false; });
  window.addEventListener('pointercancel', () => { if(!touchPointersDown.size) touchScrollBlocked = false; });

  // Double-tap: two quick taps in about the same place send a double-click to what is under the
  // finger, everywhere in the page. The browser's own copy of one (some browsers send it) is
  // dropped, so nothing happens twice. A tap: the finger lifts within HOLD_MS, near where it went down.
  const DOUBLE_TAP_MS = 400, DOUBLE_TAP_SLOP = 25;
  const touchDownAt = new Map(); // pointerId -> { x, y, time }
  let lastTap = null;
  window.addEventListener('pointerdown', (ev) => {
    if(ev.pointerType !== 'mouse') touchDownAt.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, time: performance.now() });
  }, true);
  window.addEventListener('pointercancel', (ev) => { touchDownAt.delete(ev.pointerId); lastTap = null; });
  window.addEventListener('pointerup', (ev) => {
    if(ev.pointerType === 'mouse') return;
    const down = touchDownAt.get(ev.pointerId);
    touchDownAt.delete(ev.pointerId);
    const now = performance.now();
    if(!down || now - down.time > HOLD_MS || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > HOLD_SLOP){ lastTap = null; return; }
    const prev = lastTap;
    if(prev && now - prev.time < DOUBLE_TAP_MS && Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) < DOUBLE_TAP_SLOP){
      lastTap = null;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      if(target) target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, composed: true, detail: 2, clientX: ev.clientX, clientY: ev.clientY, view: window }));
    } else {
      lastTap = { x: ev.clientX, y: ev.clientY, time: now };
    }
  });
  window.addEventListener('dblclick', (ev) => {
    if(ev.isTrusted && isEmulatedMouse(ev)){ ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);

  // Larger invisible touch areas (styles.css, body.touch-input): on a touchscreen (pointer:
  // coarse) always; elsewhere (a touchscreen laptop) from the first touch until a mouse is used.
  const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function setTouchInput(on){ if(document.body && document.body.classList.contains('touch-input') !== on) document.body.classList.toggle('touch-input', on); }
  if(coarsePointer) setTouchInput(true);
  window.addEventListener('pointerdown', (ev) => { setTouchInput(ev.pointerType !== 'mouse' || coarsePointer); }, true);
  window.addEventListener('pointermove', (ev) => { if(ev.pointerType === 'mouse' && !coarsePointer) setTouchInput(false); }, true);
