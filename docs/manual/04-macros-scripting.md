# Part 4 — Macros and scripting

[← Part 3](03-reuse.md) · [Contents](README.md) · [Part 5 →](05-excelexporter.md)

Let fmIDE do repetitive work for you: record what you do as a macro and play it back, or write the steps yourself. Everything you can do with the ribbon is also an action you can call from a macro or a script. After this part you can build a model from a script and check its numbers.

The numbers in this part were checked against the apps on `main` at pull request #193 (19 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| 4.1 Recording and running a macro *(to come)* | Record Macro, Run Last Macro, My Macros on the ribbon | foundations |
| 4.2 The Macro Builder *(to come)* | Steps, variables, loops, stepping through | foundations, [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#103](https://github.com/taroyamakatrmttm-star/fmIDE/pull/103) |
| 4.3 Macros that keep working when the model changes *(to come)* | References, `@all[k]`, Copy Reference, ⚠ notes | [#102](https://github.com/taroyamakatrmttm-star/fmIDE/pull/102) |
| [4.4 Scripting fmIDE with `window.fm`](#scripting-fm) | Building and checking a model from a script | foundations, step 7 ([#27](https://github.com/taroyamakatrmttm-star/fmIDE/pull/27), [#28](https://github.com/taroyamakatrmttm-star/fmIDE/pull/28), [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33)) |
| 4.5 Scripting fmGraph with `window.fmGraph` *(to come)* | Bars, sliders and charts from a script | step 15 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)), step 18 ([#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146)) |

Until the lessons marked *(to come)* are written, fmIDE Help → *Macros*, *Building a macro step by step*, *Variables, loops and expressions*, *Referring to nodes, canvases and templates*, *Macros that work every time* and *When a macro stops* cover them.

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

[← Part 3](03-reuse.md) · [Contents](README.md) · [Part 5 →](05-excelexporter.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
