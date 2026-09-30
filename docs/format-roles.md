# Format roles and the Excel style

Since step 11a (decision 9 in `docs/decisions.md`), the look of a model has two owners:

- **fmIDE decides how rectangles look on the canvas**, and their **number formats**.
- **ExcelExporter decides how every cell looks in the workbook**, with the person's own **Excel style**.

fmIDE says *what a rectangle is* (an input or a calculation, by the shared input rule) and how its numbers are written (a percentage, a currency, how many decimals). How cells look in Excel — fills, fonts, borders — is ExcelExporter's.

## fmIDE: the canvas roles

In fmIDE's Formats manager (File → Format Presets), two presets are **roles**. Each is an ordinary format preset with a reserved name; roles can be edited but not deleted. The built-in defaults are the `FORMAT_ROLES` table in `src/shared/format-roles.js` (fmIDE only since step 11a).

| Role | Covers |
|---|---|
| Inputs | Input rectangles: the numbers you type |
| Calculations | Rectangles fed by an arrow. Blank by default (the normal rectangle look) |

A rectangle's own 🎨 format replaces its role's look on the canvas. Presets travel inside system and workspace files.

**What reaches Excel from fmIDE: the number format only** — the rectangle's own 🎨 number format if it has its own format, otherwise its role's (Inputs or Calculations, as the file's presets say). ExcelExporter reads it through `modelNumberFormat` (checked: a known kind, 0–10 decimals, a short currency symbol). A rectangle's canvas fill, font, weight, size and border never reach Excel.

**Input rectangle** (one rule for both apps, in `src/shared/input-rule.js`): no incoming arrow, or a single incoming arrow from an operator or period shift that nothing feeds (e.g. a socket operator with nothing plugged in).

## ExcelExporter: the Excel style

Section 2 of ExcelExporter holds the **Excel style**: seven roles, each with a fill (or none), a font colour (or automatic), bold, a font size in points (blank = the workbook's default, normally 11) and a border (none, solid, dashed or dotted; its colour; which sides — top, bottom, left, right). The built-in defaults are `EXCEL_ROLES` in `src/excel-exporter/js/03-format-roles-app-state.js`.

| Role | Covers |
|---|---|
| Inputs | Hard-coded numbers: input rows, scenario values, and the cells you type on the Scenarios tab |
| Calculations | Formulas: every calculated cell. Blank by default |
| Links | Formulas that only pull a value from another sheet (a row linked to the Inputs tab, or a rectangle fed through a plug or an alias from another canvas). Link comes before Inputs: an input row whose numbers live on the Inputs tab is a Link on its own tab |
| Headers | Each sheet's title and column-header row |
| Section Headers | The INPUTS / CALCULATIONS / OUTPUTS bands |
| Labels | Custom / label rows and group headers (unless the row has its own format) |
| Notes | Notes, the Period # counter, scenario numbering and other helper text |

The Excel style is **the person's own**: it is saved in the browser (IndexedDB, key `fmide-excel-style`) and used for every model loaded there, whoever made the model. **Export Excel Style** writes it as a file (`fmIDE-excel-style`, `docs/file-formats.md`), **Import Excel Style** reads one (for example on another computer), and **Reset to Defaults** brings back the built-in look. Everything read from storage or a file is checked (`cleanExcelStyle`): colours must be `#rrggbb`, sizes are bounded, border styles and sides come from their lists, unknown roles are ignored.

## Who decides what in the workbook

| Property | Decided by |
|---|---|
| Fill, font colour, bold, font size, border | The row's role in the Excel style |
| Number format | fmIDE: the rectangle's own number format, else its Inputs / Calculations format; else ExcelExporter's fallback number format (section 2) |

**A row's own format in ExcelExporter** (the owner's decision): in the Tree view, 🎨 on a row gives that row, in that workbook layout only, its own fill, font colour, bold, border and optionally number format. It goes over everything above for that row, and **Reset to the Excel style** takes it off. It is saved with the ExcelExporter layout (mapping file version 2), never in the model. The label's indent is set there too.

## Files from before step 11a

Older files carried the Excel look in fmIDE: five more roles (Links, Headers, Section Headers, Labels, Notes) and, in any style, "Use this fill, font colour & border in Excel too" (`keepColours`), *Excel border sides* (`border.sides`) and *Use Excel's default font size* (`font.excelDefaultSize`). They still open; the upgrade step drops those roles and settings (system v7, workspace v7, module v5, format presets v2). Everything else in every style — the canvas look and the number formats — stays. A workbook made from such a file uses the person's Excel style, not the file's old settings.

---

This document is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0.txt) (CC BY 4.0): anyone may use it — for example to build tools that read or write fmIDE files — with credit to fmIDE (Copyright 2026 Taro Yamaka). See [LICENSING.md](../LICENSING.md).
