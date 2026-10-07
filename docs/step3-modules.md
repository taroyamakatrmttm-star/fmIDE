# Build step 3 — split the apps into source files

**Goal:** make both apps easy to work on — smaller files, one copy of shared logic — while users still get two single, self-contained HTML files that behave exactly as today.

Today each app is one HTML file whose script is a single wrapped function: `apps/fmIDE.html` (~9,000 lines) and `apps/ExcelExporter.html` (~4,600 lines). Both already mark their sections with banner comments (`// ---------- … ----------` / `// ===== … =====`), which are the natural places to split. Four pieces of logic exist in both apps in slightly different forms: the escaping helpers, the input-rectangle rule (`feedsNothing` / `isInputRect` in fmIDE, `feedsNothing` / `isInputNode` in ExcelExporter), the format-role defaults (`FORMAT_ROLES` / `DEFAULT_ROLE_STYLES`) and the file-format tables and reader.

## Ground rules (every phase)

- **No behaviour change.** `npm test` passes after every commit. **Never** run `npm run test:update-snapshots` in this step — a changed snapshot means behaviour changed.
- **`apps/*.html` stay what users open**: single self-contained files, no runtime dependencies, readable (no minification). From phase 3a on they are **generated** from `src/` by `npm run build` — never edited by hand.
- **Keep every public surface unchanged:** `window.fm`, the global `XLSX` in ExcelExporter, element ids, file formats, `localStorage` keys. The tests rely on them.
- **The build needs only Node** (no npm packages for the build itself) and must work on Windows: use `path.join`, no shell-specific commands.
- **Work phase by phase.** At the end of each phase: stop, summarise, push, open a pull request, and wait for approval before starting the next.

## Phase 3a — Mechanical split, byte-identical output

Cut each app into pieces **without changing a single character of the output**.

```
src/
  fmide/
    index.html          the page with markers where the style and script go
    styles.css
    js/01-….js …        the script, cut at the existing banner sections, in order
  excel-exporter/
    index.html
    styles.css          (ExcelExporter has two style blocks and two scripts —
    js/…                 keep them as separate ordered pieces)
tools/
  build.js              assembles apps/*.html: page + styles + script pieces, in order
```

- The pieces are plain fragments of the one wrapped function — no `import`/`export`, no change in meaning. Joining them in order must recreate the original script exactly.
- Aim for pieces of roughly 300–800 lines; name them with an order number and what they contain (e.g. `07-file-formats.js`, `12-macro-builder.js`).
- **Acceptance:** `npm run build` regenerates `apps/fmIDE.html` and `apps/ExcelExporter.html` **byte-for-byte identical** to the committed files (`git diff --exit-code apps/` is empty), and `npm test` passes.
- **Guard against drift:** add a CI step that runs the build and then `git diff --exit-code apps/`, so a generated file can never disagree with `src/`.
- Only **after** byte-identity is proven, in a separate commit: add a short comment at the top of each generated file — "Generated from src/ by `npm run build` — edit src/, not this file" — and update README, CLAUDE.md and `docs/decisions.md` with the new workflow (edit `src/` → `npm run build` → `npm test`).

## Phase 3b — Shared code in one place

Move logic that both apps duplicate into `src/shared/`, included into **both** apps by the build (still plain fragments inside each app's wrapped function — no module plumbing).

Candidates, one per commit, in this order:

1. Escaping and validation helpers (`escapeXml`/`esc`, `safeNum`, `safeColor`).
2. The input-rectangle rule (`feedsNothing` + "is this rectangle an input").
3. Format-role defaults: one table of the seven roles, their default styles, and descriptions.
4. File-format tables and the reader core: the shared kinds (`system`, `fmIDE-workspace`), kind inference, the version check and step-by-step upgrades. ExcelExporter additionally owns `fmIDE-excel-mapping`; fmIDE owns its other kinds.

For each candidate, **first list every difference** between the two apps' versions (names, parameters, what they return, edge cases). Where they genuinely differ in behaviour, keep each app's behaviour — make the shared version take a parameter — and say so in the commit message. If a difference looks like a bug in one app, stop and ask rather than fix it silently.

- **Acceptance:** each commit passes `npm test` with snapshots unchanged; the two apps now read these rules from one source; the comments that say "keep in sync with the other app" are replaced by a note pointing at `src/shared/`.

## Phase 3c — real modules

Converting to proper `import`/`export` modules (so pieces can be unit-tested and loaded by plugins) matters for the plugin work. It was left out of step 3 (3b noted in `docs/decisions.md` which pieces would be easiest first) and started after step 15, at the owner's request (7 October 2026).

**Decided (the owner, 7 October 2026, the recommended choices):**
- The four pieces `docs/decisions.md` lists, in four phases, one pull request each: **3c-1** the build reads modules, and the shared files Node runs are modules (the calculation and the file readers); **3c-2** the browser's shared pieces (storage, pointer input, the Help panel, the update notice, the file boxes); **3c-3** ExcelExporter's Excel writer and fmIDE's expression parser; **3c-4** ExcelExporter's formula building. The parts of the apps that read the open model or build the page stay fragments.
- **The apps stay single files, byte-for-byte as they were**: the build takes the module syntax out. Nothing a person uses changes, so no What's new entry.
- Each phase is merged once its pull request is green, without waiting between phases; a major decision found on the way is put to the owner first.

**The form** (the build accepts no other, so it never needs a parser): `import { a, b } from './other.js';` on one line, at the start of the line; `export function` / `export const` / `export let` / `export class` before a top-level declaration. A folder is a module folder when its `package.json` says `"type": "module"` (the nearest one at or below `src/`), so Node reads its `.js` files as modules too.

### 3c-1 — how it turned out

- `tools/build.js`: `isModuleFile`, `moduleFragment` (the import lines left out whole, the `export ` taken off; anything else of the kind a `ModuleError` naming file and line) and `checkImports` (each name imported is exported by that file, which the app includes somewhere — the apps share one scope, so where does not matter). `apps/` came out byte-for-byte the same.
- `src/shared/package.json` (`"type": "module"`). Ten files became modules: `escaping`, `format-roles`, `operators`, `uom`, `input-rule`, `functions`, `ir`, `file-formats`, `library-pack`, `fmide-files`. Each exports the names something else uses — another shared file, an app, a tool or a test — and keeps the rest to itself; the imports are exactly what each uses from the others (`input-rule` from `operators` and `functions`; `functions` from `operators` and `uom`; `ir` from four files; `fmide-files` from `file-formats`, `functions` and `library-pack`). Before, nothing said so: the pack checker and the tests listed the files to join, in order, and the names to pull out.
- The browser's five pieces are in the module folder already, with no imports or exports yet (3c-2).
- Node loads them as they are: `require()` of a module needs Node 22.12 or later (20.19 on the older line). The pack checker (`tools/check-pack.js`), the help pages' and the catalogue's builders and test groups 17–20, 31 and 32 require them instead of joining their text in a sandbox (`vm`); the help text, plain data that reads the operator catalogue, is still read in a sandbox, given `OPERATORS`. The checker's reports are unchanged (its tests, groups 23 and 24, and the sample packs' reports compared before and after).
- New test group 64 (`npm run test:shared-modules`).

### 3c-2 — how it turned out

- The browser's five pieces export what the apps use: `store` (`createStore`), `pointer-input` (`onPress`, `followPointer`, `pressDefault`, `isEmulatedMouse`, `waitForHold`, `cancelFingerActions`, `touchPointersDown`), `help-panel` (`createHelpPanel`, `cleanHelpSize`, `cleanNewsSeen`), `update-notice` (`watchForUpdates`), `file-picker` (`letAnyFileBePicked`). None needs another shared file, so none imports. Every file in `src/shared/` is now a module; `apps/` again came out byte-for-byte the same.
- They reach for the page when they load (`pointer-input` listens on `window` at once), so Node can't load them: group 64 imports each as a module in a page instead. Group 43, which tries the Help panel in an empty page, loads it as a module too (changed on purpose).

### 3c-3 — how it turned out

- **The Excel writer** (`src/excel-exporter/js-head/01-xlsx-writer.js`, ExcelExporter's own, under its licence): `js-head/` is a module folder; the writer is `export var XLSX = (function(){ … })();` and imports `escapeXml` from `../../shared/escaping.js` (the build also includes it inside, as before). For this the build accepts `export var` and a path starting `../`, as long as it stays within `src/`. ExcelExporter came out byte-for-byte the same; the `XLSX` global is unchanged.
- **The expression parser** — the numbers a macro step or `fm.*` action reads — moved from `13-automation-core.js` into its own module, `src/fmide/modules/expression.js` (Apache, as fmIDE): `evalExpression(src, env)`, `readNumber(v, label, env)` and `readBool(v, env)`, the same code, given what they need from fmIDE in `env` (`lookupVar`, the macro's variables, and `fail`, which throws fmIDE's `FmError`). fmIDE keeps `evalExpr`, `evalNumber` and `toBool` as one-line wrappers, so no caller changed. fmIDE's file changed for the first time in this step, by exactly that.
- New test group 65: both, alone in Node. Group 64 covers the three module folders.

## Done when

- `src/` holds the source, `tools/build.js` builds both apps, CI checks the generated files match.
- Shared logic lives once in `src/shared/`.
- `npm test`: all tests pass, snapshots untouched.
- README, CLAUDE.md, `docs/decisions.md` (build step 3 ✅) describe the new workflow.
