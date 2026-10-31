# Part 8 — Sharing a model: showcase viewers

[← Part 7](07-excel-import.md) · [Contents](README.md)

A **showcase viewer** is one web page made from your model. Anyone can open it in a browser — from an email, a disk or a USB stick — with nothing installed and nothing sent anywhere. They see your canvases read-only and, on the Board, move the sliders you set up in fmGraph. They can play with the model; they can't change it. The page itself is the app called **fmShowcase**. The background and design are in [`docs/viewer-brief.md`](../viewer-brief.md).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [8.1 Make a showcase viewer](#showcase-viewer) | File → Make Showcase Viewer…, what goes into the file, making it again | the showcase viewer's phases V1–V3 (branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`), opening one on an iPhone or iPad (`claude/viewer-ipad-sliders`) |
| [8.2 Put Excel in a showcase viewer](#showcase-excel) | Include an Excel workbook; a visitor's ⬇ Excel, with their scenario or sliders written in | phase V4 (branch `claude/viewer-v4`) |
| [8.3 Make many viewers at once](#showcase-many) | Choose for me; `npm run make-viewers` with a recipe naming sliders and bars by name; the report | phase V5 (branch `claude/viewer-v5`) |
| [8.4 Share viewers in the gallery](#showcase-gallery) | `--pictures` and `--gallery`, `gallery.json`, the site's `/gallery`, sending a link to an iPhone or iPad | phase V6 (branch `claude/viewer-v6`) |
| [8.5 Simplify a model for a lesson](#simplify) | File → Simplify for Inputs…: a copy holding only what some inputs move, fixed numbers, Keep anyway | Simplify for inputs, phase 1 (branch `claude/simplify-to-sliders-5cfd71`) |


---

<a id="showcase-viewer"></a>
## Lesson 8.1 — Make a showcase viewer

> **Goal:** turn a model and its fmGraph board into one web page someone else can open and play with.
> **You need:** fmIDE, and a model with an fmGraph board: the sample `tests/fixtures/viewer/every-widget.fmide` has two boards and two scenarios.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phases V1–V3 · branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`, `claude/viewer-ipad-sliders`, `claude/showcase-canvases-select-all`, `claude/slider-fullscreen-min-0c2e3f`

You choose what the visitor sees; fmIDE writes the page. Your choices stay in the document, so making the viewer again after a change takes one click.

### Steps

1. In fmIDE, **File → Open…** and pick `every-widget.fmide`.
2. Choose **File → Make Showcase Viewer…** (the File tab's App group, after Open fmGraph). A window titled *Make a showcase viewer* opens.
3. Type a **Title**, such as `Prices and cash`. The **File name** below follows it: `prices-and-cash`, with `.html`.
4. Fill in **Description**, **Author** and **Licence** if you like (the licence says how visitors may reuse the model, for example `CC BY 4.0`).
5. Under **Canvases the visitor sees**, untick **Checks**. Set **Opens on** to **Cash**. (With many canvases, **Unselect all** and then ticking the few you want is quicker; **Select all** ticks every one again.)
6. Set **Periods shown** from **Year 2** to **Year 3**.
7. Under **Boards (from fmGraph)**, untick **Own sliders**. Set **Play starts with** from **Base** to **Big year**. Untick **Include an Excel workbook** for now: lesson 8.2 adds it.
8. Press **Make viewer**. fmIDE downloads `prices-and-cash.html` (on an iPhone or iPad, the share sheet opens) and says *Made prices-and-cash.html (… KB). It opens in any browser, offline, and changes nothing in your model.*
9. Open the file in your browser (on an iPhone or iPad, see *Good to know*). On the **Board**, move the **Price** slider to 12. Press **⛶** at the top of the **Balance sheet** chart: it fills the screen. Press **🎚 Sliders**: the four sliders appear beside it. Move **Price** there, then press **×**. Then choose **Logic**, the **Profit** tab, and tap **Revenue**.

### Check it

- Each slider is one short row: its name, the slider and its number. The list of sliders scrolls on its own; the bars and charts stay where they are.
- The page opens on the Board, with the board **Everything** only, and the tabs **Profit**, **Cash** and **Balance sheet** in the Logic view (no Checks).
- The canvas shows the numbers of **Year 2**, and a rectangle's card shows Year 2 and Year 3.
- With Price at 12, Revenue in Year 2 is **13,200** (12 × 1,100); at the model's own Price of 10 it is 11,000.
- The file is about 500 KB.
- Back in fmIDE, the document's name in the window's title has a **•**: your choices are now part of the document. **File → Save** keeps them.

### Good to know

- **Making it again** (**File → Make Showcase Viewer…** after you change the model) starts from every choice you made. A canvas or board you added since comes unticked; one you deleted is left out, and the window says so.
- **Hiding is not secrecy.** Everything in the model goes into the file, shown or not: someone determined can read every canvas and number. Don't share a confidential model this way.
- **No boards yet?** The window says the viewer will show the model's logic only, and offers **Open fmGraph to make one**. A board you make there appears in the open window.
- **Full screen** (⛶ on a bar or chart) is for showing the model to a room: the names at the top add other bars and charts, **▶ Play** plays, and **🎚 Sliders** shows the sliders beside it (at the foot on a screen taller than wide). A slider moved there is the Board's own. The device remembers whether the sliders are shown; on a phone they are shown at first.
- **What the visitor changes stays on their own device.** Opening the file again shows the same sliders; **Reset** puts the model's own numbers back.
- **On an iPhone or iPad**, a viewer saved in Files opens only in a preview, which can't run it. To open one there: in Safari, go to https://fmide.pages.dev/fmViewer, tap **Choose**, and pick the file. It opens just as it does on a computer; only the model and showcase inside it are read, and a page that isn't a made viewer is refused with *That page isn't a viewer made by fmIDE (File → Make Showcase Viewer…), so fmShowcase can't open it.*
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

<a id="showcase-many"></a>
## Lesson 8.3 — Make many viewers at once

> **Goal:** a viewer for every model in a folder, each showing the same sliders and bars, with its workbook — and a model with no board given one chosen for it.
> **You need:** a computer with the fmIDE repository and its test tooling (`npm install`), and the three shop models in `tests/fixtures/viewer/batch/`.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phase V5 · branches `claude/viewer-v5`, `claude/choose-for-me-empty-boards`

A **recipe** is a showcase for many models: it names canvases, sliders and bars **by name**, never by id, so one recipe fits every model built the same way. The command `npm run make-viewers` reads each model, places the recipe's boards in it, has ExcelExporter make its workbook (in a browser without a window), and writes a viewer per model and a report.

### Steps

1. In fmIDE, open `shop-a.fmide` (it has no fmGraph board) and choose **File → Make Showcase Viewer…**. Under **Boards**, press **Choose for me**. A board **Chosen for me** appears, ticked, and the line says *Chosen for me: 3 sliders (Price, Volume, Unit cost) and 1 bar (Margin).* Close the window without making a viewer. (Choose for me is there for any model: a board with nothing on it — fmGraph's first board, never filled — counts as none and is replaced; beside boards that show something, it adds one more, *Chosen for me 2* if the name is taken.)
2. Open a terminal in the repository's folder and run:
   `npm run make-viewers -- --out out/shops --recipe tests/fixtures/viewer/batch/shops.recipe.json tests/fixtures/viewer/batch/shop-*.fmide`
3. It says *3 viewers made in … (3 with notes: see report.txt)* and how big they are in all.
4. Open `out/shops/report.txt`. Each model has its file, what it shows and its workbook. Under `shop-c.fmide` it says *Not found: Volume (on Shop) — left out*: that model calls it Units.
5. Open `out/shops/shop-a-the-shop.html` in your browser. Its Board has the sliders **Price** and **Volume**, the bars **Profit** and **Margin** and the chart *Revenue and costs*.
6. Move **Price** to 13 and press **⬇ Excel**.

### Check it

- In the viewer, **Profit** in 2025 is **400** before you move anything (10 × 100 − 100 × 6) and **700** with Price at 13.
- In `shop-a workbook – my sliders.xlsx`, Profit on the **Shop** tab, in 2025, is **700**.
- `shop-c`'s viewer has only the Price slider; its report line says why.

### Good to know

- **Where each viewer's choices come from**: a recipe given, for every model; without one, the document's own showcase (kept by Make Showcase Viewer…), else its fmGraph boards, else — with `--auto` — sliders and bars chosen for it, as Choose for me does; else the logic only. Boards with nothing on them count as none, so `--auto` chooses for them too.
- **`--auto`** puts a slider on each input that moves a calculated rectangle (a number the same in every period gets a slider from half to one and a half times it; numbers that change by period get a change by %), and a bar on each result — a calculated rectangle nothing else reads — at most 12 of each.
- **`--write-recipe FILE`** writes a recipe from the first viewer's boards, by name: make one viewer the way you like, write its recipe, adjust it, and use it for the rest.
- **`--no-excel`** makes the viewers without workbooks, in a fraction of a second and with no browser; **`--excel-style FILE`** gives every workbook your Excel style (ExcelExporter's *Export Excel Style*).
- A recipe's `title` and `excel.file` may use `{model}`, the model's file name. Two viewers of the same title get `-2`, `-3`… on their file names.
- A small model's viewer is about 570 KB, workbook included; 100 of them took about a minute on the owner's computer and came to about 55 MB.

### From a script

The command's own work is `tools/viewer-batch.js` (`makeViewers`, `reportText`, `recipeFrom`), usable from Node. In fmIDE, `fm.showcaseChooseForMe()` does what Choose for me does and returns what it chose, by name.

---

<a id="showcase-gallery"></a>
## Lesson 8.4 — Share viewers in the gallery

> **Goal:** viewers on the website, in a gallery, opened from a link — the way to share them with someone on an iPhone or iPad.
> **You need:** a computer with the fmIDE repository, the viewers from lesson 8.3, and the right to publish the site (`npm run deploy`).
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phase V6 · branch `claude/viewer-v6`

On an iPhone or iPad, a viewer saved in Files opens only in a preview, which can't run it. A viewer **on the website** is just a link: tapped, it runs in Safari with everything working, ⬇ Excel included. The gallery is a page of such viewers, built with the site from a folder of made viewers.

### Steps

1. Make the viewers with pictures, straight into a gallery folder:
   `npm run make-viewers -- --out out/shops --recipe tests/fixtures/viewer/batch/shops.recipe.json --pictures --gallery gallery tests/fixtures/viewer/batch/shop-*.fmide`
2. Optionally, put a `gallery.json` in the folder: the gallery's title, a line of introduction and its sections (see `tests/fixtures/viewer/gallery/gallery.json`). Without one, the viewers are listed by title.
3. Build the site and look at it on your computer: `npm run build`, then `npm run serve`, and open `http://localhost:8080/gallery/`.
4. Click **Open** on *shop-a: the shop*. The viewer opens at `/gallery/v/shop-a-the-shop`, with **← Gallery** at the top.
5. When it looks right, publish: `npm run deploy`. Send someone the address `https://fmide.pages.dev/gallery/v/shop-a-the-shop`.

### Check it

- The gallery page shows three cards, each with its picture, title, author, licence and size, and **Open** and **Download**.
- In the viewer, **Profit** in 2025 is **400**, as in lesson 8.3: the gallery's viewer is the same model.
- On an iPhone or iPad, the link opens the viewer in Safari; **⇪ Share link** at the top hands its address to the share sheet.

### Good to know

- **Every viewer in the gallery runs today's viewer.** The build reads only the model, the showcase and the workbook out of each file and puts them into the viewer the site serves, so a viewer made months ago gets every fix — and nothing else in the file is ever served.
- **Nothing is sent anywhere, and nothing loads from another site.** The gallery page runs no script at all; each viewer runs only the viewer's own code and may connect to nothing (the site's security policy says so).
- **The gallery's folder**: `npm run build` and `npm run deploy` take `gallery/` in the repository when it holds any viewer, or another folder with `--gallery DIR`. It is meant to be a repository of its own, added as a submodule, like the community library.
- A gallery viewer remembers what a visitor moved on their device, as any viewer does. A new viewer in the gallery never makes fmIDE's site a new version.
- **Hiding is not secrecy**, here as anywhere: every number of a model in the gallery can be read by anyone. Publish only what may be public.

### From a script

`tools/build-gallery.js` (`buildGallery(folder, viewerPage)`) is what the build uses; in a gallery viewer, `fmViewer.inGallery()` is true.

<a id="simplify"></a>
## Lesson 8.5 — Simplify a model for a lesson

> **Goal:** make a copy of a model that holds only what some inputs move, for a lesson that should show just the calculations it teaches.
> **You need:** fmIDE and the sample `tests/fixtures/simplify/profit-plan.fmide`.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Simplify a model for some inputs* (`simplify`)
> **Came in:** Simplify for inputs, phase 1 · branch `claude/simplify-to-sliders-5cfd71`

A course built step by step starts with simple transactions and adds more on top. Each lesson's viewer, and the Excel workbook it carries, should hold only what that lesson has taught. **Simplify for Inputs…** makes such a copy from the full model: you choose the inputs a lesson moves, and a range for each; everything those inputs can't move goes.

### Steps

1. Open the sample: **File → Open…** and pick `tests/fixtures/simplify/profit-plan.fmide`. Its **Sales** canvas works out **Profit** = Units × Price − Costs, and Costs = Fixed cost + Overhead. Its **Notes** canvas holds one rectangle nothing reads.
2. Open **File → Simplify for Inputs…**.
3. In **+ Add an input…**, choose **Sales · Units**. Type **0** in *from*, **10** in *to* and **1** in *step*; leave **All periods**.
4. Press **Work out**.
5. Read the list: under *Kept as fixed numbers*, **Costs** and **Price**; under *Removed*, **Fixed cost**, **Overhead** and the **+** on Sales, and **Unrelated** on Notes, each "never moved across 11 runs".
6. Press **Open the copy**.

### Check it

- The summary says **Keeps 7 of 11 items on 1 of 2 canvases · 2 fixed numbers · 0 zeros dropped · 11 runs** and ends with **checked**.
- The copy is called **profit-plan (simplified)**, unsaved, with one canvas, **Sales**: Units **4** and Price **10** into ×, Revenue **40**, Costs **7** (now a typed number), Profit **33**. Type **10** in Units: Profit is **93**, as in the full model.
- A note at the bottom says **Simplified from “profit-plan” for Units (0 to 10)** and that its 2 fixed numbers are right only while the other inputs stay as they were. **What was removed…** lists what went.
- The sample file itself is unchanged.

### Good to know

- **How it decides.** It works the model out at every step of each input, the others at today's numbers; with two inputs or more, also at the corners (each at its smallest or largest together) and 200 random combinations. What gives the same number (within rounding) in every run, in every period, never moves.
- **What stays as a fixed number.** Something kept that reads something that never moves reads a fixed number instead, in the same place. An input stays as it is. A 0 in every period is dropped from a + (or from a − after its first input), so a "+ 0" goes. A × by a fixed −1 feeding the second input of a + or − is folded into it: the + becomes −.
- **What always stays.** A period shift a kept item reads (what it reads is fixed instead); anything with an error in some period; a block that moves, with its whole definition.
- **Keep anyway.** Tick an item, or a whole canvas, to keep it with its own calculation. The list is redone at once; **Open the copy** works it out again and checks it.
- **With fmGraph boards**, the window starts from their sliders and ranges; each scenario is tried too, and a bar that never moves stays as a fixed number unless it is 0.
- **The check.** Before the copy opens, it is worked out at every run and at fresh random ones, and everything it keeps must give the full model's numbers.
- Canvases left empty go. The canvases that stay are unlinked from their templates, so an update can't put back what went. Positions and formats are kept, so each lesson's items sit where the student saw them before.
- **The fixed numbers are right only while the other inputs stay as they were.** Change the full model and simplify again.
- On a large model it takes seconds (the owner's model of 528 items: about 6 seconds for two sliders); **Stop** stops it.

### From a script

```js
await fm.simplifyPlan({ inputs: [{ rectangle: 'Units', canvas: 'Sales', min: 0, max: 10, step: 1 }] });   // kept: 7, total: 11
await fm.simplifyForInputs({ inputs: [{ rectangle: 'Units', canvas: 'Sales', min: 0, max: 10, step: 1 }] }); // opens the copy
fm.simplified();   // what it was made from and for
```

---

[← Part 7](07-excel-import.md) · [Contents](README.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
