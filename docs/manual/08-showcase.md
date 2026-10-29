# Part 8 — Sharing a model: showcase viewers

[← Part 7](07-excel-import.md) · [Contents](README.md)

A **showcase viewer** is one web page made from your model. Anyone can open it in a browser — from an email, a disk or a USB stick — with nothing installed and nothing sent anywhere. They see your canvases read-only and, on the Board, move the sliders you set up in fmGraph. They can play with the model; they can't change it. The page itself is the app called **fmShowcase**. The background and design are in [`docs/viewer-brief.md`](../viewer-brief.md).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [8.1 Make a showcase viewer](#showcase-viewer) | File → Make Showcase Viewer…, what goes into the file, making it again | the showcase viewer's phases V1–V3 (branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`) |
| [8.2 Put Excel in a showcase viewer](#showcase-excel) | Include an Excel workbook; a visitor's ⬇ Excel, with their scenario or sliders written in | phase V4 (branch `claude/viewer-v4`) |

Making many viewers at once and a gallery of them on the website come later.

---

<a id="showcase-viewer"></a>
## Lesson 8.1 — Make a showcase viewer

> **Goal:** turn a model and its fmGraph board into one web page someone else can open and play with.
> **You need:** fmIDE, and a model with an fmGraph board: the sample `tests/fixtures/viewer/every-widget.fmide` has two boards and two scenarios.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phases V1–V3 · branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`

You choose what the visitor sees; fmIDE writes the page. Your choices stay in the document, so making the viewer again after a change takes one click.

### Steps

1. In fmIDE, **File → Open…** and pick `every-widget.fmide`.
2. Choose **File → Make Showcase Viewer…** (the File tab's App group, after Open fmGraph). A window titled *Make a showcase viewer* opens.
3. Type a **Title**, such as `Prices and cash`. The **File name** below follows it: `prices-and-cash`, with `.html`.
4. Fill in **Description**, **Author** and **Licence** if you like (the licence says how visitors may reuse the model, for example `CC BY 4.0`).
5. Under **Canvases the visitor sees**, untick **Checks**. Set **Opens on** to **Cash**.
6. Set **Periods shown** from **Year 2** to **Year 3**.
7. Under **Boards (from fmGraph)**, untick **Own sliders**. Set **Play starts with** from **Base** to **Big year**. Untick **Include an Excel workbook** for now: lesson 8.2 adds it.
8. Press **Make viewer**. fmIDE downloads `prices-and-cash.html` (on an iPhone or iPad, the share sheet opens) and says *Made prices-and-cash.html (… KB). It opens in any browser, offline, and changes nothing in your model.*
9. Open the file in your browser. On the **Board**, move the **Price** slider to 12. Then choose **Logic**, the **Profit** tab, and tap **Revenue**.

### Check it

- The page opens on the Board, with the board **Everything** only, and the tabs **Profit**, **Cash** and **Balance sheet** in the Logic view (no Checks).
- The canvas shows the numbers of **Year 2**, and a rectangle's card shows Year 2 and Year 3.
- With Price at 12, Revenue in Year 2 is **13,200** (12 × 1,100); at the model's own Price of 10 it is 11,000.
- The file is about 500 KB.
- Back in fmIDE, the document's name in the window's title has a **•**: your choices are now part of the document. **File → Save** keeps them.

### Good to know

- **Making it again** (**File → Make Showcase Viewer…** after you change the model) starts from every choice you made. A canvas or board you added since comes unticked; one you deleted is left out, and the window says so.
- **Hiding is not secrecy.** Everything in the model goes into the file, shown or not: someone determined can read every canvas and number. Don't share a confidential model this way.
- **No boards yet?** The window says the viewer will show the model's logic only, and offers **Open fmGraph to make one**. A board you make there appears in the open window.
- **What the visitor changes stays on their own device.** Opening the file again shows the same sliders; **Reset** puts the model's own numbers back.
- **Opened in fmIDE by mistake**, a made viewer says *That is a showcase viewer, a web page: open it in your browser, not in fmIDE.*
- **fmShowcase on its own** (`apps/fmViewer.html`) also opens a `.fmide` document dropped on it: a document whose viewer you made opens as that viewer.
- The browser must be a current Chrome, Edge, Firefox or Safari; an older one says it can't make a viewer.

### From a script

```js
const made = await fm.makeShowcaseViewer({ title: 'Prices and cash', canvases: ['cProfit', 'cCash', 'cBS'], start: 'cCash',
  periods: { from: 1, to: 2 }, boards: [0], play: { from: 'Base', to: 'Big year' }, download: true });
made.fileName;   // "prices-and-cash.html"
fm.showcase();   // the choices the document now keeps
```

It answers later (a Promise), so it can't be a macro step.

---

<a id="showcase-excel"></a>
## Lesson 8.2 — Put Excel in a showcase viewer

> **Goal:** a viewer whose visitors can download the model in Excel, on the numbers they are looking at.
> **You need:** fmIDE and ExcelExporter side by side (the same folder, or the website), and the viewer from lesson 8.1.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phase V4 · branch `claude/viewer-v4`

ExcelExporter makes the workbook once, when you make the viewer; it goes inside the page. When a visitor presses ⬇ Excel, the viewer types their scenario or sliders into the workbook's input cells, and Excel works everything out when the file opens.

### Steps

1. With `every-widget.fmide` open, choose **File → Make Showcase Viewer…**. Your choices from lesson 8.1 are there.
2. Tick **Include an Excel workbook**. **Workbook name** says `Prices and cash.xlsx`.
3. Press **Make viewer**. ExcelExporter opens for a moment, makes the workbook and closes again. fmIDE downloads `prices-and-cash.html` and says it was made *with its Excel workbook*.
4. Open the file in your browser. Beside **⬇ Excel** at the top, the line says *The model's own numbers*.
5. Tap the scenario **High price**. The line says *Scenario: High price*. Press **⬇ Excel**: you get `Prices and cash – High price.xlsx`. Open it in Excel.
6. Back in the viewer, tap **Base**, move **Price** to 13 and **Volume** to +10%. The line says *Price set to 13, Volume +10%*. Press **⬇ Excel** again: `Prices and cash – my sliders.xlsx`. Open it in Excel.

### Check it

- In `… – High price.xlsx`, the **Scenarios** tab's C2 is **2** and D2 says **High price**. On the **Profit** tab, Profit in the second period column (the model's Year 2) is **5,200**, and Revenue **14,300** — as the viewer shows them.
- In `… – my sliders.xlsx`, C2 is **1** (Base). On the **Dashboard**, Price's **Typed** is **13** with **Use** TRUE, and Volume's Typed is **10**. Profit in Year 2 is **5,970** (Revenue 13 × 1,210 = 15,730, less cost of sales 7,260 and overheads 2,500).
- Your own layout in ExcelExporter is as it was: its ⬇ Generate still writes the workbook you had before.

### Good to know

- **A scenario then a slider**: a scenario shown exactly is written as its Global Case. Once you move a slider, the viewer shows the model's own numbers with your sliders, and the workbook is written the same way — so a scenario's changes to inputs without a slider are not in it.
- **What the workbook holds** is what ExcelExporter's **Layout → Use fmGraph boards…** would make from the viewer's boards: every scenario a Global Case, every slider a row on the Dashboard, the first board's bars and charts as Excel charts. A slider it can't hold (inside a block, for example) is named in the line beside ⬇ Excel.
- **On an iPhone or iPad**, ⬇ Excel opens the share sheet. The Dashboard's scroll bars don't show in Excel there; its Typed cells work.
- **In an iPhone's or iPad's home-screen app** ExcelExporter can't open beside fmIDE, so the box is off: make the viewer in Safari or on a computer.
- **While Play runs**, ⬇ Excel waits: stop Play first.
- The workbook adds about 10–30 KB to a small model's viewer.

### From a script

```js
const made = await fm.makeShowcaseViewer({ excel: { file: 'Prices and cash.xlsx' }, download: true });
made.excel;   // { file, bytes, notes }: what ExcelExporter made
```

In the viewer, `fmViewer.excelPlan()` says which cells ⬇ Excel would write, and `fmViewer.excelBytes()` gives the file without downloading it.

---

[← Part 7](07-excel-import.md) · [Contents](README.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
