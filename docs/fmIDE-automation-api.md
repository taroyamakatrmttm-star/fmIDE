# fmIDE automation API (window.fm)

_Generated from the app itself (`fm.actions()`), so it matches this version of fmIDE._

Every canvas interaction is an action. The Ribbon, shortcuts, Command Launcher (Ctrl/Cmd+K) and macros all call these. Call with named args `fm.createRect({x:100, y:80, name:'Revenue'})` or positionally `fm.createRect(100, 80, 'Revenue')`. Each call is one undo step; `fm.batch(fn)` groups calls into one all-or-nothing step.

## References
- `Revenue` — rectangle by name (aliases/blocks by the name they show)
- `#n12` — node by id · `@sel`, `@sel[0]` — selection (in a macro: as it was when the macro started) · `@cur` live selection · `@all` every node
- `$r1`, `$r1[0]` — macro variables · `Canvas::Name` — rectangle on another canvas
- Templates: `Income Statement` (latest version) · `Income Statement@latest` · `Income Statement@3` (version 3) · the same with the family id instead of the name (`3f2a…@2`, needed when two families share a name) · `#usr4` (one exact entry, this session only)
- Numbers accept expressions: `100 + $i*80`, `$periods`, `round($x/2)`. Text accepts `${var}`.

## Actions

### Insert
- **createRect**(x="(auto)", y="(auto)", name="New Node", value="0", uom="", w=170, h=64) — Create Rectangle. Adds a value rectangle at x, y. Its three text lines are name / value / unit of measure.
- **createOperator**(x="(auto)", y="(auto)", op="+") — Create Operator. Adds an operator node. For − ÷ ^ % and comparisons, inputs are taken left-to-right by x position.
- **createPeriodShift**(x="(auto)", y="(auto)", shift=-1) — Create Period Shift. Adds a period-shift connector: its output at period p is its input at period p + shift (e.g. −1 = prior period).
- **createAlias**(x="(auto)", y="(auto)", sourceCanvas="@current", source) — Create Alias. Adds an alias that shows another rectangle (on this or another canvas).
- **createBlock**(x="(auto)", y="(auto)", block, vertical=false) — Create Block Instance. Inserts an instance of a Block (a canvas with Output rectangles).
- **duplicate**(nodes="@sel", dx=24, dy=24) — Duplicate Nodes. Copies nodes (and the connections between them) offset by dx, dy — like Ctrl+drag.
- **aliasOf**(nodes="@sel", dx=30, dy=30) — Create Aliases Of. Creates an alias of each rectangle, offset by dx, dy — like Alt+drag.
- **insertTemplate**(template, mode="auto", onCollision="merge", decisions?) — Insert Template. Inserts a saved template: its name (the latest version), "Name@latest", "Name@3" (version 3), the same with its family id, or "#id". Modules: "here" (this canvas) or "newCanvas". Systems: "add" (merge alongside) or "replace".
- **updateCanvasFromTemplate**(canvas="@current", version="latest") — Update Canvas from Template. Rebuilds a canvas made from a canvas template from another version of it ("latest", or a number). Input values typed on the canvas are kept (matched by rectangle name); everything else comes from that version. Returns { version, kept, lostAliases }.
- **unlinkCanvasFromTemplate**(canvas="@current") — Unlink Canvas from Template. Makes a canvas forget the canvas template it was made from (no more update notices). Its content stays.

### Connect
- **connect**(from, to, fromPort="", toPort="") — Connect. Draws an arrow from one node to another. Block instances take a port: its name or 1-based number.
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

### Macros
- **message**(text) — Show Message. Shows a message box (useful in macros). ${var} inserts a variable.
- **runMacro**(macro) — Run Macro. Runs another macro (as one undo step; if any step fails, nothing is changed).

## Other helpers
fm.batch(fn), fm.run(name, args), fm.actions(), fm.find(ref), fm.nodes(), fm.edges(), fm.selection(), fm.canvases(), fm.command(commandId), fm.commands(), fm.runMacro(nameOrId)
