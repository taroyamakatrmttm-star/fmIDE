// ---------- format roles (shared: src/shared/format-roles.js, used by both apps) ----------
// One place defines how every kind of cell looks — on the canvas AND in the Excel file
// ExcelExporter writes. Each role is an ordinary format preset with a reserved name
// (edit it in the Formats manager); ExcelExporter reads these presets from the saved
// workspace/system JSON. "Inputs" and "Calculations" also style canvas rectangles; the
// rest only exist in the spreadsheet. A rectangle's own 🎨 format sets how it looks
// (number format, weight, size, border); the ROLE owns the colours (fill, font colour)
// (and border) in Excel unless the rectangle's format has "Use this fill, font colour &
// border in Excel too" ticked. Border sides and "Use Excel's default font size" are
// Excel-only settings of a style.
const FORMAT_ROLES = [
  { name: 'Inputs', where: 'Canvas + Excel',
    desc: 'Hard-coded numbers: input rectangles, scenario values, and the cells you type on the Scenarios tab.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#eff6ff',
             border: { color: '#93c5fd', width: 1.5, style: 'solid' }, font: { family: '', size: 14, weight: 'normal', color: '#1e3a8a' } } },
  { name: 'Calculations', where: 'Canvas + Excel',
    desc: 'Formulas: rectangles fed by an arrow, and every calculated cell in Excel. Blank by default (the normal rectangle look).',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: null } } },
  { name: 'Links', where: 'Excel',
    desc: 'Formulas that only pull a value from another sheet (e.g. a row linked to the Inputs tab).',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: '#008000' } } },
  { name: 'Headers', where: 'Excel',
    desc: 'Each sheet\'s title and column-header row.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#f1f5f9', border: null, font: { family: '', size: null, weight: '700', color: null } } },
  { name: 'Section Headers', where: 'Excel',
    desc: 'The INPUTS / CALCULATIONS / OUTPUTS bands.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#f8fafc', border: null, font: { family: '', size: null, weight: '700', color: '#475569' } } },
  { name: 'Labels', where: 'Excel',
    desc: 'Custom / label rows and group headers (unless the row has its own format in ExcelExporter).',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: '700', color: '#475569' } } },
  { name: 'Notes', where: 'Excel',
    desc: 'Notes, the Period # counter, scenario numbering and other helper text.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: 9, weight: 'normal', color: '#94a3b8' } } }
];
