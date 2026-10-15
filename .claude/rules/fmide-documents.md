---
paths:
  - "src/fmide/js/20-documents.js"
  - "src/fmide/js/05-workspace-persistence.js"
  - "src/fmide/js/21-web-app.js"
  - "src/fmide/js/22-customize-ribbon-ui-state.js"
  - "src/fmide/js/12-shortcuts-settings.js"
  - "src/fmide/js/04-file-formats.js"
  - "tests/10-documents.spec.js"
  - "tests/11-preferences.spec.js"
  - "tests/12-web-app.spec.js"
  - "tests/9-storage.spec.js"
---

# fmIDE: documents, the web app and preferences

Loaded when a session works on fmIDE's documents, saving, the web app or preferences. Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

## Documents (fmIDE, `src/fmide/js/20-documents.js`)

A document is a `.fmide` file: the `fmIDE-workspace` JSON, nothing new. Commands New, Open… (Mod+O), Save (Mod+S), Save As… (Mod+Shift+S), Open Recent… sit in the File tab's Document group.

- With the File System Access API (Chrome, Edge) Save writes back through a file handle; otherwise Open uses `#fileInputDocument` and Save downloads `name.fmide`. A `.json` opened as a document never keeps its handle, so it is never overwritten with a workspace.
- **Unsaved changes:** every change that goes into undo history (plus undo/redo) marks the document; saving clears it. Title `name • — fmIDE`. New / Open / Open Recent ask Save / Don't save / Cancel; closing the tab triggers "Leave site?".
- **Opening** loads the model and format presets/roles (same-name presets replaced), adds templates and macros not already present (templates: same name, kind and content — `addMissingTemplates()`, which Import Workspace and Import Templates use too; Templates → "Remove duplicates…" / the Remove Duplicate Templates… command opens a window: kind and the calculation (`templateLogicKey()`, ids and counters ignored) always match, name / layout and formatting / group / description per tick boxes (`dedupeMatch`, saved in the UI settings), the person picks which to keep, removal is by object not id; restoring the autosave gives every template its own id and continues `nextTemplateId` after the highest saved `usrN`; "Clear all templates" empties the library after asking), ignores shortcuts and ribbon/KeyTips, and clears undo history. New keeps the current presets, templates, macros and settings.
- **Recovery:** after a restart with unsaved changes, `#recoveryBanner` offers Save / Dismiss.
- Ribbons customised before the Document group existed get it once (`ui.documentGroupAdded`); a removed group is never added back.
- **Web app** (`21-web-app.js`): registers the service worker only where the page links a manifest (the `site/` build) and the browser allows it; `#updateBanner` (shared `update-notice.js`, also in ExcelExporter wherever the site's service worker runs it, which registers nothing itself) offers Reload (autosave first, no "Leave site?"; ExcelExporter saves its layout, and the file must be loaded again) or Later, and appears in every open tab once another tab has switched; commands Install fmIDE and Open ExcelExporter (File tab, App group; a window it already opened is brought to the front, not reloaded, and sent the model as it is now; **the model from fmIDE**: ExcelExporter opened by fmIDE (`fmideWindowBehind`, 09c) asks with `excel:want-model` at start and on File → ↻ From fmIDE (`#btnFromFmide`, shown only then; `09f-from-fmide.js`), fmIDE answers that window only (`sendModelToExcel` / `buildExcelPayload`: a workspace's text — the system, format presets, the canvas templates carrying `attachments.excel`, and the document's `graphBoards` (step 19 B2, not in practice) — no macros, shortcuts or settings; a window it opened before a reload is taken back by its name) with `{ type: 'fmIDE:model', name, text }`, read by `tryLoad` exactly as a dropped file and replacing the model shown; on the site both sides accept only their own origin; in practice the practice model goes; ExcelExporter's **← Back to fmIDE**, `09c-back-to-fmide.js`, closes its own window, goes back a page where it took fmIDE's place — an iPad's home-screen app; fmIDE marks the tab in `sessionStorage` — or opens fmIDE, whose address the build fills in, `<!-- build:fmide-address -->`); a `.fmide` handed over by the operating system (`launchQueue`) opens like Open….
- **Preferences** (`fmIDE-preferences`, in `22-customize-ribbon-ui-state.js`): Export / Import Preferences carry shortcuts for built-in commands, the ribbon and Quick Access Toolbar, its collapsed state and the KeyTips trigger. Import replaces exactly those; macro shortcuts stay the person's own. Ribbon layouts from files go through `cleanRibbonConfig()`.
