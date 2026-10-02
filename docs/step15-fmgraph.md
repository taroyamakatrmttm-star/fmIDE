# Step 15 — fmGraph: see how a value moves the model

The owner's request (2 October 2026): a third app beside fmIDE and ExcelExporter, **fmGraph**, where a person can *literally see* how a value affects the rest of a model. Two building blocks: **bars**, showing a rectangle's value in one period or several chosen periods, and **sliders**, changing an input rectangle's value in one period or several. Moving a slider moves every bar that depends on that input, directly or through other rectangles. From these two blocks a person builds their own views — the two use cases asked for are a **balance sheet as a stacked column chart** and an **income statement as a waterfall chart**. Views can be shared in the community library.

## Why

- **Understanding a model.** In a spreadsheet dependencies hide in cell references; fmIDE draws them, but you still follow the arrows yourself. Dragging a slider and watching revenue, margin, cash and equity move together makes them felt.
- **Checking a model.** A bar that moves when it shouldn't (or stays when it should move) points at a wrong arrow: fmGraph is a checking tool as much as a presentation tool.
- **Talking to people who don't build models.** "What if volumes fall 10%?" answered live, by mouse or by finger on a tablet.
- **Teaching.** Why a balance sheet balances is easy to show when both stacks grow together.
- **The library comes alive.** A pack holding a model and its board can be tried before it is added.

fmGraph is a **lens** on a model, not a dashboard or reporting tool: everything in it serves seeing how values depend on each other.

## What was agreed (decision 10, 2 October 2026)

1. **Licence: open.** fmGraph (`src/fmgraph/`, `apps/fmGraph.html`) is under the Apache License 2.0, like fmIDE, and uses `src/shared/` freely. No code moves between fmGraph and ExcelExporter.
2. **fmGraph never changes the model.** A slider is a "what if" laid over the model, with Reset; nothing is written back to fmIDE.
3. **Boards that span several canvases are shared as attachments of system templates.** Today only canvas templates carry attachments (`attachments.excel`, step 11c); system templates will be allowed to carry them too, starting with `attachments.graph`. fmIDE never reads inside it.
4. **A standalone app**, opening from fmIDE as ExcelExporter does (decision 5: still one installable app). Later, a **live link** lets edits in fmIDE update an open fmGraph straight away, inside the browser, nothing sent anywhere.

Why standalone rather than a panel inside fmIDE (the owner left this to the recommendation): a person showing a model to others wants a clean screen with only the board, not the builder around it; fmIDE stays as large as it is; fmGraph follows a pattern the build, the site and the tests already have (ExcelExporter); and the live link gives most of what a panel would — the model in fmGraph follows fmIDE as it changes. Since fmGraph is open, as fmIDE is, its board could still become a panel later without a licence question.

## The design

### Bars

- A bar shows **one rectangle in one period**. A bar *series* is one rectangle across chosen periods: one, a list, a range or all.
- Each bar keeps a faint **ghost** of its value before any slider moved, with the difference as a label (+12.4, +3.1%).
- While a slider moves, the bars it reaches are highlighted and the others dimmed (worked out from the model's dependencies, not from which values happened to change).
- A rectangle whose calculation fails (dividing by zero, a missing input) shows a marked bar with the message from the shared calculation.

### Sliders

- A slider connects only to **input rectangles** (the shared rule, `src/shared/input-rule.js`), so it never fights a formula.
- Modes: **set** the value, **shift by a percentage**, over **one period, chosen periods or all periods**; later, a growth rate across periods.
- Range: by default ±50% of the value it starts from, editable, with a step; the slider **snaps to its steps**.
- **Reset** (one slider) and **Reset all**.

### Charts are arrangements of bars

A chart holds several series and lays out their bars:

- **side by side** — a column chart;
- **stacked** — the balance sheet: assets in one column, liabilities and equity in the other, per period, with a **balance check** marked when the two stacks differ;
- **waterfall** — the income statement: from a starting rectangle (Revenue), each step adds or subtracts, and the subtotals (Gross profit, EBIT, Net income) are rectangles the person picks, so the chart follows their model, not a fixed layout.

Axis labels come from the units (`unitOf`); a stack mixing units is warned about.

### Exploring (a later phase)

- **Trace**: click a bar to see which sliders reach it; click a slider to see everything it reaches.
- **Biggest movers**: the rectangles that changed most with the last move.
- An **A/B snapshot** to compare two "what ifs".

### Calculating: live, or worked out ahead

Each slider position needs the whole model worked out again (`evaluateModel` on a copy of the model with the slider's values). The owner is happy to wait for fmGraph to work results out first if that makes the sliders smooth. The plan:

- **Measured first (G1).** On the sample models the shared calculation is expected to be fast enough to work out on every move (at most once per screen refresh). `npm run bench` gets an fmGraph line.
- **Worked out ahead where needed.** When a model is too slow for that, grabbing a slider works out the results of **each of its steps** ahead, in small pieces so the page stays responsive ("Working…" shows meanwhile), and keeps them; dragging then only reads them. Because the slider snaps to its steps, every value shown is exact — nothing is guessed between steps.
- **Why not everything ahead:** with several sliders, every combination of their positions is a different model; the number of combinations grows too fast (two sliders of 41 steps: 1,681 calculations; three: 68,921). So results are worked out for **the slider being moved, with the others where they are**, and set aside when another slider moves.
- Later, if needed: work out again only what depends on the moved input (the dependencies are already in the shared calculation).

### Files and where boards live

- A new file kind, **`fmIDE-graph-board`** version 1: the board's widgets, which rectangles and periods they show, slider ranges and steps, and the layout. Read through the single reader, with kind, version and upgrade steps like every other kind, documented in `docs/file-formats.md`.
- Rectangles are referred to by **canvas and node id**, with the rectangle's name as a fallback inside template modules (as ExcelExporter's module layouts), so a board survives "Update this canvas".
- A board is **remembered in the browser per model** (as ExcelExporter's layouts), can be **exported and imported**, and travels inside a `.fmide` **document** (a workspace version adding `boards`).
- **Sharing:** a board as a template attachment, `attachments.graph` — on system templates for boards across canvases (decision 10.3), on canvas templates for a module's own board — going with its template through documents, new versions and library packs, checked by the pack checker. Later, Browse Library's **Try in fmGraph** opens a pack's model and board without adding anything to your library.

### The usual rules

- One self-contained HTML file in `apps/`, built from `src/fmgraph/`, also in the installable web app's `site/`; no network calls, works offline; **no chart library** — its own SVG drawing.
- Every text from a file (titles, labels, names) shown as plain text; colours through `safeColor`; numbers forced to be numbers; nothing from a file run as code.
- Mouse, finger and pen through `src/shared/pointer-input.js`; a slider is easy to drag by finger.
- Its own Help panel (shared `help-panel.js`), help topics, What's new, a "?" on each window; its help text under CC BY 4.0, like fmIDE's.
- The values must agree with fmIDE's: a test compares them for every sample model.

## Phases (one pull request each)

| Phase | What |
|---|---|
| **G0** | This brief, decision 10, step 15 in the build order ✅ |
| **G1** ✅ | The app: build, site, licence notice, **Open fmGraph** from fmIDE (File tab, App group), loading a model (file, drop, from fmIDE); one bar and one slider; ghost, difference label, highlighting and dimming; Reset; remembered per model in the browser; the speed measured (live or worked out ahead, as above); Help and What's new; tests, values agreeing with fmIDE |
| **G2** | Charts: side by side, stacked with the balance check, waterfall with subtotals; period choices; units; errors; sample balance-sheet and income-statement boards |
| **G3** | Editing a board: placing and sizing widgets, titles, colours, undo; the `fmIDE-graph-board` file, Export / Import; boards in `.fmide` documents |
| **G4** | Exploring: Trace, Biggest movers, animation, the A/B snapshot |
| **G5** | Sharing: `attachments.graph` on templates (system templates too), packs and the checker; Try in fmGraph from Browse Library |
| **G6** | Tutorials |

Later ideas, not in this step: blocks and vintages, line charts, a tornado chart (which inputs matter most), goal seek ("what price keeps cash above zero?"), the live link with fmIDE, phones.

## How it turned out

### G1 (the app, bars and sliders)

- **The app** (`src/fmgraph/` → `apps/fmGraph.html`, and `fmGraph.html` on the site with its own security policy and offline copy). A dark top bar: ← Back to fmIDE, the model's name, Open…, ↻ From fmIDE (only when fmIDE opened it), + Bar, + Slider, Reset all, ❓ Help. Before a model, a welcome screen with a drop box and **Try the sample model** (a small profit model and the cash it builds up, with its own starting board). Sliders on the left, bars on the right (stacked on a narrow page). Its page, styles and Back link are written for fmGraph: nothing is taken from ExcelExporter, which is proprietary.
- **From fmIDE, without a file.** fmIDE's **Open fmGraph** (File tab, App group, after Open ExcelExporter; a customised ribbon gets it once, `ui.fmGraphAdded`) opens fmGraph in its own window, which asks fmIDE for the model; fmIDE answers that window only, with the model as Save System writes it, and fmGraph reads it like any file. **↻ From fmIDE** (or Open fmGraph again) shows the model as it is now. This is the first half of the "live link": the model follows fmIDE when asked, not by itself yet.
- **Bars** show one rectangle in all periods, one period or a range; the model's own value as a dashed outline when a slider changed it, the difference above (with % when pointed at); a "!" bar and the reason for a period that can't be worked out; the unit when the model gives one. More than 8 periods: labels only when pointed at.
- **Sliders** go on input rectangles only (the shared input rule): set the number, or change it by %, in all periods, one or a range; range and step editable, 41 steps around the model's number by default; drag, arrow keys, a typed number, or a finger. **Reset** and **Reset all**.
- **What a slider reaches** lights up while it is pointed at, focused or moved (the others fade), worked out from the arrows, aliases and block outputs.
- **The calculation**: a slider lays a number per period over the input for one run of the shared calculation and puts it back — exactly as typing it in fmIDE — so fmGraph's values are fmIDE's (checked for every sample model). One slider move takes about 4 ms on the biggest sample (`npm run bench`, which now times it). On a model slower than 25 ms a run (the large generated model of the bench: about 200 ms), grabbing a slider works out its 41 steps ahead (a few seconds, "Working out this slider's steps…"), then dragging reads them.
- **Remembered**: the board for each model in this browser (not the sliders' positions); a model that changed a little keeps it (widgets matched by id and rectangle name). The board is kept in the form the G3 file will use (`fmIDE-graph-board`, version 1), and read back through the same checks as a file; the file itself (Export / Import, in documents) comes in G3. No file format changed in G1.
- **Help**: its own topics and What's new (`src/help/fmgraph-help.js`, `fmgraph-whats-new.js`, CC BY 4.0), the shared panel, F1. fmIDE's help has a topic "See how a value moves the model (fmGraph)" and a What's new entry. fmGraph's help is not yet on the site's `/help` pages (a later phase).
- **Not in G1**, as planned: charts (G2), editing a board's layout and its file (G3), trace and biggest movers (G4), sharing (G5), tutorials (G6). A rectangle that has its own number only in some periods and is fed in the others (an opening balance) is not an input, so it takes no slider yet.

## Risks

- **Scope creep** into a full dashboard tool — kept to a lens.
- **What a slider means** on an input with its own number in some periods — the modes make it explicit.
- **Speed on large models** — measured in G1, worked out ahead where needed.
- **Loops** — they already calculate in the shared code; fmGraph shows the result.
