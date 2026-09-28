  // ---------- pointer input: mouse, touch and pen (step 9a) ----------
  // Following a mouse, finger or pen (onPress, followPointer, pressDefault, isEmulatedMouse),
  // holds (waitForHold, HOLD_MS, HOLD_SLOP), double-tap and body.touch-input are shared with
  // ExcelExporter (step 9c):
  // build:include shared/pointer-input.js

  // ---------- touch replacements for the mouse-only gestures (step 9b) ----------
  let tapArrow = null;    // drawing an arrow by taps (08b-touch-menu.js): { fromId, banner }

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
