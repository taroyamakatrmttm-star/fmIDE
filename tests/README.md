# Tests

Coming next: the automated test suite. Until now the checks ran by hand during development; they will live here as one command:

- **Excel output** — generate workbooks from sample models, then check every cell's formula, value and format, and recalculate with LibreOffice against reference results.
- **Security** — malicious sample files must never run script.
- **File formats** — current, legacy, newer-version and wrong-kind files behave as documented.
- **UI flows** — sorting, Inputs tab, scenarios, right-click menu, format dialogs.

Sample models go in `tests/fixtures/`.
