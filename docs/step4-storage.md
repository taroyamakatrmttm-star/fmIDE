# Build step 4 — documents and storage

**Goal:** fmIDE works like a normal desktop document app — you **Open**, **Save** and **Save As** `.fmide` files — and browser storage becomes a safety net (autosave, crash recovery, a Recent list) instead of the only place work lives. ExcelExporter moves its layout storage to the same sturdier store. Personal settings (shortcuts, ribbon, KeyTips) get their own shareable Preferences file.

**Decisions already made** (see `docs/decisions.md`):

- The **file is the document**; browser storage (IndexedDB) is the safety net.
- **One document open at a time**, plus a **Recent** list.
- A saved document is a **`.fmide` file holding the whole workspace** — exactly today's `fmIDE-workspace` JSON (same `kind`, same version), just with the `.fmide` extension. No new file format.

## Ground rules

- Edit `src/` only; `npm run build`; `npm test` after every commit. Excel output must not change: **never** run `npm run test:update-snapshots`.
- Some existing tests assert today's `localStorage` behaviour (autosave surviving a reload, the storage-failure warnings). They change **deliberately** in this step: update them in the same commit as the behaviour, and list each changed test in the commit message.
- Everything keeps working offline and in every current browser. Where a browser lacks a feature, fall back — never fail.
- Keep public surfaces: `window.fm`, element ids, the global `XLSX`, file formats. New commands are added to the command registry like the existing ones (so they appear in the ribbon, Command Launcher, KeyTips and macros).
- Work phase by phase; at the end of each phase stop, summarise, push, open a pull request and wait for approval.

## Phase 4a — IndexedDB underneath, same behaviour

Replace `localStorage` with IndexedDB in both apps without changing what the user sees.

- **Shared wrapper** `src/shared/store.js`: a tiny promise-based key–value store on IndexedDB (open / get / put / delete / list keys by prefix), one database per app. No libraries.
- **fmIDE:** the 8-second and on-close workspace autosave goes to IndexedDB. **ExcelExporter:** the per-model layout (`fmide-excelmap-…` keys) goes to IndexedDB.
- **One-time migration:** on start, if IndexedDB has nothing but `localStorage` has the old keys, copy them across. Keep the old `localStorage` copies for now (a later release can remove them) — never delete user data in the same step that moves it.
- **Save on close:** IndexedDB is asynchronous, so a write started while the page closes may not finish. Save on `visibilitychange` (page hidden) as well as on the timer, so the last state is written before the tab goes away.
- Ask the browser to keep the data (`navigator.storage.persist()`), once, silently.
- The autosave-failure banner (fmIDE) and `#storageWarn` (ExcelExporter) now react to IndexedDB write failures, same wording and behaviour.
- **Acceptance:** everything behaves as before; a workspace/layout saved by the previous version (in `localStorage`) appears after the upgrade; tests updated where they poked `localStorage` directly.

**Done (4a)** — how it turned out:

- Databases `fmIDE` and `fmIDE-ExcelExporter`, object store `kv`, the same keys and JSON text as before. Where IndexedDB is missing or won't open, the same calls use `localStorage`.
- The migration runs once per browser, recorded by a `<dbName>/migrated-from-localStorage` marker. Without it, a layout removed by Reset Mapping would be copied back from the old `localStorage` copy on the next start.
- Persistence is requested **on the first change** (fmIDE: the first change that goes into undo history; ExcelExporter: the first layout change), not at start-up, in every browser. The answer, granted or declined, is kept in `<dbName>/persistence-requested` and the browser is never asked again. Firefox shows the user a question; the others decide silently.
- fmIDE saves every 8 s, when the page is hidden, and on `beforeunload`. ExcelExporter saves on every change and when the page is hidden.
- Tests: group 9 in `tests/SPEC.md` (`tests/9-storage.spec.js`).

## Phase 4b — fmIDE documents

**Commands** (File tab and Command Launcher):

| Command | Default shortcut | Behaviour |
|---|---|---|
| New | none (browsers reserve Ctrl+N) | Empty model. Asks first if there are unsaved changes. |
| Open… | Ctrl/Cmd+O | Pick a `.fmide` (also accept `.json` workspace and system files, via the existing reader). Asks first if there are unsaved changes. |
| Save | Ctrl/Cmd+S | Write back to the same file; if there isn't one yet, behave as Save As. |
| Save As… | Ctrl/Cmd+Shift+S | Choose a name/location; suggested name from the document name. |
| Open Recent ▸ | — | Up to 10 recent documents; "Clear Recent". |

The existing Import/Export Workspace, Load/Save System and Load/Save Module commands stay exactly as they are.

**How saving works in each browser**

- Chrome and Edge (desktop) have the File System Access API: Open and Save As get a **file handle**, and Save writes straight back to the same file. Store handles in IndexedDB so Recent can reopen the real file (the browser asks the user to allow access again — that prompt is expected).
- Other browsers (Safari, Firefox, iPad): Open uses a file picker; Save/Save As **download** `name.fmide`. Recent reopens the **last saved copy kept in browser storage**, and says so ("opened the copy saved in this browser on …").
- Every Recent entry therefore keeps: name, last opened, the file handle when available, and a copy of the last saved content.

**"Unsaved changes"**

- A document is *dirty* after any change that goes into undo history (and after importing into it); saving clears it.
- The window title shows the document name, with a dot when there are unsaved changes (e.g. `Revenue model • — fmIDE`); a new, never-saved document is "Untitled".
- Closing the tab with unsaved changes triggers the browser's standard "Leave site?" warning.
- New / Open / Open Recent with unsaved changes ask: **Save**, **Don't save**, **Cancel** (in-app dialog).

**Recovery (the safety net)**

- Autosave (from 4a) now stores the current document's state **plus** its name, file handle and whether it has unsaved changes.
- Also save about **2 seconds after the last change** (keeping the 8-second timer and the save when the page is hidden), so a crash loses at most a couple of seconds of work.
- On start, fmIDE restores the last session. If that session had unsaved changes, show a notice: "Recovered unsaved changes to *name*" with **Save** and **Dismiss**.

**What opening a `.fmide` changes** — a file may come from someone else, so opening it must not overwrite the person's own setup:

- The **model and its format presets / roles** load from the file (they are part of the document — ExcelExporter needs them).
- The file's **templates and macros** are **added** to the user's library when not already present (matched by name and content); nothing of the user's is replaced or deleted.
- The file's **shortcuts and ribbon/KeyTips customisation are ignored** — those are the user's own preferences, shared separately with a Preferences file (phase 4c). (Import Workspace keeps today's full-replace behaviour for backups and moving to a new computer.)
- Save writes the whole workspace, as today's Export Workspace does.

**ExcelExporter:** its model picker also accepts `.fmide` files.

**Done (4b)** — how it turned out:

- Code in `src/fmide/js/20-documents.js`. Storage keys: `fmIDE-session`, `fmIDE-session-handle`, `fmIDE-recent`, `fmIDE-recent:<id>`, `fmIDE-recent-handle:<id>` (see CLAUDE.md).
- The Document group leads the File tab. Ribbons customised earlier get it once, recorded as `ui.documentGroupAdded` in the workspace, so a removed group is never added back.
- **New** keeps the current format presets and roles (a house style), templates, macros and settings.
- **Opening** replaces format presets with the same name and keeps the others (the same rule now used by Import Workspace, which used to add duplicates). A macro whose name was taken is added as "… (imported)", and that copy counts as present when the document is opened again.
- A workspace or system `.json` opened as a document never keeps its file handle: Save asks for a `.fmide` instead of overwriting the `.json`.
- On the fallback path, the first Save of an untitled document asks for a name (`#saveAsDialog`). Later Saves download under the same name.
- The session's file handle is used after a restart only if it belongs to that same file.
- Tests: group 10 (`tests/10-documents.spec.js`).

## Phase 4c — Preferences file

Opening a `.fmide` deliberately ignores personal settings, so they need their own way to travel. Today shortcuts can be exported alone, but the ribbon layout, Quick Access Toolbar and KeyTips key only travel inside a whole workspace.

- **New file kind** `fmIDE-preferences`, version 1, added to fmIDE's `FILE_FORMATS` (fmIDE-only — not in `src/shared/`). It holds the user's **shortcut bindings, ribbon layout, Quick Access Toolbar, ribbon collapsed/expanded state and KeyTips trigger** — the same data as the workspace's `shortcutBindings` and `ui` parts, minus session details (active tab, Command Launcher recents, last-run macro).
- **Commands:** **Export Preferences…** and **Import Preferences…** in the File tab (and Command Launcher), plus matching buttons in the Customize Ribbon dialog. Export downloads `fmIDE-preferences.json`.
- **Import:** goes through the existing reader (wrong-kind and newer-version handling as for every file); asks once — "Replace your shortcuts, ribbon and KeyTips settings with the ones in this file?" — then replaces exactly those settings. It never touches the model, templates, macros or format presets.
- **Kept as they are:** Export/Import Shortcuts (shortcuts only), Import/Export Workspace (everything).
- Other readers point to the right place: a preferences file opened with Load System, Open… etc. gets the usual "That is an fmIDE preferences file… Open it with File → Import Preferences" message.

## Tests (phase 4b)

Headless browsers can't show real save dialogs, so:

- Test the **fallback path** for real: Open through the file input; Save/Save As produce a download named `….fmide` whose content the reader accepts.
- Test the **file-handle path** by replacing `window.showOpenFilePicker` / `window.showSaveFilePicker` in the page with fakes that record what was written; check Save writes back to the same handle and Save As asks for a new one.
- Dirty state and title; Save/Don't save/Cancel prompts; recovery after a reload with unsaved changes; Recent (open two files, reopen the first, clear); opening a `.fmide` adds templates/macros without replacing existing ones and leaves shortcuts unchanged; a legacy `localStorage` workspace is migrated (4a).

## Tests (phase 4c)

- Customise shortcuts, the ribbon (move a command, add one to the Quick Access Toolbar) and the KeyTips key; Export Preferences; reset everything; Import Preferences → all four restored, and the model, templates, macros and format presets unchanged.
- Cancel at the confirmation leaves every setting unchanged.
- A preferences file opened with Load System / Open… gets the wrong-kind message naming Import Preferences; a newer-version preferences file asks first.
- Add a `preferences.json` fixture under `tests/fixtures/formats/`.

## Docs

`docs/file-formats.md` (`.fmide` = workspace; new `fmIDE-preferences` row), README (how to open/save, how to share your preferences), CLAUDE.md (storage layout: IndexedDB, keys, migration), CHANGELOG, `docs/decisions.md` (step 4 ✅; note: PWA file association — double-clicking a `.fmide` to open it — belongs to step 5).
