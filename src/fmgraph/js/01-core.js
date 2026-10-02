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
// build:include shared/file-formats.js
// build:include shared/store.js
// build:include shared/pointer-input.js

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

// Numbers as people read them: thousands separated, at most a few decimals.
function fmtNum(v){
  if(typeof v !== 'number' || !isFinite(v)) return '—';
  if(v === 0) v = 0; // −0 reads as 0
  const a = Math.abs(v);
  const digits = a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 3 : 4;
  return v.toLocaleString('en-US', { maximumFractionDigits: digits }).replace('-', '−');
}
function fmtDiff(now, base){
  const d = now - base;
  if(!isFinite(d) || Math.abs(d) < 1e-12 * Math.max(1, Math.abs(base))) return '';
  let t = (d > 0 ? '+' : '−') + fmtNum(Math.abs(d));
  if(base !== 0 && isFinite(base)){
    const pct = d / Math.abs(base) * 100;
    t += ' (' + (pct > 0 ? '+' : '−') + Math.abs(pct).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%)';
  }
  return t;
}

// What an error code means, in plain words (the calculation's codes, src/shared/ir.js).
function errorText(code){
  const T = {
    'cycle': 'part of a circular reference',
    'alias-unset': 'an alias that points to nothing',
    'alias-missing-canvas': 'an alias to a canvas that no longer exists',
    'alias-missing-node': 'an alias to a rectangle that no longer exists',
    'no-input': 'nothing is connected to it',
    'ambiguous': 'several arrows go straight into it',
    'missing-input': 'something it reads could not be worked out',
    'period-out-of-range': 'it reads a period outside the timeline',
    'math-error': 'an invalid result (e.g. dividing by zero)',
    'unary-only': 'an operator that takes one input has more',
    'needs-two': 'a comparison needs two inputs',
    'block-missing-def': 'its block no longer exists',
    'block-missing-output': 'the block output it reads no longer exists',
    'block-cycle': 'a block that contains itself',
    'operator-unknown': 'an operator fmGraph doesn\'t know',
    'operator-input-unwired': 'an operator input is not connected',
    'choose-out-of-range': 'a choose whose index picks no choice',
    'function-missing': 'a function the model doesn\'t carry',
    'function-unreadable': 'a function whose formula can\'t be read',
    'function-cycle': 'a function that calls itself',
    'function-too-deep': 'functions nested too deeply',
    'function-arguments': 'a function called with the wrong inputs',
    'function-input-unwired': 'a function input is not connected',
  };
  return T[code] || 'could not be worked out';
}
