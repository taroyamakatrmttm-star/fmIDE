  // ---------- Simplify for inputs… (the owner's idea of 1 November 2026; docs/simplify-brief.md) ----------
  // A copy of the model holding only what some inputs move, for a lesson that should show only
  // the calculations it teaches. The person picks inputs and a range for each (or takes the
  // boards' sliders); every other input stays at today's number. The shared calculation is run
  // at every step of each input, the corners and random combinations (src/shared/simplify.js);
  // what never moves goes, and where something kept reads it, it stays as a fixed number. The
  // copy is a new document (the original is never changed), keeping what it was simplified
  // from and for (workspace v16, `simplified`), shown in a banner on it.

  // build:include shared/simplify.js

  let simplifyWin = null;
  const SIMPLIFY_PIECE_MS = 30;

  // The model's input rectangles, for the picker: { canvasId, nodeId, canvas, name, value }.
  function simplifyInputRects(){
    const ir = compileModel(buildSystemPayload());
    const out = [];
    ir.order.forEach(c => c.list.forEach(n => {
      if(n.type !== 'value' || !(n.isInput || n.incoming.length === 0) || n.blockRole) return;
      const p = parseRectText(n.node.text);
      out.push({ canvasId: c.id, nodeId: n.id, canvas: String(c.name || ''), name: String(p.name || '').trim() || '#' + n.id, value: p.literal === null ? 0 : p.literal });
    }));
    return out;
  }
  // A first range for an input: half its number either side in 100 steps; −10 to 10 for 0.
  function simplifyDefaultRange(v){
    if(!v) return { min: -10, max: 10, step: 0.2 };
    const half = Math.abs(v) / 2;
    return { min: v - half, max: v + half, step: Math.abs(v) / 100 };
  }
  // The document's board file: its showcase's, else its fmGraph boards.
  function simplifyBoardFile(){
    const sc = docShowcase && docShowcase.boards;
    const f = sc && typeof sc === 'object' ? sc : graphBoards;
    return f && typeof f === 'object' && Array.isArray(f.boards) ? f : null;
  }
  // The boards' sliders (each setting once), their scenarios as extra runs, and every rectangle
  // their bars and charts show.
  function simplifyFromBoards(file){
    const f = file === undefined ? simplifyBoardFile() : file;
    const sliders = [], seen = new Set(), shown = [];
    if(!f) return { sliders, scenarios: [], shown };
    const isRef = (o) => o && typeof o === 'object' && typeof o.canvasId === 'string' && typeof o.nodeId === 'string';
    const walk = (v) => {
      if(Array.isArray(v)) v.forEach(walk);
      else if(v && typeof v === 'object'){ if(isRef(v)) shown.push({ canvasId: v.canvasId, nodeId: v.nodeId }); Object.keys(v).forEach(k => walk(v[k])); }
    };
    f.boards.forEach(b => {
      if(!b || typeof b !== 'object') return;
      (Array.isArray(b.sliders) ? b.sliders : []).forEach(s => {
        if(!isRef(s)) return;
        const k = s.canvasId + '\u0000' + s.nodeId + '|' + JSON.stringify(s.periods || null) + '|' + s.mode;
        if(seen.has(k)) return;
        seen.add(k);
        sliders.push({ canvasId: s.canvasId, nodeId: s.nodeId, min: s.min, max: s.max, step: s.step, mode: s.mode, periods: s.periods });
      });
      ['items', 'bars', 'charts'].forEach(k => walk(b[k]));
    });
    const scenarios = (Array.isArray(f.scenarios) ? f.scenarios : [])
      .map(sc => (sc && Array.isArray(sc.sliders) ? sc.sliders : []).filter(isRef).map(s => ({ canvasId: s.canvasId, nodeId: s.nodeId, value: s.value, mode: s.mode, periods: s.periods })))
      .filter(list => list.length);
    return { sliders, scenarios, shown };
  }

  // Works it out in pieces, the page staying responsive. Returns { promise, stop }.
  function runSimplify(inputs, opts, onProgress){
    const job = simplifyJob(buildSystemPayload(), inputs, opts);
    let stopped = false;
    const promise = new Promise((resolve, reject) => {
      const piece = () => {
        if(stopped){ reject(new FmError('Stopped.')); return; }
        try{
          if(job.step(SIMPLIFY_PIECE_MS)){ resolve(job.result); return; }
          if(onProgress) onProgress(job);
          setTimeout(piece, 0);
        }catch(e){ reject(e); }
      };
      setTimeout(piece, 0);
    });
    return { promise, stop: () => { stopped = true; } };
  }

  // The plain answer (no functions, no copy), for the API and the record.
  function simplifySummary(r){
    return { kept: r.kept, total: r.total, canvases: cloneData(r.canvases), inputs: cloneData(r.inputs),
      removed: cloneData(r.removed), fixed: cloneData(r.fixed), folded: cloneData(r.folded),
      removedCanvases: cloneData(r.removedCanvases), unlinked: cloneData(r.unlinked), zeros: r.zeros,
      runs: r.runs, ms: r.ms, checked: cloneData(r.checked) };
  }

  // A board file with what the copy no longer has left out: every widget or part naming a
  // rectangle that is gone, and a chart that shows nothing then.
  function simplifyPruneBoards(file, present){
    if(!file || typeof file !== 'object') return file;
    const out = cloneData(file);
    const isRef = (o) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.canvasId === 'string' && typeof o.nodeId === 'string';
    const gone = (o) => isRef(o) && !present.has(o.canvasId + '\u0000' + o.nodeId);
    const refsIn = (v) => Array.isArray(v) ? v.some(refsIn) : v && typeof v === 'object' ? (isRef(v) || Object.keys(v).some(k => refsIn(v[k]))) : false;
    const prune = (v) => {
      if(Array.isArray(v)){
        for(let i = v.length - 1; i >= 0; i--){ if(gone(v[i])) v.splice(i, 1); else prune(v[i]); }
      } else if(v && typeof v === 'object') Object.keys(v).forEach(k => prune(v[k]));
    };
    prune(out);
    (Array.isArray(out.boards) ? out.boards : []).forEach(b => {
      if(b && Array.isArray(b.items)) b.items = b.items.filter(it => !it || it.type !== 'chart' || refsIn(it));
      if(b && Array.isArray(b.charts)) b.charts = b.charts.filter(refsIn);
    });
    return out;
  }

  // The copy as a document: this one's workspace with the simplified model, its boards and
  // showcase pruned to what is left, and the record of what it was simplified from and for.
  function simplifiedDocument(r){
    const data = buildWorkspacePayload();
    data.system = cloneData(r.system);
    const present = new Set();
    data.system.canvases.forEach(c => c.nodes.forEach(n => present.add(c.id + '\u0000' + n.id)));
    if(data.graphBoards) data.graphBoards = simplifyPruneBoards(data.graphBoards, present);
    if(data.showcase){
      const sc = data.showcase;
      if(sc.boards) sc.boards = simplifyPruneBoards(sc.boards, present);
      const ids = new Set(data.system.canvases.map(c => c.id));
      if(sc.canvases && Array.isArray(sc.canvases.show)) sc.canvases.show = sc.canvases.show.filter(id => ids.has(id));
      if(sc.canvases && sc.canvases.start && !ids.has(sc.canvases.start)) delete sc.canvases.start;
    }
    data.simplified = cleanDocumentSimplified({ from: docDisplayName(), made: new Date().toISOString(), inputs: r.inputs,
      kept: r.kept, total: r.total, runs: r.runs, fixed: r.fixed, removed: r.removed });
    return data;
  }
  // Simplify to the sliders (phase 2, Make Showcase Viewer…): the model simplified for the sliders
  // of the showcase's boards — each scenario one more run, their bars and charts kept as fixed
  // numbers unless 0 — and Keep anyway from `sc.simplify.keep`. Returns a Promise of { system
  // (the viewer's model block), showcase (its boards and shown canvases cleaned the same way),
  // excelPayload (the workspace ExcelExporter makes the workbook from), result }. The document
  // itself is not changed.
  function simplifyForViewer(sc, onProgress){
    const boards = simplifyFromBoards(sc && sc.boards ? sc.boards : null);
    if(!boards.sliders.length) return Promise.reject(new FmError('Simplify to the sliders needs a board with sliders: tick one, or set them up in fmGraph.'));
    const { inputs, problems } = simplifyInputs(buildSystemPayload(), boards.sliders);
    if(!inputs.length) return Promise.reject(new FmError('The boards\' sliders are on no input rectangle of this model' + (problems.length ? ': ' + problems.join(' ') : '.')));
    const keep = sc.simplify && Array.isArray(sc.simplify.keep) ? sc.simplify.keep : [];
    const running = runSimplify(inputs, { keep, extraRuns: boards.scenarios, shown: boards.shown }, onProgress);
    return running.promise.then(r => simplifiedForViewer(sc, r));
  }
  function simplifiedForViewer(sc, r){
    const system = cloneData(r.system);
    const present = new Set(), ids = system.canvases.map(c => c.id);
    system.canvases.forEach(c => c.nodes.forEach(n => present.add(c.id + '\u0000' + n.id)));
    const showcase = cloneData(sc);
    if(showcase.boards) showcase.boards = simplifyPruneBoards(showcase.boards, present);
    const shown = showcase.canvases && Array.isArray(showcase.canvases.show) ? showcase.canvases.show.filter(id => ids.includes(id)) : ids.slice();
    showcase.canvases = { show: shown.length ? shown : ids.slice(0, 1) };
    showcase.canvases.start = sc.canvases && showcase.canvases.show.includes(sc.canvases.start) ? sc.canvases.start : showcase.canvases.show[0];
    const excelPayload = Object.assign(buildExcelPayload(), { system });
    if(excelPayload.graphBoards) excelPayload.graphBoards = simplifyPruneBoards(excelPayload.graphBoards, present);
    return { system, showcase, excelPayload, result: r };
  }

  // A result in a few words: "keeps 154 of 528 items on 14 of 29 canvases".
  function simplifyWords(r){
    return 'keeps ' + r.kept + ' of ' + r.total + ' items on ' + r.canvases.kept + ' of ' + r.canvases.total + ' canvases';
  }
  // Make Showcase Viewer…'s Show what goes…: the list with Keep anyway ticks, redone at once from
  // the same runs (result.rebuild). Done gives back the ticks: onDone(keep, result).
  function showSimplifyKeepWindow(result, keep, onDone){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box simplify-box simplify-keep-box';
    addWindowHelp(box, 'simplify');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; };
    const keepTicks = { nodes: new Set(), canvases: new Set(), names: new Map() };
    (keep || []).forEach(k => { if(k && k.nodeId !== undefined) keepTicks.nodes.add(k.canvasId + '\u0000' + k.nodeId); else if(k) keepTicks.canvases.add(k.canvasId); });
    const keepList = () => [...keepTicks.canvases].map(canvasId => ({ canvasId }))
      .concat([...keepTicks.nodes].map(k => { const [canvasId, nodeId] = k.split('\u0000'); return { canvasId, nodeId }; }));
    let r = result;
    const summary = el('p', 'sim-summary');
    const list = el('div', 'sim-list');
    const draw = () => {
      summary.textContent = 'The viewer ' + simplifyWords(r) + ' · ' + r.fixed.length + ' fixed number' + (r.fixed.length === 1 ? '' : 's') + ' · ' + r.zeros + ' zero' + (r.zeros === 1 ? '' : 's') + ' dropped';
      list.textContent = '';
      appendSimplifyList(list, r.removed, r.fixed, keepTicks);
    };
    list.addEventListener('change', (ev) => {
      const t = ev.target;
      if(!t || t.type !== 'checkbox') return;
      if(t.classList.contains('sim-keep')){ const k = t.dataset.canvas + '\u0000' + t.dataset.node; if(t.checked) keepTicks.nodes.add(k); else keepTicks.nodes.delete(k); }
      else if(t.classList.contains('sim-keep-canvas')){ if(t.checked) keepTicks.canvases.add(t.dataset.canvas); else keepTicks.canvases.delete(t.dataset.canvas); }
      else return;
      const scroll = list.scrollTop;
      r = r.rebuild(keepList());
      draw();
      list.scrollTop = scroll;
    });
    const actions = el('div', 'modal-actions');
    const done = el('button', 'primary sim-keep-done', 'Done');
    const close = () => { overlay.remove(); onDone(keepList(), r); };
    done.addEventListener('click', close);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    actions.appendChild(done);
    box.append(el('p', 'showcase-maker-title', 'What goes from the viewer'), el('p', 'template-desc', 'Tick what to keep anyway. It is checked again when the viewer is made.'), summary, list, actions);
    draw();
    done.focus();
  }

  function simplifiedName(){ return (docDisplayName() + ' (simplified)').slice(0, 120); }

  // Opens the copy as a new, unsaved document (the one open now asked about first when it has
  // unsaved changes, by the caller).
  function openSimplifiedCopy(data, name){
    applyDocumentData(data, 'fmIDE-workspace');
    Object.assign(currentDoc, { name, fileName: null, handle: null, recentId: null, serial: currentDoc.serial + 1 });
    clearUndoHistory();
    hideRecoveryNotice();
    markDocDirty();
    rememberSessionHandle();
    saveWorkspace();
  }

  // ---- the banner on a simplified copy ----
  function simplifyInputWords(x){
    const span = x.mode === 'shift' ? x.min + '% to ' + x.max + '%' : x.min + ' to ' + x.max;
    return x.name + ' (' + span + ')';
  }
  function showSimplifiedBanner(){
    let bar = document.getElementById('simplifiedBanner');
    if(!docSimplified){ if(bar) bar.remove(); return; }
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'simplifiedBanner';
      bar.setAttribute('role', 'status');
      const msg = document.createElement('span');
      msg.className = 'simplified-text';
      const list = document.createElement('button');
      list.className = 'simplified-list';
      list.textContent = 'What was removed…';
      list.addEventListener('click', () => showSimplifiedRecord());
      const hide = document.createElement('button');
      hide.className = 'simplified-hide';
      hide.textContent = '×';
      hide.setAttribute('aria-label', 'Hide');
      hide.addEventListener('click', () => bar.remove());
      bar.append(msg, list, hide);
      document.getElementById('app').appendChild(bar);
    }
    const s = docSimplified;
    const inputs = s.inputs.map(simplifyInputWords).join(', ');
    bar.querySelector('.simplified-text').textContent = 'Simplified from “' + (s.from || 'a model') + '” for ' + (inputs || 'no inputs') + '. '
      + (s.fixed.length ? 'Its ' + s.fixed.length + ' fixed number' + (s.fixed.length === 1 ? ' is' : 's are') + ' right only while the other inputs stay as they were.' : 'The other inputs stay as they were.');
  }

  // The list in a window: by canvas, each item and why (the record's words, as text).
  function appendSimplifyList(host, removed, fixed, keepTicks){
    const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; };
    const byCanvas = new Map();
    removed.forEach(x => { if(!byCanvas.has(x.canvasId)) byCanvas.set(x.canvasId, { name: x.canvas, items: [] }); byCanvas.get(x.canvasId).items.push(x); });
    if(fixed.length){
      host.appendChild(el('p', 'sim-head', 'Kept as fixed numbers (' + fixed.length + ')'));
      fixed.forEach(x => { const row = el('div', 'sim-fixed-item'); row.append(el('b', null, x.name), el('span', 'sim-why', ' — ' + x.canvas + (x.text ? ', ' + x.text : ''))); host.appendChild(row); });
    }
    // What is kept anyway, ticked, so a choice can be taken back (keepTicks.names: key → name).
    if(keepTicks && (keepTicks.canvases.size || keepTicks.nodes.size)){
      host.appendChild(el('p', 'sim-head', 'Kept anyway'));
      keepTicks.canvases.forEach(canvasId => {
        const row = el('div', 'sim-canvas');
        const tick = el('input', 'sim-keep-canvas'); tick.type = 'checkbox'; tick.dataset.canvas = canvasId; tick.checked = true;
        const label = el('label'); label.append(tick, document.createTextNode(' Keep the canvas anyway'));
        row.append(el('b', null, keepTicks.names.get(canvasId) || canvasId), label);
        host.appendChild(row);
      });
      keepTicks.nodes.forEach(k => {
        const [canvasId, nodeId] = k.split('\u0000');
        const row = el('div', 'sim-item');
        const tick = el('input', 'sim-keep'); tick.type = 'checkbox'; tick.dataset.canvas = canvasId; tick.dataset.node = nodeId; tick.checked = true;
        tick.title = 'Keep anyway';
        row.append(tick, el('span', 'sim-name', ' ' + (keepTicks.names.get(k) || nodeId)));
        host.appendChild(row);
      });
    }
    host.appendChild(el('p', 'sim-head', 'Removed (' + removed.length + ')'));
    byCanvas.forEach((g, canvasId) => {
      if(keepTicks && keepTicks.canvases.has(canvasId)) return;
      if(keepTicks) keepTicks.names.set(canvasId, g.name || canvasId);
      const head = el('div', 'sim-canvas');
      if(keepTicks){
        const tick = el('input', 'sim-keep-canvas'); tick.type = 'checkbox'; tick.dataset.canvas = canvasId;
        tick.checked = keepTicks.canvases.has(canvasId);
        const label = el('label'); label.append(tick, document.createTextNode(' Keep the canvas anyway'));
        head.append(el('b', null, g.name || canvasId), label);
      } else head.append(el('b', null, g.name || canvasId));
      host.appendChild(head);
      g.items.forEach(x => {
        const row = el('div', 'sim-item');
        if(keepTicks){
          const tick = el('input', 'sim-keep'); tick.type = 'checkbox'; tick.dataset.canvas = x.canvasId; tick.dataset.node = x.nodeId;
          tick.title = 'Keep anyway';
          keepTicks.names.set(x.canvasId + '\u0000' + x.nodeId, x.name + ' (' + (x.canvas || x.canvasId) + ')');
          row.appendChild(tick);
        }
        row.append(el('span', 'sim-name', ' ' + x.name), el('span', 'sim-why', ' — ' + (x.text || x.why)));
        host.appendChild(row);
      });
    });
  }
  function showSimplifiedRecord(){
    if(!docSimplified) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box simplify-box simplify-record';
    addWindowHelp(box, 'simplify');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    const title = document.createElement('p'); title.className = 'showcase-maker-title'; title.textContent = 'What was removed';
    const note = document.createElement('p'); note.className = 'template-desc';
    note.textContent = 'Kept ' + docSimplified.kept + ' of ' + docSimplified.total + ' items of “' + docSimplified.from + '”, tried in ' + docSimplified.runs + ' runs.';
    const list = document.createElement('div'); list.className = 'sim-list';
    appendSimplifyList(list, docSimplified.removed, docSimplified.fixed, null);
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const ok = document.createElement('button'); ok.textContent = 'Close'; ok.addEventListener('click', close);
    actions.appendChild(ok);
    box.append(title, note, list, actions);
    ok.focus();
  }

  // ---- the window ----
  function showSimplifyWindow(){
    if(inPractice()){ showMessage('Not while practising a tutorial: the practice model isn\'t your document.'); return; }
    if(simplifyWin) simplifyWin.close();
    const rects = simplifyInputRects();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box simplify-box';
    addWindowHelp(box, 'simplify');
    makeResizableWindow(box, 'simplify');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    let running = null, result = null, resultFor = '';
    const keepTicks = { nodes: new Set(), canvases: new Set(), names: new Map() };
    function close(){ if(running) running.stop(); overlay.remove(); document.removeEventListener('keydown', onKey, true); simplifyWin = null; }
    function onKey(ev){
      if(!document.body.contains(box) || overlay.nextElementSibling) return;
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; };

    box.appendChild(el('p', 'showcase-maker-title', 'Simplify for inputs'));
    box.appendChild(el('p', 'template-desc', 'Makes a copy holding only what these inputs move within their ranges, every other input staying at today\'s number. This model is not changed.'));
    const rows = el('div', 'sim-inputs');
    box.appendChild(rows);
    const addRow = el('div', 'sim-add-row');
    const pick = el('select', 'sim-pick');
    const first = el('option', null, '+ Add an input…'); first.value = '';
    pick.appendChild(first);
    rects.forEach((r, i) => { const o = el('option', null, r.canvas + ' · ' + r.name); o.value = String(i); pick.appendChild(o); });
    const fromBoards = simplifyFromBoards();
    const useSliders = el('button', 'sim-use-sliders', 'Use the boards\' sliders (' + fromBoards.sliders.length + ')');
    useSliders.disabled = !fromBoards.sliders.length;
    addRow.append(pick, useSliders);
    box.appendChild(addRow);

    const inputs = []; // { canvasId, nodeId, name, min, max, step, mode, periods }
    const periodName = (p) => String(periods[p] === undefined ? 'Period ' + (p + 1) : periods[p]);
    function drawRows(){
      rows.textContent = '';
      if(!inputs.length) rows.appendChild(el('p', 'sim-none', 'No inputs yet: add one, or use the boards\' sliders.'));
      inputs.forEach((x, i) => {
        const row = el('div', 'sim-input');
        row.dataset.canvas = x.canvasId; row.dataset.node = x.nodeId;
        const num = (cls, key, label) => {
          const inp = el('input', cls); inp.type = 'number'; inp.value = String(x[key]); inp.title = label; inp.setAttribute('aria-label', label + ' of ' + x.name);
          inp.addEventListener('input', () => { const v = Number(inp.value); if(inp.value !== '' && Number.isFinite(v)){ x[key] = v; changed(); } });
          return inp;
        };
        const per = el('select', 'sim-periods');
        const all = el('option', null, 'All periods'); all.value = 'all'; per.appendChild(all);
        periods.forEach((_, p) => { const o = el('option', null, periodName(p)); o.value = String(p); per.appendChild(o); });
        per.value = x.periods && x.periods.mode === 'one' ? String(x.periods.p) : 'all';
        if(x.periods && x.periods.mode === 'range'){ const o = el('option', null, periodName(x.periods.from) + ' to ' + periodName(x.periods.to)); o.value = 'range'; per.appendChild(o); per.value = 'range'; }
        per.addEventListener('change', () => { if(per.value === 'all') x.periods = { mode: 'all' }; else if(per.value !== 'range') x.periods = { mode: 'one', p: Number(per.value) }; changed(); });
        const remove = el('button', 'sim-remove', '×'); remove.title = 'Remove this input';
        remove.addEventListener('click', () => { inputs.splice(i, 1); drawRows(); changed(); });
        row.append(el('span', 'sim-input-name', x.name + (x.mode === 'shift' ? ' (% change)' : '')), el('span', 'sim-label', 'from'), num('sim-min', 'min', 'Minimum'),
          el('span', 'sim-label', 'to'), num('sim-max', 'max', 'Maximum'), el('span', 'sim-label', 'step'), num('sim-step', 'step', 'Step'), per, remove);
        rows.appendChild(row);
      });
      work.disabled = !inputs.length || !!running;
    }
    const nameOf = (canvasId, nodeId) => { const r = rects.find(r => r.canvasId === canvasId && r.nodeId === nodeId); return r ? r.name : '#' + nodeId; };
    pick.addEventListener('change', () => {
      const r = rects[Number(pick.value)];
      pick.value = '';
      if(!r) return;
      inputs.push(Object.assign({ canvasId: r.canvasId, nodeId: r.nodeId, name: r.name, mode: 'set', periods: { mode: 'all' } }, simplifyDefaultRange(r.value)));
      drawRows(); changed();
    });
    useSliders.addEventListener('click', () => {
      fromBoards.sliders.forEach(s => {
        if(inputs.some(x => x.canvasId === s.canvasId && x.nodeId === s.nodeId && JSON.stringify(x.periods) === JSON.stringify(s.periods || { mode: 'all' }))) return;
        inputs.push({ canvasId: s.canvasId, nodeId: s.nodeId, name: nameOf(s.canvasId, s.nodeId), min: Number(s.min) || 0, max: Number(s.max) || 0,
          step: Number(s.step) || 1, mode: s.mode === 'shift' ? 'shift' : 'set', periods: s.periods || { mode: 'all' } });
      });
      drawRows(); changed();
    });

    const workRow = el('div', 'sim-work-row');
    const work = el('button', 'sim-work', 'Work out');
    const progress = el('span', 'sim-progress');
    const stop = el('button', 'sim-stop', 'Stop'); stop.hidden = true;
    workRow.append(work, progress, stop);
    box.appendChild(workRow);
    const summary = el('p', 'sim-summary');
    const list = el('div', 'sim-list');
    box.append(summary, list);
    const actions = el('div', 'modal-actions');
    const save = el('button', 'sim-save', 'Save the copy…');
    const open = el('button', 'sim-open primary', 'Open the copy');
    const cancel = el('button', null, 'Close');
    cancel.addEventListener('click', close);
    actions.append(cancel, save, open);
    box.appendChild(actions);

    const keepList = () => [...keepTicks.canvases].map(canvasId => ({ canvasId }))
      .concat([...keepTicks.nodes].map(k => { const [canvasId, nodeId] = k.split('\u0000'); return { canvasId, nodeId }; }));
    const inputsKey = () => JSON.stringify(inputs.map(x => [x.canvasId, x.nodeId, x.min, x.max, x.step, x.mode, x.periods]));
    const keepKey = () => JSON.stringify(keepList());
    function changed(){
      if(result && !resultFor.startsWith(inputsKey())) summary.textContent = 'The inputs changed: Work out again.';
      refreshActions();
    }
    function refreshActions(){
      const ready = !!result && resultFor.startsWith(inputsKey()) && !running;
      open.disabled = save.disabled = !ready;
      work.disabled = !inputs.length || !!running;
    }
    function showResult(){
      const r = result;
      const words = 'Keeps ' + r.kept + ' of ' + r.total + ' items on ' + r.canvases.kept + ' of ' + r.canvases.total + ' canvases · '
        + r.fixed.length + ' fixed number' + (r.fixed.length === 1 ? '' : 's') + ' · ' + r.zeros + ' zero' + (r.zeros === 1 ? '' : 's') + ' dropped'
        + (r.folded.length ? ' · ' + r.folded.length + ' × −1 folded into a minus' : '') + ' · '
        + r.runs + ' runs' + (r.ms ? ', ' + (r.ms / 1000).toFixed(1) + ' s' : '') + ' · '
        + (r.checked.ok === null ? 'checked again when the copy is made' : r.checked.ok ? 'checked' : 'the check found differences');
      summary.textContent = words;
      list.textContent = '';
      if(r.checked.ok === false) list.appendChild(el('p', 'sim-warning', 'These still differ from the full model: ' + r.checked.mismatches.map(x => x.name + ' on ' + x.canvas).join(', ') + '.'));
      if(r.unlinked.length) list.appendChild(el('p', 'sim-note', 'Unlinked from their templates (so an update can\'t put back what went): ' + r.unlinked.map(c => c.canvas).join(', ') + '.'));
      if(r.removedCanvases.length) list.appendChild(el('p', 'sim-note', 'Canvases left empty, removed: ' + r.removedCanvases.map(c => c.canvas).join(', ') + '.'));
      if(r.folded.length) list.appendChild(el('p', 'sim-note', 'Folded into a minus: ' + r.folded.length + ' × −1 (a + became −, or a − became +).'));
      appendSimplifyList(list, r.removed, r.fixed, keepTicks);
      refreshActions();
    }
    list.addEventListener('change', (ev) => {
      const t = ev.target;
      if(!result || !t || t.type !== 'checkbox') return;
      if(t.classList.contains('sim-keep')){ const k = t.dataset.canvas + '\u0000' + t.dataset.node; if(t.checked) keepTicks.nodes.add(k); else keepTicks.nodes.delete(k); }
      else if(t.classList.contains('sim-keep-canvas')){ if(t.checked) keepTicks.canvases.add(t.dataset.canvas); else keepTicks.canvases.delete(t.dataset.canvas); }
      else return;
      const scroll = list.scrollTop;
      result = result.rebuild(keepList());
      resultFor = inputsKey() + keepKey();
      result.checked.ok = null;
      showResult();
      list.scrollTop = scroll;
    });

    const opts = () => ({ keep: keepList(), extraRuns: fromBoards.scenarios, shown: fromBoards.shown });
    function workOut(){
      const { inputs: clean, problems } = simplifyInputs(buildSystemPayload(), inputs);
      if(problems.length){ showMessage(problems.join('\n')); return Promise.resolve(null); }
      running = runSimplify(clean, opts(), (job) => { progress.textContent = job.label + ' ' + Math.round(job.progress * 100) + '%'; });
      stop.hidden = false; progress.textContent = 'Working out…';
      refreshActions();
      const forKey = inputsKey() + keepKey();
      return running.promise.then(r => {
        result = r; resultFor = forKey;
        showResult();
        return r;
      }).catch(e => { summary.textContent = e && e.message === 'Stopped.' ? 'Stopped.' : 'Couldn\'t work it out: ' + (e && e.message || e); return null; })
        .finally(() => { running = null; stop.hidden = true; progress.textContent = ''; refreshActions(); });
    }
    work.addEventListener('click', () => { workOut(); });
    stop.addEventListener('click', () => { if(running) running.stop(); });
    // The copy needs a checked result for the inputs and ticks as they are: worked out again if not.
    const ready = () => (result && resultFor === inputsKey() + keepKey() && result.checked.ok !== null) ? Promise.resolve(result) : workOut();
    open.addEventListener('click', () => {
      ready().then(r => {
        if(!r) return;
        const data = simplifiedDocument(r), name = simplifiedName();
        confirmDiscardChanges(() => { close(); openSimplifiedCopy(data, name); toast('Opened the simplified copy. Save it to keep it.', 4000); });
      });
    });
    save.addEventListener('click', () => {
      ready().then(r => { if(r) downloadDocument(JSON.stringify(simplifiedDocument(r), null, 2), withDocExt(simplifiedName())); });
    });
    // Start with the boards' sliders when there are any.
    if(fromBoards.sliders.length) useSliders.click();
    drawRows();
    refreshActions();
    simplifyWin = { close, box };
  }
