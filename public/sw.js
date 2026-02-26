const CACHE_NAME = "otw-driver-static-v2";
const LEGACY_CACHE_PREFIX = "otw-driver-static-";
const ASSETS = ["/manifest.webmanifest", "/icons/otw-192.svg", "/icons/otw-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS).catch(() => undefined);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    ASSETS.includes(url.pathname) ||
    /\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => cached);
    })
  );
});
