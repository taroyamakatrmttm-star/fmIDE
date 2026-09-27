# Changelog

Notable changes before this repository existed (recorded from the development history). From here on, Git keeps the detail.

## Function plugins, part 1: the formula reader and the file formats (phase D1)
- The groundwork for **functions**: formulas you write once, such as `Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`, and use in a model like a built-in operator. This part adds the reader for them (our own parser, which never runs text as code), their calculation in both apps, and the files that carry them. Creating and placing functions in fmIDE comes next (the Functions manager); ExcelExporter writes them out in full after that.
- The syntax is Excel-like and written down in `docs/file-formats.md`: inputs by name, numbers, brackets, `+ - * / ^`, one comparison, `MIN MAX AVERAGE ABS MOD IFERROR`, and calls to other functions, with Excel's order of operations (`-2^2` is 4).
- File formats: system 5, module 3, workspace 4 and templates file 4 can carry function definitions, and there is a new functions file (version 1). A model takes the functions it uses with it in every file. Older files open as before, and an older copy of the apps asks before opening a newer file.
- Until ExcelExporter writes function calls out (phase D3), a cell that reads one shows `#N/A` in Excel, never a wrong number.

## ExcelExporter writes its formulas from the shared formula IR (phase C)
- ExcelExporter now reads the model through the same shared calculation description fmIDE calculates on (the IR). Workbooks are unchanged for every sample model; Generate is faster on large models (about a third less time on a model of about 1,900 nodes).
- Plugs and sockets: both apps now work out which plug feeds which socket from the names themselves, instead of trusting the connections saved in the file. A file whose saved connections were out of date (a plug renamed or removed after saving) used to give ExcelExporter different numbers from fmIDE's.
- Units come from the IR in both apps. fmIDE now also shows the unit of a rectangle fed by a block (worked out through that block, as the workbook already did: $/t × kt inside a block gives $k outside it).
- A block's input port whose source needs a period outside the timeline uses the port's typed number in Excel too, as in fmIDE (Excel wrote 0). A port whose source fails for another reason (a divide by zero) now shows "?" in fmIDE, as Excel shows an error (fmIDE used the port's typed number and hid the error).
- New: before you download, ExcelExporter lists where the workbook will differ from fmIDE — rows where fmIDE shows "?" because something is broken (a loop, an alias to nothing, two arrows into one rectangle, a missing block…) but Excel writes 0 or leaves the cell blank, operators fmIDE doesn't know, and rows left out of the layout that other rows read. It never blocks the download.
- Fix: ExcelExporter could not generate a workbook ("Maximum call stack size exceeded") from a model with a block that contains itself; it now writes 0 there and lists it.
- Fix: a saved ExcelExporter layout was lost whenever fmIDE redrew the connections plugs make (they get new ids each time). The layout's key now leaves them out; layouts saved before are still found.

## fmIDE calculates on the shared formula IR (phase B)
- fmIDE now calculates from a shared description of the model's calculation (the IR, intermediate representation, in `src/shared/`): an operator catalogue with lasting ids, units of measure, and `compileModel`, which reads only the model. Values, error messages, units and the automation interface (`window.fm`) are unchanged; ExcelExporter moves onto the IR next (phase C).
- Faster: on a large model (about 1,900 nodes, 24 periods) a full calculation takes about a third of the time it did.
- Units on the canvas are worked out from the IR. They update after every change as before; while a rectangle is being dragged, they update when it is dropped.

## The canvas and Excel give the same numbers (formula IR, phase A)
- A new test compares fmIDE's value of every rectangle, in every period, with the workbook recalculated by LibreOffice, for every sample model. It found these differences, now fixed so both apps agree:
- `%` works like Excel's MOD: the result takes the divisor's sign (−7 % 3 is now 2 in fmIDE, as in Excel).
- A comparison with three or more inputs, a < b < c, means a < b and b < c (fmIDE used to compare the first result, 1 or 0, with c). A comparison with one input is now an error in both apps (Excel got an invalid `AND()`).
- `abs` with more than one input is an error in Excel too (`#N/A`; Excel used to ignore the extra inputs).
- `iferror` with one input that fails, or with nothing wired in, gives 0 in fmIDE too.
- A period ticked under "Which periods use this rectangle's own number?" uses the typed number in fmIDE even when the rectangle is wired, as Excel already did.
- A corkscrew's opening balance (a typed number, fed by a period shift) now shows the typed number in period 1 in Excel, as fmIDE already did (Excel wrote 0, so every later period was off). A rectangle without a typed number shows 0 there, now as a number instead of the formula `=0`.
- A rectangle fed by an operator that nothing feeds shows 0 in fmIDE when it has no typed number (it showed "?"), as in Excel.
- A wired rectangle whose source fails (e.g. a divide by zero) shows "?" in fmIDE instead of falling back to its typed number, as Excel shows an error.
- Fix: in a file that used the same node id on two canvases, fmIDE could show one canvas's number on the other. Each canvas now keeps its own values.

## Warning when more than one plug feeds a socket; fix for deleting a canvas with plugs
- fmIDE: plugs feeding the same socket are added together. When there is more than one, the socket shows **⚡ name ×2** in amber, and hovering lists the plugs (for example, the same Net Income added twice by building a recipe next to the canvas the template was made from). Building a recipe and the recipe check list such sockets too. Nothing is blocked, because adding several plugs can be intended.
- Fix: deleting a canvas left behind the automatic connections from its plugs, so a socket that other plugs still fed could show 0 until the next change. Deleting a canvas now rebuilds the connections and recalculates.

## Recipes: templates made of templates
- fmIDE: a **recipe** lists canvas templates to add together, each at its latest version or a fixed one, for example Three Statements = Income Statement (latest) + Balance Sheet (v2) + Cash Flow (latest). **Templates → + New Recipe…** picks the parts, their versions and order, with a live check for sockets that no plug in the parts feeds.
- **Build (add canvases)** adds one canvas per part, each linked to its template (so "Update this canvas" works on it), and plugs and sockets connect them by name. It warns when a fixed version in your library differs from the one the recipe was made with, skips parts you don't have, and lists sockets nothing feeds. Undo removes the whole build. Recipes have versions like other templates (**Edit as new version…**).
- Automation: new `saveRecipe`; `insertTemplate` builds a recipe and returns the new canvases, warnings and unfed sockets.
- File formats: the templates file and the workspace are now version 3 (they can hold recipes). Older files open as before; ExcelExporter reads the new workspace version; an older fmIDE asks before opening a version 3 file.

## Canvases remember their template; "Update this canvas"
- fmIDE: a canvas made from a canvas template (Add to new canvas, or Add to current canvas on an empty canvas) remembers the template and version. Saving the canvas as a template links it too.
- When a newer version is in your library, a bar above the canvas says so, and the canvas tab shows ⬆. **Update this canvas…** shows the change notes, which input values will be kept and which inputs the new version dropped, and warns when the canvas has changes of its own. The update keeps the canvas's name, its input values (matched by rectangle name, including values per period) and the links other canvases' aliases have to rectangles that still exist. Undo reverses it. **Not now** hides the notice until an even newer version appears.
- New commands **Update Canvas from Template…** (can also go back to an older version) and **Unlink Canvas from Template**. New automation actions `updateCanvasFromTemplate` and `unlinkCanvasFromTemplate`; `fm.canvases()` reports each canvas's template.
- File formats: `system` is now version 4 (a canvas can carry its template link). Older systems open as before; ExcelExporter reads version 4 and its workbooks are unchanged; an older fmIDE asks before opening a version 4 file.

## Template versions
- fmIDE: every template now belongs to a **family** — a lasting random id, so templates from different people never clash — and has a **version number** (1, 2, 3) and a short **change note**. **Templates → ⤴ Save as new version** saves the open canvas (or system) as the next version. Saving under a new name starts a new template; under a name already in use, fmIDE asks whether to make a new version or pick another name.
- The Templates window lists each template once, at its latest version, with **▸ older versions** underneath (newest first) to preview or add. **✎ Edit info** renames all versions together; the note belongs to one version. Older versions can be deleted one by one, but the latest only with the whole template, so a version number is never used twice. **Remove duplicates…** compares latest versions and removes whole templates.
- Automation and macros: `insertTemplate` takes `Name@latest`, `Name@3`, or the family id in place of the name. A recorded macro writes `Name@N` when an older version was added.
- Importing: a version you already have is skipped. A different version with a number you already use is added as the next number, with a note, and the import message says so.
- File formats: `fmIDE-templates` and `fmIDE-workspace` are now version 2. Older files, documents and the autosave are upgraded as they are read (each template becomes version 1 of its own family). ExcelExporter reads the new workspace version. An older fmIDE asks before opening a file saved by this version.

## Several plugs on one rectangle
- fmIDE: a rectangle can carry more than one plug name, each feeding the operators whose socket has that name — for example "Income Tax" feeding both "to Income Tax expense" and "to CF Income Tax paid". The 🔌 editor lists one chip per plug (✕ removes it) and adds a typed name with Enter; the rectangle shows all of them. Automation: `setPlug` still sets a single plug (replacing the others); new `addPlug`, `removePlug` and `setPlugs`.
- File formats: `system` is now version 3 and `module` version 2 (a rectangle's `plug` became a list, `plugs`). Older files, templates, documents and the autosave are upgraded as they are read; ExcelExporter reads the new version, and its workbooks are unchanged.

## "Remove duplicates…" — choose what must match
- fmIDE: **Templates → 🧹 Remove duplicates…** (and the command "Remove Duplicate Templates…") now opens a window. Kind and the calculation must always match; you tick whether the **name**, **layout and formatting**, **group** and **description** must match too (defaults: name only). Internal ids and counters are always ignored, so re-arranged or re-saved copies of the same calculation are found. Each set lists its templates with a preview; you pick which one to keep, see how many will be removed, and confirm (or Cancel). The tick boxes are remembered.
- Imports still skip only exact copies.

## Fix: "Remove duplicates" removed originals too; new "Clear all templates"
- fmIDE: **Remove duplicates** removed every template that had a copy, originals included, when the copies shared an internal id with their original (which an older Import Workspace did). It now removes only the copies. On start-up every template now gets its own id, and new ids no longer restart at 1 after a reload (which reused a saved template's id). So Delete, selection and Remove duplicates each act on one template.
- New in the Templates window: **🗑 Clear all templates** (also the command "Clear All Templates"). It asks first and removes templates only.

## No more duplicate templates
- fmIDE: **Import Workspace** and **Import Templates** now add only the templates you don't already have (same name, kind and content), like **Open** already did. Before, importing a file that held your own templates added a full second copy of each. Templates with the same name but different content are still both kept.
- New in the Templates window: **Remove duplicates** (also the command "Remove Duplicate Templates"), shown when exact copies exist; it asks first and keeps one of each.

## ExcelExporter says when a new version is ready
- On the web app, ExcelExporter now shows the same "A new version is ready" notice as fmIDE, with Reload (your layout is kept; load your file again) and Later. Before, it silently stayed on the old version. Once one open tab switches to a new version, every other open tab of fmIDE or ExcelExporter gets the notice too.
- The preview comment on a pull request now leads with the address of that exact version, which the browser can't have an older copy of.

## Unconnected block inputs are real inputs in Excel
- ExcelExporter: when nothing feeds a block instance's input (no arrow, or an arrow from something fed by nothing, such as an operator with an empty socket), that input gets its own row on the instance's tab, holding the number typed in the block, just as fmIDE uses it. The block's formulas refer to that row (before, they used a typed 0), and "Gather inputs on a separate tab" gathers it, one row per instance. Inputs that are fed work as before.

## Search in the Templates window
- fmIDE: **File → Templates** has a search box, with the cursor in it when the window opens. It matches like the Command Launcher (Ctrl/Cmd+K): part of a name, or its group or description, best match first with the matched letters in bold. ↑ ↓ move the selection (the preview follows), Enter runs the main button (Add to current canvas, or Add System; never Replace System), and Esc closes the window.

## Inputs tab gathers Block Input rectangles
- ExcelExporter: "Gather inputs on a separate tab" now also gathers rectangles marked **Block Input** in fmIDE (for example Volume and DSO), when their canvas is not used as a block anywhere. Before, they stayed on their own tab as typed numbers. Block Inputs of a canvas that is used as a block are still left alone: each instance feeds them.

## Published online (build step 5b, part 2)
- fmIDE is published automatically to Cloudflare Pages (`https://fmide.pages.dev`) each time a change is merged and the tests pass; each pull request gets its own preview address. People who have it open or installed see the update notice.
- The published site has a strict security policy: each page runs only its own scripts and connects only to the site itself, so nothing can be loaded from or sent to another site, and a script smuggled in through a file is refused.
- Fix (found while preparing this): opened offline, ExcelExporter could fail to load, because Cloudflare shortens page addresses with a redirect. The offline copy now stores clean copies of redirected pages.

## Licences (build step 5b, part 1)
- fmIDE is **open core**: fmIDE, the shared code, tools and tests are open source under the Apache License 2.0; ExcelExporter is free to use (including at work) but proprietary; the file-format documentation is under CC BY 4.0. `LICENSING.md` explains which licence covers what.
- Each app carries a one-line licence notice, and the web app ships the licence files (`LICENSE.txt`, `NOTICE.txt`, `ExcelExporter-LICENSE.txt`).

## Installable web app (build step 5a)
- fmIDE can be installed as an app (a PWA, progressive web app) from the web version: its own window and icon, works offline after the first visit, and opens `.fmide` files double-clicked in the operating system (Chrome and Edge on desktop). Nothing is published yet; `npm run build` writes the web version to `site/`, and `npm run serve` shows it locally.
- New versions download in the background; a notice offers **Reload** (your work is autosaved first and comes back if unsaved) or **Later**.
- New commands in a File-tab App group: **Open ExcelExporter** (in its own window) and **Install fmIDE** (when the browser offers installing).
- The files in `apps/` stay single self-contained HTML files that work opened from disk; nothing changes for them.

## Preferences file (build step 4c)
- **File → Export Preferences…** / **Import Preferences…** (also in Customize Ribbon): your keyboard shortcuts, ribbon layout, Quick Access Toolbar, collapsed ribbon and KeyTips key, in one shareable file (`fmIDE-preferences.json`, a new file kind). Import asks once, then replaces exactly those settings; your model, templates, macros and format presets are never touched. Macro shortcuts stay your own.
- Ribbon layouts read from files (preferences and workspaces) are checked and cleaned before use, and a KeyTips trigger from a file must be a modifier key or a valid shortcut.
- Other readers point preferences files to the right place, in fmIDE and ExcelExporter.

## Documents (build step 4b)
- fmIDE works like a document app: **New**, **Open…** (Ctrl/Cmd+O), **Save** (Ctrl/Cmd+S), **Save As…** (Ctrl/Cmd+Shift+S) and **Open Recent…** (up to 10) in a new Document group on the File tab. A document is a `.fmide` file, which is exactly the workspace JSON, so no new file format. Chrome and Edge save straight back to the file. Other browsers download `name.fmide`, and Open Recent reopens the copy kept in the browser, saying so.
- Unsaved changes show as a dot in the window title. New, Open and Open Recent ask Save / Don't save / Cancel, and closing the tab asks "Leave site?".
- Autosave also runs about 2 seconds after each change. After a crash or restart with unsaved changes, fmIDE says "Recovered unsaved changes to …" and offers Save.
- Opening a `.fmide` takes the model and its format roles from the file, and adds its templates and macros to yours (only ones you don't already have). Your shortcuts and ribbon are left alone. Import Workspace still replaces everything.
- Ribbons customised before this release get the Document group once. If you remove it, it stays removed.
- ExcelExporter's model picker accepts `.fmide` files.
- Fix: Import Workspace added the file's format presets next to the existing ones, so after an import there were two of each role and the file's edited roles were ignored. It now replaces presets with the same name and keeps the user's other presets.

## Browser storage on IndexedDB (build step 4a)
- Both apps now keep their autosave in the browser's IndexedDB instead of `localStorage` (`src/shared/store.js`): fmIDE's workspace in the `fmIDE` database, ExcelExporter's saved layouts in `fmIDE-ExcelExporter`, under the same keys as before. Nothing changes on screen.
- What an older version saved in `localStorage` is copied across once, on the first start after the upgrade, and the old copies are kept. Where IndexedDB isn't available (some browsers block it for pages opened from disk, or in private windows), both apps fall back to `localStorage`.
- fmIDE also autosaves as soon as the page is hidden (switching tab, minimising, closing), as well as every 8 seconds. ExcelExporter still saves on every change, and again when the page is hidden.
- On the first change, each app asks the browser once to keep its data (`navigator.storage.persist()`). The answer is remembered and it never asks again. Some browsers (e.g. Firefox) show the user a question.
- The autosave-failure warnings now react to failed IndexedDB writes, with the same wording.

## Shared code (build step 3b)
- Logic both apps need now lives once in `src/shared/` and is built into both: escaping and validation helpers, the input-rectangle rule, the format-role defaults, and the file-format core (shared versions and upgrades, kind inference, version check). No change in behaviour, with one exception: fmIDE now tells you an old ExcelExporter mapping file (saved before file kinds existed) belongs in ExcelExporter, as ExcelExporter already recognised it.

## Source split (build step 3a)
- The apps' source now lives in `src/` (page, styles and ordered script pieces per app); `npm run build` (`tools/build.js`, Node only) generates the two single-file apps in `apps/`. The generated files matched the previous hand-edited ones byte for byte; each now starts with a "Generated from src/" comment. CI fails if `apps/` doesn't match `src/`.

## Test suite
- `npm test` runs every check that used to be done by hand (see `tests/README.md`), offline, locally and on GitHub Actions: Excel structure and fidelity, LibreOffice-recalculated values, layout rules, format roles, security, file formats, UI flows, and formula/value snapshots.

## Both apps
- File-format versions: every file type has `kind` + `version`; one reader per app migrates older files, rejects the wrong kind with a clear message, and asks before opening a file from a newer version.
- Security: text from files is always displayed as plain text; coordinates and colours are validated.
- Format roles: all formatting defined once in fmIDE (Inputs, Calculations, Links, Headers, Section Headers, Labels, Notes); per-style Excel border sides and "Use Excel's default font size".
- Input rule shared by both apps: a rectangle fed by an operator that nothing feeds counts as an input.
- Autosave-failure warnings.

## ExcelExporter
- Built-in Excel writer replaces the external library: works offline, formulas recalculate on open, empty cells keep formatting (confirmed in Windows and iPhone Excel).
- Scenarios per input variable and global cases on a Scenarios tab.
- Inputs tab: gather all inputs on one tab (group by tab / canvas / none, sheet or alphabetical order); original rows link to it.
- Fixed column layout on every tab: label, UOM, Vintage, helper columns, one blank spacer, then periods.
- Vertical blocks: Vintage column, helper columns instead of repeated INDEX, formulas identical down and across the vintage block; Vertical Index rows removed.
- Comparisons export as native TRUE/FALSE (with N() where Excel would otherwise misread them).
- Row sorting (calculation order, canvas position, alphabetical) with Undo; right-click menu in Tree view; Reset Mapping to Defaults.
- Truly empty cells instead of empty text (no more #VALUE! when referencing a blank).
