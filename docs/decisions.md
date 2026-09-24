# Decisions

| # | Decision | Status | Outcome |
|---|---|---|---|
| 1 | Where the code lives | Agreed (24 Sep 2026) | Private Git repository on GitHub |
| 2 | First platform | Agreed (24 Sep 2026) | Installable web app (PWA) first, then desktop via Tauri |
| 3 | Open source or not | Open — decide by the first public release | Recommendation: open core (apps and file formats open, hosted/paid services closed) |

Decision 3 can wait: going from closed to open later is easy, but open to closed is effectively irreversible. The repository stays private until it is decided.

## Build order

Workflow since step 3a: edit `src/` → `npm run build` → `npm test` (the files in `apps/` are generated — never edit them by hand).


1. Repository (this) ✅
2. Permanent test suite — one command that runs every check, on every change ✅ (`npm test`, see `tests/README.md`)
3. Split each app into modules (still building to single files), protected by the tests ✅ — 3a source split into `src/`, built by `npm run build`; 3b shared code in `src/shared/` (see `docs/step3-modules.md`)
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files ✅ — 4a IndexedDB underneath, 4b `.fmide` documents (Open, Save, Save As, Recent, recovery), 4c Preferences file (see `docs/step4-storage.md`). Double-clicking a `.fmide` file to open it (PWA file association; PWA = installable web app) belongs to step 5.
5. Publish the web app; then formula IR and plugins, community library, touch support

## Phase 0 (hardening) — status

- ✅ Text from files is escaped (safe to share files)
- ✅ Built-in Excel writer — no external library; confirmed in Windows and iPhone Excel
- ✅ File-format versions and migrations in both apps
- ✅ Warning when autosave fails
- ✅ Storage (build step 4): IndexedDB, `.fmide` documents, Preferences file
- ✅ Modules (build step 3): the apps are generated from `src/`, with shared logic once in `src/shared/`

## Step 3c (later): which pieces to turn into real modules first

Converting to `import`/`export` modules matters for the plugin work. Easiest first, because they have no DOM and no hidden globals:

1. `src/shared/*` — pure functions and tables already written to take everything as parameters (the input rule takes the canvas; the file-format core takes the format and migration tables). `escaping.js` and `input-rule.js` are the simplest.
2. ExcelExporter's `js-head/01-xlsx-writer.js` — already a self-contained IIFE with a small interface (`XLSX.utils.book_new`, `book_append_sheet`, `write`, `writeFile`); only `writeFile` touches the DOM.
3. fmIDE's expression language in `js/13-automation-core.js` (the small numeric-argument parser) — self-contained, easy to unit-test.
4. ExcelExporter's `js/01-core-translation.js` (text/UOM parsing and formula building) — pure apart from the `ctx` object it is handed, but large, so after the above.

Hardest: anything that reads the apps' shared mutable state (fmIDE's `nodes`/`edges`/canvases, ExcelExporter's `model`/`mapping`) or builds DOM — rendering, dialogs, the ribbon, the macro builder.
