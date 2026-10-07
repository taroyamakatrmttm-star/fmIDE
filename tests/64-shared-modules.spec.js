// 64. The shared code as real modules (step 3c): src/shared/ is a module folder
// (package.json "type": "module"). Each file says what it needs (import) and what it offers
// (export); Node loads it as it is, and the build turns it back into a plain fragment of each
// app's wrapped function (tools/build.js, moduleFragment), so the apps are what they were.
// - Each module loads on its own in Node and offers exactly what its export lines name.
// - A module uses another module's names only through an import (the apps share one scope,
//   so they would never notice a missing import; Node would, when that line runs).
// - The apps carry each module they include without its import lines and export words, and
//   no import or export is left in them.
// - The build's rules: the one form of import and export, a name not exported, a module an
//   app doesn't include.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect, ROOT } = require('./helpers/apps');
const { moduleFragment, ModuleError } = require('../tools/build.js');

const SHARED = path.join(ROOT, 'src', 'shared');
const MODULES = fs.readdirSync(SHARED).filter(f => f.endsWith('.js')).sort();
// The browser's own pieces (storage, pointer input, the Help panel…) reach for the page when
// they load, so Node can't load them; they are loaded as modules in a page instead.
const BROWSER_ONLY = ['file-picker.js', 'help-panel.js', 'pointer-input.js', 'store.js', 'update-notice.js'];
const read = (f) => fs.readFileSync(path.join(SHARED, f), 'utf8');
const fragment = (f) => moduleFragment(read(f), 'src/shared/' + f);

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

test('every shared module but the browser\'s own loads on its own in Node and offers what its export lines name', () => {
  for(const f of MODULES.filter(f => !BROWSER_ONLY.includes(f))){
    const loaded = require(path.join(SHARED, f));
    expect(Object.keys(loaded).sort(), f).toEqual([...fragment(f).exports].sort());
  }
  // The folder is a module folder: Node reads its files as modules, as the build does.
  expect(JSON.parse(fs.readFileSync(path.join(SHARED, 'package.json'), 'utf8'))).toEqual({ type: 'module' });
});

test('the browser\'s own pieces load on their own as modules in a page and offer what their export lines name', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  for(const f of BROWSER_ONLY){
    const names = await page.evaluate(async (code) => {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      try{ return Object.keys(await import(url)).sort(); } finally { URL.revokeObjectURL(url); }
    }, read(f));
    expect(names, f).toEqual([...fragment(f).exports].sort());
    expect(names.length, f).toBeGreaterThan(0);
  }
});

test('a module uses another module\'s names only through an import', () => {
  const exportedBy = new Map(); // name → the module exporting it
  MODULES.forEach(f => fragment(f).exports.forEach(n => exportedBy.set(n, f)));
  const problems = [];
  for(const f of MODULES){
    const { text, imports, exports } = fragment(f);
    const imported = new Map(imports.flatMap(im => im.names.map(n => [n, im.from])));
    const code = codeOnly(text);
    const declaredHere = new Set([...code.matchAll(/^(?:async function\*?|function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
    for(const name of namesUsed(code)){
      const owner = exportedBy.get(name);
      if(!owner || owner === f || declaredHere.has(name)) continue;
      if(imported.get(name) !== owner) problems.push(f + ' uses ' + name + ' (from ' + owner + ') without importing it');
    }
    // An import names only what it uses, from the file that offers it.
    for(const [name, from] of imported){
      if(exportedBy.get(name) !== from) problems.push(f + ' imports ' + name + ' from ' + from + ', which does not export it');
      if(!namesUsed(code).has(name)) problems.push(f + ' imports ' + name + ' and never uses it');
    }
  }
  expect(problems).toEqual([]);
});

test('the apps carry each module they include without its imports and exports, and nothing else of them', () => {
  const apps = {
    'fmIDE.html': path.join(ROOT, 'src', 'fmide', 'js'),
    'ExcelExporter.html': path.join(ROOT, 'src', 'excel-exporter', 'js'),
    'fmGraph.html': path.join(ROOT, 'src', 'fmgraph', 'js'),
  };
  for(const [app, dir] of Object.entries(apps)){
    const built = fs.readFileSync(path.join(ROOT, 'apps', app), 'utf8');
    expect(built, app).not.toMatch(/^[ \t]*import \{/m);
    expect(built, app).not.toMatch(/^[ \t]*export (async function|function|const|let|class) /m);
    const includes = fs.readdirSync(dir).filter(n => n.endsWith('.js'))
      .flatMap(n => [...fs.readFileSync(path.join(dir, n), 'utf8').matchAll(/^([ \t]*)\/\/ build:include shared\/([\w.-]+)\r?$/gm)]);
    expect(includes.length, app).toBeGreaterThan(0);
    for(const [, indent, f] of includes){
      const expected = fragment(f).text.split('\n').map(l => l === '' ? l : indent + l).join('\n');
      expect(built.includes(expected), app + ' carries ' + f).toBe(true);
    }
  }
});

test('the build reads one form of import and export, and says where any other is', () => {
  const r = moduleFragment([
    '// a banner',
    "import { a, b } from './one.js';",
    "import { c } from './two.js';",
    'export function f(){ return a + b + c; }',
    'export const K = 1;',
    'export let n = 0;',
    'export class Thing {}',
    'export async function g(){}',
    'function inside(){ export_ = 1; }',
    '',
  ].join('\n'), 'm.js');
  expect(r.text).toBe(['// a banner', 'function f(){ return a + b + c; }', 'const K = 1;', 'let n = 0;', 'class Thing {}',
    'async function g(){}', 'function inside(){ export_ = 1; }', ''].join('\n'));
  expect(r.imports).toEqual([{ from: 'one.js', names: ['a', 'b'], where: 'm.js:2' }, { from: 'two.js', names: ['c'], where: 'm.js:3' }]);
  expect([...r.exports]).toEqual(['f', 'K', 'n', 'Thing', 'g']);
  // CRLF line ends (a Windows checkout) are read the same way.
  expect(moduleFragment("import { a } from './one.js';\r\nexport const K = a;\r\n", 'w.js').text).toBe('const K = a;\r\n');

  const refused = [
    ["import {\n  a } from './one.js';", /m\.js:1: an import must be one line/],
    ["import a from './one.js';", /m\.js:1: an import must be one line/],
    ["import { a as b } from './one.js';", /an import must be one line/],
    ["import { a } from '../app/one.js';", /an import must be one line/],
    ["import * as all from './one.js';", /an import must be one line/],
    ['const a = 1;\nexport default a;', /m\.js:2: only {2}export function \/ const \/ let \/ class <name> {2}is allowed/],
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
  });

  test('the copy as it is builds the same apps', () => {
    const r = buildCopy(dir => fs.cpSync(path.join(ROOT, 'apps'), path.join(dir, 'apps'), { recursive: true }));
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});
