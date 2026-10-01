# Build step 12 — faster canvas building

**Status:** proposed (1 Oct 2026), not started. Two independent phases, **12a** and **12b**; either can go first. Each phase gets its own plan, approved by the owner before any change, and its own pull request. The choices marked **Owner's choice** below are open: the recommendation is a starting point, not a decision.

**Goal:** fewer clicks to lay out a model. Two requests from the owner:

1. Shapes snap to evenly spaced points, horizontally and vertically (a grid), so a canvas lines up neatly without dragging by eye.
2. Type a list of names and get that many rectangles at once, instead of adding a rectangle, double-clicking it and typing its name ten times over.

Neither changes the calculation, ExcelExporter or any file format (see each phase).

---

## 12a — snap to grid

**What is there today:**

- The canvas already draws a dot every 22 pixels (`#canvas` in `src/fmide/styles.css`: `background-size: 22px 22px`), but nothing snaps to it.
- Dragging a node snaps only to *other nodes* (`computeSnap` in `src/fmide/js/08-node-interaction.js`: left, right and centre edges within `SNAP_THRESHOLD`, 6 pixels, shown by the blue guide lines). Alias drags use the same snap.
- Resizing (`startResize`), Distribute Horizontally / Vertically (`distributeSelected` in `06-align-marquee-computation.js`) and where new nodes go (`spawnPoint` → `findFreeSpot`) ignore any grid.
- Modifier keys on a node are already taken: Alt+drag makes an alias, Shift restricts to one axis, Ctrl / Cmd adds to the selection.

**Proposed:**

- **Snap to Grid** — a new on/off command (Arrange tab, in a new Grid group with Snap Selection to Grid; also in the Command Launcher). When on, a dragged node's top-left corner lands on the nearest grid point, horizontally and vertically, for one node or a whole selection (the selection keeps its shape: the node you grabbed snaps, the rest move with it). Works the same with a finger or pen (step 9's drag path is shared).
- **Grid spacing** — the dots and the snap always agree: the dots are drawn at the grid's spacing.
- **New nodes** (Add Rectangle, pickers, paste, `fm.create…` without x / y) land on a grid point while snapping is on; coordinates given explicitly (a macro, `fm.createRect({x, y})`) are kept exactly, as today.
- **Snap Selection to Grid** — a command that moves the selected nodes (or the whole canvas when nothing is selected) onto the grid, one undo step, to tidy a canvas drawn before snapping was turned on.
- **Hold Alt during a drag to place freely** (Alt pressed *after* the drag has started; Alt *before* pressing still makes an alias, as today).
- **Nothing changes in the model or in files.** Positions are ordinary numbers; a model drawn with snapping opens anywhere. The on/off state and the spacing are the person's own UI settings (`ui.snapToGrid`, `ui.gridSize`, saved with the workspace's UI settings, never taken from an imported file), so no file-format version changes. A customised ribbon gets the new commands once (`ui.snapGridAdded`).

**Owner's choices:**

1. **Which snap wins** when a node is near both a grid point and another node's edge?
   - (a) **Recommended:** the other node's edge wins when it is within the 6-pixel threshold (the blue guide shows), the grid otherwise — centres of different-sized nodes still line up.
   - (b) Grid only while snapping is on; node-to-node guides only when it is off.
2. **Spacing:**
   - (a) **Recommended:** a choice of 11, 22 (default — today's dots) or 44 pixels.
   - (b) Fixed at 22 pixels.
   - (c) Any number the person types (between 5 and 100).
3. **Resizing:**
   - (a) **Recommended:** while snapping is on, the bottom-right corner snaps to the grid too, so widths and heights become whole grid steps (today's default rectangle, 170 × 64, is not; existing nodes keep their size until resized).
   - (b) Resizing never snaps.
4. **On or off for a new person:** (a) **Recommended:** off, so nothing moves differently until the person asks; (b) on.
5. **Equal-spacing guides** (as in PowerPoint: while dragging a node between or beside others, a marker shows when the gaps are equal, and the node snaps there):
   - (a) **Recommended:** a later, separate phase (12c) if wanted after using the grid — the grid already gives even spacing for most layouts.
   - (b) Part of 12a.
   - (c) Not needed.
6. **In the Preferences file?** (a) **Recommended:** no — the person's own UI setting, like window sizes (no format change); (b) yes — `fmIDE-preferences` would carry it (a new optional field; version and upgrade per the file-format rules).

**Help and tests:** a sentence per new command (`COMMAND_HELP`), the `arranging` help topic updated. New test group (next free number, 40): dragging one node and a selection onto the grid, the Alt-during-drag escape, node edges winning (if 1a), resizing (if 3a), new nodes and paste on the grid, explicit coordinates kept, Snap Selection to Grid as one undo step, the setting kept after a reload and not taken from an imported workspace, a finger drag (group 27's helpers), and a model saved with snapping opening unchanged.

---

## 12b — add many rectangles at once

**What is there today:** **Add Rectangle** (`addRectangleInteractive` in `03-canvases-undo-clipboard-dialogs.js`) adds one rectangle at `spawnPoint()` and opens its inline editor (`startEdit`): line 1 the name, line 2 the value, line 3 the unit. Ten rectangles means ten rounds of add, place, type. `fm.createRect` makes one at a time (a macro can loop, but that is not something a person types).

**Proposed: Add Many Rectangles…** — a new command beside Add Rectangle (Home tab's Insert group and Insert tab's Nodes group), that opens a window:

```
┌ Add Many Rectangles ─────────────────────────────────── ? ┐
│ How many: [ 10 ]                                          │
│                                                           │
│   #   Name                    Value      Unit             │
│   1   [Revenue            ]   [      ]   [$m   ]          │
│   2   [Cost of sales      ]   [      ]   [$m   ]          │
│   3   [▌                  ]   [      ]   [     ]          │
│   …                                                       │
│  10   [                   ]   [      ]   [     ]          │
│                                                           │
│ Arrange: (•) Column  ( ) Row  ( ) Grid, [4] across        │
│ Gap: [ 22 ] px          [✓] Select them when added        │
│                                                           │
│ 2 of 10 rows filled — 2 rectangles will be added.         │
│                                     [ Cancel ] [ Add 2 ]  │
└───────────────────────────────────────────────────────────┘
```

- **How many** sets the number of rows (1 to 200). The cursor starts in row 1's Name. **Enter** moves to the next row's Name (on the last row it adds a row and raises How many), so a list is typed straight through: *Revenue ⏎ Cost of sales ⏎ Gross margin ⏎ …*. **Tab** moves across to Value and Unit for anyone who wants them; both are optional. **Mod+Enter** adds.
- **Paste a list** into any Name box — several lines, from a text file or a column in Excel — and it fills that row and the ones below, adding rows as needed. Columns copied from Excel (tab-separated) fill Name, Value and Unit in turn.
- **Blank rows are skipped**; the line at the bottom always says how many rectangles will be added, and the Add button carries the number.
- **Arrange** them in a column (the usual way down a calculation), a row, or a grid with a number across; **Gap** between them (defaults to the grid spacing when 12a exists). The group goes where it overlaps nothing near the middle of the view (`findFreeSpot` for the whole block, as paste does with `moveGroupToFreeSpot`), on grid points when snapping is on.
- **One undo step** for the lot. **Selected when added** (default on), so the new group can be dragged into place at once.
- **A name already on this canvas** is marked in its row ("already on this canvas") — a warning, never a block, as two rectangles with one name matter for plugs and sockets, "Update this canvas" and ExcelExporter's module layouts.
- **Automation:** a new action `fm.createRects({ items: [{ name, value?, uom? }…] | names: [...], layout: 'column' | 'row' | 'grid', across?, gap?, x?, y? })` returning the new ids, recorded by the macro recorder as one step and listed in the Macro Builder; the window calls it. `docs/fmIDE-automation-api.md` gains it.
- **Nothing changes in files:** the rectangles are ordinary rectangles. Names typed are the person's own text, shown with `textContent` like every name.
- **Touch:** the window works with the on-screen keyboard (16-pixel text boxes, `keepTypingVisible`); it gets a "?" (`addWindowHelp`) and a resize corner (`makeResizableWindow`, a new `WINDOW_SIZE_KEYS` entry). A customised ribbon gets the command once (`ui.addManyRectsAdded`).

**Owner's choices:**

1. **How the list is typed:**
   - (a) **Recommended:** the rows above — How many, then one box per rectangle (Name, with optional Value and Unit).
   - (b) One large text box, one rectangle per line (`Name`, or `Name | value | unit`); the count follows the lines. Simplest to paste into, but no separate count and less guidance.
   - (c) Both: rows, with a "Paste as text…" switch to (b).
2. **Also a quick chain on the canvas?** In a rectangle's inline editor, **Mod+Enter** saves it and starts a new rectangle just below (one grid step down), already in edit mode — so a list can also be typed directly on the canvas without the window.
   - (a) **Recommended:** yes, as a small extra in the same phase (it shares the placement code).
   - (b) No, the window only.
   - (c) Later, separately.
3. **Size of the rectangles:** (a) **Recommended:** today's default (170 × 64), or the grid-rounded size when 12a's resize snapping exists; (b) a Width / Height box in the window.
4. **Name prefix and numbering** (e.g. "Product 1 … Product 10" without typing each): (a) **Recommended:** not in 12b — a name box left blank is skipped, which keeps the window simple; (b) a "Fill with: [Product] 1…N" button.

**Help and tests:** a sentence for the new command, the `rectangles` help topic updated; a tutorial step is not needed. New test group (next free number after 12a's): typing a list with Enter through the rows, How many growing and shrinking (rows typed are kept when it grows; it asks before dropping filled rows when it shrinks), pasting lines and Excel columns, blank rows skipped, each arrangement and the gap, nothing overlapped, one undo step, the selection, the duplicate-name warning, hostile text in names kept as plain text, `fm.createRects` and its macro step, a finger and the on-screen keyboard (group 27's helpers), and Mod+Enter on the canvas (if 2a).

---

## Order

12a and 12b do not depend on each other. If 12a comes first, 12b's gap and placement use the grid; if 12b comes first, 12a later makes them snap. **Recommended:** 12b first — it saves the most typing — then 12a.
