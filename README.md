# fmIDE

A visual logic builder for financial models, and a companion that turns those models into live-formula Excel workbooks.

| App | File | What it does |
|---|---|---|
| **fmIDE** | `apps/fmIDE.html` | Build a model as a graph of rectangles (values), operators, aliases, period shifts and blocks, across canvases and periods. |
| **ExcelExporter** | `apps/ExcelExporter.html` | Load an fmIDE system or workspace export and generate an `.xlsx` with real formulas: tabs, Inputs tab, scenarios and global cases, vertical-block vintages, format roles. |

Both are single self-contained HTML files with no external dependencies: open them in any modern browser, online or offline. Nothing is uploaded anywhere.

## Using them

1. Open `apps/fmIDE.html`, build a model, then **File → Save System** or **File → Export Workspace**.
2. Open `apps/ExcelExporter.html`, load that file, arrange tabs and rows, and click **Generate & Download .xlsx**.

## Repository layout

```
apps/    the two apps (edit these; Git keeps the history, so no version numbers in file names)
docs/    reference notes: file formats, format roles, automation API, decisions
tests/   automated checks (next step — see tests/README.md)
```

## Docs

- [`docs/decisions.md`](docs/decisions.md) — agreed and open product decisions, and the build order
- [`docs/file-formats.md`](docs/file-formats.md) — every JSON file type, its version, and how to change a format safely
- [`docs/format-roles.md`](docs/format-roles.md) — how cell and rectangle formatting is defined in one place
- [`docs/fmIDE-automation-api.md`](docs/fmIDE-automation-api.md) — the `window.fm` actions used by the ribbon, shortcuts and macros
- [`CHANGELOG.md`](CHANGELOG.md) — notable changes

## Licence

All rights reserved. This repository is private; a licence will be chosen before the first public release (see `docs/decisions.md`).
