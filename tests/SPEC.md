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
- **Known answers — unfed block inputs** — `block-unfed-inputs.json` (COGS = Negatizer: Inputs × −1, Inputs typed 4; on Case1 the instance's port is fed by a "+" with nothing plugged in, on Case2 it is unconnected), Inputs tab on: COGS is −4 on both. With instance 1's Inputs-tab cell set to 5, Case1 COGS is −5 and Case2 stays −4.
- **No errors** except the known ones: standalone block-definition tabs (e.g. "DepBlock", "Depreciation Block") may show `#DIV/0!` because their inputs are unconnected — allow those, flag any other error cell.

### 3. Excel output — layout rules
- Every tab of a workbook has period 1 in the same column; row 3 holds the period counter 1..N; the column immediately left of period 1 is completely empty on every row of every tab.
- Column C header: "Variable Scenario" on the Inputs tab, "Vintage" on tabs with vertical-block vintage rows, blank elsewhere.
- **Vertical blocks** (`vertical-depreciation-block.json`, `combined-bs-corkscrew-block.json`): convert every vintage-row formula to relative R1C1 form; within each line item's vintage block there must be exactly one distinct formula per column group (each helper column, and the period columns). Helper columns are headed "<input> @ vintage". The Total row is a `SUM(<range>)` over the contiguous vintage rows. No "Vertical Index" row exists anywhere.
- **Comparisons** (`comparisons.json`): "BS check" is `=(ABS(...)<=...)` — no `IF`; "Min probe" is `=MIN(N(...),...)`; "GE probe" is `=(N(...)>=...)`.
- **Inputs tab** (`revenue-bs-corkscrew.json`, Inputs tab on): Inputs tab is first; each input row on other tabs is a link formula to the Inputs tab (sheet-qualified single cell); "Beginning Balance" (fed through a period shift) is not gathered. `block-input-rectangles.json`: Volume and DSO, marked Block Input on a canvas no block instance uses, are gathered and their rows link to the Inputs tab (Block Inputs of a canvas that is used as a block stay off it). `block-unfed-inputs.json`: each Negatizer instance tab has an "Inputs" row whose cell links to an Inputs-tab "Inputs" row (value 4) under that instance's group, and Output multiplies the Inputs and Negative one rows (no typed 0); the Negatizer definition tab's Inputs placeholder is not gathered. Group by Excel tab / Canvas / No grouping and Alphabetical order produce headers and orders accordingly.

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
- `sys-newer-v4` (version 4): a dialog mentions "newer version" and "format version 4"; Cancel leaves the current canvases unchanged; OK then opens it. (`sys-newer`, version 3, was the "newer" sample until system v3 became current.)
- `preferences` via `loadSystem` → "That is an fmIDE preferences file, not a system. Open it with File → Import Preferences." (and the same via Open…, group 10).
- `templates` via `loadSystem` → message "That is an fmIDE templates file, not a system. Open it with Templates → Import Templates."; `sys-current` via `loadModule` → message naming it a system; `mapping` via `loadSystem` → message pointing to ExcelExporter.
- `templates` via the Templates dialog: one question up front mentioning the template "Future T" is from a newer fmIDE; continuing imports both.
- `shortcuts-v1`: after import, `fm.commands()` shows `openShortcuts = Mod+Shift+K` and `openMacros = Mod+Alt+M`.
- `macros-bare` (a bare array): imports; the macro "Bare List Macro" appears.
- `ws-nested-newer`: one question up front ("Its system was saved by a newer fmIDE…"), then the normal "Import this workspace?" confirm.
- Autosave survives a reload: rename a canvas, reload, the name persists.
- Import Workspace replaces format presets with the same name as one in the file (one "Inputs", with the file's style) and keeps the user's other presets.
- Plugs from older files: `sys-v2-plug` (a v2 system, one `plug` per rectangle) opens with `plugs: ["Income Tax"]` (a blank plug becomes `[]`, no `plug` left) and the plug still feeds its socket on another canvas (value 30); Save System writes version 3. `module-v1-plug` via `loadModule` → `plugs` upgraded the same way. The same module inside a v1 templates file is upgraded when inserted.

**ExcelExporter**:
- A `.fmide` document (a workspace) loads through `#fileInput`, and so does a version 2 workspace (templates with families; group 14).
- `sys-current`, `sys-legacy` load; `sys-newer-v4` shows `#confirmModal` — Cancel → status "Not loaded."; Open Anyway → loads. `ws-nested-newer` → confirm mentions its system.
- `module`, `templates`, `mapping`, `preferences` loaded as a model → a message saying what the file is and where it belongs.
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
- Remove duplicates… window: a seeded library with a template A (Price × Qty → Revenue) and its copies moved, re-numbered (other ids, nodes and arrows in another order), renamed ("Sales calc") and with one number changed, plus two exact copies sharing an id. Defaults (name ✔, layout ☐): sets {A, moved, re-numbered} and {the exact copies}; layout ✔ drops the moved one; name ☐ adds the renamed one; the changed number never joins. Keeping the moved one and removing leaves moved, renamed, changed and one exact copy. Cancel/Esc remove nothing; tick boxes are remembered. `templates/near-copies.json` (the owner's two "Depreciation - straight line v2", different calculations): never a set, whatever is unticked; "No duplicates with these settings.", Remove disabled.
- Templates duplicates, ids: an autosave where each copy shares its original's id: "Remove duplicates" leaves one of each (not none); deleting one of two such copies leaves the other; after a restart, a newly imported template ("Tax schedule") gets a new id, so deleting it leaves the four restored ones. "Clear all templates": Cancel keeps all; OK empties the list ("No templates yet"), canvases unchanged, button hides; the command "Clear All Templates" exists.
- Templates duplicates: importing `templates/search.json` twice says "All 4 templates in that file are already in your library." and the list keeps 4; `templates/one-new.json` (one of them plus "Tax schedule") says "Imported 1 template (1 was already there)."; Import Workspace of fmIDE's own export keeps 4. An autosave (seeded in localStorage) with the four twice plus a different-content "Audit BS": the Templates window shows "🧹 Remove 4 duplicates"; after confirming, one of each remains and both "Audit BS" stay; the button hides. The command "Remove Duplicate Templates" exists.
- Templates search (`tests/fixtures/templates/search.json`, four templates imported through the Templates window, which is then reopened): the search box has the focus on opening; "inc st" lists Income Statement first (name match) and then Cash flow statement (group "Financial Statement"), selects and previews the first; "straight" finds Depreciation schedule by its description; no match shows "No matching templates"; clearing restores the grouped list; "statement" + ↓ + Enter adds Cash flow statement's rectangle to the canvas and closes the window; Esc closes it.
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
- Recent: Save As makes a new entry (the old file keeps its own); Open Recent opened the moment a save finishes already lists it. Open two files, reopen the first from its copy (toast "Opened the copy saved in this browser on …"), the order survives a reload, Clear Recent empties it. File names with markup are shown as plain text (the test passes such a file from memory: a file with `<` in its name on disk breaks the CI artifact upload).
- Recovery: a change is autosaved about 2 s later (before the 8 s timer). After a reload with unsaved changes the title keeps the dot and `#recoveryBanner` says "Recovered unsaved changes to “name”." — Dismiss hides it, Save saves the document. A saved session comes back without a notice.
- Opening a `.fmide` adds templates and macros that aren't already there (same name and content; a clashing macro becomes "… (imported)", and is not added again on a second open), leaves shortcuts and ribbon unchanged, and takes the file's format roles. New keeps format presets.
- Ribbon: the File tab starts with the Document group; a ribbon customised before it existed gets it once; if removed afterwards it stays removed, also after a reload.

### 11. Preferences (fmIDE)
Commands `exportPreferences` (download `fmIDE-preferences.json`) and `importPreferences` (file input `#fileInputPreferences`, then the confirm "Replace your shortcuts, ribbon and KeyTips settings with the ones in this file?"). The Customize Ribbon dialog (`.rbc-box`) has the same two buttons.
- Round trip: customise a shortcut (Import Shortcuts), the ribbon (add Add Rectangle to the Quick Access Toolbar, move Cut down) and the KeyTips trigger (F10); Export Preferences (kind `fmIDE-preferences`, version 1, no active tab / launcher recents / last-run macro); reset all three; Import → all come back exactly, and the model, templates, macros and format presets are unchanged, as is the window title.
- Cancel at the confirmation leaves every setting unchanged.
- `preferences.json` applies as a whole (shortcuts not in the file get their defaults); `preferences-newer.json` asks first.
- Macros: your macro shortcuts are kept, unless a built-in command from the file takes the same key; the file's macro shortcuts and ribbon/QAT buttons for macros you don't have are dropped.
- From the file, safely: a tab name with markup is shown as text; malformed groups/items are cleaned up; a tap trigger on an ordinary key falls back to the default.
- The default File tab has a Preferences group (Export, Import).

### 12. The installable web app (PWA)
`tests/helpers/site.js` builds the site (`tools/build.js`'s `buildSite`) into a temporary folder and serves it from `http://127.0.0.1:<port>/` (a secure context, so service workers work) the way Cloudflare Pages does (`tools/pages-server.js`: short page addresses, the `_headers` security policy), with `apps/` under `/apps/`. Every request the browser makes, the service worker's included, must go to that server.
- The page links `manifest.webmanifest`: name fmIDE, `start_url`/`scope` `./`, `standalone`, 192 and 512 icons (all load), a `.fmide` file handler; Chrome reports no installability errors.
- After the first visit the server is stopped: fmIDE and ExcelExporter still load (offline).
- A new version (sw.js changed): `#updateBanner` "A new version of fmIDE is ready."; the old cache stays until Reload; Reload switches to the new cache only, keeps unsaved work (the recovery notice shows it), and shows no "Leave site?". "Later" puts it away without switching.
- ExcelExporter on the site (after fmIDE registered the service worker): a new version shows "A new version of ExcelExporter is ready." (with "Your layout is kept"); Reload switches to the new cache only. With fmIDE and ExcelExporter open in two tabs, ExcelExporter's notice put away with Later, Reload in fmIDE makes ExcelExporter's notice appear again, and its Reload loads the new version. ExcelExporter opened alone registers no service worker and shows no notice.
- The site ships `LICENSE.txt` (Apache), `NOTICE.txt` (copyright) and `ExcelExporter-LICENSE.txt`, also in the offline copy; each app page carries its licence comment.
- Under the security policy (the page's `Content-Security-Policy` lists script hashes): a whole workflow — build a rectangle, Save As a `.fmide` download, Open ExcelExporter (from the offline copy), load the sample, generate an `.xlsx` — records no policy violations in either window; a script injected into fmIDE or ExcelExporter is blocked and never runs.
- Short addresses: `/ExcelExporter.html` → `/ExcelExporter`, `/index.html` → `/`; `_headers` is not served.
- `apps/fmIDE.html` links no manifest and registers no service worker, even on a secure origin.
- Anywhere: Open ExcelExporter opens `ExcelExporter.html` next to fmIDE in its own window; Install fmIDE is disabled until the browser offers it, then prompts once; a `.fmide` handed over through a (faked) `launchQueue` opens as a document, asking Save / Don't save / Cancel first when there are unsaved changes.

### 13. Plugs (fmIDE, and ExcelExporter reading the result)
"Income Tax" (30) on a Tax canvas carries two plugs, "to Income Tax expense" and "to CF Income Tax paid", feeding operators with those sockets on an Income Statement and a Cash Flow canvas.
- Both "Income Tax expense" and "Income Tax paid" compute 30.
- `removePlug` (any capitals) removes only that connection (paid falls back to its typed 0); undo brings it back.
- `addPlug` ignores a name already there; `setPlug` replaces all plugs with one; `setPlugs` sets a list (blanks and repeats dropped), `[]` clears, anything but a list of names is refused.
- The plug editor (🔌): one chip per plug; ✕ removes one; Enter adds the typed name; Escape drops a typed name; a click elsewhere adds it. The rectangle shows "🔌 to Income Tax expense · to CF Income Tax paid".
- A plug name with markup from a file is shown as text and never runs.
- ExcelExporter: the saved v3 system loads; with the Inputs tab off, both rows are formulas (fed), not typed numbers.

### 14. Template families and versions (fmIDE)
"Revenue plan" is saved from a canvas whose Revenue is 10 (v1, note "first"), then saved again at 20 with **⤴ Save as new version** (v2, note "price up"). The library is read from an exported workspace.
- Both versions share one `family` (a random id), have their own `versionId`, and keep their notes.
- The window shows one entry per family with its `v` tag; "▸ 2 older versions" opens a list of older versions, newest first ("v2 — price up", "v1 — first"). Selecting v1 shows "Version 1 of 3 (an older version) — first", and "Add to new canvas" inserts that version.
- Saving under a taken name (any capitals) asks first. "Choose another name" goes back to the form and saves nothing; a new name starts a new family; "Save as new version of …" adds v2 to the existing family.
- `insertTemplate`: `Name` and `Name@latest` give 20; `Name@1` (spaces and capitals allowed) and `<family>@1` give 10; `Name@9` → "There is no version 9 of "Revenue plan" (it has versions 1, 2)."; an unknown name → "There is no template called …". With a second family of the same name imported, `Name@1` → "More than one template family is named …", and the family id still works.
- Import clash: in a file that edits v2 and adds a v3, their v3 keeps number 3 and their v2 becomes v4 with the note "Imported — was v2 in the file: …" and its own `versionId`. The message says so. The same file again adds nothing.
- Deleting: the latest version's button deletes the family ("all 2 versions"); an older version is deleted on its own; a new version after that is still numbered 3.
- ✎ Edit info renames every version; the change note belongs to the selected version only.
- Autosave: families, versions, notes and `versionId`s are the same after a reload.
- Macro recording writes `Revenue plan@1` for an older version and `Revenue plan` for the latest.
- Older files: `templates-v1` (a v1 templates file) gives each template its own family at version 1, and importing it again adds nothing. `ws-v1-templates` (a v1 workspace) does the same, exports as workspace version 2, and `Old Revenue@1` inserts. A workspace of version 3 asks first ("reads up to version 2").
- A family id `<script>…`, a `versionId` with markup and a version "two" from a file are replaced by valid ones; a note with markup is shown as text and never runs.
- Remove duplicates compares one entry per family (its latest version): a family whose latest matches another family is offered ("v2 (and 1 older version)"); a copy of an older version only is not. Removing the family removes every version.
- ExcelExporter (group 6): a version 2 workspace with templates that have families loads.

## Deliverable
- The suite, `package.json`, the GitHub Actions workflow, and a short `tests/README.md` on how to run it and how to update snapshots.
- Everything passes against the current apps. If a check fails against the current apps, report it rather than weakening the test.
