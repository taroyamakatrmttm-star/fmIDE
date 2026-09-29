  // =====================================================================================
  // ---------- Tutorials and the welcome card (build step 10, phase H3; docs/step10-help.md) ----------
  // =====================================================================================
  // A tutorial runs in practice mode: the model, its undo history and the document's state are
  // set aside in memory, a clean practice canvas takes their place, and the autosave pauses
  // (the saved copy stays your own work, even after a crash). Finishing or exiting puts
  // everything back exactly as it was. A coach card (#tutorialCard) shows one step at a time,
  // a pulsing ring points at what to press, and a step moves on by itself once what it asks for
  // is true of the model (checks in src/help/fmide-tutorials.js, data only). Nothing is done
  // for the person.
  // The welcome card (#welcomeCard) appears on the very first start (no autosave yet), in a
  // corner over the sample model: it blocks nothing, and steps aside at the first change to the
  // model (pushHistory), so it never stays over a canvas someone is working on.
  // build:include help/fmide-tutorials.js

  let practice = null;          // { tutorial, step, saved: { snap, history, future, doc }, timer }
  function inPractice(){ return !!practice; }
  function practiceSavedDirty(){ return !!(practice && practice.saved.doc.dirty); }
  // Commands that would read or write your own files or document: not while practising.
  const PRACTICE_BLOCKED = new Set(['newDocument', 'openDocument', 'saveDocument', 'saveDocumentAs', 'openRecent',
    'loadSystem', 'addSystem', 'importWorkspace']);
  function practiceBlocks(id){
    if(!practice || !PRACTICE_BLOCKED.has(id)) return false;
    toast('Finish or exit the tutorial first: practice never touches your files.', 3200);
    return true;
  }
  function tutorial(id){ return TUTORIALS.find(t => t.id === id) || null; }

  function startTutorial(id){
    const t = tutorial(id);
    if(!t) return false;
    if(practice) endTutorial();
    hideWelcomeCard();
    closeHelp();
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); // commits a text being typed
    closePicker();
    saveWorkspace(); // your own work, as it is now, is the saved copy while you practise
    practice = { tutorial: t, step: 0, saved: { snap: snapshot(), history: history.slice(), future: future.slice(), doc: Object.assign({}, currentDoc) } };
    applySystemDataDirect({ canvases: [{ id: 'c' + nextCanvasId, name: 'Practice', nodes: [], edges: [] }], periods: ['Period 1'], currentPeriod: 0 });
    render();
    clearUndoHistory();
    Object.assign(currentDoc, { name: 'Practice — ' + t.title, dirty: false });
    updateDocTitle();
    document.body.classList.add('practising');
    renderTutorialCard();
    practice.timer = setInterval(tutorialTick, 300);
    return true;
  }

  // Puts your own model, undo history and document back exactly as they were.
  function endTutorial(){
    if(!practice) return;
    const saved = practice.saved;
    clearInterval(practice.timer);
    practice = null;
    closePicker();
    const card = document.getElementById('tutorialCard');
    if(card) card.remove();
    hidePointer();
    document.body.classList.remove('practising');
    restore(saved.snap);
    history = saved.history;
    future = saved.future;
    Object.assign(currentDoc, saved.doc);
    clearSelection();
    render();
    renderCanvasTabs();
    evaluateAll();
    updateHistoryButtons();
    updateDocTitle();
  }

  function downloadPractice(){
    if(!practice) return;
    downloadJSON(buildWorkspacePayload(), 'practice.fmide');
  }

  // ---------- the checks (data from fmide-tutorials.js) ----------
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  function rectInfo(n){ return n.type === 'value' ? parseRectText(n.text) : null; }
  // The nodes a reference means: a rectangle's name, { op: '×' } or { shift: -1 }.
  function nodesFor(ref){
    if(ref && typeof ref === 'object' && ref.op !== undefined) return nodes.filter(n => n.type === 'operator' && n.text === ref.op);
    if(ref && typeof ref === 'object' && ref.shift !== undefined) return nodes.filter(n => n.type === 'periodShift' && Number(n.shift) === Number(ref.shift));
    return nodes.filter(n => n.type === 'value' && sameName(rectInfo(n).name, ref));
  }
  function valueAt(n, period){
    try{ return fm.getValue('#' + n.id, period); }catch(err){ return null; }
  }
  function checkPasses(c){
    if(c.rect) return nodesFor(c.rect.name).some(n => {
      const r = rectInfo(n);
      if(c.rect.value !== undefined && r.literal !== Number(c.rect.value)) return false;
      if(c.rect.uom !== undefined && !sameName(r.uom, c.rect.uom)) return false;
      return true;
    });
    if(c.operator !== undefined) return nodesFor({ op: c.operator }).length > 0;
    if(c.periodShift !== undefined) return nodesFor({ shift: c.periodShift }).length > 0;
    if(c.arrow){
      const from = nodesFor(c.arrow.from).map(n => n.id), to = nodesFor(c.arrow.to).map(n => n.id);
      return edges.some(e => from.includes(e.from) && to.includes(e.to));
    }
    if(c.value){
      // Only once worked out on the canvas (Evaluate), so the step asks for what it says.
      return nodesFor(c.value.name).some(n => {
        if(!(n.id in computedValues)) return false;
        const v = valueAt(n, c.value.period || currentPeriod + 1);
        return typeof v === 'number' && Math.abs(v - Number(c.value.equals)) < 1e-9;
      });
    }
    if(c.periods !== undefined) return periods.length >= Number(c.periods);
    if(c.viewing !== undefined) return currentPeriod + 1 === Number(c.viewing);
    if(c.ownNumberIn) return nodesFor(c.ownNumberIn.name).some(n => {
      const want = c.ownNumberIn.periods.map(p => p - 1);
      return Array.isArray(n.literalPeriods) && n.literalPeriods.length === want.length && want.every(p => n.literalPeriods.includes(p));
    });
    return false;
  }
  function stepDone(step){ return Array.isArray(step.done) && step.done.length > 0 && step.done.every(checkPasses); }

  function tutorialTick(){
    if(!practice) return;
    const step = practice.tutorial.steps[practice.step];
    if(step && step.done && stepDone(step)) goToStep(practice.step + 1);
    else placePointer(step);
  }
  function goToStep(i){
    if(!practice) return;
    practice.step = Math.max(0, Math.min(practice.tutorial.steps.length - 1, i));
    renderTutorialCard();
  }

  // ---------- the coach card ----------
  function renderTutorialCard(){
    if(!practice) return;
    const t = practice.tutorial, i = practice.step, step = t.steps[i], last = i === t.steps.length - 1;
    let card = document.getElementById('tutorialCard');
    if(!card){ card = el('div', 'tutorial-card'); card.id = 'tutorialCard'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Tutorial'); document.body.appendChild(card); }
    card.textContent = '';
    card.dataset.tutorial = t.id;
    card.dataset.step = step.id;
    const head = el('div', 'tutorial-head');
    head.appendChild(el('span', 'tutorial-title', '🎓 ' + t.title));
    head.appendChild(el('span', 'tutorial-count', 'Step ' + (i + 1) + ' of ' + t.steps.length));
    card.appendChild(head);
    const bar = el('div', 'tutorial-progress');
    const fill = el('div', 'tutorial-progress-fill');
    fill.style.width = Math.round((i + 1) / t.steps.length * 100) + '%';
    bar.appendChild(fill);
    card.appendChild(bar);
    card.appendChild(help.richText('p', 'tutorial-text', step.text));
    if(step.done) card.appendChild(el('p', 'tutorial-waiting', 'Moves on by itself when that is done.'));
    const actions = el('div', 'tutorial-actions');
    const button = (label, cls, run) => { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', run); actions.appendChild(b); return b; };
    if(i > 0) button('‹ Back', 'tutorial-back', () => goToStep(i - 1));
    if(last){
      button('Download what I built', 'tutorial-download', () => downloadPractice());
      button('Finish', 'tutorial-finish primary', () => endTutorial());
    } else {
      if(!step.done) button('Next ›', 'tutorial-next primary', () => goToStep(i + 1));
      else button('Skip step', 'tutorial-skip', () => goToStep(i + 1));
      button('Exit tutorial', 'tutorial-exit', () => endTutorial());
    }
    card.appendChild(actions);
    placePointer(step);
  }

  // ---------- pointing at what to press ----------
  // A ribbon button (or, when it is on another tab, that tab), a rectangle, or one of its buttons.
  function pointerTarget(point){
    if(!point) return null;
    const visible = (e) => { if(!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    if(point.cmd){
      const b = Array.from(document.querySelectorAll('#ribbon [data-tip-cmd="' + point.cmd + '"]')).find(visible);
      if(b) return b;
      const tab = ribbonState.config.tabs.find(t => (t.groups || []).some(g => (g.items || []).some(it => it && it.cmd === point.cmd)));
      const tabEl = tab && ribbonTabEls.find(x => x.tab === tab);
      return tabEl && visible(tabEl.el) ? tabEl.el : null;
    }
    const nodeEl = (name) => { const n = nodesFor(name)[0]; return n ? canvas.querySelector('.node[data-id="' + n.id + '"]') : null; };
    if(point.node) return nodeEl(point.node);
    if(point.nodeButton){
      const e = nodeEl(point.nodeButton[0]);
      const b = e && e.querySelector('.' + point.nodeButton[1]);
      return b && visible(b) && getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden' ? b : e;
    }
    return null;
  }
  function placePointer(step){
    const target = pointerTarget(step && step.point);
    let ring = document.getElementById('tutorialPointer');
    if(!target){ if(ring) ring.remove(); return; }
    if(!ring){ ring = el('div', 'tutorial-pointer'); ring.id = 'tutorialPointer'; document.body.appendChild(ring); }
    const r = target.getBoundingClientRect();
    ring.style.left = (r.left - 4) + 'px';
    ring.style.top = (r.top - 4) + 'px';
    ring.style.width = (r.width + 8) + 'px';
    ring.style.height = (r.height + 8) + 'px';
  }
  function hidePointer(){ const ring = document.getElementById('tutorialPointer'); if(ring) ring.remove(); }

  // ---------- where tutorials are found: the top of the Help panel ----------
  function renderTutorialList(body, make){
    body.appendChild(make('h3', 'help-group', 'Tutorials'));
    TUTORIALS.forEach(t => {
      const row = make('div', 'help-tutorial');
      row.dataset.tutorial = t.id;
      const text = make('div', 'help-command-text');
      text.appendChild(make('div', 'help-command-name', '🎓 ' + t.title + ' · ' + t.minutes + ' min'));
      text.appendChild(make('div', 'help-command-sentence', t.summary));
      row.appendChild(text);
      const go = make('button', 'help-run help-tutorial-start', '▶');
      go.type = 'button';
      go.title = 'Start this tutorial (on a practice canvas; your model comes back untouched)';
      go.addEventListener('click', () => startTutorial(t.id));
      row.appendChild(go);
      body.appendChild(row);
    });
    const again = make('button', 'help-topic-link help-show-welcome');
    again.type = 'button';
    again.appendChild(make('span', 'help-topic-link-title', 'Show the welcome card'));
    again.addEventListener('click', () => { closeHelp(); showWelcomeCard(); });
    body.appendChild(again);
  }

  // ---------- the welcome card ----------
  function showWelcomeCard(){
    if(document.getElementById('welcomeCard') || practice) return;
    const card = el('div', 'welcome-card');
    card.id = 'welcomeCard';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Welcome to fmIDE');
    const x = el('button', 'welcome-close', '×');
    x.type = 'button';
    x.title = 'Close';
    x.addEventListener('click', () => hideWelcomeCard());
    card.appendChild(x);
    card.appendChild(el('h2', 'welcome-title', 'Welcome to fmIDE'));
    card.appendChild(el('p', 'welcome-text', 'Build a financial model as boxes and arrows, then turn it into a live Excel workbook. Behind this card is a small sample model to look around.'));
    const choice = (label, sub, cls, run) => {
      const b = el('button', 'welcome-choice ' + cls);
      b.type = 'button';
      b.appendChild(el('span', 'welcome-choice-label', label));
      b.appendChild(el('span', 'welcome-choice-sub', sub));
      b.addEventListener('click', run);
      card.appendChild(b);
    };
    choice('▶ Take the 5-minute tour', 'Build your first model, step by step', 'welcome-tour', () => startTutorial('first-model'));
    choice('Explore the sample model', 'It is already open behind this card', 'welcome-sample', () => hideWelcomeCard());
    choice('Start blank', 'An empty canvas', 'welcome-blank', () => { hideWelcomeCard(); runCommand('newDocument'); });
    choice('❓ Open Help', 'Guides to every feature (F1, any time)', 'welcome-help', () => { hideWelcomeCard(); openHelp(); });
    document.body.appendChild(card);
  }
  function hideWelcomeCard(){ const c = document.getElementById('welcomeCard'); if(c) c.remove(); }
