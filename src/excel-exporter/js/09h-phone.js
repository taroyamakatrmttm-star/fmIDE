// ============================================================
// ExcelExporter on a phone (step 17, phase P3; docs/step17-phones.md)
// ============================================================
// On a touchscreen whose shorter side is under 600 pixels (isPhoneScreen, src/shared/phone.js)
// ExcelExporter is one screen (body.phone): the model's name, the tabs the workbook will hold
// (each with its row count; the layout saved for this model, else the automatic one — whatever
// was set up on a larger screen is used as it is), where it will differ from fmIDE (the usual
// list), the file name, and ⬇ Make the workbook, which hands the .xlsx to the phone's share
// sheet (a download where the browser can't share files). ☰: Open a model file…, ↻ From fmIDE
// (when fmIDE opened this window), Help, Full app (the whole page; 📱 Phone layout back; kept in
// this browser, fmide-excel-full-app). Laying out tabs and rows, the Excel style and
// Sensitivity's settings stay on a larger screen. Decided once at start: a phone's screen keeps
// its size. Everything from the model is shown as text.
// build:include shared/phone.js

// (var: syncPageState() may run before this file has started; it looks at it.)
var excelPhoneReady = false;
const PHONE_FULL_APP_KEY = 'fmide-excel-full-app';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let phoneFullApp = false;

function isExcelPhone(){ return document.body.classList.contains('phone'); }
function applyExcelPhoneLayout(){
  const screenIsPhone = isPhoneScreen();
  document.body.classList.toggle('phone-screen', screenIsPhone);
  document.body.classList.toggle('phone', screenIsPhone && !phoneFullApp);
  $('phoneLayoutBtn').classList.toggle('hidden', !(screenIsPhone && phoneFullApp));
  if(!isExcelPhone()) closePhoneMenu();
  renderExcelPhone();
}
function setExcelFullApp(full){
  phoneFullApp = !!full;
  layoutStore.put(PHONE_FULL_APP_KEY, phoneFullApp ? '1' : '').catch(() => {});
  applyExcelPhoneLayout();
}

// The workbook's file name, as Generate writes it, made safe to hand to the phone.
function phoneWorkbookName(){
  const base = String((mapping && mapping.cfg.fileName) || 'fmIDE-export').replace(/\.xlsx$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 120);
  return (base || 'fmIDE-export') + '.xlsx';
}
function tabRowCount(tab){
  return [...mapping.rows, ...inputMirrorRows()].filter(r => r.tabId === tab.id && r.include).length + mapping.customRows.filter(r => r.tabId === tab.id).length;
}
// The workbook's tabs, built without downloading it; remembered until the model or layout changes.
let phoneSheetsCache = null; // { ir, layout, wb }
function phoneSheets(){
  const layout = JSON.stringify(mapping);
  if(phoneSheetsCache && phoneSheetsCache.ir === modelIR && phoneSheetsCache.layout === layout) return phoneSheetsCache.wb;
  let wb = null;
  try{ wb = buildWorkbook().wb; }catch(e){ wb = null; }
  phoneSheetsCache = { ir: modelIR, layout, wb };
  return wb;
}
// The one screen, following the model (called from syncPageState).
function renderExcelPhone(){
  if(!excelPhoneReady || !isExcelPhone()) return;
  const loaded = !!(model && mapping);
  $('phoneStart').classList.toggle('hidden', loaded);
  $('phoneLoaded').classList.toggle('hidden', !loaded);
  $('phoneMenuFromFmide').classList.toggle('hidden', !fmideWindowBehind());
  if(!loaded) return;
  const list = $('phoneTabs');
  list.textContent = '';
  const tabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  // What the workbook will hold besides the tabs laid out (Sensitivity, Functions, block
  // instance tabs, charts): read from the workbook itself, built without downloading it.
  const sheets = phoneSheets();
  const names = sheets ? sheets.SheetNames : tabs.map(t => t.name);
  names.forEach(name => {
    const li = document.createElement('li');
    const tab = tabs.find(t => t.name === name);
    const n = document.createElement('span');
    n.className = 'phone-tab-name';
    n.textContent = name;
    const c = document.createElement('span');
    c.className = 'phone-tab-count';
    if(tab){ const k = tabRowCount(tab); c.textContent = k + ' row' + (k === 1 ? '' : 's'); }
    else if(sheets && sheets.Sheets[name] && sheets.Sheets[name]['!chartsheet']) c.textContent = 'chart';
    li.append(n, c);
    list.appendChild(li);
  });
  if(document.activeElement !== $('phoneFileName')) $('phoneFileName').value = mapping.cfg.fileName;
}

// ⬇ Make the workbook: built and handed over within the tap (a share sheet needs the tap).
async function makeWorkbookOnPhone(){
  if(!model || !mapping) return null;
  let bytes;
  try{ bytes = XLSX.write(buildWorkbook().wb); }
  catch(err){ setStatus($('genStatus'), 'Could not make the workbook: ' + err.message, 'err'); return null; }
  const name = phoneWorkbookName();
  const how = await shareFiles([new File([bytes], name, { type: XLSX_MIME })], name);
  if(how === 'shared') setStatus($('genStatus'), 'Workbook shared: ' + name, 'ok');
  else if(how === 'downloaded') setStatus($('genStatus'), 'Workbook downloaded: ' + name, 'ok');
  return how;
}

// ---- ☰ ----
function openPhoneMenu(){
  $('phoneMenu').classList.remove('hidden');
  $('phoneMenuBtn').setAttribute('aria-expanded', 'true');
}
function closePhoneMenu(){
  $('phoneMenu').classList.add('hidden');
  $('phoneMenuBtn').setAttribute('aria-expanded', 'false');
}
$('phoneMenuBtn').addEventListener('click', () => { if($('phoneMenu').classList.contains('hidden')) openPhoneMenu(); else closePhoneMenu(); });
document.addEventListener('pointerdown', (ev) => {
  if(!$('phoneMenu').classList.contains('hidden') && !ev.target.closest('#phoneMenu, #phoneMenuBtn')) closePhoneMenu();
}, true);
document.addEventListener('keydown', (ev) => {
  if(ev.key === 'Escape' && !$('phoneMenu').classList.contains('hidden')){ ev.stopPropagation(); closePhoneMenu(); $('phoneMenuBtn').focus(); }
}, true);
const phoneMenuItem = (id, fn) => $(id).addEventListener('click', () => { closePhoneMenu(); fn(); });
phoneMenuItem('phoneMenuOpen', () => $('fileInput').click());
phoneMenuItem('phoneMenuFromFmide', () => $('btnFromFmide').click());
phoneMenuItem('phoneMenuHelp', () => excelHelp.open('phone'));
phoneMenuItem('phoneMenuFullApp', () => setExcelFullApp(true));
$('phoneLayoutBtn').addEventListener('click', () => setExcelFullApp(false));
$('phoneOpen').addEventListener('click', () => $('fileInput').click());
$('phoneMake').addEventListener('click', () => { makeWorkbookOnPhone(); });
$('phoneFileName').addEventListener('change', () => {
  if(!mapping) return;
  mapping.cfg.fileName = $('phoneFileName').value;
  $('cfgFileName').value = mapping.cfg.fileName;
  saveMapping();
});

excelPhoneReady = true;
applyExcelPhoneLayout();
layoutsMigrated.then(() => layoutStore.get(PHONE_FULL_APP_KEY)).then(raw => {
  phoneFullApp = raw === '1';
  applyExcelPhoneLayout();
}, () => {});
