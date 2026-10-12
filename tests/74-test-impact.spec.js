// 74. The map of which tests a change reaches (tools/test-impact.js, npm run test:changed):
// every file under src/ and tools/ is known to it, every test file is found to load something,
// the tools read only what the map says they read, and it is conservative — shared code, the
// build, the helpers, a file format, the settings or any file it doesn't know run every test,
// group 0 always runs — while an fmGraph-only change runs fmGraph's groups. Node only.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect, ROOT } = require('./helpers/apps');
const I = require('../tools/test-impact.js');
const { appSources } = require('../tools/build.js');

const TOOL = path.join(ROOT, 'tools', 'test-impact.js');
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: ROOT, encoding: 'utf8' });
const tracked = (dir) => spawnSync('git', ['ls-files', dir], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
const ALL = I.testFiles();
const pick = (...files) => I.impactOf(files);
// This file names the files its cases change, so the map rightly counts it as loading them;
// the cases that expect only smoke leave it out.
const SELF = 'tests/74-test-impact.spec.js';
const others = (tests) => tests.filter(t => t !== SELF);

test('every file under src/ and tools/ is known to the map, and reaches a test unless it is a tool no test runs', () => {
  const files = [...tracked('src'), ...tracked('tools')];
  expect(files.length).toBeGreaterThan(130);
  for(const f of files){
    const r = I.reachOf(f);
    expect(r.full || '', f).not.toMatch(/doesn't know/);
    if(r.full) continue;
    // Group 74 counts only for the tool it tests (it names other files in its cases).
    const tests = (f === 'tools/test-impact.js' ? pick(f).tests : others(pick(f).tests)).filter(t => t !== I.SMOKE);
    if(I.NOT_TESTED[f]) expect(tests, f).toEqual([]);
    else expect(tests.length, f + ' reaches no test').toBeGreaterThan(0);
  }
  // Every new folder is caught too: a file the map has never seen runs every test.
  for(const f of ['src/new-app/js/01-start.js', 'src/fmide/new-folder/thing.js', 'tools/new-tool.js', 'new-folder/file.txt', 'tests/new-folder/x.json']){
    expect(pick(f).full, f).toBe(true);
  }
});

test('every test file is found to load something, and every fixture folder is loaded by a test', () => {
  for(const t of ALL){
    const loads = [...I.loadsOf(t)].filter(l => l !== t);
    expect(loads.filter(l => l === I.SITE || /^(apps|src|tools)\//.test(l)).length, t + ' loads nothing the map can see (add it to EXTRA_LOADS)').toBeGreaterThan(0);
  }
  const folders = fs.readdirSync(path.join(ROOT, 'tests', 'fixtures'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => 'tests/fixtures/' + e.name + '/');
  for(const f of folders) expect(ALL.some(t => I.loadsOf(t).has(f)), f).toBe(true);
});

test('the build\'s own list of each app\'s files: its page, styles, every script piece, includes and modules', () => {
  const apps = appSources();
  expect(apps.map(a => a.app)).toEqual(['fmIDE', 'ExcelExporter', 'fmGraph']);
  const dirs = { fmIDE: 'src/fmide', ExcelExporter: 'src/excel-exporter', fmGraph: 'src/fmgraph' };
  for(const a of apps){
    const d = dirs[a.app];
    expect(a.files).toContain(d + '/index.html');
    expect(a.files).toContain(d + '/styles.css');
    for(const f of fs.readdirSync(path.join(ROOT, d, 'js'))) expect(a.files).toContain(d + '/js/' + f);
    expect(a.files).toContain('src/shared/escaping.js');
    for(const f of a.files) expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true);
  }
  expect(apps[1].files).toContain('src/excel-exporter/formulas/core-translation.js');
  expect(apps[1].files).toContain('src/excel-exporter/js-head/01-xlsx-writer.js');
  expect(apps[0].files).toContain('src/fmide/modules/expression.js');
  expect(apps[2].files).not.toContain('src/excel-exporter/formulas/core-translation.js');
});

test('the tools read only what the map says they read', () => {
  const reads = new Set();
  const real = fs.readFileSync;
  fs.readFileSync = function(file, ...rest){
    if(typeof file === 'string' || file instanceof URL) reads.add(path.relative(ROOT, String(file)).split(path.sep).join('/'));
    return real.call(this, file, ...rest);
  };
  const ran = {};
  const record = (tool, fn) => { reads.clear(); fn(); ran[tool] = [...reads]; };
  try{
    record('tools/build-help.js', () => require('../tools/build-help.js').buildHelp());
    record('tools/build-library.js', () => require('../tools/build-library.js').buildLibrary(path.join(ROOT, 'tests', 'fixtures', 'library', 'sample-library')));
    record('tools/video-scripts.js', () => require('../tools/video-scripts.js').loadTutorials());
    record('tools/test-parts.js', () => require('../tools/test-parts.js').readDurations());
  } finally {
    fs.readFileSync = real;
  }
  for(const [tool, files] of Object.entries(ran)){
    const loads = [...I.toolLoads(tool)];
    const own = files.filter(f => !f.startsWith('..') && !f.startsWith('node_modules/') && !f.startsWith('tests/fixtures/library/'));
    expect(own.length, tool).toBeGreaterThan(0);
    for(const f of own){
      const known = loads.some(l => I.touches(l, f)) || I.FULL_SUITE.some(([p]) => p.endsWith('/') ? f.startsWith(p) : f === p);
      expect(known, tool + ' reads ' + f + ', which TOOL_INPUTS doesn\'t name').toBe(true);
    }
  }
});

test('shared code, the build, the helpers, a file format, the settings and a deleted source file run every test', () => {
  for(const f of ['src/shared/ir.js', 'src/shared/package.json', 'tools/build.js', 'tests/helpers/apps.js', 'tests/helpers/fmide.js',
    'tests/fixtures/formats/sys-current.json', 'src/fmide/js/04-file-formats.js', 'src/excel-exporter/js/04-file-formats.js', 'src/fmgraph/js/06b-board-files.js',
    'playwright.config.js', 'package.json', 'package-lock.json', '.github/workflows/tests.yml', 'library', 'src/fmide/js/99-gone.js']){
    const r = pick(f);
    expect(r.full, f).toBe(true);
    expect(r.tests, f).toEqual(ALL);
  }
  // One such file among small ones is enough.
  expect(pick('docs/step13-zoom.md', 'src/shared/uom.js').full).toBe(true);
});

test('an fmGraph-only change runs fmGraph\'s groups, not the Excel or calculation ones', () => {
  const r = pick('src/fmgraph/js/05-render.js');
  expect(r.full).toBe(false);
  expect(r.tests[0]).toBe(I.SMOKE);
  const fmGraphGroups = ALL.filter(t => /fmgraph|-boards/.test(t));
  expect(fmGraphGroups.length).toBeGreaterThan(12);
  for(const t of fmGraphGroups) expect(r.tests, t).toContain(t);
  for(const t of ['1-excel-structure', '2-excel-values', '3-excel-layout', '17-agreement', '18-ir', '19-excel-ir', '27-touch', '44-zoom', '67-excel-sensitivity']){
    expect(r.tests, t).not.toContain('tests/' + t + '.spec.js');
  }
  expect(r.tests.length).toBeLessThan(ALL.length / 2);
});

test('smaller changes: documentation, a tool, a test file, a fixture, an ExcelExporter module', () => {
  // Documentation no test reads: smoke only.
  for(const f of ['docs/step13-zoom.md', 'README.md', 'CHANGELOG.md', 'CLAUDE.md', 'tests/SPEC.md', '.claude/rules/fmgraph.md']){
    expect(others(pick(f).tests), f).toEqual([I.SMOKE]);
  }
  // The licence the help pages and catalogue carry goes into the site.
  expect(pick('docs/LICENSE-CC-BY-4.0.txt').tests).toEqual(expect.arrayContaining(['tests/25-library-catalogue.spec.js', 'tests/34-help-site.spec.js']));
  expect(others(pick('tools/serve.js').tests)).toEqual([I.SMOKE]);
  expect(others(pick('tools/test-parts.js').tests)).toEqual([I.SMOKE, 'tests/66-test-parts.spec.js']);
  expect(pick('tools/test-impact.js').tests).toEqual([I.SMOKE, SELF]);
  expect(pick('tools/check-library.js').tests).toEqual(expect.arrayContaining(['tests/24-library-checker.spec.js', 'tests/25-library-catalogue.spec.js']));
  // A test file runs itself, and the parts check (a new file must land in a part).
  expect(others(pick('tests/44-zoom.spec.js').tests)).toEqual([I.SMOKE, 'tests/44-zoom.spec.js', 'tests/66-test-parts.spec.js']);
  // A fixture runs the tests that load its folder.
  const agreement = pick('tests/fixtures/agreement/empty-operators.json').tests;
  expect(agreement).toContain('tests/17-agreement.spec.js');
  expect(agreement).not.toContain('tests/44-zoom.spec.js');
  // ExcelExporter's formula module reaches the tests that load it in Node, and ExcelExporter's.
  const formulas = pick('src/excel-exporter/formulas/operator-spellings.js').tests;
  for(const t of ['19-excel-ir', '65-modules-in-node', '1-excel-structure', '17-agreement']) expect(formulas).toContain('tests/' + t + '.spec.js');
  expect(formulas).not.toContain('tests/48-fmgraph-charts.spec.js');
  // fmIDE's command list is read by the help pages' build.
  expect(pick('src/fmide/js/01-setup-commands-keys.js').tests).toContain('tests/34-help-site.spec.js');
});

test('the command prints the test files, one per line, and why with --why', () => {
  const r = run('--files', 'src/fmgraph/js/05-render.js');
  expect(r.status).toBe(0);
  const printed = r.stdout.trim().split('\n');
  expect(printed).toEqual(pick('src/fmgraph/js/05-render.js').tests);
  // Playwright reads each as a pattern: no file's path may hold another's.
  for(const p of ALL) expect(ALL.filter(q => q.includes(p)), p).toEqual([p]);
  const why = run('--why', '--files', 'src/fmgraph/js/05-render.js', 'docs/step13-zoom.md');
  expect(why.status).toBe(0);
  expect(why.stdout).toContain('src/fmgraph/js/05-render.js — part of fmGraph');
  expect(why.stdout).toContain('docs/step13-zoom.md — documentation');
  expect(why.stdout).toMatch(/tests\/0-smoke\.spec\.js {2}← \(always\)/);
  const full = run('--files', 'src/shared/ir.js');
  expect(full.stdout.trim().split('\n')).toEqual(ALL);
});
