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
    desc:'Reads a library pack (its JSON) without adding anything: { pack: { id, title, author, licence, description, tags, created }, items: [{ key, type, kind, name, version, status, statusText, needs }] }. status is "new", "present" (already in your library), "new-version" (adds a version to one you have) or "same-name" (a different one of yours has this name).',
    params:[ P('file','json') ],
    run(a){
      unwrapFileArgs(a);
      const read = readLibraryPack(a.file);
      return { pack: cloneData(read.pack), items: libraryPackItems(read).map(it => ({ key: it.key, type: it.type, kind: it.kind,
        name: it.name, version: it.version, status: it.status, statusText: it.statusText, needs: it.needs.slice() })) };
    } });

  defineAction({ name:'openLibraryPack', label:'Open Library Pack', category:'File', icon:'📦', returns:'value', tx:false, record:false,
    desc:'Adds a library pack\'s items to your library, by the usual import rules (nothing of yours is replaced; a version whose number is taken is added under the next number). items: the keys previewLibraryPack gives (default: all); each brings what it needs. A pack from a newer fmIDE fails unless allowNewer is true. Returns { templates: { added, present, renumbered }, functions: { … } }.',
    params:[ P('file','json'), P('items','json',{ optional:true, help:'item keys, like ["t0", "f1"]' }), P('allowNewer','bool',{ def:false }) ],
    run(a){
      unwrapFileArgs(a);
      if(a.items != null && !Array.isArray(a.items)) fail('items must be a list of item keys, like ["t0", "f1"].');
      const read = readLibraryPack(a.file);
      if(read.newer && !a.allowNewer) fail(`This library pack was saved by a newer version of fmIDE (format version ${read.fromVersion}). Pass allowNewer: true to read it anyway.`);
      return addFromLibraryPack(read, a.items);
    } });
