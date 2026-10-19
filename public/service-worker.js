// El cliente legado (public/index.html) registraba este service worker y
// cacheaba "/", "/index.html" y "/js/app.js". La app actual no usa service
// worker: esta versión se instala en los navegadores que tenían la vieja,
// borra sus cachés y se desregistra para no interceptar la app Next.js.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
