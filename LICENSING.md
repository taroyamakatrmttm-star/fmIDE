# Licensing

fmIDE is **open core**: the editor, fmGraph and the file format are open, so anyone can use, study, build on and share them; ExcelExporter is free to use but proprietary. Copyright 2026 Taro Yamaka.

| What | Where | Licence | In short |
|---|---|---|---|
| **fmIDE** (the editor) | `src/fmide/`, `apps/fmIDE.html`, `src/site/`, `src/library/` (the catalogue's styling), `src/help-pages/` (the help pages' styling) | [Apache License 2.0](LICENSE) | Use, change and share it freely, commercially too; keep the copyright and licence notices ([NOTICE](NOTICE)). |
| **fmGraph** (bars and sliders, step 15) | `src/fmgraph/`, `apps/fmGraph.html` | [Apache License 2.0](LICENSE) | Same as fmIDE (decision 10). Its help text is in `src/help/`. |
| **fmShowcase** (the showcase viewer, `docs/viewer-brief.md`) | `src/viewer/`, `apps/fmViewer.html` | [Apache License 2.0](LICENSE); its help text (`src/help/viewer-help.js`) [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt) | Same as fmIDE and fmGraph: made only from fmGraph's code (its board engine, phase V2), `src/shared/` and its own, never ExcelExporter's. A viewer made for one model carries its author's model and showcase, which are the author's (the showcase's `licence` says how visitors may reuse them). A viewer made with Excel also carries the author's workbook: ExcelExporter's output ("the workbooks you make are yours"), never its code; the viewer writes into it with `src/shared/xlsx-patch.js`, new Apache code (phase V4; test group 95 checks no line of it comes from ExcelExporter). |
| **Shared code** | `src/shared/` | [Apache License 2.0](LICENSE) | Same. ExcelExporter includes it, and it stays Apache-licensed there (among it the colour grid, `src/shared/colour-grid.js`, by the owner's decision of 27 October 2026). |
| **Build tools, tests** | `tools/`, `tests/`, `package.json`, `.github/` | [Apache License 2.0](LICENSE) | Same. |
| **ExcelExporter** | `src/excel-exporter/` (its help text too, `src/excel-exporter/help/`, also shown on the site's `/help/excel/`), `apps/ExcelExporter.html` | [ExcelExporter Licence](src/excel-exporter/LICENSE) (proprietary) | Free to use for any purpose, including at work; the workbooks you make are yours. You may not copy, redistribute, sell or modify ExcelExporter itself. |
| **File-format documentation** | `docs/file-formats.md`, `docs/format-roles.md` | [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt) | Anyone may use it to build tools that read or write `.fmide` and other fmIDE files, with credit. |
| **fmIDE's and fmGraph's help text** | `src/help/` (built into their Help panels, and fmIDE's into the site's `/help` pages) | [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt) | Anyone may reuse and adapt it — in guides, courses, translations — with credit. ExcelExporter's help text stays with ExcelExporter. |
| **The user manual** | `docs/manual/`, except its Parts 5 and 7 | [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt) | Like the help text: anyone may reuse and adapt it — in guides, courses, videos, translations — with credit. Parts 5 and 7 describe ExcelExporter and are under the Apache License 2.0, like the rest of `docs/` (the owner's decision, 19 October 2026). |
| **Other documentation** | the rest of `docs/`, `README.md`, `CLAUDE.md`, … | [Apache License 2.0](LICENSE) | Same as the code. |

The published web app contains both parts; it ships these licence files alongside them.

**Items shared in library packs** (templates, recipes and functions people share with each other, `docs/step8-community-library.md`) are not part of this repository: each pack says who made it, and its items are licensed by their author under [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt). The library is its own repository, included here as the `library/` submodule; the published site's catalogue (`/library`) shows each pack with its author and licence. Submission terms for the community library are to be reviewed with the other licence texts.

**Why this split:** an open editor and an open, documented file format let a community — and other tools — grow around fmIDE, and let people trust that their models will stay readable; ExcelExporter, which turns a model into a professional Excel workbook, is where paid editions may build later. See decision 3 in [docs/decisions.md](docs/decisions.md).

The name "fmIDE" is not licensed by any of the above.

Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).
