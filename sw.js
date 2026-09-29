// Service worker: offline shell + phone notifications
const CACHE = "ceo-planner-v7";
const SHELL = ["./", "index.html", "app.css", "app.js", "data.js", "config.js", "manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first for our own files, so updates show up; cache as fallback when offline
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "CEO Planner", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || "CEO Planner", {
    body: data.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.renotify,
    data: { url: data.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
