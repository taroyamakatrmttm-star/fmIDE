# Build step 10 — help inside the apps

**Goal:** people learn fmIDE and ExcelExporter inside the apps, in plain English, without reading technical documents: a manual they can search, help one click away from every button, step-by-step tutorials, and short videos.

**What was there before:** the ribbon's buttons showed only their name and shortcut. The Command Launcher (Ctrl/Cmd+K) found commands by name, but nothing explained what a command does or how the pieces fit together (rectangles, operators, periods, blocks, templates…). Explanations lived in `README.md` and `docs/`, written for people who build fmIDE rather than people who use it; the one tutorial (`docs/tutorial-step7.md`) followed the project's history. ExcelExporter had short hints under each panel's heading and almost no tooltips.

**Decided (29 Sep 2026, decision 8 in `docs/decisions.md`):**

- **Offline and inside the apps.** The help is part of each single file: it works opened from disk, with no connection, and adds no network call.
- **Written once.** The help text lives in `src/help/`; the apps, the site's help pages (H4) and the video scripts (H4) are all made from it, so they cannot drift apart.
- **Kept up to date by the tests.** A test fails when a command has no plain-English sentence or a help topic names a command or topic that doesn't exist; from H3, every tutorial is also a test, so a change that breaks a tutorial step turns CI red.
- **Videos are links**, labelled "opens YouTube", opening in a new tab — in the apps and on the site. Never embedded: an embedded player would load another site, which the single files and the site's security policy never do.
- **English first**, written so translations can be added later (the text is data, apart from the code).
- **Licences:** fmIDE's help text (`src/help/`) is under CC BY 4.0, like the file-format documentation. ExcelExporter's help text stays with ExcelExporter (proprietary).

## Phases

One pull request each, each approved before the next.

- **H1 — help panel, search, a sentence per command.** F1 (or ❓ next to the ribbon's search box, or View → Help) opens a Help panel beside the canvas. It doesn't block the canvas: you can follow the steps while you work, and shortcuts keep working. It has a search box, the topics by group, and a topic view with numbered steps; a command named in a topic is a button that runs it. Every ribbon command gets one plain sentence, shown in its tooltip and found by the search. Help topics also appear in the Command Launcher.
- **H2 — help where you are.** A richer tooltip on each ribbon button (the sentence, the shortcut and "Learn more" to its topic); a "?" in the corner of each window (Templates, Functions, Format Presets, Periods…) that opens its topic; "Help" in the touch menu; the same help panel in ExcelExporter, with its own topics (load, arrange, the Tree view, scenarios, the "differs from fmIDE" list, generate). Decided (29 Sep 2026, the owner): the panel's code moves into `src/shared/` (Apache in both apps); ExcelExporter's help text stays ExcelExporter's.
- **H3 — tutorials and a welcome screen.** Short guided lessons (3–5 minutes) that point at the right button and wait until each step is done, in a separate practice document so your own work is never touched. A welcome screen on first start ("Take the 5-minute tour", "Open a sample model", "Start blank"), reopened from Help. Each tutorial also runs as a test. Decided (29 Sep 2026, the owner): split into **H3a** (the tutorial engine, practice mode, the welcome card, and the tutorials "Your first model" and "Time") and **H3b** (blocks, templates, functions, to Excel); the welcome is a **card in a corner** that blocks nothing, not a centred window.
- **H4 — help on the site and videos.** The same topics as plain pages on the published site (`/help`, no JavaScript, like `/library`); video scripts made from the tutorials; screen recordings made automatically by running the tutorials (so they can be recorded again when the screen changes); the voice-over and uploading to YouTube are the owner's; the links then go into the topics.

## Done (H1) — how it turned out

- **The help text** is `src/help/fmide-help.js` (CC BY 4.0): 30 topics in 12 groups, a sentence for every one of the 94 commands (69 written out; the 25 Insert Operator commands take their operator's sentence). It is plain data pulled into fmIDE by `// build:include`, so no change to the build was needed. The page's licence notice names it.
- **The panel** (`src/fmide/js/01b-help.js`, styles in `styles.css`): `#helpPanel`, docked on the right, 380 px wide (the full width in a window under 700 px). The canvas narrows beside it rather than being covered. It opens with F1 (command `openHelp`), ❓ beside the ribbon's search box, or View → Help; F1 again, ×, or Esc from inside close it. Home lists the topics by group. A topic shows its summary, paragraphs, numbered steps, tips and "See also", with Back. Search looks through every text of a topic and every command's name and sentence. Commands found have ▶, off while the command can't run and refreshed with the ribbon.
- **Tooltips:** every ribbon and Quick Access Toolbar button shows its name and shortcut, then its sentence.
- **Command Launcher:** the topics are listed (📖, category Help, after the commands), and choosing one opens the panel at it.
- **A customised ribbon** gets the Help group once, after the group holding Keyboard Shortcuts (`ui.helpAdded`). A Preferences file is taken as it is, like before.
- **Checked:** group 31 (11 tests), then the whole suite. Screenshots of the panel at 1400 × 900 and 1024 × 768.
- **Found along the way:**
  - Values are shown only after Evaluate (F9) once something changes, so "Your first model" says so.
  - Load Module adds a module's boxes to the current canvas, not as a new canvas; the sentence says so.

## Done (H2) — how it turned out

- **One panel for both apps.** The Help panel's code moved from fmIDE into `src/shared/help-panel.js` (`createHelpPanel`), and its styles into `src/shared/help-panel.css`. Both pages pull the styles in with a second `build:css` line, so the build needed no change. fmIDE hands it its commands, so `{cmd:…}` buttons and ▶ keep working. ExcelExporter has no command list, so its topics name buttons in words.
- **Ribbon tips** (fmIDE, `01b-help.js`). A tip of fmIDE's own replaces the browser's tooltip on every ribbon and Quick Access Toolbar button:
  - It shows the name, the shortcut and the sentence, plus "Not available right now" on a disabled button, and "Learn more (F1)" when a topic names the command. Insert Operator buttons go to Operators, or to "Timing, conditions and rounding".
  - It appears after a short pause with a mouse, including over disabled buttons, since it is watched on the page. It stays while the pointer is on it.
  - F1 while a tip shows opens that topic.
  - The button keeps its name and sentence for screen readers (`aria-label`, `aria-description`).
- **"?" on 22 windows** (`addWindowHelp(box, topic)`): among them Templates, recipes, Functions, the function editor and picker, Format Presets, properties, Periods, the per-period values, blocks, aliases, the library windows, the Macro Builder, Customize Ribbon, Shortcuts, Update Canvas, Remove Duplicates and Open Recent.
  - While Help is open, the panel sits above a window's dimmed backdrop, and the backdrop leaves the panel's side clear, so the window and its topic can be read side by side.
  - Windows that empty themselves between steps (the alias and block pickers) get their "?" back.
- **Touch menu:** holding a node now offers Help, for that kind of node's topic.
- **ExcelExporter** (`src/excel-exporter/js/09d-help.js`, its own licence): 14 topics in 5 groups (getting started, arranging the workbook, inputs and scenarios, formatting, making the workbook).
  - It opens from ❓ Help in the header or with F1.
  - A "?" beside each panel's heading, and beside "Gather inputs on a separate tab", opens that part's topic.
  - The page narrows beside the panel.
- **Checked:** group 32 (18 tests), groups 31 and 27 updated, then the whole suite. Screenshots of a tip, a window's "?" with its topic, and ExcelExporter's panel.
- **Found along the way:** the alias and block pickers rebuild their window at each step, which would have removed the "?". A test caught it, and the "?" now comes back.

## Done (H3a) — how it turned out

- **Tutorials are data.** They live in `src/help/fmide-tutorials.js` (CC BY 4.0). Each step has:
  - a text, where `{cmd:id}` becomes a button as in the topics;
  - what to point at: a ribbon button (or its tab, when the button is on another one), a rectangle, or one of a rectangle's buttons;
  - what must be true to move on, written as data (a rectangle with a name and value, an operator, a period shift, an arrow, a worked-out value in a period, a number of periods, the period shown, the periods using a rectangle's own number).

  Two tutorials so far:
  - **Your first model** (10 steps): price × quantity = revenue.
  - **Time: periods and last period** (13 steps): a corkscrew over five periods.
- **The engine** is `src/fmide/js/01c-tutorials.js`.
  - **The coach card** (`#tutorialCard`) sits bottom-left. It shows the step count, a progress bar and the step's text. Its buttons are Next (for a step that only asks to read), Skip step, Back, Exit tutorial, and on the last step Download what I built and Finish.
  - **A pulsing ring** (`#tutorialPointer`) marks what to press.
  - **Moving on:** every 0.3 s the engine checks whether the step is done and moves on by itself. Nothing is done for the person.
- **Practice mode keeps your work safe.**
  - **Starting:** a tutorial sets aside the model, its undo history and the document's state, then gives a clean "Practice" canvas with one period.
  - **Autosave paused:** the autosave waits until the tutorial ends, so the saved copy is your own work even after a crash; a reload mid-tutorial brings it back.
  - **Blocked while practising:** commands that read or write your files or document (New, Open, Save, Save As, Open Recent, Load/Add System, Import Workspace) are refused with a message.
  - **Leave-site warning:** the "Leave site?" question follows your own document, not the practice.
  - **Finishing or exiting** puts everything back exactly as it was.
- **Where tutorials are found:** the top of the Help panel (a Tutorials group, each with ▶, plus "Show the welcome card"), the Command Launcher ("Tutorial: …"), and the welcome card.
- **The welcome card** (`#welcomeCard`) appears only on the very first start, when there is no autosave yet.
  - It sits bottom-right, over the sample model, blocks nothing, stays below any window, and steps aside at the first change to the model.
  - Its choices: Take the 5-minute tour, Explore the sample model, Start blank, Open Help.
- **The shared panel** (`src/shared/help-panel.js`) gained two things: `homeTop`, for an app's own things above the topics, and `richText`, used by the coach card.
- **Found along the way:** a rectangle's 🕒 button sat under its own resize corner, so clicking its middle started a resize. The "Time" tutorial's test caught it. 🕒 now sits on the bottom edge, left of the resize corner: clear of the corner, the bottom dot and, on a touchscreen, the corner's larger touch area. A test checks all three can be reached.
- **Found on CI:** the shared panel's refresh of its commands' ▶ buttons also greyed out the tutorials' ▶ (they share the button style but aren't commands), so after any change with Help open, a tutorial couldn't be started. The refresh now touches only command rows; a test checks it.
- **Checked:** group 33 plays both tutorials step by step with real clicks, typing and right-button drags. A step without an action in the test fails it. The group also covers practice mode (exit, reload, refused commands, download) and the welcome card. Then the whole suite.

## Topics (H1)

Groups, in order, with their topics:

| Group | Topics |
|---|---|
| Getting started | What fmIDE is · Your first model in five minutes · Finding your way around (ribbon, canvas tabs, launcher, help) |
| Building a model | Rectangles: name, value and unit · Operators · Drawing arrows · Aliases · Moving, copying and arranging |
| Periods and time | Periods and the timeline · Period shifts (last period, next period) · A value that changes over time · Timing, conditions and rounding (period, if, round…) |
| Canvases, blocks, plugs | Canvases · Blocks: a canvas used as a building block · Plugs and sockets |
| Templates and recipes | Templates · Template versions and updating a canvas · Recipes |
| Functions | Your own functions · Using a function on the canvas |
| Sharing and the library | Library packs · Browsing the library |
| Files and saving | Saving and opening documents · Other files: systems, modules, workspaces, preferences |
| Formatting | Formats and format roles |
| To Excel | From fmIDE to Excel |
| Working faster | Command Launcher and keyboard shortcuts · Customising the ribbon · Macros |
| Touch | Using fmIDE on a tablet |

## Tutorials (H3), first outline

1. **Your first model** — a price and a quantity, multiplied into revenue, over five periods.
2. **Time** — closing balance = opening + additions, with a period shift and `if(period = 1, …)`.
3. **Blocks** — a depreciation canvas used as a block, then vertically, one per year of spending.
4. **Templates** — save a canvas as a template, change it, save a new version, update the canvas.
5. **Functions** — write `Margin(Revenue, Cost)`, put it on the canvas, update it.
6. **To Excel** — save, open ExcelExporter, arrange, generate, check the numbers.

## Tests

- **H3 — group 33** (`tests/33-tutorials.spec.js`, also in `npm run test:help`): every tutorial played through as a person would (every step has an action, moves on, and points at something on screen); your model, undo history and title back unchanged; Exit, Skip and Back; refused commands; a reload mid-tutorial; Download what I built; the welcome card (first start only, corner, blocking nothing, its choices); the 🕒 button clickable.
- **H2 — group 32** (`tests/32-help-context.spec.js`, also in `npm run test:help`): the ribbon tip (name, shortcut, sentence, Learn more, F1 while it shows, a disabled button, an operator's topic); the "?" on nine windows, opening its topic above the backdrop with the window still open; every `addWindowHelp` names a topic that exists; Help in the touch menu (real touch input); ExcelExporter's ❓ Help and F1, the page narrowing, the "?" beside its headings, its topics and See also links, no request.
- **H1 — group 31** (`tests/31-help.spec.js`, `npm run test:help`): opening and closing (F1, ❓, the ribbon, `fm.command('openHelp')`, Esc); shortcuts still working with the panel open; every command has a sentence and no sentence names a missing command; every command and topic a topic names exists; search finds topics and commands, and a command's ▶ runs it (disabled when the command is); help topics in the Command Launcher; a customised ribbon gets the Help group once; tooltips carry the sentence; the panel at tablet size; no network request.
