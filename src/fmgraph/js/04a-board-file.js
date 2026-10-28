// ============================================================
// The board file's upgrades, one version at a time (moved from 06b-board-files.js, unchanged, so
// the showcase viewer reads a showcase's boards as fmGraph's Import boards does).
// ============================================================

const BOARD_FILE_FORMAT = { 'fmIDE-graph-board': { current: BOARD_FILE_VERSION, label: 'fmGraph board file' } };

// v1 → v2: a board file may be in the template form (G5a); a v1 file is boards for one model.
// v2 → v3: boards for one model may carry the model's named scenarios; v3 → v4: a chart may be a
// scenario waterfall; v4 → v5: a bar or chart may have a fixed vertical scale; v5 → v6: a slider
// may be folded; v6 → v7: a board may keep its own slider positions; v7 → v8: a chart may be a
// Tornado or a Spider. Nothing to change. v8 → v9: the shared period (05k-shared-period.js) —
// every bar and chart saved before it keeps the periods it had (`ownPeriod`), so the file opens
// as it was saved (the owner's choice). v9 → v10: a chart may be a lines chart; nothing to change.
// v10 → v11: the shared colours (04e-colours.js); nothing to change — a file without `colours`
// keeps its colours on its widgets, taken into the shared ones when read (the first one wins).
// v11 → v12: the common scale (04d-scale.js); nothing to change — a file without `commonScale`
// opens with Each its own, so every bar and chart shows the scale it had.
// v12 → v13: a chart may be a Free chart (04f-free.js); nothing to change.
function keepOwnPeriods(data){
  if(!data || typeof data !== 'object' || data.form === 'template') return;
  const boardsIn = Array.isArray(data.boards) ? data.boards : [data];
  boardsIn.forEach(b => {
    if(!b || typeof b !== 'object') return;
    ['items', 'bars', 'charts'].forEach(k => { if(Array.isArray(b[k])) b[k].forEach(w => { if(w && typeof w === 'object') w.ownPeriod = true; }); });
  });
}

const BOARD_FILE_MIGRATIONS = { 'fmIDE-graph-board': { 1: () => {}, 2: () => {}, 3: () => {}, 4: () => {}, 5: () => {}, 6: () => {}, 7: () => {}, 8: keepOwnPeriods, 9: () => {}, 10: () => {}, 11: () => {}, 12: () => {} } };
