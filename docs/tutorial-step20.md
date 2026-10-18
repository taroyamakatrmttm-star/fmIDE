# Tutorial: importing an Excel model (step 20)

A step-by-step guide to everything added in pull requests #158 to #171 (18 October 2026): step 20 of the build order, **importing an Excel model**. ExcelExporter has always turned an fmIDE model into an Excel workbook. Now it also goes the other way: it reads a financial model built in Excel and rebuilds it as an fmIDE model.

In one sentence: open a spreadsheet you inherited, and get it back as a picture of rectangles and arrows that you can check, change and carry on in fmIDE, with a report saying how closely it matches Excel.

The background and design are in [`docs/step20-excel-import.md`](step20-excel-import.md). The same guide is also kept as a [document on claude.ai](https://claude.ai/code/artifact/77ab76f2-f216-4a4e-83a0-6ae40562f103).

## Start here

**Words used in this guide**

- **Workbook**: an Excel file (`.xlsx`). It holds one or more **sheets** (the tabs at the bottom of Excel).
- **Row**: one line of the sheet, such as "Revenue". In fmIDE each row becomes one **rectangle**.
- **Period**: one column of time, such as 2026. The **header row** is the row holding the years (or dates).
- **Input**: a row of numbers someone typed. Nothing calculates it.
- **Calculation**: a row worked out by a formula, such as Revenue = Volume × Price.
- **Saved value**: the number Excel stored in the file the last time it calculated each cell. The import compares its own answers with these.
- **Canvas**: one page in fmIDE. Each sheet becomes one canvas, or one canvas per section of a long sheet (feature 8).
- **Section**: a part of a sheet under a heading, such as "Income Statement" or "Balance Sheet".

**The new features at a glance**

| # | Feature | Where it lives |
|---|---|---|
| 1 | File → Import Excel model… (or drop an `.xlsx` on the page) | ExcelExporter |
| 2 | The confirm window: what was found on each sheet, and changing it | ExcelExporter |
| 3 | Import: the fmIDE model built from the sheets ticked | ExcelExporter |
| 4 | The report: how the model compares with Excel, and what was kept as numbers | ExcelExporter |
| 5 | Save for fmIDE, then File → Open… in fmIDE | ExcelExporter → fmIDE |
| 6 | Rows with typed actuals and a forecast formula ("in parts") | ExcelExporter |
| 7 | Safety: what the import never does with someone else's file | ExcelExporter |
| 8 | Long sheets and tidy models: a canvas per section, typed years in the row's own rectangle, one shared switch, canvases that scroll to the end | ExcelExporter, fmIDE |

You need nothing new installed. All three apps still work offline, straight from their HTML files, and nothing is uploaded anywhere.

**What goes where**

| In Excel | In ExcelExporter | In fmIDE |
|---|---|---|
| Your workbook (`.xlsx`) | **File → Import Excel model…** → check the window → **Import** → read the report → **Save for fmIDE** | **File → Open…** the saved file: a canvas per sheet, a rectangle per row |
| | ⬇ **Generate .xlsx** also works straight away, giving a fresh workbook with ExcelExporter's layout | |

## Which workbooks it reads well

The import is built for models laid out the way most financial models are:

- **Rows are line items** (Revenue, Costs, Profit…) with their name in a column on the left.
- **Columns are periods** (years, or dates), with a header row holding them.
- **One formula is copied along each row**, for example `=D6*D7` in 2026, `=E6*E7` in 2027, and so on.

Modelling standards such as FAST teach this layout, and most bank, start-up and project models follow it. A workbook laid out differently (periods down the rows, several blocks of years on one sheet) may import only in part; feature 2 shows how to help it.

## The features, one by one

Each part below says what the feature is, why you would use it, and the exact clicks.

### 1. File → Import Excel model…

**What it is.** A new item in ExcelExporter's **File** menu. It reads an Excel workbook from your computer.

**Why you'd use it.** To see an existing spreadsheet model as an fmIDE model without rebuilding it by hand.

**How to use it**

1. Open ExcelExporter (in fmIDE: **File → Open ExcelExporter**, or open `apps/ExcelExporter.html` on its own).
2. Choose **File → Import Excel model…**.
3. Pick your workbook (`.xlsx` or `.xlsm`). You can also simply **drop the file** on the ExcelExporter page.
4. The confirm window opens (feature 2).

**Good to know**

- Old `.xls` files and password-protected workbooks can't be read. Open them in Excel and save them as `.xlsx` without a password first; the message says so.
- Macros in an `.xlsm` file are never read or run.

### 2. The confirm window: check what was found

**What it is.** Before anything is built, a window titled **Import Excel model** shows what the import found on each sheet.

**Why you'd use it.** Automatic detection gets well-built models right, but this is where you correct it when it guesses wrong.

**What each sheet shows**

- **A tick box** with the sheet's name: ticked sheets are imported. A sheet with no row of periods (a cover page, a lookup table) starts unticked.
- **A summary line**, for example "10 periods, 2020–2029 · 1 input, 27 calculations, 38 rows in parts, 3 opening balances, 17 titles".
- **Header row**: the row number holding the periods.
- **Periods from … to**: the first and last period columns (for example D to M).
- **Labels**: the column holding each row's name (usually A).
- **Units**: the column holding each row's unit (£, %, units…), or empty for none.
- **One canvas per section (6)**: shown when the sheet has headings with blank rows above them (Assumptions, Income Statement…). Ticked, each section becomes a canvas of its own, so a long sheet isn't one very tall canvas; rows still read each other across canvases. It starts ticked for a sheet of more than 40 rows; untick it to keep the sheet on one canvas.
- **Rows**: click it to open a table of every row, with its kind and formula. A note such as "differs in F12" marks a cell unlike the rest of its row.

**The kinds of row**

| Kind | What it means | In fmIDE |
|---|---|---|
| title | A heading, with no numbers | Left out |
| input | Typed numbers along the periods | An input rectangle with its number per year |
| assumption | One typed number before the periods (for example a tax rate in column C) | An input rectangle with that number in every year |
| calculation | The same formula copied along the row | A rectangle fed by operators |
| opening balance | A typed number in the first year, then a formula (for example the previous year's closing balance) | The typed number in year 1 (ticked under the rectangle's 🕒), the formula after |
| in parts | Typed actual years, then a forecast formula (feature 6) | The typed numbers in the actual years (ticked under 🕒), the formula in the forecast |
| one formula | A single formula before the periods (for example an NPV) | One rectangle |

**How to correct a guess**

1. Type a different number in **Header row**, or different column letters in **Periods from … to**, **Labels** or **Units**.
2. Click outside the box (or press Tab). The sheet is worked out again straight away, and its summary and rows change.
3. Untick a sheet to leave it out. A sheet with no periods can be imported by typing the header row it should use.
4. Press **Import** when it looks right, or **Cancel** (or Esc) to stop.

### 3. Import: the fmIDE model is built

**What it is.** Pressing **Import** builds the model and loads it in ExcelExporter, just as if you had opened an fmIDE file.

**What you get**

- **One canvas per sheet**, named after the sheet, or **one per section** when the sheet's "One canvas per section" box is ticked (feature 8).
- **One rectangle per row**, named after the row's label, with its unit.
- **Each formula as a small picture** to the left of its rectangle: operators (+, −, ×, ÷, if, max…) fed by **aliases** (shortcuts) of the rectangles it reads. A reference to the column on the left (the previous year) becomes a **period shift**.
- A number inside a formula (the 0.4 in `=D5*0.4`) becomes a small rectangle of its own, named after its row ("Variable costs: 0.4").

**What Excel functions become**

`SUM`, `MIN`, `MAX`, `AVERAGE`, `PRODUCT`, `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CHOOSE`, `ABS`, `LN`, `EXP`, `SQRT`, `INT`, `TRUNC`, `MOD`, `POWER`, the arithmetic signs and the comparisons (`=`, `<>`, `<`, `>`, `<=`, `>=`) all become fmIDE's operators of the same meaning.

**Simple example.** In Excel: Volume (row 6), Price (row 7), and Revenue `=D6*D7` copied to 2030. In fmIDE: three rectangles, and Revenue fed by a × whose two inputs are Volume and Price.

**After Import**

- A message under the top bar says what was built, for example "Imported 03-two-sheets.xlsx — 2 canvases, 13 rectangles, 5 periods."
- The report opens (feature 4).
- ⬇ **Generate .xlsx** works on the imported model straight away.

### 4. The report: how it compares with Excel

**What it is.** A window titled **Imported from Excel**. It opens after Import, and again from **File → Import Report…** while that model is loaded.

**Why you'd use it.** It is how you know you can trust the rebuilt model. The import calculates the model itself and compares **every calculated cell** with the value Excel saved for it.

**What it shows**

- **The summary**, in green when everything agrees: "All 45 calculated cells agree with Excel's saved values." Otherwise, in amber: "43 of 45 calculated cells agree with Excel's saved values; 2 differ."
- **Differ from Excel**: each cell that differs, for example "Plan!C3 · Doubled · 2027: fmIDE 24, Excel 25".
- **Kept as Excel's saved values**: rows it couldn't translate, and why. They keep Excel's numbers as typed inputs, so the model still adds up. For example "Valuation!D6:H6 · Growth: VLOOKUP".
- **Cells unlike the rest of their row**: for example a number typed over one year of a formula row. That year keeps Excel's value, as the rectangle's own number in that year (ticked under its 🕒).
- **Notes**: macros not read, chart sheets left out, sheets with different numbers of periods, and a sheet split into sections ("“Three Statement Model” is 6 canvases, one per section").

**What it can't translate yet** (kept as Excel's numbers, and listed)

- Lookups: `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`, `OFFSET`, `INDIRECT`.
- Sums across the years: `NPV`, `IRR`, `SUMIF`, `COUNTIF`, a running total such as `SUM($D$8:D8)`.
- Dates and text: `EOMONTH`, `TEXT`, joining text with `&`, and checks that give text such as "OK" / "ERROR".
- Circular references (a row that, in the same year, depends on itself through others).
- Any other function: the report names it.

**Good to know**

- A cell where Excel shows an error (such as `#DIV/0!`) agrees when the model fails there too.
- **"Nothing to compare"** means the workbook was saved without its formulas' values. Some programs do this, and so does ExcelExporter itself. Open the file in Excel, save it, and import it again.

### 5. Save for fmIDE, then open it in fmIDE

**What it is.** A button that saves the imported model as a file fmIDE opens.

**How to use it**

1. In the report, press **Save for fmIDE** (or later choose **File → Save for fmIDE**).
2. The file downloads, named after your workbook, for example `03-two-sheets.json`. A message says "Saved 03-two-sheets.json — open it in fmIDE with File → Open…."
3. In fmIDE, choose **File → Open…** (Ctrl+O, or ⌘O on a Mac) and pick that file.
4. Your model opens: a canvas per sheet (or per section), the rectangles in one column on the right in the sheet's order, each formula drawn to its left. Switch canvases with the tabs at the bottom, or Alt+PageDown and Alt+PageUp.
5. Save it as an fmIDE document with **File → Save** (a `.fmide` file).

**Good to know**

- The saved file is an ordinary fmIDE system file: no new file format, so every app opens it.
- From here it is a normal fmIDE model: change an input and everything that depends on it moves. Use **File → Open fmGraph** to explore it, or **File → Open ExcelExporter** to make a fresh workbook.

### 6. Rows with typed actuals and a forecast formula

**What it is.** Real models usually type the **actual years** and use **formulas for the forecast**, on the same row. For example Revenue: 2020–2024 typed from the accounts, 2025–2029 `=H26*(1+I8)` (last year × (1 + growth)). The import reads such a row **in parts**.

**Why it matters.** The forecast stays a formula. Change the growth rate in fmIDE and the forecast moves, exactly as in Excel.

**How it looks**

- In the confirm window, the row's kind is **in parts**, with its years: "2020–2024: typed; 2025–2029: H26*(1+I8)".
- In fmIDE, the row's own rectangle holds the typed numbers for the actual years (its 🕒 button shows those years ticked), and the forecast formula feeds it in the other years.
- A row with one formula for the actual years and another for the forecast reads: if the year is one of the actual years, the first formula; otherwise the second. The "is it an actual year?" test is one shared rectangle per canvas, such as **Up to 2024** (feature 8).
- It also handles a row whose first year is blank.

**Two more things it handles like Excel**

- **The column before the first year.** `=D92-C92` in the first year reads C92, the column before the years. Excel takes a blank there as 0; so does the import.
- **Rows that read each other in different years.** In many three-statement models Capex reads Investments in the actual years, and Investments reads Capex in the forecast. That is no circular reference, and the import doesn't treat it as one.

**Tested on a real model.** A three-statement model (income statement, balance sheet, cash flow, 2020–2029) imported with all 670 calculated cells agreeing with Excel. The only row kept as numbers was its "Balance Sheet Check", which gives the text OK or ERROR.

### 7. Safety: someone else's file

**What it is.** The import treats every workbook as possibly hostile, since it may come from anyone.

- **Nothing in the file runs.** Formulas are read as text by the import's own reader, never executed; macros are never opened.
- **Every name is shown as plain text**: sheet names, labels and formulas can't add anything to the page.
- **Limits** stop a damaged or hostile file from freezing your browser: 50 MB a file, 64 sheets, 200,000 cells with content, formulas up to Excel's own 8,192 characters. A file over a limit is refused with a message naming it.
- **No library and no internet.** The workbook is unpacked by your browser itself; nothing is uploaded.

### 8. Long sheets and tidy models

**What it is.** Four improvements made after trying a real three-statement model, all on one sheet (pull requests #168 to #171).

**A canvas per section**

- In the confirm window, a sheet with headings that have blank rows above them (Assumptions, Income Statement, Balance Sheet…) shows **One canvas per section (6)**. Hover over it to see the sections' names.
- Ticked, each section becomes a canvas of its own, named after its heading. The rows above the first such heading become a section too, named after their own first heading.
- It starts **ticked for a sheet of more than 40 rows**, and unticked for a shorter one. Change it before pressing Import.
- Rows still read each other across canvases (through aliases), so the model calculates exactly as before.
- With several sheets imported, a section's canvas is named "Sheet — Section".

**Typed years in the row's own rectangle**

- A row's typed actual years, an opening balance, and a cell unlike the rest of its row are kept **in the row's own rectangle**, as its own numbers in those years.
- To see which years: select the rectangle and press its **🕒** button ("Which periods use this rectangle's own number?"). The ticked years use the rectangle's numbers; the others take the formula.
- So the picture left of each rectangle is the formula alone: no "(typed)" rectangle, no year test, no small "Revenue: 5" box.

**One shared switch**

- A row with one formula for the actual years and another for the forecast still has to choose between them by year. All such rows on a canvas read **one shared rectangle**, such as **Up to 2024**. It holds 1 in the years up to 2024 and 0 after, and feeds each row's **if**.
- In ExcelExporter's workbook it is an ordinary input row, so you can see, and change, where the actual years end.

**Canvases that scroll to the end**

- In fmIDE a canvas now grows to hold every rectangle, so a long imported model scrolls all the way to its last row, at any zoom.

**On the real model.** One canvas of nearly 14,000 pixels became six, the tallest about 3,000. The rectangles went from 151 to 78 and the operators from 172 to 59. All 670 calculated cells still agree with Excel.

**What is still a small rectangle.** A number that is part of the formula itself, such as the 1 in `=H26*(1+I8)` or the 365 in `=D27/365*D16`, is still a rectangle of its own named after its row ("Revenue: 1").

## Putting it together: one model, start to finish

1. In ExcelExporter, choose **File → Import Excel model…** and pick `Plan.xlsx`.
2. The window shows two sheets, Inputs and Calc, both ticked, each with "5 periods, 2026–2030". Open **Rows** on Calc and check the kinds look right (Revenue a calculation, Tax rate an assumption…).
3. Press **Import**.
4. The report says "All 45 calculated cells agree with Excel's saved values." Nothing is listed as kept.
5. Press **Save for fmIDE**. `Plan.json` downloads.
6. Close the report. Press ⬇ **Generate .xlsx** if you also want ExcelExporter's own workbook of the model.
7. In fmIDE, **File → Open…** `Plan.json`. Two canvases, Inputs and Calc. Change Unit price on Inputs: Revenue, Tax and Net income on Calc move with it.
8. **File → Save** keeps it as `Plan.fmide`.

## Troubleshooting and questions

| Problem or question | Answer |
|---|---|
| "This is an old Excel file (.xls) or a password-protected workbook." | Open it in Excel, **Save As** an `.xlsx` workbook without a password, and import that. |
| A sheet says "No row of periods found". | Its periods aren't in one row of years or dates. Type the right **Header row**, and **Periods from … to**, or leave the sheet unticked. |
| The labels or units are wrong. | Type the right column letters in **Labels** or **Units** (empty Units for none). |
| The report says "Nothing to compare". | The workbook has no saved values. Open it in Excel, save it, and import it again. |
| A row is "kept as Excel's saved values". | It uses something not translated yet (the report says what). It still holds Excel's numbers, but won't move when its inputs change. |
| A cell "differs from Excel". | Usually a stale saved value (Excel not recalculated before saving) or a formula the import reads differently. Press F9 in Excel, save, and import again; if it still differs, look at that cell's formula. |
| The canvas has small rectangles like "Revenue: 1". | A number written inside a formula (the 1 in `1+growth`) is a rectangle of its own, named after its row. Typed years and the actuals/forecast switch no longer add any (feature 8). |
| I can't scroll down to the last rows. | Fixed: a canvas now grows to hold every rectangle (feature 8). For a very long sheet, also tick **One canvas per section** before importing. |
| Where are a row's typed years? | In the row's own rectangle: select it and press 🕒 to see the years ticked. |
| Import is greyed out. | No sheet is ticked: tick at least one sheet that has periods. |
| Where did Import Report… and Save for fmIDE go? | They show in the File menu only while the imported model is loaded. Loading another model hides them. |
| Will the saved file open in older versions? | Yes: it is an ordinary fmIDE system file (version 9). |

Limits in one place: 50 MB a file · 64 sheets · 200,000 cells with content · 8,192 characters a formula · 500 cells in a range inside a formula · up to 4 parts a row.

## Appendix: the pull requests

Newest first.

| Pull request | Date | What it did | Feature |
|---|---|---|---|
| [#171](https://github.com/taroyamakatrmttm-star/fmIDE/pull/171) | 18 Oct 2026 | One shared "Up to 2024" switch per canvas; this guide brought up to date | 6, 8 |
| [#170](https://github.com/taroyamakatrmttm-star/fmIDE/pull/170) | 18 Oct 2026 | One canvas per section of a long sheet | 2, 8 |
| [#169](https://github.com/taroyamakatrmttm-star/fmIDE/pull/169) | 18 Oct 2026 | Typed years, odd cells and opening balances in the row's own rectangle | 6, 8 |
| [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168) | 18 Oct 2026 | fmIDE: a canvas grows to hold every node, so large models scroll to the end | 8 |
| [#166](https://github.com/taroyamakatrmttm-star/fmIDE/pull/166) | 18 Oct 2026 | This guide | — |
| [#165](https://github.com/taroyamakatrmttm-star/fmIDE/pull/165) | 18 Oct 2026 | Rows with typed actuals and a forecast formula; the column before the first year; loops looked for year by year (after a real model) | 6 |
| [#164](https://github.com/taroyamakatrmttm-star/fmIDE/pull/164) | 18 Oct 2026 | Save for fmIDE, help, What's new, the end-to-end test (20g) | 5 |
| [#163](https://github.com/taroyamakatrmttm-star/fmIDE/pull/163) | 18 Oct 2026 | The check against Excel's saved values, and the report (20f) | 4 |
| [#162](https://github.com/taroyamakatrmttm-star/fmIDE/pull/162) | 18 Oct 2026 | Building the fmIDE model; Import (20e) | 3 |
| [#161](https://github.com/taroyamakatrmttm-star/fmIDE/pull/161) | 18 Oct 2026 | File → Import Excel model… and the confirm window (20d) | 1, 2 |
| [#160](https://github.com/taroyamakatrmttm-star/fmIDE/pull/160) | 18 Oct 2026 | Reading Excel's formulas (20c), the groundwork | 3 |
| [#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159) | 18 Oct 2026 | Reading an `.xlsx` file safely, with its limits (20b), the groundwork | 7 |
| [#158](https://github.com/taroyamakatrmttm-star/fmIDE/pull/158) | 18 Oct 2026 | The plan (brief) and the sample workbooks (20a) | — |
