  // =====================================================================================
  // ---------- Macro Builder UI ----------
  // =====================================================================================
  const mb = { overlay:null, macroId:null, selStepId:null, errorStepId:null, collapsed:new Set(), els:{}, dragId:null };
  function mbMacro(){ return MACROS.find(m => m.id === mb.macroId) || null; }
  function mbSetStatus(text, kind){
    const s = mb.els.status;
    if(!s) return;
    s.textContent = text || '';
    s.className = 'status' + (kind ? ' ' + kind : '');
  }
  function mbChanged(){ saveWorkspaceSoon(); }

  function showMacroBuilder(macroId, stepId){
    if(recorder.active){ toast('Stop recording first (click the red pill).'); return; }
    if(mb.overlay) closeMacroBuilder(true);
    if(macroId) mb.macroId = macroId;
    if(!mbMacro()) mb.macroId = MACROS[0] ? MACROS[0].id : null;
    mb.selStepId = stepId || null;
    mb.errorStepId = null;

    const overlay = el('div', 'modal-overlay');
    overlay.style.background = 'rgba(15,23,42,.22)';
    const box = el('div', 'modal-box macro-box');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    mb.overlay = overlay;
    overlay.addEventListener('mousedown', ev => { if(ev.target === overlay) closeMacroBuilder(); });
    overlay.addEventListener('keydown', ev => {
      if(ev.key === 'Escape' && !focusIsTyping()){ ev.stopPropagation(); closeMacroBuilder(); }
    });

    const title = el('p', 'mtitle', '🧩 Macro Builder');
    box.appendChild(title);
    const layout = el('div', 'macro-layout');
    box.appendChild(layout);
    const list = el('div', 'macro-list');
    const main = el('div', 'macro-main');
    layout.appendChild(list);
    layout.appendChild(main);
    const foot = el('div', 'macro-foot');
    box.appendChild(foot);
    mb.els = { box, list, main, foot };
    renderMBList();
    renderMBMain();
    renderMBFoot();
  }

  function closeMacroBuilder(silent){
    if(!mb.overlay) return;
    mb.overlay.remove();
    mb.overlay = null;
    mb.els = {};
    syncMacroCommands();
    if(!silent) saveWorkspaceToLocalStorage();
  }

  function renderMBList(){
    const list = mb.els.list;
    list.innerHTML = '';
    const bar = el('div', '');
    bar.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap;';
    const newBtn = el('button', 'mbtn primary', '+ New');
    newBtn.addEventListener('click', () => { const m = createMacro(); mb.macroId = m.id; mb.selStepId = null; syncMacroCommands(); renderMBList(); renderMBMain(); renderMBFoot(); mbChanged(); });
    const dupBtn = el('button', 'mbtn', 'Duplicate');
    dupBtn.disabled = !mbMacro();
    dupBtn.addEventListener('click', () => {
      const src = mbMacro(); if(!src) return;
      const m = createMacro(src.name + ' (copy)');
      Object.assign(m, { description: src.description, relative: src.relative, steps: normalizeSteps(cloneData(src.steps)) });
      mb.macroId = m.id; syncMacroCommands(); renderMBList(); renderMBMain(); renderMBFoot(); mbChanged();
    });
    const delBtn = el('button', 'mbtn', 'Delete');
    delBtn.disabled = !mbMacro();
    delBtn.addEventListener('click', () => {
      const m = mbMacro(); if(!m) return;
      showConfirm(`Delete macro "${m.name}"?`, () => {
        MACROS = MACROS.filter(x => x !== m);
        mb.macroId = MACROS[0] ? MACROS[0].id : null; mb.selStepId = null;
        syncMacroCommands(); renderMBList(); renderMBMain(); renderMBFoot(); mbChanged();
      });
    });
    bar.appendChild(newBtn); bar.appendChild(dupBtn); bar.appendChild(delBtn);
    list.appendChild(bar);

    const items = el('div', 'mitems');
    if(MACROS.length === 0){
      const e = el('div', 'macro-empty', 'No macros yet. Click “+ New” to build one step by step, or “⏺ Record” to capture what you do on the canvas.');
      e.style.padding = '8px 4px';
      items.appendChild(e);
    }
    MACROS.forEach(m => {
      const b = el('button', 'mitem' + (m.id === mb.macroId ? ' active' : ''));
      b.appendChild(document.createTextNode((m.pinned ? '📌 ' : '') + m.name));
      const sc = shortcutBindings['macro:' + m.id];
      b.appendChild(el('span', 'msub', `${countSteps(m.steps)} step${countSteps(m.steps) === 1 ? '' : 's'}${sc ? ' · ' + prettyCombo(sc) : ''}`));
      b.addEventListener('click', () => { mb.macroId = m.id; mb.selStepId = null; mb.errorStepId = null; renderMBList(); renderMBMain(); renderMBFoot(); });
      items.appendChild(b);
    });
    list.appendChild(items);

    const io = el('div', '');
    io.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap;';
    const exp = el('button', 'mbtn', '⇩ Export');
    exp.title = 'Download all macros as JSON';
    exp.disabled = MACROS.length === 0;
    exp.addEventListener('click', () => downloadJSON({ version:1, kind:'fmIDE-macros', macros: MACROS }, `fmIDE-macros-${timestamp()}.json`));
    const imp = el('button', 'mbtn', '⇧ Import');
    imp.title = 'Add macros from a JSON file';
    const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'application/json,.json'; fileIn.style.display = 'none';
    imp.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
      if(!f) return;
      const r = new FileReader();
      r.onload = () => {
        openFmFileText(r.result, ['fmIDE-macros'], (data) => {
          if(!Array.isArray(data.macros)){ mbSetStatus('That macros file has no "macros" list.', 'err'); return; }
          const n = importMacros(data.macros, 'add');
          syncMacroCommands(); renderMBList(); renderMBMain(); renderMBFoot(); mbChanged();
          mbSetStatus(`Imported ${n} macro${n === 1 ? '' : 's'}.`, 'ok');
        });
      };
      r.readAsText(f);
    });
    io.appendChild(exp); io.appendChild(imp); io.appendChild(fileIn);
    list.appendChild(io);
  }

  // mode 'add': imported macros are added (renamed if the name exists); 'replace': same id replaced
  function importMacros(list, mode){
    let n = 0;
    list.forEach(src => {
      if(!src || typeof src !== 'object' || !Array.isArray(src.steps)) return;
      const existing = src.id ? MACROS.find(m => m.id === src.id) : null;
      const m = {
        id: (existing && mode === 'replace') ? existing.id : (src.id && !existing ? src.id : 'mac' + Date.now().toString(36) + (nextMacroNum++)),
        name: String(src.name || 'Imported macro'), description: String(src.description || ''),
        relative: !!src.relative, pinned: !!src.pinned, steps: normalizeSteps(cloneData(src.steps))
      };
      if(existing && mode === 'replace'){ MACROS[MACROS.indexOf(existing)] = m; }
      else {
        if(MACROS.some(x => x.name === m.name)) m.name += ' (imported)';
        MACROS.push(m);
      }
      n++;
    });
    return n;
  }

  function renderMBMain(){
    const main = mb.els.main;
    main.innerHTML = '';
    const m = mbMacro();
    if(!m){
      main.appendChild(el('div', 'macro-empty', 'Select or create a macro on the left.'));
      mb.els.tree = null; mb.els.props = null;
      return;
    }
    const meta = el('div', 'macro-meta');
    const nameIn = el('input'); nameIn.type = 'text'; nameIn.value = m.name; nameIn.style.width = '200px'; nameIn.placeholder = 'Macro name';
    nameIn.addEventListener('input', () => { m.name = nameIn.value; mbChanged(); });
    nameIn.addEventListener('change', () => { if(!m.name.trim()) m.name = 'Untitled macro'; nameIn.value = m.name; syncMacroCommands(); renderMBList(); });
    const descIn = el('input'); descIn.type = 'text'; descIn.value = m.description || ''; descIn.placeholder = 'Description (optional)'; descIn.style.flex = '1'; descIn.style.minWidth = '160px';
    descIn.addEventListener('input', () => { m.description = descIn.value; mbChanged(); });
    const relLab = el('label'); const relCb = el('input'); relCb.type = 'checkbox'; relCb.checked = !!m.relative;
    relLab.appendChild(relCb); relLab.appendChild(document.createTextNode('Relative positions'));
    relLab.title = 'When ticked, x/y arguments are offsets from the top-left of the selection when the macro runs (or from the centre of the view if nothing is selected), so the same macro can build its shapes anywhere.';
    relCb.addEventListener('change', () => { m.relative = relCb.checked; mbChanged(); });
    const pinLab = el('label'); const pinCb = el('input'); pinCb.type = 'checkbox'; pinCb.checked = !!m.pinned;
    pinLab.appendChild(pinCb); pinLab.appendChild(document.createTextNode('Show on Ribbon'));
    pinLab.title = 'Adds a button for this macro to Macros › My Macros on the Ribbon';
    pinCb.addEventListener('change', () => { m.pinned = pinCb.checked; syncMacroCommands(); renderMBList(); mbChanged(); });
    const sc = shortcutBindings['macro:' + m.id];
    const scLab = el('span', '', sc ? `Shortcut: ${prettyCombo(sc)}` : 'No shortcut');
    scLab.style.cssText = 'font-size:11px; color:#6b7280;';
    scLab.title = 'Assign a shortcut in View › Keyboard Shortcuts (category Macros)';
    [nameIn, descIn, relLab, pinLab, scLab].forEach(x => meta.appendChild(x));
    main.appendChild(meta);

    const tools = el('div', 'macro-tools');
    const tb = (label, title, fn) => { const b = el('button', 'mbtn', label); b.title = title; b.addEventListener('click', fn); tools.appendChild(b); return b; };
    tb('+ Action', 'Add a step that runs one fmIDE action', () => mbInsert({ kind:'action', action:'createRect', args:{} }));
    tb('+ Group', 'Add a group to organise steps', () => mbInsert({ kind:'group', label:'Group', children:[] }));
    tb('+ Repeat', 'Repeat the steps inside N times ($i = 1…N)', () => mbInsert({ kind:'repeat', count:'3', var:'i', children:[] }));
    tb('+ For each', 'Run the steps inside once per node ($item = its id)', () => mbInsert({ kind:'forEach', nodes:'@sel', var:'item', children:[] }));
    tb('+ Set var', 'Set a variable, e.g. $x = 100 + $i*80', () => mbInsert({ kind:'set', var:'x', value:'0' }));
    tb('+ Comment', 'A note; does nothing', () => mbInsert({ kind:'comment', text:'' }));
    const sep = el('span', ''); sep.style.cssText = 'width:1px; background:#e5e7eb; margin:0 4px;'; tools.appendChild(sep);
    tb('↑', 'Move up (Alt+↑)', () => mbMove(-1));
    tb('↓', 'Move down (Alt+↓)', () => mbMove(1));
    tb('→', 'Indent into the group/loop above (Alt+→)', () => mbIndent());
    tb('←', 'Move out of the group/loop (Alt+←)', () => mbOutdent());
    tb('⧉', `Duplicate (${prettyCombo('Mod+D')})`, () => mbDuplicate());
    tb('⊘', 'Enable / disable', () => mbToggleDisabled());
    tb('🗑', 'Delete (Del)', () => mbDelete());
    main.appendChild(tools);

    const split = el('div', 'macro-split');
    const tree = el('div', 'macro-tree');
    tree.tabIndex = 0;
    tree.addEventListener('keydown', mbTreeKey);
    const props = el('div', 'macro-props');
    split.appendChild(tree); split.appendChild(props);
    main.appendChild(split);
    mb.els.tree = tree; mb.els.props = props;
    renderMBTree();
    renderMBProps();
  }

  function renderMBTree(){
    const tree = mb.els.tree;
    const m = mbMacro();
    if(!tree || !m) return;
    const scroll = tree.scrollTop;
    tree.innerHTML = '';
    if(m.steps.length === 0){
      tree.appendChild(el('div', 'macro-empty', 'This macro has no steps yet.\n\nUse “+ Action” to add steps (e.g. createRect, connect, setValue), or “⏺ Record into this macro” and just use the canvas — every action becomes a step.'));
      tree.firstChild.style.whiteSpace = 'pre-wrap';
      return;
    }
    const icons = { action:'▸', group:'▣', repeat:'↻', forEach:'∀', set:'𝑥', comment:'#' };
    function rows(steps, depth){
      steps.forEach(st => {
        const r = el('div', 'mrow' + (st.id === mb.selStepId ? ' sel' : '') + (st.disabled ? ' disabled' : '') + (st.id === mb.errorStepId ? ' err' : ''));
        r.style.paddingLeft = (8 + depth * 18) + 'px';
        r.dataset.id = st.id;
        r.draggable = true;
        const isC = CONTAINER_KINDS.has(st.kind);
        const tw = el('span', 'mtw', isC ? (mb.collapsed.has(st.id) ? '▸' : '▾') : '');
        if(isC) tw.addEventListener('click', ev => { ev.stopPropagation(); if(mb.collapsed.has(st.id)) mb.collapsed.delete(st.id); else mb.collapsed.add(st.id); renderMBTree(); });
        r.appendChild(tw);
        const def = st.kind === 'action' ? ACTIONS[st.action] : null;
        r.appendChild(el('span', 'mki', st.kind === 'action' ? (def && def.icon || '▸') : icons[st.kind]));
        r.appendChild(stepSummaryDom(st));
        r.addEventListener('click', () => { mb.selStepId = st.id; renderMBTree(); renderMBProps(); tree.focus(); });
        r.addEventListener('dragstart', ev => { mb.dragId = st.id; ev.dataTransfer.effectAllowed = 'move'; try{ ev.dataTransfer.setData('text/plain', st.id); }catch(err){} });
        r.addEventListener('dragover', ev => {
          if(!mb.dragId || mb.dragId === st.id) return;
          ev.preventDefault();
          const rect = r.getBoundingClientRect();
          const t = (ev.clientY - rect.top) / rect.height;
          const zone = isC && t > 0.3 && t < 0.7 ? 'inside' : (t < 0.5 ? 'before' : 'after');
          r.classList.remove('drop-before', 'drop-after', 'drop-inside');
          r.classList.add('drop-' + zone);
          r.dataset.zone = zone;
        });
        r.addEventListener('dragleave', () => r.classList.remove('drop-before', 'drop-after', 'drop-inside'));
        r.addEventListener('drop', ev => {
          ev.preventDefault();
          r.classList.remove('drop-before', 'drop-after', 'drop-inside');
          mbDropOn(st.id, r.dataset.zone || 'after');
        });
        r.addEventListener('dragend', () => { mb.dragId = null; });
        tree.appendChild(r);
        if(isC && !mb.collapsed.has(st.id)) rows(st.children || [], depth + 1);
      });
    }
    rows(m.steps, 0);
    tree.scrollTop = scroll;
  }

  function stepSummaryDom(st){
    const span = el('span', 'msum');
    if(st.kind === 'action'){
      span.appendChild(el('span', 'act', st.action));
      Object.keys(st.args || {}).forEach(k => { span.appendChild(document.createTextNode(' ')); span.appendChild(el('span', 'arg', k + '=' + fmtArg(st.args[k]))); });
      if(st.assign){ span.appendChild(document.createTextNode('  ')); span.appendChild(el('span', 'asg', '→ $' + st.assign)); }
    } else {
      span.appendChild(document.createTextNode(stepSummaryText(st)));
    }
    if(st.comment){ span.appendChild(document.createTextNode('  ')); span.appendChild(el('span', 'cmt', '# ' + st.comment)); }
    return span;
  }

  function mbVarNames(){
    const m = mbMacro();
    const names = new Set();
    if(m) walkSteps(m.steps, st => {
      if(st.assign) names.add(st.assign);
      if(st.kind === 'set' && st.var) names.add(st.var);
      if(st.kind === 'repeat') names.add(st.var || 'i');
      if(st.kind === 'forEach'){ names.add(st.var || 'item'); names.add((st.var || 'item') + 'Index'); }
    });
    return Array.from(names);
  }

  function refreshMBRow(st){
    const tree = mb.els.tree;
    if(!tree) return;
    const row = tree.querySelector(`.mrow[data-id="${st.id}"]`);
    if(row){ const old = row.querySelector('.msum'); if(old) old.replaceWith(stepSummaryDom(st)); row.classList.toggle('disabled', !!st.disabled); }
  }

  function renderMBProps(){
    const props = mb.els.props;
    const m = mbMacro();
    if(!props || !m) return;
    props.innerHTML = '';
    const f = mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f){
      props.appendChild(el('h5', '', 'Step properties'));
      props.appendChild(el('p', 'pdesc', 'Select a step to edit it. Drag steps to reorder or drop them into groups and loops.'));
      props.appendChild(refHelp());
      return;
    }
    const st = f.step;
    const changed = () => { refreshMBRow(st); mbChanged(); mb.errorStepId = null; };
    const row = (label, input) => { const r = el('div', 'pform-row'); r.appendChild(el('label', '', label)); r.appendChild(input); props.appendChild(r); return input; };
    const textIn = (val, ph) => { const i = el('input'); i.type = 'text'; i.value = val == null ? '' : String(val); if(ph) i.placeholder = ph; i.addEventListener('keydown', ev => ev.stopPropagation()); return i; };

    if(st.kind === 'action'){
      props.appendChild(el('h5', '', 'Action step'));
      const sel = el('select');
      const cats = {};
      ACTION_LIST.filter(d => d.name !== 'getValue' || true).forEach(d => { (cats[d.category] = cats[d.category] || []).push(d); });
      Object.keys(cats).sort((a, b) => (ACTION_CATEGORY_ORDER.indexOf(a) + 100) % 100 - (ACTION_CATEGORY_ORDER.indexOf(b) + 100) % 100).forEach(cat => {
        const og = el('optgroup'); og.label = cat;
        cats[cat].forEach(d => { const o = el('option', '', `${d.label}  (${d.name})`); o.value = d.name; og.appendChild(o); });
        sel.appendChild(og);
      });
      sel.value = st.action;
      row('Action', sel);
      sel.addEventListener('change', () => {
        const d2 = ACTIONS[sel.value];
        const keep = {};
        d2.params.forEach(p => { if(st.args && p.name in st.args) keep[p.name] = st.args[p.name]; });
        st.action = sel.value; st.args = keep;
        if(!d2.returns) delete st.assign;
        changed(); renderMBProps();
      });
      const def = ACTIONS[st.action];
      if(!def){ props.appendChild(el('p', 'pdesc', `Unknown action "${st.action}".`)); return; }
      if(def.desc) props.appendChild(el('p', 'pdesc', def.desc));
      const pf = buildParamForm(def.params, st.args || {}, {
        vars: mbVarNames(),
        onChange: (name, raw) => {
          st.args = st.args || {};
          if(raw === '' || (Array.isArray(raw) && !raw.length)) delete st.args[name]; else st.args[name] = raw;
          changed();
        }
      });
      props.appendChild(pf.el);
      if(def.returns && def.returns !== 'edge'){
        const asg = row('Save result as $', textIn(st.assign, def.returns === 'nodes' ? 'e.g. copies' : 'e.g. rev'));
        asg.addEventListener('input', () => { const v = asg.value.trim().replace(/^\$/, ''); if(v && /^[A-Za-z_]\w*$/.test(v)) st.assign = v; else delete st.assign; changed(); });
      }
    } else if(st.kind === 'group'){
      props.appendChild(el('h5', '', 'Group'));
      const i = row('Label', textIn(st.label));
      i.addEventListener('input', () => { st.label = i.value; changed(); });
    } else if(st.kind === 'repeat'){
      props.appendChild(el('h5', '', 'Repeat'));
      props.appendChild(el('p', 'pdesc', 'Runs the steps inside N times. The loop variable counts 1, 2, … N — use it in arguments, e.g. y = 100 + $i*90, or name = Line ${i}.'));
      const c = row('Times', textIn(st.count, 'e.g. 5 or $periods'));
      c.addEventListener('input', () => { st.count = c.value; changed(); });
      const v = row('Variable', textIn(st.var, 'i'));
      v.addEventListener('input', () => { st.var = v.value.trim().replace(/^\$/, '') || 'i'; changed(); });
    } else if(st.kind === 'forEach'){
      props.appendChild(el('h5', '', 'For each node'));
      props.appendChild(el('p', 'pdesc', 'Runs the steps inside once per node. The variable holds that node (use it as $item in node fields); $itemIndex counts 1, 2, …'));
      const n = row('Nodes', textIn(st.nodes, '@sel'));
      n.addEventListener('input', () => { st.nodes = n.value; changed(); });
      const v = row('Variable', textIn(st.var, 'item'));
      v.addEventListener('input', () => { st.var = v.value.trim().replace(/^\$/, '') || 'item'; changed(); });
    } else if(st.kind === 'set'){
      props.appendChild(el('h5', '', 'Set variable'));
      props.appendChild(el('p', 'pdesc', 'A number expression (100 + $i*80), another variable ($r1), or text (${name} inserts a variable).'));
      const v = row('Variable', textIn(st.var, 'x'));
      v.addEventListener('input', () => { st.var = v.value.trim().replace(/^\$/, '') || 'x'; changed(); });
      const val = row('Value', textIn(st.value));
      val.addEventListener('input', () => { st.value = val.value; changed(); });
    } else if(st.kind === 'comment'){
      props.appendChild(el('h5', '', 'Comment'));
      const t = el('textarea'); t.value = st.text || ''; t.addEventListener('keydown', ev => ev.stopPropagation());
      row('Text', t);
      t.addEventListener('input', () => { st.text = t.value; changed(); });
    }
    if(st.kind !== 'comment'){
      const note = row('Note', textIn(st.comment, 'optional comment'));
      note.addEventListener('input', () => { st.comment = note.value; if(!st.comment) delete st.comment; changed(); });
    }
    const enLab = el('label', '');
    enLab.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px; color:#374151; margin:6px 0;';
    const enCb = el('input'); enCb.type = 'checkbox'; enCb.checked = !st.disabled;
    enLab.appendChild(enCb); enLab.appendChild(document.createTextNode('Step enabled'));
    enCb.addEventListener('change', () => { if(enCb.checked) delete st.disabled; else st.disabled = true; changed(); });
    props.appendChild(enLab);
    props.appendChild(refHelp());
  }

  function refHelp(){
    const h = el('div', 'macro-ref-help');
    const add = (code, text) => { const line = el('div'); line.appendChild(el('code', '', code)); line.appendChild(document.createTextNode(' ' + text)); h.appendChild(line); };
    h.appendChild(el('div', '', 'Referring to nodes:'));
    add('Revenue', 'a rectangle by name (aliases/blocks by the name they show)');
    add('@sel  @sel[0]', 'the selection when the macro started');
    add('@cur  @all', 'the live selection · every node on the canvas');
    add('$r1  $r1[0]', 'a node saved by an earlier step');
    add('#n12', 'a node by id');
    add('Canvas::Name', 'a rectangle on another canvas (alias sources)');
    h.appendChild(el('div', '', 'Numbers accept expressions: 100 + $i*80, $periods, round($x/2).'));
    return h;
  }

  // ----- tree editing operations -----
  function mbInsert(step){
    const m = mbMacro(); if(!m) return;
    step.id = newStepId();
    const f = mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f) m.steps.push(step);
    else if(CONTAINER_KINDS.has(f.step.kind) && !mb.collapsed.has(f.step.id)){ f.step.children = f.step.children || []; f.step.children.push(step); }
    else f.arr.splice(f.index + 1, 0, step);
    mb.selStepId = step.id;
    renderMBTree(); renderMBProps(); renderMBList(); mbChanged();
  }
  function mbMove(dir){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f) return;
    const j = f.index + dir;
    if(j < 0 || j >= f.arr.length) return;
    f.arr.splice(f.index, 1); f.arr.splice(j, 0, f.step);
    renderMBTree(); mbChanged();
  }
  function mbIndent(){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f || f.index === 0) return;
    const prev = f.arr[f.index - 1];
    if(!CONTAINER_KINDS.has(prev.kind)) return;
    f.arr.splice(f.index, 1);
    prev.children = prev.children || [];
    prev.children.push(f.step);
    mb.collapsed.delete(prev.id);
    renderMBTree(); mbChanged();
  }
  function mbOutdent(){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f || !f.parent) return;
    const pf = findStep(m.steps, f.parent.id);
    f.arr.splice(f.index, 1);
    pf.arr.splice(pf.index + 1, 0, f.step);
    renderMBTree(); mbChanged();
  }
  function mbDuplicate(){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f) return;
    const copy = normalizeSteps([cloneData(f.step)])[0];
    delete copy.assign;
    f.arr.splice(f.index + 1, 0, copy);
    mb.selStepId = copy.id;
    renderMBTree(); renderMBProps(); renderMBList(); mbChanged();
  }
  function mbToggleDisabled(){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f) return;
    if(f.step.disabled) delete f.step.disabled; else f.step.disabled = true;
    renderMBTree(); renderMBProps(); mbChanged();
  }
  function mbDelete(){
    const m = mbMacro(); const f = m && mb.selStepId ? findStep(m.steps, mb.selStepId) : null;
    if(!f) return;
    f.arr.splice(f.index, 1);
    const next = f.arr[f.index] || f.arr[f.index - 1] || f.parent;
    mb.selStepId = next ? next.id : null;
    renderMBTree(); renderMBProps(); renderMBList(); mbChanged();
  }
  function mbDropOn(targetId, zone){
    const m = mbMacro(); if(!m || !mb.dragId) return;
    const src = findStep(m.steps, mb.dragId);
    const dst = findStep(m.steps, targetId);
    mb.dragId = null;
    if(!src || !dst) return;
    let inside = false;
    walkSteps([src.step], st => { if(st.id === targetId) inside = true; });
    if(inside) return; // can't drop a step into itself
    src.arr.splice(src.index, 1);
    const d2 = findStep(m.steps, targetId);
    if(zone === 'inside'){ d2.step.children = d2.step.children || []; d2.step.children.push(src.step); mb.collapsed.delete(d2.step.id); }
    else d2.arr.splice(d2.index + (zone === 'after' ? 1 : 0), 0, src.step);
    mb.selStepId = src.step.id;
    renderMBTree(); renderMBProps(); mbChanged();
  }
  function mbTreeKey(ev){
    const m = mbMacro(); if(!m) return;
    const flat = [];
    walkSteps(m.steps, (st, arr, i, parent) => {
      let hidden = false, p = parent;
      while(p){ if(mb.collapsed.has(p.id)) hidden = true; const pf = findStep(m.steps, p.id); p = pf ? pf.parent : null; }
      if(!hidden) flat.push(st);
    });
    const k = flat.findIndex(s => s.id === mb.selStepId);
    if(ev.altKey && ev.key === 'ArrowUp'){ ev.preventDefault(); mbMove(-1); return; }
    if(ev.altKey && ev.key === 'ArrowDown'){ ev.preventDefault(); mbMove(1); return; }
    if(ev.altKey && ev.key === 'ArrowRight'){ ev.preventDefault(); mbIndent(); return; }
    if(ev.altKey && ev.key === 'ArrowLeft'){ ev.preventDefault(); mbOutdent(); return; }
    if(ev.key === 'ArrowDown'){ ev.preventDefault(); if(flat[k + 1]){ mb.selStepId = flat[k + 1].id; renderMBTree(); renderMBProps(); } return; }
    if(ev.key === 'ArrowUp'){ ev.preventDefault(); if(k > 0){ mb.selStepId = flat[k - 1].id; renderMBTree(); renderMBProps(); } return; }
    if(ev.key === 'Delete' || ev.key === 'Backspace'){ ev.preventDefault(); ev.stopPropagation(); mbDelete(); return; }
    if(normalizeCombo(ev) === 'Mod+D'){ ev.preventDefault(); mbDuplicate(); return; }
    ev.stopPropagation();
  }

  function renderMBFoot(){
    const foot = mb.els.foot;
    foot.innerHTML = '';
    const status = el('span', 'status', '');
    mb.els.status = status;
    foot.appendChild(status);
    const m = mbMacro();
    const recBtn = el('button', 'mbtn rec', '⏺ Record into this macro');
    recBtn.disabled = !m;
    recBtn.title = 'Close the builder and record what you do on the canvas; the steps are appended to this macro';
    recBtn.addEventListener('click', () => showRecordDialog({ macroId: m.id }));
    const runSel = el('button', 'mbtn', '▶ Run selected step');
    runSel.disabled = !m;
    runSel.title = 'Run only the selected step (and anything inside it)';
    runSel.addEventListener('click', () => {
      if(!mb.selStepId){ mbSetStatus('Select a step first.', 'err'); return; }
      mb.errorStepId = null;
      if(runMacroInteractive(m.id, [mb.selStepId])){ renderMBTree(); mbSetStatus('Step ran.', 'ok'); }
    });
    const runBtn = el('button', 'mbtn primary', '▶ Run macro');
    runBtn.disabled = !m;
    runBtn.addEventListener('click', () => {
      mb.errorStepId = null;
      if(runMacroInteractive(m.id)){ renderMBTree(); mbSetStatus(`Ran "${m.name}" — ${shortcutBindings.undo ? prettyCombo(shortcutBindings.undo) : 'Undo'} undoes the whole run.`, 'ok'); }
    });
    const closeBtn = el('button', 'mbtn', 'Close');
    closeBtn.addEventListener('click', () => closeMacroBuilder());
    [recBtn, runSel, runBtn, closeBtn].forEach(b => foot.appendChild(b));
  }

  // ---------- "Record Macro" dialog ----------
  function showRecordDialog(opts){
    if(recorder.active) return;
    const target = opts.macroId ? MACROS.find(m => m.id === opts.macroId) : null;
    const overlay = el('div', 'modal-overlay');
    const box = el('div', 'modal-box');
    box.style.minWidth = '420px';
    box.style.maxWidth = '480px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('mousedown', ev => { if(ev.target === overlay) close(); });
    box.appendChild(el('p', '', target ? `Record more steps into "${target.name}"` : 'Record a new macro'));
    const desc = el('p', 'template-desc', 'Everything you do on the canvas — adding, connecting, typing, moving, formatting, switching canvases — becomes a step. Undo removes the last recorded step. Click the red Recording pill on the Ribbon to finish.');
    box.appendChild(desc);
    let nameIn = null;
    if(!target){
      const r = el('div', 'pform-row'); r.appendChild(el('label', '', 'Macro name'));
      nameIn = el('input'); nameIn.type = 'text'; nameIn.value = 'Macro ' + (MACROS.length + 1);
      nameIn.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key === 'Enter') start(); });
      r.appendChild(nameIn); box.appendChild(r);
    }
    const nSel = selectedNodeIds.size;
    const cbRow = (text, checked, disabled, title) => {
      const l = el('label'); l.style.cssText = 'display:flex; gap:8px; align-items:flex-start; font-size:13px; margin:8px 0; color:#1e2937;';
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = checked; cb.disabled = disabled;
      l.appendChild(cb); l.appendChild(document.createTextNode(text));
      if(title) l.title = title;
      box.appendChild(l);
      return cb;
    };
    const selCb = cbRow(nSel ? `Refer to the ${nSel} selected node${nSel === 1 ? '' : 's'} as @sel (so the macro works on whatever is selected when it runs)` : 'Refer to selected nodes as @sel (nothing is selected now)', nSel > 0, nSel === 0);
    const relCb = cbRow(target ? `Relative positions: ${target.relative ? 'on' : 'off'} (set in the Macro Builder)` : 'Record positions relative to the selection (or the view centre), so the macro can build anywhere',
      target ? !!target.relative : false, !!target);
    const actions = el('div', 'modal-actions');
    const cancel = el('button', '', 'Cancel');
    cancel.addEventListener('click', close);
    const go = el('button', 'primary', '⏺ Start recording');
    go.addEventListener('click', start);
    actions.appendChild(cancel); actions.appendChild(go);
    box.appendChild(actions);
    if(nameIn){ nameIn.focus(); nameIn.select(); } else go.focus();
    function start(){
      close();
      if(mb.overlay) closeMacroBuilder();
      startRecording({ macroId: target ? target.id : null, name: nameIn ? (nameIn.value.trim() || undefined) : undefined, selRefs: selCb.checked, relative: relCb.checked });
    }
  }

