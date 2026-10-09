  // =====================================================================================
  // ---------- fmIDE on a phone (step 17, phase P2a; docs/step17-phones.md) ----------
  // =====================================================================================
  // On a touchscreen whose shorter side is under 600 pixels (isPhoneScreen, src/shared/phone.js)
  // fmIDE opens to the numbers, not the canvas (body.phone): a bar along the bottom with
  // Inputs · Watch · Canvas · ☰, the document's name and ↶ ↷ at the top, a strip of periods.
  // - Inputs: every input rectangle, by canvas, with a search box; each with the shared phone
  //   slider. A change is a change to the model, as typed on a computer: one undo step per
  //   gesture (pushed on its first change), the document marked unsaved, the autosave. An input
  //   with a number per period is changed in the period shown, or, with "All periods by %", all
  //   of them together. The slider's range is half the number either way (any number can be
  //   typed); its notch is the number when the document was opened. An input on a canvas used
  //   as a block says how many blocks use it.
  // - Watch: the rectangles starred (★), at the top of Inputs while inputs change and on their
  //   own screen, each with how far it has moved since the document was opened. Kept in this
  //   browser per document (fmIDE-phone: the person's own, never in a file).
  // - Canvas: to look at — fitted, pinch to zoom (13b), a canvas picked from a list; editing is
  //   held back (no press reaches the canvas); a tap on a rectangle opens its card: its value
  //   in every period, what it is worked out from and what reads it, in words, ★, and its
  //   slider if it is an input.
  // - ☰: Open…, Open Recent…, Save, ⇪ Share the document (P2b: the share sheet, a copy — the
  //   document stays unsaved until Save), 📈 Open fmGraph (with the model, as on a computer),
  //   📊 Make Excel (P3: ExcelExporter with the model, in its phone screen),
  //   ⤓ Install fmIDE (on the site, not installed), Help, Full app (the whole fmIDE; 📱 Phone
  //   layout back).
  // - The install note (P2b): on the site and not installed, a card at the top of Inputs says a
  //   browser may clear what fmIDE keeps (Safari on an iPhone after some weeks without a visit)
  //   and how to install; shown until Got it (installNoteSeen, fmIDE-phone).
  // Everything from the model is shown as text.
  // build:include shared/phone.js

  // (var: render() and updateDocTitle() may run before this file has started; they look at it.)
  var phoneReady = false;
  const PHONE_KEY = 'fmIDE-phone';
  const PHONE_WATCH_DOCS = 50;          // documents whose Watch list is kept
  const PHONE_WATCH_MAX = 30;           // rectangles watched in one document
  let phoneSettings = { fullApp: false, vibrate: true, installNoteSeen: false, watch: {} };
  let phoneSettingsRead = false;        // the install note waits for the settings
  let phoneView = 'inputs';             // 'inputs' | 'watch' | 'canvas'
  let phoneQuery = '';
  let phoneStructure = '';              // what the Inputs list was built from
  let phoneStartSerial = null;          // the document the starting numbers belong to
  let phoneStart = new Map();           // 'canvas|node' → [number per period] when the document was opened
  const phoneAllPeriods = new Map();    // 'canvas|node' → the numbers when "All periods by %" was turned on
  const phoneControls = new Map();      // 'canvas|node' → its slider (Inputs and the card)
  let phoneRefreshPending = false;
  let phoneCardFor = null;              // { canvasId, nodeId } of the card shown

  function isPhone(){ return document.body.classList.contains('phone'); }
  const phoneKey = (canvasId, nodeId) => canvasId + '|' + nodeId;
  const pmk = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined && text !== null) e.textContent = String(text); return e; };

  // ---- the page ----
  const phoneUi = (() => {
    const top = pmk('header', 'phone-top phone-only');
    top.id = 'phoneTop';
    const title = pmk('div', 'phone-title');
    title.id = 'phoneTitle';
    const undoB = pmk('button', 'phone-icon', '↶'); undoB.id = 'phoneUndo'; undoB.setAttribute('aria-label', 'Undo');
    const redoB = pmk('button', 'phone-icon', '↷'); redoB.id = 'phoneRedo'; redoB.setAttribute('aria-label', 'Redo');
    top.append(title, undoB, redoB);
    const strip = pmk('div', 'phone-periods phone-only');
    strip.id = 'phonePeriods';
    const prev = pmk('button', 'phone-icon', '‹'); prev.id = 'phonePrevPeriod'; prev.setAttribute('aria-label', 'Previous period');
    const pick = pmk('select', 'phone-period-pick'); pick.id = 'phonePeriodPick'; pick.setAttribute('aria-label', 'Period');
    const next = pmk('button', 'phone-icon', '›'); next.id = 'phoneNextPeriod'; next.setAttribute('aria-label', 'Next period');
    strip.append(prev, pick, next);
    const panel = pmk('main', 'phone-panel phone-only');
    panel.id = 'phonePanel';
    const canvasBar = pmk('div', 'phone-canvas-bar phone-only');
    canvasBar.id = 'phoneCanvasBar';
    const canvasPick = pmk('select', 'phone-canvas-pick'); canvasPick.id = 'phoneCanvasPick'; canvasPick.setAttribute('aria-label', 'Canvas');
    canvasBar.append(canvasPick, pmk('span', 'phone-canvas-hint', 'Tap a rectangle for its numbers'));
    const nav = pmk('nav', 'phone-nav phone-only');
    nav.id = 'phoneNav';
    nav.setAttribute('aria-label', 'Phone views');
    [['inputs', '🎚', 'Inputs'], ['watch', '★', 'Watch'], ['canvas', '▦', 'Canvas'], ['menu', '☰', 'More']].forEach(([id, icon, label]) => {
      const b = pmk('button', 'phone-nav-btn');
      b.type = 'button';
      b.dataset.view = id;
      b.id = 'phoneNav-' + id;
      b.append(pmk('span', 'phone-nav-icon', icon), pmk('span', 'phone-nav-label', label));
      nav.appendChild(b);
    });
    const menu = pmk('div', 'phone-menu hidden');
    menu.id = 'phoneMenu';
    menu.setAttribute('role', 'menu');
    [['phoneOpen', '📁 Open…'], ['phoneRecent', '🕘 Open Recent…'], ['phoneSave', '💾 Save'], ['phoneShare', '⇪ Share the document'],
      ['phoneGraph', '📈 Open fmGraph'], ['phoneExcel', '📊 Make Excel'], ['phoneInstall', '⤓ Install fmIDE'], ['phoneHelp', '❓ Help'], ['phoneFullApp', '🖥 Full app']].forEach(([id, text]) => {
      const b = pmk('button', null, text); b.type = 'button'; b.id = id; b.setAttribute('role', 'menuitem'); menu.appendChild(b);
    });
    const vib = pmk('button', 'hidden', ''); vib.type = 'button'; vib.id = 'phoneVibrate'; vib.setAttribute('role', 'menuitemcheckbox');
    menu.insertBefore(vib, menu.querySelector('#phoneHelp'));
    const back = pmk('div', 'phone-card-back hidden');
    back.id = 'phoneCardBack';
    const card = pmk('div', 'phone-card');
    card.id = 'phoneCard';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    back.appendChild(card);
    const layoutBtn = pmk('button', 'phone-layout-btn hidden', '📱 Phone layout');
    layoutBtn.type = 'button';
    layoutBtn.id = 'phoneLayoutBtn';
    document.body.append(top, strip, panel, canvasBar, nav, menu, back, layoutBtn);
    return { top, title, undoB, redoB, prev, pick, next, panel, canvasPick, nav, menu, vib, back, card, layoutBtn };
  })();

  function applyPhoneLayout(){
    const screenIsPhone = isPhoneScreen();
    const on = screenIsPhone && !phoneSettings.fullApp;
    const was = isPhone();
    document.body.classList.toggle('phone-screen', screenIsPhone);
    document.body.classList.toggle('phone', on);
    phoneUi.layoutBtn.classList.toggle('hidden', !(screenIsPhone && phoneSettings.fullApp));
    if(!on){ closePhoneMenu(); closePhoneCard(); document.body.classList.remove('phone-canvas'); }
    if(on && !was){ phoneStructure = ''; showPhoneView(phoneView); }
  }
  function setPhoneFullApp(full){
    phoneSettings.fullApp = !!full;
    savePhoneSettings();
    applyPhoneLayout();
  }

  // ---- settings: this browser only ----
  function cleanPhoneSettings(raw){
    const out = { fullApp: false, vibrate: true, installNoteSeen: false, watch: {} };
    let d = null;
    try{ d = JSON.parse(raw); }catch(e){ return out; }
    if(!d || typeof d !== 'object') return out;
    out.fullApp = d.fullApp === true;
    out.vibrate = d.vibrate !== false;
    out.installNoteSeen = d.installNoteSeen === true;
    if(d.watch && typeof d.watch === 'object' && !Array.isArray(d.watch)){
      Object.keys(d.watch).slice(-PHONE_WATCH_DOCS).forEach(k => {
        const v = d.watch[k];
        if(k.length <= 400 && Array.isArray(v)) out.watch[k] = v.filter(x => typeof x === 'string' && x.length <= 200).slice(0, PHONE_WATCH_MAX);
      });
    }
    return out;
  }
  function savePhoneSettings(){ workspaceStore.put(PHONE_KEY, JSON.stringify(phoneSettings)).catch(() => {}); }
  // The open document, for its Watch list: its Recent entry or name, and its canvases.
  function phoneDocKey(){
    syncActiveIntoRegistry();
    return String(currentDoc.recentId || currentDoc.name || 'untitled').slice(0, 120) + '|' + canvases.map(c => c.id).join(',').slice(0, 260);
  }
  function watchedKeys(){ return phoneSettings.watch[phoneDocKey()] || []; }
  function isWatched(key){ return watchedKeys().includes(key); }
  function toggleWatch(key){
    const doc = phoneDocKey();
    const list = (phoneSettings.watch[doc] || []).slice();
    const i = list.indexOf(key);
    if(i >= 0) list.splice(i, 1);
    else { if(list.length >= PHONE_WATCH_MAX){ toast('At most ' + PHONE_WATCH_MAX + ' rectangles can be watched.'); return; } list.push(key); }
    delete phoneSettings.watch[doc];
    if(list.length) phoneSettings.watch[doc] = list; // the most recent last, so the oldest go first
    const docs = Object.keys(phoneSettings.watch);
    if(docs.length > PHONE_WATCH_DOCS) delete phoneSettings.watch[docs[0]];
    savePhoneSettings();
    phoneStructure = '';
    phoneRefreshNow();
  }

  // ---- the model, read for the phone ----
  function phoneCanvas(canvasId){ syncActiveIntoRegistry(); return canvases.find(c => c.id === canvasId) || null; }
  function phoneNode(canvasId, nodeId){ const c = phoneCanvas(canvasId); return c ? c.nodes.find(n => n.id === nodeId) || null : null; }
  // The value shown in period p: { value } or { error }.
  function phoneValue(canvasId, nodeId, p){
    const c = phoneCanvas(canvasId);
    if(!c || !c.periodComputedValues) return { error: true };
    const err = c.periodComputeErrors && c.periodComputeErrors[p] && c.periodComputeErrors[p][nodeId];
    if(err) return { error: err };
    const v = c.periodComputedValues[p] && c.periodComputedValues[p][nodeId];
    return typeof v === 'number' && isFinite(v) ? { value: v } : { error: true };
  }
  function phoneName(c, n){
    if(!n) return '?';
    if(n.type === 'value'){ const p = parseNode(n); return p.name || (p.literal !== null ? String(p.literal) : 'Untitled'); }
    if(n.type === 'alias'){ const src = phoneNode(n.sourceCanvasId, n.sourceNodeId); const sc = phoneCanvas(n.sourceCanvasId); return src ? phoneName(sc, src) : 'an alias to nothing'; }
    if(n.type === 'blockInstance'){ const d = phoneCanvas(n.blockDefCanvasId); return 'block ' + (d ? d.name : '?'); }
    if(n.type === 'function') return (n.fn && n.fn.name ? n.fn.name : 'function') + '(…)';
    if(n.type === 'periodShift') return 'a period shift';
    return n.text || '?';
  }
  // Canvases used as a block: canvas id → how many block instances use it.
  function phoneBlockUses(){
    const uses = new Map();
    canvases.forEach(c => c.nodes.forEach(n => { if(n.type === 'blockInstance' && n.blockDefCanvasId) uses.set(n.blockDefCanvasId, (uses.get(n.blockDefCanvasId) || 0) + 1); }));
    return uses;
  }
  // Every input rectangle with a typed number (or a number per period), by canvas.
  function phoneInputs(){
    syncActiveIntoRegistry();
    const out = [];
    canvases.forEach(c => c.nodes.forEach(n => {
      if(n.type !== 'value' || !isInputRectangle(c, n)) return;
      const p = parseNode(n);
      const perPeriod = Array.isArray(n.periodValues);
      if(!perPeriod && p.literal === null) return; // a formula or nothing typed: not a number to slide
      out.push({ canvasId: c.id, nodeId: n.id, key: phoneKey(c.id, n.id), name: p.name || 'Untitled', unit: p.uom, perPeriod });
    }));
    return out;
  }
  // The input's own number in period p (what the slider shows).
  function phoneInputNumber(n, p){
    if(Array.isArray(n.periodValues) && typeof n.periodValues[p] === 'number') return n.periodValues[p];
    const lit = parseNode(n).literal;
    return lit === null ? 0 : lit;
  }
  // The numbers when the document was opened (the notch, and "since you started").
  function phoneStartValues(key, canvasId, nodeId){
    if(phoneStartSerial !== currentDoc.serial){ phoneStartSerial = currentDoc.serial; phoneStart = new Map(); phoneAllPeriods.clear(); }
    if(!phoneStart.has(key)) phoneStart.set(key, periods.map((_, p) => phoneValue(canvasId, nodeId, p)));
    return phoneStart.get(key);
  }

  // ---- changing an input: a change to the model ----
  // One undo step per gesture, pushed on its first change; the calculation once per frame.
  let phoneGesture = { pushed: false };
  let phoneCalcPending = false;
  function phoneStartGesture(){ phoneGesture = { pushed: false }; }
  function phoneChanging(){ if(!phoneGesture.pushed){ pushHistory(); phoneGesture.pushed = true; } }
  function phoneCalcSoon(){
    clearComputed();
    if(phoneCalcPending) return;
    phoneCalcPending = true;
    requestAnimationFrame(() => { phoneCalcPending = false; evaluateAll(); });
  }
  function setPhoneNumber(item, v, p){
    const n = phoneNode(item.canvasId, item.nodeId);
    if(!n || !isFinite(v)) return;
    phoneChanging();
    if(Array.isArray(n.periodValues)){
      n.periodValues[p] = v;
      if(n.periodValuesRange){ n.periodValuesRange.min = Math.min(n.periodValuesRange.min, v); n.periodValuesRange.max = Math.max(n.periodValuesRange.max, v); }
    } else {
      const parts = textParts(n);
      parts.value = String(v);
      n.text = composeText(parts);
    }
    phoneCalcSoon();
  }
  // "All periods by %": every period's number from the ones when it was turned on.
  function setPhoneAllPeriods(item, pct){
    const n = phoneNode(item.canvasId, item.nodeId);
    const from = phoneAllPeriods.get(item.key);
    if(!n || !Array.isArray(n.periodValues) || !from) return;
    phoneChanging();
    n.periodValues = from.map(x => Number((x * (1 + pct / 100)).toPrecision(12)));
    if(n.periodValuesRange){
      n.periodValuesRange.min = Math.min(n.periodValuesRange.min, ...n.periodValues);
      n.periodValuesRange.max = Math.max(n.periodValuesRange.max, ...n.periodValues);
    }
    phoneCalcSoon();
  }

  // A 1-2-5 step near x (the slider's step: about 20 either side of the number).
  function phoneNiceStep(x){
    if(!(x > 0) || !isFinite(x)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return Number(((f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p).toPrecision(6));
  }
  // Half the number either way (10 either way around 0), in steps of about a twentieth of that.
  function phoneRange(v){
    const span = Math.abs(v) > 0 ? Math.abs(v) * 0.5 : 10;
    const step = phoneNiceStep(span / 20);
    const r = (x) => Number(x.toPrecision(12));
    return { min: r(Math.floor((v - span) / step) * step), max: r(Math.ceil((v + span) / step) * step), step };
  }
  const phoneFmt = (v) => (typeof v === 'number' && isFinite(v)) ? fmtNumberPlain(v) : '—';
  function fmtNumberPlain(v){
    if(v === 0) v = 0;
    const a = Math.abs(v), digits = a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 3 : 4;
    return v.toLocaleString('en-US', { maximumFractionDigits: digits }).replace('-', '−');
  }
  function phoneDiff(now, was){
    const d = now - was;
    if(!isFinite(d) || Math.abs(d) < 1e-12 * Math.max(1, Math.abs(was))) return '';
    let t = (d > 0 ? '+' : '−') + fmtNumberPlain(Math.abs(d));
    if(was !== 0 && isFinite(was)) t += ' (' + (d > 0 ? '+' : '−') + Math.abs(d / Math.abs(was) * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%)';
    return t;
  }

  // An input's card: its name, ★, what it is, and its slider.
  function phoneInputCard(item, blockUses){
    const n = phoneNode(item.canvasId, item.nodeId);
    const p = currentPeriod;
    const card = pmk('div', 'phone-input');
    card.dataset.key = item.key;
    const head = pmk('div', 'phone-input-head');
    head.appendChild(pmk('span', 'phone-input-name', item.name));
    if(item.unit) head.appendChild(pmk('span', 'phone-input-unit', item.unit));
    head.appendChild(pmk('span', 'phone-input-change'));
    const star = pmk('button', 'phone-star', isWatched(item.key) ? '★' : '☆');
    star.type = 'button';
    star.setAttribute('aria-pressed', isWatched(item.key) ? 'true' : 'false');
    star.setAttribute('aria-label', 'Watch ' + item.name);
    star.addEventListener('click', () => toggleWatch(item.key));
    head.appendChild(star);
    card.appendChild(head);
    if(blockUses) card.appendChild(pmk('div', 'phone-input-note', 'Used in ' + blockUses + (blockUses === 1 ? ' block' : ' blocks') + ': a change here changes every copy.'));
    const all = item.perPeriod && phoneAllPeriods.has(item.key);
    const start = phoneStartValues(item.key, item.canvasId, item.nodeId);
    const startNow = start[p] && !start[p].error ? start[p].value : phoneInputNumber(n, p);
    let ctl;
    if(all){
      ctl = createPhoneSlider({ label: item.name + ', all periods', min: -50, max: 50, step: 1, value: Number(card.dataset.pct || 0), base: 0,
        format: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNumberPlain(Math.abs(v)) + '%',
        vibrate: () => phoneSettings.vibrate,
        onStart: phoneStartGesture,
        onInput: (v) => { phoneAllPct.set(item.key, v); setPhoneAllPeriods(item, v); },
        onEnd: () => {} });
      ctl.setValue(phoneAllPct.get(item.key) || 0);
    } else {
      const now = phoneInputNumber(n, p);
      ctl = createPhoneSlider(Object.assign(phoneRange(now), { label: item.name, value: now, base: startNow,
        format: (v) => fmtNumberPlain(v),
        vibrate: () => phoneSettings.vibrate,
        onStart: phoneStartGesture,
        onInput: (v) => setPhoneNumber(item, v, currentPeriod),
        onEnd: () => { phoneStructure = ''; phoneRefreshSoon(); } })); // a new range around the new number
    }
    phoneControls.set(item.key, { ctl, all });
    card.appendChild(ctl.el);
    const foot = pmk('div', 'phone-input-foot');
    foot.appendChild(pmk('span', 'phone-input-start'));
    if(item.perPeriod){
      const label = pmk('label', 'phone-all');
      const box = pmk('input');
      box.type = 'checkbox';
      box.checked = all;
      box.addEventListener('change', () => {
        if(box.checked){ const node = phoneNode(item.canvasId, item.nodeId); phoneAllPeriods.set(item.key, node.periodValues.slice()); phoneAllPct.set(item.key, 0); }
        else { phoneAllPeriods.delete(item.key); phoneAllPct.delete(item.key); }
        phoneStructure = '';
        phoneRefreshNow();
      });
      label.append(box, document.createTextNode(' All periods by %'));
      foot.appendChild(label);
    }
    card.appendChild(foot);
    return card;
  }
  const phoneAllPct = new Map(); // 'canvas|node' → the % "All periods by %" is at

  // The Watch rows: name, the value in the period shown, how far it has moved.
  function phoneWatchList(into){
    const keys = watchedKeys();
    keys.forEach(key => {
      const [canvasId, nodeId] = key.split('|');
      const c = phoneCanvas(canvasId), n = phoneNode(canvasId, nodeId);
      if(!c || !n) return;
      const row = pmk('button', 'phone-watch-row');
      row.type = 'button';
      row.dataset.key = key;
      row.append(pmk('span', 'phone-watch-name', phoneName(c, n)), pmk('span', 'phone-watch-value'), pmk('span', 'phone-watch-change'));
      row.addEventListener('click', () => openPhoneCard(canvasId, nodeId));
      into.appendChild(row);
    });
  }

  // ---- drawing the views ----
  function phoneStructureNow(){
    const items = phoneInputs();
    return { items, sig: phoneView + '|' + phoneQuery + '|' + currentPeriod + '|' + items.map(i => i.key + ':' + i.name + ':' + i.perPeriod + ':' + phoneAllPeriods.has(i.key)).join(';')
      + '|' + watchedKeys().join(',') + '|' + canvases.map(c => c.id + ':' + c.name).join(',') + '|' + phoneDocKey()
      + '|' + phoneInstallNoteWanted() + ':' + !!installPrompt };
  }
  function phoneRebuild(items){
    const panel = phoneUi.panel;
    const scroll = panel.scrollTop;
    panel.textContent = '';
    phoneControls.clear();
    if(phoneView === 'canvas'){ panel.scrollTop = 0; return; }
    if(phoneView === 'watch' || watchedKeys().length){
      const box = pmk('section', 'phone-watch');
      box.id = 'phoneWatch';
      box.appendChild(pmk('h2', 'phone-head', 'Watching'));
      phoneWatchList(box);
      if(!watchedKeys().length) box.appendChild(pmk('p', 'phone-empty', 'Nothing watched yet: ☆ on an input, or tap a rectangle on the canvas and ☆ Watch.'));
      panel.appendChild(box);
    }
    if(phoneView === 'inputs' && phoneInstallNoteWanted()) panel.insertBefore(phoneInstallNote(), panel.firstChild);
    if(phoneView === 'inputs'){
      const search = pmk('input', 'phone-search');
      search.type = 'search';
      search.id = 'phoneSearch';
      search.placeholder = 'Search inputs';
      search.setAttribute('aria-label', 'Search inputs');
      search.value = phoneQuery;
      search.addEventListener('input', () => { phoneQuery = search.value; phoneRefreshNow(); const s = document.getElementById('phoneSearch'); if(s){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
      panel.appendChild(search);
      const q = phoneQuery.trim().toLowerCase();
      const uses = phoneBlockUses();
      const shown = items.filter(i => !q || i.name.toLowerCase().includes(q) || (phoneCanvas(i.canvasId) || {}).name.toLowerCase().includes(q));
      if(!items.length) panel.appendChild(pmk('p', 'phone-empty', 'This model has no inputs with a number to change.'));
      else if(!shown.length) panel.appendChild(pmk('p', 'phone-empty', 'No input matches “' + phoneQuery.slice(0, 60) + '”.'));
      canvases.forEach(c => {
        const mine = shown.filter(i => i.canvasId === c.id);
        if(!mine.length) return;
        const group = pmk('section', 'phone-group');
        group.dataset.canvas = c.id;
        group.appendChild(pmk('h2', 'phone-head', c.name));
        mine.forEach(i => group.appendChild(phoneInputCard(i, uses.get(c.id) || 0)));
        panel.appendChild(group);
      });
    }
    panel.scrollTop = scroll;
  }
  // The numbers and words that follow the model (no slider is rebuilt while one is held).
  function phoneUpdateValues(){
    const p = currentPeriod;
    document.querySelectorAll('#phonePanel .phone-input').forEach(card => {
      const key = card.dataset.key, [canvasId, nodeId] = key.split('|');
      const n = phoneNode(canvasId, nodeId), entry = phoneControls.get(key);
      if(!n || !entry) return;
      const start = phoneStartValues(key, canvasId, nodeId)[p];
      const shown = phoneValue(canvasId, nodeId, p);
      if(!entry.all && !entry.ctl.dragging()) entry.ctl.setValue(phoneInputNumber(n, p));
      const was = start && !start.error ? start.value : null;
      card.querySelector('.phone-input-change').textContent = (was !== null && !shown.error) ? phoneDiff(shown.value, was) : '';
      card.querySelector('.phone-input-start').textContent = was !== null ? 'At the start: ' + fmtNumberPlain(was) : '';
      card.classList.toggle('moved', was !== null && !shown.error && shown.value !== was);
    });
    document.querySelectorAll('#phonePanel .phone-watch-row').forEach(row => {
      const [canvasId, nodeId] = row.dataset.key.split('|');
      const now = phoneValue(canvasId, nodeId, p);
      const start = phoneStartValues(row.dataset.key, canvasId, nodeId)[p];
      row.querySelector('.phone-watch-value').textContent = now.error ? '!' : fmtNumberPlain(now.value);
      const d = !now.error && start && !start.error ? phoneDiff(now.value, start.value) : '';
      const ch = row.querySelector('.phone-watch-change');
      ch.textContent = d;
      ch.className = 'phone-watch-change' + (d ? (now.value > start.value ? ' up' : ' down') : '');
    });
    if(phoneCardFor) fillPhoneCardValues();
  }
  function phoneTopBar(){
    phoneUi.title.textContent = docDisplayName() + (currentDoc.dirty ? ' •' : '');
    phoneUi.undoB.disabled = !history.length;
    phoneUi.redoB.disabled = !future.length;
    const pick = phoneUi.pick;
    if(pick.options.length !== periods.length || [...pick.options].some((o, i) => o.textContent !== periods[i])){
      pick.textContent = '';
      periods.forEach((name, i) => { const o = pmk('option', null, name); o.value = String(i); pick.appendChild(o); });
    }
    pick.value = String(currentPeriod);
    phoneUi.prev.disabled = currentPeriod <= 0;
    phoneUi.next.disabled = currentPeriod >= periods.length - 1;
    document.body.classList.toggle('phone-one-period', periods.length < 2); // no strip for one period
    const cp = phoneUi.canvasPick;
    if(cp.options.length !== canvases.length || canvases.some((c, i) => cp.options[i].value !== c.id || cp.options[i].textContent !== c.name)){
      cp.textContent = '';
      canvases.forEach(c => { const o = pmk('option', null, c.name); o.value = c.id; cp.appendChild(o); });
    }
    cp.value = activeCanvasId;
    phoneUi.nav.querySelectorAll('.phone-nav-btn').forEach(b => b.setAttribute('aria-current', b.dataset.view === phoneView ? 'page' : 'false'));
  }
  function phoneRefreshNow(){
    if(!isPhone() || !canvases.length) return;
    const now = phoneStructureNow();
    const holding = [...phoneControls.values()].some(e => e.ctl.dragging());
    if(now.sig !== phoneStructure && !holding){ phoneStructure = now.sig; phoneRebuild(now.items); }
    phoneTopBar();
    phoneUpdateValues();
  }
  function phoneRefreshSoon(){
    if(!isPhone() || phoneRefreshPending) return;
    phoneRefreshPending = true;
    requestAnimationFrame(() => { phoneRefreshPending = false; phoneRefreshNow(); });
  }
  function showPhoneView(view){
    phoneView = view === 'watch' || view === 'canvas' ? view : 'inputs';
    document.body.classList.toggle('phone-canvas', phoneView === 'canvas');
    closePhoneMenu();
    phoneStructure = '';
    phoneRefreshNow();
    if(phoneView === 'canvas') requestAnimationFrame(() => { try{ zoomToFit(); }catch(e){ /* nothing to fit */ } });
  }

  // ---- the canvas: to look at; a tap on a rectangle opens its card ----
  const viewportEl = document.getElementById('viewport');
  let phoneTap = null;
  // The card opens on the tap's click (opened on its lift, the click would land on the card's
  // dim background and close it again).
  let phoneTapped = null;
  ['pointerdown', 'mousedown', 'dblclick', 'click', 'contextmenu'].forEach(type => viewportEl.addEventListener(type, (ev) => {
    if(!isPhone()) return;
    ev.stopPropagation(); // nothing on the canvas is edited on a phone
    if(type === 'contextmenu' || type === 'dblclick') ev.preventDefault();
    if(type === 'pointerdown'){
      const el = ev.target.closest && ev.target.closest('.node');
      phoneTap = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, node: el ? el.dataset.id : null };
      phoneTapped = null;
    }
    if(type === 'click' && phoneTapped){
      const n = getNode(phoneTapped);
      phoneTapped = null;
      if(n && (n.type === 'value' || n.type === 'alias')) openPhoneCard(activeCanvasId, n.id);
    }
  }, true));
  viewportEl.addEventListener('pointerup', (ev) => {
    if(!isPhone()) return;
    ev.stopPropagation();
    const t = phoneTap;
    phoneTap = null;
    if(t && t.id === ev.pointerId && t.node && Math.hypot(ev.clientX - t.x, ev.clientY - t.y) <= 12) phoneTapped = t.node;
  }, true);
  phoneUi.canvasPick.addEventListener('change', () => { switchToCanvas(phoneUi.canvasPick.value); render(); requestAnimationFrame(() => { try{ zoomToFit(); }catch(e){ /* nothing */ } }); });

  // In words: what a node is worked out from.
  function phoneFormula(c, nodeId, depth){
    const n = c.nodes.find(x => x.id === nodeId);
    if(!n) return '?';
    if(n.type !== 'operator' || depth > 2) return phoneName(c, n);
    const ins = c.edges.filter(e => e.to === n.id).sort((a, b) => (a.toPort || 0) - (b.toPort || 0) || ((c.nodes.find(x => x.id === a.from) || {}).x || 0) - ((c.nodes.find(x => x.id === b.from) || {}).x || 0));
    const parts = ins.map(e => { const s = c.nodes.find(x => x.id === e.from); return s && s.type === 'operator' ? '(' + phoneFormula(c, s.id, depth + 1) + ')' : phoneShiftWords(c, e.from, depth); });
    const op = String(n.text || '?');
    return /^[+\-−×÷*/^]$/.test(op) ? parts.join(' ' + op + ' ') : op + '(' + parts.join(', ') + ')';
  }
  function phoneShiftWords(c, nodeId, depth){
    const n = c.nodes.find(x => x.id === nodeId);
    if(!n || n.type !== 'periodShift') return phoneName(c, n);
    const into = c.edges.find(e => e.to === n.id);
    const what = into ? phoneFormula(c, into.from, depth + 1) : 'nothing';
    const k = typeof n.shift === 'number' ? n.shift : -1;
    return what + (k === -1 ? ' in the period before' : k === 1 ? ' in the period after' : ' ' + Math.abs(k) + ' periods ' + (k < 0 ? 'before' : 'after'));
  }
  function phoneWorkedOutFrom(c, n){
    if(n.type === 'alias'){ const sc = phoneCanvas(n.sourceCanvasId); return 'The same as ' + phoneName(c, n) + (sc ? ' on ' + sc.name : '') + '.'; }
    const ins = c.edges.filter(e => e.to === n.id);
    if(isInputRectangle(c, n)) return Array.isArray(n.periodValues) ? 'An input: its own number in each period.' : 'An input: a number typed in.';
    if(ins.length === 1) return '= ' + phoneFormula(c, ins[0].from, 0);
    return '= ' + ins.map(e => phoneFormula(c, e.from, 0)).join(' + ');
  }
  // What reads it: the rectangles its arrows lead to (through operators and period shifts).
  function phoneReadBy(c, n){
    const out = new Set(), seen = new Set([n.id]);
    let todo = c.edges.filter(e => e.from === n.id).map(e => e.to);
    while(todo.length && out.size < 12){
      const id = todo.shift();
      if(seen.has(id)) continue;
      seen.add(id);
      const t = c.nodes.find(x => x.id === id);
      if(!t) continue;
      if(t.type === 'value' || t.type === 'blockInstance' || t.type === 'function') out.add(phoneName(c, t));
      else todo = todo.concat(c.edges.filter(e => e.from === id).map(e => e.to));
    }
    canvases.forEach(other => other.nodes.forEach(a => {
      if(a.type === 'alias' && a.sourceCanvasId === c.id && a.sourceNodeId === n.id && other.id !== c.id) out.add('the ' + other.name + ' canvas');
    }));
    return [...out];
  }

  function openPhoneCard(canvasId, nodeId){
    const c = phoneCanvas(canvasId), n = phoneNode(canvasId, nodeId);
    if(!c || !n) return;
    phoneCardFor = { canvasId, nodeId };
    const card = phoneUi.card;
    card.textContent = '';
    const key = phoneKey(canvasId, nodeId);
    const head = pmk('div', 'phone-card-head');
    const title = pmk('h3', null, phoneName(c, n));
    title.id = 'phoneCardTitle';
    card.setAttribute('aria-labelledby', 'phoneCardTitle');
    const close = pmk('button', 'phone-icon phone-card-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', closePhoneCard);
    head.append(title, close);
    card.appendChild(head);
    const unit = n.type === 'value' ? parseNode(n).uom : null;
    card.appendChild(pmk('div', 'phone-card-where', c.name + (unit ? ' · in ' + unit : '')));
    card.appendChild(pmk('p', 'phone-card-formula', phoneWorkedOutFrom(c, n)));
    const readers = phoneReadBy(c, n);
    if(readers.length) card.appendChild(pmk('p', 'phone-card-readers', 'Read by ' + readers.join(', ') + '.'));
    const star = pmk('button', 'phone-card-star', isWatched(key) ? '★ Watching' : '☆ Watch');
    star.type = 'button';
    star.setAttribute('aria-pressed', isWatched(key) ? 'true' : 'false');
    star.addEventListener('click', () => { toggleWatch(key); openPhoneCard(canvasId, nodeId); });
    card.appendChild(star);
    const item = phoneInputs().find(i => i.key === key);
    if(item){
      const slot = pmk('div', 'phone-card-input');
      slot.appendChild(phoneInputCard(item, phoneBlockUses().get(canvasId) || 0));
      slot.querySelector('.phone-star').remove(); // the card's own ★ above
      card.appendChild(slot);
    }
    const table = pmk('table', 'phone-card-table');
    const tr = pmk('tr');
    ['Period', 'Value', 'Since the start'].forEach(t => tr.appendChild(pmk('th', null, t)));
    const thead = pmk('thead'); thead.appendChild(tr);
    table.append(thead, pmk('tbody'));
    card.appendChild(table);
    phoneUi.back.classList.remove('hidden');
    fillPhoneCardValues();
  }
  function fillPhoneCardValues(){
    if(!phoneCardFor) return;
    const { canvasId, nodeId } = phoneCardFor;
    const key = phoneKey(canvasId, nodeId);
    const body = phoneUi.card.querySelector('.phone-card-table tbody');
    if(!body) return;
    const start = phoneStartValues(key, canvasId, nodeId);
    body.textContent = '';
    periods.forEach((name, p) => {
      const v = phoneValue(canvasId, nodeId, p), s = start[p];
      const row = pmk('tr', p === currentPeriod ? 'now' : null);
      row.appendChild(pmk('td', null, name));
      row.appendChild(pmk('td', 'num', v.error ? '!' : fmtNumberPlain(v.value)));
      const d = !v.error && s && !s.error ? phoneDiff(v.value, s.value) : '';
      row.appendChild(pmk('td', 'num' + (d ? (v.value > s.value ? ' up' : ' down') : ''), d || '—'));
      body.appendChild(row);
    });
    const slot = phoneUi.card.querySelector('.phone-card-input .phone-input');
    if(slot){
      const n = phoneNode(canvasId, nodeId);
      const entry = phoneControls.get(key);
      if(n && entry && !entry.all && !entry.ctl.dragging()) entry.ctl.setValue(phoneInputNumber(n, currentPeriod));
    }
  }
  function closePhoneCard(){
    phoneCardFor = null;
    phoneUi.back.classList.add('hidden');
    phoneUi.card.textContent = '';
    phoneStructure = '';
    phoneRefreshSoon();
  }
  phoneUi.back.addEventListener('click', (ev) => { if(ev.target === phoneUi.back) closePhoneCard(); });

  // ---- getting the work out (P2b) ----
  // ⇪ Share the document: the .fmide file (as Save writes it) to the phone's share sheet, or a
  // download where the browser can't share files. A copy: the document stays unsaved.
  async function sharePhoneDocument(){
    if(inPractice()){ toast('Not while practising a tutorial.'); return null; }
    const fileName = withDocExt(docDisplayName());
    const file = new File([documentText()], fileName, { type: 'application/octet-stream' });
    const how = await shareFiles([file], docDisplayName());
    if(how === 'shared') toast('Shared a copy of “' + fileName + '”. 💾 Save keeps your own file.', 4000);
    else if(how === 'downloaded') toast('Downloaded a copy: ' + fileName, 4000);
    return how;
  }
  // The install note: only on the published site (a manifest; opened from disk there is nothing
  // to install), and not inside the installed app.
  function phoneOnSite(){ return !!document.querySelector('link[rel="manifest"]') && /^https?:$/.test(location.protocol); }
  function phoneInstalled(){
    try{
      if(navigator.standalone === true) return true;
      return ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia('(display-mode: ' + m + ')').matches);
    }catch(e){ return false; }
  }
  function phoneIsIos(){
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function phoneInstallOffered(){ return phoneOnSite() && !phoneInstalled(); }
  function phoneInstallNoteWanted(){ return phoneSettingsRead && !phoneSettings.installNoteSeen && phoneInstallOffered(); }
  function phoneInstallSteps(){
    if(phoneIsIos()) return 'To install fmIDE: tap Share ⇪ in Safari, then Add to Home Screen. fmIDE then opens from its own icon and keeps your work.';
    if(installPrompt) return 'To install fmIDE: ☰ → Install fmIDE.';
    return 'To install fmIDE: open the browser’s menu (⋮) and choose Install app or Add to Home screen.';
  }
  function phoneInstallNote(){
    const box = pmk('section', 'phone-install-note');
    box.id = 'phoneInstallNote';
    box.appendChild(pmk('h2', 'phone-install-title', 'Keep your work on this phone'));
    box.appendChild(pmk('p', null, (phoneIsIos() ? 'Safari may clear what fmIDE keeps here after some weeks without a visit.' : 'A browser may clear what fmIDE keeps here.')
      + ' Installed, fmIDE keeps it. For a document you care about, 💾 Save keeps your own copy.'));
    const steps = phoneIsIos() ? 'Tap Share ⇪, then Add to Home Screen.' : installPrompt ? '' : 'Open the browser’s menu (⋮), then Install app or Add to Home screen.';
    if(steps) box.appendChild(pmk('p', 'phone-install-steps', steps));
    const row = pmk('div', 'phone-install-actions');
    if(installPrompt && !phoneIsIos()){
      const inst = pmk('button', 'phone-install-btn', '⤓ Install');
      inst.type = 'button';
      inst.id = 'phoneInstallNow';
      inst.addEventListener('click', () => { dismissPhoneInstallNote(); installApp(); });
      row.appendChild(inst);
    }
    const ok = pmk('button', 'phone-install-ok', 'Got it');
    ok.type = 'button';
    ok.id = 'phoneInstallOk';
    ok.addEventListener('click', dismissPhoneInstallNote);
    row.appendChild(ok);
    box.appendChild(row);
    return box;
  }
  function dismissPhoneInstallNote(){
    phoneSettings.installNoteSeen = true;
    savePhoneSettings();
    phoneStructure = '';
    phoneRefreshNow();
  }

  // ---- ☰ ----
  function openPhoneMenu(){
    document.getElementById('phoneInstall').classList.toggle('hidden', !phoneInstallOffered());
    phoneUi.vib.classList.toggle('hidden', !canVibrate());
    phoneUi.vib.textContent = 'Vibrate on the marks: ' + (phoneSettings.vibrate ? 'On' : 'Off');
    phoneUi.vib.setAttribute('aria-checked', phoneSettings.vibrate ? 'true' : 'false');
    phoneUi.menu.classList.remove('hidden');
  }
  function closePhoneMenu(){ phoneUi.menu.classList.add('hidden'); }
  phoneUi.nav.addEventListener('click', (ev) => {
    const b = ev.target.closest('.phone-nav-btn');
    if(!b) return;
    if(b.dataset.view === 'menu'){ if(phoneUi.menu.classList.contains('hidden')) openPhoneMenu(); else closePhoneMenu(); return; }
    showPhoneView(b.dataset.view);
  });
  document.addEventListener('pointerdown', (ev) => {
    if(!phoneUi.menu.classList.contains('hidden') && !ev.target.closest('#phoneMenu, #phoneNav-menu')) closePhoneMenu();
  }, true);
  const phoneMenuItem = (id, fn) => document.getElementById(id).addEventListener('click', () => { closePhoneMenu(); fn(); });
  phoneMenuItem('phoneOpen', () => runCommand('openDocument'));
  phoneMenuItem('phoneRecent', () => runCommand('openRecent'));
  phoneMenuItem('phoneSave', () => runCommand('saveDocument'));
  phoneMenuItem('phoneShare', () => sharePhoneDocument());
  phoneMenuItem('phoneGraph', () => runCommand('openFmGraph'));
  phoneMenuItem('phoneExcel', () => runCommand('openExcelExporter'));
  phoneMenuItem('phoneInstall', () => { if(installPrompt) installApp(); else showMessage(phoneInstallSteps()); });
  phoneMenuItem('phoneHelp', () => runCommand('openHelp'));
  phoneMenuItem('phoneFullApp', () => setPhoneFullApp(true));
  phoneUi.vib.addEventListener('click', () => { phoneSettings.vibrate = !phoneSettings.vibrate; savePhoneSettings(); closePhoneMenu(); });
  phoneUi.layoutBtn.addEventListener('click', () => setPhoneFullApp(false));
  phoneUi.undoB.addEventListener('click', () => runCommand('undo'));
  phoneUi.redoB.addEventListener('click', () => runCommand('redo'));
  phoneUi.prev.addEventListener('click', () => { if(currentPeriod > 0) setCurrentPeriod(currentPeriod - 1); });
  phoneUi.next.addEventListener('click', () => { if(currentPeriod < periods.length - 1) setCurrentPeriod(currentPeriod + 1); });
  phoneUi.pick.addEventListener('change', () => setCurrentPeriod(Number(phoneUi.pick.value)));
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'Escape' || !isPhone()) return;
    if(phoneCardFor){ ev.stopPropagation(); closePhoneCard(); }
    else if(!phoneUi.menu.classList.contains('hidden')){ ev.stopPropagation(); closePhoneMenu(); }
  }, true);

  phoneReady = true;
  applyPhoneLayout();
  // Decided once: a phone's screen keeps its size (the on-screen keyboard shrinks the window, not
  // the screen; turning it swaps the sides), so a window that changes size never switches layout.
  workspaceStore.ready.then(() => workspaceStore.get(PHONE_KEY)).then(raw => {
    if(typeof raw === 'string' && raw) phoneSettings = cleanPhoneSettings(raw);
    phoneSettingsRead = true;
    applyPhoneLayout();
    phoneStructure = '';
    phoneRefreshSoon();
  }, () => {});
