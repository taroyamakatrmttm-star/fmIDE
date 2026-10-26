// ============================================================
// Shared colours (the owner's request of 26 October 2026, board file 11): a rectangle has one
// colour on every board of the model — its slider, its bars, and every chart that shows it —
// and changing it anywhere changes it everywhere.
//
// A rectangle's colour is the one someone chose (`rectColours`, kept in the board file's
// `colours`), else an automatic one: the chart colours (PART_COLOURS) handed out in the order
// rectangles first appear in Columns, Lines and Spider charts, board by board, chart by chart
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

// The rectangles a chart colours one each, in its order (Columns, Lines, a Spider's inputs).
function colouredKeys(c){
  if(c.layout === 'columns') return c.groups.flatMap(g => g.parts);
  if(c.layout === 'lines') return c.lines.slice();
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
// Chooses a rectangle's colour everywhere (null: back to the automatic one).
function setRectColour(key, colour){
  const c = colour === null ? null : cleanColour(colour);
  if(c) rectColours.set(key, c); else rectColours.delete(key);
  forgetAutoColours();
}

// The colour a slider, a bar or a key shows: the rectangle's, else the page's usual bar colour.
function shownColour(key){ return rectColour(key) || DEFAULT_BAR_COLOUR; }
// A colour box's Automatic (the shared colour grid): the colour the rectangle goes back to,
// whether one is chosen now, and going back — one undo step, through done().
function automaticColour(key, fallback, done, name){
  return { colour: autoColours().get(key) || fallback, name, chosen: !!chosenColour(key),
    choose: () => { setRectColour(key, null); done(); } };
}
// A colour box's pick: choosing what the rectangle would have anyway clears the choice.
function chooseRectColour(key, colour){
  const c = cleanColour(colour);
  setRectColour(key, null);
  if(c && c !== shownColour(key)) setRectColour(key, c);
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
