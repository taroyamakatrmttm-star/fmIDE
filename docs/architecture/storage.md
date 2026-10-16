# Browser storage

Read before adding or changing a stored key. Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

## Browser storage (`docs/step4-storage.md`)

Autosave lives in IndexedDB, through `createStore(dbName)` in `src/shared/store.js`: a promise-based key–value store (one object store `kv`, mostly string values of JSON text, plus file handles) that falls back to `localStorage` (text only) where IndexedDB is unavailable. Writes are asynchronous; failures reach the autosave warnings (fmIDE's `#autosaveBanner`, ExcelExporter's `#storageWarn`).

| App | Database | Keys |
|---|---|---|
| fmIDE | `fmIDE` | `fmIDE-workspace-v1` — the whole workspace; saved every 8 s, about 2 s after each change, when the page is hidden, and on close |
| fmIDE | `fmIDE` | `fmIDE-session` (open document: name, file name, Recent entry, unsaved flag) and `fmIDE-session-handle` (its file handle), saved with the workspace |
| fmIDE | `fmIDE` | `fmIDE-recent` (the list, at most 10), `fmIDE-recent:<id>` (a copy of that document), `fmIDE-recent-handle:<id>` (its file handle) |
| fmIDE | `fmIDE` | `fmIDE-phone` — on a phone (step 17 P2a): Full app, the tick's switch, the Watch list per document and the install note seen (P2b) (`{ fullApp, vibrate, watch, installNoteSeen }`, read through `cleanPhoneSettings`); never in the workspace or a file; saved when changed |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excelmap-<model signature>` — one layout per model (the signature: canvas and node ids, leaving out the automatic plug aliases; a layout under the older signature, which counted them, is still found); saved on every change and when the page is hidden; the layout's own JSON with no `kind` or `version` — since step 19 B3a it holds `cfg.sensitivities` (several analyses) and `cfg.sensitivity` as a copy of the first; one kept before opens with its `cfg.sensitivity` as the first analysis, and the old setting is never removed |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excel-style` — the person's Excel style (step 11a), the `fmIDE-excel-style` JSON text, one for every model; saved on every change |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excel-module-layouts` — the layouts remembered per module (step 11b; its block instances' too, 11d), the `fmIDE-excel-module-layouts` JSON text; saved when a module's tab or instance tab changes, on Forget and on Import |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excel-whats-new-seen` — the date of the newest update seen in What's new (step 10 H5b); saved when the list of every update is opened |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excel-help-size` — the Help panel's width (step 10 H5a), `{ width, narrow }` JSON text; saved when it changes |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excel-full-app` — on a phone (step 17 P3): `'1'` when the person chose ☰ → Full app; saved when changed |
| fmGraph | `fmGraph` | `fmgraph-board-<model signature>` — the model's boards (the `fmIDE-graph-board` file's form, never the sliders' positions; G1–G2 kept one board) for one model (signature: a hash of its canvas and rectangle ids); `fmgraph-last-board` — the last boards used, offered to a model with none whose rectangles have the same ids and names; saved shortly after each change and when the page is hidden |
| fmGraph | `fmGraph` | `fmgraph-help-size`, `fmgraph-whats-new-seen` — the Help panel's width and the newest update seen |
| fmGraph | `fmGraph` | `fmgraph-full-app` (`'1'`: the full page on a phone), `fmgraph-vibrate` (`'off'`: no vibration on the marks), `fmgraph-mixer` (the sliders picked for the mixer, per model and board) — step 17; saved when changed |
| all | (same) | `<dbName>/migrated-from-localStorage`, `<dbName>/persistence-requested` — bookkeeping |

- **Migration:** on start, keys an older version left in `localStorage` are copied into IndexedDB once (the marker records it, so a later delete is not undone). The `localStorage` copies are kept; never delete user data in the same step that moves it.
- fmIDE finishes starting (restores or adds the starter model, sets `window.fm`) only after the autosave has been read, and does not autosave before then. ExcelExporter's `loadModel()` is asynchronous for the same reason.
- `navigator.storage.persist()` is requested once, ever, on the first change (not at start-up); the answer is remembered.
