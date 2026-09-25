# Licensing

fmIDE is **open core**: the editor and the file format are open, so anyone can use, study, build on and share them; ExcelExporter is free to use but proprietary. Copyright 2026 Taro Yamaka.

| What | Where | Licence | In short |
|---|---|---|---|
| **fmIDE** (the editor) | `src/fmide/`, `apps/fmIDE.html`, `src/site/` | [Apache License 2.0](LICENSE) | Use, change and share it freely, commercially too; keep the copyright and licence notices ([NOTICE](NOTICE)). |
| **Shared code** | `src/shared/` | [Apache License 2.0](LICENSE) | Same. ExcelExporter includes it, and it stays Apache-licensed there. |
| **Build tools, tests** | `tools/`, `tests/`, `package.json`, `.github/` | [Apache License 2.0](LICENSE) | Same. |
| **ExcelExporter** | `src/excel-exporter/`, `apps/ExcelExporter.html` | [ExcelExporter Licence](src/excel-exporter/LICENSE) (proprietary) | Free to use for any purpose, including at work; the workbooks you make are yours. You may not copy, redistribute, sell or modify ExcelExporter itself. |
| **File-format documentation** | `docs/file-formats.md`, `docs/format-roles.md` | [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt) | Anyone may use it to build tools that read or write `.fmide` and other fmIDE files, with credit. |
| **Other documentation** | the rest of `docs/`, `README.md`, `CLAUDE.md`, … | [Apache License 2.0](LICENSE) | Same as the code. |

The published web app contains both parts; it ships these licence files alongside them.

**Why this split:** an open editor and an open, documented file format let a community — and other tools — grow around fmIDE, and let people trust that their models will stay readable; ExcelExporter, which turns a model into a professional Excel workbook, is where paid editions may build later. See decision 3 in [docs/decisions.md](docs/decisions.md).

The name "fmIDE" is not licensed by any of the above.

Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).
