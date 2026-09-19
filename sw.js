const CACHE_NAME = 'ncw-ps-cache-v5.25.35';
const ASSETS = [
  './',
  './index.html',
  './app.js?v=5.25.35',
  './mobile.html',
  './mobile-beta.html',
  './mobile.js?v=2.5.0',
  './mobile-light.html',
  './mobile-light.js?v=2.5.0',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './logo.png',
  './logo-crest.png',
  './tailwind-static.css',
  './html2pdf.bundle.min.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url =>
          fetch(url)
            .then(res => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(err => console.warn('PWA Asset cache skip:', url, err))
        )
      );
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

  const url = new URL(e.request.url);

  // Images & Static Media: Cache First with background update
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Versioned Assets & Scripts: Network First, Fallback to Cache
  if (url.pathname.endsWith('.js') && url.search.includes('v=')) {
    e.respondWith(
      fetch(e.request)
        .then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML: Network First, Fallback to Cache
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
