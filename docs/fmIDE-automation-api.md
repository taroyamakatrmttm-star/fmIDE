# fmIDE automation API (window.fm)

_Generated from the app itself (`fm.actions()`), so it matches this version of fmIDE._

Every canvas interaction is an action. The Ribbon, shortcuts, Command Launcher (Ctrl/Cmd+K) and macros all call these. Call with named args `fm.createRect({x:100, y:80, name:'Revenue'})` or positionally `fm.createRect(100, 80, 'Revenue')`. Each call is one undo step; `fm.batch(fn)` groups calls into one all-or-nothing step.

## References
- `Revenue` — rectangle by name (aliases/blocks by the name they show)
- `#n12` — node by id · `@sel`, `@sel[0]` — selection (in a macro: as it was when the macro started) · `@cur` live selection · `@all` every node
- `$r1`, `$r1[0]` — macro variables · `Canvas::Name` — rectangle on another canvas
- Templates: `Income Statement` (latest version) · `Income Statement@latest` · `Income Statement@3` (version 3) · the same with the family id instead of the name (`3f2a…@2`, needed when two families share a name) · `#usr4` (one exact entry, this session only)
- Function nodes: by id (`#n12`), like other nodes; their inputs by name (`Revenue`, capitals don't matter) or number from 1 (the file counts `toPort` from 0). `fm.nodes()` shows a function node's `fn` (`{ family, version, versionId, name, skipped? }`).
- Functions: `Margin` (latest version) · `Margin@latest` · `Margin@2` (version 2) · the same with the family id (needed when two functions share a name) · or `{ family, version, versionId }`
- Numbers accept expressions: `100 + $i*80`, `$periods`, `round($x/2)`. Text accepts `${var}`.
- Position: an `x`, `y` left out ("(auto)") means near the middle of the view, in the nearest free space — a new node never lands on another. Given `x`, `y` are kept exactly.

## Actions

### Insert
- **createRect**(x="(auto)", y="(auto)", name="New Node", value="0", uom="", w=170, h=64) — Create Rectangle. Adds a value rectangle at x, y (left out: near the middle of the view, where it overlaps nothing). Its three text lines are name / value / unit of measure.
- **createOperator**(x="(auto)", y="(auto)", op="+") — Create Operator. Adds an operator node. For − ÷ ^ % and comparisons, inputs are taken left-to-right by x position; if and round take each input by name (fm.connect's toPort).
- **createPeriodShift**(x="(auto)", y="(auto)", shift=-1) — Create Period Shift. Adds a period-shift connector: its output at period p is its input at period p + shift (e.g. −1 = prior period).
- **createAlias**(x="(auto)", y="(auto)", sourceCanvas="@current", source) — Create Alias. Adds an alias that shows another rectangle (on this or another canvas).
- **createBlock**(x="(auto)", y="(auto)", block, vertical=false) — Create Block Instance. Inserts an instance of a Block (a canvas with Output rectangles).
- **duplicate**(nodes="@sel", dx=24, dy=24) — Duplicate Nodes. Copies nodes (and the connections between them) offset by dx, dy — like Ctrl+drag. With the default offset, the copies move together to the nearest place where they overlap nothing.
- **aliasOf**(nodes="@sel", dx=30, dy=30) — Create Aliases Of. Creates an alias of each rectangle, offset by dx, dy — like Alt+drag. With the default offset, the aliases move together to the nearest place where they overlap nothing.
- **insertTemplate**(template, mode="auto", onCollision="merge", decisions?, skip?, skipExisting=false) — Insert Template. Inserts a saved template: its name (the latest version), "Name@latest", "Name@3" (version 3), the same with its family id, or "#id". Modules: "here" (this canvas) or "newCanvas". Systems: "add" (merge alongside) or "replace". Recipes: "add" builds one canvas per part and returns { canvases, warnings, skipped, unfedSockets }; skip lists part numbers (from 1) not to build, and skipExisting skips every part already here (a canvas of the same template, or an earlier part of the recipe).
- **saveRecipe**(name="", parts, group="My Templates", description="", note="", newVersionOf="") — Save Recipe. Saves a recipe: canvas templates added together, each "Name" / "Name@latest" (follows the latest version) or "Name@2" (that version). A name already in use fails unless newVersionOf names that recipe. Returns the recipe as "Name@version".
- **updateCanvasFromTemplate**(canvas="@current", version="latest") — Update Canvas from Template. Rebuilds a canvas made from a canvas template from another version of it ("latest", or a number). Input values typed on the canvas are kept (matched by rectangle name); everything else comes from that version. Returns { version, kept, lostAliases }.
- **unlinkCanvasFromTemplate**(canvas="@current") — Unlink Canvas from Template. Makes a canvas forget the canvas template it was made from (no more update notices). Its content stays.
- **saveFunction**(text, description="", note="", newVersionOf="", calls?) — Save Function. Saves a function to your library: text is the whole definition, like "Margin(Revenue, Cost) = (Revenue - Cost) / Revenue". A name already used fails unless newVersionOf names that function (its next version). calls pins the functions it calls, like {"Margin": "Margin@1"}; without it a new version keeps the pins of the latest version, and a name one function has takes its latest version. Returns "Name@version".
- **listFunctions**(of="library") — List Functions. Returns your function library, one entry per function: { family, name, latest, versions: [{ version, versionId, name, inputs, text, description, note, calls }] }, newest version first. of: "model" lists instead the definitions the open model carries (the ones it calculates with), one entry per version.
- **getFunction**(function) — Get Function. Returns one version from your library: { family, version, versionId, name, inputs, text, description, note, calls, latest }.
- **setFunctionInfo**(function, description="", note="") — Edit Function Description. Changes the description and change note of one version in your library (neither changes the calculation).
- **deleteFunction**(function, whole=false) — Delete Function. Deletes from your library: "Name" (or whole: true) the whole function with every version; "Name@2" one older version. The latest version goes only with the whole function, so its number is never used again. The open model keeps its own copy. Returns how many versions were deleted.
- **insertFunction**(function, x="(auto)", y="(auto)") — Insert Function. Adds a function node for a version in your library: "Name" (the latest version), "Name@latest", "Name@2", or the same with the family id. The version, and every function it calls, is copied into the model. Fails when the model already carries a different version under the same number (update its nodes first).
- **updateFunctionNode**(node, version="latest") — Update Function Node. Moves one function node to another version of its function in your library ("latest", or a number). Arrows follow their inputs by name; an arrow into an input the new version doesn't have is dropped. Returns { version, dropped: [{ node, canvas, input, from }] }.
- **changeFunction**(node, function) — Change Function. Switches a function node to another function or version from your library ("Name", "Name@2", …), like a block's "Change block". Arrows follow their inputs by name; the others are dropped. Returns { dropped: [{ node, canvas, input, from }] }.
- **updateFunctionUses**(function, nodes?) — Update Every Use of a Function. Moves the model's nodes of a function to a version in your library ("Name" = the latest, "Name@3"). Without nodes: every node on an older version, except those marked "Not now" for it or a newer one; nodes on that version or newer are left alone. nodes names the ones to update ("#id" or "Canvas::#id"). One undo step. Returns { updated, dropped: [{ node, canvas, input, from }] }.
- **skipFunctionUpdate**(node) — Not Now (Function Update). Declines the newer version of a function node's function for now: its ⬆ goes away until an even newer version appears (the node remembers the version it declined, fn.skipped).
- **addFunctionDefinition**(node) — Add Function Definition from Library. For a function node whose definition is missing from the model, copies that exact version (the same versionId) from your library into the model, with what it calls.

### Connect
- **connect**(from, to, fromPort="", toPort="") — Connect. Draws an arrow from one node to another. Block instances, function nodes and the operators with named inputs (if: condition, then, else; round, roundup, rounddown: value, digits) take a port: its name or 1-based number (a function node's input by the name the definition gives it).
- **deleteEdge**(from, to, toPort="") — Delete Connection.

### Edit
- **setText**(node, text) — Set Rectangle Text. Replaces all of a rectangle's text (name, value and unit lines).
- **setName**(node, name) — Rename Rectangle.
- **setValue**(node, value) — Set Rectangle Value.
- **setUOM**(node, uom) — Set Unit of Measure.
- **setOperator**(node, op) — Set Operator Symbol.
- **setShift**(node, shift) — Set Period Shift.
- **setPlug**(node, plug="") — Set Plug. Replaces all of this rectangle's plugs with one name. A plug name auto-feeds the rectangle into every operator whose socket has the same name.
- **setPlugs**(node, plugs="[]") — Set Plugs. Replaces all of this rectangle's plugs with a list of names — one rectangle can feed several differently named sockets.
- **addPlug**(node, plug) — Add Plug. Adds a plug name to this rectangle, keeping its other plugs.
- **removePlug**(node, plug) — Remove Plug. Removes one plug name from this rectangle (names match regardless of capitals).
- **setSocket**(node, socket="") — Set Socket.
- **setRole**(node, role) — Set Block Role. Marks a rectangle as a Block input, output, or the Vertical Index.
- **setReducer**(node, reducer) — Set Vertical Reducer.
- **setVertical**(node, vertical) — Set Block Vertical.
- **setPortMode**(node, port, indexed) — Set Port Indexed/Broadcast. On a vertical block instance: indexed = instance i reads this input at period i; broadcast = every instance sees the same value.
- **relinkAlias**(node, sourceCanvas="@current", source) — Relink Alias.
- **relinkBlock**(node, block) — Relink Block Instance.
- **setLiteralPeriods**(node, periods="all") — Set Periods Using Own Number. Which periods use the rectangle's own typed number: "all", "first", or a list like "1,3,5-8" (1-based).
- **setPeriodValues**(node, values="", min?, max?) — Set Per-Period Values. Explicit value for each period ("10, 12, 15, …"), padded flat to the timeline; blank clears. Inputs only.
- **deleteNodes**(nodes="@sel") — Delete Nodes.
- **deleteSelected**() — Delete Selected.
- **clearCanvas**() — Clear Canvas. Removes every node and arrow on the current canvas (no confirmation).
- **copy**(nodes="@sel") — Copy.
- **cut**(nodes="@sel") — Cut.
- **paste**() — Paste.

### Format
- **setStyle**(node, style?) — Set Rectangle Format. Per-rectangle format as JSON {numberFormat, fill, border, font, keepColours}; blank resets to the rectangle's format role ("Inputs" or "Calculations").
- **applyFormat**(nodes="@sel", preset) — Apply Format Preset.

### Arrange
- **move**(nodes="@sel", dx=0, dy=0) — Move Nodes.
- **moveTo**(node, x, y) — Move Node To.
- **resize**(node, w, h) — Resize Node.
- **align**(mode, nodes="@sel") — Align Nodes.
- **distribute**(axis, nodes="@sel") — Distribute Nodes.

### Select
- **select**(nodes) — Select Nodes.
- **addToSelection**(nodes) — Add to Selection.
- **selectAll**() — Select All.
- **clearSelection**() — Clear Selection.
- **selectEdge**(from, to) — Select Connection.

### Canvas
- **addCanvas**(name="") — New Canvas.
- **switchCanvas**(canvas) — Go to Canvas.
- **renameCanvas**(canvas="@current", name) — Rename Canvas.
- **deleteCanvas**(canvas="@current") — Delete Canvas. Deletes a canvas and everything on it (no confirmation).
- **moveCanvas**(canvas="@current", position) — Move Canvas (reorder tabs). Moves a canvas tab to a position (1 = first). Same as dragging the tab.
- **clearAll**() — Clear All Canvases. Removes every canvas and leaves one empty canvas named "Canvas 1" (no confirmation). Periods, templates, format presets and macros are kept.

### Periods
- **setPeriodCount**(count) — Set Number of Periods.
- **renamePeriod**(index, label) — Rename Period.
- **setPeriod**(index) — View Period.
- **nextPeriod**() — Next Period.
- **prevPeriod**() — Previous Period.

### Compute
- **evaluate**() — Evaluate.
- **getValue**(node, period?) — Get Computed Value. Evaluates the model and returns a node's value (a block instance returns its outputs). Save it to a variable to use in later steps.

### File
- **saveSystem**() — Save System (download).
- **saveModule**() — Save Module (download).
- **exportWorkspace**() — Export Workspace (download).
- **importFunctions**(file, allowNewer=false) — Import Functions. Adds the functions in an fmIDE-functions file (its JSON) to your library, following the template rules: versions already there are skipped, a version whose number is taken is added under the next number. A file from a newer fmIDE fails unless allowNewer is true. Returns { added, present, renumbered }.
- **exportFunctions**(download=true, functions?) — Export Functions. Writes an fmIDE-functions file: the functions named in functions (each with all its versions), or the whole library, and every function they call. Downloads it unless download is false; returns the file's content.
- **saveLibraryPack**(title, author, description="", tags?, templates?, functions?, download=true) — Save as Library Pack. Writes a library pack: a file of templates, recipes and functions to share, licensed CC BY 4.0. templates and functions are lists of references ("Name" for the latest version, "Name@2", or the family id); a recipe brings its parts and a function the functions it calls. title and author are required. Downloads it unless download is false; returns the file's content.
- **previewLibraryPack**(file) — Preview Library Pack. Reads a library pack (its JSON) without adding anything: { pack: { id, title, author, licence, description, tags, created }, items: [{ key, type, kind, name, version, status, statusText, needs }] }. status is "new", "present" (already in your library), "new-version" (adds a version to one you have) or "same-name" (a different one of yours has this name).
- **openLibraryPack**(file, items?, allowNewer=false) — Open Library Pack. Adds a library pack's items to your library, by the usual import rules (nothing of yours is replaced; a version whose number is taken is added under the next number). items: the keys previewLibraryPack gives (default: all); each brings what it needs. A pack from a newer fmIDE fails unless allowNewer is true. Returns { templates: { added, present, renumbered }, functions: { … } }.

### Macros
- **message**(text) — Show Message. Shows a message box (useful in macros). ${var} inserts a variable.
- **runMacro**(macro) — Run Macro. Runs another macro (as one undo step; if any step fails, nothing is changed).

## Other helpers
fm.batch(fn), fm.run(name, args), fm.actions(), fm.find(ref), fm.nodes(), fm.edges(), fm.selection(), fm.canvases(), fm.command(commandId), fm.commands(), fm.runMacro(nameOrId)
