/* Neswef Café — persistent browser-side image cache.
   The first visit fetches each Unsplash image; later visits read it from Cache Storage. */
const IMAGE_CACHE = 'neswef-unsplash-images-v1';
const MAX_CACHED_IMAGES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('neswef-unsplash-images-') && name !== IMAGE_CACHE)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Cache only image assets from the external photo CDN, not page/API requests.
  if (url.hostname !== 'images.unsplash.com' || request.destination !== 'image') return;

  event.respondWith((async () => {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await cache.match(request);

    // Cache-first prevents repeat network requests on later visits.
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
        await cache.put(request, networkResponse.clone());

        // Keep storage bounded; Cache Storage preserves insertion order.
        const keys = await cache.keys();
        while (keys.length > MAX_CACHED_IMAGES) {
          await cache.delete(keys.shift());
        }
      }
      return networkResponse;
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Image unavailable' });
    }
  })());
});
