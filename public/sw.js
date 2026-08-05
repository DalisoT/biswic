/* BISWIC Service Worker
 * ----------------------------------------------------------------------------
 * - Caches the app shell for offline launch
 * - Network-first for API routes (always fresh data)
 * - Cache-first for static assets
 * - Skip waiting + clients claim so new versions take effect immediately
 */

const CACHE_NAME = 'biswic-v1';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // API routes: network only (never cache auth or live data)
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data'))) {
    return;
  }

  // Next.js _next/static assets: cache-first
  if (sameOrigin && url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  // Pages & other same-origin: network-first, fall back to cache
  if (sameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/dashboard'))),
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'BISWIC', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'BISWIC', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: { url: payload.url || '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(self.clients.openWindow(url));
});
