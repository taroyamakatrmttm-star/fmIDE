# Decisions

| # | Decision | Status | Outcome |
|---|---|---|---|
| 1 | Where the code lives | Agreed (24 Sep 2026) | Private Git repository on GitHub |
| 2 | First platform | Agreed (24 Sep 2026) | Installable web app (PWA) first, then desktop via Tauri |
| 3 | Open source or not | Agreed (25 Sep 2026) | **Open core**, one repository with two licences (see `LICENSING.md`): fmIDE, the shared code, tools and tests under the **Apache License 2.0**; the file-format documentation under **CC BY 4.0**; **ExcelExporter proprietary** — free to use, including at work, but not to copy, modify or redistribute. Copyright 2026 Taro Yamaka. |
| 4 | Where the web app is hosted | Agreed (25 Sep 2026) | Cloudflare Pages, on its free address for now (both can change later) |
| 5 | One app or two | Agreed (24 Sep 2026) | One installable app: fmIDE, with ExcelExporter opening from inside it |
| 6 | The community library (step 8) | Agreed (27 Sep 2026) | Shared as files (library packs), with no change to the security policy. The single files make no network calls; since phase 8d (agreed 27 Sep 2026) fmIDE on its published site may read its own site's `/library` (the list and pack files) when asked, and nothing else — nothing is ever sent. Packs live in a separate public GitHub repository, submitted by pull request, checked automatically and approved by the owner; the catalogue is published on the Cloudflare site under `/library`. Items are licensed CC BY 4.0, with short submission terms. Templates, recipes and functions are shared — not macros. A preview before anything is added, size limits on every file, a record of where items came from, only a family's first author may add versions, a takedown process. A free-text author name, checked against the submitter's GitHub account. Browsing inside fmIDE (8d): Browse Library…, on the published site only, every pack checked against the list's fingerprint and shown in the usual preview before anything is added. Phase 8c (agreed 27 Sep 2026): a family belongs to the GitHub account of its first approved pack, recorded in the library's `families.json`; the site gets the approved packs through a pinned git submodule, fetched by GitHub, never by the build; packs are never edited once approved; at most 5 MB each; a catalogue with no JavaScript. See `docs/step8-community-library.md`. |
| 7 | Touch support (step 9) | Agreed (27 Sep 2026) | Tablets and touchscreen laptops (phones later, with their own layout). One finger on empty canvas scrolls; press and hold, then drag, selects with a box. The mouse-only gestures (arrow, alias, duplicate, adding to the selection) through a menu opened by pressing and holding a node. No pinch to zoom in step 9 (zoom is its own step). No virtual on-screen mouse. Three phases, 9a, 9b, 9c, one pull request each. The mouse keeps working exactly as before. Phase 9c (chosen 28 Sep 2026): the touch code both apps need lives once in `src/shared/pointer-input.js` (Apache, as the rest of `src/shared/`), ExcelExporter's own touch code stays in ExcelExporter; two fingers don't zoom the canvas (kept for fmIDE's own zoom) but still zoom the page elsewhere; the ribbon stays one row, with arrows at its ends and taller buttons on touchscreens; several rows in ExcelExporter's Tree view are chosen through the row menu opened by a hold. See `docs/step9-touch.md`. |
| 8 | Help inside the apps (step 10) | Agreed (29 Sep 2026) | Help lives inside each single file and works offline: a Help panel with search, a plain-English sentence for every command, help one click from the buttons, guided tutorials and a welcome screen; the same text later becomes the site's help pages and the scripts of short videos. Written once, in `src/help/`, and kept current by the tests (every command needs a sentence; every tutorial runs as a test). Videos are links labelled "opens YouTube", opening in a new tab — never embedded, nothing loaded from another site. English first, written so translations can be added. fmIDE's help text under CC BY 4.0; ExcelExporter's help stays with ExcelExporter. Four phases, H1–H4, one pull request each. Phase H2 (chosen 29 Sep 2026): the Help panel's code is shared by both apps in `src/shared/` (Apache in both, like the rest of `src/shared/`); ExcelExporter's help text stays ExcelExporter's. Phase H3 (chosen 29 Sep 2026): tutorials run in practice mode (your model set aside and put back, the autosave paused); the welcome is a card in a corner that blocks nothing, on the very first start only; H3 split into H3a and H3b. Phase H3b (chosen 29 Sep 2026): what a tutorial saves in the library goes back out at the end unless the person ticks Keep; the To Excel tutorial's card stays in fmIDE. Phase H4 (chosen 29 Sep 2026): three phases — H4a the help pages at `/help`, looking like the library's catalogue, with ExcelExporter's help published too under its own licence; H4b video scripts and automatic screen recordings with captions, the voice-over in the owner's own voice; H4c video links kept as YouTube ids in `src/help/videos.js`, checked by the tests, which fail when a tutorial changes after its video was recorded. See `docs/step10-help.md`. |
| 9 | The Excel look and layout (step 11, after step 10) | Agreed (29 Sep 2026) | Separation of concerns: fmIDE says what things are (inputs, calculations, number formats), ExcelExporter decides how they look and where they sit in Excel. fmIDE stores no Excel rows, blank rows or Excel formatting. The Excel look (the Excel-only roles, how inputs and calculations look in Excel, Excel border sides and default font size) moves to ExcelExporter as the person's own Excel style; the canvas look and number formats stay in fmIDE. This replaces "formatting is defined in one place". The Excel-only parts of `src/shared/format-roles.js` (Apache) may move into ExcelExporter (proprietary). Old files keep opening; their Excel-only settings are dropped on upgrade, with no offer to adopt them. ExcelExporter remembers layouts per module (template family, rows matched by name); later, optionally, layouts and suggested styles travel with modules in packs as an attachment fmIDE never reads, the person's own style always winning. Three phases, 11a, 11b, 11c, one pull request each. Phase 11a (chosen 30 Sep 2026): a rectangle's own bold, font size and colours are canvas only — only number formats go to Excel (a row's own format in ExcelExporter sets them there); step 11 started before H4c. Phase 11b (chosen 30 Sep 2026): layouts are remembered automatically whenever a module's tab changes; block instance tabs are left for a later follow-up; a row moved to another tab is not followed. Phase 11c (chosen 30 Sep 2026): layouts only, no suggested Excel styles (the style stays the person's own); ExcelExporter finds attachments in `.fmide` documents and workspaces (which carry templates), not in system files; Save as new version carries the attachment forward; two pull requests, 11c-1 (fmIDE, formats, checker) and 11c-2 (ExcelExporter). Phase 11d, the block instance follow-up (chosen 30 Sep 2026): only blocks added from a template are remembered (by their template family); an instance tab has "Lay out the other instances like this" for the block's other instances in the model (any block); instance tab names are not remembered; a block inside a block is not matched. See `docs/step11-excel-output.md`. |
| 10 | fmGraph, a third app (step 15) | Agreed (2 Oct 2026) | A standalone app, **fmGraph**, where bars show rectangles' values and sliders change input rectangles, so a person sees how a value moves the rest of the model; charts (stacked, waterfall) are arrangements of bars. **Open**: Apache License 2.0, like fmIDE, using `src/shared/`; no code moves between it and ExcelExporter. It **never changes the model** (sliders are a "what if" with Reset). Boards spanning several canvases are shared as **attachments of system templates** (canvas templates too), which fmIDE never reads. **Standalone**, opening from fmIDE like ExcelExporter (still one installable app), with a live link to fmIDE later. The owner is happy for fmGraph to work results out ahead so sliders move smoothly. Phases G0–G6, one pull request each. See `docs/step15-fmgraph.md`. |

Why decision 3: an open editor and an open, documented file format build trust and let a community and other tools grow around fmIDE ("the ecosystem is the most"); ExcelExporter is where Pro / Enterprise / Marketplace editions can build later. Licences can be loosened later (ExcelExporter could be opened), but a version once published as open source stays open. The licence texts should be reviewed by a lawyer before the repository is made public. Before accepting outside contributions, a contributor licence agreement (CLA) is needed (`CONTRIBUTING.md`). Making the repository public is a separate step, taken by the owner when ready.

## Build order

Workflow since step 3a: edit `src/` → `npm run build` → `npm test` (the files in `apps/` are generated — never edit them by hand).


1. Repository (this) ✅
2. Permanent test suite — one command that runs every check, on every change ✅ (`npm test`, see `tests/README.md`)
3. Split each app into modules (still building to single files), protected by the tests ✅ — 3a source split into `src/`, built by `npm run build`; 3b shared code in `src/shared/` (see `docs/step3-modules.md`). 3c real modules, after step 15 (the owner's request, 7 October 2026): 3c-1 the build reads modules, the shared files Node runs are modules ✅; 3c-2 the browser's shared pieces ✅; 3c-3 ExcelExporter's Excel writer and fmIDE's expression parser ✅; 3c-4 ExcelExporter's formula building ✅ — step 3c done
4. Storage for the web app: IndexedDB plus explicit open/save of `.fmide` files ✅ — 4a IndexedDB underneath, 4b `.fmide` documents (Open, Save, Save As, Recent, recovery), 4c Preferences file (see `docs/step4-storage.md`). Double-clicking a `.fmide` file to open it (PWA file association; PWA = installable web app) belongs to step 5.
5. Publish the web app (see `docs/step5-publish.md`) ✅ — 5a installable web app (PWA): offline, updates, install, double-click `.fmide`, one app with ExcelExporter inside; 5b licences (decision 3) and automatic publishing to Cloudflare Pages on every merge, with a preview address for each pull request.
6. Template management ✅ — families and versions, canvases linked to their template ("Update this canvas"), recipe templates, and a warning when more than one plug feeds a socket (see `docs/file-formats.md`)
7. Formula IR and plugins (chosen by the owner, September 2026; see `docs/step7-formula-ir.md`): A agreement tests and fixes ✅, B shared IR ✅, C ExcelExporter on the IR ✅, D function plugins ✅, E1 new operators ✅; E2 (chosen September 2026): E2a LN, EXP, SQRT, INT, TRUNC ✅ (TRUNC with one input; no unit from LN, EXP, SQRT), E2b CHOOSE ✅ (an index and named choice dots, as IF; one pull request, as the canvas came almost free from E1b — the owner had chosen two)
8. Community library (see `docs/step8-community-library.md`) ✅: 8a library pack files ✅; 8b where items came from ✅; 8c checker and catalogue (8c-1 the checker for one pack ✅, 8c-2 the library's rules and repository ✅, 8c-3 the catalogue ✅); 8d browsing inside fmIDE ✅
9. Touch support (see `docs/step9-touch.md`) ✅: 9a one input path for mouse, touch and pen ✅; 9b touch replacements for the mouse-only gestures ✅; 9c the screen and ExcelExporter ✅
10. Help inside the apps (see `docs/step10-help.md`, decision 8) — in progress: H1 help panel, search and a sentence per command ✅; H2 help where you are (tooltips, "?" on windows, ExcelExporter) ✅; H3 tutorials and a welcome card ✅ (H3a engine, practice mode, welcome card, two tutorials; H3b four more tutorials); H4 help pages on the site and videos — H4a the help pages at `/help` ✅, H4b video scripts and recordings ✅, H4c video links
11. The Excel look and layout belong to ExcelExporter (see `docs/step11-excel-output.md`, decision 9) ✅ — started before H4c (the owner's decision, 30 Sep 2026, as H4c waits on the recordings): 11a the Excel style moves to ExcelExporter ✅; 11b layouts remembered per module ✅; 11c a module's Excel layout travels with its template ✅ (11c-1 fmIDE, formats and checker; 11c-2 ExcelExporter using it); 11d block instance tabs remember their layout ✅
12. Faster canvas building (see `docs/step12-canvas-building.md`) ✅: 12b ✅ (rows, the Mod+Enter quick chain, no size box or numbering — the owner's choices, 1 Oct 2026); 12a ✅ (always on, the nearer snap wins with alignment on a tie, only the row or column counts, Alt during a drag turns snapping off, resizing doesn't snap — the owner's choices, 1 Oct 2026): 12a snap to equal spacing (a dragged node snaps where it is evenly spaced with its neighbours, horizontally or vertically, as PowerPoint's smart guides); 12b add many rectangles at once (type a list of names, one rectangle each). Independent of each other; recommended order 12b, then 12a.
13. Zoom (see `docs/step13-zoom.md`) ✅: 13a the canvas zooms 25%–200% ✅; 13b pinch with two fingers on a tablet ✅
14. ExcelExporter's new look (see `docs/step14-excel-exporter-look.md`) ✅
15. fmGraph (see `docs/step15-fmgraph.md`, decision 10): G0 the brief ✅; G1 the app, bars and sliders ✅; G2 charts ✅ (two general blocks: columns of groups with a totals check, and a waterfall); G3 boards — G3a tabs, arranging, colours, undo and the board file ✅ (several boards as tabs, an ordered grid — the owner's choices), G3b boards inside `.fmide` documents ✅ (the document's boards win over the browser's; changes go back to fmIDE by themselves — the owner's choices); G4 exploring — G4a Trace and Biggest movers ✅ (against the model's own numbers), G4b the A/B snapshot and animation ✅ (always on, respecting reduced motion) — the owner's choices; G5 sharing (template attachments, packs) — G5a boards on templates ✅ (both ways onto a template, a canvas template's board only its canvas, template boards when a model has none of its own and on request, system templates by canvas name, Try in fmGraph as G5c — the owner's choices); G5b fmGraph using templates' boards and Attach to template… ✅; G5c Try in fmGraph from Browse Library ✅ (only templates carrying a board, nothing kept while trying — the owner's choices); scenarios after G5, before G6 (the owner's request, 3 October 2026, with the recommended choices and no wait between phases) — S1 named scenarios ✅ (Pin as A kept; scenarios belong to the model, kept with the boards), S2 the scenario waterfall ✅ (the panel's order, each step the change from the one before, a waterfall per output); G6 tutorials ✅ (fmGraph's own, on a practice copy of the sample model)
16. Sensitivity in ExcelExporter: the Tornado and the Spider (see `docs/step16-sensitivity.md`; the owner's request, 8 October 2026 — live in Excel through a Data Table, outputs and the period picked in ExcelExporter and switchable in Excel, each input moved by a % or an amount, the charts on their own tabs or on the Sensitivity tab, all the owner's choices): A the calculation ✅; B the charts ✅ — step 16 done

## Known issues, to fix later

Found and agreed with the owner; each waits for its own session, branch and pull request.

None at the moment.

Fixed:

- **Two test groups sometimes read the wrong window** (found 8 Oct 2026, when group 53 failed once on GitHub during step 3c). After attaching a file to a template, groups 37 and 53 read "the top window" at once; fmIDE reads the file in the background, so the Templates window could still be on top. Their attach helpers now wait for fmIDE's message first. Tests only; the apps unchanged.
- **On a touchscreen, a menu choice made straight after a tap that cancelled "Draw arrow from here" was lost** (found 7 Oct 2026, when the touch test failed now and then on GitHub's slower machines during step 3c). The cancelling tap dropped every click for 0.8 s, not only its own, so a quick hold and a menu choice inside that time did nothing. Now only that tap's own click is dropped (`onTapArrowPress` in `src/fmide/js/08b-touch-menu.js`; the next press is a new tap). Test: group 27.
- **A system template lost its canvases' links to their canvas templates** (found and fixed 3 Oct 2026). **Save System as Template** (`openModelAsTemplateData` in `src/fmide/js/11-templates-format-presets.js`) now keeps each canvas's `template`, as a plain system file does (`buildSystemPayload`), so a system added back from the template (Add or replace) has its canvases linked, and ExcelExporter lays them out as modules with their Excel layouts. No file-format change; system templates saved before hold no links until saved again with Save as new version. Tests: groups 15 and 38. **Still for the owner to decide:** when a system template goes into a library pack, offer to add the canvas templates its canvases come from, so their Excel layouts travel too.

## Agreed improvements, for later

Agreed with the owner; each waits for its own session, branch and pull request.

- **Faster tests, ongoing** (the owner's standing request, 8 October 2026). Keep shortening the test run whenever a way is found, without lowering what it checks. Done: the GitHub run once per change instead of twice, and in 4 parts at once (from about 13 minutes per pull request to 4 min 47 s); then the parts balanced by measured time (`tools/test-parts.js`), as they ended 2–5 minutes apart. Ideas for later, each measured first: move checks that need no browser to Node (the modules of step 3c make that possible — ExcelExporter's formula text, the expression parser, parts of reading files); keep LibreOffice and the browser installed between runs (a cache), if setup becomes the larger share.

- **A readable pack file name** (agreed 4 October 2026). Since #107, Save as Library Pack… names the file after the pack's id (`c526c522-….fmide-pack.json`), because the library accepts a pack only under that name. That name is right, but hard to recognise in a Downloads folder. **The idea:**
  - fmIDE saves a readable name with the id in it, for example `Three-Statement Model v01 (c526c522).fmide-pack.json` (`libraryPackFileName`);
  - the library accepts any `….fmide-pack.json` name in `packs/`, reading the id from inside the file, as the checker already does;
  - the catalogue build (`tools/build-library.js`) publishes each pack under its id, so the site's addresses (`library/packs/<id>.fmide-pack.json`), Browse Library and `index.json` are unchanged.

  **What changes:**
  - the checker's file-name rule (`tools/check-pack.js`, `tools/check-library.js`; two packs with the same id are still refused), then a library pull request moving `checker.json` to that fmIDE commit;
  - the share window's and the guide's "keep that name" (`11e-library-packs.js`, help topic `share-library-pack`);
  - tests in groups 22–25;
  - the library's `README.md`.

  **Why:** the owner's first upload (4 October 2026) was refused for its name; a person following the app should never meet a file-name rule.

## Before sharing the project: your name out of the public places (deferred)

Agreed with the owner on 4 October 2026, and **deferred until before the project is shared with anyone** (nobody has it yet). Its own session, branch and pull requests.

**Why:** the owner's real name shows in public places:
- the GitHub username `taroyamakatrmttm-star`: every repository address, the library's upload link and records;
- the copyright holder "Taro Yamaka": the licence notices, and the footer of every `/help` page on the live site;
- the email `taro.yamaka.trmttm@gmail.com`: the author of every commit.

**The owner's choices:**
- **Rename the GitHub account** (not an organization).
- **Change the copyright name** to one the owner will give: a pen name or a company. It is also the name CC BY 4.0 credits, so it belongs with the lawyer review of the licence texts.
- Not yet chosen: the new username, the copyright name.

**Steps, in this order:**
1. **The owner** chooses the new username (check `github.com/<name>` shows a 404) and the copyright name.
2. **A session** prepares the fmIDE pull request on a branch, not merged yet:
   - **The library's address:** `.gitmodules`, `LIBRARY_UPLOAD_URL` in `src/fmide/js/11e-library-packs.js`, `LIBRARY_REPOSITORY` in `tools/build-library.js`, and the address written out in the help topic `share-library-pack` (`src/help/fmide-help.js`).
   - **The copyright name** (`git grep -i "taro yamaka"` lists them, 23 files today): `NOTICE`, `LICENSING.md`, `README.md`, the licence comment in each app's `index.html`, the help files' headers in `src/help/` and `src/excel-exporter/help/`, `src/excel-exporter/LICENSE`, and the generated notices in `tools/build-help.js` (the `/help` footer) and `tools/video-scripts.js`.
   - **Tests and docs:** tests 12 (`NOTICE.txt`), 22 (the upload link) and 25 (the "report an item" links); `CLAUDE.md`; `docs/step8-community-library.md`. The sample libraries in `tests/fixtures/library/` name the account only as test data, and can take a made-up one.
   - Then `npm run build` and the whole of `npm test`.
3. **The owner** renames the account: GitHub → Settings → Account → Change username. GitHub redirects the old addresses, and git commands, **only until someone registers the old name**, so steps 4 and 5 follow straight away.
4. **Merge the fmIDE pull request** once it is green; the live site follows.
5. **A library pull request** (it needs a session with push access to `fmide-library`):
   - `checker.json`: `fmide.repository`, and the maintainer's `account`;
   - `.github/CODEOWNERS`;
   - the `account` fields in `authors.json`, `families.json` and `packs.json`;
   - the links in `README.md` and `.github/pull_request_template.md`.

   The checks match accounts by their numeric id (333327860), so ownership survives the rename. A maintainer's pull request that only changes records gets warnings, not errors.
6. **The email:**
   - GitHub → Settings → Emails → **Keep my email addresses private** and **Block command line pushes that expose my email**; commit with the `@users.noreply.github.com` address from then on.
   - Past commits keep the old email: rewriting history would break the library pointer fmIDE pins and `checker.json`'s fmIDE commit, so it is not planned.
7. **Afterwards:** reconnect GitHub for Claude if sessions lose access, and start sessions on the renamed repositories.

## Phase 0 (hardening) — status

- ✅ Text from files is escaped (safe to share files)
- ✅ Built-in Excel writer — no external library; confirmed in Windows and iPhone Excel
- ✅ File-format versions and migrations in both apps
- ✅ Warning when autosave fails
- ✅ Storage (build step 4): IndexedDB, `.fmide` documents, Preferences file
- ✅ Modules (build step 3): the apps are generated from `src/`, with shared logic once in `src/shared/`

## Step 3c: which pieces to turn into real modules first

Noted at the end of 3b; done 7 October 2026 in this order (see `docs/step3-modules.md`). Item 4 became the module folder `src/excel-exporter/formulas/`.

Converting to `import`/`export` modules matters for the plugin work. Easiest first, because they have no DOM and no hidden globals:

1. `src/shared/*` — pure functions and tables already written to take everything as parameters (the input rule takes the canvas; the file-format core takes the format and migration tables). `escaping.js` and `input-rule.js` are the simplest.
2. ExcelExporter's `js-head/01-xlsx-writer.js` — already a self-contained IIFE with a small interface (`XLSX.utils.book_new`, `book_append_sheet`, `write`, `writeFile`); only `writeFile` touches the DOM.
3. fmIDE's expression language in `js/13-automation-core.js` (the small numeric-argument parser) — self-contained, easy to unit-test.
4. ExcelExporter's `js/01-core-translation.js` (text/UOM parsing and formula building) — pure apart from the `ctx` object it is handed, but large, so after the above.

Hardest: anything that reads the apps' shared mutable state (fmIDE's `nodes`/`edges`/canvases, ExcelExporter's `model`/`mapping`) or builds DOM — rendering, dialogs, the ribbon, the macro builder.
