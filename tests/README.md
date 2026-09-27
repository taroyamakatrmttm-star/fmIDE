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
| `npm run test:excel` | Excel output: structure, LibreOffice values, layout, format roles |
| `npm run test:security` | the malicious-file checks, both apps |
| `npm run test:formats` | file formats, both apps |
| `npm run test:ui` | UI flows, both apps |
| `npm run test:snapshots` | formula/value snapshots only |
| `npm run test:web-app` | the installable web app (site build, service worker, offline, updates) |
| `npm run test:agreement` | fmIDE's values against the recalculated workbooks (needs LibreOffice), function calls included |
| `npm run test:ir` | the shared IR: fmIDE's pinned values, errors and units; the IR alone in Node; the operator catalogue; the phase E1 operators in fmIDE through `window.fm` |
| `npm run test:excel-ir` | ExcelExporter on the IR: pinned units, operator spellings, the "differs from fmIDE" panel, function calls written out in full, the Functions tab, Excel's formula limits, the phase E1 operators' formulas |
| `npm run test:functions` | function plugins: the parser, the samples in `fixtures/functions/`, files carrying their definitions |
| `npm run test:functions-fmide` | functions in fmIDE: the library, the Functions manager and editor, the `fmIDE-functions` file, function nodes on the canvas (insert, drawing, wiring, updating, copy and paste), undo, ribbon, macros |
| `npx playwright test -g "Tree view"` | tests whose name matches |

After a failure, `npx playwright show-report` opens the report, with a trace for each failed test.

Every test runs offline. Each app is served from a fake origin (`http://local.test/`), every other request is blocked, and a test fails if an app tried to reach the network.

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
0-smoke.spec.js … 21-functions-fmide.spec.js   one file per group in SPEC.md (6 and 7 split per app)
helpers/apps.js       the offline fixture: serves the apps, blocks and counts other requests
helpers/excel.js      load a model, toggle options, capture the workbook (window.__wb + real .xlsx bytes)
helpers/soffice.js    find LibreOffice, recalculate workbooks, read values
helpers/fmide.js      fmIDE file choosers, dialogs, downloads
helpers/storage.js    read the apps' IndexedDB, make its writes fail, hide the page
helpers/documents.js  fake file pickers (File System Access API) for fmIDE documents
helpers/site.js       builds the installable site and serves it from this machine (group 12)
helpers/snapshot.js   JSON snapshots
fixtures/             sample files (do not edit; add new ones alongside)
snapshots/            generated; update only with the command above
```
