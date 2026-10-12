---
paths:
  - "src/fmide/js/02-uom-format-roles.js"
  - "src/fmide/js/11-templates-format-presets.js"
  - "src/excel-exporter/js/03*.js"
  - "src/shared/format-roles.js"
  - "docs/format-roles.md"
  - "tests/4-format-roles.spec.js"
---

# Format roles and the Excel style

Loaded when a session works on fmIDE or ExcelExporter. Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

## Format roles and the Excel style (`docs/format-roles.md`)

Since step 11a (decision 9) the look has two owners. **fmIDE decides the canvas look and the number formats; ExcelExporter decides how every cell looks in Excel.** Do not let an Excel-only setting back into fmIDE, and do not let a rectangle's canvas colours, fonts or borders reach Excel.

- **fmIDE's format roles** (Formats manager, File → Format Presets): `Inputs` and `Calculations`, reserved-name presets that style input and calculated rectangles on the canvas (defaults `FORMAT_ROLES` in `src/shared/format-roles.js`); a rectangle's own 🎨 format replaces its role's look. They travel in system and workspace files. The format window and the Formats manager say that only number formats go to Excel (`.excel-look-note`).
- **What reaches Excel from fmIDE: the number format only** — the rectangle's own if it has its own format, else its canvas role's (`modelNumberFormat` in ExcelExporter's `03-format-roles-app-state.js`, which checks it); else ExcelExporter's fallback number format.
- **ExcelExporter's Excel style** (section 2; defaults `EXCEL_ROLES`; the panel `03b-excel-style.js`): seven roles — Inputs, Calculations, Links, Headers, Section Headers, Labels, Notes — each with fill (or none), font colour (or automatic), bold, size in points (blank = the workbook's default) and border (style, colour, sides). The person's own, for every model: saved in the browser (`fmide-excel-style`), Export / Import Excel Style (`fmIDE-excel-style` file), Reset to Defaults. Everything read goes through `cleanExcelStyle`.
- **A row's own format** (the owner's decision): ExcelExporter's Tree view can give a row its own format and label indent for that layout (`row.style`, `row.indent`, mapping file v2; read through `cleanRowFormat` / `rowIndent`), laid over the Excel style with `withRowFormat`, with **Reset to the Excel style**; its border is on the sides it names (`border.sides`, `cleanRowBorder`; left out = all four, as older files; the editors' `rowBorderField`: Top, Bottom, Left, Right and the colour).
- **Older files**: the five Excel-only role presets and `keepColours`, `border.sides`, `font.excelDefaultSize` in any style are dropped by the upgrade step (system v7, workspace v7, module v5, format presets v2); `fm.setStyle` drops them too.
