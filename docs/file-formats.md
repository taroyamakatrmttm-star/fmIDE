# File formats

Every JSON file the apps write carries a `kind` and a `version`. Every file they read goes through one reader — `readFmFile()` in fmIDE, `readKnownFile()` in ExcelExporter — which:

1. identifies the kind (older files without `kind` are recognised by their shape, e.g. a bare macro list);
2. rejects the wrong kind of file with a message saying what it is and where to open it;
3. upgrades older versions one step at a time (`FILE_MIGRATIONS`);
4. asks once, up front, before opening a file saved by a **newer** version (cancel, or open anyway);
5. does the same for nested content: a workspace's system, each template's model.

The part both apps share lives once in `src/shared/file-formats.js`: the versions and upgrade steps of the two kinds both apps read (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS` for `system` and `fmIDE-workspace`), kind inference (`inferFileKind`) and the version check with step-by-step upgrades (`upgradeFileData`). Each app's `FILE_FORMATS` / `FILE_MIGRATIONS` are built from those plus its own kinds; the messages and nested-content handling stay in each app's reader.

**A node's size** (`w`, `h`): a node in a system or module file that has no size, or one that isn't a positive number, is given the size a new node of its type gets in fmIDE (rectangles and aliases 170 × 64, operators 56 × 56 — wider for word operators, period shifts 56 × 56, block instances and function nodes 190 × 80, whose height fmIDE then fits to their ports). A number written as text (`"200"`) is read as that number. Nothing in the calculation reads a node's size. Older files are unaffected, and no version changed.

## Documents (`.fmide`)

A `.fmide` file is an `fmIDE-workspace` file (same `kind`, same version, same reader) saved with the `.fmide` extension by fmIDE's **File → Save / Save As**. There is no separate format. Opening one with **File → Open…** loads the model and its format presets/roles, adds its templates and macros when not already there, and ignores its shortcuts and ribbon/KeyTips settings. **Import Workspace** of the same file replaces everything, as before. The workspace's `ui` part may carry `documentGroupAdded: true` (a customised ribbon already got the Document group once); older readers ignore it.

## Current versions

| `kind` | Version | What it is | Opened with |
|---|---|---|---|
| `system` | 9 | A whole model (all canvases, periods); v4: a canvas may remember the canvas template it came from; v5: the function definitions its function nodes use; v6: the operators of phase E1 (below); v7: no Excel-only format settings (step 11a, below); v8: the operators of phase E2a (below); v9: `choose` (phase E2b, below) | fmIDE: File → Load System · ExcelExporter |
| `module` | 7 | One canvas; v3: the function definitions it uses; v4: the operators of phase E1; v5: no Excel-only format settings; v6: the operators of phase E2a; v7: `choose` | fmIDE: File → Load Module |
| `fmIDE-workspace` | 12 | Everything: system + templates, format presets, shortcuts, macros; v4: the function library; v5: its system and templates may use the operators of phase E1; v6: its templates and library functions may say which library pack they came from (`origin`, below); v7: no Excel-only format roles or settings; v8: its templates may carry `attachments` (below); v9: its system and templates may use the operators of phase E2a; v10: `choose`; v11: `graphBoards`, the model's fmGraph boards (below); v12: its templates — canvas and system — may carry an fmGraph board (`attachments.graph`, below). A **`.fmide` document** is exactly this, with the `.fmide` extension | fmIDE: File → Open… (a document) or Import Workspace (a full replace) · ExcelExporter |
| `fmIDE-templates` | 10 | Saved templates (each holds a module, a system or a recipe), with their families and versions; v4: a template's model may carry function definitions; v5: it may use the operators of phase E1; v6: a template may carry `origin`; v7: a canvas template may carry `attachments` (below); v8: it may use the operators of phase E2a; v9: `choose`; v10: a canvas or system template may carry an fmGraph board (`attachments.graph`) | fmIDE: Templates → Import Templates |
| `fmIDE-functions` | 2 | Function definitions (a library of functions); v2: a definition may carry `origin` | fmIDE: Functions → Import Functions |
| `fmIDE-format-presets` | 2 | Format presets, including the canvas format roles; v2: no Excel-only roles or settings | fmIDE: Format Presets → Import Presets |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings | fmIDE: Keyboard Shortcuts → Import Shortcuts |
| `fmIDE-macros` | 1 | Macros | fmIDE: Macro Builder → Import |
| `fmIDE-preferences` | 1 | Personal settings: shortcut bindings for built-in commands, ribbon layout and Quick Access Toolbar, ribbon collapsed state, KeyTips trigger (fmIDE only) | fmIDE: File → Import Preferences (or Customize Ribbon) |
| `fmIDE-library-pack` | 4 | Templates, recipes and functions to share with other people, with who made them and their licence (below); v2: an item shared again carries the `origin` it came with; v3: a canvas template may carry `attachments`; v4: a canvas or system template may carry an fmGraph board (`attachments.graph`) | fmIDE: File → Open Library Pack… |
| `fmIDE-excel-mapping` | 2 | ExcelExporter's tab/row layout for one model; v2: any row may carry its own format (`style`) and an `indent` (below) | ExcelExporter: Import Mapping JSON |
| `fmIDE-excel-style` | 1 | ExcelExporter's Excel style: how every cell in the workbook looks, by role (step 11a, below) | ExcelExporter: Import Excel Style |
| `fmIDE-excel-module-layouts` | 2 | ExcelExporter's layouts remembered per module (step 11b, below); v2: the layout of a module's block instances, `instance` (step 11d) | ExcelExporter: Import Module Layouts |
| `fmIDE-graph-board` | 2 | fmGraph's boards: bars, charts and sliders showing one model (step 15, below); v2: the template form, for a template's `attachments.graph` (G5a) | fmGraph: Boards → Import boards… (or dropped on the page) |

## A row's own format and indent (`fmIDE-excel-mapping` 2)

Set in ExcelExporter's Tree view (🎨, the right-click menu, Alt+Shift+→ / ←). Any row — a rectangle row, a custom row or an Inputs-tab row — may carry:

- `style`: `{ fill, font: { color, weight }, border: { style, color }, numberFormat? }`. Colours are `#rrggbb` (anything else is dropped: no fill, or the default colour); `weight` is `"700"` or `"normal"`; `border.style` is `"solid"` or `"none"`; `numberFormat` (rectangle rows only) is `{ kind: "number" | "percent" | "currency", decimals }`, `decimals` a whole number 0–10, currency always `$`. On a custom row it is the row's whole look (as before); on a rectangle row it replaces the fill, font colour, weight and border the format role gives it, and the number format when it has one.
- `indent`: a whole number 1–15, the label cell's (column A) indent in Excel, as Excel's Increase Indent makes it. Anything else is read as no indent, and more than 15 as 15.

A version 1 file has neither and opens unchanged.

## The Excel look moved to ExcelExporter (`system` 7, `module` 5, `fmIDE-workspace` 7, `fmIDE-format-presets` 2, `fmIDE-excel-style` 1)

Step 11a (decision 9 in `docs/decisions.md`; `docs/format-roles.md`): fmIDE's formats are the canvas look and the number formats; how cells look in Excel is ExcelExporter's own **Excel style**.

- **What older files carried, and what the upgrade drops.** Five Excel-only role presets (`Links`, `Headers`, `Section Headers`, `Labels`, `Notes`), and in any style (a preset's or a rectangle's own): `keepColours` ("Use this fill, font colour & border in Excel too"), `border.sides` (Excel border sides) and `font.excelDefaultSize` ("Use Excel's default font size"). The upgrade step (system v6 → v7, workspace v6 → v7, module v4 → v5, format presets v1 → v2; `dropExcelOnlyPresets` / `dropExcelOnlyNodeStyles` in `src/shared/file-formats.js`) removes exactly those. Everything else in a style stays: `numberFormat`, `fill`, `border` (colour, width, style), `font` (family, size, weight, colour). The templates file and library packs keep their versions: each template's model carries its own version and is upgraded on its own.
- **The format roles** in a file are now `Inputs` and `Calculations` (plus any presets of the person's own). Their number formats still reach Excel.
- **`fmIDE-excel-style` 1**, written by ExcelExporter's **Export Excel Style** and kept in its browser storage under `fmide-excel-style`:

```json
{ "kind": "fmIDE-excel-style", "version": 1,
  "roles": {
    "Inputs": { "fill": "#eff6ff", "font": { "color": "#1e3a8a", "weight": "normal", "size": null },
                "border": { "style": "solid", "color": "#93c5fd", "sides": ["top", "bottom", "left", "right"] } },
    "Links":  { "fill": null, "font": { "color": "#008000", "weight": "normal", "size": null },
                "border": { "style": "none", "color": "#94a3b8", "sides": ["top", "bottom", "left", "right"] } }
  } }
```

  `roles` holds up to seven entries, by role name: `Inputs`, `Calculations`, `Links`, `Headers`, `Section Headers`, `Labels`, `Notes`. For each: `fill` (`#rrggbb`, or `null` for none), `font.color` (`#rrggbb`, or `null` for Excel's automatic colour), `font.weight` (`"700"` bold or `"normal"`), `font.size` (a whole number of points, 6–72, or `null` for the workbook's default), `border.style` (`"none"`, `"solid"`, `"dashed"` or `"dotted"`), `border.color` (`#rrggbb`) and `border.sides` (any of `"top"`, `"bottom"`, `"left"`, `"right"`; an empty list draws no border). A value that is missing or not one of these takes ExcelExporter's default for that role; a role that is missing takes its defaults; other names are ignored.

## Module layouts (`fmIDE-excel-module-layouts` 2, steps 11b and 11d)

ExcelExporter remembers the layout of a module's tab — a canvas added from a canvas template, known by its template family — and uses it again for new layouts of any model holding that module (`docs/step11-excel-output.md`). **Export Module Layouts** writes them all; they are also kept in its browser storage under `fmide-excel-module-layouts`:

```json
{ "kind": "fmIDE-excel-module-layouts", "version": 2,
  "modules": [
    { "family": "3f2a9c1e-7b4d-4e0a-9c3b-5d8e1f2a6b7c", "name": "Sales", "tabName": "Sales plan",
      "rows": [ { "name": "profit", "section": "output", "include": true, "constant": false },
                { "name": "volume", "section": "input", "include": true, "constant": false, "label": "Units sold", "indent": 1 } ],
      "customs": [ { "label": "Top line", "section": "calc", "showPeriodLabels": false } ],
      "sectioned": ["r1", "c0", "r0"],
      "flat": ["r0", "c0", "r1"] } ] }
```

- `family`: the module's template family (8–64 letters, digits and dashes); a file holds at most one entry per family (the last wins), at most 500. `name`: the template's name, for people (at most 200 characters). `tabName`: present when the tab was renamed; it is made a valid sheet name and used only when no other tab has it.
- `rows` (at most 2,000): one per rectangle, by `name` — the rectangle's name in lower case without outer spaces; a name given twice is ignored. `section` is `input`, `calc` or `output` (anything else is `calc`); `include` (false leaves the row out) and `constant` (used only if the rectangle is an input); optional `label` (the row's own label, at most 500 characters), `style` and `indent` as a row's own format in a mapping file (read through the same checks).
- `customs` (at most 500): the custom rows — `label`, `section`, `showPeriodLabels`, optional `style` and `indent`.
- `sectioned` and `flat`: the tab's order with sections on and off, as references to `rows` (`r<index>`) and `customs` (`c<index>`); a reference to nothing, or given twice, is ignored.
- `instance` (version 2, step 11d; optional): the layout of the tabs of the module's **block instances** — the module used as a block. It holds `rows`, `customs`, `sectioned` and `flat` as above, without `tabName`; each row may carry `copy`, which copy of the rectangle it is in a vertical instance: a vintage (a whole number from 1 to 10,000), `"total"` or `"shared"` (absent for the only copy). A row is known by its name and `copy` together; an unknown `copy` drops the row. An entry made by an instance tab alone has empty `rows`, `customs`, `sectioned` and `flat`: it lays out no module tab.
- Version 1 files open unchanged (the upgrade only raises the number); fmIDE's Attach Excel layout… reads both versions.
- Everything in the file is someone else's text: labels and names are only ever shown as text.

## fmGraph boards (`fmIDE-graph-board` 2, step 15)

A board is a view of one model in fmGraph: bars, charts and sliders. A file holds one or more boards (**Export this board**, **Export all boards**); fmGraph keeps the boards of each model in the browser in the same form.

```
{ "kind": "fmIDE-graph-board", "version": 1, "active": 0,
  "boards": [ { "name": "Board",
    "items": [
      { "type": "bar", "canvasId": "cProfit", "nodeId": "profit", "name": "Profit",
        "periods": { "mode": "all" }, "wide": false, "colour": "#0f766e" },
      { "type": "chart", "wide": true, "layout": "columns", "title": "Balance sheet",
        "periods": { "mode": "all" }, "check": true,
        "groups": [ { "name": "Assets", "parts": [ { "canvasId": "cCash", "nodeId": "close", "name": "Closing cash", "colour": "#2563eb" } ] } ] },
      { "type": "chart", "wide": true, "layout": "flow", "title": "Profit", "period": 0,
        "steps": [ { "canvasId": "cProfit", "nodeId": "rev", "name": "Revenue", "role": "start" } ] } ],
    "sliders": [ { "canvasId": "cProfit", "nodeId": "price", "name": "Price", "periods": { "mode": "all" },
      "mode": "set", "min": 5, "max": 15, "step": 0.25 } ] } ] }
```

- A rectangle is named by its canvas id, node id and name (`canvasId`, `nodeId`, `name`): a widget is used only where the open model has that rectangle under that name (capitals and outer spaces ignored), so a board fits the model it was made from, or another built from the same templates. Anything else is left out, and fmGraph says how many.
- `periods`: `{ "mode": "all" }`, `{ "mode": "one", "p": 2 }` or `{ "mode": "range", "from": 0, "to": 3 }` (periods count from 0); a period the model doesn't have reads as all.
- `items` are shown in this order; `wide` takes the whole row (charts start wide, bars narrow). `colour` is `#rrggbb`; anything else is ignored.
- A chart's `layout` is `columns` (`groups` of `parts`, stacked per period, side by side; `check`: whether the groups' totals must agree) or `flow` (a waterfall of `steps` in `period`, each `start`, `add`, `subtract` or `total`; anything else reads as `add`). At most 12 groups, 30 parts a group, 40 steps; titles 80 characters, names 60.
- A slider's `mode` is `set` (the input's number) or `shift` (a change by %), between `min` and `max` in steps of `step`; it goes only on an input rectangle. Where a slider is set to is never saved: a board always opens on the model's own numbers.
- At most 20 boards, 40 bars and charts and 40 sliders a board. `active` is the board shown.
- The form fmGraph kept in the browser before boards had tabs (one board: `bars`, `charts`, `sliders` at the top level, no `boards`) is read as one board, charts first.

### Boards for a template (`fmIDE-graph-board` 2, step 15 G5a)

fmGraph's **Boards → Export for a template…** writes the same file in its **template form**: a template gets new ids each time it is used, so rectangles are named by their name (capitals and outer spaces ignored), and, for a system template, their canvas's name — never by id:

```
{ "kind": "fmIDE-graph-board", "version": 2, "form": "template",
  "template": { "kind": "module", "family": "3f2a9c1e-…", "name": "Sales" },
  "active": 0,
  "boards": [ { "name": "Board",
    "items": [ { "type": "bar", "name": "Revenue", "periods": { "mode": "all" }, "wide": false } ],
    "sliders": [ { "name": "Price", "periods": { "mode": "all" }, "mode": "set", "min": 0, "max": 20, "step": 1 } ] } ] }
```

- `template.kind` is `module` (a canvas template: `family` and `name` say which; only that canvas's rectangles, each `{ "name" }`) or `system` (a system template: the whole model; each rectangle `{ "canvas", "name" }`). Charts' parts and waterfall steps name rectangles the same way; everything else is as in a board for one model.
- A rectangle whose name is used twice on its canvas, or whose canvas's name is used twice in the model, can't be found again by name: it is left out, as is (for a canvas template) one on another canvas, and fmGraph says how many.
- fmGraph doesn't import a template board as a model's board; fmIDE attaches it to a template (`attachments.graph`, below). Version 1 files are boards for one model and read as before (the upgrade step changes nothing); an older fmGraph asks before opening version 2.

### Boards in a document (`fmIDE-workspace` 11, step 15 G3b)

A workspace — and so a `.fmide` document — may carry `graphBoards`: an `fmIDE-graph-board` file (as above, the whole object) holding its model's boards.

- **fmIDE never reads what is inside.** It keeps `graphBoards` as it came when it is an object of kind `fmIDE-graph-board`, plain data (objects, lists, text, finite numbers, true / false, null), at most 16 deep and 1 MB as JSON text (`cleanGraphBoards`, `GRAPH_BOARDS_LIMITS` in `src/shared/fmide-files.js`); anything else is dropped.
- It belongs to the model: opening a document or importing a workspace takes the file's (or none); opening a system file and New have none; saving and the autosave write it when there is one.
- fmGraph opened from fmIDE gets it with the model and shows it instead of the boards the browser keeps for that model (when it shows anything for this model); each change to the boards in fmGraph goes back to fmIDE, which keeps it and marks the document unsaved. fmGraph opening a `.fmide` or workspace file shows its `graphBoards` the same way. fmGraph reads it with its own checks (`cleanBoards`), as any board file.
- Older workspaces (v1–v10) have none; the upgrade step changes nothing. An older fmIDE or ExcelExporter asks before opening a v11 file; ExcelExporter ignores `graphBoards`.

## Template attachments (`fmIDE-templates` 7 and 10, `fmIDE-workspace` 8 and 12, `fmIDE-library-pack` 3 and 4; steps 11c and 15 G5a)

A template version may carry **attachments**: data for an output other than fmIDE, which fmIDE keeps with the template but never reads. There are two: `excel` (canvas templates) — the layout ExcelExporter remembers for that module, exactly one entry of an `fmIDE-excel-module-layouts` file (above) — and `graph` (canvas and system templates; step 15 G5a) — an fmGraph board file in its template form (above), with the template's `family` added:

```json
{ "name": "Sales", "kind": "module", "family": "3f2a9c1e-…", "version": 2, "versionId": "…", "note": "", "data": { … },
  "attachments": { "excel": { "family": "3f2a9c1e-…", "name": "Sales", "tabName": "Sales plan", "rows": [ … ], "customs": [ … ], "sectioned": [ … ], "flat": [ … ] } } }
```

- fmIDE keeps `excel` only on a canvas template (`kind: "module"`), and `graph` on a canvas or system template when it says it is a template board for that kind (`kind` `fmIDE-graph-board`, `form` `template`, `version` 2 or later, `template.kind` the template's), when it is plain data (objects, lists, text, numbers, `true` / `false` / `null`), nested at most 12 deep, at most 256 KB written out, and its `family` is the template's own. Anything else is dropped when the file is read (`cleanTemplateAttachments` in `src/shared/fmide-files.js`); the library's checker refuses a pack holding what fmIDE would drop, and any text in it with a hidden character. A version 2 pack is as good as a version 3 one and gets no warning; a version 1 pack is warned about (it lost the credit of items shared again).
- It goes wherever the template goes: workspaces and `.fmide` documents, templates files, library packs, and the next version (Save as new version copies it). A template read into a new family (its family was taken by another kind) loses it. A template already in the library gains the attachment of an imported copy that has one and it lacks. A model (system, module) never carries one.
- fmIDE adds one with **📎 Attach Excel layout…** in the Templates window, from a file ExcelExporter's Export Module Layouts saved: it reads that file's `kind`, `version` and each entry's `family`, and takes the entry of the template's family. ExcelExporter checks the layout itself (`cleanModuleLayout`) when it uses it.
- fmIDE adds a board with **📈 Attach fmGraph board…**, from a file fmGraph's Export for a template… saved (`graphBoardForTemplate`): it reads only its `kind`, `version`, `form`, `template.kind` and, for a canvas template, `template.family` (which must be the template's), and adds the template's `family`. The library's checker also checks the board against the template it comes with: every rectangle it names must be in the template, once (and, for a system template, in the canvas of that name), with at most 20 boards, 40 bars and charts and 40 sliders a board.
- Older files have none, and open unchanged; an older fmIDE asks before opening the new versions.

## Limits on a file that is opened

A file someone opens (any kind, in either app) is refused, with a plain message, before anything else reads it, when it is:

- longer than 50 MB of text ("That file is too large to open (51 MB; the limit is 50 MB).");
- nested more than 100 levels deep ("That file is nested too deeply to open…") — real files are under 10;
- holding more than 5,000,000 values in all.

The limits (`FILE_LIMITS`, `fileTextProblem`, `fileDataProblem` in `src/shared/file-formats.js`) keep a hostile file from freezing or crashing the page; before them, a deeply nested file stopped the reader with a stack overflow and no message. The autosave is not checked: it is the person's own work. No format changed.

## Library packs (`fmIDE-library-pack` 3)

A **library pack** is one file of templates, recipes and functions to share with other people (step 8, `docs/step8-community-library.md`). fmIDE writes one with **File → Save as Library Pack…** and reads one with **File → Open Library Pack…**, which shows what it holds before adding anything.

```json
{ "kind": "fmIDE-library-pack", "version": 2,
  "pack": { "id": "5d0e…", "title": "Three statements starter", "author": "Ann Example",
            "licence": "CC-BY-4.0", "description": "…", "tags": ["statements", "tax"], "created": "2026-09-27" },
  "templates": [ { "name": "Income Statement", "kind": "module", "family": "…", "version": 1, "versionId": "…", "note": "", "group": "…", "description": "…", "data": { … } } ],
  "functions": [ { "family": "…", "version": 1, "versionId": "…", "text": "Margin(Revenue, Cost) = …", "description": "", "note": "", "calls": [] } ] }
```

- `pack` says what the pack is and who made it. `id` is a random id (8–64 letters, digits and dashes), new for every pack saved. `title` (at most 120 characters, one line) and `author` (at most 120) are required. `licence` is required and, for now, must be `"CC-BY-4.0"` (Creative Commons Attribution 4.0 International: anyone may use, change and share the items, including commercially, with credit to the author). `description` (at most 2,000 characters), `tags` (at most 10, each at most 40 characters, kept in lower case without duplicates) and `created` (a date, `YYYY-MM-DD`) are optional. The checks live in `src/shared/library-pack.js` (`cleanLibraryPackInfo`).
- `templates` are template versions exactly as in a templates file (families and versions, recipes; each model is read and upgraded like a templates file's). `functions` are function definitions exactly as in an `fmIDE-functions` file. At most 500 of each are read.
- **What a pack carries:** each template, recipe or function picked goes in as the version picked (the latest by default), together with what it needs: the template versions a recipe builds with (a `"latest"` part as the library's latest when the pack is saved) and every function a function calls, at the version it calls. A template's model carries its own functions, as always. A recipe whose part isn't in the library can't be put in a pack.
- **Reading a pack:** a pack without valid `pack` details (no id, no title, no author, no licence or another licence) is refused and nothing in it is added. Each item is shown with what adding it would do: *new*; *already in your library* (not offered); *adds a version to your …* (its family is one you have — canvases linked to that template will then offer it as an update); or *you have a different … called …* (both are kept). Adding follows the usual import rules for templates and functions: nothing of yours is replaced, and a version whose number your library already uses for something else is added under the next number. Ticking an item also adds what it needs from the pack.
- Every text in a pack is someone else's and is only ever shown as plain text.
- The file name fmIDE suggests is the title with `.fmide-pack.json` (for example `Three-statements-starter.fmide-pack.json`); it is an ordinary JSON file.
- ExcelExporter doesn't read packs: it says to open them in fmIDE.
- **The community library's checker** (`tools/check-pack.js`) reads a pack with the same code as fmIDE (`src/shared/fmide-files.js`) and is stricter: whatever fmIDE would leave out or tidy (a malformed id, a recipe part it would drop, a title with extra spaces, tags not in lower case) is an error there, and so are characters that hide or reverse text. A library pack is at most 5 MB.
- **Version 2** (step 8, phase 8b): an item that came from someone else's pack carries its `origin` (below) into a pack of yours, so its author keeps the credit CC BY 4.0 asks for. Version 1 packs had none; they open as before, and every item they add is recorded as the pack's.

## The community library's records (step 8, phase 8c-2)

The community library (a GitHub repository of packs, `docs/step8-community-library.md`) keeps, next to `packs/<pack id>.fmide-pack.json`, four JSON files that the library's checker reads (`tools/check-pack.js --library`). They are not files the apps open. Accounts are GitHub's numeric user ids (`accountId`), with the login (`account`) beside them for people; dates are `YYYY-MM-DD`; entries are kept sorted by id.

```json
// families.json — who owns each template or function family: the account of its first approved pack
{ "kind": "fmIDE-library-families", "version": 1,
  "families": { "<family id>": { "type": "template", "kind": "module", "accountId": 1001, "account": "ann-example",
                                 "firstPack": "<pack id>", "added": "2026-09-27" } } }
// authors.json — the author name each account shares under
{ "kind": "fmIDE-library-authors", "version": 1,
  "authors": { "1001": { "account": "ann-example", "author": "Ann Example", "added": "2026-09-27" } } }
// packs.json — every approved pack, kept when it is taken down
{ "kind": "fmIDE-library-packs", "version": 1,
  "packs": { "<pack id>": { "accountId": 1001, "account": "ann-example", "added": "2026-09-27",
                            "sha256": "<the file's SHA-256>", "versions": ["<version id of each item, in the pack's order>"] } } }
// checker.json — which fmIDE commit checks the library, and its maintainers
{ "kind": "fmIDE-library-checker", "version": 1,
  "fmide": { "repository": "owner/fmide", "commit": "<full 40-character commit id>" },
  "maintainers": [ { "accountId": 1000, "account": "…" } ] }
```

- `type` is `"template"` (with `kind`: `"module"`, `"system"` or `"recipe"`) or `"function"` (no `kind`).
- The records are only ever added to: an entry, once approved, is never changed or removed (a change of owner is a maintainer's own pull request). A pack taken down leaves its entries, so its ids are never used again.
- `author` follows a pack's author rules (one line, at most 120 characters, no extra spaces); no two accounts share a name (ignoring capitals and spaces).

## The catalogue's list (`fmIDE-library-index` 1, step 8, phase 8c-3)

The build writes the community library's catalogue into the published site (`/library`, `tools/build-library.js`), and with it `/library/index.json`: every approved pack and what it holds. fmIDE's **Browse Library…** (phase 8d) reads it from its own site; it is never opened as a file (opened by hand, fmIDE says where it belongs).

```json
{ "kind": "fmIDE-library-index", "version": 1,
  "packs": [ { "id": "<pack id>", "title": "…", "author": "…", "licence": "CC-BY-4.0", "description": "…", "tags": ["…"],
               "created": "2026-09-28", "added": "2026-09-27",
               "page": "<pack id>", "file": "packs/<pack id>.fmide-pack.json", "bytes": 51658, "sha256": "…", "packVersion": 2,
               "counts": { "templates": 4, "recipes": 1, "functions": 2 },
               "items": [ { "type": "template", "kind": "recipe", "name": "…", "family": "…", "version": 1, "versionId": "…",
                            "group": "…", "description": "…", "note": "…" },
                          { "type": "function", "name": "Margin", "family": "…", "version": 1, "versionId": "…", "description": "",
                            "origin": { "packId": "…", "packTitle": "…", "author": "…", "licence": "CC-BY-4.0" } } ] } ] }
```

- Packs newest approved first (`added`, from `packs.json`), then by title. `created` is the pack's own date (`null` if it has none). `page` and `file` are relative to `/library/`; `bytes` and `sha256` are the pack file's, which is served byte for byte.
- Items grouped as recipes, canvas templates (`module`), system templates, functions, each group in the pack's order. `group` and `note` appear only when the item has them; `origin` only when the item carries one (an item shared again from another pack has that pack's). `board: true` (step 15 G5c) when a canvas or system template carries an fmGraph board (`attachments.graph`): Browse Library then offers **Try in fmGraph** for it. An optional field that older fmIDE ignores, so the version stays 1; any value but `true` reads as no board.
- Every text comes from the packs: anything reading this file must treat it as untrusted, like a pack. The file holds no build date or account, so the same library always gives the same file.
- **How fmIDE reads it** (`readLibraryIndexData`, `cleanLibraryIndexEntry`): at most 10 MB and 5,000 packs. An entry is left out whole when its details fail the pack rules (`cleanLibraryPackInfo`), `page` isn't its id or `file` isn't `packs/<id>.fmide-pack.json`, `bytes` isn't a whole number from 1 to 5 MB, `sha256` isn't 64 lower-case hex digits, `packVersion` isn't a whole number, an item has an unknown type or kind, no ids, no name or a bad `origin`, `counts` don't match the items, a text holds a hidden character (one that changes the direction of text, is invisible or is a control character), or its id came earlier in the list. The address of a pack is always built from its id, never taken from `file`. The pack fetched must have exactly `bytes` bytes and this `sha256`, and carry this `id`. The build reads its own file the same way and stops if any pack would be left out.

## Where items came from (`fmIDE-templates` 6, `fmIDE-workspace` 6, `fmIDE-functions` 2, `fmIDE-library-pack` 2)

A template version or function version added from a library pack remembers the pack in an optional `origin`:

```json
{ "name": "Balance Sheet", "family": "…", "version": 3, "versionId": "…", …,
  "origin": { "packId": "5d0e…", "packTitle": "Three statements starter", "author": "Ann Example", "licence": "CC-BY-4.0" } }
```

- `packId`, `packTitle`, `author`, `licence`: the pack's `id`, `title`, `author` and `licence`, as the pack said them. It is a record of what a file claims, not proof: anyone can write any author into a pack.
- **Reading** (`cleanItemOrigin` in `src/shared/library-pack.js`): the same rules as a pack's details — `packId` 8–64 letters, digits and dashes; `packTitle` and `author` required, one line, at most 120 characters; `licence` an accepted one (`"CC-BY-4.0"`). Any other field is dropped. An origin that fails any check is dropped whole; the template or function is still read, with no origin. It is only ever shown as plain text.
- **Where it is set:** only by opening a library pack. Each item added gets the `origin` it carries (it was shared before, in another pack), or else the pack's own. A version that is renumbered because its number is taken keeps it; a version already in your library is left as it was.
- **Where it travels:** it is kept in the autosave, documents, workspace exports, templates files, functions files and packs, and read back from all of them. A new version you save (Save as new version, Edit as new version, a new function version) has none: it is your work; the older versions keep theirs. Changing a name or description keeps it.
- **Never in a model:** a system's or module's `functions`, and a canvas's `template` link, never carry an origin (`system` and `module` did not change). A function copied from the library into a model loses it; a definition that reaches the library only inside someone's model arrives without one.
- **Shown:** the Templates window and the Functions manager show "From the library pack "…" by … · CC BY 4.0" for a version with an origin, and — when a family's versions came from different places — which came from where ("v1, v2 yours · v3 from "…" by …"). "Update this canvas" says where the chosen version came from.
- **The family rule** (docs/step8-community-library.md): when a pack adds a version to a family you have, the preview warns if any of your versions came from another author, or has no origin (your own work, or added before origins were recorded). Author names are compared ignoring capitals and extra spaces, and always with the **pack's** author, never with an author an item in the pack claims. Warned items start unticked.
- **Older files** (templates 5, workspace 5, functions 1, packs 1) have no origins; their upgrade steps change nothing. An older fmIDE asks before opening a newer file. ExcelExporter reads workspace 6 and ignores templates and the function library, so origins don't affect it.

## Operators (`system` 6, 8 and 9, `module` 4, 6 and 7, `fmIDE-workspace` 5, 9 and 10, `fmIDE-templates` 5, 8 and 9)

An operator node saves its symbol in `text`: `{ "id": "n3", "type": "operator", "x": 300, "y": 120, "text": "×", "socket": "" }`.

| `text` | Operator | Inputs |
|---|---|---|
| `+` `−` `×` `÷` `^` `%` | add, subtract, multiply, divide, power, modulo (like Excel's MOD) | two or more, left to right by position |
| `≤` `≥` `<` `>` | comparisons: 1 (true) or 0 (false); `a < b < c` means `a < b` and `b < c` | two or more, left to right |
| `abs` `min` `max` `ave` `iferror` | ABS (one input), MIN, MAX, AVERAGE, IFERROR (the first input, or when it fails the second, or 0) | left to right |
| `period` | the period being calculated, counted from 1 (system 6) | none |
| `if` | IF: *then* where *condition* isn't 0, otherwise *else*; only the input it takes is read (system 6) | named: `condition`, `then`, `else` |
| `=` `≠` | equal, not equal, like the comparisons (system 6) | two or more, left to right |
| `and` `or` `not` | AND, OR (any number of inputs), NOT (one): 1 or 0; an input that isn't 0 counts as true (system 6) | left to right |
| `round` `roundup` `rounddown` | Excel's ROUND, ROUNDUP, ROUNDDOWN to *digits* places (negative: tens, hundreds…) (system 6) | named: `value`, `digits` |
| `ln` `exp` `sqrt` `int` `trunc` | Excel's LN, EXP, SQRT, INT (down, towards minus infinity: −2.5 gives −3) and TRUNC (towards zero: −2.5 gives −2, no digits — `rounddown` has them); the log of 0 or less, the root of a negative and e to a power too large are errors (system 8) | exactly one |
| `choose` | Excel's CHOOSE: the choice its *index* picks — the index cut to a whole number, *choice 1* for 1, *choice 2* for 2…; an index below 1 or past the last choice is an error (Excel's #VALUE!); only the choice picked is read (system 9) | named: `index`, then `choice 1`, `choice 2`… (at most 254) |

- **Named inputs** (`if`, `round`, `roundup`, `rounddown`, `choose`): each arrow into one carries `toPort`, the input it feeds, counted from 0 in the order above (`condition` is 0, `then` 1, `else` 2; a `choose`'s `index` is 0 and *choice n* is n), as an arrow into a function node does. A `choose` has as many choices as its highest `toPort` (from 1 to 254; an arrow with a larger one is ignored); a choice in between with no arrow is an error only when it is picked. An input the operator reads with no arrow is an error ("?" in fmIDE, `#N/A` in Excel); IF reads only the branch it takes, so a branch not taken may be left unconnected.
- **Comparisons** treat two numbers as equal when they differ only in their last few binary digits, as Excel and LibreOffice do (`0.1 + 0.2 = 0.3` is true; before system 6 the comparisons were exact).
- **Rounding** works on the number's 15 significant digits, as Excel shows it: `round(2.675, 2)` is 2.68 although 2.675 is stored as slightly less; halves round away from zero.
- **The period number** in Excel is the formula's own sheet's "Period #" cell (row 3).
- **The timeline:** a rectangle fed through a period shift that needs a period outside the timeline (a corkscrew's opening balance in period 1) shows its own typed number, or 0. An `if` needs such a period when its condition does, or both of its branches do (a `choose`: its index, or every choice); a branch it may not take doesn't count, so `if(period = 1, Opening, previous Closing)` shows *Opening* in period 1. Inside a branch taken, such a read is an error.
- **An operator whose `text` isn't one of these** (only a hand-edited file has one) is an error: "?" in fmIDE and `#N/A` in Excel (before system 6, fmIDE passed its first input through).
- **Units:** `+ − min max ave abs iferror int trunc` keep a unit all their inputs share; `×` and `÷` combine them; `if` takes the unit *then* and *else* share, `choose` the unit every choice shares; `round`, `roundup`, `rounddown` keep *value*'s; the others (`ln`, `exp` and `sqrt` among them) give none.
- **INT and TRUNC** work on the number as it is stored, as Excel does: `int((0.1 + 0.7) × 10)` is 7, because the product is 7.999…; LibreOffice, which rounds first, gives 8.
- **Older and newer files:** older files (`system` 1–5, `module` 1–3, `fmIDE-workspace` 1–4, `fmIDE-templates` 1–4) have none of the phase E1 operators, older than `system` 8, `module` 6, `fmIDE-workspace` 9, `fmIDE-templates` 8 none of phase E2a's, and older than `system` 9, `module` 7, `fmIDE-workspace` 10, `fmIDE-templates` 9 no `choose`; the upgrade steps change nothing. An older app asks before opening a newer file; without that, it would calculate the new operators as ones it doesn't know.

## Functions (`system` 5, `module` 3, `fmIDE-workspace` 4, `fmIDE-templates` 4, `fmIDE-functions` 1)

A **function** is a formula written with the built-in operators, held in a file and used in a model like an operator, for example:

```
Margin(Revenue, Cost) = (Revenue - Cost) / Revenue
```

Functions are formulas, never code: the apps read them with their own parser (`parseFunctionText` in `src/shared/functions.js`) and never run text from a file.

### A definition

```json
{ "family": "0c6f…", "version": 2, "versionId": "a91e…",
  "text": "Profit(Revenue, Cost) = Margin(Revenue, Cost) * Revenue",
  "description": "What is left of revenue, in money.", "note": "Uses Margin v1",
  "calls": [ { "name": "Margin", "family": "7d2b…", "version": 1, "versionId": "5e40…" } ] }
```

- `family`, `version`, `versionId`: like templates (below). The family is a random id and never the name; versions are 1, 2, 3…; `versionId` is a random id for this one version. Ids are 8–64 letters, digits and dashes: a definition whose family or version isn't is left out when read, and a malformed `versionId` counts as unknown. A function is always referred to by its family and version, and its `versionId` when known — never by its name.
- `text`: the whole definition — the function's name, its inputs, and its formula (the syntax below). The name and inputs are read from it.
- `description` (at most 2,000 characters) and `note` (a change note, at most 500): plain text.
- `calls`: for each other function the formula calls, the name it is written with and the version it means. A call is followed through this list, never by name alone, so a function keeps calling the version it was written against.

### Where definitions are carried

- A **system** (v5) and a **module** (v3) carry, in `functions`, every definition their function nodes use, and every function those call. Files whose model uses no functions have no `functions` list.
- A **workspace** (v4) also carries the person's whole library in its own `functions`; its system carries the model's.
- An **`fmIDE-functions`** file (v2) is `{ "kind": "fmIDE-functions", "version": 2, "functions": [ … ] }`; since v2 a definition in it (and in a workspace's library) may carry `origin` (see "Where items came from").
- A template's model (a module or system inside a templates file, v4) carries its own, like any module or system.
- Opening a file adds to the library any definitions it doesn't have (the same family and `versionId`; without a `versionId`, the same family and text). A version whose number the library already uses for a different version is added under the family's next number, keeping its `versionId`, with a note saying so; calls in the library that name it by its `versionId` follow it to the new number. The model that carried it keeps its own copy under its own number.
- Content added to an open model (a module, a system added alongside, a template, pasted nodes) brings its definitions into the model's own list. A model holds one definition per family and number, so a different version under a number the model already uses is added under the family's next free number in the model, keeping its `versionId`, with a note; the nodes that came with it (and calls to it) follow the new number. The library then adds it by its own rule above.
- The calculation reads only the definitions the model's file carries, not the library: a model calculates the same wherever it is opened.

### A function node

```json
{ "id": "n7", "type": "function", "x": 300, "y": 120, "w": 150, "h": 80,
  "fn": { "family": "7d2b…", "version": 1, "versionId": "5e40…", "name": "Margin" } }
```

An arrow into it carries `toPort`, the input it feeds, counted from 0 in the order the definition lists its inputs (`Revenue` is 0 and `Cost` is 1 above). `fn.name` is only for display. The node's value is the formula with each input read from the arrow into its port.

- `fn.skipped` (optional, a version number): the person chose "Not now" for that version of the function in their library, so the app doesn't offer it again until a newer one exists. It changes nothing in the calculation. Apps that don't know it ignore it, so it needs no new format version (added by fmIDE in step 7 phase D2b; the files are still `system` 5 and `module` 3).

### Syntax

```
definition := name "(" [ name { "," name } ] ")" "=" formula
formula    := sum [ comparison sum ]            one comparison at most
sum        := product { ("+" | "-") product }
product    := power { ("*" | "/") power }
power      := unary { "^" unary }               from the left: 2^3^2 = 64
unary      := ("-" | "+") unary | item          -2^2 = 4, as in Excel
item       := number | input | call | "(" formula ")"
call       := name "(" [ formula { "," formula } ] ")"
comparison := "<" | "<=" | ">" | ">=" | "=" | "<>"
```

- **Names** (the function's and its inputs'): a letter (of any language) or `_`, then letters, digits, `_` and `.`; at most 64 characters; capitals don't matter (`revenue` is `Revenue`). Two inputs can't share a name, an input can't have the function's name, and neither can be the name of a built-in or kept-back function (below) — except that an input may be called `Period` (it came before `PERIOD()`; the input is read without brackets, the built-in with them).
- **Numbers**: `12`, `0.5`, `.5`, `1.5e3`. There are no negative numbers as such: `-3` is a minus applied to 3.
- **Signs**: `+ - * / ^` and `< <= > >= = <>` (in the formula, `=` compares, as in Excel). fmIDE's own signs `− × ÷ ≤ ≥ ≠` mean the same.
- **Precedence**, as in Excel: a leading minus first (`-2^2` is 4), then `^` (from the left), then `*` and `/`, then `+` and `-`, then a comparison. A comparison gives 1 (true) or 0 (false).
- **Built-in functions**, with Excel's numbers of inputs: `MIN(a, …)`, `MAX(a, …)`, `AVERAGE(a, …)` (at least one input), `ABS(a)`, `MOD(a, b)` (the result takes the divisor's sign, like Excel's MOD), `IFERROR(a, b)` (a, or b when a fails); since phase E1: `IF(c, a, b)` (a where c isn't 0, otherwise b; only the one taken is read), `AND(a, …)`, `OR(a, …)`, `NOT(a)`, `ROUND(x, d)`, `ROUNDUP(x, d)`, `ROUNDDOWN(x, d)` and `PERIOD()` (the period number, from 1); since phase E2a: `LN(x)`, `EXP(x)`, `SQRT(x)`, `INT(x)` and `TRUNC(x)` (one input each); since phase E2b `CHOOSE(i, a, …)` (an index and 1 to 254 choices; only the choice picked is read), as the operators above.
- **Calls** to other functions: `Margin(Revenue, Cost)`, with exactly as many inputs as that function has. A function can't call itself.
- **Not accepted** (each with its own message): a chain of comparisons (`a < b < c`, `a = b = c`), `%`, `&`, text in quotes, `;`, and these Excel names, kept back for later: `IFS XOR SUM PRODUCT LOG LOG10 POWER SIGN COUNT LET LAMBDA INDEX NA TRUE FALSE PI CEILING FLOOR MEDIAN SUMPRODUCT`. (`=`, `<>`, `IF`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP` and `ROUNDDOWN` were refused before phase E1, `LN`, `EXP`, `SQRT`, `INT` and `TRUNC` before phase E2a, and `CHOOSE` before phase E2b — they were kept back, so no function or input can have had one of those names; a function named `Period` can't be read since E1.)
- **Limits**: a definition of at most 4,000 characters, 32 inputs, 64 levels of brackets and signs, calls nested at most 16 functions deep, and at most 64 different functions called from one.
- A parse error gives a message and the place in the text where it was found.

### Calculating

- An input is read only when the formula needs it, so `IFERROR(x, 0)` catches a failing input, as Excel does, and an input the formula doesn't read may be left unconnected.
- A result that isn't a finite number (a divide by zero, `(-4)^0.5`, a result too large) is an error, as in Excel (`#DIV/0!`, `#NUM!`).
- **Errors** of a function node: the definition isn't in the file, or has another `versionId` (`function-missing`, also when a function it calls is missing); its text can't be read (`function-unreadable`); functions call each other in a loop (`function-cycle`, only possible in a hand-edited file); calls nested more than 16 deep (`function-too-deep`); a call with the wrong number of inputs (`function-arguments`); an input the formula reads isn't connected (`function-input-unwired`); an input fails (`missing-input`).
- **Units** are worked out from the formula with the operators' rules, using the units of what feeds each input. A number in the formula has no unit of its own: it counts as a plain number for `*` and `/` (`Revenue * 1.1` keeps Revenue's unit) and is left out where the units must match (`Revenue + 100` keeps it too). `^`, `MOD` and comparisons give no unit.
- A rectangle fed by a function whose formula must read an input that needs a period outside the timeline (a corkscrew's opening balance in period 1) shows its own typed number, or 0, as with an operator. Only what the formula must read counts: `IFERROR` needs such a period only when both of its inputs do, `IF` when its condition does or both of its branches do, and an input it doesn't read never counts (before phase E1 any input counted, and ExcelExporter could write the typed number where fmIDE showed what `IFERROR` caught).
- **In Excel**, ExcelExporter writes a call out in full inside each formula that reads it (no `LAMBDA` or named function): the formula with each input replaced by the cell its arrow reads, the built-in functions as Excel's own, Excel's order of operations, and a comparison as 1 or 0. A call that can't be calculated, or an input the formula reads with no arrow, is `#N/A`; so is a formula a call would make longer or more deeply nested than Excel allows.

### Older and newer files

Older files (`system` 1–4, `module` 1–2, `fmIDE-workspace` 1–3, `fmIDE-templates` 1–3) have no functions; the upgrade steps change nothing. An older app asks before opening a newer file; without that, it would calculate a function node as an operator it doesn't know.

## Plugs (`system` 3, `module` 2)

A value rectangle can carry several plug names: `"plugs": ["to Income Tax expense", "to CF Income Tax paid"]`. Each name feeds the rectangle into every operator whose `socket` has that name (names match regardless of capitals), on any canvas; an operator still has one `socket`. The connections this makes are saved too (arrows and aliases marked `"auto": true`), but only as fmIDE's drawing of them: when reading a model, both apps work the connections out again from the plug and socket names (`plugLinks` in `src/shared/ir.js`) and set the saved ones aside, so a file whose saved connections are out of date or missing still calculates as fmIDE shows it. Keep writing them: older copies of ExcelExporter read only those. (An alias drawn this way sits left of its socket, 200 px across and stacked 74 px down per plug from another canvas; that place sets the order its operator reads it in.)

Older files (`system` 1–2, `module` 1) held one name, `"plug": "Revenue"` (blank for none). Reading one turns it into `"plugs": ["Revenue"]` (or `[]`) and removes `plug` — the upgrade step `SHARED_FILE_MIGRATIONS.system[2]` and fmIDE's `FILE_MIGRATIONS.module[1]`, both using `upgradeNodePlugs()` in `src/shared/file-formats.js`. That covers every way a model arrives: Load System / Load Module, Open… and Open Recent, Import Workspace, templates (each template's model is upgraded as it is read) and the autosave. An older fmIDE opening a newer file asks first ("saved by a newer version"), so it never drops extra plugs without saying so.

## Recipes (`fmIDE-templates` 3, `fmIDE-workspace` 3)

A **recipe** is a template (with a family, version and note like any other) whose `kind` is `"recipe"`. It lists canvas templates to add together:

```json
{ "name": "Three Statements", "kind": "recipe", "family": "…", "version": 1, "note": "", "versionId": "…",
  "data": { "kind": "recipe", "parts": [
    { "family": "…income…", "version": "latest", "name": "Income Statement" },
    { "family": "…balance…", "version": 2, "versionId": "…", "name": "Balance Sheet" } ] } }
```

- Each part is a canvas template family, either `"latest"` (whatever the newest version is when the recipe is built) or a pinned version number. A pinned part records the `versionId` it was made with. `name` is only for display, when the family isn't in the library.
- **Building** adds one canvas per part, in order, each linked to its template version (see below). Plugs and sockets then connect the canvases by name. The build warns when a pinned version in the library isn't the one the recipe recorded (it builds with the library's), skips a part whose family or pinned version isn't in the library (with a warning), and lists sockets nothing feeds. Nothing is refused unless no part at all can be built.
- **Reading:** at most 50 parts. A part whose `family` isn't 8–64 letters, digits and dashes, or whose `version` isn't `"latest"` or a whole number of 1 or more, is dropped; a recipe with no parts left is skipped. Names are text of at most 200 characters.
- Older files (`fmIDE-templates` 1–2, `fmIDE-workspace` 1–2) have no recipes; the upgrade steps change nothing. An older fmIDE asks before opening a version 3 file; without that, it would read a recipe as a broken canvas template. ExcelExporter ignores templates.

## Canvases linked to a template (`system` 4)

A canvas made from a canvas template remembers it:

```json
{ "id": "c3", "name": "Sales", "nodes": [], "edges": [],
  "template": { "family": "3f2a9c1e-…", "version": 2, "versionId": "9b1c…", "name": "Sales", "skipped": 3 } }
```

- `family`, `version` and `versionId` identify the template version the canvas came from (see below). `name` is only for display, when the family isn't in the library. `skipped` (optional) is a newer version the person chose "Not now" for.
- A link is set by **Add to new canvas**, by **Add to current canvas** on an empty canvas, and by saving the canvas as a template (or as a new version). Adding a template into a canvas that has other content removes the link. **Unlink Canvas from Template** removes it too.
- Links are saved in systems, and so in workspaces, `.fmide` documents and the autosave. Module files never carry one. **Add System** keeps the links of the canvases it adds as new canvases; a canvas merged into an existing one gets none.
- **Reading:** a link whose `family` or `versionId` isn't 8–64 letters, digits and dashes, or whose `version` isn't a whole number of 1 or more, is dropped (a bad `versionId` alone becomes "unknown"). A link counts as coming from a library version only when the family *and* `versionId` match, never by number alone.
- **Update this canvas** replaces the canvas's content with another version of its template. The canvas keeps its id and name. Rectangles whose names match between the canvas and that version keep their ids, so aliases elsewhere keep working. Each input rectangle keeps the value typed on the canvas: the value line, `periodValues`, `periodValuesRange` and `literalPeriods`.
- Older systems (`system` 1–3) have no links. The upgrade step `SHARED_FILE_MIGRATIONS.system[3]` changes nothing. ExcelExporter ignores links, so its workbooks are unchanged.

## Template families and versions (`fmIDE-templates` 2, `fmIDE-workspace` 2)

Each saved template is one **version** of a template **family**. A templates file (and a workspace's `templates` list) holds one entry per version:

```json
{ "name": "Income Statement", "description": "", "group": "Statements", "kind": "module",
  "family": "3f2a9c1e-7b4d-4e0a-9c3b-5d8e1f2a6b7c", "version": 3, "note": "Tax split out",
  "versionId": "9b1c…", "data": { "kind": "module", "version": 2, "nodes": [], "edges": [] } }
```

- `family` — a random id (UUID v4 form), the same for every version of the template. It is random so that templates from different people never clash; the name is only a label.
- `version` — 1, 2, 3… within the family. A new version is made only by **Save as new version** (or by choosing it when saving under a name already used). Saving under a new name starts a new family.
- `note` — a short change note (at most 200 characters, plain text).
- `versionId` — a random id for this one version. Version numbers are counted in each person's library, so two libraries can each have a different "version 3" of the same family. `versionId` tells them apart.
- `name`, `group`, `description` and `kind` belong to the family: every version carries the same ones. A family is always one kind. A workspace entry also has `id`, fmIDE's local id for the entry (reassigned when read; never refer to it from elsewhere).

**Reading.** A malformed `family` or `versionId` (anything but 8–64 letters, digits and dashes) gets a new random one. A `version` that isn't a whole number of 1 or more becomes 1. Two entries with the same family and version get separate numbers. When templates are imported (Open…, Import Workspace, Import Templates):
- a version the library already has (same family, the same content under the same number or the same `versionId`) is skipped;
- a version whose number is free in that family is added under its number;
- a version whose number is already taken by different content is added after the file's other versions, under the family's next number, with the note "Imported — was vN in the file: …";
- a family the library doesn't have is added, unless the library already holds the same template (same name, kind and content). An older file read twice gets new random families each time, so this rule is what keeps its templates from being added twice.

**Referring to a template** (`insertTemplate`, macros): `Name` (the latest version), `Name@latest`, `Name@3`, or the same with the family id in place of the name. If two families share a name, only the family id works. Anything lasting should store the family id and the version (or `versionId`), not the name.

**Older files** (`fmIDE-templates` 1, `fmIDE-workspace` 1) had no families. Reading one makes each template a family of its own, version 1, with an empty note and new random ids: the upgrade steps `FILE_MIGRATIONS['fmIDE-templates'][1]` (fmIDE) and `SHARED_FILE_MIGRATIONS['fmIDE-workspace'][1]`, both using `upgradeTemplateEntries()` in `src/shared/file-formats.js`. ExcelExporter reads workspace version 2 and ignores templates. An older fmIDE asks before opening a version 2 file.

## Changing a format

1. Raise the version for that kind: for `system` and `fmIDE-workspace` (read by **both** apps) in `SHARED_FILE_VERSIONS` in `src/shared/file-formats.js`; for any other kind in its app's `FILE_FORMATS`.
2. Add the upgrade step `[kind][oldVersion]` — a function that upgrades a copy of an old file by exactly **one** version — to `SHARED_FILE_MIGRATIONS` (shared kinds) or the app's `FILE_MIGRATIONS` (its own kinds).
3. `npm run build`: both apps pick up a shared change.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.

## Rules for anything read from a file

Files may come from other people (the planned community library), so text from a file is always shown as plain text, never as HTML; numbers are forced to be numbers; colours are checked before use. Neither app ever runs text from a file as code. The helpers for this (`escapeXml`, `safeNum`, `safeColor`) live in `src/shared/escaping.js`.

---

This document is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0.txt) (CC BY 4.0): anyone may use it — for example to build tools that read or write fmIDE files — with credit to fmIDE (Copyright 2026 Taro Yamaka). See [LICENSING.md](../LICENSING.md).
