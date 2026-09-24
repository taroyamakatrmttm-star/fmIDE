# Changelog

Notable changes before this repository existed (recorded from the development history). From here on, Git keeps the detail.

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
