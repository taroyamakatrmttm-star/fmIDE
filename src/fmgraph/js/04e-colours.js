// ============================================================
// Shared colours (the owner's request of 26 October 2026, board file 11): a rectangle has one
// colour on every board of the model — its slider, its bars, and every chart that shows it —
// and changing it anywhere changes it everywhere.
//
// A rectangle's colour is the one someone chose (`rectColours`, kept in the board file's
// `colours`), else an automatic one: the chart colours (PART_COLOURS) handed out in the order
// rectangles first appear in Columns, Lines, Free and Spider charts, board by board, chart by chart
// (so the first chart looks as each chart did on its own before), else none — a bar then has the
// page's usual colour, a waterfall step its colour by direction (a step takes only a chosen
// colour: its colour otherwise says up, down or total). The Tornado's Low and High, and the
// scenario waterfall, are not colours of a rectangle and stay the chart's own.
//
// Files before 11 (and the template form, still 2) kept a colour on each widget (a bar's
// `colour`, a chart part's or step's `colour`); a file of version 11 always has `colours`, and
// then the widgets' colours (written for older readers and ExcelExporter: what each shows) are
// not read. Without it, cleanBoards leaves each widget's colour on the widget (`colour`,
// `colours`), and adoptWidgetColours takes them into the shared ones before anything is drawn
// or written: the first one in board order wins (a rectangle that already has a colour keeps
// it), and a note says how many rectangles had another colour somewhere.
// ============================================================
const PART_COLOURS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#9f1239'];
const DEFAULT_BAR_COLOUR = '#0f766e'; // the page's usual bar colour
const COLOURS_LIMIT = 2000; // chosen colours read from a file, at most
let rectColours = new Map(); // rectangle key → '#rrggbb', the chosen ones
let autoColourMemo = null;   // rectangle key → its automatic colour, until the boards change

// The chosen colours in a file of version 11 (`colours: [{ canvasId, nodeId, name, colour }]`).
function cleanRectColours(raw){
  const out = new Map();
  (Array.isArray(raw) ? raw : []).slice(0, COLOURS_LIMIT).forEach(e => {
    const r = e && typeof e === 'object' ? rectForEntry(e) : null;
    const c = e && cleanColour(e.colour);
    if(r && c && !out.has(r.key)) out.set(r.key, c);
  });
  return out;
}
// Their file form.
function rectColoursData(){
  return [...rectColours].filter(([k]) => model.byKey.has(k)).map(([k, colour]) => {
    const r = model.byKey.get(k);
    return { canvasId: r.canvasId, nodeId: r.nodeId, name: r.name, colour };
  });
}

// The rectangles a chart colours one each, in its order (Columns, Lines, Free, a Spider's inputs).
function colouredKeys(c){
  if(c.layout === 'columns') return c.groups.flatMap(g => g.parts);
  if(c.layout === 'lines') return c.lines.slice();
  if(c.layout === 'free') return c.pieces.flatMap(p => p.parts);
  if(c.layout === 'spider') return c.inputs.map(i => i.key);
  return [];
}
function autoColours(){
  if(autoColourMemo) return autoColourMemo;
  const out = new Map();
  boards.forEach(b => b.charts.forEach(c => colouredKeys(c).forEach(k => {
    if(!out.has(k)) out.set(k, PART_COLOURS[out.size % PART_COLOURS.length]);
  })));
  autoColourMemo = out;
  return out;
}
function forgetAutoColours(){ autoColourMemo = null; }

// A rectangle's colour: chosen, else automatic, else null (the usual look).
function chosenColour(key){ return rectColours.get(key) || null; }
function rectColour(key){ return chosenColour(key) || autoColours().get(key) || null; }

// The colour a slider, a bar or a key shows: the rectangle's, else the page's usual bar colour.
function shownColour(key){ return rectColour(key) || DEFAULT_BAR_COLOUR; }

// The colour a slider's grip and filled bar take (the owner's request of 30 October 2026): the
// rectangle's colour, darkened only when it is too pale to see on white — until its contrast
// with white is 3:1 (WCAG's relative luminance), keeping its hue. The stripe and colour box keep
// the exact colour. Anything that is not a checked #rrggbb colour gives the usual bar colour.
function sliderAccent(colour){
  const c = cleanColour(colour) || DEFAULT_BAR_COLOUR;
  const rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const contrast = (p) => 1.05 / (0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]) + 0.05);
  if(contrast(rgb) >= 3) return c;
  // Scaling every channel by one factor keeps the hue; the darkest factor that still reaches 3:1.
  let lo = 0, hi = 1;
  for(let i = 0; i < 24; i++){
    const mid = (lo + hi) / 2;
    if(contrast(rgb.map(v => Math.round(v * mid))) >= 3) lo = mid; else hi = mid;
  }
  return '#' + rgb.map(v => Math.round(v * lo).toString(16).padStart(2, '0')).join('');
}

// Takes the colours older files kept on widgets into the shared ones (see the top).
function adoptWidgetColours(){
  let differ = 0;
  const differing = new Set();
  const take = (key, c) => {
    const colour = cleanColour(c);
    if(!colour || !model.byKey.has(key)) return;
    const had = rectColours.get(key);
    if(!had) rectColours.set(key, colour);
    else if(had !== colour && !differing.has(key)){ differing.add(key); differ++; }
  };
  let any = false;
  boards.forEach(b => b.items.forEach(w => {
    if(w.kind === 'bar' && w.colour){ any = true; take(w.key, w.colour); w.colour = null; }
    if(w.kind === 'chart' && w.colours && Object.keys(w.colours).length){
      any = true;
      // In the chart's order, so its first part is first.
      const order = [...new Set(chartKeys(w))];
      order.forEach(k => { if(w.colours[k]) take(k, w.colours[k]); });
      w.colours = {};
    }
  }));
  if(any) forgetAutoColours();
  if(differ) notify(differ + ' rectangle' + (differ === 1 ? ' had' : 's had') + ' different colours in different bars or charts; each now has one colour everywhere, the first one.', 'info', 'colours');
}
