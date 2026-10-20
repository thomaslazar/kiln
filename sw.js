// Offline play: serve from cache at once, refresh the cache from the network in the
// background (stale-while-revalidate). A new deploy shows up on the next launch.
const CACHE = 'kiln';
const SHELL = ['./', 'index.html', 'style.css', 'src/core.js', 'src/ui.js', 'manifest.webmanifest',
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
      if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());   // opaque: Google Font files
      return r;
    }).catch(() => hit || Response.error());
    e.waitUntil(net);
    return hit || net;
  }));
});
