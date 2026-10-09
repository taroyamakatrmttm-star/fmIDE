  // =====================================================================================
  // ---------- Documents: New · Open · Save · Save As · Open Recent ----------
  // =====================================================================================
  // A document is a .fmide file holding the whole workspace — exactly the fmIDE-workspace
  // JSON that Export Workspace writes, so there is no new file format. Where the browser
  // has the File System Access API (Chrome, Edge) Open and Save As get a file handle and
  // Save writes straight back to the file; elsewhere Open uses a file input and Save
  // downloads name.fmide. Browser storage (05, src/shared/store.js) is the safety net:
  // the autosave also keeps which document is open and whether it has unsaved changes,
  // and Recent keeps a copy of each document as it was last opened or saved.
  // Opening a document never overwrites the person's own setup: the model and its format
  // presets/roles come from the file; its templates and macros are added when not already
  // present; its shortcuts and ribbon/KeyTips settings are ignored.
  const DOC_EXT = '.fmide';
  const DOC_PICKER_TYPES = [{ description: 'fmIDE document', accept: { 'application/json': [DOC_EXT, '.json'] } }];
  const DOC_SAVE_TYPES = [{ description: 'fmIDE document', accept: { 'application/json': [DOC_EXT] } }];
  const SESSION_KEY = 'fmIDE-session';               // { name, fileName, recentId, dirty } (JSON)
  const SESSION_HANDLE_KEY = 'fmIDE-session-handle'; // the open document's file handle
  const RECENT_KEY = 'fmIDE-recent';                 // [{ id, name, fileName, lastOpened, copySavedAt }] (JSON)
  const RECENT_MAX = 10;
  const recentCopyKey = (id) => 'fmIDE-recent:' + id;
  const recentHandleKey = (id) => 'fmIDE-recent-handle:' + id;
  const fileInputDocument = document.getElementById('fileInputDocument');
  // build:include shared/file-picker.js
  // On an iPhone or iPad a .fmide could not be picked at all (src/shared/file-picker.js).
  letAnyFileBePicked(['fileInputDocument', 'fileInputWorkspace', 'fileInputSystem'].map(id => document.getElementById(id)));

  // name: shown in the title (null = "Untitled"); fileName: the .fmide file it lives in,
  // if any (Save downloads it again where there is no handle); handle: the file handle.
  // serial changes whenever another document is opened or a new one started.
  const currentDoc = { name: null, fileName: null, handle: null, recentId: null, dirty: false, serial: 0 };
  const recentHandles = new Map(); // handles from this session, for when the browser can't store them
  let docChangeCount = 0;          // bumped on every change: a save only marks clean what it wrote
  let dirtySaveTimer = null;

  function docDisplayName(){ return currentDoc.name || 'Untitled'; }
  function updateDocTitle(){ document.title = docDisplayName() + (currentDoc.dirty ? ' •' : '') + ' — fmIDE'; if(phoneReady) phoneRefreshSoon(); }

  // Called for every change that goes into undo history (and undo/redo themselves). The
  // autosave follows about 2 s after the last change, besides the 8-second timer.
  function markDocDirty(){
    docChangeCount++;
    if(!currentDoc.dirty){ currentDoc.dirty = true; updateDocTitle(); }
    clearTimeout(dirtySaveTimer);
    dirtySaveTimer = setTimeout(saveWorkspace, 2000);
  }
  function markDocClean(){ currentDoc.dirty = false; updateDocTitle(); }
  function clearUndoHistory(){ history = []; future = []; updateHistoryButtons(); }

  function docNameFromFile(fileName){
    const base = String(fileName || '').split(/[\\/]/).pop().replace(/\.(fmide|json)$/i, '').trim();
    return base.slice(0, 200) || 'Untitled';
  }
  function safeFileBase(name){
    return String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120) || 'Untitled';
  }
  function withDocExt(name){ const base = safeFileBase(String(name || '').replace(/\.fmide$/i, '')); return base + DOC_EXT; }
  function isFileHandle(h){ return !!h && typeof h === 'object' && typeof h.getFile === 'function'; }
  function formatWhen(iso){
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 'an earlier date' : d.toLocaleString();
  }

  // ---------- the session, as saved with the autosave ----------
  function documentSessionText(){
    return JSON.stringify({ name: currentDoc.name, fileName: currentDoc.fileName, recentId: currentDoc.recentId, dirty: currentDoc.dirty });
  }
  // A handle the browser can't keep is dropped rather than left pointing at the previous
  // document's file: after a reload, Save then asks where to save.
  function rememberSessionHandle(){
    const drop = () => workspaceStore.remove(SESSION_HANDLE_KEY).catch(() => {});
    if(currentDoc.handle) workspaceStore.put(SESSION_HANDLE_KEY, currentDoc.handle).catch(drop);
    else drop();
  }
  // Restores which document was open (only when the autosaved workspace itself came back).
  function loadDocumentSession(restored){
    if(!restored) return Promise.resolve();
    return workspaceStore.get(SESSION_KEY).then(text => {
      let s = null;
      try{ s = typeof text === 'string' ? JSON.parse(text) : null; }catch(err){ s = null; }
      if(!s || typeof s !== 'object') return;
      currentDoc.name = (typeof s.name === 'string' && s.name) ? s.name.slice(0, 200) : null;
      currentDoc.fileName = (typeof s.fileName === 'string' && s.fileName) ? s.fileName.slice(0, 255) : null;
      currentDoc.recentId = typeof s.recentId === 'string' ? s.recentId : null;
      currentDoc.dirty = s.dirty === true;
      // Only the handle of this very file (never write one document into another's file).
      return workspaceStore.get(SESSION_HANDLE_KEY).then(h => {
        if(isFileHandle(h) && currentDoc.fileName && h.name === currentDoc.fileName) currentDoc.handle = h;
      });
    }).catch(() => {});
  }

  // After a restart with unsaved changes: say so, and offer to save them.
  function showRecoveryNotice(){
    if(!currentDoc.dirty || document.getElementById('recoveryBanner')) return;
    const bar = document.createElement('div');
    bar.id = 'recoveryBanner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed; top:60px; left:50%; transform:translateX(-50%); z-index:1999; max-width:640px; ' +
      'display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:#1e3a8a; color:#fff; ' +
      'font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.35);';
    const msg = document.createElement('span');
    msg.textContent = 'Recovered unsaved changes to “' + docDisplayName() + '”.';
    const save = document.createElement('button');
    save.textContent = 'Save';
    save.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:none; background:#fff; color:#1e3a8a; font-weight:700; cursor:pointer;';
    save.addEventListener('click', () => { saveDocument().then(ok => { if(ok) bar.remove(); }); });
    const dis = document.createElement('button');
    dis.textContent = 'Dismiss';
    dis.style.cssText = 'flex:none; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.5); background:transparent; color:#fff; cursor:pointer;';
    dis.addEventListener('click', () => bar.remove());
    bar.append(msg, save, dis);
    document.body.appendChild(bar);
  }
  function hideRecoveryNotice(){ const b = document.getElementById('recoveryBanner'); if(b) b.remove(); }

  // Closing the tab with unsaved changes: the browser's own "Leave site?" question.
  // skipLeaveWarning: set for fmIDE's own reload onto a new version, after an autosave.
  let skipLeaveWarning = false;
  window.addEventListener('beforeunload', (ev) => {
    // While practising (01c), what counts is your own document, set aside until the tutorial ends.
    if(!(inPractice() ? practiceSavedDirty() : currentDoc.dirty) || skipLeaveWarning) return;
    ev.preventDefault();
    ev.returnValue = '';
  });

  // ---------- in-app dialogs ----------
  // Save / Don't save / Cancel. Escape and a click outside mean Cancel.
  function confirmDiscardChanges(proceed){
    if(!currentDoc.dirty){ proceed(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.id = 'saveChangesDialog';
    const p = document.createElement('p');
    p.textContent = 'Do you want to save the changes to “' + docDisplayName() + '”?';
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';
    const dontBtn = document.createElement('button'); dontBtn.textContent = "Don't save";
    const saveBtn = document.createElement('button'); saveBtn.className = 'primary'; saveBtn.textContent = 'Save';
    actions.append(cancelBtn, dontBtn, saveBtn);
    box.append(p, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if(ev.key === 'Escape') close(); }
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
    dontBtn.addEventListener('click', () => { close(); proceed(); });
    saveBtn.addEventListener('click', () => { close(); saveDocument().then(saved => { if(saved) proceed(); }); });
    document.addEventListener('keydown', onKey);
    saveBtn.focus();
  }

  // Where the browser can't show a save dialog: ask for a name, then download. Resolves
  // with the file name, or null when cancelled.
  function askDocumentFileName(suggested){
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const box = document.createElement('div');
      box.className = 'modal-box';
      box.id = 'saveAsDialog';
      const p = document.createElement('p');
      p.textContent = 'Save as (the file is downloaded):';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'saveAsName';
      input.value = suggested.replace(/\.fmide$/i, '');
      input.style.cssText = 'width:100%; box-sizing:border-box; margin-bottom:14px; padding:6px 8px;';
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';
      const saveBtn = document.createElement('button'); saveBtn.className = 'primary'; saveBtn.textContent = 'Save';
      actions.append(cancelBtn, saveBtn);
      box.append(p, input, actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function done(value){ overlay.remove(); resolve(value); }
      cancelBtn.addEventListener('click', () => done(null));
      overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) done(null); });
      saveBtn.addEventListener('click', () => done(withDocExt(input.value)));
      input.addEventListener('keydown', (ev) => {
        if(ev.key === 'Enter'){ ev.preventDefault(); done(withDocExt(input.value)); }
        if(ev.key === 'Escape'){ ev.preventDefault(); done(null); }
      });
      input.focus();
      input.select();
    });
  }

  // ---------- New ----------
  // An empty model: one empty "Canvas 1" and one period. The format presets and roles are
  // kept (a house style), as are templates, macros, shortcuts and the ribbon.
  function newDocument(){
    confirmDiscardChanges(() => {
      applySystemDataDirect({ canvases: [{ id: 'c' + nextCanvasId, name: 'Canvas 1', nodes: [], edges: [] }], periods: ['Period 1'], currentPeriod: 0 });
      graphBoards = null;
      render();
      Object.assign(currentDoc, { name: null, fileName: null, handle: null, recentId: null, serial: currentDoc.serial + 1 });
      clearUndoHistory();
      hideRecoveryNotice();
      markDocClean();
      rememberSessionHandle();
      saveWorkspace();
    });
  }

  // ---------- Open ----------
  function openDocument(){ confirmDiscardChanges(pickDocumentToOpen); }

  function pickDocumentToOpen(){
    if(typeof window.showOpenFilePicker !== 'function'){ fileInputDocument.click(); return; }
    let picking;
    try{ picking = window.showOpenFilePicker({ types: DOC_PICKER_TYPES, multiple: false }); }
    catch(err){ fileInputDocument.click(); return; }
    Promise.resolve(picking).then(async (handles) => {
      const handle = handles && handles[0];
      if(!handle) return;
      const file = await handle.getFile();
      openDocumentText(await file.text(), file.name || handle.name, handle);
    }).catch(err => {
      if(err && err.name === 'AbortError') return; // the person closed the dialog
      if(err && err.name === 'SecurityError'){ fileInputDocument.click(); return; }
      showMessage('Could not open that file.');
    });
  }

  fileInputDocument.addEventListener('change', () => {
    const file = fileInputDocument.files && fileInputDocument.files[0];
    fileInputDocument.value = ''; // the same file can be picked again
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => openDocumentText(String(reader.result), file.name, null);
    reader.onerror = () => showMessage('Could not read that file.');
    reader.readAsText(file);
  });

  // Opens a .fmide (a workspace) or a workspace/system .json. Only a .fmide keeps its file
  // handle: Save on a .json document asks where to save a .fmide instead of overwriting it.
  // opts: { recentId, notice }
  function openDocumentText(text, fileName, handle, opts){
    opts = opts || {};
    openFmFileText(text, ['fmIDE-workspace', 'system'], (data, r) => {
      const system = r.kind === 'system' ? data : data.system;
      if(!system || !Array.isArray(system.canvases) || system.canvases.length === 0){
        showMessage("That file doesn't contain a model (expected a non-empty \"canvases\" list).");
        return;
      }
      const isDocFile = /\.fmide$/i.test(String(fileName || ''));
      applyDocumentData(data, r.kind);
      Object.assign(currentDoc, {
        name: docNameFromFile(fileName),
        fileName: isDocFile ? String(fileName).split(/[\\/]/).pop() : null,
        handle: isDocFile && isFileHandle(handle) ? handle : null,
        recentId: opts.recentId || null,
        serial: currentDoc.serial + 1
      });
      clearUndoHistory();
      hideRecoveryNotice();
      markDocClean();
      rememberSessionHandle();
      saveWorkspace();
      addToRecent(text, isFileHandle(handle) ? handle : null, String(fileName || ''));
      if(opts.notice) toast(opts.notice, 6000);
    });
  }

  function applyDocumentData(data, kind){
    const system = kind === 'system' ? data : data.system;
    applySystemDataDirect(system);
    graphBoards = kind === 'fmIDE-workspace' ? cleanGraphBoards(data.graphBoards) : null;
    const presets = (kind === 'fmIDE-workspace' && Array.isArray(data.formatPresets) && data.formatPresets.length)
      ? data.formatPresets : system.formatPresets;
    if(Array.isArray(presets)) mergeFormatPresets(presets);
    ensureDefaultFormatPresets();
    if(kind === 'fmIDE-workspace'){
      addMissingTemplates(data.templates);
      addMissingFunctions(data.functions);
      addMissingMacros(data.macros);
      syncMacroCommands();
    }
    renderCanvasTabs();
    render();
  }

  // Templates from a document join the person's library through addMissingTemplates()
  // (11-templates-format-presets.js); macros likewise, unless the same one is already there.
  // Steps get fresh ids whenever a macro is imported, so compare them without ids. A macro
  // whose name was taken is imported as "<name> (imported)" — that copy counts as present.
  function macroStepsFingerprint(steps){
    return JSON.stringify(steps, (k, v) => (k === 'id' ? undefined : v));
  }
  function addMissingMacros(list){
    const fresh = (Array.isArray(list) ? list : []).filter(src => {
      if(!src || typeof src !== 'object' || !Array.isArray(src.steps)) return false;
      const name = String(src.name || 'Imported macro');
      const steps = macroStepsFingerprint(normalizeSteps(cloneData(src.steps)));
      return !MACROS.some(m => (m.name === name || m.name === name + ' (imported)') && macroStepsFingerprint(m.steps) === steps);
    });
    if(fresh.length) importMacros(fresh, 'add');
  }

  // ---------- Save / Save As ----------
  function documentText(){ return JSON.stringify(buildWorkspacePayload(), null, 2); }
  function canPickSaveFile(){ return typeof window.showSaveFilePicker === 'function'; }

  // Resolves true once the document is saved, false if it wasn't (cancelled or failed).
  function saveDocument(){
    const text = documentText();
    const changesSaved = docChangeCount;
    if(currentDoc.handle){
      return writeToHandle(currentDoc.handle, text).then(ok => {
        if(ok){ afterSaved(text, currentDoc.handle, currentDoc.handle.name || currentDoc.fileName, changesSaved); return true; }
        toast('Could not write to “' + docDisplayName() + '” — choose where to save it.', 4000);
        return saveDocumentAs(text, changesSaved);
      });
    }
    if(currentDoc.fileName && !canPickSaveFile()){
      downloadDocument(text, currentDoc.fileName);
      afterSaved(text, null, currentDoc.fileName, changesSaved);
      return Promise.resolve(true);
    }
    return saveDocumentAs(text, changesSaved);
  }

  function saveDocumentAs(text, changesSaved){
    if(typeof text !== 'string') text = documentText();
    if(typeof changesSaved !== 'number') changesSaved = docChangeCount;
    const suggested = withDocExt(docDisplayName());
    const viaDownload = () => askDocumentFileName(suggested).then(fileName => {
      if(!fileName) return false;
      downloadDocument(text, fileName);
      afterSaved(text, null, fileName, changesSaved, true);
      return true;
    });
    if(!canPickSaveFile()) return viaDownload();
    let picking;
    try{ picking = window.showSaveFilePicker({ suggestedName: suggested, types: DOC_SAVE_TYPES }); }
    catch(err){ return viaDownload(); }
    return Promise.resolve(picking).then(handle => writeToHandle(handle, text).then(ok => {
      if(!ok){ showMessage('Could not save to that file.'); return false; }
      afterSaved(text, handle, handle.name || suggested, changesSaved, true);
      return true;
    }), err => {
      if(err && err.name === 'AbortError') return false;
      return viaDownload();
    });
  }

  function writeToHandle(handle, text){
    return (async () => {
      if(typeof handle.queryPermission === 'function'){
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if(perm !== 'granted' && typeof handle.requestPermission === 'function') perm = await handle.requestPermission({ mode: 'readwrite' });
        if(perm !== 'granted') return false;
      }
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      return true;
    })().catch(() => false);
  }

  function downloadDocument(text, fileName){
    // octet-stream, so no browser swaps the .fmide extension for .json
    const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // asNewFile (Save As): a new file, so a new Recent entry; the old file keeps its own.
  function afterSaved(text, handle, fileName, changesSaved, asNewFile){
    if(asNewFile){ currentDoc.recentId = null; currentDoc.serial++; }
    currentDoc.handle = handle || null;
    currentDoc.fileName = String(fileName || '').split(/[\\/]/).pop() || null;
    currentDoc.name = docNameFromFile(currentDoc.fileName);
    // A change made while the file was being written is still unsaved.
    if(docChangeCount === changesSaved) markDocClean(); else updateDocTitle();
    hideRecoveryNotice();
    rememberSessionHandle();
    saveWorkspace();
    addToRecent(text, handle || null, currentDoc.fileName);
    toast('Saved “' + docDisplayName() + '”.');
  }

  // ---------- Recent ----------
  // Each entry keeps its name, when it was last opened, the file handle when the browser
  // gives one, and a copy of the document as last opened or saved (so browsers without
  // file handles can still reopen it). Updates run one at a time.
  let recentQueue = Promise.resolve();
  function readRecent(){
    return workspaceStore.get(RECENT_KEY).then(text => {
      let list = [];
      try{ list = typeof text === 'string' ? JSON.parse(text) : []; }catch(err){ list = []; }
      return (Array.isArray(list) ? list : []).filter(e => e && typeof e.id === 'string' && typeof e.name === 'string');
    }, () => []);
  }
  function forgetRecentEntry(id){
    recentHandles.delete(id);
    workspaceStore.remove(recentCopyKey(id)).catch(() => {});
    workspaceStore.remove(recentHandleKey(id)).catch(() => {});
  }
  // The document is captured when the update is queued: by the time it runs, another
  // document may be open, and that one must not take over this entry.
  function addToRecent(text, handle, fileName){
    const docAtCall = currentDoc.serial;
    const nameAtCall = currentDoc.name;
    const recentIdAtCall = currentDoc.recentId;
    recentQueue = recentQueue.then(async () => {
      const list = await readRecent();
      let entry = recentIdAtCall ? list.find(e => e.id === recentIdAtCall) : null;
      if(!entry && handle && typeof handle.isSameEntry === 'function'){
        for(const e of list){
          const h = recentHandles.get(e.id) || await workspaceStore.get(recentHandleKey(e.id)).catch(() => null);
          if(isFileHandle(h) && await Promise.resolve(h.isSameEntry(handle)).catch(() => false)){ entry = e; break; }
        }
      }
      if(!entry && !handle && fileName) entry = list.find(e => e.fileName === fileName);
      if(!entry) entry = { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) };
      const now = new Date().toISOString();
      entry.name = nameAtCall || docNameFromFile(fileName);
      entry.fileName = fileName || null;
      entry.lastOpened = now;
      if(currentDoc.serial === docAtCall) currentDoc.recentId = entry.id;
      try{ await workspaceStore.put(recentCopyKey(entry.id), text); entry.copySavedAt = now; }
      catch(err){ /* storage full: the entry can still reopen the real file */ }
      if(handle){
        recentHandles.set(entry.id, handle);
        await workspaceStore.put(recentHandleKey(entry.id), handle).catch(() => {});
      }
      const others = list.filter(e => e.id !== entry.id);
      others.slice(RECENT_MAX - 1).forEach(e => forgetRecentEntry(e.id));
      await workspaceStore.put(RECENT_KEY, JSON.stringify([entry].concat(others.slice(0, RECENT_MAX - 1)))).catch(() => {});
      saveWorkspace(); // the session now names this entry
    }).catch(() => {});
    return recentQueue;
  }
  function clearRecent(){
    recentQueue = recentQueue.then(async () => {
      (await readRecent()).forEach(e => forgetRecentEntry(e.id));
      await workspaceStore.put(RECENT_KEY, '[]').catch(() => {});
      currentDoc.recentId = null;
      saveWorkspace();
    }).catch(() => {});
    return recentQueue;
  }

  // Waits for Recent updates still being written (a document opened or saved a moment ago).
  function showOpenRecent(){
    recentQueue.then(readRecent).then(list => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const box = document.createElement('div');
      box.className = 'modal-box';
      addWindowHelp(box, 'documents');
      box.id = 'openRecentDialog';
      box.style.minWidth = '380px';
      const h = document.createElement('p');
      h.textContent = list.length ? 'Open a recent document:' : 'No recent documents.';
      const ul = document.createElement('div');
      ul.id = 'recentList';
      ul.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-bottom:16px;';
      function close(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
      function onKey(ev){ if(ev.key === 'Escape') close(); }
      list.forEach(e => {
        const item = document.createElement('button');
        item.className = 'recent-item';
        item.style.cssText = 'display:flex; justify-content:space-between; gap:16px; text-align:left; padding:8px 10px; cursor:pointer;';
        const name = document.createElement('span'); name.className = 'recent-name'; name.textContent = e.name;
        const when = document.createElement('span'); when.style.opacity = '0.65'; when.textContent = formatWhen(e.lastOpened);
        item.append(name, when);
        item.addEventListener('click', () => { close(); confirmDiscardChanges(() => reopenRecent(e)); });
        ul.appendChild(item);
      });
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const clearBtn = document.createElement('button'); clearBtn.textContent = 'Clear Recent'; clearBtn.disabled = !list.length;
      clearBtn.addEventListener('click', () => { close(); clearRecent().then(() => toast('Recent documents cleared.')); });
      const closeBtn = document.createElement('button'); closeBtn.className = 'primary'; closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', close);
      actions.append(clearBtn, closeBtn);
      box.append(h, ul, actions);
      overlay.appendChild(box);
      overlay.addEventListener('mousedown', (ev) => { if(ev.target === overlay) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      (ul.querySelector('button') || closeBtn).focus();
    });
  }

  // The real file when there is a handle and the person allows access again; otherwise
  // the copy kept in this browser, saying so.
  async function reopenRecent(entry){
    const handle = recentHandles.get(entry.id) || await workspaceStore.get(recentHandleKey(entry.id)).catch(() => null);
    if(isFileHandle(handle)){
      try{
        if(typeof handle.queryPermission === 'function'){
          let perm = await handle.queryPermission({ mode: 'read' });
          if(perm !== 'granted' && typeof handle.requestPermission === 'function') perm = await handle.requestPermission({ mode: 'read' });
          if(perm !== 'granted') throw new Error('Access not allowed');
        }
        const file = await handle.getFile();
        openDocumentText(await file.text(), file.name || handle.name || entry.fileName, handle, { recentId: entry.id });
        return;
      }catch(err){ /* fall back to the copy */ }
    }
    const copy = await workspaceStore.get(recentCopyKey(entry.id)).catch(() => null);
    if(typeof copy === 'string'){
      openDocumentText(copy, entry.fileName || withDocExt(entry.name), null, {
        recentId: entry.id,
        notice: 'Opened the copy saved in this browser on ' + formatWhen(entry.copySavedAt) + '.'
      });
      return;
    }
    showMessage('“' + entry.name + '” can no longer be opened: the file is not available and no copy was kept in this browser.');
  }
