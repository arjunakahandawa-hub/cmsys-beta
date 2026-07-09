const CACHE_NAME = 'ncw-ps-cache-v2.2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './navy_crest.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
