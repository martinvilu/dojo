const CACHE_NAME = 'jutsu-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  // Use Network First, falling back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
