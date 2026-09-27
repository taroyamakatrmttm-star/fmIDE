# Step 8 — Community library

**Goal.** People who build models share reusable pieces — canvas and system templates, recipes and functions — and bring other people's pieces into their own library. Everything shared is formulas and layout, never code (step 7's decision 3), and every file from someone else is untrusted (CLAUDE.md, non-negotiable rule 1).

**The rules it works within.** The apps stay single files that work offline and make no network calls; the published site's security policy lets a page connect only to its own site. So sharing works through **files**: a pack is saved as a file, found on a catalogue page, downloaded, and opened in fmIDE, which shows what it holds before adding anything.

## Agreed decisions (27 September 2026)

The owner approved the recommendations:

1. **Where the library lives:** a separate public GitHub repository of packs only (for example `fmide-library`); the catalogue is published on the existing Cloudflare site under `/library`.
2. **Publishing and review:** a pack is submitted as a pull request to the library repository; an automatic checker must pass, and the owner approves. Until that repository is public, the library starts with the owner's own packs.
3. **In-app browsing** (fmIDE reading `/library/index.json` from its own site, which the security policy already allows) is decided later, after the file route works: it would change the written rule "no network calls" to "only to its own site".
4. **Licence for shared items:** CC BY 4.0 for every item, with short submission terms ("it's yours, and you licence it under CC BY 4.0"), separate from the contributor licence agreement code needs. The lawyer review of the licence texts covers the terms too.
5. **Trust and safety:** everything in a pack is escaped as before; a preview before anything is added; size limits on every file opened; a record of where each item came from, shown in the Templates and Functions windows; the family rule (below); and a takedown process (report through an issue; the pack leaves the catalogue; copies already downloaded stay their owners').
6. **File formats:** a new kind, `fmIDE-library-pack` 1; later an optional `origin` on template and function entries (`fmIDE-templates` 6, `fmIDE-workspace` 6, `fmIDE-functions` 2). The security policy does not change.
7. **Author identity:** a free-text author name in the pack, checked against the GitHub account that submits it. No signed packs for now.

What is shared: templates (canvas and system), recipes and functions. **Macros are not shared**: a macro runs `window.fm` actions and could delete canvases or empty a library. Format presets could be added later.

**The family rule.** A template or function family is a random id, but anyone can copy one. A pack that reused a popular template's family with a "version 4" would appear as an update in every canvas made from it. So: the library's checker lets only a family's first author add versions (8c), and fmIDE warns in the preview when a pack adds versions to a family you have (8a) — and, once origins are recorded, when it comes from a different author (8b).

## Phases (one pull request each)

- **8a — The library pack file (fmIDE)** ✅ (below).
- **8b — Where items came from:** `origin` (pack, author, licence) on templates and functions, shown in the Templates and Functions windows; the preview warns when a pack adds versions to a family that came from a different author. Format versions raised, with old-version samples and tests.
- **8c — Checker and catalogue:** `tools/check-pack.js` (Node only, using the shared reader and the function parser: structure, limits, licence, family ownership); the library repository's layout, submission template and CI; the build writes the `/library` catalogue pages from the approved packs, all text escaped, under the same security policy. Needs the library repository to be public.
- **8d (optional, decision 3)** — Browse the library inside fmIDE.

## Phase 8a — how it turned out

- **Save as Library Pack…** (File → Library) opens a window: title, author (remembered for next time), description, tags, the licence stated (CC BY 4.0 — "Share only what is yours to share"), and a tick box for each template, recipe and function family in your library (each goes in as its latest version). `fm.saveLibraryPack` does the same and takes references like `"Name@2"`. A recipe brings the template versions it builds with; a function brings the versions it calls; a recipe whose part is missing can't be shared. The file is named after the title, `….fmide-pack.json`.
- **Open Library Pack…** reads the file (the usual reader: wrong kinds say where they belong, a newer pack asks first), refuses one without an id, title, author or accepted licence, and shows a preview: title, author, licence, date, description and tags, then each item with its status — *New*, *Already in your library* (greyed, not offered), *Adds a version to your "…" (you have up to vN)* (in amber, with a caution about updates at the top), or *You have a different … called "…" — both will be kept* — and a note when it brings items it needs. Nothing is added until **Add to My Library**; the result says what was added. `fm.previewLibraryPack` returns the same statuses; `fm.openLibraryPack` adds all items or the ones named by key (`"t0"`, `"f1"`).
- Adding reuses the import rules of templates and functions (`addMissingTemplates`, `addMissingFunctions`); the checks for "already in your library" were drawn out of them (`templateAlreadyHere`, `functionAlreadyHere`) so the preview and the import can't disagree.
- **Size limits for every file opened** (both apps; `FILE_LIMITS` in `src/shared/file-formats.js`): more than 50 MB of text, more than 100 levels of nesting or more than 5 million values are refused with a message. Found while planning: a deeply nested file made fmIDE's reader overflow the stack with no message at all, and the same in ExcelExporter. The autosave is not checked.
- The author name is kept in the UI settings of your own autosave; a workspace imported from someone else never sets it (a workspace export carries it, like the other UI settings).
- The ribbon's File → Library group has both commands; a customised ribbon got them once (`ui.libraryPacksAdded`) in the group holding Format Presets. Neither has a shortcut. The actions are not recorded in macros (a pack is a whole file).
- ExcelExporter says a pack belongs in fmIDE.
- Code: `src/shared/library-pack.js` (the pack details and their checks, pure, so the checker in 8c can use them), `src/fmide/js/11e-library-packs.js` (writing, reading, the two windows), `src/fmide/js/14c-actions-library-packs.js` (the actions). Tests: group 22 (`tests/22-library-packs.spec.js`, `npm run test:library-packs`), sample `tests/fixtures/library/pack-v1.json`.
