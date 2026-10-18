// ============================================================
// Importing an Excel model (step 20, docs/step20-excel-import.md): File → Import Excel
// model… reads an .xlsx model and rebuilds it as an fmIDE model. The importer's pieces are
// modules in src/excel-exporter/import/ (tested in Node, group 79); every name they export
// starts with xl.
// ============================================================

// build:include excel-exporter/import/zip.js
// build:include excel-exporter/import/xml.js
// build:include excel-exporter/import/workbook.js
// build:include excel-exporter/import/formula.js
// build:include excel-exporter/import/layout.js

// ---------- File → Import Excel model… and the confirm screen (step 20d) ----------
// The workbook is read (xlReadWorkbook, xlFillSharedFormulas), each sheet worked out
// (xlAnalyseWorkbook), and the window shows what was found: per sheet, whether it is
// imported, its header row, period columns, label and unit columns, and its rows with their
// kinds. Changing a choice works that sheet out again. Every text from the file is shown
// with textContent.
// `var`: syncPageState (09e, earlier in the file) reads it through syncImportReportItem.
var excelImport = null; // { fileName, book, plans, include, split, result, check, model }

const IMPORT_KIND_NAMES = { title: 'title', input: 'input', assumption: 'assumption', calculation: 'calculation', opening: 'opening balance', single: 'one formula', parts: 'in parts' };
// The kinds counted in a sheet's summary: one and several.
const IMPORT_KIND_COUNTED = { title: ['title', 'titles'], input: ['input', 'inputs'], assumption: ['assumption', 'assumptions'], calculation: ['calculation', 'calculations'],
  opening: ['opening balance', 'opening balances'], single: ['one formula', 'one formulas'], parts: ['row in parts', 'rows in parts'] };
const IMPORT_ROWS_SHOWN = 300;

$('btnImportExcel').addEventListener('click', () => $('excelImportInput').click());
letAnyFileBePicked([$('excelImportInput')]);
$('excelImportInput').addEventListener('change', () => {
  const file = $('excelImportInput').files[0];
  if(file) importExcelFile(file);
  $('excelImportInput').value = '';
});

async function importExcelFile(file){
  let book;
  try{
    const bytes = new Uint8Array(await file.arrayBuffer());
    book = xlFillSharedFormulas(await xlReadWorkbook(bytes));
  }catch(err){
    setStatus($('loadStatus'), 'Could not import ' + (file.name || 'that file') + ': ' + (err instanceof XlImportError ? err.message : 'it can\'t be read as an Excel workbook.'), 'err');
    return;
  }
  const found = xlAnalyseWorkbook(book);
  excelImport = { fileName: String(file.name || 'workbook.xlsx'), book, plans: found.sheets, include: found.sheets.map(p => p.byPeriods && !p.hidden),
    split: found.sheets.map(importSplitByDefault) };
  openImportWindow();
}

// A tall sheet with sections is a canvas per section unless the person unticks it.
function importSplitByDefault(plan){ return plan.sections.length >= 2 && xlRectangleRows(plan) > XL_SECTION_MIN_ROWS; }

function importSummary(plan){
  if(!plan.byPeriods) return 'No row of periods found: give a header row to import it.';
  const counts = xlKindCounts(plan);
  const parts = ['input', 'assumption', 'calculation', 'parts', 'opening', 'single', 'title']
    .filter(k => counts[k]).map(k => counts[k] + ' ' + IMPORT_KIND_COUNTED[k][counts[k] === 1 ? 0 : 1]);
  const span = plan.periods.length > 1 ? plan.periods[0] + '–' + plan.periods[plan.periods.length - 1] : plan.periods[0];
  return plan.periods.length + ' period' + (plan.periods.length === 1 ? '' : 's') + ', ' + span + ' · ' + (parts.join(', ') || 'no rows');
}

function importChoiceInput(cls, label, value, title){
  const l = document.createElement('label');
  l.title = title;
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.className = cls;
  input.value = value;
  input.setAttribute('aria-label', label);
  l.append(span, input);
  return l;
}

function renderImportSheet(section, i){
  const plan = excelImport.plans[i];
  section.textContent = '';
  const head = document.createElement('div');
  head.className = 'import-sheet-head';
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'import-include';
  cb.checked = excelImport.include[i] && plan.byPeriods;
  cb.disabled = !plan.byPeriods;
  cb.addEventListener('change', () => { excelImport.include[i] = cb.checked; syncImportOk(); });
  const name = document.createElement('span');
  name.className = 'import-sheet-name';
  name.textContent = plan.name + (plan.hidden ? ' (hidden)' : '');
  label.append(cb, name);
  const summary = document.createElement('span');
  summary.className = 'import-summary';
  summary.textContent = importSummary(plan);
  head.append(label, summary);
  if(plan.byPeriods && plan.sections.length >= 2){
    const sl = document.createElement('label');
    sl.className = 'import-split-label';
    sl.title = 'A canvas for each section of the sheet: ' + plan.sections.map(x => x.label).join(', ');
    const scb = document.createElement('input');
    scb.type = 'checkbox';
    scb.className = 'import-split';
    scb.checked = !!excelImport.split[i];
    scb.addEventListener('change', () => { excelImport.split[i] = scb.checked; });
    const st = document.createElement('span');
    st.textContent = 'One canvas per section (' + plan.sections.length + ')';
    sl.append(scb, st);
    head.appendChild(sl);
  }
  section.appendChild(head);

  const choices = document.createElement('div');
  choices.className = 'import-choices';
  const col = (n) => n ? xlColLetters(n) : '';
  choices.append(
    importChoiceInput('import-header', 'Header row', plan.headerRow ? String(plan.headerRow) : '', 'The row holding the periods (years, dates or names)'),
    importChoiceInput('import-first', 'Periods from', col(plan.firstCol), 'The first period\'s column'),
    importChoiceInput('import-last', 'to', col(plan.lastCol), 'The last period\'s column'),
    importChoiceInput('import-label', 'Labels', col(plan.labelCol), 'The column holding each row\'s name'),
    importChoiceInput('import-unit', 'Units', col(plan.unitCol), 'The column holding each row\'s unit (empty: none)'));
  choices.addEventListener('change', () => {
    const v = (cls) => choices.querySelector('.' + cls).value.trim();
    const headerRow = Number(v('import-header'));
    const choice = {};
    if(Number.isInteger(headerRow) && headerRow >= 1 && headerRow <= XL_MAX_ROW){
      choice.headerRow = headerRow;
      const first = xlColNumber(v('import-first')), last = xlColNumber(v('import-last'));
      if(first && last && last >= first && headerRow === plan.headerRow){ choice.firstCol = first; choice.lastCol = last; }
    }
    const lab = v('import-label'), unit = v('import-unit');
    choice.labelCol = lab ? (xlColNumber(lab) || null) : null;
    choice.unitCol = unit ? (xlColNumber(unit) || null) : null;
    const wasOn = plan.byPeriods;
    excelImport.plans[i] = xlAnalyseSheet(excelImport.book.sheets[i], choice, excelImport.book.date1904);
    if(!wasOn && excelImport.plans[i].byPeriods) excelImport.include[i] = true;
    excelImport.split[i] = importSplitByDefault(excelImport.plans[i]);
    renderImportSheet(section, i);
    syncImportOk();
  });
  section.appendChild(choices);

  if(plan.rows.length){
    const details = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Rows';
    details.appendChild(sum);
    const table = document.createElement('table');
    table.className = 'import-rows';
    const hr = table.createTHead().insertRow();
    ['Row', 'Label', 'Kind', 'Formula'].forEach(t => { const th = document.createElement('th'); th.textContent = t; hr.appendChild(th); });
    const body = table.createTBody();
    plan.rows.slice(0, IMPORT_ROWS_SHOWN).forEach(r => {
      const tr = body.insertRow();
      tr.dataset.row = String(r.row);
      const formula = r.kind === 'single' && r.before ? r.before.formula : (r.kind === 'assumption' && r.before ? String(r.before.value) : (r.formula || ''));
      [String(r.row), r.label, IMPORT_KIND_NAMES[r.kind], formula].forEach((t, k) => {
        const td = tr.insertCell();
        td.textContent = t || '';
        if(k === 3) td.className = 'import-formula';
      });
      if(r.odd.length){
        const odd = document.createElement('div');
        odd.className = 'import-odd';
        odd.textContent = 'differs in ' + r.odd.join(', ');
        tr.cells[3].appendChild(odd);
      }
    });
    details.appendChild(table);
    if(plan.rows.length > IMPORT_ROWS_SHOWN){
      const more = document.createElement('p');
      more.className = 'graph-source';
      more.textContent = 'and ' + (plan.rows.length - IMPORT_ROWS_SHOWN) + ' more rows';
      details.appendChild(more);
    }
    section.appendChild(details);
  }
}

function syncImportOk(){
  const ok = $('importOk');
  const any = !!excelImport && excelImport.plans.some((p, i) => p.byPeriods && excelImport.include[i]);
  ok.disabled = !any;
  ok.title = any ? 'Build the fmIDE model from the sheets ticked' : 'Tick a sheet to import';
}

// Import: the model built from the sheets ticked (xlBuildModel), loaded as any model file is.
// The report (what was kept as Excel's saved values, and why) stays in `excelImport.result`.
async function buildImportedModel(){
  let built;
  try{
    built = xlBuildModel(excelImport.book, excelImport.plans, excelImport.include, excelImport.split);
  }catch(err){
    setStatus($('loadStatus'), 'Could not import ' + excelImport.fileName + ': ' + (err instanceof XlImportError ? err.message : 'the model could not be built.'), 'err');
    return;
  }
  excelImport.result = built;
  const label = excelImport.fileName;
  const before = model;
  await tryLoad(JSON.stringify(built.system), label, label.replace(/\.xls[xm]?$/i, ''));
  if(model === before || !model) return; // tryLoad said why
  useImportedLayout(built.layout);
  excelImport.check = xlCheckModel(built.system, built.report);
  excelImport.model = model;
  syncImportReportItem();
  const check = excelImport.check;
  setStatus($('loadStatus'), importLoadedMessage(built.report), built.report.notTranslated.length || check.differ.length ? 'warn' : 'ok');
  openImportReport();
}

// The workbook's own layout for the imported model (xlBuildModel's `layout`): each canvas's tab
// in one list (no Inputs / Calculations / Outputs sections), its rows in the sheet's order with
// a label row for each title and an empty one for each blank row; the numbers written in the
// formulas are Constants again, written into the formulas. It replaces the layout the model
// was given (or had in this browser) and is saved like any change.
const IMPORT_LABEL_MAX = 200;
function useImportedLayout(layout){
  if(!layout || !mapping) return;
  mapping.cfg.sectionsEnabled = false;
  const byId = new Map(mapping.rows.map(r => [r.id, r]));
  layout.canvases.forEach(lc => {
    const tab = mapping.tabs.find(t => t.id === 'tab_' + lc.id);
    if(!tab) return;
    mapping.customRows = mapping.customRows.filter(r => r.tabId !== tab.id);
    let k = 0;
    lc.items.forEach(item => {
      if(item.node !== undefined){
        const row = byId.get(pathKey([], lc.id, item.node));
        if(row && row.tabId === tab.id) row.flatOrder = k++;
        return;
      }
      mapping.customRows.push({
        id: 'custom_xl_' + lc.id + '_' + k, isCustom: true, tabId: tab.id, section: 'input',
        label: item.title !== undefined ? String(item.title).slice(0, IMPORT_LABEL_MAX) : '', style: null, showPeriodLabels: false,
        flatOrder: k++,
      });
    });
    // A row the layout doesn't name (none, today) goes after it.
    mapping.rows.filter(r => r.tabId === tab.id && !lc.items.some(it => it.node !== undefined && pathKey([], lc.id, it.node) === r.id)).forEach(r => { r.flatOrder = k++; });
  });
  const canvasById = {}; model.canvases.forEach(c => { canvasById[c.id] = c; });
  layout.constants.forEach(({ canvasId, nodeId }) => {
    const row = byId.get(pathKey([], canvasId, nodeId));
    const c = canvasById[canvasId];
    const node = c && c.nodes.find(n => n.id === nodeId);
    if(row && node && isInputRectangle(c, node)) row.inlineConstant = true;
  });
  mapping.tabs.forEach(t => { ensureSectionOrderAll(t.id); ensureFlatOrder(t.id); });
  saveMapping();
  renderAll();
}

// File → Import Report… and Save for fmIDE: shown while the model is the one imported.
function syncImportReportItem(){
  const shown = !!(excelImport && excelImport.check && excelImport.model && excelImport.model === model);
  ['btnImportReport', 'btnSaveForFmide'].forEach(id => { const item = $(id); if(item) item.classList.toggle('hidden', !shown); });
}
$('btnImportReport').addEventListener('click', () => openImportReport());
$('btnSaveForFmide').addEventListener('click', () => saveImportedForFmide());
$('importSave').addEventListener('click', () => saveImportedForFmide());

// Save for fmIDE: the imported model as a system file (fmIDE: File → Open…), named after the workbook.
function saveImportedForFmide(){
  if(!excelImport || !excelImport.result) return;
  const base = excelImport.fileName.replace(/\.xls[xm]?$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 100) || 'imported-model';
  const blob = new Blob([JSON.stringify(excelImport.result.system, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = base + '.json'; a.click();
  URL.revokeObjectURL(url);
  setStatus($('loadStatus'), 'Saved ' + base + '.json — open it in fmIDE with File → Open….', 'ok');
}

// A number as the report shows it: up to 12 significant digits.
function importNumber(v){
  if(typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return String(Number(v.toPrecision(12)));
}

function importCheckSummary(check){
  if(!check.compared && check.noSaved) return { text: 'Nothing to compare: the workbook was saved without its formulas\' values. Save it in Excel, then import it again.', kind: 'warn' };
  if(!check.compared) return { text: 'No calculated cells to compare.', kind: 'warn' };
  const n = check.compared.toLocaleString('en');
  let text = check.differ.length
    ? check.agree.toLocaleString('en') + ' of ' + n + ' calculated cells agree with Excel\'s saved values; ' + check.differ.length.toLocaleString('en') + ' differ.'
    : 'All ' + n + ' calculated cells agree with Excel\'s saved values.';
  if(check.noSaved) text += ' ' + check.noSaved.toLocaleString('en') + ' had no saved value.';
  return { text, kind: check.differ.length ? 'warn' : 'ok' };
}

const IMPORT_REPORT_SHOWN = 200;

function fillImportList(listId, headId, items){
  const list = $(listId);
  list.textContent = '';
  items.slice(0, IMPORT_REPORT_SHOWN).forEach(t => { const li = document.createElement('li'); li.textContent = t; list.appendChild(li); });
  if(items.length > IMPORT_REPORT_SHOWN){ const li = document.createElement('li'); li.textContent = 'and ' + (items.length - IMPORT_REPORT_SHOWN) + ' more'; list.appendChild(li); }
  $(headId).classList.toggle('hidden', !items.length);
}

function openImportReport(){
  if(!excelImport || !excelImport.check) return;
  const { report } = excelImport.result, check = excelImport.check;
  const periods = excelImport.result.system.periods;
  $('importReportSource').textContent = excelImport.fileName + ' · ' + report.canvases + ' canvas' + (report.canvases === 1 ? '' : 'es') + ', ' + report.rectangles + ' rectangles';
  const sum = importCheckSummary(check);
  const el = $('importCheckSummary');
  el.textContent = sum.text;
  el.className = 'import-check ' + sum.kind;
  fillImportList('importDiffer', 'importDifferHead', check.differ.map(d =>
    d.sheet + '!' + d.address + ' · ' + d.label + (d.period !== null && periods[d.period] !== undefined ? ' · ' + periods[d.period] : '') + ': ' +
    'fmIDE ' + (d.got === null ? 'an error' + (d.error ? ' (' + d.error + ')' : '') : importNumber(d.got)) + ', Excel ' + (d.excel || importNumber(d.saved))));
  fillImportList('importKept', 'importKeptHead', report.notTranslated.map(k => k.sheet + '!' + k.cells + ' · ' + k.label + ': ' + k.why));
  fillImportList('importOdd', 'importOddHead', report.odd.map(o => o.sheet + '!' + o.cells.join(', ') + ' · ' + o.label + ': ' + o.how));
  fillImportList('importReportNotes', 'importReportNotesHead', [...excelImport.book.notes, ...report.notes]);
  const modal = $('importReportModal');
  const opener = document.activeElement;
  const close = () => {
    modal.classList.add('hidden');
    $('importReportClose').onclick = null;
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey, true);
    if(opener && document.contains(opener) && opener.focus && !opener.closest('.hidden')) opener.focus();
  };
  const onBackdrop = (ev) => { if(ev.target === modal) close(); };
  const onKey = (ev) => { if(ev.key === 'Escape'){ ev.preventDefault(); close(); } };
  $('importReportClose').onclick = close;
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey, true);
  modal.classList.remove('hidden');
  $('importReportClose').focus();
}

function importLoadedMessage(report){
  const kept = report.notTranslated;
  let msg = 'Imported ' + excelImport.fileName + ' — ' + report.canvases + ' canvas' + (report.canvases === 1 ? '' : 'es') + ', ' +
    report.rectangles + ' rectangles, ' + model.periods.length + ' periods.';
  if(kept.length){
    const shown = kept.slice(0, 5).map(k => k.label + ' (' + k.why + ')');
    msg += ' ' + kept.length + ' row' + (kept.length === 1 ? '' : 's') + ' kept as Excel\'s saved values: ' + shown.join(', ') + (kept.length > 5 ? ', …' : '') + '.';
  }
  if(report.odd.length) msg += ' ' + report.odd.length + ' row' + (report.odd.length === 1 ? '' : 's') + ' with cells that differ, kept as Excel\'s saved values there.';
  return msg;
}

function openImportWindow(){
  const modal = $('importModal');
  const { book } = excelImport;
  $('importSource').textContent = excelImport.fileName + ' · ' + book.sheets.length + ' sheet' + (book.sheets.length === 1 ? '' : 's');
  const list = $('importSheets');
  list.textContent = '';
  excelImport.plans.forEach((p, i) => {
    const section = document.createElement('section');
    section.className = 'import-sheet';
    section.dataset.sheet = String(i);
    list.appendChild(section);
    renderImportSheet(section, i);
  });
  const notes = $('importNotes');
  notes.textContent = '';
  book.notes.forEach(n => { const li = document.createElement('li'); li.textContent = n; notes.appendChild(li); });
  $('importNotesHead').classList.toggle('hidden', !book.notes.length);
  syncImportOk();
  const opener = document.activeElement;
  const close = () => {
    modal.classList.add('hidden');
    $('importCancel').onclick = $('importOk').onclick = null;
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey, true);
    if(opener && document.contains(opener) && opener.focus && !opener.closest('.hidden')) opener.focus();
  };
  const onBackdrop = (ev) => { if(ev.target === modal) close(); };
  const onKey = (ev) => { if(ev.key === 'Escape' && $('confirmModal').classList.contains('hidden')){ ev.preventDefault(); close(); } };
  $('importCancel').onclick = close;
  $('importOk').onclick = () => { close(); buildImportedModel(); };
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey, true);
  modal.classList.remove('hidden');
  ($('importOk').disabled ? $('importCancel') : $('importOk')).focus();
}
// build:include excel-exporter/import/build.js
// build:include excel-exporter/import/check.js
