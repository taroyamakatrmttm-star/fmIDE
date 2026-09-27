# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read this first; the linked docs are the source of truth, so when they change, keep this file in step.

## What this project is

fmIDE is a visual logic builder for financial models, plus a companion that turns those models into live-formula Excel workbooks. There are two apps:

| App | File | What it does |
|---|---|---|
| **fmIDE** | `apps/fmIDE.html` (source `src/fmide/`) | Build a model as a graph of rectangles (values), operators, aliases, period shifts and blocks, across canvases and periods. Saves systems, modules, workspaces, templates, format presets, shortcuts and macros. Scriptable through `window.fm` (see `docs/fmIDE-automation-api.md`). |
| **ExcelExporter** | `apps/ExcelExporter.html` (source `src/excel-exporter/`) | Loads an fmIDE system or workspace export and writes an `.xlsx` with real formulas: tabs, Inputs tab, scenarios and global cases, vertical-block vintages, format roles. |

The workflow: build in fmIDE → **File → Save System** or **Export Workspace** → load that file in ExcelExporter → **Generate & Download .xlsx**.

## How we work (every session)

The owner decides what is built and approves each change; sessions do the work and explain it in plain language. Each new feature or change is best done in its own session, one at a time.

1. **Plan first.** Read this file and the relevant `docs/`, then present a plan and **change nothing until the owner approves it** (unless they say to go ahead). Where a choice is the owner's to make, give the options with a recommendation. Follow the build order below; don't jump ahead unless asked.
2. **One change per branch and pull request**, starting from the latest `main`. Larger work goes in phases (as in `docs/step4-storage.md`); after each phase: summarise, push, open a pull request, and wait for approval before the next.
3. **Build and test.** Edit `src/` → `npm run build` → `npm test` before every commit (see "Checking a change"). New behaviour gets a test; a bug fix gets a test that fails without the fix; a test changed on purpose is named in the commit message; a failing test is reported and fixed, never weakened or skipped.
4. **Keep the docs in step, in the same pull request:** this file (when structure, rules, storage, file formats or the build order change), the relevant `docs/*.md` (a brief gets a short "how it turned out" when its phase is done), `tests/SPEC.md` and `tests/README.md` for new tests, `README.md` for anything a user does differently, and `CHANGELOG.md` for notable changes to the apps.
5. **Pull requests:** explain what changed and why in plain language, and list the tests. Then watch CI (continuous integration — the automatic test run on GitHub) and fix anything red until it is green.
6. **Talk plainly:** the owner reads every message. Spell out an abbreviation the first time it is used (for example PR, pull request; CI, continuous integration; PWA, installable web app), say what was verified and how, and report problems found along the way, even ones from earlier work.

## How the code is built

- **Each app is delivered as one self-contained HTML file** with all HTML, CSS and JavaScript inline, generated from `src/` by `npm run build`. There is no package manager for the apps, no framework and **no external dependencies** — no `<script src>`, no CDN, no network calls. They must keep working offline, opened straight from disk in any modern browser. Nothing is uploaded anywhere.
- **The installable web app (PWA) is built from the same `src/`** into `site/` by `npm run build` — not committed (Git ignores it); `npm run serve` shows it at `http://localhost:8080/`. It adds what a single file can't carry: `src/site/` (web app manifest, icons, the service worker `sw.js`, whose version the build fills in from a hash of the site's files). fmIDE's page gets the manifest links through its `<!-- build:site-head -->` marker, which is empty in `apps/`. The service worker keeps only the site's own files (offline) and never contacts another site. See `docs/step5-publish.md`.
- **Publishing** (`docs/step5-publish.md`): after the tests pass, the `deploy` job in `.github/workflows/tests.yml` uploads the site to Cloudflare Pages — a merge into `main` updates the live site, a pull request gets a preview address posted on it. The build also writes `site/_headers`: a strict security policy that lets each page run only its own inline scripts (by hash) and connect only to the site itself. **Never add anything that loads or sends to another site** — the policy blocks it by design. `tools/pages-server.js` serves the site locally the way Cloudflare does (short page addresses, `_headers`); `npm run serve` and the tests use it.
- ExcelExporter has its **own built-in Excel (xlsx/zip) writer**; it replaced an external library on purpose. Do not bring a library back.
- **Edit `src/`, never `apps/`.** `apps/*.html` are generated: after editing, run `npm run build` (`tools/build.js`, Node only, no packages) and commit `src/` and the rebuilt `apps/` together. CI rebuilds and fails if they disagree; `npm run build:check` checks locally. Git keeps the history, so never add version numbers to file names or make copies like `fmIDE-v2.html`.
- Source layout: `src/fmide/` and `src/excel-exporter/` each hold `index.html` (the page; a line `<!-- build:css styles.css -->` / `<!-- build:js js -->` marks where a file or folder goes), `styles.css`, and `js/NN-name.js` — plain fragments of the one wrapped function (no `import`/`export`), joined in file-name order. ExcelExporter's built-in Excel writer (the `XLSX` global) is its own script, `js-head/`. To find a function, Grep `src/` and read around it.
- **Shared code lives once in `src/shared/`** and is pulled into both apps by a line `// build:include shared/<file>.js` inside a script piece (indented like the marker). Today: `escaping.js` (escapeXml, safeNum, safeColor), `input-rule.js` (the input-rectangle rule, and `reachesOutsideTimeline` — when a rectangle's source needs a period outside the timeline), `format-roles.js` (the seven roles and their defaults), `file-formats.js` (shared kinds, versions, upgrades, kind inference, and `FILE_LIMITS` — `fileTextProblem` / `fileDataProblem` refuse a file opened that is over 50 MB, nested over 100 levels or holding over 5 million values; never applied to the autosave), `library-pack.js` (a library pack's details and their checks, `cleanLibraryPackInfo`, the accepted licences; fmIDE only for now), `store.js` (browser storage, below), `update-notice.js` (the "new version is ready" notice, `watchForUpdates`), and the formula IR (step 7): `operators.js` (the operator catalogue, by lasting id; phase E1 added `period`, `if`, `=`, `≠`, `and`, `or`, `not`, `round`, `roundup`, `rounddown` — `if` and the rounding ones take named inputs by `toPort`; comparisons use `approxEqual`, rounding `roundLikeExcel`), `uom.js` (units of measure), `functions.js` (function plugins: `parseFunctionText`, our own parser — never `eval` — plus `compileFunctions`, `runFunction`, `functionUnit`, `functionsUsedBy`) and `ir.js` (`compileModel(system)`, `evaluateModel(ir, options)`, `unitOf(ir, canvas, node, path)`, `plugsOf` / `plugLinks`) — both apps calculate from them: fmIDE evaluates the IR, ExcelExporter writes its formulas from it. How each operator is spelled in Excel stays in ExcelExporter (`src/excel-exporter/js/01b-operator-spellings.js`, keyed by catalogue id; a test checks every operator has one). Change shared behaviour there, never by copying it into one app; where the apps must differ, the shared function takes a parameter.
- Layout: `apps/` the two apps (generated) · `src/` their source (`src/shared/` used by both, `src/site/` the web app's extra files) · `site/` the web app (generated, not committed) · `tools/` the build, `serve.js` and `bench-calc.js` (`npm run bench`, times fmIDE's calculation and ExcelExporter's Generate) · `docs/` reference notes · `tests/` the test suite (`tests/README.md`; brief in `tests/SPEC.md`; sample files in `tests/fixtures/`, which are not edited — add new ones alongside).
- The apps have no dependencies; the test tooling (`package.json`: Playwright, exceljs, jszip) is dev-only and must never be loaded by an app.
- Record notable changes in `CHANGELOG.md`.

## Licences (`LICENSING.md`)

- Keep each part under its own licence. **Never move code between the open part (fmIDE, `src/shared/`) and ExcelExporter** without the owner's decision: code placed in `src/shared/` is Apache-licensed in both apps.
- New files take the licence of the folder they are in; new file-format documentation goes in `docs/file-formats.md` (CC BY 4.0).
- No outside contributions until a contributor licence agreement exists (`CONTRIBUTING.md`).
- The apps' licence notices (a comment at the top of each `index.html`) and the licence files shipped with the site (`tools/build.js`) stay in place.

## Non-negotiable rules for every change

1. **Text from files is always escaped.** Files may come from other people (the planned community library), so anything read from a file is untrusted:
   - show it as plain text (`textContent`, or `escapeXml()` from `src/shared/escaping.js` when building markup or XML — ExcelExporter's XLSX writer calls it through `esc()`) — never insert it as HTML;
   - force numbers to be numbers and validate coordinates;
   - check colours before use (e.g. `safeColor()` in fmIDE);
   - never run text from a file as code (no `eval`, `new Function`, inline handlers built from file text, etc.).
   This includes names, values, units, labels, canvas/tab names, macro text, template names and anything else that comes out of a loaded file.
2. **Do not break the file formats.** Every file the apps write must still be readable, and every older file must still open. Follow the rules below whenever a saved structure changes.

## Browser storage (`docs/step4-storage.md`)

Autosave lives in IndexedDB, through `createStore(dbName)` in `src/shared/store.js`: a promise-based key–value store (one object store `kv`, mostly string values of JSON text, plus file handles) that falls back to `localStorage` (text only) where IndexedDB is unavailable. Writes are asynchronous; failures reach the autosave warnings (fmIDE's `#autosaveBanner`, ExcelExporter's `#storageWarn`).

| App | Database | Keys |
|---|---|---|
| fmIDE | `fmIDE` | `fmIDE-workspace-v1` — the whole workspace; saved every 8 s, about 2 s after each change, when the page is hidden, and on close |
| fmIDE | `fmIDE` | `fmIDE-session` (open document: name, file name, Recent entry, unsaved flag) and `fmIDE-session-handle` (its file handle), saved with the workspace |
| fmIDE | `fmIDE` | `fmIDE-recent` (the list, at most 10), `fmIDE-recent:<id>` (a copy of that document), `fmIDE-recent-handle:<id>` (its file handle) |
| ExcelExporter | `fmIDE-ExcelExporter` | `fmide-excelmap-<model signature>` — one layout per model (the signature: canvas and node ids, leaving out the automatic plug aliases; a layout under the older signature, which counted them, is still found); saved on every change and when the page is hidden |
| both | (same) | `<dbName>/migrated-from-localStorage`, `<dbName>/persistence-requested` — bookkeeping |

- **Migration:** on start, keys an older version left in `localStorage` are copied into IndexedDB once (the marker records it, so a later delete is not undone). The `localStorage` copies are kept; never delete user data in the same step that moves it.
- fmIDE finishes starting (restores or adds the starter model, sets `window.fm`) only after the autosave has been read, and does not autosave before then. ExcelExporter's `loadModel()` is asynchronous for the same reason.
- `navigator.storage.persist()` is requested once, ever, on the first change (not at start-up); the answer is remembered.

## Documents (fmIDE, `src/fmide/js/20-documents.js`)

A document is a `.fmide` file: the `fmIDE-workspace` JSON, nothing new. Commands New, Open… (Mod+O), Save (Mod+S), Save As… (Mod+Shift+S), Open Recent… sit in the File tab's Document group.

- With the File System Access API (Chrome, Edge) Save writes back through a file handle; otherwise Open uses `#fileInputDocument` and Save downloads `name.fmide`. A `.json` opened as a document never keeps its handle, so it is never overwritten with a workspace.
- **Unsaved changes:** every change that goes into undo history (plus undo/redo) marks the document; saving clears it. Title `name • — fmIDE`. New / Open / Open Recent ask Save / Don't save / Cancel; closing the tab triggers "Leave site?".
- **Opening** loads the model and format presets/roles (same-name presets replaced), adds templates and macros not already present (templates: same name, kind and content — `addMissingTemplates()`, which Import Workspace and Import Templates use too; Templates → "Remove duplicates…" / the Remove Duplicate Templates… command opens a window: kind and the calculation (`templateLogicKey()`, ids and counters ignored) always match, name / layout and formatting / group / description per tick boxes (`dedupeMatch`, saved in the UI settings), the person picks which to keep, removal is by object not id; restoring the autosave gives every template its own id and continues `nextTemplateId` after the highest saved `usrN`; "Clear all templates" empties the library after asking), ignores shortcuts and ribbon/KeyTips, and clears undo history. New keeps the current presets, templates, macros and settings.
- **Template families and versions** (`11-templates-format-presets.js`, `docs/file-formats.md`): `TEMPLATES` holds one entry per version. Each carries `family` (a lasting random id, never the name), `version` (1, 2, 3…), `note` and `versionId` (random). Name, group, description and kind belong to the family and are kept equal across its versions. "Save as new version" is the only way to add a version; a name already used asks first. Names are unique among your own families, but imports may bring in a second family with the same name. The latest version is deleted only with its whole family, so numbers are never reused. `insertTemplate` takes `Name`, `Name@latest`, `Name@3` or `<family>@3`. Anything lasting (Phase B canvases, Phase C recipes) must store the family id and version (plus `versionId`), never the name or `usrN`.
- **Canvases linked to a template** (Phase B, `11-templates-format-presets.js`): `canvas.template = { family, version, versionId, name, skipped? }`, set by Add to new canvas, Add to current canvas on an empty canvas, and saving the canvas as a template; mixing in another template removes it. `templateLinkStatus()` compares it with the library (by family and `versionId`, never the number alone). `#templateUpdateBanner` and a ⬆ on the tab offer a newer version ("Not now" sets `skipped`). `fm.updateCanvasFromTemplate` rebuilds the canvas from a version and keeps its id and name, the ids of rectangles matched by name, and the typed values of matched input rectangles. The update window warns when the canvas has changes of its own (`templateLogicKey()` with input values set aside). Only canvas templates link; system templates don't.
- **Recipes** (Phase C, `11-templates-format-presets.js`): a template of kind `recipe` whose `data.parts` list canvas template families, each `'latest'` or a pinned version (with the `versionId` it was made with). `cleanRecipeData()` checks recipes from files; `templateKindOf()` keeps the kind when reading (an unknown kind is still a canvas template). Building (`insertTemplate`, `buildRecipe()`) adds one linked canvas per part; plugs and sockets connect them (the calculation works the links out from the names — `plugLinks` in `src/shared/ir.js`; the automatic aliases and arrows fmIDE draws and saves, marked `auto`, are only its drawing of them); a pinned version that differs, a missing part (skipped), sockets nothing feeds (`unfedSocketsIn()` in `10-plug-socket.js`) and sockets more than one plug feeds (`multiFedSocketsIn()`: their values are added, maybe by accident) are warnings, never blocks. On the canvas, a socket fed by several plugs shows "⚡ name ×N" in amber, with the plugs listed on hover. `fm.saveRecipe` saves one; the Templates window has "+ New Recipe…" and, for a recipe, its parts, the socket check, Build and "Edit as new version…".
- **Recovery:** after a restart with unsaved changes, `#recoveryBanner` offers Save / Dismiss.
- Ribbons customised before the Document group existed get it once (`ui.documentGroupAdded`); a removed group is never added back.
- **Web app** (`21-web-app.js`): registers the service worker only where the page links a manifest (the `site/` build) and the browser allows it; `#updateBanner` (shared `update-notice.js`, also in ExcelExporter wherever the site's service worker runs it, which registers nothing itself) offers Reload (autosave first, no "Leave site?"; ExcelExporter saves its layout, and the file must be loaded again) or Later, and appears in every open tab once another tab has switched; commands Install fmIDE and Open ExcelExporter (File tab, App group); a `.fmide` handed over by the operating system (`launchQueue`) opens like Open….
- **Functions** (step 7 phase D, `11b-functions.js`; format in `docs/file-formats.md`): a function is a formula in a file (`Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`), read by the shared parser, never run as code. `FUNCTIONS` is the library (one entry per version: `family`, `version`, `versionId`, `text`, `description`, `note`, `calls`), saved in the workspace; `modelFunctions` are the definitions the open model carries, and the calculation reads only those (`compileModel({ …, functions })`). Every file written from the model carries the ones it uses (`withFunctions` / `functionsUsedBy`); opening a file brings its definitions along and adds them to the library. A function node is `{ type: 'function', fn: { family, version, versionId, name } }`; arrows into it carry `toPort`. Refer to a function by family and version (plus `versionId`), never by name. The library works like templates (families, versions, notes; the latest deleted only with its family); `libraryFunctionFor` finds a version by `versionId` first, and an import whose number is taken is added under the next number (`addMissingFunctions`). The Functions manager and editor (`11c-functions-manager.js`, File → Functions / Insert → My Functions) and the `window.fm` actions (`14b-actions-functions.js`: `saveFunction`, `listFunctions`, `getFunction`, `setFunctionInfo`, `deleteFunction`, `importFunctions`, `exportFunctions`) came in D2a; the editor pins each call as `checkFunctionDraft` / `planFunctionCalls` decide. `modelFunctions` is part of the undo snapshot. **Function nodes** (D2b, `11d-function-nodes.js`; actions in `14b-actions-functions.js`): drawn like a block instance (teal; `renderFunctionNodeBody`), their inputs only from the model's definition (`functionNodeState`, `modelFunctionTable`), never the library; a missing or unreadable definition still draws with a warning. `fm.connect` takes an input by name or number from 1 (`resolveFunctionPort`); an arrow dropped on the body takes the first free input. Definitions join the model through `addFunctionsToModel(list, onClash)`: Insert refuses a different version under a number the model uses (pointing to Update); paste, modules, Add System, templates and updates renumber it in the model (`mergeModelFunctions` returns a `remap` the incoming nodes follow). ⬆ compares by `versionId` (`libraryFunctionFor`); updating (`functionNodeUpdatePlan` / `applyFunctionNodeUpdates`) matches arrows by input name and drops the rest, one undo step; "Not now" sets `fn.skipped` (optional, no format change). Copy carries the definitions (`clipboard.functions`); deleting nodes or canvases trims unused definitions (`trimModelFunctions`) in the same undo step. The ribbon's My Functions group got Insert Function… and Update Function… once (`ui.functionCommandsAdded`). **ExcelExporter** (D3, `src/excel-exporter/js/01c-function-calls.js`) writes each call out in full inside every formula that reads it (no `LAMBDA`): each input is `operandRef` of its port's arrow, built-ins through `EXCEL_SPELLINGS`, Excel's order of operations, comparisons as 1/0 (`N()`); a call fmIDE can't calculate, or an input the formula reads with no arrow, is `NA()`. A formula a call makes longer than 8,192 characters or nested deeper than 64 brackets is `NA()` (`buildWorkbook()` returns `tooLong`). The Functions tab (`appendFunctionsSheet`) lists the versions written out; `#differencesPanel` lists the function "?" cases (`NA_IN_EXCEL`) and the formulas too long.
- **Operators with named inputs** (phase E1b, `07-rendering.js`, `14-actions-registry-insert-connect.js`): `if` and `round`/`roundup`/`rounddown` draw as an operator box (`.portop`) with a labelled dot per input (`operatorPortsOf`, sized by `operatorSize`); an arrow dropped on a dot takes that input, one dropped on the body the first free one (`firstFreeOperatorPort`); arrows into them show no order badge. The period number takes no arrows in. `fm.setOperator` gives a node's arrows the named inputs left to right, and takes them away again. The Insert Operator commands of the ten new operators are `insertOp15`–`insertOp24` (after the first 15, whose numbers stay); the ribbon's Compare group has = and ≠, Excel Functions the others; a customised ribbon got them once (`ui.operatorsE1Added`).
- **Library packs** (step 8 phase 8a, `11e-library-packs.js`, actions in `14c-actions-library-packs.js`; `docs/step8-community-library.md`): a file of templates, recipes and functions to share (`fmIDE-library-pack`), with `pack` details — id, title, author, licence (only `CC-BY-4.0`), description, tags, date. **Save as Library Pack…** (`fm.saveLibraryPack`) adds what items need (a recipe's parts, the functions a function calls); **Open Library Pack…** refuses a pack without valid details, then previews each item's status (`libraryPackItems`: new, present, new-version — a family you have, which linked canvases will offer as an update — or same-name) and adds only the ticked ones and what they need, by the usual import rules (`addMissingTemplates` / `addMissingFunctions`, whose "already here" checks are `templateAlreadyHere` / `functionAlreadyHere`). `fm.previewLibraryPack`, `fm.openLibraryPack` (items by key, `t0`, `f1`). The author name is remembered in your own UI settings (`ui.libraryAuthor`), never taken from an imported workspace. The File tab's Library group got both commands once (`ui.libraryPacksAdded`). Macros are never shared.
- **Preferences** (`fmIDE-preferences`, in `22-customize-ribbon-ui-state.js`): Export / Import Preferences carry shortcuts for built-in commands, the ribbon and Quick Access Toolbar, its collapsed state and the KeyTips trigger. Import replaces exactly those; macro shortcuts stay the person's own. Ribbon layouts from files go through `cleanRibbonConfig()`.

## File formats (`docs/file-formats.md`)

Every JSON file the apps write has a `kind` and a `version`. Every file they read goes through a single reader — `readFmFile()` in fmIDE, `readKnownFile()` in ExcelExporter — which identifies the kind (older files without `kind` are recognised by shape), rejects the wrong kind with a message saying where it belongs, upgrades old versions one step at a time via `FILE_MIGRATIONS`, asks once before opening a file from a **newer** version, and does the same for nested content (a workspace's system, each template's model).

Current versions:

| `kind` | Version | What it is |
|---|---|---|
| `system` | 6 | A whole model (all canvases, periods) — read by **both** apps. v3: a rectangle's plugs are a list, `plugs`; v4: a canvas may carry `template`, the canvas template it came from; v5: `functions`, the function definitions it uses; v6: the operators of phase E1 |
| `module` | 4 | One canvas (v2: `plugs`, as system v3; v3: `functions`; v4: the operators of phase E1) |
| `fmIDE-workspace` | 5 | System + templates, format presets, shortcuts, macros — read by **both** apps; v4: `functions`, the function library; v5: the operators of phase E1 |
| `fmIDE-templates` | 5 | Saved templates (each holds a module, system or recipe); v2: families and versions; v3: recipes; v4: a template's model may carry `functions`; v5: the operators of phase E1 |
| `fmIDE-functions` | 1 | Function definitions (a library) |
| `fmIDE-format-presets` | 1 | Format presets, including the format roles |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings |
| `fmIDE-macros` | 1 | Macros |
| `fmIDE-preferences` | 1 | Shortcuts, ribbon and Quick Access Toolbar, KeyTips trigger (fmIDE only; Export / Import Preferences) |
| `fmIDE-library-pack` | 1 | Templates, recipes and functions to share, with title, author and licence (fmIDE only; Save as / Open Library Pack) |
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

Agreed: code lives in a GitHub repository (private until the owner makes it public); the first platform is an installable web app (PWA), then desktop via Tauri; one app, with ExcelExporter opening from inside fmIDE; hosting on Cloudflare Pages. **Licensing — open core, one repository with two licences** (`LICENSING.md`): fmIDE, `src/shared/`, tools and tests under the Apache License 2.0; ExcelExporter (`src/excel-exporter/`) proprietary, free to use; the file-format docs under CC BY 4.0.

Build order — work in this sequence and don't jump ahead unless asked:

1. Repository ✅
2. Permanent test suite ✅ — `npm test`
3. Split each app into modules — **still building to single HTML files** — protected by the tests ✅ (`docs/step3-modules.md`: 3a source in `src/`, 3b shared code in `src/shared/`; 3c real modules is later, with the plugin work)
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files ✅ — 4a IndexedDB underneath, 4b documents, 4c Preferences file
5. Publish the web app (`docs/step5-publish.md`) ✅ — 5a installable web app, 5b licences and automatic publishing to Cloudflare Pages (with pull-request previews)
6. Template management ✅ — families and versions, linked canvases and "Update this canvas", recipes, the several-plugs-on-one-socket warning
7. Formula IR and plugins — in progress (`docs/step7-formula-ir.md`): A agreement tests and fixes ✅; B the shared IR, fmIDE calculating on it ✅; C ExcelExporter writing formulas from the IR, with the "differs from fmIDE" list before download ✅; D function plugins ✅ — D1 shared parser, IR and file formats, D2 fmIDE (D2a library, Functions manager, `window.fm`; D2b function nodes, updating, copy and paste), D3 ExcelExporter writing calls out in full, and agreement; E new built-in operators — E1 ✅ (E1a the calculation of period, if, =, ≠, and, or, not, round, roundup, rounddown in both apps; E1b fmIDE's canvas: named inputs drawn, palette, ribbon); E2 (LN, EXP, SQRT, INT, TRUNC, CHOOSE) optional
8. Community library — in progress (`docs/step8-community-library.md`; decision 6 in `docs/decisions.md`): 8a library pack files ✅; 8b where items came from (`origin`); 8c the checker and the `/library` catalogue; 8d browsing inside fmIDE (optional, decided later)
9. Touch support

Phase 0 hardening done: escaping text from files, built-in Excel writer, file-format versions and migrations, autosave-failure warning, storage (step 4). Step 7 done up to E1 (E2 optional, not started). Now: step 8, the community library (the owner's chosen order: 7, 8, 9); 8a done. Next: 8b.

## Checking a change

Workflow: edit `src/` → **`npm run build`** → **`npm test`**. Run **`npm test`** before every commit (setup and details: `tests/README.md`). It runs offline, every group in `tests/SPEC.md`, and must pass against the apps as they are.

- Tests drive the apps only through their globals and page elements (`window.fm`, `XLSX`, element ids). Never change an app to make it testable; if a check seems to need that, ask first.
- A failing check is reported, not weakened.
- The LibreOffice recalculation tests need LibreOffice with Calc; they skip locally without it but are required on CI.
- Both apps calculate on the shared IR (`src/shared/ir.js`, `compileModel` / `evaluateModel`), a pure function of the model that reads no app state; units come from it too (`unitOf`), and so do plug-to-socket links (worked out from the names, never taken from the file). Test group 18 (`npm run test:ir`) pins fmIDE's values, error messages and units for every sample (`tests/snapshots/fmide-values--*`) and runs the shared IR alone in Node. Group 19 (`npm run test:excel-ir`) pins ExcelExporter's unit column for every sample (`tests/snapshots/excel-units--*`), checks every operator has an Excel spelling, and covers the panel that lists where the workbook will differ from fmIDE (`#differencesPanel`). A change to the calculation or the formula writer must not make either slower: compare `npm run bench` (fmIDE's calculation and ExcelExporter's Generate) before and after on the same machine.
- Both apps must calculate alike: test group 17 (`npm run test:agreement`) compares fmIDE's values with the recalculated workbooks for every sample model, and the rows on block-instance tabs with the IR's per-instance values. A change to how either app calculates keeps it green; a new calculation feature gets a case in `tests/fixtures/agreement/`.
- Phase E1 operators: agreement samples `agreement/operators-e1*.json` (group 17), the catalogue and fmIDE through `window.fm` (group 18), the exact Excel formulas and the list before download (group 19), the function syntax (group 20).
- Function plugins: groups 17 and 19 cover ExcelExporter writing calls out (agreement samples `agreement/functions-*.json`, the exact formula text — LibreOffice can't show how Excel treats TRUE/FALSE — the Functions tab and Excel's formula limits). Test group 20 (`tests/20-functions.spec.js`) covers the parser (accepted and rejected text, limits, hostile text), the samples in `tests/fixtures/functions/` in Node and in fmIDE, and files carrying their definitions. Group 21 (`tests/21-functions-fmide.spec.js`) covers fmIDE's side: the library, the Functions manager and editor, the `fmIDE-functions` file, function nodes on the canvas (insert, drawing, wiring, updating, copy and paste), undo, the ribbon and macros.
- Library packs and the file limits: test group 22 (`tests/22-library-packs.spec.js`, `npm run test:library-packs`; sample `tests/fixtures/library/pack-v1.json`).
- If a change deliberately alters the generated workbooks, run `npm run test:update-snapshots` and commit the updated `tests/snapshots/` with the change.
- A change to a file format needs an old-version sample in `tests/fixtures/formats/` and a test that it still opens.
