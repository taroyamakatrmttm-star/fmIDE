// 66. The test suite's parts for GitHub's run in parts at once (tools/test-parts.js): every test
// file in exactly one part, the parts about equal in time, the same parts every time, a new
// group placed too, a part never empty, and the durations read from a run's log. Node only.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect, ROOT } = require('./helpers/apps');
const { splitIntoParts, durationsFromLog, testFiles, readDurations } = require('../tools/test-parts.js');

const TOOL = path.join(ROOT, 'tools', 'test-parts.js');
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });

test('the 4 parts hold every test file exactly once, about equal in time', () => {
  const files = testFiles();
  expect(files.length).toBeGreaterThan(60);
  const parts = splitIntoParts(files, readDurations(), 4);
  const all = parts.flatMap(p => p.files);
  expect(all.slice().sort()).toEqual(files);
  expect(new Set(all).size).toBe(all.length);
  const secs = parts.map(p => p.seconds);
  // The parts end close together: the longest at most a quarter more than the shortest.
  expect(Math.max(...secs)).toBeLessThanOrEqual(Math.min(...secs) * 1.25);
  // Nearly every file is in the measured table (a new group counts as an average one until
  // the table is refreshed with --measure).
  expect(files.filter(f => !(f in readDurations())).length).toBeLessThanOrEqual(3);
});

test('the command prints each part\'s files, the same every time, and they add up to the whole suite', () => {
  const printed = [1, 2, 3, 4].map(i => {
    const r = run(String(i), '4');
    expect(r.status).toBe(0);
    return r.stdout.trim().split('\n');
  });
  expect([1, 2, 3, 4].map(i => run(String(i), '4').stdout.trim().split('\n'))).toEqual(printed);
  const all = printed.flat();
  expect(all.slice().sort()).toEqual(testFiles().map(f => 'tests/' + f));
  // Playwright reads each as a pattern: no file's path may hold another's, or a part would run
  // more than its own files.
  for(const p of all) expect(all.filter(q => q.includes(p)), p).toEqual([p]);
});

test('a new group goes in as an average one; a part with nothing to run is refused', () => {
  const durations = { 'a.spec.js': 100, 'b.spec.js': 50, 'c.spec.js': 50 };
  const parts = splitIntoParts(['a.spec.js', 'b.spec.js', 'c.spec.js', 'new.spec.js'], durations, 2);
  // new counts 66.7 s (the average): a (100) | new, then b joins new (66.7 < 100), c joins a.
  expect(parts.map(p => p.files)).toEqual([['a.spec.js', 'c.spec.js'], ['b.spec.js', 'new.spec.js']]);
  expect(parts[1].seconds).toBeCloseTo(50 + 200 / 3, 5);
  expect(() => splitIntoParts(['a.spec.js'], durations, 0)).toThrow(/whole number/);
  let r = run('5', '4');
  expect(r.status).toBe(2);
  expect(r.stderr).toMatch(/usage/);
  r = run('80', '80');
  expect(r.status).toBe(2);
  expect(r.stderr).toMatch(/part 80 of 80 has no test files/);
});

test('the durations come from a run\'s log, file by file', () => {
  const log = [
    '2026-10-08T00:01:00Z   ✓  1 [chromium] › tests/1-a.spec.js:10:3 › one (1.5s)',
    '2026-10-08T00:01:01Z   ✓  2 [chromium] › tests/1-a.spec.js:20:3 › two › nested (250ms)',
    '2026-10-08T00:01:02Z   ✓  3 [chromium] › tests/2-b.spec.js:5:1 › a long one (1.2m)',
    'something else (3s)',
  ].join('\n');
  expect(durationsFromLog(log)).toEqual({ '1-a.spec.js': 1.8, '2-b.spec.js': 72 });
});
