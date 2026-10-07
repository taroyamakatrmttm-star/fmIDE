// ---------- format roles (src/shared/format-roles.js; fmIDE only since step 11a) ----------
// How rectangles look on fmIDE's canvas. Each role is an ordinary format preset with a
// reserved name (edit it in the Formats manager): "Inputs" styles every input rectangle,
// "Calculations" every rectangle fed by an arrow, unless a rectangle has its own 🎨 format.
// Only the number format also reaches Excel: how cells look there is ExcelExporter's own
// Excel style (step 11a, decision 9 in docs/decisions.md). The Excel-only roles and style
// settings older files carry are dropped when they are read (dropExcelOnlyPresets in
// src/shared/file-formats.js).
export const FORMAT_ROLES = [
  { name: 'Inputs', where: 'Canvas',
    desc: 'Input rectangles: the numbers you type. Their number format is used in Excel too.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: '#eff6ff',
             border: { color: '#93c5fd', width: 1.5, style: 'solid' }, font: { family: '', size: 14, weight: 'normal', color: '#1e3a8a' } } },
  { name: 'Calculations', where: 'Canvas',
    desc: 'Rectangles fed by an arrow. Blank by default (the normal rectangle look). Their number format is used in Excel too.',
    style: { numberFormat: { kind: 'general', decimals: 2, currencySymbol: '$' }, fill: null, border: null, font: { family: '', size: null, weight: 'normal', color: null } } }
];
