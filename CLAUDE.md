# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read this first; the linked docs are the source of truth, so when they change, keep this file in step.

## What this project is

fmIDE is a visual logic builder for financial models, plus a companion that turns those models into live-formula Excel workbooks. There are two apps:

| App | File | What it does |
|---|---|---|
| **fmIDE** | `apps/fmIDE.html` (source `src/fmide/`) | Build a model as a graph of rectangles (values), operators, aliases, period shifts and blocks, across canvases and periods. Saves systems, modules, workspaces, templates, format presets, shortcuts and macros. Scriptable through `window.fm` (see `docs/fmIDE-automation-api.md`). |
| **ExcelExporter** | `apps/ExcelExporter.html` (source `src/excel-exporter/`) | Loads an fmIDE system or workspace export and writes an `.xlsx` with real formulas: tabs, Inputs tab, scenarios and global cases, vertical-block vintages, format roles. |

The workflow: build in fmIDE → **File → Save System** or **Export Workspace** → load that file in ExcelExporter → **Generate & Download .xlsx**.

## How the code is built

- **Each app is delivered as one self-contained HTML file** with all HTML, CSS and JavaScript inline, generated from `src/` by `npm run build`. There is no package manager for the apps, no framework and **no external dependencies** — no `<script src>`, no CDN, no network calls. They must keep working offline, opened straight from disk in any modern browser. Nothing is uploaded anywhere.
- ExcelExporter has its **own built-in Excel (xlsx/zip) writer**; it replaced an external library on purpose. Do not bring a library back.
- **Edit `src/`, never `apps/`.** `apps/*.html` are generated: after editing, run `npm run build` (`tools/build.js`, Node only, no packages) and commit `src/` and the rebuilt `apps/` together. CI rebuilds and fails if they disagree; `npm run build:check` checks locally. Git keeps the history, so never add version numbers to file names or make copies like `fmIDE-v2.html`.
- Source layout: `src/fmide/` and `src/excel-exporter/` each hold `index.html` (the page; a line `<!-- build:css styles.css -->` / `<!-- build:js js -->` marks where a file or folder goes), `styles.css`, and `js/NN-name.js` — plain fragments of the one wrapped function (no `import`/`export`), joined in file-name order. ExcelExporter's built-in Excel writer (the `XLSX` global) is its own script, `js-head/`. To find a function, Grep `src/` and read around it.
- **Shared code lives once in `src/shared/`** and is pulled into both apps by a line `// build:include shared/<file>.js` inside a script piece (indented like the marker). Today: `escaping.js` (escapeXml, safeNum, safeColor), `input-rule.js` (the input-rectangle rule), `format-roles.js` (the seven roles and their defaults), `file-formats.js` (shared kinds, versions, upgrades, kind inference). Change shared behaviour there, never by copying it into one app; where the apps must differ, the shared function takes a parameter.
- Layout: `apps/` the two apps (generated) · `src/` their source (`src/shared/` used by both) · `tools/` the build · `docs/` reference notes · `tests/` the test suite (`tests/README.md`; brief in `tests/SPEC.md`; sample files in `tests/fixtures/`, which are not edited — add new ones alongside).
- The apps have no dependencies; the test tooling (`package.json`: Playwright, exceljs, jszip) is dev-only and must never be loaded by an app.
- Record notable changes in `CHANGELOG.md`.

## Non-negotiable rules for every change

1. **Text from files is always escaped.** Files may come from other people (the planned community library), so anything read from a file is untrusted:
   - show it as plain text (`textContent`, or `escapeXml()` from `src/shared/escaping.js` when building markup or XML — ExcelExporter's XLSX writer calls it through `esc()`) — never insert it as HTML;
   - force numbers to be numbers and validate coordinates;
   - check colours before use (e.g. `safeColor()` in fmIDE);
   - never run text from a file as code (no `eval`, `new Function`, inline handlers built from file text, etc.).
   This includes names, values, units, labels, canvas/tab names, macro text, template names and anything else that comes out of a loaded file.
2. **Do not break the file formats.** Every file the apps write must still be readable, and every older file must still open. Follow the rules below whenever a saved structure changes.

## File formats (`docs/file-formats.md`)

Every JSON file the apps write has a `kind` and a `version`. Every file they read goes through a single reader — `readFmFile()` in fmIDE, `readKnownFile()` in ExcelExporter — which identifies the kind (older files without `kind` are recognised by shape), rejects the wrong kind with a message saying where it belongs, upgrades old versions one step at a time via `FILE_MIGRATIONS`, asks once before opening a file from a **newer** version, and does the same for nested content (a workspace's system, each template's model).

Current versions:

| `kind` | Version | What it is |
|---|---|---|
| `system` | 2 | A whole model (all canvases, periods) — read by **both** apps |
| `module` | 1 | One canvas |
| `fmIDE-workspace` | 1 | System + templates, format presets, shortcuts, macros — read by **both** apps |
| `fmIDE-templates` | 1 | Saved templates (each holds a module or system) |
| `fmIDE-format-presets` | 1 | Format presets, including the format roles |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings |
| `fmIDE-macros` | 1 | Macros |
| `fmIDE-excel-mapping` | 1 | ExcelExporter's tab/row layout for one model |

To change a format:

1. Raise `current` for that kind in `FILE_FORMATS` (for the shared kinds: in `SHARED_FILE_VERSIONS`, see 3).
2. Add `FILE_MIGRATIONS[kind][oldVersion]` (shared kinds: `SHARED_FILE_MIGRATIONS`) — a function that upgrades a **copy** of an old file by exactly **one** version.
3. `system` and `fmIDE-workspace` are read by both apps: their versions and upgrade steps live once in `src/shared/file-formats.js` (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS`) — change them there.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.

## Format roles (`docs/format-roles.md`)

All formatting — on the canvas and in Excel — is defined in one place: **format roles** in fmIDE's Formats manager (File → Format Presets). Each role is a format preset with a reserved name; roles can be edited but not deleted, and they travel inside system and workspace exports, which is how ExcelExporter reads them. Files without them get the built-in defaults (`FORMAT_ROLES` in `src/shared/format-roles.js`). Do not add a second place where formatting is defined.

| Role | Used on | Covers |
|---|---|---|
| Inputs | Canvas + Excel | Hard-coded numbers: input rectangles, scenario values, cells typed on the Scenarios tab |
| Calculations | Canvas + Excel | Formulas: rectangles fed by an arrow, every calculated Excel cell (blank by default) |
| Links | Excel | Formulas that only pull a value from another sheet |
| Headers | Excel | Each sheet's title and column-header row |
| Section Headers | Excel | The INPUTS / CALCULATIONS / OUTPUTS bands |
| Labels | Excel | Custom/label rows and group headers (unless the row has its own format) |
| Notes | Excel | Notes, Period # counter, scenario numbering, other helper text |

Who decides what:

- **Fill, font colour, border**: the role — unless the rectangle has its own 🎨 format *and* "Use this fill, font colour & border in Excel too" is ticked.
- **Number format, weight, font size**: the rectangle's own format if it has one, otherwise the role.
- Excel-only style settings: *Excel border sides* (none ticked = no Excel border; the canvas always draws the full outline) and *Use Excel's default font size*.

**Input rectangle** — one rule for both apps, in `src/shared/input-rule.js`: no incoming arrow, or a single incoming arrow from an operator or period shift that nothing feeds.

## Decisions and build order (`docs/decisions.md`)

Agreed: code lives in a private GitHub repository; the first platform is an installable web app (PWA), then desktop via Tauri. Open: open source or not — decide by the first public release (recommendation: open core). The repository stays private until then.

Build order — work in this sequence and don't jump ahead unless asked:

1. Repository ✅
2. Permanent test suite ✅ — `npm test`
3. Split each app into modules — **still building to single HTML files** — protected by the tests ✅ (`docs/step3-modules.md`: 3a source in `src/`, 3b shared code in `src/shared/`; 3c real modules is later, with the plugin work)
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files
5. Publish the web app; then formula IR and plugins, community library, touch support

Phase 0 hardening done: escaping text from files, built-in Excel writer, file-format versions and migrations, autosave-failure warning. Still to do: storage (step 4).

## Checking a change

Workflow: edit `src/` → **`npm run build`** → **`npm test`**. Run **`npm test`** before every commit (setup and details: `tests/README.md`). It runs offline, every group in `tests/SPEC.md`, and must pass against the apps as they are.

- Tests drive the apps only through their globals and page elements (`window.fm`, `XLSX`, element ids). Never change an app to make it testable; if a check seems to need that, ask first.
- A failing check is reported, not weakened.
- The LibreOffice recalculation tests need LibreOffice with Calc; they skip locally without it but are required on CI.
- If a change deliberately alters the generated workbooks, run `npm run test:update-snapshots` and commit the updated `tests/snapshots/` with the change.
- A change to a file format needs an old-version sample in `tests/fixtures/formats/` and a test that it still opens.
