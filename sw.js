/* =====================================================
   NEPAWatch Nigeria — Service Worker v2.6.0
   To deploy: update version.json (one-line JSON file).
   SW version here only needs bumping when SW logic changes.
   ===================================================== */
const VERSION = 'v2.6.1';
const MAINTENANCE = true;  // flip to false when maintenance is complete
const CACHE   = `nepawatch-${VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/predict.js',
  '/logo.jpg',
  '/logo2.jpg',
  '/badge.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* MAINTENANCE — refuse Supabase calls at the worker.
     Clients running an older cached app.js would otherwise keep querying and
     burning quota. Blocking here catches them regardless of which bundle they
     are on. Flip MAINTENANCE and bump VERSION to bring the app back. */
  if (MAINTENANCE && url.hostname.includes('supabase.co')) {
    event.respondWith(new Response(
      JSON.stringify({ error: 'maintenance' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    ));
    return;
  }

  // Always network-first for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // JS/HTML/JSON always network-first — updated code runs immediately; falls
    // back to cache only when offline.  version.json MUST be in this group so
    // the app can detect a new deployment while the user is offline-first.
    const isShell = /\.(js|html|json)$/.test(url.pathname) || url.pathname === '/';
    if (isShell) {
      event.respondWith(
        fetch(request).then(response => {
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
      );
      return;
    }
    // Navigation requests (SPA deep links) — serve index.html as fallback so
    // a stale cache never leaves the user on a broken partial render.
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(() => caches.match('/index.html'))
      );
      return;
    }
    // Static assets (css, images) — cache-first, update in background
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

/* ━━━ PUSH NOTIFICATIONS ━━━ */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; }
  catch(e) { data = { title: 'NEPAWatch', body: event.data?.text() || 'New power update' }; }

  const title = data.title || 'NEPAWatch Nigeria';
  const body  = data.body  || 'New power report in your area.';
  const type  = data.type  || 'info';
  const area  = data.area  || '';

  const options = {
    body,
    icon:     '/logo2.jpg',
    badge:    '/badge.png',
    tag:      `nw-${area}-${type}`,
    renotify: true,
    data:     { url: data.url || '/', area: data.area || '', type: data.type || '' },
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  },
    ],
    vibrate: type === 'out' ? [200, 100, 200] : [100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.focus();
          c.postMessage({ type: 'PUSH_CLICK', url: targetUrl, area: event.notification.data?.area || '', repType: event.notification.data?.type || '' });
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
