#!/usr/bin/env node
// Screen recordings of the tutorials (build step 10, phase H4b; docs/step10-help.md), made by
// playing each tutorial in fmIDE exactly as test group 33 does (the same step actions,
// tests/helpers/tutorial-actions.js), at a pace a viewer can follow. Run it again whenever the
// screen changes. Needs the test tooling (Playwright's Chromium); no network: the apps are
// served from apps/, and any other request stops the recording.
//
//   npm run record-tutorials [-- --out DIR] [tutorial id …]
//
// For each tutorial, into DIR/<id>/ (default DIR: videos/, which Git ignores):
//   <id>.webm         the video, 1280 × 720, no sound
//   <id>.srt          captions: the voice-over's lines, timed
//   <id>-script.md    the script (tools/video-scripts.js) with the time each line starts
//   <id>-excelexporter.webm / .srt   the To Excel tutorial's ExcelExporter window, filmed on its own
//
// While recording, and only then, a pointer is drawn on the page (a headless browser films no
// mouse), the pointer glides to what it presses, text is typed a key at a time, and each step
// waits long enough for its line to be read at a calm pace (video-scripts.js, readingTime).
// Nothing in the apps changes.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPS = path.join(ROOT, 'apps');
const ORIGIN = 'http://local.test/';
const SIZE = { width: 1280, height: 720 };
const S = require('./video-scripts.js');

// A pointer drawn over the page, following the mouse; it shrinks while a button is down.
// (An init script of the recorder's own: the page's policy doesn't apply to it.)
const POINTER = `(() => {
  const put = () => {
    if(document.getElementById('__recordPointer') || !document.body) return;
    const p = document.createElement('div');
    p.id = '__recordPointer';
    p.style.cssText = 'position:fixed;left:-50px;top:-50px;width:24px;height:24px;pointer-events:none;z-index:2147483647;transform-origin:2px 2px;transition:transform .1s';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '24'); svg.setAttribute('height', '24'); svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2 2 L2 19 L7 14.5 L10.5 22 L13.5 20.7 L10 13.3 L16.5 13.3 Z');
    path.setAttribute('fill', '#111'); path.setAttribute('stroke', '#fff'); path.setAttribute('stroke-width', '1.5');
    svg.appendChild(path);
    p.appendChild(svg);
    document.body.appendChild(p);
  };
  const move = (e) => { put(); const p = document.getElementById('__recordPointer'); if(p){ p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px'; } };
  const press = (down) => () => { const p = document.getElementById('__recordPointer'); if(p) p.style.transform = down ? 'scale(.8)' : ''; };
  window.addEventListener('mousemove', move, true);
  window.addEventListener('mousedown', press(true), true);
  window.addEventListener('mouseup', press(false), true);
  document.addEventListener('DOMContentLoaded', put);
})();`;

// A person's pace (the methods of tests/helpers/tutorial-actions.js's testPace).
function recordPace(){
  const at = new Map(); // where the mouse is, per page
  const wait = (page, ms) => page.waitForTimeout(ms);
  const centre = async (locator) => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  async function target(locator){
    await locator.waitFor({ state: 'visible' });
    await locator.scrollIntoViewIfNeeded();
    return centre(locator);
  }
  async function glide(page, p){
    const from = at.get(page) || { x: SIZE.width / 2, y: SIZE.height / 2 };
    const steps = Math.max(10, Math.min(45, Math.round(Math.hypot(p.x - from.x, p.y - from.y) / 14)));
    await page.mouse.move(p.x, p.y, { steps });
    at.set(page, p);
  }
  const pace = {
    async click(page, locator){
      await glide(page, await target(locator));
      await wait(page, 250);
      await locator.click();
      await wait(page, 450);
    },
    async type(page, text){ await page.keyboard.type(text, { delay: 90 }); await wait(page, 200); },
    async fill(page, locator, text){
      await pace.click(page, locator);
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(text, { delay: 60 });
      await wait(page, 300);
    },
    async press(page, key){ await wait(page, 250); await page.keyboard.press(key); await wait(page, 350); },
    async drag(page, from, to, button){
      await glide(page, await target(from));
      await wait(page, 250);
      await page.mouse.down({ button });
      const b = await centre(to);
      await page.mouse.move(b.x, b.y, { steps: 35 });
      at.set(page, b);
      await wait(page, 150);
      await page.mouse.up({ button });
      await wait(page, 500);
    },
    async attach(page, locator){ await glide(page, await target(locator)); await wait(page, 700); },
  };
  return pace;
}

// Plays one tutorial and films it. Returns what it wrote.
async function recordTutorial(browser, t, script, outDir){
  const { expect } = require('@playwright/test');
  const { tutorialActions } = require(path.join(ROOT, 'tests', 'helpers', 'tutorial-actions.js'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-video-'));
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE }, acceptDownloads: true });
  const blocked = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    const name = url.startsWith(ORIGIN) ? decodeURIComponent(url.slice(ORIGIN.length).split(/[?#]/)[0]) : null;
    if(name === 'fmIDE.html' || name === 'ExcelExporter.html'){
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(APPS, name)) });
    }
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(POINTER);
  const P = recordPace();
  const { actions, trip } = tutorialActions(P);
  const page = await context.newPage();
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  let popupAt = null;
  context.on('page', () => { if(popupAt === null) popupAt = now(); });
  const timing = {};
  const line = (id) => script.lines.find(l => l.id === id);
  const card = page.locator('#tutorialCard');
  try{
    await page.goto(ORIGIN + 'fmIDE.html');
    await page.waitForFunction(() => window.fm && typeof fm.nodes === 'function');
    const welcome = page.locator('#welcomeCard .welcome-close');
    if(await welcome.count()) await welcome.click();
    await page.waitForTimeout(800);

    // Opening: the Help panel, where the tutorials are.
    let start = now();
    await P.press(page, 'F1');
    const run = page.locator(`#helpPanel .help-tutorial[data-tutorial="${t.id}"] .help-tutorial-start`);
    await P.attach(page, run);
    await page.waitForTimeout(Math.max(0, start + S.readingTime(line('video-intro').say) - now()));
    timing['video-intro'] = { start, end: now() };
    await P.click(page, run);

    // Each step: its line is read while the card shows it, then what it asks is done.
    for(let i = 0; i < t.steps.length; i++){
      const s = t.steps[i];
      start = now();
      await expect(card).toHaveAttribute('data-step', s.id, { timeout: 15000 });
      await page.waitForTimeout(S.readingTime(line(s.id).say));
      await actions[t.id][s.id](page);
      if(i < t.steps.length - 1) await expect(card).toHaveAttribute('data-step', t.steps[i + 1].id, { timeout: 15000 });
      else await expect(card).toHaveCount(0, { timeout: 15000 });
      await page.waitForTimeout(600);
      timing[s.id] = { start, end: now() };
    }

    // Closing.
    start = now();
    await page.waitForTimeout(S.readingTime(line('video-outro').say));
    timing['video-outro'] = { start, end: now() };
  } finally {
    await context.close();                     // the videos are written when their pages close
  }
  if(blocked.length) throw new Error('record-tutorials: the app tried to reach the network: ' + blocked.join(', '));

  const dir = path.join(outDir, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  const put = (name, data) => { const f = path.join(dir, name); fs.writeFileSync(f, data); written.push(f); };
  put(t.id + '.webm', fs.readFileSync(await page.video().path()));
  put(t.id + '.srt', S.captions(script, timing));
  const others = [];
  if(trip.popup && trip.popup.video()){
    // The ExcelExporter window's own video starts when it opened: its lines, moved to its clock.
    const own = {};
    Object.entries(timing).forEach(([id, tm]) => { if(tm.end > popupAt) own[id] = { start: Math.max(0, tm.start - popupAt), end: tm.end - popupAt }; });
    put(t.id + '-excelexporter.webm', fs.readFileSync(await trip.popup.video().path()));
    put(t.id + '-excelexporter.srt', S.captions(script, own));
    others.push({ name: 'ExcelExporter video', timing: own });
  }
  put(t.id + '-script.md', S.scriptMarkdown(script, timing, others));
  fs.rmSync(tmp, { recursive: true, force: true });
  return { files: written, timing, seconds: Math.round(timing['video-outro'].end / 1000) };
}

async function main(){
  const argv = process.argv.slice(2);
  const o = argv.indexOf('--out');
  const out = path.resolve(o >= 0 ? argv[o + 1] : path.join(ROOT, 'videos'));
  const ids = argv.filter((a, i) => !a.startsWith('--') && !(o >= 0 && i === o + 1));
  const { tutorials, video, commands } = S.loadTutorials();
  const unknown = ids.filter(id => !tutorials.some(t => t.id === id));
  if(unknown.length){ console.error('record-tutorials: no tutorial ' + unknown.join(', ') + ' (there are: ' + tutorials.map(t => t.id).join(', ') + ')'); process.exit(1); }
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try{
    for(const t of tutorials.filter(t => !ids.length || ids.includes(t.id))){
      process.stdout.write('recording ' + t.id + ' … ');
      const r = await recordTutorial(browser, t, S.videoScript(t, video, commands), out);
      console.log(r.seconds + ' s: ' + r.files.map(f => path.relative(process.cwd(), f)).join(', '));
    }
  } finally {
    await browser.close();
  }
}

module.exports = { recordTutorial, recordPace, SIZE };
if(require.main === module) main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
