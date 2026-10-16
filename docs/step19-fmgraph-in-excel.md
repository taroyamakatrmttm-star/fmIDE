# Step 19 — fmGraph in Excel

The owner's request (15 October 2026): **ExcelExporter rebuilds a model's fmGraph boards in the workbook**, so the "what if" a person plays with in fmGraph is still there in the Excel file they send:

- **sliders** become form-control **scroll bars** on a **Dashboard** tab, each with a cell to type into;
- **fmGraph's scenarios** become **per-rectangle (row) scenarios plus Global Cases**;
- **Tornado and Spider** charts (step 18, `docs/step18-fmgraph-sensitivity.md`) become **several sensitivity analyses**, step 16's Sensitivity tab once for each;
- **fmGraph's charts** become **Excel charts**.

This is the brief, written for the owner's approval. Nothing is built yet. The owner's choices it rests on are decision 12 in `docs/decisions.md`. It follows step 18: a board's Tornado and Spider exist only from step 18 on.

## The owner's choices (15 October 2026)

1. **Sliders are scroll bars plus a typed cell.** The scroll bar is the quick way, and the typed cell is the exact way that always works.
2. **Boards come in only through Layout → "Use fmGraph boards…"**. They are copied into the layout, and **never read at Generate**. The workbook depends only on the layout, which the person can see, change and save. A board changed later in fmGraph changes nothing until the person uses the command again.
3. **ExcelExporter holds several analyses.** This raises the layout file (`fmIDE-excel-mapping`) again: to **version 5**, after B2's version 4 (below).
4. **Two modes**, **percent** (relative) and **amount** (added; this covers percentage points). These are the same as step 16 and step 18.
5. **Licence**: ExcelExporter reads the documented `fmIDE-graph-board` format (`docs/file-formats.md`, CC BY 4.0) with **its own reader**, written in `src/excel-exporter/`. **No code moves from fmGraph** (Apache) into ExcelExporter (proprietary), or back. This is decision 10's "no code moves between them", kept.

## The design

### Bringing boards in: Layout → Use fmGraph boards…

- **Where from**: the boards that came with the model (a `.fmide` document's or workspace's `graphBoards`, also when fmIDE opens ExcelExporter), or a board file chosen or dropped (**Export all boards** in fmGraph, so it carries the scenarios).
- **ExcelExporter's own reader** (`readGraphBoards`, a new file under `src/excel-exporter/`): checks the kind and version (1–8; a newer one is refused with the reason, and the template form is refused). Every name and title is kept as text, every number forced to a number, every colour checked. Each widget is matched to the model's rows by canvas id, node id and name (capitals and outer spaces ignored), as fmGraph matches them. Anything not found is left out and counted.
- **A window** lists what the boards hold, each with a tick box (all ticked at first): the sliders (one Dashboard for all boards, with like sliders, meaning the same rectangle, periods and kind, written once), the scenarios, each Tornado / Spider, and each bar and chart. What can't be carried says why in words (an input inside a block, a rectangle not in the workbook, past a cut-off).
- **Copied into the layout** (`cfg.graph`, and new analyses in `cfg.sensitivities`): what was ticked, as plain settings ExcelExporter owns from then on. Using the command again shows what changed and **replaces after asking**. Layout → Reset and the existing undo of a layout change cover it.
- The sliders and scenarios move inputs, so the **Inputs tab** must be on. The command turns it on and says so. As with step 16, an input inside a block, or on a canvas used as a block, can't be moved, and is listed as such.

### Scenarios → row scenarios plus Global Cases

- **Global Case 1 is "Base"**: every input on its scenario 1, which is fmIDE's numbers.
- **Each fmGraph scenario becomes a further case**, in the scenarios' order, named after it (case names are row 3 of the Scenarios tab, as today).
- **For each input a scenario moves**, the input gets row scenarios on the Inputs tab: scenario 1 is fmIDE's numbers, then one row scenario for each different setting the fmGraph scenarios give it. Two fmGraph scenarios that set it the same way share one. The case's column on the Scenarios tab picks that row scenario, and 1 for every input the scenario doesn't move.
  - A **set** setting writes its number in the periods it covers. Other periods link to scenario 1.
  - A **shift** setting becomes **a formula on scenario 1**: `=<scenario 1's cell>*(1+x%)` in the periods it covers, so it follows when scenario 1 is changed in Excel.
- **Cut-offs**: at most **50 cases** (Base plus 49 fmGraph scenarios) and **20 row scenarios an input** (ExcelExporter's limits today, `MAX_CASES` and `MAX_SCENARIOS`). What goes past them is left out and **reported to the person** in the window and after Generate, naming the scenarios and inputs: "Scenarios after the 49th are not written: High growth, …", "Price needs 23 row scenarios; scenarios 20–22 use its scenario 1 in Excel: …".

### Sliders → the Dashboard tab

A **Dashboard** tab, first in the workbook, holds one row per slider:

| Name | Scroll bar | Position | Typed | Value | Use |
|---|---|---|---|---|---|
| linked to the input | a form-control scroll bar over this cell | the scroll bar's linked cell, 0–30,000 | empty, for a number typed | `=IF(ISNUMBER(Typed), Typed, min + Position × step)` | set sliders only: a check box's linked cell, TRUE / FALSE |

- **The scroll bar's linked cell holds a position from 0 to 30,000**, the largest range Excel's scroll bar takes. The value is **min + position × step**, using fmGraph's min, max and step. A slider with more than 30,000 steps gets a larger step ((max − min) / 30,000), and the window says so.
- **The value can be typed into**: a number in Typed wins over the scroll bar, and clearing it gives the scroll bar back. Min, max and step sit beside the row (typed cells), so they can be changed in Excel.
- **A shift slider defaults to 0**: its position starts where the value is 0, a change of 0%. If 0 is outside min–max, it starts at the nearest end, and the window says so.
- **A set slider has a "Use" check box, off by default**, so **the workbook opens on the base**. With Use off, the input follows its case. With it on, the slider's value replaces the input in the slider's periods. Its position starts at fmIDE's number, so ticking Use alone changes nothing until the scroll bar moves.
- **On the Inputs tab**, a moved input's own row puts these together, in this order: the scenario its Global Case picks (or its base row) → a set slider's value where Use is on → × (1 + shift%) for a shift slider → step 16's sensitivity parts. Only the slider's periods change, and every other tab still links to that row.
- The workbook still opens on fmIDE's numbers (Global Case 1, Use off, shifts 0), so "differs from fmIDE" stays empty.

### Tornado and Spider → several sensitivity analyses

- The layout holds **several analyses** (`cfg.sensitivities`, a list), each one step 16's whole setup: its outputs, period, points, chart placement and inputs moved, each `percent` or `amount` with Low and High. Each writes **its own Sensitivity tab** ("Sensitivity", "Sensitivity 2"…, or a name the person gives), with its own Data Table and its own Tornado and Spider charts. A Data Table's input cells must be on its own sheet, and each tab has its own C6 and C7.
- An input moved by several analyses gets each analysis's % part and amount part added on its Inputs-tab row: `(base) × (1 + Σ % parts) + Σ amount parts`. Only the analysis whose Data Table is running has a part that isn't 0, so each table still moves one input at a time.
- **From fmGraph**: a Tornado and a Spider with the same inputs, modes and period become **one analysis**, gathering their outputs; any other becomes an analysis of its own. Points come from the Spider, else 5. **Around the current slider positions** carries over as in Excel: the analysis moves the input as the Dashboard and the case leave it, because its parts come after them on the row. **A change applies to every period** of the input, as step 16 already does, and the output is read in the analysis's period (switchable in Excel, C5).
- The Sensitivity panel lists the analyses, with + Add, rename, ↑ ↓ and ×. Step 16's single panel becomes the editor for the one picked.

### Charts → Excel charts

On the Dashboard, under the sliders, in the board's order (wide charts the full width, narrow ones two to a row). They are written with ExcelExporter's own writer, which learnt charts in step 16:

- **A bar** → a **column chart** of the rectangle over its periods, from the rectangle's row.
- **Columns** → **stacked columns**: one series per part, one stack per group per period, from the parts' rows.
- **Flow** → a **stacked-column waterfall** with an **invisible base series** (no fill, no line). Each step's visible part sits on the running total before it. Start and total steps stand on 0, and subtract steps hang down from the total before. The helper rows (base, rise, fall) are written on the Dashboard under the chart, as formulas on the steps' rows, so the chart follows the sliders.
- Titles, names and colours are carried, each checked as text or as `#rrggbb`. A fixed scale (`scale`) becomes the axis's min and max.
- Every series carries fmIDE's numbers too, which is what Excel shows before it recalculates, as step 16's charts do.
- **A scenario waterfall** (layout `scenarios`) needs every case worked out at once. It is not carried in step 19 and is listed in the window as such (see "Open points").

### The layout file, versions 4 and 5

`fmIDE-excel-mapping` **version 4** (B2, done) holds `cfg.graph` with its `scenarios`, `from` and `board`; **version 5** (B3, done) adds `cfg.sensitivities`, and later phases add `sliders` and `charts` to `cfg.graph` (the owner's choice of 15 October 2026: each version step comes with the phase that needs it):

- `cfg.sensitivities`: a list of analyses (at most 10), each in step 16's form plus `name`. Version 4's one `cfg.sensitivity` becomes the first, named "Sensitivity", by a one-step upgrade of a copy (`.claude/rules/file-formats.md`), with a version-4 sample in `tests/fixtures/formats/`.
- `cfg.graph`: what Use fmGraph boards… copied:
  - `sliders`: row id, periods, mode, min, max, step, name;
  - `scenarios`: name, then settings of row id, mode, periods and value;
  - `charts`: kind (`bar`, `columns` or `flow`), title, wide, scale, and parts by row id with name, colour and role;
  - `from`: the boards' names, for the window's "replace" message.

  Read through `cleanGraphCopy`: rows no longer in the model, or no longer inputs, are dropped, and everything else is read as in `cleanSensitivity`.
- An older ExcelExporter asks before opening a newer version, and keeps only what it knows (the first analysis). Documented in `docs/file-formats.md` (CC BY 4.0) in the same pull request.

### What the Excel version cannot do

- **Form controls don't show in Excel on the web**, and **LibreOffice may not show them either** (it reads some form controls from `.xlsx`, not always with their link). Google Sheets has none. In all of these **the typed cell always works**: Typed, and TRUE / FALSE typed in Use, drive the model the same way. The Dashboard says so in a one-line note at the top.
- The step 16 limits on Data Tables still hold for each analysis: Google Sheets shows the numbers written in, and LibreOffice calculates them only once the file is saved in its own format.
- A board's look (gliding bars, Trace, the A/B snapshot, the phone's mixer) stays in fmGraph. The workbook carries what changes numbers and the charts that show them.

### The usual rules

- **Never read at Generate**: Generate reads only the layout. Nothing from a board file reaches the workbook unless it was copied and then cleaned.
- **Text from files is escaped**: every name, title and scenario name is written through the writer's `esc()`. Nothing is run as code.
- **The look belongs to ExcelExporter** (`.claude/rules/format-roles.md`): the Dashboard's cells take the person's Excel style (typed cells as Inputs, formulas as Calculations, names as Links). fmGraph's colours are used only for the chart series, as fmGraph's own choices for its charts.
- **Every new command goes in the File or Layout menu** (`.claude/rules/excel-exporter.md`), and the page stays short on words.
- Nothing is sent anywhere. The single file stays offline.

## Phases, one pull request each

B0 came first (the writer, the riskiest part); then the owner's order (15 October 2026): B2, then sensitivity, then sliders and charts.

| Phase | Holds |
|---|---|
| **B0** | **The writer learns form controls and stacked charts** (done, 15 October 2026; the owner's request: the writer first, as the riskiest part): `ws['!controls']` — scroll bars and check boxes with a linked cell, as `xl/ctrlProps` parts plus a VML drawing, beside a sheet's charts — bar charts `stacked` / `percentStacked` (overlap 100), and a `noFill` series for the waterfall's base. App unchanged. Tests: group 65 (parts, rels, content types, well formed, escaped, a sheet with charts and controls, LibreOffice opening and recalculating). Checked in desktop Excel by the owner from `tests/output/step19-b0-controls.xlsx`. |
| **B2** ✅ | **Use fmGraph boards… and the scenarios** (done 15 October 2026, before B1, at the owner's request): ExcelExporter's own board reader (`04c-graph-boards.js`), the window and File → Import fmGraph boards… (`09i-graph-scenarios.js`), the copy (`cfg.graph`, layout file 4; replace after asking); scenarios → row scenarios and Global Cases (Base, set and shift, shared settings, cut-offs reported). Tests: group 77. |
| **B3** ✅ | **Several analyses and the layout file version 5** (done 16 October 2026): `cfg.sensitivities` (the panel's list: + Add, rename, order, remove; a Sensitivity tab, Data Table and charts for each; parts added on a shared input's row) and `cfg.graph` read and kept through `cleanGraphCopy` (filled from B2), the upgrade from version 3, the sample and its test, `docs/file-formats.md`, help, What's new. Tests: group 67 extended (two analyses sharing an input, each table moving only its own, LibreOffice recalculating both, fmIDE's numbers in both), group 6 (version 4 opening as one analysis, version 5 written). Also Tornado / Spider from fmGraph → analyses, through Use fmGraph boards…. |
| **B4** | **The Dashboard and its sliders**: the Dashboard's rows, with B0's form controls, the Inputs-tab formula order, the starting positions, the note. Tests: the new group (typed values and TRUE in Use moving the model in LibreOffice the same as fmGraph's sliders; a shift slider at 0 and Use off giving fmIDE's numbers, so "differs" stays empty; one period only; past 30,000 steps), and a check in the real Excel the owner uses (Windows and iPhone, as for the writer at first), recorded here. |
| **B5** | **Charts on the Dashboard, and finishing**: bar → column, columns → stacked columns, flow → stacked-column waterfall with the invisible base, scale, colours, layout under the sliders. Uses B0's stacked and no-fill series. Tests: the new group (each chart's series pointing at the right rows, the waterfall's helper rows against fmGraph's `flowFigures` for the same board, what Excel shows before recalculating). Then the finishing: help topic "fmGraph in Excel" and its Help sentences, the To Excel tutorial (or a new one) taking a model with boards through to the Dashboard, the phone screen (step 17, P3) listing the Dashboard, `README.md` (what a person does differently), an end-to-end test from fmIDE (Open fmGraph, a board with a slider, a scenario and a Tornado, Open ExcelExporter, Use fmGraph boards…, Generate, recalculate in LibreOffice, agree with fmGraph), and a short "how it turned out" here. |

### How B2 turned out (15 October 2026)

- **The layout file**: storing the scenario names, settings and matrix needed new data, so the layout file went to version 4 with only `cfg.graph` (scenarios, `from`, `board`), a do-nothing upgrade from version 3 and a version-3 sample (`map-v3`); "several analyses" moves to B3 and version 5. The old `map-newer` sample (version 4) is current now; `map-newer-v5` replaced it in group 6.
- **The reader** reads versions 1–8 (8, step 18's Tornado and Spider, arrived while B2 was in review; its Tornado and Spider charts are read from B3); scenarios from version 3 on. A setting is matched by canvas id, node id and name, kept only on an input outside any block; the window counts the rest by reason. A scenario setting an input twice (two sliders, different periods) becomes one row scenario, its settings applied in order.
- **The workbook**: the plan (`graphScenarioPlan`) is worked out from the layout at Generate; an input it moves takes its scenario count from it (its own scenarios control is off), and the Global cases number shows the plan's, off. Inputs with scenarios of their own keep them on scenario 1 in every case. A shift is `=<scenario 1>*(1+x%)`, or `(1-x%)` for a cut.
- **Checked**: group 77, including LibreOffice recalculating every Global Case against fmGraph's own `fmGraph.value` with the same scenario shown, within a millionth.


### How B3 turned out (16 October 2026)

- **The layout file** went to version 5: `cfg.sensitivities`, at most 10, each step 16's settings plus `name` (and `origin: "fmGraph"` for those made from a board). A version 4 file, and a layout kept in the browser by an older ExcelExporter, open as one analysis named "Sensitivity", whose tabs keep their names (Sensitivity, Tornado, Spider), so existing workbooks come out unchanged; the export also writes the first analysis as `cfg.sensitivity`, so an older ExcelExporter keeps it. Samples `map-v4` and `map-newer-v6`.
- **The panel** edits the analysis picked from a list at its top (+ Add, Name, ↑ ↓, ×, which asks). Building it found a bug: typing a name and clicking straight into Low lost the click, because the panel redrew itself as the name changed; renaming now redraws only the list.
- **The workbook**: each analysis its own tab (named after it, made unique), Data Table and charts ("<tab> Tornado" / "<tab> Spider" for any but the one named Sensitivity); an input moved by several gets every one's % and amount parts added on its Inputs-tab row. An input hidden in fmGraph (`show: false`) is written with Show 0.
- **From fmGraph**: the window lists the picked board's Tornado and Spider charts (board file 8, read by ExcelExporter's own `readGraphSensCharts`); a Tornado and a Spider moving the same inputs alike in the same period become one analysis, outputs gathered, the Spider's points. Use adds them marked (fmGraph), replacing earlier ones after asking and keeping the person's own; an untouched default analysis gives way. The charts' colours are not carried (the owner's choice: decided with the Dashboard's charts, B5).
- **Checked**: groups 67 (several analyses, two sharing an input, LibreOffice working both out, an older saved layout), 77 (fmGraph making the charts, ExcelExporter turning them into analyses, LibreOffice giving fmGraph's own `chart(id)` Low and High figures) and 6 (versions 4 and 6).

## Open points for the owner

- **The scenario waterfall**: leave it out (recommended for step 19), or a later phase writing each case's outputs with a Data Table over the Global Case cell, then a waterfall of them.
- **The Dashboard's place**: the first tab (recommended, so the workbook opens on it) or after the Scenarios tab.
- **Chart colours**: fmGraph's colours from the board (recommended, as the board's own choice for its charts), or the person's Excel style for every series.
- **At most 10 analyses**: chosen (16 October 2026).

## Risks

- **Form controls in the writer** are the newest and least-tested part of the Excel format here. B4 is checked in the real Excel before it is merged, as the writer was at first.
- **Recalculation time**: several Data Tables in one workbook multiply step 16's cost. The Dashboard note mentions *Automatic except for data tables*.
- **Agreement**: fmGraph and Excel must give the same numbers for the same slider positions, scenario and analysis. The B2–B5 tests compare them within a millionth (`AGREE_TOLERANCE`), as the step-7 agreement tests do for the model itself.
