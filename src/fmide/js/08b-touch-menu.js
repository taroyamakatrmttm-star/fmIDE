  // ---------- touch: a node's menu, and drawing an arrow by two taps (step 9b) ----------
  // Pressing and holding a node with a finger or pen opens this menu: the mouse-only gestures
  // (right-drag, Alt-drag, Ctrl-drag, Shift-click), what a double-click and the 🎨 button do,
  // Delete, and what hovering would show. Text from the model goes in only as textContent.
  let touchMenu = null;
  function closeTouchMenu(){
    if(!touchMenu) return;
    touchMenu.remove();
    touchMenu = null;
    document.removeEventListener('pointerdown', onTouchMenuOutside, true);
    document.removeEventListener('keydown', onTouchMenuKey, true);
  }
  function onTouchMenuOutside(ev){ if(touchMenu && !touchMenu.contains(ev.target)) closeTouchMenu(); }
  function onTouchMenuKey(ev){ if(ev.key === 'Escape'){ ev.stopPropagation(); closeTouchMenu(); } }

  // What hovering over a node's parts shows: calculation errors, the plugs feeding a
  // "⚡ ×N" socket, a function node's problem. Button tooltips only name the button.
  function nodeHoverTexts(el){
    const out = [];
    el.querySelectorAll('[title]').forEach(x => {
      if(x.closest('button, .tag-btn, .vindex-toggle, .reducer-chip, textarea')) return;
      const t = (x.title || '').trim();
      if(t && !out.includes(t)) out.push(t);
    });
    return out;
  }

  function showNodeTouchMenu(id, clientX, clientY){
    closeTouchMenu();
    closePicker();
    const n = getNode(id);
    const el = canvas.querySelector(`.node[data-id="${id}"]`);
    if(!n || !el) return;
    // The menu acts on the whole selection when the node is part of it (as a drag does).
    const inSelection = selectedNodeIds.has(id) && !selectedEdgeId;
    const targets = () => (inSelection ? Array.from(selectedNodeIds) : [id]).map(getNode).filter(Boolean);
    const refs = () => targets().map(x => '#' + x.id);
    const several = inSelection && selectedNodeIds.size > 1;

    const menu = document.createElement('div');
    menu.className = 'touch-menu';
    menu.setAttribute('role', 'menu');
    nodeHoverTexts(el).forEach(t => {
      const p = document.createElement('div');
      p.className = 'touch-menu-info';
      p.textContent = t;
      menu.appendChild(p);
    });
    function item(label, run, disabled){
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.textContent = label;
      if(disabled) b.disabled = true;
      b.addEventListener('click', () => { closeTouchMenu(); run(); });
      menu.appendChild(b);
      return b;
    }
    item('Draw arrow from here', () => startTapConnection(id));
    const allRects = targets().every(x => x.type === 'value');
    item(several ? 'Make aliases' : 'Make alias', () => {
      const made = guarded(() => fm.aliasOf(refs()));
      if(Array.isArray(made) && made.length) selectNodesOnly(made);
    }, !allRects);
    item(several ? 'Duplicate selection' : 'Duplicate', () => {
      const made = guarded(() => fm.duplicate(refs()));
      if(Array.isArray(made) && made.length) selectNodesOnly(made);
    });
    item(inSelection ? 'Remove from selection' : 'Add to selection', () => toggleNodeSelection(id));
    item('Edit…', () => { const m = getNode(id); if(m) editNode(m); });
    if(n.type === 'value') item('Properties…', () => { const m = getNode(id); if(m) showPropertiesEditor(m); });
    item('Help', () => openHelp(helpTopicForNode(getNode(id) || n)));
    item(several ? 'Delete selection' : 'Delete', () => guarded(() => fm.deleteNodes(refs()))).classList.add('danger');

    document.body.appendChild(menu);
    touchMenu = menu;
    // Beside the finger rather than under it, kept on screen.
    const r = menu.getBoundingClientRect();
    const left = clientX + 24 + r.width <= window.innerWidth - 8 ? clientX + 24 : Math.max(8, clientX - 24 - r.width);
    const top = Math.min(Math.max(8, clientY - r.height / 2), Math.max(8, window.innerHeight - r.height - 8));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    document.addEventListener('pointerdown', onTouchMenuOutside, true);
    document.addEventListener('keydown', onTouchMenuKey, true);
  }

  // "Draw arrow from here": the next tap on a node, or on one of its input dots, draws the arrow
  // there, by the same rules as dropping one (connectOnto). A tap anywhere else, Escape or
  // Cancel stops. The tap does nothing else (no selection, no drag, no button).
  // tapArrow ({ fromId, banner } while waiting for the tap) is declared in 02b-pointer-input.js,
  // before the first render reads it.
  function startTapConnection(fromId){
    endTapConnection();
    const banner = document.createElement('div');
    banner.id = 'tapArrowBanner';
    const text = document.createElement('span');
    text.textContent = 'Tap the node to draw the arrow to, or one of its input dots.';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', endTapConnection);
    banner.appendChild(text);
    banner.appendChild(cancel);
    document.body.appendChild(banner);
    tapArrow = { fromId, banner };
    render();
    document.addEventListener('pointerdown', onTapArrowPress, true);
    document.addEventListener('keydown', onTapArrowKey, true);
  }
  function endTapConnection(){
    if(!tapArrow) return;
    tapArrow.banner.remove();
    tapArrow = null;
    canvas.querySelectorAll('.node.arrow-source').forEach(x => x.classList.remove('arrow-source'));
    document.removeEventListener('pointerdown', onTapArrowPress, true);
    document.removeEventListener('keydown', onTapArrowKey, true);
  }
  function onTapArrowKey(ev){ if(ev.key === 'Escape'){ ev.stopPropagation(); endTapConnection(); } }
  function onTapArrowPress(ev){
    if(!tapArrow || tapArrow.banner.contains(ev.target)) return;
    // The tap is this mode's alone: no mouse events copied from it, and its click is dropped.
    ev.stopPropagation();
    ev.preventDefault();
    const swallowClick = (c) => { c.stopPropagation(); c.preventDefault(); };
    document.addEventListener('click', swallowClick, true);
    setTimeout(() => document.removeEventListener('click', swallowClick, true), 800);

    const fromId = tapArrow.fromId;
    const target = ev.target;
    const nodeEl = target.closest ? target.closest('#canvas .node') : null;
    const toNode = nodeEl ? getNode(nodeEl.dataset.id) : null;
    // A block takes an arrow only on one of its input dots: say so and keep waiting.
    if(toNode && toNode.type === 'blockInstance' && nodeEl.dataset.id !== fromId && !(target.closest('.io-port') && target.closest('.io-port').dataset.portDir === 'in')){
      toast('Tap one of the block’s input dots.');
      return;
    }
    endTapConnection();
    if(!getNode(fromId) || !toNode) { render(); return; }
    connectOnto(fromId, null, target);
  }
