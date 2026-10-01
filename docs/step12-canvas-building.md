# Build step 12 — faster canvas building

**Status:** done — 12b and 12a (1 Oct 2026). Two independent phases, **12a** and **12b**; 12b went first (the owner's choice). Each phase gets its own plan, approved by the owner before any change, and its own pull request. The choices marked **Owner's choice** below are open: the recommendation is a starting point, not a decision.

**Goal:** fewer clicks to lay out a model. Two requests from the owner:

1. While a shape is dragged, it snaps to the places that make it evenly spaced with the shapes beside it (horizontally) or above and below it (vertically) — no more selecting three shapes and using Distribute afterwards.
2. Type a list of names and get that many rectangles at once, instead of adding a rectangle, double-clicking it and typing its name ten times over.

Neither changes the calculation, ExcelExporter or any file format (see each phase).

---

## 12a — snap to equal spacing

**What is there today:**

- Dragging a node snaps only to *other nodes' edges* (`computeSnap` in `src/fmide/js/08-node-interaction.js`): its left, right or centre lines up with another node's within `SNAP_THRESHOLD` (6 pixels), shown by one blue vertical and one blue horizontal guide (`guideV`, `guideH`). Alias drags (Alt+drag) use the same snap; resizing does not snap.
- Even spacing is possible only after the fact: select three or more nodes and use **Distribute Horizontally / Vertically** (`distributeSelected` in `06-align-marquee-computation.js`), which makes the *gaps* between neighbours equal while keeping the first and last in place.

**Proposed:** while you drag a node C, it also snaps to the places that would make it **evenly spaced** with the nodes around it, horizontally and vertically — as PowerPoint's smart guides do. With rectangles A and B side by side, C snaps:

```
 after B:     [A]  gap  [B]  gap  [C]
 before A:    [C]  gap  [A]  gap  [B]
 between:     [A]  gap  [C]  gap  [B]      (C exactly halfway)
```

and the same up and down, for nodes one above the other. "Evenly spaced" means **equal gaps between edges** — the same rule as Distribute, so the two always agree (for nodes of one size it is also equal spacing of their centres).

- **Which nodes count:** for horizontal spacing, the nodes in C's row — those whose top-to-bottom span overlaps C's at the place it would snap to; for vertical spacing, those in C's column. Within a row, the candidates are the gaps between neighbouring nodes there: C can extend a run at either end with that gap, or sit halfway between two neighbours. A longer evenly spaced run (A, B, D already equal) is extended the same way.
- **What you see:** while it snaps, each equal gap is marked by a short double-headed bar (⟷ / ↕) in a contrasting colour, so you can see *which* gaps are equal; they disappear when you let go. The blue alignment guides stay as they are.
- **With the alignment snap:** each direction snaps on its own — C can snap to even horizontal spacing and, at the same time, line up its top with A and B. Within one direction, the nearest snap within 6 pixels wins (see choice 2).
- **Same everywhere a drag snaps today:** one node or a whole selection (the node you grabbed decides, the rest move with it, as now), Alt+drag aliases, mouse, finger or pen (step 9's drag path is shared). Nodes being dragged are never counted as A or B.
- **Speed:** the candidate gaps are worked out once when the drag starts (from the other nodes on the canvas), not on every pointer move, so a canvas with hundreds of nodes still drags smoothly; checked with a large sample in the tests.
- **Nothing changes in the model or in files.** Positions are ordinary numbers; no file-format version changes. No new command is needed if it is always on (choice 1).

**Owner's choices:**

1. **On or off:**
   - (a) **Recommended:** always on, like the alignment snap today — nothing to find or switch.
   - (b) A **Snap to Equal Spacing** on/off command (Arrange tab, Distribute group), remembered as the person's own UI setting (`ui.snapEqualSpacing`; never taken from an imported file; a customised ribbon gets it once).
2. **When the alignment snap and the equal-spacing snap both apply in the same direction** (e.g. C's left edge is 4 pixels from lining up with something above, and 3 pixels from equal spacing):
   - (a) **Recommended:** the nearer one wins; on a tie, alignment.
   - (b) Equal spacing always wins.
   - (c) Alignment always wins.
3. **Which nodes count as neighbours:**
   - (a) **Recommended:** only nodes in C's row (or column), as described above — few, predictable snaps.
   - (b) Any two nodes on the canvas with the same gap, wherever they are (PowerPoint also matches a gap seen elsewhere on the slide) — more snaps, but more surprising ones on a busy canvas.
4. **A way to drag without snapping** (there is none today):
   - (a) **Recommended:** holding Alt *after* the drag has started turns all snapping off for that move (Alt *before* pressing still makes an alias, as today).
   - (b) None, as today.
5. **Resizing:** (a) **Recommended:** not in 12a — resizing keeps not snapping; (b) a resized node snaps its width or height to match a neighbour's.

**Help and tests:** the `arranging` help topic gains a paragraph (and a sentence for the command if 1b). New test group (next free number, 40), with a real mouse: C snapping after B, before A and halfway between them, horizontally and vertically; the gap bars shown while snapping and gone after; nodes of different sizes (equal gaps, not centres); a run of three extended; nodes outside C's row ignored (if 3a); alignment and equal spacing together in the two directions, and the tie rule; a selection and an Alt+drag alias snapping; the Alt-during-drag escape (if 4a); the move as one undo step and recorded by the macro recorder at its snapped position; a finger drag (group 27's helpers); a large canvas staying quick; a model saved after snapping opening unchanged.

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
- **Arrange** them in a column (the usual way down a calculation), a row, or a grid with a number across; **Gap** between them (one gap for all, so they come out evenly spaced). The group goes where it overlaps nothing near the middle of the view (`findFreeSpot` for the whole block, as paste does with `moveGroupToFreeSpot`).
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
2. **Also a quick chain on the canvas?** In a rectangle's inline editor, **Mod+Enter** saves it and starts a new rectangle just below, with the same gap as the last two (so the chain stays evenly spaced), already in edit mode — so a list can also be typed directly on the canvas without the window.
   - (a) **Recommended:** yes, as a small extra in the same phase (it shares the placement code).
   - (b) No, the window only.
   - (c) Later, separately.
3. **Size of the rectangles:** (a) **Recommended:** today's default (170 × 64); (b) a Width / Height box in the window.
4. **Name prefix and numbering** (e.g. "Product 1 … Product 10" without typing each): (a) **Recommended:** not in 12b — a name box left blank is skipped, which keeps the window simple; (b) a "Fill with: [Product] 1…N" button.

**Help and tests:** a sentence for the new command, the `rectangles` help topic updated; a tutorial step is not needed. New test group (next free number after 12a's): typing a list with Enter through the rows, How many growing and shrinking (rows typed are kept when it grows; it asks before dropping filled rows when it shrinks), pasting lines and Excel columns, blank rows skipped, each arrangement and the gap, nothing overlapped, one undo step, the selection, the duplicate-name warning, hostile text in names kept as plain text, `fm.createRects` and its macro step, a finger and the on-screen keyboard (group 27's helpers), and Mod+Enter on the canvas (if 2a).

---

### 12b — how it turned out

Decided when the work started (1 Oct 2026, the owner): **12b first**; **rows** (choice 1a); **the quick chain on the canvas, in this phase** (2a); and the simple window — **no Width / Height box and no numbering** (3a, 4a).

What was built:

- **Add Many Rectangles…** (command `addManyRects`, `src/fmide/js/03b-add-many-rectangles.js`): the window as drawn above. How many (1 to 200, 10 to start) sets the rows; Enter moves to the next row's Name (on the last row it adds one); Tab moves across; Mod+Enter adds; Escape closes. Pasting several lines into a Name box fills that row and the ones below, adding rows as needed; tab-separated columns from Excel fill Name, Value and Unit. Fewer rows ask first when named rows would go. A name already on the canvas is marked "already on this canvas", one used twice in the list "also in row N" — warnings only. Column, row or grid (with its number across), one gap for all (22 pixels to start), "Select them when added" (on). The line at the bottom counts the rectangles, and the Add button carries the number; a value that can't be read is shown there and the window stays open. It has a "?" (the `rectangles` topic) and a resize corner (`addManyRects` in `WINDOW_SIZE_KEYS`).
- **`fm.createRects`** (`14-actions-registry-insert-connect.js`): `names` (one per line) or `items` (`{ name, value, uom }` or plain names), `layout`, `across`, `gap`, `x`, `y`; blank names skipped, at most 200 (`CREATE_RECTS_MAX`); each value read like `createRect`'s; one undo step; returns the ids. With x and y left out, the group goes near the middle of the view where it overlaps nothing (`moveGroupToFreeSpot`); given, they are kept exactly. `names` comes first among its parameters, so `fm.createRects({ … })` takes named arguments and `fm.createRects('A\nB')` works too. The window calls it, so the macro recorder records one step.
- **The quick chain**: in a rectangle's editor, **Mod+Enter** saves it and starts a new rectangle just below, already editing (`chainRectangleBelow`). The gap is the one between this rectangle and the one above it in its column (same x, at most 200 pixels apart), else 22; if that place is taken, the nearest free one. Each new rectangle is its own undo step.
- **Ribbon**: after Add Rectangle on the Home tab's Insert group and the Insert tab's Nodes group; a customised ribbon gets it after its own Add Rectangle once (`ui.addManyRectsAdded`).
- **Help**: a sentence for the command; the `rectangles` topic has two new paragraphs (the window, and Ctrl+Enter / Cmd+Enter).
- **Files**: nothing changed — the rectangles are ordinary rectangles.

How it was checked: test group 40 (`tests/40-add-many-rectangles.spec.js`, `npm run test:add-many`, 13 tests, listed in `tests/SPEC.md`), with a real mouse and keyboard and one by touch; then the whole suite.

### 12a — how it turned out

Decided when the work started (1 Oct 2026, the owner chose each recommendation): **always on** (1a); **the nearer snap wins, alignment on a tie** (2a); **only nodes in the dragged node's row or column** (3a); **Alt held after the drag starts turns snapping off** (4a); **resizing does not snap** (5a).

What was built (`src/fmide/js/08-node-interaction.js`):

- **`computeSnap`** now also asks **`equalSpacingSnap`**, once per direction: the nodes whose span across the axis overlaps the dragged node's (its row, or its column), in order; for each pair of neighbours with a gap between them, three places — after the second with the same gap, before the first with the same gap, and halfway between them when the dragged node fits. The nearest within `SNAP_THRESHOLD` (6 pixels) wins over the alignment snap only when it is nearer (a tie goes to alignment); each direction on its own, so a node can be evenly spaced across and lined up down at once. A place is taken only where nothing in the row sits between the node and its neighbour, or under it.
- **`snapBoxes`**: the other nodes, as boxes, worked out once when a drag starts (again after Ctrl turns it into a copy, so the originals count), not on every move. Timing a drag across a 600-node canvas showed the same time before and after (most of it is redrawing the canvas on each move, which was already so).
- **Gap markers**: `#gapMarks` on the canvas (beside the blue guides) holds a pink bar with end caps for each equal gap (`showGapMarks`), cleared with the guides when the drag ends.
- **Alt**: held during a plain drag (`startDrag`), that move doesn't snap at all; Alt before pressing still makes an alias, whose drag snaps as before (`startAliasDrag`).
- The selection moves with the grabbed node; a finger or pen drags through the same code (step 9); the move is one undo step and is recorded (`move`) at its snapped place. Positions are ordinary numbers: no file format changed, and no command was added.
- **Help**: the `arranging` topic has a paragraph on snapping, the pink bars and Alt.

How it was checked: test group 41 (`tests/41-equal-spacing-snap.spec.js`, `npm run test:equal-spacing`, 11 tests, listed in `tests/SPEC.md`), with a real mouse and one finger; then the whole suite.

## Order

12a and 12b do not depend on each other. Either way they fit together: 12b lays its rectangles out with equal gaps, and with 12a, dragging one more next to them snaps into the same spacing. **Recommended:** 12b first — it saves the most typing — then 12a.
