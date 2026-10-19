# Part 5 — ExcelExporter: from model to workbook

[← Part 4](04-macros-scripting.md) · [Contents](README.md) · [Part 6 →](06-fmgraph.md)

ExcelExporter turns an fmIDE model into an Excel workbook whose cells hold real formulas, laid out and styled the way you choose. It can also carry your fmGraph boards into the workbook as a live Dashboard. After this part you can hand someone a workbook that calculates exactly as your model does.

The numbers and formulas in this part were checked against the apps on `main` at pull request #193 (19 October 2026). Cell addresses depend on your layout; yours may differ by a row or a column.

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| 5.1 Your first workbook *(to come)* | File → Open ExcelExporter, ⬇ Generate .xlsx, ↻ From fmIDE, ← Back to fmIDE | foundations, [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55), [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96) |
| 5.2 Finding your way in ExcelExporter *(to come)* | The File and Layout menus, ⚙ Settings, Help | step 14 ([#81](https://github.com/taroyamakatrmttm-star/fmIDE/pull/81)) |
| 5.3 Tabs, rows and the Tree View *(to come)* | Moving rows and tabs, label rows, a row's own format, Collapse all | [#44](https://github.com/taroyamakatrmttm-star/fmIDE/pull/44), [#46](https://github.com/taroyamakatrmttm-star/fmIDE/pull/46), [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#98](https://github.com/taroyamakatrmttm-star/fmIDE/pull/98), [#124](https://github.com/taroyamakatrmttm-star/fmIDE/pull/124), [#192](https://github.com/taroyamakatrmttm-star/fmIDE/pull/192) |
| [5.4 Where the workbook differs from fmIDE](#differences) | The yellow list before you download | step 7 C ([#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)) |
| [5.5 Functions and the newer operators in Excel](#functions-in-excel) | Functions written out in full; the Functions tab; IF, ROUND, CHOOSE | step 7 D3, E1 ([#31](https://github.com/taroyamakatrmttm-star/fmIDE/pull/31), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)) |
| 5.6 The Inputs tab, scenarios and Global Cases *(to come)* | Gathering inputs, scenarios per input, whole-model cases | foundations, [#11](https://github.com/taroyamakatrmttm-star/fmIDE/pull/11), [#13](https://github.com/taroyamakatrmttm-star/fmIDE/pull/13), [#53](https://github.com/taroyamakatrmttm-star/fmIDE/pull/53), [#177](https://github.com/taroyamakatrmttm-star/fmIDE/pull/177) |
| 5.7 Blocks in the workbook *(to come)* | Instance tabs, vertical blocks' vintages | foundations, [#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67) |
| 5.8 The Excel look *(to come)* | Your Excel style, a row's own format, exact number formats | step 11a ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)), [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190) |
| 5.9 Layouts that are remembered *(to come)* | Module and instance layouts, a template's layout, Attach to Template…, the layout in the document | step 11b–d ([#64](https://github.com/taroyamakatrmttm-star/fmIDE/pull/64)–[#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67)), [#139](https://github.com/taroyamakatrmttm-star/fmIDE/pull/139), [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176), [#178](https://github.com/taroyamakatrmttm-star/fmIDE/pull/178) |
| [5.10 Sensitivity: the Tornado and the Spider in Excel](#sensitivity) | One analysis, then several, live in Excel | step 16 ([#122](https://github.com/taroyamakatrmttm-star/fmIDE/pull/122), [#123](https://github.com/taroyamakatrmttm-star/fmIDE/pull/123)), step 19 B3a ([#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150)), [#179](https://github.com/taroyamakatrmttm-star/fmIDE/pull/179) |
| [5.11 fmGraph boards in Excel](#fmgraph-in-excel) | Scenarios, Tornado and Spider, sliders and charts carried into the workbook | step 19 ([#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145)–[#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156)), [#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188) |
| 5.12 ExcelExporter on a phone *(to come)* | Make the workbook and share it | step 17 P3 ([#131](https://github.com/taroyamakatrmttm-star/fmIDE/pull/131)) |

Until the lessons marked *(to come)* are written, ExcelExporter's Help (❓, or F1) covers them, and fmIDE's tutorial *From fmIDE to Excel* walks through 5.1.

---

<a id="differences"></a>
## Lesson 5.4 — Where the workbook differs from fmIDE

> **Goal:** know, before you download, every place where Excel will show something different from fmIDE, and why.
> **You need:** fmIDE and ExcelExporter.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Where the workbook differs from fmIDE* (`differences`)
> **Came in:** step 7, phase C · [#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)

The workbook calculates exactly as fmIDE does. Where fmIDE shows "?" because something in the model is broken, Excel can only write 0, a blank or an error, so ExcelExporter lists each such place in a yellow panel at the top of the page.

### Steps

1. In fmIDE, **File → New**. Build Revenue = `100`, Cost = `60`, a `−` operator and Profit: arrows Revenue → `−`, Cost → `−`, `−` → Profit.
2. Break it on purpose: draw a second arrow into Profit, from Cost. A rectangle with two arrows in can't be worked out: after **Evaluate**, Profit shows "?".
3. **File → Open ExcelExporter**. The model arrives by itself.

### Check it

Under the top bar, a yellow panel reads:

> *Where the workbook will differ from fmIDE (1):*
> *"Profit" (tab "Canvas 1"): fmIDE shows ? in period 1 because more than one arrow goes into it ("Profit" on "Canvas 1"); Excel leaves the cell blank.*
> *You can still download. Fix these in fmIDE (or include the rows) and both give the same numbers.*

Now remove the extra arrow in fmIDE and choose **File → ↻ From fmIDE** in ExcelExporter: the panel is gone.

### Good to know

- **What else it lists:** an alias pointing at nothing, a loop, a missing block, a row left out of the layout that other rows read, an operator fmIDE doesn't know, and every problem with a function ([lesson 5.5](#functions-in-excel)).
- **You can always download.** The panel informs; it never blocks.

---

<a id="functions-in-excel"></a>
## Lesson 5.5 — Functions and the newer operators in Excel

> **Goal:** read how your functions and the operators `if`, `round`, `choose` and `period` are written in the workbook.
> **You need:** fmIDE and ExcelExporter, and the models of lessons [2.5](02-building-models.md#timing-conditions) and [3.6](03-reuse.md#function-on-canvas) (or run the script of [lesson 4.4](04-macros-scripting.md#scripting-fm), which builds both).
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *Where the workbook differs from fmIDE* (`differences`); fmIDE Help → *From fmIDE to Excel* (`to-excel`)
> **Came in:** step 7, phases D3 and E1 · [#31](https://github.com/taroyamakatrmttm-star/fmIDE/pull/31), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)

### Steps

1. In fmIDE, open the model with the Margin box and the corkscrew.
2. **File → Open ExcelExporter**, then **⬇ Generate .xlsx** at the top right.
3. Open the workbook in Excel (or LibreOffice) and look at the cells.

### Check it

| Row | Formula in the first period | Why |
|---|---|---|
| Margin % (function v2) | `=ROUND((E4-E5)/E4,2)` | The function is written out in full, each input replaced by the cell it reads. |
| Period (the `period` operator) | `=E$3` | The sheet's *Period #* row. |
| Is first period (`=`) | `=E4=E5` | Excel shows TRUE or FALSE; fmIDE shows 1 or 0. |
| Previous closing | `0` in the first period, then `=E11` | The period shift: last period's Closing. |
| Beginning (`if`) | `=IF(E6,E7,E8)` | |
| Rounded (`round`) | `=ROUND(E4,E5)` | |
| Price (`choose`) | `=CHOOSE(E7,E8,E9,E10)` | |

The last tab, **Functions**, lists every function version the workbook uses: its name, version, definition, description, note, and the rows that use it.

**Plain Excel.** No macros and no `LAMBDA`: the workbook works in any Excel.

### When Excel shows `#N/A`

Wherever fmIDE shows "?" for a function or an operator with named inputs: a missing or unreadable definition, the wrong number of inputs, an input the formula reads with no arrow.

1. In fmIDE, insert a second Margin box, wire only Revenue into it, and draw it into a new rectangle **Broken**.
2. **File → ↻ From fmIDE** in ExcelExporter (or Open ExcelExporter again).

The yellow panel ([lesson 5.4](#differences)) says: *"Broken" (tab "Canvas 1"): fmIDE shows ? in period 1 because an input its function reads has no arrow (the function "Margin" v1 on "Canvas 1"); Excel shows #N/A there.* The cell's formula is `=(E4-NA())/E4`.

### Good to know

- **Formulas too long for Excel.** If writing a call out in full would pass Excel's limits (8,192 characters, or 64 levels of brackets), the cell gets `#N/A` and the panel lists it. Put a rectangle in between to split the formula.
- **Comparisons inside a function** are written so they give 1 or 0 in Excel, as on the canvas.

---

<a id="sensitivity"></a>
## Lesson 5.10 — Sensitivity: the Tornado and the Spider in Excel

> **Goal:** add live sensitivity analyses to the workbook: which inputs move an output most, as Excel tables and charts.
> **You need:** ExcelExporter with a model loaded. The example uses Profit = Price × Quantity − Costs, with Price `10`, Quantity `30` and Costs `200` (Profit 100), over 3 periods.
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *Sensitivity: the Tornado and the Spider* (`sensitivity`)
> **Came in:** step 16 ([#122](https://github.com/taroyamakatrmttm-star/fmIDE/pull/122), [#123](https://github.com/taroyamakatrmttm-star/fmIDE/pull/123)); several analyses in step 19, phase B3a ([#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150)); tidier Inputs tab rows ([#179](https://github.com/taroyamakatrmttm-star/fmIDE/pull/179))

A **Tornado** shows, for one output, how far it moves when each input goes from its Low to its High, biggest first. A **Spider** shows the same as lines through the points in between. ExcelExporter builds both from a live Excel **Data Table**, so they recalculate in Excel. A workbook can hold up to 10 analyses, each on its own tab, for example "what moves Profit in 2027" and "what moves Cash in 2029".

### Steps

1. **Turn on the Inputs tab:** in the sidebar's *Inputs & scenarios* panel, tick **Gather inputs on a separate tab**. The inputs an analysis moves live there; until it is on, the Sensitivity panel says so.
2. In the **Sensitivity** panel, the list starts with one analysis, *Sensitivity*. Click it to edit it (or **+ Add** for another).
3. Type a **Name**, such as `Profit drivers`. It becomes the tab's name (31 characters at most).
4. Tick **Tornado and Spider**.
5. Under **Outputs**, choose *Profit* in *Add an output…*. Pick the **Period**.
6. Under **Inputs to move**, press **Add all** (every input, each by % from −10 to +10), or add them one at a time with *Add an input…*. For each input choose **%** or **amount**, and its **Low** and **High**.
7. Choose where the **Charts** go: *On their own tabs* or *On the Sensitivity tab*.
8. Press **⬇ Generate .xlsx**.

### Check it

The workbook has the tabs **Inputs**, your model's tabs, **Profit drivers**, **Tornado** and **Spider**. On *Profit drivers*, the Data Table's row for Price runs from **70** (Low, −10%) through **100** to **130** (High, +10%); Costs runs from 120 to 80. Price and Quantity each swing Profit by 60, Costs by 40, so the Tornado puts Price and Quantity on top.

### Good to know

- **In Excel,** C4 picks the output and C5 the period. Keep C6 at 0: the model then shows its own numbers. Change Low, High and Show (1 or 0) in the table; the Data Table works out the rest.
- **% or amount.** Use *amount* for rates: 0.05 moved by +0.01 is 0.06, one percentage point. An input that is 0 can't move by a percent.
- **The list:** click an analysis to edit it, **↑ ↓** to reorder, **×** to remove (it asks first if the analysis has outputs or inputs).
- **An input moved by two analyses** still has one row on the Inputs tab; only the tab whose Data Table is running moves it. Under its row, the Inputs tab gathers the parts (*% change*, *Change by amount*) and the value after sensitivity ([#179](https://github.com/taroyamakatrmttm-star/fmIDE/pull/179)).
- **Slow workbook?** Each analysis is a Data Table. In Excel, **Formulas → Calculation Options → Automatic except for data tables**, and press F9 when you want them worked out.
- **Older layout files** open with their one analysis, named *Sensitivity*.
- **From fmGraph:** a Tornado or Spider you built in fmGraph can become an analysis here: [lesson 5.11](#fmgraph-in-excel).

---

<a id="fmgraph-in-excel"></a>
## Lesson 5.11 — fmGraph boards in Excel

> **Goal:** carry an fmGraph board into the workbook, so the person you send it to can move the same sliders, switch the same scenarios and see the same charts, live in Excel.
> **You need:** fmIDE, fmGraph and ExcelExporter. The example is the Profit model of [lesson 5.10](#sensitivity). It helps to know [lesson 6.6](06-fmgraph.md#tornado-spider).
> **Time:** about 15 minutes.
> **In the app:** ExcelExporter Help → *fmGraph in Excel* (`fmgraph-in-excel`), *fmGraph's scenarios as Global Cases* (`fmgraph-scenarios`), *fmGraph's sliders: the Dashboard* (`fmgraph-dashboard`), *fmGraph's charts on the Dashboard* (`fmgraph-charts`) · fmIDE tutorial *fmGraph boards in Excel* (`fmgraph-to-excel`)
> **Came in:** step 19 · [#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145), [#147](https://github.com/taroyamakatrmttm-star/fmIDE/pull/147), [#148](https://github.com/taroyamakatrmttm-star/fmIDE/pull/148), [#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150), [#152](https://github.com/taroyamakatrmttm-star/fmIDE/pull/152)–[#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156); later [#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188)

One window in ExcelExporter, **Layout → Use fmGraph boards…**, reads your boards and lists everything it can carry. Each item has a tick box, all ticked at first.

| In fmGraph | In the workbook |
|---|---|
| Scenarios (saved slider positions) | **Global Cases**: the *Scenarios* tab, the case number in C2 |
| Tornado and Spider charts | Sensitivity analyses ([lesson 5.10](#sensitivity)), each on its own tab |
| Sliders | The **Dashboard** tab: a scroll bar and a cell to type in, per slider |
| Bars, Columns, Lines and Waterfall charts | Excel charts on the Dashboard, moving with the sliders |

### Steps

**A — Build the board in fmGraph**

1. In fmIDE, open the Profit model and choose **File → Open fmGraph**.
2. Press **+ Slider**, choose **Price** in its list, keep all periods, and keep its kind *Set the number to*.
3. Press **+ Bar** and choose **Profit** in its list.
4. Press **+ Chart**, choose **Waterfall** at its top, and give each step its role: Revenue *start*, Costs *subtract*, Profit *total*.
5. Press **+ Chart** again and choose **Tornado**. In **Edit chart**, pick **Profit** as the output and press **↻** to take the inputs that reach it.
6. Drag the Price slider to **8** and press **+ Save as scenario** (in the Scenarios panel under the sliders). Name it `Low price`.
7. Close fmGraph. Because it was opened from fmIDE, the board is kept in fmIDE's document. Save the document (**File → Save**).

**B — Carry it into ExcelExporter**

1. In fmIDE, **File → Open ExcelExporter**. The model and its boards arrive.
2. **Layout → Use fmGraph boards…**. Pick the board.
3. Check the list: *Scenarios → Global Cases* (Low price), *Sliders → the Dashboard* (Price), *Charts → the Dashboard* (Profit, Revenue to Profit), *Tornado and Spider → analyses*. Anything that can't be carried is under *Not carried*, with the reason.
4. Press **Use**. ExcelExporter turns the Inputs tab on if it was off, and says what it took, for example: *fmGraph scenarios used: 2 Global Cases (Base and 1), 1 input with scenarios. Also 1 sensitivity analysis from its Tornado and Spider charts. 1 slider on the Dashboard. … The Inputs tab is on.*
5. Press **⬇ Generate .xlsx**.

**C — Use it in Excel**

1. Open the workbook. Its first tab is the **Dashboard**.
2. On the Price row, tick **Use**, then drag the scroll bar (or type `12` in **Typed**). The bar and the waterfall move.
3. Open the **Scenarios** tab and type `2` in **C2**. The whole model switches to *Low price*. Type `1` to go back to *Base*.
4. Open the sensitivity tab to see the live Tornado table and its chart.

### Check it

The tabs are, in order: **Dashboard**, **Scenarios**, **Inputs**, your model's tabs, the sensitivity tab, **Tornado**, **Spider**. With *Low price* (case 2), Profit is **40** (8 × 30 − 200). The numbers in Excel match fmGraph's for the same slider, scenario and Tornado; the automatic tests (group 77) check that to within a millionth.

### The Dashboard, column by column

| Column | What it does |
|---|---|
| Slider, Periods, Kind | Which input it moves, in which periods, and how (*Set to*, or a % change) |
| Scroll bar | Drag it, as in fmGraph |
| Position | The scroll bar's own cell (0 to 30,000) |
| Typed | Type a number here. It wins over the scroll bar; clear it to give the scroll bar back. |
| Value | The number used: Typed, or else Min + Position × Step |
| Use | Set sliders only: TRUE applies the slider. Off at first. |
| Min, Max, Step | The slider's range. You can change them in Excel. |

**The workbook opens on fmIDE's numbers:** every Use is off and every % slider starts at 0, so nothing moves until you touch it.

### Good to know

- **Boards are copied once.** What you pick is copied into the layout and saved with it. If you change the board in fmGraph later, run **Layout → Use fmGraph boards…** again (it asks before replacing). **Remove from Layout**, in the same window, takes it all out.
- **Other ways in:** open the `.fmide` document in ExcelExporter, or in fmGraph choose **Boards ▾ → Export all boards** and in ExcelExporter **File → Import fmGraph boards…** (or drop the file on the page). Importing a boards file opens the window by itself.
- **Scenarios:** case 1 is always *Base*, fmIDE's own numbers. A scenario that sets a number writes it in its periods; one that changes a number by % becomes a live formula, such as `=F12*(1+10%)`.
- **Tornado and Spider:** a Tornado and a Spider that move the same inputs the same way become one analysis. An input hidden in fmGraph is written with Show = 0. They are marked *fmGraph* in the Sensitivity panel; your own analyses are left alone.
- **Charts:** a bar becomes a column chart over its periods; a Columns chart, stacked columns; a Lines chart, an Excel line chart; a Waterfall, stacked columns with their working rows beside the chart (from column N). A scenario waterfall is not carried (Excel would have to work out every case at once). Titles, names, colours and a fixed scale come along.
- **On an iPad, iPhone or Excel on the web,** scroll bars and check boxes don't show (*This version of Excel doesn't support this control*). Type a number in **Typed** and `TRUE` in **Use** instead: that works everywhere. The charts show everywhere.
- **On the Inputs tab,** each slider gets a row of its own under its input, such as *Set to (Dashboard, all periods)*, and the input's own row is named "… after sliders" ([#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180)).
- **Limits:** 50 Global Cases (Base and 49 scenarios); 20 row scenarios an input; 10 analyses; 50 inputs a Tornado or Spider; 40 sliders; 40 charts; 30,000 scroll-bar positions. Anything past a limit is listed by name.

### Troubleshooting

| Problem | Answer |
|---|---|
| I changed my board in fmGraph, but Excel didn't change. | Boards are copied once. Run **Layout → Use fmGraph boards…** again, then Generate. |
| The scroll bars show *This version of Excel doesn't support this control*. | You are on an iPad, iPhone or Excel on the web. Use **Typed** and **Use** instead. |
| I moved a set slider's scroll bar and nothing happened. | Tick **Use** (or type TRUE) on that row first. |
| An item can't be carried. | Usually an input inside a block, a rectangle the workbook doesn't write, or a limit reached. The window says which. |
| A Tornado bar has no length. | The input is 0, and a percent of 0 is 0. Switch that input to **±** (amount) in fmGraph. |

---

[← Part 4](04-macros-scripting.md) · [Contents](README.md) · [Part 6 →](06-fmgraph.md)

*Part 5 describes ExcelExporter. Like the rest of `docs/`, it is licensed under the [Apache License 2.0](../../LICENSE).*
