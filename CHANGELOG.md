# Changelog

Notable changes before this repository existed (recorded from the development history). From here on, Git keeps the detail.

## Four more tutorials (step 10, phase H3b)
- **Blocks: build once, use many times**, **Templates: save a canvas and reuse it**, **Your own functions** and **From fmIDE to Excel** join the first two, in the Help panel's Tutorials group and the Command Launcher.
- Some tutorials start from a small ready-made model.
- **Your library is looked after:** a template or function a tutorial saves is taken back out when you finish, unless you tick **Keep what I saved in my library** on the last step (exiting early always takes it out).
- The To Excel tutorial downloads the practice model, opens ExcelExporter and says what to do there.
- No file format changed.

## Tutorials and a welcome card (step 10, phase H3a)
- **Guided tutorials:** *Your first model* (price × quantity = revenue) and *Time: periods and last period* (a balance carried forward over five periods). A card in the corner shows one step at a time, a pulsing ring shows what to press, and each step moves on by itself once you have done it. Start them from the top of the Help panel (F1) or the Command Launcher.
- **Your work is never touched:** a tutorial runs on a practice canvas. Your model, undo history and document are set aside and come back exactly as they were when you finish or exit, and autosave pauses meanwhile, so even a crash brings back your own work. Save, Open and the like are refused while practising; the last step offers **Download what I built**.
- **Welcome card** on the very first start, in the corner over the sample model: take the 5-minute tour, explore the sample, start blank, or open Help. It blocks nothing; bring it back from the Help panel.
- **Fix:** a rectangle's 🕒 button sat under its resize corner, so clicking it could start a resize instead. It now sits on the bottom edge, just left of the corner.
- No file format changed.

## Help where you are (step 10, phase H2)
- **Ribbon buttons have a proper tip:** pause over a button to see its name, shortcut and what it does (even when it is greyed out, with why), and **Learn more** for the full guide; pressing **F1** while the tip shows opens that guide.
- **Every window has a ?** in its top-right corner (Templates, Functions, Format Presets, Periods, the Macro Builder and the others): it opens that window's guide in the Help panel beside it, with the window still open.
- **On a tablet**, holding a box offers **Help** for that kind of box.
- **ExcelExporter has a Help panel too**, with 14 plain-English guides (loading a model, tabs, rows, the Tree View, blocks, the Inputs tab, scenarios, formatting, the "differs from fmIDE" list, generating): **❓ Help** at the top right, **F1**, or the **?** beside each panel's heading. The page narrows beside it.
- The panel is now one piece of code shared by both apps. No file format changed.

## Help inside fmIDE (step 10, phase H1)
- **Press F1** (or ❓ at the top right, or **View → Help**) for the new **Help panel**: about 30 plain-English guides to every part of fmIDE — your first model, operators, arrows, periods and period shifts, blocks, plugs and sockets, templates and recipes, functions, library packs, files, formats, going to Excel, shortcuts, macros and touch — grouped, with a search box. It sits beside the canvas rather than over it, so you can follow the steps while you work, and shortcuts keep working. A command named in a guide is a button that runs it; searching also lists matching commands, each with ▶ to run it.
- **Every ribbon button says what it does:** pointing at one shows its name, its shortcut and one plain sentence.
- **The Command Launcher (Ctrl/Cmd+K) finds help topics** as well as commands.
- A ribbon you customised gets the new Help group once, at the end of the View tab; ❓ is always there.
- Works offline and in the single file; nothing is fetched. No file format changed.

## ExcelExporter: ← Back to fmIDE
- **ExcelExporter has a "← Back to fmIDE" button** at the top left. On a computer, where ExcelExporter opens in its own window, it closes that window, which shows fmIDE again as you left it; if a model is loaded it asks first (your layout is kept; the file is loaded again next time). With fmIDE added to an iPad's home screen, where ExcelExporter takes fmIDE's place, it goes back to fmIDE, as swiping in from the left edge does. Opened on its own, it opens fmIDE.
- **Fix:** Open ExcelExporter while ExcelExporter's window is already open brings that window to the front; it used to load it again, losing the model loaded there.
- No file format changed.

## Paste into free space; a recipe skips parts already built
- **Paste** puts the copied nodes, keeping their layout, in the nearest free space next to where they were, so pasting again and again no longer piles copies on top of each other or of the original.
- **Recipes:** a part whose template is already in the model (built by another recipe, or added by you), or that comes twice in one recipe, shows **Skip — already here as canvas “…”** in the Templates window, ticked. Build then uses that canvas (plugs and sockets connect to it by name) instead of adding a duplicate, and says what it skipped. Untick it to add the part again.
- `fm.insertTemplate` gains `skip` (part numbers not to build) and `skipExisting`; without them it behaves as before, so scripts and recorded macros don't change.

## ExcelExporter: inputs read from another tab come straight from the Inputs tab
- With the Inputs tab, a formula that reads an input from **another tab** (through an alias, a plug, a block port or a period shift) now points at the input's cell on the **Inputs tab**, where its numbers live, not at the input's own row (which only links to the Inputs tab). Example: Inventory's "Days in a period" is now `='Inputs'!E15`, not `='Days in a Period'!E4`.
- On the input's own tab, formulas still read its row there. The values don't change.
## Touch, third part: the screen (step 9, phase 9c)
- **fmIDE fits a tablet's screen.** It used to be drawn 980 pixels wide and shrunk on a tablet held upright; now it uses the screen's own width, like ExcelExporter. A double-tap never zooms the page, and two fingers on the canvas don't zoom it (zoom is a later step); elsewhere two fingers still zoom the page.
- **The ribbon by finger:** arrows at its ends show there is more to swipe to (tap one to scroll); on a touchscreen its buttons are taller. In a window under 900 pixels wide the command search shrinks to its 🔎, so the top row (and the collapse button) fits.
- **Typing on a tablet:** text boxes are large enough that the browser doesn't zoom in on them, and dialogs and the text being typed stay above the on-screen keyboard.
- **ExcelExporter's Tree view by touch:** press and hold a row for its menu, which also offers **Add to / Remove from selection** and **Select from the last row to here** (what Ctrl- and Shift-click do); double-tap a row to rename it.
- The mouse works exactly as before. No file format changed.

## Resizable windows and the Templates tree
- **Resize the large windows** from their bottom-right corner: Templates, Functions, Format Presets, Browse Library, the Library pack preview, the Macro Builder and Customize Ribbon. Each keeps the size you give it (in your own settings, like the ribbon; never taken from someone else's file, and never larger than the screen); a double-click on the corner puts it back to its own size. Lists and previews grow with the window.
- **Browse Library** and **Templates** open larger than before, so their text is easier to read.
- **The Templates list is a tree**: each group opens and closes (▾ / ▸, with how many templates it holds), and stays as you left it. Search still finds every template, whatever group is closed; ↑ ↓ and Enter work as before.
- No file format changed (the sizes and closed groups are part of the UI settings saved with your workspace).

## New nodes never land on others; the Macro Builder moves on; ExcelExporter starts in formula order
- **fmIDE: new nodes go into free space.** Add Rectangle, Add Operator, Add Period Shift, the Alias, Block and Function pickers, and `fm.create…` without coordinates put the new node near the middle of the view, in the nearest spot where it overlaps nothing. Duplicate and aliases made with the default offset move together to free space, keeping their layout. The automatic aliases a socket gets from other canvases no longer pile on top of each other or of other nodes. Coordinates given explicitly (in a macro or a script) are kept exactly, so recorded macros replay as before.
- **Macro Builder: "▶ Run selected step" selects the next step** (after what is inside a group, repeat or for-each), so pressing it again steps through the macro; on the last step it says so.
- **ExcelExporter: a new layout starts sorted** by calculation order, inputs first, formula order within each group (as "Apply sort" with those choices would); a saved layout keeps its order.
- **Fix (ExcelExporter):** sorting by calculation order or A→Z could split a vertical block's Vintage 1…N and Total rows apart; they now stay together in vintage order.
- **Fix (ExcelExporter):** double-clicking a Tree View row to rename it could miss when the selection bar appearing pushed the list down under the second click; the row just clicked is now renamed.
- No file format changed.

## Touch, second part (step 9, phase 9b)
- **Press and hold a node** (about half a second, finger still) for a menu: **Draw arrow from here** (then tap the node, or its input dot, the arrow goes to), **Make alias**, **Duplicate**, **Add to / Remove from selection**, **Edit…** (what a double-click does), **Properties…** (the 🎨 format window), **Delete**. With the node in a selection, it acts on the whole selection. The menu also shows what hovering would: a calculation error, or the plugs feeding a "⚡ ×N" socket.
- **Press and hold on empty canvas, then drag,** to select with a box. A quick swipe still scrolls.
- **Double-tap** does what a double-click does, everywhere in fmIDE (edit a rectangle, the operator picker, rename a canvas tab…).
- **The canvas tab strip scrolls with a swipe**; to move a tab, press and hold it, then drag. A finger can also scroll the text of a node being edited.
- **Larger invisible touch areas** for the dots, the resize corner and the node buttons when you use a finger; nothing looks different, and the mouse doesn't get them.
- The mouse works exactly as before. No file format changed.

## ExcelExporter: a row's own format, indent, and a full right-click menu in the Tree View
- **🎨 on every row**, not just custom rows: give a row its own fill, font colour, bold, border and number format in Excel, over what fmIDE's format roles give it. With several rows selected, a change applies to all of them. **Reset to fmIDE's format** takes it off.
- **Indent**: **Alt+Shift+→ / ←** (or Indent / Outdent in the selection bar and the menu) indents the selected rows' labels in Excel, like Excel's Increase Indent (Alt+H+6), up to 15 steps.
- **Right-click** on rows now has every command of the selection bar — Move Up/Down/Top/Bottom, Include/Exclude, Mark/Unmark Constant, Add/Remove Scenarios, Indent, Format, Reset, Move to another tab — so there is no need to scroll back up to the bar.
- The mapping file is version 2 (a row may carry its own format and indent); version 1 files open unchanged, and an older ExcelExporter asks before opening a version 2 file. Formats and indents from a file are checked: colours must be real colours, numbers are bounded.

## Touch, first part (step 9, phase 9a)
- **On a touchscreen, a finger now works on the canvas:** move nodes (several at once when they are selected), draw an arrow from a node's dot onto another node, resize a node by its corner, drag a canvas tab to reorder, and draw in the curve editor (📈). A pen works the same way. The page no longer scrolls while your finger is on a node, a tab or the curve.
- One finger on empty canvas still scrolls it, and a tap there still clears the selection.
- The mouse works exactly as before. What still needs a mouse or keyboard (right-drag, Alt-drag, Ctrl-drag, adding to a selection, the selection box) comes to touch in the next phase.
- No file format changed.

## ExcelExporter: tidier formulas and new defaults
- **Brackets only where Excel needs them.** A formula like `=(F4*(1-F5))` is now written `=F4*(1-F5)`. Brackets stay where Excel's order of operations needs them, and around the right-hand side of an equal level (`A1-(B1-C1)`, `A1+(B1+C1)`), so Excel adds in the same order as fmIDE. The values don't change; the agreement tests check this.
- **Links before Inputs.** A rectangle that only pulls a value from another sheet, through a plug or an alias, used to be written `=(Sales!E7)` and coloured as a Calculation. It is now written `=Sales!E7` and gets the **Links** format.
- **New defaults for a new layout** (a saved layout keeps your settings):
  - "Enforce Input / Calc / Output sections" is off.
  - "Order within group" is formula order.
  - The group headers on the gathered Inputs tab show the period labels.
- No file format changed.

## Taking down the library's last pack
- **Fix:** when every pack in the community library has been taken down, the site's build stopped with an error (the library has no `packs/` folder then), so the removal could not be published. It now publishes an empty catalogue, and Browse Library says the library has no packs yet.

## Browsing the library inside fmIDE (step 8, phase 8d)
- **File → Browse Library…** (on the published site) lists the community library's packs: search, filter by tag or by what a pack holds, sort, and see a pack's items, licence and credit, with the items you already have marked. **Preview and add…** opens the usual Open Library Pack preview; nothing is added without it.
- Every pack is checked against the catalogue's list — exact size and SHA-256 fingerprint, and its id — before it is read; list entries that fail fmIDE's checks are left out and counted; everything is shown as plain text.
- fmIDE reads only from its own site, and only when you browse; nothing is sent. The single file (`apps/fmIDE.html`) makes no network request at all: there the command says where the library is. Offline, the library says it can't be reached; nothing of it is stored.
- `window.fm`: `listLibrary`, `previewLibraryPackFromLibrary`, `addFromLibrary` (they answer later, so they can't be used in macros).
- The site's build now reads its own `index.json` the way fmIDE does, and stops if any pack would be left out. No file format of the apps changed; the security policy didn't change.

## The library's catalogue (step 8, phase 8c-3)
- The published site has a **catalogue of the community library** at `/library`: every approved pack, with a page each listing its templates, recipes and functions (plugs and sockets, formulas), a download of the pack, the credit CC BY 4.0 asks for, and a "Report this pack" link. Plain pages with no JavaScript, under their own strict security policy; everything from a pack is shown as plain text.
- The library repository is a git submodule of fmIDE, `library/`, pinned to one commit; moving the pointer publishes new packs. The build checks every pack again and publishes nothing if one fails.
- A new pack never makes fmIDE say "a new version is ready": the catalogue is not part of the app's offline copy or its version. `/library/index.json` lists the packs for browsing inside fmIDE later.
- No app changed; no file format of the apps changed.

## The community library is set up (step 8, phase 8c-2, part 2)
- The library repository `fmide-library` (private for now) has its README, draft submission terms, licences, records, pull-request and report templates, and a check that runs fmIDE's pack checker on every pull request and posts its report. The first pack (the owner's) went through it.
- **Fix:** the checker now refuses a library pack placed outside the library's `packs/` folder. Before, it passed one with only a warning, without checking it as a pack.

## The library's rules (step 8, phase 8c-2, part 1)
- **`tools/check-pack.js --library`** checks the whole community library, and what a pull request changes in it: only a family's owner (the GitHub account of its first pack) adds versions; someone else's version is shared again only as an exact copy with its origin; pack and version ids are never used again, even after a takedown; the author name matches the submitting account; approved packs are never edited and the library's records are only ever added to. `--write-records` adds the records a new pack needs; `--markdown` gives the report for a pull request, with every text from a pack kept where it can't render.
- No app changed; no file format of the apps changed. The library's own record files are described in `docs/file-formats.md`.

## The library's pack checker (step 8, phase 8c-1)
- **`tools/check-pack.js`** (`npm run check-pack -- FILE`) checks a library pack before it joins the community library: the file (at most 5 MB), the details and licence, every template, recipe and function, and characters that hide or reverse text. It reads packs with fmIDE's own code and is stricter: anything fmIDE would quietly leave out or tidy is an error. It prints a report (or JSON) and fails with exit code 1.
- fmIDE's file reader moved into shared code (`src/shared/fmide-files.js`) so the checker can use it; fmIDE reads every file exactly as before. No file format changed.

## Where items came from (step 8, phase 8b)
- Templates and functions added from a library pack now remember the pack and its author. The **Templates window** and the **Functions manager** show "From the library pack "…" by … · CC BY 4.0", and which versions of a template came from where; **Update this canvas** says where the new version came from.
- **The family rule:** when a pack would add a version to a template or function that came from another author — or that you made yourself — the preview says so in red and leaves it unticked. Authors are compared by the pack's author, not by what its items claim.
- Sharing someone's item again keeps their name on it (the credit CC BY 4.0 asks for); a new version you save is yours.
- **Files:** templates version 6, workspace 6, functions 2, library pack 2. Older files open as before; an older fmIDE or ExcelExporter asks before opening a newer one. Models (systems, modules) are unchanged and never carry the record.

## Library packs: sharing templates, recipes and functions (step 8, phase 8a)
- **File → Save as Library Pack…** writes one file of templates, recipes and functions to share, with a title, author, description, tags and the licence (CC BY 4.0). A recipe takes its parts along and a function the functions it calls.
- **File → Open Library Pack…** shows who made a pack and its licence, and what each item would do to your library (new, already there, a new version of one of yours, or a name you already use) before anything is added; untick what you don't want. Nothing of yours is replaced. A pack without an author or with another licence is refused.
- New file kind `fmIDE-library-pack` version 1. No other file format changed.
- **Fix: files nested very deeply or very large.** Opening a file nested thousands of levels deep stopped both apps' readers with no message (a stack overflow). Every file opened is now refused, with a message, when it is over 50 MB, nested more than 100 levels or holds more than 5 million values — far beyond any real model. The autosave is never refused.

## New operators, part 2: on the canvas (phase E1b)
- The new operators are in the palette, the operator picker, the Command Launcher (Insert Operator period, if, =, ≠, and, or, not, round, roundup, rounddown) and on the ribbon: Insert → Compare has = and ≠, Insert → Excel Functions the others. A ribbon you customised gets them once, in the groups where you keep the comparisons and the Excel functions.
- **if** and **round** (and roundup, rounddown) show a labelled dot for each input — condition, then, else; value, digits. Drop an arrow on the dot you mean, or on the box for the first input without one. The period number takes no arrows in.
- Changing an operator into if or round gives its arrows the inputs left to right; changing it back takes them away (one undo).
- The existing Insert Operator commands keep their numbers, so your shortcuts and macros still work.

## New operators, part 1: the calculation (phase E1a)
- **New operators**, calculated alike in fmIDE and in Excel: the **period number** (1, 2, 3… — in Excel the sheet's "Period #" cell), **if** (condition, then, else; only the branch taken is calculated), **=** and **≠**, **and**, **or**, **not**, and **round**, **roundup**, **rounddown** (value, digits; like Excel, `round(2.675, 2)` is 2.68). Functions can use them too: `PERIOD()`, `IF`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `=` and `<>`.
- For now they can be used through files and `window.fm` (`fm.createOperator`, and `fm.connect` taking an if's or round's input by name). Placing and wiring them on the canvas comes in phase E1b; the palette keeps its 15 operators until then.
- A corkscrew can now be written `if(period = 1, Opening, previous Closing)`: the branch not taken may reach before the first period.
- **Files:** system version 6, module 4, workspace 5, templates 5. Older files open as before; an older fmIDE or ExcelExporter asks before opening a newer file.
- **Changed:** an operator fmIDE doesn't know (only a hand-edited file has one) now shows "?" and `#N/A`; before, it passed its first input through. Comparisons now treat numbers that differ only in their last few binary digits as equal, as Excel does (`0.1 + 0.2 = 0.3`).
- **Fix (from phase D3):** a function whose own IFERROR catches a period before the first, feeding a rectangle directly, could show a different number in Excel than in fmIDE. Both now follow the function's formula.

## Fix: nested function calls calculated slowly
- A function that uses its input several times, nested inside others of the same kind, took four times as long for each level: seconds at 11 levels, hours at the 16 allowed, so such a file could make fmIDE (and ExcelExporter's unit column) stop responding. The same call written several times in one formula is now worked out once; 16 levels calculate at once. Values and units are unchanged.

## Function plugins, part 3: functions in Excel (phase D3)
- **ExcelExporter writes function calls out in full.** A cell that reads a function now holds the function's formula, with each input replaced by the cell it reads: `Margin(Revenue, Cost)` becomes `=((E5-E6)/E5)`. Calls inside calls are written out inside one another, `MIN`, `MAX`, `AVERAGE`, `ABS`, `MOD` and `IFERROR` use Excel's own functions, and brackets follow Excel's order of operations. This works on every tab, inside block instances and vertical blocks, and with the Inputs tab. Before, such a cell showed `#N/A`.
- A comparison inside a function gives 1 or 0 in Excel, as in fmIDE (not TRUE/FALSE).
- **A new Functions tab** (last in the workbook, only when the model uses functions) lists each function version the formulas write out: name, version, definition, description, note and the rows that use it.
- **Before download**, the "differs from fmIDE" list now also names every function case fmIDE shows "?" for (a missing or unreadable definition, functions calling each other in a loop, calls nested too deep, a wrong number of inputs, an input the formula reads with no arrow); Excel shows `#N/A` there.
- A formula that a function call would make longer than Excel allows (8,192 characters) or nest deeper than 64 levels is written as `#N/A` and listed before download, with the advice to put a rectangle in between. Writing such a call stops as soon as it is too long, so a file that repeats inputs over and over can't freeze the page.

## Fix: nodes from files without a size
- A node in a system or module file without a width or height (or with one that isn't a positive number), as in hand-written files such as some of the samples, now gets the usual size for its type. Before, it drew at the wrong size and its arrows were drawn to nowhere. Nothing in the calculation changes.

## Fix: editing nodes in models from hand-written files
- In a model whose node ids came from a file rather than from fmIDE (such as the sample files), editing a node on the canvas failed with "There is no rectangle named …", or could change a different rectangle whose name happened to match the id. This affected typing a rectangle's text, choosing an operator symbol or period shift, plugs, sockets, block roles, formats, per-period values, the reducer chip and the vertical block's port toggle. The canvas now always refers to the node by its id.
- A vertical block's broadcast/indexed toggle couldn't be clicked with the mouse (the output rows covered it, and pressing on it redrew the block). It works again.

## Function plugins, part 2b: functions on the canvas (phase D2b)
- **Insert Function…** (Home → Insert and Insert → My Functions, or the Functions manager's **ƒ Insert**) places a function from your library as a box: "ƒ Name v1", one labelled input per input, and its value and unit. Arrows go into a named input (dragged onto its dot, or onto the box for the first empty one). A box whose function is missing from the model, or can't be read, still draws, with a warning and "?" explaining why.
- **Updating:** a box on an older version than your library's latest shows **⬆**. Update one box, or **Update every use…** in a window that lists every box using that function (the "Not now" ones unticked) and the arrows each would lose. Arrows follow their inputs by name; lost ones are listed first; one undo reverses it all. **Not now** is remembered on the box (`fn.skipped`, an optional field older versions ignore; no file format changed). **Update Function…** is also a command. **⋯ → Change function or version…** swaps a box in place.
- **Copy and paste** take the functions along, into another document too, and add them to your library. Deleting the last box that uses a function removes it from the model, in the same undo step.
- Fix (from phase D1): bringing in a module, a system or a template, or pasting, where the model already had a *different* version under the same number made the incoming boxes show "?". That version now comes in under the next free number in the model, and its boxes follow it.
- Fix: dragging an arrow didn't work in a model whose node ids came from a hand-written file (such as the function samples).
- `window.fm`: `insertFunction`, `updateFunctionNode`, `changeFunction`, `updateFunctionUses`, `skipFunctionUpdate`, `addFunctionDefinition`; `fm.connect` takes a function's input by name or number; `fm.nodes()` shows a function node's `fn`. Macros record them. A ribbon you customised gets Insert Function… and Update Function… in its My Functions group once.
- ExcelExporter still writes `#N/A` for a function call until phase D3.

## Function plugins, part 2a: the Functions manager (phase D2a)
- fmIDE has a **Functions manager** (File → Functions, or Insert → My Functions): your function library, listed by function with each one's versions, notes, formula and inputs. **+ New Function…** opens an editor that reads the definition as you type, shows where a mistake is, and keeps Save off until the formula reads. Calls to your other functions are tied to one version; when two functions share a name, the editor asks which one you mean.
- Versions work as for templates: **Edit as new version…**, change notes, older versions deleted one at a time and the latest only with the whole function. Deleting a function the open model uses warns but doesn't refuse: the model carries its own copy.
- **Import Functions** and **Export Functions** read and write the functions file (version 1, unchanged). Importing never replaces your functions; a version whose number you already use for a different version is added under the next number, and calls to it follow it.
- Fix (from phase D1): opening a model that carries a different version under a number your library already uses no longer puts two "version 2"s in the library; the library's copy is renumbered, and the model keeps and calculates with its own.
- Undo now also covers the function definitions a model carries.
- The Insert tab's group of built-in operators MIN, MAX, AVERAGE, ABS and MOD is now called **Excel Functions**, next to the new **My Functions** group. A ribbon you customised gets My Functions once, on its Insert tab.
- `window.fm`: `saveFunction`, `listFunctions`, `getFunction`, `setFunctionInfo`, `deleteFunction`, `importFunctions`, `exportFunctions`; macros record them. Placing functions on the canvas (phase D2b) comes next.

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
