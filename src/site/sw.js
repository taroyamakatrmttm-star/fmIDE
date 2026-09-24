// fmIDE service worker (the published site only; generated into site/sw.js by `npm run build`).
// It keeps the site's own files so the app works offline, and nothing else: no request to any
// other site is made or answered here. A new version (a new VERSION, computed by the build from
// the site's files) installs in the background and waits; the page offers "Reload" and then
// sends 'skipWaiting'. It never takes over an open page by itself.
const VERSION = '__VERSION__';
const CACHE = 'fmide-' + VERSION;
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
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

// The site's own files come from the cache (the page itself for "./"); anything else of the
// site's origin goes to the network as usual. Other origins are left alone.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => hit ||
        (req.mode === 'navigate' && url.pathname.endsWith('/') ? cache.match('./index.html') : null)
      ).then(hit => hit || fetch(req))
    )
  );
});
