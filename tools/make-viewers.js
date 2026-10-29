#!/usr/bin/env node
// Makes many showcase viewers at once (phase V5 of docs/viewer-brief.md):
//
//   npm run make-viewers -- --out DIR [options] MODELS…
//
//   MODELS             .fmide documents and system .json files, folders holding them (every
//                      one inside, not in sub-folders), or file patterns such as models/*.fmide
//                      (worked out here: a Windows terminal doesn't expand them)
//   --out DIR          where the viewers, report.json and report.txt go (required)
//   --recipe FILE      a recipe (the showcase's recipe form): what every model shows, its
//                      rectangles and canvases by name
//   --auto             a model with nothing chosen gets sliders and bars chosen for it
//   --no-excel         no workbooks: quick, and no browser needed
//   --excel-style FILE an Excel style file (ExcelExporter's Export Excel Style) for every workbook
//   --write-recipe FILE  writes a recipe from the first viewer's boards, by name, to adjust
//
// Each viewer is <id>.html, the same page fmIDE's File → Make Showcase Viewer… makes: the
// viewer as apps/fmViewer.html has it, with the showcase, the model and (with Excel) the
// workbook in its data blocks. The workbook is made by ExcelExporter itself, unchanged:
// apps/ExcelExporter.html opened from disk in Chromium without a window (Playwright, the test
// tooling), a fresh browser context for each model, asked through its window.fmExcel. Only the
// workbook it makes, the author's, goes into a viewer; none of ExcelExporter's code does.
// A model that fails is reported and the others go on. Nothing is sent anywhere.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const B = require('./viewer-batch.js');

const ROOT = path.join(__dirname, '..');
const VIEWER_PAGE = path.join(ROOT, 'apps', 'fmViewer.html');
const EXCEL_PAGE = path.join(ROOT, 'apps', 'ExcelExporter.html');
const WORKBOOK_WAIT = 120000;

function fail(msg){ console.error('make-viewers: ' + msg); process.exit(1); }

function parseArgs(argv){
  const o = { out: null, recipe: null, auto: false, excel: true, style: null, writeRecipe: null, models: [] };
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    const value = () => { const v = argv[++i]; if(v === undefined || v.startsWith('--')) fail(a + ' needs a value'); return v; };
    if(a === '--out') o.out = value();
    else if(a === '--recipe') o.recipe = value();
    else if(a === '--auto') o.auto = true;
    else if(a === '--no-excel') o.excel = false;
    else if(a === '--excel-style') o.style = value();
    else if(a === '--write-recipe') o.writeRecipe = value();
    else if(a.startsWith('--')) fail('unknown option ' + a);
    else o.models.push(a);
  }
  return o;
}

// The model files a list of paths, folders and patterns names, sorted, each once.
const MODEL_FILE = /\.(fmide|json)$/i;
function modelFiles(list){
  const out = new Set();
  const pattern = (p) => new RegExp('^' + p.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
  list.forEach(p => {
    const abs = path.resolve(p);
    if(p.includes('*')){
      const dir = path.dirname(abs), re = pattern(path.basename(abs));
      if(!fs.existsSync(dir)) fail('no folder ' + dir);
      fs.readdirSync(dir).filter(f => re.test(f)).forEach(f => out.add(path.join(dir, f)));
    } else if(fs.existsSync(abs) && fs.statSync(abs).isDirectory()){
      fs.readdirSync(abs).filter(f => MODEL_FILE.test(f)).forEach(f => out.add(path.join(abs, f)));
    } else if(fs.existsSync(abs)) out.add(abs);
    else fail('no file ' + p);
  });
  return [...out].filter(f => fs.statSync(f).isFile()).sort();
}

// A .json in a models folder that isn't a model (a recipe beside them, a board file) is passed
// over quietly; a .fmide always counts.
function isModelText(file, text){
  if(/\.fmide$/i.test(file)) return true;
  try{
    const d = JSON.parse(text);
    return !!d && typeof d === 'object' && (d.kind === 'system' || d.kind === 'fmIDE-workspace' || (!d.kind && Array.isArray(d.canvases)));
  }catch(e){ return true; } // reported as unreadable
}

// ExcelExporter, driven without a window: { make(excelText, boards) → answer, close() }.
async function excelExporter(style){
  let chromium;
  try{ ({ chromium } = require('@playwright/test')); }
  catch(e){ fail('the workbooks need Playwright (npm install), or use --no-excel'); }
  if(!fs.existsSync(EXCEL_PAGE)) fail('no ' + path.relative(ROOT, EXCEL_PAGE) + ': run npm run build first');
  const browser = await chromium.launch();
  const url = pathToFileURL(EXCEL_PAGE).href;
  return {
    async make(excelText, boards){
      // A fresh context for each model: nothing ExcelExporter keeps in its browser storage
      // carries from one model to the next.
      const context = await browser.newContext({ acceptDownloads: false });
      try{
        await context.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto(url);
        await page.waitForFunction(() => window.fmExcel && typeof window.fmExcel.viewerWorkbook === 'function', null, { timeout: 30000 });
        let timer;
        const waited = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ExcelExporter did not answer within ' + WORKBOOK_WAIT / 1000 + ' s.')), WORKBOOK_WAIT); });
        try{
          return await Promise.race([waited, page.evaluate(([text, b, s]) => window.fmExcel.viewerWorkbook(text, b, { style: s, base64: true }), [excelText, boards, style])]);
        } finally { clearTimeout(timer); }
      } finally { await context.close(); }
    },
    close: () => browser.close(),
  };
}

async function main(){
  const o = parseArgs(process.argv.slice(2));
  if(!o.out) fail('give --out DIR, where the viewers go');
  if(!o.models.length) fail('name the models: files, folders or patterns');
  if(!fs.existsSync(VIEWER_PAGE)) fail('no ' + path.relative(ROOT, VIEWER_PAGE) + ': run npm run build first');
  const viewerPage = fs.readFileSync(VIEWER_PAGE, 'utf8');
  let recipe = null;
  if(o.recipe){
    const r = B.readRecipeText(fs.readFileSync(path.resolve(o.recipe), 'utf8'));
    if(r.error) fail('the recipe: ' + r.error);
    r.problems.forEach(p => console.log('Recipe: ' + p));
    recipe = r.recipe;
  }
  let style = null;
  if(o.style){
    if(!o.excel) fail('--excel-style is for the workbooks: leave out --no-excel');
    try{ style = JSON.parse(fs.readFileSync(path.resolve(o.style), 'utf8')); }catch(e){ fail('the Excel style isn\'t a JSON file'); }
  }
  const files = modelFiles(o.models);
  const models = [];
  files.forEach(f => { const text = fs.readFileSync(f, 'utf8'); if(isModelText(f, text)) models.push({ fileName: path.basename(f), text }); });
  if(!models.length) fail('no models found in ' + o.models.join(' '));
  const started = Date.now();
  const excel = o.excel ? await excelExporter(style) : null;
  let result;
  try{
    result = await B.makeViewers(models, { recipe, auto: o.auto, excel: o.excel, viewerPage, makeWorkbook: excel ? excel.make : null });
  } finally { if(excel) await excel.close(); }
  const out = path.resolve(o.out);
  fs.mkdirSync(out, { recursive: true });
  result.viewers.forEach(v => fs.writeFileSync(path.join(out, v.fileName), v.text, 'utf8'));
  result.report.seconds = Math.round((Date.now() - started) / 100) / 10;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result.report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(out, 'report.txt'), B.reportText(result.report) + '\n', 'utf8');
  if(o.writeRecipe){
    if(!result.viewers.length) console.log('No viewer was made, so no recipe was written.');
    else fs.writeFileSync(path.resolve(o.writeRecipe), JSON.stringify(B.recipeFrom(result.viewers[0]), null, 2) + '\n', 'utf8');
  }
  const r = result.report;
  const mb = (r.bytes / 1048576).toFixed(1);
  console.log(r.made + ' viewer' + (r.made === 1 ? '' : 's') + ' made in ' + out + ' (' + r.withNotes + ' with notes'
    + (r.failed ? ', ' + r.failed + ' failed' : '') + ': see report.txt). ' + mb + ' MB in all, ' + r.seconds + ' s.');
  if(!r.made) process.exit(1);
}

if(require.main === module) main().catch(err => { console.error(err && err.stack || err); process.exit(1); });
module.exports = { parseArgs, modelFiles };
