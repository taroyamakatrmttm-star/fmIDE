# Step 14 — ExcelExporter's new look

The owner's request (2 October 2026): ExcelExporter had grown messy. It was **too wordy** (long explanations on the page, despite Help), its **buttons were scattered** (seven import, export and reset buttons across four panels) and it lacked a **clear flow** (one long column of five numbered panels). The aim: a professionally polished, user-friendly page **without changing any feature**.

## What was agreed

All four parts, in one pull request (the owner's choice):

1. **A top bar with menus.** File (the model, Start Over) and Layout (this model's mapping, module layouts, the Excel style, Reset Mapping to Defaults) hold every file action and reset; ⬇ Generate is always in the top bar, beside ⚙ Settings and ❓ Help.
2. **Less text.** Each panel keeps a heading and at most one short line; the explanations move into the help topics and tooltips.
3. **A workspace.** Before a model, a welcome screen; afterwards the tabs (and the Inputs tab's settings) on the left and the rows on the right, the **Tree first** (the owner's choice); this model's workbook settings and the Excel style in a **Settings window** (the owner's choice); the **Custom / Label Rows table removed** (the owner's choice), since label rows can be edited in the Tree and By Excel Tab.
4. **Polish.** One set of colours, spacing and button styles; messages that can be dismissed; an empty state.

## How it turned out

- **The top bar** (`index.html`, `js/09e-menus-and-settings.js`): ← Back to fmIDE, ExcelExporter and the loaded model's name, the **File** and **Layout** menus, ⚙ Settings, ❓ Help, ⬇ Generate .xlsx. The menu items keep the buttons' old ids, so their handlers did not move. The items for this model's layout are off (with the tip "Load a model first") until a model is loaded, as is Generate. The menus work by mouse (pointing at the other menu while one is open switches to it), keyboard (↓ Enter Space open; ↑ ↓ Home End move; ← → change menu; Esc closes and returns to the menu's name) and finger.
- **Settings** is a window with two tabs: **Workbook** (start label, frequency, fallback number format, file name — off without a model) and **Excel Style** (the table of roles, Import, Export, Reset to Defaults). The Excel style is there with or without a model; Layout → Excel Style… opens it directly. The Excel style's file buttons stay beside the table they act on (and its messages show there), rather than in the Layout menu — the one exception to "every file action in a menu", which the menu points to.
- **Before a model**: a welcome card with the drop box, ▶ Load Sample Model and Paste JSON… (a window of its own now). **After**: a file dropped anywhere on the page opens (the page is outlined while it is held over it), as File → Open Model… does.
- **Messages** (loading, generating, module layouts, the storage warning) and the "differs from fmIDE" list sit in one place under the top bar, each with ×. The differences list has a "?" to its topic.
- **The workspace**: Tabs and Inputs & scenarios in a sidebar beside Rows; they stack when the page itself is narrower than 960 pixels (a container query, so Help open on a tablet counts). A tab's row count takes you to its rows. The view switch reads Tree · By Excel Tab · By Canvas; "Enforce Input / Calc / Output sections" became **Sections**; "+ Add Custom Row" became **+ Label Row** (from By Canvas it switches to the Tree and starts naming the new row). The Inputs tab's settings show once it is turned on.
- **Words moved, not lost**: the Rows panel's paragraph, the Inputs and module-tab notes and "Known limitations" went into the help topics (Rows, Blocks, Generating), every reference to "panel 1…5" in Help and fmIDE's To Excel tutorial now names the menu or place, and the Excel style's role descriptions became tooltips on the role names.
- Nothing about the workbook, the files or what the browser keeps changed. Test group 46 covers the page; the groups that click a button now in a menu or in Settings open it first (`menuCommand`, `openSettings` in `tests/helpers/excel.js`).
