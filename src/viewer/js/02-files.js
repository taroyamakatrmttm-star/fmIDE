// ============================================================
// Reading what a viewer shows: the model (an fmIDE system, or a workspace — a .fmide document
// is one) and the showcase, from the page's own data blocks (a viewer made for one model) or
// from files the visitor drops or chooses (the bare app). Every file goes through the shared
// readers: its size and depth first (fileTextProblem, fileDataProblem), the kind identified,
// a file of another kind refused with where it belongs, older versions upgraded step by step
// (the shared upgrades), a newer version opened only after asking.
// ============================================================
const MODEL_FORMATS = {
  'system':          { current: SHARED_FILE_VERSIONS['system'], label: 'fmIDE system' },
  'fmIDE-workspace': { current: SHARED_FILE_VERSIONS['fmIDE-workspace'], label: 'fmIDE workspace' },
};

// Returns { error } or { kind, data (an upgraded copy), fromVersion, newer, newerParts }.
function readModelData(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: "That file doesn't hold an fmIDE model." };
  const kind = inferFileKind(raw);
  if(!kind || !MODEL_FORMATS[kind]){
    if(typeof kind === 'string' && /^(module|fmIDE-)/.test(kind)){
      return { error: 'That is an fmIDE file of another kind ("' + kind.slice(0, 40) + '"), not a whole model. In fmIDE, save the model with File → Save (a .fmide document).' };
    }
    return { error: "That file isn't an fmIDE model this version recognises." };
  }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion, newer } = upgradeFileData(data, kind, MODEL_FORMATS, SHARED_FILE_MIGRATIONS);
  const newerParts = [];
  if(kind === 'fmIDE-workspace'){
    if(!data.system || typeof data.system !== 'object') return { error: 'That workspace holds no model.' };
    const r = readModelData(data.system);
    if(r.error) return { error: "The workspace's model is unreadable: " + r.error };
    if(r.kind !== 'system') return { error: "The workspace's model is unreadable." };
    data.system = r.data;
    if(r.newer) newerParts.push('its model (format version ' + r.fromVersion + ')');
  }
  return { kind, data, fromVersion, newer, newerParts };
}

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

// A model's text read into { system, presets, name } (null after a message).
async function readModelText(text, name){
  const p = parseFileText(text);
  if(p.error){ notify(p.error, 'err', 'load'); return null; }
  const r = readModelData(p.raw);
  if(r.error){ notify(r.error, 'err', 'load'); return null; }
  if(r.newer || r.newerParts.length){
    const what = r.newer ? 'This ' + MODEL_FORMATS[r.kind].label + ' (format version ' + r.fromVersion + ')' : 'Part of this file — ' + r.newerParts.join(', ') + ' —';
    const go = await askConfirm('Saved by a newer version', what + ' was saved by a newer version of fmIDE. Open it anyway? Anything the newer version added may be ignored.', 'Open Anyway');
    if(!go) return null;
  }
  const system = r.kind === 'fmIDE-workspace' ? r.data.system : r.data;
  if(!system || !Array.isArray(system.canvases) || !system.canvases.length){ notify('That model has no canvases.', 'err', 'load'); return null; }
  const presets = r.kind === 'fmIDE-workspace' && Array.isArray(r.data.formatPresets) ? r.data.formatPresets
    : (Array.isArray(system.formatPresets) ? system.formatPresets : null);
  return { system, presets, name: showcaseText(String(name || '').replace(/\.(fmide|json)$/i, ''), 120) || 'Model' };
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
    showModel(m, showcase);
    return true;
  }
  if(!state.model){ notify('That is a showcase: open the model it shows with it (both files at once).', 'warn', 'load'); return false; }
  showModel(state.model, showcase);
  return true;
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
  showModel(m, showcase);
  return true;
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
  document.addEventListener('dragover', (ev) => { if(ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files')){ ev.preventDefault(); box.classList.add('over'); } });
  document.addEventListener('dragleave', () => box.classList.remove('over'));
  document.addEventListener('drop', async (ev) => {
    if(!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
    ev.preventDefault();
    box.classList.remove('over');
    await openFiles(ev.dataTransfer.files);
  });
}
