# Decisions

| # | Decision | Status | Outcome |
|---|---|---|---|
| 1 | Where the code lives | Agreed (24 Sep 2026) | Private Git repository on GitHub |
| 2 | First platform | Agreed (24 Sep 2026) | Installable web app (PWA) first, then desktop via Tauri |
| 3 | Open source or not | Open — decide by the first public release | Recommendation: open core (apps and file formats open, hosted/paid services closed) |

Decision 3 can wait: going from closed to open later is easy, but open to closed is effectively irreversible. The repository stays private until it is decided.

## Build order

1. Repository (this) ✅
2. Permanent test suite — one command that runs every check, on every change ✅ (`npm test`, see `tests/README.md`)
3. Split each app into modules (still building to single files), protected by the tests
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files
5. Publish the web app; then formula IR and plugins, community library, touch support

## Phase 0 (hardening) — status

- ✅ Text from files is escaped (safe to share files)
- ✅ Built-in Excel writer — no external library; confirmed in Windows and iPhone Excel
- ✅ File-format versions and migrations in both apps
- ✅ Warning when autosave fails
- ⬜ Storage (build step 4)
- ⬜ Modules (build step 3)
