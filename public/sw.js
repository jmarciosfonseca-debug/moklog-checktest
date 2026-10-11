/* MokLog — service worker DESLIGADO (modo offline revertido). Este arquivo existe só para que
   aparelhos que já instalaram o SW antigo o removam: apaga os caches e se desregistra. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch {}
    try { await self.registration.unregister(); } catch {}
    try { const cs = await self.clients.matchAll({ type: "window" }); cs.forEach((c) => c.navigate(c.url)); } catch {}
  })());
});
