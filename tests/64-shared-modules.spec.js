// 64. Real modules (step 3c). A folder whose package.json says "type": "module" holds modules:
// src/shared/ (the code the apps share), ExcelExporter's js-head/ (its Excel writer) and fmIDE's
// modules/ (its expression parser). Each file says what it needs (import) and what it offers
// (export); Node loads it as it is, and the build turns it back into a plain fragment of the
// app's wrapped function (tools/build.js, moduleFragment), so the apps get what they had.
// - Each module loads on its own (in Node, or the browser's own pieces in a page) and offers
//   exactly what its export lines name.
// - A module uses another module's names only through an import (the apps share one scope,
//   so they would never notice a missing import; Node would, when that line runs).
// - The apps carry each module they take in without its import lines and export words, and
//   no import or export is left in them.
// - The build's rules: the one form of import and export, a name not exported, a module an
//   app doesn't include.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect, ROOT } = require('./helpers/apps');
const { moduleFragment, ModuleError } = require('../tools/build.js');

const SRC = path.join(ROOT, 'src');
const MODULE_DIRS = ['shared', 'excel-exporter/js-head', 'fmide/modules'];
// Every module, by its path from the repository's folder ('src/shared/ir.js').
const MODULES = MODULE_DIRS.flatMap(d => fs.readdirSync(path.join(SRC, ...d.split('/'))).filter(f => f.endsWith('.js')).map(f => 'src/' + d + '/' + f)).sort();
// The browser's own pieces (storage, pointer input, the Help panel…) reach for the page when
// they load, so Node can't load them; they are loaded as modules in a page instead.
const BROWSER_ONLY = ['file-picker.js', 'help-panel.js', 'pointer-input.js', 'store.js', 'update-notice.js'].map(f => 'src/shared/' + f);
const file = (m) => path.join(ROOT, ...m.split('/'));
const read = (m) => fs.readFileSync(file(m), 'utf8');
const fragment = (m) => moduleFragment(read(m), m);
// The module an import names, by its path from the repository's folder.
const target = (m, from) => path.posix.normalize(path.posix.join(path.posix.dirname(m), from));
// The code of a file with its comments, strings, template texts and regular expressions
// blanked out, so only identifiers written as code remain.
function codeOnly(src){
  let out = '', i = 0, prev = '';
  const regexCanStart = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|of|in)$/.test(out.trimEnd());
  while(i < src.length){
    const c = src[i], d = src[i + 1];
    if(c === '/' && d === '/'){ while(i < src.length && src[i] !== '\n') i++; continue; }
    if(c === '/' && d === '*'){ i = src.indexOf('*/', i + 2) + 2; out += ' '; continue; }
    if(c === "'" || c === '"' || c === '`' || (c === '/' && regexCanStart())){
      let inClass = false;
      for(i++; i < src.length; i++){
        if(src[i] === '\\'){ i++; continue; }
        if(c === '/' && src[i] === '[') inClass = true;
        else if(c === '/' && src[i] === ']') inClass = false;
        else if(src[i] === c && !inClass) break;
      }
      i++;
      out += ' 0 ';
      prev = '0';
      continue;
    }
    out += c;
    if(!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
// Identifiers used as names (not after a dot: a property of the same name doesn't count).
const namesUsed = (code) => new Set([...code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)].map(m => m[1]));

test('every module but the browser\'s own loads on its own in Node and offers what its export lines name', () => {
  for(const m of MODULES.filter(m => !BROWSER_ONLY.includes(m))){
    const loaded = require(file(m));
    expect(Object.keys(loaded).sort(), m).toEqual([...fragment(m).exports].sort());
    expect(Object.keys(loaded).length, m).toBeGreaterThan(0);
  }
  // Each folder is a module folder: Node reads its files as modules, as the build does.
  for(const d of MODULE_DIRS) expect(JSON.parse(fs.readFileSync(path.join(SRC, ...d.split('/'), 'package.json'), 'utf8')), d).toEqual({ type: 'module' });
});

test('the browser\'s own pieces load on their own as modules in a page and offer what their export lines name', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  for(const m of BROWSER_ONLY){
    const names = await page.evaluate(async (code) => {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      try{ return Object.keys(await import(url)).sort(); } finally { URL.revokeObjectURL(url); }
    }, read(m));
    expect(names, m).toEqual([...fragment(m).exports].sort());
    expect(names.length, m).toBeGreaterThan(0);
  }
});

test('a module uses another module\'s names only through an import', () => {
  const exportedBy = new Map(); // name → the module exporting it
  MODULES.forEach(m => fragment(m).exports.forEach(n => exportedBy.set(n, m)));
  const problems = [];
  for(const m of MODULES){
    const { text, imports } = fragment(m);
    const imported = new Map(imports.flatMap(im => im.names.map(n => [n, target(m, im.from)])));
    const code = codeOnly(text);
    const declaredHere = new Set([...code.matchAll(/^(?:async function\*?|function\*?|const|let|var|class) ([A-Za-z_$][\w$]*)/gm)].map(x => x[1]));
    for(const name of namesUsed(code)){
      const owner = exportedBy.get(name);
      if(!owner || owner === m || declaredHere.has(name)) continue;
      if(imported.get(name) !== owner) problems.push(m + ' uses ' + name + ' (from ' + owner + ') without importing it');
    }
    // An import names only what it uses, from the file that offers it.
    for(const [name, from] of imported){
      if(exportedBy.get(name) !== from) problems.push(m + ' imports ' + name + ' from ' + from + ', which does not export it');
      if(!namesUsed(code).has(name)) problems.push(m + ' imports ' + name + ' and never uses it');
    }
  }
  expect(problems).toEqual([]);
});

test('the apps carry each module they take in without its imports and exports, and nothing else of them', () => {
  const apps = {
    'fmIDE.html': ['fmide/js'],
    'ExcelExporter.html': ['excel-exporter/js-head', 'excel-exporter/js'],
    'fmGraph.html': ['fmgraph/js'],
  };
  const carried = new Set();
  for(const [app, dirs] of Object.entries(apps)){
    const built = fs.readFileSync(path.join(ROOT, 'apps', app), 'utf8');
    expect(built, app).not.toMatch(/^[ \t]*import \{/m);
    expect(built, app).not.toMatch(/^[ \t]*export (async function|function|const|let|var|class) /m);
    // A module is a piece of the app's folder, or taken in by an include line (with its indent).
    const taken = dirs.flatMap(d => fs.readdirSync(path.join(SRC, ...d.split('/'))).filter(n => n.endsWith('.js')).flatMap(n => {
      const m = 'src/' + d + '/' + n;
      const own = MODULES.includes(m) ? [['', m]] : [];
      return own.concat([...read(m).matchAll(/^([ \t]*)\/\/ build:include ([\w.\/-]+)\r?$/gm)].map(x => [x[1], 'src/' + x[2]]).filter(([, f]) => MODULES.includes(f)));
    }));
    expect(taken.length, app).toBeGreaterThan(0);
    for(const [indent, m] of taken){
      // The include lines inside a module piece are filled in, as in the app.
      const expected = fragment(m).text.split('\n').filter(l => !/^\s*\/\/ build:include /.test(l)).map(l => l === '' ? l : indent + l);
      for(const line of expected) expect(built.includes(line), app + ' carries ' + m + ': ' + line.slice(0, 60)).toBe(true);
      const whole = expected.join('\n');
      if(!/build:include/.test(read(m))) expect(built.includes(whole), app + ' carries ' + m + ' whole').toBe(true);
      carried.add(m);
    }
  }
  // Every module reaches at least one app.
  expect(MODULES.filter(m => !carried.has(m))).toEqual([]);
});

test('the build reads one form of import and export, and says where any other is', () => {
  const r = moduleFragment([
    '// a banner',
    "import { a, b } from './one.js';",
    "import { c } from '../../shared/two.js';",
    'export function f(){ return a + b + c; }',
    'export const K = 1;',
    'export let n = 0;',
    'export class Thing {}',
    'export async function g(){}',
    'export var X = (function(){ return 1; })();',
    'function inside(){ export_ = 1; }',
    '',
  ].join('\n'), 'm.js');
  expect(r.text).toBe(['// a banner', 'function f(){ return a + b + c; }', 'const K = 1;', 'let n = 0;', 'class Thing {}',
    'async function g(){}', 'var X = (function(){ return 1; })();', 'function inside(){ export_ = 1; }', ''].join('\n'));
  expect(r.imports).toEqual([{ from: './one.js', names: ['a', 'b'], where: 'm.js:2' }, { from: '../../shared/two.js', names: ['c'], where: 'm.js:3' }]);
  expect([...r.exports]).toEqual(['f', 'K', 'n', 'Thing', 'g', 'X']);
  // CRLF line ends (a Windows checkout) are read the same way.
  expect(moduleFragment("import { a } from './one.js';\r\nexport const K = a;\r\n", 'w.js').text).toBe('const K = a;\r\n');

  const refused = [
    ["import {\n  a } from './one.js';", /m\.js:1: an import must be one line/],
    ["import a from './one.js';", /m\.js:1: an import must be one line/],
    ["import { a as b } from './one.js';", /an import must be one line/],
    ["import { a } from 'one.js';", /an import must be one line/],
    ["import { a } from '/src/one.js';", /an import must be one line/],
    ["import { a } from './one.mjs';", /an import must be one line/],
    ["import * as all from './one.js';", /an import must be one line/],
    ['const a = 1;\nexport default a;', /m\.js:2: only {2}export function \/ const \/ let \/ var \/ class <name> {2}is allowed/],
    ['const a = 1;\nexport { a };', /m\.js:2: only/],
    ["export * from './one.js';", /m\.js:1: only/],
    ['export const a = 1;\nexport function a(){}', /m\.js:2: a is exported twice/],
  ];
  for(const [text, message] of refused){
    expect(() => moduleFragment(text, 'm.js'), text).toThrow(ModuleError);
    expect(() => moduleFragment(text, 'm.js'), text).toThrow(message);
  }
});

test.describe('the build stops when a module\'s import has nothing to take', () => {
  // A copy of src/ and tools/, changed one way, built with --check: nothing is written.
  function buildCopy(change){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-modules-'));
    try{
      for(const part of ['src', 'tools']) fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true });
      change(dir);
      return spawnSync(process.execPath, [path.join(dir, 'tools', 'build.js'), '--check'], { encoding: 'utf8' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const edit = (dir, rel, from, to) => {
    const file = path.join(dir, ...rel.split('/'));
    const text = fs.readFileSync(file, 'utf8');
    expect(text.includes(from), rel).toBe(true);
    fs.writeFileSync(file, text.replace(from, to));
  };

  test('a name the other file does not export', () => {
    const r = buildCopy(dir => edit(dir, 'src/shared/input-rule.js', "import { chooseChoiceCount } from './operators.js';",
      "import { chooseChoiceCount, notThere } from './operators.js';"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/build: src\/shared\/input-rule\.js:\d+: src\/shared\/operators\.js does not export notThere/);
  });

  test('a module the app does not include', () => {
    const r = buildCopy(dir => edit(dir, 'src/excel-exporter/js/01-core-translation.js', '// build:include shared/uom.js\n', ''));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/imports from src\/shared\/uom\.js, which ExcelExporter\.html does not include/);
  });

  test('a file that is not there, and an export in another form', () => {
    let r = buildCopy(dir => edit(dir, 'src/shared/input-rule.js', "from './operators.js';", "from './nowhere.js';"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/imports from src\/shared\/nowhere\.js, which does not exist/);
    r = buildCopy(dir => fs.appendFileSync(path.join(dir, 'src', 'shared', 'uom.js'), 'export { parseUOMAtom };\n'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/src\/shared\/uom\.js:\d+: only {2}export function/);
    r = buildCopy(dir => edit(dir, 'src/shared/input-rule.js', "from './operators.js';", "from '../../../outside.js';"));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/src\/shared\/input-rule\.js:\d+: imports from outside src\/: \.\.\/\.\.\/\.\.\/outside\.js/);
  });

  test('the copy as it is builds the same apps', () => {
    const r = buildCopy(dir => fs.cpSync(path.join(ROOT, 'apps'), path.join(dir, 'apps'), { recursive: true }));
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});
