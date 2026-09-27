# Tutorial: what's new since pull request #23

A hands-on, step-by-step guide to everything added to fmIDE and ExcelExporter in pull requests #23 to #33 (step 7 of the build order: "Formula IR and plugins", phases A to E1a). Work through the lessons in order; each one builds a small model you can check against the numbers given here. Every example in this guide was run against the apps as they are on `main` and gives the numbers shown.

| Lesson | What you learn | Came in |
|---|---|---|
| 1 | The canvas and Excel give the same numbers — the rules that changed | #23 (phase A) |
| 2 | Units worked out for you, including through blocks | #24, #25 (phases B, C) |
| 3 | ExcelExporter's "where the workbook will differ" list | #25 (phase C) |
| 4 | Writing your first function | #26, #27 (phases D1, D2a) |
| 5 | Putting a function on the canvas | #28 (phase D2b) |
| 6 | Function versions and updating | #27, #28 |
| 7 | Functions that call functions | #27 |
| 8 | Sharing functions: files, copy and paste, import and export | #26–#28 |
| 9 | Functions in Excel | #31 (phase D3) |
| 10 | New operators: period, if, =, ≠, and, or, not, round… | #33 (phase E1a) |
| 11 | Doing it all from a script or macro (`window.fm`) | #27, #28, #33 |
| — | Smaller fixes worth knowing | #29, #30, #32 |

**What you need:** fmIDE (`apps/fmIDE.html`, or the web app at https://fmide.pages.dev) and ExcelExporter (`apps/ExcelExporter.html`, or **File → Open ExcelExporter** in fmIDE). Excel or LibreOffice to open the workbooks.

**Two ways to run a command** used throughout:
- the **ribbon** (File, Home, Insert… tabs), and
- the **Command Launcher**, **Ctrl+K** (Cmd+K on a Mac): type part of a command's name, press Enter. Commands that take settings (for example *Create Operator…* or *Connect…*) open a small form first.

---

## Lesson 1 — The canvas and Excel give the same numbers (#23)

Before #23, a handful of cases gave one number on the canvas and another in the exported workbook. They were fixed so both apps now follow the same rules. You don't have to do anything differently, but it helps to know the rules.

### 1.1 Modulo (`%`) works like Excel's MOD

1. In fmIDE, **File → New** to start a clean document (choose *Don't save* if asked).
2. Add two rectangles (Home → Insert → **Add Rectangle**): **A** with value `-7`, **B** with value `3`.
3. Add a `%` operator (Insert tab, *Arithmetic* group). Draw arrows A → `%` and B → `%` (A on the left, B on the right: `%` reads its inputs left to right).
4. Add a rectangle **Mod** with no value and draw `%` → Mod.
5. Mod shows **2**. The result takes the sign of the divisor, as Excel's `MOD(-7, 3)` does. (Before #23 fmIDE showed −1.)

### 1.2 Comparison chains

A comparison with three inputs, `a < b < c`, now means "a < b **and** b < c" in both apps. A comparison with only one input is an error ("?" in fmIDE, `#N/A` in Excel).

### 1.3 `iferror` with one failing input, or none

`iferror` with a single input that fails, or with nothing wired in, now gives **0** in both apps.

### 1.4 Typed numbers in chosen periods

Each rectangle has a 🕒 button: *Which periods use this rectangle's own number?* A ticked period now uses the typed number **even if the rectangle has an arrow into it** — in both apps.

### 1.5 The corkscrew's opening balance

In a corkscrew (Closing → period shift −1 → Opening), period 1 has no previous period. The Opening rectangle then shows **its own typed number, or 0** — and now Excel writes that too (before, Excel wrote 0 and every later period was off).

### 1.6 A failing source shows "?"

A wired rectangle whose source fails for a real reason (say a divide by zero) now shows **"?"** in fmIDE, just as Excel shows an error. The typed number is used only where the timeline runs out (1.5).

**Check it:** build 1.1 and 1.5, save (**Ctrl+S**), load the `.fmide` file in ExcelExporter, and generate the workbook. The numbers match the canvas in every period.

---

## Lesson 2 — Units, worked out for you (#24, #25)

Both apps now calculate from one shared description of the model (the "IR", intermediate representation), so values **and units** come from the same place. What you'll notice:

1. **Faster calculation:** on a large model (about 1,900 nodes, 24 periods), fmIDE calculates in about a third of the time it used to, and ExcelExporter generates about a third faster.
2. **Units through blocks:** a rectangle fed by a block now shows the unit worked out through that block. Try it:
   1. Make a canvas **Price x Volume** with an input rectangle `Price` (unit `$/t`, marked as block input with ⇄), `Volume` (unit `kt`, block input), a `×` operator, and an output rectangle `Revenue` (⇄ → output).
   2. On another canvas, insert that block (Home → Insert → **Add Block**) and feed it rectangles with units `$/t` and `kt`.
   3. The rectangle fed by the block's output shows **$k** — the same unit the workbook shows in column B.
3. While you drag a rectangle, units update when you drop it.

---

## Lesson 3 — "Where the workbook will differ from fmIDE" (#25)

Excel writes 0 or a blank in some places where fmIDE shows "?" because something in the model is broken. ExcelExporter now **tells you before you download**.

1. In fmIDE, build: rectangle **Revenue** = `100`, rectangle **Cost** = `60`, operator `−`, rectangle **Profit**; wire Revenue and Cost into `−`, and `−` into Profit.
2. Add a second arrow into **Profit** from Cost (a rectangle with two arrows in is broken). Profit shows "?".
3. Save (**Ctrl+S**), open ExcelExporter, and load the file.
4. Above **Generate & Download .xlsx**, a yellow panel reads *"Where the workbook will differ from fmIDE (1):"* and names Profit, the periods, the cause, and whether Excel writes 0 or leaves the cell blank.
5. You can still download. Remove the extra arrow in fmIDE, save, load again: the panel is gone.

The panel also lists: an alias pointing at nothing, a loop, a missing block, an operator fmIDE doesn't know, a row you left out of the layout that other rows read, and (from lesson 9) every function problem.

Two more things changed quietly in #25:
- **Plugs and sockets are worked out from their names** in both apps, so a file whose saved links are out of date (a plug renamed after saving) still gives the same numbers in both.
- **Your ExcelExporter layout is kept** when fmIDE redraws plug links (before, it could be lost). Layouts saved earlier are still found.

---

## Lesson 4 — Your first function (#26, #27)

A **function** is a formula you write once and use like an operator, for example `Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`. It lives in your **function library** and travels inside every file whose model uses it. It is only ever read as a formula — never run as code — so functions from other people are safe to open.

1. **File → Functions** (the *Library* group; also **Insert → My Functions → Functions**). The Functions manager opens.
2. Click **+ New Function…**.
3. Type the whole definition on one line:
   ```
   Margin(Revenue, Cost) = (Revenue - Cost) / Revenue
   ```
   As you type, the editor shows the name (*Margin*) and inputs (*Revenue, Cost*). Make a mistake on purpose — delete the last `)` of `(Revenue - Cost)` — and the editor points to where it is and keeps **Save** off. Put it back.
4. Add a description (*Gross margin as a fraction of revenue*) and click **Save**. Margin appears in the list as **v1**.

**What you can write in a formula:**

| | |
|---|---|
| Inputs | By name; capitals don't matter (`revenue` = `Revenue`) |
| Numbers and arithmetic | `+ - * / ^` (also `− × ÷`), brackets, a leading minus. Excel's order of operations: `-2^2` is 4 |
| One comparison | `<`, `<=`, `>`, `>=`, `=`, `<>` (or `≠`) — gives 1 or 0 |
| Built-in functions | `MIN`, `MAX`, `AVERAGE`, `ABS`, `MOD`, `IFERROR`; and since #33 `IF`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `PERIOD()` |
| Your other functions | `Margin(Revenue, Cost)` — see lesson 7 |
| Not accepted (with a message) | chains like `a < b < c`, `%`, text in quotes, and Excel names kept back for later (`SUM`, `LN`, `EXP`, `SQRT`, …) |
| Limits | 4,000 characters, 32 inputs, 64 levels of brackets, calls nested 16 deep |

The full syntax is in [`docs/file-formats.md`](file-formats.md) (section *Functions*).

**Deleting:** select a function and click **🗑 Delete**. If the open model uses it, fmIDE warns but lets you — the model keeps its own copy and still calculates. Older versions are deleted one at a time; the latest only together with the whole function.

---

## Lesson 5 — A function on the canvas (#28)

1. Make two rectangles: **Revenue** = `300` and **Cost** = `200`.
2. **Home → Insert → Insert Function…** (also Insert → My Functions, or **ƒ Insert v1** in the Functions manager). Search for *Margin* and pick it.
3. A teal box appears: **ƒ Margin v1**, with an input dot for *Revenue* and one for *Cost* on the left, and its value on the right.
4. Drag an arrow from **Revenue** onto the *Revenue* dot. The box shows **"?"** — hover to read why: an input the formula needs has no arrow.
5. Drag an arrow from **Cost** onto the box itself: it goes into the first empty input (*Cost*). The box now shows **0.333…**.
6. Add a rectangle **Margin %** and draw an arrow from the box's output to it. Margin % shows 0.333….
7. **Double-click** the box to see its definition.

The model now carries its own copy of Margin v1, so it calculates the same on anyone's computer. Deleting the last Margin box removes that copy from the model (undo brings it back).

---

## Lesson 6 — Versions and updating (#27, #28)

Functions have versions, like templates.

1. **File → Functions**, select *Margin*, click **Edit as new version…**.
2. Change the formula to round the result:
   ```
   Margin(Revenue, Cost) = ROUND((Revenue - Cost) / Revenue, 2)
   ```
   Write a short note (*rounded to 2 decimals*) and save. Margin is now **v2**; **▸ older versions** lists v1.
3. Back on the canvas, the Margin box shows **⬆**. Click it (or the box's **⋯**). The menu offers:
   - **⬆ Update to v2** — this box only. Margin % becomes **0.33**.
   - **Not now** — the ⬆ disappears until an even newer version exists (remembered in the file).
   - **Update every use…** — a window listing every box of this function, on every canvas, with the arrows each would lose. Boxes you said *Not now* to start unticked. One undo reverses the lot.
   - **Change function or version…** — swap this box for another function or an older version.
   - **Show definition**.
4. **Arrows follow inputs by name.** If a new version renames or removes an input, the arrow into it is dropped — fmIDE lists what will be dropped and asks first.
5. **Update Function…** (Insert → My Functions) does the same for the selected box, or lets you pick a function that has a newer version.

---

## Lesson 7 — Functions that call functions (#27)

1. **+ New Function…**:
   ```
   MarginPct(Revenue, Cost) = Margin(Revenue, Cost) * 100
   ```
2. The editor shows that the call to *Margin* is tied to **one version** (the latest when you save). Save.
3. Later versions of Margin don't change MarginPct until you save a new version of MarginPct; the manager marks it **⚠ calls an older version** meanwhile.
4. If two functions in your library share a name (possible after importing someone else's), the editor asks which one you mean and keeps Save off until you choose.

A function can't call itself, and calls can nest at most 16 deep. Deep nesting is fast since #32 (below).

---

## Lesson 8 — Sharing functions (#26–#28)

- **Files carry their functions.** Save, Save System, Save Module, Export Workspace and templates include every function the model uses (and those they call). Opening such a file adds them to your library.
- **Copy and paste** function boxes, even into another document: their definitions come along and join your library.
- **Export / Import:** in the Functions manager, **⇩ Export Functions** (tick which ones) writes an `fmIDE-functions` file; **⇧ Import Functions** reads one. Importing never replaces your functions: versions you already have are skipped, and a *different* version under a number you already use is added under the next free number.
- **Clashes inside a model:** pasting (or bringing in a module, system or template) with a different version under a number the model already uses renumbers the incoming one, and the pasted boxes follow it. **Insert Function…** instead refuses and tells you to update the existing boxes first.

---

## Lesson 9 — Functions in Excel (#31)

1. Save the model from lesson 5 (**Ctrl+S**) and load it in ExcelExporter.
2. Click **Generate & Download .xlsx** and open the workbook.
3. Margin %'s cells hold the function **written out in full**, with each input replaced by the cell it reads: for example `=((E5-E6)/E5)` (v1) or `=ROUND((E5-E6)/E5,2)` (v2); the cell addresses depend on your layout. No macros, no `LAMBDA` — it works in any Excel.
4. The last tab, **Functions**, lists each function version used: name, version, definition, description, note, and the rows that use it.

**When Excel shows `#N/A`:** wherever fmIDE shows "?" for a function — a missing or unreadable definition, a wrong number of inputs, an input the formula reads with no arrow. Try it: insert a second Margin box, wire only Revenue into it, feed it into a rectangle **Broken**, save, and load in ExcelExporter. The panel from lesson 3 says: *"Broken" … fmIDE shows ? … because an input its function reads has no arrow … Excel shows #N/A there.* The cell's formula is `=((E5-NA())/E5)`.

**Formulas too long for Excel:** if writing a call out in full would pass Excel's limits (8,192 characters or 64 levels of brackets), the cell gets `#N/A` and the panel lists it, advising you to put a rectangle in between (which splits the formula).

Comparisons inside a function give 1 or 0 in Excel, as on the canvas.

---

## Lesson 10 — New operators: timing, conditions, rounding (#33)

Ten new operators calculate the same in fmIDE and Excel:

| Operator | What it does | Inputs | In Excel |
|---|---|---|---|
| `period` | The period number: 1, 2, 3… | none | the sheet's *Period #* cell |
| `if` | *then* where *condition* isn't 0, otherwise *else*; only the branch taken is calculated | named: condition, then, else | `IF` |
| `=`, `≠` | Equal, not equal (1 or 0); `0.1 + 0.2 = 0.3` counts as equal, as in Excel | left to right | `=`, `<>` |
| `and`, `or`, `not` | Logic on 1/0 | left to right | `AND`, `OR`, `NOT` |
| `round`, `roundup`, `rounddown` | Round *value* to *digits* places, exactly as Excel (`round(2.675, 2)` is 2.68) | named: value, digits | `ROUND`, `ROUNDUP`, `ROUNDDOWN` |

**For now (until the next update, E1b)** they are not in the palette or the Insert tab. Place them with the Command Launcher, and wire `if` and `round` by input name (dragging onto them doesn't pick an input yet). Operators that read left to right (`=`, `and`…) can be wired by dragging as usual.

### 10.1 A corkscrew with `if`

The classic *"opening balance in period 1, previous closing after that"*:

1. **File → New**, then set 4 periods (Home → Compute → **Manage Periods**).
2. **Ctrl+K → Create Operator…**, choose `period` in the *op* list, Enter. Add a rectangle **Period** (no value) and draw `period` → Period. Period shows 1, 2, 3, 4 as you step through periods.
3. Add a rectangle **First** = `1`. **Ctrl+K → Create Operator…** with op `=`. Drag Period → `=` and First → `=`, then `=` → a new rectangle **Is first period**. It shows 1 in period 1, 0 after.
4. Add rectangles **Opening** = `100` and **Previous closing** (no value).
5. **Ctrl+K → Create Operator…** with op `if`. Click the `if` box to select it.
6. **Ctrl+K → Connect…** and fill in: *from* `Is first period`, *to* `@sel`, *toPort* `condition`. Repeat with *from* `Opening`, *toPort* `then`, and *from* `Previous closing`, *toPort* `else`. (`@sel` means "the selected node"; *toPort* also takes a number: 1 condition, 2 then, 3 else.)
7. Add a rectangle **Beginning** and drag `if` → Beginning.
8. Add **Drawdown** = `25`, a `+` operator, and **Closing**: Beginning → `+`, Drawdown → `+`, `+` → Closing.
9. Add a period shift (Home → Insert → **Add Period Shift**, −1): Closing → shift → Previous closing.

| Period | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Beginning | 100 | 125 | 150 | 175 |
| Closing | 125 | 150 | 175 | 200 |

In period 1 the *else* branch reaches before the first period, but since `if` only calculates the branch it takes, that's fine.

### 10.2 Rounding

1. Rectangles **X** = `2.675` and **Digits** = `2`.
2. **Ctrl+K → Create Operator…** with op `round`; select it; **Connect…** X → `@sel` toPort `value`, Digits → `@sel` toPort `digits`.
3. Drag `round` → a rectangle **Rounded**: **2.68** (as in Excel; a naive calculation gives 2.67). Negative digits round to tens, hundreds…: `1234.5678` with digits `-2` gives 1200.

### 10.3 The same in a function

Functions can use the new operators too:
```
Escalated(Base, Rate) = Base * (1 + Rate) ^ (PERIOD() - 1)
StartFlag(Start) = IF(PERIOD() >= Start, 1, 0)
```
A function's own corkscrew works as well: `IF(PERIOD() = 1, First, Previous)`.

### 10.4 In Excel and in files

Save and generate: the new operators are written as `IF(…)`, `ROUND(…)`, `AND(…)` and the period number as a reference to the sheet's *Period #* row. An `if` or `round` input the formula needs but has no arrow is `#N/A`, and appears in the list before download.

Files using the new operators are **system version 6** (module 4, workspace 5, templates 5). An older copy of fmIDE or ExcelExporter asks before opening them. Older files open as before.

**Also changed:** an operator fmIDE doesn't know (only possible in a hand-edited file) now shows "?" and `#N/A`, instead of passing its first input through.

---

## Lesson 11 — Doing it all from a script or macro (#27, #28, #33)

Everything above is also an action in `window.fm` (full list: [`docs/fmIDE-automation-api.md`](fmIDE-automation-api.md)). You can run them from the browser's developer console (F12), from the Command Launcher, or record them in a macro (**Record Macro**; the Macro Builder shows the steps). This script rebuilds lessons 4–6 and 10.1:

```js
fm.clearAll(); fm.setPeriodCount(4);

// Lessons 4–6: a function, on the canvas, then a new version
fm.saveFunction({ text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue' });   // "Margin@1"
fm.createRect({ x: 0, y: 0,   name: 'Revenue', value: '300' });
fm.createRect({ x: 0, y: 100, name: 'Cost',    value: '200' });
const f = fm.insertFunction({ function: 'Margin', x: 300, y: 40 });
fm.connect({ from: 'Revenue', to: '#' + f, toPort: 'Revenue' });   // input by name…
fm.connect({ from: 'Cost',    to: '#' + f, toPort: 2 });           // …or number from 1
fm.createRect({ x: 550, y: 40, name: 'Margin %', value: '' });
fm.connect({ from: '#' + f, to: 'Margin %' });
fm.getValue('Margin %');                                            // 0.333…
fm.saveFunction({ text: 'Margin(Revenue, Cost) = ROUND((Revenue - Cost) / Revenue, 2)',
                  newVersionOf: 'Margin', note: 'rounded' });       // "Margin@2"
fm.updateFunctionNode({ node: '#' + f });                           // { version: 2, dropped: [] }
fm.getValue('Margin %');                                            // 0.33

// Lesson 10.1: the if corkscrew on its own canvas
fm.addCanvas('Debt');
const per = fm.createOperator({ x: 0, y: 0, op: 'period' });
fm.createRect({ x: 120, y: 0, name: 'Period', value: '' });
fm.connect({ from: '#' + per, to: 'Period' });
fm.createRect({ x: 120, y: 100, name: 'First', value: '1' });
const eq = fm.createOperator({ x: 350, y: 50, op: '=' });
fm.connect({ from: 'Period', to: '#' + eq });
fm.connect({ from: 'First',  to: '#' + eq });
fm.createRect({ x: 500, y: 50,  name: 'Is first period', value: '' });
fm.connect({ from: '#' + eq, to: 'Is first period' });
fm.createRect({ x: 0, y: 250, name: 'Opening', value: '100' });
fm.createRect({ x: 0, y: 350, name: 'Previous closing', value: '' });
const iff = fm.createOperator({ x: 700, y: 250, op: 'if' });
fm.connect({ from: 'Is first period',  to: '#' + iff, toPort: 'condition' });
fm.connect({ from: 'Opening',          to: '#' + iff, toPort: 'then' });
fm.connect({ from: 'Previous closing', to: '#' + iff, toPort: 'else' });
fm.createRect({ x: 850, y: 250, name: 'Beginning', value: '' });
fm.connect({ from: '#' + iff, to: 'Beginning' });
fm.createRect({ x: 850, y: 400, name: 'Drawdown', value: '25' });
const add = fm.createOperator({ x: 1050, y: 300, op: '+' });
fm.connect({ from: 'Beginning', to: '#' + add });
fm.connect({ from: 'Drawdown',  to: '#' + add });
fm.createRect({ x: 1200, y: 300, name: 'Closing', value: '' });
fm.connect({ from: '#' + add, to: 'Closing' });
const sh = fm.createPeriodShift({ x: 0, y: 450, shift: -1 });
fm.connect({ from: 'Closing', to: '#' + sh });
fm.connect({ from: '#' + sh,  to: 'Previous closing' });
[1, 2, 3, 4].map(p => fm.getValue('Closing', p));                  // [125, 150, 175, 200]
```

Other function actions: `listFunctions` (`{ of: 'model' }` for the model's own copies), `getFunction`, `setFunctionInfo`, `deleteFunction`, `importFunctions`, `exportFunctions`, `changeFunction`, `updateFunctionUses`, `skipFunctionUpdate`, `addFunctionDefinition`. Functions are referred to as `Margin` (latest), `Margin@latest`, `Margin@2`, or by family id when two share a name. `fm.nodes()` shows a function box's `fn` (family, version, versionId, name).

---

## Smaller fixes worth knowing

- **Editing models from hand-written files (#29):** in a model whose node ids came from a file (not from fmIDE), editing a node on the canvas could fail with "There is no rectangle named…" or change the wrong rectangle. The canvas now always refers to nodes by id. The vertical block's broadcast/indexed toggle can be clicked again.
- **Nodes without a size (#30):** a node in a file with no width or height gets its type's usual size, so it and its arrows draw properly.
- **Deeply nested functions are fast (#32):** a function that uses an input several times, nested inside others, used to take four times longer per level (hours at 16 levels) and could freeze the page. The same call in one formula is now worked out once: 16 levels calculate at once. Values are unchanged.

---

## Check you've mastered it

- [ ] You can explain why −7 % 3 is 2, and what a corkscrew's Opening shows in period 1.
- [ ] You've seen the "differs from fmIDE" panel in ExcelExporter, and made it go away.
- [ ] You've written a function, put it on the canvas, wired it by input name, and seen "?" for a missing input.
- [ ] You've saved a second version and updated a box with ⬆ (and tried *Not now* and *Update every use…*).
- [ ] You've exported functions to a file and imported them.
- [ ] You've opened a workbook and found a function written out in full, and the Functions tab.
- [ ] You've built the `if` corkscrew and rounded 2.675 to 2.68.
- [ ] You've run the lesson 11 script from the console or a macro.

What comes next (phase E1b): the new operators in the palette and ribbon, with their named inputs drawn on the canvas so they can be wired by dragging.
