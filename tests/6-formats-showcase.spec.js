// 6. The showcase file (kind fmIDE-showcase, version 1; src/shared/showcase.js), read in Node:
// both forms, every limit, hostile values cleaned or refused with a message, another kind
// refused, a newer version flagged. Phase V1 of docs/viewer-brief.md.
const { test, expect, readFixture } = require('./helpers/apps');
const S = require('../src/shared/showcase.js');

const plain = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v) ||
  (Array.isArray(v) ? v.every(plain) : typeof v === 'object' && Object.values(v).every(plain));

test('a showcase for one model is read whole, as it was written', () => {
  const r = S.readShowcaseData(readFixture('formats', 'showcase-v1.json'));
  expect(r.error).toBeUndefined();
  expect([r.fromVersion, r.newer, r.recipe]).toEqual([1, false, false]);
  const c = S.cleanShowcase(r.data);
  expect(c.problems).toEqual([]);
  expect(c.value).toMatchObject({ kind: 'fmIDE-showcase', version: 1, id: 'loan-basics', title: 'How a loan is repaid', author: 'A teacher',
    licence: 'CC BY 4.0', mark: false, canvases: { show: ['c1', 'c3'], start: 'c3' }, play: { from: 'Base', to: 'High rate' },
    periods: { mode: 'range', from: 0, to: 9 }, excel: { file: 'Loan basics.xlsx' } });
  expect(c.value.boards).toMatchObject({ kind: 'fmIDE-graph-board', version: 12 });
  // Left out, the mark shows and every canvas is listed.
  const bare = S.cleanShowcase(S.readShowcaseData({ kind: 'fmIDE-showcase', version: 1 }).data);
  expect(bare.problems).toEqual([]);
  expect(bare.value).toMatchObject({ mark: true, id: null, title: '', canvases: { show: null, start: null }, boards: null, periods: null, excel: null });
});

test('the recipe form is read, and its boards must be the template form', () => {
  const r = S.readShowcaseData(readFixture('formats', 'showcase-recipe-v1.json'));
  expect(r.recipe).toBe(true);
  const c = S.cleanShowcaseRecipe(r.data);
  expect(c.problems).toEqual([]);
  expect(c.value).toMatchObject({ form: 'recipe', title: '{model}', auto: { sliders: 'inputs', bars: 'outputs', range: 50 } });
  expect(c.value.boards).toMatchObject({ kind: 'fmIDE-graph-board', form: 'template' });
  const wrong = S.cleanShowcaseRecipe({ boards: { kind: 'fmIDE-graph-board', version: 12, boards: [] }, auto: { sliders: 'all', range: 500 } });
  expect(wrong.value.boards).toBeNull();
  expect(wrong.value.auto).toEqual({ sliders: null, bars: null, range: 50 });
  expect(wrong.problems.length).toBe(3);
  // And the template form is refused for one model.
  expect(S.cleanShowcase({ boards: { kind: 'fmIDE-graph-board', version: 2, form: 'template' } }).value.boards).toBeNull();
});

test('another kind is refused with what it is, a newer version is flagged', () => {
  expect(S.readShowcaseData({ kind: 'system', canvases: [] }).error).toMatch(/another kind \("system"\)/);
  expect(S.readShowcaseData([1, 2]).error).toMatch(/isn't a showcase/);
  expect(S.readShowcaseData(null).error).toMatch(/isn't a showcase/);
  const r = S.readShowcaseData(readFixture('formats', 'showcase-newer.json'));
  expect([r.fromVersion, r.newer]).toEqual([2, true]);
  // The reader works on a copy.
  const raw = { kind: 'fmIDE-showcase' };
  S.readShowcaseData(raw);
  expect(raw).toEqual({ kind: 'fmIDE-showcase' });
});

test('hostile values are cut, cleaned or left out, each with a plain message, and only plain data comes out', () => {
  const r = S.readShowcaseData(readFixture('viewer', 'hostile-showcase.json'));
  const c = S.cleanShowcase(r.data);
  const v = c.value;
  expect(plain(v)).toBe(true);
  expect(v.id).toBeNull();
  expect(v.title.length).toBeLessThanOrEqual(S.SHOWCASE_LIMITS.title);
  expect(v.title.startsWith('<img src=x onerror=alert(1)>')).toBe(true); // kept as text: shown with textContent only
  expect(v.description).not.toMatch(/[\u0000-\u0008]/);
  expect(v.licence.length).toBe(S.SHOWCASE_LIMITS.licence);
  expect(v.mark).toBe(true);
  expect(v.canvases).toEqual({ show: ['nope', 'c1'], start: 'zzz' });
  expect([v.periods, v.boards, v.play]).toEqual([null, null, null]);
  expect(v.excel.file).toBe('x .xlsx');
  expect(c.problems.length).toBeGreaterThanOrEqual(6);
  // Against the model: names it doesn't have are left out and said; the start not shown is said.
  const res = S.resolveShowcase(v, [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }], 3);
  expect(res.canvases).toEqual(['c1']);
  expect(res.start).toBe('c1');
  expect(res.periods).toEqual([0, 1, 2]);
  expect(res.problems.join(' ')).toMatch(/One canvas the showcase names is not in the model.*The canvas to open on is not among those shown/);
});

test('each limit holds; names, lists and file names are cleaned', () => {
  const long = 'é'.repeat(1000);
  const v = S.cleanShowcase({ title: long, description: long, author: long, licence: long, id: 'a'.repeat(61),
    canvases: { show: Array.from({ length: 900 }, (_, i) => 'c' + i) } }).value;
  expect([v.title.length, v.description.length, v.author.length, v.licence.length]).toEqual([80, 400, 80, 60]);
  expect(v.id).toBeNull();
  expect(v.canvases.show.length).toBe(S.SHOWCASE_LIMITS.canvases);
  expect(S.cleanShowcase({ id: 'loan-basics-2' }).value.id).toBe('loan-basics-2');
  expect(S.cleanShowcase({ title: 'Two\nlines\tand tabs' }).value.title).toBe('Two lines and tabs');
  expect(S.cleanShowcase({ description: 'Two\nlines' }).value.description).toBe('Two\nlines');
  expect(S.cleanShowcase({ title: 12 }).value.title).toBe('12');
  expect(S.cleanShowcase({ title: { a: 1 } }).value.title).toBe('');
  expect(S.showcaseFileName('../Loan: basics?.XLSX')).toBe('Loan basics .XLSX');
  expect(S.showcaseFileName('...')).toBe('');
  expect(S.cleanShowcase({ periods: { mode: 'range', from: 2, to: 1 } }).value.periods).toBeNull();
  expect(S.cleanShowcase({ periods: { mode: 'range', from: 1.5, to: 3 } }).value.periods).toBeNull();
  // Periods past the model's last are cut to it; a range wholly past it shows every period.
  expect(S.resolveShowcase({ periods: { from: 1, to: 9 } }, [{ id: 'c1' }], 3).periods).toEqual([1, 2]);
  expect(S.resolveShowcase({ periods: { from: 5, to: 9 } }, [{ id: 'c1' }], 3).periods).toEqual([0, 1, 2]);
  // No showcase: every canvas, the first opening, every period.
  expect(S.resolveShowcase(null, [{ id: 'a' }, { id: 'b' }], 2)).toEqual({ canvases: ['a', 'b'], start: 'a', periods: [0, 1], problems: [] });
});
