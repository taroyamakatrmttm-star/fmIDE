---
paths:
  - "src/shared/file-formats.js"
  - "src/shared/fmide-files.js"
  - "src/shared/library-pack.js"
  - "src/fmide/js/04-file-formats.js"
  - "src/excel-exporter/js/04-file-formats.js"
  - "tests/fixtures/formats/**"
  - "tests/6-formats-*.spec.js"
  - "docs/file-formats.md"
  - "tools/check-pack.js"
---

# File formats

Loaded when a session works on the file readers, versions or upgrades. Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

## File formats (`docs/file-formats.md`)

Every JSON file the apps write has a `kind` and a `version`. Every file they read goes through a single reader — `readFmFile()` in fmIDE (built on `readFmData` in `src/shared/fmide-files.js`, which the pack checker uses too), `readKnownFile()` in ExcelExporter — which identifies the kind (older files without `kind` are recognised by shape), rejects the wrong kind with a message saying where it belongs, upgrades old versions one step at a time via `FILE_MIGRATIONS`, asks once before opening a file from a **newer** version, and does the same for nested content (a workspace's system, each template's model).

Current versions:

| `kind` | Version | What it is |
|---|---|---|
| `system` | 9 | A whole model (all canvases, periods) — read by **both** apps. v3: a rectangle's plugs are a list, `plugs`; v4: a canvas may carry `template`, the canvas template it came from; v5: `functions`, the function definitions it uses; v6: the operators of phase E1; v7: no Excel-only format settings (step 11a); v8: the operators of phase E2a; v9: `choose` (phase E2b) |
| `module` | 7 | One canvas (v2: `plugs`, as system v3; v3: `functions`; v4: the operators of phase E1; v5: no Excel-only format settings; v6: the operators of phase E2a; v7: `choose`) |
| `fmIDE-workspace` | 14 | System + templates, format presets, shortcuts, macros — read by **both** apps; v4: `functions`, the function library; v5: the operators of phase E1; v6: templates and library functions may carry `origin`; v7: no Excel-only format roles or settings; v8: templates may carry `attachments` (step 11c); v9: the operators of phase E2a; v10: `choose`; v11: `graphBoards`, the model's fmGraph boards (step 15 G3b); v12: templates may carry `attachments.graph` (G5a); v13: `excelLayout`, the model's Excel layout (step 20); v14: `showcase`, what its showcase viewer shows (phase V3 of `docs/viewer-brief.md`; `cleanDocumentShowcase`, a showcase for one model, 1.5 MB, 16 deep) |
| `fmIDE-templates` | 10 | Saved templates (each holds a module, system or recipe); v2: families and versions; v3: recipes; v4: a template's model may carry `functions`; v5: the operators of phase E1; v6: `origin`; v7: a canvas template may carry `attachments` (its Excel layout, step 11c); v8: the operators of phase E2a; v9: `choose`; v10: a canvas or system template may carry an fmGraph board, `attachments.graph` (step 15 G5a) |
| `fmIDE-functions` | 2 | Function definitions (a library); v2: `origin` |
| `fmIDE-format-presets` | 2 | Format presets, including the canvas format roles; v2: no Excel-only roles or settings |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings |
| `fmIDE-macros` | 1 | Macros |
| `fmIDE-preferences` | 1 | Shortcuts, ribbon and Quick Access Toolbar, KeyTips trigger (fmIDE only; Export / Import Preferences) |
| `fmIDE-library-pack` | 4 | Templates, recipes and functions to share, with title, author and licence (fmIDE only; Save as / Open Library Pack); v2: an item shared again keeps its `origin`; v3: a canvas template may carry `attachments`; v4: a canvas or system template may carry `attachments.graph` |
| `fmIDE-excel-mapping` | 11 | ExcelExporter's tab/row layout for one model; v2: a row's own format (`style`) and `indent`; v3: `cfg.sensitivity`, the Tornado and Spider's settings (step 16); v4: `cfg.graph`, fmGraph's scenarios copied by Use fmGraph boards… (step 19 B2); v5: `cfg.sensitivities`, several analyses (step 19 B3a; `cfg.sensitivity` kept as a copy of the first); v6: an analysis's `origin` and an input's `show: false` (B3b); v7: `cfg.graph.sliders`, the Dashboard's sliders (B4); v8: `cfg.graph.charts`, the Dashboard's charts (B5); v9: a Dashboard chart may be `kind: "lines"` (fmGraph's lines chart); v10: a row's own Excel number format code, `style.excelFormat` (`cleanExcelNumberFormat`; module layouts keep it too, still version 2); v11: a Dashboard chart may be fmGraph's Free chart, `kind: "free"` with `pieces` (`of` / `check` a piece's place) and each part's `piece` (phase F3) |
| `fmIDE-excel-style` | 1 | ExcelExporter's Excel style: how every cell looks, by role (step 11a; Export / Import Excel Style) |
| `fmIDE-excel-module-layouts` | 2 | ExcelExporter's layouts remembered per module (step 11b; Export / Import Module Layouts); v2: `instance`, its block instances' layout (step 11d) |
| `fmIDE-graph-board` | 14 | fmGraph's boards for one model: bars, charts, sliders (step 15 G3a; Boards → Export / Import; the browser keeps the same form; a workspace's `graphBoards`, G3b; v2: the template form — rectangles by name, and canvas name for a system template — for `attachments.graph`, G5a; v3: the model's named scenarios, `scenarios`; v4: the scenario waterfall, a chart of layout `scenarios`; v5: a bar's or chart's fixed vertical scale, `scale`; v6: a folded slider, `folded`; v7: a board keeping its own slider positions, `ownSliders`; v8: the Tornado and the Spider, charts of layout `tornado` and `spider` (step 18); v9: the shared period, `sharedPeriods` and a bar's or chart's `ownPeriod` (the 8 → 9 upgrade marks every one own); v10: the lines chart, a chart of layout `lines` (the 9 → 10 step changes nothing); v11: the shared colours, `colours` — each rectangle's chosen colour, every widget still writing the colour it shows; a file without `colours` has its widgets' colours taken in, the first winning (the 10 → 11 step changes nothing); v12: the common scale, `commonScale` (`own`, `auto` or `fixed` with `min` / `max`) and a bar's or chart's `ownScale`, every follower still writing the scale it shows (the 11 → 12 step changes nothing: older files open with Each its own); v13: the Free chart, a chart of layout `free` — `pieces` with `column`, `sits` (`zero`, `top` / `end` `of` a piece, `level` `value`), `minus`, `check` (the 12 → 13 step changes nothing); v14: a slider at its minimum, `folded: "min"` beside `true` (the 13 → 14 step changes nothing; sample `board-v13.json`) — the template form stays 2; ExcelExporter reads versions 1–14 with its own reader (a Free chart drawn on the Dashboard since phase F3), `readGraphBoards`, step 19 B2) |
| `fmIDE-showcase` | 1 | What a showcase viewer shows (phase V1 of `docs/viewer-brief.md`; `src/shared/showcase.js`, `SHOWCASE_FORMATS`, `SHOWCASE_MIGRATIONS`): for one model — `id`, `title`, `description`, `author`, `licence`, `mark`, `canvases` (`show`, `start`), `boards` (an `fmIDE-graph-board` file, read by the viewer's Board with fmGraph's upgrades, phase V2), `play` (scenario names or "Base"), `periods` (with boards, the boards' shared periods), `excel.file` — or `"form": "recipe"`, for many models (`title` with `{model}`, `boards` in the template form, `auto`; since phase V5, still version 1 — no app writes a recipe and every earlier reader refuses one — `canvases` by name, `play`, `periods`, `excel.file` with `{model}`), read by `tools/make-viewers.js`, whose report is kind `fmIDE-viewer-report` 1 (written only); read by fmShowcase, which refuses a recipe; never holds the model; kept in a document as workspace 14's `showcase`; opened in fmIDE, it says where it opens (as an fmGraph board file does) |
| `fmIDE-viewer-workbook` | 1 | The Excel workbook a made showcase viewer carries in its `excel` data block (phase V4 of `docs/viewer-brief.md`; `src/shared/showcase.js`: `viewerWorkbookFor`, `readViewerWorkbook`, `cleanCellMap`, `VIEWER_WORKBOOK_FORMATS`): the workbook packed (raw deflate, base64, `size` ≤ 20 MB), the **cell map** (`case` the Global Case cell, `cases` each scenario's case and `missing`, `sliders` each Dashboard slider's rectangle, mode, periods, Typed and Use cells and `rest`) and ExcelExporter's `notes`; written by fmIDE from ExcelExporter's answer, read by fmShowcase; never opened as a file |
| `fmIDE-gallery` | 1 | The showcase gallery's list, `gallery.json` beside the made viewers (phase V6): `title`, `intro`, `sections` (`title`, `viewers`: ids); read by `tools/build-gallery.js` through `cleanGalleryList` (`src/shared/showcase.js`), never opened by an app |
| `fmIDE-library-index` | 1 | The catalogue's list of packs, `/library/index.json`, written by the build; read from the site by fmIDE's Browse Library (`readLibraryIndexData`), never opened as a file |

To change a format:

1. Raise `current` for that kind in `FILE_FORMATS` (fmIDE's kinds: `src/shared/fmide-files.js`; ExcelExporter's: its `js/04-file-formats.js`; for the shared kinds: in `SHARED_FILE_VERSIONS`, see 3).
2. Add `FILE_MIGRATIONS[kind][oldVersion]` (fmIDE's kinds: `FMIDE_FILE_MIGRATIONS` in `src/shared/fmide-files.js`, except the shortcuts file's step, in `src/fmide/js/04-file-formats.js`; shared kinds: `SHARED_FILE_MIGRATIONS`) — a function that upgrades a **copy** of an old file by exactly **one** version. A new pack version needs the checker (`tools/check-pack.js`) and its tests to follow.
3. `system` and `fmIDE-workspace` are read by both apps: their versions and upgrade steps live once in `src/shared/file-formats.js` (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS`) — change them there.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.
