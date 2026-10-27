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

// What an error code means, in plain words (the calculation's codes, src/shared/ir.js).
const ERROR_WORDS = {
  'cycle': 'part of a circular reference',
  'alias-unset': 'an alias that points to nothing',
  'alias-missing-canvas': 'an alias to a canvas that no longer exists',
  'alias-missing-node': 'an alias to a rectangle that no longer exists',
  'no-input': 'nothing is connected to it',
  'ambiguous': 'several arrows go straight into it',
  'missing-input': 'something it reads could not be worked out',
  'period-out-of-range': 'it reads a period outside the timeline',
  'math-error': 'an invalid result (for example dividing by zero)',
  'unary-only': 'an operator that takes one input has more',
  'needs-two': 'a comparison needs two inputs',
  'block-missing-def': 'its block no longer exists',
  'block-missing-output': 'the block output it reads no longer exists',
  'block-cycle': 'a block that contains itself',
  'operator-unknown': 'an operator this version doesn\'t know',
  'operator-input-unwired': 'an operator input is not connected',
  'choose-out-of-range': 'a choose whose index picks no choice',
  'function-missing': 'a function the model doesn\'t carry',
  'function-unreadable': 'a function whose formula can\'t be read',
  'function-cycle': 'a function that calls itself',
  'function-too-deep': 'functions nested too deeply',
  'function-arguments': 'a function called with the wrong inputs',
  'function-input-unwired': 'a function input is not connected',
};
function errorWords(code){ return Object.prototype.hasOwnProperty.call(ERROR_WORDS, code) ? ERROR_WORDS[code] : 'could not be worked out'; }

// The page as a phone shows it (the shared isPhoneScreen), decided once at start.
const onPhone = isPhoneScreen();
document.body.classList.toggle('phone', onPhone);
