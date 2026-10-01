  // ---------- Add Many Rectangles… (step 12b) ----------
  // A window with one row per rectangle (Name, and optional Value and Unit): type a list straight
  // through with Enter, or paste lines (or columns copied from Excel). It calls fm.createRects,
  // so the lot is one undo step and one macro step.
  const ADD_MANY_DEFAULT_ROWS = 10;
  const ADD_MANY_GAP = 22;

  function showAddManyRectangles(){
    closePicker();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box add-many-box';
    addWindowHelp(box, 'rectangles');
    makeResizableWindow(box, 'addManyRects');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(ev){
      if(!document.body.contains(box) || overlay.nextElementSibling) return; // a question asked over it
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); }
      else if(ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)){ ev.preventDefault(); ev.stopPropagation(); add(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const title = document.createElement('p');
    title.textContent = 'Add Many Rectangles';
    box.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'template-desc';
    desc.textContent = 'Type a name in each row and press Enter for the next. Value and Unit are optional. You can paste a list, one name per line, or columns copied from Excel (name, value, unit). Blank rows are skipped.';
    box.appendChild(desc);

    const countRow = document.createElement('label');
    countRow.className = 'add-many-count';
    countRow.textContent = 'How many: ';
    const countIn = document.createElement('input');
    countIn.type = 'number'; countIn.min = '1'; countIn.max = String(CREATE_RECTS_MAX); countIn.step = '1';
    countIn.value = String(ADD_MANY_DEFAULT_ROWS);
    countRow.appendChild(countIn);
    box.appendChild(countRow);

    // ---- the rows ----
    const table = document.createElement('div');
    table.className = 'add-many-rows';
    box.appendChild(table);
    const head = document.createElement('div');
    head.className = 'add-many-row add-many-head';
    ['#', 'Name', 'Value', 'Unit', ''].forEach(t => { const s = document.createElement('span'); s.textContent = t; head.appendChild(s); });
    table.appendChild(head);

    const existingNames = new Set(nodes.filter(n => n.type === 'value').map(n => (parseNode(n).name || '').trim().toLowerCase()).filter(Boolean));
    const rows = [];
    function makeRow(){
      const r = document.createElement('div');
      r.className = 'add-many-row';
      const num = document.createElement('span');
      num.className = 'add-many-num';
      const field = (cls, ph) => { const i = document.createElement('input'); i.type = 'text'; i.className = cls; i.placeholder = ph; i.autocomplete = 'off'; return i; };
      const name = field('add-many-name', ''), value = field('add-many-value', ''), uom = field('add-many-uom', '');
      const note = document.createElement('span');
      note.className = 'add-many-note';
      r.append(num, name, value, uom, note);
      const row = { el: r, num, name, value, uom, note };
      [name, value, uom].forEach(inp => {
        inp.addEventListener('input', refresh);
        inp.addEventListener('keydown', (ev) => {
          if(ev.key !== 'Enter' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
          ev.preventDefault();
          let i = rows.indexOf(row) + 1;
          if(i >= rows.length){
            if(rows.length >= CREATE_RECTS_MAX) return;
            setRowCount(rows.length + 1);
          }
          rows[i].name.focus();
        });
      });
      name.addEventListener('paste', (ev) => {
        const text = ev.clipboardData ? ev.clipboardData.getData('text/plain') : '';
        if(!/[\r\n\t]/.test(text)) return; // one plain name: the box takes it as usual
        ev.preventDefault();
        pasteLines(rows.indexOf(row), text);
      });
      return row;
    }
    function filled(row){ return row.name.value.trim() !== ''; }
    function setRowCount(n){
      n = Math.max(1, Math.min(CREATE_RECTS_MAX, Math.round(n) || 1));
      while(rows.length < n){ const row = makeRow(); rows.push(row); table.appendChild(row.el); }
      while(rows.length > n){ rows.pop().el.remove(); }
      countIn.value = String(n);
      refresh();
    }
    // Lines from the clipboard fill this row and the ones below; a line copied from Excel
    // (tab-separated) fills Name, Value and Unit in turn.
    function pasteLines(start, text){
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      while(lines.length && lines[lines.length - 1].trim() === '') lines.pop();
      const take = lines.slice(0, CREATE_RECTS_MAX - start);
      if(start + take.length > rows.length) setRowCount(start + take.length);
      take.forEach((line, k) => {
        const cells = line.split('\t');
        const row = rows[start + k];
        row.name.value = (cells[0] || '').trim();
        if(cells.length > 1) row.value.value = (cells[1] || '').trim();
        if(cells.length > 2) row.uom.value = (cells[2] || '').trim();
      });
      refresh();
      const last = rows[Math.min(rows.length - 1, start + take.length)];
      if(last) last.name.focus();
    }

    // ---- arrangement ----
    const arrange = document.createElement('div');
    arrange.className = 'add-many-arrange';
    const arrangeLabel = document.createElement('span');
    arrangeLabel.textContent = 'Arrange:';
    arrange.appendChild(arrangeLabel);
    const radios = {};
    [['column', 'Column'], ['row', 'Row'], ['grid', 'Grid']].forEach(([v, l]) => {
      const lab = document.createElement('label');
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'addManyLayout'; r.value = v; r.checked = v === 'column';
      lab.append(r, document.createTextNode(' ' + l));
      arrange.appendChild(lab);
      radios[v] = r;
    });
    const acrossIn = document.createElement('input');
    acrossIn.type = 'number'; acrossIn.min = '1'; acrossIn.max = String(CREATE_RECTS_MAX); acrossIn.value = '4';
    acrossIn.className = 'add-many-across';
    const acrossLabel = document.createElement('label');
    acrossLabel.append(acrossIn, document.createTextNode(' across'));
    arrange.appendChild(acrossLabel);
    box.appendChild(arrange);

    const opts = document.createElement('div');
    opts.className = 'add-many-arrange';
    const gapLabel = document.createElement('label');
    const gapIn = document.createElement('input');
    gapIn.type = 'number'; gapIn.min = '0'; gapIn.value = String(ADD_MANY_GAP); gapIn.className = 'add-many-gap';
    gapLabel.append(document.createTextNode('Gap: '), gapIn, document.createTextNode(' px'));
    const selLabel = document.createElement('label');
    const selIn = document.createElement('input');
    selIn.type = 'checkbox'; selIn.checked = true; selIn.className = 'add-many-select';
    selLabel.append(selIn, document.createTextNode(' Select them when added'));
    opts.append(gapLabel, selLabel);
    box.appendChild(opts);

    const status = document.createElement('p');
    status.className = 'add-many-status';
    box.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    const addBtn = document.createElement('button');
    addBtn.className = 'primary add-many-add';
    actions.append(cancelBtn, addBtn);
    box.appendChild(actions);
    cancelBtn.addEventListener('click', close);
    addBtn.addEventListener('click', add);

    function refresh(){
      const seen = new Map();
      rows.forEach((row, i) => {
        row.num.textContent = String(i + 1);
        const key = row.name.value.trim().toLowerCase();
        let note = '';
        if(key && existingNames.has(key)) note = 'already on this canvas';
        else if(key && seen.has(key)) note = 'also in row ' + (seen.get(key) + 1);
        if(key && !seen.has(key)) seen.set(key, i);
        row.note.textContent = note;
        row.el.classList.toggle('add-many-warn', note !== '');
      });
      const n = rows.filter(filled).length;
      status.textContent = `${n} of ${rows.length} row${rows.length === 1 ? '' : 's'} filled — ${n} rectangle${n === 1 ? '' : 's'} will be added.`;
      status.classList.remove('add-many-error');
      addBtn.textContent = 'Add ' + n;
      addBtn.disabled = n === 0;
      acrossLabel.style.display = radios.grid.checked ? '' : 'none';
    }
    Object.values(radios).forEach(r => r.addEventListener('change', refresh));

    // How many: more rows keep what is typed; fewer rows ask before dropping filled ones.
    countIn.addEventListener('change', () => {
      const want = Math.max(1, Math.min(CREATE_RECTS_MAX, Math.round(Number(countIn.value)) || 1));
      const dropping = rows.slice(want).filter(filled).length;
      if(dropping === 0){ setRowCount(want); return; }
      countIn.value = String(rows.length);
      showConfirm(`Remove the last ${rows.length - want} rows? ${dropping} of them ${dropping === 1 ? 'has a name' : 'have names'}.`, () => setRowCount(want));
    });

    function add(){
      const items = rows.filter(filled).map(row => ({ name: row.name.value.trim(), value: row.value.value.trim(), uom: row.uom.value.trim() }));
      if(items.length === 0) return;
      const layout = radios.grid.checked ? 'grid' : radios.row.checked ? 'row' : 'column';
      const args = { items, layout, gap: Math.max(0, Number(gapIn.value) || 0) };
      if(layout === 'grid') args.across = Math.max(1, Math.round(Number(acrossIn.value)) || 1);
      let ids;
      try{ ids = fm.createRects(args); }
      catch(err){
        status.textContent = err && err.message ? err.message : String(err);
        status.classList.add('add-many-error');
        return;
      }
      close();
      if(Array.isArray(ids) && selIn.checked) selectNodesOnly(ids);
      else render();
    }

    setRowCount(ADD_MANY_DEFAULT_ROWS);
    rows[0].name.focus();
  }

  // ---------- the quick chain on the canvas (step 12b) ----------
  // Mod+Enter in a rectangle's editor saves it and starts a new rectangle just below, already
  // editing: the gap is the one between this rectangle and the one above it in its column (so a
  // chain stays evenly spaced), or the usual gap when there is none close by.
  const CHAIN_GAP_MAX = 200;
  function chainRectangleBelow(n){
    if(!n || !nodes.includes(n)) return;
    const above = nodes.filter(o => o !== n && o.type === 'value' && o.x === n.x && o.y + o.h <= n.y && n.y - (o.y + o.h) <= CHAIN_GAP_MAX)
      .sort((p, q) => (q.y + q.h) - (p.y + p.h))[0];
    const gap = above ? n.y - (above.y + above.h) : ADD_MANY_GAP;
    let x = n.x, y = n.y + n.h + gap;
    const w = n.w || RECT_W, h = n.h || RECT_H;
    const overlaps = nodes.some(o => {
      const s = (o.w > 0 && o.h > 0) ? o : defaultNodeSize(o);
      return x < o.x + s.w && o.x < x + w && y < o.y + s.h && o.y < y + h;
    });
    if(overlaps){ const spot = findFreeSpot(nodes, w, h, x, y); x = spot.x; y = spot.y; }
    const id = guarded(() => fm.createRect({ x, y, w, h }));
    if(!id) return;
    selectNodesOnly([id]);
    startEdit(id, true);
  }
