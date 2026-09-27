# fmIDE

A visual logic builder for financial models, and a companion that turns those models into live-formula Excel workbooks.

| App | File | What it does |
|---|---|---|
| **fmIDE** | `apps/fmIDE.html` | Build a model as a graph of rectangles (values), operators, aliases, period shifts and blocks, across canvases and periods. |
| **ExcelExporter** | `apps/ExcelExporter.html` | Load an fmIDE system or workspace export and generate an `.xlsx` with real formulas: tabs, Inputs tab, scenarios and global cases, vertical-block vintages, format roles. |

Both are single self-contained HTML files with no external dependencies: open them in any modern browser, online or offline. Nothing is uploaded anywhere.

## Using them

1. Open `apps/fmIDE.html` and build a model. Save it as a document with **File → Save** (Ctrl/Cmd+S): a `.fmide` file. **File → Open…** (Ctrl/Cmd+O) opens it again, and **Open Recent…** lists the last ten. In Chrome and Edge, Save writes straight back to the file. Other browsers download `name.fmide` each time you save, and Open Recent reopens the copy kept in the browser. Work is also autosaved in the browser: after a crash, fmIDE comes back with your unsaved changes and offers to save them.
2. Open `apps/ExcelExporter.html`, load the `.fmide` file (or a **File → Save System** / **Export Workspace** file), arrange tabs and rows, and click **Generate & Download .xlsx**. The workbook calculates exactly as fmIDE does. Where it can't — something broken in the model, such as an alias pointing at a rectangle that no longer exists, a loop, or two arrows into one rectangle, where fmIDE shows "?" but Excel writes 0 or leaves the cell blank, or a row you left out of the layout that other rows read — a yellow list above the Generate button says where, before you download. The download still works. Functions you made in fmIDE are written out in full inside each formula that uses them (a **Functions** tab lists them); where fmIDE shows "?" for a function, or a formula would be too long for Excel, the cell shows `#N/A` and the same list says so.

**Online, as an installable app:** fmIDE is published at **https://fmide.pages.dev** (Cloudflare Pages), updated automatically each time a change is merged. Open it in Chrome or Edge and use the browser's install button (or **File → Install fmIDE**). Every pull request also gets a preview, posted on the pull request, to try the change before it is merged: use its "Try this version" link. To try the web version locally: `npm run build`, then `npm run serve`, and open `http://localhost:8080/`. Installed, fmIDE gets its own window and icon, works offline, opens `.fmide` files you double-click, and tells you when a new version is ready (ExcelExporter does too; press **Reload** on the notice). **File → Open ExcelExporter** opens ExcelExporter from inside fmIDE.

**File → Templates** opens with the cursor in a search box: type part of a template's name (or its group or description), move with ↑ ↓, and press Enter to add it, as in the Command Launcher (Ctrl/Cmd+K). Esc closes the window.

**Templates have versions.** To update a template, select it in **File → Templates** and click **⤴ Save as new version**: the open canvas (or, for a system template, the whole system) becomes its next version, with a short note on what changed. The list shows each template once, at its latest version (`v3`); **▸ older versions** underneath lists the earlier ones, newest first, and any of them can be previewed and added. Saving a template under a new name starts a new template; under a name you already use, fmIDE asks whether you meant a new version. **✎ Edit info** renames a template with all its versions. Older versions can be deleted one at a time; the latest goes only with the whole template. In macros and the Command Launcher, `Income Statement@2` means version 2 and `Income Statement` (or `Income Statement@latest`) the latest. Templates saved before this each become version 1 of their own template.

**Canvases remember their template.** A canvas made with **Add to new canvas** (or added to an empty canvas) remembers which template and version it came from. When you save a newer version of that template, a bar above the canvas says so, and the canvas tab shows ⬆. **Update this canvas…** rebuilds the canvas from the newer version and keeps the input values you typed (matched by rectangle name, including values per period). It lists which values are kept and which inputs the new version no longer has, and warns if you changed the canvas in other ways, because those changes are replaced. **Not now** hides the bar until an even newer version appears. Undo reverses an update. **File → Update Canvas from Template…** can also go back to an older version, and **Unlink Canvas from Template** makes a canvas forget its template.

**Recipes** put several canvas templates together, for example *Three Statements* = Income Statement (latest) + Balance Sheet (version 2) + Cash Flow (latest). In **File → Templates**, **+ New Recipe…** lets you pick the parts, choose "latest" or a fixed version for each, and put them in order. A check shows any socket that no plug in the parts feeds. Selecting a recipe shows its parts and **Build (add canvases)**: each part becomes its own canvas (linked to its template, so it can be updated later), and plugs and sockets connect them by name. Building warns if your copy of a fixed version isn't the one the recipe was made with, skips parts you don't have, and lists sockets nothing feeds. **Edit as new version…** saves a changed recipe as its next version.

When more than one plug feeds the same socket, their values are **added together**. That is sometimes intended, but it can double a number by accident, for example when a template is added a second time. Such a socket shows **⚡ name ×2** in amber on the canvas, and hovering over it lists the plugs. Building a recipe and the recipe check warn about it too.

**Functions** are formulas you write once and keep in your library, for example `Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`. **File → Functions** (also **Insert → My Functions**) opens the Functions manager: **+ New Function…** opens an editor where you type the whole definition (the name, the inputs in brackets, and the formula). The editor reads it as you type: it shows the name and inputs, points to any mistake in the text, and keeps **Save** off until the formula reads. The formula can use `+ - * / ^`, brackets, one comparison (`<`, `<=`, `>`, `>=`), `MIN MAX AVERAGE ABS MOD IFERROR`, and your other functions (the full syntax is in `docs/file-formats.md`). A call to another function is tied to one version of it: the latest when you save, or, in a new version, the one the previous version used; when two of your functions share a name, the editor asks which one you mean. Like templates, functions have versions: **Edit as new version…** saves a changed formula as the next version with a note; older versions can be deleted one at a time, the latest only with the whole function. Deleting a function your open model uses only warns: the model keeps its own copy and still calculates. **⇩ Export Functions** and **⇧ Import Functions** move functions between people as a functions file; importing never replaces yours, and a version whose number you already use for something else is added under the next number.

**Using a function on the canvas:** **Insert Function…** (Home → Insert, or Insert → My Functions; also the **ƒ Insert** button in the Functions manager) lists your functions with a search box; pick one (the latest version is chosen unless you pick another) and it appears as a box titled "ƒ Name v1", with one input on the left for each of its inputs and its result, with its unit, on the right. Drag an arrow onto an input's dot, or onto the box to fill its first empty input; an input with no arrow shows "?" where the formula needs it (hover for the reason). The model keeps its own copy of every function it uses (and of the functions those call), so it calculates the same when you send it to someone. When your library has a newer version, the box shows **⬆**: click it (or **⋯**) to **Update** this box, **Update every use…** (a list of every box using that function, with the arrows each would lose, to tick or untick), or **Not now** (asked again only when an even newer version appears). Arrows follow their inputs by name; an arrow into an input the new version no longer has is dropped, and fmIDE asks first. **⋯ → Change function or version…** swaps the box for another function or version in the same way, and double-clicking shows its definition. Copying and pasting boxes takes their functions along, into another document too (pasted functions also join your library). Deleting the last box that uses a function removes that function from the model; undo brings it back.

**Sharing with other people — library packs:** **File → Save as Library Pack…** puts templates, recipes and functions you pick into one file to share, with a title, your name as the author, a description and tags; what they need comes along (a recipe's parts, the functions a function calls). Everything in a pack is shared under the CC BY 4.0 licence (anyone may use, change and share it, with credit to you), so share only what is yours. **File → Open Library Pack…** shows a pack before anything is added: who made it, its licence, and for each item whether it is new, already in your library, a new version of one of yours (canvases made from that template will then offer it as an update, so add it only if you trust where the pack came from) or a different one with a name you already use (both are kept). Untick what you don't want and choose **Add to My Library**; nothing of yours is replaced. A community catalogue of packs is coming next. Files that are very large (over 50 MB) or unusually deeply nested are now refused with a message, in both apps.

Importing templates (or a workspace) never adds a template you already have (same name and content); if copies built up before, **File → Templates → Remove duplicates…** finds them — you choose what must match besides the calculation (name, layout, group, description) and which one of each to keep — and **Clear all templates** empties the library after asking.

**Timing, conditions and rounding** (new): the period number (1, 2, 3…), **if** (condition, then, else — only the branch taken is calculated, so `if(period = 1, Opening, previous Closing)` makes a corkscrew), **=**, **≠**, **and**, **or**, **not**, and **round**, **roundup**, **rounddown** calculate the same in fmIDE and in Excel, and functions can use them (`PERIOD()`, `IF`, `AND`, `OR`, `NOT`, `ROUND`…). They are in the palette and on the ribbon (Insert → Compare and Excel Functions); **if** and **round** show a labelled dot per input — drop an arrow on the dot you mean, or on the box for the first free one. Files that use them are system version 6: an older fmIDE or ExcelExporter asks before opening one.

A rectangle can have **several plugs**: click its 🔌 button to see one chip per plug name, ✕ to remove one, and type a name and press Enter to add another. Each name feeds the rectangle into every operator whose socket has that name, on any canvas — so "Income Tax" can feed both "to Income Tax expense" and "to CF Income Tax paid". Files saved before this open as before (their one plug becomes a list of one); older copies of fmIDE ask before opening a file saved by this version.

Opening someone else's `.fmide` never replaces your own setup: their templates and macros are added to yours, and your shortcuts and ribbon stay as they are.

Your own settings (keyboard shortcuts, ribbon layout, Quick Access Toolbar and KeyTips key) travel separately: **File → Export Preferences…** saves them to `fmIDE-preferences.json`, and **File → Import Preferences…** on another computer (or for a colleague) replaces theirs with yours. Your macros' own shortcuts are kept.

## Repository layout

```
apps/    the two apps as users open them — generated by `npm run build`, never edited by hand
src/     the source the apps are built from (edit these; Git keeps the history, so no version numbers in file names);
         src/shared/ holds the code both apps use
tools/   build.js — assembles each app from src/ into one self-contained HTML file
docs/    reference notes: file formats, format roles, automation API, decisions
tests/   the automated test suite — `npm test` (see tests/README.md)
```

## Changing the apps

Each app is still delivered as one self-contained HTML file, but its source is split into smaller pieces under `src/`:

```
src/fmide/            index.html (the page) · styles.css · js/01-….js … (the script, in order)
src/excel-exporter/   index.html · styles.css · js-head/ (built-in Excel writer) · js/ (the app)
src/shared/           code both apps use: escaping, the input-rectangle rule, format roles, file formats
```

1. Edit the pieces in `src/`.
2. `npm run build` — rewrites `apps/fmIDE.html` and `apps/ExcelExporter.html` (needs only Node).
3. `npm test`.
4. Commit `src/` and the rebuilt `apps/` together. CI rebuilds and fails if `apps/` doesn't match `src/`; `npm run build:check` does the same check locally.

The script pieces are plain fragments of one wrapped function — no `import`/`export` — joined in file-name order. In `index.html`, a line `<!-- build:css styles.css -->` or `<!-- build:js js -->` marks where a file or folder is inserted. Inside a script piece, a line `// build:include shared/<file>.js` pulls in a shared file, so logic both apps need is written once.

## Docs

- [`docs/tutorial-step7.md`](docs/tutorial-step7.md) — step-by-step tutorial for everything new since pull request #23: functions, the new operators, and the "differs from fmIDE" list
- [`docs/decisions.md`](docs/decisions.md) — agreed and open product decisions, and the build order
- [`docs/file-formats.md`](docs/file-formats.md) — every JSON file type, its version, and how to change a format safely
- [`docs/format-roles.md`](docs/format-roles.md) — how cell and rectangle formatting is defined in one place
- [`docs/fmIDE-automation-api.md`](docs/fmIDE-automation-api.md) — the `window.fm` actions used by the ribbon, shortcuts and macros
- [`tests/README.md`](tests/README.md) — running the test suite and updating snapshots
- [`CHANGELOG.md`](CHANGELOG.md) — notable changes

## Licence

Open core, Copyright 2026 Taro Yamaka — see [LICENSING.md](LICENSING.md):

- **fmIDE**, the shared code, build tools and tests: [Apache License 2.0](LICENSE) (open source).
- **ExcelExporter**: [free to use, including at work, but proprietary](src/excel-exporter/LICENSE) — the workbooks you make are yours; ExcelExporter itself may not be copied, modified or redistributed.
- **File-format documentation**: [CC BY 4.0](docs/LICENSE-CC-BY-4.0.txt), so anyone can build tools for fmIDE files.

Outside contributions are not accepted yet ([CONTRIBUTING.md](CONTRIBUTING.md)).
