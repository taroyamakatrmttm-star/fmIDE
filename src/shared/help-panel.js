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
//   options.size (optional) — { get() → saved size, set(size) } where the app keeps the
//                      panel's width ({ width, narrow }, read through cleanHelpSize); without
//                      it the width lasts until the page closes; loadSize(size) gives one read later
//   options.whatsNew (optional) — What's new (H5b): { entries, seen: { get(), set(date) },
//                      onSeen() }. entries, newest first: { id, date ('YYYY-MM-DD'), title,
//                      summary, what: [texts], why, how: [steps], notes: [texts], see: [topic
//                      ids] } (texts may hold {cmd:id}); seen.get() is asked each time. An entry dated after the date seen is
//                      new; with none seen yet, the ones from the last NEWS_FRESH_DAYS days of
//                      the newest. Opening the list of every update marks them all seen.
//   richText(tag, cls, text) is returned too: the same {cmd:id} buttons, for the app's own cards.
//   The styles are src/shared/help-panel.css; each app sets --help-top (where the panel
//   starts) and makes room for it under body.help-open, using --help-w (the panel's width).
//
// Width (step 10, phase H5a): the left edge drags to any width (a double-click on it goes back
// to the usual width), and ⤢ in the header widens it to a reading view, two thirds of the
// window, and back. From HELP_WIDE_AT pixels the panel reads as a page (.wide: larger text, a
// reading column). It always leaves HELP_KEEP_FREE pixels of the app beside it.
const NEWS_FRESH_DAYS = 14, NEWS_ON_HOME = 3;
// A date seen, from storage: 'YYYY-MM-DD', or ''.
function cleanNewsSeen(v){ return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
// '2026-10-01' → '1 October 2026' (no time zones: the date is written as it is).
function newsDateText(d){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  if(!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return Number(m[3]) + ' ' + (months[Number(m[2]) - 1] || '') + ' ' + m[1];
}
const HELP_DEFAULT_W = 380, HELP_MIN_W = 300, HELP_WIDE_AT = 600, HELP_KEEP_FREE = 200;
// A saved size (the person's own setting, but read from storage): numbers in range, or left out.
function cleanHelpSize(v){
  const out = {};
  if(!v || typeof v !== 'object') return out;
  ['width', 'narrow'].forEach(k => {
    const n = Math.round(Number(v[k]));
    if(isFinite(n) && n >= HELP_MIN_W && n <= 10000) out[k] = n;
  });
  return out;
}
function createHelpPanel(options){
  const groups = options.groups || [];
  const topics = options.topics || [];
  const cmds = options.commands || null;
  const CMD = /\{cmd:([A-Za-z0-9_:]+)\}/g;
  const state = { view: 'home', topicId: null, query: '', back: [] };
  let panel = null;
  let size = null; // { width, narrow }: read from the app when first needed
  const news = options.whatsNew && Array.isArray(options.whatsNew.entries) ? options.whatsNew : null;
  const newsEntries = news ? news.entries : [];

  // ---- What's new ----
  // The date seen is the app's: asked each time (it may arrive from storage later).
  function seenDate(){ return cleanNewsSeen(news && news.seen && news.seen.get ? news.seen.get() : ''); }
  function freshFrom(){
    const newest = newsEntries.length ? newsEntries[0].date : '';
    const t = Date.parse(newest + 'T00:00:00Z');
    if(!isFinite(t)) return '';
    return new Date(t - NEWS_FRESH_DAYS * 86400000).toISOString().slice(0, 10);
  }
  function isNew(e){
    const seen = seenDate();
    return seen ? e.date > seen : e.date > freshFrom();
  }
  function unseenCount(){ return newsEntries.filter(isNew).length; }
  function newsEntry(id){ return newsEntries.find(e => e.id === id) || null; }
  function markNewsSeen(){
    if(!newsEntries.length) return;
    const newest = newsEntries[0].date;
    if(seenDate() === newest) return;
    if(news.seen && news.seen.set) news.seen.set(newest);
    if(news.onSeen) news.onSeen();
  }
  // The app read the date seen later (from storage that answers asynchronously): show it.
  function newsSeenChanged(){
    if(news && news.onSeen) news.onSeen();
    if(isOpen() && state.view === 'home') render();
  }
  function entryText(e){
    const texts = [e.title, e.summary || '', e.why || ''].concat(e.what || [], e.how || [], e.notes || []);
    return texts.join(' ').replace(CMD, (all, id) => { const c = cmds && cmds.get(id); return c ? cmds.label(c) : ''; });
  }
  function showNews(){
    if(!panel) build();
    state.back.push({ view: state.view, topicId: state.topicId });
    state.view = 'news';
    render();
    panel.querySelector('.help-body').scrollTop = 0;
    markNewsSeen();
  }
  function showNewsItem(id, fresh){
    if(!panel) build();
    if(fresh) state.back = [];
    else state.back.push({ view: state.view, topicId: state.topicId });
    state.view = 'newsItem';
    state.topicId = id;
    render();
    panel.querySelector('.help-body').scrollTop = 0;
  }

  // ---- width ----
  function savedSize(){
    if(!size) size = cleanHelpSize(options.size && options.size.get ? options.size.get() : null);
    return size;
  }
  function maxWidth(){ return Math.max(HELP_MIN_W, window.innerWidth - HELP_KEEP_FREE); }
  function fit(w){ return Math.max(HELP_MIN_W, Math.min(maxWidth(), Math.round(w))); }
  function readingWidth(){ return fit(Math.max(HELP_WIDE_AT, window.innerWidth * 2 / 3)); }
  function currentWidth(){ return fit(savedSize().width || HELP_DEFAULT_W); }
  // Shows the panel at the saved width (fitted to this window).
  function applyWidth(){
    const w = currentWidth();
    document.documentElement.style.setProperty('--help-w', w + 'px');
    if(!panel) return;
    const wide = w >= HELP_WIDE_AT;
    panel.classList.toggle('wide', wide);
    const b = panel.querySelector('.help-expand');
    if(b){
      b.textContent = wide ? '⤡' : '⤢';
      b.title = wide ? 'Narrower: back to the side panel' : 'Wider: a reading view';
      b.setAttribute('aria-pressed', wide ? 'true' : 'false');
    }
  }
  function storeSize(){ if(options.size && options.size.set) options.size.set(Object.assign({}, size)); }
  function setWidth(w, keep){
    size = Object.assign({}, savedSize(), { width: fit(w) });
    applyWidth();
    if(keep !== false) storeSize();
  }
  function toggleWide(){
    const s = savedSize();
    if(currentWidth() >= HELP_WIDE_AT){
      size = Object.assign({}, s, { width: s.narrow || HELP_DEFAULT_W });
      delete size.narrow;
      if(size.width === HELP_DEFAULT_W) delete size.width;
    } else {
      size = { narrow: currentWidth(), width: readingWidth() };
      if(size.narrow === HELP_DEFAULT_W) delete size.narrow;
    }
    applyWidth();
    storeSize();
  }
  function resetWidth(){
    size = {};
    applyWidth();
    storeSize();
  }
  // Dragging the left edge: by mouse, finger or pen (pointer events, captured by the edge).
  function wireResize(edge){
    edge.addEventListener('pointerdown', (ev) => {
      if(ev.button !== 0) return;
      try{ edge.setPointerCapture(ev.pointerId); }catch(err){ /* still follows while over the edge */ }
      document.body.classList.add('help-resizing');
      const move = (e) => { if(e.pointerId === ev.pointerId) setWidth(window.innerWidth - e.clientX, false); };
      const up = (e) => {
        if(e.pointerId !== ev.pointerId) return;
        edge.removeEventListener('pointermove', move);
        edge.removeEventListener('pointerup', up);
        edge.removeEventListener('pointercancel', up);
        document.body.classList.remove('help-resizing');
        const s = savedSize();
        if(s.width && s.width < HELP_WIDE_AT) delete s.narrow; // dragged narrow: ⤢ starts from here
        storeSize();
      };
      edge.addEventListener('pointermove', move);
      edge.addEventListener('pointerup', up);
      edge.addEventListener('pointercancel', up);
    });
    edge.addEventListener('dblclick', () => resetWidth());
  }
  window.addEventListener('resize', () => { if(isOpen()) applyWidth(); });
  // A size the app read later (from storage that answers asynchronously): used, not stored again.
  function loadSize(v){ size = cleanHelpSize(v); if(isOpen()) applyWidth(); }

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
    const foundNews = newsEntries.map(e => {
      if(!words.every(w => has(entryText(e), w))) return null;
      return { e, score: words.filter(w => has(e.title, w)).length };
    }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.e);
    return { topics: foundTopics, commands: foundCommands, news: foundNews };
  }

  function isOpen(){ return !!(panel && panel.classList.contains('open')); }
  function open(topicId){
    if(!panel) build();
    applyWidth();
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
    const wide = make('button', 'help-expand', '⤢');
    wide.type = 'button';
    wide.addEventListener('click', () => toggleWide());
    head.appendChild(wide);
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
    const edge = make('div', 'help-resize');
    edge.title = 'Drag to make Help wider or narrower (double-click: the usual width)';
    edge.setAttribute('aria-hidden', 'true');
    wireResize(edge);
    panel.appendChild(edge);
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
    else if(state.view === 'news' && news) renderNews(body);
    else if(state.view === 'newsItem' && newsEntry(state.topicId)) renderNewsItem(body, newsEntry(state.topicId));
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
  // An update in a list: its title, date, summary and a New mark.
  function newsLink(e){
    const a = make('button', 'help-topic-link help-news-link');
    a.type = 'button';
    a.dataset.news = e.id;
    const title = make('span', 'help-topic-link-title', e.title);
    if(isNew(e)) title.appendChild(make('span', 'help-new', 'New'));
    a.appendChild(title);
    a.appendChild(make('span', 'help-topic-link-summary', e.summary || ''));
    a.addEventListener('click', () => showNewsItem(e.id));
    return a;
  }
  function newsHeading(body){
    const h = make('h3', 'help-group help-news-heading', '✨ What\'s new');
    const n = unseenCount();
    if(n) h.appendChild(make('span', 'help-new-count', String(n)));
    body.appendChild(h);
  }
  function renderNewsHome(body){
    if(!newsEntries.length) return;
    newsHeading(body);
    newsEntries.slice(0, NEWS_ON_HOME).forEach(e => body.appendChild(newsLink(e)));
    const all = make('button', 'help-topic-link help-news-all');
    all.type = 'button';
    all.appendChild(make('span', 'help-topic-link-title', 'Every update (' + newsEntries.length + ') ›'));
    all.addEventListener('click', () => showNews());
    body.appendChild(all);
  }
  function backButton(){
    const back = make('button', 'help-back', '‹ Back');
    back.type = 'button';
    back.addEventListener('click', () => goBack());
    return back;
  }
  // Every update, newest first, under the day it came.
  function renderNews(body){
    const nav = make('div', 'help-nav');
    nav.appendChild(backButton());
    body.appendChild(nav);
    body.appendChild(make('h2', 'help-topic-title', '✨ What\'s new'));
    body.appendChild(make('p', 'help-summary', options.whatsNew.intro || 'Every update so far, newest first: what changed, why, and how to use it.'));
    let day = null;
    newsEntries.forEach(e => {
      if(e.date !== day){ day = e.date; body.appendChild(make('h3', 'help-group help-news-day', newsDateText(day))); }
      body.appendChild(newsLink(e));
    });
  }
  function renderNewsItem(body, e){
    const nav = make('div', 'help-nav');
    nav.appendChild(backButton());
    nav.appendChild(make('span', 'help-crumb', '✨ What\'s new · ' + newsDateText(e.date)));
    body.appendChild(nav);
    const art = make('article', 'help-topic help-news-item');
    art.dataset.news = e.id;
    art.appendChild(make('h2', 'help-topic-title', e.title));
    if(e.summary) art.appendChild(make('p', 'help-summary', e.summary));
    const section = (title) => art.appendChild(make('h3', 'help-group', title));
    if(Array.isArray(e.what) && e.what.length){ section('What changed'); e.what.forEach(t => art.appendChild(richText('p', 'help-p', t))); }
    if(e.why){ section('Why'); art.appendChild(richText('p', 'help-p', e.why)); }
    if(Array.isArray(e.how) && e.how.length){
      section('How to use it');
      const ol = make('ol', 'help-steps');
      e.how.forEach(t => ol.appendChild(richText('li', '', t)));
      art.appendChild(ol);
    }
    if(Array.isArray(e.notes) && e.notes.length){ section('Good to know'); e.notes.forEach(t => art.appendChild(richText('p', 'help-tip', '💡 ' + t))); }
    const list = (Array.isArray(e.see) ? e.see : []).map(topic).filter(Boolean);
    if(list.length){ section('Read more'); list.forEach(x => art.appendChild(topicLink(x))); }
    body.appendChild(art);
  }
  function renderHome(body){
    if(options.intro) body.appendChild(make('p', 'help-intro', options.intro));
    renderNewsHome(body);
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
    if(!found.topics.length && !found.commands.length && !found.news.length){
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
    if(found.news.length){
      body.appendChild(make('h3', 'help-group', 'What\'s new'));
      found.news.forEach(e => body.appendChild(newsLink(e)));
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
    toggleWide, setWidth, loadSize, showNews, showNewsItem, unseenCount, newsSeenChanged, newsEntry, element: () => panel };
}
