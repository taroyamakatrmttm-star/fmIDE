# Part 2 — Building a model in fmIDE

[← Part 1](01-getting-started.md) · [Contents](README.md) · [Part 3 →](03-reuse.md)

How to build a model: rectangles and operators, periods and corkscrews, canvases, blocks and plugs, and the tools that make building fast. After this part you can build a multi-period model of your own and know it will give the same numbers in Excel.

The numbers in this part were checked against the apps on `main` at pull request #195 (20 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [2.1 Your first model](#first-model) | Rectangles, operators, arrows, Evaluate | foundations |
| [2.2 Periods: values over time](#periods) | Manage Periods, Next / Previous Period, 📈 values per period, 🕒 a rectangle's own number | foundations, [#70](https://github.com/taroyamakatrmttm-star/fmIDE/pull/70) |
| [2.3 Period shifts and corkscrews](#period-shifts) | Last period's value; an opening balance | foundations, [#71](https://github.com/taroyamakatrmttm-star/fmIDE/pull/71) |
| [2.4 Operators](#operators) | Arithmetic, comparisons, min, max, iferror, ln, exp, sqrt, int, trunc; an empty operator gives 0 | foundations, step 7 E2a ([#68](https://github.com/taroyamakatrmttm-star/fmIDE/pull/68)), [#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121) |
| [2.5 Timing, conditions and rounding](#timing-conditions) | period, if, =, ≠, and, or, not, round, roundup, rounddown, choose | step 7 E1, E2b ([#33](https://github.com/taroyamakatrmttm-star/fmIDE/pull/33), [#34](https://github.com/taroyamakatrmttm-star/fmIDE/pull/34), [#69](https://github.com/taroyamakatrmttm-star/fmIDE/pull/69)) |
| [2.6 Canvases and aliases](#canvases) | Several canvases, moving between them, aliases | foundations, [#100](https://github.com/taroyamakatrmttm-star/fmIDE/pull/100), [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168) |
| [2.7 Blocks and vertical blocks](#blocks) | A canvas as one box; one per period | foundations |
| [2.8 Plugs and sockets](#plugs-sockets) | Feeding operators on other canvases by name | foundations, [#18](https://github.com/taroyamakatrmttm-star/fmIDE/pull/18), [#22](https://github.com/taroyamakatrmttm-star/fmIDE/pull/22), [#141](https://github.com/taroyamakatrmttm-star/fmIDE/pull/141) |
| [2.9 Building faster](#building-faster) | Add Many Rectangles, Ctrl+Enter, snapping to equal spacing, paste into free space, aligning | step 12 ([#73](https://github.com/taroyamakatrmttm-star/fmIDE/pull/73), [#74](https://github.com/taroyamakatrmttm-star/fmIDE/pull/74)), [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49), [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54) |
| [2.10 Zoom](#zoom) | 25%–200%, Fit, Selection, pinch | step 13 ([#79](https://github.com/taroyamakatrmttm-star/fmIDE/pull/79), [#80](https://github.com/taroyamakatrmttm-star/fmIDE/pull/80)) |
| [2.11 The canvas look](#canvas-look) | Format presets, a rectangle's own format, number formats | foundations, step 11a ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)) |
| [2.12 Units, and why fmIDE and Excel give the same numbers](#same-numbers) | The rules both apps follow; units worked out through blocks | step 7 A–C ([#23](https://github.com/taroyamakatrmttm-star/fmIDE/pull/23)–[#25](https://github.com/taroyamakatrmttm-star/fmIDE/pull/25)) |
| [2.13 fmIDE on a tablet](#tablet) | Finger and pen, press and hold, pinch | step 9 ([#45](https://github.com/taroyamakatrmttm-star/fmIDE/pull/45), [#48](https://github.com/taroyamakatrmttm-star/fmIDE/pull/48), [#51](https://github.com/taroyamakatrmttm-star/fmIDE/pull/51)) |
| [2.14 fmIDE on a phone](#phone) | Inputs, Watch, Share, Make Excel | step 17 P2 ([#129](https://github.com/taroyamakatrmttm-star/fmIDE/pull/129)–[#132](https://github.com/taroyamakatrmttm-star/fmIDE/pull/132)) |


---

<a id="first-model"></a>
## Lesson 2.1 — Your first model: rectangles, operators and arrows

> **Goal:** build a small model and see fmIDE work out its value and its unit.
> **You need:** fmIDE (**File → New**, or **Start blank** on the welcome card).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Your first model in five minutes* (`first-model`), *Rectangles: name, value and unit* (`rectangles`), *Drawing arrows* (`arrows`) · Tutorial *Your first model* (`first-model`)
> **Came in:** the first version

A model is a drawing. Each number is a box called a **rectangle**. **Arrows** show where numbers come from, and small boxes called **operators** combine them. This lesson builds Revenue = Price × Quantity.

### Steps

1. **Home → Add Rectangle.** A rectangle appears, ready to type in. Type `Price`, press **Shift+Enter**, type `10`, press **Shift+Enter**, type `$/t`, then press **Enter**. The three lines are its name, its value and its unit.
2. Add a second rectangle the same way: `Quantity`, `5`, `t`.
3. Add a third and type just its name, `Revenue`, then **Enter**. It has no value of its own: it will be worked out.
4. **Home → Add Operator** and choose **×** in the list that opens.
5. Draw an arrow from Price to the ×: point at Price, and small dots appear on its edges; drag from a dot and drop on the ×. (With a mouse you can also drag with the right button from anywhere on Price.)
6. Draw an arrow from Quantity to the ×, and one from the × to Revenue.
7. Press **Evaluate** (**F9**).

### Check it

Revenue shows **= 50**, and its unit, **$**, worked out for you ($/t × t).

### Good to know

- **Inputs and calculations.** A rectangle with no arrow coming in is an **input**: you type its value. A rectangle fed by an arrow is a **calculation**. (Strictly, a rectangle fed only by an operator that nothing feeds is also an input; all three apps use this one rule.)
- **Values are worked out when you press Evaluate.** After a change, press it again. Change Price to `12` (double-click it to edit) and Evaluate: Revenue shows 60.
- **Draw a result into a rectangle.** An operator's result needs a rectangle to have a name and to appear as a row in Excel.
- **Delete** a box or an arrow by clicking it and pressing **Delete**. **Undo** is **Ctrl+Z**.
- **The buttons on a selected rectangle:** 🔌 plugs ([2.8](#plugs-sockets)), ⇄ block input or output ([2.7](#blocks)), 🎨 its own format ([2.11](#canvas-look)), 🕒 which periods use its own number ([2.3](#period-shifts)), 📈 its value across periods ([2.2](#periods)).

### From a script

```js
fm.clearAll();
fm.createRect({ x: 80,  y: 60,  name: 'Price',    value: '10', uom: '$/t' });
fm.createRect({ x: 80,  y: 200, name: 'Quantity', value: '5',  uom: 't' });
fm.createRect({ x: 600, y: 140, name: 'Revenue',  value: '' });
const m = fm.createOperator({ x: 360, y: 140, op: '×' });
fm.connect({ from: 'Price', to: '#' + m });
fm.connect({ from: 'Quantity', to: '#' + m });
fm.connect({ from: '#' + m, to: 'Revenue' });
fm.getValue('Revenue');   // 50
```

---

<a id="periods"></a>
## Lesson 2.2 — Periods: values over time

> **Goal:** run the model over several periods, and give an input a different value in each.
> **You need:** the model of [lesson 2.1](#first-model).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Periods and the timeline* (`periods`), *A value that changes over time* (`values-over-time`) · Tutorial *Time: periods and last period* (`time`)
> **Came in:** the first version; the 📈 chart showing every period [#70](https://github.com/taroyamakatrmttm-star/fmIDE/pull/70)

A model runs over a **timeline of periods** (for example 2027, 2028, 2029), shared by every canvas. In Excel each period becomes a column.

### Steps

1. **Home → Manage Periods.** Type `5` as the **Number of periods**, press **Set**, then **Done**. New periods are named *Period 2*, *Period 3* and so on; you can rename them in the same window.
2. The canvas shows one period at a time. **Home → Next Period** and **Previous Period** move between them. Every period shows Revenue 50: an input keeps the same value in every period unless you give it one per period.
3. Select **Price** and press its **📈** button. A small chart shows its value in every period.
4. Draw the values with the mouse, or type them separated by commas: `10, 11, 12`. Save.
5. Press **Evaluate**, then step through the periods.

### Check it

| Period | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Price | 10 | 11 | 12 | 12 | 12 |
| Revenue | 50 | 55 | 60 | 60 | 60 |

Values typed for fewer periods than the timeline has are held flat from the last one.

### Good to know

- **Only the last period can be removed,** and new ones are added at the end, so a period shift never ends up reading a different period.
- **The 📈 window** shows every period at once. Drag its bottom-right corner to make it bigger; with many periods, type exact values in the boxes below the chart.
- **🕒** chooses the periods where a rectangle uses its own typed number even though an arrow comes in: [lesson 2.3](#period-shifts).

### From a script

```js
fm.setPeriodCount(5);
fm.setPeriodValues({ node: 'Price', values: '10, 11, 12' });
[1, 2, 3, 4, 5].map(p => fm.getValue('Revenue', p));   // [50, 55, 60, 60, 60]
```

---

<a id="period-shifts"></a>
## Lesson 2.3 — Period shifts and corkscrews

> **Goal:** carry a balance from one period to the next.
> **You need:** fmIDE with 5 periods ([lesson 2.2](#periods)).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Period shifts: last period and next period* (`period-shifts`), *A value that changes over time* (`values-over-time`) · Tutorial *Time: periods and last period* (`time`)
> **Came in:** the first version; each period worked out once [#71](https://github.com/taroyamakatrmttm-star/fmIDE/pull/71)

A **period shift** passes on a value from another period. At −1, the usual setting, it passes on the previous period's value. That is how a **corkscrew** works: opening + additions = closing, and next period's opening is this period's closing.

### Steps

1. On a new canvas (**Model → New Canvas**), add rectangles **Opening** = `100` and **Additions** = `20`, and a rectangle named just **Closing**.
2. **Home → Add Operator**, choose **+**. Draw arrows Opening → +, Additions → +, and + → Closing.
3. Press **Evaluate**. Closing shows 120 in period 1.
4. **Home → Add Period Shift.** Draw an arrow from Closing to the shift, and one from the shift to Opening.
5. Opening should use its own 100 only in the first period, and last period's Closing after that. Select Opening, press its **🕒** button (*Which periods use this rectangle's own number?*), press **First period only**, then **Save**.
6. Press **Evaluate**, and step through the periods.

### Check it

| Period | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Opening | 100 | 120 | 140 | 160 | 180 |
| Closing | 120 | 140 | 160 | 180 | 200 |

### Good to know

- **Period 1 has no period before it.** Even without step 5, Opening uses its typed number there, because the shift has nothing to read; Excel writes the same. Ticking **First period only** says so plainly, and 🕒 can tick any periods, for example actual years typed over a forecast formula.
- **Double-click a shift** to change how far it moves: −12 reads the same month last year in a monthly model; +1 reads the next period.
- **The same with `if`:** `if(period = 1, Opening, last Closing)`, in [lesson 2.5](#timing-conditions).
- **Long timelines are quick:** each period is worked out once, so a large model over 60 periods calculates in under a second.

### From a script

```js
fm.setLiteralPeriods({ node: 'Opening', periods: 'first' });   // 🕒 First period only
[1, 2, 3, 4, 5].map(p => fm.getValue('Closing', p));          // [120, 140, 160, 180, 200]
```

---

<a id="operators"></a>
## Lesson 2.4 — Operators: arithmetic, comparisons and Excel functions

> **Goal:** know every operator, and how each reads its inputs.
> **You need:** fmIDE.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Operators* (`operators`), *Drawing arrows* (`arrows`)
> **Came in:** the first version; ln, exp, sqrt, int and trunc, step 7 E2a ([#68](https://github.com/taroyamakatrmttm-star/fmIDE/pull/68)); an operator with nothing wired in gives 0 [#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121)

**Home → Add Operator** asks which operator. The **Insert** tab has each one as its own button, in three groups:

| Group | Operators | How they read their inputs |
|---|---|---|
| **Arithmetic** | `+` `−` `×` `÷` `^` (power) `%` (modulo) | `+` and `×` take any number of arrows. For `−`, `÷`, `^` and `%`, order counts. |
| **Compare** | `≤` `≥` `<` `>` `=` `≠` | Two inputs, in order; 1 (true) or 0 (false). |
| **Excel Functions** | `min` `max` `ave` `abs` `iferror`; `ln` `exp` `sqrt` `int` `trunc`; `if` `and` `or` `not` `round` `roundup` `rounddown` `period` `choose` | As their Excel functions. The last group is [lesson 2.5](#timing-conditions). |

**Order counts by position.** Where order matters, inputs are taken **from left to right by where they sit on the canvas**, and a small number on each arrow shows its place. Move a box and the order can change.

### Steps

1. **File → New.** Add rectangles **A** = `10` and **B** = `4`, with A to the left of B.
2. **Insert → Arithmetic → −** (the button reads *Subtract*). Draw A → −, B → −, and − into a new rectangle **A minus B**.
3. **Insert → Excel Functions → max**. Draw A and B into it, and it into a rectangle **Bigger**. Do the same with **ave** into **Average**.
4. Press **Evaluate**.
5. Now drag A to the right of B, and Evaluate again.

### Check it

A minus B shows **6**, Bigger **10**, Average **7**. After step 5, A minus B shows **−6**: B now comes first.

### The one-input functions

| Operator | Input | Result | Like Excel's |
|---|---|---|---|
| `abs` | −3 | 3 | `ABS` |
| `int` | −2.5 | −3 (rounds down) | `INT` |
| `trunc` | −2.5 | −2 (cuts the fraction off) | `TRUNC` |
| `sqrt` | −4 | "?" (an error) | `SQRT` (#NUM!) |
| `ln` | 0 | "?" (an error) | `LN` (#NUM!) |

The results of `ln`, `exp` and `sqrt` have no unit.

### Good to know

- **Double-click an operator** to change it to another.
- **`iferror`** uses its first input, or the second where the first is an error.
- **An operator with nothing wired in gives 0,** as Excel writes it. A rectangle fed only by such an operator is still an input and keeps its own number; an operator that adds an empty one to A gives A. This matters for sockets nothing is plugged into yet ([lesson 2.8](#plugs-sockets)).
- **"?" means no value:** point at it to read why. ExcelExporter lists every "?" before you download ([lesson 5.4](05-excelexporter.md#differences)).

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

- The same corkscrew can be built without `if`: give Opening its own number in period 1 only, through its 🕒 button (*First period only*). [Lesson 2.3](#period-shifts) shows that way; the tutorial *Time: periods and last period* walks through it.

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

<a id="canvases"></a>
## Lesson 2.6 — Canvases and aliases

> **Goal:** split a model into canvases, like the sheets of a workbook, and use a value from one canvas on another.
> **You need:** the corkscrew of [lesson 2.3](#period-shifts), on a canvas you have renamed **Corkscrew** (double-click its tab).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Canvases* (`canvases`), *Aliases* (`aliases`)
> **Came in:** the first version; moving between canvases from the keyboard [#100](https://github.com/taroyamakatrmttm-star/fmIDE/pull/100); canvases that grow to hold every box [#168](https://github.com/taroyamakatrmttm-star/fmIDE/pull/168)

Each canvas is a tab under the ribbon, and becomes its own tab in Excel. An **alias** is a stand-in for a rectangle, on this canvas or another: it always shows the same value, and arrows can start from it.

### Steps

1. **Model → New Canvas** (or **+** at the end of the tabs). Double-click the new tab and name it `Summary`.
2. **Home → Add Alias.** The window *Add alias: choose a canvas* lists the canvases. Choose **Corkscrew**, then **Closing**. An alias of Closing appears.
3. Add a rectangle **Fee rate** = `0.1`, a **×** operator, and a rectangle **Fee**. Draw the alias → ×, Fee rate → ×, and × → Fee.
4. Press **Evaluate**, and step through the periods.

### Check it

| Period | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Fee | 12 | 14 | 16 | 18 | 20 |

### Good to know

- **Moving between canvases:** click a tab, or **Next Canvas** (**Alt+Page Down**, ⌥ Option on a Mac) and **Previous Canvas** (**Alt+Page Up**); they go round from the last tab to the first.
- **The Model tab** also has **Rename Canvas**, **Delete Canvas**, **Clear Canvas**, **Move Canvas Left** and **Move Canvas Right**. Drag a tab to move it too.
- **A quicker alias:** with a mouse, drag a rectangle while holding **Alt** (Option) to make an alias of it. **🔗** on an alias changes the rectangle it shows.
- **Large canvases:** a canvas grows to hold every box, so you can always scroll to the last one.
- **Values also travel between canvases** through plugs and sockets ([2.8](#plugs-sockets)) and blocks ([2.7](#blocks)).

### From a script

```js
const al = fm.createAlias({ sourceCanvas: 'Corkscrew', source: 'Closing' });
```

---

<a id="blocks"></a>
## Lesson 2.7 — Blocks and vertical blocks

> **Goal:** build a calculation once and use it many times as one box, including once per period.
> **You need:** fmIDE with 5 periods.
> **Time:** about 15 minutes.
> **In the app:** fmIDE Help → *Blocks: a canvas used as a building block* (`blocks`) · Tutorial *Blocks: build once, use many times* (`blocks`)
> **Came in:** the first version

Any canvas can become a **block**: mark its rectangles as inputs and outputs with their **⇄** button. On another canvas, the block is one box with its inputs on the left and its outputs on the right.

### 2.7.1 A block

**Steps**

1. Name a canvas `Tax`. Add **Profit** = `100` (a stand-in: the block gets its profit from outside), **Tax rate** = `0.3`, a **×** and a rectangle **Tax**. Draw Profit → ×, Tax rate → ×, × → Tax.
2. Select Profit, press **⇄** and choose **Input**. Select Tax, press **⇄** and choose **Output**.
3. **Model → New Canvas**. Add a rectangle **Company profit** = `1000`.
4. **Home → Add Block** and choose **Tax**. The block appears as one box: *Profit* on its left, *Tax* on its right.
5. Draw Company profit onto the block's *Profit* dot. Add a rectangle **Company tax**, and draw from the block's *Tax* dot to it.
6. Press **Evaluate**.

**Check it:** Company tax shows **300** (1000 × 0.3). Add the block again with other inputs, as often as you like.

### 2.7.2 A vertical block: depreciation by year of spending

A **vertical** block runs once per period, each copy (an *instance*, or vintage) for one period's spending, then adds up their results. Here each year's capital spending is depreciated over two years.

**Steps**

1. Name a new canvas `Depreciation`. Add:
   - **Capex** = `0`, marked ⇄ **Input** (the spending this vintage depreciates);
   - **Vintage** = `1`, marked ⇄ **Vertical Index** (each copy reads its own number here: 1, 2, 3…);
   - **Life** = `2` and **Zero** = `0`.
2. **Insert → Excel Functions → period**, drawn into a rectangle **Now**. Place Now **to the left of** Vintage.
3. A **−** with Now → − and Vintage → −, into a rectangle **Age** (Now − Vintage: `−` reads left to right).
4. A **<** with Age → < and Life → <, into **In life**. A **≥** with Age → ≥ and Zero → ≥, into **Started** (keep Age left of, or above, Zero).
5. A **÷** with Capex → ÷ and Life → ÷ (Capex first), then a **×** fed by the ÷, In life and Started, into a rectangle **Charge**. Mark Charge ⇄ **Output**.
6. On a new canvas `Assets`, add **Spend** and give it `100, 0, 50, 0, 0` with its 📈 button.
7. **Home → Add Block**, tick **Vertical**, and choose **Depreciation**.
8. Draw Spend onto the block's *Capex* dot. Under the dot, click **broadcast** so it reads **indexed**: copy *i* then reads Spend in period *i*.
9. Draw the block's *Charge* dot into a rectangle **Depreciation charge**. Press **Evaluate**.

**Check it**

| Period | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Spend | 100 | 0 | 50 | 0 | 0 |
| Depreciation charge | 50 | 50 | 25 | 25 | 0 |

### Good to know

- **broadcast or indexed.** A *broadcast* input is the same for every copy; an *indexed* one is read at the copy's own period, as Capex here.
- **How the copies combine.** Added up by default. The output rectangle's **Σ** chip chooses max, min, average or product instead.
- **🔗 Change block** on a block's box switches it to another block, or to vertical.
- **In Excel,** a block's copies can get tabs of their own ([lesson 5.7](05-excelexporter.md#blocks-in-excel)).
- **Order matters** inside a block as anywhere: `−`, `÷` and the comparisons read their inputs left to right ([lesson 2.4](#operators)).

---

<a id="plugs-sockets"></a>
## Lesson 2.8 — Plugs and sockets

> **Goal:** connect canvases by name, without aliases or arrows across them.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Plugs and sockets* (`plugs-sockets`)
> **Came in:** the first version; several plugs on one rectangle [#18](https://github.com/taroyamakatrmttm-star/fmIDE/pull/18); the warning when several plugs feed one socket [#22](https://github.com/taroyamakatrmttm-star/fmIDE/pull/22); an empty socket gives 0 [#121](https://github.com/taroyamakatrmttm-star/fmIDE/pull/121); typing a plug's name [#141](https://github.com/taroyamakatrmttm-star/fmIDE/pull/141)

A rectangle's **plug** feeds every operator whose **socket** has the same name, on any canvas.

### Steps

1. On a canvas `P&L`, add **Interest** = `40`. Select it, press **🔌**, type `Interest cost` and press **Enter**.
2. On a canvas `Cash`, add **Operating cash** = `500`, a **−** operator, and a rectangle **Cash after interest**. Draw Operating cash → − and − → Cash after interest.
3. Select the −, press **⚡** and type `Interest cost`.
4. Press **Evaluate**.

### Check it

fmIDE draws an automatic alias of Interest beside the socket, and Cash after interest shows **460** (500 − 40).

### Good to know

- **Several plugs** on one rectangle each feed their own sockets: type another name in the 🔌 editor.
- **Several plugs into one socket are added together.** The socket then shows **⚡ name ×2** in amber as a warning, since that can double a number by accident; point at it to list the plugs.
- **A socket nothing is plugged into gives 0,** as in Excel, so what reads it still works out.
- **Recipes** connect the canvases they build through plugs and sockets ([lesson 3.4](03-reuse.md#recipes)).

### From a script

```js
fm.addPlug({ node: 'Interest', plug: 'Interest cost' });
fm.setSocket({ node: '#' + minusId, socket: 'Interest cost' });
```

---

<a id="building-faster"></a>
## Lesson 2.9 — Building faster: many rectangles at once, snapping and arranging

> **Goal:** lay out a model quickly and tidily.
> **You need:** fmIDE.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Rectangles: name, value and unit* (`rectangles`), *Moving, copying and arranging* (`arranging`)
> **Came in:** step 12 · Add Many Rectangles [#73](https://github.com/taroyamakatrmttm-star/fmIDE/pull/73); snapping to equal spacing [#74](https://github.com/taroyamakatrmttm-star/fmIDE/pull/74); new boxes in free space [#49](https://github.com/taroyamakatrmttm-star/fmIDE/pull/49); paste into free space [#54](https://github.com/taroyamakatrmttm-star/fmIDE/pull/54)

### Steps

1. **Home → Add Many Rectangles…**. Type a name in each row and press Enter for the next: `Revenue`, `Costs`, `Profit`. Value and Unit are optional. (Or paste a list: one name per line, or columns copied from Excel: name, value, unit.)
2. Under **Arrange**, choose **Column**, **Row** or **Grid**, and the **Gap**. Press **Add 3**. They arrive in one step, where they overlap nothing, selected so you can drag them into place.
3. Double-click Profit and press **Ctrl+Enter** (⌘Enter on a Mac) instead of Enter: it saves Profit and starts a new rectangle just below, with the same gap. Type `Margin` and press Enter.
4. Drag Costs near Revenue. A blue line shows when an edge or middle lines up. Next to two boxes in a row, pink bars show where the gaps are equal: let go there.
5. Select several boxes (drag a frame round them on empty canvas, or Shift-click) and use **Arrange → Align Left** or **Distribute Vertically**.

### Check it

Four rectangles in a tidy column, evenly spaced. One **Undo** removes all three added in step 2.

### Good to know

- **Move freely:** hold **Alt** after you start dragging to turn snapping off. (Alt held *before* the drag makes an alias.)
- **Copy and paste** (**Ctrl+C**, **Ctrl+V**) copy boxes with the arrows between them, and paste lands in free space, so pasting again doesn't pile copies up. With a mouse, drag holding **Ctrl** to duplicate.
- **New boxes never land on others:** every Add command puts the new box near the middle of the view, where it overlaps nothing.
- **A name already on the canvas** is marked in Add Many Rectangles, but still allowed.

### From a script

```js
fm.createRects({ items: [{ name: 'Price', value: 10, uom: '$/t' }, 'Volume'], layout: 'row' });
```

---

<a id="zoom"></a>
## Lesson 2.10 — Zoom

> **Goal:** see the whole model, or one corner of it, at any size.
> **You need:** fmIDE with a model.
> **Time:** about 2 minutes.
> **In the app:** fmIDE Help → *Finding your way around* (`finding-your-way`), *Using fmIDE on a tablet* (`touch`)
> **Came in:** step 13 · zoom [#79](https://github.com/taroyamakatrmttm-star/fmIDE/pull/79); pinch on a tablet [#80](https://github.com/taroyamakatrmttm-star/fmIDE/pull/80)

### Steps

1. **View → Zoom to Fit**: the whole canvas fits the window.
2. Hold **Ctrl** (⌘ on a Mac) and turn the mouse wheel over the part you want to look at (or pinch on a trackpad). It zooms around the pointer, from 25% to 200%.
3. Select a few boxes and choose **View → Zoom to Selection**.
4. Press **Ctrl+0** to go back to 100%.

### Check it

The control at the bottom right shows the zoom. Its − and + step it; the percentage opens a menu with every level, *Fit* and *Selection*.

### Good to know

- **Keys:** **Ctrl+=** zooms in, **Ctrl+−** out, **Ctrl+0** 100%.
- **Everything works at any zoom:** moving, resizing, drawing arrows, selecting, snapping, typing.
- **Each canvas keeps its own zoom.** It belongs to your screen: never saved in a file, never recorded in a macro. A tutorial starts at 100% and gives your zoom back.
- **On a tablet,** pinch with two fingers ([lesson 2.13](#tablet)).

---

<a id="canvas-look"></a>
## Lesson 2.11 — The canvas look: formats and number formats

> **Goal:** make inputs and calculations easy to tell apart, and set the number formats Excel will use.
> **You need:** fmIDE with a model.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Formats and format roles* (`formats`)
> **Came in:** the first version; the Excel look moved to ExcelExporter, step 11a ([#63](https://github.com/taroyamakatrmttm-star/fmIDE/pull/63)); the colour grid, branch `claude/colour-grid-picker-1c5e83`; no minus sign on a value that rounds to zero, branch `claude/no-negative-zero`

### Steps

1. **Model → Format Presets** (also on the File tab). The window *Format Presets & Roles* lists two **roles**:
   - **Inputs**: every input rectangle, the numbers you type;
   - **Calculations**: every rectangle fed by an arrow (blank at first: the normal look).
2. Press **✎** on **Inputs**. The window *Edit format preset — Inputs* opens. Set **Number format** to **Number** with **Decimals** `2`, and pick a **Fill color**: its box opens a grid of colours, with the colours your model already uses at the bottom and **More…** for an exact colour. (It also has border, font, font size, font weight and name colour.) Press **Save**.
3. Every input rectangle on every canvas takes the new look.
4. Select one rectangle and press its **🎨** (*Format rectangle*). Give it a look of its own: it no longer follows its role.

### Check it

Inputs and calculations look different at a glance, and the input's number shows two decimals.

### Good to know

- **Two owners of the look.** fmIDE sets how rectangles look on the canvas, and their **number formats**, which go to Excel too. How cells look in Excel (fills, fonts, borders) is set in ExcelExporter, under **⚙ Settings → Excel Style**, once for every model you export ([lesson 5.8](05-excelexporter.md#excel-look)).
- **Presets** are named looks you can apply again; **⇩ Export Presets** and **⇧ Import Presets** share them.
- **Zero has no minus sign.** A value that rounds to zero at the decimals shown — minus zero, or −0.00001 with 1 decimal — shows as `0.0` (or `0.0%`, `0`), as Excel shows it. A real negative keeps its sign: −0.06 with 1 decimal shows `-0.1`.
- **Older files** still open; Excel-only settings they carried from before step 11 are left out.

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

<a id="tablet"></a>
## Lesson 2.13 — fmIDE on a tablet

> **Goal:** build with a finger or a pen.
> **You need:** fmIDE on a tablet (installed works well: [lesson 1.2](01-getting-started.md#opening-the-apps)).
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Using fmIDE on a tablet* (`touch`)
> **Came in:** step 9 · one input path for mouse, finger and pen [#45](https://github.com/taroyamakatrmttm-star/fmIDE/pull/45); press and hold, selecting, double-tap [#48](https://github.com/taroyamakatrmttm-star/fmIDE/pull/48); the screen [#51](https://github.com/taroyamakatrmttm-star/fmIDE/pull/51); pinch [#80](https://github.com/taroyamakatrmttm-star/fmIDE/pull/80); a menu choice after a tap [#115](https://github.com/taroyamakatrmttm-star/fmIDE/pull/115)

### Steps

1. Drag a box with a finger to move it.
2. Tap a box to show its dots, then drag from a dot to another box to draw an arrow.
3. **Press and hold** a box. Its menu offers: draw an arrow from here (then tap the target), make an alias, duplicate, add to or remove from the selection, edit, properties, delete, and Help for that kind of box.
4. **Double-tap** a rectangle to edit it, as a double-click does.
5. On empty canvas, one finger scrolls. Press and hold there, then drag, to select with a frame.
6. **Pinch** with two fingers to zoom around the point between them; move both fingers together to move around.

### Check it

You built and wired a box without a mouse. A pinch that ends close to 100% settles at exactly 100%.

### Good to know

- **A pen** works the same way as a finger. The mouse works exactly as before.
- **Fitted to the screen:** the ribbon shows arrows at its ends when it is wider than the screen, typing doesn't make the browser zoom, and windows stay above the on-screen keyboard.
- **If one finger was dragging a box** when the second lands, the box goes back and the pinch takes over; nothing is added to Undo.
- **On an iPad,** **File → Open…** shows the Files app, where `.fmide` files can be picked.

---

<a id="phone"></a>
## Lesson 2.14 — fmIDE on a phone

> **Goal:** look at a model on a phone, change its inputs, and share it.
> **You need:** fmIDE on a phone, and a document to open.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Using fmIDE on a phone* (`phone`)
> **Came in:** step 17, phase P2 · Inputs, Watch and the canvas [#129](https://github.com/taroyamakatrmttm-star/fmIDE/pull/129); Share and the install note [#130](https://github.com/taroyamakatrmttm-star/fmIDE/pull/130); Make Excel [#131](https://github.com/taroyamakatrmttm-star/fmIDE/pull/131); every input listed [#132](https://github.com/taroyamakatrmttm-star/fmIDE/pull/132)

On a phone, fmIDE is made for the hand, not a smaller screen: it opens to your **inputs**, to change and watch, rather than the canvas. Building stays on a tablet or computer.

The screen has four parts along the bottom: **Inputs**, **Watch**, **Canvas** and **More (☰)**. At the top: the document's name, **↶ Undo** and **↷ Redo**, and the periods (‹ and ›, or tap the period to pick one).

### Steps

1. **More (☰) → Open…** and pick a document.
2. **Inputs** lists every input rectangle, by canvas; search by its name or its canvas's. Change one with its slider: grab it anywhere, and slide your finger up while dragging to make it finer. Tap the number to type one, or use − and +.
3. Tap **☆** on a rectangle to **watch** it: it stays at the top of Inputs, and on the Watch screen, with how far it has moved since you opened the document.
4. **Canvas** shows a canvas to look at (pinch to zoom). Tap a rectangle for its card: its value in every period, what it is worked out from and what reads it, in words.
5. **More (☰) → Save**, or **⇪ Share the document** to send the `.fmide` file through the phone's share sheet (Mail, Messages, Files, AirDrop…).

### Check it

A watched rectangle shows how far it moved when you changed an input. The slider settles back on the number the input had when you opened the document, with a tick.

### Good to know

- **A change on a phone is a real change** to the model: one step you can undo, the document marked unsaved, kept in the autosave. Sharing sends a copy; the document stays unsaved until you Save it.
- **An input with a number per period** changes in the period shown. Tick **All periods by %** to move every period together.
- **An input with no number yet** says *No number yet (counts as 0)*; set one with its slider. An input inside a block says how many blocks use it.
- **More (☰)** also has **📈 Open fmGraph** (fmGraph in its phone layout) and **📊 Make Excel**: ExcelExporter's one screen, which makes the workbook and hands it to the share sheet.
- **Install it,** or a browser may clear what fmIDE keeps (the autosave, your Watch lists) after some weeks: on an iPhone, Safari's **Share ⇪ → Add to Home Screen**; on Android, **More (☰) → ⤓ Install fmIDE**. Save documents you care about either way.
- **More (☰) → Full app** shows the whole of fmIDE on the phone; **📱 Phone layout** goes back. The choice is remembered in this browser.

---

[← Part 1](01-getting-started.md) · [Contents](README.md) · [Part 3 →](03-reuse.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
