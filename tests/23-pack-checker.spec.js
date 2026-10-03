// 23. The library's pack checker (step 8, phase 8c-1): tools/check-pack.js, in Node.
// - It reads packs with fmIDE's own shared code (src/shared/fmide-files.js and the rest), so a
//   pack fmIDE saves passes, and one fmIDE would read differently (dropping or repairing
//   something) fails.
// - The file: size (5 MB for the library), UTF-8, JSON, nesting, kind, version.
// - The pack details: author, licence, title, tags, date.
// - Templates, recipes and functions: ids, versions, models, parts, calls, formulas, origins.
// - Hidden characters that disguise text; reports quote pack text escaped.
// - The command: exit codes, --json, several files.
// - Agreement with fmIDE: an item the checker refuses is one fmIDE would leave out or change.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { test, expect, fixture, readFixture, ROOT } = require('./helpers/apps');
const F = require('./helpers/fmide');
const { checkPack, formatReport, hiddenCharacter, shared: S } = require('../tools/check-pack');

const GOOD_NAME = 'pack-checker-good-1.fmide-pack.json';
const GOOD = fixture('library', 'check', GOOD_NAME); // saved by fmIDE (a recipe, canvas and system templates, functions)
const CHECKER = path.join(ROOT, 'tools', 'check-pack.js');
const RLO = String.fromCharCode(0x202E);            // right-to-left override: makes text read backwards
const ZWSP = String.fromCharCode(0x200B);           // zero-width space

// The sample pack, changed by `change(pack)`, checked as the file it would be.
function check(change, name){
  const pack = readFixture('library', 'check', GOOD_NAME);
  if(change) change(pack);
  return checkPack(JSON.stringify(pack, null, 2), name || GOOD_NAME);
}
const messages = (r, kind) => r[kind || 'errors'].map(x => `${x.where}: ${x.message}`);
function expectError(r, re){
  expect(r.ok).toBe(false);
  expect(messages(r).some(m => re.test(m)), messages(r).join('\n') || '(no errors)').toBe(true);
}
const tpl = (p, name) => p.templates.find(t => t.name === name);
const fn = (p, family) => p.functions.find(f => f.family === family);

test.describe('packs that pass', () => {
  test('a pack fmIDE saved passes, with nothing to warn about', () => {
    const r = checkPack(fs.readFileSync(GOOD), GOOD);
    expect(messages(r)).toEqual([]);
    expect(messages(r, 'warnings')).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.pack).toMatchObject({ id: 'pack-checker-good-1', title: 'Checker sample', author: 'Ann Example', licence: 'CC-BY-4.0', created: '2026-09-27', version: 2 });
    expect(r.counts).toEqual({ templates: 3, recipes: 1, functions: 2 });
  });

  // Version 3 (step 11c) only adds an optional Excel layout: a version 2 pack is as good.
  test('a version 2 pack (what fmIDE saved before step 11c) passes without a warning to save it again', () => {
    const r = check(null);
    expect(r.pack.version).toBe(2);
    expect(messages(r, 'warnings')).toEqual([]);
  });

  test('an older pack (version 1) passes with a warning to save it again', () => {
    const r = checkPack(fs.readFileSync(fixture('library', 'pack-v1.json')), 'pack-sample-0001.fmide-pack.json');
    expect(r.ok).toBe(true);
    expect(messages(r, 'warnings').join('\n')).toMatch(/saved by an older fmIDE \(library pack version 1; the current version is 4\)/);
  });

  test('a file not named after its pack id gets a note with the name it will have', () => {
    const r = check(null, 'Checker-sample.fmide-pack.json');
    expect(r.ok).toBe(true);
    expect(messages(r, 'notes').join('\n')).toMatch(/named pack-checker-good-1\.fmide-pack\.json/);
  });
});

test.describe('the file', () => {
  test('more than 5 MB is refused before it is read', () => {
    const r = checkPack(Buffer.alloc(5 * 1024 * 1024 + 1, 32), 'big.json');
    expectError(r, /5\.0 MB; a library pack may be at most 5 MB/);
  });
  test('not UTF-8, a byte-order mark, or not JSON', () => {
    expectError(checkPack(Buffer.from([0x7b, 0xff, 0x7d]), 'x.json'), /isn't valid UTF-8/);
    expectError(checkPack(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(GOOD)]), 'x.json'), /byte-order mark/);
    expectError(checkPack('{ "kind": ', 'x.json'), /isn't valid JSON/);
  });
  test('nested too deeply', () => {
    expectError(checkPack('['.repeat(150) + ']'.repeat(150), 'x.json'), /nested too deeply/);
  });
  test('another kind of file says where it belongs', () => {
    expectError(checkPack(fs.readFileSync(fixture('formats', 'templates-v2.json')), 'x.json'), /That is an fmIDE templates file, not a library pack\. Open it with Templates → Import Templates\./);
    expectError(checkPack('{"kind":"something-else"}', 'x.json'), /isn't an fmIDE file this version recognises/);
  });
  test('a newer pack needs a newer checker; a version must be a whole number', () => {
    expectError(check(p => { p.version = 5; }), /saved by a newer fmIDE \(library pack version 5; this checker reads up to version 4\)/); // v4 current since step 15 G5a
    expectError(check(p => { p.version = '2'; }), /"version" isn't a whole number/);
  });
  test('an empty pack, and more items than fmIDE reads', () => {
    expectError(check(p => { p.templates = []; p.functions = []; }), /holds no templates, recipes or functions/);
    expectError(check(p => { p.functions = Array.from({ length: 501 }, () => p.functions[1]); }), /holds 501 functions; fmIDE reads at most 500/);
  });
  test('fields fmIDE ignores are warned about', () => {
    const r = check(p => { p.extra = 1; p.pack.homepage = 'x'; tpl(p, 'Income Statement').colour = 'red'; });
    expect(r.ok).toBe(true);
    expect(messages(r, 'warnings').join('\n')).toMatch(/ignores its fields "extra"[\s\S]*ignores its details "homepage"[\s\S]*ignores its fields "colour"/);
  });
});

test.describe('the pack details', () => {
  test('no author, no licence or another licence is refused, as fmIDE refuses it', () => {
    expectError(check(p => { delete p.pack.author; }), /doesn't say who made it/);
    expectError(check(p => { delete p.pack.licence; }), /has no licence/);
    expectError(check(p => { p.pack.licence = 'CC-BY-SA-4.0'; }), /licence \("CC-BY-SA-4\.0"\) isn't one fmIDE accepts/);
    expectError(check(p => { p.pack.id = 'short'; }), /has no valid id/);
  });
  test('what fmIDE would tidy is an error: spaces, capitals in tags, a date that isn\'t one', () => {
    expectError(check(p => { p.pack.title = ' Checker  sample'; }), /title has line breaks, extra spaces/);
    expectError(check(p => { p.pack.author = 'A'.repeat(121); }), /author has line breaks, extra spaces or more than 120/);
    expectError(check(p => { p.pack.tags = ['Statements']; }), /tags must be a list/);
    expectError(check(p => { p.pack.created = '2026-02-31'; }), /isn't a real date/);
    expectError(check(p => { p.pack.description = 'x'.repeat(2001); }), /description isn't text, has spaces .* more than 2000/);
  });
  test('no date is a warning', () => {
    const r = check(p => { delete p.pack.created; });
    expect(r.ok).toBe(true);
    expect(messages(r, 'warnings').join('\n')).toMatch(/has no date/);
  });
});

test.describe('templates and recipes', () => {
  test('ids and versions fmIDE would replace are errors', () => {
    expectError(check(p => { tpl(p, 'Income Statement').family = 'x'; }), /template "Income Statement" v1: Its family id is missing or malformed/);
    expectError(check(p => { delete tpl(p, 'Balance Sheet').versionId; }), /template "Balance Sheet" v1: Its version id is missing/);
    expectError(check(p => { tpl(p, 'Balance Sheet').version = 0; }), /Its version isn't a whole number/);
    expectError(check(p => { tpl(p, 'Balance Sheet').note = 'n'.repeat(201); }), /change note .* more than 200/);
    expectError(check(p => { tpl(p, 'Balance Sheet').kind = 'widget'; }), /Its kind \("widget"\) isn't "module", "system" or "recipe"/);
    expectError(check(p => { tpl(p, 'Balance Sheet').name = ' Balance Sheet'; }), /name has spaces at the start or end/);
  });
  test('a version twice, a version id twice, one family as two kinds', () => {
    expectError(check(p => { p.templates.push(JSON.parse(JSON.stringify(tpl(p, 'Balance Sheet')))); }), /holds version 1 of this family twice/);
    expectError(check(p => { const c = JSON.parse(JSON.stringify(tpl(p, 'Balance Sheet'))); c.version = 2; p.templates.push(c); }), /version id is also used by template "Balance Sheet" v1/);
    expectError(check(p => { tpl(p, 'Margins model').family = 'fam-income-statement'; }), /family is also used by .* a different kind of template/);
  });
  test('models: unreadable, newer, broken shapes, missing function definitions', () => {
    expectError(check(p => { delete tpl(p, 'Income Statement').data.nodes; }), /Its model has no "nodes" and "edges" lists/);
    expectError(check(p => { tpl(p, 'Income Statement').data.version = 99; }), /model was saved by a newer fmIDE \(module version 99\)/);
    expectError(check(p => { tpl(p, 'Income Statement').data = { kind: 'system', canvases: [] }; }), /That is an fmIDE system, not a module/);
    expectError(check(p => { tpl(p, 'Income Statement').data.nodes[0].type = 'widget'; }), /is of a type fmIDE doesn't know \("widget"\)/);
    expectError(check(p => { tpl(p, 'Income Statement').data.nodes[0].x = 'left'; }), /has no position/);
    expectError(check(p => { tpl(p, 'Balance Sheet').data.edges.push({ id: 'e99', from: 'n1', to: 'nowhere' }); }), /arrow #\d+ doesn't join two of its nodes/);
    expectError(check(p => { tpl(p, 'Margins model').data.canvases[0].nodes.push(Object.assign({}, tpl(p, 'Margins model').data.canvases[0].nodes[0], { id: tpl(p, 'Margins model').data.canvases[0].nodes[1].id })); }), /two nodes with the id/);
    expectError(check(p => { tpl(p, 'Margins model').data.functions = []; }), /model uses "Margin", whose definition the model doesn't carry/);
    expectError(check(p => { tpl(p, 'Margins model').data.functions[0].text = 'Margin(Revenue, Cost) = (Revenue - '; }), /model's function "Margin" can't be read/);
  });
  test('a recipe needs its parts in the pack, as the versions it was made with', () => {
    expectError(check(p => { p.templates = p.templates.filter(t => t.name !== 'Income Statement'); }), /template "Statements" v1: The recipe needs "Income Statement"@latest, which the pack doesn't carry/);
    expectError(check(p => { tpl(p, 'Balance Sheet').versionId = 'vid-balance-other'; }), /recipe was made with a different "Balance Sheet" v1/);
    expectError(check(p => { tpl(p, 'Statements').data.parts[1].family = 'fam-margins-model'; tpl(p, 'Statements').data.parts[1].versionId = 'vid-margins-model-1'; }), /part "Balance Sheet" is not a canvas template/);
    expectError(check(p => { tpl(p, 'Statements').data.parts[0].version = 'newest'; }), /part 1 has no valid version/);
    expectError(check(p => { tpl(p, 'Statements').data.parts = []; }), /recipe has no parts/);
    expectError(check(p => { tpl(p, 'Income Statement').data.nodes[0].type = 'widget'; }), /template "Statements" v1: The recipe needs "Income Statement"@latest, which has errors of its own/);
  });
});

test.describe('functions', () => {
  test('formulas that can\'t be read, calls the pack doesn\'t carry, loops', () => {
    expectError(check(p => { fn(p, 'family-margin').text = 'Margin(Revenue, Cost) = (Revenue - Cost) /'; }), /function "Margin" v1: Its formula can't be read/);
    expectError(check(p => { p.functions = p.functions.filter(f => f.family !== 'family-margin'); }), /function "Profit" v1: It calls "Margin" v1, which the pack doesn't carry/);
    expectError(check(p => {
      const m = fn(p, 'family-margin');
      m.text = 'Margin(Revenue, Cost) = Profit(Revenue, Cost) / Revenue';
      m.calls = [{ name: 'Profit', family: 'family-profit', version: 1, versionId: 'version-profit-1' }];
    }), /can't be calculated: it calls itself through other functions, in a loop/);
    expectError(check(p => { fn(p, 'family-profit').calls = []; }), /function "Profit" v1: It can't be calculated: it calls a function that isn't in the pack/);
  });
  test('ids, versions and limits fmIDE would change', () => {
    expectError(check(p => { delete fn(p, 'family-margin').versionId; }), /function "Margin": Its version id is missing|function "Margin" v1: Its version id is missing/);
    expectError(check(p => { fn(p, 'family-margin').description = 'd'.repeat(2001); }), /description isn't text of at most 2000/);
    expectError(check(p => { fn(p, 'family-profit').calls[0].versionId = 'bad id!'; }), /"calls" have no version id/);
    expectError(check(p => { p.functions.push(JSON.parse(JSON.stringify(fn(p, 'family-margin')))); }), /holds version 1 of this function twice/);
  });
});

test.describe('where items came from (origin)', () => {
  const ORIGIN = { packId: 'pack-older-0001', packTitle: 'Older pack', author: 'Bob Other', licence: 'CC-BY-4.0' };
  test('a malformed origin is an error (fmIDE would drop it)', () => {
    expectError(check(p => { tpl(p, 'Income Statement').origin = Object.assign({}, ORIGIN, { licence: 'MIT' }); }), /record of where it came from \("origin"\) is malformed/);
    expectError(check(p => { fn(p, 'family-margin').origin = Object.assign({}, ORIGIN, { extra: 1 }); }), /"origin"\) is malformed/);
  });
  test('an item shared before by someone else is noted, to be matched with the library', () => {
    const r = check(p => { fn(p, 'family-margin').origin = ORIGIN; });
    expect(r.ok).toBe(true);
    expect(messages(r, 'notes').join('\n')).toMatch(/function "Margin" v1: It says it was shared before: in the pack "Older pack" \(pack-older-0001\) by "Bob Other"/);
  });
});

test.describe('hidden characters and hostile text', () => {
  test('text-reversing, invisible and control characters are errors', () => {
    expectError(check(p => { tpl(p, 'Balance Sheet').name = 'Balance' + RLO + 'Sheet'; }), /name contains a hidden character \(U\+202E, which changes the direction of text\)/);
    expectError(check(p => { p.pack.author = 'Ann' + ZWSP + ' Example'; }), /author contains a hidden character \(U\+200B, which is invisible\)/);
    expectError(check(p => { p.pack.tags = ['a' + String.fromCharCode(7)]; }), /tag contains a hidden character \(U\+0007, which is a control character\)/);
    expectError(check(p => { tpl(p, 'Income Statement').data.nodes[0].text = 'Net' + RLO + 'Income\n40'; }), /node "n1" contains a hidden character \(U\+202E/);
    expectError(check(p => { fn(p, 'family-margin').note = 'x' + RLO; }), /change note contains a hidden character/);
    expect(hiddenCharacter('Plain text, “quotes” and — dashes; ümlauts; 日本語')).toBe(null);
  });
  test('reports quote pack text escaped and cut short, so it can\'t disguise the report', () => {
    const r = check(p => { tpl(p, 'Balance Sheet').name = RLO + '<script>alert(1)</script>' + 'x'.repeat(100); });
    const text = formatReport(r);
    expect(text).not.toContain(RLO);
    expect(text).toContain('\\u202e<script>alert(1)</script>');
    expect(text).toMatch(/x{10,}…"/);
    // Text reaching a message another way (the parser quoting a formula) is escaped too.
    const viaParser = check(p => { fn(p, 'family-margin').text = 'Margin(Revenue, Cost) = ' + RLO + 'SUM(Revenue)'; });
    expect(viaParser.ok).toBe(false);
    expect(formatReport(viaParser) + JSON.stringify(viaParser)).not.toContain(RLO);
    expect(messages(viaParser).join('\n')).toMatch(/function "Profit" v1: It calls "Margin" v1, which has errors of its own/);
    // Markup is allowed in names (every app shows it as text); only hidden characters fail.
    const ok = check(p => { p.pack.title = '<b>Bold</b> & "quoted"'; });
    expect(ok.ok).toBe(true);
  });
});

test.describe('the command', () => {
  const run = (args) => spawnSync(process.execPath, [CHECKER].concat(args), { encoding: 'utf8' });
  test('exit codes: 0 passed, 1 failed, 2 for a file that can\'t be read or a wrong option', ({}, testInfo) => {
    const bad = testInfo.outputPath('bad.fmide-pack.json');
    fs.writeFileSync(bad, '{}');
    const ok = run([GOOD]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/Pack "Checker sample" by "Ann Example" \(CC BY 4\.0\)[\s\S]*3 templates, 1 recipe, 2 functions[\s\S]*Result: PASSED — 0 errors, 0 warnings\./);
    const failed = run([GOOD, bad]);
    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(/Result: PASSED[\s\S]*Checking .*bad\.fmide-pack\.json[\s\S]*Errors \(1\):[\s\S]*Result: FAILED — 1 error/);
    expect(run([testInfo.outputPath('missing.json')]).status).toBe(2);
    expect(run(['--nope', GOOD]).status).toBe(2);
    expect(run([]).status).toBe(2);
  });
  test('--json gives the same report for machines', () => {
    const out = JSON.parse(execFileSync(process.execPath, [CHECKER, '--json', GOOD], { encoding: 'utf8' }));
    expect(out).toMatchObject({ ok: true, pack: { id: 'pack-checker-good-1' }, counts: { templates: 3, recipes: 1, functions: 2 }, errors: [], warnings: [] });
  });
});

test.describe('agreement with fmIDE', () => {
  test('fmIDE shows the same items the checker passed', async ({ page }) => {
    await F.openFmIDE(page);
    const preview = await page.evaluate((file) => fm.previewLibraryPack({ file }), readFixture('library', 'check', GOOD_NAME));
    const r = check();
    expect(preview.pack).toMatchObject({ id: r.pack.id, title: r.pack.title, author: r.pack.author, licence: r.pack.licence });
    expect(preview.items.map(it => `${it.type}:${it.name}@${it.version}`)).toEqual([
      'template:Statements@1', 'template:Income Statement@1', 'template:Balance Sheet@1', 'template:Margins model@1',
      'function:Profit@1', 'function:Margin@1']);
  });
  test('what the checker refuses, fmIDE would have left out or changed', async ({ page }) => {
    await F.openFmIDE(page);
    const pack = readFixture('library', 'check', GOOD_NAME);
    tpl(pack, 'Balance Sheet').kind = 'widget';   // fmIDE leaves it out
    delete fn(pack, 'family-margin').versionId;   // fmIDE reads it without one
    const r = checkPack(JSON.stringify(pack), GOOD_NAME);
    expect(messages(r).length).toBeGreaterThanOrEqual(2);
    const preview = await page.evaluate((file) => fm.previewLibraryPack({ file }), pack);
    expect(preview.items.map(it => it.name)).not.toContain('Balance Sheet');
    // fmIDE still takes Margin, without a version id: the checker refuses what fmIDE changes.
    expect(preview.items.map(it => it.name)).toContain('Margin');
    const read = S.readLibraryPackData(pack);
    expect(read.functions.find(f => f.family === 'family-margin').versionId).toBe('');
  });
});
