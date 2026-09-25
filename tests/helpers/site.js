// The installable web app (site/), built fresh into a temporary folder and served from
// http://127.0.0.1:<port>/ the way Cloudflare Pages serves it (tools/pages-server.js:
// shortened .html addresses and the _headers settings, including the security policy).
// This machine counts as a secure context, so service workers work. apps/ is served too,
// as plain files, under /apps/.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSite } = require('../../tools/build.js');
const { startPagesServer } = require('../../tools/pages-server.js');

const APPS = path.resolve(__dirname, '..', '..', 'apps');

// Resolves { origin, dir, version, close() }.
async function startSiteServer(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmide-site-'));
  const { version } = buildSite(dir);
  const extra = (urlPath) => urlPath.startsWith('/apps/') ? path.join(APPS, path.basename(urlPath)) : null;
  const { origin, close } = await startPagesServer(dir, { extra });
  return { origin, dir, version, close };
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
