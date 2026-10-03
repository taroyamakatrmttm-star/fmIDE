# Tests

One command runs every check, locally and on GitHub (`.github/workflows/tests.yml`, on every push and pull request). The brief is [`SPEC.md`](SPEC.md). The apps themselves stay dependency-free: everything here is a dev dependency.

## Setup (once)

1. Install **Node.js LTS** (Windows: `winget install OpenJS.NodeJS.LTS`, or the installer from nodejs.org).
2. In the repository folder:
   ```
   npm install
   npx playwright install chromium
   ```
   The second command downloads Playwright's own Chromium (about 150 MB). It doesn't touch your normal browser.
3. Optional: **LibreOffice** (with Calc), for the recalculation tests. Without it those tests are skipped with "skipped: LibreOffice not installed" and everything else still runs. On GitHub it is always installed and required. It is found on `PATH`, in `C:\Program Files\LibreOffice\program\`, or wherever `SOFFICE_PATH` points.

## Running

| Command | What it runs |
|---|---|
| `npm test` | everything |
| `npm run test:excel` | Excel output: structure, LibreOffice values, layout, the Excel style (group 4) |
| `npm run test:security` | the malicious-file checks, both apps |
| `npm run test:formats` | file formats, both apps |
| `npm run test:ui` | UI flows, both apps |
| `npm run test:snapshots` | formula/value snapshots only |
| `npm run test:web-app` | the installable web app (site build, service worker, offline, updates), Open ExcelExporter and ExcelExporter's "← Back to fmIDE" |
| `npm run test:agreement` | fmIDE's values against the recalculated workbooks (needs LibreOffice), function calls included |
| `npm run test:ir` | the shared IR: fmIDE's pinned values, errors and units; the IR alone in Node; the operator catalogue; the phase E1 operators in fmIDE through `window.fm` and on the canvas (drawing, dragging, the ribbon) |
| `npm run test:excel-ir` | ExcelExporter on the IR: pinned units, operator spellings, the "differs from fmIDE" panel, function calls written out in full, the Functions tab, Excel's formula limits, the phase E1 operators' formulas |
| `npm run test:functions` | function plugins: the parser, the samples in `fixtures/functions/`, files carrying their definitions |
| `npm run test:functions-fmide` | functions in fmIDE: the library, the Functions manager and editor, the `fmIDE-functions` file, function nodes on the canvas (insert, drawing, wiring, updating, copy and paste), undo, ribbon, macros |
| `npm run test:library-packs` | library packs (save, preview, open; packs from other people; where items came from and the family-rule warnings) and the size limits on every file opened, both apps |
| `npm run test:pack-checker` | the library's pack checker, `tools/check-pack.js` (mostly in Node; one check against fmIDE) |
| `npm run test:library-checker` | the library's rules: the checker's library mode (`--library`), pull requests, `--write-records`, the Markdown report (Node only) |
| `npm run test:library-catalogue` | the library's catalogue the build writes under `/library` (pages, downloads, `index.json`, escaping, its security policy) |
| `npm run test:library-browse` | browsing the library inside fmIDE (Browse Library…, its checks of the list and packs, offline, the single file, `window.fm`) |
| `npm run test:touch` | fmIDE by finger: real touch input on an emulated touchscreen (drag, arrows, resize, tabs, the curve editor, scrolling; press and hold, the node menu, the selection box, double-tap, larger touch areas; the viewport line, the ribbon's arrows, dialogs at tablet sizes, the on-screen keyboard) |
| `npm run test:placement` | where new nodes go (never on top of others) and the Macro Builder's "Run selected step" moving on |
| `npm run test:windows` | resizable windows (the size kept in your own settings, never taken from a file) and the Templates list as a tree |
| `npm run test:touch-excel` | ExcelExporter's Tree view by finger: the row menu by press and hold, choosing several rows, double-tap to rename; a tap on "← Back to fmIDE" |
| `npm run test:help` | Help (step 10): groups 31 to 35 — the panel, a sentence for every command, topics and their links, search, the Command Launcher, the ribbon's tips, the "?" on windows, Help in the touch menu, ExcelExporter's Help panel, every tutorial played through, practice mode, the welcome card, tablet size, no network, the site's help pages, the tutorial videos' scripts and recording, the panel's width (group 42) and What's new (group 43) |
| `npm run test:videos` | the tutorial videos' scripts and captions, and one real recording (To Excel, about 2 minutes) |
| `npm run test:module-layouts` | ExcelExporter remembering each module's layout (step 11b) |
| `npm run test:template-attachments` | a template's Excel layout carried by fmIDE, packs and the checker (step 11c-1) |
| `npm run test:template-layouts` | ExcelExporter using a template's attached layout (step 11c-2) |
| `npm run test:block-layouts` | block instance tabs remembering their layout, and "Lay out the other instances like this" (step 11d) |
| `npm run test:add-many` | Add Many Rectangles…, `fm.createRects` and the Mod+Enter quick chain (step 12b) |
| `npm run test:equal-spacing` | a dragged node snapping to equal spacing, with gap markers (step 12a) |
| `npm run test:help-width` | the Help panel's width: the reading view, dragging its edge, kept per app (step 10, H5a) |
| `npm run test:whats-new` | What's new in the Help panel: the updates' data, New marks and the dot, the list and an update's page, kept per app (step 10, H5b) |
| `npm run test:zoom` | zoom (step 13a): the wheel, keys, control and menu, Fit, dragging, arrows, the selection box and snapping when zoomed, each canvas's own zoom, never in files or macros; and the pinch (13b) |
| `npm run test:pinch` | pinch to zoom (step 13b): two real fingers zooming around the point between them, moving the canvas, the limits, settling at 100%, a drag cancelled by a second finger, one finger as before, each canvas's zoom, macros |
| `npm run test:excel-from-fmide` | ExcelExporter reading fmIDE's model (group 59): the model arriving when opened from fmIDE, File → ↻ From fmIDE and Open ExcelExporter again, a template's Excel layout coming along, messages from other windows, a hostile name, a broken answer, opened on its own, fmIDE reloaded |
| `npm run test:messages` | long messages (group 60): fmIDE's messages scrolling with OK on the screen, ExcelExporter's list of differences (first three, Show all, ×), the file boxes on an iPad |
| `npm run test:excel-page` | ExcelExporter's page (group 46): the File and Layout menus (mouse, keyboard, finger), Settings, the welcome screen, dropping a file anywhere, Paste JSON, the tabs beside the rows, little text on the page |
| `npm run test:fmgraph` | fmGraph (groups 47–58; 58: the tutorials; 57: the scenario waterfall; 56: named scenarios; 55: Try in fmGraph from Browse Library; 54: templates' boards in fmGraph and Attach to template; 53: boards on templates, with fmIDE and the pack checker; 51: Trace and Biggest movers; 52: the A/B snapshot and gliding bars; 50: boards inside `.fmide` documents, sent between fmGraph and fmIDE; 48: columns and waterfall charts, their checks, building one with the mouse; 49: boards as tabs, arranging, colours, undo, the board file): its values against fmIDE's for every sample, sliders by mouse, keyboard and finger, the bars a slider reaches, the board remembered, hostile files, the model from fmIDE, the site, a large model, Help |
| `npm run test:help-site` | the site's help pages the build writes under `/help` (pages, links, command names and tabs against fmIDE, escaping, their security policy) |
| `npx playwright test -g "Tree view"` | tests whose name matches |

After a failure, `npx playwright show-report` opens the report, with a trace for each failed test.

Every test runs offline. Each app is served from a fake origin (`http://local.test/`), every other request is blocked, and a test fails if an app tried to reach the network. The site's tests (groups 12, 25, 26, 34) serve a freshly built site from this machine and fail if a page reaches any other address.

## Snapshots

`tests/snapshots/` holds every sheet's formulas and values for each model in `fixtures/models/` (Inputs tab off and on), fmIDE's arrow markup, (`fmide-values--*`) what fmIDE shows for every node of every sample in `fixtures/models/`, `fixtures/agreement/` and `fixtures/ir/`: its value or error message in each period, and its unit, and (`excel-units--*`) the unit column ExcelExporter writes for each of those samples. A test fails on any difference and lists the changed cells, for example `Audit!E5: {"v":100} -> {"v":101}`.

If a change to the output is **deliberate**, regenerate them and commit the new files along with the change:

```
npm run test:update-snapshots
```

Review the snapshot diff before committing: it is the record of what the change did to every workbook.

## Timing the calculation

`npm run bench` (`tools/bench-calc.js`) times fmIDE's calculation (`fm.evaluate`) and ExcelExporter's Generate (the whole workbook, zipped, without the download; loading the file is timed too) on the biggest sample model and on a large generated model (about 1,900 nodes on 21 canvases, 24 periods; `BENCH_PERIODS=12 npm run bench` changes the periods). It is not a test: timings vary between machines, so compare runs made on the same one, before and after a change to the calculation or the formula writer.

## Layout

```
0-smoke.spec.js … 35-video-scripts.spec.js one file per group in SPEC.md (6 and 7 split per app)
helpers/apps.js       the offline fixture: serves the apps, blocks and counts other requests
helpers/excel.js      load a model, toggle options, capture the workbook (window.__wb + real .xlsx bytes)
helpers/soffice.js    find LibreOffice, recalculate workbooks, read values
helpers/fmide.js      fmIDE file choosers, dialogs, downloads
helpers/storage.js    read the apps' IndexedDB, make its writes fail, hide the page
helpers/documents.js  fake file pickers (File System Access API) for fmIDE documents
helpers/touch.js      a finger: real touch input through the Chrome DevTools Protocol (group 30)
helpers/tutorial-actions.js  what a person does at each tutorial step (group 33, and the video recorder at its own pace)
helpers/site.js       builds the installable site and serves it from this machine (groups 12, 25, 26; without the
                      library/ submodule unless a test passes a library folder)
helpers/snapshot.js   JSON snapshots
fixtures/             sample files (do not edit; add new ones alongside)
snapshots/            generated; update only with the command above
```
