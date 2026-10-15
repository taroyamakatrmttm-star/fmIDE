# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Read this first. It is kept short on purpose: it is loaded into every session, so the details live in the files listed under "Where the details are", read when the work reaches them. The linked docs are the source of truth, so when they change, keep this file and those files in step.

## What this project is

fmIDE is a visual logic builder for financial models, plus companions that turn those models into live-formula Excel workbooks and show how a value moves them. There are three apps:

| App | File | What it does |
|---|---|---|
| **fmIDE** | `apps/fmIDE.html` (source `src/fmide/`) | Build a model as a graph of rectangles (values), operators, aliases, period shifts and blocks, across canvases and periods. Saves systems, modules, workspaces, templates, format presets, shortcuts and macros. Scriptable through `window.fm` (see `docs/fmIDE-automation-api.md`). |
| **ExcelExporter** | `apps/ExcelExporter.html` (source `src/excel-exporter/`) | Loads an fmIDE system or workspace export and writes an `.xlsx` with real formulas: tabs, Inputs tab, scenarios and global cases, vertical-block vintages, and the person's own Excel style. |
| **fmGraph** | `apps/fmGraph.html` (source `src/fmgraph/`, step 15) | Bars show rectangles' values in chosen periods, sliders change input rectangles; every bar a slider's input reaches moves with it. Opens from fmIDE with the open model, or a saved file. Never changes the model. Scriptable through `window.fmGraph`. |

The workflow: build in fmIDE → **File → Open ExcelExporter** (the open model arrives by itself; or save a file and load it there) → **⬇ Generate .xlsx**. To see how a value moves the model: **File → Open fmGraph** in fmIDE.

## How we work (every session)

The owner decides what is built and approves each change; sessions do the work and explain it in plain language. Each new feature or change is best done in its own session, one at a time.

1. **Plan first.** Read this file and the relevant `docs/`, then present a plan and **change nothing until the owner approves it** (unless they say to go ahead). Where a choice is the owner's to make, give the options with a recommendation. Follow the build order below; don't jump ahead unless asked.
2. **One change per branch and pull request**, starting from the latest `main`. Larger work goes in phases (as in `docs/step4-storage.md`); after each phase: summarise, push, open a pull request, and wait for approval before the next.
3. **Build and test.** Edit `src/` → `npm run build` → the related test groups before every commit (see "Checking a change"); GitHub runs the whole suite on every pull request, and nothing is merged until it is green. New behaviour gets a test; a bug fix gets a test that fails without the fix; a test changed on purpose is named in the commit message; a failing test is reported and fixed, never weakened or skipped.
4. **Keep the docs in step, in the same pull request:** a change people will notice adds its What's new entry (`src/help/fmide-whats-new.js`, or ExcelExporter's `excel-whats-new.js`); this file and the matching file under "Where the details are" (when structure, rules, storage, file formats or the build order change), the relevant `docs/*.md` (a brief gets a short "how it turned out" when its phase is done), `tests/SPEC.md` and `tests/README.md` for new tests, `README.md` for anything a user does differently, and `CHANGELOG.md` for notable changes to the apps.
5. **Pull requests:** explain what changed and why in plain language, and list the tests. Then watch CI (continuous integration — the automatic test run on GitHub) and fix anything red until it is green.
6. **Talk plainly:** the owner reads every message. Spell out an abbreviation the first time it is used (for example PR, pull request; CI, continuous integration; PWA, installable web app), say what was verified and how, and report problems found along the way, even ones from earlier work.
7. **Work narrowly, widen on evidence.** Find the module that owns the change and read only it, its callers where needed, its tests and its rules file; search large files (`tests/SPEC.md`, the docs, the apps' sources) rather than reading them whole. Widen when the change reaches shared code (`src/shared/`, the build, a file format) or a test says so, and say why.
8. **Raise improvements.** When a session finds a way to make this work cheaper or faster — fewer files to read, faster tests, clearer guidance — it tells the owner (the owner's standing request, 12 October 2026).

## How the code is built

- **Each app is delivered as one self-contained HTML file** with all HTML, CSS and JavaScript inline, generated from `src/` by `npm run build`. There is no package manager for the apps, no framework and **no external dependencies** — no `<script src>`, no CDN. **The single files in `apps/` make no network calls at all**; the one exception anywhere is fmIDE on its published site, which may read its own site's `/library` (the list and pack files, Browse Library, step 8d) when the person asks — same site only, nothing ever sent, nothing from any other site (decision 6). They must keep working offline, opened straight from disk in any modern browser. Nothing is uploaded anywhere.
- ExcelExporter has its **own built-in Excel (xlsx/zip) writer**; it replaced an external library on purpose. Do not bring a library back.
- **Edit `src/`, never `apps/`.** `apps/*.html` are generated: after editing, run `npm run build` (`tools/build.js`, Node only, no packages) and commit `src/` and the rebuilt `apps/` together. CI rebuilds and fails if they disagree; `npm run build:check` checks locally. Git keeps the history, so never add version numbers to file names or make copies like `fmIDE-v2.html`.
- Source layout: `src/fmide/` and `src/excel-exporter/` each hold `index.html` (the page; a line `<!-- build:css styles.css -->` / `<!-- build:js js -->` marks where a file or folder goes), `styles.css`, and `js/NN-name.js` — plain fragments of the one wrapped function (no `import`/`export`), joined in file-name order. ExcelExporter's built-in Excel writer (the `XLSX` global) is its own script, `js-head/` — a module (step 3c-3: `export var XLSX`, importing the shared escaping; tested in Node, group 65; a cell's `dataTable` writes an Excel Data Table, `ws['!charts']` and `XLSX.utils.book_append_chartsheet` write bar and line charts, step 16); its formula building is the module folder `src/excel-exporter/formulas/` (step 3c-4: `core-translation.js` — `operandRef`, `buildCellContent`, `classifyNode`, brackets, columns, `pathKey`, `isVintageVarying`, `mirrorIdFor`; `operator-spellings.js`; `function-calls.js`), included by `js/01-core-translation.js`, which opens the app's wrapped function; the rest of the app sets its state only through `useModelIR(ir)` and `useHelperColumns(n)`; its help text is data in `src/excel-exporter/help/excel-help.js` (ExcelExporter's licence), pulled in by `// build:include excel-exporter/help/excel-help.js` (an include takes any path under `src/`). To find a function, Grep `src/` and read around it.
- Layout: `apps/` the three apps (generated) · `src/` their source (`src/fmgraph/` fmGraph, `src/shared/` used by them, `src/help/` fmIDE's help text and tutorials (CC BY 4.0), `src/site/` the web app's extra files, `src/library/` the catalogue's style sheet, also the help pages', `src/help-pages/` the help pages' own styles) · `library/` the community library (git submodule, not edited here) · `site/` the web app (generated, not committed) · `tools/` the build, `serve.js`, `bench-calc.js` (`npm run bench`, times fmIDE's calculation and ExcelExporter's Generate) `test-impact.js` (`npm run test:changed`, the tests a change reaches; group 74), `check-pack.js` (`npm run check-pack -- FILE`, the library's pack checker, step 8c), `check-library.js` (its library mode, `--library DIR [--base DIR]`, step 8c-2) `build-library.js` (the catalogue, step 8c-3) and `build-help.js` (the help pages, step 10 H4a), `video-scripts.js` and `record-tutorials.js` (the tutorial videos, H4b) · `docs/` reference notes · `tests/` the test suite (`tests/README.md`; brief in `tests/SPEC.md`; sample files in `tests/fixtures/`, which are not edited — add new ones alongside).
- The apps have no dependencies; the test tooling (`package.json`: Playwright, exceljs, jszip) is dev-only and must never be loaded by an app.
- Record notable changes in `CHANGELOG.md`.

## Licences (`LICENSING.md`)

- Keep each part under its own licence. **Never move code between the open part (fmIDE, `src/shared/`) and ExcelExporter** without the owner's decision: code placed in `src/shared/` is Apache-licensed in both apps.
- New files take the licence of the folder they are in; new file-format documentation goes in `docs/file-formats.md` (CC BY 4.0).
- No outside contributions until a contributor licence agreement exists (`CONTRIBUTING.md`).
- The apps' licence notices (a comment at the top of each `index.html`) and the licence files shipped with the site (`tools/build.js`) stay in place.

## Non-negotiable rules for every change

1. **Text from files is always escaped.** Files may come from other people (the community library), so anything read from a file is untrusted:
   - show it as plain text (`textContent`, or `escapeXml()` from `src/shared/escaping.js` when building markup or XML — ExcelExporter's XLSX writer calls it through `esc()`) — never insert it as HTML;
   - force numbers to be numbers and validate coordinates;
   - check colours before use (e.g. `safeColor()` in fmIDE);
   - never run text from a file as code (no `eval`, `new Function`, inline handlers built from file text, etc.).
   This includes names, values, units, labels, canvas/tab names, macro text, template names and anything else that comes out of a loaded file.
2. **Do not break the file formats.** Every file the apps write must still be readable, and every older file must still open. Follow the rules below whenever a saved structure changes.

## Rules that apply wherever you work

Each is stated in full in the file named; these lines are here so they apply whichever files a change touches.

- **Nothing loads from or sends to another site** — the site's security policy blocks it by design (`.claude/rules/build-and-site.md`).
- **Browser storage:** a stored key added or changed goes in `docs/architecture/storage.md`; never delete user data in the same step that moves it.
- **A file format change:** raise the version, add a one-step upgrade of a copy, and an old-version sample with a test (`.claude/rules/file-formats.md`).
- **fmIDE:** every new command needs its Help sentence, and a changed feature its topic, in the same pull request (group 31); every new window gets a "?" (`addWindowHelp`); a new or changed tutorial step needs its action in `tests/helpers/tutorial-actions.js` (group 33) — all in `.claude/rules/fmide-help.md`. A new action that makes something declares `returns` (`.claude/rules/fmide-macros.md`). A new command for the ribbon reaches a customised ribbon once, through a `ui.…Added` flag, as the existing ones do. Every pointer-to-canvas conversion goes through `canvasPoint` or divides by `zoom` (`.claude/rules/fmide-zoom.md`); an action started by a press uses `pressDefault`, never `preventDefault` (`.claude/rules/pointer-input.md`).
- **The look has two owners:** fmIDE the canvas look and number formats, ExcelExporter every cell's look in Excel; never let one leak into the other (`.claude/rules/format-roles.md`).
- **ExcelExporter:** every new file action or reset goes in the File or Layout menu; keep the page short on words (`.claude/rules/excel-exporter.md`).
- **fmGraph:** shares no code with ExcelExporter; a new tutorial step needs its action in group 58 (`.claude/rules/fmgraph.md`).
- **Shared code:** a shared file using another's name must import it (group 64; `.claude/rules/shared.md`). Change shared behaviour in `src/shared/`, never by copying it into one app.

**Input rectangle** — one rule for both apps, in `src/shared/input-rule.js`: no incoming arrow, or a single incoming arrow from an operator or period shift that nothing feeds. An operator with nothing wired in (no named inputs) gives 0 in the calculation, as Excel writes it (8 October 2026); the input rule still decides first, so a rectangle or block Input port fed only by one uses its own number.

## Where the details are

Files under `.claude/rules/` load by themselves when a session reads a file they name (the `paths` at their top); read any of them directly when the work needs it. Each was moved word for word from this file on 12 October 2026 (`docs/architecture/README.md`).

| Topic | File |
|---|---|
| The site, the library's catalogue, the help pages, publishing | `.claude/rules/build-and-site.md` |
| Shared code (`src/shared/`), modules | `.claude/rules/shared.md` |
| Pointer input, touch, the screen | `.claude/rules/pointer-input.md` |
| fmIDE: documents, the web app (and its link with ExcelExporter and fmGraph), preferences | `.claude/rules/fmide-documents.md` |
| fmIDE: templates, linked canvases, recipes, attachments | `.claude/rules/fmide-templates.md` |
| fmIDE: functions, operators with named inputs | `.claude/rules/fmide-functions-operators.md` |
| fmIDE: library packs, browsing the library | `.claude/rules/fmide-library.md` |
| Help, tutorials, What's new (both apps) | `.claude/rules/fmide-help.md` |
| fmIDE: placing nodes, Add Many Rectangles, switching canvases, messages, resizable windows | `.claude/rules/fmide-canvas.md` |
| fmIDE: zoom, pinch | `.claude/rules/fmide-zoom.md` |
| fmIDE: macros and actions | `.claude/rules/fmide-macros.md` |
| fmIDE on a phone | `.claude/rules/fmide-phone.md` |
| fmGraph (all of it, its phone layout too) | `.claude/rules/fmgraph.md` |
| ExcelExporter: page, sensitivity, module layouts, its phone screen | `.claude/rules/excel-exporter.md` |
| Format roles and the Excel style | `.claude/rules/format-roles.md` |
| File formats: current versions, how to change one | `.claude/rules/file-formats.md` |
| The calculation tests (IR, agreement) | `.claude/rules/testing.md` |
| Browser storage: every database and key | `docs/architecture/storage.md` |
| Decisions and the full build order | `docs/architecture/build-order.md` |
| How this guidance is organised, what changed on 12 October 2026 | `docs/architecture/README.md` |

## Build order (full history: `docs/architecture/build-order.md`, decisions: `docs/decisions.md`)

Work in the build order and don't jump ahead unless asked. **Tell the owner at the start of each message where in the build order the work is.**

- Steps 1–17 are done: 1 repository · 2 test suite · 3 modules (3c real modules) · 4 storage · 5 publishing · 6 templates · 7 formula IR and plugins · 8 community library · 9 touch · 10 help (all but **H4c, the video links, waiting on the owner's recordings**) · 11 the Excel look in ExcelExporter · 12 faster canvas building · 13 zoom · 14 ExcelExporter's new look · 15 fmGraph · 16 sensitivity · 17 phones (later ideas in `docs/step17-phones.md`).
- Under way: **19 fmGraph in Excel** (`docs/step19-fmgraph-in-excel.md`, decision 12; ExcelExporter rebuilds a model's boards through Layout → Use fmGraph boards…): B2 ✅ the scenarios as Global Cases (layout file 4, `cfg.graph`); next B3 several sensitivity analyses (layout file 5), B4 the Dashboard's scroll bars, B5 Excel charts and finishing. Awaiting the owner's approval: **18 Tornado and Spider charts in fmGraph** (`docs/step18-fmgraph-sensitivity.md`; phases A1 the Tornado, A2 the Spider).
- Deferred: before the project is shared, the owner's name comes out of the public places (`docs/decisions.md`, "Before sharing the project"). Known issues: `docs/decisions.md` ("Known issues, to fix later"), none today.
- The library repository names the fmIDE commit whose checker it runs in its `checker.json`: a change to the checker reaches the library only when that pointer is moved.

## Checking a change

Workflow: edit `src/` → **`npm run build`** → **`npm run build:check`, group 0 (smoke) and the related test groups** → commit; the whole suite (`npm test`) runs on GitHub for every pull request (setup and details: `tests/README.md`). It runs offline, every group in `tests/SPEC.md`, and must pass against the apps as they are.
- **Run only the related groups locally** (the owner's decision, 12 October 2026): the groups that cover what the change touches — its own new or changed tests, and the groups `tests/SPEC.md` names for that feature and for what it talks to (for example, an attach between apps: the groups of both sides). Not `npm run test:changed` by habit: a change to a widely loaded file reaches most of the suite (about 18 minutes locally against under 5 on GitHub, measured 12 October 2026). The whole suite on GitHub is the check before merging; a failure there is fixed in the pull request as usual.
- **What the change reaches**, when it helps choose: `npm run test:changed` works them out from the files changed against `main` (committed or not) with `tools/test-impact.js` — a map from source to test groups by what each group loads, checked by test group 74 — and runs `npm run build:check`, group 0 (smoke) and those groups; `node tools/test-impact.js --why` shows why each is there. It runs everything for a change to `src/shared/`, `tools/build.js`, the test helpers, a file format, the test settings, `package.json` (unless only its `test:` shortcuts changed: then the files they name) or any file it doesn't know, and only smoke for documentation. A new file or folder under `src/` or `tools/` that it doesn't know fails group 74: add it to the map (the top of `tools/test-impact.js`). To run one area on purpose: the `npm run test:<area>` scripts or `npx playwright test tests/NN-…` (which group covers what: `tests/SPEC.md` — search it, don't read it whole). When unsure, run more, not less.
- **Say what ran:** the commit message or pull request lists the tests run locally; never claim the full suite passed unless it was run.
- **Test time** (the owner's standing request, 8 October 2026): keep making the suite faster whenever a way is found, **without lowering what it checks** — never by skipping, removing or loosening a test. A slow check that only a browser can do stays; one that can run in Node (the modules of step 3c) may move there. Measure first (the durations in a GitHub run's log, per group) and say what it saved. History: about 13 minutes per pull request, run twice (push and pull request), until 8 October 2026; then once, in 4 parts at once (4 min 47 s); then the parts balanced by time (`tools/test-parts.js`, test group 66).

- Tests drive the apps only through their globals and page elements (`window.fm`, `XLSX`, element ids). Never change an app to make it testable; if a check seems to need that, ask first.
- A failing check is reported, not weakened.
- The LibreOffice recalculation tests need LibreOffice with Calc; they skip locally without it but are required on CI.
- If a change deliberately alters the generated workbooks, run `npm run test:update-snapshots` and commit the updated `tests/snapshots/` with the change.
- A change to a file format needs an old-version sample in `tests/fixtures/formats/` and a test that it still opens.
