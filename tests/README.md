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
| `npx playwright test -g "Tree view"` | tests whose name matches |

After a failure, `npx playwright show-report` opens the report, with a trace for each failed test.

Every test runs offline. Each app is served from a fake origin (`http://local.test/`), every other request is blocked, and a test fails if an app tried to reach the network.

## Snapshots

`tests/snapshots/` holds every sheet's formulas and values for each model in `fixtures/models/` (Inputs tab off and on), plus fmIDE's arrow markup. A test fails on any difference and lists the changed cells, for example `Audit!E5: {"v":100} -> {"v":101}`.

If a change to the output is **deliberate**, regenerate them and commit the new files along with the change:

```
npm run test:update-snapshots
```

Review the snapshot diff before committing: it is the record of what the change did to every workbook.

## Layout

```
0-smoke.spec.js … 12-web-app.spec.js  one file per group in SPEC.md (6 and 7 split per app)
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
