/* MokLog — service worker v2: abrir o app sem internet.
   Regras de segurança (lição de 11/10, quando um cache velho prendeu o app):
   - nunca intercepta /api/, outros domínios (Firebase, Google) nem requisições que não sejam GET;
   - tela inicial: rede primeiro (4 s); só se a rede falhar usa a cópia guardada;
   - arquivos /static/ têm nome com hash: cache primeiro é seguro;
   - NÃO se ativa sozinho: a versão nova fica esperando o usuário tocar em "Atualizar" (mensagem PULAR_ESPERA);
   - cada versão tem seus próprios caches; ao ativar, apaga os das versões anteriores;
   - a chave de desligamento é remota (offline-config.json): ver src/registrarSW.js. */
const BUILD = "__BUILD_ID__";
const SHELL = "mk-shell-" + BUILD;
const ASSETS = "mk-assets-" + BUILD;
const ESPERA_REDE_MS = 4000;

// Guarda a tela inicial e TODOS os arquivos de código da versão (js/css do asset-manifest), para que uma tela aberta pela
// primeira vez sem internet também carregue. Melhor-esforço: se algum arquivo falhar, a instalação segue com o que deu.
async function guardarVersao() {
  const c = await caches.open(SHELL);
  await c.add(new Request("/", { cache: "reload" })).catch(() => {});
  try {
    const m = await (await fetch("/asset-manifest.json", { cache: "no-store" })).json();
    const arqs = Object.values(m.files || {}).filter((u) => typeof u === "string" && /^\/static\/.+\.(js|css)$/.test(u));
    const a = await caches.open(ASSETS);
    for (let i = 0; i < arqs.length; i += 4) await Promise.all(arqs.slice(i, i + 4).map((u) => a.add(u).catch(() => {})));
  } catch (_) { /* sem manifesto: segue só com a tela inicial */ }
}

self.addEventListener("install", (e) => { e.waitUntil(guardarVersao().catch(() => {})); });

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      const ks = await caches.keys();
      await Promise.all(ks.filter((k) => k.indexOf("mk-") === 0 && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
    } catch (_) { /* limpar é melhor-esforço */ }
  })());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.tipo === "PULAR_ESPERA") self.skipWaiting();
});

const comTempo = (p, ms) => new Promise((ok, falha) => { const t = setTimeout(() => falha(new Error("tempo")), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); falha(e); }); });

async function navegar(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await comTempo(fetch(req), ESPERA_REDE_MS);
    if (r && r.ok && new URL(req.url).pathname === "/") c.put("/", r.clone()).catch(() => {});
    return r;
  } catch (_) {
    const guardado = await c.match("/");
    if (guardado) return guardado;
    return new Response("Sem conexão e sem cópia guardada deste aparelho.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cachePrimeiro(req) {
  const c = await caches.open(ASSETS);
  const achou = await c.match(req);
  if (achou) return achou;
  const r = await fetch(req);
  if (r && r.ok) c.put(req, r.clone()).catch(() => {});
  return r;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.indexOf("/api/") === 0 || p.indexOf("/local/") === 0 || p === "/sw.js" || p === "/offline-config.json") return;
  if (req.mode === "navigate") { e.respondWith(navegar(req)); return; }
  if (p.indexOf("/static/") === 0 || p.indexOf("/icones/") === 0 || /^\/(icon-\d+\.png|apple-touch-icon\.png|manifest\.json|favicon\.ico)$/.test(p)) e.respondWith(cachePrimeiro(req));
});
