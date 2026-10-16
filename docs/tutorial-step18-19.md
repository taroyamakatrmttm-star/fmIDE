# Tutorial: what's new in pull requests #144 to #156

A step-by-step guide to everything added in pull requests #144 to #156 (15–17 October 2026): step 18 of the build order, **Tornado and Spider charts in fmGraph**, and step 19, **fmGraph in Excel**. Step 19 carries a whole fmGraph board into the Excel workbook: its scenarios, sensitivity charts, sliders and bar charts, all live in Excel.

In one sentence: whatever "what if" you play with in fmGraph, the person you send the Excel file to can now play with it too.

The background and design are in [`docs/step18-fmgraph-sensitivity.md`](step18-fmgraph-sensitivity.md) and [`docs/step19-fmgraph-in-excel.md`](step19-fmgraph-in-excel.md). The same guide is also kept as a document on claude.ai.

## Start here

**Words used in this guide**

- **Input**: a rectangle nothing feeds (or one fed only by an empty operator). It is the number you are allowed to change.
- **Output**: any rectangle you want to watch, such as Profit.
- **Board**: one page in fmGraph holding bars, charts and sliders.
- **Slider**: a handle on a board that changes an input, so you see the bars move.
- **Scenario**: a saved set of slider positions with a name (for example "Bad year").
- **Global Case**: ExcelExporter's name for a scenario in the workbook. One number in a cell switches the whole model between cases.

**The new features at a glance**

| # | Feature | Where it lives |
|---|---|---|
| 1 | Tornado chart: which inputs move an output most | fmGraph |
| 2 | Spider chart: how each input bends the output | fmGraph |
| 3 | Full Tornado/Spider editor (Low, High, % or ±, Show) | fmGraph |
| 4 | Several sensitivity analyses in one workbook (up to 10) | ExcelExporter |
| 5 | Layout → Use fmGraph boards… | ExcelExporter |
| 6 | fmGraph scenarios become Global Cases | ExcelExporter → Excel |
| 7 | fmGraph Tornado and Spider become Excel analyses | ExcelExporter → Excel |
| 8 | fmGraph sliders become a Dashboard tab with scroll bars | ExcelExporter → Excel |
| 9 | fmGraph bars and charts become Excel charts on the Dashboard | ExcelExporter → Excel |
| 10 | New tutorial "fmGraph boards in Excel" | fmIDE Help |

You need nothing new installed. All three apps still work offline, straight from their HTML files.

**What goes where**

You build on the left, press one button in the middle, and get the right-hand parts in Excel. Start in fmIDE: **File → Open fmGraph** to build the board, then **File → Open ExcelExporter**.

| In fmGraph | In ExcelExporter | In the Excel workbook |
|---|---|---|
| Sliders (move an input) | **Layout → Use fmGraph boards…**: tick what to carry, press **Use**, then **⬇ Generate .xlsx** | Dashboard tab (scroll bar, Typed and Use) |
| Scenarios (saved slider positions) | ↑ | Global Cases (Scenarios tab, case number in C2) |
| Tornado and Spider (which inputs matter most) | ↑ | Sensitivity tabs (live Data Table and charts) |
| Bars and charts (bar, columns, waterfall) | ↑ | Excel charts on the Dashboard, following the sliders |

## The features, one by one

Each part below says what the feature is, why you would use it, and the exact clicks.

### 1. Tornado and Spider charts in fmGraph

**What it is.** Two new chart kinds on an fmGraph board. Both answer: "which inputs matter most for this output?"

- **Tornado**: one horizontal bar per input. Each bar runs from the output's value with that input at its **Low** to its value at its **High**. The input with the biggest swing sits at the top, so the shape looks like a tornado.
- **Spider**: one line per input, from Low (left) through today's value (the middle, where all lines cross) to High (right). A straight line means the effect is even; a bent line means it is not.

**Simple example.** Profit is 100. Moving Price −10% / +10% gives Profit 70 / 130 (swing 60). Moving Cost −10% / +10% gives 110 / 90 (swing 20). The Tornado puts Price on top: it matters three times as much.

**Good to know**

- The chart is measured **around where the sliders stand now**. Move a slider and the chart is worked out again.
- Each input is moved on its own, in **every period**. The output is read in **one period** you choose.
- Two ways to move an input: **%** (−10% takes 100 to 90) or **± amount** (−2 takes 100 to 98). Use amount for rates: 0.05 moved by +0.01 is 0.06, one percentage point.

**How to make one**

1. In fmIDE, choose **File → Open fmGraph**.
2. On a board, press **+ Chart** at the top.
3. At the top of the new chart, choose **Tornado** (or **Spider**). It starts by measuring the first calculated rectangle, with every input that reaches it moved −10% … +10%.
4. Press **Edit chart**. Choose the **output** you care about (for example Profit). Press **↻** to take the inputs that reach it.
5. Choose the **period** the output is read in. For a Spider, also set its **points** each side (1–10, 5 by default).
6. For each input row, set:
    - the **tick**: untick to keep it listed but hide it from the drawing;
    - **%** or **±**: by a percent or by an amount;
    - **Low** and **High**: for example −10 and +10.
7. Read the line under each row. It shows Low and High in the input's own numbers, for example "Now 10: 9 … 11 in Year 1".
8. Use **+ Input** to add another input, **↑ ↓** to reorder, **×** to remove.
9. Move a slider and watch the chart re-measure.

Tips: an input that is 0 cannot move by a percent, and its row says so. Switch it to ±. On a large model the chart shows "Working out…" until the sliders stop. Limits: 50 inputs a chart; Low and High within ±1,000,000,000.

### 2. Several sensitivity analyses in ExcelExporter

**What it is.** ExcelExporter's Sensitivity panel used to hold one analysis. Now it holds **up to 10**. Each one writes its own tab ("Sensitivity", "Sensitivity 2"…) with its own live Excel Data Table, Tornado and Spider.

**Why.** To compare different outputs, periods or inputs side by side in one workbook, for example "what moves Profit in Year 1" and "what moves Cash in Year 5".

**How**

1. Under **Sensitivity**, press **+ Add**.
2. Type a **Name**. It becomes the tab's name in Excel (31 characters at most).
3. Tick **Tornado** and **Spider**.
4. Add the **outputs** and pick the **period**.
5. Add the **inputs** to move (or **Add all**). For each, choose % or amount, and Low and High.
6. Press **⬇ Generate .xlsx**.

In the panel's list, click an analysis to edit it, **↑ ↓** to reorder, **×** to remove (it asks first if the analysis has outputs or inputs).

Good to know: an input moved by two analyses still has one row on the Inputs tab. Only the tab whose Data Table is running moves it, so each table still moves one input at a time. Old layout files open fine, with their one analysis named "Sensitivity".

### 3. The new window: Layout → Use fmGraph boards…

**What it is.** One window in ExcelExporter that reads your fmGraph boards and lists everything it can carry into Excel: sliders, scenarios, Tornado and Spider charts, bars and charts. Each item has a tick box, all ticked at first.

**Where the boards come from**

- **Easiest:** in fmIDE, choose **File → Open ExcelExporter**. The boards arrive with the model.
- Or open the **.fmide** document in ExcelExporter.
- Or, in fmGraph, choose **Boards ▾ → Export all boards**, then in ExcelExporter **File → Import fmGraph boards…** (or drop the file on the page).

**How**

1. Choose **Layout → Use fmGraph boards…**.
2. Pick the board. Untick anything you don't want.
3. Read the list of what **can't** be carried, with the reason (for example, an input inside a block).
4. Press **Use**. If the Inputs tab was off, ExcelExporter turns it on and tells you.
5. Press **⬇ Generate .xlsx**.

**Important:** what you pick is **copied into the layout** and saved with it. If you change the board in fmGraph later, nothing changes in Excel until you run **Use fmGraph boards…** again. It asks before replacing. **Remove from Layout**, in the same window, takes it all out.

### 4. fmGraph scenarios become Global Cases

**What it is.** Scenarios you saved in fmGraph become **Global Cases** in the workbook. One cell switches the whole Excel model between them.

- **Case 1 is always "Base"**: fmIDE's own numbers.
- Each fmGraph scenario is the next case, with its own name.
- A scenario that **sets** a number writes it in its periods. One that changes a number **by %** becomes a live formula, such as `=F12*(1+10%)`.

**How**

1. In fmGraph, set the sliders, then press **+ Save as scenario** (in the Scenarios panel under the sliders). Type a name, for example "Bad year".
2. Bring the boards to ExcelExporter and use **Layout → Use fmGraph boards…** (feature 3). Keep the scenarios ticked and press **Use**.
3. Press **⬇ Generate .xlsx**.
4. In Excel, open the **Scenarios** tab and type a case number in **C2** (1 = Base, 2 = your first scenario…).

Limits: at most 50 cases (Base + 49 scenarios) and 20 row scenarios an input. Anything past them is listed by name.

### 5. fmGraph's Tornado and Spider become Excel analyses

**What it is.** A Tornado or Spider you built in fmGraph (feature 1) becomes a sensitivity analysis in ExcelExporter (feature 2), with the same output, period, inputs, Low and High.

- A Tornado and a Spider that move the same inputs the same way become **one** analysis with both outputs.
- An input you hid in fmGraph is written with **Show = 0**.
- They are marked **fmGraph** in the Sensitivity panel. Your own analyses stay untouched when you use the window again.

**How:** make the chart in fmGraph, then **Layout → Use fmGraph boards…**, keep it ticked, press **Use**, then **⬇ Generate .xlsx**. Each analysis appears as its own tab.

The charts' colours stay ExcelExporter's for now. At most 10 analyses in all.

### 6. fmGraph sliders become a Dashboard tab

**What it is.** The workbook gets a new **first tab, Dashboard**, with one row per slider. Each row has a real Excel **scroll bar** and a cell to type into.

| Column | What it does |
|---|---|
| Slider, Periods, Kind | Which input it moves, in which periods, and how (set, or change by %) |
| Scroll bar | Drag it, as in fmGraph |
| Position | The scroll bar's own cell (0 to 30,000) |
| Typed | Type a number here. It wins over the scroll bar; clear it to give the scroll bar back |
| Value | The number used: Typed, or else Min + Position × Step |
| Use | Set sliders only: tick (TRUE) to apply the slider; off by default |
| Min, Max, Step | The slider's range. You can change them in Excel |

**How**

1. In fmGraph, press **+ Slider**, choose an input, its periods, and whether it sets the number or changes it by %.
2. In ExcelExporter, **Layout → Use fmGraph boards…**, keep the sliders ticked, press **Use**.
3. Press **⬇ Generate .xlsx** and open the **Dashboard** tab.
4. For a set slider, tick **Use**, then drag the scroll bar. For a % slider, just drag.

**The workbook still opens on fmIDE's numbers:** every Use is off and every % slider starts at 0. Nothing moves until you touch it.

**On an iPad, iPhone or Excel on the web**, scroll bars and check boxes don't show ("This version of Excel doesn't support this control"). Type a number in **Typed** and **TRUE** in **Use** instead. That works everywhere.

A slider on several boards is listed once. At most 40 sliders.

### 7. fmGraph's bars and charts become Excel charts

**What it is.** The board's bars and charts are drawn as real Excel charts on the Dashboard, under the sliders. They read from the model's rows, so they **move with the sliders**, the Global Case and anything you change in Excel.

| In fmGraph | In Excel |
|---|---|
| A bar | A column chart over its periods |
| A Columns chart | Stacked columns, one series per rectangle (with several groups, from a small table beside the chart) |
| A Waterfall | A waterfall built from stacked columns, with its working rows of formulas beside it (from column N) |
| A Scenario waterfall | Not carried (Excel would have to work out every case at once) |

Titles, names, your colours and a fixed scale come along. Wide charts take the full width; narrow ones sit two to a row.

**How:** add bars and charts to a board in fmGraph, then **Layout → Use fmGraph boards…**, press **Use**, then **⬇ Generate .xlsx**, and open the Dashboard. Unlike the scroll bars, the charts show everywhere, the iPad included.

### 8. New tutorial: fmGraph boards in Excel

**What it is.** A 4-minute guided tutorial in fmIDE's Help. Its practice model already comes with a board: a Price slider, a Profit bar and a Revenue-to-Profit waterfall.

**How**

1. In fmIDE, open **Help** and choose the tutorial **fmGraph boards in Excel**.
2. Press **Open ExcelExporter** when it asks.
3. In ExcelExporter, choose **Layout → Use fmGraph boards…** and press **Use**.
4. Press **⬇ Generate .xlsx** and open the workbook on the Dashboard.
5. Tick **Use** and move the Price scroll bar. Watch both charts move.

fmGraph's "Trace and compare" tutorial also gained two steps at the end: + Chart → Tornado, then Profit as its output.

## Putting it together: one model, start to finish

This walk takes a small Profit model from fmIDE to a live Excel Dashboard in about 15 minutes. The model: Price × Quantity = Revenue; Revenue + Costs = Profit, over 3 periods.

**Part A: build the board in fmGraph**

1. In fmIDE, build (or open) the model and choose **File → Open fmGraph**.
2. Press **+ Slider**, pick **Price**, all periods, and "set the number".
3. Press **+ Bar** and pick **Profit**.
4. Press **+ Chart**, choose **Waterfall** at its top, and give each step its role: Revenue (start) → Costs (add) → Profit (total).
5. Press **+ Chart** again and choose **Tornado**. In Edit chart, pick **Profit** as the output and press ↻.
6. Drag Price to 8 and press **+ Save as scenario**. Name it "Low price".
7. Close fmGraph. Because it was opened from fmIDE, the board is kept in fmIDE's document.

**Part B: carry it into ExcelExporter**

1. In fmIDE, choose **File → Open ExcelExporter**. The model and its board arrive.
2. Choose **Layout → Use fmGraph boards…**.
3. Check the list: 1 slider, 1 scenario, 1 Tornado, 1 bar, 1 waterfall, all ticked.
4. Press **Use**.
5. Press **⬇ Generate .xlsx**.

**Part C: use it in Excel**

1. Open the workbook. It opens on the **Dashboard**.
2. Tick **Use** on the Price row, then drag the scroll bar (or type 12 in **Typed**). The bar and the waterfall move.
3. Open the **Scenarios** tab and type **2** in **C2**. The whole model switches to "Low price". Type **1** to go back to Base.
4. Open the **Sensitivity** tab to see the live Tornado table and its chart.

The numbers in Excel match fmGraph's for the same slider, scenario and Tornado. The tests (group 77) check this to within a millionth.

## Troubleshooting and questions

| Problem or question | Answer |
|---|---|
| I changed my board in fmGraph, but Excel didn't change. | By design. Boards are copied once. Run **Layout → Use fmGraph boards…** again, then Generate. |
| The scroll bars show "This version of Excel doesn't support this control". | You are on an iPad, iPhone or Excel on the web. Type a number in **Typed**, and **TRUE** in **Use**. Charts still show. |
| I moved the scroll bar of a set slider and nothing happened. | Tick **Use** (or type TRUE) on that row first. It is off so the workbook opens on fmIDE's numbers. |
| An item in the window says it can't be carried. | Usually an input inside a block, a rectangle the workbook doesn't write, or a limit reached. The window gives the reason. |
| My Tornado bar for an input has no length. | The input is 0, and a percent of 0 is 0. Switch that input to **±** (amount). |
| The chart says "Working out…". | The model is large. The chart is worked out once the sliders stop. |
| My scenario waterfall is missing in Excel. | Not carried yet: Excel would have to work out every case at once. |
| Excel is slow with several analyses. | Each analysis is a Data Table. Use Formulas → Calculation Options → **Automatic except for data tables**, and press F9 when needed. |
| Will my older files still open? | Yes. Old layout files open with their one analysis named "Sensitivity"; old board files read as before. |
| How do I undo all of it? | **Remove from Layout**, in the Use fmGraph boards… window. |

Limits in one place: 50 inputs a Tornado or Spider · 10 analyses · 50 Global Cases · 20 row scenarios an input · 40 sliders · 40 charts · 30,000 scroll-bar positions.

## Appendix: the pull requests

Newest first.

| Pull request | Date | What it did | Feature |
|---|---|---|---|
| [#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156) | 17 Oct 2026 | The Dashboard's chart tables moved beside the charts (from column N), titles on their own row | 9 |
| [#155](https://github.com/taroyamakatrmttm-star/fmIDE/pull/155) | 17 Oct 2026 | Records step 19 as done, after checks in Excel on Windows and the iPad | — |
| [#154](https://github.com/taroyamakatrmttm-star/fmIDE/pull/154) | 16 Oct 2026 | fmGraph's bars and charts on the Dashboard (B5); help, tutorial, end-to-end test | 9, 10 |
| [#153](https://github.com/taroyamakatrmttm-star/fmIDE/pull/153) | 16 Oct 2026 | Sliders on the Dashboard (B4); controls fixed so the iPad's Excel opens the file | 8 |
| [#152](https://github.com/taroyamakatrmttm-star/fmIDE/pull/152) | 16 Oct 2026 | fmGraph's Tornado and Spider become analyses (B3b) | 7 |
| [#151](https://github.com/taroyamakatrmttm-star/fmIDE/pull/151) | 16 Oct 2026 | Closed, not merged: a duplicate build of B3; its fmGraph part moved into #152 | — |
| [#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150) | 16 Oct 2026 | Several sensitivity analyses, up to 10 (B3a) | 4 |
| [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149) | 16 Oct 2026 | Full Tornado/Spider editor in fmGraph; tutorial steps (A2) | 3 |
| [#148](https://github.com/taroyamakatrmttm-star/fmIDE/pull/148) | 15 Oct 2026 | Fix: a scroll bar is at least one cell wide and tall | 8 |
| [#147](https://github.com/taroyamakatrmttm-star/fmIDE/pull/147) | 15 Oct 2026 | Use fmGraph boards… and scenarios as Global Cases (B2) | 5, 6 |
| [#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146) | 15 Oct 2026 | Tornado and Spider charts in fmGraph (A1) | 1, 2 |
| [#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145) | 15 Oct 2026 | The Excel writer learns scroll bars, check boxes and stacked charts (B0), the groundwork | 8, 9 |
| [#144](https://github.com/taroyamakatrmttm-star/fmIDE/pull/144) | 15 Oct 2026 | The plans (briefs) for steps 18 and 19 | — |
