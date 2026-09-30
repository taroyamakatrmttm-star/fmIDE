  // Hand-drawn per-period value editor. Only meaningful for value rectangles with no
  // incoming edge (i.e. inputs, not formula-driven) — the render()/curve-btn visibility
  // logic already restricts when this can be opened.
  function showPeriodValuesEditor(node){
    closePicker();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box period-values-box';
    addWindowHelp(box, 'values-over-time');
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function cleanup(){
      stopDrawing();
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(ev){ if(ev.key === 'Escape') cleanup(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) cleanup(); });
    document.addEventListener('keydown', onKey);

    const {name} = parseNode(node);
    const title = document.createElement('p');
    title.textContent = 'Draw values across periods' + (name ? ' — ' + name : '');
    box.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'template-desc';
    desc.textContent = "Set a min/max range, then drag a point — or click-drag across the chart like drawing a line — to set this rectangle's value at each period. Saving overrides its typed number with these per-period values.";
    box.appendChild(desc);

    // ---- initial values ----
    let curValues;
    if(Array.isArray(node.periodValues) && node.periodValues.length){
      curValues = padPeriodValuesArray(node.periodValues.slice(), periods.length);
    } else {
      const {literal} = parseNode(node);
      const base = (typeof literal === 'number') ? literal : 0;
      curValues = new Array(periods.length).fill(base);
    }
    const existingRange = node.periodValuesRange || {};
    let rangeMin = (typeof existingRange.min === 'number') ? existingRange.min : Math.min(0, ...curValues);
    let rangeMax = (typeof existingRange.max === 'number') ? existingRange.max : Math.max(1, ...curValues);
    if(rangeMin >= rangeMax) rangeMax = rangeMin + 1;

    // ---- range + quick-tool controls ----
    const rangeRow = document.createElement('div');
    rangeRow.style.cssText = 'display:flex; gap:14px; align-items:center; margin-bottom:10px; flex-wrap:wrap;';
    function numField(labelText, value){
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px; color:#374151;';
      wrap.textContent = labelText;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.value = value; inp.step = 'any';
      inp.style.cssText = 'width:90px; font-size:13px; padding:5px 7px; border-radius:6px; border:1px solid #d1d5db;';
      wrap.appendChild(inp);
      return {wrap, inp};
    }
    const minField = numField('Min', rangeMin);
    const maxField = numField('Max', rangeMax);
    rangeRow.appendChild(minField.wrap);
    rangeRow.appendChild(maxField.wrap);
    const flatBtn = document.createElement('button');
    flatBtn.className = 'tbtn'; flatBtn.type = 'button';
    flatBtn.textContent = 'Flatten to first value';
    const interpBtn = document.createElement('button');
    interpBtn.className = 'tbtn'; interpBtn.type = 'button';
    interpBtn.textContent = 'Straight line: first → last';
    rangeRow.appendChild(flatBtn);
    rangeRow.appendChild(interpBtn);
    box.appendChild(rangeRow);

    // ---- chart ----
    const chartWrap = document.createElement('div');
    chartWrap.style.cssText = 'overflow-x:auto; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa; margin-bottom:10px;';
    box.appendChild(chartWrap);

    const padL = 54, padR = 20, padT = 16, padB = 26;
    const stepX = Math.max(46, Math.min(90, Math.floor(760 / Math.max(periods.length, 1))));
    const plotW = stepX * Math.max(periods.length - 1, 1);
    const svgW = padL + plotW + padR;
    const svgH = 240;
    const plotH = svgH - padT - padB;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.style.display = 'block';
    svg.style.cursor = 'crosshair';
    chartWrap.appendChild(svg);

    function yFor(v){
      const t = (v - rangeMin) / (rangeMax - rangeMin);
      return padT + (1 - Math.max(0, Math.min(1, t))) * plotH;
    }
    function valueFromY(y){
      const t = 1 - (y - padT) / plotH;
      const v = rangeMin + Math.max(0, Math.min(1, t)) * (rangeMax - rangeMin);
      return Math.round(v * 1000) / 1000;
    }
    function xFor(i){ return padL + i * stepX; }

    function redraw(){
      svg.innerHTML = '';
      const gl = document.createElementNS(svgNS, 'g');
      [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        const y = padT + (1 - t) * plotH;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', padL); line.setAttribute('x2', padL + plotW);
        line.setAttribute('y1', y); line.setAttribute('y2', y);
        line.setAttribute('stroke', '#e2e8f0');
        line.setAttribute('stroke-dasharray', '3,4');
        gl.appendChild(line);
        const lbl = document.createElementNS(svgNS, 'text');
        lbl.setAttribute('x', padL - 8); lbl.setAttribute('y', y + 4);
        lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('font-size', '10'); lbl.setAttribute('fill', '#94a3b8');
        lbl.textContent = formatNum(rangeMin + t * (rangeMax - rangeMin));
        gl.appendChild(lbl);
      });
      periods.forEach((label, i) => {
        const x = xFor(i);
        const vline = document.createElementNS(svgNS, 'line');
        vline.setAttribute('x1', x); vline.setAttribute('x2', x);
        vline.setAttribute('y1', padT); vline.setAttribute('y2', padT + plotH);
        vline.setAttribute('stroke', '#eef2f7');
        gl.appendChild(vline);
        const xlbl = document.createElementNS(svgNS, 'text');
        xlbl.setAttribute('x', x); xlbl.setAttribute('y', svgH - 8);
        xlbl.setAttribute('text-anchor', 'middle'); xlbl.setAttribute('font-size', '9'); xlbl.setAttribute('fill', '#94a3b8');
        xlbl.textContent = (i + 1);
        gl.appendChild(xlbl);
      });
      svg.appendChild(gl);

      const path = document.createElementNS(svgNS, 'path');
      let d = '';
      curValues.forEach((v, i) => { d += (i === 0 ? 'M' : 'L') + xFor(i) + ' ' + yFor(v) + ' '; });
      path.setAttribute('d', d.trim());
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#4f46e5');
      path.setAttribute('stroke-width', '2');
      svg.appendChild(path);

      curValues.forEach((v, i) => {
        const c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', xFor(i)); c.setAttribute('cy', yFor(v));
        c.setAttribute('r', 6);
        c.setAttribute('fill', '#fff');
        c.setAttribute('stroke', '#4f46e5');
        c.setAttribute('stroke-width', '2');
        c.style.cursor = 'ns-resize';
        svg.appendChild(c);
        const vlbl = document.createElementNS(svgNS, 'text');
        vlbl.setAttribute('x', xFor(i)); vlbl.setAttribute('y', yFor(v) - 10);
        vlbl.setAttribute('text-anchor', 'middle'); vlbl.setAttribute('font-size', '10'); vlbl.setAttribute('fill', '#374151');
        vlbl.textContent = formatNum(v);
        svg.appendChild(vlbl);
      });
    }

    // ---- per-period precise numeric entry, synced with the chart ----
    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; margin-bottom:12px; padding:8px; border:1px solid #e5e7eb; border-radius:8px;';
    box.appendChild(listWrap);
    let numberInputs = [];
    function buildNumberInputs(){
      listWrap.innerHTML = '';
      numberInputs = periods.map((label, i) => {
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:64px;';
        const lab = document.createElement('span');
        lab.style.cssText = 'font-size:9px; color:#9ca3af; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:64px;';
        lab.textContent = label;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.step = 'any';
        inp.style.cssText = 'width:100%; font-size:12px; padding:3px 4px; border-radius:5px; border:1px solid #d1d5db; text-align:center;';
        inp.value = curValues[i];
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value);
          if(isFinite(v)) curValues[i] = v;
          else inp.value = curValues[i];
          redraw();
        });
        cell.appendChild(lab); cell.appendChild(inp);
        listWrap.appendChild(cell);
        return inp;
      });
    }
    function syncNumberInputs(){ numberInputs.forEach((inp, i) => { inp.value = curValues[i]; }); }
    buildNumberInputs();
    redraw();

    minField.inp.addEventListener('change', () => {
      const v = parseFloat(minField.inp.value);
      if(isFinite(v) && v < rangeMax) rangeMin = v;
      minField.inp.value = rangeMin;
      redraw();
    });
    maxField.inp.addEventListener('change', () => {
      const v = parseFloat(maxField.inp.value);
      if(isFinite(v) && v > rangeMin) rangeMax = v;
      maxField.inp.value = rangeMax;
      redraw();
    });
    flatBtn.addEventListener('click', () => {
      const v = curValues[0];
      curValues = curValues.map(() => v);
      redraw(); syncNumberInputs();
    });
    interpBtn.addEventListener('click', () => {
      const first = curValues[0], last = curValues[curValues.length - 1], n = curValues.length;
      curValues = curValues.map((_, i) => Math.round((n > 1 ? first + (last - first) * (i / (n - 1)) : first) * 1000) / 1000);
      redraw(); syncNumberInputs();
    });

    // ---- drag-to-draw interaction ----
    let drawing = false, lastIdx = null, stopDrawing = () => {};
    function svgPointFromEvent(ev){
      const rect = svg.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }
    function nearestIndex(x){ return Math.max(0, Math.min(periods.length - 1, Math.round((x - padL) / stepX))); }
    function onDown(ev){
      pressDefault(ev);
      stopDrawing();
      drawing = true;
      stopDrawing = followPointer(ev, onMove, onUp);
      const p = svgPointFromEvent(ev);
      const idx = nearestIndex(p.x);
      curValues[idx] = valueFromY(p.y);
      lastIdx = idx;
      redraw(); syncNumberInputs();
    }
    function onMove(ev){
      if(!drawing) return;
      const p = svgPointFromEvent(ev);
      const idx = nearestIndex(p.x);
      if(lastIdx !== null && idx !== lastIdx){
        const y0 = yFor(curValues[lastIdx]);
        const lo = Math.min(lastIdx, idx), hi = Math.max(lastIdx, idx);
        for(let i = lo; i <= hi; i++){
          const t = (idx === lastIdx) ? 1 : (i - lastIdx) / (idx - lastIdx);
          curValues[i] = valueFromY(y0 + (p.y - y0) * t);
        }
      } else {
        curValues[idx] = valueFromY(p.y);
      }
      lastIdx = idx;
      redraw(); syncNumberInputs();
    }
    function onUp(){ drawing = false; lastIdx = null; stopDrawing = () => {}; }
    onPress(svg, onDown);

    // ---- actions ----
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear (use typed number instead)';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    actions.appendChild(clearBtn); actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
    box.appendChild(actions);

    clearBtn.addEventListener('click', () => {
      cleanup();
      guarded(() => fm.setPeriodValues('#' + node.id, ''));
    });
    cancelBtn.addEventListener('click', cleanup);
    saveBtn.addEventListener('click', () => {
      cleanup();
      guarded(() => fm.setPeriodValues('#' + node.id, curValues.join(','), rangeMin, rangeMax));
    });
  }

  // Builds the number-format/fill/border/font fields shared by the per-rectangle
  // formatting dialog and the format-preset editor. Appends fields into `box` (before
  // any element already in it — callers add their own rows/actions after calling this)
  // and returns a readStyle() to collect the current field values into a style object.
  function buildStyleFieldsUI(box, st){
    function fieldRow(labelText, inputEl){
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.marginBottom = '8px';
      const lab = document.createElement('label');
      lab.textContent = labelText;
      lab.style.fontSize = '12px'; lab.style.color = '#374151'; lab.style.minWidth = '120px';
      row.appendChild(lab); row.appendChild(inputEl);
      return row;
    }

    const nfKind = document.createElement('select');
    [['general','General'],['number','Number'],['percent','Percent'],['currency','Currency']].forEach(([v,l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; nfKind.appendChild(o);
    });
    nfKind.value = (st.numberFormat && st.numberFormat.kind) || 'general';
    box.appendChild(fieldRow('Number format', nfKind));

    const nfDecimals = document.createElement('input');
    nfDecimals.type = 'number'; nfDecimals.min = '0'; nfDecimals.max = '8'; nfDecimals.style.width = '60px';
    nfDecimals.value = (st.numberFormat && typeof st.numberFormat.decimals === 'number') ? st.numberFormat.decimals : 2;
    box.appendChild(fieldRow('Decimals', nfDecimals));

    const nfCurrency = document.createElement('input');
    nfCurrency.type = 'text'; nfCurrency.maxLength = 3; nfCurrency.style.width = '60px';
    nfCurrency.value = (st.numberFormat && st.numberFormat.currencySymbol) || '$';
    const currencyRow = fieldRow('Currency symbol', nfCurrency);
    box.appendChild(currencyRow);
    function syncCurrencyVisibility(){ currencyRow.style.display = nfKind.value === 'currency' ? 'flex' : 'none'; }
    nfKind.addEventListener('change', syncCurrencyVisibility);
    syncCurrencyVisibility();

    const fillInput = document.createElement('input');
    fillInput.type = 'color'; fillInput.value = st.fill || '#ffffff';
    box.appendChild(fieldRow('Fill color', fillInput));
    const fillNone = document.createElement('input');
    fillNone.type = 'checkbox'; fillNone.checked = !st.fill;
    box.appendChild(fieldRow('No fill (default)', fillNone));

    const borderColor = document.createElement('input');
    borderColor.type = 'color'; borderColor.value = (st.border && st.border.color) || '#94a3b8';
    box.appendChild(fieldRow('Border color', borderColor));
    const borderWidth = document.createElement('input');
    borderWidth.type = 'number'; borderWidth.min = '0'; borderWidth.max = '10'; borderWidth.step = '0.5'; borderWidth.style.width = '60px';
    borderWidth.value = (st.border && st.border.width != null) ? st.border.width : 1.5;
    box.appendChild(fieldRow('Border width (px)', borderWidth));
    const borderStyle = document.createElement('select');
    ['solid','dashed','dotted','none'].forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; borderStyle.appendChild(o); });
    borderStyle.value = (st.border && st.border.style) || 'solid';
    box.appendChild(fieldRow('Border style', borderStyle));
    const fontFamily = document.createElement('select');
    [['','Default'],['Arial, sans-serif','Arial'],['Georgia, serif','Georgia'],['Menlo, Consolas, monospace','Monospace'],['"Times New Roman", serif','Times New Roman']].forEach(([v,l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; fontFamily.appendChild(o);
    });
    fontFamily.value = (st.font && st.font.family) || '';
    box.appendChild(fieldRow('Font', fontFamily));
    const fontSize = document.createElement('input');
    fontSize.type = 'number'; fontSize.min = '9'; fontSize.max = '36'; fontSize.style.width = '60px';
    fontSize.value = (st.font && st.font.size) || 14;
    box.appendChild(fieldRow('Font size (px)', fontSize));
    const fontWeight = document.createElement('select');
    [['normal','Normal'],['600','Semibold'],['700','Bold']].forEach(([v,l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; fontWeight.appendChild(o); });
    fontWeight.value = (st.font && st.font.weight) || 'normal';
    box.appendChild(fieldRow('Font weight', fontWeight));
    const fontColor = document.createElement('input');
    fontColor.type = 'color'; fontColor.value = (st.font && st.font.color) || '#1e2937';
    box.appendChild(fieldRow('Name color', fontColor));

    return {
      readStyle(){
        const out = {
          numberFormat: { kind: nfKind.value, decimals: parseInt(nfDecimals.value, 10) || 0, currencySymbol: nfCurrency.value || '$' },
          fill: fillNone.checked ? null : fillInput.value,
          border: { color: borderColor.value, width: parseFloat(borderWidth.value) || 0, style: borderStyle.value },
          font: { family: fontFamily.value, size: parseInt(fontSize.value, 10) || 14, weight: fontWeight.value, color: fontColor.value }
        };
        return out;
      }
    };
  }

  function showPropertiesEditor(node){
    closePicker();
    const sharedRole = !node.style ? canvasRoleOf(node) : null;
    const usingSharedInputs = !!sharedRole;
    const st = resolveNodeStyle(node) || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    addWindowHelp(box, 'formats');
    box.style.minWidth = '320px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    const title = document.createElement('p');
    title.textContent = 'Rectangle formatting';
    box.appendChild(title);
    // Step 11a: this is the canvas look; Excel's look is ExcelExporter's own Excel style.
    const excelNote = document.createElement('p');
    excelNote.className = 'template-desc excel-look-note';
    excelNote.textContent = 'This is how the rectangle looks on the canvas. Only its number format goes to Excel — how cells look there is set in ExcelExporter (Excel style).';
    box.appendChild(excelNote);
    if(usingSharedInputs){
      const note = document.createElement('p');
      note.className = 'template-desc';
      note.innerHTML = `This rectangle is currently using the shared <strong>"${escapeXml(sharedRole)}"</strong> format role. Editing below and saving will give it its own look; to restyle every ${sharedRole === 'Inputs' ? 'input' : 'calculated'} rectangle at once, edit the "${sharedRole}" preset instead.`;
      box.appendChild(note);
      const editSharedBtn = document.createElement('button');
      editSharedBtn.textContent = `🎨 Edit the shared "${sharedRole}" preset`;
      editSharedBtn.style.marginBottom = '12px';
      editSharedBtn.addEventListener('click', () => {
        close();
        ensureDefaultFormatPresets();
        const preset = FORMAT_PRESETS.find(p => p.name === sharedRole);
        if(preset) showEditFormatPresetStyle(preset);
      });
      box.appendChild(editSharedBtn);
    }

    const fields = buildStyleFieldsUI(box, st);

    const presetRow = document.createElement('div');
    presetRow.style.cssText = 'display:flex; gap:8px; margin-bottom:14px; padding-top:10px; border-top:1px solid #e5e7eb;';
    const loadPresetBtn = document.createElement('button');
    loadPresetBtn.textContent = '📂 Load from preset';
    loadPresetBtn.addEventListener('click', () => {
      showFormatPresetsPicker(node, () => close());
    });
    const savePresetBtn = document.createElement('button');
    savePresetBtn.textContent = '💾 Save as preset';
    savePresetBtn.addEventListener('click', () => {
      saveStyleAsPreset(fields.readStyle());
    });
    presetRow.appendChild(loadPresetBtn);
    presetRow.appendChild(savePresetBtn);
    box.appendChild(presetRow);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const resetBtn = document.createElement('button');
    const roleForReset = canvasRoleOf(node);
    resetBtn.textContent = usingSharedInputs ? 'Reset to default' : (roleForReset ? `Reset to shared "${roleForReset}" format` : 'Reset to default');
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    actions.appendChild(resetBtn); actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
    box.appendChild(actions);

    resetBtn.addEventListener('click', () => {
      close();
      guarded(() => fm.setStyle('#' + node.id, null));
    });
    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', () => {
      close();
      guarded(() => fm.setStyle('#' + node.id, fields.readStyle()));
    });
  }

  // Edits a format preset's style directly (e.g. the shared "Inputs" preset) — every
  // rectangle currently falling back to this preset re-renders with the new look.
  function showEditFormatPresetStyle(preset){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.minWidth = '320px';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    const title = document.createElement('p');
    title.textContent = `Edit format preset — ${preset.name}`;
    box.appendChild(title);
    const role = formatRoleOf(preset.name);
    if(role){
      const note = document.createElement('p');
      note.className = 'template-desc';
      note.textContent = `Format role (${role.where}). ${role.desc} Changes here apply to all of them at once.`;
      box.appendChild(note);
    }

    const fields = buildStyleFieldsUI(box, preset.style || {});

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
    box.appendChild(actions);

    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', () => {
      preset.style = fields.readStyle();
      close();
      render();
    });
  }

  function applyNodeStyle(el, n){
    const nameEl = el.querySelector('.line-name');
    const valEl = el.querySelector('.line-value');
    const st = resolveNodeStyle(n);
    // Clear first: a rectangle can switch role (an arrow added/removed), and a role
    // preset may leave some properties unset — never keep the previous role's look.
    el.style.background = ''; el.style.borderColor = ''; el.style.borderWidth = ''; el.style.borderStyle = '';
    [nameEl, valEl].forEach(e => { if(e){ e.style.fontFamily = ''; e.style.fontSize = ''; e.style.fontWeight = ''; } });
    if(nameEl) nameEl.style.color = '';
    if(!st) return;
    el.style.background = st.fill || '';
    if(st.border){
      el.style.borderColor = st.border.color || '';
      el.style.borderWidth = (st.border.width != null ? st.border.width + 'px' : '');
      el.style.borderStyle = st.border.style || '';
    }
    if(st.font){
      [nameEl, valEl].forEach(e => {
        if(!e) return;
        e.style.fontFamily = st.font.family || '';
        e.style.fontSize = st.font.size ? st.font.size + 'px' : '';
        e.style.fontWeight = st.font.weight || '';
      });
      if(nameEl) nameEl.style.color = st.font.color || '';
    }
  }

