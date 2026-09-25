#!/usr/bin/env node
// Serves site/ (the installable web app, built by `npm run build`) at http://localhost:8080/
// so it can be tried before it is published: install it, go offline, see updates arrive
// after a rebuild. localhost counts as secure, so the service worker works. Node only.
//   node tools/serve.js [port]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'site');
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8'
};
if(!fs.existsSync(path.join(DIR, 'index.html'))){
  console.error('serve: site/ is missing — run: npm run build');
  process.exit(1);
}
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
  const file = path.join(DIR, ...(urlPath === '/' ? ['index.html'] : urlPath.slice(1).split('/')));
  if(!file.startsWith(DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(file));
}).listen(PORT, 'localhost', () => console.log('fmIDE site: http://localhost:' + PORT + '/  (Ctrl+C to stop)'));
