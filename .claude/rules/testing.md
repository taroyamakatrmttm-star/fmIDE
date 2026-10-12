---
paths:
  - "tests/**"
  - "playwright.config.*"
  - "tools/test-parts.js"
  - "src/shared/ir.js"
  - "src/excel-exporter/formulas/**"
---

# Checking a change: the calculation tests

Loaded when a session works on the tests or the calculation. The rest of "Checking a change" is in `CLAUDE.md`; which group covers what is in `tests/SPEC.md` (search it, don't read it whole). Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

- Both apps calculate on the shared IR (`src/shared/ir.js`, `compileModel` / `evaluateModel`), a pure function of the model that reads no app state; units come from it too (`unitOf`), and so do plug-to-socket links (worked out from the names, never taken from the file). `evaluateModel` keeps every period's results for the whole calculation (keyed by period), so each period is worked out once and a period shift shows the value shown for the period it reads, loops included; group 18 counts the work in Node (twice the periods, about twice the work). Test group 18 (`npm run test:ir`) pins fmIDE's values, error messages and units for every sample (`tests/snapshots/fmide-values--*`) and runs the shared IR alone in Node. Group 19 (`npm run test:excel-ir`) pins ExcelExporter's unit column for every sample (`tests/snapshots/excel-units--*`), checks every operator has an Excel spelling, and covers the panel that lists where the workbook will differ from fmIDE (`#differencesPanel`). A change to the calculation or the formula writer must not make either slower: compare `npm run bench` (fmIDE's calculation and ExcelExporter's Generate) before and after on the same machine.
- Both apps must calculate alike: test group 17 (`npm run test:agreement`) compares fmIDE's values with the recalculated workbooks for every sample model, and the rows on block-instance tabs with the IR's per-instance values. A change to how either app calculates keeps it green; a new calculation feature gets a case in `tests/fixtures/agreement/`.
