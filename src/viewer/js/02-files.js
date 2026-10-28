// ============================================================
// Reading what a viewer shows: the model (an fmIDE system, or a workspace — a .fmide document
// is one) and the showcase, from the page's own data blocks (a viewer made for one model) or
// from files the visitor drops or chooses (the bare app). Every file goes through the shared
// readers: its size and depth first (fileTextProblem, fileDataProblem), the kind identified,
// a file of another kind refused with where it belongs, older versions upgraded step by step
// (the shared upgrades), a newer version opened only after asking.
// ============================================================
// The model's kinds, upgrades and words are fmGraph's (readModelData, FILE_FORMATS: 02-model.js
// of the board engine), so both apps read a model alike.

// A file's text parsed, with the shared limits: { raw } or { error }.
function parseFileText(text){
  const big = fileTextProblem(text);
  if(big) return { error: big };
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ return { error: "That file isn't JSON fmShowcase can read." }; }
  const deep = fileDataProblem(raw);
  if(deep) return { error: deep };
  return { raw };
}

// A model's text read into { system, presets, name, boards } (null after a message). boards: a
// workspace's own fmGraph boards (graphBoards, as data), shown when no showcase names any (the
// owner's choice 10 of phase V2).
async function readModelText(text, name){
  const p = parseFileText(text);
  if(p.error){ notify(p.error, 'err', 'load'); return null; }
  const r = readModelData(p.raw);
  if(r.error){ notify(r.error, 'err', 'load'); return null; }
  if(r.newer || r.newerParts.length){
    const what = r.newer ? 'This ' + FILE_FORMATS[r.kind].label + ' (format version ' + r.fromVersion + ')' : 'Part of this file — ' + r.newerParts.join(', ') + ' —';
    const go = await askConfirm('Saved by a newer version', what + ' was saved by a newer version of fmIDE. Open it anyway? Anything the newer version added may be ignored.', 'Open Anyway');
    if(!go) return null;
  }
  const system = r.kind === 'fmIDE-workspace' ? r.data.system : r.data;
  if(!system || !Array.isArray(system.canvases) || !system.canvases.length){ notify('That model has no canvases.', 'err', 'load'); return null; }
  const presets = r.kind === 'fmIDE-workspace' && Array.isArray(r.data.formatPresets) ? r.data.formatPresets
    : (Array.isArray(system.formatPresets) ? system.formatPresets : null);
  const boards = r.kind === 'fmIDE-workspace' && r.data.graphBoards && typeof r.data.graphBoards === 'object' && !Array.isArray(r.data.graphBoards) ? r.data.graphBoards : null;
  return { system, presets, boards, name: showcaseText(String(name || '').replace(/\.(fmide|json)$/i, ''), 120) || 'Model' };
}

// A showcase's parsed data read into its clean form (null after a message). A recipe is
// refused: it is for making many viewers, not for viewing.
async function readShowcase(raw){
  const r = readShowcaseData(raw);
  if(r.error){ notify(r.error, 'err', 'showcase'); return null; }
  if(r.newer){
    const go = await askConfirm('Saved by a newer version', 'This showcase (format version ' + r.fromVersion + ') was saved by a newer version of fmIDE. Open it anyway? Anything the newer version added may be ignored.', 'Open Anyway');
    if(!go) return null;
  }
  if(r.recipe){ notify('That is a recipe, for making many viewers at once (tools/make-viewers.js), not a showcase to view.', 'err', 'showcase'); return null; }
  const c = cleanShowcase(r.data);
  if(c.problems.length) notify('The showcase: ' + c.problems.join(' '), 'warn', 'showcase');
  return c.value;
}

// The page's own data blocks (a viewer made for one model): their text, or '' when empty.
function dataBlock(id){
  const el = $(id);
  return el && el.type === 'application/json' ? String(el.textContent || '').trim() : '';
}

// Files dropped or chosen: a model, a showcase, or both. A showcase on its own is laid over
// the model already open.
async function openFiles(files){
  const list = Array.from(files || []).slice(0, 4);
  if(!list.length) return false;
  let modelFile = null, showcaseRaw = null;
  for(const f of list){
    let text;
    try{ text = await f.text(); }catch(e){ notify('That file could not be read.', 'err', 'load'); return false; }
    const p = parseFileText(text);
    if(p.error){ notify(p.error, 'err', 'load'); return false; }
    if(p.raw && typeof p.raw === 'object' && !Array.isArray(p.raw) && p.raw.kind === SHOWCASE_KIND) showcaseRaw = p.raw;
    else modelFile = { text, name: f.name };
  }
  let showcase = null;
  if(showcaseRaw){
    showcase = await readShowcase(showcaseRaw);
    if(!showcase && !modelFile) return false;
  }
  if(modelFile){
    const m = await readModelText(modelFile.text, modelFile.name);
    if(!m) return false;
    return showModel(m, showcase);
  }
  if(!state.model){ notify('That is a showcase: open the model it shows with it (both files at once).', 'warn', 'load'); return false; }
  return showModel(state.model, showcase);
}

// Starting: a viewer made for one model opens on it; the bare app waits for a file.
async function startFromPage(){
  const modelText = dataBlock('model');
  if(!modelText) return false;
  let showcase = null;
  const scText = dataBlock('showcase');
  if(scText){
    const p = parseFileText(scText);
    if(p.error) notify('The showcase: ' + p.error, 'err', 'showcase');
    else showcase = await readShowcase(p.raw);
  }
  const m = await readModelText(modelText, showcase && showcase.title ? showcase.title : 'Model');
  if(!m) return false;
  return showModel(m, showcase);
}

// The drop box, the Open button and dropping anywhere.
function wireFiles(){
  const input = $('fileInput');
  letAnyFileBePicked([input]);
  input.addEventListener('change', async () => { const files = Array.from(input.files || []); input.value = ''; await openFiles(files); });
  $('btnOpen').addEventListener('click', () => input.click());
  const box = $('dropBox');
  box.addEventListener('click', () => input.click());
  box.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); input.click(); } });
  $('btnSample').addEventListener('click', () => { openSample(); }); // (10-sample.js)
  document.addEventListener('dragover', (ev) => { if(ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files')){ ev.preventDefault(); box.classList.add('over'); } });
  document.addEventListener('dragleave', () => box.classList.remove('over'));
  document.addEventListener('drop', async (ev) => {
    if(!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
    ev.preventDefault();
    box.classList.remove('over');
    await openFiles(ev.dataTransfer.files);
  });
}
