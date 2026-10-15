# Step 18 — Tornado and Spider charts in fmGraph

The owner's request (15 October 2026): fmGraph shows a **Tornado** and a **Spider**, so a person sees on a board which inputs move an output most, the way ExcelExporter's Sensitivity tab does in Excel (step 16, `docs/step16-sensitivity.md`). Step 19 (`docs/step19-fmgraph-in-excel.md`) carries these charts into Excel as ExcelExporter's sensitivity analyses.

This is the brief, approved by the owner on 15 October 2026 with the changes listed under Phases; phase A1 is built. The owner's choices it rests on are decision 12 in `docs/decisions.md`.

## The owner's choices (15 October 2026)

1. **Measured around the current slider positions.** The base of a Tornado or Spider is the model as the board shows it now, with the sliders where they stand, not the model's own numbers. Moving a slider moves the base, and the chart is worked out again.
2. **Two modes for each input moved:** **percent** (relative: −10% takes 100 to 90) or **amount** (added: −2 takes 100 to 98). Amount also covers **percentage points**: a rate kept as 0.05 moved by +0.01 becomes 0.06, which is one point. They are the same two modes as step 16 (`by: "percent"` / `"amount"`), so a chart carries straight into ExcelExporter in step 19.
3. **A change applies to every period of the input. The output is read in one chosen period.**

## Why

- **A slider answers "what if this moves?" one input at a time.** A Tornado answers "which inputs matter most here?" for all of them at once. A Spider shows whether each one's effect is straight or bends.
- **Around where the sliders stand** because that is the case the person is looking at: they set a scenario on the sliders, then ask what matters most in that case.
- **The same settings as ExcelExporter.** This keeps the step-19 copy faithful: a Tornado built on a board means the same thing on the workbook's Sensitivity tab.

## The design

### Two new chart layouts

A Tornado and a Spider are charts on a board, beside `columns`, `flow` and `scenarios`: `layout` `tornado` and `spider`. They are added from + Chart and changed in Edit chart, like the others. Each holds:

- **The output**: one rectangle, named by canvas id, node id and name, like every widget.
- **The period** it is read in: one period, from 0.
- **The inputs moved**, in order: any input rectangle of the model by the shared rule (`src/shared/input-rule.js`). A new chart starts with the inputs the board's sliders move. Each input has `by` (`percent` or `amount`), `low` and `high` (−10 / +10 by default; −1 / +1 for an amount), and `show` (to keep it in the chart's list but leave it out of the drawing).
- **The Spider's points** (`steps`): 1–10 points between the base and each of Low and High, 5 by default, as in step 16.

Limits: at most 50 inputs a chart (20 in the first draft; changed to match ExcelExporter at the start of A1), as many outputs as charts (one each). Names, titles and the period are read like any chart's (`cleanChart`). Each input row in Edit chart says what Low and High are in the input's own numbers now ("Price: 9.00 … 11.00").

### How a number is worked out

- **The base** is the board's current results: the model with the sliders it counts laid over it (`liveSliders()`, so shared positions count, and so does a scenario shown or A held).
- **Moving one input**: its number in **every period**, as the sliders leave it, is changed by the mode (percent: × (1 + low / 100); amount: + low), and every other input stays where the sliders put it. The output is read in the chart's period. A slider that covers only some periods still sets the base in those periods, and the change goes on top in every period.
- The calculation is the one fmGraph already has (`03-calc.js`): each moved set of numbers is one `evaluateModel` run, kept in `resultCache`. A Tornado needs 2 runs an input; a Spider 2 × points. On a model slower than `SLOW_MS` (25 ms) they are worked out after the sliders stop moving, not on every step of a drag. The chart says "working out…" until then.
- **Swing** is |High − Low| of the output. The Tornado sorts by swing, largest at the top, and equal swings keep the inputs' order. This is the same rule as step 16's Rank, so step 19's Excel Tornado and fmGraph's agree.
- A run that can't be worked out (an error in the model at that number) shows that input as a gap with the reason in words. It never stops the chart.

### What is drawn

- **Tornado**: one horizontal bar per input shown, from the base to Low and from the base to High, in two colours (`colour` for Low and `colour2` for High, each `#rrggbb`), with the base as a line down the middle and each end's value at the bar's end. Names on the left, sorted by swing.
- **Spider**: one line per input through its points, across from Low (left) to High (right), as a share of Low / High (−100% … 0 … +100%), with the output's value up the side and the base where every line crosses. The key's swatches pick colours, as on other charts.
- Both take a fixed vertical scale (`scale`, board file 5) on the output's axis, Trace (🔍 shows the inputs moved), and the phone's quick look, Show and Share (step 17), through the chart code they already go through.
- They follow the sliders: moving a slider redraws them, gliding as bars do (unless the device asks for reduced motion).

### The board file

Board file **version 8**: a chart of layout `tornado` or `spider`:

```
{ "type": "chart", "wide": true, "layout": "tornado", "title": "What moves Profit",
  "output": { "canvasId": "cProfit", "nodeId": "profit", "name": "Profit" }, "period": 2,
  "inputs": [ { "canvasId": "cProfit", "nodeId": "price", "name": "Price", "by": "percent", "low": -10, "high": 10 },
              { "canvasId": "cProfit", "nodeId": "rate", "name": "Tax rate", "by": "amount", "low": -0.01, "high": 0.01, "show": false } ] }
```

Both carry `"steps": 5` (the Spider's points each side; as built, `points` in the first draft). Rectangles are named and matched as in every board. An input that is no longer an input of the open model is left out and counted. `low` and `high` are numbers cut to ±1,000,000,000; `by` other than `amount` reads as `percent`. These charts are **never in the template form**, as with the newer chart settings. Version 7 files read as before. An older fmGraph asks before opening version 8 and shows these charts as empty. The format goes in `docs/file-formats.md` with a version-7 sample in `tests/fixtures/formats/`.

### What stays the same

- fmGraph never changes the model: a Tornado or Spider moves numbers only inside its own runs.
- Nothing is sent anywhere. Every name is shown through `textContent`, and every number read from the file is forced to a number.
- No code is shared with ExcelExporter (decision 10).

## Phases, one pull request each

| Phase | Holds |
|---|---|
| **A1** | **Both charts, without the full editor** (the owner's choice, 15 October 2026): the calculation (`sensitivityFigures` in `04b-charts.js`: base, Low, High and swing per input, the Tornado sorted, the Spider's points), both drawn (`05b-chart-render.js`), the board file version 8 with its `cleanChart` rules, the sample and test, `docs/file-formats.md`, help topic and What's new, `window.fmGraph` reading a chart's figures. A minimal way to add one: Tornado or Spider chosen at a chart's top measures the first calculated rectangle with every input that reaches it (`model.reach`); Edit chart chooses the output, the period and the Spider's points, and lists the inputs. |
| **A2** | **The full editor**: Edit chart's inputs with mode, Low, High and Show, and Low and High in the input's own numbers ("Price: 9.00 … 11.00"), adding and removing inputs; a tutorial step or a fifth tutorial (the owner to say which; recommended: a step in the existing "Explore" tutorial, with its action in group 58), help and What's new. Then a short "how it turned out" here. |

### Changed from the brief at the start of A1 (the owner, 15 October 2026)

- **A1 holds both charts**; the full editor moves to A2.
- **The same limits and names as ExcelExporter's `cfg.sensitivity`**: at most **50** inputs (not 20), and the Spider's points are **`steps`** (not `points`).
- **A new chart's inputs** are those that reach its output (`model.reach`), not the board's sliders.
- **`show`, `colour` and `colour2` are in the file from version 8**, so A2 adds only their controls, not another version.

### How A1 turned out (15 October 2026)

- **The calculation** reuses the sliders' own: the base is the overrides the board shows now (`shownOverrides()` in `03-calc.js`: the sliders it counts, or A held on a phone); moving one input copies them and changes only that input in every period (`movedOverrides`); each set is one `resultsWith` run, kept in the result cache. The Spider's outer points are the same runs as the Tornado's ends, so they agree exactly.
- **Kept per chart** (`sensitivityMemo`): a redraw that changes neither the base nor the chart's settings works nothing out. **Slow models**: when a chart would take longer than 60 ms (`SENSITIVITY_BUDGET_MS`: the model's time × its runs), it waits until the sliders have stopped for 300 ms and is worked out in small pieces, showing "Working out…" and its last drawing faded. This is judged by the whole chart's cost rather than the 25 ms per run of the sliders, since a Tornado of 50 inputs is 100 runs.
- **Drawing**: the Tornado's bars lie across the page and glide sideways (`data-axis="x"` in `glide`); its fixed scale runs across, with ◀ / ▶ past it. The Spider's lines break where a point can't be worked out. The key's swatches pick Low / High (Tornado) or each input's colour (Spider). The phone's quick look and Show draw them through the same code.
- **Found along the way**: a Spider switched from a Tornado on a model where it waits could briefly be drawn from the Tornado's figures (which have no points) and fail; the kept figures now remember their chart's kind. Caught by test group 76 before it was pushed.
- **Tests**: group 76 (`tests/76-fmgraph-sensitivity.spec.js`). The groups that checked the board file's version (49, 56, 57, 73) now expect 8, and group 49's "newer version" file is version 9.

## Open points for the owner

- **Tornado and Spider as one chart with a switch, or two charts?** Recommended: two layouts, as above, so a board can show both side by side and step 19 maps each to its own Excel chart.
- **Several outputs on one chart** (step 16 lets Excel switch among outputs). Recommended: one output per chart in fmGraph. A board holds as many charts as it needs, and step 19 gathers one analysis's outputs from them (see step 19, B2).
- **The tutorial** in A2: a step in an existing tutorial (recommended) or a tutorial of its own.

## Risks

- **Cost on a large model**: 20 inputs × 10 points × 2 sides is 400 runs for a Spider. Worked out after the drag and cached, so it stays responsive. `npm run bench` is measured before and after A1, and the result goes in the pull request.
- **Inputs that are 0**: percent of 0 is 0, so the bar has no length. The input's row in Edit chart says so and suggests amount.
