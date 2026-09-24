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
- The layout autosaves to `localStorage` under keys starting `fmide-excelmap-`; clear `localStorage` between tests.

**fmIDE** (`apps/fmIDE.html`)
- Automation API: `window.fm` (see `docs/fmIDE-automation-api.md`) — e.g. `fm.clearCanvas()`, `fm.createRect({x, y, name, value})`, `fm.createOperator({x, y, op})`, `fm.connect(from, to)`, `fm.nodes()`, `fm.canvases()`, `fm.commands()` (includes each command's shortcut), `fm.command(id)`, `fm.saveSystem()`, `fm.exportWorkspace()`.
- File imports open a file chooser: `Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => fm.command('loadSystem'))])`, then `fileChooser.setFiles(path)`. Commands: `loadSystem`, `loadModule`, `importWorkspace`; dialogs `openTemplates`, `openFormats`, `openShortcuts`, `openMacros` contain import buttons labelled `⇧ Import Templates`, `⇧ Import Presets`, `⇧ Import Shortcuts`, `⇧ Import`.
- Dialogs are `.modal-box` elements; the confirm button is `button.danger` ("OK"); plain buttons include "Cancel".
- Exports download: use the `download` event.
- Workspace autosave: `localStorage['fmIDE-workspace-v1']`, every 8 s and on unload. **Do not** seed a workspace by writing localStorage and reloading — the save-on-unload overwrites it. Import through the UI instead.

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

**ExcelExporter**:
- `sys-current`, `sys-legacy` load; `sys-newer` shows `#confirmModal` — Cancel → status "Not loaded."; Open Anyway → loads. `ws-nested-newer` → confirm mentions its system.
- `module`, `templates`, `mapping` loaded as a model → a message saying what the file is and where it belongs.
- Mapping: `#btnExportMapping` download has `kind: "fmIDE-excel-mapping"`, `version: 1`; re-importing it works; `map-legacy` (no kind/version) imports; `map-newer` asks; importing a system file as a mapping is rejected. The saved layout in localStorage never contains `kind`/`version`.

### 7. UI flows
**ExcelExporter**
- Start Over keeps the saved layout; Reset Mapping to Defaults (confirm → OK) discards it; Cancel / Escape / backdrop click keep it. Re-picking the same file after Start Over loads it.
- Sort (`revenue-bs-corkscrew.json`, sections off): "Calculation order: inputs first", A→Z, all tabs → BS tab order Unit Price, Volume, AR outstanding rate, Revenue, Accounts Receivable, Cash, Inventory, Total Assets. With formula order, the Corkscrew tab reads Beginning Balance, Additions, Subtractions, Ending Balance. Undo restores the previous order. Custom rows keep their slots. With sections on, the Input band is ordered Unit Price, Volume, AR outstanding rate, Cash, Inventory. The Inputs tab is never sorted and never offered in the scope list.
- Tree view: right-click → Insert custom row above/below inserts next to the row (with several selected: above the first / below the last), opens rename, stays in the anchor's section when sections are on; "+ Add Custom Row" inserts below the selection or, with nothing selected, at the bottom of the first tab. Double-clicking a row when nothing was selected renames **that** row (the selection bar appearing must not shift the target).
- Inputs tab: renaming an Inputs-tab row renames its source; excluding the source removes it from the Inputs tab; an Inputs-tab row can't be moved to another tab; name clash ("Inputs" already a tab) → "Inputs 2" with a warning.
- Storage failure: make `Storage.prototype.setItem` throw a `QuotaExceededError` DOMException, edit something → `#storageWarn` visible; restore and edit → hidden.

**fmIDE**
- Canvas: build Unit Price × Volume → Revenue with `fm`; the arrow SVG markup is stable (snapshot); a rectangle fed by an operator with no inputs gets the Inputs look.
- Format dialogs: the Formats manager lists the 7 roles first, their delete buttons disabled; the rectangle format dialog has "Use this fill, font colour & border in Excel too", "Excel border sides" and "Use Excel's default font size".
- Autosave failure: break `setItem` as above, wait for the 8 s autosave → `#autosaveBanner` visible with "Export workspace now" (downloads) and "Dismiss" (stays hidden while failing); after a successful save and a new failure it returns; once saving works it disappears by itself.

### 8. Snapshots
For each fixture in `tests/fixtures/models/` (Inputs tab off and on): store every sheet's formulas and values (not styles) as JSON under `tests/snapshots/`. A test fails on any difference and prints the changed cells. `npm run test:update-snapshots` rewrites them — only after a deliberate change.

## Deliverable
- The suite, `package.json`, the GitHub Actions workflow, and a short `tests/README.md` on how to run it and how to update snapshots.
- Everything passes against the current apps. If a check fails against the current apps, report it rather than weakening the test.
