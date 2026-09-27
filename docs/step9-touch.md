# Build step 9 — touch support

**Goal:** fmIDE works with a finger on tablets and touchscreen laptops, as well as with a mouse. The mouse keeps working exactly as before.

**What was there before:** the canvas listened only for mouse events. On a touchscreen the browser sends mouse events only for a tap, so you could scroll and press buttons but not move nodes, draw arrows, resize or choose several things. Some gestures need a mouse or keyboard anyway: right-drag draws an arrow, Alt-drag makes an alias, Ctrl-drag duplicates, Shift/Ctrl/Cmd with a click adds to the selection, Shift while dragging keeps to one direction. The dots, the resize corner and the node buttons are small and appear on hover; some information (calculation errors, the plugs feeding a "⚡ ×N" socket) appears only on hover. There is no zoom.

**Decided (27 Sep 2026, decision 7 in `docs/decisions.md`):**

- **Devices:** tablets and touchscreen laptops. Phones (a separate narrow layout) are a later step.
- **One finger on empty canvas scrolls it.** Press and hold, then drag, for a selection box.
- **The mouse-only gestures** are reached through a menu opened by pressing and holding a node.
- **No pinch to zoom** in step 9: fmIDE has no zoom for the mouse either, so zoom is its own step.
- **Three phases**, one pull request each, each approved before the next.
- A virtual on-screen mouse was considered and not chosen: slower than touching things directly; events a page makes itself can't open the on-screen keyboard, the clipboard or file pickers, so direct touch would be needed anyway; and a real mouse or trackpad already works on these devices.

## Phases

- **9a — one input path, mouse unchanged.** A finger or pen moves nodes, draws arrows from the dots, resizes, drags canvas tabs and draws in the curve editor; the page doesn't scroll while a finger is on them.
- **9b — touch replacements for the mouse-only gestures.** Press and hold a node for a menu (draw an arrow from here, make an alias, duplicate, add to or remove from the selection, edit, properties, delete, and what hover would show); press and hold on empty canvas, then drag, to select with a box; double-tap does what a double-click does; larger invisible touch areas for dots, the resize corner and node buttons, on touchscreens only (`pointer: coarse`).
- **9c — the screen.** The viewport line on the page; the layout at tablet sizes (ribbon, dialogs, the on-screen keyboard while editing); ExcelExporter by touch (its row menu opens only on right-click, and choosing several rows needs Shift or Ctrl).

**Tests (group 27):** Chromium with a touchscreen at tablet size (1024 × 768); the touches are real touch input sent through the Chrome DevTools Protocol (`Input.dispatchTouchEvent`), not mouse events. Every existing test stays unchanged and green: they drive a real mouse, so they prove the mouse didn't change. Safari on an iPad can't run here; the owner tries each pull request's preview address on real devices.

## Done (9a) — how it turned out

- `src/fmide/js/02b-pointer-input.js`: `onPress(el, handler)` runs an action for a mouse button (on `mousedown`, as before) or for a finger or pen (on `pointerdown`); `followPointer(downEvent, onMove, onUp)` follows the mouse (`mousemove` / `mouseup`, as before) or that one finger (`pointermove` / `pointerup` / `pointercancel`; `onUp` is told when the browser took the finger over, and an arrow or a tab move is then dropped); `pressDefault(ev)` does what the mouse's `preventDefault` did and leaves a finger's `pointerdown` alone.
- After a tap the browser also sends copies of it as mouse events. The canvas ignores those (`isEmulatedMouse`: a finger is down, or one lifted within a second and 30 pixels of there), so nothing happens twice; everything else still gets them, so a tap still closes an open pop-up and a tap on empty canvas still clears the selection. Cancelling a finger's `pointerdown` would have stopped those copies, which is why `pressDefault` leaves it alone.
- Using it: node press, drag, alias drag, resize (`08-node-interaction.js`), drawing arrows (`12-shortcuts-settings.js`), the curve editor (`09-period-values-properties.js`), canvas tabs (`03-canvases-undo-clipboard-dialogs.js`). The selection box stays mouse-only until 9b (a finger on empty canvas scrolls).
- CSS: `touch-action: none` on nodes, canvas tabs and the curve editor's chart, so a finger there moves things instead of scrolling. Two side effects for 9b to look at: a finger can't scroll the canvas tab strip by swiping over a tab (the empty part of the strip, or Move Canvas, still work), nor scroll text inside a node being edited.
- No file format changed; nothing changed for the mouse (all existing tests pass unchanged).

## Done (9b) — how it turned out

Chosen by the owner (27 Sep 2026), the recommended options: the larger touch areas on a touchscreen always and on a touchscreen laptop from the first touch (never for the mouse); the tab strip scrolls with a swipe and a tab moves after a press and hold; a finger's selection box replaces the selection, like a plain mouse box.

- `02b-pointer-input.js`: `waitForHold(downEvent, { onHold, onMoveFirst, onRelease })` tells a hold (0.5 s, the finger within 10 pixels) from a drag or a tap. Where a hold turns a finger's drag into an action on something that scrolls, `holdBlocksScrolling()` stops the scroll: a scroll can only be stopped from `touchmove`, so the viewport and the tab strip carry a listener for it (`blockScrollWhileHolding`), which does nothing otherwise.
- **The node menu** (`08b-touch-menu.js`): held on a node, a finger opens it beside the finger. A finger's tap now selects when it lifts (the mouse still selects on press), so a hold leaves the selection alone and the menu can offer "Add to selection". Draw arrow from here waits for the next tap (a banner, the node outlined); that tap does nothing else (its copied mouse events and its click are dropped) and goes through `connectOnto` — the same rules as dropping an arrow, taken out of `startConnection` — or, on a block's body, asks for an input dot. Make alias, Duplicate and Delete call `fm.aliasOf`, `fm.duplicate`, `fm.deleteNodes` (one undo step each, recorded in macros); Edit is `editNode`, what a double-click does. The hover texts are read from the node's parts (`title`, leaving out the buttons' own) and shown with `textContent`.
- **The selection box** starts from a hold on empty canvas (`pointerdown` on the viewport); before the hold, the browser scrolls as before.
- **Double-tap**: two taps within 0.4 s and 25 pixels send a `dblclick` to what is under the finger, from the second tap's `pointerup` (so the on-screen keyboard can open for editing). A `dblclick` the browser makes from taps itself is dropped, so nothing happens twice.
- **Larger touch areas**: `body.touch-input`, set on a `pointer: coarse` screen and otherwise by a touch (a mouse moving or pressing takes it away), gives the dots and node buttons of a selected node, and every block and function dot, an invisible `::after` about 32 pixels across; the resize corner's grows over the node, since the buttons around it overlap it just as they do for the mouse.
- **Side effects of 9a:** canvas tabs are `touch-action: pan-x` (the strip scrolls; the hold then moves the tab), a node's text box `pan-x pan-y` (its text scrolls). The long-press copy menu is off on the canvas and tabs (`-webkit-touch-callout`), and the browser's own long-press menu on a tab is cancelled for a finger only.
- Not in 9b: Shift while dragging (keep to one direction) has no touch replacement; a hold on an arrow does nothing yet. No file format changed; nothing changed for the mouse (all existing tests pass unchanged; only the 9a tab test in group 27 changed, on purpose, to hold first).

