/* Homebase service worker
 * - Precaches the offline page and icons.
 * - Cache-first for immutable build assets (/_next/static).
 * - Network-first for page navigations; falls back to the last cached copy of
 *   that page, then to /offline. Cached pages are labelled offline in the UI.
 * - Never caches API routes, auth routes, server actions (POST) or Supabase
 *   requests (cross-origin). Data changes made offline are queued in IndexedDB
 *   by the app (not here) and synced via /api/sync.
 */
const VERSION = "v1";
const STATIC_CACHE = `homebase-static-${VERSION}`;
const PAGE_CACHE = `homebase-pages-${VERSION}`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("homebase-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_USER_CACHE") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

function isCacheablePage(url) {
  return !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/auth/") && url.pathname !== "/login" && url.pathname !== "/signup";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed build assets.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Full page navigations: network first, then cached page, then offline page.
  if (request.mode === "navigate" && isCacheablePage(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic" && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: false });
          return cached || (await caches.match("/offline")) || Response.error();
        }),
    );
  }
});
