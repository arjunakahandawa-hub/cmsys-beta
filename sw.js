const CACHE_NAME = 'ncw-ps-cache-v5.12';
const ASSETS = [
  './?v=5.12',
  './index.html?v=5.12',
  './app.js?v=5.12',
  './style.css?v=5.12',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
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
  if (
    e.request.method !== 'GET' ||
    e.request.url.includes('chrome-extension') ||
    e.request.url.includes('firebaseio.com') ||
    e.request.url.includes('identitytoolkit') ||
    e.request.url.includes('google')
  ) {
    return;
  }

  // Network First for HTML and JS to ensure latest updates are served immediately
  e.respondWith(
    fetch(e.request)
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
        return caches.match(e.request, { ignoreSearch: true });
      })
  );
});
