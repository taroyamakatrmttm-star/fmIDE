# Changelog

Notable changes before this repository existed (recorded from the development history). From here on, Git keeps the detail.

## Documents (build step 4b)
- fmIDE works like a document app: **New**, **Open…** (Ctrl/Cmd+O), **Save** (Ctrl/Cmd+S), **Save As…** (Ctrl/Cmd+Shift+S) and **Open Recent…** (up to 10) in a new Document group on the File tab. A document is a `.fmide` file, which is exactly the workspace JSON, so no new file format. Chrome and Edge save straight back to the file. Other browsers download `name.fmide`, and Open Recent reopens the copy kept in the browser, saying so.
- Unsaved changes show as a dot in the window title. New, Open and Open Recent ask Save / Don't save / Cancel, and closing the tab asks "Leave site?".
- Autosave also runs about 2 seconds after each change. After a crash or restart with unsaved changes, fmIDE says "Recovered unsaved changes to …" and offers Save.
- Opening a `.fmide` takes the model and its format roles from the file, and adds its templates and macros to yours (only ones you don't already have). Your shortcuts and ribbon are left alone. Import Workspace still replaces everything.
- Ribbons customised before this release get the Document group once. If you remove it, it stays removed.
- ExcelExporter's model picker accepts `.fmide` files.
- Fix: Import Workspace added the file's format presets next to the existing ones, so after an import there were two of each role and the file's edited roles were ignored. It now replaces presets with the same name and keeps the user's other presets.

## Browser storage on IndexedDB (build step 4a)
- Both apps now keep their autosave in the browser's IndexedDB instead of `localStorage` (`src/shared/store.js`): fmIDE's workspace in the `fmIDE` database, ExcelExporter's saved layouts in `fmIDE-ExcelExporter`, under the same keys as before. Nothing changes on screen.
- What an older version saved in `localStorage` is copied across once, on the first start after the upgrade, and the old copies are kept. Where IndexedDB isn't available (some browsers block it for pages opened from disk, or in private windows), both apps fall back to `localStorage`.
- fmIDE also autosaves as soon as the page is hidden (switching tab, minimising, closing), as well as every 8 seconds. ExcelExporter still saves on every change, and again when the page is hidden.
- On the first change, each app asks the browser once to keep its data (`navigator.storage.persist()`). The answer is remembered and it never asks again. Some browsers (e.g. Firefox) show the user a question.
- The autosave-failure warnings now react to failed IndexedDB writes, with the same wording.

## Shared code (build step 3b)
- Logic both apps need now lives once in `src/shared/` and is built into both: escaping and validation helpers, the input-rectangle rule, the format-role defaults, and the file-format core (shared versions and upgrades, kind inference, version check). No change in behaviour, with one exception: fmIDE now tells you an old ExcelExporter mapping file (saved before file kinds existed) belongs in ExcelExporter, as ExcelExporter already recognised it.

## Source split (build step 3a)
- The apps' source now lives in `src/` (page, styles and ordered script pieces per app); `npm run build` (`tools/build.js`, Node only) generates the two single-file apps in `apps/`. The generated files matched the previous hand-edited ones byte for byte; each now starts with a "Generated from src/" comment. CI fails if `apps/` doesn't match `src/`.

## Test suite
- `npm test` runs every check that used to be done by hand (see `tests/README.md`), offline, locally and on GitHub Actions: Excel structure and fidelity, LibreOffice-recalculated values, layout rules, format roles, security, file formats, UI flows, and formula/value snapshots.

## Both apps
- File-format versions: every file type has `kind` + `version`; one reader per app migrates older files, rejects the wrong kind with a clear message, and asks before opening a file from a newer version.
- Security: text from files is always displayed as plain text; coordinates and colours are validated.
- Format roles: all formatting defined once in fmIDE (Inputs, Calculations, Links, Headers, Section Headers, Labels, Notes); per-style Excel border sides and "Use Excel's default font size".
- Input rule shared by both apps: a rectangle fed by an operator that nothing feeds counts as an input.
- Autosave-failure warnings.

## ExcelExporter
- Built-in Excel writer replaces the external library: works offline, formulas recalculate on open, empty cells keep formatting (confirmed in Windows and iPhone Excel).
- Scenarios per input variable and global cases on a Scenarios tab.
- Inputs tab: gather all inputs on one tab (group by tab / canvas / none, sheet or alphabetical order); original rows link to it.
- Fixed column layout on every tab: label, UOM, Vintage, helper columns, one blank spacer, then periods.
- Vertical blocks: Vintage column, helper columns instead of repeated INDEX, formulas identical down and across the vintage block; Vertical Index rows removed.
- Comparisons export as native TRUE/FALSE (with N() where Excel would otherwise misread them).
- Row sorting (calculation order, canvas position, alphabetical) with Undo; right-click menu in Tree view; Reset Mapping to Defaults.
- Truly empty cells instead of empty text (no more #VALUE! when referencing a blank).
