// Writes the site's manual pages, /manual (the user manual, docs/manual/; phase 6, the owner's
// request of 21 October 2026): the manual's Markdown as plain HTML pages with no JavaScript,
// beside the help pages. Called by tools/build.js for every site build. Node only, no packages,
// no network.
//
//   manual/index.html               /manual/                    the contents (docs/manual/README.md)
//   manual/<part>.html              /manual/01-getting-started  a part, every lesson an anchor
//   manual/appendix-a-coverage.html /manual/appendix-a-coverage what came when
//   manual/writing-lessons.html     /manual/writing-lessons     how the lessons are written (STYLE.md)
//   manual/manual.css               the manual's own rules (src/help-pages/manual.css)
//
// It also checks the manual, and stops the build (ManualError, nothing written) when:
// - a lesson ("## Lesson N.M — …") has no anchor line before it, or lacks one of its card lines
//   (Goal, You need, Time, In the app, Came in);
// - a Help topic or tutorial named under "In the app" doesn't exist, or has another title
//   (fmIDE's and ExcelExporter's help as tools/build-help.js reads it; fmGraph's too);
// - a link leads nowhere: a page of the manual or an anchor in it that doesn't exist, a file of
//   the repository that doesn't exist, or anything but https:, http: or a relative address;
// - an anchor is used twice, or the contents (README.md) don't link a lesson.
//
// The Markdown is the plain subset the manual uses (STYLE.md): headings, paragraphs, lists
// (nested by indenting), tables, block quotes, fenced code, rules, **bold**, *italic*, `code`
// and [links](…). Every text goes into a page only through escapeXml(); the one HTML the
// manual may hold, a line <a id="…"></a> before a heading, becomes that heading's id. Any
// other HTML in the text shows as written. In the pages, a link to another file of the
// repository goes to it on GitHub, and a Help topic named under "In the app" links to its
// help page (fmIDE's and ExcelExporter's; fmGraph's help is only inside fmGraph).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MANUAL = path.join(ROOT, 'docs', 'manual');
const REPO = 'https://github.com/taroyamakatrmttm-star/fmIDE/';

const { escapeXml } = require('../src/shared/escaping.js');
const { loadHelpSources } = require('./build-help.js');
const h = (s) => escapeXml(s == null ? '' : s);

class ManualError extends Error {}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const ANCHOR_LINE = /^<a id="([^"]*)"><\/a>\s*$/;
const LESSON = /^## Lesson (\d+\.\d+) — (.+)$/;
const CARD = ['Goal', 'You need', 'Time', 'In the app', 'Came in'];
// A file's page: README.md is the contents, STYLE.md the writing guide, the rest by their names.
function pageName(file){
  if(file === 'README.md') return 'index';
  if(file === 'STYLE.md') return 'writing-lessons';
  return file.replace(/\.md$/, '');
}

// ---------- reading the sources ----------
// Everything the pages are made from. Tests pass their own (a broken link, hostile text…).
function loadManualSources(){
  const files = new Map();
  fs.readdirSync(MANUAL).filter(f => f.endsWith('.md')).sort().forEach(f => files.set(f, fs.readFileSync(path.join(MANUAL, f), 'utf8')));
  const help = loadHelpSources();
  const run = (names, file) => vm.runInContext(fs.readFileSync(path.join(SRC, 'help', file), 'utf8') + '\n;({ ' + names + ' })', vm.createContext({}));
  const fg = run('FMGRAPH_HELP_TOPICS', 'fmgraph-help.js');
  const fgt = run('FMGRAPH_TUTORIALS', 'fmgraph-tutorials.js');
  return {
    files,
    help: {
      fmIDE: { topics: help.fmide.topics, tutorials: help.fmide.tutorials },
      ExcelExporter: { topics: help.excel.topics, tutorials: [] },
      fmGraph: { topics: fg.FMGRAPH_HELP_TOPICS, tutorials: fgt.FMGRAPH_TUTORIALS },
    },
    // Whether a file or folder of the repository exists (a link to one).
    exists: (repoPath) => fs.existsSync(path.join(ROOT, ...repoPath.split('/'))),
    isFolder: (repoPath) => { try { return fs.statSync(path.join(ROOT, ...repoPath.split('/'))).isDirectory(); } catch(e){ return false; } },
  };
}

// ---------- reading the Markdown ----------
// The text outside fenced code, as lines (code can show anything, links included).
function linesOutsideCode(text){
  let inCode = false;
  return text.split('\n').filter(l => {
    if(/^\s*```/.test(l)){ inCode = !inCode; return false; }
    return !inCode;
  });
}
// Inline code spans hide what is in them.
const withoutCode = (line) => line.replace(/`[^`]*`/g, '``');
const LINK = /\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]*)\)/g;
// A heading's own anchor, as GitHub makes it.
const slug = (text) => text.toLowerCase().replace(/[^\w\- ]/g, '').trim().replace(/ /g, '-');
function anchorsOf(text){
  const set = new Set();
  linesOutsideCode(text).forEach(l => {
    const a = ANCHOR_LINE.exec(l);
    if(a) set.add(a[1]);
    const m = /^#{1,6} (.+)$/.exec(l);
    if(m) set.add(slug(m[1]));
  });
  return set;
}
// The Help topics and tutorials an "In the app" line names: [{ app, tutorial, title, id }].
function helpRefs(line){
  const out = [];
  let app = null, tutorial = false;
  for(const m of line.matchAll(/(fmIDE|ExcelExporter|fmGraph)( Help| tutorial)?|Tutorial|\*([^*]+)\* \(`([a-z0-9-]+)`/g)){
    if(m[1]){ app = m[1]; tutorial = m[2] === ' tutorial'; continue; }
    if(m[0] === 'Tutorial'){ tutorial = true; continue; }
    out.push({ app, tutorial, title: m[3], id: m[4] });
  }
  return out;
}

// ---------- checks ----------
function checkManual(src){
  const problems = [];
  const files = src.files;
  if(!files.has('README.md')) problems.push('there is no README.md (the contents)');
  const anchors = new Map([...files].map(([f, t]) => [f, anchorsOf(t)]));
  const owners = new Map();
  const lessons = []; // { file, id, number }
  for(const [file, text] of files){
    const lines = linesOutsideCode(text);
    lines.forEach((l, i) => {
      const a = ANCHOR_LINE.exec(l);
      if(a){
        if(!ID.test(a[1])) problems.push(file + ': the anchor ' + JSON.stringify(a[1]) + ' must be small letters, digits and dashes');
        if(owners.has(a[1])) problems.push(file + ': the anchor ' + a[1] + ' is used already, in ' + owners.get(a[1]));
        else owners.set(a[1], file);
      }
      const m = LESSON.exec(l);
      if(!m) return;
      const before = ANCHOR_LINE.exec(lines[i - 1] || '');
      if(!before) problems.push(file + ': lesson ' + m[1] + ' has no anchor line (<a id="…"></a>) before it');
      else lessons.push({ file, id: before[1], number: m[1] });
      const card = [];
      for(let j = i + 1; j < lines.length && !/^#{1,3} /.test(lines[j]); j++) if(lines[j].startsWith('> **')) card.push(lines[j]);
      CARD.forEach(field => { if(!card.some(c => c.startsWith('> **' + field + ':**'))) problems.push(file + ': lesson ' + m[1] + ' has no "' + field + '" line'); });
      card.filter(c => c.startsWith('> **In the app:**')).forEach(c => helpRefs(c).forEach(r => {
        const set = src.help[r.app];
        const list = set && (r.tutorial ? set.tutorials : set.topics);
        const found = list && list.find(t => t.id === r.id);
        const what = r.app + (r.tutorial ? ' tutorial ' : ' Help topic ') + r.id;
        if(!found) problems.push(file + ': lesson ' + m[1] + ' names ' + what + ', which doesn\'t exist');
        else if(found.title !== r.title) problems.push(file + ': lesson ' + m[1] + ' calls ' + what + ' "' + r.title + '"; its title is "' + found.title + '"');
      }));
    });
    // Links.
    lines.forEach(l => {
      for(const m of withoutCode(l).matchAll(LINK)){
        const target = m[2];
        if(/^https?:\/\//i.test(target)) continue;
        if(/^[a-z][a-z0-9+.-]*:/i.test(target)){ problems.push(file + ': the link ' + JSON.stringify(target) + ' isn\'t https:, http: or an address in the repository'); continue; }
        const [p, frag] = target.split('#');
        if(!p){
          if(frag && !anchors.get(file).has(frag)) problems.push(file + ': the link #' + frag + ' leads to no anchor on its page');
          continue;
        }
        const repoPath = path.posix.normalize('docs/manual/' + p).replace(/\/$/, '');
        if(repoPath.startsWith('..')){ problems.push(file + ': the link ' + target + ' leaves the repository'); continue; }
        if(repoPath.startsWith('docs/manual/') && repoPath.endsWith('.md') && !repoPath.slice('docs/manual/'.length).includes('/')){
          const other = repoPath.slice('docs/manual/'.length);
          if(!files.has(other)){ problems.push(file + ': the link ' + target + ' leads to a page of the manual that doesn\'t exist'); continue; }
          if(frag && !anchors.get(other).has(frag)) problems.push(file + ': the link ' + target + ' leads to no anchor in ' + other);
          continue;
        }
        if(!src.exists(repoPath)) problems.push(file + ': the link ' + target + ' leads to ' + repoPath + ', which isn\'t in the repository');
      }
    });
  }
  // The contents link every lesson.
  const readme = files.get('README.md') || '';
  lessons.forEach(l => {
    if(!readme.includes('(' + l.file + '#' + l.id + ')')) problems.push('README.md: the contents don\'t link lesson ' + l.number + ' (' + l.file + '#' + l.id + ')');
  });
  if(problems.length) throw new ManualError('The manual\'s pages can\'t be built, so nothing is published:\n  ' + problems.join('\n  '));
  return lessons;
}

// ---------- the Markdown as HTML ----------
// A link's address in the pages, from the page of `file`; null for one that can't be a link.
function hrefFor(target, file, src){
  if(/^https?:\/\//i.test(target)) return target;
  const help = /^help:(fmide|fmide-tutorial|excel)\/([a-z0-9-]+)$/.exec(target);
  if(help) return { fmide: '../help/', 'fmide-tutorial': '../help/tutorials/', excel: '../help/excel/' }[help[1]] + help[2];
  if(/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const [p, frag] = target.split('#');
  const hash = frag ? '#' + frag : '';
  if(!p) return hash || null;
  const repoPath = path.posix.normalize('docs/manual/' + p).replace(/\/$/, '');
  if(repoPath.startsWith('docs/manual/') && repoPath.endsWith('.md') && src.files.has(repoPath.slice('docs/manual/'.length))){
    const name = pageName(repoPath.slice('docs/manual/'.length));
    return (name === 'index' ? './' : name) + hash;
  }
  if(repoPath === 'docs/LICENSE-CC-BY-4.0.txt') return '../help/LICENSE-CC-BY-4.0.txt';
  if(repoPath === 'LICENSE') return '../LICENSE.txt';
  return REPO + (src.isFolder(repoPath) ? 'tree' : 'blob') + '/main/' + repoPath + hash;
}

// Text: `code`, [links](…), **bold** and *italic*; everything else escaped.
function inline(text, ctx, inLink){
  const out = [];
  const re = /`([^`]*)`|\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]*)\)/g;
  let last = 0, m;
  while((m = re.exec(text))){
    out.push(emphasis(text.slice(last, m.index)));
    if(m[1] !== undefined) out.push('<code>' + h(m[1]) + '</code>');
    else {
      const inner = inline(m[2], ctx, true);
      const href = inLink ? null : hrefFor(m[3], ctx.file, ctx.src);
      out.push(href ? '<a href="' + h(href) + '">' + inner + '</a>' : inner);
    }
    last = re.lastIndex;
  }
  out.push(emphasis(text.slice(last)));
  return out.join('');
}
function emphasis(text){
  return h(text.replace(/\\\|/g, '|'))
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?![*\w])/g, '$1<em>$2</em>');
}

// A table row's cells, split at | outside `code` (a \| inside a cell is a |).
function cells(line){
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let cur = '', code = false;
  for(let i = 0; i < s.length; i++){
    const c = s[i];
    if(c === '\\' && s[i + 1] === '|'){ cur += '\\|'; i++; continue; }
    if(c === '`') code = !code;
    if(c === '|' && !code){ out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

// "In the app": each Help topic named links to its page on the site (fmGraph's has none).
function linkHelp(line){
  let app = null, tutorial = false;
  return line.replace(/(fmIDE|ExcelExporter|fmGraph)( Help| tutorial)?|Tutorial|\*([^*]+)\* \(`([a-z0-9-]+)`\)/g, (all, a, kind, title, id) => {
    if(a){ app = a; tutorial = kind === ' tutorial'; return all; }
    if(all === 'Tutorial'){ tutorial = true; return all; }
    const scheme = app === 'fmIDE' ? (tutorial ? 'fmide-tutorial' : 'fmide') : app === 'ExcelExporter' && !tutorial ? 'excel' : null;
    return scheme ? '[*' + title + '*](help:' + scheme + '/' + id + ') (`' + id + '`)' : all;
  });
}

const indentOf = (l) => /^ */.exec(l)[0].length;
const ITEM = /^(\d+\.|-) +(.*)$/;
// Blocks from lines (lists hold blocks of their own, their lines un-indented).
function blocks(lines, ctx){
  const out = [];
  let i = 0, anchor = null;
  const isTableSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l || '') && l.includes('-');
  while(i < lines.length){
    const l = lines[i];
    if(!l.trim()){ i++; continue; }
    if(/^\s*```/.test(l)){
      const code = [];
      for(i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      out.push('<pre><code>' + h(code.join('\n')) + '</code></pre>');
      continue;
    }
    const a = ANCHOR_LINE.exec(l);
    if(a){ anchor = a[1]; i++; continue; }
    const hm = /^(#{1,6}) (.+)$/.exec(l);
    if(hm){
      const n = hm[1].length;
      out.push('<h' + n + ' id="' + h(anchor || slug(hm[2])) + '">' + inline(hm[2], ctx) + '</h' + n + '>');
      anchor = null; i++;
      continue;
    }
    if(/^-{3,}\s*$/.test(l)){ out.push('<hr>'); i++; continue; }
    if(l.startsWith('>')){
      const quote = [];
      for(; i < lines.length && lines[i].startsWith('>'); i++) quote.push(lines[i].replace(/^> ?/, ''));
      out.push('<blockquote>' + quote.filter(q => q.trim()).map(q => '<p>' + inline(q.startsWith('**In the app:**') ? linkHelp(q) : q, ctx) + '</p>').join('') + '</blockquote>');
      continue;
    }
    if(l.trim().startsWith('|') && isTableSep(lines[i + 1])){
      const head = cells(l);
      i += 2;
      const rows = [];
      for(; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
      out.push('<div class="table"><table><thead><tr>' + head.map(c => '<th>' + inline(c, ctx) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c, ctx) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    const item = ITEM.exec(l);
    if(item){
      const ordered = item[1] !== '-';
      const items = [];
      while(i < lines.length){
        const m = ITEM.exec(lines[i]);
        if(!m || (m[1] !== '-') !== ordered) break;
        const width = m[1].length + 1;
        const body = [m[2]];
        for(i++; i < lines.length; i++){
          const next = lines[i];
          if(!next.trim()){
            // A blank line ends the item unless what follows is still indented under it.
            let k = i + 1;
            while(k < lines.length && !lines[k].trim()) k++;
            if(k < lines.length && indentOf(lines[k]) >= width){ body.push(''); continue; }
            break;
          }
          if(indentOf(next) >= width) body.push(next.slice(width));
          else if(indentOf(next) === 0 && (ITEM.test(next) || /^(#|>|\||```|<a id|-{3,})/.test(next))) break;
          else if(indentOf(next) > 0) body.push(next.trim());
          else body.push(next);
        }
        items.push(body);
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>' + items.map(body => {
        // The first line is the item's text; what is indented under it, its own blocks.
        const rest = [];
        const first = [body[0]];
        let j = 1;
        for(; j < body.length && body[j].trim() && !ITEM.test(body[j]) && !/^```/.test(body[j]); j++) first.push(body[j]);
        for(; j < body.length; j++) rest.push(body[j]);
        return '<li>' + inline(first.join(' '), ctx) + (rest.length ? blocks(rest, ctx) : '') + '</li>';
      }).join('') + '</' + tag + '>');
      continue;
    }
    const para = [];
    for(; i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6} |>|\||-{3,}\s*$)/.test(lines[i]) && !ITEM.test(lines[i]) && !ANCHOR_LINE.test(lines[i]); i++) para.push(lines[i].trim());
    if(!para.length){ out.push('<p>' + inline(l.trim(), ctx) + '</p>'); i++; continue; }
    out.push('<p>' + inline(para.join(' '), ctx) + '</p>');
  }
  return out.join('\n');
}

// Plain text of a line of Markdown (for a page's description).
const plain = (s) => s.replace(/`([^`]*)`/g, '$1').replace(LINK, '$1').replace(/\*+/g, '').trim();

function page(title, description, main){
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + h(title) + '</title>',
    description ? '<meta name="description" content="' + h(description) + '">' : null,
    '<link rel="stylesheet" href="../help/style.css">',
    '<link rel="stylesheet" href="../help/help.css">',
    '<link rel="stylesheet" href="manual.css">',
    '<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">',
    '</head>',
    '<body class="help-site manual">',
    '<header class="top"><a class="home" href="./">fmIDE manual</a><nav><a href="../help/">fmIDE help</a><a href="../help/excel/">ExcelExporter help</a><a href="../">Open fmIDE</a></nav></header>',
    '<main>',
    main,
    '</main>',
    '<footer>',
    '<p>The fmIDE manual © 2026 Taro Yamaka. Each page says its licence at its end: <a href="../help/LICENSE-CC-BY-4.0.txt">CC BY 4.0</a>, or, for Parts 5 and 7, which describe ExcelExporter, the <a href="../LICENSE.txt">Apache License 2.0</a>.</p>',
    '</footer>',
    '</body>',
    '</html>',
    ''
  ].filter(l => l !== null).join('\n');
}

// The manual's pages as a Map of site path → Buffer (paths under manual/). Throws a
// ManualError, with every problem found, when the manual has a broken link, lesson or name.
function buildManual(src){
  src = src || loadManualSources();
  const lessons = checkManual(src);
  const files = new Map();
  for(const [file, text] of src.files){
    const lines = text.split('\n');
    const titleLine = lines.find(l => /^# /.test(l));
    const title = titleLine ? plain(titleLine.slice(2)) : file;
    const descLine = lines.find(l => l.trim() && !/^(#|\[|>|\||<a |-{3,}|\*)/.test(l.trim()));
    const description = descLine ? plain(descLine).slice(0, 200) : '';
    const html = blocks(lines, { file, src });
    files.set('manual/' + pageName(file) + '.html', Buffer.from(page(file === 'README.md' ? 'The fmIDE manual' : title + ' — fmIDE manual', description, html), 'utf8'));
  }
  files.set('manual/manual.css', fs.readFileSync(path.join(SRC, 'help-pages', 'manual.css')));
  return { files, pages: src.files.size, lessons: lessons.length };
}

// The manual's HTTP headers (added to _headers by tools/build.js): the help pages' own policy,
// no scripts at all.
const MANUAL_HEADERS = [
  { paths: ['/manual', '/manual/*'], headers: ['Content-Security-Policy: ' + require('./build-help.js').HELP_POLICY] }
];

module.exports = { buildManual, loadManualSources, checkManual, ManualError, MANUAL_HEADERS, pageName };
