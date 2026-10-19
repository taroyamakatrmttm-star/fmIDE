# Part 6 — fmGraph: see how a value moves your model

[← Part 5](05-excelexporter.md) · [Contents](README.md) · [Part 7 →](07-excel-import.md)

fmGraph shows your model as bars and charts, with sliders that change its inputs, so you can see at once what a value moves and by how much. It never changes your model. After this part you can build a board, explore "what if", save scenarios, find which inputs matter most, and take the board to Excel ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).

The numbers in this part were checked against the apps on `main` at pull request #193 (19 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| 6.1 Bars and sliders *(to come)* | Open fmGraph, + Bar, + Slider, what a slider reaches, folding sliders, sharing slider positions | step 15 G1 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)), [#142](https://github.com/taroyamakatrmttm-star/fmIDE/pull/142), [#143](https://github.com/taroyamakatrmttm-star/fmIDE/pull/143), [#181](https://github.com/taroyamakatrmttm-star/fmIDE/pull/181), [#182](https://github.com/taroyamakatrmttm-star/fmIDE/pull/182) |
| 6.2 Charts *(to come)* | Columns, Lines, Waterfall; one period for every board | step 15 G2 ([#84](https://github.com/taroyamakatrmttm-star/fmIDE/pull/84)), [#184](https://github.com/taroyamakatrmttm-star/fmIDE/pull/184), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188) |
| 6.3 Boards *(to come)* | Tabs, arranging, colours, a fixed scale, undo, board files, boards in the document | step 15 G3 ([#85](https://github.com/taroyamakatrmttm-star/fmIDE/pull/85)–[#87](https://github.com/taroyamakatrmttm-star/fmIDE/pull/87)), [#133](https://github.com/taroyamakatrmttm-star/fmIDE/pull/133) |
| 6.4 Trace, Biggest movers, and comparing A with B *(to come)* | 🔍 Trace, Biggest movers, 📌 Pin as A | step 15 G4 ([#88](https://github.com/taroyamakatrmttm-star/fmIDE/pull/88), [#89](https://github.com/taroyamakatrmttm-star/fmIDE/pull/89)) |
| 6.5 Named scenarios and the scenario waterfall *(to come)* | + Save as scenario, ▶ Show, A, the scenario waterfall | [#93](https://github.com/taroyamakatrmttm-star/fmIDE/pull/93), [#94](https://github.com/taroyamakatrmttm-star/fmIDE/pull/94) |
| [6.6 Tornado and Spider: which inputs matter most](#tornado-spider) | The two charts, and choosing each input's Low and High | step 18 ([#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146), [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149)) |
| 6.7 Goal seek *(to come)* | The slider value that hits a number | [#187](https://github.com/taroyamakatrmttm-star/fmIDE/pull/187) |
| 6.8 Boards on templates and in the library *(to come)* | Export for a template…, Attach to template…, Try in fmGraph | step 15 G5 ([#90](https://github.com/taroyamakatrmttm-star/fmIDE/pull/90)–[#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92)) |
| 6.9 fmGraph on a phone *(to come)* | The dock, the mixer, Show, Share | step 17 P1 ([#127](https://github.com/taroyamakatrmttm-star/fmIDE/pull/127), [#128](https://github.com/taroyamakatrmttm-star/fmIDE/pull/128)) |

Until the lessons marked *(to come)* are written, fmGraph's Help covers them, and its four tutorials (*Sliders and bars*, *Charts*, *Trace and compare*, *Scenarios*: Help, or 🎓 on fmGraph's first screen) walk through 6.1–6.5 inside the app.

---

<a id="tornado-spider"></a>
## Lesson 6.6 — Tornado and Spider: which inputs matter most

> **Goal:** see, for one output, which inputs move it most, and how each one bends it.
> **You need:** fmIDE and fmGraph. The example model: Price `10` × Quantity `30` = Revenue; Revenue − Costs (`200`) = Profit, which is 100.
> **Time:** about 10 minutes.
> **In the app:** fmGraph Help → *Tornado and Spider: what moves an output most* (`sensitivity`) · fmGraph tutorial *Trace and compare* (`trace-and-compare`, its last two steps)
> **Came in:** step 18, phases A1 and A2 · [#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146), [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149)

Two chart kinds answer the same question: "which inputs matter most for this output?"

- **Tornado:** one horizontal bar per input. Each bar runs from the output's value with that input at its **Low** to its value at its **High**. The input with the biggest swing is at the top, so the shape looks like a tornado.
- **Spider:** one line per input, from Low (left) through today's value (the middle, where all lines cross) to High (right). A straight line means the effect is even; a bent line means it is not.

### Steps

1. In fmIDE, build (or open) the example model and choose **File → Open fmGraph**.
2. On the board, press **+ Chart**.
3. At the top of the new chart, choose **Tornado** in its list. It starts by measuring the first calculated rectangle, with every input that reaches it moved −10% … +10%.
4. Open **Edit chart**. Choose **Profit** as the output, and press **↻** to take every input that reaches it.
5. Choose the **period** the output is read in. (For a Spider, also choose its **Points each side**, 1 to 10; 5 at first.)
6. Each input has a row. Set:
   - the **tick** (*Show in the chart*): untick to keep the input listed but leave it out of the drawing;
   - **%** or **±**: move it by a percent or by an amount;
   - **Low** and **High**, for example −10 and +10.
7. Read the line under each row. It shows Low and High in the input's own numbers, for example *Now 10: 9 … 11 in* the period chosen.
8. Use **+ Input** to add another input, **↑ ↓** to reorder, **×** to remove.

### Check it

| Input | Profit at Low (−10%) | Profit at High (+10%) | Swing |
|---|---|---|---|
| Price | 70 | 130 | 60 |
| Quantity | 70 | 130 | 60 |
| Costs | 120 | 80 | 40 |

Price and Quantity are on top, Costs below. For Costs, High gives the lower Profit: raising costs lowers profit.

Now add a slider for Price (**+ Slider**) and drag it to 8. The chart is measured again around where the sliders stand: Profit is 40, and Price and Quantity now swing it by 48 (16 to 64). Costs still swings it by 40.

### Good to know

- **Measured around now.** The charts are worked out around where the sliders stand. Each input is moved on its own, in every period; the output is read in the one period you chose.
- **% or ±.** −10% takes 100 to 90; −2 takes 100 to 98. Use ± for rates: 0.05 moved by +0.01 is 0.06, one percentage point. An input that is 0 can't move by a percent, and its row says so: switch it to ±.
- **Large models.** The chart shows *Working out…* until the sliders stop moving.
- **Limits:** 50 inputs a chart; Low and High within ±1,000,000,000.
- **In Excel:** a Tornado or Spider becomes a live sensitivity analysis in the workbook, with the same output, period, inputs, Low and High ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).

### From a script

```js
// In fmGraph, with the example model open
const t = fmGraph.addChart({ layout: 'tornado', output: 'Profit', period: 1 });
fmGraph.chart(t).inputs.map(i => [i.name, i.lowValue, i.highValue, i.swing]);
// Price 70 … 130 (swing 60), Quantity the same, Costs 120 … 80 (swing 40,
// give or take the last digits of a computer's arithmetic)
```

---

[← Part 5](05-excelexporter.md) · [Contents](README.md) · [Part 7 →](07-excel-import.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
