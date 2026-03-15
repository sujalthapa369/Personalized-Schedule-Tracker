// StudyOS Service Worker v6 — GitHub Pages compatible
const CACHE = 'studyos-v6';
const BASE = '/Personalized-Schedule-Tracker';
const INDEX = BASE + '/index.html';

self.addEventListener('install', event => {
  event.waitUntil(
    fetch(INDEX)
      .then(resp => {
        if (!resp.ok) throw new Error('index.html fetch failed: ' + resp.status);
        return caches.open(CACHE).then(cache => {
          cache.put(BASE + '/', resp.clone());
          return cache.put(INDEX, resp);
        });
      })
      .catch(err => console.warn('SW install cache failed (non-fatal):', err))
      .finally(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.includes('supabase.co')) return;

  // Navigation — serve index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => {
              c.put(BASE + '/', clone.clone());
              c.put(INDEX, clone);
            });
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(INDEX)
            || await caches.match(BASE + '/');
          if (cached) return cached;
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
            '<h2>StudyOS</h2><p>You are offline. Reconnect to load the app.</p>' +
            '</body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // CDN (fonts, scripts)
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin assets
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
        return resp;
      });
    })
  );
});
