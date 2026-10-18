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
let excelImport = null; // { fileName, book, plans, include }

const IMPORT_KIND_NAMES = { title: 'title', input: 'input', assumption: 'assumption', calculation: 'calculation', opening: 'opening balance', single: 'one formula' };
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
  excelImport = { fileName: String(file.name || 'workbook.xlsx'), book, plans: found.sheets, include: found.sheets.map(p => p.byPeriods && !p.hidden) };
  openImportWindow();
}

function importSummary(plan){
  if(!plan.byPeriods) return 'No row of periods found: give a header row to import it.';
  const counts = xlKindCounts(plan);
  const parts = ['input', 'assumption', 'calculation', 'opening', 'single', 'title']
    .filter(k => counts[k]).map(k => counts[k] + ' ' + IMPORT_KIND_NAMES[k] + (counts[k] === 1 ? '' : 's'));
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
  const any = excelImport && excelImport.plans.some((p, i) => p.byPeriods && excelImport.include[i]);
  ok.disabled = !any || typeof buildImportedModel !== 'function';
  ok.title = typeof buildImportedModel !== 'function' ? 'Building the model from the workbook comes in the next update (step 20e)'
    : (any ? 'Build the fmIDE model from the sheets ticked' : 'Tick a sheet to import');
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
  $('importOk').onclick = () => { if(typeof buildImportedModel === 'function'){ close(); buildImportedModel(); } };
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey, true);
  modal.classList.remove('hidden');
  ($('importOk').disabled ? $('importCancel') : $('importOk')).focus();
}
