// The installable web app (site/), built fresh into a temporary folder and served from
// http://127.0.0.1:<port>/ by a tiny Node web server (no packages): this machine counts as a
// secure context, so service workers work. apps/ is served too, under /apps/.
// Every request the browser makes (pages and service worker alike) is recorded, so a test
// can check that nothing but this server was ever contacted.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSite } = require('../../tools/build.js');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8'
};

// Resolves { origin, dir, close() }.
function startSiteServer(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-site-'));
  const { version } = buildSite(dir);
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    let file = null;
    if(urlPath.startsWith('/apps/')) file = path.join(ROOT, 'apps', path.basename(urlPath));
    else file = path.join(dir, ...(urlPath === '/' ? ['index.html'] : urlPath.slice(1).split('/')));
    if(!file.startsWith(dir) && !file.startsWith(path.join(ROOT, 'apps')) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(file));
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const origin = 'http://127.0.0.1:' + server.address().port + '/'; // a secure context, like localhost
    resolve({
      origin, dir, version,
      close: () => new Promise(done => { sockets.forEach(s => s.destroy()); server.close(() => done()); })
    });
  }));
}

// Waits until the page is controlled by the site's service worker.
function waitForController(page){
  return page.evaluate(() => navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller ? true
    : new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', () => r(true), { once: true }))));
}

async function openSite(page, url){
  await page.goto(url);
  await page.waitForFunction(() => window.fm && typeof window.fm.canvases === 'function');
}

module.exports = { startSiteServer, waitForController, openSite };
