// ============================================================
// What a visitor moved, kept on this device (phase V2; docs/architecture/storage.md): the board
// shown, the scenario shown and every slider's position, in this browser's storage (the shared
// store, database fmShowcase), under a key for this viewer: its showcase's id and a hash of the
// showcase and the model, so a viewer made again after a change starts afresh and two viewers
// opened from disk (which may share one storage) never take each other's. Reopening the file
// shows them again; Reset forgets them. Read back like a file: numbers forced and kept in each
// slider's range, the board and the scenario checked against this viewer's, anything else left
// out. Without storage (a private window; some browsers from disk) nothing is remembered and
// everything else works. Nothing ever leaves the device.
// ============================================================
const viewerStore = createStore('fmShowcase');
const STATE_PREFIX = 'viewer-state-';
let stateKey = null;   // this viewer's key, once a model with boards is shown
let stateTimer = null;

// FNV-1a and a second hash over the text, as fmGraph's modelSignature: short and steady.
function textHash(text){
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for(let i = 0; i < text.length; i++){
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
function viewerStateKey(showcase, system, boardsRaw){
  const id = showcase && showcase.id ? showcase.id : 'model';
  return STATE_PREFIX + id + '-' + textHash(JSON.stringify([showcase || null, system, boardsRaw || null]));
}

// The kept state's file form: { v: 1, board, scenario, sliders: [[value per slider] per board] }.
function stateData(){
  return { v: 1, board: Math.max(0, boards.indexOf(board)), scenario: shownScenario,
    sliders: boards.map(b => b.sliders.map(s => (s.value === null || !Number.isFinite(s.value)) ? null : s.value)) };
}
// What was kept, read against these boards: { board, scenario, sliders } or null.
function cleanViewerState(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1) return null;
  const b = Math.round(Number(raw.board));
  const out = { board: Number.isInteger(b) && b >= 0 && b < boards.length ? b : 0, scenario: null, sliders: boards.map(x => x.sliders.map(() => null)) };
  if(typeof raw.scenario === 'string'){ const sc = scenarios.find(s => s.name === raw.scenario); if(sc) out.scenario = sc.name; }
  if(Array.isArray(raw.sliders)) raw.sliders.slice(0, boards.length).forEach((list, i) => {
    if(!Array.isArray(list)) return;
    list.slice(0, boards[i].sliders.length).forEach((v, j) => {
      const s = boards[i].sliders[j];
      if(typeof v === 'number' && Number.isFinite(v) && v >= s.min && v <= s.max) out.sliders[i][j] = v;
    });
  });
  return out;
}

// Puts back what this device kept for the viewer shown (when anything was).
async function restoreState(){
  if(!stateKey) return false;
  const key = stateKey;
  let raw = null;
  try{ await viewerStore.ready; raw = await viewerStore.get(key); }catch(e){ return false; }
  if(key !== stateKey || typeof raw !== 'string' || !raw || raw.length > 200000) return false;
  let data;
  try{ data = cleanViewerState(JSON.parse(raw)); }catch(e){ return false; }
  if(!data) return false;
  syncShared(); // every sharing slider knows the shared positions before any is set (03-calc.js)
  boards.forEach((b, i) => b.sliders.forEach((s, j) => { s.value = data.sliders[i][j]; }));
  board = boards[data.board];
  if(data.scenario){ showScenarioExact(findScenario(data.scenario)); return true; }
  renderBoard();
  return true;
}
function saveStateSoon(){
  if(!stateKey) return;
  clearTimeout(stateTimer);
  stateTimer = setTimeout(saveStateNow, 300);
}
function saveStateNow(){
  clearTimeout(stateTimer);
  if(!stateKey || !boards.length) return;
  const text = JSON.stringify(stateData());
  viewerStore.put(stateKey, text).catch(() => { /* not kept: everything else works */ });
}
function forgetState(){
  clearTimeout(stateTimer);
  if(stateKey) viewerStore.remove(stateKey).catch(() => {});
}
