  // ---------- the visible screen and the on-screen keyboard (step 9c) ----------
  // A tablet's on-screen keyboard covers part of the page without always making the page
  // smaller. visualViewport says which part is still visible: its top and height go into
  // --vv-top and --vv-h, which keep dialogs inside it while a finger is in use (styles.css,
  // body.touch-input). The text box being typed in is scrolled into that part too, by scrolling
  // the canvas or the dialog it sits in (never the page itself, whose layout is fixed).
  // Nothing changes for a mouse.
  const visibleScreen = window.visualViewport || null;
  const KEEP_VISIBLE_MARGIN = 8;

  function fitToVisibleScreen(){
    if(!visibleScreen) return;
    const root = document.documentElement.style;
    root.setProperty('--vv-top', Math.round(visibleScreen.offsetTop) + 'px');
    root.setProperty('--vv-h', Math.round(visibleScreen.height) + 'px');
    keepTypingVisible();
  }

  // Scroll the focused text box into view: into the part of each box around it that scrolls (the
  // canvas, a dialog, a list), nearest first, that is also on the visible part of the screen.
  function keepTypingVisible(){
    if(!document.body || !document.body.classList.contains('touch-input')) return;
    const field = document.activeElement;
    if(!field || !field.matches || !field.matches('input, textarea, select, [contenteditable="true"]')) return;
    const screenTop = visibleScreen ? visibleScreen.offsetTop : 0;
    const screenBottom = visibleScreen ? visibleScreen.offsetTop + visibleScreen.height : window.innerHeight;
    for(let box = field.parentElement; box && box !== document.body; box = box.parentElement){
      const overflow = getComputedStyle(box).overflowY;
      if((overflow !== 'auto' && overflow !== 'scroll') || box.scrollHeight <= box.clientHeight) continue;
      const b = box.getBoundingClientRect();
      const top = Math.max(screenTop, b.top) + KEEP_VISIBLE_MARGIN;
      const bottom = Math.min(screenBottom, b.top + box.clientHeight) - KEEP_VISIBLE_MARGIN;
      const r = field.getBoundingClientRect();
      // Too tall to fit: show its top.
      const delta = (r.top < top || r.height > bottom - top) ? r.top - top : (r.bottom > bottom ? r.bottom - bottom : 0);
      if(Math.abs(delta) >= 1) box.scrollTop += delta;
    }
  }

  if(visibleScreen){
    visibleScreen.addEventListener('resize', fitToVisibleScreen);
    visibleScreen.addEventListener('scroll', fitToVisibleScreen);
    fitToVisibleScreen();
  }
  // A box just focused (the keyboard may already be up): after the browser's own scrolling.
  document.addEventListener('focusin', () => { setTimeout(keepTypingVisible, 0); });
