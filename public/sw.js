self.addEventListener("install", (event) => {
  const CACHE_NAME = "otw-driver-static-v1";
  const ASSETS = ["/driver", "/manifest.webmanifest", "/icons/otw-192.svg", "/icons/otw-512.svg"];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => undefined);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (!url.origin.includes(self.location.origin)) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const cloned = response.clone();
          caches.open("otw-driver-static-v1").then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => cached);
    })
  );
});
