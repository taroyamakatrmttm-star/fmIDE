# Step 17 — Phones: made for the hand, not a smaller screen

The owner's request (8 October 2026): bring the apps to phones. The owner chose the recommended scope: **on a phone a person looks at a model and adjusts it; building stays on a tablet or computer**, and fmGraph comes first. The owner added: the phone's own controls (fmGraph's slider first of all) must be **pleasant and easy to use, built for a hand that moves around** — "not just a compromised small-screen app. There must be something only a smartphone excels at."

This is the brief (P0), approved by the owner on 8 October 2026 with the five recommended choices below.

## Why

- **A model goes where its people go.** A meeting, a site visit, a train: "what if volumes fall 10%?" answered from a pocket.
- **Showing beats sending.** A phone passed across a table, with a finger moving a slider, explains a model better than a file sent by email.
- **Today's apps don't fit.** Step 9 made them work by touch on a tablet. On a phone the ribbon, the canvas and the windows are too large; browser sliders are hard to grab and to set exactly.

## What a phone does better than a computer

The phone layouts are built around these, not around what has to be left out:

1. **The thumb.** One hand; what is used most sits at the bottom of the screen, in reach of the thumb holding the phone.
2. **Several fingers at once.** A mouse moves one thing at a time; two thumbs move two sliders together and the bars follow both. Only a touchscreen can do that.
3. **Turning it.** Upright for working, sideways for showing.
4. **Being in the room.** Held out to someone, passed round a table; the screen stays on while it is being shown.
5. **Feel.** A small tick under the finger when a slider passes a round number or comes back to the model's own number (where the phone allows it: Android; Safari on an iPhone gives web pages no vibration, so there the tick is seen, not felt).
6. **The share sheet.** The phone's own Share button sends a picture of a board, a `.fmide` file or a workbook straight to Messages, Mail, AirDrop or Excel. The app itself still sends nothing: the person picks where it goes, as with a download today.

## What counts as a phone

A touchscreen (`pointer: coarse`) whose **shorter side is under 600 pixels**, upright or sideways. Tablets, touchscreen laptops and narrow desktop windows keep today's layout exactly. The phone layout is a `body.phone` class worked out once at start (and again if the screen changes), so a test can be sure what it is looking at. ☰ → **Full app** switches a phone to the full layout (remembered, the person's own setting), and back.

## P1 — fmGraph on a phone

### Upright: the board above, the sliders under the thumb

- **The top bar** keeps the model's name and the board's name; Open…, ↻ From fmIDE, Boards, Scenarios, Help sit in ☰.
- **Boards** change with a swipe sideways across the bars (dots show where you are), as well as from ☰.
- **The bars and charts** fill the screen in one column and scroll up and down.
- **The slider dock** sits along the bottom, in reach of the thumb. It shows one slider, large; a swipe along the dock moves to the next slider (its name and dots above). Drawn up, it shows every slider as a list; drawn down, it gets out of the way.

### The phone slider — the heart of it

fmGraph's sliders are today the browser's own (`<input type="range">`). On a phone those have a small knob, jump to wherever the finger lands and are hard to set exactly. The phone slider is fmGraph's own control:

- **Grab anywhere along it.** The value moves with the finger from where it is — it never jumps to where the finger landed.
- **The number above the finger**, large, because the finger hides the knob; the change from the model's own number beside it (+12%).
- **Finer by sliding the finger up.** Moving the finger up, away from the slider, while dragging makes each movement count for less — ×½, ×¼, ×⅒ — shown as "Fine ×¼". Coarse and exact in the same gesture, without letting go (the way a phone's video player scrubs).
- **A notch at the model's own number**: the slider settles there when it passes close, with a tick. Ticks at round steps too.
- **Exact when wanted:** tapping the number opens the number keyboard; − and + step it (held down, they repeat and speed up).
- **Double-tap** puts the slider back to the model's own number.
- The calculation is the one fmGraph already has (`03-calc.js`: results kept per set of slider values, steps worked out ahead on a slow model), so the bars move with the finger.

### Holding a bar: a quick look

Holding a bar opens a card while the finger stays down: its value in every period as a small line, its own number against the model's, and 🔍 Trace. Lifting closes it. Quick to check, nothing to close afterwards.

### Sideways: the mixer and showing

- **The mixer.** Turned sideways, the sliders become upright faders side by side under the board (two to four, the person picks which). Each thumb or finger moves its own fader, at the same time — volume and price together, the bars following both. Each set of positions is worked out once.
- **Show.** Holding a chart, then **Show**, puts it on the whole screen, large, with the mixer under it, and keeps the screen on while it is shown (the browser's Wake Lock; it ends when Show ends).

### Scenarios as cards

The saved scenarios become cards to swipe through; a tap shows one. **Hold A to look**: while a finger holds the A button, the bars show scenario A; on letting go they come back. Comparing becomes a gesture rather than a setting.

### Share

⇪ Share (in ☰ and on Show) gives the phone's share sheet a **picture of the board or chart** (drawn on the phone from fmGraph's own drawing; nothing is sent first) or the **board file**. Where the browser can't share files, it downloads them as today.

### Left out on a phone

Building and editing charts, arranging the grid, wide or narrow, colours, Export for a template, Attach to template, Add boards from templates, and fmGraph's tutorials (they practise building charts). They stay on a tablet or computer, and ☰ → Full app shows them. Everything made elsewhere (boards, charts, scenarios) shows and works on the phone.

## P2 — fmIDE on a phone: open, adjust, watch

fmIDE on a phone opens to **numbers, not the canvas**. A bar along the bottom: **Inputs · Watch · Canvas · ☰**.

- **Inputs**: every input rectangle as a row (by canvas, with a search box), its number in the chosen period. Each number is changed with the same control as fmGraph's slider: drag sideways across the number to change it, finger up for finer, tap to type. A change is an ordinary change: undo (↶ at the top), the document marked unsaved, the autosave.
- **Watch**: the results the person stars (★ on any rectangle), at the top of the Inputs screen while an input is being changed, each showing how far it has moved. The person's own setting, never in a file. Watching what matters while changing what drives it, on one screen.
- **Periods**: swiped along a strip under the top bar.
- **Canvas**: to look at, not to edit — fitted to the screen, pinch to zoom (step 13b), a canvas changed by a swipe at the edge. Tapping a rectangle opens a card: its value in every period, what it is worked out from (in words), what reads it, ✎ for an input, ★ Watch.
- **☰**: Open…, Open Recent, Save, ⇪ Share the document (the share sheet), Open fmGraph (the phone fmGraph, with the model), Make Excel (P3), Install fmIDE, Help, Full app.
- **Install**: Safari on an iPhone may clear a website's saved data after some weeks without a visit; an installed app (Add to Home Screen) keeps it. The phone layout says so once, with how to do it, and reminds the person to save a document they care about.
- **Left out on a phone**: everything that builds — the ribbon, drawing and wiring, templates, recipes, functions, macros, Formats, Preferences, tutorials. ☰ → Full app shows them.

## P3 — ExcelExporter on a phone: make the workbook

One screen: the model's name, its tabs listed (with the layout already remembered for it, or the automatic one), and **⬇ Make the workbook**, which hands the `.xlsx` to the share sheet (so it opens straight in Excel, or goes into Mail), or downloads it where sharing files isn't available. Opened from fmIDE's ☰ → Make Excel, the model arrives as it does today. Layout editing, the Excel style and Sensitivity's settings stay on a larger screen (whatever was set there is used).

## Shared pieces

What fmGraph and fmIDE both use — the phone check, the number control, the tick, the share helper — goes once in `src/shared/` (Apache, like both). ExcelExporter uses only the phone check and the share helper; no code moves between ExcelExporter and the open part.

## Rules that do not change

- Nothing loads from or sends to another site; the security policy stays as it is (the share sheet, Wake Lock and vibration are on the phone itself).
- No file format changes. The phone-only settings (Full app, the watch list, the mixer's faders) are the person's own settings, never taken from a file.
- Text from files is shown as text, as everywhere.
- On a tablet and a computer nothing changes; every existing test group stays as it is.

## How it will be tested

- Chromium with a phone's screen (390 × 844 and 412 × 915, and both sideways), a touchscreen, and real touch input through the Chrome DevTools Protocol — several fingers at once for the mixer (the two-finger helper from step 13b, extended). Each test checks the page used the phone layout.
- The share sheet, Wake Lock and vibration are replaced inside the test page by stand-ins that record what they were given; the apps are not changed for testing.
- The phone slider: grabbing without a jump, finer by moving up, the notch and the tick, typing, − / +, double-tap; the bars matching fmIDE's numbers (the snapshots of test group 18) after each.
- **Safari on a real iPhone can't run here.** For each phase the owner tries the pull request's preview address on their own phone; the pull request lists what to try.

## Phases — one pull request each

| Phase | What |
|---|---|
| P0 | This brief |
| P1a | fmGraph: the phone layout, the slider dock and the phone slider, swiping between boards, holding a bar |
| P1b | fmGraph: the mixer, Show with the screen kept on, scenario cards and Hold A, Share |
| P2a | fmIDE: the phone layout, Inputs, Watch, periods, the canvas to look at and its cards |
| P2b | fmIDE: Save and Share, the install note, Open fmGraph from the phone |
| P3 | ExcelExporter: make the workbook and share it; Make Excel in fmIDE's ☰ |

Each phase adds its What's new entry, help topic and tests.

## The owner's choices (8 October 2026: all five as recommended)

1. **The share sheet** — **use it (chosen)**: the person chooses where a picture, document or workbook goes, as with a download; the app sends nothing itself. Or: downloads only.
2. **Tilt to move a slider** (tilting the phone sweeps the chosen slider; an iPhone asks permission first) — **later (chosen)**: the mixer and the fine drag give more for less; it can come after P1b if wanted. Or: in P1b.
3. **The tick** — **on, with a switch to turn it off (chosen)**; felt on Android, seen on an iPhone.
4. **What counts as a phone** — **the shorter side under 600 pixels, on a touchscreen (chosen)**, so a tablet keeps today's layout. Or: by window width alone.
5. **Full app on a phone** — **offered in ☰ and remembered (chosen)**. Or: never.

## Later ideas, not in this step

Tilt to sweep; a phone tutorial; receiving a `.fmide` from another app's share sheet (Android only); light editing in fmIDE on a phone (rename, add a rectangle) through the hold menu of step 9b.

## How it turned out

**P0** (8 October 2026): this brief, approved with the five recommended choices.

**P1a** (8 October 2026): fmGraph's phone layout, as above, with these details settled while building it:
- **The large number is the one above the finger.** A bubble with the number over the knob covered the number just above it, so the bubble now says only how fine the drag is ("fine ×¼"), kept inside the slider.
- **The quick look stays open after the finger lifts**, as a phone's own long-press menus do, so 🔍 Trace can be tapped; a tap around it, × or Esc closes it.
- **A change by %** says what it does to the first period's number ("900 (−100)").
- **Sideways**, the dock is one low row (the number, − / + and the slider side by side) and the bars sit two to a row, so the board keeps most of the screen; P1b's mixer is for sideways.
- Shared: `src/shared/phone.js` and `phone.css` (the phone check, the tick, `createPhoneSlider`), ready for fmIDE in P2. fmGraph's part: `05g-phone.js`. The person's own settings: `fmgraph-full-app`, `fmgraph-vibrate`.
- Test group 68 (`tests/68-fmgraph-phone.spec.js`, `npm run test:phone`): 12 tests.

**P1b** (9 October 2026): the mixer, Show, holding A and Share, with the owner's four choices (the board's first four sliders on the mixer, a tap on a fader's name to swap, remembered per board; finer by sliding sideways off a fader; in Show a picture of that chart, from ☰ of the whole board; holding A on the scenario cards and on the compare strip). Settled while building it:
- **The mixer sits at the screen's two edges**, under the thumbs holding a phone sideways, with the board between them (fewer faders on the left: one fader goes right). Under the board, a phone 390 pixels high left too little room for the bars.
- **Holding A** starts after a fifth of a second; a shorter tap still compares, as before. While held, the sliders stay where they are and a strip says what is being looked at.
- **A chart's quick look** lists its rectangles' numbers in the period it shows (columns: the first), with Trace and Show.
- **The picture**: 1,080 pixels wide; the board's and model's names, where the sliders are (and A), each widget's name, its drawing (at most 1.8 times its own size, so a bar's text keeps the charts' size), a chart's key as words, its problems, "Made with fmGraph". Drawn on the phone: the SVG with its look written in, as an image (which runs nothing), names as canvas text.
- **Tests**: the share sheet and Wake Lock are stand-ins put in the page by the test. A finding while testing: Chromium's touch emulation takes a drag that lifts while moving as a fling, and the next tap only ends it (P1a's code too); the tests' drags stop before lifting, as a finger does. On a real phone, worth trying: a quick flick across the bars, then a tap straight away.
- Test group 69 (`tests/69-fmgraph-phone-show.spec.js`): 9 tests. Group 68's sideways test now expects the mixer (changed on purpose).

**P2a** (9 October 2026): fmIDE on a phone, with the owner's four choices (an input with a number per period changed in the period shown, or all periods by %; the slider's range half the number either way, any number typed; the Watch list kept in this browser per document, never in a file; an input on a canvas used as a block listed and marked). Settled while building it:
- **A change is one undo step per gesture**, pushed on the gesture's first change, so a touch that moves nothing leaves no step; the calculation runs once per frame while a finger moves.
- **The notch** is the number when the document was opened, and Watch measures from there too ("since you started").
- **The canvas is held still** by stopping every press at the canvas; a rectangle's card opens on the tap's click (opened on the lift, the click landed on the card's dim background and closed it again).
- **One period**: the strip of periods is left out.
- **The layout is decided once, at start.** A phone's screen keeps its size: the on-screen keyboard shrinks the window, not the screen, and turning the phone swaps its sides. Found through test group 27, which imitates a tablet's keyboard by shrinking the window: the test browser shrinks the screen with it, and a tablet briefly read as a phone.
- **Kept**: `fmIDE-phone` in the `fmIDE` database (Full app, the tick's switch, the Watch lists), apart from the workspace, which is written into documents.
- Test group 70 (`tests/70-fmide-phone.spec.js`): 8 tests. Found while testing: a test's file in a folder named after a title with ★ or − didn't reach the page's file box; the tests write theirs to a plain temporary folder.

**P2b** (9 October 2026): getting the work out of fmIDE on a phone, with the owner's three choices (Make Excel in fmIDE's ☰ comes in P3, with ExcelExporter's phone screen, so it never leads to a squeezed desktop page; the install note once, until Got it, with ⤓ Install fmIDE kept in ☰; sharing the document doesn't count as saving). Settled while building it:
- **⇪ Share the document** hands the shared `shareFiles` the `.fmide` file exactly as Save writes it, named as Save would (`withDocExt`, a name made safe). "Shared a copy…" or "Downloaded a copy…"; a cancelled share says nothing. The document stays unsaved.
- **On Android**, Chrome's share sheet may take only some kinds of file (pictures, text, PDF…); a `.fmide` is then downloaded instead. Safari on an iPhone shares any file.
- **💾 Save** on a phone is the download with its name box, as on any browser without a save picker; the box fits the screen and its text is large enough that the phone doesn't zoom in.
- **📈 Open fmGraph** opens fmGraph with the model as on a computer, and fmGraph shows its phone layout. On an iPhone's installed app, whether the window link carries the model is for the owner to try.
- **The install note** shows only on the published site (a manifest; from disk there is nothing to install), not inside the installed app (`display-mode` or an iPhone's `navigator.standalone`), and after the phone's settings are read, so it doesn't flash. On an iPhone it gives Safari's steps; elsewhere the browser's offer becomes an Install button, else the browser menu's steps. Its "seen" mark is `installNoteSeen` in `fmIDE-phone`.
- A message (toast) sits above the phone's bottom bar.
- Test group 71 (`tests/71-fmide-phone-share.spec.js`): 7 tests; the share sheet and the browser's install offer are stand-ins put in the page by the test.

**P3** (9 October 2026): ExcelExporter on a phone, and 📊 Make Excel in fmIDE's More (☰), with the owner's three choices (the tabs read-only; the file name changed with a tap, kept with the model's layout; a model file opened on the phone too). Settled while building it:
- **The tabs listed are the workbook's own**: it is built (without downloading) when the model or layout changes, so the Inputs, Sensitivity and Functions tabs, block instance tabs and chart tabs show as they will be; a tab laid out in the page shows its row count, as the Tabs panel does, a chart tab says "chart".
- **⬇ Make the workbook** writes the same workbook as Generate (a test compares their formulas and values) and hands it to the shared `shareFiles` within the tap, as a share sheet requires; a name no phone can save under is made safe.
- **Messages and "differs from fmIDE"** sit at the top, as on the full page.
- **On Android**, as with fmIDE's document, Chrome may not share an `.xlsx`; it is then downloaded.
- The shared code ExcelExporter uses is only `phone.js`'s phone check and share helper (Apache, in `src/shared/`); nothing moved from the open part into ExcelExporter or back. Its own setting: `fmide-excel-full-app`.
- Test group 72 (`tests/72-excel-phone.spec.js`): 8 tests.

Step 17 is done. The later ideas above (tilt to sweep, a phone tutorial, receiving a file from another app's share sheet, light editing) wait for the owner.

