# Build step 13 — zoom

**Status:** done — 13a (2 Oct 2026) and 13b, the pinch (2 Oct 2026). Two phases, one pull request each, each approved by the owner before the next.

**Goal:** large models no longer fit on one screen. Zooming out shows how the parts connect; zooming in makes the details easy to read. Zoom is a view, like scrolling: it changes nothing in the model, its calculation, ExcelExporter or any file format.

## What was there before

fmIDE had no zoom. The canvas is a fixed 3600 × 2400 area that scrolls. Every drag worked out canvas positions from screen pixels in about ten places (moving and resizing nodes, drawing arrows, the selection box, snapping, where new nodes go). Step 9 left two fingers on the canvas unused on purpose, for zoom.

## Decided (2 Oct 2026, the owner — all the recommended options)

- **Range** 25% to 200%, in steps 25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200%.
- **Ways to zoom:** Ctrl (Cmd on a Mac) + the mouse wheel, or a trackpad's pinch, around the pointer; a plain wheel still scrolls. **Ctrl + = / − / 0** zoom in, out and back to 100% (fmIDE's own, as in Excel; the browser's page zoom stays in its menu). Commands **Zoom In, Zoom Out, Zoom to 100%, Zoom to Fit, Zoom to Selection** in a new View → Zoom group and the Command Launcher. A small control at the bottom-right of the canvas, `− 100% +`; the percentage opens a menu with every level, Fit the model and Fit the selection.
- **Each canvas keeps its own zoom**, remembered in the person's own settings — never in a document or model file, never taken from someone else's file, never in a Preferences file. Macros don't record it.
- **A tutorial starts at 100%** and gives the zoom back when it ends.
- **Two phases:** 13a the zoom itself; 13b pinch with two fingers on a tablet.

## Done (13a) — how it turned out

- **How it is drawn** (`src/fmide/js/07b-zoom.js`): `#canvas` is scaled with a CSS transform inside a new `#canvasZoom`, which takes the scaled size so the viewport scrolls over all of it; `--zoom` (and `--unzoom`) sit on `#viewport`, which carries `.zoomed` when the zoom isn't 100%. At 100% nothing is transformed, so everything is exactly as before.
- **Positions:** nodes keep their positions in canvas units. `canvasPoint(clientX, clientY)` turns the pointer into a canvas position, and a drag's movement is divided by the zoom: moving, Alt-drag aliases, resizing, drawing arrows (and their dots), the selection box, and where new nodes go (`viewCentre()`, used by `spawnPoint`, `fm.create…` and the Macro Builder). Snapping keeps the same 6 pixels on the screen at every zoom (`SNAP_THRESHOLD / zoom`).
- **Zooming keeps the spot in place:** the canvas point under the pointer (the wheel) or the middle of the view (commands, the control). Zoom to Fit and Zoom to Selection show the nodes' box as large as fits, with a margin, centred, at most 200%.
- **Readable at any zoom:** the operator picker and the plug and tag pop-ups opened on the canvas are scaled back (`--unzoom`); dialogs, the touch menu and the tutorial's ring work in screen positions and needed nothing.
- **Kept:** `canvasZooms` (canvas id → zoom) is the person's own UI setting, `ui.canvasZoom` in the autosave (read through `cleanCanvasZooms`), never from an imported file. A model that comes in (`applySystemDataDirect`: Open, New, Load System, Import Workspace) starts at 100%; switching canvases shows each one's zoom (`loadCanvasState`); undo never changes it; a tutorial keeps a copy and puts it back.
- **Commands** `zoomIn` (Mod+=), `zoomOut` (Mod+−), `zoomReset` (Mod+0), `zoomFit`, `zoomSelection`; the View tab's Zoom group, added once to a customised ribbon (`ui.zoomGroupAdded`). `fm.zoom()` and `fm.setZoom(level | 'fit' | 'selection')` for scripts — not actions, so the Macro Builder and the recorder never see them.
- **Found along the way:** the welcome card sat on the same corner as the new zoom control; it now sits just above it. The zoom menu opens above the welcome card.
- **Checked:** test group 44 (10 tests) with a real mouse and keyboard, then the whole suite. Tests that import an old customised ribbon now mark the Zoom group as already added (it has its own test), and the welcome card's test allows its new place.

## 13b — pinch

Two fingers on the canvas pinch to zoom around the point between them and move the canvas; one finger keeps scrolling and dragging as in step 9.

**Decided (2 Oct 2026, the owner — the recommended options):** a second finger landing while the first drags a box cancels the drag and puts the box back, then pinches; a pinch ending within 5% of 100% settles at 100%; ExcelExporter gets no pinch (it has no zoom; two fingers still zoom its page).

### Done (13b) — how it turned out

- **Touch events** (`07b-zoom.js`): scrolling can only be stopped from `touchmove`, so the pinch follows touch events, not pointer events. It starts on `touchstart` when exactly two fingers are down and both went down inside `#viewport` (a finger on the ribbon or in a window starts nothing); the moves and the lift are followed on the document, since a redraw may take the element a finger went down on out of the page.
- **Zoom and move together:** the zoom is the start zoom times how far apart the fingers are now over how far they were (so it never drifts), kept to 25%–200%. While the browser lets the page cancel the moves, fmIDE moves the canvas itself: the canvas point under the fingers' previous midpoint goes to their new one. If the first finger had already started the browser scrolling before the second landed, the moves can't be cancelled; the browser then moves the canvas and the pinch only zooms around the point between the fingers. The canvas stays `pan-x pan-y` (step 9c), so the browser never zooms the page there.
- **A drag cancelled:** `cancelFingerActions()` (shared `pointer-input.js`) cancels everything a finger is following (`followPointer` keeps a list), as if the browser had taken the finger over, and forgets the fingers down as taps. A node drag or resize that was cancelled puts the model back (`dropLastHistory()`: the snapshot it took, with no undo step); a selection box selects nothing; an arrow was already dropped on a cancel; a hold waiting to open the touch menu opens nothing.
- **Kept:** the zoom is remembered once the fingers lift (`rememberZoom`), the same as the mouse's: each canvas its own, never in a file or a macro. A pinch ending between 95% and 105% settles at 100%.
- **Checked:** test group 45 (8 tests) with two real fingers through the Chrome DevTools Protocol (`twoFingers` in `tests/helpers/touch.js`); with the pinch turned off, the six that need it fail. Then the whole suite. Safari on an iPad can't run here: the owner tries the preview address on a real tablet.
