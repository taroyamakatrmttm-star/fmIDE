// 24. The library's rules (step 8, phase 8c-2): the pack checker's library mode
// (tools/check-pack.js --library, code in tools/check-library.js), in Node.
// - A whole library: packs named after their ids, each passing the one-pack check, and the
//   records (families.json, authors.json, packs.json) matching them.
// - The family rule: only a family's owner (the account of its first pack) adds versions;
//   someone else's version is shared again only as an exact copy, with its origin.
// - Pack ids and version ids are never used again, even after a takedown.
// - The author name matches the submitting account; one name, one account.
// - A pull request (--base): records only added, packs never edited, only packs and records
//   changed by a submitter, new entries naming the submitting account; takedowns; maintainers.
// - --write-records adds exactly what is missing, never changing an entry.
// - --records-on-merge: a pull request's own missing records are notes (CI writes them when it
//   is merged); everything else still fails.
// - Reports: the Markdown for the pull request keeps pack text inside a fenced block.
// Sample: tests/fixtures/library/sample-library/ (Ann's pack pack-checker-good-1, and Bob's
// pack, saved by fmIDE, which shares Ann's Margin again).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { test, expect, fixture, ROOT } = require('./helpers/apps');
const { checkLibrary, writeRecords, formatLibraryReport, formatMarkdown, MARKDOWN_MAX } = require('../tools/check-library');

const SAMPLE = fixture('library', 'sample-library');
const CHECKER = path.join(ROOT, 'tools', 'check-pack.js');
const ANN_PACK = 'pack-checker-good-1';
const BOB_PACK = '06f097dd-fa44-4104-94ec-b29789a2b900';
const ANN = { login: 'ann-example', id: 1001 };
const BOB = { login: 'bob-sample', id: 1002 };
const MAINTAINER = { login: 'sample-maintainer', id: 1000 };
const CAROL = { login: 'carol-new', id: 1003 };
const DATE = '2026-10-01';
const RLO = String.fromCharCode(0x202E);

// A copy of the sample library in the test's own folder; `change(lib)` edits it.
function library(testInfo, name, change){
  const dir = testInfo.outputPath(name || 'library');
  fs.cpSync(SAMPLE, dir, { recursive: true });
  const lib = helpers(dir);
  if(change) change(lib);
  return dir;
}
function helpers(dir){
  const file = (p) => path.join(dir, p);
  const lib = {
    dir,
    read: (p) => JSON.parse(fs.readFileSync(file(p), 'utf8')),
    write: (p, data) => { fs.mkdirSync(path.dirname(file(p)), { recursive: true }); fs.writeFileSync(file(p), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); },
    remove: (p) => fs.rmSync(file(p), { recursive: true }),
    packPath: (id) => 'packs/' + id + '.fmide-pack.json',
    pack: (id) => lib.read(lib.packPath(id)),
    // Writes a pack under its id, and returns it.
    putPack: (pack) => { lib.write(lib.packPath(pack.pack.id), JSON.stringify(pack, null, 2)); return pack; },
    record: (name, key, change) => { const d = lib.read(name + '.json'); change(d[name][key], d[name]); lib.write(name + '.json', d); },
    // Removes Bob's pack and its records: the library before Bob's pull request.
    withoutBob: () => {
      lib.remove(lib.packPath(BOB_PACK));
      ['families', 'authors', 'packs'].forEach(k => {
        const d = lib.read(k + '.json');
        Object.keys(d[k]).forEach(key => { const e = d[k][key]; if(key === String(BOB.id) || e.accountId === BOB.id) delete d[k][key]; });
        lib.write(k + '.json', d);
      });
    }
  };
  return lib;
}
// A new pack by `author`, made from items of the sample packs.
function newPack(lib, id, author, items){
  return { kind: 'fmIDE-library-pack', version: 2,
    pack: { id, title: 'New pack ' + id, author, licence: 'CC-BY-4.0', created: '2026-10-01' },
    templates: items.templates || [], functions: items.functions || [] };
}
// Ann's Margin as a new version: another number, version id and formula.
function marginV2(lib){
  const m = lib.pack(ANN_PACK).functions.find(f => f.family === 'family-margin');
  return Object.assign({}, m, { version: 2, versionId: 'version-margin-2', text: 'Margin(Revenue, Cost) = 1 - Cost / Revenue', note: 'Simpler' });
}
const all = (r, kind) => r[kind || 'errors'].concat(...r.packs.map(p => p[kind || 'errors'].map(x => ({ where: p.file + ' / ' + x.where, message: x.message }))))
  .map(x => `${x.where}: ${x.message}`);
function expectError(r, re){
  expect(r.ok).toBe(false);
  expect(all(r).some(m => re.test(m)), all(r).join('\n') || '(no errors)').toBe(true);
}
function expectPass(r){
  expect(all(r), 'errors').toEqual([]);
  expect(r.ok).toBe(true);
}
// The pull request from `base` to `head` by `account`.
const pr = (head, base, account) => checkLibrary(head, { baseDir: base, account, date: DATE });

test.describe('a whole library', () => {
  test('the sample library passes, and Bob\'s copy of Ann\'s Margin is matched', () => {
    const r = checkLibrary(SAMPLE);
    expectPass(r);
    expect(all(r, 'warnings')).toEqual([]);
    expect(r.summary.packs).toBe(2);
    expect(r.summary.reshared).toEqual([{ pack: BOB_PACK, type: 'function', family: 'family-margin', version: 1, from: ANN_PACK }]);
    expect(r.recordsToAdd).toBeNull();
  });

  test('the layout: packs named after their ids, only packs in packs/, unknown files warned', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => {
      fs.renameSync(path.join(lib.dir, lib.packPath(BOB_PACK)), path.join(lib.dir, lib.packPath('some-other-name')));
      lib.write('packs/notes.txt', 'hello');
      lib.write('extra.md', 'hello');
    });
    const r = checkLibrary(dir);
    expectError(r, /some-other-name.fmide-pack.json \/ file: It must be named 06f097dd-.*\.fmide-pack\.json/);
    expectError(r, /packs\/notes\.txt: The packs folder holds only packs/);
    expect(all(r, 'warnings').join('\n')).toMatch(/extra\.md: The library doesn't use this file/);
  });

  test('a pack outside packs/ is refused, even from a maintainer (it would never be checked)', ({}, testInfo) => {
    // As in the library's first real pull request: the file uploaded at the top.
    const base = library(testInfo, 'base', lib => lib.withoutBob());
    const head = library(testInfo, 'head', lib => {
      lib.withoutBob();
      fs.copyFileSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, 'Markups.fmide-pack.json'));
      fs.mkdirSync(path.join(lib.dir, '.github'));
      fs.copyFileSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, '.github', 'renamed.json'));
    });
    for(const account of [BOB, MAINTAINER]){
      const r = pr(head, base, account);
      expectError(r, /^Markups\.fmide-pack\.json: It is a library pack outside the packs folder\. Every pack goes in packs\/, named after its pack id/);
      expectError(r, /^\.github\/renamed\.json: It is a library pack outside the packs folder/);
    }
    // Other JSON files there are not packs.
    const other = checkLibrary(library(testInfo, 'other', lib => lib.write('.github/settings.json', { kind: 'something-else' })));
    expect(all(other).join('\n')).not.toMatch(/settings\.json/);
  });

  test('a pack that fails the one-pack check fails the library', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => { const p = lib.pack(BOB_PACK); p.pack.licence = 'MIT'; lib.putPack(p); });
    expectError(checkLibrary(dir), /licence/);
  });

  test('records: malformed entries, a wrong hash, other version ids, a missing author', ({}, testInfo) => {
    expectError(checkLibrary(library(testInfo, 'a', lib => lib.record('families', 'family-margin', e => { e.type = 'macro'; }))), /families\.json: Its entry "family-margin" has a "type" that isn't/);
    expectError(checkLibrary(library(testInfo, 'b', lib => lib.record('packs', ANN_PACK, e => { e.sha256 = '0'.repeat(64); }))), /pack-checker-good-1.fmide-pack.json: The file isn't the one approved: its hash differs/);
    expectError(checkLibrary(library(testInfo, 'c', lib => lib.record('packs', ANN_PACK, e => { e.versions.pop(); }))), /lists other version ids than the pack holds/);
    expectError(checkLibrary(library(testInfo, 'd', lib => lib.record('authors', String(BOB.id), (e, all) => { delete all[String(BOB.id)]; }))), /The account bob-sample \(1002\) has no author name in authors\.json/);
    expectError(checkLibrary(library(testInfo, 'e', lib => lib.write('packs.json', '{ nope'))), /packs\.json: It isn't valid JSON/);
    expectError(checkLibrary(library(testInfo, 'f', lib => lib.record('families', 'family-margin', e => { e.firstPack = BOB_PACK; }))), /family-margin is recorded for the account ann-example, but its first pack is bob-sample's/);
    expectError(checkLibrary(library(testInfo, 'g', lib => lib.write('checker.json', { kind: 'fmIDE-library-checker', version: 1, fmide: { repository: 'x/fmide', commit: 'main' }, maintainers: [] }))), /never a branch/);
  });

  test('a pack without records: the records to add are worked out, for the submitting account', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => lib.withoutBob());
    fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(dir, 'packs', BOB_PACK + '.fmide-pack.json'));
    const noAccount = checkLibrary(dir);
    expectError(noAccount, /no record in packs\.json\. Run the checker with --account/);
    const r = checkLibrary(dir, { account: BOB, date: DATE });
    expect(r.ok).toBe(false);
    expect(r.errors.every(e => e.missing)).toBe(true);
    const sampleRecords = helpers(SAMPLE);
    expect(r.recordsToAdd.packs[BOB_PACK]).toEqual(Object.assign({}, sampleRecords.read('packs.json').packs[BOB_PACK], { added: DATE }));
    expect(r.recordsToAdd.authors).toEqual({ [String(BOB.id)]: { account: 'bob-sample', author: 'Bob Sample', added: DATE } });
    // Only Bob's own new family is claimed: Ann's Margin, shared again, stays hers.
    expect(Object.keys(r.recordsToAdd.families)).toEqual(['27ba4bf7-abd0-46ab-8138-0cb706a638e1']);
    expect(r.summary.newFamilies).toEqual([{ family: '27ba4bf7-abd0-46ab-8138-0cb706a638e1', type: 'function', kind: undefined, pack: BOB_PACK, account: 'bob-sample' }]);
  });
});

test.describe('the family rule and sharing again', () => {
  test('the owner adds a version to a family; someone else can\'t', ({}, testInfo) => {
    const own = library(testInfo, 'own', lib => {
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { functions: [marginV2(lib)] }));
    });
    const byAnn = checkLibrary(own, { account: ANN, date: DATE });
    expect(byAnn.errors.every(e => e.missing), all(byAnn).join('\n')).toBe(true);
    expect(Object.keys(byAnn.recordsToAdd.families)).toEqual([]);   // no new family: it is Ann's
    const other = library(testInfo, 'other', lib => {
      lib.putPack(newPack(lib, 'bob-second-pack', 'Bob Sample', { functions: [marginV2(lib)] }));
    });
    expectError(checkLibrary(other, { account: BOB, date: DATE }), /function "Margin" v2: Its family belongs to the account ann-example \(first shared in the pack pack-checker-good-1\); only a family's owner adds versions/);
  });

  test('sharing again: only an exact copy of the version in the pack its origin names', ({}, testInfo) => {
    const edit = (name, change) => checkLibrary(library(testInfo, name, lib => {
      const p = lib.pack(BOB_PACK);
      change(p.functions.find(f => f.family === 'family-margin'), lib);
      lib.putPack(p);
      lib.record('packs', BOB_PACK, e => { e.sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(lib.dir, lib.packPath(BOB_PACK)))).digest('hex'); });
    }));
    expectError(edit('text', f => { f.description = 'Changed by Bob'; }), /function "Margin" v1: It isn't an exact copy of the version approved in the pack pack-checker-good-1/);
    expectError(edit('title', f => { f.origin.packTitle = 'Another title'; }), /Its origin doesn't match the pack pack-checker-good-1/);
    expectError(edit('nowhere', f => { f.origin.packId = 'not-in-the-library'; }), /came from the pack not-in-the-library .* which isn't in the library/);
    // Without its origin, Ann's version counts as Bob's own work in Ann's family.
    expectError(edit('no-origin', f => { delete f.origin; }), /Its family belongs to the account ann-example/);
  });

  test('ids are never used again: version ids, version numbers, one family one kind', ({}, testInfo) => {
    const reuseId = checkLibrary(library(testInfo, 'vid', lib => {
      const f = marginV2(lib); f.versionId = 'version-margin-1';
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { functions: [f] }));
    }), { account: ANN, date: DATE });
    expectError(reuseId, /Its version id is already used by .*a different version/);
    const reuseNumber = checkLibrary(library(testInfo, 'num', lib => {
      const f = marginV2(lib); f.version = 1;
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { functions: [f] }));
    }), { account: ANN, date: DATE });
    expectError(reuseNumber, /Version 1 of this family is already in the library as a different version/);
    const kind = checkLibrary(library(testInfo, 'kind', lib => {
      const t = lib.pack(ANN_PACK).templates.find(x => x.name === 'Margins model');
      const f = Object.assign({}, marginV2(lib), { family: t.family });
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { functions: [f] }));
    }), { account: ANN, date: DATE });
    expectError(kind, /Its family is recorded as a system template in families\.json; one family is one kind/);
  });

  test('the owner may repeat an approved version of their own (a note)', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => {
      const m = lib.pack(ANN_PACK).functions.find(f => f.family === 'family-margin');
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { functions: [m, marginV2(lib)] }));
    });
    const r = checkLibrary(dir, { account: ANN, date: DATE });
    expect(r.errors.every(e => e.missing), all(r).join('\n')).toBe(true);
    expect(all(r, 'notes').join('\n')).toMatch(/ann-second-pack: function "Margin" v1: It is already in the library \(pack pack-checker-good-1/);
  });

  test('the author name: the account\'s own, and one name for one account', ({}, testInfo) => {
    const wrongName = checkLibrary(library(testInfo, 'a', lib => {
      lib.putPack(newPack(lib, 'ann-second-pack', 'Annie', { functions: [marginV2(lib)] }));
    }), { account: ANN, date: DATE });
    expectError(wrongName, /Its author, "Annie", isn't the name the account ann-example shares under \("Ann Example"\)/);
    // Capitals and spaces don't make another name.
    const sameName = checkLibrary(library(testInfo, 'b', lib => {
      lib.putPack(newPack(lib, 'ann-second-pack', 'ann  example', { functions: [marginV2(lib)] }));
    }), { account: ANN, date: DATE });
    expect(sameName.errors.every(e => e.missing), all(sameName).join('\n')).toBe(true);
    const taken = checkLibrary(library(testInfo, 'c', lib => {
      const f = Object.assign({}, marginV2(lib), { family: 'carol-family-1', version: 1, versionId: 'carol-version-1', text: 'Share(Part, Whole) = Part / Whole' });
      lib.putPack(newPack(lib, 'carol-first-pack', 'Ann Example', { functions: [f] }));
    }), { account: CAROL, date: DATE });
    expectError(taken, /Its author name, "Ann Example", belongs to another account \(ann-example\)/);
  });
});

test.describe('a pull request', () => {
  const bobPR = (testInfo, changeHead) => {
    const base = library(testInfo, 'base', lib => lib.withoutBob());
    const head = library(testInfo, 'head', changeHead);
    return { base, head };
  };

  test('Bob\'s submission with its records passes; the summary says what it claims', ({}, testInfo) => {
    const { base, head } = bobPR(testInfo);
    const r = pr(head, base, BOB);
    expectPass(r);
    expect(r.mode).toBe('pull-request');
    expect(r.summary.newPacks.map(p => p.id)).toEqual([BOB_PACK]);
    expect(r.summary.newFamilies.map(f => f.family)).toEqual(['27ba4bf7-abd0-46ab-8138-0cb706a638e1']);
    expect(r.summary.newAuthors).toEqual([{ accountId: BOB.id, account: 'bob-sample' }]);
    expect(formatLibraryReport(r)).toMatch(/Submitted by the GitHub account bob-sample \(id 1002\)[\s\S]*this pull request adds 1 pack[\s\S]*Claims the function family 27ba4bf7-abd0-46ab-8138-0cb706a638e1 for bob-sample/);
  });

  test('the same pack submitted by another account is refused', ({}, testInfo) => {
    const { base, head } = bobPR(testInfo);
    expectError(pr(head, base, CAROL), /new entry .* names the account bob-sample, not the one submitting \(carol-new\)/);
  });

  test('a submission without its records lists the entries to add', ({}, testInfo) => {
    const base = library(testInfo, 'base', lib => lib.withoutBob());
    const head = library(testInfo, 'head', lib => { lib.withoutBob(); fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, lib.packPath(BOB_PACK))); });
    const r = pr(head, base, BOB);
    expectError(r, /The pack has no record in packs\.json/);
    expect(Object.keys(r.recordsToAdd.packs)).toEqual([BOB_PACK]);
    expect(formatMarkdown(r)).toMatch(/Records are missing/);
  });

  // --records-on-merge: the library's CI writes the records once the pull request is merged.
  const bobWithoutRecords = (testInfo) => ({
    base: library(testInfo, 'base', lib => lib.withoutBob()),
    head: library(testInfo, 'head', lib => { lib.withoutBob(); fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, lib.packPath(BOB_PACK))); }),
  });
  test('with --records-on-merge, a submission without its records passes; they are listed, to be written when merged', ({}, testInfo) => {
    const { base, head } = bobWithoutRecords(testInfo);
    const r = checkLibrary(head, { baseDir: base, account: BOB, date: DATE, recordsOnMerge: true });
    expectPass(r);
    expect(r.recordsOnMerge).toBe(true);
    // The pack, the new family and the new author: notes now, not errors.
    expect(r.notes.filter(n => n.missing).map(n => n.message).join('\n')).toMatch(/The pack has no record in packs\.json\. It is added automatically when the pull request is merged\.[\s\S]*no author name[\s\S]*no record in families\.json/);
    expect(Object.keys(r.recordsToAdd.packs)).toEqual([BOB_PACK]);
    expect(Object.keys(r.recordsToAdd.authors)).toEqual([String(BOB.id)]);
    expect(formatLibraryReport(r)).toMatch(/Records added automatically when the pull request is merged:/);
    expect(formatMarkdown(r)).toMatch(/^## Library check: PASSED ✅[\s\S]*added automatically when the pull request is merged; nobody edits them by hand/);
    expect(formatMarkdown(r)).not.toMatch(/Records are missing/);
  });
  test('with --records-on-merge, every other problem still fails, and so does a record missing for a pack already there', ({}, testInfo) => {
    const { base, head } = bobWithoutRecords(testInfo);
    // Bob already shares under "Bob Sample"; Carol submits his pack under that name.
    const bobAuthor = helpers(SAMPLE).read('authors.json').authors[String(BOB.id)];
    [base, head].forEach(d => { const lib = helpers(d), a = lib.read('authors.json'); a.authors[String(BOB.id)] = bobAuthor; lib.write('authors.json', a); });
    expectError(checkLibrary(head, { baseDir: base, account: CAROL, date: DATE, recordsOnMerge: true }), /author name, "Bob Sample", belongs to another account \(bob-sample\)/);
    // The submitter changes a file only maintainers change.
    const other = bobWithoutRecords({ outputPath: (n) => testInfo.outputPath('o-' + n) });
    fs.appendFileSync(path.join(other.head, 'README.md'), '\nchanged\n');
    expectError(checkLibrary(other.head, { baseDir: other.base, account: BOB, date: DATE, recordsOnMerge: true }), /README\.md: It is changed by the pull request/);
    // Ann's pack lost its record before the pull request: still an error.
    const lost = bobWithoutRecords({ outputPath: (n) => testInfo.outputPath('l-' + n) });
    [lost.base, lost.head].forEach(d => helpers(d).record('packs', ANN_PACK, (e, all) => { delete all[ANN_PACK]; }));
    const r = checkLibrary(lost.head, { baseDir: lost.base, account: BOB, date: DATE, recordsOnMerge: true });
    expectError(r, new RegExp('packs/' + ANN_PACK + '\\.fmide-pack\\.json: The pack has no record in packs\\.json'));
    expect(r.errors.some(e => e.where === 'packs/' + BOB_PACK + '.fmide-pack.json')).toBe(false);
  });

  test('records are only added: a changed or removed entry is refused', ({}, testInfo) => {
    const { base, head } = bobPR(testInfo, lib => lib.record('families', 'family-margin', e => { e.accountId = BOB.id; e.account = 'bob-sample'; }));
    expectError(pr(head, base, BOB), /families\.json: The pull request changes the entry "family-margin"; records are only ever added/);
    const removed = bobPR({ outputPath: (n) => testInfo.outputPath('r-' + n) }, lib => lib.record('authors', String(ANN.id), (e, all) => { delete all[String(ANN.id)]; }));
    expectError(pr(removed.head, removed.base, BOB), /authors\.json: The pull request removes the entry "1001"/);
  });

  test('approved packs are never edited', ({}, testInfo) => {
    const { base, head } = bobPR(testInfo, lib => { lib.write(lib.packPath(ANN_PACK), fs.readFileSync(path.join(SAMPLE, lib.packPath(ANN_PACK)), 'utf8') + '\n'); });
    expectError(pr(head, base, BOB), /pack-checker-good-1\.fmide-pack\.json: An approved pack is never edited/);
  });

  test('a pack id taken down is never used again', ({}, testInfo) => {
    // Main: Ann's pack was taken down (its records stay). The pull request adds it again.
    const base = library(testInfo, 'base', lib => { lib.withoutBob(); lib.remove(lib.packPath(ANN_PACK)); });
    const head = library(testInfo, 'head', lib => lib.withoutBob());
    const r = pr(head, base, ANN);
    expectError(r, /The pack id pack-checker-good-1 was used before/);
    expect(all(checkLibrary(base), 'notes').join('\n')).toMatch(/The pack pack-checker-good-1 has a record but no file: it was taken down/);
    // Its versions can't be shared again either.
    const reshare = checkLibrary(library(testInfo, 'reshare', lib => lib.remove(lib.packPath(ANN_PACK))));
    expectError(reshare, /came from the pack pack-checker-good-1, which was taken down/);
    // Nor put in a new pack by its owner.
    const again = checkLibrary(library(testInfo, 'again', lib => {
      const income = lib.pack(ANN_PACK).templates.find(t => t.name === 'Income Statement');
      lib.remove(lib.packPath(ANN_PACK));
      lib.putPack(newPack(lib, 'ann-second-pack', 'Ann Example', { templates: [income] }));
    }), { account: ANN, date: DATE });
    expectError(again, /template "Income Statement" v1: Its version id was used in the pack pack-checker-good-1, which was taken down/);
  });

  test('a submitter changes only packs and records; checker.json and .github are the maintainers\'', ({}, testInfo) => {
    const { base, head } = bobPR(testInfo, lib => {
      lib.record('packs', BOB_PACK, () => {});
      const c = lib.read('checker.json'); c.fmide.commit = 'f'.repeat(40); lib.write('checker.json', c);
      lib.write('.github/workflows/check.yml', 'name: nothing');
    });
    const r = pr(head, base, BOB);
    expectError(r, /checker\.json: It is changed by the pull request; only the library's maintainers change its own files/);
    expectError(r, /\.github\/workflows\/check\.yml: It is added by the pull request/);
  });

  test('a takedown: a warning, alone; mixed with a submission, an error', ({}, testInfo) => {
    const base = library(testInfo, 'base');
    const head = library(testInfo, 'head', lib => lib.remove(lib.packPath(BOB_PACK)));
    const r = pr(head, base, MAINTAINER);
    expect(r.ok, all(r).join('\n')).toBe(true);
    expect(r.summary.takedowns).toEqual([BOB_PACK]);
    expect(all(r, 'warnings').join('\n')).toMatch(/removes this pack: a takedown/);
    const mixedBase = library(testInfo, 'mbase', lib => lib.withoutBob());
    const mixedHead = library(testInfo, 'mhead', lib => {
      lib.remove(lib.packPath(ANN_PACK));
    });
    expectError(pr(mixedHead, mixedBase, BOB), /removes packs and adds packs; a takedown is a pull request of its own/);
  });

  test('a maintainer\'s change of records alone is a warning; mixed with packs, an error', ({}, testInfo) => {
    const base = library(testInfo, 'base');
    const head = library(testInfo, 'head', lib => lib.record('families', 'family-margin', e => { e.accountId = BOB.id; e.account = 'bob-sample'; }));
    const byMaintainer = pr(head, base, MAINTAINER);
    expect(all(byMaintainer, 'warnings').join('\n')).toMatch(/changes the entry "family-margin"[\s\S]*A maintainer's change of records/);
    expect(all(byMaintainer).join('\n')).not.toMatch(/records are only ever added/);
    expectError(pr(head, base, BOB), /records are only ever added/);
    // The maintainers are read from main, never from the pull request.
    const sneaky = library(testInfo, 'sneaky', lib => {
      const c = lib.read('checker.json'); c.maintainers.push({ accountId: BOB.id, account: 'bob-sample' }); lib.write('checker.json', c);
      lib.record('families', 'family-margin', e => { e.accountId = BOB.id; e.account = 'bob-sample'; });
    });
    expectError(pr(sneaky, base, BOB), /records are only ever added/);
  });
});

test.describe('writing the records', () => {
  test('--write-records adds exactly what is missing, sorted, and changes nothing else', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => { lib.withoutBob(); fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, lib.packPath(BOB_PACK))); });
    const before = helpers(dir).read('families.json');
    const w = writeRecords(dir, { account: BOB, date: '2026-09-28' });
    expect(w.written).toBe(true);
    expectPass(w.report);
    // The result is the sample library, byte for byte.
    ['families.json', 'authors.json', 'packs.json'].forEach(f => {
      expect(fs.readFileSync(path.join(dir, f), 'utf8'), f).toBe(fs.readFileSync(path.join(SAMPLE, f), 'utf8'));
    });
    Object.keys(before.families).forEach(k => expect(helpers(dir).read('families.json').families[k]).toEqual(before.families[k]));
    // Twice: nothing more to add.
    const again = writeRecords(dir, { account: BOB, date: '2026-09-29' });
    expect(again.written).toBe(false);
    expect(again.reason).toMatch(/No records are missing/);
  });

  test('it refuses when anything else is wrong, and needs the account', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => {
      lib.withoutBob();
      const p = JSON.parse(fs.readFileSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), 'utf8'));
      p.functions[0].description = 'Changed';     // fine on its own…
      p.functions[1].description = 'Changed';     // …but Ann's Margin is no longer an exact copy
      lib.putPack(p);
    });
    const before = fs.readFileSync(path.join(dir, 'families.json'), 'utf8');
    const w = writeRecords(dir, { account: BOB, date: DATE });
    expect(w.written).toBe(false);
    expect(w.reason).toMatch(/errors other than missing records/);
    expect(fs.readFileSync(path.join(dir, 'families.json'), 'utf8')).toBe(before);
    expect(writeRecords(dir, {}).reason).toMatch(/The submitting account is needed/);
  });
});

test.describe('reports', () => {
  test('the Markdown keeps pack text inside a fenced block, where nothing renders', ({}, testInfo) => {
    const hostile = '```\n~~~~\n# Heading @owner <img src=x onerror=alert(1)> [link](https://example.com) ![i](https://example.com/i.png) ' + RLO + 'txt';
    const dir = library(testInfo, 'lib', lib => {
      lib.withoutBob();
      const p = JSON.parse(fs.readFileSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), 'utf8'));
      p.pack.title = hostile.replace(/\n/g, ' ');                           // shown in the report
      p.functions[0].text = p.functions[0].text.replace('Markup', 'Markup`~~~~`@owner');   // a formula quoted by the parser
      lib.putPack(p);
    });
    const md = formatMarkdown(checkLibrary(dir, { account: BOB, date: DATE }));
    const lines = md.split('\n');
    const open = lines.indexOf('~~~~text'), close = lines.lastIndexOf('~~~~');
    expect(open).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(open);
    // Exactly one fence opens and closes; no line inside could close it.
    expect(lines.filter(l => /^\s{0,3}(~~~|```)/.test(l))).toEqual(['~~~~text', '~~~~']);
    const inside = lines.slice(open + 1, close).join('\n'), outside = lines.slice(0, open).concat(lines.slice(close + 1)).join('\n');
    expect(inside).not.toMatch(/[`~]/);
    expect(inside).not.toContain(RLO);
    expect(inside).toContain('\\u0060\\u0060\\u0060');
    // Outside the fence: only the checker's words, numbers, ids and the account.
    expect(outside).not.toMatch(/@owner|<img|example\.com|Heading/);
    expect(outside).toMatch(/^## Library check: FAILED ❌/);
    expect(outside).toMatch(/Submitted by the GitHub account bob-sample \(id 1002\)/);
  });

  test('a long report is cut to fit a pull-request comment', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => {
      for(let i = 0; i < 40; i++) lib.write(`packs/junk-file-${String(i).padStart(3, '0')}-${'x'.repeat(40)}.txt`, 'x');
      for(let i = 0; i < 400; i++) lib.write(`unknown-${i}-${'y'.repeat(100)}.md`, 'y');
    });
    const md = formatMarkdown(checkLibrary(dir));
    expect(md.length).toBeLessThanOrEqual(MARKDOWN_MAX);
    expect(md).toMatch(/cut short; the whole report is in the job's log\)\n~~~~\n/);
  });
});

test.describe('the command', () => {
  const run = (args) => spawnSync(process.execPath, [CHECKER].concat(args), { encoding: 'utf8' });
  test('exit codes, --json and --markdown, and the options it needs', ({}, testInfo) => {
    const ok = run(['--library', SAMPLE]);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/^Checking the library\n  2 packs in the library[\s\S]*Result: PASSED — 0 errors, 0 warnings\./);
    const json = JSON.parse(run(['--library', SAMPLE, '--json']).stdout);
    expect(json).toMatchObject({ ok: true, mode: 'library', summary: { packs: 2 } });
    const base = library(testInfo, 'base', lib => lib.withoutBob());
    const md = run(['--library', SAMPLE, '--base', base, '--account', 'bob-sample', '--account-id', '1002', '--markdown']);
    expect(md.status, md.stderr).toBe(0);
    expect(md.stdout).toMatch(/^## Library check: PASSED ✅/);
    const refused = run(['--library', SAMPLE, '--base', base, '--account', 'carol-new', '--account-id', '1003']);
    expect(refused.status).toBe(1);
    expect(run(['--library', SAMPLE, '--account', 'bob-sample']).status).toBe(2);             // no id
    expect(run(['--library', SAMPLE, '--account', 'not a login', '--account-id', '5']).status).toBe(2);
    expect(run(['--library', SAMPLE, '--date', '2026-02-30']).status).toBe(2);
    expect(run(['--library', testInfo.outputPath('missing')]).status).toBe(2);
    expect(run(['--library', SAMPLE, '--json', '--markdown']).status).toBe(2);
    expect(run(['--library', SAMPLE, '--base', base, '--write-records', '--account', 'bob-sample', '--account-id', '1002']).status).toBe(2);
    expect(run(['--library', SAMPLE, '--nope']).status).toBe(2);
    expect(run(['--library', SAMPLE, '--records-on-merge']).status).toBe(2);              // a pull request only
  });
  test('--write-records from the command', ({}, testInfo) => {
    const dir = library(testInfo, 'lib', lib => { lib.withoutBob(); fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, lib.packPath(BOB_PACK))); });
    const w = run(['--library', dir, '--write-records', '--account', 'bob-sample', '--account-id', '1002', '--date', '2026-09-28']);
    expect(w.status, w.stdout + w.stderr).toBe(0);
    expect(w.stderr).toMatch(/Added records to families\.json, authors\.json, packs\.json/);
    expect(fs.readFileSync(path.join(dir, 'packs.json'), 'utf8')).toBe(fs.readFileSync(path.join(SAMPLE, 'packs.json'), 'utf8'));
  });
  test('--records-on-merge from the command: passes, then --write-records after the merge leaves a library that passes', ({}, testInfo) => {
    const base = library(testInfo, 'base', lib => lib.withoutBob());
    const head = library(testInfo, 'head', lib => { lib.withoutBob(); fs.cpSync(path.join(SAMPLE, 'packs', BOB_PACK + '.fmide-pack.json'), path.join(lib.dir, lib.packPath(BOB_PACK))); });
    const without = run(['--library', head, '--base', base, '--account', 'bob-sample', '--account-id', '1002']);
    expect(without.status).toBe(1);
    const md = run(['--library', head, '--base', base, '--account', 'bob-sample', '--account-id', '1002', '--records-on-merge', '--markdown']);
    expect(md.status, md.stdout + md.stderr).toBe(0);
    expect(md.stdout).toMatch(/^## Library check: PASSED ✅/);
    // Merged: main holds the pack without records until CI writes them.
    expect(run(['--library', head]).status).toBe(1);
    const w = run(['--library', head, '--write-records', '--account', 'bob-sample', '--account-id', '1002', '--date', '2026-09-28']);
    expect(w.status, w.stdout + w.stderr).toBe(0);
    expect(run(['--library', head]).status).toBe(0);
  });
});
