# Part 7 — Importing an Excel model

[← Part 6](06-fmgraph.md) · [Contents](README.md)

ExcelExporter turns an fmIDE model into a workbook; it also goes the other way. **File → Import Excel model…** reads a financial model built in Excel and rebuilds it as an fmIDE model, with a report saying how closely it matches Excel. Open a spreadsheet you inherited, and get it back as a picture of rectangles and arrows that you can check, change and carry on with in fmIDE.

The background and design are in [`docs/step20-excel-import.md`](../step20-excel-import.md).

**Practise on the sample workbooks.** Every lesson in this part uses a small workbook kept in the repository, in [`tests/fixtures/excel-import/`](../../tests/fixtures/excel-import/), so you can follow along and see the same numbers. The numbers and messages were checked against the apps on `main` at pull request #193 (19 October 2026).

| Sample | What it shows |
|---|---|
| `03-two-sheets.xlsx` | Two sheets, Inputs and Calc, over 2026–2030: the main example |
| `04-not-supported.xlsx` | Formulas the import keeps as Excel's numbers (VLOOKUP, NPV, COUNTIF), and a cell unlike its row |
| `05-actuals-forecast.xlsx` | Rows with typed actuals and a forecast formula |
| `06-running-totals.xlsx` | Running totals such as `SUM($D$5:D5)` |
| `07-number-formats.xlsx` | Number formats such as `#,##0;(#,##0)` and `0.0"x"` |

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [7.1 Which workbooks import well](#which-workbooks) | The layout the import expects | step 20a ([#158](https://github.com/taroyamakatrmttm-star/fmIDE/pull/158)) |
| [7.2 Import a workbook and check what was found](#import-confirm) | File → Import Excel model…, the confirm window, correcting a guess | step 20b–d ([#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159)–[#161](https://github.com/taroyamakatrmttm-star/fmIDE/pull/161)) |
| [7.3 What the import builds](#what-is-built) | Canvases, rectangles, operators; Excel functions it translates; running totals | step 20e ([#162](https://github.com/taroyamakatrmttm-star/fmIDE/pull/162)), [#186](https://github.com/taroyamakatrmttm-star/fmIDE/pull/186) |
| [7.4 The report](#import-report) | How the model compares with Excel, and what was kept as numbers | step 20f ([#163](https://github.com/taroyamakatrmttm-star/fmIDE/pull/163)) |
| [7.5 Save for fmIDE, and carry on in fmIDE](#save-for-fmide) | The `.fmide` file, its Excel layout inside | step 20g ([#164](https://github.com/taroyamakatrmttm-star/fmIDE/pull/164)), [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176) |
| [7.6 Rows with typed actuals and a forecast](#actuals-forecast) | Rows "in parts", the shared year switch, the column before the first year | [#165](https://github.com/taroyamakatrmttm-star/fmIDE/pull/165), [#169](https://github.com/taroyamakatrmttm-star/fmIDE/pull/169), [#171](https://github.com/taroyamakatrmttm-star/fmIDE/pull/171), [#175](https://github.com/taroyamakatrmttm-star/fmIDE/pull/175) |
| [7.7 Long sheets: a canvas per section](#sections) | One canvas per section; canvases that grow | [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168), [#170](https://github.com/taroyamakatrmttm-star/fmIDE/pull/170) |
| [7.8 The workbook's own layout and look](#layout-and-look) | Row order, headings, constants, bold, colours, exact number formats | [#172](https://github.com/taroyamakatrmttm-star/fmIDE/pull/172), [#173](https://github.com/taroyamakatrmttm-star/fmIDE/pull/173), [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190) |
| [7.9 The round trip](#round-trip) | The new workbook checked against the original | [#174](https://github.com/taroyamakatrmttm-star/fmIDE/pull/174) |
| [7.10 Safety, limits and troubleshooting](#import-troubleshooting) | What the import never does; limits; answers | step 20b ([#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159)) |

---

<a id="which-workbooks"></a>
## Lesson 7.1 — Which workbooks import well

> **Goal:** know whether a workbook will import well before you try.
> **You need:** nothing yet.
> **Time:** about 2 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** step 20a · [#158](https://github.com/taroyamakatrmttm-star/fmIDE/pull/158)

The import is built for models laid out the way most financial models are:

- **Rows are line items** (Revenue, Costs, Profit…), with their name in a column on the left.
- **Columns are periods** (years or dates), with a **header row** holding them.
- **One formula is copied along each row**: for example `=D6*D7` in 2026, `=E6*E7` in 2027, and so on.

Modelling standards such as FAST teach this layout, and most bank, start-up and project models follow it. A workbook laid out differently (periods down the rows, several blocks of years on one sheet) may import only in part; the confirm window ([lesson 7.2](#import-confirm)) lets you help it.

| Word | Meaning here |
|---|---|
| **Input** row | Typed numbers along the periods. Nothing calculates it. |
| **Calculation** row | The same formula copied along the row. |
| **Saved value** | The number Excel stored in the file for each cell the last time it calculated. The import compares its own answers with these. |
| **Section** | A part of a sheet under a heading, such as *Income Statement*. |

---

<a id="import-confirm"></a>
## Lesson 7.2 — Import a workbook and check what was found

> **Goal:** open an Excel workbook in ExcelExporter and check, sheet by sheet, what the import found.
> **You need:** ExcelExporter, and `03-two-sheets.xlsx`.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** step 20b–20d · [#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159), [#160](https://github.com/taroyamakatrmttm-star/fmIDE/pull/160), [#161](https://github.com/taroyamakatrmttm-star/fmIDE/pull/161)

### Steps

1. Open ExcelExporter (in fmIDE: **File → Open ExcelExporter**, or open `apps/ExcelExporter.html` on its own).
2. Choose **File → Import Excel model…** and pick `03-two-sheets.xlsx`. (You can also drop an `.xlsx` or `.xlsm` file on the page.)
3. A window titled **Import Excel model** opens. It shows the file, *03-two-sheets.xlsx · 2 sheets*, and a box per sheet.
4. Open **Rows** on the Calc sheet to see each row's kind and formula.

### Check it

| Sheet | Summary line | Header row | Periods from … to | Labels | Units |
|---|---|---|---|---|---|
| Inputs | *5 periods, 2026–2030 · 3 inputs, 1 assumption, 1 title* | 3 | D to H | A | B |
| Calc | *5 periods, 2026–2030 · 9 calculations, 1 title* | 3 | D to H | A | B |

Some of Calc's rows:

| Row | Label | Kind | Formula |
|---|---|---|---|
| 5 | Revenue | calculation | `Inputs!D5*Inputs!D6` |
| 7 | Variable costs | calculation | `ROUND(D5*0.4,0)` |
| 8 | Total costs | calculation | `SUM(D6:D7)` |
| 10 | Tax | calculation | `MAX(0,D9*TaxRate)` |
| 13 | Loss flag | calculation | `IF(D11<0,1,0)` |

On Inputs, *Tax rate* is an **assumption** of 0.25: one typed number before the periods.

### The kinds of row

| Kind | What it means | In fmIDE |
|---|---|---|
| title | A heading, with no numbers | Left out (kept as a heading in the layout, lesson 7.8) |
| input | Typed numbers along the periods | An input rectangle with its number per period |
| assumption | One typed number before the periods (such as a tax rate in column C) | An input rectangle with that number in every period |
| calculation | The same formula copied along the row | A rectangle fed by operators |
| opening balance | A typed number in the first period, then a formula (such as the previous closing balance) | The typed number in period 1, the formula after |
| in parts | Typed actual years, then a forecast formula ([lesson 7.6](#actuals-forecast)) | The typed numbers in the actual years, the formula in the forecast |
| one formula | A single formula before the periods (such as an NPV) | One rectangle |

### Correcting a guess

1. Type a different number in **Header row**, or different column letters in **Periods from … to**, **Labels** or **Units** (empty Units for none).
2. Click outside the box (or press Tab). The sheet is worked out again at once; its summary and rows change.
3. Untick a sheet to leave it out. A sheet with no row of periods (a cover page, a lookup table) starts unticked, with *No row of periods found: give a header row to import it.*
4. Press **Import** when it looks right, or **Cancel** (or Esc).

### Good to know

- A note such as *differs in F12* after a row's formula marks a cell unlike the rest of its row (try `04-not-supported.xlsx`, row 12).
- Old `.xls` files and password-protected workbooks can't be read. Open them in Excel and **Save As** an `.xlsx` without a password first; the message says so.
- Macros in an `.xlsm` file are never read or run.

---

<a id="what-is-built"></a>
## Lesson 7.3 — What the import builds

> **Goal:** know what you get after **Import**, and which Excel functions become fmIDE operators.
> **You need:** the confirm window of [lesson 7.2](#import-confirm).
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** step 20e · [#162](https://github.com/taroyamakatrmttm-star/fmIDE/pull/162); running totals [#186](https://github.com/taroyamakatrmttm-star/fmIDE/pull/186)

### Steps

1. In the confirm window, press **Import**.

### Check it

- The message under the top bar reads *Imported 03-two-sheets.xlsx — 2 canvases, 13 rectangles, 5 periods.*
- The report opens ([lesson 7.4](#import-report)).
- **⬇ Generate .xlsx** works on the imported model straight away.

### What you get

- **One canvas per sheet**, named after the sheet (or one per section, [lesson 7.7](#sections)).
- **One rectangle per row**, named after its label, with its unit.
- **Each formula as a small picture** to the left of its rectangle: operators (`+`, `−`, `×`, `÷`, `if`, `max`…) fed by **aliases** of the rectangles it reads. A reference to the column on the left (the previous period) becomes a **period shift**.
- **A number inside a formula** (the 0.4 in `=ROUND(D5*0.4,0)`) becomes a small rectangle of its own on the canvas, named after its row ("Variable costs: 0.4"). In the workbook ExcelExporter writes, it goes back inside the formula ([lesson 7.8](#layout-and-look)).

**What Excel functions become:** `SUM`, `MIN`, `MAX`, `AVERAGE`, `PRODUCT`, `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CHOOSE`, `ABS`, `LN`, `EXP`, `SQRT`, `INT`, `TRUNC`, `MOD`, `POWER`, the arithmetic signs and the comparisons (`=`, `<>`, `<`, `>`, `<=`, `>=`) all become fmIDE operators of the same meaning.

**Example.** In Excel, Calc's Revenue is `=Inputs!D5*Inputs!D6` copied to 2030. In fmIDE, Revenue is fed by a `×` whose two inputs are aliases of Units sold and Unit price on the Inputs canvas.

### Running totals

A running total such as `SUM($D$5:D5)` (one row, from a fixed first period to this one) is translated live: this period's value plus the previous period's total, through a period shift.

Try `06-running-totals.xlsx`: *Cumulative cash* (`SUM($D$5:D5)`) and *Cash balance* (`$C$7+SUM($D$5:D5)`) are translated, and the report says *All 25 calculated cells agree with Excel's saved values.* When a running total is part of a longer formula, it gets a shared rectangle of its own, such as *Running total of Cash flow*; one that starts in a later period is named for it (*Running total of Cash flow from 2028*). An `AVERAGE` growing along the periods, or a sum over several rows growing along the periods, is kept as Excel's numbers ([lesson 7.4](#import-report)).

---

<a id="import-report"></a>
## Lesson 7.4 — The report: how the model compares with Excel

> **Goal:** know how far you can trust the rebuilt model.
> **You need:** an import done ([lesson 7.3](#what-is-built)); then `04-not-supported.xlsx`.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** step 20f · [#163](https://github.com/taroyamakatrmttm-star/fmIDE/pull/163)

After Import, the import calculates the model itself and compares **every calculated cell** with the value Excel saved for it. A window titled **Imported from Excel** shows the result. It opens after Import, and again from **File → Import Report…** while that model is loaded.

### Steps

1. Import `03-two-sheets.xlsx` (lessons 7.2–7.3) and read the report.
2. Close it. Import `04-not-supported.xlsx` the same way and read its report.

### Check it

For `03-two-sheets.xlsx`, in green: *All 45 calculated cells agree with Excel's saved values.*

For `04-not-supported.xlsx`: *All 20 calculated cells agree with Excel's saved values*, and then:

- **Kept as Excel's saved values** — *Valuation!D6:H6 · Growth: VLOOKUP*, *Valuation!C10 · NPV: NPV*, *Valuation!C13 · Years above 220: COUNTIF*. These rows keep Excel's numbers as typed inputs, so the model still adds up, but they won't move when their inputs change.
- **Cells unlike the rest of their row** — *Valuation!F12 · Cash doubled: Excel's saved value in that period*. A number typed over one period of a formula row: that period keeps Excel's value, as the rectangle's own number there.

### What it can't translate yet

These are kept as Excel's numbers, and listed:

- Lookups: `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`, `OFFSET`, `INDIRECT`.
- Sums and counts across the periods: `NPV`, `IRR`, `SUMIF`, `COUNTIF`; an average, or a sum over several rows, growing along the periods.
- Dates and text: `EOMONTH`, `TEXT`, joining text with `&`, checks that give text such as "OK" / "ERROR".
- Circular references (a row that, in the same period, depends on itself through others).
- Any other function: the report names it.

### Good to know

- **When some cells differ,** the summary is amber, for example *43 of 45 calculated cells agree with Excel's saved values; 2 differ*, and **Differ from Excel** lists each, such as *Plan!C3 · Doubled · 2027: fmIDE 24, Excel 25*.
- **A cell where Excel shows an error** (such as `#DIV/0!`) agrees when the model fails there too.
- ***Nothing to compare*** means the workbook was saved without its formulas' values. Some programs do this, and so does ExcelExporter itself. Open the file in Excel, save it, and import it again.
- **Notes** at the end: macros not read, chart sheets left out, sheets with different numbers of periods, a sheet split into sections.

---

<a id="save-for-fmide"></a>
## Lesson 7.5 — Save for fmIDE, and carry on in fmIDE

> **Goal:** keep the imported model as an fmIDE document and work on it in fmIDE.
> **You need:** `03-two-sheets.xlsx` imported; fmIDE.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`); fmIDE Help → *Saving and opening documents* (`documents`)
> **Came in:** step 20g · [#164](https://github.com/taroyamakatrmttm-star/fmIDE/pull/164); the layout in the document [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176)

### Steps

1. In the report, press **Save for fmIDE** (or later, **File → Save for fmIDE**).
2. The file downloads, named after your workbook: `03-two-sheets.fmide`. The message reads *Saved 03-two-sheets.fmide — open it in fmIDE with File → Open…; its Excel layout goes with it.*
3. In fmIDE, **File → Open…** (Ctrl+O, ⌘O on a Mac) and pick that file.
4. The model opens with two canvases, **Inputs** and **Calc**: their tabs are under the ribbon, above the canvas. Switch between them with the tabs, or Alt+Page Down and Alt+Page Up.
5. On Inputs, change **Unit price** to 30 in every period: select it, press its 📈 button, and type `30, 30, 30, 30, 30`. Press **Evaluate**.
6. Keep your changes with **File → Save**: it is already an fmIDE document.

### Check it

| Calc, in 2027 | Before | Unit price 30 |
|---|---|---|
| Revenue | 30,000 | 36,000 |
| Net income | 6,750 | 9,450 |

### Good to know

- **Every app opens it.** The saved file is an ordinary fmIDE document, so fmIDE, ExcelExporter and fmGraph all open it. From here it is a normal fmIDE model: **File → Open fmGraph** to explore it, **File → Open ExcelExporter** for a fresh workbook.
- **Its Excel layout goes with it.** Open the document in ExcelExporter on any computer, directly or through fmIDE, and the tabs come out as they were. Change the layout in ExcelExporter opened from fmIDE, and fmIDE keeps the change in the document (save it there).
- **Save for fmIDE and Import Report…** show in the File menu only while the imported model is loaded.

---

<a id="actuals-forecast"></a>
## Lesson 7.6 — Rows with typed actuals and a forecast

> **Goal:** import a model whose rows have typed actual years and a forecast formula, and keep the forecast live.
> **You need:** ExcelExporter, and `05-actuals-forecast.xlsx`.
> **Time:** about 10 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`); fmIDE Help → *A value that changes over time* (`values-over-time`)
> **Came in:** [#165](https://github.com/taroyamakatrmttm-star/fmIDE/pull/165), [#169](https://github.com/taroyamakatrmttm-star/fmIDE/pull/169), [#171](https://github.com/taroyamakatrmttm-star/fmIDE/pull/171), [#175](https://github.com/taroyamakatrmttm-star/fmIDE/pull/175)

Real models usually type the **actual years** and use **formulas for the forecast**, on the same row. The import reads such a row **in parts**, so the forecast stays a formula: change the growth rate in fmIDE and the forecast moves, as in Excel.

### Steps

1. **File → Import Excel model…** and pick `05-actuals-forecast.xlsx`.
2. Open **Rows** on the Model sheet.
3. Press **Import**, read the report, then **Save for fmIDE** and open the file in fmIDE.
4. In fmIDE, select **Revenue** and press its **🕒** button (*Which periods use this rectangle's own number?*).

### Check it

The confirm window's summary: *5 periods, 2026–2030 · 1 input, 3 calculations, 7 rows in parts, 1 opening balance, 1 title*. Some rows:

| Label | Kind | Its parts |
|---|---|---|
| Revenue | in parts | 2026–2028: typed; 2029–2030: `F7*(1+G5)` |
| Costs | in parts | 2026–2028: typed; 2029–2030: `G7*G6` |
| Depreciation | in parts | 2026–2028: `D11*0.5`; 2029–2030: `F14*0.2` |
| Assets opening | opening balance | `C14` |

The report: *All 55 calculated cells agree with Excel's saved values.* In fmIDE, Revenue's 🕒 shows 2026–2028 ticked: those years use the rectangle's own typed numbers, and the forecast formula feeds the others.

### How it is built

- **Typed years go in the row's own rectangle.** A row's typed actual years, an opening balance and a cell unlike its row are kept as the rectangle's own numbers in those periods (ticked under 🕒). The picture to its left is the formula alone.
- **One shared switch.** A row with one formula for the actual years and another for the forecast (such as Depreciation) chooses by year through an `if`. All such rows on a canvas read **one shared rectangle**, such as **Up to 2028**: 1 up to 2028 and 0 after. In the workbook it is an ordinary input row, so you can see and change where the actual years end.
- **The column before the first year.** `=D9-C9` in the first period reads C9, the column before the periods. Excel takes a blank there as 0; so does the import, and the formula stays live.
- **Rows that read each other in different years** (Capex reading Investments in the actuals, Investments reading Capex in the forecast) are not a circular reference, and the import doesn't treat them as one.

### Good to know

- A row whose first year is blank is handled too.
- **On a real model.** A three-statement model (income statement, balance sheet and cash flow, 2020–2029) imported with all 670 calculated cells agreeing with Excel. The only row kept as numbers was its "Balance Sheet Check", which gives the text OK or ERROR.

---

<a id="sections"></a>
## Lesson 7.7 — Long sheets: a canvas per section

> **Goal:** import a long sheet as several canvases, one per section, instead of one very tall canvas.
> **You need:** ExcelExporter, and a workbook with a sheet of more than 40 rows, split by headings (your own, or any three-statement model).
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`); fmIDE Help → *Canvases* (`canvases`)
> **Came in:** [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168), [#170](https://github.com/taroyamakatrmttm-star/fmIDE/pull/170)

### Steps

1. **File → Import Excel model…** and pick the workbook.
2. A sheet with headings that have blank rows above them (Assumptions, Income Statement, Balance Sheet…) shows a tick box, **One canvas per section (6)**. Point at it to see the sections' names.
3. It starts **ticked for a sheet of more than 40 rows**, unticked for a shorter one. Leave it ticked, and press **Import**.

### Check it

Each section is a canvas of its own, named after its heading. The rows above the first such heading become a section too, named after their own first heading. With several sheets imported, a section's canvas is named *Sheet — Section*. The report's notes say how the sheet was split, for example *"Three Statement Model" is 6 canvases, one per section*.

### Good to know

- **Rows still read each other across canvases,** through aliases, so the model calculates exactly as before.
- **Canvases grow to hold every rectangle** ([#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168)), so a long model scrolls all the way to its last row, at any zoom.
- **On the real model,** one canvas of nearly 14,000 pixels became six, the tallest about 3,000. The rectangles went from 151 to 78 and the operators from 172 to 59, and all 670 calculated cells still agree with Excel.

---

<a id="layout-and-look"></a>
## Lesson 7.8 — The workbook's own layout and look

> **Goal:** get a workbook back from ExcelExporter that is laid out and formatted like the original.
> **You need:** ExcelExporter; `03-two-sheets.xlsx` and `07-number-formats.xlsx`.
> **Time:** about 5 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`), *How the workbook looks* (`formats`)
> **Came in:** [#172](https://github.com/taroyamakatrmttm-star/fmIDE/pull/172), [#173](https://github.com/taroyamakatrmttm-star/fmIDE/pull/173), [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190)

### Steps

1. Import `07-number-formats.xlsx` and close the report.
2. Look at the Rows panel: each tab lists the rows in the original's order.
3. Press **⬇ Generate .xlsx** and open the workbook.

### Check it

- **The layout:** the rows are in the original's order, with a label row for each heading and an empty row for each blank row. There are no Inputs / Calculations / Outputs sections.
- **The look:** each row keeps its look from the workbook (bold headings and totals, blue inputs, fills, the line above or below a total) and its exact number format. In this sample, Costs keeps `#,##0;(#,##0)` (negatives in brackets), Margin `0.0%;[Red]-0.0%`, Cover `0.0"x"`.
- **Constants:** numbers written inside the formulas (the 0.4 in `=ROUND(D5*0.4,0)` in `03-two-sheets.xlsx`) are written in the formulas again, as in the original. They are marked **Constant** in the Rows panel, so they have no rows of their own.

### Good to know

- **A row's look becomes its own format** in ExcelExporter's Rows panel, where you can change it like any row's. A number format code is kept exactly ([#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190)): the code most of a row's period cells use.
- **On a row in parts,** the row takes the formula cells' look.
- **In fmIDE** the canvas leaves a gap wherever the sheet had a heading or blank rows, so it reads in the same blocks as the sheet.
- **The layout is remembered** in this browser for the model, and it is inside the `.fmide` file Save for fmIDE writes ([lesson 7.5](#save-for-fmide)). Rectangles you add later in fmIDE join it at the end of their tab.
- **A model opened in another browser without its document** gets ExcelExporter's usual layout. Import again, or use the `.fmide` file.

---

<a id="round-trip"></a>
## Lesson 7.9 — The round trip: checking the new workbook

> **Goal:** be sure the workbook ExcelExporter writes gives the original's numbers.
> **You need:** an imported model.
> **Time:** about 2 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** [#174](https://github.com/taroyamakatrmttm-star/fmIDE/pull/174)

### Steps

1. Import `03-two-sheets.xlsx` and close the report.
2. Press **⬇ Generate .xlsx**.

### Check it

The message under the top bar reads *Workbook generated — check your downloads. Recalculated here, the workbook gives the original's value in all 45 cells.* (For `05-actuals-forecast.xlsx`: *in all 55 cells*.) **File → Import Report…** shows the same line.

### Good to know

- **How it works:** after Generate, ExcelExporter works out every formula of the workbook it has just written, in your browser, and compares each imported formula cell with the value the original saved.
- **If some differ,** the message is amber and names the first three.
- **A function this check doesn't work out** (one ExcelExporter never writes) is counted as *not checked*, never as a match.
- **Check the period headings.** The workbook's period columns are labelled from ExcelExporter's own setting, **⚙ Settings → Workbook → Start label** (2027 at first), not from the original's years. For `03-two-sheets.xlsx`, whose years are 2026–2030, type `2026` there before you generate. The numbers are right either way; only the headings change.

---

<a id="import-troubleshooting"></a>
## Lesson 7.10 — Safety, limits and troubleshooting

> **Goal:** know what the import never does with someone else's file, its limits, and what to do when something goes wrong.
> **You need:** nothing.
> **Time:** about 3 minutes.
> **In the app:** ExcelExporter Help → *Importing an Excel model* (`import-excel`)
> **Came in:** step 20b · [#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159)

### Safety

The import treats every workbook as possibly hostile, since it may come from anyone.

- **Nothing in the file runs.** Formulas are read as text by the import's own reader, never executed. Macros are never opened.
- **Every name is shown as plain text.** Sheet names, labels and formulas can't add anything to the page.
- **No library and no internet.** Your browser itself unpacks the workbook. Nothing is uploaded.
- **Limits** stop a damaged or hostile file from freezing your browser. A file over a limit is refused with a message naming it.

| Limit | |
|---|---|
| File size | 50 MB |
| Sheets | 64 |
| Cells with content | 200,000 |
| Characters in a formula | 8,192 (Excel's own) |
| Cells in a range inside a formula | 500 |
| Parts in one row | 4 |

### Troubleshooting

| Problem or question | Answer |
|---|---|
| *This is an old Excel file (.xls) or a password-protected workbook.* | Open it in Excel, **Save As** an `.xlsx` workbook without a password, and import that. |
| A sheet says *No row of periods found*. | Its periods aren't in one row of years or dates. Type the right **Header row** and **Periods from … to**, or leave the sheet unticked. |
| The labels or units are wrong. | Type the right column letters in **Labels** or **Units** (empty Units for none). |
| **Import** is greyed out. | No sheet is ticked. Tick at least one sheet that has periods. |
| The report says *Nothing to compare*. | The workbook has no saved values. Open it in Excel, save it, and import it again. |
| A row is *kept as Excel's saved values*. | It uses something not translated yet (the report says what). It holds Excel's numbers but won't move when its inputs change. |
| A cell *differs from Excel*. | Usually a stale saved value (Excel didn't recalculate before saving) or a formula read differently. Press F9 in Excel, save, and import again; if it still differs, look at that cell's formula. |
| The canvas has small rectangles like "Revenue: 1". | A number written inside a formula (the 1 in `1+growth`) is a rectangle of its own on the canvas, named after its row. In the workbook it is written back in the formula. |
| The generated workbook's rows are in a different order from the original. | Import again, or open the `.fmide` file Save for fmIDE wrote: either brings the original's layout. |
| I can't scroll down to the last rows. | Canvases now grow to hold every rectangle. For a very long sheet, also tick **One canvas per section** before importing. |
| The workbook's year headings are one year off. | Set **⚙ Settings → Workbook → Start label** to the original's first year, then Generate again ([lesson 7.9](#round-trip)). |
| Where are a row's typed years? | In the row's own rectangle: select it and press 🕒 to see the years ticked. |
| Where did Import Report… and Save for fmIDE go? | They show in the File menu only while the imported model is loaded. |
| Will the saved file open in older versions? | It is an ordinary fmIDE document. A copy of fmIDE older than the document's version asks before opening it. |

---

[← Part 6](06-fmgraph.md) · [Contents](README.md)

*Part 7 describes ExcelExporter. Like the rest of `docs/`, it is licensed under the [Apache License 2.0](../../LICENSE).*
