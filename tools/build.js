#!/usr/bin/env node
// Builds the two single-file apps in apps/ from their sources in src/, and the installable
// web app (PWA) in site/.
//
//   node tools/build.js              write apps/fmIDE.html, apps/ExcelExporter.html and site/
//   node tools/build.js --check      build in memory; exit 1 if apps/ differs from src/
//   node tools/build.js --site DIR   write only the site, into DIR
//
// site/ is not committed (it is rebuilt wherever it is needed): index.html (fmIDE, with the
// lines of its <!-- build:site-head --> marker, which is empty in apps/), ExcelExporter.html,
// the files of src/site/ (manifest, icons), the licence files (LICENSE.txt, NOTICE.txt,
// ExcelExporter-LICENSE.txt), plus sw.js with its version and file list
// filled in. The version is a hash of the site's files, so any change gives a new version.
//
// Each app has a page, src/<app>/index.html, in which a line consisting only of a marker
// is replaced by content:
//   <!-- build:css styles.css -->   the contents of that file
//   <!-- build:js js -->            every .js file in that folder, in file-name order
// Inside a .js piece, a line consisting only of an include marker pulls in shared code
// that both apps use (src/shared/, path relative to src/):
//   <indent>// build:include shared/escaping.js
// The file replaces that line, with <indent> added in front of each non-empty line, so
// the same shared file sits at the right depth in either app's wrapped function.
// Shared files are plain fragments too, and may not include other files.
// Everything else is copied exactly as it is — nothing is trimmed, added or reformatted —
// so the pieces must each end with a newline. Needs only Node: no packages.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPS = [
  { src: path.join(ROOT, 'src', 'fmide'), out: path.join(ROOT, 'apps', 'fmIDE.html') },
  { src: path.join(ROOT, 'src', 'excel-exporter'), out: path.join(ROOT, 'apps', 'ExcelExporter.html') },
];
const SITE_SRC = path.join(ROOT, 'src', 'site');
const MARKER = /^<!-- build:(css|js) ([A-Za-z0-9._\/-]+) -->\r?$/; // \r: CRLF checkouts on Windows
const SITE_HEAD_MARKER = /^<!-- build:site-head -->\r?$/;
// What the site's fmIDE page gets in its <head> (the manifest makes it installable).
const SITE_HEAD = [
  '<meta name="theme-color" content="#1e3a8a">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="icons/icon-192.png">',
].join('\n') + '\n';
const INCLUDE = /^([ \t]*)\/\/ build:include ([A-Za-z0-9._\/-]+)\r?$/;

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
  return names.map(n => expandIncludes(readPiece(path.join(dir, n)))).join('');
}

// Replaces each include-marker line of a script piece with the (indented) shared file.
function expandIncludes(text){
  return text.split('\n').map(line => {
    const m = INCLUDE.exec(line);
    if(!m) return line;
    const [, indent, rel] = m;
    if(rel.split('/').includes('..')) fail('include path may not contain "..": ' + rel);
    const file = path.join(ROOT, 'src', ...rel.split('/'));
    const body = readPiece(file);
    if(body.split('\n').some(l => INCLUDE.test(l))) fail(rel + ' is included, so it may not include other files');
    // The marker line's own newline stays (join below); drop the file's final one.
    return body.slice(0, -1).split('\n').map(l => (l === '' || l === '\r') ? l : indent + l).join('\n');
  }).join('\n');
}

// forSite: the site's version of the page (the site-head marker filled in).
function buildApp(app, forSite){
  const page = readPiece(path.join(app.src, 'index.html'));
  const lines = page.split('\n');
  let out = '';
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    if(SITE_HEAD_MARKER.test(line)){ if(forSite) out += SITE_HEAD; return; }
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

function listFiles(dir, base){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const rel = base ? base + '/' + e.name : e.name;
    return e.isDirectory() ? listFiles(path.join(dir, e.name), rel) : [rel];
  }).sort();
}

// Writes the whole site into outDir (created; files already there are replaced).
function buildSite(outDir){
  const files = new Map(); // site path → Buffer
  files.set('index.html', Buffer.from(buildApp(APPS[0], true), 'utf8'));
  files.set('ExcelExporter.html', Buffer.from(buildApp(APPS[1], true), 'utf8'));
  listFiles(SITE_SRC).filter(f => f !== 'sw.js').forEach(f => files.set(f, fs.readFileSync(path.join(SITE_SRC, ...f.split('/')))));
  // The licences travel with the published app (see LICENSING.md).
  [['LICENSE.txt', 'LICENSE'], ['NOTICE.txt', 'NOTICE'], ['ExcelExporter-LICENSE.txt', 'src/excel-exporter/LICENSE']]
    .forEach(([name, from]) => files.set(name, fs.readFileSync(path.join(ROOT, ...from.split('/')))));
  const names = [...files.keys()].sort();
  const hash = require('crypto').createHash('sha256');
  names.forEach(n => { hash.update(n + '\0'); hash.update(files.get(n)); });
  const version = hash.digest('hex').slice(0, 12);
  const sw = readPiece(path.join(SITE_SRC, 'sw.js'))
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__FILES__', JSON.stringify(['./'].concat(names)));
  files.set('sw.js', Buffer.from(sw, 'utf8'));
  for(const [name, data] of files){
    const target = path.join(outDir, ...name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return { version, files: [...files.keys()].sort() };
}

module.exports = { buildSite };
if(require.main === module) main();

function main(){
  const siteArg = process.argv.indexOf('--site');
  if(siteArg >= 0){
    const dir = process.argv[siteArg + 1];
    if(!dir) fail('--site needs a folder');
    const { version } = buildSite(path.resolve(dir));
    console.log('built site ' + dir + ' (version ' + version + ')');
    return;
  }
  const check = process.argv.includes('--check');
  let stale = 0;
  for(const app of APPS){
    const built = buildApp(app, false);
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
  if(!check){
    const siteDir = path.join(ROOT, 'site');
    fs.rmSync(siteDir, { recursive: true, force: true });
    const { version } = buildSite(siteDir);
    console.log('built site/ (version ' + version + ')');
  }
}
