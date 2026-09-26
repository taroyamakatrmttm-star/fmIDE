# File formats

Every JSON file the apps write carries a `kind` and a `version`. Every file they read goes through one reader — `readFmFile()` in fmIDE, `readKnownFile()` in ExcelExporter — which:

1. identifies the kind (older files without `kind` are recognised by their shape, e.g. a bare macro list);
2. rejects the wrong kind of file with a message saying what it is and where to open it;
3. upgrades older versions one step at a time (`FILE_MIGRATIONS`);
4. asks once, up front, before opening a file saved by a **newer** version (cancel, or open anyway);
5. does the same for nested content: a workspace's system, each template's model.

The part both apps share lives once in `src/shared/file-formats.js`: the versions and upgrade steps of the two kinds both apps read (`SHARED_FILE_VERSIONS`, `SHARED_FILE_MIGRATIONS` for `system` and `fmIDE-workspace`), kind inference (`inferFileKind`) and the version check with step-by-step upgrades (`upgradeFileData`). Each app's `FILE_FORMATS` / `FILE_MIGRATIONS` are built from those plus its own kinds; the messages and nested-content handling stay in each app's reader.

## Documents (`.fmide`)

A `.fmide` file is an `fmIDE-workspace` file (same `kind`, same version, same reader) saved with the `.fmide` extension by fmIDE's **File → Save / Save As**. There is no separate format. Opening one with **File → Open…** loads the model and its format presets/roles, adds its templates and macros when not already there, and ignores its shortcuts and ribbon/KeyTips settings. **Import Workspace** of the same file replaces everything, as before. The workspace's `ui` part may carry `documentGroupAdded: true` (a customised ribbon already got the Document group once); older readers ignore it.

## Current versions

| `kind` | Version | What it is | Opened with |
|---|---|---|---|
| `system` | 4 | A whole model (all canvases, periods); v4: a canvas may remember the canvas template it came from | fmIDE: File → Load System · ExcelExporter |
| `module` | 2 | One canvas | fmIDE: File → Load Module |
| `fmIDE-workspace` | 3 | Everything: system + templates, format presets, shortcuts, macros. A **`.fmide` document** is exactly this, with the `.fmide` extension | fmIDE: File → Open… (a document) or Import Workspace (a full replace) · ExcelExporter |
| `fmIDE-templates` | 3 | Saved templates (each holds a module, a system or a recipe), with their families and versions | fmIDE: Templates → Import Templates |
| `fmIDE-format-presets` | 1 | Format presets, including the format roles | fmIDE: Format Presets → Import Presets |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings | fmIDE: Keyboard Shortcuts → Import Shortcuts |
| `fmIDE-macros` | 1 | Macros | fmIDE: Macro Builder → Import |
| `fmIDE-preferences` | 1 | Personal settings: shortcut bindings for built-in commands, ribbon layout and Quick Access Toolbar, ribbon collapsed state, KeyTips trigger (fmIDE only) | fmIDE: File → Import Preferences (or Customize Ribbon) |
| `fmIDE-excel-mapping` | 1 | ExcelExporter's tab/row layout for one model | ExcelExporter: Import Mapping JSON |

## Plugs (`system` 3, `module` 2)

A value rectangle can carry several plug names: `"plugs": ["to Income Tax expense", "to CF Income Tax paid"]`. Each name feeds the rectangle into every operator whose `socket` has that name (names match regardless of capitals), on any canvas; an operator still has one `socket`. The connections this makes are saved too (arrows and aliases marked `"auto": true`), but only as fmIDE's drawing of them: when reading a model, both apps work the connections out again from the plug and socket names (`plugLinks` in `src/shared/ir.js`) and set the saved ones aside, so a file whose saved connections are out of date or missing still calculates as fmIDE shows it. Keep writing them: older copies of ExcelExporter read only those. (An alias drawn this way sits left of its socket, 200 px across and stacked 74 px down per plug from another canvas; that place sets the order its operator reads it in.)

Older files (`system` 1–2, `module` 1) held one name, `"plug": "Revenue"` (blank for none). Reading one turns it into `"plugs": ["Revenue"]` (or `[]`) and removes `plug` — the upgrade step `SHARED_FILE_MIGRATIONS.system[2]` and fmIDE's `FILE_MIGRATIONS.module[1]`, both using `upgradeNodePlugs()` in `src/shared/file-formats.js`. That covers every way a model arrives: Load System / Load Module, Open… and Open Recent, Import Workspace, templates (each template's model is upgraded as it is read) and the autosave. An older fmIDE opening a newer file asks first ("saved by a newer version"), so it never drops extra plugs without saying so.

## Recipes (`fmIDE-templates` 3, `fmIDE-workspace` 3)

A **recipe** is a template (with a family, version and note like any other) whose `kind` is `"recipe"`. It lists canvas templates to add together:

```json
{ "name": "Three Statements", "kind": "recipe", "family": "…", "version": 1, "note": "", "versionId": "…",
  "data": { "kind": "recipe", "parts": [
    { "family": "…income…", "version": "latest", "name": "Income Statement" },
    { "family": "…balance…", "version": 2, "versionId": "…", "name": "Balance Sheet" } ] } }
```

- Each part is a canvas template family, either `"latest"` (whatever the newest version is when the recipe is built) or a pinned version number. A pinned part records the `versionId` it was made with. `name` is only for display, when the family isn't in the library.
- **Building** adds one canvas per part, in order, each linked to its template version (see below). Plugs and sockets then connect the canvases by name. The build warns when a pinned version in the library isn't the one the recipe recorded (it builds with the library's), skips a part whose family or pinned version isn't in the library (with a warning), and lists sockets nothing feeds. Nothing is refused unless no part at all can be built.
- **Reading:** at most 50 parts. A part whose `family` isn't 8–64 letters, digits and dashes, or whose `version` isn't `"latest"` or a whole number of 1 or more, is dropped; a recipe with no parts left is skipped. Names are text of at most 200 characters.
- Older files (`fmIDE-templates` 1–2, `fmIDE-workspace` 1–2) have no recipes; the upgrade steps change nothing. An older fmIDE asks before opening a version 3 file; without that, it would read a recipe as a broken canvas template. ExcelExporter ignores templates.

## Canvases linked to a template (`system` 4)

A canvas made from a canvas template remembers it:

```json
{ "id": "c3", "name": "Sales", "nodes": [], "edges": [],
  "template": { "family": "3f2a9c1e-…", "version": 2, "versionId": "9b1c…", "name": "Sales", "skipped": 3 } }
```

- `family`, `version` and `versionId` identify the template version the canvas came from (see below). `name` is only for display, when the family isn't in the library. `skipped` (optional) is a newer version the person chose "Not now" for.
- A link is set by **Add to new canvas**, by **Add to current canvas** on an empty canvas, and by saving the canvas as a template (or as a new version). Adding a template into a canvas that has other content removes the link. **Unlink Canvas from Template** removes it too.
- Links are saved in systems, and so in workspaces, `.fmide` documents and the autosave. Module files never carry one. **Add System** keeps the links of the canvases it adds as new canvases; a canvas merged into an existing one gets none.
- **Reading:** a link whose `family` or `versionId` isn't 8–64 letters, digits and dashes, or whose `version` isn't a whole number of 1 or more, is dropped (a bad `versionId` alone becomes "unknown"). A link counts as coming from a library version only when the family *and* `versionId` match, never by number alone.
- **Update this canvas** replaces the canvas's content with another version of its template. The canvas keeps its id and name. Rectangles whose names match between the canvas and that version keep their ids, so aliases elsewhere keep working. Each input rectangle keeps the value typed on the canvas: the value line, `periodValues`, `periodValuesRange` and `literalPeriods`.
- Older systems (`system` 1–3) have no links. The upgrade step `SHARED_FILE_MIGRATIONS.system[3]` changes nothing. ExcelExporter ignores links, so its workbooks are unchanged.

## Template families and versions (`fmIDE-templates` 2, `fmIDE-workspace` 2)

Each saved template is one **version** of a template **family**. A templates file (and a workspace's `templates` list) holds one entry per version:

```json
{ "name": "Income Statement", "description": "", "group": "Statements", "kind": "module",
  "family": "3f2a9c1e-7b4d-4e0a-9c3b-5d8e1f2a6b7c", "version": 3, "note": "Tax split out",
  "versionId": "9b1c…", "data": { "kind": "module", "version": 2, "nodes": [], "edges": [] } }
```

- `family` — a random id (UUID v4 form), the same for every version of the template. It is random so that templates from different people never clash; the name is only a label.
- `version` — 1, 2, 3… within the family. A new version is made only by **Save as new version** (or by choosing it when saving under a name already used). Saving under a new name starts a new family.
- `note` — a short change note (at most 200 characters, plain text).
- `versionId` — a random id for this one version. Version numbers are counted in each person's library, so two libraries can each have a different "version 3" of the same family. `versionId` tells them apart.
- `name`, `group`, `description` and `kind` belong to the family: every version carries the same ones. A family is always one kind. A workspace entry also has `id`, fmIDE's local id for the entry (reassigned when read; never refer to it from elsewhere).

**Reading.** A malformed `family` or `versionId` (anything but 8–64 letters, digits and dashes) gets a new random one. A `version` that isn't a whole number of 1 or more becomes 1. Two entries with the same family and version get separate numbers. When templates are imported (Open…, Import Workspace, Import Templates):
- a version the library already has (same family, the same content under the same number or the same `versionId`) is skipped;
- a version whose number is free in that family is added under its number;
- a version whose number is already taken by different content is added after the file's other versions, under the family's next number, with the note "Imported — was vN in the file: …";
- a family the library doesn't have is added, unless the library already holds the same template (same name, kind and content). An older file read twice gets new random families each time, so this rule is what keeps its templates from being added twice.

**Referring to a template** (`insertTemplate`, macros): `Name` (the latest version), `Name@latest`, `Name@3`, or the same with the family id in place of the name. If two families share a name, only the family id works. Anything lasting should store the family id and the version (or `versionId`), not the name.

**Older files** (`fmIDE-templates` 1, `fmIDE-workspace` 1) had no families. Reading one makes each template a family of its own, version 1, with an empty note and new random ids: the upgrade steps `FILE_MIGRATIONS['fmIDE-templates'][1]` (fmIDE) and `SHARED_FILE_MIGRATIONS['fmIDE-workspace'][1]`, both using `upgradeTemplateEntries()` in `src/shared/file-formats.js`. ExcelExporter reads workspace version 2 and ignores templates. An older fmIDE asks before opening a version 2 file.

## Changing a format

1. Raise the version for that kind: for `system` and `fmIDE-workspace` (read by **both** apps) in `SHARED_FILE_VERSIONS` in `src/shared/file-formats.js`; for any other kind in its app's `FILE_FORMATS`.
2. Add the upgrade step `[kind][oldVersion]` — a function that upgrades a copy of an old file by exactly **one** version — to `SHARED_FILE_MIGRATIONS` (shared kinds) or the app's `FILE_MIGRATIONS` (its own kinds).
3. `npm run build`: both apps pick up a shared change.
4. Add an old-version sample to `tests/fixtures/formats/` and a test in `tests/6-formats-*.spec.js` so the upgrade stays covered.

## Rules for anything read from a file

Files may come from other people (the planned community library), so text from a file is always shown as plain text, never as HTML; numbers are forced to be numbers; colours are checked before use. Neither app ever runs text from a file as code. The helpers for this (`escapeXml`, `safeNum`, `safeColor`) live in `src/shared/escaping.js`.

---

This document is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CC-BY-4.0.txt) (CC BY 4.0): anyone may use it — for example to build tools that read or write fmIDE files — with credit to fmIDE (Copyright 2026 Taro Yamaka). See [LICENSING.md](../LICENSING.md).
