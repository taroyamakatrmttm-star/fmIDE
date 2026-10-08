#!/usr/bin/env node
// Splits the test suite into parts of about the same running time, for GitHub's run in parts
// at once (.github/workflows/tests.yml). Playwright's own --shard cuts the list of tests into
// even runs by count, so the slow groups (LibreOffice's agreement checks, the video recording)
// pile up in some parts while others finish early. This spreads whole test files instead, by
// how long each took in a measured run (tests/test-durations.json): the longest first, each
// into the part with the least time so far. Every test file goes into exactly one part — a
// file not in the table (a new group) counts as an average one — so nothing is ever left out.
//
//   node tools/test-parts.js PART COUNT      the files of part PART (1…COUNT), one per line
//   node tools/test-parts.js --show COUNT    each part's files and expected time
//   node tools/test-parts.js --measure LOG   rewrite tests/test-durations.json from the log of
//                                            a GitHub run (Playwright's list lines, "(1.2s)")
// Node only, no packages.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const DURATIONS = path.join(TESTS, 'test-durations.json');

function fail(msg){
  console.error('test-parts: ' + msg);
  process.exit(2);
}

function testFiles(){
  return fs.readdirSync(TESTS).filter(f => f.endsWith('.spec.js')).sort();
}

function readDurations(){
  if(!fs.existsSync(DURATIONS)) return {};
  const data = JSON.parse(fs.readFileSync(DURATIONS, 'utf8'));
  const out = {};
  Object.keys(data).forEach(f => { if(typeof data[f] === 'number' && data[f] >= 0) out[f] = data[f]; });
  return out;
}

// The files split into `count` parts: [{ files, seconds }]. The same files and durations always
// give the same parts (ties broken by file name).
function splitIntoParts(files, durations, count){
  if(!Number.isInteger(count) || count < 1) throw new Error('the number of parts must be a whole number from 1');
  const known = files.filter(f => f in durations);
  const average = known.length ? known.reduce((s, f) => s + durations[f], 0) / known.length : 1;
  const weight = (f) => (f in durations ? durations[f] : average);
  const parts = Array.from({ length: count }, () => ({ files: [], seconds: 0 }));
  files.slice().sort((a, b) => (weight(b) - weight(a)) || (a < b ? -1 : 1)).forEach(f => {
    let best = parts[0];
    parts.forEach(p => { if(p.seconds < best.seconds) best = p; });
    best.files.push(f);
    best.seconds += weight(f);
  });
  parts.forEach(p => p.files.sort());
  return parts;
}

// Seconds per test file from a GitHub run's log: every "› tests/NAME.spec.js:L:C › … (12.3s)".
function durationsFromLog(text){
  const out = {};
  const line = /›\s+tests\/([\w.-]+\.spec\.js):\d+:\d+ › .*\((\d+(?:\.\d+)?)(ms|s|m)\)\s*$/;
  text.split('\n').forEach(l => {
    const m = line.exec(l);
    if(!m) return;
    const v = Number(m[2]);
    const s = m[3] === 'ms' ? v / 1000 : m[3] === 'm' ? v * 60 : v;
    out[m[1]] = (out[m[1]] || 0) + s;
  });
  Object.keys(out).forEach(f => { out[f] = Math.round(out[f] * 10) / 10; });
  return out;
}

module.exports = { splitIntoParts, durationsFromLog, testFiles, readDurations };

if(require.main === module){
  const argv = process.argv.slice(2);
  if(argv[0] === '--measure'){
    if(!argv[1]) fail('--measure needs the log file');
    const found = durationsFromLog(fs.readFileSync(argv[1], 'utf8'));
    if(!Object.keys(found).length) fail('no test durations found in ' + argv[1]);
    const sorted = {};
    Object.keys(found).sort().forEach(f => { sorted[f] = found[f]; });
    fs.writeFileSync(DURATIONS, JSON.stringify(sorted, null, 1) + '\n');
    console.log('wrote ' + path.relative(ROOT, DURATIONS) + ': ' + Object.keys(sorted).length + ' files');
  } else if(argv[0] === '--show'){
    const parts = splitIntoParts(testFiles(), readDurations(), Number(argv[1] || 4));
    parts.forEach((p, i) => console.log('part ' + (i + 1) + ': about ' + Math.round(p.seconds) + ' s of tests, ' + p.files.length + ' files\n  ' + p.files.join('\n  ')));
  } else {
    const part = Number(argv[0]), count = Number(argv[1]);
    if(!Number.isInteger(part) || !Number.isInteger(count) || part < 1 || part > count) fail('usage: node tools/test-parts.js PART COUNT (1 ≤ PART ≤ COUNT)');
    const files = splitIntoParts(testFiles(), readDurations(), count)[part - 1].files;
    // An empty part would make Playwright run every test: never print nothing.
    if(!files.length) fail('part ' + part + ' of ' + count + ' has no test files; use fewer parts');
    console.log(files.map(f => 'tests/' + f).join('\n'));
  }
}
