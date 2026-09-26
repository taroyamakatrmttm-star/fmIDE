  // =====================================================================================
  // ---------- shared parameter form (Command Launcher + Macro Builder) ----------
  // =====================================================================================
  function refSuggestions(p, extraVars){
    const out = [];
    if(p.type === 'node' || p.type === 'nodes'){
      const seen = {};
      nodes.forEach(n => { const nm = refNameOf(n); if(nm && isPlainRefName(nm)) seen[nm] = (seen[nm] || 0) + 1; });
      Object.keys(seen).filter(k => seen[k] === 1).sort().forEach(k => out.push(k));
      out.push('@sel', '@sel[0]', '@sel[1]', '@cur', '@all');
      if(p.type === 'node' && selectedNodeIds.size === 1) out.push('#' + Array.from(selectedNodeIds)[0]);
    } else if(p.type === 'canvas'){
      canvases.forEach(c => out.push(c.name));
    } else if(p.type === 'template'){
      templateFamilies().forEach(t => {
        out.push(t.name);
        familyVersions(t.family).slice(1).forEach(o => out.push(t.name + '@' + o.version));
      });
    } else if(p.type === 'macro'){
      MACROS.forEach(m => out.push(m.name));
    }
    (extraVars || []).forEach(v => out.push('$' + v));
    return out;
  }

  let pformSeq = 0;
  // params: action param defs; values: {name: raw}; opts.onChange(name, raw); opts.vars (names)
  function buildParamForm(params, values, opts){
    opts = opts || {};
    const wrap = el('div', 'pform');
    const inputs = {};
    params.forEach(p => {
      const row = el('div', 'pform-row');
      const lab = el('label', '', p.label);
      row.appendChild(lab);
      let input;
      const cur = values[p.name];
      const defText = p.def === undefined ? (p.optional ? 'optional' : 'required') : (typeof p.def === 'function' ? 'auto' : String(p.def));
      if(p.type === 'enum'){
        input = el('select');
        if(p.def !== undefined || p.optional){
          const o = el('option', '', p.def !== undefined && typeof p.def !== 'function' ? `(default: ${p.def})` : '(default)');
          o.value = '';
          input.appendChild(o);
        }
        paramOptions(p).forEach(v => { const o = el('option', '', String(v)); o.value = String(v); input.appendChild(o); });
        input.value = cur == null ? '' : String(cur);
        if(input.value === '' && p.def === undefined && !p.optional && paramOptions(p).length) input.value = String(paramOptions(p)[0]);
      } else if(p.type === 'bool'){
        input = el('select');
        [['', p.def !== undefined ? `(default: ${p.def})` : '(choose)'], ['true','true'], ['false','false']].forEach(([v, t]) => {
          const o = el('option', '', t); o.value = v; input.appendChild(o);
        });
        input.value = cur === undefined || cur === null ? '' : String(cur);
      } else if(p.type === 'text' || p.type === 'json'){
        input = el('textarea');
        input.rows = p.type === 'json' ? 4 : 3;
        input.value = cur == null ? '' : (typeof cur === 'object' ? JSON.stringify(cur, null, 1) : String(cur));
        input.placeholder = defText;
      } else {
        input = el('input');
        input.type = 'text';
        input.value = cur == null ? '' : (Array.isArray(cur) ? cur.join(', ') : String(cur));
        input.placeholder = defText;
        const sugg = refSuggestions(p, opts.vars);
        if(sugg.length){
          const dl = el('datalist');
          dl.id = 'pformdl' + (++pformSeq);
          sugg.forEach(s => { const o = el('option'); o.value = s; dl.appendChild(o); });
          row.appendChild(dl);
          input.setAttribute('list', dl.id);
          input.setAttribute('autocomplete', 'off');
        }
      }
      input.dataset.param = p.name;
      input.addEventListener('keydown', ev => ev.stopPropagation());
      const fire = () => { if(opts.onChange) opts.onChange(p.name, readOne(p, input)); };
      input.addEventListener('input', fire);
      input.addEventListener('change', fire);
      row.appendChild(input);
      wrap.appendChild(row);
      const helpBits = [];
      if(p.help) helpBits.push(p.help);
      if(p.coord) helpBits.push('expressions like 100 + $i*80 are allowed');
      if(helpBits.length){ const h = el('div', 'pform-help', helpBits.join(' · ')); wrap.appendChild(h); }
      inputs[p.name] = input;
    });
    function readOne(p, input){
      const v = input.value;
      if(p.type === 'nodes' && v.includes(',')) return v.split(',').map(s => s.trim()).filter(Boolean);
      return v;
    }
    return {
      el: wrap,
      read(){
        const out = {};
        params.forEach(p => {
          const v = readOne(p, inputs[p.name]);
          if(v === '' || (Array.isArray(v) && v.length === 0)){
            if(STRINGY.has(p.type) && p.def === undefined && !p.optional) out[p.name] = '';
            return;
          }
          out[p.name] = v;
        });
        return out;
      },
      focusFirst(){ const f = wrap.querySelector('input,select,textarea'); if(f){ f.focus(); if(f.select) f.select(); } },
    };
  }

  // =====================================================================================
  // ---------- Command Launcher ----------
  // =====================================================================================
  // Ctrl/Cmd+K (configurable): fuzzy-search every command, parameterised action and macro,
  // then Enter/click to run. Actions with arguments open an inline form first.
  let launcherRecent = [];
  const LAUNCHER_RECENT_MAX = 8;

  function launcherItems(){
    const items = [];
    COMMANDS.forEach(c => {
      if(c.id.startsWith('macro:')) return;
      items.push({ key:'cmd:' + c.id, icon: c.icon || '•', label: commandLabel(c), search: c.label + ' ' + c.category + (c.short ? ' ' + c.short : ''),
        category: c.category, shortcut: shortcutBindings[c.id] || '', enabled: commandEnabled(c),
        run: () => runCommand(c.id) });
    });
    ACTION_LIST.forEach(d => {
      if(d.params.length === 0) return; // zero-argument actions are already covered by commands
      items.push({ key:'act:' + d.name, icon: d.icon || 'ƒ', label: d.label + '…', search: d.label + ' ' + d.name + ' ' + d.category,
        category: 'Action · ' + d.category, enabled: true, action: d });
    });
    MACROS.forEach(m => {
      items.push({ key:'mac:' + m.id, icon:'⚡', label: m.name, search: 'macro ' + m.name + ' ' + (m.description || ''),
        category:'Macro', shortcut: shortcutBindings['macro:' + m.id] || '', enabled: true,
        run: () => runMacroInteractive(m.id) });
    });
    return items;
  }

  // Returns { score, idx } or null. Contiguous and word-start matches score higher.
  function fuzzyMatch(q, text){
    const t = text.toLowerCase();
    q = q.toLowerCase().trim();
    if(!q) return { score: 0, idx: [] };
    const sub = t.indexOf(q);
    if(sub >= 0){
      const wordStart = sub === 0 || /[^a-z0-9]/.test(t[sub - 1]);
      return { score: 1000 - sub + (wordStart ? 200 : 0) - t.length * 0.1, idx: Array.from({ length: q.length }, (_, k) => sub + k) };
    }
    const idx = [];
    let ti = 0, score = 0, prev = -2;
    for(const ch of q){
      if(ch === ' ') continue;
      const found = t.indexOf(ch, ti);
      if(found < 0) return null;
      idx.push(found);
      if(found === prev + 1) score += 15;
      if(found === 0 || /[^a-z0-9]/.test(t[found - 1])) score += 25;
      score -= (found - ti);
      prev = found; ti = found + 1;
    }
    return { score, idx };
  }

  function highlightLabel(label, idx){
    const frag = document.createDocumentFragment();
    const set = new Set(idx.filter(i => i < label.length));
    let buf = '';
    for(let i = 0; i < label.length; i++){
      if(set.has(i)){
        if(buf){ frag.appendChild(document.createTextNode(buf)); buf = ''; }
        frag.appendChild(el('b', '', label[i]));
      } else buf += label[i];
    }
    if(buf) frag.appendChild(document.createTextNode(buf));
    return frag;
  }

  function rememberLauncherItem(key){
    launcherRecent = [key].concat(launcherRecent.filter(k => k !== key)).slice(0, LAUNCHER_RECENT_MAX);
  }

  let launcherOpen = false;
  function openLauncher(){
    if(launcherOpen) return;
    if(keytips.active) keytipsExit();
    launcherOpen = true;
    const overlay = el('div', 'launcher-overlay');
    const box = el('div', 'launcher');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const prevFocus = document.activeElement;

    let all = launcherItems();
    let shown = [];
    let selIdx = 0;
    let mode = 'init';

    function close(){
      launcherOpen = false;
      overlay.remove();
      document.removeEventListener('keydown', onDocKey, true);
      if(prevFocus && prevFocus.focus && document.body.contains(prevFocus)) try{ prevFocus.focus(); }catch(err){}
    }
    overlay.addEventListener('mousedown', ev => { if(ev.target === overlay) close(); });

    const input = el('input', 'lq');
    input.placeholder = 'Type a command, action or macro…';
    input.setAttribute('autocomplete', 'off');
    input.spellcheck = false;
    const res = el('div', 'lres');
    const foot = el('div', 'lfoot');
    foot.appendChild(el('span', '', '↑↓ select'));
    foot.appendChild(el('span', '', '↵ run'));
    foot.appendChild(el('span', '', 'Esc close'));
    foot.appendChild(el('span', '', `KeyTips: ${triggerLabel()}`));

    function renderList(){
      if(mode !== 'list' || input.parentNode !== box){
        box.innerHTML = '';
        box.appendChild(input);
        box.appendChild(res);
        box.appendChild(foot);
      }
      mode = 'list';
      res.innerHTML = '';
      const q = input.value.trim();
      if(!q){
        const recent = launcherRecent.map(k => all.find(i => i.key === k)).filter(Boolean);
        const rest = all.filter(i => !recent.includes(i));
        const catRank = c => { const base = c.replace(/^Action · /, ''); const r = CATEGORY_ORDER.indexOf(base); return (c.startsWith('Action') ? 100 : 0) + (c === 'Macro' ? 50 : 0) + (r < 0 ? 40 : r); };
        rest.sort((a, b) => catRank(a.category) - catRank(b.category));
        shown = recent.concat(rest).map(i => ({ item: i, idx: [] }));
        if(recent.length) res.appendChild(el('div', 'lsec', 'Recently used'));
        let lastCat = null;
        shown.forEach((s, k) => {
          if(k === recent.length) lastCat = null;
          if(k >= recent.length && s.item.category !== lastCat){ lastCat = s.item.category; res.appendChild(el('div', 'lsec', lastCat)); }
          res.appendChild(rowEl(s, k));
        });
      } else {
        shown = all.map(i => {
          const m = fuzzyMatch(q, i.label) || fuzzyMatch(q, i.search);
          if(!m) return null;
          const onLabel = fuzzyMatch(q, i.label);
          return { item: i, score: m.score + (i.enabled ? 0 : -300) + (launcherRecent.includes(i.key) ? 30 : 0), idx: onLabel ? onLabel.idx : [] };
        }).filter(Boolean).sort((a, b) => b.score - a.score);
        if(shown.length === 0) res.appendChild(el('div', 'lsec', 'No matching commands'));
        shown.forEach((s, k) => res.appendChild(rowEl(s, k)));
      }
      selIdx = Math.min(selIdx, Math.max(0, shown.length - 1));
      markSel();
      input.focus();
    }
    function rowEl(s, k){
      const i = s.item;
      const row = el('div', 'lrow' + (i.enabled ? '' : ' disabled'));
      row.dataset.k = k;
      row.appendChild(el('span', 'lic', i.icon));
      const lb = el('span', 'llabel');
      lb.appendChild(highlightLabel(i.label, s.idx));
      row.appendChild(lb);
      if(input.value.trim()) row.appendChild(el('span', 'lcat', i.category));
      if(i.shortcut) row.appendChild(el('span', 'lkbd', prettyCombo(i.shortcut)));
      row.addEventListener('mousemove', () => { if(selIdx !== k){ selIdx = k; markSel(); } });
      row.addEventListener('click', () => { selIdx = k; choose(); });
      return row;
    }
    function markSel(){
      res.querySelectorAll('.lrow').forEach(r => r.classList.toggle('sel', +r.dataset.k === selIdx));
      const r = res.querySelector('.lrow.sel');
      if(r) r.scrollIntoView({ block:'nearest' });
    }
    function choose(){
      const s = shown[selIdx];
      if(!s) return;
      const i = s.item;
      if(!i.enabled){ toast(`"${i.label}" isn't available right now.`); return; }
      if(i.action){ renderForm(i); return; }
      rememberLauncherItem(i.key);
      close();
      i.run();
    }

    function renderForm(item){
      mode = 'form';
      const d = item.action;
      box.innerHTML = '';
      const form = el('div', 'lform');
      form.appendChild(el('h4', '', d.icon + '  ' + d.label));
      form.appendChild(el('p', 'ldesc', (d.desc ? d.desc + ' ' : '') + 'Blank fields use their default. Node fields accept a name, #id, @sel or @all.'));
      const pf = buildParamForm(d.params, {}, {});
      form.appendChild(pf.el);
      box.appendChild(form);
      const err = el('div', 'lerr');
      box.appendChild(err);
      const f2 = el('div', 'lfoot');
      f2.appendChild(el('span', '', '↵ run'));
      f2.appendChild(el('span', '', 'Esc back'));
      const runBtn = el('button', 'mbtn primary', 'Run');
      runBtn.style.marginLeft = 'auto';
      f2.appendChild(runBtn);
      box.appendChild(f2);
      function go(){
        err.textContent = '';
        try{
          const result = callAction(d.name, pf.read());
          rememberLauncherItem(item.key);
          close();
          if(d.returns === 'node' && result) selectNodesOnly([result]);
          else if(d.returns === 'nodes' && Array.isArray(result)) selectNodesOnly(result);
          else if(d.returns === 'value') toast(`${d.label}: ${Array.isArray(result) ? result.map(formatNum).join(', ') : formatNum(result)}`, 4000);
        }catch(ex){
          err.textContent = ex instanceof FmError ? ex.message : ('Error: ' + ex.message);
        }
      }
      runBtn.addEventListener('click', go);
      form.addEventListener('keydown', ev => {
        if(ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA'){ ev.preventDefault(); go(); }
        if(ev.key === 'Enter' && ev.target.tagName === 'TEXTAREA' && (ev.ctrlKey || ev.metaKey)){ ev.preventDefault(); go(); }
      }, true);
      pf.focusFirst();
    }

    function onDocKey(ev){
      if(ev.key === 'Escape'){
        ev.preventDefault(); ev.stopPropagation();
        if(mode === 'form') renderList(); else close();
        return;
      }
      if(mode !== 'list') return;
      if(ev.key === 'ArrowDown'){ ev.preventDefault(); selIdx = Math.min(shown.length - 1, selIdx + 1); markSel(); }
      else if(ev.key === 'ArrowUp'){ ev.preventDefault(); selIdx = Math.max(0, selIdx - 1); markSel(); }
      else if(ev.key === 'Enter'){ ev.preventDefault(); ev.stopPropagation(); choose(); }
    }
    document.addEventListener('keydown', onDocKey, true);
    input.addEventListener('input', () => { selIdx = 0; renderList(); });
    input.addEventListener('keydown', ev => { if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(ev.key)) ev.stopPropagation(); });
    renderList();
  }

