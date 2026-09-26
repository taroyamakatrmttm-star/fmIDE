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
- **B — The shared IR, and fmIDE running on it** ✅ (below). `src/shared/operators.js` (operator catalogue by stable id) and `src/shared/ir.js` (`compileModel(system)`, a pure function of the file). fmIDE's evaluator runs the IR; error codes stay the same. UOM (unit of measure) comes from the IR in fmIDE (ExcelExporter in phase C).
- **C — ExcelExporter writes formulas from the IR** ✅ (below). Layout stays in ExcelExporter. The snapshots must not change. Its units come from the IR too. `compileModel` works out plug-to-socket connections itself, in both apps at once (decided in phase B). Ends with the "fmIDE shows ? here" list before download.
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

## Phase B — how it turned out

Decisions taken at the start of the phase (September 2026):

1. **Plugs and sockets:** `compileModel` will work out plug-to-socket connections itself, but only from phase C, when both apps switch together. In B it follows the file as saved (including the automatic aliases) and records each rectangle's plugs and each operator's socket, so the switch is small.
2. **Tests of the shared code in Node** (no browser, no app) are allowed, to prove `compileModel` reads nothing but the file.
3. **Timing** is a script (`npm run bench`), not a pass/fail test; its before and after numbers go in the pull request.
4. **Units** refresh when the model changes, not on every redraw (while a rectangle is dragged, when it is dropped).
5. **Each period is still calculated from scratch** (see "Found along the way"); changing that is a separate change.

What was built:

- **`src/shared/operators.js`** — the catalogue: one entry per operator with a lasting id (`add`, `subtract`, `multiply`, `divide`, `power`, `mod`, `le`, `ge`, `lt`, `gt`, `abs`, `min`, `max`, `average`, `iferror`), the symbol files save, its name, how it calculates (`applyOperator`) and its unit rule. fmIDE's operator palette and names come from it. Excel spellings are not in it (they stay in ExcelExporter, phase C).
- **`src/shared/uom.js`** — unit parsing and arithmetic, moved from fmIDE.
- **`src/shared/ir.js`** — `compileModel(system)`: reads `{ periods, canvases }` and nothing else, changes nothing in it, and builds indexed lookups (inputs sorted left to right, typed numbers, the input rule, block ports, operators by catalogue entry). `evaluateModel(ir)`: today's calculation, line for line, on the IR — same values, same error codes, same per-period results fmIDE stores. `unitOf(ir, canvas, node)`: the unit rules, remembered in the IR. Also `parseRectText` and `effectiveLiteral`, moved from fmIDE.
- **fmIDE** compiles and evaluates the IR in `evaluateAllNow()`. For units between calculations it keeps the IR and drops it wherever the model may change (history push, undo/redo, clearing values, loading a canvas, automatic plug connections); the canvas recompiles it when next drawn. The old evaluator and unit code are gone. `window.fm`, error messages and file formats are unchanged; ExcelExporter is untouched.

How it was checked:

- **Before switching**, a new test group 18 recorded what fmIDE showed for every node of every sample (value or error message per period, and unit), including two new samples (`tests/fixtures/ir/`: every error code and operator, blocks of every kind, and units). The same tests pass after the switch, as do all others (322 tests, LibreOffice included).
- The shared files alone, in Node, give the same values, errors and units for every sample and leave the file unchanged.
- A side-by-side comparison of everything the canvas shows (every canvas, every period) between the old and new builds, on the large generated model at 6 and 24 periods (44,760 readings) and the new samples: no differences.
- **Speed** (`npm run bench`, median of 9, same machine): the biggest sample (`combined-bs-corkscrew-block.json`, 33 nodes, 3 periods) 3.2 ms before, 3.1 ms after (mostly drawing); the generated large model (1,865 nodes, 21 canvases, 24 periods) 3,367 ms before, 1,222 ms after, thanks to the indexed lookups.

Found along the way (not changed):

- **Each period is calculated from scratch.** A corkscrew in period 24 recalculates periods 23, 22, … 1, so the time grows with the square of the period count, and with vertical blocks with its cube (the large model takes 0.65 s at 12 periods and minutes at 60). Keeping the results across periods would fix it; in models with a loop it could change which rectangle reports the loop, so it is a separate change with its own tests.
- In a loop, fmIDE reports "One of this operator's inputs could not be computed" rather than "This is part of a circular reference" on the loop's rectangles: the loop is detected, but when the calculation returns to the rectangle where it started, "missing input" replaces the loop code. Pinned as it is.
- `fm.getValue`'s error messages end with two full stops ("…computed..").
- An operator with unknown text (only a hand-edited file has one) passes its first input through, with no error. Kept; for phase E.
- ExcelExporter gives a block's Input port the unit of what feeds that instance; fmIDE does not. Phase C must add that rule to the IR (written from fmIDE's side) so the workbooks don't change.


## Phase C — how it turned out

Decisions taken at the start of the phase (September 2026):

1. **fmIDE shows units through blocks too.** A rectangle fed by a block shows the unit worked out through that instance, as the workbook already did.
2. **The "differs from fmIDE" list is a panel next to Generate**, filled when the model loads and after every layout change. It never blocks the download.
3. **The list also covers two places where fmIDE shows a number but Excel reads 0**: an operator fmIDE doesn't know (only a hand-edited file has one) and a row left out of the layout that other rows read.
4. **A block input port whose source fails** for any reason other than running out of timeline (or nothing feeding it) shows "?" in fmIDE, as a wired rectangle does since phase A.
5. **ExcelExporter's saved-layout key leaves out the automatic plug links.** A layout saved under the older key is still found.

What was built:

- **`src/shared/ir.js`**
  - **Plug-to-socket links:** `plugsOf` and `plugLinks` (moved from fmIDE) work out every link from the plug and socket names. `compileModel` sets aside the automatic links saved in the file and uses these. It keeps a saved link's id where it still matches, so fmIDE's drawn aliases still show values. An alias always sits where fmIDE draws it, 200 px left of its socket and 74 px lower per extra plug; that place decides the order an operator reads it in. fmIDE draws its automatic links from the same `plugLinks`, so the two cannot drift apart.
  - **Units through blocks:** `unitOf(ir, canvas, node, path)` takes the block-instance path. A fed Input port takes the unit of what feeds that instance's port, and an arrow from a block reads its Output rectangle's unit in that instance. A block inside itself has no unit.
  - **Block ports:** a port uses its typed number where nothing feeds it or its source needs a period outside the timeline; any other failure is "?" (decision 4).
  - **`evaluateModel(ir, { trace, instances })`:** optional, both off for fmIDE. `trace` records where each "?" starts (the node and its error code). `instances` also returns every rectangle's value inside every block instance.
  - **For ExcelExporter:** each compiled node keeps its saved node (`node`) and its outgoing arrows, and each canvas keeps its calculation-view `raw` { id, name, nodes, edges }.
- **ExcelExporter**
  - **Reading the model:** `loadModel` compiles the IR once. `model.canvases` are the IR's canvases, so the layout lists the plug links as the calculation sees them.
  - **Formulas:** `operandRef`, `buildOperatorFormula`, `buildCellContent`, the vertical-block helpers and the TRUE/FALSE check read the IR (inputs in the IR's order, ports, the input rule, port feeds) instead of scanning the graph.
  - **Operator spellings:** in `src/excel-exporter/js/01b-operator-spellings.js` (`EXCEL_SPELLINGS`, keyed by catalogue id).
  - **Units:** column B comes from `unitOf`. ExcelExporter's own copies of the unit code and the rectangle-text reader are gone; the shared ones are used instead.
  - **Loops and self-containing blocks:** a loop of operators, aliases or period shifts with no row to break it, and a block inside itself, now read 0 instead of recursing forever.
  - **Ports outside the timeline:** a port whose source needs a period outside the timeline writes the port's typed number, as fmIDE does.
- **The check before download** (`src/excel-exporter/js/09b-differences.js`, panel `#differencesPanel`):
  - A quick look at the IR decides whether anything could make fmIDE show "?" where Excel writes 0 or a blank: an alias to nothing, a missing canvas or rectangle, two arrows into a rectangle, a period shift without one input, an operator with no inputs, a missing block or block output, a block inside itself, an arrow from a missing node, or a loop (found by a search that doesn't count period shifts to another period).
  - Only if it finds something does it run fmIDE's calculation with `trace` and `instances`.
  - It then lists every row (block-instance rows included) where fmIDE shows "?" because of one of those, with the periods, where it starts, and whether Excel writes 0 or leaves the cell blank. Errors Excel shows too (a divide by zero) are not listed.
  - Text from the file is shown with `textContent`.

How it was checked:

- **Before switching**, a new test group 19 pinned ExcelExporter's unit column for every sample, since no model sample had a unit, so the workbook snapshots could not show a unit change. A new sample `ir/block-units.json` (units through blocks: nested, vertical, a port nothing feeds, an alias of a port) was pinned on the old build as well.
- **After the switch:**
  - Every workbook snapshot and every pinned unit column is unchanged.
  - fmIDE's pinned values are unchanged. Its units changed only in `fmide-values--ir--block-units.json`, deliberately (decision 1): six rectangles fed by blocks now show $k, $k, $/t, $k, $ and $k, the units the workbook already had.
- **Two new agreement samples**, both failing on the old build and passing now:
  - `agreement/stale-plug-links.json`: saved plug links out of date, missing and extra. The old ExcelExporter gave Net 889 and Total income 10, where fmIDE showed −125 and 7.
  - `agreement/block-port-timeline.json`: the old ExcelExporter wrote 1 where fmIDE showed 8, and fmIDE showed 8 where Excel had #DIV/0!.
- **Group 17 now compares the rows inside block-instance tabs** too, against the IR's per-instance values in Node: 36 to 48 readings per sample with blocks.
- **The whole suite passes:** 353 tests, LibreOffice included.
- **Speed** (`npm run bench`, now timing ExcelExporter's Generate too; median of 15, same machine, old and new builds run back to back):

  | | Before | After |
  |---|---|---|
  | Generate, biggest sample (`combined-bs-corkscrew-block.json`) | 2.4 ms | 1.9 ms |
  | Generate, large model (1,865 nodes, 24 periods) | 607 ms | 408 ms |
  | fmIDE `fm.evaluate`, large model (three alternating pairs) | 1,206 / 1,200 / 1,220 ms | 1,199 / 1,173 / 1,182 ms |

  The check before download costs nothing on a healthy model. With a broken link in the large model it adds one calculation when the model loads (about a second).

Phase A's remaining differences:

- **A block input port whose outer source reaches outside the timeline:** closed. Both apps use the port's typed number, or 0.
- **A vertical-block vintage row removed from the layout:** listed before download ("left out of the layout, but other rows read it"), together with any other row left out that formulas read. The workbook itself is unchanged: those formulas read 0, and the reducer skips the missing vintage.
- **Rows inside block-instance tabs not compared:** closed (group 17, against the IR in Node).
- **A broken alias, a loop, or a rectangle with two arrows in** (decision 6): listed before download.

Found along the way (not changed):

- **ExcelExporter could not generate `ir/error-cases.json`** ("Maximum call stack size exceeded": a block that contains itself made the formula writer recurse forever). Fixed here; its unit pin was recorded after the fix.
- **Loading a large model into ExcelExporter is slow:** about 10–13 s for the 1,865-node model, before and after this phase. Almost all of it is drawing the rows list (thousands of drop-downs, and reading scroll positions between them), not the calculation. Worth its own change.
- **fmIDE's automatic aliases are remade at the rule's place on every redraw,** so dragging one only lasts until the next change to plugs. The calculation now always uses the rule's place, so the order an operator reads its inputs in no longer depends on when fmIDE last redrew them.
- **An operator with an arrow from a node that no longer exists** (only a hand-edited file has one) is read in the order fmIDE uses. ExcelExporter used a slightly different order before, but only in that case.
