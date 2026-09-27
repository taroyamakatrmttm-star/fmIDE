  // ---------------------------------- Library packs (step 8, phase 8a) ----------------------------------
  // Sharing templates, recipes and functions as one file (11e-library-packs.js). The windows
  // use these actions too. They change the library, never the open model, so they are not
  // undo steps; they aren't recorded in macros (a pack is a whole file).

  defineAction({ name:'saveLibraryPack', label:'Save as Library Pack', category:'File', icon:'📦', returns:'value', mutates:false, tx:false, record:false,
    desc:'Writes a library pack: a file of templates, recipes and functions to share, licensed CC BY 4.0. templates and functions are lists of references ("Name" for the latest version, "Name@2", or the family id); a recipe brings its parts and a function the functions it calls. title and author are required. Downloads it unless download is false; returns the file\'s content.',
    params:[ P('title','string'), P('author','string'), P('description','text',{ def:'' }),
      P('tags','json',{ optional:true, help:'a list like ["statements", "tax"]' }),
      P('templates','json',{ optional:true, help:'list of template references' }),
      P('functions','json',{ optional:true, help:'list of function references' }),
      P('download','bool',{ def:true }) ],
    run(a){
      const list = (v, what) => {
        if(v == null) return [];
        if(!Array.isArray(v)) fail(`${what} must be a list, like ["Income Statement", "Margin@2"].`);
        return v;
      };
      const templates = list(a.templates, 'templates').map(ref => resolveTemplateRef(ref));
      const functions = list(a.functions, 'functions').map(ref => resolveFunctionRef(ref));
      const payload = libraryPackPayload({ title: a.title, author: a.author, description: a.description, tags: a.tags },
        templates, functions);
      libraryAuthor = payload.pack.author;
      saveWorkspaceSoon();
      if(a.download) downloadJSON(payload, libraryPackFileName(payload.pack.title));
      return payload;
    } });

  defineAction({ name:'previewLibraryPack', label:'Preview Library Pack', category:'File', icon:'📦', returns:'value', mutates:false, tx:false, record:false,
    desc:'Reads a library pack (its JSON) without adding anything: { pack: { id, title, author, licence, description, tags, created }, items: [{ key, type, kind, name, version, status, statusText, needs, origin, warning, warningKind }] }. status is "new", "present" (already in your library), "new-version" (adds a version to one you have) or "same-name" (a different one of yours has this name). origin: where an item shared again came from before (else null). warning: for a "new-version" item whose family came from another author (warningKind "other-author") or is your own ("own"), else null.',
    params:[ P('file','json') ],
    run(a){
      unwrapFileArgs(a);
      const read = readLibraryPack(a.file);
      return { pack: cloneData(read.pack), items: libraryPackItems(read).map(it => ({ key: it.key, type: it.type, kind: it.kind,
        name: it.name, version: it.version, status: it.status, statusText: it.statusText, needs: it.needs.slice(),
        origin: it.origin ? Object.assign({}, it.origin) : null, warning: it.warning, warningKind: it.warningKind })) };
    } });

  defineAction({ name:'openLibraryPack', label:'Open Library Pack', category:'File', icon:'📦', returns:'value', tx:false, record:false,
    desc:'Adds a library pack\'s items to your library, by the usual import rules (nothing of yours is replaced; a version whose number is taken is added under the next number). items: the keys previewLibraryPack gives (default: all); each brings what it needs. Each item added remembers where it came from (origin: this pack, or the pack it was shared in before). A pack from a newer fmIDE fails unless allowNewer is true. Returns { templates: { added, present, renumbered }, functions: { … } }.',
    params:[ P('file','json'), P('items','json',{ optional:true, help:'item keys, like ["t0", "f1"]' }), P('allowNewer','bool',{ def:false }) ],
    run(a){
      unwrapFileArgs(a);
      if(a.items != null && !Array.isArray(a.items)) fail('items must be a list of item keys, like ["t0", "f1"].');
      const read = readLibraryPack(a.file);
      if(read.newer && !a.allowNewer) fail(`This library pack was saved by a newer version of fmIDE (format version ${read.fromVersion}). Pass allowNewer: true to read it anyway.`);
      return addFromLibraryPack(read, a.items);
    } });

  // ---------------------------------- Browsing the library (step 8, phase 8d) ----------------------------------
  // The library published on fmIDE's own site (11f-library-browse.js). These answer later
  // (they return a Promise), so a macro can't run them (macro: false): they are not offered
  // in the Macro Builder or the Command Launcher, and fail inside a macro. Never recorded.
  // In the single file (apps/) they fail without making any request.
  const LIBRARY_NOT_IN_MACROS = 'The community library can\'t be used in a macro: browsing it waits for the network. Use File → Browse Library….';

  defineAction({ name:'listLibrary', label:'List the Library', category:'File', icon:'📚', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Reads the community library\'s list from fmIDE\'s own site (/library/index.json) and returns a Promise of { packs: [{ id, title, author, licence, description, tags, created, added, bytes, sha256, packVersion, counts, items: [{ type, kind, name, family, version, versionId, group, description, note, origin, here }] }], dropped }. here: that version is already in your library. dropped: entries that failed fmIDE\'s checks and are left out. Only on the published site; not in macros.',
    run(){
      if(runCtx) fail(LIBRARY_NOT_IN_MACROS);
      return loadLibraryIndex().then(index => ({
        packs: index.packs.map(p => Object.assign(cloneData(p), { items: p.items.map(it => Object.assign(cloneData(it), { here: libraryItemHere(it) })) })),
        dropped: index.dropped }));
    } });

  defineAction({ name:'previewLibraryPackFromLibrary', label:'Preview a Pack from the Library', category:'File', icon:'📚', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Fetches a pack of the community library by its id, checks it against the library\'s list (size and SHA-256 fingerprint) and returns a Promise of what previewLibraryPack returns, without adding anything. Only on the published site; not in macros.',
    params:[ P('id','string') ],
    run(a){
      if(runCtx) fail(LIBRARY_NOT_IN_MACROS);
      return libraryEntry(a.id).then(entry => fetchLibraryPack(entry).then(text => callAction('previewLibraryPack', { file: readLibraryPackText(text, entry).file })));
    } });

  defineAction({ name:'addFromLibrary', label:'Add from the Library', category:'File', icon:'📚', returns:'value', tx:false, record:false, macro:false,
    desc:'Fetches a pack of the community library by its id, checks it against the library\'s list (size and SHA-256 fingerprint) and adds its items as openLibraryPack does (items: the keys previewLibraryPackFromLibrary gives; default all). Returns a Promise of openLibraryPack\'s result. Only on the published site; not in macros.',
    params:[ P('id','string'), P('items','json',{ optional:true, help:'item keys, like ["t0", "f1"]' }), P('allowNewer','bool',{ def:false }) ],
    run(a){
      if(runCtx) fail(LIBRARY_NOT_IN_MACROS);
      if(a.items != null && !Array.isArray(a.items)) fail('items must be a list of item keys, like ["t0", "f1"].');
      return libraryEntry(a.id).then(entry => fetchLibraryPack(entry).then(text =>
        callAction('openLibraryPack', { file: readLibraryPackText(text, entry).file, items: a.items, allowNewer: a.allowNewer })));
    } });
