# Part 3 — Reusing your work: templates, recipes, functions and the library

[← Part 2](02-building-models.md) · [Contents](README.md) · [Part 4 →](04-macros-scripting.md)

Build something once and use it again: a canvas as a template, several templates as a recipe, a formula as your own function, and all of them shared with other people through library packs and the community library. After this part you can keep your own toolkit of building blocks and share it.

The numbers in this part were checked against the apps on `main` at pull request #196 (21 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [3.1 Templates](#templates) | Save a canvas as a template, insert it, search the Templates window | foundations, [#12](https://github.com/taroyamakatrmttm-star/fmIDE/pull/12), [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50), [#99](https://github.com/taroyamakatrmttm-star/fmIDE/pull/99) |
| [3.2 Template versions, and updating a canvas](#template-versions) | Families and versions, linked canvases, Update this canvas | step 6 ([#19](https://github.com/taroyamakatrmttm-star/fmIDE/pull/19), [#20](https://github.com/taroyamakatrmttm-star/fmIDE/pull/20)) |
| [3.3 System templates, and keeping your templates tidy](#system-templates) | Whole-model templates, Remove duplicates, removing old versions | [#15](https://github.com/taroyamakatrmttm-star/fmIDE/pull/15)–[#17](https://github.com/taroyamakatrmttm-star/fmIDE/pull/17), [#105](https://github.com/taroyamakatrmttm-star/fmIDE/pull/105), [#106](https://github.com/taroyamakatrmttm-star/fmIDE/pull/106) |
| [3.4 Recipes](#recipes) | Templates built together, recipes within recipes | step 6 ([#21](https://github.com/taroyamakatrmttm-star/fmIDE/pull/21)), [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54), [#101](https://github.com/taroyamakatrmttm-star/fmIDE/pull/101) |
| [3.5 Your first function](#first-function) | Write a function; what a formula may contain | step 7 D1, D2a ([#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26), [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27)) |
| [3.6 A function on the canvas](#function-on-canvas) | Insert it, wire its inputs by name | step 7 D2b ([#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28)) |
| [3.7 Function versions and updating](#function-versions) | Edit as new version, ⬆, Update every use | [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28) |
| [3.8 Functions that call functions](#functions-calling-functions) | A call tied to one version | [#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#32](https://github.com/taroyamakatrmttm-star/fmIDE/pull/32) |
| [3.9 Sharing functions](#sharing-functions) | Files carry their functions; copy and paste; export and import | [#26](https://github.com/taroyamakatrmttm-star/fmIDE/pull/26)–[#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28) |
| [3.10 Library packs](#library-packs) | Templates, recipes and functions in one file; where items came from | step 8a, 8b ([#36](https://github.com/taroyamakatrmttm-star/fmIDE/pull/36), [#37](https://github.com/taroyamakatrmttm-star/fmIDE/pull/37)), [#189](https://github.com/taroyamakatrmttm-star/fmIDE/pull/189) |
| [3.11 Browsing the community library](#browse-library) | Browse Library…, Try in fmGraph | step 8c, 8d ([#41](https://github.com/taroyamakatrmttm-star/fmIDE/pull/41), [#42](https://github.com/taroyamakatrmttm-star/fmIDE/pull/42)), [#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92) |
| [3.12 Sharing your pack with everyone](#share-library) | Share in the Community Library…, sharing again | [#107](https://github.com/taroyamakatrmttm-star/fmIDE/pull/107), [#193](https://github.com/taroyamakatrmttm-star/fmIDE/pull/193) |


---

<a id="templates"></a>
## Lesson 3.1 — Templates: save a canvas and use it again

> **Goal:** save a canvas as a template, and add it again in one click.
> **You need:** the model of [lesson 2.1](02-building-models.md#first-model) (Price × Quantity = Revenue) on a canvas named **Revenue**.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Templates* (`templates`) · Tutorial *Templates: save a canvas and reuse it* (`templates`)
> **Came in:** the first version; search [#12](https://github.com/taroyamakatrmttm-star/fmIDE/pull/12); the list as a tree [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50); Expand all and Collapse all [#99](https://github.com/taroyamakatrmttm-star/fmIDE/pull/99)

### Steps

1. **File → Templates** (the *Library* group; also **Insert → Templates**). The **Templates** window opens.
2. Press **+ Save Canvas as Template**. The form *Save this canvas as a Template* has **Name** (the canvas's name, *Revenue*), **Description**, **Group** and **Change note**. Press **Save Template**.
3. *Revenue* is now in the list, under **My Templates**, marked **MODULE v1**. Select it: the right side shows what it holds (Price, Quantity, ×, Revenue).
4. Press **Add to new canvas**.
5. A new canvas appears, also called *Revenue*. Double-click its tab and rename it `Region North`.

### Check it

Region North shows **Revenue = 50**: the same calculation, ready to change. The canvas remembers which template it came from ([lesson 3.2](#template-versions)).

### Good to know

- **Add to current canvas** puts the template's boxes on the canvas you are on, instead of a new one.
- **Find a template** by typing part of its name in the search box, then Enter to add it. The list is a tree of groups: click a group to open or close it; **▾ Expand all** and **▸ Collapse all** do every group.
- **✎ Edit info** changes a template's name, description and group; **🗑 Delete** removes it.
- **Templates travel inside your documents,** so a colleague who opens your `.fmide` gets them too. **⇩ Export Templates** and **⇧ Import Templates** move them as a file of their own.
- **A template can carry an Excel layout and an fmGraph board** (📎 Attach Excel layout…, 📈 Attach fmGraph board…): see [lesson 5.9](05-excelexporter.md#layouts) and [lesson 6.8](06-fmgraph.md#boards-templates).

---

<a id="template-versions"></a>
## Lesson 3.2 — Template versions, and updating a canvas

> **Goal:** improve a template, and bring the canvases made from it up to date.
> **You need:** the template *Revenue* and the canvas *Region North* from [lesson 3.1](#templates).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Template versions and updating a canvas* (`template-versions`)
> **Came in:** step 6 · families and versions [#19](https://github.com/taroyamakatrmttm-star/fmIDE/pull/19); canvases that remember their template [#20](https://github.com/taroyamakatrmttm-star/fmIDE/pull/20)

### Steps

1. Go to the **Revenue** canvas (the one you saved). Add a tax line: **Tax rate** = `0.1`, a **×** fed by Revenue and Tax rate, into a rectangle **Tax**. Change Quantity there to `8`.
2. **File → Templates**, select *Revenue*, press **⤴ Save as new version**. The form says *Save the open canvas as version 2 of "Revenue"*; write a **Change note**, such as *adds tax*, and press **Save version 2**.
3. Go to **Region North**. Its tab shows **⬆**, and a bar above the canvas reads *This canvas came from "Revenue" v1. Version 2 is available.*
4. Press **Update this canvas…**. The window lists *Input values kept: Price, Quantity (2)* and says everything else is replaced by the new version. Press **Update**.

### Check it

Region North now has the tax line: **Tax = 5**. Its own Quantity, 5, was kept, so Revenue is still 50 (the 8 you typed on the Revenue canvas stays there).

### Good to know

- **Input values are kept by name:** what you typed into the canvas's inputs survives an update. Everything else comes from the new version. One **Undo** takes the update back.
- **Not now** hides the bar until an even newer version appears.
- **Insert → Update Canvas from Template…** can go to any version, older ones too. **Insert → Unlink Canvas from Template** makes a canvas forget its template.
- **A template's versions** are listed under it (*▸ 1 older version*). Old versions stay unless you remove them ([lesson 3.3](#system-templates)).

### From a script

```js
fm.updateCanvasFromTemplate({ canvas: 'Region North', version: 'latest' });
```

---

<a id="system-templates"></a>
## Lesson 3.3 — System templates, and keeping your templates tidy

> **Goal:** save a whole model as a template, and keep your list of templates clean.
> **You need:** a model with a few canvases.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Templates* (`templates`), *Template versions and updating a canvas* (`template-versions`)
> **Came in:** removing duplicates [#15](https://github.com/taroyamakatrmttm-star/fmIDE/pull/15)–[#17](https://github.com/taroyamakatrmttm-star/fmIDE/pull/17); system templates keeping their canvases' links [#105](https://github.com/taroyamakatrmttm-star/fmIDE/pull/105); removing old versions [#106](https://github.com/taroyamakatrmttm-star/fmIDE/pull/106)

### Steps

1. **File → Templates → + Save System as Template**. Name it `Starter model` and press **Save Template**. It is marked **SYSTEM**.
2. Select it. It lists its canvases, and offers **Add System** (its canvases alongside yours) and **Replace System** (it replaces the model).
3. Select a canvas template with several versions and press **🧹 Remove old versions** beside its name. Every version but the latest goes.

### Check it

The list shows one version of that template. If a version was still in use, the question named it and kept it.

### Good to know

- **Canvases made from canvas templates stay linked** inside a system template: added back, they still offer their template's updates, and ExcelExporter still lays them out as modules.
- **What is never removed:** the latest version (so version numbers are never reused), and any version still in use — by a canvas in the open model, by a system template's canvas, or by a recipe pinned to it.
- **🧹 Remove older versions** under the list (or **Remove Older Versions of All Templates…**) does every template at once.
- **🧹 Remove duplicates…** tidies copies that built up over time: choose what must match and which copy to keep. **🗑 Clear all templates** empties the list, after asking.

---

<a id="recipes"></a>
## Lesson 3.4 — Recipes: templates made of templates

> **Goal:** build several canvases in one go, already connected.
> **You need:** two canvas templates that connect by a plug and a socket. The example: **Sales** (Units `100` × Price `2` = Revenue, with a plug named `Revenue`) and **Profit** (a `+` with the socket `Revenue` into *Sales revenue*; *Costs* = Sales revenue × Cost ratio `0.6`; *Profit* = Sales revenue − Costs). Save each with **+ Save Canvas as Template** ([lesson 3.1](#templates)).
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Recipes* (`recipes`), *Plugs and sockets* (`plugs-sockets`)
> **Came in:** step 6 ([#21](https://github.com/taroyamakatrmttm-star/fmIDE/pull/21)); skipping parts already built [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54); recipes within a recipe [#101](https://github.com/taroyamakatrmttm-star/fmIDE/pull/101)

A **recipe** lists canvas templates to build together, such as an income statement, a balance sheet and a cash flow. Plugs and sockets ([lesson 2.8](02-building-models.md#plugs-sockets)) connect the canvases it builds by name.

### Steps

1. **File → New**. **File → Templates → + New Recipe…**. The *New recipe* form has **Name**, **Group**, **Description**, **Change note** and **Parts**. Name it `Small P&L`. Press **+ Add part** and choose **Sales**, then again for **Profit**: parts are built in this order, and each follows the template's latest version unless you pick a fixed one. Press **Save Recipe**.
2. Select *Small P&L* (marked **RECIPE**). The right side lists its parts, *✓ Sales @latest (v1)* and *✓ Profit @latest (v1)*, and says *Every socket is fed by a plug in these parts.*
3. Press **Build (add canvases)**.
4. Go to the **Profit** canvas and press **Evaluate**.

### Check it

Two canvases, **Sales** and **Profit**, and Profit shows **80** (Costs 120 = 200 × 0.6; Profit = 200 − 120). The Revenue from Sales reaches Profit through the plug.

### Good to know

- **A part already in the model** is offered as *Skip — already here as canvas "…"*, ticked: building then uses that canvas. Untick it to add another copy on purpose.
- **Sockets nothing feeds** are listed when you build, so you can see what is missing. Several plugs into one socket are listed too.
- **A part can be another recipe:** it builds in its place, with its own parts, so a full model can be made from smaller recipes. A recipe can't contain itself.
- **Edit as new version…** changes a recipe's parts as its next version.

### From a script

```js
fm.saveRecipe({ name: 'Small P&L', parts: ['Sales', 'Profit'] });
const made = fm.insertTemplate({ template: 'Small P&L', mode: 'add' });   // { parts: [canvas ids], unfedSockets: [], … }
```

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
| **Library packs** | **File → Save as Library Pack…** | Functions together with templates and recipes, to share with everyone ([lesson 3.10](#library-packs)). |

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

<a id="library-packs"></a>
## Lesson 3.10 — Library packs: templates, recipes and functions in one file

> **Goal:** give someone a set of templates, recipes and functions as one file, and open one you were given.
> **You need:** the templates and recipe of [lesson 3.4](#recipes).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Library packs* (`library-packs`)
> **Came in:** step 8a ([#36](https://github.com/taroyamakatrmttm-star/fmIDE/pull/36)); where items came from, 8b ([#37](https://github.com/taroyamakatrmttm-star/fmIDE/pull/37)); a readable file name [#189](https://github.com/taroyamakatrmttm-star/fmIDE/pull/189)

### Steps

1. **File → Save as Library Pack…** (the *Library* group).
2. Give it a **title** (`Small P&L kit`), your name as the **author** (use the same name every time), a short **description** and a few **tags**.
3. Under **Templates and recipes**, tick the recipe *Small P&L (recipe, v1)*. What it needs comes along: a recipe's parts (and the functions a function calls). Each goes in as its latest version. Press **Save Pack**.
4. On another computer (or after **File → New**), **File → Open Library Pack…** and pick the file. A preview shows who made the pack and, for each item, whether it is new or already in your library. Untick what you don't want, and add.

### Check it

The file in your Downloads folder is named after the title with the start of the pack's id in brackets, such as `Small P&L kit (9a8d7845).fmide-pack.json`. Its preview lists **Small P&L**, **Sales** and **Profit**, each marked *New*.

### Good to know

- **Share only what is yours.** Everything in a pack is shared under the CC BY 4.0 licence: anyone may use and change it, with credit to you.
- **Nothing of yours is replaced.** An item you already have is skipped; a different version under a number you use is added under the next number.
- **Items remember where they came from:** the pack and its author go with them.
- **You may rename the file,** as long as it still ends in `.fmide-pack.json`.

### From a script

```js
fm.saveLibraryPack({ title: 'Small P&L kit', author: 'Your name', templates: ['Small P&L'] });
fm.previewLibraryPack({ file: packData }).items;   // [{ name: 'Small P&L', status: 'new' }, …]
```

---

<a id="browse-library"></a>
## Lesson 3.11 — Browsing the community library

> **Goal:** find templates other people shared, try them, and add them.
> **You need:** fmIDE on its website ([fmide.pages.dev](https://fmide.pages.dev)), with an internet connection.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Browsing the library* (`browse-library`)
> **Came in:** step 8 · the catalogue [#41](https://github.com/taroyamakatrmttm-star/fmIDE/pull/41); Browse Library [#42](https://github.com/taroyamakatrmttm-star/fmIDE/pull/42); Try in fmGraph [#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92)

### Steps

1. **File → Browse Library…**. The community's packs are listed, with a search box and filters.
2. Pick a pack and press **Preview and add…**. The usual pack preview opens ([lesson 3.10](#library-packs)) before anything is added.
3. A template that carries an fmGraph board has **📈 Try in fmGraph**: fmGraph opens the template with its board, so you can move its sliders first. **Show fmIDE's model** there goes back to your own.

### Check it

The templates you added are in **File → Templates**, with the pack's author shown as where they came from.

### Good to know

- **Trying changes nothing:** nothing is added to your library or document, and fmGraph keeps nothing.
- **Offline, or from a file,** fmIDE never connects to anything: download packs from [fmide.pages.dev/library](https://fmide.pages.dev/library/) instead and open them with **Open Library Pack…**.
- **On the website,** fmIDE reads only its own site's `/library`, and only when you ask. Nothing is ever sent.

---

<a id="share-library"></a>
## Lesson 3.12 — Sharing your pack with everyone

> **Goal:** put your templates in the community library, so anyone can add them.
> **You need:** a pack file ([lesson 3.10](#library-packs)), an internet connection and an email address. No GitHub experience is needed.
> **Time:** about 15 minutes the first time, mostly making an account.
> **In the app:** fmIDE Help → *Share your pack in the community library* (`share-library-pack`)
> **Came in:** the guided window and steps [#107](https://github.com/taroyamakatrmttm-star/fmIDE/pull/107); sharing again [#193](https://github.com/taroyamakatrmttm-star/fmIDE/pull/193)

The community library lives on GitHub, a free website where people share files. fmIDE never sends anything itself: you upload the pack in your web browser, and a person reviews every pack.

### Steps

1. **Save your pack** with **File → Save as Library Pack…** ([lesson 3.10](#library-packs)). A window opens with the next steps; **File → Share in the Community Library…** opens it again any time.
2. **Make a free GitHub account** (the first time only): on github.com choose **Sign up**, and follow the steps. GitHub emails you a code to check your address.
3. **Upload the pack.** In the window, press **Open the upload page ↗**. Sign in if asked. If GitHub says you need your own copy (a "fork"), press **Fork this repository**, then open the upload page again. Drag your pack file onto the page, wait for its name to appear, and press **Propose changes**.
4. **Send it for review.** On *Comparing changes*, press **Create pull request** (GitHub's name for "please add my file"), then **Create pull request** again at the bottom of the form. Read the *Submission terms* and tick **I have read the submission terms**.
5. **Wait for the check.** Within a few minutes a comment called *Library check* appears. It should say **PASSED ✅**. If it lists a problem, write a comment asking for help, or save and upload the pack again.
6. **See it in the library.** Once accepted, your pack appears in **Browse Library…** and on the `/library` pages within about an hour. GitHub emails you when it is accepted, or if there is a question.

### Check it

Your pack is listed in **File → Browse Library…** on the website, with you as its author.

### Good to know

- **A pack is never changed once it is in the library.** For an improved version, save it with **⤴ Save as new version**, save a new pack, and upload it the same way.
- **Only the account that first shared a template or function** can add new versions of it, so nobody else can publish a "new version" of yours.
- **Sharing a version again** in a new pack is allowed: as a part a recipe needs, or with an Excel layout or fmGraph board you attached since. Items of a pack you took down yourself may be shared again by you; nobody else can.
- **An fmGraph board** shares with its template: attach it to the template first ([lesson 6.8](06-fmgraph.md#boards-templates)).

---

[← Part 2](02-building-models.md) · [Contents](README.md) · [Part 4 →](04-macros-scripting.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
