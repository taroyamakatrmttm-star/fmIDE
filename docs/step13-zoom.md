# Build step 13 — zoom

**Status:** 13a done (2 Oct 2026); 13b (pinch with two fingers) next. Two phases, one pull request each, each approved by the owner before the next.

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

## 13b — pinch (next)

Two fingers on the canvas pinch to zoom around the point between them and move the canvas; one finger keeps scrolling and dragging as in step 9.
