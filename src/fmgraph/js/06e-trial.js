// ============================================================
// Try in fmGraph (G5c). fmIDE's Browse Library can show a pack's canvas or system template here,
// with the board it carries, before anything is added: fmIDE sends 'fmIDE:try' — { name (the
// template's), text (its model, as a system file's text), templateBoards (its board, as for
// G5b), pack (the pack's title) }. The model is read like any file, and shown in try mode:
// - the template's boards, placed by rectangle name (06d-template-sources.js), whatever fits;
// - nothing read from or kept in this browser, nothing sent to fmIDE (not linked to its
//   document), Attach to template… hidden; everything else works (sliders, Trace, Pin as A,
//   changing the boards, Export for a template…);
// - a strip says so, with Show fmIDE's model (↻ From fmIDE does the same).
// ============================================================
let trying = null; // { name, pack } while a template from the library is shown

function openTrial(d){
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 120) : 'A template';
  const pack = typeof d.pack === 'string' && d.pack.trim() ? d.pack.trim().slice(0, 120) : 'the library';
  let templates = [];
  if(typeof d.templateBoards === 'string' && d.templateBoards.length <= 8 * 1024 * 1024){
    try{ const t = JSON.parse(d.templateBoards); if(Array.isArray(t) && !fileDataProblem(t)) templates = t; }catch(e){ /* none */ }
  }
  return openModelText(d.text, name, { boards: null, fromFmide: false, templates, trial: { name, pack } })
    .then(ok => { if(ok) notify('Trying “' + name + '” from the library. Nothing is kept or added to fmIDE.', 'ok', 'load'); return ok; });
}

function renderTrialBar(){
  const bar = $('trialBar');
  bar.textContent = '';
  bar.classList.toggle('hidden', !trying || !model);
  if(!trying || !model) return;
  const text = make('span', 'trial-text');
  text.appendChild(make('strong', null, 'Trying “' + trying.name + '”'));
  text.appendChild(document.createTextNode(' from the library pack “' + trying.pack + '”. Nothing is kept: add it to your library in fmIDE to keep it.'));
  bar.appendChild(text);
  const b = make('button', 'trial-btn', 'Show fmIDE\'s model');
  b.type = 'button';
  b.title = 'Leave the template and show the model open in fmIDE';
  b.addEventListener('click', () => {
    if(!askFmideForModel()) notify('fmIDE\'s window is closed: open fmGraph from fmIDE again, or open a saved file.', 'info', 'load');
  });
  bar.appendChild(b);
}
