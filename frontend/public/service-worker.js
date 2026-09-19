// Caches the app SHELL (HTML/JS/CSS/icons) so the app can load with no network at all —
// separate concern from the IndexedDB attendance queue (hooks/useOfflineQueue.js), which
// already handles offline DATA. Deliberately hand-written instead of a Workbox-generated
// precache manifest: CRA's build output filenames are content-hashed per deploy, so a
// runtime cache-as-you-go strategy needs no build-time manifest injection/ejecting.
const CACHE_NAME = "haazri-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only cache same-origin GETs — API calls go straight to the network (or fail and are
  // retried by the app's own IndexedDB queue), never served stale from here.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // cache: "no-store" bypasses the browser's own HTTP cache, not just this
    // service worker's cache — without it, "network-first" can still return a
    // stale index.html straight from disk cache and never reach the network at
    // all, which is what silently blocked auto-updates before this fix.
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
