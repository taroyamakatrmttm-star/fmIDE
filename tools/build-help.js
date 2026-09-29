// Writes the site's help pages, /help (build step 10, phase H4a; docs/step10-help.md): the same
// topics and tutorials as the apps' Help panels, as plain HTML pages with no JavaScript. Called
// by tools/build.js for every site build. Node only, no packages, no network.
//
//   help/index.html                  /help/                  fmIDE's topics by group, and the tutorials
//   help/<topic id>.html             /help/<topic id>        one topic
//   help/all.html                    /help/all               every topic on one page (Ctrl+F, print)
//   help/tutorials/index.html        /help/tutorials/        the tutorials
//   help/tutorials/<id>.html         /help/tutorials/<id>    one tutorial, step by step
//   help/excel/index.html, <id>.html, all.html               ExcelExporter's help, the same way
//   help/style.css                   the site's look (src/library/style.css, as the catalogue's)
//   help/help.css                    the help pages' own rules (src/help-pages/help.css)
//   help/LICENSE-CC-BY-4.0.txt       the licence of fmIDE's help text
//
// Where the text comes from: fmIDE's help (src/help/fmide-help.js, fmide-tutorials.js; CC BY 4.0)
// and ExcelExporter's (src/excel-exporter/help/excel-help.js; ExcelExporter's licence), read as
// data. A {cmd:id} in fmIDE's text becomes the command's name and where it is: its label and
// icon from fmIDE's command list (src/fmide/js/01-setup-commands-keys.js), and
// the first ribbon tab holding it (DEFAULT_RIBBON, src/fmide/js/16-ribbon-keytips.js). Test
// group 34 checks both against the app itself, so they can't drift apart.
//
// Every text goes into a page only through escapeXml() (src/shared/escaping.js); addresses are
// built only from ids, which must be letters, digits and dashes. A topic naming a command or
// topic that doesn't exist stops the build (HelpError), with nothing written.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

const escapeXml = vm.runInContext(fs.readFileSync(path.join(SRC, 'shared', 'escaping.js'), 'utf8') + '\n;escapeXml',
  vm.createContext({}));
const h = (s) => escapeXml(s == null ? '' : s);

class HelpError extends Error {}

const ID = /^[a-z0-9][a-z0-9-]*$/;
// Names the pages themselves use, so no topic may take them.
const RESERVED = ['index', 'all', 'tutorials', 'excel', 'style', 'help', 'LICENSE-CC-BY-4.0'];
const CMD = /\{cmd:([A-Za-z0-9_:]+)\}/g;

// ---------- reading the sources ----------
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
function runData(files, names){
  return vm.runInContext(files.map(f => read(...f)).join('\n') + '\n;({ ' + names.join(', ') + ' })', vm.createContext({}));
}

// fmIDE's commands: { id → { label, icon } }, read from its command list. Each entry
// of COMMANDS starts on one line: { id:'…', label:'…', icon:'…', category:'…', defaultShortcut:… };
// the Insert Operator commands are made from the operator catalogue, as fmIDE makes them.
function readCommands(OPERATORS){
  const text = read('fmide', 'js', '01-setup-commands-keys.js');
  const start = text.indexOf('const COMMANDS = [');
  const end = text.indexOf('\n  ];', start);
  if(start < 0 || end < 0) throw new HelpError('build-help: fmIDE\'s command list (const COMMANDS = [ … ];) was not found.');
  const str = "'((?:[^'\\\\]|\\\\.)*)'";
  const entry = new RegExp("\\{ id:" + str + ",\\s*label:" + str + ",\\s*icon:" + str + ",\\s*category:" + str + ",\\s*defaultShortcut:(null|" + str + ")", 'g');
  const unq = (s) => s.replace(/\\(.)/g, '$1');
  const commands = new Map();
  for(const m of text.slice(start, end).matchAll(entry)){
    commands.set(unq(m[1]), { label: unq(m[2]), icon: unq(m[3]) });
  }
  const entries = (text.slice(start, end).match(/^ {4}\{ id:'/gm) || []).length;
  if(!commands.size || commands.size !== entries) throw new HelpError('build-help: read ' + commands.size + ' of the ' + entries + ' commands in fmIDE\'s command list; its entries must keep the form { id:…, label:…, icon:…, category:…, defaultShortcut:… }.');
  const words = Object.fromEntries(OPERATORS.filter(op => op.word).map(op => [op.symbol, op.word]));
  OPERATORS.map(op => op.symbol).forEach((sym, i) => {
    const word = words[sym];
    commands.set('insertOp' + i, { label: 'Insert Operator ' + sym + (word ? ' (' + word + ')' : ''), icon: word ? sym : 'ƒ' });
  });
  return commands;
}

// fmIDE's ribbon as it is before anyone customises it (DEFAULT_RIBBON), run on its own.
function readRibbon(OPERATORS){
  const setup = read('fmide', 'js', '01-setup-commands-keys.js');
  const lines = ['OPS', 'E1_COMPARE_OPS', 'E1_FUNCTION_OPS'].map(name => {
    const m = new RegExp('^ *const ' + name + ' = [^\\n]*;$', 'm').exec(setup);
    if(!m) throw new HelpError('build-help: ' + name + ' was not found in 01-setup-commands-keys.js.');
    return m[0];
  });
  const text = read('fmide', 'js', '16-ribbon-keytips.js');
  const start = text.indexOf('  const DOCUMENT_RIBBON_GROUP');
  const end = text.indexOf('\n  const ribbonState');
  if(start < 0 || end < start) throw new HelpError('build-help: fmIDE\'s DEFAULT_RIBBON was not found in 16-ribbon-keytips.js.');
  const ctx = vm.createContext({ OPERATORS, cloneData: (x) => JSON.parse(JSON.stringify(x)) });
  return vm.runInContext(lines.join('\n') + '\n' + text.slice(start, end) + '\n;DEFAULT_RIBBON', ctx);
}

// Everything the pages are made from. Tests pass their own (hostile text, missing commands…).
function loadHelpSources(){
  const F = runData([['shared', 'operators.js'], ['help', 'fmide-help.js'], ['help', 'fmide-tutorials.js']],
    ['HELP_GROUPS', 'HELP_TOPICS', 'TUTORIALS', 'OPERATORS']);
  const E = runData([['excel-exporter', 'help', 'excel-help.js']], ['EXCEL_HELP_GROUPS', 'EXCEL_HELP_TOPICS']);
  return {
    fmide: { groups: F.HELP_GROUPS, topics: F.HELP_TOPICS, tutorials: F.TUTORIALS },
    excel: { groups: E.EXCEL_HELP_GROUPS, topics: E.EXCEL_HELP_TOPICS },
    commands: readCommands(F.OPERATORS),
    ribbon: readRibbon(F.OPERATORS),
  };
}

// Where a command is: the first ribbon tab holding it, or the Command Launcher.
function commandPlaces(ribbon){
  const places = new Map();
  (ribbon.tabs || []).forEach(t => (t.groups || []).forEach(g => (g.items || []).forEach(it => {
    if(it && it.cmd && !places.has(it.cmd)) places.set(it.cmd, t.label + ' tab');
  })));
  return places;
}
// ---------- checks ----------
function blockTexts(b){ return [b.p, b.tip].concat(Array.isArray(b.steps) ? b.steps : []).filter(s => typeof s === 'string'); }
function checkHelp(src){
  const problems = [];
  // Topic and tutorial ids become page addresses, so they may not take the pages' own names;
  // group ids are only anchors within a page.
  const idCheck = (what, id, anchor) => { if(typeof id !== 'string' || !ID.test(id) || (!anchor && RESERVED.includes(id))) problems.push(what + ' id ' + JSON.stringify(id) + ' must be letters, digits and dashes' + (anchor ? '' : ', and not one of ' + RESERVED.join(', '))); };
  const checkSet = (label, set, commands) => {
    const ids = new Set();
    set.groups.forEach(g => idCheck(label + ' group', g.id, true));
    set.topics.forEach(t => {
      idCheck(label + ' topic', t.id);
      if(ids.has(t.id)) problems.push(label + ' topic ' + t.id + ' appears twice');
      ids.add(t.id);
      if(!set.groups.some(g => g.id === t.group)) problems.push(label + ' topic ' + t.id + ' is in a group that doesn\'t exist: ' + t.group);
    });
    const checkText = (where, s) => { for(const m of String(s).matchAll(CMD)) if(!commands || !commands.has(m[1])) problems.push(where + ' names a command that doesn\'t exist: ' + m[1]); };
    set.topics.forEach(t => {
      (t.body || []).forEach(b => {
        blockTexts(b).forEach(s => checkText(label + ' topic ' + t.id, s));
        (Array.isArray(b.see) ? b.see : []).forEach(id => { if(!ids.has(id)) problems.push(label + ' topic ' + t.id + ' sees a topic that doesn\'t exist: ' + id); });
      });
    });
    (set.tutorials || []).forEach(tu => {
      idCheck(label + ' tutorial', tu.id);
      if(tu.topic && !ids.has(tu.topic)) problems.push(label + ' tutorial ' + tu.id + ' names a topic that doesn\'t exist: ' + tu.topic);
      (tu.steps || []).forEach(s => checkText(label + ' tutorial ' + tu.id + ', step ' + s.id, s.text));
    });
    return ids;
  };
  checkSet('fmIDE', src.fmide, src.commands);
  if(src.excel) checkSet('ExcelExporter', src.excel, null);
  if(problems.length) throw new HelpError('The help pages can\'t be built, so nothing is published:\n  ' + problems.join('\n  '));
}

// ---------- pages ----------
// A page of the fmIDE help (set 'fmide') or ExcelExporter's ('excel'). up: the way from the
// page's folder up to /help/ ('' for /help/x, '../' for /help/tutorials/x and /help/excel/x).
function page(set, up, title, description, main){
  const site = up + '../';
  const header = set === 'excel'
    ? '<header class="top"><a class="home" href="./">ExcelExporter help</a><nav><a href="' + up + '">fmIDE help</a><a href="' + site + 'ExcelExporter">Open ExcelExporter</a></nav></header>'
    : '<header class="top"><a class="home" href="' + (up || './') + '">fmIDE help</a><nav><a href="' + up + 'excel/">ExcelExporter help</a><a href="' + site + '">Open fmIDE</a></nav></header>';
  const footer = set === 'excel'
    ? '<p>ExcelExporter and this help text © 2026 Taro Yamaka. All rights reserved: ExcelExporter is free to use, under <a href="' + site + 'ExcelExporter-LICENSE.txt">its licence</a>. Unlike fmIDE\'s help, this text is not shared under CC BY.</p>'
    : '<p>This help text © 2026 Taro Yamaka, licensed under <a href="' + CC_BY + '" rel="license noopener noreferrer">CC BY 4.0</a> (<a href="' + up + 'LICENSE-CC-BY-4.0.txt">the full text</a>): reuse and adapt it, with credit. fmIDE is licensed under the Apache License 2.0 (<a href="' + site + 'LICENSE.txt">the full text</a>).</p>';
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + h(title) + '</title>',
    description ? '<meta name="description" content="' + h(description) + '">' : null,
    '<link rel="stylesheet" href="' + up + 'style.css">',
    '<link rel="stylesheet" href="' + up + 'help.css">',
    '<link rel="icon" href="' + site + 'icons/icon.svg" type="image/svg+xml">',
    '</head>',
    '<body class="help-site">',
    header,
    '<main>',
    main,
    '</main>',
    '<footer>',
    footer,
    '</footer>',
    '</body>',
    '</html>',
    ''
  ].filter(l => l !== null).join('\n');
}

// Text with {cmd:id} markers: escaped text, and each command as its icon, name and place.
function richText(s, ctx){
  return String(s).split(/(\{cmd:[A-Za-z0-9_:]+\})/).map(part => {
    const m = /^\{cmd:([A-Za-z0-9_:]+)\}$/.exec(part);
    if(!m) return h(part);
    const c = ctx.commands.get(m[1]);
    // Only where it is: the texts name a shortcut themselves where it matters.
    const where = ctx.places.get(m[1]) || 'Command Launcher';
    return '<span class="cmd"><b class="cmd-name">' + h((c.icon ? c.icon + ' ' : '') + c.label) + '</b> <span class="cmd-where">(' + h(where) + ')</span></span>';
  }).join('');
}

// A topic's blocks. link(id) gives a See also topic's address.
function topicBody(t, ctx, link, seeHeading){
  const out = [];
  (t.body || []).forEach(b => {
    if(typeof b.p === 'string') out.push('<p>' + richText(b.p, ctx) + '</p>');
    if(typeof b.tip === 'string') out.push('<p class="tip"><span aria-hidden="true">💡 </span>' + richText(b.tip, ctx) + '</p>');
    if(Array.isArray(b.steps)) out.push('<ol class="steps">' + b.steps.map(s => '<li>' + richText(s, ctx) + '</li>').join('') + '</ol>');
    if(Array.isArray(b.see)){
      const list = b.see.map(id => ctx.set.topics.find(x => x.id === id)).filter(Boolean);
      if(list.length) out.push('<section class="see"><' + seeHeading + '>See also</' + seeHeading + '>' + topicList(list, link) + '</section>');
    }
  });
  return out.join('\n');
}
function topicList(list, link){
  return '<ul class="topics">' + list.map(t => '<li><a href="' + link(t.id) + '">' + h(t.title) + '</a>' +
    (t.summary ? '<span class="summary">' + h(t.summary) + '</span>' : '') + '</li>').join('') + '</ul>';
}
function tutorialList(list, link){
  return '<ul class="topics tutorials">' + list.map(tu => '<li><a href="' + link(tu.id) + '">' + h(tu.title) + '</a>' +
    '<span class="minutes">about ' + h(tu.minutes) + ' minutes</span>' +
    (tu.summary ? '<span class="summary">' + h(tu.summary) + '</span>' : '') + '</li>').join('') + '</ul>';
}
const HOW_TUTORIALS = 'Tutorials are guided lessons inside fmIDE: open Help (F1, or ❓ at the top right) and choose one under Tutorials. fmIDE points at each button and moves on when a step is done. They run on a practice canvas, so your own model is set aside and comes back untouched.';

function indexPage(set, ctx, intro, withTutorials){
  const out = [];
  out.push('<h1>' + h(set === 'excel' ? 'ExcelExporter help' : 'fmIDE help') + '</h1>');
  out.push('<p class="lead">' + h(intro) + '</p>');
  out.push('<p class="links"><a href="all">Every topic on one page</a> (to search with Ctrl+F, or print)</p>');
  if(withTutorials && ctx.set.tutorials.length){
    out.push('<section><h2>Tutorials</h2><p>' + h(HOW_TUTORIALS) + '</p>' + tutorialList(ctx.set.tutorials, id => 'tutorials/' + id) + '</section>');
  }
  ctx.set.groups.forEach(g => {
    const list = ctx.set.topics.filter(t => t.group === g.id);
    if(list.length) out.push('<section id="' + g.id + '"><h2>' + h(g.title) + '</h2>' + topicList(list, id => id) + '</section>');
  });
  return out.join('\n');
}

function topicPage(t, ctx){
  const out = [];
  const group = ctx.set.groups.find(g => g.id === t.group);
  out.push('<p class="back"><a href="./">← All topics</a>' + (group ? ' · <a href="./#' + group.id + '">' + h(group.title) + '</a>' : '') + '</p>');
  out.push('<h1>' + h(t.title) + '</h1>');
  if(t.summary) out.push('<p class="lead">' + h(t.summary) + '</p>');
  out.push('<article class="topic" data-topic="' + t.id + '">' + topicBody(t, ctx, id => id, 'h2') + '</article>');
  const tutorials = (ctx.set.tutorials || []).filter(tu => tu.topic === t.id);
  if(tutorials.length) out.push('<section class="try"><h2>Try it</h2><p>' + h(HOW_TUTORIALS) + '</p>' + tutorialList(tutorials, id => 'tutorials/' + id) + '</section>');
  return out.join('\n');
}

function allPage(set, ctx, withTutorials){
  const out = [];
  out.push('<p class="back"><a href="./">← All topics</a></p>');
  out.push('<h1>' + h(set === 'excel' ? 'ExcelExporter help: every topic' : 'fmIDE help: every topic') + '</h1>');
  if(withTutorials && ctx.set.tutorials.length) out.push('<p>The tutorials, step by step: ' + ctx.set.tutorials.map(tu => '<a href="tutorials/' + tu.id + '">' + h(tu.title) + '</a>').join(' · ') + '</p>');
  out.push('<nav class="toc"><ul>' + ctx.set.groups.filter(g => ctx.set.topics.some(t => t.group === g.id))
    .map(g => '<li><a href="#group-' + g.id + '">' + h(g.title) + '</a></li>').join('') + '</ul></nav>');
  ctx.set.groups.forEach(g => {
    const list = ctx.set.topics.filter(t => t.group === g.id);
    if(!list.length) return;
    out.push('<section class="group" id="group-' + g.id + '"><h2>' + h(g.title) + '</h2>');
    list.forEach(t => out.push('<article class="topic" id="' + t.id + '"><h3>' + h(t.title) + '</h3>' +
      (t.summary ? '<p class="lead">' + h(t.summary) + '</p>' : '') + topicBody(t, ctx, id => '#' + id, 'h4') + '</article>'));
    out.push('</section>');
  });
  return out.join('\n');
}

// What a tutorial's practice canvas starts with, in words: "Revenue: Price (10 $/t), ×, …".
function startText(start){
  if(!start || !Array.isArray(start.canvases) || !start.canvases.length) return '';
  return start.canvases.map(c => {
    const things = (c.nodes || []).map(n => {
      const lines = String(n.text || '').split('\n').map(s => s.trim()).filter(Boolean);
      if(n.type !== 'value') return lines.join(' ');
      return lines[0] + (lines.length > 1 ? ' (' + lines.slice(1).join(' ') + ')' : '');
    }).filter(Boolean);
    return 'a canvas named ' + c.name + (things.length ? ', holding ' + things.join(', ') : '');
  }).join('; ');
}
function tutorialPage(tu, ctx){
  const out = [];
  out.push('<p class="back"><a href="../">← All topics</a> · <a href="./">Tutorials</a></p>');
  out.push('<p class="crumb">Tutorial · about ' + h(tu.minutes) + ' minutes</p>');
  out.push('<h1>' + h(tu.title) + '</h1>');
  if(tu.summary) out.push('<p class="lead">' + h(tu.summary) + '</p>');
  out.push('<p class="how">' + h(HOW_TUTORIALS) + '</p>');
  const start = startText(tu.start);
  if(start) out.push('<p class="start">It starts from a small ready-made model: ' + h(start) + '.</p>');
  out.push('<h2>The steps</h2>');
  out.push('<ol class="steps tutorial-steps">' + (tu.steps || []).map(s => '<li data-step="' + h(s.id) + '">' + richText(s.text, ctx) + '</li>').join('') + '</ol>');
  const t = tu.topic && ctx.set.topics.find(x => x.id === tu.topic);
  if(t) out.push('<section class="see"><h2>See also</h2>' + topicList([t], id => '../' + id) + '</section>');
  return out.join('\n');
}
function tutorialsIndexPage(ctx){
  return ['<p class="back"><a href="../">← All topics</a></p>', '<h1>Tutorials</h1>', '<p class="lead">' + h(HOW_TUTORIALS) + '</p>',
    tutorialList(ctx.set.tutorials, id => id)].join('\n');
}

// The help pages as a Map of site path → Buffer (paths under help/). Throws a HelpError, with
// every problem found, when the text names something that doesn't exist.
function buildHelp(src){
  src = src || loadHelpSources();
  checkHelp(src);
  const places = commandPlaces(src.ribbon || { tabs: [] });
  const files = new Map();
  const put = (name, html) => files.set(name, Buffer.from(html, 'utf8'));

  const f = { set: src.fmide, commands: src.commands, places };
  put('help/index.html', page('fmide', '', 'fmIDE help', 'Plain-English guides to fmIDE, the visual builder for financial models.',
    indexPage('fmide', f, 'Plain-English guides to fmIDE, the visual builder for financial models. The same help is inside fmIDE, offline: press F1, or ❓ at the top right.', true)));
  put('help/all.html', page('fmide', '', 'Every topic — fmIDE help', 'Every fmIDE help topic on one page.', allPage('fmide', f, true)));
  src.fmide.topics.forEach(t => put('help/' + t.id + '.html', page('fmide', '', t.title + ' — fmIDE help', t.summary, topicPage(t, f))));
  put('help/tutorials/index.html', page('fmide', '../', 'Tutorials — fmIDE help', 'Guided lessons inside fmIDE.', tutorialsIndexPage(f)));
  src.fmide.tutorials.forEach(tu => put('help/tutorials/' + tu.id + '.html', page('fmide', '../', tu.title + ' — fmIDE tutorial', tu.summary, tutorialPage(tu, f))));

  if(src.excel){
    const e = { set: src.excel, commands: new Map(), places: new Map() };
    put('help/excel/index.html', page('excel', '../', 'ExcelExporter help', 'Plain-English guides to ExcelExporter, which turns an fmIDE model into an Excel workbook with live formulas.',
      indexPage('excel', e, 'Plain-English guides to ExcelExporter, which turns an fmIDE model into an Excel workbook with live formulas. The same help is inside ExcelExporter: press F1, or ❓ Help at the top right.', false)));
    put('help/excel/all.html', page('excel', '../', 'Every topic — ExcelExporter help', 'Every ExcelExporter help topic on one page.', allPage('excel', e, false)));
    src.excel.topics.forEach(t => put('help/excel/' + t.id + '.html', page('excel', '../', t.title + ' — ExcelExporter help', t.summary, topicPage(t, e))));
  }

  files.set('help/style.css', fs.readFileSync(path.join(SRC, 'library', 'style.css')));
  files.set('help/help.css', fs.readFileSync(path.join(SRC, 'help-pages', 'help.css')));
  files.set('help/LICENSE-CC-BY-4.0.txt', fs.readFileSync(path.join(ROOT, 'docs', 'LICENSE-CC-BY-4.0.txt')));
  return { files, topics: src.fmide.topics.length, tutorials: src.fmide.tutorials.length, excelTopics: src.excel ? src.excel.topics.length : 0 };
}

// The help pages' HTTP headers (added to _headers by tools/build.js): no scripts at all, styles
// and the icon only from the site, no connections, forms or embedding — as the catalogue's.
const HELP_POLICY = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const HELP_HEADERS = [
  { paths: ['/help', '/help/*'], headers: ['Content-Security-Policy: ' + HELP_POLICY] }
];

module.exports = { buildHelp, loadHelpSources, HelpError, HELP_POLICY, HELP_HEADERS, commandPlaces };
