  // ---------- Make showcase viewer… (phase V3 of docs/viewer-brief.md) ----------
  // One web page that shows this model read-only — its canvases, its fmGraph boards, sliders,
  // scenarios and Play — to email or share: the showcase viewer's page (fmShowcase,
  // apps/fmViewer.html), which the build packs into this file (<script id="viewerPage">,
  // tools/pack.js), with the showcase and the model written into its two data blocks
  // (fillViewerPage, src/shared/showcase.js). The author's choices are kept in the document
  // (docShowcase, workspace v14), so making it again remembers them; a canvas or board new
  // since then comes unticked. Nothing is sent anywhere: the file is downloaded (on a touch
  // screen, the share sheet).

  // build:include shared/showcase-boards.js

  // Choose for me (phase V5): a model with no fmGraph boards gets one, "Chosen for me" — a slider
  // on each input that reaches a calculated rectangle and a bar on each result, at most 12 of
  // each (autoShowcaseBoards, src/shared/showcase-boards.js, the batch tool's `auto` too) — added
  // to the document's fmGraph boards (the owner's choice 6 of V5), so fmGraph shows it to adjust.
  // Kept with the document like boards made in fmGraph (unsaved changes, not an undo step).
  // Returns { sliders, bars, notes } (each slider and bar by name), or fails in words.
  const CHOOSE_FOR_ME_RANGE = 50;
  function chooseShowcaseBoards(){
    if(inPractice()) fail('Not while practising a tutorial: the practice model isn\'t your document.');
    if(showcaseBoardList(graphBoards).boards.length) fail('This model has fmGraph boards already: choose among them, or change them in fmGraph.');
    const r = autoShowcaseBoards(buildSystemPayload(), { sliders: 'inputs', bars: 'outputs', range: CHOOSE_FOR_ME_RANGE });
    if(!r.file) fail('Nothing to choose: this model has no input that moves a calculated rectangle, and no result.');
    const kept = cleanGraphBoards(r.file);
    if(!kept) fail('The board chosen couldn\'t be kept.');
    graphBoards = kept;
    markDocDirty();
    if(showcaseMaker) showcaseMaker.refreshBoards();
    return { sliders: r.sliders, bars: r.bars, notes: r.notes };
  }
  const chosenWords = (r) => {
    const list = (items) => items.map(x => x.name).join(', ');
    return 'Chosen for me: ' + r.sliders.length + ' slider' + (r.sliders.length === 1 ? '' : 's') + (r.sliders.length ? ' (' + list(r.sliders) + ')' : '')
      + ' and ' + r.bars.length + ' bar' + (r.bars.length === 1 ? '' : 's') + (r.bars.length ? ' (' + list(r.bars) + ')' : '') + '. Open fmGraph to adjust them.';
  };

  // The viewer's page as the build packed it: a Promise of its text.
  async function viewerPageText(){
    const el = document.getElementById('viewerPage');
    const b64 = el ? String(el.textContent || '').trim() : '';
    if(!b64) fail('This fmIDE carries no viewer page to make a viewer from.');
    if(typeof DecompressionStream !== 'function') fail('This browser can\'t make a viewer. Use a current Chrome, Edge, Firefox or Safari.');
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  // What the window starts with: the showcase kept in the document, else the document itself.
  // Returns the choices (as showcaseFromChoices takes them) and the notes about what is gone.
  function showcaseStartChoices(){
    const kept = docShowcase && docShowcase.kind === SHOWCASE_KIND ? docShowcase : null;
    const notes = [];
    const ids = canvases.map(c => c.id);
    let ticked = ids.slice();
    let start = activeCanvasId;
    if(kept && kept.canvases && Array.isArray(kept.canvases.show)){
      ticked = ids.filter(id => kept.canvases.show.includes(id));
      if(kept.canvases.show.some(id => !ids.includes(id))) notes.push('A canvas chosen before is no longer in the model: it is left out.');
      if(!ticked.length) ticked = ids.slice();
      start = ticked.includes(kept.canvases.start) ? kept.canvases.start : ticked[0];
    }
    const list = showcaseBoardList(graphBoards, kept);
    if(kept && kept.boards && Array.isArray(kept.boards.boards)){
      const names = list.boards.map(b => b.name);
      if(kept.boards.boards.some(b => b && !names.includes(showcaseText(b.name, SHOWCASE_LIMITS.title)))) notes.push('A board chosen before is no longer in the model\'s boards: it is left out.');
    }
    const last = Math.max(0, periods.length - 1);
    const per = kept && kept.periods ? { from: Math.min(kept.periods.from, last), to: Math.min(kept.periods.to, last) } : { from: 0, to: last };
    const ends = ['Base'].concat(list.scenarios.filter(n => n !== 'Base'));
    const play = kept && kept.play && ends.includes(kept.play.from) && ends.includes(kept.play.to) ? Object.assign({}, kept.play)
      : { from: 'Base', to: ends[1] || 'Base' };
    const title = kept && kept.title ? kept.title : showcaseText(docDisplayName(), SHOWCASE_LIMITS.title);
    // Excel (phase V4): as chosen last time, else ticked when the model has boards.
    const excel = kept ? (kept.excel ? { file: kept.excel.file } : null) : (list.boards.length ? { file: showcaseFileName(title || 'Model') } : null);
    return { notes, list, ends, choices: { excel,
      id: kept && kept.id ? kept.id : showcaseIdFrom(title), title,
      description: kept ? kept.description || '' : '', author: kept && kept.author ? kept.author : libraryAuthor,
      licence: kept ? kept.licence || '' : '', mark: kept ? kept.mark !== false : true,
      canvases: ticked, start, periods: per,
      boards: list.boards.map((b, i) => b.chosen ? i : -1).filter(i => i >= 0), play } };
  }

  // Makes the viewer from the choices: { fileName, bytes, text, showcase, problems, excel }. Keeps
  // the showcase in the document (marked unsaved when it changed). A Promise. With choices.excel
  // ({ file }), ExcelExporter makes the workbook first (askExcelForViewerWorkbook, 21-web-app.js;
  // `excelOpened`: its window, opened by the click — else opened here); if it can't, the error
  // carries `excel: true` and nothing is made. `withoutExcel` makes it without, as chosen.
  async function makeShowcaseViewerFile(choices, excelOpened){
    if(inPractice()) fail('Not while practising a tutorial: the practice model isn\'t your document.');
    const made = showcaseFromChoices(choices, graphBoards, { canvases, periodCount: periods.length });
    if(made.error) fail(made.error);
    const page = await viewerPageText();
    let excel = null, excelInfo = null;
    if(made.value.excel){
      const opened = excelOpened === undefined ? excelWindowForViewer() : excelOpened;
      try{
        const book = await askExcelForViewerWorkbook(made.value.boards || null, opened);
        excel = await viewerWorkbookBlock(book);
        excelInfo = { file: made.value.excel.file, bytes: book.bytes.length, notes: book.notes.slice() };
      }catch(err){
        const e = new Error('The Excel workbook couldn\'t be made: ' + (err && err.message ? err.message : String(err)));
        e.excel = true;
        throw e;
      }
    }
    const filled = fillViewerPage(page, made.value, buildSystemPayload(), excel);
    if(filled.error) fail(filled.error);
    if(JSON.stringify(made.value) !== JSON.stringify(docShowcase)){ docShowcase = made.value; markDocDirty(); }
    const fileName = made.value.id + '.html';
    return { fileName, bytes: new Blob([filled.page]).size, text: filled.page, showcase: cloneData(made.value), problems: made.problems.slice(), excel: excelInfo };
  }
  // The workbook from ExcelExporter as the viewer's excel block: checked (a zip, at most
  // CELL_MAP_LIMITS.workbook; the cell map cleaned), packed with the browser's own deflate, base64.
  async function viewerWorkbookBlock(book){
    const b = book.bytes;
    if(!(b instanceof Uint8Array) || b.length < 22 || b[0] !== 0x50 || b[1] !== 0x4B) fail('ExcelExporter\'s answer isn\'t a workbook.');
    if(b.length > CELL_MAP_LIMITS.workbook) fail('The workbook is too big to go in a viewer (over ' + Math.round(CELL_MAP_LIMITS.workbook / 1048576) + ' MB).');
    if(typeof CompressionStream !== 'function') fail('This browser can\'t pack the workbook. Use a current Chrome, Edge, Firefox or Safari.');
    const packed = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    let bin = '';
    for(let i = 0; i < packed.length; i += 0x8000) bin += String.fromCharCode.apply(null, packed.subarray(i, i + 0x8000));
    return viewerWorkbookFor(btoa(bin), b.length, book.map, book.notes);
  }
  // In an iPhone's or iPad's home-screen app, ExcelExporter opens in fmIDE's place, not beside it.
  const excelCantOpenBeside = () => navigator.standalone === true;

  // A touch screen (an iPhone or iPad): the file goes to the share sheet, and the window says how
  // to open a viewer there (a viewer saved in Files opens only in a preview, which runs no script).
  function onTouchScreen(){
    return navigator.maxTouchPoints > 0 && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }
  // The file to the person: the share sheet on a touch screen (an iPhone or iPad), else a download.
  async function giveViewerFile(made){
    const file = new File([made.text], made.fileName, { type: 'text/html' });
    if(onTouchScreen()) return shareFiles([file], made.fileName);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = made.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const viewerSizeText = (bytes) => bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';

  let showcaseMaker = null; // the open window: { refreshBoards }
  function showShowcaseMaker(){
    if(inPractice()){ showMessage('Not while practising a tutorial: the practice model isn\'t your document.'); return; }
    if(showcaseMaker) showcaseMaker.close();
    const start = showcaseStartChoices();
    const c = start.choices;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box showcase-maker';
    addWindowHelp(box, 'showcase-viewer');
    makeResizableWindow(box, 'showcaseMaker');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey, true); showcaseMaker = null; }
    function onKey(ev){
      if(!document.body.contains(box) || overlay.nextElementSibling) return; // a question asked over it
      if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });

    const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text !== undefined) e.textContent = text; return e; };
    box.appendChild(el('p', 'showcase-maker-title', 'Make a showcase viewer'));
    box.appendChild(el('p', 'template-desc', 'One web page that shows this model read-only, with its boards and sliders, to email or share. It opens in any browser, offline.'));
    const field = (label, input) => { box.appendChild(el('label', 'fn-editor-label', label)); box.appendChild(input); return input; };
    const text = (cls, value, max) => { const i = el('input', 'fn-editor-note ' + cls); i.type = 'text'; i.value = value || ''; if(max) i.maxLength = max; i.autocomplete = 'off'; return i; };
    const title = field('Title', text('sm-title', c.title, SHOWCASE_LIMITS.title));
    const desc = el('textarea', 'fn-editor-description sm-description');
    desc.rows = 2; desc.maxLength = SHOWCASE_LIMITS.description; desc.value = c.description;
    field('Description', desc);
    const author = field('Author', text('sm-author', c.author, SHOWCASE_LIMITS.author));
    const licence = field('Licence (how visitors may reuse the model)', text('sm-licence', c.licence, SHOWCASE_LIMITS.licence));
    const licences = el('datalist');
    licences.id = 'smLicences';
    ['CC BY 4.0', 'All rights reserved', 'For teaching only'].forEach(v => { const o = el('option'); o.value = v; licences.appendChild(o); });
    box.appendChild(licences);
    licence.setAttribute('list', 'smLicences');
    const idRow = el('div', 'sm-file');
    const id = text('sm-id', c.id, SHOWCASE_LIMITS.id);
    idRow.append(id, el('span', 'sm-ext', '.html'));
    field('File name', idRow);
    let idTouched = !!(docShowcase && docShowcase.id);
    id.addEventListener('input', () => { idTouched = true; });
    title.addEventListener('input', () => { if(!idTouched) id.value = showcaseIdFrom(title.value); });

    // ---- the canvases ----
    box.appendChild(el('p', 'library-pack-heading', 'Canvases the visitor sees'));
    const canvasTicks = [];
    const startSel = el('select', 'sm-start');
    function syncStart(){
      const keep = startSel.value;
      startSel.textContent = '';
      canvasTicks.filter(t => t.cb.checked).forEach(t => { const o = el('option', null, t.name); o.value = t.id; startSel.appendChild(o); });
      startSel.value = canvasTicks.some(t => t.cb.checked && t.id === keep) ? keep : (startSel.options[0] ? startSel.options[0].value : '');
    }
    canvases.forEach(cv => {
      const row = el('label', 'function-export-row sm-canvas');
      const cb = el('input');
      cb.type = 'checkbox'; cb.checked = c.canvases.includes(cv.id); cb.dataset.id = cv.id;
      cb.addEventListener('change', syncStart);
      row.append(cb, document.createTextNode(' ' + String(cv.name || cv.id)));
      box.appendChild(row);
      canvasTicks.push({ id: cv.id, name: String(cv.name || cv.id), cb });
    });
    syncStart();
    startSel.value = c.start && c.canvases.includes(c.start) ? c.start : startSel.value;
    field('Opens on', startSel);

    // ---- the periods ----
    const perRow = el('div', 'sm-periods');
    const periodSel = (cls, value) => {
      const s = el('select', cls);
      periods.forEach((p, i) => { const o = el('option', null, String(p)); o.value = String(i); s.appendChild(o); });
      s.value = String(value);
      return s;
    };
    const fromSel = periodSel('sm-from', c.periods.from), toSel = periodSel('sm-to', c.periods.to);
    perRow.append(el('span', null, 'From '), fromSel, el('span', null, ' to '), toSel);
    field('Periods shown (visitors can\'t change them)', perRow);

    // ---- the boards ----
    const boardsBox = el('div', 'sm-boards');
    box.appendChild(boardsBox);
    let boardTicks = [], playFrom = null, playTo = null, chosenLine = '';
    function renderBoards(list, chosen, play){
      boardsBox.textContent = '';
      boardTicks = []; playFrom = playTo = null;
      boardsBox.appendChild(el('p', 'library-pack-heading', 'Boards (from fmGraph)'));
      if(chosenLine && list.boards.length) boardsBox.appendChild(el('p', 'sm-chosen', chosenLine));
      if(!list.boards.length){
        boardsBox.appendChild(el('p', 'sm-no-boards', 'This model has no fmGraph boards yet, so the viewer will show its logic only.'));
        const open = el('button', 'sm-open-fmgraph', 'Open fmGraph to make one');
        open.type = 'button';
        open.addEventListener('click', () => runCommand('openFmGraph'));
        boardsBox.appendChild(open);
        const choose = el('button', 'sm-choose-for-me', 'Choose for me');
        choose.type = 'button';
        choose.title = 'Add a board with a slider on each input and a bar on each result, to adjust in fmGraph';
        choose.addEventListener('click', () => {
          try{ chosenLine = chosenWords(chooseShowcaseBoards()); refreshBoards(); }
          catch(err){ showMessage(String(err && err.message ? err.message : err)); }
        });
        boardsBox.appendChild(choose);
        return;
      }
      list.boards.forEach((b, i) => {
        const row = el('label', 'function-export-row sm-board');
        const cb = el('input');
        cb.type = 'checkbox'; cb.checked = chosen.includes(i); cb.dataset.index = String(i);
        row.append(cb, document.createTextNode(' ' + b.name));
        boardsBox.appendChild(row);
        boardTicks.push(cb);
      });
      const ends = ['Base'].concat(list.scenarios.filter(n => n !== 'Base'));
      if(list.scenarios.length) boardsBox.appendChild(el('p', 'sm-scenarios', 'Scenarios: ' + list.scenarios.join(', ')));
      if(list.scenarios.includes('Base')) boardsBox.appendChild(el('p', 'sm-warn', 'A scenario is named "Base", which Play keeps for the model\'s own numbers: it can\'t be one of Play\'s ends.'));
      const endSel = (cls, value) => { const s = el('select', cls); ends.forEach(n => { const o = el('option', null, n); o.value = n; s.appendChild(o); }); s.value = ends.includes(value) ? value : ends[0]; return s; };
      playFrom = endSel('sm-play-from', play.from); playTo = endSel('sm-play-to', play.to);
      const playRow = el('div', 'sm-play');
      playRow.append(el('span', null, 'Play from '), playFrom, el('span', null, ' to '), playTo);
      boardsBox.appendChild(el('label', 'fn-editor-label', 'Play starts with'));
      boardsBox.appendChild(playRow);
    }
    renderBoards(start.list, c.boards, c.play);

    // ---- Excel (phase V4): the workbook ExcelExporter makes, carried in the viewer ----
    const excelRow = el('label', 'function-export-row sm-excel-row');
    const excelBox = el('input', 'sm-excel');
    excelBox.type = 'checkbox'; excelBox.checked = !!c.excel && !excelCantOpenBeside();
    excelRow.append(excelBox, document.createTextNode(' Include an Excel workbook'));
    box.appendChild(excelRow);
    const excelFile = text('sm-excel-file', c.excel ? c.excel.file : showcaseFileName(c.title || 'Model'), SHOWCASE_LIMITS.file);
    const excelFileLabel = el('label', 'fn-editor-label', 'Workbook name');
    box.appendChild(excelFileLabel);
    box.appendChild(excelFile);
    const excelNote = el('p', 'template-desc sm-excel-note', excelCantOpenBeside()
      ? 'Make it in Safari or on a computer to include Excel: here ExcelExporter can\'t open beside fmIDE.'
      : 'ExcelExporter opens for a moment to make it. Visitors download it with their scenario and sliders written in.');
    box.appendChild(excelNote);
    if(excelCantOpenBeside()) excelBox.disabled = true;
    const syncExcel = () => { excelFile.disabled = !excelBox.checked; };
    excelBox.addEventListener('change', syncExcel);
    syncExcel();

    const markRow = el('label', 'function-export-row');
    const mark = el('input', 'sm-mark');
    mark.type = 'checkbox'; mark.checked = c.mark;
    markRow.append(mark, document.createTextNode(' Show "Made with fmIDE"'));
    box.appendChild(markRow);
    const notes = el('p', 'sm-notes', start.notes.join(' '));
    if(!start.notes.length) notes.classList.add('hidden');
    box.appendChild(notes);
    box.appendChild(el('p', 'sm-secrecy', 'Everything in the model goes into the file, shown or not. Don\'t share a confidential model this way.'));
    if(onTouchScreen()) box.appendChild(el('p', 'sm-ipad', 'On an iPhone or iPad, a viewer saved in Files opens only in a preview, which can\'t run it. To open one there: in Safari, go to https://fmide.pages.dev/fmViewer, tap Choose, and pick the file.'));

    const actions = el('div', 'modal-actions');
    const cancelBtn = el('button', null, 'Cancel');
    const makeBtn = el('button', 'primary sm-make', 'Make viewer');
    actions.append(cancelBtn, makeBtn);
    box.appendChild(actions);
    cancelBtn.addEventListener('click', close);

    const choicesNow = () => ({
      id: id.value.trim(), title: title.value, description: desc.value, author: author.value, licence: licence.value, mark: mark.checked,
      canvases: canvasTicks.filter(t => t.cb.checked).map(t => t.id), start: startSel.value,
      periods: { from: Number(fromSel.value), to: Math.max(Number(fromSel.value), Number(toSel.value)) },
      boards: boardTicks.filter(cb => cb.checked).map(cb => Number(cb.dataset.index)),
      play: playFrom ? { from: playFrom.value, to: playTo.value } : null,
      excel: excelBox.checked ? { file: excelFile.value } : null });
    async function make(choices, excelOpened){
      makeBtn.disabled = true;
      try{
        const made = await makeShowcaseViewerFile(choices, excelOpened);
        if(author.value.trim()){ libraryAuthor = author.value.trim().slice(0, SHOWCASE_LIMITS.author); saveWorkspaceSoon(); }
        const how = await giveViewerFile(made);
        close();
        if(how === 'cancelled') return;
        const said = 'Made ' + made.fileName + ' (' + viewerSizeText(made.bytes) + ')' + (made.excel ? ', with its Excel workbook' : '') +
          '. It opens in any browser, offline, and changes nothing in your model.';
        const notes = made.problems.concat(made.excel ? made.excel.notes : []);
        if(notes.length) showMessage(said + '\n\n' + notes.join('\n'));
        else toast(said, 6000);
      }catch(err){
        makeBtn.disabled = false;
        const text = err && err.message ? err.message : String(err);
        // ExcelExporter couldn't make the workbook: the viewer without it, if the author wants.
        if(err && err.excel) showConfirm(text + '\n\nMake the viewer without it?', () => make(Object.assign({}, choices, { excel: null }), false));
        else showMessage(text);
      }
    }
    makeBtn.addEventListener('click', () => {
      const choices = choicesNow();
      // ExcelExporter's window opens now, while the click counts (a window opened later is blocked).
      const opened = choices.excel ? excelWindowForViewer() : false;
      make(choices, opened);
    });
    // Boards fmGraph sends while the window is open (takeGraphBoards): listed again, ticks kept by name.
    function refreshBoards(){
      const was = boardTicks.map(cb => ({ name: start.list.boards[Number(cb.dataset.index)] && start.list.boards[Number(cb.dataset.index)].name, on: cb.checked }));
      const play = playFrom ? { from: playFrom.value, to: playTo.value } : c.play;
      const list = showcaseBoardList(graphBoards);
      const chosen = list.boards.map((b, i) => { const w = was.find(x => x.name === b.name); return w ? (w.on ? i : -1) : (was.length ? -1 : i); }).filter(i => i >= 0);
      start.list = list;
      renderBoards(list, chosen, play);
    }
    showcaseMaker = { close, refreshBoards };
    title.focus();
  }
