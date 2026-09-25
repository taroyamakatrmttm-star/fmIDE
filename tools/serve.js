#!/usr/bin/env node
// Serves site/ (the installable web app, built by `npm run build`) at http://localhost:8080/
// the way Cloudflare Pages will (tools/pages-server.js), so it can be tried before it is
// published: install it, go offline, see updates arrive after a rebuild. localhost counts
// as secure, so the service worker works. Node only.
//   node tools/serve.js [port]
'use strict';
const fs = require('fs');
const path = require('path');
const { startPagesServer } = require('./pages-server');

const DIR = path.join(__dirname, '..', 'site');
const PORT = Number(process.argv[2]) || 8080;
if(!fs.existsSync(path.join(DIR, 'index.html'))){
  console.error('serve: site/ is missing — run: npm run build');
  process.exit(1);
}
startPagesServer(DIR, { port: PORT, host: 'localhost' })
  .then(({ origin }) => console.log('fmIDE site: ' + origin + '  (Ctrl+C to stop)'));
