# Test suite specification

This is the brief for building the permanent automated test suite. Until now every check below was run by hand during development; the goal is one command that runs them all, on every change, locally and on GitHub.

**Ground rules**

- Tests must not require changes to the apps. Everything below is reachable through each app's globals and page elements. If a check seems to need an app change, stop and ask first.
- Everything runs **offline**: block every network request that isn't the app itself, and fail a test if an app tries to reach the network.
- Tests live in `tests/`, fixtures in `tests/fixtures/` (already provided — do not edit them; add new ones alongside if needed).
- Must work on Windows (the maintainer's machine) and on GitHub Actions (Ubuntu).

## Tooling

- Node.js LTS, `@playwright/test` with Chromium only.
- Reading `.xlsx` in tests: `exceljs` (dev dependency only — the apps stay dependency-free).
- LibreOffice (`soffice`) for recalculating workbooks. **Locally optional**: if `soffice` is not found, skip the recalculation tests with a clear "skipped: LibreOffice not installed" message. **Required on GitHub Actions** (install it in the workflow).
- `package.json` scripts: `npm test` (everything), `npm run test:update-snapshots` (see Snapshots), plus one script per group if convenient.
- Add `.github/workflows/tests.yml`: on push and pull request; Ubuntu; install Node, Chromium (`npx playwright install --with-deps chromium`) and LibreOffice; run `npm test`; upload the Playwright report as an artifact on failure.

## How to drive the apps (learned the hard way)

**Loading.** Serve each app file to the page (e.g. `page.route` fulfilling a fake origin such as `http://local.test/…` with the file contents), and abort every other request. Count aborted requests — it must stay 0.

**ExcelExporter** (`apps/ExcelExporter.html`)
- Load a model: `page.setInputFiles('#fileInput', path)`; built-in sample: click `#btnLoadSample`.
- Capture the workbook without downloading: after load, run in the page
  `XLSX.writeFile = (wb, name) => { window.__wb = wb; window.__bytes = Array.from(XLSX.write(wb)); window.__name = name; }`
  then click `#btnGenerate`. `window.__wb` is the intended workbook object (`SheetNames`, `Sheets[name][addr] = {t, v, f, z, s}`); `window.__bytes` is the real `.xlsx` file. `XLSX` is the app's built-in writer (a global).
- To test the real download path once: don't override, and use Playwright's `download` event.
- Useful ids: `#cfgSectionsEnabled`, `#cfgInputsEnabled`, `#cfgInputsName`, `#cfgInputsGroup`, `#cfgInputsOrder`, `#cfgInputsScenarios`, `#cfgInputsCases`, `#casesHint`, `#viewByCanvas` / `#viewByTab` / `#viewByTree`, `#rowGroupsTree .tree-row`, `.scn-ctl` (per-row scenario checkbox + count, on Inputs-tab rows in Tree view), `#sortMethod` / `#sortWithin` / `#sortScope` / `#btnApplySort`, `#treeCtxMenu`, `#bulkMoveBar`, `#btnAddCustomRow`, `#confirmModal` / `#confirmOk` / `#confirmCancel` (in-page confirm dialog), `#btnExportMapping`, `#mappingFileInput`, `#btnResetMapping`, `#btnClearAll`, `#storageWarn`, `#rolesLegend .role-chip`, `#loadStatus`, `#genStatus`, `#inputsStatus`.
- The layout autosaves to IndexedDB (database `fmIDE-ExcelExporter`, object store `kv`) under keys starting `fmide-excelmap-`; read it with `tests/helpers/storage.js`. Writes are asynchronous, so poll after an edit. Each test starts with empty storage.

**fmIDE** (`apps/fmIDE.html`)
- Automation API: `window.fm` (see `docs/fmIDE-automation-api.md`) — e.g. `fm.clearCanvas()`, `fm.createRect({x, y, name, value})`, `fm.createOperator({x, y, op})`, `fm.connect(from, to)`, `fm.nodes()`, `fm.canvases()`, `fm.commands()` (includes each command's shortcut), `fm.command(id)`, `fm.saveSystem()`, `fm.exportWorkspace()`.
- File imports open a file chooser: `Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('loadSystem'))])`, then `fileChooser.setFiles(path)`. Commands: `loadSystem`, `loadModule`, `importWorkspace`; dialogs `openTemplates`, `openFormats`, `openShortcuts`, `openMacros` contain import buttons labelled `⇧ Import Templates`, `⇧ Import Presets`, `⇧ Import Shortcuts`, `⇧ Import`.
- Dialogs are `.modal-box` elements; the confirm button is `button.danger` ("OK"); plain buttons include "Cancel".
- Exports download: use the `download` event.
- Workspace autosave: IndexedDB database `fmIDE`, object store `kv`, key `fmIDE-workspace-v1` (read it with `tests/helpers/storage.js`); every 8 s, when the page is hidden and on unload. `window.fm` appears only after the autosave has been read. **Do not** seed a workspace by writing storage and reloading — the save-on-unload overwrites it. Import through the UI instead (group 9 seeds `localStorage` before the first start, to test the move from older versions).

## Test groups

### 1. Excel output — structure and fidelity
For each fixture in `tests/fixtures/models/` (ExcelExporter), with the Inputs tab off and on:
1. The `.xlsx` bytes are a valid ZIP and every XML part is well-formed.
2. Read the file back (exceljs). For every cell of `window.__wb`: formula text, value, fill colour, font colour, bold, font size (absent = 11), each border side present/absent, and number format match what the app intended. Empty cells (`t: 'z'`) that carry a style exist with that style and no value. Column widths match `wch + 0.71`. Merged ranges exist.
3. No cell anywhere is an empty *text* string.
4. The workbook requests recalculation on open (`fullCalcOnLoad`), and formula cells carry no cached value.

### 2. Excel output — calculated values (LibreOffice)
Recalculate generated workbooks with `soffice --headless --calc --convert-to xlsx` and read the values.
- **Known answers** — `scenario-unit-price-volume.json` (Unit Price = 10, Volume = 5), Inputs tab on; in Tree view tick scenarios on Unit Price (count 3) and Volume (count 5); global cases = 5. Then edit the generated file before recalculating: Inputs-tab scenario values Unit Price 10/20/30, Volume 5/6/7/8/9; Scenarios-tab case matrix Unit Price per case 1,1,2,3,3 and Volume 1,2,1,1,2; global case (Scenarios!C2) set to each value below. Revenue in the first period must be:

  | Global case | Revenue |
  |---|---|
  | 1 | 50 |
  | 2 | 60 |
  | 3 | 100 |
  | 4 | 150 |
  | 5 | 180 |
  | 9 (out of range → uses 5; check cell says "Out of range - using 5") | 180 |
  | "x" (not a number → uses 1; check says "Not a number - using 1") | 50 |

  Also: renaming scenario row "Scenario 2" to "Upside" on the Inputs tab shows "Upside" in the Scenarios tab's name column; a formula `=<empty scenario cell>+1` evaluates to 1 (not `#VALUE!`).
- **No errors** except the known ones: standalone block-definition tabs (e.g. "DepBlock", "Depreciation Block") may show `#DIV/0!` because their inputs are unconnected — allow those, flag any other error cell.

### 3. Excel output — layout rules
- Every tab of a workbook has period 1 in the same column; row 3 holds the period counter 1..N; the column immediately left of period 1 is completely empty on every row of every tab.
- Column C header: "Variable Scenario" on the Inputs tab, "Vintage" on tabs with vertical-block vintage rows, blank elsewhere.
- **Vertical blocks** (`vertical-depreciation-block.json`, `combined-bs-corkscrew-block.json`): convert every vintage-row formula to relative R1C1 form; within each line item's vintage block there must be exactly one distinct formula per column group (each helper column, and the period columns). Helper columns are headed "<input> @ vintage". The Total row is a `SUM(<range>)` over the contiguous vintage rows. No "Vertical Index" row exists anywhere.
- **Comparisons** (`comparisons.json`): "BS check" is `=(ABS(...)<=...)` — no `IF`; "Min probe" is `=MIN(N(...),...)`; "GE probe" is `=(N(...)>=...)`.
- **Inputs tab** (`revenue-bs-corkscrew.json`, Inputs tab on): Inputs tab is first; each input row on other tabs is a link formula to the Inputs tab (sheet-qualified single cell); "Beginning Balance" (fed through a period shift) is not gathered. Group by Excel tab / Canvas / No grouping and Alphabetical order produce headers and orders accordingly.

### 4. Format roles
Using the `roles-workspace-*.json` fixtures:
- `defaults`: the roles legend shows 7 roles, none marked "default".
- `edited` (Links font red `#dc2626`, Inputs fill `#fff7ed`), Inputs tab on: link rows have red font; Inputs-tab cells have fill `FFF7ED`. "Revenue" has its own bold style and number format `#,##0.0` but Calculations colours (no fill).
- `keepcolours`: Revenue keeps its own fill `FDE68A`.
- `sides`: Revenue (keepColours, sides = bottom) has only a bottom border; input rows whose role style has no `sides` saved get all four sides.
- An older file with no role presets (`revenue-bs-corkscrew.json`) shows all 7 roles marked "default".

### 5. Security (both apps)
Load `tests/fixtures/security/evil-workspace.json` and `evil-system.json`:
- **ExcelExporter**: load each, visit all three row views, turn the Inputs tab on, generate.
- **fmIDE**: import the workspace through the UI (confirm with `button.danger`), open the Format Presets dialog and the Templates dialog (hover each template button so previews render).
- After all of that, `window.__pwned` must be undefined or empty in both apps. The fixtures put script-carrying markup in every name field and in node coordinates.

### 6. File formats
**fmIDE** (`tests/fixtures/formats/`):
- `sys-current`, `sys-legacy` (no kind/version) load via `loadSystem`.
- `sys-newer` (version 3): a dialog mentions "newer version" and "format version 3"; Cancel leaves the current canvases unchanged; OK then opens it.
- `templates` via `loadSystem` → message "That is an fmIDE templates file, not a system. Open it with Templates → Import Templates."; `sys-current` via `loadModule` → message naming it a system; `mapping` via `loadSystem` → message pointing to ExcelExporter.
- `templates` via the Templates dialog: one question up front mentioning the template "Future T" is from a newer fmIDE; continuing imports both.
- `shortcuts-v1`: after import, `fm.commands()` shows `openShortcuts = Mod+Shift+K` and `openMacros = Mod+Alt+M`.
- `macros-bare` (a bare array): imports; the macro "Bare List Macro" appears.
- `ws-nested-newer`: one question up front ("Its system was saved by a newer fmIDE…"), then the normal "Import this workspace?" confirm.
- Autosave survives a reload: rename a canvas, reload, the name persists.
- Import Workspace replaces format presets with the same name as one in the file (one "Inputs", with the file's style) and keeps the user's other presets.

**ExcelExporter**:
- `sys-current`, `sys-legacy` load; `sys-newer` shows `#confirmModal` — Cancel → status "Not loaded."; Open Anyway → loads. `ws-nested-newer` → confirm mentions its system.
- `module`, `templates`, `mapping` loaded as a model → a message saying what the file is and where it belongs.
- Mapping: `#btnExportMapping` download has `kind: "fmIDE-excel-mapping"`, `version: 1`; re-importing it works; `map-legacy` (no kind/version) imports; `map-newer` asks; importing a system file as a mapping is rejected. The saved layout in browser storage never contains `kind`/`version`.

### 7. UI flows
**ExcelExporter**
- Start Over keeps the saved layout; Reset Mapping to Defaults (confirm → OK) discards it; Cancel / Escape / backdrop click keep it. Re-picking the same file after Start Over loads it.
- Sort (`revenue-bs-corkscrew.json`, sections off): "Calculation order: inputs first", A→Z, all tabs → BS tab order Unit Price, Volume, AR outstanding rate, Revenue, Accounts Receivable, Cash, Inventory, Total Assets. With formula order, the Corkscrew tab reads Beginning Balance, Additions, Subtractions, Ending Balance. Undo restores the previous order. Custom rows keep their slots. With sections on, the Input band is ordered Unit Price, Volume, AR outstanding rate, Cash, Inventory. The Inputs tab is never sorted and never offered in the scope list.
- Tree view: right-click → Insert custom row above/below inserts next to the row (with several selected: above the first / below the last), opens rename, stays in the anchor's section when sections are on; "+ Add Custom Row" inserts below the selection or, with nothing selected, at the bottom of the first tab. Double-clicking a row when nothing was selected renames **that** row (the selection bar appearing must not shift the target).
- Inputs tab: renaming an Inputs-tab row renames its source; excluding the source removes it from the Inputs tab; an Inputs-tab row can't be moved to another tab; name clash ("Inputs" already a tab) → "Inputs 2" with a warning.
- Storage failure: make `IDBObjectStore.prototype.put` throw a `QuotaExceededError` DOMException (`breakStorage`), edit something → `#storageWarn` visible; restore and edit → hidden.

**fmIDE**
- Canvas: build Unit Price × Volume → Revenue with `fm`; the arrow SVG markup is stable (snapshot); a rectangle fed by an operator with no inputs gets the Inputs look.
- Format dialogs: the Formats manager lists the 7 roles first, their delete buttons disabled; the rectangle format dialog has "Use this fill, font colour & border in Excel too", "Excel border sides" and "Use Excel's default font size".
- Autosave failure: make `IDBObjectStore.prototype.put` throw a `QuotaExceededError` DOMException (`breakStorage` in `tests/helpers/storage.js`), wait for the 8 s autosave → `#autosaveBanner` visible with "Export workspace now" (downloads) and "Dismiss" (stays hidden while failing); after a successful save and a new failure it returns; once saving works it disappears by itself.

### 8. Snapshots
For each fixture in `tests/fixtures/models/` (Inputs tab off and on): store every sheet's formulas and values (not styles) as JSON under `tests/snapshots/`. A test fails on any difference and prints the changed cells. `npm run test:update-snapshots` rewrites them — only after a deliberate change.

### 9. Storage
**fmIDE**
- A workspace an older fmIDE left in `localStorage['fmIDE-workspace-v1']` opens on first start, is copied into IndexedDB, and stays in `localStorage`; after that the IndexedDB autosave wins.
- Hiding the page (`visibilitychange` → hidden) saves the workspace without waiting for the 8 s timer.
- With `window.indexedDB` removed, autosave falls back to `localStorage` and restores after a reload.
- `navigator.storage.persist()` is not called at start-up; it is called once on the first change, and never again (after a reload either), whatever the answer.

**ExcelExporter**
- A layout an older ExcelExporter left in `localStorage` (`fmide-excelmap-…`, no IndexedDB database yet) appears when the model is loaded, is copied into IndexedDB, and stays in `localStorage`.
- After Reset Mapping to Defaults, a reload does not bring the old `localStorage` layout back (the move happens once).
- With `window.indexedDB` removed, the layout is saved to `localStorage` (no warning) and restored after a reload.
- `navigator.storage.persist()` is not called at start-up or for loading a model; once on the first layout change, never again.

### 10. Documents (fmIDE)
Driven with `fm.command('newDocument' | 'openDocument' | 'saveDocument' | 'saveDocumentAs' | 'openRecent')`. The test origin is not a secure context, so there is no File System Access API: by default fmIDE takes the fallback path (file input `#fileInputDocument`, downloads). `tests/helpers/documents.js` installs fake `showOpenFilePicker` / `showSaveFilePicker` that record what was written. Dialog ids: `#saveChangesDialog` (Save / Don't save / Cancel), `#saveAsDialog` with `#saveAsName`, `#openRecentDialog` with `#recentList .recent-item` / `.recent-name`; `#recoveryBanner`; `#fmToast`.
- Fallback: a new session is "Untitled — fmIDE"; opening `Revenue model.fmide` titles it "Revenue model — fmIDE"; a change adds " •"; Save downloads `Revenue model.fmide` (a workspace) and clears the dot. An untitled Save asks for a name, then later Saves download without asking; the download opens again. Save As always asks. A system `.json` opens, and Save then asks for a `.fmide` name. A templates file is refused with the wrong-kind message. Ctrl+S in a text box saves.
- Unsaved changes before New / Open: Cancel keeps everything; Don't save goes ahead (undo history starts afresh); Save saves first; cancelling the name question cancels all.
- File handles: Save writes back to the same file with no dialog; Save As asks (suggesting the current name) and later Saves go to the new file; an untitled Save suggests `Untitled.fmide`; a system `.json` opened from disk is never overwritten (Save asks for `model.fmide`); Open Recent reopens the real file (its current content).
- Recent: open two files, reopen the first from its copy (toast "Opened the copy saved in this browser on …"), the order survives a reload, Clear Recent empties it. File names with markup are shown as plain text.
- Recovery: a change is autosaved about 2 s later (before the 8 s timer). After a reload with unsaved changes the title keeps the dot and `#recoveryBanner` says "Recovered unsaved changes to “name”." — Dismiss hides it, Save saves the document. A saved session comes back without a notice.
- Opening a `.fmide` adds templates and macros that aren't already there (same name and content; a clashing macro becomes "… (imported)", and is not added again on a second open), leaves shortcuts and ribbon unchanged, and takes the file's format roles. New keeps format presets.
- Ribbon: the File tab starts with the Document group; a ribbon customised before it existed gets it once; if removed afterwards it stays removed, also after a reload.

## Deliverable
- The suite, `package.json`, the GitHub Actions workflow, and a short `tests/README.md` on how to run it and how to update snapshots.
- Everything passes against the current apps. If a check fails against the current apps, report it rather than weakening the test.
