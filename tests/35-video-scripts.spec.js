// 35. Video scripts and recordings of the tutorials (step 10, phase H4b; docs/step10-help.md).
// - The scripts (tools/video-scripts.js, in Node): an opening line, one line per step and a
//   closing line for every tutorial; commands read by name; a step's `say` where it has one;
//   nothing a viewer is told to press on the card itself.
// - Captions: numbered, in order, within each line's time, short enough, and every word said.
// - The recorder (tools/record-tutorials.js), for real on the To Excel tutorial: a video of
//   fmIDE and one of ExcelExporter's window that play, their captions, the script with times,
//   each step given time to read its line, and no request to the network.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const base = require('@playwright/test');
const { test, expect } = base;
const S = require('../tools/video-scripts.js');
const { recordTutorial } = require('../tools/record-tutorials.js');

const ROOT = path.join(__dirname, '..');
const { tutorials, video, commands } = S.loadTutorials();
const scriptOf = (id) => S.videoScript(tutorials.find(t => t.id === id), video, commands);
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// An .srt file as [{ n, start, end, lines }] (times in ms).
function parseSrt(text){
  const ms = (t) => { const m = /^(\d\d):(\d\d):(\d\d),(\d\d\d)$/.exec(t); expect(m, 'time ' + t).toBeTruthy(); return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4]; };
  return text.trim().split(/\n\n/).map(block => {
    const [n, times, ...lines] = block.split('\n');
    const [a, b] = times.split(' --> ');
    return { n: +n, start: ms(a), end: ms(b), lines };
  });
}
function checkCaptions(srt, script, timing){
  const cues = parseSrt(srt);
  expect(cues.map(c => c.n)).toEqual(cues.map((c, i) => i + 1));
  cues.forEach((c, i) => {
    expect(c.end, 'cue ' + c.n).toBeGreaterThan(c.start);
    if(i) expect(c.start, 'cue ' + c.n + ' after the one before').toBeGreaterThanOrEqual(cues[i - 1].end - 1);
    expect(c.lines.length).toBeGreaterThanOrEqual(1);
    expect(c.lines.length).toBeLessThanOrEqual(2);
    c.lines.forEach(l => expect(l.length, JSON.stringify(l)).toBeLessThanOrEqual(S.CAPTION_LINE + 12));
  });
  // Every word of every timed line is in the captions, in order.
  const said = script.lines.filter(l => timing[l.id]).map(l => l.say).join(' ');
  expect(norm(cues.map(c => c.lines.join(' ')).join(' '))).toBe(norm(said));
  return cues;
}

test.describe('the scripts', () => {
  test('every tutorial: an opening line, a line per step, a closing line', () => {
    expect(tutorials.length).toBe(6);
    for(const t of tutorials){
      const s = S.videoScript(t, video, commands);
      expect(s.lines.map(l => l.id)).toEqual(['video-intro'].concat(t.steps.map(x => x.id), ['video-outro']));
      expect(s.lines[0].say).toBe(t.title + '. ' + t.summary + ' To follow along, open Help in fmIDE with F1 and choose this tutorial under Tutorials.');
      expect(s.lines[s.lines.length - 1].say).toBe('That is the end of "' + t.title + '". Every tutorial is in fmIDE\'s Help, under Tutorials.');
      expect(s.lines.map(l => l.label)).toEqual(['Opening'].concat(t.steps.map((x, i) => 'Step ' + (i + 1) + ' of ' + t.steps.length), ['Closing']));
      for(const l of s.lines){
        expect(l.say.trim().length, t.id + '/' + l.id).toBeGreaterThan(10);
        expect(l.say, t.id + '/' + l.id).not.toMatch(/\{(cmd:|title|summary|minutes)/);
      }
    }
  });

  test('commands are read by name; a step\'s say replaces its card text, which the script still shows', () => {
    const s = scriptOf('first-model');
    expect(s.lines.find(l => l.id === 'price').say).toMatch(/^Press Add Rectangle\. A rectangle appears/);
    expect(s.lines.find(l => l.id === 'evaluate').say).toMatch(/^Press Evaluate \(or F9\)/);
    const intro = s.lines.find(l => l.id === 'intro');
    const step = tutorials[0].steps[0];
    expect(intro.say).toBe(step.say);
    expect(intro.shows).toBe(step.text);
    expect(s.lines.find(l => l.id === 'price').shows).toBeUndefined();
    expect(() => S.spoken('Press {cmd:noSuchCommand}.', commands)).toThrow('noSuchCommand');
  });

  test('nothing a viewer is told to press on the card itself: say where the card\'s words would', () => {
    const cardWords = [/\bPress Next\b/, /\bNext when\b/, /\bFinish\b/, /\bKeep below\b/];
    const spokenIds = [];
    for(const t of tutorials){
      const s = S.videoScript(t, video, commands);
      s.lines.forEach(l => cardWords.forEach(w => expect(l.say, t.id + '/' + l.id).not.toMatch(w)));
      t.steps.filter(x => x.say).forEach(x => {
        expect(x.say, t.id + '/' + x.id + ' says something else than its card').not.toBe(x.text);
        spokenIds.push(t.id + '/' + x.id);
      });
    }
    expect(spokenIds.length).toBeGreaterThanOrEqual(12);
  });

  test('reading time: at least 2.5 s, longer for longer lines', () => {
    expect(S.readingTime('Press Next.')).toBe(2500);
    const long = 'word '.repeat(50);
    expect(S.readingTime(long)).toBe(Math.round(50 / 2.5 * 1000) + 800);
    expect(S.readingTime(long + long)).toBeGreaterThan(S.readingTime(long));
  });

  test('captions: in order, within each line\'s time, two short lines at most, every word said', () => {
    for(const t of tutorials){
      const s = S.videoScript(t, video, commands);
      let at = 1000;
      const timing = {};
      s.lines.forEach(l => { const d = S.readingTime(l.say) + 3000; timing[l.id] = { start: at, end: at + d }; at += d + 200; });
      const cues = checkCaptions(S.captions(s, timing), s, timing);
      cues.forEach(c => expect(Object.values(timing).some(tm => c.start >= tm.start - 1 && c.end <= tm.end + 1), t.id + ' cue ' + c.n).toBe(true));
    }
    expect(S.srtTime(3723456)).toBe('01:02:03,456');
    expect(S.wrapCaption('To follow along, open Help in fmIDE with F1')).toEqual(['To follow along, open Help in fmIDE with', 'F1']);
    expect(S.captionPieces('To follow along, open Help in fmIDE with F1 and choose this tutorial under Tutorials.'))
      .toEqual(['To follow along, open Help in fmIDE with F1', 'and choose this tutorial under Tutorials.']);
  });

  test('npm run video-scripts writes a script for each tutorial; an unknown id is refused', ({}, testInfo) => {
    const out = testInfo.outputPath('scripts');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'video-scripts.js'), '--out', out], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    for(const t of tutorials){
      const md = fs.readFileSync(path.join(out, t.id, t.id + '-script.md'), 'utf8');
      expect(md).toContain('# ' + t.title + ' — video script');
      expect(md).toContain('**Step 1 of ' + t.steps.length + '**');
      expect(md).toContain('licensed under CC BY 4.0');
      expect(md).not.toMatch(/\[\d\d:\d\d\]/);                     // no times until it is recorded
    }
    const bad = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'video-scripts.js'), '--out', out, 'nope'], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('no tutorial nope');
  });
});

test.describe('the recorder', () => {
  test('records the To Excel tutorial: two videos that play, captions, a timed script', async ({ browser, page }, testInfo) => {
    test.setTimeout(300000);
    const t = tutorials.find(x => x.id === 'to-excel');
    const script = S.videoScript(t, video, commands);
    const out = testInfo.outputPath('videos');
    const r = await recordTutorial(browser, t, script, out);
    const dir = path.join(out, 'to-excel');
    expect(fs.readdirSync(dir).sort()).toEqual(['to-excel-excelexporter.srt', 'to-excel-excelexporter.webm', 'to-excel-script.md', 'to-excel.srt', 'to-excel.webm']);
    // The lines in order, each step given at least the time to read its line.
    const ids = script.lines.map(l => l.id);
    ids.forEach((id, i) => {
      expect(r.timing[id], id).toBeTruthy();
      if(i) expect(r.timing[id].start, id).toBeGreaterThanOrEqual(r.timing[ids[i - 1]].end);
      expect(r.timing[id].end - r.timing[id].start, id).toBeGreaterThanOrEqual(S.readingTime(script.lines[i].say));
    });
    checkCaptions(fs.readFileSync(path.join(dir, 'to-excel.srt'), 'utf8'), script, r.timing);
    // ExcelExporter's own video carries the lines from when its window opened.
    const own = parseSrt(fs.readFileSync(path.join(dir, 'to-excel-excelexporter.srt'), 'utf8'));
    expect(own.length).toBeGreaterThan(2);
    expect(own.map(c => c.lines.join(' ')).join(' ')).toContain('drop the file you just downloaded');
    expect(own.map(c => c.lines.join(' ')).join(' ')).not.toContain('This practice canvas holds');
    // The script, with the time each line starts, and the ExcelExporter video's times.
    const md = fs.readFileSync(path.join(dir, 'to-excel-script.md'), 'utf8');
    const times = [...md.matchAll(/^\*\*\[(\d\d):(\d\d)\] /gm)].map(m => +m[1] * 60 + +m[2]);
    expect(times.length).toBe(script.lines.length);
    times.forEach((s, i) => { if(i) expect(s).toBeGreaterThanOrEqual(times[i - 1]); });
    expect(md).toMatch(/\*\*\[\d\d:\d\d\] Step 4 of 6\*\* · ExcelExporter video \[\d\d:\d\d\]/);
    // Both videos are real WebM files that play for as long as the recording took.
    for(const [name, length] of [['to-excel.webm', r.timing['video-outro'].end], ['to-excel-excelexporter.webm', null]]){
      const bytes = fs.readFileSync(path.join(dir, name));
      expect(bytes.subarray(0, 4).toString('hex'), name).toBe('1a45dfa3');   // WebM (EBML)
      const seconds = await page.evaluate(async (b64) => {
        const v = document.createElement('video');
        v.muted = true;
        v.src = 'data:video/webm;base64,' + b64;
        await new Promise((ok, fail) => { v.onloadedmetadata = ok; v.onerror = () => fail(new Error('the video does not play')); });
        if(v.duration === Infinity){ v.currentTime = 1e9; await new Promise(r => v.ontimeupdate = r); }
        return v.duration;
      }, bytes.toString('base64'));
      expect(seconds, name).toBeGreaterThan(5);
      // Nothing cut short: at least as long as the recording, plus the moment the window takes to close.
      if(length){
        expect(seconds * 1000, name + ' holds the whole recording').toBeGreaterThanOrEqual(length - 1000);
        expect(seconds * 1000, name + ' ends soon after the closing line').toBeLessThan(length + 10000);
      }
    }
    expect(r.seconds).toBeGreaterThan(30);
  });
});
