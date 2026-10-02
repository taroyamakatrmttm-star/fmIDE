// =====================================================================================
// What's new in fmGraph (build step 15, docs/step15-fmgraph.md).
// Copyright 2026 Taro Yamaka. Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/,
// docs/LICENSE-CC-BY-4.0.txt), like fmIDE's help text.
// =====================================================================================
// Plain data, shown by fmGraph's Help panel (options.whatsNew of the shared panel). The same
// shape as fmIDE's (src/help/fmide-whats-new.js), newest first, one entry per feature a
// person would notice. **A change people will notice adds its entry here in the same pull
// request.**
const FMGRAPH_WHATS_NEW = [
  { id: 'fmgraph', date: '2026-10-02', title: 'fmGraph: see how a value moves your model',
    summary: 'Bars show your rectangles; sliders change your inputs; the bars move as you slide.',
    what: [
      'fmGraph is a new companion to fmIDE. Bars show a rectangle\'s value in the periods you choose; sliders change an input rectangle, by setting its number or changing it by a percentage.',
      'Move a slider and every bar that depends on that input moves with it. The bars it reaches light up, a dashed outline shows the model\'s own value, and a label shows the difference.',
      'Your bars and sliders are remembered for each model in this browser.',
    ],
    why: 'To see, not just read, how one number affects the rest of a model.',
    how: [
      'In fmIDE, use Open fmGraph (File tab, App group) — or open a saved .fmide file here.',
      'Add a slider on an input and a bar on a result.',
      'Move the slider.',
    ],
    notes: ['fmGraph never changes your model: Reset all puts every number back.'],
    see: ['what-is-fmgraph', 'sliders', 'bars'] },
];
