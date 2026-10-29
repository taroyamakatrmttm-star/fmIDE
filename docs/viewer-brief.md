# The showcase viewer: a read-only fmIDE, fmGraph and Excel in one file

Idea G1 in `docs/product-ideas.md` (section 1), grown by the owner on 27 October 2026:

> "I want to make a read-only bear minimum fmIDE, fmGraph, and ExcelExporter for display and educational purposes. bear minimum (or close to none) editing features and maximum UI satisfaction, ease of use for the users. User can see the fmIDE logic, but not edit anything. User can play with fmGraph sliders, scenarios and play feature between scenarios, but not edit sliders, graphs, etc. User can download excel based on small changes users are allowed to make (scenarios). Imagine i have 100 mini-fmIDE model that i want to display per above. Or a complicated fmIDE model and I want to display certain bars, graphs, and sliders that i chose. … I want to automate as much as possible generating it. Perhaps it can be based on fmIDE JSON file and you can help me automate generating such JSON file."

This is the brief, written for the owner's approval and approved on 27 October 2026 (all 11 recommendations, below). It is not in the build order: the owner chose to build fmGraph's Free chart F1 first (`docs/fmgraph-free-chart.md`), then this. **Phases V1 to V5 are built** ("How V1 turned out" to "How V5 turned out", at the end); V6 is not. The viewer is designed so that Free charts can be shown once they exist.

Words used here:

- **Viewer**: the read-only app, and each HTML file made from it for one model.
- **Showcase**: the small description of what a viewer shows (which model, canvases, boards, sliders, scenarios, title). It is a JSON file (JSON, JavaScript Object Notation: the plain text form every fmIDE file uses).
- **Author**: the person who makes a viewer (the owner, or anyone with fmIDE). **Visitor**: the person who opens it.
- **Gallery**: a web page listing many viewers, published with the site.

## The owner's choices (27 October 2026)

1. **Both ways of delivering.** Each model is **one self-contained HTML file**: it can be emailed, opens straight from disk, works offline, and makes no network calls. A tool also builds a **website gallery** of many viewers, published with the site (`npm run deploy`).
2. **A prebuilt workbook.** ExcelExporter makes the workbook **once, when the viewer is made** (its licence: the workbooks people make are theirs). The workbook goes inside the viewer file. On download, the viewer writes the visitor's scenario and slider values into the workbook's input cells: a small patch of the file's zip and XML parts (zip: the packed-files format an `.xlsx` is), written as **new Apache-licensed code**. **ExcelExporter's code is never copied into a viewer**: its licence forbids redistributing it.
3. **What a visitor may do**: look at the logic (pan and zoom the canvases, tap a rectangle for its value and how it is worked out); move sliders within the author's ranges, switch scenarios, Play between two, Reset; keep their changes on that device (with Reset). **Not allowed**: changing which periods are shown, or editing anything.
4. **Timing**: this brief now; fmGraph's Free chart F1 next; then the viewer.

## Why

- **A model is easier to trust when you can play with it.** An investor, a student or a client moves a slider and sees what moves, without installing anything or being able to break the model.
- **Teaching.** A course can hand out 100 small models (a loan, a depreciation schedule, a three-statement model), each one file, each showing its logic and a few sliders.
- **Every shared file advertises fmIDE**, through a small "Made with fmIDE" mark.
- **It reuses what exists**: fmIDE's file format, the shared calculation, fmGraph's boards, sliders, scenarios and Play, and ExcelExporter's Dashboard (step 19), which already turns sliders and scenarios into Excel input cells.

## What a visitor sees

The viewer opens on its **title** and a short description (the author's words), with two views:

1. **Board** (opens first): the bars and charts the author chose, with their sliders. This is fmGraph's board, drawn by fmGraph's own code, with every editing control left out.
   - **Sliders** move within the author's From / to / step. A visitor cannot change the range, add, remove or move a slider.
   - **Scenarios**: a row of buttons, one per scenario the author saved, plus **Base** (the model's own numbers). Tapping one shows it.
   - **Play** between any two of them (Base, a scenario, or "my sliders"), as fmGraph's Play does today, with ■ Stop, and the reduced-motion step for people who turn off animation.
   - **Reset** puts every slider back on the model's own numbers.
   - **Pin as A** and the A/B outlines, and **Trace** (🔍, which sliders reach a bar), are kept: they only read, and they teach. Biggest movers is kept too, if the owner wants it (an open question below).
   - Periods are those the author chose; there is no period chooser.
2. **Logic**: the model's canvases, as fmIDE draws them, but read-only.
   - Pan with a drag (one finger on a phone), zoom with the wheel, pinch or the + / − buttons, **Fit** to show the whole canvas. A list of canvases (tabs, or a menu on a phone) switches between the ones the author shows.
   - **Tapping a rectangle** opens a card: its name, unit, its value in every period (with the sliders as they stand), and **how it is worked out**: the operator and each input it reads, with their values ("Revenue = Price × Volume: 12 × 1,000"). Tapping an input in the card goes to it, on whatever canvas it sits. A rectangle that is an input says so, and names the slider that moves it if there is one.
   - The values on the canvas follow the sliders: moving a slider on the Board and then looking at the Logic shows the moved numbers, with rectangles a slider moved lightly marked.
3. **⬇ Excel**: downloads the workbook, with the visitor's current scenario and slider positions written in. A line under the button says what the file will hold ("Scenario: High price, Price moved to 13").
4. A small **"Made with fmIDE"** mark in a corner (its exact form is the owner's call, below).

What a visitor changed is **kept on that device** (in the browser's storage, keyed to this viewer), so reopening the file shows the same sliders and scenario. **Reset** clears it. Nothing ever leaves the device.

## The showcase file

A showcase says what a viewer shows. It comes in two forms, like fmGraph's board file and its template form.

### For one model: `fmIDE-showcase`, version 1

```json
{ "kind": "fmIDE-showcase", "version": 1,
  "id": "loan-basics",
  "title": "How a loan is repaid",
  "description": "Move the rate and the term and watch the interest.",
  "author": "…", "licence": "CC BY 4.0",
  "mark": true,
  "canvases": { "show": ["c1", "c3"], "start": "c1" },
  "boards": { "kind": "fmIDE-graph-board", "version": 12, "active": 0, "boards": [ … ], "scenarios": [ … ] },
  "play": { "from": "Base", "to": "High rate" },
  "periods": { "mode": "range", "from": 0, "to": 9 },
  "excel": { "file": "Loan basics.xlsx" } }
```

- `boards` is an ordinary `fmIDE-graph-board` file (today version 12; later 13 with the Free chart), read through fmGraph's own `cleanBoards` and the shared upgrades. So whatever fmGraph can show, a viewer can show, and the author arranges it in fmGraph as today. Slider ranges are the board's `min`, `max`, `step`; scenarios are the board file's `scenarios`.
- `canvases.show`: which canvases the Logic view lists (all when absent); `start` the one it opens on. Whether some can be hidden is the owner's call (below), and **hidden never means secret** (see "Security").
- `play`: the two ends Play starts with (the visitor may pick others).
- `periods`: the periods shown, if the author wants fewer than the boards' own. Visitors cannot change them.
- `title` at most 80 characters, `description` 400, `author` 80, `id` letters, digits and dashes, at most 60 (it names the viewer's file and its gallery address, and keys what the browser keeps).
- `mark`: whether "Made with fmIDE" shows (true when absent).
- `excel.file`: the downloaded workbook's file name (cleaned of characters a file name can't hold).
- **The model itself is not in the showcase file**: the showcase sits next to a `.fmide` document (or system file) and names nothing but rectangles and canvases in it. When fmIDE makes a viewer, it keeps the showcase in the document, so making it again after a change remembers every choice. That is a new field, `showcase`, in `fmIDE-workspace` **version 14** (fmIDE keeps it as plain data, as it keeps `graphBoards`, with the same limits). The 13 → 14 upgrade step changes nothing; an old-version sample and its test come with it.

### For many models: the recipe form (`"form": "recipe"`)

```json
{ "kind": "fmIDE-showcase", "version": 1, "form": "recipe",
  "title": "{model}",
  "boards": { "kind": "fmIDE-graph-board", "version": 2, "form": "template", … },
  "auto": { "sliders": "inputs", "bars": "outputs", "range": 50 } }
```

- Rectangles are named **by name** (and canvas name), never by id, exactly as the board file's template form (version 2) does, so one recipe fits 100 models built the same way. A rectangle not found in a model is left out of that model's viewer and **listed in the tool's report**, never silently.
- `title` may use `{model}`, the model's file name or document title.
- `auto` (optional) lets the tool **choose for the author** when a model has no boards or the recipe names nothing: `sliders: "inputs"` puts a slider on each input rectangle (by the shared input rule) up to 12, each from (value − `range`%) to (value + `range`%), in 100 steps; `bars: "outputs"` puts a bar on each rectangle that nothing else reads (the model's results), up to 12. The tool's report says what it chose, so the author can turn it into a recipe and adjust.

**Option for the owner**: keep the showcase inside the document (recommended, above) **or** only as a separate file next to it. Inside, one file carries everything and "make it again" is one click; separate, the document format stays as it is. The recipe form is always a separate file.

## Making viewers

### One click in fmIDE

**File → Make showcase viewer…** opens a window:

- the title, description, author and licence (prefilled from the document);
- which canvases the Logic view shows (tick boxes, all ticked), and which it opens on;
- which boards (the document's fmGraph boards, `graphBoards`; if there are none, **Open fmGraph to make one**, or **Choose for me**, the `auto` choice above);
- the Play ends, the mark, and **Include an Excel workbook** (ticked).

**Make viewer** then:

1. builds the showcase from these choices and keeps it in the document (`showcase`);
2. if Excel is ticked, opens ExcelExporter in its window as **File → Open ExcelExporter** does today, and asks it for **a workbook for a viewer** (below); its answer is the workbook's bytes and its **cell map**;
3. writes the viewer file, `<id>.html`, by putting the showcase, the model and the workbook into the viewer's page (below), and downloads it.

**Where fmIDE gets the viewer's page from** is the owner's call:

- **A. Inside fmIDE, packed (recommended).** The build packs the viewer's page (compressed, about a third of its size) into fmIDE's file, and fmIDE unpacks it with the browser's own `DecompressionStream`. Works offline, from disk, with nothing loaded. Costs fmIDE's file about 200 KB (it is 1.35 MB today).
- **B. The visitor's page makes itself.** fmIDE asks the person to open `fmViewer.html` once, which then takes the showcase and writes a copy of itself. Keeps fmIDE smaller, but is one more step every time.
- **C. Read from the site** (`/fmViewer.html`, same site only). Works only on the published site, not from disk, and widens decision 6, which today allows only `/library`. Not recommended.

### Many at once: `tools/make-viewers.js`

```
npm run make-viewers -- --recipe loans.recipe.json --out out/viewers models/*.fmide
```

For each model the tool:

1. reads it through the shared readers (`readFmData`, the shared upgrades);
2. applies the recipe (or the model's own `showcase`, or `auto`), and notes every rectangle not found;
3. makes the workbook by **driving ExcelExporter itself, unchanged, in a browser without a window** (Playwright with Chromium, the test tooling already on the owner's computer, as `tools/bench-calc.js` and `tools/record-tutorials.js` do): it opens `apps/ExcelExporter.html`, hands it the model as fmIDE would, and asks for a workbook for a viewer. This is using ExcelExporter, exactly as a person does; only the workbook it writes, which is the author's, goes into the viewer;
4. writes `<id>.html` from the built viewer page (`apps/fmViewer.html`);
5. writes `report.json` and a readable `report.txt`: each model, what was shown, what was left out and why, the file size.

`--no-excel` skips step 3 (fast, and works without a browser). `--gallery DIR` also writes the gallery (below). The tool runs on the owner's computer, never in a visitor's browser and never on the site's server.

### ExcelExporter's part: "a workbook for a viewer"

ExcelExporter gains one request, in its own (proprietary) code, through the same window messages fmIDE uses today and, for the tool, a page global:

- it takes the model with the showcase's boards and does **Use fmGraph boards…** on them by itself (the sliders onto the Dashboard, the scenarios as Global Cases, the bars and charts as Excel charts, step 19), on top of the document's own Excel layout (`excelLayout`) or the default one;
- it generates the workbook as **⬇ Generate .xlsx** does;
- it answers with the bytes and a **cell map**: for each slider (named as the board names it), the Dashboard's *Typed* cell and, for a set slider, its *Use* cell; the Global Case cell and the number of each scenario's case; and the sheet names. For example:

  ```json
  { "case": { "sheet": "Scenarios", "cell": "D4" }, "cases": { "Base": 1, "High rate": 2 },
    "sliders": [ { "key": "c1/rate/set/all", "typed": { "sheet": "Dashboard", "cell": "F5" }, "use": { "sheet": "Dashboard", "cell": "J5" } } ] }
  ```

What the cell map holds is a documented format (in `docs/file-formats.md`, CC BY 4.0), so the viewer's Apache code reads it without knowing anything of ExcelExporter.

**Option for the owner**: the cell map as data beside the workbook (recommended: simple, and nothing in the workbook changes) **or** as *defined names* inside the workbook (names such as `fmViewer_rate_typed`, which Excel shows in its Name Manager). Defined names would make the workbook describe itself, useful to people later, but ExcelExporter's writer has no defined names today.

## How the download works: the patch

When the visitor presses **⬇ Excel**:

1. **The values to write.** If the visitor's state is exactly a scenario (or Base), the patch writes only the **Global Case** cell: the workbook opens on that case, as the author made it, and the Scenarios tab says which. Otherwise it writes Global Case = Base, and each moved slider into its **Typed** cell (and TRUE in **Use** for a set slider). This is exactly how step 19 made the Dashboard agree with fmGraph (checked in LibreOffice within a millionth, group 77), so the downloaded workbook shows the visitor's numbers. Writing a shift slider on top of a scenario that already shifts the same input would count it twice, which is why a mix of scenario and sliders goes onto Base.
2. **The patch.** The workbook is a zip of XML parts. ExcelExporter's writer stores them without compression, and sets *recalculate on open* (`fullCalcOnLoad`), so Excel works every formula out again when the file opens. The patch reads the zip, finds each named sheet's part through `workbook.xml` and its relationships, replaces each named cell's `<c>` element with a number or TRUE / FALSE (nothing else is ever written), and writes the zip again with new checksums (CRC, the zip's check of each part). No formulas are touched.
3. **New code, Apache-licensed, in `src/shared/xlsx-patch.js`**: a small zip reader (stored, and deflated through `DecompressionStream`, with size limits against a "zip bomb", a tiny file that unpacks to gigabytes), the cell replacement, and a zip writer. Written fresh: **nothing is copied** from ExcelExporter's writer or its import's zip reader (`src/excel-exporter/import/zip.js`), which are ExcelExporter's.
4. The file downloads (on an iPad or iPhone, through the share sheet, as fmGraph's ⇪ Share does with `shareFiles`). Its name is `excel.file`, with the scenario's name added.

What the visitor gets is the author's workbook with a few input cells changed. The Dashboard's scroll bars stay where the author's workbook had them; the typed cell wins (`IF(ISNUMBER(Typed), …)`), so the numbers are right in desktop Excel, on the iPad, in LibreOffice and in Google Sheets. The visitor can go on changing inputs in Excel.

## How the viewer is built

A **new app**, `src/viewer/` → `apps/fmViewer.html`, under the **Apache licence** like fmGraph. It is made only from fmGraph's code, `src/shared/` and new code. **No ExcelExporter code, ever** (decision 10's "no code moves" kept).

- **The page**: `src/viewer/index.html`, `styles.css`, `js/`. Its own look: large touch targets, few words, one screen per view. It uses the build's includes (`// build:include fmgraph/js/…`, which take any path under `src/`).
- **The calculation**: the shared one (`compileModel`, `evaluateModel` in `src/shared/ir.js`), through fmGraph's `02-model.js` and `03-calc.js` (sliders laid over inputs, results kept per set of slider values).
- **The Board**: fmGraph's board reading (`cleanBoards`), charts and their figures (`04b-charts.js`), scale and colours (`04d`, `04e`), drawing (`05-render.js`, `05b-chart-render.js`), scenarios shown (`05f`), A/B and gliding (`05e`), Play (`05m`) and the phone's dock and mixer (`05g`, `05h`).
  - fmGraph's fragments mix drawing and editing today. **The first viewer phase separates them**: the editing parts (Edit chart, + Chart, Range and step, colour boxes, drag handles, undo, scenario saving) move into their own fragments, which fmGraph keeps and the viewer leaves out. fmGraph behaves exactly as before, proven by its own test groups. The viewer then includes the drawing fragments only, and anything that would edit is simply absent, not hidden.
  - **Option for the owner**: this separation (recommended) **or** fmGraph itself in a "showcase mode" that hides its editing controls (as its library trial mode, `trying`, already hides some). Showcase mode is quicker to build, but each viewer then carries all of fmGraph (about 690 KB) with its editing controls present but hidden, and its page is fmGraph's, not one designed for visitors.
  - **Free charts** (F1) arrive in `04b-charts.js` and `05b-chart-render.js` as one more layout. The viewer shows them as soon as they are built, with no viewer change beyond allowing the board file's next version.
- **The Logic view**: a new shared drawing, **`src/shared/canvas-view.js`**, which draws one canvas of a system file as SVG (Scalable Vector Graphics, the browser's drawing format): rectangles with name, value and unit, operators with their symbol, aliases, period shifts, block instances and function nodes as boxes with their ports, and the arrows. fmIDE's own `render()` (`src/fmide/js/07-rendering.js`) can't be reused: it builds fmIDE's editing buttons (plug, format, period, curve) into every rectangle and depends on fmIDE's editing state. The new drawing follows fmIDE's look:
  - positions and sizes from the file (`x`, `y`, `w`, `h`, forced to numbers);
  - the canvas format roles' look (fill, border, font) through `src/shared/format-roles.js`, every colour through `safeColor`;
  - arrows with the same geometry as fmIDE's (`borderPoint`, `edgePath`, which move into the shared file so fmIDE and the viewer draw them alike; fmIDE's tests prove it unchanged);
  - values from the shared calculation's results, formatted with fmIDE's number formats.
  - "How it is worked out" comes from the compiled model (the inputs of each rectangle, as fmGraph's Trace already follows them, `model.reach`), shown as text.
  - Later, fmIDE could use the same drawing for a print view or thumbnails; not part of this work.

### What the made file holds

`<id>.html` is `apps/fmViewer.html` with three data blocks filled in:

- `<script type="application/json" id="showcase">` the showcase;
- `<script type="application/json" id="model">` the model (the system file, or the workspace with the boards);
- `<script type="application/octet-stream" id="workbook">` the workbook, compressed and in base64 (letters and digits standing for bytes), and the cell map.

These blocks are **data, never run** (the browser does not run a script whose type is not JavaScript, and the site's security policy allows only the viewer's own code). Every `<` inside them is written as `<`, so nothing in a model can close the block early.

**Sizes**: the viewer page itself about 350–450 KB, plus the model (a small model 20–100 KB) and the workbook (compressed, typically 30–300 KB). A small model's viewer is under 1 MB; a large model's a few MB, still fine to email.

## Phones and iPads

- **Phone** (the shared `isPhoneScreen()`): the two views as tabs at the bottom (**Board**, **Logic**), ⬇ Excel in the top bar. The Board uses fmGraph's phone layout: the slider dock, holding a bar for its quick look, the mixer when the phone is turned sideways. The Logic view pans with one finger and pinches to zoom; a tap opens the rectangle's card from the bottom of the screen.
- **iPad**: the full layout, Board and Logic side by side when the screen is wide enough, touch everywhere through the shared pointer input (`src/shared/pointer-input.js`, `pressDefault`, never `preventDefault`, per `.claude/rules/pointer-input.md`). The download goes through the share sheet.
- Reduced motion is honoured (Play's still view, no gliding).

## The gallery: `tools/build-gallery.js`

- From a folder of made viewers (and their `report.json`), it writes `site/gallery/index.html`: plain HTML with **no JavaScript**, one card per viewer (title, description, author, licence, file size, **Open** and **Download**), every text through `escapeXml`, every link from the viewer's `id` only. Each viewer is served at `/gallery/<id>.html`, and can be downloaded to keep offline.
- Optionally a small picture per card, taken by the tool from the viewer's Board (Playwright's screenshot) at make time.
- The site's build adds it after the app's version and offline list, as it adds `/library` and `/help`, with its own security policy (`_headers`): the gallery page runs no scripts; each viewer page may run only the viewer's own code (one hash, the same for every viewer, since only the data blocks differ) and connect to nothing.
- **Where the gallery's models live** is the owner's call (below): a folder outside the repository given to `npm run deploy`, or a repository of its own included as a submodule, like the library.

## Security

- **Every text from a file is shown as text** (`textContent`, or `escapeXml` when building markup), per `CLAUDE.md`'s first rule: names, values, units, titles, descriptions, author, canvas names, scenario names, the gallery's cards. Numbers are forced to numbers, coordinates checked, colours through `safeColor`. Nothing from a file is ever run as code.
- The showcase, the model and the cell map are read through checked readers with limits (sizes, counts, depth), like every other fmIDE file. A cell map can only name a sheet that exists and a cell written as letters and digits (`A1` to `XFD1048576`); the patch only ever writes a number or TRUE / FALSE.
- The zip reader has size limits, so a crafted workbook cannot exhaust the visitor's memory.
- The viewer makes **no network calls at all**, from disk or from the gallery. Its "Made with fmIDE" mark, if it is a link, is a plain link the visitor may click; nothing is loaded.

### Hiding is not secrecy

**Anything in a shared viewer can be read by someone determined.** The model must be inside the file for the sliders to work, so every canvas, every number, every formula and the whole workbook are in it, whatever the Logic view shows. Hiding a canvas, a rectangle or a scenario only keeps it off the screen. **If a model must stay confidential, don't share it as a viewer.** The window that makes a viewer says so in one line, and so does the help topic.

## Licences

- **The viewer app** (`src/viewer/`, `apps/fmViewer.html`) is **Apache 2.0**, like fmGraph and `src/shared/`; its help text CC BY 4.0 in `src/help/`, like fmGraph's. `LICENSING.md` gets a row for it.
- **A made viewer file** holds the Apache viewer code (with its licence notice, the comment at the top of the page, kept by the maker) plus **the author's own model and workbook**, which are the author's (ExcelExporter's licence: "the workbooks you make are yours"). The showcase's `licence` field lets the author say how visitors may reuse the model (for example CC BY 4.0, like library packs); the viewer shows it beside the mark.
- **ExcelExporter's code never enters a viewer**: it is used (in its own window, or driven by the tool on the author's computer) and only its output is kept. The patch is new code.
- The showcase format is documented in `docs/file-formats.md` (CC BY 4.0), so other tools may write showcases.
- The name "fmIDE" in the mark is not licensed by any of the above (`LICENSING.md`).

## What changes where

| Place | Change |
|---|---|
| **New app** `src/viewer/` → `apps/fmViewer.html` | The page, the Board (fmGraph's drawing fragments), the Logic view, ⬇ Excel, remembered state, the phone layout, Help (a short topic list), `window.fmViewer` for tests (state, `setSlider`, `showScenario`, `play`, `value`, `excelBytes`). |
| **fmGraph** `src/fmgraph/js/` | V2: editing code moved into fragments of its own; no change in behaviour. |
| **Shared** `src/shared/` | `canvas-view.js` (the read-only canvas), `borderPoint` / `edgePath` moved in from fmIDE, `xlsx-patch.js` (the patch), `showcase.js` (reading and checking a showcase and the cell map; the recipe applied by name). |
| **fmIDE** | File → Make showcase viewer… (its Help sentence, its window's "?", a ribbon place through a `ui.…Added` flag), the packed viewer page, `showcase` in the workspace (version 14). |
| **ExcelExporter** (its own code) | "A workbook for a viewer": Use fmGraph boards… applied by itself, Generate, the cell map; one new message and a page global for the tool. |
| **Build** `tools/build.js` | The new app; the viewer page packed into fmIDE (option A); the gallery's place in the site. |
| **Tools** | `tools/make-viewers.js`, `tools/build-gallery.js`, both in `tools/test-impact.js`'s map. |
| **Docs** | `docs/file-formats.md` (the showcase, the recipe, the cell map, workspace 14), `docs/architecture/storage.md` (the viewer's remembered state), `LICENSING.md`, `README.md`, `CHANGELOG.md`, What's new, a manual lesson. |

## Phases, one pull request each

| Phase | Holds | Size |
|---|---|---|
| **V1** | **The Logic view on its own**: `src/shared/canvas-view.js` (with `borderPoint` / `edgePath` moved, fmIDE unchanged), the new app with only the Logic view, reading a showcase and model given as files (dropped, or the data blocks), pan, zoom, pinch, the rectangle card with "how it is worked out", `fmIDE-showcase` version 1 and its reader. | Medium |
| **V2** | **The Board**: fmGraph's editing code separated (fmGraph unchanged, proven by its groups), the viewer's Board with sliders, scenarios, Play, Reset, A/B and Trace, the Logic view's values following the sliders, the state kept on the device. | Medium to large |
| **V3** | **Making one in fmIDE, without Excel**: File → Make showcase viewer…, the packed viewer page, the data blocks written safely, workspace version 14, help. | Medium |
| **V4** | **Excel**: ExcelExporter's "workbook for a viewer" and cell map, `src/shared/xlsx-patch.js`, ⬇ Excel in the viewer, the check in Excel on Windows and the iPad by the owner. | Medium |
| **V5** | **Many at once**: `tools/make-viewers.js`, the recipe form, `auto`, the report, ExcelExporter driven by the tool. | Medium |
| **V6** | **The gallery and finishing**: `tools/build-gallery.js`, the site's `/gallery` and its policy, the phone and iPad pass, the manual lesson, `README.md`, What's new. | Medium |

V1 already gives something to look at; after V3 the owner can email a playable model; after V4 it carries Excel; V5 and V6 are the 100 models and the gallery.

## Tests

The coordinator assigns the numbers ("group NN").

- **Group NN, the viewer** (Playwright, the page opened from disk): every network request refused and none tried; the Logic view draws each kind of node, pans, zooms, and its rectangle card shows the same value as fmGraph's `value` for the same sliders; "how it is worked out" names the right inputs; sliders stop at the author's range; scenarios, Play, Reset, A/B; no editing control exists in the page; the state comes back after a reload and Reset clears it; the phone layout (as group 68 does for fmGraph); reduced motion.
- **Group NN, the patch** (Node, like group 65): a workbook from the sample model patched for Base, a scenario, and a mix of scenario and sliders; the zip well formed, checksums right, only the named cells changed; LibreOffice recalculating the patched workbook agrees with the viewer's numbers within a millionth (required on CI, as group 77's checks are); a crafted zip and a bad cell map refused.
- **Group NN, making viewers** (Node and Playwright): `make-viewers` over sample models in `tests/fixtures/` (new ones alongside), a recipe matching by name, rectangles not found reported, `auto`'s choices, `--no-excel`; the gallery's page escaped (names with markup shown as text), its links only from ids, its policy.
- **File formats** (group 6): the showcase and recipe readers with bad and hostile values (markup in names, numbers as text, unknown canvases, oversized lists); workspace version 13 sample opens in fmIDE after version 14 lands.
- **Existing groups that must stay green**: fmGraph's (50–58, 73, 76, 82) after V2's separation; fmIDE's canvas drawing (group 0 and the rendering groups) after the arrows' geometry moves; group 77 for ExcelExporter's viewer workbook; group 64 (shared files importing what they use); group 31 (the new command's Help sentence); group 74 (the test-impact map knows the new files).

## What stays the same

- fmIDE, fmGraph and ExcelExporter keep working as today; a viewer never changes a model or a file.
- Nothing is sent anywhere. The apps keep working offline from disk.
- No code moves between ExcelExporter and the open part.
- Every older file opens.

## Open questions for the owner

**Decided 27 October 2026:** the owner accepted every recommendation below ("Yes: accept all 11 recommendations in the viewer brief.").

1. **The mark**: "Made with fmIDE" as plain text, or a link to the site? (Recommended: a link the visitor may click, nothing loaded; and only after the owner's name is out of the public places, `docs/decisions.md`, "Before sharing the project". Until then, text only.) May an author turn it off? (Recommended: yes, `mark: false`, as a courtesy for teaching material.)
2. **The app's name**: fmViewer, fmShow or fmShowcase? (Recommended: **fmShowcase** for the app, "viewer" for the file people open: it says what it is for.)
3. **Is the gallery public**, on the live site for everyone, or a page only the owner links to? (Recommended: public, it is the advert; but only models the owner chose to publish, listed in the gallery folder.)
4. **Can some canvases be hidden?** (Recommended: yes, with the "hiding is not secrecy" line in the maker's window.)
5. **Where fmIDE gets the viewer page** (A packed inside fmIDE, B the page copies itself, C from the site). (Recommended: A.)
6. **fmGraph's editing separated, or a showcase mode in fmGraph?** (Recommended: separated, for a smaller, cleaner viewer.)
7. **The showcase kept in the document** (workspace 14) or only as a separate file? (Recommended: in the document, plus the separate recipe form for batches.)
8. **The cell map as data, or defined names in the workbook?** (Recommended: as data.)
9. **Biggest movers and Trace in the viewer?** (Recommended: Trace yes, it teaches; Biggest movers yes, folded away.)
10. **Where the gallery's models live**: a folder given to `npm run deploy`, or their own repository as a submodule? (Recommended: a repository of their own, like the library, so the site's build is repeatable.)
11. **A tutorial** for making a viewer in fmIDE, or help only? (Recommended: help only at first.)

## Risks

- **Separating fmGraph's editing code** (V2) touches most of fmGraph's files. It is moved with no change in behaviour, proven by fmGraph's tests, before the viewer uses it.
- **Two drawings of a canvas** (fmIDE's and the viewer's) could drift apart in look. The shared arrow geometry and format roles keep the important parts alike; the viewer's group compares positions with fmIDE's for the sample models.
- **ExcelExporter driven headlessly** depends on its page and its new global staying stable; the tool's tests cover it, and a failure leaves the viewer without Excel (`--no-excel`) rather than stopping the batch.
- **Large models** make large files, and the shared calculation runs in the visitor's browser: fmGraph's work-ahead for slow models (`SLOW_MS`, `workOutAhead`) is kept, and the tool's report shows each file's size and calculation time.
- **Browser storage from disk**: some browsers give every file opened from disk the same storage, or none at all. The viewer keys what it keeps by its `id` and a hash of its showcase, and works without storage (just not remembering).

## How V1 turned out (27 October 2026, branch `claude/viewer-v1`)

The owner approved the V1 plan with every recommendation, including choice 4 after more explanation: **the canvas shows the numbers of one fixed period**, the first the showcase names, and a rectangle's card shows every period shown (no period stepper). The period is a single value passed to the drawing, so showing another later is a small change.

- **Built**: the app `src/viewer/` → `apps/fmViewer.html` ("fmShowcase" on screen; about 230 KB), with only the Logic view: canvas tabs (a ☰ menu on a phone), pan, the wheel, + / −, Fit, a pinch, a tap opening a rectangle's card (its value in each period shown, how it is worked out with names and with values, the inputs it reads, going to them on their canvas, "on a canvas not shown here"), the title, description, author, licence and the "Made with fmIDE" mark as plain text. It opens a model and a showcase dropped or chosen, or carried in the page's two data blocks (a viewer made for one model; writing them is V3). It is on the site at `/fmViewer.html`, unlinked, under its own policy.
- **Shared code**: `src/shared/canvas-view.js` / `.css` (the read-only drawing, in parts that run in Node), `src/shared/showcase.js` (the format, both forms). Two small files rather than one (the owner's choice 3): `src/shared/canvas-geometry.js` and `src/shared/number-format.js`, moved out of fmIDE word for word — `rectOf`, `borderPoint`, `edgePath`, the port nodes' sizes; `formatNum`, the number formats, `shiftLabel` — so fmIDE carries only what it uses. A test written first pins fmIDE's drawing (group 7-ui-fmide, "every kind of node and arrow keeps its place, size and value text"), green before and after the move.
- **Differs from the brief**: the viewer draws the canvases as the calculation sees them (the shared IR's own copy), so plug-to-socket arrows and their automatic aliases are where fmIDE puts them even when a file doesn't carry them. The plain words for the calculation's error codes are the viewer's own (fmGraph's are inside fmGraph's code, which V1 doesn't take in yet; V2 can share them).
- **Measured**: every box and arrow end equals fmIDE's for the sample with every kind of node (within a pixel; group 91), every value equals fmIDE's in every period. Group 91 takes about 18 s, the format tests 0.1 s (both written into `tests/test-durations.json`).
- **Not verified**: the viewer on a real iPad or phone (only Chromium's phone emulation in group 91), and in Safari or Firefox.
## How V2 turned out (28 October 2026, branch `claude/viewer-v2`)

The owner approved the V2 plan with all 13 recommendations, each (a). Four commits: group 92 first, the shared error words, the split, the viewer's Board.

- **fmGraph's board engine**: fmGraph's fragments are split into the engine (18 fragments: reading boards with the board file's upgrades, the calculation with sliders, every figure and drawing, scenarios, Play's motion, A/B, Trace's reach, Biggest movers, the sample) and, beside each, an `-edit` fragment with what was fmGraph's page and editing in it. Moved word for word by a script, with a few small changes where drawing called editing: a key's swatch (`rectKeySwatch` / `chartKeySwatch`), `freeGridHook`, and the rest of a short **page interface** each app defines (`.claude/rules/fmgraph.md`). `fmGraph.chart`'s answer moved into the engine (`chartAnswer`), so both apps answer alike. The drawing's styles are `src/fmgraph/board.css`. **fmGraph unchanged**: group 92's snapshots of its page (five states on a desk, two on a phone), its commands and its functions were taken first and pass after; every element's computed style was compared before and after (none differs); fmGraph's groups pass.
- **The Board** as the plan has it: Board | Logic tabs (at the bottom on a phone, the sliders in a row above them), board tabs, the scenario buttons (a scenario shown exactly through the engine's `lookingAt`, a slider moved leaving it), sliders kept in range (the shared phone slider; a typed number kept in range by the viewer, nothing shared changed), Play with the showcase's ends, Reset, A/B, Trace, Biggest movers folded; the Logic view following (an input moved ringed — done in the viewer, so `canvas-view.js` gained no ring after all — its card "Moved on the Board, from …"); the state on the device; Help; Try the sample.
- **Differs from the plan**: `canvas-view.js` changed only by renaming its local `cleanText` to `cvText`, which clashed with fmGraph's once both were in the viewer's one scope (a page-breaking error, caught by group 92's new check that the viewer's script declares no name twice). No check was added to group 6-formats-showcase: the reader didn't change; `play`'s "Base" and the periods are the viewer's reading of it, tested in group 93. fmGraph's file grew by 7.4 KB (812 → 819 KB), not about 1 KB: the new fragments' header comments and the page-interface functions.
- **Found**: with reduced motion, fmGraph's Play can lose its lit reach when the Tornado and Spider are worked out after its first paint (in `docs/decisions.md`, known issues). Group 91's file helper read the state before a second file had opened (a race in V1's test, seen once); the viewer's state now counts the models shown (`loads`) and both groups wait for the next.
- **Measured**: `apps/fmViewer.html` 488 KB (229 KB in V1), about 141 KB compressed — what V3 would add to fmIDE when it packs it.
- **Not verified**: the Board on a real iPhone or iPad (only Chromium's phone emulation, group 93), in Safari or Firefox; the state kept on the device when opened from disk in Safari.

## How V3 turned out (28 October 2026, branch `claude/viewer-v3`)

The owner approved the V3 plan with every recommendation (choices 1–10 (a), the icon 🖼, group 94) and added a one-line message for an fmGraph board file opened in fmIDE. Built on V2 in one batch, in two parts: what didn't need V2 first (workspace 14, the messages, the packer, the shared functions), then the rest.

- **Built**: File → Make Showcase Viewer… (the window, the command, its ribbon place, `fm.makeShowcaseViewer`, `fm.showcase`); the viewer packed into fmIDE by the build (`tools/pack.js`); workspace v14 keeping the showcase (`ws-v13` sample); the messages for a showcase file, a board file and a made viewer opened in fmIDE; a document carrying its showcase opening as its viewer in fmShowcase; Help topic `showcase-viewer`, What's new, the manual's Part 8.
- **Differs from the plan**: `fm.makeShowcaseViewer` answers later (it waits for the browser to unpack the page), so, like Browse Library, it is a Promise and not for macros (`macro: false`), rather than a macro step keeping a variable. The window's "no boards" test sits in group 50 and the ribbon test in group 47, beside what they open, so an fmGraph change doesn't run group 94 for them.
- **Found**: `src/shared/showcase.js` sits inside the apps' own scripts, so a closing script tag spelled out in it ended fmIDE's and the viewer's script early (the first build of part 1); it is written `<\/script>`, and group 94 checks every app's closing tags. A cleaned showcase with empty fields, read again, listed problems the viewer would have shown visitors: `showcaseForFile` leaves them out. Group 74's "an fmGraph-only change runs under half the test files" now stands exactly at half (49 of 98: group 94 opens made viewers, which carry fmGraph's engine) — left failing for the owner's choice, not loosened.
- **Measured**: `apps/fmIDE.html` 1.63 MB (1.38 MB before), of which the packed viewer is 225 KB (the viewer's 508 KB at 0.333) and the maker about 20 KB; a made viewer of the every-widget sample 505 KB; the build packs the viewer in about a second.
- **Not verified**: making a viewer on a real iPad or iPhone (the share sheet: only Chromium on a computer, which downloads), in Safari or Firefox; a made viewer opened from an email attachment.

## How V4 turned out (29 October 2026, branch `claude/viewer-v4`)

The owner approved the V4 plan with every choice (a) (V4, V5 and V6 built as one batch with one whole-suite run). Built in two parts: the patch and ExcelExporter's part first, with the owner's check files; then fmIDE's and the viewer's parts, while the owner checks.

- **Built**: ExcelExporter's workbook for a viewer (`09l-viewer-workbook.js`: Use fmGraph boards… applied by itself on a lent copy of the layout — `layoutHeld` keeps `saveMapping` from saving, remembering or sending anything meanwhile — then the layout put back; `fmIDE:viewer-workbook` and `window.fmExcel.viewerWorkbook`); `src/shared/xlsx-patch.js`; the cell map and the `excel` block (kind `fmIDE-viewer-workbook` 1) in `src/shared/showcase.js`, with `excelPatchPlan`; Make Showcase Viewer…'s Include an Excel workbook; the viewer's ⬇ Excel and its line; Help in all three apps, What's new, lesson 8.2.
- **The licences** as planned: the workbook is ExcelExporter's output, carried as data; the patch is new Apache code (group 95 finds no line of 30 characters or more it shares with ExcelExporter's writer or import — one line written alike by chance was found by that check and rewritten); group 96 checks no Apache source takes in an ExcelExporter file and the built viewer and fmIDE carry none of its code.
- **Differs from the plan**: the cell map's scenarios are matched by name (as ExcelExporter names them), not by place. The licence checks on the built pages and the Apache sources sit in group 96, not 95: read in 95, a change to fmGraph's board engine would have run 95 too and put group 74's "an fmGraph-only change runs at most half" over (it stands at exactly half, 50 of 100). The viewer reads its block through `dataBlock('excel')`, so a made viewer opened as a file (branch `claude/viewer-ipad-sliders`) gets its Excel too, and only for the model the block came with. Without LibreOffice on this computer, the patched workbooks' numbers are checked locally by working them out from their formulas with the import's own `xlRecalc` (read through the import's own zip reader); LibreOffice's check is in group 96 for a computer that has it.
- **Measured**: the every-widget sample's workbook 193 KB, 20 KB packed, 26 KB in the block; `apps/fmViewer.html` 548 KB (508 KB before), `apps/fmIDE.html` 1.67 MB (1.63 MB; the packed viewer and the maker), `apps/ExcelExporter.html` 1.05 MB (1.04 MB).
- **Not verified**: Excel itself — the owner's check on Windows and the iPad (`tests/output/v4-check/`, `checklist.txt`) is pending; LibreOffice's agreement (not installed here); the share sheet on a real iPhone or iPad.
## After V3: opening a viewer on an iPhone or iPad, and shorter sliders (29 October 2026, branch `claude/viewer-ipad-sliders`)

Two fixes the owner asked for after trying V3 on an iPad, outside the phases.

- **Opening on an iPhone or iPad** (approved by the owner): a viewer saved in Files opens there only in a preview, which runs no script, so it couldn't be used. The viewer's Open… / Choose now takes a made viewer's `.html` too (`accept` gains `.html,.htm`; `02-files.js`: `looksLikeHtml`, `readMadeViewerText`, `openMadeViewer`). The page is parsed by `DOMParser` into an inert document (no script runs, nothing is fetched, nothing of it enters the page); only the `showcase`, `model` and — for V4 — `excel` blocks are read, each a `<script type="application/json">` at most once, and their text goes through `parseFileText` like any file. Then it opens exactly as the made viewer does (`startFromPage`, its blocks through `dataBlock`, which reads `openedBlocks` once a file has given them). A page that isn't a made viewer, or the bare viewer, gets a plain message. The way to open one — in Safari, https://fmide.pages.dev/fmViewer, Choose, the file — is said in fmIDE's window (`.sm-ipad`, on a touch screen), its `showcase-viewer` topic, What's new, the viewer's Help (`open-ipad`) and lesson 8.1. On a touch screen the drop box says **Choose** (`.choose-words`, `pointer: coarse`).
- **Shorter sliders** (the owner's words: "sliders are too tall … ideally name and slider in the same row"): each slider is one row, 42 pixels tall (183 before) — the name (36 %, its periods and unit after it, shrinking first), the track (36 pixels tall, `--ps-pad` 14) and the number (36 pixels, typing as before); − and + are left out (the keys, typing and a double tap stay); the "model's own" words are kept for a screen reader and as the row's tooltip. All in `board-view.css`, under `.slider-widget`: the shared phone slider and fmGraph are unchanged (group 92 green, its snapshots untouched).
- **The list scrolls on its own**: from 821 pixels wide (a computer, an iPad held sideways) the Board fills the window and its two sides scroll apart, the sliders' list inside the side (at least 140 pixels); on a phone (above its Board / Logic tabs), a narrower window or an iPad held upright, the bars and charts come first and the list sits at the foot of the screen, at most a third of its height. A finger swiping the list scrolls it, even from a track (`touch-action: pan-y` on the viewer's tracks); the browser then cancels the pointer, and `keepThroughSwipe` (`06-board.js`) puts back whatever the swipe moved before that — the slider's number, or the scenario shown. The fine control by moving the finger up (fmGraph's) gives way to the scroll in the viewer's list; typing gives an exact number.
- **Found**: opening a second model in the same bare viewer while the Board is shown leaves `fmViewer.state().canvas` and `layout()` on the first model's canvas until the Logic view is shown (from V2; not changed here — the tests open each in a fresh page).
- **Not verified**: a real iPhone or iPad (Safari's file chooser and Files, the scroll and swipe feel); only Chromium, with touch through the DevTools Protocol.

## How V5 turned out (29 October 2026, branch `claude/viewer-v5`)

The owner approved the V5 and V6 plan with every recommendation (V5 choices 1–8 (a)). Built on `claude/viewer-v4` with `claude/viewer-ipad-sliders` merged into it first (its conflicts kept both sides; groups 91, 93, 95 and 96 green on the combination before anything was added).

- **Built**: `tools/make-viewers.js` (`npm run make-viewers -- --out DIR [--recipe R] [--auto] [--no-excel] [--excel-style S] [--write-recipe F] MODELS…`: files, folders or patterns, worked out by the tool since a Windows terminal doesn't expand them; ExcelExporter opened from disk in Chromium without a window, a fresh browser context per model, asked through `window.fmExcel.viewerWorkbook(model, boards, { style, base64 })`) around `tools/viewer-batch.js` (reading each model with the shared readers; the choice per model — a recipe, else the document's showcase, else its boards, else `auto` with `--auto`, else the logic only; the recipe applied by name; ids made unique; the page filled with `fillViewerPage`; the workbook packed by Node's `zlib`; `report.json`, kind `fmIDE-viewer-report` 1, and `report.txt`; `recipeFrom` for `--write-recipe`). The shared `src/shared/showcase-boards.js`: `sbTemplatePlaces` and `sbPlaceTemplateBoard` (the template form placed by name — fmGraph's own template boards, `06d-template-sources.js`, now use it: groups 53 and 54 unchanged), `placeRecipeBoards` (a canvas-template recipe on every canvas made from it; a name unique in the model may leave out its canvas; the document's scenarios kept), `autoShowcaseBoards`. `src/shared/showcase.js`: the recipe's `canvases` (names), `play`, `periods`, `excel` (still version 1, the owner's choice 3), `madeViewerBlocks`. ExcelExporter: `fmExcel`'s `style` (an Excel style lent for one workbook, put back) and `base64`. fmIDE: Make Showcase Viewer…'s **Choose for me** and `fm.showcaseChooseForMe()`; Help, What's new, lesson 8.3.
- **Differs from the plan**: Choose for me is **not an undo step** — fmIDE's undo covers the canvases only, and boards made in fmGraph aren't one either; the board is kept with the document as unsaved changes and changed or removed in fmGraph. `auto`'s results are the calculated rectangles nothing reads **but a period shift**, worked out in every period shown (a closing balance read by next period's opening is a result; a rectangle in error isn't), and it leaves out the canvases used as blocks. The tests of the shared placing and `auto` are in group 97, not 6-formats-showcase (they are Node tests of the batch's work). The boards the batch writes are board file version 8, as the template form's boards always read.
- **Found**: the ⬇ Excel button didn't follow a Play started from `fmViewer.play` or a key until the visitor's next click (group 96's "off while Play runs" failed two runs in three on V4 alone): `renderPlayBar` now refreshes it. Group 91's hostile made viewer counted three script elements; with V4's `excel` block there are four (changed on purpose).
- **Measured**: a small model's viewer (shop-a, two canvases, its workbook packed) **572 KB**; the every-widget sample's 582 KB. **100 models with Excel: 58.4 s and 54.6 MB** on the owner's computer (one browser, a fresh context each, about 0.6 s a model); 10 models 7.2 s; without Excel, 10 models 0.1 s. Group 74's "an fmGraph-only change runs at most half": 50 of 101.
- **Not verified**: the tool on another computer; LibreOffice's agreement for the tool's workbooks (not installed here — the numbers are checked with the import's `xlRecalc`).
