# How the guidance for Claude Code sessions is organised

Since 12 October 2026 (the owner's request: less read for an ordinary small change, nothing lost), the guidance that was one 128 KB `CLAUDE.md` is in three places:

- **`CLAUDE.md`** — always loaded. What the project is, how we work, how the code is built, the licences, the non-negotiable rules, the rules that apply wherever a change is made, where the details are, the build order's status and how to check a change.
- **`.claude/rules/*.md`** — each starts with `paths:`; Claude Code loads it only when a session reads a file matching one of them. Module-specific rules: fmIDE's areas, fmGraph, ExcelExporter, shared code, pointer input, format roles, file formats, the site, the calculation tests.
- **`docs/architecture/`** — reference read on purpose: `test-groups.md` (what each test group covers), `storage.md` (every database and key), `build-order.md` (the decisions and the full build order), and this file.

Every line of the old `CLAUDE.md` was moved word for word, each to exactly one place, apart from the four below. The old file is in Git's history (the commit before this change).

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

**Added** (new, not moved): "How we work" items 7 (work narrowly, widen on evidence) and 8 (raise improvements — the owner's standing request of 12 October 2026); "Rules that apply wherever you work" (one-line summaries of rules stated in full in the rules files, plus the input-rectangle rule moved there whole); "Where the details are"; a short build-order status (the full text in `build-order.md`); in "Checking a change", **Which tests** and **Say what ran**.

## Flagged for the owner's decision (left as they were)

1. Non-negotiable rule 1 says "the planned community library": the library exists since step 8.
2. `build-order.md`, step 10 says "in progress"; the status says done but for H4c.
3. `build-order.md`, step 15 says "a live link later"; G3b sends boards back to fmIDE by themselves — is a live link still planned?
4. `README.md`'s "how to change the apps" still says `npm test` after each build: it is for people, so it was left; should it follow the new commit rule?
5. `docs/architecture/test-groups.md` repeats in short what `tests/SPEC.md` says in full; one could go, or stay as the short index it is.
6. The build-order status paragraph (`build-order.md`, the paragraph after step 17) repeats the list above it; it could be cut to what the list doesn't say.

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
