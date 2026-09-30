#!/usr/bin/env node
// Video scripts for the tutorials (build step 10, phase H4b; docs/step10-help.md): what the
// voice-over says in each tutorial video, made from the tutorials themselves
// (src/help/fmide-tutorials.js, CC BY 4.0), so a script can't drift from its tutorial.
//
//   npm run video-scripts [-- --out DIR] [tutorial id …]
//     writes DIR/<id>/<id>-script.md for each tutorial (default DIR: videos/, which Git ignores)
//
// A script is: the video's opening line (TUTORIAL_VIDEO.intro, with the tutorial's title and
// summary), one line per step — the step's `say` where it has one, otherwise the text its card
// shows, with each {cmd:id} read as the command's name — and the closing line. The recorder
// (tools/record-tutorials.js) writes the same script with the time each line starts, and the
// captions (.srt) from it. Node only, no packages, no network.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// How fast the voice-over is read: 150 words a minute, and never less than 2.5 s for a line.
const WORDS_PER_SECOND = 2.5;
const MIN_LINE_MS = 2500;
// Captions: at most 42 characters on a line and two lines on screen (as YouTube advises).
const CAPTION_LINE = 42;

function loadTutorials(){
  const text = fs.readFileSync(path.join(ROOT, 'src', 'help', 'fmide-tutorials.js'), 'utf8');
  const { TUTORIALS, TUTORIAL_VIDEO } = vm.runInContext(text + '\n;({ TUTORIALS, TUTORIAL_VIDEO })', vm.createContext({}));
  // The commands' names, as the help pages read them from fmIDE's source (tools/build-help.js).
  const { commands } = require('./build-help.js').loadHelpSources();
  return { tutorials: TUTORIALS, video: TUTORIAL_VIDEO, commands };
}

// A text as it is read aloud: {cmd:id} becomes the command's name.
function spoken(text, commands){
  return String(text).replace(/\{cmd:([A-Za-z0-9_:]+)\}/g, (all, id) => {
    const c = commands.get(id);
    if(!c) throw new Error('video-scripts: a tutorial names a command that doesn\'t exist: ' + id);
    return c.label;
  });
}
const fillIn = (template, t) => String(template).replace(/\{(title|summary|minutes)\}/g, (all, k) => String(t[k]));

// One tutorial's script: { id, title, minutes, lines: [{ id, label, say, shows? }] }, where
// `shows` is the card's own text when the voice-over says something else.
function videoScript(t, video, commands){
  const lines = [{ id: 'video-intro', label: 'Opening', say: fillIn(video.intro, t) }];
  t.steps.forEach((s, i) => {
    const line = { id: s.id, label: 'Step ' + (i + 1) + ' of ' + t.steps.length, say: spoken(s.say || s.text, commands) };
    if(s.say) line.shows = spoken(s.text, commands);
    lines.push(line);
  });
  lines.push({ id: 'video-outro', label: 'Closing', say: fillIn(video.outro, t) });
  return { id: t.id, title: t.title, minutes: t.minutes, lines };
}

// How long reading a line takes, in milliseconds.
function readingTime(text){
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_LINE_MS, Math.round(words / WORDS_PER_SECOND * 1000) + 800);
}

const pad = (n, w) => String(n).padStart(w || 2, '0');
function clock(ms){ const s = Math.floor(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
function srtTime(ms){
  ms = Math.max(0, Math.round(ms));
  return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + pad(ms % 1000, 3);
}

// The script as Markdown. timing (optional): { [line id]: { start, end } } in ms from the start
// of the video; others: [{ name, timing }] for another video the same lines appear in (the To
// Excel tutorial's ExcelExporter window).
function scriptMarkdown(script, timing, others){
  const out = [];
  out.push('# ' + script.title + ' — video script', '');
  out.push('Tutorial `' + script.id + '`, about ' + script.minutes + ' minutes in fmIDE. ' + (timing
    ? 'Recorded by `npm run record-tutorials`: each line starts at the time shown, and the video waits long enough to read it at a calm pace.'
    : 'Made by `npm run video-scripts`; `npm run record-tutorials` records the video and writes this script again with the time each line starts.'), '');
  script.lines.forEach(l => {
    const at = timing && timing[l.id] ? '[' + clock(timing[l.id].start) + '] ' : '';
    const also = (others || []).filter(o => o.timing[l.id]).map(o => ' · ' + o.name + ' [' + clock(o.timing[l.id].start) + ']').join('');
    out.push('**' + at + l.label + '**' + also, '');
    out.push('> ' + l.say, '');
    if(l.shows) out.push('On the card: ' + l.shows, '');
  });
  out.push('---', '', 'Made from fmIDE\'s tutorials (`src/help/fmide-tutorials.js`), © 2026 Taro Yamaka, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).', '');
  return out.join('\n');
}

// A line's text in pieces short enough for one caption (two lines of CAPTION_LINE characters):
// sentence by sentence, a long sentence cut into even pieces at spaces.
function captionPieces(text){
  const max = CAPTION_LINE * 2;
  const pieces = [];
  String(text).split(/(?<=[.!?])\s+/).filter(Boolean).forEach(sentence => {
    const n = Math.ceil(sentence.length / max);
    let made = 0, used = 0, cur = '';
    sentence.split(/\s+/).forEach(w => {
      const next = cur ? cur + ' ' + w : w;
      // Cut before this word when it would take the piece past its even share (by more than
      // half the word) or past the most one caption holds.
      const share = (made + 1) * sentence.length / n;
      if(cur && made < n - 1 && (used + next.length > share + w.length / 2 || next.length > max)){
        pieces.push(cur); made++; used += cur.length + 1; cur = w;
      } else cur = next;
    });
    if(cur) pieces.push(cur);
  });
  return pieces;
}
function wrapCaption(text){
  const lines = [];
  let cur = '';
  text.split(/\s+/).forEach(w => {
    if(cur && (cur + ' ' + w).length > CAPTION_LINE){ lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  });
  if(cur) lines.push(cur);
  // Two lines at most: a third (a very long word) joins the second.
  return lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines;
}
// Captions (.srt) for a video: each line's time shared among its pieces by their length.
function captions(script, timing){
  const cues = [];
  script.lines.forEach(l => {
    const t = timing[l.id];
    if(!t || t.end <= t.start) return;
    const pieces = captionPieces(l.say);
    const total = pieces.reduce((n, p) => n + p.length, 0);
    let at = t.start;
    pieces.forEach(p => {
      const end = at + (t.end - t.start) * p.length / total;
      cues.push({ start: at, end, text: wrapCaption(p).join('\n') });
      at = end;
    });
  });
  return cues.map((c, i) => (i + 1) + '\n' + srtTime(c.start) + ' --> ' + srtTime(c.end) + '\n' + c.text + '\n').join('\n');
}

module.exports = { loadTutorials, videoScript, spoken, readingTime, scriptMarkdown, captions, captionPieces, wrapCaption, srtTime, clock, CAPTION_LINE };

if(require.main === module){
  const argv = process.argv.slice(2);
  const o = argv.indexOf('--out');
  const out = path.resolve(o >= 0 ? argv[o + 1] : path.join(ROOT, 'videos'));
  const ids = argv.filter((a, i) => !a.startsWith('--') && !(o >= 0 && i === o + 1));
  const { tutorials, video, commands } = loadTutorials();
  const unknown = ids.filter(id => !tutorials.some(t => t.id === id));
  if(unknown.length){ console.error('video-scripts: no tutorial ' + unknown.join(', ') + ' (there are: ' + tutorials.map(t => t.id).join(', ') + ')'); process.exit(1); }
  tutorials.filter(t => !ids.length || ids.includes(t.id)).forEach(t => {
    const dir = path.join(out, t.id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, t.id + '-script.md');
    fs.writeFileSync(file, scriptMarkdown(videoScript(t, video, commands)));
    console.log('wrote ' + path.relative(process.cwd(), file));
  });
}
