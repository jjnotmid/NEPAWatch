/* =====================================================
   NEPAWatch Lagos — Service Worker
   !! BUMP THIS VERSION STRING ON EVERY DEPLOY !!
   e.g. v1.0.1 → v1.0.2 → v1.0.3
   This is what forces users onto the new version.
   ===================================================== */
const VERSION = 'v1.0.0';
const CACHE   = `nepawatch-${VERSION}`;

/* Files to cache for offline use */
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/predict.js',
  '/predict.css',
  '/logo.jpg',
  '/logo2.jpg',
];

/* ── Install: cache all core files ── */
self.addEventListener('install', event => {
  // Skip waiting so the new SW takes over immediately
  // (instead of waiting for all tabs to close)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
});

/* ── Activate: delete every old cache ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)          // anything not this version
          .map(key => caches.delete(key))         // nuke it
      )
    ).then(() => self.clients.claim())            // take control of all open tabs
  );
});

/* ── Fetch: network-first for HTML/JS/CSS, cache fallback ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept Supabase API calls, Google Maps, external fonts, etc.
  if (url.origin !== self.location.origin) return;

  // Network-first strategy: always try the network first.
  // If the network succeeds, update the cache entry.
  // If the network fails (offline), fall back to the cache.
  event.respondWith(
    fetch(request)
      .then(response => {
        // Only cache valid responses for our own files
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* ── Message: force update on demand ── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
