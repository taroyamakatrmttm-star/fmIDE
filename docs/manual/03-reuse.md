# Part 3 — Reusing your work: templates, recipes, functions and the library

[← Part 2](02-building-models.md) · [Contents](README.md) · [Part 4 →](04-macros-scripting.md)

Build something once and use it again: a canvas as a template, several templates as a recipe, a formula as your own function, and all of them shared with other people through library packs and the community library. After this part you can keep your own toolkit of building blocks and share it.

The numbers in this part were checked against the apps on `main` at pull request #193 (19 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| 3.1 Templates *(to come)* | Save a canvas as a template, insert it, search the Templates window | foundations, [#12](https://github.com/taroyamakatrmttm-star/fmIDE/pull/12), [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50), [#99](https://github.com/taroyamakatrmttm-star/fmIDE/pull/99) |
| 3.2 Template versions, and updating a canvas *(to come)* | Families and versions, linked canvases, Update this canvas | step 6 ([#19](https://github.com/taroyamakatrmttm-star/fmIDE/pull/19), [#20](https://github.com/taroyamakatrmttm-star/fmIDE/pull/20)) |
| 3.3 System templates, and keeping your templates tidy *(to come)* | Whole-model templates, Remove duplicates, removing old versions | [#15](https://github.com/taroyamakatrmttm-star/fmIDE/pull/15)–[#17](https://github.com/taroyamakatrmttm-star/fmIDE/pull/17), [#105](https://github.com/taroyamakatrmttm-star/fmIDE/pull/105), [#106](https://github.com/taroyamakatrmttm-star/fmIDE/pull/106) |
| 3.4 Recipes *(to come)* | Templates built together, recipes within recipes | step 6 ([#21](https://github.com/taroyamakatrmttm-star/fmIDE/pull/21)), [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54), [#101](https://github.com/taroyamakatrmttm-star/fmIDE/pull/101) |
| [3.5 Your first function](#first-function) | Write a function; what a formula may contain | step 7 D1, D2a ([#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26), [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27)) |
| [3.6 A function on the canvas](#function-on-canvas) | Insert it, wire its inputs by name | step 7 D2b ([#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28)) |
| [3.7 Function versions and updating](#function-versions) | Edit as new version, ⬆, Update every use | [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28) |
| [3.8 Functions that call functions](#functions-calling-functions) | A call tied to one version | [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#32](https://github.com/taroyamakatrmttm-star/fmIDE/pull/32) |
| [3.9 Sharing functions](#sharing-functions) | Files carry their functions; copy and paste; export and import | [#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26)–[#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28) |
| 3.10 Library packs *(to come)* | Templates, recipes and functions in one file; where items came from | step 8a, 8b ([#36](https://github.com/taroyamakatrmttm-star/fmIDE/pull/36), [#37](https://github.com/taroyamakatrmttm-star/fmIDE/pull/37)), [#189](https://github.com/taroyamakatrmttm-star/fmIDE/pull/189) |
| 3.11 Browsing the community library *(to come)* | Browse Library…, Try in fmGraph | step 8c, 8d ([#41](https://github.com/taroyamakatrmttm-star/fmIDE/pull/41), [#42](https://github.com/taroyamakatrmttm-star/fmIDE/pull/42)), [#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92) |
| 3.12 Sharing your pack with everyone *(to come)* | Share in the Community Library…, sharing again | [#107](https://github.com/taroyamakatrmttm-star/fmIDE/pull/107), [#193](https://github.com/taroyamakatrmttm-star/fmIDE/pull/193) |

Until the lessons marked *(to come)* are written, fmIDE's Help covers them, and the tutorial *Templates: save a canvas and reuse it* walks through 3.1 inside the app.

---

<a id="first-function"></a>
## Lesson 3.5 — Your first function

> **Goal:** write a formula once, as your own function, so you can use it like an operator anywhere.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Your own functions* (`functions`) · Tutorial *Your own functions* (`functions`)
> **Came in:** step 7, phases D1 and D2a · [#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26), [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27)

A **function** is a formula with a name and inputs, for example `Margin(Revenue, Cost) = (Revenue - Cost) / Revenue`. It lives in your **function library**, and travels inside every file whose model uses it. A function is only ever read as a formula, never run as a program, so functions from other people are safe to open.

### Steps

1. **File → Functions** (in the *Library* group; also **Insert → My Functions → Functions**). The Functions window opens.
2. Click **+ New Function…**.
3. Type the whole definition on one line:
   ```
   Margin(Revenue, Cost) = (Revenue - Cost) / Revenue
   ```
   As you type, the editor shows the function's name (*Margin*) and its inputs (*Revenue, Cost*).
4. Try a mistake on purpose: delete the last `)` of `(Revenue - Cost)`. The editor points to where the problem is and keeps **Save** off. Put the bracket back.
5. Add a description, such as *Gross margin as a fraction of revenue*, and click **Save**.

### Check it

*Margin* appears in the list as version **v1**.

### What a formula can contain

| | |
|---|---|
| Inputs | By name. Capitals don't matter: `revenue` is `Revenue`. |
| Numbers and arithmetic | `+ - * / ^` (also `− × ÷`), brackets, a leading minus. Excel's order of operations: `-2^2` is 4. |
| One comparison | `<`, `<=`, `>`, `>=`, `=`, `<>` (or `≠`). It gives 1 or 0. |
| Built-in functions | `MIN`, `MAX`, `AVERAGE`, `ABS`, `MOD`, `IFERROR`, `IF`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `PERIOD()`, `LN`, `EXP`, `SQRT`, `INT`, `TRUNC`, `CHOOSE` |
| Your other functions | `Margin(Revenue, Cost)`: see [lesson 3.8](#functions-calling-functions). |
| Not accepted (the editor says why) | Chains such as `a < b < c`; `%`; text in quotes; Excel functions kept back for later, such as `SUM`, `PRODUCT`, `LOG`, `INDEX` and `SUMPRODUCT`. |
| Limits | 4,000 characters; 32 inputs; 64 levels of brackets; calls nested 16 deep. |

The full grammar is in [`docs/file-formats.md`](../file-formats.md), section *Functions*.

### Good to know

- **Deleting.** Select a function and click **🗑 Delete**. If the open model uses it, fmIDE warns you but lets you: the model keeps its own copy and still calculates. Older versions are deleted one at a time; the latest only together with the whole function.
- **A name can't be an Excel function's name**, such as `SUM`: the editor asks for another.

### From a script

```js
fm.saveFunction({ text: 'Margin(Revenue, Cost) = (Revenue - Cost) / Revenue' });   // "Margin@1"
```

---

<a id="function-on-canvas"></a>
## Lesson 3.6 — A function on the canvas

> **Goal:** use your function in a model and wire its inputs.
> **You need:** fmIDE, and the *Margin* function from [lesson 3.5](#first-function).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Using a function on the canvas* (`function-nodes`), *Drawing arrows* (`arrows`)
> **Came in:** step 7, phase D2b · [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28)

### Steps

1. Add two rectangles: **Revenue** = `300` and **Cost** = `200`.
2. **Home → Insert Function…** (also **Insert → My Functions → Insert Function…**, or **ƒ Insert v1** in the Functions window). Search for *Margin* and pick it.
3. A teal box appears, titled **ƒ Margin v1**, with an input dot for *Revenue* and one for *Cost* on its left, and its result on its right.
4. Draw an arrow from Revenue and drop it on the box's *Revenue* dot. Press **Evaluate** (F9). The box shows **"?"**: point at it to read why (one of its inputs has no arrow).
5. Draw an arrow from Cost and drop it on the box itself, not on a dot. It goes into the first empty input, *Cost*.
6. Add a rectangle **Margin %**, and draw an arrow from the box's result to it.
7. Press **Evaluate**.
8. Double-click the box to see its definition.

### Check it

Margin % shows **0.333…** (100 ÷ 300).

### Good to know

- **The model carries its own copy** of Margin v1, so it calculates the same on anyone's computer. Deleting the last Margin box takes that copy out of the model (Undo brings it back).
- **In Excel**, ExcelExporter writes the function out in full in each cell: see [lesson 5.5](05-excelexporter.md#functions-in-excel).

### From a script

```js
fm.createRect({ x: 0, y: 0,   name: 'Revenue', value: '300' });
fm.createRect({ x: 0, y: 100, name: 'Cost',    value: '200' });
const f = fm.insertFunction({ function: 'Margin', x: 300, y: 40 });
fm.connect({ from: 'Revenue', to: '#' + f, toPort: 'Revenue' });   // an input by name…
fm.connect({ from: 'Cost',    to: '#' + f, toPort: 2 });           // …or by number, from 1
fm.createRect({ x: 550, y: 40, name: 'Margin %', value: '' });
fm.connect({ from: '#' + f, to: 'Margin %' });
fm.getValue('Margin %');                                            // 0.333…
```

---

<a id="function-versions"></a>
## Lesson 3.7 — Function versions and updating

> **Goal:** change a function without breaking the models that use it, then update them when you choose.
> **You need:** fmIDE, and the model from [lesson 3.6](#function-on-canvas).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Your own functions* (`functions`), *Using a function on the canvas* (`function-nodes`)
> **Came in:** step 7, phases D2a and D2b · [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28)

Functions have versions, as templates do. Saving a change makes a new version; models keep the version they use until you update them.

### Steps

1. **File → Functions**, select *Margin*, and click **Edit as new version…**.
2. Change the formula to round the result:
   ```
   Margin(Revenue, Cost) = ROUND((Revenue - Cost) / Revenue, 2)
   ```
   Write a short note, such as *rounded to 2 decimals*, and **Save**. Margin is now **v2**; v1 is kept, marked as an older version.
3. Back on the canvas, the Margin box shows **⬆**. Click it (or the box's **⋯**). The menu offers:
   - **⬆ Update to v2**: this box only.
   - **Not now**: the ⬆ goes away until an even newer version exists. The choice is kept in the file.
   - **Update every use…**: a window listing every box of this function on every canvas, with the arrows each would lose. Boxes you said *Not now* to start unticked. One Undo reverses the lot.
   - **Change function or version…**: swap this box for another function, or an older version.
   - **Show definition**.
4. Choose **⬆ Update to v2**, then press **Evaluate**.

### Check it

Margin % shows **0.33**.

### Good to know

- **Arrows follow inputs by name.** If a new version renames or removes an input, the arrow into it is dropped. fmIDE lists what would be dropped and asks first.
- **Insert → My Functions → Update Function…** does the same for the selected box, or lets you pick a function that has a newer version.

### From a script

```js
fm.saveFunction({ text: 'Margin(Revenue, Cost) = ROUND((Revenue - Cost) / Revenue, 2)',
                  newVersionOf: 'Margin', note: 'rounded' });     // "Margin@2"
fm.updateFunctionNode({ node: '#' + f });                         // { version: 2, dropped: [] }
fm.getValue('Margin %');                                          // 0.33
```

---

<a id="functions-calling-functions"></a>
## Lesson 3.8 — Functions that call functions

> **Goal:** build a function from another one.
> **You need:** fmIDE, and the *Margin* function.
> **Time:** about 3 minutes.
> **In the app:** fmIDE Help → *Your own functions* (`functions`)
> **Came in:** step 7, phase D2a · [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#32](https://github.com/taroyamakatrmttm-star/fmIDE/pull/32)

### Steps

1. **File → Functions → + New Function…**, and type:
   ```
   MarginPct(Revenue, Cost) = Margin(Revenue, Cost) * 100
   ```
2. The editor shows that the call to *Margin* is tied to **one version**: the latest when you save. **Save**.

### Check it

Insert *MarginPct* on the canvas of lesson 3.6, wire Revenue and Cost into it and draw it into a new rectangle: it shows **33** (with Margin v2).

### Good to know

- **A call stays on its version.** A later version of Margin doesn't change MarginPct until you save a new version of MarginPct. Meanwhile the Functions window marks it **⚠ calls an older version**.
- **Two functions with the same name** (possible after importing someone else's): the editor asks which one you mean and keeps Save off until you choose.
- A function can't call itself. Calls can nest at most 16 deep, and a deep nest is quick: the same call inside one formula is worked out once ([#32](https://github.com/taroyamakatrmttm-star/fmIDE/pull/32)).

---

<a id="sharing-functions"></a>
## Lesson 3.9 — Sharing functions

> **Goal:** give your functions to someone else, and take theirs.
> **You need:** fmIDE, and a function in your library.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Your own functions* (`functions`), *Library packs* (`library-packs`)
> **Came in:** step 7, phases D1–D2b · [#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26), [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28)

There are four ways. You rarely need to think about the first two: they happen by themselves.

| Way | How | What happens |
|---|---|---|
| **In the file** | Save the document (or a system, module, workspace or template) | Every function the model uses, and those they call, goes inside. Opening the file adds them to the reader's library. |
| **Copy and paste** | Copy function boxes and paste them, even into another document | Their definitions come along and join the library. |
| **Export and Import** | Functions window → **⇩ Export Functions** (tick which), and **⇧ Import Functions** to read the file | A file of kind `fmIDE-functions`. |
| **Library packs** | **File → Save as Library Pack…** | Functions together with templates and recipes, to share with everyone (lesson 3.10, *to come*). |

### Steps

1. **File → Functions → ⇩ Export Functions**. Tick *Margin* and *MarginPct*, and save the file.
2. Send it, or keep it. To bring it in on another computer: **File → Functions → ⇧ Import Functions**, and pick the file.

### Check it

The functions appear in the list, with their versions.

### Good to know

- **Importing never replaces your functions.** A version you already have is skipped. A *different* version under a number you already use is added under the next free number.
- **Clashes inside a model.** Pasting boxes (or bringing in a module, system or template) whose function has a different version under a number the model already uses renumbers the incoming one, and the pasted boxes follow it. **Insert Function…** instead refuses, and tells you to update the existing boxes first.
- **From a script:** `fm.exportFunctions`, `fm.importFunctions`, `fm.listFunctions` (`{ of: 'model' }` for the model's own copies), `fm.getFunction`, `fm.setFunctionInfo`, `fm.deleteFunction`. Functions are named as `Margin` (the latest), `Margin@latest` or `Margin@2`. See [lesson 4.4](04-macros-scripting.md#scripting-fm).

---

[← Part 2](02-building-models.md) · [Contents](README.md) · [Part 4 →](04-macros-scripting.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
