#!/usr/bin/env node
// Builds the two single-file apps in apps/ from their sources in src/.
//
//   node tools/build.js           write apps/fmIDE.html and apps/ExcelExporter.html
//   node tools/build.js --check   build in memory; exit 1 if apps/ differs from src/
//
// Each app has a page, src/<app>/index.html, in which a line consisting only of a marker
// is replaced by content:
//   <!-- build:css styles.css -->   the contents of that file
//   <!-- build:js js -->            every .js file in that folder, in file-name order
// Everything is copied exactly as it is — nothing is trimmed, added or reformatted — so
// the pieces must each end with a newline. Needs only Node: no packages.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPS = [
  { src: path.join(ROOT, 'src', 'fmide'), out: path.join(ROOT, 'apps', 'fmIDE.html') },
  { src: path.join(ROOT, 'src', 'excel-exporter'), out: path.join(ROOT, 'apps', 'ExcelExporter.html') },
];
const MARKER = /^<!-- build:(css|js) ([A-Za-z0-9._\/-]+) -->\r?$/; // \r: CRLF checkouts on Windows

function fail(msg){
  console.error('build: ' + msg);
  process.exit(1);
}

function readPiece(file){
  if(!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('missing file ' + path.relative(ROOT, file));
  const text = fs.readFileSync(file, 'utf8');
  if(text !== '' && !text.endsWith('\n')) fail(path.relative(ROOT, file) + ' must end with a newline');
  return text;
}

function readFolder(dir){
  if(!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail('missing folder ' + path.relative(ROOT, dir));
  const names = fs.readdirSync(dir).filter(n => n.endsWith('.js')).sort();
  if(names.length === 0) fail('no .js files in ' + path.relative(ROOT, dir));
  return names.map(n => readPiece(path.join(dir, n))).join('');
}

function buildApp(app){
  const page = readPiece(path.join(app.src, 'index.html'));
  const lines = page.split('\n');
  let out = '';
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    const m = MARKER.exec(line);
    if(!m){
      out += last ? line : line + '\n';
      return;
    }
    const target = path.join(app.src, ...m[2].split('/'));
    out += m[1] === 'css' ? readPiece(target) : readFolder(target);
  });
  return out;
}

function firstDifference(a, b){
  const al = a.split('\n'), bl = b.split('\n');
  for(let i = 0; i < Math.max(al.length, bl.length); i++){
    if(al[i] !== bl[i]) return i + 1;
  }
  return -1;
}

const check = process.argv.includes('--check');
let stale = 0;
for(const app of APPS){
  const built = buildApp(app);
  const rel = path.relative(ROOT, app.out);
  if(check){
    const current = fs.existsSync(app.out) ? fs.readFileSync(app.out, 'utf8') : '';
    if(current === built){
      console.log('up to date  ' + rel);
    } else {
      stale++;
      console.error('OUT OF DATE ' + rel + ' (first difference at line ' + firstDifference(current, built) + ') — run: npm run build');
    }
  } else {
    fs.writeFileSync(app.out, built, 'utf8');
    console.log('built ' + rel);
  }
}
if(stale) process.exit(1);
