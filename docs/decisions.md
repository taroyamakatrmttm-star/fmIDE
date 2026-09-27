# Decisions

| # | Decision | Status | Outcome |
|---|---|---|---|
| 1 | Where the code lives | Agreed (24 Sep 2026) | Private Git repository on GitHub |
| 2 | First platform | Agreed (24 Sep 2026) | Installable web app (PWA) first, then desktop via Tauri |
| 3 | Open source or not | Agreed (25 Sep 2026) | **Open core**, one repository with two licences (see `LICENSING.md`): fmIDE, the shared code, tools and tests under the **Apache License 2.0**; the file-format documentation under **CC BY 4.0**; **ExcelExporter proprietary** — free to use, including at work, but not to copy, modify or redistribute. Copyright 2026 Taro Yamaka. |
| 4 | Where the web app is hosted | Agreed (25 Sep 2026) | Cloudflare Pages, on its free address for now (both can change later) |
| 5 | One app or two | Agreed (24 Sep 2026) | One installable app: fmIDE, with ExcelExporter opening from inside it |
| 6 | The community library (step 8) | Agreed (27 Sep 2026) | Shared as files (library packs), with no change to the security policy. The single files make no network calls; since phase 8d (agreed 27 Sep 2026) fmIDE on its published site may read its own site's `/library` (the list and pack files) when asked, and nothing else — nothing is ever sent. Packs live in a separate public GitHub repository, submitted by pull request, checked automatically and approved by the owner; the catalogue is published on the Cloudflare site under `/library`. Items are licensed CC BY 4.0, with short submission terms. Templates, recipes and functions are shared — not macros. A preview before anything is added, size limits on every file, a record of where items came from, only a family's first author may add versions, a takedown process. A free-text author name, checked against the submitter's GitHub account. Browsing inside fmIDE (8d): Browse Library…, on the published site only, every pack checked against the list's fingerprint and shown in the usual preview before anything is added. Phase 8c (agreed 27 Sep 2026): a family belongs to the GitHub account of its first approved pack, recorded in the library's `families.json`; the site gets the approved packs through a pinned git submodule, fetched by GitHub, never by the build; packs are never edited once approved; at most 5 MB each; a catalogue with no JavaScript. See `docs/step8-community-library.md`. |
| 7 | Touch support (step 9) | Agreed (27 Sep 2026) | Tablets and touchscreen laptops (phones later, with their own layout). One finger on empty canvas scrolls; press and hold, then drag, selects with a box. The mouse-only gestures (arrow, alias, duplicate, adding to the selection) through a menu opened by pressing and holding a node. No pinch to zoom in step 9 (zoom is its own step). No virtual on-screen mouse. Three phases, 9a, 9b, 9c, one pull request each. The mouse keeps working exactly as before. See `docs/step9-touch.md`. |

Why decision 3: an open editor and an open, documented file format build trust and let a community and other tools grow around fmIDE ("the ecosystem is the most"); ExcelExporter is where Pro / Enterprise / Marketplace editions can build later. Licences can be loosened later (ExcelExporter could be opened), but a version once published as open source stays open. The licence texts should be reviewed by a lawyer before the repository is made public. Before accepting outside contributions, a contributor licence agreement (CLA) is needed (`CONTRIBUTING.md`). Making the repository public is a separate step, taken by the owner when ready.

## Build order

Workflow since step 3a: edit `src/` → `npm run build` → `npm test` (the files in `apps/` are generated — never edit them by hand).


1. Repository (this) ✅
2. Permanent test suite — one command that runs every check, on every change ✅ (`npm test`, see `tests/README.md`)
3. Split each app into modules (still building to single files), protected by the tests ✅ — 3a source split into `src/`, built by `npm run build`; 3b shared code in `src/shared/` (see `docs/step3-modules.md`)
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files ✅ — 4a IndexedDB underneath, 4b `.fmide` documents (Open, Save, Save As, Recent, recovery), 4c Preferences file (see `docs/step4-storage.md`). Double-clicking a `.fmide` file to open it (PWA file association; PWA = installable web app) belongs to step 5.
5. Publish the web app (see `docs/step5-publish.md`) ✅ — 5a installable web app (PWA): offline, updates, install, double-click `.fmide`, one app with ExcelExporter inside; 5b licences (decision 3) and automatic publishing to Cloudflare Pages on every merge, with a preview address for each pull request.
6. Template management ✅ — families and versions, canvases linked to their template ("Update this canvas"), recipe templates, and a warning when more than one plug feeds a socket (see `docs/file-formats.md`)
7. Formula IR and plugins (chosen by the owner, September 2026; see `docs/step7-formula-ir.md`): A agreement tests and fixes ✅, B shared IR ✅, C ExcelExporter on the IR ✅, D function plugins ✅, E1 new operators ✅; E2 optional, not started
8. Community library (see `docs/step8-community-library.md`) ✅: 8a library pack files ✅; 8b where items came from ✅; 8c checker and catalogue (8c-1 the checker for one pack ✅, 8c-2 the library's rules and repository ✅, 8c-3 the catalogue ✅); 8d browsing inside fmIDE ✅
9. Touch support (see `docs/step9-touch.md`) — in progress: 9a one input path for mouse, touch and pen ✅; 9b touch replacements for the mouse-only gestures ✅; 9c the screen and ExcelExporter

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
