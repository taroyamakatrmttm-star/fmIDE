#!/usr/bin/env node
// Builds the three single-file apps in apps/ (fmIDE, ExcelExporter, fmGraph) from their sources
// in src/, and the installable web app (PWA) in site/.
//
//   node tools/build.js              write apps/fmIDE.html, apps/ExcelExporter.html, apps/fmGraph.html and site/
//   node tools/build.js --check      build in memory; exit 1 if apps/ differs from src/
//   node tools/build.js --site DIR   write only the site, into DIR
// Options for the site: --library DIR (the community library's folder; default library/, the
// git submodule) and --require-library (stop when there is none; the deploy uses it).
//
// site/ is not committed (it is rebuilt wherever it is needed): index.html (fmIDE, with the
// lines of its <!-- build:site-head --> marker, which is empty in apps/), ExcelExporter.html,
// fmGraph.html (step 15),
// the files of src/site/ (manifest, icons), the licence files (LICENSE.txt, NOTICE.txt,
// ExcelExporter-LICENSE.txt), plus sw.js with its version and file list
// filled in. The version is a hash of the site's files, so any change gives a new version.
//
// When the community library's folder is there (library/, a git submodule pinned to one
// commit; empty until it is fetched), the site also gets its catalogue, /library
// (tools/build-library.js): checked again first, and nothing is built if it fails. The
// catalogue is added after the version is worked out and is not in the offline copy, so a
// new pack never makes the app say that a new version is ready. The build never fetches
// anything: without the folder, the site simply has no catalogue.
//
// Every site also gets its help pages, /help (tools/build-help.js; step 10, phase H4a): the
// apps' help topics and tutorials as plain pages with no JavaScript. Like the catalogue, they
// are added after the version is worked out and are not in the offline copy (the apps carry
// their own help); a topic naming a command or topic that doesn't exist stops the build.
//
// Each app has a page, src/<app>/index.html, in which a line consisting only of a marker
// is replaced by content:
//   <!-- build:css styles.css -->   the contents of that file
//   <!-- build:js js -->            every .js file in that folder, in file-name order
//   <!-- build:fmide-address -->    a <meta name="fmide-address"> giving fmIDE's address
//                                   next to the page: fmIDE.html in apps/, the site's
//                                   front page (./) in site/ ("Back to fmIDE" in ExcelExporter
//                                   and fmGraph)
// Inside a .js piece, a line consisting only of an include marker pulls in another file,
// path relative to src/: shared code that both apps use (src/shared/), or an app's help text
// (src/help/, src/excel-exporter/help/):
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
  { src: path.join(ROOT, 'src', 'fmgraph'), out: path.join(ROOT, 'apps', 'fmGraph.html') },
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
const FMIDE_ADDRESS_MARKER = /^<!-- build:fmide-address -->\r?$/;
const fmideAddressMeta = (forSite) => '<meta name="fmide-address" content="' + (forSite ? './' : 'fmIDE.html') + '">\n';
const LIBRARY = require('./build-library.js');
const HELP = require('./build-help.js');
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

// forSite: the site's version of the page (the site-head marker filled in, fmIDE's address
// the site's front page).
function buildApp(app, forSite){
  const page = readPiece(path.join(app.src, 'index.html'));
  const lines = page.split('\n');
  let out = '';
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    if(SITE_HEAD_MARKER.test(line)){ if(forSite) out += SITE_HEAD; return; }
    if(FMIDE_ADDRESS_MARKER.test(line)){ out += fmideAddressMeta(forSite); return; }
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
// opts.library: the community library's folder (default library/; null for none);
// opts.requireLibrary: throw when there is no library. Throws a LibraryError, writing
// nothing, when the library fails its check, and a HelpError when the help text names a
// command or topic that doesn't exist.
function buildSite(outDir, opts){
  opts = opts || {};
  const libraryDir = LIBRARY.findLibrary(opts.library === undefined ? path.join(ROOT, 'library') : opts.library);
  if(!libraryDir && opts.requireLibrary) throw new LIBRARY.LibraryError('There is no community library (the library/ folder is missing or empty: fetch it with git submodule update --init library).');
  // Checked before anything is written.
  const catalogue = libraryDir ? LIBRARY.buildLibrary(libraryDir) : null;
  const help = HELP.buildHelp();
  const files = new Map(); // site path → Buffer
  files.set('index.html', Buffer.from(buildApp(APPS[0], true), 'utf8'));
  files.set('ExcelExporter.html', Buffer.from(buildApp(APPS[1], true), 'utf8'));
  files.set('fmGraph.html', Buffer.from(buildApp(APPS[2], true), 'utf8'));
  listFiles(SITE_SRC).filter(f => f !== 'sw.js').forEach(f => files.set(f, fs.readFileSync(path.join(SITE_SRC, ...f.split('/')))));
  // The licences travel with the published app (see LICENSING.md).
  [['LICENSE.txt', 'LICENSE'], ['NOTICE.txt', 'NOTICE'], ['ExcelExporter-LICENSE.txt', 'src/excel-exporter/LICENSE']]
    .forEach(([name, from]) => files.set(name, fs.readFileSync(path.join(ROOT, ...from.split('/')))));
  files.set('_headers', Buffer.from(siteHeaders(files), 'utf8'));
  // _headers is settings for the host, not a file it serves: not part of the offline copy
  // (it still counts towards the version, so changed settings make a new version).
  const names = [...files.keys()].sort();
  const hash = require('crypto').createHash('sha256');
  names.forEach(n => { hash.update(n + '\0'); hash.update(files.get(n)); });
  const version = hash.digest('hex').slice(0, 12);
  const sw = readPiece(path.join(SITE_SRC, 'sw.js'))
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__FILES__', JSON.stringify(['./'].concat(names.filter(n => n !== '_headers'))));
  files.set('sw.js', Buffer.from(sw, 'utf8'));
  // The catalogue and the help pages: after the version and the offline copy's list, so they
  // are part of neither.
  if(catalogue) catalogue.files.forEach((data, name) => files.set(name, data));
  help.files.forEach((data, name) => files.set(name, data));
  for(const [name, data] of files){
    const target = path.join(outDir, ...name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return { version, files: [...files.keys()].sort(), library: catalogue ? { packs: catalogue.packs } : null };
}

// The site's HTTP headers, in Cloudflare Pages' _headers format (tools/pages-server.js
// applies them locally). The security policy lets each page run only its own inline
// scripts — identified by their SHA-256 hashes, computed here — and connect only to the
// site itself; nothing from another site can be loaded, sent to or embedded.
function siteHeaders(files){
  const crypto = require('crypto');
  const policy = (page) => {
    const scripts = [...files.get(page).toString('utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map(m => "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
    return [
      "default-src 'self'", "script-src 'self' " + scripts.join(' '), "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "worker-src 'self'",
      "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"
    ].join('; ');
  };
  const block = (paths, headers) => paths.map(p => p + '\n' + headers.map(h => '  ' + h).join('\n')).join('\n');
  return [
    '# Generated by tools/build.js — edit the build, not this file.',
    block(['/*'], ['X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer',
      'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()']),
    block(['/', '/index.html'], ['Content-Security-Policy: ' + policy('index.html')]),
    block(['/ExcelExporter', '/ExcelExporter.html'], ['Content-Security-Policy: ' + policy('ExcelExporter.html')]),
    block(['/fmGraph', '/fmGraph.html'], ['Content-Security-Policy: ' + policy('fmGraph.html')]),
    block(['/sw.js'], ["Content-Security-Policy: default-src 'self'", 'Cache-Control: no-cache']),
    // The catalogue's own rules, always there (so the version is the same with or without it).
    ...LIBRARY.LIBRARY_HEADERS.map(b => block(b.paths, b.headers)),
    // The help pages' own rules.
    ...HELP.HELP_HEADERS.map(b => block(b.paths, b.headers)),
    ''
  ].join('\n');
}

module.exports = { buildSite, siteHeaders, LibraryError: LIBRARY.LibraryError, HelpError: HELP.HelpError };
if(require.main === module) main();

// Builds the site, reporting a library that fails (or is missing when required) and exiting.
function siteOrFail(dir, opts){
  try{ return buildSite(dir, opts); }
  catch(e){
    if(e instanceof LIBRARY.LibraryError || e instanceof HELP.HelpError) fail(e.message);
    throw e;
  }
}
function libraryNote(r){
  return r.library ? '; the library: ' + r.library.packs + ' pack' + (r.library.packs === 1 ? '' : 's')
    : '; no library/ folder, so no catalogue';
}

function main(){
  const argv = process.argv.slice(2);
  const valueOf = (name) => { const i = argv.indexOf(name); if(i < 0) return undefined; if(!argv[i + 1] || argv[i + 1].startsWith('--')) fail(name + ' needs a folder'); return argv[i + 1]; };
  const libraryArg = valueOf('--library');
  const siteOpts = { requireLibrary: argv.includes('--require-library') };
  if(libraryArg !== undefined) siteOpts.library = path.resolve(libraryArg);
  const siteArg = valueOf('--site');
  if(siteArg !== undefined){
    const r = siteOrFail(path.resolve(siteArg), siteOpts);
    console.log('built site ' + siteArg + ' (version ' + r.version + libraryNote(r) + ')');
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
    // Checked first: a library that fails leaves the old site/ as it was.
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fmide-site-'));
    const r = siteOrFail(tmp, siteOpts);
    fs.rmSync(siteDir, { recursive: true, force: true });
    fs.cpSync(tmp, siteDir, { recursive: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('built site/ (version ' + r.version + libraryNote(r) + ')');
  }
}
