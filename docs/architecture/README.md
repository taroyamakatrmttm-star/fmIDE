# How the guidance for Claude Code sessions is organised

Since 12 October 2026 (the owner's request: less read for an ordinary small change, nothing lost), the guidance that was one 128 KB `CLAUDE.md` is in three places:

- **`CLAUDE.md`** — always loaded. What the project is, how we work, how the code is built, the licences, the non-negotiable rules, the rules that apply wherever a change is made, where the details are, the build order's status and how to check a change.
- **`.claude/rules/*.md`** — each starts with `paths:`; Claude Code loads it only when a session reads a file matching one of them. Module-specific rules: fmIDE's areas, fmGraph, ExcelExporter, shared code, pointer input, format roles, file formats, the site, the calculation tests.
- **`docs/architecture/`** — reference read on purpose: `storage.md` (every database and key), `build-order.md` (the decisions and the full build order), and this file.

Every line of the old `CLAUDE.md` was moved word for word, each to exactly one place, apart from the four below. The old file is in Git's history (the commit before this change). Later the same day the owner's decisions (below) reworded a few lines and dropped the test-group list, `tests/SPEC.md` covering it.

**Keeping it this way:** a rule that must hold whichever files a change touches goes in `CLAUDE.md` (in full, or as a line naming the file that has it in full); a rule about one module goes in that module's rules file, whose `paths` must name the files it is about; long reference goes in `docs/architecture/`. When a rules file's module gains a file, add it to `paths`.

## The four lines changed on purpose (originals kept here)

**1. The opening paragraph** — rewritten to say the file is short on purpose and where the rest is. Was:

> Guidance for Claude Code sessions working in this repository. Read this first; the linked docs are the source of truth, so when they change, keep this file in step.

**2. "How we work", item 3** — the commit rule the owner approved on 12 October 2026: the tests the change reaches before a commit, the whole suite on GitHub for every pull request. Was:

> 3. **Build and test.** Edit `src/` → `npm run build` → `npm test` before every commit (see "Checking a change"). New behaviour gets a test; a bug fix gets a test that fails without the fix; a test changed on purpose is named in the commit message; a failing test is reported and fixed, never weakened or skipped.

**3. "How we work", item 4** — "this file" now also means the matching rules file. Was:

> 4. **Keep the docs in step, in the same pull request:** a change people will notice adds its What's new entry (`src/help/fmide-whats-new.js`, or ExcelExporter's `excel-whats-new.js`); this file (when structure, rules, storage, file formats or the build order change), the relevant `docs/*.md` (a brief gets a short "how it turned out" when its phase is done), `tests/SPEC.md` and `tests/README.md` for new tests, `README.md` for anything a user does differently, and `CHANGELOG.md` for notable changes to the apps.

**4. "Checking a change", first line** — the same commit rule; its last sentence kept as it was. Was:

> Workflow: edit `src/` → **`npm run build`** → **`npm test`**. Run **`npm test`** before every commit (setup and details: `tests/README.md`). It runs offline, every group in `tests/SPEC.md`, and must pass against the apps as they are.

**Added** (new, not moved; confirmed by the owner): "How we work" items 7 (work narrowly, widen on evidence) and 8 (raise improvements — the owner's standing request of 12 October 2026); "Rules that apply wherever you work" (one-line summaries of rules stated in full in the rules files, plus the input-rectangle rule moved there whole); "Where the details are"; a short build-order status (the full text in `build-order.md`); in "Checking a change", **Which tests** and **Say what ran**.

## The owner's decisions (12 October 2026)

1. **Out-of-date wording updated:** non-negotiable rule 1 now says "the community library" (it was "planned"); in `build-order.md`, step 10 reads "✅ but for H4c" (it was "in progress"), and step 15 says the live link — fmIDE's edits reaching an open fmGraph straight away — is still a later idea (it said "a live link later").
2. **`README.md` follows the new commit rule:** "how to change the apps" says to run the tests the change reaches; GitHub runs the whole suite.
3. **The test-group list dropped** (`docs/architecture/test-groups.md`): `tests/SPEC.md` covers every group in full. Its lines carrying code facts found nowhere else were moved word for word first: placing nodes, Add Many Rectangles, Next / Previous Canvas, long messages and resizable windows to `.claude/rules/fmide-canvas.md`; real modules to `.claude/rules/shared.md`; zoom (with the rule on `zoomGroupAdded` in tests) to `.claude/rules/fmide-zoom.md`.
4. **The build-order status paragraph shortened** to what the list above it doesn't say (the order chosen, the deferred and known items, the requests after step 15, the checker pointer).
5. **"How we work" items 7 and 8 confirmed.**

## How much is loaded (measured 12 October 2026)

Measured with Claude Code 2.1.296 run headless (`claude -p --output-format json --allowedTools=Read`) in two copies of the repository, one with the old `CLAUDE.md` and one with this organisation. Each run read the first 5 lines of one file. The figure is the largest context of the run (input, cache written and cache read tokens). A run in an empty folder, with no project instructions, came to 32,905.

| Task (file read) | Old | New | Rules files loaded (new) |
|---|---|---|---|
| none | 83,146 | 39,506 | — |
| fmIDE help text (`src/help/fmide-whats-new.js`) | 83,540 | 42,638 | fmide-help |
| fmIDE templates (`11-templates-format-presets.js`) | 83,447 | 43,301 | format-roles, fmide-templates |
| fmIDE zoom (`07b-zoom.js`) | 83,536 | 42,418 | pointer-input, fmide-zoom |
| fmGraph (`05-render.js`) | 83,492 | 44,097 | fmgraph |
| ExcelExporter menus (`09e-menus-and-settings.js`) | 83,507 | 43,034 | excel-exporter |
| shared IR (`src/shared/ir.js`) | 83,560 | 44,889 | fmide-functions-operators, testing, shared |
| a test file (`tests/47-fmgraph.spec.js`) | 83,560 | 44,896 | testing, fmgraph |
| build tool (`tools/build-help.js`) | 83,506 | 44,333 | fmide-help, build-and-site |

In the old copy no rules file loaded; in the new one each run loaded exactly the files whose `paths` name the file read (the model listed them). The project's own instructions went from about 50,200 tokens to about 6,600 with nothing read, and 9,500–12,000 for these tasks. A session that reads files from several areas loads each area's rules file once. To compare again after a change, run the same in two copies.

## Phase 2: which tests a change reaches (12 October 2026)

The owner's request: replace a session's judgement of "the tests the change reaches" with a dependable, checked map, so a small change runs fewer tests locally without losing safety; GitHub keeps running the whole suite on every pull request, and CI is unchanged.

**What was built.** `tools/test-impact.js` and `npm run test:changed` (details in `tests/README.md`, "Which tests a change reaches"); `appSources()` in `tools/build.js` (the build's own list of each app's source files; the apps it writes are unchanged); test group 74. The owner's decisions: the map is **worked out** (source → app from the build, a module → the modules importing it, test → what it loads read from the test and its helpers, with a short written part at the top of the tool), not written by hand; the build's list comes from an export of `tools/build.js`; documentation runs smoke only, unless a test reads it.

**Measured** on recent merged pull requests: each one's changed files run through today's map (`node tools/test-impact.js --files …`), test time from `tests/test-durations.json` (seconds on GitHub's machine, one file after another; locally Playwright runs several at once). "Guards" are the test files the pull request itself added or changed; every one was picked, and every one would have been picked from the pull request's other files alone (its source changes), not only because the test file itself changed.

| Pull request | What changed | Files | Picked | Time (of 2,260 s) | Guards picked |
|---|---|---|---|---|---|
| #135 | guidance: the owner's decisions | 9 | smoke only (1 of 77) | 2 s | no test changed |
| #134 | guidance: CLAUDE.md split | 22 | smoke only | 2 s | no test changed |
| #133 | fmGraph's fixed scale (group 73) | 25 | all — `package.json` (a new npm script) and fmGraph's board format | 2,260 s | yes (4) |
| #132 | fmIDE: the input rule on a phone | 17 | 74 of 77 | 2,230 s | yes (2) |
| #131 | step 17 P3, ExcelExporter on a phone | 21 | all — `package.json` | 2,260 s | yes (1) |
| #130 | step 17 P2b, fmIDE on a phone | 15 | all — `package.json` | 2,260 s | yes (1) |
| #129 | step 17 P2a, fmIDE on a phone | 19 | all — `package.json` | 2,260 s | yes (2) |
| #128 | step 17 P1b, fmGraph on a phone | 25 | all — `package.json`, `src/shared/phone.*` | 2,260 s | yes (2) |
| #127 | step 17 P1a, fmGraph on a phone | 22 | all — `package.json`, `src/shared/phone.*` | 2,260 s | yes (1) |
| #125 | step 17's brief | 3 | smoke only | 2 s | no test changed |
| #124 | ExcelExporter: apostrophes in tab names | 7 | 50 of 77 | 1,650 s | yes (2) |

What it shows: documentation and guidance changes go from the whole suite to the smoke test; an ExcelExporter-only change saves about a quarter; an fmGraph-only change runs 29 of 77 files (about 720 s); a pull request adding a test group runs everything, because its new npm script changes `package.json`. An fmIDE-only change picks 71 of 77 files (about 2,130 s), because nearly every test file names fmIDE somewhere (a file kind such as `fmIDE-excel-module-layouts`, a test's title), and any mention counts. Measured alongside: counting only the tests that open fmIDE (`openFmIDE`, `openApp(…, 'fmIDE')`, `fmIDE.html`, its helper) would pick 54 files (about 1,665 s).

**Afterwards (the owner's decision, 12 October 2026, after #136 merged):** fmIDE counts only where a test can open it — its opener and helper, its page, `openApp` with its name, the other apps' Back to fmIDE button and the address they use for it (`fmide-address`), and the site; ExcelExporter and fmGraph still count wherever they are named. An fmIDE-only change now picks 55 of 77 files (about 1,700 s; group 68 counts through Back to fmIDE); #132 picks 68 instead of 74; the others above are unchanged, and every guard is still picked. Group 74 checks an fmIDE-only change picks the groups that open fmIDE and not those that only name it. **Then (the owner's decision, 12 October 2026, after #137 merged):** a `package.json` change only to `test:` shortcuts — added, changed or taken out, each just `playwright test` and test files — runs the test files they name instead of every test; `test`, `test:changed` and `test:update-snapshots` (which rewrites the snapshots) still run every test, and so does any other change to the file. Measured again, reading `package.json` at each pull request's own commits (`--base`, `--head`): #131 picks 70 files, #130 and #129 57 (all three ran every test before); #133 still runs every test (fmGraph's board file format), #136 too (`test:changed` added, and `tools/build.js`); every guard still picked. A changed shortcut reaches every file it names, not only the ones added (adding group 73 to `test:fmgraph` picks all 15 of fmGraph's files).
