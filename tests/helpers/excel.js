// ExcelExporter helpers: load a model, toggle options, and capture the generated workbook
// without downloading it (the XLSX.writeFile override from tests/SPEC.md).
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { openApp, fixture, expect } = require('./apps');

async function openExporter(page){
  await openApp(page, 'ExcelExporter');
}

// Load a model file through the real file input. Waits for the status line.
async function loadModelFile(page, file){
  await page.setInputFiles('#fileInput', file);
  await expect(page.locator('#loadStatus .status')).toBeVisible();
}

async function loadFixtureModel(page, name){
  await loadModelFile(page, fixture('models', name));
  await expect(page.locator('#loadStatus .status.ok')).toBeVisible();
  await expect(page.locator('#afterLoad')).toBeVisible();
}

// A command in the top bar's menus (File, Layout): open its menu, then choose it.
async function menuCommand(page, id){
  await closeSettings(page);
  const menu = await page.locator('#' + id).evaluate(el => el.closest('.menu').querySelector('.menu-btn').id);
  await page.click('#' + menu);
  await page.click('#' + id);
}
// ⚙ Settings, on its Workbook or Excel Style tab; and closing it (it covers the page).
async function openSettings(page, tab = 'workbook'){
  if(await page.locator('#settingsModal').isHidden()) await page.click('#btnSettings');
  await page.click(tab === 'style' ? '#settingsTabStyle' : '#settingsTabWorkbook');
}
async function closeSettings(page){
  if(await page.locator('#settingsModal').isVisible()) await page.click('#settingsDone');
  await expect(page.locator('#settingsModal')).toBeHidden();
}

// Turn the Inputs tab on or off. Turning it off asks for confirmation.
async function setInputsTab(page, on){
  await closeSettings(page);
  const box = page.locator('#cfgInputsEnabled');
  if((await box.isChecked()) === on) return;
  await box.click();
  if(!on){
    await expect(page.locator('#confirmModal')).toBeVisible();
    await page.click('#confirmOk');
  }
  await expect(box).toBeChecked({ checked: on });
}

async function setSections(page, on){
  await closeSettings(page);
  const box = page.locator('#cfgSectionsEnabled');
  if((await box.isChecked()) !== on) await box.click();
  await expect(box).toBeChecked({ checked: on });
}

// Click Generate and return { wb, bytes (Buffer), name } — the workbook object the app
// intended, and the real .xlsx bytes the app's own writer produced from it.
async function generate(page){
  await page.evaluate(() => {
    XLSX.writeFile = (wb, name) => { window.__wb = wb; window.__bytes = Array.from(XLSX.write(wb)); window.__name = name; };
    window.__wb = undefined;
  });
  await closeSettings(page);
  await page.click('#btnGenerate');
  await expect(page.locator('#genStatus .status.ok')).toBeVisible();
  const out = await page.evaluate(() => ({ wb: JSON.parse(JSON.stringify(window.__wb)), bytes: window.__bytes, name: window.__name }));
  return { wb: out.wb, bytes: Buffer.from(out.bytes), name: out.name };
}

// Re-serialise an (edited) workbook object with the app's own writer.
async function writeWithApp(page, wb){
  const bytes = await page.evaluate((w) => Array.from(XLSX.write(w)), wb);
  return Buffer.from(bytes);
}

async function readBack(bytes){
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  return book;
}

async function unzip(bytes){
  const zip = await JSZip.loadAsync(bytes);
  const parts = {};
  for(const name of Object.keys(zip.files)){
    if(!zip.files[name].dir) parts[name] = await zip.files[name].async('string');
  }
  return parts;
}

// ---------- cell addresses ----------
function colToNum(letters){ let n = 0; for(const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function numToCol(n){ let s = ''; while(n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function splitAddr(addr){ const m = /^([A-Z]{1,3})(\d+)$/.exec(addr); return m ? { col: colToNum(m[1]), row: Number(m[2]) } : null; }
function cellAddrs(ws){ return Object.keys(ws).filter(k => k[0] !== '!' && splitAddr(k)); }

// Formula text without a leading '='.
function formulaOf(cell){ return cell && typeof cell.f === 'string' && cell.f !== '' ? cell.f.replace(/^=/, '') : null; }

// Relative R1C1 form of an A1 formula written in cell `addr` (strings left untouched).
function toR1C1(formula, addr){
  const here = splitAddr(addr);
  const parts = formula.split(/("(?:[^"]|"")*")/);
  return parts.map((p, i) => {
    if(i % 2) return p; // string literal
    return p.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(!])/g, (m, dc, col, dr, row) => {
      const c = colToNum(col), r = Number(row);
      const rs = dr ? 'R' + r : (r === here.row ? 'R' : 'R[' + (r - here.row) + ']');
      const cs = dc ? 'C' + c : (c === here.col ? 'C' : 'C[' + (c - here.col) + ']');
      return rs + cs;
    });
  }).join('');
}

// Every sheet's cells as { addr: {f} | {v} } — formulas and values only (for snapshots).
function formulasAndValues(wb){
  const out = {};
  for(const name of wb.SheetNames){
    const ws = wb.Sheets[name], cells = {};
    cellAddrs(ws).sort((a, b) => { const x = splitAddr(a), y = splitAddr(b); return x.row - y.row || x.col - y.col; }).forEach(addr => {
      const c = ws[addr], f = formulaOf(c);
      if(f !== null) cells[addr] = { f };
      else if(c.v !== undefined && c.v !== null && c.v !== '') cells[addr] = { v: c.v };
    });
    out[name] = cells;
  }
  return out;
}

// Text of a cell in the intended workbook (value, or '' for none).
function text(ws, addr){ const c = ws[addr]; return c && c.v !== undefined && c.v !== null ? String(c.v) : ''; }

// Rows of a sheet as { row: { col: cell } }.
function rowsOf(ws){
  const rows = {};
  cellAddrs(ws).forEach(addr => { const { row, col } = splitAddr(addr); (rows[row] = rows[row] || {})[col] = ws[addr]; });
  return rows;
}

// Find the row whose column-A label equals `label`.
function findRow(ws, label, col = 'A'){
  const hits = cellAddrs(ws).filter(a => a.startsWith(col) && /^\d+$/.test(a.slice(col.length)) && text(ws, a) === label);
  return hits.map(a => Number(a.slice(col.length)));
}

// The column holding period 1: row 3 holds the period counter 1..N.
function periodOneCol(ws){
  const hits = cellAddrs(ws).filter(a => splitAddr(a).row === 3 && ws[a].v === 1 && !formulaOf(ws[a]));
  return hits.length ? Math.min(...hits.map(a => splitAddr(a).col)) : null;
}

module.exports = { menuCommand, openSettings, closeSettings,
  openExporter, loadModelFile, loadFixtureModel, setInputsTab, setSections, generate, writeWithApp, readBack, unzip,
  colToNum, numToCol, splitAddr, cellAddrs, formulaOf, toR1C1, formulasAndValues, text, rowsOf, findRow, periodOneCol,
};
