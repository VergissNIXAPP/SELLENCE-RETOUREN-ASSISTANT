const CACHE = "sellence-retouren-assistant-v1";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.mode === "navigate"){
    event.respondWith((async () => {
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", fresh.clone());
        return fresh;
      }catch(e){
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) || (await cache.match("./"));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if(cached) return cached;
    try{
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    }catch(e){
      return cached || Response.error();
    }
  })());
});
