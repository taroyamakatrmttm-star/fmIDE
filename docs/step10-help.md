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
- **H3 — tutorials and a welcome screen.** Short guided lessons (3–5 minutes) that point at the right button and wait until each step is done, in a separate practice document so your own work is never touched. A welcome screen on first start ("Take the 5-minute tour", "Open a sample model", "Start blank"), reopened from Help. Each tutorial also runs as a test. **Done: H3a and H3b.** Decided (29 Sep 2026, the owner): split into **H3a** (the tutorial engine, practice mode, the welcome card, and the tutorials "Your first model" and "Time") and **H3b** (blocks, templates, functions, to Excel); the welcome is a **card in a corner** that blocks nothing, not a centred window.
- **H4 — help on the site and videos.** The same topics as plain pages on the published site (`/help`, no JavaScript, like `/library`); video scripts made from the tutorials; screen recordings made automatically by running the tutorials (so they can be recorded again when the screen changes); the voice-over and uploading to YouTube are the owner's; the links then go into the topics. Decided (29 Sep 2026, the owner): split into three phases, one pull request each:
  - **H4a — the help pages.** `/help`: the topics by group with the tutorials at the top, a page per topic and per tutorial (written out step by step), every topic on one page (Ctrl+F, print). They look like the library's catalogue. A command named in the text shows its name and where it is ("▭ Add Rectangle (Home tab)"), read from fmIDE's source and checked by a test against fmIDE itself. **ExcelExporter's help is published too**, at `/help/excel/`, under its own licence ("all rights reserved"); its text moves into its own data file inside ExcelExporter's folder. **Done.**
  - **H4b — video scripts and screen recordings**, made by command, not by the tests: a script per tutorial (title, what you'll build, a line to say per step, a closing line); recordings at 1280 × 720 by playing each tutorial as test group 33 does (its step actions move into a shared helper), with a `.srt` caption file and the script timed to the video. A step may carry an optional spoken line (`say`) where the card's words don't read well aloud. The voice-over is **the owner's own voice**, read from the timed script; captions always come with it. Recordings are not committed; a manual GitHub workflow can also make them. **Done.**
  - **H4c — video links.** `src/help/videos.js` (CC BY 4.0) holds only each video's 11-character YouTube id, per tutorial or topic, never a whole address, with a fingerprint of the tutorial it was recorded from. Links read "▶ Watch the video (opens YouTube)", open in a new tab, and appear in the Help panel, the tutorials and on the site. The tests check the ids' form, that they name something that exists, the label and new tab, no network request, and **fail when a tutorial changes after its video was recorded** (re-record, or confirm the video still fits by updating the fingerprint).

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

## Done (H3b) — how it turned out

- **Four more tutorials** in `src/help/fmide-tutorials.js`, six in all.
  - **Blocks: build once, use many times** (14 steps): a Tax canvas with an input and an output, used as a block on a second canvas (1000 × 0.3 = 300).
  - **Templates: save a canvas and reuse it** (4 steps): save a revenue canvas as a template, add it to a new canvas, which remembers its template and already shows Revenue = 50.
  - **Your own functions** (7 steps): write `Margin(Revenue, Cost)`, put it on the canvas, wire its two inputs, 0.4.
  - **From fmIDE to Excel** (5 steps since ExcelExporter reads fmIDE's model, October 2026; 6 before, with Save System first): Open ExcelExporter, which shows the practice model, then what to do there.
- **Decided (29 Sep 2026, the owner):**
  - What a tutorial saves in the library is taken back out at the end, unless the last step's **Keep what I saved in my library** is ticked (off by default). Exiting early always takes it out.
  - The To Excel card stays in fmIDE. Its last steps say what to do in ExcelExporter, and the test does exactly that there: it loads the downloaded file, generates the workbook, and checks for a real formula.
- **The engine (`01c-tutorials.js`) gained:**
  - `start`: a tutorial can begin from a small model given as data (canvases, rectangles, operators, arrows; ids prefixed `tut-`).
  - Checks: `canvas`, `canvases`, `role`, `block`, `linkedTo`, `template`, `fn`, `functionNode`, `downloaded`, `openedExcel`.
  - Arrow ends `{ block: 'Tax' }` and `{ fn: 'Margin', port: 'Revenue' }`.
  - Practice mode keeps a copy of `TEMPLATES` and `FUNCTIONS` and puts it back at the end, unless Keep is ticked.
- **Checked:** group 33 (17 tests) plays all six tutorials step by step. It also covers the library (taken out without the tick, kept with it, taken out on Exit) and a start model. Then the whole suite.
- **Found on CI:**
  - **The flaw:** the Templates tutorial had a "Press Evaluate" step after Add to new canvas. Adding the template already works out the values, so that step was done the moment it appeared and flashed by.
  - **The fix:** the step was removed, and its check joined the step before.
  - **A new guard:** the play-through test now fails any step that is already done when it appears. The step must still be showing 0.7 s later, before the person acts.
  - **Proof:** the guard was checked against the old tutorial and caught it.

## Done (H4a) — how it turned out

- **The pages** are written by `tools/build-help.js` into every site build (`npm run build`), after the app's version and offline list are worked out, as the catalogue is:
  - `/help/`: an introduction, a link to every topic on one page, the six tutorials (title, minutes, summary), then the 30 topics under their group headings.
  - `/help/<topic>`: the summary, paragraphs, numbered steps, tips and See also, with the way back to all topics and to its group, and "Try it" when a tutorial covers the topic.
  - `/help/tutorials/` and `/help/tutorials/<id>`: how to take a tutorial in fmIDE, what its practice canvas starts with, and every step's text as the coach card shows it.
  - `/help/all`: every topic on one page, See also as links within it; it prints without the header and footer.
  - `/help/excel/`, `/help/excel/<topic>`, `/help/excel/all`: ExcelExporter's 14 topics the same way, with "fmIDE help" and "Open ExcelExporter" at the top.
- **Commands by name and place.** `{cmd:id}` becomes the command's icon and name and the first ribbon tab holding it, or "Command Launcher" for the few on no tab. The shortcut isn't repeated: the texts name it where it matters. The names come from fmIDE's command list and the tabs from its default ribbon, read from the source (the build is Node only, it can't run the app); test group 34 compares both with what fmIDE shows.
- **Checked as they are built:** a topic or tutorial naming a command or topic that doesn't exist, a topic in a missing group, or an id that can't be a page address (letters, digits and dashes, and not a name the pages use: `index`, `all`, `tutorials`, `excel`…) stops the build with every problem listed, and nothing is written.
- **Safe as the catalogue:** every text goes through `escapeXml`, addresses are built from ids only, and `/help` has its own security policy: no scripts at all, styles and the icon from the site only, no connections, forms or embedding. The look is the catalogue's style sheet (`src/library/style.css`) plus `src/help-pages/help.css`; both work in light and dark.
- **Not in the offline copy:** the apps carry their own help. The help pages' own files don't count towards the app's version (a change to the help text still changes the apps, and so the version).
- **ExcelExporter's help text** moved from `src/excel-exporter/js/09d-help.js` into `src/excel-exporter/help/excel-help.js` (still ExcelExporter's, under its licence), pulled in by `build:include`; the built ExcelExporter changed only in its comments.
- **Checked:** group 34 (11 tests), then the whole suite. Screenshots of the index, a topic, a tutorial, an ExcelExporter topic, and a topic at phone width (no sideways scrolling).
- **Found along the way:** the heading comment of `src/help/fmide-help.js` named the panel's code as `23-help.js`; it is `01b-help.js`, and now says so.
  - **H5 — more room to read, and What's new** (decided 1 Oct 2026, the owner; three phases, one pull request each): **H5a** the Help panel widens — ⤢ for a reading view, its left edge drags to any width — in both apps (a side panel, not a pop-up: the owner's choice); **H5b** What's new, a page per feature (not per pull request) with what changed, why and how to use it, newest first, a "New" badge on what you haven't seen, every past feature written in full, each app its own entries, developer-only changes left out; **H5c** the What's new pages on the site.

## Done (H5c) — how it turned out

- **The pages** (`tools/build-help.js`): `/help/whats-new/` lists fmIDE's updates under a heading per day, newest first; `/help/whats-new/<id>` is one update — its day, What changed, Why, How to use it, Good to know and Read more (its guides), commands shown by name and ribbon tab as on the other pages. ExcelExporter's are at `/help/excel/whats-new/`, under its licence. Each index links to them ("What's new"). Made from the same data as the apps' panels (`fmide-whats-new.js`, `excel-whats-new.js`).
- **Checked at build time**, like the topics: update ids letters, digits and dashes; real dates, newest first; every command and topic named exists — otherwise nothing is published (`HelpError`). `whats-new` joined the names no topic may take.
- ExcelExporter's header links are now relative to the help's root, so they also work one folder deeper.
- **Checked:** test group 34 — the pages list, the two lists and an update's page in each app, the links, hostile text in updates, the build stopping on bad updates, the policy and a phone's width.
- README now mentions the wider panel and What's new (missed in H5a and H5b).

## Done (H5b) — how it turned out

- **The data:** `src/help/fmide-whats-new.js` (`WHATS_NEW`, CC BY 4.0, 35 updates) and `src/excel-exporter/help/excel-whats-new.js` (`EXCEL_WHATS_NEW`, ExcelExporter's licence, 22 updates), each `{ id, date, title, summary, what, why, how, notes, see }`, newest first. Written from `CHANGELOG.md` and the pull requests, one entry per feature a person would notice (the touch phases are one entry, the function phases one, the template-tidying changes one). Left out as developer-only: the test suite, the source split, shared code, browser storage moving to IndexedDB, the pack checker and the library's rules and repository, a pack taken down, the licences, and fixes only hand-written sample files could meet. The formula IR's phases are one entry, "The canvas and Excel give the same numbers". Dates are the day each was merged.
- **The panel** (`src/shared/help-panel.js`, `options.whatsNew`): What's new above the tutorials on the home page (the three newest, a count of new ones, Every update (N) ›); the list of every update under a heading per day; an update's page with What changed, Why, How to use it, Good to know (tips) and Read more (its guides); search finds updates. An update is **New** when dated after the date seen; with nothing seen yet, when within 14 days of the newest (`NEWS_FRESH_DAYS`). Opening the list marks everything seen. The app's Help button carries a dot (`.has-news`) while anything is new.
- **Kept:** fmIDE's `ui.whatsNewSeen` (the person's own UI setting: never from an imported file, never in a Preferences file); ExcelExporter's `fmide-excel-whats-new-seen`.
- **fmIDE:** the command What's New (`openWhatsNew`), beside Help in the View tab's Help group; a customised ribbon gets it once, right after Help (`ui.whatsNewAdded`).
- **Checked:** test group 43 (9 tests); groups 31 and 32 now count only topic links and topic groups (What's new sits above them), and group 31's customised ribbon expects What's New beside Help.

## Done (H5a) — how it turned out

- **The reading view:** ⤢ in the panel's header widens Help to two thirds of the window (at least 600 pixels); ⤡ brings it back to the width it had. From 600 pixels wide the panel reads as a page (`.wide`): larger text in a column at most 760 pixels wide, the topic titles larger.
- **Any width:** the panel's left edge (`.help-resize`) drags by mouse, finger or pen (pointer events, captured by the edge); a double-click on it goes back to the usual 380. The panel is never narrower than 300 pixels and always leaves 200 pixels of the app beside it, also when the window gets smaller. Under 700 pixels it still covers the app, without ⤢ or the edge.
- **Kept:** in the shared panel (`src/shared/help-panel.js`: `options.size`, `cleanHelpSize`, `loadSize`), the apps keep the width — fmIDE in the person's own UI settings (`ui.helpSize`, saved with the workspace, never from an imported file, never in a Preferences file), ExcelExporter in its browser storage (`fmide-excel-help-size`). The width is the CSS variable `--help-w` the apps already made room with, so the canvas (fmIDE) and the page (ExcelExporter) stay beside the panel.
- **Checked:** test group 42 (8 tests), then the whole suite.

## Done (H4b) — how it turned out

- **Making the videos**, whenever the screen changes:
  1. `npm run build`, then `npm run record-tutorials` (or one tutorial: `npm run record-tutorials -- time`). It needs the test tooling (`npm ci`, Chromium). Or on GitHub: **Actions → Record tutorial videos → Run workflow**; the videos are a download on the run's page ("tutorial-videos", kept 30 days).
  2. Each tutorial gets a folder in `videos/` (Git ignores it): the video `<id>.webm` (1280 × 720, no sound), its captions `<id>.srt`, and `<id>-script.md`, the script with the time each line starts.
  3. Record the voice-over by reading the script along with the video: each step waits long enough to read its line at a calm pace (150 words a minute, at least 2.5 s).
  4. Upload the video with its captions to YouTube (the owner's). The links come in H4c.
- **The scripts** (`tools/video-scripts.js`; `npm run video-scripts` writes them without times): an opening line (the title, what you'll build, where to find the tutorial), one line per step, and a closing line. The opening and closing words are `TUTORIAL_VIDEO` in `src/help/fmide-tutorials.js`. A step's line is its card text with each command read by name, or its `say`: 14 steps have one, so the voice-over never tells a viewer to press the card's own buttons (Next, Finish, Keep). The script also shows the card's text where the two differ.
- **The recordings** (`tools/record-tutorials.js`): the apps from `apps/`, nothing from the network (a request stops the recording). The recording opens the Help panel at the tutorials for the opening line, starts the tutorial with its ▶, and plays every step with the same actions as test group 33 (now `tests/helpers/tutorial-actions.js`, with a pace: at once for the tests, a person's pace for the videos). While recording, and only then, a pointer is drawn on the page (a headless browser films no mouse), it glides to what it presses, text is typed a key at a time, and each step waits for its line to be read. Nothing in the apps changed.
- **To Excel** comes in two videos: fmIDE's (the whole tutorial) and ExcelExporter's window (`to-excel-excelexporter.webm`, from when it opens, with its own captions). The script gives both times for the steps shown in ExcelExporter.
- **The six videos**, recorded here: Your first model 2:28, Time 2:53, Blocks 3:21, Templates 1:22, Your own functions 2:05, From fmIDE to Excel 1:43 (plus ExcelExporter's window, 0:55).
- **Checked:** group 35 (7 tests), then the whole suite: the scripts and captions for every tutorial in Node, and a real recording of the To Excel tutorial (both videos play, as long as the recording; captions; the timed script). Frames of the videos looked at: the Help panel with the pointer on ▶, the coach card and ring, the Templates window, ExcelExporter loading the file and generating.
- **Found along the way:** the To Excel recording showed ExcelExporter loading a file with a random name, because the step handed over the browser's temporary copy of the download. The step now keeps the download under the name fmIDE gave it (`fmIDE-system-….json`), as a person would see it.

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

- **H4b — group 35** (`tests/35-video-scripts.spec.js`, `npm run test:videos`, also in `npm run test:help`): every tutorial's script (an opening line, a line per step, a closing line; commands by name; `say`; nothing a viewer is told to press on the card), reading times, captions (numbered, in order, within each line's time, two lines of at most about 42 characters, every word said), `npm run video-scripts`, and a real recording of the To Excel tutorial.
- **H4a — group 34** (`tests/34-help-site.spec.js`, `npm run test:help-site`, also in `npm run test:help`): the index, topic, tutorial, all-in-one and ExcelExporter pages; every link; command names and tabs against fmIDE; hostile help text; a missing command or topic stops the build; the security policy; not in the offline copy; phone width.
- **H3 — group 33** (`tests/33-tutorials.spec.js`, also in `npm run test:help`): every tutorial played through as a person would (every step has an action, moves on, and points at something on screen); your model, undo history and title back unchanged; Exit, Skip and Back; refused commands; a reload mid-tutorial; Download what I built; the welcome card (first start only, corner, blocking nothing, its choices); the 🕒 button clickable.
- **H2 — group 32** (`tests/32-help-context.spec.js`, also in `npm run test:help`): the ribbon tip (name, shortcut, sentence, Learn more, F1 while it shows, a disabled button, an operator's topic); the "?" on nine windows, opening its topic above the backdrop with the window still open; every `addWindowHelp` names a topic that exists; Help in the touch menu (real touch input); ExcelExporter's ❓ Help and F1, the page narrowing, the "?" beside its headings, its topics and See also links, no request.
- **H1 — group 31** (`tests/31-help.spec.js`, `npm run test:help`): opening and closing (F1, ❓, the ribbon, `fm.command('openHelp')`, Esc); shortcuts still working with the panel open; every command has a sentence and no sentence names a missing command; every command and topic a topic names exists; search finds topics and commands, and a command's ▶ runs it (disabled when the command is); help topics in the Command Launcher; a customised ribbon gets the Help group once; tooltips carry the sentence; the panel at tablet size; no network request.
