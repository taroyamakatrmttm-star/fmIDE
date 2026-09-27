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
