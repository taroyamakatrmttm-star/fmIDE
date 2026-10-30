(function(){
'use strict';

// ============================================================
// fmShowcase (the showcase viewer, docs/viewer-brief.md): an fmIDE model shown read-only. On
// the Board (phase V2) a visitor moves the author's sliders within their ranges, shows the
// scenarios, plays between two, pins A and traces; on the Logic view (phase V1) they pan and
// zoom the canvases and tap a rectangle for its value in every period and how it is worked
// out. There are no editing controls at all, and nothing is ever sent anywhere; what the
// visitor moved is kept on this device only (08-state.js).
//
// Made only from fmGraph's board engine, shared code (src/shared/) and its own: no
// ExcelExporter code, ever. Every
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
// build:include shared/xlsx-patch.js
// build:include shared/pointer-input.js
// build:include shared/phone.js
// build:include shared/file-picker.js
// build:include shared/store.js
// build:include shared/help-panel.js

// The Board (phase V2): fmGraph's board engine — reading boards, the calculation with sliders,
// the figures and the drawing of every bar and chart, scenarios, Play, A/B, Trace — taken in as
// it is, fragment by fragment. None of fmGraph's editing: its "-edit" fragments are not here,
// and what the engine asks of a page (renderBoard, updateValues, a key's swatch…, the page
// interface in .claude/rules/fmgraph.md) is this app's own (06-board.js). Test group 92 checks it.
// build:include fmgraph/js/01b-numbers.js
// build:include fmgraph/js/02-model.js
// build:include fmgraph/js/03-calc.js
// build:include fmgraph/js/04-board.js
// build:include fmgraph/js/04a-board-file.js
// build:include fmgraph/js/04b-charts.js
// build:include fmgraph/js/04d-scale.js
// build:include fmgraph/js/04e-colours.js
// build:include fmgraph/js/04f-free.js
// build:include fmgraph/js/05-render.js
// build:include fmgraph/js/05b-chart-render.js
// build:include fmgraph/js/05d-explore.js
// build:include fmgraph/js/05e-compare.js
// build:include fmgraph/js/05f-scenarios.js
// build:include fmgraph/js/05gs-show.js
// build:include fmgraph/js/05k-shared-period.js
// build:include fmgraph/js/05m-play.js
// build:include fmgraph/js/05n-free-chart.js
// build:include fmgraph/js/06a-sample.js

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
