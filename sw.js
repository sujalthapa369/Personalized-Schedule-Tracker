// StudyOS Service Worker v4
const CACHE_NAME = 'studyos-v4';

// Install: skip pre-caching entirely — avoids 404 on './' 
// Assets get cached on first fetch instead
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

// Activate: delete all old caches, claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and browser-internal requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip Supabase — always needs live network
  if (url.hostname.includes('supabase.co')) return;

  // Navigation (opening the app): network first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy of index.html on every successful load
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline: serve cached index.html
          const cached = await caches.match(request)
            || await caches.match('/index.html')
            || await caches.match('./index.html');
          return cached || new Response('App is offline. Please reconnect.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // External CDN (fonts, supabase SDK, chart.js): network first, cache on success
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Local assets (icons, manifest): cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        });
      })
      .catch(() => new Response('Not found', { status: 404 }))
  );
});
