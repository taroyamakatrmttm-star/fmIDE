# Product ideas for the roadmap

Ideas agreed to be worth keeping, so they are not forgotten. **None is scheduled**: the owner chooses what goes into the build order (`docs/architecture/build-order.md`), and each then gets its own brief, session, branch and pull request, changing nothing until the owner approves its plan. When an idea is built or dropped, move it to the last section with the pull request or the reason.

Every idea here has been checked against the project's rules: the apps work offline and send nothing anywhere, text from files is always treated as untrusted, file formats stay readable both ways, and fmIDE (open, Apache) stays separate from ExcelExporter (the owner's, proprietary).

Started 18 October 2026 from the brainstorm at the start of step 20 and the ideas raised while building and refining it.

## Status (19 October 2026)

- **Build order:** steps 1–20 are done (H4c, the video links, waits on the owner's recordings). The owner chooses the next step.
- **Since step 20** (18–19 October 2026, outside the build order, each its own pull request merged once green): the Excel import refined (#165–#177, #186, #190), the Inputs tab's sensitivity and sliders easier to read (#179, #180), fmGraph's slider range, rectangle search, shared period, goal seek and lines charts (#181, #182, #184, #187, #188), the library's readable pack file name (#189), and this file (#183, #185). The full list is section 3.
- **Waiting on the owner:** H4c's recordings; the owner's name out of the public places before the project is shared or advertised.
- **Ready to start, a medium step each, with a choice for the owner:** headings visible in fmIDE (a file-format change), numbers inside formulas on fmIDE's canvas (the shared calculation), lookups in the Excel import, the scenario waterfall in Excel.
- **The larger product ideas** (section 1), each worth a brief first; the brainstorm recommended G1, the playable single file, next.

## 1. Product value: what people would choose fmIDE for, or pay for

From the brainstorm of ten ideas (October 2026), grouped as it was. #2 is built (step 20).

### Growth: getting people to the product

| # | Idea | What it gives | Builds on | Size |
|---|---|---|---|---|
| G1 | **Share a model as a playable single file** | One click in fmIDE writes a self-contained, read-only HTML file with fmGraph's boards and sliders. A founder emails it to investors, who move the sliders without installing anything. A small "Made with fmIDE" mark makes every shared model an advert. | The single-file apps; fmGraph | Medium |
| G1+ | **The showcase viewer** (G1 grown by the owner, 27 October 2026) | A read-only fmIDE, fmGraph and Excel in one HTML file per model, made in one click or 100 at a time, plus a gallery on the site. The brief: `docs/viewer-brief.md` (waiting for the owner's approval; after fmGraph's Free chart F1). | G1; fmGraph; ExcelExporter's Dashboard (step 19) | Large |
| G3 | **"Fundraising model in 30 minutes" wizard** | A guided start for startups, property developers and small businesses: about 10 questions give a working model, an Excel workbook and an fmGraph dashboard. For people who can't afford a modelling consultant. | Templates and recipes (step 6); ExcelExporter; fmGraph boards on templates | Medium–large |

### Value: things people would pay for

| # | Idea | What it gives | Builds on | Size |
|---|---|---|---|---|
| V4 | **A model checker, like a spellchecker for models** | Flags numbers typed into formulas, loops, a balance sheet that doesn't balance, sign errors, unit mismatches and inputs nothing uses. The check is free in fmIDE; a signed, printable audit report could be paid, for lenders, auditors and investment committees. | The shared calculation (step 7); fmGraph's checks of totals; the import's report (step 20) | Medium |
| V5 | **Risk ranges (Monte Carlo simulation)** | An input gets a range or a distribution instead of one number; the model runs thousands of times and fmGraph shows how likely each outcome is ("a 20% chance of running out of cash"). A premium feature in fmIDE and in the Excel output. | Tornado and Spider (step 18); sensitivity in Excel (steps 16, 19) | Large |
| V6 | **Compare two versions of a model** | What changed between two versions, on the canvas (added, removed, different), and why the result moved, with review comments kept in the file. A team licence; no server — people swap files as today. | Template versions and "Update this canvas" (step 6); fmGraph's A/B compare | Medium–large |
| V7 | **Plan against actuals** | Load a CSV of real results and see plan against actual on the canvas and in Excel, so a model built once for a fundraise is used every month. | Ticked periods with typed numbers (step 20's actuals); ExcelExporter | Medium |
| V8 | **Plain-language model documentation** | A readable write-up worked out from the graph — what each input is, how revenue is built, the key assumptions — offline, with no AI. Saves analysts hours; lenders often ask for it. | The graph and units (step 7); help pages (step 10) | Medium |

### Revenue: education and ecosystem

| # | Idea | What it gives | Builds on | Size |
|---|---|---|---|---|
| R9 | **fmIDE Academy and certification** | The interactive tutorials become a paid course with an exam and a "Certified fmIDE Modeller" badge; seat licences for universities and bank training. Finish the video links (H4c) first. | Tutorials and help (step 10) | Medium (mostly content) |
| R10 | **A paid template marketplace** | Professionals sell checked, industry-specific packs (SaaS, real estate, project finance, LBO) and the project takes a share. Payment on the website, never in the apps, so they stay offline. | The community library and its pack checker (step 8) | Medium (mostly the website) |

### Decisions that are the owner's before any of these

- **An AI assistant** ("build me a SaaS model") would break the rule that nothing is sent anywhere. It could only be an opt-in with the person's own key, and that is a decision about the rules, not a feature. V8 gives much of the value without it.
- **Before any advertising** (G1's mark, R9, R10), the owner's name comes out of the public places (`docs/decisions.md`, "Before sharing the project").
- **The brainstorm's recommended order**: G1 (cheap, and it spreads the product), then the Excel import (done), then R9 and R10 (recurring income that grows with the users).

## 2. Improvements to what is built

### Importing an Excel model (step 20)

| Idea | Today | The idea | Size |
|---|---|---|---|
| **Headings visible in fmIDE** | Headings such as "Income Statement" show only as gaps on fmIDE's canvas; they reach Excel through the layout. | A "label" item on the canvas — text that calculates nothing — placed where the heading was; usable by hand to annotate any model, and written by ExcelExporter as a heading row. | Medium (a file-format change) |
| **Translating more formulas** | A row the import can't translate keeps Excel's saved numbers and doesn't move with its inputs. Running totals (`SUM($D$8:D8)`) are translated since 19 October 2026 (section 3). | Lookups (`INDEX`/`MATCH`, `VLOOKUP`, `XLOOKUP`; perhaps as `choose`), `SUMIF`/`COUNTIF`, `NPV`/`IRR`, dates. Another real model would help choose. | Medium to large (lookups) |
| **Re-importing an updated workbook** | Importing again makes a new model; changes made in fmIDE are lost. | Import onto the open model: matching rows keep their rectangles, new rows are added, removed rows flagged, with a report of what changed. The owner decides whose change wins. Could reuse "Update this canvas". | Large |
| **Formula numbers on fmIDE's canvas** | Numbers inside formulas ("365") are back in the formulas in Excel, but each is a small rectangle in fmIDE. | An operator may take a typed number as one of its inputs. Changes the shared calculation: careful. | Medium |
| Also noted in `docs/step20-excel-import.md` | | Sums across the periods as new operators; number formats onto the canvas; sending the model straight to fmIDE; real customer workbooks as samples. | — |

### fmGraph and Excel (steps 15–19)

- **Blocks and vintages on a board** — step 15's later ideas.
- **The scenario waterfall in Excel** — left out of step 19: each case's outputs through a Data Table over the Global Case cell, then a waterfall of them (`docs/step19-fmgraph-in-excel.md`).
- **The Free chart** (the owner's request of 26 October 2026) — columns and a waterfall in one chart, each piece (a bar or a stack) sitting on zero, on top of another, where another ends, or at a number; later dragged on a grid with fmIDE's snapping, moved into `src/shared/`. Brief with the owner's choices: `docs/fmgraph-free-chart.md`. Phases F1 (from a list, medium — built 27 October 2026, board file 13), F2 (the grid, medium to large), F3 (the Excel Dashboard, medium, starting with a check in Excel).

### The community library (step 8)

- **Check a pack before uploading it** — today a pack's problems show only after it is uploaded to GitHub, in the pull request's check. On the published site, fmIDE could run the same rules against the library's `index.json` (version ids, families, packs taken down) when the pack is saved, and say what to fix first. Raised on 19 October 2026, after the owner's pack was refused twice; medium (the rules would move into `src/shared/` for both).

### Phones (step 17)

Tilt to sweep a slider; a phone tutorial; receiving a `.fmide` from another app's share sheet (Android only); light editing in fmIDE on a phone through the hold menu (`docs/step17-phones.md`).

### Already agreed, waiting for a session (`docs/decisions.md`)

- **Faster tests**, ongoing, never by checking less.
- **H4c, the video links**, waiting on the owner's recordings.

## 3. Built or dropped

| Idea | Outcome |
|---|---|
| Import an existing Excel model (brainstorm #2) | Built: step 20, pull requests #158–#166, follow-ups #168–#177 |
| Fold one-off typed numbers into the row's own box; one canvas per section | Built: #169, #170 |
| Keep the Excel layout and look; the round-trip check | Built: #172–#174 |
| The last year-1 test; the layout in the saved document | Built: #175, #176 |
| Space between the Inputs tab's groups (idea 9) | Built: #177 |
| Sensitivity and sliders on the Inputs tab, easier to read (idea 10) | Built: #179, #180 |
| fmGraph: a slider's Range and step stays open | Built: #181 |
| fmGraph: find a rectangle by typing (the search shared with fmIDE's launcher) | Built: #182 |
| fmGraph: one period for every board, any chart keeping its own | Built: #184 |
| Translate running totals in the Excel import (`SUM($D$8:D8)`, as a period shift) | Built: #186; lookups, `SUMIF`/`COUNTIF`, `NPV`/`IRR` and dates remain (section 2) |
| fmGraph: goal seek ("what price keeps cash above zero?", step 15's later ideas) | Built: #187 — the Goal seek panel under the sliders |
| fmGraph: line charts (step 15's later ideas), and as Excel line charts on the Dashboard | Built: #188 (board file 10) |
| The library: share a version again with new attachments, or the items of one's own pack taken down | Built: #193 (19 October 2026) |
| A readable pack file name (agreed 4 October 2026) | Built: #189 (`docs/decisions.md`); the library's `checker.json` moved to it in fmide-library #17 (19 October 2026) |
| Exact number formats: a row's own Excel code (`style.excelFormat`), kept by the Excel import | Built: #190 (mapping file 10) |
