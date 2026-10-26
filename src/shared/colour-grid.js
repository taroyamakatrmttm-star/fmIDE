
// ---------- colour grid (shared: src/shared/colour-grid.js; fmIDE, fmGraph and ExcelExporter —
// Apache in all three, the owner's decision of 27 October 2026) ----------
// The browser's own colour box shows only RGB / HSL / HEX fields on Windows; an iPad's has a grid.
// installColourGrid gives every <input type="color"> on the page a grid of ready colours instead:
// a click (or Enter / Space) on the box opens it under the box — greys, twelve hues in six shades,
// the app's chart colours and the colours already in use — and "More…" opens the browser's own
// box for an exact colour. Picking one sets the box's value and sends `input` and `change`, as the
// browser's box does, so each app's own handlers and colour checks run as before. Nothing is read
// from a file except colours, and only a plain '#rrggbb' is ever shown; names come from the grid.

export const COLOUR_GRID_COLUMNS = 12;
const COLOUR_GRID_HUES = [
  ['Red', 0], ['Orange', 28], ['Amber', 42], ['Yellow', 54], ['Lime', 85], ['Green', 135],
  ['Teal', 172], ['Cyan', 192], ['Blue', 217], ['Indigo', 240], ['Purple', 275], ['Pink', 330],
];
const COLOUR_GRID_SHADES = [['lightest', 92], ['lighter', 80], ['light', 66], ['mid', 50], ['dark', 36], ['darkest', 24]];
const COLOUR_GRID_IN_USE_MAX = 24;

// '#rrggbb' (lower case) for a colour written '#rgb' or '#rrggbb', else null.
export function colourGridHex(v){
  if(typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if(/^#[0-9a-f]{6}$/.test(s)) return s;
  if(/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return null;
}

function hslHex(h, s, l){
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// The colours found in plain data (a style, a board, a list): the values of `fill`, `color`,
// `colour` and `colour2`, and any '#rrggbb' in a list — at most `limit`, each once, 8 deep.
export function coloursIn(data, limit){
  const max = limit || COLOUR_GRID_IN_USE_MAX, out = [];
  const add = (v) => { const c = colourGridHex(v); if(c && !out.includes(c) && out.length < max) out.push(c); };
  const walk = (d, depth) => {
    if(out.length >= max || depth > 8 || !d || typeof d !== 'object') return;
    if(Array.isArray(d)){ d.forEach(x => typeof x === 'string' ? add(x) : walk(x, depth + 1)); return; }
    if(d instanceof Map){ d.forEach(x => typeof x === 'string' ? add(x) : walk(x, depth + 1)); return; }
    for(const k of Object.keys(d)){
      const v = d[k];
      if(typeof v === 'string'){ if(k === 'fill' || k === 'color' || k === 'colour' || k === 'colour2') add(v); }
      else walk(v, depth + 1);
    }
  };
  walk(data, 0);
  return out;
}

// The grid's sections: [{ title, swatches: [{ colour, name, auto? }] }], each row at most 12 wide.
// automatic (optional): { colour, name } — the colour the box goes back to, first, on its own.
export function colourGridSections(chart, inUse, automatic){
  const greys = [];
  for(let i = 0; i < COLOUR_GRID_COLUMNS; i++){
    const l = Math.round(100 - i * 100 / (COLOUR_GRID_COLUMNS - 1));
    greys.push({ colour: hslHex(0, 0, l), name: i === 0 ? 'White' : i === COLOUR_GRID_COLUMNS - 1 ? 'Black' : 'Grey ' + (100 - l) + '%' });
  }
  const hues = [];
  COLOUR_GRID_SHADES.forEach(([shade, l]) => COLOUR_GRID_HUES.forEach(([name, h]) => {
    hues.push({ colour: hslHex(h, l > 85 ? 90 : 75, l), name: name + ', ' + shade });
  }));
  const listed = (list, word) => (Array.isArray(list) ? list : []).map(colourGridHex).filter(Boolean)
    .filter((c, i, all) => all.indexOf(c) === i).slice(0, COLOUR_GRID_IN_USE_MAX)
    .map((c, i) => ({ colour: c, name: word + ' ' + (i + 1) }));
  const sections = [{ title: 'Greys', swatches: greys }, { title: 'Colours', swatches: hues }];
  const autoColour = automatic && colourGridHex(automatic.colour);
  if(autoColour) sections.unshift({ title: 'Automatic', swatches: [{ colour: autoColour, auto: true,
    name: 'Automatic' + (automatic.name ? ' (' + automatic.name + ')' : '') }] });
  const charts = listed(chart, 'Chart colour');
  if(charts.length) sections.push({ title: 'Chart colours', swatches: charts });
  const used = listed(inUse, 'In use');
  if(used.length) sections.push({ title: 'In use', swatches: used });
  return sections;
}

let colourGridOpen = null; // { panel, input, close }

export function closeColourGrid(){ if(colourGridOpen) colourGridOpen.close(false); }

// Every colour box on the page opens the grid. options.chart() and options.inUse() give the
// colours of those two sections (either may be left out); options.box(input) may return false
// to leave a box with the browser's own picker; options.automatic(input) may give a box an
// Automatic swatch first — { colour, name, chosen, choose() }: chosen false marks it as the
// box's colour now, and picking it calls choose() (no change event: the app goes back itself).
export function installColourGrid(options){
  const opts = options || {};
  const call = (f) => { try { return typeof f === 'function' ? f() : []; } catch(e){ return []; } };
  let passThrough = null; // the box whose next click goes to the browser's own picker ("More…")
  const isBox = (t) => t && t.tagName === 'INPUT' && t.type === 'color' && !t.disabled
    && (!opts.box || opts.box(t) !== false);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if(!isBox(t)) return;
    if(passThrough === t){ passThrough = null; return; }
    e.preventDefault();
    if(colourGridOpen && colourGridOpen.input === t){ closeColourGrid(); return; }
    openGrid(t);
  }, true);
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if(!isBox(t) || (e.key !== 'Enter' && e.key !== ' ') || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    openGrid(t);
  }, true);

  function openGrid(input){
    closeColourGrid();
    const label = input.getAttribute('aria-label') || input.title || 'Colour';
    let auto = null;
    try { auto = typeof opts.automatic === 'function' ? opts.automatic(input) : null; } catch(e){ auto = null; }
    const now = auto && !auto.chosen ? null : colourGridHex(input.value);
    const panel = document.createElement('div');
    panel.className = 'colour-grid';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', label);
    const rows = []; // rows of swatch buttons, for the arrow keys
    let first = null, current = null;
    colourGridSections(call(opts.chart), call(opts.inUse), auto).forEach(sec => {
      const head = document.createElement('div');
      head.className = 'cg-title';
      head.textContent = sec.title;
      const group = document.createElement('div');
      group.className = 'cg-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', sec.title);
      let row = null;
      sec.swatches.forEach((s, i) => {
        if(i % COLOUR_GRID_COLUMNS === 0){ row = []; rows.push(row); }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cg-swatch';
        b.dataset.colour = s.colour;
        b.style.background = s.colour;
        b.title = s.name + ' ' + s.colour;
        b.setAttribute('aria-label', s.name + ', ' + s.colour);
        b.tabIndex = -1;
        if(s.auto){
          b.classList.add('cg-auto');
          if(!auto.chosen){ current = b; b.setAttribute('aria-pressed', 'true'); }
          b.addEventListener('click', () => { close(true); if(input.isConnected && typeof auto.choose === 'function') auto.choose(); });
        } else {
          if(s.colour === now && !current){ current = b; b.setAttribute('aria-pressed', 'true'); }
          b.addEventListener('click', () => pick(s.colour));
        }
        row.push(b);
        if(!first) first = b;
        group.appendChild(b);
      });
      panel.append(head, group);
    });
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'cg-more';
    more.textContent = 'More…';
    more.title = 'The browser’s own colour box, for an exact colour';
    more.addEventListener('click', () => {
      close(false);
      try {
        if(typeof input.showPicker === 'function'){ input.showPicker(); return; }
      } catch(e){ /* the click below instead */ }
      passThrough = input;
      input.click();
    });
    panel.appendChild(more);
    const start = current || first;
    start.tabIndex = 0;
    // The swatch last focused, however, is the one Tab comes back to.
    panel.addEventListener('focusin', (e) => {
      if(!e.target.classList.contains('cg-swatch')) return;
      rows.forEach(row => row.forEach(b => { b.tabIndex = b === e.target ? 0 : -1; }));
    });

    // On the window, before the app's own keys: Esc closes the grid only (not the window it
    // opened from), and no key pressed in the grid reaches the app's shortcuts.
    const onKey = (e) => {
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(true); return; }
      if(!panel.contains(e.target)) return;
      e.stopPropagation();
      if(e.key === 'Tab'){ // the grid and More… only, while it is open
        e.preventDefault();
        (document.activeElement === more ? panel.querySelector('.cg-swatch[tabindex="0"]') : more).focus();
        return;
      }
      const b = e.target.closest && e.target.closest('.cg-swatch');
      if(!b) return;
      let r = rows.findIndex(row => row.includes(b)), c = rows[r].indexOf(b);
      if(e.key === 'ArrowRight') c++;
      else if(e.key === 'ArrowLeft') c--;
      else if(e.key === 'ArrowDown') r++;
      else if(e.key === 'ArrowUp') r--;
      else if(e.key === 'Home') c = 0;
      else if(e.key === 'End') c = rows[r].length - 1;
      else return;
      e.preventDefault();
      r = Math.max(0, Math.min(rows.length - 1, r));
      if(c < 0 && r > 0){ r--; c = rows[r].length - 1; } // ← at a row's start: the row above's end
      else if(c >= rows[r].length && r < rows.length - 1 && e.key === 'ArrowRight'){ r++; c = 0; }
      c = Math.max(0, Math.min(rows[r].length - 1, c));
      rows[r][c].focus();
    };

    function pick(colour){
      const c = colourGridHex(colour);
      close(true);
      if(!c || !input.isConnected) return;
      input.value = c;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const outside = (e) => { if(!panel.contains(e.target) && e.target !== input) close(false); };
    // The page or a list scrolling: the grid follows its box (or closes when the box has gone).
    const moved = (e) => { if(panel.contains(e.target)) return; if(input.isConnected) place(); else close(false); };
    function close(refocus){
      if(colourGridOpen !== state) return;
      colourGridOpen = null;
      panel.remove();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', moved, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      if(refocus && input.isConnected) input.focus();
    }
    function place(){
      const r = input.getBoundingClientRect();
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      let left = Math.min(r.left, vw - w - 8), top = r.bottom + 4;
      if(top + h > vh - 8) top = Math.max(8, r.top - h - 4);
      panel.style.left = Math.max(8, left) + 'px';
      panel.style.top = top + 'px';
    }
    const state = { panel, input, close };
    colourGridOpen = state;
    document.body.appendChild(panel);
    place();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', moved, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    start.focus();
  }
}
