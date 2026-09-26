# Step 7 — Formula IR and plugins

**Goal.** The canvas and Excel always give the same numbers. Today fmIDE computes values from the graph (`computeValue` in `src/fmide/js/06-align-marquee-computation.js`) and ExcelExporter separately writes formulas from the same graph (`operandRef`, `buildOperatorFormula`, `buildCellContent` in `src/excel-exporter/js/01-core-translation.js`). The plan: one shared description of each calculation (the **IR**, intermediate representation) that both apps use. After that comes a plugin mechanism, so new functions can be added without editing the core.

## Agreed decisions (September 2026)

1. **Where the apps disagreed**, the agreed behaviour (both apps):
   - `%` works like Excel's `MOD`: the result takes the divisor's sign.
   - A comparison chain `a < b < c` means `a < b` and `b < c`.
   - `abs` with more than one input is an error (fmIDE "?", Excel `#N/A`).
   - `iferror` with one failing input, or with none, gives 0.
   - A period ticked under "Which periods use this rectangle's own number?" uses the typed number, even when the rectangle is wired.
   - A rectangle whose source needs a period outside the timeline (a corkscrew's opening balance in period 1) shows its typed number, or 0.
   - A rectangle fed by an operator that nothing feeds is an input: its typed number, or 0.
2. **Licence boundary:** nothing moves from ExcelExporter into `src/shared/`. The IR, the evaluator and the operators' meanings come from fmIDE's side. How each built-in operator is spelled in Excel stays in ExcelExporter, and a test checks that every shared operator has a spelling.
3. **Plugins are formulas held in files** (a function written with existing operators), read by our own parser. There are no code plugins: they would break the rule that text from files never runs.
4. **The IR is not saved in files.** The graph stays the only thing saved; the IR is rebuilt in memory.
5. **In Excel, a plugin function is written out in full** in each formula (works everywhere), not as a `LAMBDA` name.
6. **Errors versus 0:** Excel keeps writing 0 where fmIDE shows "?" for a broken link. ExcelExporter will list these before download (Phase C).
7. **Plugin formula syntax:** Excel-like, with named inputs.

## Phases (one pull request each)

- **A — Agreement tests and the agreed fixes** ✅ (below)
- **B — The shared IR, and fmIDE running on it.** `src/shared/operators.js` (operator catalogue by stable id) and `src/shared/ir.js` (`compileModel(system)`, a pure function of the file). fmIDE's evaluator runs the IR; error codes stay the same. UOM (unit of measure) comes from the IR in both apps.
- **C — ExcelExporter writes formulas from the IR.** Layout stays in ExcelExporter. The snapshots must not change. Ends with the "fmIDE shows ? here" list before download.
- **D — Function plugins.** Families and versions like templates, carried inside system and workspace files (`system` v5, `fmIDE-workspace` v4, new `fmIDE-functions` v1).
- **E — New built-in operators** (e.g. IF, ROUND, LN, EXP) through the catalogue (optional).

Things to keep in mind for later phases and for the community library (step 8): plugins are referred to by family id and version, never by name; their definitions travel with the model; `compileModel` must not read fmIDE's global state; plug connections could be worked out by the IR instead of relying on the automatic aliases saved in files; evaluation must not get slower.

## Phase A — how it turned out

- **New test group 17 (`tests/17-agreement.spec.js`):**
  - Every model sample (`tests/fixtures/models/`) and the new `tests/fixtures/agreement/operator-edge-cases.json` is opened in fmIDE, where values are read through `fm.getValue`, and in ExcelExporter. The workbook is recalculated by LibreOffice with the Inputs tab off and on.
  - Every rectangle that has its own row on its canvas's tab must show the same value in every period. An error on both sides counts as agreeing.
  - Known answers for the edge cases check that both apps are also right.
- **Before the fixes, the test confirmed every disagreement listed above, and found three more:**
  1. **A comparison with one input:** fmIDE passed the input through; Excel got `AND()`, an error. Now it is an error in both apps (fmIDE "?" with "A comparison needs at least two inputs.", Excel `#N/A`).
  2. **Rectangles on different canvases that share an id:** fmIDE's calculation memory was keyed by node id alone, so one canvas could show another canvas's number. In the `combined-bs-corkscrew-block.json` sample, DepBlock's Tax rate showed 0.2 (BS's AR outstanding rate) and Capex's Grand Total 60 (BS's Total Assets). Ids made inside fmIDE never repeat, but files from elsewhere can. The key now carries the canvas id.
  3. **A wired rectangle whose source failed for another reason** (e.g. a divide by zero) showed its typed number in fmIDE, but an error in Excel. It now shows "?" in fmIDE. The typed number is used only where the timeline runs out.
- **Shared rule:** `reachesOutsideTimeline()` in `src/shared/input-rule.js` decides, for both apps, when a rectangle's source needs a period outside the timeline. Inside an `iferror`'s first input, ExcelExporter writes such a read as `NA()`, so `IFERROR` falls back as fmIDE does.
- **Workbooks:** the only snapshot change is `block-input-rectangles`. There, Beginning Balance in period 1 was the formula `=0` and is now the number 0.
- **Still different, left for later phases:**
  - A broken alias, a loop, or a rectangle with two arrows in: "?" in fmIDE, 0 or blank in Excel (decision 6, Phase C).
  - A block input port whose outer source reaches outside the timeline: fmIDE uses the port's own typed number, Excel uses 0.
  - A vertical-block vintage row removed from the layout: skipped by Excel's reducer.
  - Rows inside block-instance tabs are not compared (fmIDE shows only a block's outputs), but the rectangles they feed are.
