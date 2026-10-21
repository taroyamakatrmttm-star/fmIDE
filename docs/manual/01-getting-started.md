# Part 1 — Getting started

[← Contents](README.md) · [Part 2 →](02-building-models.md)

What the three apps are, how to open them, how to find any command, and how your work is saved. After this part you can open fmIDE, find your way round it, and keep your model safe.

The wording in this part was checked against the apps on `main` at pull request #195 (20 October 2026).

**In this part**

| Lesson | What you learn | Came in |
|---|---|---|
| [1.1 The three apps, and how a model travels between them](#three-apps) | fmIDE, ExcelExporter and fmGraph; File → Open ExcelExporter and Open fmGraph; ← Back to fmIDE | foundations, step 15, [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55), [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96) |
| [1.2 Opening the apps: from a file, from the website, or installed](#opening-the-apps) | The single HTML files, the website, Install fmIDE, working offline, updates | step 5 ([#7](https://github.com/taroyamakatrmttm-star/fmIDE/pull/7), [#10](https://github.com/taroyamakatrmttm-star/fmIDE/pull/10)), [#14](https://github.com/taroyamakatrmttm-star/fmIDE/pull/14) |
| [1.3 Finding your way](#finding-your-way) | The welcome card, the ribbon, tips and KeyTips, the Command Launcher, Help, tutorials, What's new | step 10 ([#56](https://github.com/taroyamakatrmttm-star/fmIDE/pull/56)–[#62](https://github.com/taroyamakatrmttm-star/fmIDE/pull/62), [#76](https://github.com/taroyamakatrmttm-star/fmIDE/pull/76)–[#78](https://github.com/taroyamakatrmttm-star/fmIDE/pull/78)), [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50) |
| [1.4 Documents: New, Open, Save and autosave](#documents) | `.fmide` documents, Open Recent, autosave, the other file kinds | step 4 ([#4](https://github.com/taroyamakatrmttm-star/fmIDE/pull/4), [#5](https://github.com/taroyamakatrmttm-star/fmIDE/pull/5)), [#97](https://github.com/taroyamakatrmttm-star/fmIDE/pull/97) |
| [1.5 Your own settings](#your-settings) | Keyboard Shortcuts, Customize Ribbon & KeyTips, the Preferences file | step 4c ([#6](https://github.com/taroyamakatrmttm-star/fmIDE/pull/6)) |

---

<a id="three-apps"></a>
## Lesson 1.1 — The three apps, and how a model travels between them

> **Goal:** know what each app is for, and move a model between them.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *What fmIDE is* (`what-is-fmide`), *From fmIDE to Excel* (`to-excel`), *See how a value moves the model (fmGraph)* (`fmgraph`)
> **Came in:** the first version; Open ExcelExporter's window and ← Back to fmIDE [#55](https://github.com/taroyamakatrmttm-star/fmIDE/pull/55); the model sent to ExcelExporter [#96](https://github.com/taroyamakatrmttm-star/fmIDE/pull/96); fmGraph, step 15 ([#83](https://github.com/taroyamakatrmttm-star/fmIDE/pull/83))

| App | What you do there |
|---|---|
| **fmIDE** | Build the model: rectangles hold numbers, arrows show where they come from, small operators (+ − × ÷ and more) combine them. fmIDE works out every value for every period. |
| **ExcelExporter** | Turn the model into an Excel workbook whose cells hold real formulas, laid out and styled your way. It also reads an Excel model and rebuilds it for fmIDE ([Part 7](07-excel-import.md)). |
| **fmGraph** | See how a value moves the model: bars show rectangles, sliders change inputs. It never changes your model. |

Everything stays on your computer: nothing is uploaded, and all three work offline.

### Steps

1. Open fmIDE. The first time, a small sample model is already open behind the welcome card; press **Explore the sample model**.
2. **File → Open ExcelExporter** (in the *App* group). ExcelExporter opens in its own window or tab, with the model already loaded. There's no need to save first.
3. In ExcelExporter, press **← Back to fmIDE** at the top left.
4. In fmIDE, **File → Open fmGraph**. fmGraph opens with the same model.

### Check it

ExcelExporter shows the model's name at the top and its tabs and rows in the sidebar, ready for **⬇ Generate .xlsx**. fmGraph shows a board, ready for **+ Slider** and **+ Bar**.

### Good to know

- **After changing the model,** press **File → Open ExcelExporter** again in fmIDE (or **File → ↻ From fmIDE** in ExcelExporter) to send it as it is now. fmGraph has its own **↻ From fmIDE**.
- **Pressing Open ExcelExporter again** brings its window to the front rather than loading a second copy.
- **Each app also opens a saved file on its own:** ExcelExporter with **File → Open Model…**, fmGraph from its first screen.
- **The rest of the manual:** building in Part 2, ExcelExporter in [Part 5](05-excelexporter.md), fmGraph in [Part 6](06-fmgraph.md).

---

<a id="opening-the-apps"></a>
## Lesson 1.2 — Opening the apps: from a file, from the website, or installed

> **Goal:** choose how to run the apps, and keep them working offline.
> **You need:** a browser: Chrome, Edge, Safari or Firefox.
> **Time:** about 3 minutes.
> **In the app:** fmIDE Help → *What fmIDE is* (`what-is-fmide`), *Saving and opening documents* (`documents`)
> **Came in:** step 5 · the installable web app [#7](https://github.com/taroyamakatrmttm-star/fmIDE/pull/7); publishing [#10](https://github.com/taroyamakatrmttm-star/fmIDE/pull/10); the update notice [#14](https://github.com/taroyamakatrmttm-star/fmIDE/pull/14)

There are three ways to run the apps. They are the same apps every way.

| Way | How | Good for |
|---|---|---|
| **From a file** | Open `apps/fmIDE.html` (or `ExcelExporter.html`, `fmGraph.html`) straight from your disk | Working with no internet and no installing; each app is one file |
| **The website** | Go to [fmide.pages.dev](https://fmide.pages.dev) | Always the newest version; the help pages ([/help](https://fmide.pages.dev/help/)) and the community library ([/library](https://fmide.pages.dev/library/)) |
| **Installed** | From the website, **File → Install fmIDE** (when the browser offers it) | Its own window and icon, working offline, and `.fmide` files opening with a double-click (Chrome and Edge on a computer) |

### Steps

1. Open [fmide.pages.dev](https://fmide.pages.dev) in Chrome or Edge.
2. **File → Install fmIDE** (in the *App* group). Confirm in the browser's window.
3. fmIDE opens in its own window. Close it and open it again from your computer's apps.

### Check it

fmIDE opens in its own window, even with the internet turned off.

### Good to know

- **On an iPhone or iPad,** in Safari tap **Share ⇪**, then **Add to Home Screen**.
- **New versions** download in the background. A notice offers **Reload** (your work is saved first) or **Later**.
- **Nothing you build is uploaded,** whichever way you run it. On the website, fmIDE reads only its own site, and only when you ask (Browse Library…).

---

<a id="finding-your-way"></a>
## Lesson 1.3 — Finding your way

> **Goal:** find any command, and get help without leaving your work.
> **You need:** fmIDE.
> **Time:** about 10 minutes.
> **In the app:** fmIDE Help → *Finding your way around* (`finding-your-way`), *Command Launcher and keyboard shortcuts* (`launcher-shortcuts`) · Tutorial *Your first model* (`first-model`)
> **Came in:** step 10 · Help [#56](https://github.com/taroyamakatrmttm-star/fmIDE/pull/56); tips and "?" on windows [#57](https://github.com/taroyamakatrmttm-star/fmIDE/pull/57); tutorials and the welcome card [#58](https://github.com/taroyamakatrmttm-star/fmIDE/pull/58), [#59](https://github.com/taroyamakatrmttm-star/fmIDE/pull/59); help pages [#61](https://github.com/taroyamakatrmttm-star/fmIDE/pull/61); the wider panel and What's new [#76](https://github.com/taroyamakatrmttm-star/fmIDE/pull/76)–[#78](https://github.com/taroyamakatrmttm-star/fmIDE/pull/78); the link to this manual [#PRNUM](https://github.com/taroyamakatrmttm-star/fmIDE/pull/PRNUM); resizable windows [#50](https://github.com/taroyamakatrmttm-star/fmIDE/pull/50)

### The screen

- **The ribbon** at the top holds every command, in seven tabs: **File** (documents, templates, the library), **Home** (the everyday commands), **Insert** (rectangles, operators, functions), **Arrange**, **Model** (periods and canvases), **View** and **Macros**.
- **The canvas tabs** sit under the ribbon. A model can have several canvases, like the sheets of a workbook; **+** adds one.
- **The canvas** is the big area where you build. Scroll it to move around.
- **The zoom control** is at the bottom right ([lesson 2.10](02-building-models.md#zoom)).
- **The title** of the window shows the document's name, such as *Untitled — fmIDE*.

### Steps

1. **The welcome card.** The very first time, a card offers **▶ Take the 5-minute tour**, **Explore the sample model**, **Start blank** and **❓ Open Help**. Press **Start blank**. (It appears only when there is nothing saved yet; Help can show it again.)
2. **Tips.** Pause over a ribbon button: a tip shows its name, its shortcut and what it does (and, when it is greyed out, why). Press **F1** while the tip shows, or **Learn more**, to open its Help topic.
3. **The Command Launcher.** Press **Ctrl+K** (⌘K on a Mac) and type `peri`. It lists everything about periods: Help topics such as *Periods and the timeline*, commands such as *Add Period Shift*, actions such as *Set Number of Periods…*, and the tutorial *Time: periods and last period*. Press Enter to run the one highlighted, or Esc to close.
4. **KeyTips.** Tap **Alt** (⌥ Option on a Mac): a letter appears on every ribbon tab. Press **H** for Home, then the letter of a button.
5. **Help.** Press **F1** (or **❓** at the top right). The Help panel opens beside the canvas, so you can follow the steps while you work and shortcuts keep working. Search, or pick a topic. A command named in a topic is a button that runs it.
6. **A reading view.** Press **⤢** at the top of the panel to widen it; **⤡** brings it back. Or drag its left edge; a double-click on the edge goes back to the usual width.
7. **Tutorials.** At the top of the Help panel, pick **Your first model**. A card shows one step at a time, a ring shows what to press, and each step moves on once you've done it. Exit any time.
8. **What's new.** At the top of the Help panel (or **View → What's New**): every update, newest first, each with a page saying what changed, why, and how to use it. A dot on ❓ means there is something you haven't seen.
9. **This manual.** At the top of the Help panel (and at the bottom of the welcome card), **📖 The user manual, step by step (online)** opens this manual on fmIDE's website, in your browser. ExcelExporter's and fmGraph's Help panels have the same link, to their own parts of the manual. It needs a connection; the apps themselves never go online for it.

### Check it

The Command Launcher found commands and Help topics by part of their name, and the Help panel stayed open beside the canvas while you worked.

### Good to know

- **Every window has a "?"** in its corner that opens its Help topic beside it.
- **Tutorials practise on a practice canvas.** Your own model, its undo history and your document are put aside, and come back exactly as they were. fmIDE has seven: *Your first model*; *Time: periods and last period*; *Blocks: build once, use many times*; *Templates: save a canvas and reuse it*; *Your own functions*; *From fmIDE to Excel*; *fmGraph boards in Excel*.
- **Large windows** (Templates, Functions, the Macro Builder…) resize from their bottom-right corner and keep that size; a double-click on the corner puts one back.
- **The same help on the web:** every topic, tutorial and update is also a page at [fmide.pages.dev/help](https://fmide.pages.dev/help/), to read or print outside the app. ExcelExporter and fmGraph have their own Help (❓).

---

<a id="documents"></a>
## Lesson 1.4 — Documents: New, Open, Save and autosave

> **Goal:** save your work as a file, open it again, and know what fmIDE keeps for you.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Saving and opening documents* (`documents`), *Other files: systems, modules, workspaces, preferences* (`other-files`)
> **Came in:** step 4 · autosave in the browser [#4](https://github.com/taroyamakatrmttm-star/fmIDE/pull/4); documents [#5](https://github.com/taroyamakatrmttm-star/fmIDE/pull/5); `.fmide` files on an iPad [#97](https://github.com/taroyamakatrmttm-star/fmIDE/pull/97)

Your work is a **document**, a `.fmide` file. It holds the model with the templates, functions and formats it uses, its fmGraph boards and its Excel layout.

### Steps

1. **File → New** starts an empty document. The title reads *Untitled — fmIDE*.
2. Add a rectangle (**Home → Add Rectangle**). A **•** appears in the title: there are unsaved changes.
3. **File → Save** (**Ctrl+S**, ⌘S on a Mac). Choose a name, such as `My model.fmide`. The • goes.
4. **File → New** again, then **File → Open Recent…**: your document is in the list. Pick it.

### Check it

Your rectangle is back, and the title shows your document's name.

### Good to know

| Command | Keys | What it does |
|---|---|---|
| **New** | | An empty document. fmIDE asks first if there are unsaved changes. |
| **Open…** | Ctrl+O | Opens a `.fmide` file. |
| **Save** | Ctrl+S | In Chrome and Edge, writes straight back to the file. Other browsers download a copy each time. |
| **Save As…** | Ctrl+Shift+S | Saves under a new name. |
| **Open Recent…** | | The last ten documents. |

- **Autosave.** fmIDE also keeps your work in the browser every few seconds, and when the page is hidden. After a crash it comes back with your changes and offers to save them. Autosave is a safety net, not a file: save documents you care about.
- **On an iPad or iPhone,** **File → Open…** shows the Files app; pick the `.fmide` file there.
- **Other files.** The File tab also reads and writes these:

| File | Command | What it is |
|---|---|---|
| System | **Save System**, **Load System (replace)**, **Add System (merge)** | The whole model, without your templates. ExcelExporter and fmGraph read it too. |
| Module | **Save Module**, **Load Module** | One canvas; loading adds its boxes to the canvas shown. |
| Workspace | **Export Workspace**, **Import Workspace** | The model with your templates, formats and macros. |
| Preferences | **Export Preferences…**, **Import Preferences…** | Your shortcuts and ribbon ([lesson 1.5](#your-settings)). |

- **Files from someone else are safe to open.** Names, labels and units are shown as plain text, numbers and colours are checked, and nothing in a file is run as a program. A file from a newer version asks before opening.

---

<a id="your-settings"></a>
## Lesson 1.5 — Your own settings: shortcuts, the ribbon and the Preferences file

> **Goal:** make fmIDE work your way, and take your settings to another computer.
> **You need:** fmIDE.
> **Time:** about 5 minutes.
> **In the app:** fmIDE Help → *Command Launcher and keyboard shortcuts* (`launcher-shortcuts`), *Customising the ribbon* (`customize-ribbon`)
> **Came in:** the first version; the Preferences file, step 4c ([#6](https://github.com/taroyamakatrmttm-star/fmIDE/pull/6))

### Steps

1. **View → Keyboard Shortcuts.** Every command is listed by group, with its keys. Find **Add Rectangle** (*Unassigned*), press **Change** (it reads *Press a key…*), and press the keys you want, such as **Alt+R**. **Reset** goes back to the usual keys; **Clear** removes them. Keys already used by another command move to the new one, and the window says so. Press **Close**.
2. **View → Customize Ribbon & KeyTips.** Add, remove and move tabs, groups and buttons (your macros too), and the Quick Access Toolbar at the top left. It also sets the key that shows KeyTips.
3. **View → Collapse / Expand Ribbon** (**Ctrl+F1**) folds the ribbon away to make room.
4. **File → Export Preferences…** saves your shortcuts, ribbon, Quick Access Toolbar and KeyTips key in one file. On another computer, **File → Import Preferences…** brings them back.

### Check it

Press your new keys (Alt+R): a rectangle appears.

### Good to know

- **⇩ Export Shortcuts** and **⇧ Import Shortcuts**, in the Keyboard Shortcuts window, carry the shortcuts alone.
- **Importing Preferences replaces exactly those settings.** Your models, templates, macros and formats are never touched.
- **A new command** added in an update reaches a customised ribbon once, in its usual place, so you don't miss it.

---

[← Contents](README.md) · [Part 2 →](02-building-models.md)

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
