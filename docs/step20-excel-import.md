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

Done (18 October 2026): `import/build.js` — `xlBuildModel(book, plans, include)` gives the `system` and a report — and the window's Import button, which loads the model as any model file is ("Imported … — 2 canvases, 13 rectangles, 5 periods.", naming the rows kept as Excel's saved values).

- **Every reference is an alias**, placed in its operator's input column, even to a rectangle on the same canvas: fmIDE reads an operator's inputs by position, so this is how `−`, `÷`, comparisons and `iferror` keep Excel's order wherever the rows sit. Each row reads as a small sentence left of its rectangle; the rectangles stand in one column in the sheet's order. (20g may tidy this.)
- **A cell that differs** keeps Excel's saved value through `if(period = n, saved value, the row's formula)`, since a wired rectangle has only one typed number; an opening balance keeps its typed number in period 1 (`literalPeriods`).
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
