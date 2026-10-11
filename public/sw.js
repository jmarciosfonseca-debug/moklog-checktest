/* MokLog CheckTest — service worker (abrir offline).
   • /static/* (arquivos com hash): cache-first.
   • Navegação (HTML): rede primeiro; sem rede, usa a última cópia.
   • /icones, manifest, fontes locais: stale-while-revalidate.
   • /api e qualquer outra origem (Firestore etc.): NÃO interceptado. */
const V = "mk-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const guardar = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(V).then((ca) => ca.put(req, c)).catch(() => {}); } return res; };
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin || u.pathname.startsWith("/api")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => guardar("/index.html", res)).catch(() => caches.match("/index.html")));
    return;
  }
  if (u.pathname.startsWith("/static/")) {
    e.respondWith(caches.match(r).then((c) => c || fetch(r).then((res) => guardar(r, res))));
    return;
  }
  if (u.pathname.startsWith("/icones/") || u.pathname === "/manifest.json" || /\.(png|svg|ico|woff2?)$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then((c) => { const n = fetch(r).then((res) => guardar(r, res)).catch(() => c); return c || n; }));
  }
});
