const CACHE_NAME = 'ncw-ps-cache-v4.51';
const ASSETS = [
  './?v=4.51',
  './index.html?v=4.51',
  './app.js?v=4.51',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only cache GET requests and bypass Firebase/Chrome Extension requests
  if (
    e.request.method !== 'GET' ||
    e.request.url.includes('chrome-extension') ||
    e.request.url.includes('firebaseio.com') ||
    e.request.url.includes('identitytoolkit') ||
    e.request.url.includes('google')
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cachedResponse => {
      const fetchPromise = fetch(e.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ignore network errors since we have cache fallback
        });

      return cachedResponse || fetchPromise;
    })
  );
});
