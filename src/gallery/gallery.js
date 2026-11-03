/* The showcase gallery's one script (/gallery, put in the page by tools/build-gallery.js and
   allowed by its exact hash in the page's policy). Apache License 2.0. It only shows what the
   page already holds: search (every word typed must be in a viewer's title, description or
   section) and Grid or List, the choice kept on this device. It reads the page's own text and
   data attributes, writes only textContent and hidden, builds no markup and connects to nothing.
   Without it, the page shows every viewer as cards, the switch and search box staying hidden. */
(function(){
  'use strict';
  var KEY = 'fmGallery.view';
  var tools = document.getElementById('galleryTools');
  var box = document.getElementById('gallerySearch');
  var count = document.getElementById('galleryCount');
  var none = document.getElementById('galleryNone');
  var grid = document.getElementById('viewerGrid');
  var list = document.getElementById('viewerList');
  var buttons = { grid: document.getElementById('viewGrid'), list: document.getElementById('viewList') };
  if(!tools || !box || !count || !none || !grid || !list || !buttons.grid || !buttons.list) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.viewer-card'));
  var rows = Array.prototype.slice.call(list.querySelectorAll('.viewer-row'));
  var sections = Array.prototype.slice.call(grid.querySelectorAll('section'));
  var ids = function(items){ var s = {}; items.forEach(function(e){ s[e.getAttribute('data-id')] = true; }); return Object.keys(s).length; };
  var total = ids(rows);
  var words = function(text){ return String(text).toLowerCase().split(/\s+/).filter(Boolean); };
  var matches = function(el, want){
    var have = String(el.getAttribute('data-search') || '').toLowerCase();
    return want.every(function(w){ return have.indexOf(w) >= 0; });
  };

  function filter(){
    var want = words(box.value);
    var shown = [];
    cards.forEach(function(c){ var ok = matches(c, want); c.hidden = !ok; });
    rows.forEach(function(r){ var ok = matches(r, want); r.hidden = !ok; if(ok) shown.push(r); });
    sections.forEach(function(s){
      s.hidden = !Array.prototype.some.call(s.querySelectorAll('.viewer-card'), function(c){ return !c.hidden; });
    });
    var n = ids(shown);
    count.textContent = want.length ? n + ' of ' + total : total + ' viewer' + (total === 1 ? '' : 's');
    none.hidden = !(want.length && n === 0);
  }

  function show(view, keep){
    if(view !== 'list') view = 'grid';
    grid.hidden = view !== 'grid';
    list.hidden = view !== 'list';
    buttons.grid.setAttribute('aria-pressed', String(view === 'grid'));
    buttons.list.setAttribute('aria-pressed', String(view === 'list'));
    if(keep){ try{ localStorage.setItem(KEY, view); }catch(e){} }
  }

  var kept = null;
  try{ kept = localStorage.getItem(KEY); }catch(e){}
  show(kept === 'list' ? 'list' : 'grid', false);
  buttons.grid.addEventListener('click', function(){ show('grid', true); });
  buttons.list.addEventListener('click', function(){ show('list', true); });
  box.addEventListener('input', filter);
  box.addEventListener('search', filter);
  box.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ e.preventDefault(); box.value = ''; filter(); }
  });
  tools.hidden = false;
  filter();
})();
