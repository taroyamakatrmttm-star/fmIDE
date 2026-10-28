# Part 8 — Sharing a model: showcase viewers

[← Part 7](07-excel-import.md) · [Contents](README.md)

A **showcase viewer** is one web page made from your model. Anyone can open it in a browser — from an email, a disk or a USB stick — with nothing installed and nothing sent anywhere. They see your canvases read-only and, on the Board, move the sliders you set up in fmGraph. They can play with the model; they can't change it. The page itself is the app called **fmShowcase**. The background and design are in [`docs/viewer-brief.md`](../viewer-brief.md).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [8.1 Make a showcase viewer](#showcase-viewer) | File → Make Showcase Viewer…, what goes into the file, making it again | the showcase viewer's phases V1–V3 (branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`), opening one on an iPhone or iPad (`claude/viewer-ipad-sliders`) |

An Excel workbook to download from the viewer, making many viewers at once and a gallery of them on the website come later.

---

<a id="showcase-viewer"></a>
## Lesson 8.1 — Make a showcase viewer

> **Goal:** turn a model and its fmGraph board into one web page someone else can open and play with.
> **You need:** fmIDE, and a model with an fmGraph board: the sample `tests/fixtures/viewer/every-widget.fmide` has two boards and two scenarios.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Share a model as a showcase viewer* (`showcase-viewer`)
> **Came in:** the showcase viewer's phases V1–V3 · branches `claude/viewer-v1`, `claude/viewer-v2`, `claude/viewer-v3`, `claude/viewer-ipad-sliders`

You choose what the visitor sees; fmIDE writes the page. Your choices stay in the document, so making the viewer again after a change takes one click.

### Steps

1. In fmIDE, **File → Open…** and pick `every-widget.fmide`.
2. Choose **File → Make Showcase Viewer…** (the File tab's App group, after Open fmGraph). A window titled *Make a showcase viewer* opens.
3. Type a **Title**, such as `Prices and cash`. The **File name** below follows it: `prices-and-cash`, with `.html`.
4. Fill in **Description**, **Author** and **Licence** if you like (the licence says how visitors may reuse the model, for example `CC BY 4.0`).
5. Under **Canvases the visitor sees**, untick **Checks**. Set **Opens on** to **Cash**.
6. Set **Periods shown** from **Year 2** to **Year 3**.
7. Under **Boards (from fmGraph)**, untick **Own sliders**. Set **Play starts with** from **Base** to **Big year**.
8. Press **Make viewer**. fmIDE downloads `prices-and-cash.html` (on an iPhone or iPad, the share sheet opens) and says *Made prices-and-cash.html (… KB). It opens in any browser, offline, and changes nothing in your model.*
9. Open the file in your browser (on an iPhone or iPad, see *Good to know*). On the **Board**, move the **Price** slider to 12. Then choose **Logic**, the **Profit** tab, and tap **Revenue**.

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

[← Part 7](07-excel-import.md) · [Contents](README.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
