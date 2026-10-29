# Appendix A — What came when

[← Contents](README.md)

Every build step, every pull request up to #194, and from then on every pull request that changes something a person sees, with the lesson that teaches what it built. Use it two ways: to check that the manual covers everything, and to find the lesson for a change you read about in [What's new](https://fmide.pages.dev/help/whats-new/) or the [CHANGELOG](../../CHANGELOG.md).

Developer work (the test suite, the build, publishing, guidance for the sessions that write the code) changes nothing a person sees, so it has no lesson.

## The first version

fmIDE and ExcelExporter existed before this repository (imported on 24 September 2026). What they already did is taught in these lessons:

| Feature | Lessons |
|---|---|
| Rectangles, operators, arrows, aliases, Evaluate | [2.1](02-building-models.md#first-model), [2.4](02-building-models.md#operators), [2.6](02-building-models.md#canvases) |
| Periods, period shifts, values per period | [2.2](02-building-models.md#periods), [2.3](02-building-models.md#period-shifts) |
| Canvases, blocks and vertical blocks, plugs and sockets | [2.6](02-building-models.md#canvases), [2.7](02-building-models.md#blocks), [2.8](02-building-models.md#plugs-sockets) |
| Templates, format presets, the ribbon, shortcuts, the Command Launcher | [3.1](03-reuse.md#templates), [2.11](02-building-models.md#canvas-look), [1.3](01-getting-started.md#finding-your-way), [1.5](01-getting-started.md#your-settings) |
| Macros and `window.fm` | [4.1](04-macros-scripting.md#recording-macros), [4.2](04-macros-scripting.md#macro-builder), [4.4](04-macros-scripting.md#scripting-fm) |
| ExcelExporter: tabs, rows, the Inputs tab, scenarios and Global Cases, blocks in the workbook | [5.1](05-excelexporter.md#first-workbook), [5.3](05-excelexporter.md#tabs-rows), [5.6](05-excelexporter.md#inputs-scenarios), [5.7](05-excelexporter.md#blocks-in-excel) |

## By build step

The build order is in [`docs/architecture/build-order.md`](../architecture/build-order.md).

| Step | What it built | Lessons |
|---|---|---|
| 1 | The repository | — *(developer work)* |
| 2 | The permanent test suite | — *(developer work)* |
| 3 | The apps split into modules, still single HTML files | — *(developer work)* |
| 4 | Storage: autosave, documents (New, Open, Save), the Preferences file | [1.4](01-getting-started.md#documents), [1.5](01-getting-started.md#your-settings) |
| 5 | The installable web app, the licences, publishing | [1.2](01-getting-started.md#opening-the-apps) |
| 6 | Template versions, linked canvases, recipes, the several-plugs warning | [3.2](03-reuse.md#template-versions), [3.4](03-reuse.md#recipes), [2.8](02-building-models.md#plugs-sockets) |
| 7 | One calculation for both apps, units, functions, new operators | [2.4](02-building-models.md#operators), [2.5](02-building-models.md#timing-conditions), [2.12](02-building-models.md#same-numbers), [3.5–3.9](03-reuse.md#first-function), [4.4](04-macros-scripting.md#scripting-fm), [5.4](05-excelexporter.md#differences), [5.5](05-excelexporter.md#functions-in-excel) |
| 8 | Library packs, the community library and its catalogue, Browse Library | [3.10–3.12](03-reuse.md#library-packs) |
| 9 | Touch: finger and pen, tablets | [2.13](02-building-models.md#tablet) |
| 10 | Help, tutorials, help pages on the website, What's new | [1.3](01-getting-started.md#finding-your-way) |
| 11 | The Excel look in ExcelExporter; remembered layouts | [2.11](02-building-models.md#canvas-look), [5.8](05-excelexporter.md#excel-look), [5.9](05-excelexporter.md#layouts) |
| 12 | Faster canvas building | [2.9](02-building-models.md#building-faster) |
| 13 | Zoom | [2.10](02-building-models.md#zoom) |
| 14 | ExcelExporter's new look | [5.2](05-excelexporter.md#exporter-tour) |
| 15 | fmGraph | [6.1–6.5](06-fmgraph.md#bars-sliders), [6.8](06-fmgraph.md#boards-templates) |
| 16 | Sensitivity in ExcelExporter | [5.10](05-excelexporter.md#sensitivity) |
| 17 | Phones | [2.14](02-building-models.md#phone), [5.12](05-excelexporter.md#exporter-phone), [6.9](06-fmgraph.md#fmgraph-phone) |
| 18 | Tornado and Spider in fmGraph | [6.6](06-fmgraph.md#tornado-spider) |
| 19 | fmGraph boards in Excel | [5.10](05-excelexporter.md#sensitivity), [5.11](05-excelexporter.md#fmgraph-in-excel) |
| 20 | Importing an Excel model | [Part 7](07-excel-import.md) |
| After 20 | The import refined; the Inputs tab; fmGraph's search, shared period, goal seek, lines charts; the library's pack name | see the pull requests #165–#193 below |

## By pull request

Oldest first. *Step* is the build step (and phase) the pull request belongs to; "—" means outside the build order, "after 20" the improvements made after step 20. Pull requests #126 and #151 were closed without being merged.

| Pull request | Merged | What it did | Step | Lessons |
|---|---|---|---|---|
| [#1](https://github.com/taroyamakatrmttm-star/fmIDE/pull/1) | 2026-09-24 | Add the permanent test suite (npm test) | 2 | — *(developer work: no change a person sees)* |
| [#2](https://github.com/taroyamakatrmttm-star/fmIDE/pull/2) | 2026-09-24 | Build step 3a: split both apps into src/, byte-identical build | 3a | — *(developer work: no change a person sees)* |
| [#3](https://github.com/taroyamakatrmttm-star/fmIDE/pull/3) | 2026-09-25 | Build step 3b: shared code in src/shared/ | 3b | — *(developer work: no change a person sees)* |
| [#4](https://github.com/taroyamakatrmttm-star/fmIDE/pull/4) | 2026-09-25 | Step 4a: IndexedDB underneath, same behaviour | 4a | [1.4](01-getting-started.md#documents) |
| [#5](https://github.com/taroyamakatrmttm-star/fmIDE/pull/5) | 2026-09-25 | fmIDE: fix a race in Recent; keep test file names upload-safe | 4b | [1.4](01-getting-started.md#documents), [5.1](05-excelexporter.md#first-workbook) |
| [#6](https://github.com/taroyamakatrmttm-star/fmIDE/pull/6) | 2026-09-25 | fmIDE: Open Recent waits for Recent updates still being written | 4c | [1.5](01-getting-started.md#your-settings) |
| [#7](https://github.com/taroyamakatrmttm-star/fmIDE/pull/7) | 2026-09-25 | Docs: point to 22-customize-ribbon-ui-state.js after the rename | 5a | [1.2](01-getting-started.md#opening-the-apps) |
| [#8](https://github.com/taroyamakatrmttm-star/fmIDE/pull/8) | 2026-09-25 | CLAUDE.md: "How we work" — the routine for every session | — | — *(developer work: no change a person sees)* |
| [#9](https://github.com/taroyamakatrmttm-star/fmIDE/pull/9) | 2026-09-26 | Step 5b part 1: licences — open core, one repository with two licences | 5b | — *(the licences: [LICENSING.md](../../LICENSING.md))* |
| [#10](https://github.com/taroyamakatrmttm-star/fmIDE/pull/10) | 2026-09-26 | Step 5b part 2: publish to Cloudflare Pages automatically, with PR previews | 5b | [1.2](01-getting-started.md#opening-the-apps) |
| [#11](https://github.com/taroyamakatrmttm-star/fmIDE/pull/11) | 2026-09-26 | ExcelExporter: gather Block Input rectangles onto the Inputs tab | — | [5.6](05-excelexporter.md#inputs-scenarios), [5.7](05-excelexporter.md#blocks-in-excel) |
| [#12](https://github.com/taroyamakatrmttm-star/fmIDE/pull/12) | 2026-09-26 | fmIDE: search box in the Templates window | — | [3.1](03-reuse.md#templates) |
| [#13](https://github.com/taroyamakatrmttm-star/fmIDE/pull/13) | 2026-09-26 | ExcelExporter: unconnected block inputs become real inputs, gathered per instance | — | [5.7](05-excelexporter.md#blocks-in-excel) |
| [#14](https://github.com/taroyamakatrmttm-star/fmIDE/pull/14) | 2026-09-26 | ExcelExporter says when a new version is ready; previews lead with the exact version | — | [1.2](01-getting-started.md#opening-the-apps) |
| [#15](https://github.com/taroyamakatrmttm-star/fmIDE/pull/15) | 2026-09-26 | fmIDE: stop duplicate templates building up; add "Remove duplicates" | — | [3.3](03-reuse.md#system-templates) |
| [#16](https://github.com/taroyamakatrmttm-star/fmIDE/pull/16) | 2026-09-26 | Fix "Remove duplicates" removing originals; unique template ids; add "Clear all templates" | — | [3.3](03-reuse.md#system-templates) |
| [#17](https://github.com/taroyamakatrmttm-star/fmIDE/pull/17) | 2026-09-26 | fmIDE: "Remove duplicates…" window — choose what must match, and which to keep | — | [3.3](03-reuse.md#system-templates) |
| [#18](https://github.com/taroyamakatrmttm-star/fmIDE/pull/18) | 2026-09-26 | fmIDE: several plugs on one rectangle (system v3, module v2) | 6 | [2.8](02-building-models.md#plugs-sockets) |
| [#19](https://github.com/taroyamakatrmttm-star/fmIDE/pull/19) | 2026-09-26 | fmIDE: template families and versions (Phase A) | 6 | [3.2](03-reuse.md#template-versions) |
| [#20](https://github.com/taroyamakatrmttm-star/fmIDE/pull/20) | 2026-09-26 | fmIDE: canvases remember their template; "Update this canvas" (Phase B) | 6 | [3.2](03-reuse.md#template-versions) |
| [#21](https://github.com/taroyamakatrmttm-star/fmIDE/pull/21) | 2026-09-26 | fmIDE: recipe templates — canvas templates built together (Phase C) | 6 | [3.4](03-reuse.md#recipes) |
| [#22](https://github.com/taroyamakatrmttm-star/fmIDE/pull/22) | 2026-09-27 | fmIDE: warn when more than one plug feeds a socket; fix deleting a canvas with plugs | 6 | [2.8](02-building-models.md#plugs-sockets) |
| [#23](https://github.com/taroyamakatrmttm-star/fmIDE/pull/23) | 2026-09-27 | Formula IR phase A: the canvas and Excel give the same numbers | 7 A, B | [2.12](02-building-models.md#same-numbers) |
| [#24](https://github.com/taroyamakatrmttm-star/fmIDE/pull/24) | 2026-09-27 | Formula IR phase B: the shared IR, and fmIDE calculating on it | 7 A, B | [2.12](02-building-models.md#same-numbers) |
| [#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25) | 2026-09-27 | Formula IR phase C: ExcelExporter writes its formulas from the shared IR | 7 C | [2.12](02-building-models.md#same-numbers), [5.4](05-excelexporter.md#differences) |
| [#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26) | 2026-09-27 | Function plugins, phase D1: the shared parser, the IR and the file formats | 7 D1 | [3.5](03-reuse.md#first-function), [3.9](03-reuse.md#sharing-functions) |
| [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27) | 2026-09-27 | Function plugins phase D2a: the function library and the Functions manager | 7 D2a | [3.5](03-reuse.md#first-function), [3.7](03-reuse.md#function-versions), [3.8](03-reuse.md#functions-calling-functions), [4.4](04-macros-scripting.md#scripting-fm) |
| [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28) | 2026-09-27 | Function plugins phase D2b: function nodes on the canvas | 7 D2b | [3.6](03-reuse.md#function-on-canvas), [3.7](03-reuse.md#function-versions), [3.9](03-reuse.md#sharing-functions) |
| [#29](https://github.com/taroyamakatrmttm-star/fmIDE/pull/29) | 2026-09-27 | Fix: canvas edits on nodes from hand-written files; clickable vertical port toggle | 7 | — *(a fix: the feature works as its lesson says)* |
| [#30](https://github.com/taroyamakatrmttm-star/fmIDE/pull/30) | 2026-09-27 | Fix: nodes from files without a usable size get their type's size | 7 | — *(a fix: the feature works as its lesson says)* |
| [#31](https://github.com/taroyamakatrmttm-star/fmIDE/pull/31) | 2026-09-27 | Step 7 D3: ExcelExporter writes function calls out in full | 7 D3 | [5.5](05-excelexporter.md#functions-in-excel) |
| [#32](https://github.com/taroyamakatrmttm-star/fmIDE/pull/32) | 2026-09-27 | Fix: nested function calls calculated slowly | 7 | [3.8](03-reuse.md#functions-calling-functions) |
| [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33) | 2026-09-27 | Phase E1a: timing, conditions and rounding operators in both apps | 7 E1a | [2.5](02-building-models.md#timing-conditions), [5.5](05-excelexporter.md#functions-in-excel) |
| [#34](https://github.com/taroyamakatrmttm-star/fmIDE/pull/34) | 2026-09-27 | Phase E1b: the new operators on fmIDE's canvas | 7 E1b | [2.5](02-building-models.md#timing-conditions) |
| [#35](https://github.com/taroyamakatrmttm-star/fmIDE/pull/35) | 2026-09-27 | Docs: step-by-step tutorial for the features since pull request #23 | — | — *(the first tutorial, now lessons [2.5](02-building-models.md#timing-conditions), [2.12](02-building-models.md#same-numbers), [3.5–3.9](03-reuse.md#first-function), [4.4](04-macros-scripting.md#scripting-fm), [5.4](05-excelexporter.md#differences), [5.5](05-excelexporter.md#functions-in-excel))* |
| [#36](https://github.com/taroyamakatrmttm-star/fmIDE/pull/36) | 2026-09-27 | Step 8a: library packs — share templates, recipes and functions as one file | 8a | [3.10](03-reuse.md#library-packs) |
| [#37](https://github.com/taroyamakatrmttm-star/fmIDE/pull/37) | 2026-09-27 | Step 8b: record where templates and functions came from (origin) | 8b | [3.10](03-reuse.md#library-packs) |
| [#38](https://github.com/taroyamakatrmttm-star/fmIDE/pull/38) | 2026-09-27 | Step 8c-1: the shared pack reader and the library's pack checker | 8c-1 | [3.12](03-reuse.md#share-library) |
| [#39](https://github.com/taroyamakatrmttm-star/fmIDE/pull/39) | 2026-09-28 | Step 8c-2 (part 1): the checker's library mode | 8c-2 | [3.12](03-reuse.md#share-library) |
| [#40](https://github.com/taroyamakatrmttm-star/fmIDE/pull/40) | 2026-09-28 | Step 8c-2 done: refuse packs outside packs/, and close the phase in the docs | 8c-2 | [3.12](03-reuse.md#share-library) |
| [#41](https://github.com/taroyamakatrmttm-star/fmIDE/pull/41) | 2026-09-28 | Step 8c-3: the library's catalogue on the site (/library) | 8c-3 | [3.11](03-reuse.md#browse-library) |
| [#42](https://github.com/taroyamakatrmttm-star/fmIDE/pull/42) | 2026-09-28 | Step 8d: browse the community library inside fmIDE | 8d | [3.11](03-reuse.md#browse-library) |
| [#43](https://github.com/taroyamakatrmttm-star/fmIDE/pull/43) | 2026-09-28 | Library catalogue: build when every pack has been taken down | 8c-3 | — *(developer work: no change a person sees)* |
| [#44](https://github.com/taroyamakatrmttm-star/fmIDE/pull/44) | 2026-09-28 | ExcelExporter: tidier formulas, Links for plug-fed rows, new defaults (phase A) | — | [5.3](05-excelexporter.md#tabs-rows) |
| [#45](https://github.com/taroyamakatrmttm-star/fmIDE/pull/45) | 2026-09-28 | Step 9a: one input path for mouse, finger and pen on fmIDE's canvas | 9a | [2.13](02-building-models.md#tablet) |
| [#46](https://github.com/taroyamakatrmttm-star/fmIDE/pull/46) | 2026-09-28 | ExcelExporter Tree View: a row's own format, indent, full right-click menu (phase B) | — | [5.3](05-excelexporter.md#tabs-rows), [5.8](05-excelexporter.md#excel-look) |
| [#47](https://github.com/taroyamakatrmttm-star/fmIDE/pull/47) | 2026-09-28 | Library: take down the test pack | — | — *(developer work: no change a person sees)* |
| [#48](https://github.com/taroyamakatrmttm-star/fmIDE/pull/48) | 2026-09-28 | Touch, phase 9b: press-and-hold menu, selection box, double-tap, larger touch areas | 9b | [2.13](02-building-models.md#tablet) |
| [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49) | 2026-09-28 | New nodes go into free space; Run selected step moves on; ExcelExporter starts in formula order (phase C) | — | [2.9](02-building-models.md#building-faster), [4.2](04-macros-scripting.md#macro-builder), [5.3](05-excelexporter.md#tabs-rows) |
| [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50) | 2026-09-28 | Resizable windows; the Templates list as a tree (phase D) | — | [1.3](01-getting-started.md#finding-your-way), [3.1](03-reuse.md#templates) |
| [#51](https://github.com/taroyamakatrmttm-star/fmIDE/pull/51) | 2026-09-28 | Touch, phase 9c: the screen, and ExcelExporter by touch | 9c | [2.13](02-building-models.md#tablet), [5.3](05-excelexporter.md#tabs-rows) |
| [#52](https://github.com/taroyamakatrmttm-star/fmIDE/pull/52) | 2026-09-28 | Docs: tidy up after merge-conflict resolutions | — | — *(developer work: no change a person sees)* |
| [#53](https://github.com/taroyamakatrmttm-star/fmIDE/pull/53) | 2026-09-28 | ExcelExporter: inputs read from another tab come straight from the Inputs tab | — | [5.6](05-excelexporter.md#inputs-scenarios) |
| [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54) | 2026-09-28 | fmIDE: paste into free space; a recipe skips parts already built | — | [2.9](02-building-models.md#building-faster), [3.4](03-reuse.md#recipes) |
| [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55) | 2026-09-29 | ExcelExporter: "← Back to fmIDE" button; Open ExcelExporter reuses its window | — | [1.1](01-getting-started.md#three-apps), [5.1](05-excelexporter.md#first-workbook) |
| [#56](https://github.com/taroyamakatrmttm-star/fmIDE/pull/56) | 2026-09-29 | Step 10 H1: Help panel, help search and a plain sentence per command | 10 H1 | [1.3](01-getting-started.md#finding-your-way) |
| [#57](https://github.com/taroyamakatrmttm-star/fmIDE/pull/57) | 2026-09-30 | Step 10 H2: help where you are — ribbon tips, a ? on every window, ExcelExporter's Help | 10 H2 | [1.3](01-getting-started.md#finding-your-way) |
| [#58](https://github.com/taroyamakatrmttm-star/fmIDE/pull/58) | 2026-09-30 | Step 10 H3a: tutorials in practice mode, and a welcome card | 10 H3a | [1.3](01-getting-started.md#finding-your-way) |
| [#59](https://github.com/taroyamakatrmttm-star/fmIDE/pull/59) | 2026-09-30 | Step 10 H3b: four more tutorials (blocks, templates, functions, to Excel) | 10 H3b | [1.3](01-getting-started.md#finding-your-way) |
| [#60](https://github.com/taroyamakatrmttm-star/fmIDE/pull/60) | 2026-09-30 | Queue step 11: the Excel look and layout belong to ExcelExporter | 11 | — *(developer work: no change a person sees)* |
| [#61](https://github.com/taroyamakatrmttm-star/fmIDE/pull/61) | 2026-09-30 | Step 10 H4a: help pages on the site (/help) | 10 H4a | [1.3](01-getting-started.md#finding-your-way) |
| [#62](https://github.com/taroyamakatrmttm-star/fmIDE/pull/62) | 2026-09-30 | Step 10 H4b: tutorial video scripts and screen recordings | 10 H4b | — *(tutorial videos: see [How the lessons are written](STYLE.md#videos))* |
| [#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63) | 2026-09-30 | Step 11a: the Excel look moves to ExcelExporter (its own Excel style) | 11a | [2.11](02-building-models.md#canvas-look), [5.8](05-excelexporter.md#excel-look) |
| [#64](https://github.com/taroyamakatrmttm-star/fmIDE/pull/64) | 2026-09-30 | Step 11b: ExcelExporter remembers each module's layout | 11b | [5.9](05-excelexporter.md#layouts) |
| [#65](https://github.com/taroyamakatrmttm-star/fmIDE/pull/65) | 2026-09-30 | Test group 36: wait for Reset Mapping to finish before reading the tabs | 11c-1 | [5.9](05-excelexporter.md#layouts) |
| [#66](https://github.com/taroyamakatrmttm-star/fmIDE/pull/66) | 2026-09-30 | Step 11c-2: ExcelExporter uses a template's attached Excel layout | 11c-2 | [5.9](05-excelexporter.md#layouts) |
| [#67](https://github.com/taroyamakatrmttm-star/fmIDE/pull/67) | 2026-10-01 | Step 11d: block instance tabs remember their Excel layout | 11d | [5.7](05-excelexporter.md#blocks-in-excel), [5.9](05-excelexporter.md#layouts) |
| [#68](https://github.com/taroyamakatrmttm-star/fmIDE/pull/68) | 2026-10-01 | Step 7 phase E2a: ln, exp, sqrt, int and trunc as operators | 7 E2a | [2.4](02-building-models.md#operators) |
| [#69](https://github.com/taroyamakatrmttm-star/fmIDE/pull/69) | 2026-10-01 | Step 7 phase E2b: choose, a scenario switch | 7 E2b | [2.5](02-building-models.md#timing-conditions) |
| [#70](https://github.com/taroyamakatrmttm-star/fmIDE/pull/70) | 2026-10-01 | The 📈 chart shows every period, and its window is resizable | — | [2.2](02-building-models.md#periods) |
| [#71](https://github.com/taroyamakatrmttm-star/fmIDE/pull/71) | 2026-10-02 | Faster calculation on long timelines: each period worked out once | — | [2.3](02-building-models.md#period-shifts), [2.12](02-building-models.md#same-numbers) |
| [#72](https://github.com/taroyamakatrmttm-star/fmIDE/pull/72) | 2026-10-01 | Plan step 12: snap to equal spacing and Add Many Rectangles | 12 | — *(developer work: no change a person sees)* |
| [#73](https://github.com/taroyamakatrmttm-star/fmIDE/pull/73) | 2026-10-02 | Step 12b: Add Many Rectangles… and the Ctrl+Enter quick chain | 12b | [2.9](02-building-models.md#building-faster) |
| [#74](https://github.com/taroyamakatrmttm-star/fmIDE/pull/74) | 2026-10-02 | Step 12a: snap to equal spacing while dragging | 12a | [2.9](02-building-models.md#building-faster) |
| [#75](https://github.com/taroyamakatrmttm-star/fmIDE/pull/75) | 2026-10-02 | ExcelExporter help: what is remembered, which layout and format win, template layouts | — | [5.9](05-excelexporter.md#layouts) |
| [#76](https://github.com/taroyamakatrmttm-star/fmIDE/pull/76) | 2026-10-02 | H5a: a wider Help panel — reading view and a draggable edge | 10 H5a | [1.3](01-getting-started.md#finding-your-way) |
| [#77](https://github.com/taroyamakatrmttm-star/fmIDE/pull/77) | 2026-10-02 | H5b: What's new inside Help — a page per update, in both apps | 10 H5b | [1.3](01-getting-started.md#finding-your-way) |
| [#78](https://github.com/taroyamakatrmttm-star/fmIDE/pull/78) | 2026-10-02 | H5c: What's new on the website — /help/whats-new/ and ExcelExporter's | 10 H5c | [1.3](01-getting-started.md#finding-your-way) |
| [#79](https://github.com/taroyamakatrmttm-star/fmIDE/pull/79) | 2026-10-02 | Step 13a: zoom the canvas, 25%–200% | 13a | [2.10](02-building-models.md#zoom) |
| [#80](https://github.com/taroyamakatrmttm-star/fmIDE/pull/80) | 2026-10-02 | Step 13b: pinch with two fingers to zoom the canvas on a tablet | 13b | [2.10](02-building-models.md#zoom), [2.13](02-building-models.md#tablet) |
| [#81](https://github.com/taroyamakatrmttm-star/fmIDE/pull/81) | 2026-10-02 | Docs for ExcelExporter's new look (step 14) | 14 | [5.2](05-excelexporter.md#exporter-tour) |
| [#82](https://github.com/taroyamakatrmttm-star/fmIDE/pull/82) | 2026-10-02 | Step 15 G0: the brief for fmGraph | 15 G0 | — *(developer work: no change a person sees)* |
| [#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83) | 2026-10-02 | Step 15 G1: Open fmGraph in fmIDE, and the docs | 15 G1 | [1.1](01-getting-started.md#three-apps), [6.1](06-fmgraph.md#bars-sliders) |
| [#84](https://github.com/taroyamakatrmttm-star/fmIDE/pull/84) | 2026-10-03 | Step 15 G2: fmGraph charts, columns and waterfalls | 15 G2 | [6.2](06-fmgraph.md#graph-charts) |
| [#85](https://github.com/taroyamakatrmttm-star/fmIDE/pull/85) | 2026-10-03 | Step 15 G3a: fmGraph boards — tabs, arranging, colours, undo, the board file | 15 G3a | [6.3](06-fmgraph.md#graph-boards) |
| [#86](https://github.com/taroyamakatrmttm-star/fmIDE/pull/86) | 2026-10-03 | fmGraph: show the colour chosen for a bar or a waterfall step | 15 | [6.3](06-fmgraph.md#graph-boards) |
| [#87](https://github.com/taroyamakatrmttm-star/fmIDE/pull/87) | 2026-10-03 | Step 15 G3b: fmGraph's boards saved inside .fmide documents | 15 G3b | [6.3](06-fmgraph.md#graph-boards) |
| [#88](https://github.com/taroyamakatrmttm-star/fmIDE/pull/88) | 2026-10-03 | Step 15 G4a: fmGraph's Trace and Biggest movers | 15 G4a | [6.4](06-fmgraph.md#graph-explore) |
| [#89](https://github.com/taroyamakatrmttm-star/fmIDE/pull/89) | 2026-10-03 | fmGraph: keep a chart's editor open when the board is redrawn at once | 15 G4b | [6.4](06-fmgraph.md#graph-explore) |
| [#90](https://github.com/taroyamakatrmttm-star/fmIDE/pull/90) | 2026-10-03 | Step 15 G5a: fmGraph boards on templates | 15 G5a | [6.8](06-fmgraph.md#boards-templates) |
| [#91](https://github.com/taroyamakatrmttm-star/fmIDE/pull/91) | 2026-10-03 | Step 15 G5b: docs, and named scenarios recorded in the build order | 15 G5b | [6.8](06-fmgraph.md#boards-templates) |
| [#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92) | 2026-10-03 | fmGraph G5c: Try in fmGraph from Browse Library | 15 G5c | [3.11](03-reuse.md#browse-library), [6.8](06-fmgraph.md#boards-templates) |
| [#93](https://github.com/taroyamakatrmttm-star/fmIDE/pull/93) | 2026-10-03 | fmGraph scenarios S1: named scenarios | 15 S1 | [6.5](06-fmgraph.md#graph-scenarios) |
| [#94](https://github.com/taroyamakatrmttm-star/fmIDE/pull/94) | 2026-10-03 | fmGraph scenarios S2: the scenario waterfall | 15 S2 | [6.5](06-fmgraph.md#graph-scenarios) |
| [#95](https://github.com/taroyamakatrmttm-star/fmIDE/pull/95) | 2026-10-03 | fmGraph G6: tutorials | 15 G6 | [6.1](06-fmgraph.md#bars-sliders), [6.2](06-fmgraph.md#graph-charts), [6.4](06-fmgraph.md#graph-explore), [6.5](06-fmgraph.md#graph-scenarios) |
| [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96) | 2026-10-03 | ExcelExporter reads the model open in fmIDE | — | [1.1](01-getting-started.md#three-apps), [5.1](05-excelexporter.md#first-workbook) |
| [#97](https://github.com/taroyamakatrmttm-star/fmIDE/pull/97) | 2026-10-03 | Long messages fit the screen; .fmide files can be picked on an iPad | — | [1.4](01-getting-started.md#documents), [2.13](02-building-models.md#tablet) |
| [#98](https://github.com/taroyamakatrmttm-star/fmIDE/pull/98) | 2026-10-03 | ExcelExporter: a row's own border on each side separately | — | [5.8](05-excelexporter.md#excel-look) |
| [#99](https://github.com/taroyamakatrmttm-star/fmIDE/pull/99) | 2026-10-03 | fmIDE: a tidier Templates window, with Expand all and Collapse all | — | [3.1](03-reuse.md#templates) |
| [#100](https://github.com/taroyamakatrmttm-star/fmIDE/pull/100) | 2026-10-03 | fmIDE: Next Canvas and Previous Canvas from the keyboard | — | [2.6](02-building-models.md#canvases) |
| [#101](https://github.com/taroyamakatrmttm-star/fmIDE/pull/101) | 2026-10-03 | fmIDE: recipes within a recipe | — | [3.4](03-reuse.md#recipes) |
| [#102](https://github.com/taroyamakatrmttm-star/fmIDE/pull/102) | 2026-10-03 | Macros that keep working when the model differs, and help to write them | — | [4.3](04-macros-scripting.md#reliable-macros) |
| [#103](https://github.com/taroyamakatrmttm-star/fmIDE/pull/103) | 2026-10-04 | Stepping through a macro keeps its variables; Undo while recording takes only its own steps | — | [4.2](04-macros-scripting.md#macro-builder) |
| [#104](https://github.com/taroyamakatrmttm-star/fmIDE/pull/104) | 2026-10-04 | Roadmap: record the system-template link bug as a known issue | — | — *(developer work: no change a person sees)* |
| [#105](https://github.com/taroyamakatrmttm-star/fmIDE/pull/105) | 2026-10-04 | System templates keep their canvases' links to their canvas templates | — | [3.3](03-reuse.md#system-templates) |
| [#106](https://github.com/taroyamakatrmttm-star/fmIDE/pull/106) | 2026-10-04 | Templates: remove old versions of one template, or of all templates | — | [3.3](03-reuse.md#system-templates) |
| [#107](https://github.com/taroyamakatrmttm-star/fmIDE/pull/107) | 2026-10-04 | Share a pack in the community library: a window, a step-by-step guide, and the right file name | — | [3.12](03-reuse.md#share-library) |
| [#108](https://github.com/taroyamakatrmttm-star/fmIDE/pull/108) | 2026-10-04 | Roadmap: a readable pack file name, the library taking any name (agreed for later) | — | — *(developer work: no change a person sees)* |
| [#109](https://github.com/taroyamakatrmttm-star/fmIDE/pull/109) | 2026-10-04 | Browse Library showed nothing: publish the library's current packs | 8 | — *(developer work: no change a person sees)* |
| [#110](https://github.com/taroyamakatrmttm-star/fmIDE/pull/110) | 2026-10-04 | Library records written when a pack is merged: the checker's --records-on-merge | 8 | — *(developer work: no change a person sees)* |
| [#111](https://github.com/taroyamakatrmttm-star/fmIDE/pull/111) | 2026-10-05 | Update library catalogue | 8 | — *(developer work: no change a person sees)* |
| [#112](https://github.com/taroyamakatrmttm-star/fmIDE/pull/112) | 2026-10-08 | The live site picks up packs merged into the library by itself | 8 | — *(developer work: no change a person sees)* |
| [#113](https://github.com/taroyamakatrmttm-star/fmIDE/pull/113) | 2026-10-08 | Step 3c-1: the shared code Node runs becomes real modules | 3c-1 | — *(developer work: no change a person sees)* |
| [#114](https://github.com/taroyamakatrmttm-star/fmIDE/pull/114) | 2026-10-08 | Step 3c-2: the browser's shared pieces become modules too | 3c-2 | — *(developer work: no change a person sees)* |
| [#115](https://github.com/taroyamakatrmttm-star/fmIDE/pull/115) | 2026-10-08 | Touch: a menu choice right after a tap that cancelled an arrow counts again | 9 | — *(a fix: the feature works as its lesson says)* |
| [#116](https://github.com/taroyamakatrmttm-star/fmIDE/pull/116) | 2026-10-08 | Step 3c-3: ExcelExporter's Excel writer and fmIDE's expression parser as modules | 3c-3 | — *(developer work: no change a person sees)* |
| [#117](https://github.com/taroyamakatrmttm-star/fmIDE/pull/117) | 2026-10-08 | Tests: attaching a file to a template waits for fmIDE's message | — | — *(developer work: no change a person sees)* |
| [#118](https://github.com/taroyamakatrmttm-star/fmIDE/pull/118) | 2026-10-08 | Step 3c-4: ExcelExporter's formula building as modules (step 3c done) | 3c-4 | — *(developer work: no change a person sees)* |
| [#119](https://github.com/taroyamakatrmttm-star/fmIDE/pull/119) | 2026-10-08 | CI: run the tests once per change, in 4 parts at once | — | — *(developer work: no change a person sees)* |
| [#120](https://github.com/taroyamakatrmttm-star/fmIDE/pull/120) | 2026-10-08 | CI: balance the 4 test parts by measured time | — | — *(developer work: no change a person sees)* |
| [#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121) | 2026-10-08 | An operator with nothing wired in gives 0, as in Excel | — | [2.4](02-building-models.md#operators), [2.8](02-building-models.md#plugs-sockets) |
| [#122](https://github.com/taroyamakatrmttm-star/fmIDE/pull/122) | 2026-10-08 | ExcelExporter: Sensitivity — Tornado and Spider tables, live in Excel (step 16, phase A) | 16 A | [5.10](05-excelexporter.md#sensitivity) |
| [#123](https://github.com/taroyamakatrmttm-star/fmIDE/pull/123) | 2026-10-08 | ExcelExporter: the Tornado and Spider charts (step 16, phase B) | 16 B | [5.10](05-excelexporter.md#sensitivity) |
| [#124](https://github.com/taroyamakatrmttm-star/fmIDE/pull/124) | 2026-10-08 | ExcelExporter: tab names with an apostrophe work in Excel | — | [5.3](05-excelexporter.md#tabs-rows) |
| [#125](https://github.com/taroyamakatrmttm-star/fmIDE/pull/125) | 2026-10-09 | Step 17 P0: the owner's choices recorded | 17 P0 | — *(developer work: no change a person sees)* |
| [#127](https://github.com/taroyamakatrmttm-star/fmIDE/pull/127) | 2026-10-09 | Step 17 P1a: fmGraph on a phone | 17 P1a | [6.9](06-fmgraph.md#fmgraph-phone) |
| [#128](https://github.com/taroyamakatrmttm-star/fmIDE/pull/128) | 2026-10-09 | Step 17 P1b: fmGraph on a phone - the mixer, Show, holding A, Share | 17 P1b | [6.9](06-fmgraph.md#fmgraph-phone) |
| [#129](https://github.com/taroyamakatrmttm-star/fmIDE/pull/129) | 2026-10-09 | Step 17 P2a: fmIDE on a phone — Inputs, Watch and the canvas to look at | 17 P2a | [2.14](02-building-models.md#phone) |
| [#130](https://github.com/taroyamakatrmttm-star/fmIDE/pull/130) | 2026-10-09 | Step 17 P2b: fmIDE on a phone — share the document, open fmGraph, the install note | 17 P2b | [2.14](02-building-models.md#phone) |
| [#131](https://github.com/taroyamakatrmttm-star/fmIDE/pull/131) | 2026-10-09 | Step 17 P3: ExcelExporter on a phone — make the workbook and share it; Make Excel in fmIDE | 17 P3 | [2.14](02-building-models.md#phone), [5.12](05-excelexporter.md#exporter-phone) |
| [#132](https://github.com/taroyamakatrmttm-star/fmIDE/pull/132) | 2026-10-09 | fmIDE on a phone: every input listed by the shared input rule | 17 | [2.14](02-building-models.md#phone) |
| [#133](https://github.com/taroyamakatrmttm-star/fmIDE/pull/133) | 2026-10-12 | fmGraph: a fixed vertical scale for bars and charts | — | [6.3](06-fmgraph.md#graph-boards) |
| [#134](https://github.com/taroyamakatrmttm-star/fmIDE/pull/134) | 2026-10-12 | Guidance for sessions: a short CLAUDE.md, path-scoped rules, reference docs | — | — *(developer work: no change a person sees)* |
| [#135](https://github.com/taroyamakatrmttm-star/fmIDE/pull/135) | 2026-10-12 | Guidance: the owner's decisions on the items flagged in #134 | — | — *(developer work: no change a person sees)* |
| [#136](https://github.com/taroyamakatrmttm-star/fmIDE/pull/136) | 2026-10-12 | Which tests a change reaches: npm run test:changed (token-efficiency phase 2) | — | — *(developer work: no change a person sees)* |
| [#137](https://github.com/taroyamakatrmttm-star/fmIDE/pull/137) | 2026-10-12 | test:changed: count fmIDE only where a test can open it | — | — *(developer work: no change a person sees)* |
| [#138](https://github.com/taroyamakatrmttm-star/fmIDE/pull/138) | 2026-10-12 | test:changed: a package.json change only to test: shortcuts runs the files they name | — | — *(developer work: no change a person sees)* |
| [#139](https://github.com/taroyamakatrmttm-star/fmIDE/pull/139) | 2026-10-13 | ExcelExporter: attach a module's layout to its template, no file in between | — | [5.9](05-excelexporter.md#layouts) |
| [#140](https://github.com/taroyamakatrmttm-star/fmIDE/pull/140) | 2026-10-13 | CLAUDE.md: run only the related test groups locally | — | — *(developer work: no change a person sees)* |
| [#141](https://github.com/taroyamakatrmttm-star/fmIDE/pull/141) | 2026-10-13 | fmIDE: the plug editor adds a typed name on a click elsewhere, however quick | — | [2.8](02-building-models.md#plugs-sockets) |
| [#142](https://github.com/taroyamakatrmttm-star/fmIDE/pull/142) | 2026-10-14 | fmGraph: fold sliders, keep the Sliders column on screen, drag by finger on an iPad | — | [6.1](06-fmgraph.md#bars-sliders) |
| [#143](https://github.com/taroyamakatrmttm-star/fmIDE/pull/143) | 2026-10-15 | fmGraph: boards share where the sliders stand; a board can keep its own | — | [6.1](06-fmgraph.md#bars-sliders) |
| [#144](https://github.com/taroyamakatrmttm-star/fmIDE/pull/144) | 2026-10-16 | Docs: briefs for step 18 (Tornado and Spider in fmGraph) and step 19 (fmGraph in Excel) | 18, 19 | — *(developer work: no change a person sees)* |
| [#145](https://github.com/taroyamakatrmttm-star/fmIDE/pull/145) | 2026-10-16 | ExcelExporter's writer: form controls and stacked charts (step 19, B0) | 19 B0 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146) | 2026-10-16 | fmGraph: Tornado and Spider charts (step 18, phase A1) | 18 A1 | [6.6](06-fmgraph.md#tornado-spider) |
| [#147](https://github.com/taroyamakatrmttm-star/fmIDE/pull/147) | 2026-10-16 | ExcelExporter: fmGraph's scenarios become Global Cases (step 19, phase B2) | 19 B2 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#148](https://github.com/taroyamakatrmttm-star/fmIDE/pull/148) | 2026-10-16 | Excel writer: a form control is at least one cell wide and tall (step 19, B0 follow-up) | 19 B0 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149) | 2026-10-16 | fmGraph: Tornado and Spider — each input's Low and High (step 18, phase A2) | 18 A2 | [6.6](06-fmgraph.md#tornado-spider) |
| [#150](https://github.com/taroyamakatrmttm-star/fmIDE/pull/150) | 2026-10-16 | ExcelExporter: several sensitivity analyses, layout file 5 (step 19, B3a) | 19 B3a | [5.10](05-excelexporter.md#sensitivity) |
| [#152](https://github.com/taroyamakatrmttm-star/fmIDE/pull/152) | 2026-10-16 | ExcelExporter: fmGraph's Tornado and Spider become analyses (step 19, phase B3b) | 19 B3b | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#153](https://github.com/taroyamakatrmttm-star/fmIDE/pull/153) | 2026-10-17 | ExcelExporter: fmGraph's sliders on a Dashboard, layout file 7 (step 19, phase B4) | 19 B4 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#154](https://github.com/taroyamakatrmttm-star/fmIDE/pull/154) | 2026-10-17 | ExcelExporter: fmGraph's charts on the Dashboard, layout file 8 (step 19, phase B5) | 19 B5 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#155](https://github.com/taroyamakatrmttm-star/fmIDE/pull/155) | 2026-10-17 | Docs: step 19 done — the owner's checks in Excel on Windows and the iPad | 19 | — *(developer work: no change a person sees)* |
| [#156](https://github.com/taroyamakatrmttm-star/fmIDE/pull/156) | 2026-10-17 | ExcelExporter: the Dashboard's chart tables beside the charts, titles on their own row | 19 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#157](https://github.com/taroyamakatrmttm-star/fmIDE/pull/157) | 2026-10-17 | Docs: a step-by-step guide to pull requests #144 to #156 | — | — *(the second guide, now lessons [5.10](05-excelexporter.md#sensitivity), [5.11](05-excelexporter.md#fmgraph-in-excel), [6.6](06-fmgraph.md#tornado-spider))* |
| [#158](https://github.com/taroyamakatrmttm-star/fmIDE/pull/158) | 2026-10-18 | Step 20a: the brief and sample workbooks for importing an Excel model | 20a | [7.1](07-excel-import.md#which-workbooks) |
| [#159](https://github.com/taroyamakatrmttm-star/fmIDE/pull/159) | 2026-10-18 | Step 20b: reading an .xlsx file for importing an Excel model | 20b | [7.2](07-excel-import.md#import-confirm), [7.10](07-excel-import.md#import-troubleshooting) |
| [#160](https://github.com/taroyamakatrmttm-star/fmIDE/pull/160) | 2026-10-18 | Step 20c: the formula parser for importing an Excel model | 20c | [7.3](07-excel-import.md#what-is-built) |
| [#161](https://github.com/taroyamakatrmttm-star/fmIDE/pull/161) | 2026-10-18 | Step 20d: the layout and the confirm screen for importing an Excel model | 20d | [7.2](07-excel-import.md#import-confirm) |
| [#162](https://github.com/taroyamakatrmttm-star/fmIDE/pull/162) | 2026-10-18 | Step 20e: building the fmIDE model from an imported Excel workbook | 20e | [7.3](07-excel-import.md#what-is-built) |
| [#163](https://github.com/taroyamakatrmttm-star/fmIDE/pull/163) | 2026-10-18 | Step 20f: checking an imported model against Excel's saved values | 20f | [7.4](07-excel-import.md#import-report) |
| [#164](https://github.com/taroyamakatrmttm-star/fmIDE/pull/164) | 2026-10-18 | Step 20g: Save for fmIDE, help and the end-to-end test (step 20 done) | 20g | [7.5](07-excel-import.md#save-for-fmide) |
| [#165](https://github.com/taroyamakatrmttm-star/fmIDE/pull/165) | 2026-10-18 | Import: rows with typed actuals and a forecast formula, after a real model | after 20 | [7.6](07-excel-import.md#actuals-forecast) |
| [#166](https://github.com/taroyamakatrmttm-star/fmIDE/pull/166) | 2026-10-18 | Docs: a step-by-step guide to importing an Excel model (#158 to #165) | — | — *(the third guide, now [Part 7](07-excel-import.md))* |
| [#167](https://github.com/taroyamakatrmttm-star/fmIDE/pull/167) | 2026-10-18 | Fix: a ribbon button's tip no longer shows late, after the pointer left | — | — *(a fix: the feature works as its lesson says)* |
| [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168) | 2026-10-18 | Fix: fmIDE's canvas grows to hold every node (large models scroll all the way) | after 20 | [2.6](02-building-models.md#canvases), [7.7](07-excel-import.md#sections) |
| [#169](https://github.com/taroyamakatrmttm-star/fmIDE/pull/169) | 2026-10-18 | Import: keep a row's typed actuals in its own rectangle (tidier imported models) | after 20 | [7.6](07-excel-import.md#actuals-forecast) |
| [#170](https://github.com/taroyamakatrmttm-star/fmIDE/pull/170) | 2026-10-18 | Import: one canvas per section of a long sheet | after 20 | [7.7](07-excel-import.md#sections) |
| [#171](https://github.com/taroyamakatrmttm-star/fmIDE/pull/171) | 2026-10-18 | Import: one shared "Up to 2024" switch per canvas; step 20 guide brought up to date | after 20 | [7.6](07-excel-import.md#actuals-forecast) |
| [#172](https://github.com/taroyamakatrmttm-star/fmIDE/pull/172) | 2026-10-18 | Import: keep the workbook's own layout (row order, headings, blank rows; constants in the formulas) | after 20 | [7.8](07-excel-import.md#layout-and-look) |
| [#173](https://github.com/taroyamakatrmttm-star/fmIDE/pull/173) | 2026-10-19 | Import: keep the workbook's own look (bold, colours, fills, lines, number formats) | after 20 | [7.8](07-excel-import.md#layout-and-look) |
| [#174](https://github.com/taroyamakatrmttm-star/fmIDE/pull/174) | 2026-10-19 | Import: the round trip — the generated workbook recalculated and checked against the original | after 20 | [7.9](07-excel-import.md#round-trip) |
| [#175](https://github.com/taroyamakatrmttm-star/fmIDE/pull/175) | 2026-10-19 | Import: the first year reads the shared switch, not a year test of its own | after 20 | [7.6](07-excel-import.md#actuals-forecast) |
| [#176](https://github.com/taroyamakatrmttm-star/fmIDE/pull/176) | 2026-10-19 | The Excel layout travels with the document (workspace v13, excelLayout) | after 20 | [5.9](05-excelexporter.md#layouts), [7.5](07-excel-import.md#save-for-fmide) |
| [#177](https://github.com/taroyamakatrmttm-star/fmIDE/pull/177) | 2026-10-19 | ExcelExporter: an empty row before each Inputs-tab group header but the first | after 20 | [5.6](05-excelexporter.md#inputs-scenarios) |
| [#178](https://github.com/taroyamakatrmttm-star/fmIDE/pull/178) | 2026-10-19 | Docs: what ExcelExporter's layouts hold, and which one wins | after 20 | [5.9](05-excelexporter.md#layouts) |
| [#179](https://github.com/taroyamakatrmttm-star/fmIDE/pull/179) | 2026-10-19 | ExcelExporter: sensitivity on the Inputs tab, easier to read (idea 10) | after 20 | [5.10](05-excelexporter.md#sensitivity) |
| [#180](https://github.com/taroyamakatrmttm-star/fmIDE/pull/180) | 2026-10-19 | ExcelExporter: sliders on the Inputs tab, easier to read | after 20 | [5.11](05-excelexporter.md#fmgraph-in-excel) |
| [#181](https://github.com/taroyamakatrmttm-star/fmIDE/pull/181) | 2026-10-19 | fmGraph: a slider's Range and step stays open while it is changed | after 20 | [6.1](06-fmgraph.md#bars-sliders) |
| [#182](https://github.com/taroyamakatrmttm-star/fmIDE/pull/182) | 2026-10-19 | fmGraph: find a rectangle by typing | after 20 | [6.1](06-fmgraph.md#bars-sliders), [6.2](06-fmgraph.md#graph-charts) |
| [#183](https://github.com/taroyamakatrmttm-star/fmIDE/pull/183) | 2026-10-19 | Docs: product ideas for the roadmap | — | — *(developer work: no change a person sees)* |
| [#184](https://github.com/taroyamakatrmttm-star/fmIDE/pull/184) | 2026-10-19 | fmGraph: one period for every board | after 20 | [6.2](06-fmgraph.md#graph-charts) |
| [#185](https://github.com/taroyamakatrmttm-star/fmIDE/pull/185) | 2026-10-19 | Docs: product ideas — the rectangle search and the shared period built | — | — *(developer work: no change a person sees)* |
| [#186](https://github.com/taroyamakatrmttm-star/fmIDE/pull/186) | 2026-10-19 | ExcelExporter: the Excel import translates running totals | after 20 | [7.3](07-excel-import.md#what-is-built) |
| [#187](https://github.com/taroyamakatrmttm-star/fmIDE/pull/187) | 2026-10-19 | fmGraph: goal seek | after 20 | [6.7](06-fmgraph.md#goal-seek) |
| [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188) | 2026-10-19 | fmGraph: lines charts, drawn as Excel line charts on the Dashboard | after 20 | [5.11](05-excelexporter.md#fmgraph-in-excel), [6.2](06-fmgraph.md#graph-charts) |
| [#189](https://github.com/taroyamakatrmttm-star/fmIDE/pull/189) | 2026-10-19 | Library: a readable pack file name | after 20 | [3.10](03-reuse.md#library-packs) |
| [#190](https://github.com/taroyamakatrmttm-star/fmIDE/pull/190) | 2026-10-19 | ExcelExporter: exact number formats | after 20 | [5.8](05-excelexporter.md#excel-look), [7.8](07-excel-import.md#layout-and-look) |
| [#191](https://github.com/taroyamakatrmttm-star/fmIDE/pull/191) | 2026-10-19 | Docs: overall roadmap status after step 20 | — | — *(developer work: no change a person sees)* |
| [#192](https://github.com/taroyamakatrmttm-star/fmIDE/pull/192) | 2026-10-19 | ExcelExporter: Collapse all and Expand all in the Tree View | after 20 | [5.3](05-excelexporter.md#tabs-rows) |
| [#193](https://github.com/taroyamakatrmttm-star/fmIDE/pull/193) | 2026-10-20 | Library checker: share a version again with new attachments, or the items of one's own pack taken down | after 20 | [3.12](03-reuse.md#share-library) |
| [#194](https://github.com/taroyamakatrmttm-star/fmIDE/pull/194) | 2026-10-19 | Docs: the user manual, phase 1 — contents, lesson style, coverage appendix, three tutorials as lessons | — | — *(this manual)* |
| [#197](https://github.com/taroyamakatrmttm-star/fmIDE/pull/197) | 2026-10-21 | Docs: the user manual, phases 3–6 — Parts 3 to 6, the manual complete, checked by the build and on the website at `/manual/` | — | — *(this manual)* |
| [#198](https://github.com/taroyamakatrmttm-star/fmIDE/pull/198) | 2026-10-21 | The user manual, one click from Help: a link in each app's Help panel and on fmIDE's welcome card | after 20 | [1.3](01-getting-started.md#finding-your-way) |
| branch `claude/tree-rename-fixes` | 2026-10-26 | ExcelExporter: a double-click or double-tap in the Tree renames the row when the selection bar has moved the list | after 20 | [5.3](05-excelexporter.md#tabs-rows) |
| branch `claude/fmgraph-shared-colours-e9c229` | 2026-10-26 | fmGraph: one colour per rectangle, shared by its slider, bars and charts on every board (board file 11) | after 20 | [6.3](06-fmgraph.md#graph-boards) |
| branch `claude/objective-merkle-f14472` | 2026-10-27 | fmGraph: one scale for every bar and chart — Auto for all or Fixed for all (board file 12) | after 20 | [6.3](06-fmgraph.md#graph-boards) |
| branch `claude/fmgraph-play-scenarios` | 2026-10-27 | fmGraph: ▶ Play swings between two scenarios and back, like a pendulum | after 20 | [6.5](06-fmgraph.md#graph-scenarios) |
| branch `claude/fmgraph-play-keeps-going` | 2026-10-27 | fmGraph: Play keeps going while you scroll, tap or switch boards; only ■ Stop, Esc or a slider moved stops it | after 20 | [6.5](06-fmgraph.md#graph-scenarios) |
| branch `claude/tornado-remove-all-inputs-655a57` | 2026-10-27 | fmGraph: × Remove all inputs in a Tornado's or Spider's Edit chart; ExcelExporter leaves out one with no inputs, and says so | after 20 | [6.6](06-fmgraph.md#tornado-spider), [5.11](05-excelexporter.md#fmgraph-in-excel) |
| branch `claude/fmgraph-free-chart-f1` | 2026-10-27 | fmGraph: the Free chart — columns and waterfalls together, pieces in grid columns (board file 13); ExcelExporter lists it as not carried | after 20 | [6.2](06-fmgraph.md#graph-charts) |
| branch `claude/colour-grid-picker-1c5e83` | 2026-10-27 | All three apps: every colour box opens a grid of ready colours (greys, hues by shades, chart colours, colours in use), More… for the browser's own | after 20 | [2.11](02-building-models.md#canvas-look), [5.8](05-excelexporter.md#excel-look), [6.3](06-fmgraph.md#graph-boards) |
| branch `claude/fmgraph-key-hides-zeros` | 2026-10-27 | fmGraph: a chart's key leaves out the rectangles at 0 in every period it shows; +N at 0 lists them | after 20 | [6.2](06-fmgraph.md#graph-charts) |
| branch `claude/fmgraph-full-screen` | 2026-10-27 | fmGraph: ⛶ full screen on any screen — one or several bars and charts, chosen by chips, Play in its strip | after 20 | [6.3](06-fmgraph.md#graph-boards), [6.9](06-fmgraph.md#fmgraph-phone) |
| branch `claude/fmgraph-play-gif` | 2026-10-27 | fmGraph: 🎞 a GIF of Play — of the charts in the full screen or of one chart — shared or downloaded | after 20 | [6.5](06-fmgraph.md#graph-scenarios), [6.3](06-fmgraph.md#graph-boards) |
| branch `claude/fmgraph-free-chart-f2` | 2026-10-27 | fmGraph: a Free chart's pieces placed by dragging — guides for where a piece sits, equal-gap marks, Align bottoms, Distribute, Tidy; fmIDE's snapping moved into shared code, unchanged | after 20 | [6.2](06-fmgraph.md#graph-charts) |
| branch `claude/excel-free-chart-f3` | 2026-10-27 | ExcelExporter: fmGraph's Free chart on the Dashboard — stacked columns over hidden fillers, following the sliders (layout file 11) | after 20 | [5.11](05-excelexporter.md#fmgraph-in-excel), [6.2](06-fmgraph.md#graph-charts) |
| branch `claude/viewer-v1` | 2026-10-27 | fmShowcase, the showcase viewer: the Logic view — a model's canvases read-only, a rectangle's card; the showcase file | after 20 | [8.1](08-showcase.md#showcase-viewer) |
| branch `claude/viewer-v2` | 2026-10-28 | fmShowcase: the Board — fmGraph's bars, charts and sliders, scenarios, Play, A/B and Trace, read-only; fmGraph's board engine separated, fmGraph unchanged | after 20 | [8.1](08-showcase.md#showcase-viewer) |
| branch `claude/viewer-v3` | 2026-10-28 | fmIDE: File → Make Showcase Viewer… — one web page showing the model read-only, to email or share; the choices kept in the document (workspace 14) | after 20 | [8.1](08-showcase.md#showcase-viewer) |
| branch `claude/viewer-v4` | 2026-10-29 | Showcase viewers carry Excel: Make Showcase Viewer…'s Include an Excel workbook (ExcelExporter makes it), the visitor's ⬇ Excel with their scenario or sliders written in | after 20 | [8.2](08-showcase.md#showcase-excel) |
| branch `claude/viewer-v6` | 2026-10-29 | The showcase gallery: the site's `/gallery` built from a folder of made viewers (each rebuilt with today's viewer, under its own policy), `make-viewers --pictures --gallery`, `gallery.json`; a viewer in the gallery's ← Gallery and ⇪ Share link; a bar's card, Both on an iPad, a phone held sideways | after 20 | [8.4](08-showcase.md#showcase-gallery) |
| branch `claude/viewer-v5` | 2026-10-29 | Showcase viewers for many models at once: Make Showcase Viewer…'s Choose for me; `npm run make-viewers` with a recipe naming sliders, bars and canvases by name, `--auto`, the workbooks made by ExcelExporter driven without a window, the report | after 20 | [8.3](08-showcase.md#showcase-many) |
| branch `claude/choose-for-me-empty-boards` | 2026-10-29 | Choose for me offered for any model: an empty fmGraph board counts as none (replaced), beside real boards it adds one more; the batch's `--auto` chooses for a model whose boards are all empty | after 20 | [8.3](08-showcase.md#showcase-many) |
| branch `claude/showcase-canvases-select-all` | 2026-10-29 | Make Showcase Viewer…: Select all and Unselect all for the canvases the visitor sees | after 20 | [8.1](08-showcase.md#showcase-viewer) |
| branch `claude/viewer-ipad-sliders` | 2026-10-29 | fmShowcase: a made viewer's .html chosen in it opens as from disk (for an iPhone or iPad, where Files only previews it); the sliders one short row each, in a list that scrolls on its own | after 20 | [8.1](08-showcase.md#showcase-viewer) |

---

[← Contents](README.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
