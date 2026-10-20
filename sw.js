// Offline play: serve from cache at once, refresh the cache from the network in the
// background (stale-while-revalidate). A new deploy shows up on the next launch.
const CACHE = 'kiln';
const SHELL = ['./', 'index.html', 'style.css', 'src/core.js', 'src/ui.js', 'manifest.webmanifest',
  'lang/languages.json', 'lang/en.json',   // other languages get cached the first time they load
  'fonts/bricolage-grotesque-latin.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }).catch(() => hit || Response.error());
    e.waitUntil(net);
    return hit || net;
  }));
});
