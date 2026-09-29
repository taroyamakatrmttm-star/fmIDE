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
- **H2 — help where you are.** A richer tooltip on each ribbon button (the sentence, the shortcut and "Learn more" to its topic); a "?" in the corner of each window (Templates, Functions, Format Presets, Periods…) that opens its topic; "Help" in the touch menu; the same help panel in ExcelExporter, with its own topics (load, arrange, the Tree view, scenarios, the "differs from fmIDE" list, generate). To decide then: whether the panel's code moves into `src/shared/` (Apache in both apps) or ExcelExporter gets its own copy.
- **H3 — tutorials and a welcome screen.** Short guided lessons (3–5 minutes) that point at the right button and wait until each step is done, in a separate practice document so your own work is never touched. A welcome screen on first start ("Take the 5-minute tour", "Open a sample model", "Start blank"), reopened from Help. Each tutorial also runs as a test.
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

- **H1 — group 31** (`tests/31-help.spec.js`, `npm run test:help`): opening and closing (F1, ❓, the ribbon, `fm.command('openHelp')`, Esc); shortcuts still working with the panel open; every command has a sentence and no sentence names a missing command; every command and topic a topic names exists; search finds topics and commands, and a command's ▶ runs it (disabled when the command is); help topics in the Command Launcher; a customised ribbon gets the Help group once; tooltips carry the sentence; the panel at tablet size; no network request.
