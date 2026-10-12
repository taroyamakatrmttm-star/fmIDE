---
paths:
  - "src/fmide/js/03-canvases-undo-clipboard-dialogs.js"
  - "src/fmide/js/03b-add-many-rectangles.js"
  - "src/fmide/js/06-align-marquee-computation.js"
  - "src/fmide/js/08-node-interaction.js"
  - "src/fmide/js/10-plug-socket.js"
  - "src/fmide/js/14-actions-registry-insert-connect.js"
  - "src/excel-exporter/js/09*.js"
  - "tests/28-*.spec.js"
  - "tests/29-*.spec.js"
  - "tests/40-*.spec.js"
  - "tests/60-*.spec.js"
  - "tests/61-*.spec.js"
---

# fmIDE: placing nodes, Add Many Rectangles, switching canvases, messages and windows

Loaded when a session works on these parts of fmIDE (and ExcelExporter's differences list). Moved word for word from `CLAUDE.md`'s test-group list (12 October 2026), which was dropped as `tests/SPEC.md` covers it; these lines carry code facts found nowhere else. Keep it in step with the code, as `CLAUDE.md` asks.

- Where new nodes go and the Macro Builder's next step: test group 28 (`tests/28-placement.spec.js`, `npm run test:placement`). `findFreeSpot` / `moveGroupToFreeSpot` (`06-align-marquee-computation.js`) place new nodes where they overlap nothing — `spawnPoint(w, h)` for commands, pickers and `fm.create…` without x/y, the default-offset `duplicate` / `aliasOf`, paste (the pasted group moves together), and the automatic plug aliases in `syncAutoConnections`; coordinates given explicitly are kept exactly. ExcelExporter sorts a new layout (`sortNewLayout`, calculation order with formula order within groups, both with and without sections); a saved one keeps its order.
- Add Many Rectangles… (step 12b, `03b-add-many-rectangles.js`: `showAddManyRectangles`, the quick chain `chainRectangleBelow` called from `startEdit` on Mod+Enter; the action `fm.createRects` in `14-actions-registry-insert-connect.js`, `CREATE_RECTS_MAX` 200): test group 40 (`tests/40-add-many-rectangles.spec.js`, `npm run test:add-many`): typing with Enter, How many, pasting lines and Excel columns, the layouts and gap, nothing overlapped, one undo step, the duplicate-name marks, hostile names, `fm.createRects` and its macro step, Mod+Enter on the canvas, the ribbon (`ui.addManyRectsAdded`), a finger.
- Next / Previous Canvas (`nextCanvas` Alt+PageDown, `prevCanvas` Alt+PageUp; `switchCanvasBy` in `03-canvases-undo-clipboard-dialogs.js`, through `fm.switchCanvas`; round the ends; the Canvas group, added once to a customised ribbon, `ui.canvasSwitchAdded`): test group 61 (`tests/61-canvas-switching.spec.js`, `npm run test:canvas-switching`).
- Long messages and the iPad's file boxes: test group 60 (`tests/60-long-messages.spec.js`, `npm run test:messages`): fmIDE's `showMessage` / `showConfirm` (`.message-box`: the text scrolls, the buttons stay on the screen), ExcelExporter's `#differencesPanel` (the first `DIFFERENCES_SHOWN` 3 lines, the rest `li.more`; Show all; × hides it until its lines change), the `accept` lists on an iPad and a desktop.
- Resizable windows and the Templates tree: test group 29 (`tests/29-windows.spec.js`, `npm run test:windows`; the Browse Library window in group 26). `makeResizableWindow(box, key)` (`03-canvases-undo-clipboard-dialogs.js`) gives a large window its resize corner (among them the 📈 chart's, whose chart fills the window and shows every period, never scrolling sideways) and keeps its size in `ui.windowSizes` (keys in `WINDOW_SIZE_KEYS`, read through `cleanWindowSizes`); the Templates window's closed groups are `ui.templateGroupsClosed` (▾ Expand all / ▸ Collapse all, `.template-tree-tools`, set them all; the window: `.template-toolbar`, `.template-list-footer` with Remove duplicates and Clear all, `.template-head-tools` with Edit info and Delete beside the name, `.template-actions`). Both are the person's own UI settings: never taken from an imported file, never in a Preferences file.
