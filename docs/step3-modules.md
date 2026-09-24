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

## Phase 3c — real modules (not now)

Converting to proper `import`/`export` modules (so pieces can be unit-tested and loaded by plugins) will matter for the plugin work later. **Do not start it in this step**; at the end of 3b, note in `docs/decisions.md` which pieces would be easiest to convert first.

## Done when

- `src/` holds the source, `tools/build.js` builds both apps, CI checks the generated files match.
- Shared logic lives once in `src/shared/`.
- `npm test`: all tests pass, snapshots untouched.
- README, CLAUDE.md, `docs/decisions.md` (build step 3 ✅) describe the new workflow.
