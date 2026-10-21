# Part 4 — Macros and scripting

[← Part 3](03-reuse.md) · [Contents](README.md) · [Part 5 →](05-excelexporter.md)

Let fmIDE do repetitive work for you: record what you do as a macro and play it back, or write the steps yourself. Everything you can do with the ribbon is also an action you can call from a macro or a script. After this part you can build a model from a script and check its numbers.

The numbers in this part were checked against the apps on `main` at pull request #196 (21 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [4.1 Recording and running a macro](#recording-macros) | Record Macro, Run Last Macro, My Macros on the ribbon | foundations |
| [4.2 The Macro Builder](#macro-builder) | Steps, variables, loops, stepping through | foundations, [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#103](https://github.com/taroyamakatrmttm-star/fmIDE/pull/103) |
| [4.3 Macros that keep working when the model changes](#reliable-macros) | References, `@all[k]`, Copy Reference, ⚠ notes | [#102](https://github.com/taroyamakatrmttm-star/fmIDE/pull/102) |
| [4.4 Scripting fmIDE with `window.fm`](#scripting-fm) | Building and checking a model from a script | foundations, step 7 ([#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)) |
| [4.5 Scripting fmGraph with `window.fmGraph`](#scripting-fmgraph) | Bars, sliders and charts from a script | step 15 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)), step 18 ([#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146)) |


---

<a id="recording-macros"></a>
## Lesson 4.1 — Recording and running a macro

> **Goal:** record what you do, and play it back with one click.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Macros* (`macros`)
> **Came in:** the first version

A **macro** is a list of steps fmIDE runs for you, in order. It runs as one step you can undo, and if any step fails it stops and puts everything back, so a macro never leaves a model half changed.

### Steps

1. **File → New**.
2. **Macros → Record Macro**. The window *Record a new macro* opens. Give it a **Macro name**, such as `Two lines`, and press **⏺ Start recording**. A red pill on the ribbon reads *Recording · 0 steps — stop*.
3. **Home → Add Rectangle**, type `Revenue`, Enter. Add another: `Costs`.
4. Click the red **Recording** pill (or **Macros → Record Macro** again) to stop. The **🧩 Macro Builder** opens on your macro: *2 steps*, `createRect … name=Revenue` and `createRect … name=Costs`.
5. Press **▶ Run macro**.

### Check it

The message reads *Ran "Two lines" — Ctrl+Z undoes the whole run.* Two more rectangles appear, exactly where the first two are, on top of them: a recorded macro builds at the positions you recorded. Press **Ctrl+Z** once to take the whole run back.

### Good to know

- **To build next to the selection instead,** tick **Record positions relative to the selection** in the *Record a new macro* window (or **Relative positions** in the Macro Builder). The macro then builds beside what is selected, or in the middle of the view.
- **To work on whatever is selected when it runs,** tick **Refer to selected nodes as @sel** before recording.
- **Macros → Run Last Macro** runs the macro you ran last; it is greyed out until you have run one.
- **A button or keys for a macro:** tick **Show on Ribbon** in the Macro Builder to give it a button under **Macros → My Macros**, or give it keys in **View → Keyboard Shortcuts** (group *Macros*).
- **Undo while recording** takes back the steps recorded since the change it undoes, and only those.
- **⇩ Export** and **⇧ Import** in the Macro Builder share macros as a file.

---

<a id="macro-builder"></a>
## Lesson 4.2 — The Macro Builder: steps, variables and loops

> **Goal:** write a macro step by step, with a loop and a variable.
> **You need:** fmIDE.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Building a macro step by step* (`macro-steps`), *Variables, loops and expressions* (`macro-variables`)
> **Came in:** the first version; Run selected step moving on [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49); stepping through keeping the variables [#103](https://github.com/taroyamakatrmttm-star/fmIDE/pull/103)

**Macros → Macro Builder** shows your macros on the left, the chosen macro's steps as a tree in the middle, and the selected step's settings on the right.

| Button | Adds |
|---|---|
| **+ Action** | One fmIDE action, such as `createRect`, `connect`, `setValue`, `switchCanvas`. An action that makes something has a *Save result as* box (`$r1` for nodes, `$c1` for a canvas, `$t1` for Insert Template), so later steps can refer to it. |
| **+ Group** | A labelled folder to keep a long macro tidy; its steps run in order. |
| **+ Repeat** | Runs the steps inside it a number of times (`5`, or `$periods` for once per period). Its counter, `$i`, counts 1, 2, 3… |
| **+ For each** | Runs the steps inside it once for each node in a list (`@sel` unless you change it); `$item` is the node, `$itemIndex` counts. |
| **+ Set var** | Gives a variable a value: a number, an expression such as `100 + $i*80`, another variable, or text. |
| **+ Comment** | A note. It does nothing. |

### Steps

1. **+ New** makes a macro. Name it `Five lines`.
2. **+ Repeat**, and set **Times** to `5`.
3. With the Repeat selected, **+ Action**: it goes inside. Choose **Create Rectangle (createRect)**, and fill in **name** `Line ${i}`, **x** `100` and **y** `100 + $i*80`.
4. Press **▶ Run macro**.

### Check it

Five rectangles, *Line 1* to *Line 5*, in a column, at y = 180, 260, 340, 420 and 500.

### Good to know

- **Expressions** work in every number box: `+ - * / %`, brackets, variables, and `min`, `max`, `round`, `floor`, `ceil`, `abs`. In text, `${…}` puts in a variable or expression: `Year ${2024 + i}` gives *Year 2025*, *Year 2026*…
- **Always there:** `$periods`, the number of periods, and `$period`, the period you are viewing.
- **A list variable** takes a number in brackets, counted from 0: `$r1[0]` is the first item.
- **Moving steps:** **→** (Alt+→) moves a step into the group or loop above it, **←** (Alt+←) out again; **↑ ↓** move it; **⧉** duplicates; **⊘** switches it off without deleting it; **🗑** deletes it.
- **Trying one step:** **▶ Run selected step** runs just that step and selects the next, so pressing it again steps through the macro, keeping the variables as it goes.
- **⚠ on a step** means it reads a variable no step before it saves. Point it at one an earlier step saves.

---

<a id="reliable-macros"></a>
## Lesson 4.3 — Macros that keep working when the model changes

> **Goal:** write macros that still work in another model, or after you change this one.
> **You need:** a macro from [lesson 4.1](#recording-macros) or [4.2](#macro-builder).
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Referring to nodes, canvases and templates* (`macro-references`), *Macros that work every time* (`macro-reliable`), *When a macro stops* (`macro-errors`)
> **Came in:** [#102](https://github.com/taroyamakatrmttm-star/fmIDE/pull/102); stepping through keeping variables, and undo while recording [#103](https://github.com/taroyamakatrmttm-star/fmIDE/pull/103)

A macro runs in the model as it is when you run it, which may not be how it was when you recorded it. What a step names decides whether it still finds its target.

| A step can name | Written | Works in another model? |
|---|---|---|
| A rectangle by name | `Revenue` (capitals don't matter) | Yes, if the name is there once |
| A rectangle on another canvas | `Loans::Interest` | Yes |
| A node by id | `#n12` | No: ids belong to one model |
| The selection when the macro started | `@sel`, `@sel[0]` | Yes, if you select first |
| Every node on the canvas | `@all`, `@all[3]` (counted from 0) | Yes |
| What an earlier step made | `$r1`, `$c1`, `$t1[0]` | Yes, always |
| A canvas | `Loans`, `#c3`, `$c1` | By name or variable: yes |
| A template | `Name` (latest), `Name@3`, `Name@latest` | Yes |

### Steps

1. Select a rectangle and choose **Macros → Copy Reference**. It copies how a step refers to it: its name, or its id when the name is used twice. Paste it into a step's box.
2. Point at a canvas tab to see its id (such as `#c3`).
3. Record a macro that inserts a template and then goes to its canvas. Open it in the Macro Builder: the Insert step saves its result as `$t1`, and the Go to Canvas step uses `$t1`, not the canvas's name.

### Check it

The recorded Go to Canvas step reads `$t1` (or `$t1[0]`), so it finds the canvas the macro made even when another canvas has the same name.

### Good to know

- **⚠ notes from the recorder** mark a reference that may not hold: a node of this model referred to by its id, a node made while recording that no step saved, an automatic plug alias, a template's node referred to by its place, or a Paste whose Copy wasn't recorded. The recorder lists them when you stop.
- **"Stopped — nothing was changed"** means a step could not run, so fmIDE put the model back. The message names the step and why, and the Macro Builder marks it in red. The usual causes and fixes:

| The message says | Do this |
|---|---|
| More than one canvas is named "…" | Rename one, or use its id or the variable that made it. |
| 2 rectangles on "…" are named "…" | Rename one, or use its id (**Copy Reference**). |
| There is no canvas called "…" / no rectangle named "…" | It was renamed or deleted, or the macro is on another canvas than you expected. Record a Go to Canvas step first. |
| Nothing was selected when the macro started | Select the nodes, then run it again. |
| No step in this macro saves $t2 | The step that saved it was deleted or changed: point the step at a variable an earlier step saves. |

- **A recipe** inserted as `$t1` gives one canvas per part, in order (`$t1[1]` is always the second part), and skipping parts already here is recorded as a rule, so it holds when the macro runs.

---

<a id="scripting-fm"></a>
## Lesson 4.4 — Scripting fmIDE with `window.fm`

> **Goal:** build a model, change it and read its values from a script.
> **You need:** fmIDE in a desktop browser.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Macros* (`macros`), *Referring to nodes, canvases and templates* (`macro-references`)
> **Came in:** the first version, and step 7 · [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)

Every command is also an **action** of `window.fm` (`fm` for short). The full list, with each action's settings, is in [`docs/fmIDE-automation-api.md`](../fmIDE-automation-api.md). You can run actions:

- from the browser's **developer console** (F12, then the *Console* tab),
- from the **Command Launcher** (Ctrl+K): actions that take settings open a small form first, for example *Create Operator…* or *Connect…*,
- or **record** them in a macro (**Macros → Record Macro**) and edit them in the **Macro Builder**.

### Steps

1. In fmIDE, **File → New** (a script's `fm.clearAll()` clears the open model, so start from a document you don't mind losing).
2. Press F12 and open the *Console* tab.
3. Paste the script below and press Enter. It rebuilds lessons [3.5–3.7](03-reuse.md#first-function) (a function, on the canvas, then a new version) and the corkscrew of [lesson 2.5](02-building-models.md#timing-conditions) on a second canvas.

```js
fm.clearAll(); fm.setPeriodCount(4);

// Lessons 3.5–3.7: a function, on the canvas, then a new version
fm.saveFunction({ text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue' });   // "Margin@1"
fm.createRect({ x: 0, y: 0,   name: 'Revenue', value: '300' });
fm.createRect({ x: 0, y: 100, name: 'Cost',    value: '200' });
const f = fm.insertFunction({ function: 'Margin', x: 300, y: 40 });
fm.connect({ from: 'Revenue', to: '#' + f, toPort: 'Revenue' });   // an input by name…
fm.connect({ from: 'Cost',    to: '#' + f, toPort: 2 });           // …or by number, from 1
fm.createRect({ x: 550, y: 40, name: 'Margin %', value: '' });
fm.connect({ from: '#' + f, to: 'Margin %' });
console.log(fm.getValue('Margin %'));                               // 0.333…
fm.saveFunction({ text: 'Margin(Revenue, Cost) = ROUND((Revenue - Cost) / Revenue, 2)',
                  newVersionOf: 'Margin', note: 'rounded' });       // "Margin@2"
fm.updateFunctionNode({ node: '#' + f });                           // { version: 2, dropped: [] }
console.log(fm.getValue('Margin %'));                               // 0.33

// Lesson 2.5: the if corkscrew on its own canvas
fm.addCanvas('Debt');
const per = fm.createOperator({ x: 0, y: 0, op: 'period' });
fm.createRect({ x: 120, y: 0, name: 'Period', value: '' });
fm.connect({ from: '#' + per, to: 'Period' });
fm.createRect({ x: 120, y: 100, name: 'First', value: '1' });
const eq = fm.createOperator({ x: 350, y: 50, op: '=' });
fm.connect({ from: 'Period', to: '#' + eq });
fm.connect({ from: 'First',  to: '#' + eq });
fm.createRect({ x: 500, y: 50, name: 'Is first period', value: '' });
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
console.log([1, 2, 3, 4].map(p => fm.getValue('Closing', p)));     // [125, 150, 175, 200]
```

### Check it

The console prints **0.333…**, then **0.33**, then **[125, 150, 175, 200]**. The canvases *Canvas 1* and *Debt* hold the two models.

### How actions are written

| What | How |
|---|---|
| Settings | One object: `fm.createRect({ name: 'Price', value: '10', uom: '$/t' })`. Settings left out take their default. |
| A rectangle | By its name on the canvas shown, `'Revenue'`, or by its id, `'#n12'`. |
| A new box's id | Actions that make something return its id: `const f = fm.insertFunction(…)`, then `'#' + f`. |
| Another canvas | `fm.switchCanvas('Debt')` first; `getValue` reads the canvas shown. |
| A named input | `toPort`: its name (`'condition'`, `'value'`, a function's input name) or its number from 1. |
| A function | `'Margin'` (the latest), `'Margin@latest'`, `'Margin@2'`. |
| Values per period | `fm.setPeriodValues({ node: 'Price', values: '10, 12, 15' })`. |
| A failure | An action that can't do what it is asked stops with a message in words, such as *There is no rectangle named "Net income"*. |

### Good to know

- **Function actions**: `listFunctions` (`{ of: 'model' }` for the model's own copies), `getFunction`, `setFunctionInfo`, `deleteFunction`, `importFunctions`, `exportFunctions`, `changeFunction`, `updateFunctionUses`, `skipFunctionUpdate`, `addFunctionDefinition`. `fm.nodes()` lists the boxes on the canvas; a function box's `fn` names its function and version.
- **Nothing a file contains is run as program code.** A macro is a list of these actions, carried out step by step; text from someone else's file is never run.

---

<a id="scripting-fmgraph"></a>
## Lesson 4.5 — Scripting fmGraph with `window.fmGraph`

> **Goal:** set up a board and read its numbers from a script.
> **You need:** fmGraph in a desktop browser, with the Profit model of [lesson 6.6](06-fmgraph.md#tornado-spider) open (Price `10` × Quantity `30` = Revenue; Revenue − Costs `200` = Profit).
> **Time:** about 5 minutes.
> **In the app:** fmGraph Help → *What fmGraph is* (`what-is-fmgraph`)
> **Came in:** step 15 G1 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)); charts and boards (G2, G3); Tornado and Spider [#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146); goal seek [#187](https://github.com/taroyamakatrmttm-star/fmIDE/pull/187)

`window.fmGraph` does from a script what you do on a board. It never changes the model, exactly like a slider. The full list of what it offers is at the top of `src/fmgraph/js/08-api.js`.

### Steps

1. In fmGraph, press F12 and open the *Console* tab.
2. Paste and run:

```js
const s = fmGraph.addSlider('Price', { periods: 'all', mode: 'set' });
fmGraph.addBar('Profit');
fmGraph.setSlider(s, 8);
console.log(fmGraph.value('Profit', 1));            // 40: the board's number now
console.log(fmGraph.modelValue('Profit', 1));       // 100: the model's own number
const t = fmGraph.addChart({ layout: 'tornado', output: 'Profit', period: 1 });
console.log(fmGraph.chart(t).inputs.map(i => i.name + ' ' + Math.round(i.swing)));
fmGraph.resetSlider(s);
```

### Check it

The console prints **40**, **100**, and the Tornado's inputs with their swings around Price 8: *Price 48*, *Quantity 48*, *Costs 40*. The board shows the slider, the bar and the chart; after the last line the slider is back at the model's number.

### Good to know

| Call | Does |
|---|---|
| `rectangles()` | Every rectangle, with its canvas and whether it is an input |
| `value(rect, period)`, `modelValue(rect, period)` | The number shown now, and the model's own |
| `addBar`, `addSlider`, `addChart({ layout, … })` | Add to the board shown; each returns an id. A chart's `layout` is `'columns'`, `'lines'`, `'flow'`, `'scenarios'`, `'tornado'` or `'spider'`. |
| `setSlider(id, value)`, `resetSlider(id)`, `resetAll()` | Move sliders |
| `chart(id)` | What a chart shows now, as numbers |
| `goalSeek({ rect, period, target, slider })` | The slider value that makes a rectangle hit a number ([lesson 6.7](06-fmgraph.md#goal-seek)) |
| `boards()`, `addBoard`, `showBoard`, `exportBoards`, `importBoards` | Boards and board files |

A rectangle is named as in fmIDE: by its name, or `'#id'`; periods count from 1.

---

[← Part 3](03-reuse.md) · [Contents](README.md) · [Part 5 →](05-excelexporter.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
