// ============================================================
// The board file (G3a; kind fmIDE-graph-board, version 1, docs/file-formats.md): Export this
// board, Export all boards, Import boards… (Board menu), or a board file dropped on the page.
// A board file names rectangles by canvas id, node id and name, so it fits the model it was
// made from — or another one built from the same templates. Importing reads it like any file
// (size and nesting limits, the kind, a newer version asked about) and through cleanBoards, as
// the boards kept in the browser are; widgets whose rectangles aren't in this model are left
// out and counted. Imported boards are added as new tabs (a name already used gets "(2)").
// ============================================================
const BOARD_FILE_FORMAT = { 'fmIDE-graph-board': { current: BOARD_FILE_VERSION, label: 'fmGraph board file' } };
// v1 → v2: a board file may be in the template form (G5a); a v1 file is boards for one model.
// v2 → v3: boards for one model may carry the model's named scenarios; v3 → v4: a chart may be a
// scenario waterfall.
const BOARD_FILE_MIGRATIONS = { 'fmIDE-graph-board': { 1: () => {}, 2: () => {}, 3: () => {} } };

function safeFileName(s){ return String(s).replace(/[^A-Za-z0-9 ._()-]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'board'; }

function downloadText(text, fileName){
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = make('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBoards(all){
  if(!model) return null;
  const data = boardsData(all ? null : [board]);
  const name = safeFileName(model.name + ' - ' + (all ? 'boards' : board.name)) + '.board.json';
  downloadText(JSON.stringify(data, null, 2), name);
  return data;
}

// Reads a board file's text and adds its boards. Resolves the number of boards added.
async function importBoardsText(text){
  if(!model){ notify('Open a model first: a board shows a model\'s rectangles.', 'info', 'boards'); return 0; }
  const big = fileTextProblem(text);
  if(big){ notify(big, 'err', 'boards'); return 0; }
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ notify("That file isn't JSON fmGraph can read.", 'err', 'boards'); return 0; }
  const deep = fileDataProblem(raw);
  if(deep){ notify(deep, 'err', 'boards'); return 0; }
  if(!raw || typeof raw !== 'object' || raw.kind !== 'fmIDE-graph-board'){ notify("That isn't an fmGraph board file.", 'err', 'boards'); return 0; }
  const data = JSON.parse(JSON.stringify(raw));
  const { fromVersion, newer } = upgradeFileData(data, 'fmIDE-graph-board', BOARD_FILE_FORMAT, BOARD_FILE_MIGRATIONS);
  if(newer && !(await askConfirm('Saved by a newer version', 'This board file (format version ' + fromVersion + ') was saved by a newer version of fmGraph. Open it anyway? Anything the newer version added may be ignored.', 'Open Anyway'))) return 0;
  if(data.form === 'template'){
    notify('That board was saved for a template. Attach it to the template in fmIDE: Templates → 📈 Attach fmGraph board….', 'info', 'boards');
    return 0;
  }
  const r = cleanBoards(data);
  const useful = r ? r.boards.filter(b => b.items.length || b.sliders.length) : [];
  // Its scenarios: those with a name not used here are added (a name used here keeps yours).
  const newScenarios = r ? r.scenarios.filter(sc => !scenarios.some(s => sameName(s.name, sc.name))).slice(0, Math.max(0, SCENARIOS_LIMIT - scenarios.length)) : [];
  if(!useful.length && newScenarios.length){
    scenarios.push(...newScenarios);
    saveBoardSoon();
    renderAll();
    notify('Added the scenarios ' + newScenarios.map(s => '“' + s.name + '”').join(', ') + '.', 'ok', 'boards');
    return 0;
  }
  if(!useful.length){
    notify('None of the rectangles on that board are in this model, so nothing was added.', 'err', 'boards');
    return 0;
  }
  const room = Math.max(0, BOARDS_LIMIT - boards.length);
  const adding = useful.slice(0, room);
  adding.forEach(b => { b.name = freeBoardName(b.name); boards.push(b); });
  if(adding.length) board = adding[0];
  scenarios.push(...newScenarios);
  saveBoardSoon();
  renderAll();
  const sc = newScenarios.length ? ' Added the scenarios ' + newScenarios.map(s => '“' + s.name + '”').join(', ') + '.' : '';
  const left = r.dropped ? ' ' + r.dropped + ' widget' + (r.dropped === 1 ? '' : 's') + ' left out: their rectangles aren\'t in this model.' : '';
  const full = useful.length > adding.length ? ' ' + (useful.length - adding.length) + ' not added: a model has at most ' + BOARDS_LIMIT + ' boards.' : '';
  notify('Added ' + adding.map(b => '"' + b.name + '"').join(', ') + '.' + sc + left + full, adding.length ? 'ok' : 'err', 'boards');
  return adding.length;
}

// A file opened or dropped: a board file is imported, anything else opened as a model.
function openAnyText(text, name){
  let kind = null;
  try{ const d = JSON.parse(text); kind = d && typeof d === 'object' ? d.kind : null; }catch(e){ /* openModelText says so */ }
  if(kind === 'fmIDE-graph-board') return importBoardsText(text).then(n => n > 0);
  return openModelText(text, name);
}

$('btnExportBoard').addEventListener('click', () => { closeMenus(); exportBoards(false); });
$('btnExportBoards').addEventListener('click', () => { closeMenus(); exportBoards(true); });
$('btnImportBoards').addEventListener('click', () => { closeMenus(); $('boardFileInput').click(); });
$('boardFileInput').addEventListener('change', () => {
  const f = $('boardFileInput').files && $('boardFileInput').files[0];
  $('boardFileInput').value = '';
  if(f) f.text().then(importBoardsText, () => notify('That file could not be read.', 'err', 'boards'));
});
function closeMenus(){ document.querySelectorAll('details.gbar-menu[open]').forEach(d => { d.open = false; }); }
document.addEventListener('click', (ev) => { document.querySelectorAll('details.gbar-menu[open]').forEach(d => { if(!d.contains(ev.target)) d.open = false; }); });

// Undo and Redo: the buttons, and Ctrl/⌘ + Z, Ctrl/⌘ + Y or Ctrl/⌘ + Shift + Z — but not while
// typing in a text box, where the browser's own undo works on the text.
$('btnUndo').addEventListener('click', () => undo());
$('btnRedo').addEventListener('click', () => redo());
document.addEventListener('keydown', (ev) => {
  if(!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
  const t = ev.target;
  if(t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['range', 'checkbox', 'color', 'button'].includes(t.type)))) return;
  const k = ev.key.toLowerCase();
  if(k === 'z' && !ev.shiftKey){ ev.preventDefault(); undo(); }
  else if(k === 'y' || (k === 'z' && ev.shiftKey)){ ev.preventDefault(); redo(); }
});
