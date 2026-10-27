(function(){
'use strict';

// ============================================================
// fmShowcase (the showcase viewer, phase V1 of docs/viewer-brief.md): an fmIDE model shown
// read-only. A visitor looks at the logic — pans and zooms the canvases, taps a rectangle for
// its value in every period and how it is worked out — and can change nothing. There are no
// editing controls at all, and nothing is ever sent anywhere.
//
// Made only from shared code (src/shared/) and its own: no ExcelExporter code, ever. Every
// text from a file is shown with textContent, every number forced to be a number, every
// colour through safeColor (canvas-view.js); nothing from a file is run.
// ============================================================

// build:include shared/escaping.js
// build:include shared/operators.js
// build:include shared/uom.js
// build:include shared/input-rule.js
// build:include shared/functions.js
// build:include shared/ir.js
// build:include shared/error-words.js
// build:include shared/file-formats.js
// build:include shared/format-roles.js
// build:include shared/canvas-geometry.js
// build:include shared/number-format.js
// build:include shared/canvas-view.js
// build:include shared/showcase.js
// build:include shared/pointer-input.js
// build:include shared/phone.js
// build:include shared/file-picker.js

const $ = (id) => document.getElementById(id);

function make(tag, cls, text){
  const el = document.createElement(tag);
  if(cls) el.className = cls;
  if(text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

// Messages under the top bar, each with ×. A message with a `slot` replaces the last one in
// the same slot, so they don't pile up.
function notify(text, kind, slot){
  const box = $('notices');
  if(slot){ const old = box.querySelector('[data-slot="' + slot + '"]'); if(old) old.remove(); }
  if(!text) return;
  const n = make('div', 'note ' + (kind || 'info'));
  n.appendChild(make('span', 'note-text', text));
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

// The page as a phone shows it (the shared isPhoneScreen), decided once at start.
const onPhone = isPhoneScreen();
document.body.classList.toggle('phone', onPhone);
