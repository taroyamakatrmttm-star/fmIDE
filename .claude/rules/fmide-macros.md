---
paths:
  - "src/fmide/js/13-automation-core.js"
  - "src/fmide/js/14*.js"
  - "src/fmide/js/15-actions-edit-to-api.js"
  - "src/fmide/js/17-param-form-launcher.js"
  - "src/fmide/js/18-macros.js"
  - "src/fmide/js/19-macro-builder.js"
  - "tests/63-*.spec.js"
---

# fmIDE: macros and actions

Loaded when a session works on fmIDE's actions, macros or the Macro Builder. Moved word for word from `CLAUDE.md` (12 October 2026); keep it in step with the code, as `CLAUDE.md` asks.

- **Macros** (`18-macros.js` the steps, recorder and runner; `19-macro-builder.js`; references in `13-automation-core.js`; help topics `macros`, `macro-steps`, `macro-variables`, `macro-references`, `macro-reliable`, `macro-errors`): an action that makes something declares `returns` (`node`, `nodes`, `canvas`, or `made` for `insertTemplate`) and, if its result is not what a step keeps, `saved(result)` (`insertTemplate`: the canvases — a recipe's `parts`, one per part — or the nodes); a step's `assign` keeps it (`$r1`, `$c1`, `$t1`), the recorder names it and refers to what it made through it (`created`, `createdCanvases`), and the Macro Builder names it when such a step is added (`makesSomething`, `nextVarName`). **A new action that makes something must declare `returns`**, so recorded macros refer to it by variable, not by a name or id that differs when the macro runs. The recorder refers by `macroRefOfNode` / `macroRefOfCanvas` (a unique name, else `#id`; Copy Reference uses the same), to an unnamed node a template made on a canvas made while recording by its place (`@all[k]`, plug aliases not counted, `indexedNodes`), records skipping the recipe parts already here as `skipExisting`, and puts a ⚠ note (`RECORDER_NOTE`, step `comment`) on a reference that may not hold. Undo while recording removes exactly the steps recorded since the undone change: every undo point is a `String` object numbered in `historySeqOf` (`historyEntry`, `03-canvases-undo-clipboard-dialogs.js`), each recorded step keeps the number current when it was recorded (`recorder.stepSeq`). ▶ Run selected step keeps the variables between steps (`mb.stepVars`, passed to `runMacroInteractive` / `executeMacro`); `macroVariableProblems` marks a step reading a variable no step before it saves (⚠ `.mvar`), and `unsetVariableText` explains one at run time. Canvas tabs show their ids; `copyReference` (Macros group; `ui.copyReferenceAdded`). Test group 63.
