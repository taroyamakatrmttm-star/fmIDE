# Format roles

All formatting — on fmIDE's canvas and in the Excel workbook — is defined in one place: **format roles** in fmIDE's Formats manager (File → Format Presets). Each role is a format preset with a reserved name. Roles can be edited but not deleted, and they travel inside system and workspace exports, which is how ExcelExporter reads them. A file without them gets the built-in defaults — the `FORMAT_ROLES` table in `src/shared/format-roles.js`, the one source both apps build from (fmIDE seeds its role presets from it; ExcelExporter falls back to it).

| Role | Used on | Covers |
|---|---|---|
| Inputs | Canvas + Excel | Hard-coded numbers: input rectangles, scenario values, and the cells you type on the Scenarios tab. |
| Calculations | Canvas + Excel | Formulas: rectangles fed by an arrow, and every calculated cell in Excel. Blank by default (the normal rectangle look). |
| Links | Excel | Formulas that only pull a value from another sheet (e.g. a row linked to the Inputs tab). |
| Headers | Excel | Each sheet's title and column-header row. |
| Section Headers | Excel | The INPUTS / CALCULATIONS / OUTPUTS bands. |
| Labels | Excel | Custom / label rows and group headers (unless the row has its own format in ExcelExporter). |
| Notes | Excel | Notes, the Period # counter, scenario numbering and other helper text. |

## Who decides what

| Property | Rectangle has its own 🎨 format | No own format |
|---|---|---|
| Fill, font colour, border | Role — or the rectangle's own if **"Use this fill, font colour & border in Excel too"** is ticked | Role |
| Number format, weight, font size | Rectangle's own | Role |

**Excel-only settings of a style:** *Excel border sides* (Top / Bottom / Left / Right; none ticked = no border in Excel — the canvas always draws the full outline) and *Use Excel's default font size*.

**Input rectangle** (one rule for both apps, in `src/shared/input-rule.js`): no incoming arrow, or a single incoming arrow from an operator or period shift that nothing feeds (e.g. a socket operator with nothing plugged in).
