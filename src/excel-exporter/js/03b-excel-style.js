// ============================================================
// The Excel style panel (section 2) — the person's own look for every cell in the workbook
// (step 11a). Saved in this browser under EXCEL_STYLE_KEY (the same fmIDE-excel-style JSON
// text Export Excel Style writes), so it applies to every model loaded here; Export / Import
// moves it between computers; Reset to Defaults brings back EXCEL_ROLES' styles. Everything
// from storage or a file goes through readKnownFile and cleanExcelStyle.
// ============================================================
function readExcelStyleData(parsed){
  const r = readKnownFile(parsed, ['fmIDE-excel-style']);
  if(r.error) return r;
  return Object.assign(r, { style: cleanExcelStyle(r.data.roles) });
}
const excelStyleLoaded = layoutsMigrated.then(() => layoutStore.get(EXCEL_STYLE_KEY)).then(raw => {
  if(typeof raw !== 'string' || !raw) return;
  try{
    const r = readExcelStyleData(JSON.parse(raw));
    if(!r.error) excelStyle = r.style; // a newer version's style: read as far as this one can
  }catch(err){ /* unreadable: keep the defaults */ }
}, () => {});

let excelStyleSaveFailing = false;
function saveExcelStyle(){
  layoutStore.requestPersistence();
  let text;
  try{ text = JSON.stringify(excelStylePayload()); }
  catch(err){ onExcelStyleSaveFailed(err); return Promise.resolve(); }
  return layoutStore.put(EXCEL_STYLE_KEY, text).then(() => {
    if(excelStyleSaveFailing){ excelStyleSaveFailing = false; $('storageWarn').classList.add('hidden'); }
  }, onExcelStyleSaveFailed);
}
function onExcelStyleSaveFailed(err){
  if(excelStyleSaveFailing) return;
  excelStyleSaveFailing = true;
  const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
  $('storageWarn').textContent = (full ? "Saving your Excel style failed: the browser's storage is full." : 'Saving your Excel style failed: this browser is not letting ExcelExporter store data.') +
    ' It works for now but will be lost on reload — use "Export Excel Style" to keep it.';
  $('storageWarn').classList.remove('hidden');
}

// A small "Aa 1,234" sample of a role's look (validated values only).
function paintExcelStyleSwatch(el, st){
  el.style.background = st.fill || '#ffffff';
  el.style.color = st.font.color || '#1e293b';
  el.style.fontWeight = st.font.weight === '700' ? '700' : 'normal';
  el.style.fontSize = st.font.size ? Math.min(st.font.size, 16) + 'px' : '12px';
  const line = st.border.style === 'none' ? 'none' : '1px ' + st.border.style + ' ' + st.border.color;
  EXCEL_SIDES.forEach(k => {
    const prop = 'border' + k[0].toUpperCase() + k.slice(1);
    el.style[prop] = line !== 'none' && st.border.sides.includes(k) ? line : '1px solid transparent';
  });
}

function renderExcelStyle(){
  const body = $('excelStyleBody');
  if(!body) return;
  body.innerHTML = '';
  EXCEL_ROLES.forEach(role => {
    const st = excelStyle[role.name];
    const tr = document.createElement('tr');
    tr.dataset.role = role.name;
    const field = (name, el) => { el.dataset.field = name; return el; };
    const input = (type, name) => { const el = document.createElement('input'); el.type = type; return field(name, el); };
    const labelled = (el, text) => { const l = document.createElement('label'); l.className = 'xs-check'; l.append(el, document.createTextNode(text)); return l; };
    const cell = (...els) => { const td = document.createElement('td'); els.forEach(e => td.appendChild(e)); tr.appendChild(td); return td; };

    const name = document.createElement('div'); name.className = 'xs-name'; name.textContent = role.name;
    const desc = document.createElement('div'); desc.className = 'xs-desc'; desc.textContent = role.desc;
    cell(name, desc);
    const swatch = document.createElement('span'); swatch.className = 'xs-swatch'; swatch.textContent = 'Aa 1,234';
    paintExcelStyleSwatch(swatch, st);
    cell(swatch);

    const fill = input('color', 'fill'); fill.value = st.fill || '#ffffff'; fill.title = 'Fill colour';
    const fillNone = input('checkbox', 'fillNone'); fillNone.checked = !st.fill;
    cell(fill, labelled(fillNone, 'None'));

    const fontColor = input('color', 'fontColor'); fontColor.value = st.font.color || '#000000'; fontColor.title = 'Font colour';
    const fontAuto = input('checkbox', 'fontAuto'); fontAuto.checked = !st.font.color; fontAuto.title = "Excel's automatic font colour (black)";
    cell(fontColor, labelled(fontAuto, 'Auto'));

    const bold = input('checkbox', 'bold'); bold.checked = st.font.weight === '700';
    cell(labelled(bold, 'Bold'));

    const size = input('number', 'size'); size.min = String(EXCEL_FONT_SIZE_MIN); size.max = String(EXCEL_FONT_SIZE_MAX);
    size.placeholder = 'default'; size.title = "Font size in points; leave blank for the workbook's default (normally 11)";
    size.value = st.font.size ? String(st.font.size) : '';
    cell(size);

    const bStyle = field('borderStyle', document.createElement('select'));
    EXCEL_BORDER_STYLES.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v === 'none' ? 'No border' : v; bStyle.appendChild(o); });
    bStyle.value = st.border.style;
    const bColor = input('color', 'borderColor'); bColor.value = st.border.color; bColor.title = 'Border colour';
    const sides = document.createElement('span'); sides.className = 'xs-sides';
    const sideBoxes = {};
    EXCEL_SIDES.forEach(k => {
      const cb = input('checkbox', 'side-' + k); cb.checked = st.border.sides.includes(k);
      sideBoxes[k] = cb;
      sides.appendChild(labelled(cb, k[0].toUpperCase() + k.slice(1)));
    });
    cell(bStyle, bColor, sides);

    const commit = () => {
      const n = Math.round(Number(size.value));
      excelStyle[role.name] = cleanExcelRoleStyle({
        fill: fillNone.checked ? null : fill.value,
        font: { color: fontAuto.checked ? null : fontColor.value, weight: bold.checked ? '700' : 'normal',
                size: size.value.trim() && Number.isFinite(n) ? n : null },
        border: { style: bStyle.value, color: bColor.value, sides: EXCEL_SIDES.filter(k => sideBoxes[k].checked) }
      }, role.style);
      const now = excelStyle[role.name];
      if(now.font.size && String(now.font.size) !== size.value) size.value = String(now.font.size);
      paintExcelStyleSwatch(swatch, now);
      saveExcelStyle();
    };
    // Picking a colour switches its "None" / "Auto" off.
    fill.addEventListener('input', () => { fillNone.checked = false; });
    fontColor.addEventListener('input', () => { fontAuto.checked = false; });
    tr.querySelectorAll('input, select').forEach(el => el.addEventListener('change', commit));
    body.appendChild(tr);
  });
}

$('btnExportStyle').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(excelStylePayload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'excelexporter-style.json'; a.click();
  URL.revokeObjectURL(url);
});
$('btnImportStyle').addEventListener('click', () => $('excelStyleFileInput').click());
$('excelStyleFileInput').addEventListener('change', () => {
  const file = $('excelStyleFileInput').files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { parsed, error } = parseFileText(reader.result);
    if(error){ setStatus($('excelStyleStatus'), error, 'err'); return; }
    const r = readExcelStyleData(parsed);
    if(r.error){ setStatus($('excelStyleStatus'), r.error, 'err'); return; }
    if(!(await confirmNewerFile(r))){ setStatus($('excelStyleStatus'), 'Excel style not imported.', 'info'); return; }
    excelStyle = r.style;
    saveExcelStyle();
    renderExcelStyle();
    setStatus($('excelStyleStatus'), 'Excel style imported.', 'ok');
  };
  reader.readAsText(file);
  $('excelStyleFileInput').value = '';
});
$('btnResetStyle').addEventListener('click', async () => {
  const ok = await showConfirm('Reset the Excel style?',
    'This puts every role back to ExcelExporter\'s built-in look, for every model you load here. Use "Export Excel Style" first if you might want yours back.',
    'Reset Style');
  if(!ok) return;
  excelStyle = defaultExcelStyle();
  saveExcelStyle();
  renderExcelStyle();
  setStatus($('excelStyleStatus'), 'Excel style reset to the defaults.', 'ok');
});
