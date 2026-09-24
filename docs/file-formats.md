# File formats

Every JSON file the apps write carries a `kind` and a `version`. Every file they read goes through one reader — `readFmFile()` in fmIDE, `readKnownFile()` in ExcelExporter — which:

1. identifies the kind (older files without `kind` are recognised by their shape, e.g. a bare macro list);
2. rejects the wrong kind of file with a message saying what it is and where to open it;
3. upgrades older versions one step at a time (`FILE_MIGRATIONS`);
4. asks once, up front, before opening a file saved by a **newer** version (cancel, or open anyway);
5. does the same for nested content: a workspace's system, each template's model.

The part both apps share lives once in `src/shared/file-formats.js`: the versions and upgrade steps of the two kinds both apps read (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS` for `system` and `fmIDE-workspace`), kind inference (`inferFileKind`) and the version check with step-by-step upgrades (`upgradeFileData`). Each app's `FILE_FORMATS` / `FILE_MIGRATIONS` are built from those plus its own kinds; the messages and nested-content handling stay in each app's reader.

## Documents (`.fmide`)

A `.fmide` file is an `fmIDE-workspace` file (same `kind`, same version, same reader) saved with the `.fmide` extension by fmIDE's **File → Save / Save As**. There is no separate format. Opening one with **File → Open…** loads the model and its format presets/roles, adds its templates and macros when not already there, and ignores its shortcuts and ribbon/KeyTips settings. **Import Workspace** of the same file replaces everything, as before. The workspace's `ui` part may carry `documentGroupAdded: true` (a customised ribbon already got the Document group once); older readers ignore it.

## Current versions

| `kind` | Version | What it is | Opened with |
|---|---|---|---|
| `system` | 2 | A whole model (all canvases, periods) | fmIDE: File → Load System · ExcelExporter |
| `module` | 1 | One canvas | fmIDE: File → Load Module |
| `fmIDE-workspace` | 1 | Everything: system + templates, format presets, shortcuts, macros. A **`.fmide` document** is exactly this, with the `.fmide` extension | fmIDE: File → Open… (a document) or Import Workspace (a full replace) · ExcelExporter |
| `fmIDE-templates` | 1 | Saved templates (each holds a module or system) | fmIDE: Templates → Import Templates |
| `fmIDE-format-presets` | 1 | Format presets, including the format roles | fmIDE: Format Presets → Import Presets |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings | fmIDE: Keyboard Shortcuts → Import Shortcuts |
| `fmIDE-macros` | 1 | Macros | fmIDE: Macro Builder → Import |
| `fmIDE-excel-mapping` | 1 | ExcelExporter's tab/row layout for one model | ExcelExporter: Import Mapping JSON |

## Changing a format

1. Raise the version for that kind: for `system` and `fmIDE-workspace` (read by **both** apps) in `SHARED_FILE_VERSIONS` in `src/shared/file-formats.js`; for any other kind in its app's `FILE_FORMATS`.
2. Add the upgrade step `[kind][oldVersion]` — a function that upgrades a copy of an old file by exactly **one** version — to `SHARED_FILE_MIGRATIONS` (shared kinds) or the app's `FILE_MIGRATIONS` (its own kinds).
3. `npm run build`: both apps pick up a shared change.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.

## Rules for anything read from a file

Files may come from other people (the planned community library), so text from a file is always shown as plain text, never as HTML; numbers are forced to be numbers; colours are checked before use. Neither app ever runs text from a file as code. The helpers for this (`escapeXml`, `safeNum`, `safeColor`) live in `src/shared/escaping.js`.
