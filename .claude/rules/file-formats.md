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
| `fmIDE-workspace` | 12 | System + templates, format presets, shortcuts, macros — read by **both** apps; v4: `functions`, the function library; v5: the operators of phase E1; v6: templates and library functions may carry `origin`; v7: no Excel-only format roles or settings; v8: templates may carry `attachments` (step 11c); v9: the operators of phase E2a; v10: `choose`; v11: `graphBoards`, the model's fmGraph boards (step 15 G3b); v12: templates may carry `attachments.graph` (G5a) |
| `fmIDE-templates` | 10 | Saved templates (each holds a module, system or recipe); v2: families and versions; v3: recipes; v4: a template's model may carry `functions`; v5: the operators of phase E1; v6: `origin`; v7: a canvas template may carry `attachments` (its Excel layout, step 11c); v8: the operators of phase E2a; v9: `choose`; v10: a canvas or system template may carry an fmGraph board, `attachments.graph` (step 15 G5a) |
| `fmIDE-functions` | 2 | Function definitions (a library); v2: `origin` |
| `fmIDE-format-presets` | 2 | Format presets, including the canvas format roles; v2: no Excel-only roles or settings |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings |
| `fmIDE-macros` | 1 | Macros |
| `fmIDE-preferences` | 1 | Shortcuts, ribbon and Quick Access Toolbar, KeyTips trigger (fmIDE only; Export / Import Preferences) |
| `fmIDE-library-pack` | 4 | Templates, recipes and functions to share, with title, author and licence (fmIDE only; Save as / Open Library Pack); v2: an item shared again keeps its `origin`; v3: a canvas template may carry `attachments`; v4: a canvas or system template may carry `attachments.graph` |
| `fmIDE-excel-mapping` | 3 | ExcelExporter's tab/row layout for one model; v2: a row's own format (`style`) and `indent`; v3: `cfg.sensitivity`, the Tornado and Spider's settings (step 16) |
| `fmIDE-excel-style` | 1 | ExcelExporter's Excel style: how every cell looks, by role (step 11a; Export / Import Excel Style) |
| `fmIDE-excel-module-layouts` | 2 | ExcelExporter's layouts remembered per module (step 11b; Export / Import Module Layouts); v2: `instance`, its block instances' layout (step 11d) |
| `fmIDE-graph-board` | 8 | fmGraph's boards for one model: bars, charts, sliders (step 15 G3a; Boards → Export / Import; the browser keeps the same form; a workspace's `graphBoards`, G3b; v2: the template form — rectangles by name, and canvas name for a system template — for `attachments.graph`, G5a; v3: the model's named scenarios, `scenarios`; v4: the scenario waterfall, a chart of layout `scenarios`; v5: a bar's or chart's fixed vertical scale, `scale`; v6: a folded slider, `folded`; v7: a board keeping its own slider positions, `ownSliders`; v8: the Tornado and the Spider, charts of layout `tornado` and `spider` (step 18) — the template form stays 2) |
| `fmIDE-library-index` | 1 | The catalogue's list of packs, `/library/index.json`, written by the build; read from the site by fmIDE's Browse Library (`readLibraryIndexData`), never opened as a file |

To change a format:

1. Raise `current` for that kind in `FILE_FORMATS` (fmIDE's kinds: `src/shared/fmide-files.js`; ExcelExporter's: its `js/04-file-formats.js`; for the shared kinds: in `SHARED_FILE_VERSIONS`, see 3).
2. Add `FILE_MIGRATIONS[kind][oldVersion]` (fmIDE's kinds: `FMIDE_FILE_MIGRATIONS` in `src/shared/fmide-files.js`, except the shortcuts file's step, in `src/fmide/js/04-file-formats.js`; shared kinds: `SHARED_FILE_MIGRATIONS`) — a function that upgrades a **copy** of an old file by exactly **one** version. A new pack version needs the checker (`tools/check-pack.js`) and its tests to follow.
3. `system` and `fmIDE-workspace` are read by both apps: their versions and upgrade steps live once in `src/shared/file-formats.js` (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS`) — change them there.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.
