# Part 5 — ExcelExporter: from model to workbook

[← Part 4](04-macros-scripting.md) · [Contents](README.md) · [Part 6 →](06-fmgraph.md)

ExcelExporter turns an fmIDE model into an Excel workbook whose cells hold real formulas, laid out and styled the way you choose. It can also carry your fmGraph boards into the workbook as a live Dashboard. After this part you can hand someone a workbook that calculates exactly as your model does.

The numbers and formulas in this part were checked against the apps on `main` at pull request #196 (21 October 2026). Cell addresses depend on your layout; yours may differ by a row or a column.

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [5.1 Your first workbook](#first-workbook) | File → Open ExcelExporter, ⬇ Generate .xlsx, ↻ From fmIDE, ← Back to fmIDE | foundations, [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55), [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96) |
| [5.2 Finding your way in ExcelExporter](#exporter-tour) | The File and Layout menus, ⚙ Settings, Help | step 14 ([#81](https://github.com/taroyamakatrmttm-star/fmIDE/pull/81)) |
| [5.3 Tabs, rows and the Tree View](#tabs-rows) | Moving rows and tabs, label rows, a row's own format, Collapse all | [#44](https://github.com/taroyamakatrmttm-star/fmIDE/pull/44), [#46](https://github.com/taroyamakatrmttm-star/fmIDE/pull/46), [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#98](https://github.com/taroyamakatrmttm-star/fmIDE/pull/98), [#124](https://github.com/taroyamakatrmttm-star/fmIDE/pull/124), [#192](https://github.com/taroyamakatrmttm-star/fmIDE/pull/192) |
| [5.4 Where the workbook differs from fmIDE](#differences) | The yellow list before you download | step 7 C ([#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)) |
| [5.5 Functions and the newer operators in Excel](#functions-in-excel) | Functions written out in full; the Functions tab; IF, ROUND, CHOOSE | step 7 D3, E1 ([#31](https://github.com/taroyamakatrmttm-star/fmIDE/pull/31), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)) |
| [5.6 The Inputs tab, scenarios and Global Cases](#inputs-scenarios) | Gathering inputs, scenarios per input, whole-model cases | foundations, [#11](https://github.com/taroyamakatrmttm-star/fmIDE/pull/11), [#13](https://github.com/taroyamakatrmttm-star/fmIDE/pull/13), [#53](https://github.com/taroyamakatrmttm-star/fmIDE/pull/53), [#177](https://github.com/taroyamakatrmttm-star/fmIDE/pull/177) |
| [5.7 Blocks in the workbook](#blocks-in-excel) | Instance tabs, vertical blocks' vintages | foundations, [#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67) |
| [5.8 The Excel look](#excel-look) | Your Excel style, a row's own format, exact number formats | step 11a ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)), [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190) |
| [5.9 Layouts that are remembered](#layouts) | Module and instance layouts, a template's layout, Attach to Template…, the layout in the document | step 11b–d ([#64](https://github.com/taroyamakatrmttm-star/fmIDE/pull/64)–[#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67)), [#139](https://github.com/taroyamakatrmttm-star/fmIDE/pull/139), [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176), [#178](https://github.com/taroyamakatrmttm-star/fmIDE/pull/178) |
| [5.10 Sensitivity: the Tornado and the Spider in Excel](#sensitivity) | One analysis, then several, live in Excel | step 16 ([#122](https://github.com/taroyamakatrmttm-star/fmIDE/pull/122), [#123](https://github.com/taroyamakatrmttm-star/fmIDE/pull/123)), step 19 B3a ([#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150)), [#179](https://github.com/taroyamakatrmttm-star/fmIDE/pull/179) |
| [5.11 fmGraph boards in Excel](#fmgraph-in-excel) | Scenarios, Tornado and Spider, sliders and charts carried into the workbook | step 19 ([#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145)–[#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156)), [#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188) |
| [5.12 ExcelExporter on a phone](#exporter-phone) | Make the workbook and share it | step 17 P3 ([#131](https://github.com/taroyamakatrmttm-star/fmIDE/pull/131)) |


---

<a id="first-workbook"></a>
## Lesson 5.1 — Your first workbook

> **Goal:** turn an fmIDE model into an Excel workbook with live formulas.
> **You need:** fmIDE and ExcelExporter. The example model: on *Canvas 1*, over 3 periods, Price `10` × Quantity `30` = Revenue, and Revenue − Costs (`200`) = Profit.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *What ExcelExporter does* (`what-is-excelexporter`), *Loading a model* (`load-model`) · fmIDE tutorial *From fmIDE to Excel* (`to-excel`)
> **Came in:** the first version; ← Back to fmIDE [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55); the model arriving from fmIDE [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96)

### Steps

1. In fmIDE, with the model open, choose **File → Open ExcelExporter**. ExcelExporter opens in its own window with the model loaded. Nothing has to be saved first.
2. Look at the page: the model's name in the dark bar at the top; on the left the **Tabs** panel (one tab, *Canvas 1*, 5 rows); on the right the **Rows** panel.
3. Press **⚙ Settings** and open **Workbook**. **Start label** is the first period column's heading (`2027` at first) and **Frequency** is annual, quarterly or monthly; the file name is here too (`fmIDE-export`). Close Settings.
4. Press **⬇ Generate .xlsx** at the top right. The workbook downloads.
5. Open it in Excel or LibreOffice.

### Check it

One tab, *Canvas 1*:

| | A | B | E | F | G |
|---|---|---|---|---|---|
| 2 | Line item | UOM | 2027 | 2028 | 2029 |
| 3 | Period # | | 1 | 2 | 3 |
| 4 | Price | | 10 | 10 | 10 |
| 5 | Quantity | | 30 | 30 | 30 |
| 6 | Revenue | | `=E4*E5` | `=F4*F5` | `=G4*G5` |
| 7 | Costs | | 200 | 200 | 200 |
| 8 | Profit | | `=E6-E7` | `=F6-F7` | `=G6-G7` |

Each rectangle is one row, and the operators became formulas: change Price in Excel and Profit follows.

### Good to know

- **After changing the model in fmIDE,** choose **File → ↻ From fmIDE** in ExcelExporter, or **Open ExcelExporter** in fmIDE again. A change to numbers keeps your layout; adding or deleting a rectangle starts a new one.
- **Other ways to load a model:** **File → Open Model…**, or drop a `.fmide` document, system or workspace file anywhere on the page. **File → Load Sample Model** shows one to try.
- **The layout is remembered** in this browser for each model, and kept in the `.fmide` document when ExcelExporter was opened from fmIDE ([lesson 5.9](#layouts)).
- **← Back to fmIDE**, at the top left, goes back to fmIDE. **File → Start Over** empties the page and keeps the layouts.
- **Nothing is uploaded:** the workbook is written in your browser, offline.

---

<a id="exporter-tour"></a>
## Lesson 5.2 — Finding your way in ExcelExporter

> **Goal:** know where every command is.
> **You need:** ExcelExporter with a model loaded ([lesson 5.1](#first-workbook)).
> **Time:** about 3 minutes.
> **In the app:** ExcelExporter Help → *What ExcelExporter does* (`what-is-excelexporter`), *Generating and saving the layout* (`generate`)
> **Came in:** step 14 · the new look [#81](https://github.com/taroyamakatrmttm-star/fmIDE/pull/81)

| Where | What is there |
|---|---|
| **The top bar** | **← Back to fmIDE**, the model's name, the **File** and **Layout** menus, **⚙ Settings**, **❓ Help** and **⬇ Generate .xlsx**. |
| **File menu** | Everything about the model: **Open Model…**, **Load Sample Model**, **Paste JSON…**, **↻ From fmIDE** (when fmIDE opened it), **Import Excel model…** ([Part 7](07-excel-import.md)), **Import fmGraph boards…**, **Start Over**. |
| **Layout menu** | Everything about this model's layout: **Import / Export Mapping**, **Use fmGraph boards…** ([lesson 5.11](#fmgraph-in-excel)), **Import / Export Module Layouts**, **📎 Attach to Template…** (when fmIDE opened it), **Excel Style…**, **Reset Mapping to Defaults…**. |
| **⚙ Settings** | Two tabs: **Workbook** (period labels, the fallback number format, the file name) and **Excel Style** ([lesson 5.8](#excel-look)). |
| **Under the top bar** | Messages, each with ×, and the yellow list of where the workbook differs from fmIDE ([lesson 5.4](#differences)). |
| **The sidebar, left** | **Tabs**, **Inputs & scenarios** ([lesson 5.6](#inputs-scenarios)) and **Sensitivity** ([lesson 5.10](#sensitivity)). |
| **Rows, right** | Every row of every tab, as the Tree first ([lesson 5.3](#tabs-rows)). |

### Good to know

- **Point at any button or menu item** to see what it does. A **?** beside each panel's heading opens its Help topic, and **❓** (or F1) opens Help itself, with What's new at the top.
- **Before a model is loaded,** the page is a welcome screen: drop a file on its box, choose one, or load the sample.
- **On a narrow window,** the sidebar stacks above the rows.

---

<a id="tabs-rows"></a>
## Lesson 5.3 — Tabs, rows and the Tree View

> **Goal:** arrange the workbook: which tabs, which rows on each, in what order, with what labels.
> **You need:** ExcelExporter with the model of [lesson 5.1](#first-workbook).
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *Tabs* (`tabs`), *Rows: what goes where* (`rows`), *The Tree View* (`tree-view`)
> **Came in:** the first version; tidier formulas and defaults [#44](https://github.com/taroyamakatrmttm-star/fmIDE/pull/44); a row's own format, indents and the right-click menu [#46](https://github.com/taroyamakatrmttm-star/fmIDE/pull/46); a new layout in formula order [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49); borders side by side [#98](https://github.com/taroyamakatrmttm-star/fmIDE/pull/98); tab names with an apostrophe [#124](https://github.com/taroyamakatrmttm-star/fmIDE/pull/124); Collapse all and Expand all [#192](https://github.com/taroyamakatrmttm-star/fmIDE/pull/192); renaming when the selection bar moves the list (branch `claude/tree-rename-fixes`)

Each fmIDE canvas starts as one tab, and each rectangle as one row. Operators, aliases and period shifts never get rows: they become parts of formulas.

### Steps

1. In the **Tabs** panel, click the tab's name and type `P&L`. (**↑ ↓** reorder tabs, **+ Add Tab** adds one, **🗑** deletes one and moves its rows to the first tab left.)
2. In the **Rows** panel, the **Tree** shows every tab's rows in order, as they will be in Excel. Double-click **Costs** and rename it `Operating costs`.
3. Select **Revenue** and press **+ Label Row**: a label row appears below it. Double-click it and type `Results`.
4. Select Price and Quantity (click, then Ctrl-click; Shift-click selects a range), right-click, and look at the menu: move, include, constant, scenarios, indent, format, move to another tab.
5. Press **⬇ Generate .xlsx**.

### Check it

The workbook's tab is named *P&L*, the row reads *Operating costs*, and *Results* sits under Revenue as a label. The formulas are unchanged: a label is only text.

### Good to know

- **Include** (untick it) leaves a row out of the workbook. If other rows read it, ExcelExporter lists them in the yellow panel ([lesson 5.4](#differences)).
- **Constant** puts a small fixed number (a sign flip, ×1000) straight into the formulas that use it, instead of a row of its own.
- **Sort** reorders a tab's rows: by calculation order (inputs first, or results first), by position on the canvas, or alphabetically; press **Apply**. A new layout starts in calculation order.
- **Sections** (a tick box) splits each tab into INPUTS, CALCULATIONS and OUTPUTS bands; untick it for one free list.
- **Other views** of the same rows: one table per Excel tab, or one per canvas.
- **Indent** labels with **Alt+Shift+→** and **Alt+Shift+←**, like Excel's Increase Indent.
- **Collapse all** and **Expand all** fold every tab in the Tree. On a tablet, press and hold a row for its menu, and double-tap to rename.

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

<a id="inputs-scenarios"></a>
## Lesson 5.6 — The Inputs tab, scenarios and Global Cases

> **Goal:** gather every typed number on one tab, and give inputs alternative values that one cell switches between.
> **You need:** ExcelExporter with the model of [lesson 5.1](#first-workbook).
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *The Inputs tab* (`inputs-tab`), *Scenarios and global cases* (`scenarios`)
> **Came in:** the first version; block inputs on the Inputs tab [#11](https://github.com/taroyamakatrmttm-star/fmIDE/pull/11), [#13](https://github.com/taroyamakatrmttm-star/fmIDE/pull/13); links from other tabs [#53](https://github.com/taroyamakatrmttm-star/fmIDE/pull/53); space between groups [#177](https://github.com/taroyamakatrmttm-star/fmIDE/pull/177)

### 5.6.1 The Inputs tab

**Steps**

1. In the sidebar's **Inputs & scenarios** panel, tick **Gather inputs on a separate tab**.
2. The Tabs panel now starts with **Inputs** (4 rows). Choose its name, how its rows are grouped (by Excel tab, by canvas, or not at all) and their order; **Re-apply layout** rebuilds the grouping.
3. Press **⬇ Generate .xlsx**.

**Check it**

The workbook's first tab is **Inputs**: a header row for *Canvas 1* with the period labels, then Price, Quantity and Costs with their numbers. On *Canvas 1*, those rows now link to it: Price in the first period is `='Inputs'!E5`. Change a number on the Inputs tab and the model follows.

### 5.6.2 Scenarios and Global Cases

**Steps**

1. With the Inputs tab on, find the **Price** row on the Inputs tab, in the Rows panel, and tick its **scenarios** (or select several rows and use **≡ Add Scenarios**). **Scenarios each**, in *Inputs & scenarios*, sets how many values each such input has: 3, say.
2. In **Inputs & scenarios**, set **Global cases** to 2 or more.
3. Press **⬇ Generate .xlsx**.

**Check it**

On the Inputs tab, Price has a row per scenario: the first holds fmIDE's number, the others are empty for you to fill in Excel. A **Scenarios** tab picks which scenario each input uses in each case, and the **Global Case** cell (C2 on the Scenarios tab) chooses the case the whole workbook runs.

### Good to know

- **An input's original row stays where it was** and links to the Inputs tab, in the *Links* style of your Excel style.
- **Block inputs** with nothing wired in become inputs of their own on the Inputs tab, one per block copy.
- **An empty row** comes before each group's header but the first.
- **From fmGraph:** scenarios saved in fmGraph can fill all of this for you ([lesson 5.11](#fmgraph-in-excel)).
- **Sensitivity and sliders** add rows under an input on the Inputs tab, gathered and labelled ([lessons 5.10](#sensitivity) and [5.11](#fmgraph-in-excel)).

---

<a id="blocks-in-excel"></a>
## Lesson 5.7 — Blocks in the workbook

> **Goal:** read how blocks and vertical blocks come out in Excel.
> **You need:** the blocks of [lesson 2.7](02-building-models.md#blocks) (the *Tax* block used on *Company*, and the vertical *Depreciation* block used on *Assets*), loaded in ExcelExporter.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Blocks in the workbook* (`blocks`), *Modules remember their layout* (`module-layouts`)
> **Came in:** the first version; instance tabs remembering their layout, step 11d ([#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67))

Each time a block is used, it calculates on its own, so each copy gets its own rows. The block's box never gets a row; the rectangles inside it do.

### Steps

1. In fmIDE, open the model of lesson 2.7 and choose **File → Open ExcelExporter**.
2. In the Tabs panel, find **Tax (instance 1)** and **Depreciation (instance 1)** after the canvases' own tabs.
3. Press **⬇ Generate .xlsx** and open the workbook.

### Check it

- **Tax (instance 1)** holds this copy's rows: Tax rate, and Tax `='Company'!F4*F4` (Company profit × Tax rate). On *Company*, Company tax reads it: `='Tax (instance 1)'!F5`.
- **Depreciation (instance 1)** holds one set of rows per vintage (*Age — Vintage 1*, *Age — Vintage 2*…), with the vintage's number in column C and its own spending in column D, *Capex @ vintage*: `=INDEX('Assets'!$F$4:$J$4,$C5)`. Rows that are the same for every vintage are written once, marked *(shared)*. A **Σ Total** row combines the vintages as the output does in fmIDE (SUM here; MAX, MIN, AVERAGE or PRODUCT if chosen), and *Depreciation charge* on *Assets* reads that total.

### Good to know

- **A block input with nothing wired in** reads 0 in that copy, or becomes an input on the Inputs tab ([lesson 5.6](#inputs-scenarios)).
- **Many periods mean many rows** in a vertical block: reorder, rename or leave them out like any other rows.
- **Lay out the other instances like this,** on an instance tab in the Tabs panel, gives the block's other copies the same layout. A block from a template also remembers it for the next model ([lesson 5.9](#layouts)).
- **A block that uses itself,** directly or through another block, is left out, and the yellow panel says so.

---

<a id="excel-look"></a>
## Lesson 5.8 — The Excel look: your Excel style and a row's own format

> **Goal:** make every workbook look the way you want, and give single rows their own look and number format.
> **You need:** ExcelExporter with a model.
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *How the workbook looks* (`formats`), *The Tree View* (`tree-view`)
> **Came in:** step 11a, the Excel look in ExcelExporter ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)); a row's own format [#46](https://github.com/taroyamakatrmttm-star/fmIDE/pull/46); borders side by side [#98](https://github.com/taroyamakatrmttm-star/fmIDE/pull/98); exact number formats [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190); the colour grid, branch `claude/colour-grid-picker-1c5e83`

How cells look in Excel belongs to ExcelExporter. fmIDE decides only the **number formats** ([lesson 2.11](02-building-models.md#canvas-look)); its canvas colours never reach Excel.

### Steps

1. **⚙ Settings → Excel Style** (or **Layout → Excel Style…**). Every cell takes its look from one of seven **roles**: *Inputs*, *Calculations*, *Links*, *Headers*, *Section Headers*, *Labels* and *Notes*. Point at a role's name to see which cells it covers.
2. For **Inputs**, pick a light yellow fill and a blue font colour: each colour box opens a grid of colours (light yellow is *Yellow, lightest*; **More…** for an exact colour). Close Settings.
3. In the Rows panel's Tree, press **🎨** on **Profit**. Tick **Bold**, tick **Top** under the border, and type an **Excel number format** of `#,##0;(#,##0)` (negatives in brackets).
4. Press **⬇ Generate .xlsx**.

### Check it

Every input cell is yellow with a blue font, in this workbook and every workbook you make from now on. Profit alone is bold, has a line above it, and would show a loss as (60).

### Good to know

- **Your Excel style is yours,** the same for every model: it is kept in this browser. **Export Excel Style** and **Import Excel Style…** carry it to another computer; **Reset to Defaults…** brings back ExcelExporter's own look.
- **A row's own format** (🎨) is part of this model's layout. *Reset to the Excel style* takes it off.
- **Which number format wins,** first to last: the row's own Excel number format code; the row's own format; the rectangle's own 🎨 format in fmIDE; fmIDE's *Inputs* or *Calculations* role; the fallback number format (**⚙ Settings → Workbook**).
- **Excel number format** takes Excel's own codes, as in *Format Cells → Custom*: `"£"#,##0`, `0.0"x"`, `#,##0.0,,"m"` for millions. A code Excel can't use is marked in red and not kept.

---

<a id="layouts"></a>
## Lesson 5.9 — Layouts that are remembered, and layouts on templates

> **Goal:** know what ExcelExporter remembers, arrange a module's tab once for every model that uses it, and take a layout with you.
> **You need:** ExcelExporter opened from fmIDE, with a model that has a canvas made from a template (such as *Region North* in [lesson 3.1](03-reuse.md#templates)).
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *What is remembered, and which layout wins* (`remembered`), *Modules remember their layout* (`module-layouts`), *A template's attached layout* (`template-layouts`)
> **Came in:** step 11 · modules remember their layout [#64](https://github.com/taroyamakatrmttm-star/fmIDE/pull/64); a template carries a layout [#65](https://github.com/taroyamakatrmttm-star/fmIDE/pull/65), [#66](https://github.com/taroyamakatrmttm-star/fmIDE/pull/66); instance tabs [#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67); attaching without a file [#139](https://github.com/taroyamakatrmttm-star/fmIDE/pull/139); the layout in the document [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176); explained [#178](https://github.com/taroyamakatrmttm-star/fmIDE/pull/178)

ExcelExporter keeps three things in your browser:

| What | Holds | Kept | Reset |
|---|---|---|---|
| **A model's layout** (its *Mapping*) | The whole workbook: tabs, rows, labels, Include and Constant, row formats, the Inputs tab, scenarios, sensitivity, fmGraph's boards, Workbook settings | Per model, as you go; also in the `.fmide` document when fmIDE opened ExcelExporter | **Layout → Reset Mapping to Defaults…** |
| **A module's layout** | One template's tab: its name, rows, labels, Include and Constant, formats, indents (and its block copies' tabs) | Per template, whenever you change such a tab | **Forget**, on the tab |
| **Your Excel style** | How every cell looks ([lesson 5.8](#excel-look)) | Once, for every model | **Reset to Defaults…** |

**File → Start Over** keeps all three.

### Steps

1. In the Tabs panel, *Region North* is marked **🧩**: it came from a template. Arrange it: rename it, reorder its rows, give a row a label.
2. ExcelExporter remembers that layout for the template. The next model with a canvas from the same template, laid out here for the first time, starts with it.
3. To send the layout with the template itself: press **📎 Attach** on the tab (or **Layout → 📎 Attach to Template…**), then say yes when fmIDE asks. Save the document in fmIDE.

### Check it

Under Tabs, a line says the layout was attached. In fmIDE's Templates window, the template now carries an Excel layout, and it goes wherever the template goes: documents, new versions, library packs.

### Good to know

- **Which layout a model gets,** first that exists: the one this browser saved for the model; the one its `.fmide` document carries; otherwise a new layout, where each module's tab takes your own remembered layout for it, else the layout attached to its template, else the automatic sort.
- **Your own wins:** a template's attached layout is used only for a module you have never arranged yourself, and its tab then reads *layout from the template*.
- **Files:** **Export / Import Mapping** move one model's whole layout; **Export / Import Module Layouts** move every remembered module layout (fmIDE's *Attach Excel layout…* takes just the one for its template).
- **The layout in the document:** opened from fmIDE, each change here goes back to fmIDE and marks the document unsaved; saved there, the layout goes to any computer with the file.

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
> **Came in:** step 19 · [#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145), [#147](https://github.com/taroyamakatrmttm-star/fmIDE/pull/147), [#148](https://github.com/taroyamakatrmttm-star/fmIDE/pull/148), [#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150), [#152](https://github.com/taroyamakatrmttm-star/fmIDE/pull/152)–[#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156); later [#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188); a Tornado or Spider with no inputs left out, branch `claude/tornado-remove-all-inputs-655a57`; fmGraph's Free chart on the Dashboard, branch `claude/excel-free-chart-f3`

One window in ExcelExporter, **Layout → Use fmGraph boards…**, reads your boards and lists everything it can carry. Each item has a tick box, all ticked at first.

| In fmGraph | In the workbook |
|---|---|
| Scenarios (saved slider positions) | **Global Cases**: the *Scenarios* tab, the case number in C2 |
| Tornado and Spider charts | Sensitivity analyses ([lesson 5.10](#sensitivity)), each on its own tab |
| Sliders | The **Dashboard** tab: a scroll bar and a cell to type in, per slider |
| Bars, Columns, Lines, Waterfall and Free charts | Excel charts on the Dashboard, moving with the sliders |

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
- **A Free chart** becomes stacked columns, one column per grid column, each piece where fmGraph puts it. Beside it (from column N) are three tables of formulas: the pieces (Sits at, Top, Bottom, End, the check ✓ or ✗), the rectangles (From and To) and the chart's series, with a hidden filler under each piece. For example, in a balance sheet and cash flow with CFO moved from 50 to −200, the CFO step crosses 0 (from 100 down to −100), Cash EB ends at −130, and the cash part of the Asset stack hangs below 0, all as in fmGraph. A piece that hangs back into the one under it can't be drawn so in Excel: it is drawn just beyond it, and its **Overlaps** cell says *overlaps*. Totals are in the table, not on the chart. An Excel chart holds at most 255 series (two per piece, four per rectangle); a larger Free chart is listed under *Not carried*.
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
| A Tornado or Spider isn't in the list. | It moves no inputs this model has: *Not carried* counts it. Add its inputs in fmGraph (**+ Input** or **↻**). |
| A Tornado bar has no length. | The input is 0, and a percent of 0 is 0. Switch that input to **±** (amount) in fmGraph. |

---

<a id="exporter-phone"></a>
## Lesson 5.12 — ExcelExporter on a phone

> **Goal:** make a workbook on your phone and share it.
> **You need:** fmIDE on a phone with a document open ([lesson 2.14](02-building-models.md#phone)).
> **Time:** about 2 minutes.
> **In the app:** ExcelExporter Help → *Making the workbook on a phone* (`phone`)
> **Came in:** step 17 P3 ([#131](https://github.com/taroyamakatrmttm-star/fmIDE/pull/131))

### Steps

1. In fmIDE on the phone, **More (☰) → 📊 Make Excel**. ExcelExporter opens with the model as it is now, on one screen.
2. Check the tabs the workbook will hold (with each one's rows) and the file name; tap the name to change it.
3. Tap **⬇ Make the workbook**, and pick where it goes in the share sheet: Excel or Numbers, Mail, Messages, Files.

### Check it

The workbook opens in Excel on the phone, laid out as you set it up on a computer or tablet for this model (or the automatic layout if you never did): tabs, rows, your Excel style, the Sensitivity tab and the Dashboard.

### Good to know

- **Where it differs from fmIDE** shows on the screen too ([lesson 5.4](#differences)).
- **Where the browser can't share files,** the workbook downloads instead.
- **☰ → Full app** shows the whole of ExcelExporter on the phone, to change the layout; **📱 Phone layout** goes back. **☰ → Open a model file…** opens a file without fmIDE.

---

[← Part 4](04-macros-scripting.md) · [Contents](README.md) · [Part 6 →](06-fmgraph.md)

*Part 5 describes ExcelExporter. Like the rest of `docs/`, it is licensed under the [Apache License 2.0](../../LICENSE).*
