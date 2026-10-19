// ============================================================
// Searching a rectangle list (the owner's request, 18 October 2026): every list choosing a
// rectangle — a bar's, a slider's, a chart's parts, outputs and inputs — opens a search box
// over its rectangles instead of the long list, as fmIDE's template and shortcut searches do
// (the same fuzzy match, shared/fuzzy-match.js): type to narrow it, best match first, with
// the canvas beside each; ↑ ↓ choose, Enter takes it, Esc or a click elsewhere closes.
// - A mouse press on the list opens it (it follows the list when the page scrolls); so do Enter, Space, F4, Alt+↓ or typing a letter while
//   the list has the focus (the letter starts the search). The arrow keys alone still step
//   through the list as before, and a finger gets the device's own list.
// - The list itself stays a <select>: taking a rectangle sets its value and sends `change`,
//   exactly as choosing it there does. Names are shown as text (textContent).
// ============================================================

// build:include shared/fuzzy-match.js

let rectSearch = null; // { sel, box, input, list, items, shown, active } while open

function makeSearchable(sel){
  sel.addEventListener('mousedown', (ev) => {
    if(ev.button !== 0 || sel.disabled || isEmulatedMouse(ev)) return;
    pressDefault(ev); // no native list
    sel.focus();
    openRectSearch(sel, '');
  });
  sel.addEventListener('keydown', (ev) => {
    if(sel.disabled || ev.ctrlKey || ev.metaKey) return;
    const opens = ev.key === 'Enter' || ev.key === ' ' || ev.key === 'F4' || (ev.altKey && ev.key === 'ArrowDown');
    const letter = !ev.altKey && ev.key.length === 1 && ev.key !== ' ';
    if(!opens && !letter) return;
    ev.preventDefault();
    openRectSearch(sel, letter ? ev.key : '');
  });
}

// The list's entries, as the <select> holds them: { value, text, group, selected }.
function rectSearchItems(sel){
  const out = [];
  [...sel.children].forEach(ch => {
    if(ch.tagName === 'OPTGROUP') [...ch.children].forEach(o => out.push({ value: o.value, text: o.textContent, group: ch.label, selected: o.selected }));
    else if(ch.tagName === 'OPTION') out.push({ value: ch.value, text: ch.textContent, group: '', selected: ch.selected });
  });
  return out;
}

function openRectSearch(sel, typed){
  closeRectSearch(false);
  const box = make('div', 'rect-search');
  box.id = 'rectSearch';
  const input = make('input', 'rect-search-input');
  input.type = 'search';
  input.placeholder = 'Search rectangles…';
  input.setAttribute('autocomplete', 'off');
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search ' + (sel.getAttribute('aria-label') || 'rectangles').toLowerCase());
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'rectSearchList');
  const list = make('div', 'rect-search-list');
  list.id = 'rectSearchList';
  list.setAttribute('role', 'listbox');
  box.append(input, list);
  document.body.appendChild(box);
  rectSearch = { sel, box, input, list, items: rectSearchItems(sel), shown: [], active: -1 };
  placeRectSearch();
  input.value = typed;
  input.addEventListener('input', renderRectSearch);
  input.addEventListener('keydown', rectSearchKey);
  list.addEventListener('mousedown', (ev) => ev.preventDefault()); // the search box keeps the focus
  list.addEventListener('click', (ev) => {
    const row = ev.target.closest('.rect-search-item');
    if(row) pickRectSearch(Number(row.dataset.i));
  });
  document.addEventListener('pointerdown', rectSearchOutside, true);
  window.addEventListener('resize', rectSearchScroll);
  document.addEventListener('scroll', rectSearchScroll, true);
  renderRectSearch();
  input.focus();
  if(!typed) input.select();
}

// Under the list, or above it when there is more room there; at least the list's width.
function placeRectSearch(){
  const { sel, box } = rectSearch;
  const r = sel.getBoundingClientRect();
  const width = Math.min(window.innerWidth - 16, Math.max(r.width, 300));
  const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
  const up = below < 240 && above > below;
  const height = Math.max(160, Math.min(380, up ? above : below));
  box.style.width = width + 'px';
  box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) + 'px';
  box.style.maxHeight = height + 'px';
  if(up){ box.style.top = ''; box.style.bottom = (window.innerHeight - r.top + 2) + 'px'; }
  else { box.style.bottom = ''; box.style.top = (r.bottom + 2) + 'px'; }
}

// No search: every rectangle under its canvas, as the list shows them. A search: the matches,
// best first — on the name, else on the canvas's name — each with its canvas beside it.
function renderRectSearch(){
  const st = rectSearch;
  const q = st.input.value.trim();
  st.list.textContent = '';
  if(!q){
    st.shown = st.items.map((it, i) => ({ i, idx: [] }));
  } else {
    st.shown = st.items.map((it, i) => {
      const onName = fuzzyMatch(q, it.text);
      if(onName) return { i, idx: onName.idx, score: onName.score + 2000 };
      const onGroup = it.group ? fuzzyMatch(q, it.group) : null;
      return onGroup ? { i, idx: [], score: onGroup.score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.i - b.i);
  }
  let group = null;
  st.shown.forEach((m, k) => {
    const it = st.items[m.i];
    if(!q && it.group !== group){
      group = it.group;
      if(group) st.list.appendChild(make('div', 'rect-search-group', group));
    }
    const row = make('div', 'rect-search-item' + (it.selected ? ' current' : ''));
    row.dataset.i = String(k);
    row.setAttribute('role', 'option');
    row.id = 'rectSearchItem' + k;
    const name = make('span', 'rect-search-name');
    rectSearchMarked(name, it.text, m.idx);
    row.appendChild(name);
    if(q && it.group) row.appendChild(make('span', 'rect-search-canvas', it.group));
    st.list.appendChild(row);
  });
  if(!st.shown.length) st.list.appendChild(make('div', 'rect-search-none', 'No rectangle matches "' + q + '".'));
  const current = st.shown.findIndex(m => st.items[m.i].selected);
  setRectSearchActive(q ? 0 : Math.max(0, current));
}

// The name with the matched letters in bold, all as text.
function rectSearchMarked(el, text, idx){
  const set = new Set(idx);
  let buf = '';
  for(let i = 0; i < text.length; i++){
    if(set.has(i)){
      if(buf){ el.appendChild(document.createTextNode(buf)); buf = ''; }
      el.appendChild(make('b', null, text[i]));
    } else buf += text[i];
  }
  if(buf) el.appendChild(document.createTextNode(buf));
}

function setRectSearchActive(k){
  const st = rectSearch;
  if(!st.shown.length){ st.active = -1; st.input.removeAttribute('aria-activedescendant'); return; }
  st.active = Math.max(0, Math.min(st.shown.length - 1, k));
  st.list.querySelectorAll('.rect-search-item').forEach(row => {
    const on = Number(row.dataset.i) === st.active;
    row.classList.toggle('active', on);
    row.setAttribute('aria-selected', on ? 'true' : 'false');
    if(on){
      st.input.setAttribute('aria-activedescendant', row.id);
      const top = row.offsetTop, bottom = top + row.offsetHeight;
      if(top < st.list.scrollTop) st.list.scrollTop = top - (row.previousSibling && row.previousSibling.classList.contains('rect-search-group') ? row.previousSibling.offsetHeight : 0);
      else if(bottom > st.list.scrollTop + st.list.clientHeight) st.list.scrollTop = bottom - st.list.clientHeight;
    }
  });
}

function rectSearchKey(ev){
  const st = rectSearch;
  if(!st) return;
  const page = Math.max(1, Math.floor(st.list.clientHeight / 28));
  const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page };
  if(moves[ev.key]){ ev.preventDefault(); setRectSearchActive(st.active + moves[ev.key]); return; }
  if(ev.key === 'Enter'){ ev.preventDefault(); if(st.active >= 0) pickRectSearch(st.active); return; }
  if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); closeRectSearch(true); return; }
  if(ev.key === 'Tab'){ closeRectSearch(false); }
}

function pickRectSearch(k){
  const st = rectSearch;
  const m = st && st.shown[k];
  if(!m) return;
  const sel = st.sel, value = st.items[m.i].value;
  closeRectSearch(true);
  if(sel.value === value) return;
  // The change usually draws the widget again: the focus goes to the list in the same place.
  const at = [...document.querySelectorAll('select')].indexOf(sel);
  sel.value = value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  if(!sel.isConnected){ const again = document.querySelectorAll('select')[at]; if(again) again.focus(); }
}

function closeRectSearch(refocus){
  const st = rectSearch;
  if(!st) return;
  rectSearch = null;
  document.removeEventListener('pointerdown', rectSearchOutside, true);
  window.removeEventListener('resize', rectSearchScroll);
  document.removeEventListener('scroll', rectSearchScroll, true);
  st.box.remove();
  if(refocus && st.sel.isConnected) st.sel.focus();
}
function rectSearchOutside(ev){
  if(rectSearch && !rectSearch.box.contains(ev.target) && ev.target !== rectSearch.sel) closeRectSearch(false);
}
// The page scrolling or resizing: the box follows the list (its own list scrolling is left alone).
function rectSearchScroll(ev){
  if(!rectSearch || rectSearch.box.contains(ev.target)) return;
  if(!rectSearch.sel.isConnected){ closeRectSearch(false); return; }
  placeRectSearch();
}
