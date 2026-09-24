// LibreOffice helper: recalculate .xlsx workbooks headlessly and read back the values.
// Locally optional (tests skip with a clear message); required on CI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const SKIP_MESSAGE = 'skipped: LibreOffice not installed';
const NO_CALC_MESSAGE = 'skipped: LibreOffice is installed without Calc (it cannot open spreadsheets) — install LibreOffice Calc';

// SOFFICE_PATH overrides the search (e.g. a non-standard install location).
let cached;
function findSoffice(){
  if(cached !== undefined) return cached;
  if(process.env.SOFFICE_PATH !== undefined){
    const p = process.env.SOFFICE_PATH;
    cached = p && fs.existsSync(p) ? p : null;
    return cached;
  }
  // On Windows, soffice.com waits for the conversion to finish; soffice.exe may return early.
  const names = process.platform === 'win32' ? ['soffice.com', 'soffice.exe'] : ['soffice', 'libreoffice'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if(process.platform === 'win32'){
    for(const pf of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)']){
      if(pf) dirs.push(path.join(pf, 'LibreOffice', 'program'));
    }
  } else if(process.platform === 'darwin'){
    dirs.push('/Applications/LibreOffice.app/Contents/MacOS');
  } else {
    dirs.push('/usr/bin', '/usr/local/bin', '/opt/libreoffice/program', '/snap/bin');
  }
  cached = null;
  for(const d of dirs){
    for(const n of names){
      const p = path.join(d, n);
      try{ if(fs.statSync(p).isFile()){ cached = p; return cached; } }catch(e){ /* keep looking */ }
    }
  }
  return cached;
}

// Can this soffice open spreadsheets? (Some Linux installs have only libreoffice-core.)
let calcOk;
function hasCalc(){
  if(calcOk !== undefined) return calcOk;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-calc-probe-'));
  try{
    fs.writeFileSync(path.join(dir, 'probe.csv'), 'a,b\n1,2\n');
    runSoffice(['--convert-to', 'xlsx', '--outdir', path.join(dir, 'out'), path.join(dir, 'probe.csv')], path.join(dir, 'profile'));
    calcOk = fs.existsSync(path.join(dir, 'out', 'probe.xlsx'));
  }catch(e){ calcOk = false; }
  finally{ fs.rmSync(dir, { recursive: true, force: true }); }
  return calcOk;
}

// Call at the top of a LibreOffice test: skips locally when missing, fails on CI.
let announced = false;
function skipWith(test, message){
  // Printed once per worker: the list reporter doesn't show skip reasons.
  if(!announced){ announced = true; console.log('\n  ' + message + ' (the LibreOffice recalculation tests are skipped)\n'); }
  test.skip(true, message);
}
function requireSoffice(test){
  const exe = findSoffice();
  if(!exe){
    if(process.env.CI) throw new Error('LibreOffice (soffice) is required on CI but was not found.');
    skipWith(test, SKIP_MESSAGE);
  }
  if(!hasCalc()){
    if(process.env.CI) throw new Error('LibreOffice is required on CI but cannot open spreadsheets (is libreoffice-calc installed?).');
    skipWith(test, NO_CALC_MESSAGE);
  }
  return exe;
}

function runSoffice(args, profile){
  return execFileSync(findSoffice(), [
    '-env:UserInstallation=' + pathToFileURL(profile).href,
    '--headless', '--norestore', '--nolockcheck', ...args,
  ], { stdio: 'pipe', timeout: 180_000 });
}

// Recalculate workbooks: { name: Buffer } -> { name: Buffer } (recalculated .xlsx files).
// All files go through one soffice run with its own profile, so parallel workers don't clash.
function recalc(files){
  const exe = findSoffice();
  if(!exe) throw new Error(SKIP_MESSAGE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-recalc-'));
  try{
    const inDir = path.join(dir, 'in'), outDir = path.join(dir, 'out'), profile = path.join(dir, 'profile');
    fs.mkdirSync(inDir); fs.mkdirSync(outDir);
    const inputs = Object.entries(files).map(([name, bytes]) => {
      const p = path.join(inDir, name + '.xlsx');
      fs.writeFileSync(p, bytes);
      return p;
    });
    const log = String(runSoffice(['--calc', '--convert-to', 'xlsx', '--outdir', outDir, ...inputs], profile));
    const out = {};
    for(const name of Object.keys(files)){
      const p = path.join(outDir, name + '.xlsx');
      if(!fs.existsSync(p)) throw new Error('LibreOffice did not produce ' + name + '.xlsx\n' + log);
      out[name] = fs.readFileSync(p);
    }
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The calculated value of an exceljs cell (formula result or plain value).
function valueOf(cell){
  const v = cell.value;
  if(v && typeof v === 'object'){
    if('result' in v) return v.result && typeof v.result === 'object' && 'error' in v.result ? v.result.error : v.result;
    if('error' in v) return v.error;
    if('richText' in v) return v.richText.map(t => t.text).join('');
    if('formula' in v || 'sharedFormula' in v) return undefined;
  }
  return v;
}

module.exports = { findSoffice, hasCalc, requireSoffice, recalc, valueOf, SKIP_MESSAGE };
