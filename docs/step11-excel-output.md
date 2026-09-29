# Build step 11 — the Excel look and layout belong to ExcelExporter

**Status:** queued; starts after step 10 is finished. Nothing here is built yet. Each phase gets its own plan, approved by the owner before any change.

**Goal:** stop setting up the same Excel layout again and again when modules are reused, and keep a clean line between the two apps: **fmIDE says what things are** (this is an input, a calculation, a percentage); **ExcelExporter decides how they look and where they sit in Excel**.

**What is there today:**

- ExcelExporter saves one layout per whole model (`signatureOf` in `src/excel-exporter/js/03-format-roles-app-state.js`), keyed by every canvas and rectangle id. Inserting a module gives its rectangles new ids, so a model built from reused modules never finds a saved layout and starts again from the automatic sort. The layout also lives only in that browser.
- The Excel look is set in fmIDE: the format roles (`src/shared/format-roles.js`) include five Excel-only roles (Links, Headers, Section Headers, Labels, Notes), the Inputs and Calculations roles decide both the canvas and Excel, and a rectangle's own 🎨 format has Excel-only settings (Excel border sides, "Use Excel's default font size", "Use this fill, font colour & border in Excel too").

**Decided (29 Sep 2026, decision 9 in `docs/decisions.md`):**

- **Separation of concerns.** The model holds the calculation and what things mean; each output owns how it looks. fmIDE does not store Excel rows, blank rows or Excel formatting — a later output (Python, a report) would otherwise have to carry and ignore them. Reading order or grouping that means something to *every* output may come to fmIDE later, only once a second output exists.
- **The Excel look moves to ExcelExporter**, as the person's own Excel style: the five Excel-only roles, how inputs and calculations look in Excel (fill, font colour, border), Excel border sides and Excel's default font size. The per-rectangle "in Excel too" tick box goes; ExcelExporter's own per-row format does that job. **Stays in fmIDE:** the canvas look (the Inputs and Calculations roles and a rectangle's 🎨 format, canvas only), the input rule, and **number formats** (a percentage is meaning, not look; ExcelExporter uses it and a row may still override it).
- **This replaces the rule** "formatting is defined in one place, the format roles in fmIDE" with: the canvas look lives in fmIDE, the Excel look lives in ExcelExporter. `docs/format-roles.md` and `CLAUDE.md` change with phase 11a.
- **Licences:** the owner agrees that the Excel-only parts of `src/shared/format-roles.js` (Apache) move into ExcelExporter (proprietary).
- **Old files keep opening**; their Excel-only settings are dropped by the upgrade step (one version up, as always), with no offer to adopt them. The calculation, canvas look, templates, functions and number formats come through untouched. Workbooks from old files use the default Excel look until the person sets their Excel style once. Packs in the community library that carry the old fields are handled with the checker in 11a (accepted for now, or re-saved).

## Phases

One pull request each, each approved before the next.

- **11a — the Excel style moves to ExcelExporter.** Its own Excel style (stored in its browser storage, exportable as a file), the file-format upgrade that drops the Excel-only settings (new versions of the files that carry format roles or rectangle styles, old-version samples and tests), fmIDE's Formats manager and rectangle format window lose their Excel-only settings, the docs and help text follow.
- **11b — layouts remembered per module (layer 1).** ExcelExporter keeps a tab's layout (row order, blank rows, labels, sections, indents) under the module it came from — the template family a linked canvas records (`canvas.template.family`) — and applies it to any model containing that module, matching rows by rectangle name (as "Update this canvas" does). New rectangles go where the automatic sort puts them; missing ones are dropped; a layout saved for the whole model still wins. fmIDE does not change. Export / Import of the layouts to move them between computers.
- **11c — optional: layouts and Excel styles travel with modules (layer 2).** A sealed attachment, labelled by the output it belongs to (`excel`), that fmIDE stores and copies with the module but never reads, so it can go into library packs. A pack's Excel style is only a suggestion: the person's own style always wins, and ExcelExporter offers to use it. Needs a file-format change and the library checker's rules; decided on after 11b.
