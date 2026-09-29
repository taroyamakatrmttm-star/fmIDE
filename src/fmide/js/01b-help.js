  // =====================================================================================
  // ---------- Help panel (build step 10, phase H1; docs/step10-help.md) ----------
  // =====================================================================================
  // F1, ❓ beside the ribbon's search box, or View → Help: a panel docked on the right, beside
  // the canvas rather than over it, so you can follow the steps while you work. It is not a
  // dialog (.modal-overlay), so shortcuts keep working. The text is data (src/help/, CC BY 4.0),
  // shown through textContent only; a {cmd:id} in it becomes a button that runs that command.
  // build:include help/fmide-help.js

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
  function helpTopic(id){ return HELP_TOPICS.find(t => t.id === id) || null; }

  // Every text of a topic, for searching (the {cmd:id} markers read as the commands' labels).
  function helpTopicText(t){
    const texts = [t.title, t.keywords || '', t.summary || ''];
    (t.body || []).forEach(b => {
      if(b.p) texts.push(b.p);
      if(b.tip) texts.push(b.tip);
      if(Array.isArray(b.steps)) b.steps.forEach(s => texts.push(s));
    });
    return texts.join(' ').replace(/\{cmd:([A-Za-z0-9_:]+)\}/g, (all, id) => { const c = getCommand(id); return c ? c.label : ''; });
  }
  // The commands a topic names, in order of first mention (a test checks each exists).
  function helpTopicCommands(t){
    const ids = [];
    (t.body || []).forEach(b => [b.p, b.tip].concat(Array.isArray(b.steps) ? b.steps : []).forEach(s => {
      if(typeof s !== 'string') return;
      s.replace(/\{cmd:([A-Za-z0-9_:]+)\}/g, (all, id) => { if(!ids.includes(id)) ids.push(id); return all; });
    }));
    return ids;
  }

  // Search: every word typed must appear; a word in the title counts most, then the keywords
  // and summary, then the body. Commands match on their label and sentence.
  function helpSearch(q){
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if(!words.length) return { topics: [], commands: [] };
    const has = (text, w) => text.toLowerCase().includes(w);
    const topics = HELP_TOPICS.map(t => {
      const all = helpTopicText(t);
      if(!words.every(w => has(all, w))) return null;
      let score = 0;
      words.forEach(w => {
        if(has(t.title, w)) score += 10;
        if(has(t.keywords || '', w)) score += 5;
        if(has(t.summary || '', w)) score += 3;
      });
      if(has(t.title, words.join(' '))) score += 20;
      return { topic: t, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.topic);
    const commands = COMMANDS.filter(c => !c.id.startsWith('macro:')).map(c => {
      const label = c.label + ' ' + (c.short || '');
      const all = label + ' ' + commandHelpText(c);
      if(!words.every(w => has(all, w))) return null;
      return { cmd: c, score: words.filter(w => has(label, w)).length };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.cmd);
    return { topics, commands };
  }

  let helpPanel = null;
  const helpState = { view: 'home', topicId: null, query: '', back: [] };

  function isHelpOpen(){ return !!(helpPanel && helpPanel.classList.contains('open')); }
  function toggleHelp(){ if(isHelpOpen()) closeHelp(); else openHelp(); }
  // topicId (optional): open at that topic.
  function openHelp(topicId){
    if(!helpPanel) buildHelpPanel();
    helpPanel.classList.add('open');
    document.body.classList.add('help-open');
    if(topicId && helpTopic(topicId)) showHelpTopic(topicId, true);
    else renderHelp();
    const search = helpPanel.querySelector('.help-search');
    if(search && !topicId) search.focus();
  }
  function closeHelp(){
    if(!helpPanel) return;
    const hadFocus = helpPanel.contains(document.activeElement);
    helpPanel.classList.remove('open');
    document.body.classList.remove('help-open');
    if(hadFocus) document.activeElement.blur();
  }
  function showHelpTopic(id, fresh){
    if(fresh) helpState.back = [];
    else if(helpState.view !== 'topic' || helpState.topicId !== id) helpState.back.push({ view: helpState.view, topicId: helpState.topicId });
    helpState.view = 'topic';
    helpState.topicId = id;
    renderHelp();
    const body = helpPanel.querySelector('.help-body');
    if(body) body.scrollTop = 0;
  }
  function helpGoBack(){
    const prev = helpState.back.pop();
    if(prev){ helpState.view = prev.view; helpState.topicId = prev.topicId; }
    else helpState.view = helpState.query.trim() ? 'search' : 'home';
    renderHelp();
  }

  function buildHelpPanel(){
    helpPanel = el('aside', 'help-panel');
    helpPanel.id = 'helpPanel';
    helpPanel.setAttribute('aria-label', 'Help');
    const head = el('div', 'help-head');
    head.appendChild(el('span', 'help-title', '❓ Help'));
    const close = el('button', 'help-close', '×');
    close.type = 'button';
    close.title = 'Close Help (F1 or Esc)';
    close.addEventListener('click', () => closeHelp());
    head.appendChild(close);
    helpPanel.appendChild(head);
    const search = el('input', 'help-search');
    search.type = 'search';
    search.placeholder = 'Search help — e.g. "last period" or "templates"';
    search.setAttribute('autocomplete', 'off');
    search.spellcheck = false;
    search.addEventListener('input', () => {
      helpState.query = search.value;
      helpState.view = search.value.trim() ? 'search' : 'home';
      helpState.back = [];
      renderHelp();
    });
    helpPanel.appendChild(search);
    helpPanel.appendChild(el('div', 'help-body'));
    // F1 closes it and Esc closes it while you are in it (the page's own shortcut handler
    // skips key presses in a text box, like the search box).
    helpPanel.addEventListener('keydown', (ev) => {
      if(ev.key === 'Escape' || (ev.key === 'F1' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey)){
        ev.preventDefault(); ev.stopPropagation(); closeHelp();
      }
    });
    document.body.appendChild(helpPanel);
  }

  function renderHelp(){
    if(!helpPanel) return;
    const body = helpPanel.querySelector('.help-body');
    body.innerHTML = '';
    if(helpState.view === 'topic' && helpTopic(helpState.topicId)) renderHelpTopic(body, helpTopic(helpState.topicId));
    else if(helpState.view === 'search' && helpState.query.trim()) renderHelpSearch(body, helpState.query);
    else renderHelpHome(body);
  }

  function helpTopicLink(t){
    const a = el('button', 'help-topic-link');
    a.type = 'button';
    a.dataset.topic = t.id;
    a.appendChild(el('span', 'help-topic-link-title', t.title));
    if(t.summary) a.appendChild(el('span', 'help-topic-link-summary', t.summary));
    a.addEventListener('click', () => showHelpTopic(t.id));
    return a;
  }

  function renderHelpHome(body){
    body.appendChild(el('p', 'help-intro', 'Plain-English guides to everything in fmIDE. Pick a topic, or search above. You can keep working while this panel is open.'));
    HELP_GROUPS.forEach(g => {
      const list = HELP_TOPICS.filter(t => t.group === g.id);
      if(!list.length) return;
      body.appendChild(el('h3', 'help-group', g.title));
      list.forEach(t => body.appendChild(helpTopicLink(t)));
    });
  }

  function renderHelpSearch(body, q){
    const found = helpSearch(q);
    if(!found.topics.length && !found.commands.length){
      body.appendChild(el('p', 'help-empty', 'Nothing matches "' + q.trim() + '". Try fewer or different words.'));
      return;
    }
    if(found.topics.length){
      body.appendChild(el('h3', 'help-group', 'Topics'));
      found.topics.forEach(t => body.appendChild(helpTopicLink(t)));
    }
    if(found.commands.length){
      body.appendChild(el('h3', 'help-group', 'Commands'));
      found.commands.forEach(c => body.appendChild(helpCommandRow(c)));
    }
  }

  // A command with its sentence and ▶ to run it (off while the command can't run).
  function helpCommandRow(c){
    const row = el('div', 'help-command');
    row.dataset.cmd = c.id;
    const text = el('div', 'help-command-text');
    const name = el('div', 'help-command-name');
    name.appendChild(el('span', 'help-command-icon', c.icon || '•'));
    name.appendChild(el('span', '', commandLabel(c)));
    const sc = shortcutBindings[c.id];
    if(sc) name.appendChild(el('span', 'help-kbd', prettyCombo(sc)));
    text.appendChild(name);
    const sentence = commandHelpText(c);
    if(sentence) text.appendChild(el('div', 'help-command-sentence', sentence));
    row.appendChild(text);
    const run = el('button', 'help-run', '▶');
    run.type = 'button';
    run.title = 'Run ' + commandLabel(c);
    run.disabled = !commandEnabled(c);
    run.addEventListener('click', () => runCommand(c.id));
    row.appendChild(run);
    return row;
  }

  // Text with {cmd:id} markers: plain text, and a button for each command it names.
  function helpRichText(tag, cls, text){
    const out = el(tag, cls);
    String(text).split(/(\{cmd:[A-Za-z0-9_:]+\})/).forEach(part => {
      const m = /^\{cmd:([A-Za-z0-9_:]+)\}$/.exec(part);
      if(!m){ if(part) out.appendChild(document.createTextNode(part)); return; }
      const c = getCommand(m[1]);
      if(!c){ out.appendChild(document.createTextNode(m[1])); return; }
      const b = el('button', 'help-cmd');
      b.type = 'button';
      b.dataset.cmd = c.id;
      b.appendChild(el('span', 'help-command-icon', c.icon || '•'));
      b.appendChild(el('span', '', commandLabel(c)));
      const sc = shortcutBindings[c.id];
      b.title = [commandHelpText(c), sc ? 'Shortcut: ' + prettyCombo(sc) : '', 'Click to run it.'].filter(Boolean).join('\n');
      b.addEventListener('click', () => {
        if(!commandEnabled(c)){ toast('"' + commandLabel(c) + '" isn\'t available right now.'); return; }
        runCommand(c.id);
      });
      out.appendChild(b);
    });
    return out;
  }

  function renderHelpTopic(body, t){
    const nav = el('div', 'help-nav');
    const back = el('button', 'help-back', '‹ Back');
    back.type = 'button';
    back.addEventListener('click', () => helpGoBack());
    nav.appendChild(back);
    const group = HELP_GROUPS.find(g => g.id === t.group);
    if(group) nav.appendChild(el('span', 'help-crumb', group.title));
    body.appendChild(nav);
    const art = el('article', 'help-topic');
    art.dataset.topic = t.id;
    art.appendChild(el('h2', 'help-topic-title', t.title));
    if(t.summary) art.appendChild(el('p', 'help-summary', t.summary));
    (t.body || []).forEach(b => {
      if(b.p) art.appendChild(helpRichText('p', 'help-p', b.p));
      if(b.tip) art.appendChild(helpRichText('p', 'help-tip', '💡 ' + b.tip));
      if(Array.isArray(b.steps)){
        const ol = el('ol', 'help-steps');
        b.steps.forEach(s => ol.appendChild(helpRichText('li', '', s)));
        art.appendChild(ol);
      }
      if(Array.isArray(b.see)){
        const list = b.see.map(helpTopic).filter(Boolean);
        if(list.length){
          art.appendChild(el('h3', 'help-group', 'See also'));
          list.forEach(x => art.appendChild(helpTopicLink(x)));
        }
      }
    });
    body.appendChild(art);
  }

  // The panel's command buttons follow what can run now (a selection, the period…).
  function refreshHelpCommands(){
    if(!isHelpOpen()) return;
    helpPanel.querySelectorAll('.help-run').forEach(b => {
      const c = getCommand(b.parentNode.dataset.cmd);
      b.disabled = !c || !commandEnabled(c);
    });
  }
