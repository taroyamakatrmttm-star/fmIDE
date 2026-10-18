# Step 20 — Importing an Excel model

The owner's request (18 October 2026): **ExcelExporter reads an existing `.xlsx` financial model and rebuilds it as an fmIDE model**, so a person can see a spreadsheet they inherited as a picture of rectangles and operators, check it, and carry on in fmIDE. It is the other half of what ExcelExporter does today (fmIDE to Excel): Excel to fmIDE.

**Done** (18 October 2026): every phase, 20a to 20g, is built and merged ("How 20g turned out" and the phases below it). This is the brief, written in phase 20a. The owner's choices it rests on are decision 13 in `docs/decisions.md`.

## The owner's choices (18 October 2026)

1. **It lives in ExcelExporter**, as **File → Import Excel model…**. It is ExcelExporter's code (proprietary, `src/excel-exporter/import/`), so it can be part of a paid edition later. No code moves into fmIDE or `src/shared/`.
2. **Well-built models first**: rows are line items, columns are periods, and one formula runs along each row (as modelling standards such as FAST teach). Messier models import in part, with a clear list of what was left out.
3. **Charging is decided separately.** The apps have no paid edition or licence key yet, and the importer works either way.
4. The owner asked for phases **20a to 20g to go ahead without waiting**: each phase is its own pull request, merged once the whole suite is green. The owner is asked only when a choice is theirs or a check needs them.

## What it gives the person

1. **An fmIDE model**: one canvas per sheet, one rectangle per line item, and operators and period shifts for the formulas.
2. **A check report**: the imported model, calculated by the shared calculation (`src/shared/ir.js`, the one both apps already use), compared with the values Excel saved in the file, cell by cell. "1,204 of 1,220 cells agree" and the list of those that don't.
3. **A list of what couldn't be translated**: each cell or row, why, and what was done instead (Excel's saved values kept as typed numbers).

The model is a plain `system` file (version 9, `docs/file-formats.md`): **no file format changes**. ExcelExporter shows it straight away (so ⬇ Generate works on it), and **Save for fmIDE** writes it as a file fmIDE opens.

## How a spreadsheet is read

| In Excel | In fmIDE |
|---|---|
| A row with a label and values across the period columns | A rectangle named after the label (the unit column gives its unit) |
| The header row of years or dates | The model's periods (a date is shown as its year) |
| A row of typed numbers | An **input rectangle** with a number per period (`periodValues`; one `text` number when they are all the same) |
| One typed number in the column before the periods (an assumption) | An input rectangle with that number in every period |
| `=D6*D7` along the row | A **×** operator fed by the two rectangles, feeding this one |
| A reference to the column on the left (`=C10`) | A **period shift** (−1) |
| A first period typed, the formula after (an opening balance) | The usual corkscrew: the typed number in period 1 (`literalPeriods: [0]`), the formula in the others |
| `+ − * / ^`, comparisons, `SUM`, `MIN`, `MAX`, `AVERAGE`, `ABS`, `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CHOOSE`, `LN`, `EXP`, `SQRT`, `INT`, `TRUNC`, `MOD` | fmIDE's operators of the same meaning (`docs/file-formats.md`, "Operators") |
| A number inside a formula (`*0.4`) | A rectangle holding that number, named after the formula's row ("Variable costs: 0.4") |
| A reference to another sheet | An **alias** of that sheet's rectangle |
| A named cell (`TaxRate`) | Followed to its cell; the name is noted on the rectangle when it has no label |

**The row signature.** Every formula is rewritten relative to its own cell: `=D6*D7` in column D is "this column, row 6 × this column, row 7"; `=C10` in column D is "the column before, row 10". When every period cell of a row has the same signature, the row is one rectangle with one formula, however many periods there are. A first cell that differs is an opening balance; any other cell that differs is listed as odd and keeps its saved value in that period (`periodValues` over the formula is not possible, so the row keeps the majority's formula and the odd cell is reported).

**The order of an operator's inputs.** fmIDE reads an operator's inputs left to right, then top to bottom (`irByPosition` in `src/shared/ir.js`). The importer places the inputs of `−`, `÷`, `^`, `%`, the comparisons and the named-input operators so that order is Excel's: each input a little below the one before, in a column left of the operator.

## The confirm screen

Before anything is built, the window shows each sheet with what was found: the header row, the first and last period columns, the label and unit columns, and each row's kind (title, input, assumption, calculation, opening balance, not by period). The person can change the header row, the period columns and the label column, and leave a sheet out. Automatic detection gets well-built models right, and this screen covers the rest at little cost.

## What it doesn't do (the first version)

| Not translated | What happens |
|---|---|
| Lookups: `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`, `OFFSET`, `INDIRECT` | The row keeps Excel's saved values as typed numbers, and is listed |
| Sums across the periods: `NPV`, `IRR`, `XNPV`, `SUMIF`, `COUNTIF`, a range growing along the periods (`SUM($D$8:D8)`) | The same. fmIDE calculates one period at a time and has no operator reading across periods |
| Dates and text: `EOMONTH`, `DATE`, `TEXT`, `&` | The same |
| Any other function | The same, naming the function |
| A circular reference | The loop is cut where the importer meets it again, and listed |
| A formula that changes from column to column with no pattern | The majority's formula, the odd cells listed |
| Sheets with periods down the rows, or several blocks of periods on one sheet | Detection may fail; the confirm screen lets the person choose the header row and columns, or leave the sheet out |
| Macros (VBA), pivot tables, Data Tables, charts, form controls, links to other workbooks, comments, colours and fonts | Ignored; macros are never run. A link to another workbook keeps its saved values |
| `.xls` (the old binary format), `.xlsb`, password-protected or encrypted files | Refused with a message saying why. `.xlsx` and `.xlsm` (macros ignored) open; Google Sheets and Numbers save `.xlsx` |

## Safety (the file is someone else's)

- **Nothing from the file runs.** Formulas are read as text by the importer's own parser, never evaluated as code; macros are never read.
- **Every text is shown as text** (`textContent`, or `escapeXml()` in markup) — sheet names, labels, units, defined names and formulas.
- **Numbers are forced to be numbers**, and cell addresses and ranges are checked (columns up to XFD, rows up to 1,048,576).
- **Limits** keep a hostile file from freezing the browser: the file at most 50 MB, the unpacked parts at most 200 MB in all and 100 MB each (a "zip bomb" is refused while it unpacks), at most 64 sheets, 200,000 formula or number cells, 8,192 characters in a formula and 64 levels of nesting. Each limit refuses the file, or the sheet, with a message naming it.
- **No library and no network.** The `.xlsx` is a zip file: the importer reads the zip's directory itself and unpacks each part with the browser's own `DecompressionStream('deflate-raw')` (every current browser, and Node 18 or later for the tests). The XML is read by the importer's own small reader (no `DOMParser`, so the same code runs in Node; no entities beyond the five XML ones and character references, no DTDs).

## How it is built

The importer's pieces are **modules** in a new folder, `src/excel-exporter/import/` (a `package.json` with `"type": "module"`, as `formulas/` and `js-head/`), so they run in Node for fast tests; the build turns them into fragments of ExcelExporter's one wrapped function. Every name they export starts with `xl` (`xlReadWorkbook`, `xlParseFormula`…), so nothing clashes with the rest of the app. The window and the File menu item are a plain fragment, `src/excel-exporter/js/09k-excel-import.js`.

| File | Phase | What it does |
|---|---|---|
| `import/zip.js` | 20b | The zip's directory, each part unpacked (stored or deflated), the size limits |
| `import/xml.js` | 20b | A small XML reader: elements, attributes, text, the five entities |
| `import/workbook.js` | 20b | Sheets, cells (number, text, true/false, error, date by its number format), formulas (shared formulas kept as saved; copied to each cell in 20c), Excel's saved values, shared strings, defined names, 1904 dates |
| `import/formula.js` | 20c | Excel's formula language read into a tree (numbers, text, references, ranges, sheets, names, functions, operators with Excel's precedence), and a tree moved by rows and columns (for shared formulas) |
| `import/layout.js` | 20d | The header row and period columns, the label and unit columns, each row's kind and signature |
| `import/build.js` | 20e | The `system` file: canvases, rectangles, operators, period shifts, aliases, where each goes, and the list of what wasn't translated |
| `import/check.js` | 20f | The model calculated by the shared IR and compared with Excel's saved values |
| `js/09k-excel-import.js` | 20d, 20f, 20g | File → Import Excel model…, the confirm screen, the report, Save for fmIDE |

## The phases

Each is one pull request, merged when the whole suite is green (the owner's request, 18 October 2026).

| Phase | What | Tests |
|---|---|---|
| **20a** | This brief, decision 13, the sample workbooks (`tests/fixtures/excel-import/`, written by `tools/make-import-samples.js`) and what the importer should find in them (`expected.json`) | Group 78: the samples are the tool's, the description fits them, LibreOffice gives their saved values |
| **20b** | Reading the file (`zip.js`, `xml.js`, `workbook.js`), its limits | Group 79 (Node): every sample read, cell by cell against ExcelJS; deflated and stored parts; shared strings and formulas; dates; hostile files (a zip bomb, too many cells, a broken zip, a file that isn't one, markup in names) |
| **20c** | The formula parser (`formula.js`) | Group 79: every formula in the samples, precedence, references of every form, moving a tree, formulas that aren't one |
| **20d** | Understanding the layout (`layout.js`) and the confirm screen, File → Import Excel model… | Group 79 (Node): `expected.json`'s periods, columns and kinds found for every sample; group 80 (the app): the menu item, the window, changing the header row, leaving a sheet out, someone else's text shown as text |
| **20e** | Building the model (`build.js`) | Group 79: the samples' models (rectangles, operators, period shifts, aliases, the order of inputs); the list of what wasn't translated matches `expected.json` |
| **20f** | The check against Excel (`check.js`) and the report | Group 79: every translated cell of samples 01–03 agrees within a millionth; sample 04's rows not translated are listed, the rest agree; group 80: the report in the window |
| **20g** | Canvas layout, Save for fmIDE, ⬇ Generate on the imported model, Help, What's new, the end-to-end test | Group 80: import → Generate → LibreOffice gives the original workbook's values; the saved file opens in fmIDE with the same values; Help sentences |
| *later* | Lookups as `choose`, sums across periods (new operators), number formats onto the canvas, real workbooks from the owner's customers | |

## The sample workbooks (phase 20a)

`tools/make-import-samples.js` writes four small models with ExcelJS (test tooling only, never loaded by an app), each with the values Excel would have saved, in `tests/fixtures/excel-import/`:

- **01-simple-rows**: one sheet, Volume × Price = Revenue, Revenue × Cost rate = Costs, Revenue − Costs = Profit; titles and blank rows between; shared formulas (as Excel saves a formula filled along a row) and one row typed cell by cell.
- **02-corkscrew**: an opening balance typed in the first period, then the previous period's closing; a depreciation rate in its own cell, read with `$C$5` in every period.
- **03-two-sheets**: inputs on one sheet, the calculation on another; a named cell (`TaxRate`); `ROUND`, `SUM`, `MAX`, `IFERROR`, `IF`; a header row linked to the other sheet's; a year with no revenue (so `IFERROR` catches a division by 0) and a year with a loss.
- **04-not-supported**: dates as the period header; a `VLOOKUP` on another sheet, `NPV` and `COUNTIF` over the periods, a running total, and a typed number in the middle of a formula row.

`expected.json` says what the importer should find in each: the header row, period and label columns, each row's kind and its formula in words, and what can't be translated. Group 78 checks that the samples are the tool's, that the description fits them, and that LibreOffice, recalculating copies written without saved values, gives the saved values: so the "Excel's saved values" phases 20b–20f compare with are right.

**Real workbooks are still needed.** ExcelJS's files are close to Excel's (shared strings, shared formulas, styles), but Excel also writes a calculation chain, rich text, inline strings and other variations. The owner is asked to provide, when they can, one or two real models (or made-up ones saved by Excel) to add as samples.

## After a real model (18 October 2026)

The owner tried a real three-statement model (CFI's case study: an income statement, balance sheet and cash flow, 2020–2029, 787 cells). It imported, but showed what the samples lacked, and three things changed:

- **Rows in parts.** Real models type their actual years and use formulas for the forecast, on the same row (Revenue: 2020–2024 typed, 2025–2029 `=H26*(1+I8)`), or use one formula for the actual years and another for the forecast. Such a row was taken as an input, its forecast kept as saved numbers: the check agreed, but the forecast's logic was lost. A row of two to four runs side by side (typed numbers or blanks, or one formula copied along), each at least two periods long (a first typed period may be one), is now a row **in parts**: `if(period ≤ 5, the typed numbers, the forecast formula)`, its typed numbers in a rectangle of their own ("Revenue (typed)").
- **The column before the periods.** `=D92-C92` in the first period reads C92, a blank: Excel takes 0, the model took the whole cell as 0 (the one cell that differed). A reference reaching before the first period now reads that cell's value in those periods.
- **Loops period by period.** In the model, Capex reads Investments in the actual years and Investments reads Capex in the forecast: no loop in any one period, but one if all periods are counted together. Loops are now looked for period by period, each row in parts reading only its part.

**The result**: before, 329 of 330 calculated cells agreed and 35 rows were kept as numbers; now **670 of 670** agree, with 38 rows in parts translated and only "Balance Sheet Check" (which gives the text OK or ERROR) kept as saved values. The imported model's own workbook, written by ExcelExporter and recalculated by LibreOffice, gives the original's value in all 630 cells compared. Sample `05-actuals-forecast` has the same patterns; CFI's file itself is not in the repository (it is CFI's).

**Seen, for later**: the small numbers inside formulas (the 1 of `1 + growth`, the period numbers of the parts) are rectangles of their own, so the canvas and the workbook carry many small rows ("Revenue: 5"). Writing such numbers inside the formula, as a constant, would tidy both.

## How 20g turned out

Done (18 October 2026): the canvas spacing, Save for fmIDE, help, What's new, README and CHANGELOG, and the end-to-end test.

- **The canvas**: kept as 20e laid it out, which reads well — the rectangles in one column on the right, in the sheet's order, each row's formula as a small tree to its left. An alias feeding a period shift was moved further left so they no longer overlap; group 79 checks that no two nodes of any sample overlap.
- **Save for fmIDE** (in the report and the File menu) downloads the model as `<workbook name>.json`, a system file fmIDE's File → Open… reads. Sending it straight to an fmIDE window that opened ExcelExporter is a later idea.
- **Help**: ExcelExporter's topic "Importing an Excel model" (`import-excel`), linked from "Loading a model"; What's new "Import an Excel model".
- **End to end** (group 80, with LibreOffice): a sample imported, written out again by ExcelExporter and recalculated by LibreOffice gives the original workbook's saved values in every row and period; the saved file opened in fmIDE gives them too.
- **Later ideas** (not built): lookups as `choose`, sums across the periods (new operators), number formats onto the canvas, sending the model straight to fmIDE, and real workbooks from the owner's customers as samples.

## How 20f turned out

Done (18 October 2026): `import/check.js` — `xlCheckModel(system, report)` — and the report window that opens after Import (and again from File → Import Report… while that model is shown).

- **What is compared**: every cell of every formula row translated (calculations, opening balances, single formulas), calculated by the shared IR, against the value Excel saved for it, within a billionth of its size. Inputs and assumptions are Excel's own numbers, and rows kept as saved values are listed instead of compared.
- **The report** says "All 45 calculated cells agree with Excel's saved values." or "43 of 45 …; 2 differ.", then lists the cells that differ (sheet, cell, row, period, fmIDE's number and Excel's), the rows kept as saved values and why, the cells unlike the rest of their row, and the notes (macros, chart sheets, periods matched in order).
- **Excel's errors**: a cell where Excel shows an error agrees when the model fails there too.
- **No saved values** (a workbook saved by a program that keeps none, such as ExcelExporter itself): the report says there is nothing to compare and how to get the values (save it in Excel).

## How 20e turned out

## Tidier models: the actuals in the row's own rectangle (18 October 2026)

The owner asked for fewer small boxes. Most of the CFI model's constant rectangles (38 of 51, "Revenue: 5") were the switch of a row in parts, `if(period ≤ 5, …)`, each with a `period` operator, a `≤` and a "… (typed)" rectangle. The owner chose (of two options) to keep the actuals in the row's own rectangle instead, as fmIDE's 🕒 "Which periods use this rectangle's own number?" does for an opening balance:

- **The shared rule, a little wider** (`src/shared/ir.js`, `tickedPeriodNumber`, used by fmIDE's calculation and ExcelExporter's formulas alike): a ticked period of a wired rectangle uses its typed number, as before; **with no typed number, its number for that period** (`periodValues`). A file with a typed number calculates exactly as before; fmIDE never shows the per-period curve on a wired rectangle, so only such files change.
- **The import**: the periods of a formula row holding a number of their own — an opening balance's first, the cells that differ, a row in parts' typed actuals beside its **one** formula — are ticked (`literalPeriods`), their numbers in `periodValues` (or typed, when it is one number), and the tree is the formula alone. A row of two formulas keeps its `if(period ≤ k, …)`.
- **The CFI model**: rectangles 151 → 81, operators 172 → 67, still 670 of 670 cells agreeing; the remaining constants are a formula's own (`1 +`, `365`) and the four rows of two formulas.

## The round trip (18 October 2026)

The import's check compares fmIDE's calculation with the original. The owner asked for the step after it: does **the workbook ExcelExporter writes** give the original's numbers? After ⬇ Generate, for an imported model:

- **Recalculated here** (`import/recalc.js`, `xlRecalc(wb)`): the workbook as the writer takes it, each cell worked out from its formula's text, read by the import's own parser — never run as code — with the functions ExcelExporter writes (the arithmetic and comparisons, `SUM` `MIN` `MAX` `AVERAGE` `PRODUCT` `AND` `OR` `NOT` `IF` `IFERROR`, the roundings — half away from zero, as Excel — `ABS` `LN` `EXP` `SQRT` `INT` `TRUNC` `MOD` `POWER` `CHOOSE` `INDEX` `N` `NA`); a range's text and TRUE/FALSE left out of a sum, as Excel; an empty cell 0; errors carried as Excel's (`#N/A`, `#DIV/0!`). Any other function is `#NAME?`, a loop `#CYCLE`, a chain past 5,000 formulas deep `#DEPTH`: not checked.
- **Compared** (`xlRoundTrip`, 09k `importRoundTripAfter`): every cell of every formula row the import translated, where the workbook writes it (`buildCtx().cellPos`, `periodCol`), against the value the original saved, within a billionth (`xlAgree`); an Excel error agrees with an error. A row left out of the layout is counted, not compared.
- **Said** after Generate ("Recalculated here, the workbook gives the original's value in all 670 cells."; amber with the first three that differ) and in the report (`#importRoundTrip`).
- **The CFI model**: all 670 cells, in about a quarter of a second.

## The workbook's own look (18 October 2026)

The owner asked for the original's look as well (idea 1 after the layout). Since the look of every cell in Excel is ExcelExporter's (`.claude/rules/format-roles.md`), it goes into the imported layout's **row formats**, never into the fmIDE model:

- **Reading it** (`workbook.js`): each cell's `look` from the workbook's styles — `{ bold, italic, color, fill, border: { top, bottom, left, right } }` — its colours `#rrggbb` from `rgb`, the theme (`xlThemeColours`: the scheme's colours by Excel's theme number, light 1 first) with its `tint` (Excel's change of lightness), or the first sixteen indexed colours; the automatic colour is none (`xlColour`).
- **A row's look** (`build.js`, `xlRowLook`): the look most of its period cells share — a row with formulas, its formula cells' (typed actuals are often blue) — bold when its label is bold, the top and bottom borders (lines along the row), the number format as the nearest of ExcelExporter's kinds (`xlNumberKind`: General, percent, `$`, number, with its decimals; `_x` spaces and `*x` fills set aside; the rest of a code, such as brackets for negatives, not kept); a title's from its label. In the layout as `look` on each `{ node }` and `{ title }`.
- **Using it** (`useImportedLayout`): each row's and title's look, through `cleanRowFormat`, as its own format — so in the workbook it replaces the Excel style's look for that row, as a row format always does.
- **The CFI model**: headings bold in `#3271d2` on `#e7f2ff`, the typed rows blue, totals bold with their line above, the percentages `0.0%`, the rest `#,##0`.

## The workbook's own layout (18 October 2026)

After Import, ExcelExporter gave the model a fresh layout, sorted by calculation order: the rows moved, the titles and blank rows were gone, and each number written in a formula ("Revenue: 1") had a row of its own. The owner asked for the original's order and spacing, on several canvases too:

- **The layout** (`xlBuildModel` returns `layout`: per canvas, its `items` in the sheet's order — `{ node }`, `{ title }`, `{ blank: true }`, the extras first; the blank rows counted after the sheet's header row of periods, which ExcelExporter writes itself, at most `XL_BLANKS_MAX` 20 together — and `constants`, the formulas' numbers). `useImportedLayout` (09k) turns sections off and gives each tab that order, a label row for each title (its text) and an empty one for each blank row, and marks the constants **Constant**, so the workbook writes `=ROUND(E6*0.4,0)` as the original did. It replaces any layout the model had and is saved in the browser like any change (found again for the same model; not carried by Save for fmIDE).
- **The canvas** leaves `XL_SPACE` (45 pixels) for each blank row and title between two rectangles.
- **The CFI model**: each tab reads as its section of the original, heading, blank rows and all; the "… : 1" and "… : 365" rows are gone into the formulas.

## One shared switch (18 October 2026)

The four CFI rows with one formula for the actual years and another for the forecast still had their own `period`, `≤` and "5". Now every such row on a canvas reads one shared rectangle per switch period, **"Up to 2024"** (`upTo` in `build.js`: 1 up to that period, 0 after, made like the header row's rectangle, at the canvas's top): `if(@Up to 2024, the first formula, the second)`. A row of two formulas with typed years keeps those years as its own numbers too, so only its formulas switch. The CFI model: 78 rectangles and 59 operators (from 81 and 67), one "Up to 2024" on Supporting Schedules, 670 of 670 cells agreeing. A reference to the column before the periods kept its own `if(period = 1, …)` until the next change: it now reads the same shared switch for the first period, `if(@Up to 2020, Excel's C92, shift(-1 …))` — not the row's own number in that period, which would freeze it (`D92 − C92` moves with D92). The CFI model: 57 operators.

## A canvas per section (18 October 2026)

The CFI model's one sheet made a canvas over 13,000 pixels tall. The owner chose a tick box per sheet on the confirm screen, **One canvas per section** (`.import-split`), ticked when the sheet has more than 40 rows (`XL_SECTION_MIN_ROWS`, counting rows that become rectangles, `xlRectangleRows`):

- **The sections** (`layout.js`, `plan.sections`): the titles with at least two blank rows above them; with fewer than two such, those with one; none when that still finds fewer than two. Rows before the first are a section of their own, named after their first title (or the sheet).
- **The canvases** (`xlBuildModel(book, plans, include, split)`): one per section, named after it ("Sheet — Section" when several sheets are imported; a name used twice gets "(2)"). Rows read each other across them through aliases, as across sheets; the report notes "“Sheet” is 6 canvases, one per section".
- **The CFI model**: Assumptions, Income Statement, Balance Sheet, Cash Flow Statement, Supporting Schedules, Charts and Graphs, the tallest about 3,000 pixels; still 670 of 670 cells agreeing.

Done (18 October 2026): `import/build.js` — `xlBuildModel(book, plans, include)` gives the `system` and a report — and the window's Import button, which loads the model as any model file is ("Imported … — 2 canvases, 13 rectangles, 5 periods.", naming the rows kept as Excel's saved values).

- **Every reference is an alias**, placed in its operator's input column, even to a rectangle on the same canvas: fmIDE reads an operator's inputs by position, so this is how `−`, `÷`, comparisons and `iferror` keep Excel's order wherever the rows sit. Each row reads as a small sentence left of its rectangle; the rectangles stand in one column in the sheet's order. (20g may tidy this.)
- **A cell that differs** keeps Excel's saved value through `if(period = n, saved value, the row's formula)`, since a wired rectangle has only one typed number; an opening balance keeps its typed number in period 1 (`literalPeriods`). (Changed by the tidy-up below: the saved value is now the rectangle's own number in that period.)
- **Outside the rows**: the header row, when a formula reads it, is a rectangle of its own ("Year (header)"); a number on a sheet not imported, a constant ("Lookup!B3"); an empty cell, 0, as in Excel. A formula on a sheet not imported is used by its saved value.
- **Circular references** within one period are cut at the loop's later row, which keeps its saved values; loops through a period shift (a corkscrew) are not loops.
- **Ranges** inside `SUM`, `MIN`, `MAX`, `AVERAGE`, `AND`, `OR`, `PRODUCT` are read down a column (empty cells and text left out, as Excel does); a range along the periods, growing along them, or a whole column is not translated.
- **Checked:** every cell of every row of the four samples, calculated by the shared IR, gives Excel's saved value. The check in the app (20f) does the same for any workbook.

## How 20d turned out

Done (18 October 2026): `import/layout.js` and the confirm screen, File → Import Excel model… (an `.xlsx` dropped on the page opens it too), with group 79's layout tests and the new browser group 80.

- **The header row** is the first of the first 50 rows holding the longest run of periods side by side: years (1900–2200), dates (shown as their year, or as `2026-03` when two fall in one year) or text with a year or a period word (`FY2026`, `Q1`, `Jan-26`), one kind along the run, numbers rising. A header row of formulas (`=Inputs!D3`) is read by its saved values.
- **The label column** is the column left of the periods with the most text; **the unit column** the one with the most short text of the others.
- **Rows**: a row whose period cells are mostly typed numbers is an input (a formula among them keeps its saved value); otherwise the most common signature is the row's formula, and every cell that differs is listed as odd. A label alone is a title; a number or formula before the periods with nothing in them is an assumption or a single formula.
- **Choices**: the header row, the first and last period columns, and the label and unit columns can be typed per sheet; the sheet is worked out again. A sheet with no periods is off until given a header row that has some.
- The window's Import button stays off until the model can be built (20e), saying so in its tooltip.

## How 20c turned out

Done (18 October 2026): `import/formula.js` — `xlParseFormula(text)` (the tree described at the top of the file), `xlShiftFormula(tree, rows, columns)`, `xlFormulaText(tree)` and `xlFillSharedFormulas(book)` (each cell of a shared formula gets its own text, as ExcelJS and Excel copy it) — with group 79's parser tests.

- What the first version doesn't translate is still read, so the report can name it: an array constant, another workbook, a table's column and a reference across several sheets are `unsupported` nodes, with their text.
- A reference across several sheets written without quotes (`Jan:Mar!A1`) can't be told from a range and is refused as unreadable; Excel quotes such names when they have spaces, but not always otherwise. Such a cell will be listed as not translated.

## How 20b turned out

Done (18 October 2026): `import/zip.js`, `import/xml.js` and `import/workbook.js`, included in ExcelExporter by `js/09k-excel-import.js` (nothing on the page yet), and test group 79 in Node.

- `xlReadWorkbook(bytes)` gives `{ sheets: [{ name, hidden, cells, rows, cols }], names, date1904, notes }`; a cell holds its saved `value` or `error`, its `formula` text, `shared`, `array`, `dataTable`, `date` and its number `format` (built-in formats named by id are given their codes).
- **Shared formulas** are kept as Excel saves them (the first cell's text, the others its index); copying the text to each cell needs the formula parser, so it moves to 20c.
- **Found:** ExcelExporter's own writer saves formulas without their values (Excel works them out on opening), so its workbooks have nothing for the check to compare with. The check (20f) will say so instead of reporting differences.
- The limits are `XL_LIMITS` in `zip.js`; an import refused says why in words (`XlImportError`, with a `code` for the tests).

## How 20a turned out

Done (18 October 2026): the brief, decision 13, the four samples and their description, test group 78 (Node and LibreOffice).
