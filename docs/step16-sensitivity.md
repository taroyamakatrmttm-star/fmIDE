# Step 16 — Sensitivity in ExcelExporter: the Tornado and the Spider

The owner's request (8 October 2026), from an example workbook (Volume × Unit Price = Revenue): ExcelExporter writes a **Tornado** and a **Spider** into the workbook, so a person sees how much each input moves an output.

## The owner's choices

1. **Live in Excel** — an Excel Data Table (What-If Analysis), not numbers fixed when the file is written; fmIDE's own numbers are written into the table's cells as well, so the file shows them before Excel recalculates.
2. **Outputs and period** — the person picks the outputs (rectangles) and the period in ExcelExporter; in Excel, a cell picks among those outputs and another the period.
3. **Change by % or by an amount** — chosen for each input moved.
4. **Where the charts go** — chosen in ExcelExporter: on their own tabs, or on the Sensitivity tab.

Phases, one pull request each: **A** the calculation (the panel, the Inputs tab, the Sensitivity tab, its Data Table, the Tornado and Spider tables, the mapping file); **B** the charts (ExcelExporter's own Excel writer learns charts), each with its docs and help.

## How it works

- **The panel** (sidebar, under Inputs & scenarios; `09g-sensitivity.js`): ☐ Tornado and Spider, the outputs (any rectangle row the workbook writes), the period, the Spider's steps (1–10 points between the base and each of Low and High), and the inputs to move: each one `%` or `amount`, with a Low and a High (−10 / +10 by default; −1 / +1 for an amount). Only inputs gathered on the Inputs tab can be moved, and not one inside a block or on a canvas used as a block (every copy of the block shares it). The panel says why there will be no Sensitivity tab, when there won't.
- **The Inputs tab**: a moved input gets a **Base (before sensitivity)** row above it — or, with scenarios, its scenarios are its base — and its own row becomes `(base) × (1 + % part) + amount part`, both parts read from the Sensitivity tab. Every other tab links to that row as before.
- **The Sensitivity tab** (after the model's tabs):
  - **C4** the output (a number, 1…), **C5** the period (1…), **C6** the input moved (0 = none), **C7** the point (−n Low … 0 … n High), **C8** the output now — `CHOOSE` over the outputs, `INDEX` over the period columns (no `OFFSET`, which Excel recalculates on every change); a check beside C6 says when it isn't 0.
  - **The outputs**, linked to their rows.
  - **The inputs**: No, name (linked), UOM, Change by (`%` or `amount`), Low, High, Show (1/0) — all typed and changeable in Excel — then Change now (`IF($C$6=No, Low or High scaled by the point, 0)`), its % part and amount part, and a label (`Name (−10% / +10%)`).
  - **The Data Table** beside them: its corner is `=$C$8`, its top row the points, its left column the inputs' numbers; `TABLE` with C7 as the row input cell and C6 as the column input cell — one table gives both the Tornado (its end columns) and the Spider (every column). Its cells hold fmIDE's numbers (the shared IR with the input's numbers laid over its typed ones, `sensitivityValues`).
  - **Low vs base, High vs base, Swing, Rank** per input: the rank by `SUMPRODUCT`, largest swing first and equal swings in the inputs' order (the example's `LARGE` / `MATCH` showed one input twice when two swings were equal), only inputs shown.
  - **The Tornado table**: the inputs by rank, each one's Low and High against the base (`#N/A` where there are fewer inputs shown).
  - **The Spider table**: each input's line through every point (`#N/A` when hidden), under the points as a share of Low (−) / High (+).
- **Settings** are kept with the layout: `mapping.cfg.sensitivity` (`cleanSensitivity`), mapping file version 3.

## Known limits

- A Data Table works the whole model out once for each of its cells (inputs × points). On a large model Excel may take a while; *Formulas → Calculation Options → Automatic except for data tables* pauses it.
- LibreOffice reads a Data Table (as `MULTIPLE.OPERATIONS`) but leaves it uncalculated when it opens an `.xlsx`; opened again from its own format it works it out. The tests do that (`recalcDataTables`, `tests/helpers/soffice.js`). Google Sheets has no Data Tables: it shows the numbers written in.

## How it turned out

**Phase A** (8 October 2026): as above. Test group 67 (`tests/67-excel-sensitivity.spec.js`): the panel, the workbook's formulas and Data Table, fmIDE's numbers written in, LibreOffice working the live table out again (the model's own numbers unchanged, the tables following a Low and a Show changed in the file), an input with scenarios, a block model (an output on a canvas and one inside a block, against the shared IR in Node), off = the workbook as before, rows left out, a mapping file's settings checked and names as text. Group 6: the mapping file's version 3, and a version 2 file opening with Sensitivity off.
