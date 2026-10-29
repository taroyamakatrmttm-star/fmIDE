# The fmIDE manual

A step-by-step guide to the three apps: **fmIDE**, where you build a financial model as a picture of boxes and arrows; **ExcelExporter**, which turns that model into an Excel workbook with live formulas (and rebuilds an Excel model the other way); and **fmGraph**, where bars and sliders show how a value moves the model.

The manual is written in lessons. Each lesson teaches one thing, in numbered steps you can follow with the app open, and ends with the numbers you should see. Each part says when its numbers were last checked against the apps. Each lesson also names the matching topic in the apps' own **Help** and, where one exists, the guided tutorial inside the app, so the manual, the Help panel and the videos all say the same thing.

> **Status.** All 68 lessons are written (October 2026), each checked against the apps. When the apps change, the lesson that teaches the change is updated in the same pull request. The manual is also on the website, at `/manual/` (its pages are built from these files with every site build; the build stops if a lesson names a Help topic that doesn't exist or a link leads nowhere).

## Contents

### [Part 1 — Getting started](01-getting-started.md)
[1.1 The three apps, and how a model travels between them](01-getting-started.md#three-apps) ·
[1.2 Opening the apps: from a file, from the website, or installed](01-getting-started.md#opening-the-apps) ·
[1.3 Finding your way: the ribbon, the Command Launcher, Help, tutorials and What's new](01-getting-started.md#finding-your-way) ·
[1.4 Documents: New, Open, Save and autosave](01-getting-started.md#documents) ·
[1.5 Your own settings: the ribbon, shortcuts and the Preferences file](01-getting-started.md#your-settings)

### [Part 2 — Building a model in fmIDE](02-building-models.md)
[2.1 Your first model: rectangles, operators and arrows](02-building-models.md#first-model) ·
[2.2 Periods: values over time](02-building-models.md#periods) ·
[2.3 Period shifts and corkscrews](02-building-models.md#period-shifts) ·
[2.4 Operators: arithmetic, comparisons and Excel functions](02-building-models.md#operators) ·
[2.5 Timing, conditions and rounding: period, if, choose, round…](02-building-models.md#timing-conditions) ·
[2.6 Canvases and aliases](02-building-models.md#canvases) ·
[2.7 Blocks and vertical blocks](02-building-models.md#blocks) ·
[2.8 Plugs and sockets](02-building-models.md#plugs-sockets) ·
[2.9 Building faster: many rectangles at once, snapping and arranging](02-building-models.md#building-faster) ·
[2.10 Zoom](02-building-models.md#zoom) ·
[2.11 The canvas look: formats and number formats](02-building-models.md#canvas-look) ·
[2.12 Units, and why fmIDE and Excel give the same numbers](02-building-models.md#same-numbers) ·
[2.13 fmIDE on a tablet](02-building-models.md#tablet) ·
[2.14 fmIDE on a phone](02-building-models.md#phone)

### [Part 3 — Reusing your work: templates, recipes, functions and the library](03-reuse.md)
[3.1 Templates: save a canvas and use it again](03-reuse.md#templates) ·
[3.2 Template versions, and updating a canvas](03-reuse.md#template-versions) ·
[3.3 System templates, and keeping your templates tidy](03-reuse.md#system-templates) ·
[3.4 Recipes: templates made of templates](03-reuse.md#recipes) ·
[3.5 Your first function](03-reuse.md#first-function) ·
[3.6 A function on the canvas](03-reuse.md#function-on-canvas) ·
[3.7 Function versions and updating](03-reuse.md#function-versions) ·
[3.8 Functions that call functions](03-reuse.md#functions-calling-functions) ·
[3.9 Sharing functions](03-reuse.md#sharing-functions) ·
[3.10 Library packs: templates, recipes and functions in one file](03-reuse.md#library-packs) ·
[3.11 Browsing the community library](03-reuse.md#browse-library) ·
[3.12 Sharing your pack with everyone](03-reuse.md#share-library)

### [Part 4 — Macros and scripting](04-macros-scripting.md)
[4.1 Recording and running a macro](04-macros-scripting.md#recording-macros) ·
[4.2 The Macro Builder: steps, variables and stepping through](04-macros-scripting.md#macro-builder) ·
[4.3 Macros that keep working when the model changes](04-macros-scripting.md#reliable-macros) ·
[4.4 Scripting fmIDE with `window.fm`](04-macros-scripting.md#scripting-fm) ·
[4.5 Scripting fmGraph with `window.fmGraph`](04-macros-scripting.md#scripting-fmgraph)

### [Part 5 — ExcelExporter: from model to workbook](05-excelexporter.md)
[5.1 Your first workbook](05-excelexporter.md#first-workbook) ·
[5.2 Finding your way in ExcelExporter](05-excelexporter.md#exporter-tour) ·
[5.3 Tabs, rows and the Tree View](05-excelexporter.md#tabs-rows) ·
[5.4 Where the workbook differs from fmIDE](05-excelexporter.md#differences) ·
[5.5 Functions and the newer operators in Excel](05-excelexporter.md#functions-in-excel) ·
[5.6 The Inputs tab, scenarios and Global Cases](05-excelexporter.md#inputs-scenarios) ·
[5.7 Blocks in the workbook](05-excelexporter.md#blocks-in-excel) ·
[5.8 The Excel look: your Excel style and a row's own format](05-excelexporter.md#excel-look) ·
[5.9 Layouts that are remembered, and layouts on templates](05-excelexporter.md#layouts) ·
[5.10 Sensitivity: the Tornado and the Spider in Excel](05-excelexporter.md#sensitivity) ·
[5.11 fmGraph boards in Excel](05-excelexporter.md#fmgraph-in-excel) ·
[5.12 ExcelExporter on a phone](05-excelexporter.md#exporter-phone)

### [Part 6 — fmGraph: see how a value moves your model](06-fmgraph.md)
[6.1 Bars and sliders](06-fmgraph.md#bars-sliders) ·
[6.2 Charts: columns, lines and waterfalls](06-fmgraph.md#graph-charts) ·
[6.3 Boards: tabs, arranging, colours, scales and files](06-fmgraph.md#graph-boards) ·
[6.4 Trace, Biggest movers, and comparing A with B](06-fmgraph.md#graph-explore) ·
[6.5 Named scenarios and the scenario waterfall](06-fmgraph.md#graph-scenarios) ·
[6.6 Tornado and Spider: which inputs matter most](06-fmgraph.md#tornado-spider) ·
[6.7 Goal seek](06-fmgraph.md#goal-seek) ·
[6.8 Boards on templates and in the library](06-fmgraph.md#boards-templates) ·
[6.9 fmGraph on a phone](06-fmgraph.md#fmgraph-phone)

### [Part 7 — Importing an Excel model](07-excel-import.md)
[7.1 Which workbooks import well](07-excel-import.md#which-workbooks) ·
[7.2 Import a workbook and check what was found](07-excel-import.md#import-confirm) ·
[7.3 What the import builds](07-excel-import.md#what-is-built) ·
[7.4 The report: how the model compares with Excel](07-excel-import.md#import-report) ·
[7.5 Save for fmIDE, and carry on in fmIDE](07-excel-import.md#save-for-fmide) ·
[7.6 Rows with typed actuals and a forecast](07-excel-import.md#actuals-forecast) ·
[7.7 Long sheets: a canvas per section](07-excel-import.md#sections) ·
[7.8 The workbook's own layout and look](07-excel-import.md#layout-and-look) ·
[7.9 The round trip: checking the new workbook](07-excel-import.md#round-trip) ·
[7.10 Safety, limits and troubleshooting](07-excel-import.md#import-troubleshooting)

### [Part 8 — Sharing a model: showcase viewers](08-showcase.md)
[8.1 Make a showcase viewer](08-showcase.md#showcase-viewer) ·
[8.2 Put Excel in a showcase viewer](08-showcase.md#showcase-excel) ·
[8.3 Make many viewers at once](08-showcase.md#showcase-many)

### Appendices
- [A — What came when: every build step and pull request, and the lesson that covers it](appendix-a-coverage.md)
- [How the lessons are written](STYLE.md) (for anyone writing or recording a lesson)

## Which lessons do I need?

| You want to… | Read |
|---|---|
| Try fmIDE for the first time | Part 1, then 2.1–2.5 |
| Turn a model into an Excel workbook | 2.1, then Part 5 from 5.1 |
| Bring an existing Excel model into fmIDE | Part 7 (7.1–7.5 is enough to start) |
| Show someone how inputs move the results | 6.1–6.6, then 5.11 to give them the same in Excel |
| Send someone a model they can play with but not change | 6.1, then 8.1 (and 8.2 for Excel) |
| Reuse calculations across models | Part 3 |
| Automate repetitive work | Part 4 |

## Words used in this manual

| Word | What it means |
|---|---|
| **Model** | Your financial model: everything on every canvas. |
| **Rectangle** | A box holding a value, such as Revenue. Its value can be typed, or worked out from arrows into it. In Excel each rectangle becomes a row. |
| **Operator** | A small box that works something out from what is wired into it: `+`, `×`, `if`, `round`… |
| **Arrow** | A line from one box to another: the value flows along it. |
| **Input** | A rectangle nothing calculates: no arrow into it, or a single arrow from an operator or period shift that nothing feeds. It is the number you are allowed to change. The same rule is used in all three apps. |
| **Period** | One column of time, such as 2027. Every rectangle has a value in each period. |
| **Period shift** | A box that reads another period's value, such as last year's closing balance. |
| **Corkscrew** | Opening balance + movements = closing balance, with next period's opening equal to this period's closing. |
| **Canvas** | One page of the model, like a sheet of a workbook. Each becomes a tab in Excel. |
| **Alias** | A shortcut to a rectangle, so it can be used somewhere else (on another canvas, say) without a long arrow. |
| **Block** | A canvas used as one box on another canvas, with inputs on the left and outputs on the right. |
| **Template** | A canvas (or a whole model) saved so you can insert it again. |
| **Function** | A formula you write once, such as `Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`, and use like an operator. |
| **Document** | A `.fmide` file: the model, plus its fmGraph boards and its Excel layout. |
| **Layout** | ExcelExporter's plan of the workbook: which tabs, which rows in which order, and how they look. |
| **Board** | One page in fmGraph, holding bars, charts and sliders. |
| **Slider** | A handle in fmGraph that changes an input, so you can watch the results move. fmGraph never changes your model. |
| **Scenario** | A named set of slider positions (fmGraph), or a named set of input values (ExcelExporter). |
| **Global Case** | ExcelExporter's name for one whole-model scenario: one number in the workbook switches between cases. |
| **Ribbon** | The row of tabs and buttons at the top of fmIDE (File, Home, Insert…). |
| **Command Launcher** | **Ctrl+K** (**⌘K** on a Mac): type part of a command's name and press Enter. |

## Conventions

- **Bold** is something you click or press, as it is written in the app: **File → Open…** means the File tab (or menu), then Open….
- *Italic* is text the app shows you.
- `Code` is something you type, or a file name.
- Keys are written for Windows; on a Mac, Ctrl is ⌘ (Command) and Alt is ⌥ (Option) unless the lesson says otherwise.
- **Help → Topic** means the **Help** panel inside the app (F1, or ❓): search for the topic's name. The fmIDE and ExcelExporter topics are also on the website, under [/help](https://fmide.pages.dev/help/).

## How the manual is being written

The owner chose (19 October 2026) to write the manual by what a person does, not in the order features were built, in phases:

| Phase | What | Status |
|---|---|---|
| 1 | These contents, the lesson style, the coverage appendix, and the three earlier tutorials rewritten as lessons (2.5, 2.12, 3.5–3.9, 4.4, 5.4, 5.5, 5.10, 5.11, 6.6 and Part 7) | ✅ |
| 2 | Parts 1 and 2 | ✅ |
| 3 | Parts 3 and 4 | ✅ |
| 4 | Parts 5 and 6 | ✅ |
| 5 | The improvements after step 20 (#165–#193, in their lessons), the coverage appendix completed, a final read-through | ✅ |
| 6 | The manual checked by the build and test group 81 (a lesson's Help topics and tutorials exist with those titles, every link and anchor leads somewhere), and the manual as pages on the website, `/manual/` | ✅ |

The three earlier guides, `docs/tutorial-step7.md`, `docs/tutorial-step18-19.md` and `docs/tutorial-step20.md`, now point here.

---

*This manual is licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt) (you may reuse and adapt it, in guides, courses, videos and translations, with credit), except Parts 5 and 7, which describe ExcelExporter and are under the [Apache License 2.0](../../LICENSE) like the rest of `docs/`. See [LICENSING.md](../../LICENSING.md).*
