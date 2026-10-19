# Part 2 — Building a model in fmIDE

[← Part 1](01-getting-started.md) · [Contents](README.md) · [Part 3 →](03-reuse.md)

How to build a model: rectangles and operators, periods and corkscrews, canvases, blocks and plugs, and the tools that make building fast. After this part you can build a multi-period model of your own and know it will give the same numbers in Excel.

The numbers in this part were checked against the apps on `main` at pull request #193 (19 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| 2.1 Your first model *(to come)* | Rectangles, operators, arrows, Evaluate | foundations |
| 2.2 Periods: values over time *(to come)* | Manage Periods, Next / Previous Period, 📈 values per period, 🕒 a rectangle's own number | foundations, [#70](https://github.com/taroyamakatrmttm-star/fmIDE/pull/70) |
| 2.3 Period shifts and corkscrews *(to come)* | Last period's value; an opening balance | foundations, [#71](https://github.com/taroyamakatrmttm-star/fmIDE/pull/71) |
| 2.4 Operators *(to come)* | Arithmetic, comparisons, min, max, iferror, ln, exp, sqrt, int, trunc; an empty operator gives 0 | foundations, step 7 E2a ([#68](https://github.com/taroyamakatrmttm-star/fmIDE/pull/68)), [#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121) |
| [2.5 Timing, conditions and rounding](#timing-conditions) | period, if, =, ≠, and, or, not, round, roundup, rounddown, choose | step 7 E1, E2b ([#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33), [#34](https://github.com/taroyamakatrmttm-star/fmIDE/pull/34), [#69](https://github.com/taroyamakatrmttm-star/fmIDE/pull/69)) |
| 2.6 Canvases and aliases *(to come)* | Several canvases, moving between them, aliases | foundations, [#100](https://github.com/taroyamakatrmttm-star/fmIDE/pull/100), [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168) |
| 2.7 Blocks and vertical blocks *(to come)* | A canvas as one box; one per period | foundations |
| 2.8 Plugs and sockets *(to come)* | Feeding operators on other canvases by name | foundations, [#18](https://github.com/taroyamakatrmttm-star/fmIDE/pull/18), [#22](https://github.com/taroyamakatrmttm-star/fmIDE/pull/22), [#141](https://github.com/taroyamakatrmttm-star/fmIDE/pull/141) |
| 2.9 Building faster *(to come)* | Add Many Rectangles, Ctrl+Enter, snapping to equal spacing, paste into free space, aligning | step 12 ([#73](https://github.com/taroyamakatrmttm-star/fmIDE/pull/73), [#74](https://github.com/taroyamakatrmttm-star/fmIDE/pull/74)), [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54) |
| 2.10 Zoom *(to come)* | 25%–200%, Fit, Selection, pinch | step 13 ([#79](https://github.com/taroyamakatrmttm-star/fmIDE/pull/79), [#80](https://github.com/taroyamakatrmttm-star/fmIDE/pull/80)) |
| 2.11 The canvas look *(to come)* | Format presets, a rectangle's own format, number formats | foundations, step 11a ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)) |
| [2.12 Units, and why fmIDE and Excel give the same numbers](#same-numbers) | The rules both apps follow; units worked out through blocks | step 7 A–C ([#23](https://github.com/taroyamakatrmttm-star/fmIDE/pull/23)–[#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)) |
| 2.13 fmIDE on a tablet *(to come)* | Finger and pen, press and hold, pinch | step 9 ([#45](https://github.com/taroyamakatrmttm-star/fmIDE/pull/45), [#48](https://github.com/taroyamakatrmttm-star/fmIDE/pull/48), [#51](https://github.com/taroyamakatrmttm-star/fmIDE/pull/51)) |
| 2.14 fmIDE on a phone *(to come)* | Inputs, Watch, Share, Make Excel | step 17 P2 ([#129](https://github.com/taroyamakatrmttm-star/fmIDE/pull/129)–[#132](https://github.com/taroyamakatrmttm-star/fmIDE/pull/132)) |

Until the lessons marked *(to come)* are written, fmIDE's Help covers them, and the tutorials *Your first model*, *Time: periods and last period* and *Blocks: build once, use many times* (Help → Tutorials) walk through 2.1, 2.3 and 2.7 inside the app.

---

<a id="timing-conditions"></a>
## Lesson 2.5 — Timing, conditions and rounding

> **Goal:** use the period number, conditions and rounding in a model, so it behaves differently in the first period, switches between cases, and rounds as Excel does.
> **You need:** fmIDE. You should know how to add a rectangle and draw an arrow (lesson 2.1, or the tutorial *Your first model*).
> **Time:** about 15 minutes.
> **In the app:** fmIDE Help → *Timing, conditions and rounding* (`timing-conditions`), *Drawing arrows* (`arrows`).
> **Came in:** step 7, phases E1a, E1b and E2b · [#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33), [#34](https://github.com/taroyamakatrmttm-star/fmIDE/pull/34), [#69](https://github.com/taroyamakatrmttm-star/fmIDE/pull/69)

Eleven operators handle time, conditions and rounding. Each one calculates exactly as its Excel function does, and ExcelExporter writes it as that function.

| Operator | What it does | Its inputs | Where it is | In Excel |
|---|---|---|---|---|
| `period` | The period number: 1, 2, 3… | none | Insert → Excel Functions | the sheet's *Period #* row |
| `if` | *then* where *condition* isn't 0, otherwise *else*. Only the branch taken is worked out. | named: condition, then, else | Insert → Excel Functions | `IF` |
| `=`, `≠` | Equal, not equal: 1 (true) or 0 (false). `0.1 + 0.2 = 0.3` counts as equal, as in Excel. | two, left to right | Insert → Compare | `=`, `<>` |
| `and`, `or`, `not` | Logic on 1 and 0 | left to right | Insert → Excel Functions | `AND`, `OR`, `NOT` |
| `round`, `roundup`, `rounddown` | Round *value* to *digits* places | named: value, digits | Insert → Excel Functions | `ROUND`, `ROUNDUP`, `ROUNDDOWN` |
| `choose` | Picks choice *n* for an *index* of *n* | named: index, choice 1, choice 2… | Insert → Excel Functions | `CHOOSE` |

**Named inputs.** `if`, `round`, `roundup`, `rounddown` and `choose` show a small labelled dot for each input on their left. Drop an arrow on the dot you mean. Dropping it on the box itself fills the first empty input. `choose` always shows one empty choice dot at the end, ready for the next arrow.

### 2.5.1 A corkscrew with `if`

The classic loan balance: in period 1 the balance starts from a typed opening number; after that it starts from last period's closing balance.

**Steps**

1. **File → New** to start a clean document (choose *Don't save* if asked).
2. **Home → Manage Periods**, type `4` as the Number of periods, press **Set**, then **Done**.
3. **Insert → Excel Functions → period**. Add a rectangle (**Home → Add Rectangle**) and type just its name, `Period`, then Enter. Draw an arrow from `period` to Period.
4. Add a rectangle **First** with the value `1` (type `First`, Shift+Enter, `1`, Enter).
5. **Insert → Compare → Equal** (the = button). Draw an arrow from Period to the `=`, then from First to the `=`.
6. Add a rectangle named **Is first period**, and draw an arrow from the `=` to it.
7. Add two rectangles: **Opening** with the value `100`, and **Previous closing** with no value.
8. **Insert → Excel Functions → if**. The `if` box shows three dots on its left: *condition*, *then* and *else*.
9. Draw an arrow from Is first period onto the *condition* dot, from Opening onto *then*, and from Previous closing onto *else*.
10. Add a rectangle **Beginning** and draw an arrow from the `if` to it.
11. Add a rectangle **Drawdown** with the value `25`, a `+` operator (**Home → Add Operator**, choose `+`), and a rectangle **Closing**. Draw arrows Beginning → `+`, Drawdown → `+`, and `+` → Closing.
12. **Home → Add Period Shift** (it moves by −1, the period before). Draw an arrow from Closing to the shift, and from the shift to Previous closing.
13. Press **Evaluate** (F9). Use **Next Period** and **Previous Period** to step through the periods.

**Check it**

| Period | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Is first period | 1 | 0 | 0 | 0 |
| Beginning | 100 | 125 | 150 | 175 |
| Closing | 125 | 150 | 175 | 200 |

In period 1 the *else* branch would read before the first period. That is fine: `if` only works out the branch it takes.

**Good to know**

- The same corkscrew can be built without `if`: give Opening its own number in period 1 only, through its 🕒 button (*First period only*). Lesson 2.3 shows that way; the tutorial *Time: periods and last period* walks through it.

### 2.5.2 Rounding as Excel does

**Steps**

1. On a new canvas (**Model → New Canvas**), add rectangles **X** = `2.675` and **Digits** = `2`.
2. **Insert → Excel Functions → round**. Drop an arrow from X on its *value* dot, and from Digits on its *digits* dot.
3. Add a rectangle **Rounded** and draw an arrow from `round` to it. Press **Evaluate**.

**Check it**

- Rounded shows **2.68**, as Excel's `ROUND(2.675, 2)` does. (A plain computer calculation gives 2.67, because 2.675 is stored as slightly less.)
- Change X to `1234.5678` and Digits to `-2`, then **Evaluate**: Rounded shows **1200**. Negative digits round to tens, hundreds and so on.

### 2.5.3 A case switch with `choose`

**Steps**

1. Add rectangles **Case** = `2`, **Base** = `100`, **Upside** = `120` and **Downside** = `80`.
2. **Insert → Excel Functions → choose**. Drop an arrow from Case on its *index* dot.
3. Drop an arrow from Base on *choice 1*. A new empty dot, *choice 2*, appears: drop Upside on it, then Downside on *choice 3*.
4. Add a rectangle **Price** and draw an arrow from `choose` to it. Press **Evaluate**.

**Check it**

| Case | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Price | 100 | 120 | 80 | ? |

An index below 1 or past the last choice is an error, shown as "?" (Excel's `#VALUE!`). Only the choice picked is worked out.

### Good to know

- **In functions too.** Your own functions can use `IF`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CHOOSE` and `PERIOD()`, for example `Escalated(Base, Rate) = Base * (1 + Rate) ^ (PERIOD() - 1)` or `StartFlag(Start) = IF(PERIOD() >= Start, 1, 0)`. See [lesson 3.5](03-reuse.md#first-function).
- **In Excel.** ExcelExporter writes these operators as `IF(…)`, `ROUND(…)`, `AND(…)`, `CHOOSE(…)`, and the period number as a reference to the sheet's *Period #* row. See [lesson 5.5](05-excelexporter.md#functions-in-excel).
- **A named input with no arrow** makes the operator "?" in fmIDE and `#N/A` in Excel, and ExcelExporter lists it before you download (lesson 5.4).
- **Files.** A model using these operators is saved in a newer file version (system 6 or later). An older copy of fmIDE or ExcelExporter asks before opening it; older files open as before.

### From a script

The corkscrew of 2.5.1, built with `window.fm` (see [lesson 4.4](04-macros-scripting.md#scripting-fm)):

```js
fm.clearAll(); fm.setPeriodCount(4);
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
[1, 2, 3, 4].map(p => fm.getValue('Closing', p));   // [125, 150, 175, 200]
```

`toPort` takes an input's name or its number from 1 (for `if`: 1 condition, 2 then, 3 else).

---

<a id="same-numbers"></a>
## Lesson 2.12 — Units, and why fmIDE and Excel give the same numbers

> **Goal:** know the rules that make the canvas and the workbook agree, and let fmIDE work out your units.
> **You need:** fmIDE; ExcelExporter to see the workbook side.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Rectangles: name, value and unit* (`rectangles`), *Period shifts: last period and next period* (`period-shifts`), *From fmIDE to Excel* (`to-excel`).
> **Came in:** step 7, phases A, B and C · [#23](https://github.com/taroyamakatrmttm-star/fmIDE/pull/23), [#24](https://github.com/taroyamakatrmttm-star/fmIDE/pull/24), [#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)

fmIDE and ExcelExporter calculate from one shared description of the model, so a value on the canvas and the same cell in the workbook always agree. Where they can't (a broken model), ExcelExporter tells you before you download ([lesson 5.4](05-excelexporter.md#differences)). The automatic tests compare the two for every sample model.

### 2.12.1 The rules worth knowing

**Modulo works like Excel's MOD.**

1. **File → New**. Add rectangles **A** = `-7` and **B** = `3`.
2. **Insert → Arithmetic → Modulo** (the % button). Draw an arrow from A to the `%`, then from B. (`%` reads its inputs from left to right by where they sit, so keep A to the left of B.)
3. Add a rectangle **Mod**, draw `%` → Mod, and press **Evaluate**.

**Check it:** Mod shows **2**. The result takes the sign of the divisor, as `MOD(-7, 3)` does in Excel.

**The other rules**, in short:

| Case | What both apps do |
|---|---|
| A comparison with three inputs, `a < b < c` | Means "a < b **and** b < c". |
| A comparison with one input | An error: "?" in fmIDE, `#N/A` in Excel. |
| `iferror` with a single failing input, or nothing wired in | 0. |
| An operator with nothing wired in at all | 0, as Excel writes it ([#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121)). |
| A period ticked under a rectangle's 🕒 (*Which periods use this rectangle's own number?*) | Uses the typed number, even if an arrow comes in. |
| A corkscrew's opening balance in period 1 (no period before) | Its own typed number, or 0. |
| A wired rectangle whose source fails (say, a divide by zero) | "?" in fmIDE, an error in Excel. The typed number is used only where the timeline runs out. |
| An operator fmIDE doesn't know (only in a hand-edited file) | "?" and `#N/A`. |

### 2.12.2 Units, worked out for you

Each rectangle has a unit of measure, its third line (`t`, `$`, `$/t`…). Type the units of your inputs, and fmIDE works out the rest: `$/t × t` gives `$`, and adding `t` to `$` is flagged. The workbook's unit column (UOM) shows the same units.

Units are worked out through blocks too:

1. Make a canvas **Price x Volume**: a rectangle **Price** (unit `$/t`), a rectangle **Volume** (unit `kt`), a `×` operator, and a rectangle **Revenue** fed by the `×`.
2. Mark Price and Volume as the block's inputs (select each, press its ⇄ button, choose *Input*) and Revenue as its output (⇄, *Output*).
3. On another canvas, **Home → Add Block** and choose *Price x Volume*. Feed its inputs from rectangles with units `$/t` and `kt`, and draw its output into a new rectangle.

**Check it:** the new rectangle shows the unit **$k**, worked out through the block. The workbook shows the same in its unit column.

### Good to know

- **Speed.** The shared calculation made fmIDE about three times faster on a large model (about 1,900 boxes over 24 periods), and ExcelExporter's Generate about a third faster. Each period is worked out once ([#71](https://github.com/taroyamakatrmttm-star/fmIDE/pull/71)), so long timelines stay quick.
- **Plugs and sockets** are matched by their names in both apps, so a file whose saved links are out of date still gives the same numbers in both.
- **Check it yourself.** Build 2.12.1 and the corkscrew of [lesson 2.5](#timing-conditions), then **File → Open ExcelExporter** and **⬇ Generate .xlsx**: the workbook's numbers match the canvas in every period.

---

[← Part 1](01-getting-started.md) · [Contents](README.md) · [Part 3 →](03-reuse.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
