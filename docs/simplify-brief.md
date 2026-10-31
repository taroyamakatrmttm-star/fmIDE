# Simplify for inputs — the brief

The owner's idea of 1 November 2026, outside the build order. Approved for phase 1 on 1 November 2026 with all six recommended choices, plus "turning × Negative one into a minus where safe", and "I want to remove as much as possible".

## The idea

The person chooses inputs and a range for each; every other input stays at today's number. Anything whose values can't change within those ranges is removed, so the model shows only what those inputs move. In the owner's words: "i am making step by step tutorial using fmShowcase. I want to start from simple transactions and add more transaction on top of what we used previously. I don't want users to download excel model with calculations they did not learn yet."

## The three phases

1. **fmIDE: File → Simplify for Inputs…** — a copy of the model holding only what the chosen inputs move (this phase).
2. **Make Showcase Viewer…: "Simplify to the sliders"** — each lesson's viewer, and the ExcelExporter workbook it carries, holds only what its sliders move. Waits for the owner's approval.
3. **Later: a lesson list in the batch tool's recipe** (`tools/make-viewers.js`), one viewer per lesson from one full model.

## How "moves" is decided (`src/shared/simplify.js`)

- **The runs**: every step of each input on its own, the others at today's numbers (a slider stands only on its steps, so this is everything one slider can reach; more than 401 steps are thinned to 101, ends kept); every corner — each input at its minimum or maximum — for up to 10 inputs (1,024 random corners for more); 200 random combinations of steps; each scenario of the document's boards as one more run. At most 3,000 runs.
- **Compared**: every item (value rectangle, operator, alias, period shift, function; a block instance by its outputs) in every period, as a number or an error code. Two numbers are the same within 1e-9 × max(1, |value|), the agreement tests' tolerance. The same error in every run is "not moving"; an error in some runs and not others moves.
- **Loops** are already errors in the calculation (`cycle`) and are compared like any error. **Period shifts** are compared in every period.
- **The check**: the copy is worked out at every run and at 50 fresh random combinations (with two inputs or more), and everything it keeps must give the full model's numbers. What doesn't is kept with its calculation and the copy made again (at most three times); something only a fresh run moved is added. The result says `checked`.

## What the copy keeps

- What moves, with what it reads. Where a kept item reads something that never moves, that one **stays where it is as a fixed number** (choice 2A): a value rectangle with its arrows in cut, holding its number (a number per period when they differ); an input stays as it is; an operator or a function becomes a value rectangle where it was ("Profit (fixed part)"); a block's output a rectangle beside the block ("Depreciation – Out").
- **Never fixed**: a period shift (it stays, and what it reads is fixed, so the first period's "outside the timeline" rule still uses the reader's own number), an item with an error in some period (it stays with its calculation), an alias (followed to what it shows).
- **Zeros dropped**: a fixed 0 in every period is dropped where that changes nothing — from a +, from a − when not its first input (a plug into a socket counts); elsewhere (a ×, a max, an if's input) the 0 stays.
- **× −1 folded** (the owner's request): a kept × with two inputs, one a fixed −1 in every period, feeding the second input of a + or − with exactly two inputs (not a socket) and nothing else: the + becomes − (the − becomes +), and the × goes — its other input feeds the + or − straight when it sits after the first input, else the × becomes an alias of it in its place. The −1 goes when nothing else reads it. Exact: a + (−x) is a − x in floating point.
- **Blocks**: an instance that moves stays, and its definition canvas stays whole (the inside is never trimmed: every instance shares it). An instance that doesn't move goes; a definition no kept instance uses goes.
- **Board rectangles** (choice 4A): a bar or chart part that never moves stays as a fixed number, unless it is 0 in every period. The copy's boards and showcase lose what names a rectangle that is gone, and a chart left showing nothing.
- **Keep anyway**: an item or a whole canvas, kept with its own calculation back to the rectangles it reads (which are fixed in turn). The window redoes the copy at once from the same runs; Open the copy works it out again, checked.
- **Canvases** left empty go; the ones that stay are **unlinked from their templates** (so an update can't put back what went). **Positions, sizes and formats are kept** (choice 5A): each lesson's items stay where the student saw them.
- **Its name** is "‹name› (simplified)"; it opens as a new, unsaved document; the model it came from is never changed.
- **The note** (choice 3A): workspace v16's `simplified` (`docs/file-formats.md`), shown in a banner on the copy — "Simplified from “X” for Equity contribution (0 to 100), Draw down (0 to 200). Its 3 fixed numbers are right only while the other inputs stay as they were." — with **What was removed…**.

## Measured on the owner's model (Node, 1 November 2026)

`fmIDE-workspace-2026-10-31T19-08-53-174Z.json`: 605 nodes (528 items without the aliases plugs make) on 29 canvases, 5 periods; one calculation 15 ms.

| Inputs | Runs | Time (with the check) | Kept | Canvases |
|---|---|---|---|---|
| Lesson "01 PIC": Equity contribution 0–100 by 0.5, Draw down 0–200 by 5, period 2 | 496 | 6.3 s | 154 of 528 items | 14 of 29 |
| Equity contribution alone | 201 | 2.4 s | 64 of 528 items | 7 of 29 |

Measured without the boards' own rectangles and scenarios (the window adds them: bars that never move stay as fixed numbers unless 0). On the lesson: 40 zeros dropped, 3 fixed numbers (Negative one, Interest rate, Interst Payable outstanding), the check passed. Equity contribution never makes the revolver draw in this model (0 to 100, at 5% interest or at 0), so the revolver and its interest go either way: the rule follows the numbers, not the arrows (following the arrows reached 248 items).

**Negative one is not folded on this model**: each of its six × feeds a named rectangle straight (COGS = −(sum of its plugs)), not a + or −, and no operator negates a single input, so there is no exact rewrite. See the ideas below.

## The API

`fm.simplifyPlan({ sliders, inputs, keep })` and `fm.simplifyForInputs({ sliders, inputs, keep, name, download, discardChanges })` (Promises, `returns: 'value'`, `macro: false`, never recorded: they work for seconds and make a document, not a node or canvas); `fm.simplified()` the open document's record.

## Ideas for removing more (not built)

- **A fixed 1 dropped from a × or a ÷ (after its first input)**: x × 1 = x exactly.
- **A × −1 into a named rectangle**: no exact rewrite with today's operators. A negation operator (or a − with one input meaning negation) would need a calculation and file-format change in both apps; or the sign could be pushed into the rectangle's readers when every one is a + or −, but that changes the rectangle's own number.
- **A chain that only passes a value along** (a rectangle fed by one arrow and read by one, holding the same number): could be bypassed, but it removes a name a lesson may want to show.
- **Unused function definitions** in the copy's `functions` (only those its function nodes call).
- **Fixed numbers gathered on one canvas** ("Given in this lesson") instead of staying where they were (choice 2B), for lessons that want the givens in one place.

## How phase 1 turned out

Branch `claude/simplify-to-sliders-5cfd71`. `src/shared/simplify.js` (Apache, shared; fmIDE now, the batch tool in phase 3), fmIDE's `11h-simplify.js` (the window, the copy, the banner) and `14e-actions-simplify.js` (the API), workspace v16 with `cleanDocumentSimplified`. Help topic `simplify`, What's new, lesson 8.5. Tests: group 100 (`tests/100-simplify.spec.js` in Node, `tests/100-simplify-fmide.spec.js` in fmIDE).
