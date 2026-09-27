// A small local web server that serves a built site/ the way Cloudflare Pages does, so the
// site can be tried (npm run serve) and tested (tests/helpers/site.js) as it will run when
// published. Node only, no packages. What it copies from Cloudflare Pages:
//   - "pretty" addresses: /index.html → /, /dir/index.html → /dir/ and /name.html → /name
//     (308 redirects); /name serves name.html, /dir/ serves dir/index.html, and /dir (a folder
//     with an index.html) redirects to /dir/;
//   - the _headers file: each block is a path pattern (with * for "anything") followed by
//     indented "Name: value" lines; every matching block applies. _headers itself is not
//     served.
// extra(urlPath) may return a file path to serve instead (the tests use it for /apps/).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8'
};

function readHeaderRules(dir){
  const file = path.join(dir, '_headers');
  if(!fs.existsSync(file)) return [];
  const rules = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
    if(!line.trim() || line.trim().startsWith('#')) return;
    if(!/^\s/.test(line)){
      const pattern = new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      rules.push({ pattern, headers: [] });
    } else if(rules.length){
      const m = /^\s+([^:]+):\s*(.*)$/.exec(line);
      if(m) rules[rules.length - 1].headers.push([m[1].trim(), m[2].trim()]);
    }
  });
  return rules;
}

// Resolves { server, origin, close() }. port 0 picks a free port.
function startPagesServer(dir, { port = 0, host = '127.0.0.1', originHost = host, extra } = {}){
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    let file = extra ? extra(urlPath) : null;
    if(!file){
      if(/\.html$/.test(urlPath)){
        res.writeHead(308, { Location: /(^|\/)index\.html$/.test(urlPath) ? urlPath.replace(/index\.html$/, '') : urlPath.replace(/\.html$/, '') });
        res.end(); return;
      }
      const rel = urlPath.endsWith('/') ? urlPath.slice(1) + 'index.html' : urlPath.slice(1);
      file = path.join(dir, ...rel.split('/'));
      if(!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
      else if(!urlPath.endsWith('/') && fs.existsSync(path.join(file, 'index.html')) && file.startsWith(dir + path.sep)){
        res.writeHead(308, { Location: urlPath + '/' });
        res.end(); return;
      }
      if(!file.startsWith(dir + path.sep) || path.basename(file) === '_headers'){ res.writeHead(404); res.end('not found'); return; }
    }
    if(!fs.existsSync(file) || !fs.statSync(file).isFile()){ res.writeHead(404); res.end('not found'); return; }
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate' };
    readHeaderRules(dir).forEach(r => { if(r.pattern.test(urlPath)) r.headers.forEach(([k, v]) => { headers[k] = v; }); });
    res.writeHead(200, headers);
    res.end(fs.readFileSync(file));
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise(resolve => server.listen(port, host, () => {
    resolve({
      server,
      origin: 'http://' + originHost + ':' + server.address().port + '/',
      close: () => new Promise(done => { sockets.forEach(s => s.destroy()); server.close(() => done()); })
    });
  }));
}

module.exports = { startPagesServer, readHeaderRules };
