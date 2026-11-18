# Pull requests on GitHub, until 21 October 2026

The pull requests opened on GitHub (fmIDE and its library) before the account was suspended, taken from GitHub's export of 18 November 2026. It records which branch became which number, when, and the merge commit (in this repository's history). The descriptions are not copied: each merge commit and its branch's commits say what changed. Later work names its branch where a number would go (`docs/working-without-github.md`).

## fmIDE (this repository)

198 pull requests, 195 merged.

| # | Title | Branch | Opened | Merged | Merge commit |
|---|---|---|---|---|---|
| 1 | Add the permanent test suite (npm test) | `claude/friendly-mendel-5mzfbu` | 2026-09-24 | 2026-09-24 | `e54eba8` |
| 2 | Build step 3a: split both apps into src/, byte-identical build | `claude/hopeful-fermat-999vy8` | 2026-09-24 | 2026-09-24 | `3d98248` |
| 3 | Build step 3b: shared code in src/shared/ | `claude/hopeful-fermat-999vy8` | 2026-09-24 | 2026-09-24 | `df100ef` |
| 4 | Step 4a: IndexedDB underneath, same behaviour | `claude/trusting-babbage-w7fpkn` | 2026-09-24 | 2026-09-24 | `cf7d6ef` |
| 5 | Step 4b: fmIDE documents (.fmide) — New, Open, Save, Save As, Open Recent | `claude/trusting-babbage-w7fpkn` | 2026-09-24 | 2026-09-24 | `ea3a67c` |
| 6 | Step 4c: Preferences file — Export / Import Preferences (step 4 done) | `claude/trusting-babbage-w7fpkn` | 2026-09-24 | 2026-09-24 | `344ab31` |
| 7 | Step 5a: fmIDE as an installable web app (PWA), not yet published | `claude/trusting-babbage-w7fpkn` | 2026-09-24 | 2026-09-24 | `906b302` |
| 8 | CLAUDE.md: "How we work" — the routine for every session | `claude/trusting-babbage-w7fpkn` | 2026-09-25 | 2026-09-25 | `b043269` |
| 9 | Step 5b part 1: licences — open core, one repository with two licences | `claude/trusting-babbage-w7fpkn` | 2026-09-25 | 2026-09-25 | `b6fa6f4` |
| 10 | Step 5b part 2: publish to Cloudflare Pages automatically, with PR previews | `claude/trusting-babbage-w7fpkn` | 2026-09-25 | 2026-09-25 | `4ca7126` |
| 11 | ExcelExporter: gather Block Input rectangles onto the Inputs tab | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `62bedbe` |
| 12 | fmIDE: search box in the Templates window | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `5555359` |
| 13 | ExcelExporter: unconnected block inputs become real inputs, gathered per instance | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `5df69ba` |
| 14 | ExcelExporter says when a new version is ready; previews lead with the exact version | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `f6cee8c` |
| 15 | fmIDE: stop duplicate templates building up; add "Remove duplicates" | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `2ac9026` |
| 16 | Fix "Remove duplicates" removing originals; unique template ids; add "Clear all templates" | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `b574141` |
| 17 | fmIDE: "Remove duplicates…" window — choose what must match, and which to keep | `claude/epic-brahmagupta-t34w04` | 2026-09-26 | 2026-09-26 | `7d86cb5` |
| 18 | fmIDE: several plugs on one rectangle (system v3, module v2) | `claude/fmide-template-management-4p56j5` | 2026-09-26 | 2026-09-26 | `c6f1902` |
| 19 | fmIDE: template families and versions (Phase A) | `claude/ecstatic-curie-kdhwzl` | 2026-09-26 | 2026-09-26 | `b30b8c7` |
| 20 | fmIDE: canvases remember their template; "Update this canvas" (Phase B) | `claude/ecstatic-curie-kdhwzl` | 2026-09-26 | 2026-09-26 | `5ec6a1b` |
| 21 | fmIDE: recipe templates — canvas templates built together (Phase C) | `claude/ecstatic-curie-kdhwzl` | 2026-09-26 | 2026-09-26 | `f1a37a5` |
| 22 | fmIDE: warn when more than one plug feeds a socket; fix deleting a canvas with plugs | `claude/ecstatic-curie-kdhwzl` | 2026-09-26 | 2026-09-26 | `1fd5151` |
| 23 | Formula IR phase A: the canvas and Excel give the same numbers | `claude/intelligent-johnson-373wpz` | 2026-09-26 | 2026-09-26 | `3cccbb1` |
| 24 | Formula IR phase B: the shared IR, and fmIDE calculating on it | `claude/pensive-cray-4mjil5` | 2026-09-26 | 2026-09-26 | `8cddff8` |
| 25 | Formula IR phase C: ExcelExporter writes its formulas from the shared IR | `claude/affectionate-feynman-i5c2qf` | 2026-09-26 | 2026-09-26 | `6b7852c` |
| 26 | Function plugins, phase D1: the shared parser, the IR and the file formats | `claude/affectionate-ride-l16n6x` | 2026-09-27 | 2026-09-27 | `26db07d` |
| 27 | Function plugins phase D2a: the function library and the Functions manager | `claude/kind-faraday-7rfx7r` | 2026-09-27 | 2026-09-27 | `b75a952` |
| 28 | Function plugins phase D2b: function nodes on the canvas | `claude/busy-hopper-hgf8vq` | 2026-09-27 | 2026-09-27 | `2348c0e` |
| 29 | Fix: canvas edits on nodes from hand-written files; clickable vertical port toggle | `claude/busy-hopper-hgf8vq` | 2026-09-27 | 2026-09-27 | `84b7c77` |
| 30 | Fix: nodes from files without a usable size get their type's size | `claude/busy-hopper-hgf8vq` | 2026-09-27 | 2026-09-27 | `1472fa8` |
| 31 | Step 7 D3: ExcelExporter writes function calls out in full | `claude/step7-d3-excel-functions` | 2026-09-27 | 2026-09-27 | `bbfc8d5` |
| 32 | Fix: nested function calls calculated slowly | `claude/fix-nested-call-speed` | 2026-09-27 | 2026-09-27 | `48f9cca` |
| 33 | Phase E1a: timing, conditions and rounding operators in both apps | `claude/e1a-operators` | 2026-09-27 | 2026-09-27 | `0e64444` |
| 34 | Phase E1b: the new operators on fmIDE's canvas | `claude/e1b-canvas` | 2026-09-27 | 2026-09-27 | `94ebd78` |
| 35 | Docs: step-by-step tutorial for the features since pull request #23 | `claude/ecstatic-albattani-1d0fon` | 2026-09-27 | 2026-09-27 | `67bb987` |
| 36 | Step 8a: library packs — share templates, recipes and functions as one file | `claude/8a-library-pack` | 2026-09-27 | 2026-09-27 | `60313b0` |
| 37 | Step 8b: record where templates and functions came from (origin) | `claude/8b-origin` | 2026-09-27 | 2026-09-27 | `9a1ba98` |
| 38 | Step 8c-1: the shared pack reader and the library's pack checker | `claude/lucid-einstein-8k1pxk` | 2026-09-27 | 2026-09-27 | `4b1d300` |
| 39 | Step 8c-2 (part 1): the checker's library mode | `claude/8c-2-library-rules` | 2026-09-27 | 2026-09-27 | `860392b` |
| 40 | Step 8c-2 done: refuse packs outside packs/, and close the phase in the docs | `claude/8c-2-finish` | 2026-09-27 | 2026-09-27 | `c84c1b1` |
| 41 | Step 8c-3: the library's catalogue on the site (/library) | `claude/8c-3-catalogue` | 2026-09-27 | 2026-09-27 | `c7e749b` |
| 42 | Step 8d: browse the community library inside fmIDE | `claude/8d-library-browse` | 2026-09-27 | 2026-09-27 | `40aed0a` |
| 43 | Library catalogue: build when every pack has been taken down | `claude/library-empty-packs` | 2026-09-27 | 2026-09-27 | `a87be73` |
| 44 | ExcelExporter: tidier formulas, Links for plug-fed rows, new defaults (phase A) | `claude/tender-thompson-elab27` | 2026-09-27 | 2026-09-27 | `a308626` |
| 45 | Step 9a: one input path for mouse, finger and pen on fmIDE's canvas | `claude/cool-cori-4orn2p` | 2026-09-27 | 2026-09-27 | `6ea5ba1` |
| 46 | ExcelExporter Tree View: a row's own format, indent, full right-click menu (phase B) | `claude/tender-thompson-elab27` | 2026-09-27 | 2026-09-27 | `0e9b144` |
| 47 | Library: take down the test pack | `claude/library-takedown-test-pack` | 2026-09-27 | 2026-09-27 | `07d9ff3` |
| 48 | Touch, phase 9b: press-and-hold menu, selection box, double-tap, larger touch areas | `claude/touch-9b` | 2026-09-27 | 2026-09-27 | `7b89b4b` |
| 49 | New nodes go into free space; Run selected step moves on; ExcelExporter starts in formula order (phase C) | `claude/tender-thompson-elab27` | 2026-09-27 | 2026-09-28 | `07bc3cc` |
| 50 | Resizable windows; the Templates list as a tree (phase D) | `claude/tender-thompson-elab27` | 2026-09-28 | 2026-09-28 | `dac9dfd` |
| 51 | Touch, phase 9c: the screen, and ExcelExporter by touch | `claude/touch-9c` | 2026-09-28 | 2026-09-28 | `22bcf33` |
| 52 | Docs: tidy up after merge-conflict resolutions | `claude/docs-merge-cleanup` | 2026-09-28 | 2026-09-28 | `a45c618` |
| 53 | ExcelExporter: inputs read from another tab come straight from the Inputs tab (follow-up No.4) | `claude/tender-thompson-elab27` | 2026-09-28 | 2026-09-28 | `f7f4419` |
| 54 | fmIDE: paste into free space; a recipe skips parts already built | `claude/tender-thompson-elab27` | 2026-09-28 | 2026-09-28 | `cc6915b` |
| 55 | ExcelExporter: "← Back to fmIDE" button; Open ExcelExporter reuses its window | `claude/gracious-curie-all7gc` | 2026-09-29 | 2026-09-29 | `5fba3eb` |
| 56 | Step 10 H1: Help panel, help search and a plain sentence per command | `claude/bold-ptolemy-rt0e50` | 2026-09-29 | 2026-09-29 | `0d2da2e` |
| 57 | Step 10 H2: help where you are — ribbon tips, a ? on every window, ExcelExporter's Help | `claude/bold-ptolemy-rt0e50` | 2026-09-29 | 2026-09-29 | `4ac380c` |
| 58 | Step 10 H3a: tutorials in practice mode, and a welcome card | `claude/bold-ptolemy-rt0e50` | 2026-09-29 | 2026-09-29 | `fe44ca7` |
| 59 | Step 10 H3b: four more tutorials — blocks, templates, functions, to Excel | `claude/bold-ptolemy-rt0e50` | 2026-09-29 | 2026-09-29 | `751d9e7` |
| 60 | Queue step 11: the Excel look and layout belong to ExcelExporter (docs only) | `claude/queue-step11-excel-output` | 2026-09-29 | 2026-09-29 | `7f73207` |
| 61 | Step 10 H4a: help pages on the site (/help) | `claude/step10-h4a-help-pages` | 2026-09-29 | 2026-09-29 | `8e14dc5` |
| 62 | Step 10 H4b: tutorial video scripts and screen recordings | `claude/step10-h4b-video-recordings` | 2026-09-30 | 2026-09-30 | `d0b23c0` |
| 63 | Step 11a: the Excel look moves to ExcelExporter (its own Excel style) | `claude/step11a-excel-style` | 2026-09-30 | 2026-09-30 | `b72f424` |
| 64 | Step 11b: ExcelExporter remembers each module's layout | `claude/step11b-module-layouts` | 2026-09-30 | 2026-09-30 | `dfa9768` |
| 65 | Step 11c-1: a template carries its Excel layout (fmIDE, file formats, checker) | `claude/step11c1-template-attachments` | 2026-09-30 | 2026-09-30 | `7e5db15` |
| 66 | Step 11c-2: ExcelExporter uses a template's attached Excel layout | `claude/step11c2-template-layouts` | 2026-09-30 | 2026-09-30 | `dfb12fe` |
| 67 | Step 11d: block instance tabs remember their Excel layout | `claude/step11d-block-instance-layouts` | 2026-09-30 | 2026-09-30 | `fb23a42` |
| 68 | Step 7 phase E2a: ln, exp, sqrt, int and trunc as operators | `claude/step7-e2a-operators` | 2026-09-30 | 2026-09-30 | `66c0049` |
| 69 | Step 7 phase E2b: choose, a scenario switch | `claude/step7-e2b1-choose` | 2026-10-01 | 2026-10-01 | `6be8dea` |
| 70 | The 📈 chart shows every period, and its window is resizable | `claude/blissful-cray-z5kd75` | 2026-10-01 | 2026-10-01 | `feef992` |
| 71 | Faster calculation on long timelines: each period worked out once | `claude/blissful-cray-z5kd75` | 2026-10-01 | 2026-10-01 | `5311609` |
| 72 | Plan step 12: snap to equal spacing and Add Many Rectangles | `claude/vibrant-mendel-8kl9y5` | 2026-10-01 | 2026-10-01 | `9fae9c8` |
| 73 | Step 12b: Add Many Rectangles… and the Ctrl+Enter quick chain | `claude/blissful-cray-z5kd75` | 2026-10-01 | 2026-10-01 | `05cc28a` |
| 74 | Step 12a: snap to equal spacing while dragging | `claude/blissful-cray-z5kd75` | 2026-10-01 | 2026-10-01 | `fac3009` |
| 75 | ExcelExporter help: what is remembered, which layout and format win, template layouts | `claude/peaceful-mayer-aofddd` | 2026-10-01 | 2026-10-01 | `94ba2ed` |
| 76 | H5a: a wider Help panel — reading view and a draggable edge | `claude/peaceful-mayer-aofddd` | 2026-10-01 | 2026-10-01 | `50aca97` |
| 77 | H5b: What's new inside Help — a page per update, in both apps | `claude/peaceful-mayer-aofddd` | 2026-10-01 | 2026-10-01 | `dd5772f` |
| 78 | H5c: What's new on the website — /help/whats-new/ and ExcelExporter's | `claude/peaceful-mayer-aofddd` | 2026-10-01 | 2026-10-02 | `135e52e` |
| 79 | Step 13a: zoom the canvas, 25%–200% | `claude/peaceful-mayer-aofddd` | 2026-10-02 | 2026-10-02 | `0d2c92b` |
| 80 | Step 13b: pinch with two fingers to zoom the canvas on a tablet | `claude/peaceful-mayer-aofddd` | 2026-10-02 | 2026-10-02 | `a86c418` |
| 81 | ExcelExporter's new look: menus, Settings, tabs beside rows, less text (step 14) | `claude/excel-exporter-redesign` | 2026-10-02 | 2026-10-02 | `c539589` |
| 82 | Step 15 G0: the brief for fmGraph | `claude/fmgraph-g0` | 2026-10-02 | 2026-10-02 | `b21cf31` |
| 83 | Step 15 G1: fmGraph, bars and sliders | `claude/fmgraph-g1` | 2026-10-02 | 2026-10-02 | `6d2db19` |
| 84 | Step 15 G2: fmGraph charts, columns and waterfalls | `claude/fmgraph-g2` | 2026-10-02 | 2026-10-02 | `4615ca2` |
| 85 | Step 15 G3a: fmGraph boards — tabs, arranging, colours, undo, the board file | `claude/fmgraph-g3a` | 2026-10-02 | 2026-10-02 | `e02491a` |
| 86 | fmGraph: show the colour chosen for a bar or a waterfall step | `claude/fmgraph-colour-fix` | 2026-10-02 | 2026-10-02 | `d214c54` |
| 87 | Step 15 G3b: fmGraph's boards saved inside .fmide documents | `claude/fmgraph-g3b` | 2026-10-02 | 2026-10-02 | `a943146` |
| 88 | Step 15 G4a: fmGraph's Trace and Biggest movers | `claude/fmgraph-g4a` | 2026-10-02 | 2026-10-02 | `ac44441` |
| 89 | Step 15 G4b: fmGraph's A/B snapshot and gliding bars | `claude/fmgraph-g4b` | 2026-10-02 | 2026-10-02 | `e75f794` |
| 90 | Step 15 G5a: fmGraph boards on templates | `claude/fmgraph-g5a` | 2026-10-02 | 2026-10-03 | `c468122` |
| 91 | Step 15 G5b: fmGraph uses templates' boards; Attach to template | `claude/fmgraph-g5b` | 2026-10-03 | 2026-10-03 | `7ed3dee` |
| 92 | fmGraph G5c: Try in fmGraph from Browse Library | `claude/fmgraph-g5c` | 2026-10-03 | 2026-10-03 | `5797271` |
| 93 | fmGraph scenarios S1: named scenarios | `claude/fmgraph-scenarios` | 2026-10-03 | 2026-10-03 | `73a74e6` |
| 94 | fmGraph scenarios S2: the scenario waterfall | `claude/fmgraph-scenario-waterfall` | 2026-10-03 | 2026-10-03 | `8c21a2a` |
| 95 | fmGraph G6: tutorials | `claude/fmgraph-g6-tutorials` | 2026-10-03 | 2026-10-03 | `fb8dcc2` |
| 96 | ExcelExporter reads the model open in fmIDE | `claude/excel-exporter-from-fmide` | 2026-10-03 | 2026-10-03 | `7b9f16d` |
| 97 | Long messages fit the screen; .fmide files can be picked on an iPad | `claude/jolly-planck-q2mo1h` | 2026-10-03 | 2026-10-03 | `da86ad8` |
| 98 | ExcelExporter: a row's own border on each side separately | `claude/jolly-planck-q2mo1h` | 2026-10-03 | 2026-10-03 | `c9b5fc5` |
| 99 | fmIDE: a tidier Templates window, with Expand all and Collapse all | `claude/jolly-planck-q2mo1h` | 2026-10-03 | 2026-10-03 | `2e1c90a` |
| 100 | fmIDE: Next Canvas and Previous Canvas from the keyboard | `claude/jolly-planck-q2mo1h` | 2026-10-03 | 2026-10-03 | `581f519` |
| 101 | fmIDE: recipes within a recipe | `claude/jolly-planck-q2mo1h` | 2026-10-03 | 2026-10-03 | `23135d7` |
| 102 | Macros that keep working when the model differs, and help to write them | `claude/eager-fermi-ev5919` | 2026-10-03 | 2026-10-03 | `a6ba068` |
| 103 | Stepping through a macro keeps its variables; Undo while recording takes only its own steps | `claude/eager-fermi-ev5919` | 2026-10-03 | 2026-10-03 | `6c40d83` |
| 104 | Roadmap: record the system-template link bug as a known issue | `claude/eloquent-bardeen-096f4g` | 2026-10-03 | 2026-10-03 | `7b13af8` |
| 105 | System templates keep their canvases' links to their canvas templates | `claude/wizardly-cori-3o0gxp` | 2026-10-03 | 2026-10-03 | `28c8ef4` |
| 106 | Templates: remove old versions of one template, or of all templates | `claude/wizardly-cori-3o0gxp` | 2026-10-03 | 2026-10-03 | `4841800` |
| 107 | Share a pack in the community library: a window, a step-by-step guide, and the right file name | `claude/wizardly-cori-3o0gxp` | 2026-10-04 | 2026-10-04 | `efef143` |
| 108 | Roadmap: your name out of public places (deferred), and a readable pack file name (later) | `claude/wizardly-cori-3o0gxp` | 2026-10-04 | 2026-10-04 | `8f70358` |
| 109 | Browse Library showed nothing: publish the library's current packs | `claude/blissful-mayer-hjcz40` | 2026-10-04 | 2026-10-04 | `c37da4e` |
| 110 | Library records written automatically when a pack is merged (the checker's part) | `claude/blissful-mayer-hjcz40` | 2026-10-04 | 2026-10-04 | `46e5d96` |
| 111 | Update library catalogue | `update-library` | 2026-10-04 | 2026-10-04 | `61060e3` |
| 112 | The live site picks up packs merged into the library by itself | `claude/blissful-mayer-hjcz40` | 2026-10-07 | 2026-10-07 | `d0b0159` |
| 113 | Step 3c-1: the shared code Node runs becomes real modules | `claude/friendly-volta-j66wcf` | 2026-10-07 | 2026-10-07 | `fd2cebf` |
| 114 | Step 3c-2: the browser's shared pieces become modules too | `claude/friendly-volta-j66wcf` | 2026-10-07 | 2026-10-07 | `60a1667` |
| 115 | Touch: a menu choice right after a tap that cancelled an arrow counts again | `claude/friendly-volta-j66wcf` | 2026-10-07 | 2026-10-07 | `56437ea` |
| 116 | Step 3c-3: ExcelExporter's Excel writer and fmIDE's expression parser as modules | `claude/friendly-volta-j66wcf` | 2026-10-07 | 2026-10-08 | `387c397` |
| 117 | Tests: attaching a file to a template waits for fmIDE's message | `claude/friendly-volta-j66wcf` | 2026-10-08 | 2026-10-08 | `16fbe8b` |
| 118 | Step 3c-4: ExcelExporter's formula building as modules (step 3c done) | `claude/friendly-volta-j66wcf` | 2026-10-08 | 2026-10-08 | `f5f97ba` |
| 119 | CI: run the tests once per change, in 4 parts at once | `claude/friendly-volta-j66wcf` | 2026-10-08 | 2026-10-08 | `86b8050` |
| 120 | CI: balance the 4 test parts by measured time | `claude/friendly-volta-j66wcf` | 2026-10-08 | 2026-10-08 | `7cb73ed` |
| 121 | An operator with nothing wired in gives 0, as in Excel | `claude/empty-operator-zero` | 2026-10-08 | 2026-10-08 | `dc319de` |
| 122 | ExcelExporter: Sensitivity — Tornado and Spider tables, live in Excel (step 16, phase A) | `claude/brave-allen-2wdz4e` | 2026-10-08 | 2026-10-08 | `1c3eb91` |
| 123 | ExcelExporter: the Tornado and Spider charts (step 16, phase B) | `claude/brave-allen-2wdz4e` | 2026-10-08 | 2026-10-08 | `b60f509` |
| 124 | ExcelExporter: tab names with an apostrophe work in Excel | `claude/brave-allen-2wdz4e` | 2026-10-08 | 2026-10-08 | `a0c2248` |
| 125 | Step 17 P0: the brief for phones | `claude/phones-brief` | 2026-10-08 | 2026-10-08 | `f15faa1` |
| 126 | Step 17 P1a: fmGraph on a phone | `claude/phones-p1a` | 2026-10-08 | not merged (closed 2026-10-08) |  |
| 127 | Step 17 P1a: fmGraph on a phone | `claude/phones-p1a` | 2026-10-08 | 2026-10-08 | `f6724b4` |
| 128 | Step 17 P1b: fmGraph on a phone — the mixer, Show, holding A, Share | `claude/phones-p1b` | 2026-10-08 | 2026-10-09 | `506894c` |
| 129 | Step 17 P2a: fmIDE on a phone — Inputs, Watch and the canvas to look at | `claude/phones-p2a` | 2026-10-09 | 2026-10-09 | `546298b` |
| 130 | Step 17 P2b: fmIDE on a phone — share the document, open fmGraph, the install note | `claude/phones-p2b` | 2026-10-09 | 2026-10-09 | `7d2e2f2` |
| 131 | Step 17 P3: ExcelExporter on a phone — make the workbook and share it; Make Excel in fmIDE | `claude/phones-p3` | 2026-10-09 | 2026-10-09 | `aa64286` |
| 132 | fmIDE on a phone: list every input by the shared rule, as ExcelExporter does | `claude/phone-inputs-rule` | 2026-10-09 | 2026-10-09 | `74a525f` |
| 133 | fmGraph: a fixed vertical scale for bars and charts | `claude/eloquent-edison-6akuxi` | 2026-10-12 | 2026-10-12 | `f1be714` |
| 134 | Guidance for sessions: a short CLAUDE.md, path-scoped rules, reference docs (Phase 1) | `claude/compassionate-noether-puhute` | 2026-10-12 | 2026-10-12 | `9022745` |
| 135 | Guidance: the owner's decisions on the items flagged in #134 | `claude/compassionate-noether-puhute` | 2026-10-12 | 2026-10-12 | `cf5e0cc` |
| 136 | Which tests a change reaches: npm run test:changed (token-efficiency phase 2) | `claude/test-impact-map-phase-2-4pfsne` | 2026-10-12 | 2026-10-12 | `c7125cb` |
| 137 | test:changed: count fmIDE only where a test can open it | `claude/test-impact-map-phase-2-4pfsne` | 2026-10-12 | 2026-10-12 | `1a9e2ac` |
| 138 | test:changed: a package.json change only to test: shortcuts runs the files they name | `claude/test-impact-map-phase-2-4pfsne` | 2026-10-12 | 2026-10-12 | `45bd0e8` |
| 139 | ExcelExporter: attach a module's layout to its template, no file in between | `claude/excel-attach-to-template` | 2026-10-12 | 2026-10-12 | `4aecc8a` |
| 140 | CLAUDE.md: run only the related test groups locally | `claude/related-tests-locally` | 2026-10-12 | 2026-10-13 | `20c135d` |
| 141 | fmIDE: the plug editor adds a typed name on a click elsewhere, however quick | `claude/plug-editor-click-race` | 2026-10-12 | 2026-10-13 | `f5e1f25` |
| 142 | fmGraph: fold sliders, keep the Sliders column on screen, drag by finger on an iPad | `claude/fmgraph-compact-sliders` | 2026-10-13 | 2026-10-14 | `86f433f` |
| 143 | fmGraph: boards share where the sliders stand; a board can keep its own | `claude/fmgraph-shared-sliders` | 2026-10-15 | 2026-10-15 | `11bd4d9` |
| 144 | Docs: briefs for step 18 (Tornado and Spider in fmGraph) and step 19 (fmGraph in Excel) | `claude/cool-davinci-ukptxf` | 2026-10-15 | 2026-10-15 | `a3dd1b1` |
| 145 | ExcelExporter's writer: form controls and stacked charts (step 19, B0) | `claude/vibrant-cerf-3fdjbk` | 2026-10-15 | 2026-10-15 | `214da33` |
| 146 | fmGraph: Tornado and Spider charts (step 18, phase A1) | `claude/practical-maxwell-f0pqzz` | 2026-10-15 | 2026-10-15 | `7d34a17` |
| 147 | ExcelExporter: fmGraph's scenarios become Global Cases (step 19, phase B2) | `claude/charming-cray-ij49t5` | 2026-10-15 | 2026-10-15 | `128f1d3` |
| 148 | Excel writer: a form control is at least one cell wide and tall (step 19, B0 follow-up) | `claude/vibrant-cerf-3fdjbk` | 2026-10-15 | 2026-10-15 | `ee17fb9` |
| 149 | fmGraph: Tornado and Spider — each input's Low and High (step 18, phase A2) | `claude/practical-maxwell-f0pqzz` | 2026-10-15 | 2026-10-15 | `08ebc01` |
| 150 | ExcelExporter: several sensitivity analyses, layout file 5 (step 19, B3a) | `claude/charming-brown-sd6tuv` | 2026-10-16 | 2026-10-16 | `9abd43e` |
| 151 | ExcelExporter: several sensitivity analyses, and fmGraph's Tornado and Spider (step 19, phase B3) | `claude/charming-cray-ij49t5` | 2026-10-16 | not merged (closed 2026-10-16) |  |
| 152 | ExcelExporter: fmGraph's Tornado and Spider become analyses (step 19, phase B3b) | `claude/charming-cray-ij49t5` | 2026-10-16 | 2026-10-16 | `9806ce3` |
| 153 | ExcelExporter: fmGraph's sliders on a Dashboard, layout file 7 (step 19, phase B4) | `claude/b4-dashboard-sliders` | 2026-10-16 | 2026-10-16 | `994ebcd` |
| 154 | ExcelExporter: fmGraph's charts on the Dashboard, layout file 8 (step 19, phase B5) | `claude/b5-dashboard-charts` | 2026-10-16 | 2026-10-16 | `1793bad` |
| 155 | Docs: step 19 done — the owner's checks in Excel on Windows and the iPad | `claude/step19-done` | 2026-10-16 | 2026-10-16 | `28b1cea` |
| 156 | ExcelExporter: the Dashboard's chart tables beside the charts, titles on their own row | `claude/dashboard-tables` | 2026-10-16 | 2026-10-16 | `cb10f40` |
| 157 | Docs: a step-by-step guide to pull requests #144 to #156 | `claude/cool-mayer-g850dt` | 2026-10-16 | 2026-10-16 | `d8ae0ce` |
| 158 | Step 20a: the brief and sample workbooks for importing an Excel model | `claude/excel-import-brief` | 2026-10-18 | 2026-10-18 | `5b57c0b` |
| 159 | Step 20b: reading an .xlsx file for importing an Excel model | `claude/excel-import-reader` | 2026-10-18 | 2026-10-18 | `e544efc` |
| 160 | Step 20c: the formula parser for importing an Excel model | `claude/excel-import-formulas` | 2026-10-18 | 2026-10-18 | `d49c8ef` |
| 161 | Step 20d: the layout and the confirm screen for importing an Excel model | `claude/excel-import-layout` | 2026-10-18 | 2026-10-18 | `5af21b6` |
| 162 | Step 20e: building the fmIDE model from an imported Excel workbook | `claude/excel-import-model` | 2026-10-18 | 2026-10-18 | `17d68c6` |
| 163 | Step 20f: checking an imported model against Excel's saved values | `claude/excel-import-check` | 2026-10-18 | 2026-10-18 | `a710a97` |
| 164 | Step 20g: Save for fmIDE, help and the end-to-end test (step 20 done) | `claude/excel-import-finish` | 2026-10-18 | 2026-10-18 | `a491bc3` |
| 165 | Import: rows with typed actuals and a forecast formula, after a real model | `claude/excel-import-real-sample` | 2026-10-18 | 2026-10-18 | `a9e2fd3` |
| 166 | Docs: a step-by-step guide to importing an Excel model (#158 to #165) | `claude/excel-import-guide` | 2026-10-18 | 2026-10-18 | `8e07da9` |
| 167 | Fix: a ribbon button's tip no longer shows late, after the pointer left | `claude/fix-late-command-tip` | 2026-10-18 | 2026-10-18 | `41673da` |
| 168 | Fix: fmIDE's canvas grows to hold every node (large models scroll all the way) | `claude/import-canvas-fit` | 2026-10-18 | 2026-10-18 | `39b43b3` |
| 169 | Import: keep a row's typed actuals in its own rectangle (tidier imported models) | `claude/import-fold-actuals` | 2026-10-18 | 2026-10-18 | `00f8fed` |
| 170 | Import: one canvas per section of a long sheet | `claude/import-sections` | 2026-10-18 | 2026-10-18 | `5b5ee51` |
| 171 | Import: one shared "Up to 2024" switch per canvas; step 20 guide brought up to date | `claude/import-shared-switch` | 2026-10-18 | 2026-10-18 | `4c3e834` |
| 172 | Import: keep the workbook's own layout (row order, headings, blank rows; constants in the formulas) | `claude/import-keep-layout` | 2026-10-18 | 2026-10-18 | `c219e53` |
| 173 | Import: keep the workbook's own look (bold, colours, fills, lines, number formats) | `claude/import-keep-look` | 2026-10-18 | 2026-10-18 | `4e093cb` |
| 174 | Import: the round trip — the generated workbook recalculated and checked against the original | `claude/import-round-trip` | 2026-10-18 | 2026-10-18 | `412cc00` |
| 175 | Import: the first year reads the shared switch, not a year test of its own | `claude/import-first-year-switch` | 2026-10-18 | 2026-10-18 | `6a0bd8a` |
| 176 | The Excel layout travels with the document (workspace v13, excelLayout) | `claude/excel-layout-in-file` | 2026-10-18 | 2026-10-18 | `27f71d7` |
| 177 | ExcelExporter: an empty row before each Inputs-tab group header but the first | `claude/inputs-group-spacing` | 2026-10-18 | 2026-10-18 | `300576c` |
| 178 | Docs: what ExcelExporter's layouts hold, and which one wins | `claude/docs-layouts-remembered` | 2026-10-18 | 2026-10-18 | `71bf688` |
| 179 | ExcelExporter: sensitivity on the Inputs tab, easier to read (idea 10) | `claude/sensitivity-rows` | 2026-10-18 | 2026-10-18 | `58c0d83` |
| 180 | ExcelExporter: sliders on the Inputs tab, easier to read | `claude/slider-rows` | 2026-10-18 | 2026-10-18 | `9d99a6b` |
| 181 | fmGraph: a slider's Range and step stays open while it is changed | `claude/slider-range-open` | 2026-10-18 | 2026-10-18 | `dacdaca` |
| 182 | fmGraph: find a rectangle by typing | `claude/fmgraph-rect-search` | 2026-10-18 | 2026-10-19 | `edff514` |
| 183 | Docs: product ideas for the roadmap | `claude/product-ideas` | 2026-10-18 | 2026-10-19 | `9dd3e1e` |
| 184 | fmGraph: one period for every board | `claude/fmgraph-shared-period` | 2026-10-19 | 2026-10-19 | `8153041` |
| 185 | Docs: product ideas — the rectangle search and the shared period built | `claude/product-ideas-built` | 2026-10-19 | 2026-10-19 | `d3b6776` |
| 186 | ExcelExporter: the Excel import translates running totals | `claude/import-running-totals` | 2026-10-19 | 2026-10-19 | `d1d18f6` |
| 187 | fmGraph: goal seek | `claude/fmgraph-goal-seek` | 2026-10-19 | 2026-10-19 | `69a48ef` |
| 188 | fmGraph: lines charts, drawn as Excel line charts on the Dashboard | `claude/fmgraph-line-charts` | 2026-10-19 | 2026-10-19 | `512ffa9` |
| 189 | Library: a readable pack file name | `claude/readable-pack-name` | 2026-10-19 | 2026-10-19 | `b3658c1` |
| 190 | ExcelExporter: exact number formats | `claude/excel-number-formats` | 2026-10-19 | 2026-10-19 | `7e0b242` |
| 191 | Docs: overall roadmap status after step 20 | `claude/roadmap-status` | 2026-10-19 | 2026-10-19 | `1c7992a` |
| 192 | ExcelExporter: Collapse all and Expand all in the Tree View | `claude/affectionate-keller-uqqas4` | 2026-10-19 | 2026-10-19 | `9cde4d0` |
| 193 | Library checker: share a version again with new attachments, or the items of one's own pack taken down | `claude/wonderful-heisenberg-lrg271` | 2026-10-19 | 2026-10-19 | `5e5b061` |
| 194 | Docs: the user manual, phase 1 — contents, lesson style, coverage appendix, three tutorials as lessons | `claude/youthful-keller-kwesbf` | 2026-10-19 | 2026-10-19 | `a966765` |
| 195 | Guidance: keep the user manual in step with every change people notice | `claude/youthful-keller-kwesbf` | 2026-10-19 | 2026-10-20 | `65d2535` |
| 196 | Docs: the user manual, phase 2 — Part 1 (getting started) and Part 2 (building a model) | `claude/youthful-keller-kwesbf` | 2026-10-21 | 2026-10-21 | `5a3fe91` |
| 197 | Docs: the user manual, phases 3–6 — Parts 3 to 6, the manual complete, checked and on the website | `claude/youthful-keller-kwesbf` | 2026-10-21 | 2026-10-21 | `3c5e402` |
| 198 | Help: a link to the user manual in every app's Help panel | `claude/youthful-keller-kwesbf` | 2026-10-21 | open on GitHub; merged on this computer 2026-10-22 | `d455f3b` |

## fmide-library (the community library, the `library` submodule)

21 pull requests, 17 merged.

| # | Title | Branch | Opened | Merged | Merge commit |
|---|---|---|---|---|---|
| 1 | Set up the community library (step 8, phase 8c-2) | `claude/library-setup` | 2026-09-27 | 2026-09-27 | `9db0dbd` |
| 2 | Add files via upload | `<owner>-patch-1` (GitHub upload page) | 2026-09-27 | 2026-09-27 | `96f5553` |
| 3 | Use the checker from fmIDE c84c1b1 (refuses packs outside packs/) | `claude/checker-c84c1b1` | 2026-09-27 | 2026-09-27 | `1e2ffa8` |
| 4 | README: the catalogue's address, the report link, and how to publish | `claude/readme-catalogue` | 2026-09-27 | 2026-09-27 | `2a29e2a` |
| 5 | Take down the test pack | `<owner>-patch-1` (GitHub upload page) | 2026-09-27 | 2026-09-27 | `47c31c7` |
| 6 | Move the checker to fmIDE 6be8dea (step 7 E2a and E2b) | `claude/checker-pin-6be8dea` | 2026-10-01 | 2026-10-01 | `8723b4a` |
| 7 | Move to fmIDE's checker after step 15 G5a | `claude/checker-g5a` | 2026-10-03 | 2026-10-03 | `19763c8` |
| 8 | Move to fmIDE's checker after recipes within a recipe | `claude/checker-nested-recipes` | 2026-10-03 | 2026-10-03 | `97a37b1` |
| 9 | Add files via upload | `<owner>-patch-2` (GitHub upload page) | 2026-10-04 | 2026-10-04 | `69c6a5e` |
| 10 | Add files via upload | `<owner>-patch-3` (GitHub upload page) | 2026-10-04 | not merged (closed 2026-10-04) |  |
| 11 | Add files via upload | `<owner>-patch-3` (GitHub upload page) | 2026-10-04 | not merged (closed 2026-10-04) |  |
| 12 | Records written automatically when a pack is merged | `claude/blissful-mayer-hjcz40` | 2026-10-04 | 2026-10-04 | `00c0d09` |
| 13 | Add files via upload | `<owner>-patch-4` (GitHub upload page) | 2026-10-04 | not merged (closed 2026-10-04) |  |
| 14 | Add files via upload | `<owner>-patch-5` (GitHub upload page) | 2026-10-04 | 2026-10-04 | `00d5726` |
| 15 | Add files via upload | `<owner>-patch-5` (GitHub upload page) | 2026-10-04 | 2026-10-04 | `d365ef3` |
| 16 | README: packs reach the catalogue by themselves | `claude/blissful-mayer-hjcz40` | 2026-10-07 | 2026-10-07 | `02c0775` |
| 17 | Move the checker to fmIDE's readable pack file name (fmIDE #189) | `claude/checker-readable-pack-name` | 2026-10-19 | 2026-10-19 | `99a43b4` |
| 18 | Add files via upload | `<owner>-patch-5` (GitHub upload page) | 2026-10-19 | not merged (closed 2026-10-19) |  |
| 19 | Add files via upload | `<owner>-patch-6` (GitHub upload page) | 2026-10-19 | 2026-10-19 | `e5c8d61` |
| 20 | Move the checker to fmIDE #193: share a version again with new attachments, or one's own items after a takedown | `claude/checker-share-again` | 2026-10-19 | 2026-10-19 | `2b27e94` |
| 21 | Records for the pack fa1ef5cf (#19); the records job reads pack ids from inside the files | `claude/records-readable-names` | 2026-10-19 | 2026-10-19 | `446fcec` |

