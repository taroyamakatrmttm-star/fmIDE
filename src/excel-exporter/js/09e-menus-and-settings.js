// ============================================================
// The page: top bar menus, Settings, Paste JSON, dropping a file anywhere
// ============================================================
// Every file and reset sits in the top bar's two menus (File, Layout); Settings holds this
// model's workbook settings and your own Excel style; Generate is always in the top bar.
// The buttons keep their ids, so their own handlers (in the files that own them) are unchanged.

let currentModelLabel = ''; // the loaded model's file name (or "Sample model"), shown in the top bar

// What depends on a model being loaded: the welcome screen, Generate, the menu items for
// this model's layout, Settings' Workbook tab and the model's name.
function syncPageState(){
  const loaded = !!(model && mapping);
  $('loadPanel').classList.toggle('hidden', loaded);
  $('btnGenerate').disabled = !loaded;
  document.querySelectorAll('.menu-list .needs-model').forEach(b => {
    if(b.dataset.tip === undefined) b.dataset.tip = b.title;
    b.disabled = !loaded;
    b.title = loaded ? b.dataset.tip : 'Load a model first';
  });
  $('settingsTabWorkbook').disabled = !loaded;
  $('modelName').textContent = loaded ? currentModelLabel : '';
  $('modelName').title = loaded ? `${model.canvases.length} canvas${model.canvases.length === 1 ? '' : 'es'}, ${model.periods.length} periods` : '';
  if(excelPhoneReady) renderExcelPhone(); // the phone's one screen (09h)
}

// ---------- Menus ----------
// A menu opens on a click (or tap), Enter, Space or ↓; ↑ ↓ Home End move through its items,
// ← → go to the next menu, Esc or a click elsewhere closes it, and choosing an item closes it.
const MENUS = [['menuFile', 'menuFileList'], ['menuLayout', 'menuLayoutList']].map(([b, l]) => ({ btn: $(b), list: $(l) }));
let openMenuEntry = null;
function menuItems(m){ return [...m.list.querySelectorAll('[role=menuitem]')].filter(b => !b.disabled && !b.classList.contains('hidden')); }
function openMenu(m, focusFirst){
  if(openMenuEntry && openMenuEntry !== m) closeMenu(false);
  openMenuEntry = m;
  m.list.classList.remove('hidden');
  m.btn.setAttribute('aria-expanded', 'true');
  m.btn.classList.add('open');
  if(focusFirst){ const items = menuItems(m); if(items.length) items[0].focus(); }
}
function closeMenu(focusButton){
  const m = openMenuEntry;
  if(!m) return;
  openMenuEntry = null;
  m.list.classList.add('hidden');
  m.btn.setAttribute('aria-expanded', 'false');
  m.btn.classList.remove('open');
  if(focusButton) m.btn.focus();
}
let menuHoverOpenedAt = 0;
MENUS.forEach((m, i) => {
  m.btn.addEventListener('click', () => {
    // A click just after pointing at it opened it keeps it open.
    if(openMenuEntry === m && Date.now() - menuHoverOpenedAt > 400) closeMenu(false);
    else openMenu(m, false);
  });
  // With a menu open, pointing at the other menu's name opens that one (a mouse only).
  m.btn.addEventListener('mouseenter', () => {
    if(openMenuEntry && openMenuEntry !== m){ openMenu(m, false); menuHoverOpenedAt = Date.now(); }
  });
  m.btn.addEventListener('keydown', (ev) => {
    if(ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openMenu(m, true); }
  });
  m.list.addEventListener('keydown', (ev) => {
    const items = menuItems(m);
    const at = items.indexOf(document.activeElement);
    const go = (k) => { ev.preventDefault(); if(items.length) items[(k + items.length) % items.length].focus(); };
    if(ev.key === 'ArrowDown') go(at + 1);
    else if(ev.key === 'ArrowUp') go(at < 0 ? -1 : at - 1);
    else if(ev.key === 'Home') go(0);
    else if(ev.key === 'End') go(-1);
    else if(ev.key === 'Escape'){ ev.preventDefault(); closeMenu(true); }
    else if(ev.key === 'Tab') closeMenu(false);
    else if(ev.key === 'ArrowRight' || ev.key === 'ArrowLeft'){
      ev.preventDefault();
      openMenu(MENUS[(i + (ev.key === 'ArrowRight' ? 1 : MENUS.length - 1)) % MENUS.length], true);
    }
  });
  // An item's own handler runs first (it is on the item); then the menu closes.
  m.list.addEventListener('click', (ev) => { if(ev.target.closest('[role=menuitem]')) closeMenu(false); });
});
// Esc closes an open menu wherever the focus is (opened by a click, it stays on the menu's name).
document.addEventListener('keydown', (ev) => {
  if(ev.key !== 'Escape' || !openMenuEntry || ev.defaultPrevented) return;
  ev.preventDefault();
  closeMenu(true);
});
document.addEventListener('pointerdown', (ev) => {
  if(openMenuEntry && !openMenuEntry.list.contains(ev.target) && !openMenuEntry.btn.contains(ev.target)) closeMenu(false);
}, true);

$('btnOpenModel').addEventListener('click', () => $('fileInput').click());
$('btnMenuSample').addEventListener('click', () => $('btnLoadSample').click());
$('btnMenuPaste').addEventListener('click', () => openPasteDialog());
$('btnMenuStyle').addEventListener('click', () => openSettings('style'));

// ---------- Dialogs (Settings, Paste JSON) ----------
// Esc, the backdrop or Close shut them, and the focus goes back where it was.
function wireDialog(modal, onClose){
  modal.addEventListener('click', (ev) => { if(ev.target === modal) onClose(); });
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'Escape' || ev.defaultPrevented || modal.classList.contains('hidden')) return;
    if(!$('confirmModal').classList.contains('hidden')) return; // the confirmation answers its own Esc
    const help = document.getElementById('helpPanel');
    if(help && help.contains(ev.target)) return;                // Esc in Help closes Help
    ev.preventDefault();
    onClose();
  });
}

let settingsOpener = null;
function openSettings(which){
  const loaded = !!(model && mapping);
  renderExcelStyle(); // your Excel style is there with or without a model
  showSettingsTab(which === 'style' || !loaded ? 'style' : 'workbook');
  settingsOpener = document.activeElement;
  $('settingsModal').classList.remove('hidden');
  $('settingsDone').focus();
}
function closeSettings(){
  if($('settingsModal').classList.contains('hidden')) return;
  $('settingsModal').classList.add('hidden');
  if(settingsOpener && document.contains(settingsOpener) && settingsOpener.focus) settingsOpener.focus();
  settingsOpener = null;
}
function showSettingsTab(which){
  const style = which === 'style';
  $('periodsPanel').classList.toggle('hidden', style);
  $('excelStyleBlock').classList.toggle('hidden', !style);
  [['settingsTabWorkbook', !style], ['settingsTabStyle', style]].forEach(([id, on]) => {
    $(id).classList.toggle('active', on);
    $(id).setAttribute('aria-selected', String(on));
  });
}
$('btnSettings').addEventListener('click', () => openSettings());
$('settingsTabWorkbook').addEventListener('click', () => showSettingsTab('workbook'));
$('settingsTabStyle').addEventListener('click', () => showSettingsTab('style'));
$('settingsClose').addEventListener('click', closeSettings);
$('settingsDone').addEventListener('click', closeSettings);
wireDialog($('settingsModal'), closeSettings);

let pasteOpener = null;
function openPasteDialog(){
  pasteOpener = document.activeElement;
  $('pasteModal').classList.remove('hidden');
  $('pasteArea').focus();
}
function closePasteDialog(){
  if($('pasteModal').classList.contains('hidden')) return;
  $('pasteModal').classList.add('hidden');
  if(pasteOpener && document.contains(pasteOpener) && pasteOpener.focus && !pasteOpener.closest('.hidden')) pasteOpener.focus();
  pasteOpener = null;
}
$('pasteCancel').addEventListener('click', closePasteDialog);
wireDialog($('pasteModal'), closePasteDialog);

// ---------- Dropping a file anywhere on the page ----------
// The welcome screen's box takes a drop itself (10-wiring.js); elsewhere, a file dropped on the
// page opens like File → Open Model…, with the whole page outlined while it is held over it.
function dragHasFiles(ev){ return !!(ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files')); }
let fileDragDepth = 0;
document.addEventListener('dragenter', (ev) => {
  if(!dragHasFiles(ev)) return;
  fileDragDepth++;
  document.body.classList.add('file-over');
});
document.addEventListener('dragleave', (ev) => {
  if(!dragHasFiles(ev)) return;
  fileDragDepth = Math.max(0, fileDragDepth - 1);
  if(!fileDragDepth) document.body.classList.remove('file-over');
});
document.addEventListener('dragover', (ev) => { if(dragHasFiles(ev)) ev.preventDefault(); });
document.addEventListener('drop', (ev) => {
  fileDragDepth = 0;
  document.body.classList.remove('file-over');
  if(!dragHasFiles(ev)) return;
  ev.preventDefault();
  if($('dropZone').contains(ev.target)) return; // the box handles its own drop
  const file = ev.dataTransfer.files[0];
  if(file) readFile(file);
});

// What sticks under the top bar (the sidebar, the selection bar) follows its height, which
// grows when it wraps onto two lines in a narrow window.
(function followTopBarHeight(){
  const bar = document.querySelector('.topbar');
  if(!bar || typeof ResizeObserver !== 'function') return;
  new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px')).observe(bar);
})();
