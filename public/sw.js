// Kuuma Obutonde service worker: lets the app open and run with no signal.
//
// - Pages: network first, so people always get the latest version when online;
//   the last copy is saved and shown when offline.
// - App files under /_next/static/ never change once built (their names include
//   a hash), so they are served from the cache first.
// - /api/ requests are never cached: report status must always be fresh, and
//   sending reports is handled by the app's own offline queue.
//
// Bump CACHE when this file's caching rules change; old caches are deleted.
const CACHE = "kuuma-obutonde-v2";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function save(request, response) {
  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function pageNetworkFirst(request) {
  try {
    return await save(request, await fetch(request));
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("/")) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  return hit || save(request, await fetch(request));
}

async function staleWhileRevalidate(request) {
  const hit = await caches.match(request);
  const fresh = fetch(request)
    .then((res) => save(request, res))
    .catch(() => undefined);
  return hit || (await fresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(pageNetworkFirst(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
