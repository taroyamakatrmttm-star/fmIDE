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
- **D — Function plugins** (in progress, below). Families and versions like templates, carried inside system and workspace files (`system` v5, `fmIDE-workspace` v4, new `fmIDE-functions` v1). Three pull requests: D1 the shared core and file formats ✅, D2 fmIDE (Functions manager, function nodes, `window.fm`), D3 ExcelExporter and agreement.
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


## Phase D — function plugins

Decisions taken at the start of the phase (September 2026; the owner chose the recommendation each time):

1. **A function node looks like a block instance:** a box titled "ƒ Margin v2", with one labelled port per input on the left and one output. Each arrow goes into a named port (`toPort`, counted from 0 in the definition's order). An input with no arrow is an error where the formula reads it: "?" in fmIDE, `#N/A` in Excel.
2. **Functions may call functions,** pinned to the version they were saved with (the definition's `calls` list, never the name alone). A loop is possible only in a hand-edited file: "?" and `#N/A`, listed before download. Calls nest at most 16 deep.
3. **Units are worked out from the formula** with the catalogue's rules. A number in the formula counts as a plain number for × and ÷ and is left out where units must match.
4. **Versions follow the template approach:** a node is pinned to its version; a newer version in the library shows ⬆ and offers "Update" (one node, or every use), matching ports by input name; "Not now" is remembered. A definition missing from the file is "?" and `#N/A`, listed before download.
5. **Syntax in Phase D:** inputs by name, numbers, brackets, a leading minus, `+ - * / ^` (and `− × ÷`), one comparison `< <= > >=`, and today's operators by their Excel names with Excel's numbers of inputs (`MIN MAX AVERAGE ABS MOD IFERROR`), plus calls to other functions. Excel's precedence (`-2^2` = 4). Rejected with a message: chained comparisons, `%`, and Excel functions kept back for phase E (`IF`, `ROUND`…). Parse errors show where they are; the editor keeps Save off until the formula reads.
6. **The whole syntax is written down** in `docs/file-formats.md` (CC BY 4.0), so others can write functions for the community library.
7. **Modules and templates carry functions too:** `module` v3 and `fmIDE-templates` v4.

Phase C's open items stay separate changes: loading a large model into ExcelExporter (drawing the rows list), calculating each period from scratch (best done soon after D, since functions add work in every period), and an operator with unknown text passing its first input through (phase E). A function node never passes an input through: an unknown function is always "?".

### D1 — the shared core and the file formats ✅

What was built:

- **`src/shared/functions.js`** (new, from fmIDE's side, Apache):
  - `parseFunctionText(text)`: a hand-written reader, no `eval` and nothing like it. It returns the name, the inputs and a small tree of plain objects (numbers, inputs, a minus, catalogue operators by id, calls), or a message with the place of the error. Limits: 4,000 characters, 32 inputs, 64 levels, 64-character names. Its lookup tables have no prototype, so a name like `constructor` is only a name.
  - `cleanFunctionDefinitions(list)`: keeps only well-formed definitions from a file, and only the fields listed in `docs/file-formats.md`.
  - `compileFunctions(list)`: parses the definitions a model carries, links each call to its version through `calls`, and marks what can't be calculated (unreadable, missing, a loop, too deep, a wrong number of inputs).
  - `runFunction(fn, input)`: calculates a call, reading each input only when the formula needs it. `functionUnit(fn, inputUnit)`: its unit. `functionsUsedBy(canvases, list)`: the definitions a file must carry.
- **`src/shared/ir.js`:** `compileModel` also reads the system's `functions` (a model without any compiles none, so it costs nothing). A node of type `function` is compiled against them; `evaluateModel` and `unitOf` calculate it. New error codes: `function-missing`, `function-unreadable`, `function-cycle`, `function-too-deep`, `function-arguments`, `function-input-unwired`. Tracing (for ExcelExporter's list) follows a failing input to where it starts.
- **`src/shared/input-rule.js`:** reaching outside the timeline follows a function node through its inputs, like an operator, so a corkscrew through a function shows its typed opening balance in period 1.
- **File formats:** `system` v5, `module` v3, `fmIDE-workspace` v4, `fmIDE-templates` v4, and the new `fmIDE-functions` v1; every upgrade step changes nothing (older files have no functions).
- **fmIDE** (`src/fmide/js/11b-functions.js`, new): keeps the library (`FUNCTIONS`, saved in the workspace and the autosave) and the definitions the open model carries (`modelFunctions`), and calculates with the latter. Save System, Save Module, templates made from the open model, Export Workspace and `.fmide` documents carry the definitions they use; opening any of them brings the definitions along and adds them to the library. Error messages for the new codes.
- **ExcelExporter:** reads the definitions, calculates function nodes for the "differs from fmIDE" check, and gives function nodes no row of their own. Until D3 writes calls out in full, a cell that reads a function call gets `=NA()`, an error in Excel rather than a wrong number.

How it was checked:

- New test group 20 (`tests/20-functions.spec.js`, 75 tests): the parser's accepted and rejected text (message and place), its limits, and hostile text; the samples `tests/fixtures/functions/basic.json` and `broken.json` with known answers and units in Node and the same values in fmIDE; each file carrying its definitions (Save System, Save Module, Export Workspace, the autosave, a template).
- New old-version samples `ws-v3.json`, `module-v2.json`, `templates-v3.json` open and are saved in the current versions. `sys-newer-v5.json` and `ws-nested-newer.json` are ordinary files now; `sys-newer-v6.json` and `ws-nested-newer-v6.json` take over the "asks first" tests. Tests that pin the current version numbers were raised by one (groups 6, 13, 14, 15 and 16).
- Every other test, the workbook snapshots and fmIDE's pinned values are unchanged.
- The whole suite passes: 435 tests, LibreOffice included.
- **Speed** (`npm run bench`, median of 15, same machine; old and new builds run back to back, twice). A model without functions is no slower:

  | | Before | After |
  |---|---|---|
  | fmIDE `fm.evaluate`, large model (1,865 nodes, 24 periods) | 1,110 / 1,094 ms | 1,108 / 1,128 ms |
  | ExcelExporter Generate, large model | 332 / 330 ms | 338 / 342 ms |
  | fmIDE `fm.evaluate`, biggest sample | 4.8 / 4.9 ms | 3.0 / 2.9 ms |
  | ExcelExporter Generate, biggest sample | 1.7 / 1.7 ms | 1.7 / 1.8 ms |

  The differences are within what repeated runs of the same build show.

### D2 — fmIDE: the Functions manager, the node, updating ✅

Decisions taken at the start of D2 (September 2026; the owner chose the recommendation each time):

1. **Where:** a new Insert-tab group **My Functions**; **Functions** also in File → Library (next to Templates), and Insert Function… in Home → Insert (D2b). The built-in operators' group is renamed **Excel Functions**. A customised ribbon gets My Functions once, on its Insert tab (`ui.functionsGroupAdded`; a ribbon without an Insert tab is left alone); a removed group stays removed. No default shortcuts.
2. **Calls in the editor:** a new version keeps what the previous version pinned (with an offer to move to the latest); otherwise a name one family has takes its latest version; a name several families share must be chosen (Save stays off); a name no family has blocks Save ("create it first").
3. **Deleting a function the open model uses** warns and never refuses: the model carries its own copy.
4. **The model's definitions (`modelFunctions`) join undo history** (the undo snapshot).
5. **"Update every use"** (D2b): a window listing every node of the family, those older than the target ticked except the ones marked "Not now"; nodes already on the target or newer left out; the arrows each would lose listed; one undo step.
6. **"Not now"** (D2b) remembers the declined version (`fn.skipped`); ⬆ returns when a newer one appears.
7. **Import clash** (same family and number, different content): the template rule — the next number, with a note, keeping its `versionId`; library lookups go by `versionId` first.
8. **Nested calls show no ⬆**: a function calling an older version is marked "calls an older version" in the manager; saving a new version moves it.
9. **Two pull requests:** D2a (the library and the manager), then D2b (the node, updating, copy and paste).

#### D2a — how it turned out ✅

What was built:

- **The library** (`src/fmide/js/11b-functions.js`): families and versions like templates (`functionFamilies`, `functionFamilyVersions`, `latestFunctionOf`, `nextFunctionVersion`); `libraryFunctionFor(ref)` finds a version by its `versionId` first, so a version renumbered on import is still found; `planFunctionCalls` and `checkFunctionDraft` decide how a formula's calls are pinned (decision 2) and whether it can be saved, using the shared parser and `compileFunctions` (loops, depth, numbers of inputs); `resolveFunctionRef` reads `Name`, `Name@latest`, `Name@2` and `<family>@2`.
- **Importing** (`addMissingFunctions`, used by Open, Import Workspace, Load System / Module and Import Functions) follows the template rules (decision 7) and returns `{ added, present, renumbered }`.
- **The Functions manager and editor** (`src/fmide/js/11c-functions-manager.js`, new): the list by family with older versions, "in this model" and "⚠ calls an older version" tags, and the family id when two share a name; the selected version's note, description, formula, inputs, calls and uses; + New Function…, Edit as new version…, ✎ Edit description, Delete (with the warning of decision 3), ⇩ Export Functions (tick which) and ⇧ Import Functions. The editor reads the definition as it is typed: name and inputs, the error with its place marked in a copy of the text, a choice for each call, and Save off until everything reads. Everything from a definition is shown with `textContent`.
- **`window.fm`** (`src/fmide/js/14b-actions-functions.js`, new): `saveFunction`, `listFunctions` (`of: 'model'` lists the model's own definitions), `getFunction`, `setFunctionInfo`, `deleteFunction`, `importFunctions` (a newer file needs `allowNewer`), `exportFunctions`. The manager acts through them, so macros record what it does.
- **Undo:** the snapshot carries `modelFunctions` (decision 4).
- **Commands and ribbon:** Functions and Import Functions… (the command the "wrong file" message has pointed to since D1), the My Functions group, the renamed Excel Functions group, File → Library.
- **Fix of a D1 problem:** the library could take two different versions under one number (a model carrying someone else's "v2" of a function you also have a v2 of). It now renumbers its copy; the model keeps its own.
- No file format changed.

How it was checked:

- New test group 21 (`tests/21-functions-fmide.spec.js`, 21 tests) with new samples in `tests/fixtures/functions/` (`library.json`, `library-fork.json`, `library-other-margin.json`, `library-newer-v2.json`); the fix's test fails without it. A new security test (group 5, `tests/fixtures/security/evil-functions.json`): markup in a formula, description, notes and a call's name is shown as text and nothing runs.
- Every other test, the workbook snapshots and fmIDE's pinned values are unchanged.
- The whole suite passes: 457 tests, LibreOffice included.
- **Speed** (`npm run bench`, same machine, `main` and D2a run back to back): the calculation code is unchanged, and a model without functions is no slower. `fm.evaluate` on the large model (1,865 nodes, 24 periods): medians 1,904–2,035 ms before, 1,854–2,043 ms after (five runs each); on the biggest sample, 60 runs, three times: 4.4–4.9 ms before, 4.2–4.3 ms after. ExcelExporter is untouched by D2a (about 610 ms to generate the large model).

#### D2b — how it turned out ✅

Decisions taken at the start of D2b (September 2026; the owner chose the recommendation each time):

1. **Look:** the block instance's box in teal (blocks are purple): "ƒ Name vN" with ⬆ beside the ⋯ button, inputs on the left, the value with its unit under it on the right. **Double-click** shows the definition (the Functions manager at that version, or the model's own copy, read only, when the library doesn't have it).
2. **Change in place:** "⋯ → Change function or version…", like a block's "⋯ Change block", through the same machinery as Update (older versions too).
3. **Updating one node** asks first only when arrows would be dropped; the `fm` actions never ask and return what they dropped.
4. **Pasting a different version under a number the model already uses:** it comes in under the family's next free number in the model (keeping its `versionId`, with a note) and the pasted nodes follow — the library's import rule, applied to the model. The same now applies to modules, Add System and templates.
5. **Unused definitions** leave the model as soon as the last node using them goes, in the same undo step.
6. **An arrow dropped on the box** goes into its first input without one. **A missing definition the library has exactly** (same `versionId`) can be added back from the node's menu.

What was built:

- **The node** (`src/fmide/js/11d-function-nodes.js`, new): `functionNodeState` works out a node's definition (from `modelFunctions` only, compiled once per change: `modelFunctionTable`), its inputs, the library's matching version (by `versionId`, `libraryFunctionFor`), whether a newer one is waiting (and not declined), and whether a missing definition can be added back. `renderFunctionNodeBody` draws it; a missing or unreadable definition draws a warning, "?" with the reason, and numbered ports for the arrows it has. Everything from a definition or from `fn` is set with `textContent`; a `fn.name` that isn't text shows "(unnamed)".
- **Wiring:** `fm.connect` / `fm.deleteEdge` take a function node's input by name (any capitals) or number from 1 (`resolveFunctionPort`); macros record the name. Dragging onto an input's dot wires it; onto the box, the first free input (`firstFreeFunctionPort`); from the output dot, an arrow out (no `fromPort`).
- **The model's definitions:** `addFunctionsToModel(list, onClash)` in `11b-functions.js` is the one way in: `'refuse'` (Insert: "already uses a different version 2 of Margin… update its nodes first"), `'renumber'` (paste, modules, Add System, templates, updates and adding a missing definition back), `'check'` (refuse without adding). It returns a `remap` the incoming nodes follow (`remapFunctionNodes`). `trimModelFunctions` runs where nodes or canvases go (Delete, Cut, Clear Canvas, Delete Canvas, Clear All, updates).
- **Updating:** `functionNodeUpdatePlan` matches each arrow to the new inputs by name (without a readable old definition, by position while the new version has that many inputs); `applyFunctionNodeUpdates` copies the target versions (and what they call) into the model, moves the arrows, drops the rest and trims — one undo step for any number of nodes, on any canvases. The ⋯ / ⬆ menu (Update to vN, Not now, Update every use…, Add the definition from your library, Change function or version…, Show definition), the "Update every use" window (every node of the family; ticked when older, unticked for "Not now" and for a version the library doesn't have; nodes on the target or newer left out; the arrows each would lose), and the command Update Function… (the selected node's function, or a choice among those with a newer version).
- **Copy and paste:** a copy keeps its nodes as deep copies (the shallow copy shared `fn` with the original) and the definitions they use (`clipboard.functions`); pasting brings them into the model and the library.
- **`window.fm`** (`14b-actions-functions.js`): `insertFunction`, `updateFunctionNode`, `changeFunction`, `updateFunctionUses`, `skipFunctionUpdate`, `addFunctionDefinition`; `fm.nodes()` shows `fn`. The windows act through them, so macros record what they do.
- **Ribbon and commands:** Insert Function… and Update Function… (no shortcuts) in My Functions, Insert Function… in Home → Insert; a customised ribbon's My Functions group gets them once (`ui.functionCommandsAdded`). The Functions manager has "ƒ Insert vN".
- **Files:** no format changed. `fn.skipped` is an optional field older apps ignore (`docs/file-formats.md`).

Problems found and fixed on the way:

- (D1) Loading a module, adding a system or inserting a template that carried a *different* version under a number the model already used kept the model's own and left the incoming nodes on "?" (function-missing). Decision 4 fixes it.
- (Earlier than step 7) Dragging an arrow passed node ids as bare words, which the automation layer reads as names unless they look like `n12`; in a model from a hand-written file (the function samples: `rev`, `fm1`) dragging failed. The drag now passes `#id`. Other on-canvas edits passed bare ids the same way (typing a rectangle's text, choosing an operator symbol, the reducer chip, the vertical port toggle, plugs, sockets, roles, period shifts, formats, per-period values); fixed in a separate change right after D2b, which also made the vertical port toggle clickable again (it sat under the output rows, and a click on it redrew the block before landing).

How it was checked:

- Group 21 grows by 20 tests (41 in all); group 5 gets one more (`tests/fixtures/security/evil-function-nodes.json`).
- Every other test, the workbook snapshots and fmIDE's pinned values are unchanged; `tests/snapshots/` didn't change.
- The whole suite passes: 478 tests, LibreOffice included (the session's LibreOffice lacked Calc at first, which skips the 27 recalculation tests; with Calc installed they ran and passed).
- **Speed** (`npm run bench`, same machine, `main` and D2b run back to back, twice; medians of 15). Nothing new runs for a model without function nodes (trimming, copying and pasting stop at once when the model carries no definitions):

  | | `main` | D2b |
  |---|---|---|
  | fmIDE `fm.evaluate`, large model (1,865 nodes, 24 periods) | 1,125 / 1,222 ms | 1,189 / 1,204 ms |
  | fmIDE `fm.evaluate`, biggest sample | 3.0 / 3.8 ms | 2.9 / 2.4 ms |
  | ExcelExporter Generate, large model (unchanged by D2b) | 419 / 376 ms | 373 / 370 ms |

  The differences are within what repeated runs of the same build show.

