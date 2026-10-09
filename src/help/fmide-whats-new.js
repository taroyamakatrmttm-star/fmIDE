// =====================================================================================
// What's new in fmIDE (build step 10, phase H5b; docs/step10-help.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (docs/LICENSE-CC-BY-4.0.txt), like the rest of src/help/.
// =====================================================================================
// Plain data, shown by the Help panel (src/shared/help-panel.js, options.whatsNew) and, from
// H5c, published on the site. One entry per feature a person would notice — several pull
// requests that made one feature are one entry; changes only developers see (tests, the
// source's layout, the library's tooling) are left out. Newest first.
//   { id, date: 'YYYY-MM-DD', title, summary,
//     what: [paragraphs], why, how: [numbered steps], notes: [tips], see: [topic ids] }
// Texts may name commands as {cmd:id} (a button that runs it). Test group 43 checks every
// entry: ids, dates in order, commands and topics that exist.
// **A change people will notice adds its entry here in the same pull request.**
const WHATS_NEW = [
  { id: 'phone-inputs', date: '2026-10-09', title: 'fmIDE on a phone',
    summary: 'On a phone fmIDE opens to your inputs: change them with a slider made for a thumb, and watch what they move.',
    what: [
      'Inputs: every input rectangle with a number, by canvas, with a search box. Change one with its slider (grab it anywhere, slide your finger up to make it finer, tap to type, − and +). An input with a number per period changes in the period shown, or all periods together by %.',
      'Watch: ☆ an input or any rectangle, and it stays at the top while you change inputs, with how far it has moved since you opened the document.',
      'Canvas: look at any canvas and tap a rectangle for its card: its value in every period, what it is worked out from and what reads it, in words.',
      'Each change is a real change to the model: one undo step, the document marked unsaved, the autosave. More (☰) has Open, Open Recent, Save, Help and Full app.',
    ],
    why: 'To check and adjust a model away from your desk, with controls made for a phone rather than a squeezed-down desktop.',
    how: ['Open fmIDE on a phone, open a document from More (☰), then move an input in Inputs.'],
    notes: ['Building (drawing, wiring, templates, functions, macros) stays on a tablet or computer, or More (☰) → Full app. Tablets and computers are unchanged.'],
    see: ['phone'] },


  { id: 'empty-operator-zero', date: '2026-10-08', title: 'An empty socket counts as 0',
    summary: 'An operator with nothing wired into it gives 0, as in Excel, instead of "?" spreading through the model.',
    what: [
      'An operator with nothing wired into it, such as a socket nothing is plugged into yet, now gives 0. Before, it showed "?", and so did everything that read it, all the way down to totals on other canvases.',
      'Excel already wrote such an operator as 0, so fmIDE, fmGraph and the workbook now agree, and ExcelExporter no longer lists it under "differs from fmIDE".',
      'A rectangle fed only by such an operator is still an input and uses its own number, as before; so is a block\'s input fed by one.',
    ],
    why: 'A model built from templates often has sockets nothing feeds yet (a cost line the business doesn\'t have). One of them made a whole statement, and every fmGraph bar reading it, show "?".',
    how: [
      'Nothing to do: open the model, and the rectangles that showed "?" because of an empty socket show their numbers.',
    ],
    notes: ['A recipe still warns about sockets nothing feeds when it builds, so you can see which are empty.', 'Dividing by an empty operator is still an error, as in Excel (#DIV/0!).'],
    see: ['plugs-sockets', 'operators'] },

  { id: 'share-in-library', date: '2026-10-04', title: 'Share your pack with everyone, step by step',
    summary: 'A new Share in the Community Library… window and a step-by-step guide, for people who have never used GitHub.',
    what: [
      'After {cmd:saveLibraryPack}, a window shows where the file went and the next steps, with Open the upload page, which opens the community library\'s upload page on GitHub in your browser. {cmd:shareLibraryPack} (File tab, Library group) opens the same window any time.',
      'A new Help topic, "Share your pack in the community library", goes through every step: making a free GitHub account, uploading the file, sending it for review, ticking the submission terms, what the automatic check says, and when your pack appears in Browse Library.',
      'A pack is now saved under the name the library needs: its id, a long code ending in .fmide-pack.json. There is nothing to rename before sharing it.',
    ],
    why: 'Sharing in the library meant knowing GitHub, and renaming the file by hand. Now anyone can follow the steps.',
    how: [
      'Choose {cmd:saveLibraryPack}, tick what to share and press Save Pack.',
      'In the window that opens, press Open the upload page, and follow the steps (❓ Step-by-step guide has every detail).',
    ],
    notes: ['fmIDE never sends anything itself: you upload the file in your web browser.', 'A pack saved before this has a name made from its title. Save it again, or rename it to its id, before sharing it in the library.'],
    see: ['share-library-pack', 'library-packs'] },

  { id: 'remove-old-template-versions', date: '2026-10-03', title: 'Remove a template\'s old versions',
    summary: 'Keep only the latest version of a template, or of every template, in one step.',
    what: [
      'In {cmd:openTemplates}, a template with more than one version has 🧹 Remove old versions beside its name. It removes every version but the latest, after asking.',
      '🧹 Remove older versions, under the list, and {cmd:removeOldTemplateVersions} do the same for every template in your library at once.',
      'A version still in use stays: one a canvas in the open model is linked to, one a system template\'s canvas is linked to, or one a recipe is pinned to. The question lists them, with the reason.',
    ],
    why: 'Every Save as new version keeps the version before, so a library worked on for a while fills up with versions nobody needs.',
    how: [
      'Open {cmd:openTemplates} and select a template.',
      'Choose 🧹 Remove old versions beside its name, or 🧹 Remove older versions under the list for every template.',
      'Read which versions go and which stay, then choose OK.',
    ],
    notes: ['Removing can\'t be undone. Use ⇩ Export Templates first if you might want the old versions back.', 'The latest version always stays, so the next version saved gets a new number.'],
    see: ['template-versions', 'templates'] },

  { id: 'system-template-links', date: '2026-10-03', title: 'System templates keep their canvases\' links',
    summary: 'A system saved as a template remembers which canvas templates its canvases came from.',
    what: [
      'Save System as Template, in {cmd:openTemplates}, now keeps each canvas\'s link to the canvas template it was made from, as Save System always has. Before, the links were dropped, so the canvases added back from the system template had forgotten their templates.',
      'So a system added from the template, alongside your canvases or replacing the model, still offers each canvas\'s template updates (the ⬆ on its tab), and ExcelExporter still treats those canvases as modules: their Excel layouts, the ones attached to their templates and the ones it remembers, are used again.',
    ],
    why: 'A model built from canvas templates and shared as one system template lost its modules\' Excel layouts on the way.',
    how: [
      'Open the model whose canvases came from canvas templates.',
      'In {cmd:openTemplates}, choose + Save System as Template (or ⤴ Save as new version on a system template you saved before).',
      'Add it back with Add or Replace: the canvases are still linked.',
    ],
    notes: ['A system template saved before this holds no links. Open a model made from it with the links in place and save it again with ⤴ Save as new version.'],
    see: ['templates', 'template-versions'] },

  { id: 'macro-variables-kept', date: '2026-10-03', title: 'Stepping through a macro keeps its variables',
    summary: 'Run selected step remembers what earlier steps saved; a step reading a variable nothing saves is marked.',
    what: [
      'In {cmd:openMacros}, ▶ Run selected step now keeps the variables the steps already run saved ($t1, $r3…), so stepping through a macro works like running it. Before, every step started with none, and the second step stopped with "Variable $t1 has no value yet".',
      'A step that reads a variable no step before it saves is marked ⚠ in the list, with the reason when you point at it — so a step deleted or changed since is found before the macro runs. Running it says which variables the steps do save.',
      'Undo while recording takes back only the steps recorded since the change it undoes. Before, undoing something that was never a step (a box picked up and put back) could take an unrelated step, such as an Insert Template, with it.',
    ],
    why: 'A recorded macro could lose its Insert Template step to an Undo, and stepping through any macro with variables stopped at its second step.',
    how: [
      'Open {cmd:openMacros} and choose a macro.',
      'Select its first step and press ▶ Run selected step, then again for each next step.',
      'Fix any step marked ⚠ by pointing it at a variable an earlier step saves.',
    ],
    notes: ['A macro recorded before this that lost a step keeps the ⚠ until you point the step at a variable that exists, or record it again.'],
    see: ['macro-steps', 'macro-errors'] },

  { id: 'macros-that-hold', date: '2026-10-03', title: 'Macros that keep working, and help to write them',
    summary: 'A canvas a template adds is saved for later steps; ids you can see; Copy Reference; six help topics on macros.',
    what: [
      'Insert Template now saves what it made, like New Canvas and the Create actions: the canvases it adds ($t1[0], $t1[1]… — a recipe one per part, in order) or the nodes it puts on this canvas. The recorder uses it, so a recorded "Go to Canvas" finds the canvas the macro made, even when another canvas has the same name.',
      'The recorder copes with other differences between recording and running too: a template\'s nodes without a name are referred to by their place (@all[3]), skipping recipe parts already here is recorded as that rule, and a step whose reference may not hold gets a ⚠ note saying why.',
      'Every canvas tab shows its id when you hover over it, and {cmd:copyReference} copies how a step refers to the selected nodes (or the canvas) — the name, or the id when the name is used twice. On a tablet, hold a node and choose Copy reference.',
      'The Macro Builder names the result of a step that makes something by itself, and the messages that stop a macro say what to do, listing the ids to choose from.',
      'Help has a Macros group: building a macro step by step, variables and loops, references, macros that work every time, and what each message means.',
    ],
    why: 'A recorded macro could stop with "More than one canvas is named …" and no way to find the id it asked for. Now the macro refers to what it made itself, and where it still needs an id, you can see it.',
    how: [
      'Record a macro that inserts a template on a new canvas and then goes back to it.',
      'Run it again: it adds another canvas of the same name and goes to that one.',
      'Open {cmd:openMacros}: the Insert Template step shows → $t1, and the Go to Canvas step uses $t1.',
    ],
    notes: ['Macros recorded before keep their steps: record again, or put the variable in the step by hand.', 'Ids belong to one model: a macro using #n12 in another model won\'t find it.'],
    see: ['macro-references', 'macro-reliable', 'macro-errors', 'macro-steps'] },

  { id: 'recipes-in-recipes', date: '2026-10-03', title: 'Recipes within a recipe',
    summary: 'A recipe\'s part can be another recipe, built in its place.',
    what: [
      'In the recipe window, a part can now be a recipe as well as a canvas template. Building opens it up into its own parts, in order — as deep as eight recipes inside each other.',
      'The recipe\'s details in {cmd:openTemplates} list the canvases each recipe inside builds, with Skip boxes for any already in your model. The socket check covers them all.',
      'Library packs bring the recipes inside, with their parts.',
    ],
    why: 'So a full model can be put together from smaller recipes — say, statements plus a debt schedule — without listing every canvas template again.',
    how: [
      'Open {cmd:openTemplates} and choose + New Recipe….',
      'Press + Add part and pick a recipe (marked "(recipe)") from the list.',
      'Save, then Build.',
    ],
    notes: ['A recipe can\'t contain itself, even through others: the window doesn\'t offer such a recipe, and one from a file is skipped with a warning.', 'An older fmIDE shows a recipe inside a recipe as a part it can\'t build.'],
    see: ['recipes'] },

  { id: 'canvas-switching', date: '2026-10-03', title: 'Move between canvases from the keyboard',
    summary: 'Alt+Page Down goes to the next canvas, Alt+Page Up to the previous one.',
    what: [
      '{cmd:nextCanvas} (Alt+Page Down) and {cmd:prevCanvas} (Alt+Page Up) go to the canvas tab beside the one you are on, and round from the last tab to the first. On a Mac, Option+Page Down and Option+Page Up.',
      'Both are in the Model tab\'s Canvas group and in the Command Launcher, and a macro records them.',
    ],
    why: 'A model of many canvases is quicker to move through without reaching for the mouse.',
    how: [
      'Press Alt+Page Down to go to the next canvas.',
      'Press Alt+Page Up to go back.',
    ],
    notes: ['Ctrl+Page Down, as in Excel, is kept by the browser for its own tabs. In {cmd:openShortcuts} you can choose other keys.'],
    see: ['canvases', 'launcher-shortcuts'] },

  { id: 'templates-window-tidy', date: '2026-10-03', title: 'A tidier Templates window, with Expand all and Collapse all',
    summary: 'Open or close every group of templates at once, and find each button where you expect it.',
    what: [
      'In {cmd:openTemplates}, ▾ Expand all and ▸ Collapse all under the search box open or close every group at once (Collapse all also hides older versions). Your choice is kept, as each group\'s is.',
      'The buttons are tidied: saving and the templates file in one toolbar at the top, ✎ Edit info and 🗑 Delete beside the selected template\'s name, its actions in one row under the preview, and 🧹 Remove duplicates… and 🗑 Clear all templates quietly under the list.',
    ],
    why: 'A long library is easier to scan with its groups closed, and the buttons looked scattered.',
    how: [
      'Open {cmd:openTemplates}.',
      'Press ▸ Collapse all, then open just the group you need.',
    ],
    see: ['templates'] },

  { id: 'long-messages-ipad', date: '2026-10-03', title: 'Long messages fit the screen; .fmide files open on an iPad',
    summary: 'A long message scrolls inside its window with OK always in reach, and an iPad can pick a .fmide again.',
    what: [
      'A message with a long list — building a recipe lists every socket nothing feeds — now scrolls inside its window. OK (and Cancel, in a question) always stays on the screen, on a tablet too.',
      'On an iPad or iPhone, {cmd:openDocument} showed .fmide files greyed out, so they couldn\'t be picked. Now any file can be picked there; one that isn\'t a model is refused with a message, as before.',
    ],
    why: 'On an iPad the OK button of a long message was out of reach, and saved documents couldn\'t be opened.',
    how: [
      'Scroll the message\'s text with a finger or the wheel.',
      'On an iPad, choose {cmd:openDocument} and pick the .fmide file in Files.',
    ],
    see: ['documents', 'touch'] },

  { id: 'excel-from-fmide', date: '2026-10-03', title: 'ExcelExporter opens with your model',
    summary: 'Open ExcelExporter sends it the model you have open — no file to save first.',
    what: [
      '{cmd:openExcelExporter} opens ExcelExporter with the model you have open here, as fmGraph does. Pressing it again sends the model as it is now; so does File → ↻ From fmIDE in ExcelExporter.',
      'The Excel layouts your canvas templates carry go along too.',
    ],
    why: 'Saving a file and loading it in ExcelExporter every time was a detour.',
    how: [
      'Open {cmd:openExcelExporter}.',
      'Arrange the tabs and rows there, then press ⬇ Generate .xlsx.',
      'After a change here, press {cmd:openExcelExporter} again.',
    ],
    notes: [
      'ExcelExporter remembers your layout for each model, as before: a change to numbers keeps it, while adding or deleting a rectangle starts a new one.',
      'The tutorial From fmIDE to Excel is a step shorter.',
    ],
    see: ['to-excel'] },

  { id: 'try-in-fmgraph', date: '2026-10-03', title: 'Try a library template in fmGraph',
    summary: 'Browse Library opens a template that carries an fmGraph board in fmGraph, before you add it.',
    what: [
      'In {cmd:browseLibrary}, a canvas or system template carrying an fmGraph board has 📈 Try in fmGraph.',
      'fmGraph shows the template with its board. Nothing is added to your library or document, and fmGraph keeps nothing.',
    ],
    why: 'So you can see how a shared template behaves before adding it.',
    how: [
      'On fmIDE\'s website, open {cmd:browseLibrary} and choose a pack.',
      'Press 📈 Try in fmGraph beside a template, and move its sliders.',
      'Back in fmIDE, Preview and add… adds it if you want it.',
    ],
    see: ['browse-library', 'fmgraph'] },

  { id: 'fmgraph-attach-to-template', date: '2026-10-03', title: 'fmGraph uses your templates\' boards',
    summary: 'fmGraph starts with the boards your templates carry, and can attach boards to a template for you.',
    what: [
      '{cmd:openFmGraph} sends fmGraph the boards your templates carry: a model with no boards of its own starts with them.',
      'In fmGraph, Boards → Attach to template… sends boards back here; fmIDE asks which template (for a system template) and attaches them to its latest version.',
    ],
    why: 'So sharing a template\'s views no longer needs a file in between.',
    how: [
      'Open {cmd:openFmGraph} on a model built from a template.',
      'Arrange the boards, then Boards → Attach to template….',
      'Answer the question here.',
    ],
    see: ['templates', 'fmgraph'] },

  { id: 'template-fmgraph-boards', date: '2026-10-02', title: 'Templates can carry fmGraph boards',
    summary: 'Attach an fmGraph board to a canvas or system template, and it goes wherever the template goes.',
    what: [
      'In the Templates window, a canvas or system template has 📈 Attach fmGraph board…: pick a file saved by fmGraph\'s Boards → Export for a template….',
      'The board then goes along with the template: in your documents, its new versions and library packs you share. Open Library Pack marks templates that have one (📈 fmGraph board), and offers the board for a template you already have.',
    ],
    why: 'So a template can come with the views that show how it works.',
    how: [
      'Open {cmd:openFmGraph} on a model built from the template, and use Boards → Export for a template….',
      'Open {cmd:openTemplates}, select the template, and choose 📈 Attach fmGraph board….',
    ],
    notes: ['Library packs, templates files and documents saved now are a new version: an older fmIDE asks before opening them.'],
    see: ['templates'] },

  { id: 'fmgraph-boards-in-documents', date: '2026-10-02', title: 'fmGraph\'s boards are saved in your document',
    summary: 'The bars, charts and sliders you set up in fmGraph are kept in the .fmide file, with the model.',
    what: [
      'With fmGraph opened from fmIDE, every change to its boards comes back here: the document shows unsaved changes (•), and Save keeps the boards with the model.',
      'Open the document again — here, then {cmd:openFmGraph}, or in fmGraph itself — and its boards come back, also on another computer or for someone you send the file to.',
    ],
    why: 'So a model and the views made of it travel together, in one file.',
    how: [
      'Open {cmd:openFmGraph}.',
      'Add or arrange bars, charts and sliders there.',
      'Save the document here ({cmd:saveDocument}).',
    ],
    notes: ['Moving a slider is a "what if", not a change: it never marks the document unsaved, and where sliders are set is not saved.'],
    see: ['fmgraph'] },

  { id: 'fmgraph', date: '2026-10-02', title: 'fmGraph: see how a value moves your model',
    summary: 'A new companion app: bars show your rectangles, sliders change your inputs, and the bars move as you slide.',
    what: [
      '{cmd:openFmGraph} opens fmGraph with the model you have open, in its own window — no file to save first.',
      'In fmGraph, a bar shows a rectangle\'s value in the periods you choose, and a slider changes an input rectangle. Move a slider and every bar that depends on that input moves with it; the bars it reaches light up, and a dashed outline shows the model\'s own value.',
    ],
    why: 'To see, not just read, how one number affects the rest of a model: for understanding it, checking it, or showing it to others.',
    how: [
      'Open {cmd:openFmGraph}.',
      'Add a slider on an input and a bar on a result.',
      'Move the slider. Back in fmIDE after a change, press ↻ From fmIDE in fmGraph.',
    ],
    notes: ['fmGraph never changes your model.', 'A customised ribbon gets Open fmGraph once, after Open ExcelExporter.'],
    see: ['fmgraph'] },

  { id: 'pinch-zoom', date: '2026-10-02', title: 'Pinch to zoom on a tablet',
    summary: 'Two fingers on the canvas zoom it and move it around, as on a map.',
    what: [
      'On a tablet, pinch the canvas with two fingers to zoom between 25% and 200%. It zooms around the point between your fingers, so what you are looking at stays under them.',
      'Moving both fingers together moves the canvas. One finger still scrolls, drags boxes and opens menus as before.',
    ],
    why: 'Zoom came first for the mouse and keyboard; on a tablet, two fingers are the natural way to do it.',
    how: [
      'Put two fingers on the canvas and spread them apart to zoom in, or bring them together to zoom out.',
      'Slide both fingers to move around while you zoom.',
      'Lift your fingers; the control at the bottom-right shows the zoom.',
    ],
    notes: [
      'If one finger was already dragging a box when the second lands, the box goes back where it was and the pinch takes over. Nothing is added to Undo.',
      'A pinch that ends close to 100% settles at exactly 100%. Each canvas keeps its own zoom, as with the mouse.',
    ],
    see: ['touch', 'finding-your-way'] },

  { id: 'zoom', date: '2026-10-02', title: 'Zoom the canvas',
    summary: 'See the whole model at once, or zoom in on a detail, from 25% to 200%.',
    what: [
      'The canvas zooms from 25% to 200%: hold Ctrl (Cmd on a Mac) and turn the mouse wheel, or pinch on a trackpad. Ctrl + = and Ctrl + − zoom in and out, and Ctrl + 0 goes back to 100%.',
      'A control at the bottom-right shows the zoom: − and + step it, and the percentage opens a menu with every level, Fit the model and Fit the selection. View → Zoom has the same commands.',
      'Everything works the same at any zoom: moving and resizing boxes, drawing arrows, selecting with a box, snapping, typing.',
    ],
    why: 'Large models no longer fit on one screen; zooming out shows how the parts connect, zooming in makes the details easy to read.',
    how: [
      'Press {cmd:zoomFit} to see everything on the canvas.',
      'Hold Ctrl and turn the wheel over the part you want to look at.',
      'Press Ctrl + 0 to go back to 100%.',
    ],
    notes: ['Each canvas keeps its own zoom. It belongs to your screen, not the model: it is never saved in a file, and macros don\'t record it. A tutorial starts at 100% and gives your zoom back at the end.'],
    see: ['finding-your-way'] },

  { id: 'whats-new', date: '2026-10-02', title: 'What\'s new, inside Help',
    summary: 'Every update to fmIDE, newest first: what changed, why, and how to use it.',
    what: [
      'The Help panel now opens with What\'s new: the latest updates, and Every update for the whole list. Each update has its own page saying what changed, why, and how to use it, with links to the full guide.',
      'Updates you haven\'t seen yet are marked New, and ❓ at the top right carries a small dot until you have looked.',
    ],
    why: 'fmIDE changes often. This is one place to catch up on what is new, without reading technical notes.',
    how: [
      'Press F1 (or ❓) and look at What\'s new at the top, or use {cmd:openWhatsNew}.',
      'Pick an update to read its page; Back returns to the list.',
      'The search box finds updates too.',
    ],
    notes: ['Opening the list of every update marks them all as seen.', 'The same pages are on fmIDE\'s website too, at /help/whats-new/, to read or share outside the app.'],
    see: ['finding-your-way'] },

  { id: 'wider-help', date: '2026-10-02', title: 'A wider Help panel',
    summary: 'Widen Help to a reading view with ⤢, or drag its edge to any width.',
    what: [
      '⤢ at the top of the Help panel widens it to two thirds of the window, with larger text in a comfortable column; ⤡ brings it back.',
      'You can also drag the panel\'s left edge to any width, with the mouse or a finger. A double-click on the edge goes back to the usual width.',
    ],
    why: 'The narrow panel was cramped for reading longer guides.',
    how: [
      'Open Help with F1.',
      'Press ⤢ for the reading view, or drag the panel\'s left edge.',
    ],
    notes: ['Help remembers the width you chose. The canvas stays beside the panel, so you can keep working.'],
    see: ['finding-your-way'] },

  { id: 'equal-spacing', date: '2026-10-02', title: 'Snap to equal spacing',
    summary: 'A box you drag snaps where it is evenly spaced with its neighbours.',
    what: [
      'While you drag a box, it snaps where the gaps to the boxes in its row (or column) are equal: after two boxes with the same gap, before them, or halfway between them. Pink bars show the equal gaps while it snaps.',
      'It works together with lining up: whichever is nearer wins, so a box can be evenly spaced across and lined up down at the same time.',
    ],
    why: 'Neat, evenly spaced models are easier to read, and lining boxes up by eye is slow.',
    how: [
      'Drag a box next to two others in a row.',
      'Watch for the pink bars, then let go.',
      'To move a box freely, hold Alt after you start dragging.',
    ],
    notes: ['Alt pressed before the drag still makes an alias, as before.'],
    see: ['arranging'] },

  { id: 'add-many-rectangles', date: '2026-10-02', title: 'Add many rectangles at once',
    summary: 'Type or paste a list of names and get one rectangle each, neatly laid out.',
    what: [
      '{cmd:addManyRects} opens a window with a row per rectangle: type a name and press Enter for the next (a value and unit are optional), or paste a list — one name per line, or columns copied from Excel.',
      'Choose a column, a row or a grid and the gap between them. They are added in one step, where they overlap nothing, and selected so you can drag them into place.',
      'While typing in a rectangle, Ctrl+Enter (Cmd+Enter on a Mac) saves it and starts a new one just below.',
    ],
    why: 'Building a model often starts with a list of line items; adding them one by one was slow.',
    how: [
      'Press {cmd:addManyRects}.',
      'Type the names, or paste a list from Excel.',
      'Pick column, row or grid, then Add.',
    ],
    notes: ['A name already on the canvas is marked, but still allowed. One Undo removes them all.'],
    see: ['rectangles', 'arranging'] },

  { id: 'faster-long-timelines', date: '2026-10-01', title: 'Faster calculation on long timelines',
    summary: 'Models with many periods calculate many times faster.',
    what: [
      'Each period is now worked out once. Before, a period that read an earlier one (through a period shift) worked out every earlier period again. On a large model with 60 periods, a full calculation takes under a second instead of about 20.',
    ],
    why: 'Long monthly timelines had become slow to work with.',
    how: ['Nothing to do: every model calculates this way now.'],
    notes: ['Results are unchanged, except in a model with a loop (a circular reference): there a period shift now always shows the value shown for the period it reads.'],
    see: ['period-shifts'] },

  { id: 'chart-every-period', date: '2026-10-01', title: 'The 📈 chart shows every period',
    summary: 'Draw a curve from the first period to the last without scrolling.',
    what: [
      'The chart that draws an input\'s values across periods (📈 on a rectangle) shows every period at once, however many there are. With many periods, the labels along the bottom thin out and the dots get smaller; the boxes below still show each value.',
      'Its window can be resized from the bottom-right corner, and the chart grows with it. The size is remembered.',
    ],
    why: 'With long timelines the chart used to scroll sideways, so a curve couldn\'t be drawn in one go.',
    how: [
      'Select an input rectangle and press 📈.',
      'Drag the window\'s corner to make it larger, then draw.',
    ],
    notes: ['A double-click on the corner puts the window back to its own size.'],
    see: ['values-over-time'] },

  { id: 'choose', date: '2026-10-01', title: 'choose: a scenario switch',
    summary: 'Pick one of several values by number, like Excel\'s CHOOSE.',
    what: [
      'choose gives the choice its index picks: an index of 2 gives choice 2. It suits a scenario switch — 1 base, 2 upside, 3 downside. Only the choice picked is worked out.',
      'On the canvas it shows an index dot and a dot per choice, always with one empty choice at the end for the next arrow.',
    ],
    why: 'Scenario switches are everywhere in financial models, and building them from if was clumsy.',
    how: [
      'Add it with {cmd:insertOp30} (or Insert → Excel Functions).',
      'Draw an arrow onto the index dot, then one onto each choice.',
    ],
    notes: ['An index below 1 or past the last choice shows "?" (Excel\'s #VALUE!). Functions can use CHOOSE(i, a, b, …) too.'],
    see: ['timing-conditions'] },

  { id: 'more-excel-functions', date: '2026-10-01', title: 'ln, exp, sqrt, int and trunc',
    summary: 'Five more Excel functions as operators, calculated the same in fmIDE and Excel.',
    what: [
      'ln, exp, sqrt, int and trunc each take one input and give the same answer as Excel\'s LN, EXP, SQRT, INT and TRUNC. int rounds down (−2.5 gives −3); trunc cuts the fraction off (−2.5 gives −2).',
    ],
    why: 'Growth rates, compounding and whole-number steps need them, and they used to need a workaround.',
    how: [
      'Find them on Insert → Excel Functions, in the palette, or in {cmd:openLauncher}.',
      'Draw one arrow into the operator.',
    ],
    notes: ['The log of 0 or less, the square root of a negative number and e to too large a power show "?" (Excel\'s #NUM!).'],
    see: ['operators'] },

  { id: 'template-excel-layout', date: '2026-09-30', title: 'A template carries its Excel layout',
    summary: 'Attach a module\'s Excel layout to its template, so it travels with it.',
    what: [
      'In the Templates window, a canvas template can carry the Excel layout ExcelExporter remembers for it: 📎 Attach Excel layout… takes it from a file saved by ExcelExporter\'s Export Module Layouts; Remove takes it off.',
      'It goes wherever the template goes: documents, template files, the next version you save, and library packs you share. ExcelExporter uses it to lay out that module\'s tab for whoever loads it.',
    ],
    why: 'A module looks right in Excel only after it has been arranged once. Now that work can be shared with the template.',
    how: [
      'In ExcelExporter, arrange the module\'s tab, then Export Module Layouts.',
      'In fmIDE, open {cmd:openTemplates}, pick the template\'s version and press 📎 Attach Excel layout…, then choose that file.',
    ],
    notes: ['fmIDE only carries the layout; it never reads or changes it. A system file (Save System) carries no templates, so no layout.'],
    see: ['templates', 'to-excel'] },

  { id: 'excel-look-moves', date: '2026-09-30', title: 'The Excel look belongs to ExcelExporter',
    summary: 'fmIDE\'s formats are the canvas look; how cells look in Excel is set in ExcelExporter.',
    what: [
      'fmIDE\'s Formats manager keeps the two canvas roles, Inputs and Calculations, and the rectangle format window no longer has Excel-only settings.',
      'Only number formats go from fmIDE to Excel. Colours, fonts and borders in the workbook come from your own Excel style in ExcelExporter.',
    ],
    why: 'Two places deciding how Excel looked was confusing. Now the canvas look is fmIDE\'s, and the Excel look is ExcelExporter\'s.',
    how: [
      'Set the canvas look in {cmd:openFormats} or with 🎨 on a rectangle.',
      'Set number formats there too; they reach Excel.',
      'Set the Excel look in ExcelExporter\'s Excel style.',
    ],
    notes: ['Older files still open; their Excel-only settings are simply dropped.'],
    see: ['formats', 'to-excel'] },

  { id: 'help-pages-site', date: '2026-09-30', title: 'Help pages on the website',
    summary: 'Every guide and tutorial as plain pages at /help on fmIDE\'s site.',
    what: [
      'The published site has help pages: every guide, grouped as in the Help panel, each tutorial written out step by step, and every guide on one page to search or print. Where a guide names a command, the page says where it is on the ribbon.',
    ],
    why: 'To read the guides outside the app, share a link, or print them.',
    how: ['Open the site\'s /help address in a browser.'],
    notes: ['The pages are made from the same text as the Help panel, so they always match.'],
    see: ['finding-your-way'] },

  { id: 'tutorials', date: '2026-09-30', title: 'Guided tutorials and a welcome card',
    summary: 'Six short tutorials that show you what to press and wait while you do it.',
    what: [
      'Six tutorials: Your first model, Time, Blocks, Templates, Your own functions, and From fmIDE to Excel. A card in the corner shows one step at a time, a ring shows what to press, and each step moves on once you have done it.',
      'On the very first start, a welcome card offers the 5-minute tour, the sample model, a blank start, or Help.',
    ],
    why: 'The quickest way to learn fmIDE is to build something, with someone pointing at the right button.',
    how: [
      'Press F1 and pick a tutorial at the top of the Help panel, or find it in {cmd:openLauncher}.',
      'Follow the card; exit any time.',
    ],
    notes: ['A tutorial runs on a practice canvas: your own model, undo history and document are set aside and come back exactly as they were. Templates or functions it saves are taken out again unless you tick Keep on the last step.'],
    see: ['first-model'] },

  { id: 'help-where-you-are', date: '2026-09-30', title: 'Help where you are',
    summary: 'Richer button tips, a ? on every window, and Help in the touch menu.',
    what: [
      'Pausing over a ribbon button shows its name, shortcut and what it does (even when it is greyed out, with why), and Learn more opens its guide; F1 while the tip shows does the same.',
      'Every window has a ? in its corner that opens its guide beside it. On a tablet, holding a box offers Help for that kind of box.',
    ],
    why: 'Help is most useful at the moment you are wondering what something does.',
    how: [
      'Pause over any ribbon button, or press ? in a window\'s corner.',
    ],
    see: ['finding-your-way'] },

  { id: 'help-panel', date: '2026-09-29', title: 'Help inside fmIDE',
    summary: 'Press F1 for plain-English guides to every part of fmIDE, beside the canvas.',
    what: [
      'The Help panel holds plain-English guides to every part of fmIDE, grouped, with a search box. It sits beside the canvas, so you can follow the steps while you work, and shortcuts keep working.',
      'A command named in a guide is a button that runs it; searching also lists matching commands. The Command Launcher finds guides too.',
    ],
    why: 'So the answer to "how do I…" is always one key away, even offline.',
    how: [
      'Press F1, ❓ at the top right, or {cmd:openHelp}.',
      'Search, or pick a guide.',
    ],
    see: ['finding-your-way', 'launcher-shortcuts'] },

  { id: 'back-to-fmide', date: '2026-09-29', title: 'Between fmIDE and ExcelExporter',
    summary: 'Open ExcelExporter brings its window back; ExcelExporter has ← Back to fmIDE.',
    what: [
      '{cmd:openExcelExporter} brings ExcelExporter\'s window to the front when it is already open, instead of loading it again and losing the model loaded there.',
      'ExcelExporter has a ← Back to fmIDE button at the top left. On an iPad home-screen app, it goes back to fmIDE.',
    ],
    why: 'Going back and forth between building and exporting should never lose work.',
    how: ['Use {cmd:openExcelExporter}, and ← Back to fmIDE to return.'],
    see: ['to-excel'] },

  { id: 'paste-free-space', date: '2026-09-28', title: 'Paste into free space; recipes skip parts already built',
    summary: 'Pasted nodes no longer pile up; a recipe reuses canvases you already have.',
    what: [
      'Paste puts the copied nodes, keeping their layout, in the nearest free space, so pasting again and again no longer piles copies on top of each other.',
      'A recipe part whose template is already in the model shows "Skip — already here as canvas …", ticked: building then uses that canvas instead of adding a duplicate.',
    ],
    why: 'Piles of pasted copies, and duplicate canvases from recipes, were easy to miss and hard to tidy.',
    how: [
      'Copy and {cmd:paste} as usual.',
      'For a recipe, open {cmd:openTemplates}, pick the recipe, check the Skip boxes, then Build.',
    ],
    notes: ['Untick Skip to add a part again on purpose.'],
    see: ['recipes', 'arranging'] },

  { id: 'resizable-windows', date: '2026-09-28', title: 'Resizable windows and the Templates tree',
    summary: 'Make the large windows bigger; templates are listed as groups that open and close.',
    what: [
      'The large windows — Templates, Functions, Format Presets, Browse Library, the pack preview, the Macro Builder and Customize Ribbon — can be resized from their bottom-right corner, and keep that size.',
      'The Templates list is a tree: each group opens and closes and stays as you left it.',
    ],
    why: 'With many templates and functions, the windows were too small to see enough at once.',
    how: [
      'Drag a window\'s bottom-right corner.',
      'Click a group\'s heading in {cmd:openTemplates} to open or close it.',
    ],
    notes: ['A double-click on the corner puts a window back to its own size. Search still finds templates in closed groups.'],
    see: ['templates'] },

  { id: 'touch', date: '2026-09-28', title: 'fmIDE by finger, on a tablet',
    summary: 'Move, connect, select and edit with a finger or a pen; the screen fits a tablet.',
    what: [
      'On a touchscreen, a finger moves nodes, draws arrows from a node\'s dot, resizes by the corner, moves canvas tabs and draws in the 📈 curve editor. A pen works the same way.',
      'Press and hold a node for its menu (draw an arrow, alias, duplicate, select, edit, format, delete, Help). Hold on empty canvas, then drag, to select with a box. Double-tap does what a double-click does.',
      'fmIDE fits a tablet\'s screen: the ribbon shows arrows at its ends, text boxes don\'t make the browser zoom, and dialogs stay above the on-screen keyboard.',
    ],
    why: 'So a model can be reviewed and changed on an iPad or another tablet.',
    how: [
      'Open fmIDE on a tablet (the installable web app works well).',
      'Press and hold a node to see what it offers.',
    ],
    notes: ['The mouse works exactly as before.'],
    see: ['touch'] },

  { id: 'free-space', date: '2026-09-28', title: 'New nodes never land on others',
    summary: 'Added, duplicated and aliased nodes go into free space; the Macro Builder steps through.',
    what: [
      'Add Rectangle, Add Operator and the other add commands put the new node near the middle of the view, where it overlaps nothing. Duplicates and aliases move together into free space.',
      'In the Macro Builder, ▶ Run selected step selects the next step, so pressing it again steps through a macro.',
    ],
    why: 'New nodes dropped on top of others were easy to lose.',
    how: ['Use {cmd:addRect} and the other add commands as usual.'],
    notes: ['Positions given in a macro or script are kept exactly, so recorded macros replay as before.'],
    see: ['rectangles', 'macros'] },

  { id: 'browse-library', date: '2026-09-28', title: 'Browse the community library',
    summary: 'Find shared templates, recipes and functions, and add them from inside fmIDE.',
    what: [
      '{cmd:browseLibrary} lists the community library\'s packs: search, filter by tag or by what a pack holds, sort, and see each pack\'s items, licence and credit, with what you already have marked.',
      'Preview and add… opens the usual pack preview: nothing is added until you choose.',
    ],
    why: 'Good building blocks made by others are faster than building everything yourself.',
    how: [
      'Open fmIDE from its website (or the installed app) and press {cmd:browseLibrary}.',
      'Pick a pack, then Preview and add….',
    ],
    notes: ['Every pack is checked against the library\'s list before it is read. fmIDE only reads from its own site, and only when you browse; the single-file version makes no network request at all.'],
    see: ['browse-library', 'library-packs'] },

  { id: 'item-origin', date: '2026-09-27', title: 'Where shared items came from',
    summary: 'Templates and functions from a pack keep the pack\'s name and author.',
    what: [
      'Templates and functions added from a library pack remember the pack and its author. The Templates window and the Functions manager show the credit, and Update this canvas says where a new version came from.',
      'When a pack would add a version to a template or function made by someone else — or by you — the preview warns in red and leaves it unticked.',
    ],
    why: 'Shared work under CC BY 4.0 needs its credit, and nobody else should quietly add versions to your templates.',
    how: ['Open a pack with {cmd:openLibraryPack} and read the preview before adding.'],
    see: ['library-packs'] },

  { id: 'library-packs', date: '2026-09-27', title: 'Library packs: share templates, recipes and functions',
    summary: 'Save templates, recipes and functions as one file to share, and open others\' packs safely.',
    what: [
      '{cmd:saveLibraryPack} writes one file of templates, recipes and functions, with a title, author, description, tags and the licence (CC BY 4.0). A recipe takes its parts along, and a function the functions it calls.',
      '{cmd:openLibraryPack} shows who made a pack and what each item would do to your library before anything is added; untick what you don\'t want. Nothing of yours is replaced.',
    ],
    why: 'To pass a set of building blocks to a colleague, or to the community library, in one go.',
    how: [
      'Press {cmd:saveLibraryPack}, fill in the details and tick the items.',
      'To use one, press {cmd:openLibraryPack} and choose the file.',
    ],
    notes: ['Very large or very deeply nested files are now refused with a message, instead of stopping fmIDE.'],
    see: ['library-packs'] },

  { id: 'timing-conditions', date: '2026-09-27', title: 'Timing, conditions and rounding operators',
    summary: 'period, if, =, ≠, and, or, not, round, roundup and rounddown — calculated alike in fmIDE and Excel.',
    what: [
      'New operators: the period number (1, 2, 3…), if (condition, then, else — only the branch taken is worked out), = and ≠, and, or, not, and round, roundup and rounddown (like Excel: round(2.675, 2) is 2.68).',
      'if and the rounding operators show a labelled dot for each input; drop an arrow on the dot you mean.',
    ],
    why: 'Opening balances, flags and rounding are part of most models; they no longer need workarounds.',
    how: [
      'Find them on Insert → Compare and Insert → Excel Functions, or in {cmd:openLauncher}.',
      'Wire each input onto its dot.',
    ],
    notes: ['A corkscrew can now be written if(period = 1, Opening, previous Closing). Comparisons treat 0.1 + 0.2 = 0.3 as true, as Excel does.'],
    see: ['timing-conditions'] },

  { id: 'functions', date: '2026-09-27', title: 'Your own functions',
    summary: 'Write a formula once, such as Margin(Revenue, Cost), and use it like a built-in operator.',
    what: [
      'A function is a formula with named inputs, written in an Excel-like way: Margin(Revenue, Cost) = (Revenue - Cost) / Revenue. The Functions manager keeps your library, with versions and notes, and checks a formula as you type.',
      'Insert Function… places one as a box with a labelled input per input. A box on an older version shows ⬆ to update it. In Excel, each call is written out in full as an ordinary formula, and a Functions tab lists the definitions.',
    ],
    why: 'Calculations you repeat across models are written, checked and updated once.',
    how: [
      'Open {cmd:openFunctions} and press + New Function….',
      'Type the formula, then Save.',
      'Place it with {cmd:insertFunction} and draw arrows onto its inputs.',
    ],
    notes: ['A model carries the functions it uses in every file, so it works for whoever opens it. Functions never run as code; fmIDE reads them with its own parser.'],
    see: ['functions', 'function-nodes'] },

  { id: 'same-numbers', date: '2026-09-27', title: 'The canvas and Excel give the same numbers',
    summary: 'fmIDE and the workbook calculate alike, checked on every sample model; calculation got faster.',
    what: [
      'Both apps now calculate from one shared description of the model, and every sample model is checked: fmIDE\'s value of each rectangle in each period against the recalculated workbook.',
      'Differences found were fixed: % works like Excel\'s MOD, a < b < c means a < b and b < c, an opening balance shows its typed number in period 1 in Excel, and a few error cases now agree.',
      'A large model calculates in about a third of the time.',
    ],
    why: 'A model is only trustworthy if the workbook gives exactly the numbers you saw while building it.',
    how: ['Nothing to do. Before you download, ExcelExporter lists any place where the workbook will differ (usually something broken in the model).'],
    see: ['to-excel'] },

  { id: 'socket-warning', date: '2026-09-27', title: 'A warning when several plugs feed one socket',
    summary: 'A socket fed by more than one plug shows ⚡ name ×2 in amber.',
    what: [
      'Plugs feeding the same socket are added together. When there is more than one, the socket shows ⚡ name ×N in amber, and hovering lists the plugs. Building a recipe lists such sockets too.',
    ],
    why: 'Adding the same value twice by accident (for example, building a recipe beside the canvas it was made from) was easy to miss.',
    how: ['Look for the amber ⚡ on a socket and hover over it.'],
    notes: ['Nothing is blocked: adding several plugs can be intended.'],
    see: ['plugs-sockets'] },

  { id: 'recipes', date: '2026-09-27', title: 'Recipes: templates made of templates',
    summary: 'One template that builds several linked canvases, connected by plugs and sockets.',
    what: [
      'A recipe lists canvas templates to add together, each at its latest version or a fixed one — for example Three Statements = Income Statement + Balance Sheet + Cash Flow. Build adds one canvas per part, each linked to its template, and plugs and sockets connect them by name.',
    ],
    why: 'Whole models are made of the same parts again and again.',
    how: [
      'Open {cmd:openTemplates} and press + New Recipe….',
      'Pick the parts and their versions; the check shows sockets nothing feeds.',
      'Press Build to add the canvases.',
    ],
    notes: ['Undo removes the whole build. Recipes have versions like other templates.'],
    see: ['recipes'] },

  { id: 'update-canvas', date: '2026-09-27', title: 'Canvases remember their template',
    summary: 'When a template has a newer version, update the canvas made from it.',
    what: [
      'A canvas made from a canvas template remembers it. When a newer version is in your library, a bar above the canvas says so and the tab shows ⬆.',
      'Update this canvas… shows the change notes and which inputs will be kept, warns about changes of your own, and keeps the canvas\'s name and input values.',
    ],
    why: 'Improving a template once should improve every model that uses it, without retyping inputs.',
    how: [
      'Press Update on the bar, or {cmd:updateCanvasTemplate}.',
      'Read the summary, then Update.',
    ],
    notes: ['Not now hides the notice until an even newer version appears. Undo reverses an update. {cmd:unlinkCanvasTemplate} cuts the link.'],
    see: ['template-versions'] },

  { id: 'template-versions', date: '2026-09-27', title: 'Template versions',
    summary: 'Each template keeps versions 1, 2, 3… with a short change note.',
    what: [
      'Every template belongs to a family and has a version number and a change note. ⤴ Save as new version saves the open canvas as the next version. The Templates window shows the latest, with older versions underneath.',
    ],
    why: 'So a template can improve without losing earlier versions that models still use.',
    how: [
      'Open {cmd:openTemplates}, pick a template, and press ⤴ Save as new version.',
      'Write a short note about what changed.',
    ],
    notes: ['The latest version is deleted only with the whole template, so a version number is never used twice.'],
    see: ['template-versions'] },

  { id: 'several-plugs', date: '2026-09-27', title: 'Several plugs on one rectangle',
    summary: 'One rectangle can feed several sockets by different names.',
    what: [
      'A rectangle can carry more than one plug name, each feeding the sockets with that name — for example Income Tax feeding both an expense line and the tax paid in the cash flow. The 🔌 editor shows one chip per plug.',
    ],
    why: 'One number often feeds several statements.',
    how: ['Select a rectangle, press 🔌, type a plug name and press Enter; repeat for the next.'],
    see: ['plugs-sockets'] },

  { id: 'template-tidying', date: '2026-09-27', title: 'Search templates, and no more duplicates',
    summary: 'Find a template by typing; imports skip copies you already have; tidy up with Remove duplicates.',
    what: [
      'The Templates window has a search box: part of a name, group or description, best match first. ↑ ↓ and Enter work.',
      'Importing a workspace or templates adds only the templates you don\'t already have. {cmd:removeDuplicateTemplates} finds copies (you choose what must match) and lets you pick which to keep. {cmd:clearAllTemplates} empties the library after asking.',
    ],
    why: 'Libraries filled up with copies, and finding a template meant scrolling.',
    how: [
      'Open {cmd:openTemplates} and start typing.',
      'To tidy up, use {cmd:removeDuplicateTemplates}.',
    ],
    see: ['templates'] },

  { id: 'web-app', date: '2026-09-27', title: 'Install fmIDE as an app',
    summary: 'Its own window and icon, works offline, opens .fmide files, and updates itself.',
    what: [
      'From its website, fmIDE can be installed as an app: its own window and icon, working offline after the first visit, and opening .fmide files double-clicked in the operating system (Chrome and Edge on a computer).',
      'New versions download in the background; a notice offers Reload (your work is saved first) or Later.',
    ],
    why: 'So fmIDE feels like a desktop app, always up to date, without installing anything heavy.',
    how: ['Open fmIDE\'s website and press {cmd:installApp} (when the browser offers it).'],
    notes: ['The single-file version still works opened straight from disk. Nothing you build is ever uploaded.'],
    see: ['documents'] },

  { id: 'preferences', date: '2026-09-27', title: 'Take your settings with you',
    summary: 'Export your shortcuts, ribbon and Quick Access Toolbar as one file.',
    what: [
      '{cmd:exportPreferences} saves your keyboard shortcuts, ribbon layout, Quick Access Toolbar and KeyTips key in one file; {cmd:importPreferences} brings them back, on another computer or for a colleague.',
    ],
    why: 'A ribbon set up just right shouldn\'t have to be rebuilt on each computer.',
    how: ['Press {cmd:exportPreferences}, then {cmd:importPreferences} where you want them.'],
    notes: ['Importing replaces exactly those settings; your models, templates, macros and formats are never touched.'],
    see: ['customize-ribbon'] },

  { id: 'documents', date: '2026-09-27', title: 'Documents: New, Open, Save',
    summary: 'Work with .fmide files like any document, with unsaved changes marked and recovered.',
    what: [
      '{cmd:newDocument}, {cmd:openDocument}, {cmd:saveDocument}, {cmd:saveDocumentAs} and {cmd:openRecent} work like any document app. A .fmide file holds the model with its templates, functions and formats. Chrome and Edge save straight back to the file; other browsers download it.',
      'Unsaved changes show as a dot in the title, and fmIDE asks before closing them. After a crash, it offers to save what was recovered.',
    ],
    why: 'Models are documents you keep, send and reopen; the autosave alone was not enough.',
    how: ['Press Ctrl+S (Cmd+S on a Mac) to save, Ctrl+O to open.'],
    notes: ['fmIDE also autosaves in the browser every few seconds, and when the page is hidden.'],
    see: ['documents'] },

  { id: 'foundations', date: '2026-09-26', title: 'Where fmIDE started',
    summary: 'Older files always open, and text from files is always shown safely.',
    what: [
      'Every file fmIDE writes says what it is and which version it is. Older files are upgraded as they open, a file meant for another place says where it belongs, and a file from a newer version asks before opening.',
      'Text from files — names, labels, units — is always shown as plain text, and numbers, positions and colours are checked, so a file from someone else can\'t do anything unexpected.',
    ],
    why: 'Models last for years and travel between people; they must always open, and always safely.',
    how: ['Nothing to do: it applies to every file.'],
    see: ['other-files'] },
];
