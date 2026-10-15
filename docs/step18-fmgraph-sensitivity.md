# Step 18 — Tornado and Spider charts in fmGraph

The owner's request (15 October 2026): fmGraph shows a **Tornado** and a **Spider**, so a person sees on a board which inputs move an output most, the way ExcelExporter's Sensitivity tab does in Excel (step 16, `docs/step16-sensitivity.md`). Step 19 (`docs/step19-fmgraph-in-excel.md`) carries these charts into Excel as ExcelExporter's sensitivity analyses.

This is the brief, written for the owner's approval. Nothing is built yet. The owner's choices it rests on are decision 12 in `docs/decisions.md`.

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
- **The Spider's points**: 1–10 points between the base and each of Low and High, 5 by default, as in step 16.

Limits: at most 20 inputs a chart, as many outputs as charts (one each). Names, titles and the period are read like any chart's (`cleanChart`). Each input row in Edit chart says what Low and High are in the input's own numbers now ("Price: 9.00 … 11.00").

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

A `spider` also has `"points": 5`. Rectangles are named and matched as in every board. An input that is no longer an input of the open model is left out and counted. `low` and `high` are numbers cut to ±1,000,000,000; `by` other than `amount` reads as `percent`. These charts are **never in the template form**, as with the newer chart settings. Version 7 files read as before. An older fmGraph asks before opening version 8 and shows these charts as empty. The format goes in `docs/file-formats.md` with a version-7 sample in `tests/fixtures/formats/`.

### What stays the same

- fmGraph never changes the model: a Tornado or Spider moves numbers only inside its own runs.
- Nothing is sent anywhere. Every name is shown through `textContent`, and every number read from the file is forced to a number.
- No code is shared with ExcelExporter (decision 10).

## Phases, one pull request each

| Phase | Holds |
|---|---|
| **A1** | **The Tornado**: the calculation (`sensitivityFigures` in `04b-charts.js`: base, Low, High and swing per input, sorted), the chart drawn and edited (Edit chart: output, period, inputs with mode, Low, High, Show), the board file version 8 with its `cleanChart` rules, the sample and upgrade test, `docs/file-formats.md`, help topic and What's new, `window.fmGraph` reading a chart's figures for tests. Tests: a new fmGraph group, figures against the model worked by hand (percent and amount, a percentage-point input, a slider on one period, the base following the sliders and a scenario shown, equal swings keeping order, an error as a gap), the version-7 file opening, names as text, a slow model working out after the drag. |
| **A2** | **The Spider**: its points along the same runs, the chart drawn and edited (points 1–10), the phone's quick look and Show for both charts, a tutorial step or a fifth tutorial (the owner to say which; recommended: a step in the existing "Explore" tutorial, with its action in group 58), help and What's new. Tests: the Spider's lines against the Tornado's ends (the Spider's outer points equal Low and High), points, Show on a phone, the tutorial step. Then a short "how it turned out" here. |

## Open points for the owner

- **Tornado and Spider as one chart with a switch, or two charts?** Recommended: two layouts, as above, so a board can show both side by side and step 19 maps each to its own Excel chart.
- **Several outputs on one chart** (step 16 lets Excel switch among outputs). Recommended: one output per chart in fmGraph. A board holds as many charts as it needs, and step 19 gathers one analysis's outputs from them (see step 19, B2).
- **The tutorial** in A2: a step in an existing tutorial (recommended) or a tutorial of its own.

## Risks

- **Cost on a large model**: 20 inputs × 10 points × 2 sides is 400 runs for a Spider. Worked out after the drag and cached, so it stays responsive. `npm run bench` is measured before and after A1, and the result goes in the pull request.
- **Inputs that are 0**: percent of 0 is 0, so the bar has no length. The input's row in Edit chart says so and suggests amount.
