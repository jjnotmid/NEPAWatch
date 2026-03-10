/* =====================================================
   NEPAWatch Lagos — Service Worker v1.2.0
   !! BUMP VERSION STRING ON EVERY DEPLOY !!
   ===================================================== */
const VERSION = 'v1.2.0';
const CACHE   = `nepawatch-${VERSION}`;
const OFFLINE_KEY = 'nw-offline-state';

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

  // Always network-first for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // App shell: cache-first, fall back to network, update cache in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        });
        // Return cache immediately if available, fetch in background
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

  const title = data.title || 'NEPAWatch Lagos';
  const body  = data.body  || 'New power report in your area.';
  const type  = data.type  || 'info';
  const area  = data.area  || '';

  const options = {
    body,
    icon:     '/logo2.jpg',
    badge:    '/logo2.jpg',
    tag:      `nw-${area}-${type}`,
    renotify: true,
    data:     { url: data.url || '/' },
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
          c.postMessage({ type: 'PUSH_CLICK', url: targetUrl });
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
