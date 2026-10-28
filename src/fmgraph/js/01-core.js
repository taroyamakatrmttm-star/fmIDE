(function(){
'use strict';

// ============================================================
// fmGraph (build step 15; docs/step15-fmgraph.md): bars show rectangles' values, sliders
// change input rectangles, so a person sees how one value moves the rest of the model.
// fmGraph never changes the model: a slider is a "what if" laid over it, exactly as if the
// input's number were typed differently in fmIDE, and Reset puts it back.
//
// It calculates on the shared IR (src/shared/ir.js), the same calculation fmIDE shows, and
// reads files with the shared readers. Everything read from a file is shown as plain text
// (textContent, never markup) and every number is forced to be a number.
// ============================================================

// build:include shared/escaping.js
// build:include shared/operators.js
// build:include shared/uom.js
// build:include shared/input-rule.js
// build:include shared/functions.js
// build:include shared/ir.js
// build:include shared/error-words.js
// build:include shared/file-formats.js
// build:include shared/store.js
// build:include shared/pointer-input.js
// build:include shared/snap.js

const $ = (id) => document.getElementById(id);

function make(tag, cls, text){
  const el = document.createElement(tag);
  if(cls) el.className = cls;
  if(text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

// Messages under the top bar, each with ×. A message with a `slot` replaces the last one in
// the same slot (e.g. loading), so they don't pile up.
function notify(text, kind, slot){
  const box = $('notices');
  if(slot){ const old = box.querySelector('[data-slot="' + slot + '"]'); if(old) old.remove(); }
  if(!text) return;
  const n = make('div', 'note ' + (kind || 'info'), text);
  n.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  if(slot) n.dataset.slot = slot;
  const x = make('button', 'note-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Dismiss');
  x.addEventListener('click', () => n.remove());
  n.appendChild(x);
  box.appendChild(n);
}

// A question with two answers. Resolves true for OK.
function askConfirm(title, text, okLabel){
  return new Promise(resolve => {
    const back = $('confirmBox');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmYes').textContent = okLabel || 'OK';
    back.classList.remove('hidden');
    const done = (answer) => {
      back.classList.add('hidden');
      $('confirmYes').removeEventListener('click', yes);
      $('confirmNo').removeEventListener('click', no);
      document.removeEventListener('keydown', key, true);
      resolve(answer);
    };
    const yes = () => done(true), no = () => done(false);
    const key = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); done(false); } };
    $('confirmYes').addEventListener('click', yes);
    $('confirmNo').addEventListener('click', no);
    document.addEventListener('keydown', key, true);
    $('confirmYes').focus();
  });
}
