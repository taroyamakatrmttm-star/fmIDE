# Part 6 — fmGraph: see how a value moves your model

[← Part 5](05-excelexporter.md) · [Contents](README.md) · [Part 7 →](07-excel-import.md)

fmGraph shows your model as bars and charts, with sliders that change its inputs, so you can see at once what a value moves and by how much. It never changes your model. After this part you can build a board, explore "what if", save scenarios, find which inputs matter most, and take the board to Excel ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).

The numbers in this part were checked against the apps on `main` at pull request #196 (21 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [6.1 Bars and sliders](#bars-sliders) | Open fmGraph, + Bar, + Slider, what a slider reaches, folding sliders, sharing slider positions | step 15 G1 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)), [#142](https://github.com/taroyamakatrmttm-star/fmIDE/pull/142), [#143](https://github.com/taroyamakatrmttm-star/fmIDE/pull/143), [#181](https://github.com/taroyamakatrmttm-star/fmIDE/pull/181), [#182](https://github.com/taroyamakatrmttm-star/fmIDE/pull/182) |
| [6.2 Charts](#graph-charts) | Columns, Lines, Waterfall, Free; one period for every board; the key leaving out rectangles at 0 | step 15 G2 ([#84](https://github.com/taroyamakatrmttm-star/fmIDE/pull/84)), [#184](https://github.com/taroyamakatrmttm-star/fmIDE/pull/184), [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188), branch `claude/fmgraph-free-chart-f1`, branch `claude/fmgraph-key-hides-zeros` |
| [6.3 Boards](#graph-boards) | Tabs, arranging, one colour per rectangle, a fixed scale, one scale for all, full screen, undo, board files, boards in the document | step 15 G3 ([#85](https://github.com/taroyamakatrmttm-star/fmIDE/pull/85)–[#87](https://github.com/taroyamakatrmttm-star/fmIDE/pull/87)), [#133](https://github.com/taroyamakatrmttm-star/fmIDE/pull/133), branch `claude/fmgraph-shared-colours-e9c229`, branch `claude/fmgraph-full-screen` |
| [6.4 Trace, Biggest movers, and comparing A with B](#graph-explore) | 🔍 Trace, Biggest movers, 📌 Pin as A | step 15 G4 ([#88](https://github.com/taroyamakatrmttm-star/fmIDE/pull/88), [#89](https://github.com/taroyamakatrmttm-star/fmIDE/pull/89)) |
| [6.5 Named scenarios and the scenario waterfall](#graph-scenarios) | + Save as scenario, ▶ Show, A, ▶ Play between two scenarios, a GIF of the play, the scenario waterfall | [#93](https://github.com/taroyamakatrmttm-star/fmIDE/pull/93), [#94](https://github.com/taroyamakatrmttm-star/fmIDE/pull/94), branch `claude/fmgraph-play-gif` |
| [6.6 Tornado and Spider: which inputs matter most](#tornado-spider) | The two charts, and choosing each input's Low and High | step 18 ([#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146), [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149)); branch `claude/tornado-remove-all-inputs-655a57` |
| [6.7 Goal seek](#goal-seek) | The slider value that hits a number | [#187](https://github.com/taroyamakatrmttm-star/fmIDE/pull/187) |
| [6.8 Boards on templates and in the library](#boards-templates) | Export for a template…, Attach to template…, Try in fmGraph | step 15 G5 ([#90](https://github.com/taroyamakatrmttm-star/fmIDE/pull/90)–[#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92)) |
| [6.9 fmGraph on a phone](#fmgraph-phone) | The dock, the mixer, Show, Share | step 17 P1 ([#127](https://github.com/taroyamakatrmttm-star/fmIDE/pull/127), [#128](https://github.com/taroyamakatrmttm-star/fmIDE/pull/128)) |


---

<a id="bars-sliders"></a>
## Lesson 6.1 — Bars and sliders

> **Goal:** watch how an input moves the rest of the model.
> **You need:** fmIDE and fmGraph. The example model: on *Canvas 1*, over 3 periods, Price `10` × Quantity `30` = Revenue, and Revenue − Costs (`200`) = Profit, which is 100.
> **Time:** about 5 minutes.
> **In the app:** fmGraph Help → *What fmGraph is* (`what-is-fmgraph`), *Bars* (`bars`), *Sliders* (`sliders`), *What a slider reaches* (`reach`) · fmGraph tutorial *Sliders and bars* (`sliders-and-bars`)
> **Came in:** step 15 G1 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83)); folding sliders [#142](https://github.com/taroyamakatrmttm-star/fmIDE/pull/142); boards sharing slider positions [#143](https://github.com/taroyamakatrmttm-star/fmIDE/pull/143); Range and step staying open [#181](https://github.com/taroyamakatrmttm-star/fmIDE/pull/181); finding a rectangle by typing [#182](https://github.com/taroyamakatrmttm-star/fmIDE/pull/182)

A **bar** shows a rectangle's value in the periods you choose. A **slider** changes an input rectangle. Move a slider and every bar that depends on that input moves with it. fmGraph never changes your model: a slider is a "what if".

### Steps

1. In fmIDE, with the model open, choose **File → Open fmGraph**. fmGraph opens with the model; nothing has to be saved first.
2. A new model starts with a board ready to use: a slider on its first input, **Price** (*Set the number to*, from 0 to 20 in steps of 0.5), and a bar on **Profit**.
3. Drag the Price slider to **12** (or type 12 in the box beside it).
4. **Reset** (on the slider) puts Price back to the model's own 10. **Reset all**, at the top, does every slider.
5. Press **+ Slider** and choose **Costs** in its list (click the list and type part of a name: the best match comes first). Set its kind to **Change it by %** and drag it to −10.

### Check it

At Price 12, the Profit bar shows **160**; a dashed outline keeps the model's own 100, and a label shows the difference, +60. While you point at a slider, the bars it reaches are outlined and the others fade.

### Good to know

- **A slider's settings:** which periods it changes (all, one, or a range), whether it **sets** the number or **changes it by %**, and **Range and step** (where it starts, ends and stops). *Model's number* shows the input's own value.
- **Only inputs** can have a slider: rectangles with no arrow in, or only one from an operator that nothing feeds.
- **Two sliders on one input** apply one after the other.
- **▾** folds a slider to its name, slider and number; **Collapse all** and **Expand all** do every slider. On a wide screen, the Sliders column stays in view as the page scrolls.
- **Boards share slider positions:** move Price on one board, and every board shows its numbers with that price. Untick **Share slider positions with other boards** to give a board its own, marked ◇ on its tab.
- **A bar marked !** couldn't be worked out in that period; the reason is listed under it.
- **After changing the model in fmIDE,** press **↻ From fmIDE** in fmGraph.
- **Large models:** grabbing a slider works out its steps ahead (*Working out this slider's steps…*), so dragging stays smooth.

---

<a id="graph-charts"></a>
## Lesson 6.2 — Charts: columns, lines and waterfalls

> **Goal:** show several rectangles together: a check that two totals agree, a trend, and a bridge from revenue to profit.
> **You need:** the board of [lesson 6.1](#bars-sliders), with Price at 12.
> **Time:** about 10 minutes.
> **In the app:** fmGraph Help → *Charts: columns, lines and waterfalls* (`charts`), *The Free chart: columns and waterfalls together* (`free-chart`), *One period for every board* (`shared-period`) · fmGraph tutorial *Charts* (`charts`)
> **Came in:** step 15 G2 ([#84](https://github.com/taroyamakatrmttm-star/fmIDE/pull/84)); one period for every board [#184](https://github.com/taroyamakatrmttm-star/fmIDE/pull/184); lines charts [#188](https://github.com/taroyamakatrmttm-star/fmIDE/pull/188); the Free chart, branch `claude/fmgraph-free-chart-f1`; the key leaving out rectangles at 0, branch `claude/fmgraph-key-hides-zeros`

**+ Chart** adds a chart; its kind is chosen at its top: **Columns**, **Lines**, **Waterfall**, **Free** (columns and waterfalls together), **Scenario waterfall** ([lesson 6.5](#graph-scenarios)), **Tornado** and **Spider** ([lesson 6.6](#tornado-spider)). Every chart is made of your own rectangles, so it fits any model.

### Steps

1. **Columns.** Press **+ Chart** and choose **Columns** at its top. In **Edit chart**, make two groups: *In*, holding Revenue, and *Out*, holding Costs and Profit (**+ Group** adds a group, **+ Rectangle** a rectangle to it). Tick **Check that the groups' totals agree**.
2. **Waterfall.** Press **+ Chart** again and choose **Waterfall** at its top. In Edit chart, make three steps: Revenue as **Start**, Costs as **Subtract**, Profit as **Total** (**+ Step** adds one).
3. **Lines.** Press **+ Chart** again and choose **Lines**. Add Revenue and Profit.
4. **Free.** Press **+ Chart** again and choose **Free**: the chart's one rectangle becomes its first piece; remove it with **×** in Edit chart. Then, in **+ From chart…**, choose the Columns chart, then the Waterfall: their groups and steps become pieces, side by side on one scale.
5. Move the Price slider and watch all four.

### Check it

| Chart | At Price 12, in period 1 |
|---|---|
| Columns | *In* 360; *Out* 200 + 160 = 360; ✓ (the groups agree) |
| Waterfall | Revenue 360, down 200 for Costs, to Profit 160; ✓ above Profit (the steps add up to it) |
| Lines | Revenue 360 and Profit 160 in every period, with the model's own numbers dashed underneath |
| Free | *In* 360 and *Out* 360 (✓ above *Out*: it equals where *In* ends); Revenue 360, −Costs from 360 down to 160, Profit 160 (✓) |

### Good to know

- **A balance sheet check:** a Columns chart of two groups, Assets and Liabilities and equity, with the check ticked. Each period shows ✓, or ✗ and the gap, also while you move sliders.
- **Values below zero** stack downwards in Columns.
- **Numbers agree** when they differ by less than a millionth of their size, so rounding never shows as ✗. A chart mixing units says so.
- **One period for every board:** above the bars and charts, **Every board** sets the periods for every bar and chart, and **One-period charts in** the period of the waterfalls, Tornado and Spider. A bar or chart follows while its period list shows *Shared (…)*; choose its own period to stop following.
- **Lines** draws up to 12 rectangles. Switching between Columns and Lines keeps the rectangles and the periods.
- **The key lists only the rectangles that aren't 0.** A rectangle that is 0 in every period the chart shows, now and in the dashed outlines, is left out (its bars are still drawn); **+N at 0** at the end of the key lists them too, faded, so you can pick their colours, and **Hide the N at 0** leaves them out again. A slider that makes one something else brings it back; one that can't be worked out is always listed; while Play runs, both its ends count. On the sample nothing is 0, so every key lists all its rectangles.
- **The Free chart** shows one period. Each piece is a stack of rectangles in a column, and **Sits** on zero, on top of another piece, where another piece ends, or at a number. **Minus** turns a piece's sign round (−Costs), **Should equal…** checks it against where another piece ends. Two pieces share a column only when one rests on the other. ExcelExporter's Dashboard does not draw a Free chart yet: Use fmGraph boards… lists it as not carried.

---

<a id="graph-boards"></a>
## Lesson 6.3 — Boards: tabs, arranging, colours, scales and files

> **Goal:** organise several boards, make them readable, and move them between computers.
> **You need:** fmGraph with a board.
> **Time:** about 10 minutes.
> **In the app:** fmGraph Help → *Boards: tabs, arranging, colours, undo* (`boards`), *A fixed vertical scale* (`scale`), *One scale for every bar and chart* (`common-scale`), *Full screen: bars and charts, bigger* (`full-screen`), *Saving and sharing boards* (`board-file`), *What fmGraph remembers* (`board-kept`)
> **Came in:** step 15 G3 · boards [#85](https://github.com/taroyamakatrmttm-star/fmIDE/pull/85); colours shown [#86](https://github.com/taroyamakatrmttm-star/fmIDE/pull/86); boards in fmIDE's document [#87](https://github.com/taroyamakatrmttm-star/fmIDE/pull/87); a fixed scale [#133](https://github.com/taroyamakatrmttm-star/fmIDE/pull/133); one colour per rectangle, branch `claude/fmgraph-shared-colours-e9c229`; one scale for every bar and chart, branch `claude/objective-merkle-f14472`; the colour grid, branch `claude/colour-grid-picker-1c5e83`; full screen, branch `claude/fmgraph-full-screen`; its 🎞 GIF, branch `claude/fmgraph-play-gif`

### Steps

1. **+ Board** adds an empty board as a new tab. **✎** (or a double-click on its tab) renames the board shown; **⧉** duplicates it; **🗑** deletes it after asking (the last board stays).
2. Drag a bar or chart by its handle **⠿** to move it; **⇔** makes it wide (the whole row) or narrow (half).
3. Colours belong to rectangles. Click the colour box beside the Price slider's name: a grid of colours opens under it (**Automatic** first, then greys, twelve colours in six shades, the chart colours and those already in use; **More…** for an exact colour). Choose one: the slider's left edge takes it, and so does every bar and chart showing Price, on every board. A bar's colour box (beside its periods) and a rectangle's swatch in a chart's key change the same colour.
4. On the Profit bar, choose **Fixed scale** (beside its colour). It takes what *Auto* showed, rounded; type other ends if you like. Now move Price: the bar grows and shrinks against the same scale. **📏** fixes it again at what Auto shows now; **Auto scale** goes back.
5. To compare every bar and chart, choose **Scale: Auto for all** above them, beside the shared period. Every bar and chart, on every board, now stands on one range that takes in all their numbers, and moves with the sliders; **Fixed for all** draws them all from the min to the max in its boxes. A bar's scale list now starts with **Shared**: choosing **Auto scale** there keeps that bar on its own. **Each its own** goes back, each keeping the scale it showed.
6. **↶ Undo** (Ctrl+Z) takes back the last change to the boards; **↷ Redo** (Ctrl+Y) brings it back.
7. **Boards ▾ → Export all boards** saves a board file; **Boards ▾ → Import boards…** (or dropping a board file on the page) adds its boards as new tabs.
8. Press **⛶** at the top of the Balance sheet chart: it fills the screen, with nothing else around it. In the strip at the top, tap **Closing cash** to show it too: the two share the screen, side by side. Move the mouse away and wait: after a few seconds the strip fades, leaving only the charts (× stays in the corner). Press **×** or **Esc** to come back.

### Check it

In the sample, the Closing cash bar and Closing cash in the Balance sheet are the same green-blue (#0f766e), and Equipment is blue (#2563eb) in every chart that shows it until you choose another colour. With a fixed scale, a Profit that doubles draws a bar twice as tall. A number past the scale is drawn to its edge with ▲ or ▼, and its label still gives the number itself. On Auto for all, the Profit and Closing cash bars show the same range: the smaller number draws the shorter bar.

### Good to know

- **Where the boards are kept:** in this browser, for each model, and in fmIDE's document when fmGraph was opened from fmIDE. Each change to them goes back to fmIDE and marks the document unsaved; saving there keeps the boards with the model.
- **One colour per rectangle:** a rectangle you haven't coloured takes the chart colours in the order it first appears in a Columns, Lines or Spider chart. A waterfall step keeps its up, down or total colour until you choose one for it; the Tornado's Low and High colours belong to that chart. Choosing **Automatic** at the top of the colour picker goes back to it (one undo step). Boards saved before keep their colours; where two charts disagreed, the first is kept and fmGraph says how many changed.
- **One scale for all:** bars and Columns, Lines, Waterfall and Scenario waterfall charts follow it; the Tornado and the Spider keep their own. It starts on Each its own, so boards saved before look as they did. On a phone there is no Scale choice; the bars and charts follow the one chosen on a larger screen. ExcelExporter's Dashboard charts take the same scale ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).
- **Full screen** uses the browser's own full screen where it can (on an iPad too; an iPhone can't, and the view then covers the page). What it shows follows the sliders and A like the board; **▶ Play** in its strip plays between the ends chosen under Scenarios, and a tap leaves it playing; **🎞 GIF** there makes a GIF of the charts shown, playing ([lesson 6.5](#graph-scenarios)). The back gesture, or leaving the browser's full screen, ends it too. Which bars and charts were shown is not saved.
- **Moving a slider is not a change** to the board: Undo leaves it alone, and a board always opens on the model's own numbers.
- **A board file fits the model it was made from,** or another built from the same templates. Anything it shows that this model hasn't got is left out, and fmGraph says how much.
- **Into Excel:** ExcelExporter rebuilds a board's sliders, charts and scenarios in the workbook ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).

---

<a id="graph-explore"></a>
## Lesson 6.4 — Trace, Biggest movers, and comparing A with B

> **Goal:** find out what reaches a result, what a change moves most, and how two what-ifs differ.
> **You need:** the board of [lesson 6.1](#bars-sliders).
> **Time:** about 10 minutes.
> **In the app:** fmGraph Help → *Trace and Biggest movers* (`explore`), *Comparing two what-ifs (A and B)* (`compare`) · fmGraph tutorial *Trace and compare* (`trace-and-compare`)
> **Came in:** step 15 G4 · Trace and Biggest movers [#88](https://github.com/taroyamakatrmttm-star/fmIDE/pull/88); A and B, and gliding bars [#89](https://github.com/taroyamakatrmttm-star/fmIDE/pull/89)

### Steps

1. **Trace.** Press **🔍** on the Profit bar. A note opens: *What reaches this*.
2. Read the way each slider gets there, and the inputs that reach Profit but have no slider yet, each with **+ Slider**. Press 🔍 again, × on the note, or Esc to stop.
3. **Biggest movers.** Move Price, then open **Biggest movers** under the sliders: the rectangles your sliders change most, from the whole model, biggest change in % first.
4. **A and B.** Set Price to 12 and press **📌 Pin as A**. Now set Price to 8. The outlines and difference labels compare with A, not with the model.
5. **⇄ Swap** puts the sliders where A had them and keeps the current ones as the new A. **Unpin** goes back to comparing with the model's own numbers.

### Check it

The trace note reads **Price → Revenue → Profit**, and lists **Quantity** and **Costs** under *Inputs that reach it, with no slider*. With A pinned at Price 12, Price 8 shows Profit 40, and the outline and label now measure from A's 160 instead of the model's 100. The strip above the board says what A is.

### Good to know

- **A bar that is reached but doesn't move** tells you something too, such as an `if` that ignores that input. A rectangle you expected in Biggest movers but isn't there often points at a missing or wrong arrow.
- **A is not saved,** like slider positions. To keep a what-if, save it as a scenario ([lesson 6.5](#graph-scenarios)).
- **Bars glide** to their new heights when values change, except while you drag a slider, or when your device is set to reduce motion.

---

<a id="graph-scenarios"></a>
## Lesson 6.5 — Named scenarios and the scenario waterfall

> **Goal:** save what-ifs under names, switch between them, and show how each one changes a result.
> **You need:** the board of [lesson 6.1](#bars-sliders).
> **Time:** about 12 minutes.
> **In the app:** fmGraph Help → *Named scenarios* (`scenarios`), *Charts: columns, lines and waterfalls* (`charts`), *Full screen: bars and charts, bigger* (`full-screen`) · fmGraph tutorial *Scenarios* (`scenarios`)
> **Came in:** named scenarios, S1 ([#93](https://github.com/taroyamakatrmttm-star/fmIDE/pull/93)); the scenario waterfall, S2 ([#94](https://github.com/taroyamakatrmttm-star/fmIDE/pull/94)); Play (branch `claude/fmgraph-play-scenarios`, 27 October 2026); Play keeping going while you scroll or switch boards (branch `claude/fmgraph-play-keeps-going`, 27 October 2026); a GIF of the play (branch `claude/fmgraph-play-gif`, 27 October 2026)

### Steps

1. Set Price to **8** and press **+ Save as scenario** in the **Scenarios** panel under the sliders. It is named *sc01*; type `Low price` in its box.
2. Set Price to **12** and save again: `High price`.
3. Press **▶** on *Low price*: the sliders go where it had them. The scenario the sliders match is marked.
4. Press **Reset all**. Press **+ Chart** and choose **Scenario waterfall**. In Edit chart, choose **Profit** as its output.
5. Under the scenarios, set **Play from** to *Low price* and **to** to *High price*, and press **▶ Play**. Price swings from 8 to 12 and back, like a pendulum, pausing at each end; the Profit bar follows, and its dashed outline marks *Low price*. Press **Esc**: everything is as it was before.
6. Press **🎞** at the top of the Profit bar. "Making the GIF…" counts up for a few seconds, then the GIF downloads as *fmGraph-Profit.gif* (on an iPad or a phone, the share sheet opens instead). Open it: Price swings from 8 to 12 and back, pausing at each end, again and again.

### Check it

| Step | Profit |
|---|---|
| Start (the model's own number) | 100 |
| Low price | −60, to 40 |
| High price | +120, to 160 |
| End | 160 |

### Good to know

- **A** on a scenario compares with it, as 📌 Pin as A does ([lesson 6.4](#graph-explore)). **⟳** keeps where the sliders are now in that scenario; **↑ ↓** reorder; **×** deletes.
- **A scenario keeps the inputs it changed,** whatever board it was saved on. If one has no slider on the board you're looking at, fmGraph says so.
- **▶ Play** can swing between any two ends: a scenario, the model's own numbers or the sliders now. Every number the two ends set differently moves together, slower near the ends. It keeps playing while you scroll, tap, open a panel or switch boards (the board shown follows it). **■ Stop** or **Esc** stops it, and so does moving a slider yourself; it changes no slider and saves nothing. With reduced motion turned on in your device's settings nothing swings: the board shows the second end against the first, and **⇄** steps between them.
- **A GIF of the play** (🎞 on a bar or chart, or **🎞 GIF** in the full screen for every chart shown there, side by side) is one swing there and back, about 15 frames a second, each end held 0.6 s, 720 pixels wide, repeating for ever — for an email, a chat or a slide. **Cancel** on its progress strip stops it; if Play is running, the GIF uses its ends and the play stops. A GIF may be up to 10 MB (two charts come to about 0.3 MB); over that, fmGraph says so. Nothing is saved with the board.
- **Up to 50 scenarios** a model. They are kept with the boards, in fmIDE's document and in **Export all boards**; saving, renaming and deleting them can be undone.
- **A scenario waterfall** follows the scenarios as you update, reorder or rename them. Edit chart chooses the period, up to six outputs, and which scenarios it goes through.
- **In Excel,** the scenarios become Global Cases ([lesson 5.11](05-excelexporter.md#fmgraph-in-excel)).

---

<a id="tornado-spider"></a>
## Lesson 6.6 — Tornado and Spider: which inputs matter most

> **Goal:** see, for one output, which inputs move it most, and how each one bends it.
> **You need:** fmIDE and fmGraph. The example model: Price `10` × Quantity `30` = Revenue; Revenue − Costs (`200`) = Profit, which is 100.
> **Time:** about 10 minutes.
> **In the app:** fmGraph Help → *Tornado and Spider: what moves an output most* (`sensitivity`) · fmGraph tutorial *Trace and compare* (`trace-and-compare`, its last two steps)
> **Came in:** step 18, phases A1 and A2 · [#146](https://github.com/taroyamakatrmttm-star/fmIDE/pull/146), [#149](https://github.com/taroyamakatrmttm-star/fmIDE/pull/149); × Remove all inputs, branch `claude/tornado-remove-all-inputs-655a57`

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
8. Use **+ Input** to add another input, **↑ ↓** to reorder, **×** to remove. To keep only a few of many inputs, press **× Remove all inputs**: the list empties in one step, and the chart says *No inputs yet: in Edit chart, + Input adds one, or ↻ takes the 3 that reach Profit.* Then press **+ Input** for each one you want and choose it in its list. **Undo** (or **↻**) brings them all back.

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

<a id="goal-seek"></a>
## Lesson 6.7 — Goal seek

> **Goal:** find the value of an input that makes a result hit a number, such as the price at which profit is zero.
> **You need:** the board of [lesson 6.1](#bars-sliders), with its Price slider.
> **Time:** about 3 minutes.
> **In the app:** fmGraph Help → *Goal seek* (`goal-seek`)
> **Came in:** [#187](https://github.com/taroyamakatrmttm-star/fmIDE/pull/187)

### Steps

1. Open **Goal seek** under the sliders. It reads *Set [rectangle] in [period] to [number] by changing [slider]*.
2. Choose **Profit** and **Period 1**, type `0`, and choose the **Price** slider.
3. Press **Seek** (or Enter in the number box).

### Check it

It says **Price 6.667 makes Profit in Period 1 equal 0.**, and puts the Price slider there (200 ÷ 30 = 6.667).

### Good to know

- **Only that slider changes,** with the others where they are. A slider that changes by % is solved for its % change.
- **Outside the range:** it looks through the slider's range first, then further out. An answer outside the range widens the range to take it in (its step stays), which is a change to the board that Undo takes back.
- **Several answers:** it takes the one nearest where the slider stands.
- **No answer:** it says what the rectangle stays between, and the slider stays put. Values the model can't work out (dividing by zero) are skipped. On a large model it stops after 400 tries or 3 seconds and says so.
- **Not kept** with the board, and not on the phone layout.

---

<a id="boards-templates"></a>
## Lesson 6.8 — Boards on templates and in the library

> **Goal:** give a template a board, so everyone who uses the template gets it, and try the boards other people shared.
> **You need:** fmGraph opened from fmIDE, with a model that has a canvas made from a template ([lesson 3.1](03-reuse.md#templates)).
> **Time:** about 5 minutes.
> **In the app:** fmGraph Help → *Saving and sharing boards* (`board-file`), *Sharing a board with everyone (the community library)* (`share-library`)
> **Came in:** step 15 G5 · boards on templates [#90](https://github.com/taroyamakatrmttm-star/fmIDE/pull/90); fmGraph using templates' boards [#91](https://github.com/taroyamakatrmttm-star/fmIDE/pull/91); Try in fmGraph [#92](https://github.com/taroyamakatrmttm-star/fmIDE/pull/92)

### Steps

1. Set up a board for the canvas made from the template.
2. **Boards ▾ → Attach to template…**, choose the template, and say **Attach** when fmIDE asks.
3. In fmIDE, the template now carries the board. Save the document.

### Check it

The next model with a canvas from that template, opened in fmGraph with no boards of its own, starts with that board.

### Good to know

- **A canvas template's board** shows only its own canvas; a **system template's**, the whole model.
- **With a file instead:** **Boards ▾ → Export for a template…** saves the board in the template's form; in fmIDE's Templates window, select the template and choose **📈 Attach fmGraph board…**.
- **Names, not ids:** a template's board names rectangles by name (and canvas name), since a template gets new ids each time it is used. A name used twice on its canvas is left out, and fmGraph says how many.
- **Boards ▾ → Add boards from templates…** lists the boards the model's templates carry, with how many of their rectangles this model has, and adds the ones you tick.
- **Sharing with everyone:** attach the board to its template, then share the template in a library pack ([lessons 3.10](03-reuse.md#library-packs) and [3.12](03-reuse.md#share-library)). In Browse Library, people then see **📈 Try in fmGraph** beside your template.
- **A template's board leaves out** what belongs to one model: scenarios, the scenario waterfall, Tornado and Spider, lines charts, fixed scales and folding.

---

<a id="fmgraph-phone"></a>
## Lesson 6.9 — fmGraph on a phone

> **Goal:** explore a model with your thumbs, and show it to someone.
> **You need:** fmGraph on a phone (from fmIDE's **More (☰) → 📈 Open fmGraph**, or a file).
> **Time:** about 5 minutes.
> **In the app:** fmGraph Help → *fmGraph on a phone* (`phone`)
> **Came in:** step 17 P1 · the phone layout and dock [#127](https://github.com/taroyamakatrmttm-star/fmIDE/pull/127); the mixer, Show, holding A, Share [#128](https://github.com/taroyamakatrmttm-star/fmIDE/pull/128)

On a phone the bars and charts fill the screen, and the sliders sit in a **dock** along the bottom, one at a time, large.

### Steps

1. Drag the slider in the dock. It moves from where it is, never jumping to your finger.
2. To set it exactly, slide your finger **up**, away from the slider, while you drag: the higher, the finer (×½, ×¼, ×⅒). Come back down for big moves without letting go.
3. Swipe along the dock for the next slider; tap its handle to see them all; draw it down to get it out of the way.
4. **Hold a bar** for a quick look: its value in every period, now against the model's own numbers, with 🔍 Trace and ⤢ Show.
5. Turn the phone **sideways** for the **mixer**: the sliders stand up as faders at the two edges, under your thumbs. Move two at once.

### Check it

The slider settles with a tick at the model's own number when you pass close to it. Double-tap the slider to go back to that number.

### Good to know

- **Tap the number** to type one; **− and +** step it (hold them to keep going).
- **Swipe across the bars,** or use ‹ and ›, for the next board.
- **⤢ Show** puts the bar or chart on the whole screen and keeps the screen on, for showing someone; tap another's name at the top to show it too ([lesson 6.3](#graph-boards)). ×, Esc or the back gesture ends it.
- **Scenarios are cards:** swipe through them; ▶ shows one. Hold a card's **A** to look at that scenario while your finger stays down.
- **⇪ Share** sends a picture of the chart or the whole board, or the board file, through your phone's share sheet. The picture is drawn on your phone; nothing is sent until you choose where.
- **Building boards** (adding bars, charts and sliders), goal seek and the tutorials stay on a tablet or computer, or **☰ → Full app**.

---

[← Part 5](05-excelexporter.md) · [Contents](README.md) · [Part 7 →](07-excel-import.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
