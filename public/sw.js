/* BISWIC Service Worker
 * ----------------------------------------------------------------------------
 * - Caches the app shell for offline launch
 * - Network-first for API routes (always fresh data)
 * - Cache-first for static assets (hashed filenames = safe to cache forever)
 * - HTML pages: network-only (no caching). Caching HTML causes stale-deploy
 *   failures -- the cached HTML references old chunk hashes that no longer
 *   exist on the new deploy, so the browser hits "Failed to fetch" on load.
 * - Skip waiting + clients claim so new versions take effect immediately
 *
 * Bump CACHE_NAME on every deploy so old caches get invalidated on activate.
 */

const CACHE_NAME = 'biswic-v2';
const APP_SHELL = [
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

  // HTML pages: network only. Caching them causes stale-deploy
  // "Failed to fetch" errors when chunk hashes rotate.
  if (sameOrigin && req.headers.get('accept')?.includes('text/html')) {
    return;
  }

  // Next.js _next/static assets: cache-first (hashed filenames = safe)
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

  // Other same-origin static assets: cache-first
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })),
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
