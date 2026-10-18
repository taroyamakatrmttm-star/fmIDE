# ExcelExporter's layouts: what is remembered

ExcelExporter remembers two kinds of layout. This page says what each holds, where it is kept and which one wins when a model is loaded. The same is in ExcelExporter's help, topics *What is remembered, and which layout wins* and *Modules remember their layout*.

## Mapping and Module Layouts

| | **Mapping** (a model's layout) | **Module Layouts** |
|---|---|---|
| Covers | One model's whole workbook | One module's tab (a canvas from a template), and its block instances' tabs |
| Kept | In this browser, per model; also in the model's `.fmide` document (since #176) | In this browser, per template family; a template can carry one (fmIDE's Attach Excel layout…) |
| Holds | Tabs and rows, label and blank rows, Include and Constant, row formats, the Inputs tab, scenarios and Global Cases, the Sensitivity analyses, fmGraph's scenarios, sliders and charts, ⚙ Settings → Workbook (period labels, file name) | The tab's name, row order, labels, label and blank rows, Include and Constant, formats and indents — matched by rectangle name |
| Does not hold | Your Excel style (kept once for every model) | The Inputs tab, scenarios, sensitivity, other tabs |
| Used | Every time the same model is loaded | Only when a new layout is built for a model |
| Save as a file | Layout → Export Mapping | Layout → Export Module Layouts |
| Discard | Layout → Reset Mapping to Defaults… | Forget, on the module's tab |

File → Start Over only empties the page; both kinds stay.

## Which layout wins

When a model is loaded, its layout comes from the first of these that exists:

1. The Mapping kept in this browser for this model — used as it is.
2. The Excel layout the `.fmide` document or workspace carries — used as it is.
3. Otherwise a new layout: each module's tab takes your remembered Module Layout, or the layout attached to its template, or the automatic sort; other tabs take the automatic sort.

A new layout starts with the Inputs tab off, no scenarios and no sensitivity: Module Layouts carry none. To use the same Inputs tab, scenarios and sensitivity on another computer or in another browser, keep the `.fmide` document or use Export / Import Mapping.

The file formats are in [`file-formats.md`](file-formats.md) (`fmIDE-excel-mapping`, `fmIDE-excel-module-layouts`, a document's `excelLayout`); where the browser keeps them, in [`architecture/storage.md`](architecture/storage.md).
