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
