// ============================================================
// The compare strip on fmGraph's page (A, ⇄ Swap, Unpin) and 📌 Pin as A. A itself and the
// gliding bars are 05e-compare.js, the board engine's.
// ============================================================

function renderCompareBar(){
  const bar = $('compareBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !pinA || !model);
  $('btnPinA').setAttribute('aria-pressed', pinA ? 'true' : 'false');
  if(!pinA || !model) return;
  const mark = make('span', 'compare-mark', 'A');
  holdToLook(mark, () => pinA ? { overrides: pinA.overrides, label: 'A' } : null); // on a phone (05h-phone-show.js)
  bar.appendChild(mark);
  const text = make('span', 'compare-text');
  text.appendChild(make('strong', null, 'Comparing with A: '));
  text.appendChild(document.createTextNode(pinA.label));
  bar.appendChild(text);
  const button = (label, title, fn) => { const b = make('button', 'compare-btn', label); b.type = 'button'; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); return b; };
  button('⇄ Swap', 'Put the sliders where A had them, and keep where they are now as A', () => swapWithA());
  button('Unpin', 'Compare with the model\'s own numbers again', () => unpinA());
}

$('btnPinA').addEventListener('click', () => pinAsA());
