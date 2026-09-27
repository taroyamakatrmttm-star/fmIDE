  // ---------- browsing the community library (step 8, phase 8d) ----------
  // Browse Library… lists the packs of the library published on fmIDE's own site
  // (/library/index.json, written by the site's build) and hands the one chosen to the Open
  // Library Pack preview: nothing is added without it. The only network requests fmIDE
  // makes, and only when asked: the list and a pack's file, from its own site (the page's
  // security policy, connect-src 'self', allows nothing else). Nothing is ever sent.
  // - Only the published site (the page links a manifest, as for the service worker): the
  //   single file in apps/, opened from disk or served anywhere else, makes no request and
  //   says where the library is.
  // - Addresses are built here from a pack's id (letters, digits and dashes), never taken
  //   from the list. Same site only, no cookies, no redirects, sizes capped while reading.
  // - A pack must be exactly the bytes the list names (size and SHA-256 fingerprint) and
  //   carry the list's id; then it is read like a file opened by hand (openFmFileText).
  // - The list and the pack are someone else's text: checked by the shared reader
  //   (readLibraryIndexData) and shown with textContent only.
  // Neither the list nor packs are kept: the service worker leaves /library out of the offline
  // copy, and offline Browse Library says so.
  const LIBRARY_BASE = 'library/';
  const LIBRARY_PAGE_ADDRESS = 'https://fmide.pages.dev/library/';
  const LIBRARY_FROM_DISK = 'Browsing the library needs fmIDE\'s website. This copy of fmIDE is a single file, which never connects to anything. '
    + 'Open the library\'s page in your browser (' + LIBRARY_PAGE_ADDRESS + '), download a pack, then use File → Open Library Pack….';
  const LIBRARY_OFFLINE = 'Can\'t reach the library. You may be offline: the library needs a connection (everything else in fmIDE works offline).';
  const LIBRARY_KIND_WORDS = { module: 'canvas template', system: 'system template', recipe: 'recipe', function: 'function' };
  const LIBRARY_KIND_ORDER = ['recipe', 'module', 'system', 'function'];

  // Whether this page can reach the library: the published site only.
  function libraryOnSite(){
    return !!document.querySelector('link[rel="manifest"]') && /^https?:$/.test(location.protocol);
  }
  function libraryPackIdOk(id){ return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id); }

  // Reads `rel` (under library/) from this site: the bytes (Uint8Array), at most `max` of
  // them. `missing`: the message for "not there" (404); `tooLong` (optional): the message when
  // there are more than `max`. Fails with a message for people.
  async function fetchLibraryBytes(rel, max, missing, tooLong){
    if(!libraryOnSite()) fail(LIBRARY_FROM_DISK);
    const url = new URL(rel, new URL(LIBRARY_BASE, location.href));
    if(url.origin !== location.origin) fail('That is not an address of fmIDE\'s own site.');
    let res;
    try{ res = await fetch(url.href, { credentials: 'omit', redirect: 'error', cache: 'no-cache', referrerPolicy: 'no-referrer' }); }
    catch(err){ fail(LIBRARY_OFFLINE); }
    if(res.status === 404) fail(missing);
    if(!res.ok) fail(`The library answered with an error (${res.status}). Try again later.`);
    if(new URL(res.url).origin !== location.origin) fail('The library answered from another site, so nothing was read.');
    const tooBig = () => fail(tooLong || `The library sent more than ${Math.round(max / 1048576)} MB, so nothing was read.`);
    const declared = Number(res.headers.get('Content-Length'));
    if(declared > max) tooBig();
    const chunks = [];
    let total = 0;
    try{
      const reader = res.body.getReader();
      for(;;){
        const { done, value } = await reader.read();
        if(done) break;
        total += value.length;
        if(total > max){ reader.cancel().catch(() => {}); tooBig(); }
        chunks.push(value);
      }
    }catch(err){
      if(err instanceof FmError) throw err;
      fail(LIBRARY_OFFLINE);
    }
    const out = new Uint8Array(total);
    let at = 0;
    chunks.forEach(c => { out.set(c, at); at += c.length; });
    return out;
  }
  function libraryText(bytes, what){
    try{ return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch(err){ fail(`The ${what} isn't readable text (UTF-8).`); }
  }

  // The list: { packs (cleaned entries, readLibraryIndexData), dropped }.
  async function loadLibraryIndex(){
    const bytes = await fetchLibraryBytes('index.json', LIBRARY_INDEX_LIMITS.bytes, 'This copy of fmIDE\'s site has no library.');
    const text = libraryText(bytes, 'library\'s list');
    const tooBig = fileTextProblem(text);
    if(tooBig) fail(tooBig);
    let raw;
    try{ raw = JSON.parse(text); }catch(err){ fail('The library\'s list is not valid JSON.'); }
    const r = readLibraryIndexData(raw);
    if(r.error) fail(r.error);
    return { packs: r.packs, dropped: r.dropped, newer: r.newer };
  }
  // The pack `entry` names, checked against it: its text, exactly the bytes the list names.
  async function fetchLibraryPack(entry){
    if(!libraryPackIdOk(entry.id)) fail('That pack has no valid id.');
    const mismatch = 'This pack doesn\'t match the library\'s list, so it was not opened. Try again later; if it keeps happening, report it on the library\'s page.';
    const limit = Math.min(entry.bytes, LIBRARY_INDEX_LIMITS.packBytes);
    const bytes = await fetchLibraryBytes('packs/' + entry.id + '.fmide-pack.json', limit, 'This pack is no longer in the library.', mismatch);
    if(bytes.length !== entry.bytes) fail(mismatch);
    if(!(window.crypto && crypto.subtle)) fail('This browser can\'t check the pack\'s fingerprint (SHA-256), so it was not opened.');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
    if(hex !== entry.sha256) fail(mismatch);
    return libraryText(bytes, 'pack');
  }
  // A pack read from its text (the library's version of openFmFileText's checks, for the
  // window.fm actions): { read, file }. The pack must carry the list's id.
  function readLibraryPackText(text, entry){
    const tooBig = fileTextProblem(text);
    if(tooBig) fail(tooBig);
    let file;
    try{ file = JSON.parse(text); }catch(err){ fail('That pack is not valid JSON.'); }
    const read = readLibraryPack(file);
    if(read.pack.id !== entry.id) fail('This pack doesn\'t match the library\'s list, so it was not opened.');
    return { read, file };
  }
  // The entry with this id in a fresh copy of the list.
  async function libraryEntry(id){
    if(!libraryPackIdOk(id)) fail('Give a pack id from the library (letters, digits and dashes).');
    const index = await loadLibraryIndex();
    const entry = index.packs.find(p => p.id === id);
    if(!entry) fail(`The library has no pack "${id}".`);
    return entry;
  }

  // Whether an item of the list is already in your library (by its version id).
  function libraryItemHere(it){
    return it.type === 'function' ? FUNCTIONS.some(d => d.versionId === it.versionId) : TEMPLATES.some(t => t.versionId === it.versionId);
  }
  // "1 recipe · 2 canvas templates · 2 functions".
  function libraryCountsText(entry){
    return LIBRARY_KIND_ORDER.map(k => {
      const n = entry.items.filter(it => it.kind === k).length;
      return n ? n + ' ' + LIBRARY_KIND_WORDS[k] + (n === 1 ? '' : 's') : null;
    }).filter(Boolean).join(' · ') || 'nothing';
  }
  // Whether an entry matches the search text (ignoring capitals): its title, author,
  // description, tags and item names.
  function libraryEntryMatches(entry, query){
    const q = query.trim().toLowerCase();
    if(!q) return true;
    return [entry.title, entry.author, entry.description].concat(entry.tags, entry.items.map(it => it.name))
      .some(s => String(s).toLowerCase().includes(q));
  }
  // The entries to show: searched, filtered by tag and by what they hold, sorted.
  function libraryEntriesShown(packs, f){
    const list = packs.filter(p => libraryEntryMatches(p, f.query || '')
      && (!f.tag || p.tags.includes(f.tag))
      && (!f.holds || p.items.some(it => it.kind === f.holds)));
    if(f.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));
    return list;
  }

  // ---------- the window ----------
  function showLibraryBrowser(){
    if(!libraryOnSite()){ showMessage(LIBRARY_FROM_DISK); return; }
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; };
    const overlay = mk('div', 'modal-overlay');
    const box = mk('div', 'modal-box library-browse');
    box.appendChild(mk('p', 'library-pack-title', 'Community library'));
    box.appendChild(mk('p', 'library-browse-intro', 'Packs of templates, recipes and functions shared by fmIDE users, each licensed CC BY 4.0. Choose one to see what it holds; nothing is added until you tick items in its preview and press Add to My Library.'));
    const filters = mk('div', 'library-browse-filters');
    const search = mk('input', 'library-browse-search');
    search.type = 'search';
    search.placeholder = 'Search titles, authors, tags, items…';
    search.setAttribute('aria-label', 'Search the library');
    const select = (cls, label, options) => {
      const s = mk('select', cls);
      s.setAttribute('aria-label', label);
      options.forEach(([value, text]) => { const o = mk('option', '', text); o.value = value; s.appendChild(o); });
      return s;
    };
    const tagSel = select('library-browse-tag', 'Tag', [['', 'Any tag']]);
    const holdsSel = select('library-browse-holds', 'Holds', [['', 'Holds anything'], ['recipe', 'Holds recipes'], ['module', 'Holds canvas templates'], ['system', 'Holds system templates'], ['function', 'Holds functions']]);
    const sortSel = select('library-browse-sort', 'Sort', [['added', 'Newest first'], ['title', 'By title']]);
    filters.append(search, tagSel, holdsSel, sortSel);
    box.appendChild(filters);
    const status = mk('p', 'library-browse-status', 'Loading the library…');
    box.appendChild(status);
    const panes = mk('div', 'library-browse-panes');
    const list = mk('div', 'library-browse-list');
    const details = mk('div', 'library-browse-details');
    panes.append(list, details);
    box.appendChild(panes);
    const actions = mk('div', 'modal-actions');
    const addBtn = mk('button', 'primary library-browse-add', 'Preview and add…');
    addBtn.disabled = true;
    const closeBtn = mk('button', 'library-browse-close', 'Close');
    actions.append(closeBtn, addBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    let packs = [], dropped = 0, chosen = null, busy = false;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
    // Escape closes it when it is the dialog on top (not under a preview or a message).
    const onKey = (ev) => {
      if(ev.key !== 'Escape' || Array.from(document.querySelectorAll('.modal-overlay')).pop() !== overlay) return;
      ev.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', close);

    const summary = (shown) => {
      let s = shown.length === packs.length ? `${packs.length} pack${packs.length === 1 ? '' : 's'}` : `${shown.length} of ${packs.length} packs`;
      if(dropped) s += ` · ${dropped} pack${dropped === 1 ? '' : 's'} could not be shown (the list's details for ${dropped === 1 ? 'it' : 'them'} failed fmIDE's checks)`;
      return s + '.';
    };
    function renderList(){
      const shown = libraryEntriesShown(packs, { query: search.value, tag: tagSel.value, holds: holdsSel.value, sort: sortSel.value });
      status.textContent = packs.length ? summary(shown) : 'The library has no packs yet.' + (dropped ? ` ${dropped} could not be shown.` : '');
      list.textContent = '';
      shown.forEach(p => {
        const row = mk('button', 'library-browse-pack' + (chosen && chosen.id === p.id ? ' chosen' : ''));
        row.type = 'button';
        row.dataset.id = p.id;
        row.append(mk('span', 'library-browse-pack-title', p.title),
          mk('span', 'library-browse-pack-by', `by ${p.author}` + (p.added ? ` · added ${p.added}` : '')),
          mk('span', 'library-browse-pack-counts', libraryCountsText(p)));
        if(p.tags.length) row.appendChild(mk('span', 'library-browse-pack-tags', p.tags.join(', ')));
        if(p.description) row.appendChild(mk('span', 'library-browse-pack-description', p.description.length > 140 ? p.description.slice(0, 140) + '…' : p.description));
        row.addEventListener('click', () => { chosen = p; renderList(); renderDetails(); });
        list.appendChild(row);
      });
      if(!shown.length && packs.length) list.appendChild(mk('p', 'library-browse-none', 'No pack matches.'));
    }
    function renderDetails(){
      details.textContent = '';
      addBtn.disabled = !chosen || busy;
      if(!chosen){ details.appendChild(mk('p', 'library-browse-hint', 'Choose a pack to see what it holds.')); return; }
      const p = chosen;
      const lic = LIBRARY_PACK_LICENCES[p.licence];
      details.append(mk('p', 'library-pack-title', p.title),
        mk('p', 'library-pack-by', `By ${p.author} · ${lic.short}` + (p.created ? ` · made ${p.created}` : '') + (p.added ? ` · added ${p.added}` : '')));
      if(p.description) details.appendChild(mk('p', 'library-pack-description', p.description));
      if(p.tags.length) details.appendChild(mk('p', 'library-pack-tags', 'Tags: ' + p.tags.join(', ')));
      details.appendChild(mk('p', 'library-pack-tags library-browse-counts', 'Holds ' + libraryCountsText(p) + '.'));
      details.appendChild(mk('p', 'library-pack-licence', `Credit: “${p.title}” by ${p.author}, from the fmIDE community library, licensed under ${lic.short} (${lic.name}).`));
      LIBRARY_KIND_ORDER.forEach(k => {
        const items = p.items.filter(it => it.kind === k);
        if(!items.length) return;
        details.appendChild(mk('p', 'library-pack-heading', LIBRARY_KIND_WORDS[k][0].toUpperCase() + LIBRARY_KIND_WORDS[k].slice(1) + 's'));
        items.forEach(it => {
          const row = mk('div', 'library-browse-item');
          row.dataset.versionId = it.versionId;
          row.appendChild(mk('span', 'library-browse-item-name', `${it.name} v${it.version}` + (it.group ? ` · ${it.group}` : '')));
          if(libraryItemHere(it)) row.appendChild(mk('span', 'library-browse-item-here', 'In your library'));
          if(it.description) row.appendChild(mk('span', 'library-pack-item-detail', it.description));
          if(it.note) row.appendChild(mk('span', 'library-pack-item-detail', 'Note: ' + it.note));
          if(it.origin && it.origin.packId !== p.id) row.appendChild(mk('span', 'library-pack-item-origin', 'Shared before: ' + originText(it.origin)));
          details.appendChild(row);
        });
      });
      const link = mk('a', 'library-browse-page', 'Open its page in the catalogue ↗');
      link.href = LIBRARY_BASE + p.id;   // an id: letters, digits and dashes only
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      details.appendChild(mk('p', 'library-browse-link')).appendChild(link);
    }
    [search, tagSel, holdsSel, sortSel].forEach(c => c.addEventListener(c === search ? 'input' : 'change', renderList));
    addBtn.addEventListener('click', () => {
      if(!chosen || busy) return;
      const entry = chosen;
      busy = true;
      addBtn.disabled = true;
      status.textContent = `Fetching “${entry.title}”…`;
      fetchLibraryPack(entry).then(text => {
        busy = false;
        renderList(); renderDetails();
        if(!overlay.isConnected) return;
        openFmFileText(text, ['fmIDE-library-pack'], (data) => {
          const read = guarded(() => readLibraryPack(data));
          if(!read) return;
          if(read.pack.id !== entry.id){ showMessage('This pack doesn\'t match the library\'s list, so it was not opened.'); return; }
          showLibraryPackPreview(read, data, () => { if(overlay.isConnected) renderDetails(); });
        });
      }).catch(err => {
        busy = false;
        renderList(); renderDetails();
        reportError(err);
      });
    });
    renderDetails();
    loadLibraryIndex().then(index => {
      if(!overlay.isConnected) return;
      packs = index.packs;
      dropped = index.dropped;
      const tags = [];
      packs.forEach(p => p.tags.forEach(t => { if(!tags.includes(t)) tags.push(t); }));
      tags.sort().forEach(t => { const o = mk('option', '', t); o.value = t; tagSel.appendChild(o); });
      renderList();
      if(index.newer) status.textContent += ' The list was written by a newer fmIDE: some details may be missing.';
      search.focus();
    }).catch(err => {
      if(!overlay.isConnected) return;
      status.classList.add('library-browse-error');
      status.textContent = err instanceof FmError ? err.message : 'Could not read the library.';
      if(!(err instanceof FmError)) console.error(err);
    });
  }
