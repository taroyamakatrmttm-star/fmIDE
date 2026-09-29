// =====================================================================================
// The Help panel (build step 10; docs/step10-help.md) — shared by fmIDE and ExcelExporter.
// =====================================================================================
// A panel docked on the right, beside the page rather than over it (the app narrows its own
// content under body.help-open), so people can follow the steps while they work. It is no
// dialog: the app's shortcuts keep working. Everything is built with textContent — never
// markup — and a {cmd:id} in a text becomes a button that runs that command, when the app
// gives commands (fmIDE does; ExcelExporter doesn't).
//
// createHelpPanel(options) → { open, close, toggle, isOpen, showTopic, refresh, search,
//   topic, topicText, topicCommands, topicForCommand, element }
//   options.groups   — [{ id, title }] in order
//   options.topics   — [{ id, group, title, keywords, summary, body }]; body blocks:
//                      { p } a paragraph · { steps: [...] } numbered · { tip } · { see: [ids] }
//   options.intro, options.placeholder, options.emptyText — the panel's own words
//   options.commands (optional) — { get(id), list(), label(c), icon(c), sentence(c),
//                      shortcut(c) (text, or ''), enabled(c), run(c) }
//   options.toast (optional) — shows a short message (a command that can't run now)
//   options.homeTop (optional) — (body, make) adds the app's own things above the topics
//   richText(tag, cls, text) is returned too: the same {cmd:id} buttons, for the app's own cards.
//   The styles are src/shared/help-panel.css; each app sets --help-top (where the panel
//   starts) and makes room for it under body.help-open.
function createHelpPanel(options){
  const groups = options.groups || [];
  const topics = options.topics || [];
  const cmds = options.commands || null;
  const CMD = /\{cmd:([A-Za-z0-9_:]+)\}/g;
  const state = { view: 'home', topicId: null, query: '', back: [] };
  let panel = null;

  function make(tag, cls, text){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text !== undefined) e.textContent = text;
    return e;
  }
  function topic(id){ return topics.find(t => t.id === id) || null; }
  function blockTexts(b){ return [b.p, b.tip].concat(Array.isArray(b.steps) ? b.steps : []).filter(s => typeof s === 'string'); }
  // Every text of a topic, for searching (a {cmd:id} reads as the command's name).
  function topicText(t){
    const texts = [t.title, t.keywords || '', t.summary || ''];
    (t.body || []).forEach(b => blockTexts(b).forEach(s => texts.push(s)));
    return texts.join(' ').replace(CMD, (all, id) => { const c = cmds && cmds.get(id); return c ? cmds.label(c) : ''; });
  }
  // The commands a topic names, in order of first mention.
  function topicCommands(t){
    const ids = [];
    (t.body || []).forEach(b => blockTexts(b).forEach(s => s.replace(CMD, (all, id) => { if(!ids.includes(id)) ids.push(id); return all; })));
    return ids;
  }
  // The topic that tells about a command: the first one naming it (topics in their order).
  function topicForCommand(id){ return topics.find(t => topicCommands(t).includes(id)) || null; }

  // Every word typed must appear; a word in the title counts most, then keywords and summary.
  function search(q){
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if(!words.length) return { topics: [], commands: [] };
    const has = (text, w) => String(text).toLowerCase().includes(w);
    const foundTopics = topics.map(t => {
      if(!words.every(w => has(topicText(t), w))) return null;
      let score = 0;
      words.forEach(w => {
        if(has(t.title, w)) score += 10;
        if(has(t.keywords || '', w)) score += 5;
        if(has(t.summary || '', w)) score += 3;
      });
      if(has(t.title, words.join(' '))) score += 20;
      return { t, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.t);
    const foundCommands = !cmds ? [] : cmds.list().map(c => {
      const label = cmds.label(c);
      if(!words.every(w => has(label + ' ' + cmds.sentence(c), w))) return null;
      return { c, score: words.filter(w => has(label, w)).length };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.c);
    return { topics: foundTopics, commands: foundCommands };
  }

  function isOpen(){ return !!(panel && panel.classList.contains('open')); }
  function open(topicId){
    if(!panel) build();
    panel.classList.add('open');
    document.body.classList.add('help-open');
    if(topicId && topic(topicId)) showTopic(topicId, true);
    else render();
    if(!topicId) panel.querySelector('.help-search').focus();
  }
  function close(){
    if(!panel) return;
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('open');
    document.body.classList.remove('help-open');
    if(hadFocus) document.activeElement.blur();
  }
  function toggle(){ if(isOpen()) close(); else open(); }
  // fresh: start a new trail (Back then goes to the list).
  function showTopic(id, fresh){
    if(!panel) build();
    if(fresh) state.back = [];
    else if(state.view !== 'topic' || state.topicId !== id) state.back.push({ view: state.view, topicId: state.topicId });
    state.view = 'topic';
    state.topicId = id;
    render();
    panel.querySelector('.help-body').scrollTop = 0;
  }
  function goBack(){
    const prev = state.back.pop();
    if(prev){ state.view = prev.view; state.topicId = prev.topicId; }
    else state.view = state.query.trim() ? 'search' : 'home';
    render();
  }

  function build(){
    panel = make('aside', 'help-panel');
    panel.id = options.id || 'helpPanel';
    panel.setAttribute('aria-label', 'Help');
    const head = make('div', 'help-head');
    head.appendChild(make('span', 'help-title', '❓ Help'));
    const x = make('button', 'help-close', '×');
    x.type = 'button';
    x.title = 'Close Help (F1 or Esc)';
    x.addEventListener('click', () => close());
    head.appendChild(x);
    panel.appendChild(head);
    const box = make('input', 'help-search');
    box.type = 'search';
    box.placeholder = options.placeholder || 'Search help';
    box.setAttribute('autocomplete', 'off');
    box.spellcheck = false;
    box.addEventListener('input', () => {
      state.query = box.value;
      state.view = box.value.trim() ? 'search' : 'home';
      state.back = [];
      render();
    });
    panel.appendChild(box);
    panel.appendChild(make('div', 'help-body'));
    // F1 and Esc close it from inside (apps skip their own shortcuts in a text box).
    panel.addEventListener('keydown', (ev) => {
      if(ev.key === 'Escape' || (ev.key === 'F1' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey)){
        ev.preventDefault(); ev.stopPropagation(); close();
      }
    });
    document.body.appendChild(panel);
  }

  function render(){
    if(!panel) return;
    const body = panel.querySelector('.help-body');
    body.textContent = '';
    if(state.view === 'topic' && topic(state.topicId)) renderTopic(body, topic(state.topicId));
    else if(state.view === 'search' && state.query.trim()) renderSearch(body, state.query);
    else renderHome(body);
  }

  function topicLink(t){
    const a = make('button', 'help-topic-link');
    a.type = 'button';
    a.dataset.topic = t.id;
    a.appendChild(make('span', 'help-topic-link-title', t.title));
    if(t.summary) a.appendChild(make('span', 'help-topic-link-summary', t.summary));
    a.addEventListener('click', () => showTopic(t.id));
    return a;
  }
  function renderHome(body){
    if(options.intro) body.appendChild(make('p', 'help-intro', options.intro));
    if(options.homeTop) options.homeTop(body, make);
    groups.forEach(g => {
      const list = topics.filter(t => t.group === g.id);
      if(!list.length) return;
      body.appendChild(make('h3', 'help-group', g.title));
      list.forEach(t => body.appendChild(topicLink(t)));
    });
  }
  function renderSearch(body, q){
    const found = search(q);
    if(!found.topics.length && !found.commands.length){
      body.appendChild(make('p', 'help-empty', 'Nothing matches "' + q.trim() + '". Try fewer or different words.'));
      return;
    }
    if(found.topics.length){
      body.appendChild(make('h3', 'help-group', 'Topics'));
      found.topics.forEach(t => body.appendChild(topicLink(t)));
    }
    if(found.commands.length){
      body.appendChild(make('h3', 'help-group', 'Commands'));
      found.commands.forEach(c => body.appendChild(commandRow(c)));
    }
  }
  // A command with its sentence and ▶ to run it (off while it can't run).
  function commandRow(c){
    const row = make('div', 'help-command');
    row.dataset.cmd = c.id;
    const text = make('div', 'help-command-text');
    const name = make('div', 'help-command-name');
    name.appendChild(make('span', 'help-command-icon', cmds.icon(c)));
    name.appendChild(make('span', '', cmds.label(c)));
    const sc = cmds.shortcut(c);
    if(sc) name.appendChild(make('span', 'help-kbd', sc));
    text.appendChild(name);
    const sentence = cmds.sentence(c);
    if(sentence) text.appendChild(make('div', 'help-command-sentence', sentence));
    row.appendChild(text);
    const run = make('button', 'help-run', '▶');
    run.type = 'button';
    run.title = 'Run ' + cmds.label(c);
    run.disabled = !cmds.enabled(c);
    run.addEventListener('click', () => { if(cmds.enabled(c)) cmds.run(c); });
    row.appendChild(run);
    return row;
  }
  // Text with {cmd:id} markers: plain text, and a button for each command it names.
  function richText(tag, cls, text){
    const out = make(tag, cls);
    String(text).split(/(\{cmd:[A-Za-z0-9_:]+\})/).forEach(part => {
      const m = /^\{cmd:([A-Za-z0-9_:]+)\}$/.exec(part);
      if(!m){ if(part) out.appendChild(document.createTextNode(part)); return; }
      const c = cmds && cmds.get(m[1]);
      if(!c){ out.appendChild(document.createTextNode(m[1])); return; }
      const b = make('button', 'help-cmd');
      b.type = 'button';
      b.dataset.cmd = c.id;
      b.appendChild(make('span', 'help-command-icon', cmds.icon(c)));
      b.appendChild(make('span', '', cmds.label(c)));
      const sc = cmds.shortcut(c);
      b.title = [cmds.sentence(c), sc ? 'Shortcut: ' + sc : '', 'Click to run it.'].filter(Boolean).join('\n');
      b.addEventListener('click', () => {
        if(!cmds.enabled(c)){ if(options.toast) options.toast('"' + cmds.label(c) + '" isn\'t available right now.'); return; }
        cmds.run(c);
      });
      out.appendChild(b);
    });
    return out;
  }
  function renderTopic(body, t){
    const nav = make('div', 'help-nav');
    const back = make('button', 'help-back', '‹ Back');
    back.type = 'button';
    back.addEventListener('click', () => goBack());
    nav.appendChild(back);
    const group = groups.find(g => g.id === t.group);
    if(group) nav.appendChild(make('span', 'help-crumb', group.title));
    body.appendChild(nav);
    const art = make('article', 'help-topic');
    art.dataset.topic = t.id;
    art.appendChild(make('h2', 'help-topic-title', t.title));
    if(t.summary) art.appendChild(make('p', 'help-summary', t.summary));
    (t.body || []).forEach(b => {
      if(b.p) art.appendChild(richText('p', 'help-p', b.p));
      if(b.tip) art.appendChild(richText('p', 'help-tip', '💡 ' + b.tip));
      if(Array.isArray(b.steps)){
        const ol = make('ol', 'help-steps');
        b.steps.forEach(s => ol.appendChild(richText('li', '', s)));
        art.appendChild(ol);
      }
      if(Array.isArray(b.see)){
        const list = b.see.map(topic).filter(Boolean);
        if(list.length){
          art.appendChild(make('h3', 'help-group', 'See also'));
          list.forEach(x => art.appendChild(topicLink(x)));
        }
      }
    });
    body.appendChild(art);
  }
  // The commands' ▶ buttons follow what can run now (call when the app's state changes). Only
  // command rows: an app's own ▶ buttons (homeTop, e.g. fmIDE's tutorials) are its own.
  function refresh(){
    if(!isOpen() || !cmds) return;
    panel.querySelectorAll('.help-command[data-cmd] .help-run').forEach(b => {
      const c = cmds.get(b.parentNode.dataset.cmd);
      b.disabled = !c || !cmds.enabled(c);
    });
  }

  return { open, close, toggle, isOpen, showTopic, refresh, search, topic, topicText, topicCommands, topicForCommand, richText, render,
    element: () => panel };
}
