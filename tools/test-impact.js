#!/usr/bin/env node
// Which test files a change reaches, for running fewer tests on this machine before a commit
// (npm run test:changed). GitHub still runs the whole suite on every pull request.
//
//   node tools/test-impact.js                 the test files to run, one per line
//   node tools/test-impact.js --why           the changed files, then each test file with why
//   node tools/test-impact.js --run           npm run build:check, then Playwright on that list
//   --base REF                                compare with REF (default: where this branch left
//                                             origin/main, else main)
//   --files A B …                             these changed files instead of asking Git
//   --head REF                                with --files: read package.json at REF, not from
//                                             this folder (for measuring past changes)
//
// The changed files: every difference from the base, committed or not, and new files Git
// doesn't ignore. The map is worked out, not matched by file names:
//   - which source files go into which app comes from the build itself (appSources in
//     tools/build.js), and a module reaches every module that imports it;
//   - what each test file loads is read from it and the helpers it requires: the apps it
//     opens (fmIDE where it can be opened, the others wherever they are named), the tools
//     it runs (and the tools they require, and the files those read, TOOL_INPUTS below), the src/ files it loads, its fixture folders, the snapshots, the
//     built site (tests/helpers/site.js);
//   - a test file runs when something it loads is reached by a change.
// Conservative by design: FULL_SUITE below, a deleted source file and any file the map
// doesn't know run every test; package.json does too, unless the only change is to test:
// shortcuts that name test files (packageScriptsReach). Group 0 (smoke) always runs. Test group 74 checks the map:
// every file under src/ and tools/ is known, every test file loads something, and the tools
// read only what TOOL_INPUTS says. Node only, no packages.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const SMOKE = 'tests/0-smoke.spec.js';
const APP_PAGES = { fmIDE: 'apps/fmIDE.html', ExcelExporter: 'apps/ExcelExporter.html', fmGraph: 'apps/fmGraph.html' };
// The site the build writes (tests/helpers/site.js and tools/build.js build all of it).
const SITE = 'site';

// ---------- the written part of the map ----------

// A change to any of these runs every test. A path ending in / is a folder.
const FULL_SUITE = [
  ['src/shared/', 'shared code goes into every app'],
  ['tools/build.js', 'the build makes every app and the site'],
  ['tests/helpers/', 'the test helpers are used by every test'],
  ['tests/fixtures/formats/', 'a file format\'s samples'],
  ['src/fmide/js/04-file-formats.js', 'a file format or its upgrades'],
  ['src/excel-exporter/js/04-file-formats.js', 'a file format or its upgrades'],
  ['src/fmgraph/js/02-model.js', 'a file format or its upgrades (fmGraph reads the model files)'],
  ['src/fmgraph/js/04-board.js', 'a file format or its upgrades (the board file\'s version)'],
  ['src/fmgraph/js/06b-board-files.js', 'a file format or its upgrades (the board file\'s upgrades)'],
  ['playwright.config.js', 'the test runner\'s settings'],
  ['package.json', 'the scripts and test tooling (more than test: shortcuts changed)'],
  ['package-lock.json', 'the test tooling'],
  ['.github/', 'what GitHub runs'],
  ['.gitattributes', 'how Git checks files out'],
  ['.gitignore', 'what Git leaves out'],
  ['.gitmodules', 'the library submodule'],
  ['library', 'the community library (submodule)'],
];

// Files that go into the built site but into no app (the build and tests/helpers/site.js).
const SITE_FILES = ['src/site/', 'src/library/', 'src/help-pages/', 'LICENSE', 'NOTICE', 'src/excel-exporter/LICENSE', 'docs/LICENSE-CC-BY-4.0.txt'];

// What each tool reads besides the tools it requires (found from its require lines). A test
// that runs the tool loads these too. Group 74 runs the tools and checks every file they read
// is here.
const TOOL_INPUTS = {
  'tools/build-help.js': ['src/help/', 'src/excel-exporter/help/', 'src/fmide/js/01-setup-commands-keys.js',
    'src/fmide/js/16-ribbon-keytips.js', 'src/library/style.css', 'src/help-pages/help.css', 'docs/LICENSE-CC-BY-4.0.txt'],
  'tools/build-library.js': ['src/library/style.css', 'docs/LICENSE-CC-BY-4.0.txt'],
  'tools/video-scripts.js': ['src/help/fmide-tutorials.js'],
  'tools/record-tutorials.js': [APP_PAGES.fmIDE, APP_PAGES.ExcelExporter, APP_PAGES.fmGraph],
  'tools/bench-calc.js': [APP_PAGES.fmIDE, APP_PAGES.ExcelExporter, APP_PAGES.fmGraph],
  'tools/test-parts.js': ['tests/test-durations.json'],
  'tools/build.js': [SITE],
};

// Tools no test runs, each with why: a change to one runs only the smoke test.
const NOT_TESTED = {
  'tools/serve.js': 'shows the site on this machine (npm run serve); no test starts it',
};

// Test files whose loads the reading below can't see, by hand. None today: group 74 fails
// when a test file is found to load nothing, so one would be added here.
const EXTRA_LOADS = {};

// ---------- reading what the tests load ----------

// Where a test (or a helper it requires) can open fmIDE.
const OPENS_FMIDE = /openFmIDE|openApp\([^)]*'fmIDE'|fmIDE\.html|helpers\/fmide|require\('\.\/fmide(?:\.js)?'\)|backToFmide|Back to fmIDE|fmide-address/i;

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const read = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

function testFiles(){
  return fs.readdirSync(TESTS).filter(f => f.endsWith('.spec.js')).map(f => 'tests/' + f).sort(byGroup);
}

function byGroup(a, b){
  const n = (f) => parseInt(path.basename(f), 10);
  return (n(a) - n(b)) || (a < b ? -1 : a > b ? 1 : 0);
}

// The helpers a file requires (tests/helpers/*.js), and theirs.
function helpersOf(relFile, seen){
  seen = seen || new Set();
  const dir = path.posix.dirname(relFile);
  for(const m of read(relFile).matchAll(/require\('(\.{1,2}\/(?:helpers\/)?[a-z0-9-]+)(?:\.js)?'\)/g)){
    const h = path.posix.normalize(path.posix.join(dir, m[1])) + '.js';
    if(h.startsWith('tests/helpers/') && exists(h) && !seen.has(h)){
      seen.add(h);
      helpersOf(h, seen);
    }
  }
  return seen;
}

// Every tool a tool requires, and theirs.
function toolsRequiredBy(tool, seen){
  seen = seen || new Set();
  for(const m of read(tool).matchAll(/require\('\.\/([a-z0-9-]+)(?:\.js)?'\)/g)){
    const t = 'tools/' + m[1] + '.js';
    if(exists(t) && !seen.has(t)){
      seen.add(t);
      toolsRequiredBy(t, seen);
    }
  }
  return seen;
}

const srcPathsIn = (text) => [
  ...[...text.matchAll(/\bsrc\/[A-Za-z0-9_.\/-]*/g)].map(m => m[0]),
  ...[...text.matchAll(/'src'((?:\s*,\s*'[A-Za-z0-9_.-]+')+)/g)].map(m => 'src/' + m[1].split(',').map(s => s.trim().slice(1, -1)).filter(Boolean).join('/')),
].map(p => (/\.[a-z]+$/.test(p) || p.endsWith('/')) ? p : p + '/');

// Lines that aren't comments (for the docs a test reads; tests mention docs in comments).
const codeLines = (text) => text.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// What one test file loads: repository paths (a path ending in / is a folder) and SITE.
function loadsOf(spec){
  const files = [spec, ...helpersOf(spec)];
  const loads = new Set([spec]);
  const tools = new Set();
  for(const f of files){
    const text = read(f);
    // apps/apps.js names every app (it opens whichever it is asked for), so the apps a test
    // opens are read from the test and its other helpers. ExcelExporter and fmGraph: any
    // mention counts (conservative). fmIDE is named almost everywhere (file kinds such as
    // 'fmIDE-excel-style', test titles), so it counts only where a test can open it: its
    // opener and helper, its page, openApp with its name, the other apps' Back to fmIDE and
    // the address they use for it (the owner's decision, 12 October 2026). The site opens all.
    if(f !== 'tests/helpers/apps.js'){
      if(OPENS_FMIDE.test(text)) loads.add(APP_PAGES.fmIDE);
      if(/ExcelExporter|openExporter|openExcel|\bexporter\b/i.test(text)) loads.add(APP_PAGES.ExcelExporter);
      if(/fmgraph/i.test(text)) loads.add(APP_PAGES.fmGraph);
    }
    if(/helpers\/site|require\('\.\/site'\)/.test(text)) loads.add(SITE);
    for(const m of text.matchAll(/\btools\/([a-z0-9-]+)(?:\.js)?\b/g)) tools.add('tools/' + m[1] + '.js');
    for(const m of text.matchAll(/'tools',\s*'([a-z0-9-]+)\.js'/g)) tools.add('tools/' + m[1] + '.js');
    srcPathsIn(text).forEach(p => loads.add(p));
    for(const m of text.matchAll(/(?:fixture|readFixture|fixturePath)\(\s*'([a-z0-9-]+)'/g)) loads.add('tests/fixtures/' + m[1] + '/');
    for(const m of text.matchAll(/(?:'fixtures'|FIXTURES),\s*'([a-z0-9-]+)'/g)) loads.add('tests/fixtures/' + m[1] + '/');
    for(const m of text.matchAll(/\bfixtures\/([a-z0-9-]+)/g)) loads.add('tests/fixtures/' + m[1] + '/');
    if(/toMatchSnapshot|helpers\/snapshot|\bsnapshots\b/.test(text)) loads.add('tests/snapshots/');
    const code = codeLines(text);
    for(const m of code.matchAll(/\bdocs\/[A-Za-z0-9_.\/-]+/g)) loads.add(m[0]);
    for(const m of code.matchAll(/'docs',\s*'([A-Za-z0-9_.-]+)'/g)) loads.add('docs/' + m[1]);
  }
  (EXTRA_LOADS[spec] || []).forEach(p => loads.add(p));
  if(loads.has(SITE)) ['tools/build.js', 'tools/pages-server.js'].forEach(t => tools.add(t));
  for(const t of tools) if(exists(t)) toolLoads(t).forEach(p => loads.add(p));
  // A module loaded on its own brings the modules it imports.
  for(const p of [...loads]) if(p.startsWith('src/') && !p.endsWith('/')) moduleImports(p).forEach(m => loads.add(m));
  return loads;
}

// What running one tool loads: the tool, the tools it requires, and what they read.
function toolLoads(tool){
  const loads = new Set();
  for(const t of [tool, ...toolsRequiredBy(tool)]){
    loads.add(t);
    (TOOL_INPUTS[t] || []).forEach(p => loads.add(p));
    srcPathsIn(read(t)).filter(p => p !== 'src/').forEach(p => loads.add(p));
  }
  return loads;
}

// ---------- what a change reaches ----------

// package.json's scripts that run every test whenever they change (the owner's decision,
// 12 October 2026: test:update-snapshots rewrites the snapshots).
const SCRIPTS_THAT_RUN_EVERYTHING = ['test', 'test:changed', 'test:update-snapshots'];

// When package.json changed only in test: shortcuts — added, changed or removed, none of
// SCRIPTS_THAT_RUN_EVERYTHING, each new or changed one "playwright test" and test files or
// their beginnings (as Playwright reads them) — the test files they name; otherwise null
// (every test runs). Nothing reads package.json's scripts but npm: a shortcut is only a
// way to run test files.
function packageScriptsReach(baseText, headText){
  let a, b;
  try{ a = JSON.parse(baseText); b = JSON.parse(headText); } catch(e){ return null; }
  const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  if(!isObject(a) || !isObject(b)) return null;
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) if(k !== 'scripts' && !same(a[k], b[k])) return null;
  const sa = a.scripts === undefined ? {} : a.scripts, sb = b.scripts === undefined ? {} : b.scripts;
  if(!isObject(sa) || !isObject(sb)) return null;
  const tests = new Set();
  for(const name of new Set([...Object.keys(sa), ...Object.keys(sb)])){
    if(sa[name] === sb[name]) continue;
    if(!name.startsWith('test:') || SCRIPTS_THAT_RUN_EVERYTHING.includes(name)) return null;
    if(!(name in sb)) continue; // a shortcut taken out runs nothing
    const m = typeof sb[name] === 'string' && /^playwright test((?: tests\/[A-Za-z0-9._-]+)+)$/.exec(sb[name]);
    if(!m) return null;
    for(const p of m[1].trim().split(' ')){
      const files = testFiles().filter(t => t.startsWith(p));
      if(!files.length) return null;
      files.forEach(f => tests.add(f));
    }
  }
  return [...tests].sort(byGroup);
}

// package.json at the base and now: opts.packageTexts ({ base, head }), else from Git (the
// head from opts.head, else this folder). Null when either can't be read.
function packageTexts(opts){
  if(opts.packageTexts) return opts.packageTexts;
  const base = opts.base || defaultBase();
  if(!base) return null;
  const baseText = git(['show', base + ':package.json']);
  const headText = opts.head ? git(['show', opts.head + ':package.json'])
    : (exists('package.json') ? read('package.json') : null);
  return baseText === null || headText === null ? null : { base: baseText, head: headText };
}

// The modules a module imports, and theirs (repository paths).
function moduleImports(file, seen){
  seen = seen || new Set();
  if(!file.endsWith('.js') || !exists(file)) return seen;
  for(const m of read(file).matchAll(/^import \{[^}]*\} from '([^']+)';/gm)){
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
    if(!seen.has(target)){
      seen.add(target);
      moduleImports(target, seen);
    }
  }
  return seen;
}

let cache = null;
function map(){
  if(cache) return cache;
  const { appSources } = require('./build.js');
  const apps = appSources();
  const appsOf = new Map(); // source file → [app page]
  for(const a of apps) for(const f of a.files) appsOf.set(f, [...(appsOf.get(f) || []), a.out]);
  const importedBy = new Map(); // module → modules importing it (directly or not)
  for(const f of appsOf.keys()) for(const m of moduleImports(f)) importedBy.set(m, [...(importedBy.get(m) || []), f]);
  const tests = new Map(testFiles().map(t => [t, loadsOf(t)]));
  cache = { apps, appsOf, importedBy, tests };
  return cache;
}

const under = (file, prefix) => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix;
const isDoc = (f) => f.startsWith('.claude/') || (/\.md$/.test(f) && !f.startsWith('tests/fixtures/') && !f.startsWith('src/'));

// What one changed file reaches: { full: reason } or { reach: [paths and SITE], how }.
function reachOf(file, opts){
  const m = map();
  if(file === 'package.json'){
    const texts = packageTexts(opts || {});
    const tests = texts && packageScriptsReach(texts.base, texts.head);
    if(tests) return { reach: tests, how: 'package.json: only test: shortcuts' + (tests.length ? '' : ' (none naming a test file)') };
  }
  const full = FULL_SUITE.find(([p]) => under(file, p));
  if(full) return { full: full[1] };
  if(/^tests\/[^/]+\.spec\.js$/.test(file)) return { reach: [file, 'tools/test-parts.js'], how: 'a test file' };
  if(file === 'tests/test-durations.json') return { reach: [file], how: 'the measured test times' };
  if(file.startsWith('tests/snapshots/')) return { reach: [file], how: 'a snapshot' };
  if(file.startsWith('tests/fixtures/')){
    const folder = file.split('/').slice(0, 3).join('/') + '/';
    if(![...m.tests.values()].some(l => l.has(folder))) return { full: 'a fixture folder no test is known to load' };
    return { reach: [folder], how: 'a fixture' };
  }
  if(isDoc(file)) return { reach: [file], how: 'documentation (smoke only, unless a test reads it)' };
  if(Object.values(APP_PAGES).includes(file)) return { reach: [file, SITE], how: 'a generated app' };
  if(SITE_FILES.some(p => under(file, p))) return { reach: [file, SITE], how: 'the built site' };
  if(file.startsWith('src/')){
    if(!exists(file)) return { full: 'a source file was deleted or moved' };
    const pages = m.appsOf.get(file);
    if(pages) return { reach: [file, ...pages, SITE, ...(m.importedBy.get(file) || [])], how: 'part of ' + pages.map(p => path.basename(p, '.html')).join(', ') };
    if(path.posix.basename(file) === 'package.json'){
      // A module folder's package.json: everything in that folder.
      const dir = path.posix.dirname(file) + '/';
      const inside = [...m.appsOf.keys()].filter(f => f.startsWith(dir));
      if(inside.length) return { reach: [dir, ...new Set(inside.flatMap(f => [...m.appsOf.get(f), ...(m.importedBy.get(f) || [])])), SITE], how: 'a module folder\'s settings' };
    }
    return { full: 'a source file the map doesn\'t know' };
  }
  if(/^tools\/[^/]+\.js$/.test(file)){
    if(!exists(file)) return { full: 'a tool was deleted or moved' };
    if(NOT_TESTED[file]) return { reach: [file], how: 'a tool no test runs (' + NOT_TESTED[file] + ')' };
    if(![...m.tests.values()].some(l => l.has(file))) return { full: 'a tool the map doesn\'t know' };
    return { reach: [file], how: 'a tool' };
  }
  return { full: 'a file the map doesn\'t know' };
}

const touches = (load, r) => load === r || (load.endsWith('/') && r.startsWith(load)) || (r.endsWith('/') && load.startsWith(r));

// The tests a set of changed files reaches: { full, reasons: [[file, why]], tests: [file],
// why: Map(test → [changed files]) }.
function impactOf(changed, opts){
  const m = map();
  const reasons = [];
  const why = new Map();
  const add = (t, f) => why.set(t, [...(why.get(t) || []), f]);
  add(SMOKE, '(always)');
  let full = false;
  for(const file of [...new Set(changed)].sort()){
    const r = reachOf(file, opts);
    if(r.full){
      full = true;
      reasons.push([file, 'whole suite: ' + r.full]);
      continue;
    }
    reasons.push([file, r.how]);
    for(const [t, loads] of m.tests){
      if([...loads].some(l => r.reach.some(x => touches(l, x)))) add(t, file);
    }
  }
  const tests = full ? [...m.tests.keys()] : [...why.keys()].sort(byGroup);
  return { full, reasons, tests, why };
}

// ---------- the changed files ----------

function git(args){
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Where this branch left origin/main (else main), or null.
function defaultBase(){
  for(const ref of ['origin/main', 'main']){
    const base = git(['merge-base', 'HEAD', ref]);
    if(base) return base;
  }
  return null;
}

function changedFiles(base){
  base = base || defaultBase();
  if(!base) return null;
  const diff = git(['diff', '--name-only', '--no-renames', base]);
  const added = git(['ls-files', '--others', '--exclude-standard']);
  if(diff === null || added === null) return null;
  return [...diff.split('\n'), ...added.split('\n')].filter(Boolean);
}

function main(argv){
  const valueOf = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
  let files;
  const fi = argv.indexOf('--files');
  if(fi >= 0){
    const rest = argv.slice(fi + 1);
    const end = rest.findIndex(a => a.startsWith('--'));
    files = end < 0 ? rest : rest.slice(0, end);
  }
  else files = changedFiles(valueOf('--base'));
  let result;
  if(files === null){
    console.error('test-impact: could not compare with main (no origin/main or main to compare with): running every test.');
    result = { full: true, reasons: [], tests: testFiles(), why: new Map() };
  } else {
    result = impactOf(files, { base: valueOf('--base'), head: valueOf('--head') });
  }
  if(argv.includes('--why') || argv.includes('--run')){
    const out = argv.includes('--run') ? console.error : console.log;
    out('Changed (' + (files || []).length + '):');
    result.reasons.forEach(([f, how]) => out('  ' + f + ' — ' + how));
    if(result.full) out('Whole suite: ' + result.tests.length + ' test files.');
    else {
      out('Test files (' + result.tests.length + ' of ' + testFiles().length + '):');
      result.tests.forEach(t => out('  ' + t + '  ← ' + result.why.get(t).join(', ')));
    }
  }
  if(argv.includes('--run')){
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const check = spawnSync(npm, ['run', 'build:check'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if(check.status !== 0) process.exit(check.status || 1);
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const run = spawnSync(npx, ['playwright', 'test', ...(result.full ? [] : result.tests)], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    process.exit(run.status === null ? 1 : run.status);
  }
  if(!argv.includes('--why')) result.tests.forEach(t => console.log(t));
}

module.exports = { impactOf, reachOf, packageScriptsReach, SCRIPTS_THAT_RUN_EVERYTHING, loadsOf, toolLoads, touches, testFiles, map, FULL_SUITE, SITE_FILES, TOOL_INPUTS, NOT_TESTED, EXTRA_LOADS, SITE, SMOKE, APP_PAGES };
if(require.main === module) main(process.argv.slice(2));
