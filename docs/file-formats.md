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
| `system` | 5 | A whole model (all canvases, periods); v4: a canvas may remember the canvas template it came from; v5: the function definitions its function nodes use | fmIDE: File → Load System · ExcelExporter |
| `module` | 3 | One canvas; v3: the function definitions it uses | fmIDE: File → Load Module |
| `fmIDE-workspace` | 4 | Everything: system + templates, format presets, shortcuts, macros; v4: the function library. A **`.fmide` document** is exactly this, with the `.fmide` extension | fmIDE: File → Open… (a document) or Import Workspace (a full replace) · ExcelExporter |
| `fmIDE-templates` | 4 | Saved templates (each holds a module, a system or a recipe), with their families and versions; v4: a template's model may carry function definitions | fmIDE: Templates → Import Templates |
| `fmIDE-functions` | 1 | Function definitions (a library of functions) | fmIDE: Functions → Import Functions (coming with the Functions manager) |
| `fmIDE-format-presets` | 1 | Format presets, including the format roles | fmIDE: Format Presets → Import Presets |
| `fmIDE-shortcuts` | 2 | Keyboard shortcut bindings | fmIDE: Keyboard Shortcuts → Import Shortcuts |
| `fmIDE-macros` | 1 | Macros | fmIDE: Macro Builder → Import |
| `fmIDE-preferences` | 1 | Personal settings: shortcut bindings for built-in commands, ribbon layout and Quick Access Toolbar, ribbon collapsed state, KeyTips trigger (fmIDE only) | fmIDE: File → Import Preferences (or Customize Ribbon) |
| `fmIDE-excel-mapping` | 1 | ExcelExporter's tab/row layout for one model | ExcelExporter: Import Mapping JSON |

## Functions (`system` 5, `module` 3, `fmIDE-workspace` 4, `fmIDE-templates` 4, `fmIDE-functions` 1)

A **function** is a formula written with the built-in operators, held in a file and used in a model like an operator, for example:

```
Margin(Revenue, Cost) = (Revenue - Cost) / Revenue
```

Functions are formulas, never code: the apps read them with their own parser (`parseFunctionText` in `src/shared/functions.js`) and never run text from a file.

### A definition

```json
{ "family": "0c6f…", "version": 2, "versionId": "a91e…",
  "text": "Profit(Revenue, Cost) = Margin(Revenue, Cost) * Revenue",
  "description": "What is left of revenue, in money.", "note": "Uses Margin v1",
  "calls": [ { "name": "Margin", "family": "7d2b…", "version": 1, "versionId": "5e40…" } ] }
```

- `family`, `version`, `versionId`: like templates (below). The family is a random id and never the name; versions are 1, 2, 3…; `versionId` is a random id for this one version. Ids are 8–64 letters, digits and dashes: a definition whose family or version isn't is left out when read, and a malformed `versionId` counts as unknown. A function is always referred to by its family and version, and its `versionId` when known — never by its name.
- `text`: the whole definition — the function's name, its inputs, and its formula (the syntax below). The name and inputs are read from it.
- `description` (at most 2,000 characters) and `note` (a change note, at most 500): plain text.
- `calls`: for each other function the formula calls, the name it is written with and the version it means. A call is followed through this list, never by name alone, so a function keeps calling the version it was written against.

### Where definitions are carried

- A **system** (v5) and a **module** (v3) carry, in `functions`, every definition their function nodes use, and every function those call. Files whose model uses no functions have no `functions` list.
- A **workspace** (v4) also carries the person's whole library in its own `functions`; its system carries the model's.
- An **`fmIDE-functions`** file (v1) is `{ "kind": "fmIDE-functions", "version": 1, "functions": [ … ] }`.
- A template's model (a module or system inside a templates file, v4) carries its own, like any module or system.
- Opening a file adds any definitions the library doesn't have (the same family and `versionId`).
- The calculation reads only the definitions the model's file carries, not the library: a model calculates the same wherever it is opened.

### A function node

```json
{ "id": "n7", "type": "function", "x": 300, "y": 120, "w": 150, "h": 80,
  "fn": { "family": "7d2b…", "version": 1, "versionId": "5e40…", "name": "Margin" } }
```

An arrow into it carries `toPort`, the input it feeds, counted from 0 in the order the definition lists its inputs (`Revenue` is 0 and `Cost` is 1 above). `fn.name` is only for display. The node's value is the formula with each input read from the arrow into its port.

### Syntax

```
definition := name "(" [ name { "," name } ] ")" "=" formula
formula    := sum [ comparison sum ]            one comparison at most
sum        := product { ("+" | "-") product }
product    := power { ("*" | "/") power }
power      := unary { "^" unary }               from the left: 2^3^2 = 64
unary      := ("-" | "+") unary | item          -2^2 = 4, as in Excel
item       := number | input | call | "(" formula ")"
call       := name "(" [ formula { "," formula } ] ")"
comparison := "<" | "<=" | ">" | ">="
```

- **Names** (the function's and its inputs'): a letter (of any language) or `_`, then letters, digits, `_` and `.`; at most 64 characters; capitals don't matter (`revenue` is `Revenue`). Two inputs can't share a name, an input can't have the function's name, and neither can be the name of a built-in or kept-back function (below).
- **Numbers**: `12`, `0.5`, `.5`, `1.5e3`. There are no negative numbers as such: `-3` is a minus applied to 3.
- **Signs**: `+ - * / ^` and `< <= > >=`. fmIDE's own signs `− × ÷ ≤ ≥` mean the same.
- **Precedence**, as in Excel: a leading minus first (`-2^2` is 4), then `^` (from the left), then `*` and `/`, then `+` and `-`, then a comparison. A comparison gives 1 (true) or 0 (false).
- **Built-in functions**, with Excel's numbers of inputs: `MIN(a, …)`, `MAX(a, …)`, `AVERAGE(a, …)` (at least one input), `ABS(a)`, `MOD(a, b)` (the result takes the divisor's sign, like Excel's MOD), `IFERROR(a, b)` (a, or b when a fails).
- **Calls** to other functions: `Margin(Revenue, Cost)`, with exactly as many inputs as that function has. A function can't call itself.
- **Not accepted** (each with its own message): a chain of comparisons (`a < b < c`), `=` or `<>` in the formula, `%`, `&`, text in quotes, `;`, and these Excel names, kept back for later: `IF IFS AND OR NOT XOR SUM PRODUCT ROUND ROUNDUP ROUNDDOWN INT TRUNC LN LOG LOG10 EXP SQRT POWER SIGN COUNT LET LAMBDA CHOOSE INDEX NA TRUE FALSE PI CEILING FLOOR MEDIAN SUMPRODUCT`.
- **Limits**: a definition of at most 4,000 characters, 32 inputs, 64 levels of brackets and signs, calls nested at most 16 functions deep, and at most 64 different functions called from one.
- A parse error gives a message and the place in the text where it was found.

### Calculating

- An input is read only when the formula needs it, so `IFERROR(x, 0)` catches a failing input, as Excel does, and an input the formula doesn't read may be left unconnected.
- A result that isn't a finite number (a divide by zero, `(-4)^0.5`, a result too large) is an error, as in Excel (`#DIV/0!`, `#NUM!`).
- **Errors** of a function node: the definition isn't in the file, or has another `versionId` (`function-missing`, also when a function it calls is missing); its text can't be read (`function-unreadable`); functions call each other in a loop (`function-cycle`, only possible in a hand-edited file); calls nested more than 16 deep (`function-too-deep`); a call with the wrong number of inputs (`function-arguments`); an input the formula reads isn't connected (`function-input-unwired`); an input fails (`missing-input`).
- **Units** are worked out from the formula with the operators' rules, using the units of what feeds each input. A number in the formula has no unit of its own: it counts as a plain number for `*` and `/` (`Revenue * 1.1` keeps Revenue's unit) and is left out where the units must match (`Revenue + 100` keeps it too). `^`, `MOD` and comparisons give no unit.
- A rectangle fed by a function whose input needs a period outside the timeline (a corkscrew's opening balance in period 1) shows its own typed number, or 0, as with an operator.

### Older and newer files

Older files (`system` 1–4, `module` 1–2, `fmIDE-workspace` 1–3, `fmIDE-templates` 1–3) have no functions; the upgrade steps change nothing. An older app asks before opening a newer file; without that, it would calculate a function node as an operator it doesn't know.

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
