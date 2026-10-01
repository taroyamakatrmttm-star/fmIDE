  // =====================================================================================
  // ---------- Help (build step 10; docs/step10-help.md) ----------
  // =====================================================================================
  // H1: F1, ❓ beside the ribbon's search box, or View → Help open the Help panel (shared with
  // ExcelExporter: src/shared/help-panel.js), docked beside the canvas. The text is data
  // (src/help/, CC BY 4.0); a {cmd:id} in it becomes a button that runs that command.
  // H2, help where you are: a ribbon button's tip (its name, shortcut, sentence and "Learn
  // more"; F1 while it shows opens that topic), a "?" in the corner of each window, and Help
  // in a node's touch menu.
  // build:include help/fmide-help.js
  // build:include shared/help-panel.js
  let helpPanelSize = {}; // H5a: { width, narrow } — ui.helpSize

  // One plain sentence per command: COMMAND_HELP, or for an Insert Operator command the
  // sentence of its operator (OPERATOR_HELP, by catalogue id).
  function commandHelpText(c){
    if(!c) return '';
    if(COMMAND_HELP[c.id]) return COMMAND_HELP[c.id];
    const m = /^insertOp(\d+)$/.exec(c.id);
    const op = m ? OPERATORS[+m[1]] : null;
    if(op && OPERATOR_HELP[op.id]) return 'Adds the ' + op.symbol + ' operator, which ' + OPERATOR_HELP[op.id];
    return '';
  }

  const help = createHelpPanel({
    groups: HELP_GROUPS, topics: HELP_TOPICS,
    intro: 'Plain-English guides to everything in fmIDE. Pick a topic, or search above. You can keep working while this panel is open.',
    placeholder: 'Search help — e.g. "last period" or "templates"',
    commands: {
      get: getCommand,
      list: () => COMMANDS.filter(c => !c.id.startsWith('macro:')),
      label: (c) => commandLabel(c),
      icon: (c) => c.icon || '•',
      sentence: commandHelpText,
      shortcut: (c) => shortcutBindings[c.id] ? prettyCombo(shortcutBindings[c.id]) : '',
      enabled: commandEnabled,
      run: (c) => runCommand(c.id),
    },
    toast: (msg) => toast(msg),
    homeTop: (body, make) => renderTutorialList(body, make), // 01c: tutorials and the welcome card
    // H5a: the panel's width, in the person's own UI settings (ui.helpSize, saved with the
    // workspace; never from an imported file, never in a Preferences file).
    size: { get: () => helpPanelSize, set: (v) => { helpPanelSize = cleanHelpSize(v); saveWorkspaceSoon(); } },
  });
  function openHelp(topicId){ hideCommandTip(); help.open(topicId); }
  function closeHelp(){ help.close(); }
  function isHelpOpen(){ return help.isOpen(); }
  // The Help command (F1): while a ribbon button's tip shows, that button's topic; otherwise
  // open or close the panel.
  function toggleHelp(){
    const t = commandTip && commandTip.topic;
    if(t){ openHelp(t); return; }
    help.toggle();
  }
  function refreshHelpCommands(){ help.refresh(); }

  // A topic for a command: the first topic naming it; a macro or a command no topic names,
  // none. Insert Operator commands go to Operators (or, for the new ones, Timing, conditions
  // and rounding).
  function helpTopicForCommand(id){
    const m = /^insertOp(\d+)$/.exec(id);
    if(m){
      const op = OPERATORS[+m[1]];
      return op && ['period', 'if', 'eq', 'ne', 'and', 'or', 'not', 'round', 'roundup', 'rounddown', 'choose'].includes(op.id) ? 'timing-conditions' : 'operators';
    }
    const t = help.topicForCommand(id);
    return t ? t.id : null;
  }
  // A node's topic (the touch menu's Help).
  function helpTopicForNode(n){
    const byType = { value: 'rectangles', operator: 'operators', alias: 'aliases', periodShift: 'period-shifts',
      blockInstance: 'blocks', function: 'function-nodes' };
    if(n && n.type === 'operator'){
      const op = operatorForSymbol(n.op);
      if(op && ['period', 'if', 'eq', 'ne', 'and', 'or', 'not', 'round', 'roundup', 'rounddown', 'choose'].includes(op.id)) return 'timing-conditions';
    }
    return (n && byType[n.type]) || 'what-is-fmide';
  }

  // ---------- a ribbon button's tip (H2) ----------
  // Instead of the browser's own tooltip: the name and shortcut, the command's sentence, and
  // "Learn more" when a topic tells about it. It appears after a short pause over a button
  // (disabled ones too), stays while the pointer is on it, and F1 then opens the topic.
  let commandTip = null;       // { el, cmdId, topic, anchor } while showing
  let commandTipTimer = null;
  function setCommandTip(buttonEl, c){
    buttonEl.dataset.tipCmd = c.id;
    const sc = shortcutBindings[c.id];
    buttonEl.setAttribute('aria-label', commandLabel(c) + (sc ? ' (' + prettyCombo(sc) + ')' : ''));
    buttonEl.removeAttribute('title');
    const sentence = commandHelpText(c);
    if(sentence) buttonEl.setAttribute('aria-description', sentence);
  }
  function showCommandTip(anchor){
    const c = getCommand(anchor.dataset.tipCmd);
    if(!c || !document.body.contains(anchor)) return;
    hideCommandTip();
    const tip = el('div', 'cmd-tip');
    tip.id = 'commandTip';
    tip.setAttribute('role', 'tooltip');
    const head = el('div', 'cmd-tip-head');
    head.appendChild(el('span', 'cmd-tip-name', commandLabel(c)));
    const sc = shortcutBindings[c.id];
    if(sc) head.appendChild(el('span', 'cmd-tip-kbd', prettyCombo(sc)));
    tip.appendChild(head);
    const sentence = commandHelpText(c);
    if(sentence) tip.appendChild(el('div', 'cmd-tip-text', sentence));
    if(!commandEnabled(c)) tip.appendChild(el('div', 'cmd-tip-off', 'Not available right now.'));
    const topic = helpTopicForCommand(c.id);
    if(topic){
      const more = el('button', 'cmd-tip-more', 'Learn more (F1)');
      more.type = 'button';
      more.addEventListener('click', () => openHelp(topic));
      tip.appendChild(more);
    }
    tip.addEventListener('mouseleave', () => scheduleHideCommandTip());
    tip.addEventListener('mouseenter', () => clearTimeout(commandTipTimer));
    document.body.appendChild(tip);
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    tip.style.top = (r.bottom + 6) + 'px';
    commandTip = { el: tip, cmdId: c.id, topic, anchor };
  }
  function hideCommandTip(){
    clearTimeout(commandTipTimer);
    if(commandTip){ commandTip.el.remove(); commandTip = null; }
  }
  function scheduleHideCommandTip(){
    clearTimeout(commandTipTimer);
    commandTipTimer = setTimeout(() => {
      if(commandTip && (commandTip.el.matches(':hover') || commandTip.anchor.matches(':hover'))) return;
      hideCommandTip();
    }, 250);
  }
  // Watched on the document: a disabled button gets no mouse events of its own. A mouse only
  // (a finger has the touch menus and the Help panel).
  document.addEventListener('mouseover', (ev) => {
    if(isEmulatedMouse(ev)) return;
    const anchor = ev.target.closest ? ev.target.closest('[data-tip-cmd]') : null;
    if(!anchor){ if(commandTip && !commandTip.el.contains(ev.target)) scheduleHideCommandTip(); return; }
    if(commandTip && commandTip.anchor === anchor){ clearTimeout(commandTipTimer); return; }
    clearTimeout(commandTipTimer);
    commandTipTimer = setTimeout(() => showCommandTip(anchor), commandTip ? 60 : 450);
  });
  document.addEventListener('mousedown', (ev) => { if(commandTip && !commandTip.el.contains(ev.target)) hideCommandTip(); }, true);
  window.addEventListener('blur', () => hideCommandTip());

  // ---------- "?" on a window (H2) ----------
  // A small ? in a window's top-right corner opens its topic in the Help panel, which comes
  // above the window's dimmed backdrop so both can be read.
  function addWindowHelp(box, topicId){
    if(!box || !helpTopicForWindow(topicId)) return;
    const b = el('button', 'window-help', '?');
    b.type = 'button';
    b.title = 'Help on this window (' + help.topic(topicId).title + ')';
    b.dataset.topic = topicId;
    b.addEventListener('click', (ev) => { ev.stopPropagation(); openHelp(topicId); });
    box.classList.add('has-window-help');
    box.appendChild(b);
    // Some windows empty themselves between steps (the alias and block pickers): put it back.
    new MutationObserver(() => { if(b.parentNode !== box) box.appendChild(b); }).observe(box, { childList: true });
  }
  function helpTopicForWindow(topicId){ return help.topic(topicId); }
