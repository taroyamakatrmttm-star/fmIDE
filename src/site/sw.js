// fmIDE service worker (the published site only; generated into site/sw.js by `npm run build`).
// It keeps the site's own files so the app works offline, and nothing else: no request to any
// other site is made or answered here. A new version (a new VERSION, computed by the build from
// the site's files) installs in the background and waits; the page offers "Reload" and then
// sends 'skipWaiting'. It never takes over an open page by itself.
const VERSION = '__VERSION__';
const CACHE = 'fmide-' + VERSION;
const FILES = __FILES__;

// Cloudflare Pages shortens page addresses (/index.html → /, /ExcelExporter.html →
// /ExcelExporter) with a redirect, and a browser refuses to show a page that a service
// worker answers with a redirected response. So each file is stored as a clean copy, under
// the name it was asked for.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(f =>
    fetch(new Request(f, { cache: 'reload' })).then(res => {
      if(!res.ok) throw new Error('Could not fetch ' + f + ' (' + res.status + ')');
      if(!res.redirected) return cache.put(f, res);
      return res.blob().then(body => cache.put(f, new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })));
    })
  ))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('fmide-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if(event.data === 'skipWaiting') self.skipWaiting();
});

// The site's own files come from the cache: a page asked for by its short address
// (/ExcelExporter) is its .html file, and "/" is index.html. Anything else of the site's
// origin goes to the network as usual. Other origins are left alone.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        if(hit || req.mode !== 'navigate') return hit;
        const page = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname + '.html';
        return cache.match(new URL(page, url).href);
      }).then(hit => hit || fetch(req))
    )
  );
});
